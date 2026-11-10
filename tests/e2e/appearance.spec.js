const { test, expect, openMenu, createWorld } = require('./fixtures');

async function loadWorld(page, name) {
  await page
    .locator('#wl .r')
    .filter({ hasText: name })
    .getByRole('button', { name: 'Jogar', exact: true })
    .click();
  await expect(page.locator('#m')).toBeHidden();
}
async function observeMotion(page, keys, milliseconds = 280) {
  for (const key of keys) await page.keyboard.down(key);
  try {
    return await page.evaluate(
      (milliseconds) =>
        new Promise((resolve) => {
          const start = performance.now(),
            samples = [];
          const frame = () => {
            samples.push({ ...G.avatar, x: G.px, y: G.py });
            if (performance.now() - start >= milliseconds) resolve(samples);
            else requestAnimationFrame(frame);
          };
          requestAnimationFrame(frame);
        }),
      milliseconds,
    );
  } finally {
    for (const key of keys) await page.keyboard.up(key);
  }
}

test('official inline atlas decodes once and its supplied artwork appears on the actual world Canvas at all zooms', async ({
  page,
}, testInfo) => {
  await openMenu(page);
  await expect(page.locator('#player-asset-status')).toContainText('Personagem oficial carregado');
  expect(
    await page.evaluate(() => {
      const record = PLAYER_ASSETS.get('official_player');
      return {
        cached: loadPlayerAsset('official_player') === record,
        count: PLAYER_ASSETS.size,
        dimensions: [record.image.naturalWidth, record.image.naturalHeight],
        scale: PLAYER_ATLAS.scale,
      };
    }),
  ).toEqual({ cached: true, count: 1, dimensions: [1152, 1088], scale: 0.125 });
  await createWorld(page);
  // Expected pixels come directly from the decoded supplied artwork, independently
  // of the game's player/drawAppearance functions. Most supplied pixels have
  // partial alpha: allow the bounded contribution of the terrain behind them.
  for (const zoom of [0, 1, 2, 3]) {
    await expect.poll(() => page.evaluate(() => zi)).toBe(zoom === 0 ? 1 : zoom - 1);
    if (zoom === 0) await page.keyboard.press('-');
    else await page.keyboard.press('+');
    await expect
      .poll(() =>
        page.evaluate(() => {
          const expected = document.createElement('canvas');
          expected.width = 960;
          expected.height = 540;
          const e = expected.getContext('2d'),
            v = G.view;
          e.imageSmoothingEnabled = false;
          e.setTransform(v.z, 0, 0, v.z, -v.ox * v.z, -v.oy * v.z);
          e.drawImage(
            PLAYER_ASSETS.get('official_player').image,
            0,
            0,
            192,
            272,
            Math.round(G.px - 12),
            Math.round(G.py - 33),
            24,
            34,
          );
          const target = e.getImageData(0, 0, 960, 540).data;
          const actual = ctx.getImageData(0, 0, 960, 540).data;
          let opaque = 0,
            matched = 0;
          for (let i = 0; i < target.length; i += 4)
            if (target[i + 3] >= 250) {
              opaque++;
              if (
                Math.abs(target[i] - actual[i]) <= 6 &&
                Math.abs(target[i + 1] - actual[i + 1]) <= 6 &&
                Math.abs(target[i + 2] - actual[i + 2]) <= 6
              )
                matched++;
            }
          // At alpha >= 250, background contribution plus rounding is at most 6.
          return opaque > 100 && matched === opaque;
        }),
      )
      .toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`official-character-zoom-${zoom}.png`) });
  }
});

test('real WASD drives four distinct walk rows, returns to idle, and diagonals keep one direction', async ({
  page,
}) => {
  await openMenu(page);
  await createWorld(page);
  for (const [key, direction, axis, sign] of [
    ['d', 3, 'x', 1],
    ['a', 2, 'x', -1],
    ['s', 0, 'y', 1],
    ['w', 1, 'y', -1],
  ]) {
    const before = await page.evaluate(() => ({ x: G.px, y: G.py }));
    const samples = await observeMotion(page, [key]);
    const walking = samples.filter((sample) => sample.state === 'walk');
    expect(walking.length).toBeGreaterThan(1);
    expect([...new Set(walking.map((sample) => sample.direction))]).toEqual([direction]);
    expect(new Set(walking.map((sample) => sample.frame)).size).toBeGreaterThan(1);
    expect((samples.at(-1)[axis] - before[axis]) * sign).toBeGreaterThan(8);
    await expect
      .poll(() => page.evaluate(() => [G.avatar.state, G.avatar.frame, G.avatar.direction]))
      .toEqual(['idle', 0, direction]);
  }
  const diagonal = (await observeMotion(page, ['w', 'd'])).filter(
    (sample) => sample.state === 'walk',
  );
  expect(diagonal.length).toBeGreaterThan(1);
  expect([...new Set(diagonal.map((sample) => sample.direction))]).toEqual([1]);
});

test('PERSONAGEM previews all four actual views, offers no missing clothes and blocks world actions', async ({
  page,
}, testInfo) => {
  await openMenu(page);
  await createWorld(page);
  await page.keyboard.press('i');
  await page.locator('#appearance-open').click();
  await expect(page.getByRole('dialog', { name: 'PERSONAGEM', exact: true })).toBeVisible();
  await expect(page.locator('#inventory-panel')).toBeHidden();
  await expect(page.locator('#appearance-layer-status')).toContainText(
    'não inclui corpo, cabelo ou roupas separados',
  );
  const views = [];
  for (const direction of ['0', '1', '2', '3']) {
    await page.locator('#appearance-direction').selectOption(direction);
    views.push(await page.locator('#appearance-preview').evaluate((canvas) => canvas.toDataURL()));
  }
  expect(new Set(views).size).toBe(4);
  for (const slot of ['hair', 'shirt', 'pants', 'boots']) {
    await expect(page.locator('#appearance-' + slot)).toBeDisabled();
    await expect(page.locator(`#appearance-${slot} option`)).toHaveCount(1);
    await expect(page.locator(`#appearance-${slot} option`)).toHaveText(/não fornecida/);
  }
  const snapshot = () =>
    page.evaluate(() => ({
      x: G.px,
      y: G.py,
      boat: G.boat,
      inventory: JSON.stringify(G.inventory),
      appearance: G.appearance,
      stats: G.combat.stats,
      targets: G.combat.targets,
      damage: [...G.collection.damage],
      clock: G.combat.clock,
      camera: [G.cx, G.cy],
    }));
  const before = await snapshot();
  await observeMotion(page, ['d']);
  for (const key of ['Space', 'e', 'f', 'm', '1', '9']) await page.keyboard.press(key);
  const preview = await page.locator('#appearance-preview').boundingBox();
  await page.mouse.click(preview.x + 20, preview.y + 20);
  await page.mouse.click(preview.x + 20, preview.y + 20, { button: 'right' });
  expect(await snapshot()).toEqual(before);
  expect(await page.evaluate(() => [appearanceOpen, G.combat.active, G.combat.dodge])).toEqual([
    true,
    null,
    null,
  ]);
  await page.screenshot({ path: testInfo.outputPath('personagem-panel.png') });
  await page.locator('#appearance-close').click();
  await expect(page.locator('#inventory-panel')).toBeVisible();
  await expect(page.locator('#hotbar button')).toHaveCount(9);
  await page.keyboard.press('i');
  const motion = await observeMotion(page, ['d']);
  expect(motion.some((sample) => sample.state === 'walk')).toBe(true);
});

test('appearance persists per world and reload does not change inventory or combat attributes', async ({
  page,
}) => {
  await openMenu(page);
  const first = await createWorld(page, 'Aparência A');
  const expected = await page.evaluate(() => ({
    appearance: G.appearance,
    inventory: JSON.stringify(G.inventory),
    combat: serializeCombat(G.combat),
  }));
  await page.keyboard.press('Escape');
  const second = await createWorld(page, 'Aparência B');
  expect(second.id).not.toBe(first.id);
  await page.keyboard.press('Escape');
  await page.reload();
  await loadWorld(page, 'Aparência A');
  expect(
    await page.evaluate(() => ({
      appearance: G.appearance,
      inventory: JSON.stringify(G.inventory),
      combat: serializeCombat(G.combat),
    })),
  ).toEqual(expected);
  await page.keyboard.press('Escape');
  const a = await page.evaluate(
    (id) => JSON.parse(localStorage.getItem('origens_w_' + id)),
    first.id,
  );
  const b = await page.evaluate(
    (id) => JSON.parse(localStorage.getItem('origens_w_' + id)),
    second.id,
  );
  expect(a.v).toBe(8);
  expect(b.v).toBe(8);
  expect(a.appearance).toEqual(expected.appearance);
  expect(b.appearance).toEqual(expected.appearance);
  expect(a.id).not.toBe(b.id);
});

test('a real v0.8 combat save migrates once with original backup and preserves all previous progress', async ({
  page,
}) => {
  await page.goto('/' + encodeURIComponent('ORIGENS — Survival v0.8 Combate.html'));
  const world = await createWorld(page, 'Migração v0.8 real');
  // A declared fixture with actual inventory serialization, not a fabricated old schema.
  await page.evaluate(() => {
    for (const id of [
      'primitive_sword',
      'primitive_spear',
      'training_staff',
      'stone_axe',
      'stone_pickaxe',
    ])
      addItems(G.inventory, id, 1);
    addItems(G.inventory, 'wood', 17);
    inventoryChanged();
    applyPlayerDamage(13, 'appearance-migration-fixture');
  });
  await page.keyboard.press('Escape');
  const original = await page.evaluate((id) => localStorage.getItem('origens_w_' + id), world.id);
  expect(JSON.parse(original).v).toBe(7);
  await openMenu(page);
  await loadWorld(page, 'Migração v0.8 real');
  expect(
    await page.evaluate(() => [G.combat.stats.health, G.inventory.slots.filter(Boolean).length]),
  ).toEqual([87, 6]);
  expect(await page.evaluate(() => validAppearance(G.appearance))).toBe(true);
  await page.keyboard.press('Escape');
  const migrated = await page.evaluate(
    (id) => ({
      value: JSON.parse(localStorage.getItem('origens_w_' + id)),
      backup: localStorage.getItem('origens_w_' + id + '_backup_v7'),
    }),
    world.id,
  );
  expect(migrated.backup).toBe(original);
  const { v, appearance, ...rest } = migrated.value;
  const { v: oldVersion, ...oldRest } = JSON.parse(original);
  expect(v).toBe(8);
  expect(oldVersion).toBe(7);
  expect(appearance.outfit).toBe('original');
  expect(rest).toEqual(oldRest);
  await page.reload();
  await loadWorld(page, 'Migração v0.8 real');
  await page.keyboard.press('Escape');
  expect(
    await page.evaluate((id) => localStorage.getItem('origens_w_' + id + '_backup_v7'), world.id),
  ).toBe(original);
});

test('unknown saved clothing is protected on disk instead of silently replacing it with defaults', async ({
  page,
}) => {
  await openMenu(page);
  const world = await createWorld(page, 'Aparência desconhecida');
  await page.keyboard.press('Escape');
  const original = await page.evaluate((id) => {
    const key = 'origens_w_' + id,
      saved = JSON.parse(localStorage.getItem(key));
    saved.appearance.shirt = 'asset-from-newer-version';
    const raw = JSON.stringify(saved);
    localStorage.setItem(key, raw);
    return raw;
  }, world.id);
  await page.reload();
  await loadWorld(page, 'Aparência desconhecida');
  expect(await page.evaluate(() => G.saveProtected)).toBe(true);
  await page.keyboard.press('Escape');
  expect(await page.evaluate((id) => localStorage.getItem('origens_w_' + id), world.id)).toBe(
    original,
  );
});

test('decoded asset with invalid dimensions displays an explicit fallback without deleting appearance', async ({
  page,
}, testInfo) => {
  // Failure injection is limited to the HTTP fixture; production code stays intact.
  await page.route('http://127.0.0.1:4173/', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      /const PLAYER_ASSET_DATA='[^']+';/,
      "const PLAYER_ASSET_DATA='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';",
    );
    await route.fulfill({ response, body });
  });
  await openMenu(page);
  await expect(page.locator('#player-asset-status')).toContainText('Dimensões inesperadas');
  const world = await createWorld(page, 'Fallback explícito');
  await observeMotion(page, ['d']);
  expect(await page.evaluate(() => [G.avatarAssetWarning, G.appearance.outfit])).toEqual([
    true,
    'original',
  ]);
  await page.screenshot({ path: testInfo.outputPath('asset-fallback.png') });
  await page.keyboard.press('Escape');
  const saved = await page.evaluate(
    (id) => JSON.parse(localStorage.getItem('origens_w_' + id)),
    world.id,
  );
  expect(saved.appearance.outfit).toBe('original');
});

for (const viewport of [
  { width: 640, height: 480 },
  { width: 390, height: 844 },
]) {
  test(`PERSONAGEM remains usable at ${viewport.width}×${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await openMenu(page);
    await createWorld(page);
    await page.keyboard.press('i');
    await page.locator('#appearance-open').click();
    const panel = page.locator('#appearance-panel');
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    await page.locator('#appearance-direction').selectOption('1');
    await page.locator('#appearance-boots').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('personagem-responsive.png') });
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(page.locator('#inventory-panel')).toBeVisible();
  });
}

test.skip('independent shirt/pants/boots replacement requires separate alternate layers, absent from the supplied ZIP', () => {});
test.skip('independent neutral body and hair composition requires separated body/hair images, absent from the supplied ZIP', () => {});
test.skip('dedicated idle and combat animation cycles require additional frames, absent from the supplied ZIP', () => {});
