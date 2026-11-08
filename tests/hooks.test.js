// Hook contract (spec §8.2, Appendix A). Run: npm test
//
// Every element ID and class the student JavaScript looks up must still exist,
// either in a student page or in markup the JavaScript itself builds. Retired
// hooks must be gone from both.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const { STUDENT_PAGES } = require('./pages-list.js');

const JS_FILES = ['scripts/script.js', 'scripts/contest.js', 'scripts/shell.js'].filter(f => fs.existsSync(path.join(ROOT, f)));
const js = JS_FILES.map(read).join('\n');
const html = STUDENT_PAGES.map(read).join('\n');

const RETIRED = ['es1', 'es2', 'es3', 'es4', 'eval-spinner', 'eval-signals'];
const DYNAMIC = {
  "'auth-'": ['auth-login', 'auth-register', 'auth-forgot', 'auth-reset'],
  "'ob-step-'": ['ob-step-1', 'ob-step-2', 'ob-step-3', 'ob-step-4'],
  "'al-step'": ['al-step1', 'al-step2', 'al-step3'],
  "'reg-'": ['reg-full_name', 'reg-email', 'reg-password', 'reg-confirm', 'reg-full_name-error', 'reg-email-error', 'reg-password-error', 'reg-confirm-error'],
};
const CLASS_HOOKS = ['page', 'nav-item', 'user-profile', 'user-avatar', 'user-name', 'theme-toggle', 'password-toggle', 'auth-tab',
  'chip', 'dot', 'cq-opt', 'cq-letter', 'al-step', 'al-step-icon', 'filter-chip', 'career-pill', 'msg', 'msg-body', 'msg-bubble',
  'msg-time', 'msg-save', 'chat-sug-text', 'chat-mem-close'];

function referencedIds() {
  const ids = new Set();
  for (const m of js.matchAll(/getElementById\(\s*['"]([\w-]+)['"]\s*\)/g)) ids.add(m[1]);
  for (const m of js.matchAll(/querySelector(?:All)?\(\s*['"]#([\w-]+)/g)) ids.add(m[1]);
  for (const [needle, expanded] of Object.entries(DYNAMIC)) if (js.includes(needle)) expanded.forEach(i => ids.add(i));
  return [...ids].filter(i => !RETIRED.includes(i));
}

function idExists(id) {
  const esc = id.replace(/[-]/g, '\\-');
  const inHtml = new RegExp(`\\sid\\s*=\\s*["']${esc}["']`).test(html);
  const inJs = new RegExp(`id\\s*=\\s*\\\\?["']${esc}\\\\?["']|\\.id\\s*=\\s*['"]${esc}['"]|['"]id['"]\\s*,\\s*['"]${esc}['"]`).test(js);
  return inHtml || inJs;
}

test('every JS-referenced id exists', () => {
  const missing = referencedIds().filter(id => !idExists(id));
  assert.deepStrictEqual(missing, []);
});

test('retired ids are gone from html and js', () => {
  const still = RETIRED.filter(id => new RegExp(`\\bid\\s*=\\s*["']${id}["']`).test(html) || js.includes(`'${id}'`) || js.includes(`"${id}"`));
  const dynamicEs = /['"]es['"]\s*\+/.test(js);
  assert.deepStrictEqual([...still, ...(dynamicEs ? ["'es' + n"] : [])], []);
});

test('class hooks still emitted', () => {
  const missing = CLASS_HOOKS.filter(c => {
    const inHtml = new RegExp(`class\\s*=\\s*["'][^"']*(?<![\\w-])${c}(?![\\w-])`).test(html);
    const inJs = new RegExp(`(?<![\\w-])${c}(?![\\w-])`).test(js.replace(/\/\/.*$/gm, ''));
    return !inHtml && !inJs;
  });
  assert.deepStrictEqual(missing, []);
});

test('stripEmoji removes pictographs', { skip: !/function stripEmoji\(/.test(read('scripts/script.js')) }, () => {
  const src = read('scripts/script.js');
  const fn = src.match(/^\s*function stripEmoji\(.*$/m)[0]; // one-line helper
  const ctx = {};
  vm.runInNewContext(fn + '\nthis.stripEmoji = stripEmoji;', ctx);
  assert.strictEqual(ctx.stripEmoji('🔬 Science Fair'), 'Science Fair');
  assert.strictEqual(ctx.stripEmoji('📘 Your Subjects'), 'Your Subjects');
  assert.strictEqual(ctx.stripEmoji('🌍 Your World'), 'Your World');
  assert.strictEqual(ctx.stripEmoji('Plain'), 'Plain');
});
