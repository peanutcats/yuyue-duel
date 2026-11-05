/* Shared story activities, checkpointing and teaching diagrams. */
(function (G) {
  'use strict';
  const YY=G.YY, C=YY.C;
  const defaults = { promise:'训练要有计划，也要允许失误。',houzi:'这次别一个人扛着。',encourage:'先打深，我们有时间。',guoge:'说清楚，你到底站哪边？',lineup:'猴子',future:'新手友好开放日',ending:'这里永远有你的位置。' };
  YY.storyText = (text, ctx) => text.replace(/\{(\w+)\}/g, (_,key) => ctx?.choices?.[key] || YY.Profile.d.campaign?.choices?.[key] || defaults[key] || '');
  YY.voiceKey = (who,text) => { let h=2166136261; for(const c of who+'|'+text) h=Math.imul(h^c.charCodeAt(0),16777619); return 'v'+(h>>>0).toString(16); };
  YY.STORY_DEFAULTS = defaults;
  YY.LABS = {
    arc: { title:'三条弧线', hint:'保持出球点一致，试完三种弧线，再选择能争取较多回位时间的一种。', target:2, labels:['平快','中等弧线','高远弧线'], notes:['飞得快，给双方的准备时间少。','弧线居中，可以比较时间与深度。','较高的弧线延长滞空，为回位争取时间。'], setups:[{angle:18,speed:15},{angle:40,speed:16},{angle:62,speed:18}] },
    tension: { title:'三种试拍感觉', hint:'为初学者选择更容易稳定回球的设定。图示使用游戏模型，不是现实穿线推荐。', target:0, labels:['宽容设定','均衡设定','精细设定'], notes:['游戏模型中的容错范围较大，更适合先练稳定击球。','要求与容错居中，可在稳定后试用。','模型的容错较小，并不意味着一定更好。'], setups:[{angle:52,speed:16,tolerance:.7},{angle:52,speed:16,tolerance:.5},{angle:52,speed:16,tolerance:.3}] },
    air: { title:'只改变空气阻力', hint:'出球角度、速度保持相同。选择阻力较小、同样出球飞得更远的一种。', target:2, labels:['阻力较大','常规阻力','阻力较小'], notes:['球减速更明显，落点较近。','这是对照组，用来比较变化。','球减速较少，落点更远。现实选球仍要现场试打。'], setups:[{angle:55,speed:17,drag:.115},{angle:55,speed:17,drag:.08},{angle:55,speed:17,drag:.055}] },
  };
  YY.labTrajectory = (experiment,index) => { const set=YY.LABS[experiment].setups[index]; const a=set.angle*Math.PI/180; return YY.simulate(-4.5,1.8,set.speed*Math.cos(a),set.speed*Math.sin(a),8,true,false,{drag:set.drag??C.DRAG}); };
  YY.storyActions = {
    saveStoryCheckpoint(extra) {
      const s=this.story;if(!s)return;
      const cp={version:1,stage:s.st.id,index:s.i,stars:s.stars,ctx:s.ctx,...extra};
      YY.Profile.d.campaign.checkpoint=JSON.parse(JSON.stringify(cp));YY.Profile.save();
    },
    storyLine() {
      const d=this.dlg;if(!d || d.i<0 || d.i>=d.lines.length)return;
      const line=d.lines[d.i];
      this.saveStoryCheckpoint({line:d.i});
      if(line[3])YY.Audio.storyAction?.(line[3]);
      if(this.settings.voice!==false)YY.Audio.voiceLine?.(line[0],line[1]);
    },
    repeatStoryVoice() { const d=this.dlg;if(d&&this.settings.voice!==false)YY.Audio.voiceLine?.(d.lines[d.i][0],d.lines[d.i][1]); },
    toggleStoryVoice() { this.settings.voice=this.settings.voice===false;this.saveSettings?.();if(this.settings.voice===false)YY.Audio.stopVoice?.();else this.repeatStoryVoice(); },
    rememberChoice(step,index) {
      if(!step.key || !step.o[index])return;
      const c=step.o[index];this.story.ctx.choices=this.story.ctx.choices||{};
      this.story.ctx.choices[step.key]=c.reply || c.label;
      YY.Profile.d.campaign.choices[step.key]=c.reply || c.label;this.saveStoryCheckpoint();
    },
    bestStoryStep(stars) {
      const s=this.story;if(!s)return stars;
      const key=s.st.id+':'+s.i, best=YY.Profile.d.campaign.best;
      best[key]=Math.max(best[key]||0,stars);YY.Profile.save();return best[key];
    },
    storyStageStars() {
      const s=this.story, values=s.st.steps.map((step,i)=> ['dialog','pick'].includes(step.t)?null:YY.Profile.d.campaign.best[s.st.id+':'+i]).filter(v=>v!=null);
      return Math.max(1,Math.min(3,values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):3));
    },
    completeStorySave() { YY.Profile.d.campaign.checkpoint=null;YY.Profile.save(); },
    playInspect(step) {
      const cp=YY.Profile.d.campaign.checkpoint;
      this.activity={step,found:cp?.activity?.found?.filter(id=>step.items.some(item=>item.id===id))||[],selected:null};this.show('inspect');
    },
    inspectItem(id) {
      const a=this.activity,item=a?.step.items.find(it=>it.id===id);if(!item)return;
      a.selected=id;if(!a.found.includes(id))a.found.push(id);
      if(item.clue&&!YY.Profile.d.campaign.clues.includes(item.clue))YY.Profile.d.campaign.clues.push(item.clue);
      YY.Audio.storyAction?.('paper');this.saveStoryCheckpoint({activity:{found:a.found}});
    },
    finishInspect() { const a=this.activity;if(!a||a.found.length!==a.step.items.length)return;this.activity=null;this.activityDone(3,'全部线索已记录'); },
    playBoard(step) { this.activity={step,index:0,right:0,selected:null};this.show('board'); },
    boardAnswer(index) { const a=this.activity;if(!a||a.selected!=null)return;const c=a.step.cases[a.index];if(!c.options[index])return;a.selected=index;if(index===c.answer){a.right++;YY.Audio.success?.();}else YY.Audio.click(); },
    boardNext() { const a=this.activity;if(!a||a.selected==null)return;if(a.index+1<a.step.cases.length){a.index++;a.selected=null;}else {const stars=1+Math.round(2*a.right/a.step.cases.length);this.activity=null;this.activityDone(stars,`图示判断 ${a.right}/${a.step.cases.length} · 看懂解析即可继续`);} },
    playLab(step) { this.activity={step,experiment:step.experiment,selected:0,tried:[],results:{},result:null,age:0,note:''};this.show('lab'); },
    labSelect(i) { const a=this.activity;if(!a||!YY.LABS[a.experiment]?.setups[i])return;a.selected=i;a.result=null;a.note=''; },
    labTry() { const a=this.activity;if(!a)return;a.result=a.results[a.selected]||(a.results[a.selected]=YY.labTrajectory(a.experiment,a.selected));a.age=0;if(!a.tried.includes(a.selected))a.tried.push(a.selected);a.note=YY.LABS[a.experiment].notes[a.selected];YY.Audio.hit(.7,false,{serve:true}); },
    finishLab() { const a=this.activity;if(!a)return;const def=YY.LABS[a.experiment];if(a.tried.length<3){a.note='先把三种设置都试一次，再比较。';return;}if(a.selected!==def.target){a.note='再比较一次：'+def.hint;return;}this.activity=null;this.activityDone(3,'完成三组对照实验，找到适合当前目标的设置'); },
    activityDone(stars,main) {
      this.storyStep=this.story.st.steps[this.story.i];
      this.showStepResult({win:true,stars,main,goals:[{text:'完成观察与学习',ok:true}]});
    },
  };
  // Field is drawn in real aspect ratio from overhead for line/rule activities.
  // 数据图：'chart:标题|标签=数值,标签=数值'（老陈的表格题）
  YY.drawDataChart=function(g,picture,x,y,w,h,reveal) {
    const [title,body]=picture.slice(6).split('|'),rows=(body||'').split(',').map(r=>{const [k,v]=r.split('=');return [k,Number(v)||0];});
    const max=Math.max(1,...rows.map(r=>r[1])),top=46,bottom=h-34,bw=Math.min(70,(w-40)/rows.length*.62);
    g.save();g.translate(x,y);g.fillStyle='#14233a';g.fillRect(0,0,w,h);
    g.fillStyle='#f3cf86';g.font='bold 14px sans-serif';g.textAlign='left';g.fillText(title,14,26);
    g.strokeStyle='rgba(255,255,255,.18)';g.lineWidth=1;for(let i=0;i<=4;i++){const yy=bottom-(bottom-top)*i/4;g.beginPath();g.moveTo(18,yy);g.lineTo(w-14,yy);g.stroke();}
    const best=rows.reduce((a,r,i)=>r[1]>rows[a][1]?i:a,0);
    rows.forEach(([k,v],i)=>{const cx=20+(w-34)*(i+.5)/rows.length,bh=(bottom-top)*v/max;
      g.fillStyle=reveal&&i===best?'#ffd45c':['#6fe3d0','#6cb5f5','#ff8a7a','#c7a6ff','#7dffb0'][i%5];g.fillRect(cx-bw/2,bottom-bh,bw,bh);
      g.fillStyle='#edf3ff';g.font='12px sans-serif';g.textAlign='center';g.fillText(k,cx,bottom+16);g.font='bold 12px sans-serif';g.fillText(String(v),cx,bottom-bh-6);});
    g.fillStyle='rgba(255,255,255,.6)';g.font='11px sans-serif';g.textAlign='left';g.fillText('老陈整理 · 游戏内统计示意',10,h-6);g.restore();
  };
  YY.drawLessonBoard=function(g,picture,x,y,w,h,reveal) {
    if(typeof picture==='string'&&picture.startsWith('chart:'))return YY.drawDataChart(g,picture,x,y,w,h,reveal);
    g.save();g.translate(x,y);
    g.fillStyle='#132c31';g.fillRect(0,0,w,h);
    const cw=Math.min(w*.8,(h-40)*6.1/13.4),ch=cw*13.4/6.1,left=(w-cw)/2,right=left+cw,top=(h-ch)/2-6,bottom=top+ch,mid=(top+bottom)/2,inner=cw*.46/6.1;
    const X=u=>left+u*cw,Y=u=>top+u*ch,short=1.98/13.4,back=.76/13.4;
    const line=(x1,y1,x2,y2,col='#e3efdf',lw=1.5)=>{g.strokeStyle=col;g.lineWidth=lw;g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();};
    g.strokeStyle='#e3efdf';g.lineWidth=2;g.strokeRect(left,top,right-left,bottom-top);
    line(left+inner,top,left+inner,bottom);line(right-inner,top,right-inner,bottom);
    line(left,mid,right,mid,'#ffd665',3);
    for(const z of [.5-short,.5+short,back,1-back])line(left,Y(z),right,Y(z));
    line(w/2,top,w/2,Y(.5-short));line(w/2,Y(.5+short),w/2,bottom);
    const pawn=(px,py,color,label)=>{g.fillStyle=color;g.beginPath();g.arc(px,py,Math.max(6,w*.022),0,Math.PI*2);g.fill();g.font='bold 12px sans-serif';g.textAlign='center';g.fillStyle='#fff';g.fillText(label,px,py-13);};
    const dot=(px,py)=>{g.fillStyle='#ffdd59';g.beginPath();g.arc(px,py,6,0,Math.PI*2);g.fill();if(reveal){g.strokeStyle='#ffdd59';g.lineWidth=2;g.beginPath();g.arc(px,py,12,0,Math.PI*2);g.stroke();}};
    let py=.23;
    if(picture==='opponent-front')py=.42;
    if(picture==='opponent-middle')py=.3;
    pawn(X(.5),Y(py),'#e16d78','对手');pawn(X(picture==='doubles-defense'||picture==='doubles-middle'?.27:.5),Y(.75),'#60cfff','你');
    if(picture==='line-in')dot(left+inner,Y(.7));
    else if(['singles-out','doubles-in'].includes(picture))dot(left+inner*.45,Y(.7));
    else if(picture==='doubles-serve-long')dot(X(.75),Y(.97));
    else if(picture==='singles-serve')dot(X(.75),Y(.82));
    else if(picture==='serve-foot')pawn(left+inner,Y(.73),'#60cfff','脚踩线');
    else if(picture==='serve-even'||picture==='serve-odd'){g.fillStyle='rgba(255,220,90,.18)';g.fillRect(picture==='serve-even'?w/2:left+inner,Y(.5+short),cw/2-inner,bottom-Y(.5+short));}
    else if(picture==='doubles-attack'){pawn(X(.5),Y(.59),'#60cfff','搭档');}
    else if(picture==='doubles-defense'||picture==='doubles-middle'){pawn(X(.73),Y(.75),'#60cfff','搭档');}
    else dot(X(.48),Y(.61));
    g.fillStyle='rgba(255,255,255,.72)';g.font='11px sans-serif';g.textAlign='left';g.fillText('俯视示意 · 黄色横线为球网',10,h-8);g.restore();
  };
  YY.drawLab=function(g,a,x,y,w,h) {
    g.save();g.translate(x,y);g.fillStyle='#101e32';g.fillRect(0,0,w,h);
    const sx=v=>w*.08+(v+7)/16*w*.84,sy=v=>h*.86-v/7*h*.75;
    g.strokeStyle='#8faabd';g.beginPath();g.moveTo(10,sy(0));g.lineTo(w-10,sy(0));g.stroke();
    g.strokeStyle='#ffd45c';g.lineWidth=3;g.beginPath();g.moveTo(sx(0),sy(0));g.lineTo(sx(0),sy(1.55));g.stroke();
    for(const i of a.tried){const r=a.results[i];g.strokeStyle=['#72d8c0','#6cb5f5','#ffd45c'][i];g.lineWidth=i===a.selected?3:1;g.globalAlpha=i===a.selected?1:.4;g.beginPath();r.pts.forEach((p,j)=>j?g.lineTo(sx(p.x),sy(p.y)):g.moveTo(sx(p.x),sy(p.y)));g.stroke();}
    g.globalAlpha=1;
    if(a.result){const pts=a.result.pts,pt=pts.find(p=>p.t>=a.age)||pts[pts.length-1];if(pt){g.fillStyle='#fff3b2';g.beginPath();g.arc(sx(pt.x),sy(pt.y),5,0,Math.PI*2);g.fill();}g.fillStyle='#edf3ff';g.font='12px sans-serif';g.fillText(`滞空 ${a.result.t.toFixed(2)} 秒 · 飞行距离 ${(a.result.landX+4.5).toFixed(1)} 米`,12,20);}
    if(a.experiment==='tension'){const tol=YY.LABS.tension.setups[a.selected].tolerance;g.strokeStyle='#72d8c0';g.lineWidth=2;g.beginPath();g.arc(w*.83,h*.3,tol*35,0,Math.PI*2);g.stroke();g.font='12px sans-serif';g.fillStyle='#dce8f6';g.fillText('模型容错圈',w*.7,h*.54);}
    g.fillStyle='#bdc9da';g.font='11px sans-serif';g.textAlign='left';g.fillText('简化模型 · 固定出球点 · 各组轨迹可叠加比较',10,h-8);g.restore();
  };
})(typeof GameGlobal!=='undefined'?GameGlobal:typeof window!=='undefined'?window:globalThis);
