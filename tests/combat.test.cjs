#!/usr/bin/env node
'use strict';

// Exercises the shipped v0.8 storage, inventory and session code. Only DOM
// painting is replaced. Browser event delivery and real pixels are tested by Playwright.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'ORIGENS — Survival v0.8 Combate.html');
const source = fs.readFileSync(file, 'utf8');
const scriptMatch = source.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(scriptMatch, 'the delivered HTML contains its executable game');
const script = scriptMatch[1];
function block(start, end) {
  assert.ok(script.includes(start) && script.includes(end), 'existing source markers');
  return script.slice(script.indexOf(start), script.indexOf(end) + end.length);
}
const json = (value) => JSON.parse(JSON.stringify(value));
const equal = (actual, expected) => assert.deepEqual(json(actual), expected);
let passed = 0;
const covered = new Set();
function test(criteria, name, fn) {
  storageValues.clear();
  storageFails = false;
  try {
    fn();
    passed++;
    criteria.forEach((n) => covered.add(n));
    console.log('PASS [' + criteria.join(',') + '] ' + name);
  } catch (error) {
    console.error('FAIL [' + criteria.join(',') + '] ' + name);
    throw error;
  }
}
let integrationCode = script;
for (const [start, end, replacement] of [
  [
    '// ===== Armazenamento v0.8: interface =====',
    '// ===== Fim da interface de armazenamento =====',
    `
function initStorageUI(){}
function renderStorageUI(){globalThis.storagePaints=(globalThis.storagePaints||0)+1}
function clearStorageUI(){}
function setStorageStatus(message){globalThis.storageStatus=message}
function refreshStorageTooltip(){}
function renderStorageSaveState(){}
`,
  ],
  [
    '// ===== Inventário v0.4: interface =====',
    '// ===== Fim da interface de inventário =====',
    `
function initInventoryUI(){}
function renderInventoryUI(){globalThis.inventoryPaints=(globalThis.inventoryPaints||0)+1}
function clearInventoryUI(){}
function updateInventoryCursor(){}
`,
  ],
  [
    '// ===== Crafting v0.5: interface =====',
    '// ===== Fim da interface de crafting =====',
    `
function initCraftingUI(){}
function renderCraftingUI(){globalThis.craftingPaints=(globalThis.craftingPaints||0)+1}
function clearCraftingUI(){}
function renderCraftSaveState(){}
function setCraftingStatus(){}
function craftingUIReason(reason){return reason}
`,
  ],
]) {
  const removed = block(start, end);
  integrationCode = integrationCode.replace(removed, replacement);
}
const events = new Map(),
  timers = [],
  storageValues = new Map();
let now = 1000,
  storageFails = false;
const noOp = () => {};
const context2d = () =>
  new Proxy(
    {
      createImageData: (width, height) => ({
        data: new Uint8ClampedArray(width * height * 4),
        width,
        height,
      }),
      measureText: (text) => ({ width: String(text).length * 8 }),
    },
    { get: (o, k) => (k in o ? o[k] : noOp), set: (o, k, v) => ((o[k] = v), true) },
  );
function element(tagName = 'DIV') {
  return {
    tagName,
    style: { setProperty: noOp },
    value: '',
    textContent: '',
    children: [],
    dataset: {},
    hidden: false,
    width: 960,
    height: 540,
    clientWidth: 960,
    clientHeight: 540,
    classList: { add: noOp, remove: noOp, toggle: noOp, contains: () => false },
    append(...nodes) {
      this.children.push(...nodes);
    },
    appendChild(node) {
      this.children.push(node);
      return node;
    },
    replaceChildren(...nodes) {
      this.children = nodes;
    },
    setAttribute: noOp,
    removeAttribute: noOp,
    addEventListener: noOp,
    removeEventListener: noOp,
    focus: noOp,
    blur: noOp,
    remove: noOp,
    contains: () => false,
    querySelector: () => null,
    querySelectorAll: () => [],
    getContext: context2d,
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: 960,
      height: 540,
      right: 960,
      bottom: 540,
    }),
  };
}
const elements = new Map();
const getElement = (id) => {
  if (!elements.has(id)) elements.set(id, element(id === 'c' ? 'CANVAS' : 'DIV'));
  return elements.get(id);
};
getElement('m').style.display = 'flex';
getElement('sd').value = 'ORIGENS-2026';
getElement('sz').value = '128';
const register = (type, handler) => {
  if (!events.has(type)) events.set(type, []);
  events.get(type).push(handler);
};
const sandbox = {
  console,
  URLSearchParams,
  location: { search: '?treino=1' },
  Uint8Array,
  Uint8ClampedArray,
  Int32Array,
  Float32Array,
  performance: { now: () => now },
  document: {
    hidden: false,
    getElementById: getElement,
    createElement: (tag) => element(tag.toUpperCase()),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: register,
  },
  localStorage: {
    getItem: (key) => storageValues.get(key) ?? null,
    setItem(key, value) {
      if (storageFails) throw Error('QuotaExceededError');
      storageValues.set(key, String(value));
    },
    removeItem: (key) => storageValues.delete(key),
  },
  addEventListener: register,
  removeEventListener: noOp,
  requestAnimationFrame: noOp,
  setInterval: noOp,
  setTimeout: (handler) => (timers.push(handler), timers.length),
  clearTimeout: noOp,
  innerWidth: 1280,
  innerHeight: 800,
  btoa: (text) => Buffer.from(text, 'binary').toString('base64'),
  atob: (text) => Buffer.from(text, 'base64').toString('binary'),
};
sandbox.window = sandbox;
const integration = vm.createContext(sandbox);
vm.runInContext(integrationCode, integration, { filename: file + ':integration' });
const runGame = (code) => vm.runInContext(code, integration, { timeout: 5000 });

runGame(`function storageFixtureWorld(id='storage-A') {
  const N=32,length=N*N;
  const w={N,ter:new Uint8Array(length).fill(4),ob:new Uint8Array(length),own:new Uint8Array(length).fill(1),sea:new Uint8Array(length),I:[{el:0}],sp:{x:10,y:10},id,name:id,seed:'same-storage-seed',ok:true,att:0};
  for (const [x,y,type] of [[12,10,1],[14,10,1],[12,13,2],[12,16,3]]) w.ob[y*N+x]=type;
  for(let y=0;y<N;y++)for(let x=0;x<7;x++){w.ter[y*N+x]=1;w.sea[y*N+x]=1}
  return w;
}`);

function setup(id = 'storage-A', saved = null) {
  now += 10000;
  runGame(
    `start(storageFixtureWorld(${JSON.stringify(id)}),${JSON.stringify(saved)});keys={};mapOpen=0;toastT=0;G.combat.targets=[];`,
  );
}
function tick(seconds, dt = 0.05) {
  for (let t = 0; t < seconds - 1e-8; t += dt)
    runGame(`updateCombat(${Math.min(dt, seconds - t)})`);
}
function equip(id) {
  runGame(
    `G.inventory.slots.fill(null);G.inventory.cursor=null;G.inventory.selected=0;addItems(G.inventory,'${id}',1);G.aimPoint=null;G.combat.aim={x:1,y:0}`,
  );
}
function target(dx = 30, dy = 0) {
  runGame(
    `G.combat.targets=[{id:'target',x:G.px+${dx},y:G.py-12+${dy},radius:12,health:100,maxHealth:100}]`,
  );
}
function hp() {
  return runGame('G.combat.targets[0].health');
}
function saved() {
  runGame('save(1)');
  return JSON.parse(storageValues.get('origens_w_' + runGame('G.id')));
}
test([1, 2, 3, 10, 12], 'fresh finite attributes and invalid saves fail closed', () => {
  setup();
  equal(runGame('G.combat.stats'), { health: 100, stamina: 100, elementalEnergy: 100 });
  for (const value of ['NaN', 'Infinity', '-1', '101'])
    assert.equal(
      runGame(
        `validCombatSave({version:1,stats:{health:${value},stamina:100,elementalEnergy:100},cooldowns:{attack:0,special:0,dodge:0}})`,
      ),
      false,
    );
  assert.equal(runGame('validCombatSave({})'), false);
});
test([7, 8, 9, 10], 'regeneration is independent at 4, 20, 60 and 120 updates per second', () => {
  for (const step of [0.25, 0.05, 1 / 60, 1 / 120]) {
    setup();
    runGame('G.combat.stats.stamina=50;G.combat.stats.elementalEnergy=50');
    tick(2, step);
    assert.ok(Math.abs(runGame('G.combat.stats.stamina') - 64.4) < 1e-6);
    assert.ok(Math.abs(runGame('G.combat.stats.elementalEnergy') - 53) < 1e-6);
    tick(20, step);
    assert.equal(runGame('G.combat.stats.stamina'), 100);
    assert.equal(runGame('G.combat.stats.elementalEnergy'), 100);
  }
});
test(
  [9, 48, 56, 57],
  'menus, hidden tabs and raft pause actions and recovery without catching up',
  () => {
    for (const gate of [
      'inventoryOpen=true',
      'craftingOpen=true',
      'chestOpen=true',
      'mapOpen=1',
      'G.boat=1',
      'document.hidden=true',
    ]) {
      setup();
      equip('primitive_sword');
      runGame('G.combat.stats.stamina=40;' + gate);
      tick(10);
      assert.equal(runGame('G.combat.stats.stamina'), 40);
      assert.equal(runGame('beginCombatAttack().ok'), false);
      assert.equal(runGame('beginCombatDodge().ok'), false);
      runGame(
        'inventoryOpen=false;craftingOpen=false;chestOpen=false;mapOpen=0;G.boat=0;document.hidden=false',
      );
    }
  },
);
test(
  [13, 14, 15, 16, 17, 18, 19, 20, 21],
  'three real atomic recipes and individual weapon slots',
  () => {
    for (const id of ['primitive_sword', 'primitive_spear', 'training_staff']) {
      setup();
      const recipe = runGame(`CRAFT_RECIPES.recipe_${id}`);
      assert.equal(runGame(`ITEM_TYPES.${id}.maxStack`), 1);
      for (const i of recipe.ingredients)
        runGame(`addItems(G.inventory,'${i.itemId}',${i.quantity * 2})`);
      assert.equal(runGame(`executeCraft(G.inventory,'recipe_${id}',2).ok`), true);
      assert.equal(runGame(`G.inventory.slots.filter(s=>s?.itemId==='${id}').length`), 2);
      assert.equal(runGame('G.inventory.slots.length'), 16);
      const before = json(runGame('serializeInventory(G.inventory)'));
      assert.equal(runGame(`executeCraft(G.inventory,'recipe_${id}').ok`), false);
      equal(runGame('serializeInventory(G.inventory)'), before);
    }
    setup();
    runGame(
      "G.inventory.slots=Array.from({length:16},()=>({itemId:'wood',quantity:200}));G.inventory.slots[0]={itemId:'simple_handle',quantity:10};G.inventory.slots[1]={itemId:'chipped_stone',quantity:10}",
    );
    const before = json(runGame('serializeInventory(G.inventory)'));
    assert.equal(runGame("executeCraft(G.inventory,'recipe_primitive_sword').reason"), 'no_space');
    equal(runGame('serializeInventory(G.inventory)'), before);
  },
);
test(
  [22, 23, 24, 35],
  'equipment derives from hotbar; cursor, materials and outside slots never attack',
  () => {
    setup();
    equip('primitive_sword');
    assert.equal(runGame('activeWeapon().id'), 'primitive_sword');
    runGame('inventorySlotClick(G.inventory,0);inventorySlotClick(G.inventory,11)');
    assert.equal(runGame('activeWeapon()'), null);
    assert.equal(runGame('beginCombatAttack().ok'), false);
    runGame('inventorySlotClick(G.inventory,11)');
    assert.equal(runGame('activeWeapon()'), null);
    assert.equal(runGame('beginCombatAttack().ok'), false);
  },
);
for (const [id, damage] of [
  ['primitive_sword', 12],
  ['primitive_spear', 15],
])
  test(
    [25, 26, 28, 29, 31, 34, 36, 37, 38, 70, 71, 73, 74],
    id + ' hits once in its forward area and cooldown survives swapping',
    () => {
      setup();
      equip(id);
      target();
      assert.equal(runGame('beginCombatAttack().ok'), true);
      assert.equal(runGame('beginCombatAttack().ok'), false);
      tick(0.3);
      assert.equal(hp(), 100 - damage);
      tick(0.1);
      assert.equal(hp(), 100 - damage);
      equip(id === 'primitive_sword' ? 'primitive_spear' : 'primitive_sword');
      assert.equal(runGame('beginCombatAttack().ok'), false);
      tick(0.4);
      target(-35);
      assert.equal(runGame('beginCombatAttack().ok'), true);
      tick(0.3);
      assert.equal(hp(), 100);
      tick(0.5);
      target(120);
      runGame('beginCombatAttack()');
      tick(0.3);
      assert.equal(hp(), 100);
    },
  );
test([32, 33, 37], 'logical aim uses camera and zoom, narrow spear excludes side target', () => {
  setup();
  equip('primitive_spear');
  runGame('G.view={z:1.5,ox:G.px-320,oy:G.py-180};G.aimPoint={x:480+150,y:(180-12)*1.5}');
  equal(runGame('combatDirection()'), { x: 1, y: 0 });
  target(10, 40);
  runGame('beginCombatAttack()');
  tick(0.3);
  assert.equal(hp(), 100);
  runGame('G.aimPoint={x:NaN,y:NaN}');
  equal(runGame('combatDirection()'), { x: 1, y: 0 });
});
test(
  [39, 40, 41, 42, 43, 44, 45, 46],
  'special resources charge once, shared cooldown and insufficient resources reject atomically',
  () => {
    for (const id of ['primitive_sword', 'primitive_spear', 'training_staff']) {
      setup();
      equip(id);
      target(60);
      const weapon = runGame('activeWeapon()');
      assert.equal(runGame('beginCombatAttack(true).ok'), true);
      assert.equal(runGame(`G.combat.stats.${weapon.pool}`), 100 - weapon.cost);
      assert.equal(runGame('beginCombatAttack(true).ok'), false);
      tick(0.7);
      equip('primitive_sword');
      assert.equal(runGame('beginCombatAttack(true).ok'), false);
      tick(3);
      runGame('G.combat.stats.stamina=0;G.combat.stats.elementalEnergy=0');
      assert.equal(runGame('beginCombatAttack(true).ok'), false);
      assert.equal(runGame('G.combat.stats.stamina'), 0);
    }
  },
);
test(
  [27, 30, 59, 60, 61, 62, 63, 65, 66, 67, 68, 72],
  'staff projectile resolves exactly once and expires, malformed projectiles are removed',
  () => {
    setup();
    equip('training_staff');
    target(70);
    runGame('beginCombatAttack()');
    tick(0.6);
    assert.equal(hp(), 92);
    assert.equal(runGame('G.combat.projectiles.length'), 0);
    tick(1);
    assert.equal(hp(), 92);
    runGame('G.combat.targets=[];beginCombatAttack()');
    tick(1.5);
    assert.equal(runGame('G.combat.projectiles.length'), 0);
    runGame(
      'G.combat.projectiles=[{x:NaN,y:0,direction:{x:0,y:0},damage:1,remaining:10,life:1,born:0}]',
    );
    tick(0.05);
    assert.equal(runGame('G.combat.projectiles.length'), 0);
  },
);
test(
  [47, 53, 54, 55, 64],
  'swept movement and projectiles collide with solid rocks, water and world bounds',
  () => {
    setup();
    equip('training_staff');
    runGame('G.px=10*T;G.py=10*T+28;G.w.ob[10*G.w.N+11]=2');
    target(80);
    runGame('beginCombatAttack()');
    tick(0.8, 0.25);
    assert.equal(hp(), 100);
    assert.equal(runGame('G.combat.projectiles.length'), 0);
    setup();
    runGame('G.px=7*T+8;G.py=10*T+16;G.combat.aim={x:-1,y:0}');
    const x = runGame('G.px');
    runGame('beginCombatDodge()');
    tick(0.25);
    assert.ok(runGame('G.px') >= 7 * 32 + 6);
    assert.ok(runGame('G.px') <= x);
    assert.equal(runGame('blocked(G.w,G.px,G.py,0)'), 0);
    setup();
    runGame('G.px=G.w.N*T-8;G.combat.aim={x:1,y:0}');
    runGame('beginCombatDodge()');
    tick(0.25);
    assert.ok(runGame('G.px') < runGame('G.w.N*T'));
  },
);
test(
  [49, 50, 51, 52, 58],
  'dodge spends 20, terminates, respects cooldown and never duplicates movement',
  () => {
    setup();
    runGame('keys={d:1}');
    const x = runGame('G.px');
    assert.equal(runGame('beginCombatDodge().ok'), true);
    assert.equal(runGame('G.combat.stats.stamina'), 80);
    assert.equal(runGame('beginCombatDodge().ok'), false);
    tick(0.25);
    assert.ok(Math.abs(runGame('G.px') - x - 48) < 1e-7);
    assert.equal(runGame('G.combat.dodge'), null);
    runGame('G.combat.stats.stamina=0');
    tick(1);
    assert.equal(runGame('beginCombatDodge().ok'), false);
  },
);
test(
  [4, 79, 81, 82, 83, 84, 85, 86],
  'received damage has source-specific immunity, safe defeat and dev recovery without item changes',
  () => {
    setup();
    equip('primitive_sword');
    const inv = json(runGame('serializeInventory(G.inventory)'));
    assert.equal(runGame("applyPlayerDamage(10,'a')"), true);
    assert.equal(runGame("applyPlayerDamage(10,'a')"), false);
    assert.equal(runGame("applyPlayerDamage(10,'b')"), true);
    assert.equal(runGame('G.combat.stats.health'), 80);
    assert.equal(runGame('G.combat.stats.stamina'), 100);
    assert.equal(runGame('G.combat.stats.elementalEnergy'), 100);
    assert.equal(runGame('applyPlayerDamage(NaN)'), false);
    tick(0.6);
    assert.equal(runGame("applyPlayerDamage(100,'a')"), true);
    assert.equal(runGame('G.combat.stats.health'), 0);
    assert.equal(runGame('beginCombatAttack().ok'), false);
    equal(runGame('serializeInventory(G.inventory)'), inv);
    assert.equal(runGame('recoverTrainingPlayer()'), true);
    equal(runGame('serializeInventory(G.inventory)'), inv);
    assert.equal(runGame('G.combat.stats.health'), 100);
  },
);
test(
  [69, 75, 76, 77, 78],
  'training targets lose only actual damage, never go negative or produce loot',
  () => {
    setup();
    equip('primitive_sword');
    target();
    runGame('G.combat.targets[0].health=4;beginCombatAttack()');
    tick(0.3);
    assert.equal(hp(), 0);
    assert.equal(runGame('G.combat.feedback[0].amount'), 4);
    const drops = runGame('G.collection.drops.size');
    tick(1);
    runGame('beginCombatAttack()');
    tick(0.3);
    assert.equal(runGame('G.combat.feedback.length'), 0);
    assert.equal(runGame('G.collection.drops.size'), drops);
  },
);
test(
  [87, 88, 89, 90, 91, 92, 97, 98],
  'atomic save restores attributes, slots and cooldown remainders but no transient effects',
  () => {
    setup('a');
    equip('training_staff');
    runGame(
      'G.combat.stats.health=67;G.combat.stats.stamina=44;G.combat.stats.elementalEnergy=55;beginCombatAttack(true)',
    );
    const data = saved();
    assert.equal(data.v, 7);
    setup('a', data);
    equal(runGame('G.combat.stats'), { health: 67, stamina: 44, elementalEnergy: 35 });
    assert.equal(runGame('activeWeapon().id'), 'training_staff');
    assert.equal(runGame('G.combat.projectiles.length'), 0);
    assert.equal(runGame('G.combat.active'), null);
    assert.equal(runGame('beginCombatAttack(true).ok'), false);
    setup('b');
    assert.equal(runGame('G.combat.stats.health'), 100);
    setup('a', data);
    const old = storageValues.get('origens_w_a');
    storageFails = true;
    runGame('G.combat.stats.health=33');
    assert.equal(runGame('save(1)'), 0);
    assert.equal(storageValues.get('origens_w_a'), old);
    storageFails = false;
    const invalid = {
      ...data,
      combat: { ...data.combat, stats: { ...data.combat.stats, health: -1 } },
    };
    storageValues.set('origens_w_a', JSON.stringify(invalid));
    setup('a', invalid);
    assert.equal(runGame('G.saveProtected'), true);
    assert.equal(runGame('save(1)'), 0);
    assert.equal(storageValues.get('origens_w_a'), JSON.stringify(invalid));
  },
);
test(
  [93, 94, 95, 96, 119],
  'old schema6 world migrates without free weapons or changes to collection and storage',
  () => {
    setup('legacy');
    runGame("addItems(G.inventory,'wood',47);addItems(G.inventory,'stone_axe',1)");
    const data = saved();
    delete data.combat;
    data.v = 6;
    const raw = JSON.stringify(data);
    storageValues.set('origens_w_legacy', raw);
    setup('legacy', data);
    assert.equal(runGame('G.saveProtected'), false);
    equal(runGame('G.combat.stats'), { health: 100, stamina: 100, elementalEnergy: 100 });
    assert.equal(runGame('inventoryTotals(G.inventory).wood'), 47);
    assert.equal(runGame('inventoryTotals(G.inventory).primitive_sword'), 0);
    assert.equal(runGame('save(1)'), 1);
    assert.equal(storageValues.get('origens_w_legacy_backup_v6'), raw);
  },
);
test([61, 64, 67], 'projectile displacement is 220px per second at different frame rates', () => {
  for (const dt of [0.25, 0.05, 1 / 60]) {
    setup();
    equip('training_staff');
    runGame('G.combat.targets=[];beginCombatAttack()');
    tick(0.5, dt);
    const d = runGame('G.combat.projectiles[0]');
    assert.ok(d);
    assert.ok(Math.abs(d.x - runGame('G.px') - 220 * (0.5 - 0.08)) < 1e-6);
  }
});
test(
  [35, 38, 97],
  'switching during a pending strike uses the starting weapon once and rendering cannot damage',
  () => {
    setup();
    equip('primitive_sword');
    target();
    runGame('beginCombatAttack()');
    equip('training_staff');
    tick(0.1);
    assert.equal(hp(), 88);
    assert.equal(runGame('G.combat.projectiles.length'), 0);
    for (let i = 0; i < 10; i++) runGame('drawHeldWeapon()');
    assert.equal(hp(), 88);
    assert.equal(runGame('beginCombatAttack().ok'), false);
  },
);

test(
  [5, 6, 43, 44],
  'insufficient physical or elemental energy cannot be charged below zero',
  () => {
    for (const id of ['primitive_sword', 'primitive_spear', 'training_staff']) {
      setup();
      equip(id);
      runGame('G.combat.stats.stamina=19;G.combat.stats.elementalEnergy=19');
      const before = json(runGame('G.combat.stats'));
      assert.equal(runGame('beginCombatAttack(true).ok'), false);
      equal(runGame('G.combat.stats'), before);
      assert.equal(runGame('G.combat.projectiles.length'), 0);
    }
  },
);

console.log(
  `\n${passed} combat groups passed. Criteria: ${[...covered].sort((a, b) => a - b).join(', ')}`,
);
