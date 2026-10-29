'use strict';
// Builds the paste-into-DevTools snippet. It runs the same extractor as the Playwright capture,
// inside one same-origin popup window at 1440px and 390px, and downloads snapshot.json.
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
// Pages are opened in one same-origin popup window (sites that forbid iframes still allow this).
// The popup is opened once, synchronously, so the console's user gesture covers it.
const pop = window.open('about:blank', 'reverse-brand', 'popup,width=1440,height=900,left=0,top=0');
if (!pop) {
  note('popup blocked: allow pop-ups for this site (icon in the address bar), then run the snippet again');
  alert('reverse-brand: allow pop-ups for this site, then run the snippet again.');
  return;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function inPopup(url, w, h) {
  try { pop.resizeTo(w + (pop.outerWidth - pop.innerWidth), h + (pop.outerHeight - pop.innerHeight)); } catch (e) {}
  pop.location.href = url;
  await wait(800);
  const deadline = Date.now() + 45000;
  for (;;) {
    let ready = false;
    try { ready = pop.document.readyState === 'complete' && pop.location.href !== 'about:blank'; } catch (e) { throw new Error('popup left the site (redirect to another origin)'); }
    if (ready) break;
    if (Date.now() > deadline) throw new Error('page did not finish loading in 45 s');
    await wait(300);
  }
  await wait(2500);
  const ch = rbDetectChallenge(pop);
  if (ch.challenge) throw new Error('bot check: ' + ch.reason + '. Complete it in the popup and run the snippet again.');
  if (Math.abs(pop.innerWidth - w) > 40) note('viewport is ' + pop.innerWidth + 'x' + pop.innerHeight + ' instead of ' + w + 'x' + h + ' (screen too small or window not resizable)');
  return rbExtract(pop, { scrollDelay: 300 });
}
const t0 = performance.now();
const snap = { tool: 'reverse-brand', version: VERSION, source: 'devtools', capturedAt: new Date().toISOString(), origin: location.origin, host: location.host, userAgent: navigator.userAgent, pages: [], mobile: null, picks: null, log };
const homeUrl = location.origin + location.pathname;
try {
  note('home 1440x900');
  snap.pages.push(await inPopup(homeUrl, 1440, 900));
} catch (e) {
  note('popup capture failed (' + e.message + '); falling back to this window at ' + innerWidth + 'px');
  snap.pages.push(await rbExtract(window, { scrollDelay: 300 }));
  snap.fallback = 'top-window';
}
if (!snap.fallback) {
  const sel = pickPages(homeUrl, snap.pages[0].links, { min: 3, max: 5 });
  snap.picks = sel;
  for (const p of sel.picked) {
    try { note('page ' + p.href); snap.pages.push(await inPopup(p.href, 1440, 900)); }
    catch (e) { note('skip ' + p.href + ': ' + e.message); }
  }
  try {
    note('home 390x844');
    const m = await inPopup(homeUrl, 390, 844);
    if (m.viewport.w <= 430) snap.mobile = m;
    else note('mobile pass discarded: the popup could not be narrowed to 390px; mobile sizes will be inferred');
  } catch (e) { note('mobile pass failed: ' + e.message); }
}
try { pop.close(); } catch (e) {}

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
