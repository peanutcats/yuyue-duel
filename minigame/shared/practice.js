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
    smash: { name: '跳杀练习', tip: '看到“起跳！”先跳（W / 跳），在空中高点按扣杀（L）。', zone: null },
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
      let kind = this.drill;
      if (kind === 'receive') kind = YY.pick(this.def.feeds || { clear: 3, drop: 2, smash: 1.4, drive: 1.2, net: 1.5, lift: 1.5 });
      if (this.drill === 'clear' || this.drill === 'drop') kind = 'high';
      let x0, y0, vx, vy;
      const shoot = (x, y, ang, dist) => {
        let v = 0, a = 0;
        for (let k = 0; k < 10; k++, ang += 5) { // 抬高角度直到能安全过网
          v = YY.solveSpeed(x, y, -1, ang, dist + x);
          a = (ang * Math.PI) / 180;
          if (YY.netClear(x, y, -Math.cos(a) * v, Math.sin(a) * v) > C.NET_CLEAR + 0.15) break;
        }
        x0 = x; y0 = y; vx = -Math.cos(a) * v; vy = Math.sin(a) * v;
      };
      const fire = (x, y, speed, dist, lo, hi) => {
        const a = YY.solveAngle(x, y, -1, speed, dist + x, lo, hi);
        const r = (a * Math.PI) / 180;
        x0 = x; y0 = y; vx = -Math.cos(r) * speed; vy = Math.sin(r) * speed;
      };
      switch (kind) {
        case 'high': shoot(2.6, 1.2, 62, rand(4.0, 5.2)); break;
        case 'smash': shoot(1.6, 1.0, 66, rand(2.6, 3.6)); break;
        case 'clear': shoot(2.6, 2.3, 50, rand(4.6, 5.8)); break;
        case 'lift': shoot(1.2, 0.8, 62, rand(4.4, 5.6)); break;
        case 'drop': shoot(3.6, 2.5, 6, rand(1.0, 1.9)); break;
        case 'net': shoot(0.9, 1.0, 60, rand(0.6, 1.2)); break;
        case 'drive': fire(2.6, 1.9, 15, rand(3.0, 4.5), -15, 25); break;
        default: shoot(2.6, 2.3, 50, 5);
      }
      if (this.drill === 'receive' && kind === 'smash') fire(2.8, 3.0, 21, rand(2.6, 4.2), -45, 5);
      this.lastKind = kind;
      s.x = x0; s.y = y0; s.vx = vx; s.vy = vy;
      s.live = true; s.held = false; s.netHit = false; s.crossedNet = false; s.lastHitter = 1; s.shot = 'feed'; s.isServe = false;
      s.speed = Math.hypot(vx, vy);
      m.phase = 'rally';
      m.hitCount++;
      m.pred = YY.simulate(s.x, s.y, s.vx, s.vy, 6, true);
      m.pred.t0 = m.time;
      m.players[1].flash = 0.2;
      m.emit({ type: 'hit', p: 1, shot: 'feed', name: '发球机', q: 1, label: '', speed: s.speed, x: s.x, y: s.y, feed: true });
      this.playerHit = null;
      this.fed = true;
      this.hint = null;
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
          const prefs = this.drill === 'smash' ? ['smash', 'over', 'low'] : this.drill === 'receive' ? ['over', 'low'] : ['over', 'low'];
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
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof window !== 'undefined' ? window : globalThis);
