'use strict';
// run-log.md: timing per phase, pages and elements, output sizes, image cost, assumptions.
const fs = require('fs');
const path = require('path');

function size(f) {
  if (!fs.existsSync(f)) return 'missing';
  const st = fs.statSync(f);
  if (st.isDirectory()) {
    const files = fs.readdirSync(f);
    const total = files.reduce((s, x) => s + fs.statSync(path.join(f, x)).size, 0);
    return `${files.length} files, ${(total / 1024).toFixed(0)} KB`;
  }
  return st.size > 1024 * 1024 ? `${(st.size / 1024 / 1024).toFixed(2)} MB` : `${(st.size / 1024).toFixed(1)} KB`;
}

function runLogMd({ a, snap, runLog, notes, manifest, prompts, outDir, imagesMode, version }) {
  const L = [];
  L.push(`# Run log: ${a.brand} (${a.host})`, '');
  L.push(`Unofficial analysis. Not affiliated with or endorsed by ${a.brand}. Trademarks belong to their owners.`, '');
  L.push(`- Tool: reverse-brand ${version}`, `- Captured: ${a.capturedAt} via ${a.source}`, `- Images mode: ${imagesMode}`, '');
  L.push('## Timing per phase', '', '| Phase | Time | Notes |', '|---|---|---|');
  if (snap.durationMs) L.push(`| capture (in browser) | ${(snap.durationMs / 1000).toFixed(1)} s | DevTools snippet run time |`);
  runLog.forEach((r) => L.push(`| ${r.phase} | ${(r.ms / 1000).toFixed(1)} s | ${r.note || ''} |`));
  L.push('', '## Pages and elements', '', '| Page | Viewport | Elements walked | Visible | Consent nodes excluded |', '|---|---|---|---|---|');
  snap.pages.forEach((p) => L.push(`| ${p.url} | ${p.viewport.w}x${p.viewport.h} | ${p.elementsVisited} | ${p.elementsVisible} | ${p.excludedConsent} |`));
  if (snap.mobile) L.push(`| ${snap.mobile.url} | ${snap.mobile.viewport.w}x${snap.mobile.viewport.h} | ${snap.mobile.elementsVisited} | ${snap.mobile.elementsVisible} | ${snap.mobile.excludedConsent} |`);
  if (snap.picks) {
    L.push('', '### Page picks', '', 'Same-origin links scored: nav +5, product/pricing/business/company keywords +3, shallow paths +0..2, footer-only -1, query strings -2. Legal, help, login and locale duplicates skipped; one page per top-level path.', '', '| Candidate | Score | Why |', '|---|---|---|');
    snap.picks.candidates.slice(0, 12).forEach((c) => L.push(`| ${c.href} | ${c.score} | ${c.why.join(', ')} |`));
  }
  L.push('', '## Output sizes', '');
  ['brand-guide.html', 'brand-guide-hero.html', 'tokens.css', 'tokens.json', 'snapshot.json', 'prompts.json', 'images', 'slides', 'video'].forEach((f) => L.push(`- ${f}: ${size(path.join(outDir, f))}`));
  const mp4 = fs.existsSync(path.join(outDir, 'video')) ? fs.readdirSync(path.join(outDir, 'video')).find((f) => f.endsWith('.mp4')) : null;
  if (mp4) L.push(`- video/${mp4}: ${size(path.join(outDir, 'video', mp4))}`);
  L.push('', '## Images and cost', '');
  const slots = Object.keys(manifest || {});
  if (!slots.length) L.push(`No images generated (IMAGES=${imagesMode}). Every image slot uses a CSS gradient built from the colour tokens. Cost: 0.`);
  else {
    L.push('| Slot | Source | Size | Cost |', '|---|---|---|---|');
    let total = 0;
    slots.forEach((s) => { const m = manifest[s]; total += m.cost || 0; L.push(`| ${s} | ${m.source} | ${m.width}x${m.height}, ${(m.bytes / 1024).toFixed(0)} KB webp | ${m.cost != null ? '$' + m.cost.toFixed(3) : 'n/a (manual)'} |`); });
    L.push('', `Total image cost: $${total.toFixed(3)}`);
  }
  L.push('', '## LLM token usage', '', 'The CLI makes no LLM calls; all analysis is deterministic. Token usage of the assistant session that built and ran it is not measured here.');
  L.push('', '## Assumptions', '');
  L.push('- Viewports: 1440x900 for every page; 390x844 for the home page only (responsive type).');
  L.push('- Repeated chrome: any count identical on every page (header, footer) is counted once.');
  L.push('- Colours are normalised through a 1px canvas; translucent text is composited over its effective ground.');
  L.push('- Type roles: heading sizes clustered within 12%; body = the size with most characters between 13 and 19px.');
  L.push('- Fonts are referenced by family name only; no font files are embedded. The guide falls back to system fonts where the face is not installed.');
  L.push('- Logos are shown as dashed placeholders at their measured size and colour; no brand images are copied.');
  a.assumptions.forEach((x) => L.push(`- ${x.area}: ${x.text}`));
  if (snap.fallback) L.push(`- Capture fallback: ${snap.fallback} (iframes were not readable).`);
  L.push('', '## Image prompts', '', `Suffix on every prompt: "${prompts.suffix}"`, '', '| Slot | Aspect | Prompt |', '|---|---|---|');
  prompts.slots.forEach((p) => L.push(`| ${p.slot} | ${p.aspectRatio} | ${p.prompt.replace(/\|/g, '/')} |`));
  L.push('', '## Event log', '');
  notes.forEach((n) => L.push(`- ${n.phase}: ${n.msg}`));
  return L.join('\n') + '\n';
}

module.exports = { runLogMd };
