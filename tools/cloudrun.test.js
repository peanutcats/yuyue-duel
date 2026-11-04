'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { once } = require('node:events');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { buildCloudrun } = require('./build-cloudrun');
const { checkCloudrun } = require('./check-cloudrun');

test('cloud upload ZIP contains only deployment files and runs a complete two-client smoke check from its extracted source', async t => {
  const output = path.resolve(__dirname, '../output'); fs.mkdirSync(output, { recursive: true });
  const dir = fs.mkdtempSync(path.join(output, 'cloudrun-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const archive = buildCloudrun(dir);
  const files = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' }).trim().split('\n');
  assert.deepEqual(files.sort(), [
    '.dockerignore', 'Dockerfile', 'README.md', 'deployment-info.json', 'manifest.json',
    'package.json', 'package-lock.json', 'server/index.js', 'server/rooms.js',
    'js/core.js', 'js/match.js', 'js/state.js',
  ].sort());
  const extracted = path.join(dir, 'extracted');
  execFileSync('unzip', ['-q', archive, '-d', extracted]);
  const manifest = JSON.parse(fs.readFileSync(path.join(extracted, 'manifest.json')));
  for (const [name, hash] of Object.entries(manifest.sha256)) {
    assert.equal(createHash('sha256').update(fs.readFileSync(path.join(extracted, name))).digest('hex'), hash);
  }
  const config = JSON.parse(fs.readFileSync(path.join(extracted, 'deployment-info.json')));
  const app = require(path.join(extracted, 'server/index.js')).createServer({ origins: config.environmentVariables.ALLOWED_ORIGINS });
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  try {
    const result = await checkCloudrun(`http://127.0.0.1:${app.server.address().port}`);
    assert.equal(result.ok, true); assert.ok(result.checks.includes('shared match'));
    assert.equal(app.rooms.rooms.size, 0, 'smoke check must remove its temporary room');
    const sdkOriginResult = await checkCloudrun(`http://127.0.0.1:${app.server.address().port}`, { origin: config.sdkOrigin });
    assert.equal(sdkOriginResult.ok, true, 'configured cloud SDK origin must be accepted without opening arbitrary origins');
    assert.equal(app.rooms.rooms.size, 0);
  } finally { await app.close(); }
});

test('cloud check refuses an Express template without opening any WebSocket or mutating its counter', async t => {
  const paths = []; let upgrades = 0;
  const server = http.createServer((req, res) => { paths.push([req.method, req.url]); res.writeHead(404); res.end('Cannot GET /healthz'); });
  server.on('upgrade', (_req, socket) => { upgrades++; socket.destroy(); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await assert.rejects(checkCloudrun(`http://127.0.0.1:${server.address().port}`), /404/);
  assert.deepEqual(paths, [['GET', '/healthz']]); assert.equal(upgrades, 0);
});
