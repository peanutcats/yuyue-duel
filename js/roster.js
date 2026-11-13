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
      desc: "极限接球失败时留下脚印，下一分拾取恢复{15能量}。每分首次手动极限救球额外恢复{5能量}。" },
    yuyue: { name: '鱼跃追球', short: '鱼跃', color: '#ff6a52', cost: 25, sfx: 'skill-wind', tip: '鱼跃救起的球会急坠：提前上网，并留意场上的风',
      desc: "沿移动方向{飞扑救球}，回球过网后急坠，并产生持续{4秒}的顺风。未接到球时进入趴地状态。" },
    tafeng: { name: '空中踏风', short: '踏风', color: '#ffb199', cost: 20, sfx: 'skill-wind', air: true, tip: '疾风球很重：站稳在中场，接完马上回位',
      desc: "在空中再次起跳，按移动方向可调整跃进方向。强化下一次回球，{提高球速并击退接球者}。" },
    fengkou: { name: '风口急转', short: '风口', color: '#ffd0a8', cost: 20, sfx: 'skill-wind', tip: "避开风道里的球路，风道只改一球；他经过风道时回位更快",
      desc: "拖动布置持续{6秒}的风道，改变首个经过的球的飞行方向。自身经过风道时提高移动与启动速度。" },
    // —— 沧澜：潮水 ——
    dishui: { passive: true, name: '滴水回澜', short: '水滴', color: '#5cc8ff',
      desc: "回球后留下水滴，最多保留{3枚}。拾取一枚水滴恢复{12体力}。" },
    chaolai: { name: '潮来', short: '潮来', color: '#4aa8ff', cost: 30, sfx: 'skill-flow', tip: '她的半场积了水：第一次落水的球会弹起来，别以为打死了；第二次落水才算分',
      desc: "在己方半场生成持续{8秒}的积水，最多托球{2次}。每只来球首次落水时弹起，再次落水正常判分。" },
    tongyin: { name: '同饮一潮', short: '同饮', color: '#8fdcff', cost: 20, sfx: 'skill-flow', tip: '她体力低时别拉长回合：速战速决',
      desc: "体力低于对手时，吸取双方体力差值的{40%}，最多{25点}；否则在{5秒}内降低{20%}扣杀体力消耗。" },
    huichao: { name: '回潮', short: '回潮', color: '#2fe0ff', cost: 35, recast: true, sfx: 'skill-time', tip: '倒流的球随时会被放下：别站死；积水里卷起的浪涌球更快更重',
      desc: "使来球{沿原轨迹倒流}，再次释放使球就地下坠。积水弹起的球倒流更快，释放后转为浪涌球。" },
    // —— 小红：几何 ——
    biaochi: { passive: true, name: '角度标尺', short: '标尺', color: '#ff8a2a',
      desc: "显示击球角度参考线。手动完美回球获得校准标记，使下次放置的反射板{额外拦截1次}。" },
    fanshe: { name: '几何反射板', short: '反射', color: '#ff6f3c', cost: 25, sfx: 'skill-power', tip: '看板子标出的固定落区，提前移动；布置后有 0.45 秒准备时间',
      desc: "拖动放置反射板，延迟{0.45秒}生效，持续{10秒}。拦截1次来球并射向固定落区，最多{3块}反射板接力。" },
    zipao: { name: '自抛自扣', short: '自抛', color: '#ffb02e', cost: 25, sfx: 'skill-power', tip: '她把球垫起来要扣了：先退后防扣杀，板间接力看固定落区',
      desc: "将拍前来球垫起，拖动选择{垫球角度与力度}，点按垫至头顶。垫球后可继续手动击球。" },
    pingyi: { name: '辅助线', short: '校准', color: '#ffd23f', cost: 20, sfx: 'skill-power', tip: '她的两次手动回球更稳，多调动她，别送舒适的高球',
      desc: "持续{8秒}，强化{2次手动回球}：扩大击球时机窗口、稳定回球质量，并修正下网或出界球路。" },
    // —— 冉冉：球网机关 ——
    hudie: { passive: true, name: '蝴蝶结', short: '蝴蝶结', color: '#ff8fbf',
      desc: "网前回球过网后留下蝴蝶结，最多{2个}。蝴蝶结托起下一只擦网球，随后使其落下。" },
    tangqiu: { name: '穿花步', short: '穿花', color: '#ff6fae', cost: 20, recast:true, moveAim:true, sfx: 'skill-flow', tip: '留意她脚下的丝带；逼她交出折返，再打远端空当',
      desc: "沿选定方向轻跃，{2.5秒}内下一次手动回球质量不低于{80%}。{2.1秒}内再次释放，消耗己方1个蝴蝶结折返。" },
    hongxian: { name: '牵丝回旋', short: '牵丝', color: '#ff4d7a', cost: 25, recast: true, sfx: 'skill-flow', tip: '丝带只接己方球道的来球；她牵到球后，盯住出手方向',
      desc: "拖动放出丝带牵回来球。再次释放压向网前，向后或向上拖动挑向后场；可手动挥拍，{1秒}后自动出球。" },
    jiewang: { name: '蝶结弹弓', short: '弹弓', color: '#ffc2dc', cost: 25, recast:true, sfx: 'skill-flow', tip: '看球上的蝶结预告；打高远球避开她的网前连招',
      desc: "消耗己方{1个蝴蝶结}，强化{6秒}内下一次手动回球，过网后急坠或挑长。再次释放切换落区；球的过网高度须低于{3.35米}。" },
    // —— 王瑞：锅台反弹、回锅保馅与火候连携 ——
    zheteng: { passive: true, dependsOn: ['diban','huiguo','baozi'], name: '越折腾，越来劲', short: '折腾', color: '#ffb02e',
      desc: "完成地板过网、回锅补拍或肉包连携，回{6能量、8体力}，每分最多4次；{8秒}内衔接不同招式，下一拍获{旺火}强化。" },
    diban: { name: '地板开球', short: '地板', color: '#ff9a3d', cost: 22, recast:true, sfx: 'skill-power', tip: '他能在反弹后主动出锅，守住前后场中间；地面震波可以跳过',
      desc: "拍前砸球，或提前{8秒}准备下一拍；反弹后再按{出锅}，向前拖压短、向后拖打长。肉包入锅强化弹射。" },
    huiguo: { name: '回锅再炒', short: '回锅', color: '#ff6a3d', cost: 20, recast: true, sfx: 'skill-flow', tip: '回锅标记出现后尽早截击；收回时调整站位，提防强化补拍',
      desc: "提前{8秒}准备或给已出手的球挂回旋；再按收回并{强化补拍}。回锅保留肉包蓄力，地板球回锅点燃旺火。" },
    baozi: { name: '超大肉包球', short: '肉包', color: '#ffd28a', cost: 22, recast: true, sfx: 'skill', tip: '肉包减速不改变球权；逼他先回球，观察爆馅的长短方向',
      desc: "点按准备下一拍，近处来球自动投包；拖动掷包减速储能。自己回球后再按{爆馅}，向前拖压短、向后拖打长。" },
    // —— 星星：星门、月亮、重力 ——
    yekong: { passive: true, name: '夜空记事', short: '星点', color: '#ffe27a',
      desc: "每完成{2次手动回球}额外恢复{6能量}，每分最多{18点}。发球、自垫、回锅补拍与装置回球不计入。" },
    yueliang: { name: '月亮抓住了球', short: '月亮', color: '#fff3a8', cost: 30, recast: true, sfx: 'skill-flow', tip: '月亮里的球会沿切线甩出：看它转的方向，别贴着网等；她甩歪了就是你的分',
      desc: "拖动布置月亮，捕获来球并使其绕月旋转。再次释放沿{切线方向}甩出，旋转越久球速越高；己方半场内可继续补拍。" },
    xingmen: { name: '星门对望', short: '星门', color: '#c9a8ff', cost: 30, sfx: 'skill-time', tip: '星门出口发光时球还没出来：有 0.35 秒，朝出口方向移动',
      desc: "拖动选择前场或后场出口。下一次回球或月亮出球穿越星门，在出口停留{0.35秒}后飞出。" },
    zhongli: { name: '重力换班', short: '重力', color: '#9fb4ff', cost: 10, recast: true, sfx: 'skill-time', tip: '紫色的重力球随时会往上飘：别急着出拍，盯住她关掉的那一刻再迎',
      desc: "改变球的重力，使其上飘，并扩大月亮捕获范围。启动消耗{10能量}，每秒消耗{6能量}，最多持续{1.5秒}；再次释放关闭。" },
    // —— 丁丁：机械球拍 ——
    jixie: { passive: true, dependsOn: ['shensuo','xuanpai','youyou'], name: '机械回收', short: '回收', color: '#2fd38a',
      desc: "机械装置命中球后进入{3秒过载}，扩大拦截范围。收招时再次释放可快速回收，并返还{6能量}。" },
    shensuo: { name: '伸缩长拍', short: '长拍', color: '#4ff0a0', cost: 25, recast: true, sfx: 'skill-wind', tip: '看拍头的路线，打到它够不着的地方',
      desc: "拖动朝选定方向伸出长拍，拍头{自动拦截来球}。再次释放扫击回收，过载时扩大作用范围。" },
    xuanpai: { name: '双头旋拍', short: '旋拍', color: '#7dffcf', cost: 25, recast: true, sfx: 'skill-wind', tip: "看二段扫回方向；高吊绕过，等他收招再打空当",
      desc: "双头球拍{绕身旋转拦截}。再次拖动朝选定方向扫击，命中后再次释放快速回收；过载时扩大作用范围。" },
    youyou: { name: '棘轮悠悠', short: '飞轮', color: '#b8ffde', cost: 25, recast: true, sfx: 'skill-mechanical', tip: '飞轮锁球时亮金色窗口；他可以提前弹射，也能等飞轮带回后亲手打',
      desc: "投出机械飞轮截球。锁球后再次释放张弦弹射，{合齿窗口}内出手更稳定；未释放时将球带回拍前，可继续手动击球。" },
    // —— 猴子：灵猴 · 游戏梗 ——
    liansha: { passive: true, name: '连杀播报', short: '连杀', color: '#ffb347',
      desc: "连续得分获得额外能量：第2分{3点}、第3分{5点}、此后每分{8点}。至少2连胜被终结时，对手额外获得{10能量}。" },
    jindou: { name: '筋斗云', short: '筋斗', color: '#ff9f2f', cost: 30, sfx: 'skill-wind', tip: '他会飞到高点等杀：打低平快球或放网',
      desc: "驾云跃至来球最高点，最多悬停{1.4秒}。提高下一次回球质量，可衔接空中扣杀。" },
    dangteng: { name: '荡藤飞跃', short: '荡藤', color: '#7dd35a', cost: 25, recast: true, sfx: 'skill-wind', tip: '他在藤上收不住：看他松手的方向，打另一边',
      desc: "拖动选定方向荡起，再次拖动{定向跃出}。飞行中可微调位置，并衔接筋斗云或强化回击。" },
    haomao: { name: '毫毛小猴', short: '小猴', color: '#ffcf5a', cost: 30, sfx: 'skill', tip: '小猴来回巡逻：避开它的位置，看见香蕉皮就跳',
      desc: "召唤持续{7秒}的小猴，准备后巡逻并拦截{1次}来球，同时放置1块香蕉皮。" },
    // —— 路先森：程序指令 ——
    rizhi: { passive: true, name: '错误日志', short: '日志', color: '#7fd6ff',
      desc: "记录挥空原因。成功回击两类来球，或回击日志记录的来球后，获得{编译标记}，延长复制体持续时间或强化接力回球。" },
    fuzhi: { name: '复制体', short: '复制体', color: '#5fb8ff', cost: 30, sfx: 'skill-time', tip: '复制体守着原地：把球打到它和本体都够不着的空当，别打它身边',
      desc: "在原地生成持续{8秒}的复制体，同步跳跃、挥拍与技能。复制体不移动，其回球落在己方半场时{可弹起1次}。" },
    jieli: { name: '接力协议', short: '接力', color: '#4fe0ff', cost: 20, sfx: 'skill', tip: '接力后要等他再挥一拍：盯住接力落点，准备接扣杀',
      desc: "将身边来球{垫向本体或复制体另一端}，向上拖动高传，平拖快传。无复制体时进行自垫，可衔接手动击球。" },
    zangshu: { name: '脏数据', short: '脏数据', color: '#9dff7a', cost: 25, sfx: 'skill-mirage', stealth: true, tip: '脏数据球和真球长得一样：它落地会乱弹，真球只有一只',
      desc: "释放外观与真球一致的脏数据球，可被击打，落地后弹向另一半场；被击打或弹回累计{5次}后消失。复制体同步释放。" },
    // —— 老陈：提前安排 ——
    qiandao: { passive: true, name: '签到表', short: '签到', color: '#6fe3d0',
      desc: "记录对手最近{3次}击球位置，同一前场或后场出现2次时形成习惯区。预约该区时加快投影，并扩大区内冰区。" },
    yati: { name: '查找替换', short: '替换', color: '#4fd8c0', cost: 25, sfx: 'skill-time', tip: '头顶显示替换目标和余量；两次手动回球都会被改写，提前按替换后的落区安排跑位',
      desc: "标记对手{10秒}，{0.18秒}后将其{2次手动回球}改为高球；向前拖动改为网前球。发球、挥空和装置不消耗次数。" },
    yueqiu: { name: '预约击球', short: '预约', color: '#8ff0dc', cost: 25, sfx: 'skill', tip: '投影只守半个场：往另一半打',
      desc: "预约己方一个半场，持续{8秒}。向前拖动选择网前，否则选择后场；投影回击落入预约区的来球。" },
    shuangji: { name: '冻结窗格', short: '冻结', color: '#a8e8ff', cost: 25, sfx: 'skill', tip: '冰面上急停与转向会滑远，提前减速、起跳越过或从侧面绕行',
      desc: "冻结对方地面{10秒}，{0.35秒}后生效。冰区急停、转向时{惯性打滑}；腾空不受影响，习惯区扩大范围。" },
    // —— 果哥：投资 ——
    jihui: { passive: true, name: '装备交易所', short: '资产', color: '#ffd23f',
      desc: "开局{500金币}，回球得分赚钱，失分扣钱，依资产升级装备。火箭档每{3次完美回球}蓄满1次推进。" },
    ganggan: { name: '押这一分', short: '押注', color: '#ff3f6f', cost: 20, sfx: 'skill-power', tip: '他押了这一分：稳住别失误，拖长回合让他着急',
      desc: "消耗{100金币}押注本分，每分限1次。获胜时，发球前押注返还{300金币}，回合中押注返还{200金币}；失利不返还。" },
    jiepan: { name: '红包雨', short: '红包', color: '#ff5a4a', cost: 25, sfx: 'skill-flow', tip: '地上的红包别踩：跳过去，或者绕开再接球',
      desc: "消耗{60金币}，在对方半场投下{3个红包}，持续{5秒}。对手在地面踩中时弯腰拾取，停留{0.4秒}。" },
    qiquan: { name: '一掷千金', short: '千金', color: '#ffd23f', cost: 25, sfx: 'skill-power', tip: '接金砖球会被震退，回球质量也会降低，提前站稳接球',
      desc: "消耗{50金币}强化下一次回球，降低接球者回球质量并将其击退。该球直接得分时，额外获得{200金币}。" },
    // —— 田楚：心理欺骗 ——
    canying: { passive: true, name: '影子慢半拍', short: '残影', color: '#9ff0ff',
      desc: "急停或转向时，留下{沿原方向继续奔跑的残影}。" },
    jingxiang: { name: '镜花水月', short: '镜像', color: '#7fe8ff', cost: 30, sfx: 'skill-mirage', stealth: true, tip: '三只里只有一只真：等到最后一刻再扑',
      desc: "将球分化为{1只真球与2只假球}。向前拖动使真球走近线，向后拖动走远线，点按保持原球路。" },
    meida: { name: '这一拍，没打', short: '假拍', color: '#c8f6ff', cost: 20, sfx: 'skill-mirage', stealth: true, tip: '第一只是假的：盯住他拍前那只',
      desc: "对近身来球虚挥，假球飞向对手，{真球垫至身前}，随后可继续手动击球。" },
    shuizhong: { name: '水中月', short: '变轨', color: '#5fd0ff', cost: 30, recast: true, sfx: 'skill-mirage', stealth: true, tip: '看到水纹先别动：等它拐弯',
      desc: "回球过网后生成水纹。再次释放{改变真实球路}：向前拖动收至网前，向后拖动送向后场，并在原落点留下虚影。" },
    // —— 朱老师：长短布局、虚实调动（沿用技能 ID，已保存的搭配直接生效） ——
    kandong: { passive: true, name: '长短有章', short: '布局', color: '#b4edbe',
      desc: "手动长短球{交替过网}积1层布局，最多{2层}。满层后下一次轻巧回球质量≥{94%}，恢复{6能量、5体力}；不加速，发球与幻象不触发。" },
    jiezou: { name: '老谋深算', short: '虚实', color: '#75d9b8', cost: 30, sfx: 'skill-mirage', stealth: true,
      tip: '幻象不跳不杀，反应与覆盖有限；快球追身、连续变线能逼本体出手。',
      desc: "隐身{6秒}并生成{AI幻象}独立追球，幻象{不跳不杀}、覆盖有限。本体自由移动，击球{显形0.8秒}，空中全程显形，剩余时间可再隐身。" },
    biaozhi: { name: '标志桶', short: '标志桶', color: '#ff8f3a', cost: 25, sfx: 'whistle', tip: '跳过标志桶，或提前绕到另一边',
      desc: "在对手身前放置持续{4.5秒}的标志桶，阻挡地面移动；向后拖动改为放置在其身后。" },
    tingyixia: { name: '请君入瓮', short: '设局', color: '#ecd18e', cost: 25, sfx: 'whistle',
      tip: '来球过网才决定长短，保持中场观察真实变线；抢高点可缩短回球时间。',
      desc: "准备{10秒}内{2次手动轻巧回球}。过网时对手压前则{挑后场}、守后则{放网前}，3D兼顾侧向空当；扣杀、发球与幻象不消耗次数。" },
  };
  // 详情页的完整说明（{关键效果} [操作] <代价 / 风险>；\n 分段）
  // 手机优先：先准备再击球；二段提供宽裕窗口，普通击球自动完成连携。
  SKILLS.shihua = {"name":"化石采样","short":"采样","color":"#e9b866","desc":"手动回球记录击球高度。集齐{低、中、高}3层记录，恢复{10体力}与{8能量}。","detail":"","passive":true};
  SKILLS.jibei = {"name":"脊骨高台","short":"高台","color":"#e9b866","desc":"升起持续{10秒}的骨骼高台，站上后可进行高点击球。再次释放切换升降；台上展翼可猎航{6秒}。","detail":"","cost":25,"sfx":"skill-power","tip":"高台固定在原地，打两侧空当或低球迫使他降台、离台。","aim":"vector","recast":true};
  SKILLS.yimo = {"name":"始祖鸟猎航","short":"猎航","color":"#ffc87b","desc":"进入持续{4.5秒}的猎航，移速提高{55%}、接球范围提高{35%}，自动调整接球高度。完成{2次回球}后收翼。","detail":"","cost":20,"sfx":"skill-wind","tip":"飞行有次数和时间限制，先调动两侧再放低球；观察剩余羽片，等他收翼后进攻。","recast":true};
  SKILLS.weichui = {"name":"骨尾甩击","short":"骨尾","color":"#d99649","desc":"准备骨尾，强化{8秒}内下一次普通击球，自动衔接尾击。拖动选择上挑或下压，腾空下压时效果更强。","detail":"","cost":30,"sfx":"skill-power","tip":"看骨尾指向的角度，提前留意高弧与压低球路；调动他离开高点。","aim":"vector"};
  SKILLS.dingzhou = {"name":"顺势旋力","short":"旋力","color":"#77ded3","desc":"回球后8秒内移动{1.15米}积累1层旋力，最多{2层}，强化下一拍弧线；每分前3次回位额外恢复{4体力}。滑步与转体也可积累旋力。","detail":"","passive":true};
  SKILLS.dianbu = {"name":"回旋滑步","short":"滑步","color":"#64d7c6","desc":"沿选定方向滑行约{2.25米}，获得1层旋力。落地且间隔{0.22秒}后可再次释放，第2段保留{6秒}；{2秒}内衔接转体可继承惯性。","detail":"","cost":20,"sfx":"skill-wind","tip":"看脚下滑行方向，逼她交第二段后再调动；滑步没有自动接球。","recast":true,"aim":"vector"};
  SKILLS.bianpai = {"name":"燕尾双旋","short":"燕尾","color":"#a7f4df","desc":"准备持续{8秒}的{2次旋转回球}。上拖漂长，下拖急坠，再次释放切换模式。过网后弯曲增强，旋力层数提高弯曲幅度。","detail":"","cost":25,"sfx":"skill-wind","tip":"看拍旁向上或向下的弧箭头；提前截击能压缩过网后的变线时间。","recast":true,"aim":"vector"};
  SKILLS.jieli_jump = {"name":"腾身转体","short":"转体","color":"#37b6b1","desc":"转体跃起并获得{1层旋力}，空中接球范围扩大{20%}，击球时机窗口扩大{16%}，顶点最多缓落{0.32秒}。衔接滑步继承惯性，空中可调整移动。","detail":"","cost":22,"sfx":"skill-wind","tip":"观察起跳惯性，打其身下低球或反方向；她仍需要够到真实来球。"};
  SKILLS.gongxiu = {"name":"压力转接","short":"借力","color":"#dfad76","desc":"手动接球时借用来球动能，来球越快反击越强，并缩短收拍。每分前{6次回球}各恢复{2体力}。","detail":"","passive":true};
  SKILLS.tongqin = {"name":"当场退回","short":"退回","color":"#f09881","desc":"准备{12秒}内{2次借力反击}，接球范围+{25%}、时机窗+{30%}、质量≥{95%}；快球借速，吊球卸短。","detail":"","cost":25,"sfx":"office-return","tip":"用慢吊减少借力，观察他的击球方式，防反打也防卸短。"};
  SKILLS.gongwei = {"name":"纸镖加急","short":"纸镖","color":"#9fdedd","desc":"准备{12秒}内{2次纸镖回球}，羽裙折成窄锋，基础阻力降至{37%}，球路更平更快。可与退回、滑翔叠加。","detail":"","cost":25,"sfx":"paper-fold","tip":"纸镖减速较慢，提前回到中场，留意低平穿越球。"};
  SKILLS.jiaban = {"name":"周报滑翔","short":"滑翔","color":"#f0d7a0","desc":"准备{12秒}内{2次折纸滑翔回球}。过网展翼滑行，临近落区收翼急坠；保留手动长短选择，可与纸镖叠加。","detail":"","cost":25,"sfx":"paper-glide","tip":"看纸翼开合，可在展翼前截击；收翼后会落得更急。"};
  SKILLS.lvyue = {"name":"读羽留影","short":"留影","color":"#c8d9ef","desc":"切换短球、进攻球或深球，积累1格底片。镜头技能形成界内回球时消耗1格，恢复{5能量、4体力}。","detail":"","passive":true};
  SKILLS.sanbu = {"name":"慢镜取景","short":"慢镜","color":"#9bb8e5","desc":"持续{9秒}，自动取景{2只来球}。来球靠近球网时减速至{54%}，最多持续{1.45秒}；取景时提高追球、接球范围与稳定性。","detail":"","cost":30,"sfx":"skill-time","tip":"落点照常，准备迎接他的变线；看到取景框后先回到中场。"};
  SKILLS.yipai = {"name":"轨迹复映","short":"复映","color":"#d8e3f5","desc":"在{8秒}内改剪{2次回球}，保留原击球类别，调整为近落点或深落点。再次释放免费切换模式。","detail":"","cost":25,"sfx":"skill-time","tip":"看他预备的是近剪还是深剪，避免太早押前场或后场。","aim":"vector","recast":true};
  SKILLS.jingmo = {"name":"快进一拍","short":"快进","color":"#7798c5","desc":"在{8秒}内加速{2次回球}。球以正常速度出拍，随后沿原球路逐渐加速；与慢镜或复映同时触发时进一步加速。","detail":"","cost":25,"sfx":"skill-time","tip":"看到快进箭头就先回位，按原落区接球，别等球提速才启动。"};
  // 三位球友重制：保留技能 ID 和已保存搭配，全面更换机制。
  Object.assign(SKILLS, {
  "moyun": {
    "passive": true,
    "name": "墨涌",
    "short": "墨涌",
    "color": "#bec5df",
    "sfx": "skill-flow",
    "desc": "累计{2次完美击球}后，下一拍附墨并以球拍滴墨预告。附墨球被对手击中时立即爆墨；合环提示最佳挥拍时机。",
    "detail": ""
  },
  "feibai": {
    "name": "飞白藏羽",
    "short": "藏羽",
    "color": "#e1ced4",
    "cost": 25,
    "club": true,
    "dur": 8,
    "charges": 1,
    "sfx": "skill-mirage",
    "desc": "下一次回球起飞后隐去{0.36秒}，接近对手或降至低位时提前显形，可同时作用于回眸假球。",
    "detail": "",
    "tip": "记住最初的方向，不要盲目追影；在显形窗口或低点接球。"
  },
  "liubai": {
    "name": "妩媚回眸",
    "short": "回眸",
    "color": "#dc91ad",
    "cost": 23,
    "club": true,
    "dur": 4,
    "charges": 1,
    "sfx": "skill-mirage",
    "desc": "回眸侧身滑出一步，留下香影。{4秒}内下一次回球同时释放1只长短方向相反的假球。",
    "detail": "",
    "tip": "香影和花瓣是假动作；先守中间，依据真正的触球声和复现判断。"
  },
  "luokuan": {
    "name": "朱砂险线",
    "short": "险线",
    "color": "#e36777",
    "cost": 28,
    "club": true,
    "dur": 8,
    "charges": 1,
    "recast": true,
    "sfx": "skill-flow",
    "desc": "强化下一次回球为{压线或贴网}，再次释放切换。达到质量要求时校正落点；完美回球不增加消耗，普通回球额外消耗{8体力}。",
    "detail": "",
    "tip": "看「压线/贴网」标记；逼她跑动勉强击球，险球就难以校准。"
  },
  "qiuyou": {
    "passive": true,
    "name": "三威胁热手",
    "short": "热手",
    "color": "#ffc078",
    "desc": "使用突破、空接、变节奏中{2种不同花式}蓄满热手，强化下一招为{三段步、双篮板或长压哨}。",
    "detail": ""
  },
  "ouzhou": {
    "name": "欧洲步换手",
    "short": "换手",
    "color": "#f0a055",
    "cost": 22,
    "club": true,
    "dur": 1.25,
    "recast": true,
    "sfx": "skill-wind",
    "desc": "第一步切入{1.35米}，{1.25秒}内再次释放可换向跨出{1.65米}；两段分别读取移动方向。",
    "detail": "",
    "tip": "不要追第一步；观察是否还有第二段，再把球送向他身后。"
  },
  "gongdan": {
    "name": "篮板空接",
    "short": "篮板",
    "color": "#f3bc74",
    "cost": 28,
    "club": true,
    "dur": 6,
    "sfx": "skill-power",
    "desc": "在己方放置局部篮板，托起{1次下落来球}。球保留在己方半场，可衔接手动跳跃与二次进攻。",
    "detail": "",
    "tip": "把球打向篮板侧面或高远绕开，等他起跳后再准备反击。"
  },
  "kongjie": {
    "name": "压哨三秒",
    "short": "压哨",
    "color": "#ffd76e",
    "cost": 26,
    "club": true,
    "dur": 3,
    "charges": 1,
    "sfx": "skill-time",
    "desc": "开启{3秒}倒计时，最后{0.8秒}内手动回球获得加速险球效果。未在时限内触球则消耗{6体力}。",
    "detail": "",
    "tip": "看倒计时，长高球拖过窗口，或逼他提前出拍。"
  },
  "guance": {
    "passive": true,
    "name": "负载回收",
    "short": "缓存",
    "color": "#8de0cf",
    "desc": "手动接回高点或高速来球，或使对手接到过载球，积累{1格缓存}，用于迷雾下沉或反压补给。",
    "detail": ""
  },
  "lingxin": {
    "name": "过载投递",
    "short": "过载",
    "color": "#efa568",
    "cost": 28,
    "club": true,
    "dur": 8,
    "charges": 1,
    "sfx": "skill-power",
    "desc": "下一次回球附加{过载}。对手接球额外消耗{12体力}，且其后{2次回球}收招变慢、质量降低。",
    "detail": "",
    "tip": "短吊卸力清掉两拍负载，或用装置接球；不要疲劳时连续跳杀。"
  },
  "kuorong": {
    "name": "天空迷雾",
    "short": "迷雾",
    "color": "#9fc7db",
    "cost": 27,
    "club": true,
    "dur": 6,
    "recast": true,
    "sfx": "skill-flow",
    "desc": "在对手半场生成{2.6米以上}的迷雾。再次释放可降至{1.95米}，持续时间缩短{2秒}；消耗缓存可抵消缩时。",
    "detail": "",
    "tip": "盯住入雾方向和雾线，提前站位；平低回球和贴网短球不受迷雾影响。"
  },
  "rongzai": {
    "name": "熔断反压",
    "short": "反压",
    "color": "#9ee0cf",
    "cost": 28,
    "club": true,
    "dur": 5,
    "sfx": "skill-power",
    "desc": "立即结束收招，清除过载与墨盲。{5秒}内下一次手动接球强化反击，吸收过载或消耗缓存可提高强化效果。",
    "detail": "",
    "tip": "用慢吊减少反压收益，拉开左右与长短；观察护罩消失后再打重球。",
    "charges": 1
  }
});
  YY.SKILLS = SKILLS;
  // 技能瞄准使用独立坐标：x 正数向网，y 正数向上；与移动输入无关。
  // 鱼跃、踏风不拖动：按住移动方向再按技能（moveAim），不按方向时自动判断。
  for (const id of ['jieli','fengkou','fanshe','zipao','tangqiu','hongxian','jiewang','diban','baozi','yueliang','xingmen','shensuo','xuanpai','youyou','dangteng','haomao','yati','yueqiu','shuangji','jingxiang','shuizhong','biaozhi']) SKILLS[id].aim = ['jieli','fengkou','xuanpai','fanshe','zipao','pingyi','hongxian','diban','baozi','yueliang','shensuo','youyou','dangteng','shuangji'].includes(id) ? 'vector' : 'choice';
  for (const id of ['yuyue','tafeng']) SKILLS[id].moveAim = true;
  for (const sk of Object.values(SKILLS)) sk.desc = sk.desc.replaceAll('[前进]', '[向前拖]').replaceAll('[后退]', '[向后拖]').replaceAll('[按方向]', '[拖动技能]');
  // 1.31 技能文案：统一为「效果 + 怎么用 + 关键限制」，卡片说明控制在 70 字内。
  // 原文案保留在上方数据里便于对照；这里覆盖最终展示文本，网页、微信与技能文档共用。
  const SKILL_COPY_131 = {
    yihan: "极限救球失败会留下脚印，下一分拾取恢复{15能量}；每分首次极限救球再多回{5能量}。",
    yuyue: "朝移动方向{飞扑救球}，回球过网后急坠并带起{4秒}顺风；扑空会趴地，起身前无法行动。",
    tafeng: "在空中再跳一次，可用方向调整跃进方向；下一拍回球{更快更重}，把对手击退。",
    fengkou: "布置一条持续{6秒}的风道，让第一只经过的球{改变方向}；自己穿过风道会跑得更快。",
    dishui: "每次回球留下水滴（最多{3枚}），走过去捡起回复{12体力}。",
    chaolai: "在己方半场铺{8秒}积水，每只球第一次落水会{弹起}，第二次才判分；最多托{2次}。",
    tongyin: "体力比对手低时，把双方体力差的40%{补给自己}（最多25点）；否则5秒内扣杀少耗20%体力。",
    huichao: "让来球{沿原路倒流}，再按一次就原地落下；积水弹起的球倒流更快，还会变成浪涌球。",
    biaochi: "显示击球角度参考线；手动完美回球后获得校准，下一次反射板{多拦一球}。",
    fanshe: "放置反射板，{0.45秒}后生效，把来球挡向固定落区；最多{3块}接力，持续10秒。",
    zipao: "把拍前的球{垫到头顶}，拖动决定方向和力度；垫起后还要自己再挥拍进攻。",
    pingyi: "接下来{8秒}的2次手动回球更稳：判定窗口更大、质量更高，还能救回下网或出界球。",
    hudie: "网前回球过网后留下蝴蝶结（最多{2个}），托起下一只擦网球，然后让它落下。",
    tangqiu: "朝选定方向轻跃，{2.5秒}内下一拍回球质量不低于80%；2.1秒内再按，消耗1个蝴蝶结折返。",
    hongxian: "拖动丝带{牵住来球}，再按一次压向网前；向后或向上拖可挑后场，1秒后自动出球。",
    jiewang: "消耗1个蝴蝶结，让{6秒}内下一次回球过网后急坠或挑长；再按切换落区，球过网须低于3.35米。",
    zheteng: "完成地板过网、回锅补拍或肉包连携，回{6能量、8体力}，每分最多4次；{8秒}内衔接不同招式，下一拍获{旺火}强化。",
    diban: "拍前砸球，或提前{8秒}准备下一拍；反弹后再按{出锅}，向前拖压短、向后拖打长。肉包入锅强化弹射。",
    huiguo: "提前{8秒}准备或给已出手的球挂回旋；再按收回并{强化补拍}。回锅保留肉包蓄力，地板球回锅点燃旺火。",
    baozi: "点按准备下一拍，近处来球自动投包；拖动掷包减速储能。自己回球后再按{爆馅}，向前拖压短、向后拖打长。",
    yekong: "每完成{2次手动回球}回复{6能量}，每分最多18点；发球、自垫、回锅补拍和装置回球不算。",
    yueliang: "放置月亮捕获来球，让它绕月旋转；再按沿{切线}甩出，转得越久球越快，己方半场还能补拍。",
    xingmen: "拖动选前场或后场出口；下一次回球或月亮出球会穿过星门，在出口停{0.35秒}后飞出。",
    zhongli: "让球{向上飘}并扩大月亮捕获范围；开启10能量、每秒6能量，最多1.5秒，再按关闭。",
    jixie: "机械装置碰到球就进入{3秒过载}，拦截范围变大；收招时再按可快速收回，并返还6能量。",
    shensuo: "朝指定方向伸出长拍，拍头{自动拦球}；再按扫击收回，过载时范围更大。",
    xuanpai: "双头拍{绕身旋转拦球}；再拖动选方向扫击，命中后再按快速收回；过载范围更大。",
    youyou: "投出飞轮截球；锁球后再按张弦弹射，{金色合齿窗口}内更稳；不按则把球带回拍前。",
    liansha: "连续得分回复{额外能量}：第2分3点、第3分5点、之后每分8点；2连胜被终结时对手多拿10能量。",
    jindou: "驾云升到球的最高点，最多悬停{1.4秒}；下一拍回球质量更高，还能接空中扣杀。",
    dangteng: "拖动选方向荡起，再拖一次{定向跃出}；飞行中可微调，并接筋斗云或强化回球。",
    haomao: "召唤{7秒}小猴，它会准备后巡逻并替你拦下{1球}，同时留下1块香蕉皮。",
    rizhi: "记录挥空原因；接回两类不同来球，或接回记录过的球路，获得{编译标记}，可延长复制体或强化接力。",
    fuzhi: "原地放一个{8秒}复制体，跟着你跳、挥拍和放技能；它不移动，回球落在己方半场时可弹起1次。",
    jieli: "把身边的球{垫向本体或复制体}；上拖高传、平拖快传。没有复制体就自垫，之后还能再击球。",
    zangshu: "放出一只和真球一样的{脏数据球}，可被击打，落地后弹向另一半场；被碰5次消失。复制体也会放。",
    qiandao: "记录对手最近{3次}击球位置；同一前场或后场出现2次就形成习惯区，预约该区更快、冰区更大。",
    yati: "标记对手{10秒}；0.18秒后把他的{2次手动回球}改成高球，向前拖则改成网前球。发球、挥空、装置不算。",
    yueqiu: "在己方半场预约一块区域{8秒}；向前拖选网前，否则选后场，投影会替你回击落入该区的球。",
    shuangji: "冻结对方地面{10秒}，0.35秒后生效；在冰区急停、转向会{打滑}，跳起可躲，习惯区会加宽冰面。",
    jihui: "开局{500金币}，回球、得分赚钱，失分扣钱，钱越多装备越强；火箭档每3次完美回球蓄满一次推进。",
    ganggan: "花{100金币}押本分，每分限一次；赢了发球前押返300、回合中押返200，输了不退。",
    jiepan: "花{60金币}在对方半场撒下{3个红包}，持续5秒；对手踩中会弯腰捡钱，停{0.4秒}。",
    qiquan: "花{50金币}强化下一拍，接球者回球质量下降并被击退；这球直接得分再奖200金币。",
    canying: "急停或转向时，留下一个{继续沿原方向跑}的残影，干扰对手判断。",
    jingxiang: "把球分成{1真2假}；向前拖真球走近线，向后拖走远线，点按保持原线；只有真球计分。",
    meida: "对近身球虚挥一拍，假球飞向对手，{真球垫到身前}；随后还要自己再挥拍。",
    shuizhong: "回球过网后留下水纹；再按一次{改变真球落点}：前拖收网前、后拖送后场，原落点留虚影。",
    kandong: "手动长短球{交替过网}积1层布局，最多2层；满层后下一拍轻巧回球质量≥94%，回复6能量、5体力。",
    jiezou: "隐身{6秒}并留下自动追球的幻象；幻象{不跳不杀}，本体击球会显形0.8秒，空中全程可见。",
    tingyixia: "准备{10秒}内的2次轻巧回球：过网时对手压前就{挑后场}、守后就放网前；3D还会找侧向空当。扣杀、发球、幻象不算次数。",
    biaozhi: "在对手身前放一个{4.5秒}的标志桶挡路；向后拖改放到他身后，逼他绕行或起跳。",
    shihua: "手动回球记录低、中、高三种击球高度；集齐{3层}，回复10体力与8能量。",
    jibei: "升起{10秒}骨台，站上去就能高点击球；再按切换升降，台上展翼可猎航6秒。",
    yimo: "展开{4.5秒}猎航：移速+55%、够球范围+35%，自动调整接球高度；完成2次回球后收翼。",
    weichui: "准备骨尾，强化{8秒}内下一拍并自动接尾击；拖动选上挑或下压，腾空下压更强。",
    dingzhou: "回球后8秒内移动{1.15米}积1层旋力（最多2层），让下一拍弧线更弯；每分前3次回位回4体力。",
    dianbu: "沿选的方向滑{2.25米}并得1层旋力；落地0.22秒后可再滑一段，2秒内接转体可继承惯性。",
    bianpai: "准备{8秒}内的2次旋转回球；上拖漂长、下拖急坠，再按切换。过网后弧线更弯，旋力越高弯得越多。",
    jieli_jump: "转体跃起得{1层旋力}；空中够球范围+20%、挥拍判定+16%，顶点最多缓落0.32秒，可接滑步惯性。",
    gongxiu: "手动接球时借来球的力量反击，{来球越快反击越强}，并更快收拍；每分前6次回球各回2体力。",
    tongqin: "准备{12秒}内的2次借力反击：够球范围+25%、挥拍判定+30%、质量≥95%；快球借速、吊球卸短。",
    gongwei: "准备{12秒}内的2次纸镖回球：羽裙折成窄锋，阻力降到{37%}，球路更平更快，可与退回/滑翔叠加。",
    jiaban: "准备{12秒}内的2次滑翔回球：过网展翼滑行，临近落区时收翼急坠；长短仍由你选择，可与纸镖叠加。",
    lvyue: "切换短球、进攻球或深球各积1格{底片}；镜头技能打出界内回球时消耗1格，回复5能量、4体力。",
    sanbu: "持续{9秒}，自动取景2只来球；球靠近球网时减速到54%（最多1.45秒），同时追球、接球更稳。",
    yipai: "在{8秒}内改剪2次回球：保留原击球类别，只把落点改成近网或深区；再按免费切换。",
    jingmo: "在{8秒}内让2次回球出拍后{沿原路逐渐加速}；与慢镜或复映同时触发会更快。",
    moyun: "累计{2次完美击球}后，下一拍附墨并提前滴墨预告；对手碰到会立刻爆墨，球拍合环提示最佳挥拍。",
    feibai: "下一拍回球起飞后{隐去0.36秒}，接近对手或降到低点会提前显形；也能作用在回眸假球上。",
    liubai: "侧身滑一步留下香影；{4秒}内下一拍回球会同时放出一只长短相反的假球。",
    luokuan: "把下一拍强化为{压线或贴网}，再按切换；达到质量才校准落点，完美回球不额外耗体力，普通回球多耗8点。",
    qiuyou: "用突破、空接、变节奏中的{2种不同花式}蓄满热手，把下一招强化成三段步、双篮板或长压哨。",
    ouzhou: "第一步切入{1.35米}；1.25秒内再按可换向跨出1.65米，两段分别按你的移动方向走。",
    gongdan: "在己方放一块局部篮板，托起{1次下落来球}；球留在己方半场，可接跳跃和二次进攻。",
    kongjie: "开启{3秒}倒计时，最后0.8秒内手动回球会变成加速险球；超时没碰到球要扣6体力。",
    guance: "手动接回高点或高速球，或让对手接过载球，积{1格缓存}；缓存可用于迷雾下沉或反压强化。",
    lingxin: "下一拍附加{过载}：对手接球多耗12体力，之后2次回球收招更慢、质量更低。",
    kuorong: "在对手半场放{2.6米以上}迷雾；再按可降到1.95米，但少持续2秒，花1格缓存可抵消。",
    rongzai: "立刻结束收招，清掉过载和墨盲；{5秒}内下一拍接球反击更强，吸收过载或花缓存还能再强化。",
  };
  for (const [id, desc] of Object.entries(SKILL_COPY_131)) if (SKILLS[id]) SKILLS[id].desc = desc;
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
  [{accel:.86},{accel:.92},{accel:1},{accel:1.35,swing:.94},{accel:1.42,swing:.92,smashCost:.88},
   {accel:1.5,swing:.9,smashCost:.88,timing:1.14},{accel:1.55,swing:.88,smashCost:.86,timing:1.14}]
    .forEach((v,i)=>Object.assign(YY.MARKET_TIERS[i],v));
  // 各档装备的外观与特点（技能详情页、器械预览使用；卡片只放得下三行）
  ['光脚破木拍：击球木屑乱飞，一步一个脚印、满头汗；又软又慢。',
   '背心人字拖：击球掉木屑，跑起来啪嗒扬灰，急停拖沓。',
   '合金拍运动鞋：金色挥拍弧、急停刹车痕，正常发挥。',
   '碳光速行：单翼轻装、细长光刃，启动加速35%，挥拍更快。',
   '纳米堡垒：蜂巢重肩甲、六角盾拍与悬浮靴，扣杀体力消耗降低12%。',
   '量子实验室：悬浮双环与卫星、粒子环拍，击球时机窗口扩大14%。',
   '火箭武装：宽展双翼、双引擎喷口、火箭矛拍；三次完美回球蓄满推进。'].forEach((perk, i) => { YY.MARKET_TIERS[i].perk = perk; YY.MARKET_TIERS[i].min = i ? YY.MARKET_TIERS[i - 1].max + 1 : 1; });
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
  delete SKILLS.tangqiu.aim;
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
      eye: '#24160c', wrist: '#ffcf5a', num: '果', swoosh: '255,180,90',
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
    bobo: L({name:'波波',hair:'mess',glasses:'round',shirt:'#c5a166',shirt2:'#745238',panel:'#eee0b7',trim:'#5b7256',stripe:'#9d7548',shorts:'#485543',shorts2:'#2a382a',hairC:'#45382c',hairHi:'#80694d',num:'',racket:'#e3b764',racket2:'#f5e7bd',sole:'#ab8050',swoosh:'233,184,102',identity:'fossil'}),
    miaomiao: L({name:'苗苗',hair:'ponytail',buff:true,shirt:'#277f7d',shirt2:'#13534f',panel:'#e9f3e8',trim:'#9cdec7',stripe:'#eaf2dd',shorts:'#1f4d4c',shorts2:'#123738',hairC:'#142f37',hairHi:'#33535b',num:'16',racket:'#75d7c5',racket2:'#f3f2d7',sole:'#c0e4ce',swoosh:'100,215,198',identity:'athlete'}),
    mage: L({name:'马哥',hair:'part',glasses:'rect',shirt:'#e1ddd1',shirt2:'#9c9b93',panel:'#faf3dd',trim:'#d68d52',stripe:'#ded7c7',shorts:'#353e4a',shorts2:'#202831',hairC:'#272a2d',hairHi:'#52575b',num:'',racket:'#dfae68',racket2:'#f7dfb4',sole:'#81979f',swoosh:'245,185,87',identity:'office'}),
    nan: L({name:'老南',hair:'gray',age:true,shirt:'#263e64',shirt2:'#12243e',panel:'#39587f',trim:'#c6d5df',stripe:'#718ea9',shorts:'#1c2c45',shorts2:'#0e1b2c',hairC:'#c2c8ce',hairHi:'#f3efdf',num:'',racket:'#a4c3da',racket2:'#e8e5cf',sole:'#91a7bd',swoosh:'155,184,229',identity:'contract'}),
    zhuzhu: L({name:'朱朱',hair:'long',tank:true,dress:true,stockings:'#34303c',lip:'#a83955',hairpin:true,shirt:'#28232f',shirt2:'#15131d',panel:'#38303e',trim:'#d4b27e',stripe:'#d4b27e',shorts:'#27212d',shorts2:'#17141f',sock:'#34303c',shoe:'#80364e',sole:'#bd7990',skin:'#f1c8b4',skin2:'#ce9d8c',hairC:'#171420',hairHi:'#55404c',num:'',racket:'#c4899a',racket2:'#e8c88d',wrist:'#25202e',swoosh:'221,179,190',identity:'calligraphy'}),
    sun: L({name:'孙大帅',hair:'crew',chubby:true,belly:1.03,tank:true,headband:true,shirt:'#de8543',shirt2:'#9c482c',panel:'#293e4e',trim:'#ffe0a5',stripe:'#ffe0a5',shorts:'#283e50',shorts2:'#192b3b',hairC:'#211c1b',hairHi:'#675047',band:'#f5dbb2',num:'23',racket:'#edac62',racket2:'#fff0cd',sole:'#e5a055',shoe:'#f3e4ca',wrist:'#f4d9b1',swoosh:'255,183,105',identity:'basketball'}),
    dong: L({name:'董总',hair:'receding',age:true,glasses:'rect',brow:true,shirt:'#173d43',shirt2:'#10272f',panel:'#234d51',trim:'#83dcc3',stripe:'#75b2b9',shorts:'#1b2b39',shorts2:'#111e2c',hairC:'#62656a',hairHi:'#afb1ad',num:'',racket:'#76d9bc',racket2:'#cbefdf',shoe:'#263b49',sole:'#8ed6c7',wrist:'#172b35',swoosh:'127,225,200',identity:'architect'}),


  };

  // ---------- 角色 ----------
  // fx：基础属性偏移；lock：解锁说明（故事关卡 id）
  const CHARS = [
    { id: 'lingfeng', look: 0, title: '追风少年', skill: 'yuyue', passive: 'yihan', acts: ['yuyue', 'tafeng', 'fengkou'], fx: {}, lock: '4-3',
      bio: '15 岁，周六课最小的学生。膝盖贴满创可贴，什么球都扑。南岸画像说他“低价值”，他却一次次从脚印上爬起来：扑空了，也算一步。' },
    { id: 'canglan', look: 1, title: '潮汐守望者', skill: 'chaolai', passive: 'dishui', acts: ['chaolai', 'tongyin', 'huichao'], fx: { regen: 0.08, stamCost: -0.05, control: 0.04, power: -0.03 }, lock: '4-2',
      bio: '22 岁，鹅湾渡口的撑船人，田楚当年的混双搭档。四年没问出口的告别，和一只密封保存的决赛旧球，被她一起带在身边。' },
    { id: 'xiaohong', look: 'xiaohong', title: '三十七页计划', skill: 'fanshe', passive: 'biaochi', acts: ['fanshe', 'zipao', 'pingyi'], fx: { power: 0.1, jump: 0.03, control: -0.05, stamCost: 0.04 }, lock: '2-3',
      bio: '18 岁，丁丁高中三年的同桌，理科第一。喜欢把角度都算好，也喜欢星星。37 页的计划书里，有一页始终不知道怎么写。' },
    { id: 'ranran', look: 'ranran', title: '甜心网前手', skill: 'tangqiu', passive: 'hudie', acts: ['tangqiu', 'hongxian', 'jiewang'], fx: { touch: 0.12, control: 0.05, power: -0.07, stamCost: 0.03 }, lock: '2-2',
      bio: '18 岁，在鹅湾夜市做蝴蝶结发饰。网前手感极好，说话直接，爱笑。她的球、她的去向和她喜欢的人，都要由她自己选择。' },
    { id: 'ruibao', look: 'ruibao', title: '移动城墙', skill: 'diban', passive: 'zheteng', acts: ['diban', 'huiguo', 'baozi'], fx: { reach: 0.08, defense: 0.1, move: -0.06, regen: 0.06 }, lock: '1-2',
      bio: '18 岁，王记包子铺的儿子，丁丁从小的兄弟。嗓门比蒸笼汽还响，最爱说“挺好的”。他心里的两面墙，藏着一张没交的志愿确认单。' },
    { id: 'xingxing', look: 'xingxing', title: '追光的星星', skill: 'yueliang', passive: 'yekong', acts: ['yueliang', 'xingmen', 'zhongli'], fx: { touch: 0.08, move: 0.05, accel: 0.04, power: -0.04 }, lock: '2-4',
      bio: '18 岁，天文爱好者，冉冉最好的朋友。考去了两千三百公里外的高原，怕让别人等。她的计划只有一行：如果下雨，就算了，直接说。' },
    { id: 'dingding', look: 'dingding', title: '听球机的制造者', skill: 'shensuo', passive: 'jixie', acts: ['shensuo', 'xuanpai', 'youyou'], fx: { move: 0.08, accel: 0.1, power: -0.08, handling: -0.05 }, lock: '0-4',
      bio: '18 岁，丁记穿线铺的儿子。四年没打球，却修好了和师兄小时候画过的听球机。他什么都想够到、修好，只差一句不再等以后的话。' },
    { id: 'houzi', look: 'houzi', title: '乐天猿人', skill: 'jindou', passive: 'liansha', acts: ['jindou', 'dangteng', 'haomao'], fx: { handling: -0.1, defense: 0.1, reach: 0.06, touch: 0.04, power: 0.04, move: -0.03, jump: -0.06, stamCost: 0.03 }, lock: '1-3',
      bio: '18 岁，丁丁的 Dota2 搭档。飞鹅网吧二楼的主播，常驻观众七个。口头禅“问题不大”，全剧最没有秘密的人，只是怕大家都走了。' },
    { id: 'lu', look: 'lu', title: '气氛担当', skill: 'fuzhi', passive: 'rizhi', acts: ['fuzhi', 'jieli', 'zangshu'], fx: { power: 0.06, reach: 0.06, regen: 0.04, move: -0.07, jump: -0.05 }, lock: '5-2',
      bio: '20 岁，南岸暑期实习生，鹅湾杯胜率模型的作者。格子衫、眼镜和冷笑话。预测被打破时，嘴上说不可能，心里却在笑。' },
    { id: 'laochen', look: 'laochen', title: '表格里的温度', skill: 'yati', passive: 'qiandao', acts: ['yati', 'yueqiu', 'shuangji'], fx: { move: 0.06, jump: 0.06, control: 0.08, stamCost: -0.06, power: -0.1, defense: -0.04 }, lock: '5-3',
      bio: '20 岁，南岸暑期实习生，负责给旧球贴标签、填签到表。看到十五岁的凌风被写成“低价值”，他决定不再只替别人记分。' },
    { id: 'guoge', look: 'guoge', title: '健身房投资人', skill: 'ganggan', passive: 'jihui', acts: ['ganggan', 'jiepan', 'qiquan'], fx: { power: 0.09, jump: 0.04, stamCost: 0.14, regen: -0.08, control: -0.08, move: -0.03 }, lock: '6-2',
      bio: '31 岁，“果然健身”老板，鹅湾杯本地赞助人。竞猜的单位是王记包子。哪边要赢就站哪边，直到这一次，押了小概率。' },
    { id: 'tianchu', look: 'tianchu', title: '镜花水月', skill: 'jingxiang', passive: 'canying', acts: ['jingxiang', 'meida', 'shuizhong'], fx: { power: 0.05, control: 0.05, jump: 0.06, touch: 0.04, stamCost: 0.05 }, lock: '9-5',
      bio: '22 岁，丁丁的师兄，南岸青训总监兼首席读羽师。替师弟扛了一次断线，恨了四年，也累了四年。他从不撒谎，只是不说全部。' },
    { id: 'zhu', look: 'zhu', title: '周六课的朱老师', skill: 'jiezou', passive: 'kandong', acts: ['jiezou', 'tingyixia', 'biaozhi'], fx: { control: 0.1, touch: 0.06, defense: 0.05, move: -0.08, jump: -0.08, regen: -0.04 }, lock: '3-2',
      bio: '60 岁，朱启明，教物理三十年，周六免费课也开了三十年。1996 年省赛冠军。擦网得分总举手道歉，唯独自己的最后一球，他一直没敢看。' },
    {"id": "bobo", "look": "bobo", "title": "古生物研究学者", "skill": "jibei", "passive": "shihua", "acts": ["jibei", "yimo", "weichui"], "lock": "1-4", "fx": {"jump": 0.04, "reach": 0.03, "move": -0.04}, "bio": "随身带着野外笔记与化石刷。他相信羽毛的故事远早于飞翔，用骨骼、翼膜和地层重新理解每一次起跳。"},
    {"id": "miaomiao", "look": "miaomiao", "title": "把稳练成自由", "skill": "dianbu", "passive": "dingzhou", "acts": ["dianbu", "bianpai", "jieli_jump"], "lock": "8-2", "fx": {"control": 0.06, "defense": 0.05, "power": 0.02, "move": -0.03}, "bio": "鹅场长大的南岸王牌。她把六年训练化成脚下的节奏，允许自己临场改主意，也愿意为一记新球冒险。"},
    {"id": "mage", "look": "mage", "title": "都市牛马", "skill": "tongqin", "passive": "gongxiu", "acts": ["tongqin", "gongwei", "jiaban"], "lock": "5-4", "fx": {"regen": 0.07, "accel": 0.05, "power": 0.02, "control": 0.03}, "bio": "挎着电脑包赶最后一班地铁的球友。白天处理工单，晚上处理来球。周报折成纸飞机，压力在拍上当场退回。"},
    {"id": "nan", "look": "nan", "title": "回羽剪辑师", "skill": "sanbu", "passive": "lvyue", "acts": ["sanbu", "yipai", "jingmo"], "lock": "11-1", "fx": {"control": 0.07, "touch": 0.04, "move": -0.05, "jump": -0.03}, "bio": "南振，南岸体育创始人。看过太多人的意图之后，他学着把慢镜、留影和快进交还给球场，让每个人亲手接住自己的下一拍。"},
    {id:'zhuzhu',look:'zhuzhu',title:'墨韵御姐',skill:'feibai',passive:'moyun',acts:['feibai','liubai','luokuan'],fx:{control:.09,touch:.08,power:-.06,move:.02},bio:'28 岁，艺术策展人与书法爱好者。黑色吊带短裙、黑丝与一枚金色发簪，气场从容而明艳。爱看展，也爱临帖；她说挥拍如运笔，留白要有分寸，落款要有态度。'},
    {id:'sun',look:'sun',title:'篮板节奏王',skill:'ouzhou',passive:'qiuyou',acts:['ouzhou','gongdan','kongjie'],fx:{reach:.07,power:.07,jump:.05,move:-.05,control:-.03},bio:'30 岁，笑起来很亲切的小胖子，篮球场上的灵活内线。深研 OA 流程引擎，从会签、回退到并发节点都讲得明白；和工程师一起排障、加班，也一起约球。把每一次配合都当作最顺畅的流程。'},
    {id:'dong',look:'dong',title:'球场架构师',skill:'lingxin',passive:'guance',acts:['lingxin','kuorong','rongzai'],fx:{defense:.10,control:.07,regen:.04,power:-.05,move:-.03},bio:'52 岁，资深系统架构师。头顶稀疏、两鬓花白，戴细框眼镜；在球场上总能把危机接成反击。让对手背上负载，再把高远球送进云雾，关键时刻按下熔断。'},
  ];
  const CHAR_BY = Object.create(null);
  for (const c of CHARS) CHAR_BY[c.id] = c;
  YY.CHARS = CHARS;
  YY.char = (id) => CHAR_BY[id] || (Object.prototype.hasOwnProperty.call(YY.STORY_NPCS || {}, id) ? YY.STORY_NPCS[id] : null) || CHARS[0];
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
    return c.portrait || (typeof c.look === 'number' ? YY.LOOKS[c.look] : NEW_LOOKS[c.look]);
  };
  YY.charName = (id) => YY.lookOf(id).name;
  YY.NARRATOR = { id: 'narrator', name: '旁白', color: '#e9ddbd' };

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
      { id: 'r_silk', name: '绣羽·细雨', style: '网前控制', spec: '均衡 · 反馈细腻 · 方圆拍框', fx: { touch: 0.10, control: 0.06, power: -0.08 }, lock: '2-2',
        trait: { k: 'needle', name: '细针落点', v: 0.2, desc: '在网前用甜区完成搓球或轻放时，落点随机误差额外减少 20%。' },
        cost: '力量 −8%：被压到底线后，需要更主动地寻找回位机会。', fits: ['ranran', 'xingxing', 'zhu'],
        desc: '珍珠白方圆拍框，淡粉色包边，两侧点缀细小花瓣纹。触球时溅起一点短促细碎的粉白光。' },
      { id: 'r_tide', name: '潮汐·长歌', style: '持续拉吊', spec: '均衡 · 击球稳定', fx: { defense: 0.08, control: 0.05, power: -0.07 }, lock: '1-5',
        trait: { k: 'tide', name: '长回合呼吸', v: 3, desc: '同一回合内，每完成 3 次亲手回球并成功过网，恢复 3 点体力；每回合最多恢复 9 点。' },
        cost: '爆发收益较低：力量 −7%。', fits: ['canglan', 'ruibao', 'zhu', 'guoge'],
        desc: '深海蓝拍框，内圈浅青色波纹，中杆由蓝渐变为银白。适合耐心调动、拉长回合。' },
      { id: 'r_prism', name: '棱镜·定点', style: '精准击球', spec: '微头重 · 中杆偏硬 · 六棱拍框', fx: { control: 0.08, power: 0.05, reach: -0.08 }, lock: '4-2',
        trait: { k: 'precise', name: '精确解', v: 0.25, desc: '同时满足甜区命中和最佳击球时机时，本拍落点随机误差额外减少 25%。' },
        cost: '甜区 −8%：被调动到极限位置时会放大失误风险。', fits: ['xiaohong', 'laochen', 'zhu'],
        desc: '石墨灰六棱切面拍框，荧光橙刻度分布在四角，白色中杆带细网格纹。准确命中时闪现一个极小的十字光点。' },
      { id: 'r_star', name: '星轨·变奏', style: '球路变化', spec: '均衡 · 中杆适中', fx: { control: 0.05, touch: 0.04, power: -0.05 }, lock: '9-1',
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
  const GEAR_BY = Object.create(null);
  for (const k in GEAR) for (const g of GEAR[k]) { g.cat = k; GEAR_BY[g.id] = g; }
  YY.gear = (id) => GEAR_BY[id];
  YY.GEAR_CATS = { racket: '球拍', string: '球线', tension: '磅数', shoe: '球鞋' };
  /** 每位角色的默认推荐组合（球拍 + 球鞋 + 打法）；玩家可以随时自由更换 */
  YY.GEAR_RECOMMEND = {
    zhuzhu: ['r_silk','sh_moon','回眸真假球，藏羽错节奏，险线争边角'],
    sun: ['r_heavy','sh_basic','欧洲步等压哨，篮板托球再进攻'],
    dong: ['r_shield','sh_run','过载消耗体能，迷雾藏高球，熔断接重球反压'],
    bobo: ['r_star','sh_cushion','高台建立高点阵地，猎航主动追球接骨尾俯冲'],
    miaomiao: ['r_prism','sh_stable','两段滑步积旋，燕尾急坠与漂长切换，转体衔接高点'],
    mage: ['r_shield','sh_stable','接球当拍借力，纸镖穿场，滑翔长短调动'],
    nan: ['r_silk','sh_moon','慢镜寻找新击球高度，复映球路后快进出手'],
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
  const KEY = 'yuyue.sixteen.profile';
  // v1 → v2：故事扩写后插入了新章节，旧关卡编号顺延
  const STAGE_V2 = { 2: 3, 3: 5, 4: 6, 5: 7 };
  YY.migrateStageId = (id) => id.replace(/^(\d+)-/, (m, c) => (STAGE_V2[c] || c) + '-');
  // Personal battle ledger: bounded history plus lifetime totals; travels with cloud saves.
  const count = n => Number.isSafeInteger(n) && n >= 0 ? Math.min(n, 999999999) : 0;
  const battleText = (s,n=40) => typeof s==='string'?s.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,n):'';
  const battleStamp = n => Number.isSafeInteger(n)&&n>0&&n<=8640000000000000?n:0;
  YY.battleTime = at => {
    if(!battleStamp(at))return '时间未记录';
    const d=new Date(at),z=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
  };
  YY.battleDuration = seconds => `${Math.floor(count(seconds)/60)}分${String(count(seconds)%60).padStart(2,'0')}秒`;
  YY.battleMode = r => ({matchmaking:'在线匹配',friend:'好友对战',ai:'AI 对战',local:'同屏对战'}[r.kind||r.mode]||'联机对战');
  // Capture the identities and lineup used in this game, independent of later menu choices.
  YY.battleRecord = (m,o={}) => {
    const me=o.me===1?1:0,peer=1-me,mode=o.mode||'ai',identity=o.identities?.[peer]||m.identities?.[peer];
    const charAt=i=>o.chars?.[i]||m.battleMeta?.chars?.[i]||YY.CHARS.find(c=>YY.lookOf(c.id).name===m.looks?.[i]?.name)?.id;
    const info=o.info||{},endedAt=info.endedAt||o.at||Date.now(),seconds=Number.isSafeInteger(info.seconds)?info.seconds:count(o.seconds);
    return {char:charAt(me)||o.char||YY.Profile.sel.char,opponent:identity?.nickname||o.opponent||m.names?.[peer]||'对手',opponentId:identity?.id||'',opponentChar:charAt(peer)||'',
      opponentAvatar:identity?.avatarUrl||'',mode,kind:info.kind||o.kind||mode,court:m.courtMode||'2d',won:m.winner===me,score:[m.score[me],m.score[peer]],at:endedAt,
      startedAt:info.startedAt||o.startedAt||endedAt-seconds*1000,endedAt,seconds,target:m.opt?.target||o.target,venue:info.venue||o.venue||'',level:m.battleMeta?.level||o.level||'',endReason:o.endReason||'',
      perfect:m.stats?.[me]?.perfect||0,hits:m.stats?.[me]?.hits||0,longest:m.longest||0};
  };
  function cleanBattles(raw) {
    const out={total:0,wins:0,seconds:0,characters:{},history:[]};
    for(const id of Object.keys(CHAR_BY)){const v=raw?.characters?.[id];if(v){const total=count(v.total);out.characters[id]={total,wins:Math.min(total,count(v.wins))};}}
    out.total=Object.values(out.characters).reduce((n,v)=>n+v.total,0);
    out.wins=Object.values(out.characters).reduce((n,v)=>n+v.wins,0);out.seconds=count(raw?.seconds);
    for(const r of (Array.isArray(raw?.history)?raw.history:[]).slice(0,80)){
      if(!r||!CHAR_BY[r.char]||!['ai','online','local'].includes(r.mode)||typeof r.won!=='boolean'||!Array.isArray(r.score)||r.score.length!==2||!r.score.every(n=>Number.isInteger(n)&&n>=0&&n<=999))continue;
      out.history.push({char:r.char,opponent:battleText(r.opponent)||'对手',opponentId:battleText(r.opponentId,48),opponentChar:CHAR_BY[r.opponentChar]?r.opponentChar:'',
        opponentAvatar:typeof r.opponentAvatar==='string'&&/^https:\/\/(?:[a-z0-9-]+\.)*(?:qlogo\.cn|qpic\.cn)\//i.test(r.opponentAvatar)?r.opponentAvatar.slice(0,256):'',
        mode:r.mode,kind:['matchmaking','friend','ai','local','online'].includes(r.kind)?r.kind:r.mode,court:r.court==='3d'?'3d':'2d',won:r.won,score:r.score.slice(),at:battleStamp(r.at),
        startedAt:battleStamp(r.startedAt),endedAt:battleStamp(r.endedAt)||battleStamp(r.at),seconds:count(r.seconds),target:[7,15,21].includes(r.target)?r.target:0,venue:YY.MATCH_VENUES.includes(r.venue)?r.venue:'',
        level:r.mode==='ai'&&['easy','normal','hard','nightmare'].includes(r.level)?r.level:'',endReason:battleText(r.endReason,64),perfect:count(r.perfect),hits:count(r.hits),longest:count(r.longest)});
    }return out;
  }
  const DEFAULT = () => ({
    v: 6,
    battles: cleanBattles(null),
    chars: ['dingding', 'zhuzhu', 'sun', 'dong'],
    gear: ['r_basic', 's_dur', 'sh_basic', 'sh_run'],
    cards: [],
    feats: [],
    stages: {},
    seen: {},
    campaign: { revision: 'sixteen-v3', choices: {}, clues: [], best: {}, checkpoint: null, difficulty: 'story', challengeStages: {}, challengeBest: {}, feathers: [], gallery: [], failures: {}, relay: [] },
    sel: { char: 'dingding', racket: 'r_light', string: 's_dur', tension: 24, shoe: 'sh_light' },
    kits: {},
    aiChallenges: YY.AIChallenge ? YY.AIChallenge.empty() : { wins: {}, unlocked: {}, equipped: null },
    loadouts: {}, // 每位角色单独的器械搭配；没有记录的角色使用推荐组合
  });
  const Profile = (YY.Profile = {
    d: null,
    load(source) {
      let d = source;
      if (!arguments.length) try { d = JSON.parse(YY.platform.getStorage(KEY)); } catch (_) {}
      const def = DEFAULT();
      if(d==null && !arguments.length){
        // Start the screenplay afresh while retaining independently earned battle records.
        let battle=null;try{battle=JSON.parse(YY.platform.getStorage('yuyue.profile'));}catch(_){}
        if(battle&&typeof battle==='object'&&!Array.isArray(battle))d={...def,loadouts:battle.loadouts,kits:battle.kits,aiChallenges:battle.aiChallenges};
      }
      if (!d || typeof d !== 'object' || Array.isArray(d)) d = def;
      const clean = { ...def };
      for (const key of ['chars', 'gear', 'cards', 'feats']) {
        const values = Array.isArray(d[key]) ? d[key].filter(v => typeof v === 'string') : [];
        clean[key] = [...new Set([...def[key], ...values])];
      }
      clean.chars = clean.chars.filter(id => CHAR_BY[id]);
      clean.gear = clean.gear.filter(id => GEAR_BY[id]);
      clean.stages = {};
      const legacy = !(d.v >= 6);
      for (const [id, stars] of Object.entries(d.stages && typeof d.stages === 'object' ? d.stages : {})) {
        if (/^\d+-\d+$/.test(id) && Number.isInteger(stars) && stars >= 1 && stars <= 3) clean.stages[id] = stars;
      }
      if(d.v>=6&&d.campaign?.revision==='sixteen-v3')for(const id of ['bobo','miaomiao','mage','nan']){const c=CHAR_BY[id];if(clean.stages[c.lock]&&!clean.chars.includes(id))clean.chars.push(id);}
      clean.seen = {};
      for (const [id, value] of Object.entries(d.seen && typeof d.seen === 'object' ? d.seen : {})) if (/^card:[\w-]+$/.test(id) && value) clean.seen[id] = true;
      clean.sel = { ...def.sel, ...(d.sel && typeof d.sel === 'object' ? d.sel : {}) };
      if (!CHAR_BY[clean.sel.char]) clean.sel.char = def.sel.char; // 自由训练保留全部合法角色，故事解锁记录独立
      // 器械可自由搭配（未解锁的也能选，故事模式里由 storyGear 换成入门款），这里只校验 id 与分类
      for (const key of ['racket', 'string', 'shoe']) if (GEAR_BY[clean.sel[key]]?.cat !== key) clean.sel[key] = def.sel[key];
      // v5：器械按角色分别保存。旧存档只有一套搭配：若玩家改过（不是入门款），就记到当时的出战角色上
      clean.loadouts = {};
      for (const [id, g] of Object.entries(d.loadouts && typeof d.loadouts === 'object' ? d.loadouts : {})) if (CHAR_BY[id]) clean.loadouts[id] = YY.cleanGear(g);
      if (!(d.v >= 5) && d.sel && typeof d.sel === 'object') {
        const old = YY.cleanGear(d.sel);
        if (old.racket !== 'r_basic' || old.shoe !== 'sh_basic' || old.string !== 's_dur' || old.tension !== 24) clean.loadouts[clean.sel.char] = old;
      }
      clean.battles = cleanBattles(d.battles);
      clean.kits = {};
      if (YY.AIChallenge) clean.aiChallenges = YY.AIChallenge.clean(d.aiChallenges);
      for (const [id, pick] of Object.entries(d.kits && typeof d.kits === 'object' ? d.kits : {})) if (CHAR_BY[id] && Array.isArray(pick)) clean.kits[id] = YY.skillSet(id, pick).act;
      clean.sel.tension = Number.isFinite(clean.sel.tension) ? Math.max(20, Math.min(30, Math.round(clean.sel.tension))) : 24;
      // v3 重写了剧本：旧版的环节进度与选择不再对应，保留通关星级、角色与装备
      const cp = d.v >= 6 && d.campaign?.revision === 'sixteen-v3' ? d.campaign : null;
      if (cp && typeof cp === 'object') {
        for (const key of ['feathers','gallery','relay']) clean.campaign[key] = [...new Set((Array.isArray(cp[key])?cp[key]:[]).filter(v=>typeof v==='string').slice(0,64))];
        for (const [id,n] of Object.entries(cp.failures||{})) if (/^\d+-\d+$/.test(id)&&Number.isInteger(n)&&n>=0) clean.campaign.failures[id]=Math.min(n,999);
        clean.campaign.ending=cp.ending===true;
        clean.campaign.difficulty = cp.difficulty === 'challenge' ? 'challenge' : 'story';
        for (const [id,n] of Object.entries(cp.challengeStages || {})) if (/^\d+-\d+$/.test(id) && Number.isInteger(n) && n>=1 && n<=3) clean.campaign.challengeStages[id]=n;
        for (const [id,n] of Object.entries(cp.challengeBest || {})) if (/^\d+-\d+:\d+$/.test(id) && Number.isInteger(n) && n>=1 && n<=3) clean.campaign.challengeBest[id]=n;
        for (const [key,value] of Object.entries(cp.choices || {})) if (/^[a-z]{1,24}$/.test(key) && !['constructor','prototype'].includes(key) && typeof value === 'string') clean.campaign.choices[key] = value.slice(0,120);
        clean.campaign.clues = [...new Set((Array.isArray(cp.clues)?cp.clues:[]).filter(v=>typeof v==='string' && /^[a-z-]{1,32}$/.test(v)))].slice(0,100);
        for (const [key,value] of Object.entries(cp.best || {})) if (/^\d+-\d+:\d+$/.test(key) && Number.isInteger(value) && value>=1 && value<=3) clean.campaign.best[key]=value;
        const c=cp.checkpoint;
        if(c && c.version===1 && /^\d+-\d+$/.test(c.stage) && Number.isInteger(c.index) && c.index>=0 && c.index<160) {
          clean.campaign.checkpoint={version:1,stage:c.stage,index:c.index,difficulty:c.difficulty==='challenge'||!(d.v>=6)?'challenge':'story',line:Number.isInteger(c.line)&&c.line>=0?c.line:0,
            stars:(Array.isArray(c.stars)?c.stars:[]).filter(n=>Number.isInteger(n)&&n>=1&&n<=3).slice(0,160),
            ctx:{lastWin:c.ctx?.lastWin,pickOk:c.ctx?.pickOk!==false,choices:{...clean.campaign.choices},env:c.ctx?.env && typeof c.ctx.env==='object'?{wind:Math.max(-3,Math.min(3,Number(c.ctx.env.wind)||0)),adapt:Math.max(0,Math.min(1,Number(c.ctx.env.adapt)||0))}:null},
            activity:{game:c.activity?.game&&typeof c.activity.game==='object'?c.activity.game:null,found:(Array.isArray(c.activity?.found)?c.activity.found:[]).filter(v=>typeof v==='string').slice(0,20)}};
        }
      }
      // 旧版已完成的是原强度：保留为挑战记录，同时不重锁任何解锁内容。
      if (!(d.v>=6)) {
        clean.campaign.challengeStages = {...clean.stages,...clean.campaign.challengeStages};
        clean.campaign.challengeBest = {...clean.campaign.best,...clean.campaign.challengeBest};
      }
      d = clean;
      this.d = d;
      Object.assign(d.sel, this.loadout(d.sel.char)); // sel 里的器械字段始终镜像出战角色的搭配（网页版界面直接读 sel）
      return d;
    },
    clean(source) { return this.load.call({ d: null, loadout: this.loadout }, source); },
    save() { try { YY.platform.setStorage(KEY, JSON.stringify(this.d)); } catch (_) {} this.onSave?.(this.d); },
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
    recordBattle(record) {
      if(!CHAR_BY[record.char])return;
      const b=this.d.battles||(this.d.battles=cleanBattles(null)),v=b.characters[record.char]||(b.characters[record.char]={total:0,wins:0});
      v.total++;if(record.won)v.wins++;b.total++;if(record.won)b.wins++;b.seconds+=count(record.seconds);
      b.history.unshift(record);b.history=b.history.slice(0,80);this.d.battles=cleanBattles(b);this.save();
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
    resetStory() { const challenges = this.d.aiChallenges, battles=this.d.battles; this.d = DEFAULT(); this.d.aiChallenges = challenges; this.d.battles=battles; this.save(); },
  });
  Profile.load();
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof window !== 'undefined' ? window : globalThis);
