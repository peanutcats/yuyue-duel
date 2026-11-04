'use strict';
// Local, pre-rendered PCM effects avoid unsupported WebAudio oscillator APIs.
module.exports = function createAudio(wx) {
  const pools = new Map(); let lastBlip = 0, warmed = false;
  const A = {
    enabled: true,
    init() {
      if (warmed) return; warmed = true;
      wx.setInnerAudioOption?.({ obeyMuteSwitch: true, mixWithOther: true, success() {}, fail() {} });
    },
    play(name, volume = .6) {
      if (!this.enabled || !wx.createInnerAudioContext) return;
      this.init();
      let pool = pools.get(name);
      if (!pool) { pool = []; pools.set(name, pool); }
      let slot = pool.find(s => !s.busy);
      if (!slot && pool.length < (['hit', 'power', 'swing'].includes(name) ? 3 : 1)) {
        const ctx = wx.createInnerAudioContext(); slot = { ctx, busy: false }; pool.push(slot);
        ctx.src = `assets/audio/${name}.wav`; ctx.obeyMuteSwitch = true;
        const release = () => { slot.busy = false; };
        ctx.onEnded?.(release); ctx.onStop?.(release); ctx.onError?.(release);
      }
      if (!slot) return;
      slot.busy = true; slot.ctx.volume = volume;
      try { slot.ctx.seek(0); slot.ctx.play(); } catch (_) { slot.busy = false; }
    },
    stop() { for (const pool of pools.values()) for (const s of pool) { s.ctx.stop(); s.busy = false; } },
    hit(q, power) { this.play(power ? 'power' : 'hit', .35 + Math.max(0, Math.min(1, q || 0)) * .3); },
    swing() { this.play('swing', .22); }, net() { this.play('net', .45); }, floor() { this.play('floor', .4); },
    jump() { this.play('jump', .2); }, whistle() { this.play('whistle', .28); }, cheer(big) { this.play(big ? 'cheer-big' : 'cheer', .22); },
    click() { this.play('click', .24); }, skill() { this.play('skill', .4); }, ready() { this.play('ready', .35); },
    blip() { const t = Date.now(); if (t - lastBlip > 75) { lastBlip = t; this.play('blip', .12); } },
    win() { this.play('win', .45); }, lose() { this.play('lose', .3); },
  };
  return A;
};
