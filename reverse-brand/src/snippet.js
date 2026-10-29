'use strict';
// Builds the paste-into-DevTools snippet. It runs the same extractor as the Playwright capture,
// inside same-origin iframes at 1440px and 390px, and downloads snapshot.json.
const fs = require('fs');
const path = require('path');
const { rbExtract, rbDetectChallenge } = require('./extractor');

function moduleBody(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8').replace(/^'use strict';\s*/m, '').replace(/module\.exports[\s\S]*$/m, '');
}

function buildSnippet(version) {
  return `// reverse-brand ${version} DevTools snippet. Paste into the Console on the brand's home page.
// It reads computed styles only: no logos, fonts or images are downloaded. Unofficial analysis.
(async () => {
${moduleBody('pages.js')}
const rbExtract = ${rbExtract.toString()};
const rbDetectChallenge = ${rbDetectChallenge.toString()};
const VERSION = ${JSON.stringify(version)};
const log = [];
const note = (m) => { log.push(new Date().toISOString() + ' ' + m); console.log('[reverse-brand] ' + m); };
const box = document.createElement('div');
box.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;overflow:hidden;z-index:2147483647;pointer-events:none;opacity:0.02';
document.documentElement.appendChild(box);
async function inFrame(url, w, h) {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:absolute;left:0;top:0;border:0;width:' + w + 'px;height:' + h + 'px';
  const loaded = new Promise((res) => { f.onload = res; setTimeout(res, 30000); });
  f.src = url;
  box.appendChild(f);
  await loaded;
  await new Promise((r) => setTimeout(r, 2500));
  let win;
  try { win = f.contentWindow; void win.document.body.innerHTML; } catch (e) { f.remove(); throw new Error('frame not readable (blocked or cross-origin)'); }
  const ch = rbDetectChallenge(win);
  if (ch.challenge) { f.remove(); throw new Error('bot check in frame: ' + ch.reason); }
  const rec = await rbExtract(win, { scrollDelay: 300 });
  f.remove();
  return rec;
}
const t0 = performance.now();
const snap = { tool: 'reverse-brand', version: VERSION, source: 'devtools', capturedAt: new Date().toISOString(), origin: location.origin, host: location.host, userAgent: navigator.userAgent, pages: [], mobile: null, picks: null, log };
const homeUrl = location.origin + location.pathname;
try {
  note('home 1440x900');
  snap.pages.push(await inFrame(homeUrl, 1440, 900));
} catch (e) {
  note('iframe capture failed (' + e.message + '); falling back to this window at ' + innerWidth + 'px');
  snap.pages.push(await rbExtract(window, { scrollDelay: 300 }));
  snap.fallback = 'top-window';
}
try {
  note('home 390x844');
  snap.mobile = await inFrame(homeUrl, 390, 844);
} catch (e) { note('mobile pass failed: ' + e.message); }
if (!snap.fallback) {
  const sel = pickPages(homeUrl, snap.pages[0].links, { min: 3, max: 5 });
  snap.picks = sel;
  for (const p of sel.picked) {
    try { note('page ' + p.href); snap.pages.push(await inFrame(p.href, 1440, 900)); }
    catch (e) { note('skip ' + p.href + ': ' + e.message); }
  }
}
box.remove();
snap.durationMs = Math.round(performance.now() - t0);
note('done in ' + Math.round(snap.durationMs / 1000) + 's, ' + snap.pages.length + ' pages');
const blob = new Blob([JSON.stringify(snap)], { type: 'application/json' });
const a = document.createElement('a');
a.href = URL.createObjectURL(blob);
a.download = 'snapshot.json';
document.body.appendChild(a); a.click(); a.remove();
})();
`;
}

module.exports = { buildSnippet };
