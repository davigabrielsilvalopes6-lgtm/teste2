const { test, expect, openMenu, createWorld } = require('./fixtures');

// Fixtures provide the user's tools and backpacks. Pointer, keyboard, expansion,
// screenshots and Canvas samples exercise the actual game without replacing it.
async function supplyItems(page) {
  await page.evaluate(() => {
    for (const id of ['stone_axe', 'stone_pickaxe', 'rustic_backpack', 'reinforced_backpack']) {
      if (addItems(G.inventory, id, 1)) throw new Error('Fixture does not fit');
    }
    inventoryChanged();
  });
}

async function frames(page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

async function upgrade(page) {
  await page.keyboard.press('3');
  await expect(page.locator('#inventory-use-backpack')).toBeEnabled();
  await page.locator('#inventory-use-backpack').click();
  await expect(page.locator('#inventory-grid button')).toHaveCount(24);
  await page.keyboard.press('4');
  await expect(page.locator('#inventory-use-backpack')).toBeEnabled();
  await page.locator('#inventory-use-backpack').click();
  await expect(page.locator('#inventory-grid button')).toHaveCount(32);
}

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 640, height: 480 },
  { width: 390, height: 844 },
]) {
  test(`expanded inventory stays legible and clickable at ${viewport.width}×${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await openMenu(page);
    await createWorld(page, 'Visual backpack');
    await supplyItems(page);
    await page.keyboard.press('i');
    await upgrade(page);
    const geometry = await page.evaluate(() => {
      const rect = (element) => {
        const r = element.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width };
      };
      return {
        tier: rect(document.querySelector('#inventory-tier-info')),
        help: rect(document.querySelector('#inventory-panel .inventory-help')),
        occupied: [...document.querySelectorAll('#inventory-grid .is-occupied')].map((button) => ({
          slot: rect(button),
          icon: rect(button.querySelector('.item-icon')),
        })),
      };
    });
    expect(geometry.tier.bottom).toBeLessThanOrEqual(geometry.help.top);
    for (const { slot, icon } of geometry.occupied) {
      expect(icon.left).toBeGreaterThanOrEqual(slot.left);
      expect(icon.right).toBeLessThanOrEqual(slot.right);
      expect(icon.top).toBeGreaterThanOrEqual(slot.top);
      expect(icon.bottom).toBeLessThanOrEqual(slot.bottom);
    }
    await page.locator('#inventory-grid [data-slot="0"]').click();
    await page.locator('#inventory-grid [data-slot="31"]').click();
    expect(await page.evaluate(() => G.inventory.slots[31])).toEqual({
      itemId: 'stone_axe',
      quantity: 1,
    });
    expect(await page.evaluate(() => G.inventory.cursor)).toBeNull();
    await expect(page.locator('#inventory-capacity')).toHaveText('2/32');
    await expect(page.locator('#hotbar button')).toHaveCount(9);
    await page.locator('#inventory-panel').evaluate((panel) => {
      panel.scrollTop = 0;
    });
    await page.mouse.move(0, 0);
    await page.screenshot({ path: testInfo.outputPath('expanded-inventory.png') });
  });
}

test('mouse aim changes held-tool pixels without moving or collecting, including camera and zoom changes', async ({
  page,
}, testInfo) => {
  await openMenu(page);
  await createWorld(page, 'Mouse aim');
  await supplyItems(page);
  await page.keyboard.press('1');
  await page.waitForTimeout(600); // Let the original camera settle before sampling.
  const before = await page.evaluate(() => ({
    x: G.px,
    y: G.py,
    hits: G.collection.lastHitAt,
    removed: [...G.collection.removed],
  }));
  const box = await page.locator('#c').boundingBox();
  async function aim(dx, dy) {
    const point = await page.evaluate(
      ({ dx, dy }) => ({
        x: (G.px + dx - G.view.ox) * G.view.z,
        y: (G.py - 14 + dy - G.view.oy) * G.view.z,
      }),
      { dx, dy },
    );
    await page.mouse.move(
      box.x + (point.x * box.width) / 960,
      box.y + (point.y * box.height) / 540,
    );
    await frames(page);
  }
  async function headPixels() {
    return page.evaluate(() => {
      const x = Math.round((G.px - G.view.ox) * G.view.z);
      const y = Math.round((G.py - G.view.oy) * G.view.z);
      const pixels = ctx.getImageData(x - 32, y - 45, 64, 50).data;
      const points = [];
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] === 167 && pixels[i + 1] === 177 && pixels[i + 2] === 181) {
          points.push({ x: ((i / 4) % 64) - 32, y: Math.floor(i / 4 / 64) - 45 });
        }
      }
      return points;
    });
  }
  await aim(90, 0);
  expect(await page.evaluate(() => toolFacing())).toBe(3);
  const right = await headPixels();
  expect(right.length).toBeGreaterThan(3);
  expect(right.reduce((sum, p) => sum + p.x, 0) / right.length).toBeGreaterThan(3);
  await aim(-90, 0);
  expect(await page.evaluate(() => toolFacing())).toBe(2);
  const left = await headPixels();
  expect(left.length).toBeGreaterThan(3);
  expect(left.reduce((sum, p) => sum + p.x, 0) / left.length).toBeLessThan(-3);
  await aim(0, -90);
  expect(await page.evaluate(() => toolFacing())).toBe(1);
  await aim(0, 90);
  expect(await page.evaluate(() => toolFacing())).toBe(0);
  for (const key of ['-', '+', '+', '+']) {
    await page.keyboard.press(key);
    await aim(-90, 0);
    expect(await page.evaluate(() => toolFacing())).toBe(2);
  }
  await page.keyboard.press('5');
  await frames(page);
  expect(await headPixels()).toHaveLength(0);
  expect(
    await page.evaluate(() => ({
      x: G.px,
      y: G.py,
      hits: G.collection.lastHitAt,
      removed: [...G.collection.removed],
    })),
  ).toEqual(before);
  await page.keyboard.press('1');
  await frames(page);
  await page.screenshot({ path: testInfo.outputPath('tool-mouse-aim.png') });
});

test('tool drawing restores the Canvas transform and styles', async ({ page }) => {
  await openMenu(page);
  await createWorld(page, 'Drawing context');
  await supplyItems(page);
  const result = await page.evaluate(() => {
    ctx.save();
    ctx.setTransform(1.25, 0, 0, 1.25, 12, 18);
    ctx.fillStyle = '#123456';
    const before = {
      transform: [...ctx.getTransform().toFloat64Array()],
      fill: ctx.fillStyle,
      smoothing: ctx.imageSmoothingEnabled,
    };
    drawHeldTool(30, 30, 0);
    const after = {
      transform: [...ctx.getTransform().toFloat64Array()],
      fill: ctx.fillStyle,
      smoothing: ctx.imageSmoothingEnabled,
    };
    ctx.restore();
    return { before, after };
  });
  expect(result.after).toEqual(result.before);
});

test('switching from an expanded empty world refreshes the capacity shown in the detail card', async ({
  page,
}) => {
  await openMenu(page);
  await createWorld(page, 'Expanded empty');
  await supplyItems(page);
  await page.keyboard.press('i');
  await upgrade(page);
  await page.evaluate(() => {
    G.inventory.slots.fill(null); // Empty-world fixture, not an inventory operation.
    inventoryChanged();
  });
  await page.mouse.move(0, 0);
  await expect(page.locator('#inventory-detail-total')).toHaveText('0 / 32');
  await page.keyboard.press('i');
  await page.keyboard.press('Escape');
  await createWorld(page, 'Initial empty');
  await page.keyboard.press('i');
  await expect(page.locator('#inventory-capacity')).toHaveText('0/16');
  await expect(page.locator('#inventory-detail-total')).toHaveText('0 / 16');
});
