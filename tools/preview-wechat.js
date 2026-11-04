'use strict';
// Development-only wx shim. This file is outside minigameRoot and is never uploaded.
const fs = require('node:fs'), path = require('node:path');
const { createServer } = require('../server/index');
const root = path.resolve(__dirname, '..');
function bundle() {
  const modules = new Map();
  function add(file) {
    if (modules.has(file)) return;
    const source = fs.readFileSync(path.join(root, 'minigame', file), 'utf8'); modules.set(file, source);
    for (const [, relative] of source.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)) {
      let target = path.posix.normalize(path.posix.join(path.posix.dirname(file), relative));
      if (!target.endsWith('.js')) target += '.js'; add(target);
    }
  }
  add('game.js');
  return `(function(){const modules={${[...modules].map(([file, src]) => `${JSON.stringify(file)}:function(require,module,exports){\n${src}\n}`).join(',')}};const cache={};function run(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](function(rel){const parts=id.split('/');parts.pop();for(const p of rel.split('/')){if(p==='..')parts.pop();else if(p!=='.')parts.push(p);}let next=parts.join('/');if(!next.endsWith('.js'))next+='.js';return run(next);},m,m.exports);return m.exports;}const config=run('config.js');if(new URLSearchParams(location.search).has('online')){config.networkTransport='socket';config.serverUrl='ws://'+location.host+'/ws';config.allowLocalhost=true;}run('game.js');})();`;
}
const previewHtml = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><title>羽跃对决 · 微信运行环境预览</title><style>html,body{margin:0;background:#080e22;overflow:hidden;width:100%;height:100%;touch-action:none}canvas{display:block;touch-action:none}#capsule{position:fixed;top:12px;right:12px;border:1px solid #ffffff44;border-radius:20px;background:#0004;color:#fff9;width:82px;height:27px;display:grid;place-items:center;font:18px sans-serif;pointer-events:none}</style></head><body><div id="capsule">··· │ ◉</div><script src="/__wx.js"></script><script src="/__game.js"></script></body></html>`;
const app = createServer(); app.server.removeAllListeners('request');
app.server.on('request', (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  res.setHeader('Cache-Control', 'no-store');
  if (pathname === '/' || pathname === '/wechat') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(previewHtml); }
  if (pathname === '/__game.js') { res.setHeader('Content-Type', 'text/javascript; charset=utf-8'); return res.end(bundle()); }
  if (pathname === '/__wx.js') { res.setHeader('Content-Type', 'text/javascript; charset=utf-8'); return res.end(fs.readFileSync(path.join(__dirname, 'wechat-preview-wx.js'))); }
  if (pathname === '/healthz') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ ok: true, preview: true, rooms: app.rooms.rooms.size })); }
  if (!/^\/minigame\/assets\/[a-zA-Z0-9/_.-]+$/.test(pathname)) { res.writeHead(404); return res.end(); }
  const file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(path.join(root, 'minigame/assets') + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (error, data) => { if (error) { res.writeHead(404); return res.end(); } res.setHeader('Content-Type', file.endsWith('.wav') ? 'audio/wav' : 'image/png'); res.end(data); });
});
const port = Number(process.env.PREVIEW_PORT) || 8766;
app.server.listen(port, '127.0.0.1', () => console.log(`微信适配预览 http://127.0.0.1:${port}\n联机预览 http://127.0.0.1:${port}/?online=1\n仅用于开发验收，不代替微信真机测试。`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => app.close().then(() => process.exit(0)));
