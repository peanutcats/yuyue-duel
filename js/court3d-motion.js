/* Continuous badminton rig. All joints share the player's local court frame. */
(function(G){
  'use strict';
  const Y=G.YY,{clamp,lerp}=Y,TAU=Math.PI*2;
  const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
  const mix=(a,b,t)=>a.map((v,i)=>lerp(v,b[i],t));
  const add=(a,b)=>a.map((v,i)=>v+b[i]);
  const sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const mul=(v,k)=>v.map(x=>x*k);
  const dot=(a,b)=>a.reduce((s,n,i)=>s+n*b[i],0);
  const norm=v=>mul(v,1/(Math.hypot(...v)||1));
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  function ik(a,b,l1,l2,bend){
    const delta=sub(b,a),d=Math.max(.001,Math.hypot(...delta)),u=norm(delta);
    const stretch=Math.max(1,d/(l1+l2-.001));l1*=stretch;l2*=stretch;
    const x=clamp((d*d+l1*l1-l2*l2)/(2*d),0,l1),h=Math.sqrt(Math.max(0,l1*l1-x*x));
    let v=sub(bend,mul(u,dot(bend,u)));
    if(Math.hypot(...v)<.001)v=cross(u,[0,1,0]);
    return add(add(a,mul(u,x)),mul(norm(v),h));
  }
  // C1 Hermite paths retain velocity at impact and soften every transition.
  function path(keys,t,impact=-1,velocity=null){
    const tangent=i=>{
      if(i===impact&&velocity)return velocity;
      if(i===0||i===keys.length-1)return[0,0,0];
      const prev=keys[i-1],next=keys[i+1];
      return mul(sub(next[1],prev[1]),.72/(next[0]-prev[0]));
    };
    if(t<=keys[0][0])return keys[0][1].slice();
    for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){
      const a=keys[i-1],b=keys[i],dt=b[0]-a[0],u=clamp((t-a[0])/dt,0,1),v=u*u,w=v*u,va=tangent(i-1),vb=tangent(i);
      return a[1].map((x,j)=>(2*w-3*v+1)*x+(w-2*v+u)*dt*va[j]+(-2*w+3*v)*b[1][j]+(w-v)*dt*vb[j]);
    }
    return keys.at(-1)[1].slice();
  }
  // Long support phase, short raised recovery. The lateral stride stays inside
  // two distinct foot lanes, including when the opponent faces the camera.
  function gait(phase){
    const u=((phase/TAU)%1+1)%1;
    if(u<.6)return{travel:1-u/.3,lift:0,roll:smooth((u-.3)/.3)};
    const v=(u-.6)/.4;
    const v2=v*v,v3=v2*v;
    return{travel:-1+6*v2-4*v3-4/3*(2*v3-3*v2+v),lift:Math.sin(Math.PI*v)**2,roll:1-smooth(v/.3)};
  }
  // Parallel-transport the elbow's bend plane from a stable body axis. A
  // projected fixed pole flips by 180 degrees when the wrist passes that pole.
  function elbowPlane(ray,forward,across,side=1,wrist=false){
    const reference=wrist?norm(add(add(mul(forward,.7),mul(across,-.45)),[0,-.55,0])):mul(across,-1);
    const base=wrist?norm(sub(across,mul(reference,dot(across,reference)))):norm(add(mul(forward,side*.6),[0,-.8,0]));
    const c=dot(reference,ray),k=cross(reference,ray);
    if(c<-.995)return base;
    return add(add(base,cross(k,base)),mul(cross(k,cross(k,base)),1/(1+c)));
  }
  function grip(shoulder,head,lag,twist,forward,across){
    const delta=sub(head,shoulder),d=Math.max(.001,Math.hypot(...delta)),ray=norm(delta);
    const stretch=Math.max(1,d/(.31+.29+.42-.008)),length=.42*stretch,arm=.598*stretch;
    const cone=Math.acos(clamp((d*d+length*length-arm*arm)/(2*d*length),-1,1));
    // Keep a little room between wrist and shoulder, even during a folded
    // backhand. Otherwise the elbow whips around an almost-zero length vector.
    const minimum=Math.acos(clamp((d*d+length*length-(.2*stretch)**2)/(2*d*length),-1,1));
    const room=Math.max(.00001,cone-minimum);
    const angle=minimum+room*Math.tanh(Math.max(0,lag-minimum)/room);
    const basis=elbowPlane(ray,forward,across),tangent=add(mul(basis,Math.cos(twist)),mul(cross(ray,basis),Math.sin(twist)));
    const axis=add(mul(ray,Math.cos(angle)),mul(tangent,Math.sin(angle)));
    const wrist=sub(head,mul(axis,length));
    const pole=elbowPlane(norm(sub(wrist,shoulder)),forward,across,1,true);
    return{axis,wrist,elbow:ik(shoulder,wrist,.31*stretch,.29*stretch,pole),stretch};
  }
  Y.courtPose3D=function(p,m,time,opt={}){
    const art=opt.art||{shoulder:1,waist:1,lean:0},action=opt.action,s=m.shuttle,sw=p.swing;
    const shot=Y.motionFrame(p,Y.CharacterArt?.motionFor(p,opt.look)),style=shot?.style||'clear',clip=Y.MOTION_CLIPS[style];
    const under=clip.family==='under',low=under||clip.family==='short',drive=clip.family==='side',power=clip.power;
    const st=sw?.t||0,dur=sw?.dur||.3,hit=sw?.contact,contactT=hit?.t??Math.min(Y.C.SW_SWEET,dur*.5);
    const live=s.live&&!s.ctl&&s.lastHitter!==p.idx;
    const speed=Math.hypot(p.vx||0,p.vz||0),run=smooth(speed/4.8),phase=p.runPhase||0;
    const weight=shot?.weight||0,act=Y.CharacterArt?.acting(opt.look),rest=1-(shot?.weight||0),glide=(p.cnt?.ribbon?.dash?Math.sin(Math.PI*(1-p.cnt.ribbon.dash.t/.3)):0)||p.cnt?.nv?.movePose?.w||(p.cnt?.club?.dash?Math.sin(Math.PI*clamp(1-p.cnt.club.dash.t/.27,0,1)):0),turn=p.cnt?.nv?.turnPose||0;
    const lateral=((hit?.z??s.z??p.z)-p.z)*p.dir;
    const backhand=1-smooth((lateral+.36)/.44),hand=backhand>.5?-1:1;
    const spinAngle=!p.onGround?(p.cnt?.nv?.turnAngle||0):0;
    const root=[p.x,p.y,p.z],toWorld=(x,y,z,yaw=spinAngle)=>[
      p.x+p.dir*(x*Math.cos(yaw)-z*Math.sin(yaw)),p.y+y,p.z+p.dir*(x*Math.sin(yaw)+z*Math.cos(yaw))
    ];
    const rotate=v=>[p.dir*(v[0]*Math.cos(spinAngle)-v[2]*Math.sin(spinAngle)),v[1],p.dir*(v[0]*Math.sin(spinAngle)+v[2]*Math.cos(spinAngle))];
    const incomingYaw=sw?Math.atan2(lateral,Math.max(1.8,((hit?.x??s.x)-p.x)*p.dir))*.2*weight:0;
    const torsoYaw=clamp(incomingYaw+turn*.55+(!sw&&action?action.yaw*action.e:0)+(shot?.chestYaw||0)*.65*lerp(1,-.65,backhand),-.9,.9);
    const pelvisYaw=clamp(turn*.2+(shot?.hipYaw||0)*.4*lerp(1,-.65,backhand),-.27,.27);
    const forward=rotate([Math.cos(torsoYaw),0,Math.sin(torsoYaw)]),across=rotate([-Math.sin(torsoYaw),0,Math.cos(torsoYaw)]);
    const stanceForward=rotate([Math.cos(pelvisYaw),0,Math.sin(pelvisYaw)]),stanceAcross=rotate([-Math.sin(pelvisYaw),0,Math.cos(pelvisYaw)]);
    const reach=shot&&p.onGround?shot.lunge:0;
    const identity=Y.CharacterArt?.motionFor(p,opt.look)||{coil:1,stance:1,lean:0,follow:1},mechanical=Y.CharacterArt?.mechanical(m,p);
    const land=clamp((p.motion?.land||0)/.2,0,1),split=p.onGround&&!sw?Math.sin(Math.PI*clamp((p.motion?.split||0)/.18,0,1)):0;
    const fatigue=clamp((40-(p.stamina??100))/40,0,1);
    const breath=Math.sin(time*(3+fatigue*3)+p.idx)*(.008+fatigue*.013)*(1-run);
    const lean=(act?.hip||0)*rest*.35+glide*.18+reach*.14+(shot?.lean||0)*.6+(!sw?(art.lean||0):0);
    const castLean=(!sw&&action?action.lean*action.e:0)+(mechanical?.punch||0)*.14+identity.lean;
    const hipX=(shot?.hipX||0)*.7+reach*.07,hipY=.805-(!sw&&action?action.crouch:0)-glide*.12-.045*split-.115*reach-.065*Math.sin(land*Math.PI)-.035*run-(shot?.load||0)*.55+breath-(p.stamina<25?.04:0);
    const H=toWorld(hipX,hipY,0),H1=add(H,mul(stanceAcross,.135*art.waist)),H2=add(H,mul(stanceAcross,-.135*art.waist));
    const bank=clamp(((p.motion?.bank||0)*.05+(p.vz||0)*.012)*p.dir,-.11,.11);
    const chest=toWorld(hipX+.025+lean+castLean,hipY+.47,bank);
    const S1=add(chest,mul(across,.215*art.shoulder)),S2=add(chest,mul(across,-.215*art.shoulder));
    if(shot?.overhead)S1[1]+=.055*weight*(1-smooth((shot.t-.1)/.07));
    const move=norm([p.vx||0,0,p.vz||0]),along=dot(move,stanceForward),sideways=dot(move,stanceAcross);
    const feet=[],rolls=[];
    for(const side of[1,-1]){
      const step=gait(phase+(side<0?Math.PI:0));
      const stride=run*(1-reach*.8)*(1-weight*.65)*(1-glide);
      const width=.205*identity.stance+.05*split+.06*Math.abs(sideways)*run;
      let x=.025+side*.055+(act?(side>0?act.front-.23:act.back+.21)*.6*rest:0)+along*step.travel*.44*stride+(side>0?.45:-.15)*reach;
      let z=side*width+sideways*step.travel*.095*stride;
      let y=step.lift*.17*stride;
      x+=side*glide*.3;
      if(p.onGround){
        if(shot?.overhead){x+=side*.07*weight;y+=side<0?.065*weight*shot.scissor:0;}
      }else{
        const age=p.motion?.air??.2,tuck=smooth(age/.12)*(p.vy<0?smooth(p.y/.24):1);
        const scissor=shot?shot.scissor*shot.overhead*(1-smooth((shot.t-.19)/.11)):0;
        x=lerp(x,side>0?lerp(-.28,.32,scissor):lerp(.27,-.3,scissor),tuck);
        y=lerp(0,side>0?.2+.06*(1-scissor):.16+.09*scissor,tuck);
        z=side*(width+.015*tuck);
      }
      z=side*Math.max(.15,side*z);
      feet.push(toWorld(x,y,z,pelvisYaw+spinAngle));rolls.push(step.roll*stride);
    }
    const [F1,F2]=feet;
    // Mirror the pelvis and feet together. Separate knee poles keep knees over
    // the corresponding foot instead of swapping the opponent's two legs.
    const K1=ik(H1,F1,.46,.46,add(stanceForward,mul(stanceAcross,.1))),K2=ik(H2,F2,.46,.46,add(stanceForward,mul(stanceAcross,-.1)));
    let N=toWorld(hipX+.025+lean*.86+castLean,hipY+.58,0),hd=toWorld(hipX+.025+lean*.75+castLean,hipY+.77,0);
    const ready=toWorld(.38+(act?.hip||0)*.6+Math.cos(phase)*run*.045,1.57+(act?Math.sin(act.arm[0]*Math.PI/180)*.10:0)+Math.sin(phase)*run*.025,.44+(act?.tilt||0)*.4);
    const fore=(a,b)=>mix(a,b,backhand);
    const lowBack=under?.62:style==='kill'?1.4:1.02;
    const lowFinish=under?1.56:style==='kill'?.78:1.1+clip.follow*.004;
    let backs=toWorld(...fore(low?[-.12,lowBack,.43]:drive?[-.16,1.44,.6]:[-.24,1.68+power*.08,.59],low?[.16,lowBack+.08,-.45]:drive?[.02,1.44,-.54]:[.12,1.6+power*.08,-.49]));
    const prep=mix(ready,backs,.3);if(!low&&!drive)prep[1]+=.12;
    let finish=toWorld(...fore(low?[.67,lowFinish,-.08]:drive?[.68,1.16,-.4]:[.5,.84+(1-power)*.35,-.47],low?[.66,lowFinish,.1]:drive?[.67,1.1,.4]:[.58,1.02,.52]));
    // Follow-through changes by character and contact quality, while the
    // keyframe at actual impact remains pinned to the authoritative cork.
    finish=add(finish,mul(forward,(identity.follow-1)*.18+(shot?.perfect||0)*.08-(shot?.strain||0)*.12));
    finish[1]-=(shot?.strain||0)*.13;backs=add(backs,mul(across,(identity.coil-1)*.10));
    const lead=clamp(contactT-st,0,.11),pace=m.shuttleScale?m.shuttleScale():Y.COURT3D.flightPace;
    let target=hit?[hit.x,hit.y,hit.z??p.z]:live?[s.x+s.vx*lead*pace,s.y+s.vy*lead*pace-.5*Y.C.G*(lead*pace)**2,(s.z||0)+(s.vz||0)*lead*pace]:toWorld(.65,low?.98:drive?1.5:2.12,.16);
    if(sw?.serve){target=toWorld(.42,.9-p.y,0);backs=toWorld(-.1,.68,.28);finish=toWorld(.55,1.08,.07);}
    if(!hit&&Math.hypot(...sub(target,root))>3.15)target=toWorld(.65,low?.98:drive?1.5:2.12,.16);
    if(!hit){const d=sub(target,S1),length=Math.hypot(...d);if(length>1.012)target=add(S1,mul(d,1.012/length));}
    const windT=Math.min(.064,contactT*.57),prepT=windT*.46,followT=contactT+(dur-contactT)*.54;
    let headR=ready.slice(),lag=.82,twist=3.05;
    if(sw){
      const through=mul(norm(sub(finish,backs)),low?3.8+power:drive?6:8+power*2);
      headR=path([[0,ready],[prepT,prep],[windT,backs],[contactT,target],[followT,finish],[dur,ready]],st,3,through);
      const turn=lerp(1,-.7,backhand);
      const windTwist=low||drive?3.05+(low?-.45:1.05)*turn:lerp(1.9,1.1,backhand);
      lag=Y.motionChannel([[0,.82],[windT,low?.75:drive?1.05:2.2],[contactT,.035],[followT,.95],[dur,.82]],st);
      twist=Y.motionChannel([[0,3.05],[windT,windTwist],[contactT,3.05+.1*turn],[followT,3.05-.75*turn],[dur,3.05]],st);
    }
    if(!sw&&action){
      const targets={reach:[1,1.5,.16],sweep:[.8,1.3,.65],summon:[.1,2.12,.36],place:[.66,.91,.08],focus:[.25,1.58,.36],leap:[0,1.85,.58]};
      const target=targets[action.family].slice();target[0]+=action.reach+Math.cos(action.arm[0]*Math.PI/180)*.12;target[2]+=action.variant*.12;target[1]+=Math.sin(action.release*Math.PI)*.16+Math.sin(action.arm[0]*Math.PI/180)*.13;
      headR=mix(headR,toWorld(...target),action.e);
    }
    if(mechanical&&!sw){
      const direction=norm(sub(mechanical.head,S1));headR=add(S1,mul(direction,.92+.04*mechanical.punch));
      lag=.28;twist=3.05;
    }
    if(!sw&&!action&&!mechanical&&p.shotQueue3D){
      const age=Number.isFinite(p.shotQueue3D.until)?clamp(.42-(p.shotQueue3D.until-m.time),0,.42):.12;
      const anticipation=smooth(age/.065)*.46;
      const prepare=toWorld(p.shotQueue3D.btn==='smash'?-.16:.21,p.shotQueue3D.btn==='drop'?1.55:1.91,.45);
      headR=mix(headR,prepare,anticipation);lag=lerp(lag,1.3,anticipation);
    }
    const arm=grip(S1,headR,lag,twist,forward,across);
    let W=arm.wrist,E=arm.elbow,racketAxis=arm.axis;
    let W2=toWorld(.18+(act?.hip||0),1.05+(act?(act.arm[2]-75)*.0025:0),-.36-(act?.tilt||0)*.3);
    if(run)W2=mix(W2,toWorld(-.06+Math.cos(phase)*.16,1.06,-.34),run);
    if(sw){
      const point=toWorld(low?-.08:.12,low?1.2:drive?1.45:1.75,-.44);
      const guide=toWorld(low?-.1:.15,low?1.19:drive?1.35:1.57,-.45),tuck=toWorld(.03,1.1,-.44);
      W2=path([[0,W2],[contactT*.6,point],[contactT,guide],[followT,tuck],[dur,W2]],st);
    }
    if(!sw&&action){const targets={reach:[.4,1.6,-.5],sweep:[.6,1.4,-.65],summon:[.2,1.9,-.4],place:[.6,1,-.15],focus:[.4,1.35,-.18],leap:[-.35,1.3,-.7]};const point=targets[action.family].slice();point[0]+=Math.cos(action.arm[2]*Math.PI/180)*.18;point[1]+=Math.sin(action.arm[2]*Math.PI/180)*.15;W2=mix(W2,toWorld(...point),action.e);}
    const cast=p.castPose3D,age=cast?m.time-cast.t:99;
    if(!sw&&!action&&age>=0&&age<.42)W2=mix(W2,toWorld(.65,1.5,-.15),Math.sin(age/.42*Math.PI));
    if(p.cnt?.vine)W2=toWorld(0,2.05,-.16);
    let E2=ik(S2,W2,.29,.28,elbowPlane(norm(sub(W2,S2)),forward,across,-1));
    if(p.buff?.dive>0||p.buff?.prone>0){
      const u=p.buff.dive>0?1:.65;for(const v of[H1,H2,S1,S2,N,hd,E,E2,W,W2,headR]){v[0]+=forward[0]*(v[1]-p.y)*.6*u;v[2]+=forward[2]*(v[1]-p.y)*.6*u;v[1]=p.y+(v[1]-p.y)*.4;}
      racketAxis=norm(sub(headR,W));
    }
    const result={spinAngle,face:shot?.face||1,H1,H2,S1,S2,K1,K2,F1,F2,W,E,W2,E2,hd,N,headR,racketAxis,forward,across,stanceForward,stanceAcross,footRoll:rolls,hand,backhand,style,torsoYaw,pelvisYaw,power,reach,run,phase,near:p.side<0,armStretch:arm.stretch,pose:{Rk:Math.atan2(racketAxis[1],racketAxis[0]),motion:shot}};
    if(sw?.fromStyle&&sw.contact&&(sw.fromStyle!==style||sw.fromDur!==sw.dur)&&st<sw.contact.t+.075){
      const previous=Y.courtPose3D({...p,swing:{...sw,style:sw.fromStyle,dur:sw.fromDur||sw.dur,fromStyle:null}},m,time,opt),u=smooth((st-sw.contact.t)/.075);
      for(const key of['H1','H2','S1','S2','K1','K2','F1','F2','W','E','W2','E2','hd','N','headR'])result[key]=mix(previous[key],result[key],u);
      result.racketAxis=norm(sub(result.headR,result.W));result.face=lerp(previous.face,result.face,u);
    }
    return result;
  };
})(typeof GameGlobal!=='undefined'?GameGlobal:typeof window!=='undefined'?window:globalThis);
