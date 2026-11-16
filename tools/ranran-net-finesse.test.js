'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Y=require('./shared-game');
require('../js/skill-guide');
const dt=Y.C.DT;
function arena(space,seat,acts=['tangqiu','jiewang']){
 const ids=['lingfeng','lingfeng'];ids[seat]='ranran';
 const m=Y.createMatch({courtMode:space?'3d':'2d',skills:ids.map((c,i)=>Y.skillSet(c,i===seat?acts:undefined)),stats:ids.map(char=>Y.buildStats({char,...Y.recommendedGear(char)}))}),p=m.players[seat];
 m.phase='rally';m.shuttle.live=false;Object.assign(p,{x:p.side*1.6,z:space?.8:0,energy:100,stamina:55});return{m,p};
}
function feed(m,p,depth=1.1,height=1.8){Object.assign(m.shuttle,{x:p.side*depth,y:height,z:p.z||0,vx:p.side*8,vy:-1,vz:0,speed:8,live:true,held:false,lastHitter:1-p.idx,crossedNet:true,netHit:false,ctl:null,selfToss:-1,shot:'drop',isServe:false});}
function hit(m,p,aim=0,btn='drop'){
 p.swing={btn,style:btn,t:Y.C.SW_SWEET,dur:.45,aim:{y:aim}};if(m.courtMode==='3d')m.inputs[p.idx].move=aim;
 m.doHit(p,p.swing,.5,m.reachFor(p));return m.events.findLast(e=>e.type==='hit'&&e.p===p.idx);
}
function path(m){return m.courtMode==='3d'?Y.simulate3D(m.shuttle,m.physEnv(),false):Y.simulate(m.shuttle.x,m.shuttle.y,m.shuttle.vx,m.shuttle.vy,6,false,false,m.physEnv());}
function seeded(fn){const random=Math.random;let seed=61116;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};try{return fn();}finally{Math.random=random;}}
for(const space of[false,true])for(const seat of[0,1]){
 const tag=(space?'3D':'2D')+' seat '+seat;
 test(tag+' final manual net flights clear the actual cork across contact heights, aims and winds',()=>seeded(()=>{
  for(const wind of[0,-1.6,1.6])for(const depth of[.35,1.2,2.6])for(const height of[.3,.5,.9,1.25,1.85,2.8])for(const aim of[-1,0,1]){
   const{m,p}=arena(space,seat);m.env={wind,windZ:space?wind*.4:0,drag:wind? .08:Y.C.DRAG};p.x=p.side*Math.min(2.75,depth+.45);
   feed(m,p,depth,height);m.inputs[seat].move=space?aim:0;m.inputs[seat].strafe=space?aim*.5:0;const targetZ=space?m.shotTarget(p,'drop').z:0;
   const origin=[m.shuttle.x,m.shuttle.y,m.shuttle.z];hit(m,p,aim);const f=path(m),info=JSON.stringify({space,seat,wind,depth,height,aim,f});
   assert.deepEqual([m.shuttle.x,m.shuttle.y,m.shuttle.z],origin,'no teleport');assert.ok(!f.netHit,info);
   assert.ok(f.netY>=Y.C.NET_H+Y.C.SHUTTLE_R+.099,info);assert.ok(f.landX*p.dir>.5&&f.landX*p.dir<1.6,info);
   if(space)assert.ok(Math.abs(f.landZ-targetZ)<.045,info);
  }
 }));
 test(tag+' high net contact stays low; low saves lift safely; step and tether handovers tighten placement',()=>{
  const lands=[];
  for(const state of[{}, {stepUntil:3},{catchUntil:2}]){
   const{m,p}=arena(space,seat);p.cnt.ribbon=state;feed(m,p);hit(m,p);const f=path(m);lands.push(f.landX*p.dir);
   assert.ok(f.netY<1.77);assert.ok(!f.netHit);assert.equal(p.cnt.ribbon.stepUntil||0,0);assert.equal(p.cnt.ribbon.catchUntil||0,0);
  }
  assert.ok(Math.abs(lands[0]-.95)<.04);assert.ok(Math.abs(lands[1]-.7)<.04);assert.ok(Math.abs(lands[2]-.7)<.04);
  const{m,p}=arena(space,seat);feed(m,p,.35,.3);hit(m,p);const f=path(m);assert.ok(!f.netHit);assert.ok(f.apex>1.7);assert.ok(f.landX*p.dir>1.2,'late low saves give the opponent more time');
 });
 test(tag+' explicit short/deep face control remains effective',()=>{
  const lands=[];for(const aim of[-1,0,1]){const{m,p}=arena(space,seat);feed(m,p);hit(m,p,aim);lands.push(path(m).landX*p.dir);}
  assert.ok(lands[0]+.25<lands[1]&&lands[1]+.25<lands[2]);
 });
 test(tag+' passive excludes backcourt, dead/controlled balls, serves, self toss and attacking shots',()=>{
  for(const kind of['back','high','net','dead','held','controlled','serve','self','device','ownSide','disabled','other','smash','clear']){
   const{m,p}=arena(space,seat);feed(m,p);const ctx={},shot={type:'net',vx:p.dir*4,vy:1,vz:0};
   if(kind==='back')p.x=p.side*4;if(kind==='high')m.shuttle.y=4;if(kind==='net')m.shuttle.netHit=true;if(kind==='dead')m.shuttle.live=false;
   if(kind==='held')m.shuttle.held=true;if(kind==='controlled')m.shuttle.ctl={k:'rewind',o:1-seat};if(kind==='serve')ctx.serve=true;
   if(kind==='self')m.shuttle.selfToss=seat;if(kind==='device')ctx.device=true;if(kind==='ownSide')ctx.ownSide=true;if(kind==='disabled')m.skillsOn=false;
   if(kind==='other'){p.kit=Y.skillSet('lingfeng');p.passive=p.kit.passive;}if(kind==='smash'||kind==='clear')shot.type=kind;
   m.skShot(p,shot,ctx);assert.equal(ctx.newcomerSolved,undefined,kind);assert.deepEqual([shot.vx,shot.vy,shot.vz],[p.dir*4,1,0],kind);
  }
 });
 test(tag+' real domain crossing preserves selected lane, spends once and lands at short/deep target',()=>{
  for(const deep of[false,true]){
   const{m,p}=arena(space,seat);m.inputs[seat].move=deep?1:-1;m.useSkill(p,1,{aim:deep?1:-1});m.inputs[seat].move=0;
   feed(m,p,1.1,.65);m.inputs[seat].strafe=space?-.4:0;hit(m,p);const z=m.shuttle.silkShot.z;assert.equal(p.cnt.ribbon.shots,2);
   m.inputs[seat].strafe=1;let transformed=false;
   for(let i=0;i<400&&m.phase==='rally';i++){m.step(dt);if(p.cnt.ribbon.shots===1){transformed=true;break;}}
   assert.ok(transformed);assert.ok(!m.pred.netHit);assert.ok(Math.abs(m.pred.landX*p.dir-(deep?m.halfOf(1-seat)-.55:.65))<.05);
   if(space)assert.ok(Math.abs(m.pred.landZ-z)<.05);
   const pred={...m.pred};for(let i=0;i<1000&&m.phase==='rally';i++)m.step(dt);
   assert.equal(m.phase,'point');assert.ok(m.landMark.inB);assert.ok(Math.abs(m.landMark.x-pred.landX)<.1);assert.equal(p.cnt.ribbon.shots,1);
  }
 });
 test(tag+' ribbon recast solves real short/deep flights from low holds without passive payout',()=>{
  for(const deep of[false,true])for(const h of[.5,1.3,2]){
   const{m,p}=arena(space,seat,['hongxian','tangqiu']);feed(m,p,.4,h);m.shuttle.ctl={k:'tether',o:seat,t:1};p.cnt.ribbon={catchUntil:2};m.inputs[seat].move=deep?1:-1;m.inputs[seat].strafe=space?.3:0;
   m.ribbonFling(p,Y.skillVector('hongxian',{x:deep?1:-1,y:0}));const f=path(m);assert.equal(m.shuttle.ctl,null);assert.ok(!f.netHit);assert.ok(deep?f.landX*p.dir>5.8:f.landX*p.dir<1.1);assert.equal(m.shuttle.bowBy,null);assert.equal(p.cnt.ribbon.catchUntil,0);
  }
 });
 test(tag+' actual swing after tether release gains the handover without teleporting the held ball',()=>{
  const{m,p}=arena(space,seat,['hongxian','tangqiu']);feed(m,p,.9,1.8);m.shuttle.ctl={k:'tether',o:seat,t:1};p.cnt.ribbon={catchUntil:2};
  m.handlePress(p,{btn:'drop'});assert.equal(m.shuttle.ctl,null);assert.ok(p.swing);
  for(let i=0;i<70&&m.shuttle.lastHitter!==seat&&m.phase==='rally';i++)m.step(dt);
  assert.equal(m.shuttle.lastHitter,seat);const e=m.events.findLast(e=>e.type==='hit'&&e.p===seat);assert.ok(e.q>=.96);assert.ok(!m.pred.netHit);assert.ok(Math.abs(m.pred.landX*p.dir-.7)<.05);
 });
 test(tag+' lifted net remains a real obstacle accounted for by the short flight',()=>{
  const{m,p}=arena(space,seat);m.sk.netUp=4;feed(m,p,1.2,1.8);hit(m,p);const f=path(m);
  assert.ok(!f.netHit);assert.ok(f.netY>Y.C.NET_H+.9+Y.C.SHUTTLE_R);assert.ok(f.landX*p.dir<1.1);
 });
 test(tag+' an impossible field transform keeps charges; an impossible expired tether releases instead of holding forever',()=>{
  const{m,p}=arena(space,seat,['hongxian','jiewang']);m.useSkill(p,1);feed(m,p);hit(m,p);const before={...m.shuttle};m.env={g:-1};Object.assign(m.shuttle,{x:p.dir*.02,y:2,crossedNet:true});
  const velocity=[m.shuttle.vx,m.shuttle.vy,m.shuttle.vz];m.skShuttle(before);assert.equal(p.cnt.ribbon.shots,2);assert.deepEqual([m.shuttle.vx,m.shuttle.vy,m.shuttle.vz],velocity);
  feed(m,p);m.shuttle.ctl={k:'tether',o:seat,t:0};m.skControl(dt);assert.equal(m.shuttle.ctl,null);assert.equal(m.shuttle.lastHitter,1-seat);
 });
}
