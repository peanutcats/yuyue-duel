/* 羽跃对决 · 在线对战（WebRTC / PeerJS）
 * 房主权威：房主运行完整模拟，好友只上传输入、接收状态快照并插值渲染。
 * 如需自建信令服务器，修改 YY.NET_CONFIG.peer（参见 PeerJS 文档）。
 */
(function (G) {
  'use strict';
  const YY = G.YY;
  YY.NET_CONFIG = {
    prefix: 'yuyue-duel-',
    cdn: [
      'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js',
      'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
    ],
    // 自建信令示例：{ host: 'your.server', port: 9000, path: '/peer', secure: true }
    peer: { debug: 1 },
    // STUN：探测公网地址，用于直连
    stun: [
      { urls: ['stun:stun.miwifi.com:3478', 'stun:stun.chat.bilibili.com:3478'] },
      { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] },
    ],
    // TURN：直连失败时中转。由本站 /api/turn（Vercel 函数 + Cloudflare）下发临时凭证
    turnEndpoint: 'api/turn',
    // 开发调试：URL 加 ?loopback=1 时，用 BroadcastChannel 在同一浏览器的两个标签页之间联机
    loopback: /[?&]loopback=1/.test(location.search),
  };

  /** 同浏览器多标签页的回环连接（仅用于调试联机逻辑） */
  function loopConn(code, role, onReady) {
    const bc = new BroadcastChannel('yuyue-loop-' + code);
    const h = {};
    const conn = {
      open: false,
      on(ev, f) { h[ev] = f; },
      send(d) { bc.postMessage({ from: role, d }); },
      close() { if (!conn.open) return; conn.open = false; bc.postMessage({ from: role, bye: 1 }); bc.close(); if (h.close) h.close(); },
    };
    bc.onmessage = (e) => {
      const m = e.data;
      if (m.from === role) return;
      if (m.hello) {
        if (!conn.open) { conn.open = true; if (role === 'host') bc.postMessage({ from: role, hello: 1 }); onReady(conn); if (h.open) h.open(); }
        return;
      }
      if (m.bye) { conn.open = false; bc.close(); if (h.close) h.close(); return; }
      if (h.data) h.data(m.d);
    };
    if (role === 'guest') bc.postMessage({ from: role, hello: 1 });
    return conn;
  }
  const CODE_CH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const genCode = () => Array.from({ length: 4 }, () => CODE_CH[Math.floor(Math.random() * CODE_CH.length)]).join('');

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = res; s.onerror = () => { s.remove(); rej(new Error('load ' + src)); };
      document.head.appendChild(s);
    });
  }

  const Net = (YY.Net = {
    peer: null, conn: null, role: null, code: null, rtt: 0.1,
    onMsg: null, onOpen: null, onClose: null, onStatus: null,
    ice: null, iceExp: 0, turn: 'unknown', route: null,
    /** 获取 ICE 服务器：优先向本站申请 TURN 临时凭证，失败则只用 STUN */
    async getIce() {
      if (this.ice && performance.now() < this.iceExp) return this.ice;
      let turn = [], ttl = 0;
      if (/^https?:$/.test(location.protocol)) {
        const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const tm = setTimeout(() => ctl && ctl.abort(), 5000);
        try {
          const r = await fetch(new URL(YY.NET_CONFIG.turnEndpoint, location.href), { cache: 'no-store', signal: ctl ? ctl.signal : undefined });
          if (r.ok) {
            const d = await r.json();
            if (Array.isArray(d.iceServers)) { turn = d.iceServers; ttl = d.ttl || 3600; }
          }
        } catch (_) { /* 本地打开或未配置：仅直连 */ }
        clearTimeout(tm);
      }
      this.turn = turn.length ? 'ok' : 'none';
      this.ice = turn.concat(YY.NET_CONFIG.stun);
      this.iceExp = performance.now() + (turn.length ? Math.max(60, ttl - 600) : 30) * 1000;
      return this.ice;
    },
    peerOpts() {
      return Object.assign({}, YY.NET_CONFIG.peer, { config: { iceServers: this.ice || YY.NET_CONFIG.stun, sdpSemantics: 'unified-plan' } });
    },
    /** 连接建立后查询实际线路：'direct' 直连 / 'relay' 经 TURN 中转 */
    async detectRoute() {
      const pc = this.conn && this.conn.peerConnection;
      if (!pc || !pc.getStats) return null;
      try {
        const stats = await pc.getStats();
        let pair = null;
        stats.forEach((r) => { if (r.type === 'transport' && r.selectedCandidatePairId) pair = stats.get(r.selectedCandidatePairId); });
        if (!pair) stats.forEach((r) => { if (r.type === 'candidate-pair' && r.state === 'succeeded' && (r.nominated || r.selected)) pair = r; });
        if (!pair) return null;
        const loc = stats.get(pair.localCandidateId), rem = stats.get(pair.remoteCandidateId);
        const relay = (loc && loc.candidateType === 'relay') || (rem && rem.candidateType === 'relay');
        this.route = relay ? 'relay' : 'direct';
        return this.route;
      } catch (_) { return null; }
    },
    async load() {
      if (G.Peer) return;
      for (const u of YY.NET_CONFIG.cdn) {
        try { await loadScript(u); if (G.Peer) return; } catch (_) { /* 试下一个 */ }
      }
      throw new Error('无法加载联机组件（PeerJS），请检查网络');
    },
    status(t) { if (this.onStatus) this.onStatus(t); },
    async host() {
      this.role = 'host';
      if (YY.NET_CONFIG.loopback) {
        this.code = genCode();
        loopConn(this.code, 'host', (c) => { this.conn = c; this.bindLoop(c); if (this.onOpen) this.onOpen(); });
        return this.code;
      }
      await this.load();
      this.status('正在获取中转服务器…');
      await this.getIce();
      this.status('正在连接联机服务器…');
      return new Promise((resolve, reject) => {
        const tryOpen = (n) => {
          const code = genCode();
          const peer = new G.Peer(YY.NET_CONFIG.prefix + code, this.peerOpts());
          this.peer = peer;
          peer.on('open', () => { this.code = code; resolve(code); });
          peer.on('error', (err) => {
            if (err.type === 'unavailable-id' && n < 4) { peer.destroy(); tryOpen(n + 1); }
            else if (!this.code) reject(new Error(errText(err)));
            else this.status('连接错误：' + errText(err));
          });
          peer.on('connection', (conn) => {
            if (this.conn && this.conn.open) { conn.on('open', () => { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 300); }); return; }
            this.bind(conn);
          });
          peer.on('disconnected', () => { if (!this.conn) try { peer.reconnect(); } catch (_) {} });
        };
        tryOpen(0);
      });
    },
    async join(code) {
      this.role = 'guest';
      code = code.toUpperCase().trim();
      if (YY.NET_CONFIG.loopback) {
        return new Promise((resolve, reject) => {
          loopConn(code, 'guest', (c) => { this.conn = c; this.bindLoop(c); resolve(); });
          setTimeout(() => { if (!this.conn) reject(new Error('回环模式：找不到房间')); }, 3000);
        });
      }
      await this.load();
      this.status('正在获取中转服务器…');
      await this.getIce();
      this.status('正在连接联机服务器…');
      return new Promise((resolve, reject) => {
        const peer = new G.Peer(undefined, this.peerOpts());
        this.peer = peer;
        let done = false;
        peer.on('open', () => {
          const conn = peer.connect(YY.NET_CONFIG.prefix + code, { reliable: true, serialization: 'json' });
          this.bind(conn, () => { done = true; resolve(); });
          this.status(this.turn === 'ok' ? '已找到房间，正在建立连接（直连失败会自动走中转）…' : '已找到房间，正在与房主建立直连…');
          const fail = (msg) => { if (!done) { done = true; reject(new Error(msg)); } };
          const NAT = YY.netFailText(this.turn);
          // 监听 ICE 失败，给出明确原因
          const watchIce = setInterval(() => {
            const pc = conn.peerConnection;
            if (done) { clearInterval(watchIce); return; }
            if (pc && pc.iceConnectionState === 'failed') { clearInterval(watchIce); fail(NAT); }
          }, 300);
          setTimeout(() => {
            clearInterval(watchIce);
            const pc = conn.peerConnection;
            fail(pc && pc.remoteDescription ? NAT : '连接超时：房主没有响应，请确认房间码或让房主重新创建房间');
          }, 15000);
        });
        peer.on('error', (err) => { if (!done) reject(new Error(errText(err))); else this.status('连接错误：' + errText(err)); });
      });
    },
    bind(conn, cb) {
      this.conn = conn;
      conn.on('open', () => { this.lastRecv = performance.now(); if (cb) cb(); if (this.onOpen) this.onOpen(); });
      this.bindLoop(conn);
      conn.on('error', () => {});
      // ICE 断开（对方掉线、切网络）时，DataChannel 的 close 可能迟迟不触发，由 App 的心跳超时兜底
    },
    bindLoop(conn) {
      this.lastRecv = performance.now();
      conn.on('data', (d) => {
        this.lastRecv = performance.now();
        if (d && d.t === 'ping') { conn.send({ t: 'pong', ts: d.ts }); return; }
        if (d && d.t === 'pong') { this.rtt = this.rtt * 0.7 + ((performance.now() - d.ts) / 1000) * 0.3; return; }
        if (d && d.t === 'ka') return; // 心跳
        if (this.onMsg) this.onMsg(d);
      });
      conn.on('close', () => { const c = this.conn; this.conn = null; if (c && this.onClose) this.onClose(); });
    },
    /** 距离上次收到对方任何消息的秒数 */
    idle() { return this.conn ? (performance.now() - (this.lastRecv || 0)) / 1000 : 0; },
    ping() { this.send({ t: 'ping', ts: performance.now() }); },
    send(o) { if (this.conn && this.conn.open) try { this.conn.send(o); } catch (_) {} },
    close() {
      const c = this.conn; this.conn = null;
      try { if (c) c.close(); } catch (_) {}
      try { if (this.peer) this.peer.destroy(); } catch (_) {}
      this.peer = null; this.role = null; this.code = null;
    },
  });

  /** 是否在微信 / QQ 等应用内置浏览器中打开 */
  YY.inAppBrowser = function () {
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    if (/MicroMessenger/i.test(ua)) return '微信';
    if (/\bQQ\//i.test(ua)) return 'QQ';
    if (/DingTalk/i.test(ua)) return '钉钉';
    return null;
  };
  YY.inAppHint = function () {
    const app = YY.inAppBrowser();
    return app ? `检测到在${app}内打开，若连接失败，请点右上角「…」选择「在浏览器打开」。` : '';
  };
  /** 找到房间但连接建立失败时的说明 */
  YY.netFailText = function (turn) {
    const base = turn === 'ok'
      ? '找到了房间，但连接没有建立：直连和中转服务器都没有连通。请确认网络正常后重试，或两人连接同一个 Wi-Fi。'
      : '找到了房间，但双方网络无法直连，且当前没有可用的中转服务器（TURN）。可让两人连接同一个 Wi-Fi，或由部署者按 README 配置 Cloudflare TURN。';
    const hint = YY.inAppHint();
    return hint ? base + '\n' + hint : base;
  };

  function errText(err) {
    const m = {
      'peer-unavailable': '房间不存在或房主已离开', 'network': '网络连接失败', 'server-error': '信令服务器不可用',
      'browser-incompatible': '浏览器不支持 WebRTC', 'unavailable-id': '房间码冲突', 'socket-error': '信令服务器连接失败',
    };
    return m[err.type] || err.message || String(err);
  }

  // ---------- 快照 ----------
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const KIND = ['over', 'side', 'under'];
  YY.snapshot = function (m, events) {
    return {
      t: 'st', ht: r3(m.time), ph: m.phase, sc: m.score.slice(), sv: m.server, st: r3(m.serveT), sg: m.serving ? 1 : 0,
      ry: m.rally, w: m.winner, names: m.names, hc: m.hitCount,
      p: m.players.map((p) => [
        r3(p.x), r3(p.y), r3(p.vx), r3(p.vy), p.onGround ? 1 : 0, Math.round(p.stamina),
        p.swing ? [r3(p.swing.t), KIND.indexOf(p.swing.kind), p.swing.dur, p.swing.serve ? 1 : 0,
          p.swing.contact ? [r3(p.swing.contact.x), r3(p.swing.contact.y), r3(p.swing.contact.t)] : null] : 0,
        r3(p.runPhase), r3(p.flash), r3(p.land),
      ]),
      s: [r3(m.shuttle.x), r3(m.shuttle.y), r3(m.shuttle.vx), r3(m.shuttle.vy), m.shuttle.live ? 1 : 0, m.shuttle.held ? 1 : 0, r3(m.shuttle.speed || 0), m.shuttle.lastHitter, m.shuttle.netHit ? 1 : 0, m.shuttle.crossedNet ? 1 : 0],
      lm: m.landMark ? [r3(m.landMark.x), m.landMark.inB ? 1 : 0, r3(m.landMark.t)] : 0,
      pl: m.pred && m.shuttle.live ? r3(m.pred.landX) : null,
      ev: events,
      rtt: r3(Net.rtt),
    };
  };
  YY.applyStats = (m, st) => { if (st) m.stats = st; };

  /** 好友端的可渲染比赛视图（接口与 Match 一致） */
  class GuestView {
    constructor() {
      this.players = [0, 1].map((i) => ({ idx: i, side: i ? 1 : -1, dir: i ? -1 : 1, x: i ? 2.8 : -2.3, y: 0, vx: 0, vy: 0, onGround: true, stamina: 100, swing: null, runPhase: 0, flash: 0, land: 0 }));
      this.shuttle = { x: -1.9, y: 0.95, vx: 0, vy: 0, live: false, held: true, netHit: false, crossedNet: false, speed: 0, lastHitter: -1 };
      this.score = [0, 0]; this.server = 0; this.phase = 'serve'; this.serveT = 0; this.serving = null; this.rally = 0;
      this.opt = { target: 7, cap: 11 }; this.names = ['房主', '你']; this.practice = false; this.time = 0;
      this.landMark = null; this.pred = null; this.hint = null; this.winner = -1;
      this.buf = []; this.clockOff = null; this.stats = null; this.longest = 0;
      this.pendingEvents = []; this.events = [];
    }
    serveMeter() { const u = this.serveT * 1.15; return 1 - Math.abs((u % 2) - 1); }
    push(sn) {
      const now = performance.now() / 1000;
      const off = sn.ht - now;
      if (this.clockOff === null || off > this.clockOff || Math.abs(off - this.clockOff) > 1) this.clockOff = off;
      else this.clockOff += (off - this.clockOff) * 0.02;
      if (this.buf.length && sn.ht < this.buf[this.buf.length - 1].ht) {
        this.buf = []; this.pendingEvents = []; this.events = [];
      }
      this.buf.push(sn);
      if (sn.ev && sn.ev.length) this.pendingEvents.push({ t: sn.ht, events: sn.ev });
      if (this.buf.length > 30) this.buf.shift();
    }
    update(now = performance.now() / 1000) {
      if (!this.buf.length) return;
      const rt = now + this.clockOff - 0.05;
      let a = this.buf[0], b = a;
      for (let i = 0; i < this.buf.length; i++) {
        if (this.buf[i].ht <= rt) a = this.buf[i];
        if (this.buf[i].ht >= rt) { b = this.buf[i]; break; }
        b = this.buf[i];
      }
      const u = b.ht > a.ht ? YY.clamp((rt - a.ht) / (b.ht - a.ht), 0, 1) : 1;
      const L = (x, y) => x + (y - x) * u;
      // 离散状态取当前时刻已发生的快照，不能提前套用下一帧的击球/撞网结果。
      const cur = u < 1 ? a : b;
      const reset = a.ph !== b.ph && b.ph === 'serve';
      this.time = L(a.ht, b.ht);
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
      while (this.pendingEvents.length && this.pendingEvents[0].t <= this.time) {
        this.events.push(...this.pendingEvents.shift().events);
      }
    }
  }
  YY.GuestView = GuestView;
})(window);
