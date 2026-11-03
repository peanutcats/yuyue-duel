// 开发用：逐关验证故事模式的练习 / 步法 / 发球 / 比赛都能完成。用法：node tools/story_sim.js
const path = require('path');
global.window = globalThis;
const YY = require(path.join(__dirname, '../js/core.js'));
require(path.join(__dirname, '../js/roster.js'));
require(path.join(__dirname, '../js/match.js'));
require(path.join(__dirname, '../js/ai.js'));
require(path.join(__dirname, '../js/practice.js'));
require(path.join(__dirname, '../js/story.js'));
const C = YY.C;
const me = YY.buildStats({ char: 'lingfeng', racket: 'r_basic', string: 's_dur', shoe: 'sh_basic', tension: 24 });

function runPractice(step) {
  const m = new YY.Match({ practice: true, stats: [me, null] });
  const pr = step.t === 'drill' ? new YY.Practice(m, step.def) : step.t === 'footwork' ? new YY.Footwork(m, step.def) : new YY.ServeDrill(m, step.def);
  let done = null, jumped = false, swung = false, lastFeed = -1, served = false;
  for (let t = 0; t < 240 && !done; t += C.DT) {
    const p = m.players[0], inp = m.inputs[0];
    if (step.t === 'drill') {
      const h = m.hint;
      if (m.hitCount !== lastFeed) { lastFeed = m.hitCount; jumped = false; swung = false; }
      if (h && m.shuttle.lastHitter === 1) {
        if (h.standX != null) { const dx = h.standX - p.x; inp.move = Math.abs(dx) < 0.05 ? 0 : YY.clamp(dx / 0.3, -1, 1); }
        if (h.jumpAt != null && !jumped && m.time >= h.jumpAt) { inp.presses.push({ btn: 'jump' }); jumped = true; }
        if (!swung && m.time >= h.swingAt) {
          const j = pr.drill;
          inp.presses.push({ btn: j === 'smash' ? (h.band === 'smash' ? 'smash' : 'clear') : j === 'drop' ? 'drop' : 'clear' }); swung = true;
        }
      } else inp.move = 0;
    } else if (step.t === 'footwork') {
      const mk = pr.cur;
      if (mk && !mk.done) {
        const dx = mk.x - p.x;
        inp.move = Math.abs(dx) < 0.1 ? 0 : YY.clamp((dx * p.dir) / 0.3, -1, 1);
        if (Math.abs(dx) < 0.35 && p.onGround) inp.presses.push({ btn: mk.kind === 'jump' ? 'jump' : 'clear' });
      } else inp.move = 0;
    } else {
      if (m.phase === 'serve' && !m.serving) { if (Math.abs(m.serveMeter() - 0.5) < 0.04) inp.presses.push({ btn: step.def.kind === 'sserve' ? 'drop' : 'clear' }); }
    }
    pr.update(C.DT);
    m.step(C.DT);
    for (const e of m.events.splice(0)) { if (pr.onEvent) pr.onEvent(e); if (e.type === 'pdone') done = e; }
  }
  return done ? `${done.win ? 'WIN ' : 'LOSE'} ${done.ok}/${done.att}` : `TIMEOUT ${pr.ok}/${pr.att}`;
}

function runMatch(step) {
  const opp = YY.buildStats({ char: step.opp, racket: 'r_basic', string: 's_dur', shoe: 'sh_basic', tension: 24 });
  let wins = 0, outs = 0;
  const N = 4;
  for (let g = 0; g < N; g++) {
    const m = new YY.Match({ target: step.target, cap: step.cap, stats: [me, opp], skills: ['pokong', YY.char(step.opp).skill], env: step.env ? Object.assign({}, step.env) : null });
    const ais = [new YY.AI(m, 0, 'hard'), new YY.AI(m, 1, step.level)];
    let t = 0;
    while (m.phase !== 'over' && t < 600) {
      ais[0].update(C.DT); ais[1].update(C.DT); m.step(C.DT); t += C.DT;
      for (const e of m.events.splice(0)) {
        if (e.type === 'point' && e.loser === 0 && e.kind === 'error' && !e.inB) outs++;
        if (e.type === 'point' && step.windFlip && (m.score[0] + m.score[1]) % step.windFlip === 0) m.env.wind = -m.env.wind;
      }
    }
    if (m.winner === 0) wins++;
  }
  return `hard-bot wins ${wins}/${N} vs ${step.opp}(${step.level}) · my outs ${outs}`;
}

for (const st of YY.STAGES) {
  for (const step of st.steps) {
    if (step.t === 'dialog' || step.t === 'quiz' || step.t === 'pick') continue;
    const r = step.t === 'match' ? runMatch(step) : runPractice(step);
    console.log(st.id.padEnd(4), step.t.padEnd(8), r);
  }
}
