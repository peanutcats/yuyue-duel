/* Character art direction and reusable canvas details. Display only. */
(function(G){
  'use strict';
  const Y=G.YY,TAU=Math.PI*2,{clamp,lerp}=Y;
  const rows=[
    ['凌风','wing',.94,.92,1.04,.97,-.018,'knee'],
    ['沧澜','wave',.91,.84,.96,1.01,-.008,'sash'],
    ['小红','prism',.98,.91,1,1.01,-.01,'ruler'],
    ['冉冉','bow',.88,.84,.94,1.04,.014,'bow'],
    ['王瑞','bun',1.17,1.24,1.12,1.06,.025,'apron'],
    ['星星','star',.89,.86,.92,1.02,.006,'star'],
    ['丁丁','gear',.94,.9,.92,1.02,-.016,'tool'],
    ['猴子','cloud',1.13,1.2,1.08,.88,.035,'wrap'],
    ['路先森','bracket',1.1,1.12,1.03,1.04,.018,'plaid'],
    ['老陈','grid',.88,.83,.9,.98,.007,'badge'],
    ['果哥','coin',1.3,1.04,1.34,.98,.008,'tank'],
    ['田楚','crescent',.97,.88,.95,.99,-.02,'split'],
    ['朱老师','court',.95,1,.94,.98,.024,'whistle'],
    ['波波','fossil',1.04,1.05,1.02,1.03,.016,'field'],
    ['苗苗','swallow',1.1,.94,1.16,.99,-.022,'tape'],
    ['马哥','tie',1.02,.99,.98,1,.018,'office'],
    ['老南','shutter',.98,.97,.96,.99,.014,'coat'],
    ['朱朱','brush',.94,.80,.92,.94,-.025,'silk'],
    ['孙大帅','basket',1.25,1.5,1.2,1.08,.022,'jersey'],
    ['董总','server',1.05,1.02,1.02,.99,.008,'circuit']
  ];
  const profiles=Object.fromEntries(rows.map(([name,motif,shoulder,waist,limb,head,lean,detail])=>[name,Object.freeze({name,motif,shoulder,waist,limb,head,lean,detail})]));
  // Authored character acting: no shared catalogue pose or identical smile.
  const actingRows={
    '凌风':['confident',-.10,.06, .30,-.26, 72,1.1,125,.55, .94,.86,.13],
    '沧澜':['serene',.08,-.06, .17,-.25, 18,.55,74,1.8, .94,.90,.08],
    '小红':['precise',-.06,.01, .21,-.18, 68,1.35,82,2.4, .94,.85,-.025],
    '冉冉':['playful',-.15,-.06, .31,-.12, 18,.55,136,.6, .96,.82,.19],
    '王瑞':['laugh',.06,.09, .28,-.30, 56,.9,78,1.8, 1.12,1.08,.22],
    '星星':['wonder',.13,-.05, .13,-.24, 76,.7,115,.35, .97,.85,.10],
    '丁丁':['curious',-.12,.02, .24,-.16, 32,1.15,78,2.25, .98,.92,.07],
    '猴子':['grin',-.08,.09, .39,-.29, 118,1.4,32,.7, 1.06,1.04,.20],
    '路先森':['wry',.08,.03, .26,-.18, -35,.8,60,2.1, 1.07,1.02,.11],
    '老陈':['calm',.03,-.02, .18,-.18, -28,.65,72,2.4, .92,.86,.035],
    '果哥':['bold',-.04,.08, .36,-.31, 126,1.45,105,1.7, 1.08,1.02,.14],
    '田楚':['mysterious',.12,-.04, .24,-.13, 5,.7,40,1.9, .92,.82,.04],
    '朱老师':['kind',-.04,.02, .20,-.20, 15,.6,45,1.2, 1.02,1.02,.12],
    '波波':['eager',-.11,.06, .27,-.24, 90,.65,62,1.45, 1.05,.98,.13],
    '苗苗':['focused',-.08,-.02, .37,-.29, 34,.85,128,1.2, .96,.88,.055],
    '马哥':['tired',.07,.04, .18,-.22, -42,.45,80,2.1, .98,.98,.035],
    '老南':['knowing',.05,-.025, .22,-.24, 16,.8,58,1.8, .98,1.04,.075],
    '朱朱':['smirk',-.12,-.08, .17,-.09, 30,.8,135,1.5, .91,.80,.10],
    '孙大帅':['laugh',-.04,.06, .39,-.32, 105,1.55,28,.65, 1.15,1.13,.22],
    '董总':['stern',.03,.03, .25,-.22, 12,1.15,68,2.2, 1.05,1.03,-.02]
  };
  const acting=look=>{const v=actingRows[look?.name]||actingRows['凌风'];return{expression:v[0],tilt:v[1],hip:v[2],front:v[3],back:v[4],arm:v.slice(5,9),faceW:v[9],jaw:v[10],smile:v[11]};};
  // A single soft silhouette across the joint: thigh/calf and biceps/forearm
  // have different volumes. No capsule end-caps or dark joint rings.
  function limb(g,a,j,b,widths,color,outline,lw=.008){
    const mix=(a,b,u)=>a.map((v,i)=>lerp(v,b[i],u));
    const normal=(a,b)=>{const x=b[0]-a[0],y=b[1]-a[1],n=Math.hypot(x,y)||1;return[-y/n,x/n];};
    const n1=normal(a,j),n2=normal(j,b),nm=normal(a,b);
    const centers=[a,mix(a,j,.38),mix(a,j,.82),j,mix(j,b,.32),mix(j,b,.72),b];
    const radii=[widths[0],widths[1],widths[2]*1.08,widths[2],widths[3],lerp(widths[3],widths[4],.65),widths[4]];
    const normals=[n1,n1,n1,nm,n2,n2,n2],pts=[];
    for(const sign of[1,-1])for(let k=0;k<centers.length;k++){const i=sign===1?k:centers.length-1-k;pts.push([centers[i][0]+normals[i][0]*radii[i]*sign,centers[i][1]+normals[i][1]*radii[i]*sign]);}
    const mid=mix(pts[pts.length-1],pts[0],.5);g.beginPath();g.moveTo(...mid);
    pts.forEach((q,i)=>{const next=mix(q,pts[(i+1)%pts.length],.5);g.quadraticCurveTo(...q,...next);});g.closePath();
    if(outline){const r=Math.max(...radii)*1.6,gr=g.createLinearGradient(j[0]-nm[0]*r,j[1]-nm[1]*r,j[0]+nm[0]*r,j[1]+nm[1]*r);gr.addColorStop(0,Y.shade(color,.83));gr.addColorStop(.38,color);gr.addColorStop(.75,Y.shade(color,1.1));gr.addColorStop(1,Y.shade(color,.96));g.fillStyle=gr;}else g.fillStyle=color;
    g.fill();if(outline){g.strokeStyle=outline;g.lineWidth=lw;g.stroke();}
  }
  function hand(g,e,w,look,grip=true){
    g.save();g.translate(...w);g.rotate(Math.atan2(w[1]-e[1],w[0]-e[0]));g.fillStyle=look.skin;g.strokeStyle=look.skin2;g.lineWidth=.006;
    if(typeof grip==='string'&&grip!=='grip'){
      // A loose palm, a greeting and a pointing finger share the existing
      // skin/outline treatment, without turning every empty hand into a fist.
      const open=grip==='wave'||grip==='open',point=grip==='point',support=grip==='support';
      g.beginPath();g.moveTo(-.026,-.025);g.quadraticCurveTo(.012,-.034,.042,-.022);
      g.quadraticCurveTo(.065,-.006,.045,.024);g.quadraticCurveTo(.012,.038,-.024,.025);g.closePath();g.fill();g.stroke();
      g.lineCap='round';
      const fingers=open?4:point?1:support?3:3;
      for(let i=0;i<fingers;i++){
        const y=-.019+i*.014,tip=point?.102:open?.085-Math.abs(i-1.5)*.009:support?.069:.066-i*.006;
        const spread=open?(i-1.5)*.015:.012;
        g.beginPath();g.moveTo(.029,y);g.quadraticCurveTo(.051,y+spread*.5,tip,y+spread);
        g.strokeStyle=look.skin2;g.lineWidth=.015;g.stroke();g.strokeStyle=look.skin;g.lineWidth=.010;g.stroke();
      }
      g.beginPath();g.moveTo(.003,.022);g.quadraticCurveTo(.018,.053,.041,.043);g.strokeStyle=look.skin2;g.lineWidth=.018;g.stroke();g.strokeStyle=look.skin;g.lineWidth=.012;g.stroke();
      g.restore();return;
    }
    g.beginPath();g.moveTo(-.025,-.027);g.quadraticCurveTo(.014,-.045,.046,-.022);g.quadraticCurveTo(.066,.01,.037,.036);g.lineTo(-.023,.028);g.closePath();g.fill();g.stroke();
    g.beginPath();g.moveTo(-.01,.018);g.quadraticCurveTo(.018,.057,.039,.028);g.stroke();
    if(grip){g.beginPath();g.moveTo(.023,-.025);g.lineTo(.025,.013);g.moveTo(.037,-.018);g.lineTo(.039,.009);g.stroke();}g.restore();
  }
  // Display acting only: one planted leg, a relaxed knee, and hands with a
  // purpose. Coordinates are local to the hip; rackets remain gameplay props.
  const displayStances={
    '凌风':{hip:.045,twist:-.10,lean:-.025,feet:[.12,-.25],knees:[.012,.075],hand:[.32,.91],racket:-1.12,free:[-.29,1.15],prop:'shuttle'},
    '沧澜':{hip:-.055,twist:.10,lean:.025,feet:[.25,-.14],knees:[-.045,-.008],hand:[.33,.96],racket:-.90,free:[-.28,1.22],prop:'shuttle'},
    '小红':{hip:-.025,twist:-.06,lean:.015,feet:[.21,-.13],knees:[.035,-.008],hand:[.08,1.20],racket:null,free:[-.14,1.05],prop:'plan',propOffset:[.065,.02],gesture:'point',freeFront:true},
    '冉冉':{hip:.065,twist:.14,lean:-.035,feet:[.13,-.19],knees:[.008,.085],hand:[.39,1.48],racket:null,free:[-.19,.98],prop:'none',gesture:'wave',freeGesture:'rest',freeFront:true},
    '王瑞':{hip:-.025,twist:-.06,lean:.025,feet:[.26,-.19],knees:[.035,-.005],hand:[.23,.98],racket:null,free:[-.35,1.20],prop:'bun',gesture:'rest',freeGesture:'support'},
    '星星':{hip:.045,twist:.09,lean:-.025,feet:[.13,-.16],knees:[.008,.065],hand:[.03,1.19],racket:null,free:[-.17,1.24],prop:'starball',gesture:'support',freeFront:true},
    '丁丁':{hip:-.035,twist:-.10,lean:.025,feet:[.23,-.15],knees:[.045,-.008],hand:[.18,1.58],racket:null,free:[-.27,1.05],prop:'tool',gesture:'point'},
    '猴子':{hip:.045,twist:-.08,lean:-.025,feet:[.13,-.31],knees:[.01,.065],hand:[.37,1.28],racket:1.10,free:[-.33,1.15],prop:'thumb'},
    '路先森':{hip:-.035,twist:.09,lean:.025,feet:[.24,-.14],knees:[.04,-.008],hand:[.07,1.21],racket:null,free:[-.14,1.06],prop:'tablet',propOffset:[.06,.025],gesture:'point',freeFront:true},
    '老陈':{hip:.015,twist:.04,lean:-.015,feet:[.12,-.20],knees:[.008,.035],hand:[.06,1.16],racket:null,free:[-.16,1.03],prop:'clipboard',propOffset:[.07,.025],gesture:'point',freeFront:true},
    '果哥':{hip:.015,twist:-.10,lean:-.01,feet:[.20,-.27],knees:[.012,.04],hand:[.23,1.00],racket:null,free:[-.37,1.24],prop:'thumb',gesture:'rest',freeFront:true},
    '田楚':{hip:.06,twist:.14,lean:-.035,feet:[.13,-.20],knees:[.005,.06],hand:[.30,.88],racket:-1.25,free:[-.18,.94],prop:'none',freeGesture:'rest',freeFront:true},
    '朱老师':{hip:-.025,twist:-.06,lean:.02,feet:[.23,-.15],knees:[.03,-.005],hand:[.39,1.22],racket:null,free:[-.27,1.28],prop:'whistle',gesture:'open'},
    '波波':{hip:-.035,twist:-.10,lean:.03,feet:[.22,-.15],knees:[.05,-.008],hand:[.04,1.14],racket:null,free:[-.16,1.04],prop:'fossil',propOffset:[.07,.025],gesture:'support',freeFront:true},
    '苗苗':{hip:.025,twist:-.10,lean:.035,crouch:.035,feet:[.22,-.29],knees:[.04,.045],hand:[.38,1.08],racket:.62,free:[-.29,1.12],prop:'shuttle'},
    '马哥':{hip:-.045,twist:.05,lean:.035,feet:[.22,-.14],knees:[.05,-.008],hand:[.22,.87],racket:null,free:[-.25,1.10],prop:'coffee',gesture:'relaxed'},
    '老南':{hip:.015,twist:.06,lean:-.015,feet:[.13,-.22],knees:[.008,.04],hand:[.14,1.22],racket:null,free:[-.12,1.16],prop:'camera',propOffset:[.11,.035],gesture:'grip',freeFront:true},
    '朱朱':{hip:.065,twist:.14,lean:-.04,feet:[.12,-.15],knees:[.008,.07],hand:[.23,1.01],racket:null,free:[-.25,1.10],prop:'scroll',gesture:'rest',freeFront:true},
    '孙大帅':{hip:.035,twist:-.08,lean:-.015,feet:[.19,-.29],knees:[.012,.05],hand:[.32,.90],racket:-1.03,free:[-.36,1.02],prop:'basket',freeGesture:'support'},
    '董总':{hip:-.025,twist:.05,lean:.02,feet:[.22,-.15],knees:[.025,-.008],hand:[.06,1.19],racket:null,free:[-.15,1.06],prop:'tablet',propOffset:[.07,.025],gesture:'point',freeFront:true}
  };
  function displayPose(p,time,look,base){
    const d=displayStances[look.name]||displayStances['凌风'],P={...base},t=time+rows.findIndex(r=>r[0]===look.name)*.37;
    for(const k of Object.keys(P))if(Array.isArray(P[k]))P[k]=P[k].slice();
    const breathe=Math.sin(t*1.9)*.005,sway=Math.sin(t*.9)*.004,hx=d.hip+sway,hy=.90+breathe-(d.crouch||0),dy=hy-.90;
    const roll=d.hip*.20,lean=d.lean,tw=d.twist;
    P.H=[hx,hy];P.H1=[hx+.063,hy+roll];P.H2=[hx-.063,hy-roll];
    P.F1=[d.feet[0],.015];P.F2=[d.feet[1],.045];
    // Knees follow the hip-to-ankle line. Only the unweighted leg softens;
    // the old outward IK offset made every idle character look mid-squat.
    const knee=(h,f,b)=>[lerp(h[0],f[0],.52)+b,lerp(h[1],f[1],.52)];
    P.K1=knee(P.H1,P.F1,d.knees[0]);P.K2=knee(P.H2,P.F2,d.knees[1]);
    const chest=hx+lean,shoulder=tw*.055;
    P.S=[chest+.155,hy+.49+shoulder];P.S2=[chest-.155,hy+.49-shoulder];
    P.N=[chest,hy+.585];P.hd=[chest-.012,hy+.785];
    const arm=(S,target,side)=>{
      let dx=target[0]-S[0],dy=target[1]-S[1],len=Math.hypot(dx,dy)||1,dst=clamp(len,.10,.535);dx/=len;dy/=len;
      const W=[S[0]+dx*dst,S[1]+dy*dst];
      // The resting forearm comes towards the viewer. Its projected length
      // shortens so a hand held at the waist does not force a flared elbow.
      const hanging=[S[0]+side*.07,S[1]-.27],lower=clamp(Math.hypot(W[0]-hanging[0],W[1]-hanging[1]),Math.max(.18,dst-.28+.005),.265);
      const along=(dst*dst+.28*.28-lower*lower)/(2*dst),bend=Math.sqrt(Math.max(0,.28*.28-along*along));
      const candidates=[-1,1].map(sign=>[S[0]+dx*along-dy*bend*sign,S[1]+dy*along+dx*bend*sign]);
      // Prefer the hanging elbow over the alternative that folds through the
      // chest; raised gestures still resolve through the full reachable arc.
      const cost=E=>Math.hypot(E[0]-hanging[0],E[1]-hanging[1])+2*Math.max(0,(S[0]-E[0])*side-.035);
      return {W,E:cost(candidates[0])<cost(candidates[1])?candidates[0]:candidates[1]};
    };
    const r=arm(P.S,[hx+d.hand[0],d.hand[1]+dy+Math.sin(t*1.2)*.004],1),l=arm(P.S2,[hx+d.free[0],d.free[1]+dy+Math.sin(t*.95)*.004],-1);
    P.W=r.W;P.E=r.E;P.W2=l.W;P.E2=l.E;
    P.showRacket=d.racket!==null;P.Rk=(d.racket??-.9)+Math.sin(t*1.2)*.012;P.rs=.92;
    P.handGesture=d.gesture||(P.showRacket?'grip':'relaxed');P.freeGesture=d.freeGesture||(d.prop==='none'?'relaxed':'grip');P.freeFront=!!d.freeFront;
    P.headTilt=-tw*.8;P.headTurn=tw*1.4;P.ux=(P.N[0]-P.H[0])/.56;P.uy=(P.N[1]-P.H[1])/.56;
    P.lean=lean;P.hipYaw=-tw*.4;P.chestYaw=tw*1.4;P.prop=d.prop;
    P.propAnchor=[P.W2[0]+(d.propOffset?.[0]||0),P.W2[1]+(d.propOffset?.[1]||0)];
    return P;
  }
  // The same visible silhouette drives exported art and the live collection.
  // Hidden rackets must not leave empty space or shrink a non-racket gesture.
  function displayBounds(P,headPad=.32){
    const pts=[],box=(q,x,y)=>pts.push([q[0]-x,q[1]-y],[q[0]+x,q[1]+y]);
    for(const key of ['H','K1','K2','S','S2','E','E2'])box(P[key],.11,.10);
    for(const key of ['W','W2'])box(P[key],.13,.13);
    for(const key of ['F1','F2'])box(P[key],.18,.10);
    box(P.hd,headPad,headPad);
    if(P.showRacket!==false)box(Y.racketHead(P),.23,.23);
    if(P.prop&&P.prop!=='none')box(P.propAnchor||P.W2,.22,.28);
    return {minX:Math.min(...pts.map(q=>q[0])),maxX:Math.max(...pts.map(q=>q[0])),minY:Math.min(...pts.map(q=>q[1])),maxY:Math.max(...pts.map(q=>q[1]))};
  }
  function showcaseAccessory(g,P,look,time){
    const type=P.prop;if(!type||type==='none')return;
    const [x,y]=P.propAnchor||P.W2;g.save();g.translate(x,y);g.scale(1,-1);g.lineWidth=.008;g.lineJoin='round';g.lineCap='round';
    const box=(x,y,w,h,fill,stroke='#26384e')=>{Y.rr(g,x,y,w,h,.014);g.fillStyle=fill;g.fill();g.strokeStyle=stroke;g.stroke();};
    if(['shuttle','starball'].includes(type)){
      g.save();g.translate(-.01,-.045);g.rotate(-.18+Math.sin(time)*.04);g.fillStyle='#f7f2df';g.strokeStyle='#bdcbd5';g.beginPath();g.moveTo(-.034,0);g.lineTo(-.085,-.14);g.quadraticCurveTo(0,-.17,.085,-.14);g.lineTo(.034,0);g.closePath();g.fill();g.stroke();for(let i=-2;i<=2;i++){g.beginPath();g.moveTo(i*.014,-.01);g.lineTo(i*.036,-.14);g.stroke();}g.fillStyle='#ddb87b';g.beginPath();g.ellipse(0,.01,.036,.028,0,0,TAU);g.fill();g.restore();
    }else if(type==='bun'){g.fillStyle='#f4dcb2';g.strokeStyle='#b68c61';g.beginPath();g.ellipse(0,-.055,.10,.065,0,0,TAU);g.fill();g.stroke();for(let i=-1;i<=1;i++){g.beginPath();g.moveTo(i*.05,-.04);g.quadraticCurveTo(i*.02,-.12,0,-.10);g.stroke();}}
    else if(type==='basket'){g.fillStyle='#e49a50';g.strokeStyle='#664130';g.beginPath();g.arc(-.015,-.045,.145,0,TAU);g.fill();g.stroke();for(let i of[-1,1]){g.beginPath();g.moveTo(-.15,-.045);g.quadraticCurveTo(-.015,-.045+i*.16,.13,-.045);g.stroke();}g.beginPath();g.moveTo(-.015,-.19);g.lineTo(-.015,.10);g.stroke();}
    else if(['plan','tablet','clipboard','fossil','scroll'].includes(type)){
      const paper=type==='plan'||type==='clipboard'||type==='scroll',fill=paper?'#f3e5c5':type==='fossil'?'#b9a27d':'#24475b';
      g.rotate(-.12);box(-.11,-.19,.20,.25,fill);if(type==='fossil'){emblem(g,'fossil',-.01,-.07,.075,'#6b5948');}else if(paper){g.strokeStyle='#b29a75';for(let i=0;i<4;i++){g.beginPath();g.moveTo(-.08,-.14+i*.044);g.lineTo(.055,-.14+i*.044);g.stroke();}if(type==='clipboard')box(-.04,-.21,.07,.035,'#566975');}else{box(-.087,-.167,.154,.19,'#a3c9d1');emblem(g,profile(look).motif,-.01,-.075,.053,'#437890');}}
    else if(type==='coffee'){box(-.055,-.14,.11,.15,'#f4e8cd');box(-.066,-.16,.132,.025,'#654d46');box(-.055,-.10,.11,.052,'#9a7761');}
    else if(type==='camera'){box(-.12,-.12,.24,.14,'#324351');box(-.08,-.155,.08,.04,'#465e6b');g.fillStyle='#a9c6cc';g.beginPath();g.arc(.015,-.05,.06,0,TAU);g.fill();g.fillStyle='#193348';g.beginPath();g.arc(.015,-.05,.044,0,TAU);g.fill();g.fillStyle='#d7f2ed';g.beginPath();g.arc(0,-.07,.014,0,TAU);g.fill();}
    else if(type==='ribbon'){emblem(g,'bow',0,-.065,.083,look.band);}
    else if(type==='tool'){g.strokeStyle='#c6d3dd';g.lineWidth=.025;g.beginPath();g.moveTo(0,.05);g.lineTo(.055,-.16);g.stroke();g.strokeStyle='#ecaf5b';g.lineWidth=.035;g.beginPath();g.moveTo(0,.05);g.lineTo(.021,-.03);g.stroke();}
    else if(type==='whistle'){box(-.035,-.055,.09,.05,'#e7c96d');g.strokeStyle='#ded1ac';g.lineWidth=.005;g.beginPath();g.moveTo(.02,-.05);g.quadraticCurveTo(.12,-.18,.16,-.11);g.stroke();}
    else if(type==='thumb'){g.strokeStyle=look.skin;g.lineWidth=.035;g.beginPath();g.moveTo(-.015,0);g.lineTo(-.025,-.09);g.stroke();}
    g.restore();
  }
  function head2D(g,P,look,o={}){const a=acting(look),spinning=Number.isFinite(P.spinAngle);g.save();g.translate(...P.hd);g.rotate((o.showcase?a.tilt+(P.headTilt||0)*.45:clamp(P.lean*.35,-.2,.2)));g.scale(.147,-.147);head(g,look,{back:spinning&&Math.cos(P.spinAngle)<-.15,turn:spinning?Math.sin(P.spinAngle)*.85:.22+(P.headTurn||0)*.5,time:o.time||0,focus:!!P.motion,gaze:clamp(o.gazeX||0,-1,1),expression:o.showcase?a.expression:undefined,mood:o.mood,quality:o.quality??1});g.restore();}
  const basic=Object.freeze({name:'球友',motif:'wing',shoulder:1,waist:1,limb:1,head:1,lean:0,detail:'jersey'});
  const profile=look=>profiles[look?.name]||basic;
  const motionRows={
    '凌风':[1.13,1.08,.92,.05,.08], '沧澜':[.88,.9,1.14,-.04,-.05],
    '小红':[.78,.78,.86,.01,-.10], '冉冉':[.87,.91,1.08,-.05,.12],
    '王瑞':[1.18,1.2,.85,.08,-.12], '星星':[.89,.84,1.18,-.08,.15],
    '丁丁':[.8,.92,.9,.025,-.07], '猴子':[1.24,1.12,1.2,.09,.16],
    '路先森':[.93,1.02,.92,.03,-.11], '老陈':[.72,.78,.88,-.015,-.15],
    '果哥':[1.26,1.25,.82,.07,-.06], '田楚':[1.08,.88,1.16,-.06,.09],
    '朱老师':[.75,.82,.9,.02,-.08], '波波':[1.12,1.14,1.1,.04,.13],
    '苗苗':[1.22,.9,1.25,-.07,.10], '马哥':[.82,1.04,.94,.08,-.04],
    '老南':[.76,.87,.89,-.025,-.13], '朱朱':[.86,.86,1.24,-.04,.18], '孙大帅':[1.23,1.24,1.05,.05,-.09], '董总':[.8,.94,.91,-.01,-.12]
  };
  const neutral={coil:1,stance:1,follow:1,lean:0,wrist:0};
  const motionFor=(p,look)=>{
    const owner=Y.CHARS?.find(c=>c.passive===p?.kit?.passive);
    const name=look?.name||(owner&&Y.lookOf?.(owner.id)?.name);
    const v=motionRows[name];return v?{coil:v[0],stance:v[1],follow:v[2],lean:v[3],wrist:v[4]}:neutral;
  };
  const families={
    reach:['shensuo','xuanpai','youyou','zipao','jieli','yueqiu'],
    sweep:['chaolai','huichao','fengkou','tongyin','hongxian','jiewang','tangqiu'],
    summon:['yueliang','xingmen','zhongli','haomao','fuzhi','jingxiang','zangshu'],
    place:['fanshe','pingyi','diban','baozi','jiepan','biaozhi','shuangji','jibei'],
    focus:['yati','tingyixia','jiezou','sanbu','yipai','jingmo','ganggan','qiquan','tongqin','gongwei','jiaban'],
    leap:['yuyue','tafeng','jindou','dangteng','yimo','weichui','dianbu','jieli_jump','bianpai']
  };
  // family, racket arm / elbow, free arm / elbow: authored release for every active skill.
  const gestures={
    feibai:['sweep',100,.5,138,.8],liubai:['sweep',-35,.75,130,1.45],luokuan:['place',-18,.55,82,.9],
    ouzhou:['leap',28,.85,112,.9],gongdan:['place',62,.4,72,.4],kongjie:['focus',95,1.3,110,1.2],
    lingxin:['place',45,.5,126,.65],kuorong:['summon',115,.45,55,.6],rongzai:['reach',22,.4,112,.9],
    yuyue:['leap',-20,.35,115,.3],tafeng:['leap',128,.6,65,.5],fengkou:['sweep',18,.7,90,.8],
    chaolai:['sweep',-18,.6,-35,.35],tongyin:['focus',65,1.1,65,1.1],huichao:['sweep',118,.8,-30,1.2],
    fanshe:['place',36,.7,118,.35],zipao:['reach',72,.45,94,.25],pingyi:['focus',12,.35,15,.45],
    tangqiu:['leap',-14,.7,148,.35],hongxian:['sweep',118,1.25,24,.6],jiewang:['reach',22,.5,145,1.4],
    diban:['sweep',138,.5,115,.35],huiguo:['sweep',-35,.9,55,1.1],baozi:['place',26,.3,-38,.8],
    yueliang:['summon',115,.5,145,.45],xingmen:['summon',65,.25,155,.25],zhongli:['focus',95,.55,100,.8],
    shensuo:['reach',28,.8,80,.7],xuanpai:['sweep',-25,.5,150,.6],youyou:['reach',8,.55,65,1.2],
    jindou:['leap',138,.7,145,.5],dangteng:['leap',45,.8,165,.2],haomao:['summon',65,1.8,35,.45],
    fuzhi:['summon',45,.3,145,.3],jieli:['reach',30,.35,125,.45],zangshu:['place',-18,.7,28,.55],
    yati:['focus',70,1.6,95,1.7],yueqiu:['place',-32,.45,35,1.1],shuangji:['place',-64,.65,132,.65],
    ganggan:['focus',75,.55,40,1.5],jiepan:['place',45,.4,135,.45],qiquan:['focus',22,1.4,118,.8],
    jingxiang:['summon',110,.6,65,.6],meida:['focus',58,1.4,120,1.4],shuizhong:['leap',-12,.6,130,.5],
    jiezou:['summon',102,.68,56,.42],biaozhi:['place',-55,.5,-18,.8],tingyixia:['focus',38,.55,126,.5],
    jibei:['place',-40,.6,35,1.2],yimo:['leap',35,.2,155,.2],weichui:['sweep',-28,.7,140,.5],
    dianbu:['leap',38,.9,115,.7],bianpai:['sweep',95,.6,150,.35],jieli_jump:['leap',128,.45,65,.3],
    tongqin:['focus',42,1.08,110,.62],gongwei:['place',82,.72,55,1.05],jiaban:['sweep',104,.64,118,.6],
    sanbu:['focus',75,1.6,95,1.65],yipai:['sweep',20,.65,130,.6],jingmo:['reach',18,.3,95,.65]
  };
  const family=id=>gestures[id]?.[0]||Object.keys(families).find(k=>families[k].includes(id))||'focus';
  // Every active has its own deterministic gesture; the family sets the intent.
  // Anticipation, release and recovery are separate poses, not a frozen arm pulse.
  function action(id,age){
    if(!id||age<0||age>=.62)return null;
    const u=age/.62,k=family(id),e=Math.sin(Math.PI*u)**1.2;
    const hash=[...id].reduce((n,c)=>n+c.charCodeAt(0),0),variant=(hash%11-5)/5;
    const office={tongqin:[42,1.08,110,.62],gongwei:[82,.72,55,1.05],jiaban:[104,.64,118,.6]}[id];
    const base=office||{reach:[32,1.05,75,.75],sweep:[10,.5,115,.7],summon:[125,.55,135,.35],place:[-20,.8,-35,1.05],focus:[65,1.4,82,1.15],leap:[100,.6,-15,.6]}[k];
    const ease=v=>{v=clamp(v,0,1);return v*v*(3-2*v);},release=ease((age-.08)/.15),recover=ease((age-.3)/.32);
    const arm=(gestures[id]?.slice(1)||base).map((v,i)=>v+(i%2?variant*.06:variant*4));
    if(office){
      if(id==='tongqin'){arm[0]=lerp(115,-12,release)*(1-recover)+42*recover;arm[1]=lerp(1.7,.3,release);arm[2]=105;arm[3]=.7;}
      if(id==='gongwei'){arm[0]=lerp(84,-8,release);arm[2]=lerp(96,142,release);arm[1]=.7;arm[3]=.65;}
      if(id==='jiaban'){arm[0]=lerp(72,-28,release);arm[2]=lerp(100,166,release);arm[1]=.75;arm[3]=.55;}
    }
    arm[0]+=lerp(-32,23,release)*(1-recover);arm[2]+=lerp(18,-24,release)*(1-recover);
    return {id,family:k,age,u,e,release,recover,variant,arm,
      lean:id==='liubai'?-.20:(k==='place'?.13:k==='reach'?.08:k==='summon'?-.07:variant*.04)*(release-.25),
      crouch:(k==='place'?.10:k==='leap'?.08:.025)*e,
      yaw:lerp(id==='liubai'?-.9:-.3,id==='liubai'?.75:.22,release)*(1-recover)*(k==='sweep'?1.8:.7),
      reach:lerp(-.13,.18,release)*(1-recover)};
  }
  function mechanical(m,p){
    const e=m?.ents?.find(e=>e.o===p.idx&&e.k==='pole');if(!e)return null;
    const age=e.strokeAt==null?-1:m.time-e.strokeAt;
    const punch=age<0?0:Math.sin(Math.PI*clamp(age/.30,0,1));
    const head=[e.x,e.y,e.z??p.z??0];
    if(e.impact){const u=clamp((m.time-e.impact.t)/.14,0,1),k=u*u*(3-2*u);head[0]=lerp(e.impact.x,head[0],k);head[1]=lerp(e.impact.y,head[1],k);head[2]=lerp(e.impact.z,head[2],k);}
    return {entity:e,head,punch,hold:e.ph===0?1:Math.max(0,1-(e.age||0)/4)};
  }
  // A small graphic on the shirt is readable at match scale and repeated on
  // the back. It is never a replacement for the character's original palette.
  function emblem(g,kind,x,y,r,color){
    g.save();g.translate(x,y);g.scale(r,r);g.strokeStyle=color;g.fillStyle=color;g.lineWidth=.12;g.lineCap='round';g.lineJoin='round';g.beginPath();
    if(kind==='brush'){g.moveTo(-.65,.9);g.quadraticCurveTo(.05,.8,.15,.14);g.lineTo(.8,-.8);g.lineTo(.56,-1);g.lineTo(-.1,-.02);g.quadraticCurveTo(-.65,.05,-.65,.9);g.fill();g.stroke();}
    else if(kind==='basket'){g.arc(0,0,.92,0,TAU);g.moveTo(-.92,0);g.lineTo(.92,0);g.moveTo(0,-.92);g.lineTo(0,.92);g.moveTo(-.65,-.65);g.quadraticCurveTo(.15,0,-.65,.65);g.moveTo(.65,-.65);g.quadraticCurveTo(-.15,0,.65,.65);g.stroke();}
    else if(kind==='server'){for(let i=0;i<3;i++){g.rect(-.85,-.95+i*.68,1.7,.48);g.moveTo(-.6,-.71+i*.68);g.lineTo(-.4,-.71+i*.68);}g.stroke();}
    else if(kind==='star'){for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,t=i%2?.42:1;g.lineTo(Math.cos(a)*t,Math.sin(a)*t);}g.closePath();g.fill();}
    else if(kind==='wave'||kind==='swallow'||kind==='wing'){for(let i=0;i<3;i++){g.moveTo(-1,-.5+i*.48);g.quadraticCurveTo(-.2,-.9+i*.5,.25,-.3+i*.4);g.lineTo(1,-.7+i*.4);}g.stroke();}
    else if(kind==='bow'){for(const s of[-1,1]){g.moveTo(0,0);g.bezierCurveTo(s*1.4,-1.5,s*1.4,1.4,0,0);}g.stroke();g.fillRect(-.16,-.2,.32,.4);}
    else if(kind==='bracket'){g.moveTo(-.4,-.85);g.lineTo(-1,-.85);g.lineTo(-1,.85);g.lineTo(-.4,.85);g.moveTo(.4,-.85);g.lineTo(1,-.85);g.lineTo(1,.85);g.lineTo(.4,.85);g.stroke();}
    else if(kind==='prism'){g.moveTo(0,-1);g.lineTo(1,.8);g.lineTo(-1,.8);g.closePath();g.stroke();g.moveTo(-1,.05);g.lineTo(1,.05);g.stroke();}
    else if(kind==='grid'||kind==='court'){g.rect(-.9,-.8,1.8,1.6);g.moveTo(-.9,0);g.lineTo(.9,0);g.moveTo(0,-.8);g.lineTo(0,.8);g.stroke();}
    else if(kind==='crescent'){g.arc(0,0,.9,.4,TAU-.4);g.stroke();g.moveTo(.55,-.55);g.lineTo(.55,.55);g.stroke();}
    else if(kind==='tie'){g.moveTo(0,-1);g.lineTo(.4,-.5);g.lineTo(.26,.65);g.lineTo(0,1);g.lineTo(-.26,.65);g.lineTo(-.4,-.5);g.closePath();g.fill();}
    else if(kind==='fossil'){g.moveTo(0,-1);g.lineTo(0,1);for(const s of[-1,1])for(let i=0;i<3;i++){g.moveTo(0,-.6+i*.6);g.quadraticCurveTo(s*.9,-.9+i*.6,s*.7,-.35+i*.6);}g.stroke();}
    else if(kind==='bun'||kind==='cloud'){g.ellipse(0,.2,1,.66,0,0,TAU);g.stroke();for(let i=-1;i<=1;i++){g.moveTo(i*.5,.25);g.quadraticCurveTo(i*.3,-.6,0,-.55);}g.stroke();}
    else{g.arc(0,0,.72,0,TAU);g.stroke();for(let i=0;i<6;i++){const a=i*TAU/6;g.moveTo(Math.cos(a)*.85,Math.sin(a)*.85);g.lineTo(Math.cos(a)*1.1,Math.sin(a)*1.1);}g.stroke();g.fillRect(-.1,-.28,.2,.56);}
    g.restore();
  }
  // Head texture in screen coordinates; orientation changes front/back, so a
  // near player's hair and a far player's face retain the same identity.
  // ---------- 头：动漫式分层画法 ----------
  // 顶骨骼固定，五官整体随 turn 平移；先画后发与颈部阴影，再画脸、刘海、
  // 眼（虹膜三层渐变 + 高光 + 睫毛线）、鼻唇与受光边。小尺寸下靠剪影与
  // 眼线保持辨识度，大尺寸（立绘、头像）再叠加发丝与高光带。
  const LONG_HAIR = new Set(['long','ponytail','twin','bangs','side','bun']);
  const SHORT_HAIR = new Set(['buzz','crew','receding']);
  function head(g,look,{back=false,turn=0,time=0,focus=false,gaze=0,quality=1,expression,mood}={}){
    const art=profile(look),act=acting(look),expr=expression||(['happy','cheer','smile'].includes(mood)?'laugh':focus?'focused':act.expression),hair=look.hair;
    const outline=look.outline||'#17202e',hairC=look.hairC,hairHi=look.hairHi||Y.shade(hairC,1.5),hairSh=Y.shade(hairC,.74);
    const sway=Math.sin(time*5.2)*.07+turn*.2,tx=turn*.15,blink=(time%4.7)>4.58;
    const smiling=['playful','laugh','grin','kind','eager'].includes(expr),narrow=['serene','precise','calm','mysterious','focused','knowing','smirk','stern','tired'].includes(expr);
    g.save();g.scale(act.faceW,1);if(look.identity==='basketball')g.scale(1.02,1);
    g.lineCap='round';g.lineJoin='round';g.lineWidth=.045;g.strokeStyle=outline;
    const skin=g.createLinearGradient(-1.1,-.9,.9,.9);
    skin.addColorStop(0,Y.shade(look.skin,1.06));skin.addColorStop(.45,look.skin);skin.addColorStop(1,look.skin2);
    // —— 后发：先铺体量，再压暗与受光 ——
    if(!SHORT_HAIR.has(hair)||hair==='receding'){
      g.fillStyle=hairC;
      if(hair==='twin'){for(const s of[-1,1]){g.beginPath();g.moveTo(s*.72,-.62);g.bezierCurveTo(s*1.34,-.72,s*1.5+sway,1.0,s*1.02+sway,1.6);g.bezierCurveTo(s*.9+sway,.72,s*.62,.36,s*.6,-.42);g.closePath();g.fill();g.stroke();}}
      else if(hair==='ponytail'){const s=back?-.5:-1;g.beginPath();g.moveTo(s*.7,-.62);g.bezierCurveTo(s*1.38,-.8,s*1.5+sway,1.0,s*1.0+sway,1.62);g.bezierCurveTo(s*.86+sway,.74,s*.62,.34,s*.58,-.4);g.closePath();g.fill();g.stroke();}
      else if(hair==='long'||hair==='bangs'||hair==='side'){for(const s of[-1,1]){g.beginPath();g.moveTo(s*.6,-.7);g.bezierCurveTo(s*1.28,-.72,s*1.3+sway,1.05,s*.86+sway,1.66);g.bezierCurveTo(s*.5+sway,.9,s*.5,.3,s*.46,-.5);g.closePath();g.fill();g.stroke();}}
      else {g.beginPath();g.moveTo(-1.02,-.1);g.bezierCurveTo(-1.14,-1.12,-.58,-1.36,0,-1.36);g.bezierCurveTo(.6,-1.36,1.14,-1.1,1.02,-.08);g.bezierCurveTo(.98,.42,.62,.66,0,.7);g.bezierCurveTo(-.62,.66,-.98,.42,-1.02,-.1);g.closePath();g.fill();g.stroke();}
      // 发尾受光/背光，避免整块死黑。
      g.fillStyle=Y.shade(hairC,1.22);
      if(['twin','ponytail','long','bangs','side'].includes(hair))for(const s of(hair==='twin'?[-1,1]:[-1])){g.save();g.globalAlpha*=.5;g.beginPath();g.moveTo(s*.66,-.4);g.bezierCurveTo(s*1.1+sway,.5,s*1.06+sway,1.1,s*.92+sway,1.5);g.bezierCurveTo(s*.8+sway,.8,s*.66,.2,s*.66,-.4);g.closePath();g.fill();g.restore();}
    }
    // —— 耳 ——
    for(const s of[-1,1]){g.fillStyle=Y.shade(look.skin,.97);g.beginPath();g.ellipse(s*.94,.06,look.bigEars?.26:.17,.28,s*.15,0,TAU);g.fill();g.stroke();g.fillStyle=Y.shade(look.skin2,.94);g.beginPath();g.ellipse(s*.96,.08,.06,.14,s*.15,0,TAU);g.fill();}
    // —— 脸 ——
    g.fillStyle=skin;g.beginPath();g.moveTo(-.98,-.26);
    g.bezierCurveTo(-1.05,-1.12,-.6,-1.26,.02,-1.26);g.bezierCurveTo(.66,-1.26,1.05,-1.1,.98,-.2);
    g.bezierCurveTo(.96,.2,.9,.44,.74,.66);
    g.bezierCurveTo(.58*act.jaw,.94,.28*act.jaw,1.07,.02,1.07);
    g.bezierCurveTo(-.3*act.jaw,1.06,-.6*act.jaw,.92,-.76,.64);
    g.bezierCurveTo(-.9,.42,-.97,.14,-.98,-.26);g.closePath();g.fill();g.stroke();
    if(!back){
      // 侧脸阴影：太阳穴到下颌的一条软阴影，给平涂皮肤体积。
      g.save();g.beginPath();g.moveTo(-.98,-.26);g.bezierCurveTo(-1.05,-1.12,-.6,-1.26,.02,-1.26);g.lineTo(.02,1.07);g.bezierCurveTo(-.3*act.jaw,1.06,-.6*act.jaw,.92,-.76,.64);g.bezierCurveTo(-.9,.42,-.97,.14,-.98,-.26);g.closePath();g.clip();
      g.fillStyle=Y.shade(look.skin2,.9);g.globalAlpha*=.42;g.beginPath();g.moveTo(-1.06,-.4);g.bezierCurveTo(-.8,-.1,-.72,.4,-.86,1.1);g.lineTo(-.34,1.2);g.bezierCurveTo(-.5,.5,-.5,.05,-.66,-.5);g.closePath();g.fill();g.restore();
    }
    if(hair==='receding'){
      for(const side of[-1,1]){g.fillStyle=hairC;g.beginPath();g.moveTo(side*.97,.34);g.bezierCurveTo(side*1.05,-.06,side*1.06,-.62,side*.84,-.8);g.lineTo(side*.77,-.24);g.lineTo(side*.85,.42);g.closePath();g.fill();g.strokeStyle=hairHi;g.lineWidth=.04;for(let i=0;i<4;i++){g.beginPath();g.moveTo(side*(.86+i*.026),-.32);g.lineTo(side*(.89+i*.02),.19);g.stroke();}}
      if(!back){g.strokeStyle=hairHi;g.lineWidth=.022;for(let i=0;i<3;i++){g.beginPath();g.moveTo(-.36+i*.15,-.88);g.quadraticCurveTo(-.18+i*.15,-1.15,.13+i*.12,-.9);g.stroke();}}
    }else if(back){
      g.fillStyle=hairC;g.beginPath();g.moveTo(-1.02,.1);g.bezierCurveTo(-1.1,-1.1,-.58,-1.34,0,-1.34);g.bezierCurveTo(.6,-1.34,1.12,-1.06,1.02,.12);g.bezierCurveTo(.98,.66,.55,.86,0,.9);g.bezierCurveTo(-.56,.86,-.98,.64,-1.02,.1);g.closePath();g.fill();g.stroke();
      g.strokeStyle=hairHi;g.lineWidth=.05;if(quality)for(const s of[-1,1])for(let i=0;i<3;i++){g.beginPath();g.moveTo(s*(.2+i*.22),-.9);g.quadraticCurveTo(s*(.28+i*.22)+sway*.3,.1,s*(.24+i*.22)+sway,.6);g.stroke();}
      g.strokeStyle=hairSh;g.lineWidth=.03;g.beginPath();g.moveTo(-.5,1.02);g.quadraticCurveTo(0,.72,.5,1.02);g.stroke();
    }else{
      // —— 刘海：从额顶铺到眉上，按发型分缕 ——
      const tips={
        spiky:[[-.95,.16],[-.78,-.34],[-.6,-.06],[-.34,-.46],[-.08,-.12],[.2,-.5],[.44,-.12],[.7,-.42],[.95,.14]],
        mess:[[-1,.18],[-.76,-.3],[-.5,-.02],[-.2,-.44],[.06,-.16],[.34,-.46],[.6,-.1],[.86,-.3],[1,.16]],
        quiff:[[-1.02,.2],[-.92,-.5],[-.62,-.78],[-.2,-.94],[.24,-.86],[.62,-.6],[.8,-.14],[.98,.18]],
        bowl:[[-1,.2],[-.86,-.16],[-.52,-.22],[-.16,-.28],[.2,-.28],[.54,-.22],[.86,-.16],[1,.2]],
        bangs:[[-1,.18],[-.82,-.2],[-.44,-.34],[-.06,-.36],[.3,-.32],[.68,-.26],[1,.16]],
        part:[[-1.02,.22],[-.86,-.22],[-.56,-.5],[-.2,-.6],[.1,-.5],[.42,-.62],[.72,-.36],[.98,.14]],
        side:[[-1.02,.2],[-.94,-.34],[-.66,-.64],[-.3,-.72],[.04,-.56],[.34,-.7],[.7,-.44],[1,.16]],
        long:[[-1.02,.18],[-.88,-.3],[-.6,-.66],[-.24,-.78],[.1,-.6],[.44,-.74],[.76,-.46],[1,.14]],
        ponytail:[[-1.02,.18],[-.88,-.32],[-.58,-.6],[-.22,-.66],[.12,-.5],[.46,-.66],[.78,-.4],[1,.16]],
        twin:[[-1.02,.18],[-.86,-.3],[-.56,-.62],[-.18,-.7],[.16,-.52],[.5,-.68],[.8,-.42],[1,.16]],
        gray:[[-1.02,.22],[-.86,-.24],[-.54,-.54],[-.16,-.62],[.16,-.5],[.5,-.64],[.78,-.34],[.99,.16]],
        crew:[[-1,.2],[-.9,-.24],[-.62,-.5],[-.28,-.6],[.08,-.56],[.44,-.56],[.78,-.36],[1,.16]],
        buzz:[[-1,.2],[-.92,-.18],[-.68,-.42],[-.36,-.5],[0,-.52],[.36,-.5],[.7,-.4],[1,.14]],
        receding:[[-1,.2],[-1,-.2],[-.86,-.5],[-.6,-.66],[-.34,-.6],[0,-.5],[.34,-.6],[.6,-.7],[.86,-.52],[1,-.16],[1,.18]],
      }[hair]||[[-1,.18],[-.8,-.26],[-.44,-.4],[-.06,-.42],[.32,-.36],[.68,-.28],[1,.16]];
      g.fillStyle=hairC;g.beginPath();
      g.moveTo(-1.03,.2);
      g.bezierCurveTo(-1.14,-1.08,-.6,-1.34,.02,-1.34);
      g.bezierCurveTo(.64,-1.34,1.14,-1.06,1.03,.2);
      for(let i=tips.length-1;i>=0;i--)g.lineTo(tips[i][0],tips[i][1]);
      g.closePath();g.fill();g.stroke();
      // 顶高光带：断成几段，像原画里的发丝反光。
      if(quality){g.save();g.strokeStyle=hairHi;g.lineWidth=.075;g.globalAlpha*=.85;g.beginPath();g.moveTo(-.72,-.74);g.bezierCurveTo(-.36,-1.02,.16,-1.06,.6,-.84);g.stroke();g.lineWidth=.04;for(const [x,y]of[[-.5,-.86],[-.12,-.95],[.28,-.92]]){g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+.06,y+.22,x+.02,y+.32);g.stroke();}g.restore();}
      // 侧鬓：压住脸缘，避免脸像贴上去的平面。
      g.fillStyle=hairC;for(const s of[-1,1]){g.beginPath();g.moveTo(s*1.0,-.34);g.quadraticCurveTo(s*.94,.3,s*.86,.5);g.quadraticCurveTo(s*.8,.2,s*.86,-.4);g.closePath();g.fill();}
    }
    if(hair==='spiky'||look.headband){g.strokeStyle=look.band;g.lineWidth=.19;g.beginPath();g.moveTo(-1.0,-.36);g.quadraticCurveTo(0,-.54,1.0,-.36);g.stroke();g.strokeStyle='#ffffff44';g.lineWidth=.03;g.beginPath();g.moveTo(-.9,-.42);g.quadraticCurveTo(0,-.58,.9,-.42);g.stroke();}
    if(!back){
      const ey=.1,dx=clamp(gaze+Math.sin(time*.65)*.18,-1,1)*.07;
      const starlight=look.identity==='basketball'||art.detail==='star';
      for(const sign of[-1,1]){
        const ex=sign*.42+tx,wink=expr==='playful'&&sign<0&&(time%6.5)>5.7,closed=blink||wink;
        const eh=narrow?.125:expr==='wonder'?.235:.185,ew=expr==='wonder'?.205:.19,ty=ey+act.hip*.02;
        // 眼白
        g.fillStyle='#fffdf6';g.beginPath();
        g.moveTo(ex-ew,ty+.02);g.quadraticCurveTo(ex-ew*.5,ty-eh*1.12,ex+ew*.42,ty-eh*.9);
        g.quadraticCurveTo(ex+ew*1.02,ty-eh*.5,ex+ew,ty+.02);
        if(closed){g.quadraticCurveTo(ex,ty+eh*.55,ex-ew,ty+.02);}else{g.quadraticCurveTo(ex+ew*.42,ty+eh*.92,ex-ew*.34,ty+eh*.8);g.quadraticCurveTo(ex-ew*.86,ty+eh*.46,ex-ew,ty+.02);}
        g.closePath();g.fill();
        if(!closed){
          // 虹膜：上深下浅 + 底部反光，缩小瞳孔后才像日系原画。
          const iris=g.createLinearGradient(0,ty-eh*.9,0,ty+eh*.85);
          iris.addColorStop(0,Y.shade(look.eye,.55));iris.addColorStop(.55,look.eye);iris.addColorStop(1,Y.shade(look.eye,1.75));
          g.save();g.clip();
          g.fillStyle=iris;g.beginPath();g.ellipse(ex+dx,ty+.01,ew*.52,eh*.92,0,0,TAU);g.fill();
          g.fillStyle='#101a26';g.beginPath();g.ellipse(ex+dx,ty-.01,ew*.21,eh*.5,0,0,TAU);g.fill();
          g.fillStyle=starlight?'#ffe9a8':'#dff6ff';g.globalAlpha*=.85;g.beginPath();g.ellipse(ex+dx,ty+eh*.55,ew*.4,eh*.26,0,0,TAU);g.fill();g.restore();
          // 两点高光：左上主光 + 右下小反射。
          g.fillStyle='#ffffff';g.beginPath();g.ellipse(ex+dx-ew*.16,ty-eh*.34,ew*.17,eh*.24,0,0,TAU);g.fill();
          g.globalAlpha*=.7;g.beginPath();g.arc(ex+dx+ew*.2,ty+eh*.3,ew*.07,0,TAU);g.fill();g.globalAlpha/=.7;
        }
        // 上睫毛：粗、外眼角上挑；闭眼时改成一条弧线。
        g.strokeStyle=outline;g.lineWidth=.055;g.beginPath();
        if(closed){g.moveTo(ex-ew*.95,ty+.04);g.quadraticCurveTo(ex,ty+eh*.5,ex+ew*.95,ty+.0);}
        else{g.moveTo(ex-ew*.98,ty+.03);g.quadraticCurveTo(ex-ew*.5,ty-eh*1.18,ex+ew*.44,ty-eh*.95);g.quadraticCurveTo(ex+ew*1.06,ty-eh*.62,ex+ew*1.02,ty-.02);}
        g.stroke();
        if(!closed){g.lineWidth=.03;g.strokeStyle=Y.shade(look.skin2,.86);g.beginPath();g.moveTo(ex-ew*.8,ty+eh*.78);g.quadraticCurveTo(ex+ew*.1,ty+eh*1.02,ex+ew*.86,ty+eh*.3);g.stroke();}
        // 眉：角度与粗细跟表情走。
        const slant=['stern','bold','confident','focused'].includes(expr)?sign*.09:expr==='curious'&&sign>0?-.12:expr==='wonder'?-.05:0;
        g.strokeStyle=look.brow?.16:.07;g.lineWidth=look.brow?.11:.06;
        g.beginPath();g.moveTo(ex-ew*.92,-.3-slant);g.quadraticCurveTo(ex,-.4-slant*.4,ex+ew*.92,-.28+slant);g.stroke();
      }
      // 鼻：一小块阴影 + 尖，不用写实鼻孔。
      g.strokeStyle=Y.shade(look.skin2,.92);g.lineWidth=.038;g.beginPath();g.moveTo(.04+tx*.3,.12);g.quadraticCurveTo(.075+tx*.3,.3,.13+tx*.3,.34);g.lineTo(-.012+tx*.3,.35);g.stroke();
      // 嘴：按表情换弧线与开合。
      const smile=focus?.02:act.smile+Math.sin(time*.8)*.012,my=.58,open=expr==='laugh'||expr==='grin';
      g.strokeStyle=outline;g.lineWidth=.038;g.beginPath();g.moveTo(-.2+tx*.4,my);
      if(open){g.quadraticCurveTo(.02+tx*.4,my+smile*.6,.23+tx*.4,my-((expr==='smirk'||expr==='wry')?.05:0));g.quadraticCurveTo(.03+tx*.4,my+.34,-.2+tx*.4,my);g.fillStyle='#7a3742';g.fill();g.fillStyle='#fff8ed';g.beginPath();g.moveTo(-.15+tx*.4,my+.015);g.lineTo(.17+tx*.4,my+.015);g.lineTo(.17+tx*.4,my+.06);g.lineTo(-.15+tx*.4,my+.06);g.fill();}
      else{g.quadraticCurveTo(.02+tx*.4,my+smile,.23+tx*.4,my-((expr==='smirk'||expr==='wry')?.05:0));}g.stroke();
      if(smiling||look.blush){g.fillStyle='#ef8d8a';g.globalAlpha*=.34+(look.blush||0)*.4;for(const sign of[-1,1]){g.beginPath();g.ellipse(sign*.62+tx*.2,.36,.17,.075,sign*.14,0,TAU);g.fill();}g.globalAlpha/=.34+(look.blush||0)*.4;}
      if(look.lip){g.strokeStyle=look.lip;g.lineWidth=.07;g.beginPath();g.moveTo(-.14+tx*.4,.6);g.quadraticCurveTo(.03+tx*.4,.66,.19+tx*.4,.59);g.stroke();}
      if(look.age){g.strokeStyle=Y.shade(look.skin2,.9);g.lineWidth=.028;g.beginPath();g.moveTo(-.74,.16);g.lineTo(-.86,.21);g.moveTo(.7,.16);g.lineTo(.82,.21);g.moveTo(-.24,.44);g.lineTo(-.3,.58);g.moveTo(.24,.44);g.lineTo(.3,.58);g.stroke();}
      if(look.glasses){
        g.strokeStyle=look.age?'#6e6153':'#1e2d38';g.lineWidth=.075;
        for(const s of[-1,1]){g.beginPath();if(look.glasses==='rect')Y.rr(g,s*.42+tx-.29,ey-.25,.58,.48,.09);else g.ellipse(s*.42+tx,ey,.29,.28,0,0,TAU);g.stroke();
          g.fillStyle='#bfe9ff';g.globalAlpha*=.16;g.fill();g.globalAlpha/=.16;}
        g.beginPath();g.moveTo(-.13+tx,ey-.03);g.quadraticCurveTo(0+tx,ey-.15,.13+tx,ey-.03);g.stroke();
        g.strokeStyle='#ffffffcc';g.lineWidth=.032;g.beginPath();g.moveTo(-.58+tx,ey-.13);g.lineTo(-.4+tx,ey-.22);g.moveTo(.26+tx,ey-.13);g.lineTo(.44+tx,ey-.22);g.stroke();
      }
    }else if(look.glasses){g.strokeStyle='#7c8d9c';g.lineWidth=.06;g.beginPath();g.moveTo(-.95,.1);g.lineTo(-.76,-.12);g.moveTo(.95,.1);g.lineTo(.76,-.12);g.stroke();}
    if(art.detail==='bow'){g.strokeStyle=look.band;g.lineWidth=.1;g.beginPath();g.moveTo(-.8,-.9);g.bezierCurveTo(-1.6,-.2,-1.2+sway,.8,-1.55+sway,1.4);g.stroke();g.fillStyle=look.band;g.strokeStyle=outline;g.lineWidth=.03;g.beginPath();g.moveTo(-.8,-.9);g.lineTo(-1.25,-1.3);g.lineTo(-1.3,-.68);g.closePath();g.fill();g.stroke();g.beginPath();g.moveTo(-.8,-.9);g.lineTo(-.42,-1.3);g.lineTo(-.35,-.68);g.closePath();g.fill();g.stroke();g.fillStyle='#ffffff55';g.beginPath();g.ellipse(-.8,-.88,.1,.1,0,0,TAU);g.fill();}
    if(look.hairpin){g.strokeStyle=look.trim;g.lineWidth=.08;g.beginPath();g.moveTo(-.92,-.66);g.lineTo(-.5,-1.16);g.stroke();g.fillStyle=look.trim;g.beginPath();g.arc(-.92,-.66,.1,0,TAU);g.fill();g.strokeStyle=outline;g.lineWidth=.02;g.stroke();}
    if(art.detail==='star'){g.fillStyle='#ffe69c';g.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,r=i%2?.06:.14;g.lineTo(.86+Math.cos(a)*r,-.38+Math.sin(a)*r);}g.closePath();g.fill();}
    // 受光边：右上方一条细亮线，头部从背景里脱出来。
    if(!back&&quality){g.strokeStyle=Y.shade(hairHi,1.15);g.globalAlpha*=.5;g.lineWidth=.045;g.beginPath();g.moveTo(.34,-1.3);g.bezierCurveTo(.86,-1.16,1.02,-.7,.99,-.2);g.stroke();g.globalAlpha/=.5;}
    g.restore();
  }
  function uniform2D(g,pt,look){
    const art=profile(look),line=(a,b,col,w)=>{g.strokeStyle=col;g.lineWidth=w;g.beginPath();g.moveTo(...pt(...a));g.lineTo(...pt(...b));g.stroke();};
    g.save();
    line([.16,-.075],[.46,-.12],Y.shade(look.shirt,.78),.008);
    line([.15,.13],[.25,.11],Y.shade(look.shirt,1.18),.007);
    line([.12,-.1],[.12,.1],Y.shade(look.shirt,1.12),.007);
    if(['sash','split','tape','wrap'].includes(art.detail)){
      line([.48,-.16],[.24,.16],look.panel,.032);
      line([.43,-.16],[.2,.16],look.trim,.009);
    }
    if(art.detail==='apron'){
      const a=pt(.43,-.1),b=pt(.43,.13),c=pt(.11,.17),d=pt(.11,-.09);
      pathUniform(g,[a,b,c,d]);g.fillStyle=look.panel;g.fill();g.strokeStyle=look.trim;g.lineWidth=.009;g.stroke();
      line([.26,-.04],[.25,.11],look.shirt2,.01);
    }
    if(['plaid','coat','field','office','tool','badge','circuit'].includes(art.detail)){
      for(const s of[-1,1])line([.53,s*.08],[.35,s*.025],look.trim,.012);
      line([.33,-.14],[.33,-.04],look.trim,.008);
      line([.33,-.14],[.22,-.14],look.trim,.008);
      line([.22,-.14],[.22,-.04],look.trim,.008);
      if(art.detail==='plaid')for(const u of[.2,.3,.4])line([u,-.18],[u,.18],look.panel,.006);
    }
    if(art.detail==='circuit'){
      for(const side of[-1,1]){line([.48,side*.13],[.27,side*.13],look.trim,.009);line([.27,side*.13],[.2,side*.07],look.trim,.009);}
    }
    if(art.detail==='bow'){line([.5,-.1],[.5,.1],look.trim,.018);const a=pt(.49,0);g.save();g.translate(...a);g.scale(.04,.04);emblem(g,'bow',0,0,1,look.shirt2);g.restore();}
    if(art.detail==='star'){for(const [u,v]of[[.26,-.04],[.37,.05],[.46,-.08]]){const q=pt(u,v);emblem(g,'star',...q,.017,look.trim);}line([.26,-.04],[.37,.05],look.trim,.005);line([.37,.05],[.46,-.08],look.trim,.005);}
    if(['tool','badge'].includes(art.detail)){line([.18,-.17],[.18,.17],look.shirt2,.032);for(const v of[-.09,-.04,.01])line([.14,v],[.27,v],look.trim,.014);}
    const c=pt(.4,.055);emblem(g,art.motif,...c,.042,look.trim);
    g.restore();
  }
  function pathUniform(g,points){g.beginPath();points.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.closePath();}
  function ribbon(g,a,b,time,width=4,color='#ee6497'){
    const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1,nx=-dy/length,ny=dx/length,points=[];
    for(let i=0;i<=24;i++){const u=i/24,wave=Math.sin(u*9-time*9)*Math.sin(Math.PI*u)*width*2.2,spread=width*(.35+.65*Math.abs(Math.cos(u*7-time*4)))*(1-u*.6);points.push({x:a[0]+dx*u+nx*wave,y:a[1]+dy*u+ny*wave,w:spread});}
    g.save();g.lineJoin='round';g.beginPath();points.forEach((p,i)=>i?g.lineTo(p.x+nx*p.w,p.y+ny*p.w):g.moveTo(p.x+nx*p.w,p.y+ny*p.w));for(const p of points.slice().reverse())g.lineTo(p.x-nx*p.w,p.y-ny*p.w);g.closePath();
    const gr=g.createLinearGradient(...a,...b);gr.addColorStop(0,'#b52c65');gr.addColorStop(.45,color);gr.addColorStop(.72,'#ffe5ef');gr.addColorStop(1,color);g.fillStyle=gr;g.fill();g.strokeStyle='#fff0f1aa';g.lineWidth=.7;g.stroke();g.restore();
  }
  function butterfly(g,x,y,size,time=0,color='#ff8fbf'){
    g.save();g.translate(x,y);g.rotate(Math.sin(time*3)*.12);g.scale(size,size);g.lineWidth=.055;g.strokeStyle='#ffe6ef';
    for(const sign of[-1,1]){g.fillStyle=color;g.beginPath();g.moveTo(0,0);g.bezierCurveTo(sign*.5,-1.05,sign*1.35,-.75,sign*.91,-.02);g.bezierCurveTo(sign*1.16,.65,sign*.35,.78,0,0);g.fill();g.stroke();g.strokeStyle='#a52b59';g.lineWidth=.035;g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(sign*.5,-.35,sign*.85,-.4);g.stroke();g.strokeStyle='#ffe6ef';g.fillStyle='#ffd6de';g.beginPath();g.moveTo(sign*.1,.1);g.quadraticCurveTo(sign*.4,.8,sign*.2,1.25);g.lineTo(sign*.5,1.1);g.lineTo(sign*.55,1.4);g.quadraticCurveTo(sign*.58,.65,sign*.2,.1);g.fill();}
    g.fillStyle='#fff1cc';g.beginPath();g.ellipse(0,0,.13,.21,0,0,TAU);g.fill();g.restore();
  }
  function flywheel(g,x,y,r,spin=0,phase=0,charge=0){
    g.save();g.translate(x,y);g.lineJoin='round';g.rotate(spin);g.lineWidth=Math.max(.8,r*.045);
    const open=phase===3?.68:phase===1?1:phase===2?.28:.65;
    for(let i=0;i<3;i++){g.save();g.rotate(i*TAU/3);g.fillStyle='#1b4e49';g.strokeStyle='#b1ecdb';g.beginPath();g.moveTo(r*.25,-r*.18);g.lineTo(r*(.7+open*.48),-r*(.28+open*.18));g.quadraticCurveTo(r*1.16,r*.12,r*.67,r*.32);g.lineTo(r*.22,r*.22);g.closePath();g.fill();g.stroke();g.strokeStyle='#e0b96f';g.lineWidth=r*.075;g.beginPath();g.moveTo(r*.37,-r*.06);g.lineTo(r*.88,-r*.17);g.stroke();g.fillStyle='#d3f8e3';g.beginPath();g.arc(r*.65,r*.1,r*.065,0,TAU);g.fill();g.restore();}
    g.fillStyle='#122f36';g.strokeStyle='#e4c281';g.lineWidth=r*.075;g.beginPath();for(let i=0;i<32;i++){const a=i*TAU/32,d=r*(i%4<2?.52:.44);g.lineTo(Math.cos(a)*d,Math.sin(a)*d);}g.closePath();g.fill();g.stroke();
    g.fillStyle=phase===3?'#ffe9a7':'#80efcc';g.beginPath();g.arc(0,0,r*.24,0,TAU);g.fill();g.strokeStyle='#f8ffec';g.lineWidth=r*.025;g.beginPath();g.arc(0,0,r*.32,0,TAU);g.stroke();g.rotate(-spin);
    if(phase===3){g.strokeStyle='#47665e';g.lineWidth=r*.11;g.beginPath();g.arc(0,0,r*1.35,0,TAU);g.stroke();g.strokeStyle='#ffdc85';g.beginPath();g.arc(0,0,r*1.35,-Math.PI/2+.12/.42*TAU,Math.PI*1.5);g.stroke();const a=-Math.PI/2+charge*TAU;g.fillStyle='#fff';g.beginPath();g.arc(Math.cos(a)*r*1.35,Math.sin(a)*r*1.35,r*.13,0,TAU);g.fill();}
    g.restore();
  }
  function burst(g,x,y,r,age,id,quality=1){
    const u=clamp(age/.65,0,1),mechanical=id==='youyou';g.save();g.globalAlpha*=1-u;g.strokeStyle=mechanical?'#ffdda0':'#ffc1d9';g.lineWidth=1.2;
    g.beginPath();g.ellipse(x,y,r*(.3+u),r*(.12+u*.35),-.2,0,TAU);g.stroke();
    for(let i=0;i<(quality?7:3);i++){const a=i*2.399+u*.6,rr=r*(.2+u)*(.7+(i%3)*.14),xx=x+Math.cos(a)*rr,yy=y+Math.sin(a)*rr*.55-u*r*.3;
      if(mechanical){g.save();g.translate(xx,yy);g.rotate(a+u*3);g.fillStyle=i%2?'#91f3cc':'#ffe2a0';g.fillRect(-r*.025,-r*.07,r*.05,r*.14);g.restore();}else butterfly(g,xx,yy,r*.075*(1-u*.5),age+i,'#ee80aa');
    }g.restore();
  }
  Y.CharacterArt={profiles,profile,emblem,head,head2D,ribbon,butterfly,flywheel,burst,limb,hand,acting,displayPose,action,family,uniform2D,motionFor,mechanical,gestures,displayStances,displayBounds,showcaseAccessory};
})(typeof GameGlobal!=='undefined'?GameGlobal:typeof window!=='undefined'?window:globalThis);
