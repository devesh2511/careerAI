// Dev helper: screenshot a screen. node shot.js <file> <state> <theme> <width> [out.png] [height]
const { chromium } = require('playwright-core');
const { startServer } = require('./serve.js');
(async () => {
  const [file, state = '', theme = 'light', width = '390', out = 'shot.png', height = '800'] = process.argv.slice(2);
  const srv = await startServer();
  const b = await chromium.launch({ channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: +width, height: +height } });
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('requestfailed', r => errors.push('failed ' + r.url()));
  p.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
  await p.goto(`${srv.url}/${file}?state=${state}&theme=${theme}`);
  await p.waitForSelector('html[data-proto-ready]', { timeout: 5000 }).catch(() => errors.push('not ready'));
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: out, fullPage: true });
  if (errors.length) console.log(errors.join('\n'));
  await b.close(); await srv.close();
})();
