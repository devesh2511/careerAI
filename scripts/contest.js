    // ══════════════════════════════════════════════════════════════
    // WEEKLY APTITUDE CONTEST — UI
    // quiz.html        → the contest itself (ct* functions)
    // app.html#/contests → global + career leaderboards (lb* functions)
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
    let ctOnReview = false;   // the "Ready to submit?" screen is up
    let ctSubmitting = false; // a submit is in flight: answers are frozen

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
    // Markup helpers (the design system lives in /css; icons in the sprite).
    function ctIcon(n) { return '<svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-' + n + '"/></svg>'; }
    function ctIllo(n, size) { return '<div class="illo' + (size ? ' illo-' + size : '') + '"><img src="/assets/illustrations/' + n + '-' + (size === 'lg' ? 400 : 200) + '.webp" alt=""></div>'; }
    function ctEmpty(art, title, text, actions) {
      return '<section class="card-flat"><div class="empty">' + ctIllo(art, 'lg') + '<h1 class="empty-title">' + title + '</h1>' +
        (text ? '<p class="empty-text">' + text + '</p>' : '') + '<div class="cluster">' + (actions || '') + '</div></div></section>';
    }
    function ctLoading(text) {
      return '<div class="card-flat skeleton-card" aria-hidden="true"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-line w-80"></div><div class="skeleton skeleton-line w-60"></div></div>' +
        '<p class="visually-hidden" role="status">' + text + '</p>';
    }

    function ctError(err) {
      ctLabel('Weekly contest');
      ctSet(ctErrorBody(err, 'ctInit()'));
    }

    // The server checks the session and the plan on every contest call, so
    // a 401 or 402 can arrive even after the page's own access check passed.
    function ctErrorBody(err, retry) {
      if (err && err.code === 'payment_required') {
        return ctEmpty('lock', 'Contests come with the full plan', ctEsc(err.message || 'Get a plan to play every Saturday.'),
          '<button class="btn btn-primary" onclick="show(\'paywall\')">See plans</button>');
      }
      if (err && err.code === 'unauthenticated') {
        return ctEmpty('lock', 'Log in to play', 'Your session has ended. Your answers, rank and streak are saved to your account.',
          '<button class="btn btn-primary" onclick="show(\'auth\')">Log in</button>');
      }
      return '<section class="card-flat stack" role="alert"><h1>Something went wrong</h1><p class="muted">' + ctEsc(err && err.message || 'Please try again.') + '</p>' +
        '<div><button class="btn btn-primary" onclick="' + retry + '">' + ctIcon('refresh-cw') + 'Try again</button></div></section>';
    }

    // Entry point for quiz.html. ?review=N shows a closed contest's answers.
    // During an attempt the question is in the hash (#/q/3, #/review) and
    // the browser's Back steps back through the questions (stepInit, in
    // script.js).
    function ctInit() {
      clearInterval(ctTick);
      stepInit(ctStepBack);
      const review = new URLSearchParams(location.search).get('review');
      if (review) { ctShowReview(review); return; }
      ctSet(ctLoading('Loading this week’s contest'));
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
      return p ? '<a class="btn btn-ghost" href="?review=' + p.id + '">See contest #' + p.number + ' answers</a>' : '';
    }

    function ctIntro(st) {
      const c = st.contest;
      ctLabel('Contest #' + c.number);
      ctSet(
        '<section class="card stack-lg stack contest-hero" aria-labelledby="ct-intro-title">' + ctIllo('trophy', 'lg') +
        '<div class="stack-sm stack"><span class="live-badge"><span class="live-dot"></span>LIVE</span>' +
        '<h1 id="ct-intro-title">Weekly contest #' + c.number + '</h1>' +
        '<p class="muted">Closes ' + ctWhen(c.closes_at) + '. <span class="countdown-inline num" data-until="' + c.closes_at + '"></span> left.</p></div>' +
        '<ul class="rules">' +
        '<li>' + ctIcon('list-checks') + '<span>5 questions, ' + c.points_per_question + ' points each</span></li>' +
        '<li>' + ctIcon('clock') + '<span>No time limit, but time taken breaks ties, so the clock starts when you press Start</span></li>' +
        '<li>' + ctIcon('lock') + '<span>One attempt. You can change answers until you submit</span></li>' +
        '<li>' + ctIcon('trophy') + '<span>Score, correct answers and leaderboards unlock when the contest closes</span></li>' +
        '</ul>' +
        '<div class="cluster cluster-lg"><button class="btn btn-primary" onclick="ctBegin(' + c.id + ')">Start the contest' + ctIcon('arrow-right') + '</button>' + ctLastLink(st) + '</div>' +
        '</section>');
      ctStartTicker(ctInit);
    }

    function ctUpcoming(st) {
      const c = st.contest;
      ctLabel('Next contest');
      ctSet(
        '<section class="card stack contest-hero" aria-labelledby="ct-up-title">' + ctIllo('calendar', 'lg') +
        '<h1 id="ct-up-title">Contest #' + c.number + ' opens soon</h1>' +
        '<p class="muted">A new 5-question contest opens every Saturday at 7 am and closes on Sunday at 7 pm IST. This one opens ' + ctWhen(c.opens_at) + '.</p>' +
        '<p class="countdown" data-until="' + c.opens_at + '"></p>' +
        '<div class="cluster">' +
        (st.latest_published ? '<a class="btn btn-primary" href="?review=' + st.latest_published.id + '">See contest #' + st.latest_published.number + ' results</a>' : '') +
        '<button class="btn btn-ghost" onclick="show(\'contests\')">View leaderboards</button></div></section>');
      ctStartTicker(ctInit);
    }

    // No contest is scheduled yet (the admins add each week's).
    function ctNoContest(st) {
      ctLabel('Weekly contest');
      ctSet(ctEmpty('calendar', 'No contest this week',
        'A new 5-question contest opens every Saturday at 7 am and closes on Sunday at 7 pm IST. Check back soon.',
        (st.latest_published ? '<a class="btn btn-primary" href="?review=' + st.latest_published.id + '">See contest #' + st.latest_published.number + ' results</a>' : '') +
        '<button class="btn btn-ghost" onclick="show(\'contests\')">View leaderboards</button>'));
    }

    function ctBegin(id) {
      ctSet(ctLoading('Getting your questions'));
      ContestAPI.startAttempt(id).then(run => {
        ctRun = run;
        const firstOpen = run.questions.findIndex(q => run.answers[q.id] === undefined);
        ctIdx = firstOpen === -1 ? run.questions.length - 1 : firstOpen;
        // A reload reopens the question (or review screen) it was on.
        const m = /^#\/q\/(\d+)$/.exec(location.hash);
        if (m && +m[1] >= 1 && +m[1] <= run.questions.length) ctIdx = +m[1] - 1;
        if (location.hash === '#/review') ctConfirm(); else ctQuestion();
      }).catch(err => {
        if (err.code === 'already_submitted' || err.code === 'not_open') { ctEnd(); ctInit(); }
        else ctError(err);
      });
    }

    function ctDots() {
      return '<nav class="ct-dots" aria-label="Questions">' + ctRun.questions.map((q, i) =>
        '<button class="ct-dot' + (ctRun.answers[q.id] !== undefined ? ' answered' : '') + (i === ctIdx ? ' current' : '') +
        '" type="button"' + (i === ctIdx ? ' aria-current="step"' : '') + ' aria-label="Question ' + (i + 1) + (ctRun.answers[q.id] !== undefined ? ', answered' : '') +
        '" onclick="ctGo(' + i + ')">' + (i + 1) + '</button>'
      ).join('') + '</nav>';
    }

    function ctQuestion() {
      clearInterval(ctTick);
      ctOnReview = false;
      const qs = ctRun.questions, q = qs[ctIdx], chosen = ctRun.answers[q.id];
      const last = ctIdx === qs.length - 1;
      const answered = qs.filter(x => ctRun.answers[x.id] !== undefined).length;
      ctLabel('Contest #' + ctRun.contest.number + ', question ' + (ctIdx + 1) + ' of ' + qs.length);
      ctSet(
        '<progress class="progress" max="' + qs.length + '" value="' + answered + '" aria-label="' + answered + ' of ' + qs.length + ' answered">' + answered + '</progress>' +
        ctDots() +
        '<section class="stack" aria-labelledby="ct-q"><p class="badge badge-outline">' + ctEsc(q.area) + '</p>' +
        '<h1 class="question-text" id="ct-q">' + ctEsc(q.text) + '</h1>' +
        '<div class="option-list" role="radiogroup" aria-labelledby="ct-q">' + q.options.map((o, i) =>
          '<button class="option quiz-option' + (chosen === i ? ' selected' : '') + '" type="button" role="radio" aria-checked="' + (chosen === i) +
          '" onclick="ctPick(' + i + ')"><span class="option-letter opt-letter">' + 'ABCD'[i] + '</span><span>' + ctEsc(o) + '</span></button>'
        ).join('') + '</div></section>' +
        '<div class="cluster cluster-between ct-footer">' +
        '<button class="btn btn-secondary" onclick="ctGo(' + (ctIdx - 1) + ')"' + (ctIdx === 0 ? ' disabled' : '') + '>' + ctIcon('arrow-left') + 'Previous</button>' +
        (last
          ? '<button class="btn btn-primary" onclick="ctConfirm()">Review and submit' + ctIcon('arrow-right') + '</button>'
          : '<button class="btn btn-primary" onclick="ctGo(' + (ctIdx + 1) + ')">Next question' + ctIcon('arrow-right') + '</button>') +
        '</div>');
      stepSync(ctIdx > 0, '#/q/' + (ctIdx + 1));
    }

    // Browser Back mid-attempt: review screen → last question → the one before.
    function ctStepBack() {
      if (!ctRun) return false;
      if (ctSubmitting) { stepSync(true, '#/review'); return true; }   // stay put, keep the guard
      if (ctOnReview) { ctGo(ctRun.questions.length - 1); return true; }
      if (ctIdx > 0) { ctGo(ctIdx - 1); return true; }
      return false;
    }

    function ctGo(i) {
      if (!ctRun || ctSubmitting || i < 0 || i >= ctRun.questions.length) return;
      ctIdx = i;
      ctQuestion();
    }

    // The answer is shown as picked straight away and saved in the
    // background; a failed save is rolled back so the screen never lies.
    // A failure that a later tap (or the end of the attempt) has overtaken
    // is left alone: the later save reports for itself.
    function ctPick(i) {
      if (!ctRun || ctSubmitting) return;
      const run = ctRun, q = run.questions[ctIdx], prev = run.answers[q.id];
      run.answers[q.id] = i;
      ctQuestion();
      ContestAPI.saveAnswer(run.contest.id, q.id, i).catch(err => {
        if (ctRun !== run || run.answers[q.id] !== i) return;
        if (prev === undefined) delete run.answers[q.id]; else run.answers[q.id] = prev;
        if (err.code === 'not_open' || err.code === 'already_submitted') { alert(err.message); ctEnd(); ctInit(); }
        else { alert('Could not save your answer — please pick it again.'); ctQuestion(); }
      });
    }

    function ctConfirm() {
      ctOnReview = true;
      stepSync(true, '#/review');
      const qs = ctRun.questions;
      const open = qs.filter(q => ctRun.answers[q.id] === undefined).length;
      ctLabel('Contest #' + ctRun.contest.number + ', review');
      ctSet(
        '<section class="stack" aria-labelledby="ct-ready-title"><h1 id="ct-ready-title">Ready to submit?</h1>' +
        '<p class="muted">Submitting is final. You can still change any answer before you submit.</p>' +
        (open ? '<div class="alert alert-warn">' + ctIcon('info') + '<span>' + open + ' question' + (open > 1 ? 's have' : ' has') + ' no answer yet and will score 0.</span></div>' : '') +
        '<div class="card-flat list">' + qs.map((q, i) => {
          const a = ctRun.answers[q.id];
          return '<button class="list-row ct-sum-row" type="button" onclick="ctGo(' + i + ')">' +
            '<span class="ct-dot' + (a === undefined ? ' current' : ' answered') + '">' + (i + 1) + '</span>' +
            '<span class="grow ct-sum-q">' + ctEsc(q.text) + '</span>' +
            (a === undefined ? '<span class="badge badge-accent">No answer</span>' : '<span class="badge badge-outline">' + 'ABCD'[a] + '</span>') +
            '</button>';
        }).join('') + '</div>' +
        '<div class="cluster cluster-between ct-footer">' +
        '<button class="btn btn-secondary" onclick="ctGo(' + (qs.length - 1) + ')">' + ctIcon('arrow-left') + 'Back to questions</button>' +
        '<button class="btn btn-primary" id="ct-submit" onclick="ctSubmit()">' + ctIcon('send') + 'Submit answers</button>' +
        '</div></section>');
    }

    function ctSubmit() {
      const btn = document.getElementById('ct-submit');
      if (btn) { btn.disabled = true; btn.classList.add('busy'); btn.textContent = 'Submitting'; }
      ctSubmitting = true;
      ContestAPI.submitAttempt(ctRun.contest.id).then(res => {
        ctSubmitted(ctRun.contest, { submitted_at: res.submitted_at, time_taken_s: res.time_taken_s });
      }).catch(err => {
        if (err.code === 'not_open') { ctEnd(); ctInit(); }
        else { ctSubmitting = false; alert(err.message); if (btn) { btn.disabled = false; btn.classList.remove('busy'); btn.textContent = 'Submit answers'; } }
      });
    }

    // The attempt is over (submitted, or closed under it): drop it so the
    // browser's Back can't redraw one of its questions.
    function ctEnd() {
      ctRun = null;
      ctOnReview = false;
      ctSubmitting = false;
      stepSync(false, location.pathname + location.search);  // no question to come back to
    }

    function ctSubmitted(c, a) {
      ctEnd();
      ctLabel('Contest #' + c.number);
      const took = a.time_taken_s != null ? a.time_taken_s
        : Math.round((Date.parse(a.submitted_at) - Date.parse(a.started_at)) / 1000);
      ctSet(
        '<section class="card stack contest-hero" aria-labelledby="ct-done-title">' + ctIllo('thumb-up', 'lg') +
        '<h1 id="ct-done-title">Answers submitted</h1>' +
        '<p class="muted">' + (a.auto_submitted ? 'Submitted automatically when the contest closed' : 'Submitted ' + ctWhen(a.submitted_at)) +
        '. Time taken: <b>' + ctDuration(took) + '</b>.</p>' +
        '<p class="small muted">Score, correct answers and leaderboards unlock in</p>' +
        '<p class="countdown" data-until="' + c.closes_at + '"></p>' +
        '<div><button class="btn btn-primary" onclick="show(\'contests\')">Go to leaderboards</button></div></section>');
      ctStartTicker(() => { location.replace('?review=' + c.id); });
    }

    function ctShowReview(id) {
      ctSet(ctLoading('Loading results'));
      ContestAPI.getReview(id).then(r => {
        const c = r.contest;
        ctLabel('Contest #' + c.number + ', results');
        const metric = (val, label) => '<div class="metric"><span class="metric-value">' + val + '</span><span class="metric-label">' + label + '</span></div>';
        const head = r.attempted
          ? '<section class="card-ink stack" aria-labelledby="ct-res-title"><div class="cluster cluster-lg">' + ctIllo('medal', 'sm') +
            '<div><p class="muted small">Contest #' + c.number + ', ' + ctDates(c) + '</p><h1 class="card-title-lg" id="ct-res-title">' + r.correct + ' out of ' + r.total_questions + '</h1></div></div>' +
            '<div class="metric-row">' + metric(r.score, 'Points') + metric(ctDuration(r.time_taken_s), 'Time taken') +
            metric(r.global ? '#' + r.global.rank : '—', r.global ? 'Global, of ' + r.global.total : 'Global rank') + '</div>' +
            (r.career ? '<p class="small muted">Career rank #' + r.career.rank + ' of ' + r.career.total + ' (' + ctEsc(r.career.name) + ')</p>' : '') + '</section>'
          : '<section class="stack"><h1>Contest #' + c.number + ' answers</h1><div class="alert alert-info">' + ctIcon('info') + '<span>You didn’t take this contest. Here are the answers so you can practise.</span></div></section>';
        ctSet(head +
          r.questions.map((q, i) => {
            const right = q.your_index === q.correct_index;
            const tag = q.your_index == null ? '<span class="badge badge-outline">Skipped</span>'
              : right ? '<span class="badge fit-strong">' + ctIcon('check') + 'Correct</span>' : '<span class="badge badge-wrong">' + ctIcon('x') + 'Wrong</span>';
            const yours = q.your_index != null ? '<p class="answer-row ' + (right ? 'answer-right' : 'answer-wrong') + '">' + ctIcon(right ? 'check' : 'x') +
              '<span><b>Your answer:</b> ' + ctEsc(q.options[q.your_index]) + '</span></p>' : '';
            const correct = !right ? '<p class="answer-row answer-right">' + ctIcon('check') + '<span><b>Correct answer:</b> ' + ctEsc(q.options[q.correct_index]) + '</span></p>' : '';
            return '<article class="card-flat stack-sm stack review-q ct-rq">' +
              '<div class="card-head"><p class="small muted">Question ' + (i + 1) + ', ' + ctEsc(q.area) + '</p>' + (r.attempted ? tag : '') + '</div>' +
              '<h2 class="card-title ct-rq-text">' + ctEsc(q.text) + '</h2>' + yours + correct +
              (q.explanation ? '<p class="small muted ct-expl"><b>Why:</b> ' + ctEsc(q.explanation) + '</p>' : '') + '</article>';
          }).join('') +
          '<div class="cluster"><button class="btn btn-primary" onclick="show(\'contests\')">View leaderboards</button>' +
          '<a class="btn btn-ghost" href="quiz.html">This week’s contest</a></div>');
      }).catch(err => {
        if (err.code === 'not_published' || err.code === 'not_found') {
          ctLabel('Weekly contest');
          ctSet(ctEmpty('calendar', 'Results aren’t out yet', ctEsc(err.message), '<a class="btn btn-secondary" href="quiz.html">Back to the contest</a>'));
        } else ctError(err);
      });
    }

    // ══════════════════════════════════════════════════════════════
    // LEADERBOARDS (app.html#/contests)
    // ══════════════════════════════════════════════════════════════
    let lbScope = 'global';   // 'global' | 'career'
    let lbCareer = null;      // the career board shown when lbScope is 'career'
    let lbPeriod = 'week';    // 'week' (latest closed contest) | 'live' (all contests)
    let lbData = null;        // { state, week, live, history, scope, career }
    let lbSeq = 0;            // drops responses from superseded requests

    function lbRender() {
      const root = document.getElementById('lb-root');
      if (!root || typeof ContestAPI === 'undefined') return;
      const seq = ++lbSeq, scope = lbScope, career = lbCareer;
      if (!lbData) root.innerHTML = ctLoading('Loading leaderboards');
      Promise.all([
        ContestAPI.getState(),
        ContestAPI.getLeaderboard({ scope: lbScope, period: 'week', career: lbCareer }),
        ContestAPI.getLeaderboard({ scope: lbScope, period: 'live', career: lbCareer }),
        ContestAPI.getHistory()
      ]).then(([state, week, live, history]) => {
        if (seq !== lbSeq) return;
        lbData = { state, week, live, history, scope, career };
        lbDraw();
        if (typeof syncLiveBadge === 'function') syncLiveBadge(state);
      }).catch(err => {
        if (seq !== lbSeq) return;
        // A retaken quiz can drop the career this board was on: start over on the current one.
        if (err.code === 'invalid' && lbCareer) { lbCareer = null; lbRender(); return; }
        root.innerHTML = err.code === 'payment_required' || err.code === 'unauthenticated'
          ? ctErrorBody(err, 'lbRender()')
          : '<div class="alert alert-error" role="alert">' + ctIcon('circle-alert') + '<div class="stack-sm stack"><span>Couldn’t load the leaderboards: ' + ctEsc(err.message) +
            '</span><div><button class="btn btn-secondary btn-sm" onclick="lbRender()">Try again</button></div></div></div>';
      });
    }

    function lbSetScope(s) { if (s !== lbScope) { lbScope = s; lbCareer = null; lbRender(); } }
    function lbSetCareer(c) { if (lbScope !== 'career' || c !== lbCareer) { lbScope = 'career'; lbCareer = c; lbRender(); } }
    // While another board is still loading, its render picks up the new period.
    function lbSetPeriod(p) {
      if (p === lbPeriod) return;
      lbPeriod = p;
      if (lbData && lbData.scope === lbScope && lbData.career === lbCareer) lbDraw();
    }

    function lbDraw() {
      const root = document.getElementById('lb-root');
      if (!root || !lbData) return;
      const { state, week } = lbData;
      // One chip per suggested career (GET /contest/state → careers), current career first.
      const careers = state.careers && state.careers.length ? state.careers : state.career ? [state.career] : [];
      const shown = lbScope === 'career' ? week.career : null;
      const chip = (on, label, click, attr) => '<button class="tab-btn filter-chip' + (on ? ' active' : '') + '" type="button" role="tab" aria-selected="' + on + '"' +
        (attr || '') + ' onclick="' + click + '">' + label + '</button>';
      root.innerHTML =
        lbStatus(state) +
        '<div class="tabs lb-tabs" role="tablist" aria-label="Leaderboard">' +
        chip(lbScope === 'global', 'Global', 'lbSetScope(\'global\')') +
        (careers.length
          ? careers.map(c => chip(c === shown, ctEsc(c), 'lbSetCareer(this.dataset.career)', ' data-career="' + ctEsc(c) + '"')).join('')
          : chip(lbScope === 'career', 'My career', 'lbSetScope(\'career\')')) +
        '</div>' +
        lbBody() +
        lbHistory();
      // Refresh at the deadline only if the board is still on screen; coming
      // back to #/contests renders it afresh (syncProgress).
      ctStartTicker(() => { if (root.closest('.page.active')) lbRender(); });
    }

    function lbStatus(st) {
      const c = st.contest, a = st.attempt;
      let cls, art, title, sub, btn, live = false;
      if (!c) {
        cls = 'is-soon'; art = 'calendar';
        title = 'No contest this week';
        sub = 'A new contest runs every Saturday 7 am to Sunday 7 pm IST.';
        btn = '';
      } else if (c.status === 'upcoming') {
        cls = 'is-soon'; art = 'calendar';
        title = 'Contest #' + c.number + ' opens ' + ctWhen(c.opens_at);
        sub = 'Starts in <span class="countdown-inline num" data-until="' + c.opens_at + '"></span>.';
        btn = '';
      } else if (a.status === 'submitted') {
        cls = 'is-done'; art = 'thumb-up';
        title = 'Contest #' + c.number + ' submitted';
        sub = 'Your score and this week’s leaderboard unlock in <span class="countdown-inline num" data-until="' + c.closes_at + '"></span> (' + ctWhen(c.closes_at) + ').';
        btn = '';
      } else if (a.status === 'in_progress') {
        cls = 'is-live'; art = 'trophy'; live = true;
        title = 'Contest #' + c.number + ' in progress';
        sub = a.answered_count + ' of ' + c.question_count + ' answered. Submit before ' + ctWhen(c.closes_at) + ', <span class="countdown-inline num" data-until="' + c.closes_at + '"></span> left.';
        btn = '<button class="btn btn-primary" onclick="show(\'quiz\')">Continue</button>';
      } else {
        cls = 'is-live'; art = 'trophy'; live = true;
        title = 'Contest #' + c.number + ' is live';
        sub = '5 questions. Closes ' + ctWhen(c.closes_at) + ', <span class="countdown-inline num" data-until="' + c.closes_at + '"></span> left.';
        btn = '<button class="btn btn-primary" onclick="show(\'quiz\')">Play now</button>';
      }
      return '<section class="' + (live ? 'card-ink' : 'card') + ' lb-status ' + cls + '" aria-label="This week’s contest">' + ctIllo(art, 'sm') +
        '<div class="stack-sm stack">' + (live ? '<span class="live-badge"><span class="live-dot"></span>LIVE</span>' : '') +
        '<h2 class="card-title-lg lb-status-title">' + title + '</h2><p class="muted lb-status-sub">' + sub + '</p></div>' + btn + '</section>';
    }

    function lbBody() {
      const { week, live, state } = lbData;
      if (week.locked === 'no_career') {
        return ctEmpty('target', 'Find your career to unlock this leaderboard',
          'The career leaderboard ranks you against students aiming for the same career as you. Take the career quiz to get your top match.',
          '<button class="btn btn-primary" onclick="cqStart()">Take the career quiz</button>').replace('<h1 class="empty-title">', '<h2 class="empty-title">').replace('</h1>', '</h2>');
      }
      if (!state.published_count) {
        return ctEmpty('calendar', 'No results yet', 'The first leaderboard appears when the first contest closes on Sunday at 7 pm IST.', '')
          .replace('<h1 class="empty-title">', '<h2 class="empty-title">').replace('</h1>', '</h2>');
      }
      const active = lbPeriod === 'live' ? live : week;
      const scopeName = lbScope === 'career' ? ctEsc(week.career) : 'all students';
      return '<div class="grid-2 lb-summary">' +
        lbCard('week', week, 'Contest #' + week.contest.number, ctDates(week.contest)) +
        lbCard('live', live, 'All contests', (live.contests_count || 0) + ' contest' + (live.contests_count === 1 ? '' : 's') + ' combined') +
        '</div>' +
        '<section class="card-flat stack lb-table-card" aria-labelledby="lb-board-title">' +
        '<div class="section-head"><div class="stack-xs stack"><h2 class="card-title lb-table-title" id="lb-board-title">' + (lbPeriod === 'live' ? 'All contests' : 'Contest #' + week.contest.number) + ', ' + scopeName + '</h2>' +
        '<p class="small muted lb-table-sub">' + active.total_participants + ' student' + (active.total_participants === 1 ? '' : 's') +
        ', ranked by score, then time taken' +
        (lbScope === 'career' && week.career !== state.career ? '. You’re ranked against students aiming for this career' : '') + '.</p></div>' +
        '<div class="seg lb-seg" role="tablist" aria-label="Period">' +
        '<button class="seg-btn' + (lbPeriod === 'week' ? ' active' : '') + '" type="button" role="tab" aria-selected="' + (lbPeriod === 'week') + '" onclick="lbSetPeriod(\'week\')">This week</button>' +
        '<button class="seg-btn' + (lbPeriod === 'live' ? ' active' : '') + '" type="button" role="tab" aria-selected="' + (lbPeriod === 'live') + '" onclick="lbSetPeriod(\'live\')">All time</button>' +
        '</div></div>' +
        lbTable(active) +
        '</section>';
    }

    function lbCard(period, b, title, sub) {
      const me = b.me;
      const body = me
        ? '<div class="cluster cluster-lg"><span class="rank-big">#' + me.rank + '</span><span class="muted small">of ' + b.total_participants + ' students<br>' +
          me.correct + '/' + me.total_questions + ' correct, ' + ctDuration(me.time_taken_s) + '</span></div>' +
          '<span class="badge fit-strong">Top ' + ctTopPct(me.rank, b.total_participants) + '%</span>'
        : '<p class="card-title">Not ranked</p><p class="small muted">' + (period === 'week' ? 'You didn’t take this contest.' : 'Take a contest to get on the board.') + '</p>';
      return '<button class="card-flat card-link lb-card stack-sm stack' + (lbPeriod === period ? ' active' : '') + '" type="button" aria-pressed="' + (lbPeriod === period) + '" onclick="lbSetPeriod(\'' + period + '\')">' +
        '<span class="small muted lb-card-title">' + title + ', ' + sub + '</span>' + body + '</button>';
    }

    function lbTable(b) {
      const showCareer = lbScope === 'global';
      const row = r => '<tr class="' + (r.is_me ? 'is-me' : '') + '">' +
        '<td class="num lb-pos">#' + r.rank + '</td>' +
        '<td><span class="lb-name">' + ctEsc(r.name) + (r.is_me ? ' (you)' : '') + '</span>' +
        (showCareer ? '<br><span class="small muted lb-career">' + ctEsc(r.career || 'Career not set') + '</span>' : '') + '</td>' +
        '<td class="col-num"><b>' + r.score + '</b></td>' +
        '<td class="col-num lb-hide-sm">' + r.correct + '/' + r.total_questions + '</td>' +
        '<td class="col-num lb-hide-sm">' + ctDuration(r.time_taken_s) + '</td></tr>';
      const meShown = b.rows.some(r => r.is_me);
      return '<div class="table-wrap"><table class="table lb-table">' +
        '<thead><tr><th scope="col">Rank</th><th scope="col">Student</th><th scope="col" class="col-num">Score</th><th scope="col" class="col-num lb-hide-sm">Correct</th><th scope="col" class="col-num lb-hide-sm">Time</th></tr></thead>' +
        '<tbody>' + b.rows.map(row).join('') +
        (b.me && !meShown ? '<tr class="lb-gap"><td colspan="5" class="muted">…</td></tr>' + row(b.me) : '') +
        '</tbody></table></div>';
    }

    function lbHistory() {
      const h = lbData.history;
      if (!h.rows.length) return '';
      const rank = x => x ? '#' + x.rank + '<span class="muted lb-of"> of ' + x.total + '</span>' : '—';
      return '<section class="card-flat stack lb-table-card" aria-labelledby="lb-hist-title">' +
        '<div class="stack-xs stack"><h2 class="card-title" id="lb-hist-title">Your past contests</h2>' +
        '<p class="small muted">Career ranks use your current career' + (h.career ? ' (' + ctEsc(h.career) + ')' : '') + '.</p></div>' +
        '<div class="table-wrap"><table class="table lb-table">' +
        '<thead><tr><th scope="col">Contest</th><th scope="col" class="col-num">Score</th><th scope="col" class="col-num lb-hide-sm">Time</th>' +
        '<th scope="col" class="col-num">Global</th><th scope="col" class="col-num lb-hide-sm">Career</th><th scope="col"><span class="visually-hidden">Answers</span></th></tr></thead><tbody>' +
        h.rows.map(r => '<tr>' +
          '<td><span class="lb-name">Contest #' + r.contest.number + '</span><br><span class="small muted">' + ctDates(r.contest) + '</span></td>' +
          (r.attempted
            ? '<td class="col-num"><b>' + r.score + '</b></td><td class="col-num lb-hide-sm">' + ctDuration(r.time_taken_s) + '</td>' +
              '<td class="col-num">' + rank(r.global) + '</td><td class="col-num lb-hide-sm">' + rank(r.career) + '</td>'
            : '<td colspan="4" class="muted lb-skipped">Not attempted</td>') +
          '<td><a class="ct-link" href="quiz.html?review=' + r.contest.id + '">Answers</a></td></tr>'
        ).join('') +
        '</tbody></table></div></section>';
    }
