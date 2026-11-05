'use strict';

// Some devices keep reporting a portrait safeArea after the game turns
// landscape. Validate the coordinate space before deriving edge insets.
function insets(rect, width, height) {
  if (!rect || ![rect.left, rect.top, rect.right, rect.bottom].every(Number.isFinite)) return null;
  const { left, top, right, bottom } = rect;
  if (left < 0 || top < 0 || right <= left || bottom <= top || right > width + 1 || bottom > height + 1) return null;
  const result = { left, right: Math.max(0, width - right), top, bottom: Math.max(0, height - bottom) };
  // A safe area reserves cutouts/system gestures, not half of the game screen.
  if (Object.values(result).some(n => n > Math.min(width, height) * .25)) return null;
  return result;
}

module.exports = function safeInsets(info) {
  const W = info.windowWidth, H = info.windowHeight;
  const direct = insets(info.safeArea, W, H);
  if (direct) return { ...direct, safeAreaSource: 'window' };
  if (W > H) {
    const portrait = insets(info.safeArea, H, W);
    if (portrait) {
      // Without an orientation event we cannot know which edge has the notch.
      // Keep both edges safe, rather than assume landscape-left vs right.
      const side = Math.max(portrait.top, portrait.bottom), vertical = Math.max(portrait.left, portrait.right);
      return { left: side, right: side, top: vertical, bottom: vertical, safeAreaSource: 'rotated' };
    }
  }
  return { left: 0, right: 0, top: 0, bottom: 0, safeAreaSource: 'fallback' };
};
