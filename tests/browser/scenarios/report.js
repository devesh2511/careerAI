// Career results report (port of ui_redesign/screens/career-results.html).
const old = require('../fixtures/latest-old.json');
const R = { page: 'pages/career_results.html', ready: '#air-careers .air-career-card' };
module.exports = [
  { id: 'report-full', ...R },
  { id: 'report-old-result', ...R, ready: '#air-retake:not([hidden]) .btn', stubs: { 'GET /me/career-quiz/latest': { status: 200, json: old } } },
];
