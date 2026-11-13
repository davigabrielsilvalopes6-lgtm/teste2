'use strict';
/* ORIGENS 0.9.1 — sprites aprovados pelo usuário e animações por estado. Mantém saves v8. */
(() => {
  const SPECIES = Object.freeze({
    salamander: {name:'Salamandra Ígnea',element:3,hp:55,speed:55,detect:190,range:150,damage:12,near:8,attack:'fire',cooldown:2.5,radius:13,colour:'#b94b34',water:false,asset:'fire_salamander/salamandra_ignea_idle.png',frame:64,frames:4},
    boar: {name:'Javali Rochoso',element:2,hp:110,speed:45,detect:175,range:76,damage:18,near:10,attack:'charge',cooldown:4,radius:18,colour:'#866046',water:false,asset:'rock_boar/javali_rochoso_idle.png',frame:80,frames:4},
    spirit: {name:'Espírito do Vento',element:4,hp:45,speed:92,detect:215,range:175,damage:9,near:6,attack:'wind',cooldown:2,radius:12,colour:'#9fd4dd',water:false,asset:'wind_spirit/espirito_vento_idle.png',frame:64,frames:6},
    serpent: {name:'Serpente dos Rios',element:1,hp:65,speed:72,detect:205,range:165,damage:10,near:8,attack:'water',cooldown:2.2,radius:13,colour:'#449c9f',water:true,asset:'river_serpent/serpente_rios_idle.png',frame:80,frames:4}
  });
  const DROPS_V010 = Object.freeze({
    salamander:[['escama_ignea',1,3,1],['carne_salamandra',1,1,.35],['glandula_brasa',1,1,.08]],
    boar:[['couro_grosso',1,3,1],['carne_javali',1,2,.35],['presa_javali',1,1,.08]],
    spirit:[['essencia_vento',1,2,1],['fragmento_etereo',1,1,.35],['nucleo_corrente_ar',1,1,.08]],
    serpent:[['escama_aquatica',1,3,1],['presa_serpente',1,1,.35],['glandula_pressao',1,1,.08]]
  }); // Registro de planejamento; NÃO gera drops antes da v0.10.
  const MAX_MOBS=9, SPAWN_INTERVAL=3.5, RESPAWN_DELAY=18, SAFE_RADIUS=210;
  // Arquivos recortados das quatro pranchas aprovadas no pacote do usuário.
  // Direções nas linhas: DOWN, UP, LEFT, RIGHT.
  // A folha de cada estado contém 4 linhas, exceto projéteis e poeira (1 linha).
  const ASSET_SHEETS = Object.freeze({
    salamander:{path:'fire_salamander/',idle:['salamandra_ignea_idle.png',4],walk:['salamandra_ignea_walk.png',6],attack:['salamandra_ignea_fire_spit.png',6],melee:['salamandra_ignea_bite.png',4],hurt:['salamandra_ignea_hurt.png',2],death:['salamandra_ignea_death.png',5],projectile:['salamandra_ignea_fireball.png',4]},
    boar:{path:'rock_boar/',idle:['javali_rochoso_idle.png',4],walk:['javali_rochoso_walk.png',6],attack:['javali_rochoso_charge.png',6],melee:['javali_rochoso_attack.png',4],hurt:['javali_rochoso_hurt.png',2],death:['javali_rochoso_death.png',5],dust:['poeira_carga.png',4]},
    spirit:{path:'wind_spirit/',idle:['espirito_vento_idle.png',4],walk:['espirito_vento_walk.png',6],attack:['espirito_vento_attack.png',6],hurt:['espirito_vento_dano.png',2],death:['espirito_vento_morte.png',5],projectile:['projeteis_vento.png',4]},
    serpent:{path:'river_serpent/',idle:['serpente_rios_idle.png',4],walk:['serpente_rios_walk.png',6],attack:['serpente_rios_ataque_agua.png',6],hurt:['serpente_rios_dano.png',2],death:['serpente_rios_morte.png',5],projectile:['projetil_agua.png',6]}
  });
  const sprites={};
  let game=null, clock=0, serial=0, spawnTime=0, projectiles=[], effects=[], respawnAfter=0;
  const random=()=>Math.random();
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const dist=(x,y,a,b)=>Math.hypot(x-a,y-b);
  const direction=(x,y)=>Math.abs(x)>Math.abs(y)?x>0?3:2:y>0?0:1;
  const active=()=>!!game&&typeof G!=='undefined'&&G===game&&game.combat&&game.combat.stats.health>0;
  function ownerElement(w,x,y){
    const tx=Math.floor(x/T),ty=Math.floor(y/T);
    if(tx<0||ty<0||tx>=w.N||ty>=w.N)return 0;
    const owner=w.own[ty*w.N+tx];
    return owner>0&&w.I[owner-1]?w.I[owner-1].el:0;
  }
  function terrain(w,x,y){
    const tx=Math.floor(x/T),ty=Math.floor(y/T);
    if(tx<0||ty<0||tx>=w.N||ty>=w.N)return -1;
    return w.ter[ty*w.N+tx];
  }
  function mayOccupy(m,x,y){
    const w=game.w,sp=SPECIES[m.species],pad=m.radius*.58;
    for(const [dx,dy] of [[0,0],[pad,0],[-pad,0],[0,pad],[0,-pad]]){
      const px=x+dx,py=y+dy,t=terrain(w,px,py);
      if(ownerElement(w,px,py)!==sp.element)return false;
      if(sp.water ? t!==2 && t!==5 && t!==3 : t<=2 || t===8)return false;
      const tx=Math.floor(px/T),ty=Math.floor(py/T),index=ty*w.N+tx,obj=w.ob[index];
      if(obj>0&&obj<4){
        const lx=px-tx*T,ly=py-ty*T;
        const box=obj===1?[11,12,21,26]:[3,6,29,30];
        if(lx>=box[0]-3&&lx<=box[2]+3&&ly>=box[1]-3&&ly<=box[3]+3)return false;
      }
      if(typeof storageChestAt==='function'&&storageChestAt(w,index))return false;
    }
    for(const other of game.combat.targets){
      if(other===m||!other.mobSpecies||other.health<=0)continue;
      if(dist(x,y,other.x,other.y)<m.radius+other.radius-3)return false;
    }
    return true;
  }
  function init(g){
    game=g;clock=0;serial=0;spawnTime=0;projectiles=[];effects=[];respawnAfter=0;
    for(const [species,sp] of Object.entries(SPECIES)){
      const definitions=ASSET_SHEETS[species],set=sprites[species]={};
      for(const [state,details] of Object.entries(definitions)){
        if(state==='path')continue;
        const [file,frames]=details,picture=new Image(),animation={image:picture,frames,ready:false,state};
        set[state]=animation;
        picture.decoding='async';
        picture.onload=()=>{animation.ready=picture.naturalWidth===sp.frame*frames&&picture.naturalHeight===sp.frame*(state==='projectile'||state==='dust'?1:4);};
        picture.onerror=()=>{animation.ready=false;};
        picture.src='assets/mobs/'+definitions.path+file;
      }
    }
    game.mob09={version:1,active:0,defeated:0,projectileCount:0};
  }
  function makeMob(species,x,y){
    const sp=SPECIES[species];
    const m={id:'mob09-'+(++serial),mobSpecies:true,species,x,y,radius:sp.radius,health:sp.hp,maxHealth:sp.hp,
      flashUntil:0,dir:0,state:'wander',clock:0,readyAt:clock+1.2+random(),home:{x,y},
      waypoint:{x,y},speed:sp.speed,deadAt:0,attackAt:0,attackDir:{x:0,y:1},attackDone:false,
      cooldown:sp.cooldown,frames:0,bob:random()*6};
    game.combat.targets.push(m);return m;
  }
  function spawn(){
    if(!active()||game.boat||mapOpen||inventoryOpen||craftingOpen||chestOpen||appearanceOpen)return;
    const mobs=game.combat.targets.filter(m=>m.mobSpecies&&m.health>0);
    if(mobs.length>=MAX_MOBS||clock<respawnAfter)return;
    const w=game.w;
    const playerRegion=ownerElement(w,game.px,game.py);
    if(!playerRegion)return; // Ilha inicial e ilhotas sem elemento permanecem seguros.
    const spId=Object.keys(SPECIES).find(id=>SPECIES[id].element===playerRegion);
    if(!spId)return;
    const same=mobs.filter(m=>m.species===spId);
    if(same.length>=5)return;
    for(let attempt=0;attempt<40;attempt++){
      const angle=random()*Math.PI*2,d=220+random()*210;
      let x=game.px+Math.cos(angle)*d,y=game.py+Math.sin(angle)*d;
      // Serpentes devem surgir nas águas ou na margem úmida.
      if(dist(x,y,game.px,game.py)<SAFE_RADIUS||dist(x,y,(w.sp.x+.5)*T,(w.sp.y+.5)*T)<SAFE_RADIUS)continue;
      const trial={species:spId,radius:SPECIES[spId].radius};
      if(!mayOccupy(trial,x,y))continue;
      const tx=Math.floor(x/T),ty=Math.floor(y/T),idx=ty*w.N+tx;
      if(w.ob[idx])continue;
      makeMob(spId,x,y);return;
    }
  }
  function move(m,dx,dy,dt,speed=SPECIES[m.species].speed){
    const len=Math.hypot(dx,dy);
    if(len<.0001)return false;
    dx/=len;dy/=len;
    m.dir=direction(dx,dy);
    let moved=false,step=Math.min(120*dt,speed*dt);
    if(mayOccupy(m,m.x+dx*step,m.y)){m.x+=dx*step;moved=true;}
    if(mayOccupy(m,m.x,m.y+dy*step)){m.y+=dy*step;moved=true;}
    return moved;
  }
  function lineClear(a,b){
    const length=dist(a.x,a.y,b.x,b.y);
    for(let i=1,n=Math.ceil(length/8);i<=n;i++){
      const x=a.x+(b.x-a.x)*i/n,y=a.y+(b.y-a.y)*i/n;
      const t=terrain(game.w,x,y);
      if(t===8||t<0)return false;
      if(typeof combatObstacle==='function'&&combatObstacle(x,y))return false;
    }
    return true;
  }
  function playerDamage(m,amount){
    if(!active()||game.boat)return false;
    return applyPlayerDamage(amount,m.id);
  }
  function shoot(m,kind){
    const p=game;
    if(projectiles.length>=24)return;
    const dx=p.px-m.x,dy=p.py-12-m.y,len=Math.hypot(dx,dy)||1;
    const vx=dx/len,vy=dy/len;
    projectiles.push({id:'proj09-'+(++serial),from:m.id,kind,x:m.x,y:m.y-8,vx,vy,range:kind==='fire'?190:210,age:0});
  }
  function advance(m,dt){
    const sp=SPECIES[m.species],isDead=m.health<=0;
    if(isDead){if(!m.deadAt)m.deadAt=clock;return;}
    m.clock+=dt;
    const dx=game.px-m.x,dy=game.py-12-m.y,d=Math.hypot(dx,dy);
    if(game.boat||!game.combat.stats.health||d>sp.detect*1.8){
      if(m.state!=='return'&&m.state!=='wander')m.state='return';
    }else if(d<sp.detect&&m.state!=='prepare'&&m.state!=='attack'&&m.state!=='recover')m.state='chase';
    if(m.state==='wander'){
      if(dist(m.x,m.y,m.waypoint.x,m.waypoint.y)<12||m.clock>3){
        const a=random()*Math.PI*2,d2=22+random()*52;
        m.waypoint={x:m.home.x+Math.cos(a)*d2,y:m.home.y+Math.sin(a)*d2};m.clock=0;
      }
      move(m,m.waypoint.x-m.x,m.waypoint.y-m.y,dt,sp.speed*.38);
    }else if(m.state==='return'){
      if(dist(m.x,m.y,m.home.x,m.home.y)<18){m.state='wander';m.clock=0;}
      else move(m,m.home.x-m.x,m.home.y-m.y,dt,sp.speed*.6);
    }else if(m.state==='chase'){
      const near=sp.attack==='charge'?76:sp.range;
      if(d<=near&&clock>=m.readyAt&&lineClear({x:m.x,y:m.y},{x:game.px,y:game.py-12})){
        m.state='prepare';m.attackAt=clock;m.attackDone=false;m.attackDir={x:dx/(d||1),y:dy/(d||1)};
      }else if(sp.attack==='charge'||d>sp.range*.72){
        move(m,dx,dy,dt,sp.speed);
      }else if(sp.attack==='wind'){
        const side=Math.sin(clock*1.4+m.bob)>=0?1:-1;
        move(m,-dy*side,dx*side,dt,sp.speed*.72);
      }
    }else if(m.state==='prepare'){
      // Aviso visual inequívoco: 0.48s (javali 0.7s).
      const delay=sp.attack==='charge'?.7:.48;
      if(clock-m.attackAt>=delay){m.state='attack';m.attackAt=clock;}
    }else if(m.state==='attack'){
      const elapsed=clock-m.attackAt;
      if(sp.attack==='charge'){
        if(elapsed<.42){
          move(m,m.attackDir.x,m.attackDir.y,dt,155);
          if(!m.attackDone&&dist(m.x,m.y,game.px,game.py-12)<m.radius+11){
            m.attackDone=playerDamage(m,sp.damage);
          }
        }else m.state='recover';
      }else{
        if(!m.attackDone){
          m.attackDone=true;
          if(d<sp.radius+19)playerDamage(m,sp.near);
          else shoot(m,sp.attack);
        }
        if(elapsed>.27)m.state='recover';
      }
      if(m.state==='recover'){m.readyAt=clock+sp.cooldown;m.attackAt=clock;}
    }else if(m.state==='recover'){
      if(clock-m.attackAt>.55)m.state='chase';
    }
  }
  function updateProjectiles(dt){
    const result=[];
    for(const p of projectiles){
      const speed=p.kind==='wind'?235:p.kind==='fire'?190:215;
      const distanceTravelled=speed*dt;
      const steps=Math.max(1,Math.ceil(distanceTravelled/6));
      let hit=false;
      for(let i=0;i<steps;i++){
        p.x+=p.vx*distanceTravelled/steps;p.y+=p.vy*distanceTravelled/steps;
        p.range-=distanceTravelled/steps;
        if(p.range<=0||terrain(game.w,p.x,p.y)<0||combatObstacle(p.x,p.y)){hit=true;break;}
        if(!game.boat&&game.combat.stats.health>0&&dist(p.x,p.y,game.px,game.py-12)<15){
          applyPlayerDamage(SPECIES[p.kind==='fire'?'salamander':p.kind==='wind'?'spirit':'serpent'].damage,p.from);
          if(p.kind==='wind'){
            const push=14,tx=game.px+p.vx*push,ty=game.py+p.vy*push;
            if(!blocked(game.w,tx,ty,0)){game.px=tx;game.py=ty;}
          }
          effects.push({x:p.x,y:p.y,at:clock,kind:p.kind});hit=true;break;
        }
      }
      if(!hit&&p.range>0)result.push(p);
    }
    projectiles=result;
    effects=effects.filter(e=>clock-e.at<.35);
  }
  function updateMobs(dt){
    if(!active()||!Number.isFinite(dt)||dt<=0)return;
    dt=Math.min(dt,.05);clock+=dt;
    spawnTime+=dt;
    if(spawnTime>=SPAWN_INTERVAL){spawnTime=0;spawn();}
    for(const m of [...game.combat.targets]){
      if(!m.mobSpecies)continue;
      advance(m,dt);
      if(m.health<=0&&clock-m.deadAt>.8){
        game.combat.targets.splice(game.combat.targets.indexOf(m),1);
        game.mob09.defeated++;respawnAfter=clock+RESPAWN_DELAY;
      }
    }
    updateProjectiles(dt);
    game.mob09.active=game.combat.targets.filter(m=>m.mobSpecies&&m.health>0).length;
    game.mob09.projectileCount=projectiles.length;
  }
  function fallback(m){
    const sp=SPECIES[m.species],x=Math.round(m.x),y=Math.round(m.y),hurt=game.combat.clock<m.flashUntil;
    ctx.save();ctx.translate(x,y);
    // Pixel-art provisória (não confundir com sprite sheet final).
    ctx.fillStyle='#18252a';ctx.fillRect(-11,6,22,3);
    ctx.fillStyle=hurt?'#fff0bc':sp.colour;
    if(m.species==='salamander'){
      ctx.fillRect(-15,-9,30,14);ctx.fillRect(-11,-13,18,8);
      ctx.fillStyle='#873b30';ctx.fillRect(-20,-6,8,5);ctx.fillRect(8,3,6,5);ctx.fillRect(-13,3,6,5);
      ctx.fillStyle='#e97839';ctx.fillRect(-5,-12,5,4);ctx.fillRect(6,-8,5,4);
      ctx.fillStyle='#ffd477';ctx.fillRect(m.dir===2?-11:5,-8,3,3);
    }else if(m.species==='boar'){
      ctx.fillRect(-18,-12,36,23);ctx.fillRect(-12,-17,24,8);
      ctx.fillStyle='#55534d';ctx.fillRect(-10,-13,11,5);ctx.fillRect(3,-9,10,6);
      ctx.fillStyle='#e1d1ab';ctx.fillRect(-17,-5,5,4);ctx.fillRect(13,-5,5,4);
      ctx.fillStyle='#49372c';ctx.fillRect(-15,10,7,5);ctx.fillRect(8,10,7,5);
    }else if(m.species==='spirit'){
      const bob=Math.sin(clock*4+m.bob)*2;
      ctx.translate(0,bob);ctx.fillRect(-9,-18,18,23);ctx.fillRect(-13,-10,26,13);
      ctx.fillStyle='#c0eef0';ctx.fillRect(-5,-20,12,8);ctx.fillRect(-3,3,7,8);
      ctx.fillStyle='#344d59';ctx.fillRect(-5,-8,3,3);ctx.fillRect(3,-8,3,3);
    }else{
      ctx.fillRect(-17,-10,27,10);ctx.fillRect(-7,-15,16,8);
      ctx.fillStyle='#285766';ctx.fillRect(-23,-3,11,5);ctx.fillRect(-12,2,9,5);
      ctx.fillStyle='#b2d8c6';ctx.fillRect(-5,-11,8,3);
      ctx.fillStyle='#e4c57a';ctx.fillRect(6,-12,3,3);
    }
    ctx.restore();
  }
  function spriteState(m){
    if(m.health<=0)return 'death';
    if(game.combat.clock<m.flashUntil)return 'hurt';
    if(m.state==='attack'||m.state==='prepare')return 'attack';
    if(m.state==='chase'||m.state==='return'||m.state==='wander')return 'walk';
    return 'idle';
  }
  function draw(m){
    if(!m.mobSpecies)return false;
    const sp=SPECIES[m.species];
    if(!sp)return false;
    const dead=m.health<=0,state=spriteState(m);
    const asset=sprites[m.species],animation=asset&&asset[state];
    if(animation&&animation.ready){
      const frames=animation.frames;
      let elapsed=clock, fps=state==='walk'?9:state==='idle'?5:state==='death'?8:state==='hurt'?12:11;
      if(state==='death')elapsed=Math.max(0,clock-m.deadAt);
      else if(state==='attack')elapsed=Math.max(0,clock-m.attackAt);
      else if(state==='walk'||state==='idle')elapsed=m.clock;
      const column=(state==='death'||state==='attack'||state==='hurt')
        ?Math.min(frames-1,Math.floor(elapsed*fps))
        :Math.floor(elapsed*fps)%frames;
      const row=Math.max(0,Math.min(3,m.dir|0)),size=sp.frame;
      ctx.save();ctx.imageSmoothingEnabled=false;
      ctx.drawImage(animation.image,column*size,row*size,size,size,
        Math.round(m.x-size/2),Math.round(m.y-size*.76),size,size);
      ctx.restore();
    }else{
      // Fallback somente se o PNG estiver ausente ou incompatível.
      ctx.save();if(dead)ctx.globalAlpha=.42;fallback(m);ctx.restore();
    }
    if(m.health>0&&m.health<m.maxHealth){
      const x=Math.round(m.x),y=Math.round(m.y-29);
      ctx.fillStyle='#132127';ctx.fillRect(x-17,y,34,5);
      ctx.fillStyle='#db7362';ctx.fillRect(x-16,y+1,32*m.health/m.maxHealth,3);
    }
    if(m.state==='prepare'&&m.health>0){
      ctx.fillStyle='#ffe18a';ctx.font='bold 13px monospace';
      ctx.fillText('!',Math.round(m.x)-3,Math.round(m.y)-37);
    }
    return true;
  }
  function drawProjectiles(){
    ctx.save();ctx.imageSmoothingEnabled=false;
    for(const p of projectiles){
      const species=p.kind==='fire'?'salamander':p.kind==='wind'?'spirit':'serpent';
      const info=sprites[species]?.projectile,frame=SPECIES[species].frame;
      const x=Math.round(p.x),y=Math.round(p.y);
      if(info?.ready){
        const col=Math.floor(clock*12)%info.frames;
        ctx.drawImage(info.image,col*frame,0,frame,frame,x-14,y-14,28,28);
      }else{
        ctx.fillStyle=p.kind==='fire'?'#ef823e':p.kind==='wind'?'#9fd4dd':'#449c9f';
        ctx.fillRect(x-4,y-4,8,8);
        ctx.fillStyle=p.kind==='fire'?'#ffe186':'#e2ffff';
        ctx.fillRect(x-2,y-2,4,4);
      }
    }
    // Efeito de poeira extraído da prancha aprovada do javali.
    for(const m of game.combat.targets){
      if(m.species!=='boar'||m.state!=='attack'||m.health<=0)continue;
      const dust=sprites.boar?.dust;
      if(dust?.ready){
        const col=Math.floor(clock*9)%dust.frames,size=SPECIES.boar.frame;
        ctx.drawImage(dust.image,col*size,0,size,size,Math.round(m.x-20),Math.round(m.y-8),40,40);
      }
    }
    for(const e of effects){ctx.fillStyle=e.kind==='fire'?'#ffb26c':'#b7edf0';ctx.fillRect(e.x-7,e.y-7,14,2);ctx.fillRect(e.x-4,e.y+4,8,2);}
    ctx.restore();
  }
  const originalStart=start,originalUpdate=update,originalDrawCombatTarget=drawCombatTarget,originalDrawCombatWorld=drawCombatWorld;
  start=function(w,sv){originalStart(w,sv);init(G);};
  update=function(dt,combatDt=dt){originalUpdate(dt,combatDt);updateMobs(dt);};
  drawCombatTarget=function(target){if(target.mobSpecies){api.draw(target);return;}originalDrawCombatTarget(target);};
  drawCombatWorld=function(){originalDrawCombatWorld();drawProjectiles();};
  const api={definitions:SPECIES,assetSheets:ASSET_SHEETS,plannedDrops:DROPS_V010,init,update:updateMobs,draw,spawn,ownerElement};
  window.ORIGENS_MOBS_V09=api;
})();
