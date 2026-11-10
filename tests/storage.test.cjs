#!/usr/bin/env node
'use strict';

// Exercises the shipped v0.8 storage, inventory and session code. Only DOM
// painting is replaced. Browser event delivery and real pixels are tested by Playwright.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'ORIGENS — Survival v0.8.html');
const source = fs.readFileSync(file, 'utf8');
const scriptMatch = source.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(scriptMatch, 'the delivered HTML contains its executable game');
const script = scriptMatch[1];
function block(start, end) {
  assert.ok(script.includes(start) && script.includes(end), 'existing source markers');
  return script.slice(script.indexOf(start), script.indexOf(end) + end.length);
}
const json = (value) => JSON.parse(JSON.stringify(value));
const equal = (actual, expected) => assert.deepEqual(json(actual), expected);
let passed = 0;
const covered = new Set();
function test(criteria, name, fn) {
  storageValues.clear();
  storageFails = false;
  try {
    fn();
    passed++;
    criteria.forEach((n) => covered.add(n));
    console.log('PASS [' + criteria.join(',') + '] ' + name);
  } catch (error) {
    console.error('FAIL [' + criteria.join(',') + '] ' + name);
    throw error;
  }
}
let integrationCode = script;
for (const [start, end, replacement] of [
  [
    '// ===== Armazenamento v0.8: interface =====',
    '// ===== Fim da interface de armazenamento =====',
    `
function initStorageUI(){}
function renderStorageUI(){globalThis.storagePaints=(globalThis.storagePaints||0)+1}
function clearStorageUI(){}
function setStorageStatus(message){globalThis.storageStatus=message}
function refreshStorageTooltip(){}
function renderStorageSaveState(){}
`,
  ],
  [
    '// ===== Inventário v0.4: interface =====',
    '// ===== Fim da interface de inventário =====',
    `
function initInventoryUI(){}
function renderInventoryUI(){globalThis.inventoryPaints=(globalThis.inventoryPaints||0)+1}
function clearInventoryUI(){}
function updateInventoryCursor(){}
`,
  ],
  [
    '// ===== Crafting v0.5: interface =====',
    '// ===== Fim da interface de crafting =====',
    `
function initCraftingUI(){}
function renderCraftingUI(){globalThis.craftingPaints=(globalThis.craftingPaints||0)+1}
function clearCraftingUI(){}
function renderCraftSaveState(){}
function setCraftingStatus(){}
function craftingUIReason(reason){return reason}
`,
  ],
]) {
  const removed = block(start, end);
  integrationCode = integrationCode.replace(removed, replacement);
}
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
    { get: (o, k) => (k in o ? o[k] : noOp), set: (o, k, v) => ((o[k] = v), true) },
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
const elements = new Map();
const getElement = (id) => {
  if (!elements.has(id)) elements.set(id, element(id === 'c' ? 'CANVAS' : 'DIV'));
  return elements.get(id);
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

runGame(`function storageFixtureWorld(id='storage-A') {
  const N=32,length=N*N;
  const w={N,ter:new Uint8Array(length).fill(4),ob:new Uint8Array(length),own:new Uint8Array(length).fill(1),sea:new Uint8Array(length),I:[{el:0}],sp:{x:10,y:10},id,name:id,seed:'same-storage-seed',ok:true,att:0};
  for (const [x,y,type] of [[12,10,1],[14,10,1],[12,13,2],[12,16,3]]) w.ob[y*N+x]=type;
  for(let y=0;y<N;y++)for(let x=0;x<7;x++){w.ter[y*N+x]=1;w.sea[y*N+x]=1}
  return w;
}`);
const tree = 10 * 32 + 12,
  rock = 13 * 32 + 12,
  ore = 16 * 32 + 12;
function setup(id = 'storage-A', saved = null) {
  now += 10000;
  runGame(
    `start(storageFixtureWorld(${JSON.stringify(id)}),${JSON.stringify(saved)});keys={};mapOpen=0;toastT=0;`,
  );
}
function event(type, props = {}) {
  for (const handler of events.get(type) || [])
    handler({ key: '', target: { tagName: 'CANVAS' }, preventDefault: noOp, ...props });
}

function currentState() {
  return json(
    runGame('({inventory:serializeInventory(G.inventory),storage:serializeStorage(G.storage)})'),
  );
}
function totals() {
  // Independent ledger: never use the transfer engine's own counters.
  return json(
    runGame(`(()=>{
    const result=Object.fromEntries(Object.keys(ITEM_TYPES).map(id=>[id,0]));
    const add=stack=>{if(stack)result[stack.itemId]+=stack.quantity};
    G.inventory.slots.forEach(add);add(G.inventory.cursor);
    for(const chest of G.storage.byId.values())chest.slots.forEach(add);
    for(const [id,n] of Object.entries(G.inventory.pending))result[id]+=n;
    return result;
  })()`),
  );
}
function invariant() {
  assert.equal(runGame('inventoryReady(G.inventory)'), true);
  assert.equal(runGame('storageReady(G.storage,G.w,G.inventory)'), true);
  const result = runGame(`(()=>{
    const refs=new Set();
    const stacks=[...G.inventory.slots,G.inventory.cursor];
    for(const chest of G.storage.byId.values()){
      if(chest.slots.length!==27)return false;
      stacks.push(...chest.slots);
    }
    for(const stack of stacks){
      if(!stack)continue;
      if(refs.has(stack)||!isValidStack(stack))return false;
      refs.add(stack);
    }
    return HOTBAR_SIZE===9&&G.inventory.slots.length===getInventoryCapacity(G.inventory);
  })()`);
  assert.equal(result, true, 'all live items have one owner and fit their catalog limits');
}
function seed(entries) {
  for (const [id, n] of Object.entries(entries))
    assert.equal(
      runGame(`addItems(G.inventory,${JSON.stringify(id)},${n})`),
      0,
      'fixture fits: ' + id,
    );
}
function standAt(x, y) {
  runGame(
    `G.px=${x};G.py=${y};G.cx=G.px;G.cy=G.py;G.tx=Math.floor(G.px/T);G.ty=Math.floor(G.py/T);toastT=0`,
  );
}
function place(tx = 12, ty = 9) {
  assert.equal(
    runGame('G.inventory.slots[0]===null'),
    true,
    'placement fixture has free first slot',
  );
  seed({ wooden_chest: 1 });
  runGame('G.inventory.selected=0');
  now += 400;
  const result = runGame(`placeStorageChest(${tx},${ty})`);
  assert.equal(result.ok, true, 'valid placement: ' + JSON.stringify(result));
  const id = runGame(`G.storage.byTile.get(${ty}*G.w.N+${tx})`);
  assert.ok(id);
  return id;
}
function open(id) {
  const result = runGame(`openStorageChest(${JSON.stringify(id)})`);
  assert.ok(result === true || result?.ok === true, 'open actual placed storage');
  assert.equal(runGame('chestOpen'), true);
  assert.equal(runGame('openChestId'), id);
}
function click(source, index, button = 0, quick = false) {
  return runGame(`storageSlotAction(${JSON.stringify(source)},${index},${button},${quick})`);
}
function chestSlots(id) {
  return json(runGame(`G.storage.byId.get(${JSON.stringify(id)}).slots`));
}
function saveAndRestore(id = 'storage-A') {
  assert.equal(runGame('save(1)'), 1, 'consistent current state saves');
  const saved = JSON.parse(storageValues.get('origens_w_' + id));
  setup(id, saved);
  return saved;
}
function rejectUnchanged(expression) {
  const before = currentState();
  const result = runGame(expression);
  assert.ok(result === false || result?.ok === false, 'operation rejected');
  equal(currentState(), before);
  return result;
}
function capacity(tier) {
  for (let n = runGame('inventoryTier(G.inventory)') + 1; n <= tier; n++) {
    const id = n === 1 ? 'rustic_backpack' : 'reinforced_backpack';
    seed({ [id]: 1 });
    const slot = runGame(`G.inventory.slots.findIndex(s=>s?.itemId===${JSON.stringify(id)})`);
    assert.equal(runGame(`useBackpack(G.inventory,${slot}).ok`), true);
  }
}

test(
  [1, 2, 3, 4, 6, 7, 13, 65, 67, 68],
  'storage catalog, configured 27 slots and linked nine-slot bar do not expand player inventory',
  () => {
    setup();
    const item = json(runGame('ITEM_TYPES.wooden_chest'));
    assert.equal(item.id, 'wooden_chest');
    assert.equal(item.category, 'storage');
    assert.equal(item.maxStack, 1);
    assert.equal(item.storageCapacity, 27);
    const recipe = runGame('CRAFT_RECIPES.recipe_wooden_chest');
    equal(Object.fromEntries(recipe.ingredients.map((i) => [i.itemId, i.quantity])), {
      plank: 8,
      wood: 4,
    });
    equal(recipe.output, { itemId: 'wooden_chest', quantity: 1 });
    assert.equal(runGame('STORAGE_RULES.capacity'), 27);
    assert.equal(runGame('STORAGE_RULES.columns'), 9);
    assert.equal(runGame('STORAGE_RULES.reach'), 80);
    assert.equal(runGame('STORAGE_RULES.maxChests'), 128);
    seed({ wooden_chest: 2 });
    assert.equal(runGame("G.inventory.slots.filter(s=>s?.itemId==='wooden_chest').length"), 2);
    assert.equal(runGame('G.inventory.slots.length'), 16);
    event('keydown', { key: '1' });
    assert.equal(runGame('selectedChestItem().id'), 'wooden_chest');
    assert.equal(runGame('activeTool()'), null);
    invariant();
  },
);

test(
  [5, 6, 7, 10, 11],
  'single and five-batch crafts consume exact existing ingredients and create separate items',
  () => {
    for (const n of [1, 5]) {
      setup();
      seed({ plank: 8 * n, wood: 4 * n, stone: 17 });
      const before = totals();
      assert.equal(runGame(`executeCraft(G.inventory,'recipe_wooden_chest',${n}).ok`), true);
      const after = totals();
      assert.equal(after.plank, before.plank - 8 * n);
      assert.equal(after.wood, before.wood - 4 * n);
      assert.equal(after.wooden_chest, n);
      assert.equal(after.stone, 17);
      assert.equal(runGame("G.inventory.slots.filter(s=>s?.itemId==='wooden_chest').length"), n);
      assert.equal(runGame('G.inventory.slots.length'), 16);
      invariant();
    }
  },
);

test(
  [8, 9, 10, 11],
  'missing ingredients or insufficient batch capacity roll back while released slots permit crafting',
  () => {
    for (const missing of ['plank', 'wood']) {
      setup();
      seed(missing === 'wood' ? { plank: 8 } : { wood: 4 });
      rejectUnchanged("executeCraft(G.inventory,'recipe_wooden_chest')");
    }
    setup();
    runGame(
      "G.inventory.slots=Array.from({length:16},()=>({itemId:'stone',quantity:200}));G.inventory.slots[0]={itemId:'plank',quantity:9};G.inventory.slots[1]={itemId:'wood',quantity:5}",
    );
    rejectUnchanged("executeCraft(G.inventory,'recipe_wooden_chest')");
    runGame('G.inventory.slots[0].quantity=8;G.inventory.slots[1].quantity=4');
    assert.equal(runGame("executeCraft(G.inventory,'recipe_wooden_chest').ok"), true);
    assert.equal(totals().wooden_chest, 1);
    invariant();
    setup();
    runGame(
      "G.inventory.slots=Array.from({length:16},()=>({itemId:'stone',quantity:200}));G.inventory.slots[0]={itemId:'plank',quantity:40};G.inventory.slots[1]={itemId:'wood',quantity:20}",
    );
    rejectUnchanged("executeCraft(G.inventory,'recipe_wooden_chest',5)");
  },
);

test(
  [17, 18, 29, 30, 31, 39, 40, 67, 68],
  'placement consumes exactly one item, adds one independent record and physical collision',
  () => {
    setup();
    const first = place();
    assert.equal(totals().wooden_chest, 0);
    assert.equal(runGame('G.storage.byId.size'), 1);
    assert.equal(runGame('G.storage.byTile.size'), 1);
    const chest = json(runGame(`G.storage.byId.get('${first}')`));
    equal(chest, {
      id: first,
      type: 'wooden_chest',
      tileX: 12,
      tileY: 9,
      slots: Array(27).fill(null),
    });
    assert.equal(runGame('blocked(G.w,12.5*T,9*T+26,0)'), 1);
    seed({ wooden_chest: 1 });
    now += 400;
    rejectUnchanged('placeStorageChest(12,9)');
    runGame('G.inventory.slots[0]=null');
    const second = place(12, 11);
    assert.notEqual(second, first);
    assert.equal(
      runGame(`G.storage.byId.get('${first}').slots===G.storage.byId.get('${second}').slots`),
      false,
    );
    assert.equal(runGame('G.inventory.backpackTier'), 0);
    invariant();
  },
);

test(
  [19, 20, 21, 22, 23, 24, 25, 26, 30],
  'all invalid terrain, objects, character, bounds and range reject without consuming chest',
  () => {
    for (const change of [
      'G.w.ter[9*G.w.N+12]=1',
      'G.w.ter[9*G.w.N+12]=8',
      'G.w.ob[9*G.w.N+12]=1',
      'G.w.ob[9*G.w.N+12]=2',
      'G.w.ob[9*G.w.N+12]=3',
      'G.w.ob[9*G.w.N+12]=4',
      'G.px=12.5*T;G.py=9.5*T',
      'G.px=22.5*T;G.py=22.5*T',
    ]) {
      setup();
      seed({ wooden_chest: 1 });
      runGame(change);
      now += 400;
      rejectUnchanged('placeStorageChest(12,9)');
      assert.equal(totals().wooden_chest, 1);
      assert.equal(runGame('G.storage.byId.size'), 0);
    }
    for (const [x, y] of [
      [-1, 9],
      [32, 9],
      [12, -1],
      [12, 32],
      [12.5, 9],
      [NaN, 9],
      [Infinity, 9],
    ]) {
      setup();
      seed({ wooden_chest: 1 });
      rejectUnchanged(`placeStorageChest(${String(x)},${String(y)})`);
    }
    setup();
    rejectUnchanged('placeStorageChest(12,9)');
  },
);

test(
  [17, 24, 26, 30, 36],
  'spawn, drops, obstacle line and narrow-passage connectivity prevent unsafe placement',
  () => {
    setup();
    seed({ wooden_chest: 1 });
    standAt(9.5 * 32, 10.5 * 32);
    rejectUnchanged('placeStorageChest(10,10)');
    setup();
    seed({ wooden_chest: 1 });
    runGame(
      "G.collection.drops.set('drop-'+(9*G.w.N+12),{id:'drop-'+(9*G.w.N+12),kind:'wood',amount:3,x:12.5*T,y:9*T+26})",
    );
    rejectUnchanged('placeStorageChest(12,9)');
    setup();
    seed({ wooden_chest: 1 });
    runGame('G.w.ob[10*G.w.N+11]=2');
    rejectUnchanged('placeStorageChest(12,10)');
    // A one-cell corridor connects two rooms; replacing its middle would divide it.
    setup();
    seed({ wooden_chest: 1 });
    runGame(
      'G.w.ter.fill(8);G.w.ob.fill(0);for(let x=8;x<=16;x++)G.w.ter[10*G.w.N+x]=4;G.w.sp={x:8,y:10}',
    );
    standAt(10.5 * 32, 10.5 * 32);
    rejectUnchanged('placeStorageChest(12,10)');
    assert.equal(runGame('G.storage.byId.size'), 0);
  },
);

test([27, 28], 'boat, map, inventory, crafting and menu gate placing without consumption', () => {
  for (const change of [
    'G.boat=1',
    'mapOpen=1',
    'inventoryOpen=true',
    'craftingOpen=true',
    "$('m').style.display='flex'",
  ]) {
    setup();
    seed({ wooden_chest: 1 });
    runGame(change);
    rejectUnchanged('placeStorageChest(12,9)');
    assert.equal(totals().wooden_chest, 1);
  }
});

test(
  [17, 18, 29, 30],
  'rapid placement and slot changes obey the live item and single accepted action',
  () => {
    setup();
    seed({ wooden_chest: 2 });
    now += 400;
    assert.equal(runGame('placeStorageChest(12,9).ok'), true);
    event('keydown', { key: '2' });
    rejectUnchanged('placeStorageChest(12,11)');
    now += 400;
    assert.equal(runGame('placeStorageChest(12,11).ok'), true);
    assert.equal(runGame('G.storage.byId.size'), 2);
    assert.equal(totals().wooden_chest, 0);
    now += 400;
    rejectUnchanged('placeStorageChest(13,11)');
  },
);

test(
  [31, 32, 33, 34, 35, 36, 37],
  'F opens only the deterministic nearest accessible chest and never the previous distant chest',
  () => {
    setup();
    const a = place(12, 9),
      b = place(12, 11);
    standAt(10.5 * 32, 10.5 * 32);
    // Independent geometry: base A=(400,314), B=(400,378), player=(336,336).
    const distanceA = Math.hypot(400 - 336, 314 - 336);
    const distanceB = Math.hypot(400 - 336, 378 - 336);
    assert.ok(distanceA < distanceB);
    const nearest = runGame('nearestStorageChest().id');
    assert.equal(nearest, a);
    event('keydown', { key: 'f' });
    assert.equal(runGame('chestOpen'), true);
    assert.equal(runGame('openChestId'), nearest);
    event('keydown', { key: 'f', repeat: true });
    assert.equal(runGame('openChestId'), nearest);
    assert.equal(runGame('closeStorageChest()'), true);
    standAt(336, 346); // Equal 32-pixel vertical offsets; numeric ID breaks the tie.
    assert.equal(Math.hypot(400 - 336, 314 - 346), Math.hypot(400 - 336, 378 - 346));
    assert.ok(Number(a.slice(6)) < Number(b.slice(6)));
    for (let n = 0; n < 3; n++) {
      event('keydown', { key: 'f' });
      assert.equal(runGame('openChestId'), a);
      assert.equal(runGame('closeStorageChest()'), true);
    }
    standAt(25.5 * 32, 25.5 * 32);
    event('keydown', { key: 'f' });
    assert.equal(runGame('chestOpen'), false);
    standAt(10.5 * 32, 9 * 32 + 26);
    runGame('G.w.ob[9*G.w.N+11]=2');
    assert.equal(runGame(`storageAccessCheck(G.storage.byId.get('${a}')).ok`), false);
    assert.equal(runGame('openChestId'), null);
  },
);

test(
  [31, 32, 33],
  'chest base blocks actual walking while an adjacent legal interaction point remains reachable',
  () => {
    setup();
    const id = place();
    standAt(12.5 * 32, 9 * 32 + 38);
    assert.equal(runGame('blocked(G.w,G.px,G.py,0)'), 0);
    assert.equal(runGame(`storageAccessCheck(G.storage.byId.get('${id}')).ok`), true);
    event('keydown', { key: 'w' });
    for (let i = 0; i < 15; i++) runGame('update(.05)');
    event('keyup', { key: 'w' });
    assert.ok(runGame('G.py') >= 9 * 32 + 30, 'feet stop at the solid chest body');
    assert.equal(runGame('blocked(G.w,G.px,G.py,0)'), 0);
  },
);

for (const itemId of [
  'wood',
  'stone',
  'ore',
  'stone_axe',
  'stone_pickaxe',
  'rustic_backpack',
  'reinforced_backpack',
  'wooden_chest',
]) {
  test(
    [
      {
        wood: 41,
        stone: 43,
        ore: 44,
        stone_axe: 45,
        stone_pickaxe: 46,
        rustic_backpack: 47,
        reinforced_backpack: 47,
        wooden_chest: 47,
      }[itemId],
      42,
      60,
    ],
    itemId + ' manually moves in both directions using the single player cursor',
    () => {
      setup();
      const id = place();
      seed({ [itemId]: itemId === 'wood' || itemId === 'stone' || itemId === 'ore' ? 35 : 1 });
      const before = totals();
      open(id);
      assert.equal(click('player', 0).ok, true);
      assert.equal(runGame('G.inventory.slots[0]'), null);
      assert.ok(runGame('G.inventory.cursor'));
      assert.equal(runGame(`G.storage.byId.get('${id}').cursor`), undefined);
      assert.equal(click('chest', 26).ok, true);
      assert.equal(runGame('G.inventory.cursor'), null);
      assert.equal(chestSlots(id)[26].itemId, itemId);
      assert.equal(click('chest', 26).ok, true);
      assert.equal(click('player', 15).ok, true);
      assert.equal(chestSlots(id)[26], null);
      equal(totals(), before);
      invariant();
    },
  );
}

test(
  [48, 49, 50, 51, 52, 57, 60],
  'right splitting, one-unit placement, capped merge and swap preserve each item exactly',
  () => {
    setup();
    const id = place();
    seed({ wood: 221, stone: 3, stone_axe: 2 });
    open(id);
    const before = totals();
    assert.equal(click('player', 0, 2).ok, true);
    assert.equal(runGame('G.inventory.cursor.quantity'), 100);
    assert.equal(click('chest', 0, 2).ok, true);
    assert.equal(chestSlots(id)[0].quantity, 1);
    assert.equal(click('chest', 1).ok, true);
    assert.equal(chestSlots(id)[1].quantity, 99);
    assert.equal(click('player', 0).ok, true); // Remaining 100 wood.
    assert.equal(click('chest', 1).ok, true);
    assert.equal(chestSlots(id)[1].quantity, 199);
    assert.equal(click('player', 1).ok, true); // Remaining 21 wood.
    assert.equal(click('chest', 1).ok, true);
    assert.equal(chestSlots(id)[1].quantity, 200);
    assert.equal(runGame('G.inventory.cursor.quantity'), 20);
    assert.equal(click('player', 2).ok, true); // Swap the 3 stone into the cursor.
    assert.equal(runGame('G.inventory.cursor.itemId'), 'stone');
    assert.equal(click('chest', 2).ok, true);
    assert.equal(click('player', 3, 2).ok, true); // Tool splitting always preserves a whole unit.
    assert.equal(runGame('G.inventory.cursor.quantity'), 1);
    assert.equal(click('chest', 3).ok, true);
    assert.equal(click('player', 4).ok, true);
    rejectUnchanged("storageSlotAction('chest',3,0,false)");
    assert.equal(runGame('G.inventory.cursor.quantity'), 1);
    assert.equal(click('chest', 4).ok, true);
    equal(totals(), before);
    invariant();
  },
);

test(
  [53, 54, 55, 56, 57, 60, 64],
  'Shift transfer fills partial piles before empty slots and preserves exact excess at the source',
  () => {
    setup();
    const id = place();
    seed({ wood: 30, stone_pickaxe: 1 });
    open(id);
    runGame(
      `G.storage.byId.get('${id}').slots=Array.from({length:27},()=>({itemId:'stone',quantity:200}));G.storage.byId.get('${id}').slots[0]={itemId:'wood',quantity:195}`,
    );
    const before = totals();
    assert.equal(click('player', 0, 0, true).ok, true);
    assert.equal(chestSlots(id)[0].quantity, 200);
    assert.equal(runGame('G.inventory.slots[0].quantity'), 25);
    equal(totals(), before);
    rejectUnchanged("storageSlotAction('player',0,0,true)");
    runGame(`G.storage.byId.get('${id}').slots[1]=null`);
    const next = totals();
    assert.equal(click('player', 0, 0, true).ok, true);
    assert.equal(chestSlots(id)[1].quantity, 25);
    assert.equal(runGame('G.inventory.slots[0]'), null);
    assert.equal(click('chest', 0, 0, true).ok, true);
    assert.equal(runGame('G.inventory.slots[0].quantity'), 200);
    equal(totals(), next);
    // An unrelated held item is retained as-is during a source-slot Shift transfer.
    assert.equal(click('player', 1).ok, true);
    const cursor = json(runGame('G.inventory.cursor'));
    assert.equal(click('chest', 1, 0, true).ok, true);
    equal(runGame('G.inventory.cursor'), cursor);
    equal(totals(), next);
    invariant();
  },
);

test(
  [52, 56, 59, 60],
  'a full player inventory refuses a nonstackable withdrawal and rapid repeats cannot duplicate',
  () => {
    setup();
    const id = place();
    open(id);
    runGame(
      `G.inventory.slots=Array.from({length:16},()=>({itemId:'wood',quantity:200}));G.storage.byId.get('${id}').slots[0]={itemId:'stone_pickaxe',quantity:1}`,
    );
    const before = totals();
    for (let i = 0; i < 12; i++) rejectUnchanged("storageSlotAction('chest',0,0,true)");
    equal(totals(), before);
    runGame('G.inventory.slots[15]=null');
    const next = totals();
    assert.equal(click('chest', 0, 0, true).ok, true);
    for (let i = 0; i < 12; i++) rejectUnchanged("storageSlotAction('chest',0,0,true)");
    equal(totals(), next);
    assert.equal(chestSlots(id)[0], null);
    invariant();
  },
);

test(
  [57, 58, 60, 81],
  'closing returns the held chest pile to its original slot without creating a second cursor',
  () => {
    setup();
    const id = place();
    seed({ wood: 150 });
    open(id);
    click('player', 0);
    click('chest', 3);
    const before = totals();
    assert.equal(click('chest', 3, 2).ok, true);
    assert.equal(runGame('G.inventory.cursor.quantity'), 75);
    equal(runGame('G.storage.cursorOrigin'), { container: id, index: 3 });
    assert.equal(runGame('closeStorageChest()'), true);
    assert.equal(runGame('G.inventory.cursor'), null);
    assert.equal(chestSlots(id)[3].quantity, 150);
    assert.equal(runGame('G.storage.cursorOrigin'), null);
    equal(totals(), before);
    open(id);
    assert.equal(chestSlots(id)[3].quantity, 150);
    invariant();
  },
);

test(
  [57, 58, 60, 81],
  'a valid split-then-swap can leave no return space; close preserves the protected cursor across reload',
  () => {
    setup();
    const id = place();
    open(id);
    runGame(
      `G.inventory.slots=Array.from({length:16},()=>({itemId:'stone',quantity:200}));G.inventory.slots[0]={itemId:'wood',quantity:200};G.storage.byId.get('${id}').slots=Array.from({length:27},()=>({itemId:'stone',quantity:200}));G.storage.byId.get('${id}').slots[0]={itemId:'stone_axe',quantity:1}`,
    );
    const before = totals();
    assert.equal(click('player', 0, 2).ok, true);
    assert.equal(click('chest', 0).ok, true);
    equal(runGame('G.inventory.cursor'), { itemId: 'stone_axe', quantity: 1 });
    assert.equal(runGame('closeStorageChest()'), false);
    assert.equal(runGame('chestOpen'), true);
    equal(totals(), before);
    event('pagehide');
    const saved = JSON.parse(storageValues.get('origens_w_storage-A'));
    equal(saved.inventory.cursor, { itemId: 'stone_axe', quantity: 1 });
    assert.equal(saved.storage.cursorOrigin.container, id);
    setup('storage-A', saved);
    assert.ok(runGame('chestOpen||inventoryOpen'), 'reload exposes recovery UI');
    equal(runGame('G.inventory.cursor'), { itemId: 'stone_axe', quantity: 1 });
    equal(totals(), before);
    if (!runGame('chestOpen')) {
      // A recovery UI may use the player's inventory; no silent discard is allowed.
      assert.equal(runGame('inventoryOpen'), true);
    } else {
      assert.equal(runGame('openChestId'), id);
      assert.equal(click('chest', 0).ok, true); // Reverse the swap, then return wood.
      assert.equal(runGame('closeStorageChest()'), true);
      equal(totals(), before);
    }
    invariant();
  },
);

for (const tier of [0, 1, 2]) {
  test(
    [61 + tier, 64, 65, 66, 67, 68],
    'capacity ' +
      [16, 24, 32][tier] +
      ' supports every unlocked slot without equipping stored tools or backpacks',
    () => {
      setup();
      capacity(tier);
      const count = runGame('G.inventory.slots.length');
      const id = place();
      seed({ stone_pickaxe: 1, rustic_backpack: 1 });
      runGame('G.inventory.selected=0');
      assert.equal(runGame('activeTool().id'), 'stone_pickaxe');
      open(id);
      const before = totals();
      assert.equal(click('player', 0, 0, true).ok, true);
      assert.equal(runGame('activeTool()'), null);
      assert.equal(click('player', 1, 0, true).ok, true);
      assert.equal(runGame('G.inventory.backpackTier'), tier);
      assert.equal(chestSlots(id).length, 27);
      assert.equal(click('chest', 0).ok, true);
      assert.equal(click('player', count - 1).ok, true);
      assert.equal(runGame(`G.inventory.slots[${count - 1}].itemId`), 'stone_pickaxe');
      assert.equal(runGame('G.inventory.slots.length'), count);
      equal(totals(), before);
      invariant();
    },
  );
}

test(
  [69, 70, 71, 72, 73, 74, 75, 79, 80, 84],
  'multiple placed records, exact slot order and stable IDs persist in one world snapshot',
  () => {
    setup();
    const a = place(12, 9),
      b = place(12, 11);
    seed({ wood: 77, ore: 5, stone_axe: 1 });
    open(a);
    click('player', 0);
    click('chest', 26);
    click('player', 2);
    click('chest', 2);
    assert.equal(runGame('closeStorageChest()'), true);
    open(b);
    click('player', 1);
    click('chest', 7);
    assert.equal(runGame('closeStorageChest()'), true);
    const before = currentState(),
      sum = totals();
    const saved = saveAndRestore();
    assert.equal(saved.v, 6);
    assert.equal(saved.gv, 2);
    assert.equal(saved.storage.chests.length, 2);
    equal(currentState(), before);
    equal(totals(), sum);
    open(a);
    assert.equal(chestSlots(a)[26].quantity, 77);
    assert.equal(chestSlots(a)[2].itemId, 'stone_axe');
    assert.equal(runGame('closeStorageChest()'), true);
    open(b);
    assert.equal(chestSlots(b)[7].quantity, 5);
    assert.equal(chestSlots(b)[26], null);
    invariant();
  },
);

test(
  [69, 75, 79, 84],
  'an empty chest remains a physical persistent record and opening never replaces its slots',
  () => {
    setup();
    const id = place();
    const saved = saveAndRestore();
    assert.equal(saved.storage.chests[0].id, id);
    assert.equal(saved.storage.chests[0].slots.filter(Boolean).length, 0);
    runGame(`globalThis.chestSlotsBefore=G.storage.byId.get('${id}').slots`);
    for (let i = 0; i < 3; i++) {
      open(id);
      assert.equal(runGame('closeStorageChest()'), true);
    }
    assert.equal(runGame(`G.storage.byId.get('${id}').slots===chestSlotsBefore`), true);
    assert.equal(runGame('blocked(G.w,12.5*T,9*T+26,0)'), 1);
    invariant();
  },
);

test(
  [76, 77],
  'same-seed world IDs keep distinct chest IDs, contents and backpack capacities',
  () => {
    setup('storage-world-A');
    capacity(2);
    const a = place();
    seed({ wood: 100 });
    open(a);
    click('player', 0, 0, true);
    runGame('closeStorageChest()');
    const savedA = saveAndRestore('storage-world-A');
    setup('storage-world-B');
    const b = place();
    seed({ stone: 50 });
    open(b);
    click('player', 0, 0, true);
    runGame('closeStorageChest()');
    const savedB = saveAndRestore('storage-world-B');
    setup('storage-world-A', savedA);
    assert.equal(totals().wood, 100);
    assert.equal(totals().stone, 0);
    assert.equal(runGame('G.inventory.slots.length'), 32);
    assert.equal(runGame(`G.storage.byId.get('${a}').slots[0].itemId`), 'wood');
    setup('storage-world-B', savedB);
    assert.equal(totals().wood, 0);
    assert.equal(totals().stone, 50);
    assert.equal(runGame('G.inventory.slots.length'), 16);
    assert.equal(runGame(`G.storage.byId.get('${b}').slots[0].itemId`), 'stone');
    invariant();
  },
);

test(
  [78, 114],
  'v0.7 schema5 migration preserves expanded inventory, tool selection, exploration and collection without free chests',
  () => {
    setup();
    capacity(2);
    seed({ wood: 49, stone_pickaxe: 1 });
    runGame('G.inventory.selected=1;G.collection.damage.set(' + tree + ',1);G.ex.fill(21)');
    assert.equal(runGame('save(1)'), 1);
    const legacy = JSON.parse(storageValues.get('origens_w_storage-A'));
    legacy.v = 5;
    delete legacy.storage;
    const raw = JSON.stringify(legacy);
    storageValues.set('origens_w_storage-A', raw);
    setup('storage-A', legacy);
    assert.equal(runGame('G.storage.byId.size'), 0);
    assert.equal(totals().wooden_chest, 0);
    assert.equal(runGame('G.saveProtected'), false);
    equal(runGame('serializeInventory(G.inventory)'), legacy.inventory);
    equal(runGame('Array.from(G.ex)'), Array(128).fill(21));
    assert.equal(runGame(`G.collection.damage.get(${tree})`), 1);
    assert.equal(runGame('activeTool().id'), 'stone_pickaxe');
    saveAndRestore();
    assert.equal(storageValues.get('origens_w_storage-A_backup_v5'), raw);
    assert.equal(runGame('G.storage.byId.size'), 0);
    assert.equal(totals().wooden_chest, 0);
    invariant();
  },
);

test(
  [80, 81, 82],
  'storage-write failure retains both sides in memory and the previous complete snapshot for a retry',
  () => {
    setup();
    const id = place();
    seed({ wood: 80 });
    open(id);
    assert.equal(runGame('save(1)'), 1);
    const old = storageValues.get('origens_w_storage-A');
    click('player', 0, 0, true);
    const before = totals(),
      live = currentState();
    storageFails = true;
    assert.equal(runGame('save(1)'), 0);
    assert.equal(storageValues.get('origens_w_storage-A'), old);
    equal(currentState(), live);
    equal(totals(), before);
    assert.equal(runGame('G.unsavedChanges'), true);
    assert.equal(runGame('G.lastSaveFailed'), true);
    storageFails = false;
    const saved = saveAndRestore();
    assert.equal(saved.inventory.slots[0], null);
    assert.equal(saved.storage.chests[0].slots[0].quantity, 80);
    equal(totals(), before);
    assert.equal(runGame('G.unsavedChanges'), false);
    invariant();
  },
);

test(
  [83],
  'every malformed storage record protects its original snapshot rather than overwriting a silently emptied chest',
  () => {
    const changes = [
      'delete bad.storage.chests[0].id',
      'bad.storage.chests.push(JSON.parse(JSON.stringify(bad.storage.chests[0])))',
      'bad.storage.chests[0].tileX=-1',
      'bad.storage.chests[0].tileY=NaN',
      'bad.storage.chests[0].tileX=0', // Water in the unchanged fixture terrain.
      'bad.storage.chests[0].tileY=10', // A natural tree still occupies this tile.
      'bad.storage.chests[0].slots.pop()',
      "bad.storage.chests[0].slots[0]={itemId:'unknown_item',quantity:4}",
      "bad.storage.chests[0].slots[0]={itemId:'wood',quantity:201}",
      "bad.storage.chests[0].slots[0]={itemId:'stone_axe',quantity:2}",
      "bad.storage.chests[0].slots[0]={itemId:'wood',quantity:-1}",
      'bad.storage.nextId=0',
      'delete bad.storage',
    ];
    for (const change of changes) {
      setup();
      const id = place();
      seed({ wood: 27 });
      open(id);
      click('player', 0, 0, true);
      runGame('closeStorageChest()');
      assert.equal(runGame('save(1)'), 1);
      const good = JSON.parse(storageValues.get('origens_w_storage-A'));
      runGame('globalThis.bad=' + JSON.stringify(good) + ';' + change);
      const bad = json(runGame('bad')),
        raw = JSON.stringify(bad);
      storageValues.set('origens_w_storage-A', raw);
      setup('storage-A', bad);
      assert.ok(
        runGame('G.saveProtected||G.storage.protected'),
        'malformed storage protected: ' + change,
      );
      assert.equal(runGame('save(1)'), 0);
      assert.equal(
        storageValues.get('origens_w_storage-A'),
        raw,
        'raw original retained: ' + change,
      );
    }
  },
);

test(
  [83],
  'duplicate live references across player and chest are rejected before any partial transfer',
  () => {
    setup();
    const id = place();
    seed({ wood: 23 });
    open(id);
    runGame(`G.storage.byId.get('${id}').slots[0]=G.inventory.slots[0]`);
    assert.equal(runGame('storageReady(G.storage,G.w,G.inventory)'), false);
    const before = runGame(
      'JSON.stringify({i:G.inventory.slots,c:G.storage.byId.get(' +
        JSON.stringify(id) +
        ').slots})',
    );
    assert.equal(click('player', 0, 0, true).ok, false);
    assert.equal(
      runGame(
        'JSON.stringify({i:G.inventory.slots,c:G.storage.byId.get(' +
          JSON.stringify(id) +
          ').slots})',
      ),
      before,
    );
  },
);

test(
  [85, 86, 87, 88, 92, 93, 94],
  'recollecting an empty chest removes both indexes/collision and creates one reusable fresh item',
  () => {
    setup();
    const id = place();
    open(id);
    assert.equal(runGame('storageRemoveCheck().ok'), true);
    assert.equal(runGame('removeStorageChest().ok'), true);
    assert.equal(runGame('G.storage.byId.size'), 0);
    assert.equal(runGame('G.storage.byTile.size'), 0);
    assert.equal(runGame('blocked(G.w,12.5*T,9*T+26,0)'), 0);
    assert.equal(totals().wooden_chest, 1);
    for (let n = 0; n < 10; n++) assert.equal(runGame('removeStorageChest().ok'), false);
    const saved = saveAndRestore();
    assert.equal(saved.storage.chests.length, 0);
    assert.equal(totals().wooden_chest, 1);
    now += 400;
    assert.equal(runGame('placeStorageChest(12,9).ok'), true);
    const nextId = runGame('G.storage.byTile.get(9*G.w.N+12)');
    assert.notEqual(nextId, id, 'removed IDs are never reused');
    equal(chestSlots(nextId), Array(27).fill(null));
    invariant();
  },
);

test(
  [89, 90, 91, 92],
  'full chest, occupied cursor or full player inventory prevents unsafe removal',
  () => {
    setup();
    const id = place();
    seed({ wood: 10 });
    open(id);
    click('player', 0, 0, true);
    rejectUnchanged('removeStorageChest()');
    assert.equal(chestSlots(id)[0].quantity, 10);
    click('chest', 0);
    rejectUnchanged('removeStorageChest()');
    click('player', 0);
    runGame("G.inventory.slots=Array.from({length:16},()=>({itemId:'wood',quantity:200}))");
    rejectUnchanged('removeStorageChest()');
    assert.equal(runGame('G.storage.byId.size'), 1);
    invariant();
  },
);

test(
  [29, 30, 69],
  'the per-world limit rejects new placements and never truncates already saved records',
  () => {
    setup();
    seed({ wooden_chest: 1 });
    runGame(`(()=>{let n=1;for(let y=0;y<7;y++)for(let x=7;x<G.w.N;x++){
    if(n>129)return;
    if(G.w.ob[y*G.w.N+x]||x===G.w.sp.x&&y===G.w.sp.y)continue;
    const chest={id:'chest-'+n,type:'wooden_chest',tileX:x,tileY:y,slots:Array(27).fill(null)};
    G.storage.byId.set(chest.id,chest);G.storage.byTile.set(y*G.w.N+x,chest.id);n++;
  }})()`);
    runGame('G.storage.nextId=130');
    assert.equal(runGame('G.storage.byId.size'), 129);
    invariant();
    const result = rejectUnchanged('placeStorageChest(12,9)');
    assert.equal(result.reason, 'limit');
    const saved = saveAndRestore();
    assert.equal(saved.storage.chests.length, 129);
    assert.equal(runGame('G.storage.byId.size'), 129);
    assert.equal(totals().wooden_chest, 1);
    invariant();
  },
);

test(
  [41, 42, 55, 56, 57, 60],
  'transfer plans are detached and invalid operations cannot mutate either container',
  () => {
    setup();
    const id = place();
    seed({ wood: 30 });
    open(id);
    const before = currentState();
    const plan = runGame(
      `simulateStorageClick(G.inventory,G.storage.byId.get('${id}'),G.storage.cursorOrigin,'player',0,0,true)`,
    );
    assert.equal(plan.ok, true);
    equal(currentState(), before);
    assert.equal(plan.playerSlots[0], null);
    assert.equal(plan.chestSlots[0].quantity, 30);
    plan.chestSlots[0].quantity = 199;
    equal(currentState(), before);
    for (const [side, index, button] of [
      ['unknown', 0, 0],
      ['chest', -1, 0],
      ['chest', 27, 0],
      ['player', 16, 0],
      ['player', 0, 1],
      ['player', 0.5, 0],
    ]) {
      assert.equal(
        runGame(
          `simulateStorageClick(G.inventory,G.storage.byId.get('${id}'),null,${JSON.stringify(side)},${index},${button},false).ok`,
        ),
        false,
      );
      equal(currentState(), before);
    }
  },
);

test(
  [14, 15, 16, 18, 95, 96, 97],
  'preview target conversion follows logical camera/zoom and never consumes items or writes storage',
  () => {
    setup();
    seed({ wooden_chest: 1 });
    const before = currentState(),
      written = storageValues.size;
    for (const zoom of [0, 1, 2, 3])
      for (const offset of [0, 20]) {
        runGame(
          `zi=${zoom};G.cx=G.px+${offset};G.cy=G.py-20;G.tx=Math.floor(G.px/T);G.ty=Math.floor(G.py/T);draw(0);G.aimPoint={x:(12.5*T-G.view.ox)*G.view.z,y:(9.5*T-G.view.oy)*G.view.z}`,
        );
        const preview = runGame('storagePreviewState()');
        assert.ok(preview, 'selected chest provides preview data');
        assert.equal(preview.tileX, 12);
        assert.equal(preview.tileY, 9);
        assert.equal(preview.ok, true);
        runGame('drawStoragePreview()');
        equal(currentState(), before);
        assert.equal(storageValues.size, written);
        assert.equal(runGame('blocked(G.w,12.5*T,9*T+26,0)'), 0, 'preview has no collision');
      }
  },
);

test(
  [28, 34, 95, 109, 110, 111],
  'storage keyboard routing pauses movement and prevents inventory/crafting/map/boat conflicts',
  () => {
    setup();
    const id = place();
    open(id);
    const p = runGame('({x:G.px,y:G.py,boat:G.boat})');
    for (const key of ['w', 'a', 's', 'd', 'e', 'm']) {
      event('keydown', { key });
      runGame('update(.05)');
      event('keyup', { key });
      equal(runGame('({x:G.px,y:G.py,boat:G.boat})'), json(p));
      assert.equal(runGame('mapOpen'), 0);
    }
    event('keydown', { key: 'Escape' });
    assert.equal(runGame('chestOpen'), false);
    assert.equal(getElement('m').style.display, 'none');
    event('keydown', { key: 'i' });
    assert.equal(runGame('inventoryOpen'), true);
    assert.equal(runGame('chestOpen'), false);
    event('keydown', { key: 'i' });
    event('keydown', { key: 'c' });
    assert.equal(runGame('craftingOpen'), true);
    event('keydown', { key: 'Escape' });
    assert.equal(runGame('craftingOpen'), false);
    for (const key of ['1', '9', '2']) event('keydown', { key });
    assert.equal(runGame('G.inventory.selected'), 1);
    const selected = runGame('G.inventory.selected');
    event('keydown', { key: '8', target: { tagName: 'INPUT' } });
    assert.equal(runGame('G.inventory.selected'), selected);
    invariant();
  },
);

test(
  [12, 100, 106, 107, 108],
  'generator and nine previous recipe transformations still execute in the current HTML',
  () => {
    setup();
    const old = fs.readFileSync(path.join(root, 'ORIGENS — Survival v0.7.html'), 'utf8');
    const generator = (text) => {
      const a = text.indexOf('// ===== SeededRandom'),
        b = text.indexOf('// ===== Arte pixel');
      assert.ok(a >= 0 && b > a);
      return text.slice(a, b);
    };
    assert.equal(generator(source), generator(old));
    const result = runGame(
      `(()=>{const make=()=>{const it=gen('test','TEST-128-0',128);let r;while(!(r=it.next()).done);return r.value};const a=make(),b=make();return{ok:a.ok&&b.ok,same:a.ter.every((v,i)=>v===b.ter[i]&&a.ob[i]===b.ob[i])}})()`,
    );
    assert.equal(result.ok, true);
    assert.equal(result.same, true);
    const recipes = {
      recipe_stick: [{ wood: 1 }, 'stick', 2, 0],
      recipe_plank: [{ wood: 2 }, 'plank', 2, 0],
      recipe_chipped_stone: [{ stone: 1 }, 'chipped_stone', 2, 0],
      recipe_simple_handle: [{ stick: 2, plank: 1 }, 'simple_handle', 1, 0],
      recipe_primitive_component: [
        { simple_handle: 1, chipped_stone: 2 },
        'primitive_component',
        1,
        0,
      ],
      recipe_stone_axe: [{ simple_handle: 1, chipped_stone: 2, stick: 1 }, 'stone_axe', 1, 0],
      recipe_stone_pickaxe: [
        { simple_handle: 1, chipped_stone: 3, stick: 1 },
        'stone_pickaxe',
        1,
        0,
      ],
      recipe_rustic_backpack: [{ plank: 12, stick: 16, simple_handle: 3 }, 'rustic_backpack', 1, 0],
      recipe_reinforced_backpack: [
        { plank: 20, primitive_component: 10, ore: 8 },
        'reinforced_backpack',
        1,
        1,
      ],
    };
    for (const [id, [ingredients, output, n, tier]] of Object.entries(recipes)) {
      setup();
      capacity(tier);
      seed(ingredients);
      assert.equal(runGame(`executeCraft(G.inventory,'${id}').ok`), true, id);
      assert.equal(totals()[output], n, id);
      invariant();
    }
  },
);

test(
  [95, 96, 98, 101, 102, 103, 104, 105, 112, 113],
  'old movement, tool extraction, persistent damage/drops and raft remain operational with placed storage',
  () => {
    setup();
    place();
    for (const [key, axis, sign] of [
      ['d', 'x', 1],
      ['a', 'x', -1],
      ['s', 'y', 1],
      ['w', 'y', -1],
    ]) {
      standAt(10.5 * 32, 10.5 * 32);
      const before = runGame('G.p' + axis);
      event('keydown', { key });
      runGame('update(.05)');
      event('keyup', { key });
      assert.ok((runGame('G.p' + axis) - before) * sign > 0);
    }
    runGame('G.cx=G.px-50;G.cy=G.py-50');
    const cx = runGame('G.cx');
    runGame('update(.05)');
    assert.ok(runGame('G.cx') > cx);
    for (const [index, tool, hits, drop] of [
      [tree, 'stone_axe', 2, 'wood'],
      [rock, 'stone_pickaxe', 2, 'stone'],
      [ore, 'stone_pickaxe', 3, 'ore'],
    ]) {
      runGame(`Object.assign(G.inventory,createInventory());addItems(G.inventory,'${tool}',1)`);
      const base = runGame(`resourceBase(G.w,${index})`);
      standAt(base.x - 40, base.y);
      for (let hit = 0; hit < hits; hit++) {
        now += 350;
        assert.equal(runGame(`hitResource(${index})`), true);
      }
      assert.equal(runGame(`G.w.ob[${index}]`), 0);
      assert.equal(runGame(`G.collection.drops.get('drop-${index}').kind`), drop);
    }
    const saved = saveAndRestore();
    assert.equal(saved.collection.removed.length, 3);
    assert.equal(saved.collection.drops.length, 3);
    for (const index of [tree, rock, ore]) assert.equal(runGame(`G.w.ob[${index}]`), 0);
    standAt(7.5 * 32, 10.5 * 32);
    event('keydown', { key: 'e' });
    assert.equal(runGame('G.boat'), 1);
    const px = runGame('G.px');
    event('keydown', { key: 'a' });
    runGame('update(.05)');
    event('keyup', { key: 'a' });
    assert.ok(runGame('G.px') < px);
    event('keydown', { key: 'e' });
    assert.equal(runGame('G.boat'), 0);
    invariant();
  },
);

test(
  [40, 48, 49, 50, 51, 52, 53, 54, 55, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 80],
  '5400 mixed operations conserve an independent ledger across three chests, cursor, pending recovery and all capacities',
  () => {
    let entropy = 0x51c0ffee;
    const next = () => {
      entropy ^= entropy << 13;
      entropy ^= entropy >>> 17;
      entropy ^= entropy << 5;
      return entropy >>> 0;
    };
    let manual = 0,
      quick = 0,
      switched = 0,
      reloaded = 0;
    for (const tier of [0, 1, 2]) {
      setup();
      capacity(tier);
      const ids = [place(12, 9), place(12, 11), place(10, 12)];
      seed({
        wood: 213,
        stone: 215,
        ore: 12,
        stick: 33,
        plank: 17,
        chipped_stone: 9,
        simple_handle: 4,
        primitive_component: 2,
        stone_axe: 1,
        stone_pickaxe: 1,
        rustic_backpack: 1,
        reinforced_backpack: 1,
        wooden_chest: 1,
      });
      runGame('G.inventory.pending.wood=11');
      const expected = totals();
      open(ids[0]);
      for (let step = 0; step < 1800; step++) {
        const op = next() % 10;
        if (op < 7) {
          const source = next() % 2 ? 'player' : 'chest';
          const size = source === 'player' ? runGame('G.inventory.slots.length') : 27;
          const result = click(source, next() % size, next() % 3 === 0 ? 2 : 0, op >= 5);
          if (result.ok) {
            if (op >= 5) quick++;
            else manual++;
          }
        } else if (op === 7) {
          if (runGame('closeStorageChest()')) {
            open(ids[next() % ids.length]);
            switched++;
          }
        } else if (op === 8 && !runGame('G.inventory.cursor')) {
          assert.equal(runGame('closeStorageChest()'), true);
          saveAndRestore();
          open(ids[next() % ids.length]);
          reloaded++;
        } else {
          event('keydown', { key: String((next() % 9) + 1) });
        }
        equal(totals(), expected);
        invariant();
      }
    }
    assert.ok(manual > 100, 'workload performs real accepted manual moves');
    assert.ok(quick > 40, 'workload performs real accepted quick transfers');
    assert.ok(switched > 20, 'workload alternates actual chest records');
    assert.ok(reloaded > 10, 'workload checks repeated complete save/load');
  },
);

console.log(`\n${passed} storage/model integration groups passed.`);
console.log(
  'v0.8 numbered criteria exercised in VM: ' + [...covered].sort((a, b) => a - b).join(', '),
);
console.log(
  'Preview coordinates are tested as state; actual pixels, 27 DOM slots, layout and console are Playwright checks.',
);
