// In-browser layout audit. auditPage(page, { contrast }) → Issue[]
// Issue = { type: 'hscroll'|'overlap'|'spill'|'clip'|'obscured'|'contrast', where, detail }
//
// overlap  – two visible text runs / icons / images / form controls intersect
// spill    – text sticks out of its chip, badge, button, tab or card
// clip     – an overflow:hidden|clip box cuts off content (ellipsis/line-clamp excepted)
// obscured – after scrolling to the bottom, content ends under a bottom-anchored fixed/sticky bar
// contrast – axe-core color-contrast violations
const path = require('node:path');

const AXE = path.join(__dirname, 'node_modules', 'axe-core', 'axe.min.js');

function inPage() {
  const issues = [];
  const add = (type, el, detail) => issues.push({ type, where: where(el), detail });

  function where(el) {
    if (!el || el.nodeType !== 1) return '?';
    const parts = [];
    for (let n = el, i = 0; n && n.nodeType === 1 && i < 4; n = n.parentElement, i++) {
      let s = n.tagName.toLowerCase();
      if (n.id) { parts.unshift(`${s}#${n.id}`); break; }
      const cls = [...n.classList].slice(0, 2).join('.');
      if (cls) s += `.${cls}`;
      parts.unshift(s);
    }
    return parts.join(' > ');
  }
  const visible = el => el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true });
  // Screen-reader-only text (1×1px clipped box), by class or by pattern.
  const srOnly = el => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (n.classList.contains('visually-hidden')) return true;
      const r = n.getBoundingClientRect();
      if (r.width <= 1 && r.height <= 1 && getComputedStyle(n).position === 'absolute') return true;
    }
    return false;
  };
  const allowOverlap = el => !!el.closest('[data-allow-overlap], .skeleton-card') || srOnly(el);

  // Visible part of a rect after ancestor overflow clipping.
  const clipCache = new Map();
  function clipRectFor(el) {
    if (clipCache.has(el)) return clipCache.get(el);
    let r = { left: -1e9, top: -1e9, right: 1e9, bottom: 1e9 };
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.position === 'fixed') break;
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const b = a.getBoundingClientRect();
        r = { left: Math.max(r.left, b.left), top: Math.max(r.top, b.top), right: Math.min(r.right, b.right), bottom: Math.min(r.bottom, b.bottom) };
      }
    }
    clipCache.set(el, r);
    return r;
  }
  const intersect = (a, b) => ({ left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) });
  const area = r => Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top);

  function layerOf(el) {
    for (let a = el; a && a !== document.body; a = a.parentElement) {
      const p = getComputedStyle(a).position;
      if (p === 'fixed' || p === 'sticky') return a;
    }
    return null;
  }

  // 1. horizontal scroll
  if (document.documentElement.scrollWidth > innerWidth + 1) {
    let widest = null, max = innerWidth;
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.right > max + 1 && visible(el) && !el.closest('.table-wrap, .tabs, [data-scroll-x]')) { max = r.right; widest = el; }
    }
    add('hscroll', widest || document.body, `page is ${document.documentElement.scrollWidth}px wide at ${innerWidth}px`);
  }

  // 2. collect boxes
  const boxes = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.nodeValue.trim() && n.parentElement && !['SCRIPT', 'STYLE', 'TEMPLATE', 'OPTION'].includes(n.parentElement.tagName)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
  });
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!visible(el) || allowOverlap(el) || el.closest('template, select')) continue;
    range.selectNodeContents(n);
    const clip = clipRectFor(el);
    for (const r of range.getClientRects()) {
      if (r.width < 1 || r.height < 1) continue;
      const inset = r.height * 0.22; // glyph boxes overlap between tight lines; keep the core
      const core = intersect({ left: r.left + 0.5, top: r.top + inset, right: r.right - 0.5, bottom: r.bottom - inset }, clip);
      if (area(core) > 0) boxes.push({ el, r: core, text: true });
    }
  }
  for (const el of document.body.querySelectorAll('svg, img, input, select, textarea, progress')) {
    if (el.parentElement && el.parentElement.closest('svg')) continue; // nested svg
    if (!visible(el) || allowOverlap(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    // Form controls: only their content box holds text; icons may sit in reserved padding.
    const pad = { l: 1, t: 1, r: 1, b: 1 };
    if (/^(input|select|textarea)$/i.test(el.tagName)) {
      const cs = getComputedStyle(el);
      pad.l = parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth);
      pad.r = parseFloat(cs.paddingRight) + parseFloat(cs.borderRightWidth);
      pad.t = parseFloat(cs.paddingTop) + parseFloat(cs.borderTopWidth);
      pad.b = parseFloat(cs.paddingBottom) + parseFloat(cs.borderBottomWidth);
    }
    const core = intersect({ left: r.left + pad.l, top: r.top + pad.t, right: r.right - pad.r, bottom: r.bottom - pad.b }, clipRectFor(el));
    if (area(core) > 0) boxes.push({ el, r: core, text: false });
  }
  for (const b of boxes) b.layer = layerOf(b.el);

  // 3. overlaps (same layer, unrelated nodes)
  const seen = new Set();
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.el === b.el || a.layer !== b.layer) continue;
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const x = intersect(a.r, b.r);
      if (x.right - x.left <= 1 || x.bottom - x.top <= 1 || area(x) <= 4) continue;
      const key = `${where(a.el)}|${where(b.el)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      add('overlap', a.el, `overlaps ${where(b.el)} (${Math.round(x.right - x.left)}×${Math.round(x.bottom - x.top)}px)`);
    }
  }

  // 4. text spilling out of its pill-like or card container
  const CONTAINER = '.chip, .badge, .live-badge, .btn, .tab, .tab-btn, .seg-btn, .nav-item, .pill, .card, .card-flat, .card-ink, .stat, .alert, .riasec-tile';
  for (const b of boxes) {
    if (!b.text) continue;
    const c = b.el.closest(CONTAINER);
    if (!c) continue;
    const r = c.getBoundingClientRect();
    if (b.r.left < r.left - 1 || b.r.right > r.right + 1 || b.r.top < r.top - 1 || b.r.bottom > r.bottom + 1) {
      const key = `spill|${where(b.el)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      add('spill', b.el, `text leaves ${where(c)}`);
    }
  }

  // 5. clipping containers
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    const hx = cs.overflowX === 'hidden' || cs.overflowX === 'clip';
    const hy = cs.overflowY === 'hidden' || cs.overflowY === 'clip';
    if (!hx && !hy) continue;
    if (!visible(el) || el.closest('[data-allow-clip], progress, .illo, .skeleton') || srOnly(el)) continue;
    if (cs.textOverflow === 'ellipsis' || (cs.webkitLineClamp && cs.webkitLineClamp !== 'none')) continue;
    if ((hx && el.scrollWidth > el.clientWidth + 1) || (hy && el.scrollHeight > el.clientHeight + 1)) {
      add('clip', el, `content ${el.scrollWidth}×${el.scrollHeight} clipped to ${el.clientWidth}×${el.clientHeight}`);
    }
  }
  return issues;
}

function obscuredCheck() {
  const issues = [];
  scrollTo(0, document.documentElement.scrollHeight);
  const bars = [...document.querySelectorAll('body *')].filter(el => {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') return false;
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    const r = el.getBoundingClientRect();
    return r.height > 0 && r.bottom >= innerHeight - 1 && r.top > innerHeight / 2 && r.width > innerWidth / 3;
  });
  if (bars.length) {
    const top = Math.min(...bars.map(b => b.getBoundingClientRect().top));
    const root = document.querySelector('[data-proto-root]') || document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => n.nodeValue.trim() ? 1 : 3 });
    const range = document.createRange();
    let last = -Infinity, lastEl = null;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      if (bars.some(b => b.contains(el))) continue;
      let fixedAncestor = false;
      for (let a = el; a && a !== root; a = a.parentElement) { const p = getComputedStyle(a).position; if (p === 'fixed' || p === 'sticky') { fixedAncestor = true; break; } }
      if (fixedAncestor) continue;
      range.selectNodeContents(n);
      const r = range.getBoundingClientRect();
      if (r.height && r.bottom > last) { last = r.bottom; lastEl = el; }
    }
    if (last > top + 1) issues.push({ type: 'obscured', where: lastEl ? lastEl.tagName.toLowerCase() + (lastEl.className ? '.' + String(lastEl.className).split(' ')[0] : '') : '?', detail: `content ends at ${Math.round(last)}px under a bottom bar starting at ${Math.round(top)}px` });
  }
  scrollTo(0, 0);
  return issues;
}

async function auditPage(page, { contrast = true } = {}) {
  const issues = [...await page.evaluate(inPage), ...await page.evaluate(obscuredCheck)];
  if (contrast) {
    const has = await page.evaluate(() => typeof window.axe !== 'undefined');
    if (!has) await page.addScriptTag({ path: AXE });
    const res = await page.evaluate(async () => {
      const r = await window.axe.run(document, { runOnly: ['color-contrast'], resultTypes: ['violations'] });
      return r.violations.flatMap(v => v.nodes.map(n => ({ where: n.target.join(' '), detail: (n.any[0] && n.any[0].message) || v.help })));
    });
    for (const r of res) issues.push({ type: 'contrast', ...r });
  }
  return issues;
}

module.exports = { auditPage };
