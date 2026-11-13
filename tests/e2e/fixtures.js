const { test: base, expect } = require('@playwright/test');

// Every test receives a fresh browser context (and therefore fresh localStorage).
// Observe the existing game only: no production hooks, patched functions or teleports.
const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const errors = [];
    const onPageError = error => errors.push({ type: 'pageerror', message: error.stack || error.message });
    const onConsole = message => {
      if (message.type() === 'error') errors.push({ type: 'console', message: message.text() });
    };
    const onRequestFailed = request => errors.push({
      type: 'requestfailed', url: request.url(), message: request.failure()?.errorText,
    });
    const onResponse = response => {
      if (response.status() >= 400) errors.push({ type: 'http', url: response.url(), status: response.status() });
    };
    page.on('pageerror', onPageError);
    page.on('console', onConsole);
    page.on('requestfailed', onRequestFailed);
    page.on('response', onResponse);
    try {
      await use(page);
    } finally {
      if (errors.length) {
        await testInfo.attach('browser-errors', {
          body: Buffer.from(JSON.stringify(errors, null, 2)), contentType: 'application/json',
        });
      }
      expect(errors, 'No unexpected JavaScript, console, HTTP or resource-loading failures').toEqual([]);
    }
  },
});

async function openMenu(page) {
  const response = await page.goto('/');
  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle(/ORIGENS — Survival v0\.(?:8\.1|9 Fauna Elemental)/);
  await expect(page.locator('#m')).toBeVisible();
  await expect(page.locator('#cr')).toBeEnabled();
}

async function createWorld(page, name = 'Playwright World') {
  await page.locator('#nm').fill(name);
  await page.locator('#sd').fill('TEST-128-0');
  await page.locator('#sz').selectOption('128');
  await page.locator('#cr').click();
  await expect(page.locator('#m')).toBeHidden();
  await expect.poll(() => page.evaluate(() => !!G && !busy && !!G.view && G.tx >= 0 && G.ty >= 0)).toBe(true);
  return page.evaluate(() => ({ id: G.id, x: G.px, y: G.py }));
}

async function movePlayer(page, key, axis, sign = 1) {
  const before = await page.evaluate(() => ({ x: G.px, y: G.py }));
  await page.keyboard.down(key);
  try {
    await expect.poll(async () => {
      const value = await page.evaluate(axis => axis === 'x' ? G.px : G.py, axis);
      return (value - before[axis]) * sign;
    }, { timeout: 3000 }).toBeGreaterThan(8);
  } finally {
    await page.keyboard.up(key);
  }
  return page.evaluate(() => ({ x: G.px, y: G.py }));
}

async function canvasClick(page, x, y) {
  const box = await page.locator('#c').boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box.x + x * box.width / 960, box.y + y * box.height / 540);
}

module.exports = { test, expect, openMenu, createWorld, movePlayer, canvasClick };
