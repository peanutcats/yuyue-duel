/* 网页端挑战殿堂。规则和存档全部由 achievements.js 提供。 */
(function (G) {
  'use strict';
  const app = G.App, YY = G.YY, C = YY.AIChallenge;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  document.querySelectorAll('[data-ai-challenges]').forEach(b => b.addEventListener('click', () => { YY.Audio.click(); app.openAIChallenges(b.dataset.aiChallenges); }));
  $('challengeBack').onclick = () => app.show(app.challengeBack || 'ai');
  $('challengeUnequip').onclick = () => { C.equip(null); app.renderChallenges(); };
  const show = app.show;
  app.show = function (name) { if (name === 'challenges') { this.renderChallenges(); $('challengeContent').scrollTop = 0; } show.call(this, name); };
  app.renderChallenges = function () {
    const equipped = C.equipped(), preview = equipped || C.title('nightmare-1');
    $('challengeSummary').textContent = `${C.total()} 场胜利 · 已获得 ${C.titles.filter(t => C.has(t.id)).length} / ${C.titles.length} 个称号`;
    $('challengeHeroLabel').textContent = equipped ? '当前佩戴 · 开局荣耀登场' : '传说目标 · 等你加冕';
    $('challengeHeroName').textContent = preview.name;
    $('challengeHeroName').style.color = preview.color;
    $('challengeHeroNote').textContent = equipped ? C.description(equipped) : '噩梦难度击败每一位角色，让所有噩梦到此为止。';
    $('challengeUnequip').classList.toggle('hidden', !equipped);
    const canvas = $('challengeCrest'), g = canvas.getContext('2d'); g.clearRect(0, 0, 200, 200); C.drawCrest(g, 100, 100, 180, preview, 1);
    const level = this.challengeLevel || 'nightmare', collection = level === 'titles';
    $('challengeTabs').innerHTML = [...C.levels.map(l => ({ id: l.id, name: l.name, color: l.color })), { id: 'titles', name: '称号陈列', color: '#ffcf4a' }].map(l => `<button data-challenge-tab="${l.id}" class="${level === l.id ? 'on' : ''}" style="--honor:${l.color}" aria-pressed="${level === l.id}">${l.name}</button>`).join('');
    const content = $('challengeContent');
    if (collection) {
      content.innerHTML = '<div class="title-collection">' + C.titles.map(t => {
        const has = C.has(t.id), on = equipped?.id === t.id, p = C.progress(t);
        return `<article class="title-item ${has ? 'owned' : ''} ${t.legend ? 'legend' : ''}" style="--honor:${t.color}"><small>${t.legend ? '传说' : '挑战'}称号 · ${has ? '已解锁' : `${p.current} / ${p.total}`}</small><h3>${t.name}</h3><p>${C.description(t)}</p><button class="btn" data-equip-title="${t.id}" ${!has || on ? 'disabled' : ''}>${on ? '佩戴中' : has ? '佩戴称号' : '尚未解锁'}</button></article>`;
      }).join('') + '</div>';
    } else {
      const goal = [1, 3, 10].includes(this.challengeNeed) ? this.challengeNeed : C.next(level).need;
      const titles = C.titles.filter(t => t.level === level), selected = titles.find(t => t.need === goal), progress = C.progress(selected);
      const chars = YY.CHARS.filter(c => !this.challengeMissing || C.wins(level, c.id) < goal);
      content.innerHTML = '<div class="challenge-milestones">' + titles.map(t => {
        const p = C.progress(t), has = C.has(t.id);
        return `<button class="challenge-milestone ${goal === t.need ? 'on' : ''}" style="--honor:${t.color}" data-challenge-goal="${t.need}" aria-pressed="${goal === t.need}"><small>全角色各胜 ${t.need} 次</small><b>${t.name}</b><span class="honor-bar"><i style="width:${p.current / p.total * 100}%"></i></span><span>${has ? '✓ 称号已解锁' : `${p.current} / ${p.total} 场 · ${p.cleared} / ${YY.CHARS.length} 位达标`}</span></button>`;
      }).join('') + '</div>' +
      `<div class="challenge-roster-heading"><b>角色战绩 <small>${progress.cleared} / ${YY.CHARS.length} 位达标</small></b><button class="btn" id="challengeMissing" aria-pressed="${!!this.challengeMissing}">${this.challengeMissing ? '显示全部角色' : '只看未完成'}</button>${C.has(selected.id) ? `<button class="btn" data-equip-title="${selected.id}" ${equipped?.id === selected.id ? 'disabled' : ''}>${equipped?.id === selected.id ? '佩戴中' : '佩戴此称号'}</button>` : ''}</div>` +
      '<div class="challenge-roster">' + chars.map(c => {
        const n = C.wins(level, c.id), done = n >= goal;
        return `<article class="challenge-opponent ${done ? 'done' : ''}" style="--honor:${selected.color}"><img src="${app.charURL(c.id)}" alt=""><div><b>${esc(YY.charName(c.id))}</b><small>${n} 胜 · ${done ? '✓ 已达标' : `还差 ${goal - n} 胜`}</small><span class="honor-bar"><i style="width:${Math.min(1, n / goal) * 100}%"></i></span></div><button class="btn" data-challenge-char="${c.id}">${done ? '再挑战' : '挑战'}</button></article>`;
      }).join('') + (chars.length ? '' : '<p class="challenge-empty">全部角色已达标，新的称号已收入陈列。</p>') + '</div>';
      $('challengeMissing').onclick = () => { this.challengeMissing = !this.challengeMissing; this.renderChallenges(); };
    }
    document.querySelectorAll('[data-challenge-tab]').forEach(b => b.onclick = () => { this.challengeLevel = b.dataset.challengeTab; this.challengeNeed = null; this.renderChallenges(); $('challengeContent').scrollTop = 0; });
    document.querySelectorAll('[data-challenge-goal]').forEach(b => b.onclick = () => { this.challengeNeed = Number(b.dataset.challengeGoal); this.renderChallenges(); });
    document.querySelectorAll('[data-equip-title]').forEach(b => b.onclick = () => { if (C.equip(b.dataset.equipTitle)) this.renderChallenges(); });
    document.querySelectorAll('[data-challenge-char]').forEach(b => b.onclick = () => this.challengeAI(b.dataset.challengeChar, level));
  };
})(window);
