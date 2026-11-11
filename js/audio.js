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
      const limiter=this.ctx.createDynamicsCompressor?.();
      if(limiter){limiter.threshold.value=-6;limiter.knee.value=8;limiter.ratio.value=5;limiter.attack.value=.002;limiter.release.value=.07;this.master.connect(limiter);limiter.connect(this.ctx.destination);}
      else this.master.connect(this.ctx.destination);
      this.foleyBuffers=new Map();this.foleyCounts={};
      // Warm short buffers once while the menu opens, never synthesize a first
      // smash on its contact frame.
      if(YY.Foley)for(const kind of ['touch','hit','perfect','power','kill','mishit','swing','swing-power','net','floor','jump','land','step','step-wood','step-deck','step-snow','office-return','paper-fold','paper-glide'])
        for(let i=0;i<3;i++)this.foleyBuffer(kind,i);
      const len = this.ctx.sampleRate * 1;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
    },
    musicEnabled:true, musicVoices:[], musicWanted:null,
    musicScene(id) { this.musicWanted=id; },
    updateMusic(dt=.016) {
      const wanted=this.enabled&&this.musicEnabled&&!G.document.hidden?this.musicWanted:null;
      if(!this.ctx||this.ctx.state!=='running')return;
      dt=Math.min(.1,Math.max(0,dt));
      if(wanted&&!this.musicVoices.some(v=>v.id===wanted)){
        const tr=YY.Soundtrack?.TRACKS[wanted];
        if(tr){
          if(this.musicVoices.length>=2){const old=this.musicVoices.shift();old.source.stop();old.gain.disconnect();}
          this.musicBuffers=this.musicBuffers||new Map();let buffer=this.musicBuffers.get(wanted);
          if(!buffer){const pcm=YY.Soundtrack.render(wanted);buffer=this.ctx.createBuffer(1,pcm.length,YY.Soundtrack.RATE);buffer.getChannelData(0).set(pcm);this.musicBuffers.set(wanted,buffer);if(this.musicBuffers.size>3)this.musicBuffers.delete(this.musicBuffers.keys().next().value);}
          const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();source.buffer=buffer;source.loop=true;gain.gain.value=0;source.connect(gain);gain.connect(this.master);source.start();this.musicVoices.push({id:wanted,source,gain,level:0});
        }
      }
      const duck=this.ctx.currentTime<(this.musicDuckUntil||0)?.45:1;
      for(const v of [...this.musicVoices]){
        const target=v.id===wanted?.40*duck:0;v.level+=YY.clamp(target-v.level,-dt*.9,dt*.7);v.gain.gain.setTargetAtTime(v.level,this.ctx.currentTime,.025);
        if(v.id!==wanted&&v.level<.001){v.source.stop();v.source.disconnect();v.gain.disconnect();this.musicVoices.splice(this.musicVoices.indexOf(v),1);}
      }
    },
    silenceMusic(){for(const v of this.musicVoices){v.source.stop();v.source.disconnect();v.gain.disconnect();}this.musicVoices=[];},
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
    foleyBuffer(kind,i) {
      const key=kind+':'+i;let buffer=this.foleyBuffers.get(key);
      if(!buffer){const data=YY.Foley.render(kind,i);buffer=this.ctx.createBuffer(1,data.length,YY.Foley.RATE);buffer.getChannelData(0).set(data);this.foleyBuffers.set(key,buffer);}
      return buffer;
    },
    foley(kind, volume=1, event={}) {
      if(!this.ok()||!YY.Foley)return;
      const i=(this.foleyCounts[kind]||0)%3;this.foleyCounts[kind]=i+1;
      const buffer=this.foleyBuffer(kind,i);
      const src=this.ctx.createBufferSource(),gain=this.ctx.createGain();src.buffer=buffer;gain.gain.value=volume*.7;src.connect(gain);
      const pan=this.ctx.createStereoPanner?.();
      if(pan){pan.pan.value=YY.clamp((event.z??event.x??0)/(event.z!=null?3.5:10),-.65,.65);gain.connect(pan);pan.connect(this.master);}else gain.connect(this.master);
      src.onended=()=>{src.disconnect();gain.disconnect();pan?.disconnect();};src.start();
    },
    hit(q, power, event = {}) {
      const soft=['drop','slice','net','tumble','block'].includes(event.shot);
      const kind=event.feed||event.serve?'touch':q<.4?'mishit':event.shot==='kill'?'kill':power?'power':soft?'touch':q>=.85?'perfect':'hit';
      if(this.ctx)this.musicDuckUntil=this.ctx.currentTime+.16;
      const strength=event.feed?.48:event.serve?.7:event.shot==='halfsmash'?.82:event.highSmash?1:.92;
      this.foley(kind,(.75+YY.clamp(q||0,0,1)*.25)*strength,event);
    },
    swing(btn) { this.foley(btn==='smash'?'swing-power':'swing',btn==='drop'?.20:.34); },
    net() { this.foley('net',.58); }, floor() { this.foley('floor',.48); },
    jump() { this.foley('jump',.3); }, land() { this.foley('land',.42); },
    step(e) { this.foley(({bamboo:'step-wood',sunset:'step-deck',harbor:'step-deck',aurora:'step-snow'})[this.venue]||'step',.16,e); },
    point(won) { if (this.ok()) this.tone(won ? 880 : 440, .1, .07, 'triangle'); },
    success() { if (this.ok()) this.tone(988, .08, .045, 'triangle'); },
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
    /** 技能发动：上扬的扫频 + 和弦 */
    skill(id) {
      if(!this.ok())return;
      const paper={tongqin:'office-return',gongwei:'paper-fold',jiaban:'paper-glide'}[id];
      if(paper){this.foley(paper,.6);return;}
      const family=YY.CharacterArt?.family(id)||'focus';
      const notes={reach:[330,660,990],sweep:[392,587,784],summon:[523,784,1175],place:[440,554,659],focus:[587,880,1175],leap:[659,988,1319]}[family];
      this.burst(['shensuo','youyou','xuanpai'].includes(id)?2400:1500,.8,.13,.07);
      notes.forEach((f,i)=>{const c=this.ctx,t=c.currentTime+i*.045,o=c.createOscillator(),g=c.createGain();o.type=family==='reach'?'triangle':'sine';o.frequency.value=f;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.07,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+.16);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+.18);o.onended=()=>{o.disconnect();g.disconnect();};});
    },
    tired(){if(this.ok())this.burst(1000,.6,.2,.035);},
    ready() { if (this.ok()) { this.tone(988, 0.08, 0.1, 'triangle'); setTimeout(() => this.tone(1319, 0.12, 0.1, 'triangle'), 70); } },
    /** 打字机：对话逐字显示 */
    blip() { if (this.ok()) this.tone(1200 + Math.random() * 200, 0.025, 0.025, 'square'); },
    win() {
      if (!this.ok()) return;
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 0.18, 'triangle'), i * 120));
    },
    lose() {
      if (!this.ok()) return;
      [392, 330, 262].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 0.15, 'triangle'), i * 160));
    },
  });
  G.document.addEventListener('visibilitychange',()=>{if(G.document.hidden)A.silenceMusic();});
})(window);
