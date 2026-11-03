// 开发用：角色属性 + 技能 + 场地环境的 AI 对 AI 模拟。用法：node tools/skill_sim.js [局数] [环境: none|wind|thin|thin79]
const path = require('path');
const YY = require(path.join(__dirname, '../js/core.js'));
require(path.join(__dirname, '../js/roster.js'));
require(path.join(__dirname, '../js/match.js'));
require(path.join(__dirname, '../js/ai.js'));
const games = +(process.argv[2] || 3);
const ENVS = { none: null, wind: { wind: 1.6, adapt: 0.5 }, thin: { drag: 0.08, adapt: 1 }, thin79: { drag: 0.066, adapt: 0.25 } };
const env = ENVS[process.argv[3] || 'none'];
const ids = YY.CHARS.map((c) => c.id);
const table = {};
for (const a of ids) {
  let wins = 0, uses = 0, outs = 0, pts = 0;
  for (let g = 0; g < games; g++) {
    const b = ids[(ids.indexOf(a) + 1 + g) % ids.length];
    const sel = (c) => ({ char: c, racket: 'r_basic', string: 's_dur', shoe: 'sh_basic', tension: 24 });
    const m = new YY.Match({ stats: [YY.buildStats(sel(a)), YY.buildStats(sel(b))], skills: [YY.char(a).skill, YY.char(b).skill], env: env ? Object.assign({}, env) : null });
    const ais = [new YY.AI(m, 0, 'normal'), new YY.AI(m, 1, 'normal')];
    let t = 0;
    while (m.phase !== 'over' && t < 900) {
      ais[0].update(YY.C.DT); ais[1].update(YY.C.DT); m.step(YY.C.DT); t += YY.C.DT;
      for (const e of m.events) {
        if (e.type === 'skill' && e.p === 0) uses++;
        if (e.type === 'point') { pts++; if (e.reason === '出界') outs++; }
      }
      m.events.length = 0;
    }
    if (m.winner === 0) wins++;
  }
  table[a] = { wins: wins + '/' + games, skillUses: uses, outRate: (outs / pts).toFixed(2) };
}
console.table(table);
