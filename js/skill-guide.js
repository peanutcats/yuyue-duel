/* 技能研习：只读教学数据与分步示意，不参与比赛判定。数值取当前技能说明。 */
(function (G) {
  'use strict';
  const Y = G.YY, TAU = Math.PI * 2;
  // 类型、操作、三个演示阶段、实战思路；每项主动技能都有独立脚本。
  const lessons = {
    yuyue: ["dive","按住移动方向点按技能扑向球；落地后还要按击球键完成回球。",["追向低球","飞扑救起","急坠后回位"],"被调到低点、够不到球时救险；扑空会趴地，救起后先回中场。"],
    tafeng: ["jump","先起跳，在空中按住方向点技能；再按击球键打出强化球。",["先起跳","空踏再跃","高点击球"],"把第二次起跳留给高球或快球；踏风只强化下一拍，仍要亲自挥拍。"],
    fengkou: ["wind","拖动选风道位置和方向，松手布置；自己跑过风道会加速。",["布置风道","首球转向","借风回位"],"把风道放在对手常打的线路上，同时借风加速回位；风道只改第一只球。"],
    chaolai: ["pool","点按在己方半场铺水；球被弹起后继续手动补拍。",["积水展开","首次落水弹起","补拍续球"],"被动时用积水弹起争取补拍；同一只球第二次落水就判分，别当救命符。"],
    tongyin: ["resource","点按比较体力：比对手低就吸取，否则省下扣杀体力。",["比较体力","吸取或省耗","保留进攻余力"],"体力落后时吸一口，体力领先时用它省扣杀消耗；满体力时别浪费。"],
    huichao: ["reverse","来球进入己方时点按倒流；再按同键让球原地落下。",["来球进入","沿轨迹倒流","二段放下"],"来球快、对手已启动时倒流，再用二段放下打乱节奏；注意二段时机。"],
    fanshe: ["board","拖动选位置和角度，松手放板；0.45 秒后自动拦球。",["放置反射板","准备后拦球","射向固定落区"],"提前把板放在对手常打的线路上；板有 0.45 秒延迟，别等球到才放。"],
    zipao: ["toss","来球到拍前时拖动技能选垫球方向与力度，松手垫起；随后手动进攻。",["拍前截球","自抛垫高","手动再进攻"],"把低位球垫成高点再进攻；垫起不等于得分，记得接下一拍。"],
    pingyi: ["buff","点按开启，接下来两次手动回球自动变稳。",["开启校准","两次稳定回球","站稳再落拍"],"接快球或疲劳时开启，用两次稳定回球度过难关；它不会替你挥拍。"],
    tangqiu: ["step","按住方向点按抢位；2.1 秒内再按可消耗蝴蝶结折返。",["穿花抢位","稳住下一拍","耗结折返"],"先用第一段抢位，再观察对手决定是否折返；折返会消耗蝴蝶结。"],
    hongxian: ["hold","来球靠近时拖动丝带牵住；再按同键压向网前，上拖挑后场，也可直接挥拍。",["牵住来球","观察站位","二段选长短"],"牵住球后先看对手站位，再决定放短还是挑长；持球只有一秒。"],
    jiewang: ["curve","网前回球留下蝴蝶结后点按；6 秒内下一拍过网后急坠或挑长，再按切换。",["消耗蝴蝶结","手动回球","过网急坠或挑长"],"网前回球积出蝴蝶结后再连招；高球过网不会触发，先确认高度。"],
    diban: ["bounce","可提前点按准备，或在来球到拍前时直接砸地；再按预选出锅，向前拖压短、向后拖打长。",["备锅 / 拍前砸地","反弹蓄力","再按出锅选长短"],"肉包入锅变成爆馅弹射；出锅后挂回锅，可收回再打一记旺火补拍。"],
    huiguo: ["reverse","提前准备或给己方出球挂回旋；对手触球前再按收回，接着用普通击球键补拍。",["下一拍挂回旋","收回保留馅料","旺火补拍 / 再包球"],"先用地板或肉包迫对手移动，再收回改变下一拍；肉包蓄力能带回并重新包球。"],
    baozi: ["hold","点按准备下一拍，近处来球会自动投包；拖动主动投包。自己回球后再按爆馅，向前拖压短、向后拖打长。",["上拍 / 投包减速","回球保留蓄力","爆馅选长短"],"慢球诱导走位后爆馅；可把蓄力送进地板弹射，或回锅保馅后再次发动。"],
    yueliang: ["orbit","拖动放月亮；球被捕获后，再按同键沿切线甩出。",["月亮捕球","绕月旋转","二段切线出球"],"把月亮放在对手常打的线路上，锁球后看准切线再甩；甩歪了要自己补拍。"],
    xingmen: ["warp","拖动选前场或后场出口，松手部署；之后回球或月亮出球会穿门。",["选定出口","球穿越星门","出口延迟后飞出"],"把出口和当前球路错开，用 0.35 秒停顿改变对手启动；仍要合法过网。"],
    zhongli: ["gravity","点按开启让球上飘；再按关闭，持续耗能。",["重力切换","球向上飘","关闭后下落"],"短暂托球给自己调整时间；持续耗能，关掉的时机决定下一拍节奏。"],
    shensuo: ["racket","拖动选方向伸长拍；球被拍头拦下后，再按扫击收回。",["拍头伸出","范围内拦球","扫回与回收"],"用长拍补覆盖范围，收招再按快速回收；拍头没收回时别急着开下一招。"],
    xuanpai: ["orbit","点按环扫；再拖动选方向扫击，命中后再按快速收回。",["绕身环扫","二段定向扫击","命中后回收"],"近身球用环扫，二段再定线路；过载时范围更大，但别把球扫回自己半场。"],
    youyou: ["hold","拖动投出飞轮；锁球后再按弹射，或等它把球带回拍前。",["飞轮截球","等待合齿窗口","弹射或带回"],"金色合齿窗口内弹射更稳；也可以留球等飞轮带回，再亲手打。"],
    jindou: ["jump","点按驾云升高，到高点后自己按击球键。",["驾云追高","短暂悬停","高点扣杀"],"给高球施压；悬停不会自动扣杀，观察来球再按击球键。"],
    dangteng: ["swing","拖动选方向荡起；再拖一次选跃出方向，空中可微调。",["选向荡起","二段跃出","空中接续"],"二段换向找空当，再决定接筋斗云还是强化回球；飞行中别飞过头。"],
    haomao: ["summon","拖动选位置召唤小猴；它准备后巡逻，替你拦一球。",["召唤与准备","巡逻拦一球","香蕉皮留场"],"让小猴守一条线路，本体去守另一侧；它准备后才拦球，且只拦一次。"],
    fuzhi: ["clone","点按放下复制体；本体继续跑位，复制体会同步挥拍。",["留下复制体","本体跑位","同步挥拍"],"先让复制体守一处，本体覆盖另一处；复制体只同步动作，不会自己追球。"],
    jieli: ["toss","来球在身边时拖动传球：上拖高传、平拖快传；再接应挥拍。",["垫向另一端","本体或复制体接应","手动完成接力"],"把复制体当接应点，做二打一；没有复制体时先自垫再进攻。"],
    zangshu: ["fake","点按放出脏数据球；复制体也会同步释放。",["放出脏数据","真假球并行","脏球落地乱弹"],"用假球干扰判断，但跑位仍围绕真球；假球不计分，别追着它跑。"],
    yati: ["mark","点按标记高球替换；向前拖改成网前球，松手确认。",["标记两拍","手动触球改写","按替换落区抢位"],"对手爱抢网就改成高球，爱退后就改成网前；发球、挥空、装置不消耗次数。"],
    yueqiu: ["summon","向前拖选网前，否则预约后场，松手部署投影。",["预约一个半场","投影等待来球","区内拦截回击"],"用投影补一个区域，本体守另一个区域；没预约的区域仍要自己跑。"],
    shuangji: ["ice","点按冻结对手脚下地面；拖动可调前后落区。",["地面结霜","急停转向打滑","调动到冰区两侧"],"先逼对手启动，再把球打到冰区两侧；跳跃和冰区外不受影响。"],
    ganggan: ["resource","点按押注本分，留意金币消耗；每分限一次。",["支付押注","争夺本分","胜负结算"],"发球前押注返还更高，但失败不返还；选有把握的一分。"],
    jiepan: ["trap","点按向对方半场投红包；消耗 60 金币。",["支付金币","三个红包落地","踩中短暂停留"],"把红包撒在对手必经的落点，逼他弯腰；只有地面踩中才会停。"],
    qiquan: ["power","点按准备金砖；下一次手动回球触发，消耗 50 金币。",["支付金币","下一拍附金砖","接球者受压"],"在能主动进攻时投金砖，借击退做下一拍空当；该球直接得分才有额外奖金。"],
    jingxiang: ["fake","先回球，再拖动选真球近线或远线；点按保持原线。",["先把球打出","一真二假分化","观察真实接球点"],"等对手开始判断线路再分化；真球只有一只，假球不替你得分。"],
    meida: ["fake","来球靠近拍前时点按虚挥；假球飞出后再打真球。",["拍前虚挥","假球先飞出","真球垫起再打"],"用假球诱导对手起跑，再打真球；真球还在身边，别忘记第二拍。"],
    shuizhong: ["curve","先回球，再点按布水纹；水纹亮起后再按选新落区。",["出球留水纹","二段改真实球路","原落点留虚影"],"读到对手提前站位后再变线；3D 进入对手接球范围后不能再改。"],
    jiezou: ["teacher","落地后点按隐身；隐身时跑位，找到空当手动击球，或起跳显形。",["隐身留下幻象","幻象追球 · 本体跑位","击球显形"],"用幻象协防、本体跑位；击球会显形，想清楚什么时候现身。"],
    biaozhi: ["trap","点按放身前标志桶；向后拖改放对手身后。",["选择前后位置","标志桶挡路","调动打空当"],"把桶放在对手的跑动线路上，逼他绕行或起跳；桶只挡地面。"],
    tingyixia: ["tactics","先点按准备；之后用高远或吊球接来球，过网时自动选长短。",["点按准备","过网读站位","压前挑后 · 守后放前"],"先让对手暴露重心，再让过网后的长短迫他折返；两次轻巧回球用完就结束。"],
    jibei: ["platform","拖动布置高台；再按升降，站上高台后手动击球。",["升起骨台","站上高台","高点回击或展翼"],"先占高点再选择高远或进攻；高台固定，记得及时下来防低球。"],
    yimo: ["jump","点按展翼，移动追球；靠近真实来球后手动回击。",["展翼猎航","追球调整高度","两次回球后收翼"],"把有限的时间用在救险或抢高点；收翼前先回位。"],
    weichui: ["power","拖动选上挑或下压准备骨尾；手动击球后自动接尾击。",["准备骨尾","手动回球","骨尾接续"],"腾空下压更强，也可以上挑转守为攻；先手动击球才接尾击。"],
    dianbu: ["step","按住方向滑步；落地 0.22 秒后可再按第二段。",["第一段滑行","积累旋力","折返或接转体"],"第一段抢位，第二段留给反向调动；接转体可继承惯性。"],
    bianpai: ["curve","上拖准备漂长、下拖准备急坠；再按切换，随后手动回球。",["选择旋转模式","手动打出两拍","过网后弯曲"],"让高远和吊球都带旋转，结合对手站位选长短；八秒内只有两次。"],
    jieli_jump: ["jump","点按转体跃起；空中移动调整，再手动击球。",["转体跃起","顶点缓落","调整触球位置"],"滑步后接转体，在高点从容挥拍；仍要对准真实来球。"],
    tongqin: ["buff","点按准备；接快球自动借力，接吊球自动卸短。",["准备两次反击","接快球借速","接吊球卸短"],"对快球借力打快，对吊球卸成网前短球；按来球类型做选择。"],
    gongwei: ["power","点按准备；接下来两次手动回球变成纸镖。",["折成纸镖","手动回球","低阻穿越"],"用平快球压缩对手反应时间，再调动另一侧；纸镖仍受物理和球网判定。"],
    jiaban: ["glide","点按准备；再手动选长短回球，过网展翼滑行。",["折纸准备","过网展翼滑行","收翼下坠"],"保留长短选择，用展翼和收翼的节奏骗对手提前起拍；不改变击球类别。"],
    sanbu: ["freeze","点按取景；来球靠近球网时自动减速，你仍要手动回击。",["布置慢镜","网前取景减速","追到球后回击"],"借减速多看一眼，但来球不会停；追到球后要自己完成回击。"],
    yipai: ["curve","拖动选近剪或深剪；再按免费切换，随后手动回球。",["选择近剪或深剪","手动完成回球","同类球路改落点"],"保持击球类别，用近深切换惩罚提前押前后的对手；次数用完就结束。"],
    jingmo: ["power","点按准备；接下来两次回球出拍后逐渐加速。",["准备快进","正常速度起飞","沿原路加速"],"和慢镜或复映连用，做先慢后快的节奏差；球沿原路加速，不会瞬移。"],
    feibai: ["hide","点按准备；下一次回球起飞后短暂隐去，靠近对手会显形。",["先打出球","短暂隐去","近身或低位显形"],"和回眸假球叠加，用短暂丢失球路的画面争取站位；靠近对手会显形。"],
    liubai: ["step","按住方向点按侧滑；随后手动回球会带一只反向假球。",["侧身留香影","手动回球","反向假球飞出"],"先用侧滑调整触球点，再用反向假球扰动对手；真球仍正常计分。"],
    luokuan: ["curve","点按准备压线；再按切换贴网，随后手动回球。",["选择压线或贴网","手动触球","达到质量后校准"],"站稳提高质量再压线；普通回球会多耗体力，别疲劳时连续用。"],
    ouzhou: ["step","按住方向点按切入；1.25 秒内再按可换向跨步。",["第一步切入","读对手方向","第二步换手"],"第一步试探，第二步找空当；两段都要考虑回位。"],
    gongdan: ["board","点按放篮板；来球被托起后，起跳手动二次进攻。",["篮板展开","托起一次低球","起跳二次进攻"],"把落下的防守球托成高点再进攻；篮板只托一次，本体要到球下方。"],
    kongjie: ["buff","点按开始 3 秒倒计时；最后 0.8 秒内手动击球触发强化。",["三秒倒计时","进入最后窗口","压哨手动回击"],"按来球到达时间启动；太早开启会过期并损失体力。"],
    lingxin: ["power","点按准备；下一次手动回球附加过载。",["附加过载","对手接球耗体力","后续两拍承压"],"在长回合里积累体力优势，再用下一拍继续调动；过载影响对手两拍。"],
    kuorong: ["fog","点按布雾；再按可下沉，花缓存抵消缩时。",["高处成雾","二段下沉","高球进入迷雾"],"先看对手爱打高球还是平球，再决定是否下沉；下沉会少持续两秒。"],
    rongzai: ["buff","收招时点按，立刻结束收招并清状态；5 秒内下一拍反击更强。",["结束收招与净化","准备反压","手动接球反击"],"接重球后及时反压，清掉收招和负面状态；下一拍仍要手动接球。"],
  };
  const passives = {
    yihan:['极限救球','失败留下脚印','下一分拾取补能'], dishui:['完成回球','水滴留场','拾取回复体力'],
    biaochi:['观察角度线','手动完美回球','反射板多拦一次'], hudie:['网前回球过网','留下蝴蝶结','托起擦网球'],
    zheteng:['完成一招 · 回能回体','8秒内换另一招','旺火 · 强化下一拍'], yekong:['手动回球','累计两次','额外回复能量'],
    jixie:['装置命中球','进入3秒过载','收招再按回收'], liansha:['连续得分','连胜奖励增加','被终结时对手得能量'],
    rizhi:['记录挥空原因','接回两类来球或记录球路','获得编译标记'], qiandao:['记录最近3次落点','同区出现2次','形成习惯区'],
    jihui:['开局500金币','回球与得失分','装备随资产升级'], canying:['急停或转向','留下残影','残影沿原路跑'],
    kandong:['手动长短球交替','积满2层布局','下一拍轻巧回球精准'], shihua:['手动回球记录高度','集齐低/中/高','回复体力与能量'],
    dingzhou:['回球后移动1.15米','积1层旋力（最多2层）','下一拍弧线更弯'], gongxiu:['手动接快球','借动能反击','缩短收拍'],
    lvyue:['切换短球/进攻/深球','积1格底片','镜头回球回复'], moyun:['累计2次完美击球','球拍滴墨预告','对手触球爆墨'],
    qiuyou:['使用两种不同花式','蓄满热手','下一招强化'], guance:['接回高点或高速球','积1格缓存','用于迷雾下沉或反压'],
  };
  const types = {teacher:'隐身协防',tactics:'落点设局',ice:'地面控场', dive:'救险位移', jump:'空中机动', step:'步法变化', swing:'空中机动', wind:'球路干预', pool:'守场续球', resource:'资源运营', reverse:'节奏控制', board:'场上装置', toss:'接力起手', buff:'回球强化', hold:'持球变化', curve:'长短变线', bounce:'弹射球路', orbit:'旋转拦截', warp:'空间转移', gravity:'飞行控制', racket:'范围拦截', summon:'区域防守', clone:'分身接力', fake:'真假干扰', mark:'球路改写', trap:'走位限制', power:'进攻强化', platform:'高点控制', glide:'节奏变化', hide:'视野干扰', fog:'视野干扰', freeze:'时间控制', passive:'角色被动' };
  const roles = {
    lingfeng:'灵动', canglan:'控场', xiaohong:'控场', ranran:'灵动', ruibao:'技巧', xingxing:'控场', dingding:'技巧', houzi:'灵动', lu:'技巧', laochen:'控场', guoge:'强攻', tianchu:'技巧', zhu:'控场', dong:'强攻', miaomiao:'灵动', mage:'强攻', nan:'技巧', bobo:'技巧', sun:'强攻', zhuzhu:'控场',
  };
  Y.characterRole = id => roles[id] || '技巧';
  const conditions = {
    yuyue:'回合中，落地后使用。', tafeng:'回合中，已在空中；每次起跳只能踏风一次。',
    diban:'回合中可提前准备；直接砸球要求己方拍前真实来球。', zipao:'来球进入己方拍前范围，且未被装置控制。',
    huiguo:'回合中可提前准备；回收须仍为己方出球且未进入对手截击范围。', huichao:'来球已过网进入己方，且已留下足够飞行轨迹。',
    meida:'来球已过网进入己方拍前范围，且未被装置控制。', tingyixia:'回合中先准备；手动接回对手的来球才消耗次数。', jiezou:'回合中、落地后使用；隐身持续期间不能重复开启。',
    jingxiang:'己方回球已打出、尚未下网或进入低位；已有镜像时不能再次分化。', shuizhong:'先将真球回击出去，再布置水纹。',
    jieli:'来球在本体或复制体身边，且未被控制。', jiewang:'先通过网前回球，在己方留下至少一个蝴蝶结。',
    tangqiu:'回合中，落地站稳；不能在穿花过程中再启动第一段。', dianbu:'回合中，落地后启动；第二段另有落地与间隔要求。',
    jieli_jump:'回合中，落地后起跳；不能在持球或无法起跳时启动。', yimo:'回合中，可以起跳，且未持有被控制的球。',
    liubai:'回合中，落地站稳；不能趴地或被固定时使用。', ouzhou:'回合中，落地站稳；两段分别读取移动方向。',
    rongzai:'回合中，已恢复站姿且未被固定；可在收招期间使用。',
    ganggan:'发球前或回合中均可押注，本分只能一次。', jiepan:'回合中，至少 60 金币，且场上没有未捡完的红包。',
    qiquan:'回合中，至少 50 金币，且未准备金砖球。',
  };
  const limitations = {
    yuyue:'只救真实范围内的球；扑空会趴地。', tafeng:'只强化下一拍；仍需手动完成真实触球。',
    fengkou:'风道只改变首个经过的球；旧风道尚在时不能重放。', chaolai:'最多托两只球；同一只球第二次落水正常判分。',
    tongyin:'体力落后才吸取差值；否则改为节省扣杀消耗。', huichao:'二段放下改变接球时机，不能无限倒流。',
    fanshe:'放置后 0.45 秒才生效；板的落区固定。', zipao:'自抛不算已回击过网，需要继续手动补拍。',
    pingyi:'仅强化准备时间内两次手动回球，不替玩家自动挥拍。', tangqiu:'折返需要消耗己方蝴蝶结；位移不会自动接球。',
    hongxian:'只牵可覆盖的来球；持球最多一秒，期间可手动出球。', jiewang:'消耗蝴蝶结；过网高度须低于 3.35 米。',
    diban:'每面墙与地板各弹一次；二段可预选，在首次反弹并升高后出锅，不重复扣能量。', huiguo:'对手触球或进入其1.6米拍前范围后不能收回；回收后必须自己挥拍，4秒内补拍质量至少92%。',
    baozi:'包球持续6秒，只能加速己方合法出球；球已越过的近区不能反向偷分。回锅中保留馅料。', yueliang:'二段按当时切线甩出，方向不当仍可失误。',
    xingmen:'出口会停留 0.35 秒，传送不免除合法过网与落点要求。', zhongli:'每秒消耗 6 能量，最多 1.5 秒；再次释放关闭。',
    shensuo:'只拦拍头真实范围内来球；球拍没收回时不能另开机械招式。', xuanpai:'只拦真实范围内来球；过载扩大范围。',
    youyou:'锁球后可弹射，也可等带回再手动击打；合齿窗口更稳。', jindou:'悬停最多 1.4 秒，需要自己按击球键。',
    dangteng:'二段才定向跃出；飞行中微调不能覆盖全场。', haomao:'准备后才拦球，且最多拦一次。',
    fuzhi:'复制体不追球，只同步动作；己方落球仅可弹起一次。', jieli:'接力是垫球，仍需本体或复制体接续挥拍。',
    zangshu:'只是真球以外的干扰球，不参与计分；已有脏数据时不能重复释放。', yati:'0.18 秒后生效，10 秒内改写两次手动回球；发球、挥空和装置不消耗。',
    yueqiu:'仅覆盖预约区域；未预约区域需本体防守。', shuangji:'0.35 秒后地面生效，10 秒内持续低抓地；跳跃和冰区外不受影响。',
    ganggan:'金币不足仍可押注，可能进入负债；失败不返还。', jiepan:'只有地面踩中才会停留，红包持续五秒。',
    qiquan:'花费金币准备下一拍；额外奖金仅在该球直接得分时获得。', jingxiang:'真球只有一只，计分仍看真球；假球不能替你得分。',
    meida:'真球仍留在身边，需要第二次手动击球。', shuizhong:'3D 在进入对手接球范围后不再变线；真球仍正常计分。',
    jiezou:'幻象独立追球，不跳不杀。击球显形 0.8 秒，空中全程可见；同阵营能看见半透明本体。', biaozhi:'只阻挡地面移动，对手可以跳过。',
    tingyixia:'两次手动轻巧回球；扣杀、发球、自垫和幻象不触发。仍可合法截击，正常计算界内外。', jibei:'高台固定，需要实际站上；展翼加成也要求台上起飞。',
    yimo:'时间或回球次数用完即收翼；台上起飞另有强化。', weichui:'先手动击球才衔接尾击；腾空下压效果更强。',
    dianbu:'二段须落地且间隔 0.22 秒，不提供自动接球。', bianpai:'八秒内只有两次旋转回球，需要手动击球。',
    jieli_jump:'扩大的是范围与时机窗口，仍要到达真实击球位置。', tongqin:'强化两次回球；快球借速、吊球卸短，效果不同。',
    gongwei:'两次手动回球触发，纸镖仍会受真实物理与球网判定。', jiaban:'不替玩家改变击球类别，长短仍由击球键与方向选择。',
    sanbu:'九秒内最多取景两只来球，单球减速最多 1.45 秒。', yipai:'保留击球类别，只改近深落点，次数用完即结束。',
    jingmo:'沿原球路渐进加速，不会直接传送到落点。', feibai:'接近对手或低位时提前显形，隐去最多 0.36 秒。',
    liubai:'四秒内下一拍附带一只假球，真球仍正常计分。', luokuan:'达到回球质量才校正，普通回球额外消耗 8 体力。',
    ouzhou:'普通状态为两步；热手强化三段步，仍受窗口限制。', gongdan:'篮板只托一次来球，不会自动完成二次进攻。',
    kongjie:'只有最后 0.8 秒手动触球强化，错过期限消耗 6 体力。', lingxin:'强化下一拍；过载影响对手接球及后续两次回球。',
    kuorong:'下沉会缩短两秒持续时间，除非消耗缓存抵消。', rongzai:'只清除过载与墨盲等指定状态，下一拍仍需手动接球。',
  };
  Y.skillGuide = function (id, mode = '2d') {
    const sk = Y.skillDescription(id, mode); if (!sk) return null;
    const owner = Y.CHARS.find(c => c.passive === id || c.acts.includes(id));
    const row = lessons[id], type = sk.passive ? 'passive' : row?.[0];
    let operation = sk.passive ? '满足触发条件时自动生效，不占用两个主动技能槽。' : row?.[1];
    if (mode === '3d' && !sk.passive) {
      operation = operation
        .replaceAll('向前拖', '向网推杆').replaceAll('向后拖', '向后推杆')
        .replaceAll('向上拖', '向网推杆').replaceAll('向下拖', '向后推杆')
        .replaceAll('再拖一次', '再推杆一次')
        .replaceAll('拖动', '推杆').replaceAll('松手', '点按技能')
        .replaceAll('上拖', '向网推杆').replaceAll('下拖', '向后推杆').replaceAll('平拖', '横向推杆');
      if (Y.SKILLS[id].aim) operation = '用摇杆选方向，点按技能释放。' + operation;
      if (id === 'xuanpai') operation = '点按技能水平环扫，摇杆选择出球方向；过载扩大范围。';
      if (id === 'jingxiang') operation = '先回球再点按分化。真球保留原球道，两只假球飞向两侧。';
      if (id === 'bianpai') operation = '向网推杆准备漂长，后推准备急坠，横推选择侧旋；再按切换。';
    }
    const desc = Y.plainText(sk.desc), durations = [...desc.matchAll(/(?:\d+(?:\.\d+)?秒|\d+次)/g)].map(m => m[0]);
    const condition=sk.passive?'常驻生效，按技能效果的条件自动触发。':conditions[id]||'回合进行中使用；同类效果尚未结束时不能重复开启。';
    const limits=sk.passive?'不占主动槽位；触发条件见技能效果。':id==='shuizhong'&&mode!=='3d'?'真实变线后在原落点留虚影；判分始终以真球落点为准。':limitations[id];
    const sustained=new Set(['diban','huiguo','baozi','fengkou','chaolai','tongyin','fanshe','pingyi','tangqiu','jiewang','xingmen','yueliang','zhongli','haomao','fuzhi','zangshu','yati','yueqiu','shuangji','jiepan','qiquan','jiezou','biaozhi','tingyixia','jibei','yimo','weichui','dianbu','bianpai','tongqin','gongwei','jiaban','sanbu','yipai','jingmo','feibai','liubai','luokuan','ouzhou','gongdan','kongjie','lingxin','kuorong','rongzai']);
    return {
      id, owner:owner?.id, mode, category:types[type], type, summary:sk.desc, operation,condition,limits,
      steps:sk.passive ? passives[id] : row?.[2],
      tactic:sk.passive ? '围绕「' + sk.name + '」的触发条件安排跑位与回球；具体次数和奖励见技能效果。' : row?.[3],
      performance:[['能量消耗', sk.passive ? '无需能量 · 不占主动槽位' : sk.cost + ' / 共用 100 能量'], ['释放条件',condition], ['时间 / 次数', [...new Set(durations)].join(' · ') || '条件触发，详见技能效果'], ['边界与代价',limits],...(sustained.has(id)?[['分间保留','回合结束保留剩余时间与次数，发球准备暂停，下一回合继续。']]:[])],
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
    if(['step','dive','swing'].includes(kind)) actorX += stage===0?v*1.7:stage===1?1.7:1.7*(1-v);
    if(['jump','swing','dive'].includes(kind))actorY=Math.sin(u*Math.PI)*(['dive'].includes(kind)?.35:1.35);
    if(kind==='platform')actorY=stage?1:.8*v;
    if(kind==='clone')actorX=stage===0?-3:-3+Math.min(1,(stage-1+v))*1.8;
    const drawActor=(a,b,z,owner,opacity=1)=>{const p=pt(a,b,z);g.save();g.globalAlpha=opacity;g.translate(...p);g.scale(scale*.98,-scale*.98);const moving=owner&&['step','dive','swing'].includes(kind),turn=id==='jieli_jump'?{turnAngle:TAU*u,turnPose:Math.sin(Math.PI*u)}:{};const fake={idx:0,dir:owner?1:-1,x:a,y:b,z,vx:moving?3:0,vy:0,onGround:b===0,runPhase:time*4,stamina:100,cnt:{nv:turn},buff:{},motion:{air:b,speed:moving?3:0,land:0,split:0}};Y.drawCharacter(g,fake,Y.lookOf(owner?info.owner:'canglan'),{time,mood:'play',action:owner&&!sk.passive?Y.CharacterArt?.action(id,(stage===0?v*.3:stage===1?.3+v*.2:.5+v*.119)):null});g.restore();};
    if(kind!=='teacher')drawActor(actorX,actorY,space?-.65:0,true);
    drawActor(3,0,space?.65:0,false);
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
    else if(kind==='passive'||kind==='resource'){for(let i=0;i<3;i++){const p=pt(-4+i*.65,2.65);g.fillStyle=stage>=i?color:'#47616d';g.fillRect(p[0]-6,p[1]-4,12,8);}if(stage===2)ring(-3,1,0,20+v*12);lineBall();}
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
    else if(kind==='toss'){path([[-2.6,1],[-2.2,3],[-1.8,1.8]],color+'88',true);ball(-2.6+t*.8,1+Math.sin(t*Math.PI)*2);}
    else if(kind==='curve'||kind==='glide'){path([[-2.5,1.4],[0,2.3],[4.8,0]],'#5b7e89',true);const near=['jiewang','shuizhong','luokuan'].includes(id),end=near?1.5:5.3;path([[-2.5,1.4],[0,2.5],[end,0]],color);ball(-2.5+(end+2.5)*t,1.4*(1-t)+Math.sin(t*Math.PI)*1.6);}
    else {if(kind==='buff'||kind==='power'||kind==='jump')ring(actorX,actorY+1,0,20+Math.sin(time*4)*3);lineBall(false,kind==='jump'?2.4:1.4);}
    // 被动各自的触发线索与道具，不以同一条通用球路代替。
    if(sk.passive){
      if(['yihan','dishui','hudie'].includes(id))for(let i=0;i<=stage;i++){
        const p=pt(-4.5+i*1.1,.12);
        if(id==='hudie')Y.CharacterArt?.butterfly(g,...pt(-.8+i*.8,1.55),9,time);
        else{g.fillStyle=color;g.beginPath();g.ellipse(p[0],p[1]-(id==='dishui'?7:0),id==='dishui'?4:7,id==='dishui'?7:3,-.35,0,TAU);g.fill();}
      }
      else if(id==='canying'){drawActor(-4.2+v*.7,0,0,true,.22);drawActor(-3.9+v*.7,0,0,true,.1);}
      else if(id==='biaochi'){path([[-3,1.2],[1,3]],color+'aa',true);path([[-3,1.2],[1,.6]],color+'aa',true);ring(-3,1.2,0,24);}
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
