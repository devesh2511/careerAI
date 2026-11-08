// Contests view (app.html#/contests) and the weekly contest (quiz.html).
const D = require('../fixtures/default.json');
const base = D['GET /contest/state'].json;
const hours = h => new Date(Date.now() + h * 3600e3).toISOString();
const contest = (status, extra = {}) => ({ id: 19, number: 19, status, opens_at: hours(-5), closes_at: hours(3), question_count: 5, points_per_question: 10, ...extra });
const state = (c, attempt = {}) => ({ status: 200, json: { ...base, server_time: new Date().toISOString(), contest: c, attempt: { ...base.attempt, ...attempt } } });
const err = (status, code, message) => ({ status, json: { error: { code, message } } });
const LIVE = { 'GET /contest/state': state(contest('open')) };
const UPCOMING = { 'GET /contest/state': state(contest('upcoming', { opens_at: hours(30), closes_at: hours(60) })) };
const SUBMITTED = { 'GET /contest/state': state(contest('open'), { status: 'submitted', started_at: hours(-1), submitted_at: hours(-0.9), answered_count: 5 }) };
const IN_PROGRESS = { 'GET /contest/state': state(contest('open'), { status: 'in_progress', started_at: hours(-0.1), answered_count: 4 }) };
const QUESTIONS = [
  { id: 'q1', area: 'Logic', text: 'Which of these is an example of an algorithm?', options: ['A recipe for making tea, step by step', 'A photo of a robot', 'A list of favourite songs', 'A school timetable'] },
  { id: 'q2', area: 'Problem-solving', text: 'A program adds up the marks in a list and crashes only for a class with no students. What is the most likely cause?', options: ['The list has too many items', 'It divides by the number of students, which is zero', 'The marks are stored as words', 'The class name is spelled wrong'] },
  { id: 'q3', area: 'Numbers', text: 'Which number is the binary 1011?', options: ['9', '11', '13', '15'] },
  { id: 'q4', area: 'Robotics', text: 'What does a robot use to sense how far away a wall is?', options: ['A speaker', 'A distance sensor', 'A battery', 'A motor'] },
  { id: 'q5', area: 'Teamwork', text: 'What does a software tester mainly do?', options: ['Writes the user manual', 'Finds and reports problems before users do', 'Designs the logo', 'Sells the software'] },
];
const ATTEMPT = { 'POST /contest/19/attempt': { status: 200, json: { contest: contest('open'), questions: QUESTIONS, answers: { q1: 0, q2: 1, q3: 1, q5: 1 } } } };
const REVIEW = { 'GET /contest/18/review': { status: 200, json: {
  contest: D['GET /leaderboard'].json.contest, attempted: true, score: 40, correct: 4, total_questions: 5, time_taken_s: 192,
  global: { rank: 14, total: 1240 }, career: { rank: 3, total: 88, name: 'Robotics & Mechatronics Engineer' },
  questions: QUESTIONS.map((q, i) => ({ ...q, correct_index: [0, 1, 1, 1, 1][i], your_index: i === 2 ? 2 : [0, 1, 1, 1, 1][i], explanation: 'Because that is how it works, step by step.' })) } } };
const A = { page: 'pages/app.html', hash: '#/contests' };
const Q = { page: 'pages/quiz.html' };
module.exports = [
  { id: 'contests-live', ...A, ready: '#lb-root .lb-status.is-live', stubs: LIVE },
  { id: 'contests-upcoming', ...A, ready: '#lb-root .lb-status.is-soon', stubs: UPCOMING },
  { id: 'contests-done', ...A, ready: '#lb-root .lb-status.is-done', stubs: SUBMITTED },
  { id: 'contests-no-contest', ...A, ready: '#lb-root .lb-status.is-soon' },
  { id: 'contests-no-career', ...A, ready: '#lb-root .empty', stubs: { 'GET /leaderboard': { status: 200, json: { ...D['GET /leaderboard'].json, locked: 'no_career' } } } },
  { id: 'contests-no-results', ...A, ready: '#lb-root .empty', stubs: { 'GET /contest/state': { status: 200, json: { ...base, published_count: 0, latest_published: null } } } },
  { id: 'contests-payment-required', ...A, ready: '#lb-root .empty', stubs: { 'GET /contest/state': err(402, 'payment_required', 'The contest needs an active plan.') } },
  { id: 'contests-signed-out', ...A, ready: '#lb-root .empty', stubs: { 'GET /contest/state': err(401, 'unauthenticated', 'Please log in.') } },
  { id: 'quiz-loading', ...Q, ready: '#ct-root .skeleton-card', stubs: { 'GET /contest/state': { delay: 8000 } } },
  { id: 'quiz-none-scheduled', ...Q, ready: '#ct-root .empty' },
  { id: 'quiz-upcoming', ...Q, ready: '#ct-root .countdown', stubs: UPCOMING },
  { id: 'quiz-intro', ...Q, ready: '#ct-root .rules', stubs: LIVE },
  { id: 'quiz-question', ...Q, hash: '#/q/3', ready: '#ct-root .quiz-option', stubs: { ...IN_PROGRESS, ...ATTEMPT } },
  { id: 'quiz-review-before-submit', ...Q, hash: '#/review', ready: '#ct-submit', stubs: { ...IN_PROGRESS, ...ATTEMPT } },
  { id: 'quiz-submitted', ...Q, ready: '#ct-root .countdown', stubs: SUBMITTED },
  { id: 'quiz-review', ...Q, query: '?review=18', ready: '#ct-root .review-q', stubs: REVIEW },
  { id: 'quiz-not-published', ...Q, query: '?review=19', ready: '#ct-root .empty', stubs: { 'GET /contest/19/review': err(403, 'not_published', 'Results unlock on Sunday at 7 pm.') } },
  { id: 'quiz-error', ...Q, ready: '#ct-root [role="alert"]', stubs: { 'GET /contest/state': err(500, 'server_error', 'Something went wrong on our side.') } },
  { id: 'quiz-payment-required', ...Q, ready: '#ct-root .empty', stubs: { 'GET /contest/state': err(402, 'payment_required', 'The contest needs an active plan.') } },
];
