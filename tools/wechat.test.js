'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { loadGame } = require('./wechat-test-harness');

test('WeChat entry boots and renders all menu screens without window, document, localStorage or browser performance', () => {
  const h = loadGame(); const { app, context } = h;
  assert.equal(context.window, undefined); assert.equal(context.document, undefined); assert.equal(context.performance, undefined);
  assert.equal(app.screen, 'menu'); assert.ok(h.canvases.length > 1);
  for (const screen of ['ai', 'practice', 'friend', 'join', 'story', 'team', 'codex', 'help', 'settings']) { app.show(screen); h.frames(2); assert.ok(app.ui.buttons.length); }
  assert.equal(h.YY.STAGES.length, 60); assert.equal(h.YY.CHARS.length, 13); app.destroy();
});

test('real canvas buttons enter matches, three independent fingers move/jump/swing, cancel and direction sliding release correctly', () => {
  const h = loadGame(); h.click('ai'); h.click('normal');
  const { app } = h; assert.equal(app.mode, 'ai'); assert.equal(app.screen, null);
  // Let the player move rather than being locked in the server stance.
  app.match.server = 1; app.match.resetPoint(); app.match.phase = 'idle'; app.match.shuttle.held = false;
  const at = id => { const b = app.ui.controls.find(b => b.id === id); return [b.x, b.y]; };
  h.touch('Start', [[1, ...at('right')], [2, ...at('jump')], [3, ...at('clear')]]); h.frames(3);
  assert.equal(app.ctrlFor[0].move(), 1); assert.ok(app.match.players[0].y > 0); assert.ok(app.match.players[0].swing);
  h.touch('End', [[2, ...at('jump')]]); assert.equal(app.ctrlFor[0].move(), 1);
  h.touch('Move', [[1, ...at('left')]]); assert.equal(app.ctrlFor[0].move(), -1);
  h.touch('Move', [[1, 350, 100]]); assert.equal(app.ctrlFor[0].move(), 0);
  h.touch('Cancel', [[1, 350, 100], [3, ...at('clear')]]); assert.equal(app.input.pointers.size, 0);
  app.destroy();
});

test('touch press ordering, repeated action taps, duo controls and mirrored movement are isolated', () => {
  const h = loadGame(); h.app.startLocal(); h.frames();
  const { app } = h, at = id => { const b = app.ui.controls.find(b => b.id === id); return [b.x, b.y]; };
  h.touch('Start', [[1, ...at('p0-left')], [2, ...at('p0-right')], [3, ...at('p1-left')]]);
  assert.equal(app.ctrlFor[0].move(), 1); assert.equal(app.ctrlFor[1].move(), 1);
  h.touch('End', [[2, ...at('p0-right')]]); assert.equal(app.ctrlFor[0].move(), -1); assert.equal(app.ctrlFor[1].move(), 1);
  for (let i = 0; i < 4; i++) { h.touch('Start', [[9, ...at('p0-clear')]]); h.touch('End', [[9, ...at('p0-clear')]]); }
  assert.equal(app.ctrlFor[0].queue.length, 4); assert.equal(app.ctrlFor[1].queue.length, 0);
  app.destroy();
});

test('background freeze, resume without catch-up, and stale delayed results cannot affect a new match', () => {
  const h = loadGame(); h.app.startAI('easy'); h.frames(10);
  const { app } = h; app.defer(() => { app.staleFired = true; }, 1000);
  const time = app.match.time; h.events.Hide(); h.frames(1); h.advance(30000);
  assert.equal(app.match.time, time); assert.equal(app.paused, true);
  h.events.Show({ query: {} }); h.frames(); assert.equal(app.match.time, time);
  h.click('resume'); h.frames(3); assert.ok(app.match.time - time < .2);
  app.startPractice('clear'); h.frames(100); assert.equal(app.staleFired, undefined); app.destroy();
});

test('all story stages traverse dialog, choices, activities, challenges, stars and rewards in the native runtime', () => {
  const h = loadGame(), { app, YY } = h;
  for (const stage of YY.STAGES) {
    app.startStage(stage.id);
    let limit = 0;
    while (app.story && limit++ < 60) {
      h.frames();
      if (app.screen === 'dialog') app.dlgFinish();
      else if (app.screen === 'quiz') { app.quizAnswer(app.quiz.step.qs[app.quiz.i].a); h.frames(); app.quizNext(); }
      else if (app.screen === 'inspect') { for(const item of app.activity.step.items) app.inspectItem(item.id); app.finishInspect(); }
      else if (app.screen === 'board') { app.boardAnswer(app.activity.step.cases[app.activity.index].answer);app.boardNext(); }
      else if (app.screen === 'lab') { for(let i=0;i<3;i++){app.labSelect(i);app.labTry();}app.labSelect(YY.LABS[app.activity.experiment].target);app.finishLab(); }
      else if (app.screen === 'step') app.stepContinue();
      else if (app.mode === 'story') {
        h.frames(4);
        // Verify real challenge construction, then supply a completed result to
        // exercise progression without letting the test depend on AI match luck.
        assert.ok(app.match.players[0].st); assert.ok(app.storyStep);
        if (app.storyStep.t !== 'match') assert.ok(app.practice.goal);
        app.stepDone({ win: true, ok: app.practice?.goal.need, att: app.practice?.goal.need });
      } else throw Error('Unexpected story state ' + app.screen);
    }
    assert.ok(limit < 60, stage.id + ' stalled'); assert.ok(YY.Profile.stars(stage.id) >= 1);
    assert.equal(app.screen, 'clear'); h.frames();
  }
  assert.equal(YY.Profile.d.chars.length, 13); assert.equal(YY.Profile.d.cards.length, YY.CARDS.length); assert.ok(YY.Profile.canTune());
  const storage = h.storage; app.destroy();
  const restarted = loadGame({ storage }); assert.equal(restarted.YY.Profile.d.chars.length, 13); assert.equal(Object.keys(restarted.YY.Profile.d.stages).length, YY.STAGES.length); restarted.app.destroy();
});

test('failed quiz cannot advance; environmental choice affects next challenge; locked stages stay locked', () => {
  const h = loadGame(), { app, YY } = h;
  app.startStage(YY.STAGES.at(-1).id); assert.equal(app.story, null);
  const stage = YY.STAGES.find(s => s.steps.some(step => step.t === 'pick' && step.o.some(o=>!o.ok)));
  YY.STAGES.slice(0, YY.STAGES.indexOf(stage)).forEach(s => YY.Profile.setStars(s.id, 1));
  app.startStage(stage.id);
  const choice = stage.steps.find(s => s.t === 'pick' && s.o.some(o=>!o.ok)); app.playPick(choice);
  const index = choice.o.findIndex(o => !o.ok); app.quizAnswer(index); assert.equal(app.story.ctx.pickOk, false); assert.ok(app.story.ctx.env);
  const before = app.story.i;
  app.playQuiz({ need: 1, qs: [{ q: 'test', o: ['yes', 'no'], a: 0, exp: 'explanation' }] }); app.quizAnswer(1); app.quizNext();
  assert.equal(app.stepRes.win, false); assert.equal(app.story.i, before); h.frames();
  app.stepContinue(); assert.equal(app.story.i, before);
  assert.ok(app.ui.buttons.find(b => b.id === 'continue-step').disabled); app.destroy();
});

test('all drills, all venues, character selection, tension and locked gear render and persist', () => {
  const h = loadGame(), { app, YY } = h;
  for (const venue of YY.VENUE_IDS) for (const drill of Object.keys(YY.DRILLS)) { app.settings.venue = venue; app.startPractice(drill); h.frames(3); assert.equal(app.R.venueId, venue); assert.ok(app.practice); }
  app.quit(); app.show('team'); h.frames(); h.click('char-canglan'); assert.equal(YY.Profile.sel.char, 'canglan');
  YY.Profile.unlock('feat', 'tension'); h.click('tab-tension'); h.click('tension-plus'); assert.equal(YY.Profile.sel.tension, 25);
  app.destroy(); const next = loadGame({ storage: h.storage }); assert.equal(next.YY.Profile.sel.char, 'canglan'); assert.equal(next.YY.Profile.sel.tension, 25); next.app.destroy();
});

test('damaged local save cannot crash menus or inject invalid equipment/stars', () => {
  const storage = new Map([['yuyue.profile', JSON.stringify({ chars: 'bad', gear: null, stages: { '0-1': 99 }, cards: {}, seen: null, sel: { char: 'missing', racket: 's_dur', tension: 'broken' } })]]);
  const h = loadGame({ storage }); assert.equal(h.YY.Profile.sel.char, 'lingfeng'); assert.equal(h.YY.Profile.sel.racket, 'r_basic'); assert.equal(h.YY.Profile.sel.tension, 24); assert.equal(h.YY.Profile.stars('0-1'), 0);
  h.app.show('team'); h.frames(); h.app.destroy();
});

test('safe-area coordinate conversion, resize and portrait guard preserve touch correctness', () => {
  const h = loadGame({ width: 844, height: 390, safe: true }); h.click('practice'); assert.equal(h.app.screen, 'practice');
  h.click('drill-receive'); h.resize(390, 844); h.frames(); assert.ok(h.app.ui.isPortrait);
  assert.equal(h.app.input.pointers.size, 0); h.resize(844, 390); h.frames(); assert.ok(!h.app.ui.isPortrait); h.app.destroy();
});
