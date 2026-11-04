// Generated from js/net.js. Do not edit here.
(function(G) { const YY = G.YY, KIND = ['over', 'side', 'under'];
  const stamp = (sn) => sn.nt ?? sn.ht;
  class GuestView {
    constructor() {
      this.players = [0, 1].map((i) => ({ idx: i, side: i ? 1 : -1, dir: i ? -1 : 1, x: i ? 2.8 : -2.3, y: 0, vx: 0, vy: 0, onGround: true, stamina: 100, swing: null, runPhase: 0, flash: 0, land: 0 }));
      this.shuttle = { x: -1.9, y: 0.95, vx: 0, vy: 0, live: false, held: true, netHit: false, crossedNet: false, speed: 0, lastHitter: -1 };
      this.score = [0, 0]; this.server = 0; this.phase = 'serve'; this.serveT = 0; this.serving = null; this.rally = 0;
      this.opt = { target: 7, cap: 11 }; this.names = ['房主', '你']; this.practice = false; this.time = 0;
      this.landMark = null; this.pred = null; this.hint = null; this.winner = -1;
      this.buf = []; this.clockOff = null; this.stats = null; this.longest = 0;
      this.pendingEvents = []; this.events = [];
      this.delay = 0.025; this.jitter = 0; this.lastArrival = null; this.lastStamp = null; this.renderStamp = -Infinity;
    }
    serveMeter() { const u = this.serveT * 1.15; return 1 - Math.abs((u % 2) - 1); }
    push(sn, now = YY.platform.now() / 1000) {
      const time = stamp(sn);
      // 同一连接晚到的旧快照不能把画面倒回去。
      if (sn.nt != null && this.buf.length && time < stamp(this.buf[this.buf.length - 1])) return;
      if (this.lastArrival !== null && time > this.lastStamp) {
        const gap = now - this.lastArrival;
        const variation = Math.abs(gap - (time - this.lastStamp));
        this.jitter += (variation - this.jitter) * 0.15;
        const target = YY.clamp((time - this.lastStamp) + this.jitter * 2, 0.025, 0.08);
        this.delay += (target - this.delay) * (target > this.delay ? 0.5 : 0.05);
      }
      this.lastArrival = now; this.lastStamp = time;
      const off = time - now;
      if (this.clockOff === null || off > this.clockOff || Math.abs(off - this.clockOff) > 1) this.clockOff = off;
      else this.clockOff += (off - this.clockOff) * 0.02;
      if (this.buf.length && sn.ht < this.buf[this.buf.length - 1].ht) {
        this.buf = []; this.pendingEvents = []; this.events = []; this.renderStamp = -Infinity;
      }
      this.buf.push(sn);
      if (sn.ev && sn.ev.length) this.pendingEvents.push({ t: time, events: sn.ev });
      if (this.buf.length > 30) this.buf.shift();
    }
    update(now = YY.platform.now() / 1000) {
      if (!this.buf.length) return;
      const rt = Math.max(this.renderStamp, now + this.clockOff - this.delay);
      let a = this.buf[0], b = a;
      for (let i = 0; i < this.buf.length; i++) {
        if (stamp(this.buf[i]) <= rt) a = this.buf[i];
        if (stamp(this.buf[i]) >= rt) { b = this.buf[i]; break; }
        b = this.buf[i];
      }
      const u = stamp(b) > stamp(a) ? YY.clamp((rt - stamp(a)) / (stamp(b) - stamp(a)), 0, 1) : 1;
      const L = (x, y) => x + (y - x) * u;
      // 离散状态取当前时刻已发生的快照，不能提前套用下一帧的击球/撞网结果。
      const cur = u < 1 ? a : b;
      const reset = a.ph !== b.ph && b.ph === 'serve';
      this.time = L(a.ht, b.ht);
      this.renderStamp = L(stamp(a), stamp(b));
      this.phase = cur.ph; this.score = cur.sc; this.server = cur.sv;
      this.serveT = a.ph === b.ph ? L(a.st, b.st) : cur.st; this.serving = cur.sg ? {} : null;
      this.rally = cur.ry; this.winner = cur.w;
      if (cur.names) this.names = [cur.names[0] === '你' ? '房主' : cur.names[0], '你'];
      for (let i = 0; i < 2; i++) {
        const p = this.players[i], pa = a.p[i], pb = b.p[i], pc = cur.p[i];
        p.x = reset ? pc[0] : L(pa[0], pb[0]); p.y = reset ? pc[1] : L(pa[1], pb[1]);
        p.vx = pc[2]; p.vy = pc[3]; p.onGround = !!pc[4]; p.stamina = pc[5];
        const sw = pc[6];
        const sameSwing = pa[6] && pb[6] && pb[6][0] >= pa[6][0] && pa[6][1] === pb[6][1];
        p.swing = sw ? {
          t: sameSwing ? L(pa[6][0], pb[6][0]) : sw[0], kind: KIND[sw[1]] || 'over', dur: sw[2], serve: !!sw[3],
          contact: sw[4] ? { x: sw[4][0], y: sw[4][1], t: sw[4][2] } : null,
        } : null;
        p.runPhase = reset ? pc[7] : L(pa[7], pb[7]); p.flash = pc[8]; p.land = pc[9];
      }
      const s = this.shuttle, sa = a.s, sb = b.s;
      const sc = cur.s;
      const sameFlight = a.hc === b.hc && a.ph === b.ph && sa[4] === sb[4] && sa[5] === sb[5] &&
        sa[7] === sb[7] && sa[8] === sb[8] && Math.abs(sa[0] - sb[0]) <= 3;
      // 只在同一次飞行内插值，禁止跨发球、触拍、撞网或重置连出虚假的穿网轨迹。
      s.x = sameFlight ? L(sa[0], sb[0]) : sc[0]; s.y = sameFlight ? L(sa[1], sb[1]) : sc[1];
      s.vx = sc[2]; s.vy = sc[3]; s.live = !!sc[4]; s.held = !!sc[5]; s.speed = sc[6]; s.lastHitter = sc[7];
      s.netHit = !!sc[8]; s.crossedNet = !!sc[9];
      this.landMark = cur.lm ? { x: cur.lm[0], inB: !!cur.lm[1], t: cur.lm[2] } : null;
      this.pred = cur.pl != null ? { landX: cur.pl } : null;
      while (this.pendingEvents.length && this.pendingEvents[0].t <= this.renderStamp) {
        this.events.push(...this.pendingEvents.shift().events);
      }
    }
  }
  YY.GuestView = GuestView;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis);
