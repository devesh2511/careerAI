// Which student pages exist, and how far each one has been migrated to the new design.
// FRAMES: <head> + shell migrated (stylesheet and theme checks).
// MIGRATED: whole page migrated (every static check).
// Each live-step task appends its pages.
const STUDENT_PAGES = [
  'index.html', 'pages/auth.html', 'pages/paywall.html', 'pages/onboarding.html', 'pages/evaluation.html',
  'pages/career_quiz.html', 'pages/ai_loading.html', 'pages/career_results.html', 'pages/app.html',
  'pages/chat.html', 'pages/quiz.html',
];
const FRAMES = ['pages/app.html', 'pages/chat.html', 'index.html', 'pages/auth.html', 'pages/paywall.html', 'pages/onboarding.html', 'pages/evaluation.html', 'pages/career_quiz.html', 'pages/ai_loading.html', 'pages/career_results.html', 'pages/quiz.html'];
const MIGRATED = ['pages/chat.html', 'pages/app.html', 'index.html', 'pages/auth.html', 'pages/paywall.html', 'pages/onboarding.html', 'pages/evaluation.html', 'pages/career_quiz.html', 'pages/ai_loading.html', 'pages/career_results.html', 'pages/quiz.html'];

module.exports = { STUDENT_PAGES, FRAMES, MIGRATED };
