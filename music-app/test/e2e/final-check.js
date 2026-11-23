// Final check: a brand-new Tonix, used from start to finish.
const {_electron}=require('playwright');const SP=process.env.SP; // folder with test media in SP/media (made by the developer)
const fs=require('fs'),path=require('path');
const DATA=SP+'/userdata-final';fs.rmSync(DATA,{recursive:true,force:true});const OUT=SP+'/final-exports';fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT);
const launch=(d=DATA)=>_electron.launch({executablePath:'node_modules/electron/dist/electron',args:['.','--no-sandbox','--autoplay-policy=no-user-gesture-required'],env:{...process.env,TONIX_DATA:d}});
let pass=0,fail=0;const ok=(name,cond,extra='')=>{if(cond){pass++;}else{fail++;console.log('✗',name,extra)}};
(async()=>{let a=await launch();let w=await a.firstWindow();const errs=[];w.on('pageerror',e=>errs.push(e.message));await w.setViewportSize({width:1320,height:880});await w.waitForFunction(()=>window.__tfReady);
const ev=(f,x)=>w.evaluate(f,x),k=x=>w.keyboard.press(x),wait=ms=>w.waitForTimeout(ms);
ok('window title',(await w.title())==='Tonix');
ok('default save folder is Tonix Exports',(await ev(()=>S.settings.exportDir)).endsWith('Tonix Exports'));
await ev(o=>TFSettings.patch('exportDir',o),OUT);
// 1 import (audio + video)
const media=path.join(SP,'media');const files=fs.readdirSync(media).filter(f=>!f.endsWith('.png')).map(f=>path.join(media,f));
const ir=await w.evaluate(async p=>{try{await importPaths(p);return 'n='+S.tracks.length+' toast='+[...document.querySelectorAll('.toast')].map(t=>t.textContent).join(' | ')}catch(e){return 'ERR '+e.message}},files);console.log('import:',ir);await wait(500);
ok('6 songs imported',(await ev(()=>S.tracks.length))===6);
ok('video became mp3',await ev(()=>S.tracks.some(t=>t.isVideo&&t.mediaPath.endsWith('.mp3'))));
// 2 play + sound + shortcuts
await w.dblclick('.card >> nth=0');await w.waitForFunction(()=>!audio.paused&&audio.duration>0);ok('plays',true);
await k(']');await k('Shift+Minus');ok('speed/pitch keys',await ev(()=>cur().fx.speed===101&&cur().fx.pitch===95));
await k('Alt+r');ok('reset sound',await ev(()=>cur().fx.speed===100&&cur().fx.pitch===100));
await w.fill('.fx[data-key=speed] .fx-val','110');await w.press('.fx[data-key=speed] .fx-val','Enter');
// 3 save a song (instant) + album
await w.click('.card >> nth=0');await k('Control+s');await wait(300);await w.click('.modal .btn.primary');await wait(2500);
ok('song saved',fs.readdirSync(OUT).some(f=>f.endsWith('.mp3')),fs.readdirSync(OUT).join(','));
// 4 map: add 3 songs, connect, play
await k('Control+2');await wait(700);
await k('a');await wait(300);for(const n of [0,1,2]) await w.click(`.pick >> nth=${n}`);await w.click('.modal .btn.primary');await wait(400);
ok('3 songs on map',(await ev(()=>TFMap.map.stops.length))===3);
const c=async i=>{const b=await w.locator('.mstop .mart').nth(i).boundingBox();return [b.x+b.width/2,b.y+b.height/2]};
await k('p');let [x0,y0]=await c(0),[x1,y1]=await c(1),[x2,y2]=await c(2);
await w.mouse.click(x0,y0);await w.mouse.click(x1,y1);await w.mouse.click(x0,y0);await w.mouse.click(x2,y2);await k('Escape');await k('Escape');await wait(600);
ok('2 paths 50/50',JSON.stringify(await ev(()=>TFMap.map.paths.map(p=>p.chance)))==='[50,50]');
await k('Control+z');await wait(300);ok('undo path',(await ev(()=>TFMap.map.paths.length))===1);await k('Control+y');await wait(300);ok('redo path',(await ev(()=>TFMap.map.paths.length))===2);
await k('Control+Enter');await w.waitForFunction(()=>!audio.paused&&audio.duration>0);await k('2');
const firstStop=await ev(()=>TFMap.playing.stopId);await ev(()=>{audio.currentTime=audio.duration-0.3});await wait(1800);
ok('map moved to chosen song',await ev(()=>TFMap.playing&&TFMap.playing.stopId!==null))
const second=await ev(()=>TFMap.playing&&TFMap.playing.stopId);ok('map follows a path',second&&second!==firstStop);
await k('Control+Enter');
// 5 export + import into another fresh Tonix
await k('Control+m');await wait(400);await w.locator('.map-card.on .map-act',{hasText:'Export'}).click();await wait(2500);await k('Escape');
const mapFile=fs.readdirSync(OUT).find(f=>f.endsWith('.tonixmap'));ok('map exported',!!mapFile);
// 6 settings + restart keeps them
await ev(()=>TFSettings.patch('theme','ocean'));await k('Control+4');await wait(500);ok('settings page',await ev(()=>S.view==='settings'));
await k('Shift+Slash');ok('cheat sheet',await w.isVisible('.cheat'));await k('x');
await wait(800);await a.close();
a=await launch();w=await a.firstWindow();w.on('pageerror',e=>errs.push(e.message));await w.waitForFunction(()=>window.__tfReady);await wait(500);
ok('after restart: theme kept',await w.evaluate(()=>document.body.dataset.theme==='ocean'));
ok('after restart: songs kept',(await w.evaluate(()=>S.tracks.length))===6);
ok('after restart: song speed kept',await w.evaluate(()=>S.tracks.some(t=>t.fx.speed===110)));
await w.evaluate(()=>TFSettings.patch('theme','midnight'));await wait(400);await a.close();
const D2=SP+'/userdata-final2';fs.rmSync(D2,{recursive:true,force:true});
a=await launch(D2);w=await a.firstWindow();w.on('pageerror',e=>errs.push(e.message));await w.waitForFunction(()=>window.__tfReady);
await w.evaluate(f=>TFMap.importMapFile(f),path.join(OUT,mapFile));await wait(800);
ok('friend gets map + songs',(await w.evaluate(()=>TFMap.map.stops.length+'/'+TFMap.map.paths.length+'/'+S.tracks.length))==='3/2/3');
await a.close();
console.log(`FINAL CHECK: ${pass} passed, ${fail} failed, ${errs.length} page errors${errs.length?': '+errs.join(' | '):''}`);
})().catch(e=>{console.log('FAIL',e.message.split('\n').slice(0,4).join(' | '));process.exit(1)});
