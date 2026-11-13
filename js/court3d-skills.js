/* 角色空间适配：局部装置、全场规则、三维受控轨迹及球路技能。 */
(function(G){
  'use strict';const Y=G.YY,P=Y.Match3D.prototype,B=Y.Match.prototype,{clamp,lerp}=Y;
  Y.SKILL3D_NOTES={
    lingfeng:'鱼跃与踏风可横向扑救；风口只作用于覆盖的球道。',canglan:'潮水覆盖己方半场；回潮完整倒放三维球迹。',
    xiaohong:'反射板独立布置球道，出口落点固定；辅助线校准两个方向。',ranran:'穿花双轴抢位，蝶结换折返或弹弓；牵丝可选四向出球。',
    ruibao:'反弹后再按出锅；前推压短、后推打长、横推选球道。肉包真实横向投掷，回锅保留蓄力。',xingxing:'月亮与星门可以横向布置；重力作用于完整三维飞行。',
    dingding:'飞轮有限球道锁球，金窗再按弹射，或带回拍前亲手打。',houzi:'筋斗云追向来球，藤蔓支持横向荡动，小猴巡逻协防。',
    lu:'分身留在真实三维位置；接力连到本体或分身；假球分散落区。',laochen:'两拍批量替换保持所选球道；对方冰区影响双轴抓地，可绕行或跳过。',
    guoge:'红包具有地面范围，可侧移绕开；装备强化同步作用于双轴移动。',tianchu:'镜像分散到左中右三条球路；水中月可横向变线。',
    zhu:'幻象独立沿双轴追球但不跳不杀；本体隐身跑位。请君入瓮过网时选择长短与侧向空当。',bobo:'高台提供持续高点，猎航四向移动、自动调高；骨翼俯冲保留触球时的摇杆方向。',
    miaomiao:'滑步与转体支持四向衔接；燕尾过网后纵向弯落、侧向弯线，两拍可切换。',mage:'接球当拍借力；纸镖穿场、过网展翼滑翔，摇杆保留前后与左右落区。',
    zhuzhu:'回眸滑步留香影，真短假长；藏羽隐去球与落点，险线可选择边线。',sun:'三威胁集不同花式强化下一招；热手有三段步、双次篮板、末 1.3 秒压哨。',dong:'过载影响后两拍，雾线之上隐藏球路；反压支持侧向接球并吸收过载。',
    nan:'慢镜看清三维来球；复映近剪或深剪，保留左右球道；快进沿原轨迹提速。'
  };
  const skStep=P.skStep||B.skStep;
  P.skStep=function(dt){
    const s=this.shuttle,oldFake=new Map();
    for(const e of this.ents){
      if(['fake','dirty'].includes(e.k))oldFake.set(e.id,{...e});
      if(e.k==='spin'){const p=this.players[e.o];e.z=p.z;const angle=e.ph0+e.w*e.age;e.head3D=[p.x+Math.cos(angle)*e.r,p.y+1.3,p.z+Math.sin(angle)*e.r];if(!e.used&&this.devHit(p)&&s.crossedNet&&Math.hypot(s.x-p.x,s.z-p.z,s.y-p.y-1.3)<e.r+.18){e.used=1;this.deviceReturn(p,s.y>2.1?'smash':'clear',.86,'xuanpai',null,true);this.proc(p,'xuanpai','环扫接回');}}
      if(['guide','replace'].includes(e.k))e.z=this.players[e.k==='replace'?1-e.o:e.o].z;
      if(['ripple','rewind'].includes(e.k))e.z=s.z;
      if(e.k==='newskill'&&e.sid!=='jibei')e.z=this.players[e.o].z;
    }
    skStep.call(this,dt);
    if(s.path?.length){const q=s.path[s.path.length-1];if(q.length===4)q.push(s.z,s.vz);}
    for(const e of this.ents){
      const old=oldFake.get(e.id);
      if(old&&(this.phase==='rally'||!Y.skillPersistent(e))&&e.n===old.n&&e.hitBy===old.hitBy&&e.y>0.15){
        const ball={...old,z:old.z||0,vz:old.vz||0,space3D:true,netHit:true};Y.stepShuttle(ball,dt,this.env);
        Object.assign(e,{x:ball.x,y:ball.y,z:ball.z,vx:ball.vx,vy:ball.vy,vz:ball.vz});
      }
      if(e.k==='mini'&&this.phase==='rally')e.z=clamp((e.homeZ??(e.homeZ=e.z||0))+Math.sin(e.ph||0)*.65,-2.35,2.35);
    }
  };
  const update=P.updatePlayer;
  P.updatePlayer=function(p,dt){
    const from={x:p.x,y:p.y,z:p.z||0};update.call(this,p,dt);
    this.newcomerMove(p,dt,from);
    this.ribbonMove(p,dt);
    if(p.cnt.vine&&this.phase==='rally'){const v=p.cnt.vine;v.z0??=p.z;v.lateralV=(v.lateralV||0)+((this.inputs[p.idx].strafe||0)*9-(p.z-v.z0)*7-(v.lateralV||0)*.8)*dt;p.z=clamp(p.z+v.lateralV*dt,-2.8,2.8);p.vz=v.lateralV;}
  };
  const add=P.addEnt;
  P.addEnt=function(k,o,x,y,t,extra){
    const e=add.call(this,k,o,x,y,t,extra),p=this.players[o],s=this.shuttle;
    if(k==='board'){e.targetZ=this.shotTarget(p,'clear').z;e.z=clamp(e.z,-2.5,2.5);}
    if(k==='pool')e.z=0;
    if(k==='clone'&&!Number.isFinite(extra?.z)){const d=Y.courtDirection(this.inputs[o]);e.z=clamp(p.z+(Math.abs(d.strafe)>.12?d.strafe*1.8:(p.z>0?-1:1)*1.7),-2.35,2.35);}
    if(['pole','yoyo'].includes(k)){const d=Y.courtDirection(this.inputs[o]),neutral=Math.hypot(d.move,d.strafe)<.12;let vx=neutral?(s.live?s.x-p.x:p.dir):d.move*p.dir,vz=neutral?(s.live?s.z-p.z:0):d.strafe;const n=Math.hypot(vx,vz)||1;e.dir3D={x:vx/n,z:vz/n};e.z=p.z;e.az=p.z;if(neutral&&s.live)e.a=Math.atan2(s.y-p.y-1.35,Math.max(.3,Math.hypot(s.x-p.x,s.z-p.z)));else e.a=.20;if(k==='yoyo')e.dy=neutral&&s.live?clamp((s.y-p.y-1.5)/Math.max(1,Math.hypot(s.x-p.x,s.z-p.z)),-.4,.7):.12;}
    if(k==='ribbon'){
      const d=Y.courtDirection(this.inputs[o]),neutral=Math.hypot(d.move,d.strafe)<.12;
      const dx=neutral?s.x-p.x-p.dir*.3:d.move*p.dir*3,dy=neutral?s.y-p.y-1.45:.45,dz=neutral?(s.z||0)-p.z:d.strafe*3,n=Math.hypot(dx,dy,dz)||1;
      e.ray3D={x:dx/n,y:dy/n,z:dz/n};e.z=p.z;e.oz=p.z;
    }
    if(['fake','dirty'].includes(k)){
      const lane=(this.ents.filter(q=>q.k===k&&q.o===o).length%2?1:-1)*2.05;
      e.z=k==='fake'?s.z:p.z;e.space3D=true;
      const type=e.kind||'clear',depth=clamp(Math.abs(e.lx||4.5),1.1,6.2);
      Object.assign(e,Y.solveShot3D(e,{x:p.dir*depth,z:lane},type,1,this.env));
      const pred=Y.simulate3D(e,this.env,false);e.lx=pred.landX;e.lz=pred.landZ;
    }
    return e;
  };
  P.poolBounce=function(x){if(Math.abs(this.shuttle.z)>2.59+Y.C.LINE_TOL)return false;const result=B.poolBounce.call(this,x);if(result)this.shuttle.vz*=.3;return result;};
  P.lineShot=function(p,shot){
    const e=this.entOf('guide',p.idx);if(!e||!shot.type)return false;
    const path=Y.simulate3D({...this.shuttle,...shot,netHit:false},this.physEnv(),false);
    const safe=!path.netHit&&path.landX*p.dir>.35&&Math.abs(path.landX)<this.halfOf(1-p.idx)-.2&&Math.abs(path.landZ)<2.45;
    if(!safe){const target=this.shotTarget(p,shot.type);Object.assign(shot,Y.solveShot3D(this.shuttle,{x:p.dir*target.x,z:clamp(target.z,-2.35,2.35)},shot.type,1,this.physEnv()));shot.reason=null;}
    if(--e.n<=0)this.dropEnt(e);this.addEnt('lineFlash',p.idx,this.shuttle.x,this.shuttle.y,.45,{corrected:!safe});return true;
  };
  P.boardBounce=function(e,p){
    const s=this.shuttle;s.z=e.z;
    const result=B.boardBounce.call(this,e,p);
    const used=s.prism?.used||[],next=this.entsOf('board',p.idx).find(b=>b!==e&&!used.includes(b.id)&&b.n>0&&b.age>=(b.warm??.45));
    if(next){const dx=next.x-s.x,dy=next.y-s.y,dz=next.z-s.z,d=Math.hypot(dx,dy,dz)||1;s.vx=dx/d*11;s.vy=dy/d*11+Y.C.G*d/22;s.vz=dz/d*11;}
    else Object.assign(s,Y.solveShot3D(s,{x:p.dir*(e.target??4.2),z:e.targetZ??0},'lift',1,this.physEnv()));
    this.rePred();return result;
  };
  const shuttle=P.skShuttle;
  P.skShuttle=function(previous,r){
    const before=this.shuttle.ctl,result=shuttle.call(this,previous,r),s=this.shuttle,c=s.ctl;
    if(c&&c!==before&&c.k==='warp'){
      const gate=this.ents.find(e=>e.k==='gate'&&e.o===c.o&&e.pair===1),p=this.players[c.o];
      if(gate){s.z=gate.z;c.z=gate.z;const target=this.shotTarget(p,'drop');const vel=Y.solveShot3D(s,{x:p.dir*target.x,z:target.z},'drop',1,this.physEnv());Object.assign(c,vel);}
    }
    if(c&&c!==before&&c.k==='freeze')c.vz=s.vz;
    return result;
  };
  P.unfreeze=function(label){const c=this.shuttle.ctl,vz=c?.vz||0;const result=B.unfreeze.call(this,label);this.shuttle.vz=vz;this.rePred();return result;};
  P.releaseRewind=function(){const c=this.shuttle.ctl,q=c.path[clamp(c.i,0,c.path.length-1)];if(q?.[4]!=null)this.shuttle.z=q[4];B.releaseRewind.call(this);this.shuttle.vz=-(q?.[5]||0)*.12;this.rePred();};
  P.wobble=function(o,aim){
    const s=this.shuttle,p=this.players[o],before=s.ver,result=B.wobble.call(this,o,aim);
    if(s.ver!==before){const target=this.shotTarget(p,s.shot||'drop');Object.assign(s,Y.solveShot3D(s,{x:p.dir*target.x,z:target.z},s.y>2.5?'drop':'drive',1,this.physEnv()));this.rePred();}return result;
  };
  P.skShot=function(p,shot,ctx){
    const vx=shot.vx,vz=shot.vz||0;
    B.skShot.call(this,p,shot,ctx);
    if(!ctx.boboDive&&!ctx.newcomerSolved&&Math.abs(vx)>.01)shot.vz=vz*(shot.vx/vx);

  };
  P.poleHead=function(p,e){
    if(!e.dir3D)return B.poleHead.call(this,p,e);
    e.px=e.x;e.py=e.y;e.pz=e.z;
    const reach=.25+e.L*Math.cos(e.a);
    e.x=p.side*clamp(p.side*(p.x+e.dir3D.x*reach),.18,this.halfOf(p.idx)+.45);
    e.z=clamp(p.z+e.dir3D.z*reach,-3.2,3.2);e.y=Math.max(.25,p.y+1.35+e.L*Math.sin(e.a));
  };
  P.yoyoHead=function(p,e){
    if(!e.dir3D)return B.yoyoHead.call(this,p,e);
    e.px=e.x;e.py=e.y;e.pz=e.z;
    e.x=p.side*clamp(p.side*((e.ax??p.x)+e.dir3D.x*e.d),.25,this.halfOf(p.idx)+.6);
    e.z=clamp((e.az??p.z)+e.dir3D.z*e.d,-3.2,3.2);
    e.y=Math.max(.25,(e.ay??p.y+1.5)+(e.dy||0)*e.d);
  };
  P.ribbonHead=function(p,e){
    if(!e.ray3D)return B.ribbonHead.call(this,p,e);
    e.px=e.x;e.py=e.y;e.pz=e.z;e.ox=p.x+p.dir*.3;e.oy=p.y+1.45;e.oz=p.z;
    let L=e.L;const d=e.ray3D;if(d.x*p.dir>0)L=Math.min(L,Math.max(0,(p.side*.12-e.ox)/d.x));
    e.x=e.ox+d.x*L;e.y=Math.max(.15,e.oy+d.y*L);e.z=clamp(e.oz+d.z*L,-3.2,3.2);
  };
  P.ribbonContact=function(e){
    const s=this.shuttle,dx=e.x-e.ox,dy=e.y-e.oy,dz=e.z-e.oz,n=dx*dx+dy*dy+dz*dz||1;
    const u=clamp(((s.x-e.ox)*dx+(s.y-e.oy)*dy+(s.z-e.oz)*dz)/n,0,1);
    return Math.hypot(s.x-e.ox-u*dx,s.y-e.oy-u*dy,s.z-e.oz-u*dz)<.45;
  };
  P.ribbonStep=function(e,p,dt){
    B.ribbonStep.call(this,e,p,dt);const s=this.shuttle;
    if(e.ph===1&&s.ctl?.k==='tether'&&s.ctl.o===p.idx){e.z=s.z;e.oz=p.z;const dx=e.x-e.ox,dy=e.y-e.oy,dz=e.z-e.oz,n=Math.hypot(dx,dy,dz)||1;e.ray3D={x:dx/n,y:dy/n,z:dz/n};e.L=n;}
  };
  P.diveCatch=function(p){if(Math.abs(this.shuttle.z-p.z)>.85)return;return B.diveCatch.call(this,p);};
  P.startRecall=function(p,ref,e){B.startRecall.call(this,p,ref,e);if(p.cnt.recall&&e?.dir3D)p.cnt.recall.dir3D={...e.dir3D};};
  P.skPlayer=function(p,dt){
    B.skPlayer.call(this,p,dt);const r=p.cnt.recall;
    if(r?.dir3D&&!r.done&&r.t>0){const d=Y.courtDirection(this.inputs[p.idx]),dot=d.move*p.dir*r.dir3D.x+d.strafe*r.dir3D.z;
      if(dot<-.3){const e=this.ents.find(e=>e.id===r.e);if(e&&e.ph===2){r.done=1;this.gainEnergy(p,6);this.dropEnt(e);p.buff[e.k==='pole'?'shensuo':'youyou']=0;p.buff.shoushi=0;this.proc(p,'jixie','反向回收 +6');}}}
  };
})(typeof GameGlobal!=='undefined'?GameGlobal:typeof window!=='undefined'?window:globalThis);
