const { test, expect, openMenu, createWorld } = require('./fixtures');

test('v0.9.1 loads each approved elemental creature sprite sheet', async ({ page }) => {
  await openMenu(page);
  const result = await page.evaluate(async () => {
    const api = window.ORIGENS_MOBS_V09;
    if (!api?.assetSheets) return { available: false, failures: [] };
    const failures = [];
    let count = 0;
    for (const [species, info] of Object.entries(api.assetSheets)) {
      for (const [state, descriptor] of Object.entries(info)) {
        if (state === 'path') continue;
        const [file, cols] = descriptor;
        const url = 'assets/mobs/' + info.path + file;
        const image = new Image();
        image.src = url;
        try {
          await image.decode();
          const size = api.definitions[species].frame;
          const rows = state === 'projectile' || state === 'dust' ? 1 : 4;
          if (image.naturalWidth !== cols * size || image.naturalHeight !== rows * size)
            failures.push(url + ': dimensions ' + image.naturalWidth + 'x' + image.naturalHeight);
          else count++;
        } catch (error) {
          failures.push(url + ': ' + String(error));
        }
      }
    }
    return { available: true, count, failures };
  });
  expect(result.available).toBe(true);
  expect(result.failures).toEqual([]);
  expect(result.count).toBe(26);
  await createWorld(page, 'Fauna v0.9.1');
  expect(await page.evaluate(() => !!G.mob09 && G.mob09.version === 1)).toBe(true);
});
