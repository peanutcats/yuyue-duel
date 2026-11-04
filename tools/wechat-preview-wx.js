/* Browser preview only; excluded from the WeChat package. */
(function () {
  const listeners = new Map(), emit = (name, value) => { for (const fn of listeners.get(name) || []) fn(value); };
  const on = name => fn => { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(fn); };
  let screen;
  window.GameGlobal = window;
  window.__wx = { emit };
  window.wx = {
    createCanvas() { const c = document.createElement('canvas'); if (!screen) { screen = c; c.id = 'game'; document.body.prepend(c); } return c; },
    getWindowInfo() {
      const safe = new URLSearchParams(location.search).has('safe');
      return { windowWidth: innerWidth, windowHeight: innerHeight, pixelRatio: devicePixelRatio, safeArea: { left: safe ? 34 : 0, top: 0, right: innerWidth - (safe ? 22 : 0), bottom: innerHeight - (safe ? 14 : 0) } };
    },
    getSystemInfoSync() { return this.getWindowInfo(); },
    getMenuButtonBoundingClientRect: () => ({ left: innerWidth - 94, right: innerWidth - 12, top: 12, bottom: 39, width: 82, height: 27 }),
    getPerformance: () => performance,
    getStorageSync: key => localStorage.getItem('wx.' + key) || '',
    setStorageSync: (key, value) => localStorage.setItem('wx.' + key, value),
    getLaunchOptionsSync: () => ({ query: Object.fromEntries(new URLSearchParams(location.search)) }),
    onTouchStart: on('touchstart'), onTouchMove: on('touchmove'), onTouchEnd: on('touchend'), onTouchCancel: on('touchcancel'),
    onKeyDown: on('keydown'), onKeyUp: on('keyup'), onHide: on('hide'), onShow: on('show'), onWindowResize: on('resize'), onMemoryWarning: on('memory'), onNetworkStatusChange: on('network'),
    onShareAppMessage(fn) { this.shareProvider = fn; }, showShareMenu() {},
    shareAppMessage(data) { window.__lastShare = data; console.info('分享预览', data); },
    showToast({ title }) { console.info('提示：' + title); },
    showModal({ title, content, success }) { success?.({ confirm: confirm(title + '\n\n' + content), cancel: false }); },
    vibrateShort() {}, setInnerAudioOption() {},
    createInnerAudioContext() {
      const audio = new Audio();
      return { set src(value) { audio.src = '/minigame/' + value; }, set volume(value) { audio.volume = value; }, set obeyMuteSwitch(_) {}, play() { audio.play().catch(() => {}); }, stop() { audio.pause(); audio.currentTime = 0; }, seek(t) { if (audio.readyState) audio.currentTime = t; }, onEnded: fn => audio.addEventListener('ended', fn), onStop() {}, onError: fn => audio.addEventListener('error', fn), destroy() { audio.pause(); audio.src = ''; } };
    },
    connectSocket({ url }) {
      const socket = new WebSocket(url);
      return { onOpen: fn => socket.addEventListener('open', fn), onMessage: fn => socket.addEventListener('message', e => fn({ data: e.data })), onClose: fn => socket.addEventListener('close', fn), onError: fn => socket.addEventListener('error', fn),
        send({ data, success, fail }) { try { socket.send(data); queueMicrotask(() => success?.()); } catch (error) { fail?.(error); } },
        close({ code = 1000 } = {}) { socket.close(code); } };
    },
  };
  for (const [browser, native] of [['pointerdown', 'touchstart'], ['pointermove', 'touchmove'], ['pointerup', 'touchend'], ['pointercancel', 'touchcancel']]) window.addEventListener(browser, e => {
    if (e.target !== screen && browser === 'pointerdown') return;
    e.preventDefault(); if (browser === 'pointerdown') { try { screen.setPointerCapture(e.pointerId); } catch (_) {} }
    emit(native, { changedTouches: [{ identifier: e.pointerId, clientX: e.clientX, clientY: e.clientY }] });
  }, { passive: false });
  for (const name of ['keydown', 'keyup']) window.addEventListener(name, e => { if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp'].includes(e.code)) e.preventDefault(); emit(name, { code: e.code, repeat: e.repeat }); });
  window.addEventListener('resize', () => emit('resize', {}));
  document.addEventListener('visibilitychange', () => emit(document.hidden ? 'hide' : 'show', { query: {} }));
})();
