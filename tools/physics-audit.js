'use strict';
// Reproducible audit: node tools/physics-audit.js [directory containing core/match/ai/char.js]
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const dir = path.resolve(process.argv[2] || path.join(__dirname, '../js'));
let seed = 20261104;
const math = Object.create(Math); math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed + .5) / 4294967296; };
const context = vm.createContext({ Math: math, performance });
for (const file of ['core', 'match', 'ai', 'char']) vm.runInContext(fs.readFileSync(path.join(dir, file + '.js'), 'utf8'), context);
const Y = context.YY, C = Y.C, report = {};
// Independent RK4 reference for smooth airborne motion; no production stepping
// or production collision/target solvers are used for this reference.
function reference(initial, env) {
  let q = initial.slice(); const dt = 1 / 4800, d = env?.drag ?? .08, wind = env?.wind || 0;
  const f = ([x, y, vx, vy]) => { const k = d * Math.hypot(vx - wind, vy); return [vx, vy, -k * (vx - wind), -9.8 - k * vy]; };
  const plus = (a, b, k) => a.map((v, i) => v + b[i] * k);
  for (let i = 0; i < 4800; i++) {
    const a = f(q), b = f(plus(q, a, dt / 2)), c = f(plus(q, b, dt / 2)), e = f(plus(q, c, dt));
    q = q.map((v, j) => v + dt / 6 * (a[j] + 2 * b[j] + 2 * c[j] + e[j]));
  }
  return q;
}
const errors = [];
for (const env of [null, { wind: 2.5 }, { drag: .066, wind: -1.6 }]) for (const [vx, vy] of [[20, 9], [32, -4], [8, 17]]) {
  const initial = [-2, 20, vx, vy], ref = reference(initial, env);
  const s = { x: initial[0], y: initial[1], vx, vy, netHit: true };
  for (let i = 0; i < 120; i++) Y.stepShuttle(s, C.DT, env);
  errors.push(Math.hypot(s.x - ref[0], s.y - ref[1]));
}
report.flight = { reference: 'RK4, 4800 Hz, 1 second, 9 velocity/environment cases', maximumPositionErrorMetres: Math.max(...errors) };
const s = { x: 6.7, y: .075, vx: 10, vy: -4, netHit: true };
for (let i = 0; i < 20; i++) if (Y.stepShuttle(s, C.DT, { drag: 0 }) === 'floor') break;
const hitTime = (Math.sqrt(16 + 2 * C.G * (.075 - C.SHUTTLE_R)) - 4) / C.G;
report.floor = { expectedFirstContactX: 6.7 + 10 * hitTime, actualContactX: s.x, actualCorkHeight: s.y, calledIn: s.x <= C.HALF + C.LINE_TOL };
const m = new Y.Match(); m.phase = 'rally'; const p = m.players[0]; p.x = -3;
Object.assign(m.shuttle, { x: -1.98, y: 1.42, vx: -55, vy: 0, speed: 55, live: true, held: false, lastHitter: 1, crossedNet: true });
p.swing = { t: .1, btn: 'clear', kind: 'side', dur: .3, hit: false, prevE: 99 }; m.step(C.DT);
report.fastContact = { hitsInCrossingStep: m.hitCount, quality: m.events.find(e => e.type === 'hit')?.q ?? null };
const k = new Y.Match(); k.phase = 'rally'; const attacker = k.players[0]; attacker.x = -1; attacker.stamina = 0;
Object.assign(k.shuttle, { x: -.5, y: 1.9, speed: 5, live: true, held: false, lastHitter: 1, crossedNet: true });
attacker.swing = { t: .11, btn: 'smash', kind: 'side', dur: .3 }; k.doHit(attacker, attacker.swing, 0, C.REACH);
report.exhaustion = { shot: k.shuttle.shot, stamina: attacker.stamina };
const originalSimulate = Y.simulate; let solves = 0;
Y.simulate = (...args) => { solves++; return originalSimulate(...args); };
const speed = Y.solveSpeed(-3, 2.5, 1, 50, 8.5);
report.solver = { targetDistance: 8.5, trajectoryEvaluations: solves, speed };
Y.simulate = originalSimulate;
seed = 20261104;
const start = performance.now(), games = [], shots = {}; let points = 0, rally = 0, qualities = 0, hits = 0;
for (let i = 0; i < 8; i++) {
  const m = new Y.Match({ firstServer: i % 2 });
  const ais = [new Y.AI(m, 0, 'normal'), new Y.AI(m, 1, i % 2 ? 'hard' : 'normal')];
  let ticks = 0;
  while (m.phase !== 'over' && ticks < 120 * 900) {
    ais.forEach(a => a.update(C.DT)); m.step(C.DT); ticks++;
    for (const e of m.events.splice(0)) {
      if (e.type === 'hit') { shots[e.shot] = (shots[e.shot] || 0) + 1; qualities += e.q; hits++; }
      if (e.type === 'point') { points++; rally += e.rally; }
    }
    if (![m.shuttle.x, m.shuttle.y, ...m.players.map(p => p.stamina)].every(Number.isFinite)) throw Error('Non-finite simulation state');
  }
  games.push({ score: [...m.score], finished: m.phase === 'over', simulatedSeconds: ticks / 120, longestRally: m.longest });
}
report.matches = { games, points, hits, meanRally: rally / points, meanQuality: qualities / hits, shotTypes: shots, elapsedMs: performance.now() - start };
console.log(JSON.stringify(report, null, 2));
