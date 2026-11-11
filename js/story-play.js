/* 十六根羽毛 · shared narrative state, choices, checkpointing and field rules. */
(function(G){
 'use strict';const Y=G.YY;
 Y.STORY_DIFFICULTIES={story:{name:'故事难度',tip:'慢一点，接住这一拍 · 剧情战失利也能继续'},challenge:{name:'挑战难度',tip:'完整对手强度 · 星级分别记录'}};
 Y.storyAI=function(step,difficulty){const level=Y.AI_LEVELS[step.level]?step.level:'normal';if(difficulty==='challenge'&&!step.gentle)return{level,tuning:null,skillInterval:0};const rank={easy:0,normal:1,boss:2,hard:3,nightmare:4}[level]||0;return{level,skillInterval:step.gentle?0:9-rank*.7,tuning:{react:step.gentle?.48:.52-rank*.035,err:step.gentle?.1:.95-rank*.065,timing:.07-rank*.005,recover:.55+rank*.04,recDelay:.38-rank*.025,smash:step.gentle?0:.06+rank*.035,tactical:step.gentle?0:.15+rank*.035,read:0,brain:0,judgeOut:.35+rank*.055,serveQ:.75,longServe:.8,name:'鹅湾陪练'}};};
 Y.storyText=text=>String(text);
 Y.STORY_DEFAULTS={};
 const npc=(id,name,base,opts={})=>({id,title:name,fx:{},passive:null,acts:[],portrait:{...Y.lookOf(base),name,...opts}});
 Y.STORY_NPCS={
  bobo:npc('bobo','波波','dingding',{glasses:'round',hair:'messy',shirt:'#e5b452',shirt2:'#936634',panel:'#f3ce83',racket:'#ffcf4a',num:'09'}),
  miaomiao:npc('miaomiao','苗苗','ruibao',{shirt:'#50c4d4',shirt2:'#24768d',panel:'#a7e7f3',hair:'pony',hairC:'#172c48',hairHi:'#365a7a',racket:'#78e7eb',num:'16',buff:true}),
  nan:npc('nan','老南','zhu',{shirt:'#314b7a',shirt2:'#192d50',panel:'#6d91c4',hair:'gray',hairC:'#b6c7e0',hairHi:'#eff6ff',glasses:null,whistle:false,num:'96',racket:'#a8d8f5'}),
  academy:npc('academy','南岸学员','xiaohong',{shirt:'#57c9eb',shirt2:'#287d9e',panel:'#bde8ff',num:'NA',glasses:null}),
  provincial:npc('provincial','省赛对手','ruibao',{shirt:'#9c88ed',shirt2:'#60518e',panel:'#c9c1f5',num:'22'}),
  ruima:npc('ruima','瑞妈','ranran',{hair:'pony',shirt:'#dc856a',shirt2:'#985048',panel:'#f0b499',num:'',blush:0}),
  wangba:npc('wangba','王爸','zhu',{shirt:'#7297bf',shirt2:'#415e89',whistle:false,num:'',glasses:'rect'}),
  grandma:npc('grandma','外婆','zhu',{shirt:'#aa90c5',shirt2:'#6a558a',hair:'gray',whistle:false,num:''}),
  goose:npc('goose','大将军','ruibao',{shirt:'#e9e2cc',shirt2:'#bebda0',num:''}),
 };
 for(const id of ['bobo','miaomiao','nan'])Y.STORY_NPCS[id]=Y.char(id);
 Y.FEATHER_PEOPLE=[['ruibao','一个包子','1-2'],['houzi','一个猴头','1-3'],['bobo','一只恐龙','1-4'],['xiaohong','一个直角','2-3'],['xingxing','一颗星','2-4'],['zhu','一只哨子','3-2'],['canglan','一滴水','4-2'],['lingfeng','一个脚印','4-3'],['lu','</>','5-2'],['laochen','一个勾','5-3'],['guoge','一个 ¥','6-2'],['miaomiao','一只鹅','8-2'],['ranran','蝴蝶结','2-2'],['tianchu','水里的月亮','9-5'],['nan','打开的罐子','11-1'],['dingding','这根，我想说出来','11-5']];
 Y.storyCondition=(when,ctx)=>!when||(when.choice?(ctx.choices?.[when.choice]||Y.Profile.d.campaign.choices[when.choice])===when.value:when.outcome===ctx.lastWin);
 Y.storyActions={
  setStoryDifficulty(value){if(!Y.STORY_DIFFICULTIES[value])return;Y.Profile.d.campaign.difficulty=value;Y.Profile.save();this.ui?.reset();this.renderStory?.();},
  resumeStoryCheckpoint(){const cp=Y.Profile.d.campaign.checkpoint;if(cp&&Y.stage(cp.stage)){this.setStoryDifficulty(cp.difficulty);this.startStage(cp.stage);}},
  saveStoryCheckpoint(extra){const s=this.story;if(!s)return;Y.Profile.d.campaign.checkpoint=JSON.parse(JSON.stringify({version:1,stage:s.st.id,index:s.i,stars:s.stars,ctx:s.ctx,difficulty:s.difficulty,...extra}));Y.Profile.save();},
  storyLine(){
   const d=this.dlg;if(!d||d.i<0||d.i>=d.lines.length)return;const line=d.lines[d.i],meta=line[4]||{};this.saveStoryCheckpoint({line:d.i});
   if(this.ui?.scroll)this.ui.scroll['dialog-text']=0;
   if(meta.cg&&!Y.Profile.d.campaign.gallery.includes(meta.cg)){Y.Profile.d.campaign.gallery.push(meta.cg);Y.Profile.save();}
   if(meta.silent)Y.Audio.storySilence?.();else if(line[3])Y.Audio.storyAction?.(line[3]);
   if(line[2]==='intent')Y.Audio.storyAction?.('intent');
   if(this.story.st.id==='11-5'&&line[1]==='我喜欢你。')Y.Audio.storyTheme?.(16);
  },
  playCinema(step){const ch=this.story.st.chapter;const lines=[['nar',step.title,'chapter',null,{title:ch.title,caption:step.caption,intro:true}]];this.playDialog(lines,()=>this.nextStep(),{...step,lines});Y.Audio.storyTheme?.(Math.min(16,2+Y.STORY.indexOf(ch)));},
  playKnowledge(step){const c=Y.card(step.card);if(!c)return this.nextStep();this.knowledge=c;this.show('knowledge');Y.Profile.unlock('card',c.id);},
  finishKnowledge(){this.knowledge=null;this.nextStep();},
  rememberChoice(step,index){if(!step.key||!step.o[index])return;const c=step.o[index],value=c.reply||c.label;this.story.ctx.choices[step.key]=value;Y.Profile.d.campaign.choices[step.key]=value;this.saveStoryCheckpoint();},
  bestStoryStep(stars){const s=this.story;if(!s)return stars;const key=s.st.id+':'+s.i,best=Y.Profile.d.campaign[s.difficulty==='challenge'?'challengeBest':'best'];best[key]=Math.max(best[key]||0,stars);Y.Profile.save();return best[key];},
  storyStageStars(){const s=this.story,best=Y.Profile.d.campaign[s.difficulty==='challenge'?'challengeBest':'best'];const values=s.st.steps.map((step,i)=>['dialog','pick','cinema','card','loadout'].includes(step.t)?null:best[s.st.id+':'+i]).filter(v=>v!=null);return Math.max(1,Math.min(3,values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):3));},
  completeStorySave(){const s=this.story,c=Y.Profile.d.campaign;if(s?.difficulty==='challenge')c.challengeStages[s.st.id]=Math.max(c.challengeStages[s.st.id]||0,this.storyStageStars());if(s?.st.feather&&!c.feathers.includes(s.st.feather))c.feathers.push(s.st.feather);if(s?.st.id==='11-5')c.ending=true;c.checkpoint=null;Y.Profile.save();},
  playInspect(step){const cp=Y.Profile.d.campaign.checkpoint;this.activity={step,found:cp?.activity?.found?.filter(id=>step.items.some(it=>it.id===id))||[],selected:null};this.show('inspect');},
  inspectItem(id){const a=this.activity,item=a?.step.items.find(it=>it.id===id);if(!item)return;a.selected=id;if(!a.found.includes(id))a.found.push(id);if(item.clue&&!Y.Profile.d.campaign.clues.includes(item.clue))Y.Profile.d.campaign.clues.push(item.clue);Y.Audio.storyAction?.('paper');this.saveStoryCheckpoint({activity:{found:a.found}});},
  finishInspect(){const a=this.activity;if(!a||a.found.length!==a.step.items.length)return;this.activity=null;this.activityDone(3,'都记住了。走吧。');},
  activityDone(stars,main){this.storyStep=this.story.st.steps[this.story.i];this.showStepResult({win:true,stars,main,goals:[{text:'这一段，亲手完成',ok:true}]});},
  startStorySetup(step){
   const ids=step.players||Y.CHARS.filter(c=>Y.Profile.has('char',c.id)).map(c=>c.id),relay=step.t==='relay';
   this.storySetup={step,ids,actor:step.as&&step.as!=='choose'?step.as:ids[0]||'dingding',relay,lineup:(Y.Profile.d.campaign.relay||[]).filter(id=>ids.includes(id)&&id!=='dingding').slice(0,7)};
   if(relay&&!this.storySetup.lineup.length)this.storySetup.lineup=ids.filter(id=>!['dingding','zhu'].includes(id)).slice(0,7);
   this.show('storysetup');
  },
  setupActor(id){const s=this.storySetup;if(s?.ids.includes(id))s.actor=id;},
  setupGear(cat,dir=1){const s=this.storySetup;if(!s)return;const g=Y.Profile.storyGear(s.actor),choices=(Y.GEAR[cat]||[]).filter(item=>!item.lock||Y.Profile.has('gear',item.id));if(cat==='tension'){Y.Profile.unlock('feat','tension');Y.Profile.setGear(s.actor,cat,Math.max(20,Math.min(30,g.tension+dir)));}else{const at=choices.findIndex(item=>item.id===g[cat]);if(choices.length)Y.Profile.setGear(s.actor,cat,choices[(at+dir+choices.length)%choices.length].id);}},
  setupKit(){const s=this.storySetup;if(s)Y.Profile.cycleKit(s.actor);},
  setupRelay(id){const s=this.storySetup;if(!s?.relay||id==='dingding'||!s.ids.includes(id))return;const at=s.lineup.indexOf(id);if(at>=0)s.lineup.splice(at,1);else if(s.lineup.length<7)s.lineup.push(id);},
  finishStorySetup(){
   const s=this.storySetup;if(!s)return;this.storySetup=null;
   if(s.step.t==='loadout'){this.nextStep();return;}
   const step={...s.step,t:'match',as:s.actor,setupDone:true};
   if(s.step.opp==='other')step.opp=s.ids.find(id=>id!==s.actor);
   if(s.relay){step.relay=[...s.lineup,'dingding'];step.as=step.relay[0];Y.Profile.d.campaign.relay=[...s.lineup];Y.Profile.save();}
   this.startChallenge(step);
  },
  cycleStorySkills(){const runtime=this.match?.story;if(!runtime||!runtime.step.training)return;const id=runtime.actors[0],act=Y.Profile.cycleKit(id),p=this.match.players[0];p.kit={passive:Y.char(id).passive,act:[...act]};p.passive=p.kit.passive;this.ctrlFor[0]=this.soloCtrl(true,act);this.ui?.layoutControls();runtime.say('现在携带：'+act.map(k=>Y.SKILLS[k].name).join(' + '),4);},
  continueStoryExhibition(){const runtime=this.match?.story;if(runtime?.progressReady)runtime.finish(false,{target:true});},
 };
})(typeof GameGlobal!=='undefined'?GameGlobal:typeof window!=='undefined'?window:globalThis);
