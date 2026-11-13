/* 羽跃对决 · 核心常量与羽毛球物理
 * 世界坐标（米）：x 沿球场长度，网在 x=0；左方选手 x<0，右方选手 x>0；y 向上，地面 y=0。
 */
(function (G) {
  'use strict';
  const YY = (G.YY = G.YY || {});
  YY.PHYSICS_VERSION = 28;
  // Free matches use these presets; story and training retain their own goals.
  YY.SCORE_RULES = Object.freeze({7: 11, 15: 21, 21: 30});
  YY.matchFormat = value => {
    const target = [7, 15, 21].includes(Number(value)) ? Number(value) : 7;
    return {target, cap: YY.SCORE_RULES[target]};
  };
  YY.MATCH_VENUES = ['arena', 'sunset', 'neon', 'bamboo', 'harbor', 'aurora'];
  YY.hitTier = q => q >= .85 ? 'perfect' : q < .4 ? 'strained' : 'normal';
  YY.staminaState = p => {
    const value = Math.max(0, Math.min(100, p.stamina ?? 100));
    const recovering = value < 99.5 && p.onGround && Math.hypot(p.vx || 0, p.vz || 0) < .6 && !p.swing && !p.shotQueue3D && (p.stamDelay || 0) <= 0;
    return {value, recovering, low: value < 30, color: value < 30 ? '#ff927b' : value < 60 ? '#ffd37a' : '#79e4bd', label: recovering ? '恢复中' : value < 30 ? '疲劳' : value < 60 ? '调整呼吸' : '体力充沛'};
  };

  // Host services are supplied by the browser or the WeChat entry point.
  YY.platform = YY.platform || {
    createCanvas: () => G.document.createElement('canvas'),
    viewport: () => ({ W: G.innerWidth, H: G.innerHeight, dpr: G.devicePixelRatio || 1 }),
    hidden: () => !!G.document?.hidden,
    getStorage: key => G.localStorage?.getItem(key) ?? null,
    setStorage: (key, value) => G.localStorage?.setItem(key, value),
  };

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

    // 体力：整场比赛持续累积，每分之间只恢复一部分。跑动、急停折返、起跳是主要消耗；
    // 体力低于 STAM_FRESH 后，移动、加速、挥拍、起跳、发力球的深度与球速连续下降。
    STAM_MAX: 100, JUMP_COST: 10, SMASH_COST: 16, STAM_REGEN: 16, STAM_DELAY: 0.8,
    STAM_RUN: 0.9,      // 冲刺跑动：超过慢步速度的部分，每 (m/s) 每秒消耗
    STAM_JOG: 1.6,      // 慢步速度：低于此速度移动不额外消耗
    STAM_TURN: 4.5,     // 全速急停折返一次的消耗
    STAM_LUNGE: 3,      // 跑动中弓步够球 / 下手救低球
    STAM_POWER: 2,      // 高远、挑球、推后场等发力球（后场再加一点）
    STAM_REST: 8.5,       // 回合中站稳（基本不动）每秒恢复
    STAM_MOVE_REGEN: 1.2, // 回合中移动、发球准备时每秒恢复
    STAM_POINT: 34,     // 每分结束后恢复量（不是回满）
    STAM_FRESH: 60,     // 高于此值没有疲劳惩罚

    SW_W0: 0.035,       // 挥拍有效窗口起点
    SW_W1: 0.205,       // 挥拍有效窗口终点
    SW_SWEET: 0.11,     // 最佳击球时刻
    SW_DUR: 0.34,        // 普通挥拍总时长（含收拍）
    SW_SMASH_DUR: 0.48, // 重杀保留完整随挥，但更快衔接回位
    SWING_COST: 2.8, SWING_POWER_COST: 3.8, SWING_MISS_COST: 1.2,
    SW_RECOVER: .05, SW_MISS_RECOVER: .14,
    SW_BUFFER: 0.09,    // 收拍将结束时，短暂保留最近一次击球按键
    JUMP_BUFFER: 0.14,  // 即将落地 / 落地缓冲期间保留一次起跳输入
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
  function netContact(px, py, x, y, netH) {
    const NH = netH || C.NET_H, NC = NH + C.SHUTTLE_R;
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
      if (py > NC) return null;
    } else {
      const f = (NC - py) / dy;
      if (dy < 0) lo = Math.max(lo, f);
      else hi = Math.min(hi, f);
    }
    if (lo > hi) return null;
    if (py + dy * lo <= NH) return lo; // 网面侧边
    const a = dx * dx + dy * dy;
    const b = 2 * (px * dx + (py - NH) * dy);
    const c = px * px + (py - NH) ** 2 - C.SHUTTLE_R ** 2;
    if (c <= 0) return 0;
    const disc = b * b - 4 * a * c;
    if (a === 0 || disc < 0) return null;
    const f = (-b - Math.sqrt(disc)) / (2 * a);
    return f >= 0 && f <= 1 ? f : null;
  }

  /** 推进一步羽毛球物理；返回 'net' | 'floor' | null。
   * env（可选）：{ drag: 阻力系数（高原空气稀薄更小）, wind: 水平风速 m/s（+x 吹向右场） } */
  // Rotation develops through the net. Live flight and prediction share this field.
  YY.curveWeight = function(x, curve) {
    const u = YY.clamp((x * curve.dir + .35) / 1.8, 0, 1);
    return .12 + .88 * u * u * (3 - 2 * u);
  };
  // Folded paper changes drag and lift along the real flight. Keeping the
  // stages spatial makes simulation, prediction and both camera modes agree.
  YY.paperAero = function(x,paper) {
    if(!paper)return {drag:1,gravity:1,wing:0,fold:0};
    const smooth=(a,b,v)=>{const u=YY.clamp((v-a)/(b-a),0,1);return u*u*(3-2*u);};
    const d=x*paper.dir;
    const open=paper.glide?smooth(.08,.62,d):0;
    const fold=paper.glide?smooth(paper.foldAt,paper.foldAt+.64,d):0;
    const wing=open*(1-fold);
    return {drag:(paper.dart?.37:1)*(1-.3*wing)+fold*1.65,
      gravity:1-.86*wing+.88*fold,wing,fold};
  };
  YY.stepShuttle = function (s, dt, env) {
    s.stepTime = 0;
    if (!Number.isFinite(dt) || dt <= 0) return null;
    const drag = Math.max(0, env && env.drag != null ? env.drag : C.DRAG);
    const wind = (env && env.wind) || 0;
    // 技能环境：netH 临时网高（防火墙），g 重力倍率（重力换班，负值＝向上飘）
    const netH = (env && env.netH) || C.NET_H, g0 = C.G * (env && env.g != null ? env.g : 1);
    const gFar = env && env.gFar; // 重力球：过到 gFar.side 那一侧后重力 ×gFar.m
    const ceil = env && env.ceil; // 重力翻转的球最高飘到这里，悬停等着落
    let remaining = dt, result = null;
    while (remaining > 1e-10) {
      const aero=env?.paper?YY.paperAero(s.x+s.vx*Math.min(remaining,C.DT)*.5,env.paper):null;
      const g = (gFar && s.x * gFar.side > 0 ? g0 * gFar.m : g0)*(aero?.gravity??1);
      const rx = s.vx - wind, speed = Math.hypot(rx, s.vy);
      // Midpoint integration preserves ballistic motion without drag and is
      // substantially less step-size dependent than the previous Euler update.
      // Small substeps also prevent strong drag from reversing the velocity.
      const air=drag*(aero?.drag??1);
      const h = Math.min(remaining, C.DT, 0.2 / Math.max(1e-9, air * speed));
      const spin=env?.curve ? env.curve.lift * env.curve.dir * YY.curveWeight(s.x, env.curve) : YY.clamp(Number(env?.spin)||0,-1.5,1.5);
      const k = air * speed;
      const mx = s.vx + (-k * rx-spin*s.vy) * h / 2, my = s.vy + (-g - k * s.vy+spin*rx) * h / 2;
      const mk = air * Math.hypot(mx - wind, my);
      const vx = s.vx + (-mk * (mx - wind)-spin*my) * h, vy = s.vy + (-g - mk * my+spin*(mx-wind)) * h;
      const px = s.x, py = Math.max(C.SHUTTLE_R, s.y);
      const x = px + mx * h, y = py + my * h;
      const floor = y <= C.SHUTTLE_R ? clampFraction((py - C.SHUTTLE_R) / Math.max(1e-12, py - y)) : null;
      const net = s.netHit ? null : netContact(px, py, x, y, netH);
      s.vx = vx; s.vy = vy;
      if (floor !== null && (net === null || floor <= net)) {
        // Score at the first cork/ground contact, not the far end of a frame.
        s.x = px + (x - px) * floor; s.y = C.SHUTTLE_R;
        s.stepTime += h * floor;
        return 'floor';
      }
      if (net !== null) {
        const side = mx > 0 ? -1 : mx < 0 ? 1 : px < 0 ? -1 : 1;
        s.x = side * (C.SHUTTLE_R + 0.0001);
        s.y = py + (y - py) * net;
        s.vx = -vx * 0.06; s.vy = Math.min(vy, 0) * 0.3 - 0.5;
        s.netHit = true; s.crossedNet = false; result = 'net';
      } else {
        s.x = x; s.y = y;
        if (ceil && s.y >= ceil - 1e-6) { s.y = Math.min(s.y, ceil); if (s.vy > 0) s.vy = 0; s.vx *= Math.max(0, 1 - 3 * h); } // 顶上悬停：横向也慢慢停住
        if (!s.netHit && ((px < C.SHUTTLE_R && x >= C.SHUTTLE_R) ||
            (px > -C.SHUTTLE_R && x <= -C.SHUTTLE_R))) s.crossedNet = true;
      }
      s.stepTime += h; remaining -= h;
    }
    return result;
  };
  const clampFraction = value => Math.max(0, Math.min(1, value));

  /** 从给定状态模拟到落地。record=true 时返回轨迹点（相对时间） */
  YY.simulate = function (x, y, vx, vy, maxT, record, netHit, env) {
    const s = { x, y, vx, vy, netHit: !!netHit };
    const dt = C.DT;
    let t = 0, netY = null, apex = y;
    const pts = record ? [{ t: 0, x, y, vx, vy }] : null;
    maxT = maxT || 6;
    let i = 0;
    while (t < maxT - 1e-10) {
      const px = s.x, py = s.y;
      const r = YY.stepShuttle(s, Math.min(dt, maxT - t), env);
      t += s.stepTime;
      i++;
      if (netY === null && (px < 0) !== (s.x < 0) && r !== 'net') {
        const f = px / (px - s.x);
        netY = py + (s.y - py) * f;
      }
      if (s.y > apex) apex = s.y;
      if (record && (i % 2 === 0 || r || t >= maxT - 1e-10)) pts.push({ t, x: s.x, y: s.y, vx: s.vx, vy: s.vy });
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
    let rLo = range(lo), rHi = range(hi);
    if (rHi < dist) return hi;
    if (rLo > dist) return lo;
    for (let i = 0; i < 24; i++) {
      // Safeguarded interpolation needs fewer full trajectory simulations than
      // always halving the speed range; stop once landing error is sub-millimetre.
      const u = YY.clamp((dist - rLo) / (rHi - rLo || 1), 0.1, 0.9);
      const m = lo + (hi - lo) * u, r = range(m);
      if (Math.abs(r - dist) < 0.0002) return m;
      if (r < dist) { lo = m; rLo = r; }
      else { hi = m; rHi = r; }
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
    let rLo = range(lo), rHi = range(hi);
    if (rLo >= dist) return lo;
    if (rHi <= dist) return hi;
    for (let i = 0; i < 22; i++) {
      const u = YY.clamp((dist - rLo) / (rHi - rLo || 1), 0.1, 0.9);
      const m = lo + (hi - lo) * u, r = range(m);
      if (Math.abs(r - dist) < 0.0002) return m;
      if (r < dist) { lo = m; rLo = r; }
      else { hi = m; rHi = r; }
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
    kill: '网前扑球', halfsmash: '点杀', tumble: '搓球', push: '推后场',
    lserve: '发高远球', sserve: '发网前球', feed: '发球机',
  };
  // 归类：用于“重复球路被针对”的判断
  YY.SHOT_CAT = {
    clear: 'clear', flatclear: 'clear', lift: 'clear', lserve: 'clear',
    drop: 'drop', slice: 'drop', net: 'drop', block: 'drop', sserve: 'drop',
    smash: 'smash', drive: 'drive', kill: 'smash', halfsmash: 'smash', tumble: 'drop', push: 'clear',
  };

  if (typeof module !== 'undefined') module.exports = YY;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof window !== 'undefined' ? window : globalThis);
