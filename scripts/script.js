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
      quizcomplete: 'pages/quiz_complete.html',
      app: 'pages/app.html',
      careerquiz: 'pages/career_quiz.html',
      ailoading: 'pages/ai_loading.html',
      airesults: 'pages/career_results.html'
    };

    // These are .page divs inside app.html — they still switch in place.
    const APP_PAGES = ['dashboard', 'results', 'explorer', 'careerdetail', 'stream', 'roadmap', 'chat', 'progress', 'settings'];

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

    function systemTheme() {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark' : 'light';
    }

    function applyTheme(theme) {
      const t = theme === 'dark' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', t);
      document.querySelectorAll('.theme-toggle').forEach(b => {
        b.setAttribute('aria-pressed', String(t === 'dark'));
        b.setAttribute('title', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
        b.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
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
      applyTheme(storedTheme() || document.documentElement.getAttribute('data-theme') || systemTheme());
      // Follow the OS while the user has not made an explicit choice.
      if (!storedTheme() && window.matchMedia) {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = e => { if (!storedTheme()) applyTheme(e.matches ? 'dark' : 'light'); };
        if (mq.addEventListener) mq.addEventListener('change', onChange);
        else if (mq.addListener) mq.addListener(onChange);
      }
    }

    // ── Screen switching → real page navigation ──
    function show(id) {
      if (APP_PAGES.includes(id)) {
        if (CURRENT_PAGE === 'app') { navTo(id); return; }  // already inside the shell
        location.href = routeTo('app') + '#/' + id;
        return;
      }
      const file = routeTo(id);
      if (file) location.href = file;
    }

    function logout() {
      clearState();
      location.href = routeTo('landing');
    }

    // ── Mobile sidebar drawer (phone breakpoint only) ──
    function toggleSidebar() { document.body.classList.toggle('nav-open'); }
    function closeSidebar() { document.body.classList.remove('nav-open'); }

    // ── App nav (only meaningful on app.html) ──
    function navTo(pageId, btn) {
      if (CURRENT_PAGE !== 'app') { location.href = routeTo('app') + '#/' + pageId; return; }
      document.querySelectorAll('.page').forEach(p => { p.style.display = 'none'; p.classList.remove('active'); });
      const pg = document.getElementById(pageId);
      if (pg) {
        if (pageId === 'chat') { pg.style.display = 'flex'; pg.classList.add('active'); }
        else { pg.style.display = 'block'; pg.classList.add('active'); }
      }
      // btn is passed by the sidebar onclick; on a fresh load we look it up by data-page
      const navBtn = btn || document.querySelector('.nav-item[data-page="' + pageId + '"]');
      if (navBtn) { document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); navBtn.classList.add('active'); }
      // Keep the hash in sync so a reload lands on the same page. The '#/' prefix
      // matters: a bare '#dashboard' matches a real element id, and the browser
      // scroll-anchors to it on load, shoving the page down under the sticky header.
      try { history.replaceState(null, '', '#/' + pageId); } catch (e) { }
      document.body.classList.remove('nav-open'); // collapse the mobile drawer
      window.scrollTo(0, 0);
      // Sync quiz results into the page just revealed
      if (pageId === 'dashboard') syncDashboard();
      else if (pageId === 'results') syncResults();
      else if (pageId === 'stream') syncStream();
      else if (pageId === 'progress') syncProgress();
    }

    // ── Per-page init: replaces the old single-page bootstrap ──
    document.addEventListener('DOMContentLoaded', () => {
      initTheme();
      switch (CURRENT_PAGE) {
        case 'app': {
          const hash = (location.hash || '').replace(/^#\/?/, '');
          navTo(APP_PAGES.includes(hash) ? hash : 'dashboard');
          break;
        }
        case 'onboarding': obInit(); break;
        case 'evaluation': startEval(); break;
        case 'quiz': qIdx = 0; renderQ(); break;
        case 'careerquiz': cqResume(); break;
        case 'ailoading': cqFinish(); break;
        case 'airesults': cqShowResults(); break;
      }
    });

    // ── Auth tabs ──
    function authTab(type, btn) {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('auth-login').style.display = type === 'login' ? 'block' : 'none';
      document.getElementById('auth-register').style.display = type === 'register' ? 'block' : 'none';
    }

    // ── Onboarding steps ──
    let obCurrent = 1;
    const obTitles = ['Tell us about yourself', 'Your subject marks', 'Your interests & hobbies', 'Your aspirations'];
    const obSubs = ['Basic academic details so we can personalise everything.', 'Optional but improves accuracy. Enter your last exam scores.', 'What do you love? This is the most important step.', 'Help us understand your goals and circumstances.'];
    function obStep(dir) {
      document.getElementById('ob-step-' + obCurrent).style.display = 'none';
      obCurrent = Math.max(1, Math.min(4, obCurrent + dir));
      document.getElementById('ob-step-' + obCurrent).style.display = 'block';
      document.getElementById('ob-count').textContent = 'Step ' + obCurrent + ' of 4';
      document.getElementById('ob-title').textContent = obTitles[obCurrent - 1];
      document.getElementById('ob-sub').textContent = obSubs[obCurrent - 1];
      document.getElementById('ob-bar').style.width = (obCurrent * 25) + '%';
      document.getElementById('ob-back').style.visibility = obCurrent > 1 ? 'visible' : 'hidden';
      const dots = document.querySelectorAll('.dot');
      dots.forEach((d, i) => { d.className = 'dot' + (i < obCurrent - 1 ? ' done' : i === obCurrent - 1 ? ' active' : ''); });
      if (obCurrent === 4) document.getElementById('ob-next').textContent = 'Finish ✓';
      else document.getElementById('ob-next').textContent = 'Next →';
      if (obCurrent === 4 && dir === 1) { obCurrent = 4; document.getElementById('ob-next').onclick = () => show('evaluation'); }
      else document.getElementById('ob-next').onclick = () => obStep(1);
    }
    // reset finish btn (called from the per-page init on onboarding.html)
    function obInit() {
      const next = document.getElementById('ob-next');
      if (next) next.onclick = () => obStep(1);
    }

    // ── Chip single-select helper ──
    function chipOne(el, group) {
      el.closest('.chip-grid').querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      el.classList.add('selected');
    }

    // ── Profile Evaluation animation ──
    function startEval() {
      const steps = ['es1', 'es2', 'es3', 'es4'];
      let i = 0;
      const interval = setInterval(() => {
        if (i > 0) { const prev = document.getElementById(steps[i - 1]); prev.className = 'eval-step done'; prev.querySelector('.eval-step-icon').textContent = '✅'; }
        if (i < steps.length) { const cur = document.getElementById(steps[i]); cur.className = 'eval-step loading'; cur.querySelector('.eval-step-icon').textContent = '🔄'; }
        i++;
        if (i >= steps.length) {
          clearInterval(interval);
          setTimeout(() => {
            document.getElementById(steps[steps.length - 1]).className = 'eval-step done';
            document.getElementById(steps[steps.length - 1]).querySelector('.eval-step-icon').textContent = '✅';
            document.getElementById('eval-spinner').style.display = 'none';
            document.getElementById('eval-title').textContent = 'Profile evaluated! ✅';
            document.getElementById('eval-sub').textContent = 'We found 4 clear signals. Review them below.';
            document.getElementById('eval-signals').style.display = 'block';
          }, 600);
        }
      }, 1000);
    }

    // ── Quiz ──
    const questions = [
      { q: 'A pattern shows: 2, 6, 12, 20, 30… What comes next?', opts: ['38', '40', '42', '44'], area: '⚡ Logical Reasoning' },
      { q: 'Which shape, when folded, makes a cube?', opts: ['Cross shape', 'T shape', 'L shape', 'Z shape'], area: '🎨 Spatial Ability' },
      { q: 'Choose the word most opposite to "Concise".', opts: ['Brief', 'Lengthy', 'Clear', 'Simple'], area: '📖 Verbal Aptitude' },
      { q: 'You need to design a new app for grocery shopping. What\'s your first step?', opts: ['Start coding immediately', 'Talk to people who shop groceries', 'Pick the colour theme', 'Search for similar apps'], area: '🌍 Domain Curiosity' },
      { q: 'If 3 workers can build a wall in 6 days, how many days for 9 workers?', opts: ['1 day', '2 days', '3 days', '4 days'], area: '⚡ Logical Reasoning' },
    ];
    let qIdx = 0, selected = null;
    function renderQ() {
      const opts = document.getElementById('quiz-opts');
      if (!opts) return; // not on quiz.html
      const q = questions[qIdx % questions.length];
      document.getElementById('quiz-num').textContent = `Question ${qIdx + 1} of 20`;
      document.getElementById('quiz-area').textContent = q.area;
      document.getElementById('quiz-q').textContent = q.q;
      document.getElementById('quiz-bar').style.width = ((qIdx + 1) / 20 * 100) + '%';
      opts.innerHTML = '';
      q.opts.forEach((o, i) => {
        const letters = ['A', 'B', 'C', 'D'];
        const div = document.createElement('div');
        div.className = 'quiz-option';
        div.innerHTML = `<div class="opt-letter">${letters[i]}</div>${o}`;
        div.onclick = function () { selectOpt(this); };
        opts.appendChild(div);
      });
      selected = null;
    }
    function selectOpt(el) {
      document.querySelectorAll('.quiz-option').forEach(o => o.classList.remove('selected'));
      el.classList.add('selected');
      el.querySelector('.opt-letter').style.background = 'var(--accent)';
      el.querySelector('.opt-letter').style.color = '#fff';
      selected = el;
    }
    function quizNext() {
      if (qIdx >= 19) { show('quizcomplete'); return; }
      qIdx++;
      renderQ();
    }
    function quizPrev() {
      if (qIdx > 0) { qIdx--; renderQ(); }
    }
    // (quiz init now happens in the per-page bootstrap at the top of this file)

    // ── Filter chips ──
    function filterChip(el) {
      el.closest('.results-filter').querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      el.classList.add('active');
    }

    // ── Chat ──
    const aiReplies = [
      "Great question! Based on your aptitude scores, data science is actually a solid match at 71% for you. Your logical reasoning (82) and maths strength support it. However, UX Design at 92% suits you even better because of your spatial skills. You could combine both — UX + data viz is a hot field right now!",
      "UX designers spend their days understanding users, sketching wireframes, building prototypes in Figma, and testing designs with real people. Your Drawing hobby and spatial reasoning score (91st %) are perfect for this. No heavy coding needed — more visual problem-solving.",
      "For architecture, you need PCM (Physics, Chemistry, Maths) in Class 11. You'd target NATA or JEE Paper 2 for entrance. Good news — your maths and spatial scores are strong. Architecture is your #2 match at 85%.",
      "Top design colleges in India: NID Ahmedabad (best for industrial/UX), Symbiosis Design School (Pune), Srishti Institute (Bangalore), NIFT (multiple cities), and IITs via UCEED. NID is the gold standard — very competitive.",
    ];
    let replyIdx = 0;
    function sendChat() {
      const inp = document.getElementById('chat-input');
      const msg = inp.value.trim();
      if (!msg) return;
      addMsg(msg, 'user');
      inp.value = '';
      setTimeout(() => {
        addMsg(aiReplies[replyIdx % aiReplies.length], 'ai');
        replyIdx++;
      }, 800);
    }
    function sendSug(el) {
      document.getElementById('chat-input').value = el.textContent;
      sendChat();
    }
    function addMsg(text, type) {
      const wrap = document.getElementById('chat-messages');
      const div = document.createElement('div');
      div.className = 'msg' + (type === 'user' ? ' user' : '');
      const avatar = document.createElement('div');
      avatar.className = 'msg-avatar ' + (type === 'ai' ? 'msg-ai-avatar' : 'msg-user-avatar');
      avatar.textContent = type === 'ai' ? 'AI' : 'A';
      const inner = document.createElement('div');
      inner.innerHTML = `<div class="msg-bubble">${text}</div><div class="msg-time">Just now</div>`;
      div.appendChild(avatar);
      div.appendChild(inner);
      wrap.appendChild(div);
      wrap.scrollTop = wrap.scrollHeight;
    }

    // ── Toggle ──
    function toggleBtn(el) {
      el.classList.toggle('on');
      el.classList.toggle('off');
    }

    // (renderQ() is called by the per-page init for quiz.html — calling it
    //  here would throw on every other page and abort this script.)

    // ══════════════════════════════════════════════════════════════
    // CAREER INTEREST QUIZ  (RIASEC)
    //
    // The questions, scoring, career matching and result assembly all live
    // in riasec_engine.js / riasec_careers.js, which every page loads before
    // this file. Keeping them there means the Node test harness in tests/
    // scores answers with exactly the same code the browser runs.
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

    // Called from any page ("Take the quiz" / "Retake") — clears the old run
    // and hands off to career_quiz.html, which renders the first question.
    function cqStart() {
      cqIdx = 0;
      cqAnswers = [];
      cqOrder = rsBuildOrder();
      saveState({
        cqIdx: 0, cqAnswers: [], cqOrder: cqOrder,
        appResults: null, isDemo: true
      });
      show('careerquiz');
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
      cqIdx = typeof s.cqIdx === 'number' ? s.cqIdx : 0;
      if (cqIdx < 0 || cqIdx >= RS_QUESTIONS.length) cqIdx = 0;
      cqRender();
    }

    function cqRender() {
      const { qi, q } = cqQuestionAt(cqIdx);
      const order = cqOrder.optionOrder[qi];
      const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
      const total = RS_QUESTIONS.length;

      document.getElementById('cq-num').textContent = 'Question ' + (cqIdx + 1) + ' of ' + total;
      // The area tag is a neutral topic label — it never names the RIASEC
      // dimension being measured (product rule 1).
      document.getElementById('cq-area').textContent = q.area;
      document.getElementById('cq-bar').style.width = ((cqIdx / total) * 100) + '%';
      document.getElementById('cq-back-btn').style.visibility = cqIdx > 0 ? 'visible' : 'hidden';
      document.getElementById('cq-q').textContent = q.q;

      // How many answers this question accepts (doc section 3).
      document.getElementById('cq-hint').textContent = q.maxSelect > 1
        ? 'Select up to ' + q.maxSelect + '  ·  ← to go back'
        : 'Choose 1  ·  ← to go back';

      const optsEl = document.getElementById('cq-opts');
      optsEl.innerHTML = '';

      // Options are rendered in shuffled order; dataset.orig carries the
      // ORIGINAL index so scoring never depends on display position.
      order.forEach((origIdx, pos) => {
        const opt = q.opts[origIdx];
        const d = document.createElement('div');
        d.className = 'cq-opt';
        d.dataset.orig = origIdx;
        d.innerHTML = '<div class="cq-letter" data-letter="' + letters[pos] + '">' + letters[pos] +
          '</div><span></span>';
        // textContent, not innerHTML — option text contains quotes and
        // question marks and should never be parsed as markup.
        d.querySelector('span').textContent = opt.text;
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
    }

    function cqSelect(el, on) {
      const l = el.querySelector('.cq-letter');
      if (on) {
        el.classList.add('selected');
        l.textContent = '✓';
        l.style.background = 'var(--accent)';
        l.style.color = '#fff';
      } else {
        el.classList.remove('selected');
        l.textContent = l.dataset.letter;
        l.style.background = '';
        l.style.color = '';
      }
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

    // "Next →" — collects the selected options then advances
    function cqNextQ() {
      const { qi, q } = cqQuestionAt(cqIdx);
      const selected = [...document.querySelectorAll('#cq-opts .cq-opt.selected')];

      // Require at least one selection
      if (!selected.length) {
        const btn = document.getElementById('cq-next-btn');
        btn.style.animation = 'none';
        requestAnimationFrame(() => { btn.style.animation = 'shake .35s ease'; });
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
      if (cqIdx >= RS_QUESTIONS.length) { show('ailoading'); return; }
      cqSlide('next');
    }

    function cqPrev() {
      if (cqIdx <= 0) return;
      cqIdx--;
      saveState({ cqIdx: cqIdx });
      cqSlide('prev');
    }

    function cqSlide(dir) {
      const wrap = document.getElementById('cq-question-wrap');
      const outX = dir === 'next' ? '-24px' : '24px';
      wrap.style.cssText = 'opacity:0;transform:translateX(' + outX + ');transition:opacity .16s,transform .16s;';
      setTimeout(() => {
        wrap.style.transform = 'translateX(' + (dir === 'next' ? '24px' : '-24px') + ')';
        cqRender();
        requestAnimationFrame(() => {
          wrap.style.cssText = 'opacity:1;transform:translateX(0);transition:opacity .22s,transform .22s;';
        });
      }, 160);
    }

    // Entry point for ai_loading.html — answers arrive via sessionStorage
    async function cqFinish() {
      const s = loadState();
      cqAnswers = Array.isArray(s.cqAnswers) ? s.cqAnswers : [];
      if (!cqAnswers.length) { show('careerquiz'); return; }  // landed here directly
      document.querySelectorAll('.al-step').forEach(el => {
        el.className = 'al-step pending';
        el.querySelector('.al-step-icon').textContent = '⏳';
      });
      document.getElementById('al-step1').className = 'al-step loading';
      document.getElementById('al-step1').querySelector('.al-step-icon').textContent = '🔄';
      await cqRunAI();
    }

    function cqDelay(ms) { return new Promise(r => setTimeout(r, ms)); }

    async function cqRunAI() {
      const stepIds = ['al-step1', 'al-step2', 'al-step3'];
      for (let i = 0; i < stepIds.length; i++) {
        await cqDelay(1100);
        const el = document.getElementById(stepIds[i]);
        el.className = 'al-step done';
        el.querySelector('.al-step-icon').textContent = '✅';
        if (i + 1 < stepIds.length) {
          const next = document.getElementById(stepIds[i + 1]);
          next.className = 'al-step loading';
          next.querySelector('.al-step-icon').textContent = '🔄';
        }
      }
      await cqDelay(500);

      // ── DEMO MODE ONLY ──────────────────────────────────────────
      // The RIASEC engine produces every result on device. No network call
      // is made and no API key is read.
      const scoring = rsScore(cqAnswers, RS_QUESTIONS);
      const results = rsBuildResults(scoring, RIASEC_CAREERS);

      saveState({
        appResults: results,
        isDemo: true,
        riasecScores: {
          pct: scoring.pct,
          code: scoring.code,
          confidence: scoring.confidence
        }
      });
      show('airesults');
    }

    const CQ_STREAM_BADGE = {
      'PCM+CS': 'badge-purple', 'PCM': 'badge-blue', 'PCB': 'badge-green',
      'Commerce': 'badge-orange', 'Arts': 'badge-red', 'Any': 'badge-green'
    };

    // Streams in the career database are slash-separated ("PCB / PCM"), so
    // colour the badge by the first token and fall back to purple.
    function cqStreamBadge(stream) {
      const first = String(stream || '').split('/')[0].trim();
      return CQ_STREAM_BADGE[first] || 'badge-purple';
    }

    // Rehydrated on every page load so the dashboard/results/stream/progress
    // pages in app.html can read the last quiz run.
    let appResults = loadState().appResults || null;

    // Entry point for career_results.html
    function cqShowResults() {
      const s = loadState();
      if (!s.appResults) { show('careerquiz'); return; }  // no run to show
      cqRenderResults(s.appResults, s.isDemo !== false);
      cqInitPrint();
    }

    // ── Save the report as a PDF ───────────────────────────────────────────
    // Deliberately the browser's own print-to-PDF rather than a canvas/PDF
    // library: no third-party script has to be fetched (so the page's "nothing
    // is sent anywhere" promise still holds offline), the text in the PDF stays
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
    // button produce the same document.
    function cqInitPrint() {
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
        document.title = 'CareerAI-Career-Report-' + cqDateStamp();
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
      appResults = data; // make available to dashboard, results, stream pages
      document.getElementById('air-personality-type').textContent = data.personality_type;
      document.getElementById('air-personality-desc').textContent = data.personality_desc;
      document.getElementById('air-stream-val').textContent = data.stream_recommendation;
      document.getElementById('air-stream-reason').textContent = data.stream_reason;
      const demoBadge = document.getElementById('air-demo-badge');
      if (demoBadge) demoBadge.style.display = isDemo ? 'inline-block' : 'none';

      cqRenderRiasec(data.riasec);

      const list = document.getElementById('air-careers');
      list.innerHTML = '';
      const pcts = PCT_COLORS;
      (data.top_careers || []).forEach((c, i) => {
        const color = pcts[i] || 'var(--accent)';
        const div = document.createElement('div');
        div.className = 'air-career-card';
        div.style.animationDelay = (i * 0.1) + 's';
        div.innerHTML =
          '<div class="air-rank ' + (i === 0 ? 'air-rank-top' : '') + '">' + (i + 1) + '</div>' +
          '<div class="air-career-icon">' + c.emoji + '</div>' +
          '<div class="air-career-info">' +
          '<div class="air-career-name"></div>' +
          '<div class="air-career-field"></div>' +
          '<div class="air-career-why"></div>' +
          '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">' +
          '<span class="badge ' + cqStreamBadge(c.stream) + '"></span>' +
          '<span class="badge" style="background:var(--well);color:var(--muted);border:1px solid var(--border);"></span>' +
          '</div>' +
          '</div>' +
          '<div class="air-pct" style="color:' + color + ';">' + c.match_pct + '%</div>';
        div.querySelector('.air-career-name').textContent = c.title;
        div.querySelector('.air-career-field').textContent = c.field;
        div.querySelector('.air-career-why').textContent = c.why;
        const badges = div.querySelectorAll('.badge');
        badges[0].textContent = c.stream;
        badges[1].textContent = '💰 ' + c.salary;
        list.appendChild(div);
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

      // Six dimensions, so these run one past the shared five-item ramp.
      const fills = PCT_FILL.concat(['var(--fill-6)']);
      const texts = PCT_COLORS.concat(['var(--ramp-6)']);
      bars.innerHTML = '';
      r.ranked.forEach((d, i) => {
        const strong = i < 3;
        const row = document.createElement('div');
        row.className = 'air-riasec-row' + (strong ? ' air-riasec-row-top' : '');
        // The letter here is what decodes the chip above — the top three,
        // in this order, are the code. Naming the areas twice was the
        // earlier version of this and it just read as repetition.
        row.innerHTML =
          '<div class="air-riasec-letter"' + (strong ? ' style="color:' + texts[i] + ';"' : '') + '>' +
          d.dim + '</div>' +
          '<div class="air-riasec-label"><span class="air-riasec-emoji">' + d.emoji + '</span>' +
          '<span class="air-riasec-name"></span></div>' +
          '<div class="air-riasec-track"><div class="air-riasec-fill" style="width:' + d.pct +
          '%;background:' + fills[i] + ';opacity:' + (strong ? 1 : 0.45) + ';"></div></div>' +
          '<div class="air-riasec-pct" style="color:' + (strong ? texts[i] : 'var(--muted)') + ';">' +
          d.pct + '%</div>';
        row.querySelector('.air-riasec-name').textContent = d.plain;
        bars.appendChild(row);
      });

      // Each letter is a tile in the rank colour of its bar, so the eye
      // links "A" to the top bar without the code being spelled out twice.
      const codeLetters = (r.code || '').split('')
        .map(l => ({ letter: l, dim: r.ranked.find(d => d.dim === l) }))
        .filter(x => x.dim);

      if (codeEl) {
        codeEl.textContent = '';
        codeLetters.forEach((x, i) => {
          const tile = document.createElement('span');
          tile.className = 'air-riasec-code-tile';
          tile.style.color = texts[i];
          tile.style.borderBottomColor = fills[i];
          tile.textContent = x.letter;
          codeEl.appendChild(tile);
        });
      }

      // The letters are only meaningful if the student is told what they
      // stand for: formal area name plus the plain "you like…" line.
      // These come from the engine's tables rather than the saved payload,
      // so a result stored by an older build still renders the full text.
      const keyEl = document.getElementById('air-code-key');
      if (keyEl) {
        keyEl.innerHTML = '';
        codeLetters.forEach((x, i) => {
          const name = (typeof RS_DIM_NAMES !== 'undefined' && RS_DIM_NAMES[x.letter]) || x.dim.name;
          const mean = (typeof RS_DIM_MEANING !== 'undefined' && RS_DIM_MEANING[x.letter]) || x.dim.meaning;
          if (!name || !mean) return;
          const row = document.createElement('div');
          row.className = 'air-code-key-row';
          row.innerHTML =
            '<span class="air-code-key-letter" style="color:' + texts[i] +
            ';border-bottom-color:' + fills[i] + ';"></span>' +
            '<div class="air-code-key-text"><span class="air-code-key-name"></span>' +
            ' — you like <span class="air-code-key-mean"></span></div>';
          row.querySelector('.air-code-key-letter').textContent = x.letter;
          row.querySelector('.air-code-key-name').textContent = name;
          row.querySelector('.air-code-key-mean').textContent = mean + '.';
          keyEl.appendChild(row);
        });
      }

      // Flag genuinely close scores rather than implying a firm ranking
      // (doc section 8).
      const note = document.getElementById('air-riasec-note');
      if (note) {
        const tied = (r.close || []).find(g => g.length > 1 && g.indexOf(r.ranked[0].dim) !== -1);
        note.textContent = tied
          ? 'Your top areas scored very close together, so treat them as similarly strong.'
          : 'Your strongest area stands clearly ahead of the rest.';
      }

      if (enjoyEl) {
        enjoyEl.innerHTML = '';
        (r.enjoy || []).forEach(t => {
          const li = document.createElement('li');
          li.textContent = t;
          enjoyEl.appendChild(li);
        });
      }

      const matched = document.getElementById('air-match-note');
      if (matched) {
        matched.textContent = r.qualifiedCount + ' of ' + r.consideredCount +
          ' careers scored above the minimum match level.';
      }
    }

    // ══════════════════════════════════════════════════════════════
    // SYNC QUIZ RESULTS → DASHBOARD / RESULTS / STREAM / PROGRESS
    // ══════════════════════════════════════════════════════════════
    // Ranked-series colours, resolved per theme in style.css. PCT_COLORS is
    // text (contrast-safe on --surface), PCT_FILL is the same series as a bar
    // fill, ICON_BG the matching tile tint. The old literals were the dark
    // palette and fell to roughly 1.5:1 once light became the default theme.
    const PCT_COLORS = ['var(--ramp-1)', 'var(--ramp-2)', 'var(--ramp-3)', 'var(--ramp-4)', 'var(--ramp-5)'];
    const PCT_FILL = ['var(--fill-1)', 'var(--fill-2)', 'var(--fill-3)', 'var(--fill-4)', 'var(--fill-5)'];
    const ICON_BG = ['var(--tint-1)', 'var(--tint-2)', 'var(--tint-3)', 'var(--tint-4)', 'var(--tint-5)'];

    // Builds one stat tile. Four of these sit in a fixed row, so the value,
    // label and sub-line all come through the same shape whether the card is
    // populated or still locked.
    function dbStat(o) {
      return '<div class="stat-card' + (o.locked ? ' locked' : '') + '">' +
        '<div class="stat-icon" style="background:' + (o.tint || 'var(--surface2)') + ';">' + o.icon + '</div>' +
        '<div class="stat-val' + (o.isText ? ' is-text' : '') + '"' +
        (o.color ? ' style="color:' + o.color + ';"' : '') + '>' + o.val + '</div>' +
        '<div class="stat-label">' + o.label + '</div>' +
        '<div class="stat-change">' + o.sub + '</div>' +
        '</div>';
    }

    function syncDashboard() {
      const main = document.getElementById('db-main');
      const stats = document.getElementById('db-stats');
      const title = document.getElementById('db-title');
      const sub = document.getElementById('db-sub');
      const ctaBtn = document.getElementById('db-cta-btn');

      // ── NO RESULTS: show empty / CTA state ─────────────────────────
      if (!appResults) {
        title.textContent = 'Welcome to CareerAI 👋';
        sub.textContent = 'Take the 20-question quiz to discover careers that fit you.';
        ctaBtn.textContent = 'Take Career Quiz →';
        ctaBtn.onclick = cqStart;

        main.innerHTML =
          '<div class="db-empty">' +
          '<div class="db-empty-icon">🧭</div>' +
          '<h3>Start with the career quiz</h3>' +
          '<p>Answer 20 quick questions and our AI will match you to the careers ' +
          'that fit your interests, strengths, and learning style.</p>' +
          '<button class="btn btn-primary btn-lg" onclick="cqStart()">Start the Career Quiz — 5 mins →</button>' +
          '<div class="db-unlocks">' +
          '<span class="db-unlock">🎯 Ranked career matches</span>' +
          '<span class="db-unlock">🛤️ Stream recommendation</span>' +
          '<span class="db-unlock">🗺️ 5-year roadmap</span>' +
          '</div>' +
          '</div>';

        // Locked, but still readable. The previous treatment was opacity .4
        // over a --border-coloured value, which vanished on a white canvas.
        stats.innerHTML =
          dbStat({ locked: 1, icon: '🔒', val: '—', isText: 1, label: 'Top Career Match', sub: 'Take the quiz to unlock' }) +
          dbStat({ locked: 1, icon: '🔒', val: '—', isText: 1, label: 'Recommended Stream', sub: 'Take the quiz to unlock' }) +
          dbStat({ locked: 1, icon: '📝', val: '0', label: 'Quiz Sessions Done', sub: 'Complete your first quiz' }) +
          dbStat({ locked: 1, icon: '🔍', val: '—', isText: 1, label: 'Careers Evaluated', sub: 'Unlocks after the quiz' });
        return;
      }

      // ── HAS RESULTS: populate from appResults ──────────────────────
      const d = appResults, top = d.top_careers[0];

      title.textContent = 'Your Dashboard 🎯';
      sub.textContent = d.personality_type + ' · Quiz completed · ' + d.stream_recommendation + ' recommended';
      ctaBtn.textContent = 'View All Matches →';
      ctaBtn.onclick = () => navTo('results');

      // Welcome banner
      let bannerHtml =
        '<div class="welcome-banner">' +
        '<div class="welcome-text">' +
        '<h2>Top match: ' + top.emoji + ' ' + top.title +
        ' <span class="wb-pct">' + top.match_pct + '%</span></h2>' +
        '<p>' + d.personality_type + ' · Recommending <strong>' + d.stream_recommendation + '</strong> for Class 11</p>' +
        '</div>' +
        '<button class="btn btn-primary" onclick="navTo(\'results\',document.querySelectorAll(\'.nav-item\')[1])">See All Matches →</button>' +
        '</div>';

      // Career strip
      bannerHtml += '<div class="section-label">Top Career Matches' +
        '<button class="sl-link" onclick="navTo(\'results\',document.querySelectorAll(\'.nav-item\')[1])">See all →</button></div>';
      bannerHtml += '<div class="top-career-strip" id="db-strip">';
      d.top_careers.forEach((c, i) => {
        bannerHtml +=
          '<div class="career-pill" onclick="navTo(\'results\',document.querySelectorAll(\'.nav-item\')[1])">' +
          '<span style="font-size:18px;">' + c.emoji + '</span>' +
          '<div><div class="career-pill-name">' + c.title + '</div></div>' +
          '<div class="career-pill-pct" style="color:' + PCT_COLORS[i] + ';">' + c.match_pct + '%</div>' +
          '</div>';
      });
      bannerHtml += '</div>';
      main.innerHTML = bannerHtml;

      // Stat cards
      stats.innerHTML =
        dbStat({
          icon: top.emoji, tint: ICON_BG[0], color: PCT_COLORS[0],
          val: top.match_pct + '%', label: 'Top Career Match', sub: top.title
        }) +
        dbStat({
          icon: '🛤️', tint: ICON_BG[1], color: PCT_COLORS[1],
          val: d.stream_recommendation, isText: 1, label: 'Recommended Stream',
          sub: d.stream_reason
        }) +
        dbStat({
          icon: '🎯', tint: ICON_BG[2], color: PCT_COLORS[2],
          val: d.top_careers.length, label: 'Careers Matched', sub: 'From your quiz answers'
        }) +
        dbStat({
          icon: '✅', tint: ICON_BG[3], color: PCT_COLORS[3],
          val: '20', label: 'Questions Answered', sub: 'Quiz complete'
        });
    }

    function syncResults() {
      const list = document.getElementById('career-list');
      const streamVal = document.getElementById('results-stream-val');
      const streamBadge = document.getElementById('results-stream-badge');

      if (!appResults) {
        if (streamVal) streamVal.textContent = '—';
        if (streamBadge) { streamBadge.textContent = 'Take the quiz to unlock'; streamBadge.style.color = 'var(--muted)'; }
        if (list) list.innerHTML =
          '<div style="text-align:center;padding:56px 20px;color:var(--muted);">' +
          '<div style="font-size:40px;margin-bottom:16px;">📊</div>' +
          '<div style="font-size:16px;font-weight:700;margin-bottom:8px;">No career matches yet</div>' +
          '<div style="font-size:14px;margin-bottom:24px;">Complete the 20-question quiz to see your personalised career rankings.</div>' +
          '<button class="btn btn-primary" onclick="cqStart()">Take Career Quiz →</button>' +
          '</div>';
        return;
      }

      const d = appResults;
      if (streamVal) streamVal.textContent = d.stream_recommendation;
      if (streamBadge) { streamBadge.textContent = 'Based on your quiz'; streamBadge.style.color = 'var(--accent2)'; }

      if (!list) return;
      list.innerHTML = '';
      d.top_careers.forEach((c, i) => {
        const color = PCT_COLORS[i];
        const div = document.createElement('div');
        div.className = 'career-card';
        div.onclick = () => navTo('careerdetail', null);
        div.innerHTML =
          '<div class="career-rank ' + (i < 2 ? 'top' : '') + '">' + (i + 1) + '</div>' +
          '<div class="career-icon-wrap" style="background:' + ICON_BG[i] + ';">' + c.emoji + '</div>' +
          '<div class="career-info">' +
          '<div class="career-name">' + c.title + '</div>' +
          '<div class="career-field">' + c.field + '</div>' +
          '<div class="career-reason">"' + c.why + '"</div>' +
          '</div>' +
          '<div class="career-score-wrap">' +
          '<div class="career-pct" style="color:' + color + ';">' + c.match_pct + '%</div>' +
          '<div class="pct-mini-bar"><div class="pct-mini-fill" style="width:' + c.match_pct + '%;background:' + PCT_FILL[i] + ';"></div></div>' +
          '</div>';
        list.appendChild(div);
      });
    }

    function syncStream() {
      if (!appResults) return;
      const d = appResults;

      // ── Hero ──
      const nameEl = document.querySelector('.stream-rec-name');
      const pctEl = document.querySelector('.stream-rec-pct');
      const reasonEl = document.querySelector('.stream-reason');
      if (nameEl) nameEl.textContent = d.stream_recommendation;
      if (pctEl) pctEl.textContent = 'Based on your career quiz · High confidence';
      if (reasonEl) reasonEl.textContent = d.stream_reason;

      // ── Highlight matching stream card ──
      const rec = d.stream_recommendation.toLowerCase();
      document.querySelectorAll('.stream-opt').forEach(card => {
        const h4 = card.querySelector('h4');
        if (!h4) return;
        const name = h4.textContent.replace(' ✦', '').trim();
        // Strip extra descriptors so 'PCM+CS' matches 'PCM + CS ✦' etc.
        const cardKey = name.toLowerCase().replace(/\s/g, '').replace('+', '');
        const recKey = rec.replace(/\s/g, '').replace('+', '');
        const isMatch = recKey.startsWith(cardKey) || cardKey.startsWith(recKey);
        if (isMatch) {
          if (!name.includes('✦')) h4.textContent = name + ' ✦';
          card.style.borderWidth = '2px';
          card.style.borderColor = 'var(--accent)';
          card.style.background = 'rgba(108,99,255,.1)';
        } else {
          h4.textContent = name.replace(' ✦', '');
          card.style.borderColor = '';
          card.style.background = '';
        }
      });
    }

    function syncProgress() {
      if (!appResults) return;
      const d = appResults, top = d.top_careers[0];
      // Update the Class 10 row in "Top Match Evolution"
      const evol = document.querySelector('#progress .card');
      if (!evol) return;
      // Re-render evolution table
      const items = evol.querySelectorAll('div[style*="align-items:center"]');
      if (items[2]) { // Class 10 row (index 2)
        items[2].innerHTML =
          '<span style="color:var(--accent2);width:60px;font-weight:700;">Class 10</span>' +
          '<span style="font-weight:700;">' + top.emoji + ' ' + top.title + '</span>' +
          '<span style="color:var(--accent2);font-weight:800;margin-left:auto;">' + top.match_pct + '% ✦</span>';
      }
      // AI note
      const note = document.querySelector('#progress [style*="rgba(108,99,255,.06)"] div:last-child');
      if (note) note.textContent =
        '"Your profile points strongly toward ' + d.personality_type.replace('The ', '') + '. ' +
        top.title + ' is your top career at ' + top.match_pct + '%. Stream recommendation: ' + d.stream_recommendation + '."';
    }
