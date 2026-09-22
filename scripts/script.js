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
    const APP_PAGES = ['dashboard', 'results', 'explorer', 'careerdetail', 'roadmap', 'chat', 'progress', 'settings'];

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
      else if (pageId === 'explorer') syncExplorer();
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

    // Rehydrated on every page load so the dashboard/results/progress
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
      appResults = data; // make available to dashboard, results, progress pages
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
        //row.className = 'air-riasec-row';
        //row.innerHTML =
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

      //if (codeEl) codeEl.textContent = r.code;
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
      if (streamBadge) { streamBadge.textContent = 'See careers in this stream'; streamBadge.style.color = 'var(--accent2)'; }

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
      { key: 'engineering', label: 'Engineering & Trades', families: ['engineering', 'trades'] },
      { key: 'science', label: 'Science', families: ['science'] },
      { key: 'healthcare', label: 'Healthcare', families: ['healthcare'] },
      { key: 'creative', label: 'Design & Arts', families: ['design', 'media-arts'] },
      { key: 'commerce', label: 'Business & Finance', families: ['business', 'finance', 'operations'] },
      { key: 'people', label: 'People & Society', families: ['education', 'psychology', 'social-policy'] },
      { key: 'outdoors', label: 'Outdoors & Services', families: ['outdoor-services'] }
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
    function exStudentPct() {
      const s = loadState();
      if (s.riasecScores && s.riasecScores.pct) return s.riasecScores.pct;
      if (appResults && appResults.riasec && appResults.riasec.pct) return appResults.riasec.pct;
      return null;
    }

    // Colour tracks how strong the match is, not the card's position: with a
    // hundred-plus cards on screen, rank-based colour would say nothing.
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
      const pct = exStudentPct();
      return db.map(c => ({
        career: c,
        match_pct: pct ? Math.round(rsCareerFit(pct, c).fit * 100) : null,
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
      const band = pct === null ? null : exBand(pct);
      const div = document.createElement('div');
      // is-static: these cards are informational. The career detail page is
      // written for one specific career, so sending all of them there would
      // just show the wrong job.
      div.className = 'explore-card is-static';
      div.title = c.why;   // the one-line reason, without stretching every card
      div.innerHTML =
        '<div class="explore-icon" style="background:' +
        (band === null ? 'var(--surface2)' : ICON_BG[band]) + ';">' + c.emoji + '</div>' +
        '<h4></h4>' +
        '<div class="field"></div>' +
        '<span class="badge ' + cqStreamBadge(c.stream) + '" style="margin-bottom:10px;"></span>' +
        '<div class="ex-salary"></div>' +
        (band === null ? '' :
          '<div class="fit"><div class="fit-bar"><div class="fit-fill" style="width:' + pct +
          '%;background:' + PCT_FILL[band] + ';"></div></div>' +
          '<span style="color:' + PCT_COLORS[band] + ';">' + pct + '%</span></div>');
      // Career text is authored copy with quotes and apostrophes in it, so it
      // goes in as text, never as markup.
      div.querySelector('h4').textContent = c.title;
      div.querySelector('.field').textContent = c.field;
      div.querySelector('.badge').textContent = c.stream;
      div.querySelector('.ex-salary').textContent = '💰 ' + c.salary;
      return div;
    }

    // ── Rendering: the bar, the active-filter pills, and the drawer ──
    // Counts are rebuilt on every render so they track the other filters. A
    // control's own selection always stays selectable even when nothing
    // matches it, so a choice can never silently disappear.
    // A real <button>, not the decorative <div> chips elsewhere in the app:
    // inside a modal dialog these have to be reachable and operable from the
    // keyboard. dataset.k lets focus survive the re-render after a click.
    function exChip(key, label, count, on, onClick) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'filter-chip' + (on ? ' active' : '') +
        (count === 0 && !on ? ' is-empty' : '');
      el.dataset.k = key;
      el.setAttribute('aria-pressed', String(!!on));
      // Label and count are separate spans so the count can sit back a step
      // visually instead of reading as part of the name.
      el.innerHTML = '<span class="fc-label"></span><span class="fc-n"></span>';
      el.querySelector('.fc-label').textContent = label;
      el.querySelector('.fc-n').textContent = count;
      el.onclick = onClick;
      return el;
    }

    function exSection(title, chips) {
      const wrap = document.createElement('div');
      wrap.innerHTML = '<div class="ex-group-title"></div><div class="ex-group-chips"></div>';
      wrap.querySelector('.ex-group-title').textContent = title;
      const row = wrap.querySelector('.ex-group-chips');
      chips.forEach(c => row.appendChild(c));
      return wrap;
    }

    // How many filters are narrowing the grid right now. The search box is
    // not counted — it is visible on its own.
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
      if (searchClear) searchClear.className = 'ex-search-clear' + (exQuery ? ' is-on' : '');

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
        const el = document.createElement('div');
        el.className = 'ex-active-pill';
        el.innerHTML = '<span class="exa-key"></span><span class="exa-val"></span>' +
          '<button type="button" aria-label="Remove filter">✕</button>';
        el.querySelector('.exa-key').textContent = key;
        el.querySelector('.exa-val').textContent = value;
        el.querySelector('button').onclick = remove;
        wrap.appendChild(el);
      });

      if (pills.length > 1) {
        const clear = document.createElement('button');
        clear.type = 'button';
        clear.className = 'ex-active-clear';
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
        const none = document.createElement('div');
        none.className = 'ex-none';
        none.innerHTML =
          '<div style="font-size:32px;margin-bottom:10px;">🔍</div>' +
          '<div style="font-weight:700;margin-bottom:4px;"></div>' +
          '<div style="font-size:13px;margin-bottom:18px;">Nothing matches every filter at once — ' +
          'try loosening one.</div>' +
          '<button class="btn btn-secondary btn-sm" onclick="exClear()">Clear filters</button>';
        none.querySelector('div:nth-child(2)').textContent = exQuery.trim()
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
          (exHasFit() ? '' : ' · take the quiz to see your fit %');
      }

      return shown.length;
    }

    // The grid is the source of truth for "how many match", so it renders
    // first and everything else is told the number.
    function exRender() {
      const shown = exRenderGrid();
      exRenderBar(shown);
      exRenderActive();
      exRenderDrawer();
    }

    function syncExplorer() {
      const grid = document.getElementById('explore-grid');
      if (!grid) return;

      exCareers = exBuildList();
      exGroups = exGroupsFor(exCareers);
      if (!exGroups.some(g => g.key === exGroup)) exGroup = 'all';

      // Set by exploreStream(); consumed once so a later visit is unfiltered.
      const pending = loadState().exPendingStream;
      if (pending) {
        saveState({ exPendingStream: null });
        exStream = exStreamOptions(exCareers).indexOf(pending) !== -1 ? pending : 'all';
      }

      exRender();
    }

    // Opens the explorer narrowed to a recommended stream. "PCM+CS / Commerce"
    // names two, so the first (stronger) one is filtered on; "Any" filters
    // nothing. Goes through session state so it survives the hop in from
    // career_results.html.
    function exploreStream(stream) {
      const first = String(stream || '').split('/')[0].trim();
      saveState({ exPendingStream: first && first !== 'Any' ? first : 'all' });
      show('explorer');
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
