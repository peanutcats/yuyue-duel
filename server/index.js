'use strict';
const http = require('node:http');
const { isIP } = require('node:net');
const { WebSocketServer } = require('ws');
const { Rooms, YY, ROOM_PROTOCOL } = require('./rooms');

function createServer(options = {}) {
  const rooms = new Rooms({ maxRooms: options.maxRooms || Number(process.env.MAX_ROOMS) || 20 });
  const origins = (options.origins || process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
  const trustProxy = options.trustProxy ?? process.env.TRUST_PROXY === '1';
  const server = http.createServer((req, res) => {
    let pathname;
    try { pathname = new URL(req.url, 'http://localhost').pathname; }
    catch (_) { res.writeHead(400); return res.end(); }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (pathname === '/healthz') {
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ ok: true, mode: 'authoritative', rooms: rooms.rooms.size, physicsHz: 120, snapshotHz: 30, physicsVersion: YY.PHYSICS_VERSION, roomProtocol: ROOM_PROTOCOL }));
    }
    // Match service only: do not expose the repository or the browser build.
    res.writeHead(404); res.end('Not found');
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096, perMessageDeflate: false });
  const perIP = new Map();
  server.on('upgrade', (req, socket, head) => {
    const reject = code => { socket.end(`HTTP/1.1 ${code}\r\nConnection: close\r\n\r\n`); };
    if (req.url !== '/ws') return reject('404 Not Found');
    let originOK = !req.headers.origin;
    try {
      const origin = new URL(req.headers.origin);
      originOK = origins.length ? origins.includes(origin.origin) : origin.host === req.headers.host;
    } catch (_) {}
    if (!originOK) return reject('403 Forbidden');
    // Enabled only behind our private Caddy service, which replaces this header.
    const forwarded = req.headers['x-real-ip'];
    const ip = trustProxy && typeof forwarded === 'string' && isIP(forwarded) ? forwarded : socket.remoteAddress;
    if (wss.clients.size >= 100 || (perIP.get(ip) || 0) >= 30) return reject('503 Service Unavailable');
    wss.handleUpgrade(req, socket, head, ws => {
      perIP.set(ip, (perIP.get(ip) || 0) + 1);
      ws.on('close', () => { const n = (perIP.get(ip) || 1) - 1; if (n) perIP.set(ip, n); else perIP.delete(ip); });
      wss.emit('connection', ws, req);
    });
  });
  wss.on('connection', ws => {
    ws.alive = true; ws.tokens = 240; ws.budgetAt = performance.now();
    const unauth = setTimeout(() => { if (!ws.slot) ws.close(1008, 'join timeout'); }, 10000);
    ws.on('pong', () => { ws.alive = true; });
    ws.on('error', () => {});
    ws.on('message', (data, binary) => {
      const t = performance.now(); ws.tokens = Math.min(240, ws.tokens + (t - ws.budgetAt) * 0.12); ws.budgetAt = t;
      if (--ws.tokens < 0 || binary) return ws.close(1008, 'invalid traffic');
      try { rooms.message(ws, JSON.parse(data.toString())); } catch (_) { ws.close(1008, 'invalid message'); }
    });
    ws.on('close', () => { clearTimeout(unauth); rooms.disconnected(ws); });
  });
  let previous = performance.now(), acc = 0, sendAcc = 0, overruns = 0;
  const loop = setInterval(() => {
    const t = performance.now(), elapsed = Math.max(0, (t - previous) / 1000); previous = t;
    if (elapsed > 0.25) overruns++;
    acc += Math.min(0.25, elapsed); sendAcc += elapsed;
    let n = 0;
    while (acc >= YY.C.DT && n++ < 30) { rooms.step(); acc -= YY.C.DT; }
    if (sendAcc >= 1 / 30) { sendAcc %= 1 / 30; rooms.broadcastAll(); }
  }, 4);
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) { if (!ws.alive) ws.terminate(); else { ws.alive = false; ws.ping(); } }
    if (overruns) { console.warn('simulation scheduler delayed', { overruns, rooms: rooms.rooms.size }); overruns = 0; }
  }, 10000);
  function close() {
    clearInterval(loop); clearInterval(heartbeat);
    for (const ws of wss.clients) ws.terminate();
    return new Promise(resolve => { wss.close(() => server.close(resolve)); });
  }
  return { server, rooms, wss, close };
}
if (require.main === module) {
  const app = createServer();
  const port = Number(process.env.PORT) || 8080, host = process.env.HOST || '127.0.0.1';
  app.server.listen(port, host, () => console.log(`Badminton authoritative server listening on ${host}:${port}`));
  for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => app.close().then(() => process.exit(0)));
}
module.exports = { createServer };
