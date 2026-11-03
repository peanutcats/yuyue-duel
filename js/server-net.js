/* Browser transport for authoritative matches. No client sends a match result. */
(function (G) {
  'use strict';
  const YY = G.YY;
  const N = YY.Net = {
    code: null, player: 0, seq: 0, action: 0, token: null, matchId: null,
    socket: null, manual: true, rtt: 0.08, clockOff: null, minRtt: Infinity,
    onMsg: null, onStart: null, onWelcome: null, onClose: null, onStatus: null,
    endpoint() {
      // Configure this constant for a separately hosted static frontend.
      return G.YUYUE_SERVER_URL || `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
    },
    connect(request) {
      this.close(); this.manual = false; this.request = request; this.retryAt = 0;
      return new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; this.open(); });
    },
    open() {
      if (this.manual) return;
      let ws;
      try { ws = new WebSocket(this.endpoint()); } catch (e) { this.fail(e.message); return; }
      this.socket = ws; this.lastRecv = performance.now();
      const timeout = setTimeout(() => { if (this.socket === ws) ws.close(); }, 8000);
      ws.onopen = () => {
        if (this.socket !== ws) return ws.close();
        ws.send(JSON.stringify(this.token ? { t: 'resume', room: this.code, token: this.token } : this.request));
        this.ping();
        clearInterval(this.timer);
        this.timer = setInterval(() => {
          this.ping(); this.flush();
          if (this.idle() > 12) this.socket?.close();
        }, 1000);
      };
      ws.onmessage = event => {
        if (this.socket !== ws) return;
        let d; try { d = JSON.parse(event.data); } catch (_) { return; }
        this.lastRecv = performance.now();
        if (d.t === 'pong') {
          const t = performance.now() / 1000, rtt = t - d.ts;
          if (rtt < 0 || rtt > 10) return;
          this.rtt = this.rtt * 0.6 + rtt * 0.4;
          if (rtt <= this.minRtt * 1.2) { this.minRtt = Math.min(this.minRtt, rtt); this.clockOff = d.nt - (t + d.ts) / 2; }
        } else if (d.t === 'welcome') {
          clearTimeout(timeout); this.retryAt = 0;
          this.code = d.room; this.player = d.player; this.token = d.token;
          this.seq = d.seq; this.action = d.action; this.matchId = d.matchId; this.pending = null;
          if (this.onWelcome) this.onWelcome(d);
          if (this.resolve) { this.resolve(d.room); this.resolve = this.reject = null; }
        } else if (d.t === 'start') {
          this.matchId = d.matchId; this.pending = null;
          if (this.onStart) this.onStart(d);
        } else if (d.t === 'error' || d.t === 'ended') this.fail(d.message);
        else if (this.onMsg) this.onMsg(d);
      };
      ws.onerror = () => {};
      ws.onclose = () => {
        clearTimeout(timeout);
        if (this.socket !== ws || this.manual) return;
        clearInterval(this.timer); this.pending = null;
        if (!this.token) return this.fail('无法连接比赛服务器，请检查地址与网络');
        if (!this.retryAt) this.retryAt = performance.now();
        if (performance.now() - this.retryAt >= 20000) return this.fail('重连超时，请重新加入房间');
        if (this.onStatus) this.onStatus('连接中断，正在重连…');
        this.retry = setTimeout(() => this.open(), 750);
      };
    },
    fail(message) {
      const reject = this.reject, callback = this.onClose;
      this.close();
      if (reject) reject(new Error(message)); else if (callback) callback(message);
    },
    send(d) {
      if (this.socket?.readyState !== 1) return false;
      if (d.t === 'in') {
        if (this.pending) d = { ...d, presses: this.pending.presses.concat(d.presses) };
        if (d.presses.length > 8) { this.socket.close(); return false; }
        this.pending = d; this.flush(); return true;
      }
      if (this.socket.bufferedAmount > 65536) { this.socket.close(); return false; }
      this.socket.send(JSON.stringify(d)); return true;
    },
    flush() {
      if (!this.pending || this.socket?.readyState !== 1) return;
      if (this.socket.bufferedAmount > 32768) {
        if (!this.flushTimer) this.flushTimer = setTimeout(() => { this.flushTimer = null; this.flush(); }, 16);
        return;
      }
      this.socket.send(JSON.stringify(this.pending)); this.pending = null;
    },
    ping() { this.send({ t: 'ping', ts: performance.now() / 1000 }); },
    idle() { return (performance.now() - (this.lastRecv || performance.now())) / 1000; },
    serverTime() { return performance.now() / 1000 + (this.clockOff || 0); },
    statusText(_, delay = 0) {
      if (this.retryAt) return '正在重连服务器…';
      return `服务器往返 ${Math.round(this.rtt * 1000)} ms · 服务器计算 · 画面缓冲 ${Math.round(delay * 1000)} ms`;
    },
    diagnostics() { return '双方上传操作，服务器统一计算球路、碰撞和比分'; },
    close() {
      this.manual = true; clearInterval(this.timer); clearTimeout(this.retry); clearTimeout(this.flushTimer);
      const ws = this.socket; this.socket = null;
      if (ws) { if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'leave' })); ws.close(); }
      this.token = this.code = this.matchId = this.pending = null;
      this.resolve = this.reject = null; this.seq = this.action = 0; this.retryAt = 0;
      this.clockOff = null; this.minRtt = Infinity;
    },
  };

  // Predict only the local player's presentation using the same movement rules.
  // Shuttle contact and scoring are never executed by this prediction model.
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
      m.players = sn.pp.map(p => ({ ...p, swing: p.swing ? { ...p.swing } : null }));
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
  YY.PlayerPrediction = PlayerPrediction;
})(window);
