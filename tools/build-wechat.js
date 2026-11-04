'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'minigame');
const write = (name, data) => { const dest = path.join(out, name); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, data); };
const shared = ['core', 'roster', 'match', 'ai', 'practice', 'char', 'venues', 'render', 'story', 'gameplay'];
const hashes = {};
for (const name of shared) {
  const data = fs.readFileSync(path.join(root, 'js', name + '.js'));
  write('shared/' + name + '.js', data); hashes[name] = crypto.createHash('sha256').update(data).digest('hex');
}
const network = fs.readFileSync(path.join(root, 'js/net.js'), 'utf8');
const start = network.indexOf('  const stamp ='), end = network.indexOf('  YY.GuestView = GuestView;');
if (start < 0 || end < start) throw new Error('GuestView source markers changed; update build-wechat.js');
const view = network.slice(start, end + '  YY.GuestView = GuestView;'.length).replaceAll('performance.now()', 'YY.platform.now()');
write('shared/net-view.js', `// Generated from js/net.js. Do not edit here.\n(function(G) { const YY = G.YY, KIND = ['over', 'side', 'under'];\n${view}\n})(typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis);\n`);
write('assets/images/icon.png', fs.readFileSync(path.join(root, 'assets/icons/yuyue-wechat-icon.png')));
// Deterministic mono PCM, generated locally; no downloaded media or SDK.
const sampleRate = 22050;
const effects = {
  hit: [.12, 1500, 450, .35], power: [.28, 200, 55, .8], swing: [.12, 900, 350, .65], net: [.22, 500, 120, .5], floor: [.1, 350, 150, .35], jump: [.12, 230, 500, .25],
  whistle: [.4, 2900, 2900, .04], cheer: [.75, 1000, 800, .85], 'cheer-big': [1.25, 1200, 500, .85], click: [.08, 660, 880, 0], skill: [.55, 220, 1320, .1], ready: [.22, 988, 1319, 0], blip: [.04, 1100, 900, 0], win: [.65, 523, 1046, 0], lose: [.5, 392, 196, 0],
};
for (const [name, [duration, from, to, noise]] of Object.entries(effects)) {
  const n = Math.ceil(duration * sampleRate), data = Buffer.alloc(44 + n * 2);
  data.write('RIFF'); data.writeUInt32LE(data.length - 8, 4); data.write('WAVEfmt ', 8); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22); data.writeUInt32LE(sampleRate, 24); data.writeUInt32LE(sampleRate * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(n * 2, 40);
  let phase = 0, seed = 71;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate, u = t / duration;
    let freq = from * Math.pow(to / from, u);
    if (name === 'win') freq = [523, 659, 784, 1046][Math.min(3, Math.floor(u * 4))];
    if (name === 'lose') freq = [392, 330, 262][Math.min(2, Math.floor(u * 3))];
    phase += 2 * Math.PI * freq / sampleRate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const env = Math.min(1, t / .008) * Math.pow(1 - u, noise > .3 ? 2 : .75);
    const sample = (Math.sin(phase) * (1 - noise) + (seed / 2147483648 - 1) * noise) * env * .7;
    data.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  write('assets/audio/' + name + '.wav', data);
}
write('build-manifest.json', JSON.stringify({ appId: require('../minigame/config').appId, shared: hashes }, null, 2) + '\n');
function bytes(dir) { return fs.readdirSync(dir, { withFileTypes: true }).reduce((sum, entry) => sum + (entry.isDirectory() ? bytes(path.join(dir, entry.name)) : fs.statSync(path.join(dir, entry.name)).size), 0); }
console.log(`微信工程已生成：${out}\nAppID: ${require('../minigame/config').appId}\n包体文件总计 ${(bytes(out) / 1024).toFixed(0)} KiB`);
