const { expect } = require('@playwright/test');

// A read-only route planner for a real player journey to a natural ore deposit.
// Every change to position, raft mode, resource and inventory comes from the
// game's ordinary keyboard/mouse handlers. No game function is replaced.
async function moveTo(page, point) {
  for (const [coordinate, target, negative, positive] of [
    ['py', point.y, 'w', 's'],
    ['px', point.x, 'a', 'd'],
  ]) {
    const before = await page.evaluate((coordinate) => G[coordinate], coordinate);
    if (Math.abs(before - target) <= 2) continue;
    const sign = target > before ? 1 : -1;
    const key = sign > 0 ? positive : negative;
    const timeout = Math.min(18000, 2000 + (Math.abs(before - target) / 128) * 1000);
    await page.keyboard.down(key);
    try {
      const reached = await page.evaluate(
        ({ coordinate, target, sign, timeout }) =>
          new Promise((resolve) => {
            const started = performance.now();
            const observe = () => {
              if ((G[coordinate] - target) * sign >= -12) return resolve(true);
              if (performance.now() - started > timeout) return resolve(false);
              requestAnimationFrame(observe);
            };
            requestAnimationFrame(observe);
          }),
        { coordinate, target, sign, timeout },
      );
      expect(reached, `Natural sea route approaches ${coordinate}=${target} by keyboard`).toBe(
        true,
      );
    } finally {
      await page.keyboard.up(key);
    }
    // Release before the center, then align with short native key presses.
    // Holding through the endpoint can overshoot a narrow shore under CPU load.
    for (let correction = 0; correction < 20; correction++) {
      const actual = await page.evaluate((coordinate) => G[coordinate], coordinate);
      if (Math.abs(actual - target) <= 3.5) break;
      await page.keyboard.press(actual < target ? positive : negative, { delay: 20 });
    }
    const actual = await page.evaluate((coordinate) => G[coordinate], coordinate);
    expect(
      Math.abs(actual - target),
      `Natural route aligns ${coordinate} before turning`,
    ).toBeLessThanOrEqual(3.5);
  }
}

async function planOreJourney(page) {
  return page.evaluate(() => {
    const w = G.w,
      n = w.N,
      area = n * n;
    const center = (i) => ({ x: ((i % n) + 0.5) * T, y: (Math.floor(i / n) + 0.5) * T });
    const clear = (a, b, boat, ignored = -1) => {
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
      for (let s = 0; s <= steps; s++) {
        if (
          blocked(
            w,
            a.x + ((b.x - a.x) * s) / steps,
            a.y + ((b.y - a.y) * s) / steps,
            boat,
            ignored,
          )
        )
          return false;
      }
      return true;
    };
    // These cached collision/edge answers are confined to this planning call.
    const passable = new Int8Array(area * 2).fill(-1);
    const canStand = (i, boat) => {
      const state = i + boat * area;
      if (passable[state] < 0) {
        const p = center(i);
        passable[state] = blocked(w, p.x, p.y, boat) ? 0 : 1;
      }
      return passable[state] === 1;
    };
    const directions = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    const neighbors = (i) => {
      const x = i % n,
        y = Math.floor(i / n),
        result = [];
      for (const [dx, dy] of directions) {
        const tx = x + dx,
          ty = y + dy;
        if (tx >= 0 && tx < n && ty >= 0 && ty < n) result.push(ty * n + tx);
      }
      return result;
    };
    // Reproduce the existing E key's nearest 3x3 destination selection, without
    // calling toggleBoat or writing any state. Real E is sent after walking.
    const raftDestination = (i, boat) => {
      const x = i % n,
        y = Math.floor(i / n),
        p = center(i);
      let nearest = -1,
        distance = Infinity;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const tx = x + dx,
            ty = y + dy;
          if (tx < 0 || tx >= n || ty < 0 || ty >= n) continue;
          const next = ty * n + tx,
            terrain = w.ter[next],
            q = center(next);
          const eligible = boat
            ? terrain > 2 &&
              terrain !== 8 &&
              (w.ob[next] < 1 || w.ob[next] > 3) &&
              canStand(next, 0)
            : terrain < 3 && w.sea[next] && canStand(next, 1);
          const d = Math.hypot(q.x - p.x, q.y - p.y);
          if (eligible && d < distance) {
            nearest = next;
            distance = d;
          }
        }
      return nearest;
    };
    const startTile = Math.floor(G.py / T) * n + Math.floor(G.px / T);
    const startMode = G.boat ? 1 : 0,
      start = startTile + startMode * area;
    const previous = new Int32Array(area * 2).fill(-2),
      queue = [start];
    previous[start] = -1;
    let goal = -1,
      resource = null;
    for (let head = 0; head < queue.length; head++) {
      const state = queue[head],
        boat = state >= area ? 1 : 0,
        i = state % area,
        at = center(i);
      if (!boat) {
        for (const index of neighbors(i)) {
          if (w.ob[index] !== 3) continue;
          const base = resourceBase(w, index),
            target = { x: base.x, y: base.y - 10 };
          if (pickResource(target.x, target.y) === index && clear(at, base, 0, index)) {
            goal = state;
            resource = { index, kind: 'ore', amount: 1, base, target };
            break;
          }
        }
      }
      if (goal >= 0) break;
      for (const next of neighbors(i)) {
        const nextState = next + boat * area;
        if (previous[nextState] !== -2 || !canStand(next, boat) || !clear(at, center(next), boat))
          continue;
        previous[nextState] = state;
        queue.push(nextState);
      }
      const destination = raftDestination(i, boat);
      if (destination >= 0) {
        const nextState = destination + (1 - boat) * area;
        if (previous[nextState] === -2) {
          previous[nextState] = state;
          queue.push(nextState);
        }
      }
    }
    if (goal < 0) throw new Error('No natural land/raft route to a selectable ore deposit');
    const path = [];
    for (let state = goal; state >= 0; state = previous[state]) path.unshift(state);
    const walk = [];
    let toggle = false;
    for (const state of path) {
      if ((state >= area ? 1 : 0) !== startMode) {
        toggle = true;
        break;
      }
      walk.push(center(state % area));
    }
    // Straight stretches have already been checked edge by edge. Compress them
    // to avoid hundreds of protocol round trips without taking diagonal cuts.
    const waypoints = walk.filter(
      (point, i) =>
        i === 0 ||
        i === walk.length - 1 ||
        !(
          (walk[i - 1].x === point.x && point.x === walk[i + 1].x) ||
          (walk[i - 1].y === point.y && point.y === walk[i + 1].y)
        ),
    );
    return { waypoints, toggle, startMode, resource };
  });
}

async function gatherNaturalOre(page) {
  const index = await page.evaluate(() =>
    G.inventory.slots
      .slice(0, 9)
      .findIndex(
        (stack) =>
          !stack ||
          (stack.itemId !== 'stone_axe' &&
            stack.itemId !== 'stone_pickaxe' &&
            stack.itemId !== 'wooden_chest'),
      ),
  );
  expect(index, 'Natural ore journey has a bare-hand/material shortcut').toBeGreaterThanOrEqual(0);
  await page.keyboard.press(String(index + 1));
  let resource = null;
  for (let stage = 0; stage < 12; stage++) {
    const plan = await planOreJourney(page);
    for (const point of plan.waypoints) await moveTo(page, point);
    if (plan.toggle) {
      await page.keyboard.press('e');
      expect(await page.evaluate(() => G.boat)).toBe(1 - plan.startMode);
      continue; // Actual E may resolve a nearest-shore tie differently: replan.
    }
    resource = plan.resource;
    break;
  }
  expect(
    resource,
    'Natural journey reaches land beside ore within twelve shore transitions',
  ).not.toBeNull();
  expect(await page.evaluate(() => G.boat)).toBe(0);
  await page.waitForTimeout(450);
  for (let hit = 0; hit < 5; hit++) {
    await page.waitForTimeout(370);
    const point = await page.evaluate(({ x, y }) => {
      const r = cv.getBoundingClientRect();
      return {
        x: r.left + ((x - G.view.ox) * G.view.z * r.width) / 960,
        y: r.top + ((y - G.view.oy) * G.view.z * r.height) / 540,
      };
    }, resource.target);
    await page.mouse.click(point.x, point.y);
  }
  expect(await page.evaluate((index) => G.w.ob[index], resource.index)).toBe(0);
  expect(
    await page.evaluate((index) => G.collection.drops.get('drop-' + index)?.amount, resource.index),
  ).toBe(1);
  await moveTo(page, resource.base);
  await expect
    .poll(() => page.evaluate((index) => G.collection.drops.has('drop-' + index), resource.index))
    .toBe(false);
  expect(
    await page.evaluate(() =>
      G.inventory.slots
        .filter((stack) => stack?.itemId === 'ore')
        .reduce((sum, stack) => sum + stack.quantity, 0),
    ),
  ).toBeGreaterThanOrEqual(1);
  return resource;
}

module.exports = { gatherNaturalOre };
