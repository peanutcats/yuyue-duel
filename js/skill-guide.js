/* 技能研习：只读教学数据与分步示意，不参与比赛判定。数值取当前技能说明。 */
(function (G) {
  'use strict';
  const Y = G.YY, TAU = Math.PI * 2;
  // 类型、三个演示阶段、实战建议；操作与数值统一读取 roster.js 的 help。
  const lessons = {
    dixia:["schoolRoll",["手动接低球","贴地钻网","再按选弹起位置"],"先看对手站位：守后就早弹，压前就滑远。可以配合换座位，也可钻网等对手回球后抢拍。"],
    chuanmen:["schoolVisit",["网前钻过去","等对手先触球","手动抢一拍后回家"],"先打出网底球再串门。挑高球和身后球不容易抢到，及时返回保护自己的半场。"],
    huanzuo:["schoolSeat",["旧框与新座位","走出或起跳躲避","滑向新座位仍可挥拍"],"利用对手收拍或刚落地时画框，再根据调位结果选择网底球的弹起位置。"],
    yuyue:["dive",["选方向追低球","拍头自动救起","救起后回位"],"提前朝低球方向扑，让拍头碰到球；飞扑会自动接球，扑空后有趴地空当。"],
    tafeng:["jump",["先起跳","空踏再跃","高点击球"],"把第二次起跳留给高球或快球；踏风只强化下一拍，仍要亲自挥拍。"],
    fengkou:["wind",["布置风道","首球转向","借风回位"],"把风道放在对手常打的线路上，同时借风加速回位；风道只改第一只球。"],
    chaolai:["pool",["积水展开","首次落水弹起","补拍续球"],"被动时用积水弹起争取补拍；同一只球第二次落水就判分，别当救命符。"],
    tongyin:["resource",["比较体力","吸取或省耗","保留进攻余力"],"体力落后时吸一口，体力领先时用它省扣杀消耗；满体力时别浪费。"],
    huichao:["reverse",["等来球过网","沿原轨迹倒退","再按低速放开"],"看倒退后的球处在哪一侧再放开；在己方放开仍要避免球直接落地。"],
    fanshe:["board",["放板与校准","短暂准备后拦球","接力到固定落区"],"提前把板放在对手常打的线路上；普通板有 0.35 秒准备，别等球到才放。"],
    zipao:["toss",["提前准备四秒","近身自抛垫高","亲手精准补拍"],"先准备再到位接球，校准让高点补拍更稳；也可以垫向反射板接力。"],
    pingyi:["buff",["开启辅助线","两次稳拍 / 校准三次","快速收拍衔接"],"接快球或疲劳时开启，稳定回球积校准，再转反射防守或自抛进攻。"],
    tangqiu:["step",["穿花抢位","接续细搓0.70米","免费折返"],"先抢网再手动搓放，下一拍短球更贴网；低球会抬弧求稳。三秒内用免费第二段追短或撤回。"],
    hongxian:["hold",["牵住来球","观察站位","二段选长短"],"网前持球1.25秒：再按放短约0.75米，亲手搓放约0.70米；向前选挑长，低位短球适当放宽。"],
    jiewang:["curve",["展开固定蝶域","截流后亲手回击","两拍放短或挑深"],"截流后亲手上网接球：过网压到约0.65米，或前推挑向底线；有结增至三拍两截，高球和边线可绕开。"],
    diban:["bounce",["备锅 / 拍前砸地","反弹蓄力","再按出锅选长短"],"肉包入锅变成爆馅弹射；出锅后挂回锅，可收回再打一记旺火补拍。"],
    huiguo:["reverse",["下一拍挂回旋","收回保留馅料","旺火补拍 / 再包球"],"先用地板或肉包迫对手移动，再收回改变下一拍；肉包蓄力能带回并重新包球。"],
    baozi:["hold",["上拍 / 投包减速","回球保留蓄力","爆馅选长短"],"慢球诱导走位后爆馅；可把蓄力送进地板弹射，或回锅保馅后再次发动。"],
    yueliang:["orbit",["月亮捕球","绕月旋转","二段切线出球"],"把月亮放在对手常打的线路上，锁球后看准切线再甩；甩歪了要自己补拍。"],
    xingmen:["warp",["选定出口","球穿越星门","出口延迟后飞出"],"把出口和当前球路错开，用 0.35 秒停顿改变对手启动；仍要合法过网。"],
    zhongli:["gravity",["自己回球留标记","开启使标记球上飘","关闭恢复下落"],"先让球带上自己的重力标记再开关，利用短暂上飘改变节奏；不要长按浪费能量。"],
    shensuo:["racket",["向所选方向伸拍","拍头自动接球","提前扫击或快速回收"],"用拍头补上本体够不到的位置；看回收提示及时收回，再准备下一次机械招式。"],
    xuanpai:["orbit",["绕身扫球","未中可追加短扫","命中后快速回收"],"用环扫接身边的球；未接到时再扫一次，命中后及时回收，别原地等远球。"],
    youyou:["hold",["飞轮截球","等待合齿窗口","弹射或带回"],"金色合齿窗口内弹射更稳；也可以留球等飞轮带回，再亲手打。"],
    jindou:["jump",["驾云追高","短暂悬停","高点扣杀"],"给高球施压；悬停不会自动扣杀，观察来球再按击球键。"],
    dangteng:["swing",["选向荡起","二段跃出","空中接续"],"二段换向找空当，再决定接筋斗云还是强化回球；飞行中别飞过头。"],
    haomao:["summon",["召唤并等待准备","巡逻接一球","未接球时可丢香蕉皮"],"小猴先准备再接球，提前召唤并自己守另一区；它接球后很快退场，不一定来得及丢皮。"],
    fuzhi:["clone",["留下复制体","本体跑位","同步挥拍"],"先让复制体守一处，本体覆盖另一处；复制体只同步动作，不会自己追球。"],
    jieli:["toss",["垫向另一端","本体或复制体接应","手动完成接力"],"把复制体当接应点，做二打一；没有复制体时先自垫再进攻。"],
    zangshu:["fake",["放出脏数据","真假球并行","脏球落地乱弹"],"用假球干扰判断，但跑位仍围绕真球；假球不计分，别追着它跑。"],
    yati:["mark",["选择高球或网前球","等待0.18秒生效","改写对手两次手动回球"],"先决定希望对手回高球还是网前球，再按替换后的球路站位；装置代接会绕过替换。"],
    yueqiu:["summon",["选择前后预约区","投影向来球移动","自动回击一球后退场"],"让投影守一处，本体守另一处；投影有移动时间，只能代接一球，不是整片区域无敌。"],
    shuangji:["ice",["地面结霜","急停转向打滑","调动到冰区两侧"],"先逼对手启动，再把球打到冰区两侧；跳跃和冰区外不受影响。"],
    ganggan:["resource",["支付押注","争夺本分","胜负结算"],"发球前押注返还更高，但失败不返还；选有把握的一分。"],
    jiepan:["trap",["支付金币","三个红包落地","踩中短暂停留"],"把红包撒在对手必经的落点，逼他弯腰；只有地面踩中才会停。"],
    qiquan:["power",["支付金币","下一拍附金砖","接球者受压"],"在能主动进攻时投金砖，借击退做下一拍空当；该球直接得分才有额外奖金。"],
    jingxiang:["fake",["选真球落区","一真两假分化","观察滞速与追落"],"向前选深、向后选浅，3D左右选道；对手观察滞速再追落的异常节奏，跟住正常连续弧线。"],
    meida:["fake",["准备0.18秒","近身1.3米垫真放假","正常收拍后亲手补球"],"提前准备、实际跑到位；接引不取消收拍，观察真球后重新按键补拍。"],
    shuizhong:["curve",["准备下一拍水月","过网后主动换线","原线路留下假球"],"前深后浅，点按选空当；读到对手站位后，在其近身前变线。"],
    jiezou:["teacher",["隐身留下幻象","幻象追球 · 本体跑位","击球显形"],"用幻象协防、本体跑位；击球会显形，想清楚什么时候现身。"],
    biaozhi:["trap",["选择前后位置","标志桶挡路","调动打空当"],"把桶放在对手的跑动线路上，逼他绕行或起跳；桶只挡地面。"],
    tingyixia:["tactics",["点按准备","过网读站位","压前挑后 · 守后放前"],"先让对手暴露重心，再让过网后的长短迫他折返；两次轻巧回球用完就结束。"],
    jibei:["platform",["升起骨台","站上高台","高点回击或展翼"],"先占高点再选择高远或进攻；高台固定，记得及时下来防低球。"],
    yimo:["jump",["展翼猎航","追球调整高度","两次回球后收翼"],"把有限的时间用在救险或抢高点；收翼前先回位。"],
    weichui:["power",["准备骨尾","手动回球","骨尾接续"],"腾空下压更强，也可以上挑转守为攻；先手动击球才接尾击。"],
    dianbu:["miaoStep",["第一段滑行积旋","第二段换向手动接球","流转后返还一段"],"尽量留一段用于回位；滑步自己不接球，要在合适触球位置按击球键，流转才会返还。"],
    bianpai:["miaoCurve",["准备两拍长短模式","位移积旋 · 精准触球","青金双燕过网变线"],"普通燕尾也能稳定变线；要打出流转，需2层旋力配合位移窗口或顶点，或攒满3层再精准接球。"],
    jieli_jump:["miaoJump",["地面转体或空中补起","顶点手动接球","再按选方向俯冲"],"普通跳跃后可用转体补起；已经用转体起跳，就把第二次按键留给俯冲，不能再次补起。"],
    tongqin:["buff",["准备两次回球","手动选进攻或吊球","进攻借速或吊球压短"],"看对手位置自己选击球键：想反攻用进攻键，想压短用吊球；不会按来球类型自动替你选。"],
    gongwei:["power",["折成纸镖","手动回球","低阻穿越"],"用平快球压缩对手反应时间，再调动另一侧；纸镖仍受物理和球网判定。"],
    jiaban:["glide",["折纸准备","过网展翼滑行","收翼下坠"],"保留长短选择，用展翼和收翼的节奏骗对手提前起拍；不改变击球类别。"],
    sanbu:["freeze",["布置慢镜","网前取景减速","追到球后回击"],"借减速多看一眼，但来球不会停；追到球后要自己完成回击。"],
    yipai:["curve",["选择近或深落点","手动回击对手球","保持球类并调整落点"],"准备阶段先选近或深，看到对手提前跑位可再切换；不用重新记一条旧轨迹。"],
    jingmo:["power",["准备快进","正常速度起飞","沿原路加速"],"和慢镜或复映连用，做先慢后快的节奏差；球沿原路加速，不会瞬移。"],
    feibai:["hide",["先打出球","短暂隐去","近身或低位显形"],"和回眸假球叠加，用短暂丢失球路的画面争取站位；靠近对手会显形。"],
    liubai:["step",["侧身留香影","手动回球","反向假球飞出"],"先用侧滑调整触球点，再用反向假球扰动对手；真球仍正常计分。"],
    luokuan:["curve",["选择压线或贴网","手动触球","达到质量后校准"],"站稳提高质量再压线；普通回球会多耗体力，别疲劳时连续用。"],
    ouzhou:["step",["切入抢接球点","换向二段突破","手动精准出手"],"每段都准备一次突破回球；先接球兑现，再用剩余步数回位。"],
    gongdan:["board",["预测来球布篮板","托高并获得补拍强化","自己起跳加速进攻"],"跟进篮板附近，利用更高的托球和补拍容错完成二次进攻。"],
    kongjie:["buff",["五秒进攻窗口","提前出手也强化","最后窗口压哨绝杀"],"先确保接到球，能等到压哨则争取更强加速和险线校准。"],
    lingxin:["power",["准备并手动回球","对手接球额外耗体力","后续两拍更慢更弱"],"过载命中后继续打前后空当，让对手带着负担再接球；装置和反压能减轻它的作用。"],
    kuorong:["fog",["高于雾线隐藏出球","再按下沉一次","低于雾线重新显形"],"打高球利用雾线遮挡；有缓存时再下沉可保住剩余时间，不会让所有高度的球都消失。"],
    rongzai:["buff",["结束收招与净化","准备反压","手动接球反击"],"接重球后及时反压，清掉收招和负面状态；下一拍仍要手动接球。"],
  };
  const passives = {
    kejian:['成功完成一招','10秒内完成不同招式','回复与快速收拍'],
    yihan:['极限救球','失败留下脚印','下一分拾取补能'], dishui:['完成回球','水滴留场','拾取回复体力'],
    biaochi:['完美或两次稳定回球','校准回能与体力','强化任一主动技能'], hudie:['到位手动搓放','贴网落点约0.95米','织结回能再抢拍'],
    zheteng:['完成一招 · 回能回体','8秒内换另一招','旺火 · 强化下一拍'], yekong:['手动回球','累计两次','额外回复能量'],
    jixie:['装置命中球','进入3秒过载','收招再按回收'], liansha:['连续得分','连胜奖励增加','被终结时对手得能量'],
    rizhi:['记录挥空原因','接回两类来球或记录球路','获得编译标记'], qiandao:['记录对手3次击球位置','同区出现2次','形成习惯区'],
    jihui:['开局500金币','回球与得失分','装备随资产升级'], canying:['快速跑位至少0.8米','急停转向 · 间隔1.8秒','亲手接球兑现折影'],
    kandong:['手动长短球交替','积满2层布局','下一拍轻巧回球精准'], shihua:['手动回球记录高度','集齐低/中/高','回复体力与能量'],
    dingzhou:['移动 / 位移积旋（最多3层）','窗口内精准手动回球','流转 · 快收 / 回复 / 追击'], gongxiu:['手动接回对手球','选择进攻借速或吊短','收拍更快并回体力'],
    lvyue:['切换短球/进攻/深球','积1格底片','镜头回球回复'], moyun:['累计2次完美击球','球拍滴墨预告','对手触球爆墨'],
    qiuyou:['两种花式或三次回球','回能回体蓄热手','下一招强化'], guance:['接回高点或高速球','积1格缓存','用于迷雾下沉或反压'],
  };
  const types = {schoolRoll:'网底变线',schoolVisit:'越界抢拍',schoolSeat:'延迟调位',miaoStep:'空地追击',miaoCurve:'流转变线',miaoJump:'腾空俯冲',teacher:'隐身协防',tactics:'落点设局',ice:'地面控场', dive:'救险位移', jump:'空中机动', step:'步法变化', swing:'空中机动', wind:'球路干预', pool:'守场续球', resource:'资源运营', reverse:'节奏控制', board:'场上装置', toss:'接力起手', buff:'回球强化', hold:'持球变化', curve:'长短变线', bounce:'弹射球路', orbit:'旋转拦截', warp:'空间转移', gravity:'飞行控制', racket:'范围拦截', summon:'区域防守', clone:'分身接力', fake:'真假干扰', mark:'球路改写', trap:'走位限制', power:'进攻强化', platform:'高点控制', glide:'节奏变化', hide:'视野干扰', fog:'视野干扰', freeze:'时间控制', passive:'角色被动' };
  const roles = {
    pupil:'技巧',
    lingfeng:'灵动', canglan:'控场', xiaohong:'控场', ranran:'控场', ruibao:'技巧', xingxing:'控场', dingding:'技巧', houzi:'灵动', lu:'技巧', laochen:'控场', guoge:'强攻', tianchu:'技巧', zhu:'控场', dong:'强攻', miaomiao:'灵动', mage:'强攻', nan:'技巧', bobo:'技巧', sun:'强攻', zhuzhu:'控场',
  };
  Y.characterRole = id => roles[id] || '技巧';
  const conditions = {
    dixia:'回合中先准备；仅己方半场不超过1.9米的手动接球触发，发球、装置和串门抢拍不触发。',chuanmen:'回合中，己方距网2.2米内落地站稳；串门后必须等对手新触球才能抢。',huanzuo:'回合中，不能同时重复调位；对手串门时不能调位。',
    yuyue:'回合中，落地后使用。', tafeng:'回合中，已在空中；每次起跳只能踏风一次。',
    diban:'回合中可提前准备；直接砸球要求己方拍前真实来球。', zipao:'回合中可提前准备4秒；靠近已过网的对方非发球来球，拍前1.7米内自动垫起一次。',
    huiguo:'回合中可提前准备；回收须仍为己方出球且未进入对手截击范围。', huichao:'来球已过网进入己方，且已留下足够飞行轨迹。',
    meida:'回合中提前准备；0.18秒后可自动接引一次过网来球，须进入本体拍前1.3米。', tingyixia:'回合中先准备；手动接回对手的来球才消耗次数。', jiezou:'回合中、落地后使用；隐身持续期间不能重复开启。',
    jingxiang:'回合中准备两拍；再按免费重选下一拍，过网后不可用镜像突改当前真球。', shuizhong:'可提前准备，出球过网后再按；对手1.6米拍前范围内、低于0.8米或落地不足0.25秒时不能变线。',
    jieli:'来球在本体或复制体身边，且未被控制。', jiewang:'无需蝴蝶结；有结自动消耗一个强化。守在网前与覆盖球道内才会截流。',
    tangqiu:'回合中落地使用；第一段后3秒内可以免费换向第二段，不消耗蝴蝶结。', dianbu:'回合中空中或地面均可使用；每段运动结束后可接下一段，受控倒地时不能发动。',
    jieli_jump:'回合中可地面起跳或空中补起；一轮腾空只可转体一次，起势0.16秒后可二段俯冲。', yimo:'回合中，可以起跳，且未持有被控制的球。',
    liubai:'回合中，落地站稳；不能趴地或被固定时使用。', ouzhou:'回合中，落地站稳；两段分别读取移动方向。',
    rongzai:'回合中，已恢复站姿且未被固定；可在收招期间使用。',
    ganggan:'发球前或回合中均可押注，本分只能一次。', jiepan:'回合中，至少 60 金币，且场上没有未捡完的红包。',
    qiquan:'回合中，至少 50 金币，且未准备金砖球。',
  };
  Y.skillGuide = function (id, mode = '2d') {
    const sk = Y.skillDescription(id, mode); if (!sk) return null;
    const owner = Y.CHARS.find(c => c.passive === id || c.acts.includes(id));
    const row = lessons[id], type = sk.passive ? 'passive' : row?.[0];
    const help=sk.help;
    const operation=mode==='3d'?help.operation3d:help.operation;
    const summary=mode==='3d'?help.effect3d:help.effect;
    const desc=Y.plainText(summary),durations=[...desc.matchAll(/(?:\d+(?:\.\d+)?秒|\d+次|\d+拍)/g)].map(m=>m[0]);
    const condition=sk.passive?'无需按键；按上述条件自动触发。':conditions[id]||'回合中使用，须有足够能量；重复施放限制见下方。';
    const limits=help.limits;
    const sustained=new Set(['zipao','dixia','diban','huiguo','baozi','fengkou','chaolai','tongyin','fanshe','pingyi','tangqiu','jiewang','xingmen','yueliang','zhongli','haomao','fuzhi','zangshu','yati','yueqiu','shuangji','jiepan','qiquan','jiezou','biaozhi','tingyixia','jibei','yimo','weichui','dianbu','bianpai','tongqin','gongwei','jiaban','sanbu','yipai','jingmo','feibai','liubai','luokuan','ouzhou','gongdan','kongjie','lingxin','kuorong','rongzai','jingxiang','meida','shuizhong']);
    return {
      id, owner:owner?.id, mode, category:types[type], type, summary, operation,condition,limits,
      steps:sk.passive ? passives[id] : row?.[1],
      tactic:sk.passive ? help.operation : row?.[2],
      performance:[['能量消耗', sk.passive ? '无需能量 · 不占主动槽位' : sk.cost + ' / 共用 100 能量'], ['释放条件',condition], ['时间 / 次数', [...new Set(durations)].join(' · ') || '条件触发，详见技能效果'], ['边界与代价',limits], ['词语说明','手动回球＝自己按高远、吊球或扣杀键击中球；完美回球＝质量至少85%。收拍＝击球后恢复到能再次挥拍的过程。'],...(sustained.has(id)?[['分间保留','未用完的准备或场上装置保留剩余时间、次数，发球准备时暂停；正在进行的位移和本球飞行随本分结束。']]:[])],
    };
  };

  // 按教学脚本绘制关键阶段。图为机制示意，距离、速度与范围不按比例。
  Y.drawSkillGuidePreview = function (g, id, mode, x, y, w, h, time, theme) {
    const info = Y.skillGuide(id, mode), sk = Y.SKILLS[id]; if (!info) return;
    const color = sk.color, u = (time % 6) / 6, stage = Math.min(2, Math.floor(u * 3)), v = (u * 3) % 1, kind = info.type;
    const space = mode === '3d', scale = Math.min(w / 13.8, h / 4.2), cx = x + w * .5, floor = y + h * .85;
    const pt = (a,b,z=0) => space ? [cx + z * scale * 1.45 + a * scale * .43, floor - (a + 6) * scale * .16 - b * scale * .8] : [cx + a * scale, floor - b * scale];
    const path = (pts, c = color, dashed = false) => { g.beginPath(); pts.forEach((p,i)=>{const q=pt(...p);i?g.lineTo(...q):g.moveTo(...q);});g.strokeStyle=c;g.lineWidth=2;g.setLineDash(dashed?[4,4]:[]);g.stroke();g.setLineDash([]); };
    const ring = (a,b,z=0,r=12) => { const p=pt(a,b,z);g.beginPath();g.ellipse(p[0],p[1],r,space?r*.45:r,0,0,TAU);g.strokeStyle=color;g.lineWidth=2;g.stroke(); };
    const ball = (a,b,z=0,alpha=1) => {const p=pt(a,b,z);g.save();g.globalAlpha=alpha;g.fillStyle='#fff5ce';g.shadowColor=color;g.shadowBlur=8;g.beginPath();g.arc(...p,3.5,0,TAU);g.fill();g.restore();};
    g.save();g.beginPath();g.rect(x,y,w,h);g.clip();
    const bg=g.createLinearGradient(x,y,x+w,y+h);bg.addColorStop(0,theme?.panelBot||'#142d3a');bg.addColorStop(1,theme?.bg||'#081321');g.fillStyle=bg;g.fillRect(x,y,w,h);
    if(space){path([[-6,0,-2.6],[6,0,-2.6],[6,0,2.6],[-6,0,2.6],[-6,0,-2.6]],'#527a83');for(const a of[-3,0,3])path([[a,0,-2.6],[a,0,2.6]],'#527a8366');path([[0,0,-2.6],[0,1.55,-2.6],[0,1.55,2.6],[0,0,2.6]],'#c5d8d5');}
    else{path([[-6.5,0],[6.5,0]],'#719c9b');path([[0,0],[0,1.55]],'#d3e8dc');for(let a=-6;a<=6;a+=3)path([[a,0],[a,-.09]],'#719c9b');}
    let actorX=-3,actorY=0;
    if(['step','dive','swing','miaoStep'].includes(kind)) actorX += stage===0?v*1.7:stage===1?1.7:1.7*(1-v);
    if(['jump','swing','dive','miaoJump'].includes(kind))actorY=Math.sin(u*Math.PI)*(['dive'].includes(kind)?.35:1.35);
    if(kind==='miaoJump'){actorY=stage===0?v*1.6:stage===1?1.6:1.6*(1-v);actorX=-3+(stage===2?v*1.6:0);}
    if(['jiewang','hudie','hongxian'].includes(id))actorX=-1.6;
    if(kind==='platform')actorY=stage?1:.8*v;
    if(kind==='clone')actorX=stage===0?-3:-3+Math.min(1,(stage-1+v))*1.8;
    const drawActor=(a,b,z,owner,opacity=1)=>{const p=pt(a,b,z);g.save();g.globalAlpha=opacity;g.translate(...p);g.scale(scale*.98,-scale*.98);const moving=owner&&['step','dive','swing','miaoStep'].includes(kind),turn=id==='jieli_jump'?{turnAngle:TAU*u,turnPose:Math.sin(Math.PI*u)}:{};const fake={idx:0,dir:owner?1:-1,x:a,y:b,z,vx:moving?3:0,vy:0,onGround:b===0,runPhase:time*4,stamina:100,cnt:{nv:turn},buff:{},motion:{air:b,speed:moving?3:0,land:0,split:0}};Y.drawCharacter(g,fake,Y.lookOf(owner?info.owner:'canglan'),{time,mood:'play',action:owner&&!sk.passive?Y.CharacterArt?.action(id,(stage===0?v*.3:stage===1?.3+v*.2:.5+v*.119)):null});g.restore();};
    if(!['teacher','schoolVisit'].includes(kind))drawActor(actorX,actorY,space?-.65:0,true);
    if(kind!=='schoolSeat')drawActor(3,0,space?.65:0,false);
    const t=stage===0?v*.28:stage===1?.28+v*.42:.7+v*.3;
    const lineBall=(reverse=false,high=1.8)=>{const f=reverse?1-t:t;path([[-2.5,1.3],[0,1.3+high],[4,0]],color+'55',true);ball(-2.5+6.5*f,1.3*(1-f)+Math.sin(f*Math.PI)*high,space?-.65+f*1.3:0);};
    if(['diban','huiguo','baozi'].includes(id)){
      const lane=space?-.65:0,near=1.15,deep=5.7;
      if(id==='diban'){
        path([[-5.6,0,lane],[-5.6,3.5,lane],[-.6,3.5,lane]],color+'99');
        if(stage<2){const pts=[[-2.4,1.8,lane],[-3.5,.08,lane],[-5.6,2.7,lane],[-3.1,3.5,lane]],q=stage===0?v:v*2+1,i=Math.min(2,Math.floor(q)),f=q-i;path(pts,color+'77',true);ball(pts[i][0]+(pts[i+1][0]-pts[i][0])*f,pts[i][1]+(pts[i+1][1]-pts[i][1])*f,lane);}
        else{for(const [end,z]of[[near,space?1.2:0],[deep,space?-1.2:0]]){path([[-3.1,2.7,lane],[0,2.5],[end,.06,z]],color+'88',true);ring(end,.05,z,8);}const end=v<.5?near:deep,f=(v%.5)*2;ball(-3.1+(end+3.1)*f,2.7*(1-f)+Math.sin(f*Math.PI)*.6,lane*(1-f));}
      }else if(id==='huiguo'){
        const pts=stage===0?[[-2.4,1.9,lane],[0,3],[3,2.2]]:stage===1?[[3,2.2],[0,4],[-2.8,2.7,lane]]:[[-2.8,2.7,lane],[0,2.1],[deep,.08,space?1.2:0]];
        path(pts,color+'99',true);const f=v,xx=(1-f)*(1-f)*pts[0][0]+2*(1-f)*f*pts[1][0]+f*f*pts[2][0],yy=(1-f)*(1-f)*pts[0][1]+2*(1-f)*f*pts[1][1]+f*f*pts[2][1];ball(xx,yy,lane);
        if(stage===1){const q=pt(xx,yy,lane);g.save();g.translate(...q);Y.SkillFX?.bunBody(g,8);g.restore();}if(stage===2)ring(-3,1.4,lane,18+v*9);
      }else{
        const f=stage===0?v*.25:stage===1?.25+v*.3:.55+v*.45,xx=-2.4+8*f,yy=1.8*(1-f)+Math.sin(f*Math.PI)*1.1;
        path([[-2.4,1.8,lane],[0,2.4],[deep,0]],color+'77',true);ball(xx,yy,lane);
        if(stage<2){const q=pt(xx,yy,lane);g.save();g.translate(...q);Y.SkillFX?.bunBody(g,stage===0?7:10);g.restore();}
        else{for(const end of[near,deep])ring(end,.05,0,9);path([[0,2.4],[near,.05]],color+'99',true);}
      }
    }
    else if(kind==='schoolRoll'){
      path([[-3,.14],[0,.14],[4.8,.14]],color+'77',true);
      const end=stage===2?4.8:1.1;
      if(stage===0)ball(-3+v*2,1.4*(1-v)+.14);
      else if(stage===1)ball(-1+v*2.1,.14);
      else{ring(end,.05,0,12);ball(end,.14+Math.sin(v*Math.PI)*1.65);}
      for(const d of [1.1,4.8])ring(d,.05,0,8);
    }
    else if(kind==='schoolVisit'){
      const ax=stage===0?-1.8+v*3:stage===1?1.2:1.2-v*2.3;
      drawActor(ax,0,space?.5:0,true,1);path([[-1.8,.1],[1.2,.1]],color+'88',true);
      if(stage===1){path([[4,1.9],[1.6,1.5]],color+'99');ball(4-v*2.4,1.9-v*.4,space?.5:0);}
      if(stage===2)ball(1.6+v*3,1.5+Math.sin(v*Math.PI)*.4);
    }
    else if(kind==='schoolSeat'){
      const from=1.5,to=5.3;ring(from,.04,0,16);ring(to,.04,space?1.5:0,16);
      path([[from,.06],[to,.06,space?1.5:0]],color+'99',true);
      drawActor(stage===2?from+(to-from)*v:from,stage===1?Math.sin(v*Math.PI)*.65:0,stage===2&&space?v*1.5:0,false,1);
      const q=pt(3.4,2.9);g.fillStyle=color;g.font='800 11px '+Y.FONT;g.textAlign='center';g.fillText(stage===0?'0.65s 旧座位 → 新座位':stage===1?'起跳 / 离开旧框可躲':'留在框内 → 换座位',...q);
    }
    else if(['miaoStep','miaoJump','miaoCurve'].includes(kind)){
      const near=stage===2,end=near?1.15:5.5;
      for(let i=0;i<3;i++)ring(actorX-.28*i,actorY+.25,0,7+i*5);
      if(kind==='miaoCurve'||stage===2){path([[-2.5,2.2],[0,2.6],[end,.05]],color+'99',true);const f=v;ball(-2.5+(end+2.5)*f,2.2*(1-f)+Math.sin(f*Math.PI)*1.1);}
      const q=pt(actorX,actorY+2.6);g.fillStyle=stage===2?'#ffdc87':color;g.font='800 11px '+Y.FONT;g.textAlign='center';g.fillText(stage===2?'流转 · 青金双燕':'积旋 ●●○ · 手动接球',...q);
    }
    else if(kind==='teacher'){
      const body=stage===0?-3:stage===1?-4.7+v*1.5:-2.3,echo=stage===0?-3:stage===1?-2.5-v*1.1:-3.6;
      drawActor(body,0,space?-.95:0,true,stage===0?1-v*.73:stage===1?.22:1);
      if(stage>0||v>.25)drawActor(echo,0,space?.65:0,true,.64);
      path([[-3,.15],[body,.15,space?-.95:0]],color+'77',true);
      if(stage===1){path([[3,1.8],[0,2.2],[echo+.4,1.4]],color+'55',true);ball(3-(3-echo-.4)*v,1.8+Math.sin(v*Math.PI)*.5,space?.65:0);}
      if(stage===2){path([[body+.4,1.5],[0,2.1],[1.1,.05]],color);ball(body+.4+(1.1-body-.4)*v,1.5*(1-v)+Math.sin(v*Math.PI)*.9,space?-.8+v*.4:0);}
      const q=pt(body,2.8);g.fillStyle=color;g.font='800 11px '+Y.FONT;g.textAlign='center';g.fillText(stage===0?'6s 虚实展开':stage===1?'本体隐身自由跑位':'击球 / 起跳 → 显形',...q);
    }
    else if(kind==='tactics'||id==='kandong'){
      const deep=stage===1,end=deep?5.65:1.05;
      for(const d of[1.05,5.65])ring(d,.03,space?d<2?1:-1:0,9);
      path([[-2.5,1.4],[0,2.6],[end,.05,space?deep?-1:1:0]],color+'99',true);
      const f=stage===0?v*.45:stage===1?v: .45+v*.55;
      ball(-2.5+(end+2.5)*f,1.4*(1-f)+Math.sin(f*Math.PI)*1.8,space?-.65+f*(deep?-.35:1.65):0);
      if(stage===2)ring(-3,1.35,0,18+v*8);
      const q=pt(2.9,2.9);g.fillStyle=color;g.font='800 11px '+Y.FONT;g.textAlign='center';g.fillText(id==='kandong'?['长 → 短：布局 1/2','短 → 长：布局 2/2','精准下一拍 · +6能量 +5体力'][stage]:['手动回球 ×2','对手压前 → 挑后场','对手守后 → 放网前'][stage],...q);
    }
    else if(kind==='ice'){
      Y.SkillFX?.icePatch(g,{x:3,y:.03,z:0,half:1.4,width:1.05,t:10,age:stage===0?v*.35:.5,warm:.35},pt,time,1);
      const dx=stage===1?Math.sin(v*Math.PI)*1.2:stage===2?-1.0+v*2:0;
      if(stage>0){const a=pt(3+dx,.04,0),b=pt(3+dx-.7,.04,.15);g.strokeStyle='#efffff';g.lineWidth=2;g.beginPath();g.moveTo(...a);g.lineTo(...b);g.stroke();drawActor(3+dx,0,space?.2:0,false);}
      const q=pt(3,2.8);g.font='800 12px '+Y.FONT;g.fillStyle=color;g.textAlign='center';g.fillText(stage===0?'0.35s 结冰':stage===1?'急停 · 惯性滑行':'跳过 / 绕行',...q);
    }
    else if(id==='yati'){
      const q=pt(3,2.9,space?.65:0);Y.SkillFX?.rewriteTag(g,{mode:stage===2?1:0,n:stage===0?2:stage===1?1:0,age:1},...q,.9);
      const end=stage===2?-1.3:-4.7;path([[3,1.7],[0,stage===2?1.8:3.4],[end,.1]],color+'77');ball(3+(end-3)*v,1.7*(1-v)+Math.sin(v*Math.PI)*(stage===2?.5:2),space?.65-v*1.3:0);
    }
    else if(['tongqin','gongwei','jiaban'].includes(id)){
      path([[-2.5,1.4],[0,2.2],[4.5,.1]],color+'55',true);
      const xx=-2.5+7*t,yy=1.4*(1-t)+Math.sin(t*Math.PI)*(id==='gongwei'?.7:1.7),q=pt(xx,yy,space?-.65+t*1.3:0);
      if(id==='tongqin'){ball(xx,yy);const a=pt(-2.4,1.7);Y.SkillFX?.officeSeal(g,...a,1,stage===1?v*.55:.15,false);}
      else {const paper={dir:1,dart:id==='gongwei',glide:id==='jiaban',foldAt:2.8},state=Y.paperAero(xx,paper);Y.SkillFX?.paperBody(g,...q,-.18,4.6,state,{paper,office:id==='gongwei'?Y.OFFICE_FLIGHT.dart:Y.OFFICE_FLIGHT.glide});}
    }
    else if(['hudie','tangqiu','hongxian'].includes(id)){
      const z=space?-.65:0,near=id==='hudie'?.95:id==='tangqiu'?.7:.75;
      if(id==='tangqiu'&&stage!==1){path([[-3,.12,z],[-1.3,.12,z]],color+'88',true);Y.CharacterArt?.butterfly(g,...pt(actorX,.2,z),7,time);}
      else if(stage===0){path([[2,2.1,z],[-.9,1.8,z]],color+'88',true);ball(2-2.9*v,2.1-.3*v,z);if(id==='hongxian')path([[-1.6,1.4,z],[-1.6+.7*v,1.4+.4*v,z]],color);}
      else if(id==='hongxian'&&stage===1){path([[-1.6,1.4,z],[-.9,1.8,z]],color);ball(-.9,1.8+Math.sin(time*4)*.04,z);ring(-.9,1.8,z,12);}
      else{
        const deep=id==='hongxian'&&v>.5,f=id==='hongxian'?(v%.5)*2:v,end=deep?6.15:near;
        const points=[[-.9,1.8,z],[0,deep?3.2:1.72,z],[end,.065,z]],u=f<.48?f/.48:(f-.48)/.52,a=f<.48?points[0]:points[1],b=f<.48?points[1]:points[2];
        path(points,color);ball(a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,z);ring(end,.065,z,8);
      }
      const q=pt(.8,3.1);g.fillStyle=color;g.font='800 11px '+Y.FONT;g.textAlign='center';
      g.fillText(id==='hudie'?['到位手动接球','搓放约0.95m · 低球抬弧','织结回能 · 快收再抢拍'][stage]:id==='tangqiu'?['穿花抢网','接续细搓约0.70m','三秒内免费折返'][stage]:['丝带实际触球','持球1.25s · 可亲手回击','后浅约0.75m / 前深至底线'][stage],...q);
    }
    else if(kind==='passive'||kind==='resource'){for(let i=0;i<3;i++){const p=pt(-4+i*.65,2.65);g.fillStyle=stage>=i?color:'#47616d';g.fillRect(p[0]-6,p[1]-4,12,8);}if(stage===2)ring(-3,1,0,20+v*12);lineBall();}
    else if(id==='jingxiang'){
      const f=stage===0?.12:stage===1?.12+v*.35:.47+v*.35;
      for(let i=0;i<3;i++){
        const depth=[1.35,3.5,5.6][i],z=space?(i-1)*2:0;
        // Identical styling: only the advance along the arc differs.
        const progress=i===1?f:stage===2?(.47+Math.max(0,v-.3)*.5):stage===1?(.12+v*.12):f;
        path([[-2.4,1.4,0],[0,2.6,z*.4],[depth,0,z]],'#c3e9f255',true);
        ball(-2.4+(depth+2.4)*progress,1.4*(1-progress)+Math.sin(progress*Math.PI)*1.5,z*progress);
      }
      const q=pt(0,3.5);g.fillStyle='#c3e9f2';g.font='12px '+Y.FONT;g.textAlign='center';
      g.fillText(stage===0?'前深 / 后浅 · 3D左右选道':stage===1?'观察突然滞速与悬停':'追落有速度突变 · 正常弧线连续',...q);
    }
    else if(kind==='fake'||kind==='hide'){for(let i=0;i<(kind==='fake'?id==='jingxiang'?3:2:1);i++){const f=t,z=space?(i-1)*1.2:0;path([[-2.4,1.4],[0,2.7-i*.4],[3+i*.7,0]],color+'55',true);ball(-2.4+(5.4+i*.7)*f,1.4*(1-f)+Math.sin(f*Math.PI)*(1.3-i*.4),z,kind==='hide'&&stage===1?.1:1);}}
    else if(kind==='clone'||kind==='summon'){const a=id==='fuzhi'?-3:-4.8;drawActor(a,0,space?1.2:0,true,.4+.2*Math.sin(time*3));ring(a,.1,space?1.2:0,20);if(id==='yueqiu')path([[-6,.1],[-3.2,.1],[-3.2,2.5]],color+'77',true);lineBall();}
    else if(id==='xuanpai'){const a=time*3,px=-3+Math.cos(a)*1.2,py=1.2+Math.sin(a)*.7;path([[px,py],[-6-px,2.4-py]],color);ring(px,py,0,10);ring(-6-px,2.4-py,0,10);lineBall();}
    else if(kind==='hold'||kind==='orbit'){ring(-1.6,1.4,0,22);if(id==='yueliang'){const p=pt(-1.6,1.4);g.fillStyle=color+'55';g.beginPath();g.arc(...p,16,0,TAU);g.fill();}if(stage===1)ball(-1.6+Math.cos(time*4)*.6,1.4+Math.sin(time*4)*.6);else lineBall();path([[-3,1.2],[-1.6,1.4]],color);}
    else if(kind==='reverse'){lineBall(stage===1);path([[-1,2.5],[-2,2.8],[-2.5,2.4]],color);}
    else if(kind==='platform'){path([[-4.2,0],[-4.2,actorY],[-1.8,actorY],[-1.8,0]],color);path([[-4.5,actorY],[-1.5,actorY]],color);lineBall();}
    else if(kind==='racket'){const a=-3+(stage===2?1-v:stage===0?v:1)*2.3;path([[-3,1],[a,1.65]],color);ring(a,1.65,0,14);lineBall();}
    else if(kind==='board'){const a=-3.7;path([[a,.15],[a+.7,1.8]],color);if(id==='gongdan')path([[a-.1,1.7],[a+1,1.7],[a+1,2.4],[a-.1,2.4],[a-.1,1.7]],color);ring(a,.2,0,18);lineBall();}
    else if(kind==='pool'){const p=pt(-6,0),q=pt(-.3,0);g.fillStyle=color+'44';g.fillRect(Math.min(p[0],q[0]),p[1]-8,Math.abs(q[0]-p[0]),12);ball(-3,stage===1?Math.sin(v*Math.PI)*1.8:.4);path([[-3,.1],[-3,1.9]],color+'88',true);}
    else if(kind==='fog'){const lo=pt(.4,stage===2?1.95:2.6),hi=pt(6,4.5);g.fillStyle=color+'44';g.fillRect(lo[0],hi[1],hi[0]-lo[0],lo[1]-hi[1]);path([[.4,stage===2?1.95:2.6],[6,stage===2?1.95:2.6]],color+'88',true);lineBall();}
    else if(kind==='trap'||kind==='mark'){for(let i=0;i<3;i++){const p=pt(1.4+i*1.4,kind==='mark'?1.9:.2);g.fillStyle=color+'aa';g.fillRect(p[0]-12,p[1]-9,24,18);}lineBall();}
    else if(kind==='freeze'){path([[-.8,.3],[-.8,2.5],[.1,2.5],[.1,.3]],color+'88');if(stage===1){ring(-.4,1.8,0,16);ball(-.4,1.8);}else lineBall();}
    else if(kind==='bounce'){const pts=[[-3,1.4],[-4.5,0],[-5.8,2.8],[-3,3.5],[4,0]];path(pts,color+'88');const seg=Math.min(3,Math.floor(u*4)),f=u*4-seg,a=pts[seg],b=pts[seg+1];ball(a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f);}
    else if(kind==='warp'){ring(-1,1.8,0,19);ring(3,1.5,0,19);if(stage===0)ball(-3+v*2,1.5);if(stage===1)ring(3,1.5,0,23+v*7);if(stage===2)ball(3+v*1.5,1.5*(1-v));}
    else if(kind==='gravity'){path([[-2,1],[0,3],[2,1]],color+'77',true);ball(-2+t*4,1+Math.sin(t*Math.PI)*2);}
    else if(kind==='wind'){for(let i=0;i<3;i++)path([[-1,.5+i*.4],[.6,.8+i*.4],[1.4,.7+i*.4]],color+'88');lineBall();}
    else if(id==='zipao'){
      const z=space?-.65:0;path([[-2.5,1.2,z],[-2.5,3.3,z],[3.5,.1,z]],color+'77',true);
      if(stage===0){ring(-2.5,1.2,z,21);ball(2-v*4.5,1.5,z);}
      else if(stage===1)ball(-2.5,1.5+Math.sin(v*Math.PI*.8)*1.8,z);
      else{ball(-2.5+v*6,2.7*(1-v),z);ring(-2.5,2.7,z,10);}
      const q=pt(1,3.8);g.fillStyle=color;g.font='700 11px '+Y.FONT;g.textAlign='center';g.fillText(['4秒准备 · 到位接球','自抛腾拍 · 自己选择进攻','亲手补拍88% / 校准95%'][stage],...q);
    }
    else if(kind==='toss'){path([[-2.6,1],[-2.2,3],[-1.8,1.8]],color+'88',true);ball(-2.6+t*.8,1+Math.sin(t*Math.PI)*2);}
    else if(id==='jiewang'){
      const z=space?-.65:0;path([[-.25,.04,z-1.15],[-2.8,.04,z-1.15],[-2.8,.04,z+1.15],[-.25,.04,z+1.15],[-.25,.04,z-1.15]],color+'99');
      path([[-.55,1.55,z-1.15],[-.55,2.65,z-1.15],[-.55,2.65,z+1.15],[-.55,1.55,z+1.15]],color+'99',true);
      if(stage===0){for(const dz of[-1.15,1.15])Y.CharacterArt?.butterfly(g,...pt(-.55,1.55,z+dz),7,time);}
      else if(stage===1){const f=v<.5?v*2:1;path([[2,2.2,z],[-.55,1.8,z],[-1.2,2.4,z]],color+'66',true);ball(v<.5?2-2.55*f:-.55-(v-.5)*1.3,v<.5?2.2-.4*f:1.8+Math.sin((v-.5)*Math.PI)*.6,z);}
      else{const deep=v>.5,f=(v%.5)*2,end=deep?6.15:.65;path([[-1.1,1.9,z],[0,2.1,z],[end,.05,z]],color);ball(-1.1+(end+1.1)*f,1.9*(1-f)+Math.sin(f*Math.PI)*(deep?2.2:.55),z);}
      const q=pt(1,3.3);g.font='800 11px '+Y.FONT;g.textAlign='center';g.fillStyle=color;g.fillText(['8s · 两拍一截 / 有结三拍两截','低球减速抬起 · 必须亲手回击','前推深 / 后推浅 · 高球边线可绕开'][stage],...q);
    }
    else if(kind==='curve'||kind==='glide'){path([[-2.5,1.4],[0,2.3],[4.8,0]],'#5b7e89',true);const near=['jiewang','shuizhong','luokuan'].includes(id),end=near?1.5:5.3;path([[-2.5,1.4],[0,2.5],[end,0]],color);ball(-2.5+(end+2.5)*t,1.4*(1-t)+Math.sin(t*Math.PI)*1.6);}
    else {if(kind==='buff'||kind==='power'||kind==='jump')ring(actorX,actorY+1,0,20+Math.sin(time*4)*3);lineBall(false,kind==='jump'?2.4:1.4);}
    // 被动各自的触发线索与道具，不以同一条通用球路代替。
    if(sk.passive){
      if(['yihan','dishui','hudie'].includes(id))for(let i=0;i<=stage;i++){
        const p=pt(-4.5+i*1.1,.12);
        if(id==='hudie')Y.CharacterArt?.butterfly(g,...pt(-.8+i*.8,1.55),9,time);
        else{g.fillStyle=color;g.beginPath();g.ellipse(p[0],p[1]-(id==='dishui'?7:0),id==='dishui'?4:7,id==='dishui'?7:3,-.35,0,TAU);g.fill();}
      }
      else if(id==='canying'){drawActor(-4.2+v*.7,0,0,true,.22);drawActor(-3.9+v*.7,0,0,true,.1);const q=pt(-3,2.8);g.fillStyle=color;g.font='700 12px '+Y.FONT;g.textAlign='center';g.fillText(stage===2?'折影兑现 · 稳准回球':stage===1?'折影 2/2':'折影 1/2',...q);}
      else if(id==='biaochi'){path([[-3,1.2],[1,3]],color+'aa',true);path([[-3,1.2],[1,.6]],color+'aa',true);ring(-3,1.2,0,24);const q=pt(1,3.5);g.fillStyle=color;g.font='700 11px '+Y.FONT;g.textAlign='center';g.fillText(['完美一拍 / 稳定两拍','校准 +3能量 / +5体力','反射多拦 / 自抛强化 / 辅助多一拍'][stage],...q);}
      else if(id==='moyun'){const p=pt(stage===2?2:-2,1.6);for(let i=0;i<9;i++){g.fillStyle='#111726';g.beginPath();g.arc(p[0]+Math.sin(i*2.3)*i*2,p[1]+Math.cos(i*2.3)*i*2,3+v*3,0,TAU);g.fill();}}
      else if(['rizhi','qiandao','lvyue','shihua','guance'].includes(id)){
        const p=pt(-5,2.1);g.fillStyle='#0a1728';g.fillRect(p[0]-12,p[1]-10,46,34);for(let i=0;i<3;i++){g.fillStyle=i<=stage?color:'#375464';g.fillRect(p[0]-6,p[1]-4+i*9,28,4);}
      }else if(id==='jihui'){const p=pt(-3,2.9);g.font='800 15px '+Y.NUMF;g.textAlign='center';g.fillStyle=color;g.fillText([500,600,900][stage]+' 金',...p);}
      else if(id==='dingzhou'||id==='yekong'||id==='jixie'){for(let i=0;i<3;i++)ring(-3+Math.cos(time+i)*.7,1+Math.sin(time+i)*.7,0,id==='jixie'?6:3);}
      else if(['zheteng','gongxiu','qiuyou','liansha'].includes(id)){const p=pt(-3,2.8);g.font='800 12px '+Y.FONT;g.textAlign='center';g.fillStyle=color;g.fillText(({zheteng:stage===2?'旺火 · 下一拍强化':'+6 能量 / +8 体力',gongxiu:'借力反击',qiuyou:'热手就绪',liansha:'连续得分'})[id],...p);}
    }
    if(id==='liubai'&&stage===2)ball(-2+v*6,1.5*(1-v)+Math.sin(v*Math.PI),space?1:0,.65);
    g.font='700 11px '+Y.FONT;g.textBaseline='top';g.textAlign='left';g.fillStyle=color;g.fillText('0'+(stage+1)+'  '+info.steps[stage],x+12,y+12);
    g.restore();
  };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof window !== 'undefined' ? window : globalThis);
