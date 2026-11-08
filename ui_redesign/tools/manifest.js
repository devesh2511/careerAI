// Shared helpers for the prototype tests: the screens.json manifest and
// small HTML readers. Regex-based on purpose — screen files are hand-written
// and simple, and the tools stay dependency-free apart from the browser.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const WIDTHS = [320, 360, 390, 768, 1024, 1280, 1440];
const DEFAULT_VIEWPORTS = WIDTHS.map(w => [w, 800]);

function loadManifest() {
  const screens = JSON.parse(fs.readFileSync(path.join(ROOT, 'screens.json'), 'utf8'));
  return screens.map(s => ({ viewports: DEFAULT_VIEWPORTS, hooks: [], ...s }));
}

function readScreen(screen) {
  return fs.readFileSync(path.join(ROOT, screen.file), 'utf8');
}

// [{ state, label, bodyClass, html }] in document order.
function templates(html) {
  return [...html.matchAll(/<template\b([^>]*)>([\s\S]*?)<\/template>/gi)]
    .map(m => {
      const attr = name => (m[1].match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i')) || [])[1];
      return { state: attr('data-state'), label: attr('data-label'), bodyClass: attr('data-body-class') || '', html: m[2] };
    })
    .filter(t => t.state);
}

// The <body> markup outside every <template> (shared by all states).
function staticBody(html) {
  const body = (html.match(/<body\b[\s\S]*<\/body>/i) || [''])[0];
  return body.replace(/<template\b[\s\S]*?<\/template>/gi, '');
}

function idsIn(html) {
  return new Set([...html.matchAll(/\sid\s*=\s*["']([^"']+)["']/g)].map(m => m[1]));
}

// "id" | "id@a,b" (only in states a and b) | "id!dom" (rendered by JS).
function parseHook(raw) {
  const dom = raw.endsWith('!dom');
  const [id, states] = raw.replace(/!dom$/, '').split('@');
  return { id, dom, states: states ? states.split(',').map(x => x.trim()) : null };
}

module.exports = { ROOT, WIDTHS, DEFAULT_VIEWPORTS, loadManifest, readScreen, templates, staticBody, idsIn, parseHook };
