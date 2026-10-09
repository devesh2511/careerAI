    // ══════════════════════════════════════════════════════════════
    // WEEKLY APTITUDE CONTEST — UI
    // quiz.html        → the contest itself (ct* functions)
    // app.html#/progress → global + career leaderboards (lb* functions)
    // All data comes from window.ContestAPI (scripts/contest_api.js), which
    // calls careerAPI.
    // ══════════════════════════════════════════════════════════════

    // ── Shared formatting ──
    const CT_TZ = 'Asia/Kolkata';
    function ctEsc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    }
    // "Sat 10 Oct, 7:00 AM IST" — contest times are always shown in IST so a
    // student on a travelling laptop still sees the times the contest runs on.
    function ctWhen(iso) {
      const d = new Date(iso);
      const day = d.toLocaleDateString('en-IN', { timeZone: CT_TZ, weekday: 'short', day: 'numeric', month: 'short' });
      const time = d.toLocaleTimeString('en-IN', { timeZone: CT_TZ, hour: 'numeric', minute: '2-digit', hour12: true });
      return day + ', ' + time.toUpperCase() + ' IST';
    }
    function ctDates(c) {
      const o = { timeZone: CT_TZ, day: 'numeric', month: 'short' };
      return new Date(c.opens_at).toLocaleDateString('en-IN', o) + ' – ' + new Date(c.closes_at).toLocaleDateString('en-IN', o);
    }
    function ctDuration(s) {
      if (s == null) return '—';
      const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
      if (h) return h + 'h ' + String(m).padStart(2, '0') + 'm';
      return m ? m + 'm ' + String(sec).padStart(2, '0') + 's' : sec + 's';
    }
    function ctLeft(ms) {
      const t = Math.max(0, Math.floor(ms / 1000));
      const d = Math.floor(t / 86400), h = Math.floor(t % 86400 / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
      const p = n => String(n).padStart(2, '0');
      return (d ? d + 'd ' : '') + (d || h ? p(h) + 'h ' : '') + p(m) + 'm ' + p(s) + 's';
    }
    function ctTopPct(rank, total) {
      return Math.max(1, Math.ceil(rank / total * 100));
    }

    // One ticking countdown per page. Every element with data-until gets its
    // text refreshed; when the first deadline passes, onDone re-reads state.
    let ctTick = null;
    function ctStartTicker(onDone) {
      clearInterval(ctTick);
      const step = () => {
        let expired = false;
        document.querySelectorAll('[data-until]').forEach(el => {
          const left = Date.parse(el.dataset.until) - ContestAPI.now();
          el.textContent = ctLeft(left);
          if (left <= 0) expired = true;
        });
        if (expired) { clearInterval(ctTick); setTimeout(onDone, 800); }
      };
      step();
      ctTick = setInterval(step, 1000);
    }

    // ══════════════════════════════════════════════════════════════
    // CONTEST PAGE (quiz.html)
    // ══════════════════════════════════════════════════════════════
    let ctRun = null;   // { contest, started_at, questions, answers }
    let ctIdx = 0;

    function ctRoot() { return document.getElementById('ct-root'); }
    function ctSet(html) {
      const root = ctRoot();
      root.innerHTML = html;
      window.scrollTo(0, 0);
    }
    function ctLabel(text) {
      const el = document.getElementById('ct-label');
      if (el) el.textContent = text;
    }
    function ctError(err) {
      ctLabel('Weekly Aptitude Contest');
      ctSet('<div class="quiz-card ct-center">' + ctErrorBody(err, 'ctInit()') + '</div>');
    }

    // The server checks the session and the plan on every contest call, so
    // a 401 or 402 can arrive even after the page's own access check passed.
    function ctErrorBody(err, retry) {
      const msg = '<p class="ct-p">' + ctEsc(err && err.message || 'Please try again.') + '</p>';
      if (err && err.code === 'payment_required') {
        return '<div class="ct-emoji">🔒</div><h2 class="ct-h">The contest needs an active plan</h2>' + msg +
          '<button class="btn btn-primary" onclick="show(\'paywall\')">See plans</button>';
      }
      if (err && err.code === 'unauthenticated') {
        return '<div class="ct-emoji">👋</div><h2 class="ct-h">Please log in again</h2>' +
          '<p class="ct-p">Your session has ended.</p>' +
          '<button class="btn btn-primary" onclick="show(\'auth\')">Log in</button>';
      }
      return '<div class="ct-emoji">⚠️</div><h2 class="ct-h">Something went wrong</h2>' + msg +
        '<button class="btn btn-primary" onclick="' + retry + '">Try again</button>';
    }

    // Entry point for quiz.html. ?review=N shows a closed contest's answers.
    function ctInit() {
      clearInterval(ctTick);
      const review = new URLSearchParams(location.search).get('review');
      if (review) { ctShowReview(review); return; }
      ctSet('<div class="ct-loading">Loading this week’s contest…</div>');
      ContestAPI.getState().then(st => {
        const c = st.contest, a = st.attempt;
        if (!c) ctNoContest(st);
        else if (c.status === 'upcoming') ctUpcoming(st);
        else if (a.status === 'submitted') ctSubmitted(c, a);
        else if (a.status === 'in_progress') ctBegin(c.id);
        else ctIntro(st);
      }).catch(ctError);
    }

    function ctLastLink(st) {
      const p = st.latest_published;
      return p ? '<a class="ct-link" href="?review=' + p.id + '">Review Contest #' + p.number + ' answers →</a>' : '';
    }

    function ctIntro(st) {
      const c = st.contest;
      ctLabel('Contest #' + c.number);
      ctSet(
        '<div class="quiz-card">' +
        '<span class="badge badge-green ct-live">● Live now</span>' +
        '<h2 class="ct-h">Weekly Aptitude Contest #' + c.number + '</h2>' +
        '<p class="ct-p">Closes <strong>' + ctWhen(c.closes_at) + '</strong> · <span data-until="' + c.closes_at + '"></span> left</p>' +
        '<ul class="ct-rules">' +
        '<li><span>📝</span>5 questions, ' + c.points_per_question + ' points each</li>' +
        '<li><span>⏱️</span>No time limit — but time taken breaks ties, so the clock starts when you press Start</li>' +
        '<li><span>☝️</span>One attempt only. You can change answers until you submit</li>' +
        '<li><span>🔒</span>Score, correct answers and leaderboards unlock when the contest closes</li>' +
        '</ul>' +
        '<button class="btn btn-primary btn-lg ct-wide" onclick="ctBegin(' + c.id + ')">Start contest →</button>' +
        ctLastLink(st) +
        '</div>');
      ctStartTicker(ctInit);
    }

    function ctUpcoming(st) {
      const c = st.contest;
      ctLabel('Next contest');
      ctSet(
        '<div class="quiz-card ct-center">' +
        '<div class="ct-emoji">🗓️</div>' +
        '<h2 class="ct-h">Contest #' + c.number + ' opens soon</h2>' +
        '<p class="ct-p">A new 5-question contest opens every <strong>Saturday 7:00 AM</strong> and closes <strong>Sunday 7:00 PM IST</strong>.</p>' +
        '<div class="ct-count" data-until="' + c.opens_at + '"></div>' +
        '<p class="ct-p ct-small">Opens ' + ctWhen(c.opens_at) + '</p>' +
        '<div class="ct-actions">' +
        (st.latest_published ? '<a class="btn btn-primary" href="?review=' + st.latest_published.id + '">See Contest #' + st.latest_published.number + ' results</a>' : '') +
        '<button class="btn btn-ghost" onclick="show(\'progress\')">View leaderboards</button>' +
        '</div></div>');
      ctStartTicker(ctInit);
    }

    // No contest is scheduled yet (the admins add each week's).
    function ctNoContest(st) {
      ctLabel('Weekly Aptitude Contest');
      ctSet(
        '<div class="quiz-card ct-center">' +
        '<div class="ct-emoji">🗓️</div>' +
        '<h2 class="ct-h">The next contest isn’t scheduled yet</h2>' +
        '<p class="ct-p">A new 5-question contest opens every <strong>Saturday 7:00 AM</strong> and closes <strong>Sunday 7:00 PM IST</strong>. Check back soon.</p>' +
        '<div class="ct-actions">' +
        (st.latest_published ? '<a class="btn btn-primary" href="?review=' + st.latest_published.id + '">See Contest #' + st.latest_published.number + ' results</a>' : '') +
        '<button class="btn btn-ghost" onclick="show(\'progress\')">View leaderboards</button>' +
        '</div></div>');
    }

    function ctBegin(id) {
      ctSet('<div class="ct-loading">Getting your questions…</div>');
      ContestAPI.startAttempt(id).then(run => {
        ctRun = run;
        const firstOpen = run.questions.findIndex(q => run.answers[q.id] === undefined);
        ctIdx = firstOpen === -1 ? run.questions.length - 1 : firstOpen;
        ctQuestion();
      }).catch(err => {
        if (err.code === 'already_submitted' || err.code === 'not_open') ctInit();
        else ctError(err);
      });
    }

    function ctDots() {
      return '<div class="ct-dots" role="tablist" aria-label="Questions">' + ctRun.questions.map((q, i) =>
        '<button class="ct-dot' + (ctRun.answers[q.id] !== undefined ? ' answered' : '') + (i === ctIdx ? ' current' : '') +
        '" role="tab" aria-selected="' + (i === ctIdx) + '" aria-label="Question ' + (i + 1) + '" onclick="ctGo(' + i + ')">' + (i + 1) + '</button>'
      ).join('') + '</div>';
    }

    function ctQuestion() {
      clearInterval(ctTick);
      const qs = ctRun.questions, q = qs[ctIdx], chosen = ctRun.answers[q.id];
      const last = ctIdx === qs.length - 1;
      ctLabel('Contest #' + ctRun.contest.number + ' · Question ' + (ctIdx + 1) + ' of ' + qs.length);
      ctSet(
        '<div class="ct-qhead">' + ctDots() + '<span class="quiz-area">' + ctEsc(q.area) + '</span></div>' +
        '<div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:' + ((ctIdx + 1) / qs.length * 100) + '%"></div></div>' +
        '<div class="quiz-card">' +
        '<div class="quiz-q">' + ctEsc(q.text) + '</div>' +
        '<div class="quiz-options" role="radiogroup">' + q.options.map((o, i) =>
          '<button class="quiz-option' + (chosen === i ? ' selected' : '') + '" role="radio" aria-checked="' + (chosen === i) +
          '" onclick="ctPick(' + i + ')"><span class="opt-letter">' + 'ABCD'[i] + '</span>' + ctEsc(o) + '</button>'
        ).join('') + '</div>' +
        '<div class="ct-footer">' +
        '<button class="btn btn-ghost btn-sm" onclick="ctGo(' + (ctIdx - 1) + ')"' + (ctIdx === 0 ? ' disabled' : '') + '>← Back</button>' +
        (last
          ? '<button class="btn btn-primary btn-sm" onclick="ctConfirm()">Review &amp; submit →</button>'
          : '<button class="btn btn-primary btn-sm" onclick="ctGo(' + (ctIdx + 1) + ')">Next →</button>') +
        '</div></div>');
    }

    function ctGo(i) {
      if (!ctRun || i < 0 || i >= ctRun.questions.length) return;
      ctIdx = i;
      ctQuestion();
    }

    // The answer is shown as picked straight away and saved in the
    // background; a failed save is rolled back so the screen never lies.
    function ctPick(i) {
      const q = ctRun.questions[ctIdx], prev = ctRun.answers[q.id];
      ctRun.answers[q.id] = i;
      ctQuestion();
      ContestAPI.saveAnswer(ctRun.contest.id, q.id, i).catch(err => {
        if (prev === undefined) delete ctRun.answers[q.id]; else ctRun.answers[q.id] = prev;
        if (err.code === 'not_open' || err.code === 'already_submitted') { alert(err.message); ctInit(); }
        else { alert('Could not save your answer — please pick it again.'); ctQuestion(); }
      });
    }

    function ctConfirm() {
      const qs = ctRun.questions;
      const open = qs.filter(q => ctRun.answers[q.id] === undefined).length;
      ctLabel('Contest #' + ctRun.contest.number + ' · Review');
      ctSet(
        '<div class="quiz-card">' +
        '<h2 class="ct-h">Ready to submit?</h2>' +
        '<p class="ct-p">Submitting is final — you can’t change answers afterwards.</p>' +
        '<div class="ct-summary">' + qs.map((q, i) => {
          const a = ctRun.answers[q.id];
          return '<button class="ct-sum-row" onclick="ctGo(' + i + ')">' +
            '<span class="ct-sum-n">Q' + (i + 1) + '</span>' +
            '<span class="ct-sum-q">' + ctEsc(q.text) + '</span>' +
            (a === undefined
              ? '<span class="badge badge-orange">Not answered</span>'
              : '<span class="badge badge-purple">' + 'ABCD'[a] + '</span>') +
            '</button>';
        }).join('') + '</div>' +
        (open ? '<p class="ct-warn">⚠️ ' + open + ' question' + (open > 1 ? 's are' : ' is') + ' unanswered and will score 0.</p>' : '') +
        '<div class="ct-footer">' +
        '<button class="btn btn-ghost btn-sm" onclick="ctGo(' + (qs.length - 1) + ')">← Back to questions</button>' +
        '<button class="btn btn-primary" id="ct-submit" onclick="ctSubmit()">Submit contest</button>' +
        '</div></div>');
    }

    function ctSubmit() {
      const btn = document.getElementById('ct-submit');
      if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }
      ContestAPI.submitAttempt(ctRun.contest.id).then(res => {
        ctSubmitted(ctRun.contest, { submitted_at: res.submitted_at, time_taken_s: res.time_taken_s });
      }).catch(err => {
        if (err.code === 'not_open') ctInit();
        else { alert(err.message); if (btn) { btn.disabled = false; btn.textContent = 'Submit contest'; } }
      });
    }

    function ctSubmitted(c, a) {
      ctRun = null;
      ctLabel('Contest #' + c.number);
      const took = a.time_taken_s != null ? a.time_taken_s
        : Math.round((Date.parse(a.submitted_at) - Date.parse(a.started_at)) / 1000);
      ctSet(
        '<div class="quiz-card ct-center">' +
        '<div class="ct-emoji">✅</div>' +
        '<h2 class="ct-h">You’re in for Contest #' + c.number + '!</h2>' +
        '<p class="ct-p">' + (a.auto_submitted ? 'Auto-submitted when the contest closed' : 'Submitted ' + ctWhen(a.submitted_at)) +
        ' · time taken <strong>' + ctDuration(took) + '</strong></p>' +
        '<div class="ct-locked-box">' +
        '<div class="ct-small">Score, correct answers &amp; leaderboards unlock in</div>' +
        '<div class="ct-count" data-until="' + c.closes_at + '"></div>' +
        '<div class="ct-small">' + ctWhen(c.closes_at) + '</div>' +
        '</div>' +
        '<div class="ct-actions"><button class="btn btn-primary" onclick="show(\'progress\')">Go to leaderboards</button></div>' +
        '</div>');
      ctStartTicker(() => { location.href = '?review=' + c.id; });
    }

    function ctShowReview(id) {
      ctSet('<div class="ct-loading">Loading results…</div>');
      ContestAPI.getReview(id).then(r => {
        const c = r.contest;
        ctLabel('Contest #' + c.number + ' · Results');
        const stat = (val, label) => '<div class="ct-stat"><div class="ct-stat-val">' + val + '</div><div class="ct-stat-label">' + label + '</div></div>';
        const head = r.attempted
          ? '<div class="ct-stats">' +
            stat(r.score, 'Points') +
            stat(r.correct + '/' + r.total_questions, 'Correct') +
            stat(ctDuration(r.time_taken_s), 'Time') +
            stat(r.global ? '#' + r.global.rank + '<small> / ' + r.global.total + '</small>' : '—', 'Global') +
            stat(r.career ? '#' + r.career.rank + '<small> / ' + r.career.total + '</small>' : '—', r.career ? ctEsc(r.career.name) : 'Career rank') +
            '</div>'
          : '<p class="ct-warn">You didn’t take this contest — here are the answers so you can practise.</p>';
        ctSet(
          '<div class="quiz-card">' +
          '<h2 class="ct-h">Contest #' + c.number + ' results</h2>' +
          '<p class="ct-p ct-small">' + ctDates(c) + ' · closed ' + ctWhen(c.closes_at) + '</p>' + head + '</div>' +
          r.questions.map((q, i) => {
            const right = q.your_index === q.correct_index;
            const tag = q.your_index == null ? '<span class="badge badge-orange">Skipped</span>'
              : right ? '<span class="badge badge-green">Correct</span>' : '<span class="badge badge-red">Wrong</span>';
            return '<div class="quiz-card ct-rq">' +
              '<div class="ct-rq-head"><span class="quiz-area">Q' + (i + 1) + ' · ' + ctEsc(q.area) + '</span>' + (r.attempted ? tag : '') + '</div>' +
              '<div class="ct-rq-text">' + ctEsc(q.text) + '</div>' +
              '<div class="ct-rq-opts">' + q.options.map((o, oi) => {
                const cls = oi === q.correct_index ? ' is-correct' : oi === q.your_index ? ' is-wrong' : '';
                const note = oi === q.correct_index ? 'Correct answer' : oi === q.your_index ? 'Your answer' : '';
                return '<div class="ct-rq-opt' + cls + '"><span class="opt-letter">' + 'ABCD'[oi] + '</span>' +
                  '<span>' + ctEsc(o) + '</span>' +
                  (note ? '<span class="ct-rq-note">' + (oi === q.correct_index && oi === q.your_index ? 'Your answer ✓' : note) + '</span>' : '') + '</div>';
              }).join('') + '</div>' +
              '<div class="ct-expl"><strong>Why:</strong> ' + ctEsc(q.explanation) + '</div>' +
              '</div>';
          }).join('') +
          '<div class="ct-actions"><button class="btn btn-primary" onclick="show(\'progress\')">View leaderboards</button>' +
          '<a class="btn btn-ghost" href="quiz.html">This week’s contest</a></div>');
      }).catch(err => {
        if (err.code === 'not_published' || err.code === 'not_found') {
          ctLabel('Weekly Aptitude Contest');
          ctSet('<div class="quiz-card ct-center"><div class="ct-emoji">🔒</div>' +
            '<h2 class="ct-h">Results aren’t out yet</h2><p class="ct-p">' + ctEsc(err.message) + '</p>' +
            '<a class="btn btn-primary" href="quiz.html">Back to the contest</a></div>');
        } else ctError(err);
      });
    }

    // ══════════════════════════════════════════════════════════════
    // LEADERBOARDS (app.html#/progress)
    // ══════════════════════════════════════════════════════════════
    let lbScope = 'global';   // 'global' | 'career'
    let lbPeriod = 'week';    // 'week' (latest closed contest) | 'live' (all contests)
    let lbData = null;        // { state, week, live, history }
    let lbSeq = 0;            // drops responses from superseded requests

    function lbRender() {
      const root = document.getElementById('lb-root');
      if (!root || typeof ContestAPI === 'undefined') return;
      const seq = ++lbSeq;
      if (!lbData) root.innerHTML = '<div class="ct-loading">Loading leaderboards…</div>';
      Promise.all([
        ContestAPI.getState(),
        ContestAPI.getLeaderboard({ scope: lbScope, period: 'week' }),
        ContestAPI.getLeaderboard({ scope: lbScope, period: 'live' }),
        ContestAPI.getHistory()
      ]).then(([state, week, live, history]) => {
        if (seq !== lbSeq) return;
        lbData = { state, week, live, history };
        lbDraw();
      }).catch(err => {
        if (seq !== lbSeq) return;
        root.innerHTML = '<div class="card lb-empty">' + (err.code === 'payment_required' || err.code === 'unauthenticated'
          ? ctErrorBody(err, 'lbRender()')
          : '<p>Couldn’t load the leaderboards: ' + ctEsc(err.message) +
            '</p><button class="btn btn-primary btn-sm" onclick="lbRender()">Retry</button>') + '</div>';
      });
    }

    function lbSetScope(s) { if (s !== lbScope) { lbScope = s; lbRender(); } }
    function lbSetPeriod(p) { if (p !== lbPeriod) { lbPeriod = p; lbDraw(); } }

    function lbDraw() {
      const root = document.getElementById('lb-root');
      if (!root || !lbData) return;
      const { state } = lbData;
      const career = state.career;
      root.innerHTML =
        lbStatus(state) +
        '<div class="lb-bar">' +
        '<div class="lb-tabs" role="tablist" aria-label="Leaderboard">' +
        '<button class="filter-chip' + (lbScope === 'global' ? ' active' : '') + '" role="tab" aria-selected="' + (lbScope === 'global') + '" onclick="lbSetScope(\'global\')">🌍 Global</button>' +
        '<button class="filter-chip' + (lbScope === 'career' ? ' active' : '') + '" role="tab" aria-selected="' + (lbScope === 'career') + '" onclick="lbSetScope(\'career\')">' +
        (career ? ctEsc(lbEmoji(career) + ' ' + career) : '🎯 My career') + '</button>' +
        '</div>' +
        '</div>' +
        lbBody() +
        lbHistory();
      ctStartTicker(lbRender);
    }

    // The career list lives in riasec_careers.js; the server's emoji is the
    // fallback for a career that isn't in it.
    function lbEmoji(title, fallback) {
      const c = (typeof RIASEC_CAREERS !== 'undefined' ? RIASEC_CAREERS : []).find(x => x.title === title);
      return c ? c.emoji : fallback || '🎯';
    }

    function lbStatus(st) {
      const c = st.contest, a = st.attempt;
      let cls, icon, title, sub, btn;
      if (!c) {
        cls = 'is-soon'; icon = '🗓️';
        title = 'The next contest isn’t scheduled yet';
        sub = 'A new contest runs every Saturday 7 AM – Sunday 7 PM IST';
        btn = '';
      } else if (c.status === 'upcoming') {
        cls = 'is-soon'; icon = '🗓️';
        title = 'Contest #' + c.number + ' opens ' + ctWhen(c.opens_at);
        sub = 'Starts in <strong data-until="' + c.opens_at + '"></strong> · new contest every Saturday 7 AM – Sunday 7 PM IST';
        btn = '';
      } else if (a.status === 'submitted') {
        cls = 'is-done'; icon = '✅';
        title = 'Contest #' + c.number + ' submitted';
        sub = 'Your score and this week’s leaderboard unlock in <strong data-until="' + c.closes_at + '"></strong> (' + ctWhen(c.closes_at) + ')';
        btn = '';
      } else if (a.status === 'in_progress') {
        cls = 'is-live'; icon = '✏️';
        title = 'Contest #' + c.number + ' in progress · ' + a.answered_count + ' of ' + c.question_count + ' answered';
        sub = 'Submit before ' + ctWhen(c.closes_at) + ' · <strong data-until="' + c.closes_at + '"></strong> left';
        btn = '<button class="btn btn-primary btn-sm" onclick="show(\'quiz\')">Continue →</button>';
      } else {
        cls = 'is-live'; icon = '🟢';
        title = 'Contest #' + c.number + ' is live';
        sub = '5 questions · closes ' + ctWhen(c.closes_at) + ' · <strong data-until="' + c.closes_at + '"></strong> left';
        btn = '<button class="btn btn-primary btn-sm" onclick="show(\'quiz\')">Take the contest →</button>';
      }
      return '<div class="lb-status ' + cls + '"><div class="lb-status-icon">' + icon + '</div>' +
        '<div class="lb-status-text"><div class="lb-status-title">' + title + '</div><div class="lb-status-sub">' + sub + '</div></div>' +
        btn + '</div>';
    }

    function lbBody() {
      const { week, live, state } = lbData;
      if (week.locked === 'no_career') {
        return '<div class="card lb-empty"><div class="ct-emoji">🧭</div>' +
          '<h3>Find your career to unlock this leaderboard</h3>' +
          '<p>The career leaderboard ranks you against students aiming for the same career as you — your future competition. Take the career quiz to get your top career match.</p>' +
          '<button class="btn btn-primary" onclick="cqStart()">Take the career quiz →</button></div>';
      }
      if (!state.published_count) {
        return '<div class="card lb-empty"><div class="ct-emoji">🏁</div>' +
          '<h3>No results yet</h3><p>The first leaderboard appears when the first contest closes on Sunday at 7:00 PM IST.</p></div>';
      }
      const active = lbPeriod === 'live' ? live : week;
      const scopeName = lbScope === 'career' ? ctEsc(week.career) : 'all students';
      return '<div class="lb-summary">' +
        lbCard('week', week, 'Contest #' + week.contest.number, ctDates(week.contest)) +
        lbCard('live', live, 'Live ranking', 'All ' + live.contests_count + ' contest' + (live.contests_count > 1 ? 's' : '') + ' combined') +
        '</div>' +
        '<div class="card lb-table-card">' +
        '<div class="lb-table-head"><div>' +
        '<div class="lb-table-title">' + (lbPeriod === 'live' ? 'Live ranking' : 'Contest #' + week.contest.number) + ' · ' + scopeName + '</div>' +
        '<div class="lb-table-sub">' + active.total_participants + ' student' + (active.total_participants === 1 ? '' : 's') +
        ' · ranked by score, then time taken</div></div>' +
        '<div class="lb-seg" role="tablist">' +
        '<button class="' + (lbPeriod === 'week' ? 'active' : '') + '" role="tab" aria-selected="' + (lbPeriod === 'week') + '" onclick="lbSetPeriod(\'week\')">This week</button>' +
        '<button class="' + (lbPeriod === 'live' ? 'active' : '') + '" role="tab" aria-selected="' + (lbPeriod === 'live') + '" onclick="lbSetPeriod(\'live\')">Live</button>' +
        '</div></div>' +
        lbTable(active) +
        '</div>';
    }

    function lbCard(period, b, title, sub) {
      const me = b.me;
      const body = me
        ? '<div class="lb-rank">#' + me.rank + '<span> of ' + b.total_participants + '</span></div>' +
          '<span class="badge badge-green">Top ' + ctTopPct(me.rank, b.total_participants) + '%</span>' +
          '<div class="lb-card-line"><strong>' + me.score + ' pts</strong> · ' + me.correct + '/' + me.total_questions + ' correct · ' + ctDuration(me.time_taken_s) + '</div>'
        : '<div class="lb-rank lb-rank-none">Not ranked</div>' +
          '<div class="lb-card-line">' + (period === 'week' ? 'You didn’t take this contest.' : 'Take a contest to get on the board.') + '</div>';
      return '<button class="lb-card' + (lbPeriod === period ? ' active' : '') + '" onclick="lbSetPeriod(\'' + period + '\')">' +
        '<div class="lb-card-title">' + title + '</div><div class="lb-card-sub">' + sub + '</div>' + body + '</button>';
    }

    function lbTable(b) {
      const showCareer = lbScope === 'global';
      const row = r => '<tr class="' + (r.is_me ? 'is-me' : '') + '">' +
        '<td class="lb-pos">' + (['🥇', '🥈', '🥉'][r.rank - 1] || r.rank) + '</td>' +
        '<td><div class="lb-name">' + ctEsc(r.name) + (r.is_me ? ' <span class="badge badge-purple">You</span>' : '') + '</div>' +
        (showCareer ? '<div class="lb-career">' + ctEsc((r.career ? lbEmoji(r.career, r.career_emoji) : '🎯') + ' ' + (r.career || 'Career not set')) + '</div>' : '') + '</td>' +
        '<td class="lb-num"><strong>' + r.score + '</strong></td>' +
        '<td class="lb-num lb-hide-sm">' + r.correct + '/' + r.total_questions + '</td>' +
        '<td class="lb-num">' + ctDuration(r.time_taken_s) + '</td></tr>';
      const meShown = b.rows.some(r => r.is_me);
      return '<div class="lb-scroll"><table class="lb-table">' +
        '<thead><tr><th>Rank</th><th>Student</th><th class="lb-num">Score</th><th class="lb-num lb-hide-sm">Correct</th><th class="lb-num">Time</th></tr></thead>' +
        '<tbody>' + b.rows.map(row).join('') +
        (b.me && !meShown ? '<tr class="lb-gap"><td colspan="5">⋯</td></tr>' + row(b.me) : '') +
        '</tbody></table></div>';
    }

    function lbHistory() {
      const h = lbData.history;
      if (!h.rows.length) return '';
      const rank = x => x ? '#' + x.rank + '<span class="lb-of"> / ' + x.total + '</span>' : '—';
      return '<div class="card lb-table-card">' +
        '<div class="lb-table-head"><div><div class="lb-table-title">Your contest history</div>' +
        '<div class="lb-table-sub">Career ranks use your current career' + (h.career ? ' (' + ctEsc(h.career) + ')' : '') + '</div></div></div>' +
        '<div class="lb-scroll"><table class="lb-table">' +
        '<thead><tr><th>Contest</th><th class="lb-num">Score</th><th class="lb-num">Correct</th><th class="lb-num">Time</th>' +
        '<th class="lb-num">Global</th><th class="lb-num">Career</th><th></th></tr></thead><tbody>' +
        h.rows.map(r => '<tr>' +
          '<td><div class="lb-name">Contest #' + r.contest.number + '</div><div class="lb-career">' + ctDates(r.contest) + '</div></td>' +
          (r.attempted
            ? '<td class="lb-num"><strong>' + r.score + '</strong></td><td class="lb-num">' + r.correct + '/' + r.total_questions + '</td>' +
              '<td class="lb-num">' + ctDuration(r.time_taken_s) + '</td><td class="lb-num">' + rank(r.global) + '</td><td class="lb-num">' + rank(r.career) + '</td>'
            : '<td colspan="5" class="lb-skipped">Not attempted</td>') +
          '<td class="lb-num"><a class="ct-link" href="quiz.html?review=' + r.contest.id + '">Answers →</a></td></tr>'
        ).join('') +
        '</tbody></table></div></div>';
    }
