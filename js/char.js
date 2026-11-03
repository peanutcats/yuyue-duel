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

  // 挥拍关键帧：[时间, 手臂总方向角(度)]
  const SWING_KEYS = {
    over: [[0, 150], [0.05, 172], [C.SW_SWEET, 72], [0.2, -35], [0.3, 40]],
    side: [[0, 160], [0.05, 178], [C.SW_SWEET, 12], [0.2, -55], [0.3, 45]],
    under: [[0, -130], [0.05, -158], [C.SW_SWEET, -30], [0.2, 75], [0.3, 55]],
    smash: [[0, 155], [0.07, 182], [C.SW_SWEET, 82], [0.18, -62], [0.4, -45], [0.56, 45]],
  };
  function keyAngle(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const [t0, a0] = keys[i - 1], [t1, a1] = keys[i];
        const u = (t - t0) / (t1 - t0);
        return lerp(a0, a1, u * u * (3 - 2 * u));
      }
    }
    return keys[keys.length - 1][1];
  }
  YY.swingAngle = function (p, time) {
    const sw = p.swing;
    if (!sw) return null;
    const keys = sw.dur > 0.4 ? SWING_KEYS.smash : SWING_KEYS[sw.kind] || SWING_KEYS.over;
    return keyAngle(keys, Math.min(sw.t, sw.dur));
  };

  // 两段 IK：给定根、目标与两段长度，返回中间关节（bend=+1 时关节朝 +x 弯）
  function ik(ax, ay, bx, by, l1, l2, bend) {
    let dx = bx - ax, dy = by - ay;
    let d = Math.hypot(dx, dy);
    const maxd = l1 + l2 - 1e-4;
    if (d > maxd) { dx *= maxd / d; dy *= maxd / d; d = maxd; }
    const a = Math.atan2(dy, dx);
    const c = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
    const off = Math.acos(c) * bend;
    return [ax + Math.cos(a + off) * l1, ay + Math.sin(a + off) * l1];
  }

  /** 计算姿态 */
  function pose(p, t, o) {
    const sw = p.swing;
    const run = clamp(Math.abs(p.vx) / 4.5, 0, 1);
    const fwd = Math.sign(p.vx * p.dir) || 0;
    const air = !p.onGround;
    const ph = p.runPhase * 1.15;
    const smash = sw && sw.dur > 0.4;
    const mood = o.mood || 'play';
    let crouch = 0.07 + (p.land > 0 ? 0.13 : 0);
    const lowSwing = sw && sw.kind === 'under' && sw.t < 0.28;
    const lunge = lowSwing ? 0.2 * Math.sin(Math.min(1, sw.t / 0.12) * Math.PI * 0.5) : 0;
    crouch += lunge * 0.5;
    if (mood === 'sad') crouch += 0.04;
    const breathe = Math.sin(t * 3.2 + p.idx) * 0.008 * (1 - run);
    let hipY = 0.93 - crouch + breathe;

    let F1, F2;
    if (air) {
      const up = clamp(p.vy / C.JUMP_V, -1, 1);
      F1 = [0.16, hipY - 0.58 + up * 0.08];
      F2 = [-0.26, hipY - 0.66 - up * 0.06];
    } else if (run > 0.08) {
      const st = 0.34 * run;
      hipY -= Math.abs(Math.sin(ph)) * 0.035 * run;
      F1 = [0.07 + st * Math.sin(ph), Math.max(0, Math.cos(ph)) * 0.17 * run];
      F2 = [-0.07 + st * Math.sin(ph + Math.PI), Math.max(0, Math.cos(ph + Math.PI)) * 0.17 * run];
    } else {
      F1 = [0.23 + lunge * 1.3, 0];
      F2 = [-0.21 - lunge * 0.4, 0];
    }
    const H = [0, hipY];
    const K1 = ik(H[0], H[1], F1[0], F1[1], 0.47, 0.47, 1);
    const K2 = ik(H[0], H[1], F2[0], F2[1], 0.47, 0.47, 1);

    // 躯干前倾
    let lean = 0.1 + run * 0.14 * fwd + lunge * 0.9;
    if (smash) lean += sw.t < 0.08 ? -0.28 : sw.t < 0.3 ? 0.32 : 0.12;
    else if (sw && sw.kind === 'over' && sw.t < 0.08) lean -= 0.12;
    if (air && !sw) lean -= 0.08;
    if (mood === 'sad') lean += 0.28;
    if (mood === 'happy') lean -= 0.06;
    const ux = Math.sin(lean), uy = Math.cos(lean);
    const N = [H[0] + ux * 0.56, H[1] + uy * 0.56];
    const S = [H[0] + ux * 0.5 - uy * 0.0, H[1] + uy * 0.5];
    const headTilt = mood === 'sad' ? 0.45 : mood === 'happy' ? -0.15 : clamp((o.gazeY || 0) * 0.12, -0.2, 0.35) * -1;
    const hd = [N[0] + Math.sin(lean + headTilt * 0.5) * 0.16, N[1] + Math.cos(lean + headTilt * 0.5) * 0.16];

    // 持拍手
    let A = YY.swingAngle(p, t);
    let bend;
    if (A == null) {
      if (mood === 'happy') { A = 118 + Math.sin(t * 9) * 12; bend = 0.25; }
      else if (mood === 'sad') { A = -70; bend = 0.15; }
      else if (air) { A = 125; bend = 0.9; }
      else { A = 52 + Math.sin(t * 3 + p.idx) * 4 - run * 18; bend = 1.05; }
    } else {
      const s = sw.t;
      bend = s < C.SW_SWEET ? lerp(1.15, 0.05, s / C.SW_SWEET) : Math.min(0.55, (s - C.SW_SWEET) * 2.4);
    }
    let Ar = A * D2R, rs = 1;
    // 击球接触与发球：解算手臂，使拍面中心精确落在物理接触点上，再平滑收拍
    let T = null, w = 0;
    if (sw && sw.contact && sw.t >= sw.contact.t) {
      T = [(sw.contact.x - p.x) * p.dir, sw.contact.y - p.y];
      let u = clamp((sw.t - sw.contact.t - 0.035) / 0.12, 0, 1);
      w = 1 - u * u * (3 - 2 * u);
    } else if (sw && sw.serve) {
      T = [0.42, 0.9 - p.y];
      w = clamp((sw.t - 0.04) / 0.06, 0, 1);
    }
    if (T && w > 0) {
      const r = Math.hypot(T[0] - S[0], T[1] - S[1]);
      let lo = 0, hi = 1.3;
      for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (Math.hypot(...armVec(mid)) > r) lo = mid; else hi = mid; }
      const bc = (lo + hi) / 2, v = armVec(bc);
      const sc = r / Math.hypot(v[0], v[1]);
      const Ac = Math.atan2(T[1] - S[1], T[0] - S[0]) - Math.atan2(v[1], v[0]);
      let d = Ac - Ar;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      Ar = w >= 1 ? Ar + d : Ar + d * w;
      bend += (bc - bend) * w;
      rs = 1 + (sc - 1) * w;
    }
    const U = Ar - bend * 0.75, Fa = Ar + bend * 0.55, Rk = Ar + bend * 0.62;
    const E = [S[0] + Math.cos(U) * 0.29 * rs, S[1] + Math.sin(U) * 0.29 * rs];
    const W = [E[0] + Math.cos(Fa) * 0.27 * rs, E[1] + Math.sin(Fa) * 0.27 * rs];

    // 非持拍手
    let O, ob = 0.6;
    if (sw && (sw.kind === 'over' || smash) && sw.t < 0.13) { O = 105; ob = 0.2; }
    else if (sw) O = -55;
    else if (mood === 'happy') { O = 60 + Math.sin(t * 9 + 1) * 15; ob = 1.4; }
    else if (mood === 'sad') O = -80;
    else if (air) O = 80;
    else O = 22 + Math.sin(ph + Math.PI) * 40 * run;
    const S2 = [S[0] - uy * 0.04 - ux * 0.02, S[1] - 0.02];
    const Or = O * D2R;
    const E2 = [S2[0] + Math.cos(Or - ob * 0.6) * 0.27, S2[1] + Math.sin(Or - ob * 0.6) * 0.27];
    const W2 = [E2[0] + Math.cos(Or + ob * 0.5) * 0.25, E2[1] + Math.sin(Or + ob * 0.5) * 0.25];

    return { H, K1, K2, F1, F2, N, S, S2, E, W, E2, W2, hd, lean, Rk, rs, A: Ar, ux, uy, air, run, smash, mood, ph };
  }
  // 手臂链（上臂 + 前臂 + 拍头偏移）在弯曲度 b 下、方向角为 0 时的向量
  function armVec(b) {
    return [
      0.29 * Math.cos(-0.75 * b) + 0.27 * Math.cos(0.55 * b) + RK_OFF * Math.cos(0.62 * b),
      0.29 * Math.sin(-0.75 * b) + 0.27 * Math.sin(0.55 * b) + RK_OFF * Math.sin(0.62 * b),
    ];
  }
  YY.charPose = pose;

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

  function shoe(ctx, F, K, look, lw, flat) {
    const ang = Math.atan2(F[1] - K[1], F[0] - K[0]);
    const toe = clamp(ang + Math.PI / 2, -0.5, 0.6); // 脚尖随小腿角度略微翘起
    ctx.save();
    ctx.translate(F[0], F[1] + 0.035);
    ctx.rotate(toe * 0.5);
    ctx.beginPath();
    ctx.moveTo(-0.07, -0.035);
    ctx.lineTo(0.13, -0.035);
    ctx.quadraticCurveTo(0.17, -0.03, 0.16, 0.0);
    ctx.quadraticCurveTo(0.12, 0.055, 0.02, 0.06);
    ctx.lineTo(-0.06, 0.055);
    ctx.quadraticCurveTo(-0.09, 0.02, -0.07, -0.035);
    ctx.closePath();
    ctx.fillStyle = flat || look.shoe;
    ctx.fill();
    ctx.lineWidth = lw; ctx.strokeStyle = look.outline; ctx.stroke();
    if (!flat) {
      ctx.fillStyle = look.sole;
      ctx.fillRect(-0.07, -0.04, 0.22, 0.022);
      ctx.strokeStyle = look.sole;
      ctx.lineWidth = 0.014;
      ctx.beginPath(); ctx.moveTo(-0.02, 0.0); ctx.quadraticCurveTo(0.05, 0.03, 0.1, 0.005); ctx.stroke();
    }
    ctx.restore();
  }

  function racket(ctx, P, look, lw, flat, glow) {
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
    ctx.strokeStyle = flat || '#c9ced8'; ctx.lineWidth = 0.013;
    ctx.beginPath(); ctx.moveTo(g1[0], g1[1]); ctx.lineTo(s1[0], s1[1]); ctx.stroke();
    // 拍框
    ctx.save();
    ctx.translate(hc[0], hc[1]);
    ctx.rotate(P.Rk);
    if (glow > 0 && !flat) {
      ctx.fillStyle = `rgba(255,250,210,${glow})`;
      ctx.beginPath(); ctx.ellipse(0, 0, 0.24, 0.2, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = flat || look.racket;
    ctx.beginPath(); ctx.ellipse(0, 0, 0.125, 0.098, 0, 0, Math.PI * 2);
    if (!flat) {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 0.004;
      ctx.beginPath();
      for (let i = -5; i <= 5; i++) { ctx.moveTo(i * 0.022, -0.1); ctx.lineTo(i * 0.022, 0.1); }
      for (let j = -4; j <= 4; j++) { ctx.moveTo(-0.13, j * 0.022); ctx.lineTo(0.13, j * 0.022); }
      ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath(); ctx.ellipse(0, 0, 0.125, 0.098, 0, 0, Math.PI * 2);
    ctx.lineWidth = 0.026;
    ctx.strokeStyle = flat || look.outline;
    ctx.stroke();
    ctx.lineWidth = 0.016;
    if (!flat) {
      const gr = ctx.createLinearGradient(-0.12, 0, 0.12, 0);
      gr.addColorStop(0, look.racket); gr.addColorStop(0.55, look.racket2); gr.addColorStop(1, look.racket);
      ctx.strokeStyle = gr;
    }
    ctx.stroke();
    ctx.restore();
  }

  function hairBack(ctx, P, look, o, lw) {
    const hd = P.hd;
    const sp = o.spring || [0, 0];
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
    ctx.beginPath(); ctx.ellipse(hx - 0.02, hy - 0.005, 0.024, 0.034, 0, 0, Math.PI * 2); ctx.fill();
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
    // 头带
    if (look.hair === 'spiky') {
      ctx.strokeStyle = look.band; ctx.lineWidth = 0.034;
      ctx.beginPath(); ctx.moveTo(hx - R * 1.05, hy + R * 0.25); ctx.quadraticCurveTo(hx, hy + R * 0.55, hx + R * 0.98, hy + R * 0.32); ctx.stroke();
    }
    // 眉眼
    const ex = hx + R * 0.58, ey = hy + R * 0.12;
    const mood = P.mood;
    const gx = clamp((o.gazeX || 1) * 0.012, -0.012, 0.014), gyy = clamp((o.gazeY || 0) * 0.01, -0.012, 0.014);
    if (mood === 'happy') {
      ctx.strokeStyle = look.eye; ctx.lineWidth = 0.014;
      ctx.beginPath(); ctx.arc(ex, ey - 0.008, 0.02, 0.2, Math.PI - 0.2); ctx.stroke();
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(ex, ey, 0.024, mood === 'sad' ? 0.014 : 0.028, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = look.eye;
      ctx.beginPath(); ctx.ellipse(ex + gx, ey + gyy, 0.014, 0.019, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(ex + gx + 0.005, ey + gyy + 0.007, 0.005, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = look.hairC; ctx.lineWidth = 0.014; ctx.lineCap = 'round';
    ctx.beginPath();
    const browTilt = mood === 'sad' ? 0.018 : P.smash || mood === 'focus' ? -0.016 : 0;
    ctx.moveTo(ex - 0.03, ey + 0.045 + browTilt); ctx.lineTo(ex + 0.03, ey + 0.045 - browTilt);
    ctx.stroke();
    // 嘴
    const mx = hx + R * 0.72, my = hy - R * 0.5;
    ctx.strokeStyle = shade(look.skin2, 0.6); ctx.lineWidth = 0.011;
    if (P.smash || mood === 'happy') {
      ctx.fillStyle = '#6b1f2a';
      ctx.beginPath(); ctx.ellipse(mx, my + 0.005, 0.02, mood === 'happy' ? 0.016 : 0.022, 0, 0, Math.PI * 2); ctx.fill();
    } else if (mood === 'sad') {
      ctx.beginPath(); ctx.arc(mx, my - 0.02, 0.022, 0.4 * Math.PI, 0.6 * Math.PI + 0.2); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(mx - 0.018, my); ctx.lineTo(mx + 0.012, my + 0.002); ctx.stroke();
    }
    // 腮红
    ctx.fillStyle = 'rgba(255,110,110,0.22)';
    ctx.beginPath(); ctx.ellipse(hx + R * 0.45, hy - R * 0.25, 0.022, 0.012, 0, 0, Math.PI * 2); ctx.fill();
  }

  function torso(ctx, P, look, lw, flat, f) {
    const { H, ux, uy } = P;
    const rx = uy, ry = -ux; // 指向前方的法向量
    const pt = (u, r) => [H[0] + ux * u + rx * r, H[1] + uy * u + ry * r];
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
    // 侧面拼色
    ctx.save();
    ctx.clip();
    ctx.fillStyle = look.panel;
    ctx.beginPath();
    const a = pt(-0.05, -0.2), b = pt(0.55, -0.2), c2 = pt(0.48, -0.08), d = pt(-0.05, -0.1);
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c2[0], c2[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
    ctx.fill();
    // 腰部饰条
    ctx.fillStyle = look.trim;
    const t1 = pt(0.07, -0.2), t2 = pt(0.07, 0.2), t3 = pt(0.1, 0.2), t4 = pt(0.1, -0.2);
    ctx.beginPath(); ctx.moveTo(t1[0], t1[1]); ctx.lineTo(t2[0], t2[1]); ctx.lineTo(t3[0], t3[1]); ctx.lineTo(t4[0], t4[1]); ctx.closePath(); ctx.fill();
    ctx.restore();
    // V 领
    const v0 = pt(0.55, -0.05), v1 = pt(0.47, 0.06), v2 = pt(0.56, 0.11);
    ctx.strokeStyle = look.trim; ctx.lineWidth = 0.018; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(v0[0], v0[1]); ctx.lineTo(v1[0], v1[1]); ctx.lineTo(v2[0], v2[1]); ctx.stroke();
    // 号码
    const c = pt(0.3, 0.05);
    ctx.save();
    ctx.translate(c[0], c[1]);
    ctx.scale(f || 1, -1);
    ctx.rotate(P.lean * (f || 1));
    ctx.font = 'italic 900 0.17px "DIN Alternate","Bahnschrift","Arial Black",sans-serif';
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
    const P = pose(p, o.time || 0, o);
    const lw = 0.018;
    const flat = o.flat || null;
    const dark = (c) => (flat ? flat : shade(c, 0.78));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 后腿
    limb(ctx, P.H, P.K2, 0.075, 0.062, dark(look.skin), null, lw, flat ? null : look.outline);
    limb(ctx, P.K2, P.F2, 0.06, 0.045, dark(look.skin), null, lw, flat ? null : look.outline);
    if (!flat) limb(ctx, [lerp(P.K2[0], P.F2[0], 0.72), lerp(P.K2[1], P.F2[1], 0.72)], P.F2, 0.05, 0.047, shade(look.sock, 0.85), null, lw, look.outline);
    shoe(ctx, P.F2, P.K2, look, lw, flat ? flat : null);
    // 后手（在身体后）
    limb(ctx, P.S2, P.E2, 0.05, 0.043, dark(look.skin), null, lw, flat ? null : look.outline);
    limb(ctx, P.E2, P.W2, 0.043, 0.036, dark(look.skin), null, lw, flat ? null : look.outline);
    if (!flat) {
      limb(ctx, P.S2, [lerp(P.S2[0], P.E2[0], 0.38), lerp(P.S2[1], P.E2[1], 0.38)], 0.066, 0.056, look.shirt2, null, lw, look.outline);
      ctx.fillStyle = dark(look.skin);
      ctx.beginPath(); ctx.arc(P.W2[0], P.W2[1], 0.042, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = lw; ctx.strokeStyle = look.outline; ctx.stroke();
    }
    // 发尾（在头后）
    if (!flat) hairBack(ctx, P, look, o, lw);
    // 短裤
    const thigh = (K) => [lerp(P.H[0], K[0], 0.48), lerp(P.H[1], K[1], 0.48)];
    limb(ctx, P.H, thigh(P.K2), 0.11, 0.092, flat || shade(look.shorts, 0.85), null, lw, flat ? null : look.outline);
    // 躯干
    torso(ctx, P, look, lw, flat, o.f);
    // 前腿
    limb(ctx, P.H, P.K1, 0.078, 0.064, flat || look.skin, flat ? null : 'rgba(255,255,255,0.22)', lw, flat ? null : look.outline);
    limb(ctx, P.K1, P.F1, 0.062, 0.046, flat || look.skin, flat ? null : 'rgba(255,255,255,0.2)', lw, flat ? null : look.outline);
    if (!flat) limb(ctx, [lerp(P.K1[0], P.F1[0], 0.72), lerp(P.K1[1], P.F1[1], 0.72)], P.F1, 0.051, 0.048, look.sock, null, lw, look.outline);
    shoe(ctx, P.F1, P.K1, look, lw, flat ? flat : null);
    limb(ctx, [P.H[0] + 0.02, P.H[1] + 0.02], thigh(P.K1), 0.115, 0.095, flat || look.shorts, null, lw, flat ? null : look.outline);
    if (!flat) {
      // 短裤侧条
      const tk = thigh(P.K1);
      ctx.strokeStyle = look.stripe; ctx.lineWidth = 0.022;
      ctx.beginPath(); ctx.moveTo(P.H[0] - 0.02, P.H[1] + 0.05); ctx.lineTo(tk[0] - 0.05, tk[1]); ctx.stroke();
    }
    // 头
    if (flat) {
      ctx.fillStyle = flat;
      ctx.beginPath(); ctx.arc(P.hd[0], P.hd[1], 0.14, 0, Math.PI * 2); ctx.fill();
    } else head(ctx, P, look, o, lw);
    // 持拍手（最前）
    limb(ctx, P.S, P.E, 0.056, 0.047, flat || look.skin, flat ? null : 'rgba(255,255,255,0.22)', lw, flat ? null : look.outline);
    limb(ctx, P.E, P.W, 0.047, 0.04, flat || look.skin, flat ? null : 'rgba(255,255,255,0.2)', lw, flat ? null : look.outline);
    if (!flat) {
      // 护腕
      const wb = [lerp(P.E[0], P.W[0], 0.78), lerp(P.E[1], P.W[1], 0.78)];
      limb(ctx, wb, [lerp(P.E[0], P.W[0], 0.92), lerp(P.E[1], P.W[1], 0.92)], 0.047, 0.045, look.wrist, null, lw, look.outline);
      // 袖口
      limb(ctx, P.S, [lerp(P.S[0], P.E[0], 0.35), lerp(P.S[1], P.E[1], 0.35)], 0.07, 0.06, look.shirt, null, lw, look.outline);
    }
    racket(ctx, P, look, lw, flat, o.glow || 0);
    // 手
    ctx.fillStyle = flat || look.skin;
    ctx.beginPath(); ctx.arc(P.W[0], P.W[1], 0.045, 0, Math.PI * 2); ctx.fill();
    if (!flat) { ctx.lineWidth = lw; ctx.strokeStyle = look.outline; ctx.stroke(); }
    return P;
  };

  /** 拍头中心（局部坐标） */
  YY.racketHead = (P) => [P.W[0] + Math.cos(P.Rk) * RK_OFF * (P.rs || 1), P.W[1] + Math.sin(P.Rk) * RK_OFF * (P.rs || 1)];

  /** 头像（用于记分牌与界面） */
  YY.portrait = function (look, size) {
    const c = document.createElement('canvas');
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
})(window);
