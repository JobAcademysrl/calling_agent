#!/usr/bin/env node
'use strict';
// reverse-brand <url> — turn a public brand website into an unofficial, art-directed brand guide.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const VERSION = require('../package.json').version;

const HELP = `reverse-brand ${VERSION}

Usage:
  reverse-brand <url> [options]

Capture:
  --headed               Open a visible browser; you complete any bot check yourself.
  --snapshot <file>      Skip capture and use a snapshot.json (e.g. from the DevTools snippet).
  --snippet              Only write the DevTools snippet (snippet-devtools.js) and exit.
  --max-pages <n>        Key pages besides home, 3-5 (default 5).

Images (IMAGES env var or --images):
  --images none|manual|api   none: gradient fallbacks (default). manual: print prompts; drop files
                             into out/<host>/images/<slot>.png then run with --import. api: use the
                             provider adapter in src/providers (key read from .env, never logged).
  --import               Build images/manifest.json from images/<slot>.(png|jpg|webp).

Output:
  --out <dir>            Output root (default ./out). Files go to <out>/<host>/.
  --no-video             Skip the MP4 (stills are still written).
  --stills               Only write video stills, no MP4.
  --no-slides            Skip social slides.
  --no-verify            Skip verify.js.
`;

function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { o._.push(a); continue; }
    const k = a.slice(2);
    if (['snapshot', 'images', 'out', 'max-pages'].includes(k)) o[k] = argv[++i];
    else o[k.startsWith('no-') ? k.slice(3) : k] = !k.startsWith('no-');
  }
  return o;
}

function loadEnv(dir) {
  const env = Object.assign({}, process.env);
  const f = path.join(dir, '.env');
  if (fs.existsSync(f)) fs.readFileSync(f, 'utf8').split('\n').forEach((l) => { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); });
  return env;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args._[0] && !args.snapshot)) { console.log(HELP); process.exit(args.help ? 0 : 1); }
  const env = loadEnv(process.cwd());
  const imagesMode = args.images || env.IMAGES || 'none';
  const runLog = [];
  const notes = [];
  const log = (phase, msg) => { notes.push({ t: new Date().toISOString(), phase, msg }); console.log(`[${phase}] ${msg}`); };
  const timed = async (phase, fn, note) => { const t0 = Date.now(); const r = await fn(); runLog.push({ phase, ms: Date.now() - t0, note: typeof note === 'function' ? note(r) : note }); return r; };

  const { buildSnippet } = require('../src/snippet');
  let url = args._[0];
  if (url && !/^https?:\/\//.test(url)) url = 'https://' + url;
  const hostGuess = url ? new URL(url).host : null;
  const outRoot = path.resolve(args.out || 'out');

  if (args.snippet) {
    const dir = path.join(outRoot, hostGuess || 'snippet');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'snippet-devtools.js'), buildSnippet(VERSION));
    console.log(`Wrote ${path.join(dir, 'snippet-devtools.js')}`);
    return;
  }

  // 1. Capture.
  let snap;
  if (args.snapshot) {
    snap = await timed('capture', async () => JSON.parse(fs.readFileSync(args.snapshot, 'utf8')), 'loaded snapshot.json');
    log('capture', `snapshot from ${snap.source} (${snap.pages.length} pages${snap.mobile ? ' + 390px home' : ''})`);
  } else {
    const { capture, ChallengeError } = require('../src/capture');
    try {
      snap = await timed('capture', () => capture(url, { headed: args.headed, version: VERSION, maxPages: +(args['max-pages'] || 5) }, log), (s) => `${s.pages.length} pages + 390px home`);
    } catch (e) {
      if (!(e instanceof ChallengeError)) throw e;
      const dir = path.join(outRoot, hostGuess);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'snippet-devtools.js'), buildSnippet(VERSION));
      console.error(`\nBot check detected (${e.message}). Capture stopped; nothing was bypassed.\n
Choose one:
  (a) reverse-brand ${url} --headed
      A visible browser opens. Complete the check yourself; capture continues afterwards.
  (b) Open ${url} in your own browser, paste ${path.join(dir, 'snippet-devtools.js')}
      into the DevTools Console, then run:
      reverse-brand ${url} --snapshot ~/Downloads/snapshot.json\n`);
      process.exit(2);
    }
  }
  snap.host = snap.host || hostGuess;
  const host = snap.host;
  const outDir = path.join(outRoot, host);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'snapshot.json'), JSON.stringify(snap));
  (snap.log || []).forEach((l) => notes.push({ t: '', phase: 'snippet', msg: l }));

  // 2-3. Analyse and tokens.
  const { analyse } = require('../src/analyse');
  const T = require('../src/tokens');
  const a = await timed('analyse', async () => analyse(snap), (r) => `${r.assumptions.length} assumptions`);
  fs.writeFileSync(path.join(outDir, 'analysis.json'), JSON.stringify(a, null, 2));
  const tokens = T.buildTokens(a);
  const meta = { brand: a.brand, origin: a.origin, capturedAt: a.capturedAt };
  const tokensCss = T.toCss(tokens, meta);
  const tokensJson = T.toJson(tokens, meta);
  fs.writeFileSync(path.join(outDir, 'tokens.css'), tokensCss);
  fs.writeFileSync(path.join(outDir, 'tokens.json'), tokensJson);
  runLog.push({ phase: 'tokens', ms: 0, note: `${tokens.length} tokens` });

  // 5. Images (before the guide so the hero edition can embed them).
  const IM = require('../src/images');
  const prompts = IM.buildPrompts(a, (snap.pages[0] || {}).metaDescription);
  fs.writeFileSync(path.join(outDir, 'prompts.json'), JSON.stringify(prompts, null, 2));
  fs.mkdirSync(path.join(outDir, 'images'), { recursive: true });
  if (imagesMode === 'manual' && !args.import) {
    console.log('\nIMAGES=manual. Generate these in any tool, save as images/<slot>.png, then re-run with --import:\n');
    prompts.slots.forEach((p) => console.log(`  ${p.slot} (${p.aspectRatio}, ${p.resolution}px): ${p.prompt}\n`));
  }
  if (imagesMode === 'api') await timed('images-api', () => IM.generateAll(outDir, prompts, log, env), 'provider adapter');
  let manifest = {};
  if (args.import || imagesMode === 'api' || fs.existsSync(path.join(outDir, 'images', 'manifest.json'))) {
    manifest = await timed('images-import', async () => (args.import || imagesMode === 'api' ? IM.importImages(outDir, prompts, log) : IM.readJson(path.join(outDir, 'images', 'manifest.json')) || {}), (m) => `${Object.keys(m).length} images`);
  }
  if (imagesMode === 'none') log('images', 'IMAGES=none: gradient fallbacks are the design');

  // 4. Guide, two editions.
  const { renderGuide } = require('../src/guide');
  const write = (edition, man) => {
    const file = path.join(outDir, edition === 'hero' ? 'brand-guide-hero.html' : 'brand-guide.html');
    fs.writeFileSync(file, renderGuide({ a, tokens, tokensCss, tokensJson, manifest: man, prompts, runLog, edition }));
    return fs.statSync(file).size;
  };
  let full = IM.withDataUris(outDir, manifest);
  await timed('guide', async () => {
    write('light', {});
    let size = write('hero', full);
    // Keep the hero edition inside 4 MB by re-encoding at lower quality if needed.
    for (const q of [62, 52, 44]) {
      if (size <= 4 * 1024 * 1024 || !Object.keys(manifest).length) break;
      manifest = IM.importImages(outDir, prompts, log, q);
      full = IM.withDataUris(outDir, manifest);
      size = write('hero', full);
    }
  }, () => `light ${kb(path.join(outDir, 'brand-guide.html'))}, hero ${kb(path.join(outDir, 'brand-guide-hero.html'))}`);

  // 6-7. Slides and video.
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ args: ['--disable-gpu'] }).catch(() => chromium.launch({ channel: 'chrome', args: ['--disable-gpu'] }));
  const ctx = { a, tokensCss, manifest: full };
  try {
    if (args.slides !== false) await timed('slides', () => require('../src/slides').renderSlides(browser, ctx, outDir, log), (f) => `${f.length} images`);
    await timed('video', () => require('../src/video').renderVideo(browser, ctx, outDir, log, { video: args.video !== false && !args.stills, stills: true }), (f) => (f ? path.basename(f) : 'stills only'));
  } finally { await browser.close(); }

  // Run log (written before verify so verify can check it, then rewritten with verify timing).
  const writeLog = () => fs.writeFileSync(path.join(outDir, 'run-log.md'), require('../src/runlog').runLogMd({ a, snap, runLog, notes, manifest, prompts, outDir, imagesMode, version: VERSION }));
  writeLog();
  // 8. Verify.
  if (args.verify !== false) {
    const t0 = Date.now();
    let ok = true;
    try { execFileSync(process.execPath, [path.join(__dirname, '..', 'verify.js'), outDir], { stdio: 'inherit' }); } catch { ok = false; }
    runLog.push({ phase: 'verify', ms: Date.now() - t0, note: ok ? 'all checks passed' : 'FAILED, see verify-report.json' });
    writeLog();
    if (!ok) process.exitCode = 1;
  }
  console.log(`\nDone: ${outDir}`);
}

function kb(f) { return fs.existsSync(f) ? `${Math.round(fs.statSync(f).size / 1024)} KB` : 'n/a'; }

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
