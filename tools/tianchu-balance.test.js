'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Y=require('./shared-game');require('../js/skill-guide');
const dt=Y.C.DT;
function arena(space,seat,acts=['meida','shuizhong']){
 const skills=[Y.skillSet('lingfeng'),Y.skillSet('lingfeng')];skills[seat]=Y.skillSet('tianchu',acts);
 const m=Y.createMatch({courtMode:space?'3d':'2d',skills}),p=m.players[seat];m.phase='rally';m.shuttle.live=false;
 for(const q of m.players)Object.assign(q,{x:q.side*3,y:0,z:0,vx:0,vz:0,energy:100,stamina:50});return{m,p};
}
function feed(m,p,extra={}){Object.assign(m.shuttle,{x:p.x+p.dir*.6,y:p.y+Y.C.SHOULDER,z:p.z||0,vx:-p.dir*7,vy:-1,vz:0,speed:7,live:true,held:false,netHit:false,crossedNet:true,lastHitter:1-p.idx,selfToss:-1,tossSkill:null,ctl:null,shot:'drive',isServe:false,...extra});m.rePred();}
function use(m,p,id){p.skillCd=0;return m.useSkill(p,p.kit.act.indexOf(id));}
function runTurn(m,p,lateral=false,steps=6){
 const axis=lateral?'z':'x',velocity=lateral?'vz':'vx',direction=lateral?1:p.dir;
 p[velocity]=direction*4;m.mirageMove(p,.04);
 for(let i=0;i<steps;i++){p[axis]+=direction*.16;m.mirageMove(p,.04);}
 p[velocity]=0;m.mirageMove(p,.04);
}
function hit(m,p,own=false){if(!own)feed(m,p);p.swing={btn:'clear',style:'clear',t:Y.C.SW_SWEET,dur:.45};const rng=Math.random;Math.random=()=>.5;try{m.doHit(p,p.swing,.8,m.reachFor(p));}finally{Math.random=rng;}return m.events.findLast(e=>e.type==='hit'&&e.p===p.idx&&!e.device);}
for(const space of[false,true])for(const seat of[0,1]){
 const tag=(space?'3D':'2D')+' seat '+seat;
 test(tag+' focus needs actual running distance; tiny stops, airborne and forced motion do not farm stacks',()=>{
  const {m,p}=arena(space,seat);for(let i=0;i<10;i++){p.vx=4;m.mirageMove(p,.04);p.vx=0;m.mirageMove(p,2);}assert.equal(p.cnt.mirage.focus,0);
  for(let i=0;i<3;i++){runTurn(m,p,space,2);m.mirageMove(p,2);}assert.equal(p.cnt.mirage.focus,0,'separate tiny runs cannot be added together');
  p.onGround=false;runTurn(m,p,space);assert.equal(p.cnt.mirage.focus,0);p.onGround=true;
  p.buff.knock=.5;runTurn(m,p,space);assert.equal(p.cnt.mirage.focus,0);p.buff.knock=0;
  p.vx=4;m.mirageMove(p,.04);p.x+=2;m.mirageMove(p,.04);p.vx=0;m.mirageMove(p,.04);assert.equal(p.cnt.mirage.focus,0,'teleport does not count');
  runTurn(m,p,space);assert.equal(p.cnt.mirage.focus,1);assert.equal(m.mods(p).move,1.08);assert.equal(m.mods(p).accel,1.15);
 });
 test(tag+' 1.8s internal cooldown and a full stack cap limit movement buffs',()=>{
  const {m,p}=arena(space,seat);runTurn(m,p,space);assert.equal(p.cnt.mirage.focus,1);assert.equal(p.cnt.mirage.turnCd,1.8);
  runTurn(m,p,space);assert.equal(p.cnt.mirage.focus,1);m.mirageMove(p,1.81);runTurn(m,p,space);assert.equal(p.cnt.mirage.focus,2);
  m.skStep(.61);assert.equal(p.cnt.mirage.flow,0);m.mirageMove(p,2);const n=m.entsOf('shadow',seat).length;runTurn(m,p,space);
  assert.equal(p.cnt.mirage.focus,2);assert.equal(p.cnt.mirage.flow,0);assert.equal(m.entsOf('shadow',seat).length,n);assert.equal(m.mods(p).move,1);
 });
 test(tag+' passive quality floors and rewards are reduced while full stacks keep one readable fake',()=>{
  const {m,p}=arena(space,seat);runTurn(m,p,space);p.energy=20;
  feed(m,p);assert.equal(m.skHitQ(p,.2,{}),.84);const e=hit(m,p);assert.equal(e.q,.84);assert.equal(p.energy,25,'three normal energy plus two passive energy');assert.equal(p.cnt.mirage.focus,0);
  p.cnt.mirage.focus=2;p.energy=20;feed(m,p);assert.equal(m.skHitQ(p,.2,{}),.9);hit(m,p);assert.equal(p.energy,28,'five normal plus three passive');assert.equal(m.entsOf('fake',seat).length,1);
  assert.ok(m.entsOf('fake',seat)[0].mirage,'same physical, motion-readable decoy mechanism');
 });
 test(tag+' fake preparation has a real startup, a smaller interception sphere and a single use',()=>{
  const {m,p}=arena(space,seat);feed(m,p);p.energy=22;assert.ok(use(m,p,'meida'));const prep=p.cnt.mirage.ready.meida;
  assert.equal(p.energy,0);assert.equal(prep.t,4.5);assert.equal(prep.warm,.18);assert.equal(m.shuttle.lastHitter,1-seat);assert.equal(m.mirageCatch(),false);
  m.skStep(.17);assert.equal(m.mirageCatch(),false);m.skStep(.02);
  feed(m,p,{x:p.x+p.dir*(.6+1.45)});assert.equal(m.mirageCatch(),false,'old 1.7m coverage no longer intercepts');
  if(space){feed(m,p,{z:1.4});assert.equal(m.mirageCatch(),false,'lateral distance uses the same bound');}
  feed(m,p,{x:p.x+p.dir*(.6+1.2)});assert.equal(m.mirageCatch(),true);assert.equal(m.shuttle.selfToss,seat);assert.equal(p.cnt.mirage.ready.meida,undefined);assert.equal(m.mirageCatch(),false);assert.equal(m.entsOf('fake',seat).length,1);
 });
 test(tag+' fake catch preserves recovery and movement slowdown instead of cancelling a previous stroke',()=>{
  const {m,p}=arena(space,seat);use(m,p,'meida');m.skStep(.2);feed(m,p);
  p.swing={btn:'smash',style:'smash',t:.1,dur:.5,hit:true};p.cooldown=.6;p.slow=.22;p.bufferedShot='smash';p.bufferT=.1;p.shotQueue3D={btn:'clear',until:1};
  assert.ok(m.mirageCatch());assert.equal(p.cooldown,.6);assert.equal(p.slow,.22);assert.equal(p.swing,null);assert.equal(p.bufferedShot,null);assert.equal(p.shotQueue3D,null);
  m.handlePress(p,{btn:'smash'});assert.equal(p.swing,null,'cannot swing through original cooldown');
 });
 test(tag+' fake manual followup cannot cash passive stacks or add free speed/stamina',()=>{
  const {m,p}=arena(space,seat);use(m,p,'meida');m.skStep(.2);feed(m,p);m.mirageCatch();p.cnt.mirage.focus=2;p.energy=20;
  assert.equal(m.mods(p).reach,1.08);assert.equal(m.mods(p).timing,1.1);const c={};assert.equal(m.skHitQ(p,.2,c),.88);assert.equal(c.mirageFocus,0);
  const before=p.stamina,e=hit(m,p,true);assert.equal(e.q,.88);assert.equal(p.energy,25);assert.ok(p.stamina<=before,'normal shot costs only; no four-point refund');assert.equal(p.cnt.mirage.focus,2);assert.equal(p.cnt.mirage.follow,0);assert.equal(m.shuttle.rush,0);assert.equal(m.entsOf('fake',seat).length,0);
  feed(m,p);assert.equal(m.skHitQ(p,.2,{}),.9,'banked passive still applies to the next opposing return');
 });
 test(tag+' paid mirror synergy remains; fake bonuses expire and belong only to its own live ball',()=>{
  const {m,p}=arena(space,seat,['meida','jingxiang']);use(m,p,'meida');use(m,p,'jingxiang');m.skStep(.2);feed(m,p);m.mirageCatch();
  assert.equal(m.skHitQ(p,.2,{}),.9,'paid mirror retains its 90% floor');hit(m,p,true);assert.equal(p.cnt.mirage.ready.jingxiang.n,1);assert.equal(m.entsOf('fake',seat).length,2);
  p.cnt.mirage.follow=1.6;feed(m,p);assert.equal(m.mods(p).reach,1,'next incoming ball cannot borrow expired feint geometry');
  delete p.cnt.mirage.ready.jingxiang;Object.assign(m.shuttle,{selfToss:seat,lastHitter:seat,tossSkill:'meida'});m.skStep(1.61);assert.equal(m.skHitQ(p,.2,{}),.2);assert.equal(m.mods(p).timing,1);
 });
 test(tag+' readiness and cooldown persist without new run credit across point breaks and snapshots',()=>{
  const {m,p}=arena(space,seat);runTurn(m,p,space);use(m,p,'meida');m.skStep(.07);const before=JSON.parse(JSON.stringify(p.cnt.mirage));
  m.phase='point';m.skStep(1);m.resetPoint(false);const st=p.cnt.mirage;assert.equal(st.focus,1);assert.equal(st.turnCd,before.turnCd);assert.equal(st.ready.meida.warm,before.ready.meida.warm);assert.equal(st.ready.meida.t,before.ready.meida.t);assert.equal(st.runPoint,undefined);assert.equal(st.heading,undefined);
  const pack=Y.skPack(m),v={players:[{},{}],shuttle:{}};Y.skUnpack(v,null,pack,1);assert.deepEqual(v.players[seat].cnt.mirage,st);v.players[seat].cnt.mirage.ready.meida.warm=99;assert.notEqual(st.ready.meida.warm,99);assert.notEqual(pack.mirage[seat].ready.meida.warm,99);
 });
 test(tag+' untriggered fake expires and ignoring its real toss still loses the point',()=>{
  const {m,p}=arena(space,seat);use(m,p,'meida');m.skStep(4.51);feed(m,p);assert.equal(m.mirageCatch(),false);
  m.shuttle.live=false;use(m,p,'meida');m.skStep(.2);feed(m,p);assert.ok(m.mirageCatch());for(let i=0;i<480&&m.phase==='rally';i++)m.step(dt);assert.equal(m.score[1-seat],1);
 });
}
test('copy for both courts reflects the balanced passive and feint costs',()=>{
 assert.equal(Y.SKILLS.meida.cost,22);assert.equal(Y.SKILLS.meida.dur,4.5);
 for(const mode of['2d','3d']){assert.match(Y.skillGuide('canying',mode).summary,/0.8米/);assert.match(Y.skillGuide('meida',mode).summary,/1.3米/);assert.match(Y.skillGuide('meida',mode).condition,/0.18秒/);}
});
