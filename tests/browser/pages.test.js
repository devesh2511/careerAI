// Student pages in a real browser, against stubbed API responses.
// Run (in tests/browser):  npm test
//   SCREENS=public,flows npm test   only those scenario files (by file name)
//   FULL=1 npm test                 all 7 widths instead of 4
// Every scenario × theme × width must render its ready selector with no page
// errors and no "undefined"/"NaN"/"null" text. Scenario files in AUDITED (the
// ones whose pages are migrated) must also pass the prototype's layout audit.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { startServer } = require('./serve.js');
const { auditPage } = require('./audit.js');
const { stubApi } = require('./stub-api.js');

// Scenario files whose pages are migrated; each live-step task adds its file.
const AUDITED = ['public', 'flows', 'report', 'app-home', 'app-explore', 'contests', 'app-misc', 'chat'];

const ONLY = process.env.SCREENS ? process.env.SCREENS.split(',').map(s => s.trim()) : null;
const WIDTHS = process.env.FULL === '1' ? [320, 360, 390, 768, 1024, 1280, 1440] : [320, 390, 768, 1280];
const THEMES = ['light', 'dark'];
const files = fs.readdirSync(path.join(__dirname, 'scenarios')).filter(f => f.endsWith('.js')).map(f => f.replace(/\.js$/, ''));

let srv, browser;
before(async () => {
  srv = await startServer();
  browser = await chromium.launch({ channel: 'chrome' });
});
after(async () => {
  if (browser) await browser.close();
  if (srv) await srv.close();
});

async function newPage(theme, sc = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const loggedIn = sc.loggedIn !== false;
  await ctx.addInitScript(([t, li]) => {
    try { localStorage.setItem('careerai_theme', t); if (li) sessionStorage.setItem('careerai_session', 'stu-aarav'); } catch (e) {}
  }, [theme, loggedIn]);
  if (sc.init) await ctx.addInitScript(sc.init);
  const page = await ctx.newPage();
  page.__errors = [];
  page.on('pageerror', e => page.__errors.push(e.message));
  await stubApi(page, sc.stubs || {});
  return page;
}

async function open(page, sc) {
  const url = `${srv.url}/${sc.page}${sc.query || ''}${sc.hash || ''}`;
  for (let attempt = 1; ; attempt++) {
    try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }); break; }
    catch (e) { if (attempt >= 2) throw e; console.error(`# navigation stalled, retrying ${url}`); }
  }
  if (sc.before) await sc.before(page);
  await page.waitForSelector(sc.ready, { state: 'attached', timeout: 15000 });
  if (sc.after) await sc.after(page);
  await page.waitForLoadState('load', { timeout: 5000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready.then(() => true));
}

const STRAY = /\b(undefined|NaN)\b|\[object Object\]|(?<![\w-])null(?![\w-])/;

function fmt(issues) {
  return issues.slice(0, 40).map(i => `${i.type} [${i.theme} ${i.id} ${i.w}] ${i.where}: ${i.detail}`).join('\n') + (issues.length > 40 ? `\n…and ${issues.length - 40} more` : '');
}

for (const file of files) {
  if (ONLY && !ONLY.includes(file)) continue;
  const scenarios = require(`./scenarios/${file}.js`);
  const audited = AUDITED.includes(file);
  for (const sc of scenarios) {
    test(`${file}/${sc.id}: renders${audited ? ' and passes the layout audit' : ''}`, async () => {
      const issues = [];
      for (const theme of THEMES) {
        for (const w of sc.viewports || WIDTHS) {
          const page = await newPage(theme, sc);
          await page.setViewportSize({ width: w, height: 800 });
          await open(page, sc);
          const text = await page.evaluate(() => document.body.innerText);
          const stray = text.match(STRAY);
          if (stray) issues.push({ type: 'stray', where: 'body text', detail: `"${text.slice(Math.max(0, stray.index - 40), stray.index + 20).replace(/\s+/g, ' ')}"`, theme, id: sc.id, w });
          for (const e of page.__errors) issues.push({ type: 'pageerror', where: sc.page, detail: e, theme, id: sc.id, w });
          if (audited) for (const i of await auditPage(page, { contrast: w === 1280 || w === 390 })) issues.push({ ...i, theme, id: sc.id, w });
          await page.context().close();
        }
      }
      assert.ok(issues.length === 0, `\n${fmt(issues)}`);
    });
  }
}

const { STUDENT_PAGES, FRAMES, MIGRATED } = require('../pages-list.js');
const runShell = !ONLY || ONLY.includes('shell');

test('router shows one view', { skip: !runShell }, async () => {
  const page = await newPage('light');
  await open(page, { page: 'pages/app.html', hash: '#/dashboard', ready: '#db-title' });
  for (const h of ['#/roadmap', '#/contests', '#/dashboard']) {
    await page.evaluate(x => { location.hash = x; }, h);
    await page.waitForFunction(x => location.hash.startsWith(x), h);
    const r = await page.evaluate(() => ({
      shown: [...document.querySelectorAll('.page')].filter(p => !p.hidden).map(p => p.id + (p.classList.contains('active') ? '' : '(no .active)')),
      inline: [...document.querySelectorAll('.page')].filter(p => p.style.display).map(p => p.id),
    }));
    assert.strictEqual(r.shown.length, 1, `${h}: shown ${r.shown}`);
    assert.ok(!r.shown[0].includes('no .active'), `${h}: shown view lacks .active`);
    assert.deepStrictEqual(r.inline, [], `${h}: views must not use inline display`);
  }
  await page.context().close();
});

test('nav highlights follow the route', { skip: !runShell }, async () => {
  const page = await newPage('light');
  const active = () => page.evaluate(() => [...document.querySelectorAll('.nav-item, .tab, .more-link, .user-profile')]
    .filter(n => n.classList.contains('active')).map(n => `${n.className.split(' ')[0]}:${n.dataset.page || 'more'}${n.getAttribute('aria-current') === 'page' ? '*' : ''}`).sort());
  await open(page, { page: 'pages/app.html', hash: '#/contests', ready: '.tabbar' });
  assert.deepStrictEqual(await active(), ['nav-item:contests*', 'tab:contests*']);
  await page.evaluate(() => { location.hash = '#/settings'; });
  await page.waitForFunction(() => location.hash.startsWith('#/settings'));
  assert.deepStrictEqual(await active(), ['more-link:settings*', 'tab:more', 'user-profile:settings*']);
  await page.context().close();
});

test('more sheet opens, closes on escape and swipe', { skip: !runShell }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('careerai_session', 'stu-aarav'); } catch (e) {} });
  const page = await ctx.newPage();
  await stubApi(page);
  await open(page, { page: 'pages/app.html', hash: '#/dashboard', ready: '.tab-more' });
  const isOpen = () => page.evaluate(() => document.body.classList.contains('nav-open'));
  await page.click('.tab-more');
  assert.ok(await isOpen(), 'More opens');
  await page.keyboard.press('Escape');
  assert.ok(!(await isOpen()), 'Escape closes');
  await page.click('.tab-more');
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const el = document.querySelector('.more-sheet');
    const t = y => [new Touch({ identifier: 1, target: el, clientX: 200, clientY: y })];
    el.dispatchEvent(new TouchEvent('touchstart', { touches: t(500), bubbles: true }));
    el.dispatchEvent(new TouchEvent('touchmove', { touches: t(620), bubbles: true }));
    el.dispatchEvent(new TouchEvent('touchend', { touches: [], bubbles: true }));
  });
  assert.ok(!(await isOpen()), 'swipe down closes');
  await ctx.close();
});

test('access gate', { skip: !runShell }, async () => {
  let page = await newPage('light', { stubs: { 'GET /me/access': { status: 401, json: { error: { code: 'unauthenticated' } } } } });
  await page.goto(`${srv.url}/pages/app.html#/dashboard`);
  await page.waitForURL(/auth\.html/, { timeout: 10000 });
  await page.context().close();

  page = await newPage('light', { stubs: { 'GET /me/access': { status: 200, json: { has_access: false, reason: 'no_school', source: null, school: null } } } });
  await page.goto(`${srv.url}/pages/app.html#/dashboard`);
  await page.waitForURL(/paywall\.html/, { timeout: 10000 });
  await page.context().close();

  page = await newPage('light', { stubs: { 'GET /me/access': { delay: 1500 } } });
  await page.goto(`${srv.url}/pages/app.html#/dashboard`, { waitUntil: 'domcontentloaded' });
  assert.strictEqual(await page.evaluate(() => document.body.style.visibility), 'hidden', 'hidden until access is known');
  await page.context().close();

  page = await newPage('light', { stubs: { 'GET /me/access': { abort: true } } });
  await page.setViewportSize({ width: 390, height: 800 });
  await open(page, { page: 'pages/app.html', hash: '#/dashboard', ready: '.card .btn-primary' });
  assert.ok(await page.isVisible('.card .btn-primary'), 'retry button visible');
  assert.deepStrictEqual(await auditPage(page, { contrast: true }), [], 'retry screen passes the audit');
  await page.context().close();
});

test('theme persists and every page has a toggle', { skip: !runShell }, async () => {
  for (const p of STUDENT_PAGES) {
    const page = await newPage('dark', { loggedIn: false, stubs: { 'GET /me/access': { delay: 60000 } } });
    await page.goto(`${srv.url}/${p}`, { waitUntil: 'domcontentloaded' });
    assert.strictEqual(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'dark', `${p}: dark at first paint`);
    if (FRAMES.includes(p) || MIGRATED.includes(p)) assert.ok(await page.locator('.theme-toggle').count() >= 1, `${p}: has a theme toggle`);
    await page.context().close();
  }
});

test('evaluation shows real profile', { skip: !!ONLY && !ONLY.includes('flows') }, async () => {
  const page = await newPage('light');
  await open(page, { page: 'pages/evaluation.html', ready: '#eval-body .kv' });
  const text = await page.innerText('#eval-body');
  for (const want of ['Class 10', 'CBSE', 'Pune', 'Mathematics, 95%', 'Coding']) assert.ok(text.includes(want), `summary lacks ${want}`);
  await page.context().close();
});

test('print hides chrome in both themes', { skip: !!ONLY && !ONLY.includes('report') }, async () => {
  for (const theme of THEMES) {
    const page = await newPage(theme);
    await page.setViewportSize({ width: 1024, height: 800 });
    await open(page, { page: 'pages/career_results.html', ready: '#air-careers .air-career-card' });
    await page.emulateMedia({ media: 'print' });
    const r = await page.evaluate(() => ({
      noPrintShown: [...document.querySelectorAll('.no-print')].filter(el => getComputedStyle(el).display !== 'none').length,
      headShown: getComputedStyle(document.querySelector('.air-print-head')).display !== 'none',
      headerShown: [...document.querySelectorAll('.public-header')].some(el => getComputedStyle(el).display !== 'none'),
    }));
    assert.strictEqual(r.noPrintShown, 0, `${theme}: .no-print visible in print`);
    assert.ok(r.headShown, `${theme}: print head hidden`);
    assert.ok(!r.headerShown, `${theme}: site header shown in print`);
    const contrast = (await auditPage(page, { contrast: true })).filter(i => i.type === 'contrast');
    assert.deepStrictEqual(contrast, [], `${theme}: print contrast`);
    await page.context().close();
  }
});

test('matches chips filter the list', { skip: !!ONLY && !ONLY.includes('app-home') }, async () => {
  const page = await newPage('light');
  await open(page, { page: 'pages/app.html', hash: '#/results', ready: '#results-filter .filter-chip[data-cat="Technology"]' });
  const all = await page.locator('#career-list .career-card').count();
  await page.click('#results-filter .filter-chip[data-cat="Technology"]');
  const fields = await page.$$eval('#career-list .career-card .career-field', els => els.map(e => e.textContent));
  assert.ok(fields.length > 0 && fields.length < all, `filtered ${fields.length} of ${all}`);
  assert.ok(fields.every(f => f.startsWith('Technology')), `non-Technology card shown: ${fields}`);
  assert.ok(await page.locator('#results-filter .filter-chip[data-cat="Technology"].active').count() === 1, 'chip marked active');
  await page.context().close();
});

test('explore drawer is a bottom sheet on phones and closes on escape', { skip: !!ONLY && !ONLY.includes('app-explore') }, async () => {
  for (const w of [390, 1280]) {
    const page = await newPage('light');
    await page.setViewportSize({ width: w, height: 800 });
    await open(page, { page: 'pages/app.html', hash: '#/explorer', ready: '#explore-grid .explore-card' });
    await page.click('#ex-filter-btn');
    await page.waitForTimeout(350);
    const box = await page.locator('#ex-drawer').boundingBox();
    if (w < 640) assert.ok(Math.abs(box.y + box.height - 800) < 2 && box.width >= w - 1, `phone: drawer should sit at the bottom, full width (${JSON.stringify(box)})`);
    else assert.ok(Math.abs(box.x + box.width - w) < 2 && box.height >= 799, `desktop: drawer should sit on the right edge (${JSON.stringify(box)})`);
    await page.keyboard.press('Escape');
    assert.ok(!(await page.evaluate(() => document.body.classList.contains('ex-filters-open'))), 'Escape closes the filters');
    await page.context().close();
  }
});

test('countdowns tick without destroying markup', { skip: !!ONLY && !ONLY.includes('contests') }, async () => {
  const sc = require('./scenarios/contests.js').find(x => x.id === 'contests-live');
  const page = await newPage('light', sc);
  await open(page, sc);
  await page.waitForTimeout(2200);
  const r = await page.evaluate(() => [...document.querySelectorAll('[data-until]')].map(el => ({ kids: el.children.length, text: el.textContent.trim(), inCard: !!el.closest('.lb-status') })));
  assert.ok(r.length > 0, 'a countdown is on the page');
  assert.ok(r.every(x => x.kids === 0 && x.text.length > 0 && x.inCard), JSON.stringify(r));
  await page.context().close();
});

test('remove school asks first', { skip: !!ONLY && !ONLY.includes('app-misc') }, async () => {
  const sc = require('./scenarios/app-misc.js').find(x => x.id === 'settings-remove-school-warning');
  const page = await newPage('light', sc);
  const puts = [];
  page.on('request', r => { if (r.method() === 'PUT' && /\/me\/school$/.test(new URL(r.url()).pathname)) puts.push(r.url()); });
  await open(page, sc);
  assert.ok(await page.isVisible('#st-school-warn .alert'), 'warning shown');
  assert.deepStrictEqual(puts, [], 'no PUT /me/school before confirming');
  await page.click('#st-school-warn .btn-danger');
  await page.waitForTimeout(500);
  assert.strictEqual(puts.length, 1, 'PUT /me/school sent after confirming');
  await page.context().close();
});

test('chat pdf export', { skip: !!ONLY && !ONLY.includes('chat') }, async () => {
  const sc = require('./scenarios/chat.js').find(x => x.id === 'chat-conversation');
  const page = await newPage('light', sc);
  await open(page, sc);
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('#chat-messages .msg-save')]);
  assert.ok(/\.pdf$/i.test(download.suggestedFilename()), `downloaded ${download.suggestedFilename()}`);
  assert.deepStrictEqual(page.__errors, [], 'no page errors while saving');
  await page.context().close();
});

test('composer never covers last message', { skip: !!ONLY && !ONLY.includes('chat') }, async () => {
  const sc = require('./scenarios/chat.js').find(x => x.id === 'chat-conversation');
  for (const [w, h] of [[320, 568], [390, 800], [1280, 800]]) {
    const page = await newPage('light', sc);
    await page.setViewportSize({ width: w, height: h });
    await open(page, sc);
    const r = await page.evaluate(() => {
      const sc = document.getElementById('chat-scroll');
      sc.scrollTop = sc.scrollHeight;
      const bubbles = document.querySelectorAll('#chat-messages .msg-bubble');
      const last = bubbles[bubbles.length - 1].getBoundingClientRect();
      const comp = document.querySelector('.chat-composer').getBoundingClientRect();
      return { lastBottom: last.bottom, top: comp.top, bottom: comp.bottom, vh: innerHeight };
    });
    assert.ok(r.lastBottom <= r.top + 0.5, `${w}x${h}: last bubble ${r.lastBottom} under composer ${r.top}`);
    assert.ok(r.bottom <= r.vh + 0.5, `${w}x${h}: composer cut off`);
    await page.context().close();
  }
});

test('harness loads a logged-in app page', { skip: !!ONLY && !ONLY.includes('harness') }, async () => {
  const page = await newPage('light');
  await open(page, { page: 'pages/app.html', hash: '#/dashboard', ready: '#db-title' });
  assert.ok(await page.evaluate(() => document.body.style.visibility !== 'hidden'), 'access gate opened');
  assert.deepStrictEqual(page.__errors, []);
  await page.context().close();
});

test('admin pages still work', { skip: !!ONLY && !ONLY.includes('admin') }, async () => {
  let page = await newPage('light', { loggedIn: false, stubs: { 'GET /admin/me': { status: 401, json: { error: { code: 'unauthenticated' } } } } });
  await open(page, { page: 'pages/admin_login.html', ready: '#adm-login-btn' });
  assert.ok(await page.isVisible('#adm-login-btn'), 'admin login button visible');
  assert.deepStrictEqual(page.__errors, [], 'admin login has no page errors');
  await page.context().close();

  page = await newPage('light', { loggedIn: false });
  await open(page, { page: 'pages/admin.html', ready: '.sidebar' });
  await page.waitForFunction(() => document.getElementById('adm-name') && document.getElementById('adm-name').textContent.trim().length > 0, null, { timeout: 10000 });
  await page.evaluate(() => { location.hash = '#/schools'; });
  await page.waitForFunction(() => location.hash === '#/schools');
  assert.ok(await page.isVisible('.sidebar'), 'admin sidebar visible');
  assert.deepStrictEqual(page.__errors, [], 'admin panel has no page errors');
  await page.context().close();
});

test('audit self-test', { skip: !!ONLY && !ONLY.includes('audit') }, async () => {
  const page = await newPage('light');
  await page.setViewportSize({ width: 390, height: 600 });
  await page.goto(`${srv.url}/tests/browser/fixtures/audit-bad.html`);
  const types = new Set((await auditPage(page, { contrast: true })).map(i => i.type));
  for (const t of ['hscroll', 'overlap', 'spill', 'clip', 'obscured', 'contrast']) assert.ok(types.has(t), `audit missed ${t}`);
  await page.context().close();
});

module.exports = { AUDITED };
