// Explore, career detail and roadmap (port of the prototype app reading screens).
const notFound = { status: 404, json: { error: { code: 'not_found', message: 'No roadmap for that career yet.' } } };
const noQuiz = { 'GET /me/career-quiz/latest': { status: 200, json: { result: null } } };
const A = { page: 'pages/app.html' };
module.exports = [
  { id: 'explore-grid', ...A, hash: '#/explorer', ready: '#explore-grid .explore-card' },
  { id: 'explore-drawer-open', ...A, hash: '#/explorer', ready: '#explore-grid .explore-card',
    after: async p => { await p.click('#ex-filter-btn'); await p.waitForFunction(() => document.body.classList.contains('ex-filters-open')); await p.waitForTimeout(350); } },
  { id: 'explore-active-filters', ...A, hash: '#/explorer', ready: '#explore-grid .explore-card',
    after: async p => { await p.fill('#ex-search', 'engineer'); await p.waitForSelector('#ex-active .chip'); } },
  { id: 'explore-no-results', ...A, hash: '#/explorer', ready: '#explore-grid .explore-card',
    after: async p => { await p.fill('#ex-search', 'astronaut chef'); await p.waitForSelector('#explore-grid .ex-none'); } },
  { id: 'detail-full', ...A, hash: '#/careerdetail', ready: '#cd-timeline .tl-item' },
  { id: 'detail-no-roadmap', ...A, hash: '#/careerdetail', ready: '#cd-body #cd-rm-note', stubs: { 'GET /roadmap': notFound },
    after: async p => { await p.waitForFunction(() => /still writing/.test(document.getElementById('cd-rm-note').textContent)); } },
  { id: 'roadmap-timeline', ...A, hash: '#/roadmap', ready: '#rm-timeline .tl-item' },
  { id: 'roadmap-not-written', ...A, hash: '#/roadmap', ready: '#rm-note:not([hidden])', stubs: { 'GET /roadmap': notFound },
    after: async p => { await p.waitForFunction(() => /still writing/.test(document.getElementById('rm-note').textContent)); } },
  { id: 'roadmap-no-quiz', ...A, hash: '#/roadmap', ready: '#rm-note:not([hidden])', stubs: noQuiz },
];
