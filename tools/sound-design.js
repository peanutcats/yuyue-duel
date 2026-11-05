'use strict';
// Original procedural Foley: contact, string resonance, air and court reflections.
// This build-time renderer never runs in a match, and never uses gameplay RNG.
const RATE = 44100, TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function random(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2147483648 - 1); }
function seedOf(name) { let s = 2166136261; for (const c of name) s = Math.imul(s ^ c.charCodeAt(0), 16777619); return s >>> 0; }
function filter(input, low, high) {
  const a = 1 - Math.exp(-TAU * low / RATE), b = 1 - Math.exp(-TAU * high / RATE);
  let lp = 0, hp = 0; const out = new Float64Array(input.length);
  for (let i = 0; i < input.length; i++) { lp += b * (input[i] - lp); hp += a * (lp - hp); out[i] = lp - hp; }
  return out;
}
function sound(duration, seed) {
  const n = Math.ceil(duration * RATE), rng = random(seed), noise = Float64Array.from({ length: n }, rng);
  const x = new Float64Array(n), bands = new Map();
  const band = (lo, hi) => { const k = lo + ':' + hi; if (!bands.has(k)) bands.set(k, filter(noise, lo, hi)); return bands.get(k); };
  function burst(at, amp, decay, lo, hi, attack = .0007) {
    const start = Math.floor(at * RATE), src = band(lo, hi);
    for (let i = start; i < n; i++) { const t = (i - start) / RATE; x[i] += amp * src[i] * (1 - Math.exp(-t / attack)) * Math.exp(-t / decay); }
  }
  function tone(at, amp, decay, freq, end = freq, attack = .001) {
    const start = Math.floor(at * RATE); let phase = 0;
    for (let i = start; i < n; i++) {
      const t = (i - start) / RATE, f = end + (freq - end) * Math.exp(-t / .012);
      phase += TAU * f / RATE;
      x[i] += amp * Math.sin(phase) * (1 - Math.exp(-t / attack)) * Math.exp(-t / decay);
    }
  }
  function air(at, length, amp, lo, hi) {
    const src = band(lo, hi), start = Math.floor(at * RATE), end = Math.min(n, start + Math.ceil(length * RATE));
    for (let i = start; i < end; i++) { const u = (i - start) / (end - start); x[i] += src[i] * amp * Math.pow(Math.sin(Math.PI * u), 2.2); }
  }
  function reflections(amount) {
    const dry = x.slice();
    for (const [delay, gain] of [[.017, .52], [.033, -.29], [.057, .17]]) {
      const offset = Math.floor(delay * RATE);
      for (let i = offset; i < n; i++) x[i] += dry[i - offset] * amount * gain;
    }
  }
  return { x, burst, tone, air, reflections };
}
function finish(x, peak) {
  // Remove subsonic DC; apply a short fade so even incidental tails end cleanly.
  let previous = 0, dc = 0, max = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i]; dc = v - previous + .996 * dc; previous = v;
    const inFade = Math.min(1, i / 12), outFade = Math.min(1, (x.length - 1 - i) / (RATE * .012));
    x[i] = Math.tanh(dc * .85) * inFade * outFade; max = Math.max(max, Math.abs(x[i]));
  }
  return Float32Array.from(x, v => max ? v / max * peak : 0);
}
function contact(kind, variation, seed) {
  const p = {
    touch: { d: .115, peak: .44, body: .28, snap: .6, string: .24, f: 1250, bass: 0, decay: .012 },
    hit: { d: .17, peak: .70, body: .6, snap: 1.5, string: .42, f: 1550, bass: .08, decay: .022 },
    perfect: { d: .20, peak: .81, body: .55, snap: 1.9, string: .66, f: 1790, bass: .10, decay: .027 },
    power: { d: .25, peak: .89, body: .93, snap: 2.25, string: .6, f: 1490, bass: .36, decay: .025 },
    kill: { d: .14, peak: .80, body: .55, snap: 2, string: .46, f: 2080, bass: .12, decay: .017 },
    mishit: { d: .14, peak: .51, body: .72, snap: .35, string: .12, f: 940, bass: .06, decay: .009 },
  }[kind];
  const s = sound(p.d, seed), k = 1 + (variation - 1) * .025;
  s.burst(0, p.snap, .0035, 1450, 9000);
  s.burst(.001, p.body, .015, 270, 2300);
  s.burst(.007, p.body * .12, .025, 900, 4400);
  // Inharmonic damped string modes; avoid the long pure sine 'laser' of v1.
  for (const [ratio, gain] of [[1, 1], [1.61, .39], [2.38, .19], [3.13, .08]]) {
    s.tone(.0003, p.string * gain, p.decay / Math.sqrt(ratio), p.f * ratio * k, p.f * ratio * k * .975, .00045);
  }
  s.tone(.001, p.body * .22, .013, 450 * k, 330 * k, .0005);
  if (p.bass) { s.tone(.001, p.bass, .033, 250, 165, .0005); s.tone(.001, p.bass * .48, .023, 480, 355, .0005); }
  if (kind === 'mishit') s.burst(.008, .42, .006, 350, 1350);
  if (kind === 'power') s.burst(.003, .3, .042, 350, 2400);
  s.reflections(kind === 'touch' ? .05 : .13);
  return finish(s.x, p.peak);
}
const EFFECTS = {};
function add(name, samples, group, priority, gain, cooldown = 0) {
  let peak = 0; for (const value of samples) peak = Math.max(peak, Math.abs(value));
  EFFECTS[name] = { samples, duration: samples.length / RATE, peak, group, priority, gain, cooldown };
}
for (const [kind, variants] of [['hit', 3], ['perfect', 3], ['power', 3], ['touch', 2], ['kill', 2], ['mishit', 2]]) {
  for (let i = 0; i < variants; i++) { const name = i ? `${kind}-${i + 1}` : kind; add(name, contact(kind, i, seedOf(name)), 'impact', 5, .82); }
}
for (const [name, heavy, v] of [['swing', false, 0], ['swing-2', false, 1], ['swing-power', true, 0]]) {
  const s = sound(heavy ? .17 : .13, seedOf(name));
  s.air(0, heavy ? .16 : .12, 1, 950 + v * 200, 5500); s.air(.02, .08, .3, 330, 1500);
  add(name, finish(s.x, heavy ? .44 : .30), 'motion', 2, .35, .045);
}
for (const [name, duration, peak, group, priority, gain] of [
  ['floor', .14, .40, 'court', 2, .5], ['net', .19, .35, 'court', 3, .6], ['jump', .11, .26, 'motion', 1, .35], ['land', .17, .36, 'motion', 1, .42],
]) {
  const s = sound(duration, seedOf(name));
  if (name === 'floor') { s.burst(0, .8, .006, 450, 4700); s.tone(0, .23, .016, 640, 460); s.burst(.057, .13, .004, 800, 4000); }
  if (name === 'net') { s.burst(0, .8, .009, 250, 3300); s.burst(.034, .3, .016, 400, 2700); s.tone(0, .1, .028, 390, 320); }
  if (name === 'jump' || name === 'land') { s.burst(0, .7, name === 'land' ? .018 : .008, 160, 1800); s.tone(0, .2, .014, 290, 185); s.air(.016, .065, .12, 1800, 3900); }
  add(name, finish(s.x, peak), group, priority, gain, .07);
}
for (const [name, big] of [['cheer', false], ['cheer-big', true]]) {
  const s = sound(big ? .95 : .6, seedOf(name)), r = random(seedOf(name));
  for (let i = 0; i < (big ? 30 : 14); i++) {
    const at = .04 + (r() + 1) * (big ? .35 : .21);
    s.burst(at, (.12 + (r() + 1) * .16) * (1 - at), .010, 650, 4500);
  }
  s.reflections(.35); add(name, finish(s.x, big ? .41 : .32), 'ambience', 0, .30, .8);
}
function pluck(s, at, f, amp = .24, decay = .05) { s.tone(at, amp, decay, f); s.tone(at, amp * .22, decay * .55, f * 2.01); s.burst(at, amp * .22, .003, 1300, 4200); }
for (const name of ['click', 'blip', 'ready', 'point', 'point-lost', 'success', 'win', 'lose', 'whistle']) {
  const duration = { click: .045, blip: .035, ready: .26, point: .30, 'point-lost': .24, success: .23, win: .85, lose: .58, whistle: .18 }[name];
  const s = sound(duration, seedOf(name));
  if (name === 'click') { s.burst(0, .25, .004, 850, 4200); pluck(s, 0, 760, .16, .009); }
  if (name === 'blip') pluck(s, 0, 920, .1, .007);
  if (name === 'ready') [988, 1319].forEach((f, i) => pluck(s, i * .075, f, .25, .045));
  if (name === 'point') [660, 880].forEach((f, i) => pluck(s, .06 + i * .055, f, .20, .045));
  if (name === 'point-lost') pluck(s, .06, 440, .16, .045);
  if (name === 'success') [784, 988].forEach((f, i) => pluck(s, .025 + i * .055, f, .15, .04));
  if (name === 'win') [523, 659, 784, 1046].forEach((f, i) => pluck(s, .035 + i * .12, f, .26, .13));
  if (name === 'lose') [392, 330, 262].forEach((f, i) => pluck(s, .035 + i * .12, f, .19, .09));
  if (name === 'whistle') { s.tone(0, .14, .055, 2300, 2420, .009); s.tone(0, .035, .042, 2630, 2560, .009); s.air(0, .12, .045, 2000, 4000); }
  const soft = ['click', 'blip', 'success', 'point-lost'].includes(name);
  add(name, finish(s.x, soft ? .25 : .48), 'cue', name === 'win' || name === 'lose' ? 4 : 1, name === 'blip' ? .23 : .48, name === 'blip' ? .075 : .08);
}
for (const [name, kind] of [['skill', 'focus'], ['skill-power', 'power'], ['skill-flow', 'flow'], ['skill-time', 'time'], ['skill-wind', 'wind'], ['skill-mirage', 'mirage']]) {
  const s = sound(.43, seedOf(name));
  if (kind === 'power') { s.burst(0, .5, .035, 350, 3800); s.tone(0, .3, .04, 250, 170); [330, 494, 660].forEach((f, i) => pluck(s, .035 + i * .04, f, .16, .07)); }
  if (kind === 'flow') { [659, 880, 1175].forEach((f, i) => pluck(s, i * .06, f, .24, .09)); s.air(.03, .31, .12, 500, 3500); }
  if (kind === 'time') { [1175, 880, 587].forEach((f, i) => pluck(s, i * .075, f, .20, .085)); s.air(.05, .28, .08, 1500, 4500); }
  if (kind === 'wind') { s.air(0, .22, .35, 1100, 6500); [880, 1320].forEach((f, i) => pluck(s, .04 + i * .055, f, .19, .07)); }
  if (kind === 'mirage') { [1046, 1397, 1175].forEach((f, i) => pluck(s, i * .065, f, .21, .08)); s.air(.06, .3, .12, 1800, 5500); }
  if (kind === 'focus') { [523, 784, 1046].forEach((f, i) => pluck(s, i * .045, f, .24, .08)); s.burst(0, .13, .025, 500, 4500); }
  s.reflections(.17); add(name, finish(s.x, .58), 'skill', 4, .57, .12);
}
for (const [name,duration] of [['door',.48],['paper',.34],['steps',.52],['keyboard',.32],['rain',.85],['switch',.08],['bus',.7]]) {
  const s=sound(duration,seedOf('story-'+name));
  if(name==='door'){s.burst(0,.4,.04,150,1500);s.tone(.03,.12,.13,370,260);s.burst(.28,.25,.022,200,1800);}
  if(name==='paper'){s.air(0,.16,.55,1200,7000);s.air(.16,.16,.33,1600,6000);}
  if(name==='steps')for(const at of [0,.22,.42]){s.burst(at,.3,.014,250,1800);s.tone(at,.1,.025,270,150);}
  if(name==='keyboard')for(const at of [0,.045,.10,.18,.245]){s.burst(at,.18,.006,1600,4200);s.tone(at,.08,.007,1100,700);}
  if(name==='rain'){s.air(0,.82,.35,900,7000);for(const at of [.12,.28,.36,.57])s.burst(at,.06,.02,1200,5000);}
  if(name==='switch'){s.burst(0,.5,.006,1200,5000);s.tone(0,.06,.01,700,400);}
  if(name==='bus'){s.air(0,.67,.5,120,700);s.tone(.03,.1,.22,130,96);}
  add('story-'+name,finish(s.x,name==='rain'?.25:.4),'cue',1,.46,.08);
}
function wav(samples, rate = RATE) {
  const data = Buffer.alloc(44 + samples.length * 2);
  data.write('RIFF'); data.writeUInt32LE(data.length - 8, 4); data.write('WAVEfmt ', 8); data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22); data.writeUInt32LE(rate, 24); data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(clamp(v, -1, 1) * 32767), 44 + i * 2)); return data;
}
function manifest() { return Object.fromEntries(Object.entries(EFFECTS).map(([name, { samples, ...meta }]) => [name, meta])); }
module.exports = { RATE, EFFECTS, wav, manifest };
