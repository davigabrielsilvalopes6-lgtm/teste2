#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../assets/mobs/mobs-v09.js'),'utf8');
const spec={};
const ctx={
  window:spec,Math,Image:class{set src(value){this._src=value;} get src(){return this._src;}},
  G:null,T:32,mapOpen:0,inventoryOpen:false,craftingOpen:false,chestOpen:false,appearanceOpen:false,
  ctx:{save(){},restore(){},translate(){},fillRect(){},fillText(){},drawImage(){},set imageSmoothingEnabled(v){},set globalAlpha(v){},set fillStyle(v){},set font(v){}},
  start:function(w,sv){ctx.G=ctx.fixture;},update:function(dt){},drawCombatTarget:function(){},drawCombatWorld:function(){},
  storageChestAt:()=>null,combatObstacle:()=>false,blocked:()=>false,
  applyPlayerDamage:(amount,from)=>{ctx.hitLog.push({amount,from});return true;},
  hitLog:[]
};
vm.createContext(ctx);
vm.runInContext(source,ctx,{filename:'mobs-v09.js'});
const mod=spec.ORIGENS_MOBS_V09;
assert.ok(mod,'v0.9 API must be exposed');
assert.equal(Object.keys(mod.definitions).length,4);
assert.equal(Object.keys(mod.plannedDrops).length,4);
assert.equal(mod.definitions.salamander.attack,'fire');
assert.equal(mod.definitions.boar.attack,'charge');
assert.equal(mod.definitions.spirit.attack,'wind');
assert.equal(mod.definitions.serpent.attack,'water');
const width=64,N=width,ter=new Uint8Array(N*N).fill(4),own=new Uint8Array(N*N).fill(1),ob=new Uint8Array(N*N);
const I=[{el:3}];
ctx.fixture={id:'test',w:{N,ter,own,ob,I,sp:{x:2,y:2}},px:1200,py:1200,boat:0,
 combat:{stats:{health:100},targets:[],clock:0,feedback:[]}};
ctx.start(ctx.fixture.w,null);
assert.ok(ctx.G.mob09,'gameplay mob state attached');
assert.equal(ctx.G.combat.targets.length,0);
assert.equal(mod.ownerElement(ctx.G.w,100,100),3);
for(let i=0;i<300;i++){ctx.update(.05);}
assert.ok(ctx.G.combat.targets.length<=9,'bounded active population');
for(const mob of ctx.G.combat.targets){
 assert.equal(mob.species,'salamander');
 assert.equal(mob.maxHealth,55);
 assert.equal(mod.ownerElement(ctx.G.w,mob.x,mob.y),3);
}
const before=ctx.G.combat.targets.length;
mod.update(-1);
assert.equal(ctx.G.combat.targets.length,before,'invalid delta time ignored');
ctx.G.px=220;ctx.G.py=220;
ctx.G.combat.targets.length=0;
ctx.G.w.own.fill(1);ctx.G.w.I[0].el=0;
for(let i=0;i<100;i++)ctx.update(.05);
assert.equal(ctx.G.combat.targets.length,0,'starting region does not spawn hostiles');
for(const [id,element] of [['boar',2],['spirit',4],['serpent',1]]){
 ctx.G.w.I[0].el=element;
 ctx.G.px=1200;ctx.G.py=1200;
 ctx.G.combat.targets.length=0;
 ctx.G.w.ter.fill(id==='serpent'?5:4);
 for(let i=0;i<110;i++)ctx.update(.05);
 assert.ok(ctx.G.combat.targets.length>0,id+' should spawn on suitable habitat');
 assert.ok(ctx.G.combat.targets.every(m=>m.species===id),id+' must respect elemental region');
}
console.log('PASS v0.9 — definitions, region rules, safe starting region, bounded spawns, all four enemy types');
