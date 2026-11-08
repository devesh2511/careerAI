// Dashboard and Career Matches (port of ui_redesign/screens/{dashboard,career-matches}.html).
const none = require('../fixtures/latest-none.json');
const noQuiz = { 'GET /me/career-quiz/latest': { status: 200, json: { result: null } } };
const A = { page: 'pages/app.html' };
module.exports = [
  { id: 'dashboard-before-quiz', ...A, hash: '#/dashboard', ready: '#db-main .hero-card', stubs: noQuiz },
  { id: 'dashboard-with-results', ...A, hash: '#/dashboard', ready: '#db-top-title' },
  { id: 'matches-list', ...A, hash: '#/results', ready: '#career-list .career-card' },
  { id: 'matches-filtered', ...A, hash: '#/results', ready: '#results-filter .filter-chip[data-cat="Engineering"]',
    after: async p => { await p.click('#results-filter .filter-chip[data-cat="Engineering"]'); } },
  { id: 'matches-loading', ...A, hash: '#/results', ready: '#career-list .skeleton-card', stubs: { 'GET /me/career-quiz/latest': { delay: 8000 } } },
  { id: 'matches-no-quiz', ...A, hash: '#/results', ready: '#career-list .empty', stubs: noQuiz },
  { id: 'matches-none-above-min', ...A, hash: '#/results', ready: '#career-list .empty', stubs: { 'GET /me/career-quiz/latest': { status: 200, json: none } } },
];
