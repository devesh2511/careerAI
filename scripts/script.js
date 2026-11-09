    // ══════════════════════════════════════════════════════════════
    // ROUTER + SHARED STATE
    // Every screen lives in its own .html file and loads this one
    // script. State that used to sit in memory is persisted to
    // sessionStorage so it survives a real page navigation.
    // ══════════════════════════════════════════════════════════════
    // Paths are relative to the site root: index.html sits there, every
    // other screen lives in pages/.
    const ROUTES = {
      landing: 'index.html',
      auth: 'pages/auth.html',
      onboarding: 'pages/onboarding.html',
      evaluation: 'pages/evaluation.html',
      quiz: 'pages/quiz.html',
      app: 'pages/app.html',
      // No .html: vercel.json rewrites /pages/chat to the file, and this is
      // the address students see. Only the deployed site can chat anyway.
      chat: 'pages/chat',
      careerquiz: 'pages/career_quiz.html',
      ailoading: 'pages/ai_loading.html',
      airesults: 'pages/career_results.html',
      paywall: 'pages/paywall.html',
      adminlogin: 'pages/admin_login.html',
      admin: 'pages/admin.html'
    };

    // These are .page divs inside app.html — they still switch in place.
    const APP_PAGES = ['dashboard', 'results', 'explorer', 'careerdetail', 'roadmap', 'contests', 'settings', 'space'];

    // Which file are we on? Set via <body data-page="...">
    const CURRENT_PAGE = (document.body && document.body.dataset.page) || 'landing';
    let currentApp = CURRENT_PAGE;

    // Only the landing page sits at the site root; everything else is one
    // level down in pages/ and has to climb out before following a route.
    // Derived from data-page rather than sniffing location.pathname so the
    // folder the site happens to be deployed into can't fool it, and kept
    // relative so subfolder hosting and file:// both still work.
    const BASE = CURRENT_PAGE === 'landing' ? '' : '../';
    function routeTo(id) {
      const file = ROUTES[id];
      return file ? BASE + file : null;
    }

    // ── Shared state ──
    const STATE_KEY = 'careerai_state';
    function loadState() {
      try { return JSON.parse(sessionStorage.getItem(STATE_KEY)) || {}; }
      catch (e) { return {}; }
    }
    function saveState(patch) {
      const s = loadState();
      Object.assign(s, patch);
      try { sessionStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch (e) { /* private mode */ }
    }
    function clearState() { try { sessionStorage.removeItem(STATE_KEY); } catch (e) { } }
    // The state belongs to the student who was logged in when it was saved.
    // A different student logging in on the same tab (the last one's cookie
    // expired, so logout() never ran) must not inherit their answers, results
    // or unsaved quiz run, which cqSaveRun would post to the new account.
    // The same student logging back in keeps everything.
    function claimState(studentId) {
      if (loadState().owner !== studentId) clearState();
      saveState({ owner: studentId });
    }

    // -- Session + access --
    // Accounts live behind window.CareerAPI (scripts/careerapi_mock.js until
    // careerAPI exists). The app is all or nothing: every page in PAID_PAGES
    // stays hidden until the access check passes, and otherwise sends the
    // student to login (no session) or the paywall (no plan).
    const PAID_PAGES = ['app', 'chat', 'onboarding', 'evaluation', 'quiz', 'careerquiz', 'ailoading', 'airesults'];
    function isLoggedIn() { return !!(window.CareerAPI && CareerAPI.auth.hasSession()); }
    function requireAccess() {
      if (!window.CareerAPI) return Promise.resolve(true);
      return CareerAPI.me.access().then(a => {
        // A new tab has a valid cookie but no session flag yet, and the flag
        // is what quiz saving and the login page go by. GET /me sets it.
        if (a.has_access) return isLoggedIn() ? true : CareerAPI.me.get().then(() => true, () => true);
        redirect('paywall');
        return false;
      }, err => {
        if (err.status === 401) redirect('auth');
        else accessFailed(err);
        return false;
      });
    }
    // The access check itself failed (network, 5xx). The page stays hidden,
    // since access is unknown, so say what happened in its place and offer
    // a retry instead of leaving the student on a blank screen.
    function accessFailed(err) {
      document.body.innerHTML =
        '<main class="access-failed"><section class="card empty" role="alert">' + illo('lock', 'lg') +
        '<h1 class="empty-title">We couldn\'t check your access</h1>' +
        '<p class="empty-text">Check your internet connection and try again.' + (err && err.message ? ' (' + esc(err.message) + ')' : '') + '</p>' +
        '<div class="cluster"><button class="btn btn-primary" onclick="location.reload()">' + icon('refresh-cw') + 'Try again</button></div>' +
        '</section></main>';
      document.body.style.visibility = '';
    }

    // -- Markup helpers shared by every builder (design system: /css/*.css) --
    const SPRITE = '/assets/icons/sprite.svg';
    function icon(name, cls) { return '<svg class="' + (cls || 'icon') + '" aria-hidden="true"><use href="' + SPRITE + '#i-' + name + '"/></svg>'; }
    function illo(name, size) {
      return '<div class="illo' + (size ? ' illo-' + size : '') + '"><img src="/assets/illustrations/' + name + '-' + (size === 'lg' ? 400 : 200) + '.webp" alt=""></div>';
    }
    // Data from the API and the quiz engine carries emoji; the design never shows them.
    function stripEmoji(s) { return String(s == null ? '' : s).replace(/[\p{Extended_Pictographic}\u200d\ufe0f]/gu, '').replace(/\s+/g, ' ').trim(); }
    function fitClass(pct) { return pct >= 75 ? 'fit-strong' : pct >= 55 ? 'fit-good' : 'fit-low'; }
    function fitLabel(pct) { const p = Math.round(pct || 0); return (p >= 75 ? 'Strong fit' : p >= 55 ? 'Good fit' : 'Low fit') + ', ' + p + '%'; }

    // -- Career catalogue --
    // The careers the quiz matches against, the explorer lists and roadmaps
    // belong to live in careerAPI (GET /careers). Paid pages load them before
    // initPage(); riasec_engine.js and the rest read the RIASEC_CAREERS global.
    // Kept for the tab's session so each page change doesn't refetch them.
    window.RIASEC_CAREERS = window.RIASEC_CAREERS || [];
    const CAREERS_CACHE = 'careerai_careers';
    function loadCareers() {
      try {
        const cached = JSON.parse(sessionStorage.getItem(CAREERS_CACHE));
        if (cached && cached.length) { window.RIASEC_CAREERS = cached; return Promise.resolve(true); }
      } catch (e) { }
      if (!window.CareerAPI) return Promise.resolve(false);
      return CareerAPI.careers.list().then(r => {
        window.RIASEC_CAREERS = r.careers || [];
        try { sessionStorage.setItem(CAREERS_CACHE, JSON.stringify(window.RIASEC_CAREERS)); } catch (e) { }
        return true;
      }, () => false);
    }

    // -- Theme --
    // Stored in localStorage, not sessionStorage: a theme choice should
    // outlive the tab, unlike quiz progress. The <html data-theme> attribute
    // is what style.css keys off, and it is set by an inline snippet in every
    // page's <head> so the first paint is already correct -- without that,
    // a dark-mode user gets a white flash on every navigation.
    const THEME_KEY = 'careerai_theme';

    function storedTheme() {
      try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
    }

    function applyTheme(theme) {
      const t = theme === 'dark' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', t);
      document.querySelectorAll('.theme-toggle').forEach(b => {
        b.setAttribute('aria-pressed', String(t === 'dark'));
        b.setAttribute('title', 'Dark theme');
        if (!b.classList.contains('more-link')) b.setAttribute('aria-label', 'Dark theme');
      });
    }

    function toggleTheme() {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* private mode */ }
      applyTheme(next);
    }

    function initTheme() {
      // The head snippet already set the attribute; this re-runs applyTheme
      // only to label the toggle buttons, which do not exist that early.
      // Light is the default until the user picks dark with the toggle; the
      // OS colour-scheme preference is deliberately ignored.
      applyTheme(storedTheme() || 'light');
    }

    // ── Screen switching → real page navigation ──
    // A move the student chose adds a history entry. A redirect -- a guard
    // bouncing them to login or the paywall, an interstitial like ai_loading
    // handing on -- replaces the current entry instead, so Back never lands
    // on a page that just bounces forward again.
    function show(id, replace) {
      if (APP_PAGES.includes(id)) {
        if (CURRENT_PAGE === 'app') { appGo(appDefaultHash(id), replace); return; }  // already inside the shell
        go(routeTo('app') + appHash(id), replace);
        return;
      }
      const file = routeTo(id);
      if (file) go(file, replace);
    }
    function redirect(id) { show(id, true); }
    function go(url, replace) {
      if (replace) location.replace(url); else location.href = url;
    }

    // In-page "← Back" buttons: step back through history when the page
    // before this one was ours, else go to the fallback screen (a bookmark,
    // a link opened in a new tab).
    function goBack(fallback) {
      let ours = false;
      try { ours = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) { }
      if (ours && history.length > 1) history.back(); else show(fallback);
    }

    function logout() {
      const done = () => { clearState(); location.replace(routeTo('landing')); };
      if (window.CareerAPI) CareerAPI.auth.logout().then(done, done);
      else done();
    }

    // ── Mobile sidebar drawer (phone breakpoint only) ──
    function syncMoreButton() {
      document.querySelectorAll('.tab-more').forEach(b => b.setAttribute('aria-expanded', String(document.body.classList.contains('nav-open'))));
    }
    function toggleSidebar() { document.body.classList.toggle('nav-open'); syncMoreButton(); }
    function closeSidebar() { document.body.classList.remove('nav-open'); syncMoreButton(); }
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && document.body.classList.contains('nav-open')) closeSidebar();
    });

    // On phones the drawer is a bottom sheet: drag it down to dismiss.
    // Only from the top of its scroll, so scrolling the sheet still works.
    (function () {
      const sheet = document.querySelector('.more-sheet') || document.querySelector('.sidebar');
      if (!sheet) return;
      let y0 = null, dy = 0;
      sheet.addEventListener('touchstart', e => {
        if (!document.body.classList.contains('nav-open') || sheet.scrollTop > 0) return;
        y0 = e.touches[0].clientY; dy = 0;
      }, { passive: true });
      sheet.addEventListener('touchmove', e => {
        if (y0 === null) return;
        dy = Math.max(0, e.touches[0].clientY - y0);
        if (dy > 0) { sheet.classList.add('dragging'); sheet.style.transform = 'translateY(' + dy + 'px)'; }
      }, { passive: true });
      sheet.addEventListener('touchend', () => {
        if (y0 === null) return;
        y0 = null;
        sheet.classList.remove('dragging');
        sheet.style.transform = '';
        if (dy > 90) closeSidebar();
      });
    })();

    // ── App router (app.html) ──
    // The view, and what it is showing, live in the hash, so Back/Forward,
    // a reload and a pasted link all land in the same place:
    //   #/dashboard  #/results  #/contests  #/settings
    //   #/explorer?q=&group=&stream=&fit=&sort=
    //   #/careerdetail/<career>?from=explorer
    //   #/roadmap  (the picked career is kept in state, not the address)
    //   #/space/<career>?tab=jobs
    // The '#/' prefix matters: a bare '#dashboard' matches a real element id,
    // and the browser scroll-anchors to it on load, shoving the page down
    // under the sticky header.
    function appHash(page, arg, params) {
      const h = '#/' + page + (arg ? '/' + encodeURIComponent(arg) : '');
      const q = new URLSearchParams();
      Object.keys(params || {}).forEach(k => { if (params[k] != null && params[k] !== '') q.set(k, params[k]); });
      const qs = q.toString();
      return qs ? h + '?' + qs : h;
    }

    function appParse() {
      const raw = (location.hash || '').replace(/^#\/?/, '');
      const cut = raw.indexOf('?');
      const path = (cut === -1 ? raw : raw.slice(0, cut)).split('/').filter(Boolean);
      let page = path[0] || '';
      if (page === 'progress') page = 'contests';  // old address of this page
      let arg = null;
      try { arg = path.length > 1 ? decodeURIComponent(path.slice(1).join('/')) : null; } catch (e) { }
      const params = {};
      new URLSearchParams(cut === -1 ? '' : raw.slice(cut + 1)).forEach((v, k) => { params[k] = v; });
      return APP_PAGES.includes(page) ? { page: page, arg: arg, params: params } : { page: 'dashboard', arg: null, params: {} };
    }

    // Where the sidebar sends each view: back to whatever it showed last
    // (the explorer keeps its filters, the roadmap its career).
    function appDefaultHash(page) {
      if (page === 'explorer') return appHash('explorer', null, exParams());
      if (page === 'space') return appHash('space', spCareer, { tab: spTab === 'all' ? null : spTab });
      return appHash(page);
    }

    let appRendered = null;   // the hash currently drawn
    let appView = null;       // the .page currently shown

    // A new view (or a new career in one): its own history entry.
    function appGo(h, replace) {
      if (h === location.hash) { appRoute(true); return; }
      try { history[replace ? 'replaceState' : 'pushState']({ app: true }, '', h); }
      catch (e) { location.hash = h; return; }  // hashchange routes it
      appRoute();
    }

    // Opens a view from any page: in place inside app.html, else a
    // navigation to it.
    function appOpen(page, arg, params) {
      const h = appHash(page, arg, params);
      if (CURRENT_PAGE === 'app') appGo(h); else location.href = routeTo('app') + h;
    }

    // Filters and tabs rewrite the address of the view on screen without
    // adding entries, so Back leaves the view instead of undoing each chip.
    function appSetHash(h) {
      if (h !== location.hash) { try { history.replaceState(history.state, '', h); } catch (e) { } }
      appRendered = location.hash;
    }

    function appRoute(force) {
      // The chat used to be a view here; it is its own page now.
      if (/^#\/?chat(?![\w-])/.test(location.hash)) { redirect('chat'); return; }
      if (!force && location.hash === appRendered) return;
      const r = appParse();
      appSetHash(appHash(r.page, r.arg, r.params));  // tidy an old or hand-typed address
      const changed = r.page !== appView;
      appView = r.page;
      document.querySelectorAll('.page').forEach(p => { p.hidden = true; p.classList.remove('active'); });
      const pg = document.getElementById(r.page);
      if (pg) { pg.hidden = false; pg.classList.add('active'); }
      // Career detail has no sidebar entry of its own: light up where it was opened from.
      if (r.page === 'careerdetail') cdFrom = CD_BACK[r.params.from] ? r.params.from : null;
      const navPage = r.page === 'careerdetail' ? (cdFrom || 'results') : r.page;
      document.querySelectorAll('.nav-item, .user-profile, .tab, .more-link').forEach(n => {
        if (!n.dataset.page) return;
        const on = n.dataset.page === navPage;
        n.classList.toggle('active', on);
        if (on) n.setAttribute('aria-current', 'page'); else n.removeAttribute('aria-current');
      });
      document.querySelectorAll('.tab-more').forEach(b => b.classList.toggle('active', ['results', 'explorer', 'space', 'settings'].includes(navPage)));
      closeSidebar(); // collapse the More sheet
      // The explorer's filter drawer sits on <body>, outside the page divs.
      if (document.body.classList.contains('ex-filters-open')) exCloseFilters();
      if (changed) window.scrollTo(0, 0);
      // Sync quiz results into the page just revealed
      if (r.page === 'dashboard') syncDashboard();
      else if (r.page === 'results') syncResults();
      else if (r.page === 'explorer') syncExplorer(r.params);
      else if (r.page === 'roadmap') rmLoad(r.arg);
      else if (r.page === 'contests') syncProgress();
      else if (r.page === 'settings') syncSettings();
      else if (r.page === 'space') spLoad(r.arg, r.params.tab);
      else if (r.page === 'careerdetail') cdRender(r.arg);
    }

    // Sidebar and in-app buttons. From another page it opens app.html there;
    // a screen with a file of its own (the chat) is navigated to instead.
    function navTo(pageId) {
      if (ROUTES[pageId]) { show(pageId); return; }
      if (CURRENT_PAGE !== 'app') { location.href = routeTo('app') + appHash(pageId); return; }
      appGo(appDefaultHash(pageId));
    }

    // ── Step pages: Back steps back ──
    // Onboarding, the career quiz and the contest move between steps in
    // place. While the student is past the first step the page keeps one
    // extra history entry, a guard: the browser's Back pops it and the page
    // steps back instead of leaving, then re-arms it. The step is shown in
    // the hash (#/q/7) so a reload lands on it. One entry rather than one
    // per step, so finishing never leaves a trail of dead steps behind.
    let stepOnBack = null, stepLeaving = null;
    function stepArmed() { return !!(history.state && history.state.step); }

    // onBack() steps back and returns true, or returns false at the first step.
    function stepInit(onBack) {
      if (!stepOnBack) {
        window.addEventListener('popstate', () => {
          if (stepLeaving) { const next = stepLeaving; stepLeaving = null; next(); return; }
          if (stepArmed()) return;              // Forward onto the guard
          if (!stepOnBack()) history.back();    // nothing left to step back to: leave
        });
      }
      stepOnBack = onBack;
    }

    // Called after each step is drawn.
    function stepSync(canGoBack, hash) {
      try {
        if (canGoBack && !stepArmed()) history.pushState({ step: 1 }, '', hash);
        else history.replaceState(history.state, '', hash);
      } catch (e) { }
    }

    // Leaving the step page (finished): drop the guard first, so the next
    // page replaces this one's entry instead of stacking on top of it.
    function stepLeave(next) {
      if (!stepArmed()) { next(); return; }
      stepLeaving = next;
      history.back();
    }

    // ── Per-page init: replaces the old single-page bootstrap ──
    document.addEventListener('DOMContentLoaded', () => {
      initTheme();
      if (!PAID_PAGES.includes(CURRENT_PAGE)) { initPage(); return; }
      // Hidden, not blank: the markup is already there, it just must not be
      // seen (or a quiz started) before the server says this student has paid.
      document.body.style.visibility = 'hidden';
      Promise.all([requireAccess(), loadCareers()]).then(([ok, careers]) => {
        if (!ok) return;
        if (!careers) alert("Couldn't load the career list. Check your connection and reload the page.");
        return cqLoadSaved().then(() => {
          document.body.style.visibility = '';
          initPage();
        });
      });
    });

    // The Contests LIVE badge in the sidebar and tab bar (spec §4.2): on while a
    // contest is open. The contest state is cached for 5 minutes in the tab, so
    // moving between pages doesn't refetch it; the leaderboard passes in fresh state.
    const LIVE_KEY = 'careerai_contest_live';
    function contestIsLive(st) {
      const c = st && st.contest;
      return !!(c && c.status !== 'upcoming' && c.status !== 'closed' && Date.parse(c.closes_at) > Date.now());
    }
    function showLiveBadge(live) {
      document.querySelectorAll('.nav-live, .tab-live').forEach(el => { el.hidden = !live; });
    }
    function syncLiveBadge(state) {
      if (state) {
        const live = contestIsLive(state);
        try { sessionStorage.setItem(LIVE_KEY, JSON.stringify({ live, at: Date.now(), until: state.contest ? state.contest.closes_at : null })); } catch (e) { }
        showLiveBadge(live);
        return;
      }
      let cached = null;
      try { cached = JSON.parse(sessionStorage.getItem(LIVE_KEY)); } catch (e) { }
      if (cached && Date.now() - cached.at < 5 * 60e3) {
        showLiveBadge(cached.live && (!cached.until || Date.parse(cached.until) > Date.now()));
        return;
      }
      if (typeof ContestAPI === 'undefined') { showLiveBadge(false); return; }
      ContestAPI.getState().then(st => syncLiveBadge(st), () => showLiveBadge(false));
    }

    function initPage() {
      switch (CURRENT_PAGE) {
        case 'app': {
          // popstate covers Back/Forward, hashchange an address typed by hand;
          // appRoute skips whichever arrives second.
          window.addEventListener('popstate', () => appRoute());
          window.addEventListener('hashchange', () => appRoute());
          appRoute(true);
          syncUser();
          syncLiveBadge();
          cqInitPrint(appPrintTitle);
          break;
        }
        case 'chat':
          syncUser(); chatLoadContext(); chatInitMem(); syncLiveBadge();
          // Ready to type on a laptop; a phone keeps its keyboard down until tapped
          if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) document.getElementById('chat-input').focus();
          break;
        case 'onboarding': obInit(); break;
        case 'evaluation': startEval(); break;
        case 'quiz': ctInit(); break;
        case 'careerquiz': cqResume(); break;
        case 'ailoading': cqFinish(); break;
        case 'airesults': cqShowResults(); break;
        case 'auth': authInit(); break;
        case 'paywall': pwInit(); break;
      }
    }

    // ── Auth tabs ──
    function authTab(type) { authShow(type); }

    // ── Shared bits for account screens ──
    function esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    }
    function rupees(paise) { return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 }); }
    function longDate(iso) {
      return new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' });
    }
    function setBusy(btn, busy) {
      btn.disabled = busy;
      btn.setAttribute('aria-busy', String(busy));
    }
    function val(id) { return document.getElementById(id).value; }

    // ── Auth: login / register (pages/auth.html) ──
    function authInit() {
      // Already logged in: the gate on the next page decides dashboard vs paywall.
      if (isLoggedIn()) { redirect('dashboard'); return; }
      // The form on show is in the hash (#register, #forgot, #reset), so
      // Back steps from the reset form to forgot to login.
      window.addEventListener('popstate', () => authShow(authFromHash(), 'none'));
      ['reg-password', 'reg-confirm'].forEach(id =>
        document.getElementById(id).addEventListener('input', authCheckConfirm));
      authShow(authFromHash(), 'none');
    }

    // Live check under Re-enter password. Quiet while what's typed is still the
    // start of the password; flags the first wrong character, confirms a match.
    function authCheckConfirm() {
      const pw = val('reg-password'), confirm = val('reg-confirm');
      const input = document.getElementById('reg-confirm'), box = document.getElementById('reg-confirm-error');
      const wrong = confirm !== '' && !pw.startsWith(confirm);
      const match = confirm !== '' && confirm === pw;
      input.classList.toggle('is-invalid', wrong);
      box.classList.toggle('is-ok', match);
      box.textContent = wrong ? "The passwords don't match." : match ? 'Passwords match.' : '';
    }

    function authFromHash() {
      const h = (location.hash || '').replace(/^#\/?/, '');
      return ['register', 'forgot', 'reset'].includes(h) ? h : 'login';
    }

    // Clears the alert box and every per-field error inside one form.
    function authReset(form, alertId) {
      document.getElementById(alertId).textContent = '';
      form.querySelectorAll('.form-error').forEach(e => { e.textContent = ''; e.classList.remove('is-ok'); });
      form.querySelectorAll('.is-invalid').forEach(e => e.classList.remove('is-invalid'));
    }

    function authSubmitLogin(e) {
      e.preventDefault();
      const form = e.target, btn = document.getElementById('login-btn');
      authReset(form, 'login-alert');
      setBusy(btn, true);
      CareerAPI.auth.login({ email: val('login-email'), password: val('login-password') }).then(r => {
        claimState(r.student.id);
        redirect(r.access.has_access ? 'dashboard' : 'paywall');
      }, err => {
        setBusy(btn, false);
        document.getElementById('login-alert').textContent = err.message;
      });
    }

    function authSubmitRegister(e) {
      e.preventDefault();
      const form = e.target, btn = document.getElementById('reg-btn');
      authReset(form, 'reg-alert');
      // Caught here only: the API takes a single password and never sees this.
      if (val('reg-password') !== val('reg-confirm')) {
        return authFieldError('reg', 'reg-alert', { field: 'confirm', message: "The passwords don't match." });
      }
      setBusy(btn, true);
      CareerAPI.auth.register({
        full_name: val('reg-full_name'), email: val('reg-email'),
        password: val('reg-password'), school_code: val('reg-school_code')
      }).then(r => {
        claimState(r.student.id);
        // New students fill in onboarding next, after paying if they must.
        if (r.access.has_access) redirect('onboarding');
        else location.replace(routeTo('paywall') + '?next=onboarding');
      }, err => {
        setBusy(btn, false);
        const box = err.field && document.getElementById('reg-' + err.field + '-error');
        if (box) {
          box.textContent = err.message;
          document.getElementById('reg-' + err.field).classList.add('is-invalid');
          document.getElementById('reg-' + err.field).focus();
        } else document.getElementById('reg-alert').textContent = err.message;
      });
    }

    // ── Auth: forgot password (pages/auth.html) ──
    // login → forgot (email) → reset (code + new password) → back to login.
    // The API answers forgot-password the same way for any email, so the page
    // never says whether an account exists.
    const AUTH_RESEND_SECONDS = 60;      // the API issues at most one code a minute
    let authResetEmail = '';
    let authResendTimer = null;

    // Shows one of the four forms; the Login/Register tabs only show with theirs.
    // mode: 'push' (default) adds a history entry for it, 'replace' rewrites
    // the current one, 'none' leaves history alone (drawing what it says).
    function authShow(which, mode) {
      // The reset form needs the email a code was sent to, which a reload or
      // a Back/Forward onto it no longer has.
      if (which === 'reset' && !authResetEmail) { which = 'forgot'; mode = 'replace'; }
      if (mode !== 'none' && authFromHash() !== which) {
        try {
          history[mode === 'replace' ? 'replaceState' : 'pushState'](null, '',
            which === 'login' ? location.pathname + location.search : '#' + which);
        } catch (e) { }
      }
      document.querySelectorAll('.auth-tab').forEach((t, i) => t.classList.toggle('active', (i === 1) === (which === 'register')));
      ['login', 'register', 'forgot', 'reset'].forEach(k => { document.getElementById('auth-' + k).hidden = k !== which; });
      document.getElementById('auth-tabs').hidden = which === 'forgot' || which === 'reset';
      document.getElementById('login-ok').textContent = '';
      // A password left showing shouldn't still be showing when its form returns.
      document.querySelectorAll('.password-toggle').forEach(b => togglePassword(b, true));
      if (which === 'forgot') {
        authReset(document.getElementById('auth-forgot'), 'forgot-alert');
        const input = document.getElementById('forgot-email');
        if (!input.value) input.value = authResetEmail || val('login-email').trim();
        input.focus();
      } else if (which === 'reset') {
        authReset(document.getElementById('auth-reset'), 'reset-alert');
        document.getElementById('reset-to').textContent = authResetEmail;
        document.getElementById('reset-code').focus();
      }
    }

    // Eye button beside a password input: flips it between dots and plain text.
    function togglePassword(btn, hide) {
      const input = btn.parentElement.querySelector('input');
      const show = hide ? false : input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.setAttribute('aria-pressed', show);
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    }

    // Puts err under its field when the form has one, else in the alert box.
    function authFieldError(prefix, alertId, err) {
      const box = err.field && document.getElementById(prefix + '-' + err.field + '-error');
      if (box) {
        box.textContent = err.message;
        document.getElementById(prefix + '-' + err.field).classList.add('is-invalid');
        document.getElementById(prefix + '-' + err.field).focus();
      } else document.getElementById(alertId).textContent = err.message;
    }

    // Counts down on the Resend link so a click inside the API's cooldown
    // doesn't look like it sent a code when it silently didn't.
    function authStartResendTimer() {
      const btn = document.getElementById('reset-resend-btn');
      let left = AUTH_RESEND_SECONDS;
      clearInterval(authResendTimer);
      const tick = () => {
        btn.disabled = left > 0;
        btn.textContent = left > 0 ? 'Resend code in ' + left + 's' : 'Resend code';
        if (left-- <= 0) clearInterval(authResendTimer);
      };
      tick();
      authResendTimer = setInterval(tick, 1000);
    }

    function authSubmitForgot(e) {
      e.preventDefault();
      const form = e.target, btn = document.getElementById('forgot-btn');
      const email = val('forgot-email').trim();
      authReset(form, 'forgot-alert');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return authFieldError('forgot', 'forgot-alert', { field: 'email', message: 'Please enter a valid email.' });
      }
      authResetEmail = email;
      setBusy(btn, true);
      CareerAPI.auth.forgotPassword({ email: email }).then(() => {
        setBusy(btn, false);
        document.getElementById('auth-reset').reset();
        authShow('reset');
        authStartResendTimer();
      }, err => {
        setBusy(btn, false);
        authFieldError('forgot', 'forgot-alert', err);
      });
    }

    function authResendCode() {
      const btn = document.getElementById('reset-resend-btn');
      authReset(document.getElementById('auth-reset'), 'reset-alert');
      btn.disabled = true;
      btn.textContent = 'Sending…';
      CareerAPI.auth.forgotPassword({ email: authResetEmail }).then(() => {
        authStartResendTimer();
        document.getElementById('reset-code').focus();
      }, err => {
        btn.disabled = false;
        btn.textContent = 'Resend code';
        document.getElementById('reset-alert').textContent = err.message;
      });
    }

    function authSubmitReset(e) {
      e.preventDefault();
      const form = e.target, btn = document.getElementById('reset-btn');
      const code = val('reset-code').replace(/\s+/g, '');
      const password = val('reset-new_password');
      authReset(form, 'reset-alert');
      const bad = (field, message) => authFieldError('reset', 'reset-alert', { field: field, message: message });
      if (!/^\d{6}$/.test(code)) return bad('code', 'Enter the 6-digit code from the email.');
      if (password.length < 8) return bad('new_password', 'Password must be at least 8 characters.');
      if (password.length > 200) return bad('new_password', 'Password must be at most 200 characters.');
      if (password !== val('reset-confirm')) return bad('confirm', "The passwords don't match.");
      setBusy(btn, true);
      CareerAPI.auth.resetPassword({ email: authResetEmail, code: code, new_password: password }).then(() => {
        setBusy(btn, false);
        clearInterval(authResendTimer);
        form.reset();
        authShow('login', 'replace');
        document.getElementById('login-email').value = authResetEmail;
        document.getElementById('login-password').value = '';
        document.getElementById('login-password').focus();
        document.getElementById('login-ok').textContent = 'Password changed. Log in with your new password.';
      }, err => {
        setBusy(btn, false);
        authFieldError('reset', 'reset-alert', err);
        if (err.code === 'invalid_code') document.getElementById('reset-code').select();
      });
    }

    // ── Paywall (pages/paywall.html) ──
    // Shown whenever the access check fails. Explains why (no School ID,
    // email not on the school's list, school not paying) and how to get an
    // individual plan. There is no checkout: students pay outside the
    // website, send us the payment ID, and an admin records it, which is
    // what grants access. Payments are non-refundable.
    // Where students send their payment ID. Blank → "the Crackeer team".
    const PW_PAYMENT_CONTACT = '';
    let pwNext = 'dashboard';

    function pwInit() {
      pwNext = new URLSearchParams(location.search).get('next') === 'onboarding' ? 'onboarding' : 'dashboard';
      pwRender();
    }

    function pwRender() {
      const root = document.getElementById('pw-root');
      root.innerHTML = '<div class="card-flat pw-center" role="status"><div class="spinner"></div><p>Checking your access…</p></div>';
      Promise.all([CareerAPI.me.get(), CareerAPI.me.access()]).then(([m, a]) => {
        root.innerHTML = a.has_access ? pwAllSet(a) : pwReason(m.student, a) + pwPlans(m.student);
      }, err => {
        if (err.status === 401) { redirect('auth'); return; }
        root.innerHTML = '<section class="card-flat pw-center stack" role="alert"><h1 class="auth-title">We couldn\'t check your access</h1>' +
          '<p class="muted">' + esc(err.message) + '</p>' +
          '<div><button class="btn btn-primary" onclick="pwRender()">' + icon('refresh-cw') + 'Try again</button></div></section>';
      });
    }

    function pwSchoolForm(label) {
      return '<section class="card stack" aria-labelledby="pw-school-title">' +
        '<div class="stack-xs stack"><h2 class="card-title" id="pw-school-title">Is your school on Crackeer?</h2>' +
        '<p class="card-sub">If your school has a Crackeer plan, enter the School ID they gave you and you\'re in for free.</p></div>' +
        '<form class="pw-school-form" novalidate onsubmit="pwSetSchool(event)">' +
        '<label class="visually-hidden" for="pw-code">School ID</label>' +
        '<input class="input" id="pw-code" maxlength="20" placeholder="School ID, e.g. DPS-RKP" autocapitalize="characters" aria-describedby="pw-code-error" />' +
        '<button class="btn btn-secondary" id="pw-code-btn" type="submit">' + label + '</button></form>' +
        '<div class="form-error" id="pw-code-error" aria-live="polite"></div></section>';
    }

    function pwReason(st, a) {
      const school = a.school ? esc(a.school.name) : '';
      const actions = '<div class="cluster"><button class="btn btn-secondary btn-sm" onclick="pwRender()">Check again</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="pwShowSchoolForm()">Wrong school?</button></div>';
      const reason = (art, title, body, extra) =>
        '<section class="pw-reason" aria-labelledby="pw-title">' + illo(art) +
        '<div class="stack-sm stack"><h1 class="auth-title" id="pw-title">' + title + '</h1><p class="muted">' + body + '</p>' + (extra || '') + '</div></section>';
      if (a.reason === 'not_on_roster') {
        return reason('lock', 'You\'re not on your school\'s list yet',
          school + ' pays for its students, but <b>' + esc(st.email) + '</b> isn\'t on the list they sent us. Ask your school coordinator to add it, or get your own plan below.', actions) +
          '<div id="pw-school-slot"></div>';
      }
      if (a.reason === 'school_not_subscribed') {
        return reason('calendar', 'Your school\'s plan isn\'t active',
          school + ' hasn\'t paid for this year yet, or its plan has run out. Ask your school about it, or get your own plan below.', actions) +
          '<div id="pw-school-slot"></div>';
      }
      return reason('lock', 'Unlock Crackeer, ' + esc(st.full_name.split(' ')[0]), 'Get in free through your school, or get your own plan.') + pwSchoolForm('Check');
    }

    function pwShowSchoolForm() {
      document.getElementById('pw-school-slot').innerHTML = pwSchoolForm('Update');
      document.getElementById('pw-code').focus();
    }

    function pwSetSchool(e) {
      e.preventDefault();
      const btn = document.getElementById('pw-code-btn');
      const out = document.getElementById('pw-code-error');
      out.textContent = '';
      document.getElementById('pw-code').classList.remove('is-invalid');
      setBusy(btn, true);
      CareerAPI.me.setSchool(val('pw-code')).then(r => {
        if (r.access.has_access) { document.getElementById('pw-root').innerHTML = pwAllSet(r.access); return; }
        pwRender();
      }, err => {
        setBusy(btn, false);
        out.textContent = err.message;
        document.getElementById('pw-code').classList.add('is-invalid');
      });
    }

    function pwPlans(st) {
      const P = CareerAPI.plans, a = P.student_annual, m = P.student_monthly;
      const saving = Math.round((1 - a.amount_paise / (m.amount_paise * 12)) * 100);
      const contact = PW_PAYMENT_CONTACT ? '<b>' + esc(PW_PAYMENT_CONTACT) + '</b>' : 'the Crackeer team';
      const step = (n, title, meta) => '<li class="tl-item"><span class="tl-dot">' + n + '</span><p class="tl-title">' + title + '</p><p class="tl-meta">' + meta + '</p></li>';
      return '<div class="pw-or"><span>or get your own plan</span></div>' +
        '<div class="grid-2">' +
        '<div class="card-flat pw-plan stack-sm stack"><p class="card-title">' + esc(m.label) + '</p>' +
        '<p><span class="pw-price num">' + rupees(m.amount_paise) + '</span> <span class="muted">a month</span></p><p class="card-sub">Pay month by month. Stop any time.</p></div>' +
        '<div class="card pw-plan stack-sm stack"><div class="cluster cluster-between"><p class="card-title">' + esc(a.label) + '</p><span class="badge fit-strong">Save ' + saving + '%</span></div>' +
        '<p><span class="pw-price num">' + rupees(a.amount_paise) + '</span> <span class="muted">a year</span></p><p class="card-sub">Works out to ' + rupees(a.amount_paise / 12) + ' a month.</p></div>' +
        '</div>' +
        '<div class="card-sunk stack-sm stack"><p class="list-title">Every plan includes</p><ul class="pw-includes">' +
        ['Career quiz and your full report', 'A roadmap for every career', 'AI Chat that knows your results', 'Weekly contests and leaderboards', 'Career Space news, internships and jobs']
          .map(t => '<li>' + icon('check') + t + '</li>').join('') + '</ul></div>' +
        '<section class="stack-sm stack" aria-labelledby="pw-pay-title"><h2 class="card-title" id="pw-pay-title">How to pay</h2><ol class="timeline">' +
        step(1, 'Pay for the plan you want', 'Contact ' + contact + ' for payment details. UPI and bank transfer both work.') +
        step(2, 'Send us your payment ID', 'The UPI reference or UTR, plus the email you registered with: <b>' + esc(st.email) + '</b>.') +
        step(3, 'We switch your plan on', 'Once the payment is confirmed, press Check again.') +
        '</ol><div><button class="btn btn-primary" onclick="pwRender()">Check again</button></div>' +
        '<p class="small muted">Your plan runs from the day it\'s switched on. Payments are non-refundable.</p></section>';
    }

    function pwContinue() {
      return '<button class="btn btn-primary" onclick="show(\'' + pwNext + '\')">' +
        (pwNext === 'onboarding' ? 'Set up my profile' : 'Go to my dashboard') + '</button>';
    }

    function pwAllSet(a) {
      const how = a.source === 'school'
        ? esc(a.school.name) + ' covers your plan until <b>' + longDate(a.ends_at) + '</b>.'
        : 'Your plan is active until <b>' + longDate(a.ends_at) + '</b>.';
      return '<section class="card pw-center stack" aria-labelledby="pw-ok-title">' + illo('thumb-up', 'lg') +
        '<h1 class="auth-title" id="pw-ok-title">You\'re all set</h1><p class="muted">' + how + '</p>' + pwContinue() + '</section>';
    }

    // ── Settings: account, School ID and membership (app.html#/settings) ──
    function syncSettings() {
      if (!window.CareerAPI) return;
      stSyncProfile();
      Promise.all([CareerAPI.me.get(), CareerAPI.me.access()]).then(([m, a]) => {
        const st = m.student;
        stStudent = st;
        document.getElementById('st-name').textContent = st.full_name + ' (shown on leaderboards as ' + st.leaderboard_name + ')';
        document.getElementById('st-name-edit').innerHTML = '';
        document.getElementById('st-email').textContent = st.email;
        document.getElementById('st-school').textContent = st.school
          ? st.school.name + ', ' + st.school.school_code
          : 'Not added. Your school gives you this.';
        document.getElementById('st-school-edit').innerHTML = '';
        document.getElementById('st-plan').innerHTML = a.source === 'school'
          ? 'Covered by ' + esc(a.school.name) + ' until ' + longDate(a.ends_at)
          : esc((CareerAPI.plans[a.plan] || { label: '' }).label) + ' plan, active until ' + longDate(a.ends_at) + '. Non-refundable.';
        document.getElementById('st-plan-badge').textContent = a.source === 'school' ? 'School plan' : 'Individual';
      }, err => { if (err.status === 401) redirect('auth'); });
    }

    function stEditSchool() {
      const box = document.getElementById('st-school-edit');
      if (box.innerHTML) { box.innerHTML = ''; return; }
      box.innerHTML = '<form class="setting-edit st-edit" novalidate onsubmit="stSaveSchool(event)">' +
        '<div class="field"><label class="field-label" for="st-code">School ID</label>' +
        '<input class="input" id="st-code" maxlength="20" placeholder="e.g. DPS-RKP" autocapitalize="characters" aria-describedby="st-code-error" />' +
        '<p class="field-hint">Changing your school can change whether you\'re covered.</p><div class="form-error" id="st-code-error"></div></div>' +
        '<div id="st-school-warn"></div>' +
        '<div class="cluster"><button class="btn btn-primary btn-sm" id="st-code-btn" type="submit">Save School ID</button>' +
        (stStudent && stStudent.school ? '<button class="btn btn-danger btn-sm" type="button" onclick="stConfirmRemoveSchool()">Remove</button>' : '') +
        '<button class="btn btn-ghost btn-sm" type="button" onclick="stEditSchool()">Cancel</button></div></form>';
      document.getElementById('st-code').focus();
    }

    // Removing the School ID can lock the app, so it asks first.
    function stConfirmRemoveSchool() {
      document.getElementById('st-school-warn').innerHTML =
        '<div class="alert alert-warn" role="alert">' + icon('info') + '<div class="stack-sm stack"><span><span class="alert-title">Remove your School ID?</span> ' +
        'The app locks until you add one again or get your own plan.</span><div class="cluster">' +
        '<button class="btn btn-danger btn-sm" type="button" onclick="stSaveSchool(null)">' + icon('trash-2') + 'Remove School ID</button>' +
        '<button class="btn btn-ghost btn-sm" type="button" onclick="document.getElementById(\'st-school-warn\').innerHTML = \'\'">Keep it</button></div></div></div>';
    }

    function stSaveSchool(e) {
      if (e) e.preventDefault();
      const code = e ? val('st-code') : '';
      CareerAPI.me.setSchool(code).then(r => {
        // Losing school cover means losing access: straight to the paywall.
        if (!r.access.has_access) { show('paywall'); return; }
        syncSettings();
        syncUser();
      }, err => { document.getElementById('st-code-error').textContent = err.message; });
    }

    // ── Settings: name, and class / board / city (the onboarding profile) ──
    let stStudent = null, stProfile = null;
    const ST_BOARDS = ['CBSE', 'ICSE', 'State Board'];

    function stEditName() {
      const box = document.getElementById('st-name-edit');
      if (box.innerHTML) { box.innerHTML = ''; return; }
      box.innerHTML = '<form class="setting-edit st-edit" novalidate onsubmit="stSaveName(event)">' +
        '<div class="field"><label class="field-label" for="st-name-input">Full name</label>' +
        '<input class="input" id="st-name-input" maxlength="80" autocomplete="name" aria-describedby="st-name-error" />' +
        '<p class="field-hint">Other students see your first name and last initial.</p><div class="form-error" id="st-name-error"></div></div>' +
        '<div class="cluster"><button class="btn btn-primary btn-sm" id="st-name-btn" type="submit">Save name</button>' +
        '<button class="btn btn-ghost btn-sm" type="button" onclick="stEditName()">Cancel</button></div></form>';
      const inp = document.getElementById('st-name-input');
      inp.value = stStudent ? stStudent.full_name : '';
      inp.focus();
    }

    function stSaveName(e) {
      e.preventDefault();
      const btn = document.getElementById('st-name-btn');
      setBusy(btn, true);
      CareerAPI.me.setName(val('st-name-input')).then(() => {
        syncSettings();
        syncUser();
      }, err => {
        setBusy(btn, false);
        document.getElementById('st-name-error').textContent = err.message;
      });
    }

    // "Class 10 · CBSE · Mumbai", or '' before onboarding.
    function profileSummary(p) {
      return p ? ['Class ' + p.class, p.board, p.city].filter(Boolean).join(', ') : '';
    }

    function stSyncProfile() {
      CareerAPI.me.profile().then(r => {
        stProfile = r.profile;
        document.getElementById('st-class').textContent = profileSummary(stProfile) || 'Not added yet';
        document.getElementById('st-class-edit').innerHTML = '';
      }, err => { document.getElementById('st-class').textContent = err.message; });
    }

    function stEditClass() {
      const box = document.getElementById('st-class-edit');
      if (box.innerHTML) { box.innerHTML = ''; return; }
      const p = stProfile || {};
      const opt = (v, label, cur) => '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(label) + '</option>';
      const chev = icon('chevron-down');
      box.innerHTML = '<form class="setting-edit st-edit" novalidate onsubmit="stSaveClass(event)"><div class="grid-3">' +
        '<div class="field"><label class="field-label" for="st-class-input">Class</label><div class="select-wrap"><select class="select" id="st-class-input">' +
        opt('10', 'Class 10', String(p.class || 10)) + opt('9', 'Class 9', String(p.class || 10)) + '</select>' + chev + '</div></div>' +
        '<div class="field"><label class="field-label" for="st-board-input">Board</label><div class="select-wrap"><select class="select" id="st-board-input">' +
        opt('', 'Choose a board', p.board || '') + ST_BOARDS.map(b => opt(b, b, p.board || '')).join('') + '</select>' + chev + '</div></div>' +
        '<div class="field"><label class="field-label" for="st-city-input">City</label><input class="input" id="st-city-input" maxlength="80" autocomplete="address-level2" /></div></div>' +
        '<div class="form-error" id="st-class-error"></div>' +
        '<div class="cluster"><button class="btn btn-primary btn-sm" id="st-class-btn" type="submit">Save</button>' +
        '<button class="btn btn-ghost btn-sm" type="button" onclick="stEditClass()">Cancel</button></div></form>';
      document.getElementById('st-city-input').value = p.city || '';
      document.getElementById('st-class-input').focus();
    }

    function stSaveClass(e) {
      e.preventDefault();
      const btn = document.getElementById('st-class-btn');
      setBusy(btn, true);
      CareerAPI.me.saveProfile({
        class: Number(val('st-class-input')),
        board: val('st-board-input') || null,
        city: val('st-city-input').trim() || null
      }).then(() => {
        stSyncProfile();
        syncUser();
      }, err => {
        setBusy(btn, false);
        document.getElementById('st-class-error').textContent = err.message;
      });
    }

    // Sidebar name, avatar and class line from the logged-in account.
    function syncUser() {
      if (!window.CareerAPI) return;
      CareerAPI.me.get().then(m => {
        const n = document.querySelector('.user-name'), av = document.querySelector('.user-avatar');
        if (n) n.textContent = m.student.full_name;
        if (av) av.textContent = m.student.full_name.charAt(0).toUpperCase();
        const hi = document.getElementById('chat-hello-name');
        if (hi) hi.textContent = ' ' + m.student.full_name.split(' ')[0];
      }, () => { });
      CareerAPI.me.profile().then(r => {
        const cls = document.getElementById('user-class');
        if (cls) cls.textContent = profileSummary(r.profile);
      }, () => { });
    }

    // ── Onboarding steps ──
    let obCurrent = 1;
    const obTitles = ['About you', 'Your recent marks', 'What you enjoy', 'What you want from work'];
    const obSubs = ['So we can match careers to your board, medium and city.',
      'Optional. Percentages from your last exam help us suggest a stream. Skip any you don\'t know.',
      'Pick everything that sounds like you.', 'Last step. There are no wrong answers.'];
    function obShow(n) {
      document.getElementById('ob-step-' + obCurrent).hidden = true;
      obCurrent = Math.max(1, Math.min(4, n));
      document.getElementById('ob-step-' + obCurrent).hidden = false;
      document.getElementById('ob-count').textContent = 'Step ' + obCurrent + ' of 4';
      document.getElementById('ob-title').textContent = obTitles[obCurrent - 1];
      document.getElementById('ob-sub').textContent = obSubs[obCurrent - 1];
      document.getElementById('ob-bar').value = obCurrent;
      document.getElementById('ob-back').disabled = obCurrent <= 1;
      const dots = document.querySelectorAll('.dot');
      dots.forEach((d, i) => {
        d.className = 'dot' + (i < obCurrent - 1 ? ' done' : i === obCurrent - 1 ? ' active' : '');
        d.querySelector('.dot-mark').innerHTML = i < obCurrent - 1 ? icon('check') : String(i + 1);
        if (i === obCurrent - 1) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current');
      });
      document.getElementById('ob-next').innerHTML = obCurrent === 4 ? 'Finish' : 'Next' + icon('arrow-right');
      stepSync(obCurrent > 1, '#/step/' + obCurrent);
    }
    // Selected chip labels in a chip grid.
    function obChips(id) {
      return [...document.querySelectorAll('#' + id + ' .chip.selected')].map(c => c.textContent.trim());
    }
    function obSetChips(id, values) {
      document.querySelectorAll('#' + id + ' .chip').forEach(c =>
        c.classList.toggle('selected', (values || []).indexOf(c.textContent.trim()) !== -1));
    }
    // The answers on step n, shaped for PUT /me/profile. class goes with every
    // step because the API requires it; the other keys are only that step's.
    function obFields(n) {
      const f = { class: Number(val('ob-class')) };
      if (n === 1) {
        f.board = val('ob-board');
        f.medium = val('ob-medium');
        f.city = val('ob-city').trim() || null;
      } else if (n === 2) {
        const marks = {};
        document.querySelectorAll('#ob-step-2 [data-subject]').forEach(inp => {
          if (inp.value.trim() !== '') marks[inp.dataset.subject] = Number(inp.value);
        });
        f.marks = Object.keys(marks).length ? marks : null;
      } else if (n === 3) {
        f.favourite_subjects = obChips('ob-subjects');
        f.hobbies = obChips('ob-hobbies');
        f.dream_job = val('ob-dream').trim() || null;
      } else {
        f.career_preference = obChips('ob-pref')[0] || null;
        f.study_location = obChips('ob-loc')[0] || null;
      }
      return f;
    }
    // Fill the form from a saved profile, so coming back shows what was saved.
    function obFill(p) {
      if (!p) return;
      if (p.class) document.getElementById('ob-class').value = String(p.class);
      if (p.board) document.getElementById('ob-board').value = p.board;
      if (p.medium) document.getElementById('ob-medium').value = p.medium;
      document.getElementById('ob-city').value = p.city || '';
      document.querySelectorAll('#ob-step-2 [data-subject]').forEach(inp => {
        const m = p.marks && p.marks[inp.dataset.subject];
        inp.value = typeof m === 'number' ? m : '';
      });
      if (p.favourite_subjects) obSetChips('ob-subjects', p.favourite_subjects);
      if (p.hobbies) obSetChips('ob-hobbies', p.hobbies);
      document.getElementById('ob-dream').value = p.dream_job || '';
      if (p.career_preference) obSetChips('ob-pref', [p.career_preference]);
      if (p.study_location) obSetChips('ob-loc', [p.study_location]);
    }
    // Next saves the current step before moving on; Back doesn't save.
    function obStep(dir) {
      const btn = document.getElementById('ob-next'), errEl = document.getElementById('ob-error');
      // Not while a step is saving: the save moves on from the step it saved.
      if (btn.disabled) return;
      if (dir < 0) { obShow(obCurrent + dir); return; }
      const step = obCurrent;
      if (step === 2) {
        const bad = [...document.querySelectorAll('#ob-step-2 [data-subject]')].find(inp =>
          inp.value.trim() !== '' && !(Number(inp.value) >= 0 && Number(inp.value) <= 100));
        document.querySelectorAll('#ob-step-2 [data-subject]').forEach(inp => inp.classList.toggle('is-invalid', inp === bad));
        if (bad) { errEl.textContent = 'Marks must be between 0 and 100. Check ' + bad.dataset.subject + '.'; bad.focus(); return; }
      }
      errEl.textContent = '';
      setBusy(btn, true);
      CareerAPI.me.saveProfile(obFields(step)).then(() => {
        setBusy(btn, false);
        if (step === 4) { stepLeave(() => show('evaluation')); return; }
        // Browser Back during the save already moved the student elsewhere.
        if (obCurrent === step) obShow(step + 1);
      }, err => {
        setBusy(btn, false);
        errEl.textContent = err.message;
      });
    }
    // Called from the per-page init on onboarding.html. #/step/N reopens a step.
    function obInit() {
      const next = document.getElementById('ob-next');
      if (next) next.onclick = () => obStep(1);
      stepInit(() => { if (obCurrent <= 1) return false; obShow(obCurrent - 1); return true; });
      const m = /^#\/step\/([1-4])$/.exec(location.hash);
      obShow(m ? +m[1] : 1);
      // The saved profile arrives after the form is on screen; once the
      // student has typed or tapped anything, theirs wins.
      let touched = false;
      const root = document.getElementById('onboarding');
      ['input', 'change', 'click'].forEach(t => root.addEventListener(t, e => {
        if (e.target.closest('input, select, textarea, .chip')) touched = true;
      }, true));
      CareerAPI.me.profile().then(r => { if (!touched) obFill(r.profile); }, () => { });
    }

    // ── Chip single-select helper ──
    function chipOne(el, group) {
      el.closest('.chip-grid').querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      el.classList.add('selected');
    }

    // ── Profile at a glance (evaluation.html) ──
    // Shows what onboarding saved, so the student can check it before the quiz.
    function startEval() {
      const box = document.getElementById('eval-body');
      CareerAPI.me.profile().then(r => {
        const p = r.profile;
        if (!p) { redirect('onboarding'); return; }
        const marks = p.marks ? Object.entries(p.marks).sort((a, b) => b[1] - a[1]) : [];
        const badges = list => (list && list.length) ? '<div class="cluster">' + list.map(x => '<span class="badge badge-outline">' + esc(x) + '</span>').join('') + '</div>' : '<p class="muted">None picked</p>';
        const row = (k, v) => v ? '<dt>' + k + '</dt><dd>' + esc(v) + '</dd>' : '';
        const prefs = [p.career_preference, p.study_location ? 'Open to studying outside your city: ' + p.study_location : ''].filter(Boolean).join('. ');
        box.innerHTML =
          '<dl class="kv">' + row('Class', 'Class ' + p.class) + row('Board', p.board) + row('Medium', p.medium) + row('City', p.city) +
          (marks.length ? row('Best marks', marks[0][0] + ', ' + marks[0][1] + '%') : '') + '</dl><hr class="divider">' +
          '<div class="stack-sm stack"><p class="field-label">Subjects you like</p>' + badges(p.favourite_subjects) + '</div>' +
          '<div class="stack-sm stack"><p class="field-label">Hobbies</p>' + badges(p.hobbies) + '</div>' +
          (p.dream_job ? '<div class="stack-sm stack"><p class="field-label">Dream job</p><p>' + esc(p.dream_job) + '</p></div>' : '') +
          (prefs ? '<div class="stack-sm stack"><p class="field-label">Preferences</p><p>' + esc(prefs) + '</p></div>' : '');
      }, err => {
        if (err.status === 401) { redirect('auth'); return; }
        box.innerHTML = '<div class="alert alert-error" role="alert">' + esc(err.message) + '</div>';
      });
    }

    // ── Weekly aptitude contest (quiz.html) lives in scripts/contest.js ──

    // ── Filter chips ──
    function filterChip(el) {
      const bar = el.closest('.results-filter');
      bar.querySelectorAll('.filter-chip').forEach(c => {
        const on = c === el;
        c.classList.toggle('active', on);
        c.setAttribute('aria-checked', String(on));
      });
      rsFilter = el.dataset.cat || '';
      syncResults(true);
    }

    // ── Chat ──
    // The chatBot backend sits behind the /chat proxy in vercel.json, which
    // forwards the student cookie. A reply streams as Server-Sent Events:
    // optional sources, then delta… and done, or error. Completed turns stay
    // in page memory only and go back with every message; the backend keeps
    // no transcript. Only the deployed site can chat: locally there is no
    // proxy and the cookie belongs to careerapi.vercel.app.
    const CHAT_URL = '/chat/messages';
    // crypto.randomUUID needs a secure context (and Safari 15.4+); this runs
    // at load on every page, so a throw here would stop the rest of the file.
    // getRandomValues works everywhere, so build the v4 UUID from it instead.
    function newChatId() {
      if (window.crypto && crypto.randomUUID) {
        try { return crypto.randomUUID(); } catch (e) { }
      }
      const b = crypto.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
      return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
    }
    let chatId = newChatId();
    let chatHistory = [];
    let chatAbort = null;

    function resetChat() {
      if (chatAbort) chatAbort.abort();
      chatAbort = null;
      chatId = newChatId();
      chatHistory = [];
      setChatBusy(false);
    }
    // While a reply streams the send button turns into a stop button.
    function setChatBusy(busy) {
      const send = document.getElementById('chat-send');
      if (!send) return;
      send.classList.toggle('busy', busy);
      send.setAttribute('aria-label', busy ? 'Stop reply' : 'Send message');
      chatSyncSend();
    }
    function chatSyncSend() {
      const send = document.getElementById('chat-send'), inp = document.getElementById('chat-input');
      if (send && inp) send.classList.toggle('idle', !chatAbort && !inp.value.trim());
    }
    // The backend takes at most six exchanges, 2,000 characters per turn and
    // 12,000 in total, and rejects anything larger rather than truncating.
    function chatTurns() {
      const turns = chatHistory.slice(-12);
      while (turns.length && turns.reduce((n, t) => n + t.content.length, 0) > 12000) turns.splice(0, 2);
      return turns;
    }
    function chatError(status, code, message) {
      const e = new Error(message);
      e.status = status; e.code = code;
      return e;
    }

    async function streamChat(body, signal, on) {
      let res;
      try {
        res = await fetch(CHAT_URL, {
          method: 'POST', credentials: 'include', signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        throw chatError(0, 'network_error', "Can't reach the server. Check your connection and try again.");
      }
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        const err = data.error || {};
        throw chatError(res.status, err.code || 'server_error', err.message || 'Something went wrong. Please try again.');
      }
      const reader = res.body.getReader(), decoder = new TextDecoder();
      let buffer = '', finished = false;
      const frame = raw => {
        let name = 'message', data = '';
        for (const line of raw.split('\n')) {
          if (line.startsWith('event:')) name = line.slice(6).trim();
          else if (line.startsWith('data:')) data += line.slice(5).trim();
        }
        if (!data) return;
        const payload = JSON.parse(data);
        if (name === 'sources') on.sources(payload.items || []);
        else if (name === 'delta') on.delta(payload.text || '');
        else if (name === 'done') finished = true;
        else if (name === 'error') throw chatError(200, payload.code || 'stream_error', payload.message || 'The reply stopped unexpectedly.');
      };
      try {
        for (;;) {
          const { done, value } = await reader.read();
          buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
          buffer = buffer.replace(/\r/g, '');
          let i;
          while ((i = buffer.indexOf('\n\n')) >= 0) { frame(buffer.slice(0, i)); buffer = buffer.slice(i + 2); }
          if (done) break;
        }
        if (buffer.trim()) frame(buffer);
      } catch (err) {
        reader.cancel().catch(() => { });
        throw err;
      }
      if (!finished) throw chatError(200, 'stream_error', 'The reply stopped unexpectedly. Please try again.');
    }

    // Replies are text with light Markdown: escape first, then format.
    // Paragraphs, headings and bullet/numbered lists become real blocks so a
    // long answer reads like a document instead of one wall of <br>s.
    function renderReply(text) {
      const inline = s => esc(s)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/https:\/\/[^\s<]+[^\s<.,;:!?)'"]/g, u =>
          '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + u + '</a>');
      let html = '', list = null, para = [];
      const flush = () => { if (para.length) { html += '<p>' + para.join('<br>') + '</p>'; para = []; } };
      const close = () => { if (list) { html += '</' + list + '>'; list = null; } };
      for (const line of text.split('\n')) {
        const t = line.trim();
        let m;
        if (!t) { flush(); close(); }
        else if ((m = t.match(/^#{1,6}\s+(.*)$/))) { flush(); close(); html += '<h4>' + inline(m[1]) + '</h4>'; }
        else if ((m = t.match(/^[*•-]\s+(.*)$/))) {
          flush();
          if (list !== 'ul') { close(); html += '<ul>'; list = 'ul'; }
          html += '<li>' + inline(m[1]) + '</li>';
        }
        else if ((m = t.match(/^(\d+)[.)]\s+(.*)$/))) {
          flush();
          // A blank line between items closes the list; keep the numbering going.
          if (list !== 'ol') { close(); html += '<ol start="' + m[1] + '">'; list = 'ol'; }
          html += '<li>' + inline(m[2]) + '</li>';
        }
        else { close(); para.push(inline(t)); }
      }
      flush(); close();
      return html;
    }
    function addSources(bubble, items) {
      const links = items.filter(s => /^https:\/\//.test(s.url || ''));
      if (!links.length) return;
      const box = document.createElement('div');
      box.className = 'msg-sources';
      links.forEach((s, i) => {
        const a = document.createElement('a');
        a.className = 'msg-source';
        a.href = s.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.title = s.title || s.url;
        const n = document.createElement('b');
        n.textContent = i + 1;
        a.append(n, s.title || new URL(s.url).hostname);
        box.appendChild(a);
      });
      bubble.parentNode.insertBefore(box, bubble.nextSibling);
    }
    // Errors and notes go under the reply and its sources, above the time.
    function addChatError(bubble, message, quiet) {
      const box = document.createElement('div');
      box.className = quiet ? 'msg-note' : 'msg-error alert alert-error';
      box.textContent = message;
      bubble.parentNode.insertBefore(box, bubble.parentNode.querySelector('.msg-time'));
    }
    // Follow a streaming reply only while the student is already at the
    // bottom, so scrolling up to reread isn't yanked back down.
    function chatNearBottom(sc) { return sc.scrollHeight - sc.scrollTop - sc.clientHeight < 80; }
    function chatToBottom() {
      const sc = document.getElementById('chat-scroll');
      if (sc) sc.scrollTop = sc.scrollHeight;
    }
    function chatShowWelcome(show) {
      document.getElementById('chat-welcome').hidden = !show;
      document.getElementById('chat-new').hidden = show;
    }

    async function sendChat() {
      const inp = document.getElementById('chat-input');
      const msg = inp.value.trim();
      if (!msg || chatAbort) return;
      inp.value = '';
      chatAutosize(inp);
      inp.focus();
      chatShowWelcome(false);
      chatPlaceSave(false);
      addMsg(msg, 'user');
      const bubble = addMsg('', 'ai');
      bubble.innerHTML = '<span class="msg-typing" aria-label="Thinking"><span></span><span></span><span></span></span>';
      chatToBottom();
      const sc = document.getElementById('chat-scroll');
      const controller = new AbortController();
      const id = chatId;
      let reply = '';
      chatAbort = controller;
      setChatBusy(true);
      try {
        await streamChat({ conversation_id: id, message: msg, history: chatTurns() }, controller.signal, {
          sources: items => addSources(bubble, items),
          delta: text => {
            const stick = chatNearBottom(sc);
            reply += text;
            bubble.innerHTML = renderReply(reply);
            chatLight(chatMentions(reply));
            if (stick) sc.scrollTop = sc.scrollHeight;
          }
        });
        addMentions(bubble, chatMentions(reply));
        // Only a finished reply joins the history; a stopped one is dropped.
        if (id === chatId) {
          chatHistory.push({ role: 'user', content: msg.slice(0, 2000) },
                           { role: 'assistant', content: reply.slice(0, 2000) });
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          bubble.innerHTML = reply ? renderReply(reply) : '';
          addChatError(bubble, 'Reply stopped.', true);
          return;
        }
        if (err.status === 401) {
          // This fetch bypasses CareerAPI, so end the tab's session flag here
          // (as its http() does), or the login page would bounce straight back.
          try { sessionStorage.removeItem('careerai_session'); } catch (e) { }
          redirect('auth'); return;
        }
        if (err.status === 402) { redirect('paywall'); return; }
        bubble.innerHTML = reply ? renderReply(reply) : '';
        if (err.code === 'conversation_expired') {
          chatId = newChatId();
          chatHistory = [];
          addChatError(bubble, "This chat expired, so I've started a new one. Please send your question again.");
        } else {
          addChatError(bubble, err.message);
        }
        chatToBottom();
      } finally {
        if (chatAbort === controller) { chatAbort = null; setChatBusy(false); }
        chatLight([]);
        // newChat() mid-reply has emptied the thread, so the save has nowhere to go
        if (bubble.isConnected) chatPlaceSave(true);
      }
    }

    // ── Save this chat ──
    // One click downloads the thread on screen as a PDF. The screen is the
    // source because chatHistory caps each turn at 2,000 characters and drops
    // old turns. The browser lays the copy out in a hidden frame and
    // html2canvas draws it page by page into jsPDF: jsPDF's own text can't
    // shape Hindi or draw emoji, a picture of the browser's text can. A
    // picture can't be selected or searched, so invisible text is laid over
    // each line (as in a scanned PDF) and clickable areas over the links.
    // Both libraries and the text font are vendored in assets/vendor/ and
    // load on first click.
    const CHAT_SAVE_SKIP = new Set(('a an the i me my mine we our you your is are am was be can could ' +
      'should would will shall do does did how what which who whom whose why when where there this that ' +
      'these those it its to for of in on at by with from about into after before and or but if so as ' +
      'tell know want need get pick choose select help please like really just some any more much many ' +
      'make hi hello hey ok okay thanks thank').split(' '));
    // The file name: the first few keywords the student asked about, e.g.
    // "Which stream should I pick after Class 10?" → "Stream Class 10".
    // Later questions only fill in when the first has under two keywords.
    function chatSaveTitle() {
      const words = [];
      for (const b of document.querySelectorAll('#chat-messages .msg.user .msg-bubble')) {
        if (words.length >= 2) break;
        words.push(...b.textContent.replace(/[^\p{L}\p{M}\p{N}\s]+/gu, ' ').split(/\s+/)
          .filter(w => w && !CHAT_SAVE_SKIP.has(w.toLowerCase())));
      }
      words.splice(4);
      let title = words.map(w => w[0].toUpperCase() + w.slice(1)).join(' ').slice(0, 40).trim();
      if (words.length < 2) title = (title + ' Career Chat').trim();
      return title;
    }
    // Shows the button under the latest finished reply, or just removes it.
    function chatPlaceSave(show) {
      document.querySelectorAll('.msg-actions').forEach(n => n.remove());
      if (!show) return;
      const replies = [...document.querySelectorAll('#chat-messages .msg:not(.user) .msg-bubble')]
        .filter(b => b.textContent.trim());
      if (!replies.length) return;
      const row = document.createElement('div');
      row.className = 'msg-actions';
      const btn = document.createElement('button');
      btn.className = 'btn btn-ghost btn-sm msg-save';
      btn.setAttribute('aria-label', 'Save this chat as PDF');
      btn.innerHTML = icon('download') + '<span>Save this chat as PDF</span>';
      btn.onclick = () => chatSavePdf(btn);
      if (chatSaving) chatSaveBusy(btn, true);
      row.appendChild(btn);
      replies[replies.length - 1].closest('.msg-body').appendChild(row);
    }
    // A4 at 96 dpi: the copy is laid out 794px wide, and each PDF page holds
    // 1123px less 18mm (68px) top and bottom.
    const CHAT_PDF_W = 794, CHAT_PDF_PAGE = 1123 - 2 * 68, CHAT_PDF_MM = 210 / CHAT_PDF_W;
    let chatSaving = false;
    const chatScripts = {};
    function chatLoadScript(src) {
      return chatScripts[src] || (chatScripts[src] = new Promise((ok, fail) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = ok;
        // Forget a failed load so the next click tries again.
        s.onerror = () => { delete chatScripts[src]; s.remove(); fail(new Error('Could not load ' + src)); };
        document.head.appendChild(s);
      }));
    }
    function chatSaveBusy(btn, busy, label) {
      btn.disabled = busy;
      btn.querySelector('span').textContent = label || (busy ? 'Saving…' : 'Save this chat');
    }
    // The standalone page the PDF is drawn from, or '' for an empty thread.
    function chatSaveDoc(title) {
      const me = (document.querySelector('.user-name') || {}).textContent;
      const turns = [...document.querySelectorAll('#chat-messages .msg')].map(m => {
        const bubble = m.querySelector('.msg-bubble'), time = m.querySelector('.msg-time');
        const user = m.classList.contains('user');
        if (!bubble || !bubble.textContent.trim()) return '';
        // A user turn is plain text; a reply is already escaped by renderReply.
        return '<section class="turn' + (user ? ' user' : '') + '"><div class="who">' +
          esc(user ? (me && me.trim()) || 'You' : 'AI Career Counsellor') +
          (time ? '<span>' + esc(time.textContent) + '</span>' : '') + '</div>' +
          '<div class="text">' + (user ? esc(bubble.textContent) : bubble.innerHTML) + '</div></section>';
      }).join('');
      if (!turns) return '';
      const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>' + esc(title) + '</title><style>' +
        '*{box-sizing:border-box}html{background:#fff}' +
        'body{margin:0;padding:0 60px 1px;font:11pt/1.6 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans","Noto Sans Devanagari",sans-serif;color:#1d1b2e}' +
        'header{border-bottom:2px solid #6c63ff;padding-bottom:10px;margin-bottom:18px}' +
        '.brand{font-weight:800;font-size:15pt}.brand span{color:#6c63ff}' +
        'h1{font-size:13pt;margin:4px 0 2px}.meta{color:#6b6880;font-size:9pt}' +
        '.turn{margin:0 0 14px;padding:10px 14px;border-radius:10px;border:1px solid #e4e2f0}' +
        '.turn.user{background:#f1f0ff;border-color:#d9d6ff}' +
        '.who{font-weight:700;font-size:9pt;color:#6c63ff;margin-bottom:4px;display:flex;justify-content:space-between}' +
        '.who span{font-weight:400;color:#8a879c}.turn.user .text{white-space:pre-wrap}' +
        '.text p{margin:0 0 8px}.text h4{font-size:11.5pt;margin:12px 0 4px}' +
        '.text ul,.text ol{margin:0 0 8px;padding-left:22px}.text li{margin:3px 0}' +
        '.text>:first-child{margin-top:0}.text>:last-child{margin-bottom:0}' +
        '.text code{font-family:ui-monospace,Consolas,monospace;font-size:.9em;background:#f3f2f8;border-radius:4px;padding:0 4px}' +
        '.text a{color:#4b43d6;overflow-wrap:anywhere}' +
        'footer{margin-top:18px;color:#8a879c;font-size:8.5pt;text-align:center}' +
        '</style></head><body><header><div class="brand">Crack<span>eer</span></div>' +
        '<h1>' + esc(title) + '</h1><div class="meta">Chat with the AI Career Counsellor · ' + esc(date) + '</div></header>' +
        turns + '<footer>AI can make mistakes, so double-check admissions and fees.</footer></body></html>';
    }
    // Page breaks go under the lowest line or block that still fits, so no
    // line of text is sliced in two; only a block taller than a page is cut.
    function chatPdfPages(doc) {
      const height = doc.documentElement.scrollHeight;
      const stops = [...doc.querySelectorAll('header, .who, .text > *, .text li, .turn, footer')]
        .map(n => n.getBoundingClientRect().bottom);
      // A tall user message is one block, so let it break between its lines.
      doc.querySelectorAll('.turn.user .text').forEach(t => {
        const range = doc.createRange();
        range.selectNodeContents(t);
        [...range.getClientRects()].forEach(r => stops.push(r.bottom));
      });
      const pages = [];
      for (let top = 0; top < height - 1;) {
        let cut = top + CHAT_PDF_PAGE;
        if (cut >= height) cut = height;
        else {
          const fit = stops.filter(b => b > top + 1 && b <= cut);
          if (fit.length) cut = Math.max(...fit);
        }
        cut = Math.ceil(cut);
        pages.push({ top: Math.floor(top), bottom: cut });
        top = cut;
      }
      return pages;
    }
    // What assets/vendor/pdf-text-font.js has no glyph for, such as emoji;
    // the picture still shows it, the text layer leaves it out.
    const CHAT_PDF_NO_GLYPH = /[^ -~ -ɏऀ-ॿ᳐-᳿ -⁯₠-⃏℀-⅟←-⇿−꣠-ꣿ]/gu;
    // The copy's text as one run per line, with where the browser drew it.
    // Words a gap apart join with a space, pieces that touch (a bold word
    // and its comma) join without, and a wide gap (name … time) splits.
    function chatPdfLines(doc) {
      const lines = [], range = doc.createRange();
      const walk = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
      let line = null;
      for (let node; (node = walk.nextNode());) {
        const size = parseFloat(doc.defaultView.getComputedStyle(node.parentElement).fontSize);
        for (const m of node.data.matchAll(/\S+/g)) {
          const text = m[0].replace(CHAT_PDF_NO_GLYPH, '');
          if (!text) continue;
          range.setStart(node, m.index);
          range.setEnd(node, m.index + m[0].length);
          const r = range.getClientRects()[0];
          if (!r || !r.width) continue;
          const gap = line ? r.left - line.right : 0;
          if (line && line.size === size && Math.abs(r.top - line.top) < 2 && gap > -1 && gap < size) {
            line.text += (gap > 1 ? ' ' : '') + text;
            line.right = r.right;
          } else {
            lines.push(line = { text, size, left: r.left, right: r.right, top: r.top, height: r.height });
          }
        }
      }
      return lines;
    }
    async function chatSavePdf(btn) {
      if (chatSaving) return;
      const title = chatSaveTitle();
      const html = chatSaveDoc(title);
      if (!html) return;
      chatSaving = true;
      chatSaveBusy(btn, true);
      // Off screen at the page's real width: html2canvas draws what the frame
      // lays out, so a 0×0 frame would come out blank.
      const frame = document.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      frame.tabIndex = -1;
      frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:' + CHAT_PDF_W + 'px;height:' + CHAT_PDF_PAGE + 'px;border:0';
      try {
        await Promise.all([
          chatLoadScript(BASE + 'assets/vendor/html2canvas.min.js'),
          chatLoadScript(BASE + 'assets/vendor/jspdf.umd.min.js'),
          chatLoadScript(BASE + 'assets/vendor/pdf-text-font.js'),
          new Promise(ok => { frame.onload = ok; frame.srcdoc = html; document.body.appendChild(frame); })
        ]);
        const doc = frame.contentDocument;
        if (doc.fonts) await doc.fonts.ready;
        const height = doc.documentElement.scrollHeight;
        frame.style.height = height + 'px';
        const pages = chatPdfPages(doc);
        const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
        const k = CHAT_PDF_MM, margin = 68 * k;
        // One canvas per page: a single tall one passes Safari's canvas size
        // limit after a few pages. 3× is about 290 dpi, sharp when zoomed or
        // printed, and a page (2382×2961) stays well under that limit. PNG,
        // not JPEG: JPEG blurs and rings around the edges of letters.
        for (let i = 0; i < pages.length; i++) {
          const p = pages[i];
          const canvas = await html2canvas(doc.body, {
            x: 0, y: p.top, width: CHAT_PDF_W, height: p.bottom - p.top,
            scrollX: 0, scrollY: 0, windowWidth: CHAT_PDF_W, windowHeight: height,
            scale: 3, backgroundColor: '#ffffff', logging: false
          });
          if (i) pdf.addPage();
          pdf.addImage(canvas, 'PNG', 0, margin, 210, (p.bottom - p.top) * k, undefined, 'FAST');
          if (pages.length > 1) {
            pdf.setFontSize(8);
            pdf.setTextColor(138, 135, 156);
            pdf.text((i + 1) + ' / ' + pages.length, 105, 297 - margin / 2, { align: 'center' });
          }
        }
        // The text is a picture now, so lay the same words over it unseen,
        // each line stretched to the width the browser gave it, for copy
        // and search. Its baseline sits about 4/5 down the line's box.
        pdf.addFileToVFS('chat-text.ttf', window.CHAT_PDF_FONT);
        pdf.addFont('chat-text.ttf', 'chat-text', 'normal');
        pdf.setFont('chat-text', 'normal');
        chatPdfLines(doc).forEach(l => {
          const i = pages.findIndex(p => l.top + l.height / 2 >= p.top && l.top + l.height / 2 < p.bottom);
          if (i < 0) return;
          pdf.setPage(i + 1);
          pdf.setFontSize(l.size * k * 72 / 25.4);
          // A lone vowel sign has no width in the font; don't scale by 1/0.
          const width = pdf.getTextWidth(l.text);
          pdf.text(l.text, l.left * k, margin + (l.top + l.height * 0.8 - pages[i].top) * k, {
            renderingMode: 'invisible',
            horizontalScale: width > 0 ? (l.right - l.left) * k / width : 1
          });
        });
        // And clickable areas over the links.
        doc.querySelectorAll('a[href]').forEach(a => {
          [...a.getClientRects()].forEach(r => {
            const i = pages.findIndex(p => r.top >= p.top && r.top < p.bottom);
            if (i < 0) return;
            pdf.setPage(i + 1);
            pdf.link(r.left * k, margin + (r.top - pages[i].top) * k, r.width * k, r.height * k, { url: a.href });
          });
        });
        pdf.save(title + '.pdf');
        chatSaveBusy(btn, false);
      } catch (err) {
        console.error(err);
        chatSaveBusy(btn, false, "Couldn't save · Try again");
      } finally {
        frame.remove();
        chatSaving = false;
        // A reply that finished meanwhile moved the button; free the new one.
        document.querySelectorAll('.msg-save').forEach(b => { if (b !== btn) chatSaveBusy(b, false); });
      }
    }
    function chatSendOrStop() {
      if (chatAbort) chatAbort.abort();
      else sendChat();
    }
    // Enter sends; Shift+Enter (or an IME composition) adds a new line.
    function chatKey(e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendChat(); }
    }
    function chatAutosize(el) {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
      el.style.overflowY = el.scrollHeight > el.clientHeight ? 'auto' : 'hidden';
      chatSyncSend();
    }
    // The chat lives only in this page, so a new chat is emptying the thread,
    // bringing the welcome back and starting a new conversation id.
    function newChat() {
      resetChat();
      document.getElementById('chat-messages').innerHTML = '';
      chatShowWelcome(true);
      document.getElementById('chat-input').focus();
    }
    function sendSug(el) {
      chatAsk(el.dataset.ask || el.querySelector('.chat-sug-text').textContent);
    }
    function chatAsk(question) {
      document.getElementById('chat-input').value = question;
      sendChat();
    }

    // ── What the counsellor knows ──
    // On a chat's first message the chatBot fetches the student's profile and
    // top career matches (careerAPI GET /userContext), so the welcome line
    // and the side panel show that data and nothing the bot never sees (the
    // RIASEC scores stay out). Each fact can ask about itself, and its terms
    // are what a reply is searched for to light it up.
    let chatFacts = [];
    const CHAT_MEM_PHONE = '(max-width: 640px)';

    function chatLoadContext() {
      if (!window.CareerAPI) return;
      Promise.all([
        CareerAPI.me.profile().then(r => r.profile, () => null),
        CareerAPI.me.latestCareerQuiz().then(r => r.result, () => null)
      ]).then(([p, run]) => {
        const careers = run && run.results && Array.isArray(run.results.top_careers)
          ? run.results.top_careers.slice(0, 5) : [];
        chatFacts = chatBuildFacts(p, careers);
        chatRenderWelcome(p, careers);
        chatRenderMem(p, careers);
      });
    }

    function chatBuildFacts(p, careers) {
      const facts = [];
      const add = (key, icon, label, ask, terms, extra) =>
        facts.push(Object.assign({ key, icon, label, ask, terms: terms.filter(Boolean) }, extra));
      // chip: the shorter wording a welcome prompt shows; it still sends ask
      careers.forEach((c, i) => add('career:' + c.title, '', c.title,
        i === 0 ? 'Why is ' + c.title + ' my top match?' : 'Is ' + c.title + ' a good option for me?',
        [c.title], { badge: c.match_pct != null ? Math.round(c.match_pct) + '%' : '', rank: i + 1,
          chip: 'Why ' + c.title.split(' / ')[0] + '?' }));
      if (p) {
        add('class', '', 'Class ' + p.class + (p.board ? ' · ' + p.board : ''),
          p.class >= 10 ? 'Which stream should I pick after Class 10?' : 'What should I focus on in Class 9?',
          ['Class ' + p.class, p.board], { chip: p.class >= 10 ? 'Which stream after Class 10?' : 'What to focus on in Class 9?' });
        const a = /^[aeiou]/i.test(p.dream_job || '') ? 'an ' : 'a ';
        if (p.dream_job) add('dream', '', 'Dream: ' + p.dream_job, 'How do I become ' + a + p.dream_job + '?', [p.dream_job],
          { chip: 'How to become ' + a + p.dream_job });
        (p.favourite_subjects || []).forEach(s =>
          add('subj:' + s, '', 'Loves ' + s, 'Which careers use ' + s + '?', [s], { chip: 'Careers that use ' + s }));
        (p.hobbies || []).forEach(h =>
          add('hob:' + h, '', h, 'Can ' + h + ' become a career for me?', [h]));
        if (p.city) add('city', '', p.city, 'What are good colleges near ' + p.city + '?', [p.city],
          { chip: 'Best colleges near ' + p.city });
      }
      return facts;
    }

    // The welcome stays small: one sentence of what the counsellor knows,
    // with the facts in it highlighted, and four prompts of one shape. The
    // prompts are the facts' own questions, topped up from the defaults.
    const CHAT_SUGS = [
      ['', 'Which colleges are best for me?'],
      ['', 'Which stream should I choose?'],
      ['', 'What should I start doing this year?'],
      ['', 'What careers fit my personality?']
    ];
    function chatRenderWelcome(p, careers) {
      const line = document.getElementById('chat-insight'), sugs = document.getElementById('chat-sugs');
      if (!line || !sugs) return;
      const parts = [];
      const text = t => parts.push(document.createTextNode(t));
      const hl = (t, cls) => {
        const b = document.createElement('b');
        b.className = 'chat-hl' + (cls ? ' ' + cls : '');
        b.textContent = t;
        parts.push(b);
      };
      const subj = p && (p.favourite_subjects || [])[0], top = careers[0];
      if (p) {
        text("You're a ");
        hl('Class ' + p.class + (p.board ? ' · ' + p.board : ''));
        text(' student');
        if (p.city) { text(' in '); hl(p.city); }
        if (subj) { text(' who loves '); hl(subj); }
        text(top ? ', and your top match is ' : '.');
      } else if (top) text('Your top match is ');
      if (top) {
        hl(top.title);
        if (top.match_pct != null) { text(' at '); hl(Math.round(top.match_pct) + '%', 'chat-hl-pct'); }
        text('.');
      }
      if (parts.length) {
        line.replaceChildren(...parts);
        // Each highlight underlines itself in turn, as if being read out
        line.querySelectorAll('.chat-hl').forEach((b, i) => { b.style.animationDelay = (0.45 + i * 0.18) + 's'; });
        const all = document.createElement('button');
        all.className = 'btn btn-ghost btn-sm chat-insight-more';
        all.textContent = 'See all I know';
        all.onclick = () => chatMemOpen(true);
        line.appendChild(all);
      }

      const asks = [];
      const kind = k => chatFacts.find(f => f.key.split(':')[0] === k);
      [kind('career'), kind('class'), kind('city'), kind('dream') || kind('subj')].forEach(f => {
        if (f) asks.push([f.icon, f.ask, f.chip]);
      });
      CHAT_SUGS.forEach(s => { if (asks.length < 4 && !asks.some(a => a[1] === s[1])) asks.push(s); });
      sugs.replaceChildren(...asks.slice(0, 4).map(([icon, ask, chip], i) => {
        const b = document.createElement('button');
        b.className = 'chat-sug';
        b.title = ask;
        b.dataset.ask = ask;
        b.style.animationDelay = (0.3 + i * 0.07) + 's';
        b.onclick = () => sendSug(b);
        const ic = document.createElement('span');
        ic.className = 'icon-tile chat-sug-icon';
        ic.innerHTML = window.icon(['route', 'graduation-cap', 'map-pin', 'sparkles'][i] || 'sparkles');
        const t = document.createElement('span');
        t.className = 'chat-sug-text';
        t.textContent = chip || ask;
        b.append(ic, t);
        return b;
      }));
    }

    function chatRenderMem(p, careers) {
      const body = document.getElementById('chat-mem-body');
      if (!body) return;
      body.innerHTML = '';
      const el = (tag, cls, text) => {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
      };
      const section = title => {
        const s = el('section', 'chat-mem-sec');
        s.appendChild(el('div', 'chat-mem-sec-title', title));
        body.appendChild(s);
        return s;
      };
      const empty = (sec, text, label, page) => {
        const box = el('div', 'chat-mem-empty');
        const b = el('button', 'btn btn-ghost btn-sm', label);
        b.onclick = () => navTo(page);
        box.append(el('p', '', text), b);
        sec.appendChild(box);
      };
      const tags = (sec, title, items, prefix) => {
        if (!items || !items.length) return;
        const wrap = el('div', 'chat-mem-tags');
        items.forEach(t => {
          const tag = el('span', 'chat-mem-tag', t);
          if (prefix) tag.dataset.fact = prefix + t;
          wrap.appendChild(tag);
        });
        sec.append(el('div', 'chat-mem-tags-title', title), wrap);
      };

      // The collapsed card's subtitle is the short version of what's inside
      const sub = document.getElementById('chat-mem-sub');
      if (sub) sub.textContent = [profileSummary(p), careers.length ? careers.length + ' career matches' : '']
        .filter(Boolean).join(' · ') || 'Shared with me at the start of each chat';
      body.appendChild(el('p', 'chat-mem-note', 'Shared with me at the start of each chat'));

      const you = section('You');
      if (!p) {
        empty(you, "I don't know your class or interests yet, so my advice will be general.", 'Fill in your profile', 'onboarding');
      } else {
        const rows = el('div', 'chat-mem-rows');
        [
          ['', 'Class', 'Class ' + p.class, 'class'],
          ['', 'Board', p.board, 'class'],
          ['', 'Medium', p.medium],
          ['', 'City', p.city, 'city'],
          ['', 'Dream job', p.dream_job, 'dream'],
          ['', 'Prefers', p.career_preference],
          ['', 'Study away?', p.study_location]
        ].forEach(([icon, k, v, fact]) => {
          if (!v) return;
          const row = el('div', 'chat-mem-row');
          if (fact) row.dataset.fact = fact;
          row.append(el('span', 'chat-mem-row-key', k), el('span', 'chat-mem-row-val', v));
          rows.appendChild(row);
        });
        you.appendChild(rows);
        tags(you, 'Favourite subjects', p.favourite_subjects, 'subj:');
        tags(you, 'Hobbies', p.hobbies, 'hob:');
        const marks = p.marks && Object.entries(p.marks);
        if (marks && marks.length) tags(you, 'Last exam marks', marks.map(([s, n]) => s + ' ' + n));
      }

      const matches = section('Your top career matches');
      if (!careers.length) {
        empty(matches, "You haven't taken the career quiz, so I don't know your matches yet.", 'Take the career quiz', 'careerquiz');
      } else {
        careers.forEach((c, i) => {
          const pct = Math.max(0, Math.min(100, Math.round(c.match_pct || 0)));
          const row = el('div', 'chat-mem-career' + (i === 0 ? ' top' : ''));
          row.dataset.fact = 'career:' + c.title;
          const name = el('div', 'chat-mem-career-name');
          name.append(el('span', '', c.title), el('b', '', pct + '%'));
          const track = el('div', 'chat-mem-career-track');
          const fill = el('div', 'chat-mem-career-fill');
          fill.style.width = pct + '%';
          track.appendChild(fill);
          const info = el('div', 'chat-mem-career-info');
          info.append(name, track);
          row.append(info);
          matches.appendChild(row);
        });
      }
    }

    // The panel is a drawer behind the header's brain button at every width
    // (a bottom sheet on phones), and starts shut so the profile only shows
    // when asked for.
    function chatMemOpen(open) {
      const btn = document.getElementById('chat-mem-btn');
      document.body.classList.toggle('chat-mem-open', open);
      if (btn) btn.setAttribute('aria-expanded', String(open));
      if (open) document.querySelector('.chat-mem-close').focus();
      else if (btn && document.activeElement && document.activeElement.closest('.chat-mem')) btn.focus();
    }
    function chatInitMem() {
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && document.body.classList.contains('chat-mem-open')) chatMemOpen(false);
      });
      // Crossing into the phone layout swaps the side drawer for a bottom
      // sheet; shut it rather than let one animate into the other
      window.matchMedia(CHAT_MEM_PHONE).addEventListener('change', () => chatMemOpen(false));
    }

    // The facts a reply talks about, by whole-phrase match. Terms under four
    // letters ("Art") are skipped: they hit too many unrelated words.
    function chatMentions(text) {
      const hit = term => {
        if (term.length < 4) return false;
        const t = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp('(^|[^\\p{L}\\p{N}])' + t + '(?=$|[^\\p{L}\\p{N}])', 'iu').test(text);
      };
      return chatFacts.filter(f => f.terms.some(hit));
    }
    // While a reply streams, the panel items it mentions glow, and the brain
    // button pulses so a shut drawer still shows it's being used.
    function chatLight(facts) {
      let any = false;
      document.querySelectorAll('.chat-mem [data-fact]').forEach(n => {
        const lit = facts.some(f => f.key === n.dataset.fact);
        n.classList.toggle('lit', lit);
        any = any || lit;
      });
      ['chat-mem', 'chat-mem-btn'].forEach(id => {
        const n = document.getElementById(id);
        if (n) n.classList.toggle('lit', any);
      });
    }
    // Under a finished reply: "Mentions your" and the facts it named. Tapping
    // one shows it in the panel.
    function addMentions(bubble, facts) {
      if (!facts.length) return;
      const box = document.createElement('div');
      box.className = 'msg-mentions';
      const label = document.createElement('span');
      label.className = 'msg-mentions-label';
      label.textContent = 'Mentions your';
      box.appendChild(label);
      facts.slice(0, 5).forEach(f => {
        const b = document.createElement('button');
        b.className = 'pill msg-mention';
        b.textContent = stripEmoji(f.label.replace(/^(Dream|Loves):? /, ''));
        b.onclick = () => chatMemShow(f.key);
        box.appendChild(b);
      });
      bubble.parentNode.insertBefore(box, bubble.parentNode.querySelector('.msg-time'));
    }
    function chatMemShow(key) {
      chatMemOpen(true);
      const nodes = [...document.querySelectorAll('.chat-mem [data-fact]')].filter(n => n.dataset.fact === key);
      if (!nodes.length) return;
      nodes[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
      nodes.forEach(n => {
        n.classList.remove('flash');
        void n.offsetWidth;  // restart the animation on a second tap
        n.classList.add('flash');
      });
    }
    // Returns the bubble so a streaming reply can fill it in.
    function addMsg(text, type) {
      const wrap = document.getElementById('chat-messages');
      const div = document.createElement('div');
      div.className = 'msg' + (type === 'user' ? ' user' : '');
      const avatar = document.createElement('div');
      avatar.className = 'msg-avatar ' + (type === 'ai' ? 'msg-avatar-ai msg-ai-avatar' : 'avatar msg-user-avatar');
      const me = document.querySelector('.user-avatar');
      if (type === 'ai') avatar.innerHTML = icon('sparkles');
      else avatar.textContent = (me && me.textContent.trim()) || '?';
      avatar.setAttribute('aria-hidden', 'true');
      const body = document.createElement('div');
      body.className = 'msg-body';
      const bubble = document.createElement('div');
      bubble.className = 'msg-bubble';
      bubble.textContent = text;
      const time = document.createElement('div');
      time.className = 'msg-time';
      time.textContent = new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
      body.append(bubble, time);
      div.append(avatar, body);
      wrap.appendChild(div);
      return bubble;
    }

    // ── Toggle ──

    // ══════════════════════════════════════════════════════════════
    // CAREER INTEREST QUIZ  (RIASEC)
    //
    // The questions, scoring, career matching and result assembly all live
    // in riasec_engine.js, which every page loads before this file; it
    // matches against RIASEC_CAREERS, loaded from careerAPI by loadCareers().
    // Keeping them there means the Node test harness in tests/ scores answers
    // with exactly the same code the browser runs.
    //
    // Function names are unchanged from the previous five-trait version so
    // the router in show() and the onclick handlers in the page markup did
    // not have to change.
    // ══════════════════════════════════════════════════════════════

    // cqOrder holds the shuffled question/option layout for this run
    // (product rules 2 & 3). It is seeded and saved with the session so
    // going Back re-renders the exact layout the student answered on.
    let cqIdx = 0, cqAnswers = [], cqOrder = null;

    // Display step → original question index.
    function cqQuestionAt(step) {
      const qi = cqOrder ? cqOrder.questionOrder[step] : step;
      return { qi: qi, q: RS_QUESTIONS[qi] };
    }

    // Sends a logged-out visitor to the login page. Resolves true if they may
    // stay. The flag isLoggedIn() reads is per tab, so a new tab with a valid
    // session cookie has no flag yet: ask the server (GET /me sets it) before
    // treating the student as logged out.
    function requireLogin() {
      if (isLoggedIn()) return Promise.resolve(true);
      const out = () => { show('auth'); return false; };
      if (!window.CareerAPI) return Promise.resolve(out());
      return CareerAPI.me.get().then(() => true, out);
    }

    // Called from any page ("Take the quiz" / "Retake") — clears the old run
    // and hands off to career_quiz.html, which renders the first question.
    function cqStart() {
      requireLogin().then(ok => { if (ok) cqBegin(); });
    }
    function cqBegin() {
      cqIdx = 0;
      cqAnswers = [];
      cqOrder = rsBuildOrder();
      saveState({
        cqIdx: 0, cqAnswers: [], cqOrder: cqOrder,
        appResults: null, isDemo: true, localRunAt: null
      });
      // From the evaluation interstitial the quiz takes its place in history.
      show('careerquiz', CURRENT_PAGE === 'evaluation');
    }

    // Entry point for career_quiz.html — restore progress and draw the question
    function cqResume() {
      const s = loadState();
      cqAnswers = Array.isArray(s.cqAnswers) ? s.cqAnswers : [];
      // Rebuild from the saved seed rather than trusting the saved arrays,
      // so a stale or hand-edited session can never map answers onto the
      // wrong options.
      cqOrder = s.cqOrder && typeof s.cqOrder.seed === 'number'
        ? rsBuildOrder(s.cqOrder.seed)
        : rsBuildOrder();
      // A fresh order (no cqStart() in this tab) is saved at once, or a
      // reload would reshuffle and cqIdx would point at different questions.
      if (!s.cqOrder) saveState({ cqOrder: cqOrder });
      cqIdx = typeof s.cqIdx === 'number' ? s.cqIdx : 0;
      if (cqIdx < 0 || cqIdx >= RS_QUESTIONS.length) cqIdx = 0;
      // Browser Back goes to the previous question; the session, not the
      // hash, decides where the student is, so the hash can't skip questions.
      stepInit(() => { if (cqIdx <= 0) return false; cqPrev(); return true; });
      cqRender();
    }

    function cqRender() {
      const { qi, q } = cqQuestionAt(cqIdx);
      const order = cqOrder.optionOrder[qi];
      const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
      const total = RS_QUESTIONS.length;

      document.getElementById('cq-num').textContent = 'Question ' + (cqIdx + 1) + ' of ' + total;
      // The area tag is a neutral topic label — it never names the RIASEC
      // dimension being measured (product rule 1).
      document.getElementById('cq-area').textContent = stripEmoji(q.area);
      const bar = document.getElementById('cq-bar');
      bar.max = total; bar.value = cqIdx;
      document.getElementById('cq-back-btn').disabled = cqIdx <= 0;
      document.getElementById('cq-q').textContent = q.q;

      // How many answers this question accepts (doc section 3).
      const hint = document.getElementById('cq-hint');
      hint.className = 'cq-hint field-hint';
      hint.textContent = q.maxSelect > 1 ? 'Pick up to ' + q.maxSelect + '.' : 'Pick 1.';
      optsEl0().classList.remove('shake');

      const optsEl = optsEl0();
      optsEl.innerHTML = '';

      // Options are rendered in shuffled order; dataset.orig carries the
      // ORIGINAL index so scoring never depends on display position.
      order.forEach((origIdx, pos) => {
        const opt = q.opts[origIdx];
        const d = document.createElement('button');
        d.type = 'button';
        d.className = 'option cq-opt';
        d.dataset.orig = origIdx;
        d.setAttribute('aria-pressed', 'false');
        d.innerHTML = '<span class="option-letter cq-letter" data-letter="' + letters[pos] + '">' + letters[pos] +
          '</span><span class="option-text"></span>';
        // textContent, not innerHTML — option text contains quotes and
        // question marks and should never be parsed as markup.
        d.querySelector('.option-text').textContent = opt.text;
        d.onclick = () => cqToggle(d, q.maxSelect);
        optsEl.appendChild(d);
      });

      // Restore previous selections when going back.
      const prev = cqAnswers[qi];
      if (prev && Array.isArray(prev.indices)) {
        [...optsEl.querySelectorAll('.cq-opt')].forEach(el => {
          if (prev.indices.indexOf(parseInt(el.dataset.orig, 10)) !== -1) cqSelect(el, true);
        });
      }
      stepSync(cqIdx > 0, '#/q/' + (cqIdx + 1));
    }

    function optsEl0() { return document.getElementById('cq-opts'); }
    function cqSelect(el, on) {
      const l = el.querySelector('.cq-letter');
      el.classList.toggle('selected', on);
      el.setAttribute('aria-pressed', String(on));
      l.innerHTML = on ? icon('check') : l.dataset.letter;
    }

    // Toggle an option, enforcing the per-question cap. At the cap the
    // oldest selection drops out, so tapping a third option feels
    // responsive instead of silently doing nothing.
    function cqToggle(el, maxSelect) {
      if (el.classList.contains('selected')) { cqSelect(el, false); return; }
      const chosen = [...document.querySelectorAll('#cq-opts .cq-opt.selected')];
      if (chosen.length >= maxSelect) cqSelect(chosen[0], false);
      cqSelect(el, true);
    }

    // True while a question slides out. cqIdx has already moved on but the
    // old options are still on screen, so Next/Back wait until it lands.
    let cqSliding = false;

    // "Next →" — collects the selected options then advances
    function cqNextQ() {
      if (cqSliding) return;
      const { qi, q } = cqQuestionAt(cqIdx);
      const selected = [...document.querySelectorAll('#cq-opts .cq-opt.selected')];

      // Require at least one selection
      if (!selected.length) {
        const opts = optsEl0(), hint = document.getElementById('cq-hint');
        opts.classList.remove('shake');
        requestAnimationFrame(() => opts.classList.add('shake'));
        hint.className = 'cq-hint form-error';
        hint.innerHTML = icon('circle-alert') + 'Pick at least one answer to continue.';
        return;
      }

      const indices = selected.map(el => parseInt(el.dataset.orig, 10));
      // Stored against the ORIGINAL question index, so cqAnswers stays
      // parallel to RS_QUESTIONS whatever order they were shown in.
      cqAnswers[qi] = {
        q: q.q,
        indices: indices,
        answers: indices.map(i => q.opts[i].text)
      };

      cqIdx++;
      saveState({ cqIdx: cqIdx, cqAnswers: cqAnswers });
      // Last question → hand off to ai_loading.html, which runs the analysis
      if (cqIdx >= RS_QUESTIONS.length) { stepLeave(() => redirect('ailoading')); return; }
      cqSlide('next');
    }

    function cqPrev() {
      if (cqSliding || cqIdx <= 0) return;
      cqIdx--;
      saveState({ cqIdx: cqIdx });
      cqSlide('prev');
    }

    function cqSlide(dir) {
      const wrap = document.getElementById('cq-question-wrap');
      const outX = dir === 'next' ? '-24px' : '24px';
      wrap.style.cssText = 'opacity:0;transform:translateX(' + outX + ');transition:opacity .16s,transform .16s;'; // motion only
      cqSliding = true;
      setTimeout(() => {
        wrap.style.transform = 'translateX(' + (dir === 'next' ? '24px' : '-24px') + ')';
        cqRender();
        cqSliding = false;
        requestAnimationFrame(() => {
          wrap.style.cssText = 'opacity:1;transform:translateX(0);transition:opacity .22s,transform .22s;';
        });
      }, 160);
    }

    // Entry point for ai_loading.html — answers arrive via sessionStorage
    async function cqFinish() {
      const s = loadState();
      cqAnswers = Array.isArray(s.cqAnswers) ? s.cqAnswers : [];
      // Landed here directly, or came back after the run was scored: never
      // score (and save) the same answers twice.
      if (!cqAnswers.length) { redirect(s.appResults ? 'airesults' : 'careerquiz'); return; }
      document.querySelectorAll('.al-step').forEach(el => alStep(el.id, 'pending'));
      alStep('al-step1', 'loading');
      await cqRunAI();
    }

    function cqDelay(ms) { return new Promise(r => setTimeout(r, ms)); }

    // One AI-loading step: pending (waiting), loading (working), done.
    function alStep(id, state) {
      const el = document.getElementById(id);
      el.className = 'al-step ' + state;
      el.querySelector('.al-step-icon').innerHTML = state === 'done' ? icon('check')
        : state === 'loading' ? '<span class="spinner spinner-sm" aria-hidden="true"></span>' : '<span class="al-pending" aria-hidden="true"></span>';
      const sr = el.querySelector('.visually-hidden');
      if (sr) sr.textContent = state === 'done' ? 'Done' : state === 'loading' ? 'In progress' : 'Waiting';
    }

    async function cqRunAI() {
      const t0 = Date.now();
      // ── DEMO MODE ONLY ──────────────────────────────────────────
      // The RIASEC engine produces every result on device. No network call
      // is made and no API key is read.
      const scoring = rsScore(cqAnswers, RS_QUESTIONS);
      alStep('al-step1', 'done'); alStep('al-step2', 'loading');
      const results = rsBuildResults(scoring, RIASEC_CAREERS);
      alStep('al-step2', 'done'); alStep('al-step3', 'loading');

      // The scoring stays on device; only the finished run is saved to the
      // student's account, so it comes back on their next login.
      const top = results.top_careers[0];
      const pct = {};
      RS_DIMS.forEach(d => { pct[d] = Math.round(scoring.pct[d]); });
      saveState({
        // The answers travel on in quizRun; clearing them marks this run scored.
        cqAnswers: [], cqIdx: 0,
        appResults: results,
        isDemo: true,
        riasecScores: {
          pct: scoring.pct,
          code: scoring.code,
          confidence: scoring.confidence
        },
        quizRun: top ? {
          riasec_pct: pct, riasec_code: scoring.code, confidence: scoring.confidence,
          top_career: top.title, results: results, answers: cqAnswers,
          engine_version: RS_ENGINE_VERSION
        } : null,
        // A run with no match can't be saved (the API needs a top_career),
        // so cqLoadSaved must not swap it for an older run from the server.
        localRunAt: top ? null : Date.now()
      });
      await alSave(t0);
    }

    // Save the scored run, keep the steps on screen for at least 1.2 s in total,
    // and offer a retry if the save fails. The run also waits in state.quizRun,
    // so "See my results" is safe: the results page retries the save.
    async function alSave(t0) {
      const ok = await cqSaveRun();
      const wait = 1200 - (Date.now() - (t0 || Date.now()));
      if (wait > 0) await cqDelay(wait);
      if (ok === false) {
        alStep('al-step3', 'pending');
        document.getElementById('al-step3').classList.add('failed');
        document.getElementById('al-title').textContent = 'We couldn\'t save your report';
        document.getElementById('al-sub').textContent = 'Your answers are safe on this device.';
        document.getElementById('al-error').hidden = false;
        return;
      }
      alStep('al-step3', 'done');
      redirect('airesults');
    }
    function alRetry() {
      document.getElementById('al-error').hidden = true;
      document.getElementById('al-step3').classList.remove('failed');
      alStep('al-step3', 'loading');
      document.getElementById('al-title').textContent = 'Building your report';
      document.getElementById('al-sub').textContent = 'This takes a few seconds.';
      alSave(Date.now());
    }

    // POST /me/career-quiz, which also sets the student's career (career
    // leaderboards group by it). Until it succeeds the run waits in
    // state.quizRun and the results page tries again.
    function cqSaveRun() {
      const run = loadState().quizRun;
      if (!run || !isLoggedIn() || !CareerAPI.me.saveCareerQuiz) return Promise.resolve();
      return CareerAPI.me.saveCareerQuiz(run).then(() => { saveState({ quizRun: null }); return true; }, () => false);
    }

    // The pages that show results fetch the student's latest saved run on
    // every load, so a quiz taken on another device shows up here on the next
    // refresh. A run this tab hasn't managed to save yet is newer than the
    // server's, so it's kept (and saved first). If the fetch fails, or the
    // student has no saved run, whatever this tab has is shown.
    function cqLoadSaved() {
      if (!['app', 'airesults'].includes(CURRENT_PAGE) ||
        !window.CareerAPI || !CareerAPI.me.latestCareerQuiz) return Promise.resolve();
      return cqSaveRun().then(() => {
        if (loadState().quizRun) return;
        return CareerAPI.me.latestCareerQuiz().then(r => {
          const run = r.result;
          if (!run) return;
          const localAt = loadState().localRunAt;
          if (localAt && !(Date.parse(run.created_at) > localAt)) return;
          saveState({
            appResults: run.results,
            isDemo: true,
            localRunAt: null,
            riasecScores: { pct: run.riasec_pct, code: run.riasec_code, confidence: run.confidence }
          });
          appResults = run.results;
        }, () => { });
      });
    }


    // Rehydrated on every page load so the dashboard/results/progress
    // pages in app.html can read the last quiz run.
    let appResults = loadState().appResults || null;

    // Entry point for career_results.html
    function cqShowResults() {
      const s = loadState();
      if (!s.appResults) { redirect('careerquiz'); return; }  // no run to show
      cqRenderResults(s.appResults, s.isDemo !== false);
      cqInitPrint();
      // Career Matches → Download Report lands here with ?print=1. The flag
      // is dropped first so a reload or Back doesn't reopen the dialog.
      if (new URLSearchParams(location.search).get('print') === '1') {
        try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { }
        setTimeout(cqSavePdf, 300);  // let fonts and the bars settle first
      }
    }

    // Career Matches → Download Report: the report is the results page, which
    // already has a print layout, so open it and start Save as PDF there.
    function cqDownloadReport() {
      if (!appResults) { cqStart(); return; }
      location.href = routeTo('airesults') + '?print=1';
    }

    // Roadmap → Export PDF. The @media print block hides the app chrome, so
    // only the open roadmap goes on paper.
    function rmExportPdf() {
      if (!document.getElementById('rm-timeline').children.length) {
        alert('Pick a career with a roadmap first.');
        return;
      }
      cqSavePdf();
    }

    // The suggested PDF filename on app.html, e.g. Crackeer-Roadmap-Civil-Engineer.
    function appPrintTitle() {
      const page = document.querySelector('.page.active');
      if (page && page.id === 'roadmap') {
        const career = document.getElementById('rm-career').textContent
          .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return 'Crackeer-Roadmap-' + (career || cqDateStamp());
      }
      return 'Crackeer-' + cqDateStamp();
    }

    // Shown over a result saved by the previous question set (riasec-1),
    // which can't be re-scored because the questions changed.
    function cqRetakeNotice() {
      return '<svg class="icon" aria-hidden="true"><use href="' + SPRITE + '#i-info"/></svg><div class="stack-sm stack">' +
        '<p><span class="alert-title">This result is from the older quiz.</span> The new quiz takes about 6 minutes and matches you with more careers, including new ones in AI, space, climate and biotech.</p>' +
        '<div><button class="btn btn-secondary btn-sm" onclick="cqStart()">Retake the quiz</button></div></div>';
    }

    // ── Save the report as a PDF ───────────────────────────────────────────
    // Deliberately the browser's own print-to-PDF rather than a canvas/PDF
    // library: no third-party script has to be fetched (so it works offline
    // and nothing about the report leaves the device), the text in the PDF stays
    // selectable and searchable, and it costs one function. The layout rules
    // live in the @media print block in style.css.
    function cqSavePdf() {
      if (typeof window.print !== 'function') return;
      window.print();  // the user picks "Save as PDF" as the destination
    }

    function cqDateStamp(sep) {
      const d = new Date(), p = n => String(n).padStart(2, '0');
      return [d.getFullYear(), p(d.getMonth() + 1), p(d.getDate())].join(sep || '-');
    }

    // Wired once when the results page renders, so Ctrl+P / ⌘P and the
    // button produce the same document. app.html wires it too, with
    // appPrintTitle() naming the file.
    function cqInitPrint(titleFn) {
      const dateEl = document.getElementById('air-print-date');
      if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString(undefined,
          { day: 'numeric', month: 'long', year: 'numeric' });
      }

      let prevTheme = null, prevTitle = null;

      function before() {
        if (prevTheme === null) {
          prevTheme = document.documentElement.getAttribute('data-theme') || 'light';
          prevTitle = document.title;
        }
        // The dark palette prints as a wall of ink and eats a cartridge, so
        // borrow the light one while the dialog is open.
        document.documentElement.setAttribute('data-theme', 'light');
        // Chrome and Edge seed the "Save as PDF" filename from the title.
        document.title = titleFn ? titleFn() : 'Crackeer-Career-Report-' + cqDateStamp();
      }

      function restore() {
        if (prevTheme === null) return;
        document.documentElement.setAttribute('data-theme', prevTheme);
        document.title = prevTitle;
        prevTheme = prevTitle = null;
      }

      window.addEventListener('beforeprint', before);
      window.addEventListener('afterprint', restore);
      // Safari does not fire afterprint on every path; there the print media
      // query turning false is the reliable signal.
      const mq = window.matchMedia && window.matchMedia('print');
      if (mq && mq.addEventListener) {
        mq.addEventListener('change', e => { if (e.matches) before(); else restore(); });
      }
    }

    function cqRenderResults(data, isDemo) {
      appResults = data; // make available to dashboard, results, progress pages
      document.getElementById('air-personality-type').textContent = data.personality_type || 'Your career report';
      document.getElementById('air-personality-desc').textContent = data.personality_desc || '';
      document.getElementById('air-stream-val').textContent = cqStreamLabel(data);
      document.getElementById('air-stream-reason').textContent = data.stream_reason || '';
      const demoBadge = document.getElementById('air-demo-badge');
      if (demoBadge) demoBadge.hidden = !isDemo;

      cqRenderRiasec(data.riasec);
      cqRenderDomains(data.riasec && data.riasec.domains);
      cqRenderStreams(data.streams);

      const notice = document.getElementById('air-retake');
      if (notice) {
        const current = rsIsCurrentResult(data);
        notice.hidden = current;
        notice.innerHTML = current ? '' : cqRetakeNotice();
      }

      const list = document.getElementById('air-careers');
      list.innerHTML = '';
      if (!(data.top_careers || []).length) {
        list.innerHTML = '<p class="muted">None of them is a strong match yet. ' +
          '<button class="btn btn-ghost btn-sm no-print" onclick="navTo(\'explorer\')">Explore every career</button></p>';
        return;
      }
      data.top_careers.forEach(c => {
        const card = document.createElement('article');
        card.className = 'card stack-sm stack air-career-card';
        card.innerHTML =
          '<div class="card-head"><h3 class="card-title air-career-name"></h3><span class="badge air-fit-label ' + fitClass(c.match_pct) + '"></span></div>' +
          '<p class="card-sub air-career-field"></p><p class="air-career-why"></p>' +
          '<div class="cluster"><span class="badge badge-outline air-career-stream"></span>' + (c.salary ? '<span class="small air-career-salary"></span>' : '') + '</div>';
        card.querySelector('.air-career-name').textContent = c.title;
        card.querySelector('.air-fit-label').textContent = fitLabel(c.match_pct);
        card.querySelector('.air-career-field').textContent = c.field || '';
        card.querySelector('.air-career-why').textContent = c.why || '';
        card.querySelector('.air-career-stream').textContent = c.stream || 'Any stream';
        if (c.salary) card.querySelector('.air-career-salary').textContent = c.salary;
        list.appendChild(card);
      });
    }

    // The recommended stream in words ("Science with Maths (PCM)"), not just its key.
    function cqStreamLabel(data) {
      const top = (data.streams || []).find(x => x.key === data.stream_recommendation || x.token === data.stream_recommendation);
      return top ? top.label : (data.stream_recommendation || '');
    }

    // ── The four streams, ranked (rsRankStreams) ──────────────────────────
    // One bar per stream plus the reason in words. Hidden for a result saved
    // before streams were ranked.
    function cqRenderStreams(streams) {
      const wrap = document.getElementById('air-streams-wrap');
      const el = document.getElementById('air-streams');
      if (!wrap || !el) return;
      el.innerHTML = '';
      wrap.hidden = !(streams && streams.length);
      (streams || []).forEach(s => {
        const row = document.createElement('div');
        row.className = 'air-stream-row stack-xs stack';
        row.innerHTML = '<div class="bar-row"><span class="bar-row-label air-stream-row-name"></span>' +
          '<progress class="progress progress-ink" max="100" value="' + Number(s.score || 0) + '">' + Number(s.score || 0) + '</progress>' +
          '<span class="bar-row-value">' + Number(s.score || 0) + '</span></div><p class="small muted air-stream-row-reason"></p>';
        row.querySelector('.air-stream-row-name').textContent = s.label;
        row.querySelector('.air-stream-row-reason').textContent = s.reason || '';
        el.appendChild(row);
      });
    }

    // ── The worlds the student picked (Part 2 of the quiz) ─────────────────
    // Hidden for a result saved before the domain questions existed.
    const AIR_DOMAIN_ICON = { digital: 'sparkles', machines: 'settings', money: 'briefcase', people: 'user', life: 'star', planet: 'map-pin', built: 'school', media: 'newspaper' };
    function cqRenderDomains(domains) {
      const wrap = document.getElementById('air-domains-wrap');
      const el = document.getElementById('air-domains');
      if (!wrap || !el) return;
      el.innerHTML = '';
      wrap.hidden = !(domains && domains.length);
      (domains || []).forEach(d => {
        const chip = document.createElement('span');
        chip.className = 'badge badge-outline air-domain-chip';
        chip.innerHTML = icon(AIR_DOMAIN_ICON[d.key] || 'sparkles');
        chip.append(stripEmoji(d.label));
        el.appendChild(chip);
      });
    }

    // ── The RIASEC profile block (doc section 15) ───────────────────────────
    // Shows the six areas as bars in plain language, the top-three code, and
    // the "You may enjoy" list. The RIASEC letters appear only as the code
    // itself; the areas are always named in student-facing words.
    function cqRenderRiasec(r) {
      if (!r) return;
      const bars = document.getElementById('air-riasec-bars');
      const codeEl = document.getElementById('air-riasec-code');
      const enjoyEl = document.getElementById('air-enjoy');
      if (!bars) return;

      bars.innerHTML = '';
      (r.ranked || []).forEach(d => {
        const row = document.createElement('div');
        row.className = 'bar-row air-riasec-row';
        row.innerHTML = '<span class="bar-row-label"><span class="dim-swatch" data-dim="' + d.dim + '"></span><span class="air-riasec-name"></span></span>' +
          '<progress class="progress" data-dim="' + d.dim + '" max="100" value="' + Number(d.pct || 0) + '">' + Number(d.pct || 0) + '</progress>' +
          '<span class="bar-row-value">' + Number(d.pct || 0) + '</span>';
        row.querySelector('.air-riasec-name').textContent = d.plain || d.name;
        bars.appendChild(row);
      });

      // The top three letters are the code; each tile carries its area's colour.
      const codeLetters = (r.code || '').split('')
        .map(l => ({ letter: l, dim: (r.ranked || []).find(d => d.dim === l) }))
        .filter(x => x.dim);
      if (codeEl) {
        codeEl.textContent = '';
        codeEl.setAttribute('aria-label', 'Interest code ' + codeLetters.map(x => x.letter).join(' '));
        codeLetters.forEach(x => {
          const tile = document.createElement('span');
          tile.className = 'riasec-tile air-riasec-code-tile';
          tile.dataset.dim = x.letter;
          tile.textContent = x.letter;
          codeEl.appendChild(tile);
        });
      }

      // What the letters stand for: formal area name plus the plain "you like…" line.
      const keyEl = document.getElementById('air-code-key');
      if (keyEl) {
        keyEl.innerHTML = '';
        codeLetters.forEach(x => {
          const name = (typeof RS_DIM_NAMES !== 'undefined' && RS_DIM_NAMES[x.letter]) || x.dim.name;
          const mean = (typeof RS_DIM_MEANING !== 'undefined' && RS_DIM_MEANING[x.letter]) || x.dim.meaning;
          if (!name || !mean) return;
          const row = document.createElement('div');
          row.innerHTML = '<dt><span class="riasec-tile air-code-key-letter" data-dim="' + x.letter + '"></span><span class="air-code-key-name"></span></dt>' +
            '<dd>You like <span class="air-code-key-mean"></span></dd>';
          row.querySelector('.air-code-key-letter').textContent = x.letter;
          row.querySelector('.air-code-key-name').textContent = name;
          row.querySelector('.air-code-key-mean').textContent = mean + '.';
          keyEl.appendChild(row);
        });
      }

      // Flag genuinely close scores rather than implying a firm ranking (doc section 8).
      const note = document.getElementById('air-riasec-note');
      if (note) {
        const tied = (r.close || []).find(g => g.length > 1 && r.ranked && g.indexOf(r.ranked[0].dim) !== -1);
        note.textContent = r.flat
          ? 'Your answers spread evenly across the areas, so no single one stands out yet.'
          : r.consistency === 'low'
            ? 'Your top two areas are an unusual mix. That can be a real strength; it is worth talking through with a counsellor.'
            : tied
              ? 'Your top areas scored very close together, so treat them as similarly strong.'
              : 'Your strongest area stands clearly ahead of the rest.';
      }

      if (enjoyEl) {
        enjoyEl.innerHTML = '';
        (r.enjoy || []).forEach(t => {
          const li = document.createElement('li');
          li.textContent = t.charAt(0).toUpperCase() + t.slice(1);
          enjoyEl.appendChild(li);
        });
      }

      const matched = document.getElementById('air-match-note');
      if (matched && r.consideredCount) {
        matched.textContent = r.qualifiedCount + ' of ' + r.consideredCount + ' careers scored above the minimum match level. Ranked by how well each fits your interests, subjects and stream.';
      }
    }

    // ══════════════════════════════════════════════════════════════
    // SYNC QUIZ RESULTS → DASHBOARD / RESULTS / STREAM / PROGRESS
    // ══════════════════════════════════════════════════════════════

    // Builds one stat tile. Four of these sit in a fixed row, so the value,
    // label and sub-line all come through the same shape whether the card is
    // populated or still locked. Every value is text (career titles and the
    // stream reason come from the API or a saved run), so all of it is escaped.
    function dbStat(o) {
      return '<div class="stat' + (o.locked ? ' locked' : '') + '">' +
        '<span class="stat-value">' + (o.locked ? icon('lock') + 'Locked' : esc(o.val)) + '</span>' +
        '<span class="stat-label">' + esc(o.label) + '</span></div>';
    }

    function dbToday() {
      try { return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) { return ''; }
    }

    function syncDashboard() {
      const main = document.getElementById('db-main');
      const stats = document.getElementById('db-stats');
      const title = document.getElementById('db-title');
      const sub = document.getElementById('db-sub');
      const ctaBtn = document.getElementById('db-cta-btn');
      const date = document.getElementById('db-date');
      if (date) date.textContent = dbToday();

      // ── No results yet: the quiz is the one thing to do ─────────────
      if (!appResults) {
        title.innerHTML = 'Let\'s find <span class="hl">your direction</span>.';
        sub.textContent = 'Answer 25 quick questions about what you enjoy. We\'ll match you with careers and build a step-by-step roadmap for the one you pick.';
        ctaBtn.hidden = true;
        ctaBtn.textContent = 'Start the quiz';
        ctaBtn.onclick = cqStart;
        main.innerHTML =
          '<section class="card hero-card hero-card-media" aria-labelledby="db-quiz-title">' + illo('rocket', 'lg') +
          '<div class="stack"><div class="stack-sm stack"><h2 class="card-title-lg" id="db-quiz-title">Take the career quiz</h2>' +
          '<p class="card-sub">25 questions and about 6 minutes. There are no right or wrong answers, just pick what sounds like you.</p></div>' +
          '<div class="cluster cluster-lg"><button class="btn btn-primary" onclick="cqStart()">Start the quiz</button><span class="small muted">You can pause and come back.</span></div></div></section>' +
          '<aside class="card-flat stack"><div class="cluster cluster-lg">' + illo('trophy', 'sm') +
          '<div class="grow stack-xs stack"><h2 class="card-title">Weekly contests</h2><p class="card-sub">Five questions every Saturday about your future career. They unlock once you have a career match.</p></div></div></aside>';
        stats.innerHTML = ['Top match', 'Strong matches', 'Recommended stream', 'Questions answered'].map(l => dbStat({ locked: 1, label: l })).join('');
        return;
      }

      // ── With results ───────────────────────────────────────────────
      // top is undefined when every career scored under RS_MIN_FIT.
      const d = appResults, top = (d.top_careers || [])[0], r = d.riasec || {};
      title.innerHTML = top ? 'Your <span class="hl">path</span> is taking shape.' : 'Your results are in.';
      sub.textContent = (d.personality_type ? d.personality_type + '. ' : '') + (d.stream_recommendation ? cqStreamLabel(d) + ' is your recommended stream for Class 11.' : '');
      ctaBtn.hidden = false;
      ctaBtn.innerHTML = top ? icon('route') + 'Open my roadmap' : 'Explore careers';
      ctaBtn.onclick = () => navTo(top ? 'roadmap' : 'explorer');

      const code = (r.code || '').split('').filter(l => 'RIASEC'.includes(l));
      const names = code.map(l => { const x = (r.ranked || []).find(z => z.dim === l); return x ? x.name : l; });
      let html = '';
      if (!rsIsCurrentResult(d)) {
        html += '<div class="alert alert-warn">' + cqRetakeNotice() + '</div>';
        ctaBtn.textContent = 'Retake the quiz';
        ctaBtn.onclick = cqStart;
      }
      html += '<div class="grid-main-side"><div class="stack-lg stack">';
      html += top
        ? '<section class="card stack" aria-labelledby="db-top-title"><div class="card-head"><div class="stack-xs stack"><p class="small muted">Your top match</p>' +
          '<h2 class="card-title-lg" id="db-top-title">' + esc(top.title) + '</h2></div><span class="badge ' + fitClass(top.match_pct) + '">' + esc(fitLabel(top.match_pct)) + '</span></div>' +
          (code.length ? '<div class="cluster cluster-lg"><div class="riasec" aria-label="Your interest code: ' + esc(names.join(', ')) + '">' +
            code.map(l => '<span class="riasec-tile" data-dim="' + l + '">' + l + '</span>').join('') + '</div><p class="dim-names">' + esc(names.join(', ')) + '</p></div>' : '') +
          (top.why ? '<p>' + esc(top.why) + '</p>' : '') +
          '<div class="cluster cluster-lg"><button class="btn btn-secondary" data-career="' + esc(top.title) + '" onclick="cdOpen(this.dataset.career)">See what it involves</button>' +
          '<button class="btn btn-ghost" onclick="navTo(\'results\')">See all matches</button></div></section>'
        : '<section class="card-flat">' + '<div class="empty">' + illo('magnifier', 'lg') + '<h2 class="empty-title">No strong match yet</h2>' +
          '<p class="empty-text">No career scored above ' + RS_MIN_FIT + '% from your answers. Browse every career and see how each one fits you.</p>' +
          '<div class="cluster"><button class="btn btn-primary" onclick="navTo(\'explorer\')">Explore careers</button></div></div></section>';
      if (d.stream_recommendation) {
        html += '<section class="card-flat stack-sm stack" aria-labelledby="db-stream-title"><p class="small muted">Recommended stream for Class 11</p>' +
          '<h2 class="card-title" id="db-stream-title">' + esc(cqStreamLabel(d)) + '</h2>' +
          (d.stream_reason ? '<p class="card-sub">' + esc(d.stream_reason) + '</p>' : '') +
          '<div><button class="btn btn-secondary btn-sm" onclick="exploreStream(appResults && appResults.stream_recommendation)">Careers in this stream</button></div></section>';
      }
      html += '</div><aside class="stack-lg stack">';
      const others = (d.top_careers || []).slice(1);
      if (others.length) {
        html += '<section class="card-flat stack-sm stack" aria-labelledby="db-careers-title"><h2 class="card-title" id="db-careers-title">Your other matches</h2><div class="stack-sm stack" id="db-strip">' +
          others.map(c => '<button class="pill career-pill" data-career="' + esc(c.title) + '" onclick="cdOpen(this.dataset.career)"><span class="pill-num career-pill-pct">' +
            esc(Math.round(c.match_pct)) + '%</span><span class="career-pill-name">' + esc(c.title) + '</span></button>').join('') + '</div></section>';
      }
      html += '<section class="card-ink stack" aria-labelledby="db-contest-title"><div class="cluster cluster-lg">' + illo('trophy', 'sm') +
        '<div class="grow stack-xs stack"><h2 class="card-title" id="db-contest-title">Weekly contests</h2><p class="muted small">Five questions every Saturday about your career. Climb the leaderboard and keep your streak.</p></div></div>' +
        '<button class="btn btn-primary" onclick="navTo(\'contests\')">Go to contests</button></section>';
      html += '</aside></div>';
      main.innerHTML = html;

      const strong = (d.top_careers || []).filter(c => c.match_pct >= 75).length;
      stats.innerHTML =
        dbStat({ val: top ? Math.round(top.match_pct) + '%' : 'None yet', label: 'Top match' }) +
        dbStat({ val: String(strong), label: 'Strong matches' }) +
        dbStat({ val: d.stream_recommendation || '—', label: 'Recommended stream' }) +
        dbStat({ val: String(rsIsCurrentResult(d) ? RS_QUESTIONS.length : 20), label: 'Questions answered' });
    }

    let rsFilter = '';
    function syncResults(keepFilter) {
      const list = document.getElementById('career-list');
      const bar = document.getElementById('results-filter');
      const streamVal = document.getElementById('results-stream-val');
      const streamBadge = document.getElementById('results-stream-badge');
      const banner = document.getElementById('results-stream-banner');
      if (!keepFilter) rsFilter = '';

      const empty = (art, title, text, btn) => '<section class="card-flat"><div class="empty">' + illo(art, 'lg') +
        '<h2 class="empty-title">' + title + '</h2><p class="empty-text">' + text + '</p><div class="cluster">' + btn + '</div></div></section>';

      if (!appResults) {
        if (banner) banner.hidden = true;
        if (bar) bar.innerHTML = '';
        if (streamVal) streamVal.textContent = '';
        if (list) list.innerHTML = empty('rocket', 'Take the quiz to see your matches',
          'Answer 25 questions about what you enjoy and we\'ll rank every career for you. It takes about 6 minutes.',
          '<button class="btn btn-primary" onclick="cqStart()">Start the career quiz</button>');
        return;
      }

      const d = appResults;
      if (banner) banner.hidden = !d.stream_recommendation;
      if (streamVal) streamVal.textContent = cqStreamLabel(d);
      if (streamBadge) streamBadge.textContent = 'See careers in this stream';

      if (!list) return;
      const careers = d.top_careers || [];
      if (!careers.length) {
        if (bar) bar.innerHTML = '';
        list.innerHTML = empty('magnifier', 'No strong matches yet',
          'None of the careers scored above ' + RS_MIN_FIT + '% for you. That usually means your answers were spread across many areas, which is fine. Retake the quiz, or explore careers yourself.',
          '<button class="btn btn-primary" onclick="cqStart()">Retake the quiz</button><button class="btn btn-secondary" onclick="navTo(\'explorer\')">Explore careers</button>');
        return;
      }

      // Filter chips: All plus every field present in these matches.
      if (bar) {
        const counts = {};
        careers.forEach(c => { const f = c.field || 'Other'; counts[f] = (counts[f] || 0) + 1; });
        const chip = (label, cat, n) => '<button class="chip filter-chip' + (rsFilter === cat ? ' active' : '') + '" type="button" role="radio" aria-checked="' + (rsFilter === cat) +
          '" data-cat="' + esc(cat) + '" onclick="filterChip(this)">' + esc(label) + ' <span class="chip-count">' + n + '</span></button>';
        bar.innerHTML = chip('All', '', careers.length) + Object.keys(counts).map(f => chip(f, f, counts[f])).join('');
      }

      list.innerHTML = '';
      careers.filter(c => !rsFilter || (c.field || 'Other') === rsFilter).forEach(c => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'card card-link career-card stack-sm stack';
        card.onclick = () => cdOpen(c.title);
        card.innerHTML = '<span class="card-head"><span class="card-title career-name"></span><span class="badge ' + fitClass(c.match_pct) + '"></span></span>' +
          '<span class="small muted career-field"></span><span class="card-sub career-reason"></span>' +
          (c.salary ? '<span class="small"><span class="muted">Starting salary</span> <b class="career-salary"></b></span>' : '');
        card.querySelector('.career-name').textContent = c.title;
        card.querySelector('.badge').textContent = fitLabel(c.match_pct);
        card.querySelector('.career-field').textContent = [c.field, c.stream].filter(Boolean).join(', ');
        card.querySelector('.career-reason').textContent = c.why || '';
        if (c.salary) card.querySelector('.career-salary').textContent = String(c.salary).replace(/\s*starting$/i, '');
        list.appendChild(card);
      });
    }

    // ── Career detail (app.html#/careerdetail/<career>?from=explorer) ──
    // Opened from Career Matches, the dashboard strip and the explorer. The
    // career and where it was opened from are in the address, so a reload or
    // a shared link re-opens the same one; with none named it falls back to
    // the top match.
    const CD_BACK = { results: 'Matches', dashboard: 'Dashboard', explorer: 'Explore Careers' };
    let cdFrom = null, cdReq = 0;

    function cdOpen(title) {
      appOpen('careerdetail', title, { from: CD_BACK[appView] ? appView : null });
    }

    // Opened from inside the app: step back, which also restores the
    // explorer's filters. Opened from a link: go to where it says it came from.
    function cdBack() {
      if (history.state && history.state.app) history.back();
      else appGo(appDefaultHash(cdFrom || 'results'));
    }

    // Catalogue row first (it has the RIASEC profile, subjects and domains);
    // a quiz-run career that has since left the catalogue still shows from
    // what the run saved.
    function cdCareerData(title) {
      const db = typeof RIASEC_CAREERS !== 'undefined' ? RIASEC_CAREERS : [];
      const tops = (appResults && appResults.top_careers) || [];
      const cat = db.find(c => c.title === title) || null;
      const top = tops.find(c => c.title === title) || null;
      if (!cat && !top) return null;
      return { title: title, cat: cat, top: top, base: cat || top, rank: top ? tops.indexOf(top) : -1 };
    }

    function cdRender(picked) {
      const body = document.getElementById('cd-body');
      const back = document.getElementById('cd-back');
      back.innerHTML = icon('arrow-left') + 'Back to ' + (CD_BACK[cdFrom] || 'Matches');
      const tops = (appResults && appResults.top_careers) || [];
      const d = cdCareerData(picked) || (tops[0] && cdCareerData(tops[0].title));
      if (!d) {
        body.innerHTML = '<section class="card-flat"><div class="empty">' + illo('map-pin', 'lg') +
          '<h1 class="empty-title">Pick a career to see its details</h1>' +
          '<p class="empty-text">Take the career quiz to get your matches, or browse every career in the explorer.</p>' +
          '<div class="cluster"><button class="btn btn-primary" onclick="navTo(\'explorer\')">Explore careers</button></div></div></section>';
        return;
      }

      const c = d.base, profile = exStudentProfile();
      const fit = profile && d.cat ? rsCareerFit(profile, d.cat) : null;
      // The quiz's own figure when this is one of the student's matches, so
      // the page agrees with Career Matches.
      const pct = d.top ? d.top.match_pct : fit ? Math.round(fit.fit * 100) : null;

      let html = '<section class="card stack" aria-labelledby="cd-title">' +
        '<div class="card-head"><div class="stack-xs stack"><p class="small muted">' + esc([c.field, c.stream].filter(Boolean).join(', ')) + '</p>' +
        '<h1 class="card-title-lg" id="cd-title">' + esc(c.title) + '</h1></div>' +
        (pct === null ? '<span class="badge fit-low">Fit unknown</span>' : '<span class="badge ' + fitClass(pct) + '">' + esc(fitLabel(pct)) + '</span>') + '</div>' +
        (c.why ? '<p>' + esc(c.why) + '</p>' : '') +
        '<div class="cluster">' +
        (d.rank >= 0 ? '<button class="btn btn-primary" data-career="' + esc(c.title) + '" onclick="spCareer=this.dataset.career;navTo(\'space\')">' + icon('newspaper') + 'News and jobs</button>' : '') +
        (pct === null ? '<button class="btn btn-primary" onclick="cqStart()">Take the quiz to see your fit</button>' : '') +
        '<button class="btn btn-ghost" onclick="navTo(\'chat\')">' + icon('message-square') + 'Ask AI Chat about it</button></div></section>';

      html += '<div class="grid-2">';
      // Why it fits: the three layers the match % is blended from.
      if (fit) {
        const layer = (label, part) => '<div class="bar-row"><span class="bar-row-label">' + label + '</span>' +
          (part === null ? '<span class="muted small">Not enough answers</span><span></span>'
            : '<progress class="progress progress-ink" max="100" value="' + Math.round(part * 100) + '">' + Math.round(part * 100) + '</progress><span class="bar-row-value">' + Math.round(part * 100) + '</span>') + '</div>';
        html += '<section class="card-flat stack" aria-labelledby="cd-fit-title"><h2 class="card-title" id="cd-fit-title">How it fits you</h2>' +
          layer('Interests', fit.parts.interest) + layer('World', fit.parts.domain) + layer('Subjects', fit.parts.subjects) +
          '<p class="small muted">Interests compare what you enjoy with the work, world is the area you want to work in, and subjects compare your strong subjects with what it needs.</p></section>';
      }
      // The kind of work: the career's three strongest interest areas.
      if (d.cat && d.cat.riasec) {
        const mine = String((appResults && appResults.riasec && appResults.riasec.code) || '').split('');
        const dims = RS_DIMS.slice().sort((a, b) => (d.cat.riasec[b] || 0) - (d.cat.riasec[a] || 0)).slice(0, 3);
        html += '<section class="card-flat stack" aria-labelledby="cd-areas-title"><h2 class="card-title" id="cd-areas-title">What the work involves</h2>' +
          '<div class="riasec" aria-label="Work areas ' + dims.join(' ') + '">' + dims.map(k => '<span class="riasec-tile" data-dim="' + k + '">' + k + '</span>').join('') + '</div>' +
          '<div class="list">' + dims.map(k => '<div class="list-row"><span class="grow"><span class="list-title">' + esc(RS_DIM_PLAIN[k]) + '</span>' +
            (mine.includes(k) ? ' <span class="badge fit-strong">One of your strengths</span>' : '') +
            '<br><span class="list-meta">' + esc(RS_DIM_MEANING[k]) + '</span></span></div>').join('') + '</div></section>';
      }
      html += '</div>';

      const subjects = ((d.cat && d.cat.subjects) || []).map(k => RS_SUBJECTS[k]).filter(Boolean);
      const worlds = ((d.cat && d.cat.domains) || []).map(k => RS_DOMAINS[k]).filter(Boolean);
      html += '<div class="grid-2"><section class="card-flat stack" aria-labelledby="cd-glance-title"><h2 class="card-title" id="cd-glance-title">At a glance</h2><dl class="kv">' +
        '<dt class="exa-key">Starting salary</dt><dd class="exa-val">' + esc(String(c.salary || 'Not listed').replace(/\s*starting$/i, '')) + '</dd>' +
        '<dt class="exa-key">Class 11 stream</dt><dd class="exa-val">' + esc(c.stream || 'Any stream') + '</dd>' +
        (worlds.length ? '<dt class="exa-key">World</dt><dd class="exa-val">' + esc(worlds.map(w => stripEmoji(w.label)).join(', ')) + '</dd>' : '') +
        '</dl></section>';
      if (subjects.length) {
        html += '<section class="card-flat stack" aria-labelledby="cd-subj-title"><h2 class="card-title" id="cd-subj-title">Subjects to focus on</h2><div class="cluster">' +
          subjects.map(sj => '<span class="badge badge-outline">' + esc(stripEmoji(sj.label)) + '</span>').join('') + '</div></section>';
      }
      html += '</div>';

      html += '<section class="card-flat stack" aria-labelledby="cd-rm-title"><h2 class="card-title" id="cd-rm-title">Your path from Class 10</h2>' +
        '<div class="alert alert-info" id="cd-rm-note" role="status">Loading roadmap…</div><ol class="timeline" id="cd-timeline"></ol></section>';
      body.innerHTML = html;

      const req = ++cdReq;
      CareerAPI.me.roadmap(c.title).then(r => {
        if (req !== cdReq) return;
        document.getElementById('cd-rm-note').hidden = true;
        document.getElementById('cd-timeline').innerHTML = rmTimeline(r.roadmap.steps);
      }, err => {
        if (req !== cdReq) return;
        document.getElementById('cd-rm-note').textContent = err.code === 'not_found'
          ? 'We\'re still writing the roadmap for ' + c.title + '. Check back soon, or ask AI Chat for the steps.'
          : err.message;
      });
    }

    // ══════════════════════════════════════════════════════════════
    // CAREER EXPLORER
    //
    // Every card is built from RIASEC_CAREERS, so the explorer lists the
    // whole database and can never drift out of sync with the quiz: add a
    // career to the catalogue and it shows up here with no markup change.
    //
    // Fit % comes from the same rsCareerFit() the shortlist is ranked with,
    // so a career reads the same percentage here as on the results page —
    // including the ones the diversity and minimum-fit rules keep out of the
    // top five. Before the quiz is taken there is no profile to compare
    // against, so the cards drop the fit row instead of inventing a number.
    // ══════════════════════════════════════════════════════════════

    // Four controls narrow the grid — category chips, stream, minimum fit and
    // the search box — and they compose. Each control's counts are computed
    // with the OTHER filters already applied, so a chip reads "how many would
    // I see if I clicked this" rather than a number that never moves.
    //
    // Chips group the catalogue's `family` tags into the handful of buckets a
    // student actually browses by. Families are grouped rather than listed
    // one-per-chip because fourteen chips scan as a wall, not a filter.
    const EX_GROUPS = [
      { key: 'all', label: 'All', families: null },
      { key: 'tech', label: 'Technology', families: ['computing'] },
      { key: 'engineering', label: 'Engineering', families: ['engineering', 'architecture', 'transport'] },
      { key: 'healthcare', label: 'Medicine & Life Sciences', families: ['medicine', 'ayush', 'allied-health', 'psychology', 'life-science'] },
      { key: 'commerce', label: 'Commerce & Management', families: ['accounting', 'finance', 'business', 'operations'] },
      { key: 'creative', label: 'Design & Media', families: ['design', 'media-arts'] },
      { key: 'people', label: 'Law & Social Sciences', families: ['law', 'social-science'] },
      { key: 'public', label: 'Government & Public Service', families: ['public-service', 'education'] }
    ];

    // Class 11 streams, in the order a student is likely to look for them.
    // Any token the catalogue uses that is not listed here still gets an
    // option, appended at the end.
    const EX_STREAM_ORDER = ['PCM+CS', 'PCM', 'PCB', 'Commerce', 'Arts', 'ITI', 'Any'];

    // Minimum-fit steps. The labels are worded in plain terms because "65%"
    // on its own does not tell a student whether that is good.
    const EX_FIT_STEPS = [
      { key: 'all', label: 'Any fit', min: 0 },
      { key: '85', label: 'Excellent · 85%+', min: 85 },
      { key: '75', label: 'Strong · 75%+', min: 75 },
      { key: '65', label: 'Good · 65%+', min: 65 }
    ];

    // needsFit marks the orders that only mean something once the quiz has
    // produced a profile — they are left out of the menu until then.
    const EX_SORTS = [
      { key: 'fit', label: 'Best fit', needsFit: true },
      { key: 'az', label: 'Name: A → Z' },
      { key: 'za', label: 'Name: Z → A' },
      { key: 'salary-high', label: 'Salary: high → low' },
      { key: 'salary-low', label: 'Salary: low → high' },
      { key: 'category', label: 'Category' }
    ];

    let exGroup = 'all', exStream = 'all', exFit = 'all', exSort = '', exQuery = '';
    let exCareers = null, exGroups = null;

    // The student's six-dimensional profile, or null before the quiz.
    // riasecScores is what the quiz saves; appResults is the fallback for a
    // session stored by a build that only wrote the results payload.
    // The student's profile in the shape rsCareerFit() takes. A result from
    // before the world or subject questions has no scores for them; those
    // layers are null and rsCareerFit() leaves them out.
    function exStudentProfile() {
      const s = loadState();
      const r = appResults && appResults.riasec;
      const pct = (s.riasecScores && s.riasecScores.pct) || (r && r.pct);
      if (!pct) return null;
      return {
        pct: pct,
        domains: (r && r.domainScores) || null,
        subjects: (r && r.subjectScores) || null
      };
    }

    // Colour tracks how strong the match is, not the card's position: with a
    // seventy-plus cards on screen, rank-based colour would say nothing.
    function exBand(pct) {
      return pct >= 85 ? 0 : pct >= 75 ? 1 : pct >= 65 ? 2 : pct >= 55 ? 3 : 4;
    }

    // Salaries are authored as copy ("₹5–9 LPA starting"), not numbers, so
    // sorting reads the range back out of the string. A career with no figure
    // at all ("Varies widely") gets null and always sorts to the end rather
    // than being treated as ₹0.
    function exSalaryRange(text) {
      const span = String(text || '').match(/(\d+)\s*[–—-]\s*(\d+)/);
      if (span) return { low: +span[1], high: +span[2] };
      const single = String(text || '').match(/(\d+)/);
      return single ? { low: +single[1], high: +single[1] } : null;
    }

    // "PCB / PCM" means either stream works, so a career carries a list of
    // streams, not one.
    function exStreamsOf(career) {
      return String(career.stream || '').split('/').map(s => s.trim()).filter(Boolean);
    }

    function exBuildList() {
      const db = typeof RIASEC_CAREERS !== 'undefined' ? RIASEC_CAREERS : [];
      const profile = exStudentProfile();
      return db.map(c => ({
        career: c,
        match_pct: profile ? Math.round(rsCareerFit(profile, c).fit * 100) : null,
        salary: exSalaryRange(c.salary),
        streams: exStreamsOf(c),
        // Searching the stream and the "why" line too means "PCB" or
        // "helping people" find careers whose titles never say either.
        haystack: (c.title + ' ' + c.field + ' ' + c.stream + ' ' + c.why).toLowerCase()
      }));
    }

    // Any family missing from EX_GROUPS is collected into "Other", so a new
    // family in the catalogue can never leave careers reachable only from the
    // All chip. Counts are filled in per render by exRenderDrawer().
    function exGroupsFor(list) {
      const groups = EX_GROUPS.map(g => Object.assign({}, g));
      const mapped = {};
      groups.forEach(g => (g.families || []).forEach(f => { mapped[f] = 1; }));
      const extra = [];
      list.forEach(it => {
        const fam = it.career.family || '';
        if (fam && !mapped[fam] && extra.indexOf(fam) === -1) extra.push(fam);
      });
      if (extra.length) groups.push({ key: 'other', label: 'Other', families: extra });
      // Drop buckets the catalogue has nothing in — but keep All, which is
      // the fallback selection.
      return groups.filter(g => !g.families ||
        list.some(it => g.families.indexOf(it.career.family) !== -1));
    }

    function exGroupBy(key) {
      return (exGroups || []).find(g => g.key === key) || null;
    }

    function exInGroup(item, group) {
      return !group || !group.families || group.families.indexOf(item.career.family) !== -1;
    }

    function exStreamMatch(item, token) {
      if (item.streams.indexOf(token) !== -1) return true;
      // A career marked "Any" is open from every stream, so it stays visible
      // whichever stream is picked.
      return token !== 'Any' && item.streams.indexOf('Any') !== -1;
    }

    function exHasFit() {
      return !!(exCareers && exCareers.length && exCareers[0].match_pct !== null);
    }

    // `skip` names one control to ignore, which is how each control's own
    // count is worked out: the stream counts apply the chips, the search and
    // the fit floor, but not the stream.
    function exPasses(item, skip) {
      if (skip !== 'group' && !exInGroup(item, exGroupBy(exGroup))) return false;
      if (skip !== 'stream' && exStream !== 'all' && !exStreamMatch(item, exStream)) return false;
      if (skip !== 'fit' && exFit !== 'all') {
        if (item.match_pct === null || item.match_pct < +exFit) return false;
      }
      if (skip !== 'query') {
        const q = exQuery.trim().toLowerCase();
        if (q && item.haystack.indexOf(q) === -1) return false;
      }
      return true;
    }

    // Stream tokens the catalogue actually uses, in EX_STREAM_ORDER first.
    function exStreamOptions(list) {
      const seen = {};
      list.forEach(it => it.streams.forEach(s => { seen[s] = 1; }));
      const known = EX_STREAM_ORDER.filter(s => seen[s]);
      const rest = Object.keys(seen).filter(s => EX_STREAM_ORDER.indexOf(s) === -1).sort();
      return known.concat(rest);
    }

    function exSortsFor(hasFit) {
      return EX_SORTS.filter(s => !s.needsFit || hasFit);
    }

    // The menu selection, or — while it is still on its default — best fit
    // when there is a profile to rank by and A → Z before that.
    function exActiveSort() {
      const hasFit = exHasFit();
      if (exSort && exSortsFor(hasFit).some(s => s.key === exSort)) return exSort;
      return hasFit ? 'fit' : 'az';
    }

    function exComparator(sort) {
      const byTitle = (a, b) => a.career.title.localeCompare(b.career.title);
      // Unknown salaries sort last in both directions — they are missing
      // data, not cheap jobs.
      const bySalary = dir => (a, b) => {
        if (!a.salary || !b.salary) return (a.salary ? -1 : b.salary ? 1 : 0) || byTitle(a, b);
        // Equal ends are broken on the other end of the range — ₹3–8 LPA
        // really does start lower than ₹3–15 LPA — and only then by name.
        const [va, ta] = dir === 'desc' ? [a.salary.high, a.salary.low] : [a.salary.low, a.salary.high];
        const [vb, tb] = dir === 'desc' ? [b.salary.high, b.salary.low] : [b.salary.low, b.salary.high];
        return (dir === 'desc' ? (vb - va) || (tb - ta) : (va - vb) || (ta - tb)) || byTitle(a, b);
      };
      switch (sort) {
        case 'fit': return (a, b) => (b.match_pct - a.match_pct) || byTitle(a, b);
        case 'za': return (a, b) => byTitle(b, a);
        case 'salary-high': return bySalary('desc');
        case 'salary-low': return bySalary('asc');
        case 'category': return (a, b) => {
          const ga = exGroupOf(a), gb = exGroupOf(b);
          return (ga || '').localeCompare(gb || '') || byTitle(a, b);
        };
        default: return byTitle;
      }
    }

    // Label of the bucket a career falls in — used by the Category sort so
    // the grid groups the way the chips do.
    function exGroupOf(item) {
      const g = (exGroups || []).find(x => x.families && exInGroup(item, x));
      return g ? g.label : 'Other';
    }

    function exCard(item) {
      const c = item.career, pct = item.match_pct;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'card-flat card-link explore-card stack-sm stack';
      card.title = c.why || '';   // the one-line reason, without stretching every card
      card.onclick = () => cdOpen(c.title);
      card.innerHTML = '<span class="card-head"><span class="card-title"></span>' +
        (pct === null ? '' : '<span class="badge ' + fitClass(pct) + '"></span>') + '</span>' +
        '<span class="small muted field"></span><span class="small ex-salary"></span>';
      card.querySelector('.card-title').textContent = c.title;
      if (pct !== null) card.querySelector('.badge').textContent = fitLabel(pct);
      card.querySelector('.field').textContent = [c.field, c.stream].filter(Boolean).join(', ');
      card.querySelector('.ex-salary').textContent = c.salary ? String(c.salary).replace(/\s*starting$/i, '') + ' to start' : 'Salary not listed';
      return card;
    }

    function exChip(key, label, count, on, onClick) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'chip filter-chip' + (on ? ' active' : '') + (count === 0 && !on ? ' is-empty' : '');
      el.disabled = count === 0 && !on;
      el.dataset.k = key;
      el.setAttribute('aria-pressed', String(!!on));
      el.innerHTML = '<span class="fc-label"></span><span class="fc-n chip-count"></span>';
      el.querySelector('.fc-label').textContent = label;
      el.querySelector('.fc-n').textContent = count;
      el.onclick = onClick;
      return el;
    }

    function exSection(title, chips) {
      const wrap = document.createElement('div');
      wrap.className = 'stack-sm stack';
      wrap.innerHTML = '<p class="ex-group-title field-label"></p><div class="ex-group-chips chip-group"></div>';
      wrap.querySelector('.ex-group-title').textContent = title;
      const row = wrap.querySelector('.ex-group-chips');
      chips.forEach(c => row.appendChild(c));
      return wrap;
    }

    function exActiveCount() {
      return (exGroup !== 'all' ? 1 : 0) + (exStream !== 'all' ? 1 : 0) + (exFit !== 'all' ? 1 : 0);
    }

    function exIsFiltered() {
      return exActiveCount() > 0 || !!exQuery.trim();
    }

    function exFillSelect(sel, options, value) {
      sel.innerHTML = '';
      options.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;
        sel.appendChild(opt);
      });
      sel.value = value;
    }

    function exRenderBar(shownCount) {
      const hasFit = exHasFit();

      const sortSel = document.getElementById('ex-sort');
      if (sortSel) {
        exFillSelect(sortSel, exSortsFor(hasFit).map(s => ({ value: s.key, label: s.label })),
          exActiveSort());
      }

      const searchClear = document.getElementById('ex-search-clear');
      if (searchClear) searchClear.hidden = !exQuery;

      const n = exActiveCount();
      const btn = document.getElementById('ex-filter-btn');
      if (btn) btn.classList.toggle('is-on', n > 0);
      const badge = document.getElementById('ex-filter-count');
      if (badge) { badge.textContent = n; badge.hidden = n === 0; }

      const apply = document.getElementById('ex-drawer-apply');
      if (apply) {
        apply.textContent = shownCount === 1 ? 'Show 1 career' : 'Show ' + shownCount + ' careers';
        apply.disabled = shownCount === 0;
      }
      const dsub = document.getElementById('ex-drawer-sub');
      if (dsub) {
        dsub.textContent = n === 0 ? 'Nothing applied yet'
          : n + (n === 1 ? ' filter applied' : ' filters applied');
      }
      const dclear = document.getElementById('ex-drawer-clear');
      if (dclear) dclear.disabled = !exIsFiltered();
    }

    // One removable pill per active filter, so what is being applied is
    // readable with the drawer shut.
    function exRenderActive() {
      const wrap = document.getElementById('ex-active');
      if (!wrap) return;
      wrap.innerHTML = '';

      const pills = [];
      if (exGroup !== 'all') {
        const g = exGroupBy(exGroup);
        pills.push(['Category', g ? g.label : exGroup, () => exSetGroup('all')]);
      }
      if (exStream !== 'all') pills.push(['Stream', exStream, () => exSetStream('all')]);
      if (exFit !== 'all') {
        const step = EX_FIT_STEPS.find(s => s.key === exFit);
        pills.push(['Fit', step ? step.label : exFit + '%+', () => exSetFit('all')]);
      }
      if (exQuery.trim()) pills.push(['Search', '“' + exQuery.trim() + '”', exClearSearch]);

      pills.forEach(([key, value, remove]) => {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'chip selected ex-active-pill';
        el.innerHTML = '<span class="exa-key"></span>: <span class="exa-val"></span>' + icon('x') + '<span class="visually-hidden"> (remove)</span>';
        el.querySelector('.exa-key').textContent = key;
        el.querySelector('.exa-val').textContent = value;
        el.onclick = remove;
        wrap.appendChild(el);
      });

      if (pills.length > 1) {
        const clear = document.createElement('button');
        clear.type = 'button';
        clear.className = 'btn btn-ghost btn-sm ex-active-clear';
        clear.textContent = 'Clear all';
        clear.onclick = exClear;
        wrap.appendChild(clear);
      }
    }

    // Category / stream / fit, all as chips: in a drawer there is room to
    // show every option with its count instead of hiding them in a menu.
    function exRenderDrawer() {
      const body = document.getElementById('ex-drawer-body');
      if (!body) return;
      // Tapping a chip re-renders the whole drawer, which would otherwise
      // drop the keyboard user back to the top of the dialog.
      const active = document.activeElement;
      const refocus = active && active.dataset && body.contains(active) ? active.dataset.k : null;
      body.innerHTML = '';

      body.appendChild(exSection('Category', exGroups.map(g =>
        exChip('cat:' + g.key, g.label,
          exCareers.filter(it => exPasses(it, 'group') && exInGroup(it, g)).length,
          g.key === exGroup,
          () => exSetGroup(g.key)))));

      const streams = [{ key: 'all', label: 'Any stream' }].concat(
        exStreamOptions(exCareers).map(s => ({ key: s, label: s })));
      body.appendChild(exSection('Class 11 stream', streams.map(s =>
        exChip('stream:' + s.key, s.label,
          s.key === 'all'
            ? exCareers.filter(it => exPasses(it, 'stream')).length
            : exCareers.filter(it => exPasses(it, 'stream') && exStreamMatch(it, s.key)).length,
          s.key === exStream,
          () => exSetStream(s.key)))));

      // Nothing to filter by fit until the quiz has run, so the section is
      // left out rather than shown doing nothing.
      if (exHasFit()) {
        body.appendChild(exSection('Minimum fit', EX_FIT_STEPS.map(step =>
          exChip('fit:' + step.key, step.label,
            exCareers.filter(it => exPasses(it, 'fit') && it.match_pct >= step.min).length,
            step.key === exFit,
            () => exSetFit(step.key)))));
      }

      if (refocus) {
        const again = [...body.querySelectorAll('[data-k]')].find(el => el.dataset.k === refocus);
        if (again) again.focus();
      }
    }

    function exRenderGrid() {
      const grid = document.getElementById('explore-grid');
      if (!grid || !exCareers) return;

      const sort = exActiveSort();
      const shown = exCareers.filter(it => exPasses(it)).sort(exComparator(sort));

      grid.innerHTML = '';
      shown.forEach(it => grid.appendChild(exCard(it)));

      if (!shown.length) {
        const none = document.createElement('section');
        none.className = 'card-flat ex-none';
        none.innerHTML = '<div class="empty">' + illo('magnifier', 'lg') + '<h2 class="empty-title"></h2>' +
          '<p class="empty-text">Nothing matches every filter at once. Try a shorter word, a subject you like, or loosen a filter.</p>' +
          '<div class="cluster"><button class="btn btn-secondary" onclick="exClear()">Clear search and filters</button></div></div>';
        none.querySelector('.empty-title').textContent = exQuery.trim()
          ? 'No careers match “' + exQuery.trim() + '”'
          : 'No careers match these filters';
        grid.appendChild(none);
      }

      // The Sort control already names the order, so the subtitle does not
      // repeat it — it answers "how much of the catalogue am I looking at".
      const sub = document.getElementById('ex-sub');
      if (sub) {
        sub.textContent = (shown.length === exCareers.length
          ? 'All ' + exCareers.length + ' careers'
          : 'Showing ' + shown.length + ' of ' + exCareers.length + ' careers') +
          (exHasFit() ? '' : '. Take the quiz to see how each one fits you.');
      }

      return shown.length;
    }

    // The grid is the source of truth for "how many match", so it renders
    // first and everything else is told the number.
    function exRender() {
      if (appView === 'explorer') appSetHash(appHash('explorer', null, exParams()));
      const shown = exRenderGrid();
      exRenderBar(shown);
      exRenderActive();
      exRenderDrawer();
    }

    // params are the filters from the address (#/explorer?stream=PCB&q=…).
    function syncExplorer(params) {
      const grid = document.getElementById('explore-grid');
      if (!grid) return;

      exCareers = exBuildList();
      exGroups = exGroupsFor(exCareers);
      if (params) {
        exQuery = params.q || '';
        exGroup = params.group || 'all';
        exStream = params.stream || 'all';
        exFit = EX_FIT_STEPS.some(s => s.key === params.fit) ? params.fit : 'all';
        exSort = params.sort || '';
        const box = document.getElementById('ex-search');
        if (box) box.value = exQuery;
      }
      if (!exGroups.some(g => g.key === exGroup)) exGroup = 'all';
      if (exStream !== 'all' && exStreamOptions(exCareers).indexOf(exStream) === -1) exStream = 'all';

      exRender();
    }

    // The explorer's filters as address parameters; defaults are left out.
    function exParams() {
      return {
        q: exQuery.trim() ? exQuery : null,
        group: exGroup !== 'all' ? exGroup : null,
        stream: exStream !== 'all' ? exStream : null,
        fit: exFit !== 'all' ? exFit : null,
        sort: exSort || null
      };
    }

    // Opens the explorer narrowed to a recommended stream. "PCM+CS / Commerce"
    // names two, so the first (stronger) one is filtered on; "Any" filters
    // nothing. The filter rides in the address, so it survives the hop in
    // from career_results.html.
    function exploreStream(stream) {
      const first = String(stream || '').split('/')[0].trim();
      appOpen('explorer', null, { stream: first && first !== 'Any' ? first : null });
    }

    // ── Control handlers (wired in app.html) ──
    function exSearch(value) {
      exQuery = value || '';
      exRender();
    }

    function exSetGroup(value) {
      exGroup = value || 'all';
      exRender();
    }

    function exSetStream(value) {
      exStream = value || 'all';
      exRender();
    }

    function exSetFit(value) {
      exFit = value || 'all';
      exRender();
    }

    function exSetSort(value) {
      exSort = value || '';
      exRender();
    }

    function exClearSearch() {
      exQuery = '';
      const box = document.getElementById('ex-search');
      if (box) { box.value = ''; box.focus(); }
      exRender();
    }

    // ── The filter drawer ──
    // Filtering stays live while the drawer is open — the grid behind it
    // updates as chips are tapped — so the footer button only has to close
    // it, and it says how many careers are waiting.
    function exOpenFilters() {
      document.body.classList.add('ex-filters-open');
      const drawer = document.getElementById('ex-drawer');
      const btn = document.getElementById('ex-filter-btn');
      if (drawer) drawer.setAttribute('aria-hidden', 'false');
      if (btn) btn.setAttribute('aria-expanded', 'true');
      const close = document.getElementById('ex-drawer-close');
      if (close) close.focus();
      document.addEventListener('keydown', exDrawerKeys);
    }

    function exCloseFilters() {
      document.body.classList.remove('ex-filters-open');
      const drawer = document.getElementById('ex-drawer');
      const btn = document.getElementById('ex-filter-btn');
      if (drawer) drawer.setAttribute('aria-hidden', 'true');
      if (btn) { btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
      document.removeEventListener('keydown', exDrawerKeys);
    }

    function exDrawerKeys(e) {
      if (e.key === 'Escape') exCloseFilters();
    }

    // Sort is deliberately left alone: it is an ordering preference, not a
    // filter, so clearing the filters should not silently reorder the grid.
    function exClear() {
      exGroup = 'all';
      exStream = 'all';
      exFit = 'all';
      exQuery = '';
      const box = document.getElementById('ex-search');
      if (box) box.value = '';
      exRender();
    }

    function syncProgress() {
      lbRender();  // weekly contest leaderboards (scripts/contest.js)
      if (!appResults) return;
      const d = appResults, top = d.top_careers[0];
      pgRenderEvolution([d]);
      pgLoadEvolution();
      // The note is built only from the student's real results (spec §5.3 #6).
      const box = document.getElementById('pg-ai-note');
      const note = box && box.querySelector('.ai-note-text');
      if (note) {
        note.textContent = 'Your profile points towards ' + String(d.personality_type || 'your interests').replace(/^The /, 'the ').toLowerCase().replace(/^the /, 'the ') + '. ' +
          (top ? top.title + ' is your top career at ' + Math.round(top.match_pct) + '%. ' : '') +
          (d.stream_recommendation ? 'Your recommended stream is ' + cqStreamLabel(d) + '.' : '');
        box.hidden = false;
      }
    }

    // ── Roadmap (app.html#/roadmap) ──
    // The picker lists the careers the student's career quiz suggested
    // (appResults.top_careers, up to 5) and opens on the top match. Each pick
    // fetches that career's timeline from careerAPI (GET /roadmap?career=);
    // a career with no roadmap there yet answers 404 not_found.
    // The address stays a plain #/roadmap: the picked career is kept in the
    // tab's state, so a reload re-opens it; otherwise the top match. An old
    // #/roadmap/<career> link still opens that career, then tidies the address.
    let rmReq = 0, rmCareer = loadState().rmCareer || null;
    function rmLoad(career) {
      const sel = document.getElementById('rm-select');
      if (!sel || !window.CareerAPI) return;
      const careers = (appResults && appResults.top_careers) || [];
      sel.hidden = !careers.length;
      if (!careers.length) { rmMessage('Take the career quiz to see a roadmap for your top career matches.'); return; }
      const has = t => careers.some(c => c.title === t);
      const pick = has(career) ? career : has(rmCareer) ? rmCareer : careers[0].title;
      rmRemember(pick);
      appSetHash(appHash('roadmap'));
      sel.innerHTML = careers.map(c => '<option value="' + esc(c.title) + '">' + esc(c.title) + ' (' + Math.round(c.match_pct) + '%)</option>').join('');
      sel.value = pick;
      rmShow(pick);
    }

    // The career picker switches in place: no history entry, no address change.
    function rmPick(career) {
      const sel = document.getElementById('rm-select');
      if (sel) sel.value = career;
      rmRemember(career);
      rmShow(career);
    }
    function rmRemember(career) {
      rmCareer = career;
      saveState({ rmCareer: career });
    }

    function rmShow(career) {
      const req = ++rmReq;
      const match = ((appResults && appResults.top_careers) || []).find(c => c.title === career);
      document.getElementById('rm-career').textContent = career;
      document.getElementById('rm-timeline').innerHTML = '';
      rmNote('Loading roadmap…');
      CareerAPI.me.roadmap(career).then(r => {
        if (req !== rmReq) return;
        rmNote('');
        document.getElementById('rm-timeline').innerHTML = rmTimeline(r.roadmap.steps);
      }, err => {
        if (req !== rmReq) return;
        rmNote(err.code === 'not_found'
          ? 'We\'re still writing the roadmap for ' + career + '. Pick another of your matches above.'
          : err.message);
      });
    }

    // Also drawn on the career detail page. The first stage is "now", so it
    // shows as reached.
    // One <li> per stage, direct children of the list (rmExportPdf counts them).
    function rmTimeline(steps) {
      return (steps || []).map((s, i) =>
        '<li class="tl-item' + (i === 0 ? ' current' : '') + '"><span class="tl-dot">' + (i + 1) + '</span>' +
        '<p class="tl-title">' + esc(s.title) + '</p><p class="tl-meta">' + esc(s.period || '') + '</p>' +
        ((s.actions || []).length ? '<div class="tl-body"><ul>' + s.actions.map(a => '<li>' + esc(a) + '</li>').join('') + '</ul></div>' : '') +
        '</li>').join('');
    }

    function rmMessage(text) {
      document.getElementById('rm-career').textContent = 'Your top career';
      document.getElementById('rm-timeline').innerHTML = '';
      rmNote(text);
    }

    function rmNote(text) {
      const el = document.getElementById('rm-note');
      el.textContent = text;
      el.hidden = !text;
    }

    // ── My Career Space (app.html#/space) ──
    // A pill per career the student's career quiz suggested
    // (appResults.top_careers, up to 5), opening on the top match. Each pick
    // fetches that career's live feed from careerAPI (GET /career-news?career=):
    // four category lists, which the All tab merges. Feeds are kept for the
    // page's life, so switching back to a career is instant.
    const SP_ICON = { news: 'newspaper', jobs: 'briefcase', exams: 'graduation-cap', scholarships: 'star' };
    const spFeeds = {};
    let spCareer = null, spTab = 'all', spReq = 0;

    // career and tab come from the address (#/space/<career>?tab=jobs).
    function spLoad(career, tab) {
      if (!window.CareerAPI) return;
      const careers = (appResults && appResults.top_careers) || [];
      const pills = document.getElementById('sp-careers');
      if (!careers.length) {
        pills.innerHTML = document.getElementById('sp-tabs').innerHTML = document.getElementById('sp-feed').innerHTML = '';
        document.getElementById('sp-foot').hidden = true;
        spNote('');
        document.getElementById('sp-feed').innerHTML =
          '<div class="empty">' + illo('rocket', 'lg') +
          '<h2 class="empty-title">Your Career Space fills up after the quiz</h2>' +
          '<p class="empty-text">Take the career quiz and we\'ll bring you the latest news, jobs, exams and scholarships for each of your top career matches.</p>' +
          '<div class="cluster"><button class="btn btn-primary" onclick="cqStart()">Start the career quiz</button></div></div>';
        return;
      }
      if (careers.some(c => c.title === career)) spCareer = career;
      else if (!careers.some(c => c.title === spCareer)) spCareer = careers[0].title;
      spTab = tab || 'all';  // checked against the feed's categories once it loads
      spSyncHash();
      pills.innerHTML = careers.map(c =>
        '<button class="pill career-pill' + (c.title === spCareer ? ' active' : '') + '" type="button" role="tab" aria-selected="' +
        (c.title === spCareer) + '" data-career="' + esc(c.title) + '" onclick="spPick(this.dataset.career)">' +
        '<span class="pill-num career-pill-pct">' + esc(Math.round(c.match_pct)) + '%</span>' +
        '<span class="career-pill-name">' + esc(c.title) + '</span></button>').join('');
      spShow(spCareer);
    }

    function spShow(career) {
      spCareer = career;
      document.querySelectorAll('#sp-careers .career-pill').forEach(p => {
        const on = p.dataset.career === career;
        p.classList.toggle('active', on);
        p.setAttribute('aria-selected', on);
      });
      if (spFeeds[career]) { spRender(); return; }
      const req = ++spReq;
      document.getElementById('sp-tabs').innerHTML = document.getElementById('sp-feed').innerHTML = '';
      document.getElementById('sp-foot').hidden = true;
      spNote('Finding the latest for ' + career + '…');
      CareerAPI.me.careerNews(career).then(r => {
        spFeeds[career] = r;
        if (req === spReq) spRender();
      }, err => {
        if (req !== spReq) return;
        spNote(err.code === 'not_found'
          ? 'We don\'t have a news feed for ' + career + ' yet. Pick another of your matches above.'
          : err.message, true);
      });
    }

    // Picking a career is a history entry; a tab only rewrites the address.
    function spPick(career) { appGo(appHash('space', career, { tab: spTab === 'all' ? null : spTab })); }
    function spSetTab(key) { spTab = key; spRender(); }
    function spSyncHash() {
      if (appView === 'space' && spCareer) appSetHash(appHash('space', spCareer, { tab: spTab === 'all' ? null : spTab }));
    }

    // The All tab: every category's items, a story filed under two of them
    // shown once (under the first), newest first.
    function spItems(feed) {
      if (spTab !== 'all') {
        const cat = feed.categories.find(c => c.key === spTab);
        return cat ? cat.items.map(it => Object.assign({ cat: cat.key }, it)) : [];
      }
      const seen = new Set(), out = [];
      feed.categories.forEach(c => c.items.forEach(it => {
        if (seen.has(it.url)) return;
        seen.add(it.url);
        out.push(Object.assign({ cat: c.key }, it));
      }));
      return out.sort((a, b) => (b.published_at || '').localeCompare(a.published_at || ''));
    }

    function spRender() {
      const feed = spFeeds[spCareer];
      if (!feed) return;
      if (spTab !== 'all' && !feed.categories.some(c => c.key === spTab)) spTab = 'all';
      spSyncHash();
      const total = new Set([].concat.apply([], feed.categories.map(c => c.items.map(it => it.url)))).size;
      const chip = (key, label, n) => '<button class="tab-btn filter-chip' + (spTab === key ? ' active' : '') + (n ? '' : ' is-empty') +
        '" type="button" role="tab" aria-selected="' + (spTab === key) + '"' + (n || spTab === key ? '' : ' disabled') + ' onclick="spSetTab(\'' + key + '\')">' +
        label + ' <span class="fc-n chip-count">' + n + '</span></button>';
      document.getElementById('sp-tabs').innerHTML = chip('all', 'All', total) +
        feed.categories.map(c => chip(c.key, esc(stripEmoji(c.label)), c.items.length)).join('');

      const items = spItems(feed);
      const labels = {};
      feed.categories.forEach(c => { labels[c.key] = c.label; });
      spNote(items.length ? '' : 'Nothing new here in the last few weeks. Check the other tabs, or come back in a few days.');
      document.getElementById('sp-feed').innerHTML = items.map(it => {
        const url = /^https?:\/\//i.test(it.url) ? it.url : '#';
        const img = it.image && /^https:\/\//i.test(it.image)
          ? '<img class="sp-thumb" src="' + esc(it.image) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">'
          : '<span class="icon-tile sp-thumb">' + icon(SP_ICON[it.cat] || 'newspaper') + '</span>';
        const meta = [spTab === 'all' ? stripEmoji(labels[it.cat] || it.cat) : '', it.source || it.provider || '', it.published_at ? spAgo(it.published_at) : ''].filter(Boolean).join(', ');
        return '<a class="list-row sp-item" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + img +
          '<span class="grow"><span class="list-title sp-title">' + esc(it.title) + '</span><br><span class="list-meta sp-meta">' + esc(meta) + '</span></span>' +
          icon('external-link') + '<span class="visually-hidden"> (opens in a new tab)</span></a>';
      }).join('');

      const foot = document.getElementById('sp-foot');
      foot.hidden = false;
      foot.textContent = (feed.sources && feed.sources.length ? 'Headlines from ' + feed.sources.join(' and ') : 'Live headlines') +
        (feed.updated_at ? ', updated ' + spAgo(feed.updated_at) : '') +
        '. Crackeer doesn\'t write these stories: check dates and eligibility on the official website before you apply.';
    }

    function spAgo(iso) {
      const mins = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
      if (mins < 60) return mins <= 1 ? 'just now' : mins + ' min ago';
      const hrs = Math.round(mins / 60);
      if (hrs < 24) return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
      const days = Math.round(hrs / 24);
      if (days < 30) return days + (days === 1 ? ' day ago' : ' days ago');
      return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function spNote(text, retry) {
      const el = document.getElementById('sp-note');
      el.className = 'alert ' + (retry ? 'alert-error' : 'alert-info');
      el.innerHTML = '<span>' + esc(text) + '</span>' + (retry ? ' <button class="btn btn-secondary btn-sm sp-retry" onclick="spShow(spCareer)">' + icon('refresh-cw') + 'Try again</button>' : '');
      el.hidden = !text;
    }

    // "Top Match Evolution" compares the student's 2 saved career quiz runs
    // (GET /me/career-quiz/runs, newest first). A run this tab hasn't saved
    // yet (state.quizRun) is newer than the server's, so it becomes Latest and
    // the server's newest becomes Previous. Until the fetch answers — or if
    // it fails — only this tab's run is shown, as Latest.
    let pgEvolutionReq = 0;
    function pgLoadEvolution() {
      if (!isLoggedIn() || !window.CareerAPI || !CareerAPI.me.careerQuizRuns) return;
      const req = ++pgEvolutionReq;
      CareerAPI.me.careerQuizRuns().then(r => {
        if (req !== pgEvolutionReq) return;
        const saved = (r.results || []).map(run => run.results).filter(Boolean);
        const runs = loadState().quizRun && appResults ? [appResults].concat(saved) : saved;
        if (runs.length) pgRenderEvolution(runs.slice(0, 2));
      }, () => { });
    }

    // runs: appResults objects, newest first.
    function pgRenderEvolution(runs) {
      const box = document.getElementById('pg-evolution-rows');
      if (!box) return;
      const row = (label, top, latest) => !top ? '' :
        '<div class="list-row"><span class="icon-tile">' + icon(latest ? 'sparkles' : 'clock') + '</span>' +
        '<span class="grow"><span class="list-title">' + esc(top.title) + ', ' + esc(Math.round(top.match_pct)) + '%</span><br><span class="list-meta">' + label + ' quiz</span></span>' +
        (latest ? '<span class="badge fit-strong">Latest</span>' : '') + '</div>';
      const topOf = d => d && d.top_careers && d.top_careers[0];
      box.innerHTML = row('Latest', topOf(runs[0]), true) + row('Previous', topOf(runs[1]), false);
    }
