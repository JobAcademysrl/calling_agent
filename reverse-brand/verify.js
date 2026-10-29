#!/usr/bin/env node
'use strict';
// verify.js <out/host> — checks the deliverables and writes section screenshots for review.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const SECTIONS = ['Overview', 'Contents', 'Typography', 'Fonts', 'Colour', 'Layout and spacing', 'Components', 'Imagery', 'Voice and tone', 'Design tokens', 'Method'];

async function main() {
  const dir = path.resolve(process.argv[2] || '.');
  const shots = path.join(dir, 'screenshots');
  fs.mkdirSync(shots, { recursive: true });
  const results = [];
  const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };

  const light = path.join(dir, 'brand-guide.html');
  const hero = path.join(dir, 'brand-guide-hero.html');
  const lightSize = fs.statSync(light).size;
  const heroSize = fs.statSync(hero).size;
  check('light edition <= 150 KB', lightSize <= 150 * 1024, `${(lightSize / 1024).toFixed(1)} KB`);
  check('hero edition <= 4 MB', heroSize <= 4 * 1024 * 1024, `${(heroSize / 1024 / 1024).toFixed(2)} MB`);
  let tj = null;
  try { tj = JSON.parse(fs.readFileSync(path.join(dir, 'tokens.json'), 'utf8')); } catch (e) { /* reported below */ }
  check('tokens.json parses', !!tj, tj ? `${Object.keys(tj).length - 1} groups` : 'parse error');
  for (const f of ['tokens.css', 'snapshot.json', 'prompts.json', 'run-log.md']) check(`${f} exists`, fs.existsSync(path.join(dir, f)));
  const slides = fs.existsSync(path.join(dir, 'slides')) ? fs.readdirSync(path.join(dir, 'slides')) : [];
  check('8 Instagram + 4 X slides', slides.filter((f) => f.startsWith('ig-')).length === 8 && slides.filter((f) => f.startsWith('x-')).length === 4, `${slides.length} files`);
  const vdir = path.join(dir, 'video');
  const mp4 = fs.existsSync(vdir) ? fs.readdirSync(vdir).find((f) => f.endsWith('.mp4')) : null;
  check('video present', !!mp4, mp4 || 'no mp4 (stills only?)');
  const vhtml = fs.existsSync(path.join(vdir, 'presentation.html')) ? fs.readFileSync(path.join(vdir, 'presentation.html'), 'utf8') : '';
  check('video carries Unofficial badge', /class="unofficial hud">Unofficial analysis/.test(vhtml));

  const browser = await chromium.launch({ args: ['--disable-gpu'] });
  for (const [edition, file] of [['light', light], ['hero', hero]]) {
    for (const [w, h] of [[1440, 900], [390, 844]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, offline: true, reducedMotion: 'reduce' });
      let external = 0;
      const urls = [];
      await ctx.route('**/*', (route) => {
        const u = route.request().url();
        if (u.startsWith('file:') || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
        external++; urls.push(u); return route.abort();
      });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto('file://' + file, { waitUntil: 'load' });
      await page.waitForTimeout(400);
      const tag = `${edition} @${w}`;
      check(`${tag}: zero network requests offline`, external === 0, urls.slice(0, 3).join(', '));
      check(`${tag}: no script errors`, errors.length === 0, errors[0]);
      const info = await page.evaluate((SECTIONS) => {
        const h2 = [...document.querySelectorAll('h2')].map((x) => x.textContent.trim());
        const txt = (sel) => { const el = document.querySelector(sel); return el ? el.textContent : ''; };
        const aiEls = [...document.querySelectorAll('[data-ai="1"]')];
        const webp = [...document.querySelectorAll('*')].filter((el) => getComputedStyle(el).backgroundImage.includes('data:image/webp'));
        const unlabeled = webp.filter((el) => { const host = el.closest('[data-ai="1"]') || (el.matches('[data-ai="1"]') ? el : null); return !host || !host.querySelector('.ai-label'); });
        return {
          missing: SECTIONS.filter((s) => !h2.includes(s)),
          cover: /Unofficial analysis/.test(txt('#cover')), topbar: /Unofficial analysis/.test(txt('#topbar')), footer: /Unofficial analysis/.test(txt('footer.site')),
          disclaimer: /Not affiliated with or endorsed by .+ Trademarks belong to their owners\./.test(document.body.textContent),
          quotes: document.querySelectorAll('.quote').length, rules: document.querySelectorAll('.rule').length,
          rebuild: document.body.dataset.rebuild, rebuildDetail: txt('#rebuild-check'),
          aiCount: aiEls.length, webpCount: webp.length, unlabeled: unlabeled.length,
          scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth,
          embeddedJson: (() => { try { JSON.parse(document.getElementById('tokens-json').textContent); return true; } catch { return false; } })(),
        };
      }, SECTIONS);
      if (w === 1440) {
        check(`${tag}: required sections`, !info.missing.length, info.missing.join(', ') || `${SECTIONS.length} found`);
        check(`${tag}: Unofficial on cover, top bar, footer + disclaimer`, info.cover && info.topbar && info.footer && info.disclaimer);
        check(`${tag}: five quotes and three rules`, info.quotes === 5 && info.rules === 3, `${info.quotes} quotes, ${info.rules} rules`);
        check(`${tag}: rebuild button and card equal token values`, info.rebuild === 'pass', info.rebuildDetail.replace(/\s+/g, ' ').slice(0, 160));
        check(`${tag}: embedded token JSON parses`, info.embeddedJson);
        check(`${tag}: AI label on every image`, info.unlabeled === 0, `${info.webpCount} image layers, ${info.aiCount} labelled slots`);
      }
      if (w === 390) check(`${tag}: no horizontal scroll`, info.scrollW <= info.innerW, `scrollWidth ${info.scrollW}`);

      // Screenshots: every section at desktop, full page at mobile.
      await page.evaluate(() => document.querySelectorAll('.reveal').forEach((e) => e.classList.add('in')));
      await page.evaluate(() => { document.getElementById('topbar').style.visibility = 'hidden'; });
      if (w === 1440) {
        const ids = await page.evaluate(() => [...document.querySelectorAll('main > section, footer.site')].map((s, i) => s.id || 'footer-' + i));
        for (let i = 0; i < ids.length; i++) {
          const el = (await page.$$('main > section, footer.site'))[i];
          await el.scrollIntoViewIfNeeded();
          await page.waitForTimeout(80);
          await el.screenshot({ path: path.join(shots, `${edition}-${String(i + 1).padStart(2, '0')}-${ids[i]}.png`) });
        }
      } else {
        await page.screenshot({ path: path.join(shots, `${edition}-mobile-390-full.png`), fullPage: true });
      }
      await ctx.close();
    }
  }
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  fs.writeFileSync(path.join(dir, 'verify-report.json'), JSON.stringify({ at: new Date().toISOString(), passed: results.length - failed.length, failed: failed.length, results }, null, 2));
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
