/* 羽跃对决 · AI 与击球点求解（练习提示共用）
 * AI 与玩家的移动速度、跳跃、体力完全一致；难度只影响反应、判断误差、回位与球路选择。
 */
(function (G) {
  'use strict';
  const YY = G.YY;
  const C = YY.C;
  const { clamp, gauss, rand } = YY;

  const JUMP_LEAD = 0.38; // 起跳到击球的时间
  const jumpH = (t, k) => C.JUMP_V * (k || 1) * t - 0.5 * C.G * t * t;

  /** 在给定肩高下，使球处于甜区圆环上所需的站位（相对球的水平偏移） */
  function standFor(px, py, dir, shoulderY) {
    const dy = clamp(py - shoulderY, -0.8, 0.82);
    const h = Math.sqrt(Math.max(0, C.ARM * C.ARM - dy * dy));
    return px - dir * Math.max(h, 0.15);
  }
  const travel = (dist, mv) => (dist < 0.08 ? 0 : dist / (C.MOVE * (mv || 1)) + 0.12);

  /**
   * 为选手 idx 寻找来球的可击球点。
   * prefs: 允许的击球段，按优先级 ['smash','over','low']
   * 返回 {band, standX, tContact(绝对时间), jumpAt, y}
   */
  YY.findContact = function (match, idx, prefs, extraErr) {
    const p = match.players[idx];
    const s = match.shuttle;
    if (!s.live || s.netHit) return null;
    const sim = YY.simulate(s.x, s.y, s.vx, s.vy, 5, true, s.netHit, match.physEnv ? match.physEnv() : match.env);
    const now = match.time;
    const side = p.side, dir = p.dir;
    const st = p.st || {};
    const rt = (t) => (match.realT ? match.realT(t) : t); // 缓时技能：换算真实时间
    const jv = match.jumpVelocity ? match.jumpVelocity(p) : C.JUMP_V * (st.jump || 1);
    // 疲劳会降低移动速度：判断能否赶到击球点时按当前体能计算
    const mvK = match.maxSpeed ? match.maxSpeed(p) / C.MOVE : st.move || 1;
    const jh = jv * JUMP_LEAD - 0.5 * C.G * JUMP_LEAD * JUMP_LEAD;
    const bands = {
      smash: { lo: 2.85 + (jh - jumpH(JUMP_LEAD)), hi: 3.3 + (jh - jumpH(JUMP_LEAD)), ideal: 3.08 + (jh - jumpH(JUMP_LEAD)), sh: C.SHOULDER + jh, lead: JUMP_LEAD },
      over: { lo: 1.85, hi: 2.3, ideal: 2.15, sh: C.SHOULDER, lead: 0.04 },
      low: { lo: 0.32, hi: 1.85, ideal: 99, sh: C.SHOULDER, lead: 0.04 },
    };
    for (const name of prefs) {
      if (name === 'smash' && match.costMul && p.stamina <
          C.JUMP_COST * match.costMul(p, true) + C.SMASH_COST * match.costMul(p, false)) continue;
      const b = bands[name];
      let best = null, bestScore = 1e9;
      for (const pt of sim.pts) {
        if (pt.t < 0.05) continue;
        const dd = side * pt.x;
        if (dd < 0.3 || dd > C.X_FAR + 0.6) continue;
        if (pt.y < b.lo || pt.y > b.hi) continue;
        const sx = standFor(pt.x, pt.y, dir, b.sh);
        const sd = clamp(side * sx, C.X_NEAR, C.X_FAR);
        if (Math.abs(sd - side * sx) > 0.35) continue;
        const need = travel(Math.abs(side * sd - p.x), mvK) + b.lead;
        if (need > rt(pt.t)) continue;
        // 高段选最接近理想高度；低段选最早（最高）可达点
        const score = b.ideal < 50 ? Math.abs(pt.y - b.ideal) : pt.t;
        if (score < bestScore) { bestScore = score; best = { pt, sx: side * sd }; }
      }
      if (best) {
        const tC = now + rt(best.pt.t);
        return {
          band: name, standX: best.sx + (extraErr || 0), tContact: tC,
          jumpAt: name === 'smash' ? tC - JUMP_LEAD : null, y: best.pt.y, x: best.pt.x,
          landX: sim.landX, landT: now + rt(sim.t),
        };
      }
    }
    return { band: 'none', standX: clamp(side * sim.landX, C.X_NEAR, C.X_FAR) * side, tContact: now + rt(sim.t), jumpAt: null, landX: sim.landX, landT: now + rt(sim.t) };
  };

  const LEVELS = {
    // brain：战术大脑（打空当、反跑、调动体能、球路变化、发球针对）的使用概率
    easy: { react: 0.36, err: 0.75, timing: 0.055, recover: 0.6, recDelay: 0.3, smash: 0.15, tactical: 0.3, read: 0, judgeOut: 0.45, serveQ: 0.5, longServe: 0.7, brain: 0, name: '简单' },
    normal: { react: 0.25, err: 0.5, timing: 0.036, recover: 0.85, recDelay: 0.16, smash: 0.62, tactical: 0.65, read: 0.45, judgeOut: 0.8, serveQ: 0.72, longServe: 0.55, brain: 0.2, name: '普通' },
    boss: { react: 0.2, err: 0.36, timing: 0.027, recover: 0.93, recDelay: 0.1, smash: 0.75, tactical: 0.8, read: 0.65, judgeOut: 0.88, serveQ: 0.8, longServe: 0.5, brain: 0.45, name: '强敌' },
    hard: { react: 0.15, err: 0.24, timing: 0.018, recover: 1, recDelay: 0.05, smash: 0.88, tactical: 0.9, read: 0.85, judgeOut: 0.95, serveQ: 0.88, longServe: 0.45, brain: 0.6, name: '困难' },
    // 噩梦：反应与手感接近极限，几乎每拍都在算你的站位、移动方向和体能
    nightmare: { react: 0.1, err: 0.13, timing: 0.011, recover: 1, recDelay: 0.02, smash: 0.9, tactical: 0.98, read: 1, judgeOut: 0.99, serveQ: 0.94, longServe: 0.4, brain: 1, name: '噩梦' },
  };
  YY.AI_LEVELS = LEVELS;
  // 决策频率、空间误差、连招与资金管理分档；不改变能量、冷却或球员速度。
  const SKILL_LEVELS = YY.AI_SKILL_LEVELS = {
    easy: { interval:.34, precision:.32, chance:.48, combo:0, reserve:0 },
    normal: { interval:.20, precision:.18, chance:.72, combo:1, reserve:12 },
    boss: { interval:.15, precision:.12, chance:.84, combo:2, reserve:16 },
    hard: { interval:.10, precision:.07, chance:.93, combo:2, reserve:20 },
    nightmare: { interval:.065, precision:.035, chance:1, combo:3, reserve:24 },
  };

  // Personalities change choices and positioning, never the player's physics.
  // Every strength leaves a readable opening; difficulty still controls execution.
  const STYLES = YY.AI_STYLES = {
    lingfeng: { name: '均衡变奏', tip: '高远与吊球交替，抓半场球进攻', weakness: '用连续变速打乱他的回位', clear: 1.1, drop: 1, smash: 1, jump: 1, home: 0, delay: 0, read: 1 },
    canglan: { name: '耐心拉锯', tip: '深高远过渡，体力充足才进攻', weakness: '提前上网，抢他的保守过渡球', clear: 1.9, drop: .8, smash: .6, jump: .65, home: .35, delay: .04, read: .8, reserve: 55 },
    xiaohong: { name: '抢点强攻', tip: '抢高点连杀，主动前压', weakness: '接杀挡网，利用他重杀后的回位空当', clear: .65, drop: .75, smash: 2.6, jump: 1.35, home: -.15, delay: .25, read: .55 },
    ranran: { name: '网前牵制', tip: '偏爱轻吊与网前球，守在前场', weakness: '深高远压后场，再突然吊网前', clear: .7, drop: 2.8, smash: .35, jump: .35, home: -.65, delay: .07, read: .7 },
    ruibao: { name: '稳守反击', tip: '接杀稳住，多打高远等待失误', weakness: '连续前后调动，别只用蛮力扣杀', clear: 2, drop: 1.1, smash: .45, jump: .4, home: .25, delay: .1, read: .7, reserve: 50 },
    xingxing: { name: '追网抢攻', tip: '吊球后跟进，抢网前高球', weakness: '等她前压，再推挑到后场', clear: .8, drop: 2.1, smash: .85, jump: .65, home: -.45, delay: 0, read: .8 },
    dingding: { name: '快节奏调动', tip: '前后交替，偏爱平快球路', weakness: '高远拉长节奏，等他提前前压', clear: 1.3, drop: 1.4, smash: .7, jump: .75, home: -.15, delay: 0, read: .9 },
    lu: { name: '后场突袭', tip: '先高远稳住，再突然点杀', weakness: '贴网短球让他离开舒服的后场', clear: 1.5, drop: .65, smash: 1.5, jump: .8, home: .6, delay: .14, read: .65 },
    tianchu: { name: '虚实变换', tip: '避免重复球路，抓站位变化', weakness: '用深球限制选择，保持回位耐心', clear: 1.1, drop: 1.5, smash: 1.2, jump: 1, home: 0, delay: .06, read: 1.05 },
    houzi: { name: '腾空反打', tip: '守住中场，靠手快把快球挡回去', weakness: '多打深远高球，逼他挪动大肚子', clear: 1.2, drop: 1.2, smash: .7, jump: .45, home: .15, delay: .12, read: .9 },
    laochen: { name: '数据控球', tip: '记录你的落点，球路稳定少失误', weakness: '突然加力：他的回球偏轻，压不住重杀', clear: 1.4, drop: 1.4, smash: .45, jump: .7, home: 0, delay: .02, read: 1.15 },
    guoge: { name: '投机爆发', tip: '平时省力过渡，看到机会球就全力重扣', weakness: '多拉几个长回合，他的体能先撑不住', clear: 1.4, drop: .7, smash: 1.9, jump: 1.1, home: .3, delay: .2, read: .6, reserve: 45 },
    zhu: { name: '读球控场', tip: '观察重复球路，提前守住落点', weakness: '打破连续同类球，突然改变前后节奏', clear: 1.5, drop: 1.6, smash: .45, jump: .35, home: 0, delay: .08, read: 1.25 },
  };

  class AI {
    constructor(match, idx, level, character) {
      this.m = match;
      this.i = idx;
      this.L = LEVELS[level] || LEVELS.normal;
      this.SL = SKILL_LEVELS[level] || SKILL_LEVELS.normal;
      this.character = character || 'lingfeng';
      this.style = STYLES[this.character] || STYLES.lingfeng;
      this.seenHit = -1;
      this.plan = null;
      this.homeD = 3.1;
      this.homeAt = 0;
      this.serveWait = rand(0.7, 1.4);
      this.serveBtn = null;
      this.lastServeT = -1;
    }
    get p() { return this.m.players[this.i]; }

    press(btn, aim) { this.m.inputs[this.i].presses.push(aim == null ? { btn } : { btn, aim }); }

    moveTo(x, tol) {
      const p = this.p;
      const dx = x - p.x;
      const t = tol || 0.06;
      const inp = this.m.inputs[this.i];
      if (Math.abs(dx) < t) inp.move = 0;
      else inp.move = clamp((dx * p.dir) / 0.35, -1, 1);
      // 标志桶挡在要去的方向上：跳过去
      const cone = this.m.ents && this.m.ents.find(e => e.k === 'cone' && e.o !== this.i);
      if (cone && p.onGround && inp.move && Math.abs(p.x - cone.x) < 0.55 && Math.sign((cone.x - p.x) * p.dir) === Math.sign(inp.move) && Math.abs(x - p.x) > Math.abs(cone.x - p.x)) this.press('jump');
    }

    update(dt) {
      const m = this.m, p = this.p, s = m.shuttle, L = this.L;
      const inp = m.inputs[this.i];
      this.motionQueued = false;
      if (m.phase === 'serve') {
        this.plan = null;
        if (m.skillsOn && p.kit && !m.serving) this.thinkPre();
        if (m.server === this.i) {
          inp.move = 0;
          if (m.serving) return;
          if (m.serveT < this.lastServeT) this.serveWait = rand(0.7, 1.4);
          this.lastServeT = m.serveT;
          if (m.serveT < this.serveWait) return;
          if (!this.serveBtn) {
            const o = m.players[1 - this.i], od = Math.abs(o.x);
            // 战术发球：接发站得靠后就发网前，压得靠前就发后场
            if (Math.random() < L.brain * 0.8) this.serveBtn = od > 3.05 ? 'drop' : od < 2.6 ? 'clear' : Math.random() < 0.5 ? 'clear' : 'drop';
            else this.serveBtn = Math.random() < clamp(L.longServe + this.style.home * .3, .15, .85) ? 'clear' : 'drop';
          }
          const q = 1 - Math.abs(m.serveMeter() - 0.5) * 2;
          if (q >= L.serveQ - Math.random() * 0.08) { this.press(this.serveBtn); this.serveBtn = null; }
        } else this.moveTo(p.side * 2.9);
        return;
      }
      if (m.phase !== 'rally') { this.moveTo(p.side * 3); return; }

      const toss = s.selfToss === this.i;
      if (m.hitCount !== this.seenHit) {
        if (s.live && s.lastHitter !== this.i && m.pred) (this.oppZones = (this.oppZones || []).slice(-3)).push(p.side * m.pred.landX < 3.35);
        this.seenHit = m.hitCount;
        this.plan = null;
        if (s.lastHitter !== this.i || toss) {
          this.reactAt = m.time + (toss ? 0.02 : L.react * rand(0.8, 1.25));
          this.err = toss ? 0 : gauss() * L.err;
          if (s.shot === 'tumble') this.reactAt += 0.05;
          if (m.entsOf('shadow').some(e => e.o !== this.i)) this.reactAt += 0.05; // 残影晃了一下
          this.resid = gauss() * L.err * (0.3 + Math.min(1, s.speed / 18) * 0.5);
          // 体能管理：聪明的对手只在体力富余、或对手已失位时才起跳重杀
          const o = m.players[1 - this.i], open = o.slow > 0 || !o.onGround || Math.abs(o.x) < 2.6 || o.stamina < 30;
          const reserve = Math.max(this.style.reserve || 0, L.brain * (open ? 22 : 48));
          this.wantSmash = toss || (Math.random() < clamp(L.smash * this.style.jump, 0, .95) && p.stamina >= reserve);
        } else this.setHome();
      }

      const incoming = s.live && !s.netHit && (s.lastHitter !== this.i || toss);
      if (s.live && s.ctl) { // 球被挂网 / 绕月 / 冻住 / 丝带牵着 / 倒流：先到附近等（丝带牵着的球靠再按甩出，不挥拍）
        if (m.skillsOn && p.kit) this.thinkSkill(false);
        const c = s.ctl;
        if (c.k === 'cradle' && c.o === this.i) { this.moveTo(p.side * this.homeD, 0.15); return; } // 持球：边走边看站位
        if (c.k === 'relay' && c.o === this.i) { if (c.to !== 'clone') this.moveTo(c.P[2][0] - p.dir * 0.55, 0.08); else inp.move = 0; return; } // 接力：站到落点下面等球
        if (!(c.o === this.i && c.k === 'orbit')) this.moveTo(p.side * clamp(Math.abs(s.x) + (c.k === 'stick' ? 1.0 : 0.6), 1.0, 4.5), 0.1);
        return;
      }
      if (p.fooled && !incoming) { // 假回球：被骗着往假球的落点挪了几步
        p.fooled = false;
        const f = m.ents.find(e => e.k === 'fake' && e.o !== this.i);
        if (f && Math.random() < 0.45 - this.L.read * 0.3) this.fakeChase = { x: p.side * clamp(p.side * (p.x + (f.vx * p.side > 0 ? 1.2 : -1.2)), 1, 5.5), until: m.time + 0.45 };
      }
      // 记下对手最近几拍落在前场还是后场（押题用）
      if (m.hitCount !== this.seenHit) { this.seenHit = m.hitCount; if (s.live && s.lastHitter !== this.i && m.pred) (this.oppZones = (this.oppZones || []).slice(-3)).push(p.side * m.pred.landX < 3.35); }
      if (m.skillsOn && p.kit && p.kit.act.length) this.thinkSkill(incoming);
      if (this.dirtyBait(incoming)) return;
      if (this.motionQueued) { this.plan = null; return; }
      if (p.cnt.vine) { this.plan = null; return; }
      if (p.cnt.cloud || (p.cnt.fling != null && !p.onGround)) { this.airShot(incoming); return; }
      // 机械回收：收招那一下往回带一步，把球拍收回来（不是每次都想得起来）
      const rc = p.cnt.recall;
      if (rc && !rc.done && this.recallSeen !== rc) { this.recallSeen = rc; this.recallTry = Math.random() < 0.45 + L.tactical * 0.4; }
      if (rc && !rc.done && this.recallTry) { inp.move = -rc.ref; return; }
      // 长拍伸着、悠悠甩在外面：站定，别把拍头带偏
      const dv = m.entOf('pole', this.i) || m.entOf('yoyo', this.i);
      if (dv && dv.k === 'pole' && dv.ph < 2) { inp.move = 0; return; }
      if (!incoming) {
        if (this.fakeChase && m.time < this.fakeChase.until) this.moveTo(this.fakeChase.x, 0.1);
        else if (m.time >= this.homeAt) this.moveTo(p.side * this.homeD, 0.12 + L.brain * 0.13); // 回位后站稳：少挪碎步，回合中才能回气
        else inp.move = 0;
        return;
      }
      if (m.time < this.reactAt) {
        // 尚未判断出来球：维持惯性
        return;
      }
      if (p.fooled) { p.fooled = false; this.plan = null; this.reactAt = Math.max(this.reactAt || 0, m.time + this.L.react * 0.6); } // 水中月：被晃了一下
      if (p.replan) { p.replan = false; if (this.plan && !this.plan.swung) this.plan.replanAt = m.time; } // 闪现后按新位置重新规划
      const cur = this.plan;
      const commit = cur && !cur.leave ? (cur.band === 'smash' ? cur.jumpAt : cur.swingAt) : 1e9;
      if (!cur || (m.time >= cur.replanAt && m.time < commit - 0.22)) this.makePlan();
      const pl = this.plan;
      if (!pl) return;
      if (pl.leave) { this.moveTo(p.side * this.homeD, 0.2); return; }
      this.moveTo(pl.standX, 0.05);
      if (pl.band === 'smash' && !pl.jumped && pl.jumpAt != null && m.time >= pl.jumpAt + pl.jumpErr) {
        if (p.onGround) this.press('jump');
        pl.jumped = true;
      }
      if (!pl.swung && m.time >= pl.swingAt) {
        pl.swung = true;
        this.shotMod = 0;
        const btn = this.decideShot(pl);
        // Only bias a shot when already in position; do not abandon a chase.
        if (Math.abs(pl.standX - p.x) < .12 && this.character === 'dingding' && btn === 'clear') this.shotMod = .6;
        if (this.shotMod && Math.abs(pl.standX - p.x) < .2) { pl.modUntil = m.time + C.SW_W1; pl.mod = this.shotMod; }
        this.press(btn);
      }
      // 击球瞬间的方向键：向网 = 平高 / 劈吊 / 杀短；向后 = 杀深
      if (pl.modUntil > m.time && Math.abs(pl.standX - p.x) < .5) inp.move = pl.mod;
    }

    /** 脏数据球：看上去和真球一样，读球差的对手会被它骗去挪步、挥拍（每只球每一段只上一次当） */
    dirtyBait(incoming) {
      const m = this.m, p = this.p, s = m.shuttle, d = m.ents && m.ents.find(e => e.k === 'dirty' && e.o !== this.i && p.side * e.x > 0.2 && e.vx * p.side > -0.5);
      if (!d) return false;
      const key = d.id + ':' + d.n, memo = this.dirtyMemo || (this.dirtyMemo = {});
      if (memo.k !== key) { memo.k = key; memo.bite = Math.random() < clamp(0.6 - this.L.read * 0.4, 0.12, 0.6); }
      if (!memo.bite) return false;
      const pl = this.plan;
      if (incoming && pl && !pl.swung && pl.swingAt - m.time < 0.45) return false; // 真球马上到：顾不上
      const gap = Math.hypot(d.x - (p.x + p.dir * 0.6), d.y - (p.y + C.SHOULDER));
      if (!incoming || !pl) this.moveTo(p.side * clamp(p.side * (d.lx ?? d.x) + 0.6, 0.8, m.halfOf(this.i)), 0.1);
      if (gap < 0.75 && d.vy < 0.5 && !p.swing && p.cooldown <= 0) { memo.bite = false; this.press(d.y > 2.2 ? 'smash' : d.y > 1.3 ? 'clear' : 'drop'); }
      return !incoming;
    }

    // 特殊腾空不能沿用从地面起跳的计划；预测挥拍甜点时刻的实际肩高。
    airShot(incoming) {
      const m = this.m, p = this.p, s = m.shuttle, cl = p.cnt.cloud;
      this.plan = null;
      if (!incoming || s.ctl || p.swing || p.cooldown > 0 || m.time < this.reactAt) return;
      const t = C.SW_SWEET, pr = YY.simulate(s.x, s.y, s.vx, s.vy, t + .03, true, s.netHit, m.physEnv());
      const k = pr.pts.reduce((a,b)=>Math.abs(b.t-t)<Math.abs(a.t-t)?b:a);
      let x = p.x + p.vx * t, y = Math.max(0, p.y + p.vy*t - .5*C.G*t*t);
      if (cl) { const d=Math.hypot(cl.tx-p.x,cl.ty-p.y), f=Math.min(1,11*t/(d||1)); x=p.x+(cl.tx-p.x)*f; y=p.y+(cl.ty-p.y)*f; }
      else this.moveTo(k.x-p.dir*.65,.12);
      const gap=Math.hypot(k.x-x-p.dir*.65,k.y-y-C.SHOULDER-.35);
      if (gap < .6 && p.side*k.x > .1) this.press(k.y >= C.SMASH_MIN_Y && p.stamina > 18 ? 'smash' : 'clear');
    }

    makePlan() {
      const m = this.m, p = this.p, L = this.L;
      const old = this.plan;
      if (old) this.err = this.err * 0.5 + this.resid * 0.5;
      const canSmash = this.wantSmash && p.stamina >= C.JUMP_COST * m.costMul(p, true) + C.SMASH_COST * m.costMul(p, false);
      let prefs = canSmash ? ['smash', 'over', 'low'] : ['over', 'low'];
      if (old && old.band && old.band !== 'none') prefs = prefs.slice(Math.max(0, prefs.indexOf(old.band)));
      const c = YY.findContact(m, this.i, prefs, this.err);
      if (!c) { this.plan = null; return; }
      // 判断出界：明显出界则放球
      const out = Math.abs(c.landX) > (m.halfOf ? m.halfOf(this.i) : C.HALF) + 0.25 && Math.sign(c.landX) === p.side;
      if (out && (old ? old.leave : Math.random() < L.judgeOut)) {
        this.plan = { leave: true, replanAt: m.time + 0.3 };
        return;
      }
      const swingAt = c.tContact - C.SW_SWEET + gauss() * L.timing;
      this.plan = {
        band: c.band, standX: c.standX, tContact: c.tContact, y: c.y, x: c.x,
        jumpAt: c.jumpAt, jumpErr: gauss() * L.timing * 0.6,
        swingAt: old && old.swung ? old.swingAt : swingAt,
        swung: old ? old.swung : false,
        jumped: old ? old.jumped : false,
        replanAt: m.time + 0.16,
      };
      if (c.band === 'none') this.plan.swingAt = c.tContact - 0.2;
    }

    decideShot(pl) {
      const smart = Math.random() < this.L.brain ? this.brainShot(pl) : null;
      if (smart) return smart;
      return this.basicShot(pl);
    }

    /**
     * 战术大脑：根据对手站位、移动方向、是否失去平衡、双方体能决定球路。
     * 返回按键（可同时设定 this.shotMod 改变球路细节）；没有明确机会时返回 null，交给常规判断。
     */
    brainShot(pl) {
      const m = this.m, p = this.p, L = this.L, o = m.players[1 - this.i];
      if (m.sk && m.sk.netUp > 0.2) return 'clear';
      if (m.ents && m.ents.length) return null; // 场上有技能装置：交给原有的针对逻辑
      const oD = Math.abs(o.x), oV = o.vx * o.dir; // oV > 0：对手正在向网前移动
      const h = pl.y != null ? pl.y : m.shuttle.y, myD = Math.abs(pl.x != null ? pl.x : p.x);
      const myTired = p.stamina < 35, oTired = o.stamina < 40;
      const offBalance = o.slow > 0 || !o.onGround || o.land > 0 || (o.swing && o.swing.t > C.SW_W1);
      const cost = C.SMASH_COST * m.costMul(p, false);
      const canKill = h >= 1.78 && myD < 1.9 && p.stamina >= cost * 0.35;
      // 1) 网前高球：直接扑死
      if (canKill) return 'smash';
      // 2) 起跳点：对手失位或站位靠前就重杀，并朝空当（远离对手的一侧）压
      if (pl.band === 'smash' && !p.onGround) {
        if (p.stamina >= cost && (offBalance || oD < 3.4 || oTired || Math.random() < 0.55)) {
          this.shotMod = oD < 3.4 ? -0.8 : 0.8; return 'smash';
        }
        this.shotMod = oD > 4 ? 0.7 : 0; return oD > 4 ? 'drop' : 'clear';
      }
      // 3) 反跑：对手正往前冲就打他身后，往后退就吊网前
      if (Math.abs(oV) > 1.6) {
        if (oV > 0) { if (h >= 1.7) this.shotMod = oD < 2.6 ? 0.7 : 0; return 'clear'; }
        if (h >= 1.7) this.shotMod = 0.7; return 'drop';
      }
      // 4) 自己体能吃紧：打又高又深的高远，给自己站稳回气的时间
      if (myTired && h >= 1.0) { this.shotMod = 0; return 'clear'; }
      // 5) 高点但没起跳：对手靠后就劈吊 / 点杀，靠前就平高压底线
      if (pl.band === 'over') {
        if (oD > 4.3) { if (p.stamina >= cost * 0.35 && Math.random() < 0.4) { this.shotMod = -0.7; return 'smash'; } this.shotMod = 0.7; return 'drop'; }
        if (oD < 2.7) { this.shotMod = 0.7; return 'clear'; }
        if (offBalance && p.stamina >= cost * 0.35) return 'smash';
      }
      // 6) 对手体能告急：前后对角调动，逼他折返跑
      if (oTired || L.brain >= 1) {
        const last = m.history[this.i][m.history[this.i].length - 1];
        if (oD > 3.6 || last === 'clear') { if (h >= 1.7) this.shotMod = 0.7; return 'drop'; }
        return 'clear';
      }
      // 7) 低手球：对手压在网前就推/挑后场，退在后场就放网
      if (pl.band === 'low') {
        if (myD < 2.4 && h >= 1.1 && oD < 3) { this.shotMod = 0.7; return 'clear'; } // 推后场
        return oD > 3.4 ? 'drop' : 'clear';
      }
      return null;
    }

    basicShot(pl) {
      const m = this.m, p = this.p, L = this.L;
      const opp = m.players[1 - this.i];
      const oppD = Math.abs(opp.x);
      const d = Math.abs(pl.x != null ? pl.x : p.x);
      const myLast = m.history[this.i].slice(-2);
      let w;
      const tactical = Math.random() < L.tactical;
      // 应对技能装置：防火墙升起就挑高越墙；对面立着反射板时少打平快的杀球
      if (m.sk && m.sk.netUp > 0.2 && Math.random() < 0.55 + L.read * 0.45) return 'clear';
      const board = m.ents && m.ents.some(e => e.k === 'board' && e.o !== this.i) && Math.random() < 0.5 + L.read * 0.4;
      if (pl.band === 'smash' && board) return Math.random() < 0.5 ? 'clear' : 'drop';
      if (pl.band === 'smash') {
        if (p.stamina >= C.SMASH_COST * m.costMul(p, false) && !p.onGround) return 'smash';
        w = { clear: 1, drop: 1 };
      } else if (pl.band === 'over') {
        if (tactical) {
          if (oppD > 4.3) w = { drop: 3, clear: 0.8, smash: 0.4 };
          else if (oppD < 2.6) w = { clear: 3, drop: 0.4, smash: 0.6 };
          else w = { clear: 1.5, drop: 1.4, smash: 0.7 };
        } else w = { clear: 0.55, drop: 0.3, smash: 0.15 };
      } else {
        const nearNet = Math.abs(p.x) < 2.3;
        if (tactical) {
          if (nearNet) w = oppD > 3.6 ? { drop: 3, clear: 1 } : { clear: 3, drop: 0.6 };
          else w = { clear: 3, drop: oppD > 4.3 ? 1.2 : 0.4 };
        } else w = { clear: 0.65, drop: 0.35 };
      }
      const style = this.style;
      for (const key of ['clear', 'drop', 'smash']) if (w[key]) w[key] *= style[key];
      // A net specialist converts a loose high net ball instead of lifting it.
      if (d < 1.9 && pl.y >= 1.78 && p.stamina >= C.SMASH_COST * m.costMul(p, false) * .35) {
        w.smash = (w.smash || .2) + (this.character === 'xingxing' ? 4 : 1.2);
      }
      if (p.stamina < (style.reserve || 30)) { w.clear *= 2; w.smash = (w.smash || 0) * .2; }
      // Movement specialists alternate depth; the feint player avoids repetition.
      if (['dingding', 'tianchu'].includes(this.character) && myLast.length) {
        const last = myLast[myLast.length - 1];
        if (last === 'clear') w.drop *= 1.8;
        if (last === 'drop') w.clear *= 1.8;
      }
      // 高手会避免连续同一球路
      if (L.read > 0.5 && myLast.length === 2 && myLast[0] === myLast[1]) {
        const k = myLast[0] === 'clear' ? 'clear' : myLast[0] === 'drop' ? 'drop' : null;
        if (k && w[k]) w[k] *= 0.35;
      }
      if (board && w.smash) w.smash *= 0.15;
      // 对面网前蹲着小猴：少放网前，多挑高；中场小猴：少打平快的杀球
      const mini = m.ents && m.ents.find(e => e.k === 'mini' && e.o !== this.i && !e.used);
      if (mini && Math.random() < 0.45 + L.read * 0.45) { if (mini.mid) { if (w.smash) w.smash *= 0.2; } else { if (w.drop) w.drop *= 0.15; w.clear = (w.clear || 0.5) * 1.3; w.smash = (w.smash || 0) * 1.5; } }
      return YY.pick(w);
    }

    /** 按技能 id 找到对应的按键并发动（aim：+1 向网 / -1 向后） */
    castId(id, aim) {
      const p = this.p, slot = p.kit ? p.kit.act.indexOf(id) : -1;
      if (slot < 0 || p.skillCd > 0) return false;
      this.press(slot ? 'skill2' : 'skill', aim);
      if (['dangteng','jindou','huiguo','zipao','meida'].includes(id)) this.motionQueued = true;
      this.lastSkill = id;
      if (this.storySkillInterval) this.storySkillAt = this.m.time + this.storySkillInterval;
      this.skillWait = null;
      return true;
    }
    /** 发球前押注：先保留下一分的基本流动资金，不在负债时盲目加注。 */
    thinkPre() {
      const m = this.m, p = this.p, o = m.players[1 - this.i];
      if (this.storySkillInterval && m.time < (this.storySkillAt ?? this.storySkillInterval)) return;
      if (this.preDone === m.score.join()) return;
      this.preDone = m.score.join();
      if (Math.random() > 0.35 + this.L.tactical * 0.3) return;
      const slot = p.kit.act.indexOf('ganggan');
      if (slot >= 0 && p.market?.coins >= 240 && !p.market.bet && m.canUse(p,slot) && !m.castCheck(p,'ganggan') && (p.stamina >= 60 || p.stamina > o.stamina)) this.castId('ganggan');
    }

    /** 何时发动技能：先处理正在进行中的第二段，再按每个技能的使用时机判断 */
    thinkSkill(incoming) {
      const m = this.m, p = this.p, s = m.shuttle, pl = this.plan, o = m.players[1 - this.i], b = p.buff, c = s.ctl;
      const has = (id) => p.kit.act.includes(id);
      const gateFirst = c && c.k === 'orbit' && c.t > .65 && this.SL.combo && has('xingmen') && !b.xingmen && m.canUse(p, p.kit.act.indexOf('xingmen'));
      if (c && c.o === this.i && c.k === 'orbit' && !gateFirst && p.skillCd <= 0 && has('yueliang') && m.orbitFling && m.time >= (this.orbitThinkAt || 0)) {
        this.orbitThinkAt = m.time + Math.max(.055, this.SL.interval * .65);
        const f = m.orbitFling(c), sim = YY.simulate(s.x, s.y, f.vx, f.vy, 3, false, false, m.physEnv()), land = o.side * sim.landX;
        const good = !sim.netHit && land > .4 && land < m.halfOf(o.idx) - .15;
        if (good && (f.turns >= (this.SL.combo ? 1.3 : .55) || c.t < 1.1) && (c.t<.2 || Math.random() < .5 + this.SL.combo * .2)) return this.castId('yueliang');
      }
      if (p.skillCd > 0 || m.time < (this.skillThinkAt || 0)) return;
      this.skillThinkAt = m.time + this.SL.interval;
      if (incoming && m.time < (this.reactAt || 0)) return;
      if (b.gravOn > 0) { // 重力翻转开着：飘过对手头顶再关掉让它落在身后；对手的重球飘高后关掉给自己留时间
        const on = m.time - (this.gravAt || 0), od = o.side * o.x, bx = o.side * s.x;
        const behind = s.live && s.grav && s.lastHitter === this.i && s.crossedNet && bx > od + 0.9 && bx < m.halfOf(o.idx) - 0.6;
        const settled = s.live && s.grav && s.lastHitter !== this.i && on > 0.6 && s.y > 3.6;
        if (p.energy < 16 || behind || settled || !s.live || !s.grav || on > 2.6) return this.castId('zhongli');
      }
      if (p.cnt.recall && this.SL.combo) {
        const e = m.ents.find(e => e.id === p.cnt.recall.e);
        if (p.cnt.recall.kind === 'spin') return this.castId('xuanpai');
        if (e && (e.used || !incoming)) return this.castId(e.k === 'pole' ? 'shensuo' : 'youyou');
      }
      // —— 第二段 / 回收 ——
      if (c && c.o === this.i) {
        if (c.k === 'tether' && c.t < 1.3) return this.castId('hongxian'); // 拉到拍前就自动甩向空当
        if (c.k === 'freeze' && s.lastHitter === this.i && o.swing && !o.swing.hit && Math.random() < .5) return this.castId('shuangji'); // 对手挥空的瞬间解冻
        if (c.k === 'orbit') {
          if (c.t > .65 && this.SL.combo && (!this.storySkillInterval || m.time >= (this.storySkillAt || 0)) && has('xingmen') && !b.xingmen && m.canUse(p,p.kit.act.indexOf('xingmen'))) return this.castId('xingmen',o.side*o.x < 3.3 ? -1 : 1);
        }
        // 回潮：倒流过网后，对手离球远就松手
        if (c.k === 'rewind' && o.side * s.x > 0.4 && (Math.abs(o.x - s.x) > 1.8 || Math.random() < 0.02)) return this.castId('huichao');
        // 停一下：看准对手站位再出手——他靠前就打底线，靠后就放网前
        if (c.k === 'cradle' && (c.t < 0.75 - this.L.tactical * 0.3 || Math.abs(o.vx) < 0.4 && c.t < 0.85)) {
          const od = o.side * o.x; this.press(od < 3.2 ? 'clear' : 'drop', od < 3.2 ? -1 : 1); return;
        }
      }
      if (p.cnt.cloud) return; // 特殊空中击球统一由 airShot 处理，避免同帧重复挥拍。
      // 荡藤：摆到最高点、离要去的地方不远就松手
      const vine = p.cnt.vine;
      if (vine) {
        const goal = this.vineGoal ?? (m.pred?.landX != null ? m.pred.landX-p.dir*.65 : p.side*(this.homeD||3));
        if (vine.age > .16 && Math.abs(p.x-goal)<1.5 || vine.age>.35 || b.vine<.4) return this.castId('dangteng', { x:clamp((goal-p.x)*p.dir/2,-.8,.8), y:.6 });
        return;
      }
      // 水中月：过网后挑个时机变轨
      if (m.entOf('ripple', this.i)) return this.castId('shuizhong', o.side*o.x > 3.2 ? 1 : -1);
      // 回锅再炒：对手已经在落点等好、或者压上来抢截，就趁他碰到之前收回来
      if (s.wok && s.wok.o === this.i && !s.wok.used && s.lastHitter === this.i && !c) {
        const gap = m.racketGap(o, s.x, s.y), lx = m.pred ? m.pred.landX : s.x;
        const ready = Math.abs(o.x - (lx - o.dir * 0.6)) < 0.8 || (o.side * o.x < 2.2 && o.side * lx > 3.2);
        if (gap > 1.7 && gap < 3.4 && ready) return this.castId('huiguo');
      }
      // 超大肉包球：自己的球飞到对面开始下落、对手已经站定，就把吸收的动能放出去
      if (s.bun && s.bun.o === this.i && s.live) {
        if (incoming && this.SL.combo && has('diban') && !m.castCheck(p,'diban')) return this.castId('diban');
        const gap = m.racketGap(o, s.x, s.y);
        if (s.lastHitter === this.i && s.crossedNet && gap > 1.6 && (s.bun.st > 6 || s.bun.t < .6) && m.bunFling(p)) return this.castId('baozi');
      }
      // 伸缩长拍：拍头碰到球就出手
      const pole = m.entOf('pole', this.i);
      if (pole && pole.ph === 0 && (Math.hypot(pole.x - s.x, pole.y - s.y) < 0.45 || !incoming || (s.vy < 0 && s.y < pole.y - 0.8) || (s.x - p.x) * p.dir < -0.3)) return this.castId('shensuo'); // 碰到就打；球已经过去了就赶紧收
      // 悠悠球拍：球已经从拍头和人之间穿过去，就拉回来从背后捞
      const yo = m.entOf('yoyo', this.i);
      if (yo && yo.ph < 2 && incoming && !yo.used && (s.x - yo.x) * (s.x - p.x) < 0 && Math.abs(s.y - yo.y) < 0.8) return this.castId('youyou');
      const spin=m.entOf('spin',this.i);
      if(spin && this.SL.combo && (spin.used || !spin.swept && spin.age>.2 && m.racketGap(p,s.x,s.y)<1.8)) return this.castId('xuanpai',{x:(s.x-p.x)*p.dir,y:s.y-p.y-1.25});
      // —— 新发动 ——
      if (this.storySkillInterval && m.time < (this.storySkillAt ?? this.storySkillInterval)) return;
      if (p.energy < m.minCost(p)) return;
      if (this.skillWait == null) this.skillWait = m.time + this.SL.interval;
      if (m.time < this.skillWait) return;
      const afterHit = !incoming && s.live && s.lastHitter === this.i;
      const cat = YY.SHOT_CAT[s.shot];
      const once = (k, pr) => { // 每一拍只掷一次骰子，不按帧反复尝试
        const memo = this.onceMemo || (this.onceMemo = {});
        if (!memo[k] || memo[k].h !== m.hitCount) memo[k] = { h: m.hitCount, v: Math.random() < pr };
        return memo[k].v;
      };
      const lost = incoming && !s.ctl && m.time >= (this.reactAt || 0) + 0.05 && (!pl || pl.band === 'none') && p.side * s.x > -1;
      const close = (r) => Math.hypot(s.x - p.x, s.y - (p.y + 1.4)) < r;
      const pred = m.pred, land = pred ? pred.landX : 0, landMine = pred && p.side * land > 0.3 && p.side * land < m.halfOf(this.i) + 0.1;
      const want = {
        yuyue: () => incoming && p.onGround && landMine && s.y < 1.7 && s.vy < 0 && Math.abs(land - p.x) > 1.0 && Math.abs(land - p.x) < 3.2 && (lost || (pl && Math.abs(pl.standX - p.x) > 1.0 && pl.tContact - m.time < 0.5)), // 只在跑不到时才扑
        tafeng: () => incoming && !p.onGround && s.y > p.y + 2.5 && Math.abs(s.x - p.x) < 1.6,
        fengkou: () => incoming && landMine && p.side * land > m.halfOf(this.i) - 1.2,
        chaolai: () => (incoming && lost && landMine) || (afterHit && once('chaolai', .3)),
        tongyin: () => p.stamina < 40 && o.stamina > 65,
        huichao: () => incoming && s.crossedNet && p.side * s.x > 0.6 && (s.path || []).length > 40 && (lost || s.puddle && this.SL.combo || Math.random() < 0.01),
        pingyi: () => incoming && pl && (pl.band === 'smash' || s.selfToss === this.i) && once('pingyi', .5),
        fanshe: () => incoming && landMine && this.boardOpportunity(),
        zipao: () => incoming && !s.ctl && pl && pl.band !== 'smash' && pl.band !== 'none' && s.y < 1.7 && close(1.3) && p.stamina > 40 && p.onGround,
        tangqiu: () => afterHit && cat === 'drop' && Math.abs(s.x) > 0.8,
        hongxian: () => incoming && s.crossedNet && (lost || this.SL.combo && once('hongxian', .3)) && p.side * s.x > .3 && close(3.4),
        jiewang: () => (c && (c.k === 'stick' || (c.k === 'tether' && c.o === this.i))) || (afterHit && cat === 'drop' && !s.crossedNet),
        jindou: () => incoming && !s.ctl && s.vx * p.side > 0 && pred && pred.apex > 3.0 && landMine && p.side * land > 2.2 && (lost || pl?.band==='low' && pl.tContact-m.time>.65) && once('jindou', .65),
        // 路先森：站在前后场分界之外时留下复制体守住另一半；球到复制体身边就接力给本体；刚出手顺手注入脏数据
        fuzhi: () => !m.entOf('clone', this.i) && afterHit && m.time - (s.hitAt || 0) < 0.6 && Math.abs(p.side * p.x - 3.4) > 0.7 && once('fuzhi', .6),
        jieli: () => {
          if (s.ctl || !(incoming || s.selfToss === this.i)) return false;
          const r = YY.relayPlan(m, p, null); if (!r) return false;
          if (r.from === 'clone') return (lost || !pl || pl.band === 'none' || Math.abs(pl.standX - p.x) > 1.1) && once('jieli', .85);
          return !m.entOf('clone', this.i) && (lost ? close(1.6) : pl && pl.band === 'low' && close(1.2) && p.stamina > 35 && once('jieli', .35));
        },
        zangshu: () => afterHit && !s.crossedNet && m.time - (s.hitAt || 0) < 0.35 && once('zangshu', .6),
        diban: () => incoming && s.crossedNet && p.onGround && s.y > 0.5 && s.y < 2.2 && close(1.3) && pl && pl.band !== 'none' && pl.band !== 'smash' && (o.side * o.x < 2.2 || o.side * o.x > 3.8) && once('diban', 0.4), // 对手站位偏了才用
        huiguo: () => afterHit && !s.crossedNet && p.onGround && p.stamina>40 && (s.bun || cat === 'clear' || cat === 'drop') && pred && Math.abs(o.x-pred.landX)<1.8 && m.time-(s.hitAt||0)<.45 && once('huiguo',.5),
        baozi: () => !s.bun && ((incoming && s.crossedNet && lost && s.y > .8) || afterHit && !s.crossedNet && m.time - (s.hitAt || 0) < 0.3 && (s.speed > 12 || cat === 'clear') && once('baozi', 0.5)), // 救球，或包住自己的重球蓄力
        yueliang: () => incoming && landMine && !!this.moonAim(),
        xingmen: () => incoming && pl && pl.band !== 'none' && once('xingmen', .6),
        zhongli: () => !(b.gravOn > 0) && s.live && s.grav && !s.ctl && p.energy > 30 && (
          (incoming && s.vy < -2 && s.speed > 13 && s.y > 1.4) || // 对手的重球：翻转成飘球
          (afterHit && s.lastHitter === this.i && !s.crossedNet && o.side * o.x < 2.8 && m.time - (s.hitAt || 0) < 0.4)) && once('zhongli', .6) && (this.gravAt = m.time), // 自己的球：飘过网前的对手
        shensuo: () => incoming && (lost || this.SL.combo) && this.devReach('pole'),
        xuanpai: () => incoming && (lost || this.SL.combo) && this.devReach('spin'),
        youyou: () => incoming && (lost || this.SL.combo) && this.devReach('yoyo'),
        dangteng: () => incoming && p.onGround && landMine && p.stamina>25 && pl?.band!=='smash' && once('vine',.4) && this.vineOpportunity(),
        haomao: () => afterHit && !m.entOf('mini', this.i) && (p.stamina < 55 || Math.abs(p.x) > 3.5 || once('haomao', .4)),
        yati: () => afterHit && (cat === 'clear' || s.y > 2.6 || (this.oppZones || []).filter(z => !z).length >= 2) && once('yati', 0.5), // 送了高球、对手要进攻时
        yueqiu: () => afterHit && once('yueqiu', 0.4),
        shuangji: () => (incoming && lost && s.crossedNet) || (afterHit && cat === 'drop' && once('shuangji', 0.3)),
        // 果哥：有余钱、自己占优时押注；对手站稳在地上时撒红包；拿到能压的机会球前开金砖
        ganggan: () => !!p.market && !p.market.bet && afterHit && p.market.coins > 240 && o.stamina < 45 && once('ganggan', .45),
        jiepan: () => !!p.market && afterHit && o.onGround && p.market.coins >= (this.SL.combo ? 90 : 160) && once('jiepan', .45),
        qiquan: () => !!p.market && incoming && pl && (pl.band === 'smash' || s.y > 2.4 && s.crossedNet) && p.market.coins >= (this.SL.combo ? 80 : 150) && once('qiquan', .55),
        jingxiang: () => afterHit && Math.abs(s.x - s.hitX) < 2.2 && s.y > 1.2,
        meida: () => incoming && s.crossedNet && pl && pl.band !== 'smash' && pl.band !== 'none' && s.y < 2.2 && close(1.4) && p.stamina > 30 && p.onGround,
        shuizhong: () => afterHit && (cat === 'clear' || cat === 'drop'),
        jiezou: () => (incoming && pl && pl.band !== 'none' && once('jiezou', 0.35)) || (afterHit && once('jiezou2', 0.2)),
        biaozhi: () => afterHit && (cat === 'drop' || cat === 'clear') && o.onGround,
        tingyixia: () => incoming && s.crossedNet && pl && pl.band !== 'smash' && pl.band !== 'none' && close(1.5) && once('tingyixia', 0.5),
      };
      const zs = this.oppZones || [], front = zs.filter(Boolean).length * 2 > zs.length;
      const r3 = () => [1, 0, -1][Math.floor(Math.random() * 3)];
      const aims = { // 方向键：+1 向网 / -1 向后
        fengkou: {x:.75,y:.1},
        chaolai: cat === 'clear' ? -1 : 1, // 吊网前后涨潮把人冲回底线；打后场后退潮把人拖到网前
        dangteng: Math.sign((land - p.x) * p.dir), haomao: Math.random() < 0.5 ? -1 : 0,
        yati: p.side * p.x < 2.6 ? 1 : -1, yueqiu: front ? 1 : -1, jiewang: o.side * o.x < 2.6 ? -1 : 1, jingxiang: r3(), jiezou: r3(), biaozhi: cat === 'clear' ? -1 : 1,
        xingmen:o.side*o.x < 3.3 ? -1 : 1,
        jieli: p.stamina > 30 ? { x: .15, y: 1 } : { x: 1, y: .2 },
      };
      const opts = [];
      p.kit.act.forEach((id, slot) => {
        const def = YY.SKILLS[id];
        if (!def || !m.canUse(p, slot) || m.castCheck(p, id) || !want[id] || !want[id]()) return;
        const combo = (id==='diban' && s.bun) || (id==='huichao' && s.puddle) || (id==='pingyi' && s.selfToss===this.i) || (id==='zhongli' && m.entOf('moon',this.i)) || (['shensuo','youyou','xuanpai'].includes(id) && b.overclock > 0);
        const rescue = incoming && lost && ['yuyue','huichao','chaolai','baozi','shensuo','youyou','yueliang','hongxian','shuangji','jindou','dangteng'].includes(id);
        if (!rescue && !once('decision-'+id,this.SL.chance)) return;
        opts.push({ id, cost:def.cost || 100, score:(rescue ? 8 : 2) + (combo ? this.SL.combo*3 : 0) + (id === this.lastSkill ? 0 : 1), aim:this.skillAim(id,aims[id]) });
      });
      if (!opts.length) return;
      opts.sort((a,b)=>b.score-a.score);
      const pick = opts[0];
      if (this.SL.combo >= 2 && !lost && pick.score < 5 && p.energy-pick.cost < this.SL.reserve) return;
      // 攒能量：总是放同一个技能时，偶尔留着给另一个携带技能用
      const used = this.skillUse || (this.skillUse = {});
      const other = p.kit.act.find(id => id !== pick.id), oc = other && YY.SKILLS[other] ? YY.SKILLS[other].cost : 0;
      if (other && (used[pick.id] || 0) > (used[other] || 0) + 3 && p.energy - pick.cost < oc && Math.random() < 0.5) { this.skillWait = m.time + 0.8; return; }
      used[pick.id] = (used[pick.id] || 0) + 1;
      this.castId(pick.id, pick.aim);
    }

    /** 反射板：点按会自动放到来球路线上；路线够得着就值得放（已有板子时更爱连成线路） */
    boardOpportunity() {
      const m=this.m,p=this.p,t=m.skillTarget(p,'fanshe',{manual:false}),el=m.time-(m.pred?.t0 || 0);
      const onPath=!!m.pred?.pts?.some(k=>k.t>el+.25 && k.t<el+1.2 && Math.hypot(k.x-t.x,k.y-t.y)<.3);
      return onPath && (m.entsOf('board',this.i).length>0 || Math.random()<.6);
    }
    moonAim() {
      const m=this.m,p=this.p,el=m.time-(m.pred?.t0 || 0);
      for(const k of m.pred?.pts || []) {
        const dt=m.realT(k.t-el); if(dt<.14 || dt>1.1 || p.side*k.x<1 || k.y<.85 || k.y>5)continue;
        const x=(k.x-p.x)*p.dir,y=k.y-p.y-1.35;
        if(Math.hypot(x,y)<3.2) return {x:x/3.3,y:y/3.3};
      }
      return null;
    }
    skillAim(id, fallback) {
      const m=this.m,p=this.p,s=m.shuttle;
      let v=id==='yueliang'?this.moonAim():this.devAims?.[id];
      if(['fanshe','shuangji'].includes(id)) {
        const t=m.skillTarget(p,id,{manual:false}), range=id==='fanshe'?3.3:4.2;
        return {x:((t.x-p.x)*p.dir+gauss()*this.SL.precision)/range,y:(t.y-p.y-1.35+gauss()*this.SL.precision)/range};
      }
      if(['zipao','pingyi','hongxian','diban','baozi'].includes(id)) return undefined; // 与玩家点按相同的保底辅助，时机与连招仍按档位判断。
      if(v && typeof v==='object') {
        const a=Math.atan2(v.y,v.x)+gauss()*this.SL.precision,n=Math.hypot(v.x,v.y);
        return {x:Math.cos(a)*n,y:Math.sin(a)*n};
      }
      return v ?? fallback;
    }
    vineOpportunity() {
      const m=this.m,p=this.p,pr=m.pred;if(!pr?.pts)return false;
      const elapsed=m.time-(pr.t0??m.time);
      const k=pr.pts.find(k=>{const t=m.realT(k.t-elapsed),d=Math.abs(k.x-p.x);return t>.65&&t<1.25&&p.side*k.x>.5&&k.y>2.4&&k.y<4.5&&d>1.4&&d<3.6;});
      if(!k)return false;this.vineGoal=k.x-p.dir*.65;return true;
    }
    /** 用实际伸长速度和可选角度预测拦截；按档位加入空间误差。 */
    devReach(kind) {
      const m=this.m,p=this.p,pr=m.pred;
      if(!pr?.pts || m.shuttle.ctl)return false;
      const el=m.time-(pr.t0 ?? m.time);
      this.devAims=this.devAims || {};
      for(const k of pr.pts) {
        const dt=m.realT(k.t-el);if(dt<.08)continue;if(dt>1.1)break;
        if(p.side*k.x<.1 || k.y<.2)continue;
        const dx=(k.x-p.x)*p.dir-(kind==='pole'?.25:0),dy=k.y-p.y-(kind==='pole'?1.35:1.5),d=Math.hypot(dx,dy);
        if(d<.1)continue;
        if(kind==='spin') {if(dt<.6 && Math.abs(d-1.35)<.6){this.devAims.xuanpai=dx>0?1:-1;return true;}continue;}
        if(kind==='pole' && Math.abs(d-Math.min(p.buff.overclock>0?4.2:3.8,.45+9.5*dt))<.55){this.devAims.shensuo={x:dx/d,y:dy/d};return true;}
        if(kind==='yoyo' && d>1 && d<4.9 && d<.3+15*dt+.4){const r=clamp((d-1.6)/3.2,.12,1);this.devAims.youyou={x:dx/d*r,y:dy/d*r};return true;}
      }
      return false;
    }

    setHome() {
      const m = this.m, L = this.L, p = this.p;
      const shot = p.lastShot;
      let h = 3.1;
      const cat = YY.SHOT_CAT[shot];
      if (cat === 'clear') h = 3.35;
      else if (cat === 'drop') h = 2.6;
      else if (cat === 'smash') h = shot === 'kill' ? 2.3 : 2.75;
      h += this.style.home;
      if (this.character === 'xingxing' && cat === 'drop') h -= .35;
      // 读取对手习惯：对手连续两次同类球路 → 提前站位
      const oh = m.history[1 - this.i].slice(-2);
      if (oh.length === 2 && oh[0] === oh[1] && Math.random() < Math.min(.95, L.read * this.style.read)) {
        const t = oh[0];
        if (t === 'drop') h = 2.15;
        else if (t === 'clear') h = 4.2;
        else if (t === 'smash') h = 3.7;
        if (t === 'drop' || t === 'clear' || t === 'smash') m.emit({ type: 'read', p: this.i, cat: t });
      }
      // 战术大脑：按对手最近 4 拍的落点倾向预站位；自己累了就守中路少跑动
      if (Math.random() < L.brain) {
        const recent = m.history[1 - this.i].slice(-4), n = recent.length;
        if (n >= 3) {
          const front = recent.filter(c => c === 'drop').length / n, back = recent.filter(c => c === 'clear').length / n;
          h += (back - front) * 0.6;
        }
        if (p.stamina < 30) h = YY.lerp(h, 3.1, 0.6);
      }
      const market=m.players[1-this.i].market;
      if(market && market.tier>=4 && market.coins>0) h=YY.lerp(h,3.5,.35); // 对手装备好：退后一点防重杀
      h = YY.lerp(Math.abs(p.x), h, L.recover);
      this.homeD = clamp(h, 1.2, 5.5);
      this.homeAt = m.time + L.recDelay + (cat === 'smash' ? .2 + this.style.delay : this.style.delay * .3);
    }
  }

  YY.AI = AI;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof window !== 'undefined' ? window : globalThis);
