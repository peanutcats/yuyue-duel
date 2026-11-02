// 开发用：无界面 AI 对 AI 模拟，统计回合与得分原因。用法：node tools/sim.js normal hard 20
const path = require('path');
const YY = require(path.join(__dirname, '../js/core.js'));
require(path.join(__dirname, '../js/match.js'));
require(path.join(__dirname, '../js/ai.js'));
const [lvA = 'normal', lvB = 'normal', games = 10] = process.argv.slice(2);
const reasons = {}, shots = {}, quals = [];
let rallies = [], wins = [0, 0], totalT = 0, whiffs = {};
for (let g = 0; g < +games; g++) {
  const m = new YY.Match({});
  const ais = [new YY.AI(m, 0, lvA), new YY.AI(m, 1, lvB)];
  let t = 0;
  while (m.phase !== 'over' && t < 900) {
    ais[0].update(YY.C.DT); ais[1].update(YY.C.DT);
    m.step(YY.C.DT); t += YY.C.DT;
    for (const e of m.events) {
      if (e.type === 'point') { reasons[e.reason] = (reasons[e.reason] || 0) + 1; rallies.push(e.rally); }
      if (e.type === 'hit') { shots[e.shot] = (shots[e.shot] || 0) + 1; quals.push(e.q); }
      if (e.type === 'whiff') whiffs[e.label] = (whiffs[e.label] || 0) + 1;
    }
    m.events.length = 0;
  }
  totalT += t;
  wins[m.winner]++;
  console.log(`game ${g}: ${m.score.join(':')} ${t.toFixed(0)}s longest ${m.longest}`);
}
const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2);
console.log('wins', wins, 'avg game', (totalT / games).toFixed(0) + 's', 'avg rally', avg(rallies), 'avg q', avg(quals));
console.log('reasons', reasons);
console.log('shots', shots);
console.log('whiffs', whiffs);
