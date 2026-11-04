/* 羽跃对决 · 角色、技能、装备与存档
 * 属性均为倍率（1 = 标准）。装备效果用“加减百分比”叠加：最终值 = 1 + 角色 + 球拍 + 球线 + 磅数 + 球鞋。
 * 数值含义见 match.js 的 BASE_STATS。
 */
(function (G) {
  'use strict';
  const YY = G.YY;

  // ---------- 技能 ----------
  // dur：持续秒数（0 = 立即生效 / 直到下一拍）；color：特效主色
  const SKILLS = {
    pokong: { name: '破空一击', short: '破空', color: '#ff6a52', dur: 8, desc: '8 秒内的下一拍必定“完美”击球，挥拍判定范围扩大 20%，扣杀再快 10%。' },
    chaoxi: { name: '潮汐回气', short: '回气', color: '#5cc8ff', dur: 6, desc: '体力瞬间回满；之后 6 秒起跳、扣杀不耗体力，恢复速度 ×3。' },
    lieyan: { name: '烈焰重杀', short: '烈焰', color: '#ff8a2a', dur: 10, desc: '10 秒内的下一记扣杀球速 +22%，击球点要求降低；对手接这一球时回球质量大减。' },
    huanshi: { name: '缓时·冉冉', short: '缓时', color: '#b59cff', dur: 2.8, desc: '飞向自己半场的球放慢到 45%，持续 2.8 秒——慢慢看清，再稳稳出手。' },
    tiebi: { name: '移动城墙', short: '铁壁', color: '#ffd23f', dur: 7, desc: '7 秒内够球范围 +50%，接杀、救低球不再降低回球质量，移动 +8%。' },
    shanbu: { name: '疾风闪步', short: '闪步', color: '#7dffb0', dur: 3.5, desc: '3.5 秒内移动速度 ×1.6、启动加速 ×2.2，起跳不耗体力，脚下带残影。' },
    jinghua: { name: '镜花水月', short: '镜花', color: '#9ff0ff', dur: 10, desc: '10 秒内的下一拍变成假动作：球路幻影一分为三，对手判断变慢，落点提示消失。' },
  };
  YY.SKILLS = SKILLS;

  // ---------- 角色外观（凌风、沧澜使用 char.js 的默认两套） ----------
  const L = (o) => Object.assign({
    panel: '#ffffff', shorts: '#1c1f33', shorts2: '#0f111e', sock: '#ffffff', shoe: '#ffffff', grip: '#222',
    skin: '#f3c9a5', skin2: '#d9a37d', outline: '#1a0f19', eye: '#2b1a12', band: '#ffffff', wrist: '#ffffff',
  }, o);
  const NEW_LOOKS = {
    xiaohong: L({
      name: '小红', hair: 'twin', shirt: '#ff4fa0', shirt2: '#b8185f', panel: '#fff0f7', trim: '#ffe066', stripe: '#ff4fa0',
      shorts: '#ffffff', shorts2: '#e7d3de',
      hairC: '#3a1418', hairHi: '#7a2c35', band: '#ffe066', sole: '#ff4fa0', racket: '#ff3d8b', racket2: '#ffe066',
      wrist: '#ffe066', num: '1', swoosh: '255,120,150',
    }),
    ranran: L({
      name: '冉冉', hair: 'bun', shirt: '#9b7bff', shirt2: '#5a3fc4', panel: '#f1ecff', trim: '#d9ccff', stripe: '#9b7bff',
      shorts: '#ece9f8', shorts2: '#c4bfdc', skin: '#f6d2b4', skin2: '#dcae8c',
      hairC: '#20172e', hairHi: '#4d3d6b', band: '#e7c46a', sole: '#9b7bff', racket: '#b59cff', racket2: '#ffffff',
      eye: '#2a1d3d', num: '3', swoosh: '190,160,255',
    }),
    ruibao: L({
      name: '瑞宝', hair: 'buzz', shirt: '#ffb02e', shirt2: '#cc7a0a', panel: '#fff3d6', trim: '#ff6a3d', stripe: '#ffb02e',
      shorts: '#2b3a67', shorts2: '#1a2546', skin: '#f1c39b', skin2: '#d39b72', chubby: true,
      hairC: '#2a1a10', hairHi: '#5a3a24', sole: '#ff6a3d', racket: '#ff8c1a', racket2: '#fff3d6',
      wrist: '#ff6a3d', num: '8', swoosh: '255,200,90',
    }),
    dingding: L({
      name: '丁丁', hair: 'bowl', glasses: true, shirt: '#2fd38a', shirt2: '#11905a', panel: '#0f2a22', trim: '#c6ff5c', stripe: '#2fd38a',
      shorts: '#1b2433', shorts2: '#0e141f', hairC: '#3b2a1c', hairHi: '#6b4f35', band: '#c6ff5c', sole: '#c6ff5c',
      racket: '#22e28f', racket2: '#c6ff5c', shoe: '#e9fff4', num: '5', swoosh: '120,255,180',
    }),
    tianchu: L({
      name: '田楚', hair: 'bangs', shirt: '#1d2236', shirt2: '#0b0e1a', panel: '#9ff0ff', trim: '#9ff0ff', stripe: '#9ff0ff',
      shorts: '#0d0f19', shorts2: '#05060c', skin: '#efc6a3', skin2: '#cf9a76',
      hairC: '#e9eef8', hairHi: '#ffffff', band: '#9ff0ff', shoe: '#11131f', sole: '#9ff0ff', grip: '#9ff0ff',
      racket: '#c9f6ff', racket2: '#5b6cff', wrist: '#9ff0ff', outline: '#05060c', eye: '#3a6a88', num: '0', swoosh: '160,240,255',
    }),
  };

  // ---------- 角色 ----------
  // fx：基础属性偏移；lock：解锁说明（故事关卡 id）
  const CHARS = [
    { id: 'lingfeng', look: 0, title: '追风少年', skill: 'pokong', fx: {},
      bio: '刚转学到星光城的新生，捡到一只会说话的羽毛球后，被卷进了拯救老球馆的大冒险。没有短板，也没有绝活——但成长最快。' },
    { id: 'canglan', look: 1, title: '潮汐守望者', skill: 'chaoxi', fx: { regen: 0.08, stamCost: -0.05, control: 0.04, power: -0.03 },
      bio: '羽跃社唯一的老社员，话少，体能怪物。每天第一个到球馆拖地，最后一个关灯。' },
    { id: 'xiaohong', look: 'xiaohong', title: '燃烧的社长', skill: 'lieyan', fx: { power: 0.1, jump: 0.03, control: -0.05, stamCost: 0.04 }, lock: '0-3',
      bio: '羽跃社社长，口头禅是“杀就完了！”。梦想打破社团的最高球速纪录，手机壁纸是自己的扣杀慢动作。' },
    { id: 'ranran', look: 'ranran', title: '网前诗人', skill: 'huanshi', fx: { touch: 0.12, control: 0.05, power: -0.07 }, lock: '1-2',
      bio: '图书馆的常驻读者，说话慢吞吞，手上功夫却细得惊人：网前一搓，球会翻着跟头过网。' },
    { id: 'ruibao', look: 'ruibao', title: '移动城墙', skill: 'tiebi', fx: { reach: 0.08, defense: 0.1, move: -0.06, regen: 0.06 }, lock: '1-3',
      bio: '食堂包子铺的头号常客。看着圆滚滚，接杀却滴水不漏——“球杀过来的时候，就像包子出笼！”' },
    { id: 'dingding', look: 'dingding', title: '穿线机之子', skill: 'shanbu', fx: { move: 0.08, accel: 0.1, power: -0.08, handling: -0.05 }, lock: '2-3',
      bio: '家里开穿线铺，背得出每支球拍的平衡点和中杆硬度。个子小、跑得快，像只装了弹簧的松鼠。' },
    { id: 'tianchu', look: 'tianchu', title: '镜花水月', skill: 'jinghua', fx: { power: 0.05, control: 0.05, jump: 0.06, touch: 0.04, stamCost: 0.05 }, lock: '5-3',
      bio: '寒星中学的王牌，冷静而神秘。同一个引拍动作能打出三种球——“你看到的，未必是真的。”' },
  ];
  const CHAR_BY = {};
  for (const c of CHARS) CHAR_BY[c.id] = c;
  YY.CHARS = CHARS;
  YY.char = (id) => CHAR_BY[id] || CHARS[0];
  /** 角色外观对象 */
  YY.lookOf = function (id) {
    const c = YY.char(id);
    return typeof c.look === 'number' ? YY.LOOKS[c.look] : NEW_LOOKS[c.look];
  };
  YY.charName = (id) => YY.lookOf(id).name;
  YY.NARRATOR = { id: 'maomao', name: '毛毛', color: '#fff3c4' };

  // ---------- 装备 ----------
  const GEAR = {
    racket: [
      { id: 'r_basic', name: '青训均衡拍', spec: '4U · 均衡 · 中杆适中', fx: {},
        desc: '社团公用拍。平衡点在中间，进攻防守都不偏科——新手最该先用的一支。' },
      { id: 'r_flex', name: '柔风入门拍', spec: '5U · 均衡 · 中杆偏软', fx: { reach: 0.06, control: 0.03, power: -0.04 }, lock: '0-3',
        desc: '中杆软，挥拍慢也能“弹”出去，甜区感觉更大；但用力抽打时拍框会“软”掉一点力量。' },
      { id: 'r_silk', name: '绣羽控球拍', spec: '4U · 均衡 · 方圆拍框', fx: { touch: 0.12, control: 0.06, power: -0.03 }, lock: '1-2',
        desc: '冉冉的同款。拍框稳定、反馈细腻，搓放和推吊的落点更准。' },
      { id: 'r_heavy', name: '雷霆进攻拍', spec: '3U · 头重 · 中杆硬', fx: { power: 0.12, handling: 0.1, control: -0.04, defense: -0.06 }, lock: '2-1',
        desc: '头重让挥拍惯性更大，杀球更沉更快；代价是挥拍偏慢，被动防守时容易来不及。' },
      { id: 'r_light', name: '疾风速度拍', spec: '5U · 头轻 · 中杆适中', fx: { handling: -0.12, defense: 0.1, power: -0.06 }, lock: '2-1',
        desc: '头轻拍挥动灵活，连续平抽、接杀反应快；但扣杀的“分量”不如头重拍。' },
      { id: 'r_star', name: '星光限定拍', spec: '4U · 微头重 · 高模量碳纤维', fx: { power: 0.07, control: 0.05, handling: -0.03 }, lock: '5-3',
        desc: '星光杯冠军奖品。高模量碳纤维让拍框又轻又硬，力量和控制兼得。' },
    ],
    string: [
      { id: 's_dur', name: '耐打线', spec: '0.70 mm · 单芯尼龙', fx: { control: 0.02, power: -0.02 },
        desc: '线径粗、最耐打，适合天天练球的新手。弹性一般，击球声偏闷。' },
      { id: 's_ctrl', name: '控球线', spec: '0.68 mm · 磨砂涂层', fx: { touch: 0.06, control: 0.04, power: -0.02 }, lock: '2-2',
        desc: '表面涂层增加“咬球”时间，网前搓放、劈吊更好控制落点。' },
      { id: 's_crisp', name: '清脆线', spec: '0.62 mm · 多股编织', fx: { power: 0.04, touch: 0.02, reach: -0.02 }, lock: '2-3',
        desc: '超细线径，击球声“砰砰”清脆，弹性好；缺点是很容易断，甜区也略窄。' },
      { id: 's_rep', name: '高弹线', spec: '0.66 mm · 高弹复合芯', fx: { power: 0.06, control: -0.02 }, lock: '4-3',
        desc: '弹性好、回弹快，同样的挥速能把球打得更快更远，适合进攻型打法。' },
    ],
    shoe: [
      { id: 'sh_basic', name: '入门训练鞋', spec: '生胶底 · 低帮', fx: {},
        desc: '专业羽毛球鞋的基础款：生胶鞋底在木地板上抓地好，低帮方便脚踝灵活转动。' },
      { id: 'sh_run', name: '你的旧跑鞋', spec: '厚泡棉 · 高鞋跟', fx: { move: 0.02, accel: -0.12, lunge: 0.3, land: 0.2 },
        desc: '跑鞋为直线前进设计：鞋底厚而软、侧向支撑弱。在球场急停变向容易打滑甚至崴脚——试试就知道了。' },
      { id: 'sh_cushion', name: '云垫缓震鞋', spec: '全掌缓震 · 足跟稳定片', fx: { land: -0.5, stamCost: -0.08, jump: 0.03 }, lock: '1-3',
        desc: '起跳落地的冲击被吸收，落地后能更快再次启动，连续跳杀也更省力。' },
      { id: 'sh_stable', name: '磐石防侧翻鞋', spec: '宽底盘 · 侧向支撑', fx: { accel: 0.1, lunge: -0.4 }, lock: '3-3',
        desc: '宽鞋底和侧面支撑片让急停、蹬转更稳；跑动中勉强击球时，回球也不容易变形。' },
      { id: 'sh_light', name: '羽翼轻量鞋', spec: '轻量鞋面 · 薄底', fx: { move: 0.06, accel: 0.04, land: 0.2 }, lock: '4-3',
        desc: '每只轻了 40 克，脚步更快；但鞋底薄、缓震少，落地后要多缓一下。' },
    ],
  };
  YY.GEAR = GEAR;
  const GEAR_BY = {};
  for (const k in GEAR) for (const g of GEAR[k]) { g.cat = k; GEAR_BY[g.id] = g; }
  YY.gear = (id) => GEAR_BY[id];
  YY.GEAR_CATS = { racket: '球拍', string: '球线', tension: '磅数', shoe: '球鞋' };

  // 磅数：低磅弹性大、甜区大但控制差；高磅控制准、甜区小、更吃力量
  YY.TENSION = { min: 20, max: 30, def: 24 };
  YY.tensionFx = function (lbs) {
    const t = (lbs - 24) / 6;
    return { control: 0.07 * t, touch: 0.05 * t, reach: -0.07 * t, power: -0.03 * t, stamCost: 0.06 * Math.max(0, t) };
  };
  YY.tensionNote = function (lbs) {
    if (lbs <= 22) return '低磅：弹性大、甜区大、省力，但落点不够准。适合力量较小的初学者。';
    if (lbs <= 25) return '中磅：弹性与控制平衡，大多数业余球友的选择。';
    if (lbs <= 27) return '中高磅：控球更精准、手感更“脆”，需要更快的挥速和正确发力。';
    return '高磅：极致控制，甜区小、对发力要求很高，也更容易断线、伤拍。专业选手常用。';
  };

  // ---------- 属性汇总 ----------
  const KEYS = ['move', 'accel', 'jump', 'power', 'control', 'touch', 'reach', 'defense', 'stamCost', 'regen', 'handling', 'land', 'lunge'];
  function addFx(st, fx) { if (fx) for (const k in fx) st[k] = (st[k] || 0) + fx[k]; }
  /** 角色 + 装备 → 属性倍率 */
  YY.buildStats = function (sel) {
    const d = {};
    for (const k of KEYS) d[k] = 0;
    addFx(d, YY.char(sel.char).fx);
    for (const id of [sel.racket, sel.string, sel.shoe]) { const g = GEAR_BY[id]; if (g) addFx(d, g.fx); }
    addFx(d, YY.tensionFx(sel.tension || YY.TENSION.def));
    const st = {};
    for (const k of KEYS) st[k] = Math.max(0.4, 1 + d[k]);
    return st;
  };
  /** 界面展示的 8 项能力（100 = 标准） */
  YY.STAT_VIEW = [
    ['速度', (s) => (s.move + s.accel) / 2],
    ['力量', (s) => s.power],
    ['控制', (s) => s.control],
    ['网前', (s) => s.touch],
    ['防守', (s) => (s.reach + s.defense) / 2],
    ['弹跳', (s) => s.jump],
    ['体能', (s) => (2 - s.stamCost + s.regen) / 2],
    ['挥速', (s) => 2 - s.handling],
    ['稳定', (s) => (2 - s.land * 0.5 - s.lunge * 0.5)],
  ];
  YY.fxTags = function (fx) {
    const names = { move: '移动', accel: '启动', jump: '弹跳', power: '力量', control: '控制', touch: '网前', reach: '甜区', defense: '防守', stamCost: '体力消耗', regen: '体力恢复', handling: '挥拍耗时', land: '落地硬直', lunge: '跑动击球变形' };
    const lowerBetter = { stamCost: 1, handling: 1, land: 1, lunge: 1 };
    const out = [];
    for (const k in fx || {}) {
      const v = fx[k];
      if (Math.abs(v) < 0.005) continue;
      const good = lowerBetter[k] ? v < 0 : v > 0;
      out.push({ text: names[k] + (v > 0 ? ' +' : ' ') + Math.round(v * 100) + '%', good });
    }
    return out;
  };

  // ---------- 存档 ----------
  const KEY = 'yuyue.profile';
  const DEFAULT = () => ({
    v: 1,
    chars: ['lingfeng', 'canglan'],
    gear: ['r_basic', 's_dur', 'sh_basic', 'sh_run'],
    cards: [],
    feats: [],
    stages: {},
    seen: {},
    sel: { char: 'lingfeng', racket: 'r_basic', string: 's_dur', tension: 24, shoe: 'sh_basic' },
  });
  const Profile = (YY.Profile = {
    d: null,
    load() {
      let d = null;
      try { d = JSON.parse(YY.platform.getStorage(KEY)); } catch (_) {}
      const def = DEFAULT();
      if (!d || typeof d !== 'object' || Array.isArray(d)) d = def;
      const clean = { ...def };
      for (const key of ['chars', 'gear', 'cards', 'feats']) {
        const values = Array.isArray(d[key]) ? d[key].filter(v => typeof v === 'string') : [];
        clean[key] = [...new Set([...def[key], ...values])];
      }
      clean.chars = clean.chars.filter(id => CHAR_BY[id]);
      clean.gear = clean.gear.filter(id => GEAR_BY[id]);
      clean.stages = {};
      for (const [id, stars] of Object.entries(d.stages && typeof d.stages === 'object' ? d.stages : {})) {
        if (/^\d+-\d+$/.test(id) && Number.isInteger(stars) && stars >= 1 && stars <= 3) clean.stages[id] = stars;
      }
      clean.seen = {};
      for (const [id, value] of Object.entries(d.seen && typeof d.seen === 'object' ? d.seen : {})) if (/^card:[\w-]+$/.test(id) && value) clean.seen[id] = true;
      clean.sel = { ...def.sel, ...(d.sel && typeof d.sel === 'object' ? d.sel : {}) };
      if (!clean.chars.includes(clean.sel.char)) clean.sel.char = def.sel.char;
      for (const key of ['racket', 'string', 'shoe']) if (!clean.gear.includes(clean.sel[key]) || GEAR_BY[clean.sel[key]]?.cat !== key) clean.sel[key] = def.sel[key];
      clean.sel.tension = Number.isFinite(clean.sel.tension) ? Math.max(20, Math.min(30, Math.round(clean.sel.tension))) : 24;
      d = clean;
      this.d = d;
      return d;
    },
    save() { try { YY.platform.setStorage(KEY, JSON.stringify(this.d)); } catch (_) {} },
    get sel() { return this.d.sel; },
    has(kind, id) {
      const list = { char: this.d.chars, gear: this.d.gear, card: this.d.cards, feat: this.d.feats }[kind];
      return !!list && list.includes(id);
    },
    /** 解锁；返回是否为新获得 */
    unlock(kind, id) {
      const list = { char: this.d.chars, gear: this.d.gear, card: this.d.cards, feat: this.d.feats }[kind];
      if (!list || list.includes(id)) return false;
      list.push(id);
      this.save();
      return true;
    },
    stars(id) { return this.d.stages[id] || 0; },
    setStars(id, n) { if (n > (this.d.stages[id] || 0)) { this.d.stages[id] = n; this.save(); } },
    choose(field, val) {
      this.d.sel[field] = val;
      this.save();
    },
    canTune() { return this.has('feat', 'tension'); },
    stats() {
      const s = Object.assign({}, this.d.sel);
      if (!this.canTune()) s.tension = YY.TENSION.def;
      return YY.buildStats(s);
    },
    reset() { this.d = DEFAULT(); this.save(); },
  });
  Profile.load();
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof window !== 'undefined' ? window : globalThis);
