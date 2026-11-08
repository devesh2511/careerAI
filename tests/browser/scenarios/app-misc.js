// Career Space and Settings (port of ui_redesign/screens/{career-space,settings}.html).
const D = require('../fixtures/default.json');
const news = D['GET /career-news'].json;
const emptyNews = { ...news, categories: news.categories.map(c => ({ ...c, items: [] })) };
const withSchool = { status: 200, json: { student: { ...D['GET /me'].json.student, school: { name: 'Vidya Valley School', school_code: 'VVS-PUNE' } } } };
const schoolAccess = { status: 200, json: { has_access: true, source: 'school', reason: null, school: { name: 'Vidya Valley School' }, ends_at: '2027-03-31T18:30:00.000Z', plan: null } };
const A = { page: 'pages/app.html' };
const S = { ...A, hash: '#/settings', ready: '#st-plan-badge:not(:empty)' };
module.exports = [
  { id: 'space-feed', ...A, hash: '#/space', ready: '#sp-feed .sp-item' },
  { id: 'space-tab-switched', ...A, hash: '#/space', ready: '#sp-feed .sp-item',
    after: async p => { await p.click('#sp-tabs .filter-chip:nth-child(3)'); await p.waitForTimeout(200); } },
  { id: 'space-error', ...A, hash: '#/space', ready: '#sp-note:not([hidden]) .sp-retry', stubs: { 'GET /career-news': { status: 500, json: { error: { code: 'server_error', message: 'The news service is down.' } } } } },
  { id: 'space-empty', ...A, hash: '#/space', ready: '#sp-note:not([hidden])', stubs: { 'GET /career-news': { status: 200, json: emptyNews } } },
  { id: 'settings-view', ...S },
  { id: 'settings-edit-name', ...S, after: async p => { await p.click('[onclick="stEditName()"]'); await p.waitForSelector('#st-name-input'); } },
  { id: 'settings-edit-school', ...S, after: async p => { await p.click('[onclick="stEditSchool()"]'); await p.waitForSelector('#st-code'); } },
  { id: 'settings-edit-class', ...S, after: async p => { await p.click('[onclick="stEditClass()"]'); await p.waitForSelector('#st-city-input'); } },
  { id: 'settings-remove-school-warning', ...S, stubs: { 'GET /me': withSchool, 'GET /me/access': schoolAccess },
    after: async p => { await p.click('[onclick="stEditSchool()"]'); await p.click('[onclick="stConfirmRemoveSchool()"]'); await p.waitForSelector('#st-school-warn .alert'); } },
];
