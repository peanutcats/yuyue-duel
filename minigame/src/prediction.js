'use strict';
// Predict only local movement/animation. The server alone decides hits and score.
module.exports = function (YY, N) {
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
      if (!sn?.pp || sn.wait || sn.ph === 'over') { this.display = null; return; }
      const m = Object.create(YY.Match.prototype);
      m.players = sn.pp.map(p => ({ ...p, st: { ...p.st }, buff: { ...p.buff }, swing: p.swing ? { ...p.swing } : null }));
      m.inputs = [{ move: 0, presses: [] }, { move: 0, presses: [] }];
      m.phase = sn.ph; m.server = sn.sv; m.serveT = sn.st; m.serving = sn.sg ? {} : null;
      m.shuttle = { x: sn.s[0], y: sn.s[1], vx: sn.s[2], vy: sn.s[3] };
      m.emit = () => {};
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
        else m.updatePlayer(p, YY.C.DT);
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
};
