// Run with Playwright CLI against the static Web root. No live multiplayer service is contacted.
async page => {
 const checks=[],errors=[],missing=[];
 const origin=new URL(page.url()).origin;
 await page.route('**/*',route=>route.continue());
 const ok=(value,message)=>{if(!value)throw Error(message);checks.push(message);};
 const click=selector=>page.locator(selector).click();
 const state=fn=>page.evaluate(fn);
 const assert=async(fn,message)=>ok(await state(fn),message);
 const shot=async name=>{await page.waitForTimeout(350);await page.screenshot({path:'output/playwright/'+name+'.png',animations:'disabled'});};
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.url().startsWith(origin)&&r.status()>=400)missing.push(r.status()+' '+r.url());});
 await page.setViewportSize({width:1440,height:900});await page.goto(origin+'/');await page.waitForFunction(()=>window.App?.screen==='menu');
 await page.evaluate(()=>{YY.Profile.choose('char','dingding');YY.Profile.setGear('ranran','tension',24);App.show('menu');});
 await assert(()=>YY.CHARS.length===21&&Object.keys(YY.SKILLS).length===84&&YY.PHYSICS_VERSION===34,'shared 21-character / 84-skill catalog and physics 34');
 await shot('clubhouse-home');
 await click('#scr-menu [data-go=battle]');await assert(()=>App.screen==='battle','home opens the battle hub');
 await click('#scr-battle [data-go=ai]');await click('[data-quick-level=hard]');
 await assert(()=>App.screen==='ai'&&App.mode==='attract'&&App.webUI.level==='hard','difficulty selection does not prematurely start the match');
 const priorOpponent=await state(()=>App.webUI.opponent);
 await click('#quickOpponent');await click('[data-web-pick=tianchu]');await click('#rosterCancel');
 ok(await state(()=>App.webUI.opponent)===priorOpponent,'opponent selection cancel preserves the previous value');
 await click('#quickOpponent');await click('[data-web-pick=tianchu]');await click('#rosterConfirm');
 await assert(()=>App.webUI.opponent==='tianchu'&&document.getElementById('aiOpponent').value==='tianchu','opponent selection confirms into preparation');
 await click('#quickOpponentKit');await click('[data-web-kit-toggle=jingxiang]');await click('[data-web-kit-toggle=shuizhong]');await click('#kitConfirm');
 await assert(()=>App.webUI.opponentKit.join(',')==='meida,shuizhong','opponent kit is independently configurable');
 await click('#btnLoEdit');
 const beforeChar=await state(()=>YY.Profile.sel.char);
 await click('[data-web-char=ranran]');
 ok(await state(()=>YY.Profile.sel.char)===beforeChar,'character preview does not equip');
 await click('[data-web-equip-char=ranran]');await assert(()=>YY.Profile.sel.char==='ranran','explicit confirmation equips character');
 await click('[data-web-kit=ranran]');
 await state(()=>{const k=App.webUI.kit;k.value=['tangqiu','hongxian'];document.getElementById('kitConfirm').disabled=false;});await click('#kitConfirm');
 await click('[data-web-skill=jiewang]');await click('[data-web-skill-mode="3d"]');await click('[data-web-stage="1"]');
 await assert(()=>!App.webUI.playing&&App.webUI.skillTime===2.5,'skill guide supports stage scrubbing and pause');
 await click('#skillSpeed');await click('#skillReplay');
 await assert(()=>App.webUI.playing&&App.webUI.speed===.5,'skill guide supports replay and half speed');
 await shot('clubhouse-skill');
 const profileBefore=await state(()=>JSON.stringify({char:YY.Profile.sel.char,kit:YY.Profile.kit('ranran'),mode:App.settings.courtMode}));
 await click('#skillTry');
 await assert(()=>App.mode==='practice'&&App.match.courtMode==='3d'&&App.match.players[0].kit.act.includes('jiewang'),'skill trial starts 3D with the inspected skill');
 await state(()=>{App.togglePause();App.restart();});
 await assert(()=>App.match.courtMode==='3d'&&App.match.players[0].kit.act.includes('jiewang'),'restarting a trial retains court and temporary kit');
 await state(()=>App.quit());await assert(()=>App.screen==='skill','trial exit returns to the skill guide');
 ok(await state(()=>JSON.stringify({char:YY.Profile.sel.char,kit:YY.Profile.kit('ranran'),mode:App.settings.courtMode}))===profileBefore,'trial does not modify the equipped character, saved kit or match court');
 await click('#skillBack');await click('[data-web-owner-gear=ranran]');
 const previousRacket=await state(()=>YY.Profile.gear('ranran').racket);
 const otherRacket=await state(()=>YY.GEAR.racket.find(g=>g.id!==YY.Profile.gear('ranran').racket).id);
 await click('[data-web-gear='+otherRacket+']');
 ok(await state(()=>YY.Profile.gear('ranran').racket)===previousRacket,'gear preview does not equip');
 await click('#equipGear');ok(await state(()=>YY.Profile.gear('ranran').racket)===otherRacket,'explicit gear confirmation persists the item');
 await click('[data-web-gear-tab=tension]');await page.locator('#webTension').fill('26');await click('#equipGear');
 await assert(()=>YY.Profile.gear('ranran').tension===26,'tension confirmation persists 26 lbs');
 await click('#armoryBack');await click('[data-web-char=tianchu]');
 await assert(()=>YY.Profile.sel.char==='ranran','other character gear can be inspected without switching the player');
 await click('[data-web-owner-gear=tianchu]');await click('#gearRecommended');await click('#armoryBack');
 await assert(()=>YY.Profile.gear('ranran').tension===26,'per-character gear is isolated');
 await click('#btnTeamBack');await assert(()=>App.screen==='ai','nested character and gear pages return to match preparation');
 await page.reload();await page.waitForFunction(()=>App.screen==='menu');
 await assert(()=>YY.Profile.sel.char==='ranran'&&YY.Profile.gear('ranran').tension===26&&App.webUI.opponent==='tianchu'&&App.webUI.level==='hard','character, gear and preparation survive reload');
 await click('#scr-menu [data-go=battle]');await click('#scr-battle [data-go=ai]');await shot('clubhouse-preparation');
 for(const mode of ['2d','3d']){
  await click('#scr-ai [data-court-mode="'+mode+'"]');await click('#quickStart');await page.keyboard.press('j');await page.waitForTimeout(700);
  await assert(()=>App.mode==='ai'&&App.match.players.every(p=>Number.isFinite(p.x+p.y))&&App.match.battleMeta.chars.join(',')==='ranran,tianchu','quick match starts with chosen characters in '+mode);
  ok(await state(()=>App.match.courtMode||'2d')===mode,'selected '+mode+' reaches real match');
  await state(()=>App.togglePause());await click('#scr-pause button:has-text("设置")');await click('#settingsBack');
  await assert(()=>App.screen==='pause'&&App.paused,'settings opened in pause returns without resuming match');
  await click('#btnQuit');await assert(()=>App.screen==='ai'&&App.mode==='attract','match exit restores preparation');
 }
 await state(()=>App.show('training'));await click('[data-web-train-mode="3d"]');await page.locator('[data-web-training=type]').selectOption('net');await page.locator('[data-web-training=freeStamina]').check();
 await click('#trainingCharacter');await click('[data-web-pick=sun]');await click('#rosterConfirm');await click('#trainingStart');
 await assert(()=>App.match.courtMode==='3d'&&App.practice.cfg.char==='sun'&&App.practice.cfg.type==='net'&&App.practice.cfg.freeStamina,'training machine uses selected character, feed and assists');
 await state(()=>App.quit());await assert(()=>App.screen==='training','training exits to its setup');
 const guides=await state(()=>{const cv=document.createElement('canvas');cv.width=760;cv.height=350;const g=cv.getContext('2d');let n=0;for(const id of Object.keys(YY.SKILLS))for(const mode of ['2d','3d']){const info=YY.skillGuide(id,mode);if(!info?.steps?.length||!info.operation||!info.summary)throw Error(id+' missing lesson');for(const t of [.5,2.5,4.5])YY.drawSkillGuidePreview(g,id,mode,0,0,760,350,t);n++;}return n;});
 ok(guides===168,'all 168 skill/mode guides render their three stages');
 const screens=['menu','battle','ai','team','armory','training','settings','story','journal','codex','help','friend','matchmaking','challenges'];
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390},{width:667,height:375}]){
  await page.setViewportSize(viewport);
  for(const screen of screens){await page.evaluate(s=>App.show(s),screen);const fits=await state(()=>{const el=document.getElementById('scr-'+App.screen),panel=el.querySelector('.panel')||el;return panel.scrollWidth<=panel.clientWidth+2&&document.body.scrollWidth<=innerWidth+2;});ok(fits,screen+' fits '+viewport.width+'×'+viewport.height);}
  await state(()=>App.show('menu'));await shot('clubhouse-menu-'+viewport.width);
 }
 await page.setViewportSize({width:1440,height:900});await state(()=>App.show('team'));await shot('clubhouse-roster');
 await click('[data-web-owner-gear=ranran]');await click('[data-web-gear-tab=racket]');await shot('clubhouse-armory');
 await state(()=>App.show('menu'));await assert(()=>!App.matchNet.configured()&&!App.account,'static release retains disabled unconfigured services');
 ok(!errors.length,'no browser exceptions: '+errors.join('; '));ok(!missing.length,'no missing static assets: '+missing.join('; '));
 return {passed:true,checks,errors,missing};
}
