/* 羽跃对决 · 故事模式：关卡索引、知识图鉴、步法与发球训练。
 * 剧本见 campaign.js；新增知识见 knowledge.js；调查 / 战术板 / 实验见 story-play.js。
 * 对话行：[说话人, 文本]；说话人为角色 id、'me'（主角凌风）、'mm'（毛毛）或 'nar'（旁白）。
 */
(function (G) {
  'use strict';
  const YY = G.YY;
  const C = YY.C;
  const { rand, clamp } = YY;

  // ---------- 知识图鉴 ----------
  const CARD_CATS = { gear: ['器材', '#5cc8ff'], tech: ['技术', '#7dffb0'], rule: ['规则', '#ffd23f'], tactic: ['战术', '#ff8a7a'], fun: ['趣闻', '#c7a6ff'] };
  YY.CARD_CATS = CARD_CATS;
  const CARDS = [
    { id: 'c_shuttle', cat: 'gear', title: '羽毛球的构造', text: "比赛羽毛球有 16 根羽毛，标准质量为 4.74–5.50 克。训练中先检查球托和羽毛是否破损，状态不同会影响飞行。" },
    { id: 'c_rules', cat: 'rule', title: '计分规则', text: "本游戏普通对战为 7 分短局、领先 2 分、11 分封顶，故事关卡另行标注。现实赛事应按其适用规则计分；BWF 2025 规则为 3×21，已公布 3×15 于 2027-01-04 起实施。" },
    { id: 'c_court', cat: 'rule', title: '球场与球网', text: "球场全长 13.4 米，单打宽 5.18 米、双打宽 6.1 米。球网两端高 1.55 米，中间高 1.524 米。球落在线上算界内——所以压线球总是最让人激动。" },
    { id: 'c_grip', cat: 'tech', title: '握拍', text: "基础握拍保持手指自然、手掌不过分紧绷，并随来球调整。正手基础握拍与反手拇指握拍是入门练习；并不是所有反手球都用完全相同的握法。" },
    { id: 'c_clear', cat: 'tech', title: '高远球', text: "高远球把球送向后场，可以为回位争取时间。先移动到合适位置，再协调挥拍；不要为了追求所谓“最高点”而失去身体平衡。" },
    { id: 'c_drop', cat: 'tech', title: '吊球与网前', text: "后场吊球将球送到对方前场，可与高远球使用相近的准备动作。基础吊球不必强行切击；先练稳定的方向、力量和过网高度，再学习变化。" },
    { id: 'c_footwork', cat: 'tech', title: '步法', text: "根据来球启动、到位、制动并准备下一拍。现实步法还有侧向移动，本游戏的前后移动只是一部分，不能替代场地练习。" },
    { id: 'c_shoes', cat: 'gear', title: '羽毛球鞋', text: "选择合脚、适合室内球场和侧向移动的运动鞋。鞋底保持干净并检查磨损；鞋并不能消除滑倒或扭伤风险，湿滑地面仍要先处理。" },
    { id: 'c_racket', cat: 'gear', title: '球拍参数', text: "球拍重量、平衡、杆身特性和握柄尺寸共同影响手感。不同系列规格应看厂家说明；头重不保证杀球更强，硬杆也不自动带来准确落点。" },
    { id: 'c_string', cat: 'gear', title: '球线', text: "球线的材料、结构、直径和穿线状态共同影响手感与耐用性。不能只看粗细作判断；按球拍建议范围穿线，发现异常应检查处理。" },
    { id: 'c_tension', cat: 'gear', title: '磅数', text: "磅数不是等级。先看对应球拍的建议范围，再结合击球能力与实际试打调整。本游戏 20–30 磅的选项仅是装备系统，不构成现实穿线建议。" },
    { id: 'c_history', cat: 'fun', title: '名字的由来', text: "羽毛球的英文名 Badminton 来自英国的伯明顿庄园（Badminton House）。19 世纪下半叶，人们在那里玩一种用拍子来回击打羽毛球的游戏。1992 年，羽毛球成为奥运会正式比赛项目。" },
    { id: 'c_wind', cat: 'tactic', title: '风与场馆', text: "羽毛球很轻，最怕风。正式比赛的场馆会避免空调直吹场地。赛前挑边时可以先观察风向：顺风时高远球要收一点，顶风时要更积极地发力。" },
    { id: 'c_read', cat: 'tactic', title: '预判', text: "本游戏 AI 会观察重复球路并调整准备位置。改变节奏和前后落点可打破预判；预判不是提前知道对方尚未做出的选择。" },
    { id: 'c_serve', cat: 'rule', title: '发球规则', text: "按标准发球规则，发球员和接发球员在对角发球区内、不踩区线；发球过程双脚各有部分保持接地静止，击球瞬间整个球低于 1.15 米。还须符合连贯挥拍等要求。" },
    { id: 'c_speed', cat: 'gear', title: '球速号', text: "球筒上的球速号用于区分飞行速度，选球还要结合现场试打。不同品牌标记可能不同，不把一个号码当作所有场地的固定答案。" },
    { id: 'c_defense', cat: 'tech', title: '接杀', text: "接快速来球时，先让球拍准备在身体前方。根据来球和位置，可以挡到前场或挑回后场；动作尽量简洁，避免只甩手腕硬接。" },
    { id: 'c_smash', cat: 'tech', title: '杀球', text: "选择身前上方的合适击球点，协调身体动作，下压后准备下一拍。游戏中的跳杀按钮简化了动作，现实练习应由教练指导发力和落地。" },
    { id: 'c_warmup', cat: 'tech', title: '热身与拉伸', text: "正式练习前逐步活动身体，再做可控的专项动作，避免一开始就全力跳杀。热身不能保证不受伤；出现疼痛或不适时停止练习并寻求帮助。" },
    { id: 'c_feint', cat: 'tactic', title: '假动作', text: "所有球路都用尽量一样的准备动作，直到击球瞬间才决定方向和力量，这就是假动作。应对方法：对手击球时做好启动步，重心保持在中间，看清再出发。" },
    { id: 'c_record', cat: 'fun', title: '最快的杀球', text: "实验室测速与比赛中的测量条件不同，不能简单比较。本游戏的显示球速带有表现倍率，不是职业比赛的真实测速结果。" },
    { id: 'c_etiquette', cat: 'rule', title: '球场礼仪', text: "比赛前后与对手、裁判握手致意；把球还给对方时用拍子轻轻送过网；地上有汗水要及时擦干——既是礼貌，也能防止滑倒受伤。" },
    { id: 'c_physics', cat: 'fun', title: '羽毛球里的物理', text: "本游戏以重力和随速度变化的空气阻力模拟飞行。羽毛球会明显减速，轨迹不同于理想抛物线；模型为可玩性作了简化，不用于现实测量。" },
    { id: 'c_netplay', cat: 'tech', title: '网前三板斧', text: "网前的球主要有三种处理：放网（轻轻送回网前）、搓球（拍面切削，让球翻滚着过网，对手很难回好）、推球（又平又快地推到对方后场）。球越高、离网越近，越要抢先出手。" },
    { id: 'c_netkill', cat: 'tech', title: '扑球与搓球', text: "对手的网前球偏高时，快速上网、拍头立起，用手腕和手指的爆发力向下“扑”——这就是扑球，是最快的得分方式之一。球低于网带时则改用搓球，切削球托让它翻滚着过网。游戏中：网前高球按「扣杀」扑球，网带高度的球按「吊球」搓球，网前按住向前再按「高远」可以推后场。" },
    { id: 'c_data', cat: 'tactic', title: '数据里的战术', text: "本游戏的统计帮助回看落点、回球类型和失误，但单个数字不能解释全部表现。结合回合情境，才知道下一次应练什么。" },
    { id: 'c_mental', cat: 'tactic', title: '比赛心态', text: "本游戏中，连续失分后可以把目标缩小为“下一球先回深”。现实比赛的调整也应遵守连续比赛与间歇规定，不靠故意拖延发球打乱对手。" },
    { id: 'c_health', cat: 'fun', title: '终身运动', text: "选择适合自己状态的练习速度、距离和时间，循序增加难度。身体不适时停止；是否需要护具或调整运动量，应结合个人情况咨询专业人员。" },
    { id: 'c_warmup2', cat: 'rule', title: '赛前准备', text: "先确认场地、器材、身体状态和比赛规则。比赛期间的间歇与指导须遵循适用规程，不应为了拖延时间而随意暂停。" },
    { id: 'c_mixed', cat: 'fun', title: '混合双打', text: "混双由男女选手搭档，配合取决于球路、站位和双方能力。前后进攻与左右防守是常见基础形态，不等于按性别固定站位。" },
  ];
  if (YY.expandKnowledge) YY.expandKnowledge(CARDS);
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
  /** 关卡是否可玩：上一关已通过 */
  YY.stageOpen = (id) => {
    const i = STAGES.findIndex((s) => s.id === id);
    if (i < 0) return false;
    if (i === 0 || YY.Profile.stars(id) > 0 || YY.Profile.stars(STAGES[i - 1].id) > 0) return true;
    const old = YY.LEGACY_STAGE_ORDER || [], j = old.indexOf(id);
    return j > 0 && YY.Profile.stars(old[j - 1]) > 0;
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
