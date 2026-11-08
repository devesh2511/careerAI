// Page-level rules for the redesigned student site. Run: npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { STUDENT_PAGES, FRAMES, MIGRATED } = require('./pages-list.js');

const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const exists = f => fs.existsSync(path.join(ROOT, f));

const CSS = ['/css/tokens.css', '/css/base.css', '/css/components.css', '/css/layouts.css'];
const EMOJI = /(?![©®™])\p{Extended_Pictographic}/u;
const head = html => (html.match(/<head[\s\S]*?<\/head>/i) || [''])[0];
const firstScript = html => (head(html).match(/<script\b[^>]*>([\s\S]*?)<\/script>/i) || [, ''])[1].trim();

// Admin is out of scope; these files must not change (hashes taken when the live step started).
const ADMIN_HASHES = {
  'pages/admin.html': '24055005594db5194c942dc32268da0149fb6595',
  'pages/admin_login.html': '3e53fde3a7ed8cea9bd7911439038966820ef111',
  'admin.css': 'd1c70430352036f4e9ed8dec1a972bf8ac3adb08',
  'scripts/admin.js': '50445ec86892ee17f307184680ab1849043762fa',
  'style.css': 'c38f304ae805f748b93056b65f8a89686db85701',
};

for (const page of new Set([...FRAMES, ...MIGRATED])) {
  const html = read(page);
  test(`${page}: links the four new stylesheets in order and not style.css`, () => {
    const links = [...head(html).matchAll(/<link\b[^>]*rel\s*=\s*["']stylesheet["'][^>]*href\s*=\s*["']([^"']+)["']/gi)].map(m => m[1]);
    assert.deepStrictEqual(links, CSS);
  });
  test(`${page}: theme snippet is the first head script`, () => {
    const h = head(html);
    assert.ok(h.search(/<script\b/i) < h.search(/<link\b[^>]*stylesheet/i), 'theme script must precede stylesheets');
    assert.ok(firstScript(html).includes('careerai_theme'));
  });
}

test('theme snippet is identical on every page', () => {
  const pages = [...new Set([...FRAMES, ...MIGRATED])];
  const snippets = new Set(pages.map(p => firstScript(read(p))));
  assert.ok(snippets.size <= 1, `found ${snippets.size} different theme snippets`);
});

for (const page of MIGRATED) {
  const html = read(page);
  test(`${page}: no emoji in html`, () => {
    const m = html.match(EMOJI);
    assert.ok(!m, `emoji ${m && m[0]}`);
  });
  test(`${page}: no inline style colours`, () => {
    const bad = [...html.matchAll(/\sstyle\s*=\s*["']([^"']*)["']/gi)].map(m => m[1]).filter(s => /color|background|#/i.test(s));
    assert.deepStrictEqual(bad, []);
  });
  test(`${page}: icons resolve against /assets/icons/sprite.svg`, () => {
    const sprite = read('assets/icons/sprite.svg');
    const refs = [...html.matchAll(/sprite\.svg#(i-[\w-]+)/g)].map(m => m[1]);
    assert.deepStrictEqual(refs.filter(r => !sprite.includes(`id="${r}"`)), []);
    assert.ok(!/["']\.\.?\/assets\/icons\/sprite/.test(html), 'sprite paths must be root-absolute');
  });
}

// The chat-PDF document (script.js chatSaveDoc/chatSavePdf) is rendered in its own
// iframe with its own print CSS; colours there are exempt.
function studentJs() {
  let src = ['scripts/script.js', 'scripts/contest.js', 'scripts/shell.js'].map(read).join('\n');
  const i = src.indexOf('function chatSaveDoc(');
  if (i >= 0) { const j = src.indexOf('\n    function ', src.indexOf('\n    }\n', i)); src = src.slice(0, i) + src.slice(j); }
  // html2canvas paints the PDF page white whatever the screen theme (chatSavePdf).
  src = src.replace("backgroundColor: '#ffffff'", '');
  return src.replace(/^\s*\/\/.*$/gm, '');
}

test('no emoji in student js strings', () => {
  const found = [...studentJs().matchAll(/(?![\u00a9\u00ae\u2122])\p{Extended_Pictographic}/gu)].map(m => m[0]);
  assert.deepStrictEqual([...new Set(found)], []);
});

test('no colour in js', () => {
  const bad = [...studentJs().matchAll(/style\.(?:color|background(?:Color)?)\s*=|--ramp-|--fill-|--tint-|#[0-9a-fA-F]{6}\b/g)].map(m => m[0]);
  assert.deepStrictEqual(bad, []);
});

test('no old-only classes in student markup', () => {
  const OLD = ['form-input', 'badge-green', 'badge-purple', 'welcome-banner', 'stat-card', 'pw-emoji', 'ct-emoji', 'db-empty', 'quiz-card'];
  const sources = STUDENT_PAGES.map(read).join('\n') + studentJs();
  assert.deepStrictEqual(OLD.filter(c => new RegExp(`(?<![\\w-])${c}(?![\\w-])`).test(sources)), []);
});

test('admin files untouched', () => {
  const changed = Object.entries(ADMIN_HASHES).filter(([f, h]) => crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, f))).digest('hex') !== h).map(([f]) => f);
  assert.deepStrictEqual(changed, []);
});

test('css is a fork of the prototype', () => {
  assert.ok(exists('css/tokens.css'), 'missing css/tokens.css');
  const names = src => new Set([...src.matchAll(/--([\w-]+)\s*:/g)].map(m => m[1]));
  const proto = names(read('ui_redesign/css/tokens.css'));
  const live = names(read('css/tokens.css'));
  assert.deepStrictEqual([...proto].filter(n => !live.has(n)), []);
  for (const f of CSS) assert.ok(exists(f.slice(1)), `missing ${f}`);
});

module.exports = { STUDENT_PAGES, FRAMES, MIGRATED };
