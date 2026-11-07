'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');

function load(source) {
  const context = vm.createContext({});
  for (const name of ['core', 'roster', 'match', 'ai', 'practice', 'campaign']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', source, name + '.js'), 'utf8'), context);
  }
  return { YY: context.YY, context, sample(value) { vm.runInContext(`Math.random = () => ${value}`, context); } };
}

for (const source of ['js']) {
  test(`${source}: first story lesson feeds from the nozzle with time to move and swing`, () => {
    const h = load(source), { YY } = h, C = YY.C;
    const def = YY.CAMPAIGN[0].stages[0].steps.find(step => step.t === 'drill').def;
    const m = new YY.Match({ practice: true }), pr = new YY.Practice(m, def);
    for (let i = 0; i <= 100; i++) {
      h.sample(i / 100);
      pr.feed();
      const s = m.shuttle, r = YY.simulate(s.x, s.y, s.vx, s.vy, 6, true);
      const tag = `sample ${i}`;
      assert.ok(Math.abs(s.x - (m.players[1].x - .5)) < .01 && Math.abs(s.y - 1.17) < .01, `starts at the machine nozzle: ${tag}`);
      assert.ok(s.vx < 0 && s.vy > 0 && s.speed < 11, `gentle upward feed: ${tag}`);
      assert.ok(!r.netHit && r.netY > C.NET_CLEAR + .15, `clears net: ${tag}`);
      assert.ok(r.landX >= -4.05 && r.landX <= -2.75, `central landing zone: ${tag}`);
      assert.ok(r.apex < 3.5 && r.t > 1.25, `moderate arc and flight time: ${tag}`);
      const contact = YY.findContact(m, 0, ['over', 'low'], 0);
      assert.ok(contact && contact.band !== 'none' && contact.jumpAt == null, `reachable without jumping: ${tag}`);
      assert.ok(contact.tContact - m.time - C.SW_SWEET > .7, `at least .7s to prepare the swing: ${tag}`);
    }
  });

  test(`${source}: fixed practice feeds clear the real net and preserve their landing targets`, () => {
    const h = load(source), { YY } = h;
    const profiles = [
      ...Object.entries({ clear: [4.6, 5.8], lift: [4.4, 5.6], drop: [1, 1.9], net: [.6, 1.2], drive: [3, 4.5], smash: [2.6, 4.2] })
        .map(([kind, depths]) => ({ def: { judge: 'receive', feeds: { [kind]: 1 } }, depths, name: kind })),
      { def: { judge: 'net', feeds: { netlift: 1 } }, depths: [1.3, 1.9], name: 'netlift' },
      { def: { judge: 'clear' }, depths: [4, 5.2], name: 'high' },
      { def: { judge: 'smash' }, depths: [2.6, 3.6], name: 'jump-smash lesson' },
      { def: { judge: 'drop', source: 5.3, feedDepth: 4.2 }, depths: [4.2, 4.2], name: 'tactics lesson' },
    ];
    for (const env of [null, { drag: .066, wind: 1.4 }, { drag: .08, wind: -1.4 }]) {
      for (const { def, depths, name } of profiles) for (let i = 0; i <= 10; i++) {
        const n = i / 10, m = new YY.Match({ practice: true, env }), pr = new YY.Practice(m, def);
        h.sample(n); pr.feed();
        const s = m.shuttle, tag = `${name} ${n} ${JSON.stringify(env)}`;
        assert.ok(s.live && s.vx < 0 && Number.isFinite(s.speed), `valid feed: ${tag}`);
        let landed = null;
        for (let tick = 0; tick < 720 && !landed; tick++) {
          m.step(YY.C.DT);
          for (const e of m.events.splice(0)) {
            assert.notEqual(e.type, 'net', `no net collision: ${tag}`);
            if (e.type === 'pland') landed = e;
          }
        }
        assert.ok(landed && !landed.netHit && landed.inB, `lands in court: ${tag}`);
        const target = depths[0] + (depths[1] - depths[0]) * n;
        assert.ok(Math.abs(landed.x + target) < .04, `requested depth ${target}: ${tag}`);
        assert.ok(Math.abs(m.pred.landX - landed.x) < .001, `hint matches live physics: ${tag}`);
      }
    }
  });

  test(`${source}: an unsolvable feed is retried without launching or charging an attempt`, () => {
    const { YY } = load(source), m = new YY.Match({ practice: true });
    const pr = new YY.Practice(m, { judge: 'clear', source: 1000, feedDepth: 4 });
    m.events.length = 0;
    pr.feed();
    assert.equal(m.phase, 'idle');
    assert.equal(m.shuttle.live, false);
    assert.equal(m.hitCount, 0);
    assert.equal(pr.att, 0);
    assert.ok(pr.wait > 0);
    assert.equal(m.events.length, 0);
  });
}

test('first story lesson can be completed using its displayed cues after a normal reaction delay', () => {
  const h = load('js'), { YY } = h;
  for (let seed = 1; seed <= 8; seed++) {
    vm.runInContext(`Math.random = ((seed) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed + .5) / 4294967296; })(${seed})`, h.context);
    const def = YY.CAMPAIGN[0].stages[0].steps.find(step => step.t === 'drill').def;
    const m = new YY.Match({ practice: true }), pr = new YY.Practice(m, def);
    let feed = -1, readyAt = 0, swung = false, done = null;
    for (let tick = 0; tick < 120 * 60 && !done; tick++) {
      const hint = m.hint, p = m.players[0], inp = m.inputs[0];
      if (m.hitCount !== feed) { feed = m.hitCount; readyAt = m.time + .25; swung = false; }
      if (hint && m.shuttle.lastHitter === 1 && m.time >= readyAt) {
        const dx = hint.standX - p.x;
        inp.move = Math.abs(dx) < .05 ? 0 : YY.clamp(dx / .3, -1, 1);
        if (!swung && m.time >= hint.swingAt) { inp.presses.push({ btn: 'clear' }); swung = true; }
      } else inp.move = 0;
      pr.update(YY.C.DT); m.step(YY.C.DT);
      for (const e of m.events.splice(0)) {
        assert.ok(!(e.type === 'net' && m.shuttle.lastHitter === 1), `feeder net fault: seed ${seed}`);
        pr.onEvent(e);
        if (e.type === 'pdone') done = e;
      }
    }
    assert.ok(done?.win, `seed ${seed}: ${pr.ok}/${pr.att}, ${pr.msg}`);
    assert.equal(pr.att, 4, `all four beginner feeds are returnable: seed ${seed}`);
  }
});
