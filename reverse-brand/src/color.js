'use strict';
// sRGB <-> OKLCH conversion, WCAG contrast and small helpers. Inputs are hex strings (#rrggbb or #rrggbbaa).

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    a: h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
  };
}

function rgbToHex({ r, g, b }) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

const lin = (v) => {
  v /= 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function oklch(hex) {
  const { r, g, b } = hexToRgb(hex);
  const R = lin(r), G = lin(g), B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.sqrt(A * A + Bb * Bb);
  let H = (Math.atan2(Bb, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { l: L, c: C, h: C < 0.0001 ? 0 : H };
}

function oklchString(hex) {
  const { l, c, h } = oklch(hex);
  return `oklch(${(l * 100).toFixed(1)}% ${c.toFixed(3)} ${h.toFixed(1)})`;
}

const isDark = (hex) => luminance(hex) < 0.18;
const chroma = (hex) => oklch(hex).c;

// Alpha-composite fg (#rrggbbaa) over an opaque bg.
function composite(fg, bg) {
  const f = hexToRgb(fg);
  const b = hexToRgb(bg);
  return rgbToHex({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a) });
}

function deltaOk(a, b) {
  const x = oklch(a), y = oklch(b);
  const ax = x.c * Math.cos((x.h * Math.PI) / 180), ay = x.c * Math.sin((x.h * Math.PI) / 180);
  const bx = y.c * Math.cos((y.h * Math.PI) / 180), by = y.c * Math.sin((y.h * Math.PI) / 180);
  return Math.sqrt((x.l - y.l) ** 2 + (ax - bx) ** 2 + (ay - by) ** 2);
}

function wcagLevel(ratio) {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA large';
  return 'fail';
}

module.exports = { hexToRgb, rgbToHex, luminance, contrast, oklch, oklchString, isDark, chroma, composite, deltaOk, wcagLevel };
