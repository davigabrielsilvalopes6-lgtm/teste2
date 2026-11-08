const { test, expect, openMenu, createWorld, movePlayer } = require('./fixtures');

// Controlled fixtures add existing materials and position the player beside
// actual generated resources. All extraction and item manipulation use real
// mouse/keyboard events; the game code and handlers are never patched.
const slot = (page, index) => page.locator(`#inventory-grid [data-slot="${index}"]`);
const shortcut = (page, index) => page.locator(`#hotbar [data-hotbar="${index}"]`);

async function seedMaterials(page, entries) {
  await page.evaluate((entries) => {
    for (const [id, amount] of entries) {
      if (addItems(G.inventory, id, amount) !== 0) throw new Error('Invalid test material fixture');
    }
    inventoryChanged();
  }, entries);
}

async function inventoryState(page) {
  return page.evaluate(() => ({
    slots: G.inventory.slots,
    cursor: G.inventory.cursor,
    selected: G.inventory.selected,
    pending: G.inventory.pending,
  }));
}

// Independent sum, rather than using the production totals function as oracle.
async function materialBalance(page, includeGround = false) {
  return page.evaluate((includeGround) => {
    const totals = { wood: 0, stone: 0, ore: 0 };
    for (const stack of [...G.inventory.slots, G.inventory.cursor]) {
      if (stack) totals[stack.itemId] += stack.quantity;
    }
    for (const kind of Object.keys(totals)) totals[kind] += G.inventory.pending[kind] || 0;
    if (includeGround)
      for (const drop of G.collection.drops.values()) totals[drop.kind] += drop.amount;
    return totals;
  }, includeGround);
}

async function openInventory(page) {
  await page.keyboard.press('i');
  await expect(page.locator('#inventory-panel')).toBeVisible();
  await expect.poll(() => page.evaluate(() => inventoryOpen)).toBe(true);
}

async function closeInventory(page) {
  await page.keyboard.press('i');
  await expect(page.locator('#inventory-overlay')).toBeHidden();
  await expect.poll(() => page.evaluate(() => inventoryOpen)).toBe(false);
}

async function frames(page, count = 3) {
  await page.evaluate(
    (count) =>
      new Promise((resolve) => {
        const frame = () => (--count <= 0 ? resolve() : requestAnimationFrame(frame));
        requestAnimationFrame(frame);
      }),
    count,
  );
}

async function loadWorldFromMenu(page, name) {
  await page
    .locator('#wl .r')
    .filter({ hasText: name })
    .getByRole('button', { name: 'Jogar', exact: true })
    .click();
  await expect(page.locator('#m')).toBeHidden();
  await expect.poll(() => page.evaluate(() => !!G && !busy && !!G.view)).toBe(true);
}

async function positionBesideResource(page, type) {
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
          hp: RESOURCE_TYPES[type].hp,
          kind: RESOURCE_TYPES[type].kind,
          amount: RESOURCE_TYPES[type].amount,
          dx,
          dy,
        };
      }
    }
    throw new Error('No reachable generated resource of type ' + type);
  }, type);
  await frames(page);
  return resource;
}

async function clickResource(page, resource) {
  const point = await page.evaluate(({ x, y }) => {
    const rectangle = cv.getBoundingClientRect();
    return {
      x: rectangle.left + ((x - G.view.ox) * G.view.z * rectangle.width) / 960,
      y: rectangle.top + ((y - G.view.oy) * G.view.z * rectangle.height) / 540,
    };
  }, resource.target);
  await page.mouse.click(point.x, point.y);
}

async function destroyByMouse(page, resource) {
  for (let strike = 1; strike <= resource.hp; strike++) {
    // The 350ms cooldown is game behavior, so wait elapsed wall time explicitly.
    await page.waitForTimeout(360);
    await clickResource(page, resource);
    if (strike < resource.hp) {
      expect(await page.evaluate((index) => G.collection.damage.get(index), resource.index)).toBe(
        strike,
      );
    }
  }
  expect(await page.evaluate((index) => G.w.ob[index], resource.index)).toBe(0);
  expect(
    await page.evaluate((index) => G.collection.drops.has('drop-' + index), resource.index),
  ).toBe(true);
}

test('[01-05,29-31,34-35] exactly 16 storage slots, a 4×4 grid and nine live shortcuts', async ({
  page,
}) => {
  await openMenu(page);
  await page.locator('#nm').focus();
  await page.keyboard.press('i');
  await page.keyboard.press('9');
  expect(await page.evaluate(() => G)).toBeNull();
  await expect(page.locator('#inventory-overlay')).toBeHidden();
  await expect(page.locator('#hotbar')).toBeHidden();
  await createWorld(page, 'Inventory structure');
  await expect(page.locator('#hotbar [data-hotbar]')).toHaveCount(9);
  const fresh = await inventoryState(page);
  expect(fresh.slots).toHaveLength(16);
  expect(fresh.slots.every((entry) => entry === null)).toBe(true);
  expect(fresh.cursor).toBeNull();
  for (let number = 1; number <= 9; number++) {
    await page.keyboard.press(String(number));
    expect(await page.evaluate(() => G.inventory.selected)).toBe(number - 1);
    await expect(shortcut(page, number - 1)).toHaveAttribute('aria-pressed', 'true');
  }
  expect((await inventoryState(page)).slots).toEqual(fresh.slots);
  await openInventory(page);
  await expect(page.locator('#inventory-grid [data-slot]')).toHaveCount(16);
  const layout = await page.locator('#inventory-grid [data-slot]').evaluateAll((elements) => {
    const boxes = elements.map((element) => element.getBoundingClientRect());
    return {
      columns: new Set(boxes.map((box) => Math.round(box.x))).size,
      rows: new Set(boxes.map((box) => Math.round(box.y))).size,
    };
  });
  expect(layout).toEqual({ columns: 4, rows: 4 });
});

test('[15-26,59-60] mouse splitting, distribution, merge and swap conserve materials through reload', async ({
  page,
}) => {
  await openMenu(page);
  await createWorld(page, 'Mouse conservation');
  await seedMaterials(page, [
    ['wood', 250],
    ['stone', 21],
    ['ore', 1],
  ]);
  const totals = await materialBalance(page);
  await openInventory(page);
  await slot(page, 2).click({ button: 'right' });
  expect((await inventoryState(page)).cursor).toEqual({ itemId: 'stone', quantity: 11 });
  expect((await inventoryState(page)).slots[2]).toEqual({ itemId: 'stone', quantity: 10 });
  await slot(page, 2).click({ button: 'right' });
  expect((await inventoryState(page)).cursor.quantity).toBe(10);
  await slot(page, 4).click();
  await slot(page, 1).click();
  await slot(page, 5).click();
  await slot(page, 5).click();
  await slot(page, 2).click();
  expect((await inventoryState(page)).cursor).toEqual({ itemId: 'stone', quantity: 11 });
  await slot(page, 4).click();
  expect((await inventoryState(page)).slots[4]).toEqual({ itemId: 'stone', quantity: 21 });
  await slot(page, 0).click();
  await slot(page, 2).click();
  let state = await inventoryState(page);
  expect(state.slots[2]).toEqual({ itemId: 'wood', quantity: 200 });
  expect(state.cursor).toEqual({ itemId: 'wood', quantity: 50 });
  await slot(page, 2).click({ button: 'right' });
  await slot(page, 3).click({ button: 'right' });
  expect(await inventoryState(page)).toEqual(state);
  await slot(page, 6).click();
  for (let repeat = 0; repeat < 6; repeat++) {
    await slot(page, 6).click({ button: 'right' });
    await slot(page, 6).click();
    expect(await materialBalance(page)).toEqual(totals);
  }
  state = await inventoryState(page);
  expect(state.cursor).toBeNull();
  expect(
    state.slots.filter(Boolean).every((stack) => stack.quantity > 0 && stack.quantity <= 200),
  ).toBe(true);
  await closeInventory(page);
  await page.keyboard.press('Escape');
  await page.reload();
  await loadWorldFromMenu(page, 'Mouse conservation');
  expect((await inventoryState(page)).slots).toEqual(state.slots);
  expect(await materialBalance(page)).toEqual(totals);
});

test('[29-35] moving slot one to slot twelve immediately updates the same hotbar data', async ({
  page,
}) => {
  await openMenu(page);
  await createWorld(page);
  await seedMaterials(page, [
    ['wood', 47],
    ['stone', 4],
  ]);
  await expect(shortcut(page, 0)).toContainText('47');
  await openInventory(page);
  await slot(page, 0).click();
  await slot(page, 11).click();
  expect((await inventoryState(page)).slots[0]).toBeNull();
  expect((await inventoryState(page)).slots[11]).toEqual({ itemId: 'wood', quantity: 47 });
  await expect(shortcut(page, 0)).not.toContainText('47');
  await slot(page, 11).click();
  await slot(page, 3).click();
  await expect(shortcut(page, 3)).toContainText('47');
  await closeInventory(page);
  await shortcut(page, 3).click();
  await expect(shortcut(page, 3)).toHaveAttribute('aria-pressed', 'true');
  expect(await materialBalance(page)).toEqual({ wood: 47, stone: 4, ore: 0 });
  expect((await inventoryState(page)).slots).toHaveLength(16);
});

test('[27-28,43-45] page reload while carrying a stack restores it once and returns it safely on close', async ({
  page,
}) => {
  await openMenu(page);
  await createWorld(page, 'Pending cursor');
  await seedMaterials(page, [
    ['wood', 250],
    ['stone', 30],
  ]);
  await page.keyboard.press('8');
  await openInventory(page);
  await slot(page, 0).click();
  expect((await inventoryState(page)).cursor).toEqual({ itemId: 'wood', quantity: 200 });
  expect((await inventoryState(page)).slots[0]).toBeNull();
  // No explicit save: exercise the pagehide/unexpected-navigation path.
  await page.reload();
  await loadWorldFromMenu(page, 'Pending cursor');
  await expect(page.locator('#inventory-panel')).toBeVisible();
  expect(await page.evaluate(() => inventoryOpen)).toBe(true);
  const restored = await inventoryState(page);
  expect(restored.cursor).toEqual({ itemId: 'wood', quantity: 200 });
  expect(restored.slots[0]).toBeNull();
  expect(restored.selected).toBe(7);
  expect(await materialBalance(page)).toEqual({ wood: 250, stone: 30, ore: 0 });
  await closeInventory(page);
  expect((await inventoryState(page)).cursor).toBeNull();
  expect(await materialBalance(page)).toEqual({ wood: 250, stone: 30, ore: 0 });
});

test('[36-38,41,56-57] actual tree, stone and ore extraction feeds slots and survives save/load', async ({
  page,
}) => {
  await openMenu(page);
  await createWorld(page, 'Resource integration');
  const removed = [];
  for (const type of [1, 2, 3]) {
    const resource = await positionBesideResource(page, type);
    await destroyByMouse(page, resource);
    removed.push(resource.index);
    if (type === 1) {
      await page.keyboard.press('Escape');
      await loadWorldFromMenu(page, 'Resource integration');
      expect(
        await page.evaluate((index) => G.collection.drops.has('drop-' + index), resource.index),
      ).toBe(true);
      expect(await page.evaluate((index) => G.w.ob[index], resource.index)).toBe(0);
    }
    // After removal, walking along the already checked approach reaches the drop.
    const key = resource.dx < 0 ? 'd' : resource.dx > 0 ? 'a' : resource.dy < 0 ? 's' : 'w';
    await page.keyboard.down(key);
    try {
      await expect
        .poll(() =>
          page.evaluate((index) => G.collection.drops.has('drop-' + index), resource.index),
        )
        .toBe(false);
    } finally {
      await page.keyboard.up(key);
    }
    const balance = await materialBalance(page);
    expect(balance[resource.kind]).toBe(resource.amount);
    await frames(page);
    expect(await materialBalance(page)).toEqual(balance);
  }
  await page.keyboard.press('Escape');
  await page.reload();
  await loadWorldFromMenu(page, 'Resource integration');
  expect(await materialBalance(page)).toEqual({ wood: 3, stone: 2, ore: 1 });
  expect(
    await page.evaluate((indices) => indices.every((index) => G.w.ob[index] === 0), removed),
  ).toBe(true);
});

test('[13-14,39-42,57] partial pickup leaves the exact remainder and UI blocks pickup and hits', async ({
  page,
}) => {
  await openMenu(page);
  await createWorld(page, 'Partial drop');
  const resource = await positionBesideResource(page, 1);
  await destroyByMouse(page, resource);
  await seedMaterials(page, [['wood', 3198]]);
  await openInventory(page);
  await page.evaluate((base) => {
    G.px = base.x;
    G.py = base.y;
  }, resource.base);
  const before = await materialBalance(page, true);
  await slot(page, 0).click();
  await frames(page);
  expect(
    await page.evaluate((index) => G.collection.drops.get('drop-' + index).amount, resource.index),
  ).toBe(3);
  expect(await page.evaluate(() => G.collection.damage.size)).toBe(0);
  await slot(page, 0).click();
  await closeInventory(page);
  await expect
    .poll(() =>
      page.evaluate((index) => G.collection.drops.get('drop-' + index)?.amount, resource.index),
    )
    .toBe(1);
  expect(await materialBalance(page)).toEqual({ wood: 3200, stone: 0, ore: 0 });
  await frames(page, 6);
  expect(await materialBalance(page, true)).toEqual(before);
  expect((await inventoryState(page)).slots).toHaveLength(16);
  await page.keyboard.press('Escape');
  await page.reload();
  await loadWorldFromMenu(page, 'Partial drop');
  expect(
    await page.evaluate((index) => G.collection.drops.get('drop-' + index)?.amount, resource.index),
  ).toBe(1);
  expect(await materialBalance(page, true)).toEqual(before);
});

test('[43-49] same-seed worlds stay independent and legacy v3 counters migrate exactly once', async ({
  page,
}) => {
  await openMenu(page);
  const worldA = await createWorld(page, 'Inventory A');
  await seedMaterials(page, [
    ['wood', 120],
    ['stone', 40],
    ['ore', 7],
  ]);
  await page.keyboard.press('6');
  await page.keyboard.press('Escape');
  await createWorld(page, 'Inventory B');
  expect(await materialBalance(page)).toEqual({ wood: 0, stone: 0, ore: 0 });
  await seedMaterials(page, [['wood', 10]]);
  await page.keyboard.press('Escape');
  await loadWorldFromMenu(page, 'Inventory A');
  expect(await materialBalance(page)).toEqual({ wood: 120, stone: 40, ore: 7 });
  expect((await inventoryState(page)).selected).toBe(5);
  await page.keyboard.press('Escape');
  // Install an actual legacy-shaped record as a controlled migration fixture.
  await page.evaluate((id) => {
    const key = 'origens_w_' + id;
    const legacy = JSON.parse(localStorage.getItem(key));
    legacy.v = 3;
    delete legacy.inventory;
    legacy.collection.materials = { wood: 230, stone: 65, ore: 3 };
    localStorage.setItem(key, JSON.stringify(legacy));
  }, worldA.id);
  await page.reload();
  await loadWorldFromMenu(page, 'Inventory A');
  expect((await inventoryState(page)).slots.slice(0, 4)).toEqual([
    { itemId: 'wood', quantity: 200 },
    { itemId: 'wood', quantity: 30 },
    { itemId: 'stone', quantity: 65 },
    { itemId: 'ore', quantity: 3 },
  ]);
  expect(await materialBalance(page)).toEqual({ wood: 230, stone: 65, ore: 3 });
  await page.keyboard.press('Escape');
  await page.reload();
  await loadWorldFromMenu(page, 'Inventory A');
  expect(await materialBalance(page)).toEqual({ wood: 230, stone: 65, ore: 3 });
  await page.keyboard.press('Escape');
  await loadWorldFromMenu(page, 'Inventory B');
  expect(await materialBalance(page)).toEqual({ wood: 10, stone: 0, ore: 0 });
});

test('[48-49,60] visible pending recovery fills only available space and remains idempotent after reload', async ({
  page,
}) => {
  await openMenu(page);
  const world = await createWorld(page, 'Pending recovery');
  // All sixteen slots are occupied: thirteen full wood stacks, one with 199,
  // plus full stone and ore stacks. Only one wood unit can currently fit.
  await seedMaterials(page, [
    ['wood', 2799],
    ['stone', 200],
    ['ore', 200],
  ]);
  await page.keyboard.press('Escape');
  await page.evaluate((id) => {
    const key = 'origens_w_' + id;
    const saved = JSON.parse(localStorage.getItem(key));
    saved.inventory.pending = { wood: 5, stone: 7, ore: 3 };
    localStorage.setItem(key, JSON.stringify(saved));
  }, world.id);
  await page.reload();
  await loadWorldFromMenu(page, 'Pending recovery');
  await openInventory(page);
  await expect(page.locator('#inventory-pending')).toBeVisible();
  await expect(page.locator('#inventory-pending-text')).toContainText('5 Madeira');
  await expect(slot(page, 13)).toContainText('199');
  await expect(slot(page, 14)).toContainText('200');
  await expect(slot(page, 15)).toContainText('200');
  await expect(page.locator('#hotbar [data-hotbar]')).toHaveCount(9);
  await page.mouse.move(40, 80);
  await page.screenshot({ path: '/tmp/origens-v04-ui.png' });
  const balance = await materialBalance(page);
  expect(balance).toEqual({ wood: 2804, stone: 207, ore: 203 });
  await page.locator('#inventory-claim-pending').click();
  let state = await inventoryState(page);
  expect(state.slots[13]).toEqual({ itemId: 'wood', quantity: 200 });
  expect(state.pending).toEqual({
    wood: 4,
    stone: 7,
    ore: 3,
    stick: 0,
    plank: 0,
    chipped_stone: 0,
    simple_handle: 0,
    primitive_component: 0,
  });
  expect(state.slots).toHaveLength(16);
  expect(await materialBalance(page)).toEqual(balance);
  await expect(page.locator('#inventory-pending-text')).toContainText('4 Madeira');
  await page.locator('#inventory-claim-pending').click();
  expect(await inventoryState(page)).toEqual(state);
  await closeInventory(page);
  await page.keyboard.press('Escape');
  await page.reload();
  await loadWorldFromMenu(page, 'Pending recovery');
  expect((await inventoryState(page)).pending).toEqual(state.pending);
  expect(await materialBalance(page)).toEqual(balance);
  await openInventory(page);
  await page.locator('#inventory-claim-pending').click();
  expect(await inventoryState(page)).toEqual(state);
  expect(await materialBalance(page)).toEqual(balance);
});

test('[51-55] inventory gates held keys, map and raft without leaving controls stuck', async ({
  page,
}) => {
  await openMenu(page);
  await createWorld(page);
  await movePlayer(page, 'd', 'x');
  for (let repeat = 0; repeat < 3; repeat++) {
    await openInventory(page);
    const position = await page.evaluate(() => ({ x: G.px, y: G.py }));
    await page.keyboard.down('w');
    await frames(page);
    expect(await page.evaluate(() => ({ x: G.px, y: G.py }))).toEqual(position);
    // Close while the movement key is held: it must require fresh key input.
    await closeInventory(page);
    await frames(page);
    expect(await page.evaluate(() => ({ x: G.px, y: G.py }))).toEqual(position);
    await page.keyboard.up('w');
  }
  const previousCameraY = await page.evaluate(() => G.cy);
  await movePlayer(page, 's', 'y');
  await expect
    .poll(() => page.evaluate((previous) => Math.abs(G.cy - previous), previousCameraY))
    .toBeGreaterThan(1);
  await page.keyboard.press('m');
  expect(await page.evaluate(() => mapOpen)).toBe(1);
  await expect(page.locator('#hotbar')).toBeHidden();
  await page.keyboard.press('Escape');
  await openInventory(page);
  await page.keyboard.press('m');
  expect(await page.evaluate(() => mapOpen)).toBe(0);
  await closeInventory(page);
  const coast = await page.evaluate(() => {
    const w = G.w,
      N = w.N;
    for (let i = 0; i < N * N; i++) {
      const x = ((i % N) + 0.5) * T,
        y = (Math.floor(i / N) + 0.5) * T;
      if (w.ter[i] !== 3 || blocked(w, x, y, 0)) continue;
      if ([-1, 1, -N, N].some((delta) => w.sea[i + delta])) {
        G.px = x;
        G.py = y;
        return true;
      }
    }
    return false;
  });
  expect(coast).toBe(true);
  await page.keyboard.press('e');
  expect(await page.evaluate(() => G.boat)).toBe(1);
  await expect(page.locator('#hotbar')).toBeVisible();
  await openInventory(page);
  await page.keyboard.press('e');
  expect(await page.evaluate(() => G.boat)).toBe(1);
  await closeInventory(page);
  expect(await page.evaluate(() => G.boat)).toBe(1);
  await page.keyboard.press('e');
  expect(await page.evaluate(() => G.boat)).toBe(0);
  expect(await page.evaluate(() => Number.isFinite(G.view.ox) && Number.isFinite(G.view.oy))).toBe(
    true,
  );
});

test('[15-16,53,58] slots remain clickable after zoom/resize and the held item does not intercept clicks', async ({
  page,
}) => {
  await openMenu(page);
  await createWorld(page);
  await seedMaterials(page, [['wood', 200]]);
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  await page.setViewportSize({ width: 640, height: 480 });
  await openInventory(page);
  await expect(page.locator('#inventory-grid [data-slot]')).toHaveCount(16);
  const panel = await page.locator('#inventory-panel').boundingBox();
  expect(panel.x).toBeGreaterThanOrEqual(0);
  expect(panel.y).toBeGreaterThanOrEqual(0);
  expect(panel.x + panel.width).toBeLessThanOrEqual(641);
  expect(panel.y + panel.height).toBeLessThanOrEqual(481);
  await slot(page, 0).hover();
  await expect(page.locator('#inventory-tooltip')).toBeVisible();
  await expect(page.locator('#inventory-tooltip')).toContainText('Madeira');
  const tooltip = await page.locator('#inventory-tooltip').boundingBox();
  expect(tooltip.x).toBeGreaterThanOrEqual(0);
  expect(tooltip.x + tooltip.width).toBeLessThanOrEqual(641);
  expect(tooltip.y + tooltip.height).toBeLessThanOrEqual(481);
  await slot(page, 0).click();
  await expect(page.locator('#inventory-cursor')).toBeVisible();
  await expect(page.locator('#inventory-cursor')).toContainText('200');
  expect(
    await page
      .locator('#inventory-cursor')
      .evaluate((element) => getComputedStyle(element).pointerEvents),
  ).toBe('none');
  await slot(page, 15).click();
  expect((await inventoryState(page)).cursor).toBeNull();
  expect((await inventoryState(page)).slots[15]).toEqual({ itemId: 'wood', quantity: 200 });
  expect(
    await slot(page, 15).evaluate((element) => {
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  ).toBe(true);
  expect(
    await page.locator('body').evaluate((element) => {
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  ).toBe(false);
  await closeInventory(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await movePlayer(page, 'd', 'x');
});
