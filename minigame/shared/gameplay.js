/* Shared match and story orchestration. Both browser and WeChat use these methods. */
(function (G) {
  'use strict';
  G.YY.createGameplay = function (schedule) {
    const YY = G.YY, C = YY.C, A = YY.Audio;
    const setTimeout = schedule || ((fn, ms) => G.setTimeout(fn, ms));
    return {
      ...YY.storyActions,
      myLoadout(avoid, as) {
      if (as && YY.CHARS.some(c => c.id === as)) { // 剧情指定上场的队友：保留自己的装备
        const sel = Object.assign({}, YY.Profile.sel, { char: as });
        if (!YY.Profile.canTune()) sel.tension = YY.TENSION.def;
        return { id: as, stats: YY.buildStats(sel), skill: YY.skillSet(as, YY.Profile.kit(as)), look: YY.lookOf(as), forced: true };
      }
      let id = YY.Profile.sel.char;
      if (!YY.Profile.has('char', id)) id = 'lingfeng';
      const st = YY.Profile.stats();
      if (id === avoid) { // 与对手同一角色时换成主角凌风（保留装备）
        const sel = Object.assign({}, YY.Profile.sel, { char: id === 'lingfeng' ? 'canglan' : 'lingfeng' });
        if (!YY.Profile.canTune()) sel.tension = YY.TENSION.def;
        return { id: sel.char, stats: YY.buildStats(sel), skill: YY.skillSet(sel.char, YY.Profile.kit(sel.char)), look: YY.lookOf(sel.char) };
      }
      return { id, stats: st, skill: YY.skillSet(id, YY.Profile.kit(id)), look: YY.lookOf(id) };
    },
      oppLoadout(id, mix) {
      // 快速对战的对手随机携带 3 选 2 的技能组合；故事里固定为前两个
      const acts = YY.char(id).acts || [];
      const pick = mix && acts.length > 2 ? acts.filter((_, i) => i !== Math.floor(Math.random() * acts.length)) : null;
      return { id, stats: YY.buildStats({ char: id, racket: 'r_basic', string: 's_dur', shoe: 'sh_basic', tension: 24 }), skill: YY.skillSet(id, pick), look: YY.lookOf(id) };
    },
      startAI(level) {
      this.reset();
      this.mode = 'ai';
      this.level = level;
      const lv = YY.AI_LEVELS[level];
      const mine = this.myLoadout();
      const pool = YY.CHARS.filter((c) => c.id !== mine.id);
      const opp = this.oppLoadout(pool[Math.floor(Math.random() * pool.length)].id, true);
      const skills = this.settings.skills;
      this.match = new YY.Match({
        names: ['你', opp.look.name + ' · ' + lv.name], firstServer: 0,
        looks: [mine.look, opp.look], stats: [mine.stats, opp.stats], skills: skills ? [mine.skill, opp.skill] : null,
      });
      this.ais = [new YY.AI(this.match, 1, level, opp.id)];
      this.ctrlFor[0] = this.soloCtrl(true, skills ? mine.skill.act : null);
      this.enterGame();
      const style = YY.AI_STYLES[opp.id];
      const oppKit = skills ? ' · 携带 ' + opp.skill.act.map(k => YY.SKILLS[k].name).join('、') : '';
      this.R.showBanner(opp.look.name + ' · ' + style.name, style.weakness + oppKit, '#ffd23f', 3.3);
    },
      startPractice(drill) {
      this.reset();
      this.mode = 'practice';
      this.drill = drill;
      const mine = this.myLoadout();
      this.match = new YY.Match({ names: ['你', '发球机'], practice: true, looks: [mine.look, null], stats: [mine.stats, null] });
      this.practice = drill === 'tactics' ? new YY.TacticsPractice(this.match) : new YY.Practice(this.match, drill);
      this.ctrlFor[0] = this.soloCtrl(true);
      this.enterGame();
    },
      finishTactics() { if (this.mode !== 'practice' || !this.practice?.tutorial || !this.practice.done) return; this.paused = true; this.show('tacticsComplete'); },
      attractEvent(e, m) {
      // 背景演示：只保留视觉效果
      const R = this.R;
      if (e.type === 'hit') { R.hitFx(e); if (e.shot === 'smash') { R.shake = 0.4; R.flash = 0.08; } }
      if (e.type === 'net') R.netFx(e);
      if (e.type === 'point') { R.landFx(e.x, e.inB); R.pointFx(e.winner, m, '得分！'); }
      if (e.type === 'jump') R.dust(m.players[e.p].x, 4);
    },
      handleEvent(e, m) {
      const R = this.R;
      const P = m.players;
      switch (e.type) {
        case 'hit': {
          if (e.feed) { A.hit(0.5, false, e); break; }
          const smash = e.shot === 'smash' || e.shot === 'halfsmash';
          A.hit(e.q, smash || e.shot === 'kill', e);
          R.hitFx(e);
          const p = P[e.p];
          if (smash) {
            R.popText((e.shot === 'halfsmash' ? '点杀 ' : '扣杀 ') + Math.round(e.speed * 3.6 * C.SPEED_DISPLAY) + ' km/h', e.x, e.y + 0.3, '#ffb347', e.shot === 'halfsmash' ? 1.05 : 1.35, 1.2);
          } else if (!e.serve || this.isMe(e.p)) {
            const col = e.q >= 0.85 ? '#7dffb0' : e.q >= 0.6 ? '#ffffff' : e.q >= 0.35 ? '#ffd23f' : '#ff9b7b';
            const show = this.isMe(e.p) || e.q >= 0.85 || e.weak;
            if (show) R.popText(e.name + (e.label ? ' · ' + e.label : ''), p.x, p.y + 2.25, col, 0.75, 1.0);
          }
          if (e.reason && this.isMe(e.p)) R.popText(e.reason + ' → ' + e.name, p.x, p.y + 2.75, '#ff9b7b', 0.7, 1.4);
          if (e.save) { R.popText('漂亮接杀！', p.x, p.y + 2.8, '#5cf2ff', 1.1, 1.3); }
          else if (e.lowSave) R.popText('极限救球！', p.x, p.y + 2.8, '#5cf2ff', 1.0, 1.2);
          if (e.burned) R.popText('被烈焰压制！', p.x, p.y + 3.2, '#ff8a2a', 0.9, 1.2);
          if (e.skill === 'pokong') { R.popText('破空！', e.x, e.y + 0.5, '#ff6a52', 1.3, 1.0); R.burst(e.x, e.y, 24, '255,120,90', 8, 0.05); }
          else if (e.skill === 'lieyan') { R.popText('最优解！', e.x, e.y + 0.5, '#ff8a2a', 1.2, 1.0); R.burst(e.x, e.y, 36, '255,140,40', 10, 0.06); R.shake = 1.2; }
          else if (e.skill === 'jinghua') R.popText('幻影！', e.x, e.y + 0.5, '#9ff0ff', 1.2, 1.0);
          else if (e.skill === 'liuxing') { R.popText('流星坠！', e.x, e.y + 0.5, '#ffe27a', 1.2, 1.0); R.burst(e.x, e.y, 20, '255,226,122', 7, 0.04); }
          else if (e.skill === 'jiaoke' && this.isMe(e.p) && e.q >= 0.85) R.popText('教科书！', e.x, e.y + 0.5, '#7dffb0', 0.9, 0.8);
          else if (e.skill === 'touji') { R.popText('健身房爆发！', e.x, e.y + 0.5, '#ff5d8f', 1.25, 1.0); R.burst(e.x, e.y, 32, '255,93,143', 9, 0.06); R.shake = 1; }
          else if (e.skill === 'shuju') R.popText('数据命中', e.x, e.y + 0.5, '#6fe3d0', 1.0, 0.9);
          else if (e.skill === 'shanxian' && this.isMe(e.p)) R.popText('闪现反打', e.x, e.y + 0.5, '#ffb347', 0.9, 0.8);
          else if (e.skill === 'fantan') { R.popText('包子反弹！', e.x, e.y + 0.5, '#ff7a1a', 1.2, 1.0); R.burst(e.x, e.y, 28, '255,122,26', 9, 0.06); R.shake = 0.8; }
          else if (e.skill && YY.SKILLS[e.skill] && YY.SKILLS[e.skill].pop && !e.guard) { const sk = YY.SKILLS[e.skill]; R.popText(sk.pop, e.x, e.y + 0.5, sk.color, 1.1, 1.0); R.burst(e.x, e.y, 20, [1, 3, 5].map((i) => parseInt((sk.color + '000000').slice(i, i + 2), 16) || 255).join(','), 7, 0.04); }
          if (e.cursed) R.popText('404：回球丢失', p.x, p.y + 3.2, '#4f86e0', 0.9, 1.2);
          if (e.shot === 'kill') { R.popText('扑球！', e.x, e.y + 0.6, '#ff6b6b', 1.25, 1.0); }
          else if (e.shot === 'tumble' && (this.isMe(e.p) || e.q >= 0.85)) R.popText('搓球', e.x, e.y + 0.5, '#d2b4ff', 0.9, 0.9);
          if (e.hurt) R.popText('软绵绵…', p.x, p.y + 3.2, '#ffe27a', 0.85, 1.1);
          if (e.tumbled && this.isMe(e.p)) R.popText('球在翻滚，难处理！', p.x, p.y + 3.2, '#d2b4ff', 0.75, 1.1);
          if (this.isMe(e.p) && this.hitHaptic) this.hitHaptic(smash || e.shot === 'kill' ? 'heavy' : e.q >= 0.85 ? 'medium' : null);
          break;
        }
        case 'skill': {
          const p = P[e.p], sk = YY.SKILLS[e.id];
          // Unknown effects must not abort the frame and stop online heartbeats.
          if (!p || !sk) break;
          const look = R.lookOf(m, e.p);
          A.skill(e.id);
          if (this.mode === 'story' && this.storyX && e.p === 0) this.storyX.skill = (this.storyX.skill || 0) + 1;
          R.skillCutIn(look, sk, (e.p === 0) !== R.mirror);
          R.burst(p.x, p.y + 1, 30, [1, 3, 5].map((i) => parseInt(sk.color.slice(i, i + 2), 16)).join(','), 6, 0.05);
          R.ring(p.x, 0, '255,255,255', 0.5, 0.6, true);
          if (e.id === 'lengxiao') {
            const o = P[1 - e.p];
            R.popText('哈哈哈哈！', o.x, o.y + 2.8, '#7fd6ff', 1.1, 1.6);
            R.popText(['你的步法有 bug，建议重启', '球没过网？那叫“丢包”', '我不胖，只是内存比较大'][Math.floor(m.time) % 3], p.x, p.y + 3.4, '#ffffff', 0.62, 2.2);
          }
          if (e.id === 'touji') R.popText(['先躺一下，这叫蓄力', '盯盘中……', '低买高卖，懂？'][Math.floor(m.time) % 3], p.x, p.y + 3.4, '#ffffff', 0.62, 2.0);
          if (e.id === 'shuju') R.popText(['数据已清洗', '样本量够了', '我记下你的习惯了'][Math.floor(m.time) % 3], p.x, p.y + 3.4, '#ffffff', 0.62, 2.0);
          if (e.id === 'shanxian') R.popText(['问题不大', '这波我闪现', '手速在线'][Math.floor(m.time) % 3], p.x, p.y + 3.4, '#ffffff', 0.62, 2.0);
          const QUOTES = {
            quanli: ['这一局，全力以赴！'], huiwei: ['打完就回位！'], tuichao: ['潮水退了，你还跳得动吗'], changchao: ['一浪接一浪'],
            lianzha: ['再来一个！'], gongshi: ['算好了，等它来'], cuoqiu: ['嘘——轻一点'], tianmi: ['猜猜我打哪儿？'],
            baoxian: ['放心，我兜着'], duzi: ['肚子就是缓冲垫'], huicheng: ['回城补个状态'], err404: ['你的回球：404'],
            shenglv: ['模型显示：胜率 99%'], qingxi: ['脏数据，清掉'], rebei: ['老路，网前交给你了'], wotui: ['今天练胸！'],
            tangping: ['躺平也是一种策略'], shuiyue: ['看清楚了吗？'], hanxing: ['别动'], shaosheng: ['——哔！'], baowen: ['先喝口枸杞茶'],
            liuxingyu: ['许个愿吧'], xinggui: ['追上那道光'], pingchou: ['平抽，快！'], yibo: ['一波推过去'], fantan: ['弹回去！'],
          };
          if (QUOTES[e.id]) R.popText(QUOTES[e.id][0], p.x, p.y + 3.4, '#ffffff', 0.62, 2.0);
          break;
        }
        case 'skillProc': { const p = P[e.p], sk = YY.SKILLS[e.id]; if (!p) break; R.popText(e.label, p.x, p.y + 2.9, sk ? sk.color : '#ffd23f', 0.95, 1.2); A.ready?.(); break; }
        case 'blink': {
          const p = P[e.p];
          R.burst(e.from, 1, 18, '255,179,71', 5, 0.04); R.burst(e.to, 1, 22, '255,179,71', 6, 0.05);
          R.popText(e.back ? '闪回' : '闪现！', e.to, p.y + 2.5, '#ffb347', e.back ? 0.8 : 1.0, 0.9);
          break;
        }
        case 'skillReady': if (this.isMe(e.p)) { A.ready(); R.popText('技能就绪！按 ' + (YY.isTouch() ? '技能键' : 'I / O'), P[e.p].x, P[e.p].y + 2.6, '#ffd23f', 0.8, 1.4); } break;
        case 'pdone': if (this.mode === 'story') setTimeout(() => this.stepDone(e), 900); break;
        case 'tacticsDone': if (this.mode === 'story') setTimeout(() => this.stepDone({win:true,ok:3,att:e.attempts}),900); else setTimeout(() => this.finishTactics(), 1500); break;
        case 'swing': A.swing(e.btn); break;
        case 'whiff': { const p = P[e.p]; if (this.isMe(e.p) || this.mode === 'practice') R.popText(e.label, p.x, p.y + 2.3, '#ff7b7b', 0.8, 1.1); break; }
        case 'net': A.net(); R.netFx(e); break;
        case 'jump': A.jump(); R.dust(P[e.p].x, 5); break;
        case 'land': A.land?.(); R.dust(P[e.p].x, 3); break;
        case 'tired': if (this.isMe(e.p)) R.popText('体力不足 · 跳不高', P[e.p].x, P[e.p].y + 2.3, '#ff9b7b', 0.75, 1.1); break;
        case 'read': R.popText('预判！', P[e.p].x, P[e.p].y + 2.3, '#ffd23f', 0.8, 1.0); break;
        case 'serveReady': R.trail = []; R.lastWinner = -1; break;
        case 'point': {
          A.floor();
          R.landFx(e.x, e.inB);
          const meWon = this.isMe(e.winner) && this.mode !== 'local';
          A.point?.(meWon || this.mode === 'local');
          const name = this.playerName(e.winner, m);
          let title;
          if (this.mode === 'local') title = name + ' 得分';
          else title = meWon ? '得分！' : '失分';
          if (e.rally >= 6 || m.phase === 'over') A.cheer(e.kind === 'winner' && (meWon || this.mode === 'local'));
          let sub = e.reason;
          if (e.rally >= 8) sub += ' · ' + e.rally + ' 拍回合';
          if (e.banner) sub += ' · ' + e.banner;
          R.showBanner(title, sub, R.lookOf(m, e.winner).shirt, 1.7);
          if (this.mode === 'story') this.storyPoint(e, m);
          R.pointFx(e.winner, m, this.mode === 'local' ? name + ' 得分' : meWon ? '漂亮！' : name + ' 得分');
          break;
        }
        case 'pland': A.floor(); R.landFx(e.x, e.inB); break;
        case 'pres': if (e.ok) A.success?.(); break;
        case 'over': {
          A.whistle();
          const meWin = this.mode === 'local' || this.isMe(e.winner);
          R.victoryFx(e.winner, m, this.mode === 'local' ? this.playerName(e.winner, m) + ' 获胜' : meWin ? '胜利！' : this.playerName(e.winner, m) + ' 获胜');
          if (this.mode === 'story') { setTimeout(() => this.stepDone({ win: e.winner === 0 }), 1500); break; }
          setTimeout(() => this.showResult(m), 1200);
          break;
        }
      }
    },
      tip(me, op) {
      if (!me) return '';
      if (me.errors >= 4 && me.errors > me.winners) return '提示：失误偏多。不急着扣杀，先用高远球把对手压到后场，等机会出现。';
      if (me.smash === 0) return '提示：对手挑出高球时，先起跳（W/跳）再按扣杀，能打出最有威胁的进攻。';
      if (me.smash > 0 && me.smashWin / me.smash < 0.3) return '提示：扣杀容易被接回。先吊网前把对手调上来，再扣他身后的空当。';
      if (op.smashWin >= 3) return '提示：被扣杀得分较多。回球后及时回到中场，少打半高不远的球。';
      if (me.perfect < me.hits * 0.25) return '提示：提前移动到落点，挥拍时机再晚一点点，可以打出更多“完美”击球。';
      return '提示：试试“高远 → 吊球 → 扣杀”的组合，主动调动对手制造空当。';
    },
      startStage(id) {
      const st = YY.stage(id);
      if (!st || !YY.stageOpen(id)) return;
      const cp=YY.Profile.d.campaign.checkpoint, resume=cp?.stage===id && cp.index<st.steps.length?cp:null;
      this.story = { st, i: resume?.index || 0, ctx: resume?.ctx || { pickOk: true, env: null, choices:{...YY.Profile.d.campaign.choices} }, stars: resume?.stars || [], resume };
      this.runStep();
    },
      runStep() {
      const S = this.story;
      if (!S) return;
      const step = S.st.steps[S.i];
      if (!step) { this.finishStage(); return; }
      this.saveStoryCheckpoint(S.resume && S.resume.index===S.i ? {line:S.resume.line,activity:S.resume.activity}:{});
      if (['dialog','quiz','pick','inspect','board','lab'].includes(step.t)) {
        if (this.mode !== 'attract') this.startAttract(S.st.chapter.venue);
        else if (this.R.venueId !== S.st.chapter.venue) this.R.setVenue(S.st.chapter.venue);
      }
      if (step.t === 'dialog') this.playDialog(step.lines.map(l=>[l[0],YY.storyText(l[1],S.ctx),l[2],l[3]]), () => this.nextStep(), step);
      else if (step.t === 'quiz') this.playQuiz(step);
      else if (step.t === 'pick') this.playPick(step);
      else if (step.t === 'inspect') this.playInspect(step);
      else if (step.t === 'board') this.playBoard(step);
      else if (step.t === 'lab') this.playLab(step);
      else this.startChallenge(step);
      S.resume=null;
    },
      /** 剧情演出信息：场景、在场人物、说话人与表情 */
      storyView(d, talking) {
        const step = d && d.step;
        if (!step || !step.scene || !YY.SCENES) return null;
        const i = Math.min(d.i < 0 ? 0 : d.i, step.lines.length - 1), line = step.lines[i];
        return { scene: step.scene, cast: YY.storyCast(step, i), who: line[0], mood: line[2] || null, action:line[3], lineKey:step.uid+':'+i, talking, mm: step.lines.some((l) => l[0] === 'mm') };
      },
      nextStep() { if (!this.story) return; this.story.i++; this.runStep(); },
      startChallenge(step) {
      const S = this.story;
      this.reset();
      this.mode = 'story';
      this.storyKind = step.t;
      this.storyX = { dropWin: 0, smashWin: 0, clearWin: 0, outs: 0, skill: 0, maxDown: 0 };
      this.storyDark = null;
      this.storyStep = step;
      const venue = step.venue || S.st.chapter.venue;
      if (step.t === 'match') {
        const opp = this.oppLoadout(step.opp);
        const mine = this.myLoadout(step.opp, this.storyAs(step));
        const env = step.env ? Object.assign({}, step.env) : S.ctx.env ? Object.assign({}, S.ctx.env) : null;
        this.match = new YY.Match({
          names: ['你', opp.look.name], firstServer: 0, target: step.target || 7, cap: step.cap || 11,
          looks: [mine.look, opp.look], stats: [mine.stats, opp.stats], skills: step.skills===false?null:[mine.skill, opp.skill], env,
        });
        if(step.startScore) this.match.score=[...step.startScore];
        if (step.oppEnergy && this.match.skillsOn) this.match.players[1].energy = step.oppEnergy;
        this.ais = [new YY.AI(this.match, 1, step.level || 'normal', opp.id)];
        this.ctrlFor[0] = this.soloCtrl(true, step.skills===false?null:mine.skill.act);
        if (step.dark) this.storyDark = { flash: 0, t: 3 };
        this.enterGame(venue);
        const lv = YY.AI_LEVELS[step.level || 'normal'].name;
        this.R.showBanner(`${opp.look.name} · ${YY.AI_STYLES[opp.id].name}`, (mine.forced ? `本场由你操控${mine.look.name} · ` : '') + (step.rule || YY.AI_STYLES[opp.id].weakness), '#ffd23f', 3.6);
      } else {
        const mine = this.myLoadout(null, this.storyAs(step));
        this.match = new YY.Match({ names: ['你', '发球机'], practice: true, looks: [mine.look, null], stats: [mine.stats, null] });
        if (step.t === 'drill') this.practice = new YY.Practice(this.match, step.def);
        else if (step.t === 'combo') { this.practice=new YY.TacticsPractice(this.match); this.practice.goal={need:3,total:Infinity}; }
        else if (step.t === 'footwork') { this.practice = new YY.Footwork(this.match, step.def); this.match.hideOpp = true; }
        else if (step.t === 'serve') { this.practice = new YY.ServeDrill(this.match, step.def); this.match.hideOpp = true; }
        this.ctrlFor[0] = this.soloCtrl(true);
        this.enterGame(venue);
        const g = this.practice.goal;
        this.R.showBanner((mine.forced ? mine.look.name + ' · ' : '') + step.def.name, step.t==='combo'?'完成三种球路 · 失误只重练当前一步':`目标：${g.total} ${g.unit || '球'}内成功 ${g.need} ${g.unit || '球'}`, '#ffd23f', 2.2);
      }
    },
      /** 剧情指定的上场角色：固定角色，或来自本关“谁上场”的选择 */
      storyAs(step) {
      if (!step.as) return null;
      if (step.as !== 'pick') return step.as;
      const key = step.asKey, pick = this.story.st.steps.find(s => s.t === 'pick' && s.key === key);
      const value = this.story.ctx.choices?.[key] || YY.Profile.d.campaign.choices[key];
      const opt = pick && pick.o.find(o => (o.reply || o.label) === value);
      return opt ? opt.as : null;
    },
      storyPoint(e, m) {
      const X = this.storyX, step = this.storyStep;
      if (e.winner === 0 && e.kind === 'winner') {
        const cat = YY.SHOT_CAT[e.shot];
        if (cat === 'drop') X.dropWin++;
        else if (cat === 'smash') X.smashWin++;
        else if (cat === 'clear') X.clearWin++;
      }
      if (e.loser === 0 && e.kind === 'error' && !e.inB) X.outs++;
      X.maxDown = Math.max(X.maxDown || 0, m.score[1] - m.score[0]);
      if (step && step.windFlip && m.env && m.winner < 0 && (m.score[0] + m.score[1]) % step.windFlip === 0) {
        m.env.wind = -m.env.wind;
        setTimeout(() => this.R.showBanner('风向改变！', (m.env.wind > 0) !== this.R.mirror ? '现在你是顺风：高远球收着打' : '现在你是顶风：放心发力', '#9fdcff', 1.8), 1800);
      }
    },
      stepDone(res) {
      if (this.mode !== 'story' || !this.story || this.screen === 'step') return;
      const step = this.storyStep, m = this.match;
      const r = {
        win: !!res.win, ok: res.ok, att: res.att, st: m.stats[0], score: m.score, longest: m.longest,
        x: this.storyX, pickOk: this.story.ctx.pickOk,
      };
      const goals = (step.stars || []).map((g) => ({ text: g.text, ok: r.win && !!g.test(r) }));
      const stars = r.win ? (goals.length ? 1 + goals.filter((g) => g.ok).length : 3) : 0;
      let main;
      if (step.t === 'match') main = `比分 ${m.score[0]} : ${m.score[1]} · 对手 ${m.names[1]}`;
      else main = `成功 ${res.ok} / ${res.att} ${this.practice.goal.unit || '球'} · 目标 ${this.practice.goal.need}`;
      if (r.win) A.win(); else A.lose();
      this.showStepResult({ win: r.win, stars, main, goals: [{ text: step.t === 'match' ? '赢下比赛' : `完成目标（${this.practice.goal.need} 次成功）`, ok: r.win }].concat(goals) });
    },
      stepContinue() {
      const S = this.story;
      if (!S || !this.stepRes?.win) return;
      S.stars.push(this.bestStoryStep(this.stepRes.stars));
      this.stepRes = null;
      this.paused = false;
      this.nextStep();
    },
      stepRetry() {
      const S = this.story;
      if (!S) return;
      this.stepRes = null;
      this.paused = false;
      const step = S.st.steps[S.i];
      if (step.t === 'quiz') this.playQuiz(step);
      else if(['inspect','board','lab'].includes(step.t)) this.runStep();
      else this.startChallenge(step);
    },
      clearNext() { if (this.clearNextId) this.startStage(this.clearNextId); else this.show('story'); },
    };
  };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof window !== 'undefined' ? window : globalThis);
