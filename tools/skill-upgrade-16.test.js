'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const YY=require('../js/core');require('../js/roster');require('../js/match');require('../js/ai');
const C=YY.C;
function game(id,acts){const m=new YY.Match({skills:[YY.skillSet(id,acts),YY.skillSet('lingfeng')]});m.phase='rally';m.players.forEach(p=>{p.energy=100;p.x=p.side*3;});return m;}
function cast(m,id,aim){const p=m.players[0];p.skillCd=0;return m.useSkill(p,p.kit.act.indexOf(id),{aim});}
function ball(m,o=1){Object.assign(m.shuttle,{x:-2,y:2,vx:-8,vy:1,live:true,held:false,netHit:false,crossedNet:true,lastHitter:o,shot:'drive',ctl:null});m.rePred();}

test('gravity accepts its displayed cost, automatically settles and cannot immediately reopen',()=>{
 const m=game('xingxing',['zhongli','yueliang']),p=m.players[0];ball(m);p.energy=10;
 assert.ok(cast(m,'zhongli'));assert.equal(p.energy,0);m.skPlayer(p,C.DT);assert.equal(p.buff.gravOn,0);
 p.energy=100;assert.equal(cast(m,'zhongli'),false);p.buff.gravRest=0;assert.ok(cast(m,'zhongli'));
 m.shuttle.live=false;for(let i=0;i<182;i++)m.step(C.DT);assert.equal(p.buff.gravOn,0);assert.ok(p.buff.gravRest>0);
});
test('spin can sweep, recall without spare energy and refund only once',()=>{
 const m=game('dingding',['xuanpai','youyou']),p=m.players[0];ball(m);assert.ok(cast(m,'xuanpai'));
 const e=m.entOf('spin',0);p.energy=0;assert.ok(cast(m,'xuanpai',{x:1,y:0}));assert.ok(e.swept);
 e.used=1;assert.ok(cast(m,'xuanpai'));assert.equal(p.energy,6);assert.equal(m.entOf('spin',0),undefined);
 assert.equal(cast(m,'xuanpai'),false);assert.equal(p.energy,6);
});
test('second-stage input survives the final 100 ms of shared cooldown',()=>{
 const m=game('dingding',['xuanpai','shensuo']),p=m.players[0];cast(m,'xuanpai');p.energy=0;p.skillCd=.06;
 assert.ok(m.useSkill(p,0,{aim:{x:1,y:0}}));assert.ok(!m.entOf('spin',0).swept);
 for(let i=0;i<10;i++)m.step(C.DT);assert.ok(m.entOf('spin',0).swept);assert.equal(p.energy,0);
});
test('pool has two saves across different returns; same ball cannot bounce twice',()=>{
 const m=game('canglan',['chaolai','huichao']);cast(m,'chaolai');ball(m);
 assert.ok(m.poolBounce(-2));assert.equal(m.poolBounce(-2),false);
 m.shuttle.puddle=0;assert.ok(m.poolBounce(-3));m.shuttle.puddle=0;assert.equal(m.poolBounce(-2),false);
 assert.equal(m.entOf('pool',0).n,0);
});
test('calibration rewards personal skill and is spent only on a manual reflector',()=>{
 const m=game('xiaohong',['fanshe','zipao']),p=m.players[0];ball(m);
 m.afterHit(p,{type:'clear'},.9,{device:true});assert.ok(!p.cnt.calibrate);
 ball(m);m.afterHit(p,{type:'clear'},.9,{});assert.equal(p.cnt.calibrate,1);
 cast(m,'fanshe');assert.equal(m.entsOf('board',0)[0].n,1);assert.equal(p.cnt.calibrate,1);
 cast(m,'fanshe',{x:.5,y:.6});assert.equal(m.entsOf('board',0)[1].n,2);assert.equal(p.cnt.calibrate,0);
});
test('night sky extra energy is six per two returns and capped per point',()=>{
 const m=game('xingxing'),p=m.players[0];p.energy=0;
 for(let i=0;i<8;i++){ball(m);m.afterHit(p,{type:'clear'},.7,{});}
 assert.equal(p.energy,8*3+18);m.resetPoint(false);assert.ok(!p.cnt.starGain);
});
test('debug needs successful variety; the compile mark lengthens the clone or raises the relayed shot',()=>{
 const m=game('lu',['fuzhi','jieli']),p=m.players[0];ball(m);m.afterHit(p,{type:'clear'},.8,{});
 ball(m);m.shuttle.shot='drop';m.afterHit(p,{type:'clear'},.8,{});assert.equal(p.cnt.compile,1);
 assert.ok(cast(m,'fuzhi'));assert.equal(m.entOf('clone',0).t,11);assert.ok(!p.cnt.compile,'the mark is spent');
 p.cnt.compile=1;ball(m);Object.assign(m.shuttle,{x:p.x+p.dir*.9,y:C.SHOULDER+.3,vx:-2,vy:0});m.entOf('clone',0).x=p.x+p.dir*2;
 assert.ok(cast(m,'jieli',{x:0,y:1}));assert.equal(m.shuttle.ctl.q,.9);
});
test('wind changes one nearby trajectory and remains available for movement',()=>{
 const m=game('lingfeng',['fengkou','tafeng']),p=m.players[0];cast(m,'fengkou',{x:.5,y:0});const e=m.entOf('wind',0);
 ball(m);Object.assign(m.shuttle,{x:e.x+.1,y:e.y,vx:8,vy:0});m.skShuttle({x:e.x-.1,y:e.y,vx:8,vy:0});assert.equal(e.used,1);const vx=m.shuttle.vx;
 m.skShuttle({x:e.x-.1,y:e.y,vx});assert.equal(m.shuttle.vx,vx);p.x=e.x;m.skPlayer(p,C.DT);assert.ok(m.mods(p).move>1);
});
test('teacher control preparation rewards manual variety and the echo preserves chosen manual shot families',()=>{
 const m=game('zhu',['jiezou','tingyixia']),p=m.players[0];
 for(const type of ['clear','drop','clear']){ball(m);m.afterHit(p,{type},.8,{});m.shuttle.crossedNet=true;m.teacherCommit();}
 assert.equal(p.cnt.teacher.layers,2);ball(m);p.swing={btn:'drop'};const ctx={};assert.equal(m.skHitQ(p,.5,ctx),.94);
 const shot={type:'drop',vx:6,vy:8};m.skShot(p,shot,ctx);assert.equal(p.cnt.teacher.layers,0);assert.equal(shot.vx,6);
 p.swing=null;cast(m,'jiezou');assert.ok(m.entOf('teacherEcho',0));assert.equal(p.buff.teacherHide,6);assert.equal(p.cnt.combo,undefined);
});
test('ice telegraphs its floor activation, and rewrites require confirmed opposing manual contact',()=>{
 const m=game('laochen',['shuangji','yati']),p=m.players[0],o=m.players[1];ball(m);cast(m,'shuangji');const e=m.entOf('pane',0);o.x=e.x;
 assert.equal(m.iceAt(o),null);e.age=.36;assert.equal(m.iceAt(o),e);assert.equal(m.shuttle.ctl,null);cast(m,'yati');const rep=m.entOf('replace',0);
 Object.assign(m.shuttle,{x:o.x+o.dir*.5,y:2.3,lastHitter:0,crossedNet:true,selfToss:-1});const shot={type:'smash',vx:-15,vy:-3};assert.equal(m.replaceShot(o,shot,{}),false,'mark has an activation delay');
 rep.age=.2;assert.equal(m.replaceShot(o,shot,{device:true}),false);assert.equal(rep.n,2);assert.ok(m.replaceShot(o,shot,{}));assert.equal(shot.type,'lift');assert.equal(rep.n,1);
});
test('bun cannot accelerate an enemy shot; legal release stays in court without a hidden time boost',()=>{
 const m=game('ruibao',['baozi','huiguo']),p=m.players[0];ball(m);m.shuttle.bun={o:0,st:20,t:5};assert.equal(m.bunRelease(p),false);
 Object.assign(m.shuttle,{x:1,y:3,vx:5,vy:-2,lastHitter:0});assert.ok(m.bunRelease(p));
 const s=m.shuttle,r=YY.simulate(s.x,s.y,s.vx,s.vy,6,false,false,m.physEnv());assert.ok(r.landX>.6&&r.landX<6.4);assert.equal(s.rush,0);
});
test('market downgrade hysteresis and reward ceiling keep equipment and economy consistent',()=>{
 const m=game('guoge',['ganggan','qiquan']),p=m.players[0];m.marketGain(p,120);assert.equal(p.market.tier,3);
 m.marketGain(p,-50);assert.equal(p.market.tier,3);assert.equal(m.mods(p).move,YY.MARKET_TIERS[3].move);
 m.marketGain(p,-40);assert.equal(p.market.tier,2);
 p.market.bet={stake:100,odds:3};m.shuttle.gold={o:0};const before=p.market.coins;m.skPointEnd(3,0,1,'winner');assert.equal(p.market.coins-before,450);
 assert.ok(YY.MARKET_DEBT.power<YY.MARKET_TIERS[0].power);assert.ok(YY.MARKET_TIERS[6].power<=1.3);
});
test('AI can place an affordable bet before serving',()=>{
 const m=game('guoge',['ganggan','qiquan']),p=m.players[0];m.phase='serve';const ai=new YY.AI(m,0,'hard','guoge');
 const rng=Math.random;try{Math.random=()=>0;ai.thinkPre();}finally{Math.random=rng;}
 assert.ok(m.inputs[0].presses.some(x=>x.btn==='skill'));m.step(C.DT);assert.equal(p.market.bet?.odds,3);
});
test('new passive indicators, cooldown and freeze warning survive network packing',()=>{
 const m=game('xiaohong'),p=m.players[0];p.cnt.calibrate=1;p.skillCd=.2;m.shuttle.ctl={k:'freeze',o:0,t:.16,e:99,thaw:1};
 const v=game('xiaohong'),k=YY.skPack(m);YY.skUnpack(v,k,k,1);
 assert.equal(v.players[0].cnt.calibrate,1);assert.equal(v.players[0].skillCd,.2);assert.equal(v.shuttle.ctl.thaw,1);assert.equal(v.shuttle.ctl.e,99);
});
