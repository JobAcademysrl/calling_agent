'use strict';
// 1920x1080 presentation at a real 60 fps. All animations are Web Animations, kept paused and
// seeked to i/fps for every frame, so rendering is frame-accurate regardless of capture speed.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const C = require('./color');
const { baseCss } = require('./theme');
const { pickButtonVariants } = require('./tokens');
const { esc } = require('./guide');

const W = 1920, H = 1080;
const SCENE = 4.2;      // seconds per scene
const XFADE = 0.7;      // cross-dissolve overlap

const css = `
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:#000}
.scene{position:absolute;inset:0;overflow:hidden;opacity:0;display:flex;flex-direction:column;padding:96px 120px;will-change:opacity,transform,filter}
.light{background:var(--ground-light);color:var(--ink-light)}.dark{background:var(--ground-dark);color:var(--ink-dark)}
.full{padding:0}
.bg{position:absolute;inset:0}.bg .img{position:absolute;inset:0;will-change:transform}
.shade::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgb(0 0 0 / .62),rgb(0 0 0 / .1) 65%)}
.inner{position:relative;z-index:2;display:flex;flex-direction:column;height:100%}
.kicker{font:600 26px/1.2 var(--font-body);letter-spacing:.06em;text-transform:uppercase;color:var(--color-action)}
.dark .kicker,.full .kicker{color:color-mix(in oklab,var(--color-action) 50%,white)}
.h{font-family:var(--font-display);font-weight:var(--type-display-weight);letter-spacing:var(--type-display-tracking);line-height:1.02;font-size:112px;margin-top:18px}
.p{font:400 34px/1.4 var(--font-body);opacity:.85;margin-top:22px;max-width:30ch}
.row{display:flex;gap:28px;margin-top:56px}
.stat{flex:1;border-radius:var(--card-radius);background:var(--color-surface);padding:40px;text-align:center}
.stat b{display:block;font-family:var(--font-display);font-size:120px;line-height:1;color:var(--color-action);font-weight:var(--type-display-weight)}
.stat span{font:400 30px/1.3 var(--font-body)}
.roles{display:grid;gap:22px;margin-top:40px}
.role{display:flex;align-items:baseline;justify-content:space-between;border-bottom:1px solid rgb(255 255 255 / .25);padding-bottom:16px}
.role span:last-child{font:500 24px/1 ui-monospace,Menlo,monospace;opacity:.8}
.pal{display:flex;height:150px;border-radius:var(--card-radius);overflow:hidden;margin-top:44px}
.pal span{transform-origin:left center}
.tiles{display:grid;grid-template-columns:repeat(6,1fr);gap:16px;margin-top:22px}
.tile{border-radius:calc(var(--card-radius) * .75);padding:20px;height:170px;display:flex;flex-direction:column;justify-content:space-between;font:600 24px/1.2 var(--font-body)}
.tile code{font:500 18px/1.3 ui-monospace,monospace}
.cols{display:grid;gap:18px;height:300px;margin-top:48px}
.cols i{background:color-mix(in oklab,var(--color-action) 28%,transparent);border-radius:8px;transform-origin:bottom}
.facts{display:grid;grid-template-columns:repeat(4,1fr);gap:36px;margin-top:48px}
.fact{border-top:3px solid currentColor;padding-top:18px;font:400 26px/1.3 var(--font-body)}.fact b{display:block;font-family:var(--font-display);font-size:96px;line-height:1}
.btns{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-top:48px}
.btns>div{border-radius:var(--card-radius);height:220px;display:grid;place-items:center;font:500 20px/1.3 ui-monospace,monospace}
.rb-btn{font-size:26px;min-height:calc(var(--button-height) * 1.4);padding:0 calc(var(--button-pad-x) * 1.4)}
.navm{display:flex;align-items:center;gap:30px;height:calc(var(--nav-height) * 1.5);padding:0 32px;background:var(--nav-bg);color:var(--nav-link-color);border-radius:var(--card-radius);font:var(--nav-link-weight) 26px/1 var(--font-body);margin-top:28px;white-space:nowrap;overflow:hidden}
.logo{flex:none;width:calc(var(--nav-logo-width) * 1.5);height:calc(var(--nav-logo-height) * 1.5);border:2px dashed var(--nav-logo-color);border-radius:4px}
.mos{display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:1fr 1fr;gap:18px;flex:1;margin-top:40px}
.mos .t{position:relative;border-radius:var(--card-radius);overflow:hidden}.mos .t .img{position:absolute;inset:0}
.mos .t:first-child{grid-column:span 2;grid-row:span 2}
.quote{font-family:var(--font-display);font-weight:var(--type-h2-weight);font-size:76px;line-height:1.1;max-width:24ch;margin-top:30px}
.rules{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:auto}
.rule{border-radius:var(--card-radius);background:var(--color-surface);color:var(--color-text);padding:30px;font:500 28px/1.3 var(--font-body)}.rule b{display:block;font-family:var(--font-display);font-size:56px;color:var(--color-action);margin-bottom:10px}
pre{margin:40px 0 0;padding:36px;border-radius:var(--card-radius);background:rgb(0 0 0 / .32);color:#e8e8e8;font:26px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap}
.grad{background:var(--gradient-brand);color:#fff}
.hud{position:absolute;z-index:20;right:48px;top:44px;font-size:20px;padding:12px 18px;background:rgb(0 0 0 / .45);color:#fff;border-color:rgb(255 255 255 / .7)}
.credit{position:absolute;z-index:20;left:48px;bottom:40px;font:600 20px/1 var(--font-body);padding:10px 16px;border-radius:999px;background:rgb(0 0 0 / .55);color:#fff;opacity:0}
.legal{position:absolute;z-index:20;right:48px;bottom:40px;font:400 17px/1.35 var(--font-body);color:#fff;text-align:right;padding:10px 16px;border-radius:14px;background:rgb(0 0 0 / .45)}
`;

function buildVideoHtml(ctx) {
  const { a, tokensCss, manifest } = ctx;
  const R = a.colour.roles, T = a.type.roles;
  const v = pickButtonVariants(a);
  const has = (s) => !!(manifest[s] && manifest[s].dataUri);
  const ink = (hex) => (C.contrast(hex, R.text.hex) >= C.contrast(hex, R['text-inverse'].hex) ? 'var(--color-text)' : 'var(--color-text-inverse)');
  const bg = (s) => `<div class="bg"><div class="img img-${s} kb"></div></div>`;
  const scenes = [
    { name: 'intro', ai: 'hero', html: `<section class="scene full shade" data-ai="${has('hero') ? 1 : 0}">${bg('hero')}<div class="inner" style="padding:120px;justify-content:flex-end"><div class="kicker st">Unofficial analysis · ${esc(a.host)}</div><div class="h st" style="font-size:150px;color:#fff">${esc(a.brand)}<br>brand guidelines</div><div class="p st" style="color:#fff">Measured, tokenised and rebuilt from the public site.</div></div></section>` },
    { name: 'overview', html: `<section class="scene light"><div class="kicker st">Overview</div><div class="h st">What was measured</div><div class="row">${[[a.type.typefaces.length || 1, 'Typefaces'], [a.colour.palette.length, 'Colours'], [a.layout.base + 'px', 'Spacing base'], [a.components.buttons.length, 'Button variants']].map(([b, s]) => `<div class="stat st"><b>${b}</b><span>${s}</span></div>`).join('')}</div><div class="p st" style="max-width:none;margin-top:auto">${a.pages.length} pages at 1440px, home page at 390px.</div></section>` },
    { name: 'typography', ai: 'horizon', html: `<section class="scene full shade" data-ai="${has('horizon') ? 1 : 0}">${bg('horizon')}<div class="inner" style="padding:96px 120px;color:#fff"><div class="kicker st">Typography</div><div class="roles" style="max-width:1300px">${['display', 'h1', 'h3', 'lead', 'body'].map((k) => `<div class="role st"><span style="font-family:var(--type-${k}-family);font-size:${Math.min(T[k].size * 1.25, 110)}px;font-weight:${T[k].weight};letter-spacing:${T[k].letterSpacing}em;line-height:1.05">${{ display: 'Display', h1: 'Heading', h3: 'Subhead', lead: 'Lead', body: 'Body' }[k]}</span><span>${T[k].size}px / ${T[k].lineHeight} / ${T[k].weight}</span></div>`).join('')}</div></div></section>` },
    { name: 'fonts', html: `<section class="scene light"><div class="kicker st">Fonts</div><div style="display:flex;gap:80px;align-items:center;flex:1"><div class="st" style="font-family:var(--font-display);font-size:420px;line-height:.85;font-weight:600">Aa</div><div><div class="h st" style="font-size:88px">${esc(T.display.primary)}</div><div class="p st">${(a.type.typefaces[0] || a.type.families[0] || { weights: [] }).weights.slice(0, 4).map((w) => w.weight).join(' · ')} weights. Scale ratio ${a.type.ratio} (${esc(a.type.interval.name)}).</div></div></div></section>` },
    { name: 'colour', html: `<section class="scene dark"><div class="kicker st">Colour</div><div class="h st">${a.colour.palette.length} colours, ${Object.keys(R).length} roles</div><div class="pal">${a.colour.palette.slice(0, 10).map((p) => `<span class="grow-x" style="flex:${Math.max(0.02, p.weight)};background:${p.hex}"></span>`).join('')}</div><div class="tiles">${Object.entries(R).slice(0, 6).map(([k, c]) => `<div class="tile st" style="background:var(--color-${k});color:${ink(c.hex)}">${k}<code>${c.hex}</code></div>`).join('')}</div></section>` },
    { name: 'layout', html: `<section class="scene light"><div class="kicker st">Layout and spacing</div><div class="facts">${[[a.layout.base + 'px', 'Base'], [a.layout.columns, 'Columns'], [a.layout.gutter + 'px', 'Gutter'], [a.layout.container + 'px', 'Container']].map(([b, s]) => `<div class="fact st"><b>${b}</b>${s}</div>`).join('')}</div><div class="cols" style="grid-template-columns:repeat(${a.layout.columns},1fr)">${'<i class="grow-y"></i>'.repeat(a.layout.columns)}</div></section>` },
    { name: 'components', html: `<section class="scene dark"><div class="kicker st">Components</div><div class="btns">${['primary', 'secondary', 'outline', 'translucent'].map((k) => `<div class="st" style="background:var(--button-${k}-ground)"><span class="rb-btn${k === 'primary' ? '' : ' rb-btn--' + k}"${k === 'outline' && C.isDark((v[k].ground || '#000000').slice(0, 7)) ? ' style="color:var(--color-text-inverse);border-color:var(--color-text-inverse)"' : ''}>${esc((v[k].source && v[k].source.labels[0]) || k)}</span></div>`).join('')}</div><div class="navm st"><span class="logo"></span>${(a.components.nav ? a.components.nav.links : []).slice(0, 5).map((l) => `<span>${esc(l)}</span>`).join('')}</div><input class="rb-input st" style="margin-top:28px;max-width:900px;height:calc(var(--input-height) * 1.4);font-size:26px" placeholder="${esc(a.components.input.placeholder || 'Input')}"></section>` },
    { name: 'imagery', ai: 'subject', html: `<section class="scene light" data-ai="${has('subject') || has('street') ? 1 : 0}"><div class="kicker st">Imagery</div><div class="h st" style="font-size:72px">${Math.round(a.imagery.mediaAreaShare * 100)}% of page area is media</div><div class="mos">${['subject', 'street', 'sky', 'object', 'glass'].map((s) => `<div class="t st"><div class="img img-${s} kb"></div></div>`).join('')}</div></section>` },
    { name: 'voice', html: `<section class="scene light"><div class="kicker st">Voice and tone</div><div class="quote st">“${esc((a.voice.quotes[0] || { text: '' }).text)}”</div><div class="rules">${a.voice.rules.map((r) => `<div class="rule st"><b>${String(r.n).padStart(2, '0')}</b>${esc(r.title)}</div>`).join('')}</div></section>` },
    { name: 'tokens', ai: 'tokens', html: `<section class="scene dark"><div class="kicker st">Design tokens</div><div class="h st" style="font-size:88px">CSS and W3C JSON</div><pre class="st">${esc(tokensCss.split('\n').filter((l) => /--(color-(action|text|background)|type-display-size|space-base|radius-(card|button)|motion-ease):/.test(l)).map((l) => l.replace(/\s*\/\*.*\*\/$/, '').trim()).slice(0, 8).join('\n'))}</pre></section>` },
    { name: 'outro', html: `<section class="scene grad"><div class="inner" style="justify-content:center"><div class="kicker st" style="color:#fff">Unofficial analysis</div><div class="h st" style="font-size:130px">${esc(a.brand)} brand guidelines</div><div class="p st" style="max-width:none">Not affiliated with or endorsed by ${esc(a.brand)}. Trademarks belong to their owners.</div></div></section>` },
  ];
  const total = scenes.length * SCENE + XFADE;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${baseCss(tokensCss, manifest)}${css}</style></head><body>
${scenes.map((s) => s.html).join('\n')}
<span class="unofficial hud">Unofficial analysis</span>
<span class="credit" id="credit">AI-generated image</span>
<div class="legal">Not affiliated with or endorsed by ${esc(a.brand)}.<br>Trademarks belong to their owners.</div>
<script>
window.__timeline = (function(){
  var D=${SCENE}*1000, X=${XFADE}*1000, TOTAL=${total}*1000, E=getComputedStyle(document.documentElement).getPropertyValue('--motion-ease').trim()||'cubic-bezier(.2,.8,.2,1)';
  var OUT='cubic-bezier(.16,1,.3,1)';
  var scenes=[].slice.call(document.querySelectorAll('.scene'));
  var aiScenes=[];
  scenes.forEach(function(sc,i){
    var start=i*D, inEnd=start+X, outStart=start+D, outEnd=outStart+X, last=i===scenes.length-1;
    var f=function(t){return Math.max(0,Math.min(1,t/TOTAL))};
    var kf=[{offset:0,opacity:0,transform:'scale(1.04)',filter:'blur(10px)'}];
    if(start>0)kf.push({offset:f(start),opacity:0,transform:'scale(1.04)',filter:'blur(10px)'});
    kf.push({offset:f(inEnd),opacity:1,transform:'scale(1)',filter:'blur(0px)'});
    if(!last){kf.push({offset:f(outStart),opacity:1,transform:'scale(1)',filter:'blur(0px)'});kf.push({offset:f(outEnd),opacity:0,transform:'scale(0.98)',filter:'blur(8px)'});kf.push({offset:1,opacity:0,transform:'scale(0.98)',filter:'blur(8px)'})}
    else kf.push({offset:1,opacity:1,transform:'scale(1)',filter:'blur(0px)'});
    if(i===0){kf[0]={offset:0,opacity:1,transform:'scale(1)',filter:'blur(0px)'};kf.splice(1,1);}
    sc.animate(kf,{duration:TOTAL,fill:'both',easing:'linear'});
    sc.querySelectorAll('.kb').forEach(function(el){el.animate([{transform:'scale(1)'},{transform:'scale(1.12)'}],{duration:D+X*2,delay:Math.max(0,start-X),fill:'both',easing:'linear'})});
    sc.querySelectorAll('.st').forEach(function(el,k){el.animate([{opacity:0,transform:'translateY(36px)'},{opacity:1,transform:'none'}],{duration:800,delay:start+(i?X*0.6:250)+k*90,fill:'both',easing:OUT})});
    sc.querySelectorAll('.grow-x').forEach(function(el,k){el.animate([{transform:'scaleX(0)'},{transform:'scaleX(1)'}],{duration:900,delay:start+X*0.6+k*60,fill:'both',easing:OUT})});
    sc.querySelectorAll('.grow-y').forEach(function(el,k){el.animate([{transform:'scaleY(0)'},{transform:'scaleY(1)'}],{duration:900,delay:start+X*0.6+k*45,fill:'both',easing:OUT})});
    if(sc.dataset.ai==='1')aiScenes.push([start,outEnd]);
  });
  var cr=document.getElementById('credit');
  var ck=[{offset:0,opacity:0}];
  aiScenes.forEach(function(r){ck.push({offset:Math.max(0,r[0])/TOTAL,opacity:0});ck.push({offset:Math.min(TOTAL,r[0]+X)/TOTAL,opacity:1});ck.push({offset:Math.max(0,r[1]-X)/TOTAL,opacity:1});ck.push({offset:Math.min(TOTAL,r[1])/TOTAL,opacity:0})});
  ck.push({offset:1,opacity:0});
  ck.sort(function(a,b){return a.offset-b.offset});
  cr.animate(ck,{duration:TOTAL,fill:'both'});
  document.getAnimations().forEach(function(a){a.pause()});
  return {total:TOTAL,scene:D,count:scenes.length,seek:function(ms){document.getAnimations().forEach(function(a){a.pause();a.currentTime=ms})}};
})();
</script></body></html>`;
  return { html, total, scenes: scenes.map((s) => s.name) };
}

async function renderVideo(browser, ctx, outDir, log, opts = {}) {
  const fps = opts.fps || 60;
  const dir = path.join(outDir, 'video');
  fs.mkdirSync(dir, { recursive: true });
  const { html, total, scenes } = buildVideoHtml(ctx);
  fs.writeFileSync(path.join(dir, 'presentation.html'), html);
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const seek = (ms) => page.evaluate((t) => window.__timeline.seek(t), ms);

  // Stills: one frame per scene, mid-scene.
  if (opts.stills !== false) {
    const sdir = path.join(dir, 'stills');
    fs.mkdirSync(sdir, { recursive: true });
    for (let i = 0; i < scenes.length; i++) {
      await seek(i * SCENE * 1000 + SCENE * 650);
      await page.screenshot({ path: path.join(sdir, `${String(i + 1).padStart(2, '0')}-${scenes[i]}.png`) });
    }
    log('video', `${scenes.length} stills written`);
  }
  if (opts.video === false) { await page.close(); return null; }

  const frames = Math.round(total * fps);
  const file = path.join(dir, `${ctx.a.host}-presentation-1920x1080-${fps}fps.mp4`);
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', String(fps),
    '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exited ' + c)))));
  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    await seek((i * 1000) / fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 600 === 0) log('video', `frame ${i}/${frames}`);
  }
  ff.stdin.end();
  await done;
  await page.close();
  log('video', `${frames} frames at ${fps} fps (${total.toFixed(1)} s) rendered in ${((Date.now() - t0) / 1000).toFixed(0)} s -> ${path.basename(file)}`);
  return file;
}

module.exports = { buildVideoHtml, renderVideo };
