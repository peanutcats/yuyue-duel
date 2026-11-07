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
    // 字段：passive 被动；cost 能量；recast 可再按一次（第二段 / 回收）；pre 只能在发球前使用；stealth 对手看不到释放特写；
    // sfx 音效；tip 对手（朱老师被动）看到的应对提示；desc 技能面板说明
    // —— 凌风：空中机动 ——
    yihan: { passive: true, name: '差一点，也算一步', short: '脚印', color: '#ff8a6a',
      desc: "没够到球丢分留下脚印，下一分踩到{+15 能量}；亲手极限救球每分首次额外{+5}。" },
    yuyue: { name: '鱼跃追球', short: '鱼跃', color: '#ff6a52', cost: 25, sfx: 'skill-wind', tip: '鱼跃救起的球会急坠：提前上网，并留意场上的风',
      desc: '[按住移动方向]再按技能，朝那边{贴地飞扑救球}，卷起旋风；救起的球{过网急坠}，全场{顺风 4 秒}。<扑空会趴地>。' },
    tafeng: { name: '空中踏风', short: '踏风', color: '#ffb199', cost: 20, sfx: 'skill-wind', air: true, tip: '疾风球很重：站稳在中场，接完马上回位',
      desc: '空中{再跳一次}：[按住移动方向]就斜着横移，不按就直冲更高；之后这一拍带{疾风}：更快，{接球的人被击退}。' },
    fengkou: { name: '风口急转', short: '风口', color: '#ffd0a8', cost: 20, sfx: 'skill-wind', tip: "避开风道里的球路，风道只改一球；他经过风道时回位更快",
      desc: "[拖动]布置{局部风道 6 秒}，经过时起步和移动更快；{只改变一球}的方向，吹球后风道仍可助跑。" },
    // —— 沧澜：潮水 ——
    dishui: { passive: true, name: '滴水回澜', short: '水滴', color: '#5cc8ff',
      desc: '每次回球身后留一枚水滴（最多 3 枚），跑回去吸收{+12 体力}。' },
    chaolai: { name: '潮来', short: '潮来', color: '#4aa8ff', cost: 30, sfx: 'skill-flow', tip: '她的半场积了水：第一次落水的球会弹起来，别以为打死了；第二次落水才算分',
      desc: "己方半场{积水 8 秒、最多两次托球}；来球第一次落水弹起，同一球第二次落水照常失分。" },
    tongyin: { name: '同饮一潮', short: '同饮', color: '#8fdcff', cost: 20, sfx: 'skill-flow', tip: '她体力低时别拉长回合：速战速决',
      desc: "体力低于对手时{转移差值的40%，最多25体力}；体力不低时获得5秒扣杀省力。" },
    huichao: { name: '回潮', short: '回潮', color: '#2fe0ff', cost: 35, recast: true, sfx: 'skill-time', tip: '倒流的球随时会被放下：别站死；积水里卷起的浪涌球更快更重',
      desc: '来球{沿原路倒流}回对面，[再按]就地松手下坠。积水弹起的球倒流{更快}，放下变{浪涌球}。<没过网就松手会落在自己场内>。' },
    // —— 小红：几何 ——
    biaochi: { passive: true, name: '角度标尺', short: '标尺', color: '#ff8a2a',
      desc: "画出角度参考线；完美亲手回球获得{校准}，下次{手动反射板多弹一次}，每分最多获得两次。" },
    fanshe: { name: '几何反射板', short: '反射', color: '#ff6f3c', cost: 20, sfx: 'skill-power', tip: '看反射板的编号和连线：球会顺着线路越弹越快，提前退到最后一块板对着的方向',
      desc: "[拖动]布置反射板，最多三块连线；每块{10秒、触发一次}。校准后的手动板可触发两次。" },
    zipao: { name: '自抛自扣', short: '自抛', color: '#ffb02e', cost: 25, sfx: 'skill-power', tip: '她把球垫起来要扣了：先退后防扣杀；球被垫向反射板时注意板子出口',
      desc: '把拍前来球{垫起再自己扣}：[拖动]选垫球{角度和力度}，可垫向反射板；点按垫到头顶。<第二拍失手白送一分>。' },
    pingyi: { name: '辅助线', short: '辅助线', color: '#ffd23f', cost: 25, sfx: 'skill-power', tip: '看她身前那条辅助线的角度：她下一拍就沿着它打，提前站到线的落点',
      desc: '[拖动]画一条带角度的辅助线，6 秒内你的下一拍{沿这条线射出}；自抛扣杀沿线{更重}，反射板出口也沿线。点按自动瞄空当。' },
    // —— 冉冉：球网机关 ——
    hudie: { passive: true, name: '蝴蝶结', short: '蝴蝶结', color: '#ff8fbf',
      desc: '网前球过网后在网带留蝴蝶结（最多 2 个），{下一只擦网球会被托起}再落下。' },
    tangqiu: { name: '糖球挂网', short: '挂网', color: '#ff6fae', cost: 25, sfx: 'skill-time', tip: '看箭头：球会从那一边滑落',
      desc: '6 秒内{第一只经过网带的球粘在网上}，1 秒后滑向对面（[后退]滑向自己）。' },
    hongxian: { name: '红丝牵球', short: '红丝', color: '#ff4d7a', cost: 25, recast: true, sfx: 'skill-flow', tip: '丝带缠住球后她会自己挑角度甩出：看她拍子朝哪，别急着贴网',
      desc: '[拖动]朝一个方向射出红丝带，{缠住来球拉到拍前}；再[拖动]选方向和力度{随拍甩出}（点按甩向空当）。<丝带不能过网>。' },
    jiewang: { name: '把网借我一下', short: '借网', color: '#ffc2dc', cost: 25, sfx: 'skill-flow', tip: '网被她借走了：别打贴网的低球，挑高过网',
      desc: '6 秒内网归她：{她的贴网球被弹下压，对手的被弹高}；糖网、红线中的球{立即弹射}。' },
    // —— 王瑞：花式回球 ——
    zheteng: { passive: true, dependsOn: ['diban','huiguo','baozi'], name: '越折腾，越来劲', short: '折腾', color: '#ffb02e',
      desc: "地板过网、回锅再打、有效肉包释放{+6能量}，每分最多18；肉包配地板可变成蒸汽地板。" },
    diban: { name: '地板开球', short: '地板', color: '#ff9a3d', cost: 25, sfx: 'skill-power', tip: '地板球会在他身后、头顶的墙上来回弹，每弹一次更快：看蒸汽，站中场等它出来',
      desc: '[拖动]选方向把球砸出，身后和头顶{临时立起两面墙}；地板、两面墙各弹一次，{每弹一次加速冒蒸汽}，砸地还会震定对手。' },
    huiguo: { name: '回锅再炒', short: '回锅', color: '#ff6a3d', cost: 25, recast: true, sfx: 'skill-flow', tip: '主动上前截击，逼他提早决定收不收',
      desc: '给自己的球加回旋，对手碰到前[再按]{沿弧线收回己方}；<收回后得自己再打一拍>。' },
    baozi: { name: '超大肉包球', short: '肉包', color: '#ffd28a', cost: 25, recast: true, sfx: 'skill', tip: '肉包里的球会突然加速：别贴太近，等它出包再判断',
      desc: "[拖动]投掷肉包吸收动能；{亲手回球后再按}释放压力，方向不安全时保留肉包，可接蒸汽地板或回锅。" },
    // —— 星星：星门、月亮、重力 ——
    yekong: { passive: true, name: '夜空记事', short: '星点', color: '#ffe27a',
      desc: "每两次{亲手回球+6能量}，每分最多18；发球、自抛和装置代打不计。" },
    yueliang: { name: '月亮抓住了球', short: '月亮', color: '#fff3a8', cost: 30, recast: true, sfx: 'skill-flow', tip: '月亮里的球会沿切线甩出：看它转的方向，别贴着网等；她甩歪了就是你的分',
      desc: '[拖动]放月亮，来球被{抓住绕圈}；[再按]沿{切线方向甩出}，{转越多圈越快}；球还在己方半场可{再补一拍}，<甩出界、下网或落回己方算丢分>。' },
    xingmen: { name: '星门对望', short: '星门', color: '#c9a8ff', cost: 30, sfx: 'skill-time', tip: '星门出口发光时球还没出来：有 0.35 秒，朝出口方向移动',
      desc: '[拖动]选择前后场出口；下一拍或{月亮出球穿越}，在出口{停 0.35 秒}后飞出。' },
    zhongli: { name: '重力换班', short: '重力', color: '#9fb4ff', cost: 10, recast: true, sfx: 'skill-time', tip: '紫色的重力球随时会往上飘：别急着出拍，盯住她关掉的那一刻再迎',
      desc: "开启消耗{10能量}、每秒6，最长1.5秒；关闭后稳定1秒。重力球往上飘，月亮捕获圈增大。" },
    // —— 丁丁：机械球拍 ——
    jixie: { passive: true, dependsOn: ['shensuo','xuanpai','youyou'], name: '机械回收', short: '回收', color: '#2fd38a',
      desc: '装置命中{过载 3 秒}；收招后[再按]立即回收{返还 6 能量}，每次仅一次。' },
    shensuo: { name: '伸缩长拍', short: '长拍', color: '#4ff0a0', cost: 25, recast: true, sfx: 'skill-wind', tip: '看拍头的路线，打到它够不着的地方',
      desc: '[拖动]任意角度快速伸拍，{拍头自动拦截重击}；[再按]扫击回收，过载时{范围更大}。' },
    xuanpai: { name: '双头旋拍', short: '旋拍', color: '#7dffcf', cost: 25, recast: true, sfx: 'skill-wind', tip: "看二段扫回方向；高吊绕过，等他收招再打空当",
      desc: "双头拍绕身迎球；[再拖放]{定向扫回}，命中后再按快速回收；{过载扩大扫击范围}。" },
    youyou: { name: '悠悠球拍', short: '悠悠', color: '#b8ffde', cost: 25, recast: true, sfx: 'skill-wind', tip: '拍头离手了：打他身边',
      desc: "[拖动]甩拍守点，去程或回程{合计拦截一次}；[再按]拉回，手柄仍能回球，过载悬停更久。" },
    // —— 猴子：灵猴 · 游戏梗 ——
    liansha: { passive: true, name: '连杀播报', short: '连杀', color: '#ffb347',
      desc: "两连胜起额外{+3/+5/+8能量}；连胜被终结，对手+10。" },
    jindou: { name: '筋斗云', short: '筋斗', color: '#ff9f2f', cost: 30, sfx: 'skill-wind', tip: '他会飞到高点等杀：打低平快球或放网',
      desc: '驾云{飞到来球最高点}悬停，这一拍{质量大增、可空中暴扣}；<云只停 1.4 秒>。' },
    dangteng: { name: '荡藤飞跃', short: '荡藤', color: '#7dd35a', cost: 25, recast: true, sfx: 'skill-wind', tip: '他在藤上收不住：看他松手的方向，打另一边',
      desc: '[拖动]选方向荡起，[再拖放]{定向飞出}；空中可微调，接{筋斗云或强化回击}。' },
    haomao: { name: '毫毛小猴', short: '小猴', color: '#ffcf5a', cost: 30, sfx: 'skill', tip: '小猴来回巡逻：避开它的位置，看见香蕉皮就跳',
      desc: '召唤猴守场{7 秒、拦截一次}，准备后巡逻、丢一块香蕉皮；<高球可绕过>。' },
    // —— 路先森：程序指令 ——
    rizhi: { passive: true, name: '错误日志', short: '日志', color: '#7fd6ff',
      desc: "记录挥空原因；成功处理两类来球或纠正日志后获得{编译标记}，每分最多两次。" },
    fuzhi: { name: '复制体', short: '复制体', color: '#5fb8ff', cost: 30, sfx: 'skill-time', tip: '复制体守着原地：把球打到它和本体都够不着的空当，别打它身边',
      desc: "原地留下{复制体8秒}，同步跳跃、挥拍和技能；它打出的球落在己方半场{可弹起一次}。<复制体不会走动>。" },
    jieli: { name: '接力协议', short: '接力', color: '#4fe0ff', cost: 20, sfx: 'skill', tip: '接力后要等他再挥一拍：盯住接力落点，准备接扣杀',
      desc: "球到本体或复制体身边时，{垫给另一端}；[向上拖]高传、[平拖]快传，再按击球出手。没有复制体时{自垫一下}。" },
    zangshu: { name: '脏数据', short: '脏数据', color: '#9dff7a', cost: 25, sfx: 'skill-mirage', stealth: true, tip: '脏数据球和真球长得一样：它落地会乱弹，真球只有一只',
      desc: "发出一只{对手看来和真球一样}的脏数据球，可以被击打；落地后{乱弹回另一边}，被击打或弹回5次后消失。复制体也会发一只。" },
    // —— 老陈：提前安排 ——
    qiandao: { passive: true, name: '签到表', short: '签到', color: '#6fe3d0',
      desc: "记录对手三次出手位置；同一区域重复两次形成{习惯区}，预约赶点更快，区内冰窗稍大。" },
    yati: { name: '查找替换', short: '替换', color: '#4fd8c0', cost: 25, sfx: 'skill-time', tip: '你头上挂着 Ctrl+H：这时扣杀、平抽都会被替换成软球，先打吊球或高远',
      desc: "挂上Ctrl+H，{准备0.3秒}后把下一记进攻换成软球；7秒有效，触发返3能量。" },
    yueqiu: { name: '预约击球', short: '预约', color: '#8ff0dc', cost: 25, sfx: 'skill', tip: '投影只守半个场：往另一半打',
      desc: '预约半场 8 秒（[前进]网前，否则后场）：{对手的球落进去，投影替你接}。' },
    shuangji: { name: '冻结窗格', short: '冻结', color: '#a8e8ff', cost: 25, recast: true, sfx: 'skill', tip: '冰窗只冻第一只球：被冻住的球会按原方向继续飞，盯住它解冻的瞬间',
      desc: "[拖动]布置冰窗，{准备0.25秒}后捕获一球冻结1.2秒；[再按]预告0.16秒后解冻。" },
    // —— 果哥：投资 ——
    jihui: { passive: true, name: '装备交易所', short: '资产', color: '#ffd23f',
      desc: "开局500金币，回球赚钱、失分亏钱，自动升级装备；{火箭三次完美回球蓄满一次推进}。" },
    ganggan: { name: '押这一分', short: '押注', color: '#ff3f6f', cost: 20, sfx: 'skill-power', tip: '他押了这一分：稳住别失误，拖长回合让他着急',
      desc: "花100金币押这一分，发球前赢返×3、回合中×2；{不再附加移速}，押注与金砖同分结算最多350。" },
    jiepan: { name: '红包雨', short: '红包', color: '#ff5a4a', cost: 25, sfx: 'skill-flow', tip: '地上的红包别踩：跳过去，或者绕开再接球',
      desc: '花 {60 金币}往对手半场撒 {3 个红包}，持续 5 秒：对手{在地上踩到就弯腰捡钱，原地停 0.4 秒}；<起跳能躲开>。' },
    qiquan: { name: '一掷千金', short: '千金', color: '#ffd23f', cost: 25, sfx: 'skill-power', tip: "金砖回球质量较低且接到会震退，提前站稳接球",
      desc: "花50金币使下一拍变成{金砖}，压低对方回球并震退；直接得分奖200，同分技能结算封顶350。" },
    // —— 田楚：心理欺骗 ——
    canying: { passive: true, name: '影子慢半拍', short: '残影', color: '#9ff0ff',
      desc: '急停或转向时，身后留下{继续往前跑的残影}，扰乱对手判断。' },
    jingxiang: { name: '镜花水月', short: '镜像', color: '#7fe8ff', cost: 30, sfx: 'skill-mirage', stealth: true, tip: '三只里只有一只真：等到最后一刻再扑',
      desc: '球{一分为三}，三只一模一样。[前进]真球走近线，[后退]走远线，不按走原路。' },
    meida: { name: '这一拍，没打', short: '假拍', color: '#c8f6ff', cost: 20, sfx: 'skill-mirage', stealth: true, tip: '第一只是假的：盯住她拍前那只',
      desc: '来球时{虚挥一拍}，假球飞向对手，真球垫在身前；<你得再挥一拍打过去>。' },
    shuizhong: { name: '水中月', short: '变轨', color: '#5fd0ff', cost: 30, recast: true, sfx: 'skill-mirage', stealth: true, tip: '看到水纹先别动：等它拐弯',
      desc: '球过网后泛起水纹，[再按]{突然变轨}：[前进]收网前，[后退]送后场。原落点留虚影。' },
    // —— 朱老师：练习规则 ——
    kandong: { passive: true, name: '三十年，看得懂', short: '看懂', color: '#7dffb0',
      desc: "首次看见技能提示破解法；每分首次{亲手接好技能球}后，下一拍质量更稳定。" },
    jiezou: { name: '一、二、一', short: '节拍', color: '#5fe89a', cost: 25, sfx: 'whistle', tip: "前两拍仍由他选择，第三拍才会精确打空当",
      desc: "10秒内{前两拍辅助稳定、第三拍精确打空当}；前两拍仍由你选择球路。" },
    biaozhi: { name: '标志桶', short: '标志桶', color: '#ff8f3a', cost: 25, sfx: 'whistle', tip: '跳过标志桶，或提前绕到另一边',
      desc: '在对手身前摆标志桶 4.5 秒（[后退]摆身后）：{地上跑不过，只能跳}。' },
    tingyixia: { name: '停一下，看站位', short: '停', color: '#b8ffd0', cost: 25, sfx: 'whistle', tip: "停球时回到中场，留意他的出手与落点",
      desc: "把近身来球停在拍面上1秒，可走位观察；再按击球键精准出手，{对手仍可看到落点}。" },
  };
  // 详情页的完整说明（{关键效果} [操作] <代价 / 风险>；\n 分段）
  const DETAIL = {
    yihan: "失分留下的脚印只保留到下一分。成功亲手完成极限救球，每分首次额外 +5 能量，不需要先失分。",
    yuyue: '操作：[按住移动方向]（向网或向后）再按技能。不按方向时，自动扑向来球的预计落点。\n效果：凌风{贴地飞扑}，扑出的瞬间卷起一股旋风；扑救中碰到的低球会被救起，并且{一过网就急坠}，对手很难接。\n同时整片球场{顺着扑出的方向刮风 4 秒}：所有球的弧线都会被风推一推。\n代价：<扑空后会趴在地上，起身前不能移动和挥拍>。只能在地面上使用。',
    tafeng: '操作：在空中按技能。[按住移动方向]时斜着横移出去，不按方向就{笔直冲得更高}。每一跳只能踏一次。\n效果：脚下踩出一团旋风，{在空中再跳一次}；1.8 秒内打出的下一拍带{疾风}：扣杀和平抽更快，{接这拍的人会被吹得后退一步}。\n用法：起跳够不到高球时补一跳，或者跳杀前再拔高一截。',
    fengkou: "拖动选择风道位置和朝向，点按放在身前。风道只影响附近球路一次：水平推力 2.8，竖直方向随瞄准变化。自己经过时移动 +10%、起步 +25%；剩余时间仍可利用风道回位或接空中踏风。",
    dishui: '沧澜每次亲手回球，身后的地板上留下一枚{水滴}，最多同时 3 枚。\n跑回去踩到水滴，吸收{+12 体力}。\n用法：打完就顺路回位吸水，拉长回合时越打越有劲。',
    chaolai: "积水跨分保留，分间暂停计时。一次施放最多托球两次，每次新的对方来球最多弹起一次。可接回潮，但不会延长积水寿命。",
    tongyin: "体力交换只从对手转移给自己，上限 25。自己体力不低于对手时不会反向送体力，而是获得 5 秒扣杀体力消耗减少 20%。",
    huichao: '对手打过来的球{沿着原来的路线倒流}回对面，倒流速度是原来的 1.6 倍。\n倒流途中[再按]，球就在当前位置松手下坠，算你的一拍。\n配合“潮来”：对{在积水上弹起的球}使用，倒流加快到 2.4 倍、积水 +3 秒，松手的球是{浪涌球}（对手回球质量下降）。\n风险：<还没过网就松手，球会落在自己场内>。',
    biaochi: "保留红压、蓝推、绿挑的参考线。亲手非自抛完美回球获得一个校准标记；手动布置反射板消耗标记，把一次触发变为两次。标记不叠加，每分最多获得两个。点按不会消耗校准。",
    fanshe: "点按自动放在预测线路上；拖动自己布置位置。最多三块按编号形成弹射线路，最后出口打向空当。每块持续 10 秒，通常只触发一次；被动校准可让手动板多触发一次。",
    zipao: '把拍前的来球{垫起来，再自己扣杀}——这一次允许你连续触球两下。\n操作：[拖动]技能键，方向决定{垫球角度}，拖得越远{力度越大}；点按就垫到头顶正上方。预览会画出垫球弧线和最高点。\n配合：垫向自己的{反射板}，板子会接力把球射向下一块或对手；画好“辅助线”时，第二拍扣杀{沿线射出、更重}。\n第二拍更好找点、出球质量有保底。\n风险：<第二拍挥空或下网，相当于白送对手一分>。',
    pingyi: '在身前画一条{带角度的辅助线}（“两点确定一条直线”），持续 6 秒。\n操作：[拖动]技能键像量角器一样定角度，标签上显示度数；点按则画一条{自动线}，出手瞬间自动算出打向对手最远空当的角度。\n效果：你的{下一拍沿这条线射出}，球速至少 13 m/s 并再快 12%。\n配合：“自抛自扣”的第二拍沿线射出变成{几何扣杀}（更重、难接）；“几何反射板”最后一块板的出口也会改沿这条线。\n风险：<手动画的角度太低会下网、太高会出界>。对手看得到这条线。',
    hudie: '冉冉的网前小球（放网、吊球、挡网等）过网后，在网带上系一个{蝴蝶结}，最多 2 个。\n之后{下一只擦网的球会被蝴蝶结托起一下}再落下，不算下网。蝴蝶结两边都有效。',
    tangqiu: '6 秒内，{第一只经过网带附近的球会被粘在网上}。\n约 1 秒后，球从网上滑落到{对面}（[向后拖]则滑向自己这边）。\n破解：看网上的箭头判断它会掉到哪边。',
    hongxian: '操作：[拖动]技能键选方向，{红丝带}从拍前射出（最长约 3.8 米，过不了网）；点按会自动瞄准来球。\n丝带碰到对手打来的球就{缠住它，拉回你拍前}悬着，最多 1.6 秒。\n出手：再[拖动]技能键选择{出球角度和力度}（拖得越远越快），松手就随拍甩出；点按则{自动甩向对手离得远的空当}；直接按击球键也能正常打。时间到会自动甩出。\n风险：<手动甩的角度太低会下网>。丝带没碰到球就收回，能量不返还。',
    jiewang: '6 秒内{球网归冉冉}：她打的贴网球被网弹一下{往下压}，对手的贴网球被{弹高送给她}。撞网的球也会被借网弹过去。\n如果此时有球挂在糖网上或被红线牵着，会{立即被弹射出去}。\n破解：别打贴网的低球，挑高过网。',
    zheteng: "完成有效花式回球返还 6 能量，每拍最多一次、每分最多18。肉包压力不足或没有成功释放不会返还；肉包接地板、回锅都可保留蒸汽联动。",
    diban: '操作：[拖动]技能键选择{砸球方向}（任意角度），预览会画出完整的{反弹线路}和能否过网；点按则自动挑一条能过网、落在对手最远处的线路。判定范围比普通击球大。\n释放时王瑞抡圆了往下砸，同时在{身后和头顶临时立起两面墙}。\n反弹：{自己的地板（这一次落地不算失分）、后墙、顶墙各能弹一次}，每弹一次{加速并喷出蒸汽}；墙被撞一次就消失，球一过网两面墙都会消失。\n砸到地板时掀起{震波：站在地上的对手被定住片刻}。\n破解：看蒸汽和墙，站中场等球出来；看到震波就起跳。',
    huiguo: '给自己刚打出去的球加一层回旋。\n在对手碰到球之前[再按]，球{沿弧线收回到你这边}，打乱对手节奏。\n代价：<收回后你得自己再打一拍把它送过去>；球已经飞到对手身前就收不回来了。',
    baozi: "肉包持续 5 秒，双方击球都能蓄压。只有真实球归自己时才能释放；系统仅在当前方向附近最多修正约 9°并收力，避免直接加速出界，没有合法线路则保留肉包。压力至少3，最高出球速度30米/秒。可接蒸汽地板，或回锅后强化下一拍。",
    yekong: "每两次符合条件的亲手回球额外获得 6 能量，每分最多额外获得18。发球、装置、自抛与回锅补拍不计。",
    yueliang: '操作：[拖动]技能键选择月亮的位置（只能放在己方半场）。月亮会留 6 秒，等来球飞近。\n抓球：来球飞进月亮的引力圈就被{抓住绕着月亮转圈}，越转越快，最多转 3.4 秒。\n甩出：[再按]技能键，球{沿此刻的切线方向直线甩出}——{转的圈数越多，速度越快}（约 0.5 圈是普通速度，2 圈以上接近重杀）。本机画面会实时显示“现在甩会飞到哪里”：绿色为落进对面，红色为会丢分。\n补拍：绕圈时也可以直接挥拍把球打走；甩出或松手后，{只要球还在己方半场，你可以再打一拍}。\n风险：<时机不对，球可能甩向自己的场地、下网或出界——这些都算你丢这一分>。转满时间没甩，月亮会松手让球在原地落下。\n配合：失重时捕获圈更大；星门开着时甩出的球可以穿越星门。',
    xingmen: '开启星门，持续 8 秒：你的下一拍（或月亮甩出的球）{射进拍前的入口，从对手身后的出口飞出}。\n[向后拖]出口开在对手后场，[向前拖]开在网前；不拖就自动挑对手离得远的那边。\n穿越需要 {0.35 秒}：球先停在发光的出口里，再朝落点飞出，给对手留出反应时间。\n配合：“重力换班”开着时，出口球更压、并且是重力球。',
    zhongli: "装备后自己碰过的球保留重力标记。开启消耗10能量，之后每秒消耗6，最长1.5秒；再按可提前关闭。关闭后有1秒稳定期。开启时月亮捕获圈更大；重力球最高升到6.6米。",
    jixie: '伸缩长拍、双头旋拍、悠悠球拍这些装置击中球时，丁丁{过载 3 秒}，装置更强。\n装置收招后[再按]，可以{立即回收并返还 6 能量}，每次释放只能回收一次。',
    shensuo: '[拖动]技能键选择任意角度，球拍{快速伸长}，拍头会{自动拦截飞来的重球}。\n[再按]：拍头就地扫击，打完再按一次快速收回；过载时{拦截范围更大}。\n破解：看拍头的路线，打它够不着的地方。',
    xuanpai: "消耗25能量。上升段挑深，下降段下压；再拖放选择扫回角度，二段不重复收费。命中后可再按快速回收，或在收招窗口反向移动，返还6能量。过载时旋转与扫回范围扩大。",
    youyou: "去程和回程都有拦截机会，但一次施放总共只回球一次。拖动选守点，二段拉回；收招窗口可再按或反向移动回收，返还6能量。拍头离手期间手柄仍可击球，够球与球速略降。",
    liansha: "两连胜+3、三连胜+5、之后每分+8能量。终结两连胜以上的猴子，仍获得+10能量。",
    jindou: '驾着筋斗云{飞到来球轨迹的最高点}悬停，最多停 1.4 秒。\n这一拍{力量大增，可以在空中暴扣}。打完云就散了。\n破解：他会在高点等着扣杀——打低平快球或放网。',
    dangteng: '[拖动]选方向，抓住头顶的藤蔓荡起来；荡的过程中[再拖动并松手]，朝那个方向{定向飞出}。\n空中还能微调，落地前这一拍{够球更远、质量更好}；可接筋斗云。\n破解：他在藤上收不住，看他松手的方向，打另一边。',
    haomao: '召唤一只小猴在己方半场巡逻 7 秒，准备片刻后上岗。\n小猴会{替你拦截一次低平来球}，还会往对面{丢一块香蕉皮}：对手快速跑过会滑倒。\n破解：<高球可以从小猴头上绕过>；看见香蕉皮就跳过去。',
    rizhi: "亲手以好球质量处理两类不同来球，或成功接回日志记录的同类来球，获得一个编译标记。标记不叠加，每分最多获得两次。复制体消耗它，持续时间延长到11秒；接力协议消耗它，接力后的那一拍质量保底0.9。故意挥空本身不提供奖励。",
    fuzhi: '在你当前站的位置留下一个{复制体}，持续 8 秒，死球期间暂停计时。\n复制体{不会走动}，但会同步你的{跳跃、挥拍}，也会同步释放接力协议、脏数据。你挥拍时，球在复制体拍前，复制体就会替你把球打出去。\n托底：{复制体打出（或接力垫出）的球如果落在己方半场，会弹起一次}，你还能再打一拍。\n破解：<复制体守着原地>，把球打到它和本体都够不着的地方。',
    jieli: '来球进入本体或复制体身边约 1.9 米时按下：{离球近的一端把球垫向另一端}。\n[向上拖]高传：球飞到另一端{头顶}，适合起跳扣杀；[平拖]快传：球走{较低的弧线}快速送到。拖得越远，高传越高、快传越快；预览会标出预计到达的位置。\n复制体也会一起做传球动作，但只有碰到球的那一端能改变球路。接球端不会自动扣杀，{球飞到后要你再按击球}（这一拍判定更宽、质量至少 0.75）。\n没有复制体时变成{一次短距离自垫球}：[拖动]调高低和前后，用来调整自己的击球时机。',
    zangshu: '从拍前发出一只{脏数据羽毛球}，飞向对手半场。{对手看到的样子、拖尾和落点圈都和真球完全一样}，只有你能看到上面的数据代码。\n脏数据球{可以被正常击打}，打中它会用掉这一次挥拍；没人打它就会在{落地后沿随机角度弹回另一边}。被击打或弹回累计 {5 次}后消失，不计分。\n有复制体时，{复制体也会发一只}。\n破解：真球只有一只，<落地会乱弹的就是脏数据>；看准了再挥拍。',
    qiandao: "标记的是对手击球位置。最近三次里，同一前后场区域出现至少两次，就形成习惯区：预约相应半场时赶点更快，放在对手该区域的冻结窗格略扩大。对手改变出手区域可改变标记。",
    yati: "规则至少准备0.3秒，施法前已经开始的挥拍不被追溯改写。生效后下一记扣杀、平抽或推压变成高球；向前拖变成网前小球。触发返3能量。高远、吊球可绕过。",
    yueqiu: '预约半个场地，持续 8 秒：[向前拖]预约网前，不拖预约后场。\n对手的球{落进预约区时，投影替你去接}。\n破解：投影只守半个场，往另一半打。',
    shuangji: "冰窗持续7秒，可放到网那边最多2.5米。施放后0.25秒开始捕获。捕获后冻结1.2秒；再按提前解冻时仍有0.16秒闪烁预警。习惯区内的冰窗略大。",
    jihui: "亲手回球+15，完美再+15；赢分+100，丢分−120。600科技、900纳米、1200量子、1600火箭。顶档常驻移动+20%、力量+28%、够球+12%、跳跃+16%；火箭档三次完美回球蓄满一次8%进攻推进。降档有60金币缓冲，≤0仍负债。保留装备、粒子和击球特效。",
    ganggan: "消耗20能量和100金币，每分只能押一次。发球前赢返300，回合中赢返200；输掉本金。押注本身不增加属性。押注返还与金砖奖金合计每分最多350，不包含正常赢分奖金和回球收入。",
    jiepan: '操作：回合中按，花 {60 金币}。\n往对手半场撒下 {3 个红包}：对手脚前、身后各一个，还有一个落在你这拍的落点附近。红包飘落后在地上躺 5 秒。\n对手{在地上跑过红包时会忍不住弯腰去捡，原地停 0.4 秒}，捡一个就少一个。\n破解：<起跳或绕开就不会被绊住>。',
    qiquan: "金砖不再额外加速，重球强度降为1.8，仍有轻微击退。必须这只金砖球直接得分才有200奖金；与押注返还合计每分最多350。",
    canying: '田楚急停或转向时，身后留下{一个继续往原方向跑的残影}，持续半秒。\n对手容易被残影骗着看错她的位置。',
    jingxiang: '在自己刚打出的球上使用：球{一分为三}，三只外观完全一样。\n[向前拖]真球走近线，[向后拖]走远线，不拖真球走原路。假球落地前会消散。\n破解：三只里只有一只是真的，等到最后一刻再扑。',
    meida: '来球到拍前时{虚挥一拍}：一只假球飞向对手，真球被轻轻垫起停在你身前。\n<你必须再挥一拍，把真球打过去>。\n破解：第一只是假的，盯住她拍前的那只。',
    shuizhong: '在自己的球上使用：球过网后泛起水纹。\n水纹出现后[再按]，球{突然变轨}：[向前拖]收到网前，[向后拖]送到后场。原来的落点留下一个虚影。\n破解：看到水纹先别动，等它拐弯。',
    kandong: "亲手以好球质量接回对方技能球后，获得6秒内下一拍质量保底0.85，每分只奖励一次。提示仍会保留，但实际收益来自成功应对。",
    jiezou: "前两拍质量保底0.8，保持自己选择的高远、吊球或扣杀。第三拍质量保底0.92，并自动打向对手远端空当。剩余节拍跨分保留，分间暂停计时。",
    biaozhi: '在对手身前摆一个标志桶，持续 4.5 秒（[向后拖]摆到他身后）。\n{在地上跑不过去，只能跳过去}。\n破解：提前起跳，或者绕到另一边。',
    tingyixia: "停球时以70%移速走位，不能起跳。按击球键选择球路，以完美质量出手。取消额外隐藏落点，给对手正常判断机会。",
  };
  for (const id in DETAIL) SKILLS[id].detail = DETAIL[id];
  YY.SKILLS = SKILLS;
  // 技能瞄准使用独立坐标：x 正数向网，y 正数向上；与移动输入无关。
  // 鱼跃、踏风不拖动：按住移动方向再按技能（moveAim），不按方向时自动判断。
  for (const id of ['jieli','fengkou','fanshe','zipao','pingyi','tangqiu','hongxian','jiewang','diban','baozi','yueliang','xingmen','shensuo','xuanpai','youyou','dangteng','haomao','yati','yueqiu','shuangji','jingxiang','shuizhong','biaozhi']) SKILLS[id].aim = ['jieli','fengkou','xuanpai','fanshe','zipao','pingyi','hongxian','diban','baozi','yueliang','shensuo','youyou','dangteng','shuangji'].includes(id) ? 'vector' : 'choice';
  for (const id of ['yuyue','tafeng']) SKILLS[id].moveAim = true;
  for (const sk of Object.values(SKILLS)) sk.desc = sk.desc.replaceAll('[前进]', '[向前拖]').replaceAll('[后退]', '[向后拖]').replaceAll('[按方向]', '[拖动技能]');
  YY.cleanSkillAim = function (a) {
    if (typeof a === 'number') return Number.isFinite(a) ? Math.max(-1, Math.min(1, a)) : 0;
    if (!a || !Number.isFinite(a.x) || !Number.isFinite(a.y)) return 0;
    const n = Math.hypot(a.x, a.y), k = Math.max(1, n);
    return { x: a.x / k, y: a.y / k };
  };
  YY.skillVector = function (id, raw) {
    const a = YY.cleanSkillAim(raw), manual = typeof a === 'object' && Math.hypot(a.x, a.y) > .08;
    const angle = id === 'fanshe' ? (a > .3 ? 18 : a < -.3 ? 55 : 35) * Math.PI / 180 : id === 'shensuo' ? .72 : id === 'yueliang' ? .72 : id === 'dangteng' ? .55 : .12;
    const n = manual ? Math.hypot(a.x, a.y) : 1;
    return { x: manual ? a.x / n : (a < -.3 && id !== 'fanshe' ? -1 : 1) * Math.cos(angle), y: manual ? a.y / n : Math.sin(angle), r: manual ? Math.min(1, n) : .62, manual };
  };
  YY.MARKET_TIERS = [
    { max:99, name:'破产求生', racket:'破烂木拍', shoe:'光脚', color:'#b79072', move:.9, power:.82, reach:.94, jump:.92 },
    { max:299, name:'变卖装备', racket:'木拍', shoe:'拖鞋', color:'#d6ad75', move:.95, power:.92, reach:.96, jump:.95 },
    { max:599, name:'标准装备', racket:'合金球拍', shoe:'运动鞋', color:'#ffcf5a', move:1, power:1, reach:1, jump:1 },
    { max:899, name:'高科技套装', racket:'碳光球拍', shoe:'动力球鞋', color:'#5ce1ff', move:1.06, power:1.08, reach:1.03, jump:1.04 },
    { max:1199, name:'纳米战甲', racket:'纳米光刃', shoe:'磁悬浮靴', color:'#78ffc4', move:1.1, power:1.16, reach:1.06, jump:1.08 },
    { max:1599, name:'量子实验室', racket:'粒子加速拍', shoe:'反重力靴', color:'#cba8ff', move:1.16, power:1.22, reach:1.09, jump:1.12 },
    { max:9999, name:'火箭武装', racket:'等离子火箭拍', shoe:'火箭助推器', color:'#ffaf4a', move:1.2, power:1.28, reach:1.12, jump:1.16 },
  ];
  // 各档装备的外观与特点（技能详情页、器械预览使用；卡片只放得下三行）
  ['光脚破木拍：击球木屑乱飞，一步一个脚印、满头汗；又软又慢。',
   '背心人字拖：击球掉木屑，跑起来啪嗒扬灰，急停拖沓。',
   '合金拍运动鞋：金色挥拍弧、急停刹车痕，正常发挥。',
   '碳光战衣：击球劈出青色电弧，鞋边拖离子光痕，起步更轻快。',
   '纳米战甲：新月刀光、脚下磁悬浮场，扣杀力量明显提升。',
   '粒子加速环：粒子坍缩、紫色量子残影，够球和弹跳更好。',
   '火箭武装：击球喷火、球带火飞，背包鞋跟一路喷射；最快最重。'].forEach((perk, i) => { YY.MARKET_TIERS[i].perk = perk; YY.MARKET_TIERS[i].min = i ? YY.MARKET_TIERS[i - 1].max + 1 : 1; });
  // 负债（金币 ≤ 0）：囚服、手铐、脚镣，整体变慢
  YY.MARKET_DEBT = { name:'负债入狱', racket:'铐着手的旧木拍', shoe:'脚镣布鞋', color:'#ff7a45', move:.9, power:.76, reach:.9, jump:.85, max:0, min:-999,
    perk:'金币 ≤ 0：囚服手铐，拖着铁球刮出火星；全面变慢，赚回金币才能出狱。' };
  YY.MARKET_MIN = -999;
  YY.marketValue = value => typeof value === 'object' ? (value.equipCoins ?? value.coins) : value;
  YY.marketTier = value => Math.max(0, YY.MARKET_TIERS.findIndex(t => YY.marketValue(value) <= t.max));
  YY.marketDebt = value => YY.marketValue(value) <= 0;
  /** 金币对应的装备档：负债时返回 MARKET_DEBT */
  YY.marketStyle = coins => YY.marketDebt(coins) ? YY.MARKET_DEBT : YY.MARKET_TIERS[YY.marketTier(coins)];
  // 技能说明里的标记：{关键效果}  [操作 / 方向键]  <代价 / 风险>
  const RICH = { '{': ['key', '}'], '[': ['op', ']'], '<': ['risk', '>'] };
  /** 拆成带类型的文字段：[{ t, k: null | 'key' | 'op' | 'risk' }] */
  YY.richText = function (text) {
    const out = [], s = String(text == null ? '' : text);
    let buf = '', kind = null, close = null;
    const flush = () => { if (buf) out.push({ t: buf, k: kind }); buf = ''; };
    for (const c of s) {
      if (!kind && RICH[c]) { flush(); kind = RICH[c][0]; close = RICH[c][1]; }
      else if (kind && c === close) { flush(); kind = null; close = null; }
      else buf += c;
    }
    flush();
    return out;
  };
  /** 去掉标记的纯文字（弹窗、文档、日志用） */
  YY.plainText = (text) => YY.richText(text).map((x) => x.t).join('');

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
    { id: 'lingfeng', look: 0, title: '追风少年', skill: 'yuyue', passive: 'yihan', acts: ['yuyue', 'tafeng', 'fengkou'], fx: {},
      bio: '刚转学到星光城的新生，捡到一只会说话的羽毛球后，被卷进了拯救老球馆的大冒险。没有短板，也没有绝活——但成长最快。' },
    { id: 'canglan', look: 1, title: '潮汐守望者', skill: 'chaolai', passive: 'dishui', acts: ['chaolai', 'tongyin', 'huichao'], fx: { regen: 0.08, stamCost: -0.05, control: 0.04, power: -0.03 },
      bio: '羽跃社的老社员，习惯第一个到、最后一个关灯。体能与防守可靠，却总把维护球馆的事揽在自己身上。她正在学习：让别人一起承担，也是一种信任。' },
    { id: 'xiaohong', look: 'xiaohong', title: '理科社长', skill: 'fanshe', passive: 'biaochi', acts: ['fanshe', 'zipao', 'pingyi'], fx: { power: 0.1, jump: 0.03, control: -0.05, stamCost: 0.04 }, lock: '0-3',
      bio: '羽跃社社长，喜欢把训练写成公式的理科生。重杀犀利，却容易急着一拍结束；他开始明白，计划也要为失误和伙伴留出位置。与星星一起走过的十二盏路灯，是一天最慢的路。' },
    { id: 'ranran', look: 'ranran', title: '甜心网前手', skill: 'tangqiu', passive: 'hudie', acts: ['tangqiu', 'hongxian', 'jiewang'], fx: { touch: 0.12, control: 0.05, power: -0.07, stamCost: 0.03 }, lock: '2-1',
      bio: '被星星拉来参观后，迷上网前轻轻一放的细腻手感。她擅长用小动作改变局面，也敢提醒社长安排休息。开放日里，她希望让新手接住自己的第一个球。' },
    { id: 'ruibao', look: 'ruibao', title: '移动城墙', skill: 'diban', passive: 'zheteng', acts: ['diban', 'huiguo', 'baozi'], fx: { reach: 0.08, defense: 0.1, move: -0.06, regen: 0.06 }, lock: '1-2',
      bio: '王瑞，朋友们叫他瑞宝。热爱包子，也珍惜每一个回合。和小红、丁丁、猴子从初中起就是一伙的。稳定防守是他的拿手好戏，可他最不想听到的一句话是“你就负责挡着”。' },
    { id: 'xingxing', look: 'xingxing', title: '追光的星星', skill: 'yueliang', passive: 'yekong', acts: ['yueliang', 'xingmen', 'zhongli'], fx: { touch: 0.08, move: 0.05, accel: 0.04, power: -0.04 }, lock: '2-4',
      bio: '文艺委员，天文社社长，笑起来眼睛弯成月牙。网前球又快又刁，像流星划过。和小红是从小学起的同桌，晚自习后总是一起走那段有路灯的小路。' },
    { id: 'dingding', look: 'dingding', title: '穿线机之子', skill: 'shensuo', passive: 'jixie', acts: ['shensuo', 'xuanpai', 'youyou'], fx: { move: 0.08, accel: 0.1, power: -0.08, handling: -0.05 }, lock: '3-2',
      bio: '家里开穿线铺，背得出每支球拍的平衡点和中杆硬度。个子小、跑得快，像只装了弹簧的松鼠。和猴子是多年的 Dota2 开黑搭档，打球和打游戏一样急：总想一波推完。' },
    { id: 'houzi', look: 'houzi', title: '乐天猿人', skill: 'jindou', passive: 'liansha', acts: ['jindou', 'dangteng', 'haomao'], fx: { handling: -0.1, defense: 0.1, reach: 0.06, touch: 0.04, power: 0.04, move: -0.03, jump: -0.06, stamCost: 0.03 }, lock: '1-4',
      bio: '肚子圆、脸小、眉骨高，长得像课本里的北京猿人，于是从初中起就叫“猴子”。性格随和，天塌下来也先说“问题不大”。手机不离手，和丁丁是 Dota2 的老搭档。跑动不多，却会驾云抢高点、荡藤换位，还能叫小猴帮忙守场。' },
    { id: 'lu', look: 'lu', title: '气氛担当', skill: 'fuzhi', passive: 'rizhi', acts: ['fuzhi', 'jieli', 'zangshu'], fx: { power: 0.06, reach: 0.06, regen: 0.04, move: -0.07, jump: -0.05 }, lock: '4-2',
      bio: '电脑社社长，随身带着胜率模型和冷笑话。和老陈好到连上厕所都要结伴。起初只相信模型，后来发现：不能被一个数字说清的人，才值得继续了解。' },
    { id: 'laochen', look: 'laochen', title: '表格里的温度', skill: 'yati', passive: 'qiandao', acts: ['yati', 'yueqiu', 'shuangji'], fx: { move: 0.06, jump: 0.06, control: 0.08, stamCost: -0.06, power: -0.1, defense: -0.04 }, lock: '4-5',
      bio: '路先森形影不离的密友，热情得像一杯随时续满的热水。最爱整理数据，签到表到他手里都会变得干干净净。瘦得像根竹竿，一顿能吃四碗饭也不长肉。他一直觉得自己只配坐在场边记数据。' },
    { id: 'guoge', look: 'guoge', title: '健身房投资人', skill: 'ganggan', passive: 'jihui', acts: ['ganggan', 'jiepan', 'qiquan'], fx: { power: 0.09, jump: 0.04, stamCost: 0.14, regen: -0.08, control: -0.08, move: -0.03 }, lock: '5-5',
      bio: '健身房常驻会员，胸肌比课本厚，能躺着绝不坐着。典型的投机主义者：哪边要赢就往哪边站，“分散投资”是口头禅。爆发力惊人，耐力却经不起三个回合的拉锯。' },
    { id: 'tianchu', look: 'tianchu', title: '镜花水月', skill: 'jingxiang', passive: 'canying', acts: ['jingxiang', 'meida', 'shuizhong'], fx: { power: 0.05, control: 0.05, jump: 0.06, touch: 0.04, stamCost: 0.05 }, lock: '7-5',
      bio: '寒星中学的王牌，冷静而神秘。同一个引拍动作能打出三种球——“你看到的，未必是真的。”' },
    { id: 'zhu', look: 'zhu', title: '球馆的老朱', skill: 'jiezou', passive: 'kandong', acts: ['jiezou', 'biaozhi', 'tingyixia'], fx: { control: 0.1, touch: 0.06, defense: 0.05, move: -0.08, jump: -0.08, regen: -0.04 }, lock: '6-5',
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
      { id: 'r_basic', name: '青训均衡拍', spec: '4U · 均衡 · 中杆适中', fx: {}, style: '标准',
        desc: '社团公用拍。平衡点在中间，进攻防守都不偏科——各项数值都以它为基准。' },
      { id: 'r_flex', name: '柔风·初晴', style: '容错型', spec: '轻量 · 均衡 · 中杆偏软', fx: { reach: 0.08, control: 0.05, power: -0.06 }, lock: '0-3',
        trait: { k: 'steady', name: '稳稳接住', v: 0.2, desc: '成功碰到球时，因击球过早或过晚造成的质量损失减少 20%。' },
        cost: '直接终结能力较弱：力量 −6%。', fits: ['lingfeng', 'canglan'],
        desc: '奶白色圆润拍框、薄荷绿中杆，拍框下沿绘着一片展开的羽毛。适合学习击球时机，也适合把回合打长。' },
      { id: 'r_heavy', name: '雷霆·赤脊', style: '后场强攻', spec: '头重 · 中杆硬', fx: { power: 0.10, handling: 0.06, touch: -0.05 }, lock: '3-1',
        trait: { k: 'press', name: '压后再杀', v: 0.06, desc: '高远球被对手在后场接到后，下一次回球若为跳杀，出球速度额外 +6%；改打其他球路则消耗这次机会。' },
        cost: '挥拍耗时 +6%，被贴身快球追打时较难转拍；网前控制 −5%。', fits: ['xiaohong', 'guoge', 'houzi'],
        desc: '哑光黑拍框配熔岩红内沿，中杆有一道贯穿到握把的红色脊线。“高远压底线—等短球—跳杀”的进攻顺序。' },
      { id: 'r_light', name: '疾风·切羽', style: '快速衔接', spec: '头轻 · 中杆适中 · 薄刃拍框', fx: { handling: -0.10, defense: 0.05, power: -0.08 }, lock: '3-1',
        trait: { k: 'quick', name: '接杀快收', v: 0.12, desc: '亲手接住对手扣杀并成功过网后，本次剩余收拍时间缩短 12%，方便立即回位。' },
        cost: '后场一拍制胜能力偏弱：力量 −8%。', fits: ['dingding', 'lingfeng', 'tianchu', 'guoge'],
        desc: '银白色薄刃拍框，青蓝色细线沿外缘延伸。挥拍留下短而利落的青色弧线，连续操作轻快。' },
      { id: 'r_silk', name: '绣羽·细雨', style: '网前控制', spec: '均衡 · 反馈细腻 · 方圆拍框', fx: { touch: 0.10, control: 0.06, power: -0.08 }, lock: '2-1',
        trait: { k: 'needle', name: '细针落点', v: 0.2, desc: '在网前用甜区完成搓球或轻放时，落点随机误差额外减少 20%。' },
        cost: '力量 −8%：被压到底线后，需要更主动地寻找回位机会。', fits: ['ranran', 'xingxing', 'zhu'],
        desc: '珍珠白方圆拍框，淡粉色包边，两侧点缀细小花瓣纹。触球时溅起一点短促细碎的粉白光。' },
      { id: 'r_tide', name: '潮汐·长歌', style: '持续拉吊', spec: '均衡 · 击球稳定', fx: { defense: 0.08, control: 0.05, power: -0.07 }, lock: '1-1',
        trait: { k: 'tide', name: '长回合呼吸', v: 3, desc: '同一回合内，每完成 3 次亲手回球并成功过网，恢复 3 点体力；每回合最多恢复 9 点。' },
        cost: '爆发收益较低：力量 −7%。', fits: ['canglan', 'ruibao', 'zhu', 'guoge'],
        desc: '深海蓝拍框，内圈浅青色波纹，中杆由蓝渐变为银白。适合耐心调动、拉长回合。' },
      { id: 'r_prism', name: '棱镜·定点', style: '精准击球', spec: '微头重 · 中杆偏硬 · 六棱拍框', fx: { control: 0.08, power: 0.05, reach: -0.08 }, lock: '4-1',
        trait: { k: 'precise', name: '精确解', v: 0.25, desc: '同时满足甜区命中和最佳击球时机时，本拍落点随机误差额外减少 25%。' },
        cost: '甜区 −8%：被调动到极限位置时会放大失误风险。', fits: ['xiaohong', 'laochen', 'zhu'],
        desc: '石墨灰六棱切面拍框，荧光橙刻度分布在四角，白色中杆带细网格纹。准确命中时闪现一个极小的十字光点。' },
      { id: 'r_star', name: '星轨·变奏', style: '球路变化', spec: '均衡 · 中杆适中', fx: { control: 0.05, touch: 0.04, power: -0.05 }, lock: '7-5',
        trait: { k: 'third', name: '第三种答案', v: 0.2, desc: '回球分为高远／挑球、吊球／网前球、平抽／扣杀三类。本拍与前两次回球分属三个不同类别时，落点误差减少 20%。' },
        cost: '反复使用同一种球路时收益较少；力量 −5%。', fits: ['xingxing', 'tianchu', 'laochen'],
        desc: '深紫色拍框嵌着金色星点，银色中杆饰有三条长短不一的轨道线。连续变换深浅与速度时，三颗星依次点亮。' },
      { id: 'r_shield', name: '磐盾·折返', style: '防守反击', spec: '拍面稳定 · 略厚重 · 宽肩拍框', fx: { defense: 0.10, reach: 0.05, power: -0.06, handling: 0.04 }, lock: '6-2',
        trait: { k: 'counter', name: '借势反抽', v: 0.08, desc: '站稳后以甜区接住对手扣杀，并选择平抽回击时，该次反抽球速额外 +8%。' },
        cost: '主动进攻和连续抢网相对吃力：力量 −6%、挥拍耗时 +4%。', fits: ['ruibao', 'lu', 'canglan'],
        desc: '枪灰色宽肩拍框，深绿色内沿，两侧有盾形护片纹。擅长把对手的强攻转成反击机会。' },
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
      { id: 'sh_basic', name: '入门训练鞋', spec: '生胶底 · 低帮', fx: {}, style: '标准',
        desc: '专业羽毛球鞋的基础款：生胶鞋底在木地板上抓地好，低帮方便脚踝灵活转动。各项数值以它为基准。' },
      { id: 'sh_run', name: '你的旧跑鞋', style: '不适合球场', spec: '厚泡棉 · 高鞋跟', fx: { move: 0.02, accel: -0.12, lunge: 0.3, land: 0.2 },
        cost: '侧向支撑弱：急停变向容易打滑。',
        desc: '跑鞋为直线前进设计：鞋底厚而软、侧向支撑弱。在球场急停变向容易打滑甚至崴脚——试试就知道了。' },
      { id: 'sh_light', name: '羽翼·流步', style: '全场移动', spec: '轻薄鞋面 · 生胶前掌', fx: { move: 0.06, accel: 0.06, land: 0.10 }, lock: '1-2',
        trait: { k: 'home', name: '归位第一步', v: 0.10, t: 0.35, cd: 3, desc: '亲手回球后，首次朝己方半场中心移动时，前 0.35 秒启动能力额外 +10%（冷却 3 秒）。' },
        cost: '落地恢复耗时 +10%：连续跳杀后的衔接较弱。', fits: ['lingfeng', 'dingding', 'xingxing', 'ruibao', 'lu'],
        desc: '象牙白轻薄鞋面，青色羽翼状侧片，浅蓝生胶前掌。跑动时鞋跟只留下一道很短的浅青光痕。' },
      { id: 'sh_stable', name: '磐石·定轴', style: '急停转向', spec: '宽底盘 · 侧向支撑片 · 人字纹底', fx: { accel: 0.08, lunge: -0.18, move: -0.04 }, lock: '3-2',
        trait: { k: 'pivot', name: '刹停转身', v: 0.15, t: 0.2, cd: 1.5, desc: '持续跑动至少 0.3 秒后反向移动，反向启动能力在 0.2 秒内额外 +15%（冷却 1.5 秒）。' },
        cost: '最高移动速度 −4%：长距离追球稍慢。', fits: ['tianchu', 'ruibao', 'zhu'],
        desc: '深灰鞋面配橙黄色侧向支撑片，宽底盘深色人字纹鞋底，鞋跟一个清晰的六边形稳定标记。应对假动作和前后调动。' },
      { id: 'sh_cushion', name: '云垫·回弹', style: '跳杀衔接', spec: '分层中底 · 云朵后跟 · 弹簧纹前掌', fx: { land: -0.20, jump: 0.04, move: -0.03 }, lock: '6-3',
        trait: { k: 'rebound', name: '落地再起', v: 0.15, t: 2, cd: 6, desc: '普通起跳落地后 2 秒内再次起跳，该次起跳体力消耗减少 15%（冷却 6 秒）。' },
        cost: '移动速度 −3%：平地追逐能力一般。', fits: ['xiaohong', 'guoge', 'houzi', 'lingfeng'],
        desc: '白色鞋面搭配淡紫色分层中底，后跟是云朵轮廓，前掌鞋底有弹簧状弧线纹。跳杀后继续压迫。' },
      { id: 'sh_butterfly', name: '蝶步·探网', style: '上网回收', spec: '低帮 · 前掌支撑片 · 上扬鞋头', fx: { accel: 0.06, lunge: -0.20, jump: -0.05 }, lock: '2-4',
        trait: { k: 'retreat', name: '探身即回', v: 0.15, t: 0.3, cd: 3, desc: '在己方前场亲手回球并成功过网后，首次后撤的前 0.3 秒启动能力额外 +15%（冷却 3 秒）。' },
        cost: '弹跳 −5%：高点强攻能力稍弱。', fits: ['ranran', 'xingxing', 'zhu'],
        desc: '白色低帮鞋面，浅粉蝶翼侧纹，薄荷色前掌支撑片，鞋头微微上扬。上网搓放后迅速撤回。' },
      { id: 'sh_cruise', name: '巡航·悠行', style: '体能管理', spec: '厚实鞋面 · 稳定中底', fx: { regen: 0.10, land: -0.10, move: -0.04 }, lock: '3-5',
        trait: { k: 'calm', name: '稳住呼吸', v: 0.15, t: 3, desc: '回合进行中连续 3 秒没有起跳或扣杀，体力恢复速度额外 +15%；再次起跳或扣杀后结束。' },
        cost: '移动速度 −4%：短时间连续爆发的收益有限。', fits: ['canglan', 'zhu', 'ruibao', 'guoge'],
        desc: '米白色厚实鞋面，海盐蓝鞋带与后跟，侧面绘有连续起伏的路线纹。视觉稳重，不做夸张发光。' },
      { id: 'sh_moon', name: '逐月·后撤', style: '后场覆盖', spec: '前后分区底 · 箭形支撑片 · 月牙后跟', fx: { move: 0.04, lunge: -0.08, jump: -0.04 }, lock: '4-3',
        trait: { k: 'moon', name: '退半步看全场', v: 0.15, t: 0.35, w: 0.6, desc: '对手亲手击球后 0.6 秒内，首次向己方底线后撤时，前 0.35 秒启动能力额外 +15%（对手每次回球最多一次）。' },
        cost: '弹跳 −4%：抢高点扣杀略逊。', fits: ['lu', 'laochen', 'xingxing', 'ranran'],
        desc: '藏蓝色鞋面，银色月牙后跟，外侧支撑片是向后延伸的箭形。提前退到球后方组织回球。' },
    ],
  };
  YY.GEAR = GEAR;
  const GEAR_BY = {};
  for (const k in GEAR) for (const g of GEAR[k]) { g.cat = k; GEAR_BY[g.id] = g; }
  YY.gear = (id) => GEAR_BY[id];
  YY.GEAR_CATS = { racket: '球拍', string: '球线', tension: '磅数', shoe: '球鞋' };
  /** 每位角色的默认推荐组合（球拍 + 球鞋 + 打法）；玩家可以随时自由更换 */
  YY.GEAR_RECOMMEND = {
    lingfeng: ['r_light', 'sh_light', '快速救球、回位，再寻找空中进攻机会'],
    canglan: ['r_tide', 'sh_cruise', '拉长回合，配合水滴恢复持续调动'],
    xiaohong: ['r_heavy', 'sh_cushion', '压后场、抢高点、连续跳杀'],
    ranran: ['r_silk', 'sh_butterfly', '精细控网，上网后迅速撤回'],
    ruibao: ['r_shield', 'sh_light', '保留防守优势，补足移动短板'],
    xingxing: ['r_star', 'sh_moon', '连续变化球路，稳定完成回球积累星点'],
    dingding: ['r_light', 'sh_light', '装置收回后迅速接上普通回球与跑位'],
    houzi: ['r_heavy', 'sh_cushion', '利用高点进攻，改善落地后的继续作战'],
    lu: ['r_shield', 'sh_moon', '提前站位防守，抓接杀反抽机会'],
    laochen: ['r_prism', 'sh_moon', '根据预判到位，以准确落点调动对手'],
    guoge: ['r_heavy', 'sh_cruise', '保留爆发，通过拉吊间隙恢复体力'],
    tianchu: ['r_star', 'sh_stable', '球路变化结合急停转向，形成连续迷惑'],
    zhu: ['r_silk', 'sh_butterfly', '控制前场节奏，用落点弥补运动能力'],
  };
  /** 角色的推荐搭配（球线、磅数用标准值） */
  YY.recommendedGear = function (id) {
    const r = YY.GEAR_RECOMMEND[id];
    return r ? { racket: r[0], string: 's_dur', tension: 24, shoe: r[1] } : { racket: 'r_basic', string: 's_dur', tension: 24, shoe: 'sh_basic' };
  };
  /** 击球 / 移动特性：球拍、球鞋的 trait.k → 器械 id（比赛逻辑按特性判断） */
  YY.gearTrait = (id) => (GEAR_BY[id] && GEAR_BY[id].trait) || null;

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
    if (sel.char) addFx(d, YY.char(sel.char).fx); // 不带角色时只算器械（好友对决：角色基础能力相同）
    for (const id of [sel.racket, sel.string, sel.shoe]) { const g = GEAR_BY[id]; if (g) addFx(d, g.fx); }
    addFx(d, YY.tensionFx(sel.tension || YY.TENSION.def));
    const st = {};
    for (const k of KEYS) st[k] = Math.max(0.4, 1 + d[k]);
    return st;
  };
  /** 一套器械搭配：球拍 + 球线 + 磅数 + 球鞋 */
  YY.GEAR_DEFAULT = { racket: 'r_basic', string: 's_dur', tension: 24, shoe: 'sh_basic' };
  /** 校验外部传入的器械搭配（存档、联机消息），非法项回落到入门款 */
  YY.cleanGear = function (g) {
    const out = Object.assign({}, YY.GEAR_DEFAULT);
    if (!g || typeof g !== 'object') return out;
    for (const cat of ['racket', 'string', 'shoe']) { const it = typeof g[cat] === 'string' && GEAR_BY[g[cat]]; if (it && it.cat === cat) out[cat] = it.id; }
    const t = Number(g.tension);
    if (Number.isFinite(t)) out.tension = Math.max(YY.TENSION.min, Math.min(YY.TENSION.max, Math.round(t)));
    return out;
  };
  /** 只看器械（不含角色加成）的属性 */
  YY.gearStats = (g) => YY.buildStats(YY.cleanGear(g));
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
    v: 5,
    chars: ['lingfeng', 'canglan'],
    gear: ['r_basic', 's_dur', 'sh_basic', 'sh_run'],
    cards: [],
    feats: [],
    stages: {},
    seen: {},
    campaign: { choices: {}, clues: [], best: {}, checkpoint: null, difficulty: 'story', challengeStages: {}, challengeBest: {} },
    sel: { char: 'lingfeng', racket: 'r_light', string: 's_dur', tension: 24, shoe: 'sh_light' },
    kits: {},
    loadouts: {}, // 每位角色单独的器械搭配；没有记录的角色使用推荐组合
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
      // 器械可自由搭配（未解锁的也能选，故事模式里由 storyGear 换成入门款），这里只校验 id 与分类
      for (const key of ['racket', 'string', 'shoe']) if (GEAR_BY[clean.sel[key]]?.cat !== key) clean.sel[key] = def.sel[key];
      // v5：器械按角色分别保存。旧存档只有一套搭配：若玩家改过（不是入门款），就记到当时的出战角色上
      clean.loadouts = {};
      for (const [id, g] of Object.entries(d.loadouts && typeof d.loadouts === 'object' ? d.loadouts : {})) if (CHAR_BY[id]) clean.loadouts[id] = YY.cleanGear(g);
      if (!(d.v >= 5) && d.sel && typeof d.sel === 'object') {
        const old = YY.cleanGear(d.sel);
        if (old.racket !== 'r_basic' || old.shoe !== 'sh_basic' || old.string !== 's_dur' || old.tension !== 24) clean.loadouts[clean.sel.char] = old;
      }
      clean.kits = {};
      for (const [id, pick] of Object.entries(d.kits && typeof d.kits === 'object' ? d.kits : {})) if (CHAR_BY[id] && Array.isArray(pick)) clean.kits[id] = YY.skillSet(id, pick).act;
      clean.sel.tension = Number.isFinite(clean.sel.tension) ? Math.max(20, Math.min(30, Math.round(clean.sel.tension))) : 24;
      // v3 重写了剧本：旧版的环节进度与选择不再对应，保留通关星级、角色与装备
      const cp = d.v >= 3 ? d.campaign : null;
      if (cp && typeof cp === 'object') {
        clean.campaign.difficulty = cp.difficulty === 'challenge' ? 'challenge' : 'story';
        for (const [id,n] of Object.entries(cp.challengeStages || {})) if (/^\d+-\d+$/.test(id) && Number.isInteger(n) && n>=1 && n<=3) clean.campaign.challengeStages[id]=n;
        for (const [id,n] of Object.entries(cp.challengeBest || {})) if (/^\d+-\d+:\d+$/.test(id) && Number.isInteger(n) && n>=1 && n<=3) clean.campaign.challengeBest[id]=n;
        for (const [key,value] of Object.entries(cp.choices || {})) if (/^[a-z]{1,24}$/.test(key) && !['constructor','prototype'].includes(key) && typeof value === 'string') clean.campaign.choices[key] = value.slice(0,120);
        clean.campaign.clues = [...new Set((Array.isArray(cp.clues)?cp.clues:[]).filter(v=>typeof v==='string' && /^[a-z-]{1,32}$/.test(v)))].slice(0,100);
        for (const [key,value] of Object.entries(cp.best || {})) if (/^\d+-\d+:\d+$/.test(key) && Number.isInteger(value) && value>=1 && value<=3) clean.campaign.best[key]=value;
        const c=cp.checkpoint;
        if(c && c.version===1 && /^\d+-\d+$/.test(c.stage) && Number.isInteger(c.index) && c.index>=0 && c.index<30) {
          clean.campaign.checkpoint={version:1,stage:c.stage,index:c.index,difficulty:c.difficulty==='challenge'||!(d.v>=4)?'challenge':'story',line:Number.isInteger(c.line)&&c.line>=0?c.line:0,
            stars:(Array.isArray(c.stars)?c.stars:[]).filter(n=>Number.isInteger(n)&&n>=1&&n<=3).slice(0,30),
            ctx:{pickOk:c.ctx?.pickOk!==false,choices:{...clean.campaign.choices},env:c.ctx?.env && typeof c.ctx.env==='object'?{wind:Math.max(-3,Math.min(3,Number(c.ctx.env.wind)||0)),adapt:Math.max(0,Math.min(1,Number(c.ctx.env.adapt)||0))}:null},
            activity:{found:(Array.isArray(c.activity?.found)?c.activity.found:[]).filter(v=>typeof v==='string').slice(0,20)}};
        }
      }
      // 旧版已完成的是原强度：保留为挑战记录，同时不重锁任何解锁内容。
      if (!(d.v>=4)) {
        clean.campaign.challengeStages = {...clean.stages,...clean.campaign.challengeStages};
        clean.campaign.challengeBest = {...clean.campaign.best,...clean.campaign.challengeBest};
      }
      d = clean;
      this.d = d;
      Object.assign(d.sel, this.loadout(d.sel.char)); // sel 里的器械字段始终镜像出战角色的搭配（网页版界面直接读 sel）
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
    storyStars(id, difficulty=this.d.campaign.difficulty) { return difficulty==='challenge' ? this.d.campaign.challengeStages[id]||0 : this.stars(id); },
    setStars(id, n) { if (n > (this.d.stages[id] || 0)) { this.d.stages[id] = n; this.save(); } },
    /** 选择出战角色，或为出战角色更换某件器械 */
    choose(field, val) {
      if (field === 'char') { this.d.sel.char = val; Object.assign(this.d.sel, this.loadout(val)); }
      else if (YY.GEAR_DEFAULT[field] != null) return this.setGear(this.d.sel.char, field, val);
      else this.d.sel[field] = val;
      this.save();
    },
    /** 角色 id 的器械搭配（没有单独保存过时为推荐组合） */
    loadout(id = this.d.sel.char) {
      const g = this.d.loadouts && this.d.loadouts[id];
      return YY.cleanGear(g || YY.recommendedGear(id));
    },
    /** 为角色 id 更换一件器械（或磅数） */
    setGear(id, field, val) {
      if (!CHAR_BY[id] || YY.GEAR_DEFAULT[field] == null) return;
      const next = YY.cleanGear(Object.assign(this.loadout(id), { [field]: val }));
      this.d.loadouts = this.d.loadouts || {}; this.d.loadouts[id] = next;
      if (id === this.d.sel.char) Object.assign(this.d.sel, next);
      this.save();
    },
    /** 恢复角色的推荐组合 */
    resetGear(id) {
      if (this.d.loadouts) delete this.d.loadouts[id];
      if (id === this.d.sel.char) Object.assign(this.d.sel, this.loadout(id));
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
    /** 角色的器械搭配（自由对战、训练场、好友对决：全部器械与 20–30 磅都可自由搭配） */
    gear(id) { return this.loadout(id); },
    /** 故事模式里实际能用的搭配：未解锁的器械以入门款代替，学会磅数前固定 24 磅 */
    storyGear(id) {
      const g = this.gear(id);
      for (const cat of ['racket', 'string', 'shoe']) if (GEAR_BY[g[cat]].lock && !this.has('gear', g[cat])) g[cat] = YY.GEAR_DEFAULT[cat];
      if (!this.canTune()) g.tension = YY.TENSION.def;
      return g;
    },
    /** 能力值；free 为真时按自由搭配计算（非故事模式） */
    stats(free, id = this.d.sel.char) { return YY.buildStats(Object.assign({ char: id }, free ? this.gear(id) : this.storyGear(id))); },
    reset() { this.d = DEFAULT(); this.save(); },
  });
  Profile.load();
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof window !== 'undefined' ? window : globalThis);
