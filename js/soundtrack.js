/* Original court suite. Only metadata and scene direction run on the device;
 * composition, synthesis and mastering live in tools/compose-score.js. */
(function(G) {
  'use strict';
  const RATE = 44100, REVISION = 'court-suite-2';
  // id, title, bpm, tonic, mode, ensemble, bars, package, listening level
  const rows = [
    ['menu', '羽跃 · 今天也要上场', 104, 60, 'major', 'city', 32, 0, .27],
    ['practice', '把这一拍接稳', 92, 62, 'major', 'lofi', 24, 0, .24],
    ['arena', '开场哨之后', 120, 60, 'major', 'breaks', 32, 0, .28],
    ['sunset', '落日边线', 96, 57, 'major', 'guitar', 32, 1, .26],
    ['neon', '霓虹追球', 128, 57, 'minor', 'electro', 32, 1, .27],
    ['bamboo', '竹影随拍', 100, 62, 'pentatonic', 'bamboo', 32, 1, .27],
    ['harbor', '海风过网', 108, 65, 'major', 'island', 32, 2, .27],
    ['aurora', '极光下的羽毛', 88, 59, 'major', 'ambient', 32, 2, .25],
    ['clutch', '最后一分', 136, 62, 'minor', 'drive', 24, 2, .29],
    ['victory', '这一刻属于你', 116, 60, 'major', 'celebrate', 16, 3, .27],
    ['defeat', '下一球再见', 84, 57, 'minor', 'piano', 16, 3, .24],
    ['pause', '场边呼吸', 80, 60, 'major', 'ambient', 16, 3, .21],
    ['rally', '来回之间', 126, 60, 'major', 'breaks', 24, 4, .28],
    ['story-day', '鹅湾的风', 90, 60, 'major', 'guitar', 32, 4, .20],
    ['story-night', '十六根羽毛 · 回声', 76, 60, 'major', 'piano', 24, 4, .19],
  ];
  const TRACKS = Object.fromEntries(rows.map(([id,title,bpm,key,mode,ensemble,bars,pack,gain]) => {
    const root = 'court-score-' + pack;
    return [id, { id,title,bpm,key,mode,ensemble,bars,root,gain,duration:bars*240/bpm,
      src:'assets/audio/score/bgm-'+id+'.mp3', format:'mp3', sampleRate:RATE, channels:2 }];
  }));
  const matchOf = app => app.isOnline?.() ? app.view : app.match;
  function scene(app) {
    const m = matchOf(app);
    if (app.screen === 'result') {
      const won = typeof app.result?.won === 'boolean' ? app.result.won : app.mode === 'local' || m?.winner === (app.mode === 'guest' ? 1 : app.playerIndex || 0);
      return won ? 'victory' : 'defeat';
    }
    if (app.paused && app.mode !== 'attract') return 'pause';
    if (app.mode === 'story' && app.screen) {
      const line = app.dlg?.lines?.[app.dlg.i], meta = line?.[4];
      // Deliberate silence and chapter piano reveals remain audible on their own.
      if (app.screen === 'dialog' && (meta?.silent || meta?.intro || (app.story?.st?.id === '11-5' && line?.[1] === '我喜欢你。'))) return null;
      const backdrop = app.dlg?.scene || app.dlg?.step?.scene || app.activity?.step?.scene || app.story?.st?.scene || '';
      return /night|rain|memory|winter|jar|backroom/.test(backdrop) ? 'story-night' : 'story-day';
    }
    if (app.mode === 'practice' && !app.screen) return 'practice';
    if (app.screen || app.mode === 'attract') return 'menu';
    if (m && m.phase !== 'over' && Math.max(...(m.score || [0,0])) >= (m.opt?.target || 7)-1) return 'clutch';
    if (m?.phase === 'rally' && m.rally >= 10) return 'rally';
    return TRACKS[app.R?.venueId] ? app.R.venueId : 'arena';
  }
  // Hysteresis belongs to the listening session, never the deterministic match.
  function createDirector() {
    let current = null, elapsed = 0, quiet = 0, match;
    return { update(app, dt = 0) {
      const next = scene(app), m = matchOf(app), step = Math.min(.25, Math.max(0, Number.isFinite(dt) ? dt : 0));
      elapsed += step;
      if (m !== match) { match = m; current = null; elapsed = quiet = 0; }
      const inCourt = !app.screen && !app.paused && !['practice','attract'].includes(app.mode);
      if (current === 'rally' && next !== 'rally' && next !== 'clutch' && inCourt) {
        quiet += step;
        if (elapsed < 8 || quiet < 3) return current;
      } else quiet = 0;
      if (next !== current) { current = next; elapsed = quiet = 0; }
      return current;
    } };
  }
  const api = { RATE, REVISION, TRACKS, scene, createDirector };
  if (G.YY) G.YY.Soundtrack = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof window !== 'undefined' ? window : globalThis);
