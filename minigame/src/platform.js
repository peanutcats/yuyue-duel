'use strict';
const createClock = require('./clock');
const safeInsets = require('./safe-area');

module.exports = function createPlatform(wx, config) {
  let hidden = false;
  let storageError = null;
  const clock = createClock(wx);
  const now = clock.now;
  function viewport() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const W = info.windowWidth, H = info.windowHeight;
    const safe = safeInsets(info);
    let capsule = null;
    try { capsule = wx.getMenuButtonBoundingClientRect?.(); } catch (_) {}
    return { W, H, dpr: Math.min(info.pixelRatio || 1, config.maxPixelRatio), ...safe, capsule };
  }
  function reportStorageError(e) {
    storageError = e;
    console.warn('Local save failed', e?.errMsg || e?.message || e);
  }
  return {
    wx, now, viewport, clockInfo: clock.info,
    hidden: () => hidden,
    setHidden: value => { hidden = value; },
    createCanvas: () => wx.createCanvas(),
    getStorage(key) { try { const v = wx.getStorageSync(key); return v === '' || v == null ? null : String(v); } catch (e) { reportStorageError(e); return null; } },
    setStorage(key, value) { try { wx.setStorageSync(key, value); return true; } catch (e) { reportStorageError(e); return false; } },
    takeStorageError() { const error = storageError; storageError = null; return error; },
    read(key, fallback) { try { const raw = this.getStorage(key); return raw == null ? fallback : JSON.parse(raw); } catch (_) { return fallback; } },
    write(key, value) { return this.setStorage(key, JSON.stringify(value)); },
    toast(title) { wx.showToast?.({ title, icon: 'none', duration: 2200 }); },
    share(room) { wx.shareAppMessage?.({ title: room ? `羽跃对决｜房间 ${room}，等你来挑战` : config.shareTitle, query: room ? `room=${encodeURIComponent(room)}` : '', imageUrl: 'assets/images/icon.png' }); },
    vibrate(type = 'light') { wx.vibrateShort?.({ type, fail() {} }); },
    confirm(title, content, done) { wx.showModal({ title, content, confirmText: '确定', cancelText: '取消', success: r => { if (r.confirm) done(); } }); },
  };
};
