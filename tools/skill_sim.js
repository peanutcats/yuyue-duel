// 全技能组模拟：node tools/skill_sim.js [局数] [环境: none|wind|thin|thin79] [easy|normal|boss|hard|nightmare] [随机种子]
const path = require('path');
const YY = require(path.join(__dirname, '../js/core.js'));
require(path.join(__dirname, '../js/roster.js'));
require(path.join(__dirname, '../js/match.js'));
require(path.join(__dirname, '../js/ai.js'));
const games = +(process.argv[2] || 3);
const level = process.argv[4] || 'normal';
let seed = Number(process.argv[5] || 20261107) >>> 0;
Math.random = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
const ENVS = { none: null, wind: { wind: 1.6, adapt: 0.5 }, thin: { drag: 0.08, adapt: 1 }, thin79: { drag: 0.066, adapt: 0.25 } };
const env = ENVS[process.argv[3] || 'none'];
const ids = YY.CHARS.map((c) => c.id);
const table = {};
for (const a of ids) {
  let wins = 0, uses = 0, outs = 0, pts = 0, fails=0, peakCoins=0; const skills=new Set();
  for (let g = 0; g < games; g++) {
    const b = ids[(ids.indexOf(a) + 1 + g) % ids.length];
    const sel = (c) => ({ char: c, racket: 'r_basic', string: 's_dur', shoe: 'sh_basic', tension: 24 });
    const pair=id=>YY.skillSet(id,[YY.char(id).acts[g%3],YY.char(id).acts[(g+1)%3]]);
    const m = new YY.Match({ stats: [YY.buildStats(sel(a)), YY.buildStats(sel(b))], skills: [pair(a),pair(b)], env: env ? Object.assign({}, env) : null });
    const ais = [new YY.AI(m, 0, level,a), new YY.AI(m, 1, level,b)];
    let t = 0;
    while (m.phase !== 'over' && t < 900) {
      ais[0].update(YY.C.DT); ais[1].update(YY.C.DT); m.step(YY.C.DT); t += YY.C.DT;
      for (const e of m.events) {
        if (e.type === 'skill' && e.p === 0) { uses++;skills.add(e.id); }
        if (e.type === 'skillFail' && e.p === 0) fails++;
        if (e.type === 'point') { pts++; if (e.reason === '出界') outs++; }
      }
      m.events.length = 0;
      peakCoins=Math.max(peakCoins,m.players[0].market?.coins||0);
      if(!Number.isFinite(m.shuttle.x+m.shuttle.y) || m.players.some(p=>!Number.isFinite(p.x+p.y) || p.energy<0 || p.energy>100.001))throw Error('Invalid state: '+a+'/'+level);
    }
    if (m.winner === 0) wins++;
    if(m.winner<0)throw Error('Match did not finish: '+a+'/'+level);
  }
  table[a] = { wins:wins+'/'+games, skillUses:uses, skills:[...skills].join(','), invalidCasts:fails, peakCoins, outRate:(outs/pts).toFixed(2) };
}
console.table(table);
