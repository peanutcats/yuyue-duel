// TURN 凭证接口：node --test tools/turn_api.test.js
const assert = require('node:assert/strict');
const test = require('node:test');
const handler = require('../api/turn.js');

function call(headers = {}, method = 'GET') {
  return new Promise((resolve) => {
    const res = {
      headers: {}, statusCode: 0,
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      end(body) { resolve({ status: this.statusCode, headers: this.headers, body: JSON.parse(body) }); },
    };
    handler({ method, headers }, res);
  });
}
function withEnv(env, fn) {
  const old = { k: process.env.CF_TURN_KEY_ID, t: process.env.CF_TURN_API_TOKEN };
  const set = (k, v) => { if (v === undefined) delete process.env[k]; else process.env[k] = v; };
  set('CF_TURN_KEY_ID', env.k); set('CF_TURN_API_TOKEN', env.t);
  return Promise.resolve(fn()).finally(() => { set('CF_TURN_KEY_ID', old.k); set('CF_TURN_API_TOKEN', old.t); });
}
function mockFetch(responses) {
  const calls = [];
  const orig = global.fetch;
  global.fetch = async (url, opts) => {
    calls.push({ url, opts });
    const r = responses.shift();
    return { status: r.status, ok: r.status >= 200 && r.status < 300, json: async () => r.body };
  };
  return { calls, restore: () => { global.fetch = orig; } };
}

test('统一格式并去掉 53 端口地址（浏览器会超时）', () => {
  const out = handler.normalize({ urls: ['stun:stun.cloudflare.com:3478', 'turn:turn.cloudflare.com:53?transport=udp', 'turns:turn.cloudflare.com:443?transport=tcp'], username: 'u', credential: 'c' });
  assert.deepEqual(out, [{ urls: ['stun:stun.cloudflare.com:3478', 'turns:turn.cloudflare.com:443?transport=tcp'], username: 'u', credential: 'c' }]);
  assert.deepEqual(handler.normalize(null), []);
});

test('未配置环境变量时返回 503，且不缓存', () => withEnv({}, async () => {
  const r = await call();
  assert.equal(r.status, 503);
  assert.equal(r.headers['cache-control'], 'no-store');
}));

test('拒绝跨站调用', () => withEnv({ k: 'key', t: 'tok' }, async () => {
  const r = await call({ 'sec-fetch-site': 'cross-site' });
  assert.equal(r.status, 403);
}));

test('向 Cloudflare 申请凭证：携带密钥、TTL，返回 iceServers', () => withEnv({ k: 'key/1', t: 'tok' }, async () => {
  const m = mockFetch([{ status: 201, body: { iceServers: [{ urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turn:turn.cloudflare.com:53'], username: 'u', credential: 'c' }] } }]);
  try {
    const r = await call({ 'sec-fetch-site': 'same-origin' });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.iceServers, [{ urls: ['turn:turn.cloudflare.com:3478?transport=udp'], username: 'u', credential: 'c' }]);
    assert.equal(r.body.ttl, handler.TTL);
    assert.equal(m.calls[0].url, 'https://rtc.live.cloudflare.com/v1/turn/keys/key%2F1/credentials/generate-ice-servers');
    assert.equal(m.calls[0].opts.headers.Authorization, 'Bearer tok');
    assert.equal(JSON.parse(m.calls[0].opts.body).ttl, handler.TTL);
  } finally { m.restore(); }
}));

test('新接口不存在时退回旧接口（iceServers 为单个对象）', () => withEnv({ k: 'key', t: 'tok' }, async () => {
  const m = mockFetch([{ status: 404, body: {} }, { status: 201, body: { iceServers: { urls: ['turn:turn.cloudflare.com:3478'], username: 'u', credential: 'c' } } }]);
  try {
    const r = await call();
    assert.equal(r.status, 200);
    assert.equal(r.body.iceServers.length, 1);
    assert.match(m.calls[1].url, /\/credentials\/generate$/);
  } finally { m.restore(); }
}));

test('Cloudflare 报错时返回 502，不泄露密钥', () => withEnv({ k: 'key', t: 'secret-token' }, async () => {
  const m = mockFetch([{ status: 401, body: {} }]);
  try {
    const r = await call();
    assert.equal(r.status, 502);
    assert.ok(!JSON.stringify(r.body).includes('secret-token'));
  } finally { m.restore(); }
}));
