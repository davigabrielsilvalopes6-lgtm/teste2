const { test, expect, openMenu, createWorld } = require('./fixtures');
const { gatherNaturalOre } = require('./navigation');

// The first chest cycle uses only natural resources, read-only navigation and
// actual keyboard/mouse input. Later cases explicitly supply edge-case fixtures;
// production handlers, crafting, rendering and persistence are never replaced.
const slot = (page, index) => page.locator(`#inventory-grid [data-slot="${index}"]`);
const recipe = (page, id) => page.locator(`[data-recipe="recipe_${id}"]`);

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

async function inventory(page) {
  return page.evaluate(() => ({
    ...G.inventory,
    slots: G.inventory.slots.map((s) => s && { ...s }),
  }));
}

async function seed(page, entries) {
  await page.evaluate((entries) => {
    for (const [id, amount] of entries)
      if (addItems(G.inventory, id, amount)) throw new Error('Fixture exceeded inventory capacity');
    inventoryChanged();
  }, entries);
}

async function craft(page, id, mode = 'once') {
  await recipe(page, id).click();
  await expect(page.locator(`#crafting-${mode}`)).toBeEnabled();
  await page.locator(`#crafting-${mode}`).click();
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

async function saveReload(page, name) {
  if (await page.evaluate(() => chestOpen)) await page.keyboard.press('f');
  if (await page.evaluate(() => craftingOpen)) await page.keyboard.press('c');
  if (await page.evaluate(() => inventoryOpen)) await page.keyboard.press('i');
  await page.keyboard.press('Escape');
  await expect(page.locator('#m')).toBeVisible();
  await page.reload();
  await loadWorld(page, name);
}

async function clickTarget(page, target) {
  const point = await page.evaluate(({ x, y }) => {
    const rect = cv.getBoundingClientRect();
    return {
      x: rect.left + ((x - G.view.ox) * G.view.z * rect.width) / 960,
      y: rect.top + ((y - G.view.oy) * G.view.z * rect.height) / 540,
    };
  }, target);
  await page.mouse.click(point.x, point.y);
}

async function strike(page, resource) {
  await page.waitForTimeout(370); // Preserve the real 350 ms cooldown.
  await clickTarget(page, resource.target);
}

// Edge-case fixture: position beside a real, unmodified generated resource.
async function besideResource(page, type) {
  const resource = await page.evaluate((type) => {
    for (let index = 0; index < G.w.ob.length; index++) {
      if (G.w.ob[index] !== type) continue;
      const base = resourceBase(G.w, index);
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
        if (blocked(G.w, G.px, G.py, 0) || !resourcePathClear(index)) continue;
        G.cx = G.px;
        G.cy = G.py;
        return { index, base, target };
      }
    }
    throw new Error('No accessible resource fixture for type ' + type);
  }, type);
  await frames(page);
  return resource;
}

async function moveTo(page, x, y) {
  for (const [axis, target] of [
    ['y', y],
    ['x', x],
  ]) {
    const coordinate = axis === 'x' ? 'px' : 'py';
    const before = await page.evaluate((coordinate) => G[coordinate], coordinate);
    if (Math.abs(before - target) <= 2) continue;
    const sign = target > before ? 1 : -1;
    const key = axis === 'x' ? (sign > 0 ? 'd' : 'a') : sign > 0 ? 's' : 'w';
    await page.keyboard.down(key);
    try {
      const reached = await page.evaluate(
        ({ coordinate, target, sign }) =>
          new Promise((resolve) => {
            const started = performance.now();
            const observe = () => {
              if ((G[coordinate] - target) * sign >= -1) return resolve(true);
              if (performance.now() - started > 5000) return resolve(false);
              requestAnimationFrame(observe);
            };
            requestAnimationFrame(observe);
          }),
        { coordinate, target, sign },
      );
      expect(reached, `Real keyboard movement reached ${axis}=${target}`).toBe(true);
    } finally {
      await page.keyboard.up(key);
    }
  }
}

// Read-only navigation oracle. BFS queries the original collision map and gives
// waypoints; it never writes player coordinates, items, resources or save data.
async function walkToNaturalResource(page, type) {
  const plan = await page.evaluate((type) => {
    const w = G.w,
      n = w.N;
    const center = (i) => ({ x: ((i % n) + 0.5) * T, y: (Math.floor(i / n) + 0.5) * T });
    const clear = (a, b, ignored = -1) => {
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
      for (let s = 0; s <= steps; s++)
        if (
          blocked(w, a.x + ((b.x - a.x) * s) / steps, a.y + ((b.y - a.y) * s) / steps, 0, ignored)
        )
          return false;
      return true;
    };
    const start = Math.floor(G.py / T) * n + Math.floor(G.px / T);
    const previous = new Int32Array(n * n).fill(-2),
      queue = [start];
    previous[start] = -1;
    for (let head = 0; head < queue.length; head++) {
      const i = queue[head],
        at = center(i),
        x = i % n,
        y = Math.floor(i / n);
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const tx = x + dx,
          ty = y + dy;
        if (tx < 0 || tx >= n || ty < 0 || ty >= n) continue;
        const index = ty * n + tx;
        if (w.ob[index] === type) {
          const base = resourceBase(w, index);
          const target = { x: base.x, y: base.y - (type === 1 ? 71 : 10) };
          if (pickResource(target.x, target.y) === index && clear(at, base, index)) {
            const path = [];
            for (let node = i; node >= 0; node = previous[node]) path.unshift(center(node));
            return { index, base, target, path };
          }
        }
        if (previous[index] !== -2 || blocked(w, center(index).x, center(index).y, 0)) continue;
        if (!clear(at, center(index))) continue;
        previous[index] = i;
        queue.push(index);
      }
    }
    throw new Error('No naturally reachable resource type ' + type);
  }, type);
  for (const point of plan.path) await moveTo(page, point.x, point.y);
  await page.waitForTimeout(450); // Let the existing camera follow real movement.
  return plan;
}

async function gatherNatural(page, type, strikes) {
  const resource = await walkToNaturalResource(page, type);
  const kind = type === 1 ? 'wood' : type === 2 ? 'stone' : 'ore';
  const amount = type === 1 ? 3 : type === 2 ? 2 : 1;
  const total = () =>
    page.evaluate(
      (kind) =>
        G.inventory.slots.reduce(
          (n, stack) => n + (stack?.itemId === kind ? stack.quantity : 0),
          0,
        ),
      kind,
    );
  const before = await total();
  for (let hit = 0; hit < strikes; hit++) await strike(page, resource);
  expect(await page.evaluate((i) => G.w.ob[i], resource.index)).toBe(0);
  // Sample inventory and ground together: pickup may run between two evaluations.
  const observed = await page.evaluate(
    ({ kind, index }) =>
      G.inventory.slots.reduce((n, stack) => n + (stack?.itemId === kind ? stack.quantity : 0), 0) +
      (G.collection.drops.get('drop-' + index)?.amount || 0),
    { kind, index: resource.index },
  );
  expect(observed - before).toBe(amount);
  await moveTo(page, resource.base.x, resource.base.y);
  await expect
    .poll(() => page.evaluate((i) => G.collection.drops.has('drop-' + i), resource.index))
    .toBe(false);
  expect((await total()) - before).toBe(amount);
  return resource;
}

async function moveItemTo(page, itemId, destination) {
  await page.keyboard.press('i');
  await expect(page.locator('#inventory-panel')).toBeVisible();
  const index = await page.evaluate(
    (id) => G.inventory.slots.findIndex((s) => s?.itemId === id),
    itemId,
  );
  expect(index).toBeGreaterThanOrEqual(0);
  if (index !== destination) {
    await slot(page, index).click();
    await slot(page, destination).click();
    // A swap leaves the previous destination item on the cursor; return it to
    // the vacated source rather than relying on closing recovery.
    if (await page.evaluate(() => !!G.inventory.cursor)) await slot(page, index).click();
  }
  expect(await page.evaluate(() => G.inventory.cursor)).toBeNull();
  await page.keyboard.press('i');
}

const chestSlot = (page, index) => page.locator(`#chest-grid [data-chest-slot="${index}"]`);
const playerSlot = (page, index) =>
  page.locator(`#chest-player-grid [data-storage-player-slot="${index}"]`);

async function storageState(page) {
  return page.evaluate(() => ({
    world: G.id,
    inventory: { ...G.inventory, slots: G.inventory.slots.map((stack) => stack && { ...stack }) },
    chests: [...G.storage.byId.values()]
      .map((chest) => ({ ...chest, slots: chest.slots.map((stack) => stack && { ...stack }) }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    origin: G.storage.cursorOrigin,
    nextId: G.storage.nextId,
  }));
}

async function balance(page) {
  // Independent accounting of all containers and the single cursor, including
  // legacy recovery quantities. Do not ask transfer code to prove itself.
  return page.evaluate(() => {
    const totals = { ...G.inventory.pending };
    const add = (stack) => {
      if (stack) totals[stack.itemId] = (totals[stack.itemId] || 0) + stack.quantity;
    };
    G.inventory.slots.forEach(add);
    add(G.inventory.cursor);
    for (const chest of G.storage.byId.values()) chest.slots.forEach(add);
    return totals;
  });
}

async function findPlayerItem(page, itemId) {
  const index = await page.evaluate(
    (id) => G.inventory.slots.findIndex((stack) => stack?.itemId === id),
    itemId,
  );
  expect(index, `Player contains ${itemId}`).toBeGreaterThanOrEqual(0);
  return index;
}

async function quickDeposit(page, itemId) {
  await playerSlot(page, await findPlayerItem(page, itemId)).click({ modifiers: ['Shift'] });
}

async function placementPoint(page) {
  return page.evaluate(() => {
    const tx = Math.floor(G.px / T),
      ty = Math.floor(G.py / T),
      candidates = [];
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        if (!canPlaceStorageChest(tx + dx, ty + dy).ok) continue;
        const x = (tx + dx + 0.5) * T,
          y = (ty + dy + 0.5) * T;
        candidates.push({
          tileX: tx + dx,
          tileY: ty + dy,
          x,
          y,
          distance: Math.hypot(x - G.px, y - G.py),
        });
      }
    candidates.sort((a, b) => a.distance - b.distance || a.tileY - b.tileY || a.tileX - b.tileX);
    if (!candidates.length) throw new Error('No valid nearby placement tile');
    return candidates[0];
  });
}

async function movePointerToWorld(page, point) {
  const screen = await page.evaluate(({ x, y }) => {
    const rect = cv.getBoundingClientRect();
    return {
      x: rect.left + ((x - G.view.ox) * G.view.z * rect.width) / 960,
      y: rect.top + ((y - G.view.oy) * G.view.z * rect.height) / 540,
    };
  }, point);
  await page.mouse.move(screen.x, screen.y);
  await frames(page);
  return screen;
}

async function placeChest(page) {
  await moveItemTo(page, 'wooden_chest', 0);
  await page.keyboard.press('1');
  const target = await placementPoint(page);
  const before = await page.evaluate(() => ({
    size: G.storage.byId.size,
    count: G.inventory.slots.filter((stack) => stack?.itemId === 'wooden_chest').length,
  }));
  await page.waitForTimeout(370);
  const screen = await movePointerToWorld(page, target);
  expect(
    await page.evaluate(({ tileX, tileY }) => canPlaceStorageChest(tileX, tileY).ok, target),
  ).toBe(true);
  await page.mouse.click(screen.x, screen.y);
  await expect.poll(() => page.evaluate(() => G.storage.byId.size)).toBe(before.size + 1);
  const chest = await page.evaluate(({ tileX, tileY }) => {
    const id = G.storage.byTile.get(tileY * G.w.N + tileX);
    return G.storage.byId.get(id);
  }, target);
  expect(chest).toMatchObject({ type: 'wooden_chest', tileX: target.tileX, tileY: target.tileY });
  expect(chest.slots).toEqual(Array(27).fill(null));
  expect(
    await page.evaluate(
      () => G.inventory.slots.filter((stack) => stack?.itemId === 'wooden_chest').length,
    ),
  ).toBe(before.count - 1);
  expect(
    await page.evaluate(
      ({ tileX, tileY }) => blocked(G.w, (tileX + 0.5) * T, tileY * T + 26, 0),
      target,
    ),
  ).toBe(1);
  return chest;
}

async function openNearby(page, expectedId) {
  await page.keyboard.press('f');
  await expect(page.locator('#chest-panel')).toBeVisible();
  await expect(page.locator('#chest-grid button')).toHaveCount(27);
  if (expectedId) expect(await page.evaluate(() => openChestId)).toBe(expectedId);
}

// Explicit proximity fixture for multi-container edge cases. The first scenario
// never uses this helper; it approaches and positions through normal movement.
async function positionNearChest(page, id) {
  const placed = await page.evaluate((id) => {
    const chest = G.storage.byId.get(id),
      base = { x: (chest.tileX + 0.5) * T, y: chest.tileY * T + 26 };
    for (const [dx, dy] of [
      [-36, 0],
      [36, 0],
      [0, 36],
      [0, -36],
      [-32, 32],
      [32, 32],
      [-32, -32],
      [32, -32],
    ]) {
      G.px = base.x + dx;
      G.py = base.y + dy;
      if (
        blocked(G.w, G.px, G.py, 0) ||
        !storageAccessCheck(chest).ok ||
        nearestStorageChest()?.id !== id
      )
        continue;
      G.cx = G.px;
      G.cy = G.py;
      return true;
    }
    return false;
  }, id);
  expect(placed, `There is an accessible approach to ${id}`).toBe(true);
  await frames(page);
}

async function setupChest(page, entries = [], name = 'Storage fixture') {
  await openMenu(page);
  await createWorld(page, name);
  await seed(page, [['wooden_chest', 1], ...entries]);
  const chest = await placeChest(page);
  await openNearby(page, chest.id);
  return chest;
}

async function fixtureSlots(page, fixture) {
  await page.evaluate((fixture) => {
    if (fixture.playerSlots) G.inventory.slots = fixture.playerSlots;
    if (fixture.chestSlots) G.storage.byId.get(openChestId).slots = fixture.chestSlots;
    if (Object.hasOwn(fixture, 'cursor')) G.inventory.cursor = fixture.cursor;
    if (Object.hasOwn(fixture, 'origin')) G.storage.cursorOrigin = fixture.origin;
    inventoryChanged();
  }, fixture);
}

test('[0.8 01,04-06,13-18,31,34,38,41-44,48,53-54,69-75,80,84] first chest: natural resources, real walking, sea travel, crafting, storage and reload', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const name = 'Primeiro baú sem fixtures';
  await openMenu(page);
  await createWorld(page, name);
  expect((await inventory(page)).slots.every((stack) => stack === null)).toBe(true);
  for (let i = 0; i < 5; i++) await gatherNatural(page, 1, 3);
  await gatherNatural(page, 2, 4);
  await gatherNaturalOre(page);
  await page.keyboard.press('c');
  for (let i = 0; i < 4; i++) await craft(page, 'plank');
  await craft(page, 'wooden_chest');
  await page.keyboard.press('c');
  const chest = await placeChest(page);
  await openNearby(page, chest.id);
  for (const itemId of ['wood', 'stone', 'ore']) await quickDeposit(page, itemId);
  const deposited = await storageState(page);
  expect(deposited.chests[0].slots.slice(0, 3)).toEqual([
    { itemId: 'wood', quantity: 3 },
    { itemId: 'stone', quantity: 2 },
    { itemId: 'ore', quantity: 1 },
  ]);
  expect(deposited.inventory.slots.every((stack) => stack === null)).toBe(true);
  await saveReload(page, name);
  expect(await storageState(page)).toEqual(deposited);
  await openNearby(page, chest.id);
  await chestSlot(page, 0).click({ button: 'right' });
  expect(await page.evaluate(() => G.inventory.cursor)).toEqual({ itemId: 'wood', quantity: 2 });
  await playerSlot(page, 0).click();
  await chestSlot(page, 1).click({ modifiers: ['Shift'] });
  const withdrawn = await storageState(page);
  expect(withdrawn.chests[0].slots[0]).toEqual({ itemId: 'wood', quantity: 1 });
  expect(withdrawn.inventory.slots[0]).toEqual({ itemId: 'wood', quantity: 2 });
  expect(withdrawn.inventory.slots[1]).toEqual({ itemId: 'stone', quantity: 2 });
  await saveReload(page, name);
  expect(await storageState(page)).toEqual(withdrawn);
});

test('[0.8 39-47,53-54,69-77,84] three placed chests keep distinct contents, IDs and same-seed world ownership', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const name = 'Três baús independentes';
  await openMenu(page);
  await createWorld(page, name);
  await seed(page, [
    ['wooden_chest', 3],
    ['wood', 100],
    ['stone', 50],
    ['ore', 7],
  ]);
  const ids = [];
  for (const itemId of ['wood', 'stone', 'ore']) {
    const chest = await placeChest(page);
    ids.push(chest.id);
    await positionNearChest(page, chest.id);
    await openNearby(page, chest.id);
    await quickDeposit(page, itemId);
    await page.keyboard.press('f');
  }
  expect(new Set(ids).size).toBe(3);
  const stored = await storageState(page);
  await saveReload(page, name);
  expect(await storageState(page)).toEqual(stored);
  for (let i = 0; i < ids.length; i++) {
    await positionNearChest(page, ids[i]);
    await openNearby(page, ids[i]);
    expect(
      await page.evaluate(() => G.storage.byId.get(openChestId).slots.filter(Boolean)),
    ).toEqual([stored.chests.find((c) => c.id === ids[i]).slots.find(Boolean)]);
    await page.keyboard.press('f');
  }
  await page.keyboard.press('Escape');
  await createWorld(page, 'Outro mundo mesma seed');
  expect(await page.evaluate(() => G.storage.byId.size)).toBe(0);
  await seed(page, [
    ['wooden_chest', 1],
    ['stone_pickaxe', 1],
  ]);
  const other = await placeChest(page);
  await openNearby(page, other.id);
  await quickDeposit(page, 'stone_pickaxe');
  await saveReload(page, 'Outro mundo mesma seed');
  expect(await page.evaluate(() => [...G.storage.byId.values()][0].slots.filter(Boolean))).toEqual([
    { itemId: 'stone_pickaxe', quantity: 1 },
  ]);
  await page.keyboard.press('Escape');
  await loadWorld(page, name);
  expect((await storageState(page)).chests).toEqual(stored.chests);
});

test('[0.8 45-52,57,60,66-68] one cursor moves, splits, swaps and caps every item category without equipping stored tools', async ({
  page,
}) => {
  await setupChest(page, [
    ['wood', 30],
    ['stone', 20],
    ['ore', 5],
    ['stone_axe', 1],
    ['stone_pickaxe', 1],
    ['rustic_backpack', 1],
    ['wooden_chest', 1],
  ]);
  await page.keyboard.press('f');
  await moveItemTo(page, 'stone_axe', 0);
  await page.keyboard.press('1');
  expect(await page.evaluate(() => activeTool()?.id)).toBe('stone_axe');
  await openNearby(page);
  const before = await balance(page);
  const wood = await findPlayerItem(page, 'wood');
  await playerSlot(page, wood).click({ button: 'right' });
  expect(await page.evaluate(() => G.inventory.cursor)).toEqual({ itemId: 'wood', quantity: 15 });
  await chestSlot(page, 0).click({ button: 'right' });
  await chestSlot(page, 1).click();
  expect(await page.evaluate(() => G.storage.byId.get(openChestId).slots.slice(0, 2))).toEqual([
    { itemId: 'wood', quantity: 1 },
    { itemId: 'wood', quantity: 14 },
  ]);
  await chestSlot(page, 0).click();
  await chestSlot(page, 1).click();
  expect(await page.evaluate(() => G.storage.byId.get(openChestId).slots[1])).toEqual({
    itemId: 'wood',
    quantity: 15,
  });
  await quickDeposit(page, 'stone');
  await chestSlot(page, 0).click();
  await chestSlot(page, 1).click(); // Exchange stone and wood.
  expect(await page.evaluate(() => G.inventory.cursor)).toEqual({ itemId: 'wood', quantity: 15 });
  await playerSlot(page, wood).click();
  for (const id of ['ore', 'stone_axe', 'stone_pickaxe', 'rustic_backpack', 'wooden_chest'])
    await quickDeposit(page, id);
  expect(await page.evaluate(() => G.inventory.cursor)).toBeNull();
  const state = await storageState(page);
  for (const stack of state.chests[0].slots.filter(Boolean)) {
    expect(stack.quantity).toBeLessThanOrEqual(
      ['stone_axe', 'stone_pickaxe', 'rustic_backpack', 'wooden_chest'].includes(stack.itemId)
        ? 1
        : 200,
    );
  }
  expect(state.inventory.backpackTier).toBe(0);
  expect(state.inventory.slots).toHaveLength(16);
  expect(state.chests[0].slots).toHaveLength(27);
  expect(await page.evaluate(() => activeTool())).toBeNull();
  expect(await balance(page)).toEqual(before);
});

test('[0.8 51-57,59-60,64] quick transfer fills partial stacks first, leaves excess at source, and refuses full destinations', async ({
  page,
}) => {
  await setupChest(page);
  const player = Array.from({ length: 16 }, () => ({ itemId: 'stone', quantity: 200 }));
  player[0] = { itemId: 'wood', quantity: 20 };
  const chest = Array.from({ length: 27 }, () => ({ itemId: 'stone', quantity: 200 }));
  chest[0] = { itemId: 'wood', quantity: 195 };
  await fixtureSlots(page, { playerSlots: player, chestSlots: chest });
  const before = await balance(page);
  await playerSlot(page, 0).click({ modifiers: ['Shift'] });
  expect(await page.evaluate(() => G.inventory.slots[0])).toEqual({ itemId: 'wood', quantity: 15 });
  expect(await page.evaluate(() => G.storage.byId.get(openChestId).slots[0])).toEqual({
    itemId: 'wood',
    quantity: 200,
  });
  const full = await storageState(page);
  await playerSlot(page, 0).dblclick({ modifiers: ['Shift'] });
  expect(await storageState(page)).toEqual(full);
  await chestSlot(page, 1).click({ modifiers: ['Shift'] });
  expect(await storageState(page)).toEqual(full);
  expect(await balance(page)).toEqual(before);
  // Transfer another source while the one existing cursor is occupied. The
  // operation may refuse or move only the source; the cursor itself is retained.
  await playerSlot(page, 0).click({ button: 'right' });
  const cursor = await page.evaluate(() => G.inventory.cursor);
  await chestSlot(page, 1).click({ modifiers: ['Shift'] });
  expect(await page.evaluate(() => G.inventory.cursor)).toEqual(cursor);
  expect(await balance(page)).toEqual(before);
});

test('[0.8 57-58,69-75,80-81] unexpected reload preserves a chest-origin cursor once and close returns it safely', async ({
  page,
}) => {
  const name = 'Cursor do baú protegido';
  const chest = await setupChest(page, [['wood', 80]], name);
  await quickDeposit(page, 'wood');
  await chestSlot(page, 0).click();
  expect(await page.evaluate(() => G.inventory.cursor)).toEqual({ itemId: 'wood', quantity: 80 });
  expect(await page.evaluate(() => G.storage.byId.get(openChestId).slots[0])).toBeNull();
  const before = await balance(page);
  await page.reload(); // Actual pagehide/visibility persistence, no explicit save.
  await loadWorld(page, name);
  expect(await page.evaluate(() => G.inventory.cursor)).toEqual({ itemId: 'wood', quantity: 80 });
  expect(await page.evaluate((id) => G.storage.byId.get(id).slots[0], chest.id)).toBeNull();
  expect(await balance(page)).toEqual(before);
  await expect(page.locator('#chest-panel')).toBeVisible();
  await page.locator('#chest-close').click();
  await expect(page.locator('#chest-overlay')).toBeHidden();
  expect(await page.evaluate(() => G.inventory.cursor)).toBeNull();
  expect(await page.evaluate((id) => G.storage.byId.get(id).slots[0], chest.id)).toEqual({
    itemId: 'wood',
    quantity: 80,
  });
  await openNearby(page, chest.id);
  await saveReload(page, name);
  expect(await balance(page)).toEqual(before);
});

test('[0.8 85-94] only empty chests can be recovered; removal clears collision, persists and never reuses identity', async ({
  page,
}) => {
  const name = 'Recolher com segurança';
  const chest = await setupChest(page, [['wood', 2]], name);
  await quickDeposit(page, 'wood');
  await expect(page.locator('#chest-remove')).toBeDisabled();
  expect(await page.evaluate(() => G.storage.byId.size)).toBe(1);
  await chestSlot(page, 0).click({ modifiers: ['Shift'] });
  const before = await balance(page);
  // An empty chest still cannot be removed when all player slots are full.
  const player = Array.from({ length: 16 }, () => ({ itemId: 'stone', quantity: 200 }));
  await fixtureSlots(page, { playerSlots: player });
  await expect(page.locator('#chest-remove')).toBeDisabled();
  expect(await page.evaluate(() => G.storage.byId.size)).toBe(1);
  player[15] = null;
  await fixtureSlots(page, { playerSlots: player });
  await expect(page.locator('#chest-remove')).toBeEnabled();
  await page.locator('#chest-remove').dblclick();
  await expect(page.locator('#chest-overlay')).toBeHidden();
  expect(await page.evaluate(() => G.storage.byId.size)).toBe(0);
  expect(
    await page.evaluate(
      () => G.inventory.slots.filter((stack) => stack?.itemId === 'wooden_chest').length,
    ),
  ).toBe(1);
  expect(
    await page.evaluate(
      ({ tileX, tileY }) => blocked(G.w, (tileX + 0.5) * T, tileY * T + 26, 0),
      chest,
    ),
  ).toBe(0);
  await saveReload(page, name);
  expect(await page.evaluate(() => G.storage.byId.size)).toBe(0);
  const again = await placeChest(page);
  expect(again.id).not.toBe(chest.id);
  expect(again.slots.every((stack) => stack === null)).toBe(true);
  expect(before.wood).toBe(2);
});

test('[0.8 28,34,38,95,109-110,115] storage captures controls and UI clicks without moving, sailing or striking behind the panel', async ({
  page,
}) => {
  await openMenu(page);
  await createWorld(page, 'Controles do baú');
  await seed(page, [
    ['wooden_chest', 1],
    ['stone_axe', 1],
  ]);
  const resource = await besideResource(page, 1);
  const chest = await placeChest(page);
  await openNearby(page, chest.id);
  const before = await page.evaluate(() => ({
    x: G.px,
    y: G.py,
    boat: G.boat,
    damage: [...G.collection.damage],
    swing: G.swing || null,
  }));
  await page.keyboard.down('w');
  await frames(page, 5);
  await page.keyboard.up('w');
  await page.keyboard.press('e');
  await page.keyboard.press('m');
  await clickTarget(page, resource.target);
  expect(
    await page.evaluate(() => ({
      x: G.px,
      y: G.py,
      boat: G.boat,
      damage: [...G.collection.damage],
      swing: G.swing || null,
    })),
  ).toEqual(before);
  expect(await page.evaluate(() => mapOpen)).toBe(0);
  await expect(page.locator('#inventory-overlay')).toBeHidden();
  await expect(page.locator('#crafting-overlay')).toBeHidden();
  await page.keyboard.press('i');
  await expect(page.locator('#chest-overlay')).toBeHidden();
  await expect(page.locator('#inventory-panel')).toBeVisible();
  await page.keyboard.press('i');
  await openNearby(page, chest.id);
  await page.keyboard.press('c');
  await expect(page.locator('#chest-overlay')).toBeHidden();
  await expect(page.locator('#crafting-panel')).toBeVisible();
});

test('[0.8 14-16,31,96-97] placement preview follows actual mouse coordinates and zoom without consuming or saving', async ({
  page,
}, testInfo) => {
  await openMenu(page);
  await createWorld(page, 'Prévia do baú');
  await seed(page, [['wooden_chest', 1]]);
  await page.keyboard.press('1');
  await page.waitForTimeout(800); // Finish the material-fixture debounce.
  const target = await placementPoint(page);
  const before = await storageState(page);
  const saved = await page.evaluate(() => localStorage.getItem('origens_w_' + G.id));
  for (let zoom = 0; zoom < 4; zoom++) {
    while ((await page.evaluate(() => zi)) > zoom) await page.keyboard.press('-');
    while ((await page.evaluate(() => zi)) < zoom) await page.keyboard.press('+');
    await frames(page);
    await movePointerToWorld(page, target);
    const shown = await page.evaluate(() => storagePreviewState());
    expect(shown).toMatchObject({ tileX: target.tileX, tileY: target.tileY, ok: true });
    const capture = () =>
      page.evaluate(({ tileX, tileY }) => {
        const x = Math.round((tileX * T - G.view.ox) * G.view.z),
          y = Math.round((tileY * T - G.view.oy) * G.view.z),
          size = Math.max(1, Math.floor(T * G.view.z));
        return Array.from(ctx.getImageData(x, y, size, size).data);
      }, target);
    const ghost = await capture();
    const box = await page.locator('#c').boundingBox();
    await page.mouse.move(box.x + (10 * box.width) / 960, box.y + (10 * box.height) / 540);
    await frames(page);
    const empty = await capture();
    expect(
      ghost.reduce((count, value, i) => count + (value !== empty[i] ? 1 : 0), 0),
    ).toBeGreaterThan(20);
  }
  expect(await storageState(page)).toEqual(before);
  expect(await page.evaluate(() => localStorage.getItem('origens_w_' + G.id))).toBe(saved);
  await page.screenshot({ path: testInfo.outputPath('placement-preview.png') });
});

test('[0.8 21-24,26,29-32,35] rejected primary clicks preserve the item and resources, while a placed chest physically blocks walking', async ({
  page,
}) => {
  await openMenu(page);
  await createWorld(page, 'Colocação e colisão');
  await seed(page, [['wooden_chest', 1]]);
  await page.keyboard.press('1');
  for (const type of [1, 2, 3]) {
    const resource = await besideResource(page, type);
    const point = await page.evaluate((index) => resourceBase(G.w, index), resource.index);
    expect(
      await page.evaluate(
        ({ x, y }) => canPlaceStorageChest(Math.floor(x / T), Math.floor(y / T)).ok,
        point,
      ),
    ).toBe(false);
    await clickTarget(page, point);
    expect(await page.evaluate(() => G.storage.byId.size)).toBe(0);
    expect(await page.evaluate(() => G.inventory.slots[0])).toEqual({
      itemId: 'wooden_chest',
      quantity: 1,
    });
    expect(await page.evaluate(() => G.collection.damage.size)).toBe(0);
  }
  const playerTile = await page.evaluate(() => ({
    x: (Math.floor(G.px / T) + 0.5) * T,
    y: (Math.floor(G.py / T) + 0.5) * T,
  }));
  await clickTarget(page, playerTile);
  expect(await page.evaluate(() => G.storage.byId.size)).toBe(0);
  const far = await page.evaluate(() => {
    const cx = Math.floor(G.px / T),
      cy = Math.floor(G.py / T);
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -6; dx <= 6; dx++) {
        const tx = cx + dx,
          ty = cy + dy;
        if (tx < 0 || ty < 0 || tx >= G.w.N || ty >= G.w.N) continue;
        const i = ty * G.w.N + tx,
          x = (tx + 0.5) * T,
          y = (ty + 0.5) * T;
        if (G.w.ter[i] < 3 || G.w.ter[i] === 8 || G.w.ob[i] || Math.hypot(x - G.px, y - G.py) < 100)
          continue;
        return { x, y };
      }
    throw new Error('Expected a distant land fixture inside the viewport');
  });
  await clickTarget(page, far);
  expect(await page.evaluate(() => G.storage.byId.size)).toBe(0);
  const chest = await placeChest(page);
  const base = { x: (chest.tileX + 0.5) * 32, y: chest.tileY * 32 + 26 };
  await clickTarget(page, base);
  expect(await page.evaluate(() => G.storage.byId.size)).toBe(1);
  // Explicit collision fixture at an actually clear approach, followed by real
  // held-key movement. The chest must remain solid throughout the walk.
  const approach = await page.evaluate(({ tileX, tileY }) => {
    const x = tileX * T,
      y = tileY * T;
    const options = [
      { x: x - 8, y: y + 26, axis: 'x', key: 'd', sign: 1, bound: x - 2 },
      { x: x + 40, y: y + 26, axis: 'x', key: 'a', sign: -1, bound: x + 34 },
      { x: x + 16, y: y + 1, axis: 'y', key: 's', sign: 1, bound: y + 10 },
      { x: x + 16, y: y + 43, axis: 'y', key: 'w', sign: -1, bound: y + 38 },
    ];
    const clear = options.find((point) => !blocked(G.w, point.x, point.y, 0));
    if (!clear) throw new Error('Placed chest has no clear collision approach');
    G.px = clear.x;
    G.py = clear.y;
    G.cx = clear.x;
    G.cy = clear.y;
    return clear;
  }, chest);
  expect(await page.evaluate(() => blocked(G.w, G.px, G.py, 0))).toBe(0);
  await page.keyboard.down(approach.key);
  await page.waitForTimeout(500);
  await page.keyboard.up(approach.key);
  const position = await page.evaluate((axis) => G[axis === 'x' ? 'px' : 'py'], approach.axis);
  expect((position - approach.bound) * approach.sign).toBeLessThanOrEqual(0.5);
  await openNearby(page, chest.id);
  await page.keyboard.press('f');
  await page.evaluate(() => {
    const x = (G.w.sp.x + 0.5) * T,
      y = (G.w.sp.y + 0.5) * T;
    G.px = x;
    G.py = y;
    G.cx = x;
    G.cy = y;
  });
  await frames(page);
  await page.keyboard.press('f');
  await expect(page.locator('#chest-overlay')).toBeHidden();
});

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 640, height: 480 },
  { width: 390, height: 844 },
]) {
  test(`[0.8 38,61-65,67-68; layout] all unlocked storage slots remain usable at ${viewport.width}×${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await openMenu(page);
    await createWorld(page, 'Baú e mochila expandida');
    await seed(page, [
      ['rustic_backpack', 1],
      ['reinforced_backpack', 1],
      ['wooden_chest', 1],
      ['stone_pickaxe', 1],
      ['wood', 31],
    ]);
    await page.keyboard.press('i');
    for (const id of ['rustic_backpack', 'reinforced_backpack']) {
      const index = await findPlayerItem(page, id);
      await page.keyboard.press(String(index + 1));
      await page.mouse.move(0, 0);
      await expect(page.locator('#inventory-use-backpack')).toBeEnabled();
      await page.locator('#inventory-use-backpack').click();
      await expect(page.locator('#inventory-grid button')).toHaveCount(
        id === 'rustic_backpack' ? 24 : 32,
      );
    }
    const pickaxe = await findPlayerItem(page, 'stone_pickaxe');
    await slot(page, pickaxe).click();
    await slot(page, 31).click();
    await page.keyboard.press('i');
    const chest = await placeChest(page);
    await openNearby(page, chest.id);
    await expect(page.locator('#chest-player-grid button')).toHaveCount(32);
    await expect(page.locator('#hotbar button')).toHaveCount(9);
    await playerSlot(page, 31).click();
    await chestSlot(page, 26).click();
    expect(await page.evaluate(() => G.storage.byId.get(openChestId).slots[26])).toEqual({
      itemId: 'stone_pickaxe',
      quantity: 1,
    });
    await chestSlot(page, 26).click({ modifiers: ['Shift'] });
    expect(
      await page.evaluate(() =>
        G.inventory.slots.some((stack) => stack?.itemId === 'stone_pickaxe'),
      ),
    ).toBe(true);
    expect(await page.evaluate(() => G.inventory.slots.length)).toBe(32);
    const columns = await page
      .locator('#chest-grid')
      .evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(9);
    await page.locator('#chest-panel').evaluate((panel) => {
      panel.scrollTop = 0;
    });
    await page.mouse.move(0, 0);
    await page.screenshot({ path: testInfo.outputPath('storage-interface.png') });
  });
}

test('[0.8 69-73,80,82] real storage write failure reports unsaved transfer and recovery saves both containers together', async ({
  page,
}) => {
  const name = 'Falha de gravação do baú';
  const chest = await setupChest(page, [['wood', 40]], name);
  await page.waitForTimeout(800);
  const key = await page.evaluate(() => 'origens_w_' + G.id);
  const previous = await page.evaluate((key) => localStorage.getItem(key), key);
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    window.__restoreStorageWrite = () => {
      Storage.prototype.setItem = original;
    };
    Storage.prototype.setItem = function (k, value) {
      if (k === key) throw new DOMException('Quota test', 'QuotaExceededError');
      return original.call(this, k, value);
    };
  }, key);
  const before = await balance(page);
  await quickDeposit(page, 'wood');
  await expect.poll(() => page.evaluate(() => G.lastSaveFailed), { timeout: 8000 }).toBe(true);
  await expect(page.locator('#chest-save-state')).toContainText(/falha|não salvas|pendentes/i);
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(previous);
  expect(await balance(page)).toEqual(before);
  expect(
    await page.evaluate(() => G.inventory.slots.some((stack) => stack?.itemId === 'wood')),
  ).toBe(false);
  expect(await page.evaluate(() => G.storage.byId.get(openChestId).slots[0])).toEqual({
    itemId: 'wood',
    quantity: 40,
  });
  await page.evaluate(() => window.__restoreStorageWrite());
  await saveReload(page, name);
  expect(await balance(page)).toEqual(before);
  expect(await page.evaluate((id) => G.storage.byId.get(id).slots[0], chest.id)).toEqual({
    itemId: 'wood',
    quantity: 40,
  });
  const written = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
  expect(written.v).toBe(8);
  expect(written.inventory.slots.some((stack) => stack?.itemId === 'wood')).toBe(false);
  expect(written.storage.chests[0].slots[0]).toEqual({ itemId: 'wood', quantity: 40 });
});

test('[0.8 78,114] actual v0.7 expanded inventory migrates without free chests, lost tools or changed exploration', async ({
  page,
}) => {
  await page.goto('/' + encodeURIComponent('ORIGENS — Survival v0.7.html'));
  await expect(page).toHaveTitle('ORIGENS — Survival v0.7');
  const name = 'Mundo v0.7 preservado';
  await createWorld(page, name);
  await seed(page, [
    ['rustic_backpack', 1],
    ['stone_axe', 1],
    ['wood', 13],
  ]);
  await page.keyboard.press('i');
  await page.keyboard.press('1');
  await page.locator('#inventory-use-backpack').click();
  await page.keyboard.press('i');
  const old = await page.evaluate(() => ({
    id: G.id,
    inventory: JSON.parse(JSON.stringify(G.inventory)),
    exploration: Array.from(G.ex),
    position: { x: G.px, y: G.py },
    seed: G.w.seed,
  }));
  await page.keyboard.press('Escape');
  const raw = await page.evaluate((id) => localStorage.getItem('origens_w_' + id), old.id);
  expect(JSON.parse(raw).v).toBe(5);
  await page.goto('/');
  await loadWorld(page, name);
  expect(await page.evaluate(() => G.storage.byId.size)).toBe(0);
  const current = await page.evaluate(() => G.inventory);
  expect(current.slots).toEqual(old.inventory.slots);
  expect(current.cursor).toEqual(old.inventory.cursor);
  expect(current.selected).toBe(old.inventory.selected);
  expect(current.backpackTier).toBe(old.inventory.backpackTier);
  expect(current.pending).toMatchObject(old.inventory.pending);
  expect(current.pending.wooden_chest).toBe(0);
  expect(await page.evaluate(() => Array.from(G.ex))).toEqual(old.exploration);
  expect(await page.evaluate(() => ({ x: G.px, y: G.py }))).toEqual(old.position);
  expect(await page.evaluate(() => G.w.seed)).toBe(old.seed);
  await page.keyboard.press('Escape');
  expect(
    await page.evaluate((id) => localStorage.getItem('origens_w_' + id + '_backup_v5'), old.id),
  ).toBe(raw);
});

test('[0.8 83] malformed filled storage retains the exact original save and reports protection', async ({
  page,
}) => {
  const name = 'Baú corrompido protegido';
  await setupChest(page, [['wood', 12]], name);
  await quickDeposit(page, 'wood');
  await page.keyboard.press('f');
  await page.keyboard.press('Escape');
  const corrupt = await page.evaluate(() => {
    const metadata = JSON.parse(localStorage.getItem('origens_idx_v2')).find(
      (item) => item.name === 'Baú corrompido protegido',
    );
    const key = 'origens_w_' + metadata.id,
      save = JSON.parse(localStorage.getItem(key));
    save.storage.chests[0].slots[0].quantity = 999;
    const raw = JSON.stringify(save);
    localStorage.setItem(key, raw);
    return { key, raw };
  });
  await page.reload();
  await loadWorld(page, name);
  expect(await page.evaluate(() => G.saveProtected || G.storage.protected)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#m')).toBeHidden();
  expect(await page.evaluate((key) => localStorage.getItem(key), corrupt.key)).toBe(corrupt.raw);
  expect(await page.evaluate(() => G.lastSaveFailed)).toBe(true);
});
