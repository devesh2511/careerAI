// Static checks for the ui_redesign prototype. Run: npm run lint (in ui_redesign/tools)
//
// The manifest (../screens.json) is the source of truth: every screen it lists
// must exist, expose exactly its states, and carry the live-site hook IDs the
// spec's Appendix A requires. The rest of the checks enforce the spec's global
// rules: tokens only, no inline styles, no CDN, no emoji icons.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, loadManifest, readScreen, templates, idsIn, staticBody, parseHook } = require('./manifest.js');

const screens = loadManifest();
const rel = (...p) => path.join(ROOT, ...p);
const list = dir => (fs.existsSync(rel(dir)) ? fs.readdirSync(rel(dir)).map(f => path.join(dir, f)) : []);
const read = f => fs.readFileSync(rel(f), 'utf8');

const cssFiles = list('css').filter(f => f.endsWith('.css'));
const jsFiles = list('js').filter(f => f.endsWith('.js'));
const screenFiles = screens.map(s => s.file).filter(f => fs.existsSync(rel(f)));
const pageFiles = [...screenFiles, ...(fs.existsSync(rel('index.html')) ? ['index.html'] : [])];

// Spec §3.1 token contract (+ --on-pastel from the plan's Global Constraints).
const TOKENS = ['paper', 'surface', 'sunk', 'ink', 'muted', 'line', 'line-soft', 'accent', 'accent-text',
  'accent-weak', 'hl', 'ok', 'ok-weak', 'warn', 'warn-weak', 'bad', 'bad-weak', 'shadow',
  'r', 'i', 'a', 's', 'e', 'c', 'on-pastel'];

const HEX = /(?<![\w&-])#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})(?![\w-])/i;
const FUNC_COLOUR = /\b(?:rgba?|hsla?)\(/i;
function stripNonColourHashes(src) {
  return src
    .replace(/href\s*=\s*["']#[^"']*["']/gi, '')
    .replace(/url\(\s*["']?#[^)]*\)/gi, '')
    .replace(/sprite\.svg#[\w-]+/g, '')
    .replace(/\b(?:id|for|aria-controls|aria-labelledby|aria-describedby)\s*=\s*["'][^"']*["']/gi, '')
    .replace(/&#x?[0-9a-f]+;/gi, '');
}
const EXTERNAL = /(?:\bsrc\s*=\s*["']|url\(\s*["']?|@import\s+(?:url\()?["']?|<link\b[^>]*\bhref\s*=\s*["'])(?:https?:)?\/\//i;
const EMOJI = /(?![©®™])\p{Extended_Pictographic}/u;

for (const s of screens) {
  test(`${s.id}: screen file exists`, () => {
    assert.ok(fs.existsSync(rel(s.file)), `missing ${s.file}`);
  });
  if (!fs.existsSync(rel(s.file))) continue;
  const html = readScreen(s);
  const tpls = templates(html);
  const body = staticBody(html);

  test(`${s.id}: states match manifest`, () => {
    assert.deepStrictEqual(tpls.map(t => t.state), s.states);
  });

  test(`${s.id}: hook ids present per state`, () => {
    const missing = [];
    for (const raw of s.hooks) {
      const h = parseHook(raw);
      if (h.dom) continue;
      for (const t of tpls) {
        if (h.states && !h.states.includes(t.state)) continue;
        if (!idsIn(t.html + body).has(h.id)) missing.push(`${h.id} @ ${t.state}`);
      }
    }
    assert.deepStrictEqual(missing, []);
  });

  test(`${s.id}: ids unique within a state`, () => {
    const dupes = [];
    for (const t of tpls) {
      const all = [...(t.html + body).matchAll(/\sid\s*=\s*["']([^"']+)["']/g)].map(m => m[1]);
      const seen = new Set();
      for (const id of all) { if (seen.has(id)) dupes.push(`${id} @ ${t.state}`); seen.add(id); }
    }
    assert.deepStrictEqual(dupes, []);
  });

  test(`${s.id}: no inline styles`, () => {
    assert.ok(!/\sstyle\s*=/i.test(html), 'found style="" attribute');
  });

  test(`${s.id}: no emoji`, () => {
    const m = html.match(EMOJI);
    assert.ok(!m, `found emoji ${m && m[0]}`);
  });

  test(`${s.id}: head theme snippet first`, () => {
    const head = (html.match(/<head[\s\S]*?<\/head>/i) || [''])[0];
    const script = head.search(/<script\b/i);
    const link = head.search(/<link\b[^>]*rel\s*=\s*["']stylesheet/i);
    assert.ok(script >= 0 && link >= 0 && script < link, 'first <script> must precede the first stylesheet');
    const first = head.slice(script).match(/<script\b[^>]*>([\s\S]*?)<\/script>/i);
    assert.ok(first && first[1].includes('careerai_theme'), 'first script must be the theme snippet');
  });
}

test('no raw colours outside tokens.css', () => {
  const offenders = [];
  for (const f of [...pageFiles, ...jsFiles, ...cssFiles.filter(f => !f.endsWith('tokens.css'))]) {
    const src = stripNonColourHashes(read(f));
    if (HEX.test(src) || FUNC_COLOUR.test(src)) offenders.push(`${f}: ${(src.match(HEX) || src.match(FUNC_COLOUR))[0]}`);
  }
  assert.deepStrictEqual(offenders, []);
});

test('no external urls', () => {
  const offenders = [...pageFiles, ...jsFiles, ...cssFiles].filter(f => EXTERNAL.test(read(f)));
  assert.deepStrictEqual(offenders, []);
});

test('tokens complete', () => {
  assert.ok(fs.existsSync(rel('css/tokens.css')), 'missing css/tokens.css');
  const css = read('css/tokens.css');
  const block = sel => {
    const i = css.indexOf(sel);
    assert.ok(i >= 0, `no ${sel} block`);
    return css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i));
  };
  for (const [name, sel] of [['light', ':root'], ['dark', '[data-theme="dark"]']]) {
    const b = block(sel);
    const missing = TOKENS.filter(t => !new RegExp(`--${t}\\s*:`).test(b));
    assert.deepStrictEqual(missing, [], `${name} theme missing tokens`);
  }
});

test('every css var used is defined', () => {
  assert.ok(cssFiles.length, 'no css files yet');
  const tokens = fs.existsSync(rel('css/tokens.css')) ? read('css/tokens.css') : '';
  const defs = src => new Set([...src.matchAll(/--([\w-]+)\s*:/g)].map(m => m[1]));
  const global = defs(tokens);
  const undef = [];
  for (const f of cssFiles) {
    const src = read(f);
    const local = defs(src);
    for (const m of src.matchAll(/var\(\s*--([\w-]+)/g)) {
      if (!global.has(m[1]) && !local.has(m[1])) undef.push(`${f}: --${m[1]}`);
    }
    for (const m of src.matchAll(/--([\w-]+)\s*:\s*var\(\s*--([\w-]+)\s*\)/g)) {
      if (m[1] === m[2]) undef.push(`${f}: --${m[1]} refers to itself`);
    }
  }
  assert.deepStrictEqual([...new Set(undef)], []);
});

test('icons resolve', () => {
  const refs = new Set();
  for (const f of [...pageFiles, ...jsFiles]) for (const m of read(f).matchAll(/sprite\.svg#(i-[\w-]+)/g)) refs.add(m[1]);
  if (!refs.size) return;
  const sprite = read('assets/icons/sprite.svg');
  const missing = [...refs].filter(id => !sprite.includes(`id="${id}"`));
  assert.deepStrictEqual(missing, []);
});

test('illustrations licensed', () => {
  const refs = new Set();
  for (const f of [...pageFiles, ...jsFiles, ...cssFiles]) for (const m of read(f).matchAll(/illustrations\/([\w-]+\.webp)/g)) refs.add(m[1]);
  if (!refs.size) return;
  const lic = read('assets/illustrations/LICENSES.md');
  const missing = [...refs].filter(f => !lic.includes(f) || !fs.existsSync(rel('assets/illustrations', f)));
  assert.deepStrictEqual(missing, []);
});
