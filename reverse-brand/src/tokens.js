'use strict';
// Builds design tokens from the analysis and serialises them as CSS custom properties and
// W3C design-tokens JSON (hex $value, OKLCH in $extensions).
const C = require('./color');
const { primaryFamily } = require('./analyse');

const FALLBACK_SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const r3 = (v) => Math.round(v * 1000) / 1000;
const pxv = (v) => `${Math.round(v * 100) / 100}px`;

function fontStack(stack) {
  const fam = primaryFamily(stack || '');
  return fam && !/^(system-ui|sans-serif|serif)$/i.test(fam) ? `"${fam}", ${FALLBACK_SANS}` : FALLBACK_SANS;
}

function buildTokens(a) {
  const t = [];   // flat list: { group, name, value, type, oklch?, note? }
  const add = (group, name, value, type, extra) => t.push(Object.assign({ group, name, value, type }, extra || {}));
  const roles = a.type.roles;

  // Fonts.
  const displayStack = fontStack(roles.display.family);
  const bodyStack = fontStack(roles.body.family);
  add('font', 'display', displayStack, 'fontFamily', { note: primaryFamily(roles.display.family) });
  add('font', 'body', bodyStack, 'fontFamily', { note: primaryFamily(roles.body.family) });

  // Type roles.
  for (const k of ['display', 'h1', 'h2', 'h3', 'h4', 'lead', 'body', 'small']) {
    const r = roles[k];
    add('type', `${k}-size`, r.clamp, 'dimension', { note: `${r.mobileSize}px @390 -> ${r.size}px @1440${r.inferred ? ' (inferred)' : ''}` });
    add('type', `${k}-weight`, String(r.weight), 'fontWeight');
    add('type', `${k}-leading`, String(r.lineHeight), 'number');
    add('type', `${k}-tracking`, `${r.letterSpacing}em`, 'dimension');
    add('type', `${k}-family`, ['display', 'h1', 'h2', 'h3', 'h4'].includes(k) ? 'var(--font-display)' : 'var(--font-body)', 'fontFamily');
  }
  add('type', 'scale-ratio', String(a.type.ratio), 'number', { note: a.type.interval.name });

  // Colour roles.
  for (const [name, c] of Object.entries(a.colour.roles)) add('color', name, c.hex, 'color', { oklch: c.oklch, note: c.inferred ? 'inferred' : `share ${Math.round(c.share * 100)}% of ${c.basis}` });
  const g = a.colour.gradients[0];
  const gradient = g ? `linear-gradient(135deg, ${g.stops.slice(0, 3).join(', ')})` : `linear-gradient(135deg, ${a.colour.roles.action.hex}, ${a.colour.roles['surface-inverse'].hex})`;
  add('gradient', 'brand', gradient, 'gradient', { note: g ? 'measured stops, angle normalised to 135deg' : 'inferred from action and surface-inverse' });

  // Spacing and layout.
  add('space', 'base', pxv(a.layout.base), 'dimension');
  a.layout.spaceScale.forEach((v, i) => add('space', String(i + 1), pxv(v), 'dimension'));
  add('layout', 'container', pxv(a.layout.container), 'dimension');
  add('layout', 'columns', String(a.layout.columns), 'number');
  add('layout', 'gutter', pxv(a.layout.gutter), 'dimension');
  a.layout.breakpoints.forEach((v, i) => add('layout', `bp-${i + 1}`, pxv(v), 'dimension'));

  // Radii.
  const btn = a.components.buttons.find((b) => b.kind === 'filled') || a.components.buttons[0];
  const pill = '999px';
  add('radius', 'card', pxv(a.layout.cardRadius), 'dimension');
  add('radius', 'button', btn ? (btn.pill ? pill : pxv(btn.radius)) : pxv(8), 'dimension', { note: btn && btn.pill ? 'pill' : '' });
  add('radius', 'input', a.components.input.pill ? pill : pxv(a.components.input.radius || 0), 'dimension');
  a.layout.radii.filter((r) => r.value !== 'pill').slice(0, 4).sort((x, y) => x.value - y.value).forEach((r, i) => add('radius', `step-${i + 1}`, pxv(r.value), 'dimension'));
  add('radius', 'pill', pill, 'dimension');

  // Buttons: primary = action, secondary = action-alt or the second filled variant, outline, translucent.
  const variants = pickButtonVariants(a);
  for (const [name, v] of Object.entries(variants)) {
    add('button', `${name}-bg`, v.bg, 'color', { oklch: v.bg.startsWith('#') && v.bg.length === 7 ? C.oklchString(v.bg) : undefined });
    add('button', `${name}-fg`, v.fg, 'color', { oklch: C.oklchString(v.fg) });
    add('button', `${name}-border`, v.border, 'color');
    add('button', `${name}-ground`, v.ground, 'color');
  }
  const b0 = btn || { height: 48, padding: [12, 24, 12, 24], font: { size: 16, weight: 600 }, borderWidth: 1 };
  add('button', 'height', pxv(b0.height), 'dimension');
  add('button', 'pad-x', pxv(b0.padding[1] || 24), 'dimension');
  add('button', 'pad-y', pxv(b0.padding[0] || 12), 'dimension');
  add('button', 'font-size', pxv(b0.font.size), 'dimension');
  add('button', 'font-weight', String(b0.font.weight), 'fontWeight');
  add('button', 'tracking', `${r3((b0.font.letterSpacing || 0) / (b0.font.size || 16))}em`, 'dimension');
  add('button', 'border-width', pxv(Math.max(1, (a.components.buttons.find((x) => x.kind === 'outline') || {}).borderWidth || 1)), 'dimension');

  // Card.
  const card = a.components.cards[0] || { bg: a.colour.roles.surface.hex, radius: a.layout.cardRadius, padding: [16, 16, 16, 16], shadow: null };
  add('card', 'bg', card.bg && card.bg.length === 7 ? card.bg : a.colour.roles.surface.hex, 'color');
  add('card', 'radius', 'var(--radius-card)', 'dimension');
  add('card', 'padding', pxv(Math.max(...(card.padding || [16]))), 'dimension');
  add('card', 'shadow', card.shadow || 'none', 'shadow');
  add('card', 'backdrop', card.backdrop || 'blur(20px) saturate(1.4)', 'string', { note: card.backdrop ? 'measured' : 'glass treatment inferred' });
  add('card', 'glass', 'rgb(255 255 255 / 0.16)', 'color', { note: 'inferred glass fill' });

  // Input.
  const inp = a.components.input;
  add('input', 'height', pxv(inp.height), 'dimension', { note: inp.inferred ? 'inferred' : 'measured' });
  add('input', 'bg', inp.bg || a.colour.roles.background.hex, 'color');
  add('input', 'border', inp.borderColor || a.colour.roles.border.hex, 'color');
  add('input', 'border-width', pxv(inp.borderWidth || 1), 'dimension');
  add('input', 'pad-x', pxv((inp.padding && inp.padding[1]) || 16), 'dimension');
  add('input', 'font-size', pxv((inp.font && inp.font.size) || roles.body.size), 'dimension');

  // Nav.
  const nav = a.components.nav || { height: 64, bg: a.colour.roles.background.hex, logo: null };
  const [, linkSize, linkWeight, linkColor] = (nav.linkStyle || `x|${roles.body.size}|500|${a.colour.roles.text.hex}`).split('|');
  add('nav', 'height', pxv(nav.height || 64), 'dimension');
  add('nav', 'bg', nav.bg && nav.bg.length === 7 ? nav.bg : a.colour.roles.background.hex, 'color');
  add('nav', 'link-size', pxv(+linkSize || 15), 'dimension');
  add('nav', 'link-weight', String(linkWeight || 500), 'fontWeight');
  add('nav', 'link-color', linkColor && linkColor.startsWith('#') ? linkColor.slice(0, 7) : a.colour.roles.text.hex, 'color');
  add('nav', 'logo-width', pxv((nav.logo && nav.logo.w) || 120), 'dimension');
  add('nav', 'logo-height', pxv((nav.logo && nav.logo.h) || 28), 'dimension');
  add('nav', 'logo-color', (nav.logo && nav.logo.color && nav.logo.color.slice(0, 7)) || a.colour.roles.action.hex, 'color');

  // Motion and elevation.
  add('motion', 'ease', a.layout.easing, 'cubicBezier');
  add('motion', 'duration', a.layout.duration, 'duration');
  add('shadow', '1', (a.layout.shadows[0] || {}).shadow || '0 2px 8px rgb(0 0 0 / 0.08)', 'shadow');

  return t;
}

function pickButtonVariants(a) {
  const R = a.colour.roles;
  const bs = a.components.buttons;
  const filled = bs.filter((b) => b.kind === 'filled' && b.bg);
  const primary = filled.find((b) => b.bg === R.action.hex) || filled[0];
  const secondary = filled.find((b) => b !== primary);
  const outline = bs.find((b) => b.kind === 'outline');
  const translucent = bs.find((b) => b.kind === 'translucent');
  const v = {};
  v.primary = { bg: R.action.hex, fg: R['on-action'].hex, border: R.action.hex, ground: primary ? primary.ground : R.background.hex, measured: !!primary, source: primary };
  v.secondary = secondary
    ? { bg: secondary.bg, fg: secondary.color || R.text.hex, border: secondary.bg, ground: secondary.ground, measured: true, source: secondary }
    : { bg: R['action-alt'].hex, fg: C.contrast('#ffffff', R['action-alt'].hex) > 3 ? '#ffffff' : R.text.hex, border: R['action-alt'].hex, ground: R.background.hex, measured: false };
  v.outline = outline
    ? { bg: 'transparent', fg: outline.color || outline.borderColor, border: outline.borderColor, ground: outline.ground, measured: true, source: outline }
    : { bg: 'transparent', fg: R.text.hex, border: R.text.hex, ground: R.background.hex, measured: false };
  v.translucent = translucent
    ? { bg: translucent.bg && translucent.bg.length === 9 ? hexAlphaToRgb(translucent.bg) : 'rgb(255 255 255 / 0.16)', fg: translucent.color || '#ffffff', border: 'transparent', ground: translucent.ground, measured: true, source: translucent }
    : { bg: 'rgb(255 255 255 / 0.16)', fg: R['text-inverse'].hex, border: 'transparent', ground: R['surface-inverse'].hex, measured: false };
  return v;
}

function hexAlphaToRgb(h) {
  const { r, g, b, a } = C.hexToRgb(h);
  return `rgb(${r} ${g} ${b} / ${r3(a)})`;
}

function toCss(tokens, meta) {
  const lines = [`/* ${meta.brand} design tokens. Unofficial analysis of ${meta.origin}, measured ${meta.capturedAt.slice(0, 10)} by reverse-brand.`,
    `   Not affiliated with or endorsed by ${meta.brand}. Trademarks belong to their owners. */`, ':root {'];
  let group = null;
  for (const tk of tokens) {
    if (tk.group !== group) { lines.push(`  /* ${tk.group} */`); group = tk.group; }
    const comment = [tk.oklch, tk.note].filter(Boolean).join(' · ');
    lines.push(`  --${tk.group}-${tk.name}: ${tk.value};${comment ? ` /* ${comment} */` : ''}`);
  }
  lines.push('}');
  return lines.join('\n') + '\n';
}

function toJson(tokens, meta) {
  const out = { $description: `${meta.brand} design tokens. Unofficial analysis of ${meta.origin}. Not affiliated with or endorsed by ${meta.brand}. Trademarks belong to their owners.` };
  for (const tk of tokens) {
    out[tk.group] = out[tk.group] || {};
    const alias = /^var\(--([a-z]+)-([a-z0-9-]+)\)$/.exec(tk.value);
    const node = { $value: alias ? `{${alias[1]}.${alias[2]}}` : tk.value, $type: tk.type };
    const ext = {};
    if (tk.oklch) ext.oklch = tk.oklch;
    if (tk.note) ext.note = tk.note;
    if (Object.keys(ext).length) node.$extensions = { 'reverse-brand': ext };
    out[tk.group][tk.name] = node;
  }
  return JSON.stringify(out, null, 2) + '\n';
}

module.exports = { buildTokens, toCss, toJson, pickButtonVariants };
