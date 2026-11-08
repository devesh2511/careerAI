// Onboarding, evaluation, career quiz, AI loading (port of the prototype step-flow screens).
const seedAnswers = () => {
  const answers = Array.from({ length: 25 }, () => ({ indices: [0] }));
  sessionStorage.setItem('careerai_state', JSON.stringify({ cqAnswers: answers, cqIdx: 25 }));
};
const O = { page: 'pages/onboarding.html' };
module.exports = [
  { id: 'onboarding-step-1', ...O, ready: '#ob-step-1:not([hidden]) #ob-class' },
  { id: 'onboarding-step-2', ...O, hash: '#/step/2', ready: '#ob-step-2:not([hidden]) [data-subject]' },
  { id: 'onboarding-step-3', ...O, hash: '#/step/3', ready: '#ob-step-3:not([hidden]) #ob-subjects' },
  { id: 'onboarding-step-4', ...O, hash: '#/step/4', ready: '#ob-step-4:not([hidden]) #ob-pref' },
  { id: 'onboarding-error', ...O, hash: '#/step/2', ready: '#ob-step-2:not([hidden]) [data-subject="Science"]',
    after: async p => { await p.fill('[data-subject="Science"]', '112'); await p.click('#ob-next'); await p.waitForFunction(() => document.getElementById('ob-error').textContent.trim()); } },
  { id: 'evaluation-summary', page: 'pages/evaluation.html', ready: '#eval-body .kv' },
  { id: 'quiz-question', page: 'pages/career_quiz.html', ready: '#cq-opts .cq-opt', after: async p => { await p.click('#cq-opts .cq-opt'); } },
  { id: 'quiz-at-cap', page: 'pages/career_quiz.html', ready: '#cq-opts .cq-opt',
    after: async p => { const o = p.locator('#cq-opts .cq-opt'); await o.nth(0).click(); await o.nth(1).click(); } },
  { id: 'quiz-nothing-selected', page: 'pages/career_quiz.html', ready: '#cq-opts .cq-opt',
    after: async p => { await p.click('#cq-next-btn'); await p.waitForSelector('#cq-hint.form-error'); await p.waitForTimeout(500); } },
  { id: 'ailoading-in-progress', page: 'pages/ai_loading.html', init: seedAnswers, ready: '#al-step3.loading', stubs: { 'POST /me/career-quiz': { delay: 20000 } } },
  { id: 'ailoading-error', page: 'pages/ai_loading.html', init: seedAnswers, ready: '#al-error:not([hidden])', stubs: { 'POST /me/career-quiz': { status: 500, json: { error: { code: 'server_error', message: 'Save failed' } } } } },
];
