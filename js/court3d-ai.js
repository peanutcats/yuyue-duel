/* 纵深对战 AI：同速双轴步法、可达击球点、空当选择；沿用角色技能决策。 */
(function(G){
  'use strict'; const Y=G.YY,C=Y.C,{clamp}=Y;
  class AI3D extends Y.AI {
    constructor(m,i,level,char){super(m,i,level,char);this.level3D=Y.AI_LEVELS[level]||Y.AI_LEVELS.normal;this.seen3D=-1;this.think3D=0;}
    update(dt){
      const m=this.m,p=m.players[this.i],s=m.shuttle,inp=m.inputs[this.i],lv=this.level3D;
      inp.move=0;inp.strafe=0;
      if(m.phase==='point'||m.phase==='over')return;
      if(m.phase==='serve'){
        if(m.server===this.i&&!m.serving&&m.serveT>.8){
          if(m.skillsOn)this.thinkPre();
          if(Math.abs(m.serveMeter()-.5)<.11||m.serveT>2){const long=Math.random()<lv.longServe;inp.move=long?.5:-.5;inp.presses.push({btn:long?'clear':'drop'});}
        }return;
      }
      if(this.clubBlind())return;
      const incoming=s.live&&(s.lastHitter!==this.i||s.selfToss===this.i);
      if(this.seen3D!==m.hitCount||p.replan){this.seen3D=m.hitCount;this.react3D=m.time+lv.react;this.plan=null;this.fired3D=false;this.stroke3D=null;p.replan=false;}
      if(incoming&&m.time>this.react3D&&m.time>=this.think3D){
        this.think3D=m.time+.11;
        if(p.fooled&&!this.decoy3D){p.fooled=false;const f=m.ents.find(e=>['fake','dirty'].includes(e.k)&&e.o!==this.i);if(f&&Math.random()>lv.read)this.decoy3D={id:f.id,until:m.time+.7-lv.read*.4};}
        const fake=this.decoy3D&&this.decoy3D.until>m.time?m.ents.find(e=>e.id===this.decoy3D.id):null;if(!fake)this.decoy3D=null;
        const pred=fake?{...Y.simulate3D({...fake,space3D:true},m.physEnv()),t0:m.time}:m.pred?.pts?m.pred:Y.simulate3D(s,m.physEnv());
        const elapsed=m.time-(pred.t0??m.time), speed=m.maxSpeed(p), error=lv.err*.23;
        let choice=null;
        for(const pt of pred.pts||[]){
          const time=m.realT(Math.max(0,pt.t-elapsed));
          if(time<.07||p.side*pt.x<.5||pt.y<.65||pt.y>3.45)continue;
          const sx=pt.x-p.dir*.48,sz=pt.z;
          if(Math.abs(sz)>3.0||Math.abs(sx)>C.X_FAR)continue;
          const travel=Math.hypot(sx-p.x,sz-p.z)/Math.max(1,speed)+.08;
          const jump=pt.y>2.55;
          if(travel>time+.06||(jump&&time<.3))continue;
          choice={standX:sx,standZ:sz+Y.gauss()*error,tContact:m.time+time,y:pt.y,band:jump?'smash':pt.y>1.5?'over':'low',jumpAt:jump?m.time+time-.34:null};break;
        }
        if(choice){this.plan=choice;}
        else if(!this.plan)this.plan={standX:p.side*clamp(Math.abs(pred.landX),.6,6.8),standZ:clamp(pred.landZ??0,-2.8,2.8),tContact:m.time+.3,band:'none'};
      }
      if(incoming&&this.plan&&m.time>this.react3D){
        this.moveTo3D(this.plan.standX,this.plan.standZ,1);
        const t=this.plan.tContact-m.time;
        if(this.plan.jumpAt&&m.time>=this.plan.jumpAt&&p.onGround&&p.stamina>22){inp.presses.push({btn:'jump'});this.plan.jumpAt=null;}
        if(!this.fired3D&&t<=.11+lv.timing&&t>-.18&&this.plan.band!=='none'){
          const o=this.opponent(),depth=Math.abs(o.x),cross=clamp(-Math.sign(o.z||p.z||1)*(1.8+Math.random()*.5),-2.35,2.35);
          let btn=depth>3.7?'drop':'clear';
          if((!p.onGround||s.y>2.25)&&Math.random()<lv.smash)btn='smash';
          if(Math.random()>lv.tactical)btn=Y.pick({clear:5,drop:3,smash:2});
          this.stroke3D={move:btn==='smash'?(depth<3.3?.7:-.7):btn==='drop'?-.35:.3,strafe:clamp((cross-s.z)/4.1,-1,1),until:m.time+.44};
          inp.presses.push({btn});this.fired3D=true;
        }
        if(this.fired3D&&!p.swing&&!p.shotQueue3D&&s.live&&s.lastHitter!==this.i&&m.ringError(p,s)<m.reachFor(p)&&Math.random()<.35)inp.presses.push({btn:'clear'});
      }else if(!incoming&&m.time>(this.react3D||0)+lv.recDelay){
        this.moveTo3D(p.side*3.35,clamp((s.z||0)*.22,-.65,.65),lv.recover);
      }
      if(incoming&&this.stroke3D?.until>m.time&&m.ringError(p,s)<m.reachFor(p)+.35){inp.move=this.stroke3D.move;inp.strafe=this.stroke3D.strafe;}
      if(m.skillsOn&&p.kit)this.thinkSkill(incoming);
    }
    moveTo3D(x,z,amount){const p=this.m.players[this.i],inp=this.m.inputs[this.i];const cone=this.m.ents.find(e=>e.k==='cone'&&e.o!==this.i&&Math.abs(e.x-p.x)<.8&&Math.abs(e.z-p.z)<.6&&(e.x-p.x)*(x-p.x)>0);if(cone&&p.onGround)z=clamp(cone.z+(p.z>cone.z?1:-1)*.9,-2.8,2.8);const dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz);if(d<.1)return;const k=clamp(d/.48,0,1)*amount;inp.move=dx/d*p.dir*k;inp.strafe=dz/d*k;}
  }
  Y.AI3D=AI3D;Y.createAI=(m,...args)=>new(m.courtMode==='3d'?AI3D:Y.AI)(m,...args);
})(typeof GameGlobal!=='undefined'?GameGlobal:typeof window!=='undefined'?window:globalThis);
