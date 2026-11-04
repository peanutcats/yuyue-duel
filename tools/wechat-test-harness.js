'use strict';
const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../minigame');
function loadGame({ width = 844, height = 390, storage = new Map(), safe = false, performanceScale = 1 } = {}) {
  let now = 100, nextRAF = 0;
  const raf = new Map(), events = {}, texts = [], canvases = [];
  const gradient = { addColorStop() {} };
  function canvas() {
    const c = { width: 1, height: 1 };
    const g = new Proxy({ canvas: c, measureText: text => ({ width: [...String(text)].length * 14 }), createLinearGradient: () => gradient, createRadialGradient: () => gradient, fillText: text => texts.push(text) }, { get(target, key) { return key in target ? target[key] : () => {}; }, set(target, key, value) { target[key] = value; return true; } });
    c.getContext = () => g; canvases.push(c); return c;
  }
  const wx = {
    createCanvas: canvas, getPerformance: () => ({ now: () => now * performanceScale }),
    getWindowInfo: () => ({ windowWidth: width, windowHeight: height, pixelRatio: 3, safeArea: { left: safe ? 32 : 0, right: width - (safe ? 24 : 0), top: 0, bottom: height - (safe ? 12 : 0) } }),
    getMenuButtonBoundingClientRect: () => ({ left: width - 102, right: width - 12, top: 12, bottom: 40 }),
    getStorageSync: key => storage.get(key) || '', setStorageSync: (key, value) => storage.set(key, value),
    getLaunchOptionsSync: () => ({ query: {} }), showToast() {}, showShareMenu() {}, onShareAppMessage() {}, shareAppMessage() {}, vibrateShort() {},
    showModal: options => options.success({ confirm: true }),
  };
  for (const name of ['TouchStart', 'TouchMove', 'TouchEnd', 'TouchCancel', 'Hide', 'Show', 'WindowResize', 'MemoryWarning', 'NetworkStatusChange']) wx['on' + name] = fn => { events[name] = fn; };
  class TestDate extends Date { static now() { return Math.floor(1700000000000 + now); } }
  const context = vm.createContext({ GameGlobal: {}, wx, console, Date: TestDate, setTimeout, clearTimeout, requestAnimationFrame(fn) { const id = ++nextRAF; raf.set(id, fn); return id; }, cancelAnimationFrame: id => raf.delete(id) });
  const cache = new Map();
  function load(name) {
    name = path.resolve(root, name); if (!name.endsWith('.js')) name += '.js';
    if (cache.has(name)) return cache.get(name).exports;
    const module = { exports: {} }; cache.set(name, module);
    const fn = vm.runInContext(`(function(require,module,exports){${fs.readFileSync(name, 'utf8')}\n})`, context, { filename: name });
    fn(relative => load(path.resolve(path.dirname(name), relative)), module, module.exports); return module.exports;
  }
  load('game.js');
  const app = context.GameGlobal.YuyueGame, YY = context.GameGlobal.YY;
  function frames(count = 1, step = 1000 / 60) { for (let i = 0; i < count; i++) { now += step; const callbacks = [...raf.values()]; raf.clear(); callbacks.forEach(fn => fn(now)); } }
  function touch(type, touches) {
    events['Touch' + type]({ changedTouches: touches.map(([identifier, x, y]) => ({ identifier, clientX: app.ui.originX + x * app.ui.scale, clientY: app.ui.originY + y * app.ui.scale })) });
  }
  function click(id) {
    app.ui.draw(); const b = app.ui.buttons.find(b => b.id === id && !b.disabled); if (!b) throw Error('Button unavailable: ' + id);
    const x = b.x + b.w / 2, y = b.y + b.h / 2; touch('Start', [[99, x, y]]); touch('End', [[99, x, y]]); frames();
  }
  return { app, YY, wx, events, frames, click, touch, storage, context, canvases, texts, resize(w, h) { width = w; height = h; events.WindowResize({}); }, advance(ms) { now += ms; } };
}
module.exports = { loadGame };
