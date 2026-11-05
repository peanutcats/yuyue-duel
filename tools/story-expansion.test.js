'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {loadGame}=require('./wechat-test-harness');
function unlock(h,id){h.YY.STAGES.slice(0,h.YY.STAGES.findIndex(s=>s.id===id)+1).forEach(s=>h.YY.Profile.setStars(s.id,1));}
function go(h,id,step){unlock(h,id);h.app.startStage(id);h.app.story.i=step;h.app.story.resume=null;h.app.runStep();}

test('expanded campaign has unique stable IDs, all rewards and artwork, valid knowledge, voices and choices',()=>{
 const h=loadGame(),Y=h.YY;assert.equal(Y.STORY.length,12);assert.equal(Y.STAGES.length,60);assert.equal(Y.CARDS.length,68);
 assert.equal(new Set(Y.STAGES.map(s=>s.id)).size,60);
 for(const old of Y.LEGACY_STAGE_ORDER)assert.ok(Y.stage(old));
 const bank=require('../minigame/src/voice-bank');
 for(const st of Y.STAGES){
  assert.ok(st.steps.length>=3);assert.ok(st.knowledge.length>=2);
  st.knowledge.forEach(k=>assert.ok(Y.card(k),k));
  st.rewards.cards?.forEach(k=>assert.ok(Y.card(k),k));
  for(const step of st.steps){
   if(step.scene)assert.ok(Y.SCENES[step.scene],step.scene);
   if(step.t==='dialog')for(const line of step.lines){const text=Y.storyText(line[1]);assert.ok(!text.includes('{'));const clip=bank[Y.voiceKey(line[0],text)];if(clip)assert.ok(clip.file,text);}
  }
 }
 for(const c of Y.CARDS)assert.ok(Y.STAGES.some(s=>s.rewards.cards?.includes(c.id)),c.id);
 assert.equal(Object.keys(Y.STORY_ART).length,8);
 h.app.destroy();
});

test('story Foley cues resolve to packaged sounds and experiments preserve their stated controls',()=>{
 const h=loadGame(),Y=h.YY,bank=require('../minigame/src/audio-bank');
 for(const st of Y.STAGES)for(const step of st.steps)for(const line of step.lines||[]){
  const cue=line[3];if(cue)assert.ok(bank[({page:'story-paper',rustle:'story-paper',cheer:'cheer'})[cue]||'story-'+cue],cue);
 }
 const air=Y.LABS.air.setups;assert.equal(new Set(air.map(s=>s.speed)).size,1);assert.equal(new Set(air.map(s=>s.angle)).size,1);
 assert.ok(Y.labTrajectory('air',2).landX>Y.labTrajectory('air',0).landX);
 assert.ok(Y.labTrajectory('arc',2).t>Y.labTrajectory('arc',0).t);
 h.app.destroy();
});

test('investigation requires all clues and restores discovered objects after a reload',()=>{
 const h=loadGame();go(h,'0-2',1);const a=h.app;
 a.finishInspect();assert.equal(a.screen,'inspect');a.inspectItem('photo');a.inspectItem('photo');
 assert.equal(a.activity.found.length,1);assert.equal(h.YY.Profile.d.campaign.clues.length,1);
 const storage=h.storage;a.destroy();const r=loadGame({storage});r.app.startStage('0-2');
 assert.equal(r.app.screen,'inspect');assert.deepEqual([...r.app.activity.found],['photo']);
 r.app.inspectItem('notice');r.app.inspectItem('line');r.app.finishInspect();assert.equal(r.app.screen,'step');assert.equal(r.app.stepRes.win,true);r.app.destroy();
});

test('dialogue resumes its line; choices echo later and persist without resetting equipment or unlocks',()=>{
 const h=loadGame();h.YY.Profile.unlock('char','xiaohong');h.YY.Profile.choose('char','xiaohong');go(h,'0-4',1);
 h.app.quizAnswer(1);h.app.quizNext();assert.equal(h.YY.Profile.d.campaign.choices.promise,'先让大家愿意留下，再谈成绩。');
 h.app.story.i=3;h.app.runStep();assert.match(h.app.dlg.lines[0][1],/先让大家愿意留下/);
 h.app.dlg.progress=1000;h.app.dlgAdvance();const storage=h.storage;h.app.destroy();
 const r=loadGame({storage});r.app.startStage('0-4');assert.equal(r.app.dlg.i,1);assert.equal(r.YY.Profile.sel.char,'xiaohong');r.app.destroy();
});

test('new slots do not relock legacy progression and invalid stage IDs remain locked',()=>{
 const h=loadGame();h.YY.Profile.setStars('0-3',2);assert.equal(h.YY.stageOpen('0-4'),true);assert.equal(h.YY.stageOpen('1-1'),false);assert.equal(h.YY.stageOpen('not-a-stage'),false);assert.equal(h.YY.stageOpen('11-5'),false);h.app.destroy();
});

test('board questions show feedback once; completion teaches even after mistakes and can be retried',()=>{
 const h=loadGame();go(h,'1-3',1);const a=h.app,step=a.activity.step;
 a.boardNext();assert.equal(a.activity.index,0);
 a.boardAnswer((step.cases[0].answer+1)%3);a.boardAnswer(step.cases[0].answer);assert.equal(a.activity.right,0);
 a.boardNext();for(let i=1;i<step.cases.length;i++){a.boardAnswer(step.cases[i].answer);a.boardNext();}
 assert.equal(a.screen,'step');assert.equal(a.stepRes.win,true);a.stepRetry();assert.equal(a.screen,'board');h.app.destroy();
});

test('experiments require comparison, provide distinct trajectories and reuse cached results',()=>{
 const h=loadGame();go(h,'6-1',1);const a=h.app;
 a.finishLab();assert.equal(a.screen,'lab');
 for(let i=0;i<3;i++){a.labSelect(i);a.labTry();}
 assert.ok(a.activity.results[2].landX>a.activity.results[0].landX);
 const cached=a.activity.results[2];a.labTry();assert.equal(a.activity.result,cached);
 a.labSelect(0);a.finishLab();assert.equal(a.screen,'lab');
 a.labSelect(2);a.finishLab();assert.equal(a.screen,'step');h.app.destroy();
});

test('step best scores survive a retry and chapter result is not capped by a single poor activity',()=>{
 const h=loadGame();go(h,'1-2',1);const a=h.app;
 a.bestStoryStep(3);a.bestStoryStep(1);assert.equal(h.YY.Profile.d.campaign.best['1-2:1'],3);
 a.story.i=2;a.bestStoryStep(2);assert.equal(a.storyStageStars(),3);h.app.destroy();
});

test('pressure match, skills rules and story combination use real match settings',()=>{
 const h=loadGame();go(h,'8-3',1);assert.deepEqual([...h.app.match.score],[3,5]);assert.equal(h.app.match.skillsOn,false);
 go(h,'2-5',2);assert.ok(h.app.practice.tutorial);assert.equal(h.app.practice.goal.need,3);h.app.destroy();
});

test('corrupted checkpoint is discarded, and missing/stale speech cannot block story navigation',()=>{
 const storage=new Map([['yuyue.profile',JSON.stringify({v:2,campaign:{checkpoint:{version:1,stage:'x',index:999},choices:{constructor:'bad'},clues:[null,44,'photo']}})]]);
 const h=loadGame({storage});assert.equal(h.YY.Profile.d.campaign.checkpoint,null);h.app.startStage('0-1');h.app.dlgFinish();assert.equal(h.app.mode,'story');h.app.quit();assert.equal(h.app.screen,'story');h.app.destroy();
});

test('story activities and notebook render at compact, wide, tablet and safe-area sizes',()=>{
 for(const [width,height]of [[667,375],[844,390],[1024,768]]){
  const h=loadGame({width,height,safe:true});
  for(const [id,step]of [['0-2',1],['1-3',1],['2-2',1],['4-1',1],['5-2',1],['11-5',1]]){
   go(h,id,step);h.frames(2);assert.ok(h.app.ui.buttons.length);
   for(const b of h.app.ui.buttons)if(!['dialogue'].includes(b.id)&&!b.disabled){assert.ok(b.x>=0&&b.x+b.w<=h.app.ui.W+1,`${width}: ${b.id} bounds`);}
  }
  h.app.show('journal');h.frames();assert.ok(h.app.ui.buttons.some(b=>b.id==='journal-return'));h.app.destroy();
 }
});
