'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '../ORIGENS — Survival v0.8.1.html'), 'utf8');
const start = html.indexOf('// ===== Personagem v0.8.1:');
const end = html.indexOf('// ===== Fim do personagem v0.8.1 =====');
assert.ok(start > 0 && end > start);
let images = 0;
const sandbox = {
  Image: class {
    constructor() {
      images++;
    }
  },
  PLAYER_ASSET_DATA: 'provided-inline-image',
  $: () => null,
  G: null,
  inventoryOpen: false,
  craftingOpen: false,
  chestOpen: false,
  mapOpen: false,
};
const context = vm.createContext(sandbox);
vm.runInContext(html.slice(start, end), context);
const run = (code) => vm.runInContext(code, context);
const json = (value) => JSON.parse(JSON.stringify(value));
let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('PASS appearance: ' + name);
}
function player() {
  run(
    `G={px:20,py:20,dir:0,boat:0,appearance:defaultAppearance(),avatar:createAvatarController(),combat:{active:null,dodge:null,clock:0,hitUntil:0}};appearanceOpen=false`,
  );
}
test('embedded PNG is exactly the reviewed atlas and uses no remote artwork', () => {
  const encoded = html.match(/const PLAYER_ASSET_DATA='data:image\/png;base64,([^']+)';/);
  assert.ok(encoded);
  assert.deepEqual(
    Buffer.from(encoded[1], 'base64'),
    fs.readFileSync(path.join(__dirname, '../assets/characters/player/player-walk-atlas.png')),
  );
});
test('procedural generation, inventory, crafting, storage and combat blocks remain byte-identical to v0.8', () => {
  const original = fs.readFileSync(
    path.join(__dirname, '../ORIGENS — Survival v0.8 Combate.html'),
    'utf8',
  );
  for (const [first, last] of [
    ['<script>', '// ===== Arte pixel (gerada por código) ====='],
    ['// ===== Inventário v0.4: modelo =====', '// ===== Fim do modelo de inventário ====='],
    ['// ===== Crafting v0.5: modelo =====', '// ===== Fim do modelo de crafting ====='],
    [
      '// ===== Armazenamento v0.8: modelo =====',
      '// ===== Fim do mundo e desenho de armazenamento =====',
    ],
    ['// ===== Coleta v0.3: parâmetros provisórios', 'function worldInputActive(){'],
    ['function canvasPoint(e){', '// ===== Estado / save / mapa ====='],
    ['function draw(tm){', 'function drawMap(tm){'],
    ['// ===== Combate v0.8: modelo e controle =====', '// ===== Fim do combate v0.8 ====='],
  ]) {
    const section = (source) => {
      const a = source.indexOf(first),
        b = source.indexOf(last, a);
      assert.ok(a >= 0 && b > a, first);
      return source.slice(a, b);
    };
    assert.equal(section(html), section(original), first);
  }
});
test('defaults contain only a real complete outfit; missing layers remain null', () => {
  assert.equal(run('validAppearance(defaultAppearance())'), true);
  assert.equal(run('Object.keys(APPEARANCE_CATALOG.outfit).length'), 1);
  assert.equal(
    run('Object.values(APPEARANCE_CATALOG).slice(1).every(x=>Object.keys(x).length===0)'),
    true,
  );
});
test('unknown resources, missing fields and future schemas cannot be silently saved', () => {
  for (const value of [
    'null',
    '[]',
    '{}',
    '{...defaultAppearance(),version:2}',
    "{...defaultAppearance(),shirt:'blue'}",
    '{...defaultAppearance(),outfit:null}',
  ]) {
    assert.equal(run(`validAppearance(${value})`), false);
    assert.throws(() => run(`serializeAppearance(${value})`), /invalid_appearance/);
  }
});
test('appearance restore creates independent world objects', () => {
  assert.equal(
    run(
      'const a=defaultAppearance(),b=restoreAppearance(a);b!==a&&JSON.stringify(a)===JSON.stringify(b)',
    ),
    true,
  );
});
test('image cache constructs exactly one image and validates decoded dimensions', () => {
  assert.equal(
    run("loadPlayerAsset('official_player')===loadPlayerAsset('official_player')"),
    true,
  );
  assert.equal(images, 1);
  run(
    "const asset=PLAYER_ASSETS.get('official_player');asset.image.naturalWidth=1152;asset.image.naturalHeight=1088;asset.image.onload()",
  );
  assert.equal(run("PLAYER_ASSETS.get('official_player').status"), 'ready');
});
test('unknown and broken assets fail safely and preserve saved appearance', () => {
  player();
  const before = json(run('G.appearance'));
  assert.equal(run("loadPlayerAsset('missing').status"), 'error');
  run("PLAYER_ASSETS.get('official_player').image.onerror()");
  assert.equal(run("PLAYER_ASSETS.get('official_player').status"), 'error');
  assert.deepEqual(json(run('G.appearance')), before);
  run(
    "PLAYER_ASSETS.get('official_player').image.naturalWidth=1;PLAYER_ASSETS.get('official_player').image.onload()",
  );
  assert.equal(run("PLAYER_ASSETS.get('official_player').status"), 'error');
  run(
    "PLAYER_ASSETS.get('official_player').image.naturalWidth=1152;PLAYER_ASSETS.get('official_player').image.onload()",
  );
});
test('walking samples all six supplied frames at eight FPS without changing position', () => {
  player();
  const frames = [];
  for (let i = 0; i < 6; i++) {
    run('updateAvatar(.125,{x:19,y:20})');
    frames.push(run('G.avatar.frame'));
  }
  assert.deepEqual(frames.sort(), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(json(run('[G.px,G.py]')), [20, 20]);
});
test('blocked motion stays idle; stopping keeps the last direction', () => {
  player();
  run('G.dir=3;updateAvatar(.1,{x:19,y:20});updateAvatar(.1,{x:20,y:20})');
  assert.deepEqual(json(run('[G.avatar.state,G.avatar.frame,G.avatar.direction]')), ['idle', 0, 3]);
});
test('four directions select separate atlas rows with identical dimensions and anchor', () => {
  for (let direction = 0; direction < 4; direction++) {
    assert.deepEqual(json(run(`avatarFrame({direction:${direction},frame:5})`)), {
      sx: 960,
      sy: direction * 272,
      width: 192,
      height: 272,
      anchorX: 96,
      anchorY: 264,
      frame: 5,
      direction,
    });
  }
});
test('direction changes retain the central walk clock', () => {
  player();
  run('updateAvatar(.2,{x:19,y:20});G.dir=2;updateAvatar(.1,{x:19,y:20})');
  assert.equal(run('G.avatar.frame'), 2);
  assert.equal(run('G.avatar.direction'), 2);
});
test('attack and special states use existing pose without changing combat values', () => {
  for (const special of [false, true]) {
    player();
    run(
      `G.combat.active={special:${special},direction:{x:-1,y:0},damage:123};updateAvatar(.1,{x:19,y:20})`,
    );
    assert.deepEqual(
      json(run('[G.avatar.state,G.avatar.frame,G.avatar.direction,G.combat.active.damage]')),
      [special ? 'special_attack' : 'attack', 0, 2, 123],
    );
  }
});
test('dodge, hit and panel states never invent animation frames', () => {
  player();
  run('G.combat.dodge={direction:{x:0,y:-1}};updateAvatar(.1,{x:19,y:20})');
  assert.equal(run('G.avatar.state'), 'dodge');
  assert.equal(run('G.avatar.direction'), 1);
  run('G.combat.dodge=null;G.combat.hitUntil=1;updateAvatar(.1,{x:20,y:20})');
  assert.equal(run('G.avatar.state'), 'hit_reaction');
  run('appearanceOpen=true;updateAvatar(.1,{x:19,y:20})');
  assert.deepEqual(json(run('[G.avatar.state,G.avatar.frame]')), ['idle', 0]);
});
test('composition uses one shared frame, uniform scale, integer placement and no smoothing', () => {
  player();
  const calls = [];
  context.probe = { save() {}, restore() {}, drawImage: (...args) => calls.push(args) };
  assert.equal(run('drawAppearance(probe,G.appearance,{direction:2,frame:3},123.3,456.8)'), true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].slice(1), [576, 544, 192, 272, 111, 424, 24, 34]);
  assert.equal(context.probe.imageSmoothingEnabled, false);
});
test('unavailable layers skip rendering rather than drawing a different garment', () => {
  const calls = [];
  context.probe = { drawImage: (...args) => calls.push(args) };
  assert.equal(run("drawAppearance(probe,{...G.appearance,shirt:'missing'},{},0,0)"), false);
  assert.equal(calls.length, 0);
});
test('NaN or negative frame time does not mutate the controller', () => {
  player();
  const before = json(run('G.avatar'));
  run('updateAvatar(NaN,{});updateAvatar(-1,{})');
  assert.deepEqual(json(run('G.avatar')), before);
});
console.log(`${passed} appearance test groups passed.`);
