// Playwright CLI run-code --filename, against tools/serve.py on a local checkout.
async page=>{
 const origin=new URL(page.url()).origin,errors=[],missing=[],music=[],checks=[];
 const check=(value,message)=>{if(!value)throw Error(message);};
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{const u=new URL(r.url());if(u.origin===origin&&r.status()>=400&&!u.pathname.includes('favicon'))missing.push({url:u.pathname,status:r.status()});});
 await page.goto(origin+'/');await page.waitForFunction(()=>window.App?.match&&window.YY?.Audio);
 await page.mouse.click(8,8);
 await page.waitForFunction(()=>YY.Audio.musicVoices.some(v=>v.id==='menu'&&v.ready&&v.media.currentTime>0),{},{timeout:15000});
 const catalog=await page.evaluate(()=>({physics:YY.PHYSICS_VERSION,characters:YY.CHARS.length,skills:Object.keys(YY.SKILLS).length,account:!!App.account,matchmaking:App.matchNet.configured()}));
 check(catalog.physics===28&&catalog.characters===20&&catalog.skills===80,'latest gameplay catalog');check(!catalog.account&&!catalog.matchmaking,'unconfigured optional services stay disabled');
 await page.evaluate(()=>{App.releaseSoundscape=App.updateSoundscape;App.updateSoundscape=dt=>YY.Audio.updateMusic(dt);});
 for(const id of await page.evaluate(()=>Object.keys(YY.Soundtrack.TRACKS))){
  await page.evaluate(id=>YY.Audio.musicScene(id),id);
  await page.waitForFunction(id=>YY.Audio.musicVoices.some(v=>v.id===id&&v.ready&&v.media.currentTime>.02),id,{timeout:15000});
  await page.waitForTimeout(1100);
  const v=await page.evaluate(id=>{const a=YY.Audio.musicVoices.find(v=>v.id===id);return {id,duration:a.media.duration,ready:a.ready,level:a.level,active:YY.Audio.musicVoices.length,error:a.media.error?.message,src:new URL(a.media.src).pathname};},id);
  check(v.ready&&v.level>0&&v.active<=2&&!v.error,id+' playback');check(v.src.startsWith('/assets/audio/score/'),id+' web asset path');music.push(v);
 }
 await page.evaluate(()=>{YY.Audio.musicEnabled=false;});check(await page.evaluate(()=>YY.Audio.musicVoices.length===0),'music mute releases media');
 await page.evaluate(()=>{YY.Audio.musicEnabled=true;App.updateSoundscape=App.releaseSoundscape;delete App.releaseSoundscape;});
 for(const mode of ['2d','3d']){
  await page.evaluate(mode=>{App.setCourtMode(mode);App.startAI('normal',{opp:'ruibao',kit:['diban','huiguo']});},mode);
  await page.waitForTimeout(500);
  const state=await page.evaluate(()=>({court:App.match.courtMode||'2d',mode:App.mode,phase:App.match.phase,finite:App.match.players.every(p=>Number.isFinite(p.x+p.y)),char:App.match.battleMeta.chars[1]}));
  check(state.court===mode&&state.mode==='ai'&&state.finite&&state.char==='ruibao',mode+' AI start');checks.push(state);
  await page.screenshot({path:`output/playwright/web-main-${mode}.png`});
 }
 await page.evaluate(()=>App.startTraining({char:'ruibao',skills:true}));await page.waitForTimeout(250);
 check(await page.evaluate(()=>App.mode==='practice'&&App.practice?.cfg.char==='ruibao'),'training setup');
 await page.evaluate(()=>{App.startAttract();App.show('team');});await page.waitForTimeout(100);
 check(await page.evaluate(()=>!!document.querySelector('#scr-team .skill-box')),'character and skill explanation');
 await page.evaluate(()=>App.show('menu'));
 for(const viewport of [{width:844,height:390},{width:667,height:375}]){
  await page.setViewportSize(viewport);await page.waitForTimeout(150);
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile horizontal overflow');checks.push({viewport,layout:true});
 }
 await page.screenshot({path:'output/playwright/web-main-menu-667.png'});
 await page.evaluate(()=>YY.Audio.musicEnabled=false);
 check(!errors.length,errors.join('\n'));check(!missing.length,JSON.stringify(missing));
 return {passed:true,catalog,music,checks,errors,missing};
}
