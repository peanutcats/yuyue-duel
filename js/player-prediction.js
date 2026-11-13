'use strict';
// Predict only local movement/animation. The server alone decides hits and score.
function createPrediction(YY, N) {
  class PlayerPrediction {
    constructor(index) { this.index = index; this.pending = []; this.state = null; this.display = null; }
    input(d) {
      this.pending.push({ ...d, at: N.serverTime() + N.rtt / 2 });
      if (this.pending.length > 180) this.pending.shift();
    }
    snapshot(sn) {
      this.state = sn;
      this.pending = this.pending.filter(d => d.seq > (sn.ack?.[this.index] || 0));
    }
    apply(view, dt) {
      const sn = this.state;
      if (sn?.d3) { this.display=null; return; } // Spatial skills and movement are interpolated from the same authoritative timeline.
      if (!sn?.pp || sn.wait || sn.ph === 'over') { this.display = null; return; }
      // 荡藤、松手飞出：位置由服务器的技能决定，直接用快照
      const own = sn.pp[this.index]?.cnt;
      if (own && (own.vine || own.fling != null)) { this.display = null; return; }
      const m = Object.create(YY.Match.prototype);
      m.players = sn.pp.map(p => ({ ...p, st: { ...p.st }, buff: { ...p.buff }, cnt: { ...p.cnt, ...(p.cnt.teacher ? {teacher:{...p.cnt.teacher}} : {}) }, hist: (p.hist || []).slice(), swing: p.swing ? { ...p.swing } : null }));
      m.inputs = [{ move: 0, presses: [] }, { move: 0, presses: [] }];
      m.phase = sn.ph; m.server = sn.sv; m.serveT = sn.st; m.serving = sn.sg ? {} : null;
      m.shuttle = { x: sn.s[0], y: sn.s[1], vx: sn.s[2], vy: sn.s[3] };
      m.emit = () => {};
      // 技能效果由服务器结算；本地只保留跑动/跳跃所需的规则状态
      const k = sn.k || 0;
      m.skillsOn = false; m.predictGround = true;
      m.ents = k ? k.e.filter(e => e.k === 'cone' || e.k === 'pane' && e.ground).map(e=>({...e})) : [];
      m.events = []; m.time = sn.ht || 0; m.pred = null;
      m.sk = { half: k ? k.r[0].slice() : [YY.C.HALF, YY.C.HALF], netUp: 0, shift: 0, option: null, potato: null, beat: null, used: [{}, {}], seen: [{}, {}] };
      m.shuttle.ctl = k && k.c || null;
      // 持球释放包含真正的击球、统计与球路结算，必须等服务器确认。
      // skillsOn=false 只禁用新技能，挡不住 handlePress / 缓存挥拍进入释放分支。
      // 停球期间仍预测走位；牵引期间可预演挥拍，但都不改动受控球。
      m.skSwingBlocked = (player, _btn, mod) => {
        const ctl = m.shuttle.ctl;
        return !!(mod.noSwing || (ctl && ctl.k === 'cradle' && ctl.o === player.idx));
      };
      const p = m.players[this.index], inp = m.inputs[this.index];
      inp.move = sn.im?.[this.index] || 0;
      let time = sn.nt, j = 0, hitstop = sn.hs || 0;
      const end = Math.min(sn.nt + 0.25, N.serverTime() + N.rtt / 2);
      while (time + YY.C.DT <= end) {
        while (j < this.pending.length && this.pending[j].at <= time + YY.C.DT) {
          const d = this.pending[j++]; inp.move = d.move;
          inp.presses.push(...d.presses.map(a => ({ btn: a.btn })));
        }
        if (hitstop > 0) hitstop -= YY.C.DT;
        else {
          m.time += YY.C.DT; m.updatePlayer(p, YY.C.DT);
          if(m.phase==='rally')for(const e of m.ents)if(e.k==='pane'){e.age+=YY.C.DT;e.t-=YY.C.DT;}
        }
        time += YY.C.DT;
      }
      if (this.display && this.display.phase === sn.ph) {
        const gap = Math.hypot(p.x - this.display.x, p.y - this.display.y);
        if (gap < 0.6) {
          const blend = 1 - Math.exp(-70 * dt);
          p.x = YY.lerp(this.display.x, p.x, blend); p.y = YY.lerp(this.display.y, p.y, blend);
        }
      }
      this.display = { x: p.x, y: p.y, phase: sn.ph };
      Object.assign(view.players[this.index], p);
    }
  }

return PlayerPrediction;
}
if (typeof module !== 'undefined' && module.exports) module.exports = createPrediction;
else globalThis.YY.createPrediction = createPrediction;
