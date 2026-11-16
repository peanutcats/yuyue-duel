// Playwright CLI run-code against the local Web root; never connects to a live room.
async page=>{
 const errors=[],missing=[],checks=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(new URL(page.url()).origin))missing.push(r.url());});
 await page.route('**/*',r=>r.continue());await page.reload();await page.waitForFunction(()=>window.App?.screen==='menu');await page.setViewportSize({width:1100,height:720});
 await page.evaluate(()=>{YY.Profile.choose('char','tianchu');App.show('team');});await page.locator('[data-web-skill=meida]').click();
 for(const mode of['2d','3d']){
  await page.locator('[data-web-skill-mode="'+mode+'"]').click();await page.locator('[data-web-stage="0"]').click();await page.waitForTimeout(350);
  await page.screenshot({path:'output/playwright/tianchu-balanced-guide-'+mode+'.png',animations:'disabled'});
  const start=await page.evaluate(mode=>{
   const a=App,Y=YY;a.startTraining({char:'tianchu',skills:true,freeEnergy:false},{courtMode:mode,kit:['meida','shuizhong']});a.paused=true;a.ais=[];const m=a.match,p=m.players[0];m.phase='rally';m.shuttle.live=false;Object.assign(p,{x:-3,y:0,z:0,energy:100});
   m.useSkill(p,0);p.cnt.mirage.focus=2;a.R.clearFx();a.pausedDrawn=false;a.R.capture(m);a.render(0);return{energy:p.energy,warm:p.cnt.mirage.ready.meida.warm,seconds:p.cnt.mirage.ready.meida.t,label:Y.skillRecastText(m,p,'meida')};
  },mode);
  if(start.energy!==78||start.warm!==.18||start.seconds!==4.5||start.label!=='假拍准备中')throw Error(mode+' startup');checks.push({mode,...start});
  await page.screenshot({path:'output/playwright/tianchu-balanced-ready-'+mode+'.png'});
  const catchState=await page.evaluate(()=>{
   const a=App,Y=YY,m=a.match,p=m.players[0];m.skStep(.2);Object.assign(m.shuttle,{x:p.x+.6,y:1.8,z:0,vx:-7,vy:-1,vz:0,speed:7,live:true,held:false,lastHitter:1,crossedNet:true,netHit:false,ctl:null,selfToss:-1,isServe:false});p.cooldown=.3;p.slow=.2;
   const caught=m.mirageCatch(),ctx={};const q=m.skHitQ(p,.1,ctx);a.pausedDrawn=false;a.R.capture(m);a.render(0);return{caught,q,focus:ctx.mirageFocus,stored:p.cnt.mirage.focus,cooldown:p.cooldown,slow:p.slow};
  });
  if(!catchState.caught||catchState.q!==.88||catchState.focus!==0||catchState.stored!==2||catchState.cooldown!==.3||catchState.slow!==.2)throw Error(mode+' balanced followup');checks.push(catchState);
  await page.screenshot({path:'output/playwright/tianchu-balanced-toss-'+mode+'.png'});
  await page.evaluate(()=>{App.quit();App.show('team');document.querySelector('[data-web-skill=meida]').click();});
 }
 const draws=await page.evaluate(()=>{const cv=document.getElementById('skillDemo'),g=cv.getContext('2d');let n=0;for(const id of['canying','jingxiang','meida','shuizhong'])for(const mode of['2d','3d'])for(const t of[.3,2.4,4.8]){YY.drawSkillGuidePreview(g,id,mode,0,0,cv.width,cv.height,t);n++;}return n;});
 if(errors.length||missing.length)throw Error(JSON.stringify({errors,missing}));await page.evaluate(()=>App.show('team'));return{passed:true,checks,draws,errors,missing};
}
