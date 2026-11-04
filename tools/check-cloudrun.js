'use strict';
const { WebSocket } = require('ws');
const deployment = require('../deploy/cloudrun.json');

function endpoint(value) {
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname) ||
      (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) {
    throw new Error('请输入不带路径、凭据或查询参数的 HTTPS 服务地址（本机可用 HTTP）');
  }
  return url;
}

function peer(url, origin) {
  const ws = new WebSocket(url, { origin, handshakeTimeout: 10000 });
  const messages = [], waiters = new Set();
  let failure;
  const fail = error => { failure = error; for (const w of [...waiters]) w.reject(error); };
  ws.on('error', error => fail(new Error(`WebSocket 连接失败：${error.message}`)));
  ws.on('unexpected-response', (_request, response) => {
    fail(new Error(`WebSocket 升级失败：HTTP ${response.statusCode}；检查 /ws、公网访问及版本流量`));
    response.resume(); ws.terminate();
  });
  ws.on('close', () => fail(new Error('WebSocket 在检查完成前关闭')));
  ws.on('message', raw => {
    let data;
    try { data = JSON.parse(raw.toString()); } catch (_) { return fail(new Error('服务器未返回预期的 JSON 协议')); }
    if (data.t === 'error') return fail(new Error(data.message || '服务器拒绝请求'));
    const waiter = [...waiters].find(w => w.type === data.t);
    if (waiter) waiter.resolve(data); else if (messages.length < 256) messages.push(data);
  });
  const opened = new Promise((resolve, reject) => {
    const w = { type: '__open', reject: error => { waiters.delete(w); reject(error); } };
    waiters.add(w);
    ws.once('open', () => { waiters.delete(w); resolve(); });
  });
  return {
    opened,
    send: data => ws.send(JSON.stringify(data)),
    next(type) {
      if (failure) return Promise.reject(failure);
      const i = messages.findIndex(m => m.t === type);
      if (i >= 0) return Promise.resolve(messages.splice(i, 1)[0]);
      return new Promise((resolve, reject) => {
        const done = (fn, value) => { clearTimeout(timer); waiters.delete(w); fn(value); };
        const w = { type, resolve: data => done(resolve, data), reject: error => done(reject, error) };
        const timer = setTimeout(() => w.reject(new Error(`等待 ${type} 超时`)), 10000);
        waiters.add(w);
      });
    },
    close() {
      return new Promise(resolve => {
        if (ws.readyState === WebSocket.CLOSED) return resolve();
        const timer = setTimeout(() => { ws.terminate(); resolve(); }, 1000);
        ws.once('close', () => { clearTimeout(timer); resolve(); });
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ t: 'leave' })); ws.close(1000);
        } else ws.terminate();
      });
    },
  };
}

async function checkCloudrun(value = deployment.publicUrl, { origin = 'https://servicewechat.com' } = {}) {
  const base = endpoint(value);
  const response = await fetch(new URL('/healthz', base), { signal: AbortSignal.timeout(15000), redirect: 'error' });
  if (!response.ok) throw new Error(`/healthz 返回 HTTP ${response.status}，比赛服务尚未正确部署（Express 模板通常返回 404）`);
  let health;
  try { health = await response.json(); } catch (_) { throw new Error('/healthz 未返回 JSON，请检查默认域名提示页或部署内容'); }
  if (health.ok !== true || health.mode !== 'authoritative' || health.physicsHz !== 120 || health.snapshotHz !== 30) {
    throw new Error('/healthz 不是当前羽毛球比赛服务器');
  }
  const url = new URL('/ws', base); url.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  const peers = [];
  try {
    const host = peer(url, origin); peers.push(host); await host.opened;
    host.send({ t: 'create', venue: 'arena' });
    const a = await host.next('welcome');
    if (!/^[A-Z2-9]{4}$/.test(a.room) || a.player !== 0) throw new Error('建房返回值不符合协议');
    const guest = peer(url, origin); peers.push(guest); await guest.opened;
    guest.send({ t: 'join', room: a.room });
    const b = await guest.next('welcome');
    if (a.room !== b.room || b.player !== 1) throw new Error('两端未加入同一房间；检查是否只有一个实例/版本接收流量');
    const [startA, startB, stateA, stateB] = await Promise.all([
      host.next('start'), guest.next('start'), host.next('st'), guest.next('st'),
    ]);
    if (startA.matchId !== startB.matchId || stateA.matchId !== startA.matchId ||
        stateB.matchId !== startA.matchId || stateA.pp?.length !== 2 || stateB.pp?.length !== 2) {
      throw new Error('两端对局或服务器快照不一致');
    }
    const ts = Date.now(); host.send({ t: 'ping', ts });
    if ((await host.next('pong')).ts !== ts) throw new Error('心跳回包不符合协议');
    return { ok: true, checks: ['healthz', 'WSS upgrade', 'create', 'join', 'shared match', 'snapshots', 'heartbeat'] };
  } finally {
    // This check only creates its own temporary room and explicitly removes it.
    await Promise.all(peers.map(p => p.close()));
  }
}
if (require.main === module) {
  const args = process.argv.slice(2);
  checkCloudrun(args.find(arg => !arg.startsWith('--')), { origin: args.includes('--cloud-origin') ? deployment.sdkOrigin : 'https://servicewechat.com' }).then(result => {
    console.log(`公网比赛接口检查通过：${result.checks.join(' → ')}\n此脚本不经过微信身份通道；仍需在小游戏中验证 connectContainer、分享、操作延迟和重连。`);
  }).catch(error => { console.error(`检查未通过：${error.message}`); process.exitCode = 1; });
}
module.exports = { checkCloudrun };
