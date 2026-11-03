/* 羽跃对决 · 核心常量与羽毛球物理
 * 世界坐标（米）：x 沿球场长度，网在 x=0；左方选手 x<0，右方选手 x>0；y 向上，地面 y=0。
 */
(function (G) {
  'use strict';
  const YY = (G.YY = G.YY || {});

  const C = (YY.C = {
    HALF: 6.7,          // 半场长度（底线到网）
    NET_H: 1.55,        // 网高
    SHUTTLE_R: 0.065,   // 球头半径：碰撞与绘制共用（羽毛裙为装饰）
    SHORT_LINE: 1.98,   // 前发球线
    LONG_LINE: 5.94,    // 双打后发球线（仅装饰）
    LINE_TOL: 0.05,     // 压线容差

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
  C.NET_CLEAR = C.NET_H + C.SHUTTLE_R; // 球头底部越过网带才算过网

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

  // 连续检测圆形球头与球网：先裁剪包围范围，再精确求网带顶端的圆形接触。
  function netContact(px, py, x, y) {
    const dx = x - px, dy = y - py;
    let lo = 0, hi = 1;
    if (dx === 0) {
      if (Math.abs(px) > C.SHUTTLE_R) return null;
    } else {
      const a = (-C.SHUTTLE_R - px) / dx, b = (C.SHUTTLE_R - px) / dx;
      lo = Math.max(lo, Math.min(a, b));
      hi = Math.min(hi, Math.max(a, b));
    }
    if (dy === 0) {
      if (py > C.NET_CLEAR) return null;
    } else {
      const f = (C.NET_CLEAR - py) / dy;
      if (dy < 0) lo = Math.max(lo, f);
      else hi = Math.min(hi, f);
    }
    if (lo > hi) return null;
    if (py + dy * lo <= C.NET_H) return lo; // 网面侧边
    const a = dx * dx + dy * dy;
    const b = 2 * (px * dx + (py - C.NET_H) * dy);
    const c = px * px + (py - C.NET_H) ** 2 - C.SHUTTLE_R ** 2;
    if (c <= 0) return 0;
    const disc = b * b - 4 * a * c;
    if (a === 0 || disc < 0) return null;
    const f = (-b - Math.sqrt(disc)) / (2 * a);
    return f >= 0 && f <= 1 ? f : null;
  }

  /** 推进一步羽毛球物理；返回 'net' | 'floor' | null。
   * env（可选）：{ drag: 阻力系数（高原空气稀薄更小）, wind: 水平风速 m/s（+x 吹向右场） } */
  YY.stepShuttle = function (s, dt, env) {
    const drag = env && env.drag != null ? env.drag : C.DRAG;
    const rx = s.vx - ((env && env.wind) || 0); // 相对空气的速度
    const v = Math.hypot(rx, s.vy);
    const k = drag * v;
    s.vx += -k * rx * dt;
    s.vy += (-C.G - k * s.vy) * dt;
    const px = s.x, py = s.y;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    let res = null;
    if (!s.netHit) {
      const f = netContact(px, py, s.x, s.y);
      if (f !== null) {
        // 球头中心可能已略过 x=0，但尾部仍擦网；始终退回入射的一侧。
        const side = s.vx > 0 ? -1 : s.vx < 0 ? 1 : px < 0 ? -1 : 1;
        s.x = side * (C.SHUTTLE_R + 0.0001);
        s.y = py + (s.y - py) * f;
        s.vx = -s.vx * 0.06;
        s.vy = Math.min(s.vy, 0) * 0.3 - 0.5;
        s.netHit = true;
        s.crossedNet = false;
        res = 'net';
      } else if ((px < C.SHUTTLE_R && s.x >= C.SHUTTLE_R) ||
                 (px > -C.SHUTTLE_R && s.x <= -C.SHUTTLE_R)) {
        s.crossedNet = true;
      }
    }
    if (s.y <= 0) {
      s.y = 0;
      res = 'floor';
    }
    return res;
  };

  /** 从给定状态模拟到落地。record=true 时返回轨迹点（相对时间） */
  YY.simulate = function (x, y, vx, vy, maxT, record, netHit, env) {
    const s = { x, y, vx, vy, netHit: !!netHit };
    const dt = C.DT;
    let t = 0, netY = null, apex = y;
    const pts = record ? [{ t: 0, x, y, vx, vy }] : null;
    maxT = maxT || 6;
    let i = 0;
    while (t < maxT) {
      const px = s.x, py = s.y;
      const r = YY.stepShuttle(s, dt, env);
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
  YY.solveSpeed = function (x0, y0, dir, angDeg, dist, env) {
    const a = (angDeg * Math.PI) / 180;
    const ca = Math.cos(a) * dir, sa = Math.sin(a);
    let lo = 0.5, hi = 55;
    const range = (v) => (YY.simulate(x0, y0, v * ca, v * sa, 6, false, true, env).landX - x0) * dir;
    if (range(hi) < dist) return hi;
    for (let i = 0; i < 24; i++) {
      const m = (lo + hi) / 2;
      if (range(m) < dist) lo = m;
      else hi = m;
    }
    return (lo + hi) / 2;
  };

  /** 固定速度，在 [aLo,aHi] 内二分求角度（落点随角度增大而变远） */
  YY.solveAngle = function (x0, y0, dir, speed, dist, aLo, aHi, env) {
    const range = (deg) => {
      const a = (deg * Math.PI) / 180;
      return (YY.simulate(x0, y0, speed * Math.cos(a) * dir, speed * Math.sin(a), 6, false, true, env).landX - x0) * dir;
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
  YY.netClear = function (x0, y0, vx, vy, env) {
    const r = YY.simulate(x0, y0, vx, vy, 6, false, true, env);
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
