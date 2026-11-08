// Stubbed API for the browser tests. On localhost the site calls
// https://careerapi.vercel.app directly (scripts/careerapi_mock.js:30-39) and
// /chat/* on its own origin; both are answered here, so every state is
// deterministic and no real account is touched.
//
//   await stubApi(page, overrides)
//   overrides: { "GET /me/career-quiz/latest": { status: 200, json: { result: null } },
//                "GET /me/access": { abort: true },
//                "POST /chat/messages": { status: 200, sse: [{ event, data }] },
//                "GET /careers": { delay: 2000 } }        // delay merges with the default
// page.__unstubbed collects "METHOD /path" keys that had no stub (answered 404).
const fs = require('node:fs');
const path = require('node:path');

const DEFAULTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'default.json'), 'utf8'));
const { RIASEC_CAREERS } = require('../fixtures/riasec_careers.js');
DEFAULTS['GET /careers'] = { status: 200, json: { careers: RIASEC_CAREERS } };

function cors(origin) {
  return {
    'access-control-allow-origin': origin || '*',
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}

async function stubApi(page, overrides = {}) {
  page.__unstubbed = page.__unstubbed || [];
  const handler = async route => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const origin = (await req.headerValue('origin')) || undefined;
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors(origin) });
    const key = `${method} ${url.pathname}`;
    const base = DEFAULTS[key];
    const over = overrides[key];
    const spec = over ? { ...(over.delay && !over.json && !over.sse ? base : {}), ...over } : base;
    if (!spec) {
      page.__unstubbed.push(key);
      return route.fulfill({ status: 404, headers: { ...cors(origin), 'content-type': 'application/json' }, body: JSON.stringify({ error: { code: 'not_found', message: `Not stubbed: ${key}` } }) });
    }
    if (spec.delay) await new Promise(r => setTimeout(r, spec.delay));
    if (spec.abort) return route.abort('failed');
    if (spec.sse) {
      const body = spec.sse.map(e => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`).join('');
      return route.fulfill({ status: spec.status || 200, headers: { ...cors(origin), 'content-type': 'text/event-stream' }, body });
    }
    return route.fulfill({ status: spec.status || 200, headers: { ...cors(origin), 'content-type': 'application/json' }, body: JSON.stringify(spec.json ?? {}) });
  };
  await page.route('https://careerapi.vercel.app/**', handler);
  await page.route(/\/chat\/[^/]+$/, handler);
}

module.exports = { stubApi, DEFAULTS };
