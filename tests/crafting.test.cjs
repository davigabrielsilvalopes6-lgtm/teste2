#!/usr/bin/env node
'use strict';

// The shipped v0.5 script is exercised directly. The second realm replaces only
// DOM painting; real browser rendering, pointer delivery and console checks are
// covered separately by Playwright, not claimed by this VM suite.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'ORIGENS — Survival v0.5.html');
const source = fs.readFileSync(file, 'utf8');
const scriptMatch = source.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(scriptMatch, 'the shipped game has its actual embedded script');
const script = scriptMatch[1];
function block(start, end) {
  assert.ok(script.includes(start) && script.includes(end), 'shipped markers: ' + start);
  return script.slice(script.indexOf(start), script.indexOf(end) + end.length);
}
const model =
  block('// ===== Inventário v0.4: modelo =====', '// ===== Fim do modelo de inventário =====') +
  '\n' +
  block('// ===== Crafting v0.5: modelo =====', '// ===== Fim do modelo de crafting =====');
const pure = vm.createContext({ console });
vm.runInContext(model, pure, { filename: file + ':crafting-model' });
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
const kinds = [
  'wood',
  'stone',
  'ore',
  'stick',
  'plank',
  'chipped_stone',
  'simple_handle',
  'primitive_component',
];
const expectedRecipes = {
  recipe_stick: { ingredients: { wood: 1 }, output: ['stick', 2] },
  recipe_plank: { ingredients: { wood: 2 }, output: ['plank', 2] },
  recipe_chipped_stone: { ingredients: { stone: 1 }, output: ['chipped_stone', 2] },
  recipe_simple_handle: { ingredients: { stick: 2, plank: 1 }, output: ['simple_handle', 1] },
  recipe_primitive_component: {
    ingredients: { simple_handle: 1, chipped_stone: 2 },
    output: ['primitive_component', 1],
  },
};
const emptyTotals = () => Object.fromEntries(kinds.map((kind) => [kind, 0]));
function totals(inv) {
  const result = emptyTotals();
  for (const stack of [...inv.slots, inv.cursor]) if (stack) result[stack.itemId] += stack.quantity;
  for (const kind of kinds) result[kind] += inv.pending[kind] || 0;
  return result;
}
function invariant(inv) {
  assert.equal(inv.slots.length, 16, 'there are never extra storage slots');
  const refs = new Set();
  for (const stack of [...inv.slots, inv.cursor]) {
    if (stack === null) continue;
    assert.ok(kinds.includes(stack.itemId), 'registered item');
    assert.ok(Number.isSafeInteger(stack.quantity) && stack.quantity > 0 && stack.quantity <= 200);
    assert.equal(refs.has(stack), false, 'live stack objects are not shared');
    refs.add(stack);
  }
  assert.ok(Number.isInteger(inv.selected) && inv.selected >= 0 && inv.selected < 9);
  for (const kind of kinds)
    assert.ok(Number.isSafeInteger(inv.pending[kind]) && inv.pending[kind] >= 0);
  assert.equal(inv.hotbar, undefined, 'the shortcut bar is not another inventory');
  assert.equal(inv.hotbarSlots, undefined);
}
function fresh(code = '') {
  runModel('globalThis.inv=createInventory();' + code);
}
function snapshot() {
  return json(runModel('inv'));
}
function expectFailure(code, reason) {
  const before = snapshot();
  const result = runModel(code);
  assert.equal(result.ok, false);
  if (reason) assert.equal(result.reason, reason);
  equal(runModel('inv'), before);
  return result;
}

test([1, 2, 3], 'five unique immutable recipes reference the eight known item IDs', () => {
  equal(runModel('Object.keys(ITEM_TYPES).sort()'), [...kinds].sort());
  equal(runModel('Object.keys(CRAFT_RECIPES).sort()'), Object.keys(expectedRecipes).sort());
  for (const [id, expected] of Object.entries(expectedRecipes)) {
    const recipe = runModel(`CRAFT_RECIPES[${JSON.stringify(id)}]`);
    assert.equal(recipe.id, id);
    equal(
      Object.fromEntries(recipe.ingredients.map((i) => [i.itemId, i.quantity])),
      expected.ingredients,
    );
    equal([recipe.output.itemId, recipe.output.quantity], expected.output);
    assert.equal(runModel(`validateCraftRecipe(CRAFT_RECIPES[${JSON.stringify(id)}]).ok`), true);
    assert.equal(runModel(`Object.isFrozen(CRAFT_RECIPES[${JSON.stringify(id)}])`), true);
    assert.equal(
      runModel(`Object.isFrozen(CRAFT_RECIPES[${JSON.stringify(id)}].ingredients)`),
      true,
    );
    assert.equal(runModel(`Object.isFrozen(CRAFT_RECIPES[${JSON.stringify(id)}].output)`), true);
    for (const ingredient of recipe.ingredients) assert.ok(kinds.includes(ingredient.itemId));
  }
  assert.equal(runModel('Object.isFrozen(CRAFT_RECIPES)'), true);
  const before = json(runModel('CRAFT_RECIPES'));
  runModel(
    'try{CRAFT_RECIPES.recipe_stick.ingredients[0].quantity=199}catch{};try{CRAFT_RECIPES.recipe_stick.output.quantity=99}catch{}',
  );
  equal(runModel('CRAFT_RECIPES'), before);
});

test(
  [4, 5],
  'invalid quantities, unknown IDs and malformed recipe definitions are rejected in isolation',
  () => {
    runModel('globalThis.valid=JSON.parse(JSON.stringify(CRAFT_RECIPES.recipe_stick))');
    for (const quantity of [
      '-1',
      '0',
      '0.5',
      'NaN',
      'Infinity',
      '3201',
      'Number.MAX_SAFE_INTEGER',
      "'2'",
    ]) {
      assert.equal(
        runModel(
          `validateCraftRecipe({...valid,ingredients:[{itemId:'wood',quantity:${quantity}}]}).ok`,
        ),
        false,
      );
      assert.equal(
        runModel(`validateCraftRecipe({...valid,output:{itemId:'stick',quantity:${quantity}}}).ok`),
        false,
      );
    }
    for (const definition of [
      'null',
      'false',
      '[]',
      '{}',
      "{...valid,output:{itemId:'missing',quantity:1}}",
      "{...valid,ingredients:[{itemId:'missing',quantity:1}]}",
      '{...valid,ingredients:[]}',
      '{...valid,output:null}',
      "{...valid,id:''}",
      "{...valid,name:''}",
    ])
      assert.equal(runModel(`validateCraftRecipe(${definition}).ok`), false, definition);
    const registry = runModel(
      "createCraftRecipeRegistry([valid,{...valid,id:'bad',output:{itemId:'missing',quantity:1}},{...valid}])",
    );
    equal(Object.keys(registry.recipes), ['recipe_stick']);
    assert.equal(registry.errors.length, 2);
    assert.equal(registry.recipes.recipe_stick.output.quantity, 2);
  },
);

test([6, 18], 'unknown requests and unavailable registered recipes cannot mutate inventory', () => {
  fresh("addItems(inv,'wood',10)");
  expectFailure("executeCraft(inv,'recipe_unknown')", 'unknown_recipe');
  expectFailure("executeCraft(inv,'__proto__')", 'unknown_recipe');
  runModel(
    'globalThis.locked=createCraftRecipeRegistry([{...CRAFT_RECIPES.recipe_stick,available:false}]).recipes',
  );
  expectFailure("executeCraft(inv,'recipe_stick',1,locked)", 'unavailable');
  runModel(
    "globalThis.station=createCraftRecipeRegistry([{...CRAFT_RECIPES.recipe_stick,station:'workbench'}]).recipes",
  );
  expectFailure("executeCraft(inv,'recipe_stick',1,station)", 'unavailable');
});

for (const [criterion, id] of [
  [7, 'recipe_stick'],
  [8, 'recipe_plank'],
  [9, 'recipe_chipped_stone'],
  [10, 'recipe_simple_handle'],
  [11, 'recipe_primitive_component'],
]) {
  test(
    [criterion, 12, 13, 14, 25],
    id + ' consumes only its exact inputs and creates its exact output',
    () => {
      const recipe = expectedRecipes[id];
      fresh("addItems(inv,'ore',17)");
      for (const [kind, amount] of Object.entries(recipe.ingredients))
        runModel(`addItems(inv,${JSON.stringify(kind)},${amount + 3})`);
      const before = totals(runModel('inv'));
      assert.equal(runModel(`executeCraft(inv,${JSON.stringify(id)}).ok`), true);
      const after = { ...before };
      for (const [kind, amount] of Object.entries(recipe.ingredients)) after[kind] -= amount;
      after[recipe.output[0]] += recipe.output[1];
      assert.deepEqual(totals(runModel('inv')), after);
      invariant(runModel('inv'));
    },
  );
}

test(
  [15, 16, 18, 28],
  'missing all or some ingredients rejects without changing slots or object identities',
  () => {
    fresh();
    expectFailure("executeCraft(inv,'recipe_stick')", 'missing_ingredients');
    fresh("addItems(inv,'stick',2);globalThis.oldSlots=inv.slots;globalThis.oldStack=inv.slots[0]");
    expectFailure("executeCraft(inv,'recipe_simple_handle')", 'missing_ingredients');
    assert.equal(runModel('inv.slots===oldSlots&&inv.slots[0]===oldStack'), true);
  },
);

test([17, 13], 'distributed ingredients are consumed from slot 15 toward slot 0', () => {
  fresh(
    "inv.slots[0]={itemId:'stick',quantity:1};inv.slots[8]={itemId:'stick',quantity:1};inv.slots[15]={itemId:'stick',quantity:1};inv.slots[14]={itemId:'plank',quantity:1}",
  );
  assert.equal(runModel("executeCraft(inv,'recipe_simple_handle').ok"), true);
  equal(runModel('inv.slots[0]'), { itemId: 'stick', quantity: 1 });
  assert.equal(runModel('inv.slots[8]'), null);
  assert.equal(runModel('inv.slots[15]'), null);
  assert.equal(totals(runModel('inv')).simple_handle, 1);
});

test(
  [18, 20],
  'simulation is detached and execution commits one cloned slot array atomically',
  () => {
    fresh(
      "addItems(inv,'wood',4);addItems(inv,'stick',13);inv.selected=7;inv.pending.ore=9;globalThis.previousSlots=inv.slots;globalThis.previousPending=inv.pending;globalThis.sim=simulateCraft(inv,'recipe_stick')",
    );
    assert.equal(runModel('sim.ok'), true);
    assert.equal(runModel('sim.slots===inv.slots'), false);
    assert.equal(runModel('sim.slots[0]===inv.slots[0]'), false);
    equal(runModel('inv.slots[1]'), { itemId: 'stick', quantity: 13 });
    runModel('sim.slots[0].quantity=100');
    assert.equal(runModel('inv.slots[0].quantity'), 4);
    runModel(
      "globalThis.commits=0;inv=new Proxy(inv,{set(target,key,value,receiver){if(key==='slots')commits++;return Reflect.set(target,key,value,receiver)}})",
    );
    assert.equal(runModel("executeCraft(inv,'recipe_stick').ok"), true);
    assert.equal(runModel('commits'), 1);
    assert.equal(runModel('inv.slots===previousSlots'), false);
    assert.equal(runModel('inv.pending===previousPending'), true);
    assert.equal(runModel('inv.selected'), 7);
    assert.equal(runModel('inv.cursor'), null);
    equal(runModel('inv.slots[1]'), { itemId: 'stick', quantity: 15 });
  },
);

test(
  [21, 22, 23, 24],
  '199 plus two fills the first stack and spills exactly one into a real empty slot',
  () => {
    fresh("inv.slots[0]={itemId:'stick',quantity:199};inv.slots[1]={itemId:'wood',quantity:2}");
    assert.equal(runModel("executeCraft(inv,'recipe_stick').ok"), true);
    equal(runModel('inv.slots.slice(0,3)'), [
      { itemId: 'stick', quantity: 200 },
      { itemId: 'wood', quantity: 1 },
      { itemId: 'stick', quantity: 1 },
    ]);
    invariant(runModel('inv'));
    fresh("inv.slots[0]={itemId:'stick',quantity:198};inv.slots[1]={itemId:'wood',quantity:2}");
    assert.equal(runModel("executeCraft(inv,'recipe_stick').ok"), true);
    assert.equal(runModel('inv.slots[0].quantity'), 200);
    assert.equal(runModel('inv.slots[2]'), null);
  },
);

test(
  [22, 24, 27, 28, 29, 30],
  '199 plus two is refused when the unconsumed ingredient leaves all sixteen slots occupied',
  () => {
    fresh(
      "addItems(inv,'ore',3200);inv.slots[0]={itemId:'stick',quantity:199};inv.slots[15]={itemId:'wood',quantity:2}",
    );
    expectFailure("executeCraft(inv,'recipe_stick')", 'no_space');
    assert.equal(runModel('inv.slots.length'), 16);
    invariant(runModel('inv'));
  },
);

test(
  [26, 29],
  'a full inventory succeeds when consuming the ingredient frees the slot needed by its output',
  () => {
    fresh("addItems(inv,'ore',3200);inv.slots[15]={itemId:'wood',quantity:1}");
    assert.equal(runModel("executeCraft(inv,'recipe_stick').ok"), true);
    equal(runModel('inv.slots[15]'), { itemId: 'stick', quantity: 2 });
    assert.equal(runModel('inv.slots.length'), 16);
    invariant(runModel('inv'));
  },
);

test([31, 32, 13, 14], '1x and 5x multiply both ingredients and the two-unit result', () => {
  for (const times of [1, 5]) {
    fresh("addItems(inv,'wood',20)");
    assert.equal(runModel(`executeCraft(inv,'recipe_stick',${times}).ok`), true);
    assert.equal(totals(runModel('inv')).wood, 20 - times);
    assert.equal(totals(runModel('inv')).stick, times * 2);
  }
});

test(
  [33, 34, 35, 18],
  'a rejected batch is never applied partially for missing inputs or insufficient capacity',
  () => {
    fresh("addItems(inv,'wood',4)");
    expectFailure("executeCraft(inv,'recipe_stick',5)", 'missing_ingredients');
    fresh(
      "addItems(inv,'ore',3200);inv.slots[0]={itemId:'stick',quantity:198};inv.slots[15]={itemId:'wood',quantity:10}",
    );
    assert.equal(runModel("simulateCraft(inv,'recipe_stick',1).ok"), true);
    expectFailure("executeCraft(inv,'recipe_stick',5)", 'no_space');
  },
);

test(
  [36],
  'maximum handles nonmonotonic capacity: one craft fails but five crafts free an input slot',
  () => {
    fresh(
      "addItems(inv,'ore',3200);inv.slots[0]={itemId:'stick',quantity:199};inv.slots[15]={itemId:'wood',quantity:5}",
    );
    assert.equal(runModel("simulateCraft(inv,'recipe_stick',1).reason"), 'no_space');
    assert.equal(runModel("simulateCraft(inv,'recipe_stick',5).ok"), true);
    const before = snapshot();
    assert.equal(runModel("getMaxCraftable(inv,'recipe_stick')"), 5);
    equal(runModel('inv'), before);
    assert.equal(runModel("executeCraft(inv,'recipe_stick',5).ok"), true);
    assert.equal(totals(runModel('inv')).stick, 209);
    assert.equal(runModel("getMaxCraftable(inv,'recipe_stick')"), 0);
  },
);

test(
  [36],
  'maximum respects all inputs, output capacity and the bounded 3200-unit inventory',
  () => {
    fresh("addItems(inv,'stick',18);addItems(inv,'plank',4)");
    assert.equal(runModel("getMaxCraftable(inv,'recipe_simple_handle')"), 4);
    fresh("addItems(inv,'wood',1600)");
    assert.equal(runModel("getMaxCraftable(inv,'recipe_stick')"), 1600);
    fresh("addItems(inv,'wood',3200)");
    const before = snapshot();
    assert.equal(runModel("getMaxCraftable(inv,'recipe_stick')"), 0);
    assert.equal(runModel("getMaxCraftable(inv,'missing')"), 0);
    equal(runModel('inv'), before);
  },
);

test(
  [18, 35],
  'invalid or enormous requested quantities reject without unbounded loops or inventory mutation',
  () => {
    fresh("addItems(inv,'wood',30)");
    for (const times of [
      '0',
      '-1',
      '0.5',
      'NaN',
      'Infinity',
      '3201',
      'Number.MAX_SAFE_INTEGER',
      '1e100',
      "'5'",
      'null',
      '{}',
    ])
      expectFailure(`executeCraft(inv,'recipe_stick',${times})`, 'invalid_quantity');
    for (const invalid of [
      'null',
      '{}',
      '{slots:[]}',
      '{...inv,slots:inv.slots.slice(0,15)}',
      "{...inv,slots:[{itemId:'unknown',quantity:1},...inv.slots.slice(1)]}",
      "{...inv,slots:[{itemId:'wood',quantity:201},...inv.slots.slice(1)]}",
    ])
      assert.equal(runModel(`executeCraft(${invalid},'recipe_stick').ok`), false, invalid);
  },
);

test(
  [15, 18, 45],
  'cursor and migration recovery are not ingredient sources and held items are preserved',
  () => {
    fresh("inv.pending.wood=200;globalThis.outsideDrop={itemId:'wood',quantity:200}");
    equal(runModel('countCraftMaterials(inv)'), emptyTotals());
    expectFailure("executeCraft(inv,'recipe_stick')", 'missing_ingredients');
    fresh("addItems(inv,'wood',5);inv.cursor={itemId:'wood',quantity:7}");
    const available = emptyTotals();
    available.wood = 5;
    equal(runModel('countCraftMaterials(inv)'), available);
    expectFailure("executeCraft(inv,'recipe_stick')", 'cursor_busy');
    assert.equal(runModel("getMaxCraftable(inv,'recipe_stick')"), 0);
  },
);

// This oracle is independent of the game helpers and definitions. It models
// only the five agreed transformations, descending input removal, then stacking.
function oracle(slots, id, times, cursor = null) {
  if (cursor) return null;
  const recipe = expectedRecipes[id];
  if (!recipe || !Number.isSafeInteger(times) || times < 1 || times > 3200) return null;
  const copy = slots.map((s) => s && { ...s });
  for (const [kind, perCraft] of Object.entries(recipe.ingredients)) {
    let needed = perCraft * times;
    if (copy.reduce((n, s) => n + (s?.itemId === kind ? s.quantity : 0), 0) < needed) return null;
    for (let i = 15; i >= 0 && needed; i--) {
      const s = copy[i];
      if (s?.itemId !== kind) continue;
      const used = Math.min(s.quantity, needed);
      s.quantity -= used;
      needed -= used;
      if (s.quantity === 0) copy[i] = null;
    }
  }
  const [itemId, perCraft] = recipe.output;
  let remaining = perCraft * times;
  for (const s of copy)
    if (s?.itemId === itemId) {
      const inserted = Math.min(200 - s.quantity, remaining);
      s.quantity += inserted;
      remaining -= inserted;
    }
  for (let i = 0; i < 16 && remaining; i++)
    if (copy[i] === null) {
      const quantity = Math.min(200, remaining);
      copy[i] = { itemId, quantity };
      remaining -= quantity;
    }
  return remaining === 0 ? copy : null;
}

test(
  [17, 23, 28, 29, 35, 42, 67],
  '1500 deterministic crafting, split, merge, move and reload steps match an independent oracle',
  () => {
    fresh("addItems(inv,'wood',450);addItems(inv,'stone',333);addItems(inv,'ore',17)");
    const expected = totals(runModel('inv'));
    const ids = Object.keys(expectedRecipes);
    let seed = 0x05c0ffee,
      successes = 0,
      failures = 0;
    const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
    for (let step = 0; step < 1500; step++) {
      const operation = next() % 10;
      if (operation < 5) {
        const id = ids[next() % ids.length],
          times = 1 + (next() % 5);
        const before = snapshot();
        const predicted = oracle(before.slots, id, times, before.cursor);
        const result = runModel(`executeCraft(inv,${JSON.stringify(id)},${times})`);
        assert.equal(result.ok, predicted !== null, 'oracle success at step ' + step);
        if (predicted) {
          successes++;
          equal(runModel('inv.slots'), predicted);
          const recipe = expectedRecipes[id];
          for (const [kind, amount] of Object.entries(recipe.ingredients))
            expected[kind] -= amount * times;
          expected[recipe.output[0]] += recipe.output[1] * times;
        } else {
          failures++;
          equal(runModel('inv'), before);
        }
      } else if (operation < 8) {
        runModel(`inventorySlotClick(inv,${next() % 16},${next() & 1 ? 0 : 2})`);
      } else if (operation === 8) runModel('returnInventoryCursor(inv)');
      else runModel('inv=restoreInventory(serializeInventory(inv))');
      assert.deepEqual(totals(runModel('inv')), expected, 'transformation totals at step ' + step);
      invariant(runModel('inv'));
    }
    assert.ok(successes > 20, 'many real crafting transactions were accepted');
    assert.ok(failures > 20, 'many rejected transactions were checked');
  },
);

// Integration: strip only the two DOM rendering blocks. All game state,
// collection, keyboard, crafting dispatch, save and migration functions remain.
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
runGame(`function craftingFixtureWorld(id='craft-A'){
  const N=32,length=N*N,w={N,ter:new Uint8Array(length).fill(4),ob:new Uint8Array(length),own:new Uint8Array(length).fill(1),sea:new Uint8Array(length),I:[{el:0}],sp:{x:10,y:10},id,name:id,seed:'fixture-same-seed',ok:true,att:0};
  for(const[x,y,type]of[[12,10,1],[14,10,1],[12,13,2],[12,16,3]])w.ob[y*N+x]=type;
  return w;
}`);
function setup(id = 'craft-A', saved = null) {
  runGame(
    `start(craftingFixtureWorld(${JSON.stringify(id)}),${JSON.stringify(saved)});G.px=11*T;G.py=10*T+26;keys={};mapOpen=0;`,
  );
  now += 10000;
}
function event(type, props = {}) {
  for (const handler of events.get(type) || [])
    handler({ key: '', target: { tagName: 'CANVAS' }, preventDefault: noOp, ...props });
}
function breakResource(index, hp) {
  runGame(`{const b=resourceBase(G.w,${index});G.px=b.x-40;G.py=b.y}`);
  for (let n = 0; n < hp; n++) {
    now += 350;
    assert.equal(runGame(`hitResource(${index})`), true);
  }
}
function approachDrop(index) {
  runGame(`{const d=G.collection.drops.get('drop-${index}');G.px=d.x;G.py=d.y;collectDrops()}`);
}
function saveAndRestore(id = 'craft-A') {
  assert.equal(runGame('save(1)'), 1);
  const saved = JSON.parse(storageValues.get('origens_w_' + id));
  setup(id, saved);
  return saved;
}
const tree = 10 * 32 + 12,
  stone = 13 * 32 + 12,
  ore = 16 * 32 + 12;

test(
  [38, 39, 41],
  'repeated crafting dispatch reads current inventory and cannot spend one wood twice',
  () => {
    setup();
    runGame("addItems(G.inventory,'wood',1);setCraftingOpen(true)");
    assert.equal(runGame("performCraft('recipe_stick',1).ok"), true);
    for (let n = 0; n < 20; n++) assert.equal(runGame("performCraft('recipe_stick',1).ok"), false);
    assert.equal(totals(runGame('G.inventory')).wood, 0);
    assert.equal(totals(runGame('G.inventory')).stick, 2);
    invariant(runGame('G.inventory'));
  },
);

test(
  [38, 39],
  'a reentrant crafting dispatch is rejected while the outer transaction is committing',
  () => {
    setup();
    runGame(
      "addItems(G.inventory,'wood',1);setCraftingOpen(true);globalThis.originalPaint=renderInventoryUI;renderInventoryUI=function(){globalThis.nestedCraft=performCraft('recipe_stick',1);originalPaint()}",
    );
    try {
      assert.equal(runGame("performCraft('recipe_stick',1).ok"), true);
      assert.equal(runGame('nestedCraft.reason'), 'busy');
      assert.equal(runGame('craftingBusy'), false);
      assert.equal(totals(runGame('G.inventory')).stick, 2);
      assert.equal(totals(runGame('G.inventory')).wood, 0);
    } finally {
      runGame('renderInventoryUI=originalPaint');
    }
  },
);

test(
  [18, 38, 41],
  'unexpected precommit and presentation failures release the lock without duplicating a transaction',
  () => {
    setup();
    runGame(
      "addItems(G.inventory,'wood',1);setCraftingOpen(true);globalThis.originalExecute=executeCraft;executeCraft=function(){throw Error('test failure before commit')}",
    );
    const before = json(runGame('G.inventory'));
    try {
      assert.equal(runGame("performCraft('recipe_stick',1).ok"), false);
      assert.equal(runGame('craftingBusy'), false);
      equal(runGame('G.inventory'), before);
    } finally {
      runGame('executeCraft=originalExecute');
    }
    runGame(
      "globalThis.originalPaint=renderInventoryUI;renderInventoryUI=function(){throw Error('test painting failure after commit')}",
    );
    try {
      assert.equal(runGame("performCraft('recipe_stick',1).ok"), true);
      assert.equal(runGame('craftingBusy'), false);
      assert.equal(totals(runGame('G.inventory')).stick, 2);
      assert.equal(totals(runGame('G.inventory')).wood, 0);
      assert.equal(runGame('G.unsavedChanges'), true);
    } finally {
      runGame('renderInventoryUI=originalPaint');
    }
    assert.equal(runGame("performCraft('recipe_stick',1).reason"), 'missing_ingredients');
    assert.equal(totals(runGame('G.inventory')).stick, 2);
  },
);

test(
  [40, 41],
  'a formerly valid recipe is rechecked against inventory changed after selection',
  () => {
    setup();
    runGame(
      "addItems(G.inventory,'wood',2);setCraftingOpen(true);globalThis.stale=simulateCraft(G.inventory,'recipe_plank');G.inventory.slots[0].quantity=1",
    );
    assert.equal(runGame('stale.ok'), true);
    const before = json(runGame('G.inventory'));
    assert.equal(runGame("performCraft('recipe_plank',1).ok"), false);
    equal(runGame('G.inventory'), before);
  },
);

test(
  [43, 44, 45],
  'crafting opens safely, but refuses an occupied cursor without discarding or relocating it',
  () => {
    setup();
    assert.equal(runGame('setCraftingOpen(true)'), true);
    assert.equal(runGame('craftingOpen'), true);
    assert.equal(runGame('inventoryOpen'), false);
    runGame(
      'setCraftingOpen(false);setInventoryOpen(true);G.inventory.cursor={itemId:"wood",quantity:17}',
    );
    const before = json(runGame('G.inventory'));
    assert.equal(runGame('setCraftingOpen(true)'), false);
    assert.equal(runGame('craftingOpen'), false);
    assert.equal(runGame('inventoryOpen'), true);
    equal(runGame('G.inventory'), before);
  },
);

test(
  [47, 48, 59],
  'open crafting gates movement and extraction; closing requires fresh controls to move again',
  () => {
    setup();
    event('keydown', { key: 'd' });
    runGame('update(.05)');
    const moved = runGame('G.px');
    assert.ok(moved > 11 * 32);
    assert.equal(runGame('setCraftingOpen(true)'), true);
    event('keydown', { key: 'd' });
    runGame('update(.05)');
    assert.equal(runGame('G.px'), moved);
    now += 350;
    assert.equal(runGame(`hitResource(${tree})`), false);
    assert.equal(runGame('setCraftingOpen(false)'), true);
    runGame('update(.05)');
    assert.equal(runGame('G.px'), moved);
    event('keydown', { key: 'd' });
    runGame('update(.05)');
    assert.ok(runGame('G.px') > moved);
  },
);

test(
  [49, 50],
  'successful crafting requests fresh inventory and crafting renders without closing the panel',
  () => {
    setup();
    runGame("addItems(G.inventory,'wood',1);setCraftingOpen(true)");
    const paints = json(runGame('[inventoryPaints||0,craftingPaints||0]'));
    assert.equal(runGame("performCraft('recipe_stick',1).ok"), true);
    assert.equal(runGame('craftingOpen'), true);
    assert.ok(runGame('inventoryPaints') > paints[0]);
    assert.ok(runGame('craftingPaints') > paints[1]);
    assert.equal(
      runGame("simulateCraft(G.inventory,'recipe_stick').reason"),
      'missing_ingredients',
    );
  },
);

test(
  [51, 52, 53, 60, 68],
  'collecting a real tree, crafting sticks and reloading preserves the exact transformation',
  () => {
    setup();
    breakResource(tree, 3);
    approachDrop(tree);
    assert.equal(totals(runGame('G.inventory')).wood, 3);
    runGame('setCraftingOpen(true)');
    assert.equal(runGame("performCraft('recipe_stick',1).ok"), true);
    const before = json(runGame('serializeInventory(G.inventory)'));
    const saved = saveAndRestore();
    assert.equal(saved.v, 4);
    assert.equal(saved.gv, 2);
    assert.equal(saved.collection.materials, undefined);
    equal(runGame('serializeInventory(G.inventory)'), before);
    assert.equal(totals(runGame('G.inventory')).wood, 2);
    assert.equal(totals(runGame('G.inventory')).stick, 2);
    assert.equal(runGame(`G.w.ob[${tree}]`), 0);
  },
);

test(
  [7, 8, 9, 10, 11, 51, 52, 53],
  'the complete provisional production chain survives a real save and reload',
  () => {
    setup();
    runGame(
      "addItems(G.inventory,'wood',3);addItems(G.inventory,'stone',1);addItems(G.inventory,'ore',7);setCraftingOpen(true)",
    );
    for (const id of Object.keys(expectedRecipes))
      assert.equal(runGame(`performCraft(${JSON.stringify(id)},1).ok`), true, id);
    const expected = emptyTotals();
    expected.plank = 1;
    expected.primitive_component = 1;
    expected.ore = 7;
    assert.deepEqual(totals(runGame('G.inventory')), expected);
    saveAndRestore();
    assert.deepEqual(totals(runGame('G.inventory')), expected);
    invariant(runGame('G.inventory'));
  },
);

test(
  [54, 55],
  'two world identities with the same seed retain independent crafted products',
  () => {
    setup('craft-world-A');
    runGame("addItems(G.inventory,'wood',3);setCraftingOpen(true);performCraft('recipe_stick',1)");
    const a = saveAndRestore('craft-world-A');
    setup('craft-world-B');
    runGame(
      "addItems(G.inventory,'stone',4);setCraftingOpen(true);performCraft('recipe_chipped_stone',2)",
    );
    const b = saveAndRestore('craft-world-B');
    setup('craft-world-A', a);
    assert.equal(totals(runGame('G.inventory')).stick, 2);
    assert.equal(totals(runGame('G.inventory')).chipped_stone, 0);
    setup('craft-world-B', b);
    assert.equal(totals(runGame('G.inventory')).chipped_stone, 4);
    assert.equal(totals(runGame('G.inventory')).stick, 0);
    assert.equal(runGame('G.w.seed'), 'fixture-same-seed');
  },
);

test(
  [56],
  'a v0.4 save preserves all sixteen positions, cursor, hotbar selection and original quantities',
  () => {
    const slots = Array(16).fill(null);
    slots[0] = { itemId: 'wood', quantity: 200 };
    slots[9] = { itemId: 'stone', quantity: 12 };
    slots[15] = { itemId: 'ore', quantity: 3 };
    const saved = {
      v: 4,
      gv: 2,
      id: 'old-04',
      x: 352,
      y: 346,
      boat: 0,
      exp: Buffer.alloc(128).toString('base64'),
      collection: { removed: [tree], damage: [], drops: [] },
      inventory: {
        slots,
        selected: 8,
        cursor: { itemId: 'wood', quantity: 5 },
        pending: { wood: 0, stone: 0, ore: 0 },
        migrationVersion: 1,
      },
    };
    storageValues.set('origens_w_old-04', JSON.stringify(saved));
    setup('old-04', saved);
    equal(runGame('G.inventory.slots'), slots);
    assert.equal(runGame('G.inventory.selected'), 8);
    equal(runGame('G.inventory.cursor'), { itemId: 'wood', quantity: 5 });
    assert.equal(runGame('inventoryOpen'), true);
    assert.equal(runGame(`G.w.ob[${tree}]`), 0);
    invariant(runGame('G.inventory'));
  },
);

test(
  [57, 51, 52, 53],
  'v0.3 migration happens once even after crafting and repeated current-schema reloads',
  () => {
    const legacy = {
      v: 3,
      gv: 2,
      id: 'old-03',
      x: 352,
      y: 346,
      boat: 0,
      exp: Buffer.alloc(128).toString('base64'),
      collection: {
        removed: [],
        damage: [],
        drops: [],
        materials: { wood: 230, stone: 65, ore: 3 },
      },
    };
    const raw = JSON.stringify(legacy);
    storageValues.set('origens_w_old-03', raw);
    setup('old-03', legacy);
    runGame("setCraftingOpen(true);performCraft('recipe_stick',5)");
    const saved = saveAndRestore('old-03');
    assert.equal(storageValues.get('origens_w_old-03_backup_v3'), raw);
    assert.equal(saved.inventory.migrationVersion, 1);
    for (let n = 0; n < 3; n++) {
      setup('old-03', saved);
      assert.equal(totals(runGame('G.inventory')).wood, 225);
      assert.equal(totals(runGame('G.inventory')).stick, 10);
    }
  },
);

test(
  [56, 58],
  'the first v0.5 write preserves the original valid v0.4 save in a stable backup',
  () => {
    const slots = Array(16).fill(null);
    slots[3] = { itemId: 'wood', quantity: 4 };
    const saved = {
      v: 4,
      gv: 2,
      id: 'backup-04',
      x: 352,
      y: 346,
      boat: 0,
      exp: Buffer.alloc(128).toString('base64'),
      collection: { removed: [], damage: [], drops: [] },
      inventory: {
        slots,
        selected: 3,
        cursor: null,
        pending: { wood: 0, stone: 0, ore: 0 },
        migrationVersion: 1,
      },
    };
    const raw = JSON.stringify(saved);
    storageValues.set('origens_w_backup-04', raw);
    setup('backup-04', saved);
    runGame("setCraftingOpen(true);performCraft('recipe_stick',1)");
    assert.equal(runGame('save(1)'), 1);
    assert.equal(storageValues.get('origens_w_backup-04_backup_v4'), raw);
    runGame("performCraft('recipe_stick',1)");
    assert.equal(runGame('save(1)'), 1);
    assert.equal(storageValues.get('origens_w_backup-04_backup_v4'), raw);
  },
);

test(
  [56, 58],
  'a partially recoverable malformed v4 inventory cannot overwrite its intact original storage record',
  () => {
    const saved = {
      v: 4,
      gv: 2,
      id: 'protected-04',
      x: 352,
      y: 346,
      boat: 0,
      exp: Buffer.alloc(128).toString('base64'),
      collection: { removed: [tree], damage: [], drops: [] },
      inventory: {
        slots: [
          { itemId: 'wood', quantity: 4 },
          { itemId: 'unknown_future', quantity: 9 },
        ],
        selected: 0,
        cursor: null,
        pending: { wood: 0, stone: 0, ore: 0 },
        migrationVersion: 1,
      },
    };
    const raw = JSON.stringify(saved);
    storageValues.set('origens_w_protected-04', raw);
    setup('protected-04', saved);
    assert.equal(totals(runGame('G.inventory')).wood, 4);
    assert.equal(runGame('G.saveProtected'), true);
    assert.equal(runGame(`G.w.ob[${tree}]`), 0);
    assert.equal(runGame('save(1)'), 0);
    assert.equal(runGame('G.unsavedChanges'), true);
    assert.equal(runGame('G.lastSaveFailed'), true);
    assert.equal(storageValues.get('origens_w_protected-04'), raw);
  },
);

test(
  [58, 51, 52, 53],
  'failed persistence preserves a completed in-memory craft and reports unsaved changes until retry',
  () => {
    setup('save-failure');
    runGame("addItems(G.inventory,'wood',2)");
    assert.equal(runGame('save(1)'), 1);
    const previous = storageValues.get('origens_w_save-failure');
    storageFails = true;
    try {
      runGame('setCraftingOpen(true)');
      assert.equal(runGame("performCraft('recipe_stick',1).ok"), true);
      assert.equal(totals(runGame('G.inventory')).wood, 1);
      assert.equal(totals(runGame('G.inventory')).stick, 2);
      assert.equal(runGame('G.unsavedChanges'), true);
      now += 700;
      runGame('update(.016)');
      assert.equal(runGame('G.lastSaveFailed'), true);
      assert.equal(storageValues.get('origens_w_save-failure'), previous);
    } finally {
      storageFails = false;
    }
    assert.equal(runGame('save(1)'), 1);
    assert.equal(runGame('G.unsavedChanges'), false);
    assert.equal(runGame('G.lastSaveFailed'), false);
    const saved = JSON.parse(storageValues.get('origens_w_save-failure'));
    setup('save-failure', saved);
    assert.equal(totals(runGame('G.inventory')).wood, 1);
    assert.equal(totals(runGame('G.inventory')).stick, 2);
  },
);

for (const [criterion, index, hp, kind, quantity] of [
  [60, tree, 3, 'wood', 3],
  [61, stone, 4, 'stone', 2],
  [62, ore, 5, 'ore', 1],
]) {
  test(
    [criterion],
    'existing ' + kind + ' extraction and pickup still work after opening and closing crafting',
    () => {
      setup();
      runGame('setCraftingOpen(true);setCraftingOpen(false)');
      breakResource(index, hp);
      approachDrop(index);
      assert.equal(totals(runGame('G.inventory'))[kind], quantity);
      assert.equal(runGame('G.collection.drops.size'), 0);
    },
  );
}

test(
  [63, 68],
  'crafting neither consumes an uncollected drop nor removes a full-inventory drop on reload',
  () => {
    setup();
    runGame("addItems(G.inventory,'ore',3200)");
    breakResource(tree, 3);
    approachDrop(tree);
    assert.equal(runGame(`G.collection.drops.get('drop-${tree}').amount`), 3);
    runGame('setCraftingOpen(true)');
    assert.equal(runGame("performCraft('recipe_stick',1).ok"), false);
    assert.equal(runGame(`G.collection.drops.get('drop-${tree}').amount`), 3);
    saveAndRestore();
    assert.equal(runGame(`G.collection.drops.get('drop-${tree}').amount`), 3);
    assert.equal(runGame(`G.w.ob[${tree}]`), 0);
  },
);

test(
  [66, 67],
  'nine existing numeric shortcuts keep referencing the original sixteen storage slots',
  () => {
    setup();
    runGame(
      "addItems(G.inventory,'wood',2);setCraftingOpen(true);performCraft('recipe_stick',1);setCraftingOpen(false)",
    );
    const before = totals(runGame('G.inventory'));
    for (let n = 1; n <= 9; n++) {
      event('keydown', { key: String(n) });
      assert.equal(runGame('G.inventory.selected'), n - 1);
      assert.deepEqual(totals(runGame('G.inventory')), before);
    }
    invariant(runGame('G.inventory'));
  },
);

test(
  [69],
  'crafting leaves the procedural generator unchanged and the same seed yields identical world arrays',
  () => {
    const previous = fs.readFileSync(path.join(root, 'ORIGENS — Survival v0.4.html'), 'utf8');
    const generator = (text) =>
      text.slice(text.indexOf('// ===== SeededRandom'), text.indexOf('// ===== Arte pixel'));
    assert.equal(generator(source), generator(previous));
    const result = runGame(
      `(()=>{const make=()=>{const it=gen('t','TEST-128-0',128);let r;while(!(r=it.next()).done);return r.value};const a=make(),b=make();return{ok:a.ok&&b.ok,equal:a.ter.every((v,i)=>v===b.ter[i]&&a.ob[i]===b.ob[i])}})()`,
    );
    assert.equal(result.ok, true);
    assert.equal(result.equal, true);
  },
);

console.log(`\n${passed} crafting/model integration groups passed.`);
console.log('v0.5 acceptance criteria exercised: ' + [...covered].sort((a, b) => a - b).join(', '));
console.log(
  'Actual DOM details, real browser input, screenshots and browser console are checked separately by Playwright.',
);
