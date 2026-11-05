/* 羽跃对决 · 角色、技能、装备与存档
 * 属性均为倍率（1 = 标准）。装备效果用“加减百分比”叠加：最终值 = 1 + 角色 + 球拍 + 球线 + 磅数 + 球鞋。
 * 数值含义见 match.js 的 BASE_STATS。
 */
(function (G) {
  'use strict';
  const YY = G.YY;

  // ---------- 技能 ----------
  // 每名角色：1 个被动（常驻）+ 3 个主动，对局前选 2 个主动携带。
  // 主动技能共用一条 0~100 的能量，cost 为消耗；dur 为持续秒数（0 = 立即生效）。
  // mod：持续期间的属性修正（match.js 汇总）；ai：电脑选择发动时机的分类；pop：触发时的飘字。
  const SKILLS = {
    // —— 凌风 ——
    chengzhang: { passive: true, name: '追风成长', short: '成长', color: '#ff8a6a', desc: '比分落后时能量获取 +50%；每次“完美”击球额外 +3 能量。越是逆风，越能连续出招。' },
    pokong: { name: '破空一击', short: '破空', color: '#ff6a52', cost: 35, dur: 8, ai: 'attack', pop: '破空！', sfx: 'skill-power',
      desc: '8 秒内的下一拍必定“完美”：挥拍判定 +20%，进攻球速 +12%，对手接这一拍的质量 ×0.7。' },
    huiwei: { name: '疾风回位', short: '回位', color: '#ffb199', cost: 25, dur: 7, ai: 'afterHit', sfx: 'skill-wind', mod: { move: 1.2, reach: 1.12 },
      desc: '7 秒内移动 +20%、击球判定 +12%；每打完一拍，只要你没在操作移动，就会自动冲回中场站位。专治“打完就愣住”。' },
    quanli: { name: '全力以赴', short: '全力', color: '#ff3d3d', cost: 55, dur: 8, ai: 'attack', sfx: 'skill-power', mod: { shot: 1.15, qAdd: 0.2, free: 1, reach: 1.1 },
      desc: '爆发 8 秒：扣杀、点杀、平抽球速 +15%，每拍回球质量 +20%，判定范围 +10%，跳跃与扣杀不耗体力。' },
    // —— 沧澜 ——
    chaoxi_p: { passive: true, name: '潮汐呼吸', short: '呼吸', color: '#5cc8ff', desc: '回合超过 6 拍后，每拍额外 +2 能量、体力恢复 +50%。拉得越久，潮水越满。' },
    chaoxi: { name: '潮汐回气', short: '回气', color: '#5cc8ff', cost: 30, dur: 6, ai: 'stamina', sfx: 'skill-flow', mod: { free: 1, regen: 3 },
      desc: '体力瞬间回满；之后 6 秒起跳、扣杀不耗体力，恢复速度 ×3。' },
    tuichao: { name: '退潮', short: '退潮', color: '#3a8dde', cost: 40, dur: 6, ai: 'any', sfx: 'skill-time',
      desc: '对手体力 -50、能量 -15，并且 6 秒内体力完全不恢复——想跳杀？先喘口气。' },
    changchao: { name: '长潮叠浪', short: '叠浪', color: '#9fe3ff', cost: 45, dur: 10, ai: 'rally', sfx: 'skill-flow',
      desc: '10 秒内你每打一拍叠一层浪（最多 6 层）：每层进攻球速 +4%、回球质量 +5%。回合越长越可怕。' },
    // —— 小红 ——
    zuiyou: { passive: true, name: '最优解', short: '最优', color: '#ff8a2a', desc: '跳杀球速 +3%；用扣杀、点杀或扑球直接得分，返还 15 能量。' },
    lieyan: { name: '最优解·重杀', short: '重杀', color: '#ff8a2a', cost: 35, dur: 10, ai: 'smash', pop: '最优解！', sfx: 'skill-power',
      desc: '10 秒内的下一记扣杀（含点杀、扑球）球速 +22%、起跳要求降低；对手接这一球的质量 ×0.55。' },
    lianzha: { name: '连续跳杀', short: '连杀', color: '#ff5a2a', cost: 50, dur: 7, ai: 'smash', sfx: 'skill-power', mod: { free: 1, noSmashSlow: 1, jump: 1.15, smash: 1.12, oppQSmash: 0.8 },
      desc: '7 秒内跳杀不耗体力、杀完不硬直、弹跳 +15%、扣杀再快 12%，对手接杀质量 ×0.8。一口气杀到底。' },
    gongshi: { name: '公式推演', short: '推演', color: '#ffd23f', cost: 35, dur: 8, ai: 'defend', sfx: 'skill-time', mod: { timing: 2, reach: 1.15, qMin: 0.6 },
      desc: '8 秒内“完美”时机窗口翻倍、判定范围 +15%，每一拍回球质量至少是“好球”。' },
    // —— 冉冉 ——
    xini: { passive: true, name: '细腻手感', short: '手感', color: '#ff8fbf', desc: '她的放网、搓球、吊球、劈吊，对手的回球质量 ×0.8。' },
    huanshi: { name: '缓时·冉冉', short: '缓时', color: '#b59cff', cost: 40, dur: 3.2, ai: 'defend', sfx: 'skill-time',
      desc: '飞向自己半场的球放慢到 45%，持续 3.2 秒——慢慢看清，再稳稳出手。' },
    cuoqiu: { name: '搓球魔术', short: '搓网', color: '#ff9ec7', cost: 30, dur: 10, ai: 'net', pop: '贴网翻滚！', sfx: 'skill-wind',
      desc: '10 秒内的下一拍网前球 / 吊球会擦着网带翻过去，几乎垂直掉在网下；落点提示消失，对手回球质量 ×0.6。' },
    tianmi: { name: '甜蜜陷阱', short: '陷阱', color: '#ff5fa2', cost: 50, dur: 6, ai: 'attack', sfx: 'skill-time', mod: { hide: 1 },
      desc: '6 秒内你打出的每一拍都不显示落点提示，对手移动 -15%。看不见，就只能猜。' },
    // —— 王瑞 ——
    baozi: { passive: true, name: '包子体质', short: '包子', color: '#ffb02e', desc: '接快球判定 +8%，接杀、救低球时的回球质量惩罚减半；每次成功救球额外 +4 能量。' },
    tiebi: { name: '移动城墙', short: '铁壁', color: '#ffd23f', cost: 40, dur: 7, ai: 'defend', sfx: 'skill', mod: { reach: 1.5, saveFree: 1, move: 1.08 },
      desc: '7 秒内够球范围 +50%，接杀、救低球不再降低回球质量，移动 +8%。' },
    baoxian: { name: '救球保险', short: '保险', color: '#ffe08a', cost: 60, dur: 8, ai: 'defend', sfx: 'skill',
      desc: '8 秒内，第一个本该落进你界内的球会被自动救起，挑回对方后场——这一分不算丢。' },
    fantan: { name: '包子反弹', short: '反弹', color: '#ff7a1a', cost: 40, dur: 8, ai: 'defend', pop: '反弹！', sfx: 'skill-power',
      desc: '8 秒内碰到的第一个快球（扣杀、点杀、平抽、扑球）会被自动反抽成“完美”的平抽重球，对手接球质量 ×0.55。' },
    // —— 星星 ——
    zhuiguang: { passive: true, name: '追光', short: '追光', color: '#ffe27a', desc: '打出吊球或网前球后的 2 秒内移动 +25%，跟上去抢网。' },
    liuxing: { name: '流星坠', short: '流星', color: '#ffe27a', cost: 45, dur: 10, ai: 'net', pop: '流星坠！', sfx: 'skill-wind',
      desc: '10 秒内的下一记吊球 / 网前球化作流星：贴网急坠、落点提示消失，对手接到也只能回出软球（质量 ×0.6）。' },
    liuxingyu: { name: '流星雨', short: '星雨', color: '#fff0a8', cost: 60, dur: 14, ai: 'net', pop: '流星雨！', sfx: 'skill-wind',
      desc: '14 秒内接下来的 3 记吊球 / 网前球都会变成流星坠。' },
    xinggui: { name: '星轨冲刺', short: '星轨', color: '#6c7cff', cost: 30, dur: 5, ai: 'chase', sfx: 'skill-wind', mod: { move: 1.45, accel: 1.6, netReach: 1.25, kill: 1.15 },
      desc: '5 秒内移动 +45%、启动 +60%，网前 2.5 米内够球范围 +25%，网前扑球再快 15%。' },
    // —— 丁丁 ——
    chuanxian: { passive: true, name: '穿线师', short: '穿线', color: '#2fd38a', desc: '平抽、推后场、平高球速度 +10%；落地硬直减半。' },
    shanbu: { name: '疾风闪步', short: '闪步', color: '#7dffb0', cost: 25, dur: 4, ai: 'chase', sfx: 'skill-wind', mod: { move: 1.6, accel: 2.2, jumpFree: 1 },
      desc: '4 秒内移动速度 ×1.6、启动加速 ×2.2，起跳不耗体力，脚下带残影。' },
    pingchou: { name: '平抽快打', short: '快打', color: '#c6ff5c', cost: 40, dur: 7, ai: 'rally', sfx: 'skill-power', mod: { swing: 0.7 },
      desc: '7 秒内，中路高度（1~2.3 米）用高远或扣杀键都会打出平抽快球：球速 +20%、质量 +15%，收拍快 30%。' },
    yibo: { name: '一波推进', short: '推进', color: '#22e28f', cost: 45, dur: 6, ai: 'attack', sfx: 'skill-power', mod: { shot: 1.12, drain: 15 },
      desc: '6 秒内进攻球速 +12%，而且你每打一拍，对手体力 -15。连续压制，拖垮对面。' },
    // —— 猴子 ——
    wenti: { passive: true, name: '问题不大', short: '不慌', color: '#ffb347', desc: '每丢一分额外 +10 能量；站稳不动时，接快球的判定范围 +20%。' },
    shanxian: { name: '猿人闪现', short: '闪现', color: '#ffb347', cost: 35, dur: 6, ai: 'afterHit', sfx: 'skill-wind',
      desc: '6 秒内对手每打来一球，你都会瞬间闪现到舒服的击球位置，打完再闪现回中场（最多 2 次）；闪现后这一拍质量 +15%。挥拍时机仍要自己把握。' },
    duzi: { name: '大肚缓冲', short: '肚弹', color: '#d9822b', cost: 40, dur: 8, ai: 'defend', pop: '肚皮缓冲', sfx: 'skill', mod: { reachFast: 1.3, saveFree: 1 },
      desc: '8 秒内接快球的判定范围 +30%，接杀不掉质量，面对快球时回球质量至少 75%。' },
    huicheng: { name: '回城补给', short: '回城', color: '#ffcf5a', cost: 20, dur: 4, ai: 'stamina', sfx: 'skill-flow',
      desc: '瞬间传送回中场、体力回满；4 秒内的下一拍质量 +20%。Dota 玩家的肌肉记忆。' },
    // —— 路先森 ——
    qifen: { passive: true, name: '气氛担当', short: '气氛', color: '#7fd6ff', desc: '每赢一分，对手能量 -10。笑点不同，也别想放技能。' },
    lengxiao: { name: '冷笑话时间', short: '冷笑话', color: '#7fd6ff', cost: 45, dur: 3.2, ai: 'afterHit', sfx: 'skill-time',
      desc: '程序员冷笑话：对手笑到脚软 3.2 秒，移动 -35%、起跳变低；自己趁机回 30 点体力。' },
    err404: { name: '404 错误', short: '404', color: '#4f86e0', cost: 45, dur: 8, ai: 'afterHit', sfx: 'skill-time',
      desc: '对手“页面丢失”：8 秒内他的下一拍回球质量最多只有“勉强”（35%），很容易送出机会球。' },
    shenglv: { name: '胜率模型', short: '模型', color: '#3fa9ff', cost: 55, dur: 8, ai: 'any', sfx: 'skill', mod: { reach: 1.2, qMin: 0.7, smash: 1.08 },
      desc: '8 秒内判定范围 +20%，每一拍回球质量至少 70%，扣杀 +8%。模型说：这把能赢。' },
    // —— 老陈 ——
    jilu: { passive: true, name: '数据记录', short: '记录', color: '#6fe3d0', desc: '对手连续三拍打出同类球路时，老陈的下一拍回球质量 +25%。' },
    shuju: { name: '数据透视', short: '透视', color: '#6fe3d0', cost: 35, dur: 8, ai: 'afterHit', pop: '数据命中', sfx: 'skill-time', mod: { reach: 1.15 },
      desc: '8 秒内对手的假动作、流星、隐藏落点全部失效，判定范围 +15%；对手连续两拍同类球路，你的下一拍必定“完美”。' },
    qingxi: { name: '数据清洗', short: '清洗', color: '#bff7ee', cost: 30, dur: 0, ai: 'cleanse', sfx: 'skill-time',
      desc: '清除对手身上所有正在生效的技能（含缓时、蓄着的重杀与流星），对手能量 -30，你的下一拍必定“完美”。' },
    rebei: { name: '双机热备', short: '热备', color: '#2fb5a8', cost: 35, dur: 14, ai: 'defend', sfx: 'skill',
      desc: '路先森在网前替你“热备”14 秒：第一个本该落在你前半场 3 米内的球会被自动挑回对方后场。' },
    // —— 果哥 ——
    benneng: { passive: true, name: '投机本能', short: '投机', color: '#ff5d8f', desc: '对手每打出一记质量低于 60% 的回球，果哥 +8 能量。' },
    touji: { name: '投机·抄底', short: '抄底', color: '#ff5d8f', cost: 35, dur: 8, ai: 'afterHit', pop: '健身房爆发！', sfx: 'skill-power',
      desc: '先回 40 体力，再盯盘 8 秒：对手回出机会球（质量 <60%）时，你的下一记扣杀球速 +22%、对手接球质量 ×0.55；靠这一拍得分返还 40 能量。' },
    wotui: { name: '卧推爆发', short: '卧推', color: '#ff3d6b', cost: 50, dur: 6, ai: 'smash', sfx: 'skill-power', mod: { smash: 1.18, jump: 1.2, smashCost: 1.5, oppQSmash: 0.7 },
      desc: '6 秒内扣杀 +18%、弹跳 +20%，对手接你扣杀的质量 ×0.7；代价是扣杀体力消耗 +50%。' },
    tangping: { name: '躺平回血', short: '躺平', color: '#ffa0bd', cost: 20, dur: 4, ai: 'stamina', pop: '躺平重扣！', sfx: 'skill-flow', mod: { regen: 4, move: 0.88 },
      desc: '体力瞬间回满；4 秒内恢复 ×4，期间的下一记扣杀必定是“抄底”重扣（球速 +22%），但移动 -12%。' },
    // —— 田楚 ——
    xushi: { passive: true, name: '同一引拍', short: '虚实', color: '#9ff0ff', desc: '她的每一拍出手后 0.2 秒内不显示落点提示，对手起动也会慢半拍。' },
    jinghua: { name: '镜花水月', short: '镜花', color: '#9ff0ff', cost: 40, dur: 10, ai: 'attack', pop: '幻影！', sfx: 'skill-time',
      desc: '10 秒内的下一拍变成假动作：球路幻影一分为三，对手判断变慢，落点提示消失。' },
    shuiyue: { name: '水中月', short: '水月', color: '#c9f6ff', cost: 40, dur: 10, ai: 'attack', pop: '水中月', sfx: 'skill-wind',
      desc: '10 秒内的下一拍过网后会突然“飘”向另一侧：落点提示还显示原来的位置——看到的，未必是真的。' },
    hanxing: { name: '寒星定身', short: '定身', color: '#5b6cff', cost: 50, dur: 0.9, ai: 'afterHit', sfx: 'skill-time',
      desc: '对手被寒意定住 0.9 秒：不能移动、不能起跳。最好在刚打出一记远离他的球后使用。' },
    // —— 朱老师 ——
    qiuling: { passive: true, name: '三十年球龄', short: '球龄', color: '#7dffb0', desc: '回球质量最低 50%，永远不会打出“勉强”的软球。' },
    jiaoke: { name: '教科书回球', short: '教科书', color: '#7dffb0', cost: 50, dur: 7, ai: 'defend', sfx: 'skill', mod: { qMin: 0.8, regen: 1.5 },
      desc: '7 秒内每一拍回球质量至少 80%，高远更深、吊球更贴网，体力恢复 ×1.5。' },
    shaosheng: { name: '吹哨暂停', short: '吹哨', color: '#ffffff', cost: 50, dur: 0.5, ai: 'afterHit', sfx: 'skill-time',
      desc: '一声哨响：对手 0.5 秒内无法挥拍，并且他正在生效的技能立即中止。' },
    baowen: { name: '保温杯', short: '枸杞', color: '#2fd38a', cost: 25, dur: 10, ai: 'stamina', sfx: 'skill-flow', mod: { regen: 2, jumpFree: 1 },
      desc: '喝口枸杞茶：体力回满，10 秒内恢复 ×2、起跳不耗体力。' },
  };
  YY.SKILLS = SKILLS;

  // ---------- 角色外观（凌风、沧澜使用 char.js 的默认两套） ----------
  const L = (o) => Object.assign({
    panel: '#ffffff', shorts: '#1c1f33', shorts2: '#0f111e', sock: '#ffffff', shoe: '#ffffff', grip: '#222',
    skin: '#f3c9a5', skin2: '#d9a37d', outline: '#1a0f19', eye: '#2b1a12', band: '#ffffff', wrist: '#ffffff',
  }, o);
  const NEW_LOOKS = {
    xiaohong: L({
      name: '小红', hair: 'side', glasses: 'rect', shirt: '#e8364f', shirt2: '#9c1630', panel: '#1d2a4d', trim: '#ffd23f', stripe: '#e8364f',
      shorts: '#1d2a4d', shorts2: '#111a33', skin: '#f2c6a0', skin2: '#d49d77',
      hairC: '#1b1418', hairHi: '#4b3640', band: '#ffd23f', sole: '#e8364f', racket: '#ff3d6b', racket2: '#ffd23f',
      wrist: '#1d2a4d', num: '1', swoosh: '255,120,140',
    }),
    ranran: L({
      name: '冉冉', hair: 'twin', shirt: '#ff8fbf', shirt2: '#d9508b', panel: '#fff3f8', trim: '#ffffff', stripe: '#ff8fbf',
      shorts: '#ffffff', shorts2: '#f0d7e3', skin: '#f8d6bb', skin2: '#e0b090',
      hairC: '#4a2a24', hairHi: '#86564a', band: '#ffffff', sole: '#ff8fbf', racket: '#ff9ec7', racket2: '#ffffff',
      eye: '#3a2020', wrist: '#ffd6e8', num: '3', swoosh: '255,160,200', blush: 0.4,
    }),
    ruibao: L({
      name: '王瑞', hair: 'buzz', shirt: '#ffb02e', shirt2: '#cc7a0a', panel: '#fff3d6', trim: '#ff6a3d', stripe: '#ffb02e',
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
    xingxing: L({
      name: '星星', hair: 'long', shirt: '#3a4bd8', shirt2: '#1f2a8a', panel: '#ffe27a', trim: '#ffe27a', stripe: '#3a4bd8',
      shorts: '#ffffff', shorts2: '#dcdff2', skin: '#f6d0b0', skin2: '#dcab88',
      hairC: '#3b2418', hairHi: '#7a5038', band: '#ffe27a', sole: '#ffe27a', racket: '#ffe27a', racket2: '#6c7cff',
      eye: '#2a1f3d', wrist: '#ffe27a', num: '6', swoosh: '255,226,122', blush: 0.3,
    }),
    lu: L({
      name: '路先森', hair: 'mess', glasses: 'rect', chubby: true, plaid: '#2a4f9a', shirt: '#4f86e0', shirt2: '#2c5bb0', panel: '#4f86e0', trim: '#ffffff', stripe: '#ffffff',
      shorts: '#3b3f4f', shorts2: '#262935', skin: '#f0c49c', skin2: '#d29b72',
      hairC: '#231a14', hairHi: '#54402f', sole: '#4f86e0', racket: '#3fa9ff', racket2: '#ffffff',
      wrist: '#ffffff', num: '404', swoosh: '120,200,255',
    }),
    houzi: L({
      name: '猴子', hair: 'crew', brow: true, muzzle: true, bigEars: true, belly: 1.25, headScale: 0.84,
      shirt: '#d9822b', shirt2: '#9c5416', panel: '#2b1d14', trim: '#ffcf5a', stripe: '#d9822b',
      shorts: '#3b2a1f', shorts2: '#24180f', skin: '#e8b78e', skin2: '#c98f65',
      hairC: '#22170f', hairHi: '#4a3524', band: '#ffcf5a', sole: '#ffcf5a', racket: '#ff9d2e', racket2: '#2b1d14',
      eye: '#24160c', wrist: '#ffcf5a', num: 'GG', swoosh: '255,180,90',
    }),
    laochen: L({
      name: '老陈', hair: 'part', glasses: 'round', slim: true,
      shirt: '#2fb5a8', shirt2: '#17786f', panel: '#e9fbf7', trim: '#ffffff', stripe: '#2fb5a8',
      shorts: '#2b3340', shorts2: '#1a2029', skin: '#f2cfae', skin2: '#d6a882',
      hairC: '#1c1a1a', hairHi: '#4a4444', sole: '#6fe3d0', racket: '#6fe3d0', racket2: '#ffffff',
      wrist: '#6fe3d0', num: '01', swoosh: '110,227,208',
    }),
    guoge: L({
      name: '果哥', hair: 'quiff', buff: true, tank: true, headband: true,
      shirt: '#2a2a33', shirt2: '#141418', panel: '#ff3d6b', trim: '#ff3d6b', stripe: '#ff3d6b',
      shorts: '#18181f', shorts2: '#0c0c11', skin: '#e2a679', skin2: '#c0835a',
      hairC: '#17110d', hairHi: '#5a4433', band: '#ff3d6b', sole: '#ff3d6b', shoe: '#22222b', racket: '#ff3d6b', racket2: '#1d1d24',
      wrist: '#ff3d6b', num: '99', swoosh: '255,90,140',
    }),
    zhu: L({
      name: '朱老师', hair: 'gray', glasses: 'round', age: true, whistle: true, shirt: '#1f8a5b', shirt2: '#0f5c3b', panel: '#ffffff', trim: '#ffffff', stripe: '#ffffff',
      shorts: '#173b2c', shorts2: '#0c2419', skin: '#ecc19b', skin2: '#c99670',
      hairC: '#b9bec8', hairHi: '#eef1f6', band: '#ffffff', sole: '#1f8a5b', racket: '#2fd38a', racket2: '#ffffff',
      eye: '#2a2018', wrist: '#ffffff', num: '50', swoosh: '140,255,190',
    }),
  };

  // ---------- 角色 ----------
  // fx：基础属性偏移；lock：解锁说明（故事关卡 id）
  const CHARS = [
    { id: 'lingfeng', look: 0, title: '追风少年', skill: 'pokong', passive: 'chengzhang', acts: ['pokong', 'huiwei', 'quanli'], fx: {},
      bio: '刚转学到星光城的新生，捡到一只会说话的羽毛球后，被卷进了拯救老球馆的大冒险。没有短板，也没有绝活——但成长最快。' },
    { id: 'canglan', look: 1, title: '潮汐守望者', skill: 'chaoxi', passive: 'chaoxi_p', acts: ['chaoxi', 'tuichao', 'changchao'], fx: { regen: 0.08, stamCost: -0.05, control: 0.04, power: -0.03 },
      bio: '羽跃社的老社员，习惯第一个到、最后一个关灯。体能与防守可靠，却总把维护球馆的事揽在自己身上。她正在学习：让别人一起承担，也是一种信任。' },
    { id: 'xiaohong', look: 'xiaohong', title: '理科社长', skill: 'lieyan', passive: 'zuiyou', acts: ['lieyan', 'lianzha', 'gongshi'], fx: { power: 0.1, jump: 0.03, control: -0.05, stamCost: 0.04 }, lock: '0-3',
      bio: '羽跃社社长，喜欢把训练写成公式的理科生。重杀犀利，却容易急着一拍结束；他开始明白，计划也要为失误和伙伴留出位置。与星星一起走过的十二盏路灯，是一天最慢的路。' },
    { id: 'ranran', look: 'ranran', title: '甜心网前手', skill: 'huanshi', passive: 'xini', acts: ['huanshi', 'cuoqiu', 'tianmi'], fx: { touch: 0.12, control: 0.05, power: -0.07, stamCost: 0.03 }, lock: '2-1',
      bio: '被星星拉来参观后，迷上网前轻轻一放的细腻手感。她擅长用小动作改变局面，也敢提醒社长安排休息。开放日里，她希望让新手接住自己的第一个球。' },
    { id: 'ruibao', look: 'ruibao', title: '移动城墙', skill: 'tiebi', passive: 'baozi', acts: ['tiebi', 'baoxian', 'fantan'], fx: { reach: 0.08, defense: 0.1, move: -0.06, regen: 0.06 }, lock: '1-2',
      bio: '王瑞，朋友们叫他瑞宝。热爱包子，也珍惜每一个回合。和小红、丁丁、猴子从初中起就是一伙的。稳定防守是他的拿手好戏，可他最不想听到的一句话是“你就负责挡着”。' },
    { id: 'xingxing', look: 'xingxing', title: '追光的星星', skill: 'liuxing', passive: 'zhuiguang', acts: ['liuxing', 'liuxingyu', 'xinggui'], fx: { touch: 0.08, move: 0.05, accel: 0.04, power: -0.04 }, lock: '2-4',
      bio: '文艺委员，天文社社长，笑起来眼睛弯成月牙。网前球又快又刁，像流星划过。和小红是从小学起的同桌，晚自习后总是一起走那段有路灯的小路。' },
    { id: 'dingding', look: 'dingding', title: '穿线机之子', skill: 'shanbu', passive: 'chuanxian', acts: ['shanbu', 'pingchou', 'yibo'], fx: { move: 0.08, accel: 0.1, power: -0.08, handling: -0.05 }, lock: '3-2',
      bio: '家里开穿线铺，背得出每支球拍的平衡点和中杆硬度。个子小、跑得快，像只装了弹簧的松鼠。和猴子是多年的 Dota2 开黑搭档，打球和打游戏一样急：总想一波推完。' },
    { id: 'houzi', look: 'houzi', title: '乐天猿人', skill: 'shanxian', passive: 'wenti', acts: ['shanxian', 'duzi', 'huicheng'], fx: { handling: -0.1, defense: 0.1, reach: 0.06, touch: 0.04, power: 0.04, move: -0.03, jump: -0.06, stamCost: 0.03 }, lock: '1-4',
      bio: '肚子圆、脸小、眉骨高，长得像课本里的北京猿人，于是从初中起就叫“猴子”。性格随和，天塌下来也先说“问题不大”。手机不离手，和丁丁是 Dota2 的老搭档。手快、反应快，就是不爱跑——所以他练出了一手“闪现”。' },
    { id: 'lu', look: 'lu', title: '气氛担当', skill: 'lengxiao', passive: 'qifen', acts: ['lengxiao', 'err404', 'shenglv'], fx: { power: 0.06, reach: 0.06, regen: 0.04, move: -0.07, jump: -0.05 }, lock: '4-2',
      bio: '电脑社社长，随身带着胜率模型和冷笑话。和老陈好到连上厕所都要结伴。起初只相信模型，后来发现：不能被一个数字说清的人，才值得继续了解。' },
    { id: 'laochen', look: 'laochen', title: '表格里的温度', skill: 'shuju', passive: 'jilu', acts: ['shuju', 'qingxi', 'rebei'], fx: { move: 0.06, jump: 0.06, control: 0.08, stamCost: -0.06, power: -0.1, defense: -0.04 }, lock: '4-5',
      bio: '路先森形影不离的密友，热情得像一杯随时续满的热水。最爱整理数据，签到表到他手里都会变得干干净净。瘦得像根竹竿，一顿能吃四碗饭也不长肉。他一直觉得自己只配坐在场边记数据。' },
    { id: 'guoge', look: 'guoge', title: '健身房投资人', skill: 'touji', passive: 'benneng', acts: ['touji', 'wotui', 'tangping'], fx: { power: 0.09, jump: 0.04, stamCost: 0.14, regen: -0.08, control: -0.08, move: -0.03 }, lock: '5-5',
      bio: '健身房常驻会员，胸肌比课本厚，能躺着绝不坐着。典型的投机主义者：哪边要赢就往哪边站，“分散投资”是口头禅。爆发力惊人，耐力却经不起三个回合的拉锯。' },
    { id: 'tianchu', look: 'tianchu', title: '镜花水月', skill: 'jinghua', passive: 'xushi', acts: ['jinghua', 'shuiyue', 'hanxing'], fx: { power: 0.05, control: 0.05, jump: 0.06, touch: 0.04, stamCost: 0.05 }, lock: '7-5',
      bio: '寒星中学的王牌，冷静而神秘。同一个引拍动作能打出三种球——“你看到的，未必是真的。”' },
    { id: 'zhu', look: 'zhu', title: '球馆的老朱', skill: 'jiaoke', passive: 'qiuling', acts: ['jiaoke', 'shaosheng', 'baowen'], fx: { control: 0.1, touch: 0.06, defense: 0.05, move: -0.08, jump: -0.08, regen: -0.04 }, lock: '6-5',
      bio: '教了三十年物理的朱老师，打了三十五年羽毛球。保温杯里泡着枸杞，口袋里装着哨子，每天傍晚准时出现在球馆，和学生们“切磋两拍”。跑得不快，但球总能落在你最难受的地方。' },
  ];
  const CHAR_BY = {};
  for (const c of CHARS) CHAR_BY[c.id] = c;
  YY.CHARS = CHARS;
  YY.char = (id) => CHAR_BY[id] || CHARS[0];
  /** 角色的技能组：被动 + 选中的 2 个主动（pick 不合法时用前两个） */
  YY.skillSet = function (id, pick) {
    const c = YY.char(id), acts = c.acts || [c.skill];
    const ok = Array.isArray(pick) ? [...new Set(pick.filter((k) => acts.includes(k)))] : [];
    for (const k of acts) if (ok.length < 2 && !ok.includes(k)) ok.push(k);
    return { passive: c.passive || null, act: ok.slice(0, 2) };
  };
  /** 某个主动技能属于哪个角色 */
  YY.skillOwner = (sk) => CHARS.find((c) => (c.acts || []).includes(sk) || c.passive === sk) || null;
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
      { id: 'r_silk', name: '绣羽控球拍', spec: '4U · 均衡 · 方圆拍框', fx: { touch: 0.12, control: 0.06, power: -0.03 }, lock: '2-1',
        desc: '冉冉的同款。拍框稳定、反馈细腻，搓放和推吊的落点更准。' },
      { id: 'r_heavy', name: '雷霆进攻拍', spec: '3U · 头重 · 中杆硬', fx: { power: 0.12, handling: 0.1, control: -0.04, defense: -0.06 }, lock: '3-1',
        desc: '头重让挥拍惯性更大，杀球更沉更快；代价是挥拍偏慢，被动防守时容易来不及。' },
      { id: 'r_light', name: '疾风速度拍', spec: '5U · 头轻 · 中杆适中', fx: { handling: -0.12, defense: 0.1, power: -0.06 }, lock: '3-1',
        desc: '头轻拍挥动灵活，连续平抽、接杀反应快；但扣杀的“分量”不如头重拍。' },
      { id: 'r_star', name: '星光限定拍', spec: '4U · 微头重 · 高模量碳纤维', fx: { power: 0.07, control: 0.05, handling: -0.03 }, lock: '7-5',
        desc: '星光杯冠军奖品。高模量碳纤维让拍框又轻又硬，力量和控制兼得。' },
    ],
    string: [
      { id: 's_dur', name: '耐打线', spec: '0.70 mm · 单芯尼龙', fx: { control: 0.02, power: -0.02 },
        desc: '线径粗、最耐打，适合天天练球的新手。弹性一般，击球声偏闷。' },
      { id: 's_ctrl', name: '控球线', spec: '0.68 mm · 磨砂涂层', fx: { touch: 0.06, control: 0.04, power: -0.02 }, lock: '3-3',
        desc: '表面涂层增加“咬球”时间，网前搓放、劈吊更好控制落点。' },
      { id: 's_crisp', name: '清脆线', spec: '0.62 mm · 多股编织', fx: { power: 0.04, touch: 0.02, reach: -0.02 }, lock: '3-2',
        desc: '超细线径，击球声“砰砰”清脆，弹性好；缺点是很容易断，甜区也略窄。' },
      { id: 's_rep', name: '高弹线', spec: '0.66 mm · 高弹复合芯', fx: { power: 0.06, control: -0.02 }, lock: '6-3',
        desc: '弹性好、回弹快，同样的挥速能把球打得更快更远，适合进攻型打法。' },
    ],
    shoe: [
      { id: 'sh_basic', name: '入门训练鞋', spec: '生胶底 · 低帮', fx: {},
        desc: '专业羽毛球鞋的基础款：生胶鞋底在木地板上抓地好，低帮方便脚踝灵活转动。' },
      { id: 'sh_run', name: '你的旧跑鞋', spec: '厚泡棉 · 高鞋跟', fx: { move: 0.02, accel: -0.12, lunge: 0.3, land: 0.2 },
        desc: '跑鞋为直线前进设计：鞋底厚而软、侧向支撑弱。在球场急停变向容易打滑甚至崴脚——试试就知道了。' },
      { id: 'sh_cushion', name: '云垫缓震鞋', spec: '全掌缓震 · 足跟稳定片', fx: { land: -0.5, stamCost: -0.08, jump: 0.03 }, lock: '1-2',
        desc: '起跳落地的冲击被吸收，落地后能更快再次启动，连续跳杀也更省力。' },
      { id: 'sh_stable', name: '磐石防侧翻鞋', spec: '宽底盘 · 侧向支撑', fx: { accel: 0.1, lunge: -0.4 }, lock: '5-3',
        desc: '宽鞋底和侧面支撑片让急停、蹬转更稳；跑动中勉强击球时，回球也不容易变形。' },
      { id: 'sh_light', name: '羽翼轻量鞋', spec: '轻量鞋面 · 薄底', fx: { move: 0.06, accel: 0.04, land: 0.2 }, lock: '6-3',
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
  // v1 → v2：故事扩写后插入了新章节，旧关卡编号顺延
  const STAGE_V2 = { 2: 3, 3: 5, 4: 6, 5: 7 };
  YY.migrateStageId = (id) => id.replace(/^(\d+)-/, (m, c) => (STAGE_V2[c] || c) + '-');
  const DEFAULT = () => ({
    v: 3,
    chars: ['lingfeng', 'canglan'],
    gear: ['r_basic', 's_dur', 'sh_basic', 'sh_run'],
    cards: [],
    feats: [],
    stages: {},
    seen: {},
    campaign: { choices: {}, clues: [], best: {}, checkpoint: null },
    sel: { char: 'lingfeng', racket: 'r_basic', string: 's_dur', tension: 24, shoe: 'sh_basic' },
    kits: {},
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
      const legacy = !(d.v >= 2);
      for (const [id, stars] of Object.entries(d.stages && typeof d.stages === 'object' ? d.stages : {})) {
        if (/^\d+-\d+$/.test(id) && Number.isInteger(stars) && stars >= 1 && stars <= 3) clean.stages[legacy ? YY.migrateStageId(id) : id] = stars;
      }
      clean.seen = {};
      for (const [id, value] of Object.entries(d.seen && typeof d.seen === 'object' ? d.seen : {})) if (/^card:[\w-]+$/.test(id) && value) clean.seen[id] = true;
      clean.sel = { ...def.sel, ...(d.sel && typeof d.sel === 'object' ? d.sel : {}) };
      if (!clean.chars.includes(clean.sel.char)) clean.sel.char = def.sel.char;
      for (const key of ['racket', 'string', 'shoe']) if (!clean.gear.includes(clean.sel[key]) || GEAR_BY[clean.sel[key]]?.cat !== key) clean.sel[key] = def.sel[key];
      clean.kits = {};
      for (const [id, pick] of Object.entries(d.kits && typeof d.kits === 'object' ? d.kits : {})) if (CHAR_BY[id] && Array.isArray(pick)) clean.kits[id] = YY.skillSet(id, pick).act;
      clean.sel.tension = Number.isFinite(clean.sel.tension) ? Math.max(20, Math.min(30, Math.round(clean.sel.tension))) : 24;
      // v3 重写了剧本：旧版的环节进度与选择不再对应，保留通关星级、角色与装备
      const cp = d.v >= 3 ? d.campaign : null;
      if (cp && typeof cp === 'object') {
        for (const [key,value] of Object.entries(cp.choices || {})) if (/^[a-z]{1,24}$/.test(key) && !['constructor','prototype'].includes(key) && typeof value === 'string') clean.campaign.choices[key] = value.slice(0,120);
        clean.campaign.clues = [...new Set((Array.isArray(cp.clues)?cp.clues:[]).filter(v=>typeof v==='string' && /^[a-z-]{1,32}$/.test(v)))].slice(0,100);
        for (const [key,value] of Object.entries(cp.best || {})) if (/^\d+-\d+:\d+$/.test(key) && Number.isInteger(value) && value>=1 && value<=3) clean.campaign.best[key]=value;
        const c=cp.checkpoint;
        if(c && c.version===1 && /^\d+-\d+$/.test(c.stage) && Number.isInteger(c.index) && c.index>=0 && c.index<30) {
          clean.campaign.checkpoint={version:1,stage:c.stage,index:c.index,line:Number.isInteger(c.line)&&c.line>=0?c.line:0,
            stars:(Array.isArray(c.stars)?c.stars:[]).filter(n=>Number.isInteger(n)&&n>=1&&n<=3).slice(0,30),
            ctx:{pickOk:c.ctx?.pickOk!==false,choices:{...clean.campaign.choices},env:c.ctx?.env && typeof c.ctx.env==='object'?{wind:Math.max(-3,Math.min(3,Number(c.ctx.env.wind)||0)),adapt:Math.max(0,Math.min(1,Number(c.ctx.env.adapt)||0))}:null},
            activity:{found:(Array.isArray(c.activity?.found)?c.activity.found:[]).filter(v=>typeof v==='string').slice(0,20)}};
        }
      }
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
    /** 当前为该角色携带的 2 个主动技能 */
    kit(id) { return YY.skillSet(id, this.d.kits && this.d.kits[id]).act; },
    /** 切换携带：已带的点一下换成另一个未带的；未带的点一下替换掉较早选的那个 */
    toggleKit(id, sk) {
      const acts = YY.char(id).acts || [], cur = this.kit(id);
      if (!acts.includes(sk) || cur.includes(sk)) return cur;
      const next = [cur[1], sk];
      this.d.kits = this.d.kits || {}; this.d.kits[id] = YY.skillSet(id, next).act; this.save();
      return this.d.kits[id];
    },
    /** 直接设定携带的两个主动技能（选择面板确认时调用），非法输入回落到默认组合 */
    setKit(id, kit) {
      const next = YY.skillSet(id, kit).act;
      this.d.kits = this.d.kits || {}; this.d.kits[id] = next; this.save();
      return next;
    },
    /** 依次切换三种携带组合：一+二 → 一+三 → 二+三 */
    cycleKit(id) {
      const acts = YY.char(id).acts || [], cur = this.kit(id).join();
      const combos = [[0, 1], [0, 2], [1, 2]].map(([i, j]) => [acts[i], acts[j]]).filter((c) => c[0] && c[1]);
      const k = combos.findIndex((c) => c.join() === cur), next = combos[(k + 1) % combos.length] || cur.split(',');
      this.d.kits = this.d.kits || {}; this.d.kits[id] = next; this.save();
      return next;
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
