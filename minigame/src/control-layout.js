'use strict';
const KEY = 'yuyue.controls.v1';
const IDS = ['move', 'jump', 'clear', 'drop', 'smash', 'skill', 'skill2'];
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function clean(value) {
  const out = { v: 1, solo: {}, duo: {} };
  if (!value || value.v !== 1) return out;
  for (const mode of ['solo', 'duo']) {
    const ids = mode === 'solo' ? IDS : [0, 1].flatMap(i => IDS.map(id => `p${i}-${id}`));
    for (const id of ids) {
      const p = value[mode]?.[id];
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1) out[mode][id] = { x: p.x, y: p.y };
    }
  }
  return out;
}
function groups(controls) {
  return controls.filter(b => !b.dir || b.dir < 0).map(b => ({
    id: b.dir ? b.id.replace(/left$/, 'move') : b.id,
    player: b.player, x: b.dir ? b.pad.cx : b.x, y: b.y,
    r: b.r, off: b.dir ? b.pad.off : 0,
    label: b.dir ? '移动区' : b.action === 'skill' || b.action === 'skill2' ? '技能' : b.label,
    buttons: b.dir ? controls.filter(c => c.zone === b.zone) : [b],
  }));
}
function bounds(g, W, H, mode) {
  const span = mode === 'duo' ? W / 2 : W, base = mode === 'duo' ? g.player * span : 0;
  return { left: base + g.r + g.off + 8, right: base + span - g.r - g.off - 8, top: 90 + g.r, bottom: H - g.r - 12 };
}
function move(g, x, y, W, H, mode, custom = true) {
  const b = bounds(g, W, H, mode);
  g.x = clamp(x, b.left, b.right); g.y = clamp(y, b.top, b.bottom);
  for (const c of g.buttons) {
    c.x = g.x + (c.dir ? c.dir * g.off : 0); c.y = g.y;
    if (c.dir) {
      c.pad.cx = g.x; c.pad.cy = g.y;
      if (custom) {
        // Custom pads carry their touch region with them, so the old corner
        // cannot keep moving the player after the visible pad has moved away.
        const span = mode === 'duo' ? W / 2 : W, base = mode === 'duo' ? g.player * span : 0;
        const left = Math.max(base, g.x - g.off - g.r - 20), right = Math.min(base + span, g.x + g.off + g.r + 20);
        const top = Math.max(90, g.y - g.r - 20), bottom = Math.min(H, g.y + g.r + 20);
        Object.assign(c.zone, { cx: g.x, x: left, y: top, w: right - left, h: bottom - top });
      }
    }
  }
}
function conflicts(items) {
  const ids = new Set();
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    // Movement groups are capsules; actions are circles (off = 0).
    const dx = Math.max(0, Math.abs(a.x - b.x) - a.off - b.off);
    if (Math.hypot(dx, a.y - b.y) < a.r + b.r + 6) { ids.add(a.id); ids.add(b.id); }
  }
  return ids;
}
function encode(g, W, H, mode) {
  const b = bounds(g, W, H, mode);
  return { x: (g.x - b.left) / Math.max(1, b.right - b.left), y: (g.y - b.top) / Math.max(1, b.bottom - b.top) };
}
function apply(controls, saved, W, H, mode) {
  const items = groups(controls);
  // Decode all keys before validation, so swapping two keys survives restart.
  for (const g of items) {
    const p = saved?.[g.id]; if (!p) continue;
    const b = bounds(g, W, H, mode);
    move(g, b.left + p.x * (b.right - b.left), b.top + p.y * (b.bottom - b.top), W, H, mode);
  }
  return { controls, groups: items, fits: conflicts(items).size === 0 };
}
module.exports = { KEY, clean, groups, bounds, move, encode, conflicts, apply };
