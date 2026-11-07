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
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) if (t <= keys[i][0])
      return lerp(keys[i - 1][1], keys[i][1], smooth(keys[i - 1][0], keys[i][0], t));
    return keys[keys.length - 1][1];
  }
  function motionFrame(p) {
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
    const follow = [c.follow + 18, c.follow, c.follow - (over ? 12 : -5)];
    const arm = ready.map((v, i) => channel([[0, v], [.052 + i * .006, backs[i]], [.11 + (i - 2) * .004, hit[i]], [.175 + i * .008, follow[i]], [.3, v]], t));
    // 肩髋依次释放，拍头最后加速。负手先指球、再收肘帮助转体。
    const hipYaw = weight * c.turn * lerp(-.72, .5, hipDrive);
    const chestYaw = weight * c.turn * lerp(-1.06, .72, chestDrive);
    const lean = weight * (over ? lerp(-.22, .12 + c.power * .19, chestDrive) : under ? .06 : c.lunge * .2);
    const load = weight * (over ? .075 * (1 - hipDrive) - .018 * release : .025);
    const lunge = c.lunge * smooth(0, .085, t) * (1 - smooth(.16, .3, t));
    const off = over ? channel([[0,22],[.045,112],[.085,116],[.15,-46],[.3,22]],t)
      : channel([[0,22],[.075,-100],[.17,-66],[.3,22]],t);
    const offBend = over ? channel([[0,.6],[.05,.2],[.1,.45],[.16,1.6],[.3,.6]],t) : .6 + .3 * weight;
    const frame = { style, family: c.family, overhead: over ? 1 : 0, power: c.power, t, weight, hipYaw, chestYaw, lean, load, lunge, off, offBend,
      hipX: weight * (over ? lerp(-.065, .11, hipDrive) : .1 * c.lunge), arm, scissor: chestDrive,
      // 长随挥只属于重杀，疲劳延长普通挥拍不应变成杀球动作。
      smash: style === 'smash', face: style === 'slice' || style === 'tumble' ? .48 + .52 * Math.abs(Math.cos(t * 32)) : 1 };
    if (sw.fromStyle && (sw.fromStyle !== style || sw.fromDur !== sw.dur) && sw.contact && sw.t < sw.contact.t + .065) {
      const from = motionFrame({ ...p, swing: { ...sw, style: sw.fromStyle, fromStyle: null, dur: sw.fromDur || sw.dur } });
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
    const sw = p.swing, motion = p.motion || {}, shot = motionFrame(p), air = !p.onGround;
    const speed = motion.speed == null ? p.vx * p.dir : motion.speed;
    const run = smooth(.05, 3.9, Math.abs(speed)), fwd = Math.sign(speed) || 1;
    const ph = p.runPhase || 0, mood = o.mood || 'play', play = mood === 'play';
    const tiredK = p.stamina == null ? 0 : clamp((40 - p.stamina)/40,0,1);
    const landing = motion.land == null ? clamp((p.land || 0)/.08,0,1) : Math.sin(Math.PI * clamp(1-motion.land/.2,0,1));
    const split = play && !sw && !air ? Math.sin(Math.PI * clamp(1-(motion.split||0)/.18,0,1)) * (1-run*.7) : 0;
    const lunge = shot && !air ? shot.lunge * (shot.style==='lift' && Math.abs(p.x)>2.8 ? .55 : 1) : 0;
    const weight = shot ? shot.weight : 0;
    const brake = clamp(motion.accel || 0, -1, 1);
    const breathe = Math.sin(t*(3.2+tiredK*4)+p.idx)*(.008+tiredK*.012)*(1-run);
    let hipY = .86 + breathe - .13*landing - .055*split - tiredK*.04 - lunge*.17 - (shot ? shot.load : 0);
    if (mood==='sad') hipY-=.04;
    if (mood==='tired') hipY-=.1;
    if (mood==='cheer') hipY+=.025;
    let F1=[.23,0], F2=[-.21,0];
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
    const H=[(shot?shot.hipX:0)+lunge*.09+brake*.025,hipY];
    const hipYaw=shot?shot.hipYaw:-run*fwd*.15;
    const chestYaw=shot?shot.chestYaw:-run*fwd*.28;
    const H1=[H[0]+Math.sin(hipYaw)*.055,H[1]],H2=[H[0]-Math.sin(hipYaw)*.055,H[1]-.012];
    // 跨步时压低重心，让脚踝和髋部保持在腿长可达范围。
    const reach=Math.max(Math.hypot(F1[0]-H1[0],F1[1]-H1[1]),Math.hypot(F2[0]-H2[0],F2[1]-H2[1]));
    if(reach>.925&&!air){const drop=Math.min(.16,reach-.925);H[1]-=drop;H1[1]-=drop;H2[1]-=drop;}
    const K1=ik(...H1,...F1,.47,.47,1),K2=ik(...H2,...F2,.47,.47,1);
    let lean=.1+run*.12*fwd+brake*.055+lunge*.24+tiredK*.1+(shot?shot.lean:0);
    if(air)lean-=.07*(1-weight);
    if(!sw)lean+=MOOD_LEAN[mood]||0;
    const ux=Math.sin(lean),uy=Math.cos(lean), shoulderTurn=Math.sin(chestYaw)*.14;
    const N=[H[0]+ux*.56,H[1]+uy*.56];
    const S=[H[0]+ux*.5+shoulderTurn*uy,H[1]+uy*.5-shoulderTurn*ux];
    const S2=[H[0]+ux*.5-shoulderTurn*uy-.025,H[1]+uy*.5+shoulderTurn*ux-.025];
    const tilt=MOOD_HEAD[mood]!=null?MOOD_HEAD[mood]+Math.sin(t*2.1+p.idx)*.03:-clamp((o.gazeY||0)*.12,-.2,.35);
    const hd=[N[0]+Math.sin(lean+tilt*.5)*.16,N[1]+Math.cos(lean+tilt*.5)*.16];

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
    // 触球点为硬约束；收拍立即离开接触点，避免原来 35ms 钉住拍面再拖走的粘滞感。
    // 来球预瞄只影响显示，不扩大甜区，不改变物理判定。
    let target=null, lock=0;
    if(sw&&sw.contact&&sw.t>=sw.contact.t){
      target=[(sw.contact.x-p.x)*p.dir,sw.contact.y-p.y];
      lock=1-smooth(0,.085,sw.t-sw.contact.t);
    } else if(sw&&sw.serve){target=[.42,.9-p.y];lock=smooth(.035,.1,sw.t);}
    else if(sw&&o.aim){target=[(o.aim.x-p.x)*p.dir,o.aim.y-p.y];lock=.72*smooth(.045,.1,sw.t)*(1-smooth(.14,.205,sw.t));}
    if(target&&lock>0){
      const current=[W[0]+Math.cos(Rk)*RK_OFF,W[1]+Math.sin(Rk)*RK_OFF];
      const T=mixPoint(current,target,lock),dx=T[0]-S[0],dy=T[1]-S[1],r=Math.hypot(dx,dy);
      // 优先弯肘，只有超出肢体总长的扑救才适度拉伸整条链。
      rs=Math.max(1,r/(.29+.27+RK_OFF-.006));
      const angle=Math.atan2(dy,dx);
      const wrist=[T[0]-Math.cos(angle)*RK_OFF*rs,T[1]-Math.sin(angle)*RK_OFF*rs];
      E=ik(...S,...wrist,.29*rs,.27*rs,dy>0?-1:1);W=wrist;Rk=angle;
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
    return {H,H1,H2,K1,K2,F1,F2,N,S,S2,E,W,E2,W2,hd,lean,Rk,rs,A:Rk,ux,uy,air,run,
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
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (f < 1) { r *= f; g *= f; b *= f; }
    else { r += (255 - r) * (f - 1); g += (255 - g) * (f - 1); b += (255 - b) * (f - 1); }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }
  YY.shade = shade;

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

  function hairBack(ctx, P, look, o, lw) {
    const hd = P.hd;
    const sp = o.spring || [0, 0];
    const tail = (root, len, drop, w, col) => {
      const tip = [root[0] - len + sp[0], root[1] - drop + sp[1]];
      const mid = [(root[0] + tip[0]) / 2 - 0.02, (root[1] + tip[1]) / 2 + 0.05];
      ctx.beginPath();
      ctx.moveTo(root[0], root[1] + w);
      ctx.quadraticCurveTo(mid[0], mid[1] + w * 1.5, tip[0], tip[1]);
      ctx.quadraticCurveTo(mid[0] + 0.02, mid[1] - w * 1.2, root[0] + 0.02, root[1] - w);
      ctx.closePath();
      ctx.fillStyle = col || look.hairC; ctx.fill();
      ctx.lineWidth = lw; ctx.strokeStyle = look.outline; ctx.stroke();
    };
    if (look.hair === 'twin') {
      // 双马尾：两条长度不同的辫子，随弹簧摆动
      tail([hd[0] - 0.05, hd[1] + 0.13], 0.16, 0.2, 0.035, YY.shade(look.hairC, 0.8));
      tail([hd[0] - 0.11, hd[1] + 0.06], 0.2, 0.17, 0.04);
      ctx.fillStyle = look.band;
      for (const r of [[hd[0] - 0.05, hd[1] + 0.13], [hd[0] - 0.11, hd[1] + 0.06]]) { ctx.beginPath(); ctx.arc(r[0], r[1], 0.026, 0, Math.PI * 2); ctx.fill(); }
      return;
    }
    if (look.hair === 'bun') {
      // 丸子头 + 发簪
      const bx = hd[0] - 0.08 + sp[0] * 0.15, by = hd[1] + 0.14 + sp[1] * 0.15;
      ctx.strokeStyle = look.band; ctx.lineWidth = 0.014; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(bx - 0.08, by + 0.05); ctx.lineTo(bx + 0.07, by - 0.04); ctx.stroke();
      ctx.beginPath(); ctx.arc(bx, by, 0.06, 0, Math.PI * 2);
      ctx.fillStyle = look.hairC; ctx.fill();
      ctx.lineWidth = lw; ctx.strokeStyle = look.outline; ctx.stroke();
      ctx.strokeStyle = look.hairHi; ctx.lineWidth = 0.012;
      ctx.beginPath(); ctx.arc(bx, by, 0.035, 2.2, 3.6); ctx.stroke();
      return;
    }
    if (look.hair === 'bangs') {
      // 后脑碎发
      tail([hd[0] - 0.11, hd[1] + 0.02], 0.1, 0.12, 0.05);
      return;
    }
    if (look.hair === 'long') {
      // 披肩长发：头后垂下，发梢随弹簧摆动
      const top = [hd[0] - 0.02, hd[1] + 0.1], sx = sp[0] * 0.6, sy = sp[1] * 0.4;
      ctx.beginPath();
      ctx.moveTo(top[0] + 0.1, top[1]);
      ctx.quadraticCurveTo(hd[0] - 0.2, hd[1] + 0.18, hd[0] - 0.18 + sx, hd[1] - 0.12);
      ctx.quadraticCurveTo(hd[0] - 0.2 + sx, hd[1] - 0.3 + sy, hd[0] - 0.08 + sx, hd[1] - 0.36 + sy);
      ctx.quadraticCurveTo(hd[0] - 0.02 + sx * 0.5, hd[1] - 0.26, hd[0] + 0.03, hd[1] - 0.12);
      ctx.closePath();
      ctx.fillStyle = look.hairC; ctx.fill();
      ctx.lineWidth = lw; ctx.strokeStyle = look.outline; ctx.stroke();
      ctx.strokeStyle = look.hairHi; ctx.lineWidth = 0.01;
      ctx.beginPath(); ctx.moveTo(hd[0] - 0.12, hd[1] + 0.06); ctx.quadraticCurveTo(hd[0] - 0.16 + sx, hd[1] - 0.14, hd[0] - 0.1 + sx, hd[1] - 0.3 + sy); ctx.stroke();
      return;
    }
    if (['buzz', 'bowl', 'side', 'mess', 'gray', 'crew', 'part', 'quiff'].includes(look.hair)) return;
    if (look.hair === 'ponytail') {
      const root = [hd[0] - 0.1, hd[1] + 0.07];
      const tip = [root[0] - 0.2 + sp[0], root[1] - 0.12 + sp[1]];
      const mid = [(root[0] + tip[0]) / 2 - 0.02, (root[1] + tip[1]) / 2 + 0.05];
      ctx.beginPath();
      ctx.moveTo(root[0], root[1] + 0.04);
      ctx.quadraticCurveTo(mid[0], mid[1] + 0.06, tip[0], tip[1]);
      ctx.quadraticCurveTo(mid[0] + 0.02, mid[1] - 0.05, root[0] + 0.02, root[1] - 0.04);
      ctx.closePath();
      ctx.fillStyle = look.hairC; ctx.fill();
      ctx.lineWidth = lw; ctx.strokeStyle = look.outline; ctx.stroke();
      ctx.fillStyle = look.band;
      ctx.beginPath(); ctx.ellipse(root[0], root[1], 0.022, 0.035, 0.4, 0, Math.PI * 2); ctx.fill();
    } else {
      // 头带飘带
      const r0 = [hd[0] - 0.12, hd[1] + 0.03];
      const t1 = [r0[0] - 0.17 + sp[0], r0[1] - 0.03 + sp[1]];
      const t2 = [r0[0] - 0.14 + sp[0] * 0.8, r0[1] - 0.09 + sp[1] * 0.9];
      ctx.fillStyle = look.band;
      for (const tp of [t1, t2]) {
        ctx.beginPath();
        ctx.moveTo(r0[0], r0[1] + 0.02);
        ctx.quadraticCurveTo((r0[0] + tp[0]) / 2, (r0[1] + tp[1]) / 2 + 0.04, tp[0], tp[1]);
        ctx.lineTo(tp[0] + 0.02, tp[1] - 0.025);
        ctx.quadraticCurveTo((r0[0] + tp[0]) / 2, (r0[1] + tp[1]) / 2, r0[0], r0[1] - 0.02);
        ctx.closePath();
        ctx.fill();
        ctx.lineWidth = lw * 0.7; ctx.strokeStyle = look.outline; ctx.stroke();
      }
    }
  }

  function head(ctx, P, look, o, lw) {
    const [hx, hy] = P.hd;
    const R = 0.128;
    // 脖子
    limb(ctx, P.N, [hx - 0.01, hy - 0.06], 0.045, 0.045, look.skin2, null, lw, look.outline);
    // 脸
    const gr = ctx.createRadialGradient(hx + 0.04, hy + 0.04, 0.02, hx, hy, R * 1.1);
    gr.addColorStop(0, shade(look.skin, 1.06)); gr.addColorStop(1, look.skin2);
    ctx.beginPath();
    ctx.moveTo(hx - R, hy + 0.02);
    ctx.arc(hx, hy + 0.01, R, Math.PI, 0, true);
    ctx.quadraticCurveTo(hx + R * 1.02, hy - R * 0.75, hx + R * 0.35, hy - R * 1.02);
    ctx.quadraticCurveTo(hx - R * 0.5, hy - R * 1.1, hx - R, hy + 0.02);
    ctx.closePath();
    ctx.fillStyle = gr; ctx.fill();
    ctx.lineWidth = lw; ctx.strokeStyle = look.outline; ctx.stroke();

    // 耳朵
    ctx.fillStyle = look.skin2;
    const ear = look.bigEars ? 1.45 : 1;
    ctx.beginPath(); ctx.ellipse(hx - 0.02, hy - 0.005, 0.024 * ear, 0.034 * ear, 0, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = lw * 0.7; ctx.stroke();
    // 头发
    ctx.fillStyle = look.hairC;
    ctx.beginPath();
    if (look.hair === 'spiky') {
      ctx.moveTo(hx + R * 0.95, hy + 0.03);
      ctx.quadraticCurveTo(hx + R * 0.9, hy + R * 1.05, hx + R * 0.2, hy + R * 1.18);
      ctx.lineTo(hx + R * 0.35, hy + R * 1.42);
      ctx.lineTo(hx - R * 0.15, hy + R * 1.2);
      ctx.lineTo(hx - R * 0.25, hy + R * 1.45);
      ctx.lineTo(hx - R * 0.62, hy + R * 1.05);
      ctx.lineTo(hx - R * 0.95, hy + R * 1.18);
      ctx.lineTo(hx - R * 1.08, hy + R * 0.55);
      ctx.lineTo(hx - R * 1.3, hy + R * 0.3);
      ctx.lineTo(hx - R * 1.06, hy - R * 0.1);
      ctx.quadraticCurveTo(hx - R * 0.9, hy - R * 0.5, hx - R * 0.55, hy - R * 0.35);
      ctx.quadraticCurveTo(hx - R * 0.2, hy + R * 0.2, hx + R * 0.1, hy + R * 0.32);
      ctx.quadraticCurveTo(hx + R * 0.6, hy + R * 0.45, hx + R * 0.95, hy + 0.03);
    } else if (look.hair === 'bowl') {
      // 西瓜头：齐刘海
      ctx.moveTo(hx + R * 1.06, hy + R * 0.32);
      ctx.quadraticCurveTo(hx + R * 1.12, hy + R * 1.28, hx - R * 0.1, hy + R * 1.24);
      ctx.quadraticCurveTo(hx - R * 1.22, hy + R * 1.12, hx - R * 1.14, hy - R * 0.28);
      ctx.lineTo(hx - R * 0.62, hy - R * 0.32);
      ctx.quadraticCurveTo(hx - R * 0.5, hy + R * 0.28, hx + R * 0.05, hy + R * 0.42);
      ctx.lineTo(hx + R * 1.06, hy + R * 0.32);
    } else if (look.hair === 'buzz') {
      // 圆寸 + 一根呆毛
      ctx.moveTo(hx + R * 0.86, hy + R * 0.55);
      ctx.quadraticCurveTo(hx + R * 0.62, hy + R * 1.18, hx - R * 0.2, hy + R * 1.14);
      ctx.quadraticCurveTo(hx - R * 1.1, hy + R * 1.0, hx - R * 1.06, hy + R * 0.1);
      ctx.quadraticCurveTo(hx - R * 0.8, hy + R * 0.5, hx - R * 0.3, hy + R * 0.7);
      ctx.quadraticCurveTo(hx + R * 0.3, hy + R * 0.8, hx + R * 0.86, hy + R * 0.55);
    } else if (look.hair === 'bangs') {
      // 侧分长刘海
      ctx.moveTo(hx + R * 1.08, hy - R * 0.08);
      ctx.quadraticCurveTo(hx + R * 1.18, hy + R * 1.22, hx - R * 0.1, hy + R * 1.26);
      ctx.quadraticCurveTo(hx - R * 1.26, hy + R * 1.06, hx - R * 1.16, hy - R * 0.42);
      ctx.lineTo(hx - R * 0.76, hy - R * 0.56);
      ctx.quadraticCurveTo(hx - R * 0.42, hy + R * 0.1, hx + R * 0.2, hy + R * 0.58);
      ctx.quadraticCurveTo(hx + R * 0.78, hy + R * 0.52, hx + R * 1.08, hy - R * 0.08);
    } else if (look.hair === 'side') {
      // 三七分短发：额前一缕斜刘海，干净利落
      ctx.moveTo(hx + R * 1.02, hy + R * 0.3);
      ctx.quadraticCurveTo(hx + R * 1.08, hy + R * 1.22, hx - R * 0.08, hy + R * 1.24);
      ctx.quadraticCurveTo(hx - R * 1.16, hy + R * 1.1, hx - R * 1.1, hy + R * 0.0);
      ctx.lineTo(hx - R * 0.85, hy - R * 0.12);
      ctx.quadraticCurveTo(hx - R * 0.7, hy + R * 0.5, hx - R * 0.3, hy + R * 0.66);
      ctx.quadraticCurveTo(hx + R * 0.35, hy + R * 0.85, hx + R * 0.72, hy + R * 0.42);
      ctx.quadraticCurveTo(hx + R * 0.9, hy + R * 0.25, hx + R * 1.02, hy + R * 0.3);
    } else if (look.hair === 'long') {
      // 长发的前额：空气刘海
      ctx.moveTo(hx + R * 1.06, hy + R * 0.12);
      ctx.quadraticCurveTo(hx + R * 1.16, hy + R * 1.24, hx - R * 0.1, hy + R * 1.26);
      ctx.quadraticCurveTo(hx - R * 1.24, hy + R * 1.12, hx - R * 1.18, hy - R * 0.5);
      ctx.lineTo(hx - R * 0.82, hy - R * 0.62);
      ctx.quadraticCurveTo(hx - R * 0.66, hy + R * 0.3, hx - R * 0.2, hy + R * 0.5);
      ctx.lineTo(hx + R * 0.1, hy + R * 0.3);
      ctx.lineTo(hx + R * 0.32, hy + R * 0.5);
      ctx.lineTo(hx + R * 0.6, hy + R * 0.28);
      ctx.quadraticCurveTo(hx + R * 0.85, hy + R * 0.35, hx + R * 1.06, hy + R * 0.12);
    } else if (look.hair === 'mess') {
      // 程序员的乱发：几撮翘毛
      ctx.moveTo(hx + R * 0.98, hy + R * 0.3);
      ctx.quadraticCurveTo(hx + R * 1.05, hy + R * 1.0, hx + R * 0.45, hy + R * 1.18);
      ctx.lineTo(hx + R * 0.5, hy + R * 1.42);
      ctx.lineTo(hx + R * 0.1, hy + R * 1.22);
      ctx.lineTo(hx - R * 0.05, hy + R * 1.5);
      ctx.lineTo(hx - R * 0.35, hy + R * 1.2);
      ctx.lineTo(hx - R * 0.75, hy + R * 1.36);
      ctx.lineTo(hx - R * 0.85, hy + R * 1.02);
      ctx.quadraticCurveTo(hx - R * 1.2, hy + R * 0.7, hx - R * 1.1, hy - R * 0.05);
      ctx.quadraticCurveTo(hx - R * 0.8, hy + R * 0.45, hx - R * 0.3, hy + R * 0.62);
      ctx.quadraticCurveTo(hx + R * 0.4, hy + R * 0.7, hx + R * 0.98, hy + R * 0.3);
    } else if (look.hair === 'crew') {
      // 板寸 + 额前美人尖（猴子）
      ctx.moveTo(hx + R * 0.9, hy + R * 0.5);
      ctx.quadraticCurveTo(hx + R * 0.75, hy + R * 1.15, hx - R * 0.15, hy + R * 1.12);
      ctx.quadraticCurveTo(hx - R * 1.1, hy + R * 1.0, hx - R * 1.05, hy + R * 0.05);
      ctx.quadraticCurveTo(hx - R * 0.75, hy + R * 0.45, hx - R * 0.25, hy + R * 0.62);
      ctx.lineTo(hx + R * 0.35, hy + R * 0.48);
      ctx.lineTo(hx + R * 0.55, hy + R * 0.68);
      ctx.quadraticCurveTo(hx + R * 0.75, hy + R * 0.6, hx + R * 0.9, hy + R * 0.5);
    } else if (look.hair === 'part') {
      // 中分刘海（老陈）
      ctx.moveTo(hx + R * 1.04, hy + R * 0.05);
      ctx.quadraticCurveTo(hx + R * 1.12, hy + R * 1.2, hx - R * 0.1, hy + R * 1.22);
      ctx.quadraticCurveTo(hx - R * 1.2, hy + R * 1.08, hx - R * 1.12, hy - R * 0.1);
      ctx.lineTo(hx - R * 0.82, hy - R * 0.2);
      ctx.quadraticCurveTo(hx - R * 0.6, hy + R * 0.6, hx + R * 0.2, hy + R * 0.62);
      ctx.quadraticCurveTo(hx + R * 0.75, hy + R * 0.55, hx + R * 1.04, hy + R * 0.05);
    } else if (look.hair === 'quiff') {
      // 健身房油头：前额高高翘起，两侧推短（果哥）
      ctx.moveTo(hx + R * 0.95, hy + R * 0.6);
      ctx.quadraticCurveTo(hx + R * 1.2, hy + R * 1.5, hx + R * 0.3, hy + R * 1.42);
      ctx.quadraticCurveTo(hx - R * 0.6, hy + R * 1.32, hx - R * 1.0, hy + R * 0.78);
      ctx.quadraticCurveTo(hx - R * 1.06, hy + R * 0.55, hx - R * 0.9, hy + R * 0.5);
      ctx.quadraticCurveTo(hx - R * 0.2, hy + R * 0.86, hx + R * 0.95, hy + R * 0.6);
    } else if (look.hair === 'gray') {
      // 花白短发，发际线后移
      ctx.moveTo(hx + R * 0.8, hy + R * 0.72);
      ctx.quadraticCurveTo(hx + R * 0.6, hy + R * 1.2, hx - R * 0.2, hy + R * 1.16);
      ctx.quadraticCurveTo(hx - R * 1.14, hy + R * 1.04, hx - R * 1.1, hy - R * 0.02);
      ctx.lineTo(hx - R * 0.86, hy - R * 0.1);
      ctx.quadraticCurveTo(hx - R * 0.78, hy + R * 0.62, hx - R * 0.3, hy + R * 0.86);
      ctx.quadraticCurveTo(hx + R * 0.3, hy + R * 1.0, hx + R * 0.8, hy + R * 0.72);
    } else {
      ctx.moveTo(hx + R * 1.0, hy + 0.0);
      ctx.quadraticCurveTo(hx + R * 1.0, hy + R * 1.2, hx - R * 0.1, hy + R * 1.18);
      ctx.quadraticCurveTo(hx - R * 1.15, hy + R * 1.05, hx - R * 1.1, hy + R * 0.05);
      ctx.quadraticCurveTo(hx - R * 1.0, hy - R * 0.55, hx - R * 0.7, hy - R * 0.62);
      ctx.quadraticCurveTo(hx - R * 0.55, hy - R * 0.1, hx - R * 0.15, hy + R * 0.3);
      ctx.quadraticCurveTo(hx + R * 0.35, hy + R * 0.25, hx + R * 0.55, hy + R * 0.55);
      ctx.quadraticCurveTo(hx + R * 0.75, hy + R * 0.15, hx + R * 1.0, hy + 0.0);
    }
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = lw; ctx.strokeStyle = look.outline; ctx.stroke();
    // 发丝高光
    ctx.strokeStyle = look.hairHi; ctx.lineWidth = 0.014; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx - R * 0.55, hy + R * 0.85); ctx.quadraticCurveTo(hx - R * 0.1, hy + R * 1.05, hx + R * 0.4, hy + R * 0.85);
    ctx.stroke();
    if (look.headband) {
      ctx.strokeStyle = look.band; ctx.lineWidth = 0.03;
      ctx.beginPath(); ctx.moveTo(hx - R * 1.02, hy + R * 0.42); ctx.quadraticCurveTo(hx, hy + R * 0.72, hx + R * 0.96, hy + R * 0.5); ctx.stroke();
    }
    // 头带
    if (look.hair === 'spiky') {
      ctx.strokeStyle = look.band; ctx.lineWidth = 0.034;
      ctx.beginPath(); ctx.moveTo(hx - R * 1.05, hy + R * 0.25); ctx.quadraticCurveTo(hx, hy + R * 0.55, hx + R * 0.98, hy + R * 0.32); ctx.stroke();
    } else if (look.hair === 'buzz') {
      ctx.strokeStyle = look.hairC; ctx.lineWidth = 0.016;
      ctx.beginPath(); ctx.moveTo(hx - R * 0.1, hy + R * 1.12); ctx.quadraticCurveTo(hx + R * 0.1, hy + R * 1.6, hx + R * 0.45, hy + R * 1.42); ctx.stroke();
    }
    // 眉眼
    const ex = hx + R * 0.58, ey = hy + R * 0.12;
    const mood = P.mood;
    const gx = clamp((o.gazeX || 1) * 0.012, -0.012, 0.014), gyy = clamp((o.gazeY || 0) * 0.01, -0.012, 0.014) + (mood === 'think' ? 0.01 : 0);
    const blink = o.blink ? 1 : 0;
    const arcEyes = mood === 'happy' || mood === 'shy' || mood === 'cheer' || mood === 'smile' || blink;
    if (arcEyes) {
      ctx.strokeStyle = look.eye; ctx.lineWidth = 0.014;
      ctx.beginPath();
      if (blink && !(mood === 'happy' || mood === 'shy' || mood === 'cheer' || mood === 'smile')) { ctx.moveTo(ex - 0.022, ey); ctx.lineTo(ex + 0.022, ey); }
      else ctx.arc(ex, ey - 0.008, 0.02, 0.2, Math.PI - 0.2);
      ctx.stroke();
    } else {
      const big = mood === 'surprise' ? 1.25 : 1;
      const eh = mood === 'sad' || mood === 'tired' ? 0.014 : mood === 'angry' ? 0.02 : 0.028 * big;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(ex, ey, 0.024 * big, eh, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = look.eye;
      ctx.beginPath(); ctx.ellipse(ex + gx, ey + gyy, 0.014 * (mood === 'surprise' ? 0.8 : 1), Math.min(0.019, eh * 0.9), 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(ex + gx + 0.005, ey + gyy + 0.007, 0.005, 0, Math.PI * 2); ctx.fill();
      if (look.blush) { // 长睫毛
        ctx.strokeStyle = look.eye; ctx.lineWidth = 0.008;
        ctx.beginPath(); ctx.moveTo(ex + 0.016, ey + eh * 0.8); ctx.lineTo(ex + 0.032, ey + eh * 0.8 + 0.012); ctx.stroke();
      }
    }
    ctx.strokeStyle = look.age ? shade(look.hairC, 0.7) : look.hairC; ctx.lineWidth = look.age ? 0.018 : 0.014; ctx.lineCap = 'round';
    ctx.beginPath();
    const browTilt = mood === 'sad' || mood === 'tired' || mood === 'shy' ? 0.018 : mood === 'angry' ? -0.026 : P.smash || mood === 'focus' || mood === 'fist' ? -0.016 : 0;
    const browUp = mood === 'surprise' ? 0.02 : 0;
    if (mood === 'think') { ctx.moveTo(ex - 0.03, ey + 0.05); ctx.quadraticCurveTo(ex, ey + 0.07, ex + 0.03, ey + 0.058); }
    else { ctx.moveTo(ex - 0.03, ey + 0.045 + browTilt + browUp); ctx.lineTo(ex + 0.03, ey + 0.045 - browTilt + browUp); }
    ctx.stroke();
    if (look.brow) {
      // 粗眉骨：外号“猿人”的来源
      ctx.strokeStyle = shade(look.skin2, 0.78); ctx.lineWidth = 0.024;
      ctx.beginPath(); ctx.moveTo(hx + R * 0.25, hy + R * 0.42); ctx.quadraticCurveTo(hx + R * 0.62, hy + R * 0.62, hx + R * 1.0, hy + R * 0.38); ctx.stroke();
    }
    if (look.muzzle) {
      ctx.fillStyle = shade(look.skin, 1.1);
      ctx.beginPath(); ctx.ellipse(hx + R * 0.74, hy - R * 0.42, R * 0.36, R * 0.3, -0.15, 0, Math.PI * 2); ctx.fill();
    }
    // 嘴
    const mx = hx + R * 0.72, my = hy - R * 0.5;
    const talk = o.talk ? Math.abs(Math.sin((o.time || 0) * 16)) : 0;
    ctx.strokeStyle = shade(look.skin2, 0.6); ctx.lineWidth = 0.011;
    if (P.smash || mood === 'happy' || mood === 'cheer' || mood === 'fist') {
      ctx.fillStyle = '#6b1f2a';
      ctx.beginPath(); ctx.ellipse(mx, my + 0.005, 0.02, mood === 'happy' || mood === 'cheer' ? 0.016 : 0.022, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff8a8a'; ctx.beginPath(); ctx.ellipse(mx, my - 0.006, 0.011, 0.006, 0, 0, Math.PI * 2); ctx.fill();
    } else if (mood === 'surprise') {
      ctx.fillStyle = '#6b1f2a';
      ctx.beginPath(); ctx.ellipse(mx, my, 0.012, 0.018, 0, 0, Math.PI * 2); ctx.fill();
    } else if (mood === 'sad' || mood === 'tired') {
      ctx.beginPath(); ctx.arc(mx, my - 0.02, 0.022, 0.4 * Math.PI, 0.6 * Math.PI + 0.2); ctx.stroke();
    } else if (mood === 'angry') {
      ctx.fillStyle = '#6b1f2a';
      ctx.beginPath(); ctx.moveTo(mx - 0.02, my - 0.004); ctx.lineTo(mx + 0.018, my + 0.006); ctx.lineTo(mx + 0.012, my - 0.012); ctx.closePath(); ctx.fill();
    } else if (talk > 0.15) {
      ctx.fillStyle = '#6b1f2a';
      ctx.beginPath(); ctx.ellipse(mx, my, 0.016, 0.004 + talk * 0.012, 0, 0, Math.PI * 2); ctx.fill();
    } else if (mood === 'smile' || mood === 'shy' || mood === 'wave' || mood === 'point' || mood === 'talk' || mood === 'rest') {
      ctx.beginPath(); ctx.arc(mx - 0.002, my + 0.014, 0.02, 1.25 * Math.PI, 1.85 * Math.PI, false); ctx.stroke();
    } else if (mood === 'think') {
      ctx.beginPath(); ctx.moveTo(mx - 0.016, my - 0.004); ctx.lineTo(mx + 0.012, my + 0.004); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(mx - 0.018, my); ctx.lineTo(mx + 0.012, my + 0.002); ctx.stroke();
    }
    // 腮红（害羞时更红）
    const blushA = (look.chubby ? 0.34 : 0.22) + (look.blush || 0) * 0.3 + (mood === 'shy' ? 0.35 : mood === 'cheer' || mood === 'happy' ? 0.08 : 0);
    ctx.fillStyle = `rgba(255,110,120,${Math.min(0.75, blushA)})`;
    const bw = (look.chubby ? 0.03 : 0.022) * (mood === 'shy' ? 1.3 : 1);
    ctx.beginPath(); ctx.ellipse(hx + R * 0.45, hy - R * 0.25, bw, look.chubby ? 0.018 : 0.012, 0, 0, Math.PI * 2); ctx.fill();
    if (mood === 'shy') {
      ctx.strokeStyle = 'rgba(230,70,90,0.6)'; ctx.lineWidth = 0.006;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) { ctx.moveTo(hx + R * 0.32 + i * 0.016, hy - R * 0.16); ctx.lineTo(hx + R * 0.28 + i * 0.016, hy - R * 0.34); }
      ctx.stroke();
    }
    if (look.age) {
      // 眼角纹与法令纹
      ctx.strokeStyle = shade(look.skin2, 0.78); ctx.lineWidth = 0.006;
      ctx.beginPath();
      ctx.moveTo(ex - 0.034, ey + 0.004); ctx.lineTo(ex - 0.05, ey + 0.014);
      ctx.moveTo(ex - 0.034, ey - 0.006); ctx.lineTo(ex - 0.05, ey - 0.014);
      ctx.moveTo(hx + R * 0.62, hy - R * 0.2); ctx.quadraticCurveTo(hx + R * 0.52, hy - R * 0.4, hx + R * 0.58, hy - R * 0.58);
      ctx.stroke();
    }
    if (mood === 'tired' || mood === 'surprise') {
      // 汗珠
      const dy = ((o.time || 0) * 0.08) % 0.05;
      ctx.fillStyle = 'rgba(140,210,255,0.9)';
      ctx.beginPath(); ctx.moveTo(hx - R * 0.15, hy + R * 0.95 - dy); ctx.quadraticCurveTo(hx - R * 0.32, hy + R * 0.62 - dy, hx - R * 0.15, hy + R * 0.58 - dy);
      ctx.quadraticCurveTo(hx + R * 0.02, hy + R * 0.62 - dy, hx - R * 0.15, hy + R * 0.95 - dy); ctx.fill();
    }
    if (look.glasses) {
      ctx.strokeStyle = look.age ? '#6b5236' : '#1b1b24'; ctx.lineWidth = 0.011;
      ctx.beginPath();
      if (look.glasses === 'rect') YY.rr(ctx, ex - 0.03, ey - 0.026, 0.066, 0.05, 0.012);
      else ctx.arc(ex + 0.004, ey, 0.036, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ex - 0.032, ey + 0.006); ctx.lineTo(hx - 0.01, hy + 0.01); ctx.stroke();
      ctx.fillStyle = 'rgba(190,230,255,0.18)';
      ctx.beginPath();
      if (look.glasses === 'rect') YY.rr(ctx, ex - 0.028, ey - 0.024, 0.062, 0.046, 0.01); else ctx.arc(ex + 0.004, ey, 0.032, 0, Math.PI * 2);
      ctx.fill();
      // 镜片反光
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.006;
      ctx.beginPath(); ctx.moveTo(ex + 0.012, ey + 0.016); ctx.lineTo(ex + 0.024, ey + 0.004); ctx.stroke();
    }
  }

  function torso(ctx, P, look, lw, flat, f) {
    if (look.marketTier >= 3 && !flat && YY.MarketArt) { YY.MarketArt.torso(ctx,P,look);return; }
    const { H, ux, uy } = P;
    const rx = uy, ry = -ux; // 指向前方的法向量
    const tw = look.slim ? 0.78 : look.buff ? 1.2 : 1;
    const pt = (u, r) => {
      const yaw = lerp(P.hipYaw || 0, P.chestYaw || 0, clamp(u / .5, 0, 1));
      const width = (1 - .34 * Math.abs(Math.sin(yaw))) * tw;
      const turn = Math.sin(yaw) * .035 * clamp(u / .5, 0, 1);
      return [H[0] + ux * u + rx * (r * width + turn), H[1] + uy * u + ry * (r * width + turn)];
    };
    const wl = pt(-0.03, -0.115), wr = pt(-0.03, 0.12);
    const cl = pt(0.3, -0.215), cr = pt(0.3, 0.215);
    const sl = pt(0.5, -0.135), sr = pt(0.5, 0.14);
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
    // 侧面拼色
    ctx.save();
    ctx.clip();
    ctx.fillStyle = look.panel;
    ctx.beginPath();
    const a = pt(-0.05, -0.2), b = pt(0.55, -0.2), c2 = pt(0.48, -0.08), d = pt(-0.05, -0.1);
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c2[0], c2[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
    ctx.fill();
    if (look.plaid) {
      // 格子衫
      const ga = ctx.globalAlpha;
      ctx.strokeStyle = look.plaid; ctx.lineWidth = 0.016; ctx.globalAlpha = ga * 0.55;
      ctx.beginPath();
      for (let i = -3; i <= 3; i++) { const a = pt(-0.1, i * 0.07), b = pt(0.65, i * 0.07); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      for (let j = 0; j < 7; j++) { const a = pt(j * 0.09, -0.25), b = pt(j * 0.09, 0.25); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      ctx.stroke(); ctx.globalAlpha = ga;
    }
    // 腰部饰条
    ctx.fillStyle = look.trim;
    const t1 = pt(0.07, -0.2), t2 = pt(0.07, 0.2), t3 = pt(0.1, 0.2), t4 = pt(0.1, -0.2);
    ctx.beginPath(); ctx.moveTo(t1[0], t1[1]); ctx.lineTo(t2[0], t2[1]); ctx.lineTo(t3[0], t3[1]); ctx.lineTo(t4[0], t4[1]); ctx.closePath(); ctx.fill();
    ctx.restore();
    if (look.belly) {
      // 圆滚滚的肚子：向前鼓出的一团
      const bc = pt(0.2, 0.15 / tw), ang = Math.atan2(uy, ux);
      const bg = ctx.createRadialGradient(bc[0] + rx * 0.04, bc[1] + ry * 0.04, 0.02, bc[0], bc[1], 0.2);
      bg.addColorStop(0, shade(look.shirt, 1.18)); bg.addColorStop(1, look.shirt);
      ctx.beginPath(); ctx.ellipse(bc[0], bc[1], 0.2, 0.15 * look.belly, ang, 0, Math.PI * 2);
      ctx.fillStyle = bg; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = look.outline; ctx.stroke();
      ctx.strokeStyle = look.trim; ctx.lineWidth = 0.02;
      const b1 = pt(0.07, 0.04 / tw), b2 = pt(0.07, (0.15 + 0.15 * look.belly) / tw);
      ctx.beginPath(); ctx.moveTo(b1[0], b1[1]); ctx.lineTo(b2[0], b2[1]); ctx.stroke();
    }
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
    // 号码
    const c = pt(0.3, 0.05);
    ctx.save();
    ctx.translate(c[0], c[1]);
    ctx.scale(f || 1, -1);
    ctx.rotate(P.lean * (f || 1));
    ctx.font = `italic 900 ${look.num.length > 2 ? 0.12 : 0.17}px "DIN Alternate","Bahnschrift","Arial Black",sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(look.num, 0, 0);
    ctx.restore();
  }

  /**
   * 绘制角色。o: { time, mood, gazeX, gazeY, spring:[dx,dy], flat:颜色（残影）, glow:拍面高光 }
   * 返回姿态（供拍面轨迹使用）。
   */
  YY.drawCharacter = function (ctx, p, look, o) {
    const P = o.pose || pose(p, o.time || 0, o);
    const lw = 0.018;
    const flat = o.flat || null;
    const bw = look.slim ? 0.72 : look.buff ? 1.22 : 1, hs = look.headScale || 1;
    const dark = (c) => (flat ? flat : shade(c, 0.78));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 后腿
    if (!flat && look.marketTier >= 3) YY.MarketArt?.back(ctx,P,look,p,o);
    limb(ctx, P.H2, P.K2, 0.075 * bw, 0.062 * bw, dark(look.skin), null, lw, flat ? null : look.outline);
    limb(ctx, P.K2, P.F2, 0.06 * bw, 0.045 * bw, dark(look.skin), null, lw, flat ? null : look.outline);
    if (!flat) limb(ctx, [lerp(P.K2[0], P.F2[0], 0.72), lerp(P.K2[1], P.F2[1], 0.72)], P.F2, 0.05, 0.047, shade(look.sock, 0.85), null, lw, look.outline);
    if(!flat && look.marketTier>=3) YY.MarketArt?.limb(ctx,P.K2,P.F2,look,'shin');
    shoe(ctx, P.F2, P.K2, look, lw, flat ? flat : null, o.shoePulse || 0, o.time, !p.onGround);
    // 后手（在身体后）
    limb(ctx, P.S2, P.E2, 0.05 * bw, 0.043 * bw, dark(look.skin), null, lw, flat ? null : look.outline);
    limb(ctx, P.E2, P.W2, 0.043 * bw, 0.036 * bw, dark(look.skin), null, lw, flat ? null : look.outline);
    if (!flat) {
      if (!look.tank) limb(ctx, P.S2, [lerp(P.S2[0], P.E2[0], 0.38), lerp(P.S2[1], P.E2[1], 0.38)], 0.066 * bw, 0.056 * bw, look.shirt2, null, lw, look.outline);
      if(look.marketTier>=3){YY.MarketArt?.limb(ctx,P.S2,P.E2,look,'shoulder');YY.MarketArt?.limb(ctx,P.E2,P.W2,look,'arm');}
      ctx.fillStyle = dark(look.skin);
      ctx.beginPath(); ctx.arc(P.W2[0], P.W2[1], 0.042, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = lw; ctx.strokeStyle = look.outline; ctx.stroke();
    }
    // 发尾（在头后）
    const scaleHead = (fn) => { if (hs === 1) return fn(); ctx.save(); ctx.translate(P.hd[0], P.hd[1] - 0.06); ctx.scale(hs, hs); ctx.translate(-P.hd[0], -(P.hd[1] - 0.06)); fn(); ctx.restore(); };
    if (!flat) scaleHead(() => hairBack(ctx, P, look, o, lw));
    // 短裤
    const thigh = (K) => [lerp(P.H[0], K[0], 0.48), lerp(P.H[1], K[1], 0.48)];
    limb(ctx, P.H, thigh(P.K2), 0.11, 0.092, flat || shade(look.shorts, 0.85), null, lw, flat ? null : look.outline);
    // 躯干
    torso(ctx, P, look, lw, flat, o.f);
    // 前腿
    limb(ctx, P.H1, P.K1, 0.078 * bw, 0.064 * bw, flat || look.skin, flat ? null : 'rgba(255,255,255,0.22)', lw, flat ? null : look.outline);
    limb(ctx, P.K1, P.F1, 0.062 * bw, 0.046 * bw, flat || look.skin, flat ? null : 'rgba(255,255,255,0.2)', lw, flat ? null : look.outline);
    if (!flat) limb(ctx, [lerp(P.K1[0], P.F1[0], 0.72), lerp(P.K1[1], P.F1[1], 0.72)], P.F1, 0.051, 0.048, look.sock, null, lw, look.outline);
    if(!flat && look.marketTier>=3) YY.MarketArt?.limb(ctx,P.K1,P.F1,look,'shin');
    shoe(ctx, P.F1, P.K1, look, lw, flat ? flat : null, o.shoePulse || 0, o.time, !p.onGround);
    limb(ctx, [P.H[0] + 0.02, P.H[1] + 0.02], thigh(P.K1), 0.115, 0.095, flat || look.shorts, null, lw, flat ? null : look.outline);
    if (!flat) {
      // 短裤侧条
      const tk = thigh(P.K1);
      ctx.strokeStyle = look.stripe; ctx.lineWidth = 0.022;
      ctx.beginPath(); ctx.moveTo(P.H[0] - 0.02, P.H[1] + 0.05); ctx.lineTo(tk[0] - 0.05, tk[1]); ctx.stroke();
      if (look.prison) YY.MarketArt?.prisonLegs(ctx, P, look, o.time || 0);
    }
    // 头
    if (flat) {
      ctx.fillStyle = flat;
      ctx.beginPath(); ctx.arc(P.hd[0], P.hd[1], 0.14, 0, Math.PI * 2); ctx.fill();
    } else scaleHead(() => head(ctx, P, look, o, lw));
    if(!flat && look.marketTier>=3)scaleHead(()=>YY.MarketArt?.visor(ctx,P,look));
    // 持拍手（最前）
    limb(ctx, P.S, P.E, 0.056 * bw, 0.047 * bw, flat || look.skin, flat ? null : 'rgba(255,255,255,0.22)', lw, flat ? null : look.outline);
    limb(ctx, P.E, P.W, 0.047 * bw, 0.04 * bw, flat || look.skin, flat ? null : 'rgba(255,255,255,0.2)', lw, flat ? null : look.outline);
    if (!flat) {
      // 护腕
      const wb = [lerp(P.E[0], P.W[0], 0.78), lerp(P.E[1], P.W[1], 0.78)];
      limb(ctx, wb, [lerp(P.E[0], P.W[0], 0.92), lerp(P.E[1], P.W[1], 0.92)], 0.047, 0.045, look.wrist, null, lw, look.outline);
      // 袖口
      if (!look.tank) limb(ctx, P.S, [lerp(P.S[0], P.E[0], 0.35), lerp(P.S[1], P.E[1], 0.35)], 0.07 * bw, 0.06 * bw, look.shirt, null, lw, look.outline);
      if(look.marketTier>=3){YY.MarketArt?.limb(ctx,P.S,P.E,look,'shoulder');YY.MarketArt?.limb(ctx,P.E,P.W,look,'arm');}
    }
    if (!o.hideRacket) {
      if(!flat && look.marketTier>=3 && YY.MarketArt) YY.MarketArt.racket(ctx,P,look,o);
      else racket(ctx, P, look, lw, flat, o.glow || 0, o.racketPulse || 0);
    }
    // 手
    ctx.fillStyle = flat || look.skin;
    ctx.beginPath(); ctx.arc(P.W[0], P.W[1], 0.045, 0, Math.PI * 2); ctx.fill();
    if (!flat) { ctx.lineWidth = lw; ctx.strokeStyle = look.outline; ctx.stroke(); }
    if (!flat && look.prison) YY.MarketArt?.prisonCuffs(ctx, P, look, o.time || 0);
    return P;
  };

  /** 拍头中心（局部坐标） */
  YY.racketHead = (P) => [P.W[0] + Math.cos(P.Rk) * RK_OFF * (P.rs || 1), P.W[1] + Math.sin(P.Rk) * RK_OFF * (P.rs || 1)];

  /** 头像（用于记分牌与界面） */
  YY.portrait = function (look, size) {
    const c = YY.platform.createCanvas();
    c.width = c.height = size;
    const g = c.getContext('2d');
    const bg = g.createRadialGradient(size * 0.5, size * 0.4, size * 0.1, size * 0.5, size * 0.5, size * 0.7);
    bg.addColorStop(0, shade(look.shirt, 1.3)); bg.addColorStop(1, look.shirt2);
    g.fillStyle = bg;
    g.fillRect(0, 0, size, size);
    const fake = { idx: 0, dir: 1, vx: 0, vy: 0, onGround: true, swing: null, runPhase: 0, land: 0, x: 0, y: 0 };
    g.save();
    g.translate(size * 0.39, size * 2.35);
    const k = size * 1.15;
    g.scale(k, -k);
    YY.drawCharacter(g, fake, look, { time: 0.4, mood: 'focus', gazeX: 1 });
    g.restore();
    return c;
  };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof window !== 'undefined' ? window : globalThis);
