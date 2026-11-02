/* 羽跃对决 · AI 与击球点求解（练习提示共用）
 * AI 与玩家的移动速度、跳跃、体力完全一致；难度只影响反应、判断误差、回位与球路选择。
 */
(function (G) {
  'use strict';
  const YY = G.YY;
  const C = YY.C;
  const { clamp, gauss, rand } = YY;

  const JUMP_LEAD = 0.38; // 起跳到击球的时间
  const jumpH = (t) => C.JUMP_V * t - 0.5 * C.G * t * t;

  /** 在给定肩高下，使球处于甜区圆环上所需的站位（相对球的水平偏移） */
  function standFor(px, py, dir, shoulderY) {
    const dy = clamp(py - shoulderY, -0.8, 0.82);
    const h = Math.sqrt(Math.max(0, C.ARM * C.ARM - dy * dy));
    return px - dir * Math.max(h, 0.15);
  }
  const travel = (dist) => (dist < 0.08 ? 0 : dist / C.MOVE + 0.12);

  /**
   * 为选手 idx 寻找来球的可击球点。
   * prefs: 允许的击球段，按优先级 ['smash','over','low']
   * 返回 {band, standX, tContact(绝对时间), jumpAt, y}
   */
  YY.findContact = function (match, idx, prefs, extraErr) {
    const p = match.players[idx];
    const s = match.shuttle;
    if (!s.live || s.netHit) return null;
    const sim = YY.simulate(s.x, s.y, s.vx, s.vy, 5, true, s.netHit);
    const now = match.time;
    const side = p.side, dir = p.dir;
    const bands = {
      smash: { lo: 2.85, hi: 3.3, ideal: 3.08, sh: C.SHOULDER + jumpH(JUMP_LEAD), lead: JUMP_LEAD },
      over: { lo: 1.85, hi: 2.3, ideal: 2.15, sh: C.SHOULDER, lead: 0.04 },
      low: { lo: 0.32, hi: 1.85, ideal: 99, sh: C.SHOULDER, lead: 0.04 },
    };
    for (const name of prefs) {
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
        const need = travel(Math.abs(side * sd - p.x)) + b.lead;
        if (need > pt.t) continue;
        // 高段选最接近理想高度；低段选最早（最高）可达点
        const score = b.ideal < 50 ? Math.abs(pt.y - b.ideal) : pt.t;
        if (score < bestScore) { bestScore = score; best = { pt, sx: side * sd }; }
      }
      if (best) {
        const tC = now + best.pt.t;
        return {
          band: name, standX: best.sx + (extraErr || 0), tContact: tC,
          jumpAt: name === 'smash' ? tC - JUMP_LEAD : null, y: best.pt.y, x: best.pt.x,
          landX: sim.landX, landT: now + sim.t,
        };
      }
    }
    return { band: 'none', standX: clamp(side * sim.landX, C.X_NEAR, C.X_FAR) * side, tContact: now + sim.t, jumpAt: null, landX: sim.landX, landT: now + sim.t };
  };

  const LEVELS = {
    easy: { react: 0.36, err: 0.75, timing: 0.055, recover: 0.6, recDelay: 0.3, smash: 0.15, tactical: 0.3, read: 0, judgeOut: 0.45, serveQ: 0.5, longServe: 0.7, name: '简单' },
    normal: { react: 0.25, err: 0.5, timing: 0.036, recover: 0.85, recDelay: 0.16, smash: 0.62, tactical: 0.65, read: 0.45, judgeOut: 0.8, serveQ: 0.72, longServe: 0.55, name: '普通' },
    hard: { react: 0.15, err: 0.24, timing: 0.018, recover: 1, recDelay: 0.05, smash: 0.88, tactical: 0.9, read: 0.85, judgeOut: 0.95, serveQ: 0.88, longServe: 0.45, name: '困难' },
  };
  YY.AI_LEVELS = LEVELS;

  class AI {
    constructor(match, idx, level) {
      this.m = match;
      this.i = idx;
      this.L = LEVELS[level] || LEVELS.normal;
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
          if (!this.serveBtn) this.serveBtn = Math.random() < L.longServe ? 'clear' : 'drop';
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
          this.resid = gauss() * L.err * (0.3 + Math.min(1, s.speed / 18) * 0.5);
          this.wantSmash = Math.random() < L.smash;
        } else this.setHome();
      }

      const incoming = s.live && !s.netHit && s.lastHitter !== this.i;
      if (!incoming) {
        if (m.time >= this.homeAt) this.moveTo(p.side * this.homeD, 0.12);
        else inp.move = 0;
        return;
      }
      if (m.time < this.reactAt) {
        // 尚未判断出来球：维持惯性
        return;
      }
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
        this.press(this.decideShot(pl));
      }
    }

    makePlan() {
      const m = this.m, p = this.p, L = this.L;
      const old = this.plan;
      if (old) this.err = this.err * 0.5 + this.resid * 0.5;
      const canSmash = this.wantSmash && p.stamina >= C.JUMP_COST + C.SMASH_COST;
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
        if (p.stamina >= C.SMASH_COST && !p.onGround) return 'smash';
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
      // 高手会避免连续同一球路
      if (L.read > 0.5 && myLast.length === 2 && myLast[0] === myLast[1]) {
        const k = myLast[0] === 'clear' ? 'clear' : myLast[0] === 'drop' ? 'drop' : null;
        if (k && w[k]) w[k] *= 0.35;
      }
      return YY.pick(w);
    }

    setHome() {
      const m = this.m, L = this.L, p = this.p;
      const shot = p.lastShot;
      let h = 3.1;
      if (shot === 'clear' || shot === 'lift' || shot === 'lserve' || shot === 'flatclear') h = 3.35;
      else if (shot === 'drop' || shot === 'net' || shot === 'slice' || shot === 'block' || shot === 'sserve') h = 2.6;
      else if (shot === 'smash') h = 2.75;
      // 读取对手习惯：对手连续两次同类球路 → 提前站位
      const oh = m.history[1 - this.i].slice(-2);
      if (oh.length === 2 && oh[0] === oh[1] && Math.random() < L.read) {
        const t = oh[0];
        if (t === 'drop') h = 2.15;
        else if (t === 'clear') h = 4.2;
        else if (t === 'smash') h = 3.7;
        if (t === 'drop' || t === 'clear' || t === 'smash') m.emit({ type: 'read', p: this.i, cat: t });
      }
      h = YY.lerp(Math.abs(p.x), h, L.recover);
      this.homeD = clamp(h, 1.2, 5.5);
      this.homeAt = m.time + L.recDelay + (shot === 'smash' ? 0.2 : 0);
    }
  }

  YY.AI = AI;
})(typeof window !== 'undefined' ? window : globalThis);
