/* Rounded, articulated character meshes over the shared contact rig. */
(function(G){
  'use strict';
  const Y=G.YY,{clamp,lerp}=Y,TAU=Math.PI*2,V=Y.CourtView3D.prototype;
  const mix=(a,b,u)=>a.map((v,i)=>lerp(v,b[i],u)),add=(a,b)=>a.map((v,i)=>v+b[i]),mul=(a,n)=>a.map(v=>v*n);
  function path(g,pts){g.beginPath();pts.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.closePath();}
  V.modelLimb=function(g,a,b,r1,r2,color,outline=true){
    const p=this.project(...a),q=this.project(...b),dx=q.x-p.x,dy=q.y-p.y,L=Math.hypot(dx,dy)||1,nx=-dy/L,ny=dx/L;
    const u=Math.max(.7,p.k*r1),v=Math.max(.6,q.k*r2);
    g.beginPath();g.moveTo(p.x+nx*u,p.y+ny*u);g.lineTo(q.x+nx*v,q.y+ny*v);g.quadraticCurveTo(q.x+dx/L*v,q.y+dy/L*v,q.x-nx*v,q.y-ny*v);g.lineTo(p.x-nx*u,p.y-ny*u);g.quadraticCurveTo(p.x-dx/L*u,p.y-dy/L*u,p.x+nx*u,p.y+ny*u);g.closePath();
    const gradient=g.createLinearGradient(p.x-nx*u,p.y-ny*u,p.x+nx*u,p.y+ny*u);
    gradient.addColorStop(0,Y.shade(color,.76));gradient.addColorStop(.45,color);gradient.addColorStop(.72,Y.shade(color,1.13));gradient.addColorStop(1,Y.shade(color,.88));
    g.fillStyle=gradient;g.fill();if(outline){g.lineWidth=.65;g.strokeStyle='#101b2bba';g.stroke();}
  };
  V.modelChain=function(g,a,j,b,widths,color){const A=this.project(...a),J=this.project(...j),B=this.project(...b);Y.CharacterArt.limb(g,[A.x,A.y],[J.x,J.y],[B.x,B.y],widths.map((v,i)=>v*(i<2?A.k:i===2?J.k:B.k)),color,'#182332b0',.65);};
  V.modelBody=function(g,F,look,art){
    const H=mix(F.H1,F.H2,.5),S=mix(F.S1,F.S2,.5),n=12,rings=[];
    // Rounded horizontal sections provide a waist, ribcage and sloping shoulder.
    for(const [u,w,d]of [[-.05,.16,.12],[.17,.17,.135],[.66,.235,.14],[.91,.24,.115],[1.05,.125,.085]]){
      const c=mix(H,S,u),width=w*(u<.4?art.waist:art.shoulder)+(look.identity==='basketball'&&u<.8?.045:0);
      rings.push(Array.from({length:n},(_,i)=>add(c,add(mul(F.across,Math.sin(i/n*TAU)*width),mul(F.forward,Math.cos(i/n*TAU)*d*(look.belly?1.2:1))))));
    }
    const faces=[];
    for(let j=0;j<rings.length-1;j++)for(let i=0;i<n;i++){
      const pts=[rings[j][i],rings[j][(i+1)%n],rings[j+1][(i+1)%n],rings[j+1][i]],a=(i+.5)/n*TAU;
      let col=Math.sin(a)>.55?look.shirt2:look.shirt;
      if(look.dress&&j>=3)col=look.skin;
      if(look.prison&&j%2===0)col='#33414e';
      faces.push({pts,col:Y.shade(col,.86+.19*Math.cos(a-.7)),d:pts.reduce((s,v)=>s+this.project(...v).d,0)/4});
    }
    faces.sort((a,b)=>b.d-a.d).forEach(f=>this.polygon(g,f.pts,f.col,null));
    const front=F.forward[0]*(this.r.mirror?-1:1)<0?1:-1;
    const point=(u,v,offset=0)=>add(mix(H,S,u),add(mul(F.across,v*art.shoulder),mul(F.forward,front*(.148+offset))));
    for(const s of[-1,1]){
      this.polygon(g,[point(.08,s*.13),point(.9,s*.2),point(.8,s*.15),point(.1,s*.09)],look.panel,null);
      this.line(g,point(.1,s*.13,.003),point(.84,s*.19,.003),look.trim,.8);
    }
    this.line(g,point(.06,-.13),point(.06,.13),Y.shade(look.shirt2,.78),1.4);
    this.line(g,point(.95,-.09),point(.83,0),look.trim,1.3);this.line(g,point(.83,0),point(.95,.09),look.trim,1.3);
    // Small tailored folds and hem. No flat square chest panel.
    for(const s of[-1,1])this.line(g,point(.28,s*.07),point(.19,s*.12),Y.shade(look.shirt,.83),.7);
    const center=this.project(...point(.55,0,.015)),right=this.project(...point(.55,.1,.015)),up=this.project(...point(.75,0,.015));
    const sx=Math.hypot(right.x-center.x,right.y-center.y),sy=Math.hypot(up.x-center.x,up.y-center.y);
    g.save();g.translate(center.x,center.y);g.rotate(Math.atan2(right.y-center.y,right.x-center.x));
    if(look.plaid){g.strokeStyle=look.plaid;g.lineWidth=.7;for(let i=-2;i<=2;i++){g.beginPath();g.moveTo(-sx*1.2,i*sy*.35);g.lineTo(sx*1.2,i*sy*.35);g.stroke();}}
    if(!look.prison)Y.CharacterArt.emblem(g,art.motif,0,-sy*.18,Math.max(2,sx*.52),look.trim);
    g.restore();
    // Accessories attach to the torso, following rotation and weight transfer.
    if(['field','tool','badge','office'].includes(art.detail)){
      this.polygon(g,[point(.48,-.13,.025),point(.48,-.04,.025),point(.22,-.04,.025),point(.22,-.13,.025)],art.detail==='field'?'#7c6245':look.shirt2,look.trim,.65);
      this.line(g,point(.43,-.12,.03),point(.43,-.05,.03),'#e3e8df',.7);
      if(art.detail==='tool'||art.detail==='field')for(let i=0;i<2;i++)this.line(g,point(.28,-.11+i*.035,.04),point(.58,-.11+i*.035,.04),i?'#a6c3c6':'#e0ba72',1.15);
    }
    if(art.detail==='office'||art.detail==='coat'){
      this.line(g,point(.95,-.12,.015),point(.08,.14,.015),art.detail==='coat'?'#b5c5cf':'#6b7f8d',1.7);
      if(art.detail==='office')this.polygon(g,[point(.96,0,.035),point(.82,.035,.035),point(.3,.02,.035),point(.24,0,.035),point(.3,-.025,.035),point(.82,-.035,.035)],'#ca8d58',null);
    }
    if(look.whistle){this.line(g,point(.97,-.06,.025),point(.5,0,.03),'#ee8b6e',.7);this.line(g,point(.5,0,.03),point(.97,.06,.025),'#ee8b6e',.7);const q=this.project(...point(.48,0,.04));g.fillStyle='#d6e2e8';g.fillRect(q.x-1.5,q.y-1,3,2.8);}
    if(look.marketTier>=3){for(const s of[-1,1])this.line(g,point(.15,s*.1,.025),point(.85,s*.13,.025),look.marketColor,1.8);}
    if(!look.identity&&look.num){const q=this.project(...point(.3,.015,.025));this.label(g,look.num,q.x,q.y,Math.max(4,q.k*.09),look.panel);}
    if(look.dress){
      // Two thin straps above a dark satin bodice, and a flared opaque skirt.
      for(const side of[-1,1])this.line(g,point(1,side*.12,.025),point(.69,side*.16,.025),look.shirt,2.2);
      const top=[],hem=[];for(let i=0;i<12;i++){const a=i/12*TAU;top.push(add(H,add(mul(F.across,Math.sin(a)*.17),mul(F.forward,Math.cos(a)*.13))));hem.push(add(add(H,[0,-.29,0]),add(mul(F.across,Math.sin(a)*.28),mul(F.forward,Math.cos(a)*.19))));}
      const faces=top.map((q,i)=>[q,top[(i+1)%12],hem[(i+1)%12],hem[i]]).sort((a,b)=>this.project(...b[2]).d-this.project(...a[2]).d);
      faces.forEach((pts,i)=>this.polygon(g,pts,i%2?look.shirt:look.shirt2,null));for(let i=0;i<12;i++)this.line(g,hem[i],hem[(i+1)%12],look.trim,.65);
    }
    if(art.detail==='apron')this.polygon(g,[point(.83,-.12,.025),point(.83,.12,.025),point(-.25,.2,.025),point(-.25,-.2,.025)],look.panel,look.trim,.8);
    if(['sash','split','wrap','tape'].includes(art.detail)){this.line(g,point(.92,-.16,.03),point(.2,.15,.03),look.panel,4);this.line(g,point(.87,-.17,.04),point(.15,.14,.04),look.trim,1);}
    if(['bow','star'].includes(art.detail)){
      if(art.detail==='bow'){const q=this.project(...point(.83,0,.04));Y.CharacterArt.butterfly(g,q.x,q.y,q.k*.045,this.time,look.shirt2);}
      else{for(const [u,v]of[[.35,-.07],[.58,.08],[.76,-.08]]){const q=this.project(...point(u,v,.04));Y.CharacterArt.emblem(g,'star',q.x,q.y,q.k*.025,look.trim);}}
      const lower=add(H,[0,-.19,0]);for(let i=0;i<8;i++){const a=i/8*TAU,b=(i+1)/8*TAU;this.polygon(g,[add(H,add(mul(F.across,Math.sin(a)*.17),mul(F.forward,Math.cos(a)*.13))),add(H,add(mul(F.across,Math.sin(b)*.17),mul(F.forward,Math.cos(b)*.13))),add(lower,add(mul(F.across,Math.sin(b)*.24),mul(F.forward,Math.cos(b)*.17))),add(lower,add(mul(F.across,Math.sin(a)*.24),mul(F.forward,Math.cos(a)*.17)))],i%2?look.shorts:look.shorts2,null);}
    }
    if(art.detail==='tool'){this.line(g,point(.12,-.17,.03),point(.12,.17,.03),'#29473a',3);for(let i=0;i<3;i++)this.line(g,point(.2,-.11+i*.045,.04),point(-.08,-.11+i*.045,.04),i%2?'#a4e7d6':'#e9c17e',1.5);}
    if(art.detail==='circuit')for(const side of[-1,1]){this.line(g,point(.85,side*.15,.025),point(.32,side*.15,.025),look.trim,1);this.line(g,point(.32,side*.15,.025),point(.22,side*.08,.025),look.trim,1);}
    if(front<0){const q=this.project(...point(.69,0,.025));g.save();g.globalAlpha*=.65;this.label(g,'YUYUE',q.x,q.y,Math.max(3.5,q.k*.045),look.trim);g.restore();}
  };
  V.modelShoe=function(g,F,K,frame,look,index=0){
    const front=frame.stanceForward||frame.forward,across=frame.stanceAcross||frame.across,art=look.shoeArt;
    const roll=frame.footRoll?.[index]||0;
    const pt=(x,y,z)=>add(F,add(mul(front,x),[across[0]*z,y+Math.max(0,.16-x)*Math.sin(roll*.24),across[2]*z]));
    const verts=[pt(-.1,.025,-.07),pt(.2,.02,-.08),pt(.24,.07,0),pt(.2,.08,.09),pt(-.09,.1,.07),pt(-.105,.15,-.055),pt(.07,.135,-.065),pt(.16,.1,.07),pt(-.085,.15,.06)];
    this.mesh(g,verts,[[[0,1,2,3,4],art?.out||look.sole],[[0,5,6,1],look.shoe],[[5,8,7,6],Y.shade(look.shoe,1.12)],[[4,3,7,8],look.shoe],[[1,6,7,3,2],look.shoe]]);
    this.line(g,pt(-.085,.035,-.075),pt(.19,.035,-.075),art?.mid?.[1]||look.sole,1.4);
    for(let i=0;i<3;i++)this.line(g,pt(.02+i*.035,.143-i*.009,-.04),pt(.045+i*.035,.14-i*.009,.045),art?.lace||'#e4eee9',.6);
    this.line(g,pt(-.025,.08,-.08),pt(.105,.09,-.08),art?.accent||look.sole,1.1);
    if(look.marketTier>=3)this.ring(g,F[0],F[2],.18,look.marketColor,.5,F[1]+.015);
  };
  V.modelRacket=function(g,F,look){
    const W=F.W,h=F.headR,axis=F.racketAxis||[1,0,0],art=look.racketArt;
    this.modelLimb(g,add(W,mul(axis,-.035)),add(W,mul(axis,.12)),.024,.02,look.grip,false);
    this.line(g,add(W,mul(axis,.12)),h,art?.shaft?.[0]||look.shaft||'#c0d7dd',.85);
    const q=this.project(...h),w=this.project(...W),a=Math.atan2(q.y-w.y,q.x-w.x),rx=q.k*.13*(art?.headW||1),ry=q.k*.17;
    g.save();g.translate(q.x,q.y);g.rotate(a-Math.PI/2);g.scale(Math.max(.24,F.face||1),1);
    const shape=()=>{g.beginPath();g.moveTo(0,-ry);g.bezierCurveTo(rx*1.2,-ry,rx*1.12,ry*.5,rx*.55,ry*.9);g.quadraticCurveTo(0,ry*1.2,-rx*.55,ry*.9);g.bezierCurveTo(-rx*1.12,ry*.5,-rx*1.2,-ry,0,-ry);g.closePath();};
    shape();g.fillStyle='#e9fff70d';g.fill();g.save();g.clip();g.strokeStyle=art?.string||'#dcecebc9';g.lineWidth=.45;g.beginPath();for(let i=-3;i<=3;i++){g.moveTo(i*rx/4,-ry);g.lineTo(i*rx/4,ry);g.moveTo(-rx,i*ry/4);g.lineTo(rx,i*ry/4);}g.stroke();g.restore();
    shape();g.strokeStyle='#13212d';g.lineWidth=2.5;g.stroke();g.strokeStyle=look.racket;g.lineWidth=1.6;g.stroke();g.strokeStyle=look.racket2;g.lineWidth=.8;g.beginPath();g.ellipse(0,-ry*.1,rx*.95,ry*.92,0,Math.PI*1.12,TAU-.3);g.stroke();
    for(const s of[-1,1]){g.fillStyle=art?.accent||look.racket2;g.fillRect(s*rx*.74-1,-ry*.38,2,3);}
    g.restore();
  };
  V.player=function(g,p,m,ghost=false){
    const r=this.r,look=r.lookOf(m,p.idx),art=Y.CharacterArt.profile(look),cast=r.characterCasts?.[p.idx];
    const action=cast?Y.CharacterArt.action(cast.id,r.time-cast.start):null;
    const F=Y.courtPose3D(p,m,this.time,{look,art,action}),base=this.project(p.x,0,p.z);
    g.save();if(ghost)g.globalAlpha*=.4;
    const shadow=g.createRadialGradient(base.x,base.y,0,base.x,base.y,base.k*.55);shadow.addColorStop(0,'#06101c66');shadow.addColorStop(1,'#06101c00');g.save();g.translate(base.x,base.y);g.scale(1,.34);g.fillStyle=shadow;g.beginPath();g.arc(0,0,base.k*(.48+art.waist*.12),0,TAU);g.fill();g.restore();
    const leg=(H,K,Ft,back,index)=>{const shade=c=>back?Y.shade(c,.88):c;this.modelChain(g,H,K,Ft,[.078,.09,.05,.066,.033].map(v=>v*art.limb),shade(look.stockings||look.skin));this.modelLimb(g,mix(K,Ft,.65),mix(K,Ft,.95),.049,.042,shade(look.sock));this.modelShoe(g,Ft,K,F,look,index);this.modelLimb(g,H,mix(H,K,.49),.11*art.waist,.095*art.limb,back?look.shorts2:look.shorts);this.line(g,mix(H,K,.18),mix(H,K,.48),look.stripe,1);};
    const arm=(S,E,W,back)=>{this.modelChain(g,S,E,W,[.056,.064,.035,.047,.028].map(v=>v*art.limb),back?look.skin2:look.skin);if(!look.tank)this.modelLimb(g,S,mix(S,E,.43),.077*art.shoulder,.061*art.limb,back?look.shirt2:look.shirt);this.modelLimb(g,mix(E,W,.79),mix(E,W,.94),.041,.039,look.wrist);const q=this.project(...W);g.fillStyle=look.skin;g.beginPath();g.ellipse(q.x,q.y,q.k*.039,q.k*.047,-.4,0,TAU);g.fill();g.strokeStyle=look.skin2;g.lineWidth=.55;g.stroke();};
    const legs=[{h:F.H1,k:F.K1,f:F.F1,index:0},{h:F.H2,k:F.K2,f:F.F2,index:1}].sort((a,b)=>this.project(...b.k).d-this.project(...a.k).d);
    legs.forEach((l,i)=>leg(l.h,l.k,l.f,i===0,l.index));
    const bodyDepth=this.project(...mix(F.S1,F.S2,.5)).d;
    const arms=[{s:F.S1,e:F.E,w:F.W,main:true},{s:F.S2,e:F.E2,w:F.W2,main:false}];
    for(const a of arms)if(this.project(...a.e).d>bodyDepth)arm(a.s,a.e,a.w,true);
    this.modelBody(g,F,look,art);
    this.modelLimb(g,F.N,F.hd,.05,.048,look.skin2);
    const hp=this.project(...F.hd),scale=hp.k*.151*art.head*(look.headScale||1);
    const back=r.modelAngle!=null?Math.cos(r.modelAngle)<0:p.dir*(r.mirror?-1:1)>0;
    g.save();g.translate(hp.x,hp.y);g.rotate(clamp(F.torsoYaw*.09,-.12,.12)+(action?.id==='liubai'?-.22*action.e:0));g.scale(scale,scale);Y.CharacterArt.head(g,look,{back,turn:F.torsoYaw,time:this.time,focus:!!p.swing,gaze:Y.clubHintHidden?.(m,p.idx)?0:clamp((m.shuttle.z-p.z)*.2,-1,1),quality:r.quality});g.restore();
    for(const a of arms)if(this.project(...a.e).d<=bodyDepth)arm(a.s,a.e,a.w,false);
    if(!Y.CharacterArt.mechanical(m,p)){
      this.modelRacket(g,F,look);
      if(!ghost&&Y.clubInkReady?.(m,p)){const q=this.project(...F.headR),w=this.project(...F.W);Y.SkillFX?.inkRacket?.(g,q.x,q.y,q.k/42,this.time,Math.atan2(q.y-w.y,q.x-w.x)-Math.PI/2);}
    }
    if(art.detail==='knee'){const q=this.project(...mix(F.K1,F.F1,.12));g.save();g.translate(q.x,q.y);g.rotate(-.3);g.fillStyle='#e6ccb1';Y.rr(g,-q.k*.038,-q.k*.025,q.k*.076,q.k*.05,.9);g.fill();g.fillStyle='#bb977b';g.fillRect(-.5,-.7,1,1.4);g.restore();}
    if(art.detail==='tape')this.modelLimb(g,mix(F.S1,F.E,.65),mix(F.S1,F.E,.8),.049,.046,'#d1e7db');
    if(!ghost){
      const list=this.racketTrails[p.idx],hitT=p.swing?.contact?.t??.11,age=p.swing?.t||0;
      if(p.swing&&!p.swing.serve&&age>.045&&age<hitT+.14){if(!list.length||this.time-list.at(-1).t>=1/120)list.push({v:F.headR.slice(),t:this.time});}
      while(list.length&&(this.time-list[0].t>.095||list.length>14))list.shift();
      for(let i=1;i<list.length;i++){g.save();g.globalAlpha*=clamp(1-(this.time-list[i].t)/.095,0,1)*.36;this.line(g,list[i-1].v,list[i].v,p.swing?.q!=null&&p.swing.q<.4?'#ffba91':p.swing?.q>=.85?'#c8ffe3':p.swing?.style==='smash'?'#ffe0aa':look.racket2,1+i/list.length*1.8);g.restore();}
    }
    // A thin team marker stays on the ground; clothing carries character identity.
    if(!ghost)this.ring(g,p.x,p.z,.35,p.idx?'#80c5dc':'#efc57c',.36);
    g.restore();
  };
  V.drawCastEffects=function(g,m,dt){
    for(const p of m.players)if(p.buff?.silkReady>0){const q=this.project(p.x,p.y+2.15,p.z);Y.CharacterArt.butterfly(g,q.x,q.y,q.k*.12,this.time);this.label(g,p.cnt.ribbon?.deep?'蝶弓 · 挑长':'蝶弓 · 压短',q.x,q.y-16,10,'#ffc2dc');}
    const s=m.shuttle;if(s.live&&s.silkShot&&!Y.clubHintHidden?.(m,this.r.mirror?1:0)){const q=this.project(s.x,s.y+.2,s.z);Y.CharacterArt.butterfly(g,q.x,q.y,q.k*.1,this.time);}
    for(const fx of this.skillBursts){
      fx.t-=dt;const p=m.players[fx.p];if(!p)continue;
      const c=Y.SKILLS[fx.id]?.color||'#c9eff6',age=fx.life-fx.t,u=clamp(age/fx.life,0,1),kind=Y.CharacterArt.family(fx.id),d=p.dir;
      const source=[p.x,p.y+.9,p.z],f=(x,y,z)=>[p.x+d*x,p.y+y,p.z+z];
      g.save();g.globalAlpha*=Math.sin(Math.PI*u)*.65;
      if(kind==='sweep'||kind==='leap'){
        for(let j=0;j<2;j++){const pts=Array.from({length:18},(_,i)=>{const a=(-.8+i/17*2.9)+u*.9;return f(Math.cos(a)*(.5+u*.8),.05+j*.1,Math.sin(a)*(.5+u*.8));});for(let i=1;i<pts.length;i++)this.line(g,pts[i-1],pts[i],c,j?1:2);}
      }else if(kind==='summon'){
        for(let i=0;i<(this.r.quality?6:3);i++){const a=i/6*TAU+u*1.5;const q=f(Math.cos(a)*(.4+u*.4),.75+u*.8,Math.sin(a)*(.4+u*.4));this.line(g,source,q,c,1);const s=this.project(...q);g.fillStyle='#edfaff';g.beginPath();g.arc(s.x,s.y,1.5,0,TAU);g.fill();}
      }else if(kind==='place'){
        for(const s of[-1,1]){this.line(g,f(.4,.12,s*.2),f(.4+u*.5,.12,s*.45),c,1.5);this.line(g,f(.4+u*.5,.12,s*.45),f(.4+u*.5,.45,s*.45),c,1.5);}
      }else if(kind==='reach'){
        for(let i=0;i<3;i++)this.line(g,f(.2+i*.16,.95,-.17),f(.6+u*.6+i*.16,1.15,.15),c,1.3);
      }else{
        const q=this.project(...f(.25,1.45,0)),s=q.k*.23;g.strokeStyle=c;g.lineWidth=1.3;g.beginPath();for(const sign of[-1,1]){g.moveTo(q.x+sign*s,q.y-s*.5);g.lineTo(q.x+sign*s,q.y+s*.5);g.moveTo(q.x+sign*s,q.y);g.lineTo(q.x+sign*s*.65,q.y);}g.stroke();
      }g.restore();
    }this.skillBursts=this.skillBursts.filter(f=>f.t>0);
  };
  const legacyDevice=V.device;
  V.device=function(g,e,m){
    const k=e.k,color=Y.SKILLS[e.sid||({board:'fanshe',pane:'shuangji',gate:'xingmen',moon:'yueliang',pole:'shensuo',yoyo:'youyou',wind:'fengkou',ribbon:'hongxian',vine:'dangteng'}[k])]?.color||'#abdfdb';
    const x=e.x,y=e.y||0,z=e.z||0,age=e.age||0;
    if(k==='atelier'){
      const q=this.project(x,y,z);Y.CharacterArt.burst(g,q.x,q.y,q.k*.8,age,e.sid,this.r.quality);
      if(e.sid==='tangqiu'&&e.to!=null){const to=this.project(e.to,.12,e.toZ||0);g.save();g.globalAlpha*=clamp(e.t/.3,0,1)*.7;Y.CharacterArt.ribbon(g,[q.x,q.y],[to.x,to.y],this.time,q.k*.045);g.restore();}return;
    }
    if(k==='bow'){const q=this.project(x,y,z);Y.CharacterArt.butterfly(g,q.x,q.y,q.k*.14,this.time);return;}
    if(k==='yoyo'){
      const owner=m.players[e.o],a=this.project(owner.x,owner.y+1.45,owner.z),b=this.project(x,y,z);
      g.save();g.strokeStyle=e.ph===3?'#ffe3a2':'#b8dfd0';g.lineWidth=e.ph===3?1.6:1;g.beginPath();g.moveTo(a.x,a.y);g.quadraticCurveTo((a.x+b.x)/2,(a.y+b.y)/2+(e.ph===3?0:b.k*.17),b.x,b.y);g.stroke();Y.CharacterArt.flywheel(g,b.x,b.y,b.k*.28,e.spin||age*14,e.ph,e.charge||0);g.restore();
      if(e.ph===3)this.label(g,'金窗 · 再按弹射',b.x,b.y-b.k*.55,10,'#ffe7ab');return;
    }
    if(k==='ribbon'){
      const owner=m.players[e.o],a=this.project(owner.x,owner.y+1.45,owner.z),b=this.project(x,y,z);
      Y.CharacterArt.ribbon(g,[a.x,a.y],[b.x,b.y],this.time,b.k*.045);Y.CharacterArt.butterfly(g,b.x,b.y,b.k*.13,this.time);return;
    }
    if(['board','pane'].includes(k)){
      const h=k==='pane'?(e.half||.62):.48,w=k==='pane'?.55:.48;
      const pt=(dy,dz,dx=0)=>[x+dx,y+dy,z+dz];
      g.save();g.globalAlpha*=Math.min(1,age/(e.warm||.35));
      this.polygon(g,[pt(-h,-w),pt(h,-w),pt(h,w),pt(-h,w)],k==='pane'?'#cceeff24':'#f7c76e18',color,1.4);
      this.polygon(g,[pt(-h,w),pt(h,w),pt(h,w,.07),pt(-h,w,.07)],k==='pane'?'#b5e6ff65':'#e0b46a55',color,.8);
      for(const u of[-.5,0,.5])this.line(g,pt(h*u,-w),pt(h*u,w),color+'70',.65);
      for(const u of[-.5,0,.5])this.line(g,pt(-h,w*u),pt(h,w*u),color+'70',.65);
      if(k==='pane')for(const a of[0,Math.PI/3,Math.PI*2/3]){const p=this.project(x,y,z),r=p.k*.17;g.strokeStyle='#eaffff';g.lineWidth=1;g.beginPath();g.moveTo(p.x-Math.cos(a)*r,p.y-Math.sin(a)*r);g.lineTo(p.x+Math.cos(a)*r,p.y+Math.sin(a)*r);g.stroke();}
      else for(const a of[-1,1])for(const b of[-1,1]){this.line(g,pt(a*h,b*w*.7,.02),pt(a*h,b*w,.02),'#fff4d4',2);this.line(g,pt(a*h,b*w,.02),pt(a*h*.72,b*w,.02),'#fff4d4',2);}
      g.restore();return;
    }
    if(k==='gate'){
      g.save();for(const [radius,col,width]of [[.62,color,2.5],[.52,'#efffff',1],[.43,color+'66',1]]){
        const pts=Array.from({length:33},(_,i)=>{const a=i/32*TAU;return[x+Math.sin(age*2)*.03,y+Math.sin(a)*radius,z+Math.cos(a)*radius*.78];});
        for(let i=1;i<pts.length;i++)this.line(g,pts[i-1],pts[i],col,width);
      }for(let i=0;i<6;i++){const a=i/6*TAU+this.time;this.line(g,[x,y+Math.sin(a)*.57,z+Math.cos(a)*.45],[x,y+Math.sin(a)*.68,z+Math.cos(a)*.54],color,2);}g.restore();return;
    }
    if(k==='moon'){
      const p=this.project(x,y,z),radius=p.k*.4,gradient=g.createRadialGradient(p.x-radius*.32,p.y-radius*.35,0,p.x,p.y,radius);
      gradient.addColorStop(0,'#fff6dc');gradient.addColorStop(.6,'#ddd6f1');gradient.addColorStop(1,'#998dba');
      g.save();g.fillStyle=gradient;g.beginPath();g.arc(p.x,p.y,radius,0,TAU);g.fill();g.strokeStyle='#ffefbc';g.lineWidth=1;g.stroke();
      for(const [a,b,r]of [[-.4,.05,.12],[.25,-.25,.17],[.32,.4,.1]]){g.fillStyle='#8e82ac40';g.beginPath();g.ellipse(p.x+a*radius,p.y+b*radius,r*radius,r*radius*.8,.4,0,TAU);g.fill();}
      this.ring(g,x,z,.64,color,.38,y);g.restore();return;
    }
    if(['pole','yoyo'].includes(k)){
      const owner=m.players[e.o],cast=this.r.characterCasts?.[e.o],action=cast?Y.CharacterArt.action(cast.id,this.r.time-cast.start):null,rig=Y.courtPose3D(owner,m,this.time,{look:this.r.lookOf(m,e.o),art:Y.CharacterArt.profile(this.r.lookOf(m,e.o)),action}),start=k==='pole'?rig.W:[owner.x,owner.y+1.45,owner.z],end=k==='pole'?(Y.CharacterArt.mechanical(m,owner)?.head||[x,y,z]):[x,y,z];
      if(k==='pole'){
        const l=Math.hypot(x-start[0],y-start[1],z-start[2]);
        this.modelLimb(g,start,end,.022,.014,'#a5d5c0',false);
        for(let i=1;i<Math.min(7,Math.ceil(l/.4));i++){const t=i/Math.min(7,Math.ceil(l/.4));this.modelLimb(g,mix(start,end,t-.012),mix(start,end,t+.012),.027,.027,'#e6f3d9',false);}
      }else{
        const mid=mix(start,end,.5);mid[1]-=Math.min(.35,Math.hypot(x-start[0],z-start[2])*.08);let prev=start;
        for(let i=1;i<=12;i++){const u=i/12,q=start.map((v,j)=>(1-u)**2*v+2*u*(1-u)*mid[j]+u*u*end[j]);this.line(g,prev,q,'#c0eee1',1);prev=q;}
      }
      const q=this.project(...end);g.save();g.translate(q.x,q.y);g.rotate(Math.sin(age*6)*.18);g.fillStyle='#c5ffe61a';g.strokeStyle=color;g.lineWidth=2;g.beginPath();g.ellipse(0,0,q.k*.16,q.k*.22,0,0,TAU);g.fill();g.stroke();g.lineWidth=.6;g.strokeStyle='#f0fff3aa';g.beginPath();for(let i=-2;i<=2;i++){g.moveTo(i*q.k*.045,-q.k*.19);g.lineTo(i*q.k*.045,q.k*.19);g.moveTo(-q.k*.13,i*q.k*.05);g.lineTo(q.k*.13,i*q.k*.05);}g.stroke();g.restore();return;
    }
    if(k==='wind'){
      g.save();g.globalAlpha*=.65;for(let j=0;j<3;j++){let prev;for(let i=0;i<=18;i++){const a=-1.1+i/18*3.6+this.time*.7+j*.4,q=[x+Math.cos(a)*(.35+j*.06),y-.35+j*.28,z+Math.sin(a)*(.35+j*.06)];if(prev)this.line(g,prev,q,j===1?'#ddfff5':color,1.5);prev=q;}}g.restore();return;
    }
    if(k==='ribbon'||k==='vine'){
      const owner=m.players[e.o],a=k==='vine'?[x,y,z]:[owner.x,owner.y+1.45,owner.z],b=k==='vine'?[owner.x,owner.y+1.85,owner.z]:[x,y,z];let prev=a;
      for(let i=1;i<=16;i++){const u=i/16,q=mix(a,b,u);q[2]+=Math.sin(u*TAU+this.time*5)*Math.sin(u*Math.PI)*.07;this.line(g,prev,q,k==='ribbon'?'#f6b5d4':'#81b681',k==='ribbon'?2.5:2);prev=q;if(k==='vine'&&i%3===0){const p=this.project(...q);g.save();g.translate(p.x,p.y);g.rotate(i*.6);g.fillStyle='#72b480';g.beginPath();g.ellipse(3,0,4,1.7,-.6,0,TAU);g.fill();g.restore();}}
      return;
    }
    legacyDevice.call(this,g,e,m);
  };
})(typeof GameGlobal!=='undefined'?GameGlobal:typeof window!=='undefined'?window:globalThis);
