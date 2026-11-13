/* 羽跃对决 · 角色绘制：骨骼姿态（IK 腿 + 两段手臂）、分层着色、表情、发丝弹簧
 * 局部坐标：单位米，原点在脚底，+x 朝向球网，+y 向上（调用方负责 scale(f*k, -k)）。
 */
(function (G) {
  'use strict';
  const YY = G.YY;
  const C = YY.C;
  const { clamp, lerp } = YY;
  const D2R = Math.PI / 180;
  const RK_OFF = 0.49; // 手腕到拍面中心

  const LOOKS = [
    {
      name: '凌风', hair: 'spiky',
      shirt: '#ff4b55', shirt2: '#b9202e', panel: '#ffffff', trim: '#ffd23f',
      shorts: '#1c1f33', shorts2: '#0f111e', stripe: '#ff4b55',
      skin: '#f3c9a5', skin2: '#d9a37d', hairC: '#1d1418', hairHi: '#4a3238',
      band: '#ffffff', sock: '#ffffff', shoe: '#ffffff', sole: '#ff4b55',
      racket: '#ff3046', racket2: '#ffd23f', grip: '#222', wrist: '#ffd23f',
      outline: '#1a0f19', eye: '#2b1a12', num: '7',
    },
    {
      name: '沧澜', hair: 'ponytail',
      shirt: '#2f9bff', shirt2: '#1557b8', panel: '#0d1b3d', trim: '#7dfcff',
      shorts: '#f4f6fb', shorts2: '#c9cfdd', stripe: '#2f9bff',
      skin: '#eebd96', skin2: '#cf9670', hairC: '#151c3a', hairHi: '#3b4a85',
      band: '#ffd23f', sock: '#ffffff', shoe: '#1b2140', sole: '#7dfcff',
      racket: '#19d3ff', racket2: '#ffffff', grip: '#f4f4f4', wrist: '#ffffff',
      outline: '#0b0f22', eye: '#1b2550', num: '9',
    },
  ];
  YY.LOOKS = LOOKS;

  const smooth = (a, b, t) => { const u = clamp((t - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const mixPoint = (a, b, w) => [lerp(a[0], b[0], w), lerp(a[1], b[1], w)];
  // 每一种球路共用发力顺序，但有独立的引拍、拍头滞后、随挥与步幅。
  // 角度均为局部坐标：0 朝网，90 朝上。肩→肘→腕→拍分别采样，不再把整条手臂当一根杆。
  const CLIPS = {
    clear:     { family: 'over', power: .85, contact: 82, follow: -58, turn: 1, lunge: 0 },
    flatclear: { family: 'over', power: .75, contact: 67, follow: -42, turn: .9, lunge: 0 },
    drop:      { family: 'over', power: .34, contact: 84, follow: 38, turn: .72, lunge: 0 },
    slice:     { family: 'over', power: .53, contact: 74, follow: -8, turn: .9, lunge: 0 },
    halfsmash: { family: 'over', power: .85, contact: 73, follow: -64, turn: 1, lunge: 0 },
    smash:     { family: 'over', power: 1, contact: 80, follow: -78, turn: 1.15, lunge: 0 },
    drive:     { family: 'side', power: .72, contact: 8, follow: -32, turn: .8, lunge: .15 },
    push:      { family: 'short', power: .4, contact: 15, follow: 5, turn: .25, lunge: .55 },
    kill:      { family: 'short', power: .85, contact: 28, follow: -28, turn: .4, lunge: .48 },
    net:       { family: 'short', power: .15, contact: -8, follow: 16, turn: .15, lunge: 1 },
    tumble:    { family: 'short', power: .18, contact: 4, follow: 20, turn: .2, lunge: .95 },
    block:     { family: 'short', power: .22, contact: -14, follow: 0, turn: .22, lunge: .7 },
    lift:      { family: 'under', power: .75, contact: -32, follow: 94, turn: .6, lunge: .85 },
    lserve:    { family: 'under', power: .65, contact: -32, follow: 72, turn: .65, lunge: .12 },
    sserve:    { family: 'short', power: .16, contact: -28, follow: 5, turn: .2, lunge: .08 },
  };
  YY.SWING_STYLES = Object.keys(CLIPS);
  YY.MOTION_CLIPS = CLIPS;
  function channel(keys, t) {
    if(t<=keys[0][0])return keys[0][1];
    const slope=i=>{
      if(i===0||i===keys.length-1)return 0;
      const a=(keys[i][1]-keys[i-1][1])/(keys[i][0]-keys[i-1][0]);
      const b=(keys[i+1][1]-keys[i][1])/(keys[i+1][0]-keys[i][0]);
      return a*b>0?2*a*b/(a+b):0;
    };
    for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){
      const d=keys[i][0]-keys[i-1][0],u=(t-keys[i-1][0])/d,u2=u*u,u3=u2*u;
      return (2*u3-3*u2+1)*keys[i-1][1]+(u3-2*u2+u)*d*slope(i-1)+(-2*u3+3*u2)*keys[i][1]+(u3-u2)*d*slope(i);
    }
    return keys[keys.length-1][1];
  }
  YY.motionChannel = channel;
  function motionFrame(p, identity) {
    const sw = p.swing;
    if (!sw) return null;
    const style = CLIPS[sw.style] ? sw.style : sw.kind === 'under' ? 'lift' : sw.kind === 'side' ? 'drive' : 'clear';
    const c = CLIPS[style], over = c.family === 'over', under = c.family === 'under', side = c.family === 'side';
    // 收拍按球拍操控属性伸缩；有效判定窗口和引拍时间始终一致。
    const t = sw.t <= C.SW_SWEET ? sw.t : C.SW_SWEET + (.3 - C.SW_SWEET) *
      clamp((sw.t - C.SW_SWEET) / Math.max(C.DT, sw.dur - C.SW_SWEET), 0, 1);
    const weight = smooth(0, .032, t) * (1 - smooth(.205, .3, t));
    const hipDrive = smooth(.043, .103, t), chestDrive = smooth(.062, .125, t);
    const coil = smooth(0, .047, t), release = smooth(.072, .115, t);
    const ready = [0, 78, 82];
    const backs = over ? [108, 188, 235] : under ? [-85, -130, -158] : side ? [115, 175, 205]
      : style === 'kill' ? [42, 85, 108] : style === 'sserve' ? [-44, -63, -85] : [-18, -8, -32];
    const hit = [c.contact - (over ? 15 : 12), c.contact - 2, c.contact];
    // The elbow leads the wrist through impact, then folds while the racket
    // continues across the body. Keeping all three angles parallel looked rigid.
    const follow = over ? [c.follow + 79, c.follow + 18, c.follow - 16]
      : under ? [c.follow - 48, c.follow - 4, c.follow + 17]
      : [c.follow + 48, c.follow + 10, c.follow - 20];
    const arm = ready.map((v, i) => channel([[0, v], [.043 + i * .009, backs[i]], [.103 + i * .0035, hit[i]], [.168 + i * .014, follow[i]], [.3, v]], t));
    // 肩髋依次释放，拍头最后加速。负手先指球、再收肘帮助转体。
    const hipYaw = weight * c.turn * lerp(-.72, .5, hipDrive);
    const chestYaw = weight * c.turn * lerp(-1.06, .72, chestDrive);
    const lean = weight * (over ? lerp(-.22, .12 + c.power * .19, chestDrive) : under ? .06 : c.lunge * .2);
    const load = weight * (over ? .075 * (1 - hipDrive) - .018 * release : .025);
    const lunge = c.lunge * smooth(0, .085, t) * (1 - smooth(.16, .3, t));
    const off = over ? channel([[0,22],[.045,112],[.085,116],[.15,-46],[.3,22]],t)
      : channel([[0,22],[.075,-100],[.17,-66],[.3,22]],t);
    const offBend = over ? channel([[0,.6],[.05,.2],[.1,.45],[.16,1.6],[.3,.6]],t) : .6 + .3 * weight;
    const personal=identity||YY.CharacterArt?.motionFor(p)||{coil:1,stance:1,follow:1,lean:0,wrist:0};
    const tier=sw.q==null?'normal':YY.hitTier(sw.q),after=sw.contact?smooth(sw.contact.t,sw.contact.t+.055,sw.t):0;
    const strain=tier==='strained'?after:0,perfect=tier==='perfect'?after:0;
    const frame = { tier, strain, perfect, identity:personal, style, family: c.family, overhead: over ? 1 : 0, power: c.power, t, weight, hipYaw, chestYaw, lean, load, lunge, off, offBend,
      hipX: weight * (over ? lerp(-.065, .11, hipDrive) : .1 * c.lunge), arm, scissor: chestDrive,
      // 长随挥只属于重杀，疲劳延长普通挥拍不应变成杀球动作。
      smash: style === 'smash', face: style === 'slice' || style === 'tumble' ? .48 + .52 * Math.abs(Math.cos(t * 32)) : over ? channel([[0,1],[.055,.32],[.11,1],[.18,.45],[.3,1]],t) : 1 };
    frame.chestYaw*=personal.coil*(1+.12*perfect-.16*strain);
    frame.hipYaw*=personal.coil; frame.lean+=weight*(personal.lean+strain*.18-perfect*.035);
    frame.load+=weight*strain*.065;
    frame.lunge=(frame.lunge+strain*.28*weight)*personal.stance;
    frame.hipX+=weight*strain*.06;
    frame.off+=weight*(strain*-24+perfect*12+personal.wrist*30);
    frame.arm=frame.arm.map((v,i)=>v+weight*(personal.wrist*(i+1)*15+after*(tier==='strained'?-12:tier==='perfect'?8:0)*(i===2?personal.follow:0.4)));
    if (sw.fromStyle && (sw.fromStyle !== style || sw.fromDur !== sw.dur) && sw.contact && sw.t < sw.contact.t + .065) {
      const from = motionFrame({ ...p, swing: { ...sw, style: sw.fromStyle, fromStyle: null, dur: sw.fromDur || sw.dur } }, identity);
      const blend = smooth(sw.contact.t, sw.contact.t + .065, sw.t);
      for (const key of ['weight','overhead','hipYaw','chestYaw','lean','load','lunge','off','offBend','hipX','scissor']) frame[key] = lerp(from[key],frame[key],blend);
      frame.arm = from.arm.map((v,i) => lerp(v,frame.arm[i],blend));
    }
    return frame;
  }
  YY.motionFrame = motionFrame;
  // 保留供调试、旧调用方使用的总方向；最后一帧统一回到准备位。
  YY.swingAngle = p => { const m = motionFrame(p); return m ? lerp(m.arm[2], 45, smooth(.205, .3, m.t)) : null; };

  function ik(ax, ay, bx, by, l1, l2, bend) {
    let dx = bx - ax, dy = by - ay;
    let d = Math.max(1e-6, Math.hypot(dx, dy));
    const maxd = l1 + l2 - 1e-5;
    if (d > maxd) { dx *= maxd / d; dy *= maxd / d; d = maxd; }
    const a = Math.atan2(dy, dx), c = clamp((l1*l1 + d*d - l2*l2)/(2*l1*d), -1, 1);
    return [ax + Math.cos(a + Math.acos(c)*bend)*l1, ay + Math.sin(a + Math.acos(c)*bend)*l1];
  }
  const MOOD_LEAN = { sad: 0.28, happy: -0.06, cheer: -0.1, fist: 0.04, surprise: -0.16, shy: 0.16, think: 0.04, angry: 0.14, point: 0.05, tired: 0.34, wave: -0.04, smile: 0, talk: 0.02, rest: -0.02 };
  const MOOD_HEAD = { sad: 0.45, happy: -0.15, cheer: -0.22, fist: -0.05, surprise: -0.12, shy: 0.38, think: -0.28, angry: 0.12, point: -0.04, tired: 0.4, wave: -0.08, smile: -0.06, talk: 0, rest: -0.04 };
  YY.MOODS = Object.keys(MOOD_HEAD);

  // 支撑相脚底线性向后，摆动相抬膝前送；位移驱动步频，避免恒速“太空步”。
  function foot(phase, direction) {
    const u = ((phase / (Math.PI * 2)) % 1 + 1) % 1;
    return u < .5 ? [direction * (.604 - 2.416*u), 0]
      : [direction * lerp(-.604, .604, smooth(.5, 1, u)), .19 * Math.sin((u-.5)*Math.PI*2)];
  }
  function pose(p, t, o = {}) {
    const sw = p.swing, motion = p.motion || {}, shot = motionFrame(p, o.identity), air = !p.onGround;
    const movePose=p.cnt?.nv?.movePose,slide=(p.cnt?.ribbon?.dash?Math.sin(Math.PI*(1-p.cnt.ribbon.dash.t/.3)):0)||movePose?.w||(p.cnt?.club?.dash?Math.sin(Math.PI*clamp(1-p.cnt.club.dash.t/.27,0,1)):0),slideDir=movePose?.dir||Math.sign((p.cnt?.club?.dash?.x||p.dir)*p.dir),turn=p.cnt?.nv?.turnPose||0;
    const speed = motion.speed == null ? p.vx * p.dir : motion.speed;
    const run = smooth(.05, 3.9, Math.abs(speed)), fwd = Math.sign(speed) || 1;
    const ph = p.runPhase || 0, mood = o.mood || 'play', play = mood === 'play';
    const tiredK = p.stamina == null ? 0 : clamp((40 - p.stamina)/40,0,1);
    const landing = motion.land == null ? clamp((p.land || 0)/.08,0,1) : Math.sin(Math.PI * clamp(1-motion.land/.2,0,1));
    const split = play && !sw && !air ? Math.sin(Math.PI * clamp(1-(motion.split||0)/.18,0,1)) * (1-run*.7) : 0;
    const lunge = shot && !air ? shot.lunge * (shot.style==='lift' && Math.abs(p.x)>2.8 ? .55 : 1) : 0;
    const weight = shot ? shot.weight : 0, identity=o.identity||YY.CharacterArt?.motionFor(p)||{stance:1,lean:0};
    const action=!sw?o.action:null, mechanical=o.mechanical;
    const brake = clamp(motion.accel || 0, -1, 1);
    const breathe = Math.sin(t*(3.2+tiredK*4)+p.idx)*(.008+tiredK*.012)*(1-run);
    let hipY = .86 - slide*.12 + breathe - .13*landing - .055*split - tiredK*.04 - lunge*.17 - (shot ? shot.load : 0);
    if (mood==='sad') hipY-=.04;
    if (mood==='tired') hipY-=.1;
    if (mood==='cheer') hipY+=.025;
    if(action)hipY-=action.crouch;
    let F1=[.23*identity.stance,0], F2=[-.21*identity.stance,0];
    if (!air) {
      const gait1=foot(ph,fwd),gait2=foot(ph+Math.PI,fwd), stride=run*(1-lunge*.85)*(1-weight*.7);
      F1=mixPoint(F1,[gait1[0]+.06,gait1[1]],stride);
      F2=mixPoint(F2,[gait2[0]-.06,gait2[1]],stride);
      hipY-=.025*Math.sin(ph*2)**2*stride;
      F1[0]+=.43*lunge+.05*split; F2[0]-=.12*lunge+.05*split;
      if(shot&&shot.overhead>0) {
        // 后脚承重 → 脚跟抬起 → 前脚接住重心，不是整个人僵直前倾。
        F1[0]+=.09*weight*shot.overhead; F2[0]-=.1*weight*shot.overhead;
        F2[1]+=.1*weight*shot.overhead*shot.scissor;
      }
    } else {
      const age = motion.air == null ? .2 : motion.air;
      const tuck = smooth(0,.12,age) * (p.vy<0 ? smooth(0,.24,p.y) : 1);
      const kick = shot ? shot.scissor*shot.overhead*(1-smooth(.205,.3,shot.t)) : 0;
      F1=mixPoint(F1,[lerp(-.28,.34,kick),.21+.08*(1-kick)],tuck);
      F2=mixPoint(F2,[lerp(.26,-.32,kick),.14+.13*kick],tuck);
      hipY+=.025*tuck;
    }
    F1=mixPoint(F1,[.48*slideDir,.02],slide*.65);F2=mixPoint(F2,[-.4*slideDir,.04],slide*.65);
    // Skill movement must change the limbs, not only translate a running sprite.
    if(action?.id==='tafeng'&&air){F1=mixPoint(F1,[.12,-.05],action.e);F2=mixPoint(F2,[-.24,.38],action.e);}
    if(p.cnt?.club?.dash?.id==='ouzhou'){
      const cross=slide*(p.cnt.club.ready?.ouzhou?.second?1:-1);
      F1[0]+=.22*cross;F2[0]-=.22*cross;F2[1]+=.13*slide;
    }
    const H=[(shot?shot.hipX:0)+lunge*.09+brake*.025,hipY];
    const hipYaw=(shot?shot.hipYaw:-run*fwd*.15)+turn*.45;
    const chestYaw=(shot?shot.chestYaw:-run*fwd*.28)+turn*.8+(action?.yaw||0)+(mechanical?.punch||0)*.32;
    const H1=[H[0]+Math.sin(hipYaw)*.055,H[1]],H2=[H[0]-Math.sin(hipYaw)*.055,H[1]-.012];
    // 跨步时压低重心，让脚踝和髋部保持在腿长可达范围。
    const reach=Math.max(Math.hypot(F1[0]-H1[0],F1[1]-H1[1]),Math.hypot(F2[0]-H2[0],F2[1]-H2[1]));
    if(reach>.925&&!air){const drop=Math.min(.16,reach-.925);H[1]-=drop;H1[1]-=drop;H2[1]-=drop;}
    const K1=ik(...H1,...F1,.47,.47,1),K2=ik(...H2,...F2,.47,.47,1);
    let lean=.1+slide*.22*slideDir+run*.12*fwd+brake*.055+lunge*.24+tiredK*.1+(shot?shot.lean:0);
    if(air)lean-=.07*(1-weight);
    if(!sw)lean+=(MOOD_LEAN[mood]||0)+(action?action.lean*action.e:0)+identity.lean+(mechanical?.punch||0)*.16;
    const ux=Math.sin(lean),uy=Math.cos(lean), shoulderTurn=Math.sin(chestYaw)*.14;
    const N=[H[0]+ux*.56,H[1]+uy*.56];
    const S=[H[0]+ux*.5+shoulderTurn*uy,H[1]+uy*.5-shoulderTurn*ux];
    const S2=[H[0]+ux*.5-shoulderTurn*uy-.025,H[1]+uy*.5+shoulderTurn*ux-.025];
    const tilt=action?.id==='liubai'?-.3*action.e:MOOD_HEAD[mood]!=null?MOOD_HEAD[mood]+Math.sin(t*2.1+p.idx)*.03:-clamp((o.gazeY||0)*.12,-.2,.35);
    const hd=[N[0]+Math.sin(lean+tilt*.5)*.16-(action?.id==='liubai'?.1*action.e:0),N[1]+Math.cos(lean+tilt*.5)*.16];

    let A=45, bend=1.05, O=22, ob=.6;
    // 自抛后的蓄势：拍举过肩、负手指球，挑球随挥直接接进扣杀引拍。
    const toss=clamp(o.tossReady||0,0,1), bob=Math.sin(t*7+p.idx)*3;
    const tossArm=[150+bob,1.45,104+bob*.6,.18];
    if(!shot&&toss>0&&mood==='play'){A=lerp(A,tossArm[0],toss);bend=lerp(bend,tossArm[1],toss);O=lerp(O,tossArm[2],toss);ob=lerp(ob,tossArm[3],toss);}
    else if(!shot){
      if(mood==='happy'){A=118+Math.sin(t*9)*12;bend=.25;O=60+Math.sin(t*9+1)*15;ob=1.4;}
      else if(mood==='sad'){A=-70;bend=.15;O=-80;}
      else if(mood==='cheer'){A=100+Math.sin(t*10)*10;bend=.1;O=105+Math.sin(t*10+1.5)*10;ob=.15;}
      else if(mood==='fist'){A=70+Math.sin(t*14)*6;bend=1.9;O=-40;ob=.9;}
      else if(mood==='surprise'){A=30;bend=.6;O=150;ob=1.8;}
      else if(mood==='shy'){A=-95;bend=.35;O=-100;ob=.5;}
      else if(mood==='think'){A=-60;bend=.4;O=70;ob=2.75;}
      else if(mood==='angry'){A=132+Math.sin(t*7)*4;bend=.2;O=-30;ob=1.6;}
      else if(mood==='point'){A=8+Math.sin(t*3)*3;bend=.05;O=-50;ob=.8;}
      else if(mood==='tired'){A=-78;bend=.1;O=-84;ob=.05;}
      else if(mood==='rest'){A=-82+Math.sin(t*1.6+p.idx)*3;bend=.3;O=-95;ob=2.2;}
      else if(mood==='wave'||mood==='smile'||mood==='talk'){A=40+Math.sin(t*3+p.idx)*4;O=mood==='wave'?125+Math.sin(t*8)*22:mood==='talk'?20+Math.sin(t*5)*18:22;ob=mood==='wave'?.35:1.3;}
      else if(air){A=105;bend=1.2;O=90;ob=.25;}
      else {A+=Math.sin(t*3+p.idx)*2-run*10;O+=Math.sin(ph+Math.PI)*24*run;}
    } else {O=shot.off;ob=shot.offBend;}
    if(!shot&&o.action){const ac=o.action;A=lerp(A,ac.arm[0],ac.e);bend=lerp(bend,ac.arm[1],ac.e);O=lerp(O,ac.arm[2],ac.e);ob=lerp(ob,ac.arm[3],ac.e);}
    let U=shot?shot.arm[0]*D2R:A*D2R-bend*.75;
    let Fa=shot?shot.arm[1]*D2R:A*D2R+bend*.55;
    let Rk=shot?shot.arm[2]*D2R:A*D2R+bend*.62;
    if (shot) {
      let rest = air ? [105,1.2,90,.25] : [45+Math.sin(t*3+p.idx)*2-run*10,1.05,22+Math.sin(ph+Math.PI)*24*run,.6];
      if (toss>0) rest = rest.map((v,i)=>lerp(v,tossArm[i],toss));
      const blend = smooth(0,.025,shot.t)*(1-smooth(.205,.3,shot.t));
      U=lerp(rest[0]*D2R-rest[1]*.75,U,blend);
      Fa=lerp(rest[0]*D2R+rest[1]*.55,Fa,blend);
      Rk=lerp(rest[0]*D2R+rest[1]*.62,Rk,blend);
      O=lerp(rest[2],O,blend); ob=lerp(rest[3],ob,blend);
    }
    let rs=1;
    let E=[S[0]+Math.cos(U)*.29,S[1]+Math.sin(U)*.29];
    let W=[E[0]+Math.cos(Fa)*.27,E[1]+Math.sin(Fa)*.27];
    // Correct the moving racket trajectory, rather than pinning it to the ball
    // during recovery. The independent racket angle preserves a flexed elbow.
    // 来球预瞄只影响显示，不扩大甜区，不改变物理判定。
    let target=null, lock=0;
    if(sw&&sw.contact&&sw.t>=sw.contact.t&&!o.contactFree){
      const at=pose({...p,swing:{...sw,t:sw.contact.t}},t,{...o,aim:null,contactFree:true});
      const ref=YY.racketHead(at),current=[W[0]+Math.cos(Rk)*RK_OFF,W[1]+Math.sin(Rk)*RK_OFF];
      target=[(sw.contact.x-p.x)*p.dir+current[0]-ref[0],sw.contact.y-p.y+current[1]-ref[1]];
      lock=1-smooth(0,Math.min(.11,Math.max(.045,sw.dur-sw.contact.t)),sw.t-sw.contact.t);
    } else if(!o.contactFree&&sw&&sw.serve){target=[.42,.9-p.y];lock=smooth(.035,.1,sw.t);}
    else if(!o.contactFree&&sw&&o.aim){target=[(o.aim.x-p.x)*p.dir,o.aim.y-p.y];lock=smooth(.035,.105,sw.t)*(1-smooth(.14,.205,sw.t));}
    if(target&&lock>0){
      const current=[W[0]+Math.cos(Rk)*RK_OFF,W[1]+Math.sin(Rk)*RK_OFF];
      const T=mixPoint(current,target,lock),dx=T[0]-S[0],dy=T[1]-S[1],r=Math.hypot(dx,dy);
      // 优先弯肘，只有超出肢体总长的扑救才适度拉伸整条链。
      rs=Math.max(1,r/(.29+.27+RK_OFF-.006));
      const radial=Math.atan2(dy,dx),limit=Math.acos(clamp((r*r+(RK_OFF*rs)**2-(.558*rs)**2)/(2*Math.max(r,1e-6)*RK_OFF*rs),-1,1));
      const delta=Math.atan2(Math.sin(Rk-radial),Math.cos(Rk-radial));
      const angle=radial+clamp(delta,-limit,limit);
      const wrist=[T[0]-Math.cos(angle)*RK_OFF*rs,T[1]-Math.sin(angle)*RK_OFF*rs];
      E=ik(...S,...wrist,.29*rs,.27*rs,-1);W=wrist;Rk=angle;
    }
    if(mechanical&&!sw){
      const dx=(mechanical.head[0]-p.x)*p.dir-S[0],dy=mechanical.head[1]-p.y-S[1],a=Math.atan2(dy,dx),f=mechanical.punch;
      W=[S[0]+Math.cos(a)*(.43+.06*f),S[1]+Math.sin(a)*(.43+.06*f)];
      E=ik(...S,...W,.29,.27,-1);Rk=a;rs=1;
      O=70+f*30;ob=1.2;
    }
    const Or=O*D2R;
    let E2=[S2[0]+Math.cos(Or-ob*.6)*.27,S2[1]+Math.sin(Or-ob*.6)*.27];
    let W2=[E2[0]+Math.cos(Or+ob*.5)*.25,E2[1]+Math.sin(Or+ob*.5)*.25];
    if (p.buff?.vine > 0) {
      const sway=clamp((p.vx||0)*.018,-.12,.12);
      W2=[sway,1.9];E2=ik(...S2,...W2,.27,.25,-1);
    }
    if(sw?.serve) {
      const hold=smooth(0,.035,sw.t)*(1-smooth(.1,.19,sw.t));
      W2=mixPoint(W2,[.38,.95-p.y],hold); E2=ik(...S2,...W2,.27,.25,1);
    }
    // Turn around the athlete's vertical axis, rather than just leaning the torso.
    // All joints share this projection; racket contact stays pinned during a real hit.
    const turnAngle=p.cnt?.nv?.turnAngle;
    if(air&&Number.isFinite(turnAngle)){
      const c=Math.cos(turnAngle),sn=Math.sin(turnAngle),pivot=H[0];
      const front=new Set([S,E,W,H1,K1,F1]),back=new Set([S2,E2,W2,H2,K2,F2]);
      for(const point of new Set([H,H1,H2,K1,K2,F1,F2,N,S,S2,E,W,E2,W2,hd])){
        if(sw?.contact&&(point===W||point===E))continue;
        point[0]=pivot+(point[0]-pivot)*c+(front.has(point)?.12:back.has(point)?-.12:0)*sn;
      }
    }
    return {H,H1,H2,K1,K2,F1,F2,N,S,S2,E,W,E2,W2,hd,lean,Rk,rs,A:Rk,ux,uy,air,run,spinAngle:air?turnAngle:undefined,
      smash:!!(shot && shot.smash),mood,ph,style:shot?.style,hipYaw,chestYaw,face:shot?.face||1,motion:shot};
  }
  YY.charPose=pose;

  // ---------- 绘制工具 ----------
  function capsule(ctx, a, b, r1, r2) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1e-6;
    const ang = Math.atan2(dy, dx);
    const k = (r1 - r2) / L;
    const off = Math.asin(clamp(k, -0.99, 0.99));
    ctx.beginPath();
    ctx.arc(a[0], a[1], r1, ang + Math.PI / 2 + off, ang - Math.PI / 2 - off + Math.PI * 2, false);
    ctx.arc(b[0], b[1], r2, ang - Math.PI / 2 - off, ang + Math.PI / 2 + off, false);
    ctx.closePath();
  }
  function limb(ctx, a, b, r1, r2, fill, hi, lw, outline) {
    capsule(ctx, a, b, r1, r2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (outline) { ctx.lineWidth = lw; ctx.strokeStyle = outline; ctx.stroke(); }
    if (hi) {
      // 顶部高光：沿肢体偏上方的细线
      const nx = -(b[1] - a[1]), ny = b[0] - a[0];
      const L = Math.hypot(nx, ny) || 1;
      const s = ny > 0 ? 1 : -1;
      const ox = (nx / L) * s * r1 * 0.45, oy = (ny / L) * s * r1 * 0.45;
      ctx.strokeStyle = hi;
      ctx.lineWidth = Math.min(r1, r2) * 0.55;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a[0] + ox * 0.8 + (b[0] - a[0]) * 0.12, a[1] + oy * 0.8 + (b[1] - a[1]) * 0.12);
      ctx.lineTo(b[0] + ox * 0.6 - (b[0] - a[0]) * 0.12, b[1] + oy * 0.6 - (b[1] - a[1]) * 0.12);
      ctx.stroke();
    }
  }
  const shadeCache=new Map();
  function shade(hex, f) {
    const key=hex+':'+f;if(shadeCache.has(key))return shadeCache.get(key);
    const n = parseInt(hex.slice(1), 16),rgb=hex.startsWith('rgb')?hex.match(/[\d.]+/g):null;
    let r = rgb?+rgb[0]:(n >> 16) & 255, g = rgb?+rgb[1]:(n >> 8) & 255, b = rgb?+rgb[2]:n & 255;
    if (f < 1) { r *= f; g *= f; b *= f; }
    else { r += (255 - r) * (f - 1); g += (255 - g) * (f - 1); b += (255 - b) * (f - 1); }
    const value=`rgb(${r | 0},${g | 0},${b | 0})`;if(shadeCache.size>768)shadeCache.clear();shadeCache.set(key,value);return value;
  }
  YY.shade = shade;
  // 给任意 #hex / rgb() 颜色加透明度；画背景叠色时统一走这里。
  function tint(color, a) {
    const m = String(color).match(/^rgb\(([\d.]+),\s*([\d.]+),\s*([\d.]+)\)$/);
    if (m) return `rgba(${m[1] | 0},${m[2] | 0},${m[3] | 0},${a})`;
    const n = parseInt(String(color).slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  YY.tint = tint;

  function shoe(ctx, F, K, look, lw, flat, pulse = 0, time = 0, air = false) {
    const a = look.shoeArt;
    const ang = Math.atan2(F[1] - K[1], F[0] - K[0]);
    const toe = clamp(ang + Math.PI / 2, -0.5, 0.6);
    const width = a?.outrigger ? 1.15 : 1, sole = a ? a.midH * .35 : .022;
    ctx.save(); ctx.translate(F[0], F[1] + 0.035); ctx.rotate(toe * 0.5); ctx.scale(width, 1);
    if (look.marketTier >= 3 && !flat && YY.MarketArt) { YY.MarketArt.shoe(ctx,look,time,air);ctx.restore();return; }
    if (look.marketTier === 0 || look.marketTier === 1) {
      ctx.fillStyle=flat || look.skin;ctx.strokeStyle=look.outline;ctx.lineWidth=lw;
      ctx.beginPath();ctx.ellipse(.035,.012,.15,.05,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      if(look.marketTier===1){ctx.fillStyle='#746449';ctx.fillRect(-.1,-.045,.3,.025);ctx.strokeStyle='#f7d16e';ctx.lineWidth=.025;ctx.beginPath();ctx.moveTo(-.005,.03);ctx.lineTo(.08,-.015);ctx.lineTo(.15,.025);ctx.stroke();}
      else {ctx.lineWidth=.006;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(.12-i*.018,.02);ctx.lineTo(.13-i*.018,-.01);ctx.stroke();}}
      ctx.restore();return;
    }
    ctx.beginPath(); ctx.moveTo(-.09, -.035); ctx.lineTo(.16, -.035);
    ctx.quadraticCurveTo(.20, -.02, .18, .015 + (a?.toe || 0) * .2);
    ctx.quadraticCurveTo(.13, .07, .02, .075); ctx.lineTo(-.07, .075);
    ctx.quadraticCurveTo(-.11, .025, -.09, -.035); ctx.closePath();
    ctx.fillStyle = flat || look.shoe; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = look.outline; ctx.stroke();
    if (!flat) {
      ctx.fillStyle = a ? a.mid[1] : look.sole; ctx.fillRect(-.09, -.035, .26, sole);
      ctx.fillStyle = a ? a.out : look.sole; ctx.fillRect(-.09, -.045, .26, .012);
      ctx.strokeStyle = a ? a.accent : look.sole; ctx.lineWidth = .018;
      ctx.beginPath();
      switch (a?.logo) {
        case 'wing':
          for (let i=0;i<3;i++) { ctx.moveTo(.09-i*.035,.02);ctx.lineTo(-.06-i*.008,.025+i*.018); } break;
        case 'cage':
          ctx.moveTo(-.07,-.02);ctx.lineTo(-.04,.06);ctx.lineTo(.01,-.02);ctx.lineTo(.06,.06);ctx.lineTo(.12,-.02); break;
        case 'cloud':
          ctx.moveTo(-.07,.015);ctx.bezierCurveTo(-.09,.06,-.03,.07,-.01,.04);ctx.bezierCurveTo(.01,.08,.06,.07,.07,.04);ctx.quadraticCurveTo(.14,.045,.12,.01); break;
        case 'butterfly':
          ctx.moveTo(.025,.005);ctx.quadraticCurveTo(-.09,.09,-.065,.01);ctx.lineTo(.025,.005);ctx.quadraticCurveTo(.11,.09,.12,.025);ctx.lineTo(.025,.005); break;
        case 'route':
          ctx.moveTo(-.07,.02);ctx.bezierCurveTo(-.02,.07,.04,-.015,.13,.04);break;
        case 'moon':
          ctx.arc(-.035,.025,.04,Math.PI*.4,Math.PI*1.6);ctx.moveTo(.015,.015);ctx.lineTo(.12,.04);break;
        default: ctx.moveTo(-.03,.01);ctx.quadraticCurveTo(.04,.045,.13,.015);
      }
      ctx.stroke();
      if (a?.fore) {ctx.fillStyle=a.fore;ctx.fillRect(.10,-.03,.065,.02);}
      if (a?.layered) {ctx.strokeStyle=a.accent;ctx.lineWidth=.007;ctx.beginPath();ctx.moveTo(-.085,-.017);ctx.lineTo(.16,-.017);ctx.stroke();}
      if (a) {ctx.strokeStyle=a.lace;ctx.lineWidth=.01;ctx.beginPath();ctx.moveTo(.045,.06);ctx.lineTo(.085,.04);ctx.moveTo(.07,.06);ctx.lineTo(.11,.04);ctx.stroke();}
      if (pulse>0 && a) {ctx.globalAlpha*=pulse;ctx.strokeStyle=a.accent;ctx.lineWidth=.025;ctx.beginPath();ctx.moveTo(-.11,-.05);ctx.lineTo(.19,-.05);ctx.stroke();}
    }
    ctx.restore();
  }

  function racket(ctx, P, look, lw, flat, glow, pulse = 0) {
    const art = look.racketArt;
    const rx = art ? .15 * (art.headW || 1) : .125, ry = art ? .115 : .098;
    const frame = () => {
      ctx.beginPath();
      if (!art) { ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2); return; }
      const n=2+art.sq*2.4, N=art.poly || 32;
      for(let i=0;i<=N;i++) {const t=i/N*Math.PI*2,c=Math.cos(t),s=Math.sin(t);
        const x=rx*Math.sign(c)*Math.pow(Math.abs(c),2/n),y=ry*Math.sign(s)*Math.pow(Math.abs(s),2/n);
        if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);
      }ctx.closePath();
    };
    const k = P.rs || 1;
    const ax = Math.cos(P.Rk) * k, ay = Math.sin(P.Rk) * k;
    const W = P.W;
    const g0 = [W[0] - ax * 0.04, W[1] - ay * 0.04], g1 = [W[0] + ax * 0.12, W[1] + ay * 0.12];
    const s1 = [W[0] + ax * 0.36, W[1] + ay * 0.36];
    const hc = YY.racketHead(P);
    ctx.lineCap = 'round';
    // 拍柄
    ctx.strokeStyle = flat || look.grip; ctx.lineWidth = 0.034;
    ctx.beginPath(); ctx.moveTo(g0[0], g0[1]); ctx.lineTo(g1[0], g1[1]); ctx.stroke();
    // 拍杆
    ctx.strokeStyle = flat || look.shaft || '#c9ced8'; ctx.lineWidth = 0.013;
    ctx.beginPath(); ctx.moveTo(g1[0], g1[1]); ctx.lineTo(s1[0], s1[1]); ctx.stroke();
    // 拍框
    ctx.save();
    ctx.translate(hc[0], hc[1]);
    ctx.rotate(P.Rk);
    ctx.scale(1, P.face || 1); // 劈吊、搓球显示拍面转动
    if (look.marketTier === 0 || look.marketTier === 1) {
      ctx.fillStyle=flat || '#bb8c51';ctx.strokeStyle='#69462a';ctx.lineWidth=.018;
      ctx.beginPath();ctx.ellipse(0,0,.155,.11,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.lineWidth=.007;ctx.beginPath();for(let i=-2;i<=2;i++){ctx.moveTo(-.1,i*.028);ctx.lineTo(.1,i*.028);}ctx.stroke();
      if(look.marketTier===0){ctx.strokeStyle='#302011';ctx.lineWidth=.015;ctx.beginPath();ctx.moveTo(-.14,-.05);ctx.lineTo(-.04,.015);ctx.lineTo(.02,-.03);ctx.lineTo(.12,.07);ctx.stroke();ctx.fillStyle='#e8d6a6';ctx.fillRect(-.025,-.1,.035,.2);}
      ctx.restore();return;
    }
    if (glow > 0 && !flat) {
      ctx.fillStyle = `rgba(255,250,210,${glow})`;
      ctx.beginPath(); ctx.ellipse(0, 0, 0.24, 0.2, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = flat || look.racket;
    frame();
    if (!flat) {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = art ? art.string : 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 0.004;
      ctx.beginPath();
      for (let i = -5; i <= 5; i++) { ctx.moveTo(i * 0.03, -ry); ctx.lineTo(i * 0.03, ry); }
      for (let j = -4; j <= 4; j++) { ctx.moveTo(-rx, j * 0.028); ctx.lineTo(rx, j * 0.028); }
      ctx.stroke();
      ctx.restore();
    }
    frame();
    ctx.lineWidth = art ? .026 * art.thick : .026;
    ctx.strokeStyle = flat || look.outline;
    ctx.stroke();
    ctx.lineWidth = art ? .018 * art.thick : .016;
    if (!flat) {
      const gr = ctx.createLinearGradient(-0.12, 0, 0.12, 0);
      gr.addColorStop(0, look.racket); gr.addColorStop(0.55, look.racket2); gr.addColorStop(1, look.racket);
      ctx.strokeStyle = gr;
    }
    ctx.stroke();
    if (art && !flat) {
      if(look.marketTier>=4){ctx.strokeStyle=look.marketColor;ctx.lineWidth=.009;ctx.beginPath();ctx.ellipse(0,0,rx+.055,ry+.045,0,.2,Math.PI*1.8);ctx.stroke();}
      // 拍框上的识别纹样与器械库共用同一外观定义；保持原拍头接触点。
      ctx.strokeStyle=art.accent;ctx.fillStyle=art.accent;ctx.lineWidth=.014;
      if (art.decal==='stars') {
        for(let i=-1;i<=1;i++){const x=i*.07,y=-ry*.9;ctx.beginPath();ctx.moveTo(x-.018,y);ctx.lineTo(x+.018,y);ctx.moveTo(x,y-.022);ctx.lineTo(x,y+.022);ctx.stroke();}
      } else if (art.decal==='facet') {
        for(const d of [-1,1]){ctx.beginPath();ctx.moveTo(-.04,d*ry);ctx.lineTo(.04,d*ry);ctx.stroke();}
        ctx.beginPath();ctx.moveTo(rx-.02,0);ctx.lineTo(rx+.02,0);ctx.moveTo(0,-.025);ctx.lineTo(0,.025);ctx.stroke();
      } else if (art.decal==='shield') {
        for(const d of [-1,1]){ctx.beginPath();ctx.moveTo(-.065,d*ry);ctx.lineTo(.025,d*ry);ctx.lineTo(.065,d*ry*.6);ctx.stroke();}
      } else if (art.decal==='petals') {
        for(const d of [-1,1]){ctx.beginPath();ctx.ellipse(.04,d*ry,.035,.016,d*.5,0,Math.PI*2);ctx.fill();}
      } else if (art.decal==='ripple') {
        for(const d of [-1,1]){ctx.beginPath();ctx.moveTo(-.07,d*ry*.9);ctx.quadraticCurveTo(0,d*ry*1.25,.07,d*ry*.9);ctx.stroke();}
      } else {
        ctx.lineWidth=art.decal==='ridge'?.025:.014;
        ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,-.75,.75);ctx.stroke();
      }
      if(pulse>0){ctx.save();ctx.globalAlpha*=pulse;ctx.lineWidth=.022;frame();ctx.stroke();ctx.restore();}
    }
    ctx.restore();
  }

  // Minimal head for standalone physics/render harnesses. Production surfaces
  // load character-art.js, whose shared artist draws all twenty identities.
  function head(ctx,P,look,o,lw){
    const [x,y]=P.hd;ctx.save();ctx.translate(x,y);ctx.fillStyle=look.skin;ctx.strokeStyle=look.outline;ctx.lineWidth=lw;
    ctx.beginPath();ctx.ellipse(0,0,.135,.15,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle=look.hairC;ctx.beginPath();ctx.moveTo(-.14,0);ctx.bezierCurveTo(-.16,.21,.15,.21,.14,.02);ctx.quadraticCurveTo(.02,.10,-.14,0);ctx.fill();
    ctx.fillStyle=look.eye;for(const sign of[-1,1]){ctx.beginPath();ctx.ellipse(sign*.05,.005,.012,.022,0,0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle=look.skin2;ctx.lineWidth=.008;ctx.beginPath();ctx.moveTo(-.025,-.075);ctx.quadraticCurveTo(0,-.092,.03,-.07);ctx.stroke();ctx.restore();
  }

  const smooth2 = (a, b, t) => { const u = clamp((t - a) / (b - a || 1e-6), 0, 1); return u * u * (3 - 2 * u); };
  function torso(ctx, P, look, lw, flat, f) {
    if (look.marketTier >= 3 && !flat && YY.MarketArt) { YY.MarketArt.torso(ctx,P,look);return; }
    const { H, ux, uy } = P;
    const rx = uy, ry = -ux; // 指向前方的法向量
    const silhouette=YY.CharacterArt?.profile(look),tw=silhouette?.waist||(look.slim?.78:look.buff?1.2:1);
    // 躯干宽度曲线：腰收、胸阔、肩斜。单纯从腰到肩线性放大会变成一块梯形木板。
    const shoulderW=silhouette?.shoulder||tw, bellyK=look.belly?1+.1*Math.sin(Math.PI*clamp(.3,0,1)):1;
    const widthAt=u=>{
      // u: 0 髋 → .5 胸 → .58 肩
      const waist=tw*(1-.13*smooth2(.0,.3,u));            // 髋上方先略收
      const chest=lerp(waist,shoulderW,clamp((u-.18)/.32,0,1))*(1+.05*smooth2(.25,.45,u));
      const taper=u>.5?1-.16*clamp((u-.5)/.1,0,1):1;      // 肩头向内收一点，避免方肩
      return chest*taper*bellyK;
    };
    const pt = (u, r) => {
      const yaw = lerp(P.hipYaw || 0, P.chestYaw || 0, clamp(u / .5, 0, 1));
      const width=(1-.24*Math.abs(Math.sin(yaw)))*widthAt(u);
      const turn = Math.sin(yaw) * .04 * clamp(u / .5, 0, 1);
      return [H[0] + ux * u + rx * (r * width + turn), H[1] + uy * u + ry * (r * width + turn)];
    };
    if(look.dress){
      const fill=(points,color)=>{ctx.beginPath();points.forEach((q,i)=>i?ctx.lineTo(...pt(...q)):ctx.moveTo(...pt(...q)));ctx.closePath();ctx.fillStyle=flat||color;ctx.fill();if(!flat){ctx.strokeStyle=look.outline;ctx.lineWidth=lw;ctx.stroke();}};
      fill([[0,-.13],[.36,-.2],[.52,-.14],[.6,0],[.52,.14],[.36,.2],[0,.13]],look.skin);
      fill([[-.04,-.14],[.26,-.18],[.43,-.17],[.38,0],[.43,.17],[.26,.18],[-.04,.14]],look.shirt);
      if(!flat){ctx.strokeStyle=look.shirt;ctx.lineWidth=.025;for(const side of[-1,1]){ctx.beginPath();ctx.moveTo(...pt(.43,side*.15));ctx.lineTo(...pt(.56,side*.12));ctx.stroke();}
        ctx.strokeStyle=look.trim;ctx.lineWidth=.009;ctx.beginPath();ctx.moveTo(...pt(.08,-.14));ctx.lineTo(...pt(.08,.14));ctx.stroke();
        const q=pt(.34,.05);YY.CharacterArt?.emblem(ctx,'brush',...q,.045,look.trim);
      }
      return;
    }
    const wl=pt(-.035,-.145),wr=pt(-.035,.15);
    const cl=pt(.30,-.18),cr=pt(.30,.19);
    const sl=pt(.49,-.18),sr=pt(.49,.185);
    const ql = pt(0.6, -0.1), qr = pt(0.6, 0.1);
    ctx.beginPath();
    ctx.moveTo(wl[0], wl[1]);
    ctx.quadraticCurveTo(cl[0], cl[1], sl[0], sl[1]);
    ctx.quadraticCurveTo(ql[0], ql[1], ...pt(0.58, 0));
    ctx.quadraticCurveTo(qr[0], qr[1], sr[0], sr[1]);
    ctx.quadraticCurveTo(cr[0], cr[1], wr[0], wr[1]);
    ctx.quadraticCurveTo(...pt(-0.06, 0), wl[0], wl[1]);
    ctx.closePath();
    if (flat) { ctx.fillStyle = flat; ctx.fill(); return; }
    const g = ctx.createLinearGradient(...pt(0.3, -0.18), ...pt(0.3, 0.18));
    g.addColorStop(0, look.shirt2); g.addColorStop(0.55, look.shirt); g.addColorStop(1, shade(look.shirt, 1.15));
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = lw; ctx.strokeStyle = look.outline; ctx.stroke();
    if (look.prison) { // 囚服：黑白横条 + 胸前编号牌
      ctx.save(); ctx.clip();
      ctx.strokeStyle = look.stripe; ctx.lineWidth = 0.05;
      for (let u = -0.04; u < 0.66; u += 0.11) { ctx.beginPath(); ctx.moveTo(...pt(u, -0.3)); ctx.lineTo(...pt(u, 0.3)); ctx.stroke(); }
      ctx.restore();
      const n = pt(0.33, 0.06);
      ctx.save(); ctx.translate(n[0], n[1]); ctx.scale(f || 1, -1); ctx.rotate(P.lean * (f || 1));
      ctx.fillStyle = '#f7f1d8'; ctx.strokeStyle = '#2a2e38'; ctx.lineWidth = 0.008; ctx.fillRect(-0.075, -0.04, 0.15, 0.08); ctx.strokeRect(-0.075, -0.04, 0.15, 0.08);
      ctx.font = '900 0.055px "DIN Alternate","Arial Black",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#c4161c'; ctx.fillText('No.0', 0, 0.004);
      ctx.restore();
      return;
    }
    if (look.marketTier === 0) {
      ctx.strokeStyle=look.skin2;ctx.lineWidth=.014;
      for(const u of [.24,.37]){ctx.beginPath();ctx.moveTo(...pt(u,-.08));ctx.quadraticCurveTo(...pt(u-.025,0),...pt(u,.09));ctx.stroke();}
      return;
    }
    if (look.marketTier === 1) {
      ctx.strokeStyle=look.skin;ctx.lineWidth=.08;
      for(const sign of [-1,1]){ctx.beginPath();ctx.moveTo(...pt(.55,sign*.14));ctx.lineTo(...pt(.4,sign*.15));ctx.stroke();}
      ctx.fillStyle=look.skin;ctx.beginPath();ctx.ellipse(...pt(.55,.02),.07,.055,0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#eee7cf';ctx.lineWidth=.026;
      for(const sign of [-1,1]){ctx.beginPath();ctx.moveTo(...pt(.57,sign*.1));ctx.lineTo(...pt(.38,sign*.11));ctx.stroke();}
      return;
    }
    // 侧面拼色：只是靠后侧的一条窄边，不吞掉半件衣服。
    ctx.save();
    ctx.clip();
    ctx.fillStyle = look.panel;
    ctx.beginPath();
    const a = pt(-0.04, -0.2), b = pt(0.5, -0.2), c2 = pt(0.47, -0.135), d = pt(-0.04, -0.145);
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c2[0], c2[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
    ctx.fill();
    // 靠前侧肩部的受光：从锁骨到腋下的一条亮带，制造圆润的胸腔。
    const lit = pt(0.5, 0.16), lit2 = pt(0.2, 0.19), lit3 = pt(0.06, 0.16);
    const lightGrad = ctx.createLinearGradient(lit[0], lit[1], lit3[0], lit3[1]);
    lightGrad.addColorStop(0, YY.tint(shade(look.shirt, 1.24), .8)); lightGrad.addColorStop(1, YY.tint(shade(look.shirt, 1.02), 0));
    ctx.fillStyle = lightGrad; ctx.beginPath();
    ctx.moveTo(...pt(0.52, 0.06)); ctx.lineTo(lit[0], lit[1]); ctx.quadraticCurveTo(lit2[0], lit2[1], lit3[0], lit3[1]);
    ctx.lineTo(...pt(0.06, 0.05)); ctx.closePath(); ctx.fill();
    if (look.plaid) {
      // 格子衫
      const ga = ctx.globalAlpha;
      ctx.strokeStyle = look.plaid; ctx.lineWidth = 0.016; ctx.globalAlpha = ga * 0.55;
      ctx.beginPath();
      for (let i = -3; i <= 3; i++) { const a = pt(-0.1, i * 0.07), b = pt(0.65, i * 0.07); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      for (let j = 0; j < 7; j++) { const a = pt(j * 0.09, -0.25), b = pt(j * 0.09, 0.25); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      ctx.stroke(); ctx.globalAlpha = ga;
    }
    YY.CharacterArt?.uniform2D(ctx,pt,look);
    // 腰部饰条
    ctx.fillStyle = look.trim;
    const t1 = pt(0.07, -0.2), t2 = pt(0.07, 0.2), t3 = pt(0.1, 0.2), t4 = pt(0.1, -0.2);
    ctx.beginPath(); ctx.moveTo(t1[0], t1[1]); ctx.lineTo(t2[0], t2[1]); ctx.lineTo(t3[0], t3[1]); ctx.lineTo(t4[0], t4[1]); ctx.closePath(); ctx.fill();
    ctx.restore();
    // V 领
    const v0 = pt(0.55, -0.05), v1 = pt(0.47, 0.06), v2 = pt(0.56, 0.11);
    ctx.strokeStyle = look.trim; ctx.lineWidth = 0.018; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(v0[0], v0[1]); ctx.lineTo(v1[0], v1[1]); ctx.lineTo(v2[0], v2[1]); ctx.stroke();
    if (look.whistle) {
      // 挂在胸前的口哨
      const n0 = pt(0.56, -0.04), n1 = pt(0.38, 0.08), n2 = pt(0.56, 0.1);
      ctx.strokeStyle = '#ff5b3d'; ctx.lineWidth = 0.008;
      ctx.beginPath(); ctx.moveTo(n0[0], n0[1]); ctx.lineTo(n1[0], n1[1]); ctx.lineTo(n2[0], n2[1]); ctx.stroke();
      ctx.fillStyle = '#d8dde6'; ctx.beginPath(); ctx.arc(n1[0], n1[1] - 0.012, 0.024, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 0.008; ctx.strokeStyle = look.outline; ctx.stroke();
    }
    // 独立角色配件随躯干关节运动，头像与赛场复用。
    if(look.identity&&!flat){
      const a=pt(.35,0),x=a[0],y=a[1];ctx.save();ctx.translate(x,y);ctx.lineWidth=.012;
      if(look.identity==='fossil'){
        ctx.fillStyle='#6c5037';ctx.fillRect(-.17,-.14,.12,.19);ctx.strokeStyle='#f2d6a0';ctx.strokeRect(-.17,-.14,.12,.19);
        ctx.beginPath();ctx.arc(.08,0,.075,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(.08,0,.04,0,Math.PI*1.7);ctx.stroke();
        ctx.strokeStyle='#eee0bc';ctx.beginPath();ctx.moveTo(-.1,-.1);ctx.lineTo(-.1,.13);ctx.stroke();
      }else if(look.identity==='office'){
        ctx.fillStyle='#b36c41';ctx.beginPath();ctx.moveTo(0,.25);ctx.lineTo(.055,.15);ctx.lineTo(.035,-.2);ctx.lineTo(-.02,-.25);ctx.lineTo(-.055,-.17);ctx.lineTo(-.025,.15);ctx.closePath();ctx.fill();
        ctx.strokeStyle='#526978';ctx.beginPath();ctx.moveTo(-.19,.25);ctx.lineTo(.2,-.25);ctx.stroke();ctx.fillStyle='#3a4b59';ctx.fillRect(.1,-.28,.19,.17);ctx.strokeStyle='#d5b17a';ctx.strokeRect(.1,-.28,.19,.17);
        ctx.fillStyle='#faf3dd';ctx.fillRect(-.17,-.04,.09,.12);ctx.fillStyle='#497187';ctx.fillRect(-.15,.02,.05,.035);
      }else if(look.identity==='athlete'){
        ctx.strokeStyle='#e9f4d8';ctx.lineWidth=.025;ctx.beginPath();ctx.moveTo(-.22,.25);ctx.lineTo(-.13,.07);ctx.moveTo(.12,.24);ctx.lineTo(.21,.06);ctx.stroke();
        ctx.fillStyle='#ddf1e4';ctx.beginPath();ctx.ellipse(-.11,-.05,.045,.025,.2,0,Math.PI*2);ctx.fill();
      }else{
        ctx.strokeStyle='#9eb7ce';ctx.beginPath();ctx.moveTo(-.16,.25);ctx.lineTo(-.06,.07);ctx.lineTo(-.1,-.15);ctx.moveTo(.14,.25);ctx.lineTo(.04,.07);ctx.lineTo(.08,-.15);ctx.stroke();
        ctx.fillStyle='#d4c295';ctx.beginPath();ctx.arc(-.12,.14,.026,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d2e0e9';ctx.fillRect(.09,.01,.065,.035);
      }
      ctx.restore();
    }
    // 号码
    const c = pt(0.24, 0.05);
    ctx.save();
    ctx.translate(c[0], c[1]);
    ctx.scale(f || 1, -1);
    ctx.rotate(P.lean * (f || 1));
    ctx.font = `italic 900 ${look.num.length > 2 ? 0.09 : 0.12}px "DIN Alternate","Bahnschrift","Arial Black",sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(look.num, 0, 0);
    ctx.restore();
  }

  /**
   * 绘制角色。o: { time, mood, gazeX, gazeY, spring:[dx,dy], flat:颜色（残影）, glow:拍面高光 }
   * 返回姿态（供拍面轨迹使用）。
   */
  function shortsPanel(g,H,K,r,color,look,lw,flat){
    const dx=K[0]-H[0],dy=K[1]-H[1],n=Math.hypot(dx,dy)||1,nx=-dy/n,ny=dx/n,end=[H[0]+dx*.49,H[1]+dy*.49];
    g.beginPath();g.moveTo(H[0]+nx*r,H[1]+ny*r);g.quadraticCurveTo(end[0]+nx*r*1.2,end[1]+ny*r*1.2,end[0]+nx*r*.82,end[1]+ny*r*.82);g.lineTo(end[0]-nx*r*.82,end[1]-ny*r*.82);g.quadraticCurveTo(end[0]-nx*r,H[1]-ny*r,H[0]-nx*r,H[1]-ny*r);g.closePath();g.fillStyle=flat||color;g.fill();if(!flat){g.strokeStyle=look.outline;g.lineWidth=lw*.8;g.stroke();g.strokeStyle=look.trim;g.lineWidth=.007;g.beginPath();g.moveTo(end[0]+nx*r*.72,end[1]+ny*r*.72);g.lineTo(end[0]-nx*r*.72,end[1]-ny*r*.72);g.stroke();}
  }
  function jointFallback(g,a,j,b,w,c,o,lw){limb(g,a,j,w[0],w[2],c,null,lw,o);limb(g,j,b,w[2],w[4],c,null,lw,o);}
  YY.drawCharacter = function (ctx, p, look, o = {}) {
    const art=YY.CharacterArt?.profile(look);
    o={...o,art:o.art||art,identity:o.identity||YY.CharacterArt?.motionFor(p,look)};
    const base = o.pose || pose(p, o.time || 0, o);
    const P = o.pose || (o.showcase && YY.CharacterArt ? YY.CharacterArt.displayPose(p,o.time||0,look,base) : base);
    const lw = 0.0115;
    const flat = o.flat || null;
    const bw = art?.limb || (look.slim ? 0.72 : look.buff ? 1.22 : 1), hs = (look.headScale || 1)*(art?.head||1);
    const dark = (c) => (flat ? flat : shade(c, 0.78));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 后腿
    if (!flat && look.marketTier >= 3) YY.MarketArt?.back(ctx,P,look,p,o);
    (YY.CharacterArt?.limb||jointFallback)(ctx,P.H2,P.K2,P.F2,[.086,.096,.054,.072,.042].map(v=>v*bw),dark(look.stockings||look.skin),flat?null:look.outline,lw);
    if (!flat) limb(ctx, [lerp(P.K2[0], P.F2[0], 0.72), lerp(P.K2[1], P.F2[1], 0.72)], P.F2, 0.05, 0.047, shade(look.sock, 0.85), null, lw, look.outline);
    if(!flat && look.marketTier>=3) YY.MarketArt?.limb(ctx,P.K2,P.F2,look,'shin');
    shoe(ctx, P.F2, P.K2, look, lw, flat ? flat : null, o.shoePulse || 0, o.time, !p.onGround);
    // Resting hands can come in front of the shirt to actually hold a prop.
    const freeArm=()=>{
    (YY.CharacterArt?.limb||jointFallback)(ctx,P.S2,P.E2,P.W2,[.058,.068,.040,.052,.034].map(v=>v*bw),dark(look.skin),flat?null:look.outline,lw);
    if (!flat) {
      if (!look.tank) limb(ctx, P.S2, [lerp(P.S2[0], P.E2[0], 0.38), lerp(P.S2[1], P.E2[1], 0.38)], 0.066 * bw, 0.056 * bw, look.shirt2, null, lw, look.outline);
      if(look.marketTier>=3){YY.MarketArt?.limb(ctx,P.S2,P.E2,look,'shoulder');YY.MarketArt?.limb(ctx,P.E2,P.W2,look,'arm');}
      ctx.fillStyle = dark(look.skin);
      if(!P.freeFront){if(YY.CharacterArt?.hand)YY.CharacterArt.hand(ctx,P.E2,P.W2,look,P.freeGesture||false);else{ctx.beginPath();ctx.arc(P.W2[0],P.W2[1],.04,0,Math.PI*2);ctx.fill();}}
    }
    };
    if(!P.freeFront)freeArm();
    // 发尾（在头后）
    const scaleHead = (fn) => { if (hs === 1) return fn(); ctx.save(); ctx.translate(P.hd[0], P.hd[1] - 0.06); ctx.scale(hs, hs); ctx.translate(-P.hd[0], -(P.hd[1] - 0.06)); fn(); ctx.restore(); };
    // 短裤
    const thigh = (K) => [lerp(P.H[0], K[0], 0.48), lerp(P.H[1], K[1], 0.48)];
    shortsPanel(ctx,P.H2,P.K2,.10*bw,shade(look.shorts,.88),look,lw,flat);
    // 躯干
    torso(ctx, P, look, lw, flat, o.f);
    // 前腿
    (YY.CharacterArt?.limb||jointFallback)(ctx,P.H1,P.K1,P.F1,[.090,.101,.056,.077,.044].map(v=>v*bw),flat||look.stockings||look.skin,flat?null:look.outline,lw);
    if (!flat) limb(ctx, [lerp(P.K1[0], P.F1[0], 0.72), lerp(P.K1[1], P.F1[1], 0.72)], P.F1, 0.051, 0.048, look.sock, null, lw, look.outline);
    if(!flat && look.marketTier>=3) YY.MarketArt?.limb(ctx,P.K1,P.F1,look,'shin');
    shoe(ctx, P.F1, P.K1, look, lw, flat ? flat : null, o.shoePulse || 0, o.time, !p.onGround);
    shortsPanel(ctx,P.H1,P.K1,.108*bw,look.shorts,look,lw,flat);
    if (!flat) {
      // 短裤侧条
      const tk = thigh(P.K1);
      ctx.strokeStyle = look.stripe; ctx.lineWidth = 0.022;
      ctx.beginPath(); ctx.moveTo(P.H[0] - 0.02, P.H[1] + 0.05); ctx.lineTo(tk[0] - 0.05, tk[1]); ctx.stroke();
      if (look.prison) YY.MarketArt?.prisonLegs(ctx, P, look, o.time || 0);
    }
    if(look.dress||['bow','star'].includes(art?.detail)){
      const x=P.H[0],y=P.H[1],sway=clamp(p.vx||0,-5,5)*.006;
      ctx.beginPath();ctx.moveTo(x-.14,y+.025);ctx.lineTo(x+.15,y+.025);ctx.quadraticCurveTo(x+.22+sway,y-.12,x+.26+sway,y-.30);ctx.quadraticCurveTo(x,y-.35,x-.24+sway,y-.30);ctx.closePath();const skirtColor=look.dress?look.shirt:look.shorts,skirt=ctx.createLinearGradient(x-.22,y,x+.25,y-.3);skirt.addColorStop(0,shade(skirtColor,.87));skirt.addColorStop(.38,shade(skirtColor,1.10));skirt.addColorStop(1,skirtColor);ctx.fillStyle=flat||skirt;ctx.fill();
      if(!flat){ctx.strokeStyle=look.outline;ctx.lineWidth=lw;ctx.stroke();ctx.strokeStyle=look.trim;ctx.lineWidth=.008;ctx.beginPath();ctx.moveTo(x-.22+sway,y-.29);ctx.quadraticCurveTo(x,y-.33,x+.24+sway,y-.29);ctx.stroke();}
    }
    // 头
    if (flat) {
      ctx.fillStyle = flat;
      ctx.beginPath(); ctx.arc(P.hd[0], P.hd[1], 0.14, 0, Math.PI * 2); ctx.fill();
    } else {limb(ctx,P.N,[P.hd[0],P.hd[1]-.07],.046,.043,look.skin2,null,lw,look.outline);scaleHead(() => YY.CharacterArt?.head2D?YY.CharacterArt.head2D(ctx,P,look,o):head(ctx,P,look,o,lw));}
    if(!flat && look.marketTier>=3)scaleHead(()=>YY.MarketArt?.visor(ctx,P,look));
    // 持拍手（最前）
    (YY.CharacterArt?.limb||jointFallback)(ctx,P.S,P.E,P.W,[.064,.074,.043,.056,.036].map(v=>v*bw),flat||look.skin,flat?null:look.outline,lw);
    if (!flat) {
      // 护腕
      const wb = [lerp(P.E[0], P.W[0], 0.78), lerp(P.E[1], P.W[1], 0.78)];
      limb(ctx, wb, [lerp(P.E[0], P.W[0], 0.92), lerp(P.E[1], P.W[1], 0.92)], 0.047, 0.045, look.wrist, null, lw, look.outline);
      // 袖口
      if (!look.tank) limb(ctx, P.S, [lerp(P.S[0], P.E[0], 0.35), lerp(P.S[1], P.E[1], 0.35)], 0.07 * bw, 0.06 * bw, look.shirt, null, lw, look.outline);
      if(look.marketTier>=3){YY.MarketArt?.limb(ctx,P.S,P.E,look,'shoulder');YY.MarketArt?.limb(ctx,P.E,P.W,look,'arm');}
    }
    if(P.freeFront)freeArm();
    if (!o.hideRacket && P.showRacket!==false) {
      if(!flat && look.marketTier>=3 && YY.MarketArt) YY.MarketArt.racket(ctx,P,look,o);
      else if(!o.mechanical)racket(ctx, P, look, lw, flat, o.glow || 0, o.racketPulse || 0);
      if(!flat&&o.inkReady&&!o.mechanical){const h=YY.racketHead(P);ctx.save();ctx.translate(h[0],h[1]);ctx.scale(1,-1);YY.SkillFX?.inkRacket?.(ctx,0,0,1/42,o.time||0,-P.Rk);ctx.restore();}
    }
    // Fingers close around the grip; small seams make the hand readable.
    if(!flat){ctx.strokeStyle=look.skin2;ctx.lineWidth=.007;ctx.beginPath();ctx.moveTo(P.W[0]-.026,P.W[1]-.018);ctx.lineTo(P.W[0]+.015,P.W[1]-.023);ctx.stroke();}
    if(!flat&&art?.detail==='knee'){
      ctx.save();ctx.translate(P.K1[0]+.02,P.K1[1]-.01);ctx.rotate(-.3);ctx.fillStyle='#ead5b6';YY.rr(ctx,-.045,-.025,.09,.05,.01);ctx.fill();ctx.strokeStyle='#c29d78';ctx.lineWidth=.005;ctx.stroke();ctx.restore();
    }
    if(!flat&&art?.detail==='tape')limb(ctx,mixPoint(P.S,P.E,.6),mixPoint(P.S,P.E,.76),.047,.044,'#d9e8d9',null,lw*.4,look.shirt2);
    // Props sit in the palms; the fingers overlap their lower edge.
    if(o.showcase&&!flat)YY.CharacterArt?.showcaseAccessory(ctx,P,look,o.time||0);
    if(P.freeFront&&!flat)YY.CharacterArt?.hand(ctx,P.E2,P.W2,look,P.freeGesture||false);
    // 手
    ctx.fillStyle = flat || look.skin;
    if(!flat&&YY.CharacterArt?.hand)YY.CharacterArt.hand(ctx,P.E,P.W,look,P.handGesture||true);else{ctx.beginPath();ctx.arc(P.W[0],P.W[1],.04,0,Math.PI*2);ctx.fill();}
    if (!flat && look.prison) YY.MarketArt?.prisonCuffs(ctx, P, look, o.time || 0);
    return P;
  };

  /** 拍头中心（局部坐标） */
  YY.racketHead = (P) => [P.W[0] + Math.cos(P.Rk) * RK_OFF * (P.rs || 1), P.W[1] + Math.sin(P.Rk) * RK_OFF * (P.rs || 1)];

  /** Full-body key art shares the playable model and authored personal gesture. */
  // 立绘背景：深色底 → 角色色光晕 → 运动斜线 → 身份徽记水印 → 地平线与投影。
  // 全部由角色配色推导，20 人同一套版式、不同气质；文字与人物都压在暗背景上，
  // 不再出现整张粉色/浅蓝的平涂。
  YY.illustrationBackdrop=function(g,look,width,height){
    const W=width,H=height,tone=look.shirt,tone2=look.shirt2||shade(tone,.7),trim=look.trim||'#f3d9a4';
    const base=g.createLinearGradient(0,0,W*.35,H);
    base.addColorStop(0,shade(tone2,.42));base.addColorStop(.5,shade(tone2,.30));base.addColorStop(1,shade(tone2,.20));
    g.fillStyle=base;g.fillRect(0,0,W,H);
    // 角色色光晕，压在头肩之后。
    const glow=g.createRadialGradient(W*.52,H*.3,0,W*.52,H*.3,W*.62);
    glow.addColorStop(0,YY.tint(shade(tone,1.06),.22));glow.addColorStop(.42,YY.tint(tone,.11));glow.addColorStop(1,'#00000000');
    g.fillStyle=glow;g.fillRect(0,0,W,H);
    // 斜向运动带：三条宽窄不同的斜切色块，形成层次。
    g.save();
    for(const [u,w,a]of[[.18,.30,.05],[.58,.17,.07],[.82,.10,.05]]){
      g.fillStyle=tone;g.globalAlpha=a;g.beginPath();
      g.moveTo(W*u,H);g.lineTo(W*(u+w),H);g.lineTo(W*(u+w)+W*.42,0);g.lineTo(W*u+W*.42,0);g.closePath();g.fill();
    }
    g.restore();
    // 球路弧线：两道细弧从右下扫向中心，暗示挥拍轨迹。
    g.save();g.strokeStyle=trim;g.lineWidth=Math.max(1,W*.004);
    for(const [r,o]of[[W*.9,.10],[W*1.12,.06]]){g.globalAlpha=o;g.beginPath();g.ellipse(W*.98,H*.98,r,r*.78,0,Math.PI*1.08,Math.PI*1.52);g.stroke();}
    g.restore();
    // 身份徽记水印。
    const motif=YY.CharacterArt?.profile(look)?.motif||'wing';
    g.save();g.globalAlpha=.075;g.strokeStyle=trim;g.fillStyle=trim;
    g.translate(W*.7,H*.24);YY.CharacterArt?.emblem(g,motif,0,0,W*.3,trim);g.restore();
    // 地面：一条暗带 + 透视线，给站姿一个落脚面。
    const floor=g.createLinearGradient(0,H*.72,0,H);floor.addColorStop(0,'#00000000');floor.addColorStop(1,'#00000055');
    g.fillStyle=floor;g.fillRect(0,H*.72,W,H*.28);
    g.save();g.strokeStyle='#ffffff';g.globalAlpha=.07;g.lineWidth=1;
    for(let i=-3;i<=3;i++){g.beginPath();g.moveTo(W*.5+i*W*.1,H*.74);g.lineTo(W*.5+i*W*.34,H);g.stroke();}
    g.restore();
    // 浮尘：确定性分布的亮点，不随时间闪烁。
    g.save();
    for(let i=0;i<18;i++){const x=((i*97)%100)/100*W,y=((i*61+17)%100)/100*H*.92,r=i%5===0?W*.006:W*.0028;g.fillStyle=i%3?trim:'#ffffff';g.globalAlpha=.06+(i%4)*.05;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();}
    g.restore();
    // 压角：左上标题区与底部名牌区更暗，保证文字可读。
    const top=g.createLinearGradient(0,0,0,H*.24);top.addColorStop(0,'#00000066');top.addColorStop(1,'#00000000');g.fillStyle=top;g.fillRect(0,0,W,H*.24);
  };
  YY.characterIllustration=function(look,width=360,height=460){
    const c=YY.platform.createCanvas();c.width=width;c.height=height;const g=c.getContext('2d');
    YY.illustrationBackdrop(g,look,width,height);
    const player={idx:0,dir:1,vx:0,vy:0,onGround:true,swing:null,runPhase:0,land:0,x:0,y:0,buff:{}},opts={time:.4,showcase:true,gazeX:.4,quality:1};
    const P=YY.CharacterArt.displayPose(player,.4,look,pose(player,.4)),bounds=YY.CharacterArt.displayBounds(P);
    const minX=bounds.minX-.05,maxX=bounds.maxX+.05,maxY=bounds.maxY;
    const footY=height*.905,k=Math.min(footY*.9/maxY,width*.82/(maxX-minX)),cx=width*.5-(minX+maxX)*.5*k;
    // 站立高光柱：人物身后的柔光，避免与暗背景糊在一起。
    const halo=g.createRadialGradient(cx,height*.42,0,cx,height*.42,k*.95);
    halo.addColorStop(0,YY.tint(shade(look.shirt,1.5),.19));halo.addColorStop(1,'#00000000');
    g.fillStyle=halo;g.fillRect(0,0,width,height);
    g.save();g.translate(cx,footY);g.scale(1,.19);
    const shadow=g.createRadialGradient(0,0,0,0,0,k*.62);shadow.addColorStop(0,'#000000b0');shadow.addColorStop(.7,'#00000040');shadow.addColorStop(1,'#00000000');g.fillStyle=shadow;g.beginPath();g.arc(0,0,k*.62,0,Math.PI*2);g.fill();g.restore();
    g.save();g.translate(cx,footY);g.scale(k,-k);YY.drawCharacter(g,player,look,opts);g.restore();
    // 名牌：色条 + 姓名，左下角。
    const pad=width*.075,plateH=Math.max(16,height*.058),py=height-plateH-pad*.9;
    g.save();
    g.fillStyle=YY.tint(shade(look.shirt2||"#12222e",.42),.75);YY.rr(g,pad*.7,py,width-pad*1.4,plateH,plateH*.28);g.fill();
    g.fillStyle=look.trim||'#f3d9a4';g.fillRect(pad*.7,py+plateH*.28,Math.max(2,width*.006),plateH*.44);
    g.fillStyle='#fff8e9';g.textBaseline='middle';g.font='700 '+Math.round(plateH*.52)+'px '+YY.FONT;
    g.fillText(look.name,pad*.7+plateH*.34,py+plateH*.52);
    g.restore();
    g.save();g.globalAlpha=.5;g.fillStyle='#ffffff';g.font='600 '+Math.round(width*.024)+'px '+YY.FONT;g.fillText('Y U Y U E   /   C L U B',pad*.7,height*.075);g.restore();
    return c;
  };

  /** 头像：与立绘同一套头与配色，深色底 + 角色色光 + 肩线，小尺寸也能看清表情。 */
  YY.portrait = function (look, size) {
    const c=YY.platform.createCanvas();c.width=c.height=size;const g=c.getContext('2d'),a=YY.CharacterArt?.acting(look)||{tilt:0,hip:0,expression:'confident'};
    const tone=look.shirt,tone2=look.shirt2||shade(tone,.7),trim=look.trim||'#f3d9a4';
    const bg=g.createLinearGradient(0,0,size,size);bg.addColorStop(0,shade(tone2,.46));bg.addColorStop(1,shade(tone2,.26));g.fillStyle=bg;g.fillRect(0,0,size,size);
    const glow=g.createRadialGradient(size*.5,size*.42,0,size*.5,size*.42,size*.62);
    glow.addColorStop(0,YY.tint(shade(tone,1.05),.27));glow.addColorStop(.6,YY.tint(tone,.09));glow.addColorStop(1,'#00000000');g.fillStyle=glow;g.fillRect(0,0,size,size);
    g.save();g.globalAlpha=.1;g.strokeStyle=trim;g.lineWidth=size*.012;
    for(let i=0;i<3;i++){g.beginPath();g.moveTo(size*(.1+i*.28),size);g.lineTo(size*(.34+i*.28),0);g.stroke();}g.restore();
    // 肩与领口：和立绘同一躯干色，给头像一个“半身像”的底。
    g.save();g.translate(size*.5,size*1.06);g.rotate(a.tilt*.22);g.scale(size*.58,size*.58);
    const torso=g.createLinearGradient(-.5,0,.5,0);torso.addColorStop(0,shade(tone,.72));torso.addColorStop(.45,tone);torso.addColorStop(1,shade(tone,1.12));
    g.fillStyle=torso;g.beginPath();g.moveTo(-1.0,.26);g.quadraticCurveTo(-1.02,-.62,-.4,-.78);g.quadraticCurveTo(0,-.55,.4,-.78);g.quadraticCurveTo(1.02,-.62,1.0,.26);g.closePath();g.fill();
    g.strokeStyle=shade(tone2,.7);g.lineWidth=.05;g.stroke();
    g.strokeStyle=trim;g.lineWidth=.075;g.beginPath();g.moveTo(-.42,-.74);g.quadraticCurveTo(0,-.34,.42,-.74);g.stroke();
    g.globalAlpha=.9;YY.CharacterArt?.emblem(g,YY.CharacterArt.profile(look).motif,-.62,-.34,.11,trim);g.globalAlpha=1;g.restore();
    g.save();g.translate(size*.5,size*.47);g.rotate(a.tilt*.7);g.scale(size*.285,size*.285);
    if(YY.CharacterArt)YY.CharacterArt.head(g,look,{expression:a.expression,turn:a.hip,time:.4,gaze:a.tilt*2});else{g.scale(1/.147,-1/.147);head(g,{hd:[0,0],N:[0,-.15]},look,{time:.4,mood:'focus'},.009);}
    g.restore();
    const vign=g.createRadialGradient(size*.5,size*.5,size*.34,size*.5,size*.5,size*.72);
    vign.addColorStop(0,'#00000000');vign.addColorStop(1,'#00000055');g.fillStyle=vign;g.fillRect(0,0,size,size);
    return c;
  };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof window !== 'undefined' ? window : globalThis);
