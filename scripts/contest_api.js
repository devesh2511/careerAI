// ══════════════════════════════════════════════════════════════
// WEEKLY APTITUDE CONTEST — DATA LAYER
//
// Every contest screen (quiz.html, the leaderboards on app.html#/progress)
// talks to the contest ONLY through window.ContestAPI. Each method returns a
// Promise shaped exactly like the HTTP endpoint described in
// docs/aptitude-contest-backend.md, so swapping this mock for real fetch()
// calls is a change to this file alone — the UI does not move.
//
// Right now there is no backend, so everything below the API surface is a
// MOCK SERVER that runs in the browser:
//   • the question bank (with correct answers) lives in this file — the real
//     server must never send correct_index before a contest closes;
//   • the other ~800 students are generated from a fixed seed, so ranks are
//     stable between reloads;
//   • your own attempts are kept in localStorage.
//
// Contest rules (see the backend doc for the full spec)
//   • one contest per week: opens Saturday 07:00 IST, closes Sunday 19:00 IST
//   • 5 questions, 10 points each, one attempt, no time limit
//   • rank = score DESC, then time taken ASC; equal on both = equal rank
//   • scores, correct answers and leaderboards are hidden until close
//   • career leaderboard = students whose CURRENT top career matches yours
//
// Testing other points in the week: open any page with
//   ?now=2026-10-10T08:00:00+05:30   (clock keeps ticking from there)
//   ?now=reset                        (back to the real clock)
// and ContestAPI.resetDemo() in the console wipes your mock attempts.
// ══════════════════════════════════════════════════════════════
(function (root) {
  'use strict';

  const IST_OFFSET_MIN = 330;                       // UTC+05:30, no DST
  const HOUR = 3600e3, WEEK = 7 * 24 * HOUR;
  // Contest #1 opened Saturday 5 Sep 2026, 07:00 IST (= 01:30 UTC).
  const EPOCH = Date.UTC(2026, 8, 5, 1, 30);
  const WINDOW = 36 * HOUR;                         // Sat 07:00 → Sun 19:00
  const POINTS_PER_Q = 10;
  const LATENCY = 120;                              // fake network delay, ms

  const STORE_KEY = 'careerai_contest_mock';
  const CLOCK_KEY = 'careerai_contest_clock';

  // ── Clock ───────────────────────────────────────────────────────────────
  // The server is the only clock that matters for a contest. The mock fakes
  // one, with an optional offset so any moment in the week can be tested.
  (function readNowParam() {
    try {
      const v = new URLSearchParams(location.search).get('now');
      if (!v) return;
      if (v === 'reset') { sessionStorage.removeItem(CLOCK_KEY); return; }
      const t = Date.parse(v);
      if (!isNaN(t)) sessionStorage.setItem(CLOCK_KEY, String(t - Date.now()));
    } catch (e) { /* no location / storage: ignore */ }
  })();
  function now() {
    let off = 0;
    try { off = Number(sessionStorage.getItem(CLOCK_KEY)) || 0; } catch (e) { }
    return Date.now() + off;
  }

  // ── Calendar ────────────────────────────────────────────────────────────
  function opensAt(n) { return EPOCH + (n - 1) * WEEK; }
  function closesAt(n) { return opensAt(n) + WINDOW; }
  // The contest whose week contains t (0 before contest #1 ever opened).
  function weekOf(t) { return t < EPOCH ? 0 : Math.floor((t - EPOCH) / WEEK) + 1; }
  function statusOf(n, t) {
    if (t < opensAt(n)) return 'upcoming';
    return t < closesAt(n) ? 'open' : 'closed';
  }
  function latestPublished(t) {
    const n = weekOf(t);
    if (n === 0) return 0;
    return t >= closesAt(n) ? n : n - 1;
  }
  function contestDTO(n, t) {
    return {
      id: n,
      number: n,
      opens_at: new Date(opensAt(n)).toISOString(),
      closes_at: new Date(closesAt(n)).toISOString(),
      status: statusOf(n, t),
      question_count: 5,
      points_per_question: POINTS_PER_Q
    };
  }

  // ── Question bank (hand-authored; would live in the database) ─────────
  // Sets rotate by contest number so every week has questions.
  const QUESTION_SETS = [
    [
      { area: 'Logical Reasoning', text: 'A pattern shows: 2, 6, 12, 20, 30, … What comes next?', options: ['38', '40', '42', '44'], correct: 2, explanation: 'The gaps grow by 2 each time (4, 6, 8, 10), so the next gap is 12: 30 + 12 = 42.' },
      { area: 'Numerical Ability', text: 'If 3 workers can build a wall in 6 days, how many days will 9 workers take?', options: ['1 day', '2 days', '3 days', '4 days'], correct: 1, explanation: 'The job is 3 × 6 = 18 worker-days. 18 ÷ 9 workers = 2 days.' },
      { area: 'Verbal Ability', text: 'Choose the word most opposite in meaning to "Concise".', options: ['Brief', 'Lengthy', 'Clear', 'Simple'], correct: 1, explanation: 'Concise means short and to the point; lengthy is its opposite.' },
      { area: 'Spatial Reasoning', text: 'A cube painted red on every face is cut into 27 equal small cubes. How many small cubes have exactly two red faces?', options: ['6', '8', '12', '24'], correct: 2, explanation: 'Two-face cubes sit in the middle of each edge. A cube has 12 edges with one such cube each: 12.' },
      { area: 'Logical Reasoning', text: 'All roses are flowers. Some flowers fade quickly. Which statement must be true?', options: ['All roses fade quickly', 'Some roses fade quickly', 'No rose fades quickly', 'None of these must be true'], correct: 3, explanation: 'The flowers that fade quickly may or may not include roses, so nothing about roses follows for certain.' }
    ],
    [
      { area: 'Logical Reasoning', text: 'What comes next: 1, 4, 9, 16, 25, …?', options: ['30', '35', '36', '49'], correct: 2, explanation: 'These are perfect squares: 1², 2², 3², 4², 5², so next is 6² = 36.' },
      { area: 'Numerical Ability', text: 'A shirt costs ₹800 after a 20% discount. What was its original price?', options: ['₹960', '₹1,000', '₹1,040', '₹1,100'], correct: 1, explanation: '₹800 is 80% of the original price, so the original is 800 ÷ 0.8 = ₹1,000.' },
      { area: 'Verbal Ability', text: 'Book is to Author as Painting is to …', options: ['Canvas', 'Gallery', 'Artist', 'Brush'], correct: 2, explanation: 'An author creates a book; an artist creates a painting.' },
      { area: 'Spatial Reasoning', text: 'What is the angle between the hour and minute hands of a clock at 3:15?', options: ['0°', '7.5°', '15°', '30°'], correct: 1, explanation: 'The minute hand is on the 3. The hour hand has moved a quarter of the way from 3 to 4: ¼ × 30° = 7.5°.' },
      { area: 'Logical Reasoning', text: 'If CAT is written in a code as DBU, how is DOG written in that code?', options: ['EPH', 'CNF', 'DPG', 'FQI'], correct: 0, explanation: 'Each letter moves one place forward: D→E, O→P, G→H gives EPH.' }
    ],
    [
      { area: 'Logical Reasoning', text: 'What comes next: 3, 6, 11, 18, 27, …?', options: ['36', '38', '39', '40'], correct: 1, explanation: 'The gaps are odd numbers 3, 5, 7, 9, so the next gap is 11: 27 + 11 = 38.' },
      { area: 'Numerical Ability', text: 'A train covers 360 km in 4 hours. What is its speed in metres per second?', options: ['20 m/s', '25 m/s', '30 m/s', '90 m/s'], correct: 1, explanation: '360 ÷ 4 = 90 km/h. 90 × 1000 ÷ 3600 = 25 m/s.' },
      { area: 'Verbal Ability', text: 'Choose the word closest in meaning to "Meticulous".', options: ['Careless', 'Careful', 'Quick', 'Generous'], correct: 1, explanation: 'Meticulous means showing great attention to detail — very careful.' },
      { area: 'Spatial Reasoning', text: 'You face North, turn right 90°, turn right 90° again, then turn left 90°. Which way do you face now?', options: ['North', 'East', 'South', 'West'], correct: 1, explanation: 'North → right → East → right → South → left → East.' },
      { area: 'Logical Reasoning', text: 'Ravi is taller than Sam. Sam is taller than Tia. Uma is shorter than Tia. Who is the shortest?', options: ['Ravi', 'Sam', 'Tia', 'Uma'], correct: 3, explanation: 'The order from tallest is Ravi > Sam > Tia > Uma, so Uma is shortest.' }
    ],
    [
      { area: 'Logical Reasoning', text: 'What comes next: 2, 3, 5, 8, 13, …?', options: ['18', '20', '21', '26'], correct: 2, explanation: 'Each number is the sum of the two before it: 8 + 13 = 21.' },
      { area: 'Numerical Ability', text: 'The average of 5 numbers is 20. After removing one number, the average of the rest is 18. Which number was removed?', options: ['22', '24', '26', '28'], correct: 3, explanation: 'Total of 5 numbers = 100. Total of 4 numbers = 72. Removed number = 100 − 72 = 28.' },
      { area: 'Verbal Ability', text: 'Which is the odd one out?', options: ['Mercury', 'Venus', 'Moon', 'Mars'], correct: 2, explanation: 'Mercury, Venus and Mars are planets; the Moon is a natural satellite.' },
      { area: 'Spatial Reasoning', text: 'A square has both of its diagonals drawn. How many triangles can you count in the figure?', options: ['4', '6', '8', '10'], correct: 2, explanation: '4 small triangles meet at the centre, plus 4 larger ones each made of two small triangles (half the square): 8.' },
      { area: 'Logical Reasoning', text: 'Today is Wednesday. What day of the week will it be 100 days from today?', options: ['Thursday', 'Friday', 'Saturday', 'Sunday'], correct: 1, explanation: '100 = 14 weeks + 2 days. Two days after Wednesday is Friday.' }
    ],
    [
      { area: 'Logical Reasoning', text: 'What comes next: 81, 27, 9, 3, …?', options: ['0', '1', '1/3', '3'], correct: 1, explanation: 'Each number is divided by 3: 3 ÷ 3 = 1.' },
      { area: 'Numerical Ability', text: 'What is the simple interest on ₹5,000 at 10% per year for 3 years?', options: ['₹1,000', '₹1,500', '₹1,655', '₹2,000'], correct: 1, explanation: 'Simple interest = 5000 × 10% × 3 = ₹1,500.' },
      { area: 'Verbal Ability', text: 'Which spelling is correct?', options: ['Acommodate', 'Accomodate', 'Accommodate', 'Acomodate'], correct: 2, explanation: '"Accommodate" has a double c and a double m.' },
      { area: 'Spatial Reasoning', text: 'An analogue clock with no numbers shows 2:30. What time does its mirror image appear to show?', options: ['9:30', '10:30', '8:30', '3:30'], correct: 0, explanation: 'Mirror time = 11:60 − actual time. 11:60 − 2:30 = 9:30.' },
      { area: 'Logical Reasoning', text: 'In a row of 30 students, Asha is 12th from the left. What is her position from the right?', options: ['17th', '18th', '19th', '20th'], correct: 2, explanation: 'Position from right = 30 − 12 + 1 = 19th.' }
    ]
  ];
  function questionsFor(n) {
    const set = QUESTION_SETS[(n - 1) % QUESTION_SETS.length];
    return set.map((q, i) => Object.assign({ id: 'c' + n + '-q' + (i + 1) }, q));
  }
  // What the client may see while a contest is open: no answers.
  function publicQuestion(q) {
    return { id: q.id, area: q.area, text: q.text, options: q.options.slice() };
  }

  // ── Seeded randomness (stable mock population) ─────────────────────────
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    // Avalanche (murmur3 finaliser): without it, seeds that differ only in
    // the last character ("week:1" / "week:3") start out nearly identical.
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
  }
  function rng(seed) {
    let a = typeof seed === 'string' ? hash(seed) : seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── Mock population ─────────────────────────────────────────────────────
  const STUDENT_COUNT = 820;
  const FIRST = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
    'Ananya', 'Diya', 'Saanvi', 'Aadhya', 'Kiara', 'Myra', 'Anika', 'Navya', 'Pari', 'Riya',
    'Kabir', 'Rohan', 'Aryan', 'Dhruv', 'Kunal', 'Neel', 'Om', 'Pranav', 'Rudra', 'Yash',
    'Isha', 'Kavya', 'Meera', 'Nisha', 'Pooja', 'Sara', 'Tara', 'Zoya', 'Fatima', 'Harpreet'];
  const LAST = 'ABCDGJKMNPRSTVY';
  // Careers most students pick get more weight so the popular career boards
  // land in the 30–60 range the spec uses as its example.
  const POPULAR = ['Software Engineer', 'AI / ML Engineer', 'Data Scientist', 'Medical Doctor', 'Architect',
    'UX / Product Designer', 'Civil Services / Public Administration', 'Lawyer / Advocate', 'Mechanical Engineer',
    'Chartered Accountant', 'Teacher', 'Graphic Designer'];

  let students = null;
  function population() {
    if (students) return students;
    const titles = (root.RIASEC_CAREERS || []).map(c => c.title);
    if (!titles.length) titles.push.apply(titles, POPULAR);
    const weights = titles.map(t => POPULAR.includes(t) ? 10 : 1);
    const totalW = weights.reduce((a, b) => a + b, 0);
    students = [];
    for (let i = 0; i < STUDENT_COUNT; i++) {
      const r = rng('student:' + i);
      let pick = r() * totalW, ci = 0;
      while (pick >= weights[ci]) { pick -= weights[ci]; ci++; }
      students.push({
        id: 's' + i,
        name: FIRST[Math.floor(r() * FIRST.length)] + ' ' + LAST[Math.floor(r() * LAST.length)] + '.',
        career: titles[ci],
        skill: 0.3 + 0.6 * r(),             // chance of answering a question right
        pace: 120 + Math.floor(r() * 420),  // typical seconds for a full contest
        joins: 1 + Math.floor(Math.pow(r(), 3) * 8), // later sign-ups grow the field
        keen: 0.6 + 0.35 * r()              // chance of showing up in a given week
      });
    }
    return students;
  }

  const weekCache = {};
  function othersResults(n) {
    if (weekCache[n]) return weekCache[n];
    const turnout = 0.7 + 0.35 * rng('week:' + n)();   // field size varies week to week
    const out = [];
    population().forEach((s, i) => {
      if (n < s.joins) return;
      const r = rng('result:' + i + ':' + n);
      if (r() > s.keen * turnout) return;
      let correct = 0;
      for (let q = 0; q < 5; q++) if (r() < s.skill) correct++;
      out.push({
        id: s.id, name: s.name, career: s.career,
        correct: correct, score: correct * POINTS_PER_Q,
        time_taken_s: Math.max(35, Math.round(s.pace * (0.6 + 0.8 * r())))
      });
    });
    return (weekCache[n] = out);
  }

  // ── Your attempts (localStorage) ────────────────────────────────────────
  function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveStore(s) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) { }
  }
  // On first use the demo pretends you took every contest that has already
  // closed, so the leaderboards have a history to show. It only ever happens
  // once — weeks you skip after that stay skipped.
  function store() {
    const s = loadStore();
    if (!s.attempts) s.attempts = {};
    if (s.seededThrough === undefined) {
      const last = latestPublished(now());
      for (let n = 1; n <= last; n++) {
        if (s.attempts[n]) continue;
        const r = rng('me:' + n), qs = questionsFor(n), answers = {};
        qs.forEach(q => {
          answers[q.id] = r() < 0.7 ? q.correct : (q.correct + 1 + Math.floor(r() * 3)) % 4;
        });
        const start = opensAt(n) + Math.floor(r() * 30 * HOUR);
        s.attempts[n] = { started_at: start, submitted_at: start + (150 + Math.floor(r() * 300)) * 1000, answers: answers };
      }
      s.seededThrough = last;
      saveStore(s);
    }
    return s;
  }
  // An attempt left unsubmitted when the contest closes is submitted with
  // whatever was answered, timed up to the close (the backend does the same).
  function finalised(n, a) {
    if (!a || !a.started_at) return null;
    if (a.submitted_at) return a;
    if (now() >= closesAt(n)) return Object.assign({}, a, { submitted_at: closesAt(n) });
    return null;
  }
  function myResult(n) {
    const a = finalised(n, store().attempts[n]);
    if (!a) return null;
    const qs = questionsFor(n);
    const correct = qs.filter(q => a.answers[q.id] === q.correct).length;
    return {
      id: 'me', name: 'You', career: myCareer(), is_me: true,
      correct: correct, score: correct * POINTS_PER_Q,
      time_taken_s: Math.max(1, Math.round((a.submitted_at - a.started_at) / 1000))
    };
  }

  // The server keeps each student's current top career on their profile.
  // Here it is read from the career quiz result the app already stores.
  function myCareer() {
    try {
      const s = JSON.parse(sessionStorage.getItem('careerai_state')) || {};
      const top = s.appResults && s.appResults.top_careers && s.appResults.top_careers[0];
      return top ? top.title : null;
    } catch (e) { return null; }
  }
  function careerEmoji(title) {
    const c = (root.RIASEC_CAREERS || []).find(x => x.title === title);
    return c ? c.emoji : '🎯';
  }

  // ── Ranking ─────────────────────────────────────────────────────────────
  // Standard competition ranking ("1, 2, 2, 4"): score high→low, then time
  // low→high; exactly equal on both shares a rank.
  // Ranks are written onto copies: the same entry objects feed the global
  // and the career board, and must not carry one board's rank into the other.
  function rank(entries) {
    const sorted = entries.map(e => Object.assign({}, e)).sort((a, b) => (b.score - a.score) || (a.time_taken_s - b.time_taken_s));
    let prev = null;
    sorted.forEach((e, i) => {
      e.rank = prev && prev.score === e.score && prev.time_taken_s === e.time_taken_s ? prev.rank : i + 1;
      prev = e;
    });
    return sorted;
  }
  function weekEntries(n) {
    const list = othersResults(n).slice();
    const me = myResult(n);
    if (me) list.push(me);
    return list;
  }
  function liveEntries(last) {
    const byId = {};
    for (let n = 1; n <= last; n++) {
      weekEntries(n).forEach(e => {
        const t = byId[e.id] || (byId[e.id] = {
          id: e.id, name: e.name, career: e.career, is_me: e.is_me,
          score: 0, correct: 0, total_questions: 0, time_taken_s: 0, contests: 0
        });
        t.score += e.score; t.correct += e.correct; t.total_questions += 5;
        t.time_taken_s += e.time_taken_s; t.contests++;
      });
    }
    return Object.keys(byId).map(k => byId[k]);
  }
  function board(entries, scope, career) {
    const pool = scope === 'career' ? entries.filter(e => e.career === career) : entries;
    const ranked = rank(pool);
    return { ranked: ranked, me: ranked.find(e => e.is_me) || null };
  }
  function rowDTO(e) {
    return {
      rank: e.rank, name: e.name, career: e.career, career_emoji: careerEmoji(e.career),
      score: e.score, correct: e.correct, total_questions: e.total_questions || 5,
      time_taken_s: e.time_taken_s, contests: e.contests, is_me: !!e.is_me
    };
  }

  // ── Plumbing ────────────────────────────────────────────────────────────
  function reply(fn) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try { resolve(fn()); } catch (e) { reject(e); }
      }, LATENCY);
    });
  }
  function fail(code, message) {
    const e = new Error(message);
    e.code = code;
    throw e;
  }
  function requireContest(id) {
    const n = Number(id);
    if (!Number.isInteger(n) || n < 1 || opensAt(n) > now() + WEEK) fail('not_found', 'No such contest.');
    return n;
  }
  function attemptState(n, t) {
    const a = store().attempts[n];
    if (!a || !a.started_at) return { status: 'not_started' };
    const f = finalised(n, a);
    return {
      status: f ? 'submitted' : 'in_progress',
      started_at: new Date(a.started_at).toISOString(),
      submitted_at: f ? new Date(f.submitted_at).toISOString() : null,
      answered_count: Object.keys(a.answers || {}).length,
      auto_submitted: !!(f && !a.submitted_at)
    };
  }

  // ══════════════════════════════════════════════════════════════
  // PUBLIC API — one method per backend endpoint
  // ══════════════════════════════════════════════════════════════
  const ContestAPI = {
    demo: true,

    // GET /contest/state
    getState() {
      return reply(() => {
        const t = now(), w = weekOf(t);
        // The contest to act on: this week's while it is open, else the next.
        const n = w === 0 ? 1 : (statusOf(w, t) === 'closed' ? w + 1 : w);
        const last = latestPublished(t);
        return {
          server_time: new Date(t).toISOString(),
          contest: contestDTO(n, t),
          attempt: attemptState(n, t),
          latest_published: last ? contestDTO(last, t) : null,
          published_count: last,
          career: myCareer()
        };
      });
    },

    // POST /contest/:id/attempt — starts the clock; calling it again resumes.
    startAttempt(id) {
      return reply(() => {
        const n = requireContest(id), t = now();
        if (statusOf(n, t) !== 'open') fail('not_open', 'This contest is not open.');
        const s = store();
        const a = s.attempts[n] || (s.attempts[n] = { started_at: t, answers: {} });
        if (a.submitted_at) fail('already_submitted', 'You have already submitted this contest.');
        saveStore(s);
        return {
          contest: contestDTO(n, t),
          started_at: new Date(a.started_at).toISOString(),
          questions: questionsFor(n).map(publicQuestion),
          answers: Object.assign({}, a.answers)
        };
      });
    },

    // PUT /contest/:id/attempt/answers/:questionId  { option_index }
    saveAnswer(id, questionId, optionIndex) {
      return reply(() => {
        const n = requireContest(id);
        if (statusOf(n, now()) !== 'open') fail('not_open', 'This contest has closed.');
        const s = store(), a = s.attempts[n];
        if (!a) fail('not_started', 'Start the contest first.');
        if (a.submitted_at) fail('already_submitted', 'You have already submitted this contest.');
        if (!questionsFor(n).some(q => q.id === questionId)) fail('bad_question', 'Unknown question.');
        a.answers[questionId] = optionIndex;
        saveStore(s);
        return { ok: true };
      });
    },

    // POST /contest/:id/attempt/submit — final; no score in the response.
    submitAttempt(id) {
      return reply(() => {
        const n = requireContest(id), t = now();
        if (statusOf(n, t) !== 'open') fail('not_open', 'This contest has closed.');
        const s = store(), a = s.attempts[n];
        if (!a) fail('not_started', 'Start the contest first.');
        if (!a.submitted_at) { a.submitted_at = t; saveStore(s); }
        return {
          submitted_at: new Date(a.submitted_at).toISOString(),
          time_taken_s: Math.max(1, Math.round((a.submitted_at - a.started_at) / 1000)),
          results_at: new Date(closesAt(n)).toISOString()
        };
      });
    },

    // GET /contest/:id/review — only after the contest closes.
    getReview(id) {
      return reply(() => {
        const n = requireContest(id), t = now();
        if (statusOf(n, t) !== 'closed') fail('not_published', 'Answers are revealed when the contest closes.');
        const me = myResult(n);
        const a = finalised(n, store().attempts[n]);
        const g = me ? board(weekEntries(n), 'global').me : null;
        const career = myCareer();
        const c = me && career ? board(weekEntries(n), 'career', career) : null;
        return {
          contest: contestDTO(n, t),
          attempted: !!me,
          score: me ? me.score : null,
          correct: me ? me.correct : null,
          total_questions: 5,
          time_taken_s: me ? me.time_taken_s : null,
          global: g ? { rank: g.rank, total: weekEntries(n).length } : null,
          career: c && c.me ? { name: career, rank: c.me.rank, total: c.ranked.length } : null,
          questions: questionsFor(n).map(q => Object.assign(publicQuestion(q), {
            correct_index: q.correct,
            explanation: q.explanation,
            your_index: a && a.answers[q.id] !== undefined ? a.answers[q.id] : null
          }))
        };
      });
    },

    // GET /leaderboard?scope=global|career&period=week|live[&contest_id=][&limit=]
    // period=week defaults to the latest published contest.
    getLeaderboard(opts) {
      return reply(() => {
        const o = opts || {}, t = now();
        const scope = o.scope === 'career' ? 'career' : 'global';
        const period = o.period === 'live' ? 'live' : 'week';
        const limit = o.limit || 10;
        const last = latestPublished(t);
        const career = myCareer();
        const base = { scope: scope, period: period, career: scope === 'career' ? career : null };
        if (scope === 'career' && !career) return Object.assign(base, { locked: 'no_career', total_participants: 0, me: null, rows: [] });
        if (!last) return Object.assign(base, { contest: null, total_participants: 0, me: null, rows: [] });

        let entries, contest = null;
        if (period === 'week') {
          const n = o.contest_id ? requireContest(o.contest_id) : last;
          if (statusOf(n, t) !== 'closed') fail('not_published', 'This leaderboard is published when the contest closes.');
          entries = weekEntries(n);
          contest = contestDTO(n, t);
        } else {
          entries = liveEntries(last);
        }
        const b = board(entries, scope, career);
        return Object.assign(base, {
          contest: contest,
          contests_count: period === 'live' ? last : 1,
          total_participants: b.ranked.length,
          me: b.me ? rowDTO(b.me) : null,
          rows: b.ranked.slice(0, limit).map(rowDTO)
        });
      });
    },

    // GET /me/contest-history — one row per published contest.
    getHistory() {
      return reply(() => {
        const t = now(), last = latestPublished(t), career = myCareer();
        const rows = [];
        for (let n = last; n >= 1; n--) {
          const entries = weekEntries(n);
          const g = board(entries, 'global');
          const c = career ? board(entries, 'career', career) : null;
          rows.push({
            contest: contestDTO(n, t),
            attempted: !!g.me,
            score: g.me ? g.me.score : null,
            correct: g.me ? g.me.correct : null,
            total_questions: 5,
            time_taken_s: g.me ? g.me.time_taken_s : null,
            global: g.me ? { rank: g.me.rank, total: g.ranked.length } : null,
            career: c && c.me ? { rank: c.me.rank, total: c.ranked.length } : null
          });
        }
        return { career: career, rows: rows };
      });
    },

    // ── Mock-only helpers (not part of the backend contract) ──
    now: now,
    // Contest n's questions WITH answers, for seeding the admin mock in
    // careerapi_mock.js. The real server has no such endpoint for students.
    mockQuestionSet(n) {
      return QUESTION_SETS[(n - 1) % QUESTION_SETS.length].map(q => Object.assign({}, q, { options: q.options.slice() }));
    },
    resetDemo() {
      try { localStorage.removeItem(STORE_KEY); } catch (e) { }
    }
  };

  root.ContestAPI = ContestAPI;
})(typeof globalThis !== 'undefined' ? globalThis : this);
