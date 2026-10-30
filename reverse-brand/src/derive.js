'use strict';
// Derive a new design system: structure measured on a reference site (type scale, spacing grid,
// radii, component sizes, motion, voice rules) + the identity of another brand (colours, fonts,
// shapes, copy language). Nothing visual is copied from the reference brand.
const C = require('./color');
const { clampFor } = require('./analyse');

const snap = (v, step) => Math.round(v / step) * step;
const r3 = (v) => Math.round(v * 1000) / 1000;
const px = (v) => `${Math.round(v * 100) / 100}px`;

function deriveSystem(a, id) {
  const ref = a.type.roles;
  const body = id.bodySize || 16;
  const scale = body / ref.body.size;
  const base = a.layout.base;
  const notes = [];
  const roles = {};
  for (const k of ['display', 'h1', 'h2', 'h3', 'h4', 'lead', 'body', 'small']) {
    const r = ref[k];
    const size = k === 'body' ? body : snap(r.size * scale, r.size * scale >= 20 ? 4 : 2);
    const mob = k === 'body' ? body : Math.max(k === 'small' ? size : body, snap(size * (r.mobileSize / r.size), 2));
    const heading = ['display', 'h1', 'h2', 'h3', 'h4'].includes(k);
    roles[k] = {
      size, mobileSize: Math.min(mob, size), clamp: clampFor(Math.min(mob, size), size),
      weight: heading ? (id.headingWeights || {})[k] || r.weight : r.weight >= 600 && k !== 'small' ? 600 : 400,
      // Dense UI line-heights (< 1.4) on running text are raised to the reference lead leading.
      leading: !heading && r.lineHeight < 1.4 ? Math.max(1.5, ref.lead.lineHeight) : r.lineHeight, tracking: heading ? (id.headingTracking != null ? id.headingTracking : r.letterSpacing) : 0,
      family: heading ? 'var(--font-display)' : 'var(--font-body)', ref: `${r.size}px${r.inferred ? ' (inferred)' : ''}`,
    };
  }
  notes.push(`Body and small leading raised to ${Math.max(1.5, ref.lead.lineHeight)}: the reference uses ${ref.body.lineHeight} for dense UI rows.`);
  notes.push(`Type sizes = reference ratios to body (${ref.body.size}px) applied to a ${body}px body, snapped to 4px (20px and up) or 2px.`);
  const spaceScale = a.layout.spaceScale.filter((v) => v % base === 0);
  const btnRef = a.components.buttons.find((b) => b.kind === 'filled') || { height: 48 };
  const ctaH = snap(Math.max(btnRef.height, 44), base);
  const inputH = Math.max(ctaH, snap(a.components.input.height || 48, base));
  const navH = snap((a.components.nav && a.components.nav.height) || 56, base);
  const navMobileH = Math.max(48, navH - base);
  const cardR = snap(a.layout.cardRadius, 4);
  const smallR = (a.layout.radii.find((x) => x.value !== 'pill' && x.value < cardR && x.value >= 4) || { value: 8 }).value;

  const T = [];
  const add = (group, name, value, type, extra) => T.push(Object.assign({ group, name, value, type }, extra || {}));
  add('font', 'display', id.fonts.display, 'fontFamily');
  add('font', 'body', id.fonts.body, 'fontFamily');
  if (id.fonts.mono) add('font', 'mono', id.fonts.mono, 'fontFamily');
  for (const [k, r] of Object.entries(roles)) {
    add('type', `${k}-size`, r.clamp, 'dimension', { note: `${r.mobileSize}px @390 -> ${r.size}px @1440 · ref ${r.ref}` });
    add('type', `${k}-weight`, String(r.weight), 'fontWeight');
    add('type', `${k}-leading`, String(r.leading), 'number');
    add('type', `${k}-tracking`, `${r.tracking}em`, 'dimension');
    add('type', `${k}-family`, r.family, 'fontFamily');
  }
  for (const [name, hex] of Object.entries(id.colors.dark)) add('color', name, hex, 'color', { oklch: hex.startsWith('#') && hex.length === 7 ? C.oklchString(hex) : undefined });
  add('gradient', 'brand', id.gradient, 'gradient');
  add('space', 'base', px(base), 'dimension');
  spaceScale.forEach((v, i) => add('space', String(i + 1), px(v), 'dimension'));
  add('layout', 'container', px(id.container || Math.max(a.layout.container, 1200)), 'dimension', { note: id.container ? 'identity' : 'reference' });
  add('layout', 'gutter', px(Math.max(16, a.layout.gutter)), 'dimension');
  add('layout', 'gutter-wide', px(Math.max(24, a.layout.gutter + base)), 'dimension');
  a.layout.breakpoints.filter((b, i, arr) => !i || b - arr[i - 1] > 8).concat([1024]).forEach((v, i) => add('layout', `bp-${i + 1}`, px(v), 'dimension'));
  add('radius', 'card', px(cardR), 'dimension');
  add('radius', 'sm', px(smallR), 'dimension');
  add('radius', 'button', id.buttonShape === 'pill' ? '999px' : px(smallR), 'dimension', { note: id.buttonShape === 'pill' ? 'identity: pill' : 'reference' });
  add('radius', 'input', px(smallR), 'dimension');
  add('radius', 'pill', '999px', 'dimension');
  add('button', 'height', px(ctaH), 'dimension');
  add('button', 'height-sm', px(ctaH - base * 2), 'dimension');
  add('button', 'pad-x', px(base * 3), 'dimension');
  add('button', 'font-weight', '600', 'fontWeight');
  add('input', 'height', px(inputH), 'dimension');
  add('input', 'pad-x', px(base * 2), 'dimension');
  add('nav', 'height', px(navH), 'dimension');
  add('nav', 'height-mobile', px(navMobileH), 'dimension');
  add('card', 'padding', px(base * 2), 'dimension');
  add('card', 'media-ratio', '16 / 10', 'string');
  add('motion', 'ease', a.layout.easing, 'cubicBezier', { note: 'reference' });
  add('motion', 'duration', a.layout.duration, 'duration');
  add('motion', 'duration-slow', '600ms', 'duration');
  return { tokens: T, roles, notes, sizes: { ctaH, inputH, navH, navMobileH, cardR, smallR, base, spaceScale } };
}

function systemCss(sys, id) {
  const L = [`/* ${id.name} design tokens v1. Identity: ${id.name}. Structure (type ratios, ${sys.sizes.base}px grid, radii, component sizes, motion)`,
    `   derived from measurements of a reference portal; no colours, fonts, images or copy taken from it. */`, ':root {'];
  let g = null;
  for (const t of sys.tokens) {
    if (t.group !== g) { L.push(`  /* ${t.group} */`); g = t.group; }
    const c = [t.oklch, t.note].filter(Boolean).join(' · ');
    L.push(`  --${t.group}-${t.name}: ${t.value};${c ? ` /* ${c} */` : ''}`);
  }
  L.push('  color-scheme: dark;', '}');
  const light = Object.entries(id.colors.light).map(([k, v]) => `--color-${k}: ${v};`).join(' ');
  L.push(`@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) { ${light} color-scheme: light; } }`);
  L.push(`:root[data-theme="light"] { ${light} color-scheme: light; }`);
  L.push(`@media (max-width: ${sys.tokens.find((t) => t.name === 'bp-3') ? sys.tokens.find((t) => t.name === 'bp-3').value : '750px'}) { :root { --nav-height: var(--nav-height-mobile); } }`);
  return L.join('\n') + '\n';
}

function systemJson(sys, id) {
  const out = { $description: `${id.name} design tokens v1 (dark default; light values in $extensions).` };
  for (const t of sys.tokens) {
    out[t.group] = out[t.group] || {};
    const alias = /^var\(--([a-z]+)-([a-z0-9-]+)\)$/.exec(t.value);
    const node = { $value: alias ? `{${alias[1]}.${alias[2]}}` : t.value, $type: t.type };
    const ext = {};
    if (t.oklch) ext.oklch = t.oklch;
    if (t.note) ext.note = t.note;
    if (t.group === 'color' && id.colors.light[t.name]) ext.light = id.colors.light[t.name];
    if (Object.keys(ext).length) node.$extensions = { 'reverse-brand': ext };
    out[t.group][t.name] = node;
  }
  return JSON.stringify(out, null, 2) + '\n';
}

module.exports = { deriveSystem, systemCss, systemJson };
