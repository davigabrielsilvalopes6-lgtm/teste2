const { test, expect, openMenu, createWorld } = require('./fixtures');
const { gatherNatural, moveTo } = require('./combat-navigation');

async function training(page, name = 'Combate de teste') {
  await page.goto('/?treino=1');
  await createWorld(page, name);
  await expect(page.locator('#combat-training')).toBeVisible();
}
async function craft(page, id) {
  await page.locator(`[data-recipe="recipe_${id}"]`).click();
  await expect(page.locator('#crafting-once')).toBeEnabled();
  await page.locator('#crafting-once').click();
}
async function equip(page, id, slot = 0) {
  await page.keyboard.press('i');
  const index = await page.evaluate(
    (id) => G.inventory.slots.findIndex((s) => s?.itemId === id),
    id,
  );
  expect(index).toBeGreaterThanOrEqual(0);
  if (index !== slot) {
    await page.locator(`[data-slot="${index}"]`).click();
    await page.locator(`[data-slot="${slot}"]`).click();
    if (await page.evaluate(() => !!G.inventory.cursor))
      await page.locator(`[data-slot="${index}"]`).click();
  }
  await page.keyboard.press('i');
  await page.keyboard.press(String(slot + 1));
}
async function aim(page, point, button = 'left') {
  const p = await page.evaluate((p) => {
    const r = cv.getBoundingClientRect();
    return {
      x: r.left + ((p.x - G.view.ox) * G.view.z * r.width) / 960,
      y: r.top + ((p.y - G.view.oy) * G.view.z * r.height) / 540,
    };
  }, point);
  await page.mouse.move(p.x, p.y);
  if (button) await page.mouse.click(p.x, p.y, { button });
}
async function seedWeapon(page, id) {
  await page.evaluate((id) => {
    addItems(G.inventory, id, 1);
    inventoryChanged();
  }, id);
  await page.keyboard.press('1');
}
async function load(page, name) {
  await page
    .locator('#wl .r')
    .filter({ hasText: name })
    .getByRole('button', { name: 'Jogar', exact: true })
    .click();
  await expect(page.locator('#m')).toBeHidden();
}

test('normal world exposes actual health bars and receives no free weapons or training targets', async ({
  page,
}) => {
  await openMenu(page);
  await createWorld(page);
  await expect(page.locator('#combat-training')).toBeHidden();
  expect(await page.evaluate(() => G.combat.targets.length)).toBe(0);
  expect(await page.evaluate(() => G.inventory.slots.filter(Boolean))).toEqual([]);
  for (const id of ['health', 'stamina', 'elementalEnergy'])
    await expect(page.locator('#combat-' + id)).toHaveJSProperty('value', 100);
  await expect(page.locator('#inventory-grid button')).toHaveCount(16);
  await expect(page.locator('#hotbar button')).toHaveCount(9);
  await page.keyboard.press('Escape');
  await page.locator('#combat-training-link').click();
  await expect(page).toHaveURL(/#treino=1$/);
  await createWorld(page, 'Treino pelo menu');
  await expect(page.locator('#combat-training')).toBeVisible();
});

test('natural sword: gather, craft, equip, aim, hit, special, save and reload without injecting materials', async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  const name = 'Espada de recursos naturais';
  await training(page, name);
  await gatherNatural(page, 1, 3);
  await gatherNatural(page, 2, 4);
  await page.keyboard.press('c');
  for (const id of [
    'stick',
    'plank',
    'chipped_stone',
    'chipped_stone',
    'simple_handle',
    'primitive_sword',
  ])
    await craft(page, id);
  await page.keyboard.press('c');
  await equip(page, 'primitive_sword');
  await page.locator('#training-targets').click();
  const approach = await page.evaluate(() => {
    for (const t of G.combat.targets) {
      const dx = t.x - G.px,
        dy = t.y - (G.py - 12),
        d = Math.hypot(dx, dy),
        x = G.px + (dx / d) * 22,
        y = G.py + (dy / d) * 22;
      let clear = true;
      for (let i = 1; i <= 8; i++)
        if (blocked(G.w, G.px + ((x - G.px) * i) / 8, G.py + ((y - G.py) * i) / 8, 0))
          clear = false;
      if (clear) return { target: { id: t.id, x: t.x, y: t.y }, point: { x, y } };
    }
    return null;
  });
  expect(approach).not.toBeNull();
  await moveTo(page, approach.point.x, approach.point.y);
  await page.waitForTimeout(400);
  await aim(page, approach.target);
  await aim(page, approach.target);
  await expect
    .poll(() =>
      page.evaluate((id) => G.combat.targets.find((t) => t.id === id).health, approach.target.id),
    )
    .toBe(88);
  await page.waitForTimeout(550);
  await aim(page, approach.target, 'right');
  await expect
    .poll(() =>
      page.evaluate((id) => G.combat.targets.find((t) => t.id === id).health, approach.target.id),
    )
    .toBe(64);
  const stamina = await page.evaluate(() => G.combat.stats.stamina);
  expect(stamina).toBeLessThanOrEqual(81);
  expect(stamina).toBeGreaterThanOrEqual(80);
  await expect(page.locator('#combat-stamina')).toHaveJSProperty('value', stamina);
  await page.screenshot({ path: testInfo.outputPath('espada-treino.png') });
  const inventory = await page.evaluate(() => JSON.stringify(G.inventory.slots));
  await page.keyboard.press('Escape');
  await expect(page.locator('#m')).toBeVisible();
  await page.reload();
  await load(page, name);
  expect(await page.evaluate(() => JSON.stringify(G.inventory.slots))).toBe(inventory);
  expect(await page.evaluate(() => activeWeapon().id)).toBe('primitive_sword');
  expect(await page.evaluate(() => G.combat.projectiles.length)).toBe(0);
  expect(await page.evaluate(() => G.combat.active)).toBeNull();
});

test('staff and spear recipes, projectile hits and special costs use real mouse controls', async ({
  page,
}, testInfo) => {
  await training(page);
  await page.evaluate(() => {
    addItems(G.inventory, 'simple_handle', 3);
    addItems(G.inventory, 'chipped_stone', 4);
    addItems(G.inventory, 'ore', 1);
    addItems(G.inventory, 'stick', 3);
    inventoryChanged();
  });
  await page.keyboard.press('c');
  await craft(page, 'training_staff');
  await craft(page, 'primitive_spear');
  await page.keyboard.press('c');
  await equip(page, 'training_staff');
  // A bounded target fixture makes the projectile timing inspectable; damage and input remain real.
  const target = await page.evaluate(() => {
    G.combat.targets = [
      { id: 'ranged', x: G.px + 36, y: G.py - 12, radius: 12, health: 100, maxHealth: 100 },
    ];
    return { x: G.px + 36, y: G.py - 12 };
  });
  await aim(page, target);
  await expect.poll(() => page.evaluate(() => G.combat.targets[0].health)).toBe(92);
  await page.waitForTimeout(600);
  await aim(page, target, 'right');
  await expect.poll(() => page.evaluate(() => G.combat.targets[0].health)).toBe(76);
  expect(await page.evaluate(() => G.combat.stats.elementalEnergy)).toBeLessThan(81);
  await expect(page.locator('#combat-elementalEnergy')).toHaveJSProperty(
    'value',
    await page.evaluate(() => G.combat.stats.elementalEnergy),
  );
  await page.waitForTimeout(3100);
  const exhausted = await page.evaluate(() => {
    G.combat.stats.elementalEnergy = 0;
    return { clock: G.combat.clock, nextSpecial: G.combat.nextSpecial, serial: G.combat.serial };
  });
  await aim(page, target, 'right');
  const rejected = await page.evaluate(() => ({
    clock: G.combat.clock,
    energy: G.combat.stats.elementalEnergy,
    nextSpecial: G.combat.nextSpecial,
    serial: G.combat.serial,
  }));
  // Native mouse delivery may take several frames. Energy keeps regenerating
  // at the existing 6/s; reject the attack without pretending that time stopped.
  expect(rejected.energy).toBeCloseTo((rejected.clock - exhausted.clock) * 6, 5);
  expect(rejected.nextSpecial).toBe(exhausted.nextSpecial);
  expect(rejected.serial).toBe(exhausted.serial);
  expect(await page.evaluate(() => G.combat.targets[0].health)).toBe(76);
  expect(await page.evaluate(() => G.combat.projectiles.length)).toBe(0);
  await equip(page, 'primitive_spear');
  await page.waitForTimeout(600);
  await aim(page, target);
  await expect.poll(() => page.evaluate(() => G.combat.targets[0].health)).toBe(61);
  await page.screenshot({ path: testInfo.outputPath('cajado-lanca.png') });
});

test('Space dodge spends vigor and returns controls; recovery follows time instead of draw count', async ({
  page,
}) => {
  await training(page);
  const before = await page.evaluate(() => ({ x: G.px, y: G.py }));
  await page.keyboard.down('d');
  await page.keyboard.press('Space');
  await page.keyboard.up('d');
  await expect.poll(() => page.evaluate(() => G.combat.dodge === null)).toBe(true);
  const after = await page.evaluate(() => ({ x: G.px, y: G.py, stamina: G.combat.stats.stamina }));
  expect(after.x - before.x).toBeGreaterThan(25);
  expect(after.x - before.x).toBeLessThan(56);
  expect(after.stamina).toBeLessThan(81);
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => G.combat.stats.stamina)).toBeLessThan(81);
  await expect
    .poll(() => page.evaluate(() => G.combat.stats.stamina), { timeout: 4000 })
    .toBeGreaterThan(88);
});

test('simulated damage, immunity, defeat and recovery update actual HUD without changing inventory', async ({
  page,
}, testInfo) => {
  await training(page);
  await seedWeapon(page, 'primitive_sword');
  const inv = await page.evaluate(() => JSON.stringify(G.inventory.slots));
  await page.locator('#training-damage').click();
  await page.locator('#training-damage').click();
  await expect(page.locator('#combat-health')).toHaveJSProperty('value', 90);
  await page.waitForTimeout(550);
  await page.locator('#training-defeat').click();
  await expect(page.locator('#combat-defeat')).toBeVisible();
  await expect(page.locator('#combat-health')).toHaveJSProperty('value', 0);
  const point = await page.evaluate(() => ({ x: G.px + 30, y: G.py - 12 }));
  await aim(page, point);
  expect(await page.evaluate(() => G.combat.active)).toBeNull();
  expect(await page.evaluate(() => JSON.stringify(G.inventory.slots))).toBe(inv);
  await page.screenshot({ path: testInfo.outputPath('derrota-teste.png') });
  await page.locator('#training-recover').click();
  await expect(page.locator('#combat-health')).toHaveJSProperty('value', 100);
  expect(await page.evaluate(() => JSON.stringify(G.inventory.slots))).toBe(inv);
});

test('inventory, crafting, map, cursor and raft reject mouse attacks without consumption', async ({
  page,
}) => {
  await training(page);
  await seedWeapon(page, 'primitive_sword');
  await page.keyboard.press('i');
  const original = await page.evaluate(() => G.combat.stats.stamina);
  await page.keyboard.press('Space');
  await page.locator('#inventory-grid [data-slot="0"]').click({ button: 'right' });
  expect(await page.evaluate(() => G.combat.active)).toBeNull();
  expect(await page.evaluate(() => G.combat.stats.stamina)).toBe(original);
  await page.locator('#inventory-grid [data-slot="0"]').click();
  await page.keyboard.press('i');
  await page.keyboard.press('c');
  await page.locator('[data-recipe="recipe_primitive_sword"]').click();
  expect(await page.evaluate(() => G.combat.active)).toBeNull();
  await page.keyboard.press('c');
  await page.keyboard.press('m');
  await aim(page, await page.evaluate(() => ({ x: G.px + 30, y: G.py - 12 })), 'right');
  expect(await page.evaluate(() => G.combat.active)).toBeNull();
  await page.keyboard.press('m');
  await page.evaluate(() => {
    G.boat = 1;
  });
  await aim(page, await page.evaluate(() => ({ x: G.px + 30, y: G.py - 12 })), 'right');
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => G.combat.active)).toBeNull();
  expect(await page.evaluate(() => G.combat.stats.stamina)).toBe(original);
});

for (const size of [
  { width: 1280, height: 800 },
  { width: 640, height: 480 },
])
  test(`weapon pixels and real progress bars remain visible at ${size.width}×${size.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(size);
    await openMenu(page);
    await createWorld(page);
    await seedWeapon(page, 'primitive_sword');
    await page.waitForTimeout(1000);
    const raster = () =>
      page.evaluate(() => {
        const x = Math.round((G.px - G.view.ox) * G.view.z),
          y = Math.round((G.py - G.view.oy) * G.view.z);
        return Array.from(ctx.getImageData(x - 48, y - 64, 96, 80).data);
      });
    const weapon = await raster();
    await page.keyboard.press('9');
    await page.waitForTimeout(60);
    const empty = await raster();
    expect(weapon.filter((v, i) => v !== empty[i]).length).toBeGreaterThan(15);
    const hud = await page.locator('#combat-hud').boundingBox(),
      hotbar = await page.locator('#hotbar').boundingBox();
    expect(hud.y + hud.height).toBeLessThan(hotbar.y);
    await page.keyboard.press('1');
    await page.screenshot({ path: testInfo.outputPath('hud-combate.png') });
  });

test('real old chest save migrates with its contents and receives no weapons', async ({ page }) => {
  await page.goto('/' + encodeURIComponent('ORIGENS — Survival v0.8.html'));
  await createWorld(page, 'Legado com baú');
  const record = await page.evaluate(() => {
    addItems(G.inventory, 'wooden_chest', 1);
    for (let y = Math.floor(G.py / T) - 2; y <= Math.floor(G.py / T) + 2; y++)
      for (let x = Math.floor(G.px / T) - 2; x <= Math.floor(G.px / T) + 2; x++)
        if (canPlaceStorageChest(x, y).ok) {
          const r = placeStorageChest(x, y);
          if (r.ok) {
            G.storage.byId.get(r.id).slots[8] = { itemId: 'wood', quantity: 31 };
            inventoryChanged();
            return { id: G.id, chest: r.id };
          }
        }
    throw new Error('Legacy fixture needs one valid chest tile');
  });
  await page.keyboard.press('Escape');
  const old = await page.evaluate((id) => localStorage.getItem('origens_w_' + id), record.id);
  await page.goto('/');
  await load(page, 'Legado com baú');
  expect(await page.evaluate((id) => G.storage.byId.get(id).slots[8], record.chest)).toEqual({
    itemId: 'wood',
    quantity: 31,
  });
  expect(await page.evaluate(() => G.combat.stats.health)).toBe(100);
  expect(await page.evaluate(() => activeWeapon())).toBeNull();
  await page.keyboard.press('Escape');
  expect(
    await page.evaluate((id) => localStorage.getItem('origens_w_' + id + '_backup_v6'), record.id),
  ).toBe(old);
});
