// Browser layout audit for every manifest screen × state × theme × viewport.
// Run (in ui_redesign/tools):  npm run layout
//   SCREENS=dashboard,contests npm run layout   only those screens
//   QUICK=1 npm run layout                      320 and 1280 only; contrast only at 1280
// Uses the installed Chrome via playwright-core (channel 'chrome').
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { chromium } = require('playwright-core');
const { startServer } = require('./serve.js');
const { loadManifest, parseHook } = require('./manifest.js');
const { auditPage } = require('./audit.js');

const ONLY = process.env.SCREENS ? process.env.SCREENS.split(',').map(s => s.trim()) : null;
const QUICK = process.env.QUICK === '1';
const THEMES = ['light', 'dark'];
const all = loadManifest();
const screens = all.filter(s => !ONLY || ONLY.includes(s.id));

let srv, browser;
const contexts = {};

before(async () => {
  srv = await startServer();
  browser = await chromium.launch({ channel: 'chrome' });
  for (const t of THEMES) contexts[t] = await browser.newContext({ viewport: { width: 1280, height: 800 } });
});
after(async () => {
  if (browser) await browser.close();
  if (srv) await srv.close();
});

// Rarely, under heavy CPU load (another browser test run in parallel), a navigation
// stalls before DOMContentLoaded. Log what was still pending, then retry once; a
// second stall fails the test with the diagnostics attached.
function trackPending(page) {
  if (page.__pending) return page.__pending;
  const pending = new Map();
  page.on('request', q => pending.set(q, Date.now()));
  page.on('requestfinished', q => pending.delete(q));
  page.on('requestfailed', q => pending.delete(q));
  return (page.__pending = pending);
}

async function open(page, screen, state, theme, extra = '') {
  const url = `${srv.url}/${screen.file}?state=${encodeURIComponent(state)}&theme=${theme}${extra}`;
  const pending = trackPending(page);
  for (let attempt = 1; ; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      break;
    } catch (e) {
      const stuck = [...pending].map(([q, t]) => `${q.url().replace(srv.url, '')} ${q.resourceType()} ${Date.now() - t}ms`).join('; ');
      const msg = `navigation stalled (attempt ${attempt}) ${url.replace(srv.url, '')}; pending: ${stuck || 'none'}`;
      if (attempt >= 2) throw new Error(`${msg}\n${e.message.split('\n')[0]}`);
      console.error(`# ${msg}`);
    }
  }
  await page.waitForSelector('html[data-proto-ready]', { timeout: 10000 });
  await page.waitForLoadState('load', { timeout: 5000 }).catch(() => {}); // images, best effort
  await page.evaluate(() => document.fonts.ready.then(() => true));
}

function viewportsFor(screen) {
  if (!QUICK) return screen.viewports;
  return screen.viewports.filter(([w]) => w === 320 || w === 1280);
}

function fmt(issues) {
  return issues.slice(0, 40).map(i => `${i.type} [${i.theme} ${i.state} ${i.vp}] ${i.where}: ${i.detail}`).join('\n')
    + (issues.length > 40 ? `\n…and ${issues.length - 40} more` : '');
}

for (const screen of screens) {
  test(`${screen.id}: layout matrix has no issues`, async () => {
    const issues = [];
    for (const theme of THEMES) {
      const page = await contexts[theme].newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
      for (const state of screen.states) {
        for (const [w, h] of viewportsFor(screen)) {
          await page.setViewportSize({ width: w, height: h });
          await open(page, screen, state, theme);
          const missing = await page.evaluate(ids => ids.filter(id => !document.getElementById(id)),
            screen.hooks.map(parseHook).filter(hk => hk.dom && (!hk.states || hk.states.includes(state))).map(hk => hk.id));
          for (const id of missing) issues.push({ type: 'hook', where: `#${id}`, detail: 'JS-rendered hook missing', theme, state, vp: `${w}x${h}` });
          const contrast = QUICK ? w === 1280 : true;
          for (const i of await auditPage(page, { contrast })) issues.push({ ...i, theme, state, vp: `${w}x${h}` });
        }
      }
      for (const e of [...new Set(errors)]) issues.push({ type: 'error', where: screen.file, detail: e, theme, state: '-', vp: '-' });
      await page.close();
    }
    assert.ok(issues.length === 0, `\n${fmt(issues)}`);
  });

  test(`${screen.id}: stress mode at 320px has no overflow/overlap`, async () => {
    const page = await contexts.light.newPage();
    await page.setViewportSize({ width: 320, height: 800 });
    const issues = [];
    for (const state of screen.states) {
      await open(page, screen, state, 'light', '&stress=1');
      for (const i of await auditPage(page, { contrast: false })) issues.push({ ...i, theme: 'light', state, vp: '320 stress' });
    }
    await page.close();
    assert.ok(issues.length === 0, `\n${fmt(issues)}`);
  });
}

test('audit detects planted problems', { skip: !!ONLY && !ONLY.includes('audit') && !ONLY.includes('shell-demo') }, async () => {
  const page = await contexts.light.newPage();
  await page.setViewportSize({ width: 390, height: 600 });
  await page.goto(`${srv.url}/tools/fixtures/audit-bad.html`);
  const found = await auditPage(page, { contrast: true });
  const types = new Set(found.map(i => i.type));
  assert.ok(found.some(i => i.type === 'overlap' && /svg/.test(i.where + i.detail)), 'audit missed an aria-hidden icon overlapping text');
  for (const t of ['hscroll', 'overlap', 'spill', 'clip', 'obscured', 'contrast']) assert.ok(types.has(t), `audit missed ${t}; got ${[...types]}`);
  await page.close();
});

const report = all.find(s => s.id === 'career-results');
test('print layout hides chrome', { skip: !report || (!!ONLY && !ONLY.includes('career-results')) }, async () => {
  for (const theme of THEMES) {
  const page = await contexts[theme].newPage();
  await page.setViewportSize({ width: 1024, height: 800 });
  await open(page, report, 'full', theme);
  await page.emulateMedia({ media: 'print' });
  // Printing must use the light palette whatever the screen theme: readable ink on white.
  const contrast = (await auditPage(page, { contrast: true })).filter(i => i.type === 'contrast');
  assert.deepStrictEqual(contrast, [], `${theme} theme: print has contrast failures`);
  const sunk = await page.evaluate(() => getComputedStyle(document.querySelector('.card-sunk, .progress') || document.body).backgroundColor);
  assert.ok(!/rgb\(2[0-9], 1[0-9], 1[0-9]\)/.test(sunk), `${theme} theme: print still uses the dark sunk colour (${sunk})`);
  const r = await page.evaluate(() => ({
    noPrintShown: [...document.querySelectorAll('.no-print')].filter(el => getComputedStyle(el).display !== 'none').map(el => el.className),
    headShown: !!document.querySelector('.air-print-head') && getComputedStyle(document.querySelector('.air-print-head')).display !== 'none',
    headerShown: [...document.querySelectorAll('.public-header')].some(el => getComputedStyle(el).display !== 'none'),
  }));
  assert.deepStrictEqual(r.noPrintShown, [], 'every .no-print hidden in print');
  assert.ok(r.headShown, '.air-print-head visible in print');
  assert.ok(!r.headerShown, 'site header hidden in print');
  await page.close();
  }
});

test('flow pages have no app shell', async () => {
  const flows = all.filter(s => s.shell === 'flow' && (!ONLY || ONLY.includes(s.id)));
  const page = await contexts.light.newPage();
  for (const s of flows) {
    await open(page, s, s.states[0], 'light');
    const found = await page.evaluate(() => ['.sidebar', '.tabbar', '[data-shell]'].filter(sel => document.querySelector(sel)));
    assert.deepStrictEqual(found, [], `${s.id} must not include the app shell`);
  }
  await page.close();
});

const chat = all.find(s => s.id === 'chat');
const runChat = chat && (!ONLY || ONLY.includes('chat'));
test('chat composer never covers last message', { skip: !runChat }, async () => {
  const page = await contexts.light.newPage();
  for (const [w, h] of [[320, 568], [390, 800], [1280, 800]]) {
    await page.setViewportSize({ width: w, height: h });
    await open(page, chat, 'conversation', 'light');
    const r = await page.evaluate(() => {
      const sc = document.getElementById('chat-scroll');
      sc.scrollTop = sc.scrollHeight;
      const bubbles = document.querySelectorAll('#chat-messages .msg-bubble');
      const last = bubbles[bubbles.length - 1].getBoundingClientRect();
      const comp = document.querySelector('.chat-composer').getBoundingClientRect();
      return { lastBottom: last.bottom, composerTop: comp.top, composerBottom: comp.bottom, vh: innerHeight };
    });
    assert.ok(r.lastBottom <= r.composerTop + 0.5, `at ${w}x${h}: last bubble ends at ${r.lastBottom}, composer starts at ${r.composerTop}`);
    assert.ok(r.composerBottom <= r.vh + 0.5, `at ${w}x${h}: composer is cut off below the viewport`);
  }
  await page.close();
});

test('escape closes memory', { skip: !runChat }, async () => {
  const page = await contexts.light.newPage();
  await page.setViewportSize({ width: 390, height: 800 });
  await open(page, chat, 'memory-open', 'light');
  assert.ok(await page.isVisible('#chat-mem'), 'memory panel visible when open');
  await page.keyboard.press('Escape');
  assert.ok(!(await page.evaluate(() => document.body.classList.contains('chat-mem-open'))), 'Escape removes chat-mem-open');
  await page.close();
});

test('live .active state looks the same as .selected on chips and pills', { skip: !!ONLY && !ONLY.includes('foundations') }, async () => {
  // script.js marks the chosen filter chip and Career Space pill with .active (filterChip, career pills).
  const page = await contexts.light.newPage();
  await open(page, foundations, 'board', 'light');
  const r = await page.evaluate(() => {
    const root = document.querySelector('[data-proto-root]');
    const mk = html => { const d = document.createElement('div'); d.innerHTML = html; root.appendChild(d); return d.firstChild; };
    const style = el => { const cs = getComputedStyle(el); return `${cs.backgroundColor}|${cs.color}|${cs.borderColor}`; };
    return {
      chipSel: style(mk('<button class="chip selected">A</button>')), chipAct: style(mk('<button class="chip active">A</button>')),
      pillSel: style(mk('<a class="pill selected">A</a>')), pillAct: style(mk('<a class="pill active">A</a>')),
    };
  });
  assert.strictEqual(r.chipAct, r.chipSel, 'chip.active should match chip.selected');
  assert.strictEqual(r.pillAct, r.pillSel, 'pill.active should match pill.selected');
  await page.close();
});

const shellDemo = all.find(s => s.id === 'shell-demo');
const foundations = all.find(s => s.id === 'foundations');
const runShell = shellDemo && (!ONLY || ONLY.includes('shell-demo'));

test('escape closes overlays', { skip: !runShell }, async () => {
  const page = await contexts.light.newPage();
  await page.setViewportSize({ width: 390, height: 800 });
  await open(page, shellDemo, 'more-open', 'light');
  assert.ok(await page.evaluate(() => document.body.classList.contains('nav-open')), 'more-open state should start open');
  assert.ok(await page.isVisible('#more-sheet'), 'More sheet visible when open');
  await page.keyboard.press('Escape');
  assert.ok(!(await page.evaluate(() => document.body.classList.contains('nav-open'))), 'Escape removes nav-open');
  await page.close();
});

test('focus ring visible', { skip: !runShell }, async () => {
  const page = await contexts.light.newPage();
  for (const w of [390, 1280]) {
    await page.setViewportSize({ width: w, height: 800 });
    await open(page, shellDemo, 'home', 'light');
    await page.keyboard.press('Tab');
    const f = await page.evaluate(() => {
      const el = document.activeElement;
      const cs = getComputedStyle(el);
      return { cls: el.className, outline: cs.outlineStyle, shadow: cs.boxShadow };
    });
    assert.ok(f.outline !== 'none' || f.shadow !== 'none', `no visible focus on ${f.cls} at ${w}px`);
  }
  await page.close();
});

test('reduced motion disables animation', { skip: !runShell }, async () => {
  const page = await contexts.light.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const s of [foundations, shellDemo]) {
    await open(page, s, s.states.includes('contests-live') ? 'contests-live' : s.states[0], 'light');
    const moving = await page.evaluate(() => [...document.querySelectorAll('*')]
      .filter(el => { const cs = getComputedStyle(el); return cs.animationName !== 'none' && parseFloat(cs.animationDuration) * (cs.animationDuration.endsWith('ms') ? 1 : 1000) > 0.01; })
      .map(el => el.className || el.tagName));
    assert.deepStrictEqual(moving, [], `${s.id}: animations still running`);
  }
  await page.close();
});

test('bottom bar labels fit', { skip: !runShell }, async () => {
  const page = await contexts.light.newPage();
  for (const w of [320, 360, 390, 430, 768]) {
    await page.setViewportSize({ width: w, height: 800 });
    await open(page, shellDemo, 'contests-live', 'light');
    const r = await page.evaluate(() => {
      const box = el => el.getBoundingClientRect();
      const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
      const tabs = [...document.querySelectorAll('.tabbar .tab')];
      const out = [];
      tabs.forEach((t, i) => {
        const label = t.querySelector('.tab-label');
        if (label.scrollWidth > label.clientWidth + 1) out.push(`label overflows: ${label.textContent}`);
        if (!hit(box(t), box(label)) || box(label).right > box(t).right + 0.5 || box(label).left < box(t).left - 0.5) out.push(`label outside tab: ${label.textContent}`);
        tabs.slice(i + 1).forEach(u => { if (hit(box(t), box(u))) out.push('tabs intersect'); });
        const live = t.querySelector('.tab-live');
        if (live) {
          const icon = t.querySelector('.icon');
          if (hit(box(live), box(icon))) out.push('live indicator covers icon');
          if (hit(box(live), box(label))) out.push('live indicator covers label');
          if (box(live).right > box(t).right + 0.5) out.push('live indicator leaves its tab');
        }
      });
      return out;
    });
    assert.deepStrictEqual(r, [], `at ${w}px`);
  }
  await page.close();
});

test('live contest is announced to screen readers at every width', { skip: !runShell }, async () => {
  const page = await contexts.light.newPage();
  for (const w of [360, 390, 768]) {
    await page.setViewportSize({ width: w, height: 800 });
    await open(page, shellDemo, 'contests-live', 'light');
    const n = await page.getByRole('link', { name: /contests.*live/i }).count();
    assert.ok(n >= 1, `at ${w}px the Contests tab's accessible name doesn't say it is live`);
  }
  await page.close();
});

test('sidebar vs tabbar by width', { skip: !runShell }, async () => {
  const page = await contexts.light.newPage();
  await page.setViewportSize({ width: 1023, height: 800 });
  await open(page, shellDemo, 'home', 'light');
  assert.ok(await page.isVisible('.tabbar'), 'tabbar visible at 1023');
  assert.ok(!(await page.isVisible('.sidebar')), 'sidebar hidden at 1023');
  await page.setViewportSize({ width: 1024, height: 800 });
  assert.ok(!(await page.isVisible('.tabbar')), 'tabbar hidden at 1024');
  assert.ok(await page.isVisible('.sidebar'), 'sidebar visible at 1024');
  await page.close();
});
