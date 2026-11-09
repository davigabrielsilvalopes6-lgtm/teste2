#!/usr/bin/env node
'use strict';

// Exercise the models shipped in the user's v0.7 HTML, without replacing their
// inventory, recipe, migration or save-validation functions. Browser delivery
// and rendering belong to the Playwright suite.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const file = path.resolve(__dirname, '..', 'ORIGENS — Survival v0.7.html');
const source = fs.readFileSync(file, 'utf8');
const script = source.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'the delivered game has an embedded script');
function block(start, end) {
  const first = script.indexOf(start);
  const last = script.indexOf(end, first);
  assert.ok(first >= 0 && last > first, 'actual game section: ' + start);
  return script.slice(first, last + end.length);
}
const inventory = block(
  '// ===== Inventário v0.4: modelo =====',
  '// ===== Fim do modelo de inventário =====',
);
const crafting = block(
  '// ===== Crafting v0.5: modelo =====',
  '// ===== Fim do modelo de crafting =====',
);
const safeStart = script.indexOf('function safeSavedInventory(');
const safeEnd = script.indexOf('\nfunction save(q)', safeStart);
assert.ok(safeStart >= 0 && safeEnd > safeStart, 'actual saved-inventory validator');
const realm = vm.createContext({ console });
vm.runInContext(inventory + '\n' + crafting + '\n' + script.slice(safeStart, safeEnd), realm, {
  filename: file + ':backpack-model',
});
const run = (code) => vm.runInContext(code, realm, { timeout: 10000 });
const json = (value) => JSON.parse(JSON.stringify(value));
const equal = (value, expected) => assert.deepEqual(json(value), expected);
const fresh = (extra = '') => run('globalThis.inv=createInventory();' + extra);
const snapshot = () => json(run('inv'));
let passed = 0;
function test(name, callback) {
  callback();
  passed++;
  console.log('PASS ' + name);
}
function reject(expression, reason) {
  const before = snapshot();
  const result = run(expression);
  assert.equal(result.ok, false);
  if (reason) assert.equal(result.reason, reason);
  equal(run('inv'), before);
}
function assertInventory(value) {
  const limits = [16, 24, 32];
  assert.equal(value.slots.length, limits[value.backpackTier]);
  assert.ok(Number.isInteger(value.selected) && value.selected >= 0 && value.selected < 9);
  assert.equal(value.hotbar, undefined, 'the hotbar has no extra storage');
  const references = new Set();
  const catalog = run('ITEM_TYPES');
  for (const stack of [...value.slots, value.cursor]) {
    if (stack === null) continue;
    assert.ok(Object.hasOwn(catalog, stack.itemId));
    assert.ok(Number.isSafeInteger(stack.quantity) && stack.quantity > 0);
    assert.ok(stack.quantity <= catalog[stack.itemId].maxStack);
    assert.equal(references.has(stack), false, 'live stacks are independent objects');
    references.add(stack);
  }
  for (const amount of Object.values(value.pending))
    assert.ok(Number.isSafeInteger(amount) && amount >= 0);
}
function upgrade(tier) {
  for (let level = run('inventoryTier(inv)') + 1; level <= tier; level++) {
    const itemId = level === 1 ? 'rustic_backpack' : 'reinforced_backpack';
    run(`addItems(inv,${JSON.stringify(itemId)},1)`);
    const index = run(`inv.slots.findIndex(s=>s&&s.itemId===${JSON.stringify(itemId)})`);
    assert.equal(run(`useBackpack(inv,${index}).ok`), true);
  }
}

test('initial16, rustic24 and reinforced32 capacities are independently configured', () => {
  equal(run('Object.values(BACKPACK_TIERS).map(t=>[t.capacity,t.columns])'), [
    [16, 4],
    [24, 6],
    [32, 8],
  ]);
  fresh();
  assert.equal(run('inv.slots.length'), 16);
  assert.equal(run('inv.backpackTier'), 0);
  assert.equal(run('HOTBAR_SIZE'), 9);
  for (const id of ['rustic_backpack', 'reinforced_backpack']) {
    assert.equal(run(`ITEM_TYPES.${id}.maxStack`), 1);
    assert.equal(run(`ITEM_TYPES.${id}.category`), 'backpack');
  }
  assertInventory(run('inv'));
});

const recipes = {
  recipe_rustic_backpack: {
    ingredients: { plank: 12, stick: 16, simple_handle: 3 },
    output: 'rustic_backpack',
    tier: 0,
  },
  recipe_reinforced_backpack: {
    ingredients: { plank: 20, primitive_component: 10, ore: 8 },
    output: 'reinforced_backpack',
    tier: 1,
  },
};
test('both backpack recipes use existing material IDs and explicit progression requirements', () => {
  for (const [id, expected] of Object.entries(recipes)) {
    const recipe = run(`CRAFT_RECIPES[${JSON.stringify(id)}]`);
    equal(
      Object.fromEntries(recipe.ingredients.map((part) => [part.itemId, part.quantity])),
      expected.ingredients,
    );
    equal(recipe.output, { itemId: expected.output, quantity: 1 });
    assert.equal(recipe.requiresTier, expected.tier);
    assert.equal(recipe.category, 'backpacks');
  }
});

for (const [id, expected] of Object.entries(recipes)) {
  test(
    id + ' consumes exact ingredients and produces a bag without expanding automatically',
    () => {
      fresh();
      upgrade(expected.tier);
      for (const [itemId, quantity] of Object.entries(expected.ingredients))
        run(`addItems(inv,${JSON.stringify(itemId)},${quantity + 2})`);
      run("addItems(inv,'wood',37);addItems(inv,'stone_pickaxe',1)");
      const capacity = run('inv.slots.length');
      const before = run('inventoryTotals(inv)');
      assert.equal(run(`executeCraft(inv,${JSON.stringify(id)}).ok`), true);
      const after = run('inventoryTotals(inv)');
      for (const itemId of Object.keys(before)) {
        const desired =
          before[itemId] - (expected.ingredients[itemId] || 0) + Number(itemId === expected.output);
        assert.equal(after[itemId], desired, itemId);
      }
      assert.equal(run('inv.slots.length'), capacity);
      assert.equal(run('inv.backpackTier'), expected.tier);
      assertInventory(run('inv'));
    },
  );

  test(id + ' rejects each missing ingredient without touching other slots or metadata', () => {
    for (const absent of Object.keys(expected.ingredients)) {
      fresh();
      upgrade(expected.tier);
      for (const [itemId, quantity] of Object.entries(expected.ingredients))
        if (itemId !== absent) run(`addItems(inv,${JSON.stringify(itemId)},${quantity})`);
      run('inv.selected=8');
      reject(`executeCraft(inv,${JSON.stringify(id)})`, 'missing_ingredients');
    }
  });
}

test('reinforced crafting requires rustic capacity; unlocked backpack recipes cannot be repeated', () => {
  fresh(
    "addItems(inv,'plank',200);addItems(inv,'primitive_component',200);addItems(inv,'ore',200)",
  );
  reject("executeCraft(inv,'recipe_reinforced_backpack')", 'requirement');
  assert.equal(run("getMaxCraftable(inv,'recipe_reinforced_backpack')"), 0);
  upgrade(1);
  reject("executeCraft(inv,'recipe_rustic_backpack')", 'requirement');
  upgrade(2);
  reject("executeCraft(inv,'recipe_reinforced_backpack')", 'requirement');
});

test('crafting five rustic bags uses five distinct slots and leaves capacity unchanged', () => {
  fresh("addItems(inv,'plank',60);addItems(inv,'stick',80);addItems(inv,'simple_handle',15)");
  assert.equal(run("executeCraft(inv,'recipe_rustic_backpack',5).ok"), true);
  assert.equal(run("inv.slots.filter(s=>s&&s.itemId==='rustic_backpack').length"), 5);
  assert.equal(run('inv.slots.length'), 16);
  assertInventory(run('inv'));
});

test('full-inventory crafting fails atomically until consumption frees a real result slot', () => {
  fresh(`inv.slots=Array.from({length:16},()=>({itemId:'stone',quantity:200}));
    inv.slots[0]={itemId:'plank',quantity:13};
    inv.slots[1]={itemId:'stick',quantity:17};
    inv.slots[2]={itemId:'simple_handle',quantity:4};`);
  reject("executeCraft(inv,'recipe_rustic_backpack')", 'no_space');
  run('inv.slots[2].quantity=3');
  assert.equal(run("executeCraft(inv,'recipe_rustic_backpack').ok"), true);
  equal(run('inv.slots[2]'), { itemId: 'rustic_backpack', quantity: 1 });
  assert.equal(run('inv.slots[0].quantity'), 1);
  assert.equal(run('inv.slots[1].quantity'), 1);
  assertInventory(run('inv'));
});

test('insufficient space rejects the entire five-bag batch', () => {
  fresh(`inv.slots=Array.from({length:16},()=>({itemId:'stone',quantity:200}));
    inv.slots[0]={itemId:'plank',quantity:60};
    inv.slots[1]={itemId:'stick',quantity:80};
    inv.slots[2]={itemId:'simple_handle',quantity:15};`);
  reject("executeCraft(inv,'recipe_rustic_backpack',5)", 'no_space');
  assert.equal(run('inventoryTotals(inv).rustic_backpack'), 0);
});

test('backpack use requires the next tier and consumes exactly one stored bag', () => {
  fresh("addItems(inv,'reinforced_backpack',1);addItems(inv,'rustic_backpack',2)");
  reject('useBackpack(inv,0)', 'needs_previous');
  assert.equal(run('useBackpack(inv,1).ok'), true);
  assert.equal(run('inventoryTotals(inv).rustic_backpack'), 1);
  reject('useBackpack(inv,2)', 'already_unlocked');
  assert.equal(run('useBackpack(inv,0).ok'), true);
  assert.equal(run('inventoryTotals(inv).reinforced_backpack'), 0);
  assert.equal(run('inv.slots.length'), 32);
  assertInventory(run('inv'));
});

test('full inventory can expand and all existing positions, cursor and hotbar selection survive', () => {
  fresh(`inv.slots=Array.from({length:16},(_,i)=>({itemId:i%2?'stone':'wood',quantity:i+1}));
    inv.slots[11]={itemId:'rustic_backpack',quantity:1};
    inv.selected=7;inv.cursor={itemId:'stone_pickaxe',quantity:1};`);
  const before = snapshot();
  assert.equal(run('useBackpack(inv,11).ok'), true);
  const after = snapshot();
  assert.equal(after.slots.length, 24);
  before.slots.forEach((stack, i) => equal(after.slots[i], i === 11 ? null : stack));
  equal(after.slots.slice(16), Array(8).fill(null));
  equal(after.cursor, before.cursor);
  assert.equal(after.selected, before.selected);
  assertInventory(run('inv'));
});

test('a bag in the cursor is not consumed or usable as an equipment slot', () => {
  fresh("addItems(inv,'rustic_backpack',1);inventorySlotClick(inv,0,0)");
  reject('useBackpack(inv,0)', 'empty_slot');
  equal(run('inv.cursor'), { itemId: 'rustic_backpack', quantity: 1 });
  assert.equal(run('returnInventoryCursor(inv)'), true);
  assert.equal(run('useBackpack(inv,0).ok'), true);
  assert.equal(run('inv.cursor'), null);
});

test('invalid indices and materials fail without consuming items', () => {
  fresh("addItems(inv,'wood',100)");
  for (const index of [-1, 16, 1.5, '0'])
    reject(`useBackpack(inv,${JSON.stringify(index)})`, 'invalid_slot');
  reject('useBackpack(inv,0)', 'not_backpack');
  reject('useBackpack(inv,1)', 'empty_slot');
});

test('expanded slot31 participates in crafting before linked hotbar ingredients', () => {
  fresh();
  upgrade(2);
  run(
    "inv.slots[0]={itemId:'wood',quantity:10};inv.slots[31]={itemId:'wood',quantity:2};inv.selected=8",
  );
  assert.equal(run("executeCraft(inv,'recipe_plank').ok"), true);
  equal(run('inv.slots[0]'), { itemId: 'wood', quantity: 10 });
  assert.equal(run('inv.slots[31]'), null);
  assert.equal(run('inventoryTotals(inv).plank'), 2);
  assert.equal(run('inv.selected'), 8);
  assert.equal(run('inv.slots.length'), 32);
  assertInventory(run('inv'));
});

test('expanded capacity accepts materials through the final slot and retains excess', () => {
  fresh();
  upgrade(2);
  assert.equal(run("addItems(inv,'wood',6409)"), 9);
  assert.equal(run('inventoryTotals(inv).wood'), 6400);
  equal(run('inv.slots[31]'), { itemId: 'wood', quantity: 200 });
  assert.equal(run("inventoryCapacity(inv,'wood')"), 0);
  assertInventory(run('inv'));
});

test('save round trips retain capacity, final slot, cursor, pending items and selection at every tier', () => {
  for (const tier of [0, 1, 2]) {
    fresh();
    upgrade(tier);
    run(`inv.slots[inv.slots.length-1]={itemId:'stone_pickaxe',quantity:1};
      inv.cursor={itemId:'wood',quantity:137};inv.selected=8;inv.pending.ore=15`);
    const serialized = json(run('serializeInventory(inv)'));
    assert.equal(run('safeSavedInventory(serializeInventory(inv))'), true);
    run('globalThis.restored=restoreInventory(' + JSON.stringify(serialized) + ')');
    equal(run('serializeInventory(restored)'), serialized);
    assert.equal(run('restored.slots[restored.slots.length-1].itemId'), 'stone_pickaxe');
    assertInventory(run('restored'));
  }
});

test('old16-slot saves without capacity or newly added pending IDs remain valid', () => {
  fresh(`addItems(inv,'wood',27);addItems(inv,'primitive_component',3);
    delete inv.backpackTier;
    for(const id of ['stone_axe','stone_pickaxe','rustic_backpack','reinforced_backpack'])delete inv.pending[id];
    inv.selected=6`);
  assert.equal(run('safeSavedInventory(inv)'), true);
  const original = snapshot();
  run('globalThis.restored=restoreInventory(inv)');
  assert.equal(run('restored.backpackTier'), 0);
  assert.equal(run('restored.slots.length'), 16);
  equal(run('restored.slots'), original.slots);
  assert.equal(run('restored.selected'), 6);
  equal(run('inv'), original, 'loading does not mutate saved data');
  assertInventory(run('restored'));
});

test('legacy resource counters migrate once without inventing backpacks or tools', () => {
  run('globalThis.inv=restoreInventory(null,{wood:350,stone:17,ore:9})');
  assert.equal(run('inv.slots.length'), 16);
  equal(run('inventoryTotals(inv)'), {
    wood: 350,
    stone: 17,
    ore: 9,
    stick: 0,
    plank: 0,
    chipped_stone: 0,
    simple_handle: 0,
    primitive_component: 0,
    stone_axe: 0,
    stone_pickaxe: 0,
    rustic_backpack: 0,
    reinforced_backpack: 0,
  });
  const saved = json(run('serializeInventory(inv)'));
  equal(run('serializeInventory(restoreInventory(' + JSON.stringify(saved) + '))'), saved);
});

test('unknown slot or pending IDs protect the original while valid neighbors recover', () => {
  for (const corrupted of [
    "inv.slots[2]={itemId:'future_item',quantity:1}",
    'inv.pending.future_item=8',
  ]) {
    fresh("addItems(inv,'wood',77);addItems(inv,'stone_axe',1);" + corrupted);
    assert.equal(run('safeSavedInventory(inv)'), false);
    const original = snapshot();
    run('globalThis.restored=restoreInventory(inv)');
    assert.equal(run('inventoryTotals(restored).wood'), 77);
    assert.equal(run('inventoryTotals(restored).stone_axe'), 1);
    assert.equal(run('restored.slots.length'), 16);
    equal(run('inv'), original);
    assertInventory(run('restored'));
  }
});

test('occupied positions beyond declared capacity recover without silently validating bad saves', () => {
  fresh("inv.slots[31]={itemId:'stone_pickaxe',quantity:1}");
  assert.equal(run('safeSavedInventory(inv)'), false);
  const original = snapshot();
  run('globalThis.restored=restoreInventory(inv)');
  assert.equal(run('restored.backpackTier'), 2);
  assert.equal(run('restored.slots.length'), 32);
  equal(run('restored.slots[31]'), { itemId: 'stone_pickaxe', quantity: 1 });
  equal(run('inv'), original);
  assertInventory(run('restored'));
});

test('separately restored worlds share neither capacity nor item objects', () => {
  fresh();
  upgrade(2);
  run("addItems(inv,'wood',42);inv.slots[31]={itemId:'stone_pickaxe',quantity:1}");
  const saved = json(run('serializeInventory(inv)'));
  run(
    'globalThis.worldA=restoreInventory(' +
      JSON.stringify(saved) +
      ');globalThis.worldB=createInventory()',
  );
  run("addItems(worldB,'wood',5);worldA.slots[0].quantity=41");
  assert.equal(run('worldA.slots.length'), 32);
  assert.equal(run('worldB.slots.length'), 16);
  assert.equal(run('inventoryTotals(worldB).wood'), 5);
  assert.equal(saved.slots[0].quantity, 42);
  assert.equal(run('inv.slots[0].quantity'), 42);
  assert.equal(run("worldB.slots.some(s=>s&&s.itemId==='stone_pickaxe')"), false);
});

test('9000 actual operations preserve an independent material ledger across all capacities', () => {
  const catalog = json(run('ITEM_TYPES'));
  const itemIds = Object.keys(catalog);
  const materialLedger = Object.fromEntries(itemIds.map((id) => [id, 0]));
  const operations = { insert: 0, click: 0, return: 0, craft: 0, upgrade: 0, reload: 0 };
  const expectedRecipes = {
    recipe_stick: { ingredients: { wood: 1 }, output: ['stick', 2] },
    recipe_plank: { ingredients: { wood: 2 }, output: ['plank', 2] },
    recipe_chipped_stone: { ingredients: { stone: 1 }, output: ['chipped_stone', 2] },
    ...Object.fromEntries(
      Object.entries(recipes).map(([id, recipe]) => [
        id,
        { ingredients: recipe.ingredients, output: [recipe.output, 1] },
      ]),
    ),
  };
  let seed = 37;
  const next = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return seed >>> 0;
  };
  fresh();
  // Begin with a naturally reachable assortment, including two stored bags.
  // The first three actions guarantee real expansions and an accepted craft;
  // subsequent seeded actions explore both accepted and rejected operations.
  for (const [itemId, quantity] of Object.entries({
    wood: 20,
    stone: 20,
    plank: 60,
    stick: 80,
    simple_handle: 15,
    primitive_component: 20,
    ore: 20,
    rustic_backpack: 1,
    reinforced_backpack: 1,
  })) {
    assert.equal(run(`addItems(inv,${JSON.stringify(itemId)},${quantity})`), 0);
    materialLedger[itemId] = quantity;
  }
  for (let step = 0; step < 9000; step++) {
    const action = step < 2 ? 4 : step === 2 ? 3 : next() % 6;
    const before = snapshot();
    if (action === 0) {
      const itemId = itemIds[next() % itemIds.length];
      const quantity = 1 + (next() % 280);
      const remainder = run(`addItems(inv,${JSON.stringify(itemId)},${quantity})`);
      materialLedger[itemId] += quantity - remainder;
      operations.insert++;
    } else if (action === 1) {
      const index = next() % before.slots.length;
      run(`inventorySlotClick(inv,${index},${next() & 1 ? 0 : 2})`);
      operations.click++;
    } else if (action === 2) {
      run('returnInventoryCursor(inv)');
      operations.return++;
    } else if (action === 3) {
      const recipeId = step === 2 ? 'recipe_stick' : Object.keys(expectedRecipes)[next() % 5];
      const result = run(`executeCraft(inv,${JSON.stringify(recipeId)},1)`);
      if (result.ok) {
        const recipe = expectedRecipes[recipeId];
        for (const [itemId, quantity] of Object.entries(recipe.ingredients))
          materialLedger[itemId] -= quantity;
        materialLedger[recipe.output[0]] += recipe.output[1];
        operations.craft++;
      } else equal(run('inv'), before, 'rejected crafting leaves the entire state untouched');
    } else if (action === 4) {
      const index = before.slots.findIndex(
        (stack) => stack && catalog[stack.itemId].category === 'backpack',
      );
      const result = run(`useBackpack(inv,${index})`);
      if (result.ok) {
        materialLedger[before.slots[index].itemId]--;
        operations.upgrade++;
      } else equal(run('inv'), before, 'rejected upgrades preserve state');
    } else {
      run('inv=restoreInventory(JSON.parse(JSON.stringify(serializeInventory(inv))))');
      operations.reload++;
    }
    assertInventory(run('inv'));
    const actual = Object.fromEntries(itemIds.map((id) => [id, 0]));
    for (const stack of [...run('inv.slots'), run('inv.cursor')])
      if (stack) actual[stack.itemId] += stack.quantity;
    for (const [id, count] of Object.entries(run('inv.pending'))) actual[id] += count;
    assert.deepEqual(actual, materialLedger, 'conservation after operation ' + step);
    for (const count of Object.values(materialLedger)) assert.ok(count >= 0);
  }
  for (const [kind, count] of Object.entries(operations))
    assert.ok(count > 0, 'the deterministic workload actually performed ' + kind);
  assert.equal(run('inv.backpackTier'), 2, 'both expansions occurred during the workload');
});

console.log(passed + ' backpack regression groups passed');
