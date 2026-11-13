/* ORIGENS v0.9 — núcleo de IA independente de Canvas e de salvamentos.
 * Uso no navegador: window.OrigensEnemies09. Uso em testes: require(...).
 * Esta biblioteca NÃO se conecta automaticamente ao loop do jogo v0.8.1. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OrigensEnemies09 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SPECIES = Object.freeze({
    fire_salamander: Object.freeze({ name:'Salamandra Ígnea', region:'fire', hp:55, speed:65, detection:170, attackRange:175, damage:12, cooldown:2.5, windup:0.45, projectileSpeed:175, projectileRange:260, terrain:'land', contactDamage:8, drops:[['escama_ignea',1,3,1],['carne_salamandra',1,1,.35],['glandula_brasa',1,1,.08]] }),
    rock_boar: Object.freeze({ name:'Javali Rochoso', region:'earth', hp:110, speed:45, detection:170, attackRange:105, damage:18, cooldown:4, windup:0.65, chargeSpeed:155, chargeDuration:0.5, terrain:'land', contactDamage:10, drops:[['couro_grosso',1,3,1],['carne_javali',1,2,.35],['presa_javali',1,1,.08]] }),
    wind_spirit: Object.freeze({ name:'Espírito do Vento', region:'air', hp:45, speed:95, detection:210, attackRange:175, damage:9, cooldown:2, windup:0.4, projectileSpeed:220, projectileRange:300, terrain:'land', knockback:25, drops:[['essencia_vento',1,2,1],['fragmento_etereo',1,1,.35],['nucleo_corrente_ar',1,1,.08]] }),
    river_serpent: Object.freeze({ name:'Serpente dos Rios', region:'water', hp:65, speed:85, landSpeed:45, detection:175, attackRange:165, damage:10, cooldown:2.2, windup:0.48, projectileSpeed:180, projectileRange:240, terrain:'river', contactDamage:8, drops:[['escama_aquatica',1,3,1],['presa_serpente',1,1,.35],['glandula_pressao',1,1,.08]] })
  });
  const REGION_ALIASES = Object.freeze({ fire:'fire', fogo:'fire', earth:'earth', terra:'earth', air:'air', ar:'air', water:'water', agua:'water', 'água':'water' });
  const normalizeRegion = (value) => REGION_ALIASES[String(value || '').toLowerCase()] || null;
  const clamp = (n,min,max) => Math.max(min,Math.min(max,n));
  const length = (x,y) => Math.hypot(x,y);
  const distance = (a,b) => length(a.x-b.x,a.y-b.y);
  const unit = (a,b) => {const d=distance(a,b)||1;return {x:(b.x-a.x)/d,y:(b.y-a.y)/d};};
  const rand = (rng) => clamp(Number(rng()),0,0.999999999);
  const valid = (point, species, env) => {
    if (!Number.isFinite(point.x)||!Number.isFinite(point.y)) return false;
    if (typeof env.isWalkable === 'function' && !env.isWalkable(point.x,point.y,species.terrain)) return false;
    if (typeof env.getRegion === 'function' && normalizeRegion(env.getRegion(point.x,point.y)) !== species.region) return false;
    return true;
  };

  function createEnemy(id, kind, x, y, env={}) {
    const spec=SPECIES[kind];
    if (!spec) throw new Error('Espécie desconhecida: '+kind);
    if (!valid({x,y},spec,env)) throw new Error('Habitat inválido para '+kind);
    return {id:String(id),kind,x,y,homeX:x,homeY:y,hp:spec.hp,maxHp:spec.hp,state:'wander',facing:'down',cooldown:0,timer:0,phase:0,targetX:x,targetY:y,hitPlayerThisAttack:false,dead:false};
  }

  function createState() { return {enemies:[],projectiles:[],nextId:1,spawnClock:0}; }
  function addEnemy(world,kind,x,y,env) { const e=createEnemy(world.nextId++,kind,x,y,env);world.enemies.push(e);return e; }
  function damageEnemy(enemy,amount) {
    if (enemy.dead || !Number.isFinite(amount) || amount<=0) return false;
    enemy.hp=clamp(enemy.hp-amount,0,enemy.maxHp);
    if (!enemy.hp) {enemy.dead=true;enemy.state='defeated';enemy.timer=0;}
    else if(enemy.state!=='prepare'&&enemy.state!=='charge') enemy.state='alert';
    return true;
  }
  function moveToward(e,target,speed,dt,env,spec) {
    const dir=unit(e,target),step=speed*dt, previous={x:e.x,y:e.y};
    if (Math.abs(dir.x)>Math.abs(dir.y)) e.facing=dir.x>0?'right':'left';
    else e.facing=dir.y>0?'down':'up';
    const dx=dir.x*step,dy=dir.y*step;
    const nx={x:e.x+dx,y:e.y},ny={x:e.x,y:e.y+dy};
    if(valid(nx,spec,env)) e.x=nx.x;
    if(valid({x:e.x,y:ny.y},spec,env)) e.y=ny.y;
    return distance(e,previous)>0.001;
  }
  function emitProjectile(world,e,spec,player) {
    const aim=unit(e,player);
    world.projectiles.push({owner:e.id,kind:e.kind,x:e.x,y:e.y,vx:aim.x*spec.projectileSpeed,vy:aim.y*spec.projectileSpeed,range:spec.projectileRange,travelled:0,damage:spec.damage,radius:9,knockback:spec.knockback||0});
  }
  function update(world,dt,player,env={}) {
    if(!Number.isFinite(dt)||dt<0) throw new Error('dt inválido');
    if(!player||!Number.isFinite(player.x)||!Number.isFinite(player.y)) throw new Error('Jogador inválido');
    dt=Math.min(dt,.1);
    const events=[],rng=env.random||Math.random,walkable=env;
    for(const e of world.enemies) {
      const spec=SPECIES[e.kind];
      if(e.dead){e.timer+=dt;continue;}
      e.cooldown=Math.max(0,e.cooldown-dt);
      const d=distance(e,player);
      const home=distance(e,{x:e.homeX,y:e.homeY});
      if(e.state==='charge') {
        e.timer-=dt;
        const moved=moveToward(e,{x:e.targetX,y:e.targetY},spec.chargeSpeed,dt,walkable,spec);
        if(!e.hitPlayerThisAttack&&distance(e,player)<20) {
          e.hitPlayerThisAttack=true;
          events.push({type:'damage-player',enemyId:e.id,amount:spec.damage,kind:e.kind,knockback:20});
        }
        if(e.timer<=0||!moved||distance(e,{x:e.targetX,y:e.targetY})<8){e.state='recover';e.timer=.7;}
        continue;
      }
      if(e.state==='prepare') {
        e.timer-=dt;
        if(e.timer<=0){
          if(e.kind==='rock_boar'){
            e.state='charge';e.timer=spec.chargeDuration;e.hitPlayerThisAttack=false;
          } else {
            emitProjectile(world,e,spec,player);
            events.push({type:'attack',enemyId:e.id,kind:e.kind});
            e.state='recover';e.timer=.35;
          }
        }
        continue;
      }
      if(e.state==='recover') {e.timer-=dt;if(e.timer<=0)e.state='alert';continue;}
      if(home>340||d>spec.detection*1.7) {
        e.state='return';
        if(distance(e,{x:e.homeX,y:e.homeY})>6) moveToward(e,{x:e.homeX,y:e.homeY},spec.speed,dt,walkable,spec);
        else e.state='wander';
        continue;
      }
      if(d<=spec.detection) {
        if(d<=spec.attackRange&&e.cooldown===0) {
          e.cooldown=spec.cooldown;e.state='prepare';e.timer=spec.windup;
          e.targetX=player.x;e.targetY=player.y;
          events.push({type:'telegraph',enemyId:e.id,kind:e.kind});
        } else {
          e.state='chase';
          // Os atiradores procuram manter distância; o javali persegue.
          if(e.kind==='rock_boar'||d>spec.attackRange*.65) moveToward(e,player,spec.speed,dt,walkable,spec);
        }
      } else {
        e.state='wander';
        e.phase+=dt;
        if(e.phase>2.5) {
          e.phase=0;
          const angle=rand(rng)*Math.PI*2,radius=30+rand(rng)*45;
          const target={x:e.homeX+Math.cos(angle)*radius,y:e.homeY+Math.sin(angle)*radius};
          if(valid(target,spec,env)){e.targetX=target.x;e.targetY=target.y;}
        }
        moveToward(e,{x:e.targetX,y:e.targetY},spec.speed*.4,dt,walkable,spec);
      }
    }
    for(let i=world.projectiles.length-1;i>=0;i--){
      const p=world.projectiles[i],nx=p.x+p.vx*dt,ny=p.y+p.vy*dt;
      const step=length(nx-p.x,ny-p.y);
      p.travelled+=step;
      if((env.projectileBlocked&&env.projectileBlocked(nx,ny))||p.travelled>=p.range){
        world.projectiles.splice(i,1);continue;
      }
      p.x=nx;p.y=ny;
      if(distance(p,player)<=p.radius+(player.radius||9)){
        events.push({type:'damage-player',enemyId:p.owner,kind:p.kind,amount:p.damage,knockback:p.knockback});
        world.projectiles.splice(i,1);
      }
    }
    return events;
  }
  function spawn(world,player,env={},options={}){
    const max=options.maxEnemies??24,minDistance=options.minDistance??180;
    if(world.enemies.filter(e=>!e.dead).length>=max)return null;
    if(typeof env.randomPoint!=='function'||typeof env.getRegion!=='function') return null;
    const rng=env.random||Math.random;
    for(let n=0;n<20;n++){
      const point=env.randomPoint(rng);
      if(!point||distance(point,player)<minDistance)continue;
      const region=normalizeRegion(env.getRegion(point.x,point.y));
      const choices=Object.keys(SPECIES).filter(k=>SPECIES[k].region===region&&valid(point,SPECIES[k],env));
      if(!choices.length)continue;
      return addEnemy(world,choices[Math.floor(rand(rng)*choices.length)],point.x,point.y,env);
    }
    return null;
  }
  // Apenas dados: o drop real fica reservado para a versão 0.10.
  return Object.freeze({SPECIES,normalizeRegion,createState,createEnemy,addEnemy,damageEnemy,update,spawn});
});
