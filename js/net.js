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
    // 自建信令示例：{ host: 'your.server', port: 9000, path: '/peer', secure: true, config: {...} }
    peer: {
      debug: 1,
      config: {
        iceServers: [
          { urls: ['stun:stun.miwifi.com:3478', 'stun:stun.chat.bilibili.com:3478'] },
          { urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
          { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' },
        ],
        sdpSemantics: 'unified-plan',
      },
    },
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
      return new Promise((resolve, reject) => {
        const tryOpen = (n) => {
          const code = genCode();
          const peer = new G.Peer(YY.NET_CONFIG.prefix + code, YY.NET_CONFIG.peer);
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
      return new Promise((resolve, reject) => {
        const peer = new G.Peer(undefined, YY.NET_CONFIG.peer);
        this.peer = peer;
        let done = false;
        peer.on('open', () => {
          const conn = peer.connect(YY.NET_CONFIG.prefix + code, { reliable: true, serialization: 'json' });
          this.bind(conn, () => { done = true; resolve(); });
          this.status('已找到联机服务器，正在与房主建立直连…');
          const fail = (msg) => { if (!done) { done = true; reject(new Error(msg)); } };
          const NAT = '找到了房间，但无法与房主建立点对点连接（双方网络 NAT 限制）。可尝试换用手机热点或同一 Wi-Fi，或按 README 配置 TURN 服务器';
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
      ry: m.rally, w: m.winner, names: m.names,
      p: m.players.map((p) => [r3(p.x), r3(p.y), r3(p.vx), r3(p.vy), p.onGround ? 1 : 0, Math.round(p.stamina), p.swing ? [r3(p.swing.t), KIND.indexOf(p.swing.kind), p.swing.dur] : 0, r3(p.runPhase), r3(p.flash), r3(p.land)]),
      s: [r3(m.shuttle.x), r3(m.shuttle.y), r3(m.shuttle.vx), r3(m.shuttle.vy), m.shuttle.live ? 1 : 0, m.shuttle.held ? 1 : 0, r3(m.shuttle.speed || 0), m.shuttle.lastHitter],
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
      this.shuttle = { x: -1.9, y: 0.95, vx: 0, vy: 0, live: false, held: true, speed: 0, lastHitter: -1 };
      this.score = [0, 0]; this.server = 0; this.phase = 'serve'; this.serveT = 0; this.serving = null; this.rally = 0;
      this.opt = { target: 7, cap: 11 }; this.names = ['房主', '你']; this.practice = false; this.time = 0;
      this.landMark = null; this.pred = null; this.hint = null; this.winner = -1;
      this.buf = []; this.clockOff = null; this.stats = null; this.longest = 0;
    }
    serveMeter() { const u = this.serveT * 1.15; return 1 - Math.abs((u % 2) - 1); }
    push(sn) {
      const now = performance.now() / 1000;
      const off = sn.ht - now;
      if (this.clockOff === null || off > this.clockOff || Math.abs(off - this.clockOff) > 1) this.clockOff = off;
      else this.clockOff += (off - this.clockOff) * 0.02;
      if (this.buf.length && sn.ht < this.buf[this.buf.length - 1].ht) this.buf = [];
      this.buf.push(sn);
      if (this.buf.length > 30) this.buf.shift();
    }
    update() {
      if (!this.buf.length) return;
      const rt = performance.now() / 1000 + this.clockOff - 0.05;
      let a = this.buf[0], b = a;
      for (let i = 0; i < this.buf.length; i++) {
        if (this.buf[i].ht <= rt) a = this.buf[i];
        if (this.buf[i].ht >= rt) { b = this.buf[i]; break; }
        b = this.buf[i];
      }
      const u = b.ht > a.ht ? YY.clamp((rt - a.ht) / (b.ht - a.ht), 0, 1) : 1;
      const L = (x, y) => x + (y - x) * u;
      this.time = L(a.ht, b.ht);
      this.phase = b.ph; this.score = b.sc; this.server = b.sv; this.serveT = L(a.st, b.st); this.serving = b.sg ? {} : null;
      this.rally = b.ry; this.winner = b.w;
      if (b.names) this.names = [b.names[0] === '你' ? '房主' : b.names[0], '你'];
      for (let i = 0; i < 2; i++) {
        const p = this.players[i], pa = a.p[i], pb = b.p[i];
        p.x = L(pa[0], pb[0]); p.y = L(pa[1], pb[1]); p.vx = pb[2]; p.vy = pb[3]; p.onGround = !!pb[4];
        p.stamina = pb[5];
        const sw = pb[6] || pa[6];
        p.swing = sw ? { t: pa[6] && pb[6] ? L(pa[6][0], pb[6][0]) : sw[0], kind: KIND[sw[1]] || 'over', dur: sw[2] } : null;
        p.runPhase = L(pa[7], pb[7]); p.flash = pb[8]; p.land = pb[9];
      }
      const s = this.shuttle, sa = a.s, sb = b.s;
      const jump = Math.abs(sa[0] - sb[0]) > 3; // 重置时不插值
      s.x = jump ? sb[0] : L(sa[0], sb[0]); s.y = jump ? sb[1] : L(sa[1], sb[1]);
      s.vx = sb[2]; s.vy = sb[3]; s.live = !!sb[4]; s.held = !!sb[5]; s.speed = sb[6]; s.lastHitter = sb[7];
      this.landMark = b.lm ? { x: b.lm[0], inB: !!b.lm[1], t: b.lm[2] } : null;
      this.pred = b.pl != null ? { landX: b.pl } : null;
    }
  }
  YY.GuestView = GuestView;
})(window);
