// 开发用：按练习提示操作的机器人，验证各练习可完成。用法：node tools/practice_sim.js
const path = require('path');
const YY = require(path.join(__dirname, '../js/core.js'));
require(path.join(__dirname, '../js/match.js'));
require(path.join(__dirname, '../js/ai.js'));
require(path.join(__dirname, '../js/practice.js'));
const C = YY.C;
for (const drill of ['receive', 'clear', 'drop', 'smash']) {
  const m = new YY.Match({ practice: true });
  const pr = new YY.Practice(m, drill);
  const msgs = {};
  let jumped = false, swung = false, lastFeed = -1;
  for (let t = 0; t < 120; t += C.DT) {
    const h = m.hint, p = m.players[0];
    if (m.hitCount !== lastFeed) { lastFeed = m.hitCount; jumped = false; swung = false; }
    if (h && m.shuttle.lastHitter === 1) {
      if (h.standX != null) { const dx = h.standX - p.x; m.inputs[0].move = Math.abs(dx) < 0.05 ? 0 : YY.clamp(dx / 0.3, -1, 1); }
      if (h.jumpAt != null && !jumped && m.time >= h.jumpAt) { m.inputs[0].presses.push({ btn: 'jump' }); jumped = true; }
      if (!swung && m.time >= h.swingAt) {
        const btn = drill === 'smash' ? (h.band === 'smash' ? 'smash' : 'clear') : drill === 'drop' ? 'drop' : 'clear';
        m.inputs[0].presses.push({ btn }); swung = true;
      }
    } else m.inputs[0].move = 0;
    pr.update(C.DT);
    m.step(C.DT);
    for (const e of m.events.splice(0)) { pr.onEvent(e); if (e.type === 'pres') { const k = e.msg.split(' ')[0].split('·')[0] + (drill === 'receive' ? ':' + pr.lastKind : ''); msgs[k] = (msgs[k] || 0) + 1; } }
  }
  console.log(drill.padEnd(8), `ok ${pr.ok}/${pr.att}`, JSON.stringify(msgs));
}
