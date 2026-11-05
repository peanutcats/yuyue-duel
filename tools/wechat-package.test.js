'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { loadGame } = require('./wechat-test-harness');
const root = path.resolve(__dirname, '..');

test('WeChat project binds the supplied AppID, packages only minigame, and generated shared code exactly matches its source', () => {
  const project = require('../project.config.json'), game = require('../minigame/game.json'), config = require('../minigame/config');
  assert.equal(project.appid, 'wx4c24e883bac82367'); assert.equal(project.appid, config.appId); assert.equal(project.compileType, 'game'); assert.equal(project.miniprogramRoot, 'minigame/'); assert.equal(game.deviceOrientation, 'landscape'); assert.equal(project.setting.urlCheck, true);
  const manifest = require('../minigame/build-manifest.json');
  for (const [name, hash] of Object.entries(manifest.shared)) {
    const source = fs.readFileSync(path.join(root, 'js', name + '.js')), packaged = fs.readFileSync(path.join(root, 'minigame/shared', name + '.js'));
    assert.ok(source.equals(packaged), name + ': run npm run build:wechat');
    assert.equal(crypto.createHash('sha256').update(source).digest('hex'), hash);
  }
  function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]); }
  const files = walk(path.join(root, 'minigame'));
  for (const file of files.filter(f => f.endsWith('.js'))) {
    const source = fs.readFileSync(file, 'utf8');
    for (const [, relative] of source.matchAll(/require\(['"]([^'"]+)['"]\)/g)) {
      assert.ok(relative.startsWith('.'), 'Unexpected external dependency: ' + relative);
      const target = path.resolve(path.dirname(file), relative + (relative.endsWith('.js') ? '' : '.js'));
      assert.ok(target.startsWith(path.join(root, 'minigame') + path.sep)); assert.ok(fs.existsSync(target));
    }
    assert.ok(!/eval\s*\(|new Function\s*\(/.test(source), 'Runtime compilation in ' + file);
  }
  const audioBank = require('../minigame/src/audio-bank');
  assert.equal(files.filter(f => f.endsWith('.wav')).length, Object.keys(audioBank).length);
  for (const name of Object.keys(audioBank)) {
    const data = fs.readFileSync(path.join(root, 'minigame/assets/audio', name + '.wav'));
    assert.equal(data.toString('ascii', 0, 4), 'RIFF');
    assert.equal(data.readUInt32LE(24), manifest.audio.sampleRate);
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'), manifest.audio.files[name]);
  }
  const voices=require('../minigame/src/voice-bank'),script=require('../assets/story/voice-script.json');
  const ids=new Set(script.map(row=>row.id));assert.equal(manifest.voices,script.length);assert.equal(Object.keys(voices).length,script.length);for(const id of Object.keys(voices))assert.ok(ids.has(id),'stale voice '+id);
  const roots=new Set(game.subpackages.map(p=>p.root));
  for(const row of script){
    const clip=voices[row.id];assert.ok(clip,'Missing dialogue '+row.id);assert.ok(roots.has(clip.root));assert.equal(clip.speaker,row.who);
    assert.equal(clip.engine,'qwen-audio-3.1-tts-plus');assert.ok(clip.duration>.1&&clip.duration<90);
    const data=fs.readFileSync(path.join(root,'minigame',clip.root,clip.file));
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'),clip.sha256);
    assert.ok(data.equals(fs.readFileSync(path.join(root,'assets/story/voices',clip.file))));
  }
  assert.equal(files.filter(f=>f.endsWith('.mp3')).length,Object.keys(voices).length,'No stale spoken lines in package');
  let main=0,total=0;const sizes={};
  for(const file of files){const size=fs.statSync(file).size,part=path.relative(path.join(root,'minigame'),file).split(path.sep)[0];total+=size;if(roots.has(part))sizes[part]=(sizes[part]||0)+size;else main+=size;}
  assert.ok(main<4*1024*1024);assert.ok(total<30*1024*1024);assert.ok(Object.values(sizes).every(n=>n<4*1024*1024));
});

test('tablet and compact landscape layouts keep controls inside safe bounds and separate touch hit circles', () => {
  for (const [width, height] of [[667, 375], [844, 390], [1024, 768], [1280, 720]]) {
    const h = loadGame({ width, height, safe: true });
    for (const mode of ['solo', 'duo']) {
      if (mode === 'duo') h.app.startLocal(); else h.app.startAI('normal');
      h.frames(); const controls = h.app.ui.controls;
      for (const b of controls) { assert.ok(b.x - b.r >= 0); assert.ok(b.y - b.r >= 0); assert.ok(b.x + b.r <= h.app.ui.W); assert.ok(b.y + b.r <= h.app.ui.H); }
      for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
        const a = controls[i], b = controls[j]; assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > a.r + b.r, `${width} ${mode}: ${a.id}/${b.id} overlap`);
      }
    }
    h.app.destroy();
  }
});

test('local action prediction never changes authority snapshot, shuttle trajectory or scores', () => {
  const h = loadGame(), { YY } = h;
  const Prediction = require('../minigame/src/prediction')(YY, { serverTime: () => 10.05, rtt: .05 });
  const predictor = new Prediction(0), m = new YY.Match(); m.phase = 'rally';
  const snapshot = { nt: 10, ph: 'rally', sv: 1, st: 0, sg: 0, hs: 0, im: [0, 0], ack: [0, 0], pp: m.players, s: [0, 3, -2, 1] };
  const original = JSON.stringify(snapshot), view = { players: [{}, {}], score: [2, 3], shuttle: { x: 0, y: 3, vx: -2, vy: 1 } };
  predictor.snapshot(snapshot); predictor.input({ seq: 1, move: 1, presses: [{ id: 1, btn: 'jump' }] });
  predictor.apply(view, 1 / 60);
  assert.ok(view.players[0]); assert.equal(JSON.stringify(snapshot), original);
  assert.deepEqual(view.score, [2, 3]); assert.deepEqual(view.shuttle, { x: 0, y: 3, vx: -2, vy: 1 });
  h.app.destroy();
});
