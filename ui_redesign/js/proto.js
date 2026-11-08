/* Prototype runtime — NOT shipped to the live site.
 * Each screen keeps every state in a <template data-state>. This picks one
 * (?state=), applies the theme (?theme=), optionally lengthens text marked
 * data-stress (?stress=1), and fakes the few interactions a reviewer needs
 * (theme toggle, chips, tabs, sheets and drawers, Escape to close).
 *
 * window.Proto = { setState(name), setTheme('light'|'dark'), states() }
 * Ready signal: html[data-proto-ready="1"] + 'proto:ready' event on document.
 */
(function () {
  'use strict';
  var THEME_KEY = 'careerai_theme';
  var OVERLAY_CLASSES = ['nav-open', 'ex-filters-open', 'chat-mem-open'];
  var params = new URLSearchParams(location.search);
  var html = document.documentElement;
  var current = null;
  var currentBodyClasses = [];

  function templates() {
    return Array.prototype.slice.call(document.querySelectorAll('template[data-state]'));
  }

  function setTheme(theme) {
    theme = theme === 'dark' ? 'dark' : 'light';
    html.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* private mode */ }
    document.querySelectorAll('.theme-toggle').forEach(function (b) {
      b.setAttribute('aria-pressed', String(theme === 'dark'));
      b.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    });
  }

  function stressText(root) {
    root.querySelectorAll('[data-stress]').forEach(function (el) {
      var t = el.textContent.trim();
      // Repeat the text, then add one long unbroken word and a long URL (real names and links do this).
      el.append(' ' + t + ' ' + t + ' Otorhinolaryngologists https://example.com/careers/otorhinolaryngology-head-and-neck-surgery');
    });
  }

  function setState(name) {
    var tpls = templates();
    if (!tpls.length) return;
    var tpl = tpls.filter(function (t) { return t.dataset.state === name; })[0] || tpls[0];
    var root = document.querySelector('[data-proto-root]');
    if (!root) return;
    root.replaceChildren(tpl.content.cloneNode(true));
    currentBodyClasses.concat(OVERLAY_CLASSES).forEach(function (c) { document.body.classList.remove(c); });
    currentBodyClasses = (tpl.dataset.bodyClass || '').split(/\s+/).filter(Boolean);
    currentBodyClasses.forEach(function (c) { document.body.classList.add(c); });
    current = tpl.dataset.state;
    document.body.setAttribute('data-state', current);
    if (params.get('stress') === '1') stressText(root);
    var shell = document.querySelector('[data-shell]');
    if (shell) {
      if (!shell.hasAttribute('data-default-active')) {
        shell.setAttribute('data-default-active', shell.getAttribute('data-active') || '');
        shell.setAttribute('data-default-live', shell.getAttribute('data-live') || '');
      }
      shell.setAttribute('data-active', tpl.dataset.shellActive || shell.getAttribute('data-default-active'));
      shell.setAttribute('data-live', tpl.dataset.shellLive || shell.getAttribute('data-default-live'));
    }
    if (window.CrackeerShell && typeof window.CrackeerShell.mount === 'function') window.CrackeerShell.mount();
    setTheme(html.getAttribute('data-theme'));
    syncExpanded();
    html.setAttribute('data-proto-ready', '1');
    document.dispatchEvent(new CustomEvent('proto:ready', { detail: { state: current } }));
  }

  function states() {
    return templates().map(function (t) { return { name: t.dataset.state, label: t.dataset.label || t.dataset.state }; });
  }

  function syncExpanded() {
    document.querySelectorAll('[data-proto-body]').forEach(function (b) {
      b.setAttribute('aria-expanded', String(document.body.classList.contains(b.dataset.protoBody)));
    });
  }

  function closeOverlays() {
    OVERLAY_CLASSES.forEach(function (c) { document.body.classList.remove(c); });
    syncExpanded();
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('.theme-toggle');
    if (t) { setTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); return; }

    t = e.target.closest('[data-proto-toggle]');
    if (t) {
      var target = document.getElementById(t.dataset.protoToggle);
      if (target) target.hidden = !target.hidden;
      return;
    }

    t = e.target.closest('[data-proto-body]');
    if (t) { document.body.classList.toggle(t.dataset.protoBody); syncExpanded(); return; }

    t = e.target.closest('[data-proto-close]');
    if (t) { closeOverlays(); return; }

    // Single/multi select groups: chips, quiz options. data-max caps multi.
    var item = e.target.closest('.chip, .cq-opt, .quiz-option');
    var group = item && item.closest('[data-proto-select]');
    if (group) {
      var items = Array.prototype.slice.call(group.querySelectorAll('.chip, .cq-opt, .quiz-option'));
      if (group.dataset.protoSelect === 'single') {
        items.forEach(function (i) { i.classList.toggle('selected', i === item); i.setAttribute('aria-checked', String(i === item)); });
      } else {
        var max = Number(group.dataset.max) || Infinity;
        var on = items.filter(function (i) { return i.classList.contains('selected'); });
        if (!item.classList.contains('selected') && on.length >= max) return;
        item.classList.toggle('selected');
        item.setAttribute('aria-pressed', String(item.classList.contains('selected')));
      }
      return;
    }

    // Tab-like groups: exactly one active.
    var tab = e.target.closest('.tab-btn, .seg-btn');
    var tabs = tab && tab.closest('[data-proto-tabs]');
    if (tabs) {
      tabs.querySelectorAll('.tab-btn, .seg-btn').forEach(function (b) {
        b.classList.toggle('active', b === tab);
        b.setAttribute('aria-selected', String(b === tab));
      });
    }
  });

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeOverlays(); });

  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.type !== 'proto') return;
    if (d.theme) setTheme(d.theme);
    if (d.state && d.state !== current) setState(d.state);
  });

  window.Proto = { setState: setState, setTheme: setTheme, states: states };

  if (params.get('theme')) setTheme(params.get('theme'));
  setState(params.get('state'));
})();
