/* 羽跃对决 · 故事模式：剧情、关卡、知识图鉴，以及步法 / 发球两种小游戏
 * 关卡由若干步骤组成：dialog（对话）、quiz（问答）、pick（选择，影响下一场）、
 * drill（发球机练习）、footwork（步法）、serve（发球）、match（比赛）。
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
    { id: 'c_shuttle', cat: 'gear', title: '羽毛球的构造', text: '一只比赛用羽毛球由 16 根羽毛插在软木球托上制成，重 4.74–5.50 克。高品质的球选用同一侧翅膀的羽毛，飞行时旋转更稳定。鹅毛球手感好、飞得稳；鸭毛球更便宜；尼龙球耐打，适合练习。' },
    { id: 'c_rules', cat: 'rule', title: '计分规则', text: '每球得分制：每一回合都会产生得分方。每局 21 分，20 平后需领先 2 分，29 平时先得 30 分者胜。三局两胜，决胜局有一方到 11 分时交换场地。游戏里为了节奏改成了 7 分制。' },
    { id: 'c_court', cat: 'rule', title: '球场与球网', text: '球场全长 13.4 米，单打宽 5.18 米、双打宽 6.1 米。球网两端高 1.55 米，中间高 1.524 米。球落在线上算界内——所以压线球总是最让人激动。' },
    { id: 'c_grip', cat: 'tech', title: '握拍', text: '正手握拍像和人握手：虎口对准拍柄窄面，手指自然分开。反手握拍时把拇指贴在拍柄宽面上。平时握松一点，击球瞬间再握紧，手腕才灵活。' },
    { id: 'c_clear', cat: 'tech', title: '高远球', text: '侧身对网，持拍手提前举拍，在头顶前上方的最高点击球；蹬地、转体、挥臂一气呵成。高远球要高、要远，把对手压到底线，也为自己争取回位时间。' },
    { id: 'c_drop', cat: 'tech', title: '吊球与网前', text: '吊球和高远球的准备动作一样，击球瞬间突然减力“切”球，让球贴网下坠。网前搓球让球翻滚着过网，对手很难回出好球。' },
    { id: 'c_footwork', cat: 'tech', title: '步法', text: '对手击球的瞬间做一个小小的分腿跳（启动步），落地即向来球方向蹬出。上网常用交叉步、并步接弓箭步，后退用侧身后撤步。每一拍打完都要回到场地中心。' },
    { id: 'c_shoes', cat: 'gear', title: '羽毛球鞋', text: '羽毛球需要频繁急停、侧向蹬转。专业球鞋多为生胶底、抓地力强，鞋帮低而稳，前掌和足跟有缓震。跑鞋鞋底厚软、侧向支撑弱，在球场上容易打滑、崴脚。' },
    { id: 'c_racket', cat: 'gear', title: '球拍参数', text: '重量用 U 表示：3U 约 85–89 克，4U 约 80–84 克，5U 约 75–79 克。平衡点靠拍头为头重（进攻型），靠拍柄为头轻（速度型）。中杆软更容易发力，中杆硬控球更准。拍柄粗细用 G 表示。' },
    { id: 'c_string', cat: 'gear', title: '球线', text: '常见线径 0.61–0.70 毫米。细线弹性好、击球声清脆，但不耐打；粗线耐用，适合天天练球的初学者。线的表面涂层会影响“持球”的感觉。' },
    { id: 'c_tension', cat: 'gear', title: '磅数', text: '磅数是穿线时把线拉紧的力量。低磅（20–24 磅）弹性大、甜区大、省力；高磅（26 磅以上）控制精准、手感清脆，但需要更快的挥速，也更容易断线。穿线不要超过拍框上标注的最高磅数。' },
    { id: 'c_history', cat: 'fun', title: '名字的由来', text: '羽毛球的英文名 Badminton 来自英国的伯明顿庄园（Badminton House）。19 世纪下半叶，人们在那里玩一种用拍子来回击打羽毛球的游戏。1992 年，羽毛球成为奥运会正式比赛项目。' },
    { id: 'c_wind', cat: 'tactic', title: '风与场馆', text: '羽毛球很轻，最怕风。正式比赛的场馆会避免空调直吹场地。赛前挑边时可以先观察风向：顺风时高远球要收一点，顶风时要更积极地发力。' },
    { id: 'c_read', cat: 'tactic', title: '预判', text: '高手的反应并不比别人快多少，而是更早“看出”球路：对手的站位、引拍、身体朝向、拍面角度，甚至击球的声音，都在泄露信息。' },
    { id: 'c_serve', cat: 'rule', title: '发球规则', text: '击球瞬间，整个球要低于 1.15 米；发球员和接发球员都站在对角的发球区内，双脚不能离地或移动；发球动作要连贯，不能故意停顿。网前球要贴网落在前发球线后，高远球要把对手逼到底线。' },
    { id: 'c_speed', cat: 'gear', title: '球速号', text: '球筒上的 76、77、78、79 等数字代表球速，数字越小球越慢。海拔高、气温高时空气阻力小，要用慢速球；寒冷的平原地区用快速球。测试方法：在底线低手全力击打高远球，球应落在对方底线前 53–99 厘米之间。' },
    { id: 'c_defense', cat: 'tech', title: '接杀', text: '接杀时降低重心、双脚略宽于肩，拍子放在身体前方。不要大幅挥拍：借对方杀球的力量“挡”回网前，或者用手腕快速挑回后场。' },
    { id: 'c_smash', cat: 'tech', title: '杀球', text: '在球下落前起跳，空中侧身展腹；在最高点击球，前臂内旋，手腕和手指瞬间发力。击球点越高、越靠前，球路越陡。打完马上收拍落地，准备下一拍。' },
    { id: 'c_warmup', cat: 'tech', title: '热身与拉伸', text: '打球前先慢跑 5 分钟，再活动手腕、肩、膝和脚踝，做几组弓箭步和小跳。打完球做静态拉伸，能减少肌肉酸痛和受伤。' },
    { id: 'c_feint', cat: 'tactic', title: '假动作', text: '所有球路都用尽量一样的准备动作，直到击球瞬间才决定方向和力量，这就是假动作。应对方法：对手击球时做好启动步，重心保持在中间，看清再出发。' },
    { id: 'c_record', cat: 'fun', title: '最快的杀球', text: '羽毛球是初速度最快的球类运动之一。吉尼斯世界纪录中最快的羽毛球杀球达到每小时 565 公里（2023 年，印度选手萨特维克）。但羽毛阻力很大，球飞到对方场地时已经慢了许多。' },
    { id: 'c_etiquette', cat: 'rule', title: '球场礼仪', text: '比赛前后与对手、裁判握手致意；把球还给对方时用拍子轻轻送过网；地上有汗水要及时擦干——既是礼貌，也能防止滑倒受伤。' },
  ];
  YY.CARDS = CARDS;
  YY.card = (id) => CARDS.find((c) => c.id === id);

  // ---------- 关卡 ----------
  const W = (need, att) => ({ text: `${att} 次以内完成`, test: (r) => r.att <= att }); // 练习类星级
  const STORY = [
    {
      id: 'ch0', title: '序章 · 会说话的羽毛球', venue: 'arena', blurb: '星光体育馆要被拆了——除非羽跃社拿下星光杯。',
      stages: [
        {
          id: '0-1', title: '储物间里的声音', kind: 'drill', desc: '跟着落点提示，接住发球机的来球。',
          steps: [
            { t: 'dialog', lines: [
              ['nar', '开学第一天，你被分配去打扫星光体育馆的储物间。灰尘里，一只旧羽毛球突然动了一下。'],
              ['mm', '咳咳咳——总算有人来了！喂，新同学，别用扫把扫我！'],
              ['me', '……羽毛球，会说话？'],
              ['mm', '我叫毛毛！十六根鹅毛加一个软木球头，体重 5 克，标准得很。我在这个球馆住了三十年。'],
              ['mm', '坏消息是：一个月后，这里要被拆掉改成停车场。除非羽跃社拿下“星光杯”冠军。'],
              ['me', '羽跃社？'],
              ['mm', '就是现在只剩两个人的那个社团——加上你，三个！先别急着拒绝，来，接几个球试试手感。'],
              ['mm', '地上的黄色圈是球会落下的地方，青色脚印是最佳站位。提前跑过去，看到“挥拍！”再出手。'],
            ] },
            { t: 'drill', def: { name: '第一次挥拍', judge: 'receive', tip: '跟着黄色落点移动，看到“挥拍！”再出手。', feeds: { clear: 2, lift: 2, drop: 1 }, goal: { need: 4, total: 8 } },
              stars: [W(4, 5), W(4, 4)] },
            { t: 'dialog', lines: [
              ['mm', '不错不错！你挥拍的样子，让我想起三十年前的一位冠军……好吧，其实一点也不像，但有潜力！'],
              ['mm', '这张「羽球图鉴」送你。每学会一个知识，我就给你一张——在主菜单的「图鉴」里随时翻看。'],
            ] },
          ],
          rewards: { cards: ['c_shuttle'] },
        },
        {
          id: '0-2', title: '毛毛的小测验', kind: 'quiz', desc: '认识一下你手里的“对手”。',
          steps: [
            { t: 'dialog', lines: [['mm', '打球之前，先认识一下你的老朋友——也就是我。答对两题就算过关！']] },
            { t: 'quiz', need: 2, qs: [
              { q: '一只标准的比赛用羽毛球由几根羽毛组成？', o: ['12 根', '16 根', '20 根', '24 根'], a: 1, exp: '16 根羽毛插在软木球托上，而且最好来自同一侧翅膀，这样球在空中旋转得才稳定。' },
              { q: '比赛中，球落在边线上算什么？', o: ['出界', '界内', '重发', '看裁判心情'], a: 1, exp: '压线算界内！所以“压线好球”最让人激动。' },
              { q: '正式比赛中，一局打到多少分？', o: ['11 分', '15 分', '21 分', '7 分'], a: 2, exp: '正式比赛每局 21 分、每球得分制；20 平后要领先 2 分，29 平时先到 30 分者胜。游戏里改成了 7 分制。' },
            ] },
            { t: 'dialog', lines: [['mm', '知识就是力量！走，去见见社长——她正在场上“发火”呢。']] },
          ],
          rewards: { cards: ['c_rules', 'c_court'] },
        },
        {
          id: '0-3', title: '社长的入社考试', kind: 'match', desc: '5 分制，赢下社长小红，成为正式社员。',
          steps: [
            { t: 'dialog', lines: [
              ['xiaohong', '新人？会打球吗？不会也没关系——杀就完了！'],
              ['me', '我……今天第一次摸拍子。'],
              ['xiaohong', '那正好！我来教你什么叫“被杀的感觉”。5 分制，赢了我，你就是正式社员！'],
              ['mm', '（小声）她扣杀很凶，但很耗体力。多打高远球把她调到后场，等她累了再反击。'],
              ['mm', '对了，你也有技能！好球会给头像外的能量环充能，充满后按 I 键（手机点「技能」）发动「破空一击」。'],
            ] },
            { t: 'match', opp: 'xiaohong', level: 'easy', target: 5, cap: 7,
              stars: [{ text: '至少一次扣杀得分', test: (r) => r.st.smashWin >= 1 }, { text: '失误不超过 3 次', test: (r) => r.st.errors <= 3 }] },
            { t: 'dialog', lines: [
              ['xiaohong', '呼……呼……行啊你！从今天起，你就是羽跃社第三号社员！'],
              ['xiaohong', '这支「柔风入门拍」送你，中杆软，新手好发力。下次换我当你的队友！'],
              ['mm', '小红加入了你的阵容！在主菜单「角色与装备」里可以选她出战。她的技能「烈焰重杀」超凶的。'],
            ] },
          ],
          rewards: { chars: ['xiaohong'], gear: ['r_flex'], cards: ['c_grip'] },
        },
      ],
    },
    {
      id: 'ch1', title: '第一章 · 社团招新大作战', venue: 'sunset', blurb: '星光杯需要五名队员。报名的……只有一只猫。',
      stages: [
        {
          id: '1-1', title: '天台高远球', kind: 'drill', desc: '把球打进对方后场的金色区域。',
          steps: [
            { t: 'dialog', lines: [
              ['nar', '要参加星光杯，羽跃社至少需要五名队员。招新海报贴满了校园……然而报名的只有一只猫。'],
              ['xiaohong', '不行！我们去天台搞一场“高远球表演”，让全校都看到！'],
              ['mm', '高远球要领：侧身对网、提前举拍，在头顶最高点击球，蹬地转体带动手臂发力。'],
              ['mm', '把球送进对方后场的金色区域。打得越深，对手越被动。'],
            ] },
            { t: 'drill', def: { name: '高远球表演', judge: 'clear', goal: { need: 5, total: 9 } }, stars: [W(5, 7), W(5, 5)] },
            { t: 'dialog', lines: [['nar', '楼下传来一阵掌声。一个抱着书的女生停下了脚步，抬头看了很久。']] },
          ],
          rewards: { cards: ['c_clear'] },
        },
        {
          id: '1-2', title: '图书馆的网前诗人', kind: 'match', desc: '先练吊球，再在网前赢下冉冉。',
          steps: [
            { t: 'dialog', lines: [
              ['ranran', '……你们的球，好吵。'],
              ['xiaohong', '同学！要不要加入羽跃社？包教包会！'],
              ['ranran', '我只喜欢……慢慢的东西。比如，网前的小球。'],
              ['mm', '吊球！和高远球用一样的引拍，击球瞬间突然减力，让球刚过网就下坠——对手以为你要打后场。'],
            ] },
            { t: 'drill', def: { name: '吊球轻轻放', judge: 'drop', goal: { need: 4, total: 8 } }, stars: [W(4, 6), W(4, 4)] },
            { t: 'dialog', lines: [
              ['ranran', '嗯……还不错。那和我打一局吧。如果你能在网前赢我，我就加入。'],
              ['mm', '冉冉的网前很细腻。她靠近网时，就把球打到她身后的底线去。'],
            ] },
            { t: 'match', opp: 'ranran', level: 'normal', target: 5, cap: 7,
              stars: [{ text: '吊球或网前球得分 ≥ 2', test: (r) => r.x.dropWin >= 2 }, { text: '对手得分不超过 3', test: (r) => r.score[1] <= 3 }] },
            { t: 'dialog', lines: [
              ['ranran', '你的网前，还是很“吵”。不过……我可以教你。'],
              ['ranran', '这支拍子给你。控球型拍框，网前手感会细腻很多。'],
              ['mm', '冉冉加入！她的技能「缓时」能让飞来的球变慢——慢，也是一种快。'],
            ] },
          ],
          rewards: { chars: ['ranran'], gear: ['r_silk'], cards: ['c_drop'] },
        },
        {
          id: '1-3', title: '食堂争霸 · 包子保卫战', kind: 'footwork', desc: '用步法抢包子，再挑战防守怪物瑞宝。',
          steps: [
            { t: 'dialog', lines: [
              ['nar', '中午，食堂。最后一笼鲜肉包刚刚出锅。'],
              ['ruibao', '站住！这笼包子是我的！想要的话，先比比谁的脚步快！'],
              ['mm', '羽毛球的移动叫“步法”。对手击球时先小跳一下（启动步），落地马上蹬向来球方向，打完立刻回中心。'],
              ['mm', '地上会出现光圈：「踩点」站进去就行；「跳」要在圈里起跳；「挥拍」要在圈里挥一下拍。'],
            ] },
            { t: 'footwork', def: { name: '米字步 · 抢包子', need: 8, total: 11, life: 2.7, minLife: 1.7 }, stars: [W(8, 10), W(8, 8)] },
            { t: 'dialog', lines: [
              ['ruibao', '哇，你跑得比我还快！不过——想赢我的防守？没那么简单！'],
              ['mm', '瑞宝几乎什么球都能接回来。耐心一点，打满长回合，再找机会一击制胜。'],
            ] },
            { t: 'match', opp: 'ruibao', level: 'normal', target: 5, cap: 7,
              stars: [{ text: '打出一次 8 拍以上的回合', test: (r) => r.longest >= 8 }, { text: '扣杀得分 ≥ 1', test: (r) => r.st.smashWin >= 1 }] },
            { t: 'dialog', lines: [
              ['ruibao', '好吧好吧，包子分你一半！对了，羽跃社……管饭吗？'],
              ['xiaohong', '管！社长请客！'],
              ['ruibao', '那我加入！这双缓震鞋送你。记住：打球千万别穿跑鞋——会崴脚的！'],
            ] },
          ],
          rewards: { chars: ['ruibao'], gear: ['sh_cushion'], cards: ['c_footwork', 'c_shoes'] },
        },
      ],
    },
    {
      id: 'ch2', title: '第二章 · 穿线机之子', venue: 'neon', blurb: '商业街霓虹灯下的穿线铺，藏着一个器材天才。',
      stages: [
        {
          id: '2-1', title: '穿线铺的谜题', kind: 'quiz', desc: '答对丁丁的器材问题，换两支新球拍。',
          steps: [
            { t: 'dialog', lines: [
              ['nar', '丁丁家的穿线铺藏在商业街的霓虹灯下。墙上挂满了球拍，像一面会发光的墙。'],
              ['dingding', '想让我帮你们挑拍子？先回答问题。不懂器材的人，配不上好球拍。'],
            ] },
            { t: 'quiz', need: 3, qs: [
              { q: '球拍上的“4U”表示什么？', o: ['拍框颜色', '重量等级（约 80–84 克）', '拍线磅数', '适合年龄'], a: 1, exp: 'U 越大越轻：3U 约 85–89 克，4U 约 80–84 克，5U 约 75–79 克。' },
              { q: '“头重拍”更适合哪种打法？', o: ['进攻杀球', '网前搓球', '防守平抽', '只用来发球'], a: 0, exp: '平衡点靠近拍头，挥拍惯性大，杀球更沉；但连续防守时挥拍会慢半拍。' },
              { q: '中杆偏软的球拍有什么特点？', o: ['需要很大力量', '挥速慢也容易把球打远', '完全不能扣杀', '一打就断'], a: 1, exp: '软中杆击球时弯曲储能再弹回，“借”给你力量；挥速很快的高手反而偏爱硬中杆，控球更准。' },
              { q: '拍柄上的“G4、G5”说的是？', o: ['拍柄粗细', '球拍产地', '保修年限', '球线颜色'], a: 0, exp: '常见标准里 G 后的数字越大，拍柄越细。手小的人可以选细一点的，再用手胶调整手感。' },
            ] },
            { t: 'dialog', lines: [
              ['dingding', '及格。这两支给你试：一支头重，专门进攻；一支头轻，专门抢速度。'],
              ['dingding', '没有最好的拍子，只有最适合你打法的拍子。'],
            ] },
          ],
          rewards: { gear: ['r_heavy', 'r_light'], cards: ['c_racket'] },
        },
        {
          id: '2-2', title: '磅数的秘密', kind: 'quiz', desc: '帮三位客人决定穿多少磅。',
          steps: [
            { t: 'dialog', lines: [
              ['dingding', '拍子选好了，还得穿线。线和磅数，决定了击球的“手感”。'],
              ['dingding', '今天店里来了三位客人，你来帮我决定。'],
            ] },
            { t: 'quiz', need: 2, qs: [
              { q: '小学生小宇刚开始学球，力气不大。给他穿多少磅？', o: ['20–22 磅', '28–30 磅', '35 磅', '不穿线'], a: 0, exp: '低磅弹性好、甜区大，力气小也能把球打远。磅数太高，拍面会“硬得打不动”。' },
              { q: '校队主力想让杀球落点更准、手感更“脆”。建议？', o: ['降到 18 磅', '适当提高到 26–28 磅', '换成橡皮筋', '越松越好'], a: 1, exp: '磅数高，球在拍面上形变小，控制更精准；但对挥速和发力要求更高，也更容易断线。' },
              { q: '0.62 毫米的细线和 0.70 毫米的粗线相比？', o: ['细线更耐打', '细线弹性更好、声音清脆，但容易断', '粗线一定更好', '没有区别'], a: 1, exp: '细线弹性和声音好，但寿命短；粗线耐打，适合天天练球的初学者。' },
            ] },
            { t: 'dialog', lines: [
              ['dingding', '不错嘛！从今天起你可以在「角色与装备」里自己调磅数了。顺便送你一卷控球线。'],
              ['mm', '磅数能在 20 到 30 之间调：低磅甜区大、省力，高磅控制准——试试哪种最适合你！'],
            ] },
          ],
          rewards: { feats: ['tension'], gear: ['s_ctrl'], cards: ['c_string', 'c_tension'] },
        },
        {
          id: '2-3', title: '闪电松鼠', kind: 'match', desc: '追上速度惊人的丁丁。',
          steps: [
            { t: 'dialog', lines: [
              ['dingding', '器材懂了，球技呢？我可是跑得飞快——你追得上吗？'],
              ['mm', '丁丁脚步很快，网前球很难吊死他。用高远球把他压在底线，再找空当扣杀。'],
            ] },
            { t: 'match', opp: 'dingding', level: 'normal', target: 5, cap: 7,
              stars: [{ text: '扣杀得分 ≥ 2', test: (r) => r.st.smashWin >= 2 }, { text: '完美击球 ≥ 5', test: (r) => r.st.perfect >= 5 }] },
            { t: 'dialog', lines: [
              ['dingding', '数据显示……你的胜率比我算的高了 37%。好吧，我加入！'],
              ['dingding', '以后全队的球拍我来穿线。这卷清脆线送你——听，“砰”的一声多好听！'],
            ] },
          ],
          rewards: { chars: ['dingding'], gear: ['s_crisp'], cards: ['c_history'] },
        },
      ],
    },
    {
      id: 'ch3', title: '第三章 · 风雨老球馆', venue: 'arena', blurb: '暴雨、穿堂风、停电——老球馆给你出了难题。',
      stages: [
        {
          id: '3-1', title: '穿堂风', kind: 'match', desc: '风向每 2 分变换一次，学会看风打球。',
          steps: [
            { t: 'dialog', lines: [
              ['nar', '一场暴雨过后，星光体育馆的旧窗户坏了。呼呼的风从球场一侧灌了进来。'],
              ['canglan', '……今天风大。正好练练。'],
              ['mm', '风会改变球的飞行！顺风时高远球容易出界，要打得收一点；顶风时球会变短，要更用力。'],
              ['mm', '看右上角的风向牌——每打 2 分，风就换个方向，就像正式比赛的换边。'],
            ] },
            { t: 'match', opp: 'canglan', level: 'normal', target: 5, cap: 7, env: { wind: 1.5, adapt: 0.4 }, windFlip: 2,
              stars: [{ text: '自己出界不超过 1 次', test: (r) => r.x.outs <= 1 }, { text: '净胜 2 分以上', test: (r) => r.score[0] - r.score[1] >= 2 }] },
            { t: 'dialog', lines: [
              ['canglan', '你会看风了。比赛前挑场地，先看风向——这是老球馆的规矩。'],
            ] },
          ],
          rewards: { cards: ['c_wind'] },
        },
        {
          id: '3-2', title: '停电夜', kind: 'match', desc: '一片漆黑中，靠预判接住小红的杀球。',
          steps: [
            { t: 'dialog', lines: [
              ['nar', '晚上训练到一半，“啪”——整座球馆停电了，只剩应急灯和窗外的闪电。'],
              ['xiaohong', '太好了！黑暗特训！谁也别想看清我的杀球！'],
              ['mm', '看不清球，就看对手：他的引拍、身体朝向、拍面角度，都在告诉你球要去哪里。'],
              ['mm', '还有——听！扣杀的声音又脆又响，吊球的声音轻轻的。'],
            ] },
            { t: 'match', opp: 'xiaohong', level: 'normal', target: 5, cap: 7, dark: true,
              stars: [{ text: '救球 ≥ 2 次', test: (r) => r.st.saves >= 2 }, { text: '失误不超过 3 次', test: (r) => r.st.errors <= 3 }] },
            { t: 'dialog', lines: [
              ['xiaohong', '灯来了！你在黑暗里居然接住了我的杀球？！'],
              ['mm', '这就是“预判”。高手不是反应特别快，而是比别人更早看出来。'],
            ] },
          ],
          rewards: { cards: ['c_read'] },
        },
        {
          id: '3-3', title: '发球特训', kind: 'serve', desc: '发网前球，落进前发球线后的金色区域。',
          steps: [
            { t: 'dialog', lines: [
              ['canglan', '停电那晚，你发球下网了三次。'],
              ['me', '……你数了？'],
              ['canglan', '发球是唯一完全由自己掌控的球。练好它。'],
              ['mm', '规则：击球瞬间，整个球要低于 1.15 米；站在发球区内，脚不能离地或移动。'],
              ['mm', '按「吊球」发网前球，让球刚过网，落在前发球线后的金色区域。白色指针在绿色区间时出手最稳。'],
            ] },
            { t: 'serve', def: { name: '网前发球', kind: 'sserve', zone: [C.SHORT_LINE, 2.85], need: 5, total: 8 }, stars: [W(5, 6), W(5, 5)] },
            { t: 'dialog', lines: [
              ['canglan', '嗯。这双鞋……我穿小了。给你。'],
              ['mm', '防侧翻鞋！沧澜虽然话少，其实很会照顾人呢。'],
            ] },
          ],
          rewards: { gear: ['sh_stable'], cards: ['c_serve'] },
        },
      ],
    },
    {
      id: 'ch4', title: '第四章 · 春城集训营', venue: 'sunset', blurb: '海拔 1900 米的高原上，球会“飘”。',
      stages: [
        {
          id: '4-1', title: '高原怪球', kind: 'match', desc: '选对球速号，再和瑞宝打一场。',
          steps: [
            { t: 'dialog', lines: [
              ['nar', '星光杯前，羽跃社来到海拔将近 1900 米的春城集训。听说很多专业队也来这里练体能。'],
              ['ruibao', '这里的米线好好吃！……咦，我的高远球怎么老是出界？'],
              ['mm', '高原空气稀薄、阻力小，球会飞得更快更远。所以要换“慢一点”的球！'],
              ['mm', '球筒上的数字就是球速号。来，帮大家选今天用的球——选错了，比赛会很难打哦。'],
            ] },
            { t: 'pick', q: '在海拔高、天气暖和的场馆，应该选哪种球速号？',
              o: [
                { label: '76 号（慢）', ok: true, env: null, note: '球速刚刚好！' },
                { label: '77 号', env: { drag: 0.072, adapt: 0.3 }, note: '球有点飘……' },
                { label: '78 号', env: { drag: 0.066, adapt: 0.25 }, note: '球明显飘了！' },
                { label: '79 号（快）', env: { drag: 0.06, adapt: 0.2 }, note: '球飘得像气球！' },
              ],
              exp: '海拔高、气温高时空气阻力小，要选号数小的慢速球；寒冷的平原地区则用号数大的快速球。' },
            { t: 'match', opp: 'ruibao', level: 'normal', target: 5, cap: 7,
              stars: [{ text: '选对球速号', test: (r) => r.pickOk }, { text: '自己出界不超过 1 次', test: (r) => r.x.outs <= 1 }] },
            { t: 'dialog', lines: [
              ['ruibao', '原来是球的问题！换对了球，我的高远球又回来了！'],
              ['mm', '记住：环境变了，装备也要跟着变。'],
            ] },
          ],
          rewards: { cards: ['c_speed'] },
        },
        {
          id: '4-2', title: '接杀地狱', kind: 'drill', desc: '小红负责杀，你负责接。',
          steps: [
            { t: 'dialog', lines: [
              ['xiaohong', '集训第三天：我负责杀，你负责接。接不住就……加练！'],
              ['mm', '接杀要领：降低重心，拍子放在身体前方，不要大幅挥拍——借对方的力量，挡网前或挑后场。'],
            ] },
            { t: 'drill', def: { name: '接杀特训', judge: 'receive', tip: '杀球很快：早移动、拍子放身前，看到提示就出手。', feeds: { smash: 1 }, goal: { need: 5, total: 10 } }, stars: [W(5, 7), W(5, 5)] },
            { t: 'dialog', lines: [['xiaohong', '我的手都杀酸了……你居然接住了这么多！']] },
          ],
          rewards: { cards: ['c_defense'] },
        },
        {
          id: '4-3', title: '云端跳杀', kind: 'drill', desc: '社长的压箱底绝招。',
          steps: [
            { t: 'dialog', lines: [
              ['xiaohong', '最后一课，我把压箱底的绝招教给你——跳杀！'],
              ['mm', '在球下落前起跳，空中侧身展腹，最高点击球；前臂内旋，手腕手指瞬间发力，打完马上收拍落地。'],
              ['mm', '看到“起跳！”先跳，在空中按扣杀。'],
            ] },
            { t: 'drill', def: { name: '云端跳杀', judge: 'smash', goal: { need: 5, total: 9 } }, stars: [W(5, 7), W(5, 5)] },
            { t: 'dialog', lines: [
              ['xiaohong', '漂亮！这一记，我给 99 分——还有 1 分，留到星光杯上拿！'],
              ['dingding', '星光杯专用装备到货：高弹线和轻量鞋，拿去！'],
            ] },
          ],
          rewards: { gear: ['s_rep', 'sh_light'], cards: ['c_smash'] },
        },
      ],
    },
    {
      id: 'ch5', title: '终章 · 星光杯', venue: 'arena', blurb: '守护星光体育馆的最后一战。',
      stages: [
        {
          id: '5-1', title: '队内选拔 · 车轮战', kind: 'match', desc: '连赢瑞宝、丁丁、冉冉，成为羽跃社代表。',
          steps: [
            { t: 'dialog', lines: [
              ['xiaohong', '星光杯单打只能派一个人。按老规矩——车轮战！连赢三场的人代表羽跃社出战！'],
              ['ruibao', '我先来！吃饱了，力气满满！'],
              ['mm', '每场 3 分制。技能能量每场清零，别犹豫，该用就用！'],
            ] },
            { t: 'match', opp: 'ruibao', level: 'normal', target: 3, cap: 5 },
            { t: 'dialog', lines: [['dingding', '下一个是我！你的数据，我已经分析完毕了。']] },
            { t: 'match', opp: 'dingding', level: 'normal', target: 3, cap: 5 },
            { t: 'dialog', lines: [['ranran', '最后……是我。慢慢来，别紧张。']] },
            { t: 'match', opp: 'ranran', level: 'boss', target: 3, cap: 5,
              stars: [{ text: '最后一场对手得分 ≤ 1', test: (r) => r.score[1] <= 1 }, { text: '最后一场完美击球 ≥ 3', test: (r) => r.st.perfect >= 3 }] },
            { t: 'dialog', lines: [
              ['xiaohong', '恭喜你，羽跃社的代表！'],
              ['ranran', '我们会在场边……大声地为你加油。虽然我声音很小。'],
            ] },
          ],
          rewards: { cards: ['c_warmup'] },
        },
        {
          id: '5-2', title: '决赛前夜', kind: 'quiz', desc: '神秘的白发少年，和三个方向的球。',
          steps: [
            { t: 'dialog', lines: [
              ['nar', '决赛前夜。空荡荡的看台下，一个白发少年对着墙练球——同一个动作，球却飞向三个方向。'],
              ['tianchu', '你就是羽跃社的代表？……明天，你会看到你从没见过的球。'],
              ['mm', '他叫田楚，寒星中学的王牌。他的假动作非常可怕——我们来复习一下战术。'],
            ] },
            { t: 'quiz', need: 2, qs: [
              { q: '对手用和高远球一样的引拍，最后打出了吊球。这利用了什么？', o: ['动作一致性（假动作）', '运气', '犯规', '风'], a: 0, exp: '高手所有球路的准备动作都尽量一样，直到击球瞬间才变化，让你无法提前判断。' },
              { q: '面对假动作，最好的应对是？', o: ['原地不动等球', '提前猜一边全力冲过去', '做好启动步、重心在中间，看清再出发', '放弃这一球'], a: 2, exp: '对手击球时做分腿启动步、重心放在中间，就能向任何方向快速出发；猜得太早反而更容易被骗。' },
              { q: '下面哪个是经典的进攻组合？', o: ['一直扣杀', '高远压后场 → 吊网前 → 抓机会扣杀', '只打网前', '一直发高远球'], a: 1, exp: '前后调动对手、制造空当，再一击致命——这也是游戏里最有效的战术。' },
            ] },
            { t: 'dialog', lines: [['mm', '明天，相信你的眼睛——不，相信你的判断。']] },
          ],
          rewards: { cards: ['c_feint'] },
        },
        {
          id: '5-3', title: '星光杯决赛', kind: 'match', desc: '7 分制决赛，对阵“镜花水月”田楚。',
          steps: [
            { t: 'dialog', lines: [
              ['nar', '星光杯决赛。看台坐满了人，羽跃社的横幅在最前排晃来晃去：“星光体育馆，我们守护！”'],
              ['tianchu', '你看到的，未必是真的。'],
              ['me', '那我就看你藏不住的东西。'],
              ['mm', '他的「镜花水月」会让落点提示消失、球路一分为三。别慌——看他的站位，相信自己的判断！'],
            ] },
            { t: 'match', opp: 'tianchu', level: 'boss', target: 7, cap: 11,
              stars: [{ text: '扣杀得分 ≥ 2', test: (r) => r.st.smashWin >= 2 }, { text: '对手得分不超过 4', test: (r) => r.score[1] <= 4 }] },
            { t: 'dialog', lines: [
              ['nar', '最后一球落地——压线。全场安静了一秒，然后爆发出欢呼。'],
              ['tianchu', '……我输了。你的判断，比我的假动作更快。'],
              ['tianchu', '下次，我想站在你这一边。可以吗？'],
              ['xiaohong', '当然！羽跃社欢迎你！'],
              ['mm', '星光体育馆保住啦！三十年了，我终于……可以退休了吗？'],
              ['mm', '开玩笑的！羽毛球的世界还很大——有人能把球杀到每小时 565 公里呢。我们一起去看看吧！'],
              ['nar', '— 故事完 · 感谢游玩 —'],
            ] },
          ],
          rewards: { chars: ['tianchu'], gear: ['r_star'], cards: ['c_record', 'c_etiquette'] },
        },
      ],
    },
  ];
  YY.STORY = STORY;
  const STAGES = [];
  for (const ch of STORY) for (const st of ch.stages) { st.chapter = ch; STAGES.push(st); }
  YY.STAGES = STAGES;
  YY.stage = (id) => STAGES.find((s) => s.id === id);
  /** 关卡是否可玩：上一关已通过 */
  YY.stageOpen = (id) => {
    const i = STAGES.findIndex((s) => s.id === id);
    return i <= 0 || YY.Profile.stars(STAGES[i - 1].id) > 0;
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
})(window);
