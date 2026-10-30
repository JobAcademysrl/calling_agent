'use strict';
// Renders the art-directed brand guide. Two editions share one template: `light` (gradient
// fallbacks only) and `hero` (AI images embedded once as WebP and reused through classes).
const C = require('./color');
const { baseCss } = require('./theme');
const { pickButtonVariants } = require('./tokens');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (v) => `${Math.round(v * 100)}%`;
const px = (v) => `${Math.round(v * 10) / 10}px`;

function guideCss() {
  return `
.wrap{width:100%;max-width:var(--layout-container);margin:0 auto;padding:0 var(--gutter-x)}
.page{position:relative;min-height:100svh;padding:clamp(72px,10vw,128px) 0;display:flex;flex-direction:column;justify-content:center}
.page.auto{min-height:0}
.on-dark{background:var(--ground-dark);color:var(--ink-dark)}
.on-dark .muted{color:color-mix(in oklab,var(--ink-dark) 68%,transparent)}
.muted{color:var(--color-text-muted)}
.eyebrow{font:600 var(--type-small-size)/1.2 var(--font-body);letter-spacing:.06em;text-transform:uppercase;color:var(--color-action);margin-bottom:var(--space-2,16px)}
.on-dark .eyebrow{color:color-mix(in oklab,var(--color-text-inverse) 78%,transparent)}
.sec-head{display:flex;flex-wrap:wrap;align-items:end;justify-content:space-between;gap:24px;margin-bottom:clamp(32px,5vw,64px)}
.sec-head p{max-width:46ch}
.topbar{position:fixed;inset:0 0 auto 0;z-index:50;height:var(--nav-height);display:flex;align-items:center;transition:background-color .5s var(--motion-ease),box-shadow .5s var(--motion-ease),color .5s var(--motion-ease);color:var(--color-text-inverse)}
.topbar .wrap{display:flex;align-items:center;gap:16px;max-width:none}
.topbar .name{font:600 15px/1 var(--font-display);white-space:nowrap;text-decoration:none}
.topbar nav{display:flex;gap:18px;margin-left:auto;font:500 var(--nav-link-size)/1 var(--font-body);white-space:nowrap}
.topbar nav a{text-decoration:none;opacity:.85}.topbar nav a:hover{opacity:1}
.topbar.solid{background:color-mix(in oklab,var(--color-background) 78%,transparent);-webkit-backdrop-filter:saturate(1.6) blur(18px);backdrop-filter:saturate(1.6) blur(18px);color:var(--color-text);box-shadow:0 1px 0 var(--color-border)}
.topbar .rb-btn{min-height:36px;padding:0 16px;font-size:14px}
@media (max-width:1560px){.topbar nav{display:none}.topbar .rb-btn{margin-left:auto}}
@media (max-width:420px){.topbar .unofficial{display:none}}
.photo{position:relative;overflow:hidden}
.photo>.img{position:absolute;inset:0;animation:kb 26s var(--motion-ease) infinite alternate}
@keyframes kb{from{transform:scale(1)}to{transform:scale(1.07)}}
.scrim::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgb(0 0 0 / .28) 0%,rgb(0 0 0 / 0) 35%,rgb(0 0 0 / .5) 100%);pointer-events:none}
.cover{min-height:100svh;display:flex;align-items:flex-end;color:#fff;padding:calc(var(--nav-height) + 48px) 0 32px}
.cover .wrap{position:relative;z-index:2;display:grid;grid-template-columns:1fr auto;gap:32px;align-items:end}
.cover h1{max-width:12ch;text-wrap:balance}
.cover .lede{margin-top:20px;max-width:44ch;opacity:.92}
.cover .actions{margin-top:32px;display:flex;flex-wrap:wrap;gap:12px}
.token-card{padding:20px 22px;min-width:260px;max-width:320px}
.token-card .swatch{height:84px;border-radius:calc(var(--card-radius) * .6);background:var(--color-action);margin:12px 0}
.token-card code{font:500 13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
.cover-foot{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:12px 20px;align-items:center;margin-top:40px;font-size:13px;opacity:.9}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--layout-gutter);margin-top:56px}
.stat{text-align:center;padding:32px 16px;border-radius:var(--card-radius);background:var(--color-surface)}
.stat b{display:block;font-family:var(--font-display);font-size:var(--type-display-size);font-weight:var(--type-display-weight);line-height:1;letter-spacing:var(--type-display-tracking);color:var(--color-action)}
.stat span{display:block;margin-top:12px}
.center{text-align:center}.center h2{margin:0 auto;max-width:18ch}.center p{margin:16px auto 0;max-width:52ch}
.cards8{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--layout-gutter)}
.pcard{position:relative;display:block;aspect-ratio:4/5;border-radius:var(--card-radius);overflow:hidden;color:#fff;text-decoration:none;isolation:isolate}
.pcard .img{position:absolute;inset:0;transition:transform 1.4s var(--motion-ease)}
.pcard:hover .img,.pcard:focus-visible .img{transform:scale(1.08)}
.pcard::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgb(0 0 0 / .25),rgb(0 0 0 / 0) 40%,rgb(0 0 0 / .55));z-index:1}
.pcard .num{position:absolute;top:18px;left:20px;z-index:2;font:600 14px/1 var(--font-body)}
.pcard .arrow{position:absolute;top:14px;right:14px;z-index:2;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:rgb(255 255 255 / .2);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);transition:transform .6s var(--motion-ease)}
.pcard:hover .arrow{transform:rotate(-45deg)}
.pcard h3{position:absolute;left:20px;right:20px;bottom:20px;z-index:2}
.pcard .ai-label{bottom:auto;top:60px;left:20px}
.split{display:grid;grid-template-columns:1fr 1fr;gap:var(--layout-gutter);align-items:stretch}
.ground{padding:clamp(24px,4vw,48px);border-radius:var(--card-radius);display:grid;gap:20px;align-content:start}
.ground.light{background:var(--ground-light);color:var(--ink-light);box-shadow:inset 0 0 0 1px var(--color-border)}
.ground.dark{background:var(--ground-dark);color:var(--ink-dark)}
.ground>.rb-btn{justify-self:start}
.ground .cards2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.ground.dark .rb-card{background:color-mix(in oklab,var(--color-surface-inverse) 82%,white);color:var(--color-text-inverse)}
.check{font:500 13px/1.5 ui-monospace,Menlo,monospace;padding:12px 14px;border-radius:12px;background:color-mix(in oklab,currentColor 8%,transparent)}
.check .ok{color:#18a058}.check .bad{color:#d03050}
.chapter{min-height:100svh;color:#fff;display:flex;align-items:center}
.chapter .wrap{position:relative;z-index:2}
.specimen{padding:clamp(20px,3vw,36px);max-width:860px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px}
.chip{appearance:none;border:1px solid rgb(255 255 255 / .45);background:transparent;color:inherit;border-radius:var(--radius-button);padding:8px 16px;font:500 14px/1 var(--font-body);cursor:pointer}
.chip[aria-selected=true]{background:#fff;color:var(--color-text);border-color:#fff}
.spec-panel[hidden]{display:none}
.spec-panel .sample{overflow-wrap:anywhere;margin-bottom:20px}
.spec-meta{display:flex;flex-wrap:wrap;gap:8px 20px;font:500 13px/1.4 ui-monospace,Menlo,monospace;opacity:.9}
.families{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:var(--layout-gutter)}
.family{padding:28px;border-radius:var(--card-radius);background:var(--color-surface)}
.family .aa{font-size:clamp(96px,14vw,168px);line-height:.9;font-weight:600;margin:12px 0 20px;overflow:hidden}
.family dl{display:grid;grid-template-columns:auto 1fr;gap:6px 16px;margin:0;font-size:14px}.family dt{color:var(--color-text-muted)}.family dd{margin:0}
.charset{font-size:22px;line-height:1.6;letter-spacing:.06em;word-break:break-all;padding:24px;border-radius:var(--card-radius);background:var(--color-surface)}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--color-border);vertical-align:top}
.on-dark th,.on-dark td{border-color:rgb(255 255 255 / .14)}
th{font-weight:600;color:var(--color-text-muted)}.on-dark th{color:inherit;opacity:.7}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px}
.scroll-x{overflow-x:auto;-webkit-overflow-scrolling:touch}.scroll-x table{min-width:620px}
.bars{display:grid;gap:8px}.bar{display:grid;grid-template-columns:72px 1fr 52px;gap:12px;align-items:center;font-size:13px}
.bar i{display:block;height:10px;border-radius:999px;background:var(--color-action)}
.two{display:grid;grid-template-columns:1fr 1fr;gap:clamp(24px,4vw,56px);align-items:start}
.block{margin-top:clamp(40px,6vw,72px)}
.block>h3{margin-bottom:20px}
.colour-hero{display:grid;grid-template-columns:5fr 7fr;gap:var(--layout-gutter);align-items:stretch}
.colour-hero .photo{border-radius:var(--card-radius);min-height:420px}
.palette-bar{display:flex;height:120px;border-radius:var(--card-radius);overflow:hidden;margin-bottom:16px}
.palette-bar span{min-width:6px}
.roles{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
.role{border-radius:calc(var(--card-radius) * .75);padding:16px;min-height:150px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:inset 0 0 0 1px rgb(255 255 255 / .12)}
.role b{font:600 15px/1.2 var(--font-body)}.role code{font:500 12px/1.5 ui-monospace,Menlo,monospace;display:block}
.gradient-strip{height:140px;border-radius:var(--card-radius);background:var(--gradient-brand)}
details{border-radius:var(--card-radius);background:rgb(255 255 255 / .06);padding:16px 20px}
summary{cursor:pointer;font-weight:600}
.swatches{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-top:16px}
.sw{border-radius:12px;overflow:hidden;font:500 12px/1.4 ui-monospace,Menlo,monospace;background:rgb(255 255 255 / .06)}.sw i{display:block;height:56px}.sw span{display:block;padding:8px}
.facts{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--layout-gutter)}
.fact{border-top:2px solid var(--color-text);padding-top:16px}
.fact b{display:block;font-family:var(--font-display);font-size:var(--type-h1-size);font-weight:var(--type-h1-weight);line-height:1.05;letter-spacing:var(--type-h1-tracking)}
.on-dark .fact{border-color:var(--ink-dark)}
.cols{display:grid;gap:var(--col-gap);height:160px;padding:0;border-radius:12px}
.cols i{background:color-mix(in oklab,var(--color-action) 22%,transparent);border-radius:4px;display:grid;place-items:end center;font:500 11px/1 ui-monospace,monospace;padding-bottom:8px;color:var(--color-action)}
.stair{display:grid;gap:10px}.step{display:grid;grid-template-columns:64px 1fr;gap:16px;align-items:center;font-size:13px}.step i{display:block;height:20px;background:var(--color-action);border-radius:3px}
.radii{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px}
.radius{aspect-ratio:1;border:2px solid var(--color-text);display:grid;place-items:center;font:500 13px/1.3 ui-monospace,monospace;text-align:center}
.ruler{position:relative;height:72px;border-bottom:2px solid var(--color-text);margin:0 8px}
.ruler span{position:absolute;bottom:-2px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;font:500 12px/1.2 ui-monospace,monospace}
.ruler span::after{content:"";width:2px;height:22px;background:var(--color-action);margin-top:6px}
.rhythm{display:grid;gap:3px;border-radius:12px;overflow:hidden;max-width:520px}
.rhythm div{display:flex;justify-content:space-between;align-items:center;padding:0 14px;font:500 12px/1 ui-monospace,monospace}
.comp-hero{display:grid;grid-template-columns:1fr 1fr;gap:var(--layout-gutter);align-items:center;margin-bottom:clamp(40px,6vw,72px)}
.comp-hero .photo{aspect-ratio:4/3;border-radius:var(--card-radius)}
.variants{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
.variant{border-radius:var(--card-radius);padding:28px 20px 18px;display:grid;gap:18px;justify-items:start;box-shadow:inset 0 0 0 1px rgb(255 255 255 / .12)}
.variant .mono{opacity:.8;line-height:1.5}
.variant.light{color:var(--ink-light)}.variant.dark{color:var(--ink-dark)}
.on-dark .variant.light .rb-btn--outline{color:var(--button-outline-fg);border-color:var(--button-outline-border)}
.navmock{display:flex;align-items:center;gap:20px;height:var(--nav-height);padding:0 20px;background:var(--nav-bg);color:var(--nav-link-color);border-radius:var(--card-radius);overflow:hidden}
.logo-ph{flex:none;width:var(--nav-logo-width);height:var(--nav-logo-height);border:1.5px dashed var(--nav-logo-color);border-radius:4px;display:grid;place-items:center;font:500 10px/1 ui-monospace,monospace;color:var(--nav-logo-color);white-space:nowrap;overflow:hidden}
.navmock a{font-size:var(--nav-link-size);font-weight:var(--nav-link-weight);text-decoration:none;white-space:nowrap}
.navmock .links{display:flex;gap:18px;overflow:hidden}
.navmock .rb-btn{margin-left:auto;min-height:36px;padding:0 16px}
.form{max-width:520px;display:grid;gap:10px;padding:24px;border-radius:var(--card-radius);background:var(--color-background);color:var(--color-text)}
.flag{display:inline-block;font:600 11px/1 var(--font-body);text-transform:uppercase;letter-spacing:.05em;padding:5px 8px;border-radius:999px;background:var(--color-accent);color:var(--color-background);margin-left:8px;vertical-align:middle}
.mosaic{display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:180px;grid-auto-flow:dense;gap:12px}
.mosaic .photo{border-radius:var(--card-radius)}
.mosaic .m1{grid-column:span 2;grid-row:span 2}.mosaic .m2{grid-column:span 2}.mosaic .m4{grid-column:span 1}
.slot-name{position:absolute;right:12px;top:12px;z-index:3;font:500 11px/1 ui-monospace,monospace;color:#fff;opacity:.85}
.voice-split{display:grid;grid-template-columns:1fr 1fr;min-height:100svh}
.voice-split .photo{min-height:60svh}
.voice-split .facts-col{padding:clamp(48px,8vw,112px) var(--gutter-x);display:flex;flex-direction:column;justify-content:center;gap:28px;background:var(--color-surface)}
.quotes{display:grid;gap:clamp(28px,4vw,48px)}
.quote{font-family:var(--font-display);font-size:var(--type-h2-size);font-weight:var(--type-h2-weight);line-height:var(--type-h2-leading);letter-spacing:var(--type-h2-tracking);max-width:24ch;text-wrap:balance}
.quote small{display:block;margin-top:10px;font:400 14px/1.4 var(--font-body);letter-spacing:0}
.rules{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--layout-gutter)}
.rule{padding:28px;border-radius:var(--card-radius);background:var(--color-surface);display:grid;gap:12px;align-content:start}
.rule .n{font-family:var(--font-display);font-size:var(--type-h1-size);font-weight:var(--type-h1-weight);color:var(--color-action);line-height:1}
.code-actions{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:24px}
pre{margin:0;padding:20px;border-radius:var(--card-radius);background:rgb(0 0 0 / .32);color:#e8e8e8;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;max-height:520px;overflow:auto;white-space:pre}
.code2{display:grid;grid-template-columns:1fr 1fr;gap:var(--layout-gutter)}
.code2>div{min-width:0}
.two>*,.split>*,.colour-hero>*,.comp-hero>*,.voice-split>*,.families>*,.rules>*{min-width:0}
li,td{overflow-wrap:anywhere}
footer.site{padding:48px 0;background:var(--ground-dark);color:var(--ink-dark);font-size:14px}
footer.site .wrap{display:flex;flex-wrap:wrap;gap:16px 32px;align-items:center;justify-content:space-between}
.reveal{opacity:0;transform:translateY(24px);transition:opacity .9s var(--motion-ease),transform .9s var(--motion-ease)}
.reveal.in{opacity:1;transform:none}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:60;padding:10px 16px;border-radius:999px;background:var(--color-surface-inverse);color:var(--color-text-inverse);font-size:14px;opacity:0;transition:opacity .3s}
.toast.show{opacity:1}
@media (max-width:960px){
  .stats,.cards8,.facts{grid-template-columns:repeat(2,1fr)}
  .split,.two,.colour-hero,.comp-hero,.voice-split,.code2,.rules{grid-template-columns:1fr}
  .cover .wrap{grid-template-columns:1fr}
  .mosaic{grid-template-columns:repeat(2,1fr);grid-auto-rows:120px}.mosaic>*{grid-column:span 1 !important;grid-row:span 1 !important}.mosaic .m1{grid-column:span 2 !important;grid-row:span 2 !important}
}
@media (max-width:520px){.ground>.rb-btn{justify-self:start}
.ground .cards2{grid-template-columns:1fr}.stats{gap:10px}.stat{padding:20px 8px}.token-card{min-width:0;max-width:none}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none !important;transition:none !important;scroll-behavior:auto !important}.reveal{opacity:1;transform:none}}
`;
}

function renderGuide(ctx) {
  const { a, tokens, tokensCss, tokensJson, manifest, prompts, runLog, edition } = ctx;
  const brand = a.brand;
  const R = a.colour.roles;
  const T = a.type.roles;
  const imgs = edition === 'hero' ? manifest || {} : {};
  const has = (s) => !!(imgs[s] && imgs[s].dataUri);
  const label = (s) => (has(s) ? '<span class="ai-label">AI-generated image</span>' : '');
  const photo = (s, cls, extra) => `<div class="photo ${cls || ''}" data-slot="${s}"${has(s) ? ' data-ai="1"' : ''}><div class="img img-${s}"></div>${label(s)}${extra || ''}</div>`;
  const disclaimer = `Not affiliated with or endorsed by ${esc(brand)}. Trademarks belong to their owners.`;
  const variants = pickButtonVariants(a);
  const btnCount = a.components.buttons.length;
  const colourCount = a.colour.palette.length;
  const date = (a.capturedAt || '').slice(0, 10);
  const host = esc(a.host);
  const primaryLabel = (variants.primary.source && variants.primary.source.labels[0]) || 'Primary action';
  const tk = Object.fromEntries(tokens.map((t) => [`${t.group}-${t.name}`, t.value]));
  const inkFor = (hex) => (C.contrast(hex, R.text.hex) >= C.contrast(hex, R['text-inverse'].hex) ? 'var(--color-text)' : 'var(--color-text-inverse)');
  const shortSample = (s, fallback) => { const w = String(s || '').split(/\s+/).filter(Boolean); return w.length >= 2 ? w.slice(0, 9).join(' ') : fallback; };

  const sections = [
    ['overview', 'Overview'], ['contents', 'Contents'], ['rebuild', 'Token rebuild test'], ['typography', 'Typography'], ['fonts', 'Fonts'],
    ['colour', 'Colour'], ['layout', 'Layout and spacing'], ['components', 'Components'], ['imagery', 'Imagery'], ['voice', 'Voice and tone'], ['tokens', 'Design tokens'], ['method', 'Method'],
  ];
  const contents = [
    ['typography', 'Typography', 'horizon'], ['fonts', 'Fonts', 'sky'], ['colour', 'Colour', 'object'], ['layout', 'Layout and spacing', 'grid'],
    ['components', 'Components', 'glass'], ['imagery', 'Imagery', 'subject'], ['voice', 'Voice and tone', 'street'], ['tokens', 'Design tokens', 'tokens'],
  ];

  const typeTabs = [['Display', 'display'], ['Heading', 'h1'], ['Subhead', 'h3'], ['Lead', 'lead'], ['Body', 'body']];
  const fam = a.type.typefaces.length ? a.type.typefaces : a.type.families.slice(0, 1);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(brand)} brand guidelines (unofficial)</title>
<meta name="description" content="Unofficial analysis of ${host}: measured typography, colour, layout, components and voice, rebuilt as design tokens. ${esc(disclaimer)}">
<meta name="robots" content="noindex">
<style>${baseCss(tokensCss, imgs)}${guideCss()}</style>
</head>
<body data-edition="${edition}">
<header class="topbar" id="topbar"><div class="wrap">
  <a class="name" href="#cover">${esc(brand)} brand guidelines</a><span class="unofficial">Unofficial analysis</span>
  <nav aria-label="Sections">${sections.slice(0, 11).filter(([id]) => id !== 'rebuild').map(([id, t]) => `<a href="#${id}">${esc(t)}</a>`).join('')}</nav>
  <a class="rb-btn" href="#contents">Contents</a>
</div></header>
<main>
<section id="cover" class="cover photo scrim" data-slot="hero"${has('hero') ? ' data-ai="1"' : ''}>
  <div class="img img-hero"></div>${label('hero').replace('class="ai-label"', 'class="ai-label" style="bottom:auto;top:calc(var(--nav-height) + 12px)"')}
  <div class="wrap">
    <div>
      <p class="eyebrow" style="color:#fff;opacity:.85">${host} · measured ${esc(date)}</p>
      <h1 class="t-display">${esc(brand)} brand guidelines</h1>
      <p class="t-lead lede">Measured from ${a.pages.length} pages at 1440px and 390px: ${fam.length} ${fam.length === 1 ? 'typeface' : 'typefaces'}, ${colourCount} colours, ${a.layout.base}px spacing base.</p>
      <div class="actions"><a class="rb-btn" href="#contents">View contents</a><a class="rb-btn rb-btn--translucent" href="#tokens">Design tokens</a></div>
    </div>
    <div class="rb-glass token-card reveal" aria-label="Example token">
      <div class="t-small" style="opacity:.85">Token</div>
      <div class="swatch"></div>
      <code>--color-action</code><br><code>${esc(R.action.hex)} · ${esc(R.action.oklch)}</code>
    </div>
    <div class="cover-foot"><span class="unofficial">Unofficial analysis</span><span>${esc(disclaimer)}</span></div>
  </div>
</section>

<section id="overview" class="page"><div class="wrap center">
  <p class="eyebrow">Overview</p>
  <h2 class="t-h1 reveal">Overview</h2>
  <p class="t-lead muted reveal">Computed styles from ${a.pages.reduce((s, p) => s + p.elementsVisible, 0).toLocaleString('en')} visible elements on ${host}, reduced to roles and tokens. Inferred values are flagged.</p>
  <div class="stats">
    <div class="stat reveal"><b>${fam.length}</b><span>Typefaces</span></div>
    <div class="stat reveal"><b>${colourCount}</b><span>Colours</span></div>
    <div class="stat reveal"><b>${a.layout.base}px</b><span>Spacing base</span></div>
    <div class="stat reveal"><b>${btnCount}</b><span>Button variants</span></div>
  </div>
</div></section>

<section id="contents" class="page on-dark"><div class="wrap">
  <div class="sec-head"><div><p class="eyebrow">Contents</p><h2 class="t-h1">Contents</h2></div><p class="muted">Eight chapters, each measured from the live site and rebuilt from tokens.</p></div>
  <div class="cards8">${contents.map(([id, t, s], i) => `<a class="pcard reveal" href="#${id}" data-slot="${s}"${has(s) ? ' data-ai="1"' : ''}><div class="img img-${s}"></div>${label(s)}<span class="num">${String(i + 1).padStart(2, '0')}</span><span class="arrow" aria-hidden="true">→</span><h3 class="t-h4">${esc(t)}</h3></a>`).join('')}</div>
</div></section>

<section id="rebuild" class="page auto"><div class="wrap">
  <div class="sec-head"><div><p class="eyebrow">Token rebuild test</p><h2 class="t-h1">Token rebuild test</h2></div><p class="muted">A button and two cards built only from the exported variables, on the site's light and dark grounds.</p></div>
  <div class="split">
    <div class="ground light reveal">
      <a class="rb-btn" id="rebuild-btn" href="#tokens">${esc(primaryLabel)}</a>
      <div class="cards2">
        <article class="rb-card" id="rebuild-card"><div class="rb-card__media img img-subject" data-slot="subject"${has('subject') ? ' data-ai="1"' : ''}>${label('subject')}</div><h3 class="t-h4">Card from tokens</h3><p class="t-small muted">radius ${esc(tk['radius-card'])} · padding ${esc(tk['card-padding'])}</p></article>
        <article class="rb-card"><div class="rb-card__media img img-street" data-slot="street"${has('street') ? ' data-ai="1"' : ''}>${label('street')}</div><h3 class="t-h4">Second card</h3><p class="t-small muted">shadow ${esc(String(tk['card-shadow']).slice(0, 28))}</p></article>
      </div>
      <div class="check" id="rebuild-check">Checking computed styles…</div>
    </div>
    <div class="ground dark on-dark reveal">
      <a class="rb-btn" href="#tokens">${esc(primaryLabel)}</a>
      <div class="cards2">
        <article class="rb-card"><div class="rb-card__media img img-sky" data-slot="sky"${has('sky') ? ' data-ai="1"' : ''}>${label('sky')}</div><h3 class="t-h4">Card on dark</h3><p class="t-small muted">ground var(--color-surface-inverse)</p></article>
        <article class="rb-card"><div class="rb-card__media img img-object" data-slot="object"${has('object') ? ' data-ai="1"' : ''}>${label('object')}</div><h3 class="t-h4">Second card</h3><p class="t-small muted">same tokens, inverse ground</p></article>
      </div>
      <a class="rb-btn rb-btn--outline" href="#components">Outline</a>
    </div>
  </div>
</div></section>

<section id="typography" class="chapter photo scrim" data-slot="horizon"${has('horizon') ? ' data-ai="1"' : ''}>
  <div class="img img-horizon"></div>${label('horizon')}
  <div class="wrap">
    <p class="eyebrow" style="color:#fff">Typography</p>
    <h2 class="t-h1" style="margin-bottom:32px">Typography</h2>
    <div class="rb-glass specimen reveal">
      <div class="chips" role="tablist" aria-label="Type roles">${typeTabs.map(([n, k], i) => `<button class="chip" role="tab" id="tab-${k}" aria-controls="panel-${k}" aria-selected="${i === 0}">${n}</button>`).join('')}</div>
      ${typeTabs.map(([n, k], i) => { const r = T[k]; return `<div class="spec-panel" role="tabpanel" id="panel-${k}" aria-labelledby="tab-${k}"${i ? ' hidden' : ''}>
        <p class="sample t-${k}">${esc(shortSample(r.sample, `${n} at ${r.size}px`))}</p>
        <div class="spec-meta"><span>${esc(r.primary || '')}</span><span>${r.size}px desktop</span><span>${r.mobileSize}px mobile</span><span>weight ${r.weight}</span><span>leading ${r.lineHeight}</span><span>tracking ${r.letterSpacing}em</span>${r.inferred ? '<span>inferred</span>' : ''}</div>
      </div>`; }).join('')}
    </div>
  </div>
</section>

<section id="fonts" class="page auto"><div class="wrap">
  <div class="sec-head"><div><p class="eyebrow">Fonts</p><h2 class="t-h1">Fonts</h2></div><p class="muted">Font files are not copied. Samples render in the brand face only if it is installed on this device; otherwise the fallback stack is used.</p></div>
  <div class="families">${fam.map((f) => `<div class="family reveal" data-family="${esc(f.family)}">
    <div class="t-small muted">${esc(f.family)}</div>
    <div class="aa" style="font-family:'${esc(f.family).replace(/'/g, '')}', var(--font-body)">Aa</div>
    <dl><dt>Share</dt><dd>${pct(f.share)} of characters</dd><dt>Weights</dt><dd>${f.weights.slice(0, 6).map((w) => `${w.weight} (${pct(w.share)})`).join(', ')}</dd><dt>Installed here</dt><dd class="installed">checking…</dd></dl>
  </div>`).join('')}</div>
  <div class="block"><h3 class="t-h3">Character set</h3><div class="charset" style="font-family:var(--font-body)">${esc(a.type.charset.slice(0, 220))}</div></div>
  <div class="block"><h3 class="t-h3">Type scale</h3><p class="muted" style="margin:-8px 0 16px">Ratio ${a.type.ratio}, nearest named interval: ${esc(a.type.interval.name)} (${a.type.interval.value}).</p>
  <div class="scroll-x"><table><thead><tr><th>Role</th><th>390px → 1440px</th><th>clamp()</th><th>Weight</th><th>Leading</th><th>Tracking</th><th>Source</th></tr></thead><tbody>
  ${['display', 'h1', 'h2', 'h3', 'h4', 'lead', 'body', 'small'].map((k) => { const r = T[k]; return `<tr><td>${k}</td><td>${r.mobileSize}px → ${r.size}px</td><td class="mono">${esc(r.clamp)}</td><td>${r.weight}</td><td>${r.lineHeight}</td><td>${r.letterSpacing}em</td><td>${r.inferred ? 'inferred' : 'measured'}${r.mobileInferred && !r.inferred ? ', mobile inferred' : ''}</td></tr>`; }).join('')}
  </tbody></table></div></div>
  <div class="two block">
    <div><h3 class="t-h3">Sizes in use</h3><div class="bars">${a.type.sizesInUse.slice(0, 12).map((s) => `<div class="bar"><span>${s.size}px</span><i style="width:${Math.max(2, (s.share / a.type.sizesInUse[0].share) * 100)}%"></i><span>${pct(s.share)}</span></div>`).join('')}</div></div>
    <div><h3 class="t-h3">Declared type variables</h3>${a.type.typeVars.length ? `<pre style="background:var(--color-surface);color:var(--color-text)">${esc(a.type.typeVars.slice(0, 24).map(([k, v]) => `${k}: ${v};`).join('\n'))}</pre>` : '<p class="muted">No type-related :root custom properties were readable (cross-origin stylesheets cannot be read).</p>'}</div>
  </div>
</div></section>

<section id="colour" class="page auto on-dark"><div class="wrap">
  <div class="sec-head"><div><p class="eyebrow">Colour</p><h2 class="t-h1">Colour</h2></div><p class="muted">Text weighted by characters, backgrounds by painted area. Values normalised to sRGB hex through a 1px canvas.</p></div>
  <div class="colour-hero">
    ${photo('object', 'reveal')}
    <div class="reveal">
      <div class="palette-bar" role="img" aria-label="Palette by usage">${a.colour.palette.slice(0, 12).map((p) => `<span style="flex:${Math.max(0.02, p.weight)};background:${p.hex}" title="${p.hex} ${pct(p.weight)}"></span>`).join('')}</div>
      <div class="roles">${Object.entries(R).map(([k, c]) => `<div class="role" style="background:var(--color-${k});color:${inkFor(c.hex)}"><b>${k}</b><div><code>${c.hex}</code><code>${esc(c.oklch)}</code><code>${c.inferred ? 'inferred' : pct(c.share) + ' · ' + esc(c.basis)}</code><code>contrast ${c.contrastOnBackground}:1</code></div></div>`).join('')}</div>
    </div>
  </div>
  <div class="two block">
    <div><h3 class="t-h3">Gradient</h3><div class="gradient-strip"></div><p class="mono muted" style="margin-top:12px">${esc(tk['gradient-brand'])}</p>${a.colour.gradients.length ? '' : '<p class="muted">No gradient measured; built from action and surface-inverse.</p>'}</div>
    <div><h3 class="t-h3">Contrast of the most-read pairs</h3><div class="scroll-x"><table><thead><tr><th>Pair</th><th>Share</th><th>Ratio</th><th>WCAG</th></tr></thead><tbody>${a.colour.contrastPairs.slice(0, 7).map((p) => `<tr><td><span style="display:inline-block;padding:2px 8px;border-radius:6px;background:${p.bg};color:${p.fg};box-shadow:inset 0 0 0 1px rgb(255 255 255 / .2)">Aa</span> <span class="mono">${p.fg} / ${p.bg}</span></td><td>${pct(p.share)}</td><td>${p.ratio}:1</td><td>${p.level}</td></tr>`).join('')}</tbody></table></div></div>
  </div>
  <details class="block"><summary>Full palette (${a.colour.palette.length})</summary><div class="swatches">${a.colour.palette.map((p) => `<div class="sw"><i style="background:${p.hex}"></i><span>${p.hex}<br>${esc(p.oklch)}<br>${(p.weight * 100).toFixed(1)}%</span></div>`).join('')}</div></details>
</div></section>

<section id="layout" class="page auto"><div class="wrap">
  <div class="sec-head"><div><p class="eyebrow">Layout and spacing</p><h2 class="t-h1">Layout and spacing</h2></div><p class="muted">${pct(a.layout.gridShares[a.layout.base])} of padding, margin and gap values fall on the ${a.layout.base}px grid.</p></div>
  <div class="facts">
    <div class="fact reveal"><b>${a.layout.base}px</b><span>Spacing base</span></div>
    <div class="fact reveal"><b>${a.layout.columns}</b><span>Columns</span></div>
    <div class="fact reveal"><b>${a.layout.gutter}px</b><span>Gutter</span></div>
    <div class="fact reveal"><b>${a.layout.container}px</b><span>Container</span></div>
  </div>
  <div class="block"><h3 class="t-h3">Columns</h3><div class="cols" style="grid-template-columns:repeat(var(--layout-columns),1fr);--col-gap:calc(var(--layout-gutter) / var(--layout-container) * 100%)">${Array.from({ length: a.layout.columns }, (_, i) => `<i>${i + 1}</i>`).join('')}</div></div>
  <div class="two block">
    <div><h3 class="t-h3">Spacing scale</h3><div class="stair">${a.layout.spaceScale.map((v, i) => `<div class="step"><span class="mono">${v}px</span><i style="width:min(100%, var(--space-${i + 1}))"></i></div>`).join('')}</div>
      <p class="muted t-small" style="margin-top:16px">Off-grid values: ${a.layout.offGrid.slice(0, 8).map((o) => `${o.value}px (${o.count})`).join(', ') || 'none'}.</p></div>
    <div><h3 class="t-h3">Radii</h3><div class="radii">${a.layout.radii.slice(0, 6).map((r) => `<div class="radius" style="border-radius:${r.value === 'pill' ? '999px' : r.value + 'px'}">${r.value === 'pill' ? 'pill' : r.value + 'px'}<br>${r.count}×</div>`).join('')}</div>
      <p class="muted t-small" style="margin-top:16px">Pill share ${pct(a.layout.pillShare)}. Card radius ${a.layout.cardRadius}px.</p></div>
  </div>
  <div class="block"><h3 class="t-h3">Breakpoints</h3>${a.layout.breakpoints.length ? `<div class="ruler">${a.layout.breakpoints.filter((b, i, arr) => !i || b - arr[i - 1] > 8).map((b) => `<span style="left:${((b - 320) / (1920 - 320)) * 100}%">${b}</span>`).join('')}</div><p class="muted t-small" style="margin-top:12px">Scale 320px to 1920px. Read from same-origin stylesheets only.</p>` : '<p class="muted">No media queries were readable.</p>'}</div>
  <div class="block"><h3 class="t-h3">Section rhythm (home page)</h3><div class="rhythm">${a.layout.rhythm.filter((b) => b.h >= 20).map((b) => `<div style="height:${Math.max(22, Math.round(b.share * 420))}px;background:${b.bg};color:${C.isDark(b.bg) || C.chroma(b.bg) > 0.1 ? '#fff' : '#111'}"><span>${b.tone}${b.gradient ? ' · gradient' : ''}${b.image ? ' · image' : ''}</span><span>${b.h}px</span></div>`).join('')}</div></div>
</div></section>

<section id="components" class="page auto on-dark"><div class="wrap">
  <div class="comp-hero">
    <div><p class="eyebrow">Components</p><h2 class="t-h1">Components</h2><p class="muted" style="margin-top:16px">${btnCount} measured button variants, ${a.components.cards.length} card variants, the header and ${a.components.input.inferred ? 'an inferred' : 'a measured'} input. Samples use only tokens.</p></div>
    ${photo('glass', 'reveal')}
  </div>
  <h3 class="t-h3" style="margin-bottom:20px">Buttons</h3>
  <div class="variants">${['primary', 'secondary', 'outline', 'translucent'].map((k) => { const v = variants[k]; const m = v.source || null; return `<div class="variant ${C.isDark(v.ground && v.ground.startsWith('#') ? v.ground.slice(0, 7) : '#000000') || C.chroma(v.ground && v.ground.startsWith('#') ? v.ground.slice(0, 7) : '#000000') > 0.1 ? 'dark on-dark' : 'light'}" style="background:var(--button-${k}-ground)"><span class="rb-btn${k === 'primary' ? '' : ' rb-btn--' + k}">${esc((m && m.labels[0]) || k)}</span><div class="mono">${k}${v.measured ? '' : ' · inferred'}<br>${m ? `${m.count}× · ${m.height}px high · ${m.pill ? 'pill' : m.radius + 'px'}` : ''}</div></div>`; }).join('')}</div>
  <div class="block"><h3 class="t-h3">Navigation</h3><div class="navmock"><span class="logo-ph">logo ${esc(tk['nav-logo-width'])}×${esc(tk['nav-logo-height'])}</span><span class="links">${(a.components.nav ? a.components.nav.links : ['Link', 'Link', 'Link']).slice(0, 5).map((l) => `<a href="#components">${esc(l)}</a>`).join('')}</span><span class="rb-btn">${esc(primaryLabel)}</span></div>
    <p class="muted t-small" style="margin-top:12px">Height ${esc(tk['nav-height'])}${a.components.nav ? `, ${a.components.nav.sticky ? 'sticky' : 'static'}` : ''}. ${a.components.nav && a.components.nav.logo ? `Logo shown as a dashed placeholder at its measured size and colour (${esc(tk['nav-logo-color'])}).` : 'Logo not detected inside the header element; the dashed placeholder uses a default size (inferred).'}</p></div>
  <div class="two block">
    <div><h3 class="t-h3">Cards</h3><div class="ground light" style="padding:20px"><article class="rb-card"><div class="rb-card__media img img-subject"${has('subject') ? ' data-ai="1"' : ''}>${label('subject')}</div><h4 class="t-h4">Card</h4><p class="t-small muted">${a.components.cards.slice(0, 3).map((c) => `${c.fill}, ${c.radius}px${c.shadow ? ', shadow' : ''}${c.media ? ', media ' + (c.media.ratio || '') : ''}`).join(' · ') || 'inferred from tokens'}</p></article></div></div>
    <div><h3 class="t-h3">Input${a.components.input.inferred ? '<span class="flag">inferred</span>' : ''}</h3><div class="form"><label class="t-small" for="demo-input">Search</label><input class="rb-input" id="demo-input" placeholder="${esc(a.components.input.placeholder || 'Placeholder')}"><span class="rb-btn" style="justify-self:start">${esc(primaryLabel)}</span></div></div>
  </div>
</div></section>

<section id="imagery" class="page auto"><div class="wrap">
  <div class="sec-head"><div><p class="eyebrow">Imagery</p><h2 class="t-h1">Imagery</h2></div><p class="muted">The brand's images are described, not copied. ${has('hero') ? 'Images below are AI-generated from text prompts in a similar style.' : 'Image slots below use gradient fallbacks built from the colour tokens.'}</p></div>
  <div class="mosaic">${[['hero', 'm1'], ['horizon', 'm2'], ['street', 'm4'], ['sky', 'm4'], ['object', 'm4'], ['grid', 'm4'], ['glass', 'm2'], ['tokens', 'm2'], ['subject', 'm2']].map(([s, c]) => photo(s, c + ' reveal', `<span class="slot-name">${s}</span>`)).join('')}</div>
  <div class="facts block">
    <div class="fact"><b>${pct(a.imagery.mediaAreaShare)}</b><span>Media share of page area</span></div>
    <div class="fact"><b>${pct(a.imagery.fullBleedShare)}</b><span>Full-bleed</span></div>
    <div class="fact"><b>${esc((a.imagery.formats[0] || { format: 'n/a' }).format)}</b><span>Main format</span></div>
    <div class="fact"><b>${esc((a.imagery.crops[0] || { crop: 'n/a' }).crop)}</b><span>Main crop</span></div>
  </div>
  <div class="two block">
    <div><h3 class="t-h3">Measured</h3><table><tbody>
      <tr><th>Media elements</th><td>${a.imagery.count}</td></tr>
      <tr><th>Formats</th><td>${a.imagery.formats.map((f) => `${esc(f.format)} ${pct(f.share)}`).join(', ')}</td></tr>
      <tr><th>Crops</th><td>${a.imagery.crops.slice(0, 5).map((f) => `${esc(f.crop)} ${pct(f.share)}`).join(', ')}</td></tr>
      <tr><th>object-fit</th><td>${a.imagery.objectFit.map((f) => `${esc(f.fit)} ${pct(f.share)}`).join(', ')}</td></tr>
      <tr><th>Inside cards</th><td>${pct(a.imagery.inCardShare)}</td></tr>
      <tr><th>Alt text coverage</th><td>${pct(a.imagery.altCoverage)}</td></tr>
      <tr><th>Alt-text themes</th><td>${a.imagery.altThemes.slice(0, 10).map((w) => esc(w.word)).join(', ') || 'none'}</td></tr>
    </tbody></table></div>
    <div><h3 class="t-h3">Source pages</h3><ul style="margin:0;padding-left:18px;display:grid;gap:8px">${a.imagery.sourcePages.map((p) => `<li><a href="${esc(p.url)}" rel="noopener">${esc(p.title || p.url)}</a> <span class="muted">(${p.media} media)</span></li>`).join('')}</ul></div>
  </div>
</div></section>

<section id="voice" class="voice-split">
  ${photo('street', '')}
  <div class="facts-col">
    <div><p class="eyebrow">Voice and tone</p><h2 class="t-h1">Voice and tone</h2></div>
    <table><tbody>
      <tr><th>Headlines</th><td>${a.voice.stats.headlines}, median ${a.voice.stats.headlineWords.median} words (max ${a.voice.stats.headlineWords.max})</td></tr>
      <tr><th>Case</th><td>${Object.entries(a.voice.stats.case).map(([k, v]) => `${k} ${pct(v)}`).join(', ')}</td></tr>
      <tr><th>"You" vs "we"</th><td>${a.voice.stats.you} vs ${a.voice.stats.we}</td></tr>
      <tr><th>Lines with numbers</th><td>${pct(a.voice.stats.numbersShare)}</td></tr>
      <tr><th>"X, Y" headlines</th><td>${pct(a.voice.stats.xyPatternShare)}</td></tr>
      <tr><th>CTA first words</th><td>${a.voice.stats.ctaFirstWords.slice(0, 5).map((w) => `${esc(w.word)} (${w.count})`).join(', ')}</td></tr>
      <tr><th>Exclamation marks</th><td>${a.voice.stats.exclamations} of ${a.voice.stats.lines} lines</td></tr>
    </tbody></table>
  </div>
</section>
<section class="page auto" id="voice-quotes"><div class="wrap">
  <div class="quotes">${a.voice.quotes.map((q) => `<blockquote class="quote reveal" style="margin:0">“${esc(q.text)}”<small class="muted"><a href="${esc(q.url)}" rel="noopener">${esc(q.url.replace(/^https?:\/\//, ''))}</a> · ${q.kind} · ${q.words} words</small></blockquote>`).join('')}</div>
  <div class="rules block">${a.voice.rules.map((r) => `<div class="rule reveal"><span class="n">${String(r.n).padStart(2, '0')}</span><h3 class="t-h4">${esc(r.title)}</h3><p class="t-small muted">${esc(r.evidence)}</p></div>`).join('')}</div>
</div></section>

<section id="tokens" class="page auto on-dark"><div class="wrap">
  <div class="sec-head"><div><p class="eyebrow">Design tokens</p><h2 class="t-h1">Design tokens</h2></div><p class="muted">${tokens.length} tokens as CSS custom properties and W3C design-tokens JSON, OKLCH next to hex.</p></div>
  <div class="code-actions"><button class="rb-btn" data-copy="css">Copy CSS</button><button class="rb-btn rb-btn--translucent" data-copy="json">Copy JSON</button><button class="rb-btn rb-btn--outline" data-download="css">Download tokens.css</button><button class="rb-btn rb-btn--outline" data-download="json">Download tokens.json</button></div>
  <div class="code2"><div><h3 class="t-h4" style="margin-bottom:12px">tokens.css</h3><pre id="code-css">${esc(tokensCss)}</pre></div><div><h3 class="t-h4" style="margin-bottom:12px">tokens.json</h3><pre id="code-json">${esc(tokensJson)}</pre></div></div>
</div></section>

<section id="method" class="page auto"><div class="wrap">
  <div class="sec-head"><div><p class="eyebrow">Method</p><h2 class="t-h1">Method</h2></div><p class="muted">Captured ${esc(date)} via ${esc(a.source)}. Viewports 1440×900 and 390×844 (home). Cookie and consent UI excluded by id, class and dialog text.</p></div>
  <div class="two">
    <div><h3 class="t-h3">Assumptions</h3><ul style="margin:0;padding-left:18px;display:grid;gap:8px">${a.assumptions.map((x) => `<li><b>${esc(x.area)}.</b> ${esc(x.text)}</li>`).join('')}<li><b>Dedupe.</b> Any count identical on every page (header, footer) is counted once.</li><li><b>Fonts.</b> Brand typefaces are referenced by name; no font files are embedded.</li></ul></div>
    <div><h3 class="t-h3">Pages captured</h3><table><thead><tr><th>Page</th><th>Viewport</th><th>Visible elements</th></tr></thead><tbody>${a.pages.map((p) => `<tr><td><a href="${esc(p.url)}" rel="noopener">${esc(p.url.replace(/^https?:\/\//, ''))}</a></td><td>${p.viewport.w}×${p.viewport.h}</td><td>${p.elementsVisible}</td></tr>`).join('')}${a.mobile ? `<tr><td>${esc(a.mobile.url.replace(/^https?:\/\//, ''))}</td><td>${a.mobile.viewport.w}×${a.mobile.viewport.h}</td><td>${a.mobile.elementsVisible}</td></tr>` : ''}</tbody></table></div>
  </div>
  <div class="block"><h3 class="t-h3">Run log</h3><div class="scroll-x"><table><thead><tr><th>Phase</th><th>Time</th><th>Notes</th></tr></thead><tbody>${(runLog || []).map((r) => `<tr><td>${esc(r.phase)}</td><td>${r.ms != null ? (r.ms / 1000).toFixed(1) + ' s' : ''}</td><td>${esc(r.note || '')}</td></tr>`).join('')}</tbody></table></div></div>
  <div class="block"><h3 class="t-h3">Image prompts</h3><div class="scroll-x"><table><thead><tr><th>Slot</th><th>Aspect</th><th>Prompt</th><th>Status</th></tr></thead><tbody>${(prompts ? prompts.slots : []).map((p) => `<tr><td>${p.slot}</td><td>${p.aspectRatio}</td><td>${esc(p.prompt)}</td><td>${has(p.slot) ? 'AI-generated image, embedded' : 'gradient fallback'}</td></tr>`).join('')}</tbody></table></div></div>
</div></section>
</main>
<footer class="site"><div class="wrap"><span class="unofficial">Unofficial analysis</span><span>${esc(disclaimer)}</span><span class="muted">Generated by reverse-brand from ${host} on ${esc(date)}.</span></div></footer>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script id="tokens-css" type="text/plain">${tokensCss.replace(/<\/script/gi, '<\\/script')}</script>
<script id="tokens-json" type="application/json">${tokensJson.replace(/<\/script/gi, '<\\/script')}</script>
<script>${guideJs()}</script>
</body>
</html>`;
  return html;
}

function guideJs() {
  return `(function(){
var bar=document.getElementById('topbar'),cover=document.getElementById('cover');
if('IntersectionObserver' in window){
  new IntersectionObserver(function(e){bar.classList.toggle('solid',!e[0].isIntersecting)},{rootMargin:'-64px 0px 0px 0px'}).observe(cover);
  var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}})},{threshold:.12});
  document.querySelectorAll('.reveal').forEach(function(el){io.observe(el)});
}else{document.querySelectorAll('.reveal').forEach(function(el){el.classList.add('in')})}
document.querySelectorAll('.chip').forEach(function(c){c.addEventListener('click',function(){
  document.querySelectorAll('.chip').forEach(function(o){o.setAttribute('aria-selected',o===c)});
  document.querySelectorAll('.spec-panel').forEach(function(p){p.hidden=p.id!==c.getAttribute('aria-controls')});
})});
function toast(m){var t=document.getElementById('toast');t.textContent=m;t.classList.add('show');setTimeout(function(){t.classList.remove('show')},1600)}
function src(k){return document.getElementById(k==='css'?'tokens-css':'tokens-json').textContent}
document.querySelectorAll('[data-copy]').forEach(function(b){b.addEventListener('click',function(){var k=b.dataset.copy;(navigator.clipboard?navigator.clipboard.writeText(src(k)):Promise.reject()).then(function(){toast('Copied tokens.'+k)},function(){toast('Copy not available')})})});
document.querySelectorAll('[data-download]').forEach(function(b){b.addEventListener('click',function(){var k=b.dataset.download;var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([src(k)],{type:k==='css'?'text/css':'application/json'}));a.download='tokens.'+k;a.click();setTimeout(function(){URL.revokeObjectURL(a.href)},500)})});
// Is each brand face installed locally? Compare glyph widths against generic fallbacks.
var cv=document.createElement('canvas').getContext('2d');
function w(f){cv.font='72px '+f;return cv.measureText('mmmmmmmmmlliWQ@#10').width}
document.querySelectorAll('.family').forEach(function(el){var f=el.dataset.family.replace(/"/g,'');var yes=['monospace','serif','sans-serif'].some(function(g){return w('"'+f+'",'+g)!==w(g)});var d=el.querySelector('.installed');d.textContent=yes?'Yes, rendering in '+f:'No, showing the fallback stack'});
// Rebuild check: computed styles of the token-built button and card equal the token values.
var probe=document.createElement('div');document.body.appendChild(probe);
function tok(name,prop){probe.style.cssText=prop.replace(/[A-Z]/g,function(c){return '-'+c.toLowerCase()})+':var('+name+')';return getComputedStyle(probe)[prop]}
var btn=document.getElementById('rebuild-btn'),card=document.getElementById('rebuild-card'),bs=getComputedStyle(btn),cs=getComputedStyle(card);
var checks=[['button background',bs.backgroundColor,tok('--button-primary-bg','backgroundColor')],['button text',bs.color,tok('--button-primary-fg','color')],['button radius',bs.borderTopLeftRadius,tok('--radius-button','borderTopLeftRadius')],['button min-height',bs.minHeight,tok('--button-height','minHeight')],['card background',cs.backgroundColor,tok('--card-bg','backgroundColor')],['card radius',cs.borderTopLeftRadius,tok('--radius-card','borderTopLeftRadius')],['card padding',cs.paddingTop,tok('--card-padding','paddingTop')]];
probe.remove();
var ok=checks.every(function(c){return c[1]===c[2]});
document.getElementById('rebuild-check').innerHTML=checks.map(function(c){return '<span class="'+(c[1]===c[2]?'ok':'bad')+'">'+(c[1]===c[2]?'✓':'✗')+'</span> '+c[0]+': '+c[1]}).join('<br>');
document.body.dataset.rebuild=ok?'pass':'fail';
})();`;
}

module.exports = { renderGuide, esc };
