const { test, expect, openMenu, createWorld } = require('./fixtures');

// Only the first scenario starts from an entirely empty inventory and uses no
// state fixtures. Other scenarios explicitly provide bounded fixtures for edge
// cases; every craft, inventory operation and strike still uses real UI input.
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
  for (let hit = 0; hit < strikes; hit++) await strike(page, resource);
  expect(await page.evaluate((i) => G.w.ob[i], resource.index)).toBe(0);
  const drop = await page.evaluate((i) => G.collection.drops.get('drop-' + i), resource.index);
  expect(drop.amount).toBe(type === 1 ? 3 : type === 2 ? 2 : 1);
  await moveTo(page, resource.base.x, resource.base.y);
  await expect
    .poll(() => page.evaluate((i) => G.collection.drops.has('drop-' + i), resource.index))
    .toBe(false);
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

test('[0.6 11,25-26,37-38,41,65,67-70,73-74,79,89-90] first axe from natural resources, real walking and UI only', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openMenu(page);
  await createWorld(page, 'Primeiro machado sem fixtures');
  expect((await inventory(page)).slots.every((s) => s === null)).toBe(true);
  const tree1 = await gatherNatural(page, 1, 3);
  const tree2 = await gatherNatural(page, 1, 3);
  const rock = await gatherNatural(page, 2, 4);
  await page.keyboard.press('c');
  await craft(page, 'stick');
  await craft(page, 'stick');
  await craft(page, 'plank');
  await craft(page, 'chipped_stone');
  await craft(page, 'simple_handle');
  await craft(page, 'stone_axe');
  await page.keyboard.press('c');
  await moveItemTo(page, 'stone_axe', 0);
  await page.keyboard.press('1');
  await expect(page.locator('#hotbar [data-hotbar="0"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => activeTool()?.id)).toBe('stone_axe');
  const tree3 = await gatherNatural(page, 1, 2);
  const before = await inventory(page);
  const independentTotals = {};
  for (const s of before.slots)
    if (s) independentTotals[s.itemId] = (independentTotals[s.itemId] || 0) + s.quantity;
  expect(independentTotals).toEqual({ wood: 5, stone: 1, stick: 1, plank: 1, stone_axe: 1 });
  await saveReload(page, 'Primeiro machado sem fixtures');
  expect(await inventory(page)).toEqual(before);
  expect(await page.evaluate(() => activeTool()?.id)).toBe('stone_axe');
  for (const { index } of [tree1, tree2, rock, tree3]) {
    expect(await page.evaluate((i) => G.w.ob[i], index)).toBe(0);
    expect(await page.evaluate((i) => G.collection.drops.has('drop-' + i), index)).toBe(false);
  }
});

test('[0.6 12,25-29,31-36,68-70] craft both tools, move with mouse and derive equipment from the selected slot', async ({
  page,
}) => {
  await openMenu(page);
  await createWorld(page, 'Ferramentas selecionadas');
  await seed(page, [
    ['simple_handle', 2],
    ['chipped_stone', 5],
    ['stick', 2],
    ['wood', 40],
  ]);
  await page.keyboard.press('c');
  await craft(page, 'stone_axe');
  await craft(page, 'stone_pickaxe');
  await page.keyboard.press('c');
  await moveItemTo(page, 'stone_axe', 0);
  await moveItemTo(page, 'stone_pickaxe', 1);
  await page.keyboard.press('1');
  expect(await page.evaluate(() => activeTool()?.id)).toBe('stone_axe');
  await page.keyboard.press('2');
  expect(await page.evaluate(() => activeTool()?.id)).toBe('stone_pickaxe');
  const before = await inventory(page);
  for (const key of ['1', '2', '9', '3', '1', '2']) await page.keyboard.press(key);
  expect((await inventory(page)).slots).toEqual(before.slots);
  await expect(page.locator('#hotbar [data-hotbar="1"]')).toHaveClass(/is-selected/);
  await moveItemTo(page, 'stone_axe', 11);
  await page.keyboard.press('1');
  expect(await page.evaluate(() => activeTool())).toBeNull();
  expect((await inventory(page)).slots[11]).toEqual({ itemId: 'stone_axe', quantity: 1 });
  await page.keyboard.press('2');
  const saved = await inventory(page);
  await saveReload(page, 'Ferramentas selecionadas');
  expect(await inventory(page)).toEqual(saved);
  expect(await page.evaluate(() => activeTool()?.id)).toBe('stone_pickaxe');
  await expect(page.locator('#hotbar [data-hotbar]')).toHaveCount(9);
});

test('[0.6 5,7-9,18,20-23] atomic batch rejects three free slots for five tools, then uses five separate slots', async ({
  page,
}) => {
  await openMenu(page);
  await createWorld(page, 'Lote de ferramentas');
  const ingredients = [
    { itemId: 'simple_handle', quantity: 5 },
    { itemId: 'chipped_stone', quantity: 10 },
    { itemId: 'stick', quantity: 5 },
  ];
  await page.evaluate((ingredients) => {
    G.inventory.slots = [
      ...ingredients,
      ...Array.from({ length: 13 }, () => ({ itemId: 'ore', quantity: 1 })),
    ];
    inventoryChanged();
  }, ingredients);
  const full = await inventory(page);
  await page.keyboard.press('c');
  await recipe(page, 'stone_axe').click();
  await expect(page.locator('#crafting-five')).toBeDisabled();
  expect(await inventory(page)).toEqual(full);
  await page.keyboard.press('c');
  await page.evaluate(() => {
    G.inventory.slots[14] = null;
    G.inventory.slots[15] = null;
    inventoryChanged();
  });
  await page.keyboard.press('c');
  await craft(page, 'stone_axe', 'five');
  const state = await inventory(page);
  const axes = state.slots.filter((s) => s?.itemId === 'stone_axe');
  expect(axes).toHaveLength(5);
  expect(axes.every((s) => s.quantity === 1)).toBe(true);
  expect(state.slots).toHaveLength(16);
  expect(state.slots.filter((s) => s?.itemId === 'ore')).toHaveLength(11);
  await page.keyboard.press('c');
  await page.keyboard.press('i');
  const indices = state.slots.flatMap((s, i) => (s?.itemId === 'stone_axe' ? [i] : []));
  await slot(page, indices[0]).click({ button: 'right' });
  expect((await inventory(page)).cursor).toEqual({ itemId: 'stone_axe', quantity: 1 });
  await slot(page, indices[1]).click({ button: 'right' });
  expect((await inventory(page)).cursor).toEqual({ itemId: 'stone_axe', quantity: 1 });
  expect((await inventory(page)).slots[indices[1]].quantity).toBe(1);
  await slot(page, indices[0]).click();
  expect((await inventory(page)).cursor).toBeNull();
});

test('[0.6 45,54-59,71-74,79] tool switches keep partial damage and cooldown; UI clicks never hit', async ({
  page,
}) => {
  await openMenu(page);
  await createWorld(page, 'Golpes e troca');
  await seed(page, [
    ['stone_axe', 1],
    ['stone_pickaxe', 1],
  ]);
  await page.keyboard.press('1');
  const tree = await besideResource(page, 1);
  await strike(page, tree);
  expect(await page.evaluate((i) => G.collection.damage.get(i), tree.index)).toBe(2);
  const hitTime = await page.evaluate(() => G.collection.lastHitAt);
  await page.keyboard.press('2');
  await clickTarget(page, tree.target);
  expect(await page.evaluate((i) => G.collection.damage.get(i), tree.index)).toBe(2);
  expect(await page.evaluate(() => G.collection.lastHitAt)).toBe(hitTime);
  await page.keyboard.press('i');
  await slot(page, 0).click();
  await slot(page, 0).click();
  expect(await page.evaluate((i) => G.collection.damage.get(i), tree.index)).toBe(2);
  await page.keyboard.press('c');
  await recipe(page, 'stone_pickaxe').click();
  expect(await page.evaluate((i) => G.collection.damage.get(i), tree.index)).toBe(2);
  await page.keyboard.press('c');
  await saveReload(page, 'Golpes e troca');
  expect(await page.evaluate((i) => G.collection.damage.get(i), tree.index)).toBe(2);
  await strike(page, tree);
  expect(await page.evaluate((i) => G.w.ob[i], tree.index)).toBe(0);
  const ground = await page.evaluate((i) => G.collection.drops.get('drop-' + i), tree.index);
  expect(ground).toMatchObject({ kind: 'wood', amount: 3 });
  await strike(page, tree);
  expect(await page.evaluate(() => G.collection.drops.size)).toBe(1);
  await saveReload(page, 'Golpes e troca');
  expect(await page.evaluate((i) => G.collection.drops.get('drop-' + i), tree.index)).toEqual(
    ground,
  );
  expect(await page.evaluate((i) => G.w.ob[i], tree.index)).toBe(0);
  const rock = await besideResource(page, 2);
  await strike(page, rock);
  expect(await page.evaluate((i) => G.collection.damage.get(i), rock.index)).toBe(2);
  await page.keyboard.press('9');
  await strike(page, rock);
  expect(await page.evaluate((i) => G.collection.damage.get(i), rock.index)).toBe(3);
  await strike(page, rock);
  expect(await page.evaluate((i) => G.collection.drops.get('drop-' + i).amount, rock.index)).toBe(
    2,
  );
});

test('[0.6 43,46,48,50-51,66] crafted pickaxe mines actual rock in two clicks and ore in three, saves exact drops', async ({
  page,
}) => {
  await openMenu(page);
  await createWorld(page, 'Picareta em recursos');
  await seed(page, [
    ['simple_handle', 1],
    ['chipped_stone', 3],
    ['stick', 1],
  ]);
  await page.keyboard.press('c');
  await craft(page, 'stone_pickaxe');
  await page.keyboard.press('c');
  await page.keyboard.press('1');
  expect(await page.evaluate(() => activeTool()?.id)).toBe('stone_pickaxe');
  for (const [type, hits, amount] of [
    [2, 2, 2],
    [3, 3, 1],
  ]) {
    const resource = await besideResource(page, type);
    for (let hit = 1; hit <= hits; hit++) {
      await strike(page, resource);
      if (hit < hits)
        expect(await page.evaluate((i) => G.collection.damage.get(i), resource.index)).toBe(
          hit * 2,
        );
    }
    expect(await page.evaluate((i) => G.w.ob[i], resource.index)).toBe(0);
    expect(
      await page.evaluate((i) => G.collection.drops.get('drop-' + i).amount, resource.index),
    ).toBe(amount);
  }
  const before = await inventory(page);
  const drops = await page.evaluate(() => [...G.collection.drops.values()]);
  await saveReload(page, 'Picareta em recursos');
  expect(await inventory(page)).toEqual(before);
  expect(await page.evaluate(() => [...G.collection.drops.values()])).toEqual(drops);
});

test('[0.6 29-30; Canvas] tools render distinguishable pixels at every zoom and disappear for an empty or material slot', async ({
  page,
}) => {
  await openMenu(page);
  await createWorld(page, 'Ferramentas no Canvas');
  await seed(page, [
    ['stone_axe', 1],
    ['stone_pickaxe', 1],
    ['wood', 1],
  ]);
  await page.waitForTimeout(1000);
  for (let zoom = 0; zoom < 4; zoom++) {
    while ((await page.evaluate(() => zi)) > zoom) await page.keyboard.press('-');
    while ((await page.evaluate(() => zi)) < zoom) await page.keyboard.press('+');
    await page.waitForTimeout(300);
    const capture = async (key) => {
      await page.keyboard.press(key);
      await frames(page);
      return page.evaluate(() => {
        const x = Math.round((G.px - G.view.ox) * G.view.z);
        const y = Math.round((G.py - G.view.oy) * G.view.z);
        return Array.from(ctx.getImageData(x - 48, y - 64, 96, 80).data);
      });
    };
    const none = await capture('9');
    const material = await capture('3');
    expect(material).toEqual(none);
    const axe = await capture('1');
    const pickaxe = await capture('2');
    const difference = (a, b) => a.reduce((total, value, i) => total + (value !== b[i] ? 1 : 0), 0);
    expect(difference(axe, none)).toBeGreaterThan(15);
    expect(difference(pickaxe, none)).toBeGreaterThan(15);
    expect(difference(axe, pickaxe)).toBeGreaterThan(8);
    expect(await capture('9')).toEqual(none);
  }
});

test('[0.6 75-76; v0.7] same-seed worlds retain independent tools and 16/24/32 backpack capacities', async ({
  page,
}) => {
  await openMenu(page);
  await createWorld(page, 'Mochila mundo A');
  await seed(page, [
    ['plank', 32],
    ['stick', 16],
    ['simple_handle', 3],
    ['primitive_component', 10],
    ['ore', 8],
    ['stone_axe', 1],
  ]);
  await page.keyboard.press('c');
  await craft(page, 'rustic_backpack');
  await page.keyboard.press('c');
  const useCraftedBackpack = async (id, capacity) => {
    await page.keyboard.press('i');
    const index = await page.evaluate(
      (id) => G.inventory.slots.findIndex((s) => s?.itemId === id),
      id,
    );
    await slot(page, index).click();
    await slot(page, index).click();
    await expect(page.locator('#inventory-use-backpack')).toBeEnabled();
    await page.locator('#inventory-use-backpack').click();
    await expect(page.locator('#inventory-grid [data-slot]')).toHaveCount(capacity);
    await expect(page.locator('#hotbar [data-hotbar]')).toHaveCount(9);
    expect((await inventory(page)).slots.some((s) => s?.itemId === id)).toBe(false);
    await page.keyboard.press('i');
  };
  await useCraftedBackpack('rustic_backpack', 24);
  await page.keyboard.press('c');
  await craft(page, 'reinforced_backpack');
  await page.keyboard.press('c');
  await useCraftedBackpack('reinforced_backpack', 32);
  await moveItemTo(page, 'stone_axe', 31);
  const a = await inventory(page);
  expect(a.backpackTier).toBe(2);
  await page.keyboard.press('Escape');
  await createWorld(page, 'Mochila mundo B');
  expect((await inventory(page)).slots).toHaveLength(16);
  expect((await inventory(page)).slots.every((s) => s === null)).toBe(true);
  await seed(page, [['stone_pickaxe', 1]]);
  const b = await inventory(page);
  await page.keyboard.press('Escape');
  await loadWorld(page, 'Mochila mundo A');
  expect(await inventory(page)).toEqual(a);
  await page.keyboard.press('i');
  await expect(slot(page, 31)).toHaveAttribute('data-item-id', 'stone_axe');
  await page.keyboard.press('i');
  await page.keyboard.press('Escape');
  await loadWorld(page, 'Mochila mundo B');
  expect(await inventory(page)).toEqual(b);
  await saveReload(page, 'Mochila mundo B');
  expect(await inventory(page)).toEqual(b);
});

test('[0.6 60,81,85-87] selected tool preserves real embark, sea movement and disembark controls', async ({
  page,
}) => {
  await openMenu(page);
  await createWorld(page, 'Jangada com ferramenta');
  await seed(page, [['stone_pickaxe', 1]]);
  await page.keyboard.press('1');
  const coast = await page.evaluate(() => {
    const w = G.w,
      n = w.N;
    for (let i = 0; i < n * n; i++) {
      const x = ((i % n) + 0.5) * T,
        y = (Math.floor(i / n) + 0.5) * T;
      if (w.ter[i] !== 3 || blocked(w, x, y, 0)) continue;
      const sea = [-1, 1, -n, n].filter((delta) => w.sea[i + delta]);
      if (!sea.length) continue;
      G.px = x;
      G.py = y;
      G.cx = x;
      G.cy = y;
      return { x, y };
    }
    throw new Error('No coast fixture');
  });
  await page.keyboard.press('e');
  expect(await page.evaluate(() => G.boat)).toBe(1);
  const possible = await page.evaluate(() => {
    for (const [key, dx, dy] of [
      ['d', 16, 0],
      ['a', -16, 0],
      ['s', 0, 16],
      ['w', 0, -16],
    ])
      if (!blocked(G.w, G.px + dx, G.py + dy, 1)) return { key, x: G.px, y: G.py, dx, dy };
    throw new Error('No navigable sea direction');
  });
  await moveTo(
    page,
    possible.x + Math.sign(possible.dx) * 8,
    possible.y + Math.sign(possible.dy) * 8,
  );
  expect(
    await page.evaluate(({ x, y }) => Math.hypot(G.px - x, G.py - y), possible),
  ).toBeGreaterThan(6);
  expect(await page.evaluate(() => blocked(G.w, G.px, G.py, 1))).toBe(0);
  const collection = await page.evaluate(() => ({
    damage: [...G.collection.damage],
    drops: [...G.collection.drops],
    at: G.collection.lastHitAt,
  }));
  await page.locator('#c').click({ position: { x: 200, y: 200 } });
  expect(
    await page.evaluate(() => ({
      damage: [...G.collection.damage],
      drops: [...G.collection.drops],
      at: G.collection.lastHitAt,
    })),
  ).toEqual(collection);
  // The short movement stays beside this same beach, so E can still land.
  await page.keyboard.press('e');
  expect(await page.evaluate(() => G.boat)).toBe(0);
  expect(await page.evaluate(() => blocked(G.w, G.px, G.py, 0))).toBe(0);
  expect(await page.evaluate(({ x, y }) => Math.hypot(G.px - x, G.py - y), coast)).toBeLessThan(
    100,
  );
});
