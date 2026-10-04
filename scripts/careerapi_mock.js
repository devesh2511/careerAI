// ══════════════════════════════════════════════════════════════
// CAREERAPI — ACCOUNTS, ACCESS, BILLING AND ADMIN DATA LAYER
//
// Every screen outside the weekly contest talks to the backend ONLY through
// window.CareerAPI. Each method returns a Promise shaped like the HTTP
// endpoint in careerAPI/docs/database-schema.md §11, so swapping this mock
// for real fetch() calls is a change to this file alone.
//
// Right now there is no backend, so everything below the API surface is a
// MOCK SERVER that runs in the browser and keeps its tables in localStorage.
// It enforces the same rules the database will:
//   • access = active individual plan, OR School ID + email on that
//     school's roster + an active school plan (§6.4)
//   • soft delete (is_deleted) vs hard delete; payment records survive a
//     hard delete with the payer cleared (§6.3, §7)
//   • contests open Saturday 07:00 IST, lock once open, schedule needs 5
//     questions (§5)
//
// Errors reject with an Error carrying .status (HTTP) and .code (API code).
//
// Demo accounts (password for all students: password123)
//   ananya.sharma@dps.edu.in  School ID DPS-RKP, on roster, school paid → access
//   priya.k@kvpowai.edu.in    School ID KV-POWAI, school hasn't paid    → paywall
//   rahul.verma@gmail.com     no school                                 → paywall
//   arjun.nair@gmail.com      paid individually                         → access
//   admin@careerai.in / admin123                                        → admin panel
//
// CareerAPI.resetDemo() in the console restores the seed data.
// ══════════════════════════════════════════════════════════════
(function (root) {
  'use strict';

  const DB_KEY = 'careerai_api_mock';
  const STUDENT_SESSION = 'careerai_session';
  const ADMIN_SESSION = 'careerai_admin_session';
  const DB_VERSION = 1;
  const LATENCY = 150;                       // fake network delay, ms
  const HOUR = 3600e3, DAY = 24 * HOUR, WEEK = 7 * DAY;
  // Contest #1 opened Saturday 5 Sep 2026, 07:00 IST — same calendar as contest_api.js.
  const CONTEST_EPOCH = Date.UTC(2026, 8, 5, 1, 30);
  const CONTEST_WINDOW = 36 * HOUR;
  const AREAS = ['Logical Reasoning', 'Numerical Ability', 'Verbal Ability', 'Spatial Reasoning'];

  // Prices are placeholders until the business sets them.
  const PLANS = {
    student_monthly: { plan: 'student_monthly', label: 'Monthly', amount_paise: 19900, months: 1 },
    student_annual: { plan: 'student_annual', label: 'Annual', amount_paise: 149900, months: 12 }
  };

  // The contest mock owns the clock when it is loaded, so ?now= testing
  // moves contest locking here too.
  function now() { return root.ContestAPI ? root.ContestAPI.now() : Date.now(); }
  function iso(t) { return new Date(t).toISOString(); }
  function addMonths(t, m) { const d = new Date(t); d.setUTCMonth(d.getUTCMonth() + m); return d.getTime(); }

  // ── Storage ─────────────────────────────────────────────────────────────
  let db = null;
  function load() {
    if (db) return db;
    try { db = JSON.parse(localStorage.getItem(DB_KEY)); } catch (e) { db = null; }
    if (!db || db.v !== DB_VERSION) { db = seed(); save(); }
    if (db.bank_pending && root.ContestAPI && root.ContestAPI.mockQuestionSet) { fillBank(); save(); }
    return db;
  }
  // Seeded contests take their questions from the contest mock's bank. If the
  // seed ran on a page without contest_api.js, they are filled in on the
  // first page that has it.
  function fillBank() {
    db.contests.forEach(c => {
      if (c.questions.length || !c.seeded) return;
      const n = c.id, bank = root.ContestAPI.mockQuestionSet(n);
      c.questions = (c.status === 'draft' ? bank.slice(0, 2) : bank).map((q, i) => ({
        id: 'c' + n + '-q' + (i + 1), position: i + 1, area: q.area, text: q.text,
        options: q.options.slice(), correct_index: q.correct, explanation: q.explanation
      }));
    });
    db.bank_pending = false;
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
      students: [], admins: [], contests: []
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

    // Contests: every week so far is scheduled (questions from the contest
    // mock's bank when it is loaded), and next week is a half-written draft.
    const current = Math.max(1, Math.floor((t - CONTEST_EPOCH) / WEEK) + 1);
    for (let n = 1; n <= current + 1; n++) {
      const open = CONTEST_EPOCH + (n - 1) * WEEK;
      d.contests.push({
        id: nextId('contests'), opens_at: iso(open), closes_at: iso(open + CONTEST_WINDOW),
        status: n === current + 1 ? 'draft' : 'scheduled',
        scored_at: open + CONTEST_WINDOW < t ? iso(open + CONTEST_WINDOW + 60e3) : null,
        created_by: admin.id, is_deleted: false, deleted_at: null, created_at: iso(open - 6 * DAY),
        seeded: true, questions: []
      });
    }
    d.bank_pending = true;
    if (root.ContestAPI && root.ContestAPI.mockQuestionSet) fillBank();
    return d;
  }
  function sub(o) {
    return Object.assign({
      id: nextId('subscriptions'), school_id: null, student_id: null, currency: 'INR',
      created_at: o.starts_at || iso(Date.now()), updated_at: o.starts_at || iso(Date.now())
    }, o);
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
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function normCode(c) { return String(c || '').trim().toUpperCase(); }

  // "Ananya Sharma" → "Ananya S." (§2.1)
  function leaderboardName(fullName) {
    const w = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (!w.length) return '';
    return w.length === 1 ? w[0] : w[0] + ' ' + w[w.length - 1][0].toUpperCase() + '.';
  }

  function liveSchool(id) { return db.schools.find(s => s.id === id && !s.is_deleted) || null; }
  function schoolByCode(code) {
    const c = normCode(code);
    return db.schools.find(s => s.school_code === c && !s.is_deleted && s.status === 'active') || null;
  }
  function onRoster(schoolId, email) {
    return db.roster.some(r => r.school_id === schoolId && lower(r.email) === lower(email));
  }
  function activeSub(pred) {
    const t = now();
    return db.subscriptions
      .filter(s => s.status === 'active' && Date.parse(s.starts_at) <= t && t < Date.parse(s.ends_at) && pred(s))
      .sort((a, b) => Date.parse(b.ends_at) - Date.parse(a.ends_at))[0] || null;
  }

  // The access check (§6.4), plus the reason the paywall needs.
  function accessOf(st) {
    const own = activeSub(s => s.student_id === st.id);
    const sch = st.school_id ? liveSchool(st.school_id) : null;
    const schOk = sch && sch.status === 'active';
    const listed = sch ? onRoster(sch.id, st.email) : false;
    const schSub = schOk && listed ? activeSub(s => s.school_id === sch.id) : null;
    const school = sch ? { name: sch.name, school_code: sch.school_code } : null;
    if (schSub) return { has_access: true, source: 'school', reason: null, school: school, ends_at: schSub.ends_at, plan: schSub.plan };
    if (own) return { has_access: true, source: 'individual', reason: null, school: school, ends_at: own.ends_at, plan: own.plan };
    let reason = 'no_school';
    if (sch && !listed) reason = 'not_on_roster';
    else if (sch) reason = 'school_not_subscribed';
    return { has_access: false, source: null, reason: reason, school: school, ends_at: null, plan: null };
  }

  function studentDTO(st) {
    const sch = st.school_id ? liveSchool(st.school_id) : null;
    return {
      id: st.id, full_name: st.full_name, leaderboard_name: leaderboardName(st.full_name), email: st.email,
      school: sch ? { name: sch.name, school_code: sch.school_code } : null,
      current_career: st.current_career, created_at: st.created_at
    };
  }

  function me() {
    const id = sessionGet(STUDENT_SESSION);
    const st = id && db.students.find(s => s.id === id && !s.is_deleted);
    if (!st) { sessionSet(STUDENT_SESSION, null); fail(401, 'unauthenticated', 'Please log in.'); }
    return st;
  }
  function meAdmin() {
    const id = sessionGet(ADMIN_SESSION);
    const a = id && db.admins.find(x => x.id === id && !x.is_deleted);
    if (!a) { sessionSet(ADMIN_SESSION, null); fail(401, 'unauthenticated', 'Please log in as an admin.'); }
    return a;
  }
  function softDelete(row) { row.is_deleted = true; row.deleted_at = iso(now()); }
  function restore(row) { row.is_deleted = false; row.deleted_at = null; }
  function needMode(mode) {
    if (mode !== 'soft' && mode !== 'hard') fail(400, 'bad_mode', 'Delete mode must be soft or hard.');
  }

  // ── Contest helpers ─────────────────────────────────────────────────────
  function contestState(c) {
    const t = now(), o = Date.parse(c.opens_at), cl = Date.parse(c.closes_at);
    return t < o ? 'upcoming' : t < cl ? 'open' : 'closed';
  }
  function contestDTO(c, withQuestions) {
    const out = {
      id: c.id, opens_at: c.opens_at, closes_at: c.closes_at, status: c.status, scored_at: c.scored_at,
      state: contestState(c), locked: Date.parse(c.opens_at) <= now(),
      question_count: c.questions.length, is_deleted: c.is_deleted, deleted_at: c.deleted_at, created_at: c.created_at,
      created_by: (db.admins.find(a => a.id === c.created_by) || {}).full_name || null
    };
    if (withQuestions) out.questions = c.questions.slice().sort((a, b) => a.position - b.position);
    return out;
  }
  function findContest(id) {
    const c = db.contests.find(x => x.id === Number(id));
    if (!c) fail(404, 'not_found', 'No such contest.');
    return c;
  }
  function lockCheck(c) {
    if (Date.parse(c.opens_at) <= now()) fail(409, 'contest_locked', 'This contest has opened, so its questions can no longer change.');
  }

  function findSchool(id) {
    const s = db.schools.find(x => x.id === Number(id));
    if (!s) fail(404, 'not_found', 'No such school.');
    return s;
  }
  function schoolDTO(s) {
    const subNow = activeSub(x => x.school_id === s.id);
    const latest = db.subscriptions.filter(x => x.school_id === s.id && x.status === 'active')
      .sort((a, b) => Date.parse(b.ends_at) - Date.parse(a.ends_at))[0] || null;
    return Object.assign({}, s, {
      roster_count: db.roster.filter(r => r.school_id === s.id).length,
      student_count: db.students.filter(x => x.school_id === s.id && !x.is_deleted).length,
      subscription: subNow ? { active: true, plan: subNow.plan, ends_at: subNow.ends_at }
        : latest ? { active: false, plan: latest.plan, ends_at: latest.ends_at } : null
    });
  }
  function validateSchool(data, selfId) {
    const out = {};
    const req = (k, label) => {
      const v = String(data[k] == null ? '' : data[k]).trim();
      if (!v) fail(400, 'invalid', label + ' is required.', { field: k });
      return v;
    };
    out.name = req('name', 'School name');
    out.school_code = normCode(req('school_code', 'School ID'));
    if (!/^[A-Z0-9-]{3,20}$/.test(out.school_code))
      fail(400, 'invalid', 'School ID must be 3–20 letters, digits or dashes.', { field: 'school_code' });
    if (db.schools.some(s => s.school_code === out.school_code && s.id !== selfId))
      fail(409, 'school_code_taken', 'Another school already uses this School ID.', { field: 'school_code' });
    const ud = String(data.udise_code || '').trim();
    if (ud && !/^[0-9]{11}$/.test(ud)) fail(400, 'invalid', 'UDISE+ code must be 11 digits.', { field: 'udise_code' });
    if (ud && db.schools.some(s => s.udise_code === ud && s.id !== selfId))
      fail(409, 'udise_taken', 'A school with this UDISE+ code already exists.', { field: 'udise_code' });
    out.udise_code = ud || null;
    out.board = ['CBSE', 'ICSE', 'State Board'].includes(data.board) ? data.board : null;
    out.city = req('city', 'City');
    out.state = req('state', 'State');
    out.status = data.status === 'suspended' ? 'suspended' : 'active';
    out.contact_name = req('contact_name', 'Contact name');
    out.contact_email = req('contact_email', 'Contact email');
    if (!EMAIL_RE.test(out.contact_email)) fail(400, 'invalid', 'Contact email looks wrong.', { field: 'contact_email' });
    out.contact_phone = String(data.contact_phone || '').trim() || null;
    return out;
  }

  // ══════════════════════════════════════════════════════════════
  // PUBLIC API — one method per backend endpoint
  // ══════════════════════════════════════════════════════════════
  const CareerAPI = {
    demo: true,
    plans: PLANS,
    leaderboardName: leaderboardName,

    auth: {
      // POST /auth/register
      register(body) {
        return reply(() => {
          const full_name = String(body.full_name || '').trim().replace(/\s+/g, ' ');
          const email = lower(body.email);
          if (!full_name) fail(400, 'invalid', 'Please enter your full name.', { field: 'full_name' });
          if (!EMAIL_RE.test(email)) fail(400, 'invalid', 'Please enter a valid email.', { field: 'email' });
          if (String(body.password || '').length < 8) fail(400, 'invalid', 'Password must be at least 8 characters.', { field: 'password' });
          if (db.students.some(s => lower(s.email) === email))
            fail(409, 'email_taken', 'An account with this email already exists. Try logging in.', { field: 'email' });
          let schoolId = null;
          if (String(body.school_code || '').trim()) {
            const s = schoolByCode(body.school_code);
            if (!s) fail(400, 'unknown_school_id', 'We couldn\'t find that School ID. Check it with your school, or leave it blank.', { field: 'school_code' });
            schoolId = s.id;
          }
          const st = { id: uuid(), email: email, full_name: full_name, password: String(body.password), school_id: schoolId,
            current_career: null, is_deleted: false, deleted_at: null, created_at: iso(now()) };
          db.students.push(st); save();
          sessionSet(STUDENT_SESSION, st.id);
          return { student: studentDTO(st), access: accessOf(st) };
        });
      },
      // POST /auth/login
      login(body) {
        return reply(() => {
          const st = db.students.find(s => lower(s.email) === lower(body.email));
          // Same message for unknown email, wrong password and closed account.
          if (!st || st.is_deleted || st.password !== String(body.password || ''))
            fail(401, 'bad_credentials', 'Email or password is incorrect.');
          sessionSet(STUDENT_SESSION, st.id);
          return { student: studentDTO(st), access: accessOf(st) };
        });
      },
      // POST /auth/logout
      logout() { return reply(() => { sessionSet(STUDENT_SESSION, null); return { ok: true }; }); },
      // Mock-only: is there a session cookie at all? (No round trip.)
      hasSession() { return !!sessionGet(STUDENT_SESSION); }
    },

    me: {
      // GET /me
      get() { return reply(() => ({ student: studentDTO(me()) })); },
      // GET /me/access
      access() { return reply(() => accessOf(me())); },
      // PUT /me/school  — code '' / null clears it
      setSchool(code) {
        return reply(() => {
          const st = me();
          if (!String(code || '').trim()) st.school_id = null;
          else {
            const s = schoolByCode(code);
            if (!s) fail(400, 'unknown_school_id', 'We couldn\'t find that School ID. Check it with your school.', { field: 'school_code' });
            st.school_id = s.id;
          }
          save();
          return { student: studentDTO(st), access: accessOf(st) };
        });
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

    billing: {
      // POST /billing/checkout
      checkout(plan) {
        return reply(() => {
          const st = me();
          const p = PLANS[plan];
          if (!p) fail(400, 'bad_plan', 'Unknown plan.');
          if (accessOf(st).has_access) fail(409, 'already_has_access', 'You already have access.');
          const s = sub({ payer_type: 'student', student_id: st.id, plan: p.plan, starts_at: iso(now()),
            ends_at: iso(addMonths(now(), p.months)), amount_paise: p.amount_paise, status: 'pending',
            payment_provider: 'razorpay', payment_ref: 'order_Mock' + Math.random().toString(36).slice(2, 12) });
          db.subscriptions.push(s); save();
          return { order_id: s.payment_ref, amount_paise: s.amount_paise, currency: 'INR', plan: p.plan };
        });
      },
      // Mock-only: stands in for the Razorpay checkout + POST /billing/webhook.
      mockPay(orderId, succeed) {
        return reply(() => {
          const st = me();
          const s = db.subscriptions.find(x => x.payment_ref === orderId && x.student_id === st.id);
          if (!s || s.status !== 'pending') fail(404, 'not_found', 'No such order.');
          s.status = succeed ? 'active' : 'failed';
          if (succeed) {             // the plan runs from the moment payment lands
            s.starts_at = iso(now());
            s.ends_at = iso(addMonths(now(), PLANS[s.plan].months));
          }
          s.updated_at = iso(now()); save();
          return { status: s.status, access: accessOf(st) };
        });
      }
    },

    // ══════════════════════════════════════════════════════════════
    // ADMIN — every call needs an admin session
    // ══════════════════════════════════════════════════════════════
    admin: {
      // POST /admin/auth/login
      login(body) {
        return reply(() => {
          const a = db.admins.find(x => lower(x.email) === lower(body.email));
          if (!a || a.is_deleted || a.password !== String(body.password || ''))
            fail(401, 'bad_credentials', 'Email or password is incorrect.');
          a.last_login_at = iso(now()); save();
          sessionSet(ADMIN_SESSION, a.id);
          return { admin: { id: a.id, email: a.email, full_name: a.full_name } };
        });
      },
      // POST /admin/auth/logout
      logout() { return reply(() => { sessionSet(ADMIN_SESSION, null); return { ok: true }; }); },
      me() { return reply(() => { const a = meAdmin(); return { admin: { id: a.id, email: a.email, full_name: a.full_name } }; }); },

      // GET /admin/overview
      overview() {
        return reply(() => {
          meAdmin();
          const live = db.students.filter(s => !s.is_deleted);
          const withAccess = live.filter(s => accessOf(s).has_access);
          const upcoming = db.contests.filter(c => !c.is_deleted && contestState(c) !== 'closed')
            .sort((a, b) => Date.parse(a.opens_at) - Date.parse(b.opens_at));
          return {
            students: live.length,
            students_with_access: withAccess.length,
            students_via_school: withAccess.filter(s => accessOf(s).source === 'school').length,
            schools: db.schools.filter(s => !s.is_deleted).length,
            schools_paying: db.schools.filter(s => !s.is_deleted && activeSub(x => x.school_id === s.id)).length,
            next_contests: upcoming.slice(0, 3).map(c => contestDTO(c)),
            drafts_needing_questions: db.contests.filter(c => !c.is_deleted && c.status === 'draft').map(c => contestDTO(c))
          };
        });
      },

      contests: {
        // GET /admin/contests
        list(opts) {
          return reply(() => {
            meAdmin();
            const del = !!(opts && opts.deleted);
            return db.contests.filter(c => c.is_deleted === del)
              .sort((a, b) => Date.parse(b.opens_at) - Date.parse(a.opens_at)).map(c => contestDTO(c));
          });
        },
        get(id) { return reply(() => { meAdmin(); return contestDTO(findContest(id), true); }); },
        // POST /admin/contests  { opens_at: Saturday date 'YYYY-MM-DD' }
        create(body) {
          return reply(() => {
            const a = meAdmin();
            const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(body.date || ''));
            if (!m) fail(400, 'invalid', 'Pick a Saturday.', { field: 'date' });
            // 07:00 IST on that date = 01:30 UTC.
            const open = Date.UTC(+m[1], +m[2] - 1, +m[3], 1, 30);
            if (new Date(open + 5.5 * HOUR).getUTCDay() !== 6) fail(400, 'invalid', 'Contests open on a Saturday.', { field: 'date' });
            if (open <= now()) fail(400, 'invalid', 'Pick a Saturday in the future.', { field: 'date' });
            if (db.contests.some(c => !c.is_deleted && c.opens_at === iso(open)))
              fail(409, 'week_taken', 'There is already a contest that week.', { field: 'date' });
            const c = { id: nextId('contests'), opens_at: iso(open), closes_at: iso(open + CONTEST_WINDOW), status: 'draft',
              scored_at: null, created_by: a.id, is_deleted: false, deleted_at: null, created_at: iso(now()), questions: [] };
            db.contests.push(c); save();
            return contestDTO(c, true);
          });
        },
        // PUT /admin/contests/:id/questions/:position
        saveQuestion(id, position, q) {
          return reply(() => {
            meAdmin();
            const c = findContest(id);
            lockCheck(c);
            const pos = Number(position);
            if (!(pos >= 1 && pos <= 5)) fail(400, 'invalid', 'Position must be 1–5.');
            if (!AREAS.includes(q.area)) fail(400, 'invalid', 'Pick an area.', { field: 'area' });
            if (!String(q.text || '').trim()) fail(400, 'invalid', 'Write the question.', { field: 'text' });
            const opts = (q.options || []).map(o => String(o || '').trim());
            if (opts.length !== 4 || opts.some(o => !o)) fail(400, 'invalid', 'Fill in all 4 options.', { field: 'options' });
            if (new Set(opts.map(lower)).size !== 4) fail(400, 'invalid', 'The 4 options must be different.', { field: 'options' });
            // null/'' must not coerce to 0 (option A)
            const ci = q.correct_index == null || q.correct_index === '' ? NaN : Number(q.correct_index);
            if (!(ci >= 0 && ci <= 3)) fail(400, 'invalid', 'Mark the correct option.', { field: 'correct_index' });
            if (!String(q.explanation || '').trim()) fail(400, 'invalid', 'Write the explanation students see after close.', { field: 'explanation' });
            const row = { id: 'c' + c.id + '-q' + pos, position: pos, area: q.area,
              text: String(q.text).trim(), options: opts, correct_index: ci, explanation: String(q.explanation).trim() };
            c.questions = c.questions.filter(x => x.position !== pos).concat(row);
            save();
            return contestDTO(c, true);
          });
        },
        // POST /admin/contests/:id/schedule
        schedule(id) {
          return reply(() => {
            meAdmin();
            const c = findContest(id);
            lockCheck(c);
            if (c.questions.length !== 5) fail(409, 'needs_5_questions', 'Add all 5 questions before scheduling.');
            c.status = 'scheduled'; save();
            return contestDTO(c, true);
          });
        },
        // POST /admin/contests/:id/unschedule — back to draft, only before it opens
        unschedule(id) {
          return reply(() => {
            meAdmin();
            const c = findContest(id);
            lockCheck(c);
            c.status = 'draft'; save();
            return contestDTO(c, true);
          });
        },
        // DELETE /admin/contests/:id?mode=soft|hard
        remove(id, mode) {
          return reply(() => {
            meAdmin(); needMode(mode);
            const c = findContest(id);
            if (mode === 'hard') {
              if (Date.parse(c.opens_at) <= now())
                fail(409, 'contest_locked', 'An opened contest can only be soft-deleted, because students have attempts on it.');
              db.contests = db.contests.filter(x => x !== c);
            } else softDelete(c);
            save();
            return { ok: true };
          });
        },
        restore(id) {
          return reply(() => {
            meAdmin();
            const c = findContest(id);
            if (db.contests.some(x => x !== c && !x.is_deleted && x.opens_at === c.opens_at))
              fail(409, 'week_taken', 'Another contest now uses that week.');
            restore(c); save();
            return contestDTO(c);
          });
        }
      },

      schools: {
        // GET /admin/schools
        list(opts) {
          return reply(() => {
            meAdmin();
            const del = !!(opts && opts.deleted), q = lower(opts && opts.q);
            return db.schools.filter(s => s.is_deleted === del)
              .filter(s => !q || lower(s.name + ' ' + s.school_code + ' ' + s.city).includes(q))
              .sort((a, b) => a.name.localeCompare(b.name)).map(schoolDTO);
          });
        },
        get(id) { return reply(() => { meAdmin(); return schoolDTO(findSchool(id)); }); },
        // POST /admin/schools
        create(data) {
          return reply(() => {
            const a = meAdmin();
            const s = Object.assign({ id: nextId('schools') }, validateSchool(data, null),
              { created_by: a.id, is_deleted: false, deleted_at: null, created_at: iso(now()), updated_at: iso(now()) });
            db.schools.push(s); save();
            return schoolDTO(s);
          });
        },
        // PUT /admin/schools/:id
        update(id, data) {
          return reply(() => {
            meAdmin();
            const s = findSchool(id);
            Object.assign(s, validateSchool(data, s.id), { updated_at: iso(now()) });
            save();
            return schoolDTO(s);
          });
        },
        // DELETE /admin/schools/:id?mode=soft|hard
        remove(id, mode) {
          return reply(() => {
            meAdmin(); needMode(mode);
            const s = findSchool(id);
            if (mode === 'hard') {
              db.roster = db.roster.filter(r => r.school_id !== s.id);
              db.subscriptions.forEach(x => { if (x.school_id === s.id) x.school_id = null; });   // kept for GST
              db.students.forEach(x => { if (x.school_id === s.id) x.school_id = null; });
              db.schools = db.schools.filter(x => x !== s);
            } else softDelete(s);
            save();
            return { ok: true };
          });
        },
        restore(id) { return reply(() => { meAdmin(); const s = findSchool(id); restore(s); save(); return schoolDTO(s); }); }
      },

      roster: {
        // GET /admin/schools/:id/roster — each email with whether a student has registered with it
        list(schoolId) {
          return reply(() => {
            meAdmin();
            const s = findSchool(schoolId);
            return db.roster.filter(r => r.school_id === s.id).sort((a, b) => a.email.localeCompare(b.email)).map(r => {
              const st = db.students.find(x => lower(x.email) === lower(r.email) && !x.is_deleted);
              return {
                email: r.email, created_at: r.created_at,
                student: st ? { full_name: st.full_name, linked: st.school_id === s.id } : null
              };
            });
          });
        },
        // POST /admin/schools/:id/roster — CSV text, one email per line (a header row is skipped)
        upload(schoolId, text) {
          return reply(() => {
            const a = meAdmin();
            const s = findSchool(schoolId);
            const out = { added: [], already: [], conflicts: [], invalid: [] };
            const seen = new Set();
            String(text || '').split(/[\r\n,;]+/).map(x => x.trim().replace(/^"|"$/g, '')).filter(Boolean).forEach(raw => {
              const e = lower(raw);
              if (seen.has(e)) return;
              seen.add(e);
              if (e === 'email' || e === 'emails') return;
              if (!EMAIL_RE.test(e)) { out.invalid.push(raw); return; }
              const hit = db.roster.find(r => lower(r.email) === e);
              if (hit && hit.school_id === s.id) { out.already.push(e); return; }
              if (hit) { out.conflicts.push({ email: e, school: (db.schools.find(x => x.id === hit.school_id) || {}).name || 'another school' }); return; }
              db.roster.push({ id: nextId('roster'), school_id: s.id, email: e, added_by: a.id, created_at: iso(now()) });
              out.added.push(e);
            });
            save();
            return out;
          });
        },
        // DELETE /admin/schools/:id/roster/:email
        remove(schoolId, email) {
          return reply(() => {
            meAdmin();
            const s = findSchool(schoolId);
            db.roster = db.roster.filter(r => !(r.school_id === s.id && lower(r.email) === lower(email)));
            save();
            return { ok: true };
          });
        }
      },

      subscriptions: {
        // GET /admin/schools/:id/subscriptions
        list(schoolId) {
          return reply(() => {
            meAdmin();
            const s = findSchool(schoolId);
            const t = now();
            return db.subscriptions.filter(x => x.school_id === s.id)
              .sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at))
              .map(x => Object.assign({}, x, {
                current: x.status === 'active' && Date.parse(x.starts_at) <= t && t < Date.parse(x.ends_at)
              }));
          });
        },
        // POST /admin/schools/:id/subscriptions — records a payment the school made
        create(schoolId, body) {
          return reply(() => {
            meAdmin();
            const s = findSchool(schoolId);
            const st = Date.parse(body.starts_at), en = Date.parse(body.ends_at);
            if (isNaN(st)) fail(400, 'invalid', 'Pick a start date.', { field: 'starts_at' });
            if (isNaN(en) || en <= st) fail(400, 'invalid', 'The end date must be after the start date.', { field: 'ends_at' });
            const amt = Math.round(Number(body.amount_rupees) * 100);
            if (!(amt >= 0)) fail(400, 'invalid', 'Enter the amount paid.', { field: 'amount_rupees' });
            const ref = String(body.payment_ref || '').trim();
            if (!ref) fail(400, 'invalid', 'Enter the invoice or payment reference.', { field: 'payment_ref' });
            const provider = body.payment_provider === 'razorpay' ? 'razorpay' : 'invoice';
            if (db.subscriptions.some(x => x.payment_provider === provider && x.payment_ref === ref))
              fail(409, 'duplicate_payment', 'This payment reference is already recorded.', { field: 'payment_ref' });
            const x = sub({ payer_type: 'school', school_id: s.id, plan: 'school_annual', starts_at: iso(st), ends_at: iso(en),
              amount_paise: amt, status: 'active', payment_provider: provider, payment_ref: ref });
            db.subscriptions.push(x); save();
            return x;
          });
        }
      },

      students: {
        // GET /admin/students
        list(opts) {
          return reply(() => {
            meAdmin();
            const del = !!(opts && opts.deleted), q = lower(opts && opts.q);
            return db.students.filter(s => s.is_deleted === del)
              .filter(s => !q || lower(s.full_name + ' ' + s.email).includes(q))
              .sort((a, b) => a.full_name.localeCompare(b.full_name))
              .map(s => Object.assign(studentDTO(s), { is_deleted: s.is_deleted, deleted_at: s.deleted_at, access: accessOf(s) }));
          });
        },
        // DELETE /admin/students/:id?mode=soft|hard
        remove(id, mode) {
          return reply(() => {
            meAdmin(); needMode(mode);
            const s = db.students.find(x => x.id === id);
            if (!s) fail(404, 'not_found', 'No such student.');
            if (mode === 'hard') {
              db.subscriptions.forEach(x => { if (x.student_id === s.id) x.student_id = null; });   // kept for GST
              db.students = db.students.filter(x => x !== s);
            } else softDelete(s);
            save();
            return { ok: true };
          });
        },
        restore(id) {
          return reply(() => {
            meAdmin();
            const s = db.students.find(x => x.id === id);
            if (!s) fail(404, 'not_found', 'No such student.');
            restore(s); save();
            return { ok: true };
          });
        }
      },

      admins: {
        // GET /admin/admins
        list(opts) {
          return reply(() => {
            const self = meAdmin();
            const del = !!(opts && opts.deleted);
            return db.admins.filter(a => a.is_deleted === del).sort((a, b) => a.full_name.localeCompare(b.full_name))
              .map(a => ({ id: a.id, email: a.email, full_name: a.full_name, last_login_at: a.last_login_at,
                is_deleted: a.is_deleted, deleted_at: a.deleted_at, created_at: a.created_at, is_me: a.id === self.id }));
          });
        },
        // POST /admin/admins
        create(body) {
          return reply(() => {
            meAdmin();
            const full_name = String(body.full_name || '').trim();
            const email = lower(body.email);
            if (!full_name) fail(400, 'invalid', 'Enter a name.', { field: 'full_name' });
            if (!EMAIL_RE.test(email)) fail(400, 'invalid', 'Enter a valid email.', { field: 'email' });
            if (String(body.password || '').length < 8) fail(400, 'invalid', 'Password must be at least 8 characters.', { field: 'password' });
            if (db.admins.some(a => lower(a.email) === email)) fail(409, 'email_taken', 'An admin with this email already exists.', { field: 'email' });
            const a = { id: uuid(), email: email, full_name: full_name, password: String(body.password), last_login_at: null,
              is_deleted: false, deleted_at: null, created_at: iso(now()) };
            db.admins.push(a); save();
            return { id: a.id };
          });
        },
        // DELETE /admin/admins/:id?mode=soft|hard
        remove(id, mode) {
          return reply(() => {
            const self = meAdmin(); needMode(mode);
            if (id === self.id) fail(409, 'cannot_delete_self', 'You can\'t delete your own admin account.');
            const a = db.admins.find(x => x.id === id);
            if (!a) fail(404, 'not_found', 'No such admin.');
            if (mode === 'hard') {
              db.contests.forEach(c => { if (c.created_by === a.id) c.created_by = null; });
              db.schools.forEach(s => { if (s.created_by === a.id) s.created_by = null; });
              db.admins = db.admins.filter(x => x !== a);
            } else softDelete(a);
            save();
            return { ok: true };
          });
        },
        restore(id) {
          return reply(() => {
            meAdmin();
            const a = db.admins.find(x => x.id === id);
            if (!a) fail(404, 'not_found', 'No such admin.');
            restore(a); save();
            return { ok: true };
          });
        }
      }
    },

    // ── Mock-only helpers (not part of the backend contract) ──
    resetDemo() {
      try { localStorage.removeItem(DB_KEY); } catch (e) { }
      sessionSet(STUDENT_SESSION, null); sessionSet(ADMIN_SESSION, null);
      db = null;
    }
  };

  root.CareerAPI = CareerAPI;
})(typeof globalThis !== 'undefined' ? globalThis : this);
