'use strict';
// Social exports: Instagram carousel (8 x 1080x1350) and X images (4 x 1600x900).
// Same tokens and images as the guide. Every slide has an Unofficial badge, plus an AI credit
// when it shows a generated photo. Text sits beside images, never over busy areas.
const fs = require('fs');
const path = require('path');
const C = require('./color');
const { baseCss } = require('./theme');
const { pickButtonVariants } = require('./tokens');
const { esc } = require('./guide');

const slideCss = `
html,body{margin:0;width:var(--w);height:var(--h);overflow:hidden}
.s{position:relative;width:var(--w);height:var(--h);overflow:hidden;display:flex;flex-direction:column}
.light{background:var(--ground-light);color:var(--ink-light)}.dark{background:var(--ground-dark);color:var(--ink-dark)}
.pad{padding:72px}
.photo{position:relative;overflow:hidden}.photo .img{position:absolute;inset:0}
.badge{position:absolute;top:36px;right:36px;z-index:5;background:rgb(0 0 0 / .45);color:#fff;border-color:rgb(255 255 255 / .7);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.light .badge.plain{background:var(--color-background);color:var(--color-text);border-color:var(--color-text)}
.credit{position:absolute;left:24px;bottom:20px;z-index:4;font:600 18px/1 var(--font-body);padding:9px 14px;border-radius:999px;background:rgb(0 0 0 / .55);color:#fff}
.unofficial{font-size:18px;padding:10px 16px}
.kicker{font:600 22px/1.2 var(--font-body);letter-spacing:.06em;text-transform:uppercase;color:var(--color-action)}
.dark .kicker{color:color-mix(in oklab,var(--color-text-inverse) 78%,transparent)}
.h{font-family:var(--font-display);font-weight:var(--type-display-weight);letter-spacing:var(--type-display-tracking);line-height:1.02;margin:16px 0 0}
.p{font:400 28px/1.4 var(--font-body);margin-top:20px;opacity:.85}
.foot{margin-top:auto;display:flex;justify-content:space-between;align-items:end;gap:24px;font:400 18px/1.4 var(--font-body);opacity:.8}
.pal{display:flex;height:90px;border-radius:var(--card-radius);overflow:hidden}
.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.tile{border-radius:calc(var(--card-radius) * .75);padding:18px;min-height:150px;display:flex;flex-direction:column;justify-content:space-between;font:600 22px/1.2 var(--font-body)}
.tile code{font:500 17px/1.4 ui-monospace,Menlo,monospace}
.roles{display:grid;gap:18px}.role{display:flex;align-items:baseline;justify-content:space-between;gap:24px;border-bottom:1px solid var(--color-border);padding-bottom:14px}
.role span:last-child{font:500 18px/1.2 ui-monospace,Menlo,monospace;color:var(--color-text-muted);white-space:nowrap}
.facts{display:grid;grid-template-columns:1fr 1fr;gap:28px}.fact{border-top:3px solid currentColor;padding-top:14px;font:400 22px/1.3 var(--font-body)}
.fact b{display:block;font-family:var(--font-display);font-size:76px;line-height:1;font-weight:var(--type-h1-weight)}
.cols{display:grid;gap:14px;height:120px}.cols i{background:color-mix(in oklab,var(--color-action) 25%,transparent);border-radius:6px}
.stair{display:grid;gap:10px}.stair div{display:grid;grid-template-columns:80px 1fr;gap:14px;align-items:center;font:500 18px/1 ui-monospace,monospace}.stair i{height:22px;background:var(--color-action);border-radius:4px}
.btns{display:grid;grid-template-columns:1fr 1fr;gap:14px}.btns>div{border-radius:var(--card-radius);padding:30px 22px;display:grid;justify-items:start;gap:12px;font:500 17px/1.3 ui-monospace,monospace}
.rb-btn{font-size:22px;min-height:calc(var(--button-height) * 1.25);padding:0 calc(var(--button-pad-x) * 1.2)}
.navm{display:flex;align-items:center;gap:22px;height:calc(var(--nav-height) * 1.3);padding:0 24px;background:var(--nav-bg);color:var(--nav-link-color);border-radius:var(--card-radius);font:var(--nav-link-weight) 22px/1 var(--font-body);overflow:hidden;white-space:nowrap}
.logo{flex:none;width:calc(var(--nav-logo-width) * 1.3);height:calc(var(--nav-logo-height) * 1.3);border:2px dashed var(--nav-logo-color);border-radius:4px;display:grid;place-items:center;font:500 14px/1 ui-monospace,monospace;color:var(--nav-logo-color)}
.quote{font-family:var(--font-display);font-weight:var(--type-h2-weight);font-size:54px;line-height:1.12;letter-spacing:var(--type-h2-tracking)}
.rules{display:grid;gap:14px}.rule{display:grid;grid-template-columns:64px 1fr;gap:16px;align-items:start;font:500 26px/1.3 var(--font-body)}.rule b{font-family:var(--font-display);font-size:44px;line-height:1;color:var(--color-action)}
pre{margin:0;padding:28px;border-radius:var(--card-radius);background:rgb(0 0 0 / .32);color:#e8e8e8;font:20px/1.55 ui-monospace,Menlo,monospace;white-space:pre-wrap;overflow:hidden}
.grad{background:var(--gradient-brand);color:#fff}
`;

function slideDoc(css, w, h, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${css}:root{--w:${w}px;--h:${h}px}${slideCss}</style></head><body>${body}</body></html>`;
}

function buildSlides(ctx) {
  const { a, tokensCss, manifest } = ctx;
  const R = a.colour.roles;
  const T = a.type.roles;
  const v = pickButtonVariants(a);
  const has = (s) => !!(manifest[s] && manifest[s].dataUri);
  const photo = (s, style) => `<div class="photo" style="${style}"><div class="img img-${s}"></div>${has(s) ? '<span class="credit">AI-generated image</span>' : ''}</div>`;
  const badge = (plain) => `<span class="unofficial badge${plain ? ' plain' : ''}">Unofficial analysis</span>`;
  const foot = `<div class="foot"><span>Not affiliated with or endorsed by ${esc(a.brand)}.<br>Trademarks belong to their owners.</span><span>${esc(a.host)}</span></div>`;
  const ink = (hex) => (C.contrast(hex, R.text.hex) >= C.contrast(hex, R['text-inverse'].hex) ? 'var(--color-text)' : 'var(--color-text-inverse)');
  const roleRows = ['display', 'h1', 'h3', 'lead', 'body', 'small'].map((k) => `<div class="role"><span style="font-family:var(--type-${k}-family);font-size:${Math.min(T[k].size, 72)}px;font-weight:${T[k].weight};letter-spacing:${T[k].letterSpacing}em;line-height:1.1">${k === 'display' ? 'Display' : k === 'h1' ? 'Heading' : k === 'h3' ? 'Subhead' : k === 'lead' ? 'Lead' : k === 'body' ? 'Body' : 'Small'}</span><span>${T[k].size}px · ${T[k].weight} · ${T[k].lineHeight}</span></div>`).join('');
  const tiles = (n) => Object.entries(R).slice(0, n).map(([k, c]) => `<div class="tile" style="background:var(--color-${k});color:${ink(c.hex)}">${k}<code>${c.hex}<br>${esc(c.oklch)}</code></div>`).join('');
  const pal = `<div class="pal">${a.colour.palette.slice(0, 10).map((p) => `<span style="flex:${Math.max(0.02, p.weight)};background:${p.hex}"></span>`).join('')}</div>`;
  const btns = ['primary', 'secondary', 'outline', 'translucent'].map((k) => `<div style="background:var(--button-${k}-ground);color:${ink((v[k].ground || '#000000').slice(0, 7))}"><span class="rb-btn${k === 'primary' ? '' : ' rb-btn--' + k}"${k === 'outline' && C.isDark((v[k].ground || '#000000').slice(0, 7)) ? ' style="color:var(--color-text-inverse);border-color:var(--color-text-inverse)"' : ''}>${esc((v[k].source && v[k].source.labels[0]) || k)}</span>${k}${v[k].measured ? '' : ' · inferred'}</div>`).join('');
  const navm = `<div class="navm"><span class="logo">logo</span>${(a.components.nav ? a.components.nav.links : []).slice(0, 4).map((l) => `<span>${esc(l)}</span>`).join('')}</div>`;
  const stair = a.layout.spaceScale.slice(0, 8).map((s) => `<div><span>${s}px</span><i style="width:${Math.min(100, (s / Math.max(...a.layout.spaceScale)) * 100)}%"></i></div>`).join('');
  const tokenExcerpt = tokensCss.split('\n').filter((l) => /--(color-(action|text|background|surface-inverse)|type-(display|body)-size|space-base|radius-(card|button)|motion-ease):/.test(l)).map((l) => l.replace(/\s*\/\*.*\*\/$/, '').trim()).slice(0, 12).join('\n');
  const q = a.voice.quotes[0] || { text: '' };

  const ig = [
    ['cover', `<div class="s dark">${photo('hero', 'height:56%')}${badge()}<div class="pad" style="flex:1;display:flex;flex-direction:column;padding-top:48px"><div class="kicker">Brand guidelines</div><div class="h" style="font-size:96px">${esc(a.brand)}</div><div class="p">Measured from ${a.pages.length} pages of ${esc(a.host)}.</div>${foot}</div></div>`],
    ['typography', `<div class="s light pad">${badge(true)}<div class="kicker">Typography</div><div class="h" style="font-size:72px;margin-bottom:40px">${esc(T.display.primary)}</div><div class="roles">${roleRows}</div>${foot}</div>`],
    ['colour', `<div class="s dark pad">${badge()}<div class="kicker">Colour</div><div class="h" style="font-size:72px;margin-bottom:36px">${a.colour.palette.length} colours</div>${pal}<div class="tiles" style="margin-top:20px">${tiles(9)}</div>${foot}</div>`],
    ['layout', `<div class="s light pad">${badge(true)}<div class="kicker">Layout and spacing</div><div class="facts" style="margin:36px 0">${[[a.layout.base + 'px', 'Spacing base'], [a.layout.columns, 'Columns'], [a.layout.gutter + 'px', 'Gutter'], [a.layout.container + 'px', 'Container']].map(([b, s]) => `<div class="fact"><b>${b}</b>${s}</div>`).join('')}</div><div class="cols" style="grid-template-columns:repeat(${a.layout.columns},1fr)">${'<i></i>'.repeat(a.layout.columns)}</div><div class="stair" style="margin-top:32px">${stair}</div>${foot}</div>`],
    ['components', `<div class="s dark pad">${badge()}<div class="kicker">Components</div><div class="h" style="font-size:72px;margin-bottom:36px">Buttons and nav</div><div class="btns">${btns}</div><div style="margin-top:24px">${navm}</div><input class="rb-input" style="margin-top:24px;height:calc(var(--input-height) * 1.25);font-size:22px" placeholder="${esc(a.components.input.placeholder || 'Input')}">${foot}</div>`],
    ['voice', `<div class="s light">${photo('street', 'height:38%')}${badge()}<div class="pad" style="flex:1;display:flex;flex-direction:column;padding-top:44px"><div class="kicker">Voice and tone</div><div class="quote" style="margin:18px 0 30px">“${esc(q.text)}”</div><div class="rules">${a.voice.rules.map((r) => `<div class="rule"><b>${r.n}</b><span>${esc(r.title)}</span></div>`).join('')}</div>${foot}</div></div>`],
    ['tokens', `<div class="s dark pad">${badge()}<div class="kicker">Design tokens</div><div class="h" style="font-size:72px;margin-bottom:36px">CSS and JSON</div><pre>${esc(tokenExcerpt)}</pre>${foot}</div>`],
    ['outro', `<div class="s grad pad">${badge()}<div style="margin-top:auto"><div class="kicker" style="color:#fff">Unofficial analysis</div><div class="h" style="font-size:84px">${esc(a.brand)} brand guidelines</div><div class="p">Every value measured from the public site, tokenised and rebuilt.</div></div>${foot}</div>`],
  ];
  const x = [
    ['cover', `<div class="s dark" style="flex-direction:row">${photo('hero', 'width:52%')}${badge()}<div class="pad" style="flex:1;display:flex;flex-direction:column"><div class="kicker" style="margin-top:60px">Brand guidelines</div><div class="h" style="font-size:88px">${esc(a.brand)}</div><div class="p">Measured from ${a.pages.length} pages of ${esc(a.host)}.</div>${foot}</div></div>`],
    ['colour', `<div class="s dark pad">${badge()}<div class="kicker">Colour</div><div style="display:grid;grid-template-columns:1fr 1.3fr;gap:40px;margin-top:28px"><div>${pal}<div class="p">${R.action.hex} action · ${R['surface-inverse'].hex} inverse ground · ${R.background.hex} background</div></div><div class="tiles">${tiles(6)}</div></div>${foot}</div>`],
    ['typography', `<div class="s light pad">${badge(true)}<div class="kicker">Typography</div><div style="display:grid;grid-template-columns:1fr 1.4fr;gap:56px;margin-top:20px"><div class="h" style="font-size:180px;line-height:.9">Aa</div><div class="roles">${roleRows}</div></div>${foot}</div>`],
    ['components', `<div class="s dark pad">${badge()}<div class="kicker">Components and tokens</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:28px"><div class="btns">${btns}</div><pre style="font-size:17px">${esc(tokenExcerpt)}</pre></div>${foot}</div>`],
  ];
  const css = baseCss(tokensCss, manifest);
  return {
    ig: ig.map(([name, body], i) => ({ file: `ig-${String(i + 1).padStart(2, '0')}-${name}.png`, w: 1080, h: 1350, html: slideDoc(css, 1080, 1350, body), photo: /class="photo"/.test(body) })),
    x: x.map(([name, body], i) => ({ file: `x-${String(i + 1).padStart(2, '0')}-${name}.png`, w: 1600, h: 900, html: slideDoc(css, 1600, 900, body), photo: /class="photo"/.test(body) })),
  };
}

async function renderSlides(browser, ctx, outDir, log) {
  const dir = path.join(outDir, 'slides');
  fs.mkdirSync(dir, { recursive: true });
  const { ig, x } = buildSlides(ctx);
  for (const s of [...ig, ...x]) {
    const page = await browser.newPage({ viewport: { width: s.w, height: s.h } });
    await page.setContent(s.html, { waitUntil: 'load' });
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(dir, s.file) });
    await page.close();
  }
  log('slides', `${ig.length} Instagram (1080x1350) + ${x.length} X (1600x900) slides`);
  return [...ig, ...x].map((s) => s.file);
}

module.exports = { buildSlides, renderSlides };
