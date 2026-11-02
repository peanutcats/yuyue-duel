/* 羽跃对决 · 比赛逻辑：选手、挥拍判定、球路、体力、计分 */
(function (G) {
  'use strict';
  const YY = G.YY;
  const C = YY.C;
  const { clamp, gauss } = YY;

  function makePlayer(idx, side) {
    return {
      idx, side, dir: -side,
      x: side * 3, y: 0, vx: 0, vy: 0, onGround: true,
      stamina: C.STAM_MAX, stamDelay: 0,
      swing: null, cooldown: 0, slow: 0, land: 0,
      runPhase: 0, lastShot: null, flash: 0,
    };
  }
  function newStats() {
    return { hits: 0, perfect: 0, smash: 0, smashWin: 0, winners: 0, errors: 0, saves: 0 };
  }
  YY.blankInput = () => ({ move: 0, presses: [] });

  // 三角波 0→1→0
  const tri = (u) => 1 - Math.abs((u % 2) - 1);

  class Match {
    constructor(opt) {
      this.opt = Object.assign({ target: 7, cap: 11, names: ['你', '对手'], firstServer: 0 }, opt || {});
      this.players = [makePlayer(0, -1), makePlayer(1, 1)];
      this.inputs = [YY.blankInput(), YY.blankInput()];
      this.score = [0, 0];
      this.server = this.opt.firstServer;
      this.events = [];
      this.time = 0;
      this.hitstop = 0;
      this.hitCount = 0;
      this.stats = [newStats(), newStats()];
      this.history = [[], []];
      this.rally = 0;
      this.longest = 0;
      this.winner = -1;
      this.pred = null;
      this.landMark = null;
      this.shuttle = { x: 0, y: 1, vx: 0, vy: 0, live: false, held: true, netHit: false, crossedNet: false, lastHitter: -1, shot: null, speed: 0 };
      this.practice = !!this.opt.practice;
      this.resetPoint(true);
    }

    get names() { return this.opt.names; }

    emit(e) { this.events.push(e); }

    serveMeter() { return tri(this.serveT * 1.15); }

    resetPoint(first) {
      this.phase = 'serve';
      this.serveT = 0;
      this.serving = null;
      this.rally = 0;
      this.pred = null;
      for (const p of this.players) {
        const isSrv = p.idx === this.server;
        p.x = p.side * (isSrv ? 2.3 : 2.8);
        p.y = 0; p.vx = 0; p.vy = 0; p.onGround = true;
        p.swing = null; p.cooldown = 0; p.slow = 0; p.land = 0;
        p.stamina = C.STAM_MAX; p.stamDelay = 0;
      }
      const s = this.shuttle;
      s.live = false; s.held = true; s.netHit = false; s.crossedNet = false; s.lastHitter = -1; s.shot = null;
      s.vx = 0; s.vy = 0;
      this.placeHeld();
      this.emit({ type: 'serveReady', server: this.server, first: !!first });
    }

    placeHeld() {
      const p = this.players[this.server];
      this.shuttle.x = p.x + p.dir * 0.38;
      this.shuttle.y = 0.95;
    }

    step(dt) {
      if (this.hitstop > 0) { this.hitstop -= dt; return; }
      this.time += dt;
      const s = this.shuttle;

      if (this.phase === 'serve') {
        this.serveT += dt;
        if (!this.serving && this.serveT > C.SERVE_AUTO && !this.practice) {
          this.startServe(this.players[this.server], 'clear', 0.45);
        }
      }

      for (const p of this.players) this.updatePlayer(p, dt);

      if (this.phase === 'serve') {
        if (this.serving) {
          this.serving.t += dt;
          if (this.serving.t >= 0.1) this.launchServe();
          else this.placeHeld();
        } else this.placeHeld();
      } else if (s.live) {
        const r = YY.stepShuttle(s, dt);
        s.speed = Math.hypot(s.vx, s.vy);
        if (r === 'net') this.emit({ type: 'net', x: s.x, y: s.y });
        if (r === 'floor') this.onLand(s.x);
        else if (this.phase === 'rally') for (const p of this.players) this.checkContact(p, dt);
      }

      if (this.phase === 'point') {
        this.pointTimer -= dt;
        if (this.pointTimer <= 0) {
          if (this.winner >= 0) { this.phase = 'over'; this.emit({ type: 'over', winner: this.winner }); }
          else if (this.practice) this.phase = 'idle';
          else this.resetPoint(false);
        }
      }
    }

    updatePlayer(p, dt) {
      const inp = this.inputs[p.idx];
      for (const pr of inp.presses) this.handlePress(p, pr);
      inp.presses.length = 0;

      const lockedServer = this.phase === 'serve' && p.idx === this.server;
      const frozen = this.phase === 'over';
      let mv = lockedServer || frozen ? 0 : clamp(inp.move, -1, 1);
      if (p.land > 0) mv *= 0.3;
      const maxV = C.MOVE * (p.slow > 0 ? 0.45 : 1);
      const targetV = mv * p.dir * maxV;
      if (p.onGround) {
        const a = Math.abs(mv) > 0.05 ? C.ACCEL : C.DECEL;
        const dv = targetV - p.vx;
        p.vx += clamp(dv, -a * dt, a * dt);
      } else {
        const dv = targetV - p.vx;
        p.vx += clamp(dv, -C.AIR_ACCEL * dt, C.AIR_ACCEL * dt);
      }
      p.x += p.vx * dt;
      const dist = clamp(p.side * p.x, C.X_NEAR, C.X_FAR);
      if (dist !== p.side * p.x) p.vx = 0;
      p.x = p.side * dist;

      if (!p.onGround) {
        p.vy -= C.G * dt;
        p.y += p.vy * dt;
        if (p.y <= 0) {
          p.y = 0; p.vy = 0; p.onGround = true; p.land = 0.08;
          this.emit({ type: 'land', p: p.idx });
        }
      }
      p.runPhase += Math.abs(p.vx) * dt * 2.6;
      if (p.swing) {
        p.swing.t += dt;
        if (p.swing.t >= p.swing.dur) { p.swing = null; p.cooldown = 0.04; }
      }
      p.cooldown -= dt; p.slow -= dt; p.land -= dt; p.flash -= dt;
      p.stamDelay -= dt;
      if (p.stamDelay <= 0) p.stamina = Math.min(C.STAM_MAX, p.stamina + C.STAM_REGEN * dt);
    }

    handlePress(p, pr) {
      if (this.phase === 'over' || this.phase === 'point') return;
      if (pr.btn === 'jump') {
        if (!p.onGround || p.land > 0) return;
        if (this.phase === 'serve' && p.idx === this.server) return;
        let v = C.JUMP_V;
        if (p.stamina >= C.JUMP_COST) { p.stamina -= C.JUMP_COST; }
        else { v = C.JUMP_V_LOW; this.emit({ type: 'tired', p: p.idx }); }
        p.stamDelay = C.STAM_DELAY;
        p.vy = v; p.onGround = false;
        this.emit({ type: 'jump', p: p.idx });
        return;
      }
      if (this.phase === 'serve') {
        if (p.idx === this.server && !this.serving) this.startServe(p, pr.btn, null);
        return;
      }
      if (p.swing || p.cooldown > 0) return;
      const s = this.shuttle;
      const vy = s.y - (p.y + C.SHOULDER);
      const kind = vy > 0.25 ? 'over' : vy < -0.4 ? 'under' : 'side';
      p.swing = {
        t: clamp(pr.lead || 0, 0, 0.08), btn: pr.btn, kind, dur: C.SW_DUR,
        hit: false, prevE: 99, judged: false, serve: false,
      };
      this.emit({ type: 'swing', p: p.idx, btn: pr.btn });
    }

    startServe(p, btn, forceQ) {
      const m = this.serveMeter();
      const q = forceQ != null ? forceQ : clamp(1 - Math.abs(m - 0.5) * 2, 0, 1);
      this.serving = { t: 0, btn: btn === 'drop' ? 'sserve' : 'lserve', q };
      p.swing = { t: 0, btn, kind: 'under', dur: 0.32, hit: true, prevE: 99, judged: true, serve: true };
    }

    launchServe() {
      const p = this.players[this.server];
      const s = this.shuttle;
      const q = this.serving.q;
      s.held = false; s.live = true; s.netHit = false;
      s.x = p.x + p.dir * 0.42; s.y = 0.9;
      const shot = this.resolveShot(p, this.serving.btn, q, true);
      s.vx = shot.vx; s.vy = shot.vy;
      this.afterHit(p, shot, q, { serve: true });
      this.phase = 'rally';
      this.serving = null;
    }

    /** 拍面误差：距离甜区圆环的偏差 + 角度越界惩罚 */
    ringError(p, s) {
      const sx = (s.x - p.x) * p.dir;
      const sy = s.y - (p.y + C.SHOULDER);
      const r = Math.hypot(sx, sy);
      const ang = (Math.atan2(sy, sx) * 180) / Math.PI;
      let pen = 0;
      if (ang > C.ANG_MAX) pen = (ang - C.ANG_MAX) * 0.02;
      else if (ang < C.ANG_MIN) pen = (C.ANG_MIN - ang) * 0.02;
      return Math.abs(r - C.ARM) + pen;
    }

    checkContact(p, dt) {
      const sw = p.swing;
      const s = this.shuttle;
      if (!sw || sw.hit || sw.serve) return;
      if (!s.live || s.held || s.lastHitter === p.idx) return;
      if (sw.t < C.SW_W0) return;
      if (sw.t > C.SW_W1) {
        if (!sw.judged) { sw.judged = true; this.judgeWhiff(p); }
        return;
      }
      // 必须实际越过球网且球头完全进入己方半场；扑救容差不能越网或救回下网球。
      if (s.netHit || !s.crossedNet || p.side * s.x <= C.SHUTTLE_R) { sw.prevE = 99; return; }
      const e = this.ringError(p, s);
      const reach = s.speed > 12 ? C.REACH_FAST : C.REACH; // 接快球时允许扑救
      if (e < reach && (e > sw.prevE + 1e-4 || e < 0.07 || sw.t + dt > C.SW_W1)) {
        this.doHit(p, sw, e, reach);
        return;
      }
      sw.prevE = e;
    }

    judgeWhiff(p) {
      const s = this.shuttle;
      if (!s.live || s.netHit || s.lastHitter === p.idx) return;
      const dx = s.x - p.x, dy = s.y - (p.y + C.SHOULDER);
      const r = Math.hypot(dx, dy);
      if (r > 4.5) {
        this.emit({ type: 'whiff', p: p.idx, label: '挥空：球还远' });
        return;
      }
      const approaching = dx * s.vx + dy * s.vy < 0;
      let label;
      if (r > C.ARM + C.REACH + 0.9) label = approaching ? '挥拍太早' : '没够到';
      else label = approaching ? '挥拍太早' : '挥拍太晚';
      this.emit({ type: 'whiff', p: p.idx, label });
    }

    doHit(p, sw, e, reach) {
      const s = this.shuttle;
      sw.hit = true;
      const tq = clamp(1 - Math.abs(sw.t - C.SW_SWEET) / 0.1, 0, 1);
      const pq = clamp(1 - e / (reach || C.REACH), 0, 1);
      let q = clamp(0.55 * pq + 0.45 * tq, 0, 1);
      const inSpeed = s.speed;
      const ctx = { save: false, lowSave: false };
      if (inSpeed > 15 && s.shot === 'smash') { q *= 0.75; ctx.save = true; }
      if (s.y < 0.45) { q *= 0.85; ctx.lowSave = true; }
      // 跑动中勉强击球：速度越快，回球质量越差
      const lunge = clamp((Math.abs(p.vx) - 2.2) / 3, 0, 1);
      if (lunge > 0) { q *= 1 - 0.3 * lunge; ctx.stretch = true; }
      const shot = this.resolveShot(p, sw.btn, q, false);
      s.vx = shot.vx; s.vy = shot.vy;
      sw.kind = s.y > p.y + C.SHOULDER + 0.25 ? 'over' : s.y < p.y + C.SHOULDER - 0.4 ? 'under' : 'side';
      if (shot.type === 'smash') {
        sw.dur = C.SW_SMASH_DUR;
        p.slow = 0.45;
        p.stamina -= C.SMASH_COST;
        p.stamDelay = C.STAM_DELAY;
        this.hitstop = 0.065;
      }
      this.afterHit(p, shot, q, ctx);
    }

    afterHit(p, shot, q, ctx) {
      const s = this.shuttle;
      s.lastHitter = p.idx;
      s.netHit = false;
      s.crossedNet = false;
      s.shot = shot.type;
      s.isServe = !!ctx.serve;
      s.speed = Math.hypot(s.vx, s.vy);
      s.hitX = s.x;
      // 绘制和联机快照使用实际接触点，发球也遵循同一条路径。
      if (p.swing) p.swing.contact = { x: s.x, y: s.y, t: p.swing.t };
      p.lastShot = shot.type;
      p.flash = 0.15;
      this.hitCount++;
      if (!ctx.serve) this.rally++;
      const st = this.stats[p.idx];
      st.hits++;
      if (q >= 0.85) st.perfect++;
      if (shot.type === 'smash') st.smash++;
      if (ctx.save || ctx.lowSave) st.saves++;
      this.history[p.idx].push(YY.SHOT_CAT[shot.type] || shot.type);
      if (this.history[p.idx].length > 6) this.history[p.idx].shift();
      this.pred = YY.simulate(s.x, s.y, s.vx, s.vy, 6, true);
      this.pred.t0 = this.time;
      const label = q >= 0.85 ? '完美' : q >= 0.6 ? '好球' : q >= 0.35 ? '一般' : '勉强';
      this.emit({
        type: 'hit', p: p.idx, shot: shot.type, name: YY.SHOT_NAMES[shot.type], q, label,
        speed: s.speed, x: s.x, y: s.y, reason: shot.reason || null,
        save: ctx.save, lowSave: ctx.lowSave, serve: !!ctx.serve, weak: q < 0.35,
      });
    }

    /** 根据按键、击球点与质量决定球路与初速度 */
    resolveShot(p, btn, q, isServe) {
      const s = this.shuttle;
      const dir = p.dir;
      const d = Math.abs(s.x);
      const back = -dir * s.x; // 击球点在己方离网距离（可为负：已过网）
      const h = s.y;
      const opp = this.players[1 - p.idx];
      const oppD = Math.abs(opp.x);
      const mod = clamp(this.inputs[p.idx].move, -1, 1); // +1 = 向网，-1 = 向后
      let type, reason = null;

      if (isServe) type = btn;
      else if (btn === 'smash') {
        const air = !p.onGround;
        if (air && h >= C.SMASH_MIN_Y && p.stamina >= C.SMASH_COST) type = 'smash';
        else {
          reason = p.stamina < C.SMASH_COST ? '体力不足' : !air ? '未起跳' : '击球点太低';
          type = h >= 1.45 ? 'drive' : 'lift';
        }
      } else if (btn === 'clear') {
        type = h >= 1.7 ? (mod > 0.5 ? 'flatclear' : 'clear') : 'lift';
      } else {
        if (d <= 2.3 && h < 1.95) type = 'net';
        else if (h >= 1.7) type = mod > 0.5 ? 'slice' : 'drop';
        else type = 'block';
      }

      const miss = 1 - q;
      let ang, speed, target;
      const tNoise = gauss() * miss * 0.45;
      const solveUp = (a0, tgt, margin) => {
        // 固定角度求速度；若过网高度不足则抬高角度
        let a = a0, v = 0;
        for (let k = 0; k < 10; k++) {
          v = YY.solveSpeed(s.x, s.y, dir, a, tgt + back);
          const rad = (a * Math.PI) / 180;
          const ny = YY.netClear(s.x, s.y, v * Math.cos(rad) * dir, v * Math.sin(rad));
          if (ny >= C.NET_CLEAR + margin) break;
          if (a >= 72 || k === 9) break;
          a = Math.min(72, a + 6);
        }
        return [a, v];
      };

      switch (type) {
        case 'clear':
          target = 5.95 - miss * 2.6 + tNoise;
          [ang, speed] = solveUp(h > 2.6 ? 46 : 50, target, 1.6);
          break;
        case 'flatclear':
          target = 5.75 - miss * 2.2 + tNoise;
          [ang, speed] = solveUp(30, target, 0.7);
          break;
        case 'lift':
          target = 5.7 - miss * 2.7 + tNoise;
          [ang, speed] = solveUp(d < 1.5 ? 66 : 60, target, 1.6);
          break;
        case 'drop':
          target = 1.55 - miss * 0.45 + tNoise * 0.6 + (d > 5.3 ? 0.25 : 0);
          [ang, speed] = solveUp(h > 2.6 ? 0 : 7, Math.max(0.5, target), 0.14);
          break;
        case 'slice':
          target = 2.35 - miss * 0.4 + tNoise * 0.6;
          [ang, speed] = solveUp(-6, Math.max(0.6, target), 0.12);
          break;
        case 'net':
          target = 0.72 + miss * 0.7 + Math.abs(tNoise) * 0.5;
          [ang, speed] = solveUp(h > 1.5 ? 35 : 62, target, 0.05);
          break;
        case 'block':
          target = 1.5 + tNoise * 0.6;
          [ang, speed] = solveUp(40, Math.max(0.6, target), 0.25);
          break;
        case 'smash': {
          speed = (19.5 + 6 * q) * (d < 3.6 ? 1.1 : d > 5.2 ? 0.88 : 1); // 越靠近网扣杀越凶
          // 自动瞄向对手站位的空当一侧；偏离距离取决于击球质量
          const off = 1.0 + 0.9 * q + (d < 3.6 ? 0.4 : 0);
          let deep = oppD < 3.4;
          if (mod > 0.5) deep = false;
          else if (mod < -0.5) deep = true;
          target = clamp(oppD + (deep ? off : -off), 1.7, 5.7);
          target = Math.min(target + tNoise, 6.3);
          ang = YY.solveAngle(s.x, s.y, dir, speed, target + back, -50, 8);
          // 过网检查
          for (let k = 0; k < 12; k++) {
            const rad = (ang * Math.PI) / 180;
            if (YY.netClear(s.x, s.y, speed * Math.cos(rad) * dir, speed * Math.sin(rad)) >= C.NET_CLEAR + 0.08) break;
            ang += 2.5;
          }
          break;
        }
        case 'drive':
          speed = 14 + 4 * q;
          target = (oppD < 3.3 ? 4.6 : 3.4) + tNoise;
          ang = YY.solveAngle(s.x, s.y, dir, speed, target + back, -20, 30);
          for (let k = 0; k < 12; k++) {
            const rad = (ang * Math.PI) / 180;
            if (YY.netClear(s.x, s.y, speed * Math.cos(rad) * dir, speed * Math.sin(rad)) >= C.NET_CLEAR + 0.12) break;
            ang += 3;
          }
          break;
        case 'lserve':
          target = 5.55 - miss * 2.3 + tNoise * 0.6;
          [ang, speed] = solveUp(64, target, 1.2);
          break;
        case 'sserve':
          target = 2.45 + tNoise * 0.4;
          [ang, speed] = solveUp(26, target, 0.12);
          break;
        default:
          [ang, speed] = solveUp(45, 4, 0.5);
      }

      // 击球误差：质量越低，角度与力度越不稳定
      const sa = miss * (type === 'net' || type === 'drop' || type === 'sserve' ? 5.5 : 4);
      const ss = miss * 0.09;
      ang += gauss() * sa;
      speed *= 1 + gauss() * ss;
      if (q < 0.2) speed *= 0.86;
      const rad = (ang * Math.PI) / 180;
      return { type, reason, vx: Math.cos(rad) * speed * dir, vy: Math.sin(rad) * speed };
    }

    onLand(x) {
      const s = this.shuttle;
      s.live = false;
      s.vx = 0; s.vy = 0;
      this.phase = 'point';
      this.pointTimer = this.practice ? 1.0 : 1.9;
      const inB = Math.abs(x) <= C.HALF + C.LINE_TOL;
      const nearLine = inB && Math.abs(x) > C.HALF - 0.12;
      this.landMark = { x, inB, t: this.time };
      const hitter = s.lastHitter;
      this.longest = Math.max(this.longest, this.rally);

      if (this.practice) {
        this.emit({ type: 'pland', x, inB, nearLine, hitter, netHit: s.netHit, shot: s.shot });
        return;
      }

      let loser, reason, kind;
      const landIdx = x < 0 ? 0 : 1;
      if (!inB) {
        loser = hitter; reason = s.netHit ? '下网' : '出界'; kind = 'error';
      } else if (landIdx === hitter) {
        loser = hitter; reason = s.netHit ? '下网' : '未过网'; kind = 'error';
      } else {
        loser = landIdx; kind = 'winner';
        reason = nearLine ? '压线好球！' : (YY.SHOT_NAMES[s.shot] || '') + '得分';
        if (s.shot === 'smash') this.stats[hitter].smashWin++;
        this.stats[hitter].winners++;
      }
      if (kind === 'error') {
        this.stats[hitter].errors++;
        if (s.isServe) reason = '发球失误 · ' + reason;
      }
      const winner = 1 - loser;
      this.score[winner]++;
      this.server = winner;
      const [a, b] = this.score;
      const wins = (i) => {
        const me = this.score[i], ot = this.score[1 - i];
        return me >= this.opt.cap || (me >= this.opt.target && me - ot >= 2);
      };
      if (wins(0)) this.winner = 0;
      else if (wins(1)) this.winner = 1;
      if (this.winner >= 0) this.pointTimer = 2.2;
      let banner = null;
      if (this.winner < 0) {
        const gp = (i) => {
          const me = this.score[i] + 1, ot = this.score[1 - i];
          return me >= this.opt.cap || (me >= this.opt.target && me - ot >= 2);
        };
        if (gp(0) || gp(1)) banner = '赛点';
        if (a === 10 && b === 10) banner = '10:10 · 下一分定胜负';
      }
      this.emit({ type: 'point', winner, loser, reason, kind, x, inB, nearLine, shot: s.shot, banner, rally: this.rally });
    }
  }

  YY.Match = Match;
})(typeof window !== 'undefined' ? window : globalThis);
