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
  const BUN_SCALE = 0.6; // 超大肉包球：包着的球飞得慢
  const RUSH_SCALE = 1.3; // 刚拆包的一小段：比平常还快
  const TOUCHY = { net: 1, drop: 1, slice: 1, block: 1, sserve: 1, tumble: 1 }; // 受“网前手感”影响的球路

  // 技能修正的默认值：倍率类为 1，加成类为 0，开关类为 0
  const BASE_MOD = { move: 1, accel: 1, reach: 1, reachFast: 1, netReach: 1, jump: 1, smash: 1, kill: 1, shot: 1, qAdd: 0, qMin: 0,
    free: 0, jumpFree: 0, regen: 1, noSmashSlow: 0, timing: 1, hide: 0, saveFree: 0, swing: 1, drain: 0, smashCost: 1, oppQSmash: 1,
    noSwing: 0, noJump: 0, fix: 0 };
  const MOD_ADD = { qAdd: 1, drain: 1 }, MOD_MAX = { qMin: 1, free: 1, jumpFree: 1, noSmashSlow: 1, hide: 1, saveFree: 1, noSwing: 1, noJump: 1, fix: 1 };
  // 对手施加的负面状态与被动产生的短暂状态（不是技能本身，不显示光环）
  // 技能状态（buff 计时器）：move/jump 倍率；noSwing 不能挥拍；noJump 不能起跳；fix 站位固定
  const STATUS = {
    dive: { noSwing: 1, noJump: 1 }, prone: { move: 0, noSwing: 1, noJump: 1 },
    shensuo: { move: 0.9, noSwing: 1 }, xuanpai: { move: 0.75, noSwing: 1 }, shoushi: { move: 0.85 }, youyou: {},
    overclock: { accel: 1.15 }, vineStrike: { reach: 1.12, qAdd: .1 }, tailwind: { accel:1.25, move:1.1 }, tideSave: { smashCost:.8 },
    vine: { noJump: 1 }, margin: { move: 0.3, noSwing: 1, noJump: 1 }, lag: { move: 0.6 },
    hold: { noSwing: 1 }, tripped: {},
    // v4：击退、湿身、震麻、滑倒、卡顿、持球、驾云
    knock: { noJump: 1 }, soaked: { move: 0.72, accel: 0.7 }, stun: { move: 0, noJump: 1 }, slip: { noSwing: 1, noJump: 1 },
    bugged: { accel: 0.55 }, cradle: { move: 0.7, noJump: 1 },
    // 果哥：押注时全力以赴；对手弯腰捡红包
    grab: { move: 0, noJump: 1 },
  };
  // 场内持续性技能：回合结束不消失，倒计时只在回合进行中走（装置种类 / 状态计时）
  const PERSIST = { board: 1, wind: 1, moon: 1, mini: 1, peel: 1, pane: 1, cone: 1, appoint: 1, gale: 1, pool: 1, guide: 1, replace: 1, clone: 1 };
  // 持续准备与场上装置跨小分；本球慢放、位移动作和短特效不跨分。
  const NEW_PERSIST = new Set(['jibei','yimo','weichui','dianbu','bianpai','tongqin','gongwei','jiaban','sanbu','yipai','jingmo']);
  const newPersistent = e => e.k === 'newskill' && NEW_PERSIST.has(e.sid);
  const persistent = e => !!PERSIST[e.k] || newPersistent(e);
  // 查找替换（老陈）：会被替换掉的进攻球路
  const ATTACK = { smash: 1, halfsmash: 1, kill: 1, drive: 1, flatclear: 1, push: 1 };
  const GRAV_FLIP = 1, GRAV_CEIL = 6.6; // 星星的重力球：开关打开时重力翻转（向上飘），最高悬停在 6.6 米（仍在画面里）
  const GRAV_DRAIN = 6; // 重力换班每秒耗能
  const BUN_G = 7; // 肉包飞行的重力（比真实轻一点，好瞄）
  const RIBBON_L = 3.8; // 红丝带最长
  YY.GRAV_CEIL = GRAV_CEIL;
  const PERSIST_BUFF = { tangqiu: 1, jiewang: 1, xingmen: 1, jiezou: 1 };
  YY.SKILL_PERSIST = PERSIST;
  YY.SKILL_STATUS = STATUS;
  const NET_ZONE = { net: 1, tumble: 1, drop: 1, block: 1, slice: 1 };
  const FAST_IN = { smash: 1, halfsmash: 1, kill: 1, drive: 1 };
  // ---------- 器械特性（球拍 / 球鞋的 trait.k，见 roster.js） ----------
  const SMASHY = { smash: 1, halfsmash: 1, kill: 1 }; // “扣杀”类来球
  /** 星轨·变奏的三类球路：高远／挑球、吊球／网前球、平抽／扣杀 */
  const CAT3 = { clear: 'A', flatclear: 'A', lift: 'A', push: 'A', drop: 'B', slice: 'B', net: 'B', tumble: 'B', block: 'B', drive: 'C', smash: 'C', halfsmash: 'C', kill: 'C' };
  const traitOf = (id) => (id && YY.gearTrait ? YY.gearTrait(id) : null);
  /** 选手的球拍 / 球鞋特性 */
  const rTrait = (p) => (p.gear ? traitOf(p.gear.r) : null);
  const sTrait = (p) => (p.gear ? traitOf(p.gear.s) : null);
  const freshGT = () => ({ bt: 0, bk: 0, cd: {}, cats: [], tideN: 0, tideGain: 0, press: 0, calm: 0, calmOn: 0, run: 0, runDir: 0, home: 0, back: 0, moonW: 0, jumped: 0, reboundW: 0, hq: null });
  /** 技能组：字符串 = 单个主动（旧接口），数组 = 主动列表，对象 = { passive, act } */
  function normKit(k) {
    if (!k) return null;
    if (typeof k === 'string') return { passive: null, act: [k] };
    if (Array.isArray(k)) return { passive: null, act: k.filter(Boolean).slice(0, 2) };
    return { passive: k.passive || null, act: (k.act || []).filter(Boolean).slice(0, 2) };
  }
  YY.normKit = normKit;

  function makePlayer(idx, side, st, skill, gear) {
    const kit = normKit(skill);
    return {
      idx, side, dir: -side,
      x: side * 3, y: 0, vx: 0, vy: 0, onGround: true,
      stamina: C.STAM_MAX, stamDelay: 0, peakV: 0, runSgn: 0, spent: 0,
      swing: null, cooldown: 0, slow: 0, land: 0,
      bufferedShot: null, bufferT: 0, jumpBuffer: 0,
      motion: { speed: 0, accel: 0, air: 0, land: 0, split: 0 },
      runPhase: 0, lastShot: null, flash: 0,
      st: Object.assign({}, BASE_STATS, st || {}),
      kit, skill: kit && kit.act[0] || null, passive: kit && kit.passive || null,
      energy: 0, buff: {}, cnt: {}, stack: 0, skillCd: 0,
      market: kit && kit.passive === 'jihui' ? { coins:500, tier:2, bet:null, delta:0, flash:0 } : null,
      hist: [], still: 0, push: 0, drive: null,
      gear: gear && (gear.racket || gear.shoe) ? { r: gear.racket || null, s: gear.shoe || null } : null, // 外观与特性只看球拍、球鞋
      gt: freshGT(),
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
      this.players = [0, 1].map((i) => makePlayer(i, i ? 1 : -1, o.stats && o.stats[i], o.skills && o.skills[i], o.gear && o.gear[i]));
      this.skillsOn = this.players.some((p) => p.kit && (p.kit.act.length || p.kit.passive));
      this.env = o.env || null;
      this.slowT = 0; this.slowFor = -1;
      this.looks = o.looks || null;
      this.titles=YY.titleIds?YY.titleIds(o.titles):[null,null];
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
      this.ents = []; this.eid = 0; // 场上的技能装置、标记、假球（真实计分的羽毛球始终只有 this.shuttle 一只）
      this.sk = { half: [C.HALF, C.HALF], netUp: 0, shift: 0, option: null, potato: null, beat: null, used: [{}, {}], seen: [{}, {}] };
      this.resetPoint(true);
    }

    get names() { return this.opt.names; }

    emit(e) { this.events.push(e); }

    serveMeter() { return tri(this.serveT * 1.15); }

    resetPoint(first) {
      this.phase = 'serve';
      for (const p of this.players) { p.fooled = false; p.replan = false; }
      this.serveT = 0;
      this.serving = null;
      this.rally = 0;
      this.pred = null;
      for (const p of this.players) {
        const isSrv = p.idx === this.server;
        p.x = p.side * (isSrv ? 2.3 : 2.8);
        p.y = 0; p.vx = 0; p.vy = 0; p.onGround = true;
        p.swing = null; p.cooldown = 0; p.slow = 0; p.land = 0;
        p.bufferedShot = null; p.bufferT = 0; p.jumpBuffer = 0;
        p.motion = { speed: 0, accel: 0, air: 0, land: 0, split: 0 };
        // 体力不再每分回满：一分结束只喘口气，长回合的消耗会带到下一分
        p.stamina = first || this.practice ? C.STAM_MAX : Math.min(C.STAM_MAX, p.stamina + C.STAM_POINT * p.st.regen);
        p.stamDelay = 0; p.stack = 0; p.peakV = 0; p.runSgn = 0;
        p.hist.length = 0; p.still = 0; p.push = 0; p.drive = null;
        p.gt = freshGT();
      }
      const s = this.shuttle;
      s.live = false; s.held = true; s.netHit = false; s.crossedNet = false; s.lastHitter = -1; s.shot = null;
      s.vx = 0; s.vy = 0; s.speed = 0; s.fire = false; s.feint = 0; s.meteor = false;
      s.crawl = false; s.hide = false; s.veil = 0; s.wobble = false; s.oppQ = 1;
      s.ctl = null; s.selfToss = -1; s.cloneBy = null; s.relayQ = 0; s.ver = (s.ver || 0) + 1; s.path = [];
      this.slowT = 0;
      if (this.skReset) this.skReset(!!first);
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
      } else if (s.live && s.ctl) {
        this.skControl(dt); // 挂网、绕月、牵引、哨停、倒流：球由技能控制，暂停物理
        if (this.phase === 'rally' && s.ctl && (s.ctl.k === 'tether' || s.ctl.k === 'orbit')) for (const p of this.players) if (this.checkContact(p, dt, null)) break;
      } else if (s.live) {
        const pred = this.pred, scale = this.shuttleScale(dt), r = YY.stepShuttle(s, dt * scale, this.physEnv());
        const flightTime = s.stepTime / scale;
        // Prediction samples use simulated time; advance their clock by the exact step taken.
        if (Number.isFinite(pred?.t0) && scale !== 1) pred.t0 += dt * (1 - scale);
        s.speed = Math.hypot(s.vx, s.vy);
        const netNow = !previous?.netHit && s.netHit;
        if (netNow && this.skNet(previous)) { /* 蝴蝶结、借网、挂网：撞网的球被技能接管 */ }
        else if (netNow) this.emit({ type: 'net', x: s.x, y: s.y });
        const dev = this.skShuttle(previous, r);
        let hit = false;
        if (!dev && this.phase === 'rally' && !s.netHit) for (const p of this.players) {
          if (this.checkContact(p, dt, previous, flightTime)) { hit = true; break; }
        }
        if (!hit && !dev && this.phase === 'rally' && !s.netHit && this.ents.length) hit = this.cloneContact(dt, previous, flightTime); // 复制体：同一拍也能替本体接球
        if (r === 'floor' && !hit && !dev && s.live) this.onLand(s.x);
      }
      this.skStep(dt);
      this.gearStep();

      if (this.phase === 'point') {
        this.pointTimer -= dt;
        if (this.pointTimer <= 0) {
          if (this.winner >= 0) { this.phase = 'over'; this.emit({ type: 'over', winner: this.winner }); }
          else if (this.practice) this.phase = 'idle';
          else this.resetPoint(false);
        }
      }
    }

    /** 当前的物理环境：场馆风 / 空气，加上技能（防火墙抬高网、重力换班） */
    physEnv() {
      const base = this.env, sk = this.sk, s = this.shuttle;
      const grav = !!(s.grav && this.players[s.grav.o] && this.players[s.grav.o].buff.gravOn > 0); // 重力翻转：只对重力球生效
      const gale = this.ents.length ? this.ents.find(e => e.k === 'gale') : null; // 鱼跃挂起的风
      if (!(sk.netUp > 0) && !grav && !gale) return base;
      const e = Object.assign({}, base || {});
      if (sk.netUp > 0) e.netH = C.NET_H + 0.9;
      if (grav) { e.g = -(e.g != null ? e.g : 1) * GRAV_FLIP; e.ceil = GRAV_CEIL; }
      if (gale) e.wind = (e.wind || 0) + gale.w;
      return e;
    }
    /** 选手 i 所在半场的长度（坐标平移、短场练习会改变） */
    halfOf(i) { return this.sk.half[i]; }

    updatePlayer(p, dt) {
      const oldV = p.vx, wasGround = p.onGround;
      p.jumpBuffer = Math.max(0, (p.jumpBuffer || 0) - dt);
      if (this.phase !== 'rally' && this.phase !== 'idle') p.jumpBuffer = 0;
      p.bufferT = Math.max(0, (p.bufferT || 0) - dt);
      if (!p.bufferT || this.phase !== 'rally') p.bufferedShot = null;
      const inp = this.inputs[p.idx];
      for (const pr of inp.presses) this.handlePress(p, pr);
      inp.presses.length = 0;

      const lockedServer = this.phase === 'serve' && p.idx === this.server;
      const frozen = this.phase === 'over';
      let mv = lockedServer || frozen ? 0 : clamp(inp.move, -1, 1);
      const st = p.st, b = p.buff, M = this.mods(p), sh = this.shuttle;
      if (p.land > 0) mv *= 1 - .4 * clamp(p.land / (.08 * st.land), 0, 1);
      mv = this.skMove(p, mv, dt);
      const vig = this.vigor(p);
      const maxV = this.maxSpeed(p, M) * (p.slow > 0 ? 1 - .4 * clamp(p.slow / .22, 0, 1) : 1);
      const targetV = mv * p.dir * maxV;
      const gm = this.gearMove(p, mv, dt); // 球鞋特性：起动加成
      if (p.drive != null) { p.vx = p.drive; p.drive = null; } // 鱼跃、弹射等技能直接给定水平速度
      else if (p.onGround) {
        // 疲劳时起动和急停都变慢：折返跑更吃力
        const a = (Math.abs(mv) > 0.05 ? C.ACCEL * gm * (mv * p.dir * p.vx < -.4 ? 1.12 : 1) : C.DECEL) * st.accel * M.accel * (0.6 + 0.4 * vig);
        const dv = targetV - p.vx;
        p.vx += clamp(dv, -a * dt, a * dt);
      } else {
        const dv = targetV - p.vx;
        p.vx += clamp(dv, -C.AIR_ACCEL * dt, C.AIR_ACCEL * dt);
      }
      p.x += p.vx * dt + p.push * dt; p.push = 0; // push：潮水等外力
      this.runCost(p, dt);
      const dist = clamp(p.side * p.x, C.X_NEAR, Math.min(C.X_FAR, this.halfOf(p.idx) + 0.6));
      if (dist !== p.side * p.x) p.vx = 0;
      p.x = p.side * dist;

      if (!p.onGround) {
        const g = C.G;
        p.y += p.vy * dt - 0.5 * g * dt * dt;
        p.vy -= g * dt;
        if (p.y <= 0) {
          p.y = 0; p.vy = 0; p.onGround = true; p.land = 0.08 * st.land;
          this.emit({ type: 'land', p: p.idx });
          this.skLanded(p);
          this.gearLanded(p);
        }
      }
      p.runPhase += Math.hypot(p.vx, p.vz || 0) * dt * 2.6;
      const foot = Math.floor(p.runPhase / Math.PI);
      if (p.onGround && Math.hypot(p.vx,p.vz||0)>1.6 && foot !== p.footBeat && p.footBeat != null)
        this.emit({type:'step',p:p.idx,x:p.x,z:p.z});
      p.footBeat=foot;

      if (p.swing) {
        p.swing.t += dt;
        if (p.swing.t >= p.swing.dur) {
          const missed = !p.swing.hit && !p.swing.serve;
          if (missed) this.spend(p, C.SWING_MISS_COST * this.costMul(p, true));
          p.swing = null; p.cooldown = missed ? C.SW_MISS_RECOVER : C.SW_RECOVER;
        }
      }
      p.cooldown -= dt; p.slow -= dt; p.land -= dt; p.flash -= dt; p.skillCd -= dt;
      if (p.jumpBuffer > 0 && p.onGround && p.land <= 0) {
        p.jumpBuffer = 0; this.handlePress(p, { btn: 'jump' });
      }
      const motion = p.motion || { speed: 0, accel: 0, air: 0, land: 0, split: 0 };
      p.motion = {
        speed: YY.lerp(motion.speed, p.vx * p.dir, 1 - Math.exp(-26 * dt)),
        accel: YY.lerp(motion.accel, clamp((p.vx - oldV) * p.dir / (C.ACCEL * dt), -1, 1), 1 - Math.exp(-22 * dt)),
        air: p.onGround ? 0 : (wasGround ? 0 : motion.air) + dt,
        land: !wasGround && p.onGround ? .2 : Math.max(0, motion.land - dt),
        split: Math.max(0, motion.split - dt),
      };
      if (p.bufferedShot && !p.swing && p.cooldown <= 0) {
        const btn = p.bufferedShot; p.bufferedShot = null; p.bufferT = 0;
        this.handlePress(p, { btn });
      }
      p.stamDelay -= dt;
      for (const k in b) if (b[k] > 0 && (this.phase === 'rally' || !PERSIST_BUFF[k])) b[k] -= dt; // 持续性技能：回合间暂停倒计时
      // 回合中站稳才能真正喘过气来；碎步调整、发球准备时缓慢恢复；冲刺和腾空时不恢复
      const movingSpeed = Math.hypot(p.vx, p.vz || 0);
      const still = p.onGround && movingSpeed < 0.6 && !p.swing && !p.shotQueue3D;
      const rate = this.phase === 'rally' ? (still ? C.STAM_REST : movingSpeed < C.STAM_JOG && p.onGround && !p.swing && !p.shotQueue3D ? C.STAM_MOVE_REGEN : 0)
        : this.phase === 'serve' ? C.STAM_MOVE_REGEN : C.STAM_REGEN;
      const regen = rate * st.regen * M.regen * this.gearRegen(p, dt);
      if (p.stamDelay <= 0 || M.regen >= 2) p.stamina = Math.min(C.STAM_MAX, p.stamina + regen * dt);
      this.skPlayer(p, dt);
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
      if (this.skillsOn && this.entOf('guide', p.idx)) M.timing *= 1.2;
      if (p.market && YY.MARKET_TIERS) {
        const t = YY.marketStyle(p.market);
        M.move *= t.move; M.accel *= t.move; M.jump *= t.jump; M.reach *= t.reach;
        M.smash *= t.power; M.kill *= t.power; M.shot *= 1 + (t.power - 1) * .35;
        M.regen *= 1 + (t.move - 1) * .5;
      }
      return M;
    }

    /** 体力消耗倍率（free：完全不耗；jumpFree：起跳不耗；smashCost：扣杀消耗倍率） */
    costMul(p, jump) {
      const M = this.mods(p);
      if (M.free || (jump && M.jumpFree)) return 0;
      return p.st.stamCost * (jump ? 1 : M.smashCost);
    }

    /** 体能状态 0（力竭）~ 1（充沛）：高于 STAM_FRESH 没有惩罚 */
    vigor(p) {
      if (this.mods(p).free) return 1;
      return clamp(p.stamina / C.STAM_FRESH, 0, 1);
    }
    /** 当前最大移动速度：力竭时降到约 72% */
    maxSpeed(p, M) {
      return C.MOVE * p.st.move * (M || this.mods(p)).move * (0.72 + 0.28 * this.vigor(p));
    }
    /** 扣除体力（已乘装备 / 技能倍率）；delay=true 时短暂停止恢复 */
    spend(p, n, delay = true) {
      if (!(n > 0)) return;
      const was = p.stamina;
      p.stamina = Math.max(0, p.stamina - n);
      p.spent = (p.spent || 0) + (was - p.stamina);
      if (delay) p.stamDelay = Math.max(p.stamDelay, C.STAM_DELAY);
      if (was >= C.STAM_FRESH * 0.5 && p.stamina < C.STAM_FRESH * 0.5) this.emit({ type: 'tired', p: p.idx, low: true });
    }
    /** 跑动消耗：冲刺持续耗体力；高速时急停反向（折返跑）一次性扣一笔 */
    runCost(p, dt) {
      if (this.phase !== 'rally' || !p.onGround) { p.peakV = 0; p.runSgn = 0; return; }
      const mul = this.costMul(p, true);
      const sp = Math.abs(p.vx);
      if (sp > C.STAM_JOG) this.spend(p, (sp - C.STAM_JOG) * C.STAM_RUN * dt * mul, false);
      const sgn = sp > 0.4 ? Math.sign(p.vx) : 0;
      if (sgn && p.runSgn && sgn !== p.runSgn && p.peakV > 2.2) {
        this.spend(p, C.STAM_TURN * clamp(p.peakV / C.MOVE, 0, 1.2) * mul);
        this.emit({ type: 'turn', p: p.idx, v: p.peakV });
        p.peakV = 0;
      }
      if (sgn) { if (sgn !== p.runSgn) p.peakV = 0; p.runSgn = sgn; }
      p.peakV = Math.max(p.peakV * Math.exp(-dt * 1.5), sp);
    }

    /** 落点提示是否隐藏 */
    hintHidden() {
      const s = this.shuttle;
      return !!(s.hide || s.veil > 0 || s.ctl);
    }

    /** 当前来球的时间倍率（缓时技能只放慢飞向技能方的球） */
    shuttleScale() {
      const s = this.shuttle;
      if (s.bun) return BUN_SCALE;
      if (s.rush > 0) return RUSH_SCALE;
      return this.slowT > 0 && s.lastHitter !== this.slowFor ? SLOW_SCALE : 1;
    }
    /** 把“模拟时间”换算成真实时间（缓时期间球飞得慢，AI 与提示据此修正时机） */
    realT(tau) {
      const ts = this.shuttleScale();
      if (ts === 1) return tau;
      if (this.shuttle.bun) return tau / ts;
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
      const was = p.energy;
      p.energy = clamp(p.energy + n, 0, 100);
      const need = this.minCost(p);
      if (was < need && p.energy >= need) this.emit({ type: 'skillReady', p: p.idx });
    }

    handlePress(p, pr) {
      if (this.phase === 'over' || this.phase === 'point') return;
      if (pr.btn === 'skill' || pr.btn === 'skill2') { this.useSkill(p, pr.btn === 'skill2' ? 1 : 0, pr); return; }
      const M = this.mods(p);
      if (pr.btn === 'jump') {
        if (M.noJump) return;
        if (this.phase === 'serve' && p.idx === this.server) return;
        if (!p.onGround || p.land > 0) {
          if (this.phase === 'rally' && ((p.onGround && p.land > 0) || (p.vy < -1 && p.y < .18))) p.jumpBuffer = C.JUMP_BUFFER;
          return;
        }
        const v = this.jumpVelocity(p);
        const cost = C.JUMP_COST * this.costMul(p, true) * this.gearJump(p);
        if (p.stamina < cost) this.emit({ type: 'tired', p: p.idx });
        this.spend(p, cost);
        p.vy = v; p.onGround = false; p.jumpBuffer = 0;
        this.emit({ type: 'jump', p: p.idx });
        return;
      }
      if (!['clear', 'drop', 'smash'].includes(pr.btn)) return;
      if (this.phase === 'rally' && this.skSwingBlocked(p, pr.btn, M)) return; // 鱼跃、翻滚、守门、卧推、哨停……此时挥不了拍
      if (this.phase === 'serve') {
        if (p.idx === this.server && !this.serving) this.startServe(p, pr.btn, null);
        return;
      }
      if (p.swing || p.cooldown > 0) {
        const remaining = p.swing ? p.swing.dur - p.swing.t + (p.swing.hit ? C.SW_RECOVER : C.SW_MISS_RECOVER) : p.cooldown;
        if (this.phase === 'rally' && remaining <= C.SW_BUFFER) { p.bufferedShot = pr.btn; p.bufferT = C.SW_BUFFER; }
        return;
      }
      p.bufferedShot = null; p.bufferT = 0;
      this.beginSwing(p, pr.btn, pr.lead, !!pr.paid3D);
    }

    beginSwing(p, btn, lead = 0, paid3D = false) {
      if (p.swing || p.cooldown > 0) return;
      if (!paid3D) this.spend(p, (btn === 'smash' ? C.SWING_POWER_COST : C.SWING_COST) * this.costMul(p, true));
      const s = this.shuttle;
      const vy = s.y - (p.y + C.SHOULDER);
      const kind = vy > 0.25 ? 'over' : vy < -0.4 ? 'under' : 'side';
      p.swing = {
        t: clamp(lead || 0, 0, 0.08), btn, kind, dur: Math.max(C.SW_W1 + C.DT, C.SW_DUR * p.st.handling),
        hit: false, prevE: 99, judged: false, serve: false,
      };
      // 疲劳让收拍变慢：下一拍准备不及（击球窗口本身不变，保证判定公平）
      p.swing.dur = Math.max(C.SW_W1 + C.DT, p.swing.dur * this.mods(p).swing * (1 + 0.32 * (1 - this.vigor(p))));
      p.swing.style = this.swingStyle(p, btn);
      if (this.ents.length) this.cloneSwing(p, false); // 复制体同步挥拍（可以击球）
      this.emit({ type: 'swing', p: p.idx, btn, style: p.swing.style });
    }

    /** 起跳初速：体力越少跳得越低（力竭时只剩“垫一下”） */
    jumpVelocity(p) {
      const f = this.vigor(p);
      const base = C.JUMP_V_LOW + (C.JUMP_V - C.JUMP_V_LOW) * Math.sqrt(f);
      return base * p.st.jump * this.mods(p).jump;
    }

    /** 挥拍动作风格：起拍时按击球点预判（真正击中后改为实际球路），供动画与好友端使用 */
    swingStyle(p, btn) {
      const s = this.shuttle;
      if (this.phase !== 'rally') return btn === 'drop' ? 'sserve' : 'lserve';
      // 估计约 0.1 秒后球在身前的高度（起拍到击球的典型间隔）
      const h = Math.max(0.1, s.y + s.vy * 0.1 - 0.05), d = Math.abs(p.x), mod = clamp(this.inputs[p.idx].move, -1, 1);
      if (btn === 'smash') {
        if (d <= 1.9 && h >= 1.6) return 'kill';
        if (!p.onGround) return 'smash';
        return h >= 1.95 ? 'halfsmash' : h >= 1.3 ? 'drive' : 'lift';
      }
      if (btn === 'clear') {
        if (h >= 1.7) return mod > 0.5 ? 'flatclear' : 'clear';
        if (d <= 2.6 && h >= 1.1 && mod > 0.5) return 'push';
        return 'lift';
      }
      if (d <= 2.3 && h < 1.95) return h >= 1.2 && mod >= -0.5 ? 'tumble' : 'net';
      if (h >= 1.7) return mod > 0.5 ? 'slice' : 'drop';
      return 'block';
    }

    startServe(p, btn, forceQ) {
      const m = this.serveMeter();
      const q = forceQ != null ? forceQ : clamp(1 - Math.abs(m - 0.5) * 2, 0, 1);
      this.serving = { t: 0, btn: btn === 'drop' ? 'sserve' : 'lserve', q };
      p.swing = { t: 0, btn, kind: 'under', dur: 0.32, hit: true, prevE: 99, judged: true, serve: true, style: this.serving.btn };
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
      const toss = s.selfToss === p.idx; // 自抛自扣：允许这一次连续触球
      if (!s.live || s.held || (s.lastHitter === p.idx && !toss)) return;
      if (s.ctl && s.ctl.k !== 'tether' && !(s.ctl.k === 'orbit' && s.ctl.o === p.idx)) return; // 月亮里绕圈的球：星星自己可以直接挥拍打走
      if (previous && !s.netHit && s.crossedNet && !toss) return this.checkSweptContact(p, dt, previous, flightTime);
      if (sw.t < C.SW_W0) return;
      if (sw.t > C.SW_W1) {
        if (!sw.judged) { sw.judged = true; this.judgeWhiff(p); }
        return;
      }
      // 必须实际越过球网且球头完全进入己方半场；扑救容差不能越网或救回下网球。
      if (s.netHit || (!s.crossedNet && !toss) || p.side * s.x <= C.SHUTTLE_R) { sw.prevE = 99; return; }
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
      if (s.lever > 1 && s.lastHitter !== p.idx) reach *= 1 - 0.08 * (s.lever - 1); // 加了杠杆的杀球更难接
      else if (fast && s.shot === 'smash') reach *= 0.9;
      if (M.netReach !== 1 && Math.abs(p.x) < 2.5) reach *= M.netReach;
      if (s.selfToss === p.idx) reach *= 1.25; // 自抛的球就在头顶：好找点
      if (s.bun && s.lastHitter !== p.idx) reach *= 1.25; // 大肉包：体积大，好接
      return reach * M.reach * (0.9 + 0.1 * this.vigor(p)); // 累了够球范围变小
    }

    judgeWhiff(p) {
      const s = this.shuttle;
      if (!s.live || s.netHit || s.lastHitter === p.idx) return;
      const dx = s.x - p.x, dy = s.y - (p.y + C.SHOULDER);
      const r = Math.hypot(dx, dy);
      if (r > 4.5) {
        this.emit({ type: 'whiff', p: p.idx, label: '挥空：球还远' });
        this.skWhiff(p,dx*s.vx+dy*s.vy<0,dy);
        return;
      }
      const approaching = dx * s.vx + dy * s.vy < 0;
      let label;
      if (r > C.ARM + C.REACH + 0.9) label = approaching ? '挥拍太早' : '没够到';
      else label = approaching ? '挥拍太早' : '挥拍太晚';
      this.emit({ type: 'whiff', p: p.idx, label });
      this.skWhiff(p, approaching, dy);
    }

    doHit(p, sw, e, reach) {
      const s = this.shuttle;
      sw.hit = true;
      const M = this.mods(p), b = p.buff;
      let tq = clamp(1 - Math.abs(sw.t - C.SW_SWEET) / (0.1 * M.timing), 0, 1);
      const pq = clamp(1 - e / (reach || C.REACH), 0, 1);
      const rt = rTrait(p), gt = p.gt || (p.gt = freshGT()), gfx = [];
      if (rt && rt.k === 'steady' && tq < 1) { if (tq < 0.8) gfx.push('steady'); tq = 1 - (1 - tq) * (1 - rt.v); } // 柔风·初晴：时机误差的损失减少
      let q = clamp(0.55 * pq + 0.45 * tq, 0, 1);
      const inSpeed = s.speed, inShot = s.shot;
      const ctx = { save: false, lowSave: false, incomingSpeed: inSpeed };
      if (inSpeed > 15 && inShot === 'smash') { q *= 1 - 0.38; ctx.save = true; } // 接跳杀：回球质量明显下降
      if (s.y < 0.45) { q *= 1 - 0.15; ctx.lowSave = true; }
      // 跑动中勉强击球：速度越快，回球质量越差（防侧翻鞋可减轻）
      const lunge = clamp((Math.hypot(p.vx, p.vz || 0) - 2.2) / 3, 0, 1) * p.st.lunge;
      if (lunge > 0) { q *= 1 - 0.3 * Math.min(1, lunge); ctx.stretch = true; }
      const oq = s.oppQ == null ? 1 : s.oppQ;
      if (oq < 1) q *= oq;
      if (inShot === 'tumble') ctx.tumbled = true;
      if (b.tripped > 0) { q *= 0.7; ctx.tripped = true; } // 被弹线绊了一下：接球姿态变形
      // 体能不足：拍面控制变差（力竭时质量约打八五折）
      const vig = this.vigor(p);
      if (vig < 1) { q *= 0.85 + 0.15 * vig; if (vig < 0.35) ctx.tired = true; }
      q = clamp(q + M.qAdd, 0, 1);
      if (M.qMin) q = Math.max(q, M.qMin);
      if (s.selfToss === p.idx) { q = Math.max(q, s.tossSkill === 'huiguo' ? 0.85 : s.tossSkill === 'jieli' ? (s.relayQ || 0.75) : s.tossSkill==='youyou'?.82:0.7); ctx.skill = s.tossSkill || 'zipao'; } // 自抛自扣 / 假拍的第二段
      q = this.skHitQ(p, q, ctx); // 节拍、闪现、押题
      // 器械特性要用的触球情况（resolveShot 只读取，不改状态）
      gt.hq = { pq, tq, counter: !!SMASHY[inShot] && s.lastHitter !== p.idx && p.onGround && Math.abs(p.vx) < 1.2 && pq >= 0.7 };
      const prevHitter = s.lastHitter;
      const shot = this.resolveShot(p, sw.btn, q, false);
      gt.hq = null;
      if (shot.gtk) gfx.push(...shot.gtk);
      this.skShot(p, shot, ctx); // 角色连招对这一拍的修正
      s.vx = shot.vx; s.vy = shot.vy;
      sw.kind = s.y > p.y + C.SHOULDER + 0.25 ? 'over' : s.y < p.y + C.SHOULDER - 0.4 ? 'under' : 'side';
      if (sw.style !== shot.type || shot.type === 'smash') { sw.fromStyle = sw.style; sw.fromDur = sw.dur; }
      sw.style = shot.type; // 从预判球路平滑过渡到实际球路的随挥
      s.oppQ = shot.type === 'tumble' ? 0.82 : 1;
      const back = Math.abs(p.x);
      if (shot.type === 'smash') {
        sw.dur = C.SW_SMASH_DUR * p.st.handling * this.mods(p).swing * (1 + 0.32 * (1 - vig));
        p.slow = 0.22;
        this.spend(p, C.SMASH_COST * this.costMul(p, false));
        this.hitstop = 2 * C.DT;
      } else if (shot.type === 'kill' || shot.type === 'halfsmash') {
        this.spend(p, C.SMASH_COST * 0.35 * this.costMul(p, false));
        this.hitstop = C.DT;
      } // 普通回球不冻结模拟；力量感由短拍风、接触闪光与音效提供。
      // 发力球：高远、挑球、推后场要全身发力，后场起跳点越深越累
      if (shot.type === 'clear' || shot.type === 'lift' || shot.type === 'flatclear' || shot.type === 'push')
        this.spend(p, C.STAM_POWER * (back > 5 ? 1.5 : 1) * this.costMul(p, true), false);
      // 跑动中弓步够球、下手救低球：腿部负荷大
      if (ctx.stretch || ctx.lowSave) this.spend(p, C.STAM_LUNGE * this.costMul(p, true), false);
      // 雷霆·赤脊：自己的高远球被对手在后场接到 → 对手下一拍跳杀加速的机会属于“我”
      const other = this.players[1 - p.idx], ot = rTrait(other);
      if (ot && ot.k === 'press' && prevHitter === other.idx && (inShot === 'clear' || inShot === 'flatclear') && Math.abs(s.x) >= 4.4 && !other.gt.press) {
        other.gt.press = 1; this.emit({ type: 'gear', p: other.idx, k: 'pressReady', x: other.x, y: other.y + 2 });
      }
      if (rt && rt.k === 'press' && gt.press && !shot.gtk?.includes('press')) gt.press = 0; // 改打其他球路：这次机会用掉了
      this.afterHit(p, shot, q, ctx);
      // 疾风·切羽：接住扣杀，本次剩余收拍时间缩短
      if (rt && rt.k === 'quick' && SMASHY[inShot] && prevHitter !== p.idx && p.swing === sw) { sw.dur -= Math.max(0, sw.dur - sw.t) * rt.v; gfx.push('quick'); }
      for (const k of gfx) this.emit({ type: 'gear', p: p.idx, k, x: s.x, y: s.y });
    }

    afterHit(p, shot, q, ctx) {
      const s = this.shuttle;
      ctx.incomingType = s.shot; ctx.incomingSkill = s.skillTag;
      s.skillTag = ctx.skill || null; s.cloneBy = this.cloneHitting && this.cloneHitting.o === p.idx ? p.idx : null; // 复制体打出的球：落在己方半场可弹起一次
      s.lastHitter = p.idx;
      s.netHit = false;
      s.crossedNet = false;
      s.shot = shot.type;
      s.isServe = !!ctx.serve;
      s.speed = Math.hypot(s.vx, s.vy);
      s.hitX = s.x;
      // 绘制和联机快照使用实际接触点，发球也遵循同一条路径。
      if (p.swing) { p.swing.contact = { x: s.x, y: s.y, t: p.swing.t }; p.swing.q = q; p.swing.tier = YY.hitTier(q); }
      p.lastShot = shot.type;
      p.flash = 0.15;
      const receiver = this.players[1 - p.idx];
      if (receiver.onGround) receiver.motion = { ...receiver.motion, split: .18 };
      s.selfToss = -1; s.relayQ = 0; s.ctl = null; s.ver = (s.ver || 0) + 1; s.path = [];
      this.hitCount++;
      if (!ctx.serve) this.rally++;
      if (ctx.serve) { s.fire = false; s.feint = 0; s.meteor = false; s.crawl = false; s.wobble = false; s.oppQ = 1; }
      else this.gainEnergy(p, 3 + (q >= 0.85 ? 2 : 0) + (ctx.save || ctx.lowSave ? 3 : 0));
      s.hide = false; s.veil = 0;
      const st = this.stats[p.idx];
      st.hits++;
      if (q >= 0.85) st.perfect++;
      if (shot.type === 'smash' || shot.type === 'halfsmash') st.smash++;
      if (ctx.save || ctx.lowSave) st.saves++;
      this.history[p.idx].push(YY.SHOT_CAT[shot.type] || shot.type);
      if (this.history[p.idx].length > 6) this.history[p.idx].shift();
      this.pred = YY.simulate(s.x, s.y, s.vx, s.vy, 6, true, false, this.physEnv());
      this.pred.t0 = this.time;
      this.pred.hidden = this.hintHidden();
      this.skAfterHit(p, shot, q, ctx);
      if (!ctx.serve) this.gearAfterHit(p, shot);
      const label = q >= 0.85 ? '完美' : q >= .4 ? '正常' : '勉强';
      this.emit({
        type: 'hit', p: p.idx, shot: shot.type, name: YY.SHOT_NAMES[shot.type], q, label,
        speed: s.speed, x: s.x, y: s.y, vx: s.vx, vy: s.vy, reason: shot.reason || null,
        save: ctx.save, lowSave: ctx.lowSave, serve: !!ctx.serve, weak: q < .4, highSmash: shot.type === 'smash' && s.y >= 2.9 && q >= .6,
        skill: ctx.skill || null, ...(ctx.edit ? { edit:ctx.edit } : {}), ...(ctx.office?{office:ctx.office}:{}), burned: !!ctx.burned, fire: !!s.fire, meteor: !!s.meteor || !!s.crawl, tumbled: !!ctx.tumbled, hurt: !!ctx.meteor,
        cursed: !!ctx.cursed, guard: ctx.guard || null, device: !!ctx.device, big: !!ctx.big, gust: !!ctx.gust,
      });
    }

    /** 根据按键、击球点与质量决定球路与初速度 */
    resolveShot(p, btn, q, isServe, opt) {
      const s = this.shuttle;
      const dir = p.dir;
      const d = Math.abs(s.x);
      const back = -dir * s.x; // 击球点在己方离网距离（可为负：已过网）
      const h = s.y;
      const opp = this.players[1 - p.idx];
      const oppD = Math.abs(opp.x);
      const mod = clamp(this.inputs[p.idx].move, -1, 1); // +1 = 向网，-1 = 向后
      const st = p.st, fire = false, pro = false;
      const M = isServe ? BASE_MOD : this.mods(p);
      const atk = M.shot;
      // 对手半场被缩短（坐标平移、短场练习）：深球按比例收进来，但击球质量越差越容易出界
      const oh = this.halfOf(1 - p.idx), short = oh < C.HALF - 0.05;
      const fit = (t) => !short || t <= oh - 0.6 ? t : (oh - 0.6) + (t - (oh - 0.6)) * 0.3 + (1 - q) * 0.9;
      let type, reason = null;

      if (isServe) type = btn;
      else if (btn === 'smash') {
        const air = !p.onGround || (this.skillsOn && p.cnt.nv?.platform > 0);
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

      // 器械特性：落点误差（细针落点、精确解、第三种答案）与出球加速（压后再杀、借势反抽）
      const gk = isServe ? null : this.gearShotMods(p, type);
      const ek = gk ? gk.err : 1, boost = gk ? gk.spd : 1;
      // 控制 / 网前手感越好，同样的击球质量误差越小
      const prec = TOUCHY[type] ? st.touch : st.control;
      const miss = clamp((1 - q) / prec, 0, 1) * (pro ? 0.5 : 1);
      // 体能：力竭时发力球打不到底线、挑球不够高，杀球与平抽球速下降
      const vig = isServe ? 1 : this.vigor(p), weak = 1 - vig;
      const deep = (st.power - 1) * 1.2 - weak * 1.15; // 力量让高远球更深；疲劳让它变浅
      const pace = 0.86 + 0.14 * vig;
      // 选手按“平常的手感”出球：特殊环境（风、高原）只被部分适应
      const E = this.env, ad = E ? (E.adapt != null ? E.adapt : 0.5) : 0;
      const senv = E ? { drag: C.DRAG + ((E.drag != null ? E.drag : C.DRAG) - C.DRAG) * ad, wind: (E.wind || 0) * ad } : undefined;
      let ang, speed, target;
      const tNoise = gauss() * miss * 0.45 * ek;
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

      switch (type) {
        case 'clear':
          target = fit(Math.min(6.2, 5.95 - miss * 2.6 + tNoise + deep));
          [ang, speed] = solveUp(h > 2.6 ? 46 : 50, target, 1.6);
          break;
        case 'flatclear':
          target = fit(5.75 - miss * 2.2 + tNoise - weak * 0.9);
          [ang, speed] = solveUp(30, target, 0.7);
          break;
        case 'lift':
          target = fit(Math.min(6.1, 5.7 - miss * 2.7 + tNoise + deep));
          [ang, speed] = solveUp(d < 1.5 ? 66 : 60, target, 1.6 - weak * 0.6);
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
          target = fit(Math.min(6.0, 5.2 - miss * 1.8 + tNoise - weak * 0.8));
          [ang, speed] = solveUp(14, target, 0.35);
          break;
        case 'kill': {
          speed = (15 + 4.5 * q) * st.power * (fire ? 1.22 : 1) * atk * M.kill * pace;
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
          speed = (13.8 + 3.6 * q) * st.power * (fire ? 1.22 : 1) * atk * pace;
          target = fit(clamp(oppD < 3.4 ? oppD + 1.2 : oppD - 1.0, 2.0, 4.6) + tNoise);
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
          speed = (23 + 7 * q) * (1 + clamp((h - C.SMASH_MIN_Y) / 1.5, 0, 1) * .18 * q) * (d < 3.6 ? 1.1 : d > 5.2 ? 0.9 : 1) * st.power * atk * M.smash * pace * boost;
          // 自动瞄向对手站位的空当一侧；偏离距离取决于击球质量
          const off = 1.0 + 0.9 * q + (d < 3.6 ? 0.4 : 0);
          let deep = oppD < 3.4;
          if (mod > 0.5) deep = false;
          else if (mod < -0.5) deep = true;
          target = clamp(oppD + (deep ? off : -off), 1.7, 5.7);
          target = fit(Math.min(target + tNoise, 6.3));
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
          speed = (12.6 + 3.4 * q) * st.power * atk * pace * boost;
          target = fit((oppD < 3.3 ? 4.6 : 3.4) + tNoise);
          // 击球点低时又快又平的球很难压进界内：自动收力，保证技能强化的平抽不会白白出界
          for (let tries = 0; tries < 8; tries++) {
            ang = YY.solveAngle(s.x, s.y, dir, speed, target + back, -20, 30, senv);
            for (let k = 0; k < 12; k++) {
              const rad = (ang * Math.PI) / 180;
              if (YY.netClear(s.x, s.y, speed * Math.cos(rad) * dir, speed * Math.sin(rad), senv) >= C.NET_CLEAR + 0.12) break;
              ang += 3;
            }
            if (!short) break;
            const rad = (ang * Math.PI) / 180, land = YY.simulate(s.x, s.y, speed * Math.cos(rad) * dir, speed * Math.sin(rad), 6, false, false, senv).landX;
            if (land * dir <= oh - 0.35) break;
            speed *= 0.9;
          }
          break;
        case 'lserve':
          target = fit(5.55 - miss * 2.3 + tNoise * 0.6);
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
      const sa = miss * (type === 'net' || type === 'drop' || type === 'sserve' ? 5.5 : 4) * ek;
      const ss = miss * 0.09 * ek;
      ang += gauss() * sa;
      speed *= 1 + gauss() * ss;
      if (q < 0.2) speed *= 0.86;
      const rad = (ang * Math.PI) / 180;
      const attack = type === 'smash' || type === 'kill' || type === 'halfsmash';
      return { type, reason, attack, vx: Math.cos(rad) * speed * dir, vy: Math.sin(rad) * speed, gtk: gk && gk.keys.length ? gk.keys : null };
    }

    // ================= 器械特性 =================
    /** 本拍的落点误差倍率与出球速度倍率（纯计算：只读 p.gt.hq 等状态） */
    gearShotMods(p, type) {
      const gt = p.gt, hq = gt && gt.hq, rt = rTrait(p);
      const out = { err: 1, spd: 1, keys: [] };
      if (!rt || !hq) return out;
      if (rt.k === 'needle' && (type === 'tumble' || type === 'net') && hq.pq >= 0.7) { out.err *= 1 - rt.v; out.keys.push('needle'); }
      if (rt.k === 'precise' && hq.pq >= 0.7 && hq.tq >= 0.85) { out.err *= 1 - rt.v; out.keys.push('precise'); }
      if (rt.k === 'third') {
        const c = CAT3[type], h = gt.cats, a = h[h.length - 1], b = h[h.length - 2];
        if (c && a && b && c !== a && c !== b && a !== b) { out.err *= 1 - rt.v; out.keys.push('third'); }
      }
      if (rt.k === 'press' && gt.press && type === 'smash') { out.spd *= 1 + rt.v; out.keys.push('press'); }
      if (rt.k === 'counter' && hq.counter && type === 'drive') { out.spd *= 1 + rt.v; out.keys.push('counter'); }
      return out;
    }
    /** 亲手回球（非发球）之后：记录球路、布置球鞋特性的触发条件 */
    gearAfterHit(p, shot) {
      const gt = p.gt, s = this.shuttle, st = sTrait(p), rt = rTrait(p);
      gt.pend = s.ver;
      if (rt && rt.k === 'third') { gt.cats.push(CAT3[shot.type] || '?'); if (gt.cats.length > 3) gt.cats.shift(); }
      if (rt && rt.k === 'press' && shot.type === 'smash') gt.press = 0;
      if (st) {
        if (st.k === 'home' && !(gt.cd.home > 0)) gt.home = 1;
        if (st.k === 'retreat' && !(gt.cd.retreat > 0) && Math.abs(s.hitX) <= 2.3) gt.back = 1;
        if (st.k === 'calm' && SMASHY[shot.type]) { gt.calm = 0; gt.calmOn = 0; }
      }
      const o = this.players[1 - p.idx], os = sTrait(o); // 逐月·后撤：对手真实回球后的 0.6 秒
      if (os && os.k === 'moon') o.gt.moonW = os.w;
    }
    /** 每个物理步：球成功过网时结算“过网后”的特性 */
    gearStep() {
      const s = this.shuttle;
      if (this.phase !== 'rally' || !s.live || !s.crossedNet || s.netHit || s.lastHitter < 0 || this.gtOver === s.ver) return;
      this.gtOver = s.ver;
      const p = this.players[s.lastHitter], gt = p.gt, rt = rTrait(p);
      if (!gt || gt.pend !== s.ver) return;
      if (rt && rt.k === 'tide') { // 潮汐·长歌：每 3 次成功过网恢复体力
        gt.tideN++;
        if (gt.tideN % 3 === 0 && gt.tideGain < 9) {
          const n = Math.min(rt.v, 9 - gt.tideGain); gt.tideGain += n; p.stamina = Math.min(C.STAM_MAX, p.stamina + n);
          this.emit({ type: 'gear', p: p.idx, k: 'tide', n, x: p.x, y: p.y + 1 });
        }
      }
    }
    /** 球鞋的启动加成：返回加速度倍率（归位、后撤、刹停转身） */
    gearMove(p, mv, dt) {
      const gt = p.gt, st = sTrait(p);
      if (!gt || !st) return 1;
      for (const k in gt.cd) if (gt.cd[k] > 0) gt.cd[k] -= dt;
      if (gt.bt > 0) gt.bt -= dt;
      if (gt.moonW > 0) gt.moonW -= dt;
      const w = Math.abs(mv) > 0.05 && p.onGround ? Math.sign(mv * p.dir) : 0, rally = this.phase === 'rally';
      const boost = (k, v, t) => { gt.bk = gt.bt > 0 ? Math.max(gt.bk, v) : v; gt.bt = Math.max(gt.bt, t); this.emit({ type: 'gear', p: p.idx, k, x: p.x, y: 0, w }); };
      if (st.k === 'pivot') { // 磐石·定轴：持续跑动后急停反向
        if (Math.abs(p.vx) > 1.5 && Math.sign(p.vx) === Math.sign(mv * p.dir)) { gt.run += dt; gt.runDir = Math.sign(p.vx); }
        else if (!(w && w === -gt.runDir)) gt.run = Math.max(0, gt.run - dt * 2);
        if (rally && w && w === -gt.runDir && gt.run >= 0.3 && !(gt.cd.pivot > 0)) { gt.run = 0; gt.cd.pivot = st.cd; boost('pivot', st.v, st.t); }
      }
      if (rally && w) {
        if (st.k === 'home' && gt.home) { // 羽翼·流步：回球后首次朝己方半场中心移动
          const cx = p.side * C.HALF * 0.5;
          if (Math.abs(cx - p.x) > 0.35 && Math.sign(cx - p.x) === w) { gt.home = 0; gt.cd.home = st.cd; boost('home', st.v, st.t); }
        }
        if (st.k === 'retreat' && gt.back && w === p.side) { gt.back = 0; gt.cd.retreat = st.cd; boost('retreat', st.v, st.t); } // 蝶步·探网
        if (st.k === 'moon' && gt.moonW > 0 && w === p.side) { gt.moonW = 0; boost('moon', st.v, st.t); } // 逐月·后撤
      }
      return gt.bt > 0 ? 1 + gt.bk : 1;
    }
    /** 巡航·悠行：回合中 3 秒不起跳、不扣杀，恢复更快 */
    gearRegen(p, dt) {
      const gt = p.gt, st = sTrait(p);
      if (!gt || !st || st.k !== 'calm' || this.phase !== 'rally') return 1;
      gt.calm += dt;
      if (gt.calm < st.t) return 1;
      if (!gt.calmOn) { gt.calmOn = 1; this.emit({ type: 'gear', p: p.idx, k: 'calm', x: p.x, y: 0 }); }
      return 1 + st.v;
    }
    /** 云垫·回弹：落地后 2 秒内再次普通起跳更省体力 */
    gearJump(p) {
      const gt = p.gt, st = sTrait(p);
      if (!gt || !st) return 1;
      if (st.k === 'calm') { gt.calm = 0; gt.calmOn = 0; }
      if (st.k !== 'rebound') return 1;
      gt.jumped = 1;
      if (gt.reboundW > this.time && !(gt.rbCd > this.time)) {
        gt.reboundW = 0; gt.rbCd = this.time + st.cd; // 冷却按比赛时间记
        this.emit({ type: 'gear', p: p.idx, k: 'rebound', x: p.x, y: 0 });
        return 1 - st.v;
      }
      return 1;
    }
    gearLanded(p) {
      const gt = p.gt, st = sTrait(p);
      if (!gt || !st || st.k !== 'rebound' || !gt.jumped) return;
      gt.jumped = 0; gt.reboundW = this.time + st.t;
    }

    onLand(x) {
      if (this.skLand(x)) return; // 技能接管落地（目前没有）
      this.scorePoint(x);
    }

    scorePoint(x) {
      const s = this.shuttle;
      s.live = false; s.ctl = null;
      s.vx = 0; s.vy = 0; s.speed = 0;
      for (const p of this.players) { p.bufferedShot = null; p.bufferT = 0; p.jumpBuffer = 0; }
      this.phase = 'point';
      this.pointTimer = this.practice ? 1.0 : 1.9;
      const H = this.halfOf(x < 0 ? 0 : 1);
      const inB = Math.abs(x) <= H + C.LINE_TOL && (this.courtMode !== '3d' || Math.abs(s.z || 0) <= 2.59 + C.LINE_TOL);
      const nearLine = inB && (Math.abs(x) > H - 0.12 || this.courtMode === '3d' && Math.abs(s.z || 0) > 2.47);
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
      const pts = this.skPts(x, winner, kind); // 每球一分；金币不改变比赛计分
      this.score[winner] += pts;
      const W = this.players[winner], Lp = this.players[loser];
      this.gainEnergy(Lp, 13);
      this.gainEnergy(W, 4);
      this.skPointEnd(x, winner, loser, kind);
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
        if (a === this.opt.cap-1 && b === this.opt.cap-1) banner = a+':'+b+' · 下一分定胜负';
      }
      this.emit({ type: 'point', winner, loser, reason, kind, x, inB, nearLine, shot: s.shot, banner, rally: this.rally, pts });
    }
  }

  // ============================ 技能引擎 ============================
  // 场上只有一只真实计分的羽毛球（this.shuttle）。假球、投影、分身都只是 this.ents 里的干扰物。
  // 装置：都有可见的绘制、倒计时和对应的破解办法；特殊回球一律重新走击球流程、必须过网。
  const SKD = (id) => (YY.SKILLS || {})[id];
  const KEEP = { foot: 1, star: 1, drop: 1, bow: 1, sign: 1 }; // 回合之间保留的被动标记
  const STREAK = { 2: '双杀！', 3: '三杀！', 4: '四杀！', 5: '五杀！' };
  const KILLS = { smash: 1, halfsmash: 1, kill: 1 };
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  /** 线段 p1→p2 与线段 q1→q2 的交点参数（无交点返回 null） */
  /** 二次贝塞尔曲线上的点 */
  function bez(P, u) {
    const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
    return [a * P[0][0] + b * P[1][0] + c * P[2][0], a * P[0][1] + b * P[1][1] + c * P[2][1]];
  }
  /** 线段 p1→p2 到点 (cx, cy) 的最近距离 */
  function segDist(p1x, p1y, p2x, p2y, cx, cy) {
    const dx = p2x - p1x, dy = p2y - p1y, L = dx * dx + dy * dy;
    const t = L ? clamp(((cx - p1x) * dx + (cy - p1y) * dy) / L, 0, 1) : 0;
    return Math.hypot(p1x + dx * t - cx, p1y + dy * t - cy);
  }
  function segHit(p1x, p1y, p2x, p2y, q1x, q1y, q2x, q2y) {
    const rx = p2x - p1x, ry = p2y - p1y, sx = q2x - q1x, sy = q2y - q1y, den = rx * sy - ry * sx;
    if (Math.abs(den) < 1e-9) return null;
    const t = ((q1x - p1x) * sy - (q1y - p1y) * sx) / den, u = ((q1x - p1x) * ry - (q1y - p1y) * rx) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
  }

  Object.assign(Match.prototype, {
    initMarket(p) {
      return p.market || (p.market = { coins:500, tier:2, bet:null, delta:0, flash:0 });
    },
    /** 金币增减：决定装备档；≤ 0 负债入狱（囚服、手铐脚镣），赚回来才出狱 */
    marketGain(p, amount, reason) {
      const a = this.initMarket(p), old = a.tier, wasDebt = YY.marketDebt(a.coins);
      const next = clamp(Math.round(a.coins + amount), YY.MARKET_MIN, 9999);
      const equipped=a.equipCoins??a.coins;
      a.delta = next - a.coins; a.coins = next;
      const floor=YY.MARKET_TIERS[old].min;
      a.equipCoins = next<=0 || wasDebt || YY.marketTier(next)>old || next<floor-60 ? next : equipped;
      a.tier = YY.marketTier(a); a.flash = 1;
      const debt = YY.marketDebt(next);
      if (debt !== wasDebt) {
        this.proc(p, 'jihui', debt ? '负债入狱！' : '还清债务 · 出狱');
        this.addEnt(debt ? 'jail' : 'coins', p.idx, p.x, p.y + 1.4, debt ? 1.2 : .9);
      } else if (!debt && a.tier !== old) {
        this.proc(p, 'jihui', (a.tier > old ? '升级 · ' : '变卖 · ') + YY.MARKET_TIERS[a.tier].name);
        this.addEnt('coins', p.idx, p.x, p.y + 1.4, .9);
      }
      if (reason && amount) this.proc(p, 'jihui', reason + ' ' + (amount > 0 ? '+' : '') + Math.round(amount));
      return a.delta;
    },
    /** 预览与释放共用放置计算，所有装置都留在合法半场。 */
    skillTarget(p, id, v) {
      if (id === 'fanshe') { // 反射板：拖动放到指定位置；点按自动放在来球路线上，否则叠在身前组成弹射线路
        const H = this.halfOf(p.idx), at = (d, y) => ({ x:p.side * clamp(d, .6, H - .4), y:clamp(y, .7, 4.2) });
        if (v.manual) return at(p.side * p.x - v.x * 3.3 * v.r, p.y + 1.35 + v.y * 3.3 * v.r);
        const boards = this.entsOf ? this.entsOf('board', p.idx) : [], free = (x, y) => !boards.some(e => dist(e.x, e.y, x, y) < .9);
        const s = this.shuttle, pr = this.pred;
        if (s && pr && pr.pts && s.live && s.lastHitter !== p.idx) {
          const el = this.time - (pr.t0 ?? this.time);
          for (const k of pr.pts) if (k.t > el + .5 && k.t < el + 1.35 && p.side * k.x > .6 && p.side * k.x < H - .4 && k.y > .8 && k.y < 3.6 && free(k.x, k.y)) return { x:k.x, y:k.y };
        }
        let d = p.side * p.x - 1.3, y = 1.45;
        for (let i = 0; i < 3 && !free(at(d, y).x, at(d, y).y); i++) { d -= .8; y += 1.0; }
        return at(d, y);
      }
      if (id === 'shuangji') { // 冻结窗格：可以放在己方，也可以伸到网那边 2.5 米（离网至少 0.7 米）
        const H = this.halfOf(p.idx), fix = (d, y) => { d = clamp(d, -2.5, H - 0.4); if (Math.abs(d) < 0.7) d = d < 0 ? -0.7 : 0.7; return { x: p.side * d, y: clamp(y, 0.9, 3.8) }; };
        if (v.manual) return fix(p.side * p.x - v.x * 4.2 * v.r, p.y + 1.35 + v.y * 4.2 * v.r);
        const s = this.shuttle, pr = this.pred;
        if (s && s.live && pr && pr.pts) {
          const el = this.time - (pr.t0 ?? this.time), mine = s.lastHitter === p.idx;
          for (const k of pr.pts) {
            const d = p.side * k.x;
            if (k.t < el + (mine ? 0.15 : 0.3) || k.t > el + 1.3 || k.y < 0.9 || k.y > 3.6) continue;
            if (mine ? d < -1.0 && d > -3.0 : d > 0.8 && d < H - 0.4) return fix(d, k.y);
          }
        }
        return fix(p.side * p.x - 1.4, 1.8);
      }
      const r = v.manual ? 3.3 * v.r : 1.75;
      return { x:p.side * clamp(p.side * (p.x + p.dir * v.x * r), .95, this.halfOf(p.idx) - .35), y:clamp(p.y + 1.35 + v.y * r, .85, 5.3) };
    },
    addEnt(k, o, x, y, t, extra) {
      const e = Object.assign({ id: ++this.eid, k, o, x, y: y || 0, t: t == null ? 99 : t, age: 0 }, extra || {});
      this.ents.push(e); return e;
    },
    entOf(k, o) { return this.ents.find(e => e.k === k && (o == null || e.o === o)); },
    entsOf(k, o) { return this.ents.filter(e => e.k === k && (o == null || e.o === o)); },
    dropEnt(e) { const i = this.ents.indexOf(e); if (i >= 0) this.ents.splice(i, 1); },
    hasSkill(p, id) { return !!(this.skillsOn && p.kit && (p.passive === id || p.kit.act.includes(id))); },
    hasPassive(p, id) { return !!(this.skillsOn && p.kit && p.passive === id); },
    proc(p, id, label, extra) { this.emit(Object.assign({ type: 'skillProc', p: typeof p === 'number' ? p : p.idx, id, label }, extra || {})); },
    /** 来球离拍面的距离（以肩前一臂为甜区） */
    racketGap(p, x, y) { return dist(x, y, p.x + p.dir * 0.6, p.y + C.SHOULDER); },
    incomingTo(p) { const s = this.shuttle; return s.live && !s.held && !s.netHit && s.lastHitter !== p.idx; },

    /** 每一分开始：回合规则复原、回合装置清空；被动标记按规则保留 */
    skReset(first) {
      const sk = this.sk;
      sk.half = [C.HALF, C.HALF]; sk.shift = 0; sk.option = null; sk.potato = null; sk.beat = null;
      if (first) { this.ents = []; sk.netUp = 0; }
      else this.ents = this.ents.filter(e => {
        if (newPersistent(e)) return e.t > 0;
        if (PERSIST[e.k]) { // 场内持续性技能：保留到下一回合，倒计时暂停（见 skStep）
          e.hop = 0; e.armed = 0; e.used = e.k === 'moon' ? 0 : e.used;
          if (e.k === 'appoint' && e.home != null) e.x = e.home;
          return e.t > 0;
        }
        if (!KEEP[e.k]) return false;
        if (e.k === 'foot') { e.n = (e.n || 0) + 1; return e.n < 2; } // 遗憾脚印只等一个回合
        return true;
      });
      for (const p of this.players) {
        for (const k in p.buff) if (first || !PERSIST_BUFF[k]) p.buff[k] = 0;
        const c = p.cnt;
        const keep = { log: c.log || null, streak: c.streak || 0, starCount:first?0:c.starCount||0, dirtySeed: c.dirtySeed };
        if (!first) { // 持续性的“下一拍”效果跟着状态计时一起保留
          if (p.buff.jiezou > 0) keep.combo = c.combo;
          if (p.buff.jiewang > 0) keep.slings = c.slings;
          if (p.buff.tangqiu > 0) keep.sugarBack = c.sugarBack;
          if (p.buff.xingmen > 0) { keep.gateAim = c.gateAim; }
        }
        p.cnt = keep;
        if (p.market) {
          if (first) Object.assign(p.market, { coins:500, equipCoins:500, tier:2, delta:0, flash:0 });
          p.market.bet = null;
        }
      }
    },

    /** 能否发动第 slot 个主动技能（只看能量与比赛阶段；具体条件见 castCheck） */
    canUse(p, slot = 0) {
      const id = p.kit && p.kit.act[slot], def = id && SKD(id);
      if (!this.skillsOn || !def || def.passive) return false;
      if (this.phase === 'over' || this.phase === 'point' || p.skillCd > 0) return false;
      return p.energy >= (def.cost || 100);
    },
    /** 发动条件不满足时返回提示文字 */
    castCheck(p, id) {
      const s = this.shuttle, def = SKD(id), sk = this.sk, o = this.players[1 - p.idx];
      const mine = s.live && s.lastHitter === p.idx && !s.ctl && !s.netHit && s.selfToss !== p.idx;
      if (def.pre) {
        if ((this.phase !== 'serve' && !(this.practice && this.phase === 'idle')) || this.serving) return '发球前才能用';
        return null;
      }
      if (['ganggan','jiepan','qiquan'].includes(id)) {
        const a = this.initMarket(p);
        if (id === 'ganggan') return a.bet ? '这一分已经押过了' : this.phase === 'serve' && this.serving ? '球已经发出去了' : null;
        if (this.phase !== 'rally') return '发球后才能用';
        if (id === 'jiepan') return this.entOf('packet', p.idx) ? '红包还没捡完' : a.coins < 60 ? '至少需要 60 金币' : null;
        return p.buff.gold > 0 ? '金砖球已经备好' : a.coins < 50 ? '至少需要 50 金币' : null;
      }
      if (this.phase !== 'rally') return '发球后才能用';
      switch (id) {
        case 'yuyue': return p.onGround ? null : '落地才能用';
        case 'diban': return (this.incomingTo(p) || s.selfToss === p.idx) && !s.ctl && (s.crossedNet || s.selfToss === p.idx) && p.side * s.x > 0.2 && s.y > 0.25 && this.racketGap(p, s.x, s.y) < 2.4 ? null : '球不在拍前';
        case 'huiguo': return mine ? (s.wok ? '已经加了回旋' : this.racketGap(o, s.x, s.y) < 1.8 ? '球已经到对手身前' : null) : '先把球打出去';
        case 'baozi': return s.bun ? '球已经包在肉包里' : this.entOf('bunFly', p.idx) ? '肉包还在飞' : null;
        case 'shensuo': case 'xuanpai': case 'youyou': return this.entOf('pole', p.idx) || this.entOf('spin', p.idx) || this.entOf('yoyo', p.idx) ? '球拍还没收回' : null;
        case 'tafeng': return p.onGround ? '在空中才能踏风' : p.cnt.airJ ? '这一跳已经踏过风' : null;
        case 'zipao': return this.incomingTo(p) && !s.ctl && p.side * s.x > 0.2 && this.racketGap(p, s.x, s.y) < 1.7 ? null : '球不在拍前';
        case 'pingyi': return this.entOf('guide', p.idx) ? '辅助线已经画好' : null;
        case 'hongxian': return this.entOf('ribbon', p.idx) || (s.ctl && s.ctl.k === 'tether' && s.ctl.o === p.idx) ? '丝带还没收回' : null;
        case 'chaolai': return this.entOf('pool', p.idx) ? '积水还在' : null;
        case 'huichao': return this.incomingTo(p) && !s.ctl && s.crossedNet && p.side * s.x > 0.15 && (s.path || []).length > 12 ? null : '球不在己方半场';
        case 'xingmen': return p.buff.xingmen > 0 ? '星门已经开着' : null;
        case 'zhongli': return p.buff.gravRest > 0 ? '重力正在稳定' : null;
        case 'yueliang': return this.entOf('moon', p.idx) ? '月亮已经在场' : null;
        case 'haomao': return this.entOf('mini', p.idx) ? '猴子还在守场' : null;
        case 'fengkou': return this.entOf('wind', p.idx) ? '风口还在场' : null;
        case 'jindou': return p.cnt.cloud ? '已经在云上' : null;
        case 'fuzhi': return this.entOf('clone', p.idx) ? '复制体还在场上' : null;
        case 'jieli': return s.ctl ? '球正在被控制' : YY.relayPlan(this, p, { x: 0, y: 1, r: .62, manual: false }) ? null : '球不在本体或复制体身边';
        case 'zangshu': return this.entsOf('dirty', p.idx).length ? '脏数据球还在场上' : null;
        case 'yueqiu': return this.entOf('appoint', p.idx) ? '已经有预约' : null;
        case 'shuangji': return this.entOf('pane', p.idx) ? '冻结窗格还在' : null;
        case 'meida': return this.incomingTo(p) && !s.ctl && s.crossedNet && p.side * s.x > 0.2 && this.racketGap(p, s.x, s.y) < 1.6 ? null : '球不在拍前';
        case 'jingxiang':
          if (!(s.live && s.lastHitter === p.idx && !s.netHit && !s.ctl && s.selfToss !== p.idx)) return '先把球打出去';
          return this.entsOf('fake', p.idx).length ? '镜像还没散' : s.y < 1.0 && s.vy < 0 ? '球太低了' : null;
        case 'shuizhong': return s.live && s.lastHitter === p.idx && !s.netHit ? (p.cnt.wob ? '水纹已经布下' : null) : '先把球打出去';
        case 'tingyixia': return this.incomingTo(p) && !s.ctl && s.crossedNet && p.side * s.x > 0.2 && s.y > 0.35 && this.racketGap(p, s.x, s.y) < 1.7 ? null : '球不在拍前';
        case 'yati': return this.entOf('replace', p.idx) ? '替换规则已经生效' : null;
        case 'dangteng': return p.buff.vine > 0 ? '已经在藤上' : null;
        case 'jiezou': return p.buff.jiezou > 0 ? '节拍还在' : null;
        case 'jiewang': return s.ctl && ((s.ctl.k === 'stick') || (s.ctl.k === 'tether' && s.ctl.o === p.idx)) ? null : p.buff.jiewang > 0 ? '网已经借到了' : null;
        case 'tangqiu': return p.buff.tangqiu > 0 ? '已经在等球' : null;
      }
      return null;
    },

    /** 发动技能：slot 0 / 1 对应携带的两个主动技能；可再按的技能先处理第二段 */
    useSkill(p, slot = 0, pr) {
      const id = p.kit && p.kit.act[slot], def = id && SKD(id);
      if (!this.skillsOn || !def || def.passive) return false;
      let raw = YY.cleanSkillAim(pr && pr.aim);
      // 鱼跃、踏风：不拖动技能键，按住的移动方向就是释放方向（+1 向网 / −1 向后）
      if (def.moveAim) { const mv = clamp(this.inputs[p.idx].move || 0, -1, 1); raw = typeof raw === 'number' && raw ? raw : Math.abs(mv) > 0.25 ? Math.sign(mv) : 0; }
      const vector = YY.skillVector(id, raw);
      const aim = typeof raw === 'object' ? raw.x : raw;
      if (this.phase !== 'rally' && this.phase !== 'serve' && !(this.practice && this.phase === 'idle')) return false;
      // 二段输入可提前 0.1 秒排队；记录原始方向，不能在执行时被移动键覆盖。
      if (def.recast && p.skillCd > 0 && p.skillCd <= .1 && YY.skillRecastReady(this, p, id)) {
        p.cnt.skillBuffer = { slot, aim: raw, until: this.time + .12 }; return true;
      }
      if (def.recast && p.skillCd <= 0 && this.recast(p, id, aim, vector)) { p.skillCd = Math.max(p.skillCd, 0.16); if(id!=='shensuo')this.emit({type:'skillMotion',p:p.idx,id,stage:'recast'}); return true; }
      if (!this.canUse(p, slot)) {
        if (p.energy < (def.cost || 100) && this.time >= (p.cnt.energyHintAt ?? -1)) {
          p.cnt.energyHintAt = this.time + .65;
          this.emit({ type: 'skillFail', p: p.idx, id, label: '能量不足 · ' + Math.floor(p.energy) + '/' + (def.cost || 100) });
        }
        return false;
      }
      const why = this.castCheck(p, id);
      if (why) { p.skillCd = 0.3; this.emit({ type: 'skillFail', p: p.idx, id, label: why }); return false; }
      p.energy -= def.cost || 100; p.skillCd = 0.4;
      this.cast(p, id, aim, vector);
      this.emit({ type: 'skill', p: p.idx, id, name: def.name, slot });
      // 三十年，看得懂：对手第一次用某个技能时给出应对提示
      const o = this.players[1 - p.idx], seen = this.sk.seen[o.idx];
      if (this.hasPassive(o, 'kandong') && !seen[id] && def.tip) { seen[id] = 1; this.proc(o, 'kandong', def.tip, { tip: true }); }
      return true;
    },

    cast(p, id, aim = 0, vector) {
      const s = this.shuttle, o = this.players[1 - p.idx], b = p.buff, sk = this.sk;
      const v = vector || YY.skillVector(id, aim);
      const own = (d, lo, hi) => p.side * clamp(d, lo, hi); // 己方半场内、离网 d 米的位置
      const back = aim < -0.3, fwd = aim > 0.3;
      switch (id) {
        // —— 凌风 ——
        case 'yuyue': {
          let w;
          if (Math.abs(aim) > 0.2) w = aim > 0 ? p.dir : p.side;
          else { const tx = this.pred && s.live && s.lastHitter !== p.idx ? this.pred.landX : s.x; w = Math.sign(tx - p.x) || p.dir; }
          p.cnt.diveW = w; p.cnt.diving = 1; p.cnt.diveHit = 0; b.dive = 0.42; p.vy = 0.9; p.onGround = false;
          this.addEnt('whirl', p.idx, p.x, 0, 0.75, { w, big: 1 }); // 旋风：卷着她扑出去
          // 顺着扑出去的方向挂起一阵风：影响场上所有球的下落弧线
          const old = this.entOf('gale'); if (old) this.dropEnt(old);
          this.addEnt('gale', p.idx, p.x, 0, 4, { w: w * 1.5 });
          break;
        }
        case 'tafeng': {
          const v = this.jumpVelocity(p);
          if (vector?.manual) { p.drive = vector.x * p.dir * 5.6; p.vy = v * clamp(.65 + vector.y * .45, .3, 1.1); }
          else if (Math.abs(aim) > 0.3) { p.drive = aim * p.dir * 5.2; p.vy = v * 0.8; } else p.vy = v * 1.05;
          p.cnt.airJ = 1; b.jifeng = 1.8; // 之后这一拍带疾风
          this.addEnt('ring', p.idx, p.x, p.y + 0.1, 0.45);
          this.addEnt('whirl', p.idx, p.x, p.y, 0.6, { w: Math.sign(p.drive || 0) }); // 脚下踩出一团旋风
          break;
        }
        case 'fengkou': {
          const t = this.skillTarget(p, 'fengkou', v);
          this.addEnt('wind', p.idx, t.x, t.y, 6, { push:(back ? p.side : p.dir)*2.8, lift:v.manual?v.y*1.8:.4, used:0 });
          break;
        }
        // —— 沧澜 ——
        case 'chaolai': { // 潮来：己方半场漫起一层积水，8 秒内每只来球第一次落水会弹起
          this.addEnt('pool', p.idx, p.side * this.halfOf(p.idx) / 2, 0, 8, { hits: 0, n:2 });
          this.addEnt('splash', p.idx, p.x, 0.2, 0.6);
          this.proc(p, id, '潮来 · 两次托球');
          break;
        }
        case 'tongyin': {
          const n = Math.min(25, Math.max(0, o.stamina - p.stamina) * .4);
          if (n > 0) { p.stamina += n; o.stamina -= n; this.proc(p,id,'潮汐交换 +' + Math.round(n)); }
          else { b.tideSave = 5; this.proc(p,id,'余潮 · 扣杀省力 5 秒'); }
          break;
        }
        case 'huichao': { // 沿原路倒流：再按一次在当前位置松手；积水上弹起的球卷起潮涌，倒流更快
          const path = s.path.slice(), tide = !!s.puddle && !!this.entOf('pool', p.idx);
          s.ctl = { k: 'rewind', o: p.idx, path, i: path.length - 1, f: 0, t: 6, tide: tide ? 1 : 0 }; s.ver++;
          this.addEnt('rewind', p.idx, s.x, s.y, 6, { pts: path.filter((_, k) => k % 6 === 0).map(q => [q[0], q[1]]), tide: tide ? 1 : 0 });
          if (tide) { this.addEnt('splash', p.idx, s.x, Math.max(0.2, s.y), 0.6); this.proc(p, id, '潮涌倒流'); }
          break;
        }
        // —— 小红 ——
        case 'fanshe': { // 布置后准备半秒；出口在放置时确定，不追踪对手
          const t = this.skillTarget(p, id, v), mine = this.entsOf('board', p.idx);
          if (mine.length >= 3) this.dropEnt(mine[0]);
          const calibrated = v.manual && p.cnt.calibrate > 0;
          if (calibrated) p.cnt.calibrate = 0;
          this.addEnt('board', p.idx, t.x, t.y, 10, { n:calibrated ? 2 : 1, cool:0, warm:.45, target:clamp(this.halfOf(1-p.idx)-p.side*t.x,2.2,5.2), calibrated:calibrated ? 1 : 0 });
          this.proc(p, id, '反射板 ' + Math.min(3, mine.length + 1) + ' / 3');
          break;
        }
        case 'zipao': { // 拖动：垫球的角度与力度（可以垫向自己的反射板）；点按：垫到头顶
          const t = YY.tossVel(v);
          s.vx = t.vx * p.dir; s.vy = t.vy; s.ctl = null;
          this.touchShuttle(p, 'lift', '自抛', id, 0.6);
          s.selfToss = p.idx; s.tossSkill = id;
          // 垫球动作：下手挑起 → 随挥上举，渲染层再接蓄势举拍，直到扣下去。
          p.swing = { t: 0.07, btn: 'clear', kind: 'under', dur: 0.34, hit: true, prevE: 99, judged: true, style: 'lift', toss: 1, contact: { t: C.SW_SWEET, x: s.x, y: s.y } };
          p.cnt.tossAt = this.time;
          break;
        }
        case 'pingyi': { // 两次亲手回球的校准：保留按键选出的球路，不按拖动角度强制改线
          this.addEnt('guide', p.idx, p.x, p.y + C.SHOULDER, 8, { n:2 });
          this.proc(p, id, '校准就绪 · 两次回球');
          break;
        }
        // —— 冉冉 ——
        case 'tangqiu': b.tangqiu = 6; p.cnt.sugarBack = back; break;
        case 'hongxian': { // 红丝带朝拖动方向射出，缠住球就拉回拍前
          const d = v.manual ? { x: v.x, y: v.y } : this.ribbonAuto(p);
          const n = Math.hypot(d.x, d.y) || 1;
          const e = this.addEnt('ribbon', p.idx, p.x, p.y + 1.45, 1.4, { dx: d.x / n, dy: d.y / n, L: 0, ph: 0, got: 0 });
          this.ribbonHead(p, e);
          break;
        }
        case 'jiewang': { // 挂在糖网上 / 红线牵着的球：立即弹射；否则这 6 秒网归她
          const c = s.ctl;
          if (c && (c.k === 'stick' || (c.k === 'tether' && c.o === p.idx))) { this.sling(p, aim); break; }
          b.jiewang = 6; p.cnt.slings = 2;
          break;
        }
        // —— 王瑞 ——
        case 'diban': { // 拖动选方向砸球：身后、头顶临时立起两面墙，地板 + 两面墙各反弹一次，每弹一次加速冒蒸汽
          const steam = !!(s.bun && s.bun.o === p.idx) || p.cnt.steam > this.time;
          const d = v.manual ? { x: v.x, y: v.y } : this.slamAuto(p, s.x, s.y, steam);
          const n = Math.hypot(d.x, d.y) || 1, sp = steam ? 19 : 16;
          s.vx = d.x / n * sp * p.dir; s.vy = d.y / n * sp;
          if (steam) { s.bun = null; p.cnt.steam = 0; this.proc(p, 'baozi', '蒸汽地板！'); }
          this.touchShuttle(p, 'smash', '地板开球', id, 0.7);
          s.slam = { o: p.idx, floor: 1, n: 0, steam: steam ? 1 : 0 }; s.floorBy = p.idx;
          for (const w of YY.slamWalls(p, this.halfOf(p.idx))) this.addEnt('wall', p.idx, w.x, w.y, 1.8, w);
          // 抡圆了往下砸：从引拍顶点起动作，拍面锁在出手点，随挥压到身前。
          p.swing = { t: 0.068, btn: 'smash', kind: 'over', dur: 0.34, hit: true, prevE: 99, judged: true, style: 'smash', slam: 1, contact: { t: C.SW_SWEET, x: s.x, y: s.y } };
          this.hitstop = Math.max(this.hitstop, 0.05);
          this.rePred(false);
          break;
        }
        case 'huiguo': s.wok = { o: p.idx, used: 0 }; s.ver++; this.proc(p, id, '回旋上身'); break;
        case 'baozi': { // 朝拖动方向掷出肉包：裹住羽毛球后吸收双方的击球动能，5 秒内再按释放
          const t = v.manual ? { vx: v.x * (7 + 7 * v.r), vy: v.y * (7 + 7 * v.r) } : this.bunAuto(p);
          this.addEnt('bunFly', p.idx, p.x + p.dir * 0.35, p.y + 1.7, 1.8, { vx: t.vx * p.dir, vy: t.vy });
          p.swing = { t: 0, btn: 'clear', kind: 'side', dur: 0.28, hit: true, prevE: 99, judged: true, style: 'push', throw: 1 }; // 掷包动作
          this.proc(p, id, '大肉包 · 飞！');
          break;
        }
        // —— 星星 ——
        case 'yueliang': {
          const target = this.skillTarget(p, id, v);
          this.addEnt('moon', p.idx, target.x, target.y, 6, { used:0, charged:b.gravOn > 0 }); break;
        }
        case 'xingmen': { // 下一拍射进星门，从对手身后飞出
          b.xingmen = 8; p.cnt.gateAim = aim;
          break;
        }
        case 'zhongli': { // 开关：开启后重力球的重力翻转（向上飘），每秒耗能
          b.gravOn = 99; p.cnt.gravUntil = this.time + 1.5; p.skillCd = 0.5;
          const moon = this.entOf('moon', p.idx); if (moon) moon.charged = 1;
          if (s.grav) this.rePred(false);
          this.proc(p, id, s.grav ? '重力翻转！' : '重力翻转 · 待命');
          break;
        }
        // —— 丁丁 ——
        case 'shensuo': { // 拍杆沿身前斜上方越伸越长；再按一次拍头就地击球
          b.shensuo = 3; const e = this.addEnt('pole', p.idx, p.x, p.y + 1.35, 3, { L: 0.45, ph: 0, a: Math.atan2(v.y, v.x), sw: 0, used: 0, boost:b.overclock > 0, ref:v.x < 0 ? -1 : 1 });
          this.poleHead(p, e);
          break;
        }
        case 'xuanpai': // 双头拍绕身一圈：向网先扫身前，后退先扫身后
          b.xuanpai = 0.65;
          this.addEnt('spin', p.idx, p.x, p.y + 1.25, 0.65, { ph0: Math.PI / 2, w: (back ? 1 : -1) * Math.PI * 2 / 0.6, r:b.overclock > 0 ? 1.5 : 1.35, boost:b.overclock > 0, used:0, ref:back ? -1 : 1 });
          break;
        case 'youyou': { // 抛出接球器，把来球带回身边，留给自己再打一拍
          b.youyou = 4; const e = this.addEnt('yoyo', p.idx, p.x, p.y + 1.5, 4, { ax:p.x, ay:p.y+1.5, dx:p.dir*v.x, dy:v.y, d:0.3, max: v.manual ? 1.6 + 3.2*v.r : 4.2, ph:0, hang:0, used:0, boost:b.overclock > 0 });
          this.yoyoHead(p, e);
          break;
        }
        // —— 猴子 ——
        case 'jindou': { // 筋斗云：飞到来球的最高点悬停，等着空中暴扣
          if (p.cnt.vine) this.releaseVine(p);
          p.cnt.fling = null;
          const t = this.cloudTarget(p);
          p.cnt.cloud = { tx: t.x, ty: t.y, t: 1.4, hi: t.hi }; p.onGround = false; p.vy = 0; p.replan = true;
          this.addEnt('afterimg', p.idx, p.x, p.y, 0.5);
          this.proc(p, id, t.hi ? '筋斗云 → 高点' : '筋斗云');
          break;
        }
        case 'dangteng': { // 抓住头顶的藤蔓：单摆
          let w = Math.abs(aim) > 0.3 ? (fwd ? p.dir : p.side) : 0;
          if (!w) { const tx = this.interceptX(p); w = tx != null ? Math.sign(tx - p.x) || p.dir : p.dir; }
          const L = 2.6, ay = Math.max(4.9, p.y + 4.5), ax = own(p.side * p.x, 1.4, this.halfOf(p.idx) - 1.0);
          p.cnt.vine = { ax, ay, L, th: Math.asin(clamp((p.x - ax) / L, -0.9, 0.9)), w: w * 2.4 + p.vx / L, steer:w, startY:p.y, age:0 };
          b.vine = 2.4; p.onGround = false; p.vy = 0; p.cnt.fling = null;
          this.addEnt('vine', p.idx, ax, ay, 2.4);
          break;
        }
        case 'haomao': { // 毫毛小猴：在己方前后巡逻拦球，还会往对面丢香蕉皮
          const old = this.entOf('mini', p.idx); if (old) this.dropEnt(old);
          this.addEnt('mini', p.idx, p.side * (back ? 3.0 : 0.8), 0, 7, { n:1, warm:.65, ph:back ? Math.PI : 0, throwT:2.1, peels:1 });
          break;
        }
        // —— 路先森 ——
        case 'fuzhi': { // 复制体：留在原地，同步跳跃、挥拍与技能
          const long = this.takeCompile(p), T = long ? 11 : 8;
          this.addEnt('clone', p.idx, p.x, p.y, T, { T, sw: null, hits: 0, warm: 0.3, long: long ? 1 : 0 });
          this.addEnt('cloneFx', p.idx, p.x, p.y, 0.6);
          this.proc(p, id, long ? '复制体 · 编译加长 ' + T + ' 秒' : '复制体已部署');
          break;
        }
        case 'jieli': { // 接力协议：离球近的一端把球垫给另一端（没有复制体时自垫）
          const plan = YY.relayPlan(this, p, v); if (!plan) break;
          s.vx = 0; s.vy = 0;
          this.touchShuttle(p, 'lift', plan.name, id, 0.7, true); this.pred.hidden = true;
          s.ctl = { k: 'relay', o: p.idx, P: plan.P, f: 0, T: plan.T, t: plan.T + 0.3, to: plan.to, from: plan.from, high: plan.high ? 1 : 0, q: this.takeCompile(p) ? 0.9 : 0 };
          if (plan.from === 'clone') s.cloneBy = p.idx;
          // 传球动作：本体和复制体一起做（复制体在 skStep 里跟着本体的挥拍）
          p.swing = { t: 0.06, btn: 'clear', kind: 'under', dur: 0.3, hit: true, prevE: 99, judged: true, style: 'lift', toss: 1, relay: 1, contact: { t: C.SW_SWEET, x: s.x, y: s.y } };
          this.addEnt('relayArc', p.idx, plan.tx, plan.ty, plan.T + 0.45, { pts: [0, .15, .3, .45, .6, .75, .9, 1].map(u => bez(plan.P, u)), to: plan.to, high: plan.high ? 1 : 0, T: plan.T });
          this.proc(p, id, plan.label);
          break;
        }
        case 'zangshu': { // 脏数据：从拍前（和复制体拍前）各发一只假装成真球的脏数据球
          const H = this.halfOf(o.idx), od = o.side * o.x, rnd = this.dirtyRand(p);
          const mine = s.live && !s.netHit && s.lastHitter === p.idx && this.pred;
          const real = mine ? o.side * this.pred.landX : null;
          const d1 = real != null ? (real > 3.3 ? 1.5 + rnd() * .6 : H - .7 - rnd() * .6) : (od < 3.3 ? H - .7 - rnd() * .5 : 1.4 + rnd() * .6);
          const launch = (x, y, depth, from) => {
            const deep = depth > 3.3, v2 = this.launchFrom(x, y, p.dir, deep ? 30 + rnd() * 12 : 14 + rnd() * 10, depth, deep ? .35 : .12);
            const lx = YY.simulate(x, y, v2[0], v2[1], 6, false, true, this.env).landX;
            this.addEnt('dirty', p.idx, x, y, 16, { vx: v2[0], vy: v2[1], n: 0, lx, kind: deep ? 'clear' : 'drop', from, seed: Math.floor(rnd() * 1e9) });
          };
          if (!p.swing) p.swing = { t: 0.05, btn: 'clear', kind: 'side', dur: 0.3, hit: true, prevE: 99, judged: true, style: d1 > 3.3 ? 'clear' : 'drop', dirty: 1 };
          launch(p.x + p.dir * 0.6, p.y + C.SHOULDER + 0.25, d1, 'body');
          const cl = this.entOf('clone', p.idx);
          if (cl) launch(cl.x + p.dir * 0.6, (cl.y || 0) + C.SHOULDER + 0.25, clamp(d1 > 3.3 ? 2.0 + rnd() * .8 : H - 1.5 - rnd() * .8, 1.2, H - .4), 'clone');
          this.proc(p, id, cl ? '脏数据 ×2 已注入' : '脏数据已注入', { tip: true });
          break;
        }
        // —— 老陈 ——
        case 'yati': { // 查找替换：对手下一记进攻球被替换成软球（拖向网 = 网前小球，否则 = 高球）
          this.addEnt('replace', p.idx, o.x, o.y + 2.6, 7, { mode: fwd ? 1 : 0 });
          this.proc(p, id, 'Ctrl+H：进攻 → ' + (fwd ? '网前小球' : '高球'));
          break;
        }
        case 'yueqiu': { // 预约半场：投影在半场中间等着，对手的球落进来就替你接
          const home = p.side * (fwd ? 1.7 : 4.4);
          this.addEnt('appoint', p.idx, home, 0, 8, { zone: fwd ? 1 : 0, home, tx: home, btn: fwd ? 'drop' : 'clear' });
          break;
        }
        case 'shuangji': { // 冻结窗格：放一块冰窗，第一只穿过的球被冻住 1.2 秒（再按提前解冻）
          const t = this.skillTarget(p, id, v);
          const known = p.cnt.habit != null && ((-p.side*t.x < 3.35) === !!p.cnt.habit) && p.side*t.x < 0;
          this.addEnt('pane', p.idx, t.x, t.y, 7, { used:0, half:known ? .72 : .62, warm:.25 });
          this.proc(p, id, '冻结窗格');
          break;
        }
        // —— 果哥 ——
        case 'ganggan': { // 押这一分：发球前押赔率更高；钱不够也照押（可能借成负债）
          const a = this.initMarket(p), odds = this.phase === 'serve' ? 3 : 2;
          a.bet = { stake: 100, odds }; b.bet = 30;
          this.marketGain(p, -100, '押注');
          this.addEnt('chips', p.idx, p.x, p.y + 2.2, 1.0, { odds });
          this.proc(p, id, '押这一分 · 赢回 ×' + odds); break;
        }
        case 'jiepan': { // 红包雨：撒在对手脚前、身后和来球落点附近
          this.marketGain(p, -60, '撒红包');
          const H = this.halfOf(o.idx), od = o.side * o.x, spots = [od - 1.1, od + 1.1];
          const land = this.pred && s.live && s.lastHitter === p.idx ? o.side * this.pred.landX : od;
          spots.push(Math.abs(land - od) < .6 ? od + (od < H / 2 ? 2 : -2) : land);
          spots.map(d => clamp(d, .6, H - .35)).sort((u, w) => u - w).forEach((d, i, all) => {
            if (i && d - all[i - 1] < .7) d = all[i] = Math.min(H - .35, all[i - 1] + .7);
            this.addEnt('packet', p.idx, o.side * d, 0, 5, { ph: i * 1.7, fall: .45 + i * .12 });
          });
          this.proc(p, id, '红包雨！'); break;
        }
        case 'qiquan': this.marketGain(p, -50, '一掷千金'); b.gold = 6; this.proc(p, id, '金砖球备好了'); break;
        // —— 田楚 ——
        case 'jingxiang': { // 一分为三：近 / 中 / 远，方向键决定真球走哪条
          const H = this.halfOf(o.idx), cur = this.landOf(1), want = [Math.max(1.1, cur - 1.9), Math.min(H - 0.3, cur + 1.9)];
          const ks = [1, this.solveVx(want[0]), this.solveVx(want[1])], pick = fwd ? 1 : back ? 2 : 0, vx0 = s.vx;
          ks.forEach((k, i) => { if (i !== pick) this.addFake(p, s.x, s.y, vx0 * k, s.vy, s.shot); });
          s.vx = vx0 * ks[pick]; s.ver++;
          if (this.pred) this.pred = Object.assign(YY.simulate(s.x, s.y, s.vx, s.vy, 6, true, false, this.physEnv()), { t0: this.time, hidden: this.pred.hidden });
          o.fooled = true; o.cnt.fakeT = this.time;
          break;
        }
        case 'meida': { // 虚挥一拍：假回球飞向对手，真球被垫起留在身前
          const tx = o.side * clamp(o.side * o.x > 3.4 ? 1.7 : 5.3, 1.2, this.halfOf(o.idx) - 0.5);
          const vx0 = s.x, vy0 = clamp(s.y, 0.8, 2.6), a = Math.abs(tx) > 3 ? 48 : 20;
          const v = YY.solveSpeed(vx0, vy0, p.dir, a, Math.abs(tx - vx0), this.env), r = a * Math.PI / 180;
          s.vx = p.dir * 0.35; s.vy = 4.4; s.ctl = null;
          p.swing = { t: 0, btn: 'clear', kind: 'side', dur: 0.26, hit: true, prevE: 99, judged: true }; // 虚挥：动作是真的
          this.touchShuttle(p, 'lift', '假拍', id, 0.5, true); // 不弹字：假回球要看起来像真的
          s.selfToss = p.idx; s.tossSkill = id;
          this.addFake(p, vx0, vy0, Math.cos(r) * v * p.dir, Math.sin(r) * v, Math.abs(tx) > 3 ? 'clear' : 'drop');
          o.fooled = true; o.cnt.fakeT = this.time;
          break;
        }
        case 'shuizhong': p.cnt.wob = 1; p.cnt.wobAim = aim; break;
        // —— 朱老师 ——
        case 'jiezou': b.jiezou = 10; p.cnt.combo = 3; break; // 接下来三拍自动调动
        case 'biaozhi': this.addEnt('cone', p.idx, o.side * clamp(o.side * o.x + (back ? 1.0 : -1.0), 0.7, this.halfOf(o.idx) - 0.3), 0, 4.5); break;
        case 'tingyixia': // 把球停在拍面上：可以走动、看站位，按击球键再出手
          s.ctl = { k: 'cradle', o: p.idx, t: 1.0 }; s.vx = 0; s.vy = 0; s.ver++;
          b.cradle = 1.0;
          break;
      }
    },

    /** 再按一次：第二段、提前结束或回收。没有可处理的状态时返回 false（会当作新发动） */
    recast(p, id, aim, vector) {
      const s = this.shuttle, b = p.buff, c = s.ctl;
      switch (id) {
        case 'hongxian': {
          if (c && c.k === 'tether' && c.o === p.idx) { this.ribbonFling(p, vector); return true; }
          return !!this.entOf('ribbon', p.idx); // 丝带还在飞：这一下不算新发动
        }
        case 'yueliang': if (c && c.k === 'orbit' && c.o === p.idx) { this.releaseOrbit(); return true; } return false;
        case 'huichao': if (c && c.k === 'rewind' && c.o === p.idx) { this.releaseRewind(); return true; } return false;
        case 'dangteng': if (p.cnt.vine) { this.releaseVine(p, vector); return true; } return false;
        case 'shuizhong': {
          const r = this.entOf('ripple', p.idx);
          if (r) { this.dropEnt(r); this.wobble(p.idx, aim); return true; }
          if (p.cnt.wob) { this.emit({ type: 'skillFail', p: p.idx, id, label: '过网后才能变轨' }); return true; }
          return false;
        }
        case 'zhongli': if (b.gravOn > 0) { this.endGravity(p); return true; } return false;
        case 'huiguo': {
          const w = s.wok; if (!w || w.o !== p.idx) return false;
          if (w.used) return true;
          if (!s.live || s.lastHitter !== p.idx || s.ctl || s.netHit) { s.wok = null; return false; }
          if (this.racketGap(this.players[1 - p.idx], s.x, s.y) < 1.6) { this.emit({ type: 'skillFail', p: p.idx, id, label: '来不及收了' }); return true; }
          this.recallWok(p); return true;
        }
        case 'baozi': {
          if (this.entOf('bunFly', p.idx)) return true; // 肉包还在飞
          const bz = s.bun; if (!bz || bz.o !== p.idx || !s.live) return false;
          this.bunRelease(p); return true;
        }
        case 'shensuo': {
          const e = this.entOf('pole', p.idx); if (!e) return false;
          if (e.ph === 0) { if(vector?.manual){e.a=Math.atan2(vector.y,vector.x);this.poleHead(p,e);}this.poleSwing(p, e); }
          else if (e.ph === 2) this.quickRecall(p, e);
          return true;
        }
        case 'youyou': {
          const e = this.entOf('yoyo', p.idx); if (!e) return false;
          if (e.ph === 3) return true; // 正在带球返回，不能删除接力球
          if (e.ph < 2) this.yoyoBack(p, e);
          else this.quickRecall(p, e);
          return true;
        }
        case 'xuanpai': {
          const e = this.entOf('spin', p.idx);
          if (e) { this.spinSweep(p, e, vector); return true; }
          if (p.cnt.recall?.kind === 'spin' && p.buff.shoushi > 0) { this.quickRecall(p, null); return true; }
          return false;
        }
        case 'shuangji': {
          if (c && c.k === 'freeze' && c.o === p.idx) {
            if (!c.thaw) { c.thaw = 1; c.t = Math.min(c.t, .16); this.proc(p, id, '即将解冻'); }
            return true;
          }
          return false;
        }
      }
      return false;
    },

    /** 技能触球：球的归属改为 p，重新开始一段飞行（不经过挥拍，但同样必须过网） */
    touchShuttle(p, shotType, name, id, q, quiet) {
      const s = this.shuttle;
      s.lastHitter = p.idx; s.netHit = false; s.crossedNet = false; s.shot = shotType; s.isServe = false;
      s.skillTag = id; s.cloneBy = null; s.relayQ = 0;
      s.speed = Math.hypot(s.vx, s.vy); s.hitX = s.x; s.selfToss = -1; s.ver++; s.path = []; s.oppQ = 1;
      s.wok = null; s.floorBy = null; s.rush = 0; s.hitAt = this.time; s.slam = null; s.puddle = 0; s.prism = null;
      if (this.gravKit(p)) s.grav = { o: p.idx };
      this.hitCount++;
      this.pred = YY.simulate(s.x, s.y, s.vx, s.vy, 6, true, false, this.physEnv()); this.pred.t0 = this.time; this.pred.hidden = false;
      this.emit({ type: 'hit', p: p.idx, shot: shotType, name, q: q || 0.6, label: name, speed: s.speed, x: s.x, y: s.y, vx: s.vx, vy: s.vy,
        reason: null, save: false, lowSave: false, serve: false, weak: false, skill: quiet ? null : id, device: true });
    },
    /** 装置代替挥拍完成一次回球：按正常球路求解（会过网），记为 p 的击球 */
    deviceReturn(p, btn, q, id, at, big) {
      const s = this.shuttle;
      if (at) { s.x = at.x; s.y = at.y; }
      s.y = Math.max(0.25, s.y); s.ctl = null;
      const shot = this.resolveShot(p, btn, q, false);
      s.vx = shot.vx; s.vy = shot.vy; s.live = true; s.held = false; s.netHit = false;
      if (big) this.hitstop = Math.max(this.hitstop, 0.07); // 装置打中的重击：顿帧 + 震屏
      this.afterHit(p, shot, q, { skill: id, device: true, big: big ? 1 : 0 });
    },
    /** 牵引中直接挥拍：先松开丝带，球停在拍前给她打 */
    releaseTether() {
      const s = this.shuttle; s.ctl = null; s.vx = 0; s.vy = 1.3; s.ver++;
      const e = this.entOf('ribbon'); if (e) e.ph = 2;
      this.pred = Object.assign(YY.simulate(s.x, s.y, s.vx, s.vy, 6, true, false, this.physEnv()), { t0: this.time });
    },
    /** 红丝带的起点（拍前）与头部 */
    ribbonHead(p, e) {
      e.px = e.x; e.py = e.y;
      const ox = p.x + p.dir * 0.3, oy = p.y + 1.45;
      e.ox = ox; e.oy = oy;
      e.x = ox + e.dx * p.dir * e.L; e.y = Math.max(0.15, oy + e.dy * e.L);
      if (p.side * e.x < 0.12) { e.x = p.side * 0.12; e.L=Math.min(e.L,Math.hypot(e.x-ox,e.y-oy)); } // 丝带过不了网
    },
    /** 点按：朝来球 0.25 秒后的位置射出；没有来球就斜向前上方 */
    ribbonAuto(p) {
      const s = this.shuttle, pr = this.pred;
      if (this.incomingTo(p) && pr && pr.pts && !s.ctl) {
        const el = this.time - (pr.t0 ?? this.time);
        for (const k of pr.pts) {
          if (k.t < el + 0.18 || p.side * k.x < 0.15) continue;
          const dx = (k.x - p.x) * p.dir - 0.3, dy = k.y - p.y - 1.45, d = Math.hypot(dx, dy);
          if (d < 0.2) break;
          if (Math.abs(d - 16 * (k.t - el)) < 0.6 || d < 16 * (k.t - el)) return { x: dx / d, y: dy / d };
        }
      }
      return { x: Math.cos(0.6), y: Math.sin(0.6) };
    },
    /** 丝带牵住的球：按拖动的角度与力度随拍击出；点按自动打向对手空当 */
    ribbonFling(p, v) {
      const s = this.shuttle, o = this.players[1 - p.idx];
      const deep=this.courtMode==='3d'?(this.inputs[p.idx].move||0)<-.25:!!v?.manual&&(v.x<-.25||v.y>.45);
      const depth=deep?this.halfOf(o.idx)-.7:1.2,type=deep||s.y<1.55?'lift':'drop';
      s.ctl=null;
      if(this.courtMode==='3d')Object.assign(s,YY.solveShot3D(s,{x:p.dir*depth,z:clamp(this.shotTarget(p,type).z,-2.15,2.15)},type,1,this.physEnv()));
      else [s.vx,s.vy]=this.launchFrom(s.x,s.y,p.dir,deep?58:s.y<1.55?48:24,depth,.15);
      const e=this.entOf('ribbon',p.idx);if(e){e.ph=2;e.t=Math.min(e.t,.35);}
      p.swing={t:.08,btn:deep?'clear':'drop',kind:'side',dur:.3,hit:true,prevE:99,judged:true,style:deep?'lift':'push',ribbon:1,contact:{t:.08,x:s.x,y:s.y,z:s.z||0}};
      this.hitstop=Math.max(this.hitstop,.035);this.afterHit(p,{type},.88,{skill:'hongxian',device:true});
      this.addEnt('atelier',p.idx,s.x,s.y,.55,{sid:'hongxian',burst:1,z:s.z||0});
      this.proc(p,'hongxian',deep?'回旋挑长':'回旋压短');
      o.replan = true;
    },
    /** 冻结窗格：解冻后按原速度继续飞 */
    unfreeze(label) {
      const s = this.shuttle, c = s.ctl;
      s.ctl = null; s.vx = c.vx; s.vy = c.vy; s.ver++;
      this.rePred();
      const e = this.ents.find(q => q.k === 'pane' && q.id === c.e); if (e) e.t = Math.min(e.t, 0.3);
      this.addEnt('iceShard', c.o, s.x, s.y, 0.6);
      this.proc(c.o, 'shuangji', label || '解冻');
    },
    /** 地板开球点按：在一圈角度里挑一条能过网、落在对手最远处的反弹线路 */
    slamAuto(p, x, y, steam) {
      const o = this.players[1 - p.idx], H = this.halfOf(o.idx), od = o.side * o.x, walls = YY.slamWalls(p, this.halfOf(p.idx));
      let best = null;
      for (let deg = -88; deg <= 268; deg += 4) {
        const a = deg * Math.PI / 180, d = { x: Math.cos(a), y: Math.sin(a) }, sp = steam ? 19 : 16;
        const r = YY.slamPath(x, y, d.x * sp * p.dir, d.y * sp, { side: p.side, walls, boost: steam ? 1.25 : 1.18, env: this.physEnv() });
        const land = o.side * r.landX;
        if (r.netHit || !r.crossed || land < 0.4 || land > H - 0.15) continue;
        const score = Math.abs(land - od) + r.n * 0.35 - (land > H - 0.4 ? 0.6 : 0);
        if (!best || score > best.score) best = { score, d };
      }
      return best ? best.d : { x: Math.cos(-0.7), y: Math.sin(-0.7) };
    },
    /** 肉包点按：朝 0.35 秒后的球（或自己刚打出的球）抛出 */
    bunAuto(p) {
      const s = this.shuttle, pr = this.pred, ox = p.x + p.dir * 0.35, oy = p.y + 1.7;
      if (s.live && !s.held && pr && pr.pts) {
        const el = this.time - (pr.t0 ?? this.time);
        for (const k of pr.pts) {
          if (k.t < el + 0.3) continue;
          const T = k.t - el, dx = (k.x - ox) * p.dir, dy = k.y - oy, vx = dx / T, vy = dy / T + 0.5 * BUN_G * T;
          if (Math.hypot(vx, vy) < 15) return { vx, vy };
          if (T > 1.2) break;
        }
      }
      return { vx: 7.5, vy: 6 };
    },
    /** 在当前方向附近寻找合法出包线路；不改变球权，不把对方的球隔空打回。 */
    bunFling(p) {
      const s = this.shuttle, bz = s.bun;
      if (!bz || bz.o !== p.idx || s.lastHitter !== p.idx || s.ctl || s.netHit || (bz.st || 0) < 3) return null;
      const o = this.players[1 - p.idx], sp = Math.hypot(s.vx, s.vy), angle = Math.atan2(s.vy, s.vx * p.dir);
      const max = Math.min(30, sp + bz.st);
      for (let k = 0; k < 5; k++) for (const da of [0, .08, -.08, .15, -.15]) {
        const speed = max - (max - Math.min(sp,30)) * k / 4, a = angle + da;
        const vx = Math.cos(a) * speed * p.dir, vy = Math.sin(a) * speed;
        const r = YY.simulate(s.x, s.y, vx, vy, 6, false, false, this.physEnv());
        const d = o.side * r.landX;
        if (!r.netHit && d > .6 && d < this.halfOf(o.idx) - .3 && vx * p.dir > 0) return { vx, vy, land:r.landX };
      }
      return null;
    },
    /** 释放只在自己的合法出球上生效；压力不足、角度不安全时保留肉包。 */
    bunRelease(p) {
      const s = this.shuttle, bz = s.bun, f = this.bunFling(p);
      if (!f) { this.proc(p, 'baozi', s.lastHitter !== p.idx ? '先亲手回球，再拆包' : '方向或压力不足 · 保留肉包'); return false; }
      const add = bz.st || 0;
      s.vx = f.vx; s.vy = f.vy; s.bun = null; s.rush = 0; s.ver++;
      this.addEnt('crumbs', p.idx, s.x, s.y, 0.7); this.addEnt('steam', p.idx, s.x, s.y, 0.8, { big: 1 });
      if (add > 3) { s.lever = Math.max(s.lever || 0, 1 + Math.min(1.5, add / 14)); this.hitstop = Math.max(this.hitstop, 0.06); }
      this.rePred();
      this.proc(p, 'baozi', add > 3 ? '延迟发力 +' + Math.round(add * 3.6) + ' km/h' : '肉包破了');
      this.zheteng(p, '拆包');
      return true;
    },
    /** 积水落点：对手的球第一次落在她半场的积水上，弹起一次 */
    poolBounce(x) {
      const s = this.shuttle;
      if (s.netHit || s.puddle) return false;
      for (const e of this.ents) {
        if (e.k !== 'pool' || (e.n ?? 2) <= 0) continue;
        const p = this.players[e.o], d = p.side * x;
        if (s.lastHitter === p.idx || d <= 0.05 || d > this.halfOf(p.idx) + C.LINE_TOL) continue;
        s.puddle = 1; s.y = C.SHUTTLE_R + 0.02; s.vx *= 0.3; s.vy = 4.2; s.ver++;
        e.hits = (e.hits || 0) + 1;
        e.n = (e.n ?? 2) - 1;
        this.addEnt('splash', p.idx, x, 0.2, 0.6); this.addEnt('ripplePool', p.idx, x, 0, 0.8);
        this.rePred(false);
        this.proc(p, 'chaolai', '积水托球 · 剩余 ' + e.n);
        this.emit({ type: 'splash', p: p.idx, x });
        return true;
      }
      return false;
    },
    /** 地板开球：第一次砸到自己地板反弹（豁免一次） */
    slamFloor(x) {
      const s = this.shuttle, c = s.slam;
      if (!c || !c.floor || s.lastHitter !== c.o || s.crossedNet || s.netHit) return false;
      const p = this.players[c.o];
      if (p.side * x <= 0) return false;
      c.floor = 0; s.y = C.SHUTTLE_R + 0.02; s.vy = Math.abs(s.vy);
      this.slamBoost(p, x, 0.1, '地板');
      this.addEnt('quake', p.idx, x, 0, 1.6, { v: p.dir * 10, hit: 0 }); // 震波沿地面冲向对面
      this.emit({ type: 'quake', p: p.idx, x });
      return true;
    },
    slamBoost(p, x, y, where) {
      const s = this.shuttle, c = s.slam, k = c.steam ? 1.25 : 1.18;
      const sp = Math.hypot(s.vx, s.vy), nsp = Math.min(32, sp * k);
      if (sp > 0.1) { s.vx *= nsp / sp; s.vy *= nsp / sp; }
      c.n++; s.ver++; s.rush = 0.5;
      this.hitstop = Math.max(this.hitstop, 0.04);
      this.addEnt('steam', p.idx, x, y, 0.8, { n: c.n });
      this.pred = Object.assign(YY.slamPath(s.x, s.y, s.vx, s.vy, { side: p.side, walls: this.wallsOf(p.idx), boost: k, floor: c.floor, env: this.physEnv() }), { t0: this.time, hidden: false });
      this.proc(p, 'diban', where + '反弹 · 加速 ×' + c.n);
    },
    wallsOf(o) { return this.entsOf('wall', o).filter(w => !w.used); },
    /** 反射板只处理对方来球、自抛或板间接力。出口为提前标出的固定区域。 */
    boardBounce(e, p) {
      const s=this.shuttle,incoming=s.lastHitter!==p.idx;
      const chain=s.prism&&s.prism.o===p.idx&&!incoming?s.prism:{o:p.idx,n:0,used:[]};
      chain.n=Math.min(3,chain.n+1);chain.used.push(e.id);e.n--;e.cool=this.time+.35;e.hitT=this.time;
      s.x=e.x;s.y=e.y;
      const rest=this.entsOf('board',p.idx).filter(b=>b!==e&&!chain.used.includes(b.id)&&b.n>0&&b.age>=(b.warm??.45));
      const next=rest.find(b=>b.id>e.id)||rest[0];
      if(next)this.aimAt(next.x,next.y,11);
      else {
        const v=this.boardExit(p,e);s.vx=v[0];s.vy=v[1];s.selfToss=-1;
        s.lever=0;s.oppQ=1;s.rush=0;
      }
      if(incoming)this.afterHit(p,{type:'lift'},.7,{skill:'fanshe',device:true});
      s.prism=chain;s.ver++;this.rePred();this.addEnt('shards',e.o,e.x,e.y,.45,{n:chain.n});
      if(e.n<=0)e.t=Math.min(e.t,.25);
      this.proc(p,'fanshe',next?'折射 → 下一块':'定点回球');return true;
    },
    boardExit(p,e) {
      const target=e.target??4.2;
      for(const angle of [32,44,56,68]) {
        const v=this.launchFrom(e.x,e.y,p.dir,angle,target,.28);
        if(Math.hypot(...v)<=18)return v;
      }
      return this.launchFrom(e.x,e.y,p.dir,68,target,.28);
    },
    /** 校准辅助：合法球路保持原样，只把下网/出界的失误修回同类落区。 */
    lineShot(p,shot) {
      const g=this.entOf('guide',p.idx);if(!g||!shot.type)return false;
      const s=this.shuttle,o=this.players[1-p.idx],H=this.halfOf(o.idx),env=this.physEnv();
      const flight=YY.simulate(s.x,s.y,shot.vx,shot.vy,6,false,p.side*s.x<=0,env),land=o.side*flight.landX;
      const safe=!flight.netHit&&land>.35&&land<H-.2&&(flight.netY==null||flight.netY>C.NET_H+.1);
      let corrected=false;
      if(!safe) {
        const short=['net','tumble','block','drop'].includes(shot.type),high=['clear','lift','flatclear','push'].includes(shot.type);
        const target=short?1.5:high?H-.85:clamp(land,2.2,H-.8),base=short?30:high?55:18;
        const v=this.launchFrom(s.x,s.y,p.dir,base,target,.18);
        const check=YY.simulate(s.x,s.y,v[0],v[1],6,false,p.side*s.x<=0,env),d=o.side*check.landX;
        if(check.netHit||d<=.3||d>=H-.15)return false; // 没有安全修正时保留原球路和次数
        shot.vx=v[0];shot.vy=v[1];shot.reason=null;corrected=true;
      }
      g.n--;if(g.n<=0)this.dropEnt(g);
      this.addEnt('lineFlash',p.idx,s.x,s.y,.45,{a:Math.atan2(shot.vy,shot.vx*p.dir),d:p.dir,corrected});
      return true;
    },
    /** 把球从当前位置射向 (tx, ty)：按真实空气阻力迭代修正出手速度 */
    aimAt(tx, ty, sp) {
      const s = this.shuttle, env = this.physEnv(), d = dist(s.x, s.y, tx, ty) || 1;
      let vx = (tx - s.x) / d * sp, vy = (ty - s.y) / d * sp;
      for (let k = 0; k < 4; k++) {
        const r = YY.simulate(s.x, s.y, vx, vy, 1.5, true, false, env);
        let best = r.pts[0], bd = 99;
        for (const q of r.pts) { const dd = dist(q.x, q.y, tx, ty); if (dd < bd) { bd = dd; best = q; } }
        if (bd < .12) break;
        const T = Math.max(.08, best.t);
        vx += (tx - best.x) / T; vy += (ty - best.y) / T;
      }
      s.vx = vx; s.vy = vy;
    },
    /** 月亮甩出：沿当前切线方向飞出，转过的圈数越多速度越快（最快约 24 m/s） */
    orbitFling(c) {
      const dir = Math.sign(c.w) || 1, sp = clamp(6 + (c.spun || 0) * 1.25, 6, 24);
      return { vx: -Math.sin(c.a) * dir * sp, vy: Math.cos(c.a) * dir * sp, sp, turns: (c.spun || 0) / (Math.PI * 2) };
    },
    releaseOrbit() {
      const s = this.shuttle, c = s.ctl, p = this.players[c.o], f = this.orbitFling(c);
      s.ctl = null; s.vx = f.vx; s.vy = f.vy;
      this.afterHit(p, { type: f.sp > 15 ? (f.vy < 0 ? 'smash' : 'drive') : f.vy > 3 ? 'clear' : 'drive' }, .85, { skill:'yueliang', device:true });
      this.orbitLoose(p);
      this.proc(p, 'yueliang', '甩出 · ' + f.turns.toFixed(1) + ' 圈');
    },
    /** 转太久没甩：月亮松手，球在原地落下（仍算星星的触球） */
    dropOrbit() {
      const s = this.shuttle, p = this.players[s.ctl.o];
      s.ctl = null; s.vx = 0; s.vy = 0.8;
      this.afterHit(p, { type: 'drop' }, .6, { skill:'yueliang', device:true });
      this.orbitLoose(p);
      this.proc(p, 'yueliang', '月亮松手了');
    },
    /** 甩出 / 松手后：球还在己方半场就允许星星再补一拍（落在自己场内、出界、下网都算她丢分） */
    orbitLoose(p) {
      const s = this.shuttle;
      if (p.side * s.x > 0.1) { s.selfToss = p.idx; s.tossSkill = 'yueliang'; }
      const m = this.entOf('moon', p.idx); if (m) this.dropEnt(m);
    },
    /** 回潮松手：球从当前位置自然下坠，记为她的一次触球 */
    releaseRewind() {
      const s = this.shuttle, c = s.ctl, p = this.players[c.o];
      const q = c.path[clamp(c.i, 0, c.path.length - 1)] || [s.x, s.y, 0, 0];
      s.ctl = null; s.y = Math.max(0.3, s.y);
      s.vx = -q[2] * 0.12; s.vy = 0.6;
      this.touchShuttle(p, 'drop', '回潮', 'huichao', 0.6);
      s.crossedNet = p.side * s.x < 0;
      if (c.tide) { s.oppQ = 0.8; s.tide = p.idx; this.addEnt('splash', p.idx, s.x, s.y, 0.6); } // 浪涌球：湿重难接
      const e = this.entOf('rewind', p.idx); if (e) e.t = Math.min(e.t, 0.5);
      this.proc(p, 'huichao', c.tide ? (s.crossedNet ? '浪涌球！' : '浪涌…还没过网') : s.crossedNet ? '放！' : '还没过网……');
    },
    /** 荡藤松手：保持当时的速度飞出去，落地前收不住 */
    releaseVine(p, v) {
      const c = p.cnt; c.vine = null; p.buff.vine = 0;
      if (v?.manual) { p.vx = p.dir * v.x * 7; p.vy = clamp(v.y * 6, -2, 5.2); }
      else { p.vx = clamp(p.vx, -7.5, 7.5); p.vy = Math.max(2.1, Math.min(5.2, p.vy)); }
      c.fling = p.vx; p.buff.vineStrike = 1.6; p.onGround = false; p.replan = true;
      const e = this.entOf('vine', p.idx); if (e) { e.t = Math.min(e.t, 0.35); e.cut = 1; }
      this.proc(p, 'dangteng', '飞！');
    },
    /** 来球在 p 身前合适高度的接球站位（闪现、荡藤用） */
    interceptX(p) {
      const s = this.shuttle, pr = this.pred;
      if (!this.incomingTo(p) || !pr || !pr.pts || s.ctl) return null;
      const el = this.time - (pr.t0 == null ? this.time : pr.t0);
      let pt = null, last = null;
      for (const k of pr.pts) {
        if (p.side * k.x < 0.4 || k.vy >= 0 || k.y > 2.3 || k.y < 1.0) continue;
        last = k; if (k.t >= el + 0.12) { pt = k; break; }
      }
      pt = pt || last;
      return pt ? pt.x - p.dir * 0.65 : pr.landX - p.dir * 0.6;
    },
    /** 筋斗云的目的地：来球第一个够高的点（头顶前方），没有高点就去接球点，没有来球就回中场 */
    cloudTarget(p) {
      const s = this.shuttle, pr = this.pred;
      const lo = C.X_NEAR + 0.2, hi = Math.min(C.X_FAR, this.halfOf(p.idx) + 0.3), fix = (x) => p.side * clamp(p.side * x, lo, hi);
      if (this.incomingTo(p) && pr && pr.pts && !s.ctl) {
        const el = this.time - (pr.t0 == null ? this.time : pr.t0);
        for (const k of pr.pts) {
          if (k.t < el + 0.2 || k.t > el + 1.3 || p.side * k.x < 0.5) continue;
          if (k.y >= 2.55 && k.y <= 4.2) return { x: fix(k.x - p.dir * 0.3), y: clamp(k.y - C.SHOULDER - 0.8, 0.25, 2.3), hi: 1 };
        }
        const ix = this.interceptX(p);
        if (ix != null) return { x: fix(ix), y: 0.35, hi: 0 };
      }
      return { x: fix(p.side * 3), y: 0.8, hi: 0 };
    },
    /** 签到表：对手最近三拍里吊网前多，就押网前 */
    habitFront(o) {
      const reader = this.players[1-o.idx], marks = this.hasPassive(reader,'qiandao') ? this.entsOf('sign',reader.idx).slice(-3) : [];
      const h = marks.length ? marks.map(e=>e.cat) : this.history[o.idx].slice(-3);
      return h.length && h.filter(c => c === 'drop').length * 2 > h.length ? 1 : 0;
    },
    /** 重新预测落点（技能改了球路之后） */
    /** 携带重力换班：她打过的球都是重力球 */
    gravKit(p) { return !!(p.kit && p.kit.act && p.kit.act.includes('zhongli')); },
    rePred(hidden) {
      const s = this.shuttle;
      this.pred = Object.assign(YY.simulate(s.x, s.y, s.vx, s.vy, 6, true, s.netHit, this.physEnv()), { t0: this.time, hidden: hidden != null ? hidden : this.hintHidden() });
    },
    /** 借网弹射：挂在糖网上 / 红线牵着的球被网绳弹出去，记为冉冉的一拍 */
    sling(p, aim) {
      const s = this.shuttle, c = s.ctl, o = this.players[1 - p.idx], H = this.halfOf(o.idx);
      if (c && c.k === 'stick') { s.x = o.side * 0.12; s.y = C.NET_H + 0.18; }
      s.ctl = null; s.y = Math.max(s.y, 0.8);
      if (p.side * s.x > 0) s.x = p.side * Math.max(0.3, p.side * s.x);
      const kill = aim > 0.3 || (c && c.k === 'stick' && aim > -0.3);
      const tgt = kill ? clamp(o.side * o.x < 2.6 ? 3.4 : 1.3, 1.2, H - 0.5) : H - 0.6;
      if (p.side * s.x < 0) { // 已经在网那边：直接朝落点射出，不用再判过网
        const a = kill ? -18 : 6, v = YY.solveSpeed(s.x, s.y, p.dir, a, tgt - Math.abs(s.x), this.physEnv()), r = a * Math.PI / 180;
        s.vx = Math.cos(r) * v * p.dir; s.vy = Math.sin(r) * v; s.crossedNet = true;
      } else [s.vx, s.vy] = this.launchFrom(s.x, s.y, p.dir, kill ? -12 : 8, tgt, 0.12);
      const over = p.side * s.x < 0;
      this.hitstop = Math.max(this.hitstop, 0.06);
      this.afterHit(p, { type: kill ? 'kill' : 'drive' }, 0.85, { skill: 'jiewang', device: true, big: 1 });
      if (over) s.crossedNet = true; // 从网带另一侧弹出：已经过网
      this.proc(p, 'jiewang', '弹弓！');
    },
    /** 停一下：按下击球键，从拍面上精准出手（落点不给对手看） */
    releaseCradle(p, btn) {
      const s = this.shuttle;
      s.ctl = null; p.buff.cradle = 0;
      s.x = p.x + p.dir * 0.55; s.y = p.y + C.SHOULDER + 0.3;
      if (p.side * s.x < 1.3) s.x = p.side * 1.3; // 贴网太近不好出手：球停在离网 1.3 米处
      p.swing = { t: C.SW_SWEET, btn, kind: 'side', dur: 0.3, hit: true, prevE: 99, judged: true, serve: false, style: btn === 'drop' ? 'net' : btn === 'smash' ? 'drive' : 'lift' };
      const shot = this.resolveShot(p, btn, 1, false); // 手感细腻：没有出手误差
      s.vx = shot.vx; s.vy = shot.vy; s.live = true; s.held = false; s.netHit = false;
      this.afterHit(p, shot, 1, { skill: 'tingyixia' });
      s.hide = false; if (this.pred) this.pred.hidden = false;
      this.proc(p, 'tingyixia', '——走！');
    },
    /** 当前球的横向速度乘 k 后，落点离网多远（不计球网） */
    landOf(k) {
      const s = this.shuttle, hitter = this.players[s.lastHitter];
      return -hitter.side * YY.simulate(s.x, s.y, s.vx * k, s.vy, 6, false, true, this.physEnv()).landX;
    },
    solveVx(want) {
      let lo = 0.3, hi = 2.2;
      for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (this.landOf(mid) < want) lo = mid; else hi = mid; }
      return (lo + hi) / 2;
    },
    /** 假球：样子、拖尾、落点提示都和真球一样；下落到 1 米高时碎掉 */
    addFake(p, x, y, vx, vy, kind) {
      const lx = YY.simulate(x, y, vx, vy, 6, false, true, this.env).landX;
      return this.addEnt('fake', p.idx, x, y, 5, { vx, vy, lx, kind: kind || null });
    },
    /** 从 (x, y) 朝 dir 出球：固定角度求速度，过网高度不够就抬角度（地板反弹用） */
    launchFrom(x, y, dir, a0, tgt, margin) {
      const back = -dir * x; let a = a0, v = 0;
      for (let k = 0; k < 12; k++) {
        v = YY.solveSpeed(x, y, dir, a, tgt + back, this.env);
        const r = a * Math.PI / 180, ny = YY.netClear(x, y, v * Math.cos(r) * dir, v * Math.sin(r), this.env);
        if (ny >= C.NET_CLEAR + margin || a >= 76) break;
        a = Math.min(76, a + 4);
      }
      const r = a * Math.PI / 180;
      return [v * Math.cos(r) * dir, v * Math.sin(r)];
    },
    /** 回锅再炒：沿弧线折返己方，落到王瑞头顶前方，等他自己再打一拍 */
    recallWok(p) {
      const s = this.shuttle; s.wok.used = 1;
      const ex = p.side * clamp(p.side * p.x - 0.4, 1.4, this.halfOf(p.idx) - 0.6), ey = 2.7;
      const top = Math.max(s.y, ey) + 1.5, P = [[s.x, s.y], [(s.x + ex) / 2, top], [ex, ey]];
      const T = clamp(Math.abs(s.x - ex) / 6, 0.55, 1.0);
      s.ctl = { k: 'wok', o: p.idx, P, f: 0, T, steam:s.bun?.o === p.idx }; s.ver++;
      this.addEnt('wokArc', p.idx, s.x, s.y, T + 0.2, { pts: [0, 0.2, 0.4, 0.6, 0.8, 1].map(u => bez(P, u)) });
      this.proc(p, 'huiguo', '收回来！');
    },
    releaseWok() {
      const s = this.shuttle, c = s.ctl, p = this.players[c.o];
      if (c.steam || s.bun?.o === p.idx) { p.cnt.steam = this.time + 3; p.buff.bunSteam = 3; s.bun = null; this.proc(p, 'baozi', '回锅保馅 · 下一拍强化'); }
      s.ctl = null; s.wok = null; s.vx = p.side * 0.5; s.vy = 0.6; s.ver++;
      s.selfToss = p.idx; s.tossSkill = 'huiguo'; s.crossedNet = false; s.netHit = false;
      this.hitCount++;
      this.pred = Object.assign(YY.simulate(s.x, s.y, s.vx, s.vy, 6, true, false, this.physEnv()), { t0: this.time });
    },
    /** 球拍装置能否碰到这只球（对手打来的、在己方这边、没被控住） */
    devHit(p) {
      const s = this.shuttle;
      return s.live && !s.ctl && !s.held && !s.netHit && s.lastHitter !== p.idx && p.side * s.x > 0.05;
    },
    poleHead(p, e) {
      e.px = e.x; e.py = e.y;
      e.x = p.side * clamp(p.side * (p.x + p.dir * (.25 + e.L * Math.cos(e.a))), .18, this.halfOf(p.idx) + .45);
      e.y = Math.max(.25, p.y + 1.35 + e.L * Math.sin(e.a));
    },
    poleSwing(p, e) { e.ph = 1; e.sw = 0.18; e.strokeAt = this.time; this.emit({type:'skillMotion',p:p.idx,id:'shensuo',stage:'strike'}); this.poleTry(p, e); },
    /** 拍头碰到球：伸长途中自动出手（半径更大），挥出去的那一下也能打 */
    poleTry(p, e) {
      const s = this.shuttle;
      if (e.used || !this.devHit(p) || !s.crossedNet || !this.deviceContact(e, e.boost ? .94 : .8)) return;
      if (e.ph === 0) { e.ph = 1; e.strokeAt = this.time; this.emit({type:'skillMotion',p:p.idx,id:'shensuo',stage:'strike'}); }
      e.used = 1; e.sw = .13; e.impactAt = this.time; e.impact = {x:s.x,y:s.y,z:s.z??0,t:this.time};
      const smash = e.y >= 1.9 && s.vy < 1.5;
      this.mechanicalReturn(p, e, 'shensuo', smash);
      this.proc(p, 'shensuo', smash ? '长拍暴扣！' : '长拍够到了！');
    },
    yoyoHead(p, e) {
      e.px = e.x; e.py = e.y;
      let x = (e.ax ?? p.x) + e.dx * e.d;
      x = p.side * clamp(p.side * x, 0.25, this.halfOf(p.idx) + 0.6);
      e.x = x; e.y = Math.max(.25, (e.ay ?? p.y+1.5) + (e.dy || 0) * e.d);
    },
    yoyoBack(p,e) { if(e.ph>=2)return;e.ph=2;this.startRecall(p,e.dx*p.dir>=0?1:-1,e); },
    yoyoCatch(p,e) {
      const s=this.shuttle;e.used=1;e.ph=3;e.x=s.x;e.y=s.y;e.px=s.x;e.py=s.y;
      if(this.courtMode==='3d')e.z=s.z;
      p.cnt.recall=null;p.buff.shoushi=0;
      s.vx=0;s.vy=0;this.touchShuttle(p,'lift','飞轮锁球','youyou',.7);
      s.ctl={k:'yoyo',o:p.idx,e:e.id,t:1.2};s.ver++;this.pred=null;
      this.proc(p,'youyou','接住了 · 收回拍前');
      if(this.hasPassive(p,'jixie'))p.buff.overclock=3;
    },
    yoyoRelease(p,e) {
      const s=this.shuttle;
      if(s.ctl?.k!=='yoyo'||s.ctl.e!==e.id)return;
      s.ctl=null;s.x=e.x;s.y=Math.max(1.65,e.y);s.vx=p.dir*.7;s.vy=3.8;
      s.selfToss=p.idx;s.tossSkill='youyou';s.crossedNet=false;s.netHit=false;s.held=false;s.ver++;
      this.rePred();this.startRecall(p,e.dx*p.dir>=0?1:-1,e);e.ph=2;e.released=1;
      this.proc(p,'youyou','到手 · 自己选下一拍');
    },
    deviceContact(e, radius) {
      const s = this.shuttle, old = s.path?.[s.path.length - 2];
      const ax = (old ? old[0] : s.x) - (e.px ?? e.x), ay = (old ? old[1] : s.y) - (e.py ?? e.y);
      const bx = s.x-e.x, by = s.y-e.y, dx = bx-ax, dy = by-ay;
      const u = clamp(-(ax*dx+ay*dy)/(dx*dx+dy*dy || 1), 0, 1);
      return Math.hypot(ax+dx*u, ay+dy*u) <= radius;
    },
    mechanicalReturn(p, e, id, smash) {
      const s = this.shuttle, o = this.players[1-p.idx], deep = o.side*o.x < 3.2;
      const target = deep ? this.halfOf(o.idx)-.65 : 1.4;
      const angle = smash ? -15 : s.y > 1.6 ? 18 : 50;
      [s.vx,s.vy] = this.launchFrom(s.x, s.y, p.dir, angle, target, .15);
      s.ctl = null;
      this.hitstop = Math.max(this.hitstop, .045);
      this.afterHit(p, { type:smash ? 'smash' : 'drive' }, .92, { skill:id, device:true, big:1 });
      if (this.hasPassive(p, 'jixie')) p.buff.overclock = 3;
    },
    quickRecall(p, e) {
      const r = p.cnt.recall;
      if (r && !r.done && r.t > 0) { r.done = 1; this.gainEnergy(p, 6); this.proc(p, 'jixie', '回收 +6'); }
      if (e) { this.dropEnt(e); p.buff[e.k === 'pole' ? 'shensuo' : e.k === 'spin' ? 'xuanpai' : 'youyou'] = 0; }
      p.buff.shoushi = 0; p.cnt.recall = null;
    },
    spinSweep(p, e, v) {
      if (e.used) { this.startRecall(p, e.ref, e); this.quickRecall(p, e); return; }
      if (e.swept) return;
      e.swept = 1; e.t = .18; e.r = e.boost ? 1.65 : 1.5;
      e.ph0 = (v?.manual ? Math.atan2(v.y, v.x) : .35) - e.w * e.age;
      p.buff.xuanpai = e.t;
      this.proc(p, 'xuanpai', '定向扫回');
    },
    takeCompile(p) {
      if (!(p.cnt.compile > 0)) return 0;
      p.cnt.compile = 0; this.proc(p,'rizhi','编译标记已使用'); return 1;
    },
    // 同时借网时由本次击球方优先；对称规则不依赖玩家数组顺序。
    netBorrower() {
      const hitter = this.players[this.shuttle.lastHitter];
      return hitter?.buff.jiewang > 0 ? hitter : this.players.find(p=>p.buff.jiewang>0);
    },
    // ---------- 路先森：复制体 / 接力 / 脏数据 ----------
    /** 复制体跟着本体挥拍：armed=true 是正常挥拍（可以击球），false 只做动作 */
    cloneSwing(p, anim) {
      const sw = p.swing; if (!sw) return;
      for (const e of this.ents) if (e.k === 'clone' && e.o === p.idx) {
        e.ref = sw;
        e.sw = { t: sw.t, btn: sw.btn, kind: sw.kind, dur: sw.dur, style: sw.style, hit: !!anim || e.warm > 0, prevE: 99, judged: true, serve: !!sw.serve,
          toss: sw.toss ? 1 : 0, relay: sw.relay ? 1 : 0 };
      }
    },
    /** 复制体拍前的球：临时让本体站到复制体的位置走一遍正常的击球判定 */
    cloneContact(dt, previous, flightTime) {
      for (const e of this.ents) {
        if (e.k !== 'clone' || !e.sw || e.sw.hit || e.warm > 0) continue;
        const p = this.players[e.o], keep = { x: p.x, z: p.z, vx: p.vx, swing: p.swing, slow: p.slow, flash: p.flash };
        if (e.ref && e.ref === p.swing) e.sw.t = p.swing.t; // 和本体同一帧挥拍
        e.y = p.y; // 跳跃同步：高度始终和本体一致
        const prev = previous && Object.assign({}, previous, { players: previous.players.map((q, i) => i === p.idx ? { x: e.x, y: q.y, z:e.z } : q) });
        p.x = e.x; if(this.courtMode==='3d')p.z=e.z||0; p.vx = 0; p.swing = e.sw;
        this.cloneHitting = e;
        let hit = false;
        try { hit = !!this.checkContact(p, dt, prev, flightTime); }
        finally { this.cloneHitting = null; Object.assign(p, keep); }
        if (hit) { e.hits++; this.addEnt('cloneFx', p.idx, e.x, e.y, 0.35, { hit: 1 }); this.proc(p, 'fuzhi', '复制体击球'); return true; }
      }
      return false;
    },
    /** 复制体打出（或接力垫出）的球落在己方半场：弹起一次，本体或复制体还能再打 */
    cloneBounce(x) {
      const s = this.shuttle, i = s.cloneBy;
      if (i == null || s.lastHitter !== i) return false;
      const p = this.players[i]; if (p.side * x <= 0.05) return false;
      s.cloneBy = null; s.x = x; s.y = C.SHUTTLE_R + 0.02; s.vx *= 0.25; s.vy = 4.4; s.netHit = false; s.crossedNet = false;
      s.selfToss = p.idx; s.tossSkill = 'fuzhi'; s.ver++;
      this.rePred(false);
      this.addEnt('cloneHop', p.idx, x, 0, 0.7);
      this.proc(p, 'fuzhi', '复制体托底 · 弹起一次');
      return true;
    },
    /** 接力到位：球停在接球端头顶，按击球键才出手 */
    releaseRelay() {
      const s = this.shuttle, c = s.ctl, p = this.players[c.o], P = c.P;
      s.ctl = null; s.x = P[2][0]; s.y = P[2][1];
      s.vx = 2 * (P[2][0] - P[1][0]) / c.T * 0.22; s.vy = Math.min(0.3, 2 * (P[2][1] - P[1][1]) / c.T * 0.22); s.ver++;
      s.selfToss = p.idx; s.tossSkill = 'jieli'; s.relayQ = c.q || 0; s.crossedNet = false; s.netHit = false;
      this.pred = Object.assign(YY.simulate(s.x, s.y, s.vx, s.vy, 6, true, false, this.physEnv()), { t0: this.time, hidden: false });
    },
    /** 脏数据的随机数：只用自己的种子，不碰比赛的随机序列 */
    dirtyRand(p) {
      const c = p.cnt; let x = (c.dirtySeed ?? ((this.hitCount * 2654435761 + p.idx * 97 + 12345) >>> 0)) >>> 0;
      return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; c.dirtySeed = x; return x / 4294967296; };
    },
    entRand(e) { e.seed = (Math.imul(e.seed >>> 0, 1664525) + 1013904223) >>> 0; return e.seed / 4294967296; },
    /** 脏数据球：自己的物理，穿过球网；落地乱弹，被击打或弹回 5 次后消失 */
    dirtyStep(e, dt) {
      if (this.phase !== 'rally') { e.t = 0; return; }
      e.px = e.x; e.py = e.y;
      const f = { x: e.x, y: e.y, vx: e.vx, vy: e.vy, netHit: true }, r = YY.stepShuttle(f, dt, this.env);
      e.x = f.x; e.y = f.y; e.vx = f.vx; e.vy = f.vy; e.t = Math.max(e.t, 0.5);
      const o = this.players[1 - e.o];
      if (o.side * e.x > C.SHUTTLE_R && this.dirtyHit(o, e)) return;
      if (r === 'floor') this.dirtyBounce(e);
      if (e.age > 15) this.dirtyGone(e);
    },
    dirtyGone(e) { e.t = 0; this.addEnt('dirtyPop', e.o, e.x, Math.max(0.15, e.y), 0.7); },
    /** 对手挥拍碰到脏数据球：这一下挥拍就用掉了，球照常被打回去 */
    dirtyHit(o, e) {
      const sw = o.swing;
      if (!sw || sw.hit || sw.serve || sw.t < C.SW_W0 || sw.t > C.SW_W1) return false;
      const err = this.ringError(o, e), reach = C.REACH * o.st.reach * this.mods(o).reach;
      if (err >= reach) return false;
      sw.hit = true; sw.judged = true; sw.contact = { x: e.x, y: e.y, t: sw.t };
      const q = clamp(1 - err / reach, 0, 1) * 0.6 + 0.35, me = this.players[e.o], H = this.halfOf(me.idx), rnd = () => this.entRand(e);
      const type = sw.btn === 'smash' ? (e.y > 2.2 ? 'smash' : 'drive') : sw.btn === 'drop' ? 'drop' : 'clear';
      const depth = type === 'drop' ? 1.3 + rnd() * .8 : type === 'clear' ? H - .6 - rnd() * 1.2 : 2.6 + rnd() * 2.4;
      const ang = { smash: -12, drive: 4, drop: 16, clear: 42 }[type];
      [e.vx, e.vy] = this.launchFrom(e.x, e.y, o.dir, ang, depth, type === 'drop' ? .1 : .3);
      sw.style = type;
      e.n++; e.hitBy = o.idx; e.kind = type;
      e.lx = YY.simulate(e.x, e.y, e.vx, e.vy, 6, false, true, this.env).landX;
      this.emit({ type: 'hit', p: o.idx, shot: type, name: YY.SHOT_NAMES[type], q, label: q >= .85 ? '完美' : q >= .6 ? '好球' : '一般',
        speed: Math.hypot(e.vx, e.vy), x: e.x, y: e.y, vx: e.vx, vy: e.vy, reason: null, save: false, lowSave: false, serve: false, weak: false, skill: null, dirty: e.id });
      this.proc(me, 'zangshu', '对手打中了脏数据 ' + e.n + '/5', { tip: true });
      if (e.n >= 5) this.dirtyGone(e);
      return true;
    },
    /** 落地：沿随机角度弹回另一边的场地 */
    dirtyBounce(e) {
      e.n++;
      if (e.n >= 5) { this.dirtyGone(e); return; }
      const land = Math.sign(e.x) || 1, dir = -land, toIdx = dir < 0 ? 0 : 1, H = this.halfOf(toIdx), rnd = () => this.entRand(e);
      const depth = 1.2 + rnd() * (H - 1.9), ang = 28 + rnd() * 36;
      const x = land * Math.max(0.5, Math.abs(e.x));
      [e.vx, e.vy] = this.launchFrom(x, 0.12, dir, ang, depth, .3);
      e.x = x; e.y = 0.12; e.kind = ang > 45 ? 'clear' : 'drop';
      e.lx = YY.simulate(e.x, e.y, e.vx, e.vy, 6, false, true, this.env).landX;
      this.addEnt('dirtyHop', e.o, e.x, 0, 0.6);
      this.emit({ type: 'dirtyBounce', p: e.o, x: e.x, n: e.n });
    },
    endGravity(p) {
      p.buff.gravOn = 0; p.buff.gravRest = 1; p.skillCd = .5;
      if (this.shuttle.grav) this.rePred(false);
      this.proc(p, 'zhongli', '重力恢复 · 稳定 1 秒');
    },
    /** 机械回收：收招时反向移动，球拍瞬间收回并返还能量 */
    startRecall(p, ref, e) {
      if (!this.hasPassive(p, 'jixie')) return;
      if (e?.recallStarted) return;
      if(e)e.recallStarted=1;
      p.cnt.recall = { t: 0.45, ref, done: 0, e: e ? e.id : 0, kind:e?.k||'spin' };
    },
    /** 越折腾，越来劲：完成一次特殊操作，每拍最多一次 */
    zheteng(p, label) {
      if (!this.hasPassive(p, 'zheteng') || p.cnt.ztAt === this.hitCount || (p.cnt.ztGain||0)>=18) return;
      p.cnt.ztAt = this.hitCount; p.cnt.ztGain=(p.cnt.ztGain||0)+6; this.gainEnergy(p, 6); this.proc(p, 'zheteng', label + ' +6');
    },

    // ---------- 选手 ----------
    skMove(p, mv, dt) {
      const b = p.buff, M = this.mods(p), c = p.cnt;
      if (c.vine) return 0; // 藤上：方向键用来荡
      if (c.fling != null && !p.onGround) { c.fling = YY.lerp(c.fling, mv * p.dir * this.maxSpeed(p), Math.min(1, dt * 2.8)); p.drive = c.fling; return 0; }
      if (M.fix) { p.vx = 0; return 0; }
      if (b.prone > 0) { p.vx *= 0.8; return 0; }
      if (b.dive > 0) { p.drive = p.cnt.diveW * 7.2; return 0; }
      if (c.cloud) return 0; // 驾云：云带着走
      if (b.knock > 0) { p.drive = (c.kbV || 0) * clamp(b.knock / 0.32, 0.3, 1); return 0; } // 疾风球太重：被击退
      if (b.slip > 0) { p.drive = (c.slipV || 0) * clamp(b.slip / 0.5, 0.2, 1); return 0; } // 香蕉皮：滑出去
      return mv;
    },
    skLanded(p) {
      p.cnt.airJ = 0; p.cnt.fling = null;
      if (p.cnt.diving) { p.y = 0; }
    },
    skPlayer(p, dt) {
      const b = p.buff, c = p.cnt;
      if (c.skillBuffer) {
        const q = c.skillBuffer;
        if (this.time > q.until) c.skillBuffer = null;
        else if (p.skillCd <= 0) { c.skillBuffer = null; if (YY.skillRecastReady(this, p, p.kit?.act[q.slot])) this.useSkill(p, q.slot, { aim:q.aim }); }
      }
      p.hist.push({ t: this.time, x: p.x }); while (p.hist.length && p.hist[0].t < this.time - 1.1) p.hist.shift();
      p.still = p.onGround && Math.abs(p.vx) < 0.15 ? p.still + dt : 0;
      // 标志桶：在地上跑不过去，起跳才能越过
      for (const e of this.ents) {
        if (e.k !== 'cone' || e.o === p.idx || p.y > 0.35 || (YY.spatialNear && !YY.spatialNear(this,p,e,.42))) continue;
        const pv = c.px != null ? c.px : p.x;
        if (Math.abs(pv - p.x) > 0.6) continue; // 闪现、换位之类的瞬移不算跑过去
        if ((pv - e.x) * (p.x - e.x) < 0 || Math.abs(p.x - e.x) < 0.22) {
          const sg = Math.sign(pv - e.x) || Math.sign(p.x - e.x) || p.dir;
          p.x = e.x + sg * 0.23; p.vx = 0; p.drive = null;
          if (!e.bump || this.time - e.bump > 0.8) { e.bump = this.time; this.proc(p, 'biaozhi', '被标志桶挡住'); }
        }
      }
      c.px = p.x;
      if (!this.skillsOn || !p.kit) return;
      if (this.ents.some(e=>e.k==='wind'&&e.o===p.idx&&Math.abs(e.x-p.x)<.95&&Math.abs(e.y-(p.y+.8))<1.8)) b.tailwind=.35;
      const live = this.phase === 'rally' || this.phase === 'serve';
      // 鱼跃结束：碰到球很快起身，扑空就趴一会儿
      if (c.diving && !(b.dive > 0)) { c.diving = 0; b.prone = c.diveHit ? 0.4 : 0.95; p.vx *= 0.3; if (!c.diveHit) this.emit({ type: 'whiff', p: p.idx, label: '扑空' }); }
      if (b.dive > 0 && !c.diveHit) this.diveCatch(p);
      // 机械回收：收招时反向移动，球拍瞬间收回、返还能量（每次技能一次）
      if (c.recall) {
        const r = c.recall; r.t -= dt;
        const e = this.ents.find(q=>q.id===r.e && q.o===p.idx);
        const recovering = e ? e.ph===2 : r.kind==='spin' && b.shoushi>0;
        if (r.t>0 && recovering && !r.done && clamp(this.inputs[p.idx].move, -1, 1) * r.ref < -0.3) {
          r.done = 1; this.gainEnergy(p, 6); this.proc(p, 'jixie', '回收 +6');
          if(e){this.dropEnt(e);b[e.k==='pole'?'shensuo':'youyou']=0;}
          b.shoushi = 0;
        }
        if (r.t <= 0 || !recovering) c.recall = null;
      }
      // 荡藤：单摆，顺着摆动方向按方向键越荡越高
      if (c.vine) {
        if (!(b.vine > 0)) this.releaseVine(p);
        else {
          const v = c.vine, mv = v.steer;
          v.age += dt;
          let a = -(C.G / v.L) * Math.sin(v.th);
          if (Math.abs(mv) > 0.3 && Math.sign(mv) === Math.sign(v.w)) a += 1.8 * Math.sign(v.w);
          v.w += a * dt; v.th = clamp(v.th + v.w * dt, -1.3, 1.3);
          let hx = v.ax + v.L * Math.sin(v.th);
          const lo = C.X_NEAR + 0.1, hi = Math.min(C.X_FAR, this.halfOf(p.idx) + 0.4);
          if (p.side * hx < lo || p.side * hx > hi) { hx = p.side * clamp(p.side * hx, lo, hi); v.th = Math.asin(clamp((hx - v.ax) / v.L, -1, 1)); v.w *= -0.3; }
          p.x = hx; p.y = YY.lerp(v.startY, Math.max(0.3, v.ay - v.L * Math.cos(v.th) - 1.9), clamp(v.age / .16, 0, 1));
          p.vx = v.L * v.w * Math.cos(v.th); p.vy = v.L * v.w * Math.sin(v.th); p.onGround = false;
        }
      }
      // 筋斗云：飞向目的地后悬停，时间到或打完这一拍就散
      if (c.cloud) {
        const cl = c.cloud; cl.t -= dt;
        const dx = cl.tx - p.x, dy = cl.ty - p.y, d = Math.hypot(dx, dy), step = Math.min(d, 11 * dt);
        const nx = d > 1e-6 ? p.x + dx / d * step : p.x, ny = d > 1e-6 ? p.y + dy / d * step : p.y;
        p.vx = (nx - p.x) / dt; p.vy = 0; p.x = nx; p.y = Math.max(0.05, ny); p.onGround = false;
        if (cl.t <= 0 || this.phase !== 'rally') { c.cloud = null; p.vy = -0.5; }
      }
      if (b.gravOn > 0) { // 重力换班开着：回合中每秒耗 6 能量，耗尽自动关闭
        b.gravOn = 99;
        if (this.phase === 'rally') p.energy = Math.max(0, p.energy - GRAV_DRAIN * dt);
        if (p.energy <= 0 || this.time >= (c.gravUntil ?? Infinity)) this.endGravity(p);
      }
      if (b.tripped > 0 && p.onGround && b.tripped < 0.2) b.tripped = 0;
      // 对手的香蕉皮、红包：只在地上才会中招
      if (this.phase === 'rally' && p.onGround) for (const e of this.ents) {
        if (e.o === p.idx || Math.abs(e.x - p.x) > 0.3) continue;
        if (e.k === 'peel' && (!YY.spatialNear || YY.spatialNear(this,p,e,.45)) && !(e.fly > 0) && Math.abs(p.vx) > 1.4 && !(b.slip > 0)) {
          b.slip = 0.5; c.slipV = p.vx * 1.35; this.dropEnt(e); p.swing = null;
          this.proc(p, 'haomao', '踩到香蕉皮！'); this.emit({ type: 'slip', p: p.idx }); break;
        }
        if (e.k === 'packet' && (!YY.spatialNear || YY.spatialNear(this,p,e,.5)) && p.onGround && e.age >= e.fall && !(b.packetSafe > 0)) {
          this.dropEnt(e); b.grab = .4; b.packetSafe=1; p.vx *= .2; p.swing = p.swing && p.swing.hit ? p.swing : null;
          if (p.market) this.marketGain(p, 20, '捡到红包');
          this.proc(p, 'jiepan', '弯腰捡红包'); this.emit({ type: 'grab', p: p.idx, x: e.x }); break;
        }
      }
      // 被动
      for (const e of this.ents) {
        if (e.o !== p.idx || Math.abs(e.x - p.x) > 0.45 || !p.onGround) continue;
        if (e.k === 'drop') { this.dropEnt(e); p.stamina = Math.min(C.STAM_MAX, p.stamina + 12); this.proc(p, 'dishui', '+12 体力'); break; }
        if (e.k === 'foot' && e.n >= 1) { this.dropEnt(e); this.gainEnergy(p, 15); this.proc(p, 'yihan', '补上了 +15 能量'); break; }
        if (e.k === 'coin' && !e.got) { e.got = 1; this.proc(p, 'jihui', '捡到机会'); }
      }
      // 影子慢半拍：急停 / 转向时留下残影
      c.shCd = (c.shCd || 0) - dt;
      if(Math.abs(p.vx)>3 && (!c.shadowV || Math.sign(c.shadowV)===Math.sign(p.vx))) c.shadowV=p.vx;
      if (this.hasPassive(p, 'canying') && this.phase==='rally' && c.shCd <= 0 && Math.abs(c.shadowV || 0) > 3 && (Math.sign(p.vx) !== Math.sign(c.shadowV) || Math.abs(p.vx) < 0.8)) {
        this.addEnt('shadow', p.idx, p.x, p.y, 0.55, { v: c.shadowV }); c.shCd = 0.5; c.shadowV=0;
      }
      c.pvx = p.vx;
    },
    /** 鱼跃：球拍贴地划过，碰到低球就挑起来 */
    diveCatch(p) {
      const s = this.shuttle, rx = p.x + p.cnt.diveW * 0.95;
      if (!this.incomingTo(p) || s.ctl || s.y > 1.1 || Math.abs(s.x - rx) > 0.65 || p.side * s.x < 0.1) return;
      p.cnt.diveHit = 1;
      this.deviceReturn(p, 'clear', 0.7, 'yuyue', null, true);
      this.shuttle.plunge = p.idx; // 过网急坠
    },
    /** 此刻按下击球键是否被技能状态挡住；牵引中的球直接挥拍等于松手出球 */
    skSwingBlocked(p, btn, M) {
      const c = this.shuttle.ctl;
      if (c && c.k === 'tether' && c.o === p.idx) { this.releaseTether(); return false; }
      if (c && c.k === 'cradle' && c.o === p.idx) { this.releaseCradle(p, btn); return true; } // 持球中：这一下就是出手
      return !!M.noSwing;
    },
    /** 错误日志：记下挥空的原因 */
    skWhiff(p, approaching, dy) {
      if (!this.hasPassive(p, 'rizhi')) return;
      const s = this.shuttle, label = dy > C.ARM + 0.25 ? '高度不够' : approaching ? '早了' : '球已过身';
      p.cnt.log = { cat: YY.SHOT_CAT[s.shot] || s.shot, label };
      this.proc(p, 'rizhi', '记录：' + label);
    },

    // ---------- 每帧：装置与标记 ----------
    skStep(dt) {
      const s = this.shuttle, sk = this.sk, rally = this.phase === 'rally';
      if (sk.netUp > 0 && rally) sk.netUp -= dt; // 防火墙：回合间暂停
      for (const p of this.players) if (p.market && p.market.flash > 0) p.market.flash = Math.max(0, p.market.flash - dt);
      // 鱼跃救起的球：一过网就急坠
      if (s.plunge != null && s.live && !s.ctl) {
        if (s.lastHitter !== s.plunge || s.netHit) s.plunge = null;
        else if (s.crossedNet) {
          s.vx *= 0.32; s.vy = Math.min(s.vy, 0) - 3.2; s.plunge = null; s.ver++;
          this.rePred(); this.addEnt('gust', s.lastHitter, s.x, s.y, 0.5, { push: 0 });
          this.proc(s.lastHitter, 'yuyue', '急坠！');
        }
      }
      if (s.live && !s.ctl && !s.held) { (s.path = s.path || []).push([s.x, s.y, s.vx, s.vy]); if (s.path.length > 480) s.path.shift(); }
      for (const p of this.players) {
        // 水中月：球一过网就起水纹，0.6 秒后（或再按一次）变轨
        if (p.cnt.wob && s.live && s.lastHitter === p.idx && s.crossedNet && !s.netHit && !s.ctl && !this.entOf('ripple', p.idx)) this.addEnt('ripple', p.idx, s.x, s.y, 0.6);
        if (p.cnt.wob && (!s.live || s.lastHitter !== p.idx || s.netHit)) { p.cnt.wob = 0; const r = this.entOf('ripple', p.idx); if (r) this.dropEnt(r); }
      }
      // 王瑞的球：地板球弹过网、肉包裂开、回旋失效
      if (!s.live) { s.bun = null; s.wok = null; s.floorBy = null; }
      if (s.rush > 0) s.rush -= dt;
      if (s.floorBy != null && s.crossedNet && !s.netHit) { this.zheteng(this.players[s.floorBy], '地板球过网'); s.floorBy = null; }
      if (s.bun && s.live && rally) { // 肉包 5 秒内不释放就凉了：吸收的动能散掉
        s.bun.t -= dt;
        if (s.bun.t <= 0) { const o = s.bun.o; s.bun = null; s.ver++; this.addEnt('crumbs', o, s.x, s.y, 0.7); this.proc(o, 'baozi', '肉包凉了'); }
      }
      // 地板开球：球一过网，两面墙就消失
      if (s.slam && (s.crossedNet || !s.live || s.lastHitter !== s.slam.o)) {
        for (const w of this.entsOf('wall', s.slam.o)) w.t = Math.min(w.t, 0.25);
        s.slam = null;
      }
      // 蝴蝶结：她的网前球一过网，网带上多一个结
      if (s.bowBy != null && s.live && s.crossedNet && !s.netHit) {
        const bows = this.entsOf('bow');
        if (bows.length >= 2) this.dropEnt(bows[0]);
        this.addEnt('bow', s.bowBy, 0, C.NET_H, 99, { z: this.courtMode==='3d'?(s.z||0):(this.entsOf('bow').length? .65:-.65) }); s.bowBy = null;
      }
      for (let i = this.ents.length - 1; i >= 0; i--) {
        const e = this.ents[i]; if (!e) continue;
        if (!newPersistent(e) || rally) e.age += dt;
        if (!persistent(e) || rally) e.t -= dt; // 持续性装置：回合之间暂停倒计时
        const p = this.players[e.o];
        switch (e.k) {
          case 'ribbon': this.ribbonStep(e, p, dt); break;
          case 'bunFly': this.bunFlyStep(e, p, dt); break;
          case 'guide': e.x = p.x; e.y = p.y + C.SHOULDER; break; // 辅助线跟着她的拍子
          case 'replace': { const o = this.players[1 - e.o]; e.x = o.x; e.y = o.y + 2.6; break; } // Ctrl+H 标签挂在对手头顶
          case 'shadow': e.x += e.v * dt * 0.7; break;
          case 'appoint': this.appointStep(e, p, dt); break;
          case 'peel': if (e.fly > 0) { e.fly -= dt; e.y = Math.max(0, Math.sin(clamp(e.fly / 0.55, 0, 1) * Math.PI) * 1.6); } else e.y = 0; break;
          case 'clone': { // 复制体：原地不动，同步本体的跳跃与挥拍
            e.y = p.y; if (e.warm > 0) e.warm -= dt;
            if (p.swing && e.ref !== p.swing) this.cloneSwing(p, true); // 技能动作：只同步姿势
            if (!p.swing) e.ref = null;
            if (e.sw) { if (e.ref && e.ref === p.swing) e.sw.t = p.swing.t; else e.sw.t += dt; if (e.sw.t >= e.sw.dur) e.sw = null; }
            if (e.t <= 0) this.addEnt('cloneFx', e.o, e.x, e.y, 0.5, { out: 1 });
            break;
          }
          case 'dirty': this.dirtyStep(e, dt); break;
          case 'quake': { // 地板开球的震波：沿地面跑过对面，踩在地上的人被定住
            e.x += e.v * dt;
            const o = this.players[1 - e.o];
            if (!e.hit && o.onGround && Math.abs(o.x - e.x) < 0.5 && (!YY.spatialNear || YY.spatialNear(this,o,e,1.1))) { e.hit = 1; o.buff.stun = 0.5; this.proc(o, 'diban', '震麻了！'); }
            if (Math.abs(e.x) > C.HALF + 0.5) e.t = 0;
            break;
          }
          case 'pole': { // 伸缩长拍：伸长 → 拍头击球 → 缩回
            if (e.ph === 0) { e.L = Math.min(e.boost ? 4.2 : 3.8, e.L + 9.5 * dt); this.poleHead(p, e); this.poleTry(p, e); if (e.ph === 0 && e.age > 1.1) this.poleSwing(p, e); }
            else if (e.ph === 1) { e.a -= dt * 2 * (e.ref || 1); this.poleHead(p, e); this.poleTry(p, e); e.sw -= dt; if (e.sw <= 0) { e.ph = 2; this.startRecall(p, e.ref || 1, e); } }
            else { e.L -= (e.fast ? 30 : 6) * dt; this.poleHead(p, e); if (e.L <= 0.3) { e.t = 0; p.buff.shensuo = 0; break; } }
            e.t = Math.max(e.t, 0.1); p.buff.shensuo = Math.max(p.buff.shensuo, 0.1);
            break;
          }
          case 'spin': { // 双头旋拍：两只拍头绕身转一圈，碰到球的那一头决定挑还是压
            e.x = p.x; e.y = p.y + 1.25;
            if (!e.used && this.devHit(p)) for (let k = 0; k < 2; k++) {
              const ph = e.ph0 + e.w * e.age + k * Math.PI, hx = p.x + p.dir * e.r * Math.cos(ph), hy = e.y + e.r * Math.sin(ph);
              if (dist(s.x, s.y, hx, hy) > 0.75 || (YY.spatialNear && !YY.spatialNear(this,p,s,.85))) continue;
              const rising = e.w * Math.cos(ph) > 0;
              e.used = 1; e.hit = { k, rising };
              this.deviceReturn(p, rising ? 'clear' : s.y > 1.4 ? 'smash' : 'drop', 0.9, 'xuanpai', null, true);
              if (this.hasPassive(p, 'jixie')) p.buff.overclock = 3;
              this.proc(p, 'xuanpai', rising ? '挑！' : '压！');
              break;
            }
            if (e.t <= 0) { p.buff.xuanpai = 0; p.buff.shoushi = 0.4; this.startRecall(p, e.ref, null); }
            break;
          }
          case 'yoyo': { // 远端拦截 → 带球回收 → 垫到拍前；不自动打向对手
            if(e.ph===3) {e.px=e.x;e.py=e.y;break;} // 控球步骤统一推进，避免同一帧重复移动
            if(e.ph===0){e.d+=15*dt;if(e.d>=(e.max||4.2)){e.d=e.max||4.2;e.ph=1;}this.yoyoHead(p,e);}
            else if(e.ph===1){e.px=e.x;e.py=e.y;e.hang+=dt;if(e.hang>(e.boost?1.5:1.1))this.yoyoBack(p,e);}
            else{e.px=e.x;e.py=e.y;const dx=p.x+p.dir*.35-e.x,dy=p.y+1.5-e.y,dz=this.courtMode==='3d'?(p.z||0)-(e.z||0):0,d=Math.hypot(dx,dy,dz),u=Math.min(1,16*dt/(d||1));e.x+=dx*u;e.y+=dy*u;if(this.courtMode==='3d')e.z=(e.z||0)+dz*u;if(d<.3){e.t=0;p.buff.youyou=0;break;}}
            if(!e.used&&this.devHit(p)&&s.crossedNet&&this.deviceContact(e,e.boost?.86:.72)){this.yoyoCatch(p,e);break;}
            e.t=Math.max(e.t,.1);p.buff.youyou=Math.max(p.buff.youyou,.1);break;
          }
          case 'fake': {
            const f = { x: e.x, y: e.y, vx: e.vx, vy: e.vy, netHit: true };
            const r = YY.stepShuttle(f, dt, this.env);
            e.x = f.x; e.y = f.y; e.vx = f.vx; e.vy = f.vy;
            if (r === 'floor' || (e.vy < 0 && e.y < 1.0)) { e.t = 0; this.addEnt('splash', e.o, e.x, Math.max(0.2, e.y), 0.6); } // 碎成水花
            break;
          }
          case 'ripple': if (s.live) { e.x = s.x; e.y = s.y; } if (e.t <= 0 && s.live && s.lastHitter === e.o) this.wobble(e.o, p.cnt.wobAim); break;
          case 'mini': this.miniStep(e, p, dt, rally); break;
        }
        if (e.t <= 0) this.dropEnt(e);
      }
    },
    /** 红丝带：伸出 → 碰到球就缠住拉回 → 没碰到就收回 */
    ribbonStep(e, p, dt) {
      const s = this.shuttle;
      if (e.ph === 0) {
        e.L = Math.min(RIBBON_L, e.L + 16 * dt); this.ribbonHead(p, e);
        if (s.live && !s.ctl && !s.held && !s.netHit && s.lastHitter !== p.idx && s.crossedNet && p.side * s.x > 0.05 && this.phase === 'rally') {
          const hit = this.ribbonContact?this.ribbonContact(e):segDist(e.ox,e.oy,e.x,e.y,s.x,s.y)<.42;
          if (hit) {
            e.ph = 1; e.got = 1; e.t = Math.max(e.t, 2.2);
            p.skillCd=Math.min(p.skillCd,.06);s.ctl = { k: 'tether', o: p.idx, t: 1.0 }; s.vx = 0; s.vy = 0; s.ver++;
            this.hitstop = Math.max(this.hitstop, 0.04);
            this.proc(p, 'hongxian', '牵住了 · 再按压短／向后挑长');
            return;
          }
        }
        if (e.L >= RIBBON_L) e.ph = 2;
      } else if (e.ph === 1) { // 牵着球：丝带头跟着球
        e.ox = p.x + p.dir * 0.3; e.oy = p.y + 1.45; e.x = s.x; e.y = s.y;
        const d = Math.hypot(e.x - e.ox, e.y - e.oy) || 1; e.dx = (e.x - e.ox) * p.dir / d; e.dy = (e.y - e.oy) / d; e.L = d;
        if (!(s.ctl && s.ctl.k === 'tether' && s.ctl.o === p.idx)) e.ph = 2;
        e.t = Math.max(e.t, 0.4);
      } else { // 收回
        e.L = Math.max(0, Math.min(e.L, Math.hypot(e.x - (p.x + p.dir * 0.3), e.y - p.y - 1.45)) - 18 * dt); this.ribbonHead(p, e);
        if (e.L <= 0.05) e.t = 0;
      }
    },
    /** 飞行中的肉包：碰到羽毛球就裹住它；落地就摔扁 */
    bunFlyStep(e, p, dt) {
      const s = this.shuttle, px = e.x, py = e.y;
      e.vy -= BUN_G * dt; e.x += e.vx * dt; e.y += e.vy * dt;
      if (s.live && !s.held && !s.ctl && !s.bun && segDist(px, py, e.x, e.y, s.x, s.y) < 0.5 && (!YY.spatialNear || YY.spatialNear(this,e,s,.6))) {
        const sp = Math.hypot(s.vx, s.vy), k = 0.45;
        s.vx *= k; s.vy = s.vy * k + 0.6; s.bun = { o: e.o, st: Math.min(30, sp * (1 - k) * 0.6), t: 5 }; s.ver++;
        e.t = 0; this.addEnt('crumbs', e.o, s.x, s.y, 0.5);
        this.rePred();
        this.proc(p, 'baozi', '包住了！5 秒内再按释放');
        return;
      }
      if (e.y <= 0.1) { e.t = 0; this.addEnt('crumbs', e.o, e.x, 0.15, 0.6); }
    },
    /** 预约击球：对手出手后，球会落进预约的半场就滑到接球点，球到拍前自动回击 */
    appointStep(e, p, dt) {
      const s = this.shuttle;
      if (!e.armed) { e.x += clamp(e.home - e.x, -4 * dt, 4 * dt); return; }
      const speed=p.cnt.habit!=null && !!p.cnt.habit===!!e.zone ? 8 : 6.5;
      e.x += clamp(e.tx - e.x, -speed * dt, speed * dt);
      if (!s.live || s.ctl || s.lastHitter === e.o || s.netHit) { e.armed = 0; return; }
      const hx = e.x + p.dir * 0.6, hy = C.SHOULDER + 0.25;
      if (p.side * s.x > 0.1 && dist(s.x, s.y, hx, hy) < 0.8 && (!YY.spatialNear || YY.spatialNear(this,e,s,.8))) {
        e.armed = 0; e.t = Math.min(e.t, 0.35); e.go = 1;
        this.addEnt('appointGo', e.o, e.x, 0, 0.35);
        this.deviceReturn(p, s.y > 2.3 ? 'smash' : e.btn, 0.85, 'yueqiu', null, true);
      }
    },
    /** 毫毛小猴：前后巡逻；隔一会儿往对面丢一块香蕉皮 */
    miniStep(e, p, dt, rally) {
      if (!rally) return;
      const H = this.halfOf(p.idx);
      if (e.warm > 0) { e.warm -= dt; return; }
      e.ph = (e.ph || 0) + dt * Math.PI * 2 / 3.4;
      if (!(e.hop > 0)) e.x = p.side * (0.8 + Math.min(2.4, H - 1.2) * (0.5 - 0.5 * Math.cos(e.ph)));
      if (e.hop > 0) e.hop -= dt;
      e.throwT -= dt;
      if (e.throwT <= 0 && e.n > 0 && e.peels > 0) {
        e.peels--;
        e.throwT = 2.6 + Math.random() * 1.8;
        const o = this.players[1 - p.idx], Ho = this.halfOf(o.idx);
        if (this.entsOf('peel', p.idx).length < 2) {
          const tx = o.side * clamp(o.side * o.x + (Math.random() - 0.5) * 2.4, 0.9, Ho - 0.4);
          this.addEnt('peel', p.idx, tx, 1.6, 4, { fly: 0.7, x0: e.x });
          this.proc(p, 'haomao', '香蕉皮！');
        }
      }
    },
    /** 水中月：横向变轨，落点留下虚影 */
    wobble(o, aim) {
      const s = this.shuttle, opp = this.players[1 - o];
      // 对手已经进入接触区时不再突然改线，自动到时同样遵守这个边界。
      if (this.racketGap(opp, s.x, s.y) < 1.6 || (this.pred && this.realT(this.pred.t - (this.time - this.pred.t0)) < .25)) {
        this.players[o].cnt.wob = 0; this.proc(o, 'shuizhong', '来球已近 · 保持原线'); return false;
      }
      const cur = this.landOf(1), H = this.halfOf(opp.idx);
      if (aim == null) aim = this.players[o].cnt.wobAim || 0;
      const short = aim > 0.3 ? true : aim < -0.3 ? false : cur > 3.6;
      const want = short ? Math.max(1.3, cur - 2.3) : Math.min(H - 0.4, cur + 2.4);
      this.players[o].cnt.wob = 0;
      this.addEnt('ghost', o, opp.side * cur, 0, 1.6);
      s.vx *= this.solveVx(want); s.ver++;
      opp.fooled = true;
      if (this.pred) this.pred = Object.assign(YY.simulate(s.x, s.y, s.vx, s.vy, 6, true, false, this.physEnv()), { t0: this.time, hidden: this.pred.hidden });
      this.proc(o, 'shuizhong', '变轨！');
    },

    /** 球与装置的碰撞（反射板、挡板、风口、月亮、星门、卧推、挂网、弹线）。返回 true 表示这一帧球被装置接管 */
    skShuttle(previous, r) {
      const s = this.shuttle;
      if (!previous || !this.ents.length && !this.players.some(p => p.buff.tangqiu > 0 || p.buff.jiewang > 0)) return false;
      const px = previous.x, py = previous.y;
      for (const p of this.players) {
        const b = p.buff;
        // 糖球挂网：经过网带附近的球被粘住
        if (b.tangqiu > 0 && !s.netHit && Math.abs(s.x) < 0.35 && s.y > C.NET_H - 0.05 && s.y < C.NET_H + 0.6) {
          b.tangqiu = 0;
          const hitSide = this.players[s.lastHitter] ? this.players[s.lastHitter].side : -p.side;
          const side = p.cnt.sugarBack ? p.side : -hitSide;
          s.ctl = { k: 'stick', o: p.idx, t: 1.0, side }; s.x = 0; s.y = C.NET_H + 0.1; s.vx = 0; s.vy = 0; s.ver++;
          this.proc(p, 'tangqiu', '粘住了！');
          return true;
        }
        // 把网借我一下：贴网过来的球被网绳弹一下——她的往下压，对手的往上弹
        if (b.jiewang > 0 && this.netBorrower() === p && !s.netHit && !s.ctl && (px < 0) !== (s.x < 0) && s.y < C.NET_H + 0.55) {
          const mine = s.lastHitter === p.idx, d = Math.sign(s.x) || 1;
          if (mine) { s.vx = d * Math.max(5.5, Math.abs(s.vx)); s.vy = Math.min(s.vy, 0) - 3.4; this.proc(p, 'jiewang', '弹网下压！'); }
          else { s.vx = d * 1.5; s.vy = 6.4; this.proc(p, 'jiewang', '网把球弹高了'); }
          s.ver++; this.rePred(); this.addEnt('netTwang', p.idx, 0, C.NET_H, 0.5);
          if ((p.cnt.slings = (p.cnt.slings || 1) - 1) <= 0) b.jiewang = 0;
          return false;
        }
      }
      for (const e of this.ents) {
        const p = this.players[e.o];
        if (YY.spatialNear && !YY.spatialNear(this,e,s,e.k === 'wind' ? 1.0 : .72)) continue;
        switch (e.k) {
          case 'board': { // 球穿过反射板就被弹射：有下一块板就射向它，最后一块把储的能量全打出去
            if (s.netHit || e.n<=0 || e.age<(e.warm??.45) || e.cool > this.time || segDist(px, py, s.x, s.y, e.x, e.y) > 0.45) break;
            if(s.lastHitter===e.o && s.selfToss!==e.o && !(s.prism?.o===e.o))break; // 不拦截己方发球和普通出球
            if (s.lastHitter !== e.o && !s.crossedNet) break;
            if (s.lastHitter === e.o && s.prism && s.prism.o === e.o && s.prism.used.includes(e.id)) break; // 同一条线路不重复弹
            return this.boardBounce(e, p);
          }
          case 'wind': {
            if (!e.used && segDist(px,py,s.x,s.y,e.x,e.y)<.9) {
              s.vx += e.push; s.vy += e.lift||0; s.ver++; e.used=1;
              this.addEnt('gust', e.o, e.x, s.y, 0.5, { push: e.push });
              this.proc(e.o, 'fengkou', '起风了');
              if (this.pred) this.pred = Object.assign(YY.simulate(s.x, s.y, s.vx, s.vy, 6, true, false, this.physEnv()), { t0: this.time, hidden: this.pred.hidden });
              return false;
            }
            break;
          }
          case 'moon': {
            if (e.used || s.ctl || s.netHit || p.side * s.x <= .05 || dist(s.x, s.y, e.x, e.y) > (e.charged || p.buff.gravOn > 0 ? 1.15 : .85)) break;
            const a = Math.atan2(s.y - e.y, s.x - e.x), cr = (s.x - e.x) * s.vy - (s.y - e.y) * s.vx;
            e.used = 1; e.t = 3;
            s.ctl = { k: 'orbit', o: e.o, cx: e.x, cy: e.y, r: Math.max(0.45, dist(s.x, s.y, e.x, e.y)), a, w: (cr >= 0 ? 1 : -1) * 5.5, t: 3.4, spun: 0 };
            s.vx = 0; s.vy = 0; s.ver++;
            this.proc(e.o, 'yueliang', '月亮抓住了球');
            return true;
          }
          case 'gate': { // 星门：她的球射进入口，从对手身后的出口朝他够不着的地方飞出
            if (e.pair || e.used || e.age < 0.04 || s.lastHitter !== e.o || s.ctl || dist(s.x, s.y, e.x, e.y) > 0.6) break;
            const other = this.ents.find(g => g.k === 'gate' && g.o === e.o && g.pair === 1);
            if (!other) break;
            const o = this.players[1 - e.o], wd = o.side * Math.sign(other.L - Math.abs(other.x)) || o.dir;
            const v = YY.solveSpeed(other.x, other.y, wd, other.a, Math.abs(other.L - Math.abs(other.x)), this.physEnv()), r = other.a * Math.PI / 180;
            // 穿越要 0.35 秒：球先停在发光的出口里，给对手反应时间
            s.x = other.x; s.y = other.y; s.vx = 0; s.vy = 0; s.ver++;
            s.ctl = { k: 'warp', o: e.o, t: 0.35, x: other.x, y: other.y, vx: Math.cos(r) * v * wd, vy: Math.sin(r) * v };
            s.crossedNet = true; s.netHit = false;
            e.t = Math.min(e.t, 0.4); other.t = Math.max(other.t, 0.9); e.used = other.used = 1; other.warp = 1;
            this.addEnt('gateFlash', e.o, e.x, e.y, 0.5);
            this.proc(e.o, 'xingmen', '星门穿越！'); o.replan = true;
            this.pred = Object.assign(YY.simulate(s.x, s.y, s.ctl.vx, s.ctl.vy, 6, true, false, this.physEnv()), { t0: this.time + 0.35, hidden: false });
            return true;
          }
          case 'pane': { // 冻结窗格：第一只穿进冰窗的球被冻住
            if (e.used || e.age < (e.warm ?? .25) || s.ctl || s.held || !s.live || s.netHit) break;
            const h = e.half || 0.62, inside = (x, y) => Math.abs(x - e.x) < h && Math.abs(y - e.y) < h;
            if (!inside(s.x, s.y) && !(segDist(px, py, s.x, s.y, e.x, e.y) < h * 0.8)) break;
            if (!inside(s.x, s.y)) { s.x = clamp(s.x, e.x - h, e.x + h); s.y = clamp(s.y, e.y - h, e.y + h); }
            e.used = 1; e.t = Math.max(e.t, 1.6);
            s.ctl = { k: 'freeze', o: e.o, t: 1.2, vx: s.vx, vy: s.vy, e: e.id }; s.vx = 0; s.vy = 0; s.ver++;
            this.pred = Object.assign(YY.simulate(s.x, s.y, s.ctl.vx, s.ctl.vy, 6, true, false, this.physEnv()), { t0: this.time + 1.2, hidden: this.hintHidden() });
            this.proc(e.o, 'shuangji', s.lastHitter === e.o ? '冻住了 · 打乱节奏' : '冻住了 · 争取时间');
            this.emit({ type: 'freeze', p: e.o, x: s.x, y: s.y });
            return true;
          }
          case 'wall': { // 地板开球的临时墙：她自己的地板球撞上去就反弹加速，用一次就消失
            const c = s.slam; if (!c || c.o !== e.o || e.used || s.lastHitter !== e.o || s.crossedNet) break;
            let hit = false;
            if (e.v && (px - e.x) * (s.x - e.x) <= 0 && px !== s.x && s.y < e.y1) { s.x = e.x - Math.sign(s.x - px) * 0.03; s.vx = -s.vx; hit = true; }
            else if (!e.v && (py - e.y) * (s.y - e.y) <= 0 && py !== s.y && (s.x - e.x0) * (s.x - e.x1) <= 0) { s.y = e.y - Math.sign(s.y - py) * 0.03; s.vy = -s.vy; hit = true; }
            if (!hit) break;
            e.used = 1; e.t = Math.min(e.t, 0.3); e.hitT = this.time;
            this.slamBoost(p, s.x, s.y, e.v ? '后墙' : '顶墙');
            return false;
          }
          case 'mini': { // 毫毛小猴：球从它身边飞过就跳起来拦，回出去的“猴毛球”藏起落点
            if (!(e.n > 0) || e.warm > 0 || e.hop > 0 || s.lastHitter === e.o || s.ctl || s.netHit || !s.crossedNet || p.side * s.x < 0.1) break;
            if (!((px - e.x) * (s.x - e.x) <= 0 || Math.abs(s.x - e.x) < 0.24) || s.y < 0.35 || s.y > 1.95 || this.racketGap(p, s.x, s.y) < .85) break;
            e.n--; e.hop = 0.6;
            const kill = s.y > 1.1 && p.side * e.x < 1.9;
            this.deviceReturn(p, 'clear', .65, 'haomao', { x:e.x, y:s.y });
            s.monkey = 1;
            this.proc(p, 'haomao', '协防一次 · 退场');
            if (e.n <= 0) e.t = Math.min(e.t, 0.8);
            return true;
          }
        }
      }
      return false;
    },
    /** 球刚撞网：借网弹弓、蝴蝶结。返回 true 表示球被救起，不算撞网 */
    skNet(previous) {
      const s = this.shuttle, d = Math.sign(previous ? previous.vx : 0) || 1;
      const sling = this.netBorrower();
      if (sling) { // 撞网也算借网：她的球被弹过去往下压，对手的球被弹高送到她那边
        const mine = s.lastHitter === sling.idx;
        s.netHit = false; s.crossedNet = false; s.x = -d * 0.08; s.y = C.NET_H + 0.12; s.ver++;
        if (mine) { s.vx = d * 4.6; s.vy = 2.6; } else { s.vx = d * 1.8; s.vy = 6.8; }
        if ((sling.cnt.slings = (sling.cnt.slings || 1) - 1) <= 0) sling.buff.jiewang = 0;
        this.addEnt('netTwang', sling.idx, 0, C.NET_H, 0.5);
        this.proc(sling, 'jiewang', mine ? '借网过去！' : '弹起来了！');
        return true;
      }
      const bows = this.entsOf('bow');
      if (bows.length) {
        this.dropEnt(bows[0]);
        s.netHit = false; s.crossedNet = false; s.x = -d * 0.07; s.y = C.NET_H + 0.1; s.vx = d * 0.45; s.vy = 3.4; s.ver++;
        this.proc(bows[0].o, 'hudie', '蝴蝶结托了一下');
        return true;
      }
      return false;
    },
    /** 被技能控制的球：挂网、绕月、牵引、哨停、卧推 */
    skControl(dt) {
      const s = this.shuttle, c = s.ctl;
      c.t -= dt;
      switch (c.k) {
        case 'yoyo': {
          const p=this.players[c.o],e=this.ents.find(e=>e.id===c.e&&e.k==='yoyo');
          if(!e){s.ctl=null;s.selfToss=p.idx;s.tossSkill='youyou';s.vy=3.8;s.ver++;this.rePred();break;}
          const tx=p.side*clamp(p.side*(p.x+p.dir*.55),.4,this.halfOf(p.idx)-.25),ty=p.y+1.95,dx=tx-e.x,dy=ty-e.y,dz=this.courtMode==='3d'?(p.z||0)-(e.z||0):0,d=Math.hypot(dx,dy,dz),u=Math.min(1,9*dt/(d||1));
          e.x+=dx*u;e.y+=dy*u;if(this.courtMode==='3d'){e.z=(e.z||0)+dz*u;s.z=e.z;}s.x=e.x;s.y=e.y;s.vx=0;s.vy=0;s.speed=0;
          e.t=Math.max(e.t,.2);p.buff.youyou=Math.max(p.buff.youyou,.2);
          if(d<.2||c.t<=0)this.yoyoRelease(p,e);break;
        }
        case 'stick': s.x = 0; s.y = C.NET_H + 0.1; s.vx = 0; s.vy = 0; if (c.t <= 0) this.slideOff(); break;
        case 'orbit': { // 越转越快：转过的角度决定甩出速度
          c.w = Math.sign(c.w) * Math.min(c.spun >= 14.4 ? 6.5 : 8.5, Math.abs(c.w) + 0.9 * dt);
          c.a += c.w * dt; c.spun = (c.spun || 0) + Math.abs(c.w) * dt;
          const nx = c.cx + Math.cos(c.a) * c.r, ny = c.cy + Math.sin(c.a) * c.r;
          s.vx = (nx - s.x) / dt; s.vy = (ny - s.y) / dt; s.x = nx; s.y = ny; s.speed = Math.hypot(s.vx, s.vy);
          if (c.t <= 0) this.dropOrbit();
          break;
        }
        case 'tether': { // 红丝带把球拉回拍前，悬在那里等她出手
          const p = this.players[c.o], tx = p.x + p.dir * 0.7, ty = clamp(p.y + C.SHOULDER + 0.45, 1.0, 2.8);
          const gx = tx - s.x, gy = ty - s.y, L = Math.hypot(gx, gy), step = Math.min(L, 11 * dt);
          let nx = L > 1e-6 ? s.x + gx / L * step : s.x, ny = L > 1e-6 ? s.y + gy / L * step : s.y;
          if (L < 0.12) { nx = tx + Math.cos(this.time * 7) * 0.05; ny = ty + Math.sin(this.time * 9) * 0.05; }
          nx = p.side * Math.max(0.3, p.side * nx); // 丝带拉不过网
          s.vx = (nx - s.x) / dt; s.vy = (ny - s.y) / dt; s.x = nx; s.y = ny;
          if (c.t <= 0) this.ribbonFling(p, null); // 时间到：自动甩向空当
          break;
        }
        case 'cradle': { // 停一下：球停在朱老师的拍面上，跟着他走；时间到自动挑出去
          const p = this.players[c.o];
          s.x = p.x + p.dir * 0.55; s.y = p.y + C.SHOULDER + 0.3 + Math.sin(this.time * 12) * 0.03; s.vx = 0; s.vy = 0;
          if (p.side * s.x < 1.3) s.x = p.side * 1.3; // 贴网太近不好出手：球停在离网 1.3 米处
          if (c.t <= 0) this.releaseCradle(p, 'clear');
          break;
        }
        case 'warp': { // 星门穿越：球在出口里停 0.35 秒（出口发光预警），再飞出
          s.x = c.x; s.y = c.y; s.vx = 0; s.vy = 0;
          if (c.t <= 0) { s.ctl = null; s.vx = c.vx; s.vy = c.vy; s.ver++; this.rePred(); this.addEnt('gateFlash', c.o, s.x, s.y, 0.5); }
          break;
        }
        case 'freeze': { // 冻结窗格：球被冻在冰窗里
          s.vx = 0; s.vy = 0; s.speed = 0;
          if (c.t <= 0) this.unfreeze();
          break;
        }
        case 'relay': { // 接力协议：沿弧线送到接球端（本体 / 复制体 / 自己头顶）
          c.f += dt; const u = Math.min(1, c.f / c.T), [x, y] = bez(c.P, u), [x2, y2] = bez(c.P, Math.min(1, u + 0.02));
          s.vx = (x2 - x) / (0.02 * c.T); s.vy = (y2 - y) / (0.02 * c.T); s.x = x; s.y = y; s.speed = Math.hypot(s.vx, s.vy);
          if (u >= 1) this.releaseRelay();
          break;
        }
        case 'wok': { // 回锅再炒：沿弧线折返（弧顶高过球网）
          c.f += dt; const u = Math.min(1, c.f / c.T), [x, y] = bez(c.P, u), [x2, y2] = bez(c.P, Math.min(1, u + 0.02));
          s.vx = (x2 - x) / (0.02 * c.T); s.vy = (y2 - y) / (0.02 * c.T); s.x = x; s.y = y;
          if (u >= 1) this.releaseWok();
          break;
        }
        case 'rewind': { // 回潮：沿原路倒流，1.6 倍速（潮涌 2.4 倍速）
          c.f += (c.tide ? 2.4 : 1.6) * dt / C.DT;
          const i = c.path.length - 1 - Math.floor(c.f);
          if (i <= 0) { const q = c.path[0]; if (q) { s.x = q[0]; s.y = q[1]; } c.i = 0; this.releaseRewind(); break; }
          const q = c.path[i]; c.i = i;
          s.x = q[0]; s.y = q[1]; s.vx = -q[2] * 1.6; s.vy = -q[3] * 1.6; s.speed = Math.hypot(s.vx, s.vy);
          break;
        }
      }
    },
    /** 糖球挂网：倒计时结束，从箭头一侧滑落 */
    slideOff() {
      const s = this.shuttle, c = s.ctl, hitter = this.players[s.lastHitter];
      s.ctl = null; s.x = c.side * 0.12; s.y = C.NET_H + 0.05; s.vx = c.side * 0.6; s.vy = 0.3; s.ver++;
      s.crossedNet = !hitter || c.side !== hitter.side; // 滑到击球方自己那边＝没过网
      this.pred = Object.assign(YY.simulate(s.x, s.y, s.vx, s.vy, 6, true, true, this.env), { t0: this.time });
    },

    /** 落地前：技能接管落地——地板开球的第一次砸地、潮来积水上的第一次落水 */
    skLand(x) { return this.skillsOn && this.phase === 'rally' && (this.slamFloor(x) || this.poolBounce(x) || this.cloneBounce(x)); },
    /** 每次击球（含装置回球）之后：注单结算、被动标记 */
    skAfterHit(p, shot, q, ctx) {
      const s = this.shuttle, o = this.players[1 - p.idx], sk = this.sk;
      const gust = s.gust, bun = s.bun, gold = s.gold;
      if (ctx.skill !== 'fanshe') s.prism = null;
      s.bowBy = null; s.lever = ctx.lever || 0; s.hitAt = this.time; s.gust = null; s.plunge = null; s.monkey = 0;
      s.wok = null; s.floorBy = null; s.rush = 0; s.puddle = 0; s.slam = null; s.tide = null;
      if (this.gravKit(p) && this.skillsOn) { s.grav = { o: p.idx }; if (p.buff.gravOn > 0) this.rePred(); } // 被动：星星打过的球变成重力球，整个回合都是
      if (!this.skillsOn || ctx.serve) { s.bun = null; return; }
      if (ctx.skill === 'huiguo') this.zheteng(p, '回锅再打');
      { const mn = this.entOf('moon', p.idx); if (mn && mn.used && !ctx.device) this.dropEnt(mn); } // 直接打走月亮里的球
      if (bun) this.bunAbsorb(p, bun);
      // 疾风球：接下来的人被击退；踏风后的这一拍自己也带上疾风
      if (gust && gust.o !== p.idx) { p.buff.knock = 0.32; p.cnt.kbV = p.side * 5; this.proc(p, 'tafeng', '被疾风击退'); }
      if (ctx.gust) s.gust = { o: p.idx };
      // 星门对望：她的这一拍射进身前的入口，出口开在对手身后
      if (p.buff.xingmen > 0 && (!ctx.device || ctx.skill === 'yueliang') && this.phase === 'rally') {
        p.buff.xingmen = 0;
        const sp = Math.hypot(s.vx, s.vy) || 1, H = this.halfOf(o.idx), od = o.side * o.x;
        const ga = p.cnt.gateAim || 0, back = ga < -.2 ? true : ga > .2 ? false : od < 3.6;
        const ex = back ? H - .4 : .6, L = back ? clamp(od + 1.5, 2.6, H - 1.3) : clamp(od - 1.8, 1.1, 2.8);
        this.addEnt('gate', p.idx, s.x + s.vx / sp * 0.55, s.y + s.vy / sp * 0.55, 1.6, { pair: 0 });
        this.addEnt('gate', p.idx, o.side * ex, back ? 2.4 : 2.7, 1.6, { pair: 1, L, a: back ? 18 : 26 });
      }
      // 预约击球：对手的球会落进预约的半场，投影就去接
      const ap = this.entOf('appoint', o.idx);
      if (ap && this.pred && !ctx.ownSide) {
        const depth = o.side * this.pred.landX, inZone = ap.zone ? depth > 0 && depth < 3.3 : depth >= 3.3;
        const pt = inZone && (this.pred.pts || []).find(k => k.t > 0.25 && o.side * k.x > 0.3 && k.y > 1.1 && k.y < 2.3 && (k.vy < 0 || k.y < 1.8));
        if (pt) { ap.armed = 1; ap.tx = o.side * clamp(o.side * (pt.x - o.dir * 0.6), C.X_NEAR, this.halfOf(o.idx)); }
        else ap.armed = 0;
      }
      if (ctx.lever > 1) s.oppQ = Math.min(s.oppQ == null ? 1 : s.oppQ, 1 - 0.12 * (ctx.lever - 1)); // 杠杆球很重：接的人回球变差
      if (this.hasPassive(p, 'dishui') && !ctx.device) {
        const drops = this.entsOf('drop', p.idx); if (drops.length >= 3) this.dropEnt(drops[0]);
        this.addEnt('drop', p.idx, p.side * clamp(p.side * p.x + 0.6, C.X_NEAR, this.halfOf(p.idx) - 0.1), 0, 99);
      }
      if (this.hasPassive(p, 'yekong') && !ctx.device && !ctx.ownSide && !['zipao','meida','huiguo'].includes(ctx.skill)) {
        const st = this.entsOf('star', p.idx); if (st.length >= 2) this.dropEnt(st[0]);
        this.addEnt('star', p.idx, s.x, s.y, 99);
        p.cnt.starCount=(p.cnt.starCount||0)+1;
        if(p.cnt.starCount>=2){p.cnt.starCount=0;const n=Math.min(6,18-(p.cnt.starGain||0));if(n>0){p.cnt.starGain=(p.cnt.starGain||0)+n;this.gainEnergy(p,n);this.proc(p,'yekong','双星回响 +'+n);}}
      }
      if (!ctx.device && !ctx.ownSide && !['zipao','meida'].includes(ctx.skill)) this.practicePassive(p,shot,q,ctx);
      if (this.hasPassive(p, 'hudie') && { net: 1, tumble: 1, block: 1, drop: 1 }[shot.type]) s.bowBy = p.idx;
      if (p.market && !ctx.device && !ctx.ownSide && !['zipao','meida'].includes(ctx.skill)) this.marketGain(p, 15 + (q >= .85 ? 15 : 0));
      // 一掷千金：接金砖球的人被震退；这一拍是自己的金砖球就记下来，直接得分另有奖励
      if (gold && gold.o !== p.idx) { p.buff.knock = 0.28; p.cnt.kbV = p.side * 4; this.proc(p, 'qiquan', '被金砖震退'); }
      s.gold = ctx.gold ? { o: p.idx } : null;
      if (this.hasPassive(o, 'qiandao')) {
        const marks = this.entsOf('sign', o.idx); if (marks.length >= 3) this.dropEnt(marks[0]);
        this.addEnt('sign', o.idx, s.hitX, 0, 99, { cat: YY.SHOT_CAT[shot.type] || shot.type });
        this.entsOf('sign', o.idx).forEach((e, i, a) => { e.n = a.length - i; });
        const recent=this.entsOf('sign',o.idx), front=recent.filter(e=>p.side*e.x<3.35).length;
        o.cnt.habit=recent.length>=2 && front>=2 ? 1 : recent.length>=2 && recent.length-front>=2 ? 0 : null;
      }
      if (this.hasPassive(o, 'rizhi') && o.cnt.log && o.cnt.log.cat === (YY.SHOT_CAT[shot.type] || shot.type)) {
        o.cnt.fixCat=o.cnt.log.cat; this.proc(o, 'rizhi', '日志：上次' + o.cnt.log.label, { tip: true }); o.cnt.log = null;
      }
    },
    /** 提示型被动以真实的亲手回球取得有限收益，不奖励故意挥空。 */
    practicePassive(p,shot,q,ctx) {
      const c=p.cnt, cat=YY.SHOT_CAT[ctx.incomingType]||ctx.incomingType;
      if (this.hasPassive(p,'biaochi') && q>=.85 && !c.calibrate && (c.calEarn||0)<2) {
        c.calibrate=1;c.calEarn=(c.calEarn||0)+1;this.proc(p,'biaochi','校准完成 · 手动反射板 +1 次');
      }
      if (this.hasPassive(p,'rizhi') && q>=.7 && cat && !c.compile && (c.compileEarn||0)<2) {
        const corrected=c.fixCat===cat; c.debugCats=Array.from(new Set([...(c.debugCats||[]),cat]));
        if(corrected||c.debugCats.length>=2){c.compile=1;c.compileEarn=(c.compileEarn||0)+1;c.debugCats=[];c.fixCat=null;this.proc(p,'rizhi','调试完成 · 获得编译标记');}
      }
      if(this.hasPassive(p,'kandong') && ctx.incomingSkill && q>=.7 && !c.counterDone){c.counterDone=1;p.buff.teacherCalm=6;this.proc(p,'kandong','破解成功 · 下一拍稳住');}
      if(this.hasPassive(p,'yihan') && (ctx.save||ctx.lowSave) && !c.savedBonus){c.savedBonus=1;this.gainEnergy(p,5);this.proc(p,'yihan','追到了！+5');}
      if(p.market && p.market.coins>=1600 && q>=.85 && !p.buff.rocketReady){c.rocketCharge=(c.rocketCharge||0)+1;if(c.rocketCharge>=3){c.rocketCharge=0;p.buff.rocketReady=10;this.proc(p,'jihui','火箭推进就绪');}}
    },
    /** 肉包吸收击球动能：这一拍改成慢悠悠的高弧线飞到原来的落点，差出来的速度存进肉包 */
    bunAbsorb(p, bun) {
      const s = this.shuttle, sp0 = Math.hypot(s.vx, s.vy), env = this.physEnv();
      const land = YY.simulate(s.x, s.y, s.vx, s.vy, 6, false, true, env).landX, o = this.players[1 - p.idx];
      const depth = clamp(o.side * land, 1.2, this.halfOf(o.idx) - 0.5);
      const v = this.launchFrom(s.x, s.y, p.dir, 52, depth, 0.35), sp1 = Math.hypot(v[0], v[1]);
      if (sp1 < sp0) { s.vx = v[0]; s.vy = v[1]; }
      const got = Math.max(0, sp0 - Math.hypot(s.vx, s.vy)) * 0.8;
      bun.st = Math.min(30, (bun.st || 0) + got); s.bun = bun; s.ver++;
      this.rePred();
      if (got > 1) this.proc(bun.o, 'baozi', '肉包吸收 +' + Math.round(got * 3.6) + ' km/h');
    },
    /** 一分结束：遗憾脚印、注单作废 */
    skPointEnd(x, winner, loser, kind) {
      const Lp = this.players[loser], W = this.players[winner];
      const gold = this.shuttle.gold;
      for (const p of this.players) if (p.market) {
        const a = p.market, won = p.idx === winner;
        this.marketGain(p, won ? 100 : -120, won ? '赢球奖金' : '丢分罚款');
        const payout=(won&&a.bet?a.bet.stake*a.bet.odds:0)+(won&&gold?.o===p.idx?200:0);
        if(payout) this.marketGain(p,Math.min(350,payout),'押注／金砖结算（封顶350）');
        if(a.bet&&!won)this.proc(p,'ganggan','押注落空');a.bet=null;
      }
      this.shuttle.gold = null; this.shuttle.bun = null; this.shuttle.slam = null; this.shuttle.grav = null; this.shuttle.tide = null;
      this.shuttle.ctl = null;
      for (const q of this.players) if (q.cnt.vine) this.releaseVine(q);
      if (kind === 'winner' && this.hasPassive(Lp, 'yihan') && Lp.side * x > 0 && Math.abs(Lp.x - x) < 2.4) {
        const old = this.entOf('foot', Lp.idx); if (old) this.dropEnt(old);
        this.addEnt('foot', Lp.idx, x, 0, 99, { n: 0 });
        this.proc(Lp, 'yihan', '差一点……');
      }
      // 连杀播报：终结 2 连以上的猴子，对手拿赏金
      if (this.hasPassive(Lp, 'liansha')) {
        if ((Lp.cnt.streak || 0) >= 2) { this.gainEnergy(W, 10); this.proc(W, 'liansha', '终结！+10 赏金'); }
        Lp.cnt.streak = 0;
      }
      if (this.hasPassive(W, 'liansha')) {
        const n = W.cnt.streak = (W.cnt.streak || 0) + 1;
        if (n >= 2) { const bonus = [0,0,3,5,8][Math.min(4,n)]; this.gainEnergy(W, bonus); this.proc(W, 'liansha', (STREAK[n] || '超神！') + ' +' + bonus); }
      }
    },
    /** 每球一分，经济收益独立结算。 */
    skPts(x, winner, kind) {
      return 1;
    },
    /** 挥拍击球的质量修正：驾云、押中、防守包子、节拍连招 */
    skHitQ(p, q, ctx) {
      if (!this.skillsOn) return q;
      const c = p.cnt, b = p.buff, s = this.shuttle;
      if (c.cloud) { q += 0.2; ctx.cloud = 1; }
      if(this.entOf('guide',p.idx))q=Math.max(q,.82);
      if (b.jiezou > 0 && c.combo > 0) q = Math.max(q, c.combo===1 ? .92 : .8);
      if (b.teacherCalm > 0) { q=Math.max(q,.85);b.teacherCalm=0; }
      if (b.bunSteam > 0) q += .12;
      return clamp(q, 0, 1);
    },
    /** 球路定下之后：节拍调动、疾风、杠杆 */
    skShot(p, shot, ctx) {
      if (!this.skillsOn) return;
      const b = p.buff, c = p.cnt;
      if (b.bunSteam > 0 || b.vineStrike > 0) {
        const id = b.bunSteam > 0 ? 'baozi' : 'dangteng';
        if (KILLS[shot.type] || shot.type === 'drive') { shot.vx *= 1.12; shot.vy *= 1.12; }
        ctx.skill = id; ctx.big = 1;
        b.bunSteam = 0; b.vineStrike = 0;
      }
      // 查找替换：对手开着 Ctrl+H 时，这一记进攻被替换成软球
      if (b.rocketReady>0 && p.market?.coins>=1600 && KILLS[shot.type]) {
        b.rocketReady=0;shot.vx*=1.08;shot.vy*=1.08;ctx.skill='qiquan';ctx.big=1;this.proc(p,'jihui','火箭推进！');
      }
      const rep = this.entOf('replace', 1 - p.idx);
      if (rep && rep.age >= .3 && (!p.swing || this.time - p.swing.t >= this.time - rep.age) && ATTACK[shot.type] && this.phase === 'rally') {
        const s = this.shuttle, lc = this.players[1 - p.idx], H = this.halfOf(lc.idx), from = YY.SHOT_NAMES[shot.type] || '进攻';
        const v = rep.mode ? this.launchFrom(s.x, s.y, p.dir, 28, 1.4, 0.12) : this.launchFrom(s.x, s.y, p.dir, 54, H - 1.7, 0.6);
        shot.vx = v[0]; shot.vy = v[1]; shot.type = rep.mode ? 'net' : 'lift'; shot.reason = null;
        ctx.replaced = 1; this.dropEnt(rep);
        this.addEnt('replaceHit', lc.idx, s.x, s.y + 0.6, 1.2, { from, to: rep.mode ? '网前小球' : '高球' });
        this.proc(lc, 'yati', 'Ctrl+H：' + from + ' → ' + (rep.mode ? '网前小球' : '高球'));
        this.gainEnergy(lc, 3);
        return;
      }
      if(this.phase==='rally'&&this.lineShot(p,shot)){
        ctx.skill='pingyi';this.proc(p,'pingyi','校准回球 · '+(this.entOf('guide',p.idx)?.n||0)+' 次余量');
      }
      if (b.jiezou > 0 && c.combo > 0) { this.comboShot(p, shot, c.combo); c.combo--; ctx.skill = 'jiezou'; if (!c.combo) b.jiezou = 0; }
      if (b.jifeng > 0) {
        b.jifeng = 0; ctx.gust = 1;
        if (KILLS[shot.type] || shot.type === 'drive') { shot.vx *= 1.22; shot.vy *= 1.22; }
        this.proc(p, 'tafeng', '疾风！');
      }
      if (b.gold > 0) { // 一掷千金：金砖球更重——接的人够球范围变小、回球变差
        b.gold = 0; ctx.gold = 1; ctx.lever = 1.8; ctx.skill = 'qiquan'; ctx.big = 1;
        this.proc(p, 'qiquan', '金砖球！');
      }
      if (c.cloud) c.cloud.t = Math.min(c.cloud.t, 0.15); // 打完这一拍，云就散了
    },
    /** 一、二、一：每一拍都打向离对手最远的地方（他在前就送底线，在后就收网前），第三拍更快 */
    comboShot(p, shot, n) {
      if(n>1){this.proc(p,'jiezou',n===3?'一！稳住这一拍':'二！准备第三拍');return;}
      const s = this.shuttle, o = this.players[1 - p.idx], H = this.halfOf(o.idx), od = o.side * o.x;
      const deep = od < 3.3, last = n === 1, high = s.y > 2.3;
      const tgt = deep ? H - 0.45 : 1.05;
      let a0, type;
      if (deep) { a0 = high ? (last ? 8 : 14) : 46; type = high ? (last ? 'drive' : 'flatclear') : 'lift'; }
      else { a0 = high ? (last ? -14 : -6) : 18; type = high ? (last ? 'smash' : 'drop') : 'net'; }
      const v = this.launchFrom(s.x, s.y, p.dir, a0, tgt, deep ? 0.35 : 0.1);
      shot.vx = v[0]; shot.vy = v[1]; shot.type = type; shot.reason = null;
      this.proc(p, 'jiezou', ['一！', '二！', '一！'][3 - n] + (deep ? '底线' : '网前'));
    },
  });

  // ---------- 联机同步：技能装置 / 规则 / 受控球 / 状态（房主打包，好友端还原） ----------
  const r2 = (v) => Math.round(v * 100) / 100;
  const packVal = (v) => typeof v === 'number' ? r2(v) : Array.isArray(v) ? v.map(packVal) : v;
  const ENT_SKIP = { ver: 1, path: 1, bump: 1, ref: 1 };
  YY.skPack = function (m) {
    if (!m.skillsOn) return 0;
    const sk = m.sk, s = m.shuttle;
    return {
      e: m.ents.map((e) => { const o = {}; for (const k in e) if (!ENT_SKIP[k]) o[k] = packVal(e[k]); return o; }),
      r: [sk.half.map(r2), r2(sk.netUp || 0), sk.option ? [sk.option.o, sk.option.n || 0] : 0,
        sk.potato ? [sk.potato.o, r2(sk.potato.t)] : 0, 0],
      c: s.ctl ? { k: s.ctl.k, o: s.ctl.o, t: r2(s.ctl.t || 0), r: r2(s.ctl.r || 0), side: s.ctl.side || 0, e:s.ctl.e, thaw:s.ctl.thaw||0, to:s.ctl.to||0, high:s.ctl.high||0 } : 0,
      nf:s.nf ? {...s.nf} : null, silk:s.silkShot?{...s.silkShot}:null,
      toss:[s.selfToss??-1,s.tossSkill||null],
      l: r2(s.lever || 0), g: s.gust ? s.gust.o + 1 : 0, mk: s.monkey ? 1 : 0,
      gd: s.gold ? s.gold.o + 1 : 0,
      b: s.bun ? [s.bun.o, r2(s.bun.st || 0), r2(s.bun.t || 0)] : 0, sl: s.slam ? s.slam.o + 1 : 0, gv: s.grav ? s.grav.o + 1 : 0, td: s.tide != null ? s.tide + 1 : 0, w: s.wok ? [s.wok.o, s.wok.used ? 1 : 0] : 0,
      p: m.players.map((p) => {
        const b = {}; for (const k in p.buff) if (p.buff[k] > 0) b[k] = r2(p.buff[k]);
        const c = p.cnt || {};
        return [b, p.passive || 0, c.bun || 0, r2(c.charge || 0), c.diveW || p.dir, c.streak || 0, c.guess ? (c.guess.front ? 2 : 1) : 0,
          0, c.combo || 0, c.cloud ? 1 : 0, p.market ? { ...p.market, bet: p.market.bet ? { ...p.market.bet } : null } : null, c.recall ? { ...c.recall } : null,
          { ribbon:c.ribbon?JSON.parse(JSON.stringify(c.ribbon)):null,club:c.club ? JSON.parse(JSON.stringify(c.club)) : null,nv:c.nv ? JSON.parse(JSON.stringify(c.nv)) : null,calibrate:c.calibrate||0,compile:c.compile||0,habit:c.habit,rocketCharge:c.rocketCharge||0 },r2(p.skillCd||0)];
      }),
    };
  };
  /** 好友端：把打包数据挂到视图上（a/b 两帧之间按 u 插值装置位置） */
  YY.skUnpack = function (v, ka, kb, u) {
    const k = kb ?? ka;
    if (!k) {
      v.ents=[];v.sk=null;
      Object.assign(v.shuttle,{ctl:null,nf:null,silkShot:null,gold:null,gust:null,monkey:0,bun:null,slam:0,grav:null,tide:null,wok:null,lever:0,selfToss:-1,tossSkill:null});
      for(const p of v.players)Object.assign(p,{buff:{},passive:null,kit:null,cnt:{},market:null,skillCd:0});
      return;
    }
    const prev = {}; if (ka && ka !== k) for (const e of ka.e) prev[e.id] = e;
    v.ents = k.e.map((e) => { const p = prev[e.id]; return p ? Object.assign({}, e, { x: p.x + (e.x - p.x) * u, y: p.y + (e.y - p.y) * u, ...(Number.isFinite(e.z)&&Number.isFinite(p.z)?{z:p.z+(e.z-p.z)*u}:{}) }) : e; });
    const r = k.r;
    v.sk = { half: r[0], netUp: r[1], option: r[2] ? { o: r[2][0], n: r[2][1] || 0 } : null, potato: r[3] ? { o: r[3][0], t: r[3][1] } : null, beat: null };
    v.shuttle.silkShot=k.silk?{...k.silk}:null;
    v.shuttle.nf=k.nf ? {...k.nf} : null;
    v.shuttle.gold = k.gd ? { o: k.gd - 1 } : null;
    v.shuttle.ctl = k.c || null;v.shuttle.selfToss=k.toss?.[0]??-1;v.shuttle.tossSkill=k.toss?.[1]||null;
    v.shuttle.lever = k.l || 0;
    v.shuttle.gust = k.g ? { o: k.g - 1 } : null; v.shuttle.monkey = k.mk || 0;
    v.shuttle.bun = k.b ? { o: k.b[0], st: k.b[1], t: k.b[2] } : null;
    v.shuttle.slam = k.sl ? { o: k.sl - 1 } : null; v.shuttle.grav = k.gv ? { o: k.gv - 1 } : null; v.shuttle.tide = k.td ? k.td - 1 : null;
    v.shuttle.wok = k.w ? { o: k.w[0], used: k.w[1] } : null;
    k.p.forEach((q, i) => {
      const p = v.players[i];
      p.buff = q[0]; p.passive = q[1] || null; p.kit = p.passive ? { passive: p.passive, act: [] } : null;
      p.cnt = { bun: q[2], charge: q[3], diveW: q[4], streak: q[5] || 0, guess: q[6] ? { front: q[6] === 2 ? 1 : 0 } : null,
        combo: q[8] || 0, cloud: q[9] ? {} : null, recall:q[11] ? { ...q[11] } : null };
      Object.assign(p.cnt,q[12]||{});p.skillCd=q[13]||0;
      p.market = q[10] ? { ...q[10] } : null;
    });
  };

  // ---------- 拖动瞄准：几何计算（对局与“拖动预览”共用，好友端的视图对象也能用） ----------
  /** 自抛自扣：拖动方向 = 垫球角度（只能朝上），拖动长度 = 力度；vx 以“朝网”为正 */
  YY.tossVel = function (v) {
    const manual = !!(v && v.manual), sp = manual ? 4.5 + 4.8 * v.r : 6.6;
    const a = clamp(manual ? Math.atan2(v.y, v.x) : Math.atan2(6.6, 0.45), 0.3, Math.PI - 0.3);
    return { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, sp, a };
  };
  /** 地板开球的两面临时墙：身后一面竖墙、头顶一面横墙 */
  YY.slamWalls = function (p, H) {
    const bx = p.side * clamp(p.side * p.x + 1.7, 1.6, (H || C.HALF) + 1.0), top = clamp(p.y + C.SHOULDER + 2.1, 3.3, 4.6);
    return [{ v: 1, x: bx, y: 0, y1: 4.8 }, { v: 0, x: (bx + p.side * 0.35) / 2, y: top, x0: p.side * 0.35, x1: bx }];
  };
  /** 地板开球的完整线路：地板（豁免一次）+ 两面墙，各反弹一次并加速 */
  YY.slamPath = function (x, y, vx, vy, o) {
    const s = { x, y, vx, vy, netHit: false, crossedNet: false }, walls = (o.walls || []).map(w => Object.assign({}, w));
    const k = o.boost || 1.18, boost = () => { const sp = Math.hypot(s.vx, s.vy), n = Math.min(32, sp * k); if (sp > .1) { s.vx *= n / sp; s.vy *= n / sp; } };
    let floor = o.floor == null ? 1 : o.floor, n = 0, t = 0;
    const pts = [{ t: 0, x, y, vx, vy }], hits = [];
    for (let i = 0; i < 300 && t < 4; i++) {
      const px = s.x, py = s.y, r = YY.stepShuttle(s, C.DT, o.env); t += C.DT;
      if (!s.crossedNet && !s.netHit) for (const w of walls) {
        if (w.used) continue;
        if (w.v && (px - w.x) * (s.x - w.x) <= 0 && px !== s.x && s.y < w.y1) { s.x = w.x - Math.sign(s.x - px) * 0.03; s.vx = -s.vx; }
        else if (!w.v && (py - w.y) * (s.y - w.y) <= 0 && py !== s.y && (s.x - w.x0) * (s.x - w.x1) <= 0) { s.y = w.y - Math.sign(s.y - py) * 0.03; s.vy = -s.vy; }
        else continue;
        w.used = 1; boost(); n++; hits.push({ x: s.x, y: s.y, w: w.v ? 'back' : 'top' });
      }
      if (r === 'floor') {
        if (floor && o.side * s.x > 0 && !s.crossedNet && !s.netHit) { floor = 0; s.y = C.SHUTTLE_R + 0.02; s.vy = Math.abs(s.vy); boost(); n++; hits.push({ x: s.x, y: 0, w: 'floor' }); }
        else { pts.push({ t, x: s.x, y: s.y, vx: s.vx, vy: s.vy }); break; }
      }
      if (i % 2 === 0) pts.push({ t, x: s.x, y: s.y, vx: s.vx, vy: s.vy });
    }
    return { landX: s.x, pts, netHit: s.netHit, crossed: s.crossedNet, n, t, hits };
  };
  /** 红丝带甩出：拖动 = 角度 + 力度；点按 = 自动打向对手离得远的那块空当 */
  YY.ribbonVel = function (m, p, v, x, y) {
    if (v && v.manual) {
      const a = clamp(Math.atan2(v.y, v.x), -0.7, 1.25), sp = 9 + 13 * v.r;
      return { vx: Math.cos(a) * sp * p.dir, vy: Math.sin(a) * sp, sp, a };
    }
    const o = m.players[1 - p.idx], H = m.sk && m.sk.half ? m.sk.half[o.idx] : C.HALF, od = o.side * o.x;
    const [vx, vy] = Match.prototype.launchFrom.call({ env: m.env }, x, y, p.dir, od < 3.2 ? 14 : 22, od < 3.2 ? H - 0.6 : 1.5, 0.15);
    return { vx, vy, sp: Math.hypot(vx, vy), a: Math.atan2(vy, vx * p.dir) };
  };
  /** 接力协议：离球近的一端（本体 / 复制体）把球垫给另一端；没有复制体时自垫。
   * 球必须在己方、离某一端拍面 RELAY_R 以内。返回二次贝塞尔路线与到达点（预览、对局、AI 共用）。 */
  const RELAY_R = 1.9;
  YY.relayPlan = function (m, p, v) {
    const s = m.shuttle;
    if (!s || !s.live || s.held || s.netHit || s.ctl) return null;
    const mine = s.selfToss === p.idx, incoming = s.lastHitter !== p.idx && s.crossedNet;
    if ((!mine && !incoming) || p.side * s.x < 0.2 || s.y < 0.3) return null;
    const H = m.sk && m.sk.half ? m.sk.half[p.idx] : C.HALF;
    const clone = (m.ents || []).find(e => e.k === 'clone' && e.o === p.idx);
    const gap = (x,z) => Math.hypot(s.x - (x + p.dir * 0.6), s.y - (p.y + C.SHOULDER), m.courtMode === '3d' ? (s.z||0)-(z||0) : 0);
    const dB = gap(p.x,p.z), dC = clone ? gap(clone.x,clone.z) : Infinity;
    if (Math.min(dB, dC) > RELAY_R) return null;
    const from = dC < dB ? 'clone' : 'body', to = !clone ? 'self' : from === 'clone' ? 'body' : 'clone';
    const manual = !!(v && v.manual), r = manual ? clamp(v.r, 0, 1) : 0.62;
    const own = (d) => p.side * clamp(d, 1.0, H - 0.35); // 离网 d 米，留在己方界内
    let tx, ty, T, top, high, name, label;
    if (to === 'self') { // 自垫：拖动的高低决定垫多高（击球时机），左右决定前后挪一点
      const fx = manual ? v.x * r * 0.9 : 0, up = manual ? clamp(v.y, 0.15, 1) : 0.6;
      tx = own(p.side * (p.x + p.dir * (0.55 + fx))); ty = 2.1 + 1.5 * r * up;
      T = 0.36 + 0.22 * (ty - 2.1); top = Math.max(s.y, ty) + 0.35; high = ty > 2.8;
      name = '自垫'; label = '自垫 · 高 ' + ty.toFixed(1) + ' 米 · ' + T.toFixed(2) + ' 秒';
    } else {
      const rx = to === 'body' ? p.x : clone.x;
      tx = own(p.side * (rx + p.dir * 0.55));
      high = !manual || v.y >= 0.55; // 向上拖 = 高传，平拖 = 快传
      if (high) { ty = 3.0 + 0.8 * r; T = 0.85 + 0.3 * r; top = Math.max(s.y, ty) + 0.75; }
      else { ty = 2.05; T = 0.62 - 0.3 * r; top = Math.max(s.y, ty) + 0.15 + 0.35 * (1 - r); }
      name = high ? '高传' : '快传';
      label = name + ' → ' + (to === 'body' ? '本体' : '复制体') + (high ? ' · 高 ' + ty.toFixed(1) + ' 米' : ' · ' + T.toFixed(2) + ' 秒');
    }
    return { from, to, tx, ty, T, P: [[s.x, s.y], [(s.x + tx) / 2, top], [tx, ty]], high, name, label };
  };
  /** 拖动技能键时的预览（本机玩家看）：轨迹点 + 落点 + 文字 */
  YY.skillPreview = function (m, p, id, v) {
    const s = m.shuttle || {}, env = m.physEnv ? m.physEnv() : m.env, H = (i) => (m.sk && m.sk.half ? m.sk.half[i] : C.HALF);
    const o = m.players[1 - p.idx], deg = (a) => Math.round(a * 180 / Math.PI) + '°';
    const landOk = (r) => !r.netHit && o.side * r.landX > 0 && o.side * r.landX <= H(o.idx) + C.LINE_TOL;
    const near = s.live && !s.held && Math.hypot(s.x - p.x - p.dir * 0.6, s.y - p.y - C.SHOULDER) < 2.4;
    const bx = near ? s.x : p.x + p.dir * 0.6, by = near ? s.y : p.y + C.SHOULDER + 0.2;
    switch (id) {
      case 'fengkou': {
        const t=Match.prototype.skillTarget.call({halfOf:H},p,id,v);
        return {rect:{x:t.x,y:t.y,h:.9},line:[[t.x,t.y],[t.x+p.dir*v.x*.7,t.y+v.y*.4]],label:'局部风道 · 助跑／改线一次',good:true};
      }
      case 'xuanpai': return {line:[[p.x,p.y+1.25],[p.x+p.dir*v.x*1.5,p.y+1.25+v.y*1.5]],label:'二段定向扫回',good:true};
      case 'zipao': {
        const t = YY.tossVel(v), r = YY.simulate(bx, by, t.vx * p.dir, t.vy, 1.8, true, false, env);
        let apex = r.pts[0]; for (const q of r.pts) if (q.y > apex.y) apex = q;
        return { pts: r.pts, mark: apex, label: '垫高 ' + deg(t.a) + ' · 力度 ' + Math.round(t.sp / 9.3 * 100) + '%', good: true };
      }
      case 'diban': {
        if (!v.manual) return { label: '自动选反弹线路' };
        const n = Math.hypot(v.x, v.y) || 1, r = YY.slamPath(bx, by, v.x / n * 16 * p.dir, v.y / n * 16, { side: p.side, walls: YY.slamWalls(p, H(p.idx)), env });
        const good = r.crossed && landOk(r);
        return { pts: r.pts, land: r.landX, hits: r.hits, walls: YY.slamWalls(p, H(p.idx)), good, label: (good ? '能过网 · ' : '会丢分 · ') + '反弹 ' + r.n + ' 次' };
      }
      case 'hongxian': {
        const c = s.ctl;
        if (c && c.k === 'tether' && c.o === p.idx) {
          const f = YY.ribbonVel(m, p, v, s.x, s.y), r = YY.simulate(s.x, s.y, f.vx, f.vy, 4, true, false, env), good = landOk(r);
          return { pts: r.pts, land: r.landX, good, label: (v.manual ? '甩出 ' + deg(f.a) + ' · ' + Math.round(f.sp * 3.6) + ' km/h' : '自动甩向空当') + (good ? '' : ' · 会丢分') };
        }
        const d = v.manual ? { x: v.x, y: v.y } : { x: Math.cos(0.6), y: Math.sin(0.6) }, nn = Math.hypot(d.x, d.y) || 1, ox = p.x + p.dir * 0.3, oy = p.y + 1.45;
        let ex = ox + d.x / nn * RIBBON_L * p.dir; const ey = Math.max(0.15, oy + d.y / nn * RIBBON_L);
        if (p.side * ex < 0.12) ex = p.side * 0.12;
        return { line: [[ox, oy], [ex, ey]], label: v.manual ? '丝带 ' + deg(Math.atan2(d.y, d.x)) : '丝带自动瞄球', good: true };
      }
      case 'baozi': {
        if(s.bun?.o===p.idx){
          const f=Match.prototype.bunFling.call({shuttle:s,players:m.players,halfOf:H,physEnv:()=>env},p);
          if(!f)return {label:s.lastHitter!==p.idx?'先亲手回球，再拆包':'压力或方向不足 · 保留肉包',good:false};
          const r=YY.simulate(s.x,s.y,f.vx,f.vy,6,true,false,env);
          return {pts:r.pts,land:r.landX,good:true,label:'安全拆包 · 当前球权归你'};
        }
        const vx = v.manual ? v.x * (7 + 7 * v.r) : 7.5, vy = v.manual ? v.y * (7 + 7 * v.r) : 6, pts = [];
        let x = p.x + p.dir * 0.35, y = p.y + 1.7, wy = vy;
        for (let t = 0; t < 1.8 && y > 0.1; t += 0.05) { pts.push({ x, y }); x += vx * p.dir * 0.05; wy -= BUN_G * 0.05; y += wy * 0.05; }
        return { pts, label: v.manual ? '掷出肉包 ' + deg(Math.atan2(v.y, v.x)) : '自动掷向球', good: true, bun: 1 };
      }
      case 'pingyi': return {mark:{x:p.x+p.dir*.65,y:p.y+C.SHOULDER},label:'两次亲手回球 · 保留球路，校准失误',good:true};
      case 'youyou': {
        const distance=v.manual?1.6+3.2*v.r:4.2,tx=p.side*clamp(p.side*(p.x+p.dir*v.x*distance),.25,H(p.idx)+.4),ty=Math.max(.25,p.y+1.5+v.y*distance);
        return {line:[[p.x,p.y+1.5],[tx,ty]],mark:{x:tx,y:ty},label:'接住来球 → 收回拍前 → 自己回击',good:true};
      }
      case 'fanshe': {
        const e=Match.prototype.skillTarget.call({halfOf:H,players:m.players,shuttle:s,pred:m.pred,time:m.time,entsOf:()=>[]},p,'fanshe',v);e.target=clamp(H(o.idx)-p.side*e.x,2.2,5.2);
        const vv=Match.prototype.boardExit.call({launchFrom:(...args)=>Match.prototype.launchFrom.call({env},...args)},p,e),r=YY.simulate(e.x,e.y,...vv,6,true,false,env);
        return {pts:r.pts,mark:e,land:r.landX,label:'准备 0.45秒 · 固定落区 · 不接己方发球',good:true};
      }
      case 'jieli': {
        const plan = YY.relayPlan(m, p, v);
        if (!plan) return { label: '球不在本体或复制体身边', good: false };
        const pts = []; for (let i = 0; i <= 16; i++) { const [x, y] = bez(plan.P, i / 16); pts.push({ x, y }); }
        return { pts, mark: { x: plan.tx, y: plan.ty }, label: plan.label + (plan.high && plan.to !== 'self' ? ' · 起跳扣杀' : ''), good: true };
      }
      case 'shuangji': {
        const t = Match.prototype.skillTarget.call({ halfOf: H, players: m.players, shuttle: s, pred: m.pred, time: m.time, entsOf: () => [], incomingTo: () => false }, p, id, v);
        return { rect: { x: t.x, y: t.y, h: 0.62 }, label: v.manual ? '冻结窗格' : '自动放在球路上', good: true };
      }
    }
    return null;
  };
  YY.Match = Match;
  YY.skillRecastReady = function(m,p,id) {
    const c = m.shuttle?.ctl, own = c?.o === p.idx, ents = m.ents || [];
    if (id === 'yueliang') return own && c.k === 'orbit';
    if (id === 'hongxian') return own && c.k === 'tether';
    if (id === 'huichao') return own && c.k === 'rewind';
    if (id === 'dangteng') return p.buff?.vine > 0;
    if (id === 'zhongli') return p.buff?.gravOn > 0;
    if (id === 'shuangji') return own && c.k === 'freeze';
    if (id === 'baozi') return m.shuttle?.bun?.o === p.idx;
    if (id === 'huiguo') return m.shuttle?.wok?.o === p.idx;
    if (id === 'xuanpai' && p.cnt?.recall?.kind === 'spin' && p.buff?.shoushi > 0) return true;
    const k = { shensuo:'pole', xuanpai:'spin', youyou:'yoyo', shuizhong:'ripple' }[id];
    return !!k && ents.some(e=>e.k===k && e.o===p.idx);
  };

  // 新角色：所有击球型技能都可提前准备，成功普通触球才消耗。
  const N_IDS=new Set(['jibei','yimo','weichui','dianbu','bianpai','jieli_jump','tongqin','gongwei','jiaban','sanbu','yipai','jingmo']);
  const ns=p=>p.cnt.nv||(p.cnt.nv={});
  const ent=(m,p,id)=>p&&m?.ents?.find(e=>e.k==='newskill'&&e.o===p.idx&&e.sid===id&&e.t>0);
  const add=(m,p,id,t,data={})=>m.addEnt('newskill',p.idx,p.x,p.y,t,{sid:id,T:t,...data});
  const mode=v=>!v?.manual?0:v.y>.35?1:-1;
  const spinUp=p=>{ns(p).spin=Math.min(2,(ns(p).spin||0)+1);};
  const old={};
  for(const k of ['castCheck','cast','recast','mods','updatePlayer','handlePress','beginSwing','doHit','skShot','skAfterHit','skStep','skReset','touchShuttle','physEnv','shuttleScale','realT','skHitQ','skPointEnd','useSkill'])old[k]=Match.prototype[k];
  function onFossil(m,p,e){return !!e&&Math.abs(p.x-e.x)<=1.15&&(!YY.spatialNear||YY.spatialNear(m,p,e,.9));}
  function fossilHeight(e){return e?clamp((e.height??0),0,1.25):0;}
  // Select the fastest legal, physically continuous attack toward the chosen landing zone.
  // This changes the launch angle rather than speeding up a ball after it has left the racket.
  function boboDive(m,p,shot,tail,originalShot){
    const s=m.shuttle;if(s.y<2.6||!['smash','halfsmash','kill','drive'].includes(shot.type))return false;
    const seed=originalShot||shot,env=m.physEnv(),space=m.courtMode==='3d';
    const base=space?YY.simulate3D({...s,...seed,netHit:false},env,false):YY.simulate(s.x,s.y,seed.vx,seed.vy,6,false,false,env);
    const depth=clamp(-p.side*base.landX,1.25,m.halfOf(1-p.idx)-.45),targetZ=space?clamp(base.landZ,-2.25,2.25):0;
    const dx=p.dir*depth-s.x,dz=space?targetZ-(s.z||0):0,range=Math.hypot(dx,dz);let best=null;
    const cap=Math.min(52,Math.max(tail?46:40,Math.hypot(seed.vx,seed.vy,seed.vz||0)*(tail?1.24:1.16)));
    for(let angle=-65;angle<=14;angle+=.5){
      const speed=YY.solveSpeed(0,s.y,1,angle,range,env);if(!Number.isFinite(speed)||speed>cap)continue;
      const a=angle*Math.PI/180,vx=Math.cos(a)*speed*dx/range,vy=Math.sin(a)*speed,vz=Math.cos(a)*speed*dz/range;
      const pr=space?YY.simulate3D({...s,vx,vy,vz,netHit:false},env,false):YY.simulate(s.x,s.y,vx,vy,6,false,false,env);
      if(pr.netHit||-p.side*pr.landX<.6||Math.abs(pr.landX)>m.halfOf(1-p.idx)-.15||space&&Math.abs(pr.landZ)>2.4)continue;
      if(pr.t>=.22&&(!best||pr.t<best.t))best={vx,vy,vz,t:pr.t};
    }
    if(!best)return false;
    shot.vx=best.vx;shot.vy=best.vy;if(space)shot.vz=best.vz;shot.reason=null;return true;
  }
  const MOVE_IDS=['splitBurst'];
  function moveVector(m,p,v){
    const raw=m._skillAim3D,inp=m.inputs[p.idx];
    let x,z=0;
    if(raw){x=raw.y*p.dir;z=raw.x;}
    else if(v?.manual)x=v.x*p.dir;
    else if(Math.hypot(inp.move||0,inp.strafe||0)>.15){x=inp.move*p.dir;z=inp.strafe||0;}
    else if(m.shuttle.live&&m.shuttle.lastHitter!==p.idx&&m.pred){x=m.pred.landX-p.dir*.55-p.x;z=(m.pred.landZ??p.z??0)-(p.z||0);}
    else x=p.side*p.x<1.5?-p.dir:p.dir;
    const n=Math.hypot(x,z)||1;return{x:x/n,z:z/n};
  }
  function startMove(m,p,id,toX,toZ,T,hop=0){
    for(const sid of MOVE_IDS){const e=ent(m,p,sid);if(e)m.dropEnt(e);}
    p.dash3D=null;
    return add(m,p,id,T,{from:p.x,to:p.side*clamp(p.side*toX,C.X_NEAR,m.halfOf(p.idx)+.2),fromZ:p.z||0,toZ:clamp(toZ||0,-2.55,2.55),y0:p.y,air:!p.onGround,v0:p.vx||0,vz0:p.vz||0,endV:(m.inputs[p.idx].move||0)*p.dir*m.maxSpeed(p),endZ:(m.inputs[p.idx].strafe||0)*m.maxSpeed(p),hop});
  }
  function slide(m,p,e,v){
    const d=moveVector(m,p,v);startMove(m,p,'splitBurst',p.x+d.x*2.25,(p.z||0)+d.z*2.25,.34);
    const st=ns(p);st.slideUntil=m.time+2;st.slideDir=d.x;st.slideZ=d.z;st.spinTurn=Math.sign(d.z)||st.spinTurn||1;
    spinUp(p);e.n--;e.cool=m.time+.22;if(e.n<=0)m.dropEnt(e);
  }
  // Hermite travel preserves the entry velocity and eases into braking. No teleport.
  function travel(e,u,a,b,v,end=0){
    const h=u*u,h3=h*u;
    return{p:(2*h3-3*h+1)*a+(h3-2*h+u)*e.T*v+(-2*h3+3*h)*b+(h3-h)*e.T*end,
      v:((6*h-6*u)*a+(3*h-4*u+1)*e.T*v+(-6*h+6*u)*b+(3*h-2*u)*e.T*end)/e.T};
  }
  function pathOf(m,shot,env,ignoreNet=false){
    const s=m.shuttle;
    return m.courtMode==='3d'?YY.simulate3D({...s,...shot,netHit:ignoreNet},env,false):YY.simulate(s.x,s.y,shot.vx,shot.vy,6,false,ignoreNet,env);
  }
  // Solve a real curved flight, including diagonal net clearance. Newton's two
  // launch variables compensate sideways curvature without changing the landing lane.
  function arcAt(m,p,target,angle,env,cap=52){
    const s=m.shuttle,rad=angle*Math.PI/180,dx=target.x-s.x,dz=(target.z||0)-(s.z||0),spatial=m.courtMode==='3d';
    let speed=YY.solveSpeed(s.x,s.y,p.dir,angle,Math.abs(dx),env),yaw=Math.atan2(dz,Math.abs(dx));
    if(!Number.isFinite(speed)||speed>cap)return null;
    const at=(v,a)=>({vx:p.dir*v*Math.cos(rad)*Math.cos(a),vy:v*Math.sin(rad),...(spatial?{vz:v*Math.cos(rad)*Math.sin(a)}:{})});
    if(spatial){
      for(let i=0;i<6;i++){
        const r=pathOf(m,at(speed,yaw),env,true),ex=target.x-r.landX,ez=target.z-r.landZ;
        if(Math.hypot(ex,ez)<.025)break;
        const ds=.12,da=.012,rv=pathOf(m,at(speed+ds,yaw),env,true),ra=pathOf(m,at(speed,yaw+da),env,true);
        const xx=(rv.landX-r.landX)/ds,xz=(ra.landX-r.landX)/da,zx=(rv.landZ-r.landZ)/ds,zz=(ra.landZ-r.landZ)/da,det=xx*zz-xz*zx;
        if(Math.abs(det)<1e-6)break;
        speed=clamp(speed+clamp((ex*zz-ez*xz)/det,-8,8),1,cap);yaw=clamp(yaw+clamp((ez*xx-ex*zx)/det,-.35,.35),-1.12,1.12);
      }
    }
    const shot=at(speed,yaw),r=pathOf(m,shot,env);
    return !r.netHit&&p.dir*r.landX>.4&&p.dir*r.landX<m.halfOf(1-p.idx)-.12&&(!spatial||Math.abs(r.landZ)<2.45)&&Math.hypot(r.landX-target.x,spatial?r.landZ-target.z:0)<.3?shot:null;
  }
  function rotateShot(m,p,shot,power,setting,turn=0){
    const env={...old.physEnv.call(m)},base=pathOf(m,shot,env),a=Math.atan2(shot.vy,Math.hypot(shot.vx,shot.vz||0))*180/Math.PI;
    const up=setting||(['clear','flatclear','lift'].includes(shot.type)?1:-1),n=clamp(power/2,0,1),depth=clamp(p.dir*base.landX+(up>0?.85+.35*n:-.85-.45*n),.85,m.halfOf(1-p.idx)-.4);
    const target={x:p.dir*depth,z:clamp(base.landZ||0,-2.1,2.1)};
    for(const strength of[1,.72]){
      const curve={dir:p.dir,lift:up*(.9+.48*n)*strength,side:(m.courtMode==='3d'?(turn||Math.sign(shot.vz)||1)*(.38+.18*n)*p.dir:0)*strength};
      const curved={...env,curve};
      for(const delta of[up>0?-14:-10,up>0?-3:2,up>0?8:14]){
        const v=arcAt(m,p,target,clamp(a+delta,-32,72),curved,Math.min(40,Math.max(18,Math.hypot(shot.vx,shot.vy,shot.vz||0)*1.18)));
        if(v){Object.assign(shot,v,{reason:null});return curve;}
      }
    }
    return null;
  }
  // 马哥：手动接球当拍借力；折纸改变空气阻力与升力，沿同一物理轨迹飞行。
  const OFFICE=YY.OFFICE_FLIGHT=Object.freeze({pressure:1,return:2,dart:4,glide:8});
  function pressureAt(m,p,ctx){
    if(!m.hasPassive(p,'gongxiu')||!filmReturn(m,p,ctx))return null;
    const v=Math.hypot(m.shuttle.vx,m.shuttle.vy,m.shuttle.vz||0);
    return {speed:v,power:clamp((v-5)/22,0,1)};
  }
  function dispatchShot(m,p,shot,base,env,pressure,back,dart,glide){
    const s=m.shuttle,soft=!!NET_ZONE[shot.type],attack=!!ATTACK[shot.type]&&shot.type!=='flatclear';
    const valid=legalEditPath(m,p.dir,base),family=soft?'short':attack?'attack':'deep';
    let depth=valid?p.dir*base.landX:(shot.direction3D?.x??(soft?1.4:attack?3.7:5.6));
    if(soft&&back)depth-=.4+.22*pressure.power;
    if(glide)depth+=soft?-.35:attack?-.35:.45;
    depth=clamp(depth,soft?(glide?.85:.62):attack?1.12:2.7,m.halfOf(1-p.idx)-.38);
    const target={x:p.dir*depth,z:clamp(shot.direction3D?.z??base.landZ??s.z??0,-2.4,2.4)};
    const paper=dart||glide?{dir:p.dir,dart:!!dart,glide:!!glide,foldAt:Math.max(.28,depth*(soft?.34:attack?.43:.62))}:null;
    const air=paper?{...env,paper}:env;
    const original=Math.atan2(shot.vy,Math.hypot(shot.vx,shot.vz||0))*180/Math.PI;
    let angles,cap=44;
    if(attack){
      const seed=Math.hypot(shot.vx,shot.vy,shot.vz||0);
      cap=Math.min(47,seed*(1.07+.16*pressure.power+(back?.2:0)+(dart?.12:0))+(back?Math.max(0,pressure.speed-seed)*.16:0));
      angles=[1,.87].map(r=>YY.solveAngle(s.x,s.y,p.dir,cap*r,Math.abs(target.x-s.x),-68,38,air));
      angles.push(original,original+12,original+25,30,45);
    }else{
      const flatten=soft?(back?7:0):(dart?23:6)+(back?5:0)+(glide?5:0);
      const a=clamp(original-flatten,soft?-22:12,68);
      angles=[a,a+8,a+17,a+29,65];
    }
    for(const a of angles){
      const v=arcAt(m,p,target,clamp(a,-68,74),air,cap*1.06);
      if(v){Object.assign(shot,v,{reason:null});return {paper,family};}
    }
    return null;
  }
  function officeShot(m,p,shot,ctx){
    const pressure=pressureAt(m,p,ctx);if(!pressure)return;
    ctx.pressureReturn=true;ctx.pressurePower=pressure.power;
    const back=ent(m,p,'tongqin'),dart=ent(m,p,'gongwei'),glide=ent(m,p,'jiaban');
    const env=old.physEnv.call(m),base=pathOf(m,shot,env);
    const solution=dispatchShot(m,p,shot,base,env,pressure,back,dart,glide);
    if(!solution)return;
    const bits=OFFICE.pressure|(back?OFFICE.return:0)|(dart?OFFICE.dart:0)|(glide?OFFICE.glide:0);
    ctx.office=bits;ctx.officePaper=solution.paper;ctx.newcomerSolved=true;
    ctx.skill=glide?'jiaban':dart?'gongwei':back?'tongqin':'gongxiu';
    ctx.big=!!(bits&~OFFICE.pressure);
    for(const e of [back,dart,glide])if(e&&--e.n<=0)m.dropEnt(e);
    if(back)add(m,p,'returnSeal',.42,{power:pressure.power,combo:!!(dart||glide)});
  }
  // 老南：慢镜、复映、快进共享取景状态，但飞行始终使用原有碰撞与轨迹。
  const { lens:LENS,replay:REPLAY,cut:CUT }=YY.FILM_EDIT=Object.freeze({lens:1,replay:2,cut:4});
  const LENS_RATE=.54, LENS_TIME=1.45, CUT_LEAD=.14, CUT_RAMP=.12;
  const editFamily=type=>NET_ZONE[type]?'short':ATTACK[type]&&type!=='flatclear'&&type!=='push'?'attack':'deep';
  const editAngle={clear:48,flatclear:32,lift:56,push:24,drop:20,slice:16,net:31,tumble:34,block:36,smash:-22,halfsmash:-12,drive:9,kill:-21};
  function freeEditBall(m){
    const s=m.shuttle;
    return m.skillsOn&&m.phase==='rally'&&s.live&&!s.held&&!s.ctl&&!s.bun&&!s.netHit;
  }
  function activeLens(m,p){
    if(!freeEditBall(m))return null;
    return m.ents.find(e=>e.sid==='sanbu'&&e.active&&e.hit===m.hitCount&&e.until>m.time&&e.t>0&&(!p||e.o===p.idx));
  }
  function clearLens(m,e){
    e.active=false;delete e.until;
    if(!e.n)m.dropEnt(e);
  }
  function legalEditPath(m,side,path){
    const depth=side*path.landX;
    return !path.netHit&&depth>.2&&depth<=m.halfOf(side<0?0:1)+C.LINE_TOL&&
      (m.courtMode!=='3d'||Math.abs(path.landZ)<=2.59+C.LINE_TOL);
  }
  function takeLens(m,p,e){
    const s=m.shuttle;
    if(!freeEditBall(m)||!e.n||e.active||e.hit===m.hitCount||s.lastHitter===p.idx||s.lastHitter<0||
        s.selfToss===p.idx||s.x*p.side< -1.35||(!s.crossedNet&&s.vx*p.side<=0))return;
    const route=m.pred&& (m.courtMode!=='3d'||m.pred.landZ!=null)?m.pred:pathOf(m,s,m.physEnv());
    if(!legalEditPath(m,p.side,route))return;
    e.active=true;e.hit=m.hitCount;e.n--;e.until=m.time+Math.min(e.t,LENS_TIME);
    p.replan=true;
    m.proc(p,'sanbu','慢镜取景');
  }
  function editMode(m,v){
    const aim=m._skillAim3D?.y??v?.y??0;
    return Math.abs(aim)>.27?Math.sign(aim):0;
  }
  function filmReturn(m,p,ctx){
    const s=m.shuttle;
    return s.live&&!s.held&&!s.ctl&&!s.bun&&!s.netHit&&s.crossedNet&&s.lastHitter>=0&&s.lastHitter!==p.idx&&s.selfToss!==p.idx&&
      !ctx.serve&&!ctx.device&&!ctx.ownSide&&!m.cloneHitting;
  }
  function replayShot(m,p,shot,e,slow,env,base){
    const s=m.shuttle, family=editFamily(shot.type), original=Math.atan2(shot.vy,Math.hypot(shot.vx,shot.vz||0))*180/Math.PI;
    const nominal=editAngle[shot.type]??35,clip=ns(p).film?.[family];
    const profile=clip?clamp((clip.angle-nominal)*.5,-10,10):0;
    const depth=legalEditPath(m,p.dir,base)?p.dir*base.landX:(shot.direction3D?.x??(family==='short'?1.6:family==='attack'?3.8:5.6));
    const z=clamp(shot.direction3D?.z??base.landZ??s.z??0,-2.42,2.42);
    const direction=e.mode||(family==='short'?-1:1);
    const shift=direction*((family==='short'?.94:1.22)+(slow?.32:0));
    const min=family==='short'?.65:family==='attack'?1.08:2.65, max=Math.max(min,m.halfOf(1-p.idx)-.28);
    for(const weight of [1,.54]){
      const target={x:p.dir*clamp(depth+shift*weight,min,max),z};
      if(family==='attack'){
        const seed=Math.hypot(shot.vx,shot.vy,shot.vz||0),recorded=clip?clamp((clip.speed-seed)*.15,-1.2,2.2):0;
        const distance=Math.hypot(target.x-s.x,z-(s.z||0));
        const cap=clamp(seed*(slow?1.22:1.13)+recorded,seed,Math.max(seed,48));
        for(const ratio of [1,.89]){
          const a=YY.solveAngle(0,s.y,1,cap*ratio,distance,-66,25,env);
          const v=arcAt(m,p,target,a,env,cap*1.07);
          if(v){Object.assign(shot,v);return true;}
        }
      }else{
        const aim=clamp(original+profile+(family==='deep'?-7:direction>0?-5:0),-16,68);
        for(const a of [aim,aim+9,aim+19,nominal+17]){
          const v=arcAt(m,p,target,clamp(a,-18,74),env,43);
          if(v){Object.assign(shot,v);return true;}
        }
      }
    }
    return false;
  }
  function playEdit(m,p,shot,ctx){
    if(!m.hasPassive(p,'lvyue')||!filmReturn(m,p,ctx))return;
    ctx.filmReturn=true;
    const slow=activeLens(m,p), replay=ent(m,p,'yipai'), fast=ent(m,p,'jingmo');
    let edit=slow?LENS:0;
    const env=old.physEnv.call(m);
    let path;
    if(replay){
      const base=pathOf(m,shot,env);
      if(legalEditPath(m,p.dir,base)){
        ctx.filmSeed={angle:Math.atan2(shot.vy,Math.hypot(shot.vx,shot.vz||0))*180/Math.PI,speed:Math.hypot(shot.vx,shot.vy,shot.vz||0)};
      }
      if(replayShot(m,p,shot,replay,!!slow,env,base)){
        ctx.newcomerSolved=true;edit|=REPLAY;
        if(--replay.n<=0)m.dropEnt(replay);
      }else path=base;
    }
    if(fast){
      path??=pathOf(m,shot,env);
      if(legalEditPath(m,p.dir,path)){
        edit|=CUT;
        // High contact attacks already fly quickly. Give slower placement shots a larger cut.
        const pace=m.courtMode==='3d'?YY.COURT3D.flightPace:1;
        const attack=editFamily(shot.type)==='attack',shortTime=path.t/pace<.45;
        ctx.editSpeed=(attack?(shortTime?1.36:1.52):1.72)+(slow?.13:(edit&REPLAY)?.10:0);
        if(--fast.n<=0)m.dropEnt(fast);
      }
    }
    ctx.edit=edit;
    if(edit){
      ctx.skill=edit&REPLAY?'yipai':edit&CUT?'jingmo':'sanbu';
      ctx.big=!!(edit&(edit-1));
    }
  }
  function archiveEdit(m,p,shot,ctx){
    if(!ctx.filmReturn)return;
    const s=m.shuttle,path=m.courtMode==='3d'&&m.pred?.landZ==null?pathOf(m,shot,m.physEnv()):m.pred;
    if(!path||!legalEditPath(m,p.dir,path))return;
    const st=ns(p),family=editFamily(shot.type);
    if(!(ctx.edit&REPLAY)){
      const speed=Math.hypot(s.vx,s.vy,s.vz||0),angle=Math.atan2(s.vy,Math.hypot(s.vx,s.vz||0))*180/Math.PI;
      (st.film??={})[family]={angle,speed};
    }else if(ctx.filmSeed)(st.film??={})[family]=ctx.filmSeed;
    if(ctx.edit&&st.frames>0&&(st.filmRefunds||0)<3){
      st.frames--;st.filmRefunds=(st.filmRefunds||0)+1;m.gainEnergy(p,5);p.stamina=Math.min(C.STAM_MAX,p.stamina+4);
      st.filmFlash=m.time+.38;
    }
    if(st.lastFilm!==family)st.frames=Math.min(2,(st.frames||0)+1);
    st.lastFilm=family;
  }
  // A cut ramps on the same physical path. The primitive gives the exact
  // average scale per physics tick, and the inverse below also drives AI/hints.
  const cutAge=(f,at)=>at-f.cutAt-CUT_LEAD;
  function cutRate(f,at){
    return f?.fast>1?1+(f.fast-1)*clamp(cutAge(f,at)/CUT_RAMP,0,1):1;
  }
  function cutIntegral(f,at){
    const u=Math.max(0,cutAge(f,at));
    return (f.fast-1)*(u<CUT_RAMP?u*u/(2*CUT_RAMP):u-CUT_RAMP/2);
  }
  YY.editCutRate=cutRate;
  function filmRealT(m,tau,pace){
    if(!freeEditBall(m))return null;
    const s=m.shuttle,f=s.nf?.fast>1?s.nf:null,lens=activeLens(m);
    if(!lens&&!f)return null;
    if(!(tau>0))return 0;
    const slow=Math.max(0,lens?lens.until-m.time:0);
    const rush=Math.max(0,s.rush||0),legacy=s.lastHitter!==m.slowFor?Math.max(0,m.slowT):0;
    const edges=[slow,rush,legacy];
    if(f)edges.push(f.cutAt+CUT_LEAD-m.time,f.cutAt+CUT_LEAD+CUT_RAMP-m.time);
    let t=0;
    for(const end of edges.filter(x=>x>0).sort((a,b)=>a-b).concat(Infinity)){
      if(end===t)continue;
      const base=pace*(t<rush?RUSH_SCALE:t<legacy?SLOW_SCALE:1);
      const rate=base*(t<slow?LENS_RATE:cutRate(f,m.time+t));
      const length=end-t;
      if(!Number.isFinite(length))return t+tau/rate;
      const slope=t<slow?0:(base*cutRate(f,m.time+end)-rate)/length;
      const covered=length*(rate+slope*length/2);
      if(tau<=covered)return t+2*tau/(rate+Math.sqrt(Math.max(0,rate*rate+2*slope*tau)));
      tau-=covered;t=end;
    }
    return t;
  }
  // 同一落区求解不同发射角和旋转；不偷换玩家选择的击球类别。
  function shape(m,p,shot,delta,spin=0,depthGain=0,record=null){
    const s=m.shuttle,env={...old.physEnv.call(m)};delete env.spin;
    const seed=record?{vx:record.vx*p.dir,vy:record.vy}:shot;
    const initial=YY.simulate(s.x,s.y,seed.vx,seed.vy,6,false,false,env);
    const depth=clamp(-p.side*initial.landX+depthGain,1.1,m.halfOf(1-p.idx)-.45);
    const a0=clamp(Math.atan2(seed.vy,Math.abs(seed.vx))*180/Math.PI+delta,-18,72);
    const target=-p.side*depth,dist=Math.abs(target-s.x),curved={...env,spin};
    for(const a of [a0,Math.max(18,a0),Math.max(36,a0)]){
      const speed=YY.solveSpeed(s.x,s.y,p.dir,a,dist,curved);if(!Number.isFinite(speed)||speed>32)continue;
      const rad=a*Math.PI/180,vx=p.dir*speed*Math.cos(rad),vy=speed*Math.sin(rad),pr=YY.simulate(s.x,s.y,vx,vy,6,false,false,curved);
      if(!pr.netHit&&-p.side*pr.landX>.5&&Math.abs(pr.landX)<m.halfOf(1-p.idx)-.1){shot.vx=vx;shot.vy=vy;shot.reason=null;return spin;}
    }
    return 0;
  }
  Object.assign(Match.prototype,{
    newcomerEnt(p,id){return ent(this,p,id);},
    useSkill(p,slot=0,pr){
      if(this.skillsOn&&YY.skillPrepared(this,p,p.kit?.act[slot])&&!YY.skillRecastReady(this,p,p.kit?.act[slot]))return false;
      return old.useSkill.call(this,p,slot,pr);
    },
    castCheck(p,id){
      if(!N_IDS.has(id))return old.castCheck.call(this,p,id);
      if(this.phase!=='rally')return '发球后才能用';
      if(ent(this,p,id))return '技能已经准备好';
      if(id==='jieli_jump'&&!p.onGround)return '落地后才能转体起跳';
      if(id==='dianbu'&&!p.onGround)return '落地后才能滑步';
      if(['yimo','jieli_jump'].includes(id)&&this.mods(p).noJump)return '当前不能起跳';
      if(['yimo','jieli_jump'].includes(id)&&this.shuttle.ctl?.o===p.idx)return '先打出手里的球';
      return null;
    },
    cast(p,id,aim=0,v){
      if(!N_IDS.has(id))return old.cast.call(this,p,id,aim,v);
      v=v||YY.skillVector(id,aim);const x=p.side*clamp(p.side*p.x-v.x*v.r*2.4,.8,this.halfOf(p.idx)-.7);
      const e=add(this,p,id,id==='dianbu'?6:id==='yimo'?4.5:id==='jibei'?10:id==='jieli_jump'?3.5:8,{mode:mode(v)});
      if(id==='jibei'){e.x=v.manual?x:p.x;e.y=0;e.height=0;e.raised=true;}
      if(id==='yimo'){
        const pad=ent(this,p,'jibei'),boost=onFossil(this,p,pad)&&pad.raised&&p.y>=.7;
        e.n=boost?3:2;e.boost=boost;e.targetY=clamp(p.y+.65,.75,2.5);if(boost)e.t=e.T=6;
        p.onGround=false;p.land=0;p.vy=4.8;p.y=Math.max(.04,p.y);p.replan=true;
        ns(p).platform=0;this.addEnt('newskill',p.idx,p.x,p.y,.6,{sid:'wingBurst',boost});
      }
      if(id==='dianbu'){e.n=2;slide(this,p,e,v);}
      if(id==='bianpai'){e.n=2;e.turn=Math.sign(this._skillAim3D?.x)||ns(p).spinTurn||1;}
      if(id==='jieli_jump'){
        p.land=0;old.handlePress.call(this,p,{btn:'jump'});if(!p.onGround){p.vy*=1.16;spinUp(p);e.hang=0;const burst=ent(this,p,'splitBurst');if(burst||ns(p).slideUntil>this.time){p.vx=(ns(p).slideDir||p.dir)*6.5;p.vz=(ns(p).slideZ||0)*6.5;e.driftX=p.vx;e.driftZ=p.vz;ns(p).slideUntil=0;if(burst)this.dropEnt(burst);}}
      }
      if(['tongqin','gongwei','jiaban'].includes(id)){e.n=2;e.t=e.T=9;}
      if(id==='sanbu'){e.n=2;e.t=e.T=9;takeLens(this,p,e);}
      if(id==='yipai'){e.n=2;e.mode=editMode(this,v);}
      if(id==='jingmo')e.n=2;
      if(['dianbu','tongqin','gongwei','jieli_jump','jiaban','sanbu','yipai','jingmo'].includes(id))p.skillCd=Math.min(p.skillCd,.12);
      this.proc(p,id,YY.SKILLS[id].name+' · 就绪');
    },
    recast(p,id,aim,v){
      if(!N_IDS.has(id))return old.recast.call(this,p,id,aim,v);
      const e=ent(this,p,id);if(!e)return false;
      if(this.phase!=='rally')return true; // 分间与发球准备只保留，禁止触发移动或升降。
      v=v||YY.skillVector(id,aim);
      if(id==='yimo'){this.dropEnt(e);p.vy=-2;return true;}
      if(id==='jibei'){e.raised=!e.raised;this.proc(p,id,e.raised?'高台升起':'降台接低球');return true;}
      if(id==='yipai'){e.mode=editMode(this,v)||(e.mode<0?1:-1);this.proc(p,id,e.mode<0?'复映 · 切近':'复映 · 切深');return true;}
      if(id==='bianpai'){e.mode=e.mode>0?-1:1;e.turn=Math.sign(this._skillAim3D?.x)||e.turn;this.proc(p,id,e.mode>0?'燕尾 · 漂长':'燕尾 · 急坠');return true;}
      if(id==='dianbu'){
        if(!p.onGround||this.time<e.cool){this.proc(p,id,'下一段已保留 · 落稳再滑');return true;}
        slide(this,p,e,v);return true;
      }
      return false;
    },
    mods(p){const M=old.mods.call(this,p);if(!this.skillsOn||this.phase!=='rally')return M;
      if(ent(this,p,'yimo')){M.noJump=1;M.move*=1.55;M.accel*=2;M.reach*=1.35;M.timing*=1.2;}
      if(ent(this,p,'weichui'))M.reach*=1.12;
      if(ent(this,p,'jieli_jump')){M.reach*=1.2;M.timing*=1.16;}
      if(this.hasPassive(p,'lvyue')&&activeLens(this,p)){M.move*=1.16;M.accel*=1.26;M.reach*=1.19;}
      if(this.hasPassive(p,'gongxiu')&&ent(this,p,'tongqin')){M.reach*=1.18;M.timing*=1.22;}
      if(MOVE_IDS.some(id=>ent(this,p,id))){M.reach*=1.12;M.timing*=1.12;}
      return M;
    },
    updatePlayer(p,dt){
      const from={x:p.x,y:p.y,z:p.z||0};old.updatePlayer.call(this,p,dt);
      if(this.courtMode!=='3d')this.newcomerMove(p,dt,from);
    },
    newcomerMove(p,dt,from){
      if(!this.skillsOn||this.phase!=='rally')return;
      const before=from.x,beforeY=from.y,st=ns(p),movement=MOVE_IDS.map(id=>ent(this,p,id)).find(Boolean);
      if(movement){
        const u=clamp((movement.age+dt)/movement.T,0,1),x=travel(movement,u,movement.from,movement.to,movement.v0,movement.endV),z=travel(movement,u,movement.fromZ,movement.toZ,movement.vz0,movement.endZ);
        p.x=x.p;p.vx=x.v;if(this.courtMode==='3d'){p.z=z.p;p.vz=z.v;}
        if(!movement.air){const lift=travel(movement,u,movement.y0,0,0);
          p.y=Math.max(0,lift.p+movement.hop*Math.sin(Math.PI*u)**2);p.vy=p.y>0?lift.v+movement.hop*Math.PI*Math.sin(2*Math.PI*u)/movement.T:0;p.onGround=p.y<.025;p.land=0;
        }
        st.movePose={kind:movement.sid,w:Math.sin(Math.PI*u),dir:Math.sign(movement.to-movement.from)*p.dir};
        if(u>=1){if(!movement.air){p.y=0;p.vy=0;p.onGround=true;}this.dropEnt(movement);
        }
      }else if(st.movePose){st.movePose.w*=Math.exp(-22*dt);if(st.movePose.w<.01)delete st.movePose;}
      p.x=p.side*clamp(p.side*p.x,C.X_NEAR,Math.min(C.X_FAR,this.halfOf(p.idx)+.6));
      const glide=ent(this,p,'yimo'),pad=ent(this,p,'jibei'),st0=ns(p);
      const height=fossilHeight(pad),near=onFossil(this,p,pad);
      if(glide){
        const s=this.shuttle,incoming=s.live&&!s.held&&!s.netHit&&s.lastHitter!==p.idx&&p.side*s.x>-.5;
        if(incoming){const pts=this.pred?.pts||[],elapsed=this.time-(this.pred?.t0??this.time);const pt=pts.find(q=>q.t>=elapsed+.18&&p.side*q.x>.15);glide.targetY=clamp((pt?.y??s.y)-C.SHOULDER-.25,.08,2.5);}
        const target=glide.targetY??1,delta=clamp(target-beforeY,-5.5*dt,4.8*dt);
        p.y=clamp(beforeY+delta,.04,2.5);p.vy=delta/dt;p.onGround=false;p.land=0;
        const mv=clamp(this.inputs[p.idx].move||0,-1,1),vx=mv*p.dir*this.maxSpeed(p);
        p.vx=YY.lerp(p.vx,vx,1-Math.exp(-16*dt));p.x=p.side*clamp(p.side*(before+p.vx*dt),C.X_NEAR,this.halfOf(p.idx)+.3);
        st0.platform=0;
      }else if(near&&(p.onGround||st0.platform===pad.id||p.vy<=0&&beforeY>=height&&p.y<=height)){
        p.y=height;p.vy=0;p.onGround=true;p.land=0;st0.platform=pad.id;
      }else if(st0.platform){st0.platform=0;p.onGround=false;p.vy=Math.min(0,p.vy);}
      const roll=ent(this,p,'jieli_jump');if(roll){
        st.turnPose=Math.sin(Math.PI*clamp(roll.age/1.15,0,1));
        if(p.onGround&&roll.age>.2){this.dropEnt(roll);delete st.turnPose;}
        else{if(p.vy<0&&roll.hang<.32){p.vy=Math.max(p.vy,-.65);roll.hang+=dt;}
          if(roll.driftX!=null&&!movement){const mix=1-Math.exp(-3*dt);roll.driftX=YY.lerp(roll.driftX,(this.inputs[p.idx].move||0)*p.dir*this.maxSpeed(p),mix);p.x=before+roll.driftX*dt;p.vx=roll.driftX;
            if(this.courtMode==='3d'){roll.driftZ=YY.lerp(roll.driftZ,(this.inputs[p.idx].strafe||0)*this.maxSpeed(p),mix);p.z=clamp(from.z+roll.driftZ*dt,-2.65,2.65);p.vz=roll.driftZ;}}
        }
      }else delete st.turnPose;
      p.x=p.side*clamp(p.side*p.x,C.X_NEAR,Math.min(C.X_FAR,this.halfOf(p.idx)+.6));
      const dx=Math.hypot(p.x-before,this.courtMode==='3d'?p.z-from.z:0);
      if(this.hasPassive(p,'dingzhou')&&st.travelUntil>this.time){st.travel=(st.travel||0)+dx;if(st.travel>=1.15){spinUp(p);st.travelUntil=0;if((st.recoveries||0)<3){st.recoveries=(st.recoveries||0)+1;p.stamina=Math.min(C.STAM_MAX,p.stamina+4);}}}
      for(const e of this.ents)if(e.k==='newskill'&&e.o===p.idx&&e.sid!=='jibei'){e.x=p.x;e.y=p.y;}
    },
    handlePress(p,pr){
      const ground=p.onGround,platform=ns(p).platform;
      if(pr.btn==='jump'&&ground){const moving=MOVE_IDS.map(id=>ent(this,p,id)).find(Boolean);if(moving)this.dropEnt(moving);}
      old.handlePress.call(this,p,pr);
      if(this.skillsOn&&pr.btn==='jump'&&ground&&!p.onGround&&platform){p.vy*=1.2;ns(p).platform=0;ns(p).fossilAir=this.time+3;add(this,p,'fossilFx',.5);}
    },
    beginSwing(p,...args){return old.beginSwing.call(this,p,...args);},
    skHitQ(p,q,ctx){
      q=old.skHitQ.call(this,p,q,ctx);if(!this.skillsOn)return q;
      if(ent(this,p,'yimo'))return Math.max(q,.86);
      if(this.hasPassive(p,'lvyue')&&activeLens(this,p)&&filmReturn(this,p,ctx))return Math.max(q,.83);
      const pressure=pressureAt(this,p,ctx);if(pressure)return Math.max(q,ent(this,p,'tongqin')?.92:.7+.12*pressure.power);
      return q;
    },
    doHit(p,...args){this.shuttle.nf=null;return old.doHit.call(this,p,...args);},
    skShot(p,shot,ctx){
      old.skShot.call(this,p,shot,ctx);if(!this.skillsOn||ctx.serve||ctx.device||ctx.ownSide)return;
      const st=ns(p),tail=ent(this,p,'weichui'),curve=ent(this,p,'bianpai');
      const originalShot={...shot};let sp=0,rotation=null;const wing=ent(this,p,'yimo');
      if(tail){const charge=clamp(tail.age/.6,.25,1),high=this.shuttle.y>2.6,up=tail.mode||(['clear','lift'].includes(shot.type)?1:-1);sp=shape(this,p,shot,up*(high?14:10)*charge,0,up>0?.25:-.15);ctx.skill='weichui';ctx.big=1;this.dropEnt(tail);add(this,p,'tailFx',.65,{charge,dx:1,dy:up*.6});}
      if((wing||tail)&&boboDive(this,p,shot,!!tail,originalShot)){ctx.skill=tail?'weichui':'yimo';ctx.big=1;ctx.boboDive=true;add(this,p,'diveFx',.65,{tail:!!tail});}
      if(curve||(st.spin||0)>0){
        const n=st.spin||0,setting=curve?.mode||0;
        rotation=rotateShot(this,p,shot,curve?n:n*.45,setting,curve?.turn||st.spinTurn);
        if(rotation){ctx.newcomerSolved=true;sp=rotation.lift*p.dir;ctx.skill=curve?'bianpai':'dingzhou';ctx.big=n===2;
          st.spin=0;if(curve&&--curve.n<=0)this.dropEnt(curve);add(this,p,'curveFx',.55,{mode:Math.sign(rotation.lift),power:n});}
      }
      officeShot(this,p,shot,ctx);
      playEdit(this,p,shot,ctx);
      if(sp||rotation||tail||ctx.boboDive||ctx.edit||ctx.office)ctx.nFlight={spin:sp,curve:rotation,
        fast:ctx.editSpeed||1,owner:p.idx,dive:ctx.boboDive?(tail?2:1):0,
        ...(ctx.edit?{edit:ctx.edit,cutAt:this.time}:{}),
        ...(ctx.office?{office:ctx.office,power:ctx.pressurePower,paper:ctx.officePaper}:{}),
      };
    },
    skAfterHit(p,shot,q,ctx){
      for(const e of this.ents.slice())if(e.sid==='sanbu'&&e.active)clearLens(this,e);
      this.shuttle.nf=null;old.skAfterHit.call(this,p,shot,q,ctx);if(!this.skillsOn||ctx.serve)return;
      // Any return ends the preceding flight's optical modifiers, including devices.
      if(ctx.nFlight){this.shuttle.nf={...ctx.nFlight};this.rePred();}
      if(ctx.device||ctx.ownSide||['zipao','meida','huiguo'].includes(ctx.skill))return;
      if(ctx.pressureReturn){
        const state=ns(p);state.pressure=ctx.pressurePower;state.dispatchAt=this.time;state.dispatchBits=ctx.office||OFFICE.pressure;
        if(p.swing)p.swing.dur=Math.max(p.swing.t+.09,p.swing.dur*.74);
        p.slow*=.78;
        if((state.pressureRest||0)<6){state.pressureRest=(state.pressureRest||0)+1;p.stamina=Math.min(C.STAM_MAX,p.stamina+2);}
      }
      const st=ns(p),wing=ent(this,p,'yimo');if(wing){wing.n--;add(this,p,'wingBurst',.45,{boost:wing.boost});if(wing.n<=0){this.dropEnt(wing);p.vy=-1;this.proc(p,'yimo','猎航结束');}else this.proc(p,'yimo','猎航余 '+wing.n+' 拍');}
      if(this.hasPassive(p,'shihua')&&(st.fossilCount||0)<2){const band=this.shuttle.y<1.3?0:this.shuttle.y<2.8?1:2;st.samples=(st.samples||0)|(1<<band);if(st.samples===7){st.samples=0;st.fossilCount=(st.fossilCount||0)+1;this.gainEnergy(p,8);p.stamina=Math.min(C.STAM_MAX,p.stamina+10);this.proc(p,'shihua','三层采样 +8 能量 / +10 体力');}}
      if(this.hasPassive(p,'dingzhou')){st.travelUntil=this.time+8;st.travel=0;}
      archiveEdit(this,p,shot,ctx);
    },
    touchShuttle(...args){this.shuttle.nf=null;return old.touchShuttle.call(this,...args);},
    physEnv(){const env=old.physEnv.call(this),nf=this.shuttle.nf;if(!this.skillsOn||!nf)return env;return {...env,...(nf.curve?{curve:nf.curve}:nf.spin?{spin:nf.spin}:{}),...(nf.paper?{paper:nf.paper}:{})};},
    shuttleScale(dt=0){
      const base=old.shuttleScale.call(this);if(!freeEditBall(this))return base;
      if(activeLens(this))return base*LENS_RATE; // the receiver's slow cut takes priority over a fast cut
      const f=this.shuttle.nf;
      return base*(f?.fast>1&&dt>0?1+(cutIntegral(f,this.time)-cutIntegral(f,this.time-dt))/dt:cutRate(f,this.time));
    },
    editRealT(tau,pace=1){return filmRealT(this,tau,pace);},
    realT(tau){return this.editRealT(tau)??old.realT.call(this,tau);},
    skStep(dt){
      if(this.phase!=='rally'){
        for(const e of this.ents)if(newPersistent(e)){
          if(Number.isFinite(e.cool))e.cool+=dt;
          if(e.sid!=='jibei'){const p=this.players[e.o];e.x=p.x;e.y=p.y;if(p.z!=null)e.z=p.z;}
        }
      }
      if(this.skillsOn&&this.phase==='rally')for(const e of this.ents)if(e.k==='newskill'&&e.sid==='jibei'){const target=e.raised?1.25:0;e.height=(e.height||0)+clamp(target-(e.height||0),-6*dt,4.2*dt);}
      old.skStep.call(this,dt);if(!this.skillsOn||this.phase!=='rally')return;
      const s=this.shuttle;
      for(const e of this.ents.slice())if(e.sid==='sanbu'){
        if(e.active&&(!freeEditBall(this)||e.hit!==this.hitCount||e.until<=this.time)){
          clearLens(this,e);this.players[e.o].replan=true;
        }else if(!e.active)takeLens(this,this.players[e.o],e);
      }
      if(s.nf&&(!s.live||s.netHit||s.ctl))s.nf=null;
    },
    skPointEnd(...args){
      old.skPointEnd.call(this,...args);
      for(const e of this.ents.slice())if(e.sid==='sanbu'&&e.active)clearLens(this,e);
      this.ents=this.ents.filter(e=>e.k!=='newskill'||newPersistent(e));
      for(const p of this.players)if(p.cnt.nv){delete p.cnt.nv.movePose;delete p.cnt.nv.turnPose;}
      this.shuttle.nf=null;
    },
    skReset(first){
      if(!first)for(const e of this.ents.slice())if(e.sid==='sanbu'&&e.active)clearLens(this,e);
      const carry=this.players.map(p=>{
        const st=p.cnt.nv||{},saved={};
        if(st.spin){saved.spin=st.spin;saved.spinTurn=st.spinTurn;}
        if(st.film)saved.film=st.film;
        if(st.frames)saved.frames=st.frames;
        if(st.lastFilm)saved.lastFilm=st.lastFilm;
        return saved;
      });
      old.skReset.call(this,first);this.shuttle.nf=null;
      if(!first)this.players.forEach((p,i)=>{if(Object.keys(carry[i]).length)p.cnt.nv=carry[i];});
    },
  });
  const ready=YY.skillRecastReady;
  YY.skillRecastReady=(m,p,id)=>N_IDS.has(id)?!!YY.SKILLS[id]?.recast&&!!ent(m,p,id):ready(m,p,id);
  YY.skillPrepared=(m,p,id)=>['tongqin','gongwei','jiaban','sanbu','jingmo'].includes(id)&&!!ent(m,p,id);
  YY.skillRecastWait=(m,p,id)=>Math.max(0,(ent(m,p,id)?.cool||0)-m.time);
  YY.skillRecastText=(m,p,id)=>{
    const e=ent(m,p,id);if(!e)return null;
    const wait=YY.skillRecastWait(m,p,id);if(wait>.05)return wait.toFixed(1)+'s';
    if(['tongqin','gongwei','jiaban','jingmo'].includes(id))return '余 '+e.n+' 拍';
    if(id==='sanbu')return e.active?'取景中':'余 '+e.n+' 球';
    if(id==='yipai')return(e.mode<0?'近剪':e.mode>0?'深剪':'自动')+' '+e.n;
    if(id==='dianbu')return '滑步 '+e.n;
    if(id==='bianpai')return(e.mode>0?'漂长':e.mode<0?'急坠':'双旋')+' '+e.n;
    return null;
  };
  const preview=YY.skillPreview;
  YY.skillPreview=(m,p,id,v)=>{
    if(id==='jibei'){const x=p.side*clamp(p.side*p.x-v.x*v.r*2.4,.8,(m.halfOf?m.halfOf(p.idx):C.HALF)-.7);return{mark:{x,y:0},line:[[x-1,0],[x+1,0]],good:true,label:id==='jibei'?'高点阵地 · 再按升降':'通勤滑行 · 再按换向'};}
    if(['tongqin','gongwei','jiaban'].includes(id))return{mark:{x:p.x,y:p.y+1.4},good:true,label:YY.SKILLS[id].name+' · 两拍 · 普通击球触发'};
    if(id==='bianpai')return{line:[[p.x,p.y+1.4],[p.x+p.dir*2,p.y+1.7],[p.x+p.dir*3,p.y+(mode(v)>0?2.1:.5)]],good:true,label:mode(v)>0?'燕尾漂长 · 两拍 · 再按切换':'燕尾急坠 · 两拍 · 再按切换'};
    if(id==='yipai'){const select=editMode(m,v);return{mark:{x:p.dir*(select<0?1.2:select>0?5.9:3.5),y:0},good:true,label:select<0?'复映 · 切近':select>0?'复映 · 切深':'复映 · 按球路构图'};}
    if(id==='weichui'){const up=mode(v),a=up>0?.8:.15;return{line:[[p.x,p.y+1.4],[p.x+p.dir*1.8,p.y+1.4+a*1.8]],good:true,label:(up>0?'预选高弧':'预选压低')+' · 8 秒内普通击球自动触发'};}
    if(id==='dianbu')return{line:[[p.x,.1],[p.x+(v.x<0?-1:1)*p.dir*2.2,.1]],good:true,label:'滑步积旋 · 第二段保留 6 秒'};
    return preview(m,p,id,v);
  };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof window !== 'undefined' ? window : globalThis);

/* 三位球友重制：视线博弈、篮板二次进攻、过载与熔断。仅模拟层改状态。 */
(function(G){
  'use strict';
  const Y=G.YY,P=Y.Match.prototype,C=Y.C,{clamp,lerp}=Y;
  const IDS=['feibai','liubai','luokuan','ouzhou','gongdan','kongjie','lingxin','kuorong','rongzai'],ids=new Set(IDS);
  const persist=new Set(['feibai','luokuan','lingxin']);
  const old={};for(const k of ['castCheck','cast','recast','mods','skHitQ','skShot','skAfterHit','skStep','skReset','skShuttle','afterHit','updatePlayer','scorePoint','touchShuttle'])old[k]=P[k];
  const state=p=>p.cnt.club||(p.cnt.club={ready:{}});
  const ready=(p,id)=>{const e=p?.cnt?.club?.ready?.[id];return e?.t>0?e:null;};
  const short=t=>['drop','slice','net','tumble','block'].includes(t);
  const manual=(m,p,c)=>m.skillsOn&&!c?.serve&&!c?.device&&!c?.ownSide&&m.shuttle.live&&!m.shuttle.held&&!m.shuttle.ctl&&!m.shuttle.netHit&&((m.shuttle.lastHitter===1-p.idx&&m.shuttle.crossedNet)||(m.shuttle.selfToss===p.idx&&m.shuttle.tossSkill==='gongdan'))&&p.side*m.shuttle.x>0;
  const path=(m,shot)=>m.courtMode==='3d'?Y.simulate3D({...m.shuttle,...shot,netHit:false},m.physEnv(),false):Y.simulate(m.shuttle.x,m.shuttle.y,shot.vx,shot.vy,6,false,false,m.physEnv());
  const legal=(m,p,r)=>r&&!r.netHit&&Number.isFinite(r.landX)&&r.landX*p.dir>.18&&r.landX*p.dir<=m.halfOf(1-p.idx)+C.LINE_TOL&&(m.courtMode!=='3d'||Number.isFinite(r.landZ)&&Math.abs(r.landZ)<=2.59+C.LINE_TOL);
  const consume=(p,id)=>{const e=ready(p,id);if(e&&e.n>0&&--e.n<=0)delete state(p).ready[id];};
  const effect=(m,p,id,label)=>{state(p).fx={id,t:.65};m.proc(p,id,label);};
  const INK=Y.INK_SURGE=Object.freeze({perfect:2,radius:1.8,blind:1.6,burst:.8});
  const SUN=Y.SUN_STYLE=Object.freeze({step:1,air:2,rhythm:4});
  const clockWindow=e=>e?.hot?1.3:.8;
  // Search true, finite trajectories. Only a verified shot replaces the input.
  function riskShot(m,p,shot,mode){
    const s=m.shuttle,space=m.courtMode==='3d',H=m.halfOf(1-p.idx),base=path(m,shot);
    let z=space?clamp(Number.isFinite(base.landZ)?base.landZ:s.z||0,-2.4,2.4):0;
    let depth=mode==='line'?H-.025:Math.min(1.25,H-.5);
    if(space&&mode==='line'){
      const dir=Y.courtDirection(m.inputs[p.idx]);
      if(Math.abs(dir.strafe)>.25){z=Math.sign(dir.strafe)*2.565;depth=clamp(Number.isFinite(base.landX)?base.landX*p.dir:4,1.3,H-.2);}
    }
    const dx=p.dir*depth-s.x,dz=space?z-s.z:0,range=Math.hypot(dx,dz),env={...m.physEnv()};
    // Flight plane is rotated into the selected lane; test the real net afterwards.
    const pe={...env,wind:0};delete pe.curve;delete pe.paper;
    const candidate=a=>{const speed=Y.solveSpeed(space?0:s.x,s.y,space?1:p.dir,a,space?range:Math.abs(p.x)+depth+(s.x-p.x)*-p.dir,space?pe:env),rad=a*Math.PI/180;
      if(!Number.isFinite(speed)||speed>44||speed<.3)return null;
      const v={vx:Math.cos(rad)*speed*(space?dx/range:p.dir),vy:Math.sin(rad)*speed,...(space?{vz:Math.cos(rad)*speed*dz/range}:{})},r=path(m,v);
      if(!legal(m,p,r)||Math.abs(r.landX-p.dir*depth)>.045||(space&&Math.abs(r.landZ-z)>.045))return null;
      return{...v,r};};
    if(mode==='line'){
      for(const a of [shot.type==='smash'?-14:short(shot.type)?24:46,16,32,48,60,70]){const c=candidate(a);if(c)return{vx:c.vx,vy:c.vy,...(space?{vz:c.vz}:{}),target:{x:p.dir*depth,z},mode,net:c.r.netY};}
      return null;
    }
    const clear=(env.netH||C.NET_H)+C.SHUTTLE_R+.045;
    let best=null,lo=-38,hi=74;
    for(let n=0;n<15;n++){
      const a=(lo+hi)/2,c=candidate(a);
      if(c&&Number.isFinite(c.r.netY)&&c.r.netY>=clear){best=c;hi=a;}else lo=a;
    }
    if(best&&best.r.netY<clear+.14)return{vx:best.vx,vy:best.vy,...(space?{vz:best.vz}:{}),target:{x:p.dir*depth,z},mode,net:best.r.netY};
    return null;
  }
  Y.clubRiskShot=riskShot;
  function direction(m,p,reverse=false){
    const input=m.inputs[p.idx],d=m.courtMode==='3d'?Y.courtDirection(input):{move:clamp(input.move||0,-1,1),strafe:0};
    let x=d.move*p.dir,z=d.strafe,n=Math.hypot(x,z);
    if(n<.1){x=(reverse?-1:1)*p.dir;z=0;n=1;}return{x:x/n,z:z/n};
  }
  function dash(m,p,id,amount,reverse=false){
    const d=direction(m,p,reverse),st=state(p);st.dash={x:d.x,z:d.z,t:.27,T:.27,d:amount,id};p.replan=true;
  }
  // Visibility is per observer, never changes hit physics. Shared-screen mode
  // uses the receiver as observer, so a single canvas cannot expose the answer.
  Y.clubInkBlind=function(m,viewer){
    if(!m.skillsOn||m.phase!=='rally')return null;
    const affected=viewer==null?m.players:m.players.filter(p=>p.idx===viewer);
    return affected.map(p=>p.cnt?.club?.inkBlind).find(e=>e?.t>0)||null;
  };
  Y.clubVisibility=function(m,viewer){
    const s=m.shuttle,result={hidden:false,ghost:false,reason:null};
    if(Y.clubInkBlind(m,viewer))return{...result,hidden:true,reason:'墨涌致盲'};
    if(!m.skillsOn||!s.live||s.held||s.netHit||s.ctl||m.phase!=='rally')return result;
    const owner=s.lastHitter;if(owner!==0&&owner!==1)return result;
    const receiving=1-owner,observer=viewer==null?receiving:viewer,f=s.clubShot,age=f?m.time-f.at:99;
    const p=m.players[receiving],near=Math.hypot(s.x-p.x,(s.z||0)-(p.z||0),s.y-p.y-C.SHOULDER)<1.1;
    const vanish=f?.owner===owner&&f.hide&&age>=f.delay&&age<f.delay+f.hide&&!near&&s.y>.65;
    const fog=ready(m.players[owner],'kuorong'),inFog=fog&&s.x*m.players[receiving].side>.08&&s.y>fog.height;
    if(vanish||inFog){result.reason=vanish?'藏羽':'天空迷雾';result.hidden=observer!==owner;result.ghost=observer===owner;}
    return result;
  };
  Y.clubHintHidden=(m,i)=>Y.clubVisibility(m,i).hidden||!!m.shuttle.hide||m.shuttle.veil>0;
  Y.clubInkReady=(m,p)=>!!(m.skillsOn&&m.phase==='rally'&&p.kit?.passive==='moyun'&&p.cnt?.club?.inkReady&&m.shuttle.selfToss!==p.idx);
  P.clubReady=function(p,id){return ready(p,id);};
  // Simulation-owned cue: clients render the same sampled contact window.
  // It never changes hit quality, presses a button or reads concealed paths.
  P.clubTiming=function(p){
    const s=this.shuttle,st=state(p);
    if(!this.skillsOn||!this.hasPassive(p,'moyun')||this.phase!=='rally'||!s.live||s.held||s.netHit||s.ctl||s.lastHitter===p.idx||Y.clubHintHidden(this,p.idx)||p.swing?.hit||p.cooldown>0){delete st.timing;return;}
    if(st.timing&&st.timing.ver===s.ver&&this.time<(st.timingSample||0))return;
    st.timingSample=this.time+.04;
    const pr=this.pred,pts=pr?.pts;if(!pts?.length){delete st.timing;return;}
    const elapsed=this.time-(pr.t0??this.time),reach=this.reachFor(p),speed=Math.hypot(p.vx,p.vz||0);
    let best=null,last=null;
    const threshold=this.courtMode==='3d'?.095:.065;
    for(const q of pts){
      const t=this.realT(Math.max(0,q.t-elapsed));
      if(q.t<elapsed||t<.025||t>.55||q.x*p.side<=C.SHUTTLE_R||q.y<=.25)continue;
      const predicted={...p,x:p.x+p.vx*Math.min(t,.14),z:(p.z||0)+(p.vz||0)*Math.min(t,.14),y:p.onGround?p.y:Math.max(0,p.y+p.vy*t-.5*C.G*t*t)};
      const e=this.ringError(predicted,q),value=e+Math.abs(t-C.SW_SWEET)*.06;
      if(e<threshold){
        // The swept hit test contacts on entering its sweet ring, before the
        // radial-error minimum. Interpolate that entry instead of aiming late.
        const u=last&&last.e>threshold?clamp((last.e-threshold)/(last.e-e),0,1):1;
        best={value,e:threshold,t:last?lerp(last.t,t,u):t,x:last?lerp(last.x,q.x,u):q.x,y:last?lerp(last.y,q.y,u):q.y,z:last?lerp(last.z,q.z||0,u):q.z||0};break;
      }
      if(e<reach*.45&&(!best||value<best.value))best={value,e,t,x:q.x,y:q.y,z:q.z||0};
      last={e,t,x:q.x,y:q.y,z:q.z||0};
    }
    if(!best){delete st.timing;return;}
    const pressAt=this.time+best.t-C.SW_SWEET;
    st.timing={ver:s.ver,pressAt,hitAt:this.time+best.t,x:best.x,y:best.y,z:best.z,stable:speed<1.5&&best.e<reach*.28};
  };
  P.clubStyle=function(p,c,shot){
    if(!this.hasPassive(p,'qiuyou'))return;
    const st=state(p),s=this.shuttle,cat=short(shot.type)?'short':'long',last=st.styleLast;
    const bits=st.styleBits||0,travel=last?Math.hypot(p.x-last.x,(p.z||0)-last.z):0;
    const candidates=[c.clubHoop||!p.onGround&&s.y>=2.4?SUN.air:0,c.clubBuzzer||last&&cat!==last.cat?SUN.rhythm:0,travel>=1.3||this.time-(st.stepAt??-99)<1.5?SUN.step:0];
    const badge=candidates.find(n=>n&&!(bits&n));
    if(!st.hot&&badge){
      st.styleBits=bits|badge;
      if((st.styleBits&(st.styleBits-1))!==0){st.hot=true;st.styleBits=0;effect(this,p,'qiuyou','三威胁 · 热手就绪');}
      else effect(this,p,'qiuyou',badge===SUN.air?'空接 · 集另一种花式':badge===SUN.rhythm?'节奏 · 集另一种花式':'突破 · 集另一种花式');
    }
    st.styleLast={cat,x:p.x,z:p.z||0};delete st.stepAt;
  };
  P.castCheck=function(p,id){
    if(!ids.has(id))return old.castCheck.call(this,p,id);
    if(this.phase!=='rally')return '发球后才能用';
    if(ready(p,id))return '技能已就绪 · 按提示衔接';
    if(['liubai','ouzhou'].includes(id)&&(!p.onGround||p.buff.prone>0||this.mods(p).fix))return '落地站稳后使用';
    if(id==='rongzai'&&(p.buff.prone>0||this.mods(p).fix))return '先恢复站姿再反压';
    return null;
  };
  P.cast=function(p,id,...args){
    if(!ids.has(id))return old.cast.call(this,p,id,...args);
    const def=Y.SKILLS[id],st=state(p),e=st.ready[id]={t:def.dur,n:def.charges||0};
    p.skillCd=.18;p.replan=true;st.fx={id,t:.65};
    if(this.hasPassive(p,'qiuyou')&&st.hot&&['ouzhou','gongdan','kongjie'].includes(id)){e.hot=true;st.hot=false;effect(this,p,'qiuyou','热手强化 · '+def.short);}
    if(id==='luokuan')e.mode='line';
    if(id==='liubai'){
      st.silhouette={x:p.x,y:p.y,z:p.z||0,t:1.15};dash(this,p,id,1.15,true);
    }
    if(id==='ouzhou'){e.second=true;e.steps=e.hot?2:1;e.first=direction(this,p);dash(this,p,id,1.35);}
    if(id==='gongdan'){
      const predicted=!Y.clubVisibility(this,p.idx).hidden&&this.pred?.pts?.find(q=>q.y>.7&&q.y<2.2&&q.x*p.side>.55&&q.t-(this.time-(this.pred.t0||0))>.22);
      e.x=p.side*clamp(predicted?p.side*predicted.x:Math.abs(p.x)-.65,.65,this.halfOf(p.idx)-.3);e.z=clamp(predicted?.z??p.z??0,-2.5,2.5);e.y=1.2;e.warm=.22;e.n=e.hot?2:1;if(e.hot)e.t=8;
    }
    if(id==='kongjie'&&e.hot)e.t=4;
    if(id==='kuorong'){e.height=2.6;e.lowered=false;e.at=this.time;}
    if(id==='rongzai'){
      delete st.overload;delete st.inkBlind;p.cooldown=0;p.slow=0;p.bufferedShot=null;p.bufferT=0;
      if(p.swing&&(p.swing.hit||p.swing.t>=C.SW_W1))p.swing=null;
      st.counterFx={t:.55,T:.55};
    }
  };
  P.recast=function(p,id,...args){
    if(!ids.has(id))return old.recast.call(this,p,id,...args);
    const e=ready(p,id),st=state(p);if(!e||this.phase!=='rally')return false;
    if(id==='luokuan'){e.mode=e.mode==='line'?'net':'line';effect(this,p,id,e.mode==='line'?'落款 · 压线':'落款 · 贴网');return true;}
    if(id==='kuorong'&&!e.lowered){e.lowered=true;e.height=1.95;if(st.cache>0)st.cache--;else e.t=Math.max(.2,e.t-2);effect(this,p,id,'雾幕下沉 · 低于 1.95 米显形');return true;}
    if(id==='ouzhou'&&e.second&&p.onGround&&!st.dash){e.steps=Math.max(0,(e.steps??1)-1);e.second=e.steps>0;e.t=e.second?1.25:.45;dash(this,p,id,e.second?1.65:e.hot?1.2:1.65);effect(this,p,id,e.hot&&!e.second?'热手 · 第三步':'换手切入');return true;}
    return false;
  };
  P.mods=function(p){
    const M=old.mods.call(this,p);if(!this.skillsOn||this.phase!=='rally')return M;
    const debt=p.cnt.club?.overload;if(debt?.n>0&&debt.t>0)M.swing*=1.28;
    if(ready(p,'rongzai')){M.reach*=1.14;M.timing*=1.18;}
    return M;
  };
  P.skHitQ=function(p,q,c){
    q=old.skHitQ.call(this,p,q,c);
    if(manual(this,p,c)&&p.cnt.club?.overload?.n>0)q=clamp(q-.16,0,1);
    if(manual(this,p,c)&&ready(p,'rongzai'))q=Math.max(q,.86);
    c.clubQ=q;return q;
  };
  P.skShot=function(p,shot,c){
    const eligible=manual(this,p,c),s=this.shuttle,oldFlight=s.clubShot;
    old.skShot.call(this,p,shot,c);if(!eligible)return;
    c.clubReturn=true;c.clubUsed=[];c.clubIncoming=oldFlight?.owner===1-p.idx?{...oldFlight}:null;
    const st=state(p),risk=ready(p,'luokuan'),clock=ready(p,'kongjie'),q=c.clubQ??p.swing?.q??.7;
    const buzzer=clock&&clock.t<=clockWindow(clock);c.clubBuzzer=!!buzzer;
    if(ready(p,'rongzai')){c.clubUsed.push('rongzai');c.clubCounter={cache:st.cache||0,rush:clamp(.26+Math.max(0,(c.incomingSpeed||0)-10)*.018+(st.cache||0)*.12,.26,.75)};}
    // Read the already-earned charge before this hit earns perfect progress.
    c.clubInkEligible=this.hasPassive(p,'moyun')&&s.selfToss!==p.idx;
    c.clubInk=c.clubInkEligible&&!!st.inkReady;
    if(risk||buzzer){
      const mode=risk?.mode||(short(shot.type)?'net':'line');
      const v=q>=.55?riskShot(this,p,shot,mode):null;
      if(v){Object.assign(shot,{vx:v.vx,vy:v.vy,...(this.courtMode==='3d'?{vz:v.vz}:{}),reason:null});c.clubRisk=v;c.newcomerSolved=true;}
      this.spend(p,q>=.85?0:8*this.costMul(p,true));
      if(risk)c.clubUsed.push('luokuan');if(buzzer)c.clubUsed.push('kongjie');
      if(!v)effect(this,p,risk?'luokuan':'kongjie','险球失准 · 保留原球路');
    }
    if(ready(p,'feibai')){c.clubUsed.push('feibai');c.clubHide=.36;}
    if(ready(p,'liubai')){c.clubUsed.push('liubai');c.clubDecoy=.6;}
    if(ready(p,'lingxin')){c.clubUsed.push('lingxin');c.clubLoad=true;}
    c.clubHoop=s.tossSkill==='gongdan'&&s.selfToss===p.idx;
    if(c.clubUsed.length)c.skill=c.clubUsed.at(-1);
  };
  P.touchShuttle=function(p,...args){
    const ink=this.clubInkContact(p);this.shuttle.clubShot=null;
    const result=old.touchShuttle.call(this,p,...args);if(ink)this.clubInkBurst(p,ink);return result;
  };
  P.afterHit=function(p,shot,q,c){
    const incoming=this.shuttle.clubShot;
    if(!c.clubIncoming&&incoming?.owner===1-p.idx)c.clubIncoming={...incoming};
    const ink=this.clubInkContact(p,c);
    this.shuttle.clubShot=null;
    old.afterHit.call(this,p,shot,q,c);
    if(ink)this.clubInkBurst(p,ink);
  };
  P.skAfterHit=function(p,shot,q,c){
    old.skAfterHit.call(this,p,shot,q,c);
    if(!this.skillsOn||!c.clubReturn)return;
    const st=state(p),s=this.shuttle;
    // Receiving this ball applies a new debt AFTER this stroke. The next two
    // successful manual returns are slower/weaker; empty swings do not pay it off.
    if(st.overload?.n>0){this.spend(p,(short(shot.type)?2:4)*this.costMul(p,true));if(--st.overload.n<=0){delete st.overload;effect(this,p,'lingxin','负载清空');}}
    if(c.clubIncoming?.load){
      if(!c.clubCounter){this.spend(p,12*this.costMul(p,true));st.overload={n:2,t:9,owner:c.clubIncoming.owner};}
      else c.clubCounter.rush=Math.min(.85,c.clubCounter.rush+.1);
      const sender=this.players[c.clubIncoming.owner];if(this.hasPassive(sender,'guance'))state(sender).cache=Math.min(2,(state(sender).cache||0)+1);
      effect(this,p,c.clubCounter?'rongzai':'lingxin',c.clubCounter?'熔断 · 吸收过载':'过载 · 接下来两拍迟缓');
    }
    for(const id of c.clubUsed||[])consume(p,id);
    if(c.clubHide||c.clubLoad||c.clubRisk||c.clubInk||c.clubCounter)s.clubShot={owner:p.idx,at:this.time,delay:.16,hide:c.clubHide||0,load:!!c.clubLoad,ink:!!c.clubInk,counter:!!c.clubCounter,risk:c.clubRisk?{mode:c.clubRisk.mode,...c.clubRisk.target}:null};
    if(c.clubUsed.includes('kongjie')&&c.clubRisk){s.rush=.42;effect(this,p,'kongjie','压哨出手！');}
    if(c.clubCounter){
      st.cache=0;delete st.overload;delete st.inkBlind;s.rush=Math.max(s.rush||0,c.clubCounter.rush);
      p.stamina=Math.min(C.STAM_MAX,p.stamina+c.clubCounter.cache*4);if(p.swing)p.swing.dur=Math.max(p.swing.t+.09,p.swing.dur*.72);
      st.counterFx={t:.55,T:.55};effect(this,p,'rongzai','熔断反压 · 快回一拍');
    }
    if(c.clubDecoy){
      const target=short(shot.type)?this.halfOf(1-p.idx)-.7:1.3,angle=short(shot.type)?48:22;
      const v=this.courtMode==='3d'?Y.solveShot3D(s,{x:p.dir*target,z:clamp(-(this.pred?.landZ??p.z??0),-2.2,2.2)},short(shot.type)?'clear':'drop',1,this.physEnv()):(()=>{const[vx,vy]=this.launchFrom(s.x,s.y,p.dir,angle,target,.12);return{vx,vy};})();
      st.decoy={x:s.x,y:s.y,z:s.z||0,...v,space3D:this.courtMode==='3d',live:true,t:c.clubDecoy,life:c.clubDecoy,age:0,o:p.idx};this.players[1-p.idx].fooled=true;effect(this,p,'liubai','回眸 · 虚实双线');
    }
    if(c.clubUsed.length)st.fx={id:c.clubUsed.at(-1),t:.65};
    if(c.clubInkEligible){
      if(c.clubInk){st.inkReady=false;effect(this,p,'moyun','墨涌 · 此球附墨');}
      if(q>=.85){
        st.inkCount=Math.min(INK.perfect,(st.inkCount||0)+1);
        if(st.inkCount===INK.perfect){st.inkCount=0;st.inkReady=true;effect(this,p,'moyun','墨涌蓄满 · 下一拍附墨');}
      }
    }
    if(this.hasPassive(p,'guance')&&(c.incomingSpeed>=18||s.y>=2.6)&&(st.cache||0)<2){st.cache=(st.cache||0)+1;effect(this,p,'guance','峰值接球 · 缓存 +1');}
    this.clubStyle(p,c,shot);delete st.timing;
  };
  P.updatePlayer=function(p,dt){
    old.updatePlayer.call(this,p,dt);
    const d=p.cnt.club?.dash;if(!this.skillsOn||this.phase!=='rally'||!d)return;
    if(!p.onGround||this.mods(p).fix||p.buff.prone>0){delete p.cnt.club.dash;return;}
    const before=d.t/T(d),after=clamp((d.t-dt)/T(d),0,1),ease=u=>u*u*(3-2*u),distance=(ease(before)-ease(after))*d.d;
    p.x=p.side*clamp(p.side*(p.x+d.x*distance),C.X_NEAR,this.halfOf(p.idx)+.3);
    if(this.courtMode==='3d')p.z=clamp((p.z||0)+d.z*distance,-3.05,3.05);
    d.t-=dt;if(d.t<=0){if(d.id==='ouzhou')p.cnt.club.stepAt=this.time;delete p.cnt.club.dash;}
  };
  function T(d){return d.T||.27;}
  // Capture at a confirmed opposing hit, before ownership and shot tags change.
  // Release after the return is resolved so blindness cannot alter that stroke.
  P.clubInkContact=function(p,c={}){
    const s=this.shuttle,f=s.clubShot;
    if(!this.skillsOn||this.phase!=='rally'||!f?.ink||f.owner!==1-p.idx||f.owner!==s.lastHitter||!s.live||s.held||s.netHit||c.serve||c.ownSide||s.selfToss===p.idx||s.x*p.side<=0)return null;
    f.ink=false;
    return{owner:f.owner,x:s.x,y:s.y,z:this.courtMode==='3d'?s.z||0:0};
  };
  P.clubInkBurst=function(p,{owner:idx,x,y,z}){
    const owner=this.players[idx];
    state(owner).inkBurst={x,y,z,t:INK.burst,T:INK.burst,r:INK.radius};
    const hit=Math.hypot(p.x-x,p.y+1-y,this.courtMode==='3d'?(p.z||0)-z:0)<=INK.radius;
    if(hit)state(p).inkBlind={t:INK.blind,T:INK.blind,owner:idx};
    this.proc(owner,'moyun',hit?'墨涌 · 溅墨致盲':'墨涌 · 溅墨',{inkBurst:true,x,y,z});
  };
  P.skShuttle=function(previous,result){
    const handled=old.skShuttle.call(this,previous,result);if(handled||!this.skillsOn)return handled;
    const s=this.shuttle;if(!s.live||s.held||s.netHit||s.ctl||!s.crossedNet)return false;
    for(const p of this.players){const e=ready(p,'gongdan');if(!e||e.warm>0||s.lastHitter===p.idx||s.x*p.side<=.1||s.vy>=0)continue;
      const a={x:previous?.x??s.x,y:previous?.y??s.y,z:previous?.z??this._previous3D?.z??s.z??0},b={x:s.x,y:s.y,z:s.z||0},delta=[b.x-a.x,b.y-a.y,b.z-a.z];
      const n=delta.reduce((sum,v)=>sum+v*v,0)||1,u=clamp(((e.x-a.x)*delta[0]+(e.y-a.y)*delta[1]+(e.z-a.z)*delta[2])/n,0,1);
      const x=lerp(a.x,b.x,u),y=lerp(a.y,b.y,u),z=lerp(a.z,b.z,u);
      if(Math.hypot(x-e.x,(y-e.y)*.7,z-e.z)>.85)continue;
      const ink=this.clubInkContact(p);
      Object.assign(s,{x,y:Math.max(.85,y),z,vx:clamp((p.x+p.dir*.35-x)*1.6,-3.2,3.2),vy:5.8,vz:clamp(((p.z||0)-z)*1.6,-3,3),netHit:false,crossedNet:false,ctl:null,lastHitter:p.idx,selfToss:p.idx,tossSkill:'gongdan',clubShot:null});
      s.ver++;this.hitCount++;if(--e.n<=0)delete state(p).ready.gongdan;else e.warm=.45;this.rePred();
      this.emit({type:'hit',p:p.idx,shot:'lift',name:'篮板空接',q:.8,x:s.x,y:s.y,z:s.z,vx:s.vx,vy:s.vy,vz:s.vz,skill:'gongdan',device:true});effect(this,p,'gongdan','篮板托起 · 自己起跳扣下');if(ink)this.clubInkBurst(p,ink);return true;
    }return false;
  };
  P.skStep=function(dt){
    old.skStep.call(this,dt);if(!this.skillsOn||this.phase!=='rally')return;
    for(const p of this.players){const st=p.cnt.club;if(!st)continue;
      for(const[id,e]of Object.entries(st.ready)){e.t=Math.max(0,e.t-dt);if(e.warm>0)e.warm-=dt;if(!e.t){if(id==='kongjie'){if(!e.hot)this.spend(p,6*this.costMul(p,true));effect(this,p,id,e.hot?'热手压哨 · 安全落幕':'压哨超时 · 失去 6 体力');}delete st.ready[id];}}
      for(const key of ['fx','overload','silhouette','inkBlind','inkBurst','counterFx'])if(st[key]&&(st[key].t-=dt)<=0)delete st[key];
      if(st.decoy){const d=st.decoy;d.t-=dt;d.age+=dt;const r=Y.stepShuttle(d,dt*this.shuttleScale(),this.physEnv());if(r==='floor'||r==='net'||d.t<=0)delete st.decoy;}
      this.clubTiming(p);
    }
  };
  P.skReset=function(first){
    const carry=this.players.map(p=>Object.fromEntries(Object.entries(p.cnt.club?.ready||{}).filter(([id])=>persist.has(id))));
    const ink=this.players.map(p=>({inkCount:p.cnt.club?.inkCount||0,inkReady:!!p.cnt.club?.inkReady}));
    const heat=this.players.map(p=>!!p.cnt.club?.hot);
    old.skReset.call(this,first);this.shuttle.clubShot=null;
    this.players.forEach((p,i)=>{p.cnt.club={ready:first?{}:carry[i],...(!first?{...ink[i],hot:heat[i]}:{})};});
  };
  P.scorePoint=function(...args){const value=old.scorePoint.apply(this,args);this.shuttle.clubShot=null;for(const p of this.players){const st=p.cnt.club;if(st){for(const key of ['overload','dash','decoy','silhouette','inkBlind','inkBurst','cache','styleBits','styleLast','stepAt','timing','counterFx'])delete st[key];for(const id of Object.keys(st.ready))if(!persist.has(id))delete st.ready[id];}}return value;};
  const prepared=Y.skillPrepared,recastReady=Y.skillRecastReady,text=Y.skillRecastText;
  Y.skillPrepared=(m,p,id)=>ids.has(id)?!!ready(p,id):prepared(m,p,id);
  Y.skillRecastReady=(m,p,id)=>ids.has(id)?m.phase==='rally'&&!!ready(p,id)&&(id==='luokuan'||id==='kuorong'&&!ready(p,id).lowered||id==='ouzhou'&&ready(p,id).second):recastReady(m,p,id);
  Y.skillRecastText=(m,p,id)=>{const e=ready(p,id);if(!e)return text(m,p,id);if(id==='luokuan')return e.mode==='line'?'压线 · 再按贴网':'贴网 · 再按压线';if(id==='kuorong')return e.height+'m · '+Math.ceil(e.t)+'s';if(id==='rongzai')return '手动接球反压';if(id==='ouzhou')return e.second?'再按换手'+(e.steps>1?' ×'+e.steps:''):'换手完成';if(id==='kongjie')return e.t<=clockWindow(e)?'压哨！':e.t.toFixed(1)+'s';if(id==='gongdan')return '篮板余 '+e.n+' 次';return '下一拍';};
  const pack=Y.skPack,unpack=Y.skUnpack;
  Y.skPack=function(m){const out=pack(m);if(out)out.cf=m.shuttle.clubShot?{...m.shuttle.clubShot}:null;return out;};
  Y.skUnpack=function(v,...args){unpack(v,...args);const k=args[1]??args[0];v.shuttle.clubShot=k?.cf?{...k.cf}:null;};
})(typeof GameGlobal!=='undefined'?GameGlobal:typeof window!=='undefined'?window:globalThis);

/* Ribbon atelier and clockwork clutch. State is shared by authority and guests. */
(function(G){
  'use strict';
  const Y=G.YY,P=Y.Match.prototype,{clamp,lerp}=Y,C=Y.C;
  const old={};for(const k of ['castCheck','cast','recast','updatePlayer','skHitQ','skAfterHit','skShuttle','skStep','skReset','scorePoint','yoyoCatch','yoyoRelease','skControl'])old[k]=P[k];
  const ownBow=(m,p)=>(m.ents||[]).find(e=>e.k==='bow'&&e.o===p.idx&&e.t>0),state=p=>p.cnt.ribbon||(p.cnt.ribbon={});
  const fx=(m,p,id,x=p.x,y=p.y+.3,extra={})=>m.addEnt('atelier',p.idx,x,y,.65,{sid:id,z:p.z||0,...extra});
  const manual=c=>!c.serve&&!c.device&&!c.ownSide;
  function direction(m,p,v){
    const i=m.inputs?.[p.idx]||{},spatial=m.courtMode==='3d';
    let x=spatial?(i.move||0)*p.dir:(v?.manual?v.x:i.move||0)*p.dir,z=spatial?(i.strafe||0):0;
    if(Math.hypot(x,z)<.15){const s=m.shuttle,incoming=(m.incomingTo?m.incomingTo(p):s.live&&s.lastHitter!==p.idx)&&!s.ctl;x=incoming?s.x-p.x-p.dir*.6:p.dir;z=spatial&&incoming?(s.z||0)-(p.z||0):0;}
    const n=Math.hypot(x,z)||1;return{x:x/n,z:z/n};
  }
  P.ribbonDash=function(p,v,second=false){
    const st=state(p),d=direction(this,p,v),length=second?1.8:1.55;
    st.dash={t:.3,T:.3,x:p.x,z:p.z||0,to:p.side*clamp(p.side*(p.x+d.x*length),C.X_NEAR,this.halfOf(p.idx)+.15),toZ:clamp((p.z||0)+d.z*length,-2.85,2.85),dx:d.x,dz:d.z};
    st.stepUntil=this.time+2.5;st.window=this.time+2.1;st.second=second;p.skillCd=.14;p.land=0;p.cooldown=Math.min(p.cooldown,.035);
    fx(this,p,'tangqiu',p.x,.12,{to:st.dash.to,toZ:st.dash.toZ,second});this.proc(p,'tangqiu',second?'解结 · 折返穿花':'穿花步 · 自己衔接下一拍');
  };
  P.castCheck=function(p,id){
    if(this.phase!=='rally')return old.castCheck.call(this,p,id);
    if(id==='tangqiu')return !p.onGround?'落地后才能穿花':p.cnt.ribbon?.dash?'正在穿花':this.mods(p).fix||p.buff.prone>0?'站稳后才能穿花':null;
    if(id==='jiewang')return p.buff.silkReady>0?'蝶结弹弓已经备好':!ownBow(this,p)?'先用网前球系一个蝴蝶结':null;
    return old.castCheck.call(this,p,id);
  };
  P.cast=function(p,id,aim,v){
    v=v||Y.skillVector(id,aim);
    if(id==='tangqiu'){this.ribbonDash(p,v);return;}
    if(id==='jiewang'){const bow=ownBow(this,p);if(!bow)return;this.dropEnt(bow);p.skillCd=.14;p.buff.silkReady=6;state(p).deep=(aim||0)<-.25;fx(this,p,id,0,C.NET_H,{z:bow.z||0,deep:state(p).deep});this.proc(p,id,state(p).deep?'蝶结上弦 · 挑后场':'蝶结上弦 · 压网前');return;}
    old.cast.call(this,p,id,aim,v);
    if(id==='hongxian')fx(this,p,id,p.x,p.y+1.2);
    if(id==='youyou'){const e=this.entOf('yoyo',p.idx);if(e){e.clockwork=1;e.spin=0;}fx(this,p,id,p.x,p.y+1.45);}
  };
  P.recast=function(p,id,aim,v){
    if(id==='tangqiu'){const st=state(p),bow=ownBow(this,p);if(st.window>this.time&&!st.second){if(st.dash||!p.onGround)return true;if(!bow)return false;this.dropEnt(bow);this.ribbonDash(p,v,true);return true;}return false;}
    if(id==='jiewang'&&p.buff.silkReady>0){const st=state(p);st.deep=!st.deep;this.proc(p,id,st.deep?'弹弓 · 挑后场':'弹弓 · 压网前');return true;}
    if(id==='youyou'){const e=this.entOf('yoyo',p.idx);if(e?.ph===3&&e.clockwork){this.yoyoSling(p,e,v);return true;}}
    return old.recast.call(this,p,id,aim,v);
  };
  P.ribbonMove=function(p,dt){
    const st=p.cnt.ribbon,d=st?.dash;if(!d||!this.skillsOn||this.phase!=='rally')return;
    if(this.mods(p).fix||p.buff.prone>0){delete st.dash;return;}
    d.t=Math.max(0,d.t-dt);const u=1-d.t/d.T,e=u*u*(3-2*u),v=6*u*(1-u)/d.T;
    p.x=lerp(d.x,d.to,e);p.vx=(d.to-d.x)*v;if(this.courtMode==='3d'){p.z=lerp(d.z,d.toZ,e);p.vz=(d.toZ-d.z)*v;}
    p.y=.13*Math.sin(Math.PI*u)**2;p.vy=.13*Math.PI*Math.sin(2*Math.PI*u)/d.T;p.onGround=u>=1;p.land=0;
    if(!d.t){p.y=0;p.vy=0;p.onGround=true;delete st.dash;}
  };
  P.updatePlayer=function(p,dt){old.updatePlayer.call(this,p,dt);if(this.courtMode!=='3d')this.ribbonMove(p,dt);};
  P.skHitQ=function(p,q,c){q=old.skHitQ.call(this,p,q,c);if(this.skillsOn&&manual(c)&&p.cnt.ribbon?.stepUntil>this.time)q=Math.max(q,.8);return q;};
  P.skAfterHit=function(p,shot,q,c){
    old.skAfterHit.call(this,p,shot,q,c);const s=this.shuttle;s.silkShot=null;if(!this.skillsOn||!manual(c))return;
    const st=p.cnt.ribbon;if(st?.stepUntil>this.time){st.stepUntil=0;fx(this,p,'tangqiu',s.x,s.y,{z:s.z||0});}
    if(p.buff.silkReady>0){p.buff.silkReady=0;s.silkShot={o:p.idx,deep:!!st?.deep,z:this.courtMode==='3d'?clamp(this.shotTarget(p,'drop').z,-2.1,2.1):0};fx(this,p,'jiewang',s.x,s.y,{z:s.z||0,deep:s.silkShot.deep});this.proc(p,'jiewang',s.silkShot.deep?'丝路已定 · 过网挑长':'丝路已定 · 过网压短');}
  };
  P.skShuttle=function(previous,result){
    const s=this.shuttle,f=s.silkShot,handled=old.skShuttle.call(this,previous,result);
    if(handled||!f||!this.skillsOn||this.phase!=='rally'||!s.live||s.ctl||s.netHit||f.o!==s.lastHitter)return handled;
    const p=this.players[f.o];if(previous&&previous.x*p.side>=0&&s.x*p.side<0){
      s.silkShot=null;if(s.y>C.NET_H+1.8){this.proc(p,'jiewang','球路太高 · 蝶结散开');return handled;}
      const depth=f.deep?this.halfOf(1-p.idx)-.7:1.05,type=f.deep?'lift':'drop';
      if(this.courtMode==='3d')Object.assign(s,Y.solveShot3D(s,{x:p.dir*depth,z:f.z},type,1,this.physEnv()));else [s.vx,s.vy]=this.launchFrom(s.x,s.y,p.dir,f.deep?62:-12,depth,.12);
      s.ver++;s.speed=Math.hypot(s.vx,s.vy,s.vz||0);this.rePred();fx(this,p,'jiewang',s.x,s.y,{z:s.z||0,burst:1,deep:f.deep});this.proc(p,'jiewang',f.deep?'蝶结弹弓 · 越顶':'蝶结弹弓 · 急坠');
    }return handled;
  };
  P.yoyoCatch=function(p,e){old.yoyoCatch.call(this,p,e);if(e.clockwork){p.skillCd=Math.min(p.skillCd,.06);e.catchAt=this.time;e.charge=0;this.shuttle.ctl.t=1.35;fx(this,p,'youyou',e.x,e.y,{z:e.z||0,burst:1});this.proc(p,'youyou','棘轮锁球 · 再按张弦弹射');}};
  P.yoyoSling=function(p,e,v){
    const s=this.shuttle;if(s.ctl?.k!=='yoyo'||s.ctl.e!==e.id)return;
    const age=this.time-e.catchAt,perfect=age>=.12&&age<=.42,deep=this.courtMode==='3d'?(this.inputs[p.idx]?.move||0)<-.25:v?.manual?(v.y>.45||v.x<-.25):(this.inputs[p.idx]?.move||0)<-.25;
    const target=deep?this.halfOf(1-p.idx)-.65:1.25,shot=deep?(perfect?'flatclear':'lift'):s.y>1.8?(perfect?'drive':'drop'):'lift';
    s.ctl=null;s.x=e.x;s.y=e.y;if(this.courtMode==='3d')s.z=e.z??s.z;
    if(this.courtMode==='3d')Object.assign(s,Y.solveShot3D(s,{x:p.dir*target,z:clamp(this.shotTarget(p,shot).z,-2.2,2.2)},shot,perfect?1.12:1,this.physEnv()));else [s.vx,s.vy]=this.launchFrom(s.x,s.y,p.dir,deep?(perfect?38:56):s.y>1.8?(perfect?2:15):48,target,.15);
    this.afterHit(p,{type:shot},perfect?.94:.8,{skill:'youyou',device:true,big:perfect?1:0});e.ph=2;e.released=1;this.startRecall(p,e.dx*p.dir>=0?1:-1,e);
    if(this.hasPassive(p,'jixie'))p.buff.overclock=3;fx(this,p,'youyou',s.x,s.y,{z:s.z||0,burst:1,perfect});this.emit({type:'skillMotion',p:p.idx,id:'youyou',stage:'clutch'});this.proc(p,'youyou',perfect?'咔嗒！精准合齿':'飞轮弹射');
  };
  P.yoyoRelease=function(p,e){if(this.courtMode==='3d'&&e.z!=null)this.shuttle.z=e.z;old.yoyoRelease.call(this,p,e);};
  P.skControl=function(dt){
    const c=this.shuttle.ctl,e=c?.k==='yoyo'?this.ents.find(e=>e.id===c.e):null;
    if(e?.clockwork&&e.ph===3){e.charge=clamp((this.time-e.catchAt)/.42,0,1);if(this.time-e.catchAt<.46){c.t-=dt;this.shuttle.x=e.x;this.shuttle.y=e.y;if(this.courtMode==='3d')this.shuttle.z=e.z||0;return;}}
    old.skControl.call(this,dt);
  };
  P.skStep=function(dt){old.skStep.call(this,dt);if(this.phase!=='rally')return;if(this.shuttle.silkShot&&(!this.shuttle.live||this.shuttle.netHit||this.shuttle.ctl||this.shuttle.lastHitter!==this.shuttle.silkShot.o))this.shuttle.silkShot=null;for(const e of this.ents)if(e.k==='yoyo'&&e.clockwork)e.spin=(e.spin||0)+dt*(e.ph===3?24:14);};
  P.skReset=function(...a){old.skReset.apply(this,a);this.shuttle.silkShot=null;for(const p of this.players)delete p.cnt.ribbon;};
  P.scorePoint=function(...a){const r=old.scorePoint.apply(this,a);this.shuttle.silkShot=null;for(const p of this.players){delete p.cnt.ribbon;p.buff.silkReady=0;}return r;};
  const ready=Y.skillRecastReady,text=Y.skillRecastText,prepared=Y.skillPrepared,preview=Y.skillPreview;
  Y.skillRecastReady=(m,p,id)=>id==='tangqiu'?!!(p.cnt.ribbon?.window>m.time&&!p.cnt.ribbon.second&&ownBow(m,p)):id==='jiewang'?p.buff.silkReady>0:ready(m,p,id);
  Y.skillPrepared=(m,p,id)=>id==='jiewang'?p.buff.silkReady>0:prepared(m,p,id);
  Y.skillRecastText=(m,p,id)=>id==='tangqiu'&&Y.skillRecastReady(m,p,id)?'解结折返':id==='jiewang'&&p.buff.silkReady>0?(p.cnt.ribbon?.deep?'挑后场':'压网前'):id==='youyou'&&(m.ents||[]).find(e=>e.k==='yoyo'&&e.o===p.idx)?.ph===3?'张弦弹射':text(m,p,id);
  Y.skillPreview=function(m,p,id,v){if(id==='tangqiu'){const d=direction(m,p,v),x=p.side*clamp(p.side*(p.x+d.x*1.55),C.X_NEAR,m.halfOf(p.idx)+.15);return{line:[[p.x,.1],[x,.1]],mark:{x,y:.1},label:'穿花接近 · 有结可再按折返',good:true};}if(id==='jiewang')return{mark:{x:0,y:C.NET_H},label:'消耗一个蝴蝶结 · 下一拍过网变线',good:!!ownBow(m,p)||p.buff.silkReady>0};if(id==='hongxian'&&m.shuttle.ctl?.k==='tether')return{mark:{x:p.dir*(v.manual&&(v.x<-.25||v.y>.45)?m.halfOf(1-p.idx)-.7:1.2),y:0},label:v.manual&&(v.x<-.25||v.y>.45)?'回旋挑长':'回旋压短',good:true};return preview(m,p,id,v);};
})(typeof GameGlobal!=='undefined'?GameGlobal:typeof window!=='undefined'?window:globalThis);
