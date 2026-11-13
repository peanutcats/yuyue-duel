/* 果哥装备：骨骼空间里的分层机械造型。纯 Canvas，无贴图和额外物理状态。 */
(function(G) {
  'use strict';
  const Y=G.YY, TAU=Math.PI*2;
  const THEMES={
    3:{ light:'#64eaff', rgb:'100,234,255', hot:'#e0fcff', metal:'#263c54', plate:'#d1e5ed', dark:'#101c30' },
    4:{ light:'#78ffbf', rgb:'120,255,191', hot:'#eaffc4', metal:'#163e3c', plate:'#a6e7ce', dark:'#0b242a' },
    5:{ light:'#c7a0ff', rgb:'199,160,255', hot:'#a8f4ff', metal:'#35335b', plate:'#e5e3ff', dark:'#16182f' },
    6:{ light:'#ffbd58', rgb:'255,189,88', hot:'#a5f6ff', metal:'#3c3842', plate:'#fff0d8', dark:'#201e2e' },
  };
  function path(g,pts){g.beginPath();pts.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.closePath();}
  function plate(g,pts,fill,edge,width=.012){path(g,pts);g.fillStyle=fill;g.fill();if(edge){g.strokeStyle=edge;g.lineWidth=width;g.stroke();}}
  function line(g,pts,color,width=.012){g.beginPath();pts.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.strokeStyle=color;g.lineWidth=width;g.stroke();}
  function ellipse(g,x,y,rx,ry,color,width=.012,rotation=0,start=0,end=TAU){g.beginPath();g.ellipse(x,y,rx,ry,rotation,start,end);g.strokeStyle=color;g.lineWidth=width;g.stroke();}
  function disk(g,x,y,r,fill){g.beginPath();g.arc(x,y,r,0,TAU);g.fillStyle=fill;g.fill();}
  function glow(g,x,y,r,col){const f=g.createRadialGradient(x,y,0,x,y,r);f.addColorStop(0,`rgba(${col},.42)`);f.addColorStop(1,`rgba(${col},0)`);g.fillStyle=f;g.fillRect(x-r,y-r,r*2,r*2);}
  function hex(x,y,r,phase=0){return Array.from({length:6},(_,i)=>[x+Math.cos(i*TAU/6+phase)*r,y+Math.sin(i*TAU/6+phase)*r]);}
  function metal(g,x0,y0,x1,y1,t){const f=g.createLinearGradient(x0,y0,x1,y1);f.addColorStop(0,t.plate);f.addColorStop(.38,t.metal);f.addColorStop(.75,t.dark);f.addColorStop(1,t.plate);return f;}
  function core(g,x,y,r,t,time){
    glow(g,x,y,r*2,t.rgb);plate(g,hex(x,y,r),t.dark,t.plate,.012);
    ellipse(g,x,y,r*.74,r*.74,t.light,.018,0,time*2,time*2+TAU*.76);
    plate(g,[[x,y+r*.48],[x+r*.42,y],[x,y-r*.48],[x-r*.42,y]],t.hot,t.light,.008);
  }
  function flame(g,x,y,w,h,t,time){
    const f=1+Math.sin(time*33+x*8)*.12;
    glow(g,x,y-h*.4,h*.6,t.rgb);
    plate(g,[[x-w,y],[x-w*.6,y-h*.45],[x,y-h*f],[x+w*.6,y-h*.45],[x+w,y]],t.light);
    plate(g,[[x-w*.5,y],[x-w*.3,y-h*.34],[x,y-h*.77*f],[x+w*.3,y-h*.34],[x+w*.5,y]],t.hot);
    plate(g,[[x-w*.23,y],[x,y-h*.49*f],[x+w*.23,y]],'#ffffff');
    for(let i=0;i<3;i++){const yy=y-h*(.18+i*.2);ellipse(g,x,yy,w*(.7-i*.14),w*.14,t.hot,.008);}
  }
  // ---------- 负债入狱：手铐、脚镣与铁球（骨骼局部坐标，y 向上，单位米） ----------
  const lerp2=(a,b,u)=>[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u];
  function cuff(g,x,y,r,ang){
    g.save();g.translate(x,y);g.rotate(ang);
    g.lineWidth=r*.55;g.strokeStyle='#5c626e';g.beginPath();g.ellipse(0,0,r,r*.62,0,0,TAU);g.stroke();
    g.lineWidth=r*.2;g.strokeStyle='#e6eaf0';g.beginPath();g.ellipse(0,0,r,r*.62,0,Math.PI*1.1,Math.PI*1.6);g.stroke();
    g.fillStyle='#3d424c';g.fillRect(-r*.25,-r*.95,r*.5,r*.32);
    g.restore();
  }
  /** 沿二次曲线画铁链：一节横、一节竖 */
  function chain(g,a,b,sag,links,time){
    const c=[(a[0]+b[0])/2,(a[1]+b[1])/2-sag];
    for(let i=0;i<=links;i++){
      const u=i/links,q=[(1-u)*(1-u)*a[0]+2*u*(1-u)*c[0]+u*u*b[0],(1-u)*(1-u)*a[1]+2*u*(1-u)*c[1]+u*u*b[1]];
      const d=[2*(1-u)*(c[0]-a[0])+2*u*(b[0]-c[0]),2*(1-u)*(c[1]-a[1])+2*u*(b[1]-c[1])],ang=Math.atan2(d[1],d[0]);
      g.save();g.translate(q[0],q[1]);g.rotate(ang);g.lineWidth=.009;g.strokeStyle=i%2?'#8b919c':'#c9ced6';
      g.beginPath();g.ellipse(0,0,.024,i%2?.006:.013,0,0,TAU);g.stroke();g.restore();
    }
  }
  function prisonCuffs(g,P,look,time){
    const a=lerp2(P.E,P.W,.9),b=lerp2(P.E2,P.W2,.9),d=Math.hypot(a[0]-b[0],a[1]-b[1]);
    cuff(g,a[0],a[1],.042,Math.atan2(P.W[1]-P.E[1],P.W[0]-P.E[0])+Math.PI/2);
    cuff(g,b[0],b[1],.04,Math.atan2(P.W2[1]-P.E2[1],P.W2[0]-P.E2[0])+Math.PI/2);
    if(d<.95) chain(g,a,b,Math.max(.02,(.95-d)*.35),Math.max(4,Math.round(d/.045)),time);
    else { // 链子被扯开到极限：两段垂着晃
      for(const [p,s] of [[a,1],[b,-1]]){const sw=Math.sin(time*6+s)*.03;chain(g,p,[p[0]+sw,p[1]-.16],.01,4,time);}
    }
  }
  function prisonLegs(g,P,look,time){
    const a=lerp2(P.K1,P.F1,.82),b=lerp2(P.K2,P.F2,.82);
    cuff(g,a[0],a[1],.05,0);cuff(g,b[0],b[1],.05,0);
    const d=Math.hypot(a[0]-b[0],a[1]-b[1]);chain(g,a,b,Math.max(.03,(1.1-d)*.18),Math.max(5,Math.round(d/.05)),time);
    // 拖在后脚后面的铁球
    const foot=P.F2[0]<P.F1[0]?P.F2:P.F1,bx=Math.min(P.F1[0],P.F2[0])-.3,by=Math.min(P.F1[1],P.F2[1])+.07;
    chain(g,lerp2(P.K2,P.F2,.82),[bx+.06,by+.02],.03,6,time);
    const f=g.createRadialGradient(bx-.03,by+.03,.01,bx,by,.09);f.addColorStop(0,'#9aa1ad');f.addColorStop(.6,'#3b4049');f.addColorStop(1,'#1d2026');
    g.fillStyle=f;g.beginPath();g.arc(bx,by,.085,0,TAU);g.fill();g.lineWidth=.012;g.strokeStyle='#14161b';g.stroke();
    g.fillStyle='rgba(255,255,255,.5)';g.beginPath();g.arc(bx-.03,by+.035,.016,0,TAU);g.fill();
    g.save();g.translate(bx,by);g.scale(1,-1);g.font='900 .05px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillStyle='#d9dde4';g.fillText('债',0,.005);g.restore();
  }
  const A=Y.MarketArt={ themes:THEMES, prisonCuffs, prisonLegs,
    /** 背部先画：碳翼 → 纳米浮板 → 粒子加速器 → 火箭翼与引擎。 */
    back(g,P,look,p,o){
      const tier=look.marketTier,t=THEMES[tier];if(!t)return;
      const time=o.time||0,boost=!p.onGround || Math.abs(p.vx||0)>2.5;
      g.save();g.translate(P.H[0]-.13,P.H[1]+.34);g.rotate(-P.lean*.65);
      if(tier===3){
        plate(g,[[-.1,-.22],[-.34,-.02],[-.44,.43],[-.3,.35],[-.13,.08]],metal(g,-.4,0,0,.3,t),t.light);
        line(g,[[-.3,.3],[-.25,.02],[-.16,-.12]],t.hot,.018);
        core(g,-.19,.03,.07,t,time);
      }else if(tier===4){
        for(const sign of[-1,1]){g.save();g.globalAlpha=.6;plate(g,hex(-.35,.2+sign*.33,.21,Math.PI/6),'#aaffdc12',t.light,.022);g.restore();}
        for(let i=0;i<3;i++){
          const y=.32-i*.17,shift=Math.sin(time*2+i)*.02;
          plate(g,[[-.13,y+.04],[-.38-shift,y+.13],[-.48-shift,y-.02],[-.26,y-.1]],t.metal,t.light);
          line(g,[[-.25,y+.035],[-.37-shift,y+.06],[-.39-shift,y]],t.hot,.021);
        }
        core(g,-.18,.04,.1,t,time);
      }else if(tier===5){
        const x=-.34,y=.12;
        glow(g,x,y,.44,t.rgb);
        ellipse(g,x,y,.33,.43,t.dark,.075);
        ellipse(g,x,y,.33,.43,t.plate,.033);
        ellipse(g,x,y,.27,.36,t.light,.018,.25);
        ellipse(g,x,y,.56,.19,t.hot,.018,time*.8);
        core(g,x,y,.12,t,time);
        for(let i=0;i<3;i++){
          const a=time*.9+i*TAU/3,xx=x+Math.cos(a)*.48,yy=y+Math.sin(a)*.56;
          plate(g,hex(xx,yy,.062,a),t.dark,t.hot,.014);disk(g,xx,yy,.022,t.light);
        }
        plate(g,[[-.14,-.22],[-.43,-.33],[-.48,-.45],[-.18,-.33]],t.plate,t.light);
      }else{
        // 两片折线机翼与两只分层金属引擎；不是贴在背上的矩形图标。
        plate(g,[[-.12,.26],[-.37,.64],[-.88,.68],[-.66,.39],[-.39,.18],[-.3,-.14]],metal(g,-.8,.5,-.2,.2,t),t.plate,.016);
        plate(g,[[-.34,.44],[-.73,.6],[-.63,.43],[-.4,.28]],t.dark,t.light,.018);
        line(g,[[-.82,.65],[-.46,.56],[-.27,.25]],t.light,.026);
        plate(g,[[-.18,-.08],[-.6,-.2],[-.75,-.47],[-.47,-.33],[-.18,-.29]],t.metal,t.light);
        for(let i=0;i<2;i++){
          g.save();g.translate(-.26-i*.25,.12-i*.12);g.rotate(-.14-i*.12);
          plate(g,[[-.12,-.24],[-.14,.22],[-.075,.39],[.04,.39],[.12,.23],[.1,-.24]],metal(g,-.15,0,.12,0,t),t.dark,.024);
          plate(g,[[-.14,.23],[-.07,.4],[.035,.4],[.12,.23]],t.plate,t.light,.014);
          plate(g,[[-.09,-.23],[-.12,-.31],[.11,-.31],[.08,-.23]],t.dark,t.light,.019);
          for(let j=0;j<3;j++)line(g,[[-.08,-.08+j*.07],[.06,-.08+j*.07]],t.hot,.018);
          line(g,[[-.11,.18],[-.11,-.12]],t.light,.012);
          flame(g,0,-.32,.084,boost?.53:.28,t,time+i);
          g.restore();
        }
        core(g,-.1,.16,.1,t,time);
      }
      g.restore();
    },
    /** 胸甲与肩部接合骨骼，保留脸和发型。 */
    torso(g,P,look){
      const tier=look.marketTier,t=THEMES[tier];if(!t)return;
      g.save();g.translate(...P.H);g.rotate(-P.lean);
      if(tier===3){
        line(g,[[-.15,.48],[.12,.03]],t.dark,.09);line(g,[[-.15,.48],[.12,.03]],t.light,.025);
        plate(g,[[-.15,.5],[-.26,.54],[-.22,.65],[-.09,.57]],t.plate,t.light,.014);
        plate(g,[[.05,.16],[.22,.19],[.19,-.02],[.08,-.06]],t.metal,t.light,.014);
        core(g,-.04,.29,.06,t,0);g.restore();return;
      }
      const width=tier===4?.29:tier===5?.18:.25;
      plate(g,[[-width,0],[-width-.025,.35],[-.16,.52],[.15,.53],[width+.02,.34],[width,.02],[.06,-.06]],metal(g,-width,.5,width,0,t),t.dark,.02);
      plate(g,[[-width,.34],[-.12,.47],[.15,.47],[width,.34],[.05,.24],[-.08,.25]],t.plate,t.light,.013);
      plate(g,[[-.12,.25],[.1,.25],[.14,.07],[.05,.01],[-.14,.06]],t.dark,t.metal,.018);
      for(let i=0;i<3;i++)line(g,[[-.12,.05+i*.06],[.04,.025+i*.06],[.12,.06+i*.06]],t.light,.009);
      core(g,.015,.345,tier>=5?.085:.065,t,0);
      if(tier>=4){
        plate(g,[[-.2,.45],[-.3,.53],[-.27,.67],[-.1,.6],[-.05,.49]],t.metal,t.light,.017);
        line(g,[[-.24,.56],[-.13,.55]],t.hot,.022);
      }
      g.restore();
    },
    limb(g,from,to,look,kind){
      const tier=look.marketTier,t=THEMES[tier];if(!t)return;
      const dx=to[0]-from[0],dy=to[1]-from[1],L=Math.hypot(dx,dy);
      g.save();g.translate(...from);g.rotate(Math.atan2(dy,dx));
      const w=kind==='shin'?(tier===4?.095:.065):kind==='shoulder'?(tier===3?.055:tier===4?.155:.115):tier===4?.085:.06;
      const end=kind==='shoulder'?Math.min(L,.18):L*.83,start=kind==='shoulder'?-.045:L*.13;
      plate(g,[[start,-w],[end-.025,-w*.78],[end+.035,-w*.4],[end,.055],[start+.02,w],[start-.03,w*.5]],metal(g,0,-w,0,w,t),t.dark,.016);
      line(g,[[start+.018,-w*.7],[end-.015,-w*.55],[end,.002]],t.light,.016);
      if(tier>=4){plate(g,[[start,w*.45],[end*.7,w*.45],[end*.55,w+.045],[start+.02,w+.015]],t.plate,t.light,.008);}
      if(kind!=='shoulder'){disk(g,start+.04,0,.025,t.dark);disk(g,start+.04,0,.012,t.hot);}
      g.restore();
    },
    shoe(g,look,time=0,air=false){
      const tier=look.marketTier,t=THEMES[tier];if(!t)return;
      plate(g,[[-.12,-.03],[-.12,.1],[-.06,.18],[.04,.15],[.09,.055],[.22,.03],[.24,-.035],[.15,-.065],[-.12,-.065]],metal(g,-.1,.12,.18,-.04,t),t.dark,.015);
      plate(g,[[-.11,.015],[.015,.05],[.1,.015],[.21,.01],[.21,-.015],[-.11,-.02]],t.dark,t.light,.012);
      line(g,[[-.115,-.045],[.17,-.045],[.22,-.025]],t.hot,.018);
      for(let i=0;i<3;i++)line(g,[[.01+i*.035,.04],[.03+i*.035,.015]],t.plate,.012);
      if(tier===4){plate(g,[[-.1,.1],[-.12,.28],[.04,.31],[.1,.09]],t.metal,t.light,.016);ellipse(g,.03,-.09,.23,.035,t.light,.016);}
      if(tier>=4){ellipse(g,-.07,.015,.042,.042,t.light,.013);disk(g,-.07,.015,.017,t.hot);}
      if(tier===5){ellipse(g,.03,-.085,.19,.025,t.light,.013);}
      if(tier===6){
        plate(g,[[-.14,.07],[-.25,.035],[-.24,-.05],[-.12,-.05]],t.metal,t.light);
        g.save();g.translate(-.24,-.015);g.rotate(-Math.PI/2);flame(g,0,0,.035,air?.19:.09,t,time);g.restore();
      }
    },
    /** 拍头中心不变，围绕真实接触点绘制能量武器轮廓。 */
    racket(g,P,look,o){
      const tier=look.marketTier,t=THEMES[tier];if(!t)return false;
      const time=o.time||0,center=Y.racketHead(P),pulse=1+(o.glow||0)*.3;
      g.save();g.translate(...P.W);g.rotate(P.Rk);
      line(g,[[0,0],[.14,0]],t.dark,.055);line(g,[[.12,0],[.38*(P.rs||1),0]],t.plate,.035);
      line(g,[[.14,.013],[.38*(P.rs||1),.013]],t.light,.014);
      for(let i=0;i<3;i++)line(g,[[.02+i*.035,-.028],[.04+i*.035,.025]],t.light,.009);
      g.restore();g.save();g.translate(...center);g.rotate(P.Rk);g.scale(1,P.face||1);
      A.weaponFace(g,look,time,pulse);
      g.restore();return true;
    },
    weaponFace(g,look,time=0,pulse=1){
      const tier=look.marketTier,t=THEMES[tier];if(!t)return;
      glow(g,0,0,.36*pulse,t.rgb);
      if(tier===3){
        // A long asymmetrical carbon edge, visibly unlike the shield and rings.
        plate(g,[[-.3,-.045],[.36,-.02],[.18,.13],[-.19,.16],[-.31,.08]],t.dark,t.plate,.022);
        plate(g,[[-.26,-.04],[.36,-.02],[.13,-.105],[-.18,-.08]],t.light,t.hot,.014);
        line(g,[[-.2,.08],[.1,.07],[.25,0]],t.hot,.018);
      }else if(tier===4){
        plate(g,hex(0,0,.3,Math.PI/6),t.metal,t.plate,.032);
        plate(g,hex(0,0,.23,Math.PI/6),t.dark,t.light,.018);
        for(let i=0;i<6;i++){const a=i*TAU/6;plate(g,hex(Math.cos(a)*.15,Math.sin(a)*.15,.067,Math.PI/6),t.metal,t.light,.009);}
        core(g,0,0,.07,t,time);ellipse(g,0,0,.33,.33,t.light,.012,0,time,time+TAU*.65);
      }else if(tier===5){
        ellipse(g,0,0,.29,.29,t.plate,.035);ellipse(g,0,0,.22,.22,t.light,.018);
        ellipse(g,0,0,.34,.13,t.hot,.014,time*.85);
        for(let i=0;i<3;i++){const a=time*1.4+i*TAU/3,x=Math.cos(a)*.3,y=Math.sin(a)*.3;plate(g,hex(x,y,.06,a),t.dark,t.hot,.013);disk(g,x,y,.02,t.light);}
        line(g,[[-.22,0],[.22,0]],t.light,.014);core(g,0,0,.05,t,time);
      }else{
        plate(g,[[-.32,-.1],[.14,-.16],[.43,0],[.14,.16],[-.32,.1],[-.22,0]],metal(g,-.3,0,.4,0,t),t.plate,.024);
        plate(g,[[-.12,-.07],[.31,0],[-.12,.07],[0,0]],t.light,t.hot,.014);
        for(const sign of[-1,1])plate(g,[[-.12,sign*.13],[-.34,sign*.28],[-.34,sign*.1],[.12,sign*.08]],t.metal,t.light,.018);
        g.save();g.translate(-.25,0);g.rotate(-Math.PI/2);flame(g,0,0,.06,.27,t,time);g.restore();
      }
    },
    visor(g,P,look){
      const tier=look.marketTier,t=THEMES[tier];if(!t)return;
      g.save();g.translate(...P.hd);
      plate(g,[[-.03,.035],[.13,.025],[.145,-.015],[.02,-.026],[-.04,-.005]],t.dark,t.light,.009);
      line(g,[[.02,.014],[.118,.008]],t.hot,.015);
      disk(g,-.056,-.005,.04,t.metal);disk(g,-.056,-.005,.019,t.light);
      if(tier>=5){line(g,[[-.08,.01],[-.1,.12],[-.07,.18]],t.plate,.018);disk(g,-.07,.18,.016,t.hot);}
      g.restore();
    },
  };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof window !== 'undefined' ? window : globalThis);
