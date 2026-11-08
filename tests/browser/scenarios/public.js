// Landing, auth and paywall (port of ui_redesign/screens/{landing,auth,paywall}.html).
const err = (status, code, message, field) => ({ status, json: { error: { code, message, ...(field ? { field } : {}) } } });
const noAccess = (reason, school) => ({ status: 200, json: { has_access: false, reason, source: null, school: school || null, ends_at: null, plan: null } });
const school = { name: 'Vidya Valley School', code: 'VVS-PUNE' };
const A = { page: 'pages/auth.html', loggedIn: false };
const P = { page: 'pages/paywall.html' };

async function forgotThenReset(page) {
  await page.fill('#forgot-email', 'aarav.m@gmail.com');
  await page.click('#forgot-btn');
  await page.waitForSelector('#auth-reset:not([hidden])');
}

module.exports = [
  { id: 'landing-default', page: 'index.html', loggedIn: false, ready: '.landing-hero' },
  { id: 'auth-login', ...A, ready: '#auth-login:not([hidden]) #login-btn' },
  { id: 'auth-login-error', ...A, ready: '#auth-login:not([hidden]) #login-btn',
    stubs: { 'POST /auth/login': err(401, 'invalid_credentials', "That email and password don't match. Check them, or reset your password.") },
    after: async p => { await p.fill('#login-email', 'aarav.m@gmail.com'); await p.fill('#login-password', 'notebook1'); await p.click('#login-btn'); await p.waitForFunction(() => document.getElementById('login-alert').textContent.trim()); } },
  { id: 'auth-register-errors', ...A, hash: '#register', ready: '#auth-register:not([hidden]) #reg-btn',
    stubs: { 'POST /auth/register': err(409, 'email_taken', 'That email already has an account. Log in instead.', 'email') },
    after: async p => { await p.fill('#reg-full_name', 'Aarav Mehta'); await p.fill('#reg-email', 'aarav.m@gmail.com'); await p.fill('#reg-password', 'notebook12'); await p.fill('#reg-confirm', 'notebook1'); await p.click('#reg-btn'); await p.waitForTimeout(300); } },
  { id: 'auth-forgot', ...A, hash: '#forgot', ready: '#auth-forgot:not([hidden]) #forgot-btn' },
  { id: 'auth-reset', ...A, hash: '#forgot', ready: '#forgot-btn', stubs: { 'POST /auth/forgot-password': { status: 200, json: { ok: true } } }, after: forgotThenReset },
  { id: 'auth-success', ...A, hash: '#forgot', ready: '#forgot-btn',
    stubs: { 'POST /auth/forgot-password': { status: 200, json: { ok: true } }, 'POST /auth/reset-password': { status: 200, json: { ok: true } } },
    after: async p => { await forgotThenReset(p); await p.fill('#reset-code', '123456'); await p.fill('#reset-new_password', 'notebook12'); await p.fill('#reset-confirm', 'notebook12'); await p.click('#reset-btn'); await p.waitForFunction(() => document.getElementById('login-ok').textContent.trim()); } },
  { id: 'paywall-checking', ...P, ready: '#pw-root .spinner', stubs: { 'GET /me/access': { delay: 4000 } } },
  { id: 'paywall-no-school', ...P, ready: '#pw-code', stubs: { 'GET /me/access': noAccess('no_school') } },
  { id: 'paywall-not-on-roster', ...P, ready: '#pw-school-slot', stubs: { 'GET /me/access': noAccess('not_on_roster', school) } },
  { id: 'paywall-not-subscribed', ...P, ready: '#pw-school-slot', stubs: { 'GET /me/access': noAccess('school_not_subscribed', school) } },
  { id: 'paywall-all-set', ...P, ready: '#pw-ok-title' },
  { id: 'paywall-error', ...P, ready: '.pw-center[role="alert"]', stubs: { 'GET /me': err(500, 'server_error', 'Something went wrong on our side.') } },
];
