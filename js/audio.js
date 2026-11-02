/* 羽跃对决 · WebAudio 合成音效（无外部资源） */
(function (G) {
  'use strict';
  const YY = G.YY;
  const A = (YY.Audio = {
    ctx: null, master: null, noise: null, enabled: true,
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = G.AudioContext || G.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 1;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
    },
    ok() { return this.enabled && this.ctx && this.ctx.state === 'running'; },
    burst(freq, q, dur, vol, type) {
      const c = this.ctx, t = c.currentTime;
      const src = c.createBufferSource();
      src.buffer = this.noise;
      src.playbackRate.value = 0.8 + Math.random() * 0.4;
      const f = c.createBiquadFilter();
      f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
    },
    tone(freq, dur, vol, type, slide) {
      const c = this.ctx, t = c.currentTime;
      const o = c.createOscillator();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    },
    hit(q, power) {
      if (!this.ok()) return;
      const v = 0.35 + q * 0.35;
      this.burst(2600 + q * 900, 3, 0.07, v);
      this.tone(900 + q * 300, 0.05, 0.12 * v, 'triangle', 500);
      if (power) {
        this.burst(900, 1.2, 0.18, 0.7);
        this.tone(160, 0.22, 0.6, 'sine', 50);
      }
    },
    swing() { if (this.ok()) this.burst(1400, 0.8, 0.12, 0.08, 'highpass'); },
    net() { if (this.ok()) { this.burst(500, 1, 0.2, 0.35); this.tone(120, 0.15, 0.15, 'sine'); } },
    floor() { if (this.ok()) { this.burst(700, 2, 0.08, 0.3); this.tone(220, 0.08, 0.15, 'sine', 120); } },
    jump() { if (this.ok()) this.burst(300, 1, 0.08, 0.12, 'lowpass'); },
    whistle() {
      if (!this.ok()) return;
      const c = this.ctx, t = c.currentTime;
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 2900;
      const lfo = c.createOscillator(); lfo.frequency.value = 32;
      const lg = c.createGain(); lg.gain.value = 120;
      lfo.connect(lg); lg.connect(o.frequency);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      g.gain.setValueAtTime(0.12, t + 0.28);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
      o.connect(g); g.connect(this.master);
      o.start(t); lfo.start(t); o.stop(t + 0.4); lfo.stop(t + 0.4);
    },
    cheer(big) {
      if (!this.ok()) return;
      const c = this.ctx, t = c.currentTime;
      const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 0.6;
      const g = c.createGain();
      const v = big ? 0.25 : 0.12, d = big ? 1.8 : 1.0;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t); src.stop(t + d + 0.05);
    },
    click() { if (this.ok()) this.tone(660, 0.06, 0.12, 'triangle', 880); },
    win() {
      if (!this.ok()) return;
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 0.18, 'triangle'), i * 120));
    },
    lose() {
      if (!this.ok()) return;
      [392, 330, 262].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 0.15, 'triangle'), i * 160));
    },
  });
})(window);
