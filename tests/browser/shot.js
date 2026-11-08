// Dev helper: screenshot one scenario.  node shot.js <file>/<id> <theme> <width> <out.png> [height]
const { chromium } = require('playwright-core');
const { startServer } = require('./serve.js');
const { stubApi } = require('./stub-api.js');
(async () => {
  const [ref, theme = 'light', width = '390', out = 'shot.png', height = '800'] = process.argv.slice(2);
  const [file, id] = ref.split('/');
  const sc = require(`./scenarios/${file}.js`).find(s => s.id === id);
  if (!sc) throw new Error('no scenario ' + ref);
  const srv = await startServer();
  const b = await chromium.launch({ channel: 'chrome' });
  const ctx = await b.newContext({ viewport: { width: +width, height: +height } });
  await ctx.addInitScript(([t, li]) => { try { localStorage.setItem('careerai_theme', t); if (li) sessionStorage.setItem('careerai_session', 'stu-aarav'); } catch (e) {} }, [theme, sc.loggedIn !== false]);
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('pageerror', e.message));
  await stubApi(p, sc.stubs || {});
  await p.goto(`${srv.url}/${sc.page}${sc.query || ''}${sc.hash || ''}`, { waitUntil: 'domcontentloaded' });
  if (sc.before) await sc.before(p);
  await p.waitForSelector(sc.ready, { state: 'attached', timeout: 15000 });
  if (sc.after) await sc.after(p);
  await p.waitForLoadState('load').catch(() => {});
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: out, fullPage: true });
  await b.close(); await srv.close();
})();
