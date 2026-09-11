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
      loadSavedKey();
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
    // CAREER INTEREST QUIZ  —  20 questions from PDF
    // ══════════════════════════════════════════════════════════════
    const CQ_QUESTIONS = [
      // Q1 shortened
      {
        q: "On a free Saturday with no plans, what would you naturally spend hours doing?",
        opts: ["Puzzles, science, coding, or figuring how things work", "Business ideas, buying/selling, or managing money", "Reading, writing, debating, or learning about people & society", "Building, repairing, or designing something", "Sports, performing, music, or creating content"],
        hasOther: true, area: "🌅 Free Time"
      },
      // Q2 shortened
      {
        q: "Which type of question would you most enjoy investigating?",
        opts: ["Why does a scientific phenomenon happen?", "Why do some businesses succeed while others fail?", "Why do people think and behave differently?", "How can we build or fix something practical?", "How can ideas be expressed through art, music, or design?"],
        hasOther: true, area: "🔍 Curiosity"
      },
      { q: "What do you enjoy doing most?", opts: ["Solving difficult problems", "Making useful plans", "Understanding different people", "Making things yourself"], area: "⚡ Strengths" },
      { q: "Which school activity would you enjoy most?", opts: ["Science experiments", "Business projects", "Debates and discussions", "Building useful things"], area: "🏫 School" },
      { q: "Which subjects do you enjoy most?", opts: ["Maths and Science", "Business and Numbers", "History and Languages", "Computers and Practical Work", "Arts and Creativity"], area: "📚 Subjects" },
      { q: "What do you enjoy learning about?", opts: ["Space and technology", "Money and business", "People and society", "Machines and tools"], area: "🌍 Learning" },
      { q: "When learning something new, what do you prefer?", opts: ["Understand how it works", "See real-life examples", "Discuss it with others", "Try it yourself"], area: "🧠 Learning Style" },
      { q: "Which activity would you enjoy most?", opts: ["Solving a tough puzzle", "Planning a small business", "Helping someone", "Building a model"], area: "🎯 Activities" },
      { q: "What are you naturally good at?", opts: ["Logical thinking", "Managing things", "Understanding people", "Making things"], area: "💪 Natural Skills" },
      { q: "Which activity sounds most interesting?", opts: ["Conducting science experiments", "Managing money", "Understanding people", "Building a machine"], area: "🔭 Interests" },
      { q: "What do you enjoy solving?", opts: ["Maths problems", "Money problems", "People problems", "Practical problems"], area: "🧩 Problem Solving" },
      { q: "Which future workplace sounds best?", opts: ["Lab or research centre", "Company or bank", "School or court", "Workshop or factory"], area: "🏢 Workplace" },
      { q: "Which describes you best?", opts: ["I ask many questions", "I like achieving goals", "I understand people well", "I learn by doing"], area: "🪞 Personality" },
      { q: "What would you enjoy doing?", opts: ["Finding new answers", "Managing a project", "Helping other people", "Fixing something broken"], area: "✨ Enjoyment" },
      { q: "Which sounds most interesting?", opts: ["Discovering new things", "Starting a business", "Understanding human behaviour", "Designing new products"], area: "💡 Interests" },
      { q: "How do you prefer working?", opts: ["Working with numbers", "Working with people", "Working with ideas", "Working with machines"], area: "⚙️ Work Style" },
      { q: "What kind of career sounds best?", opts: ["Solving complex problems", "Running a business", "Helping people", "Building new things"], area: "🎓 Career" },
      { q: "How much do you know about careers?", opts: ["I know many careers", "I know some careers", "I know few careers", "I know almost none"], area: "📖 Awareness" },
      { q: "What influences your career choice most?", opts: ["My own interests", "Family expectations", "Job opportunities", "Salary and stability"], area: "🌟 Values" },
      { q: "What matters most in your future career?", opts: ["Solving interesting problems", "Earning good money", "Helping other people", "Creating new things", "Having a stable career"], area: "🏆 Goals" },
    ];

    let cqIdx = 0, cqAnswers = [];

    // Called from any page ("Take the quiz" / "Retake") — clears the old run
    // and hands off to career_quiz.html, which renders Q1 on load.
    function cqStart() {
      cqIdx = 0; cqAnswers = [];
      saveState({ cqIdx: 0, cqAnswers: [], appResults: null, isDemo: true });
      show('careerquiz');
    }

    // Entry point for career_quiz.html — restore progress and draw the question
    function cqResume() {
      const s = loadState();
      cqAnswers = Array.isArray(s.cqAnswers) ? s.cqAnswers : [];
      cqIdx = typeof s.cqIdx === 'number' ? s.cqIdx : 0;
      if (cqIdx < 0 || cqIdx >= CQ_QUESTIONS.length) cqIdx = 0;
      cqRender();
    }

    function cqRender() {
      const q = CQ_QUESTIONS[cqIdx];
      const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
      document.getElementById('cq-num').textContent = 'Question ' + (cqIdx + 1) + ' of ' + CQ_QUESTIONS.length;
      document.getElementById('cq-area').textContent = q.area;
      document.getElementById('cq-bar').style.width = ((cqIdx / CQ_QUESTIONS.length) * 100) + '%';
      document.getElementById('cq-back-btn').style.visibility = cqIdx > 0 ? 'visible' : 'hidden';
      document.getElementById('cq-q').textContent = q.q;

      const optsEl = document.getElementById('cq-opts');
      optsEl.innerHTML = '';

      // Regular options — each is a toggle
      q.opts.forEach((opt, i) => {
        const d = document.createElement('div');
        d.className = 'cq-opt';
        d.dataset.idx = i;
        d.innerHTML = '<div class="cq-letter" data-letter="' + letters[i] + '">' + letters[i] + '</div><span>' + opt + '</span>';
        d.onclick = () => cqToggle(d);
        optsEl.appendChild(d);
      });

      // "Something else" option (Q1 & Q2 only) — toggles the free-text input
      if (q.hasOther) {
        const otherIdx = q.opts.length;
        const d = document.createElement('div');
        d.className = 'cq-opt';
        d.dataset.idx = otherIdx;
        d.innerHTML = '<div class="cq-letter" data-letter="' + letters[otherIdx] + '">' + letters[otherIdx] + '</div><span>Something else — tell me</span>';
        d.onclick = () => {
          cqToggle(d);
          const isOn = d.classList.contains('selected');
          const ow = document.getElementById('cq-other-wrap');
          ow.style.display = isOn ? 'flex' : 'none';
          if (isOn) document.getElementById('cq-other-input').focus();
        };
        optsEl.appendChild(d);
      }

      document.getElementById('cq-other-wrap').style.display = 'none';
      document.getElementById('cq-other-input').value = '';

      // Restore previously selected options when going back
      const prev = cqAnswers[cqIdx];
      if (prev && prev.indices) {
        const allOpts = optsEl.querySelectorAll('.cq-opt');
        prev.indices.forEach(idx => {
          const opt = allOpts[idx];
          if (!opt) return;
          opt.classList.add('selected');
          const l = opt.querySelector('.cq-letter');
          l.textContent = '✓'; l.style.background = 'var(--accent)'; l.style.color = '#fff';
          // Restore "something else" text input
          if (q.hasOther && idx === q.opts.length && prev.otherText) {
            document.getElementById('cq-other-wrap').style.display = 'flex';
            document.getElementById('cq-other-input').value = prev.otherText;
          }
        });
      }
    }

    // Toggle an option on/off — letter shows ✓ when selected
    function cqToggle(el) {
      const l = el.querySelector('.cq-letter');
      if (el.classList.contains('selected')) {
        el.classList.remove('selected');
        l.textContent = l.dataset.letter;
        l.style.background = ''; l.style.color = '';
      } else {
        el.classList.add('selected');
        l.textContent = '✓';
        l.style.background = 'var(--accent)'; l.style.color = '#fff';
      }
    }

    // "Next →" button handler — collects all selected options then advances
    function cqNextQ() {
      const selectedEls = [...document.querySelectorAll('#cq-opts .cq-opt.selected')];
      const indices = selectedEls.map(el => parseInt(el.dataset.idx));
      const texts = selectedEls
        .map(el => el.querySelector('span').textContent)
        .filter(t => t !== 'Something else — tell me');

      // Collect free-text "other" entry if visible
      const otherInput = document.getElementById('cq-other-input');
      const otherVisible = document.getElementById('cq-other-wrap').style.display !== 'none';
      const otherText = otherVisible ? otherInput.value.trim() : '';
      if (otherText) texts.push(otherText);

      // Require at least one selection
      if (indices.length === 0 && !otherText) {
        const btn = document.getElementById('cq-next-btn');
        btn.style.animation = 'none';
        requestAnimationFrame(() => { btn.style.animation = 'shake .35s ease'; });
        return;
      }

      cqAnswers[cqIdx] = { q: CQ_QUESTIONS[cqIdx].q, indices, answers: texts, otherText };
      cqIdx++;
      saveState({ cqIdx: cqIdx, cqAnswers: cqAnswers });
      // Last question → hand off to ai_loading.html, which runs the analysis
      if (cqIdx >= CQ_QUESTIONS.length) { show('ailoading'); return; }
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
      // reset steps
      document.querySelectorAll('.al-step').forEach(s => { s.className = 'al-step pending'; s.querySelector('.al-step-icon').textContent = '⏳'; });
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
      const apiKey = localStorage.getItem('openai_key');
      let results, isDemo = true;
      try {
        if (apiKey) { results = await cqCallOpenAI(apiKey); isDemo = false; }
        else { results = cqMockResults(); }
      } catch (e) { results = cqMockResults(); }
      // Persist, then hand off to career_results.html to render
      saveState({ appResults: results, isDemo: isDemo });
      show('airesults');
    }

    function cqBuildPrompt() {
      const qa = cqAnswers.map((a, i) => 'Q' + (i + 1) + ': ' + a.q + '\nAnswer: ' + a.answers.join(', ')).join('\n\n');
      return 'You are an expert career counsellor for Indian students in Class 8-10.\n\nStudent answers:\n' + qa + '\n\nRespond ONLY with valid JSON:\n{"personality_type":"The [Adj] [Noun]","personality_desc":"2 sentences.","stream_recommendation":"PCM+CS","stream_reason":"1-2 sentences.","top_careers":[{"rank":1,"title":"","emoji":"🎨","field":"","match_pct":90,"why":"1-2 sentences specific to their answers.","stream":"PCM+CS","salary":"₹X–Y LPA starting"}]}\nProvide exactly 5 careers. match_pct 55-95.';
    }

    async function cqCallOpenAI(apiKey) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'system', content: 'Career counsellor. JSON only, no markdown.' }, { role: 'user', content: cqBuildPrompt() }],
          response_format: { type: 'json_object' },
          temperature: 0.7
        })
      });
      if (!res.ok) throw new Error('API ' + res.status);
      const data = await res.json();
      return JSON.parse(data.choices[0].message.content);
    }

    function cqMockResults() {
      // Score each answer by its letter index (A=0, B=1, C=2, D=3, E=4)
      const score = { A: 0, B: 0, C: 0, D: 0, E: 0 };
      cqAnswers.forEach(a => {
        if (a && a.indices) {
          a.indices.forEach(idx => {
            const l = String.fromCharCode(65 + idx);
            if (score[l] !== undefined) score[l]++;
          });
        }
      });
      const sorted = Object.entries(score).sort((x, y) => y[1] - x[1]);
      const topScore = sorted[0][1];
      const g = i => topScore - sorted[i][1]; // gap from top to position i

      // Key selection: 50 possible profiles
      // A=Analytical B=Business C=People D=Hands-On E=Creative
      let key;
      if (g(4) <= 5)       key = 'ABCDE';
      else if (g(3) <= 4)  key = [sorted[0][0],sorted[1][0],sorted[2][0],sorted[3][0]].sort().join('');
      else if (g(2) <= 3)  key = [sorted[0][0],sorted[1][0],sorted[2][0]].sort().join('');
      else if (g(1) <= 2)  key = sorted[0][0] + sorted[1][0]; // ordered: dominant first, no sort
      else if (g(1) <= 6)  key = sorted[0][0] + '_' + sorted[1][0]; // clear winner with secondary flavour
      else                  key = sorted[0][0]; // pure dominant

      const P = CAREER_PROFILES;

      // Fallback chain: try ordered key → sorted 2-letter → pure dominant → A
      return P[key] || P[sorted[0][0]+sorted[1][0]] || P[[sorted[0][0],sorted[1][0]].sort().join('')] || P[sorted[0][0]] || P['A'];
    }

    const CQ_STREAM_BADGE = { 'PCM+CS': 'badge-purple', 'PCM': 'badge-blue', 'PCB': 'badge-green', 'Commerce': 'badge-orange', 'Arts': 'badge-red', 'Any': 'badge-green', 'Arts / PCB': 'badge-green', 'Arts / PCM+CS': 'badge-purple', 'PCM / Design': 'badge-blue', 'Commerce / Arts': 'badge-orange', 'Business / People': 'badge-orange', 'PCM+CS / Commerce': 'badge-purple', 'PCM+CS / Arts': 'badge-purple', 'Commerce / PCM': 'badge-orange', 'PCM / Commerce': 'badge-blue', 'PCM+CS / PCM': 'badge-purple', 'Arts / Commerce': 'badge-red', 'PCB / Arts': 'badge-green', 'PCM / Arts': 'badge-blue', 'Arts / Any': 'badge-red', 'PCM+CS or Commerce': 'badge-purple', 'PCM or Commerce': 'badge-blue', 'PCM or Arts': 'badge-blue', 'Commerce / PCM+CS': 'badge-orange', 'PCB': 'badge-green' };

    // Rehydrated on every page load so the dashboard/results/stream/progress
    // pages in app.html can read the last quiz run.
    let appResults = loadState().appResults || null;

    // Entry point for career_results.html
    function cqShowResults() {
      const s = loadState();
      if (!s.appResults) { show('careerquiz'); return; }  // no run to show
      cqRenderResults(s.appResults, s.isDemo !== false);
    }

    function cqRenderResults(data, isDemo) {
      appResults = data; // make available to dashboard, results, stream pages
      document.getElementById('air-personality-type').textContent = data.personality_type;
      document.getElementById('air-personality-desc').textContent = data.personality_desc;
      document.getElementById('air-stream-val').textContent = data.stream_recommendation;
      document.getElementById('air-stream-reason').textContent = data.stream_reason;
      const demoBadge = document.getElementById('air-demo-badge');
      demoBadge.style.display = isDemo ? 'inline-block' : 'none';

      const list = document.getElementById('air-careers');
      list.innerHTML = '';
      const pcts = ['#a8a3ff', '#00d4aa', '#38bdf8', '#fcd34d', '#fb923c'];
      (data.top_careers || []).forEach((c, i) => {
        const color = pcts[i] || 'var(--accent)';
        const badgeCls = CQ_STREAM_BADGE[c.stream] || 'badge-purple';
        const div = document.createElement('div');
        div.className = 'air-career-card';
        div.style.animationDelay = (i * 0.1) + 's';
        div.innerHTML =
          '<div class="air-rank ' + (i === 0 ? 'air-rank-top' : '') + '">' + (i + 1) + '</div>' +
          '<div class="air-career-icon">' + c.emoji + '</div>' +
          '<div class="air-career-info">' +
          '<div class="air-career-name">' + c.title + '</div>' +
          '<div class="air-career-field">' + c.field + '</div>' +
          '<div class="air-career-why">"' + c.why + '"</div>' +
          '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">' +
          '<span class="badge ' + badgeCls + '">' + c.stream + '</span>' +
          '<span class="badge" style="background:rgba(0,0,0,.3);color:var(--muted);border:1px solid var(--border);">💰 ' + c.salary + '</span>' +
          '</div>' +
          '</div>' +
          '<div class="air-pct" style="color:' + color + ';">' + c.match_pct + '%</div>';
        list.appendChild(div);
      });
    }

    // ══════════════════════════════════════════════════════════════
    // SYNC QUIZ RESULTS → DASHBOARD / RESULTS / STREAM / PROGRESS
    // ══════════════════════════════════════════════════════════════
    const PCT_COLORS = ['#a8a3ff', '#00d4aa', '#38bdf8', '#fcd34d', '#fb923c'];
    const ICON_BG = ['rgba(108,99,255,.12)', 'rgba(0,212,170,.1)', 'rgba(56,189,248,.1)', 'rgba(245,158,11,.1)', 'rgba(251,146,60,.1)'];

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
          '<div style="background:linear-gradient(135deg,rgba(108,99,255,.08),rgba(0,212,170,.04));border:1px dashed rgba(108,99,255,.35);border-radius:16px;padding:36px 28px;margin-bottom:28px;text-align:center;">' +
          '<div style="font-size:48px;margin-bottom:16px;">🧭</div>' +
          '<div style="font-size:18px;font-weight:800;margin-bottom:8px;">No quiz results yet</div>' +
          '<div style="font-size:14px;color:var(--muted);margin-bottom:24px;max-width:380px;margin-left:auto;margin-right:auto;line-height:1.6;">Answer 20 quick questions and our AI will match you to the careers that fit your interests, strengths, and learning style.</div>' +
          '<button class="btn btn-primary" onclick="cqStart()" style="font-size:15px;padding:13px 28px;">Start the Career Quiz — 5 mins →</button>' +
          '</div>';

        stats.innerHTML =
          '<div class="stat-card" style="opacity:.4;">' +
          '<div class="stat-val" style="color:var(--border);font-size:22px;">–</div>' +
          '<div class="stat-label">Top Career Match</div>' +
          '<div class="stat-change" style="color:var(--muted);">Take quiz to unlock</div>' +
          '</div>' +
          '<div class="stat-card" style="opacity:.4;">' +
          '<div class="stat-val" style="color:var(--border);font-size:22px;">–</div>' +
          '<div class="stat-label">Recommended Stream</div>' +
          '<div class="stat-change" style="color:var(--muted);">Take quiz to unlock</div>' +
          '</div>' +
          '<div class="stat-card" style="opacity:.4;">' +
          '<div class="stat-val" style="color:var(--border);font-size:22px;">0</div>' +
          '<div class="stat-label">Quiz Sessions Done</div>' +
          '<div class="stat-change" style="color:var(--muted);">Complete your first quiz</div>' +
          '</div>' +
          '<div class="stat-card" style="opacity:.4;">' +
          '<div class="stat-val" style="color:var(--border);font-size:22px;">–</div>' +
          '<div class="stat-label">Careers Evaluated</div>' +
          '<div class="stat-change" style="color:var(--muted);">Unlocks after quiz</div>' +
          '</div>';
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
        '<h2>Top match: ' + top.emoji + ' ' + top.title + ' <span style="color:var(--accent2);">' + top.match_pct + '%</span></h2>' +
        '<p>' + d.personality_type + ' · Recommending <strong>' + d.stream_recommendation + '</strong> for Class 11</p>' +
        '</div>' +
        '<button class="btn btn-primary" onclick="navTo(\'results\',document.querySelectorAll(\'.nav-item\')[1])">See All Matches →</button>' +
        '</div>';

      // Career strip
      bannerHtml += '<div style="font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">Top Career Matches</div>';
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
        '<div class="stat-card">' +
        '<div class="stat-val" style="color:' + PCT_COLORS[0] + ';">' + top.match_pct + '%</div>' +
        '<div class="stat-label">Top Career Match</div>' +
        '<div class="stat-change" style="color:var(--accent2);">' + top.emoji + ' ' + top.title + '</div>' +
        '</div>' +
        '<div class="stat-card">' +
        '<div class="stat-val" style="color:var(--accent2);font-size:20px;letter-spacing:-1px;">' + d.stream_recommendation + '</div>' +
        '<div class="stat-label">Recommended Stream</div>' +
        '<div class="stat-change" style="color:var(--muted);">' + d.stream_reason.slice(0, 52) + '…</div>' +
        '</div>' +
        '<div class="stat-card">' +
        '<div class="stat-val" style="color:#38bdf8;">' + d.top_careers.length + '</div>' +
        '<div class="stat-label">Careers Matched</div>' +
        '<div class="stat-change" style="color:var(--muted);">From your quiz answers</div>' +
        '</div>' +
        '<div class="stat-card">' +
        '<div class="stat-val" style="color:#fcd34d;">20</div>' +
        '<div class="stat-label">Questions Answered</div>' +
        '<div class="stat-change" style="color:var(--muted);">Quiz complete ✓</div>' +
        '</div>';
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
          '<div class="pct-mini-bar"><div class="pct-mini-fill" style="width:' + c.match_pct + '%;background:' + color + ';"></div></div>' +
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
      const rows = document.querySelectorAll('#progress .card div[style]');
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

    // Settings API key save/load
    function saveApiKey() {
      const val = document.getElementById('settings-api-key').value.trim();
      if (val) { localStorage.setItem('openai_key', val); alert('API key saved! Your next quiz will use GPT-4o.'); }
      else { localStorage.removeItem('openai_key'); alert('API key cleared.'); }
    }
    function loadSavedKey() {
      const k = localStorage.getItem('openai_key');
      const el = document.getElementById('settings-api-key');
      if (el && k) el.value = k;
    }
