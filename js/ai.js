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
    const sim = YY.simulate(s.x, s.y, s.vx, s.vy, 5, true, s.netHit, match.env);
    const now = match.time;
    const side = p.side, dir = p.dir;
    const st = p.st || {};
    const rt = (t) => (match.realT ? match.realT(t) : t); // 缓时技能：换算真实时间
    const jv = match.jumpVelocity ? match.jumpVelocity(p) : C.JUMP_V * (st.jump || 1);
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
        const need = travel(Math.abs(side * sd - p.x), st.move) + b.lead;
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
    easy: { react: 0.36, err: 0.75, timing: 0.055, recover: 0.6, recDelay: 0.3, smash: 0.15, tactical: 0.3, read: 0, judgeOut: 0.45, serveQ: 0.5, longServe: 0.7, name: '简单' },
    normal: { react: 0.25, err: 0.5, timing: 0.036, recover: 0.85, recDelay: 0.16, smash: 0.62, tactical: 0.65, read: 0.45, judgeOut: 0.8, serveQ: 0.72, longServe: 0.55, name: '普通' },
    boss: { react: 0.2, err: 0.36, timing: 0.027, recover: 0.93, recDelay: 0.1, smash: 0.75, tactical: 0.8, read: 0.65, judgeOut: 0.88, serveQ: 0.8, longServe: 0.5, name: '强敌' },
    hard: { react: 0.15, err: 0.24, timing: 0.018, recover: 1, recDelay: 0.05, smash: 0.88, tactical: 0.9, read: 0.85, judgeOut: 0.95, serveQ: 0.88, longServe: 0.45, name: '困难' },
  };
  YY.AI_LEVELS = LEVELS;

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
    houzi: { name: '闪现反打', tip: '守住中场，靠手快把快球挡回去', weakness: '多打深远高球，逼他挪动大肚子', clear: 1.2, drop: 1.2, smash: .7, jump: .45, home: .15, delay: .12, read: .9 },
    laochen: { name: '数据控球', tip: '记录你的落点，球路稳定少失误', weakness: '突然加力：他的回球偏轻，压不住重杀', clear: 1.4, drop: 1.4, smash: .45, jump: .7, home: 0, delay: .02, read: 1.15 },
    guoge: { name: '投机爆发', tip: '平时省力过渡，看到机会球就全力重扣', weakness: '多拉几个长回合，他的体能先撑不住', clear: 1.4, drop: .7, smash: 1.9, jump: 1.1, home: .3, delay: .2, read: .6, reserve: 45 },
    zhu: { name: '读球控场', tip: '观察重复球路，提前守住落点', weakness: '打破连续同类球，突然改变前后节奏', clear: 1.5, drop: 1.6, smash: .45, jump: .35, home: 0, delay: .08, read: 1.25 },
  };

  class AI {
    constructor(match, idx, level, character) {
      this.m = match;
      this.i = idx;
      this.L = LEVELS[level] || LEVELS.normal;
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

    press(btn) { this.m.inputs[this.i].presses.push({ btn }); }

    moveTo(x, tol) {
      const p = this.p;
      const dx = x - p.x;
      const t = tol || 0.06;
      const inp = this.m.inputs[this.i];
      if (Math.abs(dx) < t) inp.move = 0;
      else inp.move = clamp((dx * p.dir) / 0.35, -1, 1);
    }

    update(dt) {
      const m = this.m, p = this.p, s = m.shuttle, L = this.L;
      const inp = m.inputs[this.i];
      if (m.phase === 'serve') {
        this.plan = null;
        if (m.server === this.i) {
          inp.move = 0;
          if (m.serving) return;
          if (m.serveT < this.lastServeT) this.serveWait = rand(0.7, 1.4);
          this.lastServeT = m.serveT;
          if (m.serveT < this.serveWait) return;
          if (!this.serveBtn) this.serveBtn = Math.random() < clamp(L.longServe + this.style.home * .3, .15, .85) ? 'clear' : 'drop';
          const q = 1 - Math.abs(m.serveMeter() - 0.5) * 2;
          if (q >= L.serveQ - Math.random() * 0.08) { this.press(this.serveBtn); this.serveBtn = null; }
        } else this.moveTo(p.side * 2.9);
        return;
      }
      if (m.phase !== 'rally') { this.moveTo(p.side * 3); return; }

      if (m.hitCount !== this.seenHit) {
        this.seenHit = m.hitCount;
        this.plan = null;
        if (s.lastHitter !== this.i) {
          this.reactAt = m.time + L.react * rand(0.8, 1.25);
          this.err = gauss() * L.err;
          if (s.feint > 0 && !(p.buff.shuju > 0)) { this.reactAt += 0.38; this.err += gauss() * 0.9; } // 被假动作骗到
          else if (s.hide && !(p.buff.shuju > 0)) this.reactAt += 0.06; // 看不到落点：判断慢一点
          if (s.veil > 0 && !(p.buff.shuju > 0)) this.reactAt += 0.03; // 同一引拍
          if (s.meteor || s.crawl) this.reactAt += 0.16; // 流星坠 / 搓网：起动慢半拍
          if (p.buff.laugh > 0) this.reactAt += 0.12;
          this.resid = gauss() * L.err * (0.3 + Math.min(1, s.speed / 18) * 0.5);
          this.wantSmash = Math.random() < clamp(L.smash * this.style.jump, 0, .95) && p.stamina >= (this.style.reserve || 0);
        } else this.setHome();
      }

      const incoming = s.live && !s.netHit && s.lastHitter !== this.i;
      if (m.skillsOn && p.kit && p.kit.act.length && p.energy >= m.minCost(p)) this.thinkSkill(incoming);
      if (!incoming) {
        if (m.time >= this.homeAt) this.moveTo(p.side * this.homeD, 0.12);
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
        const btn = this.decideShot(pl);
        // Only bias a shot when already in position; do not abandon a chase.
        if (Math.abs(pl.standX - p.x) < .12 && this.character === 'dingding' && btn === 'clear') pl.pressForwardUntil = m.time + C.SW_W1;
        this.press(btn);
      }
      if (pl.pressForwardUntil > m.time && Math.abs(pl.standX - p.x) < .5) inp.move = .6;
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
      const out = Math.abs(c.landX) > C.HALF + 0.25 && Math.sign(c.landX) === p.side;
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
      const m = this.m, p = this.p, L = this.L;
      const opp = m.players[1 - this.i];
      const oppD = Math.abs(opp.x);
      const d = Math.abs(pl.x != null ? pl.x : p.x);
      const myLast = m.history[this.i].slice(-2);
      let w;
      const tactical = Math.random() < L.tactical;
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
      return YY.pick(w);
    }

    /** 何时发动技能：按技能的 ai 分类判断时机；能量够时偶尔攒着放更贵的那个 */
    thinkSkill(incoming) {
      const m = this.m, p = this.p, s = m.shuttle, pl = this.plan, o = m.players[1 - this.i];
      if (this.skillWait == null) this.skillWait = m.time + rand(0.4, 1.8) / (0.5 + this.L.tactical);
      if (m.time < this.skillWait) return;
      const soon = pl && !pl.leave && pl.tContact - m.time < 0.7 && pl.tContact - m.time > 0.15;
      const afterHit = !incoming && s.live && s.lastHitter === this.i;
      const ready = (when) => {
        switch (when) {
          case 'attack': return incoming && soon && pl.band !== 'none';
          case 'smash': return incoming && soon && pl.band === 'smash';
          case 'net': return incoming && soon && pl.band !== 'none' && Math.abs(p.x) < 4.2;
          case 'defend': return incoming && (s.speed > 13 || (pl && pl.band === 'none'));
          case 'stamina': return p.stamina < 45;
          case 'chase': return incoming && pl && !pl.leave && Math.abs(pl.standX - p.x) > 1.5;
          case 'afterHit': return afterHit && Math.random() < 0.7;
          case 'rally': return m.rally >= 3 && s.live;
          case 'cleanse': return Object.keys(o.buff).some((k) => o.buff[k] > 0 && YY.SKILLS[k]) || o.energy >= 60;
          case 'any': return s.live && Math.random() < 0.5;
        }
        return false;
      };
      const opts = [];
      p.kit.act.forEach((id, slot) => {
        const def = YY.SKILLS[id];
        if (def && m.canUse(p, slot) && !(p.buff[id] > 0) && ready(def.ai)) opts.push({ slot, cost: def.cost || 100 });
      });
      if (!opts.length) return;
      // 更贵的通常更强：有得选时偏向贵的
      opts.sort((a, b) => b.cost - a.cost);
      const pick = opts.length > 1 && Math.random() < 0.35 ? opts[1] : opts[0];
      this.press(pick.slot ? 'skill2' : 'skill');
      this.skillWait = null;
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
      h = YY.lerp(Math.abs(p.x), h, L.recover);
      this.homeD = clamp(h, 1.2, 5.5);
      this.homeAt = m.time + L.recDelay + (cat === 'smash' ? .2 + this.style.delay : this.style.delay * .3);
    }
  }

  YY.AI = AI;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof window !== 'undefined' ? window : globalThis);
