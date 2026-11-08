const { test, expect, openMenu, createWorld, movePlayer } = require('./fixtures');

// Setup fixtures supply materials or move beside actual generated resources.
// Crafting, extraction and inventory interactions use the existing game UI;
// no production handler, rendering function or clock is replaced.
const itemIds = [
  'wood',
  'stone',
  'ore',
  'stick',
  'plank',
  'chipped_stone',
  'simple_handle',
  'primitive_component',
];
const recipe = (page, id) => page.locator(`#crafting-recipes [data-recipe="recipe_${id}"]`);
const slot = (page, index) => page.locator(`#inventory-grid [data-slot="${index}"]`);

async function frames(page, count = 3) {
  await page.evaluate(
    (count) =>
      new Promise((resolve) => {
        const next = () => (--count <= 0 ? resolve() : requestAnimationFrame(next));
        requestAnimationFrame(next);
      }),
    count,
  );
}

async function seedMaterials(page, entries) {
  await page.evaluate((entries) => {
    for (const [id, amount] of entries) {
      if (addItems(G.inventory, id, amount) !== 0) throw new Error('Material fixture does not fit');
    }
    inventoryChanged();
  }, entries);
}

async function setSlots(page, slots) {
  expect(slots).toHaveLength(16);
  await page.evaluate((slots) => {
    G.inventory.slots = slots;
    G.inventory.cursor = null;
    inventoryChanged();
  }, slots);
}

async function state(page) {
  return page.evaluate(() => ({
    slots: G.inventory.slots,
    cursor: G.inventory.cursor,
    selected: G.inventory.selected,
    pending: G.inventory.pending,
  }));
}

// Independent quantities: do not use the crafting engine's own material counter
// to prove that the same engine consumed and produced the correct amounts.
async function balance(page) {
  return page.evaluate((ids) => {
    const totals = Object.fromEntries(ids.map((id) => [id, 0]));
    for (const stack of [...G.inventory.slots, G.inventory.cursor]) {
      if (stack) totals[stack.itemId] += stack.quantity;
    }
    for (const id of ids) totals[id] += G.inventory.pending[id] || 0;
    return totals;
  }, itemIds);
}

function quantities(entries = {}) {
  return Object.fromEntries(itemIds.map((id) => [id, entries[id] || 0]));
}

async function openCrafting(page) {
  await page.keyboard.press('c');
  await expect(page.locator('#crafting-panel')).toBeVisible();
  expect(await page.evaluate(() => craftingOpen)).toBe(true);
  await expect(page.locator('#inventory-overlay')).toBeHidden();
}

async function closeCrafting(page) {
  await page.locator('#crafting-close').click();
  await expect(page.locator('#crafting-overlay')).toBeHidden();
  expect(await page.evaluate(() => craftingOpen)).toBe(false);
}

async function craft(page, id, mode = 'once') {
  await recipe(page, id).click();
  const action = page.locator(`#crafting-${mode}`);
  await expect(action).toBeEnabled();
  await action.click();
}

async function loadWorld(page, name) {
  await page
    .locator('#wl .r')
    .filter({ hasText: name })
    .getByRole('button', { name: 'Jogar', exact: true })
    .click();
  await expect(page.locator('#m')).toBeHidden();
  await expect.poll(() => page.evaluate(() => !!G && !busy && !!G.view)).toBe(true);
}

async function saveAndReload(page, name) {
  if (await page.evaluate(() => craftingOpen)) await closeCrafting(page);
  if (await page.evaluate(() => inventoryOpen)) await page.keyboard.press('i');
  await page.keyboard.press('Escape');
  await expect(page.locator('#m')).toBeVisible();
  await page.reload();
  await loadWorld(page, name);
}

async function besideResource(page, type) {
  const resource = await page.evaluate((type) => {
    const w = G.w;
    for (let index = 0; index < w.ob.length; index++) {
      if (w.ob[index] !== type) continue;
      const base = resourceBase(w, index);
      const target = { x: base.x, y: base.y - (type === 1 ? 71 : 10) };
      if (pickResource(target.x, target.y) !== index) continue;
      for (const [dx, dy] of [
        [-40, 0],
        [40, 0],
        [0, 40],
        [0, -40],
      ]) {
        G.px = base.x + dx;
        G.py = base.y + dy;
        if (blocked(w, G.px, G.py, 0) || !resourcePathClear(index)) continue;
        G.cx = G.px;
        G.cy = G.py;
        G.tx = Math.floor(G.px / T);
        G.ty = Math.floor(G.py / T);
        return {
          index,
          base,
          target,
          dx,
          dy,
          hp: RESOURCE_TYPES[type].hp,
          kind: RESOURCE_TYPES[type].kind,
          amount: RESOURCE_TYPES[type].amount,
        };
      }
    }
    throw new Error('No reachable generated resource: ' + type);
  }, type);
  await frames(page);
  return resource;
}

async function clickResource(page, resource) {
  const point = await page.evaluate(({ x, y }) => {
    const box = cv.getBoundingClientRect();
    return {
      x: box.left + ((x - G.view.ox) * G.view.z * box.width) / 960,
      y: box.top + ((y - G.view.oy) * G.view.z * box.height) / 540,
    };
  }, resource.target);
  await page.mouse.click(point.x, point.y);
}

async function collectResource(page, type) {
  const resource = await besideResource(page, type);
  for (let strike = 1; strike <= resource.hp; strike++) {
    await page.waitForTimeout(360); // Existing extraction cooldown is 350ms.
    await clickResource(page, resource);
    if (strike < resource.hp)
      expect(await page.evaluate((index) => G.collection.damage.get(index), resource.index)).toBe(
        strike,
      );
  }
  expect(await page.evaluate((index) => G.w.ob[index], resource.index)).toBe(0);
  expect(
    await page.evaluate((index) => G.collection.drops.has('drop-' + index), resource.index),
  ).toBe(true);
  const key = resource.dx < 0 ? 'd' : resource.dx > 0 ? 'a' : resource.dy < 0 ? 's' : 'w';
  await page.keyboard.down(key);
  try {
    await expect
      .poll(() => page.evaluate((index) => G.collection.drops.has('drop-' + index), resource.index))
      .toBe(false);
  } finally {
    await page.keyboard.up(key);
  }
  return resource;
}

test('[07,13-14,31,43,49,51-53,60,68,70] scenario 1: collect a real tree, craft, save and restore exact slots', async ({
  page,
}) => {
  await openMenu(page);
  await createWorld(page, 'Craft basic cycle');
  const tree = await collectResource(page, 1);
  await page.keyboard.press('i');
  await expect(page.locator('#inventory-panel')).toBeVisible();
  await expect(slot(page, 0)).toContainText(String(tree.amount));
  expect(await balance(page)).toEqual(quantities({ wood: tree.amount }));
  await openCrafting(page);
  await craft(page, 'stick');
  expect(await balance(page)).toEqual(quantities({ wood: tree.amount - 1, stick: 2 }));
  await closeCrafting(page);
  await expect(page.locator('#hotbar [data-hotbar="0"]')).toContainText(String(tree.amount - 1));
  await expect(page.locator('#hotbar [data-hotbar="1"] .item-icon')).toHaveAttribute(
    'data-item',
    'stick',
  );
  const crafted = await state(page);
  await saveAndReload(page, 'Craft basic cycle');
  expect(await state(page)).toEqual(crafted);
  expect(await page.evaluate((index) => G.w.ob[index], tree.index)).toBe(0);
  await saveAndReload(page, 'Craft basic cycle');
  expect(await state(page)).toEqual(crafted);
});

test('[07-14,25,50-53,70] scenario 2: the complete five-recipe chain conserves materials and survives reload', async ({
  page,
}) => {
  await openMenu(page);
  await createWorld(page, 'Craft chain');
  await seedMaterials(page, [
    ['wood', 10],
    ['stone', 3],
    ['ore', 7],
  ]);
  await openCrafting(page);
  await expect(page.locator('#crafting-recipes [data-recipe]')).toHaveCount(5);
  await craft(page, 'stick');
  await craft(page, 'plank');
  await craft(page, 'chipped_stone');
  await craft(page, 'simple_handle');
  await craft(page, 'primitive_component');
  const expected = quantities({ wood: 7, stone: 2, ore: 7, plank: 1, primitive_component: 1 });
  expect(await balance(page)).toEqual(expected);
  const finished = await state(page);
  expect(finished.cursor).toBeNull();
  expect(finished.slots).toHaveLength(16);
  await saveAndReload(page, 'Craft chain');
  expect(await state(page)).toEqual(finished);
  expect(await balance(page)).toEqual(expected);
});

test('[15-19,33,40-41,50,70] missing and freshly changed ingredients update selected recipes and reject stale requests', async ({
  page,
}) => {
  await openMenu(page);
  await createWorld(page, 'Craft availability');
  await openCrafting(page);
  await recipe(page, 'stick').click();
  await expect(page.locator('#crafting-once')).toBeDisabled();
  await expect(page.locator('#crafting-ingredients [data-ingredient="wood"]')).toHaveClass(
    /is-missing/,
  );
  await recipe(page, 'simple_handle').click();
  await expect(page.locator('#crafting-ingredients [data-ingredient="plank"]')).toHaveClass(
    /is-missing/,
  );
  await seedMaterials(page, [['stick', 2]]);
  await expect(page.locator('#crafting-once')).toBeDisabled();
  await expect(page.locator('#crafting-ingredients [data-ingredient="stick"]')).not.toHaveClass(
    /is-missing/,
  );
  await seedMaterials(page, [['plank', 1]]);
  await expect(page.locator('#crafting-once')).toBeEnabled();
  await expect(page.locator('#crafting-five')).toBeDisabled();
  await craft(page, 'simple_handle');
  expect(await balance(page)).toEqual(quantities({ simple_handle: 1 }));
  await expect(page.locator('#crafting-once')).toBeDisabled();
  // Distributed ingredients are counted across slots, including outside hotbar.
  const distributed = Array(16).fill(null);
  distributed[2] = { itemId: 'stick', quantity: 1 };
  distributed[12] = { itemId: 'stick', quantity: 1 };
  distributed[15] = { itemId: 'plank', quantity: 1 };
  await setSlots(page, distributed);
  await expect(page.locator('#crafting-once')).toBeEnabled();
  // A material fixture changes between paint and click; handlers must validate
  // current inventory instead of trusting a previously enabled UI button.
  const missing = await state(page);
  missing.slots[15] = null;
  await page.evaluate(() => {
    G.inventory.slots[15] = null;
    document
      .getElementById('crafting-once')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  expect(await state(page)).toEqual(missing);
  await expect(page.locator('#crafting-once')).toBeDisabled();
});

test('[20-30,34-35,67,70] scenario 3: full inventory rolls back completely, then consumed slots accept output', async ({
  page,
}) => {
  await openMenu(page);
  await createWorld(page, 'Craft capacity');
  const full = Array.from({ length: 16 }, () => ({ itemId: 'ore', quantity: 200 }));
  full[0] = { itemId: 'wood', quantity: 2 };
  await setSlots(page, full);
  await openCrafting(page);
  await recipe(page, 'stick').click();
  const before = await state(page);
  await expect(page.locator('#crafting-once')).toBeDisabled();
  await page.evaluate(() => performCraft('recipe_stick', 1));
  expect(await state(page)).toEqual(before);
  full[0] = { itemId: 'wood', quantity: 1 };
  await setSlots(page, full);
  await craft(page, 'stick');
  expect((await state(page)).slots[0]).toEqual({ itemId: 'stick', quantity: 2 });
  expect((await state(page)).slots).toHaveLength(16);
  // 199 + 2 must spill into the slot freed by consuming the last wood.
  full[0] = { itemId: 'wood', quantity: 1 };
  full[1] = { itemId: 'stick', quantity: 199 };
  await setSlots(page, full);
  await craft(page, 'stick');
  let after = await state(page);
  expect(after.slots[1]).toEqual({ itemId: 'stick', quantity: 200 });
  expect(after.slots[0]).toEqual({ itemId: 'stick', quantity: 1 });
  expect(after.slots.every((stack) => stack.quantity <= 200)).toBe(true);
  // 198 + 2 exactly fills an existing stack even if consuming wood frees none.
  full[0] = { itemId: 'wood', quantity: 2 };
  full[1] = { itemId: 'stick', quantity: 198 };
  await setSlots(page, full);
  await craft(page, 'stick');
  expect((await state(page)).slots[1].quantity).toBe(200);
  // A five-craft request cannot partially apply just because one result fits.
  full[0] = { itemId: 'wood', quantity: 6 };
  full[1] = { itemId: 'stick', quantity: 199 };
  await setSlots(page, full);
  const rejectedBatch = await state(page);
  await page.evaluate(() => performCraft('recipe_stick', 5));
  expect(await state(page)).toEqual(rejectedBatch);
  await closeCrafting(page);
  await page.keyboard.press('i');
  await expect(page.locator('#inventory-grid [data-slot]')).toHaveCount(16);
  await expect(page.locator('#hotbar [data-hotbar]')).toHaveCount(9);
});

test('[31-39,41-42,70] once, five, maximum and consecutive click events use current quantities atomically', async ({
  page,
}) => {
  await openMenu(page);
  await createWorld(page, 'Craft batches');
  await seedMaterials(page, [['wood', 1]]);
  await openCrafting(page);
  await recipe(page, 'stick').click();
  await page.locator('#crafting-once').evaluate((button) => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  expect(await balance(page)).toEqual(quantities({ stick: 2 }));
  await seedMaterials(page, [['wood', 12]]);
  await craft(page, 'stick', 'five');
  expect(await balance(page)).toEqual(quantities({ wood: 7, stick: 12 }));
  await craft(page, 'stick', 'max');
  expect(await balance(page)).toEqual(quantities({ stick: 26 }));
  await expect(page.locator('#crafting-once')).toBeDisabled();
  await seedMaterials(page, [['wood', 4]]);
  const before = await state(page);
  await expect(page.locator('#crafting-five')).toBeDisabled();
  await page.evaluate(() => performCraft('recipe_stick', 5));
  expect(await state(page)).toEqual(before);
  await seedMaterials(page, [['wood', 100]]);
  // Fifty immediate DOM click events exercise one synchronous transaction each.
  await page.locator('#crafting-once').evaluate((button) => {
    for (let i = 0; i < 50; i++) button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  expect(await balance(page)).toEqual(quantities({ wood: 54, stick: 126 }));
  await craft(page, 'stick', 'max');
  expect(await balance(page)).toEqual(quantities({ stick: 234 }));
  expect((await state(page)).slots.filter(Boolean).every((stack) => stack.quantity <= 200)).toBe(
    true,
  );
  await recipe(page, 'plank').click(); // Interface responds after maximum crafting.
  await expect(page.locator('#crafting-once')).toBeDisabled();
  await closeCrafting(page);
});

test('[08,54-55,60,68-70] scenario 4: same-seed worlds retain independent crafted items and removals', async ({
  page,
}) => {
  await openMenu(page);
  const a = await createWorld(page, 'Craft World A');
  const terrain = await page.evaluate(() => Array.from(G.w.ter));
  const tree = await collectResource(page, 1);
  await openCrafting(page);
  await craft(page, 'plank');
  const inventoryA = await state(page);
  await closeCrafting(page);
  await page.keyboard.press('Escape');
  const b = await createWorld(page, 'Craft World B');
  expect(b.id).not.toBe(a.id);
  expect(await page.evaluate(() => Array.from(G.w.ter))).toEqual(terrain);
  expect(await page.evaluate((index) => G.w.ob[index], tree.index)).toBe(1);
  expect(await balance(page)).toEqual(quantities());
  await seedMaterials(page, [['wood', 1]]);
  await openCrafting(page);
  await craft(page, 'stick');
  const inventoryB = await state(page);
  await closeCrafting(page);
  await page.keyboard.press('Escape');
  await loadWorld(page, 'Craft World A');
  expect(await state(page)).toEqual(inventoryA);
  expect(await page.evaluate((index) => G.w.ob[index], tree.index)).toBe(0);
  await page.keyboard.press('Escape');
  await loadWorld(page, 'Craft World B');
  expect(await state(page)).toEqual(inventoryB);
  expect(await balance(page)).toEqual(quantities({ stick: 2 }));
});

test('[13-14,32,42,51-53,60-61,70] scenario 5: collect, craft repeatedly, split, move, merge, batch and reload', async ({
  page,
}) => {
  await openMenu(page);
  await createWorld(page, 'Craft repeated operations');
  await collectResource(page, 1);
  await collectResource(page, 2);
  await seedMaterials(page, [
    ['wood', 20],
    ['stone', 8],
    ['ore', 2],
  ]);
  expect(await balance(page)).toEqual(quantities({ wood: 23, stone: 10, ore: 2 }));
  await openCrafting(page);
  await craft(page, 'stick', 'five');
  await page.keyboard.press('i');
  await expect(page.locator('#inventory-panel')).toBeVisible();
  await slot(page, 3).click({ button: 'right' });
  expect((await state(page)).cursor).toEqual({ itemId: 'stick', quantity: 5 });
  await slot(page, 11).click();
  await slot(page, 3).click();
  await slot(page, 11).click();
  expect((await state(page)).cursor).toBeNull();
  expect((await state(page)).slots[11]).toEqual({ itemId: 'stick', quantity: 10 });
  expect(await balance(page)).toEqual(quantities({ wood: 18, stone: 10, ore: 2, stick: 10 }));
  await openCrafting(page);
  await craft(page, 'plank', 'five');
  await craft(page, 'chipped_stone', 'five');
  await craft(page, 'simple_handle', 'five');
  await craft(page, 'primitive_component', 'five');
  const expected = quantities({ wood: 8, stone: 5, ore: 2, plank: 5, primitive_component: 5 });
  expect(await balance(page)).toEqual(expected);
  const final = await state(page);
  await saveAndReload(page, 'Craft repeated operations');
  expect(await state(page)).toEqual(final);
  expect(await balance(page)).toEqual(expected);
});

test('[43-48,59,64-65,70] crafting gates movement, world hits, map and boat, then restores keyboard controls', async ({
  page,
}) => {
  await openMenu(page);
  await createWorld(page, 'Craft controls');
  await openCrafting(page);
  const before = await page.evaluate(() => ({ x: G.px, y: G.py, boat: G.boat }));
  await page.keyboard.down('w');
  await frames(page, 8);
  await page.keyboard.press('m');
  await page.keyboard.press('e');
  expect(await page.evaluate(() => ({ x: G.px, y: G.py, boat: G.boat }))).toEqual(before);
  expect(await page.evaluate(() => mapOpen)).toBe(0);
  await page.keyboard.press('c');
  await expect(page.locator('#crafting-overlay')).toBeHidden();
  await frames(page, 5);
  expect(await page.evaluate(() => ({ x: G.px, y: G.py, boat: G.boat }))).toEqual(before);
  await page.keyboard.up('w');
  for (const [key, axis, sign] of [
    ['d', 'x', 1],
    ['a', 'x', -1],
    ['s', 'y', 1],
    ['w', 'y', -1],
  ])
    await movePlayer(page, key, axis, sign);
  const resource = await besideResource(page, 1);
  await openCrafting(page);
  const damage = await page.evaluate(() => Array.from(G.collection.damage.entries()));
  await clickResource(page, resource);
  await frames(page);
  expect(await page.evaluate(() => Array.from(G.collection.damage.entries()))).toEqual(damage);
  expect(await page.evaluate((index) => G.w.ob[index], resource.index)).toBe(1);
  await page.keyboard.press('i');
  await expect(page.locator('#inventory-panel')).toBeVisible();
  await expect(page.locator('#crafting-overlay')).toBeHidden();
  await openCrafting(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#crafting-overlay')).toBeHidden();
  await expect(page.locator('#m')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('#m')).toBeVisible();
});

test('[44-45,70] a cursor stack blocks crafting without losing or consuming the held items', async ({
  page,
}) => {
  await openMenu(page);
  await createWorld(page, 'Craft cursor protection');
  await seedMaterials(page, [['wood', 7]]);
  await page.keyboard.press('i');
  await slot(page, 0).click();
  const carried = await state(page);
  expect(carried.cursor).toEqual({ itemId: 'wood', quantity: 7 });
  await page.keyboard.press('c');
  await expect(page.locator('#inventory-panel')).toBeVisible();
  await expect(page.locator('#crafting-overlay')).toBeHidden();
  expect(await state(page)).toEqual(carried);
  await page.evaluate(() => performCraft('recipe_stick', 1));
  expect(await state(page)).toEqual(carried);
  await slot(page, 0).click();
  await openCrafting(page);
  await craft(page, 'stick');
  expect(await balance(page)).toEqual(quantities({ wood: 6, stick: 2 }));
});

test('[56-57,70] v0.4 inventory records and v0.3 counters load, craft and migrate only once', async ({
  page,
}) => {
  // Produce the compatibility fixture with the actual archived v0.4 code,
  // then load that save in v0.5 on the same HTTP origin.
  const response = await page.goto('/' + encodeURIComponent('ORIGENS — Survival v0.4.html'));
  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle('ORIGENS — Survival v0.4');
  await expect(page.locator('#cr')).toBeEnabled();
  const world = await createWorld(page, 'Craft old saves');
  await seedMaterials(page, [
    ['wood', 6],
    ['stone', 2],
  ]);
  await page.keyboard.press('7');
  await page.keyboard.press('Escape');
  // The v0.4 fixture deliberately contains only its original three item IDs,
  // the persisted schema v4/generator v2 and no crafting-specific state.
  const old = await page.evaluate((id) => {
    const save = JSON.parse(localStorage.getItem('origens_w_' + id));
    return { v: save.v, gv: save.gv, inventory: save.inventory };
  }, world.id);
  expect(old).toMatchObject({ v: 4, gv: 2, inventory: { selected: 6 } });
  expect(old.inventory.slots.filter(Boolean)).toEqual([
    { itemId: 'wood', quantity: 6 },
    { itemId: 'stone', quantity: 2 },
  ]);
  await openMenu(page);
  await loadWorld(page, 'Craft old saves');
  expect((await state(page)).slots).toEqual(old.inventory.slots);
  expect((await state(page)).selected).toBe(6);
  await openCrafting(page);
  await craft(page, 'plank');
  expect(await balance(page)).toEqual(quantities({ wood: 4, stone: 2, plank: 2 }));
  await closeCrafting(page);
  await page.keyboard.press('Escape');
  await page.evaluate((id) => {
    const key = 'origens_w_' + id;
    const legacy = JSON.parse(localStorage.getItem(key));
    legacy.v = 3;
    delete legacy.inventory;
    legacy.collection.materials = { wood: 7, stone: 4, ore: 1 };
    localStorage.setItem(key, JSON.stringify(legacy));
  }, world.id);
  await page.reload();
  await loadWorld(page, 'Craft old saves');
  expect(await balance(page)).toEqual(quantities({ wood: 7, stone: 4, ore: 1 }));
  await openCrafting(page);
  await craft(page, 'stick', 'five');
  const afterMigration = await state(page);
  expect(await balance(page)).toEqual(quantities({ wood: 2, stone: 4, ore: 1, stick: 10 }));
  for (let reload = 0; reload < 2; reload++) {
    await saveAndReload(page, 'Craft old saves');
    expect(await state(page)).toEqual(afterMigration);
    expect(await balance(page)).toEqual(quantities({ wood: 2, stone: 4, ore: 1, stick: 10 }));
  }
});

test('[51-53,58,70] a real Storage write failure is visible, preserves the previous save and can recover', async ({
  page,
}) => {
  await openMenu(page);
  const world = await createWorld(page, 'Craft save failure');
  await seedMaterials(page, [['wood', 2]]);
  await page.keyboard.press('Escape');
  const persisted = await page.evaluate((id) => localStorage.getItem('origens_w_' + id), world.id);
  await loadWorld(page, 'Craft save failure');
  await openCrafting(page);
  // Only the test browser's Storage implementation is fault-injected. The
  // application really attempts persistence, and its own failure path runs.
  await page.evaluate(() => {
    window.__originalStorageSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('origens_'))
        throw new DOMException('Test quota exhausted', 'QuotaExceededError');
      return window.__originalStorageSetItem.call(this, key, value);
    };
  });
  try {
    await craft(page, 'stick');
    expect(await balance(page)).toEqual(quantities({ wood: 1, stick: 2 }));
    // Wait for the real debounced write, not merely the normal pending label.
    await expect.poll(() => page.evaluate(() => G.lastSaveFailed)).toBe(true);
    await expect(page.locator('#crafting-save-state')).toContainText(/falha/i);
    expect(await page.evaluate((id) => localStorage.getItem('origens_w_' + id), world.id)).toBe(
      persisted,
    );
  } finally {
    await page.evaluate(() => {
      Storage.prototype.setItem = window.__originalStorageSetItem;
      delete window.__originalStorageSetItem;
    });
  }
  await saveAndReload(page, 'Craft save failure');
  expect(await balance(page)).toEqual(quantities({ wood: 1, stick: 2 }));
});

test('[19,37,43,50,70] crafting remains usable at 640×480 and exposes an inspectable visual capture', async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 480 });
  await openMenu(page);
  await createWorld(page, 'Craft visual inspection');
  await seedMaterials(page, [
    ['wood', 47],
    ['stone', 12],
    ['ore', 3],
  ]);
  await openCrafting(page);
  await recipe(page, 'stick').click();
  await expect(page.locator('#crafting-once')).toBeEnabled();
  const layout = await page.locator('#crafting-panel').evaluate((panel) => {
    const box = panel.getBoundingClientRect();
    return {
      left: box.left,
      top: box.top,
      right: box.right,
      bottom: box.bottom,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  expect(layout.left).toBeGreaterThanOrEqual(0);
  expect(layout.top).toBeGreaterThanOrEqual(0);
  expect(layout.right).toBeLessThanOrEqual(640);
  expect(layout.bottom).toBeLessThanOrEqual(480);
  expect(layout.horizontalOverflow).toBe(false);
  await page.mouse.move(10, 10);
  await page.screenshot({ path: '/tmp/origens-v05-crafting-small.png' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator('#crafting-panel')).toBeVisible();
  await expect(page.locator('#crafting-ingredients [data-ingredient="wood"]')).toBeVisible();
  await page.screenshot({ path: '/tmp/origens-v05-crafting.png' });
  await craft(page, 'stick');
  expect(await balance(page)).toEqual(quantities({ wood: 46, stone: 12, ore: 3, stick: 2 }));
  await closeCrafting(page);
  await expect(page.locator('#hotbar')).toBeVisible();
});
