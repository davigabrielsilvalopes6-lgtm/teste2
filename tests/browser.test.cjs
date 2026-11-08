#!/usr/bin/env node
'use strict';
// Run with Chromium's local CDP endpoint on port 9222. No npm dependencies.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let socket,seq=0;const pending=new Map(),errors=[],results=[];
async function send(method,params={}){const id=++seq;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))})}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
async function waitFor(expression){for(let n=0;n<200;n++){if(await evaluate(expression))return;await pause(50)}throw Error('Timeout: '+expression)}
async function check(name,fn){await fn();results.push(name);console.log('PASS '+name)}
async function key(key){await send('Input.dispatchKeyEvent',{type:'keyDown',key});await send('Input.dispatchKeyEvent',{type:'keyUp',key})}
async function mouse(x,y,button='left'){await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button,clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button,clickCount:1})}
async function internalClick(x,y,button='left'){const p=await evaluate(`(()=>{const r=cv.getBoundingClientRect();return{x:r.left+${x}*r.width/W0,y:r.top+${y}*r.height/H0}})()`);await mouse(p.x,p.y,button)}
async function targetClick(button='left'){
  const p=await evaluate(`(()=>{const b=resourceBase(G.w,window.testIndex),v=G.view,r=cv.getBoundingClientRect();return{x:r.left+(b.x-v.ox)*v.z*r.width/W0,y:r.top+(b.y-71-v.oy)*v.z*r.height/H0}})()`);
  await mouse(p.x,p.y,button);
}
async function fixture(){
  // Only reposition for reproducible test access; all extraction uses real mouse events.
  return evaluate(`(()=>{const w=G.w;for(let i=0;i<w.ob.length;i++)if(w.ob[i]===1){
    const b=resourceBase(w,i);G.px=b.x-40;G.py=b.y;
    if(blocked(w,G.px,G.py,0)||!resourcePathClear(i)||pickResource(b.x,b.y-71)!==i)continue;
    G.cx=b.x;G.cy=b.y;window.testIndex=i;G.tx=Math.floor(G.px/T);G.ty=Math.floor(G.py/T);draw(performance.now()/1000);return i;
  }throw Error('No tree fixture')})()`);
}
async function main(){
  const base='http://127.0.0.1:9222';
  const target=await (await fetch(base+'/json/new?about:blank',{method:'PUT'})).json();
  socket=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j});
  socket.onmessage=e=>{const msg=JSON.parse(e.data);if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(Error(JSON.stringify(msg.error))):p.resolve(msg.result)}else if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails)};
  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
  const url=process.env.ORIGENS_TEST_URL||pathToFileURL(path.resolve(__dirname,'../ORIGENS — Survival v0.3.html')).href;
  await send('Page.navigate',{url});
  await waitFor(`document.readyState==='complete'&&typeof start==='function'`);
  await check('single HTML opens and creates a generated world via menu',async()=>{
    assert.match(await evaluate('document.title'),/v0.3/);
    await evaluate(`localStorage.clear();$('nm').value='Browser A';$('sd').value='ORIGENS-2026';$('sz').value='128';$('cr').click()`);
    await waitFor('!!G&&!busy&&G.view!==null');assert.equal(await evaluate('G.w.ok'),true);
  });
  const index=await fixture();let worldA;
  await check('CSS-scaled canopy picking at minimum zoom and right-click exclusion',async()=>{
    await evaluate('zi=0;draw(performance.now()/1000)');await targetClick('right');assert.equal(await evaluate('G.collection.damage.size'),0);
    await targetClick();assert.equal(await evaluate(`G.collection.damage.get(${index})`),1);
    await targetClick();assert.equal(await evaluate(`G.collection.damage.get(${index})`),1);
  });
  await check('HUD, minimap and full-map dragging never strike resources',async()=>{
    await evaluate('window.testActionCalls=0;window.testPrimaryAction=primaryAction;primaryAction=p=>{window.testActionCalls++;return window.testPrimaryAction(p)}');
    await internalClick(40,465);await internalClick(850,60);
    assert.equal(await evaluate('window.testActionCalls'),0);
    assert.equal(await evaluate(`G.collection.damage.get(${index})`),1);
    await key('m');assert.equal(await evaluate('mapOpen'),1);
    await internalClick(450,250);await send('Input.dispatchMouseEvent',{type:'mousePressed',x:600,y:330,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:650,y:360,button:'left',buttons:1});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:650,y:360,button:'left',clickCount:1});
    assert.equal(await evaluate(`G.collection.damage.get(${index})`),1);assert.notEqual(await evaluate('G.mpx'),0);
    assert.equal(await evaluate('window.testActionCalls'),0);await evaluate('primaryAction=window.testPrimaryAction');
    await key('m');
  });
  await check('partial resistance survives Esc menu, browser reload and loading',async()=>{
    worldA=await evaluate('G.id');await key('Escape');assert.equal(await evaluate('G'),null);
    await send('Page.reload');await waitFor(`document.readyState==='complete'&&typeof loadWorld==='function'`);
    await evaluate(`loadWorld(${JSON.stringify(worldA)})`);await waitFor('!!G&&!busy&&G.view!==null');
    assert.equal(await evaluate(`G.collection.damage.get(${index})`),1);await fixture();
  });
  await check('max zoom and moving-camera picking destroy tree at exactly three strikes',async()=>{
    await evaluate('zi=3;draw(performance.now()/1000)');await pause(360);await targetClick();
    assert.equal(await evaluate(`G.collection.damage.get(${index})`),2);
    await pause(360);await evaluate('G.cx-=15;draw(performance.now()/1000)');await targetClick();
    assert.equal(await evaluate(`G.w.ob[${index}]`),0);assert.equal(await evaluate('G.collection.drops.size'),1);
    assert.equal(await evaluate(`blocked(G.w,resourceBase(G.w,${index}).x,resourceBase(G.w,${index}).y,0)`),0);
  });
  await check('uncollected drop survives save and reload; automatic pickup is exactly once',async()=>{
    await key('Escape');await evaluate(`loadWorld(${JSON.stringify(worldA)})`);await waitFor('!!G&&!busy&&G.view!==null');
    assert.equal(await evaluate(`G.w.ob[${index}]`),0);assert.equal(await evaluate('G.collection.drops.size'),1);
    await evaluate(`{const b=resourceBase(G.w,${index});G.px=b.x;G.py=b.y;}`);await pause(100);
    assert.equal(await evaluate('G.collection.materials.wood'),3);assert.equal(await evaluate('G.collection.drops.size'),0);
    await pause(100);assert.equal(await evaluate('G.collection.materials.wood'),3);
  });
  await check('same-seed worlds have separate progress and menu supports two worlds',async()=>{
    await key('Escape');await evaluate(`$('nm').value='Browser B';$('sd').value='ORIGENS-2026';$('sz').value='128';$('cr').click()`);
    await waitFor('!!G&&!busy&&G.view!==null');assert.notEqual(await evaluate('G.id'),worldA);
    assert.equal(await evaluate(`G.w.ob[${index}]`),1);assert.equal(await evaluate('G.collection.materials.wood'),0);
    await key('Escape');assert.equal(await evaluate(`document.querySelectorAll('#wl .r').length`),2);
    await evaluate(`loadWorld(${JSON.stringify(worldA)})`);await waitFor('!!G&&!busy&&G.view!==null');
    assert.equal(await evaluate('G.collection.materials.wood'),3);assert.equal(await evaluate(`G.w.ob[${index}]`),0);
  });
  await check('movement, debug, reveal and boat controls remain usable',async()=>{
    await evaluate(`G.px=(G.w.sp.x+.5)*T;G.py=(G.w.sp.y+.5)*T;G.cx=G.px;G.cy=G.py;`);
    const before=await evaluate('[G.px,G.py]');
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'d'});await send('Input.dispatchKeyEvent',{type:'keyDown',key:'s'});await pause(160);
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'d'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'s'});
    const after=await evaluate('[G.px,G.py]');assert.ok(after[0]>before[0]&&after[1]>before[1]);
    await key('F3');assert.equal(await evaluate('dbg'),1);await key('F3');
    await internalClick(830,155);assert.equal(await evaluate('G.ex.every(x=>x===255)'),true);
    const coast=await evaluate(`(()=>{const w=G.w,N=w.N;for(let i=0;i<N*N;i++)if(w.ter[i]===3&&!blocked(w,(i%N+.5)*T,(Math.floor(i/N)+.5)*T,0)){
      for(const d of [-1,1,-N,N])if(w.sea[i+d]){G.px=(i%N+.5)*T;G.py=(Math.floor(i/N)+.5)*T;return true}
    }return false})()`);assert.equal(coast,true);
    await key('e');assert.equal(await evaluate('G.boat'),1);await key('e');assert.equal(await evaluate('G.boat'),0);
  });
  await check('collected counters persist across actual document reload without console exceptions',async()=>{
    await key('Escape');await send('Page.reload');await waitFor(`document.readyState==='complete'&&typeof loadWorld==='function'`);
    await evaluate(`loadWorld(${JSON.stringify(worldA)})`);await waitFor('!!G&&!busy&&G.view!==null');
    assert.equal(await evaluate('G.collection.materials.wood'),3);assert.equal(await evaluate('G.collection.drops.size'),0);
    await pause(150);assert.deepEqual(errors,[]);
  });
  await check('world deletion requires confirmation and preserves the other world',async()=>{
    await key('Escape');
    await evaluate(`window.testDeleteButton=[...document.querySelectorAll('#wl .r')].find(r=>r.textContent.includes('Browser B')).querySelectorAll('button')[1];window.testDeleteButton.click()`);
    assert.equal(await evaluate(`document.querySelectorAll('#wl .r').length`),2);assert.equal(await evaluate('window.testDeleteButton.textContent'),'Confirmar?');
    await evaluate('window.testDeleteButton.click()');assert.equal(await evaluate(`document.querySelectorAll('#wl .r').length`),1);
    await evaluate(`loadWorld(${JSON.stringify(worldA)})`);await waitFor('!!G&&!busy&&G.view!==null');
    assert.equal(await evaluate('G.collection.materials.wood'),3);assert.deepEqual(errors,[]);
  });
  await check('1024×1024 world starts and saves a sparse overlay without serializing the map',async()=>{
    await key('Escape');await evaluate(`$('nm').value='Browser Large';$('sd').value='TEST-1024-0';$('sz').value='1024';$('cr').click()`);
    await waitFor('!!G&&!busy&&G.view!==null');assert.equal(await evaluate('G.w.N'),1024);assert.equal(await evaluate('G.w.ok'),true);
    await fixture();await targetClick();
    const saved=await evaluate(`(()=>{const t=performance.now(),ok=save(1),raw=lsGet(WK+G.id),data=JSON.parse(raw);return{ok,bytes:raw.length,ms:Math.round(performance.now()-t),partial:data.collection.damage.length,hasMap:!!(data.ob||data.ter||data.w)}})()`);
    assert.equal(saved.ok,1);assert.equal(saved.partial,1);assert.equal(saved.hasMap,false);assert.ok(saved.bytes<180000);
    console.log('  large world save: '+JSON.stringify(saved));assert.deepEqual(errors,[]);
  });
  const screenshot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/origens-v03.png',Buffer.from(screenshot.data,'base64'));
  console.log(JSON.stringify({passed:results.length,browser:'Chromium real via CDP',consoleErrors:errors.length,screenshot:'/tmp/origens-v03.png'}));
  await send('Page.close');socket.close();
}
main().catch(e=>{console.error(e);socket?.close();process.exitCode=1});
