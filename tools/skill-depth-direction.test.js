'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const Y=require('./shared-game');
function arena(id,space,seat){const owner=Y.CHARS.find(c=>c.acts.includes(id)),skills=[Y.skillSet('lingfeng'),Y.skillSet('lingfeng')];skills[seat]=Y.skillSet(owner.id,[id]);const m=new(space?Y.Match3D:Y.Match)({skills}),p=m.players[seat];m.phase='rally';m.shuttle.live=false;for(const q of m.players)Object.assign(q,{x:q.side*3,z:0,energy:100,stamina:100});return{m,p};}
function use(m,p,dir){p.skillCd=0;m.inputs[p.idx].move=dir;m.inputs[p.idx].strafe=0;return m.useSkill(p,0,{aim:{x:dir,y:0}});}
function incoming(m,p){Object.assign(m.shuttle,{x:p.x+p.dir*.5,y:2.2,z:0,vx:-p.dir*10,vy:-1,vz:0,speed:10,live:true,held:false,lastHitter:1-p.idx,crossedNet:true,netHit:false,ctl:null,selfToss:-1,shot:'drive'});}
function hit(m,p){incoming(m,p);const sw=p.swing={btn:'clear',style:'clear',t:Y.C.SW_SWEET,dur:.45};m.doHit(p,sw,.05,m.reachFor(p));p.swing=null;}
function depth(m,p){return m.pred.landX*p.dir;}
for(const space of[false,true])for(const seat of[0,1]){
 const tag=(space?'3D':'2D')+' '+seat;
 test(tag+' all prepared depth choices accept horizontal forward=deep and backward=shallow',()=>{
  for(const id of['jingxiang','bianpai','yipai','jiewang','yati','xingmen','luokuan','huanzuo','biaozhi'])for(const dir of[-1,1]){
   const{m,p}=arena(id,space,seat);if(id==='jiewang')m.addEnt('bow',seat,0,Y.C.NET_H,99);
   assert.ok(use(m,p,dir),id);
   if(id==='jingxiang')assert.equal(p.cnt.mirage.ready[id].aim.depth,dir);
   if(['bianpai','yipai'].includes(id))assert.equal(m.newcomerEnt(p,id).mode,dir,id);
   if(id==='jiewang')assert.equal(p.cnt.ribbon.deep,dir>0);
   if(id==='yati')assert.equal(m.entOf('replace',seat).mode,dir>0?0:1);
   if(id==='xingmen'){hit(m,p);assert.ok(dir>0?Math.abs(m.entsOf('gate',seat).find(e=>e.pair===1).x)>5:Math.abs(m.entsOf('gate',seat).find(e=>e.pair===1).x)<1);}
   if(id==='luokuan')assert.equal(m.clubReady(p,id).mode,dir>0?'line':'net');
   if(id==='huanzuo')assert.equal(p.cnt.school.seat.to*m.players[1-seat].side,dir>0?5.25:1.35);
   if(id==='biaozhi')assert.equal(m.entOf('cone',seat).x*m.players[1-seat].side,dir>0?4:2);
  }
 });
 test(tag+' ribbon and flywheel releases genuinely land deeper on a forward drag',()=>{
  for(const id of['hongxian','youyou']){
   const lands=[];
   for(const dir of[-1,1]){const{m,p}=arena(id,space,seat);incoming(m,p);m.inputs[seat].move=dir;const v=Y.skillVector(id,{x:dir,y:0});
    if(id==='hongxian'){m.shuttle.ctl={k:'tether',o:seat,t:1};m.ribbonFling(p,v);}
    else{const e=m.addEnt('yoyo',seat,m.shuttle.x,m.shuttle.y,3,{z:0,ph:3,clockwork:1,catchAt:0,dx:p.dir});m.time=.2;m.shuttle.ctl={k:'yoyo',o:seat,e:e.id,t:1};m.yoyoSling(p,e,v);}
    assert.ok(!m.pred.netHit);lands.push(depth(m,p));
   }assert.ok(lands[1]>lands[0]+3,id+' '+JSON.stringify(lands));
  }
 });
 test(tag+' cooking choices and preview agree, including keyboard numeric inputs',()=>{
  for(const id of['diban','baozi'])for(const dir of[-1,1]){const{m,p}=arena(id,space,seat);incoming(m,p);m.inputs[seat].move=dir;const v=Y.skillVector(id,{x:dir,y:0});assert.equal(m.cookTarget(p,v).deep,dir>0);}
 });
 test(tag+' selected replay and swallow depth affect actual flight while keeping the lane',()=>{
  for(const id of['bianpai','yipai']){const result=[];for(const dir of[-1,1]){const{m,p}=arena(id,space,seat);use(m,p,dir);m.inputs[seat].move=0;m.inputs[seat].strafe=space?.3:0;hit(m,p);result.push(depth(m,p));assert.ok(!m.pred.netHit);}assert.ok(result[1]>result[0]+.3,id+' '+result);}
 });
}
