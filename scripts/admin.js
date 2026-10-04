    // ══════════════════════════════════════════════════════════════
    // CAREERAI ADMIN — UI
    // pages/admin_login.html → staff login (admLogin)
    // pages/admin.html       → the panel: one view drawn into #adm-view,
    //                          routed by the hash (#/contests/6 …)
    // All data comes from window.CareerAPI.admin (scripts/careerapi_mock.js),
    // which mirrors the admin endpoints in careerAPI docs/database-schema.md §11.
    // ══════════════════════════════════════════════════════════════

    const ADM_PAGE = (document.body && document.body.dataset.page) || '';
    const ADM_TZ = 'Asia/Kolkata';
    const ADM_AREAS = ['Logical Reasoning', 'Numerical Ability', 'Verbal Ability', 'Spatial Reasoning'];
    const ADM_REASON = {
      no_school: 'No school',
      not_on_roster: 'Not on school list',
      school_not_subscribed: 'School not paying'
    };

    // ── Shared formatting ──
    function admEsc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    }
    // "Sat 10 Oct 2026, 7:00 AM IST" — contest times are always shown in IST,
    // the timezone the contest runs on, whatever the admin's laptop says.
    function admWhen(iso) {
      if (!iso) return '—';
      const d = new Date(iso);
      const day = d.toLocaleDateString('en-IN', { timeZone: ADM_TZ, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      const time = d.toLocaleTimeString('en-IN', { timeZone: ADM_TZ, hour: 'numeric', minute: '2-digit', hour12: true });
      return day + ', ' + time.toUpperCase() + ' IST';
    }
    function admDay(iso) {
      if (!iso) return '—';
      return new Date(iso).toLocaleDateString('en-IN', { timeZone: ADM_TZ, day: 'numeric', month: 'short', year: 'numeric' });
    }
    // Plan end dates are exclusive (1 Apr 00:00 IST), so show the last day covered.
    function admLastDay(iso) { return iso ? admDay(new Date(Date.parse(iso) - 1).toISOString()) : '—'; }
    function admRupees(paise) {
      return '₹' + (Number(paise || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
    }
    // 'YYYY-MM-DD' of an instant, in IST
    function admIstDate(t) {
      const d = new Date(t + 5.5 * 3600e3);
      return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
    }
    function admNow() { return window.ContestAPI ? ContestAPI.now() : Date.now(); }

    // ── Toast ──
    let admToastTimer = null;
    function admToast(msg) {
      const el = document.getElementById('adm-toast');
      if (!el) return;
      el.textContent = msg;
      el.classList.add('is-on');
      clearTimeout(admToastTimer);
      admToastTimer = setTimeout(() => el.classList.remove('is-on'), 2600);
    }

    // ── Errors ──
    // A 401 anywhere means the admin session is gone: back to the login page.
    function admAuthGuard(err) {
      if (err && err.status === 401) { location.href = 'admin_login.html'; return true; }
      return false;
    }
    // Put a server error next to its field (err.field) if the form has one,
    // otherwise in the form's general error box.
    function admFormError(root, err) {
      if (admAuthGuard(err)) return;
      admClearErrors(root);
      const msg = (err && err.message) || 'Something went wrong. Try again.';
      const slot = err && err.field && root.querySelector('[data-err="' + err.field + '"]');
      if (slot) {
        slot.textContent = msg;
        const input = root.querySelector('[name="' + err.field + '"]');
        if (input) { input.classList.add('adm-invalid'); input.focus(); }
        return;
      }
      const box = root.querySelector('.adm-error-box');
      if (box) { box.textContent = msg; box.style.display = 'block'; }
      else alert(msg);
    }
    function admClearErrors(root) {
      root.querySelectorAll('[data-err]').forEach(e => { e.textContent = ''; });
      root.querySelectorAll('.adm-invalid').forEach(e => e.classList.remove('adm-invalid'));
      const box = root.querySelector('.adm-error-box');
      if (box) { box.textContent = ''; box.style.display = 'none'; }
    }
    function admBusy(btn, on, label) {
      if (!btn) return;
      if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.textContent = label || 'Saving…'; }
      else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
    }

    // ── Modal ──
    // One modal at a time. Returns { el, close }. Escape and the overlay close it.
    let admModalEl = null;
    function admModal(opts) {
      admCloseModal();
      const ov = document.createElement('div');
      ov.className = 'adm-modal-overlay';
      ov.innerHTML =
        '<div class="adm-modal' + (opts.wide ? ' is-wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + admEsc(opts.title) + '">' +
        '<div class="adm-modal-head"><div class="adm-modal-title">' + admEsc(opts.title) + '</div>' +
        '<button class="adm-modal-close" type="button" aria-label="Close" data-close>×</button></div>' +
        '<form novalidate><div class="adm-modal-body"><div class="adm-error-box" style="display:none;" role="alert"></div>' + opts.body + '</div>' +
        '<div class="adm-modal-foot"><button class="btn btn-ghost" type="button" data-close>Cancel</button>' +
        '<button class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" type="submit" data-submit>' + admEsc(opts.submit || 'Save') + '</button></div></form></div>';
      document.body.appendChild(ov);
      admModalEl = ov;
      const form = ov.querySelector('form');
      ov.addEventListener('mousedown', e => { if (e.target === ov) admCloseModal(); });
      ov.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', admCloseModal));
      form.addEventListener('submit', e => {
        e.preventDefault();
        const btn = form.querySelector('[data-submit]');
        if (btn.disabled) return;
        admClearErrors(form);
        admBusy(btn, true, opts.busy || 'Saving…');
        Promise.resolve(opts.onSubmit(form)).then(ok => {
          if (ok !== false) admCloseModal();
          else admBusy(btn, false);
        }).catch(err => { admBusy(btn, false); admFormError(form, err); });
      });
      if (opts.onOpen) opts.onOpen(form);
      const first = form.querySelector('input:not([type=radio]):not([type=hidden]), select, textarea');
      if (first) first.focus();
      return { el: ov, form: form, close: admCloseModal };
    }
    function admCloseModal() {
      if (admModalEl) { admModalEl.remove(); admModalEl = null; }
    }
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && admModalEl) admCloseModal(); });

    // Small builders for form fields with an error slot
    function admField(label, name, value, opts) {
      opts = opts || {};
      const id = 'f-' + name + '-' + Math.random().toString(36).slice(2, 7);
      let input;
      if (opts.select) {
        input = '<select class="form-input" id="' + id + '" name="' + name + '">' +
          opts.select.map(o => {
            const v = typeof o === 'string' ? o : o.value, l = typeof o === 'string' ? o : o.label;
            return '<option value="' + admEsc(v) + '"' + (String(v) === String(value == null ? '' : value) ? ' selected' : '') + '>' + admEsc(l) + '</option>';
          }).join('') + '</select>';
      } else if (opts.textarea) {
        input = '<textarea class="form-input" id="' + id + '" name="' + name + '" rows="' + (opts.rows || 3) + '"' +
          (opts.placeholder ? ' placeholder="' + admEsc(opts.placeholder) + '"' : '') + '>' + admEsc(value) + '</textarea>';
      } else {
        input = '<input class="form-input' + (opts.mono ? ' adm-mono' : '') + '" id="' + id + '" name="' + name + '" type="' + (opts.type || 'text') + '"' +
          ' value="' + admEsc(value == null ? '' : value) + '"' +
          (opts.placeholder ? ' placeholder="' + admEsc(opts.placeholder) + '"' : '') +
          (opts.maxlength ? ' maxlength="' + opts.maxlength + '"' : '') +
          (opts.attrs || '') + ' />';
      }
      return '<div class="form-group' + (opts.span ? ' adm-span' : '') + '"><label class="form-label" for="' + id + '">' + admEsc(label) +
        (opts.optional ? ' <span style="font-weight:400;color:var(--muted);">(optional)</span>' : '') + '</label>' + input +
        (opts.hint ? '<div class="adm-hint">' + opts.hint + '</div>' : '') +
        '<div class="adm-field-err" data-err="' + name + '"></div></div>';
    }
    function admFormData(form) {
      const out = {};
      form.querySelectorAll('[name]').forEach(el => {
        if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
        else out[el.name] = el.value;
      });
      return out;
    }

    function admTabs(items, active, onclickFn) {
      return '<div class="lb-tabs adm-tabs" role="tablist">' + items.map(t =>
        '<button class="filter-chip' + (t.key === active ? ' active' : '') + '" role="tab" aria-selected="' + (t.key === active) + '" ' +
        'onclick="' + onclickFn + '(\'' + t.key + '\')">' + admEsc(t.label) + '</button>').join('') + '</div>';
    }
    function admTable(head, rows, empty) {
      if (!rows.length) return '<div class="adm-panel"><div class="adm-empty">' + empty + '</div></div>';
      return '<div class="adm-panel"><div class="adm-scroll"><table class="adm-table"><thead><tr>' +
        head.map(h => '<th' + (h.cls ? ' class="' + h.cls + '"' : '') + '>' + admEsc(h.label) + '</th>').join('') +
        '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div></div>';
    }

    // ══════════════════════════════════════════════════════════════
    // LOGIN PAGE
    // ══════════════════════════════════════════════════════════════
    function admLogin(e) {
      e.preventDefault();
      const btn = document.getElementById('adm-login-btn');
      const box = document.getElementById('adm-login-err');
      const email = document.getElementById('adm-email').value.trim();
      const password = document.getElementById('adm-password').value;
      box.style.display = 'none';
      if (!email || !password) { box.textContent = 'Enter your email and password.'; box.style.display = 'block'; return; }
      admBusy(btn, true, 'Logging in…');
      CareerAPI.admin.login({ email: email, password: password })
        .then(() => { location.href = 'admin.html'; })
        .catch(err => {
          admBusy(btn, false);
          box.textContent = err.message || 'Could not log in.';
          box.style.display = 'block';
          document.getElementById('adm-password').select();
        });
    }

    function admLogout() {
      CareerAPI.admin.logout().finally(() => { location.href = 'admin_login.html'; });
    }

    // ══════════════════════════════════════════════════════════════
    // ROUTER
    // ══════════════════════════════════════════════════════════════
    let admMe = null;
    let admRenderSeq = 0;           // drops results of a view the admin has already left
    function admView() { return document.getElementById('adm-view'); }

    function admGo(path) {
      document.body.classList.remove('nav-open');
      const h = '#/' + path;
      if (location.hash === h) admRoute(); else location.hash = h;
    }
    function admParse() {
      const parts = (location.hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
      return { view: parts[0] || 'overview', id: parts[1] || null, sub: parts[2] || null };
    }
    function admRoute() {
      const r = admParse();
      document.querySelectorAll('.nav-item[data-view]').forEach(n => n.classList.toggle('active', n.dataset.view === r.view));
      admCloseModal();
      window.scrollTo(0, 0);
      const seq = ++admRenderSeq;
      admView().innerHTML = '<div class="adm-loading">Loading…</div>';
      const views = {
        overview: admOverview, contests: r.id ? admContestEditor : admContests,
        schools: r.id ? admSchoolDetail : admSchools, students: admStudents, admins: admAdmins
      };
      const p = (views[r.view] || admOverview)(r, seq);
      if (p && p.catch) p.catch(err => admFail(seq, err));
    }
    // Paint only if this is still the latest navigation.
    function admPaint(seq, html) {
      if (seq !== admRenderSeq) return false;
      admView().innerHTML = html;
      return true;
    }
    function admFail(seq, err) {
      if (admAuthGuard(err)) return;
      admPaint(seq, '<div class="adm-error-box">' + admEsc(err && err.message || 'Could not load this page.') + '</div>');
    }
    function admTopbar(title, sub, actions, crumb) {
      return (crumb ? '<div class="adm-crumb">' + crumb + '</div>' : '') +
        '<div class="topbar"><div><div class="page-title">' + title + '</div>' +
        (sub ? '<div class="page-sub">' + sub + '</div>' : '') + '</div>' +
        (actions ? '<div class="adm-actions">' + actions + '</div>' : '') + '</div>';
    }

    // ══════════════════════════════════════════════════════════════
    // OVERVIEW
    // ══════════════════════════════════════════════════════════════
    function admOverview(r, seq) {
      CareerAPI.admin.overview().then(o => {
        const stat = (val, label, sub) => '<div class="stat-card"><div class="stat-val">' + admEsc(val) + '</div>' +
          '<div class="stat-label">' + admEsc(label) + '</div>' + (sub ? '<div class="stat-change" style="color:var(--muted);">' + sub + '</div>' : '') + '</div>';
        const pct = o.students ? Math.round(o.students_with_access / o.students * 100) : 0;
        const next = o.next_contests.map(c =>
          '<tr class="adm-click" onclick="admGo(\'contests/' + c.id + '\')"><td><b>#' + c.id + '</b></td><td>' + admEsc(admWhen(c.opens_at)) + '</td>' +
          '<td>' + admContestBadges(c) + '</td><td class="adm-num">' + c.question_count + '/5</td></tr>');
        const drafts = o.drafts_needing_questions.map(c =>
          '<tr><td><b>#' + c.id + '</b></td><td>' + admEsc(admWhen(c.opens_at)) + '</td><td class="adm-num">' + c.question_count + '/5</td>' +
          '<td class="adm-row-actions"><button class="btn btn-primary btn-sm" onclick="admGo(\'contests/' + c.id + '\')">Finish →</button></td></tr>');
        admPaint(seq,
          admTopbar('Overview', 'Welcome back, ' + admEsc(admMe ? admMe.full_name.split(' ')[0] : '') + '.', '') +
          '<div class="adm-stats">' +
          stat(o.students, 'Students') +
          stat(o.students_with_access, 'With access', pct + '% of students') +
          stat(o.students_via_school, 'Via school', 'covered by a paying school') +
          stat(o.schools, 'Schools') +
          stat(o.schools_paying, 'Paying schools', 'with an active plan') +
          '</div>' +
          '<div class="adm-section-title">Next contests</div>' +
          admTable([{ label: 'Contest' }, { label: 'Opens' }, { label: 'Status' }, { label: 'Questions', cls: 'adm-num' }], next,
            'No upcoming contests. <button class="adm-link" onclick="admGo(\'contests\')">Create one →</button>') +
          '<div class="adm-section-title">Drafts needing questions</div>' +
          admTable([{ label: 'Contest' }, { label: 'Opens' }, { label: 'Questions', cls: 'adm-num' }, { label: '' }], drafts,
            'Every upcoming contest is scheduled. ✓'));
      }).catch(err => admFail(seq, err));
    }

    // ══════════════════════════════════════════════════════════════
    // CONTESTS
    // ══════════════════════════════════════════════════════════════
    let admContestTab = 'active';
    let admContestCache = [];

    function admContestBadges(c) {
      const state = { upcoming: ['badge-blue', 'Upcoming'], open: ['badge-green', 'Open now'], closed: ['badge-purple', 'Closed'] }[c.state];
      const status = c.status === 'draft' ? '<span class="badge badge-orange">Draft</span>' : '<span class="badge badge-green">Scheduled</span>';
      return '<span class="badge ' + state[0] + '">' + state[1] + '</span> ' + (c.state === 'upcoming' ? status : '') +
        (c.is_deleted ? ' <span class="badge badge-red">Deleted</span>' : '');
    }

    function admContestTabSet(t) { admContestTab = t; admRoute(); }

    function admContests(r, seq) {
      CareerAPI.admin.contests.list({ deleted: admContestTab === 'deleted' }).then(list => {
        if (admContestTab === 'active') admContestCache = list;
        const rows = list.map(c => {
          const actions = admContestTab === 'deleted'
            ? '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();admRestore(\'contests\',' + c.id + ',\'Contest #' + c.id + '\')">Restore</button>' +
              (c.locked ? '' : '<button class="btn btn-danger btn-sm" onclick="event.stopPropagation();admDeleteContest(' + c.id + ',false,true)">Hard delete</button>')
            : '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();admGo(\'contests/' + c.id + '\')">' + (c.locked ? 'View' : 'Edit') + '</button>' +
              '<button class="btn btn-danger btn-sm" onclick="event.stopPropagation();admDeleteContest(' + c.id + ',' + c.locked + ',false)">Delete</button>';
          return '<tr class="adm-click" onclick="admGo(\'contests/' + c.id + '\')"><td><b>#' + c.id + '</b></td>' +
            '<td>' + admEsc(admWhen(c.opens_at)) + '<div class="adm-sub">closes ' + admEsc(admWhen(c.closes_at)) + '</div></td>' +
            '<td>' + admContestBadges(c) + '</td>' +
            '<td class="adm-num">' + (c.question_count === 5 ? c.question_count : '<span style="color:var(--orange-text);font-weight:700;">' + c.question_count + '</span>') + '/5</td>' +
            '<td class="adm-row-actions">' + actions + '</td></tr>';
        });
        admPaint(seq,
          admTopbar('Contests', 'Weekly aptitude contests. Each opens Saturday 7:00 AM IST and closes Sunday 7:00 PM IST.',
            admContestTab === 'active' ? '<button class="btn btn-primary btn-sm" onclick="admNewContest()">+ New contest</button>' : '') +
          admTabs([{ key: 'active', label: 'Active' }, { key: 'deleted', label: 'Deleted' }], admContestTab, 'admContestTabSet') +
          admTable([{ label: 'Contest' }, { label: 'Opens' }, { label: 'Status' }, { label: 'Questions', cls: 'adm-num' }, { label: '', cls: 'adm-row-actions' }], rows,
            admContestTab === 'deleted' ? 'No deleted contests.' : 'No contests yet. Create the first one.'));
      }).catch(err => admFail(seq, err));
    }

    // The first Saturday from today (IST) that hasn't opened and has no contest yet.
    function admNextFreeSaturday() {
      const taken = new Set(admContestCache.map(c => c.opens_at));
      let t = admNow();
      for (let i = 0; i < 400; i++, t += 86400e3) {
        const ymd = admIstDate(t), p = ymd.split('-').map(Number);
        const open = Date.UTC(p[0], p[1] - 1, p[2], 1, 30);
        if (new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay() === 6 && open > admNow() && !taken.has(new Date(open).toISOString())) return ymd;
      }
      return admIstDate(admNow());
    }
    function admSaturdayHint(form) {
      const v = form.querySelector('[name=date]').value;
      const hint = form.querySelector('#adm-sat-hint');
      if (!v) { hint.textContent = ''; return; }
      const p = v.split('-').map(Number);
      const dow = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
      const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      if (dow !== 6) { hint.innerHTML = '⚠️ That\'s a ' + names[dow] + '. Contests open on a <b>Saturday</b>.'; return; }
      const open = new Date(Date.UTC(p[0], p[1] - 1, p[2], 1, 30)).toISOString();
      hint.textContent = 'Opens ' + admWhen(open) + ' · closes ' + admWhen(new Date(Date.parse(open) + 36 * 3600e3).toISOString()) + '.';
    }
    function admNewContest() {
      admModal({
        title: 'New contest', submit: 'Create draft',
        body: admField('Saturday it opens', 'date', admNextFreeSaturday(), { type: 'date', attrs: ' oninput="admSaturdayHint(this.form)"' }) +
          '<div class="adm-hint" id="adm-sat-hint"></div>' +
          '<div class="adm-note" style="margin:14px 0 0;">The contest starts as a <b>draft</b>, which students can\'t see. Add its 5 questions, then schedule it.</div>',
        onOpen: admSaturdayHint,
        onSubmit: form => CareerAPI.admin.contests.create({ date: form.querySelector('[name=date]').value }).then(c => {
          admToast('Contest #' + c.id + ' created as a draft.');
          admGo('contests/' + c.id);
        })
      });
    }

    function admDeleteContest(id, locked, hardOnly) {
      admConfirmDelete({
        kind: 'contest', name: 'Contest #' + id, hardOnly: hardOnly, hardDisabled: locked
          ? 'This contest has opened, so students have attempts on it. It can only be soft-deleted.' : null,
        run: mode => CareerAPI.admin.contests.remove(id, mode),
        done: () => { if (admParse().id) admGo('contests'); else admRoute(); }
      });
    }

    // ── Contest editor: the "Create Contest" screen ──
    let admEditor = null;           // the contest being edited (with questions)
    const admDirty = new Set();     // positions with unsaved edits

    function admContestEditor(r, seq) {
      admDirty.clear();
      CareerAPI.admin.contests.get(r.id).then(c => {
        admEditor = c;
        if (!admPaint(seq, admEditorHtml(c))) return;
        admEditorSync();
      }).catch(err => admFail(seq, err));
    }

    function admEditorHtml(c) {
      const crumb = '<a href="#/contests">Contests</a> / #' + c.id;
      const sub = 'Opens ' + admEsc(admWhen(c.opens_at)) + ' · closes ' + admEsc(admWhen(c.closes_at));
      let actions = '';
      if (c.is_deleted) actions = '<button class="btn btn-primary btn-sm" onclick="admRestore(\'contests\',' + c.id + ',\'Contest #' + c.id + '\')">Restore</button>';
      else {
        if (!c.locked && c.status === 'draft') actions += '<button class="btn btn-primary btn-sm" id="adm-schedule" onclick="admSchedule()">Schedule contest</button>';
        if (!c.locked && c.status === 'scheduled') actions += '<button class="btn btn-ghost btn-sm" onclick="admUnschedule()">Move back to draft</button>';
        actions += '<button class="btn btn-danger btn-sm" onclick="admDeleteContest(' + c.id + ',' + c.locked + ',false)">Delete</button>';
      }
      let html = admTopbar('Contest #' + c.id + ' ' + admContestBadges(c), sub, actions, crumb);
      if (c.is_deleted) html += '<div class="adm-note adm-banner-lock">This contest is <b>soft-deleted</b>: students can\'t see it and its week is free. Restore it to bring it back.</div>';

      if (c.locked) {
        html += '<div class="adm-note adm-banner-lock">🔒 <b>Locked.</b> This contest opened on ' + admEsc(admWhen(c.opens_at)) +
          ', so its questions can no longer change. Students have already seen them.</div>';
        html += c.questions.length ? c.questions.map(q =>
          '<div class="adm-q"><div class="adm-q-head"><div class="adm-q-title">Question ' + q.position + '</div><span class="badge badge-blue">' + admEsc(q.area) + '</span></div>' +
          '<div class="adm-ro-text">' + admEsc(q.text) + '</div><div class="adm-opts">' +
          q.options.map((o, i) => '<div class="adm-ro-opt' + (i === q.correct_index ? ' is-correct' : '') + '"><b>' + 'ABCD'[i] + '.</b> ' + admEsc(o) +
            (i === q.correct_index ? ' ✓' : '') + '</div>').join('') +
          '</div><div class="adm-ro-expl"><b>Explanation:</b> ' + admEsc(q.explanation) + '</div></div>').join('')
          : '<div class="adm-panel"><div class="adm-empty">This contest had no questions.</div></div>';
        return html;
      }

      if (c.status === 'scheduled') html += '<div class="adm-note">✅ <b>Scheduled.</b> Students will see this contest when it opens. You can still edit questions until then.</div>';
      html += '<div class="adm-progress"><span id="adm-prog-label"></span><div class="adm-progress-track"><div class="adm-progress-fill" id="adm-prog-fill"></div></div></div>' +
        '<div class="adm-error-box" id="adm-editor-err" style="display:none;"></div>';
      for (let pos = 1; pos <= 5; pos++) html += admQuestionForm(pos, c.questions.find(q => q.position === pos));
      return html;
    }

    function admQuestionForm(pos, q) {
      q = q || { area: '', text: '', options: ['', '', '', ''], correct_index: null, explanation: '' };
      const opts = [0, 1, 2, 3].map(i =>
        '<label class="adm-opt' + (q.correct_index === i ? ' is-correct' : '') + '">' +
        '<input type="radio" name="correct_index" value="' + i + '"' + (q.correct_index === i ? ' checked' : '') + ' aria-label="Option ' + 'ABCD'[i] + ' is correct" />' +
        '<span class="adm-opt-letter">' + 'ABCD'[i] + '</span>' +
        '<input class="form-input" name="opt' + i + '" value="' + admEsc(q.options[i] || '') + '" placeholder="Option ' + 'ABCD'[i] + '" /></label>').join('');
      return '<form class="adm-q" id="adm-q-' + pos + '" data-pos="' + pos + '" novalidate oninput="admQuestionDirty(this)" onchange="admQuestionDirty(this)" onsubmit="admSaveQuestion(event,this)">' +
        '<div class="adm-q-head"><div class="adm-q-title">Question ' + pos + '</div><span class="adm-q-state"></span></div>' +
        '<div class="adm-form-grid">' +
        admField('Area', 'area', q.area, { select: [{ value: '', label: 'Choose an area…' }].concat(ADM_AREAS) }) +
        '<div></div>' +
        admField('Question', 'text', q.text, { textarea: true, rows: 2, span: true, placeholder: 'e.g. What comes next: 2, 6, 12, 20, …?' }) +
        '<div class="form-group adm-span"><div class="form-label">Options <span style="font-weight:400;color:var(--muted);">· select the correct one</span></div>' +
        '<div class="adm-opts">' + opts + '</div><div class="adm-field-err" data-err="options"></div><div class="adm-field-err" data-err="correct_index"></div></div>' +
        admField('Explanation', 'explanation', q.explanation, { textarea: true, rows: 2, span: true, hint: 'Shown to students with the answers after the contest closes.' }) +
        '</div><div class="adm-error-box" style="display:none;"></div>' +
        '<div class="adm-q-foot"><button class="btn btn-primary btn-sm" type="submit">Save question ' + pos + '</button></div></form>';
    }

    function admQuestionDirty(form) {
      const pos = Number(form.dataset.pos);
      admDirty.add(pos);
      form.querySelectorAll('.adm-opt').forEach(l => l.classList.toggle('is-correct', l.querySelector('input[type=radio]').checked));
      admEditorSync();
    }

    // Refresh the progress bar, per-question badges and the Schedule button.
    function admEditorSync() {
      const c = admEditor;
      if (!c || c.locked) return;
      const saved = new Set(c.questions.map(q => q.position));
      const n = saved.size;
      const label = document.getElementById('adm-prog-label');
      if (!label) return;
      label.textContent = n + '/5 questions ready';
      document.getElementById('adm-prog-fill').style.width = (n * 20) + '%';
      for (let pos = 1; pos <= 5; pos++) {
        const f = document.getElementById('adm-q-' + pos);
        const st = f.querySelector('.adm-q-state');
        f.classList.toggle('is-saved', saved.has(pos) && !admDirty.has(pos));
        st.innerHTML = admDirty.has(pos) ? '<span class="badge badge-orange">Unsaved changes</span>'
          : saved.has(pos) ? '<span class="badge badge-green">Saved ✓</span>' : '<span class="badge badge-blue">Empty</span>';
      }
      const sch = document.getElementById('adm-schedule');
      if (sch) {
        sch.disabled = n !== 5;
        sch.title = n === 5 ? '' : 'Add all 5 questions first';
      }
    }

    function admSaveQuestion(e, form) {
      e.preventDefault();
      const pos = Number(form.dataset.pos);
      const d = admFormData(form);
      const btn = form.querySelector('button[type=submit]');
      admClearErrors(form);
      admBusy(btn, true);
      CareerAPI.admin.contests.saveQuestion(admEditor.id, pos, {
        area: d.area, text: d.text, options: [d.opt0, d.opt1, d.opt2, d.opt3],
        correct_index: d.correct_index == null ? null : Number(d.correct_index), explanation: d.explanation
      }).then(c => {
        admBusy(btn, false);
        admEditor = c;
        admDirty.delete(pos);
        admEditorSync();
        admToast('Question ' + pos + ' saved.');
      }).catch(err => {
        admBusy(btn, false);
        if (err.code === 'contest_locked') { alert(err.message); admRoute(); return; }
        admFormError(form, err);
      });
    }

    function admSchedule() {
      const box = document.getElementById('adm-editor-err');
      if (admDirty.size && !confirm('Some questions have unsaved changes. Schedule with the saved versions?')) return;
      const btn = document.getElementById('adm-schedule');
      admBusy(btn, true, 'Scheduling…');
      CareerAPI.admin.contests.schedule(admEditor.id).then(() => {
        admToast('Contest #' + admEditor.id + ' scheduled.');
        admRoute();
      }).catch(err => {
        admBusy(btn, false);
        if (admAuthGuard(err)) return;
        box.textContent = err.message; box.style.display = 'block';
      });
    }
    function admUnschedule() {
      CareerAPI.admin.contests.unschedule(admEditor.id).then(() => {
        admToast('Contest #' + admEditor.id + ' moved back to draft.');
        admRoute();
      }).catch(err => { if (!admAuthGuard(err)) alert(err.message); });
    }

    // ══════════════════════════════════════════════════════════════
    // SCHOOLS
    // ══════════════════════════════════════════════════════════════
    let admSchoolTab = 'active';
    let admSchoolQuery = '';
    let admSearchTimer = null;

    function admPlanBadge(s) {
      if (!s.subscription) return '<span class="badge badge-orange">No plan</span>';
      if (s.subscription.active) return '<span class="badge badge-green">Paid until ' + admEsc(admLastDay(s.subscription.ends_at)) + '</span>';
      return '<span class="badge badge-red">Expired ' + admEsc(admLastDay(s.subscription.ends_at)) + '</span>';
    }
    function admStatusBadge(s) {
      return (s.status === 'active' ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-red">Suspended</span>') +
        (s.is_deleted ? ' <span class="badge badge-red">Deleted</span>' : '');
    }
    function admSchoolTabSet(t) { admSchoolTab = t; admRoute(); }
    function admSearch(kind, value) {
      clearTimeout(admSearchTimer);
      admSearchTimer = setTimeout(() => {
        if (kind === 'schools') admSchoolQuery = value; else admStudentQuery = value;
        admRefreshList(kind);
      }, 250);
    }
    // Re-draws only the table, so the search box keeps focus while typing.
    function admRefreshList(kind) {
      const slot = document.getElementById('adm-list');
      if (!slot) return;
      const seq = admRenderSeq;
      const p = kind === 'schools' ? admSchoolRows() : admStudentRows();
      p.then(html => { if (seq === admRenderSeq) slot.innerHTML = html; }).catch(err => admFail(seq, err));
    }

    function admSchoolRows() {
      return CareerAPI.admin.schools.list({ deleted: admSchoolTab === 'deleted', q: admSchoolQuery }).then(list => {
        const rows = list.map(s => {
          const actions = admSchoolTab === 'deleted'
            ? '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();admRestore(\'schools\',' + s.id + ',' + admEsc(JSON.stringify(s.name)) + ')">Restore</button>' +
              '<button class="btn btn-danger btn-sm" onclick="event.stopPropagation();admDeleteSchool(' + s.id + ',true)">Hard delete</button>'
            : '';
          return '<tr class="adm-click" onclick="admGo(\'schools/' + s.id + '\')"><td><b>' + admEsc(s.name) + '</b><div class="adm-sub">' + admEsc(s.board || '—') + '</div></td>' +
            '<td><span class="adm-mono">' + admEsc(s.school_code) + '</span></td>' +
            '<td>' + admEsc(s.city) + '<div class="adm-sub">' + admEsc(s.state) + '</div></td>' +
            '<td>' + admStatusBadge(s) + '</td><td>' + admPlanBadge(s) + '</td>' +
            '<td class="adm-num">' + s.roster_count + '</td><td class="adm-num">' + s.student_count + '</td>' +
            (admSchoolTab === 'deleted' ? '<td class="adm-row-actions">' + actions + '</td>' : '') + '</tr>';
        });
        const head = [{ label: 'School' }, { label: 'School ID' }, { label: 'City' }, { label: 'Status' }, { label: 'Plan' },
          { label: 'On list', cls: 'adm-num' }, { label: 'Registered', cls: 'adm-num' }];
        if (admSchoolTab === 'deleted') head.push({ label: '', cls: 'adm-row-actions' });
        return admTable(head, rows, admSchoolQuery ? 'No schools match “' + admEsc(admSchoolQuery) + '”.'
          : admSchoolTab === 'deleted' ? 'No deleted schools.' : 'No schools yet. Add the first one.');
      });
    }

    function admSchools(r, seq) {
      admSchoolRows().then(table => {
        admPaint(seq,
          admTopbar('Schools', 'Schools registered with CareerAI. A school\'s students get access when it pays and their email is on its list.',
            admSchoolTab === 'active' ? '<button class="btn btn-primary btn-sm" onclick="admSchoolModal()">+ Add school</button>' : '') +
          '<div class="adm-toolbar">' + admTabs([{ key: 'active', label: 'Active' }, { key: 'deleted', label: 'Deleted' }], admSchoolTab, 'admSchoolTabSet') +
          '<input class="form-input adm-search" type="search" placeholder="Search name, School ID or city" value="' + admEsc(admSchoolQuery) + '" oninput="admSearch(\'schools\',this.value)" /></div>' +
          '<div id="adm-list">' + table + '</div>');
      }).catch(err => admFail(seq, err));
    }

    function admSchoolFields(s) {
      s = s || { board: 'CBSE', status: 'active' };
      return '<div class="adm-form-grid">' +
        admField('School name', 'name', s.name, { span: true, placeholder: 'e.g. Delhi Public School, R.K. Puram' }) +
        admField('School ID', 'school_code', s.school_code, { mono: true, maxlength: 20, placeholder: 'e.g. DPS-RKP',
          attrs: ' style="text-transform:uppercase;" autocapitalize="characters"', hint: 'Students type this when they register. 3–20 letters, digits or dashes.' }) +
        admField('UDISE+ code', 'udise_code', s.udise_code, { optional: true, mono: true, maxlength: 11, placeholder: '11 digits' }) +
        admField('Board', 'board', s.board, { select: ['CBSE', 'ICSE', 'State Board'] }) +
        admField('Status', 'status', s.status, { select: [{ value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended (students lose school access)' }] }) +
        admField('City', 'city', s.city) +
        admField('State', 'state', s.state) +
        admField('Contact name', 'contact_name', s.contact_name, { placeholder: 'Principal or coordinator' }) +
        admField('Contact email', 'contact_email', s.contact_email, { type: 'email' }) +
        admField('Contact phone', 'contact_phone', s.contact_phone, { optional: true, type: 'tel' }) +
        '</div>';
    }
    function admSchoolModal() {
      admModal({
        title: 'Add school', submit: 'Add school', wide: true, body: admSchoolFields(),
        onSubmit: form => CareerAPI.admin.schools.create(admFormData(form)).then(s => {
          admToast(s.name + ' added.');
          admGo('schools/' + s.id + '/roster');
        })
      });
    }

    function admDeleteSchool(id, hardOnly, name) {
      admConfirmDelete({
        kind: 'school', name: name || 'this school', hardOnly: hardOnly,
        run: mode => CareerAPI.admin.schools.remove(id, mode),
        done: mode => { if (admParse().id && mode === 'hard') admGo('schools'); else admRoute(); }
      });
    }

    // ── School detail: Details / Roster / Subscriptions ──
    function admSchoolDetail(r, seq) {
      const tab = ['details', 'roster', 'subscriptions'].includes(r.sub) ? r.sub : 'details';
      return CareerAPI.admin.schools.get(r.id).then(s => {
        const actions = s.is_deleted
          ? '<button class="btn btn-primary btn-sm" onclick="admRestore(\'schools\',' + s.id + ',' + admEsc(JSON.stringify(s.name)) + ')">Restore</button>' +
            '<button class="btn btn-danger btn-sm" onclick="admDeleteSchool(' + s.id + ',true,' + admEsc(JSON.stringify(s.name)) + ')">Hard delete</button>'
          : '<button class="btn btn-danger btn-sm" onclick="admDeleteSchool(' + s.id + ',false,' + admEsc(JSON.stringify(s.name)) + ')">Delete school</button>';
        const head = admTopbar(admEsc(s.name),
          'School ID <span class="adm-mono"><b>' + admEsc(s.school_code) + '</b></span> · ' + admEsc(s.city) + ', ' + admEsc(s.state) +
          ' &nbsp;' + admStatusBadge(s) + ' ' + admPlanBadge(s), actions, '<a href="#/schools">Schools</a> / ' + admEsc(s.school_code)) +
          (s.is_deleted ? '<div class="adm-note adm-banner-lock">This school is <b>soft-deleted</b>. Its plan doesn\'t count, so its students have lost school access. The roster is kept.</div>' : '') +
          '<div class="lb-tabs adm-tabs" role="tablist">' +
          [['details', 'Details'], ['roster', 'Student list (' + s.roster_count + ')'], ['subscriptions', 'Payments']].map(t =>
            '<button class="filter-chip' + (t[0] === tab ? ' active' : '') + '" role="tab" aria-selected="' + (t[0] === tab) + '" onclick="admGo(\'schools/' + s.id + '/' + t[0] + '\')">' + admEsc(t[1]) + '</button>').join('') +
          '</div>';
        if (tab === 'details') {
          return admPaint(seq, head + '<form class="adm-panel adm-panel-pad" id="adm-school-form" novalidate onsubmit="admSaveSchool(event,' + s.id + ')">' +
            '<div class="adm-error-box" style="display:none;"></div>' + admSchoolFields(s) +
            '<div class="adm-q-foot"><button class="btn btn-primary btn-sm" type="submit">Save changes</button></div></form>');
        } else if (tab === 'roster') {
          return CareerAPI.admin.roster.list(s.id).then(rows => admPaint(seq, head + admRosterHtml(s, rows)));
        } else {
          return CareerAPI.admin.subscriptions.list(s.id).then(rows => admPaint(seq, head + admSubsHtml(s, rows)));
        }
      });
    }

    function admSaveSchool(e, id) {
      e.preventDefault();
      const form = e.target, btn = form.querySelector('button[type=submit]');
      admClearErrors(form);
      admBusy(btn, true);
      CareerAPI.admin.schools.update(id, admFormData(form)).then(s => {
        admToast('Saved.');
        admRoute();
      }).catch(err => { admBusy(btn, false); admFormError(form, err); });
    }

    function admRosterHtml(s, rows) {
      const list = rows.map(r => {
        let st;
        if (!r.student) st = '<span class="badge badge-blue">Not registered yet</span>';
        else if (r.student.linked) st = '<span class="badge badge-green">Registered</span><div class="adm-sub">' + admEsc(r.student.full_name) + '</div>';
        else st = '<span class="badge badge-orange">Registered, no School ID</span><div class="adm-sub">' + admEsc(r.student.full_name) +
          ' hasn\'t entered ' + admEsc(s.school_code) + ' yet</div>';
        return '<tr><td>' + admEsc(r.email) + '</td><td>' + st + '</td><td>' + admEsc(admDay(r.created_at)) + '</td>' +
          '<td class="adm-row-actions"><button class="btn btn-ghost btn-sm" onclick="admRosterRemove(' + s.id + ',' + admEsc(JSON.stringify(r.email)) + ')">Remove</button></td></tr>';
      });
      return '<div class="adm-note">A student gets school access when <b>all three</b> are true: they registered with School ID <span class="adm-mono"><b>' +
        admEsc(s.school_code) + '</b></span>, their email is on this list, and the school has a current plan. Removing an email takes access away straight away.</div>' +
        '<form class="adm-panel adm-panel-pad" id="adm-roster-form" novalidate onsubmit="admRosterUpload(event,' + s.id + ')">' +
        '<div class="form-group"><label class="form-label" for="adm-roster-text">Add student emails</label>' +
        '<textarea class="form-input" id="adm-roster-text" rows="4" placeholder="One email per line, or paste a CSV column. A header row like “email” is skipped."></textarea></div>' +
        '<div class="adm-actions"><label class="btn btn-ghost btn-sm" style="cursor:pointer;">📄 Choose CSV file' +
        '<input type="file" accept=".csv,.txt,text/csv,text/plain" style="display:none;" onchange="admRosterFile(this)" /></label>' +
        '<span class="adm-hint" id="adm-roster-file" style="margin:0;"></span><span style="flex:1;"></span>' +
        '<button class="btn btn-primary btn-sm" type="submit">Upload list</button></div>' +
        '<div id="adm-roster-result"></div></form>' +
        admTable([{ label: 'Email' }, { label: 'Status' }, { label: 'Added' }, { label: '', cls: 'adm-row-actions' }], list,
          'No emails yet. Paste the list the school sent you above.');
    }

    function admRosterFile(input) {
      const f = input.files && input.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        document.getElementById('adm-roster-text').value = String(reader.result || '');
        document.getElementById('adm-roster-file').textContent = f.name + ' loaded. Check it, then upload.';
      };
      reader.readAsText(f);
    }

    function admRosterUpload(e, schoolId) {
      e.preventDefault();
      const text = document.getElementById('adm-roster-text').value;
      const btn = e.target.querySelector('button[type=submit]');
      if (!text.trim()) { document.getElementById('adm-roster-text').focus(); return; }
      admBusy(btn, true, 'Uploading…');
      CareerAPI.admin.roster.upload(schoolId, text).then(res => {
        // Re-draw the list, then show what happened under the upload box.
        admSchoolDetail({ id: schoolId, sub: 'roster' }, admRenderSeq).then(painted => {
          const slot = painted && document.getElementById('adm-roster-result');
          if (slot) slot.innerHTML = admRosterResult(res);
        }).catch(err => admFail(admRenderSeq, err));
        admToast(res.added.length + ' email' + (res.added.length === 1 ? '' : 's') + ' added.');
      }).catch(err => { admBusy(btn, false); admFormError(e.target, err); });
    }
    function admRosterResult(res) {
      const li = a => '<ul>' + a.slice(0, 20).map(x => '<li>' + x + '</li>').join('') + (a.length > 20 ? '<li>…and ' + (a.length - 20) + ' more</li>' : '') + '</ul>';
      let h = '<div class="adm-result">';
      h += '<div>✅ <b>' + res.added.length + '</b> added</div>';
      if (res.already.length) h += '<div>↺ <b>' + res.already.length + '</b> already on this list</div>';
      if (res.conflicts.length) h += '<div style="color:var(--orange-text);">⚠️ <b>' + res.conflicts.length + '</b> already on another school\'s list (not moved)' +
        li(res.conflicts.map(c => admEsc(c.email) + ' — ' + admEsc(c.school))) + '</div>';
      if (res.invalid.length) h += '<div style="color:var(--accent3);">✗ <b>' + res.invalid.length + '</b> not valid emails' + li(res.invalid.map(admEsc)) + '</div>';
      return h + '</div>';
    }
    function admRosterRemove(schoolId, email) {
      if (!confirm('Remove ' + email + ' from this school\'s list? They lose school access straight away.')) return;
      CareerAPI.admin.roster.remove(schoolId, email).then(() => { admToast('Removed ' + email + '.'); admRoute(); })
        .catch(err => { if (!admAuthGuard(err)) alert(err.message); });
    }

    function admSubsHtml(s, rows) {
      const t = admNow();
      const list = rows.map(x => {
        const badge = x.current ? '<span class="badge badge-green">Current</span>'
          : Date.parse(x.starts_at) > t ? '<span class="badge badge-blue">Upcoming</span>' : '<span class="badge badge-purple">Past</span>';
        return '<tr><td>' + admEsc(admDay(x.starts_at)) + ' – ' + admEsc(admLastDay(x.ends_at)) + '</td>' +
          '<td class="adm-num">' + admEsc(admRupees(x.amount_paise)) + '</td><td>' + admEsc(x.payment_provider === 'razorpay' ? 'Razorpay' : 'Invoice / bank transfer') + '</td>' +
          '<td><span class="adm-mono">' + admEsc(x.payment_ref) + '</span></td><td>' + badge + '</td></tr>';
      });
      return '<div class="adm-toolbar"><div class="adm-hint" style="margin:0;">Payments are kept for tax (GST) records, even if this school is hard-deleted. No refunds.</div>' +
        (s.is_deleted ? '' : '<button class="btn btn-primary btn-sm" onclick="admPaymentModal(' + s.id + ')">+ Record payment</button>') + '</div>' +
        admTable([{ label: 'Covers' }, { label: 'Amount', cls: 'adm-num' }, { label: 'Paid by' }, { label: 'Reference' }, { label: '' }], list,
          'No payments recorded. Record one when the school pays, and its students get access.');
    }

    // Default to the academic year (1 Apr → 31 Mar) that today falls in.
    function admPaymentModal(schoolId) {
      const today = admIstDate(admNow()).split('-').map(Number);
      const y = today[1] >= 4 ? today[0] : today[0] - 1;
      admModal({
        title: 'Record school payment', submit: 'Record payment',
        body: '<div class="adm-form-grid">' +
          admField('Access starts', 'starts_at', y + '-04-01', { type: 'date' }) +
          admField('Last day covered', 'ends_at', (y + 1) + '-03-31', { type: 'date' }) +
          admField('Amount paid (₹)', 'amount_rupees', '', { type: 'number', attrs: ' min="0" step="1" inputmode="numeric"', placeholder: 'e.g. 150000' }) +
          admField('Paid by', 'payment_provider', 'invoice', { select: [{ value: 'invoice', label: 'Invoice / bank transfer' }, { value: 'razorpay', label: 'Razorpay' }] }) +
          admField('Invoice or payment reference', 'payment_ref', '', { span: true, mono: true, placeholder: 'e.g. INV-2026-0042' }) +
          '</div><div class="adm-hint">Students on this school\'s list get access for these dates.</div>',
        onSubmit: form => {
          const d = admFormData(form);
          // Dates are IST days; the plan ends at the start of the day after the last day covered.
          const start = d.starts_at ? new Date(Date.parse(d.starts_at + 'T00:00:00+05:30')).toISOString() : '';
          const end = d.ends_at ? new Date(Date.parse(d.ends_at + 'T00:00:00+05:30') + 86400e3).toISOString() : '';
          return CareerAPI.admin.subscriptions.create(schoolId, {
            starts_at: start, ends_at: end, amount_rupees: d.amount_rupees === '' ? NaN : d.amount_rupees,
            payment_provider: d.payment_provider, payment_ref: d.payment_ref
          }).then(() => { admToast('Payment recorded.'); admRoute(); });
        }
      });
    }

    // ══════════════════════════════════════════════════════════════
    // STUDENTS
    // ══════════════════════════════════════════════════════════════
    let admStudentTab = 'active';
    let admStudentQuery = '';

    function admAccessBadge(a) {
      if (a.has_access) return a.source === 'school' ? '<span class="badge badge-green">School</span>' : '<span class="badge badge-purple">Individual</span>';
      return '<span class="badge badge-orange">' + admEsc(ADM_REASON[a.reason] || 'No access') + '</span>';
    }
    function admStudentTabSet(t) { admStudentTab = t; admRoute(); }

    function admStudentRows() {
      return CareerAPI.admin.students.list({ deleted: admStudentTab === 'deleted', q: admStudentQuery }).then(list => {
        const rows = list.map(s => {
          const n = admEsc(JSON.stringify(s.full_name));
          const actions = admStudentTab === 'deleted'
            ? '<button class="btn btn-ghost btn-sm" onclick="admRestore(\'students\',\'' + s.id + '\',' + n + ')">Restore</button>' +
              '<button class="btn btn-danger btn-sm" onclick="admDeleteStudent(\'' + s.id + '\',' + n + ',true)">Hard delete</button>'
            : '<button class="btn btn-danger btn-sm" onclick="admDeleteStudent(\'' + s.id + '\',' + n + ',false)">Delete</button>';
          return '<tr><td><b>' + admEsc(s.full_name) + '</b><div class="adm-sub">Leaderboard: ' + admEsc(s.leaderboard_name) + '</div></td>' +
            '<td>' + admEsc(s.email) + '</td>' +
            '<td>' + (s.school ? admEsc(s.school.name) + '<div class="adm-sub adm-mono">' + admEsc(s.school.school_code) + '</div>' : '<span style="color:var(--muted);">—</span>') + '</td>' +
            '<td>' + (admStudentTab === 'deleted' ? '<span class="badge badge-red">Deleted ' + admEsc(admDay(s.deleted_at)) + '</span>' : admAccessBadge(s.access)) + '</td>' +
            '<td class="adm-row-actions">' + actions + '</td></tr>';
        });
        return admTable([{ label: 'Student' }, { label: 'Email' }, { label: 'School' }, { label: 'Access' }, { label: '', cls: 'adm-row-actions' }], rows,
          admStudentQuery ? 'No students match “' + admEsc(admStudentQuery) + '”.' : admStudentTab === 'deleted' ? 'No deleted students.' : 'No students yet.');
      });
    }

    function admStudents(r, seq) {
      admStudentRows().then(table => {
        admPaint(seq,
          admTopbar('Students', 'Everyone who has registered. Deleting here is a soft delete unless you choose otherwise.', '') +
          '<div class="adm-toolbar">' + admTabs([{ key: 'active', label: 'Active' }, { key: 'deleted', label: 'Deleted' }], admStudentTab, 'admStudentTabSet') +
          '<input class="form-input adm-search" type="search" placeholder="Search name or email" value="' + admEsc(admStudentQuery) + '" oninput="admSearch(\'students\',this.value)" /></div>' +
          '<div id="adm-list">' + table + '</div>');
      }).catch(err => admFail(seq, err));
    }

    function admDeleteStudent(id, name, hardOnly) {
      admConfirmDelete({
        kind: 'student', name: name, hardOnly: hardOnly,
        run: mode => CareerAPI.admin.students.remove(id, mode), done: () => admRoute()
      });
    }

    // ══════════════════════════════════════════════════════════════
    // ADMINS
    // ══════════════════════════════════════════════════════════════
    let admAdminTab = 'active';
    function admAdminTabSet(t) { admAdminTab = t; admRoute(); }

    function admAdmins(r, seq) {
      CareerAPI.admin.admins.list({ deleted: admAdminTab === 'deleted' }).then(list => {
        const rows = list.map(a => {
          const n = admEsc(JSON.stringify(a.full_name));
          let actions = '';
          if (a.is_me) actions = '<span class="badge badge-purple">You</span>';
          else if (admAdminTab === 'deleted') actions = '<button class="btn btn-ghost btn-sm" onclick="admRestore(\'admins\',\'' + a.id + '\',' + n + ')">Restore</button>' +
            '<button class="btn btn-danger btn-sm" onclick="admDeleteAdmin(\'' + a.id + '\',' + n + ',true)">Hard delete</button>';
          else actions = '<button class="btn btn-danger btn-sm" onclick="admDeleteAdmin(\'' + a.id + '\',' + n + ',false)">Delete</button>';
          return '<tr><td><b>' + admEsc(a.full_name) + '</b></td><td>' + admEsc(a.email) + '</td>' +
            '<td>' + (a.last_login_at ? admEsc(admWhen(a.last_login_at)) : '<span style="color:var(--muted);">Never</span>') + '</td>' +
            '<td>' + admEsc(admDay(a.created_at)) + '</td><td class="adm-row-actions">' + actions + '</td></tr>';
        });
        admPaint(seq,
          admTopbar('Admins', 'Staff who can log in to this panel. There is no public sign-up: admins add each other here.',
            admAdminTab === 'active' ? '<button class="btn btn-primary btn-sm" onclick="admAdminModal()">+ Add admin</button>' : '') +
          admTabs([{ key: 'active', label: 'Active' }, { key: 'deleted', label: 'Deleted' }], admAdminTab, 'admAdminTabSet') +
          admTable([{ label: 'Name' }, { label: 'Email' }, { label: 'Last login' }, { label: 'Added' }, { label: '', cls: 'adm-row-actions' }], rows,
            admAdminTab === 'deleted' ? 'No deleted admins.' : 'No admins.'));
      }).catch(err => admFail(seq, err));
    }

    function admAdminModal() {
      admModal({
        title: 'Add admin', submit: 'Add admin',
        body: admField('Full name', 'full_name', '') + admField('Email', 'email', '', { type: 'email', placeholder: 'name@careerai.in' }) +
          admField('Temporary password', 'password', '', { type: 'password', attrs: ' autocomplete="new-password"', hint: 'At least 8 characters. Share it with them securely.' }),
        onSubmit: form => CareerAPI.admin.admins.create(admFormData(form)).then(() => { admToast('Admin added.'); admRoute(); })
      });
    }
    function admDeleteAdmin(id, name, hardOnly) {
      admConfirmDelete({
        kind: 'admin', name: name, hardOnly: hardOnly,
        run: mode => CareerAPI.admin.admins.remove(id, mode), done: () => admRoute()
      });
    }

    // ══════════════════════════════════════════════════════════════
    // DELETE + RESTORE (schema §7)
    // ══════════════════════════════════════════════════════════════
    const ADM_DELETE_TEXT = {
      student: {
        soft: 'They can\'t log in and disappear from leaderboards and lists. You can restore them.',
        removes: ['Account and login', 'Onboarding profile and career quiz results', 'Contest attempts and answers (past leaderboards are recomputed)'],
        keeps: ['Payment records, kept for tax without the student\'s name']
      },
      school: {
        soft: 'Its plan stops counting, so its students lose school access. The student list is kept, so restoring brings everything back.',
        removes: ['School details', 'Its student email list'],
        keeps: ['Payment records, kept for tax without the school\'s name', 'Student accounts, no longer linked to a school']
      },
      contest: {
        soft: 'Hidden from students and from this list, and its week becomes free for a new contest.',
        removes: ['The contest and its questions'],
        keeps: []
      },
      admin: {
        soft: 'They can\'t log in. You can restore them.',
        removes: ['Admin account and sessions'],
        keeps: ['Contests and schools they created']
      }
    };

    function admConfirmDelete(o) {
      const t = ADM_DELETE_TEXT[o.kind];
      const hardList = '<div class="adm-hard-box" id="adm-hard-box" style="display:' + (o.hardOnly ? 'block' : 'none') + ';">' +
        '<b>Permanently removes:</b><ul>' + t.removes.map(x => '<li>' + admEsc(x) + '</li>').join('') + '</ul>' +
        (t.keeps.length ? '<b>Keeps:</b><ul>' + t.keeps.map(x => '<li>' + admEsc(x) + '</li>').join('') + '</ul>' : '') +
        admField('Type DELETE to confirm', 'confirm', '', { mono: true, attrs: ' autocomplete="off" oninput="admHardReady(this.form)"' }) + '</div>';
      const choices = o.hardOnly ? '' :
        '<label class="adm-choice"><input type="radio" name="mode" value="soft" checked onchange="admHardReady(this.form)" />' +
        '<div><div class="adm-choice-title">Soft delete (can be restored)</div><div class="adm-choice-sub">' + admEsc(t.soft) + '</div></div></label>' +
        '<label class="adm-choice is-hard"' + (o.hardDisabled ? ' style="opacity:.55;cursor:not-allowed;"' : '') + '>' +
        '<input type="radio" name="mode" value="hard"' + (o.hardDisabled ? ' disabled' : '') + ' onchange="admHardReady(this.form)" />' +
        '<div><div class="adm-choice-title">Hard delete (permanent)</div><div class="adm-choice-sub">' +
        admEsc(o.hardDisabled || 'Removes the data for good. Use only for data that isn\'t needed at all.') + '</div></div></label>';
      const m = admModal({
        title: (o.hardOnly ? 'Permanently delete ' : 'Delete ') + o.name + '?', submit: o.hardOnly ? 'Delete permanently' : 'Delete', danger: true,
        busy: 'Deleting…',
        body: (o.hardOnly ? '<input type="hidden" name="mode" value="hard" />' : '') + choices + hardList,
        onOpen: admHardReady,
        onSubmit: form => {
          const mode = admFormData(form).mode;
          return o.run(mode).then(() => {
            admToast(mode === 'hard' ? o.name + ' permanently deleted.' : o.name + ' deleted. You can restore it from the Deleted tab.');
            o.done(mode);
          });
        }
      });
      return m;
    }
    // Hard delete needs DELETE typed in; soft delete is one click.
    function admHardReady(form) {
      const mode = admFormData(form).mode;
      const box = form.querySelector('#adm-hard-box');
      const btn = form.querySelector('[data-submit]');
      box.style.display = mode === 'hard' ? 'block' : 'none';
      const typed = (form.querySelector('[name=confirm]') || {}).value || '';
      btn.disabled = mode === 'hard' && typed.trim() !== 'DELETE';
      btn.textContent = mode === 'hard' ? 'Delete permanently' : 'Delete';
    }

    function admRestore(kind, id, name) {
      CareerAPI.admin[kind].restore(id).then(() => { admToast(name + ' restored.'); admRoute(); })
        .catch(err => { if (!admAuthGuard(err)) alert(err.message); });
    }

    // ══════════════════════════════════════════════════════════════
    // BOOT
    // ══════════════════════════════════════════════════════════════
    document.addEventListener('DOMContentLoaded', () => {
      if (ADM_PAGE === 'adminlogin') {
        // Already logged in? Skip the form.
        CareerAPI.admin.me().then(() => { location.href = 'admin.html'; }).catch(() => { });
        return;
      }
      if (ADM_PAGE !== 'admin') return;
      CareerAPI.admin.me().then(res => {
        admMe = res.admin;
        document.getElementById('adm-name').textContent = admMe.full_name;
        document.getElementById('adm-avatar').textContent = (admMe.full_name || '?').trim()[0].toUpperCase();
        window.addEventListener('hashchange', admRoute);
        if (!location.hash) history.replaceState(null, '', '#/overview');
        admRoute();
      }).catch(err => { if (!admAuthGuard(err)) admView().innerHTML = '<div class="adm-error-box">' + admEsc(err.message) + '</div>'; });
    });
