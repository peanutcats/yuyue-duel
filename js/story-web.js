/* Browser counterpart for the shared story activities. */
(function(G){
 'use strict';const app=G.App,YY=G.YY;
 const mount=document.querySelector('#scr-dialog').parentElement;
 for(const name of ['inspect','board','lab','journal']){
  const section=document.createElement('section');section.id='scr-'+name;section.className='screen panel-screen hidden';
  section.innerHTML='<div class="panel wide story-activity"><header class="ph"><button class="icon-btn activity-back" aria-label="返回故事">←</button><h2></h2></header><div class="activity-body"></div></div>';
  section.querySelector('button').onclick=()=>name==='journal'?app.show('story'):app.quit();mount.appendChild(section);
 }
 const show=app.show;app.show=function(name){show.call(this,name);if(['inspect','board','lab'].includes(name))this.drawStoryActivity();if(name==='journal')this.drawStoryJournal();};
 const notebook=document.createElement('button');notebook.className='btn';notebook.textContent='球馆手记';notebook.onclick=()=>app.show('journal');document.querySelector('#scr-story .ph').appendChild(notebook);
 app.drawStoryJournal=function(){
  const root=document.querySelector('#scr-journal');root.querySelector('h2').textContent='球馆手记';const body=root.querySelector('.activity-body');body.replaceChildren();
  const add=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;body.appendChild(el);return el;};
  const save=YY.Profile.d.campaign,cp=save.checkpoint,stage=cp&&YY.stage(cp.stage);
  add('p',stage?'上次停在：'+stage.title+' · 第 '+(cp.index+1)+' 个环节':'新的发现与约定会记录在这里。');
  if(stage){const b=add('button','继续上次');b.className='btn primary';b.onclick=()=>app.startStage(stage.id);}
  add('h3','我们的约定');Object.values(save.choices).forEach(text=>add('p',text));if(!Object.keys(save.choices).length)add('p','故事中的回应会留在这里。');
  add('h3','发现的线索');const listed=new Set();for(const st of YY.STAGES)for(const step of st.steps)for(const item of step.items||[])if(save.clues.includes(item.clue)&&!listed.has(item.clue)){listed.add(item.clue);add('p',item.label+'：'+item.text);}if(!listed.size)add('p','留意场景中的可调查物件，慢慢拼出完整的故事。');
 };
 const render=app.render;if(render)app.render=function(...args){const result=render.apply(this,args);if(['inspect','board','lab'].includes(this.screen))this.paintStoryActivity();return result;};
 let lastFrame=null;const frame=app.frame;app.frame=function(...args){const now=Number(args[0]);if(this.activity&&this.screen==='lab'&&lastFrame!=null)this.activity.age+=Math.max(0,Math.min(.06,(now-lastFrame)/1000));lastFrame=now;return frame.apply(this,args);};
 const methods=['inspectItem','boardAnswer','boardNext','labSelect','labTry','finishLab'];
 for(const name of methods){const fn=app[name];app[name]=function(...args){const out=fn.apply(this,args);if(['inspect','board','lab'].includes(this.screen))this.drawStoryActivity();return out;};}
 app.drawStoryActivity=function(){
  const v=this.activity;if(!v)return;const root=document.querySelector('#scr-'+this.screen);root.querySelector('h2').textContent=v.step.title;
  const b=root.querySelector('.activity-body');b.replaceChildren();
  const layout=document.createElement('div');layout.className='activity-layout';b.appendChild(layout);
  const visual=document.createElement('div');visual.className='activity-visual';layout.appendChild(visual);
  const panel=document.createElement('div');panel.className='activity-info';layout.appendChild(panel);
  const p=text=>{const el=document.createElement('p');el.textContent=text;panel.appendChild(el);};
  const button=(label,fn,disabled=false)=>{const el=document.createElement('button');el.className='btn';el.textContent=label;el.disabled=disabled;el.onclick=fn;panel.appendChild(el);};
  if(this.screen==='inspect'){
   const image=document.createElement('canvas');image.width=560;image.height=370;visual.appendChild(image);YY.SCENES[v.step.scene].bake(image.getContext('2d'),560,370,()=>.42);
   p(`已调查 ${v.found.length}/${v.step.items.length}`);
   for(const item of v.step.items)button((v.found.includes(item.id)?'✓ ':'')+item.label,()=>this.inspectItem(item.id));
   p(v.step.items.find(i=>i.id===v.selected)?.text||'点击物件名称，查看证据与知识。');button('整理线索 · 继续',()=>this.finishInspect(),v.found.length!==v.step.items.length);
  }else{
   const canvas=document.createElement('canvas');canvas.width=560;canvas.height=370;visual.appendChild(canvas);
   if(this.screen==='board'){
    const c=v.step.cases[v.index];p(`${v.index+1}/${v.step.cases.length} · ${c.q}`);
    c.options.forEach((label,i)=>button(label,()=>this.boardAnswer(i),v.selected!=null));
    if(v.selected!=null){p(c.explanation);button('继续',()=>this.boardNext());}
   }else{const d=YY.LABS[v.experiment];p(d.hint);d.labels.forEach((label,i)=>button((v.tried.includes(i)?'✓ ':'')+label,()=>this.labSelect(i)));p(v.note||'选择设置后试打一球。');button('试打一球',()=>this.labTry());button('提交选择',()=>this.finishLab(),v.tried.length<3);}
   this.paintStoryActivity();
  }
 };
 app.paintStoryActivity=function(){const v=this.activity;if(!v)return;const canvas=document.querySelector('#scr-'+this.screen+' canvas');if(!canvas)return;const g=canvas.getContext('2d');if(this.screen==='board')YY.drawLessonBoard(g,v.step.cases[v.index].picture,0,0,560,370,v.selected!=null);else if(this.screen==='lab')YY.drawLab(g,v,0,0,560,370);};
 const controls=document.createElement('div');controls.className='story-voice-controls';
 const toggle=document.createElement('button');toggle.className='btn';toggle.textContent='配音开关';toggle.onclick=e=>{e.stopPropagation();app.toggleStoryVoice();toggle.textContent=app.settings.voice?'配音已开启':'配音已关闭';};
 const replay=document.createElement('button');replay.className='btn';replay.textContent='重听';replay.onclick=e=>{e.stopPropagation();app.repeatStoryVoice();};controls.append(toggle,replay);document.querySelector('#scr-dialog').appendChild(controls);
 app.saveSettings=function(){localStorage.setItem('yuyue.story.voice',String(this.settings.voice!==false));};
 app.settings.voice=localStorage.getItem('yuyue.story.voice')!=='false';
 let audio,epoch=0;
 YY.Audio.voiceLine=async function(who,text){this.stopVoice();if(!this.enabled||app.settings.voice===false)return;const generation=epoch;const clip=new Audio('assets/story/voices/'+YY.voiceKey(who,text)+'.mp3');audio=clip;clip.volume=.8;try{await clip.play();if(generation!==epoch)clip.pause();}catch(_){};};
 YY.Audio.stopVoice=function(){epoch++;if(audio){audio.pause();audio.src='';audio=null;}};
 let soundEnabled=YY.Audio.enabled;Object.defineProperty(YY.Audio,'enabled',{get:()=>soundEnabled,set(value){soundEnabled=!!value;if(!soundEnabled)YY.Audio.stopVoice();}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)YY.Audio.stopVoice();});
})(window);
