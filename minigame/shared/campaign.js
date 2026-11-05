/* 星光回响 · 剧本与教学关卡（重写版）。原创剧情；知识出处见 STORY_EXPANSION.md。
 * 主线：停馆评估倒计时三十天 → 凑齐一支队伍 → 暴雨夜重演一九九六 → 星光杯 → 公开说明会 → 试运营 → 打完三十年前的那一分。
 * 对白行：说话人|表情|台词|动作。说话人 me=凌风，mm=毛毛，nar=旁白，其余为角色 id。
 */
(function (G) {
  'use strict';
  const YY = G.YY, C = YY.C;
  const D = (scene, text, extra = {}) => ({ t: 'dialog', scene, ...extra, lines: text.trim().split('\n').map(line => {
    const [who, mood, words, action] = line.trim().split('|'); return [who, words, mood || 'talk', action || null];
  }) });
  // 星级目标
  const G1 = (text, test) => ({ text, test });
  const NO_ERR = (n = 3) => G1(`失误不超过 ${n} 次`, r => r.st.errors <= n);
  const PERFECT = (n = 3) => G1(`完成 ${n} 次完美击球`, r => r.st.perfect >= n);
  const RALLY = n => G1(`打出一个 ${n} 拍以上的回合`, r => r.longest >= n);
  const SKILL = who => G1(`用出一次${who}的技能`, r => (r.x.skill || 0) >= 1);
  const drill = (name, judge, need = 4, total = 8, extra = {}) => ({ t: 'drill', def: { name, judge, goal: { need, total }, ...extra }, stars: [G1('留下两次以上余量', r => r.att <= total - 2), G1('一次不漏', r => r.att === need)] });
  const match = (opp, level = 'normal', extra = {}) => ({ t: 'match', opp, level, target: 5, cap: 7, stars: [NO_ERR(), PERFECT()], ...extra });
  const walk = (name, extra = {}) => ({ t: 'footwork', def: { name, need: 6, total: 10, life: 3, minLife: 2 }, stars: [G1('8 次以内完成', r => r.att <= 8), G1('连续完成不漏点', r => r.att === 6)], ...extra });
  const serve = name => ({ t: 'serve', def: { name, kind: 'sserve', zone: [C.SHORT_LINE, 2.85], need: 4, total: 8 }, stars: [G1('6 次以内完成', r => r.att <= 6), G1('四发全中', r => r.att === 4)] });
  const inspect = (scene, title, items) => ({ t: 'inspect', scene, title, items: items.map(([id, label, x, y, text, clue]) => ({ id, label, x, y, text, clue })) });
  const board = (title, cases) => ({ t: 'board', title, cases });
  const puzzle = (q, options, answer, explanation, picture, extra = {}) => ({ q, options, answer, explanation, picture, ...extra });
  const choice = (key, q, options) => ({ t: 'pick', key, q, o: options.map(([label, note, reply, extra], i) => ({ label, note, reply, ok: true, value: i, ...(extra || {}) })), exp: '这里没有标准答案。队友会记住你的回应。' });
  const lab = (experiment, title) => ({ t: 'lab', experiment, title });
  const combo = { t: 'combo', def: { name: '把三拍连成计划' } };
  const chapters = [
    ['ch0', '序章 · 缺角的合影', 'arena', '一张停馆通知，一只会说话的旧球，一串写着“林”的钥匙。三十天，从今天开始数。', 'storage'],
    ['ch1', '第一章 · 没说开的那一球', 'sunset', '小红手机里有个两年没人说话的群。四个老朋友之间，隔着一个没扑下去的网前球。', 'gameroom'],
    ['ch2', '第二章 · 十二盏路灯', 'sunset', '奶茶、弧线和路灯。星星在害怕什么？一张旧票根，把两段故事连在了一起。', 'nightroad'],
    ['ch3', '第三章 · 球拍不会替你回答', 'neon', '穿线铺的错单，健身房的徽章，还有一支三十年没人来取的蓝握把球拍。', 'shop'],
    ['ch4', '第四章 · 胜率之外', 'neon', '路先森算出百分之三，老陈删掉了一半数据。暂停的录像里，有人走向了球网。', 'lab'],
    ['ch5', '第五章 · 风雨停馆夜', 'arena', '停电、暴雨、一叠签名表。三十年前的那扇侧门，又一次被推开。', 'rainhall'],
    ['ch6', '第六章 · 云上的最后一课', 'sunset', '球馆停修，朱老师带队上山。会进攻的人，也要学会防守和休息。', 'mountain'],
    ['ch7', '第七章 · 不完美的冠军', 'arena', '星光杯开赛。寒星中学的王牌递来一盘录像：那一分，没有人输。', 'stadium'],
    ['ch8', '第八章 · 奖杯没有钥匙', 'arena', '冠军只换来一场说明会。安全、使用、运营——还有一个投机者的新方案。', 'hearing'],
    ['ch9', '第九章 · 把球传出去', 'sunset', '三天试运营。开黑群、健身房和广场舞队，被请进了同一座球馆。', 'community'],
    ['ch10', '第十章 · 另一边的球网', 'neon', '寒星中学的档案室里，藏着合影缺掉的那一角。', 'archive'],
    ['ch11', '终章 · 明天也开门', 'arena', '十四平，发球权在星光。三十年后，这一分终于要打完了。', 'dawnhall'],
  ].map(([id, title, venue, blurb, scene]) => ({ id, title, venue, blurb, scene, stages: [] }));
  const stages = [];
  function S(id, title, desc, knowledge, steps, rewards = {}) {
    const st = { id, title, desc, knowledge, kind: steps.find(s => s.t !== 'dialog')?.t || 'special', steps, rewards };
    stages.push(st); chapters[Number(id.split('-')[0])].stages.push(st); return st;
  }

  // ======================= 序章 · 缺角的合影 =======================
  S('0-1', '储物间里的声音', '学会接球，在柜子后面发现一张缺角的合影。', ['c_shuttle', 'c_court'], [
    D('storage', `nar||开学第一天。星光体育馆只剩一扇窗亮着，门上贴着“停馆评估倒计时：三十天”。|door
me|think|转学第一天，就被分来体育馆值日。行吧，反正我也待不了多久。
nar||扫把伸进柜底，一团白色的东西“哎哟”叫了一声。|rustle
mm|angry|轻点！我是羽毛球，不是灰团子！
me|surprise|……羽毛球会说话？
mm|talk|我叫毛毛。十六根羽毛，外加一点点不肯认输。我好像在这儿睡了很久，久到忘了自己是怎么落地的。
canglan|wave|新同学？别站着，帮我把场地清出来。灯管坏了三根，能用的场地只剩一块。
mm|point|先接几个球热热身。黄色圈是落点，青色是站位——别追着我的尾巴跑！`),
    drill('第一次接住来球', 'receive'),
    D('storage', `me|happy|原来不是等球掉到眼前才动。看见它飞起来，就该出发。
canglan|smile|提前准备。打球和修球馆，都一样。
mm|surprise|等等，柜子后面……那张合影怎么少了一角？|paper
canglan|sad|那张照片一直挂在这儿。缺的那一角，我从小就没见过。`, { art: 'hall' }),
  ], { cards: ['c_shuttle', 'c_court'] });

  S('0-2', '停馆通知上的两行字', '调查储物间，弄清评估看什么、谁想要这块地。', ['c_lines', 'c_equipment_check'], [
    D('storage', `me|think|照片里五个人，最右边只剩一只手，手里握着一支缠蓝色握把的球拍。
mm|sad|那场比赛我好像在场……可最后一球之后的事，我一点也想不起来。
canglan|point|先别猜。能确认的东西，一件一件记下来。`),
    inspect('storage', '储物间的第一次调查', [
      ['photo', '缺角合影', .20, .32, '照片背面写着：“一九九六 · 开放日，任何人都能来。”缺角处只剩一只握着蓝握把球拍的手。', 'photo'],
      ['notice', '停馆通知', .50, .30, '评估看三项：安全、使用、运营。附件是一份方案：把球馆改建成“铁力健身”连锁门店。', 'notice'],
      ['line', '地板白线', .79, .62, '边界线属于场地区域，球压在线上算界内。记录落点，看球托首先接触地面的地方。', 'line'],
    ]),
    D('storage', `me|surprise|改成健身房？那这块场地……
canglan|sad|评估组说，这里一个月没几个人来，地板老化，灯也坏。数字上，我们输得很难看。
me|think|那就让数字变一变。三十天，能做的事不少。
canglan|surprise|……你不是说待不了多久吗？
me|smile|待多久，和要不要把地扫干净，是两回事。
mm|cheer|说得好！先去找社长——他是全校最会算数的人。`),
  ], { cards: ['c_lines', 'c_equipment_check'] });

  S('0-3', '社长的入社考试', '与小红切磋，认识高远球和进攻时机。', ['c_clear', 'c_smash'], [
    D('gym', `xiaohong|point|你就是新来的？我是羽跃社社长小红。三十天的训练表，我已经算好了。
me|surprise|社里一共几个人？
xiaohong|think|算上你，两个。算上未来的队友……这个变量暂时为零。
canglan|smile|他连“未来的队友”的训练量都排好了。
xiaohong|fist|入社不考天赋，考判断。我的扣杀很快，但扣完回位会慢半拍——看你抓不抓得住。
mm|point|被压住时先打高远争取时间，机会不好，别硬扣。`),
    match('xiaohong', 'easy', { rule: '入社考试：他扣杀后回位慢，抓他身后的空当' }),
    D('gym', `xiaohong|happy|通过。你是羽跃社第……三号正式社员。
me|talk|我还以为必须一球不丢。
xiaohong|think|我的公式里本来没有误差项。可刚才输给你的那几分，好像就是误差。
canglan|wave|那就改公式。明天招新——会接球的人，也要学会接住队友。`),
  ], { chars: ['xiaohong'], gear: ['r_flex'] });

  S('0-4', '三十天的承诺', '决定招新海报上的第一句话，再跑一遍安全热身。', ['c_warmup', 'c_recovery'], [
    D('notice', `nar||公告栏上，招新海报和评估通知贴在一起，像两个互相瞪眼的人。|paper
xiaohong|point|标题我想好了：“冲击冠军，三十天逆袭”。
canglan|talk|也许有人只是想找个地方，安心打一场球。
me|think|那就把承诺写具体一点。写一句我们真的做得到的。`, { cast: ['xiaohong', 'canglan'] }),
    choice('promise', '你想把哪句话写在海报最上面？', [
      ['一起认真变强', '小红在这句话下面画了两道线。', '训练要有计划，也要允许失误。'],
      ['每个人都有位置', '沧澜默默多搬来两把椅子。', '先让大家愿意留下，再谈成绩。'],
    ]),
    walk('招新前的热身路线'),
    D('notice', `mm|happy|“{promise}”——记住了，这句可要算数。
canglan|point|热身先活动身体，再练短距离启动。落地稳住，别把热身打成比赛。
xiaohong|think|热身时间我得重算。原来五分钟，现在改成十五。
me|wave|海报贴好了。明天，会有人推开门吧。|door`),
  ], { cards: ['c_warmup', 'c_recovery'] });

  S('0-5', '关灯的人', '陪沧澜发完关灯前的最后十个球。', ['c_serve', 'c_safety'], [
    D('gymnight', `nar||晚上九点，其他人都走了。沧澜还在一盏一盏地检查灯管。|switch
me|talk|你每天都最后一个走？
canglan|smile|习惯了。外婆以前是这里的管理员。她说：灯要有人开，也要有人关。
me|think|门卫室那串写着“林”的钥匙……是她的？
canglan|sad|她去年走了。钥匙留给了我，还有一句话：“门别关。”
mm|sad|林……这个字，我好像听过很多次。
canglan|point|别想太多。来，关灯前陪我发几个球。发球是每一分的开始，也是我每天的收尾。`),
    serve('关灯前的十个发球'),
    D('gymnight', `canglan|happy|今天第一次，有人陪我发完最后一个球。
me|smile|明天也可以有。
canglan|think|……那这把钥匙，我得考虑多配一把了。|switch
nar||灯熄了。黑暗里，毛毛小声说：“三十天，从今天开始数。”`),
  ], { cards: ['c_serve', 'c_safety'] });

  // ======================= 第一章 · 没说开的那一球 =======================
  S('1-1', '天台上的旧群聊', '把球送深，也翻出一个两年没人说话的群。', ['c_base', 'c_rules'], [
    D('rooftop', `xiaohong|sad|海报贴了一天：七个赞，零个报名。
me|think|有没有可能，是因为你把训练时间写成了早上五点？
xiaohong|surprise|……那是科学安排。
canglan|talk|你手机里不是还有个群吗？初中校队那个。
xiaohong|sad|“羽毛球天下第一”。最后一条消息，停在两年前。
me|talk|群里都有谁？
xiaohong|think|王瑞、丁丁、猴子，还有我。我们四个从初一打到初三。后来……就不打了。
mm|point|先把这球送到后场。回得深，你才有时间想下一句该怎么说。`),
    drill('把球送深，给自己留时间', 'clear'),
    D('rooftop', `me|happy|这一拍飞得久，我就来得及回到准备位置了。
xiaohong|think|准备位置也不是钉死的，要看自己的回球再决定站哪。……人也一样。
canglan|smile|那就先去找最好找的那个。
xiaohong|talk|王瑞。午饭时间，他一定在食堂第三个窗口。`),
  ], { cards: ['c_base'] });

  S('1-2', '包子保卫战', '跟上王瑞的步子，再用调动打开这堵“墙”。', ['c_footwork', 'c_defense'], [
    D('canteen', `ruibao|surprise|小红？你居然主动来食堂找我。先说好，这个包子我不分。
xiaohong|shy|……不是来抢包子的。社团缺人，我想问你回不回来。
ruibao|think|回来干嘛？继续站在后场当墙？初中三年，你们只让我“负责挡着”。
me|talk|那这次不当墙，换个打法？
ruibao|fist|口说无凭。你们要是能把我调动起来，我就考虑。
canglan|point|墙也会前后移动。先跟着他的步子走一遍。`),
    walk('王瑞的前后移动'),
    match('ruibao', 'easy', { stars: [G1('用吊球得分 1 次', r => r.x.dropWin >= 1), NO_ERR()], rule: '别跟他比耐心：前后调动，用吊球打开空当' }),
    D('canteen', `ruibao|tired|呼……你一直前后调我，我差点把早饭跑出来。
me|smile|你刚才那拍反抽，可一点也不像墙。
ruibao|happy|因为你把球送到了我够得着、也想打的地方。
xiaohong|sad|初中的时候，我只会喊“挡住就行”。对不起。
ruibao|smile|道歉收下，包子还是不分。……猴子那边，你去说还是我去说？
xiaohong|think|他最难。他已经两年没碰过拍子了。`),
  ], { chars: ['ruibao'], gear: ['sh_cushion'] });

  S('1-3', '开黑中，勿扰', '用打游戏的思路回答羽毛球问题，敲开猴子的门。', ['c_read', 'c_observation'], [
    D('gameroom', `nar||放学后，王瑞领着大家拐进一栋旧楼。门上贴着纸条：“开黑中，勿扰。”|door
houzi|cheer|推！推！高地就差一口气——哎？小红？瑞宝？今天刮的什么风？
me|surprise|……他就是猴子？
ruibao|smile|别看他脸小，肚子可是战略储备。初中外号“北京猿人”，后来简称猴子。
houzi|happy|问题不大，这叫返祖式帅气。新同学你好，我玩中单也玩辅助，主要玩心态。
dingding|angry|猴子！你又挂机！高地就剩我一个人守了！
xiaohong|surprise|丁丁也在？
dingding|point|店里网断了，来借网。……顺便赢一把 Dota。
xiaohong|talk|猴子，社团缺人。回来打球吧。
houzi|smile|打球啊……随缘吧。游戏输了能重开，球场上输了，可没有重开键。
mm|think|他笑得很轻松，可握手机的手指，一直按着同一个键。
houzi|point|这样，你们答我三个问题。用打游戏的思路讲羽毛球，讲通了，我陪你们打一局。`),
    board('猴子的开黑式问答', [
      puzzle('“视野”很重要。对手退在后场时，你最该“看”哪里？', ['对手身后的底线', '对手面前空出来的网前', '自己的球拍'], 1, '先看空当。对手退后，前场就是他的“视野盲区”。', 'opponent-back'),
      puzzle('“残血别硬打”。你被压在后场、击球点很低，怎么办？', ['硬扣一拍赌一把', '挑高挑深，先回到准备位置', '直接放弃这一分'], 1, '被动时先求稳，用高球换时间，等血量回来再打团。', 'player-low'),
      puzzle('对手连续两次吊网前之后，开始提前上网“蹲”你。', ['继续吊网前', '改打后场，打他身后', '站着不动'], 1, '套路被看穿就换方向。重复，是最容易被抓的。', 'opponent-front'),
    ]),
    D('gameroom', `houzi|surprise|……全对？行啊新同学，你这意识，能上分。
dingding|think|他刚才说“重复最容易被抓”。猴子，你初三那球就是——
houzi|smile|丁丁，问题不大。都过去了。走，打一局就打一局。
ruibao|sad|他每次说“问题不大”，问题都挺大的。`),
  ]);

  S('1-4', '问题不大', '和久未摸拍的猴子打一局，听他说出初三那一球。', ['c_netkill', 'c_focus'], [
    D('gym', `houzi|wave|先说好，我两年没摸拍子了，输了不许截图。
xiaohong|think|他守在中场，手比谁都快。前后跑动是他的短板。
mm|point|多打深远的高球，逼他动起来。别跟他拼手速。`, { cast: ['ruibao', 'dingding'] }),
    match('houzi', 'normal', { stars: [RALLY(8), NO_ERR()], rule: '多打深远高球，逼他挪动起来' }),
    D('gym', `houzi|tired|呼……不行了，肚子在抗议。
me|talk|最后那个网前球，你明明能扑，为什么收手了？
houzi|sad|……初三县赛，决胜局，十四平。我也站在网前，球就飘在眼前。
houzi|sad|我想“这球必须扑死”，手一抖，下网了。那年之后，我们四个就没再一起打过。
xiaohong|sad|那球之前，我冲他喊的就是“必须赢”。是我把这三个字塞进了他手里。
ruibao|talk|我们谁都没怪过你，猴子。只是……谁都没说出口。
dingding|sad|你后来天天拉我开黑，我还以为你早就不在乎了。`),
    choice('houzi', '你想对猴子说什么？', [
      ['这次别一个人扛着', '猴子愣了一下，把手机揣回了兜里。', '这次别一个人扛着。'],
      ['下一球，扑不扑都行', '猴子笑出了声，眼眶却有点红。', '下一球，扑不扑都行。'],
    ]),
    D('gym', `me|smile|{houzi}
houzi|happy|……行。你们这社团，我入了。不过先说好，每周得留一晚开黑。
dingding|point|那开黑也得留一晚打球。我还没答应入社呢，先说清楚。
houzi|cheer|成交！羽毛球天下第一，复活！
mm|happy|一个沉了两年的群，重新亮了。|cheer`),
  ], { chars: ['houzi'] });

  S('1-5', '借你一次闪现', '操控猴子打招新表演赛，再判一判最后那个压线球。', ['c_let', 'c_fairplay'], [
    D('gym', `nar||周五，招新表演赛。看台上坐了十几个人——比平时多了十几个。|cheer
houzi|fist|新同学，借你的手用用。我教你一招：闪现。
me|surprise|这也是游戏里学来的？
houzi|smile|打球学来的。我不爱跑，就练怎么一步到位。技能条满了按一下，球飞到哪，我就在哪。
mm|point|闪现只帮你站到位置上，挥拍时机还得自己来。`),
    match('xiaohong', 'normal', { as: 'houzi', target: 5, cap: 7, stars: [SKILL('猴子'), NO_ERR()], rule: '能量够 35 就放闪现：先到位，再挥拍' }),
    D('gym', `nar||最后一球落在白线附近。看台上，两边同时喊了出来。|cheer
xiaohong|angry|出界！我看得很清楚！
ruibao|think|你站在另一头，真的看清了？
me|point|先把规则说清，再回到那一帧。`),
    board('小小司线员', [
      puzzle('球托首次接触点压住了单打边线。怎么判？', ['界内', '出界', '一律重发'], 0, '线属于界内。判断球托首次落地的位置，而不是羽毛裙。', 'line-in'),
      puzzle('球完整落在单打边线外、双打边线内。这是单打回合。', ['界内', '出界', '看谁领先'], 1, '单打回合使用内侧边线，双打使用外侧边线。', 'singles-out'),
      puzzle('隔壁场地的球滚进正在比赛的场地，影响了安全。', ['继续抢救', '示意裁判暂停处理', '踢开继续打'], 1, '先停止有危险的回合，由裁判处理干扰与重发，不冒险踩球。', 'let'),
    ]),
    D('gym', `xiaohong|sad|是我急了。那球压线，算猴子的。
houzi|happy|社长认错了！截图！
xiaohong|shy|……删掉。
mm|point|合影背面还有一行小字：“最难的不是赢一分，是把该给的那一分还回去。”
nar||当晚，报名表上多了两个名字：冉冉、星星。|paper`),
  ], { cards: ['c_let', 'c_fairplay', 'c_lines'] });

  // ======================= 第二章 · 十二盏路灯 =======================
  S('2-1', '草莓奶茶与网前球', '用轻吊了解冉冉，赢下她的入社条件。', ['c_drop', 'c_netplay'], [
    D('cafe', `ranran|shy|我只是陪星星来看看。跑那么远，奶茶会化的。
xingxing|smile|上次在公园，你轻轻一碰，就让我跑了一下午。
ranran|think|因为我打不远，只好想办法让别人也别站太远。
houzi|happy|这叫控线。高端操作。
mm|point|这就是网前控制的起点。轻，不等于随便；落点和过网高度都要讲究。`),
    drill('轻轻放，不送高', 'drop', 3, 7),
    match('ranran', 'easy', { rule: '她守在前场：深高远压后场，再突然吊网前' }),
    D('cafe', `ranran|surprise|你居然没有一直扣杀。
me|smile|因为你一直在等我送机会。
ranran|happy|那我加入。条件是：训练表里必须有休息。
xiaohong|think|……可以。休息也算训练变量。
ranran|smile|还有，奶茶不准带进场地。这条是我自己定的。`),
  ], { chars: ['ranran'], gear: ['r_silk'] });

  S('2-2', '黑板上的弧线', '亲手对比三条飞行轨迹，找出高远球的价值。', ['c_physics', 'c_contact'], [
    D('classroom', `xiaohong|point|我画了三条轨迹。最快的一条，不一定最好。
xingxing|think|最高的那条，能让人喘口气，还能看清下一步。
me|smile|黑板上终于不只写着第一名了。
mm|talk|同一个出球点，改角度和速度，看看落点和飞行时间怎么变。`),
    lab('arc', '三条弧线的实验'),
    D('classroom', `xiaohong|think|我以前只看球有多快，漏掉了时间也是资源。
xingxing|shy|那你以后走路，也可以慢一点吗？每次都把我甩在后面。
xiaohong|surprise|……我走得很快吗？
ranran|smile|快。快得像在躲什么。
nar||小红在训练本上写下“给队友留时间”，然后把本子合上了。|paper`),
  ], { cards: ['c_contact'] });

  S('2-3', '十二盏路灯', '在夜路上听星星说出紧张的原因，再陪她打一局。', ['c_mental', 'c_feedback'], [
    D('nightroad', `xingxing|sad|每次大家说“这球一定能赢”，我就更怕打丢。
me|talk|那就不说“一定”。只说下一球想怎么打。
xingxing|think|我想先把你调到网前，再看你留出哪里。
mm|smile|目标从“不能输”变成“做好下一拍”，手就没那么僵了。`),
    match('xingxing', 'normal', { stars: [NO_ERR(), G1('不靠扣杀也得 2 分', r => r.st.winners - r.st.smashWin >= 2)], rule: '她吊完会跟上网前：等她前压，再推到后场' }),
    D('nightroad', `xingxing|happy|我还是紧张。但今天，我没有一直盯着比分。
xiaohong|shy|从这里走到你家，一共十二盏路灯。我数过。
xingxing|smile|那以后每盏灯下面，说一个跟胜率无关的话题。
me|think|……我是不是该先走？
houzi|cheer|一起走！我负责数路灯，凌风负责假装没听见。
mm|happy|十二盏灯，今晚都亮着。`),
  ], { cards: ['c_mental', 'c_feedback'] });

  S('2-4', '旧票根', '练网前的耐心，从旧训练本里翻出一九九六年的票根。', ['c_patience', 'c_netkill'], [
    D('gymnight', `xingxing|think|我总想把每个网前球都打死。
ranran|point|先看高度。球低的时候硬往下压，球网会比对手先赢。
houzi|sad|……这句我熟。
ranran|smile|所以低球先搓，高球再扑。等一下，也是主动的选择。`),
    drill('网前的耐心', 'net'),
    D('gymnight', `xingxing|happy|这次我等到了高球！
houzi|smile|我也等到了。晚了两年，问题不大。
nar||星星从旧训练本里抽出一张观众票。日期，和那张缺角合影是同一天。|paper
xingxing|surprise|一九九六年，星光杯决赛。票根背面写着：“比赛暂停，请大家去侧门帮忙。”
mm|surprise|侧门……那一晚，我好像听见了很多很多脚步声。|steps
canglan|think|外婆说过，那年夏天，有一场特别大的雨。`),
  ], { chars: ['xingxing'] });

  S('2-5', '训练本的另一页', '选一句赛前提醒，把三拍连成一个计划。', ['c_combo', 'c_communication'], [
    D('gymnight', `xiaohong|sad|明明知道该怎么打，一紧张，我就想一拍结束。
xingxing|talk|因为你不相信，打不死的球，我们也接得住。
me|think|下周有练习赛。这次赛前，我想换一句提醒。`),
    choice('encourage', '队友连丢两分，你准备说什么？', [
      ['先打深，我们有时间', '大家把注意力放回了下一拍。', '先打深，我们有时间。'],
      ['我在这儿，按计划来', '队友的肩膀放松了一点。', '我在这儿，按计划来。'],
    ]),
    combo,
    D('gymnight', `xiaohong|smile|“{encourage}”……这句比“必须赢”管用。
xingxing|happy|原来战术也可以是一种安慰。
houzi|point|高远压后场，吊球调网前，抓机会进攻。跟推塔一个道理：先拉扯，再收割。
mm|point|可别把三拍背成固定答案。对手一换站位，计划也得换。
canglan|smile|社里有六个人了。今天，灯是大家一起关的。|switch`),
  ], { cards: ['c_combo', 'c_communication'] });

  // ======================= 第三章 · 球拍不会替你回答 =======================
  S('3-1', '穿线铺的错单', '调查球拍与订单，也认识一位只想“收割”的顾客。', ['c_racket', 'c_equipment_check'], [
    D('shop', `dingding|angry|两张单子贴反了！进攻拍给了刚入门的人，轻头拍被投诉“杀不动”。|paper
houzi|smile|丁丁家的店，日常翻车。
dingding|point|闭嘴，猴子。投诉“杀不动”的那位，马上就到。
guoge|talk|老板，我那支最贵的拍子呢？我要拍健身房自拍，配色得跟我的毛巾一样。
me|surprise|……买球拍，是为了自拍？
guoge|smile|分散投资嘛。拍子好看是一份收益，能不能打球是另一份。
mm|talk|先调查三件东西。别让标签替你做决定。`),
    inspect('shop', '错单调查', [
      ['balance', '球拍平衡', .23, .38, '头重、头轻会影响挥动感觉，但不能只凭一个标签判断。还要结合重量、硬度和个人体验。', 'order'],
      ['frame', '拍框检查', .52, .40, '先检查拍框、拍杆和握把是否异常。裂纹或松动，不能靠提高磅数解决。', 'frame'],
      ['receipt', '顾客留言', .78, .37, '一位常常被动接杀；另一位写着：“想一拍杀死人，但不想跑。”同样的装备，解决不了不同的问题。', 'receipt'],
    ]),
    D('shop', `dingding|happy|终于有人先问“你怎么打”，而不是“哪支最贵”。
guoge|think|“不想跑”是我写的，有什么问题？省下的体力，能多练两组卧推。
dingding|point|问题是，球不会自己飞到你面前。
guoge|smile|那就让别人跑。我只负责最后那一下——收益最高的那一下。
ruibao|sad|……这种队友，我初中见过不少。`),
  ], { gear: ['r_heavy', 'r_light'] });

  S('3-2', '闪电松鼠', '跟上丁丁的快节奏，用深球让他停下来。', ['c_shoes', 'c_footwork'], [
    D('shop', `dingding|fist|装备聊完了。来，看看你是不是只会在菜单里变强。
me|surprise|你走路都这么快吗？
houzi|happy|他打 Dota 也这样，开局三分钟就想推高地。
dingding|angry|那叫节奏！……我常提前上网。你要是能把球送深，就能让我跑回去。
canglan|point|看他的站位，别让他的速度替你决定球路。`),
    match('dingding', 'normal', { stars: [G1('用高远或吊球得 2 分', r => r.x.clearWin + r.x.dropWin >= 2), NO_ERR()], rule: '他偏爱抢网：高远拉长节奏，等他提前前压' }),
    D('shop', `dingding|tired|……又跑过头了。每次都是我先冲出去。
me|happy|那就一起练怎么停下来。
dingding|sad|初三那年我也是这样，总想一个人把局面扳回来。猴子在网前发呆的时候，我在后场喊得最凶。
houzi|smile|别说了，都过去了。你回来就行。
dingding|wave|行，我入社。店后面的小仓库，借给社团放器材。
mm|surprise|仓库里……好像有个蓝色的握把。|rustle`),
  ], { chars: ['dingding'], gear: ['s_crisp'] });

  S('3-3', '磅数不是等级', '比较三种设定，理解球线与手感的取舍。', ['c_tension', 'c_string'], [
    D('shop', `guoge|point|丁丁，给我穿三十磅。职业选手都穿这么高，越高越厉害。
dingding|talk|磅数不是等级。拍框有允许范围，力量和击球习惯也得看。
guoge|smile|我力量够啊，卧推一百公斤。
dingding|think|卧推和挥拍是两回事。你试试就知道了。
mm|smile|今天借游戏里的三种设定做个实验。数值是简化模型，不是现实穿线处方。`),
    lab('tension', '试拍，不猜等级'),
    D('shop', `guoge|surprise|……最宽容的那个，反而打得最稳？
dingding|happy|对你现在来说是。等你稳定了，再慢慢调。
guoge|think|有意思。投入最少，回报最稳——这个思路我喜欢。
me|smile|你看什么都像在算投资回报。
guoge|smile|人生就是投资。对了，听说你们要打星光杯？冠军奖品是什么？`),
  ], { feats: ['tension'], gear: ['s_ctrl'] });

  S('3-4', '蓝色握把', '在丁丁家的仓库里，找到三十年没人来取的那支拍子。', ['c_maintenance', 'c_history'], [
    D('archive', `dingding|think|这些都是我爸留下的。他说有一支拍子，三十年都没人来取。
canglan|surprise|……握把底下，刻着一个“林”字。
mm|surprise|就是照片里那只手握着的拍子！`),
    inspect('archive', '旧仓库的记忆', [
      ['grip', '磨平的握把', .20, .47, '握把磨得发亮，和那串钥匙一样旧。握把要保持干燥，磨损了就更换，不必等到完全打滑。', 'blue-grip'],
      ['tag', '取件单', .51, .36, '一九九六年七月的取件单：“林，换握把。比赛打完来取。”取件人一栏，空着。', 'pickup'],
      ['tube', '球筒记录', .78, .35, '球筒上记着温度和试球结果。环境会改变飞行，正式训练前先试球。', 'tube'],
    ]),
    D('archive', `canglan|sad|“比赛打完来取”……外婆一直没来取。是因为那场比赛，一直没有打完吗？
dingding|sad|我爸说，有位奶奶每年夏天都会来店门口站一会儿，又走了。
me|think|照片里被撕掉的，也许不是输球的人。
canglan|think|是外婆自己撕的。她从来不肯拍照，我一直以为她是害羞。
mm|talk|还差一块拼图。要是有那场比赛的录像就好了。
dingding|point|录像？电脑社的路先森，号称什么都能修。`),
  ], { cards: ['c_maintenance', 'c_history'] });

  S('3-5', '健身房的徽章', '在健身房和果哥打一局：他的扣杀很重，体能却很短。', ['c_fatigue', 'c_record'], [
    D('fitness', `nar||第二天，凌风被果哥拉进了一家二十四小时亮灯的健身房。|door
guoge|happy|欢迎来到我的第二个家。看见那面镜子没？我和它每天见两次面。
me|think|你找我来，是想……入社？
guoge|smile|星光杯冠军奖一支限定拍，还上市报。冠军合影，比健身照涨粉多了。
me|talk|那训练呢？值日呢？
guoge|smile|值日这种低回报的事，不在我的投资组合里。我负责关键时刻的那一下。
nar||果哥胸前别着一枚徽章：“铁力健身 · 体验官”。|paper
me|surprise|铁力健身……不就是要改建球馆的那家？
guoge|think|巧合，纯属巧合。来，打一局，看看你们这支股值不值得投。`),
    match('guoge', 'normal', { stars: [RALLY(10), NO_ERR()], rule: '他平时省力、见机重扣：多拉长回合，耗他的体能' }),
    D('fitness', `guoge|tired|……停，停一下。超过三个回合，不在我的训练计划里。
me|smile|你的扣杀是真的重。可惜只有一下。
guoge|smile|一下就够了，抓住机会的那一下。行吧，你们这支股，我先少量建仓。
houzi|think|他胸口那个徽章……我总觉得哪里不对劲。
dingding|point|先让他交值日表。看他是投资，还是投机。`),
  ], { cards: ['c_fatigue', 'c_record'] });

  // ======================= 第四章 · 胜率之外 =======================
  S('4-1', '百分之三', '读老陈整理的数据表：数字能说明什么，又说明不了什么。', ['c_data', 'c_read'], [
    D('lab', `lu|happy|欢迎来到胜率实验室！本程序预测：你们保住球馆的概率是——百分之三。|keyboard
me|think|这么精确？
lu|point|根据过去一个月的使用记录：每周平均来四个人，其中三个是来找厕所的。
laochen|wave|别听他吓人，数据还没清洗，里面一半是重复签到。你们好，我是老陈。
houzi|surprise|老陈？看着比我还年轻啊。
laochen|smile|是他非要这么叫。我们初一就是同桌，叫着叫着就老了。
lu|happy|我们关系好到上厕所都一起去。这叫高可用双机热备。
laochen|shy|……这个可以不用介绍。来，先看三张表，再谈预测。`),
    board('老陈的三张表', [
      puzzle('这是小红最近 20 拍的球路。对手最可能提前防哪一种？', ['高远', '吊球', '杀球'], 2, '杀球占了一大半。习惯越明显，越容易被对手预判。', 'chart:小红 · 最近 20 拍|高远=5,吊球=3,杀球=12'),
      puzzle('冉冉的失分里，哪一类最多？下周训练先练什么？', ['网前下网', '后场出界', '发球失误'], 1, '先练最常见的问题。数据告诉你从哪里开始，但不会告诉你全部原因。', 'chart:冉冉 · 失分原因|下网=2,出界=7,发球=1'),
      puzzle('签到表显示周三人最多。可原始记录里，同一个人签了三次名。怎么处理？', ['照抄总数，越多越好', '去掉重复，再看真实人数', '干脆删掉周三'], 1, '先清洗数据，再下结论。夸大的数字，经不起检查。', 'chart:签到人次（未清洗）|周一=4,周三=15,周五=6'),
    ]),
    D('lab', `lu|surprise|等一下，删掉重复签到，我们的使用率又降了！
laochen|smile|降了，但是真的。拿假数据去评估会，会被一眼看穿。
me|talk|那就让真实的数字涨起来。
lu|think|……行，我改模型。对了，你们说的那盘旧录像，拿来我看看。`),
  ], { cards: ['c_data'] });

  S('4-2', '笑声打乱节奏', '路先森开局就攒满了冷笑话：别笑，专注下一拍。', ['c_focus', 'c_mental'], [
    D('lab', `lu|fist|修录像之前，先打一局。我的模型需要实测数据。
laochen|wave|我在场边记。别紧张，他讲冷笑话的时候，你别笑就行。
lu|happy|我已经提前攒好了三个。开局就讲。
mm|point|笑声会打乱节奏。专注下一拍：站位、来球、体力，一样一样确认。`),
    match('lu', 'normal', { oppEnergy: 100, rule: '他开局就能讲冷笑话：被逗乐时少跑动，先求稳' }),
    D('lab', `lu|happy|实测完毕：你的模型需要加一个新变量——“不笑”。
laochen|smile|补充一条：他输球的时候，冷笑话讲得最多。这个我有统计。
lu|shy|……老陈，这种数据不要公开。
me|smile|入社吗？我们缺一个能修录像的人。
lu|happy|入！不过有个条件：老陈得一起来。
laochen|talk|我就不打了，在旁边记数据就好。我这身板，风一吹就倒。`),
  ], { chars: ['lu'] });

  S('4-3', '风一吹就到', '操控老陈，完成他人生第一次上场的步法练习。', ['c_splitstep', 'c_recovery'], [
    D('gymnight', `lu|tired|我能算出落点，但我的腿不同意。
laochen|smile|你那是腿吗？那是两个待优化的进程。
ranran|point|老陈，光说别人。你也上来试试？
laochen|surprise|我？我就是个记数据的……
canglan|point|启动不是盲目跳高。身体轻轻准备，看清来球，再迈第一步。
mm|cheer|这次，你来带老陈走一遍！`),
    walk('老陈的第一次上场', { as: 'laochen' }),
    D('gymnight', `laochen|surprise|……我跑得还挺快？
houzi|cheer|废话！你那么轻，风一吹就到网前了！
laochen|happy|原来“风一吹就倒”，也可以是“风一吹就到”。
lu|think|老陈，你一顿吃四碗饭的能量，原来全存在腿里了。
xiaohong|point|数据员兼替补。训练表上加一行。`),
  ], { cards: ['c_splitstep'] });

  S('4-4', '暂停的一秒', '观察修复后的录像，看清一九九六年那一夜。', ['c_observation', 'c_fairplay'], [
    D('archive', `lu|point|录像修好了七成。最后一段不是坏了——是有人按了暂停。|keyboard
laochen|think|时间戳是晚上九点零三分。同一分钟的气象记录写着：暴雨，积水。`),
    inspect('archive', '录像里的三处细节', [
      ['score', '记分牌', .22, .30, '十四平，发球权在星光一方。比分停在这里，没有胜者。', 'score-fourteen'],
      ['keeper', '走进场地的人', .52, .42, '一位戴袖章的女士走到网前，举手示意暂停。她手里拿着一串钥匙。', 'keeper'],
      ['door', '打开的侧门', .80, .36, '侧门大开，门外站着撑伞的人群。比分是观察，原因要靠证据解释。', 'side-door'],
    ]),
    D('archive', `canglan|surprise|是外婆。是她让比赛停下的。
lu|think|当年有人说，是星光这边怕输，才借着下雨叫停。
laochen|talk|可暂停的时候，星光有发球权，比分也不落后。“怕输”这个解释，数据上站不住。
me|think|那她为什么叫停？侧门外的那些人，又是谁？
mm|sad|我想起来一点点……那天我在空中，很多人抬头看着我。然后，所有人都转身走向了门口。
xiaohong|point|画面里那个年轻的星光选手……戴眼镜，背有点驼。怎么那么像朱老师？`),
  ], { cards: ['c_observation'] });

  S('4-5', '干净的数据', '操控老陈打他人生第一场比赛，用数据看穿对手的套路。', ['c_read', 'c_inclusion'], [
    D('gym', `laochen|think|我把三个月的签到表重新整理了一遍。有一行很奇怪。|paper
laochen|talk|“铁力健身 · 场地考察”，来了三次。联系人一栏，写着果哥的名字。
houzi|surprise|我就说那个徽章不对劲！
xiaohong|think|先别下结论。数据是观察，原因要等他自己说。
ruibao|talk|那今晚呢？老陈，你还只坐在场边记吗？
laochen|shy|我……想打一局。就一局。
lu|cheer|老陈上场！我给你讲冷笑话加油！
laochen|smile|你别讲，我会笑软的。`),
    match('ruibao', 'easy', { as: 'laochen', stars: [SKILL('老陈'), NO_ERR()], rule: '透视开启后，对手连续同类球路，你的下一拍必定完美' }),
    D('gym', `laochen|happy|我赢了？我真的……在场上赢了一局？
ruibao|smile|你一直在等我往哪打。我连换三次方向，都被你提前等着。
laochen|smile|因为你连着吊了两拍。整理数据的人，最先看出来的就是重复。
lu|shy|老陈，你以后打球去了，不会不陪我上厕所了吧？
laochen|happy|陪。打完球一起去。
mm|happy|又一个人，从场边走进了场地。`),
  ], { chars: ['laochen'] });

  // ======================= 第五章 · 风雨停馆夜 =======================
  S('5-1', '穿堂风', '观察风向，选好适应方法再比赛。', ['c_wind', 'c_environment'], [
    D('gymrain', `nar||倒计时第十五天。傍晚起风了，风顺着侧门的缝一阵一阵往里灌。|rain
canglan|point|今晚的练习赛照常。风会让球飘，先观察，再出手。
guoge|tired|这种天就该在家躺着。我是来……看看的。`),
    { t: 'pick', q: '顺风时，同样发力的高远更容易过长。先怎么适应？', exp: '先用试球校准手感。这里的风是教学用的简化效果。', o: [
      { label: '先试球，再略收力量', ok: true, note: '你记录了风向，判断更从容。', env: { wind: 1.4, adapt: .8 } },
      { label: '照原来那样全力打', ok: false, note: '可以实战体会，但球可能会过长。', env: { wind: 1.4, adapt: .3 } },
    ] },
    match('canglan', 'normal', { windFlip: 2, rule: '每两分换一次风向：顺风收力，顶风放心发力' }),
    D('gymrain', `canglan|smile|顶风放心发力，顺风收着打。风不讲道理，但有规律。
me|think|外面的雨……越来越大了。|rain
nar||果哥的手机一直在震。他看了一眼，把屏幕扣在了长椅上。`),
  ], { cards: ['c_wind', 'c_environment'] });

  S('5-2', '停电以后', '安全停下训练，在黑暗里检查球馆——还有一叠散落的纸。', ['c_safety', 'c_shoes'], [
    D('blackout', `nar||“啪”的一声，整座球馆暗了下来。|switch
canglan|point|所有人停下，别跑！原地站好，打开手机电筒。
xiaohong|think|地面有积水，侧门在漏雨。先确认每个人都在。
guoge|talk|我……我得先走一步，有个约必须去。
nar||果哥转身太急，背包撞在门框上，一叠纸滑了出来。|paper`),
    inspect('blackout', '停电安全检查', [
      ['floor', '湿滑地面', .25, .62, '地面积水。先停止所有练习，绕开湿区，用防滑垫隔开；鞋底沾水更容易打滑。', 'wet-floor'],
      ['exit', '安全出口', .52, .30, '出口指示灯靠应急电源亮着。沿墙边集合，清点人数。', 'exit'],
      ['papers', '散落的纸', .78, .55, '一叠签名表，抬头印着：“支持星光体育馆改建为铁力健身 · 联系人：果哥”。', 'petition'],
    ]),
    D('blackout', `houzi|angry|果哥！这是什么？
guoge|sad|……支持改建的签名。铁力答应我，凑够两百个，送我一张终身卡。
ruibao|angry|你一边跟我们训练，一边帮人拆我们的球馆？
guoge|talk|我只是两边都下注！哪边赢我都不亏，这有什么错？
lu|think|从收益模型看，没错。从朋友模型看……错得离谱。
laochen|sad|场地考察那三次，也是你带他们来的吧。`),
  ], { cards: ['c_safety', 'c_shoes'] });

  S('5-3', '门外的人', '暴雨中打开侧门：操控果哥，冒雨搬运防滑垫。', ['c_volunteer', 'c_fatigue'], [
    D('rainhall', `nar||门外传来敲门声。公交停运了，十几位阿姨叔叔挤在屋檐下，最小的孩子才五岁。|bus
canglan|surprise|……和外婆讲过的那一晚，一模一样。
canglan|fist|开侧门，让大家进来。先把场边的防滑垫铺好，把长椅搬到干的地方。
me|talk|垫子太重了，我们几个搬不动。
guoge|think|……让开。这种活，我练了三年。`, { cast: ['guoge'] }),
    walk('冒雨搬垫子', { as: 'guoge' }),
    D('rainhall', `nar||果哥一趟扛两张垫子。最后，他背着一位扭了脚的奶奶，从侧门一直走到看台。|steps
guoge|tired|呼……健身三年，第一次觉得这身肌肉有用。
ranran|smile|奶茶店的老板娘送来了热水。今晚，我们不缺喝的了。
laochen|talk|我统计了：二十三个人，都在，都是干的。
mm|surprise|我想起来了……一九九六年，也是这扇门，也是这么多湿漉漉的人。`),
  ], { gear: ['sh_stable'] });

  S('5-4', '没有打完的决赛', '听朱老师讲一九九六年的那一夜，再给孩子们发几个球。', ['c_let', 'c_etiquette'], [
    D('rainhall', `nar||夜里十一点，电恢复了一半。朱老师撑着伞出现在门口——他就住在两条街外。|door
zhu|surprise|我看见灯亮着，就知道又有人开了侧门。
me|talk|朱老师，录像里那个星光选手……是您吧？
zhu|smile|是我。十四平，我发球。我刚抬头看球，林姐就走到网前，说门外有人。
zhu|talk|我们放下球拍去开门。那一晚，馆里睡了六十多个人。比赛，就再也没有打完。
canglan|sad|那为什么有人说，是星光怕输？
zhu|sad|寒星的队员当晚就被家长接走了。误会传了三十年，林姐一句也没解释。她说：“分数不重要，人重要。”
mm|sad|所以我一直落不了地……那一球，到现在还在空中。
guoge|sad|……我拿着改建的签名表，站在她开过门的地方。`),
    choice('guoge', '果哥低着头站在门边。你对他说什么？', [
      ['说清楚，你到底站哪边？', '果哥抬起头，第一次没有用玩笑躲开。', '说清楚，你到底站哪边？'],
      ['今晚你背的奶奶，记住你了', '果哥愣住了，耳朵慢慢红了。', '今晚你背的那位奶奶，记住你了。'],
    ]),
    D('rainhall', `me|talk|{guoge}
guoge|sad|我一直以为，投机就是聪明。两边下注，谁也不得罪。
guoge|think|可今晚，要是这里已经变成了健身房，这些人就只能站在雨里。一张终身卡，换不来这个。
nar||果哥把那叠签名表撕成了两半，又撕成了四半。|paper
xingxing|talk|孩子们睡不着。凌风，在干的那块场地上，给他们发几个球看看吧？`),
    serve('给孩子们的发球表演'),
    D('rainhall', `nar||五岁的小女孩捡起毛毛，小心翼翼地抛了一下。毛毛在灯光里翻了个跟头。
mm|happy|好久没有人这样看着我飞了。
zhu|smile|林姐要是在，会说：门开对了。`),
  ], { cards: ['c_let', 'c_etiquette'] });

  S('5-5', '雨停之后', '球馆暂停开放。操控果哥参加他的“入社考试”。', ['c_record', 'c_smash'], [
    D('dawnhall', `nar||天亮了。雨停了，地上还留着一层水光。|door
laochen|sad|评估组一早来过了：侧门漏雨、两盏灯烧坏、地板起翘。球馆暂停开放，修好后复查。
xiaohong|sad|安全这一项……我们扣分了。
guoge|fist|那就修。我认识装修师傅，便宜，靠谱。这次不是投机，是投资。
houzi|smile|问题不大？
guoge|smile|问题很大。但我有肌肉。
ruibao|think|想入社，先过考试。猴子，你来考他。
houzi|happy|来，用你自己的招打我。看看你的“抄底”，到底抄不抄得到。`),
    match('houzi', 'normal', { as: 'guoge', stars: [SKILL('果哥'), G1('扣杀得分 1 次', r => r.st.smashWin >= 1)], rule: '先抄底：等对手回出机会球，再一锤定音' }),
    D('dawnhall', `guoge|happy|抄到了！看见没，机会球一来，我就上！
houzi|tired|我就送了一个半高球……你至于吗。
dingding|point|值日表上，你排周一和周四。
guoge|tired|……周四是我的练腿日。
canglan|smile|那就周一和周五。钥匙，我多配了一把。|paper
nar||那是沧澜第一次，把钥匙交到别人手里。`),
  ], { chars: ['guoge'] });

  // ======================= 第六章 · 云上的最后一课 =======================
  S('6-1', '云上试球', '比较空气阻力，理解为什么到新场地要先试球。', ['c_speed', 'c_altitude'], [
    D('mountain', `zhu|point|球馆修好要一周。这一周，跟我上山。春城集训营是我老朋友开的。
houzi|cheer|团建！我带了三个充电宝和一包零食！
zhu|smile|充电宝没收。这里海拔高、空气稀，球会飞得更远。先做实验。
laochen|think|只改阻力，其他都保持一致。我来记。`),
    lab('air', '云上的空气实验'),
    D('mountain', `laochen|happy|阻力小，同样的出球飞得更远。三组数据很干净。
zhu|smile|到新场地，先试球，再校准。别一打出界，就怀疑自己不会打球了。
guoge|tired|……光是爬上来，就用完了我今天的体力。`),
  ], { cards: ['c_speed', 'c_altitude'] });

  S('6-2', '墙也可以教人', '王瑞教果哥接杀：缩短挥拍，先挡住最急的那一拍。', ['c_defense', 'c_short_swing'], [
    D('mountain', `guoge|angry|为什么我要练接杀？我是负责扣杀的人！
zhu|talk|只会进攻的人，比赛里一半时间都在等。
ruibao|smile|来，我教你。拍子放在身前，动作缩短，别抡。
guoge|surprise|你？你不是只会挡吗？
ruibao|fist|挡也是一门手艺。看好了。`),
    drill('接杀与简洁回拍', 'receive', 4, 9, { feeds: { smash: 1, drive: .4 } }),
    D('mountain', `guoge|surprise|……挡回去了？我居然挡回去了？
ruibao|happy|墙也可以教人。这句话，我想说给初中的自己听。
zhu|smile|会防守的人，才知道进攻该什么时候来。`),
  ], { cards: ['c_short_swing'] });

  S('6-3', '云端跳杀', '起跳要高，落地更要稳。星星帮小红数着回位时间。', ['c_smash', 'c_landing'], [
    D('mountain', `xiaohong|fist|我要把跳杀练到最快。比赛里，一拍结束最省事。
zhu|point|起跳要高，落地更要稳。落不稳，就没有下一拍了。
xingxing|think|你每次跳完，都要过很久才回到中间。
xiaohong|surprise|……你一直在看？
xingxing|shy|我在数。平均一点二秒。`),
    drill('起跳，也要落得稳', 'smash', 3, 8),
    D('mountain', `xiaohong|happy|落地稳住，再回位……零点九秒。
xingxing|smile|快了零点三秒。比你那条公式靠谱。
zhu|smile|再快的扣杀，也只是一拍。接下来那一拍，才见功夫。`),
  ], { gear: ['s_rep', 'sh_light'], cards: ['c_landing'] });

  S('6-4', '星空下的营火', '果哥出题：会偷懒的人，最懂怎么休息。', ['c_health', 'c_warmup'], [
    D('stars', `nar||营地的夜空很低，低得像伸手就能碰到星星。
xingxing|happy|那是夏季大三角：织女、牛郎，还有天津四。
houzi|smile|丁丁，记得初二那年吗？我们为了一把排位，在网吧熬到天亮。
dingding|happy|然后第二天比赛，你在场上打瞌睡。
houzi|think|那时候我觉得，游戏和球只能选一个。现在想想，好像都能留着。
guoge|point|说到熬夜——你们这作息，放在健身房会被教练骂死。来，我出几道题。`),
    board('果哥的营火体能课', [
      puzzle('跳杀练到一半，膝盖开始隐隐作痛。', ['忍一忍，继续练', '停下来，告诉教练', '换另一条腿起跳'], 1, '疼痛是身体在报警。停止练习，告诉教练或监护人，不把忍痛当本事。', 'chart:本周跳杀次数|周一=20,周二=35,周三=60'),
      puzzle('热身应该怎么开始？', ['直接全力跳杀', '先慢跑、活动关节，再做专项动作', '拉伸十分钟后马上比赛'], 1, '由轻到重，循序渐进。热身是让身体准备好，不是提前比赛。', 'chart:热身强度（示意）|慢跑=2,关节=3,专项=6,比赛=9'),
      puzzle('连续练了三天，大家都很累。第四天怎么安排？', ['加练，越累越强', '安排轻松练习或休息', '只练扣杀'], 1, '恢复也是训练的一部分。累到动作变形，练得越多，错得越多。', 'chart:队员疲劳度|第一天=3,第二天=5,第三天=8'),
    ]),
    D('stars', `laochen|surprise|果哥，你懂得真多。
guoge|shy|……健身房待久了，总得学点真东西。偷懒的人，最懂怎么休息。
lu|happy|我宣布：果哥的作息模型，比我的胜率模型靠谱。
laochen|smile|难得听你认输。我记下来了。
nar||营火噼啪作响。没有人看手机，连猴子也没有。`),
  ], { cards: ['c_health'] });

  S('6-5', '朱老师的最后一课', '打破预判，与朱老师认真切磋。', ['c_read', 'c_feint'], [
    D('mountain', `zhu|point|明天下山。最后一课，跟我打一局。
me|surprise|您不是说跑不动了吗？
zhu|smile|跑不动，就让球跑。我会读你的习惯——别连续打同一种球。
mm|point|打破他的预判：高远、吊球、杀球，轮着来。`),
    match('zhu', 'boss', { stars: [G1('用吊球得分 1 次', r => r.x.dropWin >= 1), G1('用高远或杀球得分 1 次', r => r.x.clearWin + r.x.smashWin >= 1)], rule: '他会读你的习惯：别连续打同一种球' }),
    D('mountain', `zhu|happy|好。你没有被我读透。
me|talk|老师，那年的最后一球，您后悔过吗？
zhu|think|后悔没打完？有一点。后悔去开门？从来没有。
zhu|smile|下山以后，替我好好打星光杯。还有——寒星中学的王牌，是我当年那个老对手的外孙。`),
  ], { chars: ['zhu'] });

  // ======================= 第七章 · 不完美的冠军 =======================
  S('7-1', '队内选拔', '你来当队长助理：挑一位队友，替他打一场选拔赛。', ['c_matchplan', 'c_fatigue'], [
    D('locker', `xiaohong|point|星光杯单打，社里只有两个名额。先打一轮队内选拔。
houzi|happy|我报名。问题不大。
guoge|fist|我也报。这次不是为了奖品——好吧，一半是。
laochen|shy|我……也想试试。
xiaohong|think|凌风，你来当队长助理。挑一个人，替他打这场选拔赛。`),
    choice('lineup', '你想替谁打这场选拔赛？', [
      ['猴子', '猴子把手机交给丁丁保管。', '猴子', { as: 'houzi' }],
      ['果哥', '果哥把蛋白粉放回了柜子里。', '果哥', { as: 'guoge' }],
      ['老陈', '路先森给老陈递了一瓶水。', '老陈', { as: 'laochen' }],
    ]),
    match('xiaohong', 'normal', { as: 'pick', asKey: 'lineup', target: 3, cap: 5, stars: [G1('用出一次技能', r => (r.x.skill || 0) >= 1), NO_ERR(2)], rule: '三分短局：每一分都要有计划' }),
    D('locker', `xiaohong|smile|{lineup}打得很好。不过，正式比赛的两个名额，我想留给凌风和我。
houzi|smile|问题不大。场边也是战场，我负责喊加油。
guoge|think|替补也有替补的回报率。我负责赛前热身。
laochen|happy|我负责记数据。这一次，我想记的是你们赢下来的每一分。`),
  ], { cards: ['c_matchplan', 'c_fatigue'] });

  S('7-2', '对手递来的录像', '星光杯开幕，田楚出现。先看懂发球站位。', ['c_servicecourt', 'c_serve'], [
    D('stadium', `nar||星光杯开幕。看台挤满了人，寒星中学的队伍穿着一身深蓝。|cheer
tianchu|talk|你就是凌风？外公让我把这个交给你。|paper
me|surprise|一盘录像带？
tianchu|smile|一九九六年的决赛，寒星那一侧的机位。我看过很多遍。那一分，没有人输。
tianchu|point|不过今天，我会认真赢你。先看看你懂不懂发球站位。`),
    board('发球之前', [
      puzzle('标准单打。你得到发球权，自己的分数是 0 或偶数。', ['右发球区', '左发球区', '随便站'], 0, '发球员自己的分数为 0 或偶数时，在右区发球。', 'serve-even'),
      puzzle('标准单打。你得到发球权，自己的分数是奇数。', ['左发球区', '右发球区', '跟着对手的分数站'], 0, '站位看发球员自己的分数：奇数左、偶数右。', 'serve-odd'),
      puzzle('发球时，你的一只脚踩在了发球区线上。', ['没关系', '违例，发球员和接发球员都要站在区内、不踩线', '只要球过网就行'], 1, '发球区线不能踩，站位要在对角发球区内。', 'serve-foot'),
    ]),
    D('stadium', `tianchu|smile|很好。你看规则，不只看对手。
xiaohong|think|他递录像，是挑衅，还是……
xingxing|talk|他说“没有人输”。我觉得，那是一种邀请。`),
  ], { cards: ['c_servicecourt'] });

  S('7-3', '半决赛：小红', '抽签让你和社长在半决赛相遇。认真打完这一局。', ['c_focus', 'c_matchplan'], [
    D('locker', `xiaohong|think|半决赛，我对你。抽签真会开玩笑。
me|smile|那就认真打。
xiaohong|fist|我不会让球，也不会再喊“必须赢”。我只想打出我们练过的东西。
xingxing|smile|我坐在正中间，两边都加油，不许有意见。`),
    match('xiaohong', 'boss', { stars: [NO_ERR(), RALLY(10)], rule: '他学会了回位：耐心调动，等真正的机会' }),
    D('locker', `xiaohong|happy|输了。可是这一局，我每一拍都记得自己为什么这么打。
me|talk|你最后那拍没有硬扣，换成了吊球。
xiaohong|smile|公式更新了：误差项后面，加上了队友。
xingxing|happy|那十二盏路灯，今天也给你留着。`),
  ]);

  S('7-4', '决赛之前', '手在抖？猴子陪你说话，果哥带大家热身。', ['c_warmup2', 'c_communication'], [
    D('locker', `me|sad|手在抖。明明只是一场比赛。
houzi|smile|决赛前手抖？问题不大。初三那年，我抖得拍子都快掉了。
houzi|talk|但这次不一样，你不是一个人。场边坐着十个人，每个人都替你看着一块地方。
guoge|point|来，赛前热身。先慢跑，再活动关节，最后几个短距离启动。谁也不许偷懒——包括我。`),
    walk('果哥带的赛前热身'),
    D('locker', `guoge|happy|心率起来了，肌肉醒了。剩下的，交给你自己。
laochen|talk|田楚的数据：他喜欢用同一个引拍打出不同的球。别看他的手，看球。
dingding|point|拍线我刚检查过，二十四磅，稳。
canglan|smile|去吧。门，我们看着。`),
  ], { cards: ['c_warmup2'] });

  S('7-5', '星光杯决赛', '与田楚打完一场有准备、有变化的决赛。', ['c_feint', 'c_fairplay'], [
    D('stadium', `tianchu|point|你看到的，未必是真的。
me|talk|那我就等球真的飞过来。
mm|point|他同一个准备动作能打出不同的球。站稳，看清，再出发。`),
    match('tianchu', 'boss', { target: 7, cap: 11, rule: '假动作骗不了站稳的人：看球，不看手' }),
    D('stadium', `nar||最后一球落地。记分牌停住，看台上的人全站了起来。|cheer
tianchu|smile|恭喜。这一次，比赛打完了。
me|happy|谢谢你，也谢谢你外公。
tianchu|wave|外公说，等你们的球馆修好，他想回来，把那一分打完。
xiaohong|cheer|我们赢了！球馆有救了！
laochen|think|……评估通知没有变。奖杯，换不来钥匙。`),
  ], { chars: ['tianchu'], gear: ['r_star'], cards: ['c_feint', 'c_fairplay'] });

  // ======================= 第八章 · 奖杯没有钥匙 =======================
  S('8-1', '证据一件一件摆出来', '整理说明会的材料：安全、使用、运营。', ['c_evidence', 'c_safety'], [
    D('hearing', `nar||倒计时第六天。评估组同意开一场公开说明会，铁力健身也会到场。|paper
laochen|point|评估看三项：安全、使用、运营。奖杯只能证明我们会打球。
xiaohong|think|那就把三项都准备好，证据一件一件摆出来。`),
    inspect('hearing', '准备公开说明的材料', [
      ['repair', '维修记录', .22, .40, '侧门已修，灯管换新，起翘的地板加固。每一项都有照片和日期。', 'repair-log'],
      ['data', '使用数据', .50, .36, '清洗后的签到：从每周四人涨到每周三十一人。没有一条重复签名。', 'clean-data'],
      ['night', '暴雨夜记录', .78, .40, '二十三人在暴雨中临时避雨，全部安全离开。附有街道办的感谢信。', 'shelter-letter'],
    ]),
    D('hearing', `lu|happy|模型更新：保住球馆的概率，从百分之三涨到了百分之四十一！
laochen|smile|差的那一大块，是运营。没有钱，修好的灯也会再坏。
guoge|think|……运营的事，我也许有办法。`),
  ], { cards: ['c_evidence'] });

  S('8-2', '评估组的追问', '说明会上，评估组追问开放日的场地与规则。', ['c_doubles_lines', 'c_sharedcourt'], [
    D('hearing', `nar||说明会开始了。评估组的老师翻着材料，抬起头。
canglan|sad|他们问：一九九六年和这次的暴雨夜，球馆都在没有审批的情况下接收了人员。这算不算安全隐患？
xiaohong|think|……沧澜？
canglan|sad|我……我不知道该怎么回答。外婆开门，是对的吗？
laochen|talk|我来。我们有当晚的清点记录、出口检查和街道的感谢信。也承认：以后需要一份写清楚的应急预案。
canglan|surprise|老陈……
lu|point|下一个问题：开放日新手多，打双打时，场地线怎么说明？`),
    board('评估组的追问', [
      puzzle('双打回合中，球落在单打边线外、双打边线内。', ['界内', '出界', '重发'], 0, '双打回合使用外侧的双打边线。', 'doubles-in'),
      puzzle('双打发球，球落在单打后发球线和双打后发球线之间。', ['界内', '发球过长，出界', '必须重发'], 1, '双打发球区更宽，却更短：要落在双打后发球线以内。', 'doubles-serve-long'),
      puzzle('开放日人多，两块场地都有人在等。怎么安排更公平？', ['先到的人一直打', '公开排队表，短局轮换', '只让会打的人上场'], 1, '公开规则、短局轮换，让第一次来的人也有机会。', 'chart:等候人数（示意）|一号场=6,二号场=5,新手区=9'),
    ]),
    D('hearing', `canglan|smile|谢谢你们。我刚才……一个人站在那里，脑子一片空白。
ruibao|talk|你从来就不是一个人站着。只是以前，你不让我们站过去。`),
  ], { cards: ['c_doubles_lines', 'c_sharedcourt', 'c_lines'] });

  S('8-3', '不用赢来证明', '说明会后，在落后的局面里稳住，陪沧澜打完一局。', ['c_pressure', 'c_mental'], [
    D('gymnight', `nar||说明会结束了。评估组只留下一句：“再看看。”|door
canglan|tired|我以为只要我一直守着，门就不会关。可是今天，我差点让外婆的门变成了一条“隐患”。
me|talk|守门的人，不是只有你。
canglan|think|……陪我打一局吧。我先让你三分。不，五比三，我领先。没有技能，就当平常训练。
mm|point|落后的时候，把目标缩小：下一球先回深。`),
    match('canglan', 'normal', { target: 7, cap: 11, startScore: [3, 5], skills: false, stars: [NO_ERR(), RALLY(8)], rule: '三比五落后开局：一分一分追，下一球先回深' }),
    D('gymnight', `canglan|smile|追回来了。……原来落后的时候，最需要的不是更用力，是有人一起数分。
me|smile|那以后，分我们一起数。
canglan|happy|钥匙也是。|paper`),
  ], { cards: ['c_pressure'] });

  S('8-4', '两个方案，一张表', '果哥带来新方案：羽毛球和健身，不一定二选一。', ['c_sharedcourt', 'c_data'], [
    D('hearing', `guoge|point|我去找了铁力的店长。他们要的其实不是这块地，是会员和曝光。
houzi|surprise|你又去找铁力了？
guoge|smile|别急。这次我是替我们谈。我做了个方案——让羽毛球和健身，待在同一座球馆里。
laochen|talk|数据我帮他算好了。你们判断一下，哪种说法最站得住。`),
    board('两个方案，一张表', [
      puzzle('改建方案：会员年费两千元。原来每周来打球的三十一人里，有多少人愿意办卡？', ['大多数都愿意', '只有少数人愿意，大部分人会失去这个地方', '数据看不出来'], 1, '三十一人里只有三人愿意。只看营收，会把原来的使用者挡在门外。', 'chart:原有球友的态度|愿意办卡=3,犹豫=6,不会办=22'),
      puzzle('共享方案：工作日晚上打羽毛球，周末上午做公益体能课；铁力出维修费，换取冠名。哪项数据最能说服评估组？', ['奖杯数量', '共享后的预计使用人次', '果哥的粉丝数'], 1, '评估看“使用”。共享后，来的人更多、更杂，球馆也有了维修费。', 'chart:每周预计人次|只打球=31,只健身=40,共享=86'),
      puzzle('有人担心共享后，球场会被健身课挤占。最好的回应是？', ['保证永远不会冲突', '公开时段表，按时段轮换，定期复查', '不回应'], 1, '把规则写清楚、公开、可检查，比一句保证可靠。', 'chart:每周时段安排|羽球=5,体能课=2,维护=1'),
    ]),
    D('hearing', `guoge|happy|看见没？两边都赚，才叫好投资。以前我是两边下注，这次是让两边都赢。
ruibao|smile|这回的投机，我投你一票。
lu|think|从朋友模型看……你这次，满分。
laochen|point|评估组同意了：给三天试运营。开放日来了多少人，就是答案。`),
  ], { cards: ['c_data'] });

  S('8-5', '开黑群的招募令', '猴子和丁丁打了个赌：赢了，整个开黑群都来开放日。', ['c_inclusion', 'c_read'], [
    D('gameroom', `houzi|point|三天试运营，人从哪来？我有办法——我的开黑群，三百二十个人。
dingding|think|他们只会打游戏，谁愿意来打球？
houzi|smile|所以我们赌一把。我用球拍赢你，群里就发集结令。输了，我请全群喝奶茶。
dingding|fist|行！这把我不会放水。
houzi|happy|凌风，还是借你的手。闪现留着，关键时刻再交。`),
    match('dingding', 'normal', { as: 'houzi', stars: [SKILL('猴子'), RALLY(6)], rule: '赌约之战：他快，你更快——闪现留到被调动时用' }),
    D('gameroom', `houzi|cheer|赢了！集结令，发！|keyboard
nar||手机响个不停。群里一条接一条：“猴哥都去了？”“我也去！”“有新手教程吗？”
dingding|smile|……行吧，我也去发。我店里的老顾客群，有两百多个人。
houzi|happy|看见没，打游戏也不全是浪费时间。这叫社交资源。
mm|cheer|开黑群、穿线铺、健身房……这座球馆，要热闹起来了！`),
  ]);

  // ======================= 第九章 · 把球传出去 =======================
  S('9-1', '开门的早晨', '开放日第一天：检查借拍处、规则牌和急救箱。', ['c_inclusion', 'c_sharedcourt'], [
    D('community', `nar||倒计时第三天。早上七点，门外已经排起了队。|door
canglan|surprise|这么多人？
laochen|happy|开黑群四十一人，穿线铺老顾客二十三人，铁力会员十五人，还有广场舞队的阿姨们。
guoge|smile|阿姨们是我请来的。她们说，周末早上能来做体能课。
me|point|先检查场地，再开门。`),
    inspect('community', '开放日检查', [
      ['rack', '借拍处', .22, .40, '借拍登记，拍子按重量分好。第一次来的人，先拿最容易挥的那支。', 'rental'],
      ['rules', '规则牌', .52, .32, '短局轮换、排队顺序、球场礼仪，写在每个人都看得见的地方。', 'rule-board'],
      ['kit', '急救箱', .80, .52, '急救箱和应急预案挂在门边，联系人写着三个人的名字，不再只有沧澜。', 'first-aid'],
    ]),
    D('community', `canglan|smile|应急预案上，有三个名字。
ranran|smile|奶茶店也来了，摊位摆在门外——奶茶，依然不准带进场地。
mm|happy|开门啦！|door`),
  ], { cards: ['c_inclusion'] });

  S('9-2', '第一堂新手课', '把自己的技术拆成新人听得懂的三步，再给他们喂球。', ['c_teaching', 'c_grip'], [
    D('community', `houzi|surprise|我的群友都在问：“羽毛球的新手教程在哪？”
ranran|point|第一课别讲太多。先让他们成功一次。
xingxing|think|就像我第一次看星星，先找最亮的那颗。`),
    board('教练要先说什么', [
      puzzle('第一次拿拍的人，最先教什么？', ['跳杀', '放松地握拍', '双打轮转'], 1, '先握稳、握松，再谈发力。手太紧，什么球都打不好。', 'chart:新手最常见的问题|握太紧=9,站太直=6,挥太早=4'),
      puzzle('新手连续三球没接到，开始沮丧。', ['告诉他“你不适合打球”', '把来球放慢、放高，先接到一个', '换下一个人'], 1, '降低难度，制造一个小成功。第一次成功，比十句鼓励都有用。', 'chart:新手接球成功率|快球=1,中速=4,慢高球=8'),
      puzzle('一位阿姨问：“我膝盖不太好，能打吗？”', ['不能，回家吧', '按自己的状态，先慢、先短，有不适就停', '忍着打'], 1, '人人都能有一个入口。按自己的状态选择强度，身体不适就停。', 'chart:适合的入门方式|原地接球=8,短距离=6,全场跑=2'),
    ]),
    drill('新手也能成功的一球', 'receive', 3, 7, { feeds: { clear: 3, lift: 2, drop: 1 } }),
    D('community', `nar||一位从开黑群来的男生，第一次把球接过了网。他愣了两秒，大叫一声：“我接到了！”|cheer
houzi|cheer|这比我第一次拿五杀还响！
ranran|happy|你看，这就是开门的意义。`),
  ], { cards: ['c_teaching', 'c_grip'] });

  S('9-3', '双机热备', '操控路先森，和老陈打一场“数据双雄”表演赛。', ['c_doubles_rotation', 'c_mixed'], [
    D('community', `lu|fist|表演赛！我对老陈！我的冷笑话，对他的数据透视！
laochen|smile|你确定？我可是记得你所有的冷笑话。
lu|surprise|……那我就讲新的。
xiaohong|point|表演赛之后，我们讲双打：进攻时一前一后，防守时一左一右。
dingding|talk|还有，先说清楚再配合。别像打团时那样，五个人抢一个人头。
mm|point|这一局，你来当路先森！`),
    match('laochen', 'normal', { as: 'lu', stars: [SKILL('路先森'), NO_ERR()], rule: '老陈会看穿重复球路：多变化，再用冷笑话打乱他' }),
    D('community', `laochen|happy|你最后那个冷笑话，我真没听过。
lu|happy|我昨晚现编的。这叫版本更新。
lu|shy|老陈……其实你现在打得比我好。
laochen|smile|好不好不重要。双机热备，一台出问题，另一台顶上。我们是一对。
houzi|cheer|看台上的人都在笑！这表演赛值了！`),
  ], { cards: ['c_doubles_rotation', 'c_mixed'] });

  S('9-4', '肌肉不是一切', '果哥的健身房朋友只会用蛮力。教他们把球稳定地送到后场。', ['c_consistency', 'c_progression'], [
    D('community', `guoge|tired|我那几个健身房的兄弟，打球全靠力气，十个高远九个出界。
guoge|think|我以前也一样。直到王瑞教我接杀，朱老师骂我只会等。
ruibao|smile|那你来教他们。稳定，也是一种本事。
guoge|point|好。兄弟们，看好了——这不是比谁打得远，是比谁打得准。`),
    drill('稳定送到后场', 'clear', 5, 9),
    D('community', `guoge|happy|十个里，有七个落在后场！比卧推加重还爽。
laochen|talk|开放日第一天，一百三十七人次。重复签名已经去掉了。
lu|happy|模型更新：百分之七十九。
canglan|smile|别更新了。剩下的，交给明天。`),
  ], { cards: ['c_consistency', 'c_progression'] });

  S('9-5', '这一分属于大家', '用一场不开技能的短局交流赛，结束开放日。', ['c_etiquette', 'c_matchplan'], [
    D('community', `nar||开放日最后一场。看台上，坐着新朋友、老顾客、阿姨们，还有铁力的店长。|cheer
me|point|今天不比技能，只比我们练过的东西。
xingxing|happy|我来当你的对手。这次我不怕输了。
ranran|point|赛后握手，球用拍子轻轻送回对面。新朋友都在看着。
mm|cheer|输了也有东西带回家，赢了也还有东西要学！`),
    match('xingxing', 'normal', { target: 5, cap: 7, skills: false, rule: '交流赛：不开技能，比练过的东西' }),
    D('community', `xingxing|smile|好球。……你看，我输了，可我在笑。
nar||铁力的店长站起来鼓掌。第二天，他在共享方案上签了字。|paper
laochen|happy|三天试运营，三百一十二人次。评估组说，最后一天来复查。
canglan|wave|最后一天……也是外婆的生日。`),
  ]);

  // ======================= 第十章 · 另一边的球网 =======================
  S('10-1', '寒星中学的档案室', '在寒星的档案里，找到合影缺掉的那一角。', ['c_history', 'c_evidence'], [
    D('archive', `tianchu|talk|外公说，档案室里有样东西，该还给你们了。|door
me|think|寒星的档案室……比我们的旧多了。`),
    inspect('archive', '另一边的档案', [
      ['corner', '照片的一角', .22, .32, '一小块撕下的照片：一位戴袖章的女士，笑着握住一支蓝握把的球拍。背面写着：“比赛打完，再拼回去。”', 'corner'],
      ['sheet', '两份比分表', .52, .46, '星光和寒星两份记录完全一致：十四平，比赛中断，没有胜者。不必猜测补上不存在的最后一分。', 'true-score'],
      ['letter', '没寄出的信', .78, .32, '“林姐：那一夜，我也在门口搬过垫子。我知道星光没有怕输。可我年轻，抹不开面子替你们说话。”', 'letter'],
    ]),
    D('archive', `canglan|sad|外婆把自己撕了下来……交给了对手。
tianchu|sad|外公说，林奶奶那天把这一角塞给他：“误会是我的事，你们别吵。比赛打完，再拼回去。”
tianchu|talk|他欠一句道歉，欠了三十年。信写好了，一直没敢寄。
mm|sad|原来……不是谁都忘了那一球。是大家都在等。
me|smile|那就让它落地吧。合影，我们一起拼回去。`),
  ], { cards: ['c_history', 'c_evidence'] });

  S('10-2', '赛制会改变', '十四平怎么打完？分清当年的规则、现在的规则和已公布的新赛制。', ['c_scoring_update', 'c_service_order'], [
    D('hearing', `zhu|think|一九九六年是十五分制，只有发球方才能得分。十四平，我发球。
tianchu|talk|现在是每球得分制。按哪一版规则打完那一分？
dingding|think|有人还问，为什么我们故事里打七分，电视上却不是？
mm|smile|规则会更新，先标清日期，再来判断。`),
    board('赛制辨认', [
      puzzle('本故事约定七分短局、领先两分、十一分封顶。五比五后，能直接打一分结束吗？', ['可以', '不可以，按约定继续计分', '由领先的人决定'], 1, '短局也要按赛前公布的规则执行。七分制是游戏的安排。', 'score'),
      puzzle('截至 2026 年 11 月，BWF 已公布的 3×15 新赛制何时实施？', ['所有赛事早已统一改完', '2027 年 1 月 4 日起实施', '永远不改'], 1, 'BWF 已批准新赛制，实施日为 2027 年 1 月 4 日。具体参赛仍应查看该赛事规程。', 'rules-update'),
      puzzle('标准单打，你得到发球权，自己的分数是奇数。', ['左区发球', '右区发球', '跟着对手的分数站'], 0, '站位看发球员自己的分数：奇数左、偶数右。', 'serve-odd'),
    ]),
    D('hearing', `zhu|smile|那就这么定：十四平，按当年的约定，我发球。打到有人领先两分，或者十六分封顶。
tianchu|smile|外公说，他的膝盖不太行了。那一分，让我们替他们打。
zhu|happy|好。我的发球，交给凌风。`),
  ], { cards: ['c_scoring_update', 'c_service_order'] });

  S('10-3', '先读懂，再改变', '和田楚一起练三拍组织：把套路变成选择。', ['c_deception', 'c_combo'], [
    D('stadium', `tianchu|point|你第一次和我打的时候，看到引拍就动了。
me|smile|后来才发现，你同一个准备动作，能打出不同的球。
tianchu|talk|变化不是让对手完全看不见，而是推迟他确认信息的时间。
mm|point|游戏里的三道幻影是表现效果。现实里，还是看身体、拍面和触球。`),
    combo,
    D('stadium', `tianchu|happy|现在，你不只会背三拍的顺序了。
me|talk|对手站位不一样，计划也要跟着改。
tianchu|smile|很好。明天那场交流赛，我可不会因为我们熟了就让球。`),
  ], { cards: ['c_deception'] });

  S('10-4', '另一边也在努力', '与田楚进行无技能交流赛。', ['c_analysis', 'c_fairplay'], [
    D('stadium', `me|think|这次没有幻影，也没有技能？
tianchu|smile|只有你、我和球。你可以挑自己喜欢的角色来打。
xiaohong|point|赛后，先说一个做得好的决定，再说一个下次想改的地方。
mm|cheer|输了也有东西带回家，赢了也还有东西要学。`),
    match('tianchu', 'hard', { target: 7, cap: 11, skills: false, rule: '无技能交流赛：只有你、他和球' }),
    D('stadium', `tianchu|smile|这一场，我也记了很多笔记。
me|happy|下次交换？
tianchu|wave|下次先比赛，再交换。
nar||新的约定，写在旧照片的背面。字迹不同，留下名字的人，越来越多。|paper`),
  ], { cards: ['c_analysis'] });

  S('10-5', '那一年的网前球', '操控猴子，再站一次网前：低球搓，高球扑。', ['c_netkill', 'c_patience'], [
    D('gymnight', `houzi|think|复查前一晚，我想再练一次网前。
dingding|surprise|你要干嘛？
houzi|smile|初三那球之后，我一直躲着网前。明天大家都在，我想……先跟它和好。
ruibao|point|低球先搓，高球再扑。等一下，也是主动的选择。
xiaohong|talk|这次没人喊“必须”。扑不扑，你自己决定。`),
    drill('那一年的网前球', 'net', 4, 8, { feeds: { net: 2, drop: 1, netlift: 1.4 } }),
    D('gymnight', `houzi|happy|……扑下去了。有一个低的，我搓过去了，没硬扑。
dingding|happy|这才是你。初中那个手最快的猴子。
houzi|smile|问题不大。以前是假装问题不大，这次是真的不大。
xiaohong|smile|群名我改了：“羽毛球天下第一（四缺零）”。
mm|happy|四个人的群，今晚聊到了半夜。`),
  ], { cards: ['c_netkill', 'c_patience'] });

  // ======================= 终章 · 明天也开门 =======================
  S('11-1', '复查前的最后检查', '倒计时最后一天。完成复查前的开门检查。', ['c_volunteer', 'c_maintenance'], [
    D('dawnhall', `nar||倒计时最后一天。最早到的人，不再只有沧澜。|door
canglan|surprise|你们怎么都来了？
ranran|smile|值日表上，有我们的名字。
guoge|tired|今天是周四，我的练腿日。我还是来了。
lu|point|还有自动提醒，不过今天没人需要它。
me|talk|先检查场地，再挂营业牌。`),
    inspect('dawnhall', '开门前检查', [
      ['court', '干燥的地面', .23, .62, '检查有没有水、杂物和散落的球，确认照明正常。问题处理好之前，暂停使用相关区域。', 'morning-floor'],
      ['gear', '借还器材柜', .53, .37, '记录器材状态，破损的退出借用。给下一位使用者留一支可靠的球拍。', 'morning-gear'],
      ['schedule', '共同的值日表', .78, .33, '羽球时段、体能课时段、维护时段，联系人有七个。有人一起照顾，球馆才有明天。', 'morning-rota'],
    ]),
    D('dawnhall', `canglan|happy|我第一次，可以晚来十分钟了。
xiaohong|smile|也可以坐下来，完整看我们打一局。
mm|talk|守护球馆，不是永远不让它改变。是有人愿意一起照顾它。`),
  ], { cards: ['c_volunteer', 'c_maintenance'] });

  S('11-2', '给新人的挑战书', '复查组还没到，新人先到了：从接一个球开始。', ['c_progression', 'c_teaching'], [
    D('community', `nar||门口站着一个背着书包的新生，手里攥着开放日的传单。|door
me|point|挑战书第一条：不会打，也可以报名。
ruibao|happy|第二条：包子不能带上场地。
ranran|smile|第三条：不准拿别人的失误开玩笑。
houzi|happy|第四条：打不好也没关系，问题不大。
xingxing|talk|第五条：完成自己的一个小目标，就值得庆祝。`),
    drill('给下一位队友的来球', 'receive', 5, 10),
    D('community', `nar||新生在报名表上写下名字。字很小，旁边画了一只很大的羽毛球。|paper
me|happy|欢迎。先从接一个球开始。
mm|cheer|这句话，真耳熟。`),
  ], { cards: ['c_progression'] });

  S('11-3', '十四平', '三十年前停在空中的那一分：替朱老师发球，把它打完。', ['c_let', 'c_etiquette'], [
    D('stadium', `nar||复查组到了。朱老师和田楚的外公，坐在场边的同一条长椅上。|door
zhu|smile|老田，三十年了。
tianchu|talk|外公说：“林姐要是在，肯定嫌我们磨蹭。”
canglan|smile|外婆的拍子，丁丁的爸爸换好了新握把。今天，它来发这一球。
dingding|point|二十四磅，握把干燥，拍框检查过了。
mm|surprise|我……我想起来了。那一夜，我就停在这里，十四平，所有人都看着我。
mm|cheer|这一次，让我落地吧！`, { cast: ['zhu', 'tianchu'] }),
    match('tianchu', 'boss', { target: 15, cap: 16, startScore: [14, 14], skills: false, stars: [NO_ERR(1), PERFECT(1)], rule: '十四平：领先两分，或先到十六分' }),
    D('stadium', `nar||最后一球落地。毛毛在地板上弹了一下，安安稳稳地躺住了。|cheer
mm|happy|我落地了。三十年，终于落地了。
zhu|happy|好球。这一分，打完了。
tianchu|smile|外公在哭。他说，他终于可以把信寄出去了。
nar||两位老人站起来，隔着球网握了握手。复查组的老师，在本子上写了很久。|paper`),
  ], { cards: ['c_let', 'c_etiquette'] });

  S('11-4', '猴子的认真模式', '猴子说，最后这场友谊赛，他要认真打。', ['c_analysis', 'c_consistency'], [
    D('festival', `nar||傍晚，球馆门口挂起了彩旗。复查结果，要等明早公布。|cheer
houzi|fist|凌风，最后这场友谊赛，我要认真打。不开玩笑，不说“问题不大”。
me|surprise|你认真起来是什么样？
houzi|smile|不知道。两年没认真过了，我也想看看。
dingding|cheer|猴子认真模式！截图！不，录像！
xiaohong|smile|这次我不带训练表。我带计分牌。`),
    match('houzi', 'boss', { target: 7, cap: 11, rule: '认真起来的猴子：手快、会闪现——深远球逼他移动' }),
    D('festival', `houzi|tired|呼……认真打，原来这么累，又这么爽。
me|happy|下次还打？
houzi|happy|下次还打。周三打球，周五开黑。
nar||这句话，比奖杯在球馆里留得更久。|cheer`),
  ]);

  S('11-5', '门一直为下一球开着', '复查结果公布。选择你的结尾，在新的开放日里继续故事。', ['c_lifelong', 'c_inclusion'], [
    D('dawnhall', `nar||第二天清晨，公告栏上贴出了新的通知。|paper
laochen|happy|“星光体育馆：继续开放，实行共享运营，每季度复查一次。”
lu|cheer|模型更新：百分之一百！……好吧，是“继续开放，定期检查”。
guoge|smile|铁力出维修费，挂个冠名。周末上午的体能课，我来带。
zhu|smile|这就很好。没有一座球馆，能靠一次胜利永远存在。
canglan|happy|合影拼好了。外婆在最右边，笑得很好看。`),
    choice('ending', '你想在新的公告栏上写下哪一句？', [
      ['下一球，一起变强', '你们决定把公开训练一直坚持下去。', '下一球，一起变强。'],
      ['这里永远有你的位置', '你们决定把新手开放日一直办下去。', '这里永远有你的位置。'],
    ]),
    D('dawnhall', `me|wave|{ending}
canglan|happy|钥匙，现在有七把了。
ranran|smile|奶茶，还是不能带进场地。
houzi|happy|开黑群改名了：“羽毛球天下第一 · 扩展包”。
xiaohong|smile|训练表我也改了。第一行写着：允许失误。
xingxing|cheer|天亮了。开门吧！|door
mm|happy|你以为故事结束了？听——又有人在问，能不能借一支球拍。
me|smile|当然能。我刚来的时候，也是这样被人接住的。
nar||星光回响 · 完。可以回到任意已解锁的章节重温、补星，也可以邀请好友，打出你自己的下一球。`),
  ], { cards: ['c_lifelong'] });

  for (const st of stages) {
    for (const key of ['chars', 'gear', 'cards', 'feats']) {
      const values = [...new Set([...(st.rewards[key] || []), ...(key === 'cards' ? st.knowledge : [])])];
      if (values.length) st.rewards[key] = values;
    }
    st.steps.forEach((step, i) => { step.uid = st.id + ':' + i; });
  }
  YY.CAMPAIGN = chapters;
  YY.LEGACY_STAGE_ORDER = [];
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof window !== 'undefined' ? window : globalThis);
