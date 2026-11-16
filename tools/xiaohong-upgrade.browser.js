// Playwright CLI run-code, against the local Web root.
async page=>{
 const errors=[],missing=[],checks=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(new URL(page.url()).origin))missing.push(r.url());});
 await page.route('**/*',r=>r.continue());await page.reload();await page.waitForFunction(()=>window.App?.screen==='menu');await page.setViewportSize({width:1100,height:720});
 await page.evaluate(()=>{YY.Profile.choose('char','xiaohong');App.show('team');});
 await page.locator('[data-web-skill=zipao]').click();await page.waitForTimeout(400);
 for(const mode of['2d','3d']){
  await page.locator('[data-web-skill-mode="'+mode+'"]').click();await page.locator('[data-web-stage="1"]').click();
  await page.screenshot({path:'output/playwright/xiaohong-guide-'+mode+'.png',animations:'disabled'});
  const state=await page.evaluate(mode=>{
   const a=App,Y=YY;a.startTraining({char:'xiaohong',skills:true,freeEnergy:false},{courtMode:mode,kit:['zipao','pingyi']});a.paused=true;a.ais=[];const m=a.match,p=m.players[0];m.phase='rally';m.shuttle.live=false;p.x=-3;p.z=0;p.energy=100;p.cnt.calibrate=1;
   m.useSkill(p,0);p.skillCd=0;m.useSkill(p,1);a.R.clearFx();a.pausedDrawn=false;a.R.capture(m);a.render(0);
   return {prepared:Y.skillPrepared(m,p,'zipao'),guide:m.entOf('guide',0).n,energy:p.energy};
  },mode);
  if(!state.prepared||state.guide!==3||state.energy!==60)throw Error(mode+' preparation');checks.push({mode,...state});
  await page.screenshot({path:'output/playwright/xiaohong-ready-'+mode+'.png'});
  const hit=await page.evaluate(()=>{
   const a=App,Y=YY,m=a.match,p=m.players[0];p.cnt.calibrate=1;Object.assign(m.shuttle,{x:p.x+.6,y:1.8,z:p.z||0,vx:-7,vy:-1,vz:0,speed:7,live:true,held:false,lastHitter:1,crossedNet:true,netHit:false,ctl:null,selfToss:-1,isServe:false});m.skPlayer(p,Y.C.DT);
   a.pausedDrawn=false;a.R.capture(m);a.render(0);return{toss:m.shuttle.selfToss,q:m.skHitQ(p,.2,{}),follow:m.geometryFollow(p)};
  });
  if(hit.toss!==0||hit.q<.95||!hit.follow)throw Error(mode+' calibrated toss');checks.push(hit);
  await page.screenshot({path:'output/playwright/xiaohong-toss-'+mode+'.png'});
  await page.evaluate(()=>{App.quit();App.show('team');document.querySelector('[data-web-skill=zipao]').click();});
 }
 const draws=await page.evaluate(()=>{const cv=document.getElementById('skillDemo'),g=cv.getContext('2d');let n=0;for(const id of['biaochi','fanshe','zipao','pingyi'])for(const mode of['2d','3d'])for(const t of[.3,2.4,4.8]){YY.drawSkillGuidePreview(g,id,mode,0,0,cv.width,cv.height,t);n++;}return n;});
 if(errors.length||missing.length)throw Error(JSON.stringify({errors,missing}));await page.evaluate(()=>App.show('team'));return{passed:true,checks,draws,errors,missing};
}
