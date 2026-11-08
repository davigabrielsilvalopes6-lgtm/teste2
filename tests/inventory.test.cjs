#!/usr/bin/env node
'use strict';

// Tests the model embedded in the shipped v0.4 HTML, then its real game/save
// integration in a VM. DOM painting is stubbed only for the integration realm;
// actual pointer/keyboard/rendering coverage belongs to the Playwright suite.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'ORIGENS — Survival v0.4.html');
const source = fs.readFileSync(file, 'utf8');
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1];
const modelStart = '// ===== Inventário v0.4: modelo =====';
const modelEnd = '// ===== Fim do modelo de inventário =====';
assert.ok(
  script.includes(modelStart) && script.includes(modelEnd),
  'model markers in shipped HTML',
);
const model = script.slice(script.indexOf(modelStart), script.indexOf(modelEnd) + modelEnd.length);
const pure = vm.createContext({ console });
vm.runInContext(model, pure, { filename: file + ':inventory-model' });
const runModel = (code) => vm.runInContext(code, pure, { timeout: 5000 });
const json = (value) => JSON.parse(JSON.stringify(value));
const equal = (actual, expected) => assert.deepEqual(json(actual), expected);
let passed = 0;
const covered = new Set();
function test(criteria, name, fn) {
  try {
    fn();
    passed++;
    for (const criterion of criteria) covered.add(criterion);
    console.log('PASS [' + criteria.map((n) => String(n).padStart(2, '0')).join(',') + '] ' + name);
  } catch (error) {
    console.error('FAIL [' + criteria.join(',') + '] ' + name);
    throw error;
  }
}
function fresh() {
  runModel('globalThis.inv=createInventory()');
}
function conserved(inv) {
  const totals = { wood: 0, stone: 0, ore: 0 };
  for (const stack of [...inv.slots, inv.cursor]) if (stack) totals[stack.itemId] += stack.quantity;
  for (const kind of Object.keys(totals)) totals[kind] += inv.pending[kind] || 0;
  return totals;
}
function invariant(inv) {
  assert.equal(inv.slots.length, 16);
  const references = new Set();
  for (const stack of [...inv.slots, inv.cursor]) {
    if (stack === null) continue;
    assert.ok(['wood', 'stone', 'ore'].includes(stack.itemId));
    assert.ok(Number.isSafeInteger(stack.quantity) && stack.quantity >= 1 && stack.quantity <= 200);
    assert.equal(references.has(stack), false, 'no shared live stack objects');
    references.add(stack);
  }
  assert.ok(Number.isInteger(inv.selected) && inv.selected >= 0 && inv.selected <= 8);
  for (const kind of ['wood', 'stone', 'ore'])
    assert.ok(Number.isSafeInteger(inv.pending[kind]) && inv.pending[kind] >= 0);
}
function assertModelInventory() {
  invariant(runModel('inv'));
}

test(
  [1, 2, 3, 4, 5, 34],
  'exactly sixteen empty storage slots; central registry and fixed limits',
  () => {
    fresh();
    equal(runModel('[INVENTORY_SIZE,DEFAULT_MAX_STACK,HOTBAR_SIZE]'), [16, 200, 9]);
    equal(runModel('inv.slots'), Array(16).fill(null));
    equal(runModel('Object.keys(ITEM_TYPES).sort()'), ['ore', 'stone', 'wood']);
    assert.equal(runModel('inventoryCapacity(inv,"wood")'), 3200);
    assert.equal(runModel('inv.hotbar'), undefined);
    assert.equal(runModel('inv.hotbarSlots'), undefined);
    assertModelInventory();
  },
);

for (const [criterion, amount, expected] of [
  [6, 1, [1]],
  [7, 200, [200]],
  [8, 201, [200, 1]],
  [9, 450, [200, 200, 50]],
]) {
  test([criterion], 'inserting ' + amount + ' wood fills stacks without losing units', () => {
    fresh();
    assert.equal(runModel(`addItems(inv,'wood',${amount})`), 0);
    equal(runModel('inv.slots.filter(Boolean).map(s=>s.quantity)'), expected);
    assert.equal(runModel('inventoryTotals(inv).wood'), amount);
    assertModelInventory();
  });
}

test([10], 'three material IDs remain separated and do not alias objects', () => {
  fresh();
  runModel("addItems(inv,'wood',230);addItems(inv,'stone',65);addItems(inv,'ore',3)");
  equal(runModel('inv.slots.slice(0,4)'), [
    { itemId: 'wood', quantity: 200 },
    { itemId: 'wood', quantity: 30 },
    { itemId: 'stone', quantity: 65 },
    { itemId: 'ore', quantity: 3 },
  ]);
  runModel('inv.slots[0].quantity=199');
  assert.equal(runModel('inv.slots[1].quantity'), 30);
  assertModelInventory();
});
test([11, 12], 'automatic insertion fills compatible partial stacks before empty slots', () => {
  for (const [addition, expected] of [
    [10, [200]],
    [30, [200, 20]],
  ]) {
    fresh();
    runModel("addItems(inv,'wood',190)");
    assert.equal(runModel(`addItems(inv,'wood',${addition})`), 0);
    equal(runModel('inv.slots.filter(Boolean).map(s=>s.quantity)'), expected);
    assertModelInventory();
  }
});
test(
  [13, 14, 34],
  'full inventory returns excess without hidden storage or a seventeenth slot',
  () => {
    fresh();
    assert.equal(runModel("addItems(inv,'wood',3200)"), 0);
    const before = json(runModel('serializeInventory(inv)'));
    assert.equal(runModel("addItems(inv,'wood',17)"), 17);
    assert.equal(runModel("addItems(inv,'stone',8)"), 8);
    equal(runModel('serializeInventory(inv)'), before);
    assert.equal(runModel('inventoryCapacity(inv,"ore")'), 0);
    assertModelInventory();
  },
);
test([4, 5], 'invalid item insertion and invalid stacks cannot mutate legitimate inventory', () => {
  fresh();
  runModel("addItems(inv,'wood',12)");
  const before = json(runModel('serializeInventory(inv)'));
  for (const amount of ['0', '-1', '1.5', 'NaN', 'Infinity', 'Number.MAX_SAFE_INTEGER+1', "'4'"]) {
    runModel(`addItems(inv,'wood',${amount})`);
    equal(runModel('serializeInventory(inv)'), before);
  }
  assert.equal(runModel("addItems(inv,'unknown',5)"), 5);
  for (const stack of [
    'null',
    '{}',
    "{itemId:'wood',quantity:0}",
    "{itemId:'wood',quantity:-1}",
    "{itemId:'wood',quantity:201}",
    "{itemId:'wood',quantity:2.5}",
    "{itemId:'refined_ore',quantity:1}",
  ]) {
    assert.equal(runModel(`isValidStack(${stack})`), false, stack);
  }
  equal(runModel('serializeInventory(inv)'), before);
});
test([15, 16], 'left click transfers a whole stack to cursor and to an empty slot', () => {
  fresh();
  runModel("addItems(inv,'wood',47)");
  assert.equal(runModel('inventorySlotClick(inv,0,0)'), true);
  assert.equal(runModel('inv.slots[0]'), null);
  equal(runModel('inv.cursor'), { itemId: 'wood', quantity: 47 });
  assert.equal(runModel('inventorySlotClick(inv,11,0)'), true);
  assert.equal(runModel('inv.cursor'), null);
  equal(runModel('inv.slots[11]'), { itemId: 'wood', quantity: 47 });
  assert.equal(runModel('inventoryTotals(inv).wood'), 47);
  assertModelInventory();
});
test([17], 'left click swaps different material stacks without changing totals', () => {
  fresh();
  runModel(
    "inv.slots[0]={itemId:'wood',quantity:40};inv.slots[1]={itemId:'stone',quantity:30};inventorySlotClick(inv,0)",
  );
  assert.equal(runModel('inventorySlotClick(inv,1)'), true);
  equal(runModel('inv.slots[1]'), { itemId: 'wood', quantity: 40 });
  equal(runModel('inv.cursor'), { itemId: 'stone', quantity: 30 });
  equal(runModel('inventoryTotals(inv)'), { wood: 40, stone: 30, ore: 0 });
  assertModelInventory();
});
test([18, 19, 20], 'same-item merging caps at 200 and keeps exact excess on the cursor', () => {
  fresh();
  runModel("inv.slots[0]={itemId:'wood',quantity:180};inv.cursor={itemId:'wood',quantity:50}");
  assert.equal(runModel('inventorySlotClick(inv,0)'), true);
  equal(runModel('inv.slots[0]'), { itemId: 'wood', quantity: 200 });
  equal(runModel('inv.cursor'), { itemId: 'wood', quantity: 30 });
  assert.equal(runModel('inventoryTotals(inv).wood'), 230);
  assert.equal(runModel('inventorySlotClick(inv,0)'), false);
  assertModelInventory();
});
for (const [criterion, amount, cursor, remaining] of [
  [21, 20, 10, 10],
  [22, 21, 11, 10],
  [23, 1, 1, 0],
]) {
  test([criterion], 'right click splits ' + amount + ' units using a ceiling half', () => {
    fresh();
    runModel(`addItems(inv,'wood',${amount});inventorySlotClick(inv,0,2)`);
    assert.equal(runModel('inv.cursor.quantity'), cursor);
    assert.equal(runModel('inv.slots[0]?.quantity||0'), remaining);
    assert.equal(runModel('inventoryTotals(inv).wood'), amount);
    assertModelInventory();
  });
}
test([24], 'right click deposits exactly one unit and clears an exhausted cursor', () => {
  fresh();
  runModel("inv.cursor={itemId:'ore',quantity:3}");
  for (let n = 1; n <= 3; n++) {
    assert.equal(runModel('inventorySlotClick(inv,4,2)'), true);
    assert.equal(runModel('inv.slots[4].quantity'), n);
    assert.equal(runModel('inv.cursor?.quantity||0'), 3 - n);
  }
  assert.equal(runModel('inv.cursor'), null);
  assertModelInventory();
});
test([25, 26], 'right click cannot overfill a stack or mix different materials', () => {
  fresh();
  runModel(
    "inv.slots[0]={itemId:'wood',quantity:200};inv.slots[1]={itemId:'stone',quantity:10};inv.cursor={itemId:'wood',quantity:5}",
  );
  const before = json(runModel('serializeInventory(inv)'));
  for (const index of [0, 1, -1, 16])
    assert.equal(runModel(`inventorySlotClick(inv,${index},2)`), false);
  assert.equal(runModel('inventorySlotClick(inv,0,1)'), false);
  equal(runModel('serializeInventory(inv)'), before);
});
test(
  [27],
  'closing returns cursor to partial stacks first and preserves a cursor that cannot fit',
  () => {
    fresh();
    runModel("inv.slots[0]={itemId:'wood',quantity:190};inv.cursor={itemId:'wood',quantity:20}");
    assert.equal(runModel('returnInventoryCursor(inv)'), true);
    equal(runModel('inv.slots.slice(0,2)'), [
      { itemId: 'wood', quantity: 200 },
      { itemId: 'wood', quantity: 10 },
    ]);
    assert.equal(runModel('inv.cursor'), null);
    fresh();
    runModel("addItems(inv,'stone',3200);inv.cursor={itemId:'wood',quantity:1}");
    const before = json(runModel('serializeInventory(inv)'));
    assert.equal(runModel('returnInventoryCursor(inv)'), false);
    equal(runModel('serializeInventory(inv)'), before);
    assertModelInventory();
  },
);
test(
  [28, 43, 44, 45],
  'serialization restores exact slot arrangement, selected shortcut and pending cursor',
  () => {
    fresh();
    runModel(
      "inv.slots[0]={itemId:'wood',quantity:200};inv.slots[11]={itemId:'stone',quantity:19};inv.cursor={itemId:'ore',quantity:7};selectInventorySlot(inv,8);inv.pending.wood=12;globalThis.serial=serializeInventory(inv);globalThis.restored=restoreInventory(serial)",
    );
    equal(runModel('serializeInventory(restored)'), json(runModel('serial')));
    assert.equal(runModel('restored.slots.length'), 16);
    runModel('serial.slots[0].quantity=1;serial.cursor.quantity=1');
    assert.equal(runModel('restored.slots[0].quantity'), 200);
    assert.equal(runModel('restored.cursor.quantity'), 7);
    equal(runModel('inventoryTotals(restored)'), { wood: 200, stone: 19, ore: 7 });
    invariant(runModel('restored'));
  },
);
test(
  [30, 31, 34, 35],
  'selecting any hotbar index only changes selection, never material quantities',
  () => {
    fresh();
    runModel("addItems(inv,'wood',450);addItems(inv,'stone',47)");
    const before = conserved(runModel('inv'));
    for (let index = 0; index < 9; index++) {
      runModel(`selectInventorySlot(inv,${index})`);
      assert.equal(runModel('inv.selected'), index);
      assert.deepEqual(conserved(runModel('inv')), before);
      assertModelInventory();
    }
    assert.equal(runModel('selectInventorySlot({},1)'), false);
    for (const index of [-1, 9, 16, 1.5])
      assert.equal(runModel(`selectInventorySlot(inv,${index})`), false);
    assert.equal(runModel('inv.slots.length'), 16);
  },
);
test(
  [48, 49],
  'legacy counters migrate to stacks exactly once and preserve overflow as pending recovery',
  () => {
    runModel('globalThis.inv=restoreInventory(null,{wood:230,stone:65,ore:3})');
    equal(runModel('inv.slots.slice(0,4)'), [
      { itemId: 'wood', quantity: 200 },
      { itemId: 'wood', quantity: 30 },
      { itemId: 'stone', quantity: 65 },
      { itemId: 'ore', quantity: 3 },
    ]);
    runModel('globalThis.inv=restoreInventory(serializeInventory(inv),{wood:230,stone:65,ore:3})');
    equal(runModel('inventoryTotals(inv)'), { wood: 230, stone: 65, ore: 3 });
    runModel('globalThis.inv=restoreInventory(null,{wood:5000,stone:65,ore:3})');
    assert.equal(runModel('inv.slots.length'), 16);
    assert.deepEqual(conserved(runModel('inv')), { wood: 5000, stone: 65, ore: 3 });
    equal(runModel('inv.pending'), { wood: 1800, stone: 65, ore: 3 });
    assert.equal(runModel('claimPendingInventory(inv)'), 0);
    runModel('inv.slots[0]=null');
    assert.equal(runModel('claimPendingInventory(inv)'), 200);
    equal(runModel('inv.pending'), { wood: 1600, stone: 65, ore: 3 });
    assertModelInventory();
  },
);
test(
  [50],
  'partly corrupt inventory preserves valid neighbors and recovers overfull known stacks',
  () => {
    runModel(
      "globalThis.inv=restoreInventory({slots:[{itemId:'wood',quantity:201},{itemId:'unknown',quantity:10},{itemId:'stone',quantity:65},{itemId:'ore',quantity:-1},null,{itemId:'ore',quantity:3}],selected:99,cursor:{itemId:'stone',quantity:1.5},pending:{wood:0,stone:-9,ore:2}})",
    );
    assert.equal(runModel('inv.slots.length'), 16);
    equal(runModel('inv.slots[2]'), { itemId: 'stone', quantity: 65 });
    equal(runModel('inv.slots[5]'), { itemId: 'ore', quantity: 3 });
    assert.deepEqual(conserved(runModel('inv')), { wood: 201, stone: 65, ore: 5 });
    assert.equal(runModel('inv.selected'), 0);
    assert.equal(runModel('inv.cursor'), null);
    assertModelInventory();
    for (const value of ['false', '42', "'bad'", '[]']) {
      runModel(`globalThis.inv=restoreInventory(${value})`);
      assertModelInventory();
    }
  },
);
test(
  [59, 60],
  'deterministic 1500-step split/place/swap/serialize sequence conserves every material',
  () => {
    fresh();
    runModel("addItems(inv,'wood',450);addItems(inv,'stone',333);addItems(inv,'ore',221)");
    const expected = conserved(runModel('inv'));
    let state = 0x1234abcd;
    const next = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state;
    };
    for (let step = 0; step < 1500; step++) {
      const index = next() % 16;
      runModel(`inventorySlotClick(inv,${index},${next() & 1 ? 0 : 2})`);
      if (step % 7 === 0) runModel(`selectInventorySlot(inv,${next() % 9})`);
      if (step % 11 === 0) runModel('returnInventoryCursor(inv)');
      if (step % 19 === 0) runModel('inv=restoreInventory(serializeInventory(inv))');
      assert.deepEqual(conserved(runModel('inv')), expected, 'conservation at step ' + step);
      assertModelInventory();
    }
  },
);

// Integration realm: the real model + collection + save + keyboard logic. Only
// DOM rendering functions are replaced with no-ops to keep this suite headless.
const uiStart = '// ===== Inventário v0.4: interface =====';
const uiEnd = '// ===== Fim da interface de inventário =====';
assert.ok(script.includes(uiStart) && script.includes(uiEnd), 'UI markers in shipped HTML');
const integrationCode =
  script.slice(0, script.indexOf(uiStart)) +
  `
function initInventoryUI(){}
function renderInventoryUI(){}
function clearInventoryUI(){}
function updateInventoryCursor(){}
` +
  script.slice(script.indexOf(uiEnd) + uiEnd.length);
const events = new Map(),
  timers = [],
  storageValues = new Map();
let now = 1000,
  storageFails = false;
const noOp = () => {};
const context2d = () =>
  new Proxy(
    {
      createImageData: (width, height) => ({
        data: new Uint8ClampedArray(width * height * 4),
        width,
        height,
      }),
      measureText: (text) => ({ width: String(text).length * 8 }),
    },
    {
      get: (o, key) => (key in o ? o[key] : noOp),
      set: (o, key, value) => ((o[key] = value), true),
    },
  );
function element(tagName = 'DIV') {
  return {
    tagName,
    style: { setProperty: noOp },
    value: '',
    textContent: '',
    children: [],
    dataset: {},
    hidden: false,
    width: 960,
    height: 540,
    clientWidth: 960,
    clientHeight: 540,
    classList: { add: noOp, remove: noOp, toggle: noOp, contains: () => false },
    append(...nodes) {
      this.children.push(...nodes);
    },
    appendChild(node) {
      this.children.push(node);
      return node;
    },
    replaceChildren(...nodes) {
      this.children = nodes;
    },
    setAttribute: noOp,
    removeAttribute: noOp,
    addEventListener: noOp,
    removeEventListener: noOp,
    focus: noOp,
    blur: noOp,
    remove: noOp,
    contains: () => false,
    querySelector: () => null,
    querySelectorAll: () => [],
    getContext: context2d,
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: 960,
      height: 540,
      right: 960,
      bottom: 540,
    }),
  };
}
const ids = new Map();
const getElement = (id) => {
  if (!ids.has(id)) ids.set(id, element(id === 'c' ? 'CANVAS' : 'DIV'));
  return ids.get(id);
};
getElement('m').style.display = 'flex';
getElement('sd').value = 'ORIGENS-2026';
getElement('sz').value = '128';
const register = (type, handler) => {
  if (!events.has(type)) events.set(type, []);
  events.get(type).push(handler);
};
const sandbox = {
  console,
  Uint8Array,
  Uint8ClampedArray,
  Int32Array,
  Float32Array,
  performance: { now: () => now },
  document: {
    hidden: false,
    getElementById: getElement,
    createElement: (tag) => element(tag.toUpperCase()),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: register,
  },
  localStorage: {
    getItem: (key) => storageValues.get(key) ?? null,
    setItem(key, value) {
      if (storageFails) throw Error('QuotaExceededError');
      storageValues.set(key, String(value));
    },
    removeItem: (key) => storageValues.delete(key),
  },
  addEventListener: register,
  removeEventListener: noOp,
  requestAnimationFrame: noOp,
  setInterval: noOp,
  setTimeout: (handler) => (timers.push(handler), timers.length),
  clearTimeout: noOp,
  innerWidth: 1280,
  innerHeight: 800,
  btoa: (text) => Buffer.from(text, 'binary').toString('base64'),
  atob: (text) => Buffer.from(text, 'base64').toString('binary'),
};
sandbox.window = sandbox;
const integration = vm.createContext(sandbox);
vm.runInContext(integrationCode, integration, { filename: file + ':integration' });
const runGame = (code) => vm.runInContext(code, integration, { timeout: 5000 });
runGame(`function inventoryFixtureWorld(id='test-A') {
  const N=32,length=N*N,w={N,ter:new Uint8Array(length).fill(4),ob:new Uint8Array(length),own:new Uint8Array(length).fill(1),sea:new Uint8Array(length),I:[{el:0}],sp:{x:10,y:10},id,name:id,seed:'fixture-same-seed',ok:true,att:0};
  for(const[x,y,type]of[[12,10,1],[14,10,1],[12,13,2],[12,16,3]])w.ob[y*N+x]=type;
  return w;
}`);
function setup(id = 'test-A', saved = null) {
  runGame(
    `start(inventoryFixtureWorld(${JSON.stringify(id)}),${JSON.stringify(saved)});G.px=11*T;G.py=10*T+26;keys={};mapOpen=0;`,
  );
  now += 10000;
}
function event(type, props = {}) {
  for (const handler of events.get(type) || [])
    handler({ key: '', target: { tagName: 'CANVAS' }, preventDefault: noOp, ...props });
}
const tree = 10 * 32 + 12,
  stone = 13 * 32 + 12,
  ore = 16 * 32 + 12;
function breakResource(index, hp) {
  runGame(`{const b=resourceBase(G.w,${index});G.px=b.x-40;G.py=b.y;}`);
  for (let n = 0; n < hp; n++) {
    now += 350;
    assert.equal(runGame(`hitResource(${index})`), true);
  }
}
function approachDrop(index) {
  runGame(`{const d=G.collection.drops.get('drop-${index}');G.px=d.x;G.py=d.y;collectDrops();}`);
}
function saveAndRestore(id = 'test-A') {
  assert.equal(runGame('save(1)'), 1);
  const saved = JSON.parse(storageValues.get('origens_w_' + id));
  setup(id, saved);
  return saved;
}

test([2, 3], 'new game session owns exactly sixteen empty slots and no stale cursor', () => {
  setup();
  equal(runGame('G.inventory.slots'), Array(16).fill(null));
  assert.equal(runGame('G.inventory.cursor'), null);
  assert.equal(runGame('inventoryOpen'), false);
});
for (const [criterion, index, hp, kind, amount] of [
  [36, tree, 3, 'wood', 3],
  [37, stone, 4, 'stone', 2],
  [38, ore, 5, 'ore', 1],
]) {
  test(
    [criterion, 41],
    'resource ' + kind + ' uses existing hit/drop path and enters storage once',
    () => {
      setup();
      breakResource(index, hp);
      assert.equal(runGame(`G.w.ob[${index}]`), 0);
      assert.equal(runGame('G.collection.drops.size'), 1);
      approachDrop(index);
      assert.equal(runGame('G.collection.drops.size'), 0);
      assert.equal(runGame(`inventoryTotals(G.inventory).${kind}`), amount);
      runGame('collectDrops();update(.016)');
      assert.equal(runGame(`inventoryTotals(G.inventory).${kind}`), amount);
      invariant(runGame('G.inventory'));
    },
  );
}
test(
  [39, 40, 41, 57],
  'partial pickup commits only inserted units and the remaining natural drop reloads',
  () => {
    setup();
    runGame("addItems(G.inventory,'stone',3200);G.inventory.slots[0]={itemId:'wood',quantity:198}");
    breakResource(tree, 3);
    approachDrop(tree);
    assert.equal(runGame('inventoryTotals(G.inventory).wood'), 200);
    assert.equal(runGame(`G.collection.drops.get('drop-${tree}').amount`), 1);
    runGame('collectDrops()');
    assert.equal(runGame('inventoryTotals(G.inventory).wood'), 200);
    saveAndRestore();
    assert.equal(runGame('inventoryTotals(G.inventory).wood'), 200);
    assert.equal(runGame(`G.collection.drops.get('drop-${tree}').amount`), 1);
    assert.equal(runGame(`G.w.ob[${tree}]`), 0);
  },
);
test([14, 40], 'full inventory leaves the entire drop on the ground', () => {
  setup();
  runGame("addItems(G.inventory,'stone',3200)");
  breakResource(tree, 3);
  approachDrop(tree);
  assert.equal(runGame('inventoryTotals(G.inventory).wood'), 0);
  assert.equal(runGame(`G.collection.drops.get('drop-${tree}').amount`), 3);
  invariant(runGame('G.inventory'));
});
test([42, 52], 'open inventory blocks walking, extraction and automatic pickup', () => {
  setup();
  breakResource(tree, 3);
  runGame(
    `{const b=resourceBase(G.w,${tree});G.px=b.x;G.py=b.y;}setInventoryOpen(true);keys={d:1,w:1}`,
  );
  const before = json(runGame('[G.px,G.py]'));
  runGame('update(.05);collectDrops()');
  equal(runGame('[G.px,G.py]'), before);
  assert.equal(runGame('G.collection.drops.size'), 1);
  now += 350;
  assert.equal(runGame(`hitResource(${stone})`), false);
  equal(runGame('inventoryTotals(G.inventory)'), { wood: 0, stone: 0, ore: 0 });
});
test(
  [27, 28],
  'closing protects an unreturnable cursor and hidden-page save restores it opened',
  () => {
    setup();
    runGame(
      "addItems(G.inventory,'stone',3200);G.inventory.cursor={itemId:'wood',quantity:1};setInventoryOpen(true)",
    );
    assert.equal(runGame('setInventoryOpen(false)'), false);
    assert.equal(runGame('inventoryOpen'), true);
    sandbox.document.hidden = true;
    try {
      event('visibilitychange');
    } finally {
      sandbox.document.hidden = false;
    }
    const saved = JSON.parse(storageValues.get('origens_w_test-A'));
    equal(saved.inventory.cursor, { itemId: 'wood', quantity: 1 });
    setup('test-A', saved);
    assert.equal(runGame('inventoryOpen'), true);
    equal(runGame('G.inventory.cursor'), { itemId: 'wood', quantity: 1 });
    assert.equal(runGame('inventoryTotals(G.inventory).wood'), 1);
    assert.equal(runGame('G.inventory.slots.some(s=>s?.itemId==="wood")'), false);
  },
);
test([43, 44, 45], 'real save v4 restores position-specific piles and selected shortcut', () => {
  setup();
  runGame(
    "G.inventory.slots[0]={itemId:'wood',quantity:200};G.inventory.slots[11]={itemId:'wood',quantity:50};G.inventory.slots[7]={itemId:'stone',quantity:30};selectInventorySlot(G.inventory,7)",
  );
  const saved = saveAndRestore();
  assert.equal(saved.v, 4);
  assert.equal(saved.gv, 2);
  assert.equal(saved.collection.materials, undefined, 'no second persisted material source');
  equal(runGame('G.inventory.slots[11]'), { itemId: 'wood', quantity: 50 });
  equal(runGame('G.inventory.slots[7]'), { itemId: 'stone', quantity: 30 });
  assert.equal(runGame('G.inventory.selected'), 7);
  equal(runGame('inventoryTotals(G.inventory)'), { wood: 250, stone: 30, ore: 0 });
});
test([46, 47], 'same-seed world IDs retain independent inventory state when switched', () => {
  setup('world-A');
  runGame("addItems(G.inventory,'wood',120);selectInventorySlot(G.inventory,6)");
  saveAndRestore('world-A');
  const a = JSON.parse(storageValues.get('origens_w_world-A'));
  setup('world-B');
  runGame("addItems(G.inventory,'stone',40)");
  saveAndRestore('world-B');
  const b = JSON.parse(storageValues.get('origens_w_world-B'));
  setup('world-A', a);
  equal(runGame('inventoryTotals(G.inventory)'), { wood: 120, stone: 0, ore: 0 });
  assert.equal(runGame('G.inventory.selected'), 6);
  setup('world-B', b);
  equal(runGame('inventoryTotals(G.inventory)'), { wood: 0, stone: 40, ore: 0 });
  assert.equal(runGame('G.w.seed'), 'fixture-same-seed');
});
test([48, 49], 'v3 counter migration is backed up and never re-added on repeated v4 loads', () => {
  const legacy = {
    v: 3,
    gv: 2,
    id: 'legacy-A',
    x: 352,
    y: 346,
    boat: 0,
    exp: Buffer.alloc(128).toString('base64'),
    collection: { removed: [], damage: [], drops: [], materials: { wood: 230, stone: 65, ore: 3 } },
  };
  const raw = JSON.stringify(legacy);
  storageValues.set('origens_w_legacy-A', raw);
  setup('legacy-A', legacy);
  equal(runGame('inventoryTotals(G.inventory)'), { wood: 230, stone: 65, ore: 3 });
  const upgraded = saveAndRestore('legacy-A');
  assert.equal(upgraded.v, 4);
  assert.equal(upgraded.inventory.migrationVersion, 1);
  assert.equal(storageValues.get('origens_w_legacy-A_backup_v3'), raw);
  for (let n = 0; n < 3; n++) {
    setup('legacy-A', upgraded);
    equal(runGame('inventoryTotals(G.inventory)'), { wood: 230, stone: 65, ore: 3 });
  }
});
test(
  [48, 49],
  'current loader accepts v2 and migrated v1 without changing world identity or erasing legacy data',
  () => {
    const length = (128 * 128) / 8;
    const exp = Buffer.alloc(length).toString('base64');
    const meta = { id: 'compat-v2', name: 'Compat V2', seed: 'TEST-128-0', size: 128 };
    const legacy = { v: 2, gv: 2, id: meta.id, x: 2048, y: 2048, boat: 0, exp };
    const raw = JSON.stringify(legacy);
    storageValues.set('origens_idx_v2', JSON.stringify([meta]));
    storageValues.set('origens_w_' + meta.id, raw);
    runGame('G=null;menu();loadWorld("compat-v2")');
    while (timers.length) timers.shift()();
    assert.equal(runGame('G.id'), meta.id);
    assert.equal(runGame('G.w.seed'), meta.seed);
    equal(runGame('inventoryTotals(G.inventory)'), { wood: 0, stone: 0, ore: 0 });
    assert.equal(runGame('save(1)'), 1);
    assert.equal(JSON.parse(storageValues.get('origens_w_' + meta.id)).v, 4);
    assert.equal(storageValues.get('origens_w_' + meta.id + '_backup_v2'), raw);
    const v1 = JSON.stringify({
      name: 'Compat V1',
      seed: meta.seed,
      size: 128,
      x: 2048,
      y: 2048,
      boat: 0,
      exp,
    });
    storageValues.set('origens_save_v1', v1);
    storageValues.delete('origens_migrated');
    runGame('G=null;menu()');
    const imported = JSON.parse(storageValues.get('origens_idx_v2')).find((m) =>
      m.name.includes('Compat V1'),
    );
    assert.ok(imported);
    runGame(`loadWorld(${JSON.stringify(imported.id)})`);
    while (timers.length) timers.shift()();
    assert.equal(runGame('G.id'), imported.id);
    assert.match(runGame('toastM'), /gerador antigo/);
    assert.equal(runGame('save(1)'), 1);
    assert.equal(JSON.parse(storageValues.get('origens_w_' + imported.id)).v, 4);
    assert.equal(storageValues.get('origens_save_v1'), v1);
    runGame('G=null;menu()');
    assert.equal(
      JSON.parse(storageValues.get('origens_idx_v2')).filter((m) => m.name.includes('Compat V1'))
        .length,
      1,
    );
  },
);

test(
  [48, 50],
  'legacy overflow survives save/load in visible recovery data, not extra slots',
  () => {
    const legacy = {
      v: 3,
      gv: 2,
      id: 'overflow-A',
      x: 352,
      y: 346,
      boat: 0,
      exp: Buffer.alloc(128).toString('base64'),
      collection: {
        removed: [],
        damage: [],
        drops: [],
        materials: { wood: 5000, stone: 65, ore: 3 },
      },
    };
    storageValues.set('origens_w_overflow-A', JSON.stringify(legacy));
    setup('overflow-A', legacy);
    const expected = { wood: 5000, stone: 65, ore: 3 };
    assert.deepEqual(conserved(runGame('G.inventory')), expected);
    saveAndRestore('overflow-A');
    assert.deepEqual(conserved(runGame('G.inventory')), expected);
    assert.equal(runGame('G.inventory.slots.length'), 16);
  },
);
test(
  [50],
  'corrupt inventory entries do not discard world identity, valid slots or collected nodes',
  () => {
    const saved = {
      v: 4,
      gv: 2,
      id: 'bad-A',
      x: 352,
      y: 346,
      boat: 0,
      exp: Buffer.alloc(128).toString('base64'),
      collection: { removed: [tree], damage: [], drops: [] },
      inventory: {
        slots: [
          { itemId: 'wood', quantity: 20 },
          { itemId: 'bad', quantity: 1 },
          null,
          { itemId: 'stone', quantity: 10 },
        ],
        selected: 999,
      },
    };
    setup('bad-A', saved);
    assert.equal(runGame('G.id'), 'bad-A');
    assert.equal(runGame('G.w.seed'), 'fixture-same-seed');
    assert.equal(runGame(`G.w.ob[${tree}]`), 0);
    equal(runGame('G.inventory.slots[3]'), { itemId: 'stone', quantity: 10 });
    equal(runGame('inventoryTotals(G.inventory)'), { wood: 20, stone: 10, ore: 0 });
    invariant(runGame('G.inventory'));
  },
);
test(
  [56, 57],
  'destroyed collision and uncollected drops survive while partial node damage is retained',
  () => {
    setup();
    breakResource(tree, 3);
    runGame(`{const b=resourceBase(G.w,${stone});G.px=b.x-40;G.py=b.y;}`);
    now += 350;
    runGame(`hitResource(${stone})`);
    const saved = saveAndRestore();
    assert.equal(saved.collection.removed.includes(tree), true);
    assert.equal(runGame(`G.w.ob[${tree}]`), 0);
    assert.equal(
      runGame(`blocked(G.w,resourceBase(G.w,${tree}).x,resourceBase(G.w,${tree}).y,0)`),
      0,
    );
    assert.equal(runGame(`G.collection.damage.get(${stone})`), 1);
    assert.equal(runGame(`G.collection.drops.get('drop-${tree}').amount`), 3);
  },
);
test(
  [60],
  'mixed rearrangement/save/load sequence preserves material totals and pending cursor',
  () => {
    setup();
    runGame(
      "addItems(G.inventory,'wood',250);addItems(G.inventory,'stone',30);inventorySlotClick(G.inventory,1,2);inventorySlotClick(G.inventory,5);inventorySlotClick(G.inventory,1);inventorySlotClick(G.inventory,5);inventorySlotClick(G.inventory,2);selectInventorySlot(G.inventory,4)",
    );
    const expected = { wood: 250, stone: 30, ore: 0 };
    assert.deepEqual(conserved(runGame('G.inventory')), expected);
    const before = json(runGame('serializeInventory(G.inventory)'));
    saveAndRestore();
    equal(runGame('serializeInventory(G.inventory)'), before);
    assert.deepEqual(conserved(runGame('G.inventory')), expected);
    invariant(runGame('G.inventory'));
  },
);
test([43, 28], 'failed storage write leaves live slots and cursor available for retry', () => {
  setup();
  runGame("addItems(G.inventory,'wood',21);inventorySlotClick(G.inventory,0,2)");
  const before = json(runGame('serializeInventory(G.inventory)'));
  storageFails = true;
  try {
    assert.equal(runGame('save(1)'), 0);
  } finally {
    storageFails = false;
  }
  equal(runGame('serializeInventory(G.inventory)'), before);
  assert.match(runGame('toastM'), /Falha/);
  assert.equal(runGame('save(1)'), 1);
});
test(
  [51, 52, 53],
  'inventory gating clears held keys and restores movement only after new input',
  () => {
    setup();
    event('keydown', { key: 'd' });
    runGame('update(.05)');
    const moved = runGame('G.px');
    assert.ok(moved > 11 * 32);
    assert.equal(runGame('setInventoryOpen(true)'), true);
    runGame('update(.05)');
    assert.equal(runGame('G.px'), moved);
    assert.equal(runGame('setInventoryOpen(false)'), true);
    runGame('update(.05)');
    assert.equal(runGame('G.px'), moved);
    event('keydown', { key: 'd' });
    runGame('update(.05)');
    assert.ok(runGame('G.px') > moved);
  },
);
test(
  [51, 56],
  'generator source stays byte-identical to v0.3 and a current 128 world is deterministic',
  () => {
    const original = fs.readFileSync(path.join(root, 'ORIGENS — Survival v0.3.html'), 'utf8');
    const generator = (text) =>
      text.slice(text.indexOf('// ===== SeededRandom'), text.indexOf('// ===== Arte pixel'));
    assert.equal(generator(source), generator(original));
    const result = runGame(
      `(()=>{const make=()=>{const it=gen('t','TEST-128-0',128);let r;while(!(r=it.next()).done);return r.value};const a=make(),b=make();return{ok:a.ok&&b.ok,equal:a.ter.every((v,i)=>v===b.ter[i]&&a.ob[i]===b.ob[i])}})()`,
    );
    assert.equal(result.ok, true);
    assert.equal(result.equal, true);
  },
);

console.log(`\n${passed} inventory/model integration groups passed.`);
console.log(
  'Acceptance criteria exercised by this suite: ' + [...covered].sort((a, b) => a - b).join(', '),
);
console.log(
  'UI appearance, DOM slot counts, real pointer events and console coverage are validated separately by Playwright.',
);
