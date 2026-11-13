/* Four tactile games for the summer in Goose Bay. Input and drawing are shared. */
(function(G){
 'use strict';const Y=G.YY,CW=960,CH=480,TAU=Math.PI*2;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const holes=n=>{
  const cross=n>=8,i=n%8,u=(i+.5)/8;
  if(!cross){const x=325+u*245,dy=Math.sqrt(Math.max(0,1-Math.pow((x-448)/151,2)))*169;return[{x,y:211-dy},{x,y:211+dy}];}
  const y=65+u*288,dx=Math.sqrt(Math.max(0,1-Math.pow((y-211)/171,2)))*148;return[{x:448-dx,y},{x:448+dx,y}];
 };
 class StoryGame{
  constructor(step,saved){this.step=step;this.game=step.game;this.t=0;this.n=0;this.errors=0;this.best=0;this.caught=0;this.perfect=0;this.streak=0;this.orderFlash=0;this.tieTime=0;this.done=false;this.note='';this.started=false;this.phase='route';this.lineReady=false;this.force=18;this.holding=false;this.path=[];this.keys={};this.x=480;this.jump=0;this.spawn=0;this.ball=null;this.bins={left:0,right:0,waste:0};this.player={x:91,y:389};this.target=null;this.team={ruibao:false,houzi:false};this.alarm=0;
   if(saved&&saved.game===this.game){
    this.n=clamp(Math.floor(Number(saved.n)||0),0,this.game==='sorting'?999:this.goal);if(this.game==='stringing'&&saved.version!==2)this.n=saved.n>=16?this.goal:Math.min(this.pulls,Math.floor((saved.n||0)/16*this.pulls));this.caught=clamp(Number(saved.caught??saved.n)||0,0,this.n);this.perfect=clamp(Number(saved.perfect)||0,0,this.caught);this.streak=clamp(Number(saved.streak)||0,0,9);this.errors=clamp(Math.floor(Number(saved.errors)||0),0,9999);
    for(const key of ['left','right','waste'])this.bins[key]=clamp(Math.floor(Number(saved.bins?.[key])||0),0,999);
    for(const key of ['ruibao','houzi'])this.team[key]=saved.team?.[key]===true;
    this.player={x:clamp(Number(saved.player?.x)||91,60,887),y:clamp(Number(saved.player?.y)||389,80,409)};
    this.done=this.game==='stealth'?this.player.x>841&&this.player.y<160&&this.team.ruibao&&this.team.houzi:this.progress>=this.goal;
    if(this.game==='stringing'&&this.n===this.pulls)this.phase='tie';if(this.done)this.started=true;
   }
  }
  get pulls(){return this.step.rounds===2?2:4;}
  get goal(){return this.game==='stringing'?this.pulls+1:this.game==='baozi'?9:this.step.goal||16;}
  get routeIndex(){const half=this.pulls/2,cross=this.n>=half,i=this.n%half;return (cross?8:0)+Math.min(7,Math.floor((i+.5)/half*8));}
  get order(){return Math.min(2,Math.floor(this.n/3));}
  snapshot(){return{version:2,game:this.game,n:this.n,errors:this.errors,bins:this.bins,team:this.team,player:this.player,caught:this.caught,perfect:this.perfect,streak:this.streak};}
  get feather(){const type=['left','right','waste','left','right','left','waste','left'][this.n%8];return{type,side:type==='right'?-1:1,batch:4};}
  get progress(){if(this.game==='sorting')return Math.max(this.bins.left,this.bins.right);return this.n;}
  get stars(){return this.errors===0?3:this.errors<=3?2:1;}
  start(){this.started=true;this.note=this.game==='stealth'?'先安排队友，再从阴影里走到后门。':this.game==='baozi'?'听到“接！”时轻点起跳，然后朝包子的落点走。':'';}
  update(dt){
   if(this.done||!this.started)return;this.t+=dt;
   if(this.game==='stringing'){
    if(this.holding){if(this.phase==='tie')this.tieTime=Math.min(1.6,this.tieTime+dt);else this.force=Math.min(33,this.force+dt*(this.step.pressure?5.5:4.6));}
    return;
   }
   if(this.game==='baozi'){
    const mv=(this.keys.right?1:0)-(this.keys.left?1:0);this.x=clamp(this.x+mv*dt*480*(this.ball?.boost&&this.ball.t<.35?1.2:1),175,797);this.jump=Math.max(0,this.jump-dt);this.orderFlash=Math.max(0,this.orderFlash-dt);
    if(!this.ball){this.spawn-=dt;if(this.spawn<=0){const lane=[1,0,2,2,0,1,0,2,1][this.n%9],meat=this.order===1||(this.order===2&&this.n%2===0);this.ball={t:-.65,lane,meat,boost:false,T:this.order===2?(meat?1.05:1.28):meat?1.22:1.55};this.note=['第一单 · 菜包高抛','第二单 · 肉包快送','第三单 · 加急混装'][this.order]+'：接！';Y.Audio.storyAction?.('bun');}return;}
    const b=this.ball;b.t+=dt;
    if(b.t>=b.T){const tx=[255,480,705][b.lane],ok=Math.abs(this.x-tx)<(b.boost?94:65);this.n++;
      if(ok){this.caught++;this.streak++;this.best=Math.max(this.best,this.streak);if(b.boost)this.perfect++;this.note=b.boost?'垫步正好 · 稳稳接住！':'接住了！';Y.Audio.success?.();}
      else{this.errors++;this.streak=0;this.note='漏接一个，先接下一单。';}
      this.ball=null;this.spawn=this.n%3===0?.8:.16;if(this.n%3===0){this.orderFlash=.8;this.note=this.n===9?'三单送完！':'这一单收好 · 换一种节奏';}if(this.n>=this.goal)this.done=true;
    }
   }else if(this.game==='stealth'){
    this.alarm=Math.max(0,this.alarm-dt);const p=this.player;let dx=(this.keys.right?1:0)-(this.keys.left?1:0),dy=(this.keys.down?1:0)-(this.keys.up?1:0);
    if(this.target){const d=dist(p,this.target);if(d<5)this.target=null;else{dx=(this.target.x-p.x)/d;dy=(this.target.y-p.y)/d;}}
    const len=Math.max(1,Math.hypot(dx,dy));p.x=clamp(p.x+dx/len*dt*135,60,887);p.y=clamp(p.y+dy/len*dt*135,80,409);
    const cover=this.coverAt(p),angle=Math.atan2(p.y-56,p.x-822),scan=2.06+Math.sin(this.t*.61)*.82;const diff=Math.atan2(Math.sin(angle-scan),Math.cos(angle-scan));
    if(!cover&&Math.abs(diff)<.2&&this.alarm<=0){this.errors++;this.alarm=1.5;Object.assign(p,this.lastCover||{x:91,y:389});this.target=null;this.note='手电扫过来了，回到阴影，再等一次。';Y.Audio.storyAction?.('switch');}
    if(cover)this.lastCover={...p};
    this.n=Math.max(this.n,Math.floor(p.x/210));
    if(p.x>841&&p.y<160){if(this.team.ruibao&&this.team.houzi){this.done=true;this.note='找到了后门。里面的球，每只都贴着一个名字。';}else{this.note='瑞宝还没藏好，猴子的直播也还开着。先安排好他们。';p.x=825;}}
   }
  }
  coverAt(p){return [{x:65,y:316,w:136,h:114},{x:256,y:224,w:149,h:129},{x:484,y:285,w:159,h:132},{x:672,y:123,w:123,h:161}].some(r=>p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h);}
  key(key,down){
   if(!['Space','Enter','KeyA','KeyD','KeyX','KeyW','KeyS','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(key))return false;
   if(this.keys[key]===down)return true;this.keys[key]=down;
   if(this.game==='sorting'){const pick={KeyA:'left',KeyD:'right',KeyX:'waste',ArrowLeft:'left',ArrowRight:'right',ArrowDown:'waste'}[key];if(pick){if(down)this.action(pick);return true;}}
   const dir={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down'}[key];if(dir){this.keys[dir]=down;this.target=null;return true;}
   if(['Space','Enter'].includes(key)){if(!this.started){if(down)this.start();return true;}if(this.game==='stringing'){if(this.phase==='tension'||this.phase==='tie')this.action('pull',down);else if(down)this.action('thread');}else if(down)this.action('jump');return true;}return false;
  }
  action(name,down){
   if(this.done)return;if(name==='start'){this.start();return;}if(!this.started)return;
   if(this.game==='stringing'){
    if(this.phase==='tie'&&name==='pull'){
      if(down){if(!this.holding){this.holding=true;this.tieTime=0;}return;}if(!this.holding)return;this.holding=false;
      if(this.tieTime>=.4&&this.tieTime<=1.05){this.n=this.goal;this.done=true;this.note='结收住了。拍线轻轻一响。';Y.Audio.storyAction?.('clamp');}
      else{this.errors++;this.note=this.tieTime<.4?'结还没收紧，轻拉半秒。':'太用力了，轻拉半秒就好。';this.tieTime=0;}return;
    }
    if(name==='thread'&&this.phase==='route'){this.lineReady=true;this.phase='tension';this.force=18;this.note='按住拉线，到 '+(this.step.tension||24)+' 磅松开。';return;}
    if(name==='pull'&&this.phase==='tension'){
     if(down){if(!this.holding){this.holding=true;this.force=18;}return;}if(!this.holding)return;this.holding=false;
     const error=Math.abs(this.force-(this.step.tension||24));
     if(error<=1){this.n++;this.best=Math.max(this.best,1-error);this.phase=this.n>=this.pulls?'tie':'route';this.lineReady=false;this.path=[];this.note=this.n===this.pulls/2?'竖线成组夹好。换到横线。':this.n===this.pulls?'拍面成形 · 轻拉半秒，收尾打结。':'这一组张力稳定。下一组。';Y.Audio.storyAction?.('clamp');}
     else{this.errors++;this.note=this.force>30?'拉断了。换一根，别绷得太紧。':'差了 '+error.toFixed(1)+' 磅，松开重来。';Y.Audio.storyAction?.(this.force>30?'snap':'paper');this.force=18;}
    }
   }else if(this.game==='baozi'){
    if(name==='left'||name==='right'){this.x=clamp(this.x+(name==='left'?-225:225),255,705);return;}
    if(name==='jump'){this.jump=.38;if(this.ball&&this.ball.t>=-.65&&this.ball.t<-.14){this.ball.boost=true;this.note='垫步！现在移动。';}}
   }else if(this.game==='sorting'){
    if(!['left','right','waste'].includes(name))return;const f=this.feather;
    if(name===f.type){this.bins[name]+=f.batch;this.n++;this.note=name==='waste'?'这一组有缺损，整组留作废料。':'抽检合格 · 同批四根入筐。';Y.Audio.storyAction?.('paper');if(this.progress>=16)this.done=true;}
    else{this.errors++;this.note=f.type==='waste'?'这根有缺口，应该去废料筐。':'看羽轴弯曲的方向，再试一次。';}
   }else if(this.game==='stealth'){
    if(name==='ruibao'||name==='houzi'){this.team[name]=!this.team[name];this.note=name==='houzi'?'猴子：好好好，这次真关了。':'瑞宝躲到货架后面。';return;}
    const dir={left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]}[name];if(dir){this.target={x:clamp(this.player.x+dir[0]*83,60,887),y:clamp(this.player.y+dir[1]*80,80,409)};}
   }
  }
  pointer(type,p){
   if(this.done||!this.started)return;
   if(this.game==='stringing'){
    const [a,b]=holes(this.routeIndex);
    if(type==='down'&&this.phase==='route'&&dist(p,a)<38){this.drag={from:a,to:p};this.note='拖到另一端的发光穿线孔。';return;}
    if(type==='move'&&this.drag){this.drag.to=p;return;}
    if(type==='up'&&this.drag){if(dist(p,b)<40)this.action('thread');else this.note='线头还没穿过去，再来一次。';this.drag=null;return;}
   }else if(this.game==='sorting'){
    if(type==='down'&&Math.abs(p.x-480)<130&&p.y<300)this.drag={to:p};if(type==='move'&&this.drag)this.drag.to=p;
    if(type==='up'&&this.drag){this.drag=null;if(p.y>292)this.action(p.x<337?'left':p.x>623?'right':'waste');}
   }else if(this.game==='baozi'&&type==='move')this.x=clamp(p.x,175,797);
   else if(this.game==='stealth'&&type==='up'&&p.y<421)this.target={x:clamp(p.x,60,887),y:clamp(p.y,80,409)};
  }
  cancel(){this.holding=false;this.drag=null;this.keys={};this.target=null;}
 }
 Y.StoryGame=StoryGame;
 Y.storyGameControls=function(a){if(!a.started)return[{id:'start',text:'准备好了',x:373,y:365,w:214,h:56}];if(a.done)return[{id:'done',text:'收好这一段 · 继续',x:341,y:375,w:278,h:52}];
  if(a.game==='stringing')return[{id:a.phase==='route'?'thread':'pull',text:a.phase==='route'?'穿好这一组 · 空格':a.phase==='tie'?(a.holding?'亮起时松开':'轻拉收尾 · 按住'):(a.holding?'到目标磅数时松开':'按住拉线'),x:689,y:321,w:226,h:62,hold:a.phase==='tension'||a.phase==='tie'}];
  if(a.game==='sorting')return[{id:'left',text:'左翅毛 · A',x:91,y:336,w:213,h:69},{id:'waste',text:'废料 · X',x:373,y:336,w:213,h:69},{id:'right',text:'右翅毛 · D',x:656,y:336,w:213,h:69}];
  if(a.game==='baozi')return[{id:'left',text:'←',x:46,y:379,w:108,h:61},{id:'right',text:'→',x:164,y:379,w:108,h:61},{id:'jump',text:'垫步 · 空格',x:720,y:379,w:188,h:61}];
  return[{id:'ruibao',text:a.team.ruibao?'✓ 瑞宝藏好了':'瑞宝留在阴影',x:55,y:13,w:213,h:43},{id:'houzi',text:a.team.houzi?'✓ 猴子关麦了':'让猴子关闭直播',x:281,y:13,w:213,h:43},...['left','up','down','right'].map((id,i)=>({id,text:{left:'←',up:'↑',down:'↓',right:'→'}[id],x:462+i*113,y:426,w:101,h:43}))];
 };
 Y.drawStoryGame=function(g,a,x,y,w,h,theme){
  const sx=w/CW,sy=h/CH;g.save();g.translate(x,y);g.scale(sx,sy);g.beginPath();g.rect(0,0,CW,CH);g.clip();
  const box=(x,y,w,h,c,stroke)=>{Y.rr(g,x,y,w,h,5);g.fillStyle=c;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=2;g.stroke();}},text=(s,x,y,size=22,c='#f5f7fc',align='left')=>{if(theme)c=({'#f5f7fc':theme.text,'#c2cce0':theme.sub,'#ffcf4a':theme.gold,'#5fd4ff':theme.cyan,'#a6c6e5':theme.sub,'#9eb8d9':theme.dim,'#d9eeff':theme.text,'#acbdd6':theme.dim})[c]||c;g.font=`500 ${size}px "PingFang SC","Microsoft YaHei",sans-serif`;g.fillStyle=c;g.textAlign=align;g.textBaseline='middle';g.fillText(s,x,y);},line=(points,c='#dbcca8',width=2)=>{g.beginPath();points.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.strokeStyle=c;g.lineWidth=width;g.stroke();},oval=(x,y,rx,ry,c)=>{g.beginPath();g.ellipse(x,y,rx,ry,0,0,TAU);g.fillStyle=c;g.fill();};
  if(!a.backdrop){const cv=Y.platform.createCanvas();cv.width=CW;cv.height=CH;Y.paintStoryArt(cv.getContext('2d'),({stringing:'stringing',baozi:'bakery',sorting:'goosefarm',stealth:'warehouse'})[a.game],0,0,CW,CH);a.backdrop=cv;}g.drawImage(a.backdrop,0,0);box(0,0,CW,CH,theme?theme.bg+'ba':'#08142cba');
  if(a.game==='stringing'){
   for(let i=0;i<16;i++)line([[i*67,0],[i*67,480]],'#5fd4ff15',1);
   oval(448,211,158,180,'#86b1d4');oval(448,211,147,169,'#142845');g.strokeStyle='#e2f3ff';g.lineWidth=8;g.stroke();line([[450,391],[458,475]],'#ffc94c',16);
   const covered=Math.min(16,Math.floor(Math.min(a.n,a.pulls)/a.pulls*16));
   for(let n=0;n<covered;n++){const h=holes(n);line(h.map(p=>[p.x,p.y]),'#c1ecff',1.7);}
   const [p,q]=holes(a.routeIndex),tie=a.phase==='tie';
   if(!tie){line([[p.x,p.y],[q.x,q.y]],'#5fd4ff55',1);oval(p.x,p.y,10,10,'#ffcf4a');oval(q.x,q.y,10,10,'#5fd4ff');if(a.phase==='tension')line([[p.x,p.y],[q.x,q.y]],'#ffcf4a',3);if(a.drag)line([[a.drag.from.x,a.drag.from.y],[a.drag.to.x,a.drag.to.y]],'#ffcf4a',3);}
   text(tie?'收尾':a.n<a.pulls/2?'先竖':'再横',97,109,37);text(tie?'轻拉 · 打结':(a.n+1)+' / '+a.pulls+' 组',97,156,22,'#a6c6e5');
   const by=199,bx=694,bw=205,target=a.step.tension||24;
   text(tie?'收结力度':'目标张力',697,87,17,'#9eb8d9');text(tie?'轻拉半秒':target+' 磅',697,128,tie?33:45);
   box(bx,by,bw,16,theme?.panelBot||'#0b142b');
   if(tie){box(bx+.4/1.6*bw,by,.65/1.6*bw,16,'#41bb95');const px=bx+a.tieTime/1.6*bw;line([[px,by-9],[px,by+30]],'#fff0ac',3);text(a.holding?a.tieTime.toFixed(1)+' 秒':'绿区松开，完成收尾',bx,by+58,23,'#d9eeff');g.strokeStyle='#ffcf4a';g.lineWidth=4;g.beginPath();g.ellipse(448,378,24,12,0,0,TAU);g.stroke();}
   else{box(bx+(target-1-18)/15*bw,by,bw*2/15,16,'#41bb95');const px=bx+(a.force-18)/15*bw;line([[px,by-9],[px,by+30]],'#fff0ac',3);text(a.force.toFixed(1)+' lb',bx,by+58,26,a.force>30?'#ff5d6c':'#d9eeff');}
   for(let i=0;i<3;i++){const active=tie?2:a.n<a.pulls/2?0:1;box(77+i*103,430,91,27,i===active?'#ffcf4a':'#233b59');text(['竖线成组','横线交织','轻拉打结'][i],122+i*103,444,14,i===active?'#172039':'#acbdd6','center');}
  }else if(a.game==='sorting'){
   for(let i=0;i<12;i++)line([[0,40+i*36],[960,40+i*36]],'#8db8ff15',1);const f=a.feather,tx=a.drag?.to.x||480,ty=a.drag?.to.y||155,side=f.side;
   g.save();g.translate(tx,ty);g.rotate(side*.2);g.beginPath();g.moveTo(0,100);g.quadraticCurveTo(-75*side,35,-51*side,-70);g.quadraticCurveTo(0,-146,42*side,-70);g.quadraticCurveTo(81*side,31,0,100);g.fillStyle='#f1faff';g.fill();g.strokeStyle='#8cb6d9';g.lineWidth=2;g.stroke();line([[0,118],[-6*side,21],[0,-101]],'#ffcf4a',2);
   for(let i=0;i<13;i++){const yy=84-i*14;line([[-3*side,yy],[side*(42-i),yy-28]],'#79add2',1);}if(f.type==='waste'){g.fillStyle='#142440';g.fillRect(-85,-21,72,18);line([[-63,-32],[-13,-4]],'#ff5d6c',3);}g.restore();
   text('抽检一组 · 同批四根入筐',480,32,24,'#f5f7fc','center');for(let i=0;i<4;i++){line([[373+i*20,256],[381+i*20,230]],'#bce9ff',3);oval(374+i*20,256,4,4,'#ffcf4a');};text('左翅 '+a.bins.left+' / 16',198,297,21,'#5fd4ff','center');text('废料 '+a.bins.waste,480,297,21,'#c2cce0','center');text('右翅 '+a.bins.right+' / 16',761,297,21,'#5fd4ff','center');
  }else if(a.game==='baozi'){
   const ground=g.createLinearGradient(0,262,0,480);ground.addColorStop(0,'#385777');ground.addColorStop(1,'#132844');box(0,262,960,218,ground);for(let i=-5;i<=5;i++)line([[480+i*90,262],[480+i*160,480]],'#8cb5d523',1);for(let i=0;i<4;i++)line([[0,278+i*i*18],[960,278+i*i*18]],'#a6cbe51a',1);for(let i=0;i<3;i++){const xx=[255,480,705][i];oval(xx,331,74,13,'#0a163855');line([[xx,289],[xx,367]],'#5fd4ff44',1);}
   const b=a.ball;box(38,157,151,113,'#b47a46');for(let i=0;i<5;i++)line([[54,170+i*17],[176,170+i*17]],'#754c36',2);text('王记',109,208,28,'#fff0bd','center');
   if(b){const T=b.T,u=clamp(b.t/T,0,1),tx=[255,480,705][b.lane],bx=125+(tx-125)*u,by=160+170*u-Math.sin(u*Math.PI)*(b.meat?65:120);oval(bx,by,20,14,b.meat?'#f4cf94':'#fff5da');line([[bx-9,by-6],[bx,by-11],[bx+8,by-4]],'#a97947',1.3);if(b.t<0)text('接！',480,116,38,'#ffcf4a','center');oval(tx,331,55,9,b.boost?'#5fd4ff66':'#ffcf4a55');text(b.meat?'肉包 · 低快':'菜包 · 高抛',tx,300,19,'#fff0bd','center');}
   const px=a.x,j=a.jump>0?Math.sin(a.jump/.38*Math.PI)*23:0;g.save();g.translate(px,382-j);g.scale(62,-62);const player={idx:0,dir:1,vx:0,vy:0,onGround:true,swing:null,runPhase:0,land:0,x:0,y:0},options={time:a.t,mood:'focus',hideRacket:true,f:1,spring:[0,0]},pose=Y.charPose(player,a.t,options);pose.E=[.40,1.06];pose.W=[.56,.82];pose.E2=[-.28,1.03];pose.W2=[-.50,.82];Y.drawCharacter(g,player,Y.lookOf('dingding'),{...options,pose});g.restore();box(px-52,333-j,104,22,'#a96d3d','#0c1a2e');oval(px,333-j,53,10,'#f0c589');for(let i=-5;i<=5;i++)line([[px+i*9,340-j],[px+i*9,351-j]],'#68472f',1.5);oval(px,332-j,43,5,'#bf8d57');text('接住 '+a.caught+' / 9',830,48,27,'#ffcf4a','center');text(['01 菜包单','02 肉包单','03 加急单'][a.order],480,43,28,'#f5f7fc','center');for(let i=0;i<9;i++)box(351+i*29,70,21,5,i<a.n?'#ffcf4a':'#5c7396');if(a.streak>=2)text('连稳 '+a.streak,845,99,20,'#5fd4ff','center');
  }else{
   box(18,70,908,346,'#0a162cdd');const crates=[{x:65,y:316,w:136,h:114},{x:256,y:224,w:149,h:129},{x:484,y:285,w:159,h:132},{x:672,y:123,w:123,h:161}];
   for(const r of crates){box(r.x+15,r.y-13,r.w-30,r.h-22,'#345c85','#7aa7d3');line([[r.x+25,r.y],[r.x+r.w-22,r.y+r.h-40]],'#182e50',4);}
   const scan=2.06+Math.sin(a.t*.61)*.82;g.beginPath();g.moveTo(822,56);g.arc(822,56,780,scan-.2,scan+.2);g.closePath();g.fillStyle='#ffcf4a38';g.fill();oval(822,56,13,13,'#fff0b9');
   box(844,76,56,88,'#287e9a');text('后门',872,104,17,'#e4faff','center');oval(a.player.x,a.player.y,15,15,a.alarm>0?'#ff5d6c':'#ffcf4a');oval(a.player.x,a.player.y-4,7,8,'#f1c8a7');oval(a.player.x,a.player.y-10,8,4,'#24374f');if(a.coverAt(a.player)){g.strokeStyle='#5fd4ff';g.lineWidth=1.5;g.beginPath();g.arc(a.player.x,a.player.y,23,0,TAU);g.stroke();}line([[65,462],[405,462]],'#365477',3);line([[65,462],[65+340*clamp((a.player.x-91)/760,0,1),462]],'#5fd4ff',3);text(a.coverAt(a.player)?'阴影中 · 等灯扫过':'移动中 · 找下一处阴影',232,438,17,'#c2d8ec','center');if(a.target){g.strokeStyle='#5fd4ff88';g.beginPath();g.arc(a.target.x,a.target.y,9,0,TAU);g.stroke();}if(a.alarm>0){box(0,0,960,480,'#ff5d6c22');text('回到阴影',480,200,42,'#ffd1d5','center');}
  }
  if(!a.started){box(0,0,960,480,theme?theme.bg+'e9':'#070f24d9');text({stringing:'先竖，后横。别绷得太紧。',baozi:'一笼包子的早高峰',sorting:'一根也不能混',stealth:'手电扫过来之前'}[a.game],480,157,41,'#f5f7fc','center');text({stringing:'成组穿线 → 张力校准 → 轻拉收结。空格可代替拖动。',baozi:'三张小订单，各送三个。听“接！”垫步，追着金色落点接。',sorting:'看弯曲方向和缺口，抽检一根，整组四根归入同一个筐。',stealth:'点地面移动。货架的阴影能藏住你，先照顾好队友。'}[a.game],480,221,21,'#c2cce0','center');}
  if(a.done){box(0,0,960,480,theme?theme.bg+'e8':'#0a1633e8');text({stringing:'嗒。线穿好了。',baozi:'三单送完，热气还在。',sorting:'十六根，都在。',stealth:'后门开着。'}[a.game],480,155,47,'#ffcf4a','center');text(a.game==='baozi'?'接住 '+a.caught+' 个 · 完美垫步 '+a.perfect+' 次':'失误 '+a.errors+' 次 · 每一次重来都算数',480,222,22,'#c2cce0','center');}
  g.restore();return{x,y,w,h};
 };
 Object.assign(Y.storyActions,{
  playMinigame(step){const saved=this.story?.resume?.activity?.game;this.storyGame=new StoryGame(step,saved);this.show('minigame');},
  updateStoryGame(dt){const a=this.storyGame;if(this.screen==='minigame'&&a){a.update(dt);const signature=JSON.stringify([a.n,a.errors,a.bins,a.team,a.done]);a.saveAge=(a.saveAge||0)+dt;if(signature!==a.savedSignature||a.game==='stealth'&&!a.done&&a.saveAge>=.8){a.savedSignature=signature;a.saveAge=0;this.saveStoryCheckpoint({activity:{game:a.snapshot()}});}}},
  storyGameAction(id,down){const a=this.storyGame;if(!a)return;if(id==='done'){if(a.done){this.storyGame=null;this.activityDone(a.stars,'完成'+a.step.title+' · 失误 '+a.errors+' 次');}return;}a.action(id,down);this.saveStoryCheckpoint({activity:{game:a.snapshot()}});},
  storyGamePointer(type,p){this.storyGame?.pointer(type,p);},
 });
})(typeof GameGlobal!=='undefined'?GameGlobal:typeof window!=='undefined'?window:globalThis);
