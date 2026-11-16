'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Y=require('./shared-game');require('../js/practice');require('../js/skill-guide');
const dt=Y.C.DT;
function arena(space,seat,acts=['zipao','pingyi']){
 const kits=[Y.skillSet('lingfeng'),Y.skillSet('lingfeng')];kits[seat]=Y.skillSet('xiaohong',acts);
 const m=Y.createMatch({courtMode:space?'3d':'2d',skills:kits}),p=m.players[seat];m.phase='rally';m.shuttle.live=false;
 for(const q of m.players)Object.assign(q,{x:q.side*3,y:0,z:space?seat?.8:-.8:0,energy:100,stamina:50});
 return {m,p};
}
function feed(m,p,extra={}){Object.assign(m.shuttle,{x:p.x+p.dir*.65,y:1.8,z:p.z||0,vx:-p.dir*7,vy:-1,vz:0,speed:7,live:true,held:false,netHit:false,crossedNet:true,lastHitter:1-p.idx,selfToss:-1,tossSkill:null,ctl:null,shot:'drive',isServe:false,...extra});m.rePred();}
function use(m,p,id,aim){p.skillCd=0;return m.useSkill(p,p.kit.act.indexOf(id),{aim});}
function manual(m,p,btn='clear'){p.swing={btn,t:Y.C.SW_SWEET,dur:.45,style:btn,kind:'over'};const random=Math.random;Math.random=()=>.5;try{m.doHit(p,p.swing,.2,m.reachFor(p));}finally{Math.random=random;}return m.events.findLast(e=>e.type==='hit'&&e.p===p.idx&&!e.device);}
function passive(m,p,q,ctx={}){feed(m,p);m.afterHit(p,{type:'clear'},q,ctx);}
for(const space of[false,true])for(const seat of[0,1]){
 const tag=(space?'3D':'2D')+' seat '+seat;
 test(tag+' calibration works without a reflector, rewards stable play, and caps resource income',()=>{
  const {m,p}=arena(space,seat);p.energy=0;p.stamina=40;
  passive(m,p,.75);assert.equal(p.cnt.calibrate||0,0);passive(m,p,.75);assert.equal(p.cnt.calibrate,1);assert.equal(p.energy,9);assert.equal(p.stamina,45);
  const stamina=p.stamina;for(let i=0;i<5;i++)passive(m,p,.9);assert.equal(p.cnt.calEarn,1);assert.equal(p.stamina,stamina,'holding calibration cannot farm resources');
  for(let i=0;i<4;i++){p.cnt.calibrate=0;passive(m,p,.9);}assert.equal(p.cnt.calEarn,3);assert.equal(p.stamina,55);
  m.resetPoint(false);m.phase='rally';p.cnt.calibrate=0;passive(m,p,.71);passive(m,p,.6);passive(m,p,.71);assert.equal(p.cnt.calibrate,0);passive(m,p,.71);assert.equal(p.cnt.calibrate,1);
  m.resetPoint(false);assert.equal(p.cnt.calibrate,1);assert.equal(p.cnt.calEarn,undefined);assert.equal(p.cnt.calRally,undefined);
 });
 test(tag+' passive excludes serves, devices and self-toss followups',()=>{
  const {m,p}=arena(space,seat);
  for(const ctx of[{serve:true},{device:true},{ownSide:true},{skill:'zipao'},{skill:'huiguo'},{skill:'jieli'},{skill:'youyou'},{geometryFollow:true}])passive(m,p,.95,ctx);
  assert.ok(!p.cnt.calibrate);assert.equal(p.cnt.calEarn,undefined);
 });
 test(tag+' reflector is affordable, automatically spends calibration, remains fixed and has a real warmup',()=>{
  const {m,p}=arena(space,seat,['fanshe','pingyi']);p.energy=22;p.cnt.calibrate=1;assert.ok(use(m,p,'fanshe'));assert.equal(p.energy,0);assert.equal(p.cnt.calibrate,0);
  const e=m.entOf('board',seat);assert.equal(e.n,2);assert.equal(e.t,12);assert.equal(e.warm,.25);assert.equal(e.radius,.55);
  const target=[e.target,e.targetZ];m.players[1-seat].x=1;m.players[1-seat].z=2;assert.deepEqual([e.target,e.targetZ],target);
  feed(m,p,{x:e.x,y:e.y,z:e.z||0});assert.equal(m.skShuttle({...m.shuttle,x:e.x+.1}),false);
  e.age=.3;assert.ok(m.skShuttle({...m.shuttle,x:e.x+.1}));assert.equal(e.n,1);assert.equal(m.shuttle.lastHitter,seat);assert.ok(m.pred.landX*p.dir>.3);assert.ok(!m.pred.netHit);
 });
 test(tag+' self-toss can be prepared early and gives exactly one manual followup bonus',()=>{
  const {m,p}=arena(space,seat);p.cnt.calibrate=1;p.energy=20;
  assert.ok(use(m,p,'zipao'));const prep=m.entOf('geometryPrep',seat);assert.ok(prep);assert.equal(prep.t,4);assert.equal(p.cnt.calibrate,1,'calibration paid only on catch');assert.equal(p.energy,0);
  assert.equal(use(m,p,'zipao'),false);assert.equal(prep.t,4);
  feed(m,p);m.skPlayer(p,dt);assert.equal(m.entOf('geometryPrep',seat),undefined);assert.equal(m.shuttle.selfToss,seat);assert.equal(p.cnt.calibrate,0);assert.equal(m.shuttle.vz||0,0);
  assert.equal(m.mods(p).jump,1.2);assert.equal(m.mods(p).reach,1.1);assert.equal(m.skHitQ(p,.1,{}),.95);
  const e=manual(m,p);assert.ok(e.q>=.95);assert.equal(m.geometryFollow(p),false);assert.equal(p.buff.geometryFollow,0);assert.equal(p.cnt.calEarn||0,0);
  assert.ok(p.swing.dur<.45);assert.ok(!m.pred.netHit);assert.ok(m.pred.landX*p.dir>0);
 });
 test(tag+' self-toss cannot intercept remote, controlled, served or unreturned balls',()=>{
  const {m,p}=arena(space,seat);assert.ok(use(m,p,'zipao'));const e=m.entOf('geometryPrep',seat);
  const cases=[{x:p.x+p.dir*3},{lastHitter:seat},{crossedNet:false},{netHit:true},{held:true},{live:false},{ctl:{k:'rewind',o:1-seat}},{isServe:true},{y:.2},...(space?[{z:p.z+2}]:[])];
  for(const extra of cases){feed(m,p,extra);assert.equal(m.geometryCatch(p,e),false,JSON.stringify(extra));assert.ok(m.entOf('geometryPrep',seat));}
  m.shuttle.live=false;for(let i=0;i<500;i++)m.step(dt);assert.equal(m.entOf('geometryPrep',seat),undefined);assert.equal(p.buff.geometryFollow||0,0);
 });
 test(tag+' preparing pauses between points, stores original aim and still loses without a followup',()=>{
  const {m,p}=arena(space,seat);const aim={x:0,y:1};assert.ok(use(m,p,'zipao',aim));const e=m.entOf('geometryPrep',seat),saved={...e.aim};m.resetPoint(false);
  for(let i=0;i<60;i++)m.step(dt);assert.equal(e.t,4);assert.deepEqual(e.aim,saved);
  m.phase='rally';feed(m,p);m.skPlayer(p,dt);for(let i=0;i<480&&m.phase==='rally';i++)m.step(dt);
  assert.equal(m.score[1-seat],1,'vertical toss does not itself return the shuttle');
 });
 test(tag+' guide improves actual manual contact, preserves legal shot family and never spends on devices or serves',()=>{
  const {m,p}=arena(space,seat,['pingyi','fanshe']);p.cnt.calibrate=1;assert.ok(use(m,p,'pingyi'));const e=m.entOf('guide',seat);assert.equal(e.n,3);assert.equal(e.t,10);assert.equal(p.cnt.calibrate,0);
  assert.equal(m.mods(p).timing,1.25);assert.equal(m.mods(p).reach,1.08);
  for(const ctx of[{device:true},{serve:true},{ownSide:true}]){feed(m,p);assert.equal(m.skHitQ(p,.2,ctx),.2);m.skShot(p,{type:'clear',vx:p.dir*10,vy:10,vz:0},ctx);assert.equal(e.n,3);}
  feed(m,p);const hit=manual(m,p);assert.ok(hit.q>=.86);assert.equal(e.n,2);assert.ok(p.swing.dur<.45);assert.ok(m.pred.landX*p.dir>0&&!m.pred.netHit);
  m.skillsOn=false;assert.equal(m.mods(p).reach,1);assert.equal(m.skHitQ(p,.2,{}),.2);
 });
 test(tag+' every two-skill loadout can spend the passive and snapshots retain readiness',()=>{
  const {m,p}=arena(space,seat);use(m,p,'zipao');p.cnt.calibrate=1;p.cnt.calRally=1;p.cnt.calEarn=2;use(m,p,'pingyi');
  const snap=Y.skPack(m),v=arena(space,seat).m;Y.skUnpack(v,snap,snap,1);
  assert.equal(v.players[seat].cnt.calEarn,2);assert.equal(v.players[seat].cnt.calRally,1);assert.equal(v.ents.find(e=>e.k==='guide').n,3);assert.equal(v.ents.find(e=>e.k==='geometryPrep').aim.manual,m.entOf('geometryPrep',seat).aim.manual);
  const packed=JSON.stringify(snap);m.entOf('geometryPrep',seat).aim.x=.99;assert.equal(JSON.stringify(snap),packed);v.ents.find(e=>e.k==='geometryPrep').aim.y=-.99;assert.equal(JSON.stringify(snap),packed,'remote interpolation never mutates authority snapshots');
 });
}
test('Xiaohong player copy and both guides describe the same strengthened rules',()=>{
 assert.equal(Y.SKILLS.fanshe.cost,22);assert.equal(Y.SKILLS.zipao.cost,20);
 for(const mode of['2d','3d'])for(const id of['biaochi','fanshe','zipao','pingyi'])assert.equal(Y.skillGuide(id,mode).steps.length,3);
 assert.match(Y.SKILLS.fanshe.help.effect,/0.35秒/);assert.match(Y.SKILLS.zipao.help.effect,/2.5秒/);assert.match(Y.SKILLS.pingyi.help.effect,/3次/);
});
for(const mode of['2d','3d'])test(mode+' all three Xiaohong loadouts play finite AI rallies with real skill use',()=>{
 const random=Math.random;let seed=61116;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 try{
  const acts=Y.char('xiaohong').acts,records=[];
  for(let n=0;n<3;n++){
   const ids=['xiaohong',['lingfeng','canglan','ranran'][n]],pair=[acts[n],acts[(n+1)%3]],m=Y.createMatch({courtMode:mode,skills:[Y.skillSet(ids[0],pair),Y.skillSet(ids[1])],stats:ids.map(char=>Y.buildStats({char,...Y.recommendedGear(char)}))});
   m.players.forEach(p=>p.energy=60);const ai=ids.map((id,i)=>Y.createAI(m,i,'hard',id));let casts=0;
   for(let ticks=0;ticks<36000&&m.score[0]+m.score[1]<3;ticks++){
    ai.forEach(a=>a.update(dt));m.step(dt);casts+=m.events.filter(e=>e.type==='skill'&&e.p===0).length;m.events.length=0;
    assert.ok(Number.isFinite(m.shuttle.x+m.shuttle.y+(m.shuttle.z||0)));
    assert.ok(m.players.every(p=>Number.isFinite(p.x+p.y+(p.z||0))&&p.energy>=0&&p.energy<=100.001));
   }
   assert.ok(m.score[0]+m.score[1]>=3,pair.join('/')+' must complete rallies');records.push(casts);
  }
  assert.ok(records.every(n=>n>0),'each loadout uses skills in actual AI rallies: '+records.join(','));
 }finally{Math.random=random;}
});
