'use strict';
const BANK = require('./audio-bank');
const createStoryVoice = require('./story-voice');
const VARIANTS = { hit: ['hit', 'hit-2', 'hit-3'], perfect: ['perfect', 'perfect-2', 'perfect-3'], power: ['power', 'power-2', 'power-3'], touch: ['touch', 'touch-2'], kill: ['kill', 'kill-2'], mishit: ['mishit', 'mishit-2'], swing: ['swing', 'swing-2'] };
const SKILLS = { pokong: 'skill-power', lieyan: 'skill-power', touji: 'skill-power', tiebi: 'skill', jiaoke: 'skill', shuju: 'skill-time', chaoxi: 'skill-flow', liuxing: 'skill-flow', huanshi: 'skill-time', shanbu: 'skill-wind', shanxian: 'skill-wind', jinghua: 'skill-mirage', lengxiao: 'skill-mirage' };
const CORE = ['hit', 'hit-2', 'hit-3', 'perfect', 'perfect-2', 'perfect-3', 'power', 'power-2', 'power-3', 'touch', 'touch-2', 'kill', 'kill-2', 'mishit', 'mishit-2', 'swing', 'swing-2', 'swing-power', 'floor'];
const MAX_CONTEXTS = 24, MAX_VOICES = 7;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// InnerAudio's WebAudio driver caches short local clips and allows overlap.
// A bounded voice allocator gives contact sounds precedence over UI/ambience.
module.exports = function createAudio(wx, options = {}) {
  const now = options.now || (() => Date.now());
  const slots = [], counters = {}, lastPlayed = new Map();
  let enabled = true, warmed = false, disposed = false, webAudio = true, impactUntil = 0, level = .86, hidden = false, speech = null;
  function remove(slot) {
    if (slot.dead) return;
    slot.dead = true; const i = slots.indexOf(slot); if (i >= 0) slots.splice(i, 1);
    try { slot.ctx.stop(); } catch (_) {}
    try { slot.ctx.destroy?.(); } catch (_) {}
  }
  function applyMix() {
    const active = slots.filter(s => s.busy), ducking = now() < impactUntil;
    let peakSum = 0;
    for (const slot of active) {
      const duck = ducking && ['cue', 'ambience', 'skill'].includes(slot.group) ? .38 : 1;
      slot.mix = clamp(slot.volume * level * duck, 0, 1);
      peakSum += slot.mix * slot.peak;
    }
    // Conservative headroom even if every transient lands on the same sample.
    const limit = speech?.state==='playing' ? .32 : .92;
    const headroom = peakSum > limit ? limit / peakSum : 1;
    for (const slot of active) {
      const value = slot.mix * headroom;
      if (value !== slot.applied) { try { slot.ctx.volume = value; slot.applied = value; } catch (_) {} }
    }
  }
  function create(name) {
    if (disposed || typeof wx.createInnerAudioContext !== 'function') return null;
    if (slots.length >= MAX_CONTEXTS) {
      const idle = slots.filter(s => !s.busy).sort((a, b) => a.used - b.used)[0];
      if (!idle) return null; remove(idle);
    }
    let ctx, enhanced = webAudio;
    try { ctx = wx.createInnerAudioContext({ useWebAudioImplement: enhanced }); }
    catch (_) { webAudio = enhanced = false; try { ctx = wx.createInnerAudioContext(); } catch (_) { return null; } }
    if (!ctx) return null;
    const slot = { ctx, name, busy: false, dead: false, used: now(), ...BANK[name] };
    slots.push(slot);
    const end = () => {
      if (slot.dead || !slot.busy) return;
      // Ignore a delayed completion from the preceding play of a reused voice.
      if (now() - slot.started < slot.duration * 500) return;
      slot.busy = false; slot.used = now();
    };
    try {
      ctx.onEnded?.(end);
      ctx.onError?.(() => { if (slot.dead) return; if (enhanced) webAudio = false; remove(slot); });
      ctx.obeyMuteSwitch = true; ctx.loop = false; ctx.autoplay = false;
      ctx.src = `assets/audio/${name}.wav`;
    } catch (_) { if (enhanced) webAudio = false; remove(slot); return null; }
    return slot.dead ? null : slot;
  }
  const A = {
    get enabled() { return enabled; },
    set enabled(value) { enabled = !!value; if (!enabled) {this.stop();this.stopVoice();} },
    get volume() { return level; },
    set volume(value) { if (Number.isFinite(value)) { level = clamp(value, 0, 1); this.update(); } },
    init() {
      if (disposed || warmed || !enabled) return;
      warmed = true;
      try { wx.setInnerAudioOption?.({ obeyMuteSwitch: true, mixWithOther: true, success() {}, fail() {} }); } catch (_) {}
      for (const name of CORE) create(name);
    },
    update() {
      const t = now();
      for (const slot of [...slots]) {
        if (slot.busy && t >= slot.deadline) remove(slot); // Missing ended/error callback cannot exhaust voices.
      }
      applyMix();
    },
    play(name, volume = 1, opts = {}) {
      if (!enabled || disposed || hidden || !BANK[name] || !Number.isFinite(volume) || volume <= 0) return false;
      this.init(); this.update();
      const meta = BANK[name], t = now(), group = opts.group || meta.group, priority = opts.priority ?? meta.priority;
      const key = opts.key || name, cooldown = opts.cooldown ?? meta.cooldown;
      if (lastPlayed.has(key) && t - lastPlayed.get(key) < cooldown * 1000) return false;
      const active = slots.filter(s => s.busy);
      if (active.length >= MAX_VOICES) {
        const victim = active.filter(s => s.priority < priority).sort((a, b) => a.priority - b.priority || a.started - b.started)[0];
        if (!victim) return false; remove(victim);
      }
      let slot = slots.find(s => s.name === name && !s.busy);
      if (!slot) slot = create(name);
      if (!slot) return false;
      slot.group = group; slot.priority = priority; slot.volume = clamp(volume, 0, 1) * meta.gain;
      slot.started = slot.used = t; slot.deadline = t + meta.duration * 1000 + 350; slot.busy = true;
      if (group === 'impact') impactUntil = t + 120;
      applyMix();
      try {
        // New buffers start at zero. Seek only when replaying an ended clip.
        if (slot.played) slot.ctx.seek(0);
        slot.played = true; slot.ctx.play(); lastPlayed.set(key, t); return true;
      } catch (_) { remove(slot); return false; }
    },
    variant(kind, volume = 1, opts = {}) {
      const names = VARIANTS[kind] || [kind], i = counters[kind] || 0;
      counters[kind] = i + 1; return this.play(names[i % names.length], volume, { ...opts, key: kind });
    },
    hit(q, power, event = {}) {
      q = Number.isFinite(q) ? clamp(q, 0, 1) : .5;
      const shot = event.shot;
      const soft = ['drop', 'slice', 'net', 'tumble', 'block'].includes(shot);
      const kind = event.feed || event.serve ? 'touch' : shot === 'kill' ? 'kill' : power ? 'power' : q < .35 ? 'mishit' : soft ? 'touch' : q >= .85 ? 'perfect' : 'hit';
      const strength = event.feed ? .48 : event.serve ? .7 : shot === 'halfsmash' ? .82 : 1;
      this.variant(kind, (.75 + q * .25) * strength);
    },
    swing(btn) { if (btn === 'smash') this.play('swing-power', 1); else this.variant('swing', btn === 'drop' ? .65 : 1); },
    net() { this.play('net'); }, floor() { this.play('floor'); }, jump() { this.play('jump'); }, land() { this.play('land'); },
    point(won) { this.play(won ? 'point' : 'point-lost'); }, success() { this.play('success'); },
    whistle() { this.play('whistle', .6); }, cheer(big) { this.play(big ? 'cheer-big' : 'cheer'); },
    click() { this.play('click'); }, skill(id) { this.play(SKILLS[id] || 'skill'); }, ready() { this.play('ready'); },
    blip() { this.play('blip'); }, win() { this.play('win'); }, lose() { this.play('lose'); },
    stop() {
      // Destroy active voices instead of recycling stop callbacks into a new hit.
      for (const s of [...slots]) if (s.busy) remove(s);
      lastPlayed.clear(); impactUntil = 0;
    },
    voiceLine(who,text) { let h=2166136261;for(const c of who+'|'+text)h=Math.imul(h^c.charCodeAt(0),16777619);return this.speech.play('v'+(h>>>0).toString(16)); },
    stopVoice() { this.speech?.stop(); },
    storyAction(action) { this.play(({page:'story-paper',rustle:'story-paper',cheer:'cheer'})[action] || ('story-'+action)); },
    suspend() { hidden = true; this.stop(); this.stopVoice(); }, resume() { hidden = false; },
    releaseCache() { for (const s of [...slots]) if (!s.busy) remove(s); warmed = false; },
    destroy() { this.stop();this.speech.destroy(); for (const s of [...slots]) remove(s); disposed = true; },
    diagnostics() { return { contexts: slots.length, voices: slots.filter(s => s.busy).length, webAudio, enabled, hidden, warmed }; },
  };
  A.speech=speech=createStoryVoice(wx,()=>enabled&&!hidden&&!disposed);
  return A;
};
