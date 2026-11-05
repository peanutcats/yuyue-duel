'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const createVoice=require('../minigame/src/story-voice');
const bank=require('../minigame/src/voice-bank');
const ids=Object.keys(bank),first=ids[0],second=ids.find(id=>id!==first&&bank[id].root===bank[first].root);
function harness(){
 const requests=[],contexts=[];let enabled=true;
 const wx={loadSubpackage(o){requests.push(o);},createInnerAudioContext(){
  const c={plays:0,stops:0,destroys:0,play(){this.plays++;},stop(){this.stops++;},destroy(){this.destroys++;},onEnded(fn){this.end=fn;},onError(fn){this.error=fn;}};contexts.push(c);return c;
 }};
 return {requests,contexts,voice:createVoice(wx,()=>enabled),disable(){enabled=false;}};
}
test('dialogue subpackage is shared; late loading cannot play a skipped line',async()=>{
 assert.ok(first&&second,'Build speech assets before tests');
 const h=harness(),a=h.voice.play(first),b=h.voice.play(second);
 assert.equal(h.requests.length,1);assert.equal(h.voice.state,'loading');
 h.requests[0].success();assert.equal(await a,false);assert.equal(await b,true);
 assert.equal(h.contexts.length,1);assert.equal(h.contexts[0].src,bank[second].root+'/'+bank[second].file);
 assert.equal(h.contexts[0].plays,1);h.contexts[0].end();assert.equal(h.voice.state,'idle');assert.equal(h.contexts[0].destroys,1);
 await h.voice.play(first);assert.equal(h.requests.length,1);h.voice.destroy();
});
test('mute or leaving dialogue while loading never starts delayed speech',async()=>{
 for(const mode of ['stop','disable']){
  const h=harness(),p=h.voice.play(first);if(mode==='stop')h.voice.stop();else h.disable();
  h.requests[0].success();assert.equal(await p,false);assert.equal(h.contexts.length,0);assert.equal(h.voice.state,'idle');
 }
});
test('speech package errors allow retry; audio failure releases the context',async()=>{
 const h=harness(),p=h.voice.play(first);h.requests[0].fail(new Error('offline'));
 assert.equal(await p,false);assert.equal(h.voice.state,'unavailable');
 const retry=h.voice.play(first);assert.equal(h.requests.length,2);h.requests[1].success();assert.equal(await retry,true);
 h.contexts[0].error(new Error('decode'));assert.equal(h.voice.failed,true);assert.equal(h.contexts[0].destroys,1);
 assert.equal(await h.voice.play('missing-voice'),false);h.voice.destroy();
});
test('replay replaces active speech and stale audio callbacks cannot stop the new line',async()=>{
 const h=harness(),p=h.voice.play(first);h.requests[0].success();await p;
 await h.voice.play(second);assert.equal(h.contexts[0].destroys,1);
 h.contexts[0].end();h.contexts[0].error();assert.equal(h.voice.state,'playing');assert.equal(h.contexts[1].destroys,0);
 h.voice.destroy();assert.equal(h.contexts[1].destroys,1);
});
