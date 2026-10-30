'use strict';
// Turns snapshot.json into a measured analysis: type roles, colour roles, layout, components,
// imagery and voice. Every inferred value carries `inferred: true` and a note in `assumptions`.
const C = require('./color');

const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-sans-serif|ui-serif|ui-monospace|-apple-system|blinkmacsystemfont|segoe ui|roboto|helvetica neue|helvetica|arial|noto sans|apple color emoji|segoe ui emoji|segoe ui symbol|noto color emoji|emoji|math|inherit)$/i;
const INTERVALS = [
  ['minor second', 1.067], ['major second', 1.125], ['minor third', 1.2], ['major third', 1.25],
  ['perfect fourth', 1.333], ['augmented fourth', 1.414], ['perfect fifth', 1.5], ['golden ratio', 1.618], ['major sixth', 1.667], ['octave', 2],
];
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n || 1e9);

// Merge per-page count maps. A key whose count is identical on every page is repeated chrome
// (header, footer) and is counted once; otherwise counts are summed.
function mergeMaps(maps) {
  const out = {};
  const keys = new Set(maps.flatMap((m) => Object.keys(m || {})));
  for (const k of keys) {
    const vals = maps.map((m) => (m || {})[k]);
    if (maps.length > 1 && vals.every((v) => v != null && v === vals[0])) out[k] = vals[0];
    else out[k] = vals.reduce((a, v) => a + (v || 0), 0);
  }
  return out;
}

function primaryFamily(stack) {
  const fams = stack.split(',').map((f) => f.trim().replace(/^["']|["']$/g, ''));
  return fams.find((f) => !GENERIC.test(f)) || fams[0];
}

function rgbStringToHex(s) {
  const m = s.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+%?))?\s*\)/);
  if (!m) return null;
  let a = m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  const hex = C.rgbToHex({ r: +m[1], g: +m[2], b: +m[3] });
  return a < 1 ? hex + Math.round(a * 255).toString(16).padStart(2, '0') : hex;
}

function analyse(snap) {
  const assumptions = [];
  const pages = snap.pages;
  const home = pages[0];
  const mobile = snap.mobile;
  const assume = (area, text) => assumptions.push({ area, text });

  // ---------- Type ----------
  const styleMaps = pages.map((p) => Object.fromEntries(p.textStyles.map((t) => [[t.family, t.size, t.weight, t.lineHeight, t.letterSpacing, t.transform].join('|'), t.chars])));
  const styleChars = mergeMaps(styleMaps);
  const styleBySig = {};
  pages.forEach((p) => p.textStyles.forEach((t) => {
    const k = [t.family, t.size, t.weight, t.lineHeight, t.letterSpacing, t.transform].join('|');
    const s = styleBySig[k] = styleBySig[k] || Object.assign({}, t, { tags: {}, samples: [] });
    Object.entries(t.tags).forEach(([tag, n]) => { s.tags[tag] = (s.tags[tag] || 0) + n; });
    t.samples.forEach((x) => { if (s.samples.length < 6 && !s.samples.includes(x)) s.samples.push(x); });
  }));
  const styles = Object.entries(styleBySig).map(([k, s]) => Object.assign(s, { chars: styleChars[k] || 0 }));
  const totalChars = styles.reduce((a, s) => a + s.chars, 0) || 1;
  const isHeadingTag = (s) => Object.keys(s.tags).some((t) => /^h[1-6]$/.test(t));

  // Body: the size with the most characters among running-text sizes.
  const sizeChars = {};
  styles.filter((s) => s.size >= 13 && s.size <= 19 && !isHeadingTag(s)).forEach((s) => { sizeChars[s.size] = (sizeChars[s.size] || 0) + s.chars; });
  const bodySize = +((top(sizeChars, 1)[0] || [16])[0]);
  const bestAt = (pred) => styles.filter(pred).sort((a, b) => b.chars - a.chars)[0];
  const bodyStyle = bestAt((s) => s.size === bodySize && !isHeadingTag(s)) || { size: 16, weight: 400, lineHeight: 24, letterSpacing: 0, family: 'system-ui', transform: 'none', samples: [] };

  // Headings: cluster sizes within 12%.
  const headingStyles = styles.filter((s) => (isHeadingTag(s) || (s.size >= bodySize * 1.3 && s.weight >= 500)) && s.size >= bodySize * 1.12);
  const sizesDesc = [...new Set(headingStyles.map((s) => s.size))].sort((a, b) => b - a);
  const clusters = [];
  for (const sz of sizesDesc) {
    const c = clusters[clusters.length - 1];
    if (c && sz >= c.top * 0.88) c.sizes.push(sz);
    else clusters.push({ top: sz, sizes: [sz] });
  }
  clusters.forEach((c) => {
    const members = headingStyles.filter((s) => c.sizes.includes(s.size));
    c.chars = members.reduce((a, s) => a + s.chars, 0);
    c.rep = members.sort((a, b) => b.chars - a.chars)[0];
  });
  const headingClusters = clusters.slice(0, 5);
  const roleOf = (s, extra) => s && Object.assign({
    family: s.family, primary: primaryFamily(s.family), size: s.size, weight: s.weight,
    lineHeight: r3(s.lineHeight / s.size), letterSpacing: r3(s.letterSpacing / s.size), transform: s.transform,
    sample: (s.samples || [])[0] || '', share: r3(s.chars / totalChars),
  }, extra || {});

  const roles = {};
  const headingNames = ['display', 'h1', 'h2', 'h3', 'h4'];
  headingClusters.forEach((c, i) => { roles[headingNames[i]] = roleOf(c.rep, { clusterSizes: c.sizes }); });
  if (headingClusters.length < 5) assume('Typography', `Found ${headingClusters.length} heading size clusters; missing heading roles are interpolated from the measured scale and flagged inferred.`);
  roles.body = roleOf(bodyStyle);
  const smallestHeading = headingClusters.length ? headingClusters[headingClusters.length - 1].top : bodySize * 1.5;
  const leadStyle = bestAt((s) => s.size > bodySize * 1.06 && s.size < smallestHeading * 0.97 && !isHeadingTag(s) && s.weight < 600 && (s.tags.p || s.tags.span || s.tags.div));
  const smallStyle = bestAt((s) => s.size < bodySize * 0.95 && s.size >= 10);
  if (smallStyle) roles.small = roleOf(smallStyle);
  else { roles.small = Object.assign(roleOf(bodyStyle), { size: r2(bodySize * 0.875), inferred: true }); assume('Typography', 'No text smaller than body; small = 0.875 x body.'); }

  // Scale ratio from measured roles.
  const measured = ['small', 'body', ...headingNames.slice(0, headingClusters.length).reverse()].map((k) => roles[k] && roles[k].size).filter(Boolean);
  const steps = [];
  for (let i = 1; i < measured.length; i++) if (measured[i] > measured[i - 1]) steps.push(measured[i] / measured[i - 1]);
  const ratio = r3(steps.length ? Math.pow(measured[measured.length - 1] / measured[0], 1 / (measured.length - 1)) : 1.25);
  const nearest = INTERVALS.reduce((b, iv) => (Math.abs(iv[1] - ratio) < Math.abs(b[1] - ratio) ? iv : b), INTERVALS[0]);
  if (leadStyle) roles.lead = roleOf(leadStyle);
  else { roles.lead = Object.assign(roleOf(bodyStyle), { size: r2(bodySize * Math.sqrt(ratio)), lineHeight: roles.body.lineHeight, inferred: true }); assume('Typography', 'No lead paragraph style found; lead = body x sqrt(scale ratio).'); }
  // Fill missing heading roles geometrically between the smallest measured heading and lead.
  const nMissing = 5 - headingClusters.length;
  if (nMissing > 0) {
    const from = headingClusters.length ? roles[headingNames[headingClusters.length - 1]] : Object.assign({}, roles.body, { size: r2(bodySize * Math.pow(ratio, 5)), weight: 700, lineHeight: 1.15 });
    const floor = Math.max(roles.lead.size, bodySize) * 1.04;
    for (let j = 1; j <= nMissing; j++) {
      const i = headingClusters.length + j - 1;
      const t = headingClusters.length ? j / (nMissing + 1) : (j - 1) / nMissing;
      const size = r2(Math.max(floor, from.size * Math.pow(floor / from.size, t)));
      roles[headingNames[i]] = Object.assign({}, from, { size, inferred: true, sample: '', clusterSizes: undefined });
    }
  }

  // Mobile sizes, matched by identical text between the 1440 and 390 passes.
  const mobileBy = new Map((mobile ? mobile.textIndex : []).map((t) => [t.t, t.s]));
  const desk = home.textIndex || [];
  const roleOrder = ['display', 'h1', 'h2', 'h3', 'h4', 'lead', 'body', 'small'];
  let matchedRoles = 0;
  roleOrder.forEach((k) => {
    const role = roles[k];
    const sizes = (role.clusterSizes || [role.size]);
    const ms = desk.filter((t) => sizes.some((s) => Math.abs(t.s - s) <= s * 0.03) && mobileBy.has(t.t)).map((t) => mobileBy.get(t.t));
    if (ms.length && !role.inferred) { role.mobileSize = r2(median(ms)); role.mobileMatches = ms.length; matchedRoles++; }
    else { role.mobileSize = null; }
  });
  // Unmatched roles: scale by the median measured mobile/desktop ratio of headings, never below body.
  const hr = roleOrder.slice(0, 5).map((k) => roles[k]).filter((r) => r.mobileSize).map((r) => r.mobileSize / r.size);
  const headRatio = hr.length ? median(hr) : 0.7;
  roleOrder.forEach((k, i) => {
    const role = roles[k];
    if (role.mobileSize == null) {
      role.mobileSize = i < 5 ? r2(Math.max(roles.body.size * 1.05, role.size * headRatio)) : role.size;
      role.mobileInferred = true;
    }
    role.mobileSize = Math.min(role.mobileSize, role.size);
    role.clamp = clampFor(role.mobileSize, role.size);
  });
  if (!mobile) assume('Typography', 'No 390px pass in the snapshot; mobile sizes inferred.');
  else assume('Typography', `Mobile sizes matched by identical text for ${matchedRoles} of 8 roles; others scaled by the median heading ratio ${r2(headRatio)}.`);

  // Fonts.
  const fontChars = {};
  const fontWeights = {};
  pages.forEach((p) => Object.entries(p.fonts).forEach(([stack, f]) => {
    const fam = primaryFamily(stack);
    fontWeights[fam] = fontWeights[fam] || {};
    Object.entries(f.weights).forEach(([w, n]) => { fontWeights[fam][w] = (fontWeights[fam][w] || 0) + n; });
  }));
  const famMaps = pages.map((p) => { const m = {}; Object.entries(p.fonts).forEach(([stack, f]) => { const fam = primaryFamily(stack); m[fam] = (m[fam] || 0) + f.chars; }); return m; });
  Object.assign(fontChars, mergeMaps(famMaps));
  const fontTotal = sum(fontChars) || 1;
  const stacks = {};
  pages.forEach((p) => Object.keys(p.fonts).forEach((s) => { const f = primaryFamily(s); if (!stacks[f] || s.length > stacks[f].length) stacks[f] = s; }));
  const families = top(fontChars).map(([fam, n]) => ({
    family: fam, stack: stacks[fam], share: r3(n / fontTotal), chars: n,
    weights: top(fontWeights[fam] || {}).map(([w, c]) => ({ weight: +w, share: r3(c / (sum(fontWeights[fam]) || 1)) })),
    generic: GENERIC.test(fam),
  })).filter((f) => f.share >= 0.01);
  const typefaces = families.filter((f) => f.share >= 0.02);
  const rootVars = Object.assign({}, ...pages.map((p) => p.rootVars));
  const typeVars = Object.entries(rootVars).filter(([k, v]) => /font|text|type|leading|line-height|letter|tracking|heading|size/i.test(k) && v.length < 120).slice(0, 40);
  const sizesInUse = top(sizeCharsAll(styles)).slice(0, 16).map(([s, n]) => ({ size: +s, share: r3(n / totalChars) }));

  // ---------- Colour ----------
  const textColors = mergeMaps(pages.map((p) => p.textColors));
  const pairs = mergeMaps(pages.map((p) => p.pairs));
  const bgArea = mergeMaps(pages.map((p) => p.bgColors));
  const borders = mergeMaps(pages.map((p) => p.borderColors));
  const fills = mergeMaps(pages.map((p) => p.fillColors));
  const groundChars = {};
  Object.entries(pairs).forEach(([k, n]) => { const bg = k.split('|')[1]; groundChars[bg] = (groundChars[bg] || 0) + n; });
  const opaqueBg = Object.fromEntries(Object.entries(bgArea).filter(([h]) => h.length === 7));
  pages.forEach((p) => { if (p.rootBg && p.rootBg.length === 7) opaqueBg[p.rootBg] = (opaqueBg[p.rootBg] || 0) + p.pageArea * 0.25; });
  const bgTotal = sum(opaqueBg) || 1;
  const textTotal = sum(textColors) || 1;

  const background = (top(groundChars).find(([h]) => !C.isDark(h)) || top(groundChars)[0] || ['#ffffff'])[0];
  const darkBg = !C.isDark(background);
  const surface = (top(opaqueBg).find(([h]) => h !== background && C.isDark(h) === C.isDark(background) && C.deltaOk(h, background) < 0.12 && C.chroma(h) < 0.05) || [null])[0];
  const inverseCands = Object.keys({ ...opaqueBg, ...groundChars }).filter((h) => C.isDark(h) === darkBg && C.contrast(h, background) >= 4.5)
    .map((h) => [h, (opaqueBg[h] || 0) / bgTotal + (groundChars[h] || 0) / textTotal]).sort((a, b) => b[1] - a[1]);
  let surfaceInverse = (inverseCands.find(([h]) => C.chroma(h) < 0.08) || inverseCands[0] || [null])[0];
  const fgOn = (bg) => top(Object.fromEntries(Object.entries(pairs).filter(([k]) => k.split('|')[1] === bg).map(([k, n]) => [k.split('|')[0], n])));
  const text = (fgOn(background)[0] || top(textColors)[0] || ['#111111'])[0];
  const neutralsOnLight = Object.entries(pairs).filter(([k]) => C.isDark(k.split('|')[1]) === C.isDark(background)).reduce((m, [k, n]) => { const f = k.split('|')[0]; m[f] = (m[f] || 0) + n; return m; }, {});
  const textMuted = (top(neutralsOnLight).find(([h]) => h !== text && C.chroma(h) < 0.05 && C.deltaOk(h, text) > 0.06 && C.contrast(h, background) >= 2.5) || [null])[0];
  if (!surfaceInverse) { surfaceInverse = text; assume('Colour', 'No dark ground found; surface-inverse = text colour.'); }
  const textInverse = (fgOn(surfaceInverse)[0] || [background])[0];

  // Buttons.
  const allButtons = pages.flatMap((p, i) => p.buttons.map((b) => Object.assign({ page: i }, b)));
  const btnKind = (b) => {
    if (b.backdrop || (b.bg && b.bg.length === 9 && b.bg !== '#00000000')) return 'translucent';
    if (b.bg && b.bg.length === 7 && b.bg !== b.ground) return 'filled';
    if (b.gradient) return 'filled';
    if (b.borderColor) return 'outline';
    return 'text';
  };
  const variantsMap = {};
  allButtons.forEach((b) => {
    const kind = btnKind(b);
    if (kind === 'text') return;
    const k = [kind, b.bg, b.color, b.borderColor, b.pill ? 'pill' : b.radius].join('|');
    const v = variantsMap[k] = variantsMap[k] || { kind, bg: b.bg, color: b.color, borderColor: b.borderColor, borderWidth: b.borderWidth, radius: b.radius, pill: b.pill, count: 0, labels: [], heights: [], paddings: [], font: b.font, grounds: {}, backdrop: b.backdrop, gradient: b.gradient, pages: new Set() };
    v.count++; v.pages.add(b.page);
    if (v.labels.length < 6 && !v.labels.includes(b.label)) v.labels.push(b.label);
    v.heights.push(b.height); v.paddings.push(b.padding);
    v.grounds[b.ground] = (v.grounds[b.ground] || 0) + 1;
  });
  const buttonVariants = Object.values(variantsMap).map((v) => Object.assign(v, {
    height: median(v.heights), padding: v.paddings.sort((a, b) => b[1] - a[1])[v.paddings.length >> 1], ground: top(v.grounds)[0][0], pages: v.pages.size,
    heights: undefined, paddings: undefined,
  })).sort((a, b) => b.count - a.count).slice(0, 8);
  const filled = buttonVariants.filter((v) => v.kind === 'filled' && v.bg);
  const actionV = filled.slice().sort((a, b) => (C.chroma(b.bg) > 0.06) - (C.chroma(a.bg) > 0.06) || b.count - a.count)[0];
  const action = actionV ? actionV.bg : (top(fills).find(([h]) => C.chroma(h) > 0.08) || [text])[0];
  if (!actionV) assume('Colour', 'No filled button found; action colour taken from the most-used chromatic fill.');
  const onAction = actionV ? actionV.color : (C.contrast('#ffffff', action) > C.contrast('#111111', action) ? '#ffffff' : '#111111');
  const altV = filled.find((v) => C.deltaOk(v.bg, action) > 0.08 && v.bg !== background) || buttonVariants.find((v) => v.kind === 'outline' && v.borderColor && C.deltaOk(v.borderColor, action) > 0.08);
  const actionAlt = altV ? (altV.kind === 'outline' ? altV.borderColor : altV.bg) : surfaceInverse;
  const chromaPool = {};
  const addPool = (m, w) => { const t = sum(m) || 1; Object.entries(m).forEach(([h, n]) => { if (h.length === 7) chromaPool[h] = (chromaPool[h] || 0) + (n / t) * w; }); };
  addPool(textColors, 1); addPool(opaqueBg, 1); addPool(borders, 0.5); addPool(fills, 0.7);
  const accent = (top(chromaPool).find(([h]) => C.chroma(h) > 0.07 && C.deltaOk(h, action) > 0.08 && C.deltaOk(h, actionAlt) > 0.05) || [null])[0];
  const borderTop = top(borders).map(([h]) => (h.length === 9 ? C.composite(h, background) : h)).find((h) => h !== background && C.deltaOk(h, text) > 0.1);
  const border = borderTop || mix(text, background, 0.15);
  if (!borderTop) assume('Colour', 'No border colour measured; border = 15% text over background.');
  if (!accent) assume('Colour', 'No second chromatic colour; accent = action-alt.');

  const share = (hex, map) => r3((map[hex] || 0) / (sum(map) || 1));
  const roleList = [
    ['background', background, share(background, opaqueBg), 'painted area'],
    ['surface', surface || mix(background, text, 0.04), surface ? share(surface, opaqueBg) : 0, surface ? 'painted area' : 'inferred'],
    ['surface-inverse', surfaceInverse, share(surfaceInverse, opaqueBg), 'painted area'],
    ['text', text, share(text, textColors), 'characters'],
    ['text-muted', textMuted || mix(text, background, 0.4), textMuted ? share(textMuted, textColors) : 0, textMuted ? 'characters' : 'inferred'],
    ['text-inverse', textInverse, share(textInverse, textColors), 'characters'],
    ['action', action, actionV ? r3(actionV.count / (allButtons.length || 1)) : 0, 'buttons'],
    ['on-action', onAction, share(onAction, textColors), 'characters'],
    ['action-alt', actionAlt, altV ? r3(altV.count / (allButtons.length || 1)) : 0, altV ? 'buttons' : 'inferred'],
    ['accent', accent || actionAlt, accent ? r3(chromaPool[accent] / (sum(chromaPool) || 1)) : 0, accent ? 'mixed usage' : 'inferred'],
    ['border', border, borderTop ? r3((borders[borderTop] || 0) / (sum(borders) || 1)) : 0, borderTop ? 'border count' : 'inferred'],
  ];
  if (!surface) assume('Colour', 'No distinct light surface; surface = 4% text over background.');
  if (!textMuted) assume('Colour', 'No muted text colour; text-muted = 40% text over background.');
  const colorRoles = Object.fromEntries(roleList.map(([name, hex, s, basis]) => [name, { hex, oklch: C.oklchString(hex), share: s, basis, inferred: basis === 'inferred', contrastOnBackground: r2(C.contrast(hex, C.isDark(hex) === C.isDark(background) ? surfaceInverse : background)) }]));

  const gradientMap = mergeMaps(pages.map((p) => p.gradients));
  const gradients = top(gradientMap, 6).map(([css, area]) => ({ css, area, stops: (css.match(/rgba?\([^)]*\)/g) || []).map(rgbStringToHex).filter(Boolean) })).filter((g) => g.stops.length >= 2);
  const contrastPairs = top(pairs, 10).map(([k, n]) => { const [fg, bg] = k.split('|'); const ratio = r2(C.contrast(fg, bg)); return { fg, bg, chars: n, share: r3(n / (sum(pairs) || 1)), ratio, level: C.wcagLevel(ratio) }; });
  const palette = top(chromaPool, 28).map(([hex, w]) => ({ hex, oklch: C.oklchString(hex), weight: r3(w / (sum(chromaPool) || 1)) }));

  // ---------- Layout ----------
  const pad = mergeMaps(pages.map((p) => p.spacing.padding));
  const mar = mergeMaps(pages.map((p) => p.spacing.margin));
  const gap = mergeMaps(pages.map((p) => p.spacing.gap));
  const spaceAll = {};
  [pad, mar, gap].forEach((m) => Object.entries(m).forEach(([k, n]) => { spaceAll[k] = (spaceAll[k] || 0) + n; }));
  const spaceTotal = sum(spaceAll) || 1;
  const shareDiv = (b) => Object.entries(spaceAll).filter(([v]) => +v % b === 0).reduce((a, [, n]) => a + n, 0) / spaceTotal;
  const s8 = shareDiv(8), s4 = shareDiv(4), s2 = shareDiv(2);
  const base = s8 >= 0.7 ? 8 : s4 >= 0.75 ? 4 : 2;
  const onGrid = top(spaceAll).filter(([v]) => +v % base === 0).map(([v, n]) => ({ value: +v, count: n }));
  const offGrid = top(spaceAll).filter(([v]) => +v % base !== 0).map(([v, n]) => ({ value: +v, count: n }));
  const spaceScale = [...new Set(onGrid.filter((x) => x.value <= 160).slice(0, 12).map((x) => x.value))].sort((a, b) => a - b);
  const radiiMap = mergeMaps(pages.map((p) => p.radii));
  const radiiList = top(radiiMap).map(([v, n]) => ({ value: v === 'pill' ? 'pill' : +v, count: n }));
  const pillShare = r3((radiiMap.pill || 0) / (sum(radiiMap) || 1));
  const maxW = mergeMaps(pages.map((p) => p.maxWidths));
  const vwDesk = (home.viewport && home.viewport.w) || 1440;
  const containerTop = top(maxW).find(([v]) => +v >= 960 && +v <= Math.min(1600, vwDesk - 40));
  const container = containerTop ? +containerTop[0] : 1200;
  if (!containerTop) assume('Layout', 'No max-width container between 960 and 1600px; container = 1200px.');
  const cols = mergeMaps(pages.map((p) => p.gridCols));
  const colTop = top(cols).find(([v]) => +v >= 2 && +v <= 12);
  const cardSibs = pages.flatMap((p) => p.cards.map((c) => c.siblings)).filter((n) => n >= 2 && n <= 6);
  const columns = colTop ? +colTop[0] : (cardSibs.length ? Math.round(median(cardSibs)) : 12);
  if (!colTop) assume('Layout', `No CSS grid columns measured; columns = ${columns} from repeated card siblings.`);
  const gutters = mergeMaps(pages.map((p) => p.gridGaps));
  // Layout gutters are rarely below 16px; smaller gaps belong to compact UI rows.
  const gutterTop = top(gutters).find(([v]) => +v >= 16) || top(gap).find(([v]) => +v >= 16) || top(gutters)[0];
  const gutter = gutterTop ? +gutterTop[0] : base * 3;
  if (gutterTop && top(gutters)[0] && top(gutters)[0][0] !== gutterTop[0]) assume('Layout', `Most common grid gap is ${top(gutters)[0][0]}px (compact UI rows); gutter = the most common gap of 16px or more (${gutter}px).`);
  const bpMap = mergeMaps(pages.map((p) => p.breakpoints));
  const breakpoints = [...new Set(top(bpMap).filter(([, n]) => n >= 1).slice(0, 12).map(([k]) => +k.split(':')[1]))].filter((v) => v >= 320 && v <= 1920).sort((a, b) => a - b);
  const rhythm = sectionRhythm(home);
  const shadowsMap = mergeMaps(pages.map((p) => p.shadows));
  const easingMap = mergeMaps(pages.map((p) => p.transitions.easing));
  const durMap = mergeMaps(pages.map((p) => p.transitions.duration));
  const easing = (top(easingMap).find(([e]) => e.startsWith('cubic-bezier')) || top(easingMap)[0] || ['cubic-bezier(0.2, 0, 0, 1)'])[0];
  if (!Object.keys(easingMap).length) assume('Motion', 'No transitions measured; easing = cubic-bezier(0.2, 0, 0, 1).');
  const duration = (top(durMap)[0] || ['0.3s'])[0];

  // ---------- Components ----------
  const cardsAll = pages.flatMap((p) => p.cards);
  const cardMap = {};
  cardsAll.forEach((c) => {
    const k = [c.bg, c.radius, !!c.shadow, !!c.backdrop, !!c.media].join('|');
    const v = cardMap[k] = cardMap[k] || { bg: c.bg, radius: c.radius, shadow: c.shadow, backdrop: c.backdrop, borderColor: c.borderColor, media: c.media, paddings: [], count: 0, titles: [], ground: c.ground };
    v.count += c.siblings; v.paddings.push(c.padding);
    if (c.title && v.titles.length < 4) v.titles.push(c.title);
  });
  const cardVariants = Object.values(cardMap).map((v) => Object.assign(v, { padding: v.paddings[v.paddings.length >> 1], paddings: undefined, fill: v.bg && v.bg.length === 7 ? 'solid' : v.backdrop ? 'glass' : 'none' })).sort((a, b) => b.count - a.count).slice(0, 6);
  if (!cardVariants.length) {
    const shadow = (top(shadowsMap)[0] || [null])[0];
    const r = (radiiList.find((x) => x.value !== 'pill' && x.value >= 8) || { value: 12 }).value;
    cardVariants.push({ bg: background, radius: r, shadow, backdrop: null, borderColor: shadow ? null : border, media: null, padding: [base * 2, base * 2, base * 2, base * 2], count: 0, titles: [], ground: surface || background, fill: 'solid', inferred: true });
    assume('Components', `No repeated card elements detected; card inferred from the most common radius (${r}px), the most common shadow and the background colour.`);
  }
  const cardRadius = cardVariants.length ? median(cardVariants.slice(0, 3).map((c) => c.radius)) : (radiiList.find((r) => r.value !== 'pill' && r.value >= 8) || { value: 12 }).value;
  const nav = home.header ? Object.assign({}, home.header) : null;
  if (!nav) assume('Components', 'No header element found; nav mock is inferred.');
  const inputsAll = pages.flatMap((p) => p.inputs);
  let input;
  if (inputsAll.length) {
    const i0 = inputsAll.sort((a, b) => b.width - a.width)[0];
    input = { inferred: false, height: i0.height, radius: i0.radius, pill: i0.pill, bg: i0.bg && i0.bg !== '#00000000' ? i0.bg : background, borderColor: i0.borderColor || border, borderWidth: i0.borderWidth || 1, padding: i0.padding, font: i0.font, placeholder: i0.placeholder, color: i0.color };
  } else {
    input = { inferred: true, height: actionV ? actionV.height : 48, radius: actionV ? actionV.radius : 8, pill: actionV ? actionV.pill : false, bg: background, borderColor: border, borderWidth: 1, padding: [0, base * 2, 0, base * 2], font: { size: roles.body.size, weight: 400, family: roles.body.family }, placeholder: '' };
    assume('Components', 'No form fields found; input inferred from button height and border colour.');
  }

  // ---------- Imagery ----------
  const mediaAll = pages.flatMap((p) => p.media.map((m) => Object.assign({ page: p.url }, m)));
  const fmt = {}; const fits = {}; const crops = {};
  mediaAll.forEach((m) => {
    fmt[m.fmt] = (fmt[m.fmt] || 0) + 1;
    if (m.tag === 'img' || m.tag === 'video') fits[m.objectFit] = (fits[m.objectFit] || 0) + 1;
    crops[cropName(m.w / m.h)] = (crops[cropName(m.w / m.h)] || 0) + 1;
  });
  const mTotal = mediaAll.length || 1;
  const altWords = {};
  const STOP = new Set('the a an and or of to in on for with at by from is are this that di da del della dei delle degli il lo la le gli un una uno e ed o con per su in tra fra al alla ai alle nel nella nei nelle sul sulla immagine image foto photo logo icon icona'.split(' '));
  mediaAll.forEach((m) => (m.alt || '').toLowerCase().split(/[^a-zà-ÿ0-9]+/).filter((w) => w.length > 3 && !STOP.has(w)).forEach((w) => { altWords[w] = (altWords[w] || 0) + 1; }));
  const imagery = {
    count: mediaAll.length,
    formats: top(fmt).map(([k, n]) => ({ format: k, share: r3(n / mTotal) })),
    crops: top(crops).map(([k, n]) => ({ crop: k, share: r3(n / mTotal) })),
    objectFit: top(fits).map(([k, n]) => ({ fit: k, share: r3(n / (sum(fits) || 1)) })),
    fullBleedShare: r3(mediaAll.filter((m) => m.fullBleed).length / mTotal),
    inCardShare: r3(mediaAll.filter((m) => m.inCard).length / mTotal),
    mediaAreaShare: r3(pages.reduce((a, p) => a + p.mediaArea, 0) / (pages.reduce((a, p) => a + p.pageArea, 0) || 1)),
    altCoverage: r3(mediaAll.filter((m) => m.alt).length / mTotal),
    altThemes: top(altWords, 12).map(([w, n]) => ({ word: w, count: n })),
    sourcePages: pages.map((p) => ({ url: p.url, title: p.title, media: p.media.length })),
  };

  // ---------- Voice ----------
  const voice = analyseVoice(pages, roles);

  // ---------- Misc ----------
  const brandName = guessBrand(snap);
  const charset = [...new Set(pages.map((p) => p.charset).join(''))].filter((c) => c.trim()).sort().join('');

  return {
    brand: brandName, host: snap.host, origin: snap.origin, capturedAt: snap.capturedAt, source: snap.source,
    pages: pages.map((p) => ({ url: p.url, title: p.title, viewport: p.viewport, elementsVisited: p.elementsVisited, elementsVisible: p.elementsVisible, excludedConsent: p.excludedConsent, scrollHeight: p.scrollHeight })),
    mobile: mobile ? { url: mobile.url, viewport: mobile.viewport, elementsVisible: mobile.elementsVisible, scrollWidth: mobile.scrollWidth } : null,
    picks: snap.picks || null,
    type: { roles, bodySize, ratio, interval: { name: nearest[0], value: nearest[1] }, clusters: clusters.map((c) => ({ top: c.top, sizes: c.sizes, chars: c.chars })), families, typefaces, typeVars, sizesInUse, charset },
    colour: { roles: colorRoles, gradients, contrastPairs, palette, darkGroundShare: r3(Object.entries(opaqueBg).filter(([h]) => C.isDark(h)).reduce((a, [, n]) => a + n, 0) / bgTotal) },
    layout: { base, gridShares: { 8: r3(s8), 4: r3(s4), 2: r3(s2) }, onGrid: onGrid.slice(0, 20), offGrid: offGrid.slice(0, 12), spaceScale, radii: radiiList.slice(0, 12), pillShare, cardRadius, container, columns, gutter, breakpoints, rhythm, shadows: top(shadowsMap, 5).map(([s, n]) => ({ shadow: s, count: n })), easing, duration, easings: top(easingMap, 5) },
    components: { buttons: buttonVariants, cards: cardVariants, nav, input },
    imagery, voice,
    rootVarsCount: Object.keys(rootVars).length,
    assumptions,
  };
}

function sizeCharsAll(styles) { const m = {}; styles.forEach((s) => { m[s.size] = (m[s.size] || 0) + s.chars; }); return m; }

function clampFor(minPx, maxPx, vmin = 390, vmax = 1440) {
  if (Math.abs(maxPx - minPx) < 0.5) return `${r3(maxPx / 16)}rem`;
  const slope = (maxPx - minPx) / (vmax - vmin);
  const icpt = minPx - slope * vmin;
  return `clamp(${r3(minPx / 16)}rem, ${r3(icpt / 16)}rem + ${r3(slope * 100)}vw, ${r3(maxPx / 16)}rem)`;
}

function mix(a, b, t) {
  const x = C.hexToRgb(a), y = C.hexToRgb(b);
  return C.rgbToHex({ r: x.r * t + y.r * (1 - t), g: x.g * t + y.g * (1 - t), b: x.b * t + y.b * (1 - t) });
}

function cropName(ratio) {
  const named = [['21:9', 2.33], ['16:9', 1.78], ['3:2', 1.5], ['4:3', 1.33], ['1:1', 1], ['4:5', 0.8], ['3:4', 0.75], ['9:16', 0.56]];
  if (ratio > 2.6) return 'panorama';
  return named.reduce((b, n) => (Math.abs(n[1] - ratio) < Math.abs(b[1] - ratio) ? n : b))[0];
}

function sectionRhythm(home) {
  const bands = [];
  (home.sections || []).forEach((s) => {
    // Drop bands nested inside an earlier band.
    if (bands.some((b) => s.top >= b.top - 2 && s.top + s.h <= b.top + b.h + 2 && s.tag !== 'footer')) return;
    bands.push(s);
  });
  const total = home.scrollHeight || 1;
  return bands.map((b) => ({ top: b.top, h: b.h, share: r3(b.h / total), bg: b.bg, tone: C.chroma(b.bg) > 0.1 ? 'colour' : C.isDark(b.bg) ? 'dark' : 'light', gradient: b.gradient, image: b.image, tag: b.tag }));
}

function analyseVoice(pages, roles) {
  const lines = [];
  const fix = (t) => t.replace(/([.!?])([A-ZÀ-Ý])/g, '$1 $2').trim();
  const PRICE = /^[€$£]|[€$£]\s?\d|\d[\d.,]{4,}/;
  const headMin = Math.max(20, roles.h2.size * 0.95);
  pages.forEach((p) => {
    p.headings.forEach((h) => lines.push({ kind: h.tag, text: fix(h.text), url: p.url }));
    // Many sites style headlines on divs and spans: take headline-sized text from the text index too.
    (p.textIndex || []).forEach((t) => {
      if (t.s >= headMin && t.w >= 500 && !PRICE.test(t.t) && t.t.split(/\s+/).length >= 2) lines.push({ kind: t.s >= roles.h1.size * 0.95 ? 'h1' : 'h2', text: fix(t.t), url: p.url });
    });
    p.paragraphs.forEach((x) => lines.push({ kind: 'p', text: fix(x.text), url: p.url }));
  });
  const seen = new Set();
  const uniq = lines.filter((l) => { const k = l.text.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  const words = (t) => t.split(/\s+/).filter(Boolean);
  const heads = uniq.filter((l) => /^h[1-3]$/.test(l.kind));
  const hw = heads.map((l) => words(l.text).length);
  const caseOf = (t) => {
    const w = words(t).filter((x) => /^[A-Za-zÀ-ÿ]/.test(x));
    if (!w.length) return 'other';
    if (t === t.toUpperCase() && /[A-Z]/.test(t)) return 'upper';
    const capsAfter = w.slice(1).filter((x) => x[0] === x[0].toUpperCase() && x.length > 3).length;
    const longAfter = w.slice(1).filter((x) => x.length > 3).length || 1;
    if (w.length > 2 && capsAfter / longAfter > 0.6) return 'title';
    if (w[0][0] === w[0][0].toUpperCase()) return 'sentence';
    return 'lower';
  };
  const cases = {};
  heads.forEach((l) => { const c = caseOf(l.text); cases[c] = (cases[c] || 0) + 1; });
  const YOU = /\b(you|your|yours|tu|ti|te|tuo|tua|tuoi|tue|voi|vostro|vostra|vostri|vostre)\b/gi;
  const WE = /\b(we|our|ours|us|noi|nostro|nostra|nostri|nostre)\b/gi;
  const all = uniq.map((l) => l.text).join(' \n ');
  const you = (all.match(YOU) || []).length;
  const we = (all.match(WE) || []).length;
  const withNum = uniq.filter((l) => /\d/.test(l.text)).length;
  const xy = heads.filter((l) => /^[^,]{2,40}, [^,]{2,40}[.!?]?$/.test(l.text)).length;
  const excl = uniq.filter((l) => l.text.includes('!')).length;
  const ctaMap = {};
  const ctaLabels = [...new Set(pages.flatMap((p) => p.ctas))];
  ctaLabels.forEach((c) => { const w = (c.split(/\s+/)[0] || '').toLowerCase().replace(/[^a-zà-ÿ]/g, ''); if (w) ctaMap[w] = (ctaMap[w] || 0) + 1; });
  const stats = {
    lines: uniq.length, headlines: heads.length,
    headlineWords: { mean: r2(hw.reduce((a, b) => a + b, 0) / (hw.length || 1)), median: median(hw) || 0, max: Math.max(0, ...hw) },
    case: Object.fromEntries(Object.entries(cases).map(([k, n]) => [k, r3(n / (heads.length || 1))])),
    you, we,
    numbersShare: r3(withNum / (uniq.length || 1)),
    xyPatternShare: r3(xy / (heads.length || 1)),
    exclamations: excl,
    ctaCount: ctaLabels.length,
    ctaFirstWords: top(ctaMap, 8).map(([w, n]) => ({ word: w, count: n })),
    ctaMeanWords: r2(ctaLabels.reduce((a, c) => a + words(c).length, 0) / (ctaLabels.length || 1)),
  };
  // Five quotes, 15 words or fewer, spread over pages.
  const quotes = [];
  const byPriority = [...uniq].filter((l) => words(l.text).length >= 3 && words(l.text).length <= 15 && !/©|cookie|privacy/i.test(l.text))
    .sort((a, b) => (/^h[12]$/.test(b.kind) - /^h[12]$/.test(a.kind)) || (a.kind === 'p') - (b.kind === 'p'));
  const usedPages = {};
  // Skip templated near-duplicates ("Case in vendita su X" vs "Loft in vendita su X").
  const wordset = (t) => new Set(t.toLowerCase().split(/[^a-zà-ÿ0-9.]+/).filter(Boolean));
  const similar = (x, y) => { const A = wordset(x), B = wordset(y); const inter = [...A].filter((w) => B.has(w)).length; return inter / Math.max(1, Math.min(A.size, B.size)) >= 0.6; };
  for (const l of byPriority) {
    if (quotes.length >= 5) break;
    if ((usedPages[l.url] || 0) >= 3 && byPriority.length > 8) continue;
    if (quotes.some((q) => similar(q.text, l.text))) continue;
    usedPages[l.url] = (usedPages[l.url] || 0) + 1;
    quotes.push(l);
  }
  for (const l of byPriority) { if (quotes.length >= 5) break; if (!quotes.includes(l)) quotes.push(l); }

  // Three rules from the stats, strongest evidence first.
  const cand = [];
  const dominantCase = top(cases)[0];
  if (dominantCase) cand.push({ weight: dominantCase[1] / (heads.length || 1), title: `Use ${dominantCase[0]} case for headlines`, evidence: `${Math.round((dominantCase[1] / (heads.length || 1)) * 100)}% of ${heads.length} headlines are ${dominantCase[0]} case.` });
  cand.push({ weight: stats.headlineWords.median <= 8 ? 0.9 : 0.6, title: `Keep headlines to about ${Math.max(3, Math.round(stats.headlineWords.median || 6))} words`, evidence: `Median ${stats.headlineWords.median} words, mean ${stats.headlineWords.mean}, longest ${stats.headlineWords.max}.` });
  if (you + we > 0) cand.push({ weight: Math.abs(you - we) / (you + we), title: you >= we ? 'Address the reader directly' : 'Speak as the company ("we")', evidence: `Second-person forms: ${you}. First-person plural forms: ${we}.` });
  const topVerb = stats.ctaFirstWords[0];
  if (topVerb) cand.push({ weight: 0.7, title: 'Start calls to action with a verb', evidence: `${stats.ctaCount} CTA labels, mean ${stats.ctaMeanWords} words. Most common first words: ${stats.ctaFirstWords.slice(0, 4).map((w) => `"${w.word}" (${w.count})`).join(', ')}.` });
  cand.push({ weight: excl === 0 ? 0.65 : 0.3, title: excl === 0 ? 'Do not use exclamation marks' : 'Use exclamation marks sparingly', evidence: `${excl} of ${uniq.length} lines contain "!".` });
  if (stats.numbersShare >= 0.15) cand.push({ weight: 0.6, title: 'Use concrete numbers', evidence: `${Math.round(stats.numbersShare * 100)}% of lines contain a digit.` });
  const rules = cand.sort((a, b) => b.weight - a.weight).slice(0, 3).map((r, i) => ({ n: i + 1, title: r.title, evidence: r.evidence }));
  return { stats, quotes: quotes.slice(0, 5).map((q) => ({ text: q.text, url: q.url, kind: q.kind, words: words(q.text).length })), rules };
}

function guessBrand(snap) {
  const og = snap.pages.map((p) => p.ogSiteName).find(Boolean);
  if (og) return og;
  const titles = snap.pages.map((p) => p.title || '');
  const parts = titles.flatMap((t) => t.split(/\s[|\-–—·:]\s/).map((x) => x.trim())).filter(Boolean);
  const counts = {};
  parts.forEach((p) => { counts[p] = (counts[p] || 0) + 1; });
  const best = top(counts).find(([p, n]) => n > 1 && p.length <= 30);
  if (best) return best[0];
  const h = (snap.host || '').replace(/^www\./, '').split('.')[0];
  return h.charAt(0).toUpperCase() + h.slice(1);
}

module.exports = { analyse, mergeMaps, clampFor, primaryFamily };
