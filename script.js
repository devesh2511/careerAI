    // ══════════════════════════════════════════════════════════════
    // ROUTER + SHARED STATE
    // Every screen lives in its own .html file and loads this one
    // script. State that used to sit in memory is persisted to
    // sessionStorage so it survives a real page navigation.
    // ══════════════════════════════════════════════════════════════
    const ROUTES = {
      landing: 'index.html',
      auth: 'AUTH.html',
      onboarding: 'ONBOARDING.html',
      evaluation: 'EVALUATION.html',
      quiz: 'QUIZ.html',
      quizcomplete: 'QUIZ_COMPLETE.html',
      app: 'APP.html',
      careerquiz: 'CAREER_QUIZ.html',
      ailoading: 'AI_LOADING.html',
      airesults: 'CAREER_RESULTS.html'
    };

    // These are .page divs inside APP.html — they still switch in place.
    const APP_PAGES = ['dashboard', 'results', 'explorer', 'careerdetail', 'stream', 'roadmap', 'chat', 'progress', 'settings'];

    // Which file are we on? Set via <body data-page="...">
    const CURRENT_PAGE = (document.body && document.body.dataset.page) || 'landing';
    let currentApp = CURRENT_PAGE;

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
        location.href = ROUTES.app + '#/' + id;
        return;
      }
      const file = ROUTES[id];
      if (file) location.href = file;
    }

    function logout() {
      clearState();
      location.href = ROUTES.landing;
    }

    // ── Mobile sidebar drawer (phone breakpoint only) ──
    function toggleSidebar() { document.body.classList.toggle('nav-open'); }
    function closeSidebar() { document.body.classList.remove('nav-open'); }

    // ── App nav (only meaningful on APP.html) ──
    function navTo(pageId, btn) {
      if (CURRENT_PAGE !== 'app') { location.href = ROUTES.app + '#/' + pageId; return; }
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
    // reset finish btn (called from the per-page init on ONBOARDING.html)
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
      if (!opts) return; // not on QUIZ.html
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

    // (renderQ() is called by the per-page init for QUIZ.html — calling it
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
    // and hands off to CAREER_QUIZ.html, which renders Q1 on load.
    function cqStart() {
      cqIdx = 0; cqAnswers = [];
      saveState({ cqIdx: 0, cqAnswers: [], appResults: null, isDemo: true });
      show('careerquiz');
    }

    // Entry point for CAREER_QUIZ.html — restore progress and draw the question
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
      // Last question → hand off to AI_LOADING.html, which runs the analysis
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

    // Entry point for AI_LOADING.html — answers arrive via sessionStorage
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
      // Persist, then hand off to CAREER_RESULTS.html to render
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

      const P = {
        // ── 5 PURE PROFILES ────────────────────────────────────────────────────────
        A: {
          personality_type: "The Analytical Explorer",
          personality_desc: "You're driven by logic and love understanding the 'why' behind everything. Science, data, and systems fascinate you — and you ask questions others don't think to ask.",
          stream_recommendation: "PCM+CS", stream_reason: "Your analytical strengths and scientific curiosity make PCM with Computer Science the natural launchpad for research, engineering, and tech careers.",
          top_careers: [
            { rank: 1, title: "Software Engineer", emoji: "💻", field: "Technology", match_pct: 91, why: "Logical problem-solving and systematic thinking are the core of software development — your natural mode.", stream: "PCM+CS", salary: "₹5–9 LPA starting" },
            { rank: 2, title: "Data Scientist", emoji: "📊", field: "Analytics", match_pct: 85, why: "Finding patterns in data and building predictive models matches your deep curiosity about 'why things happen'.", stream: "PCM+CS", salary: "₹6–13 LPA starting" },
            { rank: 3, title: "Research Scientist", emoji: "🔬", field: "Science", match_pct: 78, why: "You love investigating, experimenting, and proving hypotheses — that is exactly what research scientists do every day.", stream: "PCM", salary: "₹4–8 LPA starting" },
            { rank: 4, title: "AI / ML Engineer", emoji: "🤖", field: "Technology", match_pct: 71, why: "Combining maths, logic, and curiosity about intelligence puts you on the frontier of AI development.", stream: "PCM+CS", salary: "₹8–18 LPA starting" },
            { rank: 5, title: "Cybersecurity Analyst", emoji: "🔐", field: "Technology", match_pct: 63, why: "Analytical thinkers who ask 'how could this break?' make excellent security professionals.", stream: "PCM+CS", salary: "₹5–11 LPA starting" },
          ]
        },
        B: {
          personality_type: "The Entrepreneurial Strategist",
          personality_desc: "You think in outcomes, value, and goals. You're naturally drawn to money, business models, and what makes things successful — and you want to be in charge.",
          stream_recommendation: "Commerce", stream_reason: "Your instinct for strategy, finance, and goal-setting makes Commerce the ideal path to CA, investment banking, and building your own business.",
          top_careers: [
            { rank: 1, title: "Chartered Accountant (CA)", emoji: "📑", field: "Finance", match_pct: 90, why: "CA demands precision, financial intelligence, and goal-driven work — all things you're naturally wired for.", stream: "Commerce", salary: "₹6–14 LPA starting" },
            { rank: 2, title: "Investment Banker", emoji: "💰", field: "Finance", match_pct: 83, why: "High-stakes financial deals, market strategy, and competitive environments are where you thrive.", stream: "Commerce", salary: "₹8–20 LPA starting" },
            { rank: 3, title: "Business Analyst", emoji: "📈", field: "Business", match_pct: 75, why: "Diagnosing why businesses succeed or fail and recommending solutions suits your strategic mindset.", stream: "Commerce", salary: "₹5–10 LPA starting" },
            { rank: 4, title: "Startup Founder / CEO", emoji: "🚀", field: "Entrepreneurship", match_pct: 68, why: "Your drive to create something successful from scratch is the entrepreneur's calling card.", stream: "Any", salary: "Depends on venture" },
            { rank: 5, title: "Management Consultant", emoji: "🗂️", field: "Consulting", match_pct: 61, why: "Solving complex business problems for top companies combines strategy and analysis perfectly.", stream: "Commerce / PCM+CS", salary: "₹8–18 LPA starting" },
          ]
        },
        C: {
          personality_type: "The People's Champion",
          personality_desc: "You're empathetic, socially aware, and fascinated by why people think and behave the way they do. You're happiest when you're understanding or helping someone.",
          stream_recommendation: "Arts", stream_reason: "Your curiosity about human behaviour and natural communication skills make Arts the gateway to psychology, law, counselling, and social impact careers.",
          top_careers: [
            { rank: 1, title: "Psychologist / Counsellor", emoji: "🧠", field: "Social Science", match_pct: 89, why: "Your deep curiosity about human behaviour and empathy are the exact foundations of psychology.", stream: "Arts / PCB", salary: "₹4–10 LPA starting" },
            { rank: 2, title: "Lawyer / Advocate", emoji: "⚖️", field: "Law", match_pct: 81, why: "Understanding people's motivations and arguing different perspectives is what courtrooms are built on.", stream: "Arts", salary: "₹4–15 LPA starting" },
            { rank: 3, title: "Journalist / Writer", emoji: "📰", field: "Media", match_pct: 73, why: "Your social curiosity and communication strength turn observation into powerful stories.", stream: "Arts", salary: "₹3–8 LPA starting" },
            { rank: 4, title: "NGO / Social Impact Leader", emoji: "🤝", field: "Social Impact", match_pct: 67, why: "Your desire to help people and understand societal problems drives meaningful change careers.", stream: "Arts", salary: "₹3–7 LPA" },
            { rank: 5, title: "Teacher / Academic", emoji: "📚", field: "Education", match_pct: 59, why: "Sharing knowledge, understanding how students learn differently, and shaping minds suits you.", stream: "Arts / Any", salary: "₹3–8 LPA starting" },
          ]
        },
        D: {
          personality_type: "The Hands-On Inventor",
          personality_desc: "You're practical, inventive, and learn best by doing. You love taking things apart to understand them, then putting something better back together.",
          stream_recommendation: "PCM", stream_reason: "Your drive to build and fix things makes PCM the ideal foundation for engineering, manufacturing, and technical design careers.",
          top_careers: [
            { rank: 1, title: "Mechanical Engineer", emoji: "⚙️", field: "Engineering", match_pct: 92, why: "You understand machines intuitively — and mechanical engineering lets you design, build, and improve them.", stream: "PCM", salary: "₹4–8 LPA starting" },
            { rank: 2, title: "Architect", emoji: "🏛️", field: "Design + Engineering", match_pct: 84, why: "Designing structures that stand, function, and inspire combines your practical and creative sides.", stream: "PCM", salary: "₹4–10 LPA starting" },
            { rank: 3, title: "Civil Engineer", emoji: "🌉", field: "Engineering", match_pct: 76, why: "Building bridges, roads, and buildings that hold the world together is hands-on problem solving at scale.", stream: "PCM", salary: "₹4–8 LPA starting" },
            { rank: 4, title: "Electrical Engineer", emoji: "⚡", field: "Engineering", match_pct: 68, why: "Understanding circuits and systems, then making them work, plays directly to your tinkering instincts.", stream: "PCM", salary: "₹4–8 LPA starting" },
            { rank: 5, title: "Industrial / Manufacturing Engineer", emoji: "🏭", field: "Engineering", match_pct: 61, why: "Optimising how things are made, assembled, and delivered suits your efficiency-focused mindset.", stream: "PCM", salary: "₹4–7 LPA starting" },
          ]
        },
        E: {
          personality_type: "The Creative Performer",
          personality_desc: "You're expressive, energetic, and most alive when you're creating or performing. Visual storytelling, music, sport, and design feel like your natural language.",
          stream_recommendation: "Arts", stream_reason: "Your creative and expressive instincts are best nurtured through Arts, which opens doors to design, media, entertainment, and performing arts careers.",
          top_careers: [
            { rank: 1, title: "UX / Graphic Designer", emoji: "🎨", field: "Design", match_pct: 92, why: "Visual thinking and design problem-solving are at the core of what excites you — this is your arena.", stream: "Arts / PCM+CS", salary: "₹4–10 LPA starting" },
            { rank: 2, title: "Film / Video Director", emoji: "🎬", field: "Media", match_pct: 85, why: "Storytelling, visual language, and performance direction combine everything you're naturally drawn to.", stream: "Arts", salary: "₹4–12 LPA starting" },
            { rank: 3, title: "Musician / Music Producer", emoji: "🎵", field: "Arts", match_pct: 77, why: "Your creative energy and love for performance can build a real career in music and production.", stream: "Arts", salary: "₹3–15 LPA" },
            { rank: 4, title: "Animator / VFX Artist", emoji: "🎮", field: "Design + Tech", match_pct: 70, why: "Bringing images to life through animation is a growing field that rewards your visual creativity.", stream: "Arts / PCM+CS", salary: "₹4–11 LPA starting" },
            { rank: 5, title: "Sports Athlete / Coach", emoji: "⚽", field: "Sports", match_pct: 62, why: "Physical performance and competitive drive are real careers in India's growing sports industry.", stream: "Any", salary: "₹3–10 LPA" },
          ]
        },

        // ── 10 ORDERED 2-LETTER: ALPHABETICALLY FIRST IS DOMINANT ──────────────────
        AB: {
          personality_type: "The Quantitative Strategist",
          personality_desc: "You combine sharp analytical thinking with a business-first mindset. You don't just understand data — you see how it translates into money, strategy, and competitive advantage.",
          stream_recommendation: "PCM+CS or Commerce", stream_reason: "Your blend of analytics and business instinct gives you two great paths: the quantitative finance route via PCM+CS, or the strategic finance route via Commerce.",
          top_careers: [
            { rank: 1, title: "Quantitative Analyst (Quant)", emoji: "📐", field: "Finance + Tech", match_pct: 93, why: "Quants use maths and programming to make high-stakes financial decisions — the perfect blend of your A and B strengths.", stream: "PCM+CS", salary: "₹10–25 LPA starting" },
            { rank: 2, title: "Data Analyst / BI Analyst", emoji: "📊", field: "Analytics + Business", match_pct: 86, why: "Turning raw numbers into business insights bridges your analytical and entrepreneurial sides.", stream: "PCM+CS / Commerce", salary: "₹5–12 LPA starting" },
            { rank: 3, title: "Actuarial Scientist", emoji: "🧮", field: "Finance + Maths", match_pct: 79, why: "Using statistics to calculate financial risk — one of India's highest-paid graduate careers.", stream: "PCM+CS / Commerce", salary: "₹6–15 LPA starting" },
            { rank: 4, title: "Management Consultant", emoji: "🗂️", field: "Consulting", match_pct: 71, why: "Combining data-driven analysis with business strategy is the core of top-tier consulting.", stream: "Any", salary: "₹8–20 LPA starting" },
            { rank: 5, title: "Product Manager (Tech)", emoji: "📱", field: "Technology + Business", match_pct: 64, why: "Product managers live at the intersection of data, business logic, and user needs.", stream: "PCM+CS", salary: "₹8–18 LPA starting" },
          ]
        },
        AC: {
          personality_type: "The Behavioural Scientist",
          personality_desc: "You're fascinated by both how systems work and why people behave the way they do. You see humans as the most interesting and complex system of all.",
          stream_recommendation: "PCM+CS or Arts (Psychology)", stream_reason: "Your unique blend of analytical curiosity and people-interest opens doors in UX research, behavioural economics, and clinical psychology.",
          top_careers: [
            { rank: 1, title: "UX Researcher", emoji: "🔍", field: "Tech + Psychology", match_pct: 92, why: "Understanding how people think, then testing whether products match those mental models, is the perfect crossover.", stream: "PCM+CS / Arts", salary: "₹5–12 LPA starting" },
            { rank: 2, title: "Behavioural Economist", emoji: "🧩", field: "Economics + Psychology", match_pct: 85, why: "Studying why people make irrational financial decisions uses both your scientific and social curiosity.", stream: "Arts / Commerce", salary: "₹6–14 LPA starting" },
            { rank: 3, title: "Clinical / Research Psychologist", emoji: "🧠", field: "Psychology", match_pct: 77, why: "Your scientific approach to understanding people is precisely what evidence-based psychology needs.", stream: "PCB / Arts", salary: "₹4–10 LPA starting" },
            { rank: 4, title: "Market Research Analyst", emoji: "📋", field: "Business + Social Science", match_pct: 70, why: "Analysing consumer psychology and translating it into market data suits your dual strengths.", stream: "Commerce / Arts", salary: "₹4–9 LPA starting" },
            { rank: 5, title: "Data Analyst for Social Impact", emoji: "📊", field: "Analytics + Social", match_pct: 62, why: "Using data to understand and improve society combines your science and people interests beautifully.", stream: "PCM+CS", salary: "₹4–8 LPA starting" },
          ]
        },
        AD: {
          personality_type: "The Technical Inventor",
          personality_desc: "You think in systems and love building them. You're the rare type who can understand the deep theory behind something and also make it work with your hands.",
          stream_recommendation: "PCM+CS", stream_reason: "Your combination of analytical rigour and hands-on drive makes advanced engineering — robotics, aerospace, electronics — the ideal destination.",
          top_careers: [
            { rank: 1, title: "Robotics Engineer", emoji: "🤖", field: "Engineering + CS", match_pct: 93, why: "Designing machines that think and move requires exactly your mix of systems-thinking and hands-on building.", stream: "PCM+CS", salary: "₹6–15 LPA starting" },
            { rank: 2, title: "Electronics / Embedded Engineer", emoji: "⚡", field: "Engineering", match_pct: 86, why: "Programming chips and building circuits bridges your analytical and maker instincts perfectly.", stream: "PCM+CS", salary: "₹5–12 LPA starting" },
            { rank: 3, title: "Aerospace Engineer", emoji: "✈️", field: "Engineering", match_pct: 79, why: "Designing aircraft and spacecraft demands both mathematical rigour and hands-on precision.", stream: "PCM", salary: "₹5–12 LPA starting" },
            { rank: 4, title: "Computer Hardware Engineer", emoji: "🖥️", field: "Engineering + CS", match_pct: 72, why: "Designing the physical chips and components that run the world blends your two strongest areas.", stream: "PCM+CS", salary: "₹5–11 LPA starting" },
            { rank: 5, title: "Mechatronics Engineer", emoji: "🦾", field: "Engineering", match_pct: 64, why: "Mechatronics — mechanical + electronics + software — is a field built for multi-disciplinary thinkers like you.", stream: "PCM+CS", salary: "₹5–10 LPA starting" },
          ]
        },
        AE: {
          personality_type: "The Digital Creative",
          personality_desc: "You're analytically strong but creatively restless. You want to build things that are not just functional but beautiful — and you have the technical ability to actually do it.",
          stream_recommendation: "PCM+CS", stream_reason: "PCM with CS gives you the technical foundation for creative tech careers like game development, creative coding, and interactive design.",
          top_careers: [
            { rank: 1, title: "Game Developer", emoji: "🎮", field: "Tech + Design", match_pct: 93, why: "Game development demands code, maths, design, and storytelling — the exact combination you bring.", stream: "PCM+CS", salary: "₹5–14 LPA starting" },
            { rank: 2, title: "Creative Technologist", emoji: "🌐", field: "Tech + Arts", match_pct: 86, why: "Creative technologists use code as an artistic medium — AR, interactive installations, generative art.", stream: "PCM+CS", salary: "₹6–15 LPA starting" },
            { rank: 3, title: "Motion Designer / VFX Artist", emoji: "🎬", field: "Design + Tech", match_pct: 78, why: "Combining programming with visual storytelling lets you create experiences that wow audiences.", stream: "PCM+CS / Arts", salary: "₹4–12 LPA starting" },
            { rank: 4, title: "UI / Frontend Developer", emoji: "🖥️", field: "Tech + Design", match_pct: 71, why: "You care that software looks beautiful as much as that it works — frontend engineering rewards that.", stream: "PCM+CS", salary: "₹5–12 LPA starting" },
            { rank: 5, title: "Data Visualisation Designer", emoji: "📊", field: "Analytics + Design", match_pct: 63, why: "Turning complex data into visual stories combines your analytical and creative strengths brilliantly.", stream: "PCM+CS", salary: "₹5–11 LPA starting" },
          ]
        },
        BC: {
          personality_type: "The Empathetic Leader",
          personality_desc: "You have a rare combination: business ambition paired with genuine care for people. You want to succeed, but you also want that success to mean something to others.",
          stream_recommendation: "Commerce", stream_reason: "Commerce gives you the business and management foundation, while your people strengths will set you apart in HR, consulting, and leadership roles.",
          top_careers: [
            { rank: 1, title: "HR Director / People Operations", emoji: "👥", field: "Business + People", match_pct: 91, why: "Leading an organisation's most important asset — its people — requires both business sense and deep empathy.", stream: "Commerce / Arts", salary: "₹6–16 LPA starting" },
            { rank: 2, title: "Social Entrepreneur", emoji: "🌱", field: "Entrepreneurship + Social", match_pct: 84, why: "Building a business that also solves a real human problem is exactly the intersection of your two strengths.", stream: "Commerce / Arts", salary: "Varies widely" },
            { rank: 3, title: "Management Consultant", emoji: "🗂️", field: "Consulting", match_pct: 76, why: "Consultants advise organisations on strategy and people — blending your business and social intelligence.", stream: "Commerce", salary: "₹8–20 LPA starting" },
            { rank: 4, title: "Corporate Communications / PR", emoji: "📢", field: "Business + Media", match_pct: 69, why: "Managing how an organisation talks to the world requires business thinking + human understanding.", stream: "Commerce / Arts", salary: "₹4–10 LPA starting" },
            { rank: 5, title: "Nonprofit / NGO Manager", emoji: "🤝", field: "Social + Business", match_pct: 61, why: "Running a mission-driven organisation requires the business skills of a CEO and the heart of an activist.", stream: "Commerce / Arts", salary: "₹4–10 LPA" },
          ]
        },
        BD: {
          personality_type: "The Operations Architect",
          personality_desc: "You're goal-driven and love making complex systems run smoothly. Where others see chaos, you see an inefficiency waiting to be solved — with a plan and a build.",
          stream_recommendation: "PCM or Commerce", stream_reason: "Your blend of building instinct and business goal-orientation suits both engineering management (via PCM) and supply chain/operations (via Commerce).",
          top_careers: [
            { rank: 1, title: "Project Manager (Tech / Infra)", emoji: "📋", field: "Engineering + Business", match_pct: 91, why: "Coordinating people, timelines, and resources to build something real is exactly your combination of strengths.", stream: "PCM / Commerce", salary: "₹6–15 LPA starting" },
            { rank: 2, title: "Supply Chain Manager", emoji: "🏭", field: "Operations + Business", match_pct: 83, why: "Designing the physical flow of goods from factory to customer requires builder logic and business sense.", stream: "Commerce / PCM", salary: "₹5–12 LPA starting" },
            { rank: 3, title: "Industrial / Production Engineer", emoji: "⚙️", field: "Engineering + Operations", match_pct: 76, why: "Optimising factories and manufacturing lines combines your hands-on and goal-oriented strengths.", stream: "PCM", salary: "₹4–9 LPA starting" },
            { rank: 4, title: "Entrepreneur (Product Company)", emoji: "🚀", field: "Entrepreneurship", match_pct: 68, why: "Building your own company that makes a physical product is the ultimate BD career.", stream: "Any", salary: "Depends on venture" },
            { rank: 5, title: "Construction / Infrastructure Manager", emoji: "🌉", field: "Engineering + Management", match_pct: 60, why: "Managing large construction projects demands both technical understanding and business discipline.", stream: "PCM", salary: "₹5–12 LPA starting" },
          ]
        },
        BE: {
          personality_type: "The Creative Entrepreneur",
          personality_desc: "You have both the business instinct to spot opportunities and the creative energy to make them look and feel irresistible. You think in brands, campaigns, and experiences.",
          stream_recommendation: "Commerce", stream_reason: "Commerce gives you the business and marketing foundation. Add design thinking on top, and you have the profile of a brand builder or creative director.",
          top_careers: [
            { rank: 1, title: "Brand Manager", emoji: "🏷️", field: "Business + Design", match_pct: 92, why: "Building a brand's identity and market positioning requires both business strategy and creative vision.", stream: "Commerce", salary: "₹5–14 LPA starting" },
            { rank: 2, title: "Digital Marketing Manager", emoji: "📲", field: "Business + Media", match_pct: 85, why: "Growing brands through creative campaigns and data-driven channels is your natural blend.", stream: "Commerce", salary: "₹4–12 LPA starting" },
            { rank: 3, title: "Creative Director", emoji: "🎨", field: "Design + Business", match_pct: 77, why: "Leading creative teams and connecting their work to business goals is a senior role built for your profile.", stream: "Arts / Commerce", salary: "₹8–22 LPA starting" },
            { rank: 4, title: "Event Manager / Experiential Marketer", emoji: "🎪", field: "Business + Events", match_pct: 70, why: "Creating memorable live experiences for brands combines logistics, creativity, and business sense.", stream: "Commerce / Arts", salary: "₹3–9 LPA starting" },
            { rank: 5, title: "Fashion / Lifestyle Entrepreneur", emoji: "👗", field: "Business + Creative", match_pct: 62, why: "Building a fashion or lifestyle brand requires exactly your mix of creative taste and business hustle.", stream: "Commerce / Arts", salary: "Varies widely" },
          ]
        },
        CD: {
          personality_type: "The Human-Centred Designer",
          personality_desc: "You combine genuine care for people with a drive to build useful things. You don't just want to understand problems — you want to physically solve them for real people.",
          stream_recommendation: "PCM or Arts", stream_reason: "Your empathy-meets-making profile fits both UX / product design (PCM+CS route) and healthcare or occupational therapy (PCB / Arts route).",
          top_careers: [
            { rank: 1, title: "Product / UX Designer", emoji: "🎨", field: "Design + Technology", match_pct: 92, why: "Design that serves real human needs is the sweet spot of your people-understanding and building drive.", stream: "PCM+CS / Arts", salary: "₹5–13 LPA starting" },
            { rank: 2, title: "Architect", emoji: "🏛️", field: "Design + People", match_pct: 84, why: "Great architecture is human-centred — it shapes how people feel and move through space.", stream: "PCM", salary: "₹4–10 LPA starting" },
            { rank: 3, title: "Occupational / Physiotherapist", emoji: "🏥", field: "Healthcare + Hands-On", match_pct: 76, why: "Helping people regain function through physical intervention is deeply hands-on and deeply caring.", stream: "PCB", salary: "₹4–8 LPA starting" },
            { rank: 4, title: "Ergonomics / Accessibility Designer", emoji: "♿", field: "Design + Social", match_pct: 68, why: "Designing tools and spaces that work for everyone — including people with disabilities — is a fast-growing field.", stream: "PCM / Arts", salary: "₹4–10 LPA starting" },
            { rank: 5, title: "Special Education Teacher", emoji: "📚", field: "Education + Support", match_pct: 60, why: "Teaching students with different learning needs combines hands-on creativity with deep human care.", stream: "Arts / Any", salary: "₹3–7 LPA starting" },
          ]
        },
        CE: {
          personality_type: "The Expressive Storyteller",
          personality_desc: "You understand people deeply and have a gift for bringing their stories to life. Whether through words, visuals, or performance, you make people feel seen and heard.",
          stream_recommendation: "Arts", stream_reason: "Arts is the perfect stream for you — it fuels psychology, journalism, performing arts, and creative media careers where your empathy and expression both shine.",
          top_careers: [
            { rank: 1, title: "Journalist / Documentary Filmmaker", emoji: "📰", field: "Media + Social", match_pct: 93, why: "You tell true stories about real people in ways that create empathy and spark change.", stream: "Arts", salary: "₹4–12 LPA starting" },
            { rank: 2, title: "Therapist + Art / Music Therapist", emoji: "🎵", field: "Psychology + Arts", match_pct: 86, why: "Using creative expression as a healing tool is a powerful intersection of your people and creative strengths.", stream: "Arts / PCB", salary: "₹4–9 LPA starting" },
            { rank: 3, title: "Content Creator / YouTuber", emoji: "🎬", field: "Media + People", match_pct: 78, why: "Building an audience through relatable, emotionally resonant content is where your empathy becomes an asset.", stream: "Arts", salary: "₹3–20 LPA (varies)" },
            { rank: 4, title: "Social Media Strategist", emoji: "📲", field: "Media + Marketing", match_pct: 70, why: "Crafting content that connects with real people at scale leverages both your creative and social intelligence.", stream: "Arts / Commerce", salary: "₹4–10 LPA starting" },
            { rank: 5, title: "Theatre / Drama Artist / Actor", emoji: "🎭", field: "Performing Arts", match_pct: 62, why: "Embodying human experience on stage — and making audiences feel it — is your natural creative form.", stream: "Arts", salary: "₹3–12 LPA" },
          ]
        },
        DE: {
          personality_type: "The Artisan Innovator",
          personality_desc: "You build things, and you care deeply that they're beautiful. Function and form are equally important to you — you won't compromise on either.",
          stream_recommendation: "PCM or Arts", stream_reason: "Your hands-on drive meets creative vision best in architecture, industrial design, fashion, or animation — accessible via both PCM and Arts streams.",
          top_careers: [
            { rank: 1, title: "Industrial / Product Designer", emoji: "🔧", field: "Design + Engineering", match_pct: 93, why: "Every object people use was designed by someone who cared about both how it works and how it looks — that's you.", stream: "PCM / Arts", salary: "₹5–13 LPA starting" },
            { rank: 2, title: "Architect", emoji: "🏛️", field: "Design + Engineering", match_pct: 86, why: "Architecture is where beauty and structure meet — and where your making instinct finds its grandest canvas.", stream: "PCM", salary: "₹4–10 LPA starting" },
            { rank: 3, title: "Animator / 3D Artist", emoji: "🎮", field: "Design + Tech", match_pct: 78, why: "Bringing characters and worlds to life in 3D requires technical craft AND artistic sensitivity.", stream: "Arts / PCM+CS", salary: "₹4–12 LPA starting" },
            { rank: 4, title: "Fashion Designer", emoji: "👗", field: "Design + Fashion", match_pct: 70, why: "Designing garments is one of the most direct forms of artisan craftsmanship — you make wearable art.", stream: "Arts", salary: "₹3–12 LPA starting" },
            { rank: 5, title: "Automotive / Transportation Designer", emoji: "🚗", field: "Design + Engineering", match_pct: 62, why: "Designing cars and vehicles that are both technically excellent and visually stunning is a prestige creative field.", stream: "PCM / Arts", salary: "₹5–15 LPA starting" },
          ]
        },

        // ── 10 ORDERED 2-LETTER: SECOND LETTER IS DOMINANT (NEW) ───────────────────
        BA: {
          personality_type: "The Strategic Analyst",
          personality_desc: "Business outcomes drive you, but unlike most entrepreneurs, you let data and logic guide every major decision. You're the executive who actually reads the research.",
          stream_recommendation: "Commerce", stream_reason: "Commerce is your launchpad, but strong Maths and Statistics gives you the edge in data-driven strategy and financial analysis roles.",
          top_careers: [
            { rank: 1, title: "Investment Analyst", emoji: "📈", field: "Finance + Analytics", match_pct: 92, why: "Combining market strategy with rigorous financial modelling perfectly suits your B-dominant, A-secondary strengths.", stream: "Commerce", salary: "₹6–14 LPA starting" },
            { rank: 2, title: "Strategic Planning Manager", emoji: "🗺️", field: "Business + Strategy", match_pct: 85, why: "You can build a business strategy AND back it with data — a rare and highly valued corporate skill.", stream: "Commerce", salary: "₹7–16 LPA starting" },
            { rank: 3, title: "Financial Controller", emoji: "📑", field: "Finance", match_pct: 77, why: "Managing a company's numbers with both business judgement and analytical precision is your natural mode.", stream: "Commerce", salary: "₹8–18 LPA starting" },
            { rank: 4, title: "Business Intelligence Lead", emoji: "💡", field: "Analytics + Business", match_pct: 69, why: "Building dashboards and insights that drive business decisions bridges your dominant strengths.", stream: "Commerce / PCM+CS", salary: "₹7–15 LPA starting" },
            { rank: 5, title: "Economic / Policy Analyst", emoji: "🏛️", field: "Economics + Research", match_pct: 61, why: "Analysing economic trends to advise businesses or governments combines strategic and analytical thinking.", stream: "Commerce / Arts", salary: "₹5–12 LPA starting" },
          ]
        },
        CA: {
          personality_type: "The Empathetic Scientist",
          personality_desc: "You care deeply about people, but unlike most social thinkers, you want evidence-based answers. You use science to understand humans — and to help them better.",
          stream_recommendation: "Arts / PCB", stream_reason: "Your people-first mindset with scientific curiosity is best served through psychology, social research, or public health pathways.",
          top_careers: [
            { rank: 1, title: "Clinical Psychologist", emoji: "🧠", field: "Psychology + Science", match_pct: 90, why: "Applying scientific research methods to understand and treat human distress is your perfect intersection.", stream: "PCB / Arts", salary: "₹4–12 LPA starting" },
            { rank: 2, title: "Public Health Researcher", emoji: "🏥", field: "Health + Social Science", match_pct: 83, why: "Studying how diseases and social factors affect communities uses both your empathy and analytical mind.", stream: "PCB", salary: "₹5–11 LPA starting" },
            { rank: 3, title: "Occupational Therapist", emoji: "♿", field: "Healthcare + People", match_pct: 75, why: "Helping people rebuild their lives through scientific therapeutic methods combines your core strengths.", stream: "PCB / Arts", salary: "₹4–9 LPA starting" },
            { rank: 4, title: "Social Epidemiologist", emoji: "🔬", field: "Science + Social", match_pct: 67, why: "Investigating why certain groups of people get sick or fall behind uses science in service of social equity.", stream: "PCB", salary: "₹5–12 LPA starting" },
            { rank: 5, title: "Counselling Researcher", emoji: "📋", field: "Psychology + Research", match_pct: 59, why: "You want to improve how people are helped — not just by doing it, but by studying and making the field better.", stream: "Arts / PCB", salary: "₹4–9 LPA starting" },
          ]
        },
        CB: {
          personality_type: "The Social Business Builder",
          personality_desc: "You put people before profit, but you understand that lasting impact requires viable business models. You want to build organisations that genuinely help communities.",
          stream_recommendation: "Commerce / Arts", stream_reason: "Commerce gives you the business tools; your people-first instinct will make you the most effective and ethical leader in the room.",
          top_careers: [
            { rank: 1, title: "Social Enterprise Founder", emoji: "🌱", field: "Social Impact + Business", match_pct: 91, why: "Building an organisation that solves human problems while remaining financially sustainable is your calling.", stream: "Commerce / Arts", salary: "Varies widely" },
            { rank: 2, title: "NGO Program Director", emoji: "🤝", field: "Social Impact", match_pct: 84, why: "Designing and managing programmes that change lives requires both people skills and organisational thinking.", stream: "Arts / Commerce", salary: "₹5–12 LPA starting" },
            { rank: 3, title: "Corporate Social Responsibility Head", emoji: "🌍", field: "Business + Social", match_pct: 76, why: "Bridging corporate goals with community impact is exactly where your business and people strengths converge.", stream: "Commerce", salary: "₹8–18 LPA starting" },
            { rank: 4, title: "Community Development Manager", emoji: "🏘️", field: "Social + Operations", match_pct: 68, why: "Planning and running community programmes that make a measurable difference suits your profile deeply.", stream: "Arts / Commerce", salary: "₹4–9 LPA starting" },
            { rank: 5, title: "Healthcare Administrator", emoji: "🏥", field: "Healthcare + Business", match_pct: 60, why: "Running hospitals and clinics efficiently while keeping patients at the centre requires your exact blend.", stream: "Commerce / PCB", salary: "₹6–14 LPA starting" },
          ]
        },
        DA: {
          personality_type: "The Methodical Maker",
          personality_desc: "You build things with unusual precision. Where most makers go by feel, you apply systematic thinking to engineer solutions that don't just work — they work reliably and elegantly.",
          stream_recommendation: "PCM", stream_reason: "Your hands-on instinct backed by analytical rigour makes precision engineering — structures, systems, quality assurance — your natural domain.",
          top_careers: [
            { rank: 1, title: "Structural Engineer", emoji: "🏗️", field: "Engineering", match_pct: 93, why: "Calculating loads, stresses, and structural integrity requires both deep analytical ability and a builder's eye.", stream: "PCM", salary: "₹4–10 LPA starting" },
            { rank: 2, title: "Systems Engineer", emoji: "⚙️", field: "Engineering + Design", match_pct: 86, why: "Designing how complex systems fit together is exactly your blend of making and analytical thinking.", stream: "PCM+CS", salary: "₹5–12 LPA starting" },
            { rank: 3, title: "Quality Assurance Engineer", emoji: "🔎", field: "Engineering + Analytics", match_pct: 78, why: "Ensuring products are built to exact specifications uses your analytical mind to serve your maker's pride.", stream: "PCM", salary: "₹4–9 LPA starting" },
            { rank: 4, title: "Naval Architect", emoji: "⚓", field: "Engineering", match_pct: 70, why: "Designing ships and offshore structures requires rare mathematical and engineering precision — your exact domain.", stream: "PCM", salary: "₹5–12 LPA starting" },
            { rank: 5, title: "Process / Chemical Engineer", emoji: "🧪", field: "Engineering + Science", match_pct: 62, why: "Optimising manufacturing processes through scientific analysis combines your core strengths precisely.", stream: "PCM", salary: "₹4–9 LPA starting" },
          ]
        },
        DB: {
          personality_type: "The Commercial Builder",
          personality_desc: "You can build things AND sell them — a rare and powerful combination. You understand materials, machines, and methods, but also the market, the margins, and the customer.",
          stream_recommendation: "PCM or Commerce", stream_reason: "PCM gives you the technical depth; Commerce gives you the commercial edge. The combination opens high-value engineering business careers.",
          top_careers: [
            { rank: 1, title: "Engineering Entrepreneur", emoji: "🚀", field: "Engineering + Business", match_pct: 92, why: "Starting a company that builds a technical product is the ultimate expression of your maker-and-strategist strengths.", stream: "PCM / Commerce", salary: "Varies widely" },
            { rank: 2, title: "Technical Sales Director", emoji: "🤝", field: "Sales + Engineering", match_pct: 84, why: "Selling complex technical products requires you to understand what you're selling AND how to close deals.", stream: "PCM / Commerce", salary: "₹8–20 LPA starting" },
            { rank: 3, title: "Construction Project Manager", emoji: "🏗️", field: "Engineering + Management", match_pct: 76, why: "Overseeing large builds — on budget, on spec, on time — requires both technical mastery and business discipline.", stream: "PCM / Commerce", salary: "₹5–14 LPA starting" },
            { rank: 4, title: "Hardware Startup Founder", emoji: "🔧", field: "Tech + Business", match_pct: 68, why: "Building a physical tech product from scratch and taking it to market is the DB career path.", stream: "PCM+CS", salary: "Varies widely" },
            { rank: 5, title: "Manufacturing Operations Head", emoji: "🏭", field: "Operations + Engineering", match_pct: 60, why: "Running a factory floor with both engineering expertise and P&L accountability is a senior role you're built for.", stream: "PCM", salary: "₹10–25 LPA starting" },
          ]
        },
        DC: {
          personality_type: "The Caring Engineer",
          personality_desc: "You build things for people, and you genuinely care how those things affect them. Your technical skills are not an end in themselves — they serve human wellbeing.",
          stream_recommendation: "PCB / PCM", stream_reason: "Your combination of hands-on technical skill and care for people is perfectly suited to biomedical, rehabilitative, and healthcare engineering.",
          top_careers: [
            { rank: 1, title: "Biomedical Engineer", emoji: "🏥", field: "Engineering + Healthcare", match_pct: 91, why: "Designing medical devices, prosthetics, and diagnostic tools is engineering in service of people — the DC career.", stream: "PCB / PCM", salary: "₹4–10 LPA starting" },
            { rank: 2, title: "Prosthetics / Orthotics Designer", emoji: "🦾", field: "Design + Healthcare", match_pct: 84, why: "Crafting physical devices that restore human function is deeply technical AND deeply human.", stream: "PCB / PCM", salary: "₹4–9 LPA starting" },
            { rank: 3, title: "Rehabilitation Technology Developer", emoji: "♿", field: "Tech + Social", match_pct: 76, why: "Building assistive technology that restores independence to disabled people sits at the heart of DC strengths.", stream: "PCM+CS / PCB", salary: "₹5–12 LPA starting" },
            { rank: 4, title: "Healthcare Facilities Engineer", emoji: "🏗️", field: "Engineering + Healthcare", match_pct: 68, why: "Designing and maintaining the physical infrastructure of hospitals requires engineering skill and patient-first thinking.", stream: "PCM", salary: "₹5–11 LPA starting" },
            { rank: 5, title: "Assistive Technology Engineer", emoji: "🔧", field: "Tech + Accessibility", match_pct: 60, why: "Building tools that enable people with disabilities to live and work fully is a growing and meaningful technical field.", stream: "PCM+CS", salary: "₹5–12 LPA starting" },
          ]
        },
        EA: {
          personality_type: "The Artistic Scientist",
          personality_desc: "You experience the world through art and beauty, but you're also fascinated by how and why things work. You can be both precise and expressive — a rare creative profile.",
          stream_recommendation: "PCM+CS / Arts", stream_reason: "Your blend of creative expression and analytical curiosity opens the emerging field of creative technology, where code, data, and art converge.",
          top_careers: [
            { rank: 1, title: "Data Visualisation Designer", emoji: "📊", field: "Design + Analytics", match_pct: 92, why: "Turning raw numbers into visual narratives that are beautiful AND accurate is where your E and A strengths meet.", stream: "PCM+CS / Arts", salary: "₹5–12 LPA starting" },
            { rank: 2, title: "Generative / Computational Artist", emoji: "🖥️", field: "Art + Tech", match_pct: 85, why: "Using code as an artistic medium — generative art, algorithmic design — sits at your exact creative-technical crossover.", stream: "PCM+CS / Arts", salary: "₹5–14 LPA starting" },
            { rank: 3, title: "Scientific Illustrator", emoji: "🔬", field: "Art + Science", match_pct: 77, why: "Creating visuals for science publications and nature documentaries merges precision and artistry perfectly.", stream: "PCM+CS / Arts", salary: "₹4–10 LPA starting" },
            { rank: 4, title: "VFX Technical Director", emoji: "🎬", field: "Film + Tech", match_pct: 69, why: "Building the technical systems behind visual effects requires both programming logic and visual artistry.", stream: "PCM+CS / Arts", salary: "₹6–16 LPA starting" },
            { rank: 5, title: "Computational Photographer", emoji: "📷", field: "Photography + CS", match_pct: 61, why: "Designing camera algorithms and software-driven photography tools is a growing field for analytical creatives.", stream: "PCM+CS", salary: "₹6–14 LPA starting" },
          ]
        },
        EB: {
          personality_type: "The Performance Entrepreneur",
          personality_desc: "Your creative energy drives you, but you also have the business instinct to monetise it. You want to build a career AND a creative legacy — and you have the drive to do both.",
          stream_recommendation: "Arts / Commerce", stream_reason: "Combining an Arts foundation with commerce awareness gives you the full toolkit for building creative businesses — agencies, labels, and brands.",
          top_careers: [
            { rank: 1, title: "Entertainment Entrepreneur", emoji: "🎬", field: "Business + Entertainment", match_pct: 91, why: "Building a business in music, film, or content production requires creative vision AND commercial drive — both are yours.", stream: "Commerce / Arts", salary: "Varies widely" },
            { rank: 2, title: "Creative Agency Founder", emoji: "🎨", field: "Business + Design", match_pct: 84, why: "Running an agency that creates great work for clients is the E-dominant, B-secondary career perfectly.", stream: "Commerce / Arts", salary: "₹6–20 LPA starting" },
            { rank: 3, title: "Music Producer / Label Owner", emoji: "🎵", field: "Music + Business", match_pct: 76, why: "Producing music AND building the business that takes it to market is the ultimate EB creative career.", stream: "Arts", salary: "₹4–25 LPA (varies)" },
            { rank: 4, title: "Fashion Brand Creator", emoji: "👗", field: "Fashion + Business", match_pct: 68, why: "Building a clothing brand from scratch — creative direction, sourcing, retail strategy — is your natural domain.", stream: "Arts / Commerce", salary: "₹4–15 LPA" },
            { rank: 5, title: "Influencer / Content Brand Owner", emoji: "📲", field: "Media + Business", match_pct: 60, why: "Growing an audience around your creative work AND monetising it commercially is the modern EB career path.", stream: "Arts / Commerce", salary: "₹3–20 LPA (varies)" },
          ]
        },
        EC: {
          personality_type: "The Expressive Advocate",
          personality_desc: "Your creativity is powered by empathy. You use art, storytelling, and performance to amplify human experiences that others overlook — and you feel responsible for doing it.",
          stream_recommendation: "Arts", stream_reason: "Arts gives you the expressive tools and human-centred frameworks to build a career in social storytelling, therapeutic arts, and community advocacy.",
          top_careers: [
            { rank: 1, title: "Documentary Filmmaker", emoji: "🎬", field: "Film + Social Impact", match_pct: 92, why: "Telling true stories of real people with visual artistry and empathy is your precise creative-social combination.", stream: "Arts", salary: "₹4–14 LPA starting" },
            { rank: 2, title: "Art Therapist", emoji: "🎨", field: "Arts + Psychology", match_pct: 85, why: "Using creative expression as a therapeutic tool is one of the most powerful intersections of your E and C strengths.", stream: "Arts / PCB", salary: "₹4–9 LPA starting" },
            { rank: 3, title: "Children's Author / Illustrator", emoji: "📚", field: "Arts + Education", match_pct: 77, why: "Creating books that help children understand the world requires your empathy and creative talent together.", stream: "Arts", salary: "₹4–12 LPA starting" },
            { rank: 4, title: "Social Impact Storyteller", emoji: "📰", field: "Media + Social", match_pct: 69, why: "Creating content that drives social change is a career built on EC strengths.", stream: "Arts", salary: "₹4–10 LPA starting" },
            { rank: 5, title: "Community Theatre Director", emoji: "🎭", field: "Arts + Community", match_pct: 61, why: "Using drama and performance to bring communities together is a deeply EC career.", stream: "Arts", salary: "₹3–8 LPA starting" },
          ]
        },
        ED: {
          personality_type: "The Structural Artist",
          personality_desc: "You make beautiful things, and you care deeply that they're built to last. Form and function are equally non-negotiable for you — you refuse to compromise the craft.",
          stream_recommendation: "Arts / PCM", stream_reason: "Your creative vision combined with a maker's instinct lands perfectly in industrial design, furniture, sculpture, and set design.",
          top_careers: [
            { rank: 1, title: "Furniture / Industrial Designer", emoji: "🔧", field: "Design + Craft", match_pct: 92, why: "Designing objects that are both beautiful and structurally sound is the purest expression of ED strengths.", stream: "PCM / Arts", salary: "₹5–13 LPA starting" },
            { rank: 2, title: "Architectural Model Maker", emoji: "🏛️", field: "Architecture + Craft", match_pct: 84, why: "Hand-crafting precise scale models bridges your creative and technical making skills perfectly.", stream: "PCM / Arts", salary: "₹4–9 LPA starting" },
            { rank: 3, title: "Ceramics / Craft Artist", emoji: "🏺", field: "Arts + Craft", match_pct: 76, why: "Working with clay and other materials to create functional art objects is a deeply hands-on creative practice.", stream: "Arts", salary: "₹3–10 LPA" },
            { rank: 4, title: "Stage and Set Designer", emoji: "🎭", field: "Theatre + Design", match_pct: 68, why: "Building the physical world of a theatre production — design, materials, construction — is exactly your combination.", stream: "Arts", salary: "₹4–10 LPA starting" },
            { rank: 5, title: "Sculpture and Public Art Creator", emoji: "🗿", field: "Arts + Engineering", match_pct: 60, why: "Creating large-scale public sculptures requires both artistic vision and structural engineering knowledge.", stream: "Arts / PCM", salary: "₹4–12 LPA" },
          ]
        },

        // ── 10 THREE-LETTER SORTED PROFILES (NEW) ──────────────────────────────────
        ABC: {
          personality_type: "The Informed Strategist",
          personality_desc: "You combine analytical precision, business strategy, and deep people understanding. You are the rare leader who can read data, build strategy, and bring humans along for the journey.",
          stream_recommendation: "Commerce / PCM+CS", stream_reason: "Your triple strength in analysis, strategy, and people opens careers that shape organisations and public policy at the highest levels.",
          top_careers: [
            { rank: 1, title: "Strategy Consultant", emoji: "🗂️", field: "Consulting", match_pct: 90, why: "Top consulting firms need people who combine analytical rigour, business strategy, and stakeholder intelligence — your exact triangle.", stream: "Commerce / PCM+CS", salary: "₹10–25 LPA starting" },
            { rank: 2, title: "Policy Director", emoji: "🏛️", field: "Government + Policy", match_pct: 83, why: "Designing public policies that are evidence-based, financially viable, and people-centred requires all three of your strengths.", stream: "Commerce / Arts", salary: "₹8–20 LPA starting" },
            { rank: 3, title: "Social Impact Investor", emoji: "💰", field: "Finance + Social", match_pct: 75, why: "Investing capital in organisations that deliver both returns and social impact requires data, strategy, and empathy.", stream: "Commerce", salary: "₹10–25 LPA starting" },
            { rank: 4, title: "HR Analytics Lead", emoji: "📊", field: "HR + Analytics", match_pct: 67, why: "Using people data to drive talent strategy sits at the intersection of your three strongest areas.", stream: "Commerce / PCM+CS", salary: "₹7–15 LPA starting" },
            { rank: 5, title: "Economic Advisor", emoji: "🌍", field: "Economics + Policy", match_pct: 59, why: "Advising on economic policy at a national or global level rewards analytical intelligence, strategic thinking, and human understanding.", stream: "Commerce / Arts", salary: "₹8–18 LPA starting" },
          ]
        },
        ABD: {
          personality_type: "The Engineering Executive",
          personality_desc: "You think analytically, drive toward business goals, and love making things. This is the profile of the rare technical founder who can think, build, and lead simultaneously.",
          stream_recommendation: "PCM+CS", stream_reason: "PCM+CS gives you the technical and analytical foundation; your business and builder instincts take you toward founding and scaling engineering-driven companies.",
          top_careers: [
            { rank: 1, title: "Technical Startup Founder / CTO", emoji: "🚀", field: "Tech + Business", match_pct: 92, why: "The rarest startup combination: someone who can code the product, understand the business model, and build the team.", stream: "PCM+CS", salary: "Varies widely" },
            { rank: 2, title: "Engineering Manager", emoji: "👷", field: "Engineering + Leadership", match_pct: 84, why: "Leading technical teams while maintaining business context and hands-on credibility is exactly the ABD career.", stream: "PCM+CS", salary: "₹15–35 LPA starting" },
            { rank: 3, title: "Product-Led Growth Lead", emoji: "📱", field: "Product + Business", match_pct: 76, why: "Growing a software product by making it genuinely useful AND commercially optimised uses your three-way strength.", stream: "PCM+CS", salary: "₹10–25 LPA starting" },
            { rank: 4, title: "Industrial Entrepreneur", emoji: "🏭", field: "Manufacturing + Business", match_pct: 68, why: "Building a company that makes a physical product requires the analytical, business, and technical combination you carry.", stream: "PCM / Commerce", salary: "Varies widely" },
            { rank: 5, title: "R&D Business Director", emoji: "🔬", field: "Research + Business", match_pct: 60, why: "Leading research programmes that connect scientific output to commercial value is a high-level ABD career.", stream: "PCM+CS", salary: "₹12–30 LPA starting" },
          ]
        },
        ABE: {
          personality_type: "The Tech-Creative Leader",
          personality_desc: "You blend rigorous analytical thinking, entrepreneurial strategy, and creative vision — the three forces behind every successful product company, creative agency, and tech platform.",
          stream_recommendation: "PCM+CS / Commerce", stream_reason: "Your combination of analysis, business thinking, and creative expression positions you to lead organisations where technology and creativity converge.",
          top_careers: [
            { rank: 1, title: "Senior Product Manager", emoji: "📱", field: "Tech + Business + Design", match_pct: 91, why: "Product management is the intersection of user insight, business strategy, and creative problem-solving — your three core strengths.", stream: "PCM+CS", salary: "₹12–30 LPA starting" },
            { rank: 2, title: "Creative Agency CEO", emoji: "🎨", field: "Business + Creative", match_pct: 84, why: "Running an agency requires data-driven business decisions, creative direction, and strategic growth planning — all ABE.", stream: "Commerce / Arts", salary: "₹10–30 LPA starting" },
            { rank: 3, title: "UX Strategy Director", emoji: "🔍", field: "Design + Strategy", match_pct: 76, why: "Defining how a company's products look, feel, and serve users requires analytical, business, and creative thinking.", stream: "PCM+CS / Arts", salary: "₹12–28 LPA starting" },
            { rank: 4, title: "EdTech Founder", emoji: "🎓", field: "Education + Tech + Business", match_pct: 68, why: "Building a learning platform requires instructional creativity, business model design, and data-driven growth — perfectly ABE.", stream: "PCM+CS", salary: "Varies widely" },
            { rank: 5, title: "Design Thinking Consultant", emoji: "💡", field: "Consulting + Design", match_pct: 60, why: "Helping organisations innovate through human-centred design processes uses your analytical, strategic, and creative strengths together.", stream: "PCM+CS / Commerce", salary: "₹8–20 LPA starting" },
          ]
        },
        ACD: {
          personality_type: "The Scientific Humanist",
          personality_desc: "Science, empathy, and hands-on skill converge in you. You want to understand, genuinely care, and fix — making you ideally suited to careers at the crossroads of healthcare and research.",
          stream_recommendation: "PCB / PCM", stream_reason: "Your analytical curiosity, people-first care, and practical making instinct are perfectly combined in biomedical, clinical, and applied health science careers.",
          top_careers: [
            { rank: 1, title: "Medical Doctor (Surgeon)", emoji: "🩺", field: "Healthcare + Science", match_pct: 90, why: "Medicine demands scientific rigour, empathy for patients, and the hands-on skill to intervene — ACD in a single career.", stream: "PCB", salary: "₹8–30 LPA starting" },
            { rank: 2, title: "Biomedical Researcher", emoji: "🔬", field: "Science + Healthcare", match_pct: 83, why: "Investigating disease mechanisms with a clear view to helping real patients is the scientific humanist's core purpose.", stream: "PCB / PCM", salary: "₹5–12 LPA starting" },
            { rank: 3, title: "Clinical Engineer", emoji: "⚙️", field: "Engineering + Healthcare", match_pct: 75, why: "Designing, testing, and maintaining medical equipment in hospitals combines all three of your core strengths.", stream: "PCB / PCM", salary: "₹4–10 LPA starting" },
            { rank: 4, title: "Forensic Scientist", emoji: "🔍", field: "Science + Law + Hands-On", match_pct: 67, why: "Analysing physical evidence to solve crimes uses scientific precision, hands-on lab skill, and a care for justice.", stream: "PCM / PCB", salary: "₹4–10 LPA starting" },
            { rank: 5, title: "Public Health Scientist", emoji: "🌍", field: "Science + Social", match_pct: 59, why: "Designing health interventions for populations combines analytical research, social understanding, and practical programme delivery.", stream: "PCB", salary: "₹5–12 LPA starting" },
          ]
        },
        ACE: {
          personality_type: "The Empathetic Innovator",
          personality_desc: "Analytical thinking, genuine care for people, and creative expression make you a rare force in design and communication. You care about both what is and what could be.",
          stream_recommendation: "PCM+CS / Arts", stream_reason: "Your three-way strength in analysis, human understanding, and creative expression is the exact profile of world-class UX researchers and designers.",
          top_careers: [
            { rank: 1, title: "UX Researcher", emoji: "🔍", field: "Tech + Psychology + Design", match_pct: 93, why: "Combining scientific research methods, empathy for users, and creative prototyping is the ACE career par excellence.", stream: "PCM+CS / Arts", salary: "₹6–14 LPA starting" },
            { rank: 2, title: "Interaction Designer", emoji: "🎨", field: "Design + Psychology", match_pct: 86, why: "Designing how people interact with digital products requires your analytical, empathetic, and creative strengths in balance.", stream: "PCM+CS / Arts", salary: "₹5–13 LPA starting" },
            { rank: 3, title: "Educational Technology Designer", emoji: "🎓", field: "Education + Tech + Design", match_pct: 78, why: "Building learning experiences that are scientifically grounded, student-centred, and creatively engaging is ACE work.", stream: "PCM+CS / Arts", salary: "₹5–12 LPA starting" },
            { rank: 4, title: "Science Communicator", emoji: "📺", field: "Science + Media", match_pct: 70, why: "Translating complex scientific ideas into stories that resonate with real people requires all three of your strengths.", stream: "PCM / Arts", salary: "₹5–12 LPA starting" },
            { rank: 5, title: "Data Journalist", emoji: "📰", field: "Media + Analytics", match_pct: 62, why: "Using data to tell stories that matter — and doing it beautifully — is where your analytical, empathetic, and creative nature converges.", stream: "PCM+CS / Arts", salary: "₹4–10 LPA starting" },
          ]
        },
        ADE: {
          personality_type: "The Creative Engineer",
          personality_desc: "You can analyse systems, build them, and make them beautiful. This is among the rarest creative profiles — someone who brings aesthetic vision and engineering rigour to the same project.",
          stream_recommendation: "PCM+CS", stream_reason: "PCM with CS gives you the technical and analytical foundation; your creative drive takes you toward the most exciting careers at the intersection of technology and design.",
          top_careers: [
            { rank: 1, title: "Industrial / Product Designer", emoji: "🔧", field: "Design + Engineering", match_pct: 92, why: "Designing objects that are functional, efficient, and beautiful is the perfect ADE career — science, craft, and art unified.", stream: "PCM / Arts", salary: "₹5–13 LPA starting" },
            { rank: 2, title: "Game Developer", emoji: "🎮", field: "Tech + Design", match_pct: 85, why: "Building a game requires programming logic, level design craft, and artistic vision — ADE in three syllables.", stream: "PCM+CS", salary: "₹5–14 LPA starting" },
            { rank: 3, title: "Motion Designer / 3D Artist", emoji: "🎬", field: "Design + Tech", match_pct: 77, why: "Creating animated visuals requires technical rigor, hands-on software skill, and creative taste.", stream: "PCM+CS / Arts", salary: "₹4–12 LPA starting" },
            { rank: 4, title: "Robotics Artist", emoji: "🤖", field: "Engineering + Arts", match_pct: 69, why: "Designing machines that move, perform, and express something — merging robotics with art — is a growing frontier for ADE profiles.", stream: "PCM+CS", salary: "₹6–14 LPA starting" },
            { rank: 5, title: "Creative Technologist", emoji: "🌐", field: "Tech + Creative", match_pct: 61, why: "Using technology as a creative medium — AR, interactive installations, generative art — sits at your exact crossroads.", stream: "PCM+CS", salary: "₹6–15 LPA starting" },
          ]
        },
        BCD: {
          personality_type: "The Social Business Developer",
          personality_desc: "You combine entrepreneurial drive, genuine care for people, and a builder's practicality. You want to run an organisation that creates real things that genuinely help people.",
          stream_recommendation: "Commerce / PCM", stream_reason: "Your business instinct, people-centred values, and hands-on building drive open careers at the operational and social sides of business.",
          top_careers: [
            { rank: 1, title: "Social Enterprise CEO", emoji: "🌱", field: "Business + Social + Operations", match_pct: 91, why: "Building a business that helps people AND runs sustainably requires your exact combination of strategy, empathy, and practical execution.", stream: "Commerce / Arts", salary: "Varies widely" },
            { rank: 2, title: "Hospitality / Hotel Chain Founder", emoji: "🏨", field: "Business + People + Operations", match_pct: 83, why: "Hospitality is about creating physical experiences that make people feel welcome — it's BCD in action.", stream: "Commerce", salary: "₹6–20 LPA starting" },
            { rank: 3, title: "Real Estate Developer", emoji: "🏘️", field: "Business + Property + Design", match_pct: 75, why: "Developing properties that serve communities requires business strategy, understanding what people need, and hands-on project management.", stream: "Commerce / PCM", salary: "₹8–25 LPA starting" },
            { rank: 4, title: "Healthcare Business Developer", emoji: "🏥", field: "Business + Healthcare", match_pct: 67, why: "Growing healthcare organisations requires your commercial drive, empathy for patients, and practical operations ability.", stream: "Commerce / PCB", salary: "₹7–18 LPA starting" },
            { rank: 5, title: "Retail Chain Operations Director", emoji: "🏪", field: "Business + Operations + People", match_pct: 59, why: "Running a retail chain at scale requires business strategy, customer empathy, and hands-on operations management.", stream: "Commerce", salary: "₹8–20 LPA starting" },
          ]
        },
        BCE: {
          personality_type: "The Cultural Entrepreneur",
          personality_desc: "Business strategy, social intelligence, and creative flair converge in you to produce great media companies, entertainment empires, and cultural movements.",
          stream_recommendation: "Commerce / Arts", stream_reason: "Your combination of business acumen, people magnetism, and creative energy positions you to build and lead organisations in entertainment, media, and culture.",
          top_careers: [
            { rank: 1, title: "Film / Music Producer", emoji: "🎬", field: "Entertainment + Business", match_pct: 92, why: "Producing creative work requires business judgement, talent management, and a genuine creative eye — BCE perfectly.", stream: "Commerce / Arts", salary: "₹5–30 LPA (varies)" },
            { rank: 2, title: "Entertainment Company Founder", emoji: "🚀", field: "Business + Entertainment", match_pct: 85, why: "Building a company in music, film, or content requires business strategy, people leadership, and creative vision.", stream: "Commerce / Arts", salary: "Varies widely" },
            { rank: 3, title: "PR Agency Owner", emoji: "📢", field: "Media + Business + People", match_pct: 77, why: "Running a PR firm means strategising, managing client relationships, and crafting compelling creative narratives — all BCE.", stream: "Commerce / Arts", salary: "₹6–18 LPA starting" },
            { rank: 4, title: "Talent Manager", emoji: "⭐", field: "Entertainment + People", match_pct: 69, why: "Representing creative talent — spotting potential, negotiating deals, building careers — is a deeply BCE role.", stream: "Commerce / Arts", salary: "₹4–15 LPA starting" },
            { rank: 5, title: "Cultural Events Director", emoji: "🎪", field: "Events + Creative + Business", match_pct: 61, why: "Curating and producing large cultural events — music festivals, art fairs — combines your three core strengths.", stream: "Commerce / Arts", salary: "₹5–14 LPA starting" },
          ]
        },
        BDE: {
          personality_type: "The Creative Operations Leader",
          personality_desc: "You can turn creative vision into a running business with physical output. You're at your best leading teams that make things — from product companies to design studios.",
          stream_recommendation: "Commerce / PCM", stream_reason: "Your ability to blend business drive, hands-on making, and creative vision positions you to lead and found companies that build beautifully designed, commercially successful products.",
          top_careers: [
            { rank: 1, title: "Product Company CEO", emoji: "🚀", field: "Business + Product + Design", match_pct: 91, why: "Leading a company that builds a physically designed product requires business strategy, making instinct, and creative direction — all BDE.", stream: "Commerce / PCM+CS", salary: "Varies widely" },
            { rank: 2, title: "Manufacturing Entrepreneur", emoji: "🏭", field: "Business + Manufacturing", match_pct: 83, why: "Starting a factory or manufacturing business that makes thoughtfully designed goods is the BDE entrepreneurial path.", stream: "PCM / Commerce", salary: "Varies widely" },
            { rank: 3, title: "Industrial Design Studio Founder", emoji: "🔧", field: "Design + Business", match_pct: 75, why: "Running a studio that designs physical products commercially requires creative vision, maker's craft, and business management.", stream: "PCM / Commerce / Arts", salary: "₹6–20 LPA starting" },
            { rank: 4, title: "Creative Production Director", emoji: "🎬", field: "Production + Business + Creative", match_pct: 67, why: "Leading the production of complex creative projects — games, films, product lines — requires all three BDE strengths.", stream: "Commerce / Arts", salary: "₹8–22 LPA starting" },
            { rank: 5, title: "UX Product Owner", emoji: "📱", field: "Product + Design + Business", match_pct: 59, why: "Owning a digital product's roadmap, design, and commercial outcomes sits at your exact three-way intersection.", stream: "PCM+CS", salary: "₹10–25 LPA starting" },
          ]
        },
        CDE: {
          personality_type: "The Artistic Changemaker",
          personality_desc: "Empathy, making, and creative expression combine in you to produce someone who changes communities through hands-on creative work. You heal, build, and inspire simultaneously.",
          stream_recommendation: "Arts / PCB", stream_reason: "Your combination of people-care, practical making, and creative expression is best channelled through therapeutic arts, social design, and community-based creative work.",
          top_careers: [
            { rank: 1, title: "Art Therapist", emoji: "🎨", field: "Arts + Psychology + Healing", match_pct: 91, why: "Using creative expression to help people process trauma and emotion combines all three of your core strengths.", stream: "Arts / PCB", salary: "₹4–9 LPA starting" },
            { rank: 2, title: "Community Design Leader", emoji: "🏘️", field: "Design + Social Impact", match_pct: 83, why: "Designing spaces, experiences, and tools for communities — with communities — is the CDE career in practice.", stream: "Arts / PCM", salary: "₹4–10 LPA starting" },
            { rank: 3, title: "Drama Therapist", emoji: "🎭", field: "Theatre + Psychology + Social", match_pct: 75, why: "Using performance and storytelling to help people work through emotional and social challenges is deeply CDE.", stream: "Arts / PCB", salary: "₹4–9 LPA starting" },
            { rank: 4, title: "Occupational Art Therapist", emoji: "♿", field: "Healthcare + Arts", match_pct: 67, why: "Helping people with disabilities or illness regain function through creative arts practice combines all your CDE instincts.", stream: "PCB / Arts", salary: "₹4–8 LPA starting" },
            { rank: 5, title: "Social Design Researcher", emoji: "🔬", field: "Design + Social Science", match_pct: 59, why: "Researching how design can be used to improve communities and public spaces sits at the heart of CDE purpose.", stream: "Arts / PCM+CS", salary: "₹5–11 LPA starting" },
          ]
        },

        // ── 5 FOUR-LETTER SORTED PROFILES (NEW) ────────────────────────────────────
        ABCD: {
          personality_type: "The Renaissance Professional",
          personality_desc: "Analytical, strategic, empathetic, and hands-on — this is the profile of organisations' most valued leaders. You can think, strategise, connect, and build in the same breath.",
          stream_recommendation: "PCM+CS or Commerce", stream_reason: "Your four-way strength positions you for senior leadership in technology, consulting, healthcare, or engineering — whichever sector you choose will benefit from this rare combination.",
          top_careers: [
            { rank: 1, title: "Chief Technology Officer (CTO)", emoji: "💼", field: "Tech + Leadership", match_pct: 90, why: "CTOs must think analytically, drive business results, manage people, and understand what their engineers are building — a perfect ABCD role.", stream: "PCM+CS", salary: "₹25–80 LPA senior" },
            { rank: 2, title: "Senior Management Consultant", emoji: "🗂️", field: "Consulting", match_pct: 83, why: "The best consultants combine data, strategy, stakeholder management, and hands-on delivery — all four of your strengths.", stream: "Any", salary: "₹15–40 LPA starting" },
            { rank: 3, title: "Hospital / Healthcare CEO", emoji: "🏥", field: "Healthcare + Leadership", match_pct: 75, why: "Leading a hospital requires science-grounded decisions, business discipline, genuine patient empathy, and operational execution.", stream: "PCB / Commerce", salary: "₹15–40 LPA starting" },
            { rank: 4, title: "Engineering Entrepreneur", emoji: "🚀", field: "Tech + Business", match_pct: 67, why: "Founding a company that makes a technical product, serving real people, while building a sustainable business — pure ABCD.", stream: "PCM+CS", salary: "Varies widely" },
            { rank: 5, title: "Policy Director", emoji: "🏛️", field: "Policy + Leadership", match_pct: 59, why: "Designing evidence-based policies that are strategically sound, socially just, and practically implementable draws on all four strengths.", stream: "Any", salary: "₹12–30 LPA starting" },
          ]
        },
        ABCE: {
          personality_type: "The Innovation Catalyst",
          personality_desc: "Analytical thinking, business strategy, human empathy, and creative vision: a rare force for innovation who doesn't just have ideas but can connect them to people and markets.",
          stream_recommendation: "PCM+CS", stream_reason: "Your four-way strength positions you to lead innovation programmes, found creative technology companies, and design the learning and product experiences of tomorrow.",
          top_careers: [
            { rank: 1, title: "Innovation Director", emoji: "💡", field: "Strategy + Innovation", match_pct: 91, why: "Leading a company's innovation pipeline requires analytical, strategic, human, and creative strength — ABCE in a job title.", stream: "PCM+CS / Commerce", salary: "₹15–40 LPA starting" },
            { rank: 2, title: "Design Thinking Programme Lead", emoji: "🔍", field: "Consulting + Design", match_pct: 84, why: "Running human-centred innovation programmes combines facilitation, creativity, business framing, and research rigour.", stream: "PCM+CS / Commerce", salary: "₹10–25 LPA starting" },
            { rank: 3, title: "EdTech / Learning Design Founder", emoji: "🎓", field: "Education + Tech + Business", match_pct: 76, why: "Building a platform that is scientifically grounded, commercially viable, people-centred, and creatively engaging draws all four ABCE strengths.", stream: "PCM+CS", salary: "Varies widely" },
            { rank: 4, title: "Product Strategy Director", emoji: "📱", field: "Product + Business + Design", match_pct: 68, why: "Defining the long-term direction of a product line requires data insight, market strategy, user empathy, and creative vision.", stream: "PCM+CS", salary: "₹15–35 LPA starting" },
            { rank: 5, title: "Creative AI Researcher", emoji: "🤖", field: "AI + Design + Research", match_pct: 60, why: "Developing AI systems that are scientifically rigorous, commercially applicable, human-centred, and creatively expressive is an emerging ABCE frontier.", stream: "PCM+CS", salary: "₹12–30 LPA starting" },
          ]
        },
        ABDE: {
          personality_type: "The Technical Visionary",
          personality_desc: "Analytical depth, business drive, a maker's instinct, and creative vision: the profile of great founders, CTOs, and product leaders who can build and see the future simultaneously.",
          stream_recommendation: "PCM+CS", stream_reason: "The technical visionary path runs through PCM+CS, where analytical depth and creative expression combine with business drive and hands-on building.",
          top_careers: [
            { rank: 1, title: "Deep-Tech Startup Founder", emoji: "🚀", field: "Tech + Business + Innovation", match_pct: 92, why: "Building a company at the frontier of science and technology — robotics, AI, biotech — requires every one of your four strengths.", stream: "PCM+CS", salary: "Varies widely" },
            { rank: 2, title: "Chief Product Officer", emoji: "📱", field: "Product + Business + Design", match_pct: 85, why: "Owning the full product vision — technical feasibility, business case, user experience, and creative excellence — is the ABDE executive role.", stream: "PCM+CS", salary: "₹20–60 LPA senior" },
            { rank: 3, title: "Technical Architect (Principal / Fellow)", emoji: "🏛️", field: "Engineering + Strategy", match_pct: 77, why: "Designing the technical blueprint for complex systems, with business and creative context, is the highest form of technical vision.", stream: "PCM+CS", salary: "₹20–60 LPA starting" },
            { rank: 4, title: "Creative Engineering Director", emoji: "🎨", field: "Engineering + Design", match_pct: 69, why: "Leading teams that build products where engineering and design are inseparable requires you to speak both languages fluently.", stream: "PCM+CS", salary: "₹15–40 LPA starting" },
            { rank: 5, title: "Space / Defence Tech Entrepreneur", emoji: "🛸", field: "Aerospace + Business", match_pct: 61, why: "Building technologies for space or defence requires scientific depth, commercial strategy, hands-on engineering, and visionary design.", stream: "PCM+CS", salary: "Varies widely" },
          ]
        },
        ACDE: {
          personality_type: "The Holistic Creator",
          personality_desc: "Science, empathy, hands-on craft, and creative expression converge in you. You work at the frontier of design, medicine, and human-centred technology — building things that heal, enable, and inspire.",
          stream_recommendation: "PCB / PCM+CS", stream_reason: "Your four-way combination of analysis, care, making, and creative expression positions you for careers at the intersection of healthcare design, rehabilitative technology, and science communication.",
          top_careers: [
            { rank: 1, title: "Medical Device Designer", emoji: "🏥", field: "Design + Engineering + Healthcare", match_pct: 91, why: "Designing medical devices requires scientific rigour, empathy for patients, hands-on prototyping, and creative problem-solving — ACDE perfectly.", stream: "PCB / PCM+CS", salary: "₹6–15 LPA starting" },
            { rank: 2, title: "Human-Centred Research Lead", emoji: "🔍", field: "Research + Design + Social", match_pct: 83, why: "Leading teams that research how technology and design can better serve human needs draws all four of your strengths.", stream: "PCM+CS / Arts", salary: "₹8–20 LPA starting" },
            { rank: 3, title: "Rehabilitative Technology Innovator", emoji: "🦾", field: "Healthcare + Tech + Design", match_pct: 75, why: "Developing prosthetics, exoskeletons, and assistive tools uses science, empathy, craft, and creative design in one.", stream: "PCB / PCM+CS", salary: "₹6–15 LPA starting" },
            { rank: 4, title: "Biomechanical Engineer", emoji: "⚙️", field: "Engineering + Healthcare", match_pct: 67, why: "Applying engineering principles to the human body — for sport, medicine, and rehabilitation — is a deeply ACDE discipline.", stream: "PCM+CS / PCB", salary: "₹5–12 LPA starting" },
            { rank: 5, title: "Science-Art Communicator", emoji: "🎨", field: "Science + Arts + Education", match_pct: 59, why: "Creating art or public installations that communicate science with beauty and empathy sits at your four-way centre.", stream: "PCM+CS / Arts", salary: "₹5–12 LPA starting" },
          ]
        },
        BCDE: {
          personality_type: "The Dynamic Builder",
          personality_desc: "Strategy, people, making, and creativity: you are the complete builder. You can envision, connect, construct, and express — making you suited for entrepreneurship and creative leadership alike.",
          stream_recommendation: "Commerce / PCM", stream_reason: "Your four-way strength in business, people, hands-on making, and creative expression positions you to lead and found organisations that build real things for real people.",
          top_careers: [
            { rank: 1, title: "Social Venture Founder", emoji: "🌱", field: "Business + Social + Creative + Operations", match_pct: 92, why: "Building a venture that is commercially viable, people-centred, physically delivered, and creatively differentiated draws on all four BCDE strengths.", stream: "Commerce / PCM / Arts", salary: "Varies widely" },
            { rank: 2, title: "Experiential Design Director", emoji: "🎨", field: "Design + Events + Business", match_pct: 84, why: "Designing immersive experiences — retail spaces, museums, live events — requires business thinking, empathy, craft, and creative vision.", stream: "Commerce / Arts", salary: "₹8–22 LPA starting" },
            { rank: 3, title: "Brand Experience Architect", emoji: "🏷️", field: "Branding + Design + Strategy", match_pct: 76, why: "Creating the full sensory and emotional experience of a brand — across physical and digital touchpoints — is a BCDE leadership role.", stream: "Commerce / Arts", salary: "₹10–25 LPA starting" },
            { rank: 4, title: "Cultural Business Leader", emoji: "🏛️", field: "Culture + Business + Arts", match_pct: 68, why: "Leading a cultural organisation — museum, arts foundation, festival — requires strategy, stakeholder empathy, operational delivery, and creative curation.", stream: "Commerce / Arts", salary: "₹8–20 LPA starting" },
            { rank: 5, title: "Hospitality Entrepreneur", emoji: "🏨", field: "Business + People + Design", match_pct: 60, why: "Creating a hotel, restaurant, or experience brand from scratch requires commercial planning, guest empathy, physical design, and creative identity.", stream: "Commerce", salary: "Varies widely" },
          ]
        },

        // ── 1 FIVE-LETTER PROFILE (NEW) ─────────────────────────────────────────────
        ABCDE: {
          personality_type: "The Renaissance Mind",
          personality_desc: "You have genuine strengths across all five domains — analytical, strategic, social, practical, and creative. The world doesn't have a predefined path for you; you'll likely need to make your own.",
          stream_recommendation: "Any", stream_reason: "Your balanced five-way profile means almost any stream will serve you — choose based on which specific careers most excite you, as your strengths will transfer across domains.",
          top_careers: [
            { rank: 1, title: "Entrepreneur / Founder", emoji: "🚀", field: "Multi-domain", match_pct: 88, why: "Founding your own venture allows you to deploy all five of your strengths simultaneously — the only career that doesn't ask you to choose.", stream: "Any", salary: "Varies widely" },
            { rank: 2, title: "Innovation & Strategy Consultant", emoji: "💡", field: "Consulting + Strategy", match_pct: 81, why: "Top consultancies value people who can analyse, strategise, empathise, deliver, and communicate creatively — your five-way profile is their dream hire.", stream: "Any", salary: "₹15–40 LPA starting" },
            { rank: 3, title: "Social Innovation Leader", emoji: "🌍", field: "Social Impact + Business", match_pct: 74, why: "Leading organisations that tackle systemic problems with evidence, strategy, empathy, operational delivery, and creative communication draws on all five.", stream: "Any", salary: "₹10–25 LPA starting" },
            { rank: 4, title: "Multidisciplinary Designer", emoji: "🎨", field: "Design + Science + People", match_pct: 67, why: "Designing for complex human systems — cities, healthcare, education — requires all five strengths and a willingness to work across fields.", stream: "PCM+CS / Arts", salary: "₹8–20 LPA starting" },
            { rank: 5, title: "Policy + Creative Director", emoji: "🏛️", field: "Policy + Arts + Strategy", match_pct: 60, why: "Designing policy that is analytically grounded, financially viable, human-centred, implementable, and publicly compelling is the five-strength career.", stream: "Any", salary: "₹12–30 LPA starting" },
          ]
        },

        // ── 9 SUB-PURE: CLEAR WINNER WITH SECONDARY FLAVOUR (NEW) ──────────────────
        A_B: {
          personality_type: "The Analytical Entrepreneur",
          personality_desc: "You're fundamentally analytical, but entrepreneurial ambition gives your thinking a commercial edge. You don't just discover insights — you ask how to profit from them.",
          stream_recommendation: "PCM+CS", stream_reason: "Your dominant analytical ability, tempered by commercial instinct, positions you for high-value tech entrepreneurship and quantitative finance.",
          top_careers: [
            { rank: 1, title: "Tech Startup Founder", emoji: "🚀", field: "Tech + Business", match_pct: 92, why: "Building a data-driven product company is the perfect vehicle for your dominant analytical skills and secondary business drive.", stream: "PCM+CS", salary: "Varies widely" },
            { rank: 2, title: "Quantitative Finance Analyst", emoji: "📐", field: "Finance + Analytics", match_pct: 85, why: "Applying mathematical modelling to high-stakes financial decisions rewards your analytical dominance with business-world impact.", stream: "PCM+CS / Commerce", salary: "₹10–25 LPA starting" },
            { rank: 3, title: "Data-Driven Product Lead", emoji: "📱", field: "Tech + Analytics", match_pct: 77, why: "Leading product teams with a data-first, commercially conscious approach is the A_B career in product management.", stream: "PCM+CS", salary: "₹10–25 LPA starting" },
            { rank: 4, title: "R&D Entrepreneur", emoji: "🔬", field: "Research + Business", match_pct: 69, why: "Founding a company commercialising your own research ideas combines your analytical dominance with entrepreneurial secondary strength.", stream: "PCM+CS", salary: "Varies widely" },
            { rank: 5, title: "Algorithmic Trading Developer", emoji: "💹", field: "Finance + CS", match_pct: 61, why: "Building automated trading systems sits exactly at the A_B intersection — pure analytical engineering with direct commercial consequences.", stream: "PCM+CS", salary: "₹10–30 LPA starting" },
          ]
        },
        A_C: {
          personality_type: "The Scientific Communicator",
          personality_desc: "Logic and curiosity drive you, but you care about connecting your findings with people. You make the complex accessible — whether in research, teaching, or science media.",
          stream_recommendation: "PCM", stream_reason: "Your analytically dominant profile with a people-communication secondary strength makes science communication, research education, and policy advisory your ideal path.",
          top_careers: [
            { rank: 1, title: "Science Communicator / Journalist", emoji: "📺", field: "Science + Media", match_pct: 91, why: "Translating the frontier of research into stories that reach and move the public requires analytical depth and genuine care for your audience.", stream: "PCM / Arts", salary: "₹5–12 LPA starting" },
            { rank: 2, title: "Medical Science Liaison", emoji: "🩺", field: "Pharma + Communication", match_pct: 83, why: "Bridging pharmaceutical research with healthcare practitioners requires scientific mastery and the ability to connect with clinicians as people.", stream: "PCB / PCM", salary: "₹8–18 LPA starting" },
            { rank: 3, title: "Academic Researcher + Educator", emoji: "🎓", field: "Academia + Teaching", match_pct: 75, why: "Producing rigorous research AND teaching it to students requires both your analytical dominance and secondary communication strength.", stream: "PCM / Arts", salary: "₹5–14 LPA starting" },
            { rank: 4, title: "Science Policy Advisor", emoji: "🏛️", field: "Science + Policy", match_pct: 67, why: "Advising governments on science and technology policy requires deep technical knowledge AND the ability to communicate with non-scientists.", stream: "PCM", salary: "₹8–20 LPA starting" },
            { rank: 5, title: "Research Outreach Director", emoji: "📢", field: "Research + Comms", match_pct: 59, why: "Leading communication strategy for a research institution draws on your A and C strengths in complementary ways.", stream: "PCM", salary: "₹6–14 LPA starting" },
          ]
        },
        A_D: {
          personality_type: "The Applied Scientist",
          personality_desc: "Your analytical mind has an unusually practical streak. You're not satisfied with abstract discovery — you want your insights to become things that work in the real world.",
          stream_recommendation: "PCM", stream_reason: "Your analytically dominant, hands-on secondary profile is perfectly served by applied sciences and precision engineering, where theory becomes physical reality.",
          top_careers: [
            { rank: 1, title: "Applied Physics / Materials Scientist", emoji: "⚛️", field: "Science + Engineering", match_pct: 92, why: "Applying physics or chemistry to develop new materials and industrial solutions combines your analytical dominance with hands-on lab work.", stream: "PCM", salary: "₹5–14 LPA starting" },
            { rank: 2, title: "Process / Chemical Engineer", emoji: "🧪", field: "Engineering + Science", match_pct: 85, why: "Designing industrial processes from first principles — systematically, analytically, and in the physical world — is the A_D role.", stream: "PCM", salary: "₹5–12 LPA starting" },
            { rank: 3, title: "R&D Engineer", emoji: "🔬", field: "Research + Engineering", match_pct: 77, why: "Researching new engineering solutions and physically prototyping them combines your analytical rigor with hands-on building drive.", stream: "PCM+CS / PCM", salary: "₹5–14 LPA starting" },
            { rank: 4, title: "Nuclear Engineer", emoji: "⚡", field: "Engineering + Physics", match_pct: 69, why: "Nuclear engineering requires the deepest analytical mastery AND hands-on precision to manage complex physical systems safely.", stream: "PCM", salary: "₹6–15 LPA starting" },
            { rank: 5, title: "Complex Systems Analyst", emoji: "⚙️", field: "Engineering + Analytics", match_pct: 61, why: "Modelling and optimising complex engineered systems — power grids, transport networks — uses analytical tools to support real physical infrastructure.", stream: "PCM+CS", salary: "₹5–12 LPA starting" },
          ]
        },
        A_E: {
          personality_type: "The Technical Artist",
          personality_desc: "You're analytically rigorous, but creative restlessness makes you push beyond pure science. You want your work to be not just correct, but beautiful — a rare demand in technical fields.",
          stream_recommendation: "PCM+CS", stream_reason: "Your analytically dominant profile with a creative secondary pull positions you for the emerging field of creative technology, where code, data, and art converge.",
          top_careers: [
            { rank: 1, title: "Generative AI / Creative Coder", emoji: "🎨", field: "Tech + Art", match_pct: 91, why: "Writing code that produces art — generative visuals, music, interactive experiences — is the A_E career at its most direct.", stream: "PCM+CS", salary: "₹6–16 LPA starting" },
            { rank: 2, title: "Data Sonification Designer", emoji: "🎵", field: "Analytics + Sound", match_pct: 83, why: "Turning data patterns into sound and music compositions is a growing field for analytically-dominant creative thinkers.", stream: "PCM+CS / Arts", salary: "₹5–12 LPA starting" },
            { rank: 3, title: "Scientific Visualisation Engineer", emoji: "🔬", field: "Science + Design", match_pct: 75, why: "Building visualisations of complex scientific data for research and public communication uses your analytical rigour and aesthetic sensibility.", stream: "PCM+CS", salary: "₹5–13 LPA starting" },
            { rank: 4, title: "Computational Photographer", emoji: "📷", field: "Photography + CS", match_pct: 67, why: "Engineering the algorithms behind computational photography — camera AI, image processing — is an A_E frontier.", stream: "PCM+CS", salary: "₹8–20 LPA starting" },
            { rank: 5, title: "Algorithmic Composer", emoji: "🎶", field: "Music + CS", match_pct: 59, why: "Using mathematical algorithms to compose music combines your analytical dominance with your secondary creative drive.", stream: "PCM+CS / Arts", salary: "₹4–12 LPA starting" },
          ]
        },
        B_C: {
          personality_type: "The People-Driven Strategist",
          personality_desc: "Business drives you, but your social intelligence gives you a decisive advantage. You understand that great strategy always has a human element — and you exploit that understanding.",
          stream_recommendation: "Commerce", stream_reason: "Your dominant business instinct, supported by genuine people intelligence, positions you for senior roles in HR strategy, business development, and corporate leadership.",
          top_careers: [
            { rank: 1, title: "HR Business Partner / Director", emoji: "👥", field: "HR + Strategy", match_pct: 91, why: "Leading talent strategy for a business requires your dominant commercial thinking AND your secondary understanding of what makes people tick.", stream: "Commerce", salary: "₹8–22 LPA starting" },
            { rank: 2, title: "Customer Experience Strategy Lead", emoji: "🌟", field: "Business + People + Strategy", match_pct: 83, why: "Designing the strategy that drives customer loyalty requires both commercial intelligence and genuine empathy for customer needs.", stream: "Commerce", salary: "₹8–20 LPA starting" },
            { rank: 3, title: "Business Development Manager", emoji: "🤝", field: "Business + Relationships", match_pct: 75, why: "Growing a business through new partnerships and clients requires strategic thinking and the ability to genuinely connect with people.", stream: "Commerce", salary: "₹6–16 LPA starting" },
            { rank: 4, title: "Corporate Social Responsibility Director", emoji: "🌍", field: "Business + Social", match_pct: 67, why: "Embedding social responsibility into corporate strategy uses your business dominance and people-care secondary strength powerfully.", stream: "Commerce / Arts", salary: "₹8–20 LPA starting" },
            { rank: 5, title: "Social Impact Investor", emoji: "💰", field: "Finance + Social", match_pct: 59, why: "Deploying capital into organisations that create social value requires commercial rigour and human understanding in equal measure.", stream: "Commerce", salary: "₹10–25 LPA starting" },
          ]
        },
        B_D: {
          personality_type: "The Operational Executive",
          personality_desc: "You're a goal-setter and deal-maker, but you prefer your businesses to make real, physical things. Supply chains, factories, and logistics energise you as much as P&L statements.",
          stream_recommendation: "Commerce / PCM", stream_reason: "Your dominant business instinct with a secondary hands-on making drive positions you for senior operational and manufacturing leadership roles.",
          top_careers: [
            { rank: 1, title: "Supply Chain Director / CEO", emoji: "🏭", field: "Operations + Business", match_pct: 92, why: "Running supply chains at scale requires commercial mastery AND an understanding of how physical goods actually move — your exact B_D profile.", stream: "Commerce / PCM", salary: "₹12–30 LPA starting" },
            { rank: 2, title: "Manufacturing Operations Head", emoji: "⚙️", field: "Manufacturing + Business", match_pct: 84, why: "Leading factory operations with full P&L responsibility requires business dominance and hands-on manufacturing understanding.", stream: "PCM / Commerce", salary: "₹12–30 LPA starting" },
            { rank: 3, title: "Technical Sales Lead", emoji: "💼", field: "Sales + Engineering", match_pct: 76, why: "Selling complex physical products to industrial buyers requires business drive and the ability to understand what you're selling mechanically.", stream: "PCM / Commerce", salary: "₹8–20 LPA starting" },
            { rank: 4, title: "Logistics Entrepreneur", emoji: "🚚", field: "Business + Operations", match_pct: 68, why: "Building a logistics or delivery company requires strategic commercial thinking and a deep understanding of how physical operations run.", stream: "Commerce", salary: "Varies widely" },
            { rank: 5, title: "Industrial Business Strategist", emoji: "🗺️", field: "Strategy + Manufacturing", match_pct: 60, why: "Advising industrial businesses on strategy requires both commercial intelligence and an understanding of their physical operations.", stream: "Commerce / PCM", salary: "₹10–25 LPA starting" },
          ]
        },
        B_E: {
          personality_type: "The Creative Business Visionary",
          personality_desc: "Business instinct drives you, but creative energy makes you more daring than conventional executives. You want your company to look, feel, and sound like nothing else in the market.",
          stream_recommendation: "Commerce", stream_reason: "Your commercially dominant profile with creative secondary strength positions you for senior roles in brand strategy, entertainment business, and creative industry leadership.",
          top_careers: [
            { rank: 1, title: "Brand Strategy Director", emoji: "🏷️", field: "Business + Creative", match_pct: 91, why: "Defining a brand's identity, voice, and market position requires business strategy dominance and creative vision — perfectly B_E.", stream: "Commerce", salary: "₹10–25 LPA starting" },
            { rank: 2, title: "Entertainment Industry Executive", emoji: "🎬", field: "Business + Entertainment", match_pct: 83, why: "Running a record label, film studio, or content company at the executive level requires commercial dominance with creative sensibility.", stream: "Commerce / Arts", salary: "₹12–35 LPA starting" },
            { rank: 3, title: "Creative Agency Owner", emoji: "🎨", field: "Business + Creative Services", match_pct: 75, why: "Founding and running an agency that delivers creative work commercially is the definitive B_E career path.", stream: "Commerce / Arts", salary: "₹8–25 LPA starting" },
            { rank: 4, title: "Marketing Director", emoji: "📲", field: "Marketing + Business", match_pct: 67, why: "Leading marketing strategy requires commercial accountability and the creative intuition to know what will actually work.", stream: "Commerce", salary: "₹12–30 LPA starting" },
            { rank: 5, title: "Music / Fashion Business Manager", emoji: "🎵", field: "Business + Creative Industry", match_pct: 59, why: "Managing the business side of creative talent or fashion brands requires commercial rigour and a genuine feel for the creative world.", stream: "Commerce / Arts", salary: "₹6–18 LPA starting" },
          ]
        },
        C_D: {
          personality_type: "The Practical Empath",
          personality_desc: "You care about people above all, but you show that care through action — doing, fixing, building, helping. You're not just a listener; you're a do-er with a heart.",
          stream_recommendation: "PCB / Arts", stream_reason: "Your dominant people-care with hands-on secondary strength positions you for healthcare delivery, special education, and community work — caring careers that require active doing.",
          top_careers: [
            { rank: 1, title: "Physiotherapist / Occupational Therapist", emoji: "🏥", field: "Healthcare + Hands-On", match_pct: 92, why: "Helping people restore physical function through direct hands-on intervention is the most direct C_D career.", stream: "PCB", salary: "₹4–9 LPA starting" },
            { rank: 2, title: "Community Health Worker", emoji: "🤝", field: "Healthcare + Community", match_pct: 84, why: "Going into communities to deliver hands-on health support combines your dominant empathy with practical intervention skills.", stream: "PCB / Arts", salary: "₹3–7 LPA starting" },
            { rank: 3, title: "Special Needs Educator", emoji: "📚", field: "Education + Hands-On", match_pct: 76, why: "Teaching students with different learning needs requires deep empathy AND the practical creativity to build adapted learning materials.", stream: "Arts / Any", salary: "₹3–8 LPA starting" },
            { rank: 4, title: "Social Worker (Field)", emoji: "🌿", field: "Social Work + Action", match_pct: 68, why: "Field social work — going into homes and communities to actively help people — is where C_D strengths make the greatest difference.", stream: "Arts", salary: "₹3–7 LPA starting" },
            { rank: 5, title: "Nurse Practitioner / Advanced Nurse", emoji: "💉", field: "Healthcare + Hands-On", match_pct: 60, why: "Advanced nursing requires both deep patient empathy and highly skilled hands-on clinical care — a fundamentally C_D profession.", stream: "PCB", salary: "₹4–10 LPA starting" },
          ]
        },
        C_E: {
          personality_type: "The Empathetic Performer",
          personality_desc: "Your empathy finds its fullest expression through creative performance. Art, music, drama, and storytelling are how you understand people — and how you help them feel understood.",
          stream_recommendation: "Arts", stream_reason: "Your dominant people-care with a creative expressive secondary strength positions you for therapeutic arts, community arts, and education roles where creativity serves human connection.",
          top_careers: [
            { rank: 1, title: "Drama / Art Therapist", emoji: "🎭", field: "Arts + Psychology + Healing", match_pct: 92, why: "Using creative arts to help people explore emotions and heal is the most direct expression of your C_E combination.", stream: "Arts / PCB", salary: "₹4–10 LPA starting" },
            { rank: 2, title: "Youth Arts Programme Director", emoji: "🎨", field: "Arts + Youth + Education", match_pct: 84, why: "Designing and running creative programmes for young people requires genuine empathy for their experiences and creative expressive skill.", stream: "Arts", salary: "₹4–9 LPA starting" },
            { rank: 3, title: "Music Educator / Therapist", emoji: "🎵", field: "Music + Education + Healing", match_pct: 76, why: "Teaching music with the goal of personal development and emotional wellbeing is where your care for people and creative expression converge.", stream: "Arts", salary: "₹4–9 LPA starting" },
            { rank: 4, title: "School Counsellor + Creative Arts", emoji: "🏫", field: "Counselling + Creative", match_pct: 68, why: "Supporting students through pastoral challenges while using creative arts as a therapeutic tool is a deeply C_E role.", stream: "Arts", salary: "₹4–9 LPA starting" },
            { rank: 5, title: "Social Media Mental Health Advocate", emoji: "📲", field: "Media + Psychology + Social", match_pct: 60, why: "Creating empathetic, creative content that supports mental health and builds community combines your dominant care and secondary creative strength.", stream: "Arts", salary: "₹4–12 LPA (varies)" },
          ]
        },
      };

      // Fallback chain: try ordered key → sorted 2-letter → pure dominant → A
      return P[key] || P[sorted[0][0]+sorted[1][0]] || P[[sorted[0][0],sorted[1][0]].sort().join('')] || P[sorted[0][0]] || P['A'];
    }

    const CQ_STREAM_BADGE = { 'PCM+CS': 'badge-purple', 'PCM': 'badge-blue', 'PCB': 'badge-green', 'Commerce': 'badge-orange', 'Arts': 'badge-red', 'Any': 'badge-green', 'Arts / PCB': 'badge-green', 'Arts / PCM+CS': 'badge-purple', 'PCM / Design': 'badge-blue', 'Commerce / Arts': 'badge-orange', 'Business / People': 'badge-orange', 'PCM+CS / Commerce': 'badge-purple', 'PCM+CS / Arts': 'badge-purple', 'Commerce / PCM': 'badge-orange', 'PCM / Commerce': 'badge-blue', 'PCM+CS / PCM': 'badge-purple', 'Arts / Commerce': 'badge-red', 'PCB / Arts': 'badge-green', 'PCM / Arts': 'badge-blue', 'Arts / Any': 'badge-red', 'PCM+CS or Commerce': 'badge-purple', 'PCM or Commerce': 'badge-blue', 'PCM or Arts': 'badge-blue', 'Commerce / PCM+CS': 'badge-orange', 'PCB': 'badge-green' };

    // Rehydrated on every page load so the dashboard/results/stream/progress
    // pages in APP.html can read the last quiz run.
    let appResults = loadState().appResults || null;

    // Entry point for CAREER_RESULTS.html
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
