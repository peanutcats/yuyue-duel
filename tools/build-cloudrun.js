'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');

// Explicit files only: never recursively archive the project, local credentials,
// the template database, node_modules, or the client package.
const sources = {
  'Dockerfile': 'deploy/Dockerfile',
  '.dockerignore': '.dockerignore',
  'package.json': 'package.json',
  'package-lock.json': 'package-lock.json',
  'server/index.js': 'server/index.js',
  'server/rooms.js': 'server/rooms.js',
  'js/core.js': 'js/core.js',
  'js/match.js': 'js/match.js',
  'js/state.js': 'js/state.js',
  'README.md': 'deploy/WECHAT_CLOUDRUN.md',
  'deployment-info.json': 'deploy/cloudrun.json',
};

function buildCloudrun(outputDir = path.join(root, 'output')) {
  fs.mkdirSync(outputDir, { recursive: true });
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'yuyue-cloudrun-'));
  const archive = path.resolve(outputDir, 'yuyue-cloudrun.zip');
  try {
    const hashes = {};
    for (const [dest, source] of Object.entries(sources)) {
      const data = fs.readFileSync(path.join(root, source));
      const file = path.join(staging, dest);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, data);
      hashes[dest] = createHash('sha256').update(data).digest('hex');
    }
    fs.writeFileSync(path.join(staging, 'manifest.json'), JSON.stringify({
      clientVersion: require('../minigame/config').version, sha256: hashes,
    }, null, 2) + '\n');
    // Build a new archive, rather than updating an older ZIP that may retain files.
    const temporaryArchive = path.join(staging, 'bundle.zip');
    execFileSync('zip', ['-q', '-X', '-9', temporaryArchive, ...Object.keys(sources), 'manifest.json'], { cwd: staging });
    fs.copyFileSync(temporaryArchive, archive);
    return archive;
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}
if (require.main === module) {
  const archive = buildCloudrun();
  console.log(`云托管上传包：${archive}\n大小：${(fs.statSync(archive).size / 1024).toFixed(1)} KiB\n只生成本地文件；尚未部署到云端。`);
}
module.exports = { buildCloudrun };
