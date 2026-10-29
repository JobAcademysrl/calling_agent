'use strict';
// Image slots: prompts written from the measured photography stats (never from the brand's
// pixels), manual import, an optional API provider, and WebP re-encoding through ffmpeg.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const C = require('./color');

const SUFFIX = 'photorealistic, no text, letters, logos, brand marks, cards or app screens';
const SLOT_SPECS = {
  hero: { aspectRatio: '16:9', wide: true, role: 'cover' },
  horizon: { aspectRatio: '21:9', wide: true, role: 'typography chapter' },
  object: { aspectRatio: '4:5', wide: false, role: 'colour (studio render)' },
  street: { aspectRatio: '3:4', wide: false, role: 'voice (lifestyle)' },
  sky: { aspectRatio: '16:9', wide: true, role: 'clean background' },
  glass: { aspectRatio: '4:3', wide: false, role: 'components (orderly material)' },
  grid: { aspectRatio: '3:2', wide: false, role: 'layout' },
  tokens: { aspectRatio: '1:1', wide: false, role: 'design tokens' },
  subject: { aspectRatio: '4:3', wide: false, role: 'card media (brand subject)' },
};

// Scene sets per domain. Subjects are new; only the style follows the site.
const DOMAINS = {
  realestate: {
    test: /(casa|case|immobil|appartament|affitt|vendita|mutu|real estate|apartment|home|house|property|bilocale|trilocale|villa|agenzi)/i,
    hero: 'a sunlit contemporary Italian apartment living room with tall windows, linen sofa and oak floor, city rooftops softly visible outside',
    horizon: 'a calm panoramic view over terracotta rooftops of an Italian city at dawn, long horizon, haze over distant hills',
    object: 'a single brass door key resting on a smooth stone plinth, studio render, seamless backdrop',
    street: 'a young couple carrying a cardboard moving box up the steps of a pastel residential building, candid, warm afternoon light',
    sky: 'a clear pale morning sky above the top edge of a white modern residential building, minimal',
    glass: 'an orderly facade of identical modern balconies and glass railings in repeating rhythm, architectural detail',
    grid: 'an overhead view of a tidy residential neighbourhood with regular rows of courtyards and gardens',
    tokens: 'neat stacks of architectural material samples: plaster, oak, terrazzo and brushed metal swatches arranged in a grid',
    subject: 'a bright kitchen with an island, pendant lights and a bowl of lemons, interior photography',
  },
  generic: {
    test: /.*/,
    hero: 'a bright contemporary workspace with large windows and plants, people out of focus in the background',
    horizon: 'a wide calm horizon over a city at dawn with soft haze',
    object: 'a single sculptural object on a smooth plinth, studio render, seamless backdrop',
    street: 'a person walking through a sunlit city street, candid lifestyle photograph',
    sky: 'a clear pale sky with a thin band of light cloud, minimal',
    glass: 'an orderly arrangement of frosted glass panels in repeating rhythm',
    grid: 'an overhead view of a tidy modular structure forming a regular grid',
    tokens: 'neat rows of material swatches arranged in a grid on a table',
    subject: 'a bright interior detail with natural light and simple furniture',
  },
};

function colourName(hex) {
  const { l, c, h } = C.oklch(hex);
  const tone = l > 0.85 ? 'pale ' : l < 0.35 ? 'deep ' : '';
  if (c < 0.03) return l > 0.9 ? 'white' : l < 0.25 ? 'near-black' : `${tone}grey`;
  const names = [[20, 'red'], [45, 'coral'], [70, 'orange'], [100, 'amber'], [125, 'yellow'], [150, 'lime'], [175, 'green'], [200, 'teal'], [230, 'cyan'], [260, 'blue'], [290, 'indigo'], [320, 'violet'], [350, 'magenta'], [361, 'red']];
  return tone + (names.find(([deg]) => h < deg) || [0, 'red'])[1];
}

function buildPrompts(a, snapMeta) {
  const context = [a.brand, ...a.pages.map((p) => p.title), ...(a.imagery.altThemes || []).map((w) => w.word), snapMeta || ''].join(' ');
  const domainKey = Object.keys(DOMAINS).find((k) => DOMAINS[k].test.test(context));
  const d = DOMAINS[domainKey];
  const R = a.colour.roles;
  const palette = [R.action.hex, R.accent.hex, R['surface-inverse'].hex, R.surface.hex].map(colourName);
  const fullBleed = a.imagery.fullBleedShare >= 0.15;
  const crop = (a.imagery.crops[0] || {}).crop || '16:9';
  const style = [
    'editorial photography, natural daylight, soft shadows, true-to-life colour',
    `restrained palette with ${[...new Set(palette)].slice(0, 3).join(', ')} accents`,
    fullBleed ? 'composed for full-bleed use with calm areas for overlaid text' : 'composed to sit inside rounded cards with the subject centred',
    `framing similar to the site's dominant ${crop} crop`,
  ].join(', ');
  const study = {
    domain: domainKey,
    observed: {
      mediaElements: a.imagery.count,
      formats: a.imagery.formats,
      crops: a.imagery.crops.slice(0, 4),
      fullBleedShare: a.imagery.fullBleedShare,
      inCardShare: a.imagery.inCardShare,
      objectFit: a.imagery.objectFit,
      altThemes: a.imagery.altThemes.slice(0, 10),
    },
    style,
    note: 'Style derived from measured image stats and alt text only. No brand image is used as model input.',
  };
  const slots = Object.entries(SLOT_SPECS).map(([slot, spec]) => ({
    slot, aspectRatio: spec.aspectRatio, role: spec.role,
    resolution: spec.wide ? 2000 : 1400,
    prompt: `${d[slot]}. ${style}. ${SUFFIX}`,
  }));
  return { brand: a.brand, generatedAt: new Date().toISOString(), suffix: SUFFIX, study, slots };
}

function ffmpegToWebp(src, dst, width, quality) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', `scale='min(${width},iw)':-2:flags=lanczos`, '-c:v', 'libwebp', '-quality', String(quality), '-compression_level', '6', dst]);
}

function probe(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file]).toString().trim();
  const [w, h] = out.split(',').map(Number);
  return { width: w, height: h };
}

// Build images/manifest.json from images/<slot>.(png|jpg|jpeg|webp) dropped in by the user or the API step.
function importImages(outDir, prompts, log, quality = 72) {
  const dir = path.join(outDir, 'images');
  fs.mkdirSync(dir, { recursive: true });
  const manifest = {};
  const prev = readJson(path.join(dir, 'manifest.json')) || {};
  for (const p of prompts.slots) {
    const src = ['png', 'jpg', 'jpeg', 'webp'].map((e) => path.join(dir, `${p.slot}.${e}`)).find((f) => fs.existsSync(f) && !f.endsWith('.webp'))
      || (fs.existsSync(path.join(dir, `${p.slot}.source.webp`)) ? path.join(dir, `${p.slot}.source.webp`) : null);
    if (!src) continue;
    const dst = path.join(dir, `${p.slot}.webp`);
    ffmpegToWebp(src, dst, p.resolution, quality);
    const dim = probe(dst);
    manifest[p.slot] = { file: `images/${p.slot}.webp`, source: (prev[p.slot] && prev[p.slot].source) || 'manual', aiGenerated: true, prompt: p.prompt, width: dim.width, height: dim.height, bytes: fs.statSync(dst).size, quality, cost: prev[p.slot] && prev[p.slot].cost };
    log('images', `${p.slot}: ${dim.width}x${dim.height} webp, ${Math.round(manifest[p.slot].bytes / 1024)} KB`);
  }
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

function withDataUris(outDir, manifest) {
  const out = {};
  for (const [slot, m] of Object.entries(manifest || {})) {
    const f = path.join(outDir, m.file);
    if (fs.existsSync(f)) out[slot] = Object.assign({}, m, { dataUri: `data:image/webp;base64,${fs.readFileSync(f).toString('base64')}` });
  }
  return out;
}

function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } }

// IMAGES=api: generate every slot through the provider adapter. Job ids are written before
// polling so a crash never loses a paid image; downloads stream straight to disk.
async function generateAll(outDir, prompts, log, env) {
  const provider = require('./providers/' + (env.IMAGE_PROVIDER || 'replicate'));
  const dir = path.join(outDir, 'images');
  fs.mkdirSync(dir, { recursive: true });
  const jobsFile = path.join(dir, 'jobs.json');
  const jobs = readJson(jobsFile) || {};
  const manifestFile = path.join(dir, 'manifest.json');
  const manifest = readJson(manifestFile) || {};
  const balance = await provider.balance(env).catch((e) => ({ available: false, note: e.message }));
  log('images', `provider ${provider.name}; balance: ${balance.available ? balance.value : 'not available (' + balance.note + ')'}`);
  for (const p of prompts.slots) {
    const target = path.join(dir, `${p.slot}.png`);
    if (fs.existsSync(target)) { log('images', `${p.slot}: already on disk, skipped`); continue; }
    let job = jobs[p.slot];
    if (!job) {
      job = await provider.submit({ prompt: p.prompt, aspectRatio: p.aspectRatio, resolution: p.resolution }, env);
      jobs[p.slot] = job;
      fs.writeFileSync(jobsFile, JSON.stringify(jobs, null, 2));
    }
    const t0 = Date.now();
    const done = await provider.poll(job, env);
    await provider.download(done, target, env);
    manifest[p.slot] = Object.assign(manifest[p.slot] || {}, { source: provider.name, cost: provider.costPerImage(env) });
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
    log('images', `${p.slot}: generated in ${((Date.now() - t0) / 1000).toFixed(1)} s, cost ${provider.costPerImage(env).toFixed(3)} USD`);
  }
}

module.exports = { buildPrompts, importImages, withDataUris, generateAll, SLOT_SPECS, SUFFIX, readJson, ffmpegToWebp };
