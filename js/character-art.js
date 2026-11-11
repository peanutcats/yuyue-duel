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
  const displayHands={
    '凌风':[[.45,1.52],1.7,[-.4,1.62]],'沧澜':[[.48,1.15],.6,[-.28,.98]],
    '小红':[[.45,1.38],1.0,[-.03,1.62]],'冉冉':[[.50,1.14],.75,[-.48,1.58]],
    '王瑞':[[.42,1.30],1.2,[-.38,1.06]],'星星':[[.27,1.45],1.75,[-.35,1.65]],
    '丁丁':[[.38,1.16],1.2,[-.18,1.60]],'猴子':[[.43,1.58],2.7,[-.4,1.02]],
    '路先森':[[.43,.95],-.18,[-.24,1.56]],'老陈':[[.36,1.16],.65,[-.2,1.17]],
    '果哥':[[.43,1.63],1.95,[-.45,1.66]],'田楚':[[.50,1.14],.62,[-.21,.96]],
    '朱老师':[[.46,1.17],.9,[-.41,1.42]],'波波':[[.39,1.54],1.6,[-.35,1.05]],
    '苗苗':[[.51,1.45],1.0,[-.4,1.54]],'马哥':[[.38,.98],-.4,[-.24,1.38]],
    '老南':[[.41,1.13],.7,[-.23,1.31]],'朱朱':[[.43,1.31],1.12,[-.28,1.59]],
    '孙大帅':[[.42,1.56],2.0,[-.42,1.10]],'董总':[[.42,1.22],1.1,[-.18,1.40]]
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
    g.beginPath();g.moveTo(-.025,-.027);g.quadraticCurveTo(.014,-.045,.046,-.022);g.quadraticCurveTo(.066,.01,.037,.036);g.lineTo(-.023,.028);g.closePath();g.fill();g.stroke();
    g.beginPath();g.moveTo(-.01,.018);g.quadraticCurveTo(.018,.057,.039,.028);g.stroke();
    if(grip){g.beginPath();g.moveTo(.023,-.025);g.lineTo(.025,.013);g.moveTo(.037,-.018);g.lineTo(.039,.009);g.stroke();}g.restore();
  }
  function displayPose(p,time,look,base){
    const a=acting(look),P={...base};for(const k of Object.keys(P))if(Array.isArray(P[k]))P[k]=P[k].slice();
    const breathe=Math.sin(time*2.1)*.008;
    P.H=[a.hip,.86+breathe];P.H1=[a.hip+.055,.86+breathe];P.H2=[a.hip-.055,.85+breathe];
    P.F1=[a.front,.015];P.F2=[a.back,.045];P.K1=[lerp(P.H1[0],a.front,.55)+.08,.43];P.K2=[lerp(P.H2[0],a.back,.5)+.06,.45];
    P.S=[a.hip+.15,1.37+breathe];P.S2=[a.hip-.14,1.36+breathe];P.N=[a.hip-.015,1.46+breathe];P.hd=[a.hip+a.tilt*.14,1.64+breathe];
    const hands=displayHands[look.name]||displayHands['凌风'];
    const elbow=(s,w,side)=>{const dx=w[0]-s[0],dy=w[1]-s[1],d=Math.max(.001,Math.hypot(dx,dy)),along=(d*d+.29**2-.27**2)/(2*d),bend=Math.sqrt(Math.max(0,.29**2-along*along));return[s[0]+dx/d*along-dy/d*bend*side,s[1]+dy/d*along+dx/d*bend*side];};
    P.W=[hands[0][0]+a.hip,hands[0][1]+breathe];P.W2=[hands[2][0]+a.hip,hands[2][1]+breathe];P.E=elbow(P.S,P.W,-1);P.E2=elbow(P.S2,P.W2,1);P.Rk=hands[1];P.rs=1;P.ux=(P.N[0]-P.H[0])/.56;P.uy=(P.N[1]-P.H[1])/.56;P.lean=a.tilt*.2;P.chestYaw=a.tilt;return P;
  }
  function head2D(g,P,look,o={}){const a=acting(look);g.save();g.translate(...P.hd);g.rotate((o.showcase?a.tilt:clamp(P.lean*.35,-.2,.2)));g.scale(.147,-.147);head(g,look,{turn:.22,time:o.time||0,focus:!!P.motion,gaze:clamp(o.gazeX||0,-1,1),expression:o.showcase?a.expression:undefined,mood:o.mood,quality:o.quality??1});g.restore();}
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
    yati:['focus',70,1.6,95,1.7],yueqiu:['place',-32,.45,35,1.1],shuangji:['place',88,.7,128,.7],
    ganggan:['focus',75,.55,40,1.5],jiepan:['place',45,.4,135,.45],qiquan:['focus',22,1.4,118,.8],
    jingxiang:['summon',110,.6,65,.6],meida:['focus',58,1.4,120,1.4],shuizhong:['leap',-12,.6,130,.5],
    jiezou:['focus',68,.8,112,.85],biaozhi:['place',-55,.5,-18,.8],tingyixia:['focus',80,1.7,90,.2],
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
  function head(g,look,{back=false,turn=0,time=0,focus=false,gaze=0,quality=1,expression,mood}={}){
    const art=profile(look),act=acting(look),expr=expression||(['happy','cheer','smile'].includes(mood)?'laugh':focus?'focused':act.expression),R=1,hair=look.hair,outline=look.outline||'#17202e';
    g.save();g.scale(act.faceW,1);if(look.identity==='basketball')g.scale(1.02,1);g.lineCap='round';g.lineJoin='round';g.lineWidth=.065;g.strokeStyle=outline;
    const skin=g.createLinearGradient(-1,-1,1,1);skin.addColorStop(0,look.skin);skin.addColorStop(.55,look.skin);skin.addColorStop(1,look.skin2);
    // Layered locks have deterministic spring lag, including ties and clips.
    const sway=Math.sin(time*5.2)*.08+turn*.16;
    if(['ponytail','twin','long','bangs','bun'].includes(hair)){
      g.fillStyle=look.hairC;
      const locks=hair==='twin'?[-1,1]:[back?-.45:-.9];
      for(const s of locks){g.beginPath();g.moveTo(s*.78,-.65);g.bezierCurveTo(s*1.42,-.7,s*1.55+sway,.8,s*1.05+sway,1.5);g.bezierCurveTo(s*.92+sway,.7,s*.68,.35,s*.65,-.4);g.closePath();g.fill();g.stroke();g.strokeStyle=look.hairHi;g.lineWidth=.07;g.beginPath();g.moveTo(s*.91,-.3);g.quadraticCurveTo(s*1.2+sway,.6,s*1.08+sway,1.15);g.stroke();g.strokeStyle=outline;g.lineWidth=.065;}
      if(hair==='bun'){g.beginPath();g.ellipse(-.6,-.95,.48,.42,.3,0,TAU);g.fill();g.stroke();}
    }
    for(const s of[-1,1]){g.fillStyle=look.skin2;g.beginPath();g.ellipse(s*.92,.02,look.bigEars?.26:.18,.29,s*.15,0,TAU);g.fill();g.stroke();}
    g.fillStyle=skin;g.beginPath();g.moveTo(-.97,-.23);g.bezierCurveTo(-1.06,-1.23,1.03,-1.28,1,-.18);g.bezierCurveTo(.98,.6,.55*act.jaw,.97,.04,1.02);g.bezierCurveTo(-.6*act.jaw,1,-.94,.62,-.97,-.23);g.closePath();g.fill();g.stroke();
    if(hair==='receding'){
      // Exposed crown, short silver temples and only three fine strands on top.
      for(const side of[-1,1]){g.fillStyle=look.hairC;g.beginPath();g.moveTo(side*.96,.32);g.bezierCurveTo(side*1.04,-.05,side*1.05,-.61,side*.83,-.78);g.lineTo(side*.77,-.24);g.lineTo(side*.84,.4);g.closePath();g.fill();g.strokeStyle=look.hairHi;g.lineWidth=.045;for(let i=0;i<4;i++){g.beginPath();g.moveTo(side*(.86+i*.025),-.3);g.lineTo(side*(.88+i*.02),.17);g.stroke();}}
      if(back){g.strokeStyle=look.hairC;g.lineWidth=.17;g.beginPath();g.moveTo(-.85,.37);g.quadraticCurveTo(0,.98,.85,.37);g.stroke();}
      g.strokeStyle=look.hairHi;g.lineWidth=.025;for(let i=0;i<3;i++){g.beginPath();g.moveTo(-.36+i*.15,-.86);g.quadraticCurveTo(-.18+i*.15,-1.13,.13+i*.12,-.88);g.stroke();}
    }else{
    g.fillStyle=look.hairC;g.beginPath();
    const messy=['spiky','mess','quiff'].includes(hair),part=['side','part','gray'].includes(hair);
    g.moveTo(-1,.2);g.bezierCurveTo(-1.18,-1.1,-.55,-1.25,.04,-1.23);
    if(messy){for(let i=0;i<5;i++){g.lineTo(-.7+i*.34,-1.2-(i%2?.12:.3));g.lineTo(-.51+i*.34,-1.13);}g.bezierCurveTo(1.22,-.83,1.07,-.1,1,.23);}
    else g.bezierCurveTo(.8,-1.34,1.13,-.86,1,.19);
    if(back){g.bezierCurveTo(.92,.83,.42,.63,.12,.75);g.lineTo(-.12,.65);g.bezierCurveTo(-.55,.8,-1,.6,-1,.2);}
    else if(hair==='bowl'){g.lineTo(.86,-.15);for(let i=0;i<6;i++)g.lineTo(.8-i*.32,-.3+(i%2)*.08);g.lineTo(-.87,.2);}
    else if(part||hair==='bangs'){g.bezierCurveTo(.67,-.7,.1,-.4,-.25,-.3);g.bezierCurveTo(-.52,-.1,-.72,.28,-.87,.37);}
    else if(hair==='crew'||hair==='buzz'){g.lineTo(.88,-.5);g.quadraticCurveTo(.03,-.75,-.86,-.43);}
    else{g.lineTo(.87,-.23);g.lineTo(.45,-.65);g.lineTo(.12,-.3);g.lineTo(-.35,-.64);g.lineTo(-.83,.18);}
    g.closePath();g.fill();g.stroke();
    g.strokeStyle=look.hairHi;g.lineWidth=.095;g.beginPath();g.moveTo(-.75,-.68);g.bezierCurveTo(-.38,-1.11,.3,-1.1,.64,-.88);g.stroke();
    if(quality)for(let i=0;i<3;i++){g.lineWidth=.035;g.beginPath();g.moveTo(-.6+i*.35,-.9);g.quadraticCurveTo(-.7+i*.36,-.55,-.66+i*.4,-.35);g.stroke();}
    }
    if(hair==='spiky'||look.headband){g.strokeStyle=look.band;g.lineWidth=.2;g.beginPath();g.moveTo(-1,-.42);g.quadraticCurveTo(0,-.57,1,-.42);g.stroke();}
    if(!back){
      const blink=(time%4.7)>4.58,ey=.11,dx=clamp(gaze,-1,1)*.075;
      const smiling=['playful','laugh','grin','kind','eager'].includes(expr),narrow=['serene','precise','calm','mysterious','focused','knowing','smirk','stern','tired'].includes(expr);
      for(const sign of[-1,1]){const ex=sign*.40+turn*.12,wink=expr==='playful'&&sign<0,eh=blink||wink?.02:narrow?.13:expr==='wonder'?.235:.19;
        g.fillStyle='#fffaf1';g.beginPath();g.ellipse(ex,ey,.19,eh,-sign*.09,0,TAU);g.fill();g.fillStyle=look.eye;g.beginPath();g.ellipse(ex+dx,ey,.09,eh*.85,0,0,TAU);g.fill();
        g.strokeStyle=look.hairC;g.lineWidth=.045;g.beginPath();g.moveTo(ex-.18,ey-.04);g.quadraticCurveTo(ex,ey-eh*1.35,ex+.18,ey-.035);g.stroke();
        if(!blink&&!wink){g.fillStyle='#fff';g.beginPath();g.arc(ex+dx-.025,ey-eh*.38,.032,0,TAU);g.fill();}
        const slant=['stern','focused','bold','confident'].includes(expr)?sign*.07:expr==='curious'&&sign>0?-.1:0;
        g.strokeStyle=look.hairC;g.lineWidth=look.brow?.13:.065;g.beginPath();g.moveTo(ex-.17,-.18-slant);g.quadraticCurveTo(ex,-.26,ex+.17,-.18+slant);g.stroke();
      }
      g.strokeStyle=look.skin2;g.lineWidth=.04;g.beginPath();g.moveTo(.03,.09);g.quadraticCurveTo(.04,.27,.12,.32);g.lineTo(-.015,.34);g.stroke();
      const smile=focus?.025:act.smile;
      g.strokeStyle=outline;g.lineWidth=.04;g.beginPath();g.moveTo(-.21,.60);g.quadraticCurveTo(.01,.60+smile,.23,expr==='smirk'||expr==='wry'?.55:.60);
      if(expr==='laugh'||expr==='grin'){g.quadraticCurveTo(.03,.98,-.21,.60);g.fillStyle='#7b3841';g.fill();g.fillStyle='#fff8ed';g.fillRect(-.13,.615,.27,.07);}g.stroke();
      if(smiling){g.fillStyle='#eb948546';for(const sign of[-1,1]){g.beginPath();g.ellipse(sign*.63,.4,.18,.09,sign*.15,0,TAU);g.fill();}}
      if(look.lip){g.strokeStyle=look.lip;g.lineWidth=.08;g.beginPath();g.moveTo(-.16,.62);g.quadraticCurveTo(.02,.7,.2,.61);g.stroke();}
      if(look.age){g.strokeStyle=look.skin2;g.beginPath();g.moveTo(-.74,.14);g.lineTo(-.87,.19);g.moveTo(.7,.14);g.lineTo(.83,.19);g.moveTo(-.26,.43);g.lineTo(-.31,.6);g.stroke();}
      if(look.blush){g.fillStyle='#ed9c9670';for(const s of[-1,1]){g.beginPath();g.ellipse(s*.62,.42,.19,.085,0,0,TAU);g.fill();}}
      if(look.glasses){g.strokeStyle=look.age?'#6e6153':'#1e2d38';g.lineWidth=.08;for(const s of[-1,1]){g.beginPath();if(look.glasses==='rect')Y.rr(g,s*.42-.29,ey-.24,.58,.47,.1);else g.ellipse(s*.42,ey,.29,.27,0,0,TAU);g.stroke();g.fillStyle='#d5f6ff22';g.fill();}g.beginPath();g.moveTo(-.12,ey-.03);g.quadraticCurveTo(0,ey-.14,.12,ey-.03);g.stroke();g.strokeStyle='#ffffffaa';g.lineWidth=.035;g.beginPath();g.moveTo(-.58,ey-.13);g.lineTo(-.4,ey-.21);g.moveTo(.26,ey-.13);g.lineTo(.44,ey-.21);g.stroke();}
    }else if(look.glasses){g.strokeStyle='#7c8d9c';g.lineWidth=.065;g.beginPath();g.moveTo(-.94,.08);g.lineTo(-.74,-.13);g.moveTo(.94,.08);g.lineTo(.74,-.13);g.stroke();}
    if(art.detail==='bow'){g.strokeStyle=look.band;g.lineWidth=.10;g.beginPath();g.moveTo(-.8,-.9);g.bezierCurveTo(-1.6,-.2,-1.2+sway,.8,-1.55+sway,1.4);g.stroke();g.fillStyle=look.band;g.beginPath();g.moveTo(-.8,-.9);g.lineTo(-1.25,-1.3);g.lineTo(-1.3,-.68);g.closePath();g.fill();g.beginPath();g.moveTo(-.8,-.9);g.lineTo(-.42,-1.3);g.lineTo(-.35,-.68);g.closePath();g.fill();}
    if(look.hairpin){g.strokeStyle=look.trim;g.lineWidth=.085;g.beginPath();g.moveTo(-.92,-.7);g.lineTo(-.5,-1.18);g.stroke();g.fillStyle=look.trim;g.beginPath();g.arc(-.92,-.7,.1,0,TAU);g.fill();}
    if(art.detail==='star'){g.fillStyle='#ffe69c';g.beginPath();g.arc(.86,-.39,.13,0,TAU);g.fill();}
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
  Y.CharacterArt={profiles,profile,emblem,head,head2D,ribbon,butterfly,flywheel,burst,limb,hand,acting,displayPose,action,family,uniform2D,motionFor,mechanical,gestures};
})(typeof GameGlobal!=='undefined'?GameGlobal:typeof window!=='undefined'?window:globalThis);
