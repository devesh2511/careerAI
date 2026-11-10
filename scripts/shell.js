/* App shell for the student app (app.html, chat.html): sidebar from 1024px up,
 * bottom tab bar + More sheet below. One source for the navigation markup.
 *
 *   <div data-shell="app" data-active="dashboard" data-live="false"></div>
 *   CrackeerShell.render(el, { active, live, user })   CrackeerShell.mount()
 *
 * Load it before script.js: it renders synchronously when it runs, because
 * script.js binds the More sheet's swipe-to-close while it is parsed.
 * Hooks kept from the old shell: .nav-item[data-page], .user-profile[data-page="settings"],
 * .user-avatar, .user-name, #user-class, .theme-toggle, body.nav-open.
 * Every control calls the existing globals: navTo, toggleSidebar, closeSidebar, toggleTheme, logout.
 */
(function () {
  'use strict';
  var SPRITE = '/assets/icons/sprite.svg';
  var PAGES = {
    dashboard: { label: 'Home', icon: 'house' },
    results: { label: 'Career Matches', icon: 'compass' },
    roadmap: { label: 'Roadmap', icon: 'route' },
    explorer: { label: 'Explore careers', icon: 'search' },
    space: { label: 'Career Space', icon: 'newspaper' },
    contests: { label: 'Contests', icon: 'trophy' },
    chat: { label: 'AI Chat', icon: 'message-square' },
    settings: { label: 'Settings', icon: 'settings' }
  };
  var GROUPS = [['My path', ['dashboard', 'results', 'roadmap']], ['Discover', ['explorer', 'space']], ['Do', ['contests', 'chat']]];
  var TABS = ['dashboard', 'roadmap', 'contests', 'chat'];
  var MORE = ['results', 'explorer', 'space', 'settings'];

  function icon(name) {
    return '<svg class="icon" aria-hidden="true"><use href="' + SPRITE + '#i-' + name + '"/></svg>';
  }
  function on(page, active) {
    return page === active ? ' active" aria-current="page' : '';
  }
  function go(page) {
    return ' type="button" data-page="' + page + '" onclick="navTo(\'' + page + '\')"';
  }
  function themeIcons() {
    return '<span class="theme-icon-light">' + icon('moon') + '</span><span class="theme-icon-dark">' + icon('sun') + '</span>';
  }

  function sidebar(o) {
    var html = '<aside class="sidebar" aria-label="Main navigation">' +
      '<div class="sidebar-top"><button class="logo sidebar-logo" type="button" onclick="navTo(\'dashboard\')"><svg class="logo-mark" viewBox="0 0 878 193" role="img" aria-label="Crackeer"><use class="logo-cut-compact" href="/assets/brand/logo.svg#logo-horizontal"/><use class="logo-cut-micro" href="/assets/brand/logo.svg#logo-horizontal-micro"/></svg></button>' +
      '<button class="theme-toggle btn btn-icon btn-sm" type="button" onclick="toggleTheme()" aria-label="Dark theme" aria-pressed="false">' + themeIcons() + '</button></div>' +
      '<nav class="sidebar-nav">';
    GROUPS.forEach(function (g) {
      html += '<p class="nav-group">' + g[0] + '</p>';
      g[1].forEach(function (p) {
        html += '<button class="nav-item' + on(p, o.active) + '"' + go(p) + '>' + icon(PAGES[p].icon) +
          '<span class="grow">' + PAGES[p].label + '</span>' +
          (p === 'contests' ? '<span class="live-badge nav-live"' + (o.live ? '' : ' hidden') + '><span class="live-dot"></span>LIVE</span>' : '') + '</button>';
      });
    });
    html += '</nav><div class="sidebar-foot">' +
      '<button class="user-profile' + on('settings', o.active) + '"' + go('settings') + '>' +
      '<span class="avatar user-avatar">?</span>' +
      '<span class="user-meta"><span class="user-name">Student</span><span id="user-class"></span></span></button>' +
      '</div></aside>';
    return html;
  }

  function tabbar(o) {
    var html = '<nav class="tabbar" aria-label="Main navigation">';
    TABS.forEach(function (p) {
      html += '<button class="tab' + on(p, o.active) + '"' + go(p) + '>' + icon(PAGES[p].icon) +
        '<span class="tab-label">' + (p === 'dashboard' ? 'Home' : PAGES[p].label) + '</span>' +
        (p === 'contests' ? '<span class="tab-live"' + (o.live ? '' : ' hidden') + '><span class="tab-live-text" aria-hidden="true">LIVE</span><span class="visually-hidden">, live now</span></span>' : '') + '</button>';
    });
    html += '<button class="tab tab-more' + (MORE.indexOf(o.active) >= 0 ? ' active' : '') + '" type="button" onclick="toggleSidebar()" aria-controls="more-sheet" aria-expanded="false">' +
      icon('ellipsis') + '<span class="tab-label">More</span></button></nav>';
    return html;
  }

  function moreSheet(o) {
    var html = '<div class="scrim sheet-scrim" onclick="closeSidebar()"></div>' +
      '<div class="sheet more-sheet" id="more-sheet" role="dialog" aria-modal="true" aria-labelledby="more-title">' +
      '<div class="sheet-handle"></div>' +
      '<div class="drawer-head"><h2 class="drawer-title" id="more-title">More</h2>' +
      '<button class="btn btn-icon btn-sm" type="button" onclick="closeSidebar()" aria-label="Close">' + icon('x') + '</button></div><div class="more-list">';
    MORE.forEach(function (p) {
      html += '<button class="more-link' + on(p, o.active) + '"' + go(p) + '><span class="icon-tile">' + icon(PAGES[p].icon) + '</span><span class="grow">' + PAGES[p].label + '</span>' + icon('chevron-right') + '</button>';
    });
    html += '<button class="theme-toggle more-link" type="button" onclick="toggleTheme()" aria-label="Dark theme" aria-pressed="false"><span class="icon-tile">' + themeIcons() + '</span><span class="grow">Dark theme</span></button>' +
      '<button class="more-link more-logout" type="button" onclick="logout()"><span class="icon-tile">' + icon('log-out') + '</span><span class="grow">Log out</span></button>' +
      '</div></div>';
    return html;
  }

  function render(el, opts) {
    opts = opts || {};
    var o = {
      active: opts.active || el.getAttribute('data-active') || 'dashboard',
      live: opts.live != null ? !!opts.live : el.getAttribute('data-live') === 'true'
    };
    el.classList.add('shell');
    el.innerHTML = sidebar(o) + tabbar(o) + moreSheet(o);
    document.body.classList.add('has-shell');
    if (document.body.getAttribute('data-page') === 'chat') document.body.classList.add('shell-chat');
  }

  function mount() {
    document.querySelectorAll('[data-shell="app"]').forEach(function (el) { if (!el.classList.contains('shell')) render(el); });
  }

  window.CrackeerShell = { render: render, mount: mount };
  mount();
})();
