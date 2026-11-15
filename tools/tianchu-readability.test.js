'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Y=require('./shared-game');require('../js/ai');require('../js/court3d-ai');
const copy=v=>JSON.parse(JSON.stringify(v));
function game(space,seat){const skills=[Y.skillSet('lingfeng'),Y.skillSet('lingfeng')];skills[seat]=Y.skillSet('tianchu',['jingxiang','shuizhong']);const m=new(space?Y.Match3D:Y.Match)({skills});m.phase='rally';m.shuttle.live=false;for(const p of m.players)Object.assign(p,{x:p.side*3,z:0,energy:100,stamina:90});return{m,p:m.players[seat],o:m.players[1-seat]};}
function select(m,p,depth=0,lane=0){p.skillCd=0;m.inputs[p.idx].move=depth;m.inputs[p.idx].strafe=lane;const ok=m.useSkill(p,0,{aim:depth});m.inputs[p.idx].move=0;m.inputs[p.idx].strafe=0;return ok;}
function hit(m,p,btn='clear'){Object.assign(m.shuttle,{live:true,held:false,x:p.x+p.dir*.5,y:2.1,z:p.z||0,vx:-p.dir*12,vy:-1,vz:0,speed:12,netHit:false,ctl:null,lastHitter:1-p.idx,crossedNet:true,selfToss:-1,shot:'drive',isServe:false});const sw=p.swing={btn,style:btn,t:Y.C.SW_SWEET,dur:.45};const rand=Math.random;Math.random=()=>.42;try{m.doHit(p,sw,.12,m.reachFor(p));}finally{Math.random=rand;}p.swing=null;return m.events.findLast(e=>e.type==='hit'&&e.p===p.idx);}
function outgoing(m,p){Object.assign(m.shuttle,{live:true,held:false,x:p.side*3,y:2.8,z:0,vx:p.dir*8,vy:7,vz:0,speed:10,netHit:false,ctl:null,lastHitter:p.idx,crossedNet:false,selfToss:-1,shot:'clear',isServe:false});m.rePred();}
for(const space of[false,true])for(const seat of[0,1]){
 const tag=(space?'3D':'2D')+' seat '+seat;
 test(tag+' selected near/deep and side lanes survive releasing the controls and land at real targets',()=>{
  for(const depth of[-1,1])for(const lane of(space?[-1,0,1]:[0])){
   const{m,p}=game(space,seat);assert.ok(select(m,p,depth,lane));const e=hit(m,p),plan=p.cnt.mirage.ready.jingxiang;
   assert.equal(e.shot,depth<0?'drop':'clear');assert.ok(e.q>=.9);assert.equal(plan.n,1);assert.deepEqual(plan.aim,{depth,lane});
   const target=m.pred;assert.equal(target.netHit,false);assert.ok(Math.abs(target.landX*p.dir-(depth<0?1.35:Y.C.HALF-.55))<.1);if(space)assert.ok(Math.abs(target.landZ-lane*2.05)<.1);
   for(let n=0;n<1500&&m.phase==='rally';n++)m.step(Y.C.DT);
   assert.equal(m.phase,'point');assert.equal(m.landMark.inB,true);assert.ok(Math.abs(m.landMark.x-target.landX)<.08);if(space)assert.ok(Math.abs(m.landMark.z-target.landZ)<.08);
  }
 });
 test(tag+' free re-aim affects only the next contact, never refreshes time or charges',()=>{
  const{m,p}=game(space,seat);select(m,p,-1,space?1:0);hit(m,p);const e=p.cnt.mirage.ready.jingxiang,paid=p.energy,before=copy(m.shuttle);m.skStep(.12);const time=e.t;
  assert.ok(select(m,p,1,space?-1:0));assert.equal(e.t,time);assert.equal(e.n,1);assert.equal(p.energy,paid);for(const k of['x','y','z','vx','vy','vz'])assert.equal(m.shuttle[k],before[k]);
  const next=hit(m,p,'drop');assert.equal(next.shot,'clear');assert.ok(Math.abs(m.pred.landX)>5.9);if(space)assert.ok(m.pred.landZ<-1.9);assert.equal(p.cnt.mirage.ready.jingxiang,undefined);
 });
 test(tag+' buffered re-aim keeps the direction at the press even after the joystick is released',()=>{
  const{m,p}=game(space,seat);select(m,p,1);const paid=p.energy;p.skillCd=.08;m.inputs[seat].move=-1;m.inputs[seat].strafe=space?1:0;
  assert.equal(m.useSkill(p,0,{aim:-1}),true);assert.ok(p.cnt.skillBuffer);m.inputs[seat].move=0;m.inputs[seat].strafe=0;
  for(let i=0;i<14;i++)m.step(Y.C.DT);
  assert.deepEqual(p.cnt.mirage.ready.jingxiang.aim,{depth:-1,lane:space?1:0});assert.equal(p.energy,paid);assert.equal(p.cnt.mirage.ready.jingxiang.n,2);
 });
 test(tag+' immediate split honors input before the net; late selection is saved without teleporting',()=>{
  for(const late of[false,true]){
   const{m,p,o}=game(space,seat);outgoing(m,p);if(late){Object.assign(m.shuttle,{x:p.dir*.5,crossedNet:true});o.x=o.side*5.8;m.rePred();}
   const before=copy(m.shuttle);assert.ok(select(m,p,-1,space?-1:0));assert.equal(m.shuttle.x,before.x);assert.equal(m.shuttle.y,before.y);assert.equal(m.shuttle.z,before.z);
   if(late){assert.equal(m.shuttle.vx,before.vx);assert.equal(m.shuttle.vy,before.vy);}else{assert.ok(Math.abs(m.pred.landX)<1.5);if(space)assert.ok(m.pred.landZ<-1.9);}
   assert.equal(p.cnt.mirage.ready.jingxiang.n,1);assert.deepEqual(p.cnt.mirage.ready.jingxiang.aim,{depth:-1,lane:space?-1:0});
  }
 });
 test(tag+' no-direction reset restores the ordinary shot and an impossible choice keeps valid flight',()=>{
  const a=game(space,seat),b=game(space,seat);select(a.m,a.p,-1,space?1:0);select(a.m,a.p);select(b.m,b.p);hit(a.m,a.p,'drop');hit(b.m,b.p,'drop');assert.ok(Math.abs(a.m.pred.landX-b.m.pred.landX)<.02);if(space)assert.ok(Math.abs(a.m.pred.landZ-b.m.pred.landZ)<.02);
  const{m,p}=game(space,seat);outgoing(m,p);const v={vx:m.shuttle.vx,vy:m.shuttle.vy,vz:0,type:'clear'},before=copy(v);m.mirageVelocity=()=>null;assert.equal(m.mirageAimShot(p,v,{depth:1,lane:0}),false);assert.deepEqual(v,before);
 });
 test(tag+' identical-style decoys slow then catch up on a continuous arc without changing the true ball',()=>{
  const{m,p}=game(space,seat);outgoing(m,p);select(m,p);const f=m.entsOf('fake',seat);assert.equal(f.length,2);
  const real=copy(m.shuttle),reference={...f[0],netHit:true},start=copy(f[0]);
  assert.equal(Y.miragePace(f[0],0),1);assert.ok(Y.miragePace(f[0],.33)<.3);assert.ok(Y.miragePace(f[0],.7)>1.5);
  for(let n=0;n<48;n++){m.skStep(Y.C.DT);Y.stepShuttle(reference,Y.C.DT*m.shuttleScale(),m.env);}
  const distance=q=>Math.hypot(q.x-start.x,q.y-start.y,(q.z||0)-(start.z||0));
  assert.ok(distance(f[0])<distance(reference)*.85,'real spatial motion must visibly lag normal physics');
  assert.ok(Y.mirageMotionReadable(f[0]));assert.equal(f[0].revealed,undefined);
  const before=copy(f[0]);m.skStep(Y.C.DT);assert.ok(Math.hypot(f[0].x-before.x,f[0].y-before.y,(f[0].z||0)-(before.z||0))<.2,'no teleport');
  for(const k of['x','y','z','vx','vy','vz','lastHitter'])assert.equal(m.shuttle[k],real[k]);
 });
 test(tag+' fast incoming flight begins hesitation early but cannot be identified before motion is visible',()=>{
  const{m,p,o}=game(space,seat);outgoing(m,p);select(m,p);const f=m.entsOf('fake',seat);assert.ok(f.every(e=>e.feintAt===.18&&!Y.mirageMotionReadable(e)));
  Object.assign(m.shuttle,{x:p.dir*.2,y:2,z:0,vx:p.dir*14,vy:-1,vz:0,crossedNet:true});o.x=o.side*6;m.rePred();m.mirageMotion();assert.ok(f.every(e=>e.feintAt===0&&!Y.mirageMotionReadable(e)));
  for(let i=0;i<18;i++)m.skStep(Y.C.DT);assert.ok(f.every(e=>Y.mirageMotionReadable(e)&&e.pace<.3));
 });
 test(tag+' nearby receiver advances the motion cue and actual contact clears decoys',()=>{
  const{m,p,o}=game(space,seat);outgoing(m,p);select(m,p);Object.assign(m.shuttle,{x:o.x+o.dir*.5,y:3.4,z:o.z||0,crossedNet:true});m.rePred();m.mirageMotion();assert.ok(m.entsOf('fake',seat).every(e=>e.feintAt===0));
  m.touchShuttle(o,'clear','return',null,.8,true);assert.equal(m.entsOf('fake',seat).length,0);
 });
 test(tag+' AI recognizes the observed speed change and replans toward the true ball',()=>{
  const{m,p,o}=game(space,seat);outgoing(m,p);select(m,p);const f=m.entsOf('fake',seat)[0];f.age=.4;f.feintAt=.18;
  const ai=Y.createAI(m,o.idx,'hard','lingfeng');ai.skillWait=99;ai.reactAt=-1;ai.react3D=-1;ai.think3D=0;ai.seen3D=m.hitCount;ai.seenHit=m.hitCount;o.fooled=false;o.replan=false;
  if(space)ai.decoy3D={id:f.id,until:10};else ai.mirrorChase={id:f.id,until:10};m.time=.2;ai.update(Y.C.DT);
  assert.ok(!ai.decoy3D&&!ai.mirrorChase);assert.ok(ai.plan,'replanning does not keep the fake target');
 });
 test(tag+' selected aim and motion phase persist in detached snapshots; paused preparation stays exact',()=>{
  const{m,p}=game(space,seat);select(m,p,-1,space?1:0);m.skStep(.23);const before=copy(p.cnt.mirage.ready.jingxiang);m.phase='point';m.skStep(1);m.resetPoint(false);assert.deepEqual(p.cnt.mirage.ready.jingxiang,before);m.phase='rally';hit(m,p);m.skStep(.46);
  const v={players:[{},{}],shuttle:{}};Y.skUnpack(v,null,copy(Y.skPack(m)),1);assert.deepEqual(v.players[seat].cnt.mirage.ready.jingxiang.aim,before.aim);assert.ok(v.ents.filter(e=>e.k==='fake').every(e=>Y.mirageMotionReadable(e)&&Number.isFinite(e.pace)));assert.deepEqual(copy(v.ents.filter(e=>e.k==='fake').map(e=>e.feintAt)),m.entsOf('fake',seat).map(e=>e.feintAt));
  v.players[seat].cnt.mirage.ready.jingxiang.aim.depth=1;assert.equal(p.cnt.mirage.ready.jingxiang.aim.depth,-1);Y.skUnpack(v,null,0,1);assert.equal(v.ents.length,0);
 });
}
test('2D keyboard directions choose the true shot; drag preview names the selected landing',()=>{
 for(const seat of[0,1])for(const depth of[-1,1]){const{m,p}=game(false,seat);m.inputs[seat].move=depth;assert.ok(m.useSkill(p,0));assert.equal(p.cnt.mirage.ready.jingxiang.aim.depth,depth);const pr=Y.skillPreview(m,p,'jingxiang',Y.skillVector('jingxiang',{x:depth,y:0}));assert.equal(Math.sign(pr.mark.x),p.dir);assert.match(pr.label,depth>0?/深场/:/浅场/);}
});

test('fake motion is independent of render rate and never carries an identity visual',()=>{
 const{m,p}=game(true,0);outgoing(m,p);select(m,p);const source=m.entsOf('fake',0)[0];
 const integrate=dt=>{const e=copy(source);for(let t=0;t<.9-1e-8;t+=dt){e.age+=dt;Y.stepMirage(e,dt,m.env);}return e;};
 const a=integrate(1/120),b=integrate(1/60);assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<.035);
 assert.equal(Y.mirageAppearance,undefined);assert.equal(Y.SkillFX?.mirageCue,undefined);
});
