/* Shared authoritative snapshot format. */
(function (G) {
  'use strict';
  const YY = G.YY;
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const KIND = ['over', 'side', 'under'];
  // 当前生效的技能 / 状态（用于好友端绘制光环与特效）
  const buffOf = (p) => { const b = p.buff || {}; const k = Object.keys(b).filter((x) => b[x] > 0); return [k.join(','), k.length ? r3(Math.max(...k.map((x) => b[x]))) : 0]; };
  YY.snapshot = function (m, events, now = performance.now() / 1000) {
    return {
      t: 'st', nt: now, ht: r3(m.time), ph: m.phase, sc: m.score.slice(), sv: m.server, st: r3(m.serveT), sg: m.serving ? 1 : 0,
      ry: m.rally, w: m.winner, names: m.names, hc: m.hitCount,
      p: m.players.map((p) => [
        r3(p.x), r3(p.y), r3(p.vx), r3(p.vy), p.onGround ? 1 : 0, Math.round(p.stamina),
        p.swing ? [r3(p.swing.t), KIND.indexOf(p.swing.kind), p.swing.dur, p.swing.serve ? 1 : 0,
          p.swing.contact ? [r3(p.swing.contact.x), r3(p.swing.contact.y), r3(p.swing.contact.t)] : null] : 0,
        r3(p.runPhase), r3(p.flash), r3(p.land),
      ]),
      s: [r3(m.shuttle.x), r3(m.shuttle.y), r3(m.shuttle.vx), r3(m.shuttle.vy), m.shuttle.live ? 1 : 0, m.shuttle.held ? 1 : 0, r3(m.shuttle.speed || 0), m.shuttle.lastHitter, m.shuttle.netHit ? 1 : 0, m.shuttle.crossedNet ? 1 : 0],
      lm: m.landMark ? [r3(m.landMark.x), m.landMark.inB ? 1 : 0, r3(m.landMark.t)] : 0,
      pl: m.pred && m.shuttle.live ? r3(m.pred.landX) : null,
      fx: [m.players.map(p => [Math.round(p.energy || 0), ...buffOf(p)]), r3(m.slowT || 0), m.slowFor ?? -1, m.shuttle.fire ? 1 : 0, r3(m.shuttle.feint || 0), m.shuttle.meteor ? 1 : 0, m.skillsOn ? 1 : 0],
      ev: events,
      // Full precision local-player state for visual prediction; never accepted from clients.
      pp: m.players.map(p => ({ ...p, swing: p.swing ? { ...p.swing } : null })),
      hs: m.hitstop, im: m.inputs.map(i => i.move),
      rtt: 0,
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
