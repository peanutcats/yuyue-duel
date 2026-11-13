'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),score=require('../js/soundtrack');
test('the static release resolves local scripts, styles and all score files without the mini-game project',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 for(const [,ref]of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)){
  if(/^(?:https?:|data:|#)/.test(ref))continue;
  const local=ref.split('?')[0];assert.ok(fs.existsSync(path.join(root,local)),local);assert.ok(!local.startsWith('minigame/'),local);
 }
 const scriptRefs=[...html.matchAll(/<script src="(js\/[^"?]+)(?:\?([^"]+))?"/g)];
 assert.ok(scriptRefs.length>40);assert.ok(scriptRefs.every(([,p,q])=>q==='v=web-131-20261113'),'cache versions match this release');
 assert.equal(Object.keys(score.TRACKS).length,15);
 for(const tr of Object.values(score.TRACKS)){
  assert.ok(tr.src.startsWith('assets/audio/score/'));const data=fs.readFileSync(path.join(root,tr.src));assert.ok(data.length>100000);assert.equal(data.toString('ascii',0,3),'ID3');assert.ok(tr.duration>30&&tr.duration<90);
 }
 assert.ok(!fs.existsSync(path.join(root,'minigame')));assert.ok(!fs.existsSync(path.join(root,'server')));
 const context={window:{YY:{}}};vm.runInNewContext(fs.readFileSync(path.join(root,'js/online-config.js'),'utf8'),context);
 assert.equal(context.window.YY.MATCH_CONFIG.enabled,false);assert.equal(context.window.YY.MATCH_CONFIG.accountEnabled,false);
});
test('the music director holds a long rally through point breaks, prioritizes clutch and respects story silence',()=>{
 const d=score.createDirector(),app={mode:'ai',screen:null,R:{venueId:'bamboo'},match:{score:[0,0],opt:{target:7},phase:'rally',rally:0}};
 assert.equal(d.update(app,.1),'bamboo');app.match.rally=10;assert.equal(d.update(app,.1),'rally');app.match.rally=0;app.match.phase='point';
 for(let i=0;i<25;i++)assert.equal(d.update(app,.2),'rally');for(let i=0;i<20;i++)d.update(app,.2);assert.equal(d.update(app,.1),'bamboo');
 app.match.score=[6,5];assert.equal(d.update(app,.1),'clutch');app.paused=true;assert.equal(d.update(app,.1),'pause');
 app.paused=false;app.mode='story';app.screen='dialog';app.dlg={i:0,lines:[['nar','silence',null,null,{silent:true}]]};assert.equal(d.update(app,.1),null);
});
