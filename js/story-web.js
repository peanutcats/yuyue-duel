/* 十六根羽毛 · browser views for the shared narrative and tactile games. */
(function(G){
 'use strict';const app=G.App,Y=G.YY,$=id=>document.getElementById(id),mount=$('scr-dialog').parentElement;
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const add=(parent,tag,text,cls)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;parent.appendChild(el);return el;};
 const button=(parent,label,fn,opt={})=>{const b=add(parent,'button',label,'btn'+(opt.primary?' primary':'')+(opt.on?' selected':''));b.disabled=!!opt.disabled;b.onclick=fn;return b;};
 for(const name of ['inspect','journal','knowledge','minigame','storysetup','choice']){
  const section=add(mount,'section',null,'screen panel-screen hidden summer-screen');section.id='scr-'+name;
  section.innerHTML='<div class="panel wide summer-panel"><header class="ph"><button class="icon-btn activity-back" aria-label="返回故事">←</button><div><h2></h2><small></small></div></header><div class="activity-body"></div></div>';
  section.querySelector('button').onclick=()=>name==='journal'?app.show('story'):app.quit();
 }
 const sceneImage=id=>'assets/story/sixteen/'+id+'.svg?v=arena3';
 const show=app.show;app.show=function(name){show.call(this,name);if(['inspect','knowledge','storysetup','choice','minigame'].includes(name))this.drawSummerPage();if(name==='journal')this.drawStoryJournal();};
 const ph=$('scr-story').querySelector('.ph');ph.querySelector('h2').textContent='十六根羽毛';button(ph,'羽毛册',()=>app.show('journal'));
 const diff=add($('scr-story').querySelector('.story-foot'),'div',null,'story-difficulty');for(const [value,name]of [['story','故事'],['challenge','挑战']]){const b=button(diff,name,()=>app.setStoryDifficulty(value));b.dataset.difficulty=value;}
 app.renderStory=function(){
  const p=Y.Profile,total=Y.STAGES.reduce((n,s)=>n+p.storyStars(s.id),0);$('storyStars').textContent='★ '+total+' / '+Y.STAGES.length*3;
  if(!Y.STORY.some(ch=>ch.id===this.storyChap))this.storyChap=(Y.STAGES.find(s=>!p.storyStars(s.id))||Y.STAGES.at(-1)).chapter.id;
  const cl=$('chapList');cl.replaceChildren();for(const [i,ch]of Y.STORY.entries()){const b=button(cl,(i===0?'序':i===11?'终':String(i).padStart(2,'0'))+'　'+ch.title.split(' · ').pop(),()=>{this.storyChap=ch.id;this.renderStory();},{on:this.storyChap===ch.id,disabled:!Y.stageOpen(ch.stages[0].id)});b.classList.add('chap-btn');}
  const ch=Y.STORY.find(c=>c.id===this.storyChap),head=$('chapTitle').parentElement;head.style.backgroundImage='linear-gradient(90deg,#09152ceb,#142b4d70),url("'+sceneImage(ch.scene)+'")';head.dataset.caption=ch.act+' / '+ch.date;$('chapTitle').textContent=ch.title.split(' · ').pop();$('chapBlurb').textContent=ch.blurb;
  const list=$('stageList');list.replaceChildren();for(const st of ch.stages){const open=Y.stageOpen(st.id),stars=p.storyStars(st.id),resume=p.d.campaign.checkpoint?.stage===st.id,b=add(list,'button',null,'stage-card'+(!open?' locked':''));b.disabled=!open;const field=st.steps.find(b=>b.field)?.field,type={reality:'现实球场',memory:'读旧球',empty:'空场切磋',league:'羽场联赛'}[field]||({minigame:'夏天的小事',inspect:'探索',special:'片刻'})[st.kind]||'旧物与人';b.innerHTML='<span class="st-no">'+st.id+'</span><span class="st-kind">'+(resume?'继续上次':type)+'</span><b>'+escape(st.title)+'</b><span class="st-desc">'+escape(open?st.desc:'完成前一段，翻开这一页')+'</span><span class="st-stars">'+(stars?'★'.repeat(stars):open?'↗':'·')+'</span>';b.onclick=()=>this.startStage(st.id);}
  for(const b of diff.children){b.classList.toggle('primary',b.dataset.difficulty===p.d.campaign.difficulty);b.setAttribute('aria-pressed',String(b.dataset.difficulty===p.d.campaign.difficulty));}
 };
 const line=app.dlgAdvance;app.dlgAdvance=function(){line.call(this);const d=this.dlg;if(!d||d.i<0)return;const l=d.lines[d.i],meta=l[4]||{},box=$('dlgBox');box.classList.toggle('sixteen-chapter',!!d.step.intro);box.classList.toggle('sixteen-intent',l[2]==='intent');box.classList.toggle('sixteen-thought',l[2]==='thought');box.dataset.caption=meta.caption||'';$('dlgName').textContent=meta.title||meta.speaker||(l[0]==='nar'?Y.SCENES[d.step.scene]?.name||'鹅湾':Y.charName(l[0]));$('dlgName').style.color='';box.style.setProperty('--dc',l[0]==='nar'?'#ffcf4a':Y.lookOf(l[0]).shirt);};
 app.playPick=function(step){this.storyChoice={step,selected:null};this.show('choice');};
 app.drawSummerPage=function(){
  const screen=this.screen,section=$('scr-'+screen);if(!section)return;const title=section.querySelector('h2'),sub=section.querySelector('small'),body=section.querySelector('.activity-body');body.replaceChildren();
  if(screen==='choice'){
   const c=this.storyChoice;title.textContent='你想怎么说？';sub.textContent=this.story.st.title;add(body,'h3',c.step.q);for(const [i,o]of c.step.o.entries())button(body,o.label,()=>{c.selected=i;this.rememberChoice(c.step,i);this.drawSummerPage();},{disabled:c.selected!=null,on:c.selected===i});if(c.selected!=null){add(body,'p',c.step.o[c.selected].note);button(body,'这句话，留在夏天里 →',()=>{this.storyChoice=null;this.nextStep();},{primary:true});}
  }else if(screen==='knowledge'){
   const c=this.knowledge;title.textContent='羽球笔记 · '+c.num;sub.textContent='鹅湾周六课';add(body,'h3',c.title);add(body,'p',c.text,'knowledge-prose');button(body,'记住了 · 继续',()=>this.finishKnowledge(),{primary:true});
  }else if(screen==='inspect'){
   const a=this.activity;title.textContent=a.step.title;sub.textContent='已看过 '+a.found.length+' / '+a.step.items.length;const layout=add(body,'div',null,'summer-inspect'),scene=add(layout,'div',null,'inspect-scene'),image=add(scene,'img');image.src=sceneImage(a.step.scene);image.alt=Y.SCENES[a.step.scene].name;const opts=add(layout,'div',null,'inspect-options');for(const it of a.step.items)button(opts,(a.found.includes(it.id)?'✓ ':'')+it.label,()=>{this.inspectItem(it.id);this.drawSummerPage();},{on:a.selected===it.id});const item=a.step.items.find(it=>it.id===a.selected);add(body,'p',item?.text||'每件旧物，都记得一点这个夏天。');button(body,'收好线索 · 继续',()=>this.finishInspect(),{primary:true,disabled:a.found.length!==a.step.items.length});
  }else if(screen==='storysetup'){
   const v=this.storySetup;title.textContent=v.relay?'排好棒次':'选好你的球拍';sub.textContent=v.relay?'丢一分换下一棒 · 最多八棒 · 丁丁固定最后一棒':'从三个主动技能里带两个上场';const layout=add(body,'div',null,'summer-setup'),actors=add(layout,'div',null,'setup-actors'),opts=add(layout,'div',null,'setup-options');for(const id of v.ids)button(actors,(v.relay&&v.lineup.includes(id)?(v.lineup.indexOf(id)+1)+'. ':'')+Y.charName(id),()=>{v.relay?this.setupRelay(id):this.setupActor(id);this.drawSummerPage();},{on:v.relay?v.lineup.includes(id):v.actor===id,disabled:v.relay&&id==='dingding'});
   if(v.relay){add(opts,'h3','最后一棒 · 丁丁');add(opts,'p',[...v.lineup,'dingding'].map((id,i)=>(i+1)+'. '+Y.charName(id)).join(' → '));add(opts,'p','前半场先取五分，再接住最后两分。');}else{
    add(opts,'h3',Y.charName(v.actor));const gear=Y.Profile.storyGear(v.actor);for(const [cat,label]of [['racket','球拍'],['string','球线'],['shoe','球鞋'],['tension','磅数']])button(opts,label+'　'+(cat==='tension'?gear.tension+' lb':Y.gear(gear[cat]).name),()=>{this.setupGear(cat);this.drawSummerPage();});button(opts,Y.Profile.kit(v.actor).map(k=>Y.SKILLS[k].name).join(' + '),()=>{this.setupKit();this.drawSummerPage();});
   }button(body,v.step.t==='loadout'?'配好了 · 继续':'进入羽场 →',()=>this.finishStorySetup(),{primary:true});
  }else if(screen==='minigame')this.mountStoryGame(body,title,sub);
 };
 app.mountStoryGame=function(body,title,sub){
  const a=this.storyGame;title.textContent=a.step.title;sub.textContent='先到位，再接住。每一次重来都算数。';const area=add(body,'div',null,'summer-game'),canvas=add(area,'canvas');canvas.width=960;canvas.height=480;canvas.setAttribute('aria-label',a.step.title);const controls=add(area,'div',null,'game-controls'),note=add(body,'p',a.note,'game-note');this.gameElements={canvas,controls,note};
  const point=e=>{const r=Y.appRect(canvas),p=Y.toApp(e.clientX,e.clientY);return{x:(p.x-r.left)/r.width*960,y:(p.y-r.top)/r.height*480};};
  canvas.onpointerdown=e=>{e.preventDefault();canvas.setPointerCapture(e.pointerId);this.storyGamePointer('down',point(e));};canvas.onpointermove=e=>{if(e.buttons)this.storyGamePointer('move',point(e));};canvas.onpointerup=e=>{this.storyGamePointer('up',point(e));};canvas.onpointercancel=()=>a.cancel();this.paintStoryGame();
 };
 app.paintStoryGame=function(){
  const a=this.storyGame,e=this.gameElements;if(this.screen!=='minigame'||!a||!e)return;Y.drawStoryGame(e.canvas.getContext('2d'),a,0,0,960,480);e.note.textContent=a.note;
  const controls=Y.storyGameControls(a),signature=controls.map(b=>b.id+':'+!!b.hold).join('|');if(e.signature===signature){controls.forEach((c,i)=>{e.controls.children[i].textContent=c.text;});return;}e.signature=signature;e.controls.replaceChildren();
  for(const c of controls){const b=add(e.controls,'button',c.text,'btn'+(c.id==='done'||c.id==='start'?' primary':''));b.dataset.action=c.id;b.style.cssText='left:'+c.x/9.6+'%;top:'+c.y/4.8+'%;width:'+c.w/9.6+'%;height:'+c.h/4.8+'%;';if(c.hold){b.onpointerdown=ev=>{ev.preventDefault();b.setPointerCapture(ev.pointerId);this.storyGameAction(c.id,true);};b.onpointerup=()=>this.storyGameAction(c.id,false);b.onpointercancel=()=>a.cancel();}else b.onclick=()=>{this.storyGameAction(c.id);this.paintStoryGame();};}
 };
 app.drawStoryJournal=function(){
  const root=$('scr-journal'),body=root.querySelector('.activity-body'),save=Y.Profile.d.campaign;root.querySelector('h2').textContent='羽毛册';root.querySelector('small').textContent=save.feathers.length+' 个记号 · 最后一根，留给说出口的话';body.replaceChildren();const tabs=add(body,'nav',null,'journal-tabs');for(const [id,label]of [['feathers','十六根羽毛'],['clues','夏天的旧物'],['gallery','显影相册']])button(tabs,label,()=>{this.journalTab=id;this.drawStoryJournal();},{on:(this.journalTab||'feathers')===id});
  if(!this.journalTab||this.journalTab==='feathers'){
   const grid=add(body,'div',null,'feather-grid');for(const [id,symbol,stage]of Y.FEATHER_PEOPLE){const on=id!=='dingding'&&save.feathers.includes(id),cell=add(grid,'button',null,'feather-cell'+(on?' lit':''));cell.disabled=!on;cell.innerHTML='<span class="feather-shape">⌁</span><b>'+escape(id==='dingding'?'留 白':on?Y.charName(id):'·')+'</b><small>'+escape(on?symbol:'')+'</small>';cell.onclick=()=>this.startStage(stage);}
  }else if(this.journalTab==='gallery'){
   const grid=add(body,'div',null,'cg-gallery');for(const [id,cg]of Object.entries(Y.STORY_CGS)){const f=add(grid,'figure'),on=save.gallery.includes(id);if(on){const image=add(f,'img');image.src=sceneImage(id);image.alt=cg.name;}else add(f,'div',null,'cg-hidden');add(f,'figcaption',on?cg.name:'尚未显影');}
  }else{
   const seen=new Set();for(const st of Y.STAGES)for(const step of st.steps)for(const it of step.items||[])if(save.clues.includes(it.clue)&&!seen.has(it.clue)){seen.add(it.clue);add(body,'h3',it.label);add(body,'p',it.text);}if(!seen.size)add(body,'p','没有人催你读。留意身边的旧物，慢慢看。');
  }
  if(save.checkpoint)button(body,'继续上次 · '+Y.stage(save.checkpoint.stage)?.title,()=>this.resumeStoryCheckpoint(),{primary:true});
 };
 const skillCycle=add(mount,'button','轮换技能','btn summer-skill-cycle hidden');skillCycle.onclick=()=>app.cycleStorySkills();
 const exhibition=add(mount,'button','三分已得 · 继续故事','btn summer-skill-cycle hidden');exhibition.onclick=()=>app.continueStoryExhibition();
 const render=app.render;app.render=function(dt){const runtime=this.match?.story;document.querySelector('#touch .t-smash')?.classList.toggle('story-locked',!!runtime?.fear);for(const button of document.querySelectorAll('#touch .t-skill,#touch .t-skill2'))button.classList.toggle('story-locked',runtime?.relayPhase==='truth');skillCycle.classList.toggle('hidden',!(this.mode==='story'&&!this.screen&&this.match?.story?.step.training));exhibition.classList.toggle('hidden',!(this.mode==='story'&&!this.screen&&this.match?.story?.progressReady));if(this.screen==='inspect'&&this.activity){this.R.drawStory({scene:this.activity.step.scene,cast:[],noCast:true},dt);return;}return render.call(this,dt);};
 let last;const frame=app.frame;app.frame=function(now){if(last!=null&&!document.hidden)this.updateStoryGame(Math.min(.05,Math.max(0,(now-last)/1000)));last=now;frame.call(this,now);this.paintStoryGame();};
 const init=app.init;app.init=function(){init.call(this);const key=Y.Input.onAny;Y.Input.onAny=e=>{if(this.screen==='minigame'&&this.storyGame){if(this.storyGame.key(e.code,true)){e.preventDefault();return true;}}return key?.(e);};G.addEventListener('keyup',e=>{if(this.screen==='minigame')this.storyGame?.key(e.code,false);});};
 // Original instrumental score. No speech synthesis or retired voice assets.
 const A=Y.Audio;let score=null,epoch=0;const foley=new Set();
 A.storySilence=function(){epoch++;if(score){score.pause();score.src='';score=null;}};
 A.storyTheme=function(count){this.storySilence();if(!this.enabled||!this.musicEnabled)return;score=new Audio('assets/story/sixteen/audio/summer-'+Math.max(2,Math.min(16,Math.ceil(count/2)*2))+'.wav');score.volume=.32;score.play().catch(()=>{});};
 A.storyAction=function(name){if(!this.enabled)return;if(['clamp','enter','intent','snap','bun','prediction','river','goose'].includes(name)){const audio=new Audio('assets/story/sixteen/audio/story-'+name+'.wav');audio.volume=.28;foley.add(audio);audio.onended=()=>foley.delete(audio);audio.play().catch(()=>foley.delete(audio));}else if(this.ok()){if(name==='paper')this.burst(1800,1,.17,.035);else if(name==='rain')this.burst(1200,1,.8,.025);else this.tone(330,.09,.035,'triangle');}};
 document.addEventListener('visibilitychange',()=>{if(document.hidden){A.storySilence();for(const a of foley)a.pause();foley.clear();app.storyGame?.cancel();}});
 G.addEventListener('blur',()=>app.storyGame?.cancel());
 let enabled=A.enabled;Object.defineProperty(A,'enabled',{get(){return enabled;},set(value){enabled=!!value;if(!enabled){A.silenceMusic?.();A.storySilence();for(const sound of foley)sound.pause();foley.clear();}}});
})(window);
