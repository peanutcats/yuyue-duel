/* Character art direction and reusable canvas details. Display only. */
(function(G){
  'use strict';
  const Y=G.YY,TAU=Math.PI*2,{clamp,lerp}=Y;
  // SVG path data is the source of truth for Canvas, WeChat and SVG exports.
  // Replay commands directly: wx does not need Path2D or SVG image decoding.
  const vectorPaths=new Map(),pathArgs={M:2,L:2,C:6,Q:4,Z:0};
  function vectorPath(g,d,fill,stroke=null,width=.035){
    let steps=vectorPaths.get(d);
    if(!steps){
      const tokens=d.match(/[MLCQZ]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g)||[];steps=[];
      for(let i=0;i<tokens.length;){const cmd=tokens[i++],n=pathArgs[cmd];if(n==null)throw Error('Invalid character SVG command: '+cmd);steps.push([cmd,...tokens.slice(i,i+n).map(Number)]);i+=n;}
      if(vectorPaths.size>4096)vectorPaths.clear();vectorPaths.set(d,steps);
    }
    g.beginPath();for(const [cmd,...v]of steps){if(cmd==='M')g.moveTo(...v);else if(cmd==='L')g.lineTo(...v);else if(cmd==='C')g.bezierCurveTo(...v);else if(cmd==='Q')g.quadraticCurveTo(...v);else g.closePath();}
    if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke();}
  }
  function oval(g,x,y,rx,ry,fill,stroke=null,width=.035){g.beginPath();g.ellipse(x,y,rx,ry,0,0,TAU);if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke();}}
  const style=Object.freeze({revision:'face-foot-20261114',head2D:.166,head3D:.166,headLift:.018,headBounds:.39,outline:2.6,seam:1.5,fold:1.1,targetHeads:4.98});
  // Width belongs to the whole head, so hair, ears, eyes and glasses keep
  // their alignment when moving from full cheeks to a tapered adult face.
  const faceWidths={'凌风':.86,'沧澜':.83,'小红':.85,'冉冉':.86,'磐岩':.93,'星星':.84,'丁丁':.85,'猴子':.90,'路先森':.90,'老陈':.87,'果哥':.91,'田楚':.84,'静川':.89,'波波':.88,'苗苗':.85,'逐晨':.87,'老南':.87,'朱朱':.79,'腾岳':.94,'云衡':.89,'小学生':.89};
  const headScale=look=>Math.max(.96,Math.min(1.12,1+((look.headScale||1)-1)*.35));
  const brushGrip=Object.freeze({x:.028,y:-.003,tilt:-.12,butt:-.21,tip:.39});
  function brushEnds(P){
    const angle=Math.atan2(P.W[1]-P.E[1],P.W[0]-P.E[0]),c=Math.cos(angle),s=Math.sin(angle);
    const x=P.W[0]+c*brushGrip.x-s*brushGrip.y,y=P.W[1]+s*brushGrip.x+c*brushGrip.y;
    return [brushGrip.butt,brushGrip.tip].map(t=>[x+Math.cos(angle+brushGrip.tilt)*t,y+Math.sin(angle+brushGrip.tilt)*t]);
  }
  const rows=[
    ['凌风','wing',.94,.92,1.04,.97,-.018,'knee'],
    ['沧澜','wave',.91,.84,.96,1.01,-.008,'sash'],
    ['小红','prism',.98,.91,1,1.01,-.01,'ruler'],
    ['冉冉','bow',.88,.84,.94,1.04,.014,'bow'],
    ['磐岩','bun',1.17,1.24,1.12,1.06,.025,'apron'],
    ['星星','star',.89,.86,.92,1.02,.006,'star'],
    ['丁丁','gear',.94,.9,.92,1.02,-.016,'tool'],
    ['猴子','cloud',1.13,1.2,1.08,.88,.035,'wrap'],
    ['路先森','bracket',1.1,1.12,1.03,1.04,.018,'plaid'],
    ['老陈','grid',.88,.83,.9,.98,.007,'badge'],
    ['果哥','coin',1.3,1.04,1.34,.98,.008,'tank'],
    ['田楚','crescent',.97,.88,.95,.99,-.02,'split'],
    ['静川','court',.95,1,.94,.98,.024,'whistle'],
    ['波波','fossil',1.04,1.05,1.02,1.03,.016,'field'],
    ['苗苗','swallow',1.1,.94,1.16,.99,-.022,'tape'],
    ['逐晨','tie',1.02,.99,.98,1,.018,'office'],
    ['老南','shutter',.98,.97,.96,.99,.014,'coat'],
    ['朱朱','brush',.94,.80,.92,.94,-.025,'silk'],
    ['腾岳','basket',1.25,1.5,1.2,1.08,.022,'jersey'],
    ['云衡','server',1.05,1.02,1.02,.99,.008,'circuit'],
    ['小学生','bell',.84,.94,.85,1.10,-.025,'school'],
  ];
  const profiles=Object.fromEntries(rows.map(([name,motif,shoulder,waist,limb,head,lean,detail])=>[name,Object.freeze({name,motif,shoulder,waist,limb,head,lean,detail})]));
  // Authored character acting: no shared catalogue pose or identical smile.
  const actingRows={
    '小学生':['playful',-.16,.05,.29,-.20,90,1.1,125,.8,1.04,.94,.2],
    '凌风':['confident',-.10,.06, .30,-.26, 72,1.1,125,.55, .94,.86,.13],
    '沧澜':['serene',.08,-.06, .17,-.25, 18,.55,74,1.8, .94,.90,.08],
    '小红':['precise',-.06,.01, .21,-.18, 68,1.35,82,2.4, .94,.85,-.025],
    '冉冉':['playful',-.15,-.06, .31,-.12, 18,.55,136,.6, .96,.82,.19],
    '磐岩':['laugh',.06,.09, .28,-.30, 56,.9,78,1.8, 1.12,1.08,.22],
    '星星':['wonder',.13,-.05, .13,-.24, 76,.7,115,.35, .97,.85,.10],
    '丁丁':['curious',-.12,.02, .24,-.16, 32,1.15,78,2.25, .98,.92,.07],
    '猴子':['grin',-.08,.09, .39,-.29, 118,1.4,32,.7, 1.06,1.04,.20],
    '路先森':['wry',.08,.03, .26,-.18, -35,.8,60,2.1, 1.07,1.02,.11],
    '老陈':['calm',.03,-.02, .18,-.18, -28,.65,72,2.4, .92,.86,.035],
    '果哥':['bold',-.04,.08, .36,-.31, 126,1.45,105,1.7, 1.08,1.02,.14],
    '田楚':['mysterious',.12,-.04, .24,-.13, 5,.7,40,1.9, .92,.82,.04],
    '静川':['kind',-.04,.02, .20,-.20, 15,.6,45,1.2, 1.02,1.02,.12],
    '波波':['eager',-.11,.06, .27,-.24, 90,.65,62,1.45, 1.05,.98,.13],
    '苗苗':['focused',-.08,-.02, .37,-.29, 34,.85,128,1.2, .96,.88,.055],
    '逐晨':['tired',.07,.04, .18,-.22, -42,.45,80,2.1, .98,.98,.035],
    '老南':['knowing',.05,-.025, .22,-.24, 16,.8,58,1.8, .98,1.04,.075],
    '朱朱':['smirk',-.12,-.08, .17,-.09, 30,.8,135,1.5, .91,.80,.10],
    '腾岳':['laugh',-.04,.06, .39,-.32, 105,1.55,28,.65, 1.15,1.13,.22],
    '云衡':['stern',.03,.03, .25,-.22, 12,1.15,68,2.2, 1.05,1.03,-.02]
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
  // One closed outline per hand. Finger creases stay inside the silhouette.
  // The brush and fingers share this wrist transform and the same grip point.
  function hand(g,e,w,look,grip=true){
    const angle=typeof grip==='object'&&Number.isFinite(grip.angle)?grip.angle:Math.atan2(w[1]-e[1],w[0]-e[0]);
    const gesture=typeof grip==='object'?grip.gesture:grip;
    const edge=Y.shade(look.skin2,.80),skin=g.createLinearGradient(0,-.04,.05,.04);
    skin.addColorStop(0,Y.shade(look.skin,1.08));skin.addColorStop(.6,look.skin);skin.addColorStop(1,look.skin2);
    const p=(d,f,s=edge,lw=.004)=>vectorPath(g,d,f,s,lw),line=(d,c=edge,lw=.003)=>p(d,null,c,lw);
    g.save();g.translate(...w);g.rotate(angle);g.lineCap='round';g.lineJoin='round';
    if(gesture==='brush'){
      // The shaft passes between thumb and index. Rear shaft -> palm ->
      // curled fingers -> thumb is also the SVG export's exact layer order.
      g.save();g.translate(brushGrip.x,brushGrip.y);g.rotate(brushGrip.tilt);
      p('M-.19 -.011 L.25 -.011 L.25 .011 L-.19 .011 Q-.21 0 -.19 -.011 Z','#b58a51','#604c3c',.0035);
      line('M-.17 -.005 L.235 -.005','#ebce8b',.003);
      p('M.21 -.017 L.26 -.017 L.26 .017 L.21 .017 Z',look.trim,'#7e6245',.003);
      p('M.26 -.017 C.31 -.029 .345 -.012 .39 0 C.34 .016 .31 .029 .26 .017 Z','#eee3c7','#5f5453',.003);
      p('M.335 -.013 Q.368 -.007 .39 0 Q.365 .011 .333 .014 Q.346 0 .335 -.013 Z','#30313b',null);
      line('M.271 -.007 Q.307 -.015 .329 -.003','#fff5df',.003);g.restore();
      p('M-.028 -.025 Q-.011 -.036 .008 -.030 Q.028 -.039 .046 -.027 Q.060 -.020 .061 .003 L.055 .029 Q.032 .045 .008 .035 L-.026 .024 Z',skin);
      p('M.009 -.025 Q.030 -.040 .048 -.026 Q.055 -.019 .047 -.012 L.026 -.009 Q.013 -.010 .009 -.025 Z',Y.shade(look.skin,1.04));
      p('M.035 -.006 Q.060 -.017 .067 -.003 Q.072 .006 .060 .013 L.040 .015 Z',skin);
      p('M.037 .010 Q.061 .003 .066 .017 Q.067 .027 .055 .031 L.033 .031 Z',skin);
      p('M-.006 .018 Q.006 .005 .016 .001 Q.030 -.002 .034 .009 Q.033 .019 .018 .026 L.009 .033 Q-.003 .037 -.006 .018 Z',Y.shade(look.skin,1.06));
      line('M.019 -.021 L.036 -.023',Y.tint(edge,.55),.0025);
      g.restore();return;
    }
    if(['wave','open'].includes(gesture)){
      p('M-.025 -.027 Q-.002 -.036 .023 -.028 L.070 -.063 Q.083 -.068 .086 -.058 Q.090 -.050 .079 -.043 L.056 -.024 L.100 -.030 Q.115 -.030 .114 -.019 Q.114 -.012 .099 -.010 L.065 -.008 L.112 .003 Q.123 .005 .120 .015 Q.118 .024 .105 .021 L.063 .010 L.098 .033 Q.111 .039 .105 .047 Q.101 .052 .090 .046 L.049 .024 Q.043 .058 .025 .056 Q.010 .052 .007 .038 L-.023 .030 Z',skin);
      line('M.010 -.013 Q.028 -.003 .025 .025',Y.tint(edge,.55));
    }else if(gesture==='point'){
      p('M-.027 -.025 Q-.011 -.037 .018 -.028 L.109 -.035 Q.127 -.035 .126 -.023 Q.124 -.015 .110 -.015 L.050 -.010 Q.070 -.002 .068 .011 Q.065 .020 .054 .020 Q.065 .036 .048 .043 L.018 .040 Q-.005 .038 -.026 .026 Z',skin);
      line('M.031 .006 L.053 .008 M.023 .022 L.047 .027',Y.tint(edge,.7));
      p('M-.002 .017 Q.009 -.003 .025 -.003 Q.038 .003 .027 .016 L.016 .028 Z',Y.shade(look.skin,1.05));
    }else if(gesture==='support'||gesture==='relaxed'||gesture==='rest'){
      p('M-.028 -.024 Q-.011 -.033 .012 -.024 Q.038 -.030 .052 -.014 L.075 -.006 Q.088 -.002 .081 .009 L.061 .013 L.082 .019 Q.096 .027 .085 .036 Q.070 .040 .045 .031 Q.025 .041 .004 .030 L-.026 .023 Z',skin);
      line('M.032 .009 Q.044 .020 .063 .021 M.021 .019 Q.033 .029 .047 .029',Y.tint(edge,.65),.0028);
      p('M.007 -.010 Q.025 -.027 .038 -.021 Q.048 -.015 .036 -.008 L.019 .004 Z',Y.shade(look.skin,1.035));
    }else{
      p('M-.027 -.027 Q-.005 -.039 .018 -.030 Q.036 -.041 .050 -.024 Q.064 -.013 .061 .009 L.053 .031 Q.031 .043 .008 .034 L-.027 .025 Z',skin);
      line('M.027 -.023 Q.044 -.022 .046 -.008 M.032 -.006 L.051 -.003 M.031 .011 L.050 .014',Y.tint(edge,.7),.003);
      p('M-.005 .015 Q.006 .001 .020 -.001 Q.033 -.003 .035 .009 Q.034 .018 .020 .026 L.008 .030 Z',Y.shade(look.skin,1.06));
    }
    g.restore();
  }
  // Display acting only: one planted leg, a relaxed knee, and hands with a
  // purpose. Coordinates are local to the hip; rackets remain gameplay props.
  const displayStances={
    '小学生':{hip:.025,twist:-.12,lean:-.015,feet:[.17,-.22],knees:[.04,.055],hand:[.32,.89],racket:-.80,free:[-.28,1.12],prop:'clipboard',freeGesture:'point'},
    '凌风':{hip:.045,twist:-.10,lean:-.025,feet:[.12,-.25],knees:[.012,.075],hand:[.32,.91],racket:-1.12,free:[-.29,1.15],prop:'shuttle'},
    '沧澜':{hip:-.055,twist:.10,lean:.025,feet:[.25,-.14],knees:[-.045,-.008],hand:[.33,.96],racket:-.90,free:[-.28,1.22],prop:'shuttle'},
    '小红':{hip:-.025,twist:-.06,lean:.015,feet:[.21,-.13],knees:[.035,-.008],hand:[.08,1.20],racket:null,free:[-.14,1.05],prop:'plan',propOffset:[.065,.02],gesture:'point',freeFront:true},
    '冉冉':{hip:.065,twist:.14,lean:-.035,feet:[.13,-.19],knees:[.008,.085],hand:[.39,1.48],racket:null,free:[-.19,.98],prop:'none',gesture:'wave',freeGesture:'rest',freeFront:true},
    '磐岩':{hip:-.025,twist:-.06,lean:.025,feet:[.26,-.19],knees:[.035,-.005],hand:[.23,.98],racket:null,free:[-.35,1.20],prop:'bun',gesture:'rest',freeGesture:'support'},
    '星星':{hip:.045,twist:.09,lean:-.025,feet:[.13,-.16],knees:[.008,.065],hand:[.03,1.19],racket:null,free:[-.17,1.24],prop:'starball',gesture:'support',freeFront:true},
    '丁丁':{hip:-.035,twist:-.10,lean:.025,feet:[.23,-.15],knees:[.045,-.008],hand:[.18,1.58],racket:null,free:[-.27,1.05],prop:'tool',gesture:'point'},
    '猴子':{hip:.045,twist:-.08,lean:-.025,feet:[.13,-.31],knees:[.01,.065],hand:[.37,1.28],racket:1.10,free:[-.33,1.15],prop:'thumb'},
    '路先森':{hip:-.035,twist:.09,lean:.025,feet:[.24,-.14],knees:[.04,-.008],hand:[.07,1.21],racket:null,free:[-.14,1.06],prop:'tablet',propOffset:[.06,.025],gesture:'point',freeFront:true},
    '老陈':{hip:.015,twist:.04,lean:-.015,feet:[.12,-.20],knees:[.008,.035],hand:[.06,1.16],racket:null,free:[-.16,1.03],prop:'clipboard',propOffset:[.07,.025],gesture:'point',freeFront:true},
    '果哥':{hip:.015,twist:-.10,lean:-.01,feet:[.20,-.27],knees:[.012,.04],hand:[.23,1.00],racket:null,free:[-.37,1.24],prop:'thumb',gesture:'rest',freeFront:true},
    '田楚':{hip:.06,twist:.14,lean:-.035,feet:[.13,-.20],knees:[.005,.06],hand:[.30,.88],racket:-1.25,free:[-.18,.94],prop:'none',freeGesture:'rest',freeFront:true},
    '静川':{hip:-.025,twist:-.06,lean:.02,feet:[.23,-.15],knees:[.03,-.005],hand:[.39,1.22],racket:null,free:[-.27,1.28],prop:'whistle',gesture:'open'},
    '波波':{hip:-.035,twist:-.10,lean:.03,feet:[.22,-.15],knees:[.05,-.008],hand:[.04,1.14],racket:null,free:[-.16,1.04],prop:'fossil',propOffset:[.07,.025],gesture:'support',freeFront:true},
    '苗苗':{hip:.025,twist:-.10,lean:.035,crouch:.035,feet:[.22,-.29],knees:[.04,.045],hand:[.38,1.08],racket:.62,free:[-.29,1.12],prop:'shuttle'},
    '逐晨':{hip:-.045,twist:.05,lean:.035,feet:[.22,-.14],knees:[.05,-.008],hand:[.22,.87],racket:null,free:[-.25,1.10],prop:'coffee',gesture:'relaxed'},
    '老南':{hip:.015,twist:.06,lean:-.015,feet:[.13,-.22],knees:[.008,.04],hand:[.14,1.22],racket:null,free:[-.12,1.16],prop:'camera',propOffset:[.11,.035],gesture:'grip',freeFront:true},
    '朱朱':{hip:.035,twist:.04,lean:-.015,feet:[.16,-.18],knees:[.008,.055],hand:[.39,1.34],racket:null,free:[-.14,1.08],prop:'scroll',propOffset:[.035,.015],gesture:'brush',freeGesture:'support',freeFront:true},
    '腾岳':{hip:.035,twist:-.08,lean:-.015,feet:[.19,-.29],knees:[.012,.05],hand:[.32,.90],racket:-1.03,free:[-.36,1.02],prop:'basket',freeGesture:'support'},
    '云衡':{hip:-.025,twist:.05,lean:.02,feet:[.22,-.15],knees:[.025,-.008],hand:[.06,1.19],racket:null,free:[-.15,1.06],prop:'tablet',propOffset:[.07,.025],gesture:'point',freeFront:true}
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
  function displayBounds(P,headPad=style.headBounds){
    const pts=[],box=(q,x,y)=>pts.push([q[0]-x,q[1]-y],[q[0]+x,q[1]+y]);
    for(const key of ['H','K1','K2','S','S2','E','E2'])box(P[key],.11,.10);
    for(const key of ['W','W2'])box(P[key],.13,.13);
    for(const key of ['F1','F2'])box(P[key],.18,.10);
    box([P.hd[0],P.hd[1]+style.headLift],headPad,headPad);
    if(P.handGesture==='brush')for(const q of brushEnds(P))box(q,.035,.035);
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
  function head2D(g,P,look,o={}){const a=acting(look),spinning=Number.isFinite(P.spinAngle);g.save();g.translate(P.hd[0],P.hd[1]+style.headLift);g.rotate((o.showcase?a.tilt+(P.headTilt||0)*.45:clamp(P.lean*.35,-.2,.2)));g.scale(style.head2D,-style.head2D);head(g,look,{back:spinning&&Math.cos(P.spinAngle)<-.15,turn:spinning?Math.sin(P.spinAngle)*.85:.22+(P.headTurn||0)*.5,time:o.time||0,focus:!!P.motion,gaze:clamp(o.gazeX||0,-1,1),expression:o.showcase?a.expression:undefined,mood:o.mood,quality:o.quality??1});g.restore();}
  const basic=Object.freeze({name:'球友',motif:'wing',shoulder:1,waist:1,limb:1,head:1,lean:0,detail:'jersey'});
  const profile=look=>profiles[look?.name]||basic;
  const motionRows={
    '小学生':[.83,1.06,1.18,-.035,.16],
    '凌风':[1.13,1.08,.92,.05,.08], '沧澜':[.88,.9,1.14,-.04,-.05],
    '小红':[.78,.78,.86,.01,-.10], '冉冉':[.87,.91,1.08,-.05,.12],
    '磐岩':[1.18,1.2,.85,.08,-.12], '星星':[.89,.84,1.18,-.08,.15],
    '丁丁':[.8,.92,.9,.025,-.07], '猴子':[1.24,1.12,1.2,.09,.16],
    '路先森':[.93,1.02,.92,.03,-.11], '老陈':[.72,.78,.88,-.015,-.15],
    '果哥':[1.26,1.25,.82,.07,-.06], '田楚':[1.08,.88,1.16,-.06,.09],
    '静川':[.75,.82,.9,.02,-.08], '波波':[1.12,1.14,1.1,.04,.13],
    '苗苗':[1.22,.9,1.25,-.07,.10], '逐晨':[.82,1.04,.94,.08,-.04],
    '老南':[.76,.87,.89,-.025,-.13], '朱朱':[.86,.86,1.24,-.04,.18], '腾岳':[1.23,1.24,1.05,.05,-.09], '云衡':[.8,.94,.91,-.01,-.12]
  };
  const neutral={coil:1,stance:1,follow:1,lean:0,wrist:0};
  // Individual ready stances: arm attitude, racket position, free hand, tempo.
  // Stroke interpolation starts and ends at the same personal ready stance.
  const idleRows={
    '凌风':[58,.85,18,.9, .40,1.66,.43, .22,1.17,-.36,3.4],
    '沧澜':[18,.65,-24,1.2, .45,1.42,.39, .10,1.08,-.31,2.1],
    '小红':[50,1.35,72,1.7, .31,1.62,.47, .28,1.35,-.30,2.5],
    '冉冉':[65,.85,112,.7, .36,1.73,.44, .11,1.45,-.39,3.1],
    '磐岩':[28,.9,-48,1.6, .48,1.40,.49, .06,.96,-.43,2.6],
    '星星':[42,.75,46,1.3, .37,1.56,.37, .25,1.28,-.31,2.3],
    '丁丁':[40,1.2,90,1.9, .32,1.51,.48, .28,1.43,-.29,2.8],
    '猴子':[74,1.25,-10,.6, .46,1.78,.51, .18,1.02,-.46,3.6],
    '路先森':[38,1.3,-25,1.8, .43,1.49,.52, .08,1.12,-.41,2.4],
    '老陈':[22,.95,-40,1.4, .39,1.46,.38, .16,1.01,-.32,2.0],
    '果哥':[54,1.15,-30,1.9, .46,1.60,.56, .12,1.16,-.48,2.7],
    '田楚':[15,.72,56,1.85, .42,1.49,.39, .22,1.30,-.34,2.15],
    '静川':[25,.9,20,1.2, .41,1.39,.42, .29,1.15,-.34,1.9],
    '波波':[47,1.05,60,1.35, .43,1.55,.50, .25,1.28,-.38,2.65],
    '苗苗':[72,.8,12,.75, .39,1.80,.47, .16,1.12,-.42,3.5],
    '逐晨':[-8,1.0,-55,.6, .48,1.30,.43, .03,.91,-.36,1.85],
    '老南':[20,.8,-15,1.55, .40,1.45,.46, .13,1.10,-.39,2.05],
    '朱朱':[30,.7,-28,1.8, .35,1.55,.37, .06,1.08,-.28,2.25],
    '腾岳':[67,1.2,15,1.1, .48,1.73,.55, .24,1.20,-.46,2.9],
    '云衡':[20,.9,32,1.4, .39,1.43,.44, .24,1.23,-.35,1.95],
    '小学生':[80,.95,105,.4, .34,1.84,.41, .14,1.44,-.31,3.8]
  };
  const postureRows={
    '凌风':[.28,-.22,-.015,-.020,.020,0], '沧澜':[.18,-.12,.020,.040,-.035,.025],
    '小红':[.14,-.18,-.025,.055,-.060,.020], '冉冉':[.16,-.20,.025,.050,-.040,.040],
    '磐岩':[.30,-.24,.020,.015,.020,0], '星星':[.12,-.18,.045,.050,-.080,.050],
    '丁丁':[.19,-.14,-.020,.040,-.035,.015], '猴子':[.36,-.29,0,-.055,.080,0],
    '路先森':[.18,-.11,-.040,.050,-.025,.025], '老陈':[.13,-.16,.020,.055,-.040,.020],
    '果哥':[.33,-.26,.025,.025,.015,0], '田楚':[.16,-.21,-.025,.065,-.060,.035],
    '静川':[.20,-.20,.015,.005,0,0], '波波':[.23,-.20,.035,-.015,.060,0],
    '苗苗':[.40,-.28,.035,-.045,.080,0], '逐晨':[.22,-.12,-.040,.005,.040,.010],
    '老南':[.17,-.19,.015,.035,-.030,.020], '朱朱':[.14,-.20,.045,.070,-.085,.045],
    '腾岳':[.34,-.26,.020,.015,.040,0], '云衡':[.17,-.16,-.020,.025,-.025,.010],
    '小学生':[.20,-.17,.020,-.030,0,0]
  };
  const motionFor=(p,look)=>{
    const owner=Y.CHARS?.find(c=>c.passive===p?.kit?.passive);
    const name=look?.name||(owner&&Y.lookOf?.(owner.id)?.name);
    const v=motionRows[name],i=idleRows[name];return v?{coil:v[0],stance:v[1],follow:v[2],lean:v[3],wrist:v[4],idle:i?{arms:i.slice(0,4),racket:i.slice(4,7),free:i.slice(7,10),tempo:i[10],posture:postureRows[name]}:null}:neutral;
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
    dixia:['place',-30,.55,95,.8],chuanmen:['leap',-45,.45,135,.4],huanzuo:['focus',82,.9,145,1.1],
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
    if(kind==='bell'){g.moveTo(-.8,.55);g.quadraticCurveTo(-.45,.2,-.5,-.25);g.quadraticCurveTo(0,-1,.5,-.25);g.quadraticCurveTo(.45,.2,.8,.55);g.closePath();g.stroke();g.beginPath();g.arc(0,.75,.18,0,TAU);g.fill();g.beginPath();g.moveTo(-.1,-.85);g.lineTo(.1,-.85);g.stroke();}
    else if(kind==='brush'){g.moveTo(-.65,.9);g.quadraticCurveTo(.05,.8,.15,.14);g.lineTo(.8,-.8);g.lineTo(.56,-1);g.lineTo(-.1,-.02);g.quadraticCurveTo(-.65,.05,-.65,.9);g.fill();g.stroke();}
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
  // Rounded SVG silhouettes and large, layered eyes, shared by every view.
  function head(g,look,{back=false,turn=0,time=0,focus=false,gaze=0,quality=1,expression,mood}={}){
    if(Y.CharacterSprites?.head(g,look,back))return;
    const art=profile(look),act=acting(look),hair=look.hair;
    const expr=expression||(['happy','cheer','smile'].includes(mood)?'laugh':focus?'focused':act.expression);
    const edge='#443440',hairC=look.hairC,hairHi=look.hairHi||Y.shade(hairC,1.6),hairEdge=Y.shade(hairC,.65);
    const skinEdge=Y.shade(look.skin2,.78),tx=clamp(turn,-1,1)*.10,sway=Math.sin(time*2.2)*.055;
    const p=(d,f,s=null,w=.035)=>vectorPath(g,d,f,s,w),line=(d,c=edge,w=.035)=>p(d,null,c,w);
    const long=['long','bangs','side'].includes(hair)&&!look.shortHair,pony=hair==='ponytail',twin=hair==='twin';
    const elegant=look.identity==='calligraphy';
    g.save();g.scale((faceWidths[look.name]||.87)*(1+(act.faceW-1)*.18),1);g.lineCap='round';g.lineJoin='round';
    const hairFill=g.createLinearGradient(-.8,-1.2,.9,.9);
    hairFill.addColorStop(0,Y.shade(hairC,1.16));hairFill.addColorStop(.55,hairC);hairFill.addColorStop(1,Y.shade(hairC,.86));
    if(long){
      // Side locks leave the neck open. A solid bridge below the chin would
      // turn long hair into a dark collar when drawn over the shirt.
      p('M-.68 -.85 C-1.28 -.71 -1.23 .55 -1.17 1.26 Q-1.15 1.72 -1.35 1.96 Q-1.05 1.92 -.84 1.57 Q-.94 1.95 -.99 2.10 Q-.70 1.92 -.65 1.40 L-.66 .61 L-.57 -.32 Z',hairFill,hairEdge,.045);
      p('M.65 -.85 C1.28 -.67 1.23 .55 1.16 1.27 Q1.14 1.72 1.29 1.98 Q1.02 1.92 .83 1.55 L.66 1.38 L.66 .61 L.57 -.32 Z',hairFill,hairEdge,.045);
      p('M-.99 -.27 Q-1.08 .65 -1.12 1.60 Q-.81 1.26 -.86 .38 Q-.85 -.02 -.73 -.43 Z',hairHi);
      p('M.91 -.27 Q1.01 .53 1.04 1.61 Q.81 1.32 .82 .57 Q.78 .02 .68 -.44 Z',Y.shade(hairHi,.78));
      line('M-.99 .57 Q-.98 1.18 -1.17 1.84',Y.shade(hairHi,1.12),.018);
      line('M.98 .70 Q.97 1.23 1.13 1.77',hairHi,.018);
    }
    if(pony||twin){
      for(const s of(twin?[-1,1]:[-1])){
        g.save();g.scale(s,1);g.translate(sway,0);
        p('M.76 -.61 C1.38 -.86 1.62 -.08 1.42 .59 Q1.28 1.13 1.58 1.69 Q1.04 1.53 1.00 .89 C.91 .50 1.02 .04 .69 -.13 Z',hairFill,hairEdge,.045);
        p('M1.12 -.38 Q1.51 -.01 1.24 .79 Q1.18 .19 1.12 -.38 Z',hairHi);
        oval(g,.96,-.34,.13,.12,look.band||look.trim,hairEdge,.024);g.restore();
      }
    }
    if(hair==='bun'){
      oval(g,.12,-1.13,.49,.39,hairFill,hairEdge,.045);
      line('M-.14 -1.24 Q.15 -1.45 .37 -1.16',hairHi,.055);
    }
    for(const s of[-1,1]){
      oval(g,s*.99,.18,look.bigEars?.245:.16,look.bigEars?.29:.23,look.skin,skinEdge,.03);
      line(s<0?'M-1.04 .12 Q-.91 .04 -.98 .28':'M1.04 .12 Q.91 .04 .98 .28',look.skin2,.035);
    }
    const skin=g.createLinearGradient(-.7,-.8,.8,1.0);
    skin.addColorStop(0,Y.shade(look.skin,1.075));skin.addColorStop(.62,look.skin);skin.addColorStop(1,Y.shade(look.skin2,1.07));
    const mature=!!(look.mature||look.age),male=look.gender==='male'||['knee','tool','plaid','tank','office','field','circuit','jersey','apron','wrap'].includes(art.detail);
    const face=elegant?'M-.98 -.25 C-1.02 -.91 -.57 -1.12 .02 -1.12 C.64 -1.12 1.01 -.87 .98 -.20 Q.96 .27 .79 .53 Q.57 .84 .15 1.03 Q.02 1.10 -.11 1.03 Q-.54 .85 -.77 .54 Q-.96 .28 -.98 -.25 Z':mature?'M-1 -.25 C-1.04 -.98 -.58 -1.12 .02 -1.11 C.66 -1.12 1.05 -.90 1.01 -.20 Q.98 .29 .81 .55 L.56 .86 Q.28 1.04 .02 1.06 Q-.29 1.04 -.56 .86 L-.80 .55 Q-.98 .28 -1 -.25 Z':male?'M-1 -.25 C-1.04 -.98 -.58 -1.12 .02 -1.11 C.66 -1.12 1.05 -.90 1.01 -.20 Q.98 .27 .83 .53 L.55 .85 Q.22 1.07 .02 1.07 Q-.23 1.06 -.55 .85 L-.81 .53 Q-.99 .26 -1 -.25 Z':'M-1 -.25 C-1.04 -.98 -.58 -1.12 .02 -1.11 C.66 -1.12 1.05 -.90 1.01 -.20 Q.98 .30 .80 .57 Q.49 .94 .02 1.06 Q-.46 .94 -.79 .57 Q-.98 .28 -1 -.25 Z';
    p(face,skin,skinEdge,.035);
    if(!back){
      g.save();p(face);g.clip();
      p('M-.98 -.18 Q-.91 .41 -.58 .75 Q-.20 1.07 .39 .93 Q-.31 1.19 -.80 .68 Q-1.08 .29 -.98 -.18 Z',Y.tint(look.skin2,.19));g.restore();
      oval(g,-.40,-.36,.30,.18,Y.tint('#fff7df',.18));
    }
    if(back){
      if(hair==='receding'){
        p('M-1.02 -.12 Q-.99 .72 -.61 .87 Q0 1.13 .62 .87 Q1.03 .64 1.04 -.14 L.82 -.04 Q.81 .45 .59 .54 Q0 .70 -.61 .54 L-.83 -.03 Z',hairFill,hairEdge,.04);
      }else{
        p('M-1.04 .20 C-1.21 -.73 -.65 -1.34 .04 -1.31 C.79 -1.31 1.22 -.63 1.05 .29 Q1.01 .88 .55 .97 Q0 .81 -.54 .97 Q-1.01 .83 -1.04 .20 Z',hairFill,hairEdge,.045);
        if(quality)for(const x of[-.62,-.25,.20,.59])line(`M${x} -.89 Q${x+.16} -.12 ${x*.9} .68`,Y.tint(hairHi,.72),.026);
      }
      if(look.headband||hair==='spiky')line('M-1.01 -.20 Q0 -.38 1.02 -.20',look.band,.15);
      if(look.glasses){line('M-1.02 .10 L-.82 .03','#716574',.05);line('M1.02 .10 L.82 .03','#716574',.05);}
    }else{
      const caps={
        spiky:'M-1.04 .20 Q-1.18 -.21 -.96 -.64 Q-1.00 -.86 -.90 -1.05 L-.63 -.98 Q-.68 -1.31 -.44 -1.32 L-.14 -1.21 Q.02 -1.52 .22 -1.39 L.42 -1.18 Q.81 -1.31 .89 -1.07 L.91 -.89 Q1.18 -.69 1.06 .23 L.85 .14 L.68 -.42 Q.53 -.16 .34 -.42 Q.13 -.09 -.08 -.39 Q-.31 -.11 -.48 -.37 Q-.72 -.13 -.82 .20 Z',
        mess:'M-1.03 .30 Q-1.24 -.18 -1.01 -.61 L-1.11 -.89 L-.80 -.89 Q-.68 -1.32 -.42 -1.24 L-.18 -1.18 Q.13 -1.46 .37 -1.21 Q.79 -1.23 .91 -.91 Q1.20 -.77 1.05 -.48 L1.04 .29 L.85 .40 Q.82 -.10 .59 -.38 L.43 -.23 Q.31 -.52 .15 -.42 L-.02 -.22 L-.27 -.39 Q-.53 -.12 -.69 -.31 L-.83 .40 Z',
        quiff:'M-1.02 .28 Q-1.18 -.30 -.93 -.77 Q-1.04 -1.08 -.60 -1.19 Q-.53 -1.51 -.15 -1.46 Q.19 -1.50 .45 -1.24 Q.83 -1.29 .98 -.84 Q1.14 -.46 1.03 .29 L.85 .39 Q.84 -.04 .64 -.45 Q.18 -.30 -.16 -.51 Q-.51 -.69 -.73 -.25 L-.83 .42 Z',
        bowl:'M-1.03 .27 C-1.20 -.61 -.73 -1.28 .01 -1.27 C.78 -1.29 1.19 -.58 1.04 .30 L.85 .42 L.79 -.12 Q.15 .07 -.77 -.13 L-.85 .43 Z',
        bangs:'M-1.04 .30 C-1.20 -.66 -.73 -1.34 .04 -1.30 C.82 -1.30 1.19 -.59 1.05 .31 L.85 .47 L.76 -.13 Q.39 -.16 .21 -.25 L.11 -.08 Q-.10 -.10 -.29 -.25 L-.37 -.09 Q-.58 -.12 -.78 -.20 L-.88 .48 Z',
        crew:'M-1.02 .25 C-1.13 -.61 -.64 -1.21 .02 -1.20 C.76 -1.21 1.15 -.57 1.03 .29 L.85 .38 L.76 -.35 Q.31 -.42 -.01 -.35 Q-.42 -.44 -.77 -.32 L-.86 .39 Z',
        buzz:'M-1.02 .22 C-1.10 -.64 -.58 -1.17 .03 -1.17 C.75 -1.16 1.13 -.57 1.02 .25 L.88 .25 L.80 -.42 Q0 -.75 -.80 -.39 L-.89 .28 Z',
        part:'M-1.03 .28 C-1.21 -.63 -.68 -1.30 .05 -1.28 C.83 -1.29 1.17 -.58 1.04 .29 L.86 .40 Q.83 -.15 .57 -.52 Q.21 -.15 -.42 -.18 Q-.67 -.10 -.81 .35 L-.89 .50 Z',
        gray:'M-1.03 .29 Q-1.20 -.36 -.89 -.82 Q-.71 -1.20 -.22 -1.24 Q.12 -1.36 .42 -1.19 Q.96 -1.13 1.05 -.51 L1.05 .30 L.86 .40 Q.84 -.16 .61 -.48 Q.22 -.12 -.15 -.20 L-.26 -.35 Q-.47 -.14 -.72 -.18 L-.87 .45 Z',
        long:'M-1.03 .28 C-1.25 -.66 -.74 -1.38 .05 -1.30 C.87 -1.34 1.18 -.65 1.03 .35 L.87 .47 Q.87 -.13 .61 -.68 Q.12 -.08 -.48 -.05 Q-.73 -.02 -.86 .39 L-.91 .68 Q-1.07 .52 -1.03 .28 Z',
        side:'M-1.03 .28 C-1.24 -.64 -.69 -1.34 .06 -1.29 C.87 -1.31 1.20 -.61 1.03 .34 L.86 .46 Q.87 -.22 .59 -.64 Q.07 -.08 -.51 -.04 Q-.77 -.02 -.85 .43 L-.91 .62 Z',
        ponytail:'M-1.03 .29 C-1.21 -.62 -.69 -1.32 .03 -1.29 C.85 -1.30 1.18 -.59 1.04 .30 L.86 .43 Q.87 -.12 .63 -.49 Q.26 -.15 .02 -.35 Q-.37 -.10 -.63 -.32 Q-.81 -.10 -.86 .47 Z',
        twin:'M-1.03 .28 C-1.20 -.65 -.69 -1.31 .02 -1.29 C.83 -1.31 1.19 -.62 1.04 .30 L.86 .45 Q.82 -.14 .64 -.39 Q.42 -.14 .17 -.35 L.02 -.20 L-.21 -.38 Q-.42 -.13 -.65 -.34 Q-.83 -.08 -.86 .45 Z',
        bun:'M-1.03 .27 C-1.17 -.65 -.65 -1.28 .03 -1.27 C.84 -1.29 1.17 -.59 1.04 .30 L.85 .41 Q.80 -.20 .60 -.45 Q.05 -.12 -.57 -.35 Q-.77 -.15 -.86 .40 Z'
      };
      if(hair==='receding'){
        p('M-.96 -.49 Q-1.15 -.13 -1.03 .42 L-.83 .53 Q-.79 .07 -.84 -.24 Z',hairFill,hairEdge,.03);
        p('M.96 -.49 Q1.15 -.13 1.03 .42 L.83 .53 Q.79 .07 .84 -.24 Z',hairFill,hairEdge,.03);
        line('M-.28 -.91 Q-.13 -1.04 .03 -.91 M-.08 -.96 Q.10 -1.08 .25 -.92',hairHi,.035);
      }else{
        const cap=caps[hair]||caps.part;p(cap,hairFill,hairEdge,.045);
        if(quality){
          g.save();p(cap);g.clip();
          p('M-.91 -.71 Q-.40 -1.24 .28 -1.02 Q.62 -.95 .80 -.69 Q.18 -.91 -.32 -.71 Q-.68 -.58 -.91 -.71 Z',Y.tint(hairHi,.77));
          line('M-.71 -.77 Q-.43 -.99 -.14 -.96',Y.shade(hairHi,1.18),.038);
          line('M-.58 -.65 Q-.38 -.78 -.20 -.78',Y.tint('#fff8e7',.23),.018);
          if(['long','side','part'].includes(hair))line('M.52 -1.02 Q.16 -.52 -.47 -.32',Y.tint(hairHi,.9),.026);
          g.restore();
        }
      }
      if(long){
        p('M-.99 -.08 Q-.93 .57 -.73 1.09 Q-.99 .93 -1.02 .44 Z',hairFill);
        p('M.95 -.08 Q.89 .59 .77 1.06 Q1.04 .83 1.03 .35 Z',hairFill);
        line('M-.94 .28 Q-.88 .69 -.83 .81',hairHi,.018);
      }
      if(look.headband||hair==='spiky'){
        p('M-1.00 -.48 Q-.01 -.68 1.00 -.48 L1.02 -.29 Q0 -.47 -1.01 -.29 Z',look.band,hairEdge,.027);
        line('M-.88 -.47 Q0 -.60 .88 -.47',Y.tint('#fffbed',.62),.024);
        p('M-.97 -.36 Q-1.18 -.34 -1.28 -.19 L-1.07 -.18 L-1.16 .04 Q-.91 -.09 -.91 -.29 Z',look.band,hairEdge,.025);
      }
      const blink=(time%4.7)>4.56,dx=clamp(gaze+Math.sin(time*.65)*.12,-1,1)*.055;
      const gentle=['serene','calm','mysterious','knowing','smirk','tired'].includes(expr),happy=['laugh','grin'].includes(expr);
      for(const s of[-1,1]){
        const wink=expr==='playful'&&s<0,closed=blink||wink;
        const ex=s*.43+tx,ey=elegant?.14:mature?.15:.17,eh=(elegant?.60:expr==='wonder'?.87:gentle?.68:.77)*(mature?.83:male?.93:1);
        g.save();g.translate(ex,ey);if(elegant)g.rotate(-s*.13);g.scale(elegant?1.08:.94,eh);
        if(closed){
          line('M-.23 .02 Q0 -.14 .23 .02',edge,.055);
          if(wink)line('M-.23 .02 L-.28 -.02',edge,.035);
        }else{
          const eye=elegant?'M-.26 .01 Q-.10 -.27 .07 -.22 Q.20 -.16 .27 -.025 Q.14 .21 -.03 .21 Q-.17 .17 -.26 .01 Z':'M-.245 .015 C-.25 -.15 -.16 -.28 .02 -.28 C.20 -.28 .26 -.15 .25 .015 Q.23 .26 .03 .26 Q-.19 .25 -.245 .015 Z';
          p(eye,'#fffaf0',Y.shade(skinEdge,1.05),.022);
          g.save();g.clip();
          const iris=g.createLinearGradient(0,-.24,0,.25);
          iris.addColorStop(0,Y.shade(look.eye,.60));iris.addColorStop(.5,look.eye);iris.addColorStop(1,Y.shade(look.eye,1.95));
          oval(g,dx,.012,.155,.227,iris);oval(g,dx,-.015,.072,.148,'#252431');
          g.save();g.translate(dx,0);p('M-.12 .14 Q0 .24 .12 .14 Q.09 .29 -.09 .25 Z',Y.tint(look.trim||'#e8ce91',.70));g.restore();
          oval(g,dx-.052,-.092,elegant?.035:.044,elegant?.051:.061,'#fffdf6');oval(g,dx+.064,.080,.018,.024,'#fffdf6');
          g.restore();
          line(elegant?'M-.26 .01 Q-.11 -.27 .07 -.22 Q.21 -.17 .27 -.025':'M-.25 .005 C-.25 -.17 -.13 -.29 .03 -.29 Q.21 -.28 .25 -.03',edge,elegant?.058:look.lip?.053:.045);
          if(look.lip||['bow','star','sash'].includes(art.detail))line(s<0?'M-.21 -.15 L-.28 -.20':'M.21 -.15 L.29 -.21',edge,.034);
        }
        g.restore();
        const stern=['stern','bold','confident','focused'].includes(expr),lift=expr==='curious'&&s>0?-.065:0;
        g.save();g.translate(ex,(elegant?-.22:mature?-.24:-.255)+lift);g.rotate(elegant?-s*.11:stern?s*.15:look.mature?-s*.055:expr==='precise'?s*.04:0);
        line(elegant?'M-.23 .035 Q-.02 -.075 .21 -.005':'M-.20 .015 Q0 -.055 .20 .015',Y.shade(hairC,1.18),elegant?.032:look.brow?.072:mature?.055:.045);g.restore();
      }
      const blush=g.createRadialGradient(0,0,0,0,0,.23);blush.addColorStop(0,elegant?'#c9898a36':'#ec8d8b26');blush.addColorStop(1,'#ec8d8b00');
      for(const s of[-1,1]){g.save();g.translate(s*.64+tx*.3,.47);g.scale(1,.50);oval(g,0,0,.23,.23,blush);g.restore();}
      if(look.muzzle)oval(g,tx*.3,.61,.43,.23,Y.tint('#ffe2ba',.48));
      line('M.018 .35 Q-.026 .44 .058 .43',Y.shade(look.skin2,.95),.025);
      oval(g,.055,.36,.025,.015,Y.tint('#fff5db',.75));
      if(elegant){
        p('M-.19 .65 Q-.08 .59 .01 .63 Q.10 .57 .22 .61 Q.11 .73 .01 .74 Q-.10 .74 -.19 .65 Z',look.lip||'#a85d71');
        line('M-.18 .65 Q.02 .68 .22 .61','#744651',.018);
        line('M-.045 .71 Q.04 .735 .12 .69','#e7a5ad',.019);
        line('M.025 .29 Q.006 .41 .065 .43',Y.tint(skinEdge,.66),.023);
      }else if(happy){
        p('M-.19 .61 Q.02 .67 .22 .59 Q.17 .86 .015 .86 Q-.13 .85 -.19 .61 Z','#8c4950',edge,.028);
        p('M-.14 .64 Q.02 .68 .17 .63 L.13 .70 Q.01 .74 -.10 .70 Z','#fff8e7');
        p('M-.07 .82 Q.02 .73 .11 .81 Q.03 .89 -.07 .82 Z','#e99195');
      }else if(look.mature){
        line('M-.20 .64 Q-.01 .77 .22 .60','#855e59',.032);
        line('M-.245 .57 Q-.285 .63 -.25 .69 M.25 .56 Q.29 .61 .26 .67',Y.tint(skinEdge,.40),.020);
        line('M-.17 .45 Q-.27 .47 -.31 .43 M.18 .45 Q.27 .47 .31 .43',Y.tint(skinEdge,.32),.018);
      }else if(expr==='precise'){
        line('M-.17 .66 Q-.01 .69 .18 .63','#845c57',.031);
        line('M.19 .61 Q.22 .62 .22 .65',Y.tint(skinEdge,.50),.018);
      }else if(expr==='tired'){
        line('M-.16 .70 Q.01 .64 .19 .70','#845c57',.030);
      }else if(expr==='focused'||expr==='bold'){
        line('M-.17 .66 Q.01 .72 .19 .63','#845c57',.031);
      }else{
        const smirk=['smirk','wry','knowing'].includes(expr);
        line(smirk?'M-.16 .64 Q.03 .75 .22 .59':expr==='stern'?'M-.15 .69 Q.02 .65 .17 .69':'M-.18 .63 Q.02 .80 .20 .63',look.lip||'#88595a',look.lip?.045:.032);
        if(look.lip)line('M-.07 .73 Q.025 .77 .12 .71',Y.tint('#f3a5a7',.8),.028);
      }
      if(look.age){
        line('M-.77 .29 L-.85 .32 M.77 .29 L.85 .32',Y.tint(skinEdge,.5),.022);
        if(quality)line('M-.31 .79 Q-.36 .72 -.35 .65 M.33 .78 Q.37 .71 .35 .65',Y.tint(skinEdge,.38),.018);
      }
      if(look.glasses){
        const frame=look.age?'#71615b':look.mature?'#55605c':'#343748';g.strokeStyle=frame;g.lineWidth=look.mature?.043:.049;
        for(const s of[-1,1]){
          const x=s*.43+tx;g.beginPath();
          if(look.glasses==='rect')Y.rr(g,x-.315,-.095,.63,.53,.10);else g.ellipse(x,look.mature?.17:.18,.325,look.mature?.285:.30,0,0,TAU);
          g.stroke();g.fillStyle='#bfe9ff12';g.fill();
          g.save();g.translate(x,0);line('M-.18 -.015 L-.06 -.052','#fffbea99',.029);g.restore();
        }
        g.save();g.translate(tx,0);line('M-.105 .12 Q0 .055 .105 .12',frame,.045);g.restore();
        line('M-.97 .09 L-.76 .12 M.97 .09 L.76 .12',frame,.045);
      }
    }
    if(art.detail==='bow'){
      g.save();g.translate(-.85,-.84);g.rotate(-.20);
      p('M0 .02 Q-.29 -.35 -.49 -.29 Q-.55 -.02 -.43 .27 Q-.18 .26 0 .02 Z',look.band,hairEdge,.035);
      p('M0 .02 Q.27 -.34 .46 -.25 Q.54 .02 .40 .27 Q.16 .25 0 .02 Z',look.band,hairEdge,.035);
      line('M-.40 -.13 L-.13 .01 M.36 -.11 L.13 .02',Y.tint('#fff8ed',.6),.028);
      oval(g,0,.02,.115,.13,Y.shade(look.band,1.12),hairEdge,.028);g.restore();
    }
    if(look.hairpin){
      g.save();g.translate(.89,-.64);g.rotate(-.28);
      line('M-.24 -.19 L.22 .20',look.trim,.045);
      p('M0 0 Q-.22 -.31 -.03 -.35 Q.14 -.24 0 0 Z',look.trim,hairEdge,.018);
      p('M.02 .015 Q.20 -.29 .33 -.16 Q.36 .02 .02 .015 Z',Y.shade(look.trim,1.13),hairEdge,.018);
      line('M.14 .14 L.13 .43',look.trim,.018);oval(g,.13,.46,.045,.060,'#b65c76',hairEdge,.018);g.restore();
    }
    if(art.detail==='star'){emblem(g,'star',.90,-.22,.17,'#ffe09a');oval(g,.90,-.22,.035,.035,'#fff7da');}
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
    if(art.detail==='school'){
      line([.1,-.13],[.5,-.12],look.panel,.025);line([.1,.13],[.5,.12],look.panel,.025);
      pathUniform(g,[pt(.55,-.11),pt(.46,0),pt(.55,.11),pt(.38,.02),pt(.29,.07),pt(.41,-.04)]);
      g.fillStyle='#ed5146';g.fill();g.strokeStyle='#b23638';g.lineWidth=.006;g.stroke();
      line([.52,-.075],[.48,0],'#ffb397',.008);
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
  // Authored illustration contours. These are drawings, not poses reconstructed
  // from the match IK rig. Each silhouette has its own weight-bearing leg,
  // shoulder line, arm curves and hand/prop attachment points (600 x 900).
  const figures={
    '凌风':{
      head:[308,163,43,-.055],neck:'M290 202 L331 201 L338 251 L286 256 Z',
      body:'M283 239 Q259 242 239 264 L250 349 Q260 406 251 492 Q295 516 365 487 L348 388 L350 270 Q333 244 329 239 Q306 256 283 239 Z',
      backArm:'M246 266 C223 274 218 307 211 340 Q203 365 177 357 L136 329 L124 343 Q153 384 184 390 C217 392 237 369 250 342 Z',
      frontArm:'M345 269 C361 269 371 290 372 324 L371 375 Q369 389 382 383 L415 352 L427 365 Q405 407 376 414 C344 421 340 390 343 364 L338 312 Z',
      legs:['M268 478 L308 485 Q305 562 286 635 L259 770 L241 786 L221 779 Q226 713 242 642 Q246 568 250 513 Z','M310 483 L352 480 Q370 568 348 632 L341 807 L310 810 Q307 716 318 641 Q310 574 296 532 Z'],
      shorts:'M252 475 Q304 494 355 479 L362 565 Q333 578 306 559 L297 541 L284 568 L239 554 Z',
      hands:[{w:[132,336],e:[180,367],gesture:'support',prop:'shuttle',ps:210},{w:[420,358],e:[368,401],racket:-1.37}],
      shoes:[[237,790,-.18],[327,812,.04]],detail:'knee',lean:1.3
    },
    '沧澜':{
      head:[286,168,43,.055],neck:'M268 208 L307 208 L318 256 L264 257 Z',
      body:'M263 246 Q235 247 222 277 L229 355 Q233 419 241 487 Q287 506 337 480 L331 380 L339 278 Q325 253 306 246 Q285 269 263 246 Z',
      backArm:'M225 277 C204 293 204 322 210 355 L227 455 L245 453 L241 349 L248 291 Z',
      frontArm:'M334 275 Q357 281 363 309 L372 372 Q374 392 358 402 L302 423 L296 407 L343 381 L335 328 Z',
      legs:['M247 481 L286 483 Q288 577 283 651 L277 808 L250 810 L248 655 Q235 565 247 481 Z','M290 482 L330 477 Q340 567 321 646 L346 792 L320 802 Q294 742 292 652 L280 559 Z'],
      shorts:'M240 477 Q286 492 337 476 L334 555 L291 562 L280 538 L274 560 L234 550 Z',
      hands:[{w:[237,453],e:[225,390],racket:1.09},{w:[299,414],e:[365,389],gesture:'support',prop:'shuttle',ps:190}],
      shoes:[[263,814,0],[336,800,-.12]],detail:'sash',lean:.65
    },
    '小红':{
      head:[300,164,42,-.035],neck:'M280 204 L319 205 L327 255 L275 256 Z',
      backHair:'M270 151 Q235 171 239 228 L231 368 Q244 380 257 362 L269 255 L333 257 L346 369 Q363 383 367 365 L353 223 Q354 164 325 150 Z',
      body:'M272 244 Q246 248 230 272 L239 374 L245 490 Q292 508 348 489 L347 377 L353 271 Q337 249 321 244 Q300 264 272 244 Z',
      backArm:'M347 274 Q367 279 371 311 L384 435 Q387 450 376 458 L328 484 L320 469 L358 438 L349 347 Z',
      frontArm:'M237 270 Q218 278 212 307 L208 361 Q207 378 220 380 Q238 383 249 354 L279 244 L261 239 L230 329 L235 300 Z',
      legs:['M257 481 L293 485 L290 643 L274 811 L247 811 L254 647 Z','M301 486 L338 481 Q354 585 333 656 L344 812 L315 815 L304 655 L291 554 Z'],
      shorts:'M245 476 L347 478 L352 564 Q327 575 301 562 L294 541 L287 564 L242 557 Z',
      hands:[{w:[270,240],e:[218,369],gesture:'point'},{w:[324,476],e:[372,450],gesture:'support',prop:'plan',ps:235}],
      shoes:[[259,816,.015],[331,818,-.04]],detail:'ruler',lean:.45
    },
    '冉冉':{
      head:[305,159,43,-.075],neck:'M287 201 L326 204 L330 250 L276 254 Z',
      body:'M277 243 Q252 249 240 275 L247 357 Q262 408 245 488 Q291 514 351 481 L340 375 L351 278 Q337 250 324 243 Q299 261 277 243 Z',
      backArm:'M245 278 Q224 291 221 326 L210 415 Q211 437 233 438 L271 411 L263 395 L234 414 L246 346 Z',
      frontArm:'M347 281 Q369 281 374 313 L385 354 Q389 367 399 348 L424 275 L443 280 Q441 339 420 382 C400 411 373 399 365 379 L345 330 Z',
      legs:['M264 495 L300 494 Q302 586 286 652 L269 807 L242 810 Q242 736 258 650 Z','M311 493 L345 486 Q368 577 335 645 L316 758 L329 786 L310 803 Q282 777 288 747 L307 642 Z'],
      shorts:'M246 475 Q296 495 346 473 Q352 520 369 567 Q308 586 225 565 Q240 519 246 475 Z',
      hands:[{w:[267,402],e:[218,432],gesture:'rest'},{w:[434,278],e:[403,378],gesture:'wave'}],
      shoes:[[254,814,.03],[317,797,-.3]],detail:'bow',lean:1.05
    },
    '磐岩':{
      head:[303,170,48,.035],neck:'M279 211 L325 211 L334 259 L272 261 Z',
      body:'M270 249 Q228 248 207 281 C218 329 211 368 209 401 Q207 462 233 512 Q304 548 377 501 Q391 450 380 394 L371 283 Q349 255 326 249 Q298 270 270 249 Z',
      backArm:'M215 282 Q194 292 192 328 L181 407 Q181 425 199 427 L243 401 L235 383 L207 403 L224 337 Z',
      frontArm:'M369 283 Q392 289 403 322 L415 362 Q420 386 397 397 L349 371 L353 353 L389 370 L374 334 Z',
      legs:['M247 502 L299 512 Q300 584 281 651 L269 809 L234 812 L235 649 Z','M310 511 L366 501 Q378 577 357 654 L365 811 L330 814 L319 656 Q304 580 310 511 Z'],
      shorts:'M231 493 Q304 519 377 491 L381 586 L317 598 L304 564 L291 596 L226 582 Z',
      hands:[{w:[239,391],e:[192,421],gesture:'rest'},{w:[352,362],e:[410,386],gesture:'support',prop:'bun',ps:270}],
      shoes:[[250,818,-.04],[349,818,.03]],detail:'apron',lean:1.1
    },
    '星星':{
      head:[290,159,43,.09],neck:'M271 201 L310 203 L323 253 L265 254 Z',
      backHair:'M261 145 Q225 178 235 241 L224 409 Q244 425 258 396 L268 260 L316 263 L330 416 Q352 425 360 405 L342 230 Q344 170 318 148 Z',
      body:'M266 243 Q240 247 226 276 L239 361 Q243 420 242 487 Q286 509 345 486 L340 378 L345 280 Q326 251 308 243 Q288 263 266 243 Z',
      backArm:'M230 278 Q210 293 213 326 L231 376 Q236 391 254 385 L301 346 L290 332 L246 362 L241 315 Z',
      frontArm:'M340 283 Q360 290 363 317 L370 382 Q373 401 355 407 L290 394 L290 375 L345 382 L338 330 Z',
      legs:['M252 486 L289 493 Q287 574 273 653 L263 810 L236 811 L243 649 Z','M302 493 L338 486 Q352 578 331 651 L324 800 L297 805 L300 648 Z'],
      shorts:'M241 477 Q290 492 343 476 L366 569 Q299 586 221 565 Z',
      hands:[{w:[294,339],e:[238,383],gesture:'support',prop:'starball',ps:175},{w:[290,385],e:[365,401],gesture:'support'}],
      shoes:[[249,816,.02],[312,807,-.07]],detail:'star',lean:.8
    },
    '丁丁':{
      head:[309,165,43,-.09],neck:'M290 206 L331 209 L337 255 L282 254 Z',
      body:'M280 245 Q250 248 233 277 L243 368 Q253 431 245 494 Q298 514 357 487 L349 372 L355 281 Q340 254 328 247 Q304 265 280 245 Z',
      backArm:'M238 280 Q217 292 212 325 L196 443 L215 449 L239 365 L258 305 Z',
      frontArm:'M351 279 Q372 282 386 310 L407 359 Q413 379 399 388 L348 365 L353 347 L384 363 L363 325 Z',
      legs:['M258 487 L301 494 Q303 574 288 649 L278 810 L249 814 L250 653 Z','M313 493 L350 484 Q372 570 344 646 L364 801 L337 810 Q315 743 313 653 Z'],
      shorts:'M245 478 L354 479 L361 566 L311 577 L300 548 L291 574 L239 559 Z',
      hands:[{w:[207,446],e:[216,373],prop:'tool',ps:230},{w:[352,355],e:[406,381],gesture:'point',prop:'flywheel',ps:170}],
      shoes:[[263,819,0],[353,810,-.14]],detail:'tool',lean:.75
    },
    '猴子':{
      head:[311,223,45,-.11],neck:'M288 262 L329 265 L339 310 L278 312 Z',
      body:'M276 299 Q244 307 225 337 L236 409 Q246 468 247 526 Q305 547 362 517 L352 418 L355 338 Q338 312 325 302 Q302 322 276 299 Z',
      backArm:'M233 340 Q208 359 204 391 L181 477 L149 505 L162 521 Q202 505 216 480 L249 404 Z',
      frontArm:'M350 343 Q377 342 390 372 L410 424 Q416 443 400 449 L359 425 L365 408 L388 422 L370 389 Z',
      legs:['M262 513 L306 525 Q289 599 253 635 L216 796 L183 796 Q195 699 223 626 Q237 562 262 513 Z','M320 521 L360 512 Q406 570 381 637 L368 792 L336 801 Q330 717 345 646 Q329 590 303 565 Z'],
      shorts:'M248 507 Q307 529 363 507 L386 590 L329 606 L305 570 L284 604 L228 579 Z',
      hands:[{w:[155,511],e:[196,487],gesture:'rest'},{w:[363,416],e:[410,442],gesture:'grip',racket:-1.24}],
      shoes:[[200,803,.13],[356,803,-.11]],detail:'wrap',lean:1.65
    },
    '路先森':{
      head:[285,174,44,.065],neck:'M265 215 L309 214 L320 266 L261 263 Z',
      body:'M259 253 Q231 256 215 287 L230 379 L231 504 Q284 525 348 497 L342 385 L344 289 Q325 259 307 252 Q284 273 259 253 Z',
      backArm:'M220 291 Q199 307 201 339 L216 438 Q220 458 237 448 L262 413 L248 402 L233 426 L236 344 Z',
      frontArm:'M338 292 Q360 296 371 326 L385 392 Q390 413 371 420 L301 423 L301 403 L360 400 L343 350 Z',
      legs:['M245 496 L287 503 Q294 586 304 653 L324 803 L296 814 Q268 747 266 657 L240 567 Z','M300 502 L341 497 Q346 591 316 656 L278 806 L248 803 Q265 728 284 648 L283 562 Z'],
      shorts:'M229 488 Q286 505 347 489 L354 579 L304 594 L289 563 L282 591 L228 576 Z',
      hands:[{w:[254,408],e:[221,447],gesture:'rest'},{w:[303,413],e:[382,412],gesture:'support',prop:'tablet',ps:275}],
      shoes:[[308,816,-.12],[262,810,.10]],detail:'plaid',lean:.7
    },
    '老陈':{
      head:[300,169,42,.025],neck:'M281 210 L320 210 L330 260 L274 261 Z',
      body:'M271 249 Q244 251 228 281 L236 375 L240 496 Q293 513 350 493 L346 380 L353 284 Q336 257 319 250 Q296 270 271 249 Z',
      backArm:'M233 283 Q211 297 213 330 L225 403 Q230 422 248 416 L282 393 L273 377 L244 396 L248 340 Z',
      frontArm:'M348 285 Q372 289 377 320 L388 409 Q390 427 373 430 L314 425 L314 406 L363 409 L350 339 Z',
      legs:['M251 490 L290 493 L286 650 L278 812 L249 814 L249 651 Z','M302 494 L341 489 Q354 582 338 650 L351 811 L322 816 L307 651 Z'],
      shorts:'M238 482 Q291 499 350 483 L353 572 L302 579 L293 550 L285 576 L234 567 Z',
      hands:[{w:[278,384],e:[231,416],gesture:'support',prop:'clipboard',ps:270},{w:[315,416],e:[385,423],gesture:'rest'}],
      shoes:[[264,820,0],[339,819,-.035]],detail:'badge',lean:.55
    },
    '果哥':{
      head:[311,167,45,-.025],neck:'M282 208 L335 207 L348 263 L270 264 Z',
      body:'M267 250 Q219 249 199 284 L213 371 Q229 426 233 509 Q302 533 384 505 L378 391 L394 284 Q375 254 333 250 Q301 276 267 250 Z',
      backArm:'M209 282 Q178 294 176 333 L179 406 Q179 433 207 445 L312 466 L320 445 L218 414 L213 355 L235 305 Z',
      frontArm:'M382 283 Q411 290 422 324 L429 384 Q432 410 406 420 L322 384 L331 363 L401 391 L390 340 Z',
      legs:['M252 500 L303 513 Q308 585 288 656 L275 811 L239 816 L240 658 Z','M320 511 L371 500 Q393 579 368 655 L376 811 L340 816 L323 654 Z'],
      shorts:'M232 490 Q309 520 383 490 L390 590 L323 602 L309 566 L296 601 L227 585 Z',
      hands:[{w:[315,455],e:[191,430],gesture:'rest'},{w:[327,373],e:[425,407],gesture:'grip'}],
      shoes:[[258,820,.025],[358,820,-.035]],detail:'tank',lean:.8
    },
    '田楚':{
      head:[306,169,43,-.025],neck:'M285 210 L328 210 L339 263 L278 263 Z',
      body:'M273 250 Q239 253 222 282 L235 384 L237 504 Q295 525 362 500 L357 389 L367 285 Q346 255 328 250 L304 272 Z',
      backArm:'M358 288 Q382 292 390 323 L407 429 L414 563 L395 566 L379 437 L358 356 Z',
      frontArm:'M232 280 Q210 290 205 323 Q200 355 216 371 Q230 380 241 360 L270 272 L288 211 L271 204 L245 264 L226 330 L230 304 Z',
      legs:['M250 497 L293 505 Q298 579 283 652 L279 813 L249 815 L247 652 Z','M306 505 L353 497 Q366 585 343 654 L358 811 L327 816 L308 655 Z'],
      shorts:'M236 489 Q296 509 361 488 L367 585 L312 593 L301 562 L289 590 L232 578 Z',
      hands:[{w:[404,565],e:[403,445],racket:1.32},{w:[280,211],e:[214,364],gesture:'point'}],
      shoes:[[264,821,.02],[345,819,-.06]],detail:'split',lean:.5
    },
    '静川':{
      head:[296,182,44,.045],neck:'M274 222 L316 222 L329 275 L268 276 Z',
      body:'M266 263 Q236 269 219 300 L230 391 L239 513 Q291 535 354 508 L347 392 L350 302 Q334 274 315 264 Q292 283 266 263 Z',
      backArm:'M225 303 Q202 318 205 348 L218 421 Q221 439 239 436 L279 411 L270 394 L237 416 L241 355 Z',
      frontArm:'M345 304 Q368 308 378 338 L395 382 Q401 396 414 383 L451 357 L461 371 Q438 410 407 420 Q381 421 369 396 L345 353 Z',
      legs:['M251 506 L293 514 Q297 588 278 654 L267 810 L238 813 L241 653 Z','M306 514 L347 506 Q368 585 345 653 L359 807 L330 813 L311 653 Z'],
      shorts:'M237 497 Q294 518 353 495 L359 585 L306 596 L297 562 L285 591 L232 578 Z',
      hands:[{w:[275,402],e:[221,432],gesture:'support',prop:'clipboard',ps:235},{w:[457,365],e:[400,416],gesture:'open'}],
      shoes:[[252,818,.03],[346,815,-.08]],detail:'whistle',lean:.7
    },
    '波波':{
      head:[306,196,45,-.065],neck:'M283 238 L327 238 L342 286 L276 289 Z',
      body:'M272 278 Q237 281 218 315 L233 406 L244 524 Q303 547 367 517 L359 415 L369 318 Q348 288 325 280 Q299 301 272 278 Z',
      backArm:'M226 318 Q202 335 207 366 L225 414 Q234 434 254 426 L295 390 L284 375 L247 403 L244 366 Z',
      frontArm:'M361 320 Q385 325 392 357 L405 413 Q409 433 389 438 L325 422 L329 404 L380 413 L365 371 Z',
      legs:['M257 516 L301 526 Q291 596 260 650 L235 800 L203 805 Q211 720 231 646 L239 568 Z','M316 526 L360 516 Q402 581 376 653 L365 805 L331 811 Q328 735 344 657 L308 570 Z'],
      shorts:'M242 508 Q307 529 368 506 L385 601 L326 615 L307 575 L287 610 L233 588 Z',
      hands:[{w:[290,382],e:[230,428],gesture:'support',prop:'fossil',ps:285},{w:[328,413],e:[401,429],gesture:'support'}],
      shoes:[[220,812,.12],[350,815,-.09]],detail:'field',lean:1.0
    },
    '苗苗':{
      head:[340,206,42,-.13],neck:'M318 246 L359 251 L359 301 L302 294 Z',
      body:'M302 281 Q274 284 256 315 L260 391 L226 494 Q264 532 330 527 L360 424 L376 329 Q365 299 352 290 Q328 304 302 281 Z',
      backArm:'M264 316 Q238 322 225 348 L182 411 L143 423 L146 442 Q189 447 211 429 L256 387 L281 339 Z',
      frontArm:'M370 323 Q392 322 405 344 L425 385 Q431 399 443 382 L472 322 L489 329 Q477 387 454 422 C435 439 410 429 399 405 L373 368 Z',
      legs:['M244 486 L287 507 Q284 577 251 639 L206 792 L171 795 Q191 700 214 632 L222 542 Z','M294 514 L333 513 Q386 560 376 624 L417 783 L385 796 Q352 726 342 640 L280 575 Z'],
      shorts:'M235 478 Q284 516 337 509 L360 580 L305 602 L278 563 L255 588 L214 562 Z',
      hands:[{w:[145,433],e:[191,433],gesture:'open'},{w:[481,325],e:[444,424],racket:-1.42}],
      shoes:[[189,803,.13],[406,796,-.20]],detail:'tape',lean:1.5
    },
    '逐晨':{
      head:[288,196,44,.095],neck:'M267 236 L309 236 L321 285 L262 283 Z',
      body:'M259 272 Q231 279 215 312 L231 411 L240 520 Q291 543 353 511 L344 406 L349 316 Q332 286 308 274 L288 294 Z',
      backArm:'M220 315 Q198 332 201 366 L210 484 L220 557 L239 554 L231 479 L239 370 Z',
      frontArm:'M344 318 Q368 322 376 351 L389 416 Q393 438 374 442 L310 436 L311 416 L365 418 L348 371 Z',
      legs:['M253 512 L295 522 Q302 594 286 658 L278 811 L248 814 L249 655 Z','M310 521 L345 510 Q372 581 346 653 L361 805 L331 814 L309 655 Z'],
      shorts:'M240 506 Q296 526 353 502 L361 600 L307 611 L297 575 L286 606 L236 589 Z',
      hands:[{w:[230,555],e:[216,480],gesture:'rest'},{w:[312,426],e:[386,437],gesture:'support',prop:'coffee',ps:260}],
      shoes:[[264,821,.02],[349,815,-.09]],detail:'office',lean:1.25
    },
    '老南':{
      head:[301,170,44,.045],neck:'M281 211 L322 211 L333 263 L275 266 Z',
      body:'M272 253 Q240 257 222 285 L233 386 L234 507 Q292 528 358 500 L353 389 L365 289 Q344 259 320 254 L298 276 Z',
      backArm:'M230 291 Q207 306 209 338 L225 409 Q232 431 250 421 L283 393 L273 377 L247 400 L245 349 Z',
      frontArm:'M358 293 Q382 300 388 332 L401 406 Q404 425 383 430 L318 422 L319 403 L377 406 L360 354 Z',
      legs:['M248 499 L291 509 Q294 587 279 654 L270 810 L240 814 L244 652 Z','M306 508 L351 500 Q371 578 349 647 L372 805 L342 814 L316 656 Z'],
      shorts:'M234 491 Q293 512 358 489 L365 588 L309 600 L298 566 L286 596 L229 581 Z',
      hands:[{w:[279,384],e:[231,423],gesture:'grip',prop:'camera',ps:260},{w:[318,413],e:[398,423],gesture:'support'}],
      shoes:[[256,820,.015],[360,815,-.13]],detail:'coat',lean:.5
    },
    '朱朱':{
      head:[303,169,46,-.085],neck:'M286 210 Q306 224 323 209 L325 241 Q337 252 366 265 L348 301 L261 302 L244 266 Q280 255 284 238 Z',
      backHair:'M266 145 C232 190 238 258 227 327 C219 402 228 474 204 548 Q232 541 249 518 Q241 562 228 579 Q277 573 291 533 Q330 566 367 548 Q380 568 402 575 Q379 516 386 453 C392 389 366 328 368 254 C374 188 352 143 315 130 Z',
      body:'M257 283 C271 301 287 302 301 296 C316 307 339 301 351 282 Q359 324 356 356 C352 393 333 420 332 453 C332 480 353 503 356 535 L359 609 Q309 628 248 611 L249 550 Q246 511 264 480 C275 458 272 435 261 408 Q242 371 246 331 Z',
      backArm:'M358 270 C375 270 383 288 387 311 L405 410 Q411 431 396 441 Q367 457 289 478 L283 462 L365 440 Q389 432 386 419 L365 326 Q358 306 350 291 Z',
      frontArm:'M248 270 C235 267 224 278 220 298 L196 389 C191 404 193 418 203 422 C215 427 223 416 228 402 L247 334 L232 327 L211 389 L233 307 Q239 288 256 290 Z',
      legs:['M260 604 L299 612 Q300 676 282 737 L273 812 L247 814 Q244 778 250 740 Z','M308 613 L347 606 Q357 673 330 728 Q324 747 331 762 L349 811 L325 816 Q302 779 303 747 Q304 720 312 699 Z'],
      hands:[{w:[239,331],e:[204,412],gesture:'brush',scale:218},{w:[286,470],e:[398,435],gesture:'rest',scale:225}],
      shoes:[[260,821,-.04],[341,820,.07]],detail:'silk',lean:.65
    },
    '腾岳':{
      head:[306,168,48,-.035],neck:'M280 210 L330 210 L344 265 L270 267 Z',
      body:'M267 253 Q225 252 205 287 L215 374 Q208 432 230 520 Q305 549 385 512 Q401 460 385 389 L393 289 Q370 259 330 253 Q301 276 267 253 Z',
      backArm:'M213 287 Q188 301 181 332 L169 408 Q164 428 184 438 L229 431 L226 410 L193 414 L214 354 L235 311 Z',
      frontArm:'M383 289 Q411 294 422 325 L442 366 Q447 382 459 369 L480 337 L496 347 Q483 391 459 405 C437 421 412 400 403 381 L378 338 Z',
      legs:['M246 510 L300 523 Q308 589 284 657 L270 813 L235 818 L236 659 Z','M316 524 L370 512 Q398 585 371 654 L386 807 L350 817 L322 655 Z'],
      shorts:'M228 502 Q306 528 385 500 L394 601 L323 616 L308 577 L291 612 L221 592 Z',
      hands:[{w:[226,421],e:[177,432],gesture:'support',prop:'basket',ps:300},{w:[487,342],e:[453,402],racket:-2.98}],
      shoes:[[253,825,.025],[372,819,-.105]],detail:'jersey',lean:1.1
    },
    '云衡':{
      head:[303,180,45,.015],neck:'M281 220 L326 221 L340 273 L273 274 Z',
      body:'M270 262 Q237 265 219 295 L231 394 L236 517 Q298 540 366 512 L360 397 L371 298 Q347 269 324 263 L303 285 Z',
      backArm:'M227 299 Q205 315 207 348 L223 413 Q230 436 251 428 L292 404 L281 388 L247 408 L244 357 Z',
      frontArm:'M364 301 Q388 307 394 337 L407 405 Q411 426 390 432 L329 421 L331 402 L383 408 L365 362 Z',
      legs:['M251 510 L296 518 Q304 592 285 658 L277 813 L246 817 L247 654 Z','M311 519 L359 510 Q382 587 356 656 L372 808 L341 816 L315 656 Z'],
      shorts:'M235 502 Q301 524 365 501 L374 598 L315 609 L303 574 L289 605 L232 589 Z',
      hands:[{w:[287,395],e:[225,429],gesture:'support',prop:'tablet',ps:280},{w:[331,411],e:[403,427],gesture:'point'}],
      shoes:[[262,823,0],[359,819,-.06]],detail:'circuit',lean:.4
    },
    '小学生':{
      head:[308,279,45,-.13],neck:'M290 319 L329 320 L333 363 L283 363 Z',
      body:'M280 350 Q252 356 239 383 L245 453 L231 552 Q277 577 334 553 L345 467 L357 390 Q341 361 325 351 Q302 371 280 350 Z',
      backArm:'M245 385 Q225 398 218 426 L197 488 Q192 504 207 511 L250 498 L246 480 L224 488 L241 450 L262 411 Z',
      frontArm:'M351 390 Q373 391 385 416 L401 448 Q409 459 419 444 L453 390 L468 401 Q447 457 424 479 Q407 494 389 478 L360 440 Z',
      legs:['M245 547 L283 557 Q287 615 267 661 L245 807 L218 811 Q225 727 238 657 Z','M296 558 L331 549 Q368 602 349 651 L382 742 L363 758 Q332 711 318 662 L283 607 Z'],
      shorts:'M233 541 Q281 561 336 539 L354 614 L308 627 L285 593 L267 619 L223 601 Z',
      hands:[{w:[247,489],e:[202,507],gesture:'support',prop:'clipboard',ps:220},{w:[461,395],e:[418,479],gesture:'point'}],
      shoes:[[232,819,.05],[376,756,-.45]],detail:'school',lean:1.5
    }
  };

  // Keep each drawing's contours and stance; retarget their anatomical regions
  // once, instead of stretching the whole picture or reusing a skeleton pose.
  const figureGeometryCache=new Map();
  // Offset the closed contour itself, so adding limb volume never creates
  // nested outlines or a skin-coloured ring around a clothing cuff.
  function contourPoints(d){
    const tokens=d.match(/[MLCQZ]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g),pts=[];let at=[0,0];
    for(let i=0;i<tokens.length;){
      const c=tokens[i++],n=pathArgs[c],v=tokens.slice(i,i+n).map(Number);i+=n;
      if(c==='M'){at=v;pts.push(v);}else if(c==='L'){at=v;pts.push(v);}else if(c==='Q'||c==='C'){
        const start=at;
        for(let j=1;j<=10;j++){const t=j/10,u=1-t;pts.push(c==='Q'?[u*u*start[0]+2*u*t*v[0]+t*t*v[2],u*u*start[1]+2*u*t*v[1]+t*t*v[3]]:[u**3*start[0]+3*u*u*t*v[0]+3*u*t*t*v[2]+t**3*v[4],u**3*start[1]+3*u*u*t*v[1]+3*u*t*t*v[3]+t**3*v[5]]);}at=pts[pts.length-1];
      }
    }
    return pts;
  }
  function inflateContour(d,pad){
    const pts=contourPoints(d);
    const clean=pts.filter((p,i)=>!i||Math.hypot(p[0]-pts[i-1][0],p[1]-pts[i-1][1])>.05);
    if(Math.hypot(clean[0][0]-clean.at(-1)[0],clean[0][1]-clean.at(-1)[1])<.05)clean.pop();
    const area=clean.reduce((s,p,i)=>{const q=clean[(i+1)%clean.length];return s+p[0]*q[1]-q[0]*p[1];},0),sign=area>0?1:-1;
    const normal=(p,q)=>{const dx=q[0]-p[0],dy=q[1]-p[1],len=Math.hypot(dx,dy)||1;return [dy/len*sign,-dx/len*sign];};
    const out=clean.map((p,i)=>{const a=normal(clean[(i+clean.length-1)%clean.length],p),b=normal(p,clean[(i+1)%clean.length]),len=Math.hypot(a[0]+b[0],a[1]+b[1])||1,n=[(a[0]+b[0])/len,(a[1]+b[1])/len],r=pad/Math.max(.65,n[0]*b[0]+n[1]*b[1]);return [p[0]+n[0]*r,p[1]+n[1]*r];});
    const f=v=>Number(v.toFixed(3)),mid=(p,q)=>[f((p[0]+q[0])*.5),f((p[1]+q[1])*.5)];
    return 'M'+mid(out.at(-1),out[0]).join(' ')+' '+out.map((p,i)=>'Q'+p.map(f).join(' ')+' '+mid(p,out[(i+1)%out.length]).join(' ')).join(' ')+' Z';
  }
  function figureGeometry(look){
    const a=figures[look.name]||figures['凌风'],key=look.name;
    if(figureGeometryCache.has(key))return figureGeometryCache.get(key);
    const first=d=>d.match(/[-+]?(?:\d*\.\d+|\d+)/g).slice(0,2).map(Number);
    const top=first(a.body)[1],hip=a.detail==='silk'?480:(first(a.legs[0])[1]+first(a.legs[1])[1])*.5;
    const mid=a.head[0],wide=['tank','jersey','apron'].includes(a.detail)?1.065:1.115;
    const mapY=y=>{const d=y-hip,hinge=d<-24?0:d>24?d:(d+24)**2/96;return top+(y-top)*.94-hinge*.18;};
    const map=(x,y)=>[mid+(x-mid)*wide,mapY(y)];
    const center=map(a.head[0],a.head[1]+(a.detail==='silk'?17:7)),footY=Math.max(...a.shoes.map(s=>mapY(s[1])+27));
    const heads=look.identity==='calligraphy'?5:look.mature||look.age?4.98:look.identity==='pupil'?4.82:['tank','apron','jersey'].includes(a.detail)?4.94:style.targetHeads;
    const headRadius=(footY-center[1])/(2.37*heads-1.34),paths=new Map();
    const path=d=>{
      if(paths.has(d))return paths.get(d);
      const t=d.match(/[MLCQZ]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g)||[],out=[];
      for(let i=0;i<t.length;){const c=t[i++],n=pathArgs[c];out.push(c);for(let k=0;k<n;k+=2){const q=map(+t[i++],+t[i++]);out.push(...q.map(v=>Number(v.toFixed(3))));}}
      const result=out.join(' ');if(paths.size>512)paths.clear();paths.set(d,result);return result;
    };
    const padded=new Map(),limbPath=(d,pad)=>{const key=pad+'|'+d;if(!padded.has(key))padded.set(key,inflateContour(path(d),pad));return padded.get(key);};
    // Find the actual calf/ankle centre from each leg outline, including crossed
    // and lifted legs. Shoes and sock cuffs use this same local foot frame.
    const feet=a.shoes.map((shoe,index)=>{
      const pts=contourPoints(a.legs[index]);
      const section=y=>{const xs=[];for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length];if((p[1]<=y&&q[1]>y)||(q[1]<=y&&p[1]>y))xs.push(p[0]+(q[0]-p[0])*(y-p[1])/(q[1]-p[1]));}return xs.length>1?(Math.min(...xs)+Math.max(...xs))*.5:shoe[0];};
      const ankle=map(section(shoe[1]-20),shoe[1]-6),calf=map(section(shoe[1]-85),shoe[1]-85);
      const outward=ankle[0]<mid?.075:-.075;
      const angle=clamp(-Math.atan2(ankle[0]-calf[0],ankle[1]-calf[1])*.38+outward,-.25,.25);
      return {ankle,calf,angle,index};
    });
    const result={map,mapY,path,limbPath,wide,top,hip,feet,head:center,headRadius,headCount:heads,footY};figureGeometryCache.set(key,result);return result;
  }
  function figureRacket(g,x,y,angle,look){
    g.save();g.translate(x,y);g.rotate(angle);g.lineCap='round';
    vectorPath(g,'M-10 0 L26 0',null,look.outline,9);
    vectorPath(g,'M-9 0 L25 0',null,look.grip||'#354253',6.5);
    vectorPath(g,'M-6 -2 L20 -2',null,Y.tint(look.trim,.65),1.2);
    vectorPath(g,'M26 0 L133 0',null,'#a5bdc4',2.8);
    g.translate(168,0);oval(g,0,0,38,29,'#b7dbd40b','#243c4c',5.8);oval(g,0,0,38,29,null,look.racket,3.2);
    g.save();g.beginPath();g.ellipse(0,0,34,25,0,0,TAU);g.clip();
    for(let i=-3;i<=3;i++)vectorPath(g,`M${i*10} -27 L${i*10} 27 M-39 ${i*8} L39 ${i*8}`,null,'#dceae0bb',.85);
    g.restore();vectorPath(g,'M-31 -14 Q0 -36 31 -14',null,look.racket2,1.7);g.restore();
  }
  // Front / slight three-quarter footwear: the toe projects towards the
  // viewer, centred beneath the ankle, never sideways to screen-right.
  function figureShoe(g,foot,look){
    g.save();g.translate(...foot.ankle);g.rotate(foot.angle);g.lineJoin='round';g.lineCap='round';
    const edge=Y.shade(look.outline,1.14),p=(d,f,c=edge,w=2.0)=>vectorPath(g,d,f,c,w);
    const upper=g.createLinearGradient(-22,-24,24,31);upper.addColorStop(0,Y.shade(look.shoe,1.08));upper.addColorStop(.65,look.shoe);upper.addColorStop(1,Y.shade(look.shoe,.94));
    if(look.dress){
      // A closed-toe, low-heel pump belongs to her satin dress and stockings.
      p('M-14 -17 Q0 -24 14 -17 L17 2 Q17 15 9 25 L0 32 Q-9 26 -15 16 Q-20 6 -16 -5 Z',upper);
      p('M-14 -15 Q0 -5 14 -15 L12 -3 Q0 6 -12 -3 Z',look.stockings,edge,1.2);
      p('M-16 13 Q-8 27 0 31 Q9 26 16 13 L15 21 Q7 31 0 34 Q-8 30 -15 22 Z',look.sole,null);
      p('M-10 10 Q-2 7 5 12',null,Y.tint('#edb7bc',.45),1.3);
      p('M-12 -7 Q0 -1 12 -7',null,look.trim,1.4);
      oval(g,0,-4,2.3,2.8,look.trim);g.restore();return;
    }
    p('M-15 -22 Q0 -29 15 -22 Q20 -13 19 -3 L23 12 Q26 29 16 34 Q0 39 -16 34 Q-26 29 -23 12 L-19 -3 Q-20 -13 -15 -22 Z',upper);
    p('M-24 23 Q0 34 24 23 L24 31 Q18 40 0 40 Q-18 40 -24 31 Z',Y.shade(look.sole,1.08),edge,1.8);
    p('M-23 31 Q0 42 23 31 L21 36 Q0 46 -21 36 Z',Y.shade(look.sole,.88),null);
    p('M-15 -21 Q0 -28 15 -21 L13 -10 Q0 -4 -13 -10 Z',look.shirt2,edge,1.2);
    p('M-9 -17 Q0 -20 9 -17 L12 8 Q0 13 -12 8 Z',Y.shade(look.shoe,1.12),Y.tint(edge,.38),1.0);
    p('M-10 -11 L10 -11 M-11 -4 L11 -4 M-11 3 L11 3',null,'#f5f0e3',1.8);
    p('M-19 16 Q0 8 19 16',null,Y.tint(edge,.32),1.2);
    p('M-17 -7 L-20 9 M17 -7 L20 9',null,look.trim,2.6);
    p('M-9 22 Q0 25 9 22',null,Y.tint('#ffffff',.42),1.1);g.restore();
  }
  function figureProp(g,h,look,time){
    const [x,y]=h.w,p=(d,f,c='#43505a',w=2)=>vectorPath(g,d,f,c,w);
    if(h.racket!=null)figureRacket(g,x,y,h.racket,look);
    if(h.prop==='flywheel'){flywheel(g,x+8,y-26,24,time*.12,0,0);return;}
    if(!h.prop)return;
    g.save();g.translate(x+(h.offset?.[0]||0),y+(h.offset?.[1]||0));g.rotate(h.rotation||-.065);
    if(['plan','clipboard','tablet','fossil'].includes(h.prop)){
      const tablet=h.prop==='tablet',fossil=h.prop==='fossil',w=fossil?75:82,hh=fossil?91:104;
      p(`M${-w/2+6} ${-hh} L${w/2-6} ${-hh} Q${w/2} ${-hh} ${w/2} ${-hh+6} L${w/2} 7 Q${w/2} 13 ${w/2-6} 13 L${-w/2+6} 13 Q${-w/2} 13 ${-w/2} 7 L${-w/2} ${-hh+6} Q${-w/2} ${-hh} ${-w/2+6} ${-hh} Z`,tablet?'#2d4b60':fossil?'#bfad89':'#cfb784');
      if(fossil){emblem(g,'fossil',0,-42,24,'#77694f');p('M-25 -72 Q-20 -79 -11 -75 M18 -10 L26 -16',null,'#e6d8b8',1.4);}
      else{
        p(`M-34 ${-hh+10} L34 ${-hh+10} L34 4 L-34 4 Z`,tablet?'#c6e1dc':'#f6ecd0',null);
        if(tablet){
          p('M-24 -74 L-13 -57 L-2 -65 L11 -37 L25 -45',null,'#557f83',2.5);
          p('M-24 -26 L25 -26 M-24 -18 L10 -18',null,'#9ab8b5',1.4);oval(g,0,8,2.1,2.1,'#9fbdbb');
        }else{
          p('M-15 -108 L15 -108 Q20 -108 20 -102 L20 -93 L-20 -93 L-20 -102 Q-20 -108 -15 -108 Z','#789699','#405966',1.6);
          p('M-10 -103 L10 -103',null,'#dce7df',1.5);
          p('M-23 -76 L18 -76',null,look.name==='小红'?'#d28156':'#6a8a86',2.8);
          for(let i=0;i<4;i++)p(`M-23 ${-60+i*14} L23 ${-60+i*14}`,null,'#b7b498',1.25);
          if(look.name==='小红'){p('M-17 -55 L-17 -20 L21 -20 M-15 -24 L-3 -45 L18 -29',null,'#6e9797',1.25);}
          else for(let i=0;i<3;i++)p(`M-25 ${-58+i*14} L-22 ${-55+i*14} L-17 ${-61+i*14}`,null,'#7d9a89',1.4);
        }
      }
    }else if(h.prop==='coffee'){
      p('M-24 -63 L23 -63 L18 8 Q0 16 -18 8 Z','#eee6d4');
      p('M-24 -44 L23 -44 L21 -10 L-21 -10 Z','#b58b68',null);
      p('M-27 -66 Q0 -74 27 -66 L27 -60 L-27 -60 Z','#5a4c47');
      emblem(g,'shuttle',0,-28,10,'#e7d4b5');
    }else if(h.prop==='camera'){
      p('M-40 -59 L-25 -59 L-21 -72 L5 -72 L13 -59 L39 -59 L43 -15 L-43 -15 Z','#354956');
      oval(g,5,-39,23,22,'#94b4ba','#263b4c',2);oval(g,5,-39,16,16,'#244253');oval(g,0,-45,5,5,'#d6eee6');
      p('M-31 -51 L-20 -51',null,'#d4bd87',3);
    }else if(h.prop==='bun'){
      oval(g,0,-17,33,23,'#f2d7a6','#b8956f',1.7);
      p('M-21 -18 Q-8 -39 0 -34 Q13 -40 22 -18 M-9 -11 Q-10 -30 0 -34 M10 -10 Q13 -29 0 -34',null,'#c7a47b',1.5);
    }else if(h.prop==='basket'){
      oval(g,0,-35,43,43,'#dd9751','#6f4e3a',2.3);
      p('M-43 -35 L43 -35 M0 -78 L0 8 M-32 -64 Q14 -30 -31 -5 M32 -64 Q-14 -30 31 -5',null,'#805633',2);
      p('M-25 -60 Q-8 -72 7 -70',null,'#efbb7b',2);
    }else if(h.prop==='shuttle'||h.prop==='starball'){
      g.rotate(-.18);
      p('M-12 -7 L-31 -58 Q0 -74 31 -58 L12 -7 Z','#f2f1df','#9fb8be',1.7);
      for(let i=-2;i<=2;i++)p(`M${i*5} -11 L${i*12} -59`,null,'#a6bdba',1.2);
      oval(g,0,-4,13,10,'#d5bd90','#aa9474',1.5);
    }else if(h.prop==='tool'){
      g.rotate(.25);p('M-4 14 L-4 -50 L4 -50 L4 14 Z','#d3b074','#6c644e',1.5);
      p('M-9 -50 L-13 -68 L-6 -78 L-3 -64 L3 -64 L6 -78 L13 -68 L9 -50 Z','#adbec1','#536975',1.7);
    }
    g.restore();
  }
  function figureDetails(g,a,look,geo){
    const edge=Y.shade(look.outline,1.12),c=look.trim,mid=a.head[0],top=geo.top;
    const p=(d,f,s=null,w=style.seam)=>vectorPath(g,geo.path(d),f,s,w);
    const mark=(kind,x,y,r,color)=>{const q=geo.map(x,y);emblem(g,kind,...q,r*geo.wide,color);};
    if(a.detail==='silk'){
      p('M249 269 L256 265 L265 291 L259 296 Z',look.shirt,edge,1.2);
      p('M350 293 L357 265 L363 270 L355 287 Z',look.shirt,edge,1.2);
      p('M261 264 Q278 263 291 277 M315 277 Q332 263 350 265',null,Y.tint(look.skin2,.68),1.1);
      p('M287 232 Q305 243 323 231 L325 241 Q309 254 304 264 Q292 252 287 244 Z',Y.tint(look.skin2,.35));
    }
    // All small clothing details are clipped to the actual independent body.
    g.save();vectorPath(g,geo.path(a.body));g.clip();
    if(a.detail==='silk'){
      p('M267 315 Q289 337 281 384 Q274 422 286 454 Q300 482 278 525 Q274 563 292 616 L319 620 Q309 567 326 536 Q339 511 322 479 Q308 451 320 410 Q329 362 340 314 Q306 332 267 315 Z',Y.shade(look.shirt,1.12));
      p('M257 290 Q280 309 301 302 Q327 311 351 289',null,c,1.8);
      p('M268 455 Q299 469 332 457',null,c,1.6);
      p('M332 462 L339 465 L349 601 L341 607 Z','#9b5265');
      p('M275 340 Q286 366 277 393 M331 334 Q317 369 322 393 M268 536 Q296 526 318 535',null,Y.tint('#b49aa6',.38),1.1);
      p('M254 606 Q303 620 354 606',null,Y.tint(c,.60),1.3);
      const q=geo.map(334,461);oval(g,...q,4.5,5.5,c,edge,1.2);g.restore();return;
    }
    const formal=['office','coat','circuit','plaid','field','tool','badge','split'].includes(a.detail);
    if(formal){
      p(`M${mid-19} ${top+12} L${mid-27} ${top+41} L${mid-9} ${top+56} M${mid+18} ${top+13} L${mid+26} ${top+41} L${mid+9} ${top+56}`,null,c,1.7);
      p(`M${mid} ${top+34} L${mid+4} ${top+214}`,null,Y.tint(c,.42),1.1);
      if(a.detail==='plaid'){
        for(let i=0;i<4;i++){const yy=top+76+i*32;p(`M${mid-56} ${yy} Q${mid} ${yy+5} ${mid+56} ${yy-1}`,null,Y.tint(look.plaid||look.panel,.48),1.2);}
        for(const x of[-28,22])p(`M${mid+x} ${top+50} L${mid+x+5} ${top+219}`,null,Y.tint(look.plaid||look.panel,.44),1.2);
      }
      if(a.detail==='office'){
        p(`M${mid-4} ${top+31} L${mid+7} ${top+37} L${mid+10} ${top+125} L${mid} ${top+139} L${mid-9} ${top+127} Z`,'#b77e55');
      }
      if(['tool','field','badge','circuit'].includes(a.detail)){
        p(`M${mid-46} ${top+92} L${mid-12} ${top+93} L${mid-12} ${top+131} Q${mid-30} ${top+139} ${mid-46} ${top+130} Z`,Y.shade(look.shirt,1.06),Y.tint(c,.68),1.2);
        if(a.detail==='field'||a.detail==='tool')p(`M${mid-37} ${top+96} L${mid-37} ${top+68} M${mid-24} ${top+96} L${mid-24} ${top+76}`,null,'#d4bd89',3);
      }
    }else{
      p(`M${mid-29} ${top+10} Q${mid} ${top+39} ${mid+27} ${top+10}`,null,Y.shade(look.shirt,.78),5.5);
      p(`M${mid-29} ${top+9} Q${mid} ${top+36} ${mid+27} ${top+9}`,null,c,2.3);
    }
    if(a.detail==='apron'){
      p('M263 305 Q299 316 339 304 L357 503 Q304 518 244 501 Z',look.panel,Y.tint(look.trim,.75),1.6);
      p('M277 403 L325 404 L325 439 Q302 449 277 440 Z',null,Y.tint(look.trim,.7),1.2);
    }
    if(['sash','split','tape','wrap'].includes(a.detail)){
      p(`M${mid-54} ${top+35} Q${mid-14} ${top+95} ${mid+41} ${top+154}`,null,Y.tint(look.panel,.82),11);
      p(`M${mid-54} ${top+35} Q${mid-14} ${top+95} ${mid+41} ${top+154}`,null,Y.tint(c,.85),1.4);
    }
    if(a.detail==='bow')mark('bow',mid,top+58,14,look.shirt2);
    if(a.detail==='star')for(const [x,y]of[[-23,74],[16,116],[-7,158]])mark('star',mid+x,top+y,7,c);
    if(a.detail==='whistle'){
      p(`M${mid-21} ${top+20} L${mid+6} ${top+110} L${mid+25} ${top+21}`,null,'#d89e80',1.6);const q=geo.map(mid+6,top+110);oval(g,...q,8,5,'#dfebe1',edge,1.2);
    }
    if(a.detail==='school'){
      p('M274 377 L302 389 L327 375 L313 403 L326 427 L311 432 L297 409 L283 424 L274 416 L290 399 Z','#e55c4c',edge,1.4);
      p('M259 374 L252 478 M334 381 L327 475',null,'#668b91',6);
    }
    if(!['office','coat','field','school','star'].includes(a.detail))mark(profile(look).motif,mid-29,top+81,10.5,Y.tint(c,.90));
    if(look.num&&!['silk','office','field','school'].includes(a.detail)){
      const q=geo.map(mid+7,top+164);g.save();g.fillStyle=Y.tint(look.panel,.90);g.textAlign='center';g.font='600 21px '+Y.FONT;g.fillText(look.num,...q);g.restore();
    }
    // Short folds originate at the armhole and waist; no dense decorations.
    for(const s of[-1,1])p(`M${mid+s*44} ${top+142} Q${mid+s*37} ${top+151} ${mid+s*40} ${top+163} M${mid+s*34} ${top+216} Q${mid+s*26} ${top+208} ${mid+s*12} ${top+209}`,null,Y.tint(look.outline,.20),style.fold);
    g.restore();
    if(a.detail==='office'){
      p(`M${mid-52} ${top+22} L${mid+40} ${top+222}`,null,'#617482',6);
      p(`M${mid+27} ${top+192} L${mid+102} ${top+202} L${mid+98} ${top+270} L${mid+26} ${top+260} Z`,'#3e5360','#9fb6b9',1.8);
      p(`M${mid+32} ${top+209} L${mid+96} ${top+217}`,null,'#b8c6c0',1.1);
    }
    if(a.detail==='coat')p(`M${mid-47} ${top+41} L${mid+42} ${top+219}`,null,'#9fb5c1',4);
  }
  function drawFigure(g,look,time=0){
    const a=figures[look.name]||figures['凌风'],geo=figureGeometry(look),edge=Y.shade(look.outline,1.12);
    const p=(d,f,s=edge,w=style.outline)=>vectorPath(g,geo.path(d),f,s,w),clip=d=>{vectorPath(g,geo.path(d));g.clip();};
    const skin=g.createLinearGradient(180,240,420,500);skin.addColorStop(0,Y.shade(look.skin,1.045));skin.addColorStop(.68,look.skin);skin.addColorStop(1,Y.shade(look.skin2,1.08));
    const cloth=g.createLinearGradient(205,300,400,500);cloth.addColorStop(0,Y.shade(look.shirt,.96));cloth.addColorStop(.40,Y.shade(look.shirt,1.04));cloth.addColorStop(1,Y.shade(look.shirt,.91));
    const drawLimb=(d,color,pad=3.5)=>vectorPath(g,geo.limbPath(d,pad),color,edge,2.5);
    g.save();g.lineJoin='round';g.lineCap='round';
    const floor=g.createRadialGradient(305,geo.footY,8,305,geo.footY,113);floor.addColorStop(0,'#03152250');floor.addColorStop(1,'#03152200');
    g.save();g.translate(0,geo.footY*.87);g.scale(1,.13);oval(g,305,geo.footY,114,58,floor);g.restore();
    if(a.detail==='school'){
      p('M241 369 Q214 369 212 399 L205 504 Q215 531 247 531 L263 424 Z','#d6ae53');p('M211 437 L239 440 L237 498 L209 499 Z','#7caaa5');
    }
    a.legs.forEach((d,i)=>drawLimb(d,look.stockings||(i?skin:Y.shade(look.skin,.96)),look.identity==='calligraphy'?1.8:look.stockings?3.8:4.8));
    // Socks, ankle openings and toes stay in the same left/right frame.
    if(!look.stockings)for(const foot of geo.feet){
      g.save();g.translate(...foot.ankle);g.rotate(foot.angle);
      vectorPath(g,'M-16 -31 Q0 -28 16 -31 L15 -12 Q0 -6 -15 -12 Z',look.sock,edge,1.8);
      vectorPath(g,'M-16 -28 Q0 -24 16 -28',null,Y.tint(look.trim,.70),1.6);g.restore();
    }
    geo.feet.forEach(foot=>figureShoe(g,foot,look));
    if(a.shorts){
      p(a.shorts,look.shorts,edge,2.7);g.save();clip(a.shorts);
      const hip=geo.hip,m=a.head[0];
      p(`M${m-51} ${hip+55} Q${m-25} ${hip+68} ${m-6} ${hip+60} M${m+8} ${hip+64} Q${m+34} ${hip+71} ${m+61} ${hip+58}`,null,Y.shade(look.shorts,1.15),4);
      p(`M${m-46} ${hip+22} L${m-45} ${hip+47} M${m+43} ${hip+20} L${m+47} ${hip+45}`,null,Y.tint(look.stripe,.75),2.1);
      g.restore();
    }
    const breath=Math.sin(time*(1.35+a.lean*.25)+a.head[0]*.03)*Math.min(1.0,a.lean);
    g.save();g.translate(0,breath);
    if(a.backHair&&!look.shortHair){
      p(a.backHair,look.hairC);g.save();clip(a.backHair);
      p('M243 207 Q263 330 236 510 Q273 476 264 366 L285 185 Z',Y.tint(look.hairHi,.38),null);
      p('M349 210 Q332 352 376 528 L390 543 Q357 351 365 218 Z',Y.tint(look.hairHi,.24),null);g.restore();
    }
    const armPad=look.identity==='calligraphy'?1.5:4.2;
    p(a.neck,skin);drawLimb(a.backArm,skin,armPad);p(a.body,cloth);
    g.save();clip(a.body);p('M355 245 Q328 360 340 450 L395 650 L451 648 L430 242 Z',Y.tint(look.shirt2,.13),null);g.restore();
    figureDetails(g,a,look,geo);
    // Her returning forearm crosses the waist in front of the dress. Drawing
    // that part behind the bodice would leave a detached hand at the belt.
    if(a.detail==='silk')drawLimb(a.backArm,skin,armPad);
    const sleeve=d=>{
      if(look.tank)return;const v=d.match(/[-+]?(?:\d*\.\d+|\d+)/g).slice(0,2).map(Number),q=geo.map(v[0],v[1]);
      g.save();vectorPath(g,geo.limbPath(d,4.2));g.clip();oval(g,q[0],q[1]+18,46,49,cloth);
      vectorPath(g,`M${q[0]-41} ${q[1]+55} Q${q[0]} ${q[1]+66} ${q[0]+41} ${q[1]+53}`,null,Y.tint(look.trim,.66),1.5);g.restore();
    };
    sleeve(a.backArm);drawLimb(a.frontArm,skin,armPad);sleeve(a.frontArm);
    // One coordinate transform moves wrist, prop and fingers together.
    for(const src of a.hands){
      const h={...src,w:geo.map(...src.w),e:geo.map(...src.e)};figureProp(g,h,look,time);
      const scale=src.scale?src.scale*1.17:275;
      g.save();g.translate(...h.w);g.scale(scale,scale);hand(g,[(h.e[0]-h.w[0])/scale,(h.e[1]-h.w[1])/scale],[0,0],look,h.racket!=null?{gesture:'grip',angle:h.racket}:h.gesture||'grip');g.restore();
    }
    g.save();g.translate(...geo.head);g.rotate(a.head[3]);g.scale(geo.headRadius,geo.headRadius);
    head(g,look,{expression:acting(look).expression,time,turn:a.head[3]*2,gaze:.15,quality:1});g.restore();
    g.restore();g.restore();
  }
  function fitFigure(g,look,x,y,w,h,time=0){
    const painted=Y.CharacterSprites?.figure(g,look,x,y,w,h,time);if(painted)return painted;
    const geo=figureGeometry(look),left=42,right=569,top=geo.head[1]-geo.headRadius*1.62,bottom=geo.footY+9;
    const k=Math.min(w/(right-left),h/(bottom-top)),ox=x+w*.5-(left+right)*.5*k,oy=y+h-(bottom-top)*k-top*k;
    g.save();g.translate(ox,oy);g.scale(k,k);drawFigure(g,look,time);g.restore();
    return {x:ox+left*k,y:oy+top*k,w:(right-left)*k,h:(bottom-top)*k,pose:{authored:true,character:look.name,time,headCount:geo.headCount}};
  }

  Y.CharacterArt={faceWidths,figureShoe,figureGeometry,figures,drawFigure,fitFigure,style,headScale,vectorPath,brushGrip,brushEnds,profiles,profile,emblem,head,head2D,ribbon,butterfly,flywheel,burst,limb,hand,acting,displayPose,action,family,uniform2D,motionFor,mechanical,gestures,displayStances,displayBounds,showcaseAccessory};
})(typeof GameGlobal!=='undefined'?GameGlobal:typeof window!=='undefined'?window:globalThis);
