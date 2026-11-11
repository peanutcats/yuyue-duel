/* 羽跃对决 · 故事模式：关卡索引、知识图鉴、步法与发球训练。
 * 剧本见 campaign.js；新增知识见 knowledge.js；调查 / 战术板 / 实验见 story-play.js。
 * 十六根羽毛：丁丁的夏天。主线使用独立存档，不迁移旧故事。
 */
(function (G) {
  'use strict';
  const YY = G.YY;
  const C = YY.C;
  const { rand, clamp } = YY;

  // ---------- 知识图鉴 ----------
  const CARD_CATS = { gear: ['器材', '#5cc8ff'], tech: ['技术', '#7dffb0'], rule: ['规则', '#ffd23f'], tactic: ['战术', '#ff8a7a'], fun: ['趣闻', '#c7a6ff'] };
  YY.CARD_CATS = CARD_CATS;
  const CARDS = YY.SIXTEEN_CARDS;
  YY.CARDS = CARDS;
  YY.card = (id) => CARDS.find((c) => c.id === id);

  // ---------- 关卡 ----------
  // 对话步骤：scene 为剧情场景（见 scenes.js），cast 为开场就在场的人物；说话的人会自动登场。
  // 对话行：[说话人, 文本, 表情]；表情见 char.js 的 YY.MOODS（happy / sad / surprise / shy / think / angry / cheer / wave / smile / talk / point / tired / fist）。
  const STORY = YY.CAMPAIGN;
  YY.STORY = STORY;
  const STAGES = [];
  for (const ch of STORY) for (const st of ch.stages) { st.chapter = ch; STAGES.push(st); }
  YY.STAGES = STAGES;
  YY.stage = (id) => STAGES.find((s) => s.id === id);
  // The profile loads before campaign.js; validate its checkpoint once stages exist.
  const checkpoint=YY.Profile.d.campaign.checkpoint;
  if(checkpoint&&(!YY.stage(checkpoint.stage)||checkpoint.index>=YY.stage(checkpoint.stage).steps.length)){YY.Profile.d.campaign.checkpoint=null;YY.Profile.save();}
  /** 关卡是否可玩：上一关已通过 */
  YY.stageOpen = (id) => {
    const i = STAGES.findIndex((s) => s.id === id);
    if (i < 0) return false;
    const done=key=>YY.Profile.stars(key)>0||YY.Profile.d.campaign.challengeStages[key]>0;
    if (i === 0 || done(id) || done(STAGES[i - 1].id)) return true;
    return false;
  };
  /** 解锁说明 */
  YY.lockText = (stageId) => {
    const st = YY.stage(stageId);
    return st ? `故事 ${st.id}「${st.title}」解锁` : '故事模式解锁';
  };

  // ---------- 步法训练 ----------
  const SPOTS = [
    { x: -1.05, name: '网前' }, { x: -3.0, name: '中心' }, { x: -5.7, name: '后场' }, { x: -1.7, name: '网前' }, { x: -4.6, name: '中后场' },
  ];
  class Footwork {
    constructor(m, def) {
      this.m = m;
      this.def = Object.assign({ name: '步法训练', tip: '跑进光圈：「踩点」站进去，「跳」在圈里起跳，「挥拍」在圈里挥拍。', zone: null, life: 2.6, minLife: 1.6 }, def);
      this.goal = { need: def.need, total: def.total, unit: '个' };
      this.att = 0; this.ok = 0; this.streak = 0; this.best = 0;
      this.msg = this.def.tip; this.msgColor = '#ffffff';
      this.marks = [];
      this.cur = null;
      this.wait = 1.2;
      this.done = false;
      this.lastSpot = 1;
      this.swungAt = -9;
      this.life = this.def.life;
      m.phase = 'idle';
      m.hint = null;
      const s = m.shuttle;
      s.live = false; s.held = false; s.x = 60; s.y = 1;
      m.players[1].x = 60;
      m.players[0].x = -3.0;
    }
    spawn() {
      // 交替前后场，偶尔回中心：模拟“米字步 + 回中心”
      let i;
      if (this.lastSpot !== 1 && Math.random() < 0.45) i = 1;
      else do { i = Math.floor(Math.random() * SPOTS.length); } while (i === this.lastSpot || i === 1);
      this.lastSpot = i;
      const sp = SPOTS[i];
      const kind = i === 1 ? 'touch' : sp.x < -4 ? YY.pick({ jump: 2, swing: 1.4, touch: 0.6 }) : YY.pick({ swing: 2, touch: 1 });
      const label = kind === 'jump' ? '跳' : kind === 'swing' ? '挥拍' : i === 1 ? '回中心' : '踩点';
      this.cur = { x: sp.x + rand(-0.25, 0.25), kind, label, t: 0, life: this.life, done: false };
      this.marks = [this.cur];
      this.swungAt = -9;
    }
    onEvent(e) {
      if (e.type === 'swing' && e.p === 0) this.swungAt = this.m.time;
    }
    resolve(ok) {
      this.att++;
      if (ok) {
        this.ok++; this.streak++; this.best = Math.max(this.best, this.streak);
        this.msg = ['好步伐！', '漂亮的启动！', '回位及时！', '又快又稳！'][this.ok % 4];
        this.msgColor = '#7dffb0';
        this.life = Math.max(this.def.minLife, this.life - 0.1);
      } else {
        this.streak = 0;
        this.msg = '慢了一步 — 看到光圈立刻启动';
        this.msgColor = '#ff9b7b';
      }
      this.m.emit({ type: 'pres', ok, msg: this.msg });
      this.wait = ok ? 0.2 : 0.5;
      const g = this.goal;
      if (!this.done && (this.ok >= g.need || this.att >= g.total || g.total - this.att < g.need - this.ok)) {
        this.done = true;
        this.m.emit({ type: 'pdone', win: this.ok >= g.need, ok: this.ok, att: this.att, best: this.best });
      }
    }
    update(dt) {
      if (this.done && !this.cur) return;
      const m = this.m, p = m.players[0];
      const mk = this.cur;
      if (!mk) {
        this.wait -= dt;
        if (this.wait <= 0 && !this.done) this.spawn();
        return;
      }
      mk.t += dt;
      if (mk.done) { if (mk.t > mk.doneAt + 0.25) { this.cur = null; this.marks = []; } return; }
      const inside = Math.abs(p.x - mk.x) < 0.45;
      let hit = false;
      if (inside) {
        if (mk.kind === 'touch') hit = p.onGround;
        else if (mk.kind === 'jump') hit = p.y > 0.2;
        else hit = m.time - this.swungAt < 0.25;
      }
      if (hit) { mk.done = true; mk.doneAt = mk.t; this.resolve(true); }
      else if (mk.t > mk.life) { this.cur = null; this.marks = []; this.resolve(false); }
    }
  }
  YY.Footwork = Footwork;

  // ---------- 发球训练 ----------
  class ServeDrill {
    constructor(m, def) {
      this.m = m;
      this.def = Object.assign({ name: '发球训练', tip: '白色指针在绿色区间时出手：按「吊球」发网前球。', kind: 'sserve' }, def);
      this.def.zone = def.zone;
      this.goal = { need: def.need, total: def.total, unit: '次' };
      this.att = 0; this.ok = 0; this.streak = 0; this.best = 0;
      this.msg = this.def.tip; this.msgColor = '#ffffff';
      this.done = false;
      this.wait = 0;
      m.server = 0;
      m.resetPoint(false);
      m.players[1].x = 60;
    }
    onEvent(e) {
      if (e.type !== 'pland') return;
      const d = this.def, z = d.zone;
      this.att++;
      let ok = false, msg;
      if (e.netHit && e.x <= 0) msg = '下网 — 力度不够，指针靠近中间再出手';
      else if (e.x <= 0) msg = '没有过网';
      else if (e.shot !== d.kind) msg = d.kind === 'sserve' ? '这是高远球，请用「吊球」发网前球' : '请用「高远」发高远球';
      else if (!e.inB) msg = '出界 — 发得太大了';
      else if (e.x < z[0]) msg = '太短 — 没过前发球线，算发球失误';
      else if (e.x > z[1]) msg = '偏长 — 球越过目标区，容易被对手抢攻';
      else { ok = true; msg = ['漂亮！贴网而过', '完美的网前发球', '稳！'][this.ok % 3]; }
      if (ok) { this.ok++; this.streak++; this.best = Math.max(this.best, this.streak); }
      else this.streak = 0;
      this.msg = msg; this.msgColor = ok ? '#7dffb0' : '#ff9b7b';
      this.m.emit({ type: 'pres', ok, msg });
      this.wait = 1.1;
      const g = this.goal;
      if (!this.done && (this.ok >= g.need || this.att >= g.total || g.total - this.att < g.need - this.ok)) {
        this.done = true;
        this.m.emit({ type: 'pdone', win: this.ok >= g.need, ok: this.ok, att: this.att, best: this.best });
      }
    }
    update(dt) {
      const m = this.m;
      if (m.phase === 'idle' && !this.done) {
        this.wait -= dt;
        if (this.wait <= 0) { m.server = 0; m.resetPoint(false); m.players[1].x = 60; }
      }
    }
  }
  YY.ServeDrill = ServeDrill;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof window !== 'undefined' ? window : globalThis);
