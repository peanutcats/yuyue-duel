/* 羽跃对决 · 核心常量与羽毛球物理
 * 世界坐标（米）：x 沿球场长度，网在 x=0；左方选手 x<0，右方选手 x>0；y 向上，地面 y=0。
 */
(function (G) {
  'use strict';
  const YY = (G.YY = G.YY || {});

  const C = (YY.C = {
    HALF: 6.7,          // 半场长度（底线到网）
    NET_H: 1.55,        // 网高
    SHORT_LINE: 1.98,   // 前发球线
    LONG_LINE: 5.94,    // 双打后发球线（仅装饰）
    LINE_TOL: 0.05,     // 压线容差（羽毛球半径）

    G: 9.8,
    DRAG: 0.08,         // 二次阻力系数，终端速度约 11 m/s
    DT: 1 / 120,

    SHOULDER: 1.42,     // 肩高
    ARM: 0.85,          // 肩到拍面甜区距离
    REACH: 0.5,         // 甜区容差：|r-ARM| 小于该值才能击中
    REACH_FAST: 0.72,   // 接杀等快球时的扑救容差
    ANG_MIN: -88,       // 可击球方位角（以面向球网为 0°，向上为正）
    ANG_MAX: 132,

    MOVE: 5.2, ACCEL: 34, DECEL: 42, AIR_ACCEL: 9,
    JUMP_V: 4.4, JUMP_V_LOW: 2.7,
    X_NEAR: 0.45, X_FAR: 7.3,  // 离网可站位范围

    STAM_MAX: 100, JUMP_COST: 12, SMASH_COST: 24, STAM_REGEN: 16, STAM_DELAY: 1.0,

    SW_W0: 0.035,       // 挥拍有效窗口起点
    SW_W1: 0.205,       // 挥拍有效窗口终点
    SW_SWEET: 0.11,     // 最佳击球时刻
    SW_DUR: 0.3,        // 普通挥拍总时长（含收拍）
    SW_SMASH_DUR: 0.56, // 扣杀收拍较慢
    SMASH_MIN_Y: 2.45,  // 扣杀最低击球点

    SPEED_DISPLAY: 2.4, // 显示球速的夸张倍率（游戏内速度做了放慢）
    SERVE_AUTO: 8,      // 超时自动发球
  });

  YY.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  YY.lerp = (a, b, t) => a + (b - a) * t;
  YY.rand = (a, b) => a + Math.random() * (b - a);
  YY.gauss = () => {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  YY.pick = (weights) => {
    // weights: {key: w}
    let sum = 0;
    for (const k in weights) sum += Math.max(0, weights[k]);
    let r = Math.random() * sum;
    for (const k in weights) {
      r -= Math.max(0, weights[k]);
      if (r <= 0) return k;
    }
    return Object.keys(weights)[0];
  };

  /** 推进一步羽毛球物理；返回 'net' | 'floor' | null */
  YY.stepShuttle = function (s, dt) {
    const v = Math.hypot(s.vx, s.vy);
    const k = C.DRAG * v;
    s.vx += -k * s.vx * dt;
    s.vy += (-C.G - k * s.vy) * dt;
    const px = s.x, py = s.y;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    let res = null;
    if (!s.netHit && (px < 0) !== (s.x < 0)) {
      const f = px / (px - s.x);
      const yc = py + (s.y - py) * f;
      if (yc < C.NET_H) {
        s.x = px < 0 ? -0.04 : 0.04;
        s.vx = -s.vx * 0.06;
        s.vy = Math.min(s.vy, 0) * 0.3 - 0.5;
        s.netHit = true;
        res = 'net';
      }
    }
    if (s.y <= 0) {
      s.y = 0;
      res = 'floor';
    }
    return res;
  };

  /** 从给定状态模拟到落地。record=true 时返回轨迹点（相对时间） */
  YY.simulate = function (x, y, vx, vy, maxT, record, netHit) {
    const s = { x, y, vx, vy, netHit: !!netHit };
    const dt = C.DT;
    let t = 0, netY = null, apex = y;
    const pts = record ? [{ t: 0, x, y, vx, vy }] : null;
    maxT = maxT || 6;
    let i = 0;
    while (t < maxT) {
      const px = s.x, py = s.y;
      const r = YY.stepShuttle(s, dt);
      t += dt;
      i++;
      if (netY === null && (px < 0) !== (s.x < 0) && r !== 'net') {
        const f = px / (px - s.x);
        netY = py + (s.y - py) * f;
      }
      if (s.y > apex) apex = s.y;
      if (record && (i % 2 === 0 || r === 'floor')) pts.push({ t, x: s.x, y: s.y, vx: s.vx, vy: s.vy });
      if (r === 'floor') break;
    }
    return { landX: s.x, t, netHit: s.netHit, netY, apex, pts };
  };

  /** 固定角度，二分求初速度，使落点距离击球点 dist（沿 dir 方向） */
  YY.solveSpeed = function (x0, y0, dir, angDeg, dist) {
    const a = (angDeg * Math.PI) / 180;
    const ca = Math.cos(a) * dir, sa = Math.sin(a);
    let lo = 0.5, hi = 55;
    const range = (v) => (YY.simulate(x0, y0, v * ca, v * sa, 6, false, true).landX - x0) * dir;
    if (range(hi) < dist) return hi;
    for (let i = 0; i < 24; i++) {
      const m = (lo + hi) / 2;
      if (range(m) < dist) lo = m;
      else hi = m;
    }
    return (lo + hi) / 2;
  };

  /** 固定速度，在 [aLo,aHi] 内二分求角度（落点随角度增大而变远） */
  YY.solveAngle = function (x0, y0, dir, speed, dist, aLo, aHi) {
    const range = (deg) => {
      const a = (deg * Math.PI) / 180;
      return (YY.simulate(x0, y0, speed * Math.cos(a) * dir, speed * Math.sin(a), 6, false, true).landX - x0) * dir;
    };
    let lo = aLo, hi = aHi;
    if (range(lo) >= dist) return lo;
    if (range(hi) <= dist) return hi;
    for (let i = 0; i < 22; i++) {
      const m = (lo + hi) / 2;
      if (range(m) < dist) lo = m;
      else hi = m;
    }
    return (lo + hi) / 2;
  };

  /** 计算过网高度（不考虑撞网），未到达网返回 -Infinity */
  YY.netClear = function (x0, y0, vx, vy) {
    const r = YY.simulate(x0, y0, vx, vy, 6, false, true);
    return r.netY === null ? -Infinity : r.netY;
  };

  YY.SHOT_NAMES = {
    clear: '高远球', flatclear: '平高球', lift: '挑球', drop: '吊球', slice: '劈吊',
    net: '网前轻放', block: '放网', smash: '扣杀', drive: '平抽',
    lserve: '发高远球', sserve: '发网前球', feed: '发球机',
  };
  // 归类：用于“重复球路被针对”的判断
  YY.SHOT_CAT = {
    clear: 'clear', flatclear: 'clear', lift: 'clear', lserve: 'clear',
    drop: 'drop', slice: 'drop', net: 'drop', block: 'drop', sserve: 'drop',
    smash: 'smash', drive: 'drive',
  };

  if (typeof module !== 'undefined') module.exports = YY;
})(typeof window !== 'undefined' ? window : globalThis);
