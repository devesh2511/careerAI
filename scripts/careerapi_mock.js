// ══════════════════════════════════════════════════════════════
// CAREERAPI — ACCOUNTS, ACCESS, BILLING AND ADMIN DATA LAYER
//
// Every screen outside the weekly contest talks to the backend ONLY through
// window.CareerAPI. Each method returns a Promise shaped like the HTTP
// endpoint in careerAPI/docs/database-schema.md §11, so swapping this mock
// for real fetch() calls is a change to this file alone.
//
// LIVE: the endpoints the backend has built call the production API at
// API_BASE (session = httpOnly cookie, so fetch uses credentials: 'include'):
//   POST /auth/register   POST /auth/login   POST /auth/logout
//   GET  /me              GET  /me/access      PUT /me/career    PUT /me/school
//   every /admin/* endpoint (CareerAPI.admin), with its own admin cookie
// As more endpoints ship, move their methods from reply(...) to http(...).
//
// Payments happen outside the website: an admin records each one in the
// admin panel, and that is what grants access. There is no checkout here.
//
// Only DELETE /me is still a MOCK SERVER that runs in the browser and keeps
// its tables in localStorage. A live login copies the student into it (see
// shadow()) so it can find them.
//
// Errors reject with an Error carrying .status (HTTP) and .code (API code).
//
// Demo accounts — MOCK ONLY: student login is live now, so these students
// don't exist on production; register a real account instead.
// (password for all students: password123)
//   ananya.sharma@dps.edu.in  School ID DPS-RKP, on roster, school paid → access
//   priya.k@kvpowai.edu.in    School ID KV-POWAI, school hasn't paid    → paywall
//   rahul.verma@gmail.com     no school                                 → paywall
//   arjun.nair@gmail.com      paid individually                         → access
// Admins are live too: the first one is created with `npm run create-admin`
// in the careerAPI repo.
//
// CareerAPI.resetDemo() in the console restores the seed data.
// ══════════════════════════════════════════════════════════════
(function (root) {
  'use strict';

  // Production careerAPI (careerAPI repo, deployed on Vercel). On the deployed
  // site, vercel.json proxies /api to it, so the session cookie is first-party
  // (Safari and other browsers that block third-party cookies drop it
  // otherwise). Local dev (Live Server, file://) has no proxy, so it calls the
  // API directly.
  const API_ORIGIN = 'https://careerapi.vercel.app';
  const API_BASE = /^(localhost|127\.0\.0\.1|)$/.test(root.location ? root.location.hostname : '')
    ? API_ORIGIN : '/api';

  const DB_KEY = 'careerai_api_mock';
  const STUDENT_SESSION = 'careerai_session';
  const DB_VERSION = 1;
  const LATENCY = 150;                       // fake network delay, ms
  const HOUR = 3600e3, DAY = 24 * HOUR;

  // Prices are placeholders until the business sets them.
  const PLANS = {
    student_monthly: { plan: 'student_monthly', label: 'Monthly', amount_paise: 19900, months: 1 },
    student_annual: { plan: 'student_annual', label: 'Annual', amount_paise: 149900, months: 12 }
  };

  // Server time when contest_api.js is loaded (it syncs with the API).
  function now() { return root.ContestAPI ? root.ContestAPI.now() : Date.now(); }
  function iso(t) { return new Date(t).toISOString(); }
  function addMonths(t, m) { const d = new Date(t); d.setUTCMonth(d.getUTCMonth() + m); return d.getTime(); }

  // ── Storage ─────────────────────────────────────────────────────────────
  let db = null;
  function load() {
    if (db) return db;
    try { db = JSON.parse(localStorage.getItem(DB_KEY)); } catch (e) { db = null; }
    if (!db || db.v !== DB_VERSION) { db = seed(); save(); }
    return db;
  }
  function save() { try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) { } }
  function nextId(table) { load(); db.seq[table] = (db.seq[table] || 0) + 1; return db.seq[table]; }
  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }
  function sessionGet(key) { try { return sessionStorage.getItem(key); } catch (e) { return null; } }
  function sessionSet(key, v) { try { v == null ? sessionStorage.removeItem(key) : sessionStorage.setItem(key, v); } catch (e) { } }

  // ── Seed data ───────────────────────────────────────────────────────────
  function seed() {
    const t = Date.now();
    const d = {
      v: DB_VERSION, seq: {}, schools: [], roster: [], subscriptions: [],
      students: [], admins: []
    };
    db = d;
    const ts = iso(t - 30 * DAY);
    const admin = {
      id: uuid(), email: 'admin@careerai.in', full_name: 'Meera Iyer', password: 'admin123',
      last_login_at: null, is_deleted: false, deleted_at: null, created_at: ts
    };
    d.admins.push(admin,
      { id: uuid(), email: 'karan@careerai.in', full_name: 'Karan Malhotra', password: 'admin123',
        last_login_at: iso(t - 3 * DAY), is_deleted: false, deleted_at: null, created_at: ts });

    function school(o) {
      const s = Object.assign({
        id: nextId('schools'), udise_code: null, board: 'CBSE', status: 'active',
        contact_phone: null, created_by: admin.id, is_deleted: false, deleted_at: null,
        created_at: ts, updated_at: ts
      }, o);
      d.schools.push(s);
      return s;
    }
    const dps = school({ name: 'Delhi Public School, R.K. Puram', school_code: 'DPS-RKP', udise_code: '07050117501',
      city: 'New Delhi', state: 'Delhi', contact_name: 'Dr. Sunita Rao', contact_email: 'principal@dpsrkp.net', contact_phone: '+91 11 2617 1265' });
    const kv = school({ name: 'Kendriya Vidyalaya, IIT Powai', school_code: 'KV-POWAI', city: 'Mumbai', state: 'Maharashtra',
      contact_name: 'Mr. Anil Deshmukh', contact_email: 'kvpowai@kvs.gov.in' });
    school({ name: 'St. Xavier\'s High School', school_code: 'SXHS-BLR', board: 'ICSE', city: 'Bengaluru', state: 'Karnataka',
      status: 'suspended', contact_name: 'Fr. Thomas', contact_email: 'office@sxhs.edu.in' });

    ['ananya.sharma@dps.edu.in', 'rohan.mehta@dps.edu.in', 'isha.gupta@dps.edu.in', 'kabir.singh@dps.edu.in']
      .forEach(e => d.roster.push({ id: nextId('roster'), school_id: dps.id, email: e, added_by: admin.id, created_at: ts }));
    ['priya.k@kvpowai.edu.in', 'aditya.patil@kvpowai.edu.in']
      .forEach(e => d.roster.push({ id: nextId('roster'), school_id: kv.id, email: e, added_by: admin.id, created_at: ts }));

    // School plans run for an academic year, 1 Apr → 1 Apr IST.
    d.subscriptions.push(sub({ payer_type: 'school', school_id: dps.id, plan: 'school_annual',
      starts_at: '2026-03-31T18:30:00.000Z', ends_at: '2027-03-31T18:30:00.000Z', amount_paise: 15000000,
      status: 'active', payment_provider: 'invoice', payment_ref: 'INV-2026-0012' }));
    d.subscriptions.push(sub({ payer_type: 'school', school_id: kv.id, plan: 'school_annual',
      starts_at: '2025-03-31T18:30:00.000Z', ends_at: '2026-03-31T18:30:00.000Z', amount_paise: 6000000,
      status: 'active', payment_provider: 'invoice', payment_ref: 'INV-2025-0031' }));

    function student(o) {
      const s = Object.assign({
        id: uuid(), password: 'password123', school_id: null, current_career: null,
        is_deleted: false, deleted_at: null, created_at: ts
      }, o);
      d.students.push(s);
      return s;
    }
    student({ email: 'ananya.sharma@dps.edu.in', full_name: 'Ananya Sharma', school_id: dps.id, current_career: 'UX Designer' });
    student({ email: 'rohan.mehta@dps.edu.in', full_name: 'Rohan Mehta', school_id: dps.id, current_career: 'Software Engineer' });
    student({ email: 'priya.k@kvpowai.edu.in', full_name: 'Priya Kulkarni', school_id: kv.id });
    student({ email: 'rahul.verma@gmail.com', full_name: 'Rahul Verma' });
    const arjun = student({ email: 'arjun.nair@gmail.com', full_name: 'Arjun Nair', current_career: 'Data Scientist' });
    student({ email: 'neha.joshi@gmail.com', full_name: 'Neha Joshi', is_deleted: true, deleted_at: iso(t - 5 * DAY) });
    d.subscriptions.push(sub({ payer_type: 'student', student_id: arjun.id, plan: 'student_annual',
      starts_at: iso(t - 40 * DAY), ends_at: iso(addMonths(t - 40 * DAY, 12)), amount_paise: PLANS.student_annual.amount_paise,
      status: 'active', payment_provider: 'razorpay', payment_ref: 'pay_Mock' + Math.random().toString(36).slice(2, 10) }));
    // A record whose payer was hard-deleted: kept for GST, no person attached.
    d.subscriptions.push(sub({ payer_type: 'student', plan: 'student_monthly',
      starts_at: iso(t - 70 * DAY), ends_at: iso(addMonths(t - 70 * DAY, 1)), amount_paise: PLANS.student_monthly.amount_paise,
      status: 'active', payment_provider: 'razorpay', payment_ref: 'pay_MockDeleted01' }));
    return d;
  }
  function sub(o) {
    return Object.assign({
      id: nextId('subscriptions'), school_id: null, student_id: null, currency: 'INR',
      created_at: o.starts_at || iso(Date.now()), updated_at: o.starts_at || iso(Date.now())
    }, o);
  }

  // ── Live API ────────────────────────────────────────────────────────────
  // Rejects the same way the mock does: an Error with .status, .code and,
  // for validation errors, .field. JSON body unless contentType is given,
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

  // After a live login, mirror the student into the mock tables under the
  // same id, so the endpoints that are still mocked find them.
  function shadow(student) {
    load();
    let st = db.students.find(s => s.id === student.id);
    if (!st) {
      st = { id: student.id, password: null, current_career: null, is_deleted: false, deleted_at: null,
        created_at: student.created_at || iso(now()) };
      db.students.push(st);
    }
    const sch = student.school && schoolByCode(student.school.school_code);
    Object.assign(st, { email: lower(student.email), full_name: student.full_name,
      school_id: sch ? sch.id : st.school_id || null, is_deleted: false, deleted_at: null });
    save();
    sessionSet(STUDENT_SESSION, student.id);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  function reply(fn) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try { load(); resolve(clone(fn())); } catch (e) { reject(e); }
      }, LATENCY);
    });
  }
  function clone(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }
  function fail(status, code, message, extra) {
    const e = new Error(message);
    e.status = status; e.code = code;
    if (extra) Object.assign(e, extra);
    throw e;
  }
  const lower = s => String(s || '').trim().toLowerCase();
  function normCode(c) { return String(c || '').trim().toUpperCase(); }

  // "Ananya Sharma" → "Ananya S." (§2.1)
  function leaderboardName(fullName) {
    const w = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (!w.length) return '';
    return w.length === 1 ? w[0] : w[0] + ' ' + w[w.length - 1][0].toUpperCase() + '.';
  }

  function schoolByCode(code) {
    const c = normCode(code);
    return db.schools.find(s => s.school_code === c && !s.is_deleted && s.status === 'active') || null;
  }
  function me() {
    const id = sessionGet(STUDENT_SESSION);
    const st = id && db.students.find(s => s.id === id && !s.is_deleted);
    if (!st) { sessionSet(STUDENT_SESSION, null); fail(401, 'unauthenticated', 'Please log in.'); }
    return st;
  }
  function softDelete(row) { row.is_deleted = true; row.deleted_at = iso(now()); }

  // ══════════════════════════════════════════════════════════════
  // PUBLIC API — one method per backend endpoint
  // ══════════════════════════════════════════════════════════════
  const CareerAPI = {
    demo: true,
    plans: PLANS,
    leaderboardName: leaderboardName,

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
      // Is there a session at all? (No round trip.) The cookie is httpOnly, so
      // this is the flag set at login; a 401 from the API clears it.
      hasSession() { return !!sessionGet(STUDENT_SESSION); }
    },

    me: {
      // GET /me — live
      get() { return http('GET', '/me').then(r => { shadow(r.student); return r; }); },
      // GET /me/access — live
      access() { return http('GET', '/me/access'); },
      // PUT /me/career — live. The career quiz's top career; career
      // leaderboards group by it.
      setCareer(career) { return http('PUT', '/me/career', { career: career }); },
      // PUT /me/school — live; code '' / null clears it. → { student, access }
      setSchool(code) {
        return http('PUT', '/me/school', { school_code: code || null }).then(r => { shadow(r.student); return r; });
      },
      // DELETE /me  — a soft delete; an admin can restore it
      remove() {
        return reply(() => {
          const st = me();
          softDelete(st); save();
          sessionSet(STUDENT_SESSION, null);
          return { ok: true };
        });
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
      }
    },

    // ── Mock-only helpers (not part of the backend contract) ──
    resetDemo() {
      try { localStorage.removeItem(DB_KEY); } catch (e) { }
      sessionSet(STUDENT_SESSION, null);
      db = null;
    }
  };

  root.CareerAPI = CareerAPI;
})(typeof globalThis !== 'undefined' ? globalThis : this);
