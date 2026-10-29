'use strict';
// Score same-origin links from the home page and pick 3-5 key pages, one per top-level path.

const HIGH = /(product|prodott|pricing|prezz|price|tariff|piani|plans|business|aziend|impres|company|about|chi-siamo|chisiamo|azienda|servizi|services|solution|soluzion|features|funzional|enterprise|pro\b|agenzi|mutu|vend|valut|compra|affitt|nuove-costruzioni|news|blog)/i;
const SKIP = /(privacy|cookie|termini|terms|legal|legale|note-legali|condizioni|gdpr|imprint|impressum|help|aiuto|faq|support|supporto|assistenza|contatt|contact|login|log-in|signin|sign-in|accedi|registr|signup|sign-up|account|password|logout|cart|carrello|checkout|careers|lavora-con-noi|lavora|jobs|sitemap|mappa-sito|rss|feed|\.pdf$|\.xml$|mailto:|tel:)/i;
const LOCALE = /^\/(?:[a-z]{2}(?:[-_][a-z]{2})?)(?:\/|$)/i;

function pickPages(homeUrl, links, opts = {}) {
  const min = opts.min || 3;
  const max = opts.max || 5;
  const home = new URL(homeUrl);
  const homeLocale = (home.pathname.match(LOCALE) || [''])[0];
  const scored = [];
  for (const l of links) {
    let u;
    try { u = new URL(l.href); } catch { continue; }
    if (u.origin !== home.origin) continue;
    const path = u.pathname.replace(/\/+$/, '') || '/';
    if (path === '/' || path === home.pathname.replace(/\/+$/, '')) continue;
    if (SKIP.test(path) || SKIP.test(l.text || '')) continue;
    const loc = (path.match(LOCALE) || [''])[0];
    if (loc && loc !== homeLocale) continue; // locale duplicate
    if (u.search && /lang|locale|hl=/.test(u.search)) continue;
    const depth = path.split('/').filter(Boolean).length;
    let score = 0;
    const why = [];
    if (l.nav) { score += 5; why.push('nav'); }
    if (HIGH.test(path) || HIGH.test(l.text || '')) { score += 3; why.push('keyword'); }
    if (l.footer && !l.nav) { score -= 1; why.push('footer-only'); }
    score += Math.max(0, 3 - depth); // shallow pages first
    if (u.search) score -= 2;
    scored.push({ href: u.origin + u.pathname + (u.search || ''), text: l.text, score, why, top: '/' + (path.split('/').filter(Boolean)[0] || '') });
  }
  scored.sort((a, b) => b.score - a.score || a.href.length - b.href.length);
  const byTop = new Map();
  for (const s of scored) if (!byTop.has(s.top)) byTop.set(s.top, s);
  const picked = Array.from(byTop.values()).slice(0, max);
  return { picked, enough: picked.length >= min, candidates: scored.slice(0, 25) };
}

module.exports = { pickPages };
