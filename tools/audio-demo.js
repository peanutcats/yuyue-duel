'use strict';
// Render an offline listening sample through the actual runtime selector/mixer.
// node tools/audio-demo.js; ffmpeg can optionally encode the resulting WAV.
const fs = require('node:fs'), path = require('node:path');
const { EFFECTS, RATE, wav } = require('./sound-design');
const createAudio = require('../minigame/src/audio');
const output = path.resolve(__dirname, '../output/audio-redesign');
fs.mkdirSync(output, { recursive: true });
let time = 0;
const voices = [];
const wx = { setInnerAudioOption() {}, createInnerAudioContext() {
  const ctx = {
    volume: 0, onEnded(fn) { this.ended = fn; }, onError() {},
    play() { this.start = time; this.playing = true; }, stop() { this.playing = false; }, destroy() { this.playing = false; }, seek() {},
    set src(value) { this.name = value.split('/').pop().replace('.wav', ''); },
  };
  voices.push(ctx); return ctx;
} };
const A = createAudio(wx, { now: () => time * 1000 });
const timeline = [
  [.2, '轻吊', () => A.hit(.9, false, { shot: 'drop' })],
  [1.1, '普通高远', () => A.hit(.65, false, { shot: 'clear' })],
  [2, '甜区高远', () => A.hit(.96, false, { shot: 'clear' })],
  [2.9, '重杀', () => A.hit(.95, true, { shot: 'smash' })],
  [4, '挥拍', () => A.swing('clear')], [4.12, '高远', () => A.hit(.8, false, { shot: 'clear' })],
  [4.65, '轻挥', () => A.swing('drop')], [4.77, '吊球', () => A.hit(.85, false, { shot: 'drop' })],
  [5.2, '起跳', () => A.jump()], [5.4, '重挥', () => A.swing('smash')],
  [5.52, '跳杀', () => A.hit(.96, true, { shot: 'smash' })], [5.72, '落地', () => A.land()],
  [5.9, '挥拍', () => A.swing('clear')], [6.01, '防守平抽', () => A.hit(.48, false, { shot: 'drive' })],
  [6.5, '挥拍', () => A.swing('smash')], [6.61, '扑球', () => A.hit(.91, true, { shot: 'kill' })],
  [7.05, '落球', () => A.floor()], [7.07, '得分', () => A.point(true)], [7.12, '掌声', () => A.cheer(false)],
];
const samples = new Float32Array(Math.ceil(8.25 * RATE));
let event = 0, peak = 0;
for (let i = 0; i < samples.length; i++) {
  time = i / RATE;
  while (event < timeline.length && timeline[event][0] <= time) timeline[event++][2]();
  if (i % 441 === 0) A.update();
  let x = 0;
  for (const voice of voices) if (voice.playing) {
    const e = EFFECTS[voice.name], j = Math.floor((time - voice.start) * RATE);
    if (j >= e.samples.length) { voice.playing = false; voice.ended?.(); }
    else if (j >= 0) x += e.samples[j] * voice.volume;
  }
  samples[i] = x; peak = Math.max(peak, Math.abs(x));
}
fs.writeFileSync(path.join(output, 'new-sound-demo.wav'), wav(samples));
const report = { sampleRate: RATE, effects: Object.keys(EFFECTS).length, demoPeak: peak, timeline: timeline.map(([at, label]) => ({ at, label })), clips: {} };
for (const [name, effect] of Object.entries(EFFECTS)) {
  let energy = 0, mean = 0;
  for (const x of effect.samples) { energy += x * x; mean += x; }
  report.clips[name] = { seconds: effect.duration, peak: effect.peak, rms: Math.sqrt(energy / effect.samples.length), dc: mean / effect.samples.length };
}
fs.writeFileSync(path.join(output, 'audio-audit.json'), JSON.stringify(report, null, 2) + '\n');
A.destroy();
console.log(`试听片段：${path.join(output, 'new-sound-demo.wav')}\n${Object.keys(EFFECTS).length} 个音效，示例长 8.25 秒，峰值 ${peak.toFixed(4)}`);
