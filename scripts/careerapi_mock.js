// ══════════════════════════════════════════════════════════════
// CAREERAPI — ACCOUNTS, ACCESS, BILLING AND ADMIN DATA LAYER
//
// Every screen outside the weekly contest talks to the backend ONLY through
// window.CareerAPI. Each method returns a Promise shaped like the HTTP
// endpoint in careerAPI/docs/database-schema.md §11.
//
// Every method is live: it calls the production API at API_BASE (session =
// httpOnly cookie, so fetch uses credentials: 'include'). The file keeps its
// old name so no page has to change its <script> tag.
//
// Payments happen outside the website: an admin records each one in the
// admin panel, and that is what grants access. There is no checkout here.
//
// Students can't delete their own account; only an admin can
// (DELETE /admin/students/:id).
//
// Errors reject with an Error carrying .status (HTTP) and .code (API code).
//
// Admins are created with `npm run create-admin` in the careerAPI repo.
// ══════════════════════════════════════════════════════════════
(function (root) {
  'use strict';

  // Production careerAPI (careerAPI repo, deployed on Vercel). On the deployed
  // site, vercel.json proxies /api to it, so the session cookie is first-party
  // (Safari and other browsers that block third-party cookies drop it
  // otherwise). Local dev (Live Server, file://) has no proxy, so it calls the
  // API directly.
  const API_ORIGIN = 'https://careerapi.vercel.app';
  // Local means this machine, a LAN address (a phone on the same Wi-Fi) or
  // file://; the API's CORS_ORIGINS has to list that origin. `vercel dev`
  // does have the proxy: run localStorage.careerai_api_base = '/api' there
  // to keep the cookie first-party.
  const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|10(\.\d+){3}|192\.168(\.\d+){2}|172\.(1[6-9]|2\d|3[01])(\.\d+){2}|[\w-]+\.local|)$/;
  function apiBase() {
    try { const o = localStorage.getItem('careerai_api_base'); if (o) return o; } catch (e) { }
    return LOCAL_HOST.test(root.location ? root.location.hostname : '') ? API_ORIGIN : '/api';
  }
  const API_BASE = apiBase();

  const STUDENT_SESSION = 'careerai_session';

  // Prices are placeholders until the business sets them.
  const PLANS = {
    student_monthly: { plan: 'student_monthly', label: 'Monthly', amount_paise: 19900, months: 1 },
    student_annual: { plan: 'student_annual', label: 'Annual', amount_paise: 149900, months: 12 }
  };

  function sessionGet(key) { try { return sessionStorage.getItem(key); } catch (e) { return null; } }
  function sessionSet(key, v) { try { v == null ? sessionStorage.removeItem(key) : sessionStorage.setItem(key, v); } catch (e) { } }

  // The browser-side mock server kept every student who logged in on this
  // device (email, name) in localStorage. Nothing reads it any more; clear
  // what earlier versions left behind.
  try { localStorage.removeItem('careerai_api_mock'); } catch (e) { }

  // ── Live API ────────────────────────────────────────────────────────────
  // Rejects with an Error carrying .status, .code and, for validation
  // errors, .field. JSON body unless contentType is given,
  // in which case body is sent as-is (the roster CSV).
  function http(method, path, body, contentType) {
    return fetch(API_BASE + path, {
      method: method,
      credentials: 'include',
      headers: body === undefined ? {} : { 'Content-Type': contentType || 'application/json' },
      body: body === undefined ? undefined : contentType ? body : JSON.stringify(body)
    }).then(res => res.json().catch(() => ({})).then(data => {
      if (res.ok) return data;
      const err = data.error || {};
      const e = new Error(err.message || 'Something went wrong. Please try again.');
      e.status = res.status; e.code = err.code || 'server_error';
      if (err.field) e.field = err.field;
      // An admin 401 says nothing about the student session.
      if (res.status === 401 && path.indexOf('/admin') !== 0) sessionSet(STUDENT_SESSION, null);
      throw e;
    }), () => {
      const e = new Error("Can't reach the server. Check your connection and try again.");
      e.status = 0; e.code = 'network_error';
      throw e;
    });
  }

  // { deleted: true, q: 'x', mode: undefined } → '?deleted=true&q=x'. Falsy values are left out.
  function query(params) {
    const parts = Object.keys(params).filter(k => params[k])
      .map(k => k + '=' + encodeURIComponent(params[k] === true ? 'true' : params[k]));
    return parts.length ? '?' + parts.join('&') : '';
  }

  // Marks this tab as logged in as the student a response came back for.
  function shadow(student) {
    sessionSet(STUDENT_SESSION, student.id);
  }

  // "Ananya Sharma" → "Ananya S." (§2.1)
  function leaderboardName(fullName) {
    const w = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (!w.length) return '';
    return w.length === 1 ? w[0] : w[0] + ' ' + w[w.length - 1][0].toUpperCase() + '.';
  }

  // ══════════════════════════════════════════════════════════════
  // PUBLIC API — one method per backend endpoint
  // ══════════════════════════════════════════════════════════════
  const CareerAPI = {
    plans: PLANS,
    leaderboardName: leaderboardName,

    // GET /careers — live, no login. → { careers } the career catalogue
    careers: {
      list() { return http('GET', '/careers'); }
    },

    auth: {
      // POST /auth/register — live
      register(body) {
        return http('POST', '/auth/register', body).then(r => { shadow(r.student); return r; });
      },
      // POST /auth/login — live
      login(body) {
        return http('POST', '/auth/login', body).then(r => { shadow(r.student); return r; });
      },
      // POST /auth/logout — live; the local session ends even if the call fails
      logout() {
        const end = () => sessionSet(STUDENT_SESSION, null);
        return http('POST', '/auth/logout').then(r => { end(); return r; }, e => { end(); throw e; });
      },
      // POST /auth/forgot-password — live; always { ok: true }, account or not
      forgotPassword(body) { return http('POST', '/auth/forgot-password', { email: body.email }); },
      // POST /auth/reset-password — live; ends every session of that student
      resetPassword(body) {
        return http('POST', '/auth/reset-password',
          { email: body.email, code: body.code, new_password: body.new_password })
          .then(r => { sessionSet(STUDENT_SESSION, null); return r; });
      },
      // Is there a session at all? (No round trip.) The cookie is httpOnly, so
      // this is the flag set at login; a 401 from the API clears it.
      hasSession() { return !!sessionGet(STUDENT_SESSION); }
    },

    me: {
      // GET /me — live
      get() { return http('GET', '/me').then(r => { shadow(r.student); return r; }); },
      // PUT /me — live. Changes the name (and so the leaderboard name). → { student }
      setName(fullName) {
        return http('PUT', '/me', { full_name: fullName }).then(r => { shadow(r.student); return r; });
      },
      // GET /me/access — live
      access() { return http('GET', '/me/access'); },
      // GET /me/profile — live. → { profile } (null before onboarding)
      profile() { return http('GET', '/me/profile'); },
      // PUT /me/profile — live. class is required; other answers only change
      // when sent. → { profile }
      saveProfile(fields) { return http('PUT', '/me/profile', fields); },
      // PUT /me/career — live. The career quiz's top career; career
      // leaderboards group by it.
      setCareer(career) { return http('PUT', '/me/career', { career: career }); },
      // POST /me/career-quiz — live. Saves a quiz run and sets the career
      // to its top career. → { id, current_career }
      saveCareerQuiz(run) { return http('POST', '/me/career-quiz', run); },
      // GET /me/career-quiz/latest — live. → { result } (null before the first run)
      latestCareerQuiz() { return http('GET', '/me/career-quiz/latest'); },
      // GET /me/career-quiz/runs — live. → { results } (the kept 2 runs, newest first)
      careerQuizRuns() { return http('GET', '/me/career-quiz/runs'); },
      // GET /roadmaps — live. → { roadmaps: [{ career, emoji }] } for the picker
      roadmaps() { return http('GET', '/roadmaps'); },
      // GET /roadmap?career= — live. → { roadmap: { career, emoji, steps } }; 404 not_found if none
      roadmap(career) { return http('GET', '/roadmap' + query({ career: career })); },
      // GET /career-news?career= — live. → { career, categories: [{ key, label, items }], sources, updated_at }
      careerNews(career) { return http('GET', '/career-news' + query({ career: career })); },
      // PUT /me/school — live; code '' / null clears it. → { student, access }
      setSchool(code) {
        return http('PUT', '/me/school', { school_code: code || null }).then(r => { shadow(r.student); return r; });
      }
    },

    // ══════════════════════════════════════════════════════════════
    // ADMIN — live. Every call but login needs the admin session cookie
    // (careerai_admin_session), separate from the student one.
    // ══════════════════════════════════════════════════════════════
    admin: {
      // POST /admin/auth/login
      login(body) { return http('POST', '/admin/auth/login', { email: body.email, password: body.password }); },
      // POST /admin/auth/forgot-password — always { ok: true }, admin or not
      forgotPassword(body) { return http('POST', '/admin/auth/forgot-password', { email: body.email }); },
      // POST /admin/auth/reset-password — ends every session of that admin
      resetPassword(body) {
        return http('POST', '/admin/auth/reset-password',
          { email: body.email, code: body.code, new_password: body.new_password });
      },
      // POST /admin/auth/logout
      logout() { return http('POST', '/admin/auth/logout'); },
      // GET /admin/me
      me() { return http('GET', '/admin/me'); },
      // GET /admin/overview
      overview() { return http('GET', '/admin/overview'); },

      contests: {
        // GET /admin/contests?deleted=
        list(opts) { return http('GET', '/admin/contests' + query({ deleted: opts && opts.deleted })); },
        // GET /admin/contests/:id
        get(id) { return http('GET', '/admin/contests/' + id); },
        // POST /admin/contests  { date: Saturday 'YYYY-MM-DD' }
        create(body) { return http('POST', '/admin/contests', { date: body.date }); },
        // PUT /admin/contests/:id/questions/:position
        saveQuestion(id, position, q) { return http('PUT', '/admin/contests/' + id + '/questions/' + position, q); },
        // POST /admin/contests/:id/schedule
        schedule(id) { return http('POST', '/admin/contests/' + id + '/schedule'); },
        // POST /admin/contests/:id/unschedule — back to draft, only before it opens
        unschedule(id) { return http('POST', '/admin/contests/' + id + '/unschedule'); },
        // DELETE /admin/contests/:id?mode=soft|hard
        remove(id, mode) { return http('DELETE', '/admin/contests/' + id + query({ mode: mode })); },
        // POST /admin/contests/:id/restore
        restore(id) { return http('POST', '/admin/contests/' + id + '/restore'); }
      },

      schools: {
        // GET /admin/schools?deleted=&q=
        list(opts) { return http('GET', '/admin/schools' + query({ deleted: opts && opts.deleted, q: opts && opts.q })); },
        // GET /admin/schools/:id
        get(id) { return http('GET', '/admin/schools/' + id); },
        // POST /admin/schools
        create(data) { return http('POST', '/admin/schools', data); },
        // PUT /admin/schools/:id
        update(id, data) { return http('PUT', '/admin/schools/' + id, data); },
        // DELETE /admin/schools/:id?mode=soft|hard
        remove(id, mode) { return http('DELETE', '/admin/schools/' + id + query({ mode: mode })); },
        // POST /admin/schools/:id/restore
        restore(id) { return http('POST', '/admin/schools/' + id + '/restore'); }
      },

      roster: {
        // GET /admin/schools/:id/roster
        list(schoolId) { return http('GET', '/admin/schools/' + schoolId + '/roster'); },
        // POST /admin/schools/:id/roster — CSV text, one email per line
        upload(schoolId, text) { return http('POST', '/admin/schools/' + schoolId + '/roster', String(text || ''), 'text/csv'); },
        // DELETE /admin/schools/:id/roster/:email
        remove(schoolId, email) {
          return http('DELETE', '/admin/schools/' + schoolId + '/roster/' + encodeURIComponent(email));
        }
      },

      subscriptions: {
        // GET /admin/schools/:id/subscriptions
        list(schoolId) { return http('GET', '/admin/schools/' + schoolId + '/subscriptions'); },
        // POST /admin/schools/:id/subscriptions — records a payment the school
        // made. The form takes rupees; the API takes paise.
        create(schoolId, body) {
          const rupees = body.amount_rupees === '' || body.amount_rupees == null ? NaN : Number(body.amount_rupees);
          return http('POST', '/admin/schools/' + schoolId + '/subscriptions', {
            starts_at: body.starts_at, ends_at: body.ends_at,
            amount_paise: Number.isFinite(rupees) ? Math.round(rupees * 100) : null,
            payment_provider: body.payment_provider || 'invoice', payment_ref: body.payment_ref
          }).catch(e => { if (e.field === 'amount_paise') e.field = 'amount_rupees'; throw e; });
        }
      },

      students: {
        // GET /admin/students?deleted=&q=
        list(opts) { return http('GET', '/admin/students' + query({ deleted: opts && opts.deleted, q: opts && opts.q })); },
        // GET /admin/students/:id
        get(id) { return http('GET', '/admin/students/' + encodeURIComponent(id)); },
        // DELETE /admin/students/:id?mode=soft|hard
        remove(id, mode) { return http('DELETE', '/admin/students/' + encodeURIComponent(id) + query({ mode: mode })); },
        // POST /admin/students/:id/restore
        restore(id) { return http('POST', '/admin/students/' + encodeURIComponent(id) + '/restore'); },
        // GET /admin/students/:id/subscriptions — their individual payments
        payments(id) { return http('GET', '/admin/students/' + encodeURIComponent(id) + '/subscriptions'); },
        // POST /admin/students/:id/subscriptions — records a payment the student
        // made outside the website. The form takes rupees; the API takes paise.
        recordPayment(id, body) {
          const rupees = body.amount_rupees === '' || body.amount_rupees == null ? NaN : Number(body.amount_rupees);
          return http('POST', '/admin/students/' + encodeURIComponent(id) + '/subscriptions', {
            plan: body.plan, starts_at: body.starts_at, ends_at: body.ends_at,
            amount_paise: Number.isFinite(rupees) ? Math.round(rupees * 100) : null,
            payment_provider: body.payment_provider, payment_ref: body.payment_ref
          }).catch(e => { if (e.field === 'amount_paise') e.field = 'amount_rupees'; throw e; });
        }
      },

      admins: {
        // GET /admin/admins?deleted=
        list(opts) { return http('GET', '/admin/admins' + query({ deleted: opts && opts.deleted })); },
        // POST /admin/admins
        create(body) {
          return http('POST', '/admin/admins', { full_name: body.full_name, email: body.email, password: body.password });
        },
        // DELETE /admin/admins/:id?mode=soft|hard
        remove(id, mode) { return http('DELETE', '/admin/admins/' + encodeURIComponent(id) + query({ mode: mode })); },
        // POST /admin/admins/:id/restore
        restore(id) { return http('POST', '/admin/admins/' + encodeURIComponent(id) + '/restore'); }
      },

      // The career is a query parameter: titles like "UI/UX Designer" contain a slash.
      roadmaps: {
        // GET /admin/roadmaps → { careers: [AdminRoadmapRow] }, every career
        list() { return http('GET', '/admin/roadmaps'); },
        // GET /admin/roadmap?career= → { career, roadmap } (roadmap null when none)
        get(career) { return http('GET', '/admin/roadmap' + query({ career: career })); },
        // PUT /admin/roadmap?career=  { steps, version } → { career, roadmap }; 409 roadmap_changed
        save(career, steps, version) {
          return http('PUT', '/admin/roadmap' + query({ career: career }), { steps: steps, version: version });
        },
        // DELETE /admin/roadmap?career=
        remove(career) { return http('DELETE', '/admin/roadmap' + query({ career: career })); }
      }
    }
  };

  root.CareerAPI = CareerAPI;
})(typeof globalThis !== 'undefined' ? globalThis : this);
