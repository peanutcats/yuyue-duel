'use strict';

// SocketTask is not a browser WebSocket: sends are callback-based, and there is
// no portable bufferedAmount. Keep one send in flight and coalesce only inputs.
class Network {
  constructor(platform, config) {
    this.P = platform; this.config = config; this.generation = 0; this.active = true;
    this.status = 'closed'; this.seq = 0; this.action = 0; this.rtt = .08;
    this.code = null; this.token = null; this.queue = []; this.inFlight = false;
  }
  connect(request) {
    this.close(); this.request = request; this.manual = false; this.active = true;
    return new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; this.open(); });
  }
  configured() {
    if (this.config.networkTransport === 'off') return false;
    if (this.config.networkTransport === 'cloud') return !!(this.config.cloud?.env && this.config.cloud?.service);
    return !!this.config.serverUrl;
  }
  open() {
    if (this.manual) return;
    if (!this.configured()) return this.fail('在线对战暂未开放，可选择同屏对战');
    const generation = ++this.generation; this.queue = []; this.inFlight = false;
    this.opening = true;
    this.awaitingWelcome = true;
    this.status = this.token || this.queueToken ? 'reconnecting' : 'connecting'; this.openedAt = this.P.now(); this.lastReceived = this.openedAt;
    const failed = e => { if (generation === this.generation && !this.manual) this.disconnected(e?.errMsg || e?.message || '网络连接失败'); };
    if (this.config.networkTransport === 'cloud') {
      this.openCloud(generation).catch(failed); return;
    }
    const url = this.config.serverUrl;
    if (!/^wss:\/\//.test(url) && !(this.config.allowLocalhost && /^ws:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url))) return this.fail('在线对战暂不可用，请稍后再试');
    try { this.attach(this.P.wx.connectSocket({ url, success() {}, fail: failed }), generation); }
    catch (e) { failed(e); }
  }
  async openCloud(generation) {
    const cloud = this.P.wx.cloud, config = this.config.cloud;
    if (typeof cloud?.init !== 'function' || typeof cloud?.connectContainer !== 'function') {
      throw new Error('当前微信版本不支持在线对战，请更新微信后重试');
    }
    if (!this.cloudInit) {
      this.cloudInit = Promise.resolve(cloud.init({ env: config.env, traceUser: false })).catch(e => { this.cloudInit = null; throw e; });
    }
    await this.cloudInit;
    if (generation !== this.generation || this.manual) return;
    const result = await cloud.connectContainer({ config: { env: config.env }, service: config.service, path: config.path || '/ws' });
    this.attach(result?.socketTask, generation);
  }
  attach(socket, generation) {
    // SDK authentication is async. A cancelled/timed-out attempt may resolve
    // after another room has opened; close that socket without sending a request.
    if (generation !== this.generation || this.manual) {
      try { socket?.close({ code: 1000 }); } catch (_) {} return;
    }
    if (!socket || typeof socket.onOpen !== 'function') throw new Error('无法创建比赛连接，请重试');
    this.socket = socket; this.opening = false;
    const current = () => generation === this.generation && socket === this.socket && !this.manual;
    socket.onOpen(() => {
      if (!current()) return;
      this.status = 'connected'; this.lastReceived = this.P.now();
      const request = this.token ? { t: 'resume', room: this.code, token: this.token } : this.queueToken ? { t: 'queue_resume', ticket: this.queueToken } : this.request;
      this.send({ ...request, ...(['queue_join', 'queue_resume'].includes(request.t) ? { active: this.active && !this.P.hidden() } : {}), roomProtocol: 2 });
      this.ping();
    });
    socket.onMessage(event => {
      if (!current()) return;
      let d; try { d = JSON.parse(event.data); } catch (_) { return; }
      this.lastReceived = this.P.now();
      if (d.t === 'welcome') {
        this.queueToken = null; this.queueState = null; this.roomKind = d.kind || 'friend';
        this.code = d.room; this.player = d.player; this.token = d.token; this.matchId = d.matchId;
        this.seq = d.seq; this.action = d.action; this.retrySince = null;
        this.features = Array.isArray(d.features) ? d.features : [];
        this.awaitingWelcome = false;
        this.resolve?.(d.room); this.resolve = this.reject = null;
      } else if (d.t === 'queue') {
        this.code = this.token = this.matchId = null; this.seq = this.action = 0;
        this.queueToken = d.ticket; this.queueState = d; this.queueReceivedAt = this.P.now(); this.roomKind = 'matchmaking';
        this.features = Array.isArray(d.features) ? d.features : []; this.awaitingWelcome = false; this.retrySince = null;
        this.resolve?.(null); this.resolve = this.reject = null; this.onMessage?.(d);
      } else if (d.t === 'queue_left') this.fail('已取消匹配');
      else if (d.t === 'start') { this.matchId = d.matchId; this.onStart?.(d); }
      else if (d.t === 'pong') {
        const rtt = (this.P.now() - d.ts) / 1000;
        if (Number.isFinite(rtt) && rtt >= 0 && rtt < 10) { this.rtt = .6 * this.rtt + .4 * rtt; this.clockOffset = d.nt - (this.P.now() / 1000 - rtt / 2); }
      } else if (d.t === 'error' || d.t === 'ended') this.fail(d.message || '连接已结束');
      else this.onMessage?.(d);
    });
    socket.onError(() => { if (current()) this.disconnected('网络连接失败'); });
    socket.onClose(() => { if (current()) this.disconnected(); });
  }
  send(data) {
    if (this.status !== 'connected' || !this.socket) return false;
    if (data.t === 'in') {
      const last = this.queue[this.queue.length - 1];
      if (last?.t === 'in' && last.matchId === data.matchId) {
        const presses = [...last.presses, ...data.presses];
        if (presses.length <= 8) this.queue[this.queue.length - 1] = { ...data, presses };
        else this.queue.push(data);
      } else this.queue.push(data);
    } else this.queue.push(data);
    if (this.queue.length > 64) { this.disconnected('网络拥堵，正在重连'); return false; }
    this.flush(); return true;
  }
  flush() {
    if (this.inFlight || !this.queue.length || this.status !== 'connected') return;
    const socket = this.socket, generation = this.generation;
    this.inFlight = true;
    socket.send({ data: JSON.stringify(this.queue.shift()), success: () => {
      if (generation !== this.generation || socket !== this.socket) return;
      this.inFlight = false; this.flush();
    }, fail: () => { if (generation === this.generation && socket === this.socket) this.disconnected('发送失败'); } });
  }
  ping() { this.lastPing = this.P.now(); this.send({ t: 'ping', ts: this.lastPing, active: this.active && !this.P.hidden() }); }
  reconnectRemaining() { return this.retrySince == null ? null : Math.max(0, Math.ceil((20000 - (this.P.now() - this.retrySince)) / 1000)); }
  connectionText() {
    const remaining = this.reconnectRemaining();
    if (remaining != null) return `正在重连 · 剩余 ${remaining} 秒`;
    if (this.status !== 'connected' || this.awaitingWelcome) return this.status === 'closed' ? '未连接' : '正在连接…';
    return `已连接 · 延迟 ${Math.round(this.rtt * 1000)} ms`;
  }
  serverTime() { return this.P.now() / 1000 + (this.clockOffset || 0); }
  disconnected(message) {
    if (this.manual || (!this.socket && !this.opening)) return;
    const socket = this.socket; this.socket = null; this.opening = false; this.generation++; this.inFlight = false; this.queue = [];
    try { socket?.close({ code: 1000 }); } catch (_) {}
    if (!this.token && !this.queueToken) return this.fail(message || '无法连接比赛服务器，请稍后重试');
    this.status = 'reconnecting'; this.retrySince = this.retrySince ?? this.P.now(); this.retryAt = this.P.now() + 750;
    this.onStatus?.('连接中断，正在重新连接…');
  }
  update() {
    if (this.manual || this.P.hidden()) return;
    const now = this.P.now();
    if (this.retrySince != null && now - this.retrySince >= 20000) return this.fail('重连超时，请重新进入在线对战');
    if (!this.socket && !this.opening && this.status === 'reconnecting' && now >= this.retryAt) return this.open();
    if (this.awaitingWelcome && (this.socket || this.opening) && now - this.openedAt > 8000) return this.disconnected('连接超时');
    if (this.status === 'connected') {
      if (now - this.lastReceived > 12000) return this.disconnected('服务器暂时没有响应');
      if (now - (this.lastPing || 0) >= 1000) this.ping();
    }
  }
  wake() { if (this.status === 'connected' && this.P.now() - this.lastReceived > 3000) this.disconnected(); this.update(); }
  fail(message) {
    const reject = this.reject, notify = !reject && this.onEnd;
    this.reject = this.resolve = null;
    this.close(); if (reject) reject(new Error(message)); else notify?.(message);
  }
  close() {
    const socket = this.socket, reject = this.reject;
    this.manual = true; this.generation++; this.socket = null; this.opening = false;
    this.code = this.token = this.matchId = null; this.seq = this.action = 0;
    this.queueToken = this.queueState = this.roomKind = null;
    this.queue = []; this.inFlight = false; this.status = 'closed'; this.retrySince = null;
    this.clockOffset = null;
    this.features = []; this.awaitingWelcome = false;
    this.resolve = this.reject = null;
    if (socket) {
      // A leave frame is best effort; closed sockets still enter server timeout cleanup.
      try { socket.send({ data: JSON.stringify({ t: 'leave' }), success: () => socket.close({ code: 1000 }), fail: () => socket.close({ code: 1000 }) }); } catch (_) { try { socket.close({ code: 1000 }); } catch (_) {} }
    }
    reject?.(new Error('连接已取消'));
  }
}
if (typeof module !== 'undefined' && module.exports) module.exports = Network;
else globalThis.YY.SocketNetwork = Network;
