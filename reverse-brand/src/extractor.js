'use strict';
// In-page extractor. This function is serialised with .toString() and runs inside the page
// (Playwright page.evaluate) or inside a same-origin iframe (DevTools snippet). It must stay
// self-contained: no closures over Node variables.

async function rbExtract(win, opts) {
  opts = opts || {};
  const doc = win.document;
  const vw = win.innerWidth;
  const vh = win.innerHeight;
  const sleep = (ms) => new Promise((r) => win.setTimeout(r, ms));

  // 1. Scroll to trigger lazy content, then return to the top.
  if (opts.scroll !== false) {
    let y = 0;
    for (let i = 0; i < 60; i++) {
      const max = doc.documentElement.scrollHeight - vh;
      if (y >= max) break;
      y = Math.min(max, y + Math.round(vh * 0.8));
      win.scrollTo(0, y);
      await sleep(opts.scrollDelay || 250);
    }
    win.scrollTo(0, 0);
    await sleep(400);
  }

  // 2. Colour normalisation through a 1px canvas so oklch()/lab()/color() all resolve to sRGB hex.
  const canvas = doc.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const colorCache = new Map();
  function toHex(css) {
    if (!css || css === 'transparent' || css === 'none') return null;
    if (colorCache.has(css)) return colorCache.get(css);
    let out = null;
    try {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      if (d[3] > 0) {
        // Un-premultiply is handled by getImageData; keep alpha as a suffix when < 1.
        const h = (v) => v.toString(16).padStart(2, '0');
        out = '#' + h(d[0]) + h(d[1]) + h(d[2]) + (d[3] < 255 ? h(d[3]) : '');
      }
    } catch (e) { out = null; }
    colorCache.set(css, out);
    return out;
  }
  const opaque = (hex) => hex && hex.length === 7;

  // 3. Consent / cookie UI exclusion.
  const CONSENT_RE = /cookie|consent|gdpr|onetrust|didomi|iubenda|cookiebot|cmp-|cmpbox|qc-cmp|truste|usercentrics|privacy-?banner|sp_message/i;
  const CONSENT_TEXT_RE = /\b(cookie|consenso|consent|accetta|accept all|rifiuta|reject all|gestisci preferenze|manage preferences|privacy)\b/i;
  const excluded = new Set();
  doc.querySelectorAll('[id],[class]').forEach((el) => {
    const sig = (el.id || '') + ' ' + (typeof el.className === 'string' ? el.className : (el.getAttribute('class') || ''));
    if (CONSENT_RE.test(sig)) excluded.add(el);
  });
  doc.querySelectorAll('[role=dialog],[role=alertdialog],[aria-modal=true],dialog').forEach((el) => {
    const t = (el.innerText || '').slice(0, 2000);
    if (CONSENT_TEXT_RE.test(t)) excluded.add(el);
  });
  function isExcluded(el) {
    for (let n = el; n && n !== doc.body; n = n.parentElement) if (excluded.has(n)) return true;
    return false;
  }

  // Aggregation helpers.
  const bump = (map, key, n) => { if (key == null) return; map[key] = (map[key] || 0) + (n == null ? 1 : n); };
  const round = (v, p) => { const f = Math.pow(10, p || 0); return Math.round(v * f) / f; };
  const px = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  const ownText = (el) => {
    let t = '';
    for (const n of el.childNodes) if (n.nodeType === 3) t += n.textContent;
    return t.replace(/\s+/g, ' ').trim();
  };
  const scrollY = win.scrollY || 0;
  const docRect = (r) => ({ x: round(r.left), y: round(r.top + scrollY), w: round(r.width), h: round(r.height) });

  const fonts = {};          // family stack -> {chars, count, weights:{w:chars}}
  const textStyles = {};     // signature -> {...}
  const textColors = {};     // hex -> chars
  const pairs = {};          // fg|bg -> chars
  const bgColors = {};       // hex -> area
  const borderColors = {};   // hex -> count
  const fillColors = {};     // hex -> count (svg fill)
  const spacing = { padding: {}, margin: {}, gap: {} };
  const radii = {};          // "px" or "pill" -> count
  const shadows = {};
  const maxWidths = {};
  const gridCols = {};
  const gridGaps = {};
  const gradients = {};
  const transitions = { easing: {}, duration: {} };
  const charset = {};
  let pageArea = 0;

  const all = Array.from(doc.body.querySelectorAll('*'));
  const visible = [];
  const bgCache = new Map();

  // Effective background: walk up to the first opaque painted ancestor.
  function effectiveBg(el) {
    const chain = [];
    let n = el;
    let base = null;
    while (n && n.nodeType === 1) {
      if (bgCache.has(n)) { base = bgCache.get(n); break; }
      const cs = win.getComputedStyle(n);
      let hex = toHex(cs.backgroundColor);
      if (!opaque(hex) && cs.backgroundImage.includes('gradient')) {
        const stop = gradientStops(cs.backgroundImage)[0];
        if (opaque(stop)) hex = stop;
      }
      chain.push([n, hex]);
      if (opaque(hex)) { base = hex; break; }
      n = n.parentElement;
    }
    if (!base) {
      base = toHex(win.getComputedStyle(doc.documentElement).backgroundColor) || '#ffffff';
      if (!opaque(base)) base = '#ffffff';
    }
    for (let i = chain.length - 1; i >= 0; i--) {
      const [node, hex] = chain[i];
      if (hex && hex.length === 9) base = blend(hex, base);
      bgCache.set(node, base);
    }
    return base;
  }
  function gradientStops(img) {
    return (img.match(/(rgba?\([^)]*\)|#[0-9a-f]{3,8}\b|oklch\([^)]*\)|lab\([^)]*\)|color\([^)]*\))/gi) || []).map(toHex).filter(Boolean);
  }
  function blend(fg, bg) {
    const p = (h, i) => parseInt(h.slice(i, i + 2), 16);
    const a = p(fg, 7) / 255;
    const h2 = (v) => Math.round(v).toString(16).padStart(2, '0');
    return '#' + [1, 3, 5].map((i) => h2(p(fg, i) * a + p(bg, i) * (1 - a))).join('');
  }

  for (const el of all) {
    if (isExcluded(el)) continue;
    const tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'template' || tag === 'link' || tag === 'meta') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cs = win.getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) continue;
    visible.push(el);
    const area = Math.min(r.width, vw) * r.height;

    // Text.
    const text = ownText(el);
    if (text.length) {
      const fam = cs.fontFamily;
      const w = cs.fontWeight;
      const size = round(px(cs.fontSize), 2);
      const lh = cs.lineHeight === 'normal' ? round(size * 1.2, 2) : round(px(cs.lineHeight), 2);
      const ls = cs.letterSpacing === 'normal' ? 0 : round(px(cs.letterSpacing), 3);
      const n = text.length;
      fonts[fam] = fonts[fam] || { chars: 0, count: 0, weights: {}, styles: {} };
      fonts[fam].chars += n; fonts[fam].count++;
      bump(fonts[fam].weights, w, n);
      bump(fonts[fam].styles, cs.fontStyle, n);
      const sig = [fam, size, w, lh, ls, cs.textTransform].join('|');
      const ts = textStyles[sig] = textStyles[sig] || { family: fam, size, weight: +w || 400, lineHeight: lh, letterSpacing: ls, transform: cs.textTransform, chars: 0, count: 0, tags: {}, samples: [] };
      ts.chars += n; ts.count++;
      bump(ts.tags, tag);
      if (ts.samples.length < 4 && n > 3) ts.samples.push(text.slice(0, 120));
      const fg = toHex(cs.color);
      const bg = effectiveBg(el);
      if (fg) {
        const fgO = fg.length === 9 ? blend(fg, bg) : fg;
        bump(textColors, fgO, n);
        bump(pairs, fgO + '|' + bg, n);
      }
      for (const ch of text) bump(charset, ch, 1);
    }

    // Colours.
    const bgHex = toHex(cs.backgroundColor);
    if (bgHex) bump(bgColors, bgHex, round(area));
    if (cs.backgroundImage && cs.backgroundImage.includes('gradient')) bump(gradients, cs.backgroundImage.slice(0, 400), round(area));
    ['Top', 'Right', 'Bottom', 'Left'].forEach((s) => {
      if (px(cs['border' + s + 'Width']) > 0 && cs['border' + s + 'Style'] !== 'none') bump(borderColors, toHex(cs['border' + s + 'Color']), 1);
    });
    if (el instanceof win.SVGElement) {
      const f = toHex(cs.fill);
      if (f && cs.fill !== 'none') bump(fillColors, f, 1);
    }

    // Spacing.
    ['Top', 'Right', 'Bottom', 'Left'].forEach((s) => {
      const p = round(px(cs['padding' + s])); if (p > 0) bump(spacing.padding, p);
      const m = round(px(cs['margin' + s])); if (m > 0 && m < 400) bump(spacing.margin, m);
    });
    if (cs.display.includes('flex') || cs.display.includes('grid')) {
      const rg = px(cs.rowGap), cg = px(cs.columnGap);
      if (rg > 0) bump(spacing.gap, round(rg));
      if (cg > 0) bump(spacing.gap, round(cg));
    }
    // Radius.
    const rad = px(cs.borderTopLeftRadius);
    if (rad > 0) {
      const minSide = Math.min(r.width, r.height);
      bump(radii, rad >= minSide / 2 - 1 || rad >= 999 ? 'pill' : String(round(rad)));
    }
    if (cs.boxShadow && cs.boxShadow !== 'none') bump(shadows, cs.boxShadow.slice(0, 200));
    if (cs.maxWidth && cs.maxWidth !== 'none' && cs.maxWidth.endsWith('px')) {
      const mw = round(px(cs.maxWidth));
      if (mw >= 600 && mw <= 2000) bump(maxWidths, mw);
    }
    if (cs.display.includes('grid') && cs.gridTemplateColumns && cs.gridTemplateColumns !== 'none') {
      const cols = cs.gridTemplateColumns.split(' ').filter(Boolean).length;
      bump(gridCols, cols);
      if (px(cs.columnGap) > 0) bump(gridGaps, round(px(cs.columnGap)));
    }
    if (cs.transitionTimingFunction && cs.transitionDuration !== '0s') {
      cs.transitionTimingFunction.split(/,(?![^(]*\))/).forEach((e) => bump(transitions.easing, e.trim()));
      cs.transitionDuration.split(',').forEach((d) => { if (d.trim() !== '0s') bump(transitions.duration, d.trim()); });
    }
  }
  pageArea = Math.min(doc.documentElement.scrollWidth, vw) * doc.documentElement.scrollHeight;

  // Page background as painted area (body/html).
  const rootBg = toHex(win.getComputedStyle(doc.body).backgroundColor) || toHex(win.getComputedStyle(doc.documentElement).backgroundColor) || '#ffffff';

  // 4. Components.
  function boxStyle(el) {
    const cs = win.getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      bg: toHex(cs.backgroundColor), color: toHex(cs.color),
      borderColor: px(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none' ? toHex(cs.borderTopColor) : null,
      borderWidth: round(px(cs.borderTopWidth), 2),
      radius: round(px(cs.borderTopLeftRadius), 2),
      pill: px(cs.borderTopLeftRadius) >= Math.min(r.width, r.height) / 2 - 1,
      padding: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map((v) => round(px(v))),
      font: { family: cs.fontFamily, size: round(px(cs.fontSize), 2), weight: +cs.fontWeight || 400, letterSpacing: cs.letterSpacing === 'normal' ? 0 : round(px(cs.letterSpacing), 3), transform: cs.textTransform },
      height: round(r.height), width: round(r.width),
      shadow: cs.boxShadow !== 'none' ? cs.boxShadow.slice(0, 200) : null,
      backdrop: (cs.backdropFilter && cs.backdropFilter !== 'none') ? cs.backdropFilter : ((cs.webkitBackdropFilter && cs.webkitBackdropFilter !== 'none') ? cs.webkitBackdropFilter : null),
      gradient: cs.backgroundImage && cs.backgroundImage.includes('gradient') ? cs.backgroundImage.slice(0, 300) : null,
      transition: cs.transitionDuration !== '0s' ? cs.transitionTimingFunction : null,
    };
  }
  const painted = (s) => (s.bg && s.bg !== '#00000000') || s.borderColor || s.gradient || s.backdrop;
  const visibleSet = new Set(visible);

  const buttons = [];
  const seenBtn = new Set();
  const btnSel = 'button, [role=button], input[type=submit], input[type=button], a';
  doc.querySelectorAll(btnSel).forEach((el) => {
    if (!visibleSet.has(el) || buttons.length >= 120) return;
    const r = el.getBoundingClientRect();
    if (r.height < 24 || r.height > 80 || r.width > 480 || r.width < 32) return;
    const label = (el.innerText || el.value || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
    if (!label || label.length > 40) return;
    let s = boxStyle(el);
    let layer = 'self';
    if (!painted(s)) {
      // The painted layer may be a child (e.g. <a><span class="btn">).
      const child = Array.from(el.querySelectorAll('*')).find((c) => {
        const cr = c.getBoundingClientRect();
        return cr.width >= r.width * 0.7 && cr.height >= r.height * 0.7 && painted(boxStyle(c));
      });
      if (!child) return;
      s = boxStyle(child); layer = 'child';
    }
    const cls = typeof el.className === 'string' ? el.className : '';
    if (el.tagName === 'A' && !/btn|button|cta/i.test(cls) && s.padding[1] < 8) return;
    const key = [s.bg, s.color, s.borderColor, s.radius, s.height, label].join('|');
    if (seenBtn.has(key)) return;
    seenBtn.add(key);
    buttons.push(Object.assign(s, { label, tag: el.tagName.toLowerCase(), layer, ground: effectiveBg(el.parentElement || el), inHeader: !!el.closest('header,nav,[role=banner]') }));
  });

  const cards = [];
  const cardSeen = new Set();
  visible.forEach((el) => {
    if (cards.length >= 80) return;
    const r = el.getBoundingClientRect();
    if (r.width < 150 || r.width > 760 || r.height < 120 || r.height > 900) return;
    const parent = el.parentElement;
    if (!parent) return;
    const cls = typeof el.className === 'string' ? el.className : '';
    const sibs = Array.from(parent.children).filter((c) => c !== el && c.tagName === el.tagName && (typeof c.className === 'string' ? c.className : '') === cls);
    if (sibs.length < 1) return;
    const s = boxStyle(el);
    const ground = effectiveBg(parent);
    const distinct = (s.bg && s.bg !== ground && s.bg.length >= 7) || s.shadow || s.borderColor || s.radius > 0 || s.backdrop;
    if (!distinct) return;
    const media = el.querySelector('img,picture,video,[style*="background-image"]');
    const heading = el.querySelector('h1,h2,h3,h4,h5,h6,strong,[class*=title]') || Array.from(el.querySelectorAll('div,span,p,a')).find((d) => { const ds = win.getComputedStyle(d); return px(ds.fontSize) >= 18 && (+ds.fontWeight || 400) >= 600 && ownText(d).length > 2; });
    if (!media && !heading) return;
    const key = cls + '|' + s.bg + '|' + s.radius;
    if (cardSeen.has(key)) return;
    cardSeen.add(key);
    let mediaInfo = null;
    if (media) {
      const mr = media.getBoundingClientRect();
      mediaInfo = { w: round(mr.width), h: round(mr.height), ratio: mr.height ? round(mr.width / mr.height, 2) : null, objectFit: win.getComputedStyle(media).objectFit };
    }
    cards.push(Object.assign(s, { ground, title: heading ? (heading.innerText || '').trim().slice(0, 80) : '', media: mediaInfo, siblings: sibs.length + 1 }));
  });

  // Header / nav / logo.
  let header = null;
  const hdr = doc.querySelector('header, [role=banner]') || doc.querySelector('nav');
  if (hdr && !isExcluded(hdr)) {
    const cs = win.getComputedStyle(hdr);
    const r = hdr.getBoundingClientRect();
    let sticky = cs.position === 'sticky' || cs.position === 'fixed';
    for (let n = hdr.parentElement; !sticky && n && n !== doc.body; n = n.parentElement) {
      const p = win.getComputedStyle(n).position; if (p === 'sticky' || p === 'fixed') sticky = true;
    }
    const links = Array.from(hdr.querySelectorAll('a')).filter((a) => visibleSet.has(a) && (a.innerText || '').trim());
    const linkStyles = {};
    links.forEach((a) => {
      const ls = win.getComputedStyle(a);
      bump(linkStyles, [ls.fontFamily, round(px(ls.fontSize), 1), ls.fontWeight, toHex(ls.color), ls.textDecorationLine, ls.textTransform].join('|'));
    });
    let logo = null;
    const logoSel = ['[class*=logo] svg', '[class*=logo] img', 'a[aria-label*=home i] svg', 'svg[aria-label]', 'img[alt*=logo i]', '[class*=logo]', 'a svg', 'a img'];
    let logoEl = null;
    for (const sel of logoSel) { logoEl = Array.from(hdr.querySelectorAll(sel)).find((e) => visibleSet.has(e)); if (logoEl) break; }
    if (logoEl) {
      const lr = logoEl.getBoundingClientRect();
      const lcs = win.getComputedStyle(logoEl);
      let color = null;
      if (logoEl.tagName.toLowerCase() === 'svg') {
        const p = logoEl.querySelector('path,rect,circle,polygon,use');
        color = p ? toHex(win.getComputedStyle(p).fill) : toHex(lcs.fill) || toHex(lcs.color);
      } else color = toHex(lcs.color);
      logo = { w: round(lr.width), h: round(lr.height), color, kind: logoEl.tagName.toLowerCase(), label: logoEl.getAttribute('aria-label') || logoEl.getAttribute('alt') || '' };
    }
    header = {
      height: round(r.height), sticky, bg: toHex(cs.backgroundColor), ground: effectiveBg(hdr),
      backdrop: cs.backdropFilter && cs.backdropFilter !== 'none' ? cs.backdropFilter : null,
      shadow: cs.boxShadow !== 'none' ? cs.boxShadow.slice(0, 120) : null,
      borderBottom: px(cs.borderBottomWidth) > 0 ? toHex(cs.borderBottomColor) : null,
      links: links.slice(0, 12).map((a) => (a.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40)),
      linkStyle: Object.entries(linkStyles).sort((a, b) => b[1] - a[1])[0] ? Object.entries(linkStyles).sort((a, b) => b[1] - a[1])[0][0] : null,
      logo,
    };
  }

  // Forms.
  const inputs = [];
  doc.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]), select, textarea').forEach((el) => {
    if (!visibleSet.has(el) || inputs.length >= 20) return;
    const s = boxStyle(el);
    // The painted field may be the wrapper.
    if (!painted(s) && el.parentElement) {
      const ps = boxStyle(el.parentElement);
      if (painted(ps) && ps.height < 90) { Object.assign(s, { bg: ps.bg, borderColor: ps.borderColor, borderWidth: ps.borderWidth, radius: ps.radius, pill: ps.pill, height: ps.height, shadow: ps.shadow }); s.layer = 'parent'; }
    }
    inputs.push(Object.assign(s, { type: el.type || el.tagName.toLowerCase(), placeholder: (el.getAttribute('placeholder') || '').slice(0, 60), ground: effectiveBg(el.parentElement || el) }));
  });

  // Headings, paragraphs and CTAs (copy for voice).
  const lineOf = (el) => (el.innerText || '').replace(/\s+/g, ' ').trim();
  const headings = [];
  doc.querySelectorAll('h1,h2,h3').forEach((el) => {
    if (!visibleSet.has(el) || isExcluded(el) || headings.length >= 60) return;
    const t = lineOf(el); if (!t || t.length > 200) return;
    const cs = win.getComputedStyle(el);
    headings.push({ tag: el.tagName.toLowerCase(), text: t, size: round(px(cs.fontSize), 2), weight: +cs.fontWeight || 400 });
  });
  const paragraphs = [];
  doc.querySelectorAll('p').forEach((el) => {
    if (!visibleSet.has(el) || isExcluded(el) || paragraphs.length >= 60) return;
    const t = lineOf(el); if (t.length < 12 || t.length > 400) return;
    const cs = win.getComputedStyle(el);
    paragraphs.push({ text: t, size: round(px(cs.fontSize), 2) });
  });
  const ctas = buttons.map((b) => b.label);

  // Every visible text block with its size, so mobile and desktop can be matched by text.
  const textIndex = [];
  visible.forEach((el) => {
    if (textIndex.length >= 1500) return;
    const t = ownText(el);
    if (t.length < 3 || t.length > 160) return;
    const cs = win.getComputedStyle(el);
    textIndex.push({ t: t.slice(0, 80), s: round(px(cs.fontSize), 2), w: +cs.fontWeight || 400, tag: el.tagName.toLowerCase() });
  });

  // :root custom properties and media-query breakpoints.
  const rootVars = {};
  const breakpoints = {};
  const keyframes = [];
  const rootCs = win.getComputedStyle(doc.documentElement);
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules;
    try { rules = sheet.cssRules; } catch (e) { continue; }
    if (!rules) continue;
    const walk = (list) => {
      for (const rule of Array.from(list)) {
        if (rule.media && rule.conditionText !== undefined || rule.type === 4) {
          const m = (rule.conditionText || (rule.media && rule.media.mediaText) || '');
          (m.match(/(min|max)-width:\s*([\d.]+)(px|em|rem)/g) || []).forEach((mm) => {
            const p = mm.match(/(min|max)-width:\s*([\d.]+)(px|em|rem)/);
            const v = p[3] === 'px' ? +p[2] : +p[2] * 16;
            bump(breakpoints, p[1] + ':' + round(v));
          });
        }
        if (rule.type === 7 && keyframes.length < 30) keyframes.push(rule.name);
        if (rule.selectorText && /(^|,)\s*(:root|html)\s*(,|$)/.test(rule.selectorText) && rule.style) {
          for (const prop of Array.from(rule.style)) if (prop.startsWith('--') && Object.keys(rootVars).length < 600) rootVars[prop] = rootCs.getPropertyValue(prop).trim().slice(0, 200);
        }
        if (rule.cssRules) walk(rule.cssRules);
      }
    };
    walk(rules);
  }

  // Media stats.
  const media = [];
  let mediaArea = 0;
  doc.querySelectorAll('img, picture > img, video, svg, [style*="background-image"]').forEach((el) => {
    if (!visibleSet.has(el) || isExcluded(el)) return;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 40) return;
    const tag = el.tagName.toLowerCase();
    if (tag === 'svg' && r.width < 120) return;
    const cs = win.getComputedStyle(el);
    let src = el.currentSrc || el.src || '';
    if (!src && cs.backgroundImage.startsWith('url(')) src = cs.backgroundImage.slice(4, -1).replace(/["']/g, '');
    const fmt = (src.match(/\.(webp|avif|jpe?g|png|gif|svg)(\?|$)/i) || [])[1] || (src.startsWith('data:image/') ? src.slice(11, src.indexOf(';')) : (tag === 'svg' ? 'svg' : tag === 'video' ? 'video' : 'unknown'));
    mediaArea += Math.min(r.width, vw) * r.height;
    if (media.length < 250) media.push({
      tag, fmt: fmt.toLowerCase().replace('jpeg', 'jpg'), w: round(r.width), h: round(r.height),
      nw: el.naturalWidth || null, nh: el.naturalHeight || null, objectFit: cs.objectFit,
      fullBleed: r.width >= vw * 0.95, alt: (el.getAttribute('alt') || '').slice(0, 120),
      inCard: !!el.closest('article,li,[class*=card]'),
    });
  });

  // Home-page section rhythm: wide bands with their painted ground.
  const sections = [];
  const bandEls = visible.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width >= vw * 0.9 && r.height >= 160 && !el.closest('header,footer,[role=banner]') && el.tagName !== 'MAIN';
  });
  const seenTop = [];
  bandEls.forEach((el) => {
    const r = el.getBoundingClientRect();
    const top = round(r.top + scrollY);
    if (seenTop.some((t) => Math.abs(t.top - top) < 40 && Math.abs(t.h - r.height) < 60)) return;
    // Keep only outermost bands: skip if contained in an already-recorded band of similar size.
    seenTop.push({ top, h: r.height });
    const bg = effectiveBg(el);
    const cs = win.getComputedStyle(el);
    sections.push({ top, h: round(r.height), bg, gradient: cs.backgroundImage.includes('gradient'), image: cs.backgroundImage.includes('url(') || !!el.querySelector(':scope > img, :scope > picture'), tag: el.tagName.toLowerCase() });
  });
  sections.sort((a, b) => a.top - b.top);
  const footer = doc.querySelector('footer, [role=contentinfo]');
  if (footer) {
    const fr = footer.getBoundingClientRect();
    sections.push({ top: round(fr.top + scrollY), h: round(fr.height), bg: effectiveBg(footer), gradient: false, image: false, tag: 'footer' });
  }

  // Same-origin links with nav flag, for page selection.
  const links = [];
  const seenHref = new Set();
  doc.querySelectorAll('a[href]').forEach((a) => {
    let u;
    try { u = new URL(a.getAttribute('href'), win.location.href); } catch (e) { return; }
    if (u.origin !== win.location.origin) return;
    u.hash = '';
    const href = u.toString();
    if (seenHref.has(href)) return;
    seenHref.add(href);
    links.push({ href, text: (a.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60), nav: !!a.closest('header,nav,[role=navigation],[role=banner]'), footer: !!a.closest('footer') });
  });

  return {
    url: win.location.href,
    title: doc.title,
    lang: doc.documentElement.lang || '',
    viewport: { w: vw, h: vh },
    scrollHeight: doc.documentElement.scrollHeight,
    scrollWidth: doc.documentElement.scrollWidth,
    elementsVisited: all.length,
    elementsVisible: visible.length,
    excludedConsent: excluded.size,
    rootBg, pageArea: round(pageArea),
    fonts, textStyles: Object.values(textStyles), textColors, pairs, bgColors, borderColors, fillColors,
    spacing, radii, shadows, maxWidths, gridCols, gridGaps, gradients, transitions,
    charset: Object.keys(charset).sort().join(''),
    buttons, cards, header, inputs, headings, paragraphs, ctas, textIndex,
    rootVars, breakpoints, keyframes, media, mediaArea: round(mediaArea), sections, links,
    metaDescription: (doc.querySelector('meta[name=description]') || {}).content || '',
    ogSiteName: (doc.querySelector('meta[property="og:site_name"]') || {}).content || '',
  };
}

// Heuristic bot-check / challenge detection, also serialisable.
function rbDetectChallenge(win) {
  const doc = win.document;
  const t = ((doc.title || '') + ' ' + ((doc.body && doc.body.innerText) || '').slice(0, 3000)).toLowerCase();
  const re = /(captcha|verify you are human|verifica di essere|are you a robot|non sono un robot|access denied|accesso negato|just a moment|attention required|checking your browser|please enable js and disable any ad blocker|blocked|unusual traffic)/;
  const shortBody = ((doc.body && doc.body.innerText) || '').trim().length < 400;
  // A challenge iframe counts only when it is visible and large, or the page is near-empty:
  // invisible reCAPTCHA v3 / Turnstile widgets sit on normal pages too.
  const provider = Array.from(doc.querySelectorAll('iframe')).find((f) => {
    if (!/captcha-delivery|datadome|perimeterx|px-captcha|hcaptcha|recaptcha|challenges\.cloudflare|turnstile/.test(f.src || '')) return false;
    const r = f.getBoundingClientRect();
    return shortBody || (r.width >= 280 && r.height >= 200 && win.getComputedStyle(f).visibility !== 'hidden');
  });
  if (provider) return { challenge: true, reason: 'challenge iframe: ' + provider.src.slice(0, 80) };
  if (re.test(t) && shortBody) return { challenge: true, reason: 'challenge text in a near-empty page' };
  return { challenge: false };
}

module.exports = { rbExtract, rbDetectChallenge };
