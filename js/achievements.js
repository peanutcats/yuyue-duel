/* 人机挑战 · 跨端共用的胜场、称号与赛前荣誉展示。 */
(function (G) {
  'use strict';
  const YY = G.YY;
  const LEVELS = [
    { id: 'easy', name: '简单', color: '#5fe3a1', names: ['全场新锐', '球馆熟客', '热身之王'] },
    { id: 'normal', name: '普通', color: '#5fd4ff', names: ['破阵高手', '百战精英', '球场宗师'] },
    { id: 'hard', name: '困难', color: '#ff9a52', names: ['强敌征服者', '巅峰战将', '不败传说'] },
    { id: 'nightmare', name: '噩梦', color: '#bfacff', names: ['噩梦终结者', '噩梦无双', '永夜主宰'] },
  ];
  const TITLES = [{ id: 'first-win', name: '初战告捷', level: null, need: 1, rank: 1, color: '#ffcf4a', legend: false }];
  for (const [i, lv] of LEVELS.entries()) for (const [j, need] of [1, 3, 10].entries()) {
    TITLES.push({ id: lv.id + '-' + need, name: lv.names[j], level: lv.id, need, rank: (i + 1) * 100 + j, color: lv.color, legend: lv.id === 'nightmare' });
  }
  const titleById = id => TITLES.find(t => t.id === id);
  YY.titleId=id=>typeof id==='string'&&titleById(id)?id:null;
  YY.titleIds=ids=>[0,1].map(i=>YY.titleId(ids?.[i]));
  const matches = new WeakMap();
  const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const empty = () => ({ wins: Object.fromEntries(LEVELS.map(l => [l.id, {}])), unlocked: {}, equipped: null });
  const totalOf = d => LEVELS.reduce((sum, l) => sum + Object.values(d.wins[l.id]).reduce((a, b) => a + b, 0), 0);
  const earned = (d, t) => t.level ? YY.CHARS.every(c => (d.wins[t.level][c.id] || 0) >= t.need) : totalOf(d) >= t.need;
  const unlock = (d, now) => {
    const fresh = TITLES.filter(t => !owns(d.unlocked, t.id) && earned(d, t));
    for (const t of fresh) d.unlocked[t.id] = now;
    const best = fresh.reduce((a, b) => !a || b.rank > a.rank ? b : a, null);
    if (best && best.rank > (titleById(d.equipped)?.rank || 0)) d.equipped = best.id;
    return fresh;
  };
  YY.AIChallenge = {
    levels: LEVELS, titles: TITLES, empty, title: titleById,
    clean(raw) {
      const d = empty();
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return d;
      for (const l of LEVELS) for (const c of YY.CHARS) {
        const n = raw.wins?.[l.id]?.[c.id];
        if (Number.isSafeInteger(n) && n > 0) d.wins[l.id][c.id] = Math.min(n, 999999);
      }
      for (const t of TITLES) {
        const stamp = raw.unlocked?.[t.id];
        if (Number.isSafeInteger(stamp) && stamp >= 0) d.unlocked[t.id] = stamp;
      }
      d.equipped = typeof raw.equipped === 'string' && owns(d.unlocked, raw.equipped) ? raw.equipped : null;
      unlock(d, Date.now());
      return d;
    },
    get data() { return YY.Profile.d.aiChallenges; },
    wins(level, char) { return this.data.wins[level]?.[char] || 0; },
    total() { return totalOf(this.data); },
    has(id) { return !!titleById(id) && owns(this.data.unlocked, id); },
    equipped() { return this.has(this.data.equipped) ? titleById(this.data.equipped) : null; },
    equip(id) {
      if (id !== null && !this.has(id)) return false;
      this.data.equipped = id; YY.Profile.save(); return true;
    },
    description(t) { return t.level ? `${LEVELS.find(l => l.id === t.level).name}难度 · 全部 ${YY.CHARS.length} 位角色各击败 ${t.need} 次` : '在人机对战中赢下首场完整比赛'; },
    progress(t) {
      if (!t.level) return { current: Math.min(t.need, this.total()), total: t.need, cleared: this.total() ? 1 : 0 };
      return { current: YY.CHARS.reduce((sum, c) => sum + Math.min(t.need, this.wins(t.level, c.id)), 0), total: YY.CHARS.length * t.need, cleared: YY.CHARS.filter(c => this.wins(t.level, c.id) >= t.need).length };
    },
    next(level) { return TITLES.find(t => t.level === level && !this.has(t.id)) || TITLES.filter(t => t.level === level)[2]; },
    /** 记录实际开局时的对手与难度，不受赛后菜单选择影响。 */
    begin(match, char, level) {
      if (LEVELS.some(l => l.id === level) && YY.CHARS.some(c => c.id === char)) matches.set(match, { char, level, result: null });
    },
    finish(match, mode) {
      const run = matches.get(match);
      if (mode !== 'ai' || !run || match.practice || !['point', 'over'].includes(match.phase) || ![0, 1].includes(match.winner)) return null;
      if (run.result) return run.result;
      const { char, level } = run, won = match.winner === 0;
      const score = match.score[match.winner], other = match.score[1 - match.winner];
      if (!match.score.every(n => Number.isSafeInteger(n) && n >= 0) || score < match.opt.target || !(score >= match.opt.cap || score - other >= 2)) return null;
      let rewards = [];
      if (won) {
        this.data.wins[level][char] = Math.min(999999, this.wins(level, char) + 1);
        rewards = unlock(this.data, Date.now()); YY.Profile.save();
      }
      run.result = { won, char, level, wins: this.wins(level, char), rewards, equipped: this.equipped() };
      return run.result;
    },
    resultText(r) {
      if (!r) return '';
      if (r.rewards.length) return '称号解锁 · ' + r.rewards.map(t => t.name).join(' / ') + (r.rewards.some(t => t.id === r.equipped?.id) ? ' · 已自动佩戴' : '');
      const lv = LEVELS.find(l => l.id === r.level).name;
      return r.won ? `${YY.charName(r.char)} · ${lv}胜场 +1，累计 ${r.wins} 胜` : `${YY.charName(r.char)} · ${lv}累计 ${r.wins} 胜，再接再厉`;
    },
    /** 羽冠徽记：赛前特写与挑战页共享的矢量图形。 */
    drawCrest(g, x, y, size, title, time = 0) {
      const color = title?.color || '#bfacff';
      g.save(); g.translate(x, y); g.scale(size / 100, size / 100);
      if (title?.legend) {
        g.save(); g.rotate(Math.sin(time * .6) * .1); g.strokeStyle = color; g.lineWidth = 1; g.globalAlpha = .4;
        for (const r of [43, 49]) { g.beginPath(); g.arc(0, 0, r, .15, Math.PI * 1.65); g.stroke(); }
        for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6 + time * .12; g.fillStyle = i % 3 ? color : '#ffdf8a'; g.fillRect(Math.cos(a) * 49 - 1, Math.sin(a) * 49 - 1, 2, 2); } g.restore();
      }
      for (const side of [-1, 1]) {
        g.save(); g.scale(side, 1); g.strokeStyle = color; g.lineWidth = 2; g.lineCap = 'round';
        g.beginPath(); g.moveTo(2, 34); g.quadraticCurveTo(42, 25, 35, -15); g.stroke();
        for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(22 + i * 3.2, 24 - i * 8); g.quadraticCurveTo(42, 24 - i * 8, 43 - i, 8 - i * 8); g.quadraticCurveTo(28, 9 - i * 6, 22 + i * 3.2, 24 - i * 8); g.fillStyle = color; g.globalAlpha = .35 + i * .1; g.fill(); }
        g.restore();
      }
      g.fillStyle = color; g.beginPath(); g.moveTo(-22, -19); g.lineTo(-13, -9); g.lineTo(0, -31); g.lineTo(13, -9); g.lineTo(22, -19); g.lineTo(17, 8); g.lineTo(-17, 8); g.closePath(); g.fill();
      g.fillStyle = '#10162d'; g.fillRect(-13, 0, 26, 3);
      g.strokeStyle = '#fff1c6'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 13); g.lineTo(0, 29); g.moveTo(-8, 21); g.lineTo(8, 21); g.stroke();
      g.restore();
    },
  };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof window !== 'undefined' ? window : globalThis);
