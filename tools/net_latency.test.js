const test = require('node:test');
const assert = require('node:assert/strict');
const YY = require('../js/core.js');
require('../js/match.js');
global.window = globalThis;
global.location = { search: '' };
require('../js/net.js');

function snap(nt, ht, events = []) {
  const m = new YY.Match({}); m.time = ht;
  return { ...YY.snapshot(m, events), nt };
}

test('比赛时间冻结期间仍按网络时间播放事件，恢复后不堆积', () => {
  const v = new YY.GuestView();
  for (let i = 0; i < 40; i++) {
    const t = 10 + i / 60;
    v.push(snap(t, 3, i === 10 ? [{ type: 'hit' }] : []), t + 0.1);
    v.update(t + 0.1);
  }
  assert.equal(v.time, 3);
  assert.equal(v.events.length, 1);
  assert.equal(v.pendingEvents.length, 0);
  assert.ok(v.delay <= 0.03);
  v.push(snap(11, 3.1), 11.1); v.update(11.2);
  assert.equal(v.time, 3.1);
});

test('稳定网络缓冲为 25ms；抖动增大时自适应且显示时间不倒退', () => {
  const v = new YY.GuestView(); let previous = -Infinity;
  for (let i = 0; i < 120; i++) {
    const t = 10 + i / 60, now = t + 0.04 + (i > 60 && i % 2 ? 0.025 : 0);
    v.push(snap(t, t), now); v.update(now);
    assert.ok(v.renderStamp >= previous); previous = v.renderStamp;
    if (i === 59) assert.ok(v.delay < 0.026);
  }
  assert.ok(v.delay > 0.04 && v.delay <= 0.08);
});

test('拥塞合并旧快照，事件与按键计数不丢失，恢复后只发送最新状态', () => {
  const N = YY.Net, sent = [];
  N.close();
  N.conn = { open: true, dataChannel: { bufferedAmount: 20000 }, send: o => sent.push(o), close() {} };
  for (let i = 0; i < 60; i++) {
    N.send({ t: 'st', nt: i, ev: i % 20 === 0 ? [{ type: 'hit', id: i }] : [] });
    N.send({ t: 'in', m: i % 2, c: [0, i, 0, 0] });
  }
  assert.equal(sent.length, 0);
  N.conn.dataChannel.bufferedAmount = 0; N.flush();
  assert.equal(sent.length, 2);
  assert.equal(sent[0].c[1], 59);
  assert.equal(sent[1].nt, 59);
  assert.deepEqual(sent[1].ev.map(e => e.id), [0, 20, 40]);
  N.close(); assert.equal(N.flushTimer, null);
});

test('乱序旧快照不倒带，也不重复击球事件', () => {
  const v = new YY.GuestView();
  v.push(snap(10, 1), 10); v.push(snap(10.1, 1.1), 10.1);
  v.push(snap(10.05, 1.05, [{ type: 'hit' }]), 10.2);
  v.update(10.3);
  assert.equal(v.time, 1.1); assert.equal(v.events.length, 0);
});
