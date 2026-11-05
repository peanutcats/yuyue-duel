'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const createAudio = require('../minigame/src/audio');
const BANK = require('../minigame/src/audio-bank');
const { EFFECTS, RATE, wav } = require('./sound-design');
const { loadGame } = require('./wechat-test-harness');

function fixture({ rejectEnhanced = false, noAudio = false } = {}) {
  let time = 1000;
  const contexts = [], plays = [], requested = [];
  const wx = { setInnerAudioOption() {}, createInnerAudioContext(options) {
    requested.push(options);
    if (rejectEnhanced && options?.useWebAudioImplement) throw Error('old engine');
    const listeners = {};
    const ctx = { listeners, volume: 0, seekCount: 0, destroyed: false, active: false,
      onEnded: fn => listeners.end = fn, onError: fn => listeners.error = fn,
      play() { if (this.destroyed) throw Error('destroyed context played'); this.active = true; plays.push({ name: this.src.split('/').pop().replace('.wav', ''), ctx, time }); },
      stop() { this.active = false; }, destroy() { this.destroyed = true; this.active = false; },
      seek() { this.seekCount++; }, end() { this.active = false; listeners.end?.(); },
    };
    contexts.push(ctx); return ctx;
  } };
  if (noAudio) delete wx.createInnerAudioContext;
  const A = createAudio(wx, { now: () => time });
  return { A, contexts, plays, requested, advance(ms) { time += ms; A.update(); } };
}

test('spoken dialogue reserves headroom and restores impact mix after stopping', async () => {
  const h=fixture(),id=Object.keys(require('../minigame/src/voice-bank'))[0];
  await h.A.speech.play(id);h.A.play('story-rain');h.A.play('story-paper');h.A.play('story-door');
  h.A.update();
  const peak=()=>h.contexts.filter(c=>c.active&&!c.src.endsWith('.mp3')).reduce((sum,c)=>sum+c.volume*BANK[c.src.split('/').pop().replace('.wav','')].peak,0);
  assert.ok(peak()<=.32001);const quiet=peak();h.A.stopVoice();h.A.update();assert.ok(peak()>=quiet);h.A.destroy();
});

test('new PCM bank has fast clean attack, no clipping or DC, faded tails and distinct strike variants', () => {
  assert.ok(Object.keys(EFFECTS).length >= 39); assert.equal(RATE, 44100);
  for (const [name, e] of Object.entries(EFFECTS)) {
    const data = wav(e.samples), n = e.samples.length;
    assert.equal(data.readUInt32LE(24), RATE); assert.equal(data.readUInt16LE(22), 1);
    let peak = 0, energy = 0, mean = 0;
    for (const v of e.samples) { assert.ok(Number.isFinite(v)); peak = Math.max(peak, Math.abs(v)); mean += v; energy += v * v; }
    assert.ok(peak < .90 && peak > .1, name + ' peak headroom');
    assert.ok(Math.abs(mean / n) < .004, name + ' DC'); assert.ok(energy / n > 1e-6, name + ' is audible');
    assert.equal(Math.abs(e.samples[0]), 0); assert.equal(Math.abs(e.samples[n - 1]), 0);
    if (e.group === 'impact') {
      assert.ok(e.samples.slice(0, Math.floor(RATE * .004)).some(v => Math.abs(v) > .1), name + ' contact in first 4 ms');
      assert.ok(e.duration < .3, name + ' short enough for rallies');
    }
  }
  assert.notDeepEqual(EFFECTS.hit.samples, EFFECTS['hit-2'].samples);
  assert.notDeepEqual(EFFECTS.perfect.samples, EFFECTS.power.samples);
});

test('prewarm is silent, opts into short-audio driver, rotates strikes and reuses ended voices', () => {
  const h = fixture(); h.A.init();
  assert.equal(h.plays.length, 0); assert.ok(h.contexts.length > 10 && h.contexts.length <= 24);
  assert.ok(h.requested.every(o => o.useWebAudioImplement));
  for (let i = 0; i < 4; i++) { h.A.hit(.7, false, { shot: 'clear' }); h.advance(180); h.plays.at(-1).ctx.end(); }
  assert.deepEqual(h.plays.map(p => p.name), ['hit', 'hit-2', 'hit-3', 'hit']);
  assert.equal(h.plays[0].ctx, h.plays[3].ctx); assert.equal(h.plays[0].ctx.seekCount, 1);
  h.A.destroy(); assert.ok(h.contexts.every(c => c.destroyed));
});

test('contact chooses soft, imperfect, sweet, heavy and net-kill timbres; serves and feeds stay light', () => {
  const h = fixture();
  for (const [q, power, event] of [[.9, false, { shot: 'clear' }], [.2, false, { shot: 'clear' }], [.9, false, { shot: 'drop' }], [.9, true, { shot: 'smash' }], [.9, true, { shot: 'kill' }], [.9, false, { serve: true }], [1, false, { feed: true }]]) { h.A.hit(q, power, event); h.advance(400); }
  assert.deepEqual(h.plays.map(p => p.name.replace(/-\d$/, '')), ['perfect', 'mishit', 'touch', 'power', 'kill', 'touch', 'touch']);
  assert.ok(h.plays.at(-1).ctx.volume < h.plays[2].ctx.volume);
  h.A.destroy();
});

test('voice pressure preserves a new hit, ducks long cues and keeps summed peak below full scale', () => {
  const h = fixture();
  for (const name of ['cheer', 'cheer-big', 'skill', 'skill-flow', 'win', 'lose', 'ready']) h.A.play(name);
  assert.equal(h.A.diagnostics().voices, 7);
  const skill = h.plays.find(p => p.name === 'skill').ctx, before = skill.volume;
  h.A.hit(1, true, { shot: 'smash' });
  assert.equal(h.plays.at(-1).name, 'power'); assert.equal(h.A.diagnostics().voices, 7);
  assert.ok(skill.volume < before);
  assert.ok(h.plays.some(p => p.name.startsWith('cheer') && p.ctx.destroyed));
  const peak = h.plays.filter(p => p.ctx.active && !p.ctx.destroyed).reduce((s, p) => s + p.ctx.volume * BANK[p.name].peak, 0);
  assert.ok(peak <= .920001, String(peak));
  h.advance(130); assert.ok(skill.volume > before * .38);
  h.A.destroy();
});

test('long sessions, missing ended callbacks and memory pressure never exhaust or leak contexts', () => {
  const h = fixture(); const names = Object.keys(BANK);
  for (let i = 0; i < 150; i++) {
    h.A.play(names[i % names.length]); h.advance(200);
    assert.ok(h.A.diagnostics().contexts <= 24); assert.ok(h.A.diagnostics().voices <= 7);
  }
  h.advance(2000); assert.equal(h.A.diagnostics().voices, 0);
  h.A.releaseCache(); assert.equal(h.A.diagnostics().contexts, 0);
  h.A.hit(.8, false); assert.ok(h.A.diagnostics().voices > 0);
  h.A.destroy(); assert.equal(h.A.diagnostics().contexts, 0);
});

test('mute and background cancel old audio; stale callbacks cannot silence a new hit', () => {
  const h = fixture(); h.A.hit(.7, false); const old = h.plays.at(-1).ctx;
  h.A.enabled = false; assert.equal(h.A.diagnostics().voices, 0); assert.ok(old.destroyed);
  h.A.hit(.7, false); assert.equal(h.plays.length, 1);
  h.A.enabled = true; h.A.hit(.7, false); old.listeners.end(); old.listeners.error();
  assert.equal(h.A.diagnostics().voices, 1);
  assert.equal(h.A.diagnostics().webAudio, true);
  h.A.suspend(); h.A.skill('lieyan'); assert.equal(h.A.diagnostics().voices, 0);
  h.A.resume(); h.A.skill('chaoxi'); assert.equal(h.plays.at(-1).name, 'skill-flow');
  h.A.destroy(); h.A.hit(.7, false); assert.equal(h.A.diagnostics().contexts, 0);
});

test('unsupported driver, async SDK errors, unknown clips and absent audio APIs fail safely', () => {
  const h = fixture({ rejectEnhanced: true }); h.A.hit(.7, false);
  assert.equal(h.A.diagnostics().webAudio, false); assert.equal(h.plays.length, 1);
  h.plays[0].ctx.listeners.error(); h.A.hit(.7, false); assert.equal(h.plays.length, 2);
  assert.equal(h.A.play('not-a-file'), false); assert.equal(h.A.play('hit', NaN), false); h.A.destroy();
  const silent = fixture({ noAudio: true }); silent.A.init(); assert.doesNotThrow(() => silent.A.hit(.9, true)); silent.A.destroy();
});

test('a net kill emits one impact; ordinary points and training no longer trigger loud crowd/whistle stacks', () => {
  const h = loadGame(), { app, YY } = h, calls = [];
  for (const name of ['hit', 'swing', 'skill', 'floor', 'whistle', 'cheer', 'land', 'point', 'success']) YY.Audio[name] = (...args) => calls.push({ name, args });
  app.startPractice('receive'); const m = app.match;
  app.handleEvent({ type: 'hit', p: 0, shot: 'kill', name: '扑球', q: .9, x: -1, y: 2, speed: 18 }, m);
  assert.equal(calls.filter(c => c.name === 'hit').length, 1);
  assert.equal(calls[0].args[2].shot, 'kill'); calls.length = 0;
  app.handleEvent({ type: 'swing', p: 0, btn: 'smash' }, m); assert.equal(calls[0].args[0], 'smash');
  calls.length = 0; app.handleEvent({ type: 'point', winner: 0, loser: 1, x: 3, inB: true, reason: '落地', rally: 3, kind: 'winner' }, m);
  assert.deepEqual(calls.map(c => c.name), ['floor', 'point']);
  calls.length = 0; app.handleEvent({ type: 'pres', ok: true }, m); assert.deepEqual(calls.map(c => c.name), ['success']);
  calls.length = 0; app.handleEvent({ type: 'land', p: 0 }, m); assert.equal(calls[0].name, 'land');
  app.destroy();
});
