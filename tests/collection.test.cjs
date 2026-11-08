#!/usr/bin/env node
'use strict';
// No dependencies: run `node tests/collection.test.cjs` from the checkout.
// Exercises the shipped HTML's real JS with a small DOM/Canvas/storage harness.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'ORIGENS — Survival v0.3.html');
const source = fs.readFileSync(file, 'utf8');
const code = source.match(/<script>([\s\S]*)<\/script>/)[1];
const events = new Map(), timers = [], values = new Map();
let now = 1000;
let storageFails = false;
const failedWriteKeys = new Set();
const noop = () => {};
const context2d = () => new Proxy({
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(w*h*4), width:w, height:h }),
  measureText: s => ({ width: String(s).length * 8 }),
}, { get: (o, k) => k in o ? o[k] : noop, set: (o,k,v) => (o[k]=v,true) });
function element(tag='DIV') { return {
  tagName:tag, style:{}, value:'', textContent:'', children:[], width:960,height:540,
  clientWidth:960, append(...children){this.children.push(...children)},
  appendChild(child){this.children.push(child)},
  setAttribute:noop, addEventListener:noop, remove:noop,
  getContext:context2d,
  getBoundingClientRect:()=>({left:0,top:0,width:960,height:540}),
}; }
const ids = new Map(['c','m','nm','sd','rn','sz','cr','wl','ms'].map(id=>[id,element(id==='c'?'CANVAS':'DIV')]));
ids.get('m').style.display='flex';ids.get('sd').value='ORIGENS-2026';ids.get('sz').value='128';
const storage = { getItem:k=>values.get(k)??null,setItem(k,v){if(storageFails||failedWriteKeys.has(String(k)))throw Error('QuotaExceededError');values.set(k,String(v))},removeItem:k=>values.delete(k) };
const register=(type,fn)=>{if(!events.has(type))events.set(type,[]);events.get(type).push(fn)};
const sandbox = {
  console, Uint8Array, Uint8ClampedArray, Int32Array, Float32Array,
  performance:{now:()=>now},
  document:{getElementById:id=>ids.get(id),createElement:tag=>element(tag.toUpperCase()),querySelectorAll:()=>[],querySelector:()=>null,addEventListener:register,hidden:false},
  localStorage:storage,
  addEventListener:register,requestAnimationFrame:noop,
  setInterval:noop,setTimeout:fn=>(timers.push(fn),timers.length),clearTimeout:noop,
  btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),
};
sandbox.window=sandbox;
const realm = vm.createContext(sandbox);
vm.runInContext(code,realm,{filename:file});
const run = js=>vm.runInContext(js,realm,{timeout:120000});
function drain(){while(timers.length)timers.shift()()}
function event(type,props={}){for(const fn of events.get(type)||[])fn({key:'',target:{tagName:'CANVAS'},preventDefault:noop,...props})}
let passed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(error){console.error('FAIL '+name);throw error}}
const equal=(actual,expected)=>assert.deepEqual(JSON.parse(JSON.stringify(actual)),expected);
function setup(){run(`
(function(){const N=32,len=N*N;const w={N,ter:new Uint8Array(len).fill(4),ob:new Uint8Array(len),own:new Uint8Array(len).fill(1),sea:new Uint8Array(len),I:[{el:0}],sp:{x:10,y:10},id:'test-A',name:'A',seed:'test',ok:true,att:0};
for(const [x,y,type] of [[12,10,1],[14,10,1],[12,13,2],[12,16,3],[10,12,4],[10,13,5]])w.ob[y*N+x]=type;
start(w);G.px=11*T;G.py=10*T+26;mapOpen=0;keys={};})();
`);now+=10000;}
const iTree=10*32+12,iTreeB=10*32+14,iStone=13*32+12,iOre=16*32+12;
const hit=(i,delta=350)=>{now+=delta;return run(`hitResource(${i})`)};
const count=(field)=>run(`G.collection.${field}.size`);
function positionAt(i,offsetX=-40,offsetY=0){run(`{const p=resourceBase(G.w,${i});G.px=p.x+${offsetX};G.py=p.y+${offsetY};}`)}

test('tree canopy resolves to the correct tile, empty and noncollectible tiles do not',()=>{
 setup();
 assert.equal(run(`pickResource(12*T+16,10*T-45)`),iTree);
 assert.equal(run(`pickResource(3*T+16,3*T+16)`),-1);
 assert.equal(run(`pickResource(10*T+16,12*T+16)`),-1);
});
test('individual damage and monotonic 350ms cooldown',()=>{
 setup();positionAt(iTree);hit(iTree);
 assert.equal(run(`G.collection.damage.get(${iTree})`),1);
 assert.equal(run(`G.collection.damage.has(${iTreeB})`),false);
 hit(iTree,349);assert.equal(run(`G.collection.damage.get(${iTree})`),1);
 hit(iTree,1);assert.equal(run(`G.collection.damage.get(${iTree})`),2);
 assert.equal(count('drops'),0);
});
test('three tree strikes remove collision and create exactly one 3-wood drop',()=>{
 setup();positionAt(iTree);
 assert.equal(run(`blocked(G.w,12*T+16,10*T+23,0)`),1);
 for(let n=0;n<3;n++)hit(iTree);
 assert.equal(run(`G.w.ob[${iTree}]`),0);assert.equal(count('removed'),1);assert.equal(count('damage'),0);assert.equal(count('drops'),1);
 equal(run(`[...G.collection.drops.values()].map(d=>[d.kind,d.amount])`),[['wood',3]]);
 assert.equal(run(`blocked(G.w,12*T+16,10*T+23,0)`),0);
 hit(iTree);assert.equal(count('drops'),1);
 assert.equal(run(`G.w.ob[${iTreeB}]`),1);
});
test('stone takes four strikes and ore five; junco and shell stay intact',()=>{
 setup();
 for(const [i,hp,kind,amount]of [[iStone,4,'stone',2],[iOre,5,'ore',1]]){
  positionAt(i);for(let n=1;n<hp;n++)hit(i);
  assert.notEqual(run(`G.w.ob[${i}]`),0);hit(i);assert.equal(run(`G.w.ob[${i}]`),0);
  equal(run(`{const d=G.collection.drops.get('drop-${i}');[d.kind,d.amount]}`),[kind,amount]);
 }
 hit(12*32+10);hit(13*32+10);equal(run(`[G.w.ob[12*32+10],G.w.ob[13*32+10]]`),[4,5]);
});
test('out-of-range resource does not take damage or move player',()=>{
 setup();positionAt(iTree,-81);const p=run('[G.px,G.py]');hit(iTree);
 assert.equal(count('damage'),0);equal(run('[G.px,G.py]'),JSON.parse(JSON.stringify(p)));
 assert.match(run('toastM'),/Aproxime/);
});
test('water, lava and solid intermediate obstacles block extraction',()=>{
 for(const terrain of [0,1,2,8]){
  setup();positionAt(iTree,-70);run(`G.w.ter[10*32+11]=${terrain}`);hit(iTree);assert.equal(count('damage'),0);
 }
 setup();positionAt(iTree,-70);run('G.w.ob[10*32+11]=2');hit(iTree);assert.equal(count('damage'),0);
});
test('boat, map, menu and null session prevent hits',()=>{
 for(const state of ['G.boat=1','mapOpen=1',`$('m').style.display='flex'`]){setup();positionAt(iTree);run(state);hit(iTree);assert.equal(count('damage'),0)}
 run('G=null');assert.doesNotThrow(()=>hit(iTree));
});
test('pickup adds exact quantity once and drop is on walkable ground',()=>{
 setup();positionAt(iTree);for(let n=0;n<3;n++)hit(iTree);
 assert.equal(run(`{const d=[...G.collection.drops.values()][0];blocked(G.w,d.x,d.y,0)}`),0);
 run(`{const d=[...G.collection.drops.values()][0];G.px=d.x;G.py=d.y;collectDrops();}`);
 assert.equal(count('drops'),0);assert.equal(run('G.collection.materials.wood'),3);
 run('collectDrops()');assert.equal(run('G.collection.materials.wood'),3);assert.match(run('toastM'),/\+3/);
});
test('automatic pickup is gated while on boat, map or menu',()=>{
 for(const state of ['G.boat=1','mapOpen=1',`$('m').style.display='flex'`]){
  setup();positionAt(iTree);for(let n=0;n<3;n++)hit(iTree);
  run(`{const d=[...G.collection.drops.values()][0];G.px=d.x;G.py=d.y;${state};collectDrops();}`);
  assert.equal(count('drops'),1);assert.equal(run('G.collection.materials.wood'),0);
 }
});
test('partial damage survives serialization, reload and final strike',()=>{
 setup();positionAt(iTree);hit(iTree);hit(iTree);run('globalThis.saved=serializeCollection(G.collection)');setup();
 run('G.collection=restoreCollection(G.w,saved)');assert.equal(run(`G.collection.damage.get(${iTree})`),2);
 positionAt(iTree);hit(iTree);assert.equal(run(`G.w.ob[${iTree}]`),0);assert.equal(count('drops'),1);
});
test('uncollected drops, removed nodes and collected totals survive repeated loads',()=>{
 setup();positionAt(iTree);for(let n=0;n<3;n++)hit(iTree);run('G.collection.materials.stone=7;globalThis.saved=serializeCollection(G.collection)');
 for(let n=0;n<3;n++){
  setup();run('G.collection=restoreCollection(G.w,saved)');assert.equal(run(`G.w.ob[${iTree}]`),0);assert.equal(count('drops'),1);assert.equal(run('G.collection.materials.stone'),7);
 }
 run(`{const d=[...G.collection.drops.values()][0];G.px=d.x;G.py=d.y;collectDrops();globalThis.saved=serializeCollection(G.collection)}`);
 setup();run('G.collection=restoreCollection(G.w,saved)');assert.equal(count('drops'),0);assert.equal(run('G.collection.materials.wood'),3);
});
test('same-seed worlds have independent modified state',()=>{
 setup();positionAt(iTree);for(let n=0;n<3;n++)hit(iTree);run('G.id="world-A";save(1)');
 const a=values.get('origens_w_world-A');assert.ok(a);
 setup();run('G.id="world-B";save(1)');assert.equal(run(`G.w.ob[${iTree}]`),1);assert.equal(count('removed'),0);
 assert.equal(JSON.parse(a).collection.removed.length,1);assert.equal(JSON.parse(values.get('origens_w_world-B')).collection.removed.length,0);
});
test('corrupt collection entries are rejected without discarding valid neighbors',()=>{
 setup();
 run(`globalThis.bad={removed:[${iTree},-1,1.5,99999,12*32+10,13*32+10],damage:[[${iTree},1],[${iTreeB},2],[-1,1],[${iStone},99],['400',1],null],drops:[{id:'drop-${iTree}',kind:'wood',x:12*T+16,y:10*T+26,amount:3},{id:'drop-${iTree}',kind:'wood',x:12*T+16,y:10*T+26,amount:3},{id:'bad',kind:'gold',x:0,y:0,amount:99},null],materials:{wood:9,stone:-1,ore:2.5}};G.collection=restoreCollection(G.w,bad)`);
 assert.equal(run(`G.w.ob[${iTree}]`),0);assert.equal(run('G.w.ob[12*32+10]'),4);assert.equal(run('G.w.ob[13*32+10]'),5);
 assert.equal(count('removed'),1);assert.equal(run(`G.collection.damage.has(${iTree})`),false);assert.equal(run(`G.collection.damage.get(${iTreeB})`),2);
 assert.equal(count('drops'),1);equal(run('G.collection.materials'),{wood:9,stone:0,ore:0});
 for(const data of ['null','false','[]','"invalid"','{removed:{},damage:{},drops:{},materials:[]}'])assert.doesNotThrow(()=>run(`restoreCollection(G.w,${data})`));
});
test('save v3 keeps gv=2 and stores sparse collection without full object or terrain arrays',()=>{
 setup();hit(iTree);run('save(1)');const data=JSON.parse(values.get('origens_w_test-A'));
 assert.equal(data.v,3);assert.equal(data.gv,2);assert.equal(data.id,'test-A');assert.equal(typeof data.exp,'string');
 assert.ok(data.collection);assert.equal(data.ob,undefined);assert.equal(data.ter,undefined);assert.equal(data.collection.damage.length,1);
});
test('storage failure is reported rather than claiming success or throwing',()=>{
 setup();storageFails=true;let result;try{result=run('save()')}finally{storageFails=false}
 assert.ok(!result);assert.match(run('toastM'),/Falha/);
});
test('v2 conversion keeps one exact legacy backup before writing v3',()=>{
 setup();run('G.id="backup-success"');const key='origens_w_backup-success';
 const legacy=JSON.stringify({v:2,gv:2,id:'backup-success',x:352,y:346,boat:0,exp:Buffer.alloc(128).toString('base64')});
 values.set(key,legacy);hit(iTree);assert.equal(run('save(1)'),1);
 assert.equal(values.get(key+'_backup_v2'),legacy);assert.equal(JSON.parse(values.get(key)).v,3);
 assert.equal(JSON.parse(values.get(key)).collection.damage[0][1],1);
 hit(iTree);assert.equal(run('save(1)'),1);assert.equal(values.get(key+'_backup_v2'),legacy);
 assert.equal([...values.keys()].filter(k=>k.startsWith(key+'_backup')).length,1);
});
test('backup write failure preserves original v2 and live progress for retry',()=>{
 setup();run('G.id="backup-failure"');const key='origens_w_backup-failure',backup=key+'_backup_v2';
 const legacy=JSON.stringify({v:2,gv:2,id:'backup-failure',x:352,y:346,boat:0,exp:Buffer.alloc(128).toString('base64')});
 values.set(key,legacy);hit(iTree);failedWriteKeys.add(backup);
 try{assert.equal(run('save()'),0)}finally{failedWriteKeys.delete(backup)}
 assert.equal(values.get(key),legacy);assert.equal(values.has(backup),false);
 assert.equal(run(`G.collection.damage.get(${iTree})`),1);assert.equal(run('G.collection.dirty'),true);assert.match(run('toastM'),/Falha.*backup/);
 assert.equal(run('save(1)'),1);assert.equal(values.get(backup),legacy);assert.equal(JSON.parse(values.get(key)).v,3);
});
test('Esc keeps the live session when saving fails',()=>{
 setup();hit(iTree);storageFails=true;
 try{event('keydown',{key:'Escape'})}finally{storageFails=false}
 assert.equal(run('G.id'),'test-A');assert.equal(ids.get('m').style.display,'none');
 assert.equal(run(`G.collection.damage.get(${iTree})`),1);assert.match(run('toastM'),/Falha/);
});
test('invalid drop coordinates, ids, kinds and yields do not consume valid neighboring drops',()=>{
 const invalidChanges=['x:NaN','x:Infinity','y:-1','x:32*32','y:32*32','x:13*T+16',"kind:'stone'",'amount:2','amount:0','amount:-3','amount:3.5',"id:'drop-0332'"];
 for(const change of invalidChanges){
  setup();run(`G.collection=restoreCollection(G.w,{removed:[${iTree},${iStone}],damage:[],materials:{wood:11,stone:0,ore:0},drops:[
    {id:'drop-${iTree}',kind:'wood',x:12*T+16,y:10*T+26,amount:3,${change}},
    {id:'drop-${iStone}',kind:'stone',x:12*T+16,y:13*T+26,amount:2}
  ]})`);
  assert.equal(count('removed'),2,change);assert.equal(count('drops'),1,change);
  assert.equal(run(`G.collection.drops.get('drop-${iStone}').amount`),2,change);assert.equal(run('G.collection.materials.wood'),11,change);
 }
 // A bad entry must not reserve its ID and hide a later legitimate entry.
 setup();run(`G.collection=restoreCollection(G.w,{removed:[${iTree}],drops:[
  {id:'drop-${iTree}',kind:'wood',x:NaN,y:10*T+26,amount:3},
  {id:'drop-${iTree}',kind:'wood',x:12*T+16,y:10*T+26,amount:3}
 ]})`);assert.equal(count('drops'),1);
});
test('stone and ore pickups increment exact totals once through update()',()=>{
 for(const [index,hp,kind,amount]of [[iStone,4,'stone',2],[iOre,5,'ore',1]]){
  setup();positionAt(index);for(let n=0;n<hp;n++)hit(index);
  assert.equal(count('drops'),1);run(`{const d=G.collection.drops.get('drop-${index}');G.px=d.x;G.py=d.y;update(.016);}`);
  assert.equal(count('drops'),0);assert.equal(run(`G.collection.materials.${kind}`),amount);
  run('update(.016);collectDrops()');assert.equal(run(`G.collection.materials.${kind}`),amount);
  equal(run('G.collection.materials'),{wood:0,stone:kind==='stone'?amount:0,ore:kind==='ore'?amount:0});
 }
});
test('visibilitychange saves collection and clears held movement keys',()=>{
 setup();run('G.id="visibility"');positionAt(iTree);for(let n=0;n<3;n++)hit(iTree);
 positionAt(iStone);hit(iStone);run('keys={w:1,d:1}');sandbox.document.hidden=true;
 try{event('visibilitychange')}finally{sandbox.document.hidden=false}
 equal(run('keys'),{});const saved=JSON.parse(values.get('origens_w_visibility'));
 assert.equal(saved.v,3);assert.equal(saved.gv,2);assert.deepEqual(saved.collection.removed,[iTree]);
 assert.deepEqual(saved.collection.damage,[[iStone,1]]);assert.equal(saved.collection.drops.length,1);assert.equal(saved.collection.drops[0].amount,3);
 assert.equal(run('G.collection.dirty'),false);
});
test('index-write failure reports saved progress without losing collection',()=>{
 setup();run('G.id="index-failure"');positionAt(iTree);hit(iTree);
 values.set('origens_idx_v2',JSON.stringify([{id:'index-failure',name:'Index failure',seed:'test',size:32}]));failedWriteKeys.add('origens_idx_v2');
 try{assert.equal(run('save()'),1)}finally{failedWriteKeys.delete('origens_idx_v2')}
 assert.deepEqual(JSON.parse(values.get('origens_w_index-failure')).collection.damage,[[iTree,1]]);
 assert.match(run('toastM'),/Progresso salvo; falha/);
});
test('save v2 is accepted by loadWorld and starts with an empty collection',()=>{
 const N=128,id='legacy-v2';const exp=Buffer.alloc(N*N/8).toString('base64');
 values.set('origens_idx_v2',JSON.stringify([{id,name:'legacy',seed:'TEST-128-0',size:N}]));values.set('origens_w_'+id,JSON.stringify({v:2,gv:2,id,x:2048,y:2048,boat:0,exp}));
 run('G=null;menu();loadWorld("legacy-v2")');drain();assert.equal(run('G.id'),id);equal(run('G.collection.materials'),{wood:0,stone:0,ore:0});assert.equal(count('removed'),0);
});
test('save v3 through actual loadWorld restores partial damage and drop state',()=>{
 run('globalThis.fresh=G.w;globalThis.testNode=G.w.ob.findIndex(o=>o===1)');const node=run('testNode');assert.ok(node>=0);
 run(`G.collection.damage.set(testNode,2);save(1);G=null;menu();loadWorld('legacy-v2')`);drain();assert.equal(run('G.collection.damage.get(testNode)'),2);
});
test('legacy v1 migration preserves its source and upgrades through v2 to v3',()=>{
 const legacy=JSON.stringify({name:'V1 import',seed:'LEGACY-MIGRATION',size:128,x:2048,y:2048,boat:0,exp:Buffer.alloc(128*128/8).toString('base64')});
 values.set('origens_save_v1',legacy);values.delete('origens_migrated');values.set('origens_idx_v2','[]');run('G=null;migrate()');
 assert.equal(values.get('origens_save_v1'),legacy);assert.equal(values.get('origens_migrated'),'1');
 const index=JSON.parse(values.get('origens_idx_v2'));assert.equal(index.length,1);const id=index[0].id,key='origens_w_'+id;
 const migrated=JSON.parse(values.get(key));assert.equal(migrated.v,2);assert.equal(migrated.gv,1);assert.equal(migrated.exp,JSON.parse(legacy).exp);
 // Use the real startup path with a prepared generated geometry. This isolates migration
 // behavior from the already separately tested generator, avoiding another costly build.
 setup();run(`G.w.id=${JSON.stringify(id)};start(G.w,${JSON.stringify(migrated)})`);
 assert.match(run('toastM'),/gerador antigo.*progresso reiniciado/);equal(run('G.collection.materials'),{wood:0,stone:0,ore:0});assert.equal(count('removed'),0);
 assert.equal(run('save(1)'),1);assert.equal(JSON.parse(values.get(key)).v,3);assert.equal(JSON.parse(values.get(key)).gv,2);
 assert.equal(values.get(key+'_backup_v2'),JSON.stringify(migrated));assert.equal(values.get('origens_save_v1'),legacy);
 run('migrate()');assert.equal(JSON.parse(values.get('origens_idx_v2')).length,1);
});
test('normal and diagonal walking keep equal speed and respect solid collision',()=>{
 setup();run('G.px=8*T;G.py=8*T;keys={d:1};update(.1)');const straight=run('Math.hypot(G.px-8*T,G.py-8*T)');
 setup();run('G.px=8*T;G.py=8*T;keys={d:1,s:1};update(.1)');const diagonal=run('Math.hypot(G.px-8*T,G.py-8*T)');assert.ok(Math.abs(straight-diagonal)<1e-8);
 setup();positionAt(iTree,-30);run('keys={d:1};for(let n=0;n<60;n++)update(.05)');assert.ok(run('G.px')<12*32+11); 
});
test('keyboard M, F3, +/- and Esc preserve controls and menu saving',()=>{
 setup();event('keydown',{key:'m'});assert.equal(run('mapOpen'),1);event('keydown',{key:'m'});assert.equal(run('mapOpen'),0);
 const old=run('zi');event('keydown',{key:'+'});assert.equal(run('zi'),Math.min(3,old+1));event('keydown',{key:'-'});assert.equal(run('zi'),old);
 event('keydown',{key:'F3'});assert.equal(run('dbg'),1);event('keydown',{key:'Escape'});assert.equal(run('G'),null);assert.ok(values.has('origens_w_test-A'));
});
test('generator source is byte-for-byte unchanged from the preserved v0.2',()=>{
 const original=fs.readFileSync(path.join(root,'ORIGENS — Mundo Procedural v0.2.html'),'utf8');
 const generator=s=>s.slice(s.indexOf('// ===== SeededRandom'),s.indexOf('// ===== Arte pixel'));
 assert.equal(generator(source),generator(original));
});
test('generator remains deterministic and valid at all four supported sizes',()=>{
 for(const N of [128,256,512,1024]){
  const result=run(`(function(){const make=()=>{let r,it=gen('regression','TEST-${N}-0',${N});while(!(r=it.next()).done);return r.value};const a=make(),b=make();return {ok:a.ok,other:b.ok,equal:a.ter.every((t,i)=>t===b.ter[i]&&a.ob[i]===b.ob[i]&&a.own[i]===b.own[i]&&a.sea[i]===b.sea[i]),spawn:a.sp,att:a.att}})()`);
  assert.equal(result.ok,true);assert.equal(result.other,true);assert.equal(result.equal,true);console.log('  generated deterministic '+N+'×'+N+' (attempt '+(result.att+1)+')');
 }
});
console.log(`\n${passed} groups passed.`);
