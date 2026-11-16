// Playwright CLI run-code against the local Web root; no live-room connection.
async page=>{
 const errors=[],missing=[],checks=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(new URL(page.url()).origin))missing.push(r.url());});
 await page.route('**/*',r=>r.continue());await page.reload();await page.waitForFunction(()=>window.App?.screen==='menu');await page.setViewportSize({width:1100,height:720});
 await page.evaluate(()=>{YY.Profile.choose('char','ranran');App.show('team');});await page.locator('[data-web-skill=hudie]').click();
 for(const mode of['2d','3d']){
  await page.locator('[data-web-skill-mode="'+mode+'"]').click();await page.locator('[data-web-stage="1"]').click();await page.waitForTimeout(250);
  await page.screenshot({path:'output/playwright/ranran-finesse-guide-'+mode+'.png',animations:'disabled'});
  const result=await page.evaluate(mode=>{
   const a=App,Y=YY;a.startTraining({char:'ranran',skills:true,freeEnergy:false},{courtMode:mode,kit:['tangqiu','jiewang']});a.paused=true;a.ais=[];const m=a.match,p=m.players[0];m.phase='rally';m.shuttle.live=false;Object.assign(p,{x:-1.5,y:0,z:0,energy:100,stamina:55});
   m.useSkill(p,1,{aim:-1});Object.assign(m.shuttle,{x:-.9,y:.65,z:0,vx:-7,vy:-1,vz:0,speed:7,live:true,held:false,lastHitter:1,crossedNet:true,netHit:false,ctl:null,selfToss:-1,isServe:false});
   p.swing={btn:'drop',style:'drop',t:Y.C.SW_SWEET,dur:.45};m.doHit(p,p.swing,.5,m.reachFor(p));const before={net:m.pred.netHit,landing:m.pred.landX,charges:p.cnt.ribbon.shots};
   for(let i=0;i<400&&m.phase==='rally'&&p.cnt.ribbon.shots===2;i++)m.step(Y.C.DT);
   const after={net:m.pred.netHit,landing:m.pred.landX,lane:m.pred.landZ??0,charges:p.cnt.ribbon.shots};
   a.R.clearFx();a.pausedDrawn=false;a.R.capture(m);a.render(0);return{mode,physics:Y.PHYSICS_VERSION,before,after};
  },mode);
  if(result.physics!==37||result.before.net||result.before.charges!==2||result.after.net||result.after.charges!==1||Math.abs(result.after.landing-.65)>.05)throw Error(JSON.stringify(result));checks.push(result);
  await page.screenshot({path:'output/playwright/ranran-finesse-court-'+mode+'.png'});
  await page.evaluate(()=>{App.quit();App.show('team');document.querySelector('[data-web-skill=hudie]').click();});
 }
 const draws=await page.evaluate(()=>{const cv=document.getElementById('skillDemo'),g=cv.getContext('2d');let n=0;for(const id of['hudie','tangqiu','hongxian','jiewang'])for(const mode of['2d','3d'])for(const t of[.3,2.4,4.8]){YY.drawSkillGuidePreview(g,id,mode,0,0,cv.width,cv.height,t);n++;}return n;});
 if(errors.length||missing.length)throw Error(JSON.stringify({errors,missing}));return{passed:true,checks,draws,errors,missing};
}
