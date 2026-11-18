    // ══════════════════════════════════════════════════════════════
    // CAREERAI ADMIN — UI
    // pages/admin_login.html → staff login (admLogin), forgot password (admForgot, admReset)
    // pages/admin.html       → the panel: one view drawn into #adm-view,
    //                          routed by the hash (#/contests/6 …)
    // All data comes from window.CareerAPI.admin (scripts/careerapi_mock.js),
    // which mirrors the admin endpoints in careerAPI docs/database-schema.md §11.
    // ══════════════════════════════════════════════════════════════

    const ADM_PAGE = (document.body && document.body.dataset.page) || '';
    const ADM_TZ = 'Asia/Kolkata';
    const ADM_AREAS = ['Logical Reasoning', 'Numerical Ability', 'Verbal Ability', 'Spatial Reasoning'];

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
    // 'YYYY-MM-DD' of an instant, in IST
    function admIstDate(t) {
      const d = new Date(t + 5.5 * 3600e3);
      return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
    }
    // ISO instant of the start of an IST day 'YYYY-MM-DD', plus whole days.
    // '' if it isn't a real date (e.g. a 5-digit year), so the API reports it
    // the way it reports a missing date instead of toISOString() throwing.
    function admIstDayIso(ymd, days) {
      const d = new Date(Date.parse(ymd + 'T00:00:00+05:30') + (days || 0) * 86400e3);
      return isNaN(d) ? '' : d.toISOString();
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
      if (err && err.status === 401) { location.replace('admin_login.html'); return true; }
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
      if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.textContent = label || 'Saving…'; }
      else { btn.disabled = false; btn.removeAttribute('aria-busy'); if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
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
        // Inside .then so a synchronous throw lands in .catch, not on a stuck button.
        Promise.resolve().then(() => opts.onSubmit(form)).then(ok => {
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
        '<button class="filter-chip' + (t.key === active ? ' active' : '') + '" role="tab" aria-selected="' + (t.key === active) + '" data-key="' + t.key + '" ' +
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
      document.getElementById('adm-login-ok').style.display = 'none';
      if (!email || !password) { box.textContent = 'Enter your email and password.'; box.style.display = 'block'; return; }
      admBusy(btn, true, 'Logging in…');
      CareerAPI.admin.login({ email: email, password: password })
        .then(() => { location.replace('admin.html'); })
        .catch(err => {
          admBusy(btn, false);
          box.textContent = err.message || 'Could not log in.';
          box.style.display = 'block';
          document.getElementById('adm-password').select();
        });
    }

    function admLogout() {
      CareerAPI.admin.logout().catch(() => { }).then(() => { location.replace('admin_login.html'); });
    }

    // ── Forgot password ──
    // Three forms on the login page: login → forgot (email) → reset (code +
    // new password) → back to login. The API answers forgot-password the
    // same way for any email, so the page never says whether one is an admin.
    const ADM_RESEND_SECONDS = 60;       // the API issues at most one code a minute
    let admResetEmail = '';
    let admResendTimer = null;

    // The form on show is in the hash (#forgot, #reset), so Back steps from
    // reset to forgot to login. mode: 'push' (default) adds a history entry,
    // 'replace' rewrites the current one, 'none' leaves history alone.
    function admAuthFromHash() {
      const h = (location.hash || '').replace(/^#\/?/, '');
      return h === 'forgot' || h === 'reset' ? h : 'login';
    }
    function admShowAuth(which, mode) {
      // The reset form needs the email the code went to, which a reload or a
      // Back/Forward onto it no longer has.
      if (which === 'reset' && !admResetEmail) { which = 'forgot'; mode = 'replace'; }
      if (mode !== 'none' && admAuthFromHash() !== which) {
        try {
          history[mode === 'replace' ? 'replaceState' : 'pushState'](null, '',
            which === 'login' ? location.pathname + location.search : '#' + which);
        } catch (e) { }
      }
      ['login', 'forgot', 'reset'].forEach(k => {
        const form = document.getElementById('adm-' + k + '-form');
        form.hidden = k !== which;
        if (k !== 'login') admClearErrors(form);
      });
      document.getElementById('adm-login-err').style.display = 'none';
      document.getElementById('adm-login-ok').style.display = 'none';
      // A password left showing shouldn't still be showing when its form returns.
      document.querySelectorAll('.password-toggle').forEach(b => togglePassword(b, true));
      const typed = document.getElementById('adm-email').value.trim();
      if (which === 'forgot') {
        const input = document.getElementById('adm-forgot-email');
        if (!input.value) input.value = admResetEmail || typed;
        input.focus();
      } else if (which === 'reset') {
        document.getElementById('adm-reset-to').textContent = admResetEmail;
        document.getElementById('adm-reset-code').focus();
      } else {
        document.getElementById(typed ? 'adm-password' : 'adm-email').focus();
      }
    }

    function admRequestCode() {
      return CareerAPI.admin.forgotPassword({ email: admResetEmail });
    }

    // Counts down on the Resend link so a click inside the API's cooldown
    // doesn't look like it sent a code when it silently didn't.
    function admStartResendTimer() {
      const btn = document.getElementById('adm-resend-btn');
      let left = ADM_RESEND_SECONDS;
      clearInterval(admResendTimer);
      const tick = () => {
        btn.disabled = left > 0;
        btn.textContent = left > 0 ? 'Resend code in ' + left + 's' : 'Resend code';
        if (left-- <= 0) clearInterval(admResendTimer);
      };
      tick();
      admResendTimer = setInterval(tick, 1000);
    }

    function admForgot(e) {
      e.preventDefault();
      const form = document.getElementById('adm-forgot-form');
      const btn = document.getElementById('adm-forgot-btn');
      const email = document.getElementById('adm-forgot-email').value.trim();
      admClearErrors(form);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        admFormError(form, { field: 'email', message: 'Enter a valid email.' });
        return;
      }
      admResetEmail = email;
      admBusy(btn, true, 'Sending…');
      admRequestCode()
        .then(() => {
          admBusy(btn, false);
          const reset = document.getElementById('adm-reset-form');
          reset.reset();
          admShowAuth('reset');
          admStartResendTimer();
        })
        .catch(err => { admBusy(btn, false); admFormError(form, err); });
    }

    function admResend() {
      const form = document.getElementById('adm-reset-form');
      const btn = document.getElementById('adm-resend-btn');
      admClearErrors(form);
      btn.disabled = true;
      btn.textContent = 'Sending…';
      admRequestCode()
        .then(() => { admStartResendTimer(); document.getElementById('adm-reset-code').focus(); })
        .catch(err => { btn.disabled = false; btn.textContent = 'Resend code'; admFormError(form, err); });
    }

    function admReset(e) {
      e.preventDefault();
      const form = document.getElementById('adm-reset-form');
      const btn = document.getElementById('adm-reset-btn');
      const code = document.getElementById('adm-reset-code').value.replace(/\s+/g, '');
      const password = document.getElementById('adm-reset-password').value;
      const confirm = document.getElementById('adm-reset-confirm').value;
      admClearErrors(form);
      if (!/^\d{6}$/.test(code)) return admFormError(form, { field: 'code', message: 'Enter the 6-digit code from the email.' });
      if (password.length < 8) return admFormError(form, { field: 'new_password', message: 'Password must be at least 8 characters.' });
      if (password.length > 200) return admFormError(form, { field: 'new_password', message: 'Password must be at most 200 characters.' });
      if (password !== confirm) return admFormError(form, { field: 'confirm', message: "The passwords don't match." });
      admBusy(btn, true, 'Resetting…');
      CareerAPI.admin.resetPassword({ email: admResetEmail, code: code, new_password: password })
        .then(() => {
          admBusy(btn, false);
          clearInterval(admResendTimer);
          form.reset();
          document.getElementById('adm-email').value = admResetEmail;
          document.getElementById('adm-password').value = '';
          admShowAuth('login', 'replace');
          const ok = document.getElementById('adm-login-ok');
          ok.textContent = 'Password changed. Log in with your new password.';
          ok.style.display = 'block';
        })
        .catch(err => {
          admBusy(btn, false);
          admFormError(form, err);
          if (err && err.code === 'invalid_code') document.getElementById('adm-reset-code').select();
        });
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
      if (!admRmLeaveOk() || !admEditorLeaveOk()) return;
      const r = admParse();
      document.querySelectorAll('.nav-item[data-view]').forEach(n => n.classList.toggle('active', n.dataset.view === r.view));
      admCloseModal();
      window.scrollTo(0, 0);
      const seq = ++admRenderSeq;
      admView().innerHTML = '<div class="adm-loading">Loading…</div>';
      const views = {
        overview: admOverview, contests: r.id ? admContestEditor : admContests,
        roadmaps: r.id ? admRoadmapEditor : admRoadmaps,
        schools: r.id ? admSchoolDetail : admSchools, students: r.id ? admStudentDetail : admStudents, admins: admAdmins
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
      admPaint(seq, admErrorHtml(err));
    }
    function admErrorHtml(err) {
      return '<div class="adm-error-box">' + admEsc(err && err.message || 'Could not load this page.') + '</div>';
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
          stat(o.institutes, 'Schools and institutes') +
          stat(o.institutes_paying, 'Subscribed', 'with a current subscription') +
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
            ? '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();admRestore(\'contests\',' + c.id + ',\'Contest #' + c.id + '\',this)">Restore</button>' +
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
        // Its unsaved question edits went with it, so don't ask about them on the way out.
        done: () => { admDirty.clear(); if (admParse().id) admGo('contests'); else admRoute(); }
      });
    }

    // ── Contest editor: the "Create Contest" screen ──
    let admEditor = null;           // the contest being edited (with questions)
    const admDirty = new Set();     // positions with unsaved edits
    let admEditorHash = '';         // the editor's hash, to ask before leaving it unsaved

    function admContestEditor(r, seq) {
      admDirty.clear();
      CareerAPI.admin.contests.get(r.id).then(c => {
        if (!admPaint(seq, admEditorHtml(c))) return;
        admEditor = c;
        admEditorHash = location.hash;
        admEditorSync();
      }).catch(err => admFail(seq, err));
    }

    // Ask before leaving the editor with unsaved question edits (as admRmLeaveOk does).
    function admEditorLeaveOk() {
      if (!admDirty.size || location.hash === admEditorHash) return true;
      if (confirm('Some questions have unsaved changes. Leave without saving?')) { admDirty.clear(); return true; }
      history.replaceState(null, '', admEditorHash);
      return false;
    }

    function admEditorHtml(c) {
      const crumb = '<a href="#/contests">Contests</a> / #' + c.id;
      const sub = 'Opens ' + admEsc(admWhen(c.opens_at)) + ' · closes ' + admEsc(admWhen(c.closes_at));
      let actions = '';
      if (c.is_deleted) actions = '<button class="btn btn-primary btn-sm" onclick="admRestore(\'contests\',' + c.id + ',\'Contest #' + c.id + '\',this)">Restore</button>';
      else {
        if (!c.locked && c.status === 'draft') actions += '<button class="btn btn-primary btn-sm" id="adm-schedule" onclick="admSchedule()">Schedule contest</button>';
        if (!c.locked && c.status === 'scheduled') actions += '<button class="btn btn-ghost btn-sm" onclick="admUnschedule(this)">Move back to draft</button>';
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
        // Not while a schedule request is in flight (admBusy owns it then).
        if (sch.getAttribute('aria-busy') !== 'true') sch.disabled = n !== 5;
        sch.title = n === 5 ? '' : 'Add all 5 questions first';
      }
    }

    function admSaveQuestion(e, form) {
      e.preventDefault();
      const pos = Number(form.dataset.pos);
      const d = admFormData(form);
      const btn = form.querySelector('button[type=submit]');
      const seq = admRenderSeq, sent = JSON.stringify(d);
      admClearErrors(form);
      admBusy(btn, true);
      CareerAPI.admin.contests.saveQuestion(admEditor.id, pos, {
        area: d.area, text: d.text, options: [d.opt0, d.opt1, d.opt2, d.opt3],
        correct_index: d.correct_index == null ? null : Number(d.correct_index), explanation: d.explanation
      }).then(c => {
        admBusy(btn, false);
        // Only if this contest's page is still the one on show.
        if (seq === admRenderSeq) {
          admEditor = c;
          // Edits typed while it saved are still unsaved.
          if (JSON.stringify(admFormData(form)) === sent) admDirty.delete(pos);
          admEditorSync();
        }
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
    function admUnschedule(btn) {
      const id = admEditor.id;
      admBusy(btn, true);
      CareerAPI.admin.contests.unschedule(id).then(() => {
        admToast('Contest #' + id + ' moved back to draft.');
        admRoute();
      }).catch(err => { admBusy(btn, false); if (!admAuthGuard(err)) alert(err.message); });
    }

    // ══════════════════════════════════════════════════════════════
    // ROADMAPS
    // #/roadmaps lists every career; #/roadmaps/<encoded title> edits one.
    // A save replaces the whole roadmap and students see it straight away
    // (app.html#/roadmap). The editor sends the version it opened, so if
    // another admin saved meanwhile the server refuses (409 roadmap_changed)
    // instead of silently overwriting their work.
    // ══════════════════════════════════════════════════════════════
    const ADM_RM_TEMPLATE = ['Now · Class 10', 'Class 11–12', 'Class 12 · Entrance Exams', 'College', 'First Job'];
    let admRmTab = 'all';
    let admRmQuery = '';
    let admRmList = [];
    let admRm = null;               // { career, roadmap, steps: [{ period, title, actionsText }] }
    let admRmDirty = false;
    let admRmHash = '';             // the editor's hash, to ask before leaving it unsaved

    // Only the table re-draws, so move the tab highlight here.
    function admRmTabSet(t) {
      admRmTab = t;
      admView().querySelectorAll('.adm-tabs .filter-chip').forEach(b => {
        b.classList.toggle('active', b.dataset.key === t);
        b.setAttribute('aria-selected', b.dataset.key === t);
      });
      admRmRefresh();
    }
    function admRmSearch(value) { admRmQuery = value; admRmRefresh(); }

    function admRoadmaps(r, seq) {
      CareerAPI.admin.roadmaps.list().then(res => {
        admRmList = res.careers || [];
        const missing = admRmList.filter(c => !c.has_roadmap).length;
        admPaint(seq,
          admTopbar('Roadmaps', 'The Class 10 → first job roadmap students see for each career. Saved changes are live straight away.') +
          '<div class="adm-toolbar">' +
          admTabs([{ key: 'all', label: 'All careers (' + admRmList.length + ')' }, { key: 'missing', label: 'No roadmap (' + missing + ')' }], admRmTab, 'admRmTabSet') +
          '<input class="form-input adm-search" type="search" placeholder="Search career or field" value="' + admEsc(admRmQuery) + '" oninput="admRmSearch(this.value)" /></div>' +
          '<div id="adm-list"></div>');
        admRmRefresh();
      }).catch(err => admFail(seq, err));
    }

    // Re-draws only the table, so the search box keeps focus while typing.
    function admRmRefresh() {
      const box = document.getElementById('adm-list');
      if (!box) return;
      const q = admRmQuery.trim().toLowerCase();
      const rows = admRmList
        .filter(c => admRmTab === 'all' || !c.has_roadmap)
        .filter(c => !q || (c.career + ' ' + c.field).toLowerCase().includes(q))
        .map(c => {
          const go = 'admGo(\'roadmaps/' + encodeURIComponent(c.career).replace(/'/g, '%27') + '\')';
          return '<tr class="adm-click" onclick="' + go + '">' +
            '<td><b>' + admEsc(c.emoji + ' ' + c.career) + '</b><div class="adm-sub">' + admEsc(c.field) + '</div></td>' +
            '<td>' + admEsc(c.stream) + '</td>' +
            '<td class="adm-num">' + (c.has_roadmap ? c.step_count : '<span class="badge badge-orange">None</span>') + '</td>' +
            '<td>' + (c.updated_at ? admEsc(admWhen(c.updated_at)) + '<div class="adm-sub">' + admEsc(c.updated_by || 'Initial content') + '</div>' : '—') + '</td>' +
            '<td class="adm-row-actions"><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();' + go + '">' +
            (c.has_roadmap ? 'Edit' : 'Write') + '</button></td></tr>';
        });
      box.innerHTML = admTable([{ label: 'Career' }, { label: 'Stream' }, { label: 'Stages', cls: 'adm-num' }, { label: 'Last updated' }, { label: '', cls: 'adm-row-actions' }],
        rows, q ? 'No careers match "' + admEsc(admRmQuery) + '".' : 'Every career has a roadmap. ✓');
    }

    // ── Editor ──
    function admRoadmapEditor(r, seq) {
      let title;
      try { title = decodeURIComponent(r.id); } catch (e) { title = r.id; }
      CareerAPI.admin.roadmaps.get(title).then(res => {
        if (seq !== admRenderSeq) return;
        admRmLoad(res);
        admRmHash = location.hash;
        admPaint(seq, admRmHtml());
        admRmSync();
      }).catch(err => admFail(seq, err));
    }

    function admRmLoad(res) {
      admRm = { career: res.career, roadmap: res.roadmap, steps: [] };
      admRm.steps = res.roadmap
        ? res.roadmap.steps.map(s => ({ period: s.period, title: s.title, actionsText: s.actions.join('\n') }))
        : [];
      admRmDirty = false;
    }

    function admRmHtml() {
      const c = admRm.career, rm = admRm.roadmap;
      const crumb = '<a href="#/roadmaps">Roadmaps</a> / ' + admEsc(c.title);
      const sub = admEsc(c.field + ' · ' + c.stream + ' · ' + c.salary) +
        (rm ? '<br>Last saved ' + admEsc(admWhen(rm.updated_at)) + ' by ' + admEsc(rm.updated_by || 'initial content') : '');
      const actions =
        '<button class="btn btn-ghost btn-sm" id="adm-rm-discard" onclick="admRmDiscard()">Discard changes</button>' +
        (rm ? '<button class="btn btn-danger btn-sm" onclick="admRmDelete()">Delete roadmap</button>' : '') +
        '<button class="btn btn-primary btn-sm" id="adm-rm-save" onclick="admRmSave()">Save roadmap</button>';
      let html = admTopbar(admEsc(c.emoji + ' ' + c.title) + ' <span id="adm-rm-state"></span>', sub, actions, crumb) +
        '<div class="adm-error-box" id="adm-rm-err" style="display:none;" role="alert"></div>';
      if (!rm && !admRm.steps.length) {
        return html + '<div class="adm-panel"><div class="adm-empty">This career has no roadmap yet, so students see "We\'re still writing the roadmap".<br><br>' +
          '<button class="btn btn-primary btn-sm" onclick="admRmStart()">Start with the usual 5 stages</button></div></div>';
      }
      return html + '<div class="adm-rm-layout"><div><div id="adm-rm-stages">' + admRmStagesHtml() + '</div>' +
        '<button class="btn btn-secondary btn-sm" onclick="admRmAdd()">+ Add stage</button></div>' +
        '<aside class="adm-rm-preview"><div class="adm-section-title" style="margin-top:0;">What students see</div>' +
        '<div class="timeline" id="adm-rm-preview"></div></aside></div>';
    }

    function admRmStagesHtml() {
      const n = admRm.steps.length;
      return admRm.steps.map((s, i) =>
        '<div class="adm-q adm-rm-stage">' +
        '<div class="adm-q-head"><div class="adm-q-title">Stage ' + (i + 1) + '</div><div class="adm-rm-tools">' +
        '<button class="btn btn-ghost btn-sm" type="button" onclick="admRmMove(' + i + ',-1)"' + (i === 0 ? ' disabled' : '') + ' aria-label="Move stage ' + (i + 1) + ' up">↑</button>' +
        '<button class="btn btn-ghost btn-sm" type="button" onclick="admRmMove(' + i + ',1)"' + (i === n - 1 ? ' disabled' : '') + ' aria-label="Move stage ' + (i + 1) + ' down">↓</button>' +
        '<button class="btn btn-ghost btn-sm" type="button" onclick="admRmRemove(' + i + ')"' + (n === 1 ? ' disabled' : '') + ' aria-label="Remove stage ' + (i + 1) + '">✕</button>' +
        '</div></div><div class="adm-form-grid">' +
        admRmInput(i, 'period', 'When', s.period, 60, 'e.g. Class 11–12') +
        admRmInput(i, 'title', 'Title', s.title, 150, 'e.g. Choose PCM + Computer Science') +
        '<div class="form-group adm-span"><label class="form-label">Actions <span style="font-weight:400;color:var(--muted);">· one per line, up to 10</span></label>' +
        '<textarea class="form-input" rows="4" oninput="admRmEdit(' + i + ',\'actionsText\',this.value)">' + admEsc(s.actionsText) + '</textarea></div>' +
        '</div></div>').join('');
    }
    function admRmInput(i, key, label, value, max, placeholder) {
      return '<div class="form-group"><label class="form-label">' + label + '</label>' +
        '<input class="form-input" maxlength="' + max + '" value="' + admEsc(value) + '" placeholder="' + admEsc(placeholder) + '"' +
        ' oninput="admRmEdit(' + i + ',\'' + key + '\',this.value)" /></div>';
    }

    function admRmLines(text) { return String(text || '').split('\n').map(a => a.trim()).filter(Boolean); }

    // Typing updates the state and preview without re-drawing the form (keeps focus).
    function admRmEdit(i, key, value) {
      admRm.steps[i][key] = value;
      admRmDirty = true;
      admRmSync();
    }
    function admRmRedraw() {
      const box = document.getElementById('adm-rm-stages');
      if (box) box.innerHTML = admRmStagesHtml();
      else admView().innerHTML = admRmHtml();
      admRmDirty = true;
      admRmSync();
    }
    function admRmMove(i, d) {
      const s = admRm.steps;
      [s[i], s[i + d]] = [s[i + d], s[i]];
      admRmRedraw();
    }
    function admRmRemove(i) {
      const s = admRm.steps[i];
      if ((s.title || admRmLines(s.actionsText).length) && !confirm('Remove stage ' + (i + 1) + (s.title ? ' "' + s.title + '"' : '') + '?')) return;
      admRm.steps.splice(i, 1);
      admRmRedraw();
    }
    function admRmAdd() {
      if (admRm.steps.length >= 10) { alert('A roadmap can have at most 10 stages.'); return; }
      admRm.steps.push({ period: '', title: '', actionsText: '' });
      admRmRedraw();
    }
    function admRmStart() {
      admRm.steps = ADM_RM_TEMPLATE.map(p => ({ period: p, title: '', actionsText: '' }));
      admView().innerHTML = admRmHtml();
      admRmDirty = true;
      admRmSync();
    }

    // Unsaved badge, button states and the live preview.
    function admRmSync() {
      const st = document.getElementById('adm-rm-state');
      if (st) st.innerHTML = admRmDirty ? '<span class="badge badge-orange">Unsaved changes</span>'
        : admRm.roadmap ? '<span class="badge badge-green">Live</span>' : '<span class="badge badge-orange">No roadmap</span>';
      const save = document.getElementById('adm-rm-save');
      if (save) save.disabled = !admRmDirty;
      const discard = document.getElementById('adm-rm-discard');
      if (discard) discard.disabled = !admRmDirty;
      const pv = document.getElementById('adm-rm-preview');
      if (pv) pv.innerHTML = admRm.steps.map((s, i) =>
        '<div class="tl-item' + (i === 0 ? ' done' : '') + '"><div class="tl-dot"></div><div class="tl-card">' +
        '<div class="tl-year">' + admEsc(s.period || '…') + '</div><div class="tl-title">' + admEsc(s.title || '…') + '</div>' +
        '<div class="tl-actions">' + admRmLines(s.actionsText).map(a => '<div class="tl-action">' + admEsc(a) + '</div>').join('') + '</div>' +
        '</div></div>').join('');
    }

    function admRmError(msg, reload) {
      const box = document.getElementById('adm-rm-err');
      if (!box) { alert(msg); return; }
      box.innerHTML = admEsc(msg) + (reload ? ' <button class="adm-link" onclick="admRmReload()">Reload their version</button>' : '');
      box.style.display = msg ? 'block' : 'none';
      if (msg) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function admRmSave() {
      const btn = document.getElementById('adm-rm-save');
      const steps = admRm.steps.map(s => ({ period: s.period.trim(), title: s.title.trim(), actions: admRmLines(s.actionsText) }));
      const seq = admRenderSeq;
      admRmError('');
      admBusy(btn, true);
      CareerAPI.admin.roadmaps.save(admRm.career.title, steps, admRm.roadmap ? admRm.roadmap.version : null).then(res => {
        admToast('Roadmap saved. Students see it now.');
        // Left the editor meanwhile: admRm and the page may be another view's now.
        if (seq !== admRenderSeq) return;
        admRmLoad(res);
        admView().innerHTML = admRmHtml();
        admRmSync();
      }).catch(err => {
        admBusy(btn, false);
        if (admAuthGuard(err)) return;
        if (seq !== admRenderSeq) { alert(err.message); return; }
        admRmError(err.message, err.code === 'roadmap_changed');
      });
    }

    function admRmDiscard() {
      if (!confirm('Discard your unsaved changes?')) return;
      admRmReload();
    }
    function admRmReload() {
      admRmDirty = false;
      admRoute();
    }

    function admRmDelete() {
      if (!confirm('Delete the roadmap for ' + admRm.career.title + '?\n\nStudents will see "We\'re still writing the roadmap" for this career until a new one is saved.')) return;
      CareerAPI.admin.roadmaps.remove(admRm.career.title).then(() => {
        admToast('Roadmap deleted.');
        admRmReload();
      }).catch(err => { if (!admAuthGuard(err)) admRmError(err.message); });
    }

    // Ask before leaving an editor with unsaved changes (other views, tab close).
    function admRmLeaveOk() {
      if (!admRmDirty || location.hash === admRmHash) return true;
      if (confirm('This roadmap has unsaved changes. Leave without saving?')) { admRmDirty = false; return true; }
      history.replaceState(null, '', admRmHash);
      return false;
    }
    window.addEventListener('beforeunload', e => { if (admRmDirty || admDirty.size) { e.preventDefault(); e.returnValue = ''; } });

    // ══════════════════════════════════════════════════════════════
    // SCHOOLS AND INSTITUTES (#/schools)
    // An institute (school, tuition…) sends its list of student names and
    // phone numbers. Uploading it, with the headcount and dates, creates a
    // subscription: that is what gives those students access. Their payment
    // is recorded afterwards, on the Subscriptions tab.
    // ══════════════════════════════════════════════════════════════
    let admSchoolTab = 'active';
    let admSchoolQuery = '';
    let admSearchTimer = null;
    let admListSeq = 0;             // drops search results a newer search has replaced
    const ADM_INST_TYPES = [
      { value: 'school', label: 'School' }, { value: 'tuition', label: 'Tuition' },
      { value: 'coaching', label: 'Coaching' }, { value: 'other', label: 'Other' }
    ];
    const admTypeLabel = t => (ADM_INST_TYPES.find(x => x.value === t) || { label: t }).label;

    function admPlanBadge(s) {
      const sub = s.subscription;
      if (!sub) return '<span class="badge badge-orange">No subscription</span>';
      const paid = sub.paid ? '' : ' <span class="badge badge-blue">Payment not recorded</span>';
      if (sub.active) return '<span class="badge badge-green">Until ' + admEsc(admLastDay(sub.ends_at)) + '</span>' + paid;
      if (Date.parse(sub.starts_at) > admNow()) return '<span class="badge badge-blue">From ' + admEsc(admDay(sub.starts_at)) + '</span>' + paid;
      return '<span class="badge badge-red">Expired ' + admEsc(admLastDay(sub.ends_at)) + '</span>';
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
      const seq = admRenderSeq, req = ++admListSeq;
      const latest = () => seq === admRenderSeq && req === admListSeq;
      const p = kind === 'schools' ? admSchoolRows() : admStudentRows();
      // A failed search shows its error in the table's place, keeping the search box.
      p.then(html => { if (latest()) slot.innerHTML = html; })
        .catch(err => { if (!admAuthGuard(err) && latest()) slot.innerHTML = admErrorHtml(err); });
    }

    function admSchoolRows() {
      return CareerAPI.admin.institutes.list({ deleted: admSchoolTab === 'deleted', q: admSchoolQuery }).then(list => {
        const rows = list.map(s => {
          const actions = admSchoolTab === 'deleted'
            ? '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();admRestore(\'institutes\',' + s.id + ',' + admEsc(JSON.stringify(s.name)) + ',this)">Restore</button>' +
              '<button class="btn btn-danger btn-sm" onclick="event.stopPropagation();admDeleteSchool(' + s.id + ',true)">Hard delete</button>'
            : '';
          const waiting = s.pending_count ? ' <span class="badge badge-orange">' + s.pending_count + ' waiting for approval</span>' : '';
          return '<tr class="adm-click" onclick="admGo(\'schools/' + s.id + '\')"><td><b>' + admEsc(s.name) + '</b>' + waiting + '<div class="adm-sub">' + admEsc(admTypeLabel(s.type)) + '</div></td>' +
            '<td><span class="adm-mono">' + admEsc(s.institute_code) + '</span></td>' +
            '<td>' + admEsc(s.city) + '</td>' +
            '<td>' + admStatusBadge(s) + '</td><td>' + admPlanBadge(s) + '</td>' +
            '<td class="adm-num">' + s.list_count + '</td><td class="adm-num">' + s.registered_count + '</td>' +
            (admSchoolTab === 'deleted' ? '<td class="adm-row-actions">' + actions + '</td>' : '') + '</tr>';
        });
        const head = [{ label: 'Institute' }, { label: 'Institute ID' }, { label: 'City' }, { label: 'Status' }, { label: 'Subscription' },
          { label: 'On list', cls: 'adm-num' }, { label: 'Registered', cls: 'adm-num' }];
        if (admSchoolTab === 'deleted') head.push({ label: '', cls: 'adm-row-actions' });
        return admTable(head, rows, admSchoolQuery ? 'No institutes match “' + admEsc(admSchoolQuery) + '”.'
          : admSchoolTab === 'deleted' ? 'No deleted institutes.' : 'No schools or institutes yet. Add the first one.');
      });
    }

    function admSchools(r, seq) {
      admSchoolRows().then(table => {
        admPaint(seq,
          admTopbar('Schools and institutes', 'Students can register only if they\'re on an institute\'s list, and use the app while that list\'s subscription is current.',
            admSchoolTab === 'active' ? '<button class="btn btn-primary btn-sm" onclick="admSchoolModal()">+ Add institute</button>' : '') +
          '<div class="adm-toolbar">' + admTabs([{ key: 'active', label: 'Active' }, { key: 'deleted', label: 'Deleted' }], admSchoolTab, 'admSchoolTabSet') +
          '<input class="form-input adm-search" type="search" placeholder="Search name, institute ID or city" value="' + admEsc(admSchoolQuery) + '" oninput="admSearch(\'schools\',this.value)" /></div>' +
          '<div id="adm-list">' + table + '</div>');
      }).catch(err => admFail(seq, err));
    }

    function admSchoolFields(s) {
      s = s || { type: 'school', status: 'active' };
      return '<div class="adm-form-grid">' +
        admField('Name', 'name', s.name, { span: true, placeholder: 'e.g. Delhi Public School, R.K. Puram' }) +
        admField('Institute ID', 'institute_code', s.institute_code, { mono: true, maxlength: 20, placeholder: 'e.g. DPS-RKP',
          attrs: ' style="text-transform:uppercase;" autocapitalize="characters"', hint: 'Students type this when they register. 3–20 letters, digits or dashes.' }) +
        admField('Type', 'type', s.type, { select: ADM_INST_TYPES, hint: 'A student on a school\'s list and another list sees the school on their account.' }) +
        admField('Status', 'status', s.status, { select: [{ value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended (its students lose access)' }] }) +
        admField('Students not on the list', 'accepts_requests', s.accepts_requests ? 'true' : 'false', {
          select: [{ value: 'false', label: 'Can\'t register' }, { value: 'true', label: 'Can ask to join (you approve each)' }],
          hint: 'With requests on, anyone with the Institute ID can register; their account stays inactive until you approve them on the Students list tab.' }) +
        admField('City', 'city', s.city) +
        admField('Address', 'address', s.address, { optional: true, span: true }) +
        admField('Contact details', 'contact_details', s.contact_details, { optional: true, span: true, placeholder: 'Name, phone or email of the coordinator' }) +
        '</div>';
    }
    function admSchoolModal() {
      admModal({
        title: 'Add school or institute', submit: 'Add', wide: true, body: admSchoolFields(),
        onSubmit: form => CareerAPI.admin.institutes.create(admFormData(form)).then(s => {
          admToast(s.name + ' added. Upload its student list next.');
          admGo('schools/' + s.id + '/students');
        })
      });
    }

    function admDeleteSchool(id, hardOnly, name) {
      admConfirmDelete({
        kind: 'school', name: name || 'this institute', hardOnly: hardOnly,
        run: mode => CareerAPI.admin.institutes.remove(id, mode),
        done: mode => { if (admParse().id && mode === 'hard') admGo('schools'); else admRoute(); }
      });
    }

    // ── Institute detail: Details / Students list / Subscriptions ──
    function admSchoolDetail(r, seq) {
      const tab = ['details', 'students', 'subscriptions'].includes(r.sub) ? r.sub : 'details';
      return CareerAPI.admin.institutes.get(r.id).then(s => {
        const actions = s.is_deleted
          ? '<button class="btn btn-primary btn-sm" onclick="admRestore(\'institutes\',' + s.id + ',' + admEsc(JSON.stringify(s.name)) + ',this)">Restore</button>' +
            '<button class="btn btn-danger btn-sm" onclick="admDeleteSchool(' + s.id + ',true,' + admEsc(JSON.stringify(s.name)) + ')">Hard delete</button>'
          : '<button class="btn btn-danger btn-sm" onclick="admDeleteSchool(' + s.id + ',false,' + admEsc(JSON.stringify(s.name)) + ')">Delete</button>';
        const head = admTopbar(admEsc(s.name),
          admEsc(admTypeLabel(s.type)) + ' · Institute ID <span class="adm-mono"><b>' + admEsc(s.institute_code) + '</b></span> · ' + admEsc(s.city) +
          ' &nbsp;' + admStatusBadge(s) + ' ' + admPlanBadge(s), actions, '<a href="#/schools">Schools</a> / ' + admEsc(s.institute_code)) +
          (s.is_deleted ? '<div class="adm-note adm-banner-lock">This institute is <b>soft-deleted</b>. Its subscriptions don\'t count and nobody can register through it. The list is kept.</div>' : '') +
          '<div class="lb-tabs adm-tabs" role="tablist">' +
          [['details', 'Details'], ['students', 'Students list (' + s.list_count + ')' + (s.pending_count ? ' · ' + s.pending_count + ' waiting' : '')],
            ['subscriptions', 'Subscriptions and payments']].map(t =>
            '<button class="filter-chip' + (t[0] === tab ? ' active' : '') + '" role="tab" aria-selected="' + (t[0] === tab) + '" onclick="admGo(\'schools/' + s.id + '/' + t[0] + '\')">' + admEsc(t[1]) + '</button>').join('') +
          '</div>';
        if (tab === 'details') {
          return admPaint(seq, head + '<form class="adm-panel adm-panel-pad" id="adm-school-form" novalidate onsubmit="admSaveSchool(event,' + s.id + ')">' +
            '<div class="adm-error-box" style="display:none;"></div>' + admSchoolFields(s) +
            '<div class="adm-q-foot"><button class="btn btn-primary btn-sm" type="submit">Save changes</button></div></form>');
        } else if (tab === 'students') {
          // Join requests only exist for institutes that take them (or did).
          const reqs = s.accepts_requests || s.pending_count ? CareerAPI.admin.requests.list(s.id) : Promise.resolve([]);
          return Promise.all([CareerAPI.admin.studentList.list(s.id), reqs])
            .then(([rows, requests]) => admPaint(seq, head + admRequestsHtml(s, requests) + admRosterHtml(s, rows)));
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
      CareerAPI.admin.institutes.update(id, admFormData(form)).then(() => {
        admToast('Saved.');
        admRoute();
      }).catch(err => { admBusy(btn, false); admFormError(form, err); });
    }

    // The academic year (1 Apr → 31 Mar) today falls in, as IST days.
    function admAcademicYear() {
      const today = admIstDate(admNow()).split('-').map(Number);
      const y = today[1] >= 4 ? today[0] : today[0] - 1;
      return { start: y + '-04-01', last: (y + 1) + '-03-31' };
    }

    // Students not on the list who registered with this Institute ID (institutes
    // that take requests). Their account exists but is inactive until approved:
    // approving puts them on the list, on the current subscription.
    function admRequestsHtml(s, requests) {
      if (!s.accepts_requests && !requests.length) return '';
      const rows = requests.map(q => {
        const st = q.student;
        const who = '<button class="adm-link" onclick="admGo(\'students/' + st.id + '\')">' + admEsc(st.username) + '</button>' +
          (st.is_deleted ? ' <span class="badge badge-red">Account deleted</span>' : '');
        const about = 'Class ' + admEsc(st.class) + ' · ' + admEsc(st.board) + ' · ' + admEsc(st.city) +
          (st.email ? '<div class="adm-sub">' + admEsc(st.email) + '</div>' : '');
        return '<tr><td><b>' + admEsc(q.full_name) + '</b></td><td><span class="adm-mono">' + admEsc(q.phone_no) + '</span></td>' +
          '<td>' + who + '</td><td>' + about + '</td><td>' + admEsc(admDay(q.requested_at)) + '</td>' +
          '<td class="adm-row-actions">' +
          '<button class="btn btn-primary btn-sm" onclick="admApproveRequest(' + s.id + ',' + q.id + ',' + admEsc(JSON.stringify(q.full_name)) + ',this)">Approve</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="admRejectRequest(' + s.id + ',' + q.id + ',' + admEsc(JSON.stringify(q.full_name)) + ',this)">Reject</button></td></tr>';
      });
      return '<div class="adm-section-title">Waiting for approval (' + requests.length + ')</div>' +
        '<div class="adm-note">These students aren\'t on the list but registered with Institute ID <span class="adm-mono"><b>' + admEsc(s.institute_code) +
        '</b></span>. Their account stays <b>inactive</b> until you approve it. Approving adds them to the list on the current subscription; rejecting leaves their account without this institute.</div>' +
        admTable([{ label: 'Name' }, { label: 'Phone' }, { label: 'Username' }, { label: 'Details' }, { label: 'Requested' }, { label: '', cls: 'adm-row-actions' }], rows,
          'No requests right now. Students who register with this Institute ID and aren\'t on the list show up here.') +
        '<div class="adm-section-title">Students list</div>';
    }
    function admApproveRequest(instituteId, requestId, fullName, btn) {
      admBusy(btn, true, 'Approving…');
      CareerAPI.admin.requests.approve(instituteId, requestId).then(res => {
        const sub = res.subscription;
        admToast('Approved ' + fullName + '.' + (res.student.has_access ? ' Their account is active.' : ' They still have no access: check this institute is active.') +
          (res.over_headcount ? ' The subscription now has ' + sub.students + ' students for a headcount of ' + sub.head_count + '.' : ''));
        admRoute();
      }).catch(err => { admBusy(btn, false); if (!admAuthGuard(err)) alert(err.message); });
    }
    function admRejectRequest(instituteId, requestId, fullName, btn) {
      if (!confirm('Reject ' + fullName + '\'s request? Their account stays, but without this institute\'s access.')) return;
      admBusy(btn, true, 'Rejecting…');
      CareerAPI.admin.requests.reject(instituteId, requestId).then(() => { admToast('Rejected ' + fullName + '.'); admRoute(); })
        .catch(err => { admBusy(btn, false); if (!admAuthGuard(err)) alert(err.message); });
    }

    function admRosterHtml(s, rows) {
      const list = rows.map(r => {
        const st = r.student
          ? '<span class="badge badge-green">Registered</span><div class="adm-sub">as <button class="adm-link" onclick="admGo(\'students/' + r.student.id + '\')">' + admEsc(r.student.username) + '</button></div>'
          : '<span class="badge badge-blue">Not registered yet</span>';
        const sub = !r.subscription ? '<span class="badge badge-orange">None</span>'
          : r.subscription.active ? '<span class="badge badge-green">Until ' + admEsc(admLastDay(r.subscription.ends_at)) + '</span>'
            : '<span class="badge badge-red">Ended ' + admEsc(admLastDay(r.subscription.ends_at)) + '</span>';
        return '<tr><td><b>' + admEsc(r.full_name) + '</b></td><td><span class="adm-mono">' + admEsc(r.phone_no) + '</span></td><td>' + st + '</td><td>' + sub + '</td>' +
          '<td>' + admEsc(admDay(r.created_at)) + '</td>' +
          '<td class="adm-row-actions"><button class="btn btn-ghost btn-sm" onclick="admRosterRemove(' + s.id + ',' + admEsc(JSON.stringify(r.full_name)) + ',' + admEsc(JSON.stringify(r.phone_no)) + ')">Remove</button></td></tr>';
      });
      const yr = admAcademicYear();
      const upload = s.is_deleted ? '' :
        '<form class="adm-panel adm-panel-pad" id="adm-roster-form" novalidate onsubmit="admRosterUpload(event,' + s.id + ')">' +
        '<div class="adm-error-box" style="display:none;" role="alert"></div>' +
        '<div class="adm-section-title" style="margin-top:0;">Upload a student list</div>' +
        '<div class="adm-hint" style="margin-top:0;">An .xlsx or .csv file with a <b>Name</b> column and a <b>Phone no.</b> column. ' +
        'All or nothing: if any row has a problem, or there are more students than the headcount, nobody is added. ' +
        'Uploading creates a subscription for these dates. Students already on the list move to it (a renewal).</div>' +
        '<div class="adm-form-grid">' +
        '<div class="form-group adm-span"><label class="form-label" for="adm-roster-file-input">File</label>' +
        '<input class="form-input" id="adm-roster-file-input" name="file" type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />' +
        '<div class="adm-field-err" data-err="file"></div></div>' +
        admField('Headcount', 'head_count', '', { type: 'number', attrs: ' min="1" step="1" inputmode="numeric"', placeholder: 'e.g. 120', hint: 'How many students the institute paid for.' }) +
        admField('Access starts', 'starts_at', yr.start, { type: 'date' }) +
        admField('Last day covered', 'ends_at', yr.last, { type: 'date' }) +
        '</div>' +
        '<div class="adm-actions"><span style="flex:1;"></span><button class="btn btn-primary btn-sm" type="submit">Upload list</button></div>' +
        '<div id="adm-roster-result"></div></form>';
      return '<div class="adm-note">Students register with their <b>name and phone number exactly as on this list</b> and Institute ID <span class="adm-mono"><b>' +
        admEsc(s.institute_code) + '</b></span>. Removing someone takes this institute\'s access away; their account stays.</div>' + upload +
        admTable([{ label: 'Name' }, { label: 'Phone' }, { label: 'Status' }, { label: 'Subscription' }, { label: 'Added' }, { label: '', cls: 'adm-row-actions' }], list,
          'Nobody on the list yet. Upload the file the institute sent you above.');
    }

    function admRosterUpload(e, instituteId) {
      e.preventDefault();
      const form = e.target, btn = form.querySelector('button[type=submit]');
      admClearErrors(form);
      document.getElementById('adm-roster-result').innerHTML = '';
      const file = form.querySelector('[name=file]').files[0];
      const d = admFormData(form);
      if (!file) return admFormError(form, { field: 'file', message: 'Choose the .xlsx or .csv file.' });
      const seq = admRenderSeq;     // the page the upload started on; don't paint over another
      admBusy(btn, true, 'Uploading…');
      // Dates are IST days; access ends at the start of the day after the last day covered.
      CareerAPI.admin.studentList.upload(instituteId, file, {
        head_count: d.head_count, starts_at: admIstDayIso(d.starts_at), ends_at: admIstDayIso(d.ends_at, 1)
      }).then(res => {
        admToast(res.rows + ' student' + (res.rows === 1 ? '' : 's') + ' uploaded.');
        // Re-draw the list, then show what happened under the upload box.
        admSchoolDetail({ id: instituteId, sub: 'students' }, seq).then(painted => {
          const slot = painted && document.getElementById('adm-roster-result');
          if (slot) slot.innerHTML = admRosterResult(res);
        }).catch(err => { if (!admAuthGuard(err) && seq === admRenderSeq) admBusy(btn, false); });
      }).catch(err => {
        admBusy(btn, false);
        admFormError(form, err);
        // Every bad row, so the admin can fix the file (or tell the institute).
        const bad = err.details && err.details.errors;
        if (bad && bad.length) {
          document.getElementById('adm-roster-result').innerHTML = '<div class="adm-result" style="color:var(--accent3);"><b>Rows with a problem</b><ul>' +
            bad.slice(0, 50).map(x => '<li>Row ' + x.line + ': ' + admEsc(x.reason) + (x.value ? ' <span class="adm-mono">(' + admEsc(x.value) + ')</span>' : '') + '</li>').join('') +
            (bad.length > 50 ? '<li>…and ' + (bad.length - 50) + ' more</li>' : '') + '</ul></div>';
        }
        // A school upload that would cut students off another school early.
        const early = err.details && err.details.students;
        if (early && early.length) {
          document.getElementById('adm-roster-result').innerHTML = '<div class="adm-result" style="color:var(--accent3);"><b>Still covered by another school</b><ul>' +
            early.slice(0, 50).map(x => '<li>' + admEsc(x.full_name) + ' <span class="adm-mono">' + admEsc(x.phone_no) + '</span>: ' + admEsc(x.school.name) + '</li>').join('') +
            (early.length > 50 ? '<li>…and ' + (early.length - 50) + ' more</li>' : '') + '</ul></div>';
        }
      });
    }
    function admRosterResult(res) {
      const people = (list, fn) => '<ul>' + list.slice(0, 50).map(fn).join('') +
        (list.length > 50 ? '<li>…and ' + (list.length - 50) + ' more</li>' : '') + '</ul>';
      const who = x => admEsc(x.full_name) + ' <span class="adm-mono">' + admEsc(x.phone_no) + '</span>';
      const moved = res.moved || [], old = res.matched_by_old_details || [], amb = res.ambiguous || [], off = res.deactivated || [];
      // Moves grouped by the school they came off: "3 students moved from School A".
      const bySchool = {};
      moved.forEach(x => { (bySchool[x.from.name] = bySchool[x.from.name] || []).push(x); });
      return '<div class="adm-result"><div>✅ <b>' + res.added + '</b> added to the list</div>' +
        (res.renewed ? '<div>↺ <b>' + res.renewed + '</b> already on it, moved to the new subscription</div>' : '') +
        (res.linked ? '<div>🔗 <b>' + res.linked + '</b> already had an account, linked to it (no new account made)</div>' : '') +
        Object.keys(bySchool).map(name => '<div>↪ <b>' + bySchool[name].length + '</b> student' + (bySchool[name].length === 1 ? '' : 's') +
          ' moved from ' + admEsc(name) + ' (a student can only be on one school)' + people(bySchool[name], who) + '</div>').join('') +
        (old.length ? '<div>🕘 <b>' + old.length + '</b> matched by old details (the list has their name or phone from before a correction)' +
          people(old, x => admEsc(x.uploaded_name) + ' <span class="adm-mono">' + admEsc(x.uploaded_phone) + '</span> → ' +
            '<a href="#/students/' + x.student_id + '">' + admEsc(x.current_name) + ' <span class="adm-mono">' + admEsc(x.current_phone) + '</span></a>') + '</div>' : '') +
        (amb.length ? '<div style="color:var(--accent3);">⚠ <b>' + amb.length + '</b> match old details of more than one account, so they weren\'t linked. Check them' + people(amb, who) + '</div>' : '') +
        (off.length ? '<div style="color:var(--accent3);">⛔ <b>' + off.length + '</b> deactivated: on the list, but still can\'t log in' +
          people(off, x => '<a href="#/students/' + x.student_id + '">' + who(x) + '</a>') + '</div>' : '') +
        '<div>Subscription #' + res.subscription.id + ': ' + res.subscription.head_count + ' students, ' + admEsc(admDay(res.subscription.starts_at)) +
        ' – ' + admEsc(admLastDay(res.subscription.ends_at)) + '. Record the payment on the Subscriptions tab.</div></div>';
    }
    function admRosterRemove(instituteId, fullName, phoneNo) {
      if (!confirm('Remove ' + fullName + ' (' + phoneNo + ') from this list? They lose this institute\'s access straight away.')) return;
      CareerAPI.admin.studentList.remove(instituteId, fullName, phoneNo).then(() => { admToast('Removed ' + fullName + '.'); admRoute(); })
        .catch(err => { if (!admAuthGuard(err)) alert(err.message); });
    }

    function admSubsHtml(s, rows) {
      const t = admNow();
      const list = rows.map(x => {
        const badge = x.current ? '<span class="badge badge-green">Current</span>'
          : Date.parse(x.starts_at) > t ? '<span class="badge badge-blue">Upcoming</span>' : '<span class="badge badge-purple">Past</span>';
        const p = x.payment;
        const pay = p
          ? admEsc('₹' + p.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })) + '<div class="adm-sub">' + admEsc(p.mode_of_payment) + ', ' + admEsc(admDay(p.date_of_payment)) +
            (p.transaction_id ? ' · <span class="adm-mono">' + admEsc(p.transaction_id) + '</span>' : '') + '</div>'
          : (s.is_deleted ? '<span class="badge badge-orange">Not recorded</span>'
            : '<button class="btn btn-primary btn-sm" onclick="admPaymentModal(' + s.id + ',' + x.id + ')">+ Record payment</button>');
        return '<tr><td><b>#' + x.id + '</b></td><td>' + admEsc(admDay(x.starts_at)) + ' – ' + admEsc(admLastDay(x.ends_at)) + '</td>' +
          '<td class="adm-num">' + x.students + ' / ' + x.head_count + '</td><td>' + badge + '</td><td>' + pay + '</td></tr>';
      });
      return '<div class="adm-hint">Each list upload creates a subscription. Payments are kept for tax (GST) records, even if this institute is hard-deleted. No refunds.</div>' +
        admTable([{ label: 'Subscription' }, { label: 'Covers' }, { label: 'Students / headcount', cls: 'adm-num' }, { label: '' }, { label: 'Payment' }], list,
          'No subscriptions yet. Upload a student list to create one.');
    }

    function admPaymentModal(instituteId, subscriptionId) {
      admModal({
        title: 'Record payment for subscription #' + subscriptionId, submit: 'Record payment',
        body: '<div class="adm-form-grid">' +
          admField('Amount paid (₹)', 'amount', '', { type: 'number', attrs: ' min="0" step="0.01" inputmode="decimal"', placeholder: 'e.g. 150000' }) +
          admField('Mode of payment', 'mode_of_payment', 'Bank transfer', { select: ['Bank transfer', 'UPI', 'Cheque', 'Cash', 'Razorpay', 'Other'] }) +
          admField('Date of payment', 'date_of_payment', admIstDate(admNow()), { type: 'date' }) +
          admField('Transaction ID', 'transaction_id', '', { optional: true, mono: true, placeholder: 'UTR / UPI reference / cheque no.' }) +
          '</div>',
        onSubmit: form => {
          const d = admFormData(form);
          return CareerAPI.admin.payments.create(instituteId, {
            subscription_id: subscriptionId, amount: d.amount === '' ? null : Number(d.amount),
            mode_of_payment: d.mode_of_payment, date_of_payment: d.date_of_payment, transaction_id: d.transaction_id
          }).then(() => { admToast('Payment recorded.'); admRoute(); });
        }
      });
    }

    // ══════════════════════════════════════════════════════════════
    // STUDENTS (accounts)
    // ══════════════════════════════════════════════════════════════
    let admStudentTab = 'active';
    let admStudentQuery = '';

    function admAccessBadge(a, s) {
      if (s && s.deactivation) return '<span class="badge badge-red">Deactivated</span>';
      if (a.has_access) return '<span class="badge badge-green">Active</span>';
      // Asked to join an institute that takes requests; approve it on that institute's Students list tab.
      if (a.reason === 'pending_approval') {
        return '<span class="badge badge-blue">Waiting for approval' + (a.institute ? ' (' + admEsc(a.institute.institute_code) + ')' : '') + '</span>';
      }
      if (a.reason === 'no_institute') return '<span class="badge badge-orange">On no list</span>';
      return '<span class="badge badge-orange">Inactive</span>';
    }
    function admStudentTabSet(t) { admStudentTab = t; admRoute(); }

    function admStudentRows() {
      return CareerAPI.admin.students.list({
        deleted: admStudentTab === 'deleted', deactivated: admStudentTab === 'deactivated', q: admStudentQuery
      }).then(list => {
        const rows = list.map(s => {
          const n = admEsc(JSON.stringify(s.full_name));
          const actions = s.is_deleted
            ? '<button class="btn btn-ghost btn-sm" onclick="admRestore(\'students\',' + s.id + ',' + n + ',this)">Restore</button>' +
              '<button class="btn btn-danger btn-sm" onclick="admDeleteStudent(' + s.id + ',' + n + ',true)">Hard delete</button>'
            : '<button class="btn btn-danger btn-sm" onclick="admDeleteStudent(' + s.id + ',' + n + ',false)">Delete</button>';
          return '<tr><td><button class="adm-link" onclick="admGo(\'students/' + s.id + '\')">' + admEsc(s.full_name) + '</button>' +
            '<div class="adm-sub">' + admEsc(s.username) + '</div></td>' +
            '<td><span class="adm-mono">' + admEsc(s.phone_no) + '</span>' + (s.email ? '<div class="adm-sub">' + admEsc(s.email) + '</div>' : '') + '</td>' +
            '<td>' + (s.institute ? admEsc(s.institute.name) + '<div class="adm-sub adm-mono">' + admEsc(s.institute.institute_code) + '</div>' : '<span style="color:var(--muted);">—</span>') + '</td>' +
            '<td>' + (s.is_deleted ? '<span class="badge badge-red">Deleted ' + admEsc(admDay(s.deleted_at)) + '</span> ' : '') +
            (!s.is_deleted || s.deactivation ? admAccessBadge(s.access, s) : '') + '</td>' +
            '<td class="adm-row-actions">' + actions + '</td></tr>';
        });
        return admTable([{ label: 'Student' }, { label: 'Phone / email' }, { label: 'Institute' }, { label: 'Access' }, { label: '', cls: 'adm-row-actions' }], rows,
          admStudentQuery ? 'No students match “' + admEsc(admStudentQuery) + '”.'
            : admStudentTab === 'deleted' ? 'No deleted students.'
              : admStudentTab === 'deactivated' ? 'No deactivated students.' : 'Nobody has registered yet.');
      });
    }

    function admStudents(r, seq) {
      admStudentRows().then(table => {
        admPaint(seq,
          admTopbar('Students', 'Everyone who has registered. Deleting here is a soft delete unless you choose otherwise.', '') +
          '<div class="adm-toolbar">' + admTabs([{ key: 'active', label: 'Active' }, { key: 'deactivated', label: 'Deactivated' }, { key: 'deleted', label: 'Deleted' }], admStudentTab, 'admStudentTabSet') +
          '<input class="form-input adm-search" type="search" placeholder="Search name, username, phone or email" value="' + admEsc(admStudentQuery) + '" oninput="admSearch(\'students\',this.value)" /></div>' +
          '<div id="adm-list">' + table + '</div>');
      }).catch(err => admFail(seq, err));
    }

    // A hard-deleted student's page no longer exists, so go back to the list.
    function admDeleteStudent(id, name, hardOnly) {
      admConfirmDelete({
        kind: 'student', name: name, hardOnly: hardOnly,
        run: mode => CareerAPI.admin.students.remove(id, mode),
        done: mode => { if (mode === 'hard' && admParse().id) admGo('students'); else admRoute(); }
      });
    }

    // ── One student: access, institutes, support actions and history (#/students/:id) ──
    function admStudentAccess(s) {
      const a = s.access;
      if (s.is_deleted) return 'This student is <b>soft-deleted</b>: they can\'t log in until restored.';
      if (s.deactivation) {
        const d = s.deactivation;
        return '<b>Deactivated for malpractice</b> on ' + admEsc(admDay(d.deactivated_at)) + (d.by ? ' by ' + admEsc(d.by.full_name) : '') +
          ': “' + admEsc(d.note) + '”. They can\'t log in and are hidden from leaderboards; their results are kept.';
      }
      if (a.reason === 'no_institute') return 'On no institute\'s list. They can log in but see “' + admEsc(a.message) + '”. A new institute\'s upload links them back.';
      if (a.has_access) return 'Covered by <b>' + admEsc(a.institute ? a.institute.name : 'an institute') + '</b> until ' + admEsc(admLastDay(a.ends_at)) + '.';
      return 'Inactive: none of their institutes has a current subscription. They see “' + admEsc(a.message) + '”.';
    }

    function admStudentDetail(r, seq) {
      return CareerAPI.admin.students.get(r.id).then(s => {
        const n = admEsc(JSON.stringify(s.full_name));
        const actions = (s.is_deleted
          ? '<button class="btn btn-primary btn-sm" onclick="admRestore(\'students\',' + s.id + ',' + n + ',this)">Restore</button>' +
            '<button class="btn btn-danger btn-sm" onclick="admDeleteStudent(' + s.id + ',' + n + ',true)">Hard delete</button>'
          : '<button class="btn btn-danger btn-sm" onclick="admDeleteStudent(' + s.id + ',' + n + ',false)">Delete student</button>') +
          (s.deactivation
            ? '<button class="btn btn-primary btn-sm" onclick="admReactivateModal(' + s.id + ',' + n + ')">Reactivate</button>'
            : '<button class="btn btn-danger btn-sm" onclick="admDeactivateModal(' + s.id + ')">Deactivate</button>') +
          '<button class="btn btn-ghost btn-sm" onclick="admEditDetailsModal(' + s.id + ')">Edit name / phone</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="admStudentPasswordModal(' + s.id + ',' + n + ')">Set new password</button>';
        admStudentCurrent = s;
        const list = (s.institutes || []).map(i =>
          '<tr><td><button class="adm-link" onclick="admGo(\'schools/' + i.id + '/students\')">' + admEsc(i.name) + '</button>' +
          (i.is_deleted ? ' <span class="badge badge-red">Deleted</span>' : '') + '<div class="adm-sub">' + admEsc(admTypeLabel(i.type)) + '</div></td>' +
          '<td><span class="adm-mono">' + admEsc(i.institute_code) + '</span></td>' +
          '<td>' + (!i.subscription ? '<span class="badge badge-orange">None</span>'
            : i.subscription.active ? '<span class="badge badge-green">Until ' + admEsc(admLastDay(i.subscription.ends_at)) + '</span>'
              : '<span class="badge badge-red">Ended ' + admEsc(admLastDay(i.subscription.ends_at)) + '</span>') + '</td>' +
          '<td>' + admEsc(admDay(i.registered_at)) + '</td></tr>');
        const kv = (k, v) => '<div><div class="adm-sub">' + k + '</div><div>' + v + '</div></div>';
        admPaint(seq,
          admTopbar(admEsc(s.full_name),
            'Username <span class="adm-mono"><b>' + admEsc(s.username) + '</b></span> · ' + admEsc(s.phone_no) +
            ' &nbsp;' + admAccessBadge(s.access, s), actions, '<a href="#/students">Students</a> / ' + admEsc(s.username)) +
          '<div class="adm-note' + (s.is_deleted || s.deactivation || !s.access.has_access ? ' adm-banner-lock' : '') + '">' + admStudentAccess(s) + '</div>' +
          '<div class="adm-panel adm-panel-pad"><div class="adm-form-grid">' +
          kv('Email', s.email ? admEsc(s.email) + (s.email_verified ? ' ✓' : ' <span class="adm-sub">(not confirmed)</span>') : '—') +
          kv('Class, board, city', admEsc('Class ' + s.class + ', ' + s.board + ', ' + s.city)) +
          kv('Last login', s.last_login_at ? admEsc(admWhen(s.last_login_at)) : 'Never') +
          kv('Registered', admEsc(admDay(s.created_at))) +
          ((s.old_details || []).length ? kv('Old details (uploads still match these)', s.old_details.map(o =>
            admEsc(o.full_name) + ' <span class="adm-mono">' + admEsc(o.phone_no) + '</span>').join('<br>')) : '') +
          '</div></div>' +
          '<div class="adm-section-title">Institute lists they\'re on</div>' +
          admTable([{ label: 'Institute' }, { label: 'Institute ID' }, { label: 'Subscription' }, { label: 'Registered' }], list,
            'Not on any institute\'s list any more.') +
          '<div class="adm-section-title">History</div>' + admStudentHistory(s.history || []));
      });
    }

    // What admins did to this account, and school moves, newest first.
    const ADM_EVENT_LABELS = {
      deactivated: 'Deactivated (malpractice)', reactivated: 'Reactivated', left_institute: 'Left an institute',
      details_changed: 'Name / phone corrected', password_set: 'New password set', moved_school: 'Moved school'
    };
    const ADM_MOVE_VIA = {
      upload: 'list upload', link: 'they linked it', register: 'registration', join_request: 'request approved',
      details_changed: 'details corrected', cleanup: 'one-school cleanup'
    };
    function admEventWhat(e) {
      const d = e.data || {};
      if (e.kind === 'left_institute' && d.institute) return 'Taken off ' + admEsc(d.institute.name) + '\'s list';
      if (e.kind === 'details_changed' && d.old && d.new) {
        return admEsc(d.old.full_name) + ' <span class="adm-mono">' + admEsc(d.old.phone_no) + '</span> → ' +
          admEsc(d.new.full_name) + ' <span class="adm-mono">' + admEsc(d.new.phone_no) + '</span>';
      }
      if (e.kind === 'moved_school' && d.from) {
        return 'Off ' + admEsc(d.from.name) + (d.to ? ', now on ' + admEsc(d.to.name) : '') +
          (ADM_MOVE_VIA[d.via] ? ' (' + ADM_MOVE_VIA[d.via] + ')' : '');
      }
      return '';
    }
    function admStudentHistory(events) {
      const rows = events.map(e => {
        const what = admEventWhat(e);
        return '<tr><td>' + admEsc(admWhen(e.created_at)) + '</td><td><b>' + admEsc(ADM_EVENT_LABELS[e.kind] || e.kind) + '</b>' +
          (what ? '<div class="adm-sub">' + what + '</div>' : '') + '</td>' +
          '<td>' + (e.note ? admEsc(e.note) : '<span style="color:var(--muted);">—</span>') + '</td>' +
          '<td>' + (e.admin ? admEsc(e.admin.full_name) : '<span class="adm-sub">Automatic</span>') + '</td></tr>';
      });
      return admTable([{ label: 'When' }, { label: 'What' }, { label: 'Note' }, { label: 'By' }], rows, 'Nothing recorded yet.');
    }

    let admStudentCurrent = null;   // the student on show, for the modals below

    // One button, the reason decides: left an institute takes them off that
    // list only; malpractice locks the whole account.
    function admDeactivateModal(id) {
      const s = admStudentCurrent;
      if (!s || s.id !== id) return;
      const choice = (value, title, sub, checked) => '<label class="adm-choice' + (value === 'malpractice' ? ' is-hard' : '') + '">' +
        '<input type="radio" name="choice" value="' + admEsc(value) + '"' + (checked ? ' checked' : '') + ' />' +
        '<div><div class="adm-choice-title">' + title + '</div><div class="adm-choice-sub">' + sub + '</div></div></label>';
      const lists = (s.institutes || []).filter(i => !i.is_deleted);
      admModal({
        title: 'Deactivate ' + s.full_name, submit: 'Deactivate', danger: true,
        body: '<div class="form-group"><div class="form-label">Reason</div>' +
          lists.map((i, k) => choice('left:' + i.id, 'Left ' + admEsc(i.name),
            'Removed from ' + admEsc(i.name) + '\'s list only. Their account and other lists stay; a new institute\'s upload links them back.', k === 0)).join('') +
          choice('malpractice', 'Malpractice', 'Whole account locked: signed out now, can\'t log in, hidden from leaderboards. Results are kept. Only an admin can reactivate.', !lists.length) +
          '</div>' +
          admField('Note', 'note', '', { textarea: true, rows: 2, placeholder: 'e.g. reported by the principal on 12 Nov', hint: 'Required: why, and who asked.' }),
        onSubmit: form => {
          const d = admFormData(form);
          if (!d.choice) { admFormError(form, { message: 'Pick a reason.' }); return false; }
          const body = d.choice === 'malpractice' ? { reason: 'malpractice', note: d.note }
            : { reason: 'left_institute', institute_id: Number(d.choice.slice(5)), note: d.note };
          return CareerAPI.admin.students.deactivate(id, body).then(() => {
            admToast(body.reason === 'malpractice' ? s.full_name + ' deactivated.' : s.full_name + ' taken off that list.');
            admRoute();
          });
        }
      });
    }

    function admReactivateModal(id, name) {
      admModal({
        title: 'Reactivate ' + name, submit: 'Reactivate',
        body: '<p>They can log in again and come back on leaderboards.</p>' +
          admField('Note', 'note', '', { textarea: true, rows: 2, placeholder: 'e.g. cleared after review with the school', hint: 'Required.' }),
        onSubmit: form => CareerAPI.admin.students.reactivate(id, { note: admFormData(form).note })
          .then(() => { admToast(name + ' reactivated.'); admRoute(); })
      });
    }

    // Name and phone, on the account and every list it's on. The old ones
    // are kept so uploads still recognise them.
    function admEditDetailsModal(id) {
      const s = admStudentCurrent;
      if (!s || s.id !== id) return;
      admModal({
        title: 'Edit details: ' + s.full_name, submit: 'Save',
        body: '<div class="adm-form-grid">' +
          admField('Full name', 'full_name', s.full_name, { maxlength: 80, hint: 'Was: ' + s.full_name }) +
          admField('Phone', 'phone_no', s.phone_no, { mono: true, attrs: ' inputmode="tel" maxlength="16"', hint: 'Was: ' + s.phone_no }) +
          '</div>' +
          admField('Note', 'note', '', { textarea: true, rows: 2, placeholder: 'e.g. school typo, confirmed by parent on call', hint: 'Required.' }),
        onSubmit: form => {
          const d = admFormData(form), body = { note: d.note };
          if (d.full_name.trim() !== s.full_name) body.full_name = d.full_name;
          if (d.phone_no.trim() !== s.phone_no) body.phone_no = d.phone_no;
          if (!('full_name' in body) && !('phone_no' in body)) {
            admFormError(form, { field: 'full_name', message: 'Change the name or the phone number.' });
            return false;
          }
          return CareerAPI.admin.students.editDetails(id, body).then(() => { admToast('Details updated.'); admRoute(); });
        }
      });
    }

    // For a student who can't reset it themselves (no email, or no access to it).
    function admStudentPasswordModal(id, name) {
      admModal({
        title: 'Set a new password for ' + name, submit: 'Set password',
        body: admField('New password', 'password', '', { type: 'password', attrs: ' autocomplete="new-password"', hint: 'At least 8 characters. Share it with the student securely; they\'re signed out everywhere.' }),
        onSubmit: form => CareerAPI.admin.students.setPassword(id, admFormData(form).password).then(() => { admToast('Password changed.'); })
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
          else if (admAdminTab === 'deleted') actions = '<button class="btn btn-ghost btn-sm" onclick="admRestore(\'admins\',\'' + a.id + '\',' + n + ',this)">Restore</button>' +
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
        keeps: ['Their rows on institute lists, back to “not registered”, so they can register again']
      },
      school: {
        soft: 'Its subscriptions stop counting, so its students lose its access, and nobody can register through it. The list is kept, so restoring brings everything back.',
        removes: ['Institute details', 'Its student list and subscriptions'],
        keeps: ['Payment records, kept for tax without the institute\'s name', 'Student accounts, without this institute']
      },
      contest: {
        soft: 'Hidden from students and from this list, and its week becomes free for a new contest.',
        removes: ['The contest and its questions'],
        keeps: []
      },
      admin: {
        soft: 'They can\'t log in. You can restore them.',
        removes: ['Admin account and sessions'],
        keeps: ['Contests, institutes and payments they created or recorded']
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

    function admRestore(kind, id, name, btn) {
      admBusy(btn, true, 'Restoring…');
      CareerAPI.admin[kind].restore(id).then(() => { admToast(name + ' restored.'); admRoute(); })
        .catch(err => { admBusy(btn, false); if (!admAuthGuard(err)) alert(err.message); });
    }

    // ══════════════════════════════════════════════════════════════
    // BOOT
    // ══════════════════════════════════════════════════════════════
    document.addEventListener('DOMContentLoaded', () => {
      if (ADM_PAGE === 'adminlogin') {
        // Already logged in? Skip the form.
        CareerAPI.admin.me().then(() => { location.replace('admin.html'); }).catch(() => { });
        window.addEventListener('popstate', () => admShowAuth(admAuthFromHash(), 'none'));
        // The code box holds 6 characters, but a pasted " 123456" has to lose its
        // spaces first (a maxlength would cut it to " 12345").
        const code = document.getElementById('adm-reset-code');
        code.addEventListener('input', () => {
          const v = code.value.replace(/\s+/g, '').slice(0, 6);
          if (v !== code.value) code.value = v;
        });
        if (admAuthFromHash() !== 'login') admShowAuth(admAuthFromHash(), 'none');
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
