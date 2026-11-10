const { test, expect, openMenu, createWorld, movePlayer, canvasClick } = require('./fixtures');

test('loads the game document, Canvas and functioning world-creation menu', async ({ page }) => {
  await openMenu(page);
  await expect(page.locator('h1')).toHaveText('ORIGENS');
  await expect(page.locator('#c')).toBeVisible();
  expect(await page.locator('#c').evaluate(canvas => ({ width: canvas.width, height: canvas.height })))
    .toEqual({ width: 960, height: 540 });
  expect(await page.locator('#sz option').evaluateAll(options => options.map(option => option.value)))
    .toEqual(['128', '256', '512', '1024']);
  const previousSeed = await page.locator('#sd').inputValue();
  await page.locator('#rn').click();
  await expect(page.locator('#sd')).not.toHaveValue(previousSeed);
  await createWorld(page, 'Menu smoke');
  expect(await page.evaluate(() => ({ name: G.w.name, seed: G.w.seed, size: G.w.N, valid: G.w.ok })))
    .toEqual({ name: 'Menu smoke', seed: 'TEST-128-0', size: 128, valid: true });
});

test('generates the map and renders terrain, player and minimap pixels', async ({ page }) => {
  await openMenu(page);
  await createWorld(page);
  const world = await page.evaluate(() => ({
    length: G.w.ter.length,
    objects: G.w.ob.length,
    land: G.w.ter.some(t => t >= 3 && t !== 8),
    ocean: G.w.sea.some(value => value === 1),
    islands: G.w.I.length,
    spawnIsWalkable: !blocked(G.w, G.px, G.py, G.boat),
    explored: G.ex.some(value => value !== 0),
  }));
  expect(world).toMatchObject({ length: 128 * 128, objects: 128 * 128, land: true,
    ocean: true, spawnIsWalkable: true, explored: true });
  expect(world.islands).toBeGreaterThanOrEqual(5);

  // Read the actual raster, not just Canvas existence or absence of exceptions.
  await expect.poll(() => page.evaluate(() => {
    const pixels = ctx.getImageData(200, 180, 560, 220).data;
    const palette = new Set(TC.flat().map(hex => parseInt(hex.slice(1), 16)));
    let terrainPixels = 0, opaquePixels = 0, playerPixels = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const color = (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2];
      if (palette.has(color)) terrainPixels++;
      if (pixels[i + 3] === 255) opaquePixels++;
      if (color === 0xd9534f) playerPixels++;
    }
    return terrainPixels > 1000 && opaquePixels > 1000 && playerPixels > 0;
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const pixel = G.mx.getImageData(G.tx, G.ty, 1, 1).data;
    return pixel[3] === 255 && !(pixel[0] === 11 && pixel[1] === 18 && pixel[2] === 25);
  })).toBe(true);
  // Also verify the minimap's copy to the visible Canvas, away from its blinking
  // player marker. Each source pixel is rendered as 2x2 destination pixels.
  await expect.poll(() => page.evaluate(() => {
    const source = G.mx.getImageData(G.tx - 2, G.ty, 1, 1).data;
    const visible = ctx.getImageData(W0 - 138 + 60, 10 + 64, 1, 1).data;
    const border = ctx.getImageData(W0 - 141, 100, 1, 1).data;
    return source[3] === 255 && !(source[0] === 11 && source[1] === 18 && source[2] === 25)
      && source.every((value, i) => value === visible[i])
      && [...border].join(',') === '143,211,199,255';
  })).toBe(true);
});

test('loads the essential inline Canvas artwork with nontransparent content', async ({ page }) => {
  await openMenu(page);
  const artwork = await page.evaluate(() => {
    const populated = canvas => {
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) return true;
      return false;
    };
    const assets = [...A.flat(), ...TS.flat(), ...RS, ...CS, RD, SH];
    return {
      tiles: A.length, treeBiomes: TS.length, rocks: RS.length, crystals: CS.length,
      allPopulated: assets.every(populated),
      treesAreAnchoredSprites: TS.flat().every(canvas => canvas.width === 64 && canvas.height === 96),
    };
  });
  expect(artwork).toEqual({ tiles: 10, treeBiomes: 5, rocks: 5, crystals: 2,
    allPopulated: true, treesAreAnchoredSprites: true });
});

test('WASD changes player position through actual keyboard input', async ({ page }) => {
  await openMenu(page);
  await createWorld(page);
  // The generated spawn has a safe clearing; no state is changed by the harness.
  for (const [key, axis, sign] of [['d', 'x', 1], ['a', 'x', -1], ['s', 'y', 1], ['w', 'y', -1]]) {
    const before = await page.evaluate(() => ({ x: G.px, y: G.py }));
    const after = await movePlayer(page, key, axis, sign);
    expect((after[axis] - before[axis]) * sign).toBeGreaterThan(8);
    const other = axis === 'x' ? 'y' : 'x';
    expect(Math.abs(after[other] - before[other])).toBeLessThan(0.1);
    expect(await page.evaluate(() => blocked(G.w, G.px, G.py, G.boat))).toBe(0);
  }
});

test('full map opens, draws, zooms and drags while movement is paused', async ({ page }) => {
  await openMenu(page);
  await createWorld(page);
  await page.keyboard.press('m');
  await expect.poll(() => page.evaluate(() => mapOpen)).toBe(1);
  await expect.poll(() => page.evaluate(() => {
    const pixel = ctx.getImageData(10, 100, 1, 1).data;
    return [...pixel];
  })).toEqual([143, 211, 199, 255]);
  const position = await page.evaluate(() => ({ x: G.px, y: G.py }));
  await page.keyboard.down('d');
  try {
    // Wait for actual frames rather than asserting immediately after keydown.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  } finally {
    await page.keyboard.up('d');
  }
  expect(await page.evaluate(() => ({ x: G.px, y: G.py }))).toEqual(position);
  const initialZoom = await page.evaluate(() => G.mz);
  await page.keyboard.press('+');
  expect(await page.evaluate(() => G.mz)).toBeGreaterThan(initialZoom);
  const box = await page.locator('#c').boundingBox();
  const center = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 };
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 60, center.y + 35, { steps: 3 });
  await page.mouse.up();
  expect(await page.evaluate(() => Math.abs(G.mpx) + Math.abs(G.mpy))).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => mapOpen)).toBe(0);
  await expect(page.locator('#m')).toBeHidden();
  await movePlayer(page, 'd', 'x');
});

test('HUD reveal, zoom and debug controls leave the interface usable', async ({ page }) => {
  await openMenu(page);
  await createWorld(page);
  const initialZoom = await page.evaluate(() => zi);
  await page.keyboard.press('+');
  expect(await page.evaluate(() => zi)).toBe(initialZoom + 1);
  await page.keyboard.press('-');
  expect(await page.evaluate(() => zi)).toBe(initialZoom);
  await page.keyboard.press('F3');
  expect(await page.evaluate(() => dbg)).toBe(1);
  await page.keyboard.press('F3');
  expect(await page.evaluate(() => dbg)).toBe(0);
  expect(await page.evaluate(() => G.ex.every(value => value === 255))).toBe(false);
  await canvasClick(page, 860, 156);
  expect(await page.evaluate(() => G.ex.every(value => value === 255))).toBe(true);
  expect(await page.evaluate(() => G.collection.damage.size)).toBe(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#m')).toBeVisible();
  await expect(page.locator('#wl .r')).toHaveCount(1);
  await expect(page.locator('#cr')).toBeEnabled();
});

test('reload preserves the saved world and permits resuming through the menu', async ({ page }) => {
  await openMenu(page);
  const initial = await createWorld(page, 'Saved World');
  await movePlayer(page, 'd', 'x');
  const moved = await page.evaluate(() => ({ x: G.px, y: G.py }));
  await page.keyboard.press('Escape');
  await expect(page.locator('#m')).toBeVisible();
  const saved = await page.evaluate(id => JSON.parse(localStorage.getItem('origens_w_' + id)), initial.id);
  expect(saved).toMatchObject({ id: initial.id, v: 6, gv: 2, x: moved.x, y: moved.y });
  await page.reload();
  await expect(page.locator('#m')).toBeVisible();
  await expect(page.locator('#wl .r')).toHaveCount(1);
  await expect(page.locator('#wl .r')).toContainText('Saved World');
  await page.getByRole('button', { name: 'Jogar', exact: true }).click();
  await expect(page.locator('#m')).toBeHidden();
  await expect.poll(() => page.evaluate(() => !!G && !busy && !!G.view)).toBe(true);
  expect(await page.evaluate(() => ({ id: G.id, name: G.w.name, x: G.px, y: G.py })))
    .toEqual({ id: initial.id, name: 'Saved World', x: moved.x, y: moved.y });
  await movePlayer(page, 's', 'y');
});

test('reload before world creation returns to a working initial menu', async ({ page }) => {
  await openMenu(page);
  await page.reload();
  await expect(page.locator('#m')).toBeVisible();
  await expect(page.locator('#wl .r')).toHaveCount(0);
  await createWorld(page, 'After Reload');
  expect(await page.evaluate(() => G.w.name)).toBe('After Reload');
});

test.skip('elemental-origin choice (not implemented in the current game)', async () => {
  // Elemental regions exist in the generator, but there is no origin-selection UI
  // or player-origin state in v0.4. Do not pretend that the feature was tested.
});
