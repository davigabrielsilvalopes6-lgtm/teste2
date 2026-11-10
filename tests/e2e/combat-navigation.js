const { expect } = require('@playwright/test');
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

module.exports = { gatherNatural, moveTo };
