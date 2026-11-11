'use strict';
// Compile the authored screenplay into executable beats. Only the narrative sections
// are input; the document's production notes are never executed as instructions.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'STORY_SCRIPT_V3.md'), 'utf8');
const clean = s => s.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/\*\*|`/g, '').replace(/^>\s?/gm, '').trim();
// Runtime teaching follows the current rules; the authored narrative remains the source.
const lessonUpdates={
 '悠悠球拍':['拖动抛出接球器，飞出、停留或空手返回时最多接住一次来球。接住后自动带回拍前垫高，由你按高远、吊球或扣杀打出下一拍。','没接到时再按可提前收回；手柄可以正常击球。收招时再按快速回收，返还6能量。'],
 '几何反射板':['消耗25能量。拖动放置后0.45秒生效，持续10秒、拦截一次；消耗校准标记时可拦截两次。最多三块按编号接力。','每块板朝固定落区出球，落区在放置时标在地面上。可拦截过网后的对方来球、自己的自抛球和板间接力球；己方发球与普通出球直接穿过。'],
 '辅助线':['消耗20能量，在8秒内辅助两次手动回球：击球时机判定放宽20%，击球质量至少82%。由你选择高远、吊球或扣杀。','正常球路按原样打出，预计下网或出界时尝试修正到同类安全落区。需要自己走位、够球和挥拍；挥空不消耗次数。'],
};
const speakers = { '丁丁':'dingding', '小丁丁':'dingding', '瑞宝':'ruibao', '王瑞':'ruibao', '小红':'xiaohong', '星星':'xingxing', '冉冉':'ranran', '猴子':'houzi', '波波':'bobo', '苗苗':'miaomiao', '沧澜':'canglan', '凌风':'lingfeng', '田楚':'tianchu', '少年田楚':'tianchu', '老南':'nan', '二十八岁的南振':'nan', '朱老师':'zhu', '果哥':'guoge', '路先森':'lu', '老陈':'laochen', '瑞妈':'ruima', '王爸':'wangba', '外婆':'grandma', '苗苗外婆':'grandma', '大将军':'goose' };
const chapterInfo = [
  ['序章 · 掉磅','6.26','stringing','线穿好之后会慢慢松掉，叫“掉磅”。人也一样。'],
  ['第一章 · 移动城墙','6.28—7.5','bakery','包子、七个老粉和一张垫蒸笼的纸。我们心里的墙，长什么样？'],
  ['第二章 · 蝴蝶结','7.6—7.10','nightmarket','有些球会擦网。擦网过去的，也算数。'],
  ['第三章 · 师兄','7.12—7.16','auditorium','二十六磅。白衬衫。观众席第三排。师兄回来了。'],
  ['第四章 · 渡口','7.18—7.26','ferry','有些话，过了那个渡口，就不用说了。'],
  ['第五章 · 蓝色回收桶','7.28','warehouse','免费的球，原来记得所有人的名字。'],
  ['第六章 · 押谁赢','8.2—8.8','goosefarm','大概率的事，赚不到大钱。'],
  ['第七章 · 英仙座','8.10—8.13','rooftop-rain','三十七页计划，和一行不用等流星的话。'],
  ['第八章 · 别断','8.15—8.19','winter2022','线绷得太紧，是会断的。'],
  ['第九章 · 球落地之前','8.20','league','十六根羽毛，十四个记号。最后一分，自己去接。'],
  ['第十章 · 没有运气的人','8.22—8.25','jarroom','三十年。他读过所有人的球，唯独没有读过自己的。'],
  ['终章 · 第十六根羽毛','8.29—8.30','riverbank','有一根空着，它也能飞。'],
];
const baseScenes = {
 '0-1':'stringing','0-2':'riverbank','0-3':'riverbank','0-4':'backroom',
 '1-1':'bakery','1-2':'emptyfield','1-3':'streamroom','1-4':'quarry','1-5':'townsquare',
 '2-1':'nightmarket','2-2':'emptyfield','2-3':'classroom','2-4':'rooftop','2-5':'emptyfield',
 '3-1':'stringing','3-2':'oldgym','3-3':'auditorium','3-4':'league','3-5':'locker',
 '4-1':'ferry','4-2':'island-memory','4-3':'ferry','4-4':'ferry','4-5':'league',
 '5-1':'warehouse','5-2':'warehouse','5-3':'warehouse','5-4':'warehouse','5-5':'warehouse',
 '6-1':'fitness','6-2':'emptyfield','6-3':'goosefarm','6-4':'league','6-5':'league',
 '7-1':'backroom','7-2':'rooftop-rain','7-3':'backroom','7-4':'bakery-night','7-5':'emptyfield',
 '8-1':'nightmarket','8-2':'league','8-3':'league','8-4':'backroom','8-5':'ferry-night',
 '9-1':'stringing','9-2':'league','9-3':'locker','9-4':'league','9-5':'locker',
 '10-1':'oldgym','10-2':'jarroom','10-3':'jarroom','10-4':'oldgym','10-5':'oldgym',
 '11-1':'townsquare','11-2':'ferry','11-3':'riverbank-night','11-4':'backroom','11-5':'stringing-night',
};
const match = (as, opp, field='empty', extra={}) => ({t:'match',as,opp,field,level:'normal',target:7,cap:11,allowLoss:true,stars:[],...extra});
const mini = (game, title, extra={}) => ({t:'minigame',game,title,...extra});
const inspect = (scene, title, rows) => ({t:'inspect',scene,title,items:rows.map(([id,label,text],i)=>({id,label,text,clue:id,x:.17+(i%3)*.31,y:.28+Math.floor(i/3)*.22}))});
const footwork = {t:'footwork',as:'dingding',def:{name:'朱老师的米字步',need:6,total:12,life:3.2,minLife:2.2},stars:[]};
const drill = (name,judge,extra={}) => ({t:'drill',as:'dingding',skills:false,def:{name,judge,goal:{need:4,total:10},feeds:{intro:1},...extra},stars:[]});
const choose = (key,q,opts) => ({t:'pick',key,q,o:opts.map(([label,value,note])=>({label,value,reply:value,note,ok:true})),exp:'没有标准答案。这句话会留在羽毛册里。'});
const D = (scene,lines,when) => ({t:'dialog',scene,lines,when});
// An anchor is checked at build time; screenplay edits cannot silently detach a game.
const events = {};
function before(id, anchor, ...steps) { (events[id] ||= []).push({anchor,steps}); }
before('0-1','（小游戏结束）',mini('stringing','给刘姨穿一支二十四磅',{tension:24}));
before('0-2','（第一个球打中',drill('先到位，再挥拍','receive'));
before('0-2','**瑞宝**（喘着气捡球）',drill('把轻球放到网前','drop',{feeds:{drop:1}}));
before('0-3','（比赛）',match('dingding','xiaohong','reality',{skills:false,level:'easy'}));
before('0-3','（**小段操作**',drill('接住冉冉的网前小球','receive',{goal:{need:1,total:99},feeds:{intro:1},gentle:true}));
before('0-4','**丁丁**（救起',match('dingding','xiaohong','memory',{target:3,cap:5,training:true,intentSide:0,intents:['冉冉在看','冉冉在看','冉冉还在看'],venue:'memorycourt'}));
before('1-1','（小游戏结束）',mini('baozi','接！先垫一步',{goal:9}));
before('1-2','【演出】比赛中',match('ruibao','dingding','empty',{training:true,level:'easy'}));
before('1-3','（比赛结束）',match('houzi','ruibao','empty',{training:true,level:'easy',stream:true}));
before('1-4','（**探索**',inspect('quarry','请勿踩我的寒武纪',[
 ['fishfossil','鱼骨','波波：鱼是最早有脊椎的一批。你打球用的脊椎，是从它们那儿借来的。'],
 ['shellfossil','贝壳','波波：这里以前是海。鹅湾是一个海底。'],
 ['leaffossil','像羽毛的印痕','波波：这个……我希望是羽毛，其实应该是叶子。不过没关系，我天天希望一下。'],
]));
before('1-5','（比赛：空场',match('dingding','houzi'));
before('2-1','【选择】',inspect('nightmarket','走到她的摊位前',[
 ['market-bow','蝴蝶结摊位','冉冉：那个蝴蝶结后来还在吗？丁丁：……还在。'],
 ['market-corn','长椅上的烤玉米','星星：如果有一个人要去很远的地方……小红已经开始在心里计算了。'],
 ['market-stream','耳机里的猴子','猴子：家人们，现在是情感专区—— 丁丁：关掉！'],
]),choose('bow','你要买一个蝴蝶结吗？',[
 ['买一个白色蝴蝶结','white','冉冉笑着把它别在拍柄上。'],['这次什么都不买','wait','冉冉：那下次再来。'],
]),D('nightmarket',[['ranran','送谁的？','smile'],['dingding','……挂拍子上。','shy']],{choice:'bow',value:'white'}),D('nightmarket',[['ranran','那下次再来。','smile'],['dingding','……嗯。','shy']],{choice:'bow',value:'wait'}));
before('2-2','（比赛结束）',match('ranran','dingding','empty',{training:true,level:'easy'}));
before('2-3','（比赛结束）',match('xiaohong','ruibao','empty',{training:true}));
before('2-4','（比赛结束）',match('xingxing','houzi','empty',{training:true}));
before('2-5','（比赛结束）',match('choose','other','empty',{players:['ranran','xingxing']}));
before('3-1','（**穿线小游戏**',mini('stringing','师兄的二十六磅',{tension:26,pressure:true}));
before('3-2','【知识 #14',footwork);
before('3-2','（比赛中）',match('zhu','lingfeng','empty',{training:true,level:'easy',enableTips:true}));
before('3-3','（**探索**',inspect('auditorium','让每一个球被看见',[
 ['auditorium-pods','南岸羽场舱','选手进入共享羽场，想法会化成技能。这里与现实球场不同。'],
 ['auditorium-model','胜率演示','路先森：模型准确率 94.7%。丁丁：剩下那 5.3% 呢？路先森：那是噪音。'],
 ['auditorium-letter','招生宣传册','冉冉停在“青训学院招生”这一页。选择要由她自己说。'],
]));
before('3-4','**田楚**（第一次',match('dingding','tianchu','league',{level:'hard',prediction:4,progressScore:3}));
before('4-1','【演出】江心洲上',inspect('ferry','一块钱，过江',[
 ['ferry-car','岸边的黑车','车在码头停了一星期，田楚一直没有过江。'],
 ['ferry-net','船头的网兜','沧澜接过了家里的渡船，也给洲上的小孩教球。'],
 ['ferry-court','江心洲旧球场','围栏上的字已经褪色：江心洲青少年训练点。'],
]));
before('4-2','（比赛中，田楚',match('canglan','tianchu','memory',{training:true,oppSkills:false,age:[19,17],intents:['她今天累了','让她多跑两步回来喝水','……明天的事，明天再说','要是能一直在洲上打就好了'],intentSide:1,venue:'islandcourt'}));
before('4-3','（比赛结束）',match('lingfeng','dingding','empty',{training:true}));
before('4-5','（比赛）',match('lingfeng','academy','league',{prediction:9}));
before('5-1','【演出】货车开进',mini('stealth','跟着蓝色回收车',{goal:4}));
before('5-2','（比赛结束）',match('dingding','lu','empty',{training:true,level:'hard'}));
before('5-3','（比赛结束）',match('laochen','lu','empty',{training:true}));
before('5-4','（打球。田楚',match('dingding','tianchu','memory',{oppSkills:false,skills:false,age:[10,14],target:1,cap:1,gentle:true,rallyGoal:20,intentSide:1,intents:['这小孩真能跑','别让他输得太难看','以后他会比我强','……那我就得更强'],venue:'youngcourt'}));
before('5-5','【选择】',choose('profile','要看田楚的意图画像吗？',[
 ['看画像','read','你记住的是：疲劳，极高。'],['不看，听他自己说','wait','丁丁：那是他的。我想听他自己说。'],
]),D('warehouse',[['nar','田楚｜欺骗型｜情绪：恨（对象：丁丁）｜疲劳：极高','stage'],['dingding','……他累了。','sad']],{choice:'profile',value:'read'}),D('warehouse',[['dingding','不看。那是他的。我想听他自己说。','think']],{choice:'profile',value:'wait'}));
before('6-2','（比赛结束）',match('guoge','ruibao','empty',{training:true}));
before('6-3','【教学·分拣小游戏】',mini('sorting','挑齐十六根羽毛',{goal:16}));
before('6-4','（比赛）',match('choose','academy','league',{prediction:22,gear:true,level:'hard'}));
before('6-5','（比赛中，苗苗',match('lingfeng','miaomiao','league',{prediction:3,level:'hard',stable:true,errorGoal:1}));
before('7-3','【意图】（高一的星星）这个人',match('xiaohong','xingxing','memory',{target:2,cap:3,gentle:true,age:[15,15],intentSide:1,intents:['这个人好认真，好好笑','她笑起来眼睛是弯的','……要怎么算才能让她多笑一下'],venue:'starcourt'}));
before('7-3','【演出】**中途切换**',match('xingxing','xiaohong','memory',{target:2,cap:3,gentle:true,age:[15,15],intentSide:0,intents:['明天还想跟他打','后天也想'],venue:'starcourt',switching:true}));
before('7-4','【演出】丁丁走过去',inspect('bakery-night','凌晨三点，只有揉面的声音',[
 ['bakery-form','垫蒸笼的纸','2026 年普通高校招生志愿确认单·王瑞。确认截止：7 月 5 日。签名栏是空的。'],
 ['bakery-dough','没有音乐的后厨','瑞宝独自揉面。父亲要手术，母亲一个人撑不起店。'],
 ['bakery-fan','老王包子','躺在楼上的王爸，每次看直播都刷“稳住”。他只是想看看儿子打球。'],
]));
before('7-5','（比赛中，每次',match('dingding','ruibao','empty',{level:'hard',timeLimit:480,wallBreak:6}));
before('8-2','（比赛）',match('ranran','miaomiao','league',{prediction:6,level:'hard',stable:true}));
before('8-3','（比赛中）',match('dingding','guoge','league',{prediction:29,level:'hard'}));
before('8-4','【演出】**比赛开始',match('tianchu','provincial','memory',{skills:false,age:[18,18],durability:true,startScore:[4,4],target:7,cap:7,intentSide:0,intents:['别断','别断','别杀了，吊','别断，他那么高兴','……就这一拍'],venue:'wintercourt'}));
before('9-1','**丁丁**（给自己的', {t:'loadout',as:'dingding',title:'最后一次配装',recommend:['shensuo','youyou']},mini('stringing','别绷得太紧',{tension:24,rounds:2}));
before('9-2','（比赛）',match('dingding','tianchu','league',{prediction:1,level:'hard'}));
before('9-4','（比赛中）',match('dingding','tianchu','league',{prediction:.4,level:'nightmare',allowLoss:false,shoulder:true}));
before('10-2','（**探索**',inspect('jarroom','玻璃做的森林',[
 ['jar-ranran','冉冉 #0207','高价值。冉冉看了一眼，转身走开。'],
 ['jar-lingfeng','凌风 #0412','待观察。凌风：……老陈哥改的。老陈：嗯。'],
 ['jar-miaomiao','苗苗 #0001—#3650','整整一面墙。她十二岁到现在的每一场。'],
 ['jar-tianchu','田楚 #0002','只有一个罐子。标签手写着：和师弟。'],
 ['jar-nan','1996.8.25 · 最后一球','灰尘覆盖着底座。真空封条完好，三十年没有被打开。'],
]));
before('10-4','（**接力比赛开始**', {t:'relay',as:'dingding',opp:'nan',field:'league',level:'nightmare',target:7,cap:11,prediction:0,allowLoss:false,title:'排好棒次，最后一棒是丁丁'});
before('10-5','【意图】还有两分',match('nan','zhu','memory',{skills:false,target:15,cap:15,startScore:[13,4],oldScoring:true,fear:true,gentle:true,age:[28,30],intentSide:0,intents:['还有两分','别输','别输','别杀，杀出界就完了','别输别输别输'],venue:'historicourt'}));
before('10-5','【演出】**最后一回合',match('zhu','nan','reality',{skills:false,target:1,cap:1,rallyGoal:16,gentle:true,freeze:true,age:[60,58],venue:'homecourt'}));
before('11-1','（**探索**',inspect('townsquare','和每个人说一声再见',[
 ['farewell-ruibao','王记包子铺','瑞宝：明年六月，我再考一次。反正包子一直都在。王爸：稳住。'],
 ['farewell-houzi','网吧二楼','直播间在线 8 人。新来的 ID 叫“师兄”，每次都刷“还行”。'],
 ['farewell-bobo','采石场','波波还在希望那是羽毛；苗苗决定读运动科学。大将军在吃草。'],
 ['farewell-stars','气象站天台','第三十七页只有一行星星的字：结论，不用写。'],
 ['farewell-zhu','老体育馆','凌风当助教了。门口站着田楚，拿着那支二十四磅的拍子。'],
 ['farewell-guoge','果然健身','唯一一次大赚：押丁丁，1 赔 30 包。可是还欠王记一百包。'],
 ['farewell-lu','实习办公室','模型无法预测十六个人。原因：他们会变。'],
 ['farewell-nan','穿线铺门口','老南在第十五根羽毛上画了打开的罐子。剩下那根，你自己写。'],
]));
before('11-4','【演出】**玩家操控丁丁',match('dingding','nan','memory',{target:1,cap:1,gentle:true,rallyGoal:12,intentSide:0,intents:['冉冉在看','冉冉在看','接住，接住','瑞宝在喊','师兄在看','……她在那边','赢了就说','这次一定说'],venue:'homecourt'}));
before('11-5','【意图】他终于来打球了',match('ranran','dingding','memory',{skills:false,target:1,cap:1,gentle:true,rallyGoal:3,intentSide:0,intents:['他终于来打球了','四年了','给他一个接得到的','接住啦'],venue:'memorycourt'}));

const sceneChanges = [
 ['画面猛地切回后屋','backroom'],['第一次进入羽场','memory-river'],['比赛结束，大家坐在台阶','riverbank'],
 ['一辆黑色轿车','stringing-night'],['空场里','emptyfield'],['进入空场','emptyfield'],['【演出】测试舱里','emptyfield'],
 ['【演出】羽场里，是八年前','younggym'],['【演出】羽场里，是三年前','memory-stars'],['【演出】记忆显影完成。两个人摘下','backroom'],
 ['【演出】穿线铺后屋','backroom'],['【演出】羽场里，2022','winter2022'],['【演出】记忆显影完成。丁丁摘下头环，仓库','warehouse'],
 ['【演出】羽场里，是 1996','historic1996'],['【演出】记忆显影完成。现实中','oldgym'],
 ['【演出】羽场里，是三天前','oldgym'],['【演出】九月。清晨','bakery'],
];
const cgs = [
 ['第一次进入羽场','cg-entry'],['瑞宝笑得从凳子上滑下去','cg-thought'],['车门打开，下来一个','cg-return'],
 ['他身后没有影子','cg-no-shadow'],['两只球并排躺着','cg-drawer'],['跑过来把他拉起来','cg-hand'],
 ['像一颗流星','cg-meteor'],['抱成一团，满身面粉','cg-flour'],['整片拍面像花一样炸开','cg-break'],
 ['伸缩长拍伸出去，拍头碰到球','cg-ribbon'],['两只苍老的手一起拧开','cg-jar'],['球停在半空中，离地板还有一指','cg-last'],
];
function mood(text, direction='') {
 const s=direction+text;
 if(/眼泪|哭|声音发紧|声音在抖|低着头|眼眶/.test(s))return 'sad';
 if(/愣|惊|？！/.test(s))return 'surprise';
 if(/脸红|压低声音|耳朵红|我喜欢你/.test(s))return 'shy';
 if(/大喊|跳起来|欢呼/.test(s))return 'cheer';
 if(/笑|好笑/.test(s))return 'smile';
 if(/想|算|看着/.test(s))return 'think';
 return 'talk';
}
function tokenize(id, raw) {
 let body=raw;
 // Choice prose is authored in conditional, executable beats above.
 if(id==='2-1')body=body.replace(/【选择】[\s\S]*?(?=【演出】另一边)/,'【选择】\n\n');
 if(id==='5-5')body=body.replace(/【选择】[\s\S]*?(?=【演出】路先森打开)/,'【选择】\n\n');
 const inserted=[];
 for(const e of events[id]||[]){
   const at=body.indexOf(e.anchor);if(at<0)throw Error('Missing story anchor '+id+' '+e.anchor);
   const tag='@@BEAT_'+inserted.length+'@@';inserted.push(e.steps);
   body=body.slice(0,at)+tag+'\n\n'+body.slice(at);
 }
 let scene=baseScenes[id], rows=[],steps=[],condition=null, lesson=null, lessonUpdate=false, activeCG=null;
 const flush=()=>{if(rows.length)steps.push(D(scene,rows,condition));rows=[];};
 const setScene=value=>{if(value!==scene){flush();scene=value;activeCG=null;}};
 const when=value=>{flush();condition=value;};
 const push=(who,text,expression,meta={})=>{
   text=clean(text).replace(/^[“”]$/,'');if(!text)return;
   text=text.replace('球打在拍头上，翻过网，落在老南够不着的地方。','拍头接住球，收回拍前。丁丁亲手送出下一拍，球越过网，落在老南够不着的地方。').replace('伸缩长拍 + 悠悠球拍（够得远，手柄还能回球，不怕被假拍骗）','伸缩长拍 + 悠悠球拍（长拍直接拦截，悠悠接回后自己选择下一拍）');
   // Keep authored speech, including the stage direction when it matters to timing.
   rows.push([who,text,expression||'talk',meta.cue||null,{...meta,...(activeCG?{cg:activeCG}:{})}]);
 };
 const lines=body.split('\n');let started=false;
 for(let i=0;i<lines.length;i++){
   let line=lines[i].trim();if(!line||line==='---')continue;
   const beat=line.match(/^@@BEAT_(\d+)@@$/);
   if(beat){flush();steps.push(...inserted[Number(beat[1])]);continue;}
   if(!started){if(/^【演出】|^\*\*[^*]+\*\*.*[：:]/.test(line))started=true;else continue;}
   if(/^##|^\*\*【.*完】|^\*\*【全剧终】/.test(line))continue;
   if(/^【选择】/.test(line)){lesson=null;continue;}
   if(/^\*\*（选择 5-5 A/.test(line)){when({choice:'profile',value:'read'});continue;}
   if(/^\*\*（选择 5-5 B/.test(line)){when({choice:'profile',value:'wait'});continue;}
   if(/^\*\*（若 2-1/.test(line)){when({choice:'bow',value:'white'});continue;}
   if(/^\*\*失败\*\*|^\*\*丁丁输了|^\*\*丁丁负|^\*\*丁丁输掉第一局/.test(line)){when({outcome:false});continue;}
   if(/^\*\*胜利\*\*|^\*\*丁丁赢了|^\*\*丁丁胜|^\*\*丁丁赢下第一局/.test(line)){when({outcome:true});continue;}
   if(/^【知识/.test(line)){flush();condition=null;const n=line.match(/#(\d+)/);if(n)steps.push({t:'card',card:'v3_'+n[1].padStart(2,'0')});continue;}
   if(id==='8-2'&&line.startsWith('【演出】冉冉回到'))when(null);
   if(/^【教学/.test(line)){lesson=clean(line).replace(/[【】]/g,'');const key=Object.keys(lessonUpdates).find(k=>line.includes('·'+k+'】'));lessonUpdate=!!key;if(key){lesson='教学·'+key;for(const text of lessonUpdates[key])push('nar',text,'lesson',{title:lesson});}continue;}
   if(line.startsWith('>')&&lesson){if(lessonUpdate)continue;push('nar',line.replace(/^>\s?/,''),'lesson',{title:lesson});continue;}
   if(!line.startsWith('>')){lesson=null;lessonUpdate=false;}
   if(/^(（|\(\*\*)/.test(line)&&/小游戏结束|比赛结束|比赛[）:：]|小段操作|探索|接力比赛开始|打球。|无论怎么打|比赛中/.test(line))continue;
   for(const [needle,value] of sceneChanges)if(line.includes(needle))setScene(value);
   for(const [needle,value] of cgs)if(line.includes(needle)){flush();activeCG=value;}
   if(line.startsWith('【演出】')){
     const text=line.replace(/^【演出】/,'');
     const silent=/关上抽屉|揉面|全场寂静|罐子。封条|憋了三十年/.test(text)||id==='7-4'||(id==='8-4'&&text.includes('断'));
     let cue=/“嗒”/.test(text)?'clamp':/白光|戴上头环|球放进蒸笼/.test(text)?'enter':/大雨|下雨|雨落/.test(text)?'rain':/断了|“啪/.test(text)?'snap':/开门|门开|门关/.test(text)?'door':null;
     push('nar',text,'stage',{silent,cue,white:/^白屏/.test(clean(text)),black:/^黑屏/.test(clean(text))});continue;
   }
   if(line.startsWith('【意图】')||line.startsWith('【意图？】')){push('nar',line.replace(/^【意图[？]?】/,''),'intent',{title:'球记得的念头'});continue;}
   if(line.startsWith('【心里话】')){push('dingding',line.slice(5),'thought',{title:'心里话'});continue;}
   const spoken=line.replace(/^[-\d.]+\s*/,'').replace(/^>\s*/,'').match(/^\*\*([^*]+)\*\*(?:（(.*?)）)?[：:]\s*(.*)$/);
   if(spoken){
     let [_,name,direction='',text]=spoken;
     const actor=speakers[name]||(/路先森/.test(name)?'lu':null);
     if(actor){push(actor,text,mood(text,direction),{direction,speaker:name});continue;}
   }
   // Labels, screen readouts and exploration conversations are kept as narration.
   if(/^[（(].*[）)]$/.test(clean(line))||/第九节|建议设计|教学意义|可上场的人|最多 8 棒/.test(line))continue;
   const prose=clean(line.replace(/^[-]\s*/,''));
   if(prose)push('nar',prose,'stage');
 }
 flush();
 // Intro is a real cinematic beat, separate from dialogue; safe to resume or skip.
 const meta=raw.match(/^- (.+)$/m)?.[1]||'';
 steps.unshift({t:'cinema',scene:baseScenes[id],title:id+' · '+clean(raw.split('\n')[0]||''),caption:meta,transition:/^(0|4|5|7|8|10|11)-/.test(id)?'feather':'ink',intro:true});
 return steps;
}
const stageMatches=[...source.matchAll(/^### (\d+-\d+) (.+)$/gm)];
const chapters=chapterInfo.map(([title,date,scene,blurb],i)=>({id:'ch'+i,title,date,scene,blurb,venue:'homecourt',act:i<3?'听见':i<8?'被听见':'说出来',stages:[]}));
const charUnlocks={'1-4':'bobo','8-2':'miaomiao','5-4':'mage','11-1':'nan','0-4':'dingding','1-2':'ruibao','1-3':'houzi','2-2':'ranran','2-3':'xiaohong','2-4':'xingxing','3-2':'zhu','4-2':'canglan','4-3':'lingfeng','5-2':'lu','5-3':'laochen','6-2':'guoge','9-5':'tianchu'};
const featherUnlocks={...charUnlocks,'1-4':'bobo','8-2':'miaomiao','11-1':'nan'};
delete featherUnlocks['0-4'];
const gearUnlocks={'0-3':['r_flex'],'1-2':['sh_light'],'1-5':['r_tide'],'2-2':['r_silk'],'2-4':['sh_butterfly'],'3-1':['r_heavy','r_light'],'3-2':['sh_stable','s_crisp'],'3-3':['s_ctrl'],'3-5':['sh_cruise'],'4-2':['r_prism'],'4-3':['sh_moon'],'6-2':['r_shield'],'6-3':['s_rep','sh_cushion'],'9-1':['r_star']};
const knowledgeBy={};
const knowledgeTable=source.slice(source.indexOf('## 六、羽球知识卡'),source.indexOf('## 七、番外'));
const cards=[];
for(const line of knowledgeTable.split('\n')){
 const cells=line.split('|').map(s=>s.trim());if(!/^\d\d$/.test(cells[1]||''))continue;
 const [num,title,appear,text]=cells.slice(1,5),id='v3_'+num;
 cards.push({id,num,title:clean(title),cat:['01','09','21','22','24'].includes(num)?'gear':['04','05','10','11','15','19','23'].includes(num)?'rule':['13'].includes(num)?'fun':['07','12','17','20'].includes(num)?'tactic':'tech',text:clean(text),source:'screenplay'});
 for(const sid of appear.match(/\d+-\d+/g)||[])(knowledgeBy[sid]||=[]).push(id);
}
for(let i=0;i<stageMatches.length;i++){
 const m=stageMatches[i],id=m[1],chapter=Number(id.split('-')[0]);
 const end=i+1<stageMatches.length?stageMatches[i+1].index:source.indexOf('## 五、技能');
 let raw=source.slice(m.index+m[0].length,end);
 // The next chapter's heading is contextual metadata, not part of the previous stage.
 raw=raw.replace(/\n## (?:第|终)[\s\S]*$/,'');
 if(id==='11-5')raw=raw.replace(/### 尾声 · 掉磅/,'【演出】九月。清晨。王记包子铺。').replace(/### 片尾彩蛋（字幕后，依次播放）/,'【演出】字幕之后，还有几只球没有落地。');
 const steps=tokenize(id,'\n'+raw);
 if(id==='6-4')steps.push(D('league',[['nar','首轮采用积分制。输了一场，你仍然晋级了。','stage']],{outcome:false}));
 if(id==='8-3'){
  const at=steps.findIndex(s=>s.when?.outcome===false);
  steps.splice(at<0?steps.length:at,0,D('league',[['lu','经核实，南岸外援合同不符合本地选手条款。本场成绩作废，丁丁递补进入决赛。','talk'],['guoge','……持平。','think']],{outcome:false}));
 }
 steps[0].title=clean(m[2]);
 const knowledge=knowledgeBy[id]||[];
 const game=steps.find(s=>!['cinema','dialog','card'].includes(s.t));
 const st={id,title:clean(m[2]),scene:baseScenes[id],date:raw.match(/^- (.+)$/m)?.[1]||'',desc:id==='2-3'?'固定落区反射 · 两次校准回球':id==='1-1'?'三张小订单 · 菜包、肉包、加急单':id==='6-3'?'八组抽检 · 凑齐同侧十六根羽毛':clean(raw.match(/^- 目标：(.+)$/m)?.[1]||chapters[chapter].blurb),knowledge,kind:game?.t||'special',steps,rewards:{cards:knowledge,chars:charUnlocks[id]?[charUnlocks[id]]:[],gear:gearUnlocks[id]||[]},feather:featherUnlocks[id]||null};
 if(id==='9-1'){st.rewards.feats=['tension'];st.rewards.cards=[...new Set([...knowledge,'v3_24'])];}
 for(let j=0;j<steps.length;j++)steps[j].uid=id+':'+j;
 chapters[chapter].stages.push(st);
}
if(chapters.flatMap(ch=>ch.stages).length!==59)throw Error('Expected 59 main story stages');
if(cards.length!==24)throw Error('Expected 24 knowledge cards');
const hash=crypto.createHash('sha256').update(source).digest('hex');
const output=`/* Generated by tools/build-story-v3.js from STORY_SCRIPT_V3.md.\n * 十六根羽毛 · 主线全文与可执行演出。请修改剧本或编排器后重新生成。 */\n(function(G){'use strict';const Y=G.YY;Y.STORY_REVISION='sixteen-v3';Y.STORY_SOURCE_HASH=${JSON.stringify(hash)};Y.CAMPAIGN=${JSON.stringify(chapters)};Y.SIXTEEN_CARDS=${JSON.stringify(cards)};Y.LEGACY_STAGE_ORDER=[];})(typeof GameGlobal!=='undefined'?GameGlobal:typeof window!=='undefined'?window:globalThis);\n`;
fs.writeFileSync(path.join(root,'js/campaign.js'),output);
console.log('十六根羽毛：59 关，'+chapters.flatMap(c=>c.stages).reduce((n,s)=>n+s.steps.filter(b=>b.t==='dialog').reduce((k,b)=>k+b.lines.length,0),0)+' 行对白 / 演出，24 张知识卡。');
module.exports={chapters,cards};
