/* 十六根羽毛 · memory, prediction, string durability and relay match direction. */
(function(G){
 'use strict';const Y=G.YY,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function venue(id,name,scene,floor){Y.VENUES[id]={name,shadow:{skew:-.5,len:1.2,alpha:.25},
  paintFar(g,V){Y.paintStoryArt(g,scene,0,0,V.W,V.H);},
  paintNear(g,V){const y=V.floorTop;g.fillStyle=floor;g.fillRect(0,y,V.W,V.H-y);for(let i=0;i<18;i++){g.strokeStyle='#b4dfff18';g.lineWidth=1;g.beginPath();g.moveTo(i*V.W/17,y);g.lineTo((i-8)*V.W/8+V.W/2,V.H);g.stroke();}
   const pts=[[-6.7,0,-2.59],[6.7,0,-2.59],[6.7,0,2.59],[-6.7,0,2.59],[-6.7,0,-2.59]];g.beginPath();pts.forEach((p,i)=>i?g.lineTo(...V.P(...p)):g.moveTo(...V.P(...p)));g.strokeStyle='#e0f4ffbb';g.lineWidth=2;g.stroke();
   for(const x of [-1.98,1.98]){g.beginPath();g.moveTo(...V.P(x,0,-2.59));g.lineTo(...V.P(x,0,2.59));g.stroke();}g.beginPath();g.moveTo(...V.P(-6.7,0,0));g.lineTo(...V.P(6.7,0,0));g.stroke();
  },init(){return{cheer:0};},drawFar(){},drawNear(){},drawFront(){},event(st,type){if(type==='point')st.cheer=1;}};}
 venue('rivercourt','河堤 · 现实','riverbank','#687c99');venue('homecourt','镇一中老体育馆','oldgym','#956b51');venue('emptycourt','听球机 · 空场','emptyfield','#365a82');venue('memorycourt','回羽场','memory-river','#32577e');venue('leaguecourt','南岸 · 羽场联赛','league','#385d8a');venue('islandcourt','2021 · 江心洲','island-memory','#648a9b');venue('youngcourt','2018 · 老体育馆','younggym','#a17c5b');venue('wintercourt','2022 · 冬天','winter2022','#49698b');venue('historicourt','1996 · 决赛','historic1996','#987253');venue('starcourt','2023 · 操场','memory-stars','#3b578a');
 const n=Y.STORY_NPCS;
 n.academy.fx={control:.09,defense:.05};n.provincial.fx={power:.07,control:.05};
 const noKit=()=>({passive:null,act:[]});
 function ageLook(id,age){const look={...Y.lookOf(id)};if(age&&age<40){look.age=false;look.hairC='#263b34';look.hairHi='#4b5c48';look.whistle=false;look.num=String(age);}if(age&&age<15)look.child=true;return look;}
 class StoryMatch{
  constructor(app,step){
   this.app=app;this.step=step;this.m=app.match;this.t=0;this.hits=0;this.intentIndex=0;this.intent=null;this.durability=100;this.memoryPoints=0;this.snap=false;this.done=false;this.actors=[step.as||'dingding',step.opp];this.relayIndex=0;this.relayPhase=step.relay?'team':null;this.lastSkill=null;this.sealed=[];this.bossTimer=4;this.habit=[];this.walls=0;this.skills=new Set();this.preview=step.prediction!=null?3.4:0;this.broken=false;this.tip=null;this.tipAge=0;this.fear=false;this.counts={};this.pointSkills=new Set();this.skillWins={};this.actorWins={};this.bestLead=0;this.finalSkill=null;this.streak=0;this.maxStreak=0;this.maxTier=0;
   const m=this.m;m.story=this;
   if(step.age)m.looks=step.age.map((age,i)=>ageLook(this.actors[i],age));
   if(step.training){m.players[0].energy=75;this.tip='三个主动技能可轮换练习 · 拖放瞄准，再按收招';this.tipAge=6;}
   if(step.gentle)app.ais[0].storySkillInterval=9999;
   if(step.stable){app.ais[0].L={...app.ais[0].L,err:.1,timing:.018,react:.22,brain:0};}
   if(step.opp==='nan'){app.ais[0].style={...(app.ais[0].style||{}),name:'南振'};m.players[1].energy=70;}
   if(step.opp==='nan'){
    const ai=app.ais[0],update=ai.update.bind(ai);ai.dirtyBait=()=>false;
    ai.update=dt=>{m.players[1].fooled=false;ai.fakeChase=null;if(this.relayPhase==='truth'&&m.shuttle.live&&m.shuttle.lastHitter===0){ai.moveTo(6.0,.05);return;}update(dt);};
   }
   if(step.relay)m.opt.target=7;
   if(step.shoulder||step.relay)this.assist=(Y.Profile.d.campaign.failures[app.story.st.id]||0)>=3;
   if(step.relay&&this.assist)this.say('朱老师：别守习惯区。丢一分换人，五分之后田楚会接下一棒。',7);
   const emit=m.emit.bind(m),physics=m.step.bind(m),press=m.handlePress.bind(m),shot=m.resolveShot.bind(m),land=m.onLand.bind(m);
   m.emit=e=>{emit(e);this.event(e);};
   m.step=dt=>{if(this.done||this.preview>0){this.preview=Math.max(0,this.preview-dt);return;}physics(dt);this.update(dt);};
   m.handlePress=(p,pr)=>{if(p.idx===0&&this.fear&&pr.btn==='smash'){this.tip='别输。扣杀键在这段记忆里锁住了。';this.tipAge=2;return;}if(this.relayPhase==='truth'&&p.idx===0&&['skill','skill2'].includes(pr.btn))return;press(p,pr);};
   m.resolveShot=(p,...args)=>{const out=shot(p,...args);if(step.gentle&&p.idx===1&&!out.attack){const s=m.shuttle,target=clamp(-m.players[0].x-.3,1.7,5.3),v=m.launchFrom(s.x,s.y,p.dir,62,target,1.45);out.vx=v[0];out.vy=v[1];out.type='clear';}return out;};
   m.onLand=x=>{
    const before=[...m.score],server=m.server;land(x);
    if(step.oldScoring&&!step.fear){const e=m.events.filter(e=>e.type==='point').at(-1);if(e&&e.winner!==server){m.score=[...before];m.winner=-1;e.pts=0;}}
   };
   if(step.skills===false){m.players.forEach(p=>{p.kit=noKit();p.passive=null;});m.skillsOn=false;}
  }
  say(text,time=3){this.tip=text;this.tipAge=time;}
  finish(win,extra={}){if(this.done)return;this.done=true;this.m.shuttle.live=false;this.m.shuttle.held=false;if(this.frozen)Object.assign(this.m.shuttle,{x:-.7,y:Y.C.SHUTTLE_R+.045,vx:0,vy:0,speed:0});this.m.phase='idle';this.app.stepDone({win,...extra});}
  switchActor(id,skills=true){
   const m=this.m,p=m.players[0],load=this.app.myLoadout(null,id);this.actors[0]=id;p.st=load.stats;p.kit=skills?load.skill:noKit();p.passive=p.kit.passive;p.energy=75;p.buff={};p.cnt={};p.skillCd=0;p.swing=null;m.looks[0]=load.look;m.opt.names[0]=load.look.name;m.ents=m.ents.filter(e=>e.o!==0);m.sk.half=[Y.C.HALF,Y.C.HALF];m.skillsOn=true;
   this.app.ctrlFor[0]=this.app.soloCtrl(true,skills?load.skill.act:Y.Profile.kit(id));this.app.ui?.layoutControls();this.say('换棒 · '+load.look.name+(skills?'：球落地之前，谁都不知道。':'：这一分，不用骗。'),4);
  }
  event(e){
   if(this.done)return;const m=this.m,s=this.step;
   if(e.type==='hit'){
    this.hits++;
    if(e.p===0){this.counts.real=(this.counts.real||0)+1;if(e.skill){this.counts[e.skill]=(this.counts[e.skill]||0)+1;this.pointSkills.add(e.skill);this.finalSkill=e.skill;}if(e.save||e.lowSave)this.counts.save=(this.counts.save||0)+1;}
    if(s.intents&&e.p===(s.intentSide??0)){this.intent={text:s.intents[Math.min(this.intentIndex++,s.intents.length-1)],p:e.p,t:3.6};if(s.fear)this.fear=/别输|别杀/.test(this.intent.text);Y.Audio.storyAction?.('intent');}
    if(s.durability&&e.p===0){this.durability=Math.max(0,this.durability-({smash:13,halfsmash:8,clear:4,lift:2,drop:.45,net:.2}[e.shot]||1));if(this.durability<=0||m.score[0]===6&&m.score[1]===6){m.score=[6,6];this.snap=true;Y.Audio.storyAction?.('snap');this.finish(true,{memory:true});}}
    if(s.rallyGoal&&m.rally>=s.rallyGoal){this.frozen=!!s.freeze;this.finish(true,{memory:true});}
    if(s.relay&&this.relayPhase==='truth'&&e.p===0){const o=m.players[1];o.x=o.side*6.0;this.app.ais[0].storySkillInterval=9999;this.say('您看见的，是您想看的。',3);}
    if(s.wallBreak&&e.skill==='diban'){this.walls++;if(this.walls>=s.wallBreak)this.say('墙碎了。进来吧。',6);}
   }
   if(e.type==='skill'){
    if(e.p===0){this.lastSkill=e.id;this.skills.add(e.id);this.pointSkills.add(e.id);}
    if(e.p===1&&Y.Profile.stars('3-2')&&Y.SKILLS[e.id]?.tip){this.say(Y.SKILLS[e.id].tip,4.5);}
    if(s.shoulder&&e.p===1&&['jingxiang','meida','shuizhong'].includes(e.id)){this.shoulderAt=3;this.say(this.assist?'朱老师：看松下来的肩膀。':'别看拍子，看肩膀。',3);}
   }
   if(e.type==='whiff'&&e.p===0)this.counts.whiff=(this.counts.whiff||0)+1;
   if(e.type==='fakeHit'&&e.p===0)this.counts.fake=(this.counts.fake||0)+1;
   if(e.type==='skillProc'&&e.p===0)this.counts[e.id]=(this.counts[e.id]||0)+1;
   if(e.type==='point'){
    this.bestLead=Math.max(this.bestLead,m.score[0]-m.score[1]);
    if(e.winner===0){this.streak++;this.maxStreak=Math.max(this.maxStreak,this.streak);this.actorWins[this.actors[0]]=(this.actorWins[this.actors[0]]||0)+1;for(const id of this.pointSkills)this.skillWins[id]=(this.skillWins[id]||0)+1;}else this.streak=0;
    this.pointSkills.clear();
    const p=m.players[0];this.habit.push(Math.abs(p.x));if(this.habit.length>6)this.habit.shift();
    if(s.durability){this.memoryPoints++;m.winner=-1;const points=Math.min(4,this.memoryPoints);m.score=[4+Math.ceil(points/2),4+Math.floor(points/2)];if(points===4)this.say('6 : 6。别断。',4);}
    if(s.fear){this.memoryPoints++;m.winner=-1;m.score=[[14,4],[14,6],[14,9],[14,12],[14,14]][Math.min(this.memoryPoints-1,4)];if(this.memoryPoints>=5)this.finish(true,{memory:true});}
    if(s.gentle&&s.rallyGoal&&!this.done){m.score=[0,0];m.winner=-1;m.pointTimer=1.0;this.say('记忆没有散。再接住一次。',2);}
    if(s.progressScore&&m.score[0]>=s.progressScore&&!this.progressReady){this.progressReady=true;this.say('已经拿到三分。可以继续故事，也可以留下打完这一局。',5);}
    if(s.errorGoal&&m.stats[1].errors>=s.errorGoal){this.say('连续零失误：两年七个月 → 0',4);this.finish(true,{target:true});}
    if(s.relay){
     if(this.relayPhase==='team'){
      if(e.winner===1){const last=s.relay.length-1;this.relayIndex=Math.min(last,this.relayIndex+1);this.switchActor(s.relay[this.relayIndex]);}
      if(m.score[0]>=5){this.relayPhase='truth';m.score=[5,6];m.winner=-1;m.opt.cap=7;m.opt.target=7;this.switchActor('tianchu',false);this.say('5 : 6。田楚：让我打一分。',5);}
     }else if(this.relayPhase==='truth'){
      if(e.winner===0){this.relayPhase='last';m.score=[6,6];m.winner=-1;this.switchActor('dingding');this.say('6 : 6。师兄：最后一分，是你的。',5);}
      else{m.score=[5,6];m.winner=-1;m.pointTimer=1.2;this.say('这一分，不用骗。再打一只直球。',4);}
     }
    }
    if(s.prediction!=null&&e.winner===0&&m.winner===0&&s.prediction<50){this.broken=true;Y.Audio.storyAction?.('prediction');}
   }
  }
  update(dt){
   if(this.done)return;this.t+=dt;this.tipAge=Math.max(0,this.tipAge-dt);if(this.intent)this.intent.t-=dt;this.shoulderAt=Math.max(0,(this.shoulderAt||0)-dt);this.answerT=Math.max(0,(this.answerT||0)-dt);
   const m=this.m,s=this.step;
   this.maxTier=Math.max(this.maxTier,m.players[0].market?.tier||0);
   if(s.timeLimit&&this.t>=s.timeLimit){this.finish(m.score[0]>=m.score[1]);return;}
   if(s.training){const p=m.players[0];if(p.energy<30)p.energy=Math.min(35,p.energy+dt*5);}
   if(s.stable){const b=m.players[1].buff;for(const key of ['prone','tripped','stun','slip','knock'])if(b[key]>0)b[key]=0;m.players[1].vx=clamp(m.players[1].vx,-Y.C.MOVE*1.2,Y.C.MOVE*1.2);}
   for(let i=this.sealed.length-1;i>=0;i--){const v=this.sealed[i];v.t-=dt;if(v.t<=0){if(v.entity.t>0&&m.phase!=='over')m.ents.push(v.entity);this.sealed.splice(i,1);}}
   if(s.opp==='nan')this.boss(dt);
  }
  goals(r){
   const n=k=>this.counts[k]||0,w=k=>this.skillWins[k]||0,has=k=>this.skills.has(k),m=this.m,done=!!r.win;
   const goals={
    '0-3':[['扣杀得分一次',r.st.smashWin>=1],['对手得分不超过四分',m.score[1]<=4]],
    '0-4':[['用装置救回一球',n('shensuo')+n('xuanpai')+n('youyou')>=1],['机械回收返还能量',n('jixie')>=1]],
    '1-2':[['地板开球所在回合得分',w('diban')>=1],['回锅再炒所在回合得分',w('huiguo')>=1]],
    '1-3':[['三连胜播报',this.maxStreak>=3],['小猴拦截一次',n('haomao')>=1]],
    '1-5':[['完美击球五次',r.st.perfect>=5],['没有挥空',n('whiff')===0]],
    '2-2':[['蝴蝶结托起球',n('hudie')>=1],['红丝牵球所在回合得分',w('hongxian')>=1]],
    '2-3':[['反射板回击两次',n('fanshe')>=2],['沿辅助线扣球的回合得分',w('pingyi')>0&&w('zipao')>0]],
    '2-4':[['月亮所在回合得分',w('yueliang')>0],['星门所在回合得分',w('xingmen')>0]],
    '2-5':[['用过两个不同技能',this.skills.size>=2],['亲手赢下比赛',done]],
    '3-2':[['放置标志桶',has('biaozhi')],['读懂并回击技能球',n('kandong')>0]],
    '3-4':[['拿到五分',m.score[0]>=5],['没有被假球骗中',n('fake')===0]],
    '4-2':[['潮来托起一次球',n('chaolai')>0],['回潮所在回合得分',w('huichao')>0]],
    '4-3':[['踩脚印获得能量',n('yihan')>0],['鱼跃所在回合得分',w('yuyue')>0]],
    '4-5':[['打破百分之九的预测',done],['踩脚印三次',n('yihan')>=3]],
    '5-2':[['亲手打中真球三次',n('real')>=3],['没有被脏数据骗中',n('fake')===0]],
    '5-3':[['成功查找替换',n('yati')>0],['预约投影回球两次',n('yueqiu')>=2]],
    '5-4':[['把记忆打满二十拍',m.longest>=20||m.rally>=20],['接住最后一球',done]],
    '6-2':[['押这一分并得分',w('ganggan')>0],['装备达到量子档',this.maxTier>=4]],
    '6-4':[['打破预测',done],['两个主动都用过',this.skills.size>=2]],
    '6-5':[['拿到四分',m.score[0]>=4],['苗苗失误两次',m.stats[1].errors>=2]],
    '7-3':[['用过本段角色的装置',this.skills.size>0],['亲手把记忆打完',done]],
    '7-5':[['八分钟内赢下',done&&this.t<=480],['球击中城墙六次',this.walls>=6]],
    '8-2':[['赢下比赛',done],['借网所在回合得分两次',w('jiewang')>=2]],
    '8-3':[['赢下比赛',done],['让果哥破产一次',m.players[1].market?.coins<=0]],
    '8-4':[['断线前曾领先',this.bestLead>0],['没有使用扣杀',r.st.smash===0]],
    '9-2':[['赢下第一局',done],['未击中镜像假球',n('fake')===0]],
    '9-4':[['没有被假球骗中',n('fake')===0],['最后一分用长拍或悠悠球拍',['shensuo','youyou'].includes(this.finalSkill)]],
    '10-4':[['六位伙伴都得过分',Object.keys(this.actorWins).length>=6],['田楚打出不骗人的一分',this.actorWins.tianchu>0]],
   };
   return (goals[this.app.story.st.id]||[['亲手打完这一段',done],['没有挥空',n('whiff')===0]]).map(([text,ok])=>({text,ok:!!ok}));
  }
  boss(dt){
   // 南振使用自己的取景、复映与快进技能，叙事的最后一拍继续遵循原演出。
   if(this.relayPhase==='truth')this.m.players[1].x=5.7;
  }

 }
 Y.StoryMatch=StoryMatch;
 const draw=Y.Renderer.prototype.draw;
 Y.Renderer.prototype.draw=function(m,o,dt){draw.call(this,m,o,dt);const s=m.story;if(!s)return;const g=this.ctx,W=this.W,H=this.H,d=this.dpr;g.setTransform(d,0,0,d,0,0);g.save();g.textBaseline='middle';
  const text=(value,x,y,size=14,col='#f5f7fc',align='left')=>{g.font=`500 ${size}px "PingFang SC",sans-serif`;g.fillStyle=col;g.textAlign=align;g.fillText(value,x,y);};
  const chip=(value,x,y,w,color='#142749ed')=>{g.fillStyle=color;Y.rr(g,x,y,w,24,3);g.fill();text(value,x+10,y+12,12);};
  const field={memory:'回羽场 · 旧球记忆',league:'南岸羽场联赛',empty:'听球机 · 空场',reality:'现实 · 无技能'}[s.step.field];if(field)chip(field,16,H-31,154);
  if(s.intent&&s.intent.t>0&&s.step.field==='memory'){
   const p=m.players[s.intent.p],sp=this.screenPoint(p.x,p.y+2.65),t=s.intent.text;g.font='500 17px "PingFang SC",sans-serif';const tw=Math.min(W*.66,g.measureText(t).width+32),xx=clamp(sp.x-tw/2,12,W-tw-12),yy=clamp(sp.y-19,85,H*.49);g.fillStyle='#183556ed';Y.rr(g,xx,yy,tw,34,4);g.fill();text(t,xx+tw/2,yy+17,16,'#bceeff','center');
  }
  if(s.step.prediction!=null){const p=s.step.prediction,label=s.broken?'预测被打破':`南岸预测  ${Y.charName(s.actors[0])} ${p}%  /  ${Y.charName(s.step.opp)} ${(100-p).toFixed(p%1?1:0)}%`;chip(label,Math.max(16,W/2-185),Math.min(67,H*.18),Math.min(370,W-32),s.broken?'#64552bee':'#17345be8');}
  if(s.preview>0){g.fillStyle='#0a1733ee';g.fillRect(0,0,W,H);text('南 岸 · 预 测 胜 率',W/2,H*.31,18,'#bed3ef','center');text(s.step.prediction+'%  :  '+(100-s.step.prediction)+'%',W/2,H*.48,Math.min(62,W*.08),'#ffcf4a','center');text(Y.charName(s.actors[0])+'  /  '+Y.charName(s.step.opp),W/2,H*.65,19,'#bed3ef','center');text('球落地之前，谁都不知道。',W/2,H*.78,14,'#9bb4d5','center');}
  if(s.step.durability){const x=W-184,y=91;chip('拍线耐久 '+Math.round(s.durability)+'%',x,y,167);g.fillStyle='#1a352f';g.fillRect(x+10,y+28,147,5);g.fillStyle=s.durability<25?'#cf8a73':'#bbcf9e';g.fillRect(x+10,y+28,147*s.durability/100,5);}
  if(s.shoulderAt>0){const p=m.players[1],pt=this.screenPoint(p.x,p.y+1.7);g.strokeStyle=s.assist?'#cceeb3dd':'#cceeb355';g.lineWidth=s.assist?5:2;g.beginPath();g.arc(pt.x,pt.y,17,3.1,5.2);g.stroke();}
  if(s.answerT>0){const pt=this.screenPoint(s.answerX,0);g.strokeStyle='#e1c99c';g.lineWidth=3;g.beginPath();g.ellipse(pt.x,pt.y,40,9,0,0,Math.PI*2);g.stroke();}
  for(const v of s.sealed){const pt=this.screenPoint(v.entity.x,v.entity.y);g.fillStyle='#b9d5cc33';g.strokeStyle='#c8dfc599';Y.rr(g,pt.x-25,pt.y-38,50,66,13);g.fill();g.stroke();text(v.t.toFixed(1),pt.x,pt.y+7,14,'#dfdfb9','center');}
  if(s.step.relay)chip('接力 '+(s.relayPhase==='truth'?'田楚 · 这一分不用骗':s.relayPhase==='last'?'丁丁 · 最后一分':(s.relayIndex+1)+' / '+s.step.relay.length+' · '+Y.charName(s.actors[0])),16,91,220);
  if(s.fear)chip('别输 · 只能高远或吊球',16,91,191);
  if(s.tipAge>0&&!s.preview){const w=Math.min(W-42,550),x=(W-w)/2,y=H*.265;g.fillStyle='#142b4fe8';Y.rr(g,x,y,w,31,4);g.fill();text(s.tip,W/2,y+16,Math.min(14,W*.018),'#f5f7fc','center');}
  g.restore();
 };
})(typeof GameGlobal!=='undefined'?GameGlobal:typeof window!=='undefined'?window:globalThis);
