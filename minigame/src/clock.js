'use strict';

// All game/network timestamps are monotonic milliseconds. WeChat device clocks
// can use microseconds, while the IDE/browser can use milliseconds. Calibrate
// their *delta*, never the absolute timestamp or the device's platform label.
module.exports = function createClock(wx, wallNow = () => Date.now()) {
  let perf;
  try { perf = wx.getPerformance?.(); } catch (_) {}
  function rawNow() {
    try { const value = perf?.now(); return Number.isFinite(value) ? value : null; }
    catch (_) { return null; }
  }
  let lastWall = wallNow(), lastRaw = rawNow();
  let sampleWall = lastWall, sampleRaw = lastRaw;
  let scale = null, elapsed = 0;
  function now() {
    const wall = wallNow(), raw = rawNow();
    const wallDelta = Number.isFinite(wall - lastWall) ? Math.max(0, wall - lastWall) : 0;
    const rawValid = raw !== null && lastRaw !== null && raw >= lastRaw;
    // Until calibrated, Date.now has an unambiguous millisecond contract. On
    // calibration we keep this elapsed origin, so the clock never jumps.
    elapsed += scale !== null && rawValid ? (raw - lastRaw) * scale : wallDelta;
    if (!rawValid) {
      scale = null; sampleWall = wall; sampleRaw = raw;
    } else if (scale === null) {
      const span = wall - sampleWall;
      if (span >= 16 && sampleRaw !== null) {
        const ratio = (raw - sampleRaw) / span;
        // Select only known units, not an estimated frequency/time multiplier.
        // Wide ranges tolerate Date.now rounding and slow first frames.
        if (ratio >= .5 && ratio <= 2) scale = 1;
        else if (ratio >= 500 && ratio <= 2000) scale = .001;
        else if (span >= 250) { sampleWall = wall; sampleRaw = raw; }
      } else if (span < 0) { sampleWall = wall; sampleRaw = raw; }
    }
    lastWall = wall; lastRaw = raw;
    return elapsed;
  }
  return {
    now,
    info: () => ({ unit: 'milliseconds', source: scale === null ? 'Date.now' : 'wx.getPerformance', rawUnit: scale === null ? null : scale === 1 ? 'milliseconds' : 'microseconds' }),
  };
};
