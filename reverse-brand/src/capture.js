'use strict';
// Playwright capture: home + 3-5 key pages at 1440x900, plus a 390x844 pass of the home page.
// Never bypasses bot checks: on a challenge it stops (headless) or waits for the user (--headed).
const { rbExtract, rbDetectChallenge } = require('./extractor');
const { pickPages } = require('./pages');

class ChallengeError extends Error {}

async function launch(headed, log) {
  const { chromium } = require('playwright');
  const args = ['--disable-gpu'];
  try {
    const b = await chromium.launch({ channel: 'chrome', headless: !headed, args });
    log('browser', 'installed Google Chrome (channel "chrome")');
    return b;
  } catch (e) {
    const b = await chromium.launch({ headless: !headed, args });
    log('browser', 'Google Chrome not found; fell back to Playwright Chromium');
    return b;
  }
}

async function gotoSettled(page, url) {
  const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  return res;
}

async function checkChallenge(page, res, headed, log) {
  let ch = await page.evaluate(`(${rbDetectChallenge.toString()})(window)`);
  if (!ch.challenge && res && [403, 429, 503].includes(res.status())) {
    const len = await page.evaluate(() => (document.body ? document.body.innerText.trim().length : 0));
    if (len < 400) ch = { challenge: true, reason: `HTTP ${res.status()} with a near-empty page` };
  }
  if (!ch.challenge) return;
  if (!headed) throw new ChallengeError(ch.reason);
  log('challenge', `${ch.reason}. Waiting up to 5 minutes for you to complete the check in the browser window.`);
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(3000);
    const again = await page.evaluate(`(${rbDetectChallenge.toString()})(window)`).catch(() => ({ challenge: true }));
    if (!again.challenge) { await page.waitForTimeout(2000); return; }
  }
  throw new ChallengeError('the check was not completed within 5 minutes');
}

async function extractOn(page) {
  return page.evaluate(`(${rbExtract.toString()})(window, { scrollDelay: 250 })`);
}

async function capture(url, opts, log) {
  const headed = !!opts.headed;
  const browser = await launch(headed, log);
  const snap = { tool: 'reverse-brand', version: opts.version, source: headed ? 'playwright-headed' : 'playwright', capturedAt: new Date().toISOString(), pages: [], mobile: null, picks: null, log: [] };
  try {
    const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: opts.locale || 'it-IT' });
    const page = await desk.newPage();
    const res = await gotoSettled(page, url);
    await checkChallenge(page, res, headed, log);
    const home = await extractOn(page);
    snap.origin = new URL(home.url).origin;
    snap.host = new URL(home.url).host;
    snap.pages.push(home);
    log('page', `home ${home.url}: ${home.elementsVisible} visible of ${home.elementsVisited} elements`);

    const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: opts.locale || 'it-IT' });
    const mp = await mob.newPage();
    const mres = await gotoSettled(mp, home.url);
    await checkChallenge(mp, mres, headed, log);
    snap.mobile = await extractOn(mp);
    log('page', `home 390px: ${snap.mobile.elementsVisible} visible elements`);
    await mob.close();

    const sel = pickPages(home.url, home.links, { min: 3, max: opts.maxPages || 5 });
    snap.picks = sel;
    if (!sel.enough) log('pages', `only ${sel.picked.length} candidate pages after filtering`);
    for (const p of sel.picked) {
      try {
        const r = await gotoSettled(page, p.href);
        await checkChallenge(page, r, headed, log);
        const rec = await extractOn(page);
        snap.pages.push(rec);
        log('page', `${p.href} (score ${p.score}: ${p.why.join(', ')}): ${rec.elementsVisible} visible elements`);
      } catch (e) {
        if (e instanceof ChallengeError) throw e;
        log('page', `skipped ${p.href}: ${e.message.split('\n')[0]}`);
      }
    }
  } finally {
    await browser.close();
  }
  return snap;
}

module.exports = { capture, ChallengeError };
