'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const Network = require('../minigame/src/network');
const { createServer } = require('../server/index');
const { WebSocket } = require('ws');
const { once } = require('node:events');

function fakeNetwork() {
  let now = 100; const sockets = [];
  const platform = { now: () => now, hidden: () => false, wx: { connectSocket() {
    const handlers = {}, sent = [], pending = [];
    const socket = { handlers, sent, pending, onOpen: fn => handlers.open = fn, onMessage: fn => handlers.message = fn, onClose: fn => handlers.close = fn, onError: fn => handlers.error = fn,
      send(packet) { sent.push(JSON.parse(packet.data)); pending.push(packet); }, close() {}, receive(data) { handlers.message({ data: JSON.stringify(data) }); }, complete() { pending.shift()?.success?.(); } };
    sockets.push(socket); return socket;
  } } };
  const net = new Network(platform, { serverUrl: 'wss://game.example/ws' });
  return { net, sockets, advance(ms) { now += ms; net.update(); } };
}

test('SocketTask queue preserves all actions while coalescing stale movement and ignores callbacks from an old connection', async () => {
  const h = fakeNetwork(), promise = h.net.connect({ t: 'create' }); const s = h.sockets[0]; s.handlers.open();
  s.receive({ t: 'welcome', room: 'ABCD', token: 'secret', seq: 0, action: 0, player: 0 }); await promise;
  s.complete(); s.complete(); // request + ping
  h.net.send({ t: 'in', matchId: 'm', seq: 1, move: 1, presses: [{ id: 1, btn: 'jump' }] });
  h.net.send({ t: 'in', matchId: 'm', seq: 2, move: -1, presses: [{ id: 2, btn: 'clear' }] });
  h.net.send({ t: 'in', matchId: 'm', seq: 3, move: 0, presses: [{ id: 3, btn: 'smash' }] });
  s.complete();
  assert.equal(s.sent.at(-1).seq, 3); assert.deepEqual(s.sent.at(-1).presses.map(p => p.id), [2, 3]);
  h.net.disconnected(); h.advance(800); const fresh = h.sockets[1]; assert.ok(fresh);
  s.complete(); assert.equal(h.net.socket, fresh); assert.equal(h.net.inFlight, false);
  h.net.close();
});

test('connection failures retain their useful reason and cancelled attempts cannot revive a room', async () => {
  const h = fakeNetwork(); const pending = h.net.connect({ t: 'join', room: 'AAAA' }); const rejected = assert.rejects(pending, /房间不存在/);
  h.sockets[0].handlers.open(); h.sockets[0].receive({ t: 'error', message: '房间不存在' }); await rejected;
  const p = h.net.connect({ t: 'create' }); const cancelled = assert.rejects(p, /连接已取消/); const old = h.sockets[1]; h.net.close(); await cancelled;
  old.handlers.open(); old.receive({ t: 'welcome', room: 'BBBB', token: 'old', player: 0 }); assert.equal(h.net.code, null);
});

test('reconnect uses a seat token, times out, and never sends duplicate original create requests', async () => {
  const h = fakeNetwork(), p = h.net.connect({ t: 'create' }), s = h.sockets[0]; s.handlers.open();
  s.receive({ t: 'welcome', room: 'ABCD', token: 'seat', seq: 4, action: 2, player: 0 }); await p;
  h.net.disconnected(); h.advance(800); h.sockets[1].handlers.open();
  assert.equal(h.sockets[1].sent[0].t, 'resume'); assert.equal(h.sockets[1].sent[0].token, 'seat');
  h.net.disconnected(); let reason; h.net.onEnd = text => reason = text; h.advance(21000);
  assert.match(reason, /重连超时/); assert.equal(h.net.status, 'closed');
});

const drain = () => new Promise(resolve => setImmediate(resolve));
function cloudNetwork(init) {
  const h = fakeNetwork(), makeSocket = h.net.P.wx.connectSocket;
  h.calls = []; h.inits = []; h.fallbacks = 0;
  h.net.config = { networkTransport: 'cloud', cloud: { env: 'test-env', service: 'test-service', path: '/ws' }, serverUrl: 'wss://unused.example/ws' };
  h.net.P.wx.connectSocket = () => { h.fallbacks++; throw new Error('Unexpected public WSS fallback'); };
  h.net.P.wx.cloud = {
    init(options) { h.inits.push(options); return init?.(); },
    connectContainer(options) { return new Promise((resolve, reject) => h.calls.push({ options, resolve, reject })); },
  };
  h.socket = async i => {
    const s = makeSocket(); s.closed = 0; s.close = () => { s.closed++; };
    h.calls[i].resolve({ socketTask: s }); await drain(); return s;
  };
  return h;
}

test('cloud transport initializes the supplied environment, opens /ws through SDK, and never falls back to public WSS', async () => {
  const h = cloudNetwork(); assert.equal(h.net.configured(), true);
  const ready = h.net.connect({ t: 'create' }); await drain();
  assert.deepEqual(h.inits, [{ env: 'test-env', traceUser: false }]);
  assert.deepEqual(h.calls[0].options, { config: { env: 'test-env' }, service: 'test-service', path: '/ws' });
  const s = await h.socket(0); assert.equal(s.sent.length, 0);
  s.handlers.open(); s.receive({ t: 'welcome', room: 'ABCD', token: 'seat', seq: 0, action: 0, player: 0 });
  assert.equal(await ready, 'ABCD'); assert.equal(s.sent[0].t, 'create');
  assert.equal(h.fallbacks, 0); h.net.close();
});

test('cloud cancel closes a late socket without creating a room or affecting a newer connection', async () => {
  const h = cloudNetwork();
  const first = h.net.connect({ t: 'create' }), cancelled = assert.rejects(first, /取消/); await drain();
  h.net.close(); await cancelled;
  const second = h.net.connect({ t: 'join', room: 'BBBB' }); await drain();
  const stale = await h.socket(0); assert.equal(stale.closed, 1); assert.equal(stale.sent.length, 0);
  const fresh = await h.socket(1); fresh.handlers.open();
  fresh.receive({ t: 'welcome', room: 'BBBB', token: 'new-seat', seq: 0, action: 0, player: 1 });
  assert.equal(await second, 'BBBB'); assert.equal(h.net.socket, fresh); assert.equal(h.inits.length, 1);
  assert.equal(h.fallbacks, 0); h.net.close();
});

test('cloud authentication timeout stops late initialization and closes late SDK sockets', async () => {
  let finishInit;
  const h = cloudNetwork(() => new Promise(resolve => { finishInit = resolve; }));
  const first = h.net.connect({ t: 'create' }), timedOut = assert.rejects(first, /超时/);
  h.advance(8001); await timedOut; finishInit(); await drain();
  assert.equal(h.calls.length, 0, 'cancelled init must not start an SDK connection');
  const second = h.net.connect({ t: 'create' }), secondTimeout = assert.rejects(second, /超时/); await drain();
  h.advance(8001); await secondTimeout;
  const stale = await h.socket(0); assert.equal(stale.closed, 1); assert.equal(stale.sent.length, 0);
  assert.equal(h.net.status, 'closed');
});

test('cloud SDK errors and unsupported runtimes fail clearly without an implicit domain-dependent fallback', async () => {
  let attempts = 0;
  const h = cloudNetwork(() => { if (!attempts++) return Promise.reject(new Error('环境初始化失败')); });
  await assert.rejects(h.net.connect({ t: 'create' }), /环境初始化失败/);
  const second = h.net.connect({ t: 'create' }), denied = assert.rejects(second, /服务访问失败/); await drain();
  h.calls[0].reject({ errMsg: '服务访问失败' }); await denied;
  assert.equal(h.inits.length, 2); assert.equal(h.fallbacks, 0);
  delete h.net.P.wx.cloud.connectContainer;
  await assert.rejects(h.net.connect({ t: 'create' }), /更新微信/);
  assert.equal(h.fallbacks, 0);
});

test('cloud reconnect opens just one async request and resumes the existing seat', async () => {
  const h = cloudNetwork(), ready = h.net.connect({ t: 'create' }); await drain();
  const first = await h.socket(0); first.handlers.open();
  first.receive({ t: 'welcome', room: 'ABCD', token: 'seat', seq: 4, action: 2, player: 0 }); await ready;
  h.net.disconnected(); h.advance(800); await drain();
  for (let i = 0; i < 10; i++) h.advance(100);
  assert.equal(h.calls.length, 2);
  const resumed = await h.socket(1); resumed.handlers.open();
  assert.deepEqual(resumed.sent[0], { t: 'resume', room: 'ABCD', token: 'seat', roomProtocol: 2 });
  assert.equal(h.inits.length, 1); h.net.close();
});

function liveClient(url, cloudMode = false) {
  function socketTask() {
    const s = new WebSocket(url);
    return { onOpen: fn => s.on('open', fn), onMessage: fn => s.on('message', data => fn({ data: data.toString() })), onClose: fn => s.on('close', fn), onError: fn => s.on('error', fn), send({ data, success, fail }) { s.send(data, err => err ? fail?.(err) : success?.()); }, close({ code = 1000 } = {}) { s.close(code); } };
  }
  const wx = cloudMode ? { cloud: { init() {}, async connectContainer() { return { socketTask: socketTask() }; } } } : { connectSocket: socketTask };
  return new Network({ now: () => performance.now(), hidden: () => false, wx }, cloudMode ?
    { networkTransport: 'cloud', cloud: { env: 'test-env', service: 'test-service', path: '/ws' } } : { serverUrl: url, allowLocalhost: true });
}
async function until(fn, ms = 4000) {
  const end = Date.now() + ms;
  while (!fn()) { if (Date.now() > end) throw Error('Timed out waiting for transport state'); await new Promise(r => setTimeout(r, 20)); }
}

for (const cloudMode of [false, true]) test(`${cloudMode ? 'async cloud SocketTask adapter' : 'native SocketTask'} integration: real server create/join, state parity, pause and token reconnect`, async t => {
  const server = createServer(); server.server.listen(0, '127.0.0.1'); await once(server.server, 'listening');
  const url = `ws://127.0.0.1:${server.server.address().port}/ws`, a = liveClient(url, cloudMode), b = liveClient(url, cloudMode);
  const seen = [[], []], lobbies = []; let starts = 0;
  for (const [i, n] of [a, b].entries()) { n.onStart = () => starts++; n.onMessage = data => { if (data.t === 'st') seen[i].push(data); if (data.t === 'room') lobbies[i] = data; }; }
  const timer = setInterval(() => { a.update(); b.update(); }, 20);
  t.after(async () => { clearInterval(timer); a.close(); b.close(); await server.close(); });
  const code = await a.connect({ t: 'create', venue: 'sunset' }); await b.connect({ t: 'join', room: code });
  await until(() => lobbies.every(r => r.players.length === 2) && lobbies.length === 2);
  assert.equal(starts, 0);
  a.send({ t: 'ready', ready: true, revision: lobbies[0].revision }); b.send({ t: 'ready', ready: true, revision: lobbies[1].revision });
  await until(() => starts === 2 && seen.every(s => s.length));
  assert.equal(a.code, b.code); assert.equal(a.player, 0); assert.equal(b.player, 1);
  assert.deepEqual(seen[0][0].s, seen[1][0].s);
  a.send({ t: 'away' }); await until(() => seen[1].at(-1).wait); assert.match(seen[1].at(-1).wait, /暂停/);
  a.send({ t: 'in', matchId: a.matchId, seq: ++a.seq, move: 0, presses: [] });
  b.send({ t: 'in', matchId: b.matchId, seq: ++b.seq, move: 0, presses: [] });
  await until(() => seen[1].at(-1).wait === null);
  const token = b.token; b.disconnected(); await until(() => starts === 3);
  assert.equal(b.token, token); assert.equal(b.player, 1); assert.equal(b.status, 'connected');
});

test('reconnect countdown continues through a stalled resume handshake and connection text reflects remaining time', async () => {
  const h = fakeNetwork(), ready = h.net.connect({ t: 'create' }), socket = h.sockets[0];
  socket.handlers.open(); socket.receive({ t: 'welcome', room: 'ABCD', token: 'seat', seq: 0, action: 0, player: 0 }); await ready;
  h.net.disconnected(); assert.equal(h.net.reconnectRemaining(), 20);
  h.advance(800); h.sockets[1].handlers.open(); h.advance(3200);
  assert.match(h.net.connectionText(), /剩余 16 秒/);
  // A pong alone is not an authenticated resume and cannot reset its deadline.
  h.sockets[1].receive({ t: 'pong', ts: 4000, nt: 4 });
  let reason; h.net.onEnd = text => reason = text; h.advance(16000);
  assert.match(reason, /重连超时/); assert.equal(h.net.status, 'closed');
});
