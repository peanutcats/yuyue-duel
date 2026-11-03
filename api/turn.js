/* 羽跃对决 · Vercel Serverless Function：为在线对战生成 Cloudflare TURN 临时凭证
 *
 * 环境变量（在 Vercel 项目 Settings → Environment Variables 中配置）：
 *   CF_TURN_KEY_ID      Cloudflare TURN Key 的 ID
 *   CF_TURN_API_TOKEN   该 TURN Key 的 API Token
 * 密钥只保存在服务器端；浏览器拿到的是有效期有限的临时用户名/密码。
 */
'use strict';

const TTL = 4 * 3600; // 凭证有效期（秒）

/** 统一为 RTCIceServer 数组，并去掉浏览器会超时的 53 端口地址 */
function normalize(ice) {
  const list = Array.isArray(ice) ? ice : ice ? [ice] : [];
  const out = [];
  for (const s of list) {
    if (!s) continue;
    const urls = (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => typeof u === 'string' && !/:53(\?|$)/.test(u));
    if (urls.length) out.push(Object.assign({}, s, { urls }));
  }
  return out;
}

async function fetchIce(keyId, token, fetchImpl) {
  const f = fetchImpl || fetch;
  const base = `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials`;
  const opts = {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ttl: TTL }),
  };
  let r = await f(`${base}/generate-ice-servers`, opts);
  if (r.status === 404) r = await f(`${base}/generate`, opts); // 旧版接口
  if (!r.ok) throw new Error('Cloudflare 返回 ' + r.status);
  const data = await r.json();
  return normalize(data.iceServers);
}

async function handler(req, res) {
  const send = (code, obj) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(obj));
  };
  if (req.method !== 'GET' && req.method !== 'POST') return send(405, { error: '只支持 GET' });
  // 只给本站页面使用：拒绝跨站请求，避免被其他网站盗用流量
  const site = (req.headers && req.headers['sec-fetch-site']) || '';
  if (site === 'cross-site') return send(403, { error: '禁止跨站调用' });
  const keyId = process.env.CF_TURN_KEY_ID, token = process.env.CF_TURN_API_TOKEN;
  if (!keyId || !token) return send(503, { error: 'TURN 未配置：请设置 CF_TURN_KEY_ID 与 CF_TURN_API_TOKEN' });
  try {
    const iceServers = await fetchIce(keyId, token);
    if (!iceServers.length) return send(502, { error: 'Cloudflare 未返回可用的 TURN 地址' });
    return send(200, { iceServers, ttl: TTL });
  } catch (e) {
    return send(502, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
module.exports.normalize = normalize;
module.exports.fetchIce = fetchIce;
module.exports.TTL = TTL;
