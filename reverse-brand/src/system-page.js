'use strict';
// Design-system page for a derived system (Italian copy, examples in the identity's language).
// Every sample uses only the derived tokens.
const C = require('./color');
const { esc } = require('./guide');

function systemPage({ a, sys, id, tokensCss, tokensJson, bridgeCss, copy }) {
  const R = sys.roles;
  const dark = id.colors.dark, light = id.colors.light;
  const ratio = (fg, bg) => (fg.startsWith('#') && bg.startsWith('#') ? C.contrast(fg, bg).toFixed(2) : 'n/a');
  const pairs = [['text', 'background'], ['text-muted', 'background'], ['on-accent', 'accent'], ['on-trust', 'trust'], ['accent', 'background']];
  const roleNames = { display: 'Display', h1: 'Titolo 1', h2: 'Titolo 2', h3: 'Titolo 3', h4: 'Titolo 4', lead: 'Lead', body: 'Corpo', small: 'Piccolo' };
  const date = new Date().toISOString().slice(0, 10);
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(id.name)} design system</title>
${id.fontsUrl ? `<link rel="stylesheet" href="${esc(id.fontsUrl)}">\n` : ''}<style>
${tokensCss}
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--color-background);color:var(--color-text);font-family:var(--font-body);font-size:var(--type-body-size);line-height:var(--type-body-leading);overflow-x:hidden}
h1,h2,h3,h4,p{margin:0}
.wrap{max-width:var(--layout-container);margin:0 auto;padding:0 var(--layout-gutter)}
section{padding:var(--space-10,88px) 0;border-top:1px solid var(--color-border)}
.alt{background:var(--color-background-2)}
.eyebrow{font:600 12px/1 var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--color-accent);margin-bottom:var(--space-2)}
.t-display{font-family:var(--type-display-family);font-size:var(--type-display-size);font-weight:var(--type-display-weight);line-height:var(--type-display-leading);letter-spacing:var(--type-display-tracking)}
.t-h1{font-family:var(--type-h1-family);font-size:var(--type-h1-size);font-weight:var(--type-h1-weight);line-height:var(--type-h1-leading);letter-spacing:var(--type-h1-tracking)}
.t-h2{font-family:var(--type-h2-family);font-size:var(--type-h2-size);font-weight:var(--type-h2-weight);line-height:var(--type-h2-leading);letter-spacing:var(--type-h2-tracking)}
.t-h3{font-family:var(--type-h3-family);font-size:var(--type-h3-size);font-weight:var(--type-h3-weight);line-height:var(--type-h3-leading);letter-spacing:var(--type-h3-tracking)}
.t-h4{font-family:var(--type-h4-family);font-size:var(--type-h4-size);font-weight:var(--type-h4-weight);line-height:var(--type-h4-leading);letter-spacing:var(--type-h4-tracking)}
.t-lead{font-size:var(--type-lead-size);line-height:var(--type-lead-leading)}
.t-small{font-size:var(--type-small-size);line-height:var(--type-small-leading)}
.muted{color:var(--color-text-muted)}
.mono{font-family:var(--font-mono);font-size:13px}
.head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:end;gap:var(--space-3);margin-bottom:var(--space-6,48px)}
.head p{max-width:52ch}
.topbar{position:sticky;top:0;z-index:20;height:var(--nav-height);display:flex;align-items:center;background:color-mix(in srgb,var(--color-background) 80%,transparent);-webkit-backdrop-filter:blur(18px) saturate(1.4);backdrop-filter:blur(18px) saturate(1.4);border-bottom:1px solid var(--color-border)}
.topbar .wrap{display:flex;align-items:center;gap:var(--space-3);width:100%}
.brand{display:flex;align-items:center;gap:10px;font:700 20px/1 var(--font-display);text-decoration:none}
.brand svg{width:28px;height:28px}
.topbar nav{display:flex;gap:var(--space-3);margin-left:auto;font-size:14px;font-weight:500}
.topbar nav a{text-decoration:none;color:var(--color-text-muted)}.topbar nav a:hover{color:var(--color-text)}
@media (max-width:900px){.topbar nav{display:none}.topbar .btn{margin-left:auto}}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:var(--space-1);min-height:var(--button-height);padding:0 var(--button-pad-x);border-radius:var(--radius-button);border:1px solid var(--color-border-strong);background:var(--color-surface);color:var(--color-text);font:var(--button-font-weight) 15px/1 var(--font-body);text-decoration:none;cursor:pointer;white-space:nowrap;transition:transform var(--motion-duration) var(--motion-ease),box-shadow var(--motion-duration) var(--motion-ease),border-color var(--motion-duration) var(--motion-ease)}
.btn:hover{transform:translateY(-1px);border-color:var(--color-text)}
.btn-primary{background:var(--color-accent);color:var(--color-on-accent);border-color:transparent;box-shadow:0 10px 30px -12px var(--color-accent)}
.btn-trust{background:var(--color-trust);color:var(--color-on-trust);border-color:transparent}
.btn-ghost{background:transparent;border-color:transparent}
.btn-sm{min-height:var(--button-height-sm);padding:0 var(--space-2);font-size:14px}
.btn:focus-visible,.input:focus-visible{outline:2px solid var(--color-accent);outline-offset:2px}
.input{width:100%;min-height:var(--input-height);padding:0 var(--input-pad-x);border-radius:var(--radius-input);border:1px solid var(--color-border-strong);background:var(--color-surface);color:var(--color-text);font:inherit}
.cover{position:relative;min-height:88svh;display:flex;align-items:flex-end;padding:var(--space-10,88px) 0 var(--space-8,64px);background:var(--gradient-brand);color:#fff;overflow:hidden;border:0}
.cover::after{content:"";position:absolute;inset:auto 0 0 0;height:45%;background:linear-gradient(180deg,transparent,rgb(10 16 36 / .55));pointer-events:none}
.cover .wrap{position:relative;z-index:1;display:grid;grid-template-columns:1fr auto;gap:var(--space-4);align-items:end}
.cover h1{max-width:13ch}
.cover .lede{margin-top:var(--space-2);max-width:46ch;opacity:.92}
.cover .actions{display:flex;flex-wrap:wrap;gap:var(--space-1);margin-top:var(--space-4)}
.glass{background:rgb(255 255 255 / .12);-webkit-backdrop-filter:blur(20px) saturate(1.4);backdrop-filter:blur(20px) saturate(1.4);border:1px solid rgb(255 255 255 / .25);border-radius:var(--radius-card);padding:var(--space-3);min-width:260px}
.glass .sw{height:72px;border-radius:var(--radius-sm);background:var(--color-accent);margin:var(--space-2) 0}
.split{display:grid;grid-template-columns:1fr 1fr;gap:var(--layout-gutter-wide)}
.split>*{min-width:0}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--color-border);vertical-align:top;overflow-wrap:anywhere}
th{color:var(--color-text-muted);font-weight:600}
.scroll-x{overflow-x:auto}.scroll-x table{min-width:620px}
.spec{display:grid;gap:var(--space-3)}
.spec-row{display:grid;grid-template-columns:160px 1fr;gap:var(--space-3);align-items:baseline;padding-bottom:var(--space-2);border-bottom:1px solid var(--color-border)}
.spec-row .meta{font:500 12px/1.5 var(--font-mono);color:var(--color-text-muted)}
.spec-row>*{min-width:0;overflow-wrap:anywhere}
.swatches{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:var(--space-1)}
.swatch{border-radius:var(--radius-sm);overflow:hidden;border:1px solid var(--color-border);background:var(--color-surface)}
.swatch i{display:block;height:72px}
.swatch span{display:block;padding:var(--space-1);font:500 12px/1.4 var(--font-mono)}
.themes{display:grid;grid-template-columns:1fr 1fr;gap:var(--layout-gutter)}
.theme{border-radius:var(--radius-card);padding:var(--space-3);border:1px solid var(--color-border)}
.stair{display:grid;gap:var(--space-1)}.stair div{display:grid;grid-template-columns:56px 1fr;gap:var(--space-2);align-items:center;font:500 12px/1 var(--font-mono)}.stair i{display:block;height:16px;border-radius:4px;background:var(--color-accent)}
.radii{display:flex;flex-wrap:wrap;gap:var(--space-2)}.radii div{width:104px;height:104px;border:2px solid var(--color-text);display:grid;place-items:center;font:500 12px/1.3 var(--font-mono);text-align:center}
.components{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--space-6,48px)}
.row{display:flex;flex-wrap:wrap;gap:var(--space-2);align-items:center}
.searchbar{display:flex;gap:var(--space-1);padding:var(--space-1);border-radius:calc(var(--radius-sm) + var(--space-1));background:var(--color-surface);border:1px solid var(--color-border-strong);max-width:760px}
.searchbar .input{border:0;background:transparent}
.searchbar select.input{max-width:150px;border-right:1px solid var(--color-border)}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--layout-gutter)}
.card{border-radius:var(--radius-card);overflow:hidden;background:var(--color-surface);border:1px solid var(--color-border);transition:transform var(--motion-duration-slow) var(--motion-ease),box-shadow var(--motion-duration) var(--motion-ease)}
.card:hover{transform:translateY(-3px);box-shadow:0 24px 60px -24px rgb(0 0 0 / .5)}
.card .media{aspect-ratio:var(--card-media-ratio);position:relative;background:var(--gradient-brand)}
.card .media .chip{position:absolute;left:var(--space-1);top:var(--space-1)}
.card .body{padding:var(--card-padding);display:grid;gap:6px}
.price{font:600 20px/1.2 var(--font-mono)}.price small{font-size:13px;color:var(--color-text-muted);font-weight:500}
.chip{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:var(--radius-pill);font-size:12px;font-weight:600;background:rgb(10 16 36 / .72);color:#fff}
.chip-ok{background:var(--color-trust);color:var(--color-on-trust)}.chip-gold{background:var(--color-accent);color:var(--color-on-accent)}
.navmock{display:flex;align-items:center;gap:var(--space-3);height:var(--nav-height);padding:0 var(--space-2);border-radius:var(--radius-card);background:var(--color-surface);border:1px solid var(--color-border);overflow:hidden;white-space:nowrap}
.navmock a{text-decoration:none;font-size:14px;font-weight:500;color:var(--color-text-muted)}
.rules{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:var(--layout-gutter)}
.rule{padding:var(--space-3);border-radius:var(--radius-card);background:var(--color-surface);border:1px solid var(--color-border);display:grid;gap:var(--space-1);align-content:start}
.rule b{font:700 32px/1 var(--font-display);color:var(--color-accent)}
.rule .ex{font-family:var(--font-display);font-size:18px}
pre{margin:0;padding:var(--space-3);border-radius:var(--radius-card);background:var(--color-background-2);border:1px solid var(--color-border);font:12px/1.55 var(--font-mono);max-height:460px;overflow:auto}
.code2{display:grid;grid-template-columns:1fr 1fr;gap:var(--layout-gutter)}.code2>*{min-width:0}
footer{padding:var(--space-6,48px) 0;border-top:1px solid var(--color-border);font-size:14px;color:var(--color-text-muted)}
.reveal{opacity:0;transform:translateY(24px);transition:opacity .8s var(--motion-ease),transform .8s var(--motion-ease)}.reveal.in{opacity:1;transform:none}
@media (max-width:900px){.split,.themes,.code2{grid-template-columns:1fr}.cards{grid-template-columns:1fr 1fr}.cover .wrap{grid-template-columns:1fr}.spec-row{grid-template-columns:1fr}}
@media (max-width:560px){.navmock a:not(.btn){display:none}.cards{grid-template-columns:1fr}.searchbar{flex-wrap:wrap}.searchbar select.input{max-width:none;border-right:0;border-bottom:1px solid var(--color-border)}.searchbar .btn{width:100%}}
@media (prefers-reduced-motion:reduce){*{transition:none !important;animation:none !important}.reveal{opacity:1;transform:none}}
</style>
</head>
<body>
<header class="topbar"><div class="wrap">
  <a class="brand" href="#top">${id.logoSvg || ''}${esc(id.name)}</a><span class="mono muted">design system v1</span>
  <nav><a href="#origine">Origine</a><a href="#tipografia">Tipografia</a><a href="#colore">Colore</a><a href="#layout">Layout</a><a href="#componenti">Componenti</a><a href="#voce">Voce</a><a href="#token">Token</a><a href="#migrazione">Migrazione</a></nav>
  <button class="btn btn-sm" id="theme">Tema chiaro</button>
</div></header>
<main id="top">
<section class="cover"><div class="wrap">
  <div>
    <p class="eyebrow" style="color:#fff;opacity:.85">Design system v1 · ${esc(date)}</p>
    <h1 class="t-display">${esc(copy.coverTitle)}</h1>
    <p class="t-lead lede">Identità di ${esc(id.name)}, struttura misurata sul portale di riferimento: griglia a ${sys.sizes.base}px, scala tipografica ${a.type.ratio}, controlli da ${sys.sizes.ctaH}px.</p>
    <div class="actions"><a class="btn btn-primary" href="#componenti">${esc(copy.ctaPrimary)}</a><a class="btn" href="#token" style="background:rgb(255 255 255 / .14);color:#fff;border-color:rgb(255 255 255 / .3)">Token</a></div>
  </div>
  <div class="glass reveal"><div class="t-small" style="opacity:.85">Token</div><div class="sw"></div><code class="mono">--color-accent<br>${esc(dark.accent)} · ${esc(C.oklchString(dark.accent))}</code></div>
</div></section>

<section id="origine"><div class="wrap">
  <div class="head"><div><p class="eyebrow">Origine</p><h2 class="t-h1">Cosa viene da dove</h2></div><p class="muted">La struttura è misurata su ${esc(a.host)} (${a.pages.length} pagine). Colori, font, logo, immagini e testi restano di ${esc(id.name)}: nessun elemento visivo del portale di riferimento è stato copiato.</p></div>
  <div class="scroll-x"><table><thead><tr><th>Aspetto</th><th>Misurato sul riferimento</th><th>${esc(id.name)} v1</th><th>Fonte</th></tr></thead><tbody>
    <tr><td>Griglia di spaziatura</td><td>${a.layout.base}px (${Math.round(a.layout.gridShares[a.layout.base] * 100)}% dei valori)</td><td>${sys.sizes.base}px · ${sys.sizes.spaceScale.join(' / ')}</td><td>struttura</td></tr>
    <tr><td>Scala tipografica</td><td>rapporto ${a.type.ratio}, display ${a.type.roles.display.size}px su corpo ${a.type.roles.body.size}px</td><td>display ${R.display.size}px su corpo ${R.body.size}px</td><td>struttura</td></tr>
    <tr><td>Altezza pulsanti e campi</td><td>CTA ${(a.components.buttons.find((b) => b.kind === 'filled') || { height: '?' }).height}px, campo ${a.components.input.height}px</td><td>${sys.sizes.ctaH}px / ${sys.sizes.inputH}px (oggi 44px)</td><td>struttura</td></tr>
    <tr><td>Raggi</td><td>card ${a.layout.cardRadius}px, piccoli ${sys.sizes.smallR}px</td><td>card ${sys.sizes.cardR}px (oggi 18px), campi ${sys.sizes.smallR}px (oggi 11px)</td><td>struttura</td></tr>
    <tr><td>Header</td><td>${a.components.nav ? a.components.nav.height : '?'}px desktop, 48px mobile</td><td>${sys.sizes.navH}px / ${sys.sizes.navMobileH}px (oggi 64px)</td><td>struttura</td></tr>
    <tr><td>Movimento</td><td>${esc(a.layout.easing)}, ${esc(a.layout.duration)}</td><td>stessa curva e durata</td><td>struttura</td></tr>
    <tr><td>Voce</td><td>sentence case, titoli di ~${a.voice.stats.headlineWords.median} parole, seconda persona</td><td>stesse regole, in spagnolo con il "tú"</td><td>struttura</td></tr>
    <tr><td>Colori</td><td>rosso e blu del riferimento: non usati</td><td>indaco notturno, oro, verde fiducia</td><td>${esc(id.name)}</td></tr>
    <tr><td>Font</td><td>Inter: non usato</td><td>Bricolage Grotesque, Figtree, IBM Plex Mono</td><td>${esc(id.name)}</td></tr>
    <tr><td>Forma dei pulsanti</td><td>rettangolare 8px: non usata</td><td>pillola</td><td>${esc(id.name)}</td></tr>
  </tbody></table></div>
  <ul class="muted t-small" style="margin-top:var(--space-3)">${sys.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
</div></section>

<section id="tipografia" class="alt"><div class="wrap">
  <div class="head"><div><p class="eyebrow">Tipografia</p><h2 class="t-h1">Tipografia</h2></div><p class="muted">Ogni ruolo alla sua dimensione reale, con clamp() tra 390px e 1440px.</p></div>
  <div class="spec">${Object.entries(R).map(([key, r]) => `<div class="spec-row reveal"><div><b>${roleNames[key]}</b><div class="meta">${r.mobileSize}→${r.size}px · ${r.weight} · ${r.leading} · ${r.tracking}em<br>rif. ${esc(r.ref)}</div></div><p class="t-${key === 'body' ? 'body' : key}"${key === 'body' ? '' : ''}>${esc(copy.samples[key])}</p></div>`).join('')}</div>
</div></section>

<section id="colore"><div class="wrap">
  <div class="head"><div><p class="eyebrow">Colore</p><h2 class="t-h1">Colore</h2></div><p class="muted">Palette di ${esc(id.name)}, invariata. Tema scuro predefinito e tema chiaro.</p></div>
  <div class="swatches">${Object.keys(dark).map((c) => `<div class="swatch"><i style="background:var(--color-${c})"></i><span>${c}<br>${esc(dark[c])}<br>${esc(light[c] || '')}</span></div>`).join('')}</div>
  <div class="themes" style="margin-top:var(--space-4)">${[['Scuro', dark], ['Chiaro', light]].map(([n, p]) => `<div class="theme" style="background:${p.background};color:${p.text}"><h3 class="t-h4" style="margin-bottom:var(--space-2)">Contrasto · tema ${n.toLowerCase()}</h3><table style="color:inherit"><tbody>${pairs.map(([f, b]) => { const r = ratio(p[f], p[b]); return `<tr><td style="border-color:${p['border-strong']}"><span style="display:inline-block;padding:2px 10px;border-radius:6px;background:${p[b]};color:${p[f]};border:1px solid ${p['border-strong']}">Aa</span> ${f} / ${b}</td><td style="border-color:${p['border-strong']}">${r}:1</td><td style="border-color:${p['border-strong']}">${r === 'n/a' ? '' : C.wcagLevel(+r)}</td></tr>`; }).join('')}</tbody></table></div>`).join('')}</div>
  <div style="margin-top:var(--space-4);height:120px;border-radius:var(--radius-card);background:var(--gradient-brand)"></div><p class="mono muted" style="margin-top:var(--space-1)">--gradient-brand: cielo dell'Ávila al tramonto</p>
</div></section>

<section id="layout" class="alt"><div class="wrap">
  <div class="head"><div><p class="eyebrow">Layout e spaziatura</p><h2 class="t-h1">Layout e spaziatura</h2></div><p class="muted">Contenitore ${esc(sys.tokens.find((t) => t.name === 'container').value)}, gutter 16px (24px largo), breakpoint ${sys.tokens.filter((t) => /^bp-/.test(t.name)).map((t) => t.value).join(', ')}.</p></div>
  <div class="split">
    <div><h3 class="t-h4" style="margin-bottom:var(--space-2)">Scala</h3><div class="stair">${sys.sizes.spaceScale.map((v, i) => `<div><span>${v}px</span><i style="width:var(--space-${i + 1})"></i></div>`).join('')}</div></div>
    <div><h3 class="t-h4" style="margin-bottom:var(--space-2)">Raggi</h3><div class="radii"><div style="border-radius:var(--radius-sm)">sm<br>${sys.sizes.smallR}px</div><div style="border-radius:var(--radius-card)">card<br>${sys.sizes.cardR}px</div><div style="border-radius:var(--radius-pill)">pill</div></div></div>
  </div>
</div></section>

<section id="componenti"><div class="wrap">
  <div class="head"><div><p class="eyebrow">Componenti</p><h2 class="t-h1">Componenti</h2></div><p class="muted">Ricerca in evidenza, CTA unico e card annuncio: lo schema del portale di riferimento con forme e colori di ${esc(id.name)}.</p></div>
  <div class="components">
    <div><h3 class="t-h4" style="margin-bottom:var(--space-2)">Navigazione</h3><div class="navmock"><span class="brand">${id.logoSvg || ''}${esc(id.name)}</span>${copy.nav.map((n) => `<a href="#componenti">${esc(n)}</a>`).join('')}<a class="btn btn-primary btn-sm" style="margin-left:auto;color:var(--color-on-accent)" href="#componenti">${esc(copy.publish)}</a></div></div>
    <div><h3 class="t-h4" style="margin-bottom:var(--space-2)">Ricerca</h3><form class="searchbar" onsubmit="return false"><select class="input" aria-label="Operación"><option>${esc(copy.buy)}</option><option>${esc(copy.rent)}</option></select><input class="input" placeholder="${esc(copy.searchPlaceholder)}" aria-label="Zona"><button class="btn btn-primary">${esc(copy.search)}</button></form></div>
    <div><h3 class="t-h4" style="margin-bottom:var(--space-2)">Pulsanti</h3><div class="row"><span class="btn btn-primary">${esc(copy.search)}</span><span class="btn">${esc(copy.secondary)}</span><span class="btn btn-trust">${esc(copy.trust)}</span><span class="btn btn-ghost">${esc(copy.ghost)}</span><span class="btn btn-sm">${esc(copy.small)}</span></div><p class="mono muted" style="margin-top:var(--space-1)">altezza ${sys.sizes.ctaH}px (piccolo ${sys.sizes.ctaH - 16}px) · padding 24px · pillola · un solo primario per schermata</p></div>
    <div><h3 class="t-h4" style="margin-bottom:var(--space-2)">Card annuncio</h3><div class="cards">${copy.listings.map((l) => `<article class="card reveal"><div class="media"><span class="chip ${l.verified ? 'chip-ok' : 'chip-gold'}">${esc(l.chip)}</span></div><div class="body"><div class="price">${esc(l.usd)} <small>${esc(l.bs)}</small></div><h4 class="t-h4">${esc(l.title)}</h4><p class="t-small muted">${esc(l.meta)}</p></div></article>`).join('')}</div><p class="mono muted" style="margin-top:var(--space-1)">raggio ${sys.sizes.cardR}px · media 16:10 · padding 16px · prezzo in mono USD + Bs.</p></div>
  </div>
</div></section>

<section id="voce" class="alt"><div class="wrap">
  <div class="head"><div><p class="eyebrow">Voce</p><h2 class="t-h1">Voce e tono</h2></div><p class="muted">Regole ricavate dalle misure sul riferimento (${a.voice.stats.headlines} titoli: mediana ${a.voice.stats.headlineWords.median} parole, ${Math.round((a.voice.stats.case.sentence || 0) * 100)}% sentence case, seconda persona ${a.voice.stats.you} contro ${a.voice.stats.we}), applicate allo spagnolo di ${esc(id.name)}.</p></div>
  <div class="rules">${copy.rules.map((r, i) => `<div class="rule reveal"><b>${String(i + 1).padStart(2, '0')}</b><h3 class="t-h4">${esc(r.title)}</h3><p class="t-small muted">${esc(r.why)}</p><p class="ex">${esc(r.ex)}</p></div>`).join('')}</div>
</div></section>

<section id="token"><div class="wrap">
  <div class="head"><div><p class="eyebrow">Token</p><h2 class="t-h1">Token</h2></div><p class="muted">${sys.tokens.length} token in CSS e JSON W3C (OKLCH e valori del tema chiaro in $extensions).</p></div>
  <div class="row" style="margin-bottom:var(--space-3)"><button class="btn btn-primary" data-dl="tokens.css">Scarica tokens.css</button><button class="btn" data-dl="tokens.json">Scarica tokens.json</button><button class="btn" data-dl="morada-bridge.css">Scarica morada-bridge.css</button></div>
  <div class="code2"><pre id="src-tokens.css">${esc(tokensCss)}</pre><pre id="src-tokens.json">${esc(tokensJson)}</pre></div>
</div></section>

<section id="migrazione" class="alt"><div class="wrap">
  <div class="head"><div><p class="eyebrow">Migrazione</p><h2 class="t-h1">Adottarlo nel sito</h2></div><p class="muted">Tre passi, senza riscrivere le viste.</p></div>
  <ol class="t-lead" style="display:grid;gap:var(--space-2);padding-left:22px;max-width:70ch">
    <li>Includere <code class="mono">tokens.css</code> e poi <code class="mono">morada-bridge.css</code> prima di <code class="mono">styles.css</code>: le variabili attuali (<code class="mono">--bg</code>, <code class="mono">--accent</code>, <code class="mono">--r</code>, …) diventano alias dei token.</li>
    <li>Sostituire i valori fissi fuori griglia: <code class="mono">min-height: 44px</code> → <code class="mono">var(--button-height)</code>, <code class="mono">padding: 0 18px</code> → <code class="mono">0 var(--button-pad-x)</code>, <code class="mono">--r-sm: 11px</code> → <code class="mono">var(--radius-sm)</code>.</li>
    <li>Applicare la scala tipografica ai titoli (<code class="mono">h1</code>, <code class="mono">h2</code>, <code class="mono">h3</code>) e le regole di voce ai testi dei CTA.</li>
  </ol>
  <pre style="margin-top:var(--space-3)" id="src-morada-bridge.css">${esc(bridgeCss)}</pre>
</div></section>
</main>
<footer><div class="wrap">${esc(id.name)} design system v1 · struttura misurata con reverse-brand su ${esc(a.host)} il ${esc((a.capturedAt || '').slice(0, 10))}; identità ${esc(id.name)}.</div></footer>
<script>
(function(){
var io='IntersectionObserver' in window?new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.1}):null;
document.querySelectorAll('.reveal').forEach(function(el){io?io.observe(el):el.classList.add('in')});
var b=document.getElementById('theme'),root=document.documentElement;
function sync(){var light=root.dataset.theme==='light'||(!root.dataset.theme&&matchMedia('(prefers-color-scheme: light)').matches);b.textContent=light?'Tema scuro':'Tema chiaro'}
b.addEventListener('click',function(){var light=b.textContent==='Tema chiaro';root.dataset.theme=light?'light':'dark';sync()});sync();
document.querySelectorAll('[data-dl]').forEach(function(x){x.addEventListener('click',function(){var n=x.dataset.dl,a=document.createElement('a');a.href=URL.createObjectURL(new Blob([document.getElementById('src-'+n).textContent],{type:'text/plain'}));a.download=n;a.click()})});
})();
</script>
</body>
</html>`;
}

module.exports = { systemPage };
