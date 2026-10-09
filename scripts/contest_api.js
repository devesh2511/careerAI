// ══════════════════════════════════════════════════════════════
// WEEKLY APTITUDE CONTEST — DATA LAYER
//
// Every contest screen (quiz.html, the leaderboards on app.html#/progress)
// talks to the contest ONLY through window.ContestAPI. Each method calls
// the careerAPI endpoint of the same name in docs/aptitude-contest-backend.md
// and resolves with its JSON body unchanged.
//
// LIVE: all of it. The server is the authority for the clock, scoring,
// ranks and what may be seen when; nothing contest-related is kept in the
// browser. The session is the httpOnly student cookie, so every fetch uses
// credentials: 'include'.
//
// Errors reject with an Error carrying .status (HTTP) and .code (API code);
// the UI branches on not_open, already_submitted, not_published, not_found,
// payment_required (with .reason) and unauthenticated.
//
// Contest rules (see the backend doc for the full spec)
//   • one contest per week: opens Saturday 07:00 IST, closes Sunday 19:00 IST
//   • 5 questions, 10 points each, one attempt, no time limit
//   • rank = score DESC, then time taken ASC; equal on both = equal rank
//   • scores, correct answers and leaderboards are hidden until close
//   • career leaderboard = students whose CURRENT top career matches yours
// ══════════════════════════════════════════════════════════════
(function (root) {
  'use strict';

  // Same targets as careerapi_mock.js: the /api proxy on the deployed site
  // (first-party cookie), the API directly in local dev.
  const API_ORIGIN = 'https://careerapi.vercel.app';
  const API_BASE = /^(localhost|127\.0\.0\.1|)$/.test(root.location ? root.location.hostname : '')
    ? API_ORIGIN : '/api';
  const STUDENT_SESSION = 'careerai_session';   // careerapi_mock.js's "logged in" flag

  // ── Clock ───────────────────────────────────────────────────────────────
  // The countdowns run on server time: every getState() measures how far
  // the device clock is from the server's and now() corrects for it.
  let clockOffset = 0;
  function now() { return Date.now() + clockOffset; }

  // ── HTTP ────────────────────────────────────────────────────────────────
  function http(method, path, body) {
    return fetch(API_BASE + path, {
      method: method,
      credentials: 'include',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    }).then(res => res.json().catch(() => ({})).then(data => {
      if (res.ok) return data;
      const err = data.error || {};
      const e = new Error(err.message || 'Something went wrong. Please try again.');
      e.status = res.status; e.code = err.code || 'server_error';
      if (err.reason) e.reason = err.reason;
      if (res.status === 401) { try { sessionStorage.removeItem(STUDENT_SESSION); } catch (x) { } }
      throw e;
    }), () => {
      const e = new Error("Can't reach the server. Check your connection and try again.");
      e.status = 0; e.code = 'network_error';
      throw e;
    });
  }
  function query(params) {
    const parts = Object.keys(params).filter(k => params[k] != null && params[k] !== '')
      .map(k => k + '=' + encodeURIComponent(params[k]));
    return parts.length ? '?' + parts.join('&') : '';
  }

  // ── Answer saves ────────────────────────────────────────────────────────
  // A student can tap options faster than the network answers. Saves for
  // the same question go out one after another, so the last tap is the one
  // the server keeps; submit waits for every save still in flight.
  const saving = {};   // questionId → Promise of the latest save
  function settled(p) { return p.then(() => { }, () => { }); }

  // Career boards group by the career on the server. A student who took the
  // career quiz before it was sent there has it only in this tab's state.
  function localCareer() {
    try {
      const s = JSON.parse(sessionStorage.getItem('careerai_state')) || {};
      const top = s.appResults && s.appResults.top_careers && s.appResults.top_careers[0];
      return top ? top.title : null;
    } catch (e) { return null; }
  }

  // ══════════════════════════════════════════════════════════════
  // PUBLIC API — one method per backend endpoint
  // ══════════════════════════════════════════════════════════════
  const ContestAPI = {
    // GET /contest/state — also syncs the clock and, once, the career.
    getState() {
      const sent = Date.now();
      return http('GET', '/contest/state').then(st => {
        // Assume the server stamped server_time halfway through the round trip.
        clockOffset = Date.parse(st.server_time) - (sent + Date.now()) / 2;
        const career = !st.career && localCareer();
        if (!career) return st;
        return http('PUT', '/me/career', { career: career })
          .then(() => Object.assign(st, { career: career }), () => st);
      });
    },

    // POST /contest/:id/attempt — starts the clock; calling it again resumes.
    startAttempt(id) { return http('POST', '/contest/' + id + '/attempt'); },

    // PUT /contest/:id/attempt/answers/:questionId  { option_index }
    saveAnswer(id, questionId, optionIndex) {
      const prev = saving[questionId] || Promise.resolve();
      const p = settled(prev).then(() => http('PUT', '/contest/' + id + '/attempt/answers/' +
        encodeURIComponent(questionId), { option_index: optionIndex }));
      saving[questionId] = p;
      return p;
    },

    // POST /contest/:id/attempt/submit — final; no score in the response.
    submitAttempt(id) {
      const pending = Object.keys(saving).map(k => settled(saving[k]));
      return Promise.all(pending).then(() => http('POST', '/contest/' + id + '/attempt/submit'));
    },

    // GET /contest/:id/review — only after the contest closes.
    getReview(id) { return http('GET', '/contest/' + encodeURIComponent(id) + '/review'); },

    // GET /leaderboard?scope=global|career&period=week|live[&contest_id=][&limit=]
    // period=week defaults to the latest closed contest.
    getLeaderboard(opts) {
      const o = opts || {};
      return http('GET', '/leaderboard' + query({ scope: o.scope, period: o.period, contest_id: o.contest_id, limit: o.limit }));
    },

    // GET /me/contest-history — one row per closed contest, newest first.
    getHistory() { return http('GET', '/me/contest-history'); },

    // Server time in ms, for countdowns.
    now: now
  };

  root.ContestAPI = ContestAPI;
})(typeof globalThis !== 'undefined' ? globalThis : this);
