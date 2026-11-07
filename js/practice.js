/* 羽跃对决 · 自由练习：发球机喂球 + 落点 / 站位 / 时机提示 */
(function (G) {
  'use strict';
  const YY = G.YY;
  const C = YY.C;
  const { rand, clamp } = YY;

  const DRILLS = {
    receive: { name: '接球练习', tip: '看黄色落点，提前移动到青色站位，听到提示再挥拍。', zone: null },
    clear: { name: '高远球练习', tip: '在头顶高点击球（J / 高远），把球送进对方后场目标区。', zone: [4.6, C.HALF + C.LINE_TOL] },
    drop: { name: '吊球练习', tip: '在后场头顶击球（K / 吊球），让球刚过网落进前场目标区。', zone: [0.05, 2.3] },
    net: { name: '网前练习', tip: '冲到网前：网带高度的球点「吊球」搓球，偏高的球点「扣杀」扑球。', zone: [0.05, 2.3] },
    smash: { name: '跳杀练习', tip: '看到“起跳！”先跳（W / 跳），在空中高点按扣杀（L）。', zone: null },
    tactics: { name: '三拍战术教学', tip: '压后场 → 调网前 → 抓机会。三步练会制造进攻空当，失误只重练当前一步。', zone: null },
  };
  YY.DRILLS = DRILLS;

  class Practice {
    /** drill：练习名，或自定义定义 { name, tip, zone, judge:'receive'|'clear'|'drop'|'smash', feeds:{球路:权重}, goal:{need,total} } */
    constructor(match, drill) {
      this.m = match;
      this.def = typeof drill === 'string' ? DRILLS[drill] : Object.assign({}, DRILLS[drill.judge || 'receive'], drill);
      this.drill = typeof drill === 'string' ? drill : drill.judge || 'receive';
      this.goal = this.def.goal || null;
      this.done = false;
      this.att = 0; this.ok = 0; this.streak = 0; this.best = 0;
      this.wait = 1.2;
      this.msg = this.def.tip;
      this.msgColor = '#ffffff';
      this.playerHit = null;
      this.fed = false;
      this.hintAt = 0;
      match.phase = 'idle';
      match.players[1].x = 3.2;
      match.players[0].x = -3.0;
      match.shuttle.held = false;
      match.shuttle.live = false;
      match.shuttle.x = 3.2; match.shuttle.y = 0;
      match.hint = null;
    }

    feed() {
      const m = this.m, s = m.shuttle;
      const env = m.physEnv ? m.physEnv() : m.env;
      const clearance = ((env && env.netH) || C.NET_H) + C.SHUTTLE_R + 0.15;
      let kind = this.drill;
      if (kind === 'receive') kind = YY.pick(this.def.feeds || { clear: 3, drop: 2, smash: 1.4, drive: 1.2, net: 1.5, lift: 1.5 });
      if (kind === 'net' && this.drill === 'net') kind = YY.pick(this.def.feeds || { net: 2, drop: 1, netlift: 1 });
      if (this.drill === 'clear' || this.drill === 'drop') kind = 'high';
      let x0, y0, vx, vy;
      const accept = (x, y, speed, ang, dist) => {
        const a = ang * Math.PI / 180, dx = -Math.cos(a) * speed, dy = Math.sin(a) * speed;
        if (!Number.isFinite(dx) || !Number.isFinite(dy) || dx >= 0) return false;
        // 落点求解会忽略球网；发球前用真实碰撞和同一物理环境再验一次。
        const r = YY.simulate(x, y, dx, dy, 6, false, false, env);
        const half = m.halfOf ? m.halfOf(0) : C.HALF;
        if (r.netHit || r.netY == null || r.netY < clearance || r.t >= 6 ||
            r.landX >= 0 || r.landX < -half || Math.abs(r.landX + dist) > 0.03) return false;
        x0 = x; y0 = y; vx = dx; vy = dy;
        return true;
      };
      const shoot = (x, y, ang, dist) => {
        for (; ang <= 80; ang += 5) { // 抬高弧线并重算球速，保持落点；不能抬过竖直方向。
          const v = YY.solveSpeed(x, y, -1, ang, dist + x, env);
          if (accept(x, y, v, ang, dist)) return true;
        }
        return false;
      };
      const fire = (x, y, speed, dist, lo, hi) => {
        const a = YY.solveAngle(x, y, -1, speed, dist + x, lo, hi, env);
        // 平抽 / 接杀也要验网；固定高速无法兼顾落点和过网时，改用稍高、较慢的弧线。
        return accept(x, y, speed, a, dist) || shoot(x, y, a + 5, dist);
      };
      switch (kind) {
        // 入门接球从可见的发球机口发出，只喂中场缓球，留出观察和移动时间。
        case 'intro': shoot(m.players[1].x - 0.5, 1.17, 48, rand(2.8, 4.0)); break;
        case 'high': shoot(this.def.source || 2.6, this.def.source ? 1.8 : 1.2, 62, this.def.feedDepth || rand(4.0, 5.2)); break;
        case 'smash':
          if (this.drill === 'receive') fire(2.8, 3.0, 21, rand(2.6, 4.2), -45, 5);
          else shoot(this.def.source || 1.6, 1.0, 66, rand(2.6, 3.6));
          break;
        case 'clear': shoot(2.6, 2.3, 50, rand(4.6, 5.8)); break;
        case 'lift': shoot(1.2, 0.8, 62, rand(4.4, 5.6)); break;
        case 'drop': shoot(3.6, 2.5, 6, rand(1.0, 1.9)); break;
        case 'net': shoot(0.9, 1.0, 60, rand(0.6, 1.2)); break;
        case 'netlift': shoot(0.8, 1.1, 72, rand(1.3, 1.9)); break;
        case 'drive': fire(2.6, 1.9, 15, rand(3.0, 4.5), -15, 25); break;
        default: shoot(2.6, 2.3, 50, 5);
      }
      if (x0 == null) { this.wait = 0.6; return; } // 无有效轨迹则稍后重试，不发坏球、不计次数。
      this.lastKind = kind;
      s.x = x0; s.y = y0; s.vx = vx; s.vy = vy;
      s.live = true; s.held = false; s.netHit = false; s.crossedNet = false; s.lastHitter = 1; s.shot = 'feed'; s.isServe = false;
      s.speed = Math.hypot(vx, vy);
      m.phase = 'rally';
      m.hitCount++;
      m.pred = YY.simulate(s.x, s.y, s.vx, s.vy, 6, true, false, env);
      m.pred.t0 = m.time;
      m.players[1].flash = 0.2;
      m.emit({ type: 'hit', p: 1, shot: 'feed', name: '发球机', q: 1, label: '', speed: s.speed, x: s.x, y: s.y, feed: true });
      this.playerHit = null;
      this.fed = true;
      m.hint = null;
      this.hintAt = m.time;
      this.hintLock = false;
    }

    onEvent(e) {
      if (e.type === 'hit' && e.p === 0) this.playerHit = e;
      if (e.type === 'pland') this.evaluate(e);
    }

    evaluate(e) {
      if (!this.fed) return;
      this.fed = false;
      if (e.hitter === 1 && e.x > 0) { this.wait = 0.6; return; } // 发球机自己失误，不计入
      this.att++;
      const ph = this.playerHit;
      let ok = false, msg = '', col = '#ff7b7b';
      if (!ph) msg = '没接到 — 跟着黄色落点提前移动';
      else if (e.netHit && e.x <= 0) msg = '下网 — 击球点太低或挥拍时机不准';
      else if (!e.inB) msg = '出界 — 回球太大，试着更早、更稳地击球';
      else if (e.x <= 0) msg = '没有过网';
      else {
        const d = Math.abs(e.x);
        const cat = YY.SHOT_CAT[ph.shot];
        if (this.drill === 'receive') { ok = true; msg = '回球成功 · ' + ph.name + ' · ' + ph.label; }
        else if (this.drill === 'clear') {
          if (cat !== 'clear') msg = '这次打成了' + ph.name + '，请用高远球（J）';
          else if (d < this.def.zone[0]) msg = '偏短 — 落在中场容易被扣杀，击球点再靠前一点';
          else { ok = true; msg = '漂亮的高远球！· ' + ph.label; }
        } else if (this.drill === 'drop') {
          if (cat !== 'drop') msg = '这次打成了' + ph.name + '，请用吊球（K）';
          else if (d > this.def.zone[1]) msg = '偏长 — 吊球要轻，落点贴近球网';
          else { ok = true; msg = '好吊球！· ' + ph.label; }
        } else if (this.drill === 'net') {
          if (ph.shot === 'kill') { ok = true; msg = '扑球得手！又快又狠'; }
          else if (cat !== 'drop') msg = '这次打成了' + ph.name + '，网前请用「吊球」搓放，或「扣杀」扑球';
          else if (d > this.def.zone[1]) msg = '偏长 — 网前球要贴着网落下';
          else { ok = true; msg = ph.shot === 'tumble' ? '漂亮的搓球！球翻着跟头过网' : '好球！· ' + ph.name; }
        } else if (this.drill === 'smash') {
          if (ph.shot !== 'smash') msg = (ph.reason ? ph.reason + ' — ' : '') + '先起跳，在空中高点按扣杀';
          else { ok = true; msg = '跳杀得手！球速 ' + Math.round(ph.speed * 3.6 * C.SPEED_DISPLAY) + ' km/h'; }
        }
      }
      if (ok) { this.ok++; this.streak++; this.best = Math.max(this.best, this.streak); col = '#7dffb0'; }
      else this.streak = 0;
      this.msg = msg; this.msgColor = col;
      this.wait = 1.3;
      this.m.emit({ type: 'pres', ok, msg });
      const g = this.goal;
      if (g && !this.done && (this.ok >= g.need || this.att >= g.total || g.total - this.att < g.need - this.ok)) {
        this.done = true;
        this.m.emit({ type: 'pdone', win: this.ok >= g.need, ok: this.ok, att: this.att, best: this.best });
      }
    }

    update(dt) {
      const m = this.m;
      if ((m.phase === 'idle' || m.phase === 'serve') && !this.done) {
        this.wait -= dt;
        if (this.wait <= 0) this.feed();
      }
      // 提示：落点、理想站位、起跳与挥拍时机
      const s = m.shuttle;
      if (s.live && !s.netHit && s.lastHitter !== 0) {
        if (!this.hintLock && m.time >= this.hintAt) {
          this.hintAt = m.time + 0.08;
          const prefs = this.drill === 'smash' ? ['smash', 'over', 'low'] : ['over', 'low'];
          const c = YY.findContact(m, 0, prefs, 0);
          if (c) {
            m.hint = { landX: c.landX, standX: c.band === 'none' ? null : c.standX, swingAt: c.tContact - C.SW_SWEET, jumpAt: c.jumpAt, band: c.band };
            const commit = c.jumpAt != null ? c.jumpAt : c.tContact - C.SW_SWEET;
            if (commit - m.time < 0.3) this.hintLock = true;
          }
        }
      } else if (m.hint && (!s.live || s.netHit || s.lastHitter === 0)) {
        m.hint = null;
      }
    }
  }

  YY.Practice = Practice;

  const LESSON = YY.TACTIC_LESSON = [
    { drill: 'clear', title: '高远压后场', cue: '先退到青色站位，按「高远」把球送进后场金区。', why: '对手被压到后场：现在吊网前，让他跑起来。', source: 2.6, depth: 4.4 },
    { drill: 'drop', title: '吊球调网前', cue: '对手还在后场！到位后按「吊球」，落进网前金区。', why: '对手赶到网前，只能挑出半场高球：准备起跳。', source: 5.3, depth: 4.2 },
    { drill: 'smash', title: '抓高球跳杀', cue: '跟随站位提示，先按「跳」，在空中高点按「扣杀」。', why: '完成！先调动，再进攻；没有好机会时用高远重新组织。', source: 1.5 },
  ];
  class TacticsPractice extends Practice {
    constructor(match) {
      super(match, 'clear'); this.tutorial = true; this.stage = 0; this.completed = 0;
      match.tutorial = true; match.names[1] = '战术陪练'; this.opponentTarget = LESSON[0].source;
      this.applyStage(); this.wait = 2.2;
    }
    applyStage() {
      const step = LESSON[this.stage];
      this.drill = step.drill;
      this.def = { ...DRILLS[step.drill], name: `战术 ${this.stage + 1}/3 · ${step.title}`, source: step.source, feedDepth: step.depth };
      this.msg = step.cue; this.msgColor = '#ffd23f';
      this.progressText = '失误可重试 · 已掌握';
    }
    feed() {
      if (this.nextStage != null) { this.stage = this.nextStage; this.nextStage = null; this.applyStage(); }
      this.m.players[1].x = LESSON[this.stage].source;
      this.opponentTarget = LESSON[this.stage].source;
      // Each step starts with enough stamina; failures never erase earlier steps.
      this.m.players[0].stamina = C.STAM_MAX;
      super.feed();
    }
    onEvent(e) {
      super.onEvent(e);
      if (e.type === 'hit' && e.p === 0) this.opponentTarget = this.stage === 0 ? 5.3 : this.stage === 1 ? 1.5 : 3.3;
    }
    update(dt) {
      super.update(dt);
      const p = this.m.players[1], dx = this.opponentTarget - p.x;
      this.m.inputs[1].move = Math.abs(dx) < .08 ? 0 : clamp(dx * p.dir / .35, -1, 1);
    }
    evaluate(e) {
      const before = this.ok, attempts = this.att;
      super.evaluate(e);
      if (this.att === attempts) return;
      if (this.ok > before) {
        this.completed++;
        this.msg = LESSON[this.stage].why; this.wait = 2.2;
        if (this.stage === LESSON.length - 1) {
          this.done = true; this.def.name = '三拍战术 · 已完成';
          this.m.emit({ type: 'tacticsDone', attempts: this.att });
        } else this.nextStage = this.stage + 1;
      } else { this.msg = '重练本步 · ' + this.msg; this.wait = 1.2; }
    }
  }
  YY.TacticsPractice = TacticsPractice;

  // ---------- 训练场：可调发球机 + 技能试用 ----------
  // 球路决定出球点与默认弧线；落点、高度、速度在此基础上求出一条一定过网的真实轨迹。
  const FEED_TYPES = YY.FEED_TYPES = {
    clear: { name: '高远球', short: '高远', x: 3.4, y: 2.5, ang: 50, depth: [4.8, 6.2], net: .5, tip: '退到后场，练头顶高点出手与回中' },
    drop: { name: '吊球', short: '吊球', x: 4.6, y: 2.5, ang: 6, depth: [0.8, 2.0], net: .12, tip: '启动上网，在球过网后尽早接住' },
    smash: { name: '杀球', short: '杀球', x: 2.9, y: 3.0, ang: -14, depth: [2.4, 4.4], net: .15, tip: '降低重心，练接杀挡网与反抽' },
    drive: { name: '平抽', short: '平抽', x: 2.6, y: 1.8, ang: 8, depth: [3.0, 5.0], net: .15, tip: '中场快速平抽挡，拍子提前举起' },
    net: { name: '网前球', short: '网前', x: 0.9, y: 1.0, ang: 60, depth: [0.4, 1.3], net: .04, tip: '贴网小球：搓、勾、推或扑' },
    lift: { name: '挑球', short: '挑球', x: 1.2, y: 0.8, ang: 64, depth: [4.4, 6.0], net: .6, tip: '高球下落：起跳扣杀或打回高远' },
  };
  const MIX = { clear: 3, drop: 2, smash: 1.5, drive: 1.3, net: 1.6, lift: 1.6 };
  const DEPTHS = { front: [0.5, 1.8], mid: [2.3, 4.2], back: [4.7, 6.3], any: [0.6, 6.2] };
  const RAISE = { low: -0.35, mid: 0, high: 0.45 }, SPEEDS = { slow: 0.8, mid: 1, fast: 1.22 }, GAPS = { fast: 0.55, mid: 1.2, slow: 2.1 };
  YY.TRAIN_OPTIONS = {
    type: [['mix', '混合'], ...Object.entries(FEED_TYPES).map(([k, v]) => [k, v.short])],
    depth: [['auto', '自动'], ['front', '前场'], ['mid', '中场'], ['back', '后场'], ['any', '随机']],
    height: [['low', '低弧'], ['mid', '标准'], ['high', '高弧']],
    speed: [['slow', '慢'], ['mid', '标准'], ['fast', '快']],
    gap: [['fast', '紧凑'], ['mid', '标准'], ['slow', '从容']],
  };
  YY.TRAIN_DEFAULT = { char: 'lingfeng', type: 'mix', depth: 'auto', height: 'mid', speed: 'mid', gap: 'mid', skills: true, freeEnergy: true, freeStamina: false, hint: true };
  /** 训练场配置清洗：非法值回落到默认 */
  YY.cleanTrain = function (c) {
    const d = YY.TRAIN_DEFAULT, o = Object.assign({}, d);
    if (!c || typeof c !== 'object') return o;
    if (YY.CHARS.some(ch => ch.id === c.char)) o.char = c.char;
    for (const k of Object.keys(YY.TRAIN_OPTIONS)) if (YY.TRAIN_OPTIONS[k].some(([v]) => v === c[k])) o[k] = c[k];
    for (const k of ['skills', 'freeEnergy', 'freeStamina', 'hint']) if (typeof c[k] === 'boolean') o[k] = c[k];
    return o;
  };

  /**
   * 发球机出球：x0,y0 为出球点（发球机一侧 x>0），d 为落在玩家半场离网 d 米。
   * 落到同一点的弧线是一族（越平越快、越高越慢）。先用球路默认弧线得到标准的最高点与飞行时间，
   * 再按「高度」定目标最高点、按「速度」定目标飞行时间，在所有能过网的弧线里取最接近的一条；
   * 两者冲突时（如高弧 + 快）自动折中。高度档位同时微调出球点高低。
   */
  const FEED_CACHE = new Map();
  /** 带缓存的出球：落点取整到 10 厘米，同一设置重复出球不再重算（手机上省掉每球一次的轨迹搜索） */
  YY.cachedFeed = function (type, d, height, speed, env) {
    d = Math.round(d * 10) / 10;
    const key = [type, d, height, speed, env ? JSON.stringify(env) : ''].join('|');
    let f = FEED_CACHE.get(key);
    if (!f) { f = YY.feedShot(type, d, height, speed, env); if (FEED_CACHE.size > 400) FEED_CACHE.clear(); FEED_CACHE.set(key, f); }
    return f;
  };
  YY.feedShot = function (type, d, height, speed, env) {
    const T = FEED_TYPES[type] || FEED_TYPES.clear, margin = C.NET_CLEAR + T.net;
    const fly = (x0, y0, v, deg) => {
      const a = deg * Math.PI / 180, r = YY.simulate(x0, y0, -Math.cos(a) * v, Math.sin(a) * v, 6, false, true, env);
      return { r: x0 - r.landX, net: r.netY == null ? -Infinity : r.netY, apex: r.apex, t: r.t };
    };
    const clean = (x0, y0, c) => { const a = c.ang * Math.PI / 180; return !YY.simulate(x0, y0, -Math.cos(a) * c.v, Math.sin(a) * c.v, 6, false, false, env).netHit; };
    /** 出球点 (x0,y0) 下，所有落到 d 且过网的弧线 */
    const family = (x0, y0, lo, hi, guess) => {
      const dist = d + x0, list = [];
      // 每个角度求出落到 dist 的球速（以上一个角度的结果为初值，区间试位法，误差 3 厘米即可）
      const speedFor = (ang, g) => {
        let vl = g * 0.8, vh = g * 1.25, rl = fly(x0, y0, vl, ang).r, rh = fly(x0, y0, vh, ang).r;
        for (let i = 0; i < 6 && rl > dist; i++) { vh = vl; rh = rl; vl *= 0.7; rl = fly(x0, y0, vl, ang).r; }
        for (let i = 0; i < 6 && rh < dist; i++) { vl = vh; rl = rh; vh *= 1.4; if (vh > 60) return null; rh = fly(x0, y0, vh, ang).r; }
        if (rl > dist || rh < dist) return null;
        for (let i = 0; i < 12; i++) {
          const v = vl + (vh - vl) * clamp((dist - rl) / (rh - rl || 1), 0.08, 0.92), res = fly(x0, y0, v, ang);
          if (Math.abs(res.r - dist) < 0.03) return { v, res };
          if (res.r < dist) { vl = v; rl = res.r; } else { vh = v; rh = res.r; }
        }
        return null;
      };
      for (let ang = lo; ang <= hi; ang += 3) {
        const hit = speedFor(ang, guess);
        if (!hit) continue;
        guess = hit.v;
        if (hit.res.net > margin && hit.v < 54) list.push({ v: hit.v, ang, apex: hit.res.apex, t: hit.res.t });
      }
      return list;
    };
    let x0 = T.x, y0 = Math.max(0.6, T.y + (RAISE[height] || 0));
    const base = YY.solveSpeed(x0, y0, -1, T.ang, d + x0, env), std = fly(x0, y0, base, T.ang);
    const rise = Math.max(0.6, std.apex - Math.min(y0, 1.2));
    const aim = std.apex + rise * ({ low: -0.4, mid: 0, high: 0.45 }[height] || 0), aimT = std.t * ({ slow: 1.3, mid: 1, fast: 0.74 }[speed] || 1);
    const cost = c => ((c.apex - aim) / Math.max(0.45, rise * 0.35)) ** 2 + ((c.t - aimT) / Math.max(0.12, std.t * 0.22)) ** 2;
    // 先在球路常用角度里找；找不到再放宽角度、恢复标准出球高度、把发球机后撤一米
    const tries = [[x0, y0, Math.max(-50, T.ang - 45), Math.min(80, T.ang + 35)], [x0, y0, -50, 80], [x0, Math.max(y0, T.y), -50, 80], [x0 + 1, Math.max(y0, T.y) + 0.3, -50, 80]];
    let pick = null;
    for (const [tx, ty, lo, hi] of tries) {
      const list = family(tx, ty, lo, hi, base).sort((a, b) => cost(a) - cost(b));
      pick = list.find(c => clean(tx, ty, c)); // 网带有厚度：取第一条真实模拟不挂网的弧线
      if (pick) { x0 = tx; y0 = ty; break; }
    }
    if (!pick) { // 兜底：沿用旧发球机的抬角逻辑
      let ang = T.ang, v = base;
      for (let i = 0; i < 14; i++, ang += 5) { v = YY.solveSpeed(x0, y0, -1, ang, d + x0, env); if (clean(x0, y0, { v, ang })) break; }
      pick = { v, ang };
    }
    const r = pick.ang * Math.PI / 180;
    return { x: x0, y: y0, vx: -Math.cos(r) * pick.v, vy: Math.sin(r) * pick.v, type, d };
  };

  class Training extends Practice {
    constructor(match, cfg) {
      super(match, { judge: 'receive', name: '训练场', tip: '发球机准备中…' });
      this.training = true; this.setCfg(cfg); this.wait = 1.4; this.idleReady = true;
    }
    setCfg(cfg) {
      this.cfg = YY.cleanTrain(cfg);
      const c = this.cfg, t = c.type === 'mix' ? '混合球路' : FEED_TYPES[c.type].name;
      this.def.name = '训练场 · ' + t;
      if (!c.hint) this.m.hint = null;
    }
    feed() {
      const m = this.m, s = m.shuttle, c = this.cfg;
      const type = c.type === 'mix' ? YY.pick(MIX) : c.type, T = FEED_TYPES[type];
      const [lo, hi] = c.depth === 'auto' ? T.depth : DEPTHS[c.depth];
      const half = m.halfOf ? m.halfOf(0) : C.HALF, d = clamp(rand(lo, hi), 0.35, half - 0.25);
      const f = YY.cachedFeed(type, d, c.height, c.speed, m.physEnv ? m.physEnv() : null);
      // 每一球都是新的一分：清掉上一球留下的技能状态（发球前技能在等待时已生效，不受影响）
      Object.assign(s, { fire: false, feint: 0, meteor: false, crawl: false, hide: false, veil: 0, wobble: false, oppQ: 1, ctl: null, selfToss: -1, path: [], ver: (s.ver || 0) + 1 });
      m.slowT = 0;
      m.players[1].x = f.x;
      s.x = f.x; s.y = f.y; s.vx = f.vx; s.vy = f.vy;
      s.live = true; s.held = false; s.netHit = false; s.crossedNet = false; s.lastHitter = 1; s.shot = 'feed'; s.isServe = false;
      s.speed = Math.hypot(f.vx, f.vy);
      m.phase = 'rally'; m.hitCount++;
      m.pred = YY.simulate(s.x, s.y, s.vx, s.vy, 6, true, false, m.physEnv ? m.physEnv() : null); m.pred.t0 = m.time;
      m.players[1].flash = 0.2;
      m.emit({ type: 'hit', p: 1, shot: 'feed', name: '发球机', q: 1, label: '', speed: s.speed, x: s.x, y: s.y, feed: true });
      this.lastKind = type; this.playerHit = null; this.fed = true; this.hint = null; this.hintLock = false; this.idleReady = false;
      this.msg = `${T.name} · ${Math.round(s.speed * 3.6 * C.SPEED_DISPLAY)} km/h · 落点离网 ${f.d.toFixed(1)} 米`; this.msgColor = '#9fdcff';
    }
    evaluate(e) {
      const att = this.att; super.evaluate(e);
      if (this.att !== att) this.wait = GAPS[this.cfg.gap] || 1.2;
      if (this.att !== att && !this.playerHit) this.msg = '没接到 · ' + (FEED_TYPES[this.lastKind]?.name || '') + ' — 跟着黄色落点提前移动';
    }
    update(dt) {
      const m = this.m, p = m.players[0], c = this.cfg;
      if (c.freeEnergy && m.skillsOn) p.energy = 100;
      if (c.freeStamina) p.stamina = C.STAM_MAX;
      // 一球结束回到等待：重置回合规则与装置，像比赛里的新一分
      if (m.phase === 'idle' && !this.idleReady) { this.idleReady = true; if (m.skReset) m.skReset(false); }
      if (c.hint) super.update(dt);
      else { if ((m.phase === 'idle' || m.phase === 'serve') && !this.done) { this.wait -= dt; if (this.wait <= 0) this.feed(); } m.hint = null; }
    }
  }
  YY.Training = Training;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof window !== 'undefined' ? window : globalThis);
