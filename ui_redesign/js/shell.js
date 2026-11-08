/* App shell: sidebar (≥1024px), bottom tab bar + More sheet (<1024px).
 * Intended to go live (spec §7: one source for the shell nav markup).
 *
 *   <div data-shell="app" data-active="dashboard" data-live="true"></div>
 *   CrackeerShell.render(el, { active, live, user: { name, cls, initial } })
 *   CrackeerShell.mount()   renders every [data-shell="app"] (safe to call again)
 *
 * Hooks kept from the live site: .nav-item[data-page], .user-profile[data-page="settings"],
 * .user-avatar, .user-name, #user-class, .theme-toggle, .sidebar, body.nav-open (More sheet).
 */
(function () {
  'use strict';
  var SPRITE = '../assets/icons/sprite.svg';
  var PAGES = {
    dashboard: { label: 'Home', icon: 'house', href: 'dashboard.html' },
    results: { label: 'Career Matches', icon: 'compass', href: 'career-matches.html' },
    roadmap: { label: 'Roadmap', icon: 'route', href: 'roadmap.html' },
    explorer: { label: 'Explore careers', icon: 'search', href: 'explore.html' },
    space: { label: 'Career Space', icon: 'newspaper', href: 'career-space.html' },
    contests: { label: 'Contests', icon: 'trophy', href: 'contests.html' },
    chat: { label: 'AI Chat', icon: 'message-square', href: 'chat.html' },
    settings: { label: 'Settings', icon: 'settings', href: 'settings.html' }
  };
  var GROUPS = [['My path', ['dashboard', 'results', 'roadmap']], ['Discover', ['explorer', 'space']], ['Do', ['contests', 'chat']]];
  var TABS = ['dashboard', 'roadmap', 'contests', 'chat'];
  var MORE = ['results', 'explorer', 'space', 'settings'];
  var DEFAULT_USER = { name: 'Aarav Mehta', cls: 'Class 10', initial: 'A' };

  function icon(name) {
    return '<svg class="icon" aria-hidden="true"><use href="' + SPRITE + '#i-' + name + '"/></svg>';
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function current(page, active) {
    return page === active ? ' active" aria-current="page' : '';
  }
  function themeButton(extraClass, withLabel) {
    var icons = '<span class="theme-icon-light">' + icon('moon') + '</span><span class="theme-icon-dark">' + icon('sun') + '</span>';
    return '<button class="theme-toggle ' + extraClass + '" type="button" aria-label="Switch to dark theme" aria-pressed="false">' +
      (withLabel ? '<span class="icon-tile">' + icons + '</span><span class="grow">Switch theme</span>' : icons) + '</button>';
  }

  function sidebar(o) {
    var html = '<aside class="sidebar" aria-label="Main navigation"><a class="logo sidebar-logo" href="dashboard.html">Crackeer<span class="logo-dot">.</span></a><nav class="sidebar-nav">';
    GROUPS.forEach(function (g) {
      html += '<p class="nav-group">' + g[0] + '</p>';
      g[1].forEach(function (p) {
        var d = PAGES[p];
        html += '<a class="nav-item' + current(p, o.active) + '" data-page="' + p + '" href="' + d.href + '">' + icon(d.icon) +
          '<span class="grow">' + d.label + '</span>' +
          (p === 'contests' && o.live ? '<span class="live-badge nav-live"><span class="live-dot"></span>LIVE</span>' : '') + '</a>';
      });
    });
    html += '</nav><div class="sidebar-foot">' +
      '<a class="user-profile' + current('settings', o.active) + '" data-page="settings" href="settings.html">' +
      '<span class="avatar user-avatar">' + esc(o.user.initial) + '</span>' +
      '<span class="user-meta"><span class="user-name">' + esc(o.user.name) + '</span><span id="user-class">' + esc(o.user.cls) + '</span></span></a>' +
      themeButton('btn btn-icon') + '</div></aside>';
    return html;
  }

  function tabbar(o) {
    var html = '<nav class="tabbar" aria-label="Main navigation">';
    TABS.forEach(function (p) {
      var d = PAGES[p];
      var label = p === 'dashboard' ? 'Home' : d.label;
      html += '<a class="tab' + current(p, o.active) + '" data-page="' + p + '" href="' + d.href + '">' + icon(d.icon) +
        '<span class="tab-label">' + label + '</span>' +
        (p === 'contests' && o.live ? '<span class="tab-live"><span class="tab-live-text" aria-hidden="true">LIVE</span><span class="visually-hidden">, live now</span></span>' : '') + '</a>';
    });
    var moreActive = MORE.indexOf(o.active) >= 0 ? ' active' : '';
    html += '<button class="tab tab-more' + moreActive + '" type="button" data-proto-body="nav-open" aria-controls="more-sheet" aria-expanded="false">' +
      icon('ellipsis') + '<span class="tab-label">More</span></button></nav>';
    return html;
  }

  function moreSheet(o) {
    var html = '<div class="scrim sheet-scrim" data-proto-close></div>' +
      '<div class="sheet more-sheet" id="more-sheet" role="dialog" aria-modal="true" aria-labelledby="more-title">' +
      '<div class="sheet-handle"></div>' +
      '<div class="drawer-head"><h2 class="drawer-title" id="more-title">More</h2>' +
      '<button class="btn btn-icon btn-sm" type="button" data-proto-close aria-label="Close">' + icon('x') + '</button></div>' +
      '<div class="more-list">';
    MORE.forEach(function (p) {
      var d = PAGES[p];
      html += '<a class="more-link' + current(p, o.active) + '" data-page="' + p + '" href="' + d.href + '"><span class="icon-tile">' + icon(d.icon) + '</span><span class="grow">' + d.label + '</span>' + icon('chevron-right') + '</a>';
    });
    html += themeButton('more-link', true) +
      '<a class="more-link more-logout" href="auth.html"><span class="icon-tile">' + icon('log-out') + '</span><span class="grow">Log out</span></a>' +
      '</div></div>';
    return html;
  }

  function render(el, opts) {
    opts = opts || {};
    var o = {
      active: opts.active || el.getAttribute('data-active') || 'dashboard',
      live: opts.live != null ? !!opts.live : el.getAttribute('data-live') === 'true',
      user: opts.user || DEFAULT_USER
    };
    el.classList.add('shell');
    el.innerHTML = sidebar(o) + tabbar(o) + moreSheet(o);
    document.body.classList.add('has-shell');
    if (document.body.getAttribute('data-screen') === 'chat') document.body.classList.add('shell-chat');
  }

  function mount() {
    document.querySelectorAll('[data-shell="app"]').forEach(function (el) { render(el); });
  }

  window.CrackeerShell = { render: render, mount: mount };
  document.addEventListener('DOMContentLoaded', function () {
    if (!document.querySelector('.shell')) mount();
  });
})();
