/* 羽跃对决 · 比赛逻辑：选手、挥拍判定、球路、体力、计分 */
(function (G) {
  'use strict';
  const YY = G.YY;
  const C = YY.C;
  const { clamp, gauss } = YY;

  // 选手属性倍率（1 = 标准）。stamCost / handling / land / lunge 越小越好。
  const BASE_STATS = {
    move: 1, accel: 1, jump: 1, power: 1, control: 1, touch: 1, reach: 1, defense: 1,
    stamCost: 1, regen: 1, handling: 1, land: 1, lunge: 1,
  };
  YY.BASE_STATS = BASE_STATS;
  const SLOW_SCALE = 0.45; // 缓时技能下来球的速度倍率
  const TOUCHY = { net: 1, drop: 1, slice: 1, block: 1, sserve: 1, tumble: 1 }; // 受“网前手感”影响的球路

  // 技能修正的默认值：倍率类为 1，加成类为 0，开关类为 0
  const BASE_MOD = { move: 1, accel: 1, reach: 1, reachFast: 1, netReach: 1, jump: 1, smash: 1, kill: 1, shot: 1, qAdd: 0, qMin: 0,
    free: 0, jumpFree: 0, regen: 1, noSmashSlow: 0, timing: 1, hide: 0, saveFree: 0, swing: 1, drain: 0, smashCost: 1, oppQSmash: 1 };
  const MOD_ADD = { qAdd: 1, drain: 1 }, MOD_MAX = { qMin: 1, free: 1, jumpFree: 1, noSmashSlow: 1, hide: 1, saveFree: 1 };
  // 对手施加的负面状态与被动产生的短暂状态（不是技能本身，不显示光环）
  const STATUS = {
    laugh: { move: 0.65, jump: 0.75 }, root: { move: 0, jump: 0 }, sticky: { move: 0.85 }, drained: { regen: 0 },
    zg: { move: 1.25 }, stun: {}, curse: {},
  };
  YY.SKILL_STATUS = STATUS;
  const NET_ZONE = { net: 1, tumble: 1, drop: 1, block: 1, slice: 1 };
  const FAST_IN = { smash: 1, halfsmash: 1, kill: 1, drive: 1 };
  /** 技能组：字符串 = 单个主动（旧接口），数组 = 主动列表，对象 = { passive, act } */
  function normKit(k) {
    if (!k) return null;
    if (typeof k === 'string') return { passive: null, act: [k] };
    if (Array.isArray(k)) return { passive: null, act: k.filter(Boolean).slice(0, 2) };
    return { passive: k.passive || null, act: (k.act || []).filter(Boolean).slice(0, 2) };
  }
  YY.normKit = normKit;

  function makePlayer(idx, side, st, skill) {
    const kit = normKit(skill);
    return {
      idx, side, dir: -side,
      x: side * 3, y: 0, vx: 0, vy: 0, onGround: true,
      stamina: C.STAM_MAX, stamDelay: 0,
      swing: null, cooldown: 0, slow: 0, land: 0,
      bufferedShot: null, bufferT: 0,
      runPhase: 0, lastShot: null, flash: 0,
      st: Object.assign({}, BASE_STATS, st || {}),
      kit, skill: kit && kit.act[0] || null, passive: kit && kit.passive || null,
      energy: 0, buff: {}, cnt: {}, stack: 0, skillCd: 0,
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
      const o = this.opt;
      this.players = [0, 1].map((i) => makePlayer(i, i ? 1 : -1, o.stats && o.stats[i], o.skills && o.skills[i]));
      this.skillsOn = this.players.some((p) => p.kit && (p.kit.act.length || p.kit.passive));
      this.env = o.env || null;
      this.slowT = 0; this.slowFor = -1;
      this.looks = o.looks || null;
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
      for (const p of this.players) { p.blinkBack = false; p.fooled = false; p.replan = false; }
      this.serveT = 0;
      this.serving = null;
      this.rally = 0;
      this.pred = null;
      for (const p of this.players) {
        const isSrv = p.idx === this.server;
        p.x = p.side * (isSrv ? 2.3 : 2.8);
        p.y = 0; p.vx = 0; p.vy = 0; p.onGround = true;
        p.swing = null; p.cooldown = 0; p.slow = 0; p.land = 0;
        p.bufferedShot = null; p.bufferT = 0;
        p.stamina = C.STAM_MAX; p.stamDelay = 0; p.stack = 0;
      }
      const s = this.shuttle;
      s.live = false; s.held = true; s.netHit = false; s.crossedNet = false; s.lastHitter = -1; s.shot = null;
      s.vx = 0; s.vy = 0; s.speed = 0; s.fire = false; s.feint = 0; s.meteor = false;
      s.crawl = false; s.hide = false; s.veil = 0; s.wobble = false; s.oppQ = 1;
      this.slowT = 0;
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
      if (this.slowT > 0) this.slowT -= dt;
      if (s.feint > 0) s.feint -= dt;
      if (s.veil > 0) { s.veil -= dt; if (this.pred) this.pred.hidden = this.hintHidden(); }

      if (this.phase === 'serve') {
        this.serveT += dt;
        if (!this.serving && this.serveT > C.SERVE_AUTO && !this.practice) {
          this.startServe(this.players[this.server], 'clear', 0.45);
        }
      }

      const previous = s.live ? { x: s.x, y: s.y, vx: s.vx, vy: s.vy, netHit: s.netHit,
        players: this.players.map(p => ({ x: p.x, y: p.y })) } : null;
      for (const p of this.players) this.updatePlayer(p, dt);

      if (this.phase === 'serve') {
        if (this.serving) {
          this.serving.t += dt;
          if (this.serving.t >= 0.1) this.launchServe();
          else this.placeHeld();
        } else this.placeHeld();
      } else if (s.live) {
        const scale = this.shuttleScale(), r = YY.stepShuttle(s, dt * scale, this.env);
        s.speed = Math.hypot(s.vx, s.vy);
        if (!previous?.netHit && s.netHit) this.emit({ type: 'net', x: s.x, y: s.y });
        if (s.wobble && s.crossedNet && !s.netHit) this.wobbleShuttle();
        let hit = false;
        if (this.phase === 'rally' && !s.netHit) for (const p of this.players) {
          if (this.checkContact(p, dt, previous, s.stepTime / scale)) { hit = true; break; }
        }
        if (r === 'floor' && !hit) this.onLand(s.x);
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
      p.bufferT = Math.max(0, (p.bufferT || 0) - dt);
      if (!p.bufferT || this.phase !== 'rally') p.bufferedShot = null;
      const inp = this.inputs[p.idx];
      for (const pr of inp.presses) this.handlePress(p, pr);
      inp.presses.length = 0;

      const lockedServer = this.phase === 'serve' && p.idx === this.server;
      const frozen = this.phase === 'over';
      let mv = lockedServer || frozen ? 0 : clamp(inp.move, -1, 1);
      const st = p.st, b = p.buff, M = this.mods(p), sh = this.shuttle;
      // 疾风回位：打完球、手指没在控制移动时，自动冲回中场
      if (b.huiwei > 0 && mv === 0 && this.phase === 'rally' && sh.live && sh.lastHitter === p.idx) {
        const dx = p.side * 3 - p.x;
        if (Math.abs(dx) > 0.1) mv = clamp((dx * p.dir) / 0.35, -1, 1);
      }
      if (p.land > 0) mv *= 0.3;
      const maxV = C.MOVE * st.move * M.move * (p.slow > 0 ? 0.45 : 1);
      const targetV = mv * p.dir * maxV;
      if (p.onGround) {
        const a = (Math.abs(mv) > 0.05 ? C.ACCEL : C.DECEL) * st.accel * M.accel;
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
        p.y += p.vy * dt - 0.5 * C.G * dt * dt;
        p.vy -= C.G * dt;
        if (p.y <= 0) {
          p.y = 0; p.vy = 0; p.onGround = true; p.land = 0.08 * st.land * (p.passive === 'chuanxian' ? 0.5 : 1);
          this.emit({ type: 'land', p: p.idx });
        }
      }
      p.runPhase += Math.abs(p.vx) * dt * 2.6;
      if (p.swing) {
        p.swing.t += dt;
        if (p.swing.t >= p.swing.dur) { p.swing = null; p.cooldown = 0.04; }
      }
      p.cooldown -= dt; p.slow -= dt; p.land -= dt; p.flash -= dt; p.skillCd -= dt;
      if (p.bufferedShot && !p.swing && p.cooldown <= 0) {
        const btn = p.bufferedShot; p.bufferedShot = null; p.bufferT = 0;
        this.beginSwing(p, btn);
      }
      p.stamDelay -= dt;
      for (const k in b) if (b[k] > 0) b[k] -= dt;
      const tide = p.passive === 'chaoxi_p' && this.rally > 6 ? 1.5 : 1;
      const regen = C.STAM_REGEN * st.regen * M.regen * tide;
      if (p.stamDelay <= 0 || M.regen >= 2) p.stamina = Math.min(C.STAM_MAX, p.stamina + regen * dt);
    }

    /** 当前生效的技能 / 状态修正汇总 */
    mods(p) {
      const M = Object.assign({}, BASE_MOD), b = p.buff, SK = YY.SKILLS || {};
      for (const k in b) {
        if (!(b[k] > 0)) continue;
        const mod = (SK[k] && SK[k].mod) || STATUS[k];
        if (!mod) continue;
        for (const f in mod) {
          if (MOD_ADD[f]) M[f] += mod[f];
          else if (MOD_MAX[f]) M[f] = Math.max(M[f], mod[f]);
          else M[f] *= mod[f];
        }
      }
      return M;
    }

    /** 体力消耗倍率（free：完全不耗；jumpFree：起跳不耗；smashCost：扣杀消耗倍率） */
    costMul(p, jump) {
      const M = this.mods(p);
      if (M.free || (jump && M.jumpFree)) return 0;
      return p.st.stamCost * (jump ? 1 : M.smashCost);
    }

    /** 落点提示是否隐藏（接球方开了“数据透视”时一律显示） */
    hintHidden() {
      const s = this.shuttle, o = this.players[1 - s.lastHitter];
      if (o && o.buff.shuju > 0) return false;
      return !!(s.hide || s.veil > 0);
    }

    /** 水中月：过网后突然改变水平速度，落点提示仍停留在原处 */
    wobbleShuttle() {
      const s = this.shuttle;
      s.wobble = false;
      const o = this.players[1 - s.lastHitter];
      if (o && o.buff.shuju > 0) return;
      // 落点从后场“飘”到中前场，或从前场“飘”到后场，始终落在界内
      const land = (k) => Math.abs(YY.simulate(s.x, s.y, s.vx * k, s.vy, 6, false, true, this.env).landX);
      const cur = land(1), want = cur > 3.6 ? Math.max(1.4, cur - 2.2) : Math.min(C.HALF - 0.45, cur + 2.4);
      let lo = 0.3, hi = 2.2;
      for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; if (land(mid) < want) lo = mid; else hi = mid; }
      s.vx *= (lo + hi) / 2;
      if (o) o.fooled = true; // 接球方被晃了一下，需要重新判断
      this.emit({ type: 'skillProc', p: s.lastHitter, id: 'shuiyue', label: '飘了！' });
    }

    /** 当前来球的时间倍率（缓时技能只放慢飞向技能方的球） */
    shuttleScale() {
      const s = this.shuttle;
      return this.slowT > 0 && s.lastHitter !== this.slowFor ? SLOW_SCALE : 1;
    }
    /** 把“模拟时间”换算成真实时间（缓时期间球飞得慢，AI 与提示据此修正时机） */
    realT(tau) {
      const ts = this.shuttleScale();
      if (ts === 1) return tau;
      const R = Math.max(0, this.slowT);
      return tau <= R * ts ? tau / ts : R + (tau - R * ts);
    }

    /** 当前携带技能里最便宜的消耗（用于“可以发动”的提示） */
    minCost(p) {
      const SK = YY.SKILLS || {};
      let c = Infinity;
      for (const id of (p.kit && p.kit.act) || []) if (SK[id]) c = Math.min(c, SK[id].cost || 100);
      return c;
    }

    gainEnergy(p, n) {
      if (!this.skillsOn || !p.kit) return;
      if (n > 0 && p.passive === 'chengzhang' && this.score[p.idx] < this.score[1 - p.idx]) n *= 1.5; // 追风成长：逆风充能更快
      const was = p.energy;
      p.energy = clamp(p.energy + n, 0, 100);
      const need = this.minCost(p);
      if (was < need && p.energy >= need) this.emit({ type: 'skillReady', p: p.idx });
    }

    /** 能否发动第 slot 个主动技能 */
    canUse(p, slot = 0) {
      const id = p.kit && p.kit.act[slot], def = id && YY.SKILLS ? YY.SKILLS[id] : null;
      if (!this.skillsOn || !def || def.passive) return false;
      if (this.phase === 'over' || this.phase === 'point' || p.skillCd > 0) return false;
      return p.energy >= (def.cost || 100);
    }

    /** 清除对手身上正在生效的技能（数据清洗、吹哨） */
    purge(o) {
      const SK = YY.SKILLS || {};
      for (const k in o.buff) if (SK[k] || k === 'chance' || k === 'read' || k === 'readSoft' || k === 'blinkQ') o.buff[k] = 0;
      o.blinks = 0; o.cnt = {}; o.stack = 0;
      if (this.slowFor === o.idx) this.slowT = 0;
    }

    /** 发动技能：slot 0 / 1 对应携带的两个主动技能 */
    useSkill(p, slot = 0) {
      if (!this.canUse(p, slot)) return false;
      const id = p.kit.act[slot], def = YY.SKILLS[id], o = this.players[1 - p.idx];
      p.energy -= def.cost || 100; p.skillCd = 0.5;
      const dur = def.dur || 0, b = p.buff;
      if (dur > 0) b[id] = dur;
      switch (id) {
        case 'chaoxi': case 'baowen': p.stamina = C.STAM_MAX; break;
        case 'tangping': p.stamina = C.STAM_MAX; b.chance = dur; break; // 躺平之后：下一记扣杀直接“抄底”
        case 'huanshi': this.slowT = dur; this.slowFor = p.idx; break;
        case 'lengxiao': o.buff.laugh = dur; p.stamina = Math.min(C.STAM_MAX, p.stamina + 30); break;
        case 'shanxian': p.blinks = 2; break;
        case 'touji': b.chance = 0; p.stamina = Math.min(C.STAM_MAX, p.stamina + 40); break;
        case 'tuichao': o.stamina = Math.max(0, o.stamina - 50); o.buff.drained = dur; this.gainEnergy(o, -15); break;
        case 'changchao': p.stack = 0; break;
        case 'liuxing': p.cnt.liuxing = 1; break;
        case 'liuxingyu': b.liuxing = dur; p.cnt.liuxing = 3; break;
        case 'tianmi': o.buff.sticky = dur; break;
        case 'huicheng':
          if (!(this.phase === 'serve' && this.server === p.idx)) { p.x = p.side * 3; p.vx = 0; }
          p.stamina = C.STAM_MAX; break;
        case 'err404': o.buff.curse = dur; this.emit({ type: 'skillProc', p: o.idx, id, label: '404 Not Found' }); break;
        case 'qingxi': this.purge(o); this.gainEnergy(o, -30); b.read = 6; this.emit({ type: 'skillProc', p: o.idx, id, label: '技能已清洗' }); break;
        case 'hanxing': o.buff.root = dur; o.vx = 0; this.emit({ type: 'skillProc', p: o.idx, id, label: '定身！' }); break;
        case 'shaosheng': this.purge(o); o.buff.stun = dur; this.emit({ type: 'skillProc', p: o.idx, id, label: '哨声！暂停' }); break;
      }
      this.emit({ type: 'skill', p: p.idx, id, name: def.name, slot });
      return true;
    }

    handlePress(p, pr) {
      if (this.phase === 'over' || this.phase === 'point') return;
      if (pr.btn === 'skill' || pr.btn === 'skill2') { this.useSkill(p, pr.btn === 'skill2' ? 1 : 0); return; }
      if (pr.btn === 'jump') {
        if (p.buff.root > 0) return;
        if (!p.onGround || p.land > 0) return;
        if (this.phase === 'serve' && p.idx === this.server) return;
        const v = this.jumpVelocity(p);
        const cost = C.JUMP_COST * this.costMul(p, true);
        if (p.stamina >= cost) { p.stamina -= cost; }
        else this.emit({ type: 'tired', p: p.idx });
        p.stamDelay = C.STAM_DELAY;
        p.vy = v; p.onGround = false;
        this.emit({ type: 'jump', p: p.idx });
        return;
      }
      if (!['clear', 'drop', 'smash'].includes(pr.btn)) return;
      if (p.buff.stun > 0 && this.phase === 'rally') return; // 吹哨：短暂无法挥拍
      if (this.phase === 'serve') {
        if (p.idx === this.server && !this.serving) this.startServe(p, pr.btn, null);
        return;
      }
      if (p.swing || p.cooldown > 0) {
        if (this.phase === 'rally') { p.bufferedShot = pr.btn; p.bufferT = C.SW_BUFFER; }
        return;
      }
      p.bufferedShot = null; p.bufferT = 0;
      this.beginSwing(p, pr.btn, pr.lead);
    }

    beginSwing(p, btn, lead = 0) {
      const s = this.shuttle;
      const vy = s.y - (p.y + C.SHOULDER);
      const kind = vy > 0.25 ? 'over' : vy < -0.4 ? 'under' : 'side';
      p.swing = {
        t: clamp(lead || 0, 0, 0.08), btn, kind, dur: Math.max(C.SW_W1 + C.DT, C.SW_DUR * p.st.handling),
        hit: false, prevE: 99, judged: false, serve: false,
      };
      p.swing.dur = Math.max(C.SW_W1 + C.DT, p.swing.dur * this.mods(p).swing);
      this.emit({ type: 'swing', p: p.idx, btn });
    }

    jumpVelocity(p) {
      const base = p.stamina >= C.JUMP_COST * this.costMul(p, true) ? C.JUMP_V : C.JUMP_V_LOW;
      return base * p.st.jump * this.mods(p).jump;
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

    checkContact(p, dt, previous, flightTime = dt) {
      const sw = p.swing;
      const s = this.shuttle;
      if (!sw || sw.hit || sw.serve) return;
      if (!s.live || s.held || s.lastHitter === p.idx) return;
      if (previous && !s.netHit && s.crossedNet) return this.checkSweptContact(p, dt, previous, flightTime);
      if (sw.t < C.SW_W0) return;
      if (sw.t > C.SW_W1) {
        if (!sw.judged) { sw.judged = true; this.judgeWhiff(p); }
        return;
      }
      // 必须实际越过球网且球头完全进入己方半场；扑救容差不能越网或救回下网球。
      if (s.netHit || !s.crossedNet || p.side * s.x <= C.SHUTTLE_R) { sw.prevE = 99; return; }
      const e = this.ringError(p, s);
      const reach = this.reachFor(p);
      if (e < reach && (e > sw.prevE + 1e-4 || e < 0.07 || sw.t + dt > C.SW_W1)) {
        this.doHit(p, sw, e, reach);
        return true;
      }
      sw.prevE = e;
    }

    checkSweptContact(p, dt, previous, flightTime) {
      const sw = p.swing, s = this.shuttle, startT = sw.t - dt;
      const duration = Math.max(1e-12, flightTime), endU = Math.min(1, flightTime / dt);
      const lo = Math.max(0, (C.SW_W0 - startT) / dt), hi = Math.min(endU, (C.SW_W1 - startT) / dt);
      const old = previous.players[p.idx], end = { x: s.x, y: s.y };
      let best = null, lastE = 99;
      if (hi >= lo) {
        const relative = Math.hypot(end.x - previous.x - (p.x - old.x), end.y - previous.y - (p.y - old.y));
        const n = Math.max(2, Math.min(96, Math.ceil(relative / 0.025)));
        for (let i = 0; i <= n; i++) {
          const u = lo + (hi - lo) * i / n, f = Math.min(1, u * dt / duration);
          const q = { x: YY.lerp(previous.x, end.x, f), y: YY.lerp(previous.y, end.y, f) };
          if (p.side * q.x <= C.SHUTTLE_R || q.y <= C.SHUTTLE_R + 1e-8) continue;
          const player = { dir: p.dir, x: YY.lerp(old.x, p.x, u), y: YY.lerp(old.y, p.y, u) };
          const e = this.ringError(player, q); lastE = e;
          if (!best || e < best.e) best = { e, u, q, player };
        }
      }
      const reach = this.reachFor(p);
      if (best && best.e < reach && (best.e < 0.07 || lastE > best.e + 1e-4 ||
          best.e > sw.prevE + 1e-4 || sw.t + dt > C.SW_W1)) {
        const pose = { x: p.x, y: p.y, onGround: p.onGround }, time = sw.t;
        s.x = best.q.x; s.y = best.q.y;
        p.x = best.player.x; p.y = best.player.y; p.onGround = p.y <= 0;
        sw.t = startT + best.u * dt;
        this.doHit(p, sw, best.e, reach);
        Object.assign(p, pose); sw.t = time;
        return true;
      }
      sw.prevE = lastE;
      if (sw.t > C.SW_W1 && !sw.judged) { sw.judged = true; this.judgeWhiff(p); }
      return false;
    }

    /** 当前来球的击球判定容差：快球允许扑救；平抽、点杀更宽容，跳杀更苛刻 */
    reachFor(p) {
      const s = this.shuttle, st = p.st, M = this.mods(p), fast = s.speed > 12;
      let reach = fast ? C.REACH_FAST * st.defense * M.reachFast : C.REACH * st.reach;
      if (fast && (s.shot === 'drive' || s.shot === 'halfsmash')) reach *= 1.12;
      else if (fast && s.shot === 'smash') reach *= 0.9;
      if (fast && p.passive === 'wenti' && Math.abs(p.vx) < 0.8) reach *= 1.2; // 问题不大：站稳接快球
      if (fast && p.passive === 'baozi') reach *= 1.08; // 包子体质：接快球更稳
      if (M.netReach !== 1 && Math.abs(p.x) < 2.5) reach *= M.netReach;
      if (p.buff.pokong > 0) reach *= 1.2;
      return reach * M.reach;
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
      const M = this.mods(p), b = p.buff;
      const tq = clamp(1 - Math.abs(sw.t - C.SW_SWEET) / (0.1 * M.timing), 0, 1);
      const pq = clamp(1 - e / (reach || C.REACH), 0, 1);
      let q = clamp(0.55 * pq + 0.45 * tq, 0, 1);
      const inSpeed = s.speed, inShot = s.shot;
      const ctx = { save: false, lowSave: false };
      const soft = M.saveFree ? 0 : p.passive === 'baozi' ? 0.5 : 1; // 包子体质：救球惩罚减半
      if (inSpeed > 15 && inShot === 'smash') { q *= 1 - 0.38 * soft; ctx.save = true; } // 接跳杀：回球质量明显下降
      if (s.y < 0.45) { q *= 1 - 0.15 * soft; ctx.lowSave = true; }
      // 跑动中勉强击球：速度越快，回球质量越差（防侧翻鞋可减轻）
      const lunge = clamp((Math.abs(p.vx) - 2.2) / 3, 0, 1) * p.st.lunge;
      if (lunge > 0) { q *= 1 - 0.3 * Math.min(1, lunge); ctx.stretch = true; }
      // 来球附带的压制（重杀、流星、搓网、细腻手感……）
      const oq = s.oppQ == null ? 1 : s.oppQ;
      if (oq < 1) q *= oq;
      if (s.fire) ctx.burned = true;
      if (s.meteor || s.crawl) ctx.meteor = true;
      else if (inShot === 'tumble') ctx.tumbled = true;
      if (b.duzi > 0 && inSpeed > 12) { q = Math.max(q, 0.75); ctx.skill = 'duzi'; }
      q = clamp(q + M.qAdd + (b.changchao > 0 ? p.stack * 0.05 : 0), 0, 1);
      if (M.qMin) { const was = q; q = Math.max(q, M.qMin); if (q > was && !ctx.skill) ctx.skill = b.jiaoke > 0 ? 'jiaoke' : b.shenglv > 0 ? 'shenglv' : b.gongshi > 0 ? 'gongshi' : null; }
      if (p.passive === 'qiuling') q = Math.max(q, 0.5);
      if (b.huicheng > 0) { q = Math.min(1, q + 0.2); b.huicheng = 0; }
      if (b.blinkQ > 0) { q = Math.min(1, q + 0.15); b.blinkQ = 0; ctx.skill = 'shanxian'; }
      if (b.read > 0) { q = 1; b.read = 0; ctx.skill = p.buff.shuju > 0 ? 'shuju' : 'qingxi'; }
      else if (b.readSoft > 0) { q = Math.min(1, q + 0.25); b.readSoft = 0; ctx.skill = 'jilu'; }
      const pk = b.pokong > 0;
      if (pk) { q = 1; ctx.skill = 'pokong'; b.pokong = 0; }
      const counter = b.fantan > 0 && inSpeed > 12 && FAST_IN[inShot];
      if (counter) { q = 1; b.fantan = 0; ctx.skill = 'fantan'; }
      if (b.curse > 0) { q = Math.min(q, 0.35); b.curse = 0; ctx.cursed = true; }
      if (b.changchao > 0) p.stack = Math.min(6, p.stack + 1);
      const shot = this.resolveShot(p, sw.btn, q, false, { boost: pk, counter });
      s.vx = shot.vx; s.vy = shot.vy;
      sw.kind = s.y > p.y + C.SHOULDER + 0.25 ? 'over' : s.y < p.y + C.SHOULDER - 0.4 ? 'under' : 'side';
      s.fire = !!shot.fire;
      s.meteor = !!shot.meteor;
      s.crawl = !!shot.crawl;
      if (!shot.pump) s.pumpBy = -1;
      if (shot.pump) { ctx.skill = b.touji > 0 ? 'touji' : 'tangping'; s.pumpBy = b.touji > 0 ? p.idx : -1; b.chance = 0; } // 只有“投机·抄底”的重扣得分才返还能量
      else if (shot.fire && !counter) { b.lieyan = 0; ctx.skill = 'lieyan'; }
      if (shot.meteor) {
        p.cnt.liuxing = (p.cnt.liuxing || 1) - 1;
        if (p.cnt.liuxing <= 0) { b.liuxing = 0; b.liuxingyu = 0; }
        ctx.skill = b.liuxingyu > 0 || p.cnt.liuxing > 0 ? 'liuxingyu' : 'liuxing';
      }
      if (shot.crawl) { b.cuoqiu = 0; ctx.skill = 'cuoqiu'; }
      if (b.jinghua > 0) { b.jinghua = 0; s.feint = 0.55; s.feintHit = this.hitCount + 1; q = Math.max(q, 0.8); ctx.skill = 'jinghua'; }
      if (b.shuiyue > 0) { b.shuiyue = 0; s.wobble = true; ctx.skill = 'shuiyue'; }
      // 这一拍给接球方带去的质量压制
      const attack = shot.type === 'smash' || shot.type === 'kill' || shot.type === 'halfsmash';
      let press = 1;
      if (shot.fire) press *= 0.55;
      if (shot.meteor || shot.crawl) press *= 0.6;
      else if (shot.type === 'tumble') press *= 0.82;
      if (pk && attack) press *= 0.7;
      if (shot.type === 'smash') press *= M.oppQSmash;
      if (p.passive === 'xini' && NET_ZONE[shot.type]) press *= 0.8;
      s.oppQ = press;
      if (p.passive === 'zhuiguang' && NET_ZONE[shot.type]) b.zg = 2;
      if (M.drain) { const o = this.players[1 - p.idx]; o.stamina = Math.max(0, o.stamina - M.drain); }
      if (shot.type === 'smash') {
        sw.dur = (M.noSmashSlow ? C.SW_DUR : C.SW_SMASH_DUR) * p.st.handling;
        p.slow = M.noSmashSlow ? 0.08 : 0.45;
        p.stamina = Math.max(0, p.stamina - C.SMASH_COST * this.costMul(p, false));
        p.stamDelay = C.STAM_DELAY;
        this.hitstop = 0.065;
      } else if (shot.type === 'kill' || shot.type === 'halfsmash') {
        p.stamina = Math.max(0, p.stamina - C.SMASH_COST * 0.35 * this.costMul(p, false));
        p.stamDelay = C.STAM_DELAY;
        this.hitstop = 0.045;
      } else if (shot.type === 'drive') this.hitstop = Math.max(this.hitstop, 0.03); // 平抽也有短暂顿帧，给接球方一点反应提示
      else if (q >= 0.85) this.hitstop = Math.max(this.hitstop, 0.022); // 完美击球的微顿帧，手感更“实”
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
      if (p.blinkBack && !ctx.serve) { // 猿人闪现：打完立刻闪回中场
        p.blinkBack = false;
        const from = p.x; p.x = p.side * 3; p.vx = 0;
        this.emit({ type: 'blink', p: p.idx, from, to: p.x, back: true });
      }
      this.hitCount++;
      if (!ctx.serve) this.rally++;
      const passive = p.passive;
      if (ctx.serve) { s.fire = false; s.feint = 0; s.meteor = false; s.crawl = false; s.wobble = false; s.oppQ = 1; }
      else {
        let gain = 3 + (q >= 0.85 ? 2 : 0) + (ctx.save || ctx.lowSave ? 3 : 0);
        if (passive === 'chengzhang' && q >= 0.85) gain += 3;
        if (passive === 'chaoxi_p' && this.rally > 6) gain += 2;
        if (passive === 'baozi' && (ctx.save || ctx.lowSave)) gain += 4;
        this.gainEnergy(p, gain);
      }
      // 隐藏落点：假动作、流星、搓网、甜蜜陷阱；同一引拍让提示晚出现
      s.hide = !ctx.serve && (s.feint > 0 || !!s.meteor || !!s.crawl || !!this.mods(p).hide);
      s.veil = !ctx.serve && passive === 'xushi' ? 0.2 : 0;
      const st = this.stats[p.idx];
      st.hits++;
      if (q >= 0.85) st.perfect++;
      if (shot.type === 'smash' || shot.type === 'halfsmash') st.smash++;
      if (ctx.save || ctx.lowSave) st.saves++;
      this.history[p.idx].push(YY.SHOT_CAT[shot.type] || shot.type);
      if (this.history[p.idx].length > 6) this.history[p.idx].shift();
      this.pred = YY.simulate(s.x, s.y, s.vx, s.vy, 6, true, false, this.env);
      this.pred.t0 = this.time;
      this.pred.hidden = this.hintHidden();
      if (!ctx.serve) this.reactSkills(p, q);
      const label = q >= 0.85 ? '完美' : q >= 0.6 ? '好球' : q >= 0.35 ? '一般' : '勉强';
      this.emit({
        type: 'hit', p: p.idx, shot: shot.type, name: YY.SHOT_NAMES[shot.type], q, label,
        speed: s.speed, x: s.x, y: s.y, vx: s.vx, vy: s.vy, reason: shot.reason || null,
        save: ctx.save, lowSave: ctx.lowSave, serve: !!ctx.serve, weak: q < 0.35,
        skill: ctx.skill || null, burned: !!ctx.burned, fire: !!s.fire, meteor: !!s.meteor || !!s.crawl, tumbled: !!ctx.tumbled, hurt: !!ctx.meteor,
        cursed: !!ctx.cursed, guard: ctx.guard || null,
      });
    }

    /** 对手刚击球后，触发接球方的被动技能：数据透视、投机抄底、猿人闪现 */
    reactSkills(hitter, q) {
      const o = this.players[1 - hitter.idx], s = this.shuttle, b = o.buff;
      if (o.passive === 'benneng' && q < 0.6) this.gainEnergy(o, 8); // 投机本能：机会球就是能量
      if (o.passive === 'jilu' && !(b.readSoft > 0)) {
        const h = this.history[hitter.idx], n = h.length;
        if (n >= 3 && h[n - 1] === h[n - 2] && h[n - 2] === h[n - 3]) {
          b.readSoft = 3;
          this.emit({ type: 'skillProc', p: o.idx, id: 'jilu', label: '数据记录：看穿了' });
        }
      }
      if (b.shuju > 0) {
        this.pred.hidden = false; s.feint = 0; s.hide = false; s.veil = 0; s.wobble = false;
        const h = this.history[hitter.idx];
        if (h.length >= 2 && h[h.length - 1] === h[h.length - 2] && !(b.read > 0)) {
          b.read = 3;
          this.emit({ type: 'skillProc', p: o.idx, id: 'shuju', label: '看穿套路！' });
        }
      }
      if (b.touji > 0 && q < 0.6 && !(b.chance > 0)) {
        b.chance = 4;
        this.emit({ type: 'skillProc', p: o.idx, id: 'touji', label: '抄底机会！' });
      }
      if (b.shanxian > 0 && o.blinks > 0 && this.pred) {
        // 选一个“来得及挥拍”的击球点：优先离现在 ≥0.35 秒、高度 1~2.3 米的下落点；快球则取最后一个够得着的点
        let pt = null, last = null;
        for (const k of this.pred.pts) {
          if (o.side * k.x < 0.4 || k.vy >= 0 || k.y > 2.3 || k.y < 1.0) continue;
          last = k;
          if (k.t >= 0.35) { pt = k; break; }
        }
        pt = pt || last;
        const tx = pt ? pt.x : this.pred.landX, ty = pt ? pt.y : 0.9;
        if (o.side * tx > C.X_FAR + 0.6) return; // 明显出界：不去追
        const sy = clamp(ty - C.SHOULDER, -0.78, 0.78), sx = Math.sqrt(Math.max(0.05, C.ARM * C.ARM - sy * sy));
        const nx = clamp(o.side * (tx - o.dir * sx), C.X_NEAR, C.X_FAR) * o.side;
        const from = o.x;
        o.x = nx; o.vx = 0; o.blinks--; b.blinkQ = 1.6; o.replan = true; o.blinkBack = true;
        this.emit({ type: 'blink', p: o.idx, from, to: nx });
      }
    }

    /** 根据按键、击球点与质量决定球路与初速度 */
    resolveShot(p, btn, q, isServe, opt) {
      const o2 = opt && typeof opt === 'object' ? opt : { boost: !!opt };
      const boost = !!o2.boost, counter = !isServe && !!o2.counter;
      const s = this.shuttle;
      const dir = p.dir;
      const d = Math.abs(s.x);
      const back = -dir * s.x; // 击球点在己方离网距离（可为负：已过网）
      const h = s.y;
      const opp = this.players[1 - p.idx];
      const oppD = Math.abs(opp.x);
      const mod = clamp(this.inputs[p.idx].move, -1, 1); // +1 = 向网，-1 = 向后
      const pump = !isServe && p.buff.chance > 0 && btn === 'smash';
      const st = p.st, fire = (!isServe && p.buff.lieyan > 0) || pump || counter, star = !isServe && p.buff.liuxing > 0, pro = !isServe && p.buff.jiaoke > 0;
      const M = isServe ? BASE_MOD : this.mods(p);
      const quick = !isServe && p.buff.pingchou > 0; // 平抽快打
      // 进攻球速倍率：技能 + 叠浪层数
      const atk = M.shot * (!isServe && p.buff.changchao > 0 ? 1 + 0.04 * p.stack : 1);
      let type, reason = null;

      if (isServe) type = btn;
      else if (counter) type = 'drive';
      else if (quick && btn !== 'drop' && h >= 1.0 && h <= 2.3 && !(btn === 'smash' && !p.onGround && h >= C.SMASH_MIN_Y)) { type = 'drive'; q = Math.min(1, q + 0.15); }
      else if (btn === 'smash') {
        const air = !p.onGround;
        const cost = C.SMASH_COST * this.costMul(p, false);
        if (d <= 1.9 && h >= 1.78 && p.stamina >= cost * 0.35 && !(air && h >= C.SMASH_MIN_Y && d > 1.2)) type = 'kill'; // 网前高点：扑球
        else if (air && h >= C.SMASH_MIN_Y - (fire ? 0.3 : 0) && p.stamina >= cost) type = 'smash';
        else if (h >= 2.0 && p.stamina >= cost * 0.35) type = 'halfsmash'; // 不起跳的点杀：快、准、省体力
        else {
          reason = p.stamina < cost * 0.35 ? '体力不足' : '击球点太低';
          type = h >= 1.45 ? 'drive' : 'lift';
        }
      } else if (btn === 'clear') {
        if (h >= 1.7) type = mod > 0.5 ? 'flatclear' : 'clear';
        else if (d <= 2.6 && h >= 1.1 && mod > 0.5) type = 'push'; // 网前推后场：又平又快
        else type = 'lift';
      } else {
        if (d <= 2.3 && h < 1.95) type = h >= 1.2 && q >= 0.6 && mod >= -0.5 ? 'tumble' : 'net';
        else if (h >= 1.7) type = mod > 0.5 ? 'slice' : 'drop';
        else type = 'block';
      }

      // 控制 / 网前手感越好，同样的击球质量误差越小
      const prec = TOUCHY[type] ? st.touch : st.control;
      const miss = clamp((1 - q) / prec, 0, 1) * (pro ? 0.5 : 1);
      const deep = (st.power - 1) * 1.2; // 力量让高远球更深
      // 选手按“平常的手感”出球：特殊环境（风、高原）只被部分适应
      const E = this.env, ad = E ? (E.adapt != null ? E.adapt : 0.5) : 0;
      const senv = E ? { drag: C.DRAG + ((E.drag != null ? E.drag : C.DRAG) - C.DRAG) * ad, wind: (E.wind || 0) * ad } : undefined;
      let ang, speed, target;
      const tNoise = gauss() * miss * 0.45;
      const solveUp = (a0, tgt, margin) => {
        // 固定角度求速度；若过网高度不足则抬高角度
        let a = a0, v = 0;
        for (let k = 0; k < 10; k++) {
          v = YY.solveSpeed(s.x, s.y, dir, a, tgt + back, senv);
          const rad = (a * Math.PI) / 180;
          const ny = YY.netClear(s.x, s.y, v * Math.cos(rad) * dir, v * Math.sin(rad), senv);
          if (ny >= C.NET_CLEAR + margin) break;
          if (a >= 72 || k === 9) break;
          a = Math.min(72, a + 6);
        }
        return [a, v];
      };

      if (!isServe && p.buff.cuoqiu > 0 && NET_ZONE[type]) {
        // 搓球魔术：擦网翻滚，几乎垂直落在网下
        const jit = Math.abs(tNoise) * 0.12;
        if (d <= 2.6 && h < 1.1) { target = 0.62 + jit; [ang, speed] = solveUp(64, target, 0.07); }
        else if (d <= 2.6 && h <= 1.9) { target = 0.42 + jit; [ang, speed] = solveUp(24, target, 0.07); }
        else if (d <= 2.6) { target = 0.6 + jit; [ang, speed] = solveUp(14, target, 0.09); }
        else { target = 0.85 + Math.abs(tNoise) * 0.15; [ang, speed] = solveUp(h > 2.6 ? 0 : 12, target, 0.1); } // 后场吊过来：贴网急坠
        const rad = (ang * Math.PI) / 180;
        return { type: 'tumble', reason, crawl: true, vx: Math.cos(rad) * speed * dir, vy: Math.sin(rad) * speed };
      }
      if (star && (type === 'drop' || type === 'slice' || type === 'net' || type === 'block' || type === 'tumble')) {
        // 流星坠：极速贴网急坠
        target = 0.75 + Math.abs(tNoise) * 0.3;
        [ang, speed] = solveUp(h > 2 ? -12 : h > 1.5 ? 12 : 40, target, 0.04);
        speed *= 1.05;
        const rad = (ang * Math.PI) / 180;
        return { type, reason, meteor: true, vx: Math.cos(rad) * speed * dir, vy: Math.sin(rad) * speed };
      }
      switch (type) {
        case 'clear':
          target = Math.min(6.2, 5.95 - miss * 2.6 + tNoise + deep + (pro ? 0.25 : 0));
          [ang, speed] = solveUp(h > 2.6 ? 46 : 50, target, 1.6);
          break;
        case 'flatclear':
          target = 5.75 - miss * 2.2 + tNoise;
          [ang, speed] = solveUp(p.passive === 'chuanxian' && !isServe ? 26 : 30, target, 0.7);
          break;
        case 'lift':
          target = Math.min(6.1, 5.7 - miss * 2.7 + tNoise + deep);
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
        case 'tumble':
          // 搓球：贴着网带翻滚过网，落点极近
          target = 0.55 + miss * 0.5 + Math.abs(tNoise) * 0.35;
          [ang, speed] = solveUp(h > 1.5 ? 28 : 50, target, 0.03);
          break;
        case 'push':
          target = Math.min(6.0, 5.2 - miss * 1.8 + tNoise);
          [ang, speed] = solveUp(p.passive === 'chuanxian' ? 10 : 14, target, 0.35);
          break;
        case 'kill': {
          speed = (15 + 4.5 * q) * st.power * (fire ? 1.22 : 1) * atk * M.kill;
          target = clamp(oppD + (oppD < 3 ? 1.6 : -0.9), 1.4, 3.4) + tNoise * 0.4;
          ang = YY.solveAngle(s.x, s.y, dir, speed, target + back, -70, 0, senv);
          for (let k = 0; k < 12; k++) {
            const rad = (ang * Math.PI) / 180;
            if (YY.netClear(s.x, s.y, speed * Math.cos(rad) * dir, speed * Math.sin(rad), senv) >= C.NET_CLEAR + 0.05) break;
            ang += 3;
          }
          break;
        }
        case 'halfsmash': {
          // 点杀：不起跳、出手快，但球速明显低于跳杀，给接球方留出反应时间
          speed = (13.8 + 3.6 * q) * st.power * (fire ? 1.22 : 1) * atk;
          target = clamp(oppD < 3.4 ? oppD + 1.2 : oppD - 1.0, 2.0, 4.6) + tNoise;
          ang = YY.solveAngle(s.x, s.y, dir, speed, target + back, -40, 8, senv);
          for (let k = 0; k < 12; k++) {
            const rad = (ang * Math.PI) / 180;
            if (YY.netClear(s.x, s.y, speed * Math.cos(rad) * dir, speed * Math.sin(rad), senv) >= C.NET_CLEAR + 0.1) break;
            ang += 2.5;
          }
          break;
        }
        case 'block':
          target = 1.5 + tNoise * 0.6;
          [ang, speed] = solveUp(40, Math.max(0.6, target), 0.25);
          break;
        case 'smash': {
          // 跳杀：全场最快的球，越靠近网越凶
          speed = (21 + 6.5 * q) * (d < 3.6 ? 1.1 : d > 5.2 ? 0.9 : 1) * st.power * atk * M.smash;
          if (p.passive === 'zuiyou') speed *= 1.03;
          if (fire) speed *= 1.22;
          else if (boost) speed *= 1.12;
          // 自动瞄向对手站位的空当一侧；偏离距离取决于击球质量
          const off = 1.0 + 0.9 * q + (d < 3.6 ? 0.4 : 0);
          let deep = oppD < 3.4;
          if (mod > 0.5) deep = false;
          else if (mod < -0.5) deep = true;
          target = clamp(oppD + (deep ? off : -off), 1.7, 5.7);
          target = Math.min(target + tNoise, 6.3);
          ang = YY.solveAngle(s.x, s.y, dir, speed, target + back, -50, 8, senv);
          // 过网检查
          for (let k = 0; k < 12; k++) {
            const rad = (ang * Math.PI) / 180;
            if (YY.netClear(s.x, s.y, speed * Math.cos(rad) * dir, speed * Math.sin(rad), senv) >= C.NET_CLEAR + 0.08) break;
            ang += 2.5;
          }
          break;
        }
        case 'drive':
          // 平抽：又平又快，但比杀球慢，能看清再挡
          speed = (12.6 + 3.4 * q) * st.power * atk * (p.passive === 'chuanxian' && !isServe ? 1.1 : 1) * (quick || counter ? 1.2 : 1) * (fire && !counter ? 1.1 : 1);
          target = (oppD < 3.3 ? 4.6 : 3.4) + tNoise;
          // 击球点低时又快又平的球很难压进界内：自动收力，保证技能强化的平抽不会白白出界
          for (let tries = 0; tries < 8; tries++) {
            ang = YY.solveAngle(s.x, s.y, dir, speed, target + back, -20, 30, senv);
            for (let k = 0; k < 12; k++) {
              const rad = (ang * Math.PI) / 180;
              if (YY.netClear(s.x, s.y, speed * Math.cos(rad) * dir, speed * Math.sin(rad), senv) >= C.NET_CLEAR + 0.12) break;
              ang += 3;
            }
            if (!(quick || counter || fire)) break;
            const rad = (ang * Math.PI) / 180, land = YY.simulate(s.x, s.y, speed * Math.cos(rad) * dir, speed * Math.sin(rad), 6, false, false, senv).landX;
            if (land * dir <= C.HALF - 0.35) break;
            speed *= 0.9;
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
      const attack = type === 'smash' || type === 'kill' || type === 'halfsmash';
      return { type, reason, fire: fire && (attack || counter), pump: pump && attack, counter, vx: Math.cos(rad) * speed * dir, vy: Math.sin(rad) * speed };
    }

    /** 救球保险 / 双机热备：本该落地的球被自动救回 */
    tryGuard(x) {
      const s = this.shuttle, idx = x < 0 ? 0 : 1, g = this.players[idx];
      if (this.practice || s.netHit || s.lastHitter === idx || s.lastHitter < 0) return false;
      if (Math.abs(x) > C.HALF + C.LINE_TOL || Math.abs(x) < C.SHUTTLE_R) return false;
      const key = g.buff.baoxian > 0 ? 'baoxian' : g.buff.rebei > 0 && Math.abs(x) < 3 ? 'rebei' : null;
      if (!key) return false;
      g.buff[key] = 0;
      s.x = g.side * Math.max(Math.abs(x), 0.5); s.y = 0.4; s.live = true; s.held = false; s.netHit = false;
      const shot = this.resolveShot(g, 'clear', 0.85, false);
      s.vx = shot.vx; s.vy = shot.vy;
      this.afterHit(g, shot, 0.85, { save: true, guard: key });
      this.emit({ type: 'skillProc', p: idx, id: key, label: key === 'rebei' ? '热备接管！' : '保险生效！' });
      return true;
    }

    onLand(x) {
      const s = this.shuttle;
      if (this.tryGuard(x)) return;
      s.live = false;
      s.vx = 0; s.vy = 0; s.speed = 0;
      for (const p of this.players) { p.bufferedShot = null; p.bufferT = 0; }
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
      if (!inB || s.netHit) {
        loser = hitter; reason = s.netHit ? '下网' : '出界'; kind = 'error';
      } else if (landIdx === hitter) {
        loser = hitter; reason = s.netHit ? '下网' : '未过网'; kind = 'error';
      } else {
        loser = landIdx; kind = 'winner';
        reason = nearLine ? '压线好球！' : (YY.SHOT_NAMES[s.shot] || '') + '得分';
        if (s.shot === 'smash' || s.shot === 'halfsmash' || s.shot === 'kill') this.stats[hitter].smashWin++;
        this.stats[hitter].winners++;
      }
      if (kind === 'error') {
        this.stats[hitter].errors++;
        if (s.isServe) reason = '发球失误 · ' + reason;
      }
      const winner = 1 - loser;
      this.score[winner]++;
      const W = this.players[winner], Lp = this.players[loser];
      if (kind === 'winner' && s.pumpBy === winner) { this.gainEnergy(W, 40); s.pumpBy = -1; }
      if (kind === 'winner' && W.passive === 'zuiyou' && (s.shot === 'smash' || s.shot === 'halfsmash' || s.shot === 'kill')) this.gainEnergy(W, 15);
      this.gainEnergy(Lp, 13 + (Lp.passive === 'wenti' ? 10 : 0));
      this.gainEnergy(W, 4);
      if (W.passive === 'qifen') this.gainEnergy(Lp, -10);
      s.fire = false; s.feint = 0; s.meteor = false; s.crawl = false; s.wobble = false; s.hide = false; s.veil = 0;
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
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof window !== 'undefined' ? window : globalThis);
