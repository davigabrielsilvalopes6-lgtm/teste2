#!/usr/bin/env node
'use strict';

// Exercises the shipped v0.7 model and session code. Only the two DOM paint
// blocks are replaced; browser pixels and event delivery belong to Playwright.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'ORIGENS — Survival v0.7.html');
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

runGame(`function toolsFixtureWorld(id='tools-A') {
  const N=32,length=N*N;
  const w={N,ter:new Uint8Array(length).fill(4),ob:new Uint8Array(length),own:new Uint8Array(length).fill(1),sea:new Uint8Array(length),I:[{el:0}],sp:{x:10,y:10},id,name:id,seed:'same-tools-seed',ok:true,att:0};
  for (const [x,y,type] of [[12,10,1],[14,10,1],[12,13,2],[12,16,3]]) w.ob[y*N+x]=type;
  for(let y=0;y<N;y++)for(let x=0;x<7;x++){w.ter[y*N+x]=1;w.sea[y*N+x]=1}
  return w;
}`);
const tree = 10 * 32 + 12,
  rock = 13 * 32 + 12,
  ore = 16 * 32 + 12;
function setup(id = 'tools-A', saved = null) {
  now += 10000;
  runGame(
    `start(toolsFixtureWorld(${JSON.stringify(id)}),${JSON.stringify(saved)});keys={};mapOpen=0;toastT=0;`,
  );
}
function event(type, props = {}) {
  for (const handler of events.get(type) || [])
    handler({ key: '', target: { tagName: 'CANVAS' }, preventDefault: noOp, ...props });
}
function equip(id) {
  runGame(
    `Object.assign(G.inventory,createInventory());${id ? `addItems(G.inventory,${JSON.stringify(id)},1);` : ''}`,
  );
}
function stand(index, distance = 40) {
  runGame(
    `{const b=resourceBase(G.w,${index});G.px=b.x-${distance};G.py=b.y;G.cx=G.px;G.cy=G.py;G.tx=Math.floor(G.px/T);G.ty=Math.floor(G.py/T);toastT=0}`,
  );
}
function hit(index, elapsed = 350) {
  now += elapsed;
  return runGame(`hitResource(${index})`);
}
function counts() {
  return json(runGame('inventoryTotals(G.inventory)'));
}
function snapshot() {
  return json(runGame('serializeInventory(G.inventory)'));
}
function invariant() {
  const inv = json(runGame('G.inventory'));
  assert.equal(runGame('inventoryReady(G.inventory)'), true);
  assert.equal(inv.slots.length, [16, 24, 32][inv.backpackTier]);
  assert.equal(inv.hotbar, undefined);
  assert.equal(inv.hotbarSlots, undefined);
  assert.ok(inv.selected >= 0 && inv.selected < 9);
  for (const s of [...inv.slots, inv.cursor])
    if (s) {
      assert.ok(Number.isSafeInteger(s.quantity) && s.quantity >= 1);
      assert.ok(s.quantity <= runGame(`ITEM_TYPES[${JSON.stringify(s.itemId)}].maxStack`));
    }
}
function saveAndRestore(id = 'tools-A') {
  assert.equal(runGame('save(1)'), 1);
  const saved = JSON.parse(storageValues.get('origens_w_' + id));
  setup(id, saved);
  return saved;
}
function addIngredients(id, times = 1, spare = 0) {
  const defs = {
    stone_axe: { simple_handle: 1, chipped_stone: 2, stick: 1 },
    stone_pickaxe: { simple_handle: 1, chipped_stone: 3, stick: 1 },
  };
  for (const [kind, n] of Object.entries(defs[id]))
    runGame(`addItems(G.inventory,${JSON.stringify(kind)},${n * times + spare})`);
}
function failCraft(id, times, reason) {
  const before = snapshot();
  const result = runGame(`executeCraft(G.inventory,${JSON.stringify('recipe_' + id)},${times})`);
  assert.equal(result.ok, false);
  if (reason) assert.equal(result.reason, reason);
  equal(runGame('serializeInventory(G.inventory)'), before);
}

test(
  [1, 2, 3, 4, 5, 6, 10, 92, 94],
  'two unique immutable nonstackable tool entries; initial 16 slots; material limit 200',
  () => {
    setup();
    const catalog = json(runGame('ITEM_TYPES'));
    assert.equal(
      new Set(Object.values(catalog).map((x) => x.id)).size,
      Object.keys(catalog).length,
    );
    for (const [id, type] of [
      ['stone_axe', 'axe'],
      ['stone_pickaxe', 'pickaxe'],
    ]) {
      assert.equal(catalog[id].id, id);
      assert.equal(catalog[id].category, 'tool');
      assert.equal(catalog[id].toolType, type);
      assert.equal(catalog[id].tier, 'primitive');
      assert.equal(catalog[id].maxStack, 1);
      assert.equal(runGame(`Object.isFrozen(ITEM_TYPES.${id})`), true);
      for (const absent of ['durability', 'attack', 'repair', 'combatDamage'])
        assert.equal(catalog[id][absent], undefined);
    }
    for (const id of [
      'wood',
      'stone',
      'ore',
      'stick',
      'plank',
      'chipped_stone',
      'simple_handle',
      'primitive_component',
    ])
      assert.equal(catalog[id].maxStack, 200);
    assert.equal(runGame('G.inventory.slots.length'), 16);
    invariant();
  },
);

test(
  [7, 8, 9, 18, 95],
  'identical tools occupy separate slots; right click and merge preserve whole units',
  () => {
    setup();
    runGame("addItems(G.inventory,'stone_axe',2)");
    equal(runGame('G.inventory.slots.slice(0,2)'), [
      { itemId: 'stone_axe', quantity: 1 },
      { itemId: 'stone_axe', quantity: 1 },
    ]);
    assert.equal(runGame('inventorySlotClick(G.inventory,0,2)'), true);
    equal(runGame('G.inventory.cursor'), { itemId: 'stone_axe', quantity: 1 });
    assert.equal(runGame('G.inventory.slots[0]'), null);
    const before = snapshot();
    assert.equal(runGame('inventorySlotClick(G.inventory,1,2)'), false);
    equal(runGame('serializeInventory(G.inventory)'), before);
    assert.equal(runGame('inventorySlotClick(G.inventory,1,0)'), false);
    equal(runGame('serializeInventory(G.inventory)'), before);
    assert.equal(runGame('inventorySlotClick(G.inventory,0,2)'), true);
    assert.equal(counts().stone_axe, 2);
    invariant();
  },
);

for (const [criterion, id, stoneNeeded] of [
  [11, 'stone_axe', 2],
  [12, 'stone_pickaxe', 3],
]) {
  test(
    [criterion, 16, 17],
    id + ' consumes exact ingredients, preserves other items and creates one individual tool',
    () => {
      setup();
      addIngredients(id, 1, 3);
      runGame("addItems(G.inventory,'ore',13);addItems(G.inventory,'plank',8)");
      const before = counts();
      assert.equal(runGame(`executeCraft(G.inventory,'recipe_${id}').ok`), true);
      before.simple_handle--;
      before.chipped_stone -= stoneNeeded;
      before.stick--;
      before[id]++;
      equal(runGame('inventoryTotals(G.inventory)'), before);
      assert.equal(runGame(`G.inventory.slots.filter(s=>s&&s.itemId==='${id}').length`), 1);
      invariant();
    },
  );
  for (const [criterion2, kind] of [
    [13, 'simple_handle'],
    [14, 'chipped_stone'],
    [15, 'stick'],
  ])
    test([criterion2], id + ' refuses missing ' + kind + ' without touching any slot', () => {
      setup();
      addIngredients(id);
      runGame(
        `for(let i=0;i<G.inventory.slots.length;i++)if(G.inventory.slots[i]?.itemId==='${kind}')G.inventory.slots[i]=null`,
      );
      failCraft(id, 1, 'missing_ingredients');
    });
}

test([18, 19], 'distributed input fragments produce two axes in separate slots', () => {
  setup();
  runGame(`G.inventory.slots[0]={itemId:'simple_handle',quantity:1};G.inventory.slots[15]={itemId:'simple_handle',quantity:1};
    for(const i of [1,3,8,14])G.inventory.slots[i]={itemId:'chipped_stone',quantity:1};
    G.inventory.slots[4]={itemId:'stick',quantity:1};G.inventory.slots[13]={itemId:'stick',quantity:1}`);
  assert.equal(runGame("executeCraft(G.inventory,'recipe_stone_axe',2).ok"), true);
  equal(runGame('G.inventory.slots.filter(Boolean)'), [
    { itemId: 'stone_axe', quantity: 1 },
    { itemId: 'stone_axe', quantity: 1 },
  ]);
  invariant();
});

test(
  [20, 21],
  'full inventory rejects without losses unless exact consumption frees an output slot',
  () => {
    setup();
    runGame(
      "addItems(G.inventory,'ore',3200);G.inventory.slots[0]={itemId:'simple_handle',quantity:2};G.inventory.slots[1]={itemId:'chipped_stone',quantity:3};G.inventory.slots[2]={itemId:'stick',quantity:2}",
    );
    failCraft('stone_axe', 1, 'no_space');
    runGame('G.inventory.slots[0].quantity=1');
    assert.equal(runGame("executeCraft(G.inventory,'recipe_stone_axe').ok"), true);
    equal(runGame('G.inventory.slots[0]'), { itemId: 'stone_axe', quantity: 1 });
    assert.equal(runGame('G.inventory.slots.length'), 16);
    invariant();
  },
);

test(
  [22, 23],
  'five-tool batch needs five individual output slots after simulated consumption',
  () => {
    setup();
    runGame(
      "addItems(G.inventory,'ore',3200);G.inventory.slots[0]={itemId:'simple_handle',quantity:6};G.inventory.slots[1]={itemId:'chipped_stone',quantity:11};G.inventory.slots[2]={itemId:'stick',quantity:6};for(let i=12;i<16;i++)G.inventory.slots[i]=null",
    );
    assert.equal(runGame("simulateCraft(G.inventory,'recipe_stone_axe',1).ok"), true);
    failCraft('stone_axe', 5, 'no_space');
    runGame('G.inventory.slots[11]=null');
    assert.equal(runGame("getMaxCraftable(G.inventory,'recipe_stone_axe')"), 5);
    assert.equal(runGame("executeCraft(G.inventory,'recipe_stone_axe',5).ok"), true);
    assert.equal(runGame("G.inventory.slots.filter(s=>s?.itemId==='stone_axe').length"), 5);
    assert.equal(counts().simple_handle, 1);
    assert.equal(counts().chipped_stone, 1);
    assert.equal(counts().stick, 1);
    invariant();
  },
);

test(
  [22, 23],
  'tools remain nonstackable and crafting atomic after user backpack expansion to 24 or 32',
  () => {
    for (const tier of [1, 2]) {
      setup();
      runGame(
        `G.inventory.backpackTier=${tier};G.inventory.slots=Array(${[16, 24, 32][tier]}).fill(null)`,
      );
      addIngredients('stone_pickaxe', 5);
      const capacity = runGame('G.inventory.slots.length');
      assert.equal(runGame("executeCraft(G.inventory,'recipe_stone_pickaxe',5).ok"), true);
      assert.equal(runGame("G.inventory.slots.filter(s=>s?.itemId==='stone_pickaxe').length"), 5);
      assert.equal(runGame('G.inventory.slots.length'), capacity);
      const before = snapshot();
      saveAndRestore();
      equal(runGame('serializeInventory(G.inventory)'), before);
      invariant();
    }
  },
);

test([24], 'rapid session craft dispatch cannot reuse inputs from a previous click', () => {
  setup();
  addIngredients('stone_axe');
  runGame('setCraftingOpen(true)');
  assert.equal(runGame("performCraft('recipe_stone_axe').ok"), true);
  for (let i = 0; i < 20; i++)
    assert.equal(runGame("performCraft('recipe_stone_axe').reason"), 'missing_ingredients');
  assert.equal(counts().stone_axe, 1);
  assert.equal(counts().simple_handle, 0);
  assert.equal(runGame('craftingBusy'), false);
});

test(
  [25, 26, 27, 28, 29, 30, 34, 35, 93],
  'real keyboard handler derives tools from first nine existing slots and ignores typing',
  () => {
    setup();
    runGame(
      "addItems(G.inventory,'stone_axe',1);addItems(G.inventory,'stone_pickaxe',1);addItems(G.inventory,'wood',40)",
    );
    for (const [key, id] of [
      ['1', 'stone_axe'],
      ['2', 'stone_pickaxe'],
      ['3', null],
      ['9', null],
    ]) {
      event('keydown', { key });
      assert.equal(runGame('G.inventory.selected'), Number(key) - 1);
      assert.equal(runGame('activeTool()?.id||null'), id);
    }
    const before = counts();
    for (let n = 0; n < 30; n++) event('keydown', { key: String((n % 9) + 1) });
    for (const target of [
      { tagName: 'INPUT' },
      { tagName: 'TEXTAREA' },
      { tagName: 'SELECT' },
      { tagName: 'DIV', isContentEditable: true },
    ]) {
      const selected = runGame('G.inventory.selected');
      event('keydown', { key: '2', target });
      assert.equal(runGame('G.inventory.selected'), selected);
    }
    equal(runGame('inventoryTotals(G.inventory)'), before);
    assert.equal(runGame('HOTBAR_SIZE'), 9);
    assert.equal(runGame('G.inventory.slots.length'), 16);
    invariant();
  },
);

test(
  [31, 32, 33],
  'moving tools out of the selected hotbar slot immediately unequips; cursor never equips',
  () => {
    setup();
    equip('stone_axe');
    assert.equal(runGame('activeTool().id'), 'stone_axe');
    assert.equal(runGame('inventorySlotClick(G.inventory,0,0)'), true);
    assert.equal(runGame('activeTool()'), null);
    assert.equal(runGame('inventorySlotClick(G.inventory,11,0)'), true);
    assert.equal(runGame('activeTool()'), null);
    equal(runGame('G.inventory.slots[11]'), { itemId: 'stone_axe', quantity: 1 });
    runGame(
      "addItems(G.inventory,'stone_pickaxe',1);inventorySlotClick(G.inventory,0,0);inventorySlotClick(G.inventory,1,0);selectInventorySlot(G.inventory,1)",
    );
    assert.equal(runGame('activeTool().id'), 'stone_pickaxe');
    invariant();
  },
);

const resourceCases = [
  [
    tree,
    1,
    'wood',
    3,
    3,
    [
      [null, 3, 37],
      ['stone_axe', 2, 38],
      ['stone_pickaxe', 3, 39],
    ],
  ],
  [
    rock,
    2,
    'stone',
    4,
    2,
    [
      [null, 4, 42],
      ['stone_pickaxe', 2, 43],
      ['stone_axe', 4, 44],
    ],
  ],
  [
    ore,
    3,
    'ore',
    5,
    1,
    [
      [null, 5, 47],
      ['stone_pickaxe', 3, 48],
      ['stone_axe', 5, 49],
    ],
  ],
];
for (const [index, type, kind, hp, yieldCount, cases] of resourceCases)
  for (const [tool, expectedHits, criterion] of cases)
    test(
      [
        criterion,
        kind === 'wood' ? 41 : kind === 'stone' ? 46 : 50,
        kind === 'wood' ? 89 : kind === 'stone' ? 90 : 91,
      ],
      `${kind}: ${tool || 'bare hands'} needs ${expectedHits} hits, yields exactly ${yieldCount}`,
      () => {
        setup();
        equip(tool);
        stand(index);
        assert.equal(runGame(`RESOURCE_TYPES[${type}].hp`), hp);
        for (let n = 1; n <= expectedHits; n++) {
          assert.equal(hit(index), true);
          assert.equal(runGame(`G.w.ob[${index}]===0`), n === expectedHits);
        }
        assert.equal(hit(index), false);
        assert.equal(runGame('G.collection.drops.size'), 1);
        equal(runGame(`G.collection.drops.get('drop-${index}')`), {
          id: 'drop-' + index,
          kind,
          x: 400,
          y: Math.floor(index / 32) * 32 + 26,
          amount: yieldCount,
        });
        assert.equal(runGame(`G.collection.damage.has(${index})`), false);
        assert.equal(runGame('G.collection.removed.size'), 1);
        if (tool) assert.equal(counts()[tool], 1, 'tools are not consumed');
        runGame(
          `{const d=G.collection.drops.get('drop-${index}');G.px=d.x;G.py=d.y;collectDrops()}`,
        );
        assert.equal(counts()[kind], yieldCount);
        assert.equal(runGame('G.collection.drops.size'), 0);
      },
    );

test(
  [30],
  'a selected material grants no bonus and is never consumed on a collection click',
  () => {
    setup();
    runGame("addItems(G.inventory,'wood',40)");
    stand(tree);
    assert.equal(hit(tree), true);
    assert.equal(runGame(`G.collection.damage.get(${tree})`), 1);
    assert.equal(counts().wood, 40);
  },
);

test(
  [40, 45, 55, 56],
  'mixed tool selection preserves partial progress; switching never resets cooldown or applies a hit',
  () => {
    for (const [index, firstTool, secondTool, firstDamage] of [
      [tree, 'stone_axe', 'stone_pickaxe', 2],
      [rock, 'stone_pickaxe', 'stone_axe', 2],
      [ore, 'stone_pickaxe', 'stone_axe', 2],
    ]) {
      setup();
      runGame(`addItems(G.inventory,'${firstTool}',1);addItems(G.inventory,'${secondTool}',1)`);
      stand(index);
      assert.equal(hit(index), true);
      assert.equal(runGame(`G.collection.damage.get(${index})`), firstDamage);
      const lastHit = runGame('G.collection.lastHitAt');
      event('keydown', { key: '2' });
      assert.equal(runGame('G.collection.lastHitAt'), lastHit);
      assert.equal(hit(index, 100), false);
      assert.equal(runGame(`G.collection.damage.get(${index})`), firstDamage);
      assert.equal(hit(index, 250), true);
      if (index === tree) assert.equal(runGame('G.collection.drops.size'), 1);
      else {
        assert.equal(runGame(`G.collection.damage.get(${index})`), 3);
        event('keydown', { key: '1' });
        assert.equal(hit(index), true);
        assert.equal(runGame(`G.w.ob[${index}]`), 0);
        assert.equal(runGame('G.collection.drops.size'), 1);
      }
    }
    setup();
    stand(tree);
    assert.equal(hit(tree), true);
    runGame("addItems(G.inventory,'stone_axe',1)");
    assert.equal(hit(tree), true);
    assert.equal(runGame(`G.w.ob[${tree}]`), 0, 'hand1+axe2 destroys a tree');
  },
);

test(
  [52, 53, 54],
  '80px reach and 350ms cooldown reject premature/out of reach hits without spending progress',
  () => {
    for (const index of [tree, rock]) {
      setup();
      equip(index === tree ? 'stone_axe' : 'stone_pickaxe');
      stand(index, 81);
      assert.equal(hit(index), false);
      assert.equal(runGame('G.collection.damage.size'), 0);
      stand(index, 80);
      assert.equal(hit(index), true);
      const damage = runGame(`G.collection.damage.get(${index})`);
      for (let i = 0; i < 25; i++) assert.equal(hit(index, 0), false);
      assert.equal(hit(index, 349), false);
      assert.equal(runGame(`G.collection.damage.get(${index})`), damage);
      assert.equal(hit(index, 1), true);
      assert.equal(runGame('G.collection.drops.size'), 1);
    }
  },
);

test(
  [57, 58, 59, 60],
  'inventory, crafting, map, menu and raft gates reject collection and do not start swings',
  () => {
    for (const mode of ['inventory', 'crafting', 'map', 'menu', 'boat']) {
      setup();
      equip('stone_axe');
      stand(tree);
      if (mode === 'inventory') event('keydown', { key: 'i' });
      else if (mode === 'crafting') event('keydown', { key: 'c' });
      else if (mode === 'map') event('keydown', { key: 'm' });
      else if (mode === 'menu') getElement('m').style.display = 'flex';
      else runGame('G.boat=1');
      const before = runGame('G.swing');
      assert.equal(hit(tree), false, mode);
      assert.equal(runGame('G.collection.damage.size'), 0, mode);
      assert.equal(runGame('G.swing'), before, mode + ' does not animate an invalid hit');
    }
  },
);

test(
  [52, 53, 63],
  'path obstruction cannot be bypassed by a tool; destroyed objects release collision once',
  () => {
    setup();
    equip('stone_axe');
    stand(tree, 70);
    runGame(`G.w.ob[10*32+11]=2`);
    assert.equal(runGame(`resourcePathClear(${tree})`), false);
    assert.equal(hit(tree), false);
    runGame('G.w.ob[10*32+11]=0');
    stand(tree);
    const base = runGame(`resourceBase(G.w,${tree})`);
    assert.equal(runGame(`blocked(G.w,${base.x},${base.y},0)`), 1);
    assert.equal(hit(tree), true);
    assert.equal(hit(tree), true);
    assert.equal(runGame(`blocked(G.w,${base.x},${base.y},0)`), 0);
    for (let i = 0; i < 10; i++) assert.equal(hit(tree), false);
    assert.equal(runGame('G.collection.drops.size'), 1);
  },
);

test(
  [61, 62, 64],
  'actual canvas click conversion respects all zoom levels and two camera positions, hits only target',
  () => {
    for (const zoom of [0, 1, 2, 3])
      for (const cameraOffset of [0, 20]) {
        setup();
        equip('stone_axe');
        stand(tree);
        runGame(`zi=${zoom};G.cx=G.px+${cameraOffset};G.cy=G.py-20;draw(0);toastT=0`);
        const screen = runGame(
          `(()=>{const b=resourceBase(G.w,${tree}),v=G.view;return {x:(b.x-v.ox)*v.z,y:(b.y-30-v.oy)*v.z}})()`,
        );
        runGame(`cv.onmousedown({button:0,clientX:${screen.x},clientY:${screen.y}})`);
        assert.equal(runGame(`G.collection.damage.get(${tree})`), 2);
        assert.equal(runGame('G.collection.damage.size'), 1);
        assert.equal(runGame('G.collection.drops.size'), 0);
      }
  },
);

for (const id of ['stone_axe', 'stone_pickaxe'])
  test(
    [id === 'stone_axe' ? 65 : 66, 67, 68, 69, 70],
    id + ' fabrication, selected slot and moved position survive actual save/reload',
    () => {
      setup();
      addIngredients(id);
      runGame('setCraftingOpen(true)');
      assert.equal(runGame(`performCraft('recipe_${id}').ok`), true);
      runGame('setCraftingOpen(false)');
      const index = runGame(`G.inventory.slots.findIndex(s=>s?.itemId==='${id}')`);
      runGame(`inventorySlotClick(G.inventory,${index},0);inventorySlotClick(G.inventory,0,0)`);
      event('keydown', { key: '1' });
      assert.equal(runGame('activeTool().id'), id);
      const saved = saveAndRestore();
      assert.equal(saved.v, 5);
      assert.equal(runGame('activeTool().id'), id);
      assert.equal(runGame('G.inventory.selected'), 0);
      runGame('inventorySlotClick(G.inventory,0,0);inventorySlotClick(G.inventory,11,0)');
      saveAndRestore();
      assert.equal(runGame('activeTool()'), null);
      equal(runGame('G.inventory.slots[11]'), { itemId: id, quantity: 1 });
      invariant();
    },
  );

test(
  [71, 72, 73, 74, 79],
  'partial hand/tool progress, removed resources and single drops survive repeated reload',
  () => {
    setup();
    stand(tree);
    assert.equal(hit(tree), true);
    assert.equal(runGame(`G.collection.damage.get(${tree})`), 1);
    saveAndRestore();
    assert.equal(runGame(`G.collection.damage.get(${tree})`), 1);
    equip('stone_axe');
    stand(tree);
    assert.equal(hit(tree), true);
    assert.equal(runGame(`G.w.ob[${tree}]`), 0);
    for (let i = 0; i < 3; i++) {
      saveAndRestore();
      assert.equal(runGame(`G.w.ob[${tree}]`), 0);
      assert.equal(runGame('G.collection.drops.size'), 1);
      assert.equal(runGame(`G.collection.drops.get('drop-${tree}').amount`), 3);
    }
  },
);

test(
  [51, 79, 98, 99],
  'mineral drops persist once; partial pickup into a nearly full inventory preserves remainder',
  () => {
    setup();
    equip('stone_pickaxe');
    stand(ore);
    for (let i = 0; i < 3; i++) assert.equal(hit(ore), true);
    saveAndRestore();
    assert.equal(runGame(`G.collection.drops.get('drop-${ore}').amount`), 1);
    runGame(`{const d=G.collection.drops.get('drop-${ore}');G.px=d.x;G.py=d.y;collectDrops()}`);
    assert.equal(counts().ore, 1);
    saveAndRestore();
    assert.equal(runGame('G.collection.drops.size'), 0);
    setup();
    runGame("addItems(G.inventory,'wood',3199)");
    stand(tree);
    for (let i = 0; i < 3; i++) assert.equal(hit(tree), true);
    runGame(`{const d=G.collection.drops.get('drop-${tree}');G.px=d.x;G.py=d.y;collectDrops()}`);
    assert.equal(counts().wood, 3200);
    assert.equal(runGame(`G.collection.drops.get('drop-${tree}').amount`), 2);
    saveAndRestore();
    assert.equal(runGame(`G.collection.drops.get('drop-${tree}').amount`), 2);
  },
);

test(
  [75, 76, 84, 97],
  'same-seed worlds retain separate tools, inventories and resource damage',
  () => {
    setup('tools-world-A');
    equip('stone_axe');
    stand(tree);
    assert.equal(hit(tree), true);
    const a = saveAndRestore('tools-world-A');
    setup('tools-world-B');
    equip('stone_pickaxe');
    stand(rock);
    assert.equal(hit(rock), true);
    const b = saveAndRestore('tools-world-B');
    setup('tools-world-A', a);
    assert.equal(counts().stone_axe, 1);
    assert.equal(counts().stone_pickaxe, 0);
    assert.equal(runGame(`G.collection.damage.get(${tree})`), 2);
    assert.equal(runGame(`G.collection.damage.has(${rock})`), false);
    setup('tools-world-B', b);
    assert.equal(counts().stone_pickaxe, 1);
    assert.equal(counts().stone_axe, 0);
    assert.equal(runGame(`G.collection.damage.get(${rock})`), 2);
    assert.equal(runGame('G.w.seed'), 'same-tools-seed');
  },
);

test(
  [77, 78, 80],
  'old v0.5 schema4 items and exploration migrate without creating tools or losing sparse damage',
  () => {
    const slots = Array(16).fill(null);
    slots[0] = { itemId: 'wood', quantity: 49 };
    slots[15] = { itemId: 'primitive_component', quantity: 2 };
    const legacy = {
      v: 4,
      gv: 2,
      id: 'legacy05',
      x: 352,
      y: 346,
      boat: 0,
      exp: Buffer.alloc(128, 0x15).toString('base64'),
      collection: { removed: [], damage: [[tree, 1]], drops: [] },
      inventory: {
        slots,
        selected: 7,
        cursor: null,
        pending: {
          wood: 0,
          stone: 0,
          ore: 0,
          stick: 0,
          plank: 0,
          chipped_stone: 0,
          simple_handle: 0,
          primitive_component: 0,
        },
        migrationVersion: 1,
      },
    };
    const raw = JSON.stringify(legacy);
    storageValues.set('origens_w_legacy05', raw);
    setup('legacy05', legacy);
    assert.equal(runGame('G.saveProtected'), false);
    equal(runGame('G.inventory.slots'), slots);
    assert.equal(runGame('G.inventory.selected'), 7);
    assert.equal(counts().stone_axe, 0);
    assert.equal(counts().stone_pickaxe, 0);
    assert.equal(runGame(`G.collection.damage.get(${tree})`), 1);
    equal(runGame('Array.from(G.ex)'), Array(128).fill(0x15));
    const current = saveAndRestore('legacy05');
    assert.equal(current.v, 5);
    assert.equal(storageValues.get('origens_w_legacy05_backup_v4'), raw);
    equal(runGame('G.inventory.slots'), slots);
    assert.equal(counts().stone_axe + counts().stone_pickaxe, 0);
  },
);

test(
  [78, 80],
  'known excess tools and occupied cursor recover once; unknown ID is ignored without discarding neighbours',
  () => {
    setup();
    runGame(
      `Object.assign(G.inventory,restoreInventory({slots:[{itemId:'stone_axe',quantity:3},{itemId:'unknown_future_item',quantity:10},{itemId:'wood',quantity:25}],cursor:{itemId:'stone_pickaxe',quantity:1},selected:0,pending:{}}))`,
    );
    assert.equal(counts().stone_axe, 3);
    assert.equal(counts().stone_pickaxe, 1);
    assert.equal(counts().wood, 25);
    assert.equal(runGame("G.inventory.slots.filter(s=>s?.itemId==='stone_axe').length"), 3);
    assert.equal(runGame('activeTool().id'), 'stone_axe');
    const before = snapshot();
    runGame('Object.assign(G.inventory,restoreInventory(serializeInventory(G.inventory)))');
    equal(runGame('serializeInventory(G.inventory)'), before);
    invariant();
  },
);

test(
  [32, 69, 70],
  'tool held on cursor survives pagehide save and closes back into a real slot without duplication',
  () => {
    setup();
    equip('stone_axe');
    runGame('setInventoryOpen(true);inventorySlotClick(G.inventory,0,0)');
    assert.equal(runGame('activeTool()'), null);
    event('pagehide');
    const saved = JSON.parse(storageValues.get('origens_w_tools-A'));
    setup('tools-A', saved);
    assert.equal(runGame('inventoryOpen'), true);
    assert.equal(runGame('activeTool()'), null);
    equal(runGame('G.inventory.cursor'), { itemId: 'stone_axe', quantity: 1 });
    assert.equal(runGame('setInventoryOpen(false)'), true);
    assert.equal(counts().stone_axe, 1);
    assert.equal(runGame('G.inventory.cursor'), null);
    invariant();
  },
);

test(
  [65, 66, 97],
  'failed storage preserves crafted tools in memory, flags unsaved state, and retries safely',
  () => {
    setup();
    assert.equal(runGame('save(1)'), 1);
    const previous = storageValues.get('origens_w_tools-A');
    addIngredients('stone_axe');
    addIngredients('stone_pickaxe');
    runGame('setCraftingOpen(true)');
    storageFails = true;
    assert.equal(runGame("performCraft('recipe_stone_axe').ok"), true);
    assert.equal(runGame("performCraft('recipe_stone_pickaxe').ok"), true);
    now += 700;
    runGame('update(.016)');
    assert.equal(runGame('G.lastSaveFailed'), true);
    assert.equal(runGame('G.unsavedChanges'), true);
    assert.equal(storageValues.get('origens_w_tools-A'), previous);
    storageFails = false;
    saveAndRestore();
    assert.equal(counts().stone_axe, 1);
    assert.equal(counts().stone_pickaxe, 1);
  },
);

test(
  [7, 8, 9, 34, 35, 69, 70, 95],
  '1200 deterministic inventory moves/splits/reloads conserve tools at every backpack capacity',
  () => {
    let random = 0x6c0ffee;
    const next = () => (random = (Math.imul(random, 1664525) + 1013904223) >>> 0);
    for (const tier of [0, 1, 2]) {
      setup();
      runGame(
        `G.inventory.backpackTier=${tier};G.inventory.slots=Array(${[16, 24, 32][tier]}).fill(null);addItems(G.inventory,'stone_axe',3);addItems(G.inventory,'stone_pickaxe',3);addItems(G.inventory,'wood',340);addItems(G.inventory,'stone',170)`,
      );
      const expected = counts();
      for (let i = 0; i < 400; i++) {
        const index = next() % [16, 24, 32][tier],
          op = next() % 5;
        if (op < 2) runGame(`inventorySlotClick(G.inventory,${index},${op === 0 ? 0 : 2})`);
        else if (op === 2) runGame('returnInventoryCursor(G.inventory)');
        else if (op === 3)
          runGame('Object.assign(G.inventory,restoreInventory(serializeInventory(G.inventory)))');
        else event('keydown', { key: String((next() % 9) + 1) });
        equal(runGame('inventoryTotals(G.inventory)'), expected);
        invariant();
      }
    }
  },
);

test(
  [81, 82],
  'WASD movement and camera following continue after selecting and using tools',
  () => {
    setup();
    equip('stone_axe');
    for (const [key, axis, sign] of [
      ['d', 'x', 1],
      ['a', 'x', -1],
      ['s', 'y', 1],
      ['w', 'y', -1],
    ]) {
      runGame('G.px=10.5*T;G.py=10.5*T;G.cx=G.px;G.cy=G.py;keys={}');
      const before = runGame(`G.p${axis}`);
      event('keydown', { key });
      runGame('update(.05)');
      event('keyup', { key });
      assert.ok((runGame(`G.p${axis}`) - before) * sign > 0, key);
    }
    runGame('G.cx=G.px-60;G.cy=G.py-60;keys={}');
    const camera = runGame('G.cx');
    runGame('update(.05)');
    assert.ok(runGame('G.cx') > camera);
  },
);

test(
  [85, 86, 87],
  'tools do not alter real raft boarding, sea navigation or safe disembarking',
  () => {
    setup();
    equip('stone_pickaxe');
    runGame('G.px=7.5*T;G.py=10.5*T;G.cx=G.px;G.cy=G.py');
    event('keydown', { key: 'e' });
    assert.equal(runGame('G.boat'), 1);
    const x = runGame('G.px');
    event('keydown', { key: 'a' });
    runGame('update(.05)');
    event('keyup', { key: 'a' });
    assert.ok(runGame('G.px') < x);
    assert.equal(runGame('G.boat'), 1);
    event('keydown', { key: 'e' });
    assert.equal(runGame('G.boat'), 0);
    assert.equal(runGame('blocked(G.w,G.px,G.py,0)'), 0);
  },
);

test([83, 84, 96], 'generator bytes and old five recipe transformations remain intact', () => {
  const previous = fs.readFileSync(path.join(root, 'ORIGENS — Survival v0.5.html'), 'utf8');
  const generator = (text) =>
    text.slice(text.indexOf('// ===== SeededRandom'), text.indexOf('// ===== Arte pixel'));
  assert.equal(generator(source), generator(previous));
  const result = runGame(
    `(()=>{const make=()=>{const it=gen('test','TEST-128-0',128);let r;while(!(r=it.next()).done);return r.value};const a=make(),b=make();return{ok:a.ok&&b.ok,same:a.ter.every((v,i)=>v===b.ter[i]&&a.ob[i]===b.ob[i])}})()`,
  );
  assert.equal(result.ok, true);
  assert.equal(result.same, true);
  const recipes = {
    recipe_stick: [{ wood: 1 }, 'stick', 2],
    recipe_plank: [{ wood: 2 }, 'plank', 2],
    recipe_chipped_stone: [{ stone: 1 }, 'chipped_stone', 2],
    recipe_simple_handle: [{ stick: 2, plank: 1 }, 'simple_handle', 1],
    recipe_primitive_component: [{ simple_handle: 1, chipped_stone: 2 }, 'primitive_component', 1],
  };
  for (const [id, [ingredients, output, amount]] of Object.entries(recipes)) {
    setup();
    for (const [kind, n] of Object.entries(ingredients))
      runGame(`addItems(G.inventory,'${kind}',${n})`);
    assert.equal(runGame(`executeCraft(G.inventory,'${id}').ok`), true);
    assert.equal(counts()[output], amount);
    assert.equal(runGame('G.inventory.slots.filter(Boolean).length'), 1);
  }
});

console.log(`\n${passed} tools/model integration groups passed.`);
console.log(
  'v0.6 numbered criteria exercised in VM: ' + [...covered].sort((a, b) => a - b).join(', '),
);
console.log('Initial inventory has 16 slots; supplied user v0.7 backpacks expand it to 24/32.');
console.log(
  'Actual DOM highlighting, canvas appearance, browser event delivery and console are covered by Playwright.',
);
