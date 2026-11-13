# Crackeer UI Redesign: Live Step Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved prototype design on the real student pages. Every hook the JavaScript needs keeps working, and the admin panel stays as it is.

**Architecture:** The prototype's CSS, shell and assets are copied into the site as live files. Each student page's static HTML is rewritten from its prototype screen. The HTML-string builders in `scripts/script.js` and `scripts/contest.js` are changed to emit the prototype's markup, with every ID, `data-*`, class hook and global function name from spec Appendix A preserved.

Proof comes from three layers:
- a dependency-free hook test in the root `npm test`
- a Playwright suite that loads the real pages against stubbed API responses and runs the prototype's layout audit on every state, theme and width
- a manual smoke test against the live API at the end

**Tech Stack:** static HTML, classic (non-module) scripts, CSS custom properties. Tests use Node `node:test`. The browser suite uses `playwright-core` with the installed Chrome and `axe-core`, in `tests/browser/` only.

**Spec:** `docs/superpowers/specs/2026-11-08-ui-redesign-design.md`, §7, §8 and Appendix A.

**Approved design:** every screen and state lives in `ui_redesign/screens/*.html`; see `ui_redesign/README.md`. **The prototype markup is the markup spec for this plan.** When a task says "port state X", reproduce that state's markup, adding the live hooks listed.

**Prior notes:** the ledger `.superpowers/sdd/2026-11-08-ui-redesign-prototype/progress.md`. Read the "note for live-step plan" lines and the `Final: minor (deferred)` lines.

## Global Constraints

**Process and scope**
- **No commits** unless the user lifts the rule; the handoff asks. Each task ends at a checkpoint.
- **Fork, don't link.** `/css/*.css`, `scripts/shell.js` and `/assets/{fonts,icons,illustrations}` are copies of the prototype files. They're edited independently from Task 1 on. The prototype under `ui_redesign/` is frozen, and its own suite must keep passing untouched.
- **Admin is out of scope and must not regress.** `pages/admin.html`, `pages/admin_login.html`, `admin.css` and `scripts/admin.js` aren't edited. They keep linking `style.css`, which stays in the repo, is no longer linked by any student page, and isn't edited. Every `script.js` change must still work with the old admin shell markup: `.sidebar`, `.nav-item[data-view]`, `.sidebar-toggle`.

**Paths and loading**
- **Root-absolute asset paths everywhere:** `/css/…`, `/assets/icons/sprite.svg#i-…`, `/assets/illustrations/…`, `/scripts/…`. That includes `SPRITE` in `scripts/shell.js`. The site is always served from the root (Vercel, `vercel dev` or the test server).
- **Stylesheet order on every student page:** `/css/tokens.css`, `/css/base.css`, `/css/components.css`, `/css/layouts.css`. The first `<head>` script is the existing theme snippet, reading `localStorage.careerai_theme`, and it comes before the stylesheets.
- **Scripts stay classic, at the end of `<body>`, in their current order.** On `app.html` and `chat.html`, `/scripts/shell.js` is inserted before `script.js`. It renders synchronously when it runs, not on DOMContentLoaded, because `script.js` binds handlers when it is parsed.

**JavaScript contract**
- **Every global function name** in the survey list stays, with the same arguments. Inline `onclick` / `onsubmit` stay as the wiring mechanism. The list: navTo, show, cqStart, toggleTheme, filterChip, chipOne, togglePassword, sendSug, logout, exCloseFilters, closeSidebar, toggleSidebar, chatMemOpen, authTab, authShow, obStep, exploreStream, cqSavePdf, stEditSchool, stEditName, stEditClass, rmPick, rmExportPdf, newChat, goBack, exSetSort, exSearch, exOpenFilters, exClearSearch, exClear, cqPrev, cqNextQ, cqDownloadReport, chatSendOrStop, chatKey, chatAutosize, cdBack, authSubmit*, authResendCode, pwRender, pwShowSchoolForm, pwSetSchool, stSave*, cdOpen, spPick, spSetTab, spShow, ctInit, ctBegin, ctGo, ctPick, ctConfirm, ctSubmit, lbRender, lbSetScope, lbSetCareer, lbSetPeriod, plus the global `spCareer`.
- **`toggleBtn` is retired** together with the notification toggles (spec §5.3 #2).
- **Keep:** IDs and data attributes from spec Appendix A.1 and A.2.
- **Retire** only: `es1`–`es4`, `eval-spinner`, `eval-signals`.

**Colour and icons**
- **No colours in JS.** Builders emit classes, never `style.color` / `style.background` / `--ramp-*` / `--fill-*` / `--tint-*`, which don't exist in the new tokens. Fit levels map to `.fit-strong` (≥ 75), `.fit-good` (≥ 55) and `.fit-low`, using the same thresholds as the prototype's `fit_badge`. RIASEC colour comes from `data-dim="R|I|A|S|E|C"`.
  - **Exempt:** the chat-PDF iframe CSS (script.js ≈1386-1401, the `#ffffff` at ≈1498 and `setTextColor` at ≈1504). That document is independent of the site CSS.
- **No emoji as icons.** Icons are `<svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-NAME"/></svg>`, using names from `ui_redesign/tools/build-sprite.js`.
  - Text that comes from data (quiz areas from `riasec_engine.js`, API `emoji` fields) goes through `stripEmoji(s)` (Task 3) before it's rendered.
  - API `emoji` fields are never rendered.

**Copy**
- "about 6 minutes" and "25 questions"; no "save results later"; sentence case; no "→" glued onto button text.

## Review Focus

1. **Sparse or null API data** (`profile: null`, `result: null`, roadmap 404, careers missing salary or stream, empty leaderboard, empty news) must never print `undefined`, `NaN`, `null` or `[object Object]`. Test: `no stray nulls in any scenario`, added in Task 2 and run on every scenario.
2. **Admin regression through the shared `script.js`.** Test: `admin pages still work`, added in Task 2. `admin_login.html` renders with zero page errors. `admin.html`, with `/admin/me` stubbed, shows `.sidebar` and switches views via `admGo`.
3. **Access gating with the new CSS.** The body stays hidden until `/me/access` answers. A 401 redirects to auth, no access redirects to the paywall, and a network error shows the retry screen built from new components. Test: `access gate` in Task 3.
4. **Theme across pages.** Dark set on one page is already `data-theme="dark"` when the next page's DOM commits, and every student page has a theme toggle, including auth and the results report, which lack one today. Test: `theme persists and every page has a toggle` in Task 3.
5. **Chat streaming, then "Save this chat as PDF", with the new `.msg` markup.** Test: `chat pdf export` in Task 11. A stubbed SSE reply finishes, the save button is clicked, and jsPDF's `save` fires with no page error.

---

## File Structure

```
css/tokens.css, base.css, components.css, layouts.css   copied from ui_redesign/css (Task 1), then live-owned
assets/fonts/*, assets/icons/sprite.svg (+LICENSE.txt), assets/illustrations/* (+LICENSES.md)   copied (Task 1)
scripts/shell.js          from ui_redesign/js/shell.js, adapted for live (Task 3)
index.html, pages/{auth,paywall,onboarding,evaluation,career_quiz,ai_loading,career_results,app,chat,quiz}.html   rewritten
scripts/script.js, scripts/contest.js                    builders rewritten per task; logic unchanged
tests/hooks.test.js        spec §8.2 hook check, part of root npm test (Task 1)
tests/static.test.js       page-level rules (Task 1, tightened per task)
tests/browser/package.json, serve.js, audit.js, stub-api.js, scenarios/*.js, fixtures/*.json, pages.test.js   (Task 2)
package.json               "test": "node --test tests/*.test.js"
style.css, admin.css, pages/admin*.html, scripts/admin.js   UNCHANGED
```

### Shared interfaces

- **`stubApi(page, overrides = {}): Promise<void>`** in `tests/browser/stub-api.js`.
  - It routes `https://careerapi.vercel.app/**` and `**/chat/**`. On localhost the site calls that host directly (careerapi_mock.js:30-39, contest_api.js:28-36).
  - It answers from `fixtures/default.json`, keyed `"METHOD /path"`, e.g. `"GET /me"`, `"GET /roadmap"`, `"POST /chat/messages"`.
  - `overrides` replaces any key with `{ status, json }` or `{ status, sse: [ {event, data} ] }`. `{ abort: true }` simulates a network error.
- **`Scenario`** = `{ id, page, hash?, state, stubs?, loggedIn = true, ready, viewports? }`.
  - `page` is a path from the repo root, e.g. `'pages/app.html'`.
  - `state` names the prototype state it must look like.
  - `ready` is a CSS selector meaning "rendered".
  - `loggedIn` sets `sessionStorage.careerai_session` through `addInitScript`.
  - Scenario files live in `tests/browser/scenarios/<area>.js` and export `Scenario[]`.
- **`auditPage(page, { contrast })`:** a byte-for-byte copy of `ui_redesign/tools/audit.js`.
- **`stripEmoji(s: string): string`** in `script.js`: removes `\p{Extended_Pictographic}`, `\u200d` and `\ufe0f`, then trims.
- **`fitClass(pct: number): 'fit-strong' | 'fit-good' | 'fit-low'`** and **`fitLabel(pct: number): string`** in `script.js`. The label reads "Strong fit, 86%" / "Good fit, 69%" / "Low fit, 37%".
- **`icon(name: string, cls = 'icon'): string`** in `script.js` returns the sprite `<svg>` string. **`illo(name: string, size: 'sm'|''|'lg' = ''): string`** returns the `.illo` tile with `/assets/illustrations/<name>-<200|400>.webp` (400 for lg) and `alt=""`.

---

### Task 1: Live design system, hook test, static rules

**Files:**
- Create: `css/*` (copy), `assets/fonts/*`, `assets/icons/*`, `assets/illustrations/*` (copy), `tests/hooks.test.js`, `tests/static.test.js`
- Modify: `package.json` (test script)

**Interfaces:**
- Produces: the four live CSS files, the assets, and `npm test` running `tests/*.test.js`. Three lists are exported from `tests/static.test.js`:
  - `STUDENT_PAGES`: the 11 student page paths.
  - `FRAMES`: pages whose `<head>` and shell are migrated. They get the stylesheet and theme-snippet checks only.
  - `MIGRATED`: pages whose whole markup is migrated. They get every page check.

  `FRAMES` and `MIGRATED` both start empty, and each task appends its pages.

- [ ] **Step 1: Write `tests/hooks.test.js`.** It extracts targets from `scripts/script.js` and `scripts/contest.js`:
  - `getElementById('x')`, `querySelector(All)('#x …')` and `closest('.x')`
  - the dynamic patterns `'auth-'+k` (login/register/forgot/reset), `'ob-step-'+n` (1–4), `'reg-'+field` and `+'-error'` (full_name, school_code, email, password, confirm), `'al-step'+n` (1–3) and `'es'+n` (1–4)

  Each ID must appear as `id="x"` in a student page **or** inside a JS string literal (`id="x"` / `id=\"x\"` / `'id', 'x'`).
  - **`retired = ['es1','es2','es3','es4','eval-spinner','eval-signals']`:** these may be missing from the HTML, but must then also be missing from the JS.
  - **Appendix A.3 classes** (`.page`, `.nav-item`, `.user-profile`, `.user-avatar`, `.user-name`, `.theme-toggle`, `.password-toggle`, `.auth-tab`, `.chip`, `.dot`, `.cq-opt`, `.cq-letter`, `.al-step`, `.al-step-icon`, `.filter-chip`, `.career-pill`, `.msg`, `.msg-body`, `.msg-bubble`, `.msg-time`, `.msg-save`, `.chat-sug-text`, `.chat-mem-close`) must each appear in some student page or JS string.

  Test names: `every JS-referenced id exists`, `retired ids are gone from html and js`, `class hooks still emitted`.
- [ ] **Step 2: Run `node --test tests/hooks.test.js` against the current site.** Expected: `every JS-referenced id exists` and `class hooks still emitted` PASS (a baseline that proves the parser). `retired ids are gone` FAILS, because `es1` etc. are still present. Record this as the known red that Task 5 turns green.
- [ ] **Step 3: Write `tests/static.test.js`.** For each page in `FRAMES ∪ MIGRATED`:
  - `links the four new stylesheets in order and not style.css`
  - `theme snippet is the first head script`
  - `theme snippet is identical on every page`: the spec §7 single-source rule, met by byte-identical inline copies

  For each page in `MIGRATED`:
  - `no emoji in html`
  - `no inline style colours`: no `style="` containing `color|background|#` (but `hidden` attributes are fine)
  - `icons resolve against /assets/icons/sprite.svg`

  Global tests:
  - `admin files untouched`: SHA-1 of `pages/admin.html`, `pages/admin_login.html`, `admin.css`, `scripts/admin.js` and `style.css` equals the hashes recorded in the test file, taken when Task 1 starts.
  - `css is a fork of the prototype`: every token name in `ui_redesign/css/tokens.css` also exists in `/css/tokens.css`.
- [ ] **Step 4: Run `node --test tests/static.test.js`.** Expected: FAIL on `css is a fork of the prototype`, because `/css/tokens.css` is missing. `MIGRATED` is empty, so the page tests are vacuous.
- [ ] **Step 5: Copy the files.**
  - `ui_redesign/css/*.css` to `css/`, and `ui_redesign/assets/{fonts,icons,illustrations}` to `assets/`.
  - In `css/base.css`, change the font URLs to `/assets/fonts/…`.
  - Set `package.json` `"test"` to `node --test tests/*.test.js`.
- [ ] **Step 6: Run `npm test`.** Expected: PASS except the known `retired ids are gone` red. The riasec tests still pass.
- [ ] **Step 7: Checkpoint** (no commit).

### Task 2: Browser harness with API stubs

**Files:**
- Create: `tests/browser/package.json` (private; devDeps `playwright-core`, `axe-core`; scripts `test` = `node --test pages.test.js`), `tests/browser/serve.js` (copy of the prototype `serve.js`, root = repo root), `tests/browser/audit.js` (copy), `tests/browser/stub-api.js`, `tests/browser/fixtures/default.json`, `tests/browser/scenarios/admin.js`, `tests/browser/pages.test.js`
- Modify: `.gitignore` (add `tests/browser/node_modules/`), `.vercelignore` (`tests/` is already ignored; confirm)

**Interfaces:**
- Consumes: `auditPage` and `startServer` (copies).
- Produces: `stubApi`, `Scenario`, and these `pages.test.js` behaviours.
  - It runs every scenario × `['light','dark']` × widths (default 320, 390, 768, 1280; `FULL=1` adds 360, 1024, 1440; `SCREENS=a,b` filters by id prefix).
  - For each run it asserts: `ready` appears; no page errors; and `no stray nulls`.
  - `auditPage` must also be clean, but only for scenario files listed in `AUDITED`, an array in `pages.test.js` that starts empty. Each page task adds its scenario file there in its Step 1, which is what makes that step fail on the old markup.

- [ ] **Step 1: Capture fixtures from real shapes.** Use the `careerai` MCP tools against prod: `whoami`, `get_profile`, `get_access`, `get_latest_career_quiz`, `get_career_quiz_runs`, `list_roadmaps`, `get_roadmap` (Software Engineer), `get_contest_state`, `get_leaderboard`, `get_contest_history`, `get_career_news`.
  - Redact names and emails to the persona Aarav Mehta / `aarav.m@gmail.com`.
  - Use the shapes documented at `scripts/careerapi_mock.js:110-172` and `scripts/contest_api.js:97-139` for anything the MCP lacks: auth, `/careers`, `PUT`s, the chat SSE. `D:\careerAPI` is the fallback source of truth.
  - Build `GET /careers` from `tests/fixtures/riasec_careers.js`.
  - The `POST /chat/messages` default is an SSE stream: `sources`, three `delta`s, `done`. Take the event names from `script.js` ≈1069-1170.
- [ ] **Step 2: Write `pages.test.js`** with the matrix and assertions above, plus two tests:
  - `harness loads a logged-in app page`: `pages/app.html#/dashboard`, ready `#db-title`.
  - `admin pages still work`: `admin_login.html` renders `#adm-login-btn` with zero page errors; `admin.html`, with `GET /admin/me` stubbed, shows `.sidebar` and navigates to `#/schools` via `admGo`.
- [ ] **Step 3: Run `npm --prefix tests/browser test`.** Expected: these pass against the current site:
  - `harness loads a logged-in app page`
  - `admin pages still work`
  - `no stray nulls` on the baseline dashboard

  This proves that the stubs and gating work before any redesign. If the dashboard prints `undefined` with sparse fixtures, that's a real finding; ledger it and fix it in Task 7.
- [ ] **Step 4: Add the `audit self-test`.** Copy `ui_redesign/tools/fixtures/audit-bad.html` to `tests/browser/fixtures/` and assert that every issue type is detected (same as the prototype test). Run it and expect PASS.
- [ ] **Step 5: Checkpoint** (no commit).

### Task 3: Shell, router, theme and access gate (`app.html` and `chat.html` frames)

**Files:**
- Create: `scripts/shell.js`, adapted from `ui_redesign/js/shell.js`
- Modify: `scripts/script.js` (router ≈287-315, sidebar ≈192-220, theme ≈127-145, `accessFailed` ≈91-99, new helpers `stripEmoji`, `fitClass`, `fitLabel`, `icon`, `illo`), `pages/app.html` (shell and frame only; view content in later tasks), `pages/chat.html` (shell only), `tests/static.test.js` (`MIGRATED` gets the frame checks), `tests/browser/scenarios/shell.js`

**Interfaces:**
- Consumes: `/css/layouts.css` (`.sidebar`, `.tabbar`, `.more-sheet`, `body.nav-open`, `body.shell-chat`).
- Produces:
  - `CrackeerShell.render(el, opts)` / `mount()`, the same API as the prototype. It runs `mount()` immediately when the script executes.
  - The shell's tabs, nav items and More links call `navTo('<page>')`. The More button calls `toggleSidebar()` and the scrim calls `closeSidebar()`. In chat.html the links go to `app.html#/<page>`.
  - The router contract: every view is `<section class="page" id="<route>">` and is shown with `hidden = false` and `.active`. There's no inline `display`.

- [ ] **Step 1: Write the scenarios and tests** in `scenarios/shell.js` and `pages.test.js`:
  - `router shows one view`: navigating `#/dashboard` then `#/roadmap` leaves exactly one `.page:not([hidden])`, and it has `.active`.
  - `nav highlights follow the route`: on `#/contests`, `.nav-item[data-page=contests]`, `.tab[data-page=contests]` and nothing else have `.active` plus `aria-current="page"`. On `#/settings`, `.user-profile` and `.tab-more` are active.
  - `more sheet opens, closes on escape and swipe`: tap `.tab-more`, then `body.nav-open`; Escape removes it. A simulated touch drag of 120px down on `.more-sheet` also removes it.
  - `access gate`:
    - `GET /me/access` 401 sends you to `auth.html`
    - `{access:false, reason:'no_school'}` sends you to `paywall.html`
    - `{abort:true}` shows a retry screen with `.card` and `.btn-primary`, a visible body, and `auditPage` clean
    - before the access response, `document.body.style.visibility === 'hidden'`
  - `theme persists and every page has a toggle`: set `localStorage.careerai_theme='dark'`, open each page in `STUDENT_PAGES`, and `html[data-theme]` is `dark` at `domcontentloaded`. Each migrated page has ≥ 1 `.theme-toggle`.
  - `stripEmoji removes pictographs`: a node test in `tests/hooks.test.js` that `vm`-loads only the helper. `stripEmoji('🔬 Science Fair')` returns `'Science Fair'`; `stripEmoji('📘 Your Subjects')` returns `'Your Subjects'`.
- [ ] **Step 2: Run them.** Expected: FAIL (old shell, inline display, no `aria-current`, no `.tab-more`).
- [ ] **Step 3: Implement `scripts/shell.js`.** Copy the prototype and change:
  - `SPRITE = '/assets/icons/sprite.svg'`
  - hrefs become `onclick="navTo('X')"` buttons, or `app.html#/X` links when `document.body.dataset.page === 'chat'`
  - the More button uses `onclick="toggleSidebar()"` and the scrim uses `onclick="closeSidebar()"`
  - Log out calls `logout()`
  - the theme buttons call `toggleTheme()`
  - user data is filled later by `syncUser`, which writes the first `.user-name` and `.user-avatar` plus `#user-class`, so keep the sidebar `.user-profile` first in the DOM
- [ ] **Step 4: Update `script.js`.**
  - **`appRoute`:** set `hidden` and `.active` per `.page`. Update `.nav-item, .user-profile, .tab, .more-link` `active` and `aria-current`; `.tab-more` is active when the route is results, explorer, space or settings.
  - **Swipe-to-close:** bind to the first `.more-sheet`, falling back to `.sidebar` (admin).
  - **`applyTheme`:** sets `aria-pressed` only. The accessible name stays constant: "Dark theme". This fixes deferred minor #7.
  - **`accessFailed`:** renders a centred `.card` with the `lock` illo, the copy "We couldn't check your access. Check your internet connection and try again.", and a `.btn.btn-primary` "Try again".
  - **Helpers:** add `stripEmoji`, `fitClass`, `fitLabel`, `icon` and `illo` as described in Shared interfaces.
- [ ] **Step 5: Rebuild the frames.** In `pages/app.html` and `pages/chat.html`:
  - replace `.app-layout`, `.sidebar`, `.mobile-topbar` and `.sidebar-overlay` with `<div data-shell="app" data-active="…" data-live="false">` + `<main class="app-main">`
  - make each view a `<section class="page" id="…" hidden>`
  - update the stylesheet links per Global Constraints, add `<script src="/scripts/shell.js">` before `script.js`, and add both pages to `FRAMES`

  Until their views are ported, the old view markup renders unstyled. That's expected mid-plan: `app.html` moves to `MIGRATED` in Task 10 and `chat.html` in Task 11.
- [ ] **Step 6: Run** `npm test && npm --prefix tests/browser test`. Expected: the Step 1 tests PASS; `admin pages still work` still PASSES. View content isn't audited yet.
- [ ] **Step 7: Checkpoint.**

### Task 4: Public pages (landing, auth, paywall)

**Files:** `index.html`, `pages/auth.html`, `pages/paywall.html`, `scripts/script.js` (`authShow` ≈515-543, `pwRender`/`pwHero`/`pwSchoolForm`/`pwReason`/`pwShowSchoolForm`/`pwPlans`/`pwContinue`/`pwAllSet` ≈658-775), `tests/browser/scenarios/public.js`

**Port:** `ui_redesign/screens/{landing,auth,paywall}.html`, all states.

**Rules for this task:**
- `authShow` still selects `.auth-tab` by index (0 = login, 1 = register).
- Show and hide forms with `hidden`, not `style.display`.
- `togglePassword` requires the input to be `btn.parentElement`'s input. The prototype's `.password-field` wrapper satisfies that, so keep it.
- `#pw-code` keeps `.input` and also gets `form-input` until Task 12 removes every old class alias.
- Prices come from `CareerAPI.plans`; never hardcode ₹199 or ₹1,499.

- [ ] **Step 1: Write `scenarios/public.js`.**
  - landing `default` (`loggedIn: false`)
  - auth: `login`, `login-error` (`POST /auth/login` 401), `register-errors` (`POST /auth/register` 400 with `{field:'email'}`), `forgot`, `reset` (via `#reset` hash), `success`
  - paywall: `checking` (delay `GET /me/access` by 2 s), `no-school`, `not-on-roster`, `not-subscribed`, `all-set`, `error`

  Add the three pages to `FRAMES` and `MIGRATED`, and add `public.js` to `AUDITED`. Run them; expected FAIL (old CSS, audit issues).
- [ ] **Step 2: Port the static HTML.** All three pages get a theme toggle in `.public-header`.
- [ ] **Step 3: Rewrite the paywall builders** to emit the prototype markup. `.pw-emoji` becomes `illo('lock')` or `illo('thumb-up')`. The plan cards use `.card`/`.card-flat` `.pw-plan`, and `.badge.fit-strong` replaces `badge-green`.
- [ ] **Step 4: Run** `npm test && SCREENS=public npm --prefix tests/browser test`. Expected: PASS.
- [ ] **Step 5: Checkpoint.**

### Task 5: Step flows (onboarding, evaluation, career quiz, AI loading)

**Files:** `pages/{onboarding,evaluation,career_quiz,ai_loading}.html`, `scripts/script.js` (`obShow` ≈922-935, `obSetChips` ≈940, `chipOne` ≈1027, `startEval` ≈1033-1052, `cqRender` ≈1961-2007, `cqSelect` ≈2009, `cqSlide` ≈2075, `cqNextQ` ≈2047, `cqFinish` ≈2091, `cqRunAI` ≈2108), `scenarios/flows.js`

**Port:** `ui_redesign/screens/{onboarding,evaluation,career-quiz,ai-loading}.html`.

**Rules for this task:**
- `obShow` keeps overwriting `.dot` className. Emit `'dot'` + `' done'`/`' active'` exactly, because the prototype CSS keys on `.dot.done`/`.dot.active`. Set `#ob-bar` as a `<progress>` `value` instead of a width.
- **Chips:** `chipOne` uses `closest('.chip-grid')`, so the onboarding `.chip-group` elements also carry `chip-grid`. The chip text is the stored data, so the labels must equal today's values ("Mathematics", "Art & Design", "Private Sector", …). The prototype's wording changes ("Art and Design", "Private company") are **not** applied, because they would change stored profile data. Ledger this as a ruling.
- **Evaluation (spec §5.3 #3):**
  - Delete the step timers and `#eval-signals`.
  - `startEval` becomes `evalRender()`. It reads `GET /me/profile` and fills the "Your profile at a glance" `dl.kv` and badges from the profile fields.
  - The CTA calls `cqStart()`.
  - With `profile: null` it sends you to onboarding.
- **Career quiz:**
  - `cqRender` emits `button.option.cq-opt[data-orig]` > `span.option-letter.cq-letter[data-letter]` + `span`.
  - `#cq-area` gets `stripEmoji(q.area)`.
  - `cqSelect` drops its inline `.cq-letter` styles; CSS handles the selected state.
  - `cqNextQ` applies `.shake` to `#cq-opts` and sets `#cq-hint` to the error style, i.e. `.form-error` with the alert icon.
  - `cqSlide` must not overwrite `style.cssText` with colours; transform and opacity only.
- **AI loading (spec §5.3 #4):**
  - `.al-step` className stays `'al-step ' + (pending|loading|done)`.
  - `.al-step-icon` content is `icon('check')`, `<span class="spinner spinner-sm">` or `<span class="al-pending">`.
  - Replace the fixed 3.3 s timer: steps tick on real completion (score computed, then `POST /me/career-quiz` resolved), with a minimum of 1.2 s on screen in total.
  - On failure, show the `error` state with a retry that calls the same save.

- [ ] **Step 1: Write `scenarios/flows.js`.**
  - onboarding `step-1` to `step-4` (via `#/step/N`), plus `error` (enter 112 in Science, press Next)
  - evaluation `summary`
  - career quiz `question`, `at-cap` (click two options), `nothing-selected` (press Next with nothing selected), `last` (seed sessionStorage `careerai_state` at q 24)
  - AI loading `in-progress` (delay the POST), `done`, `error` (POST 500)

  Add the extra test `evaluation shows real profile`: the summary text contains the fixture's class, board and city. Add the pages to `FRAMES` and `MIGRATED`, and add `flows.js` to `AUDITED`. Run; expected FAIL.
- [ ] **Step 2: Port the HTML** of the four pages.
- [ ] **Step 3: Rewrite the builders** per the rules above.
- [ ] **Step 4: Run** `npm test && SCREENS=flows npm --prefix tests/browser test`. Expected: PASS, including `retired ids are gone from html and js` in `npm test`.
- [ ] **Step 5: Checkpoint.**

### Task 6: Career results report and print

**Files:** `pages/career_results.html`, `scripts/script.js` (`cqRetakeNotice` ≈2252, `cqInitPrint` ≈2282, `cqRenderResults` ≈2320-2373, `cqRenderStreams` ≈2378, `cqRenderDomains` ≈2401, `cqRenderRiasec` ≈2419-2526), `scenarios/report.js`

**Port:** `ui_redesign/screens/career-results.html`, with the `full`, `old-result` and `demo` states. This fixes the nesting bug (spec §5.3 #8): every block becomes a sibling `<section>`.

**Rules for this task:**
- **Career cards:** emit `article.card` with `.air-career-name`, `.air-fit-label` (`badge fitClass(pct)` with text `fitLabel(pct)`), `.air-career-field` and `.air-career-why`. No inline colours, no rank emoji or icons.
- **Stream rows:** `.bar-row` with `.air-stream-row-name` and `<progress class="progress progress-ink" value>`.
- **RIASEC:**
  - bars use `.bar-row`, `.air-riasec-name` and `<progress data-dim>`
  - the code tiles are `.riasec-tile[data-dim]` inside `#air-riasec-code.riasec.riasec-lg`
  - the key keeps `.air-code-key-letter`, `.air-code-key-name` and `.air-code-key-mean`, emitted as the prototype's `dl.code-key`
- **Domains:** `.badge.badge-outline` plus an icon, never emoji.
- **Retake notice:** `#air-retake` is an `.alert.alert-warn`; toggle it with `hidden`.
- **Print:** `cqInitPrint` / `?print=1` keep working, and printing uses the light palette (already in `/css/tokens.css`).

- [ ] **Step 1: Write `scenarios/report.js`.** It covers `full`, `old-result` (fixture `rsIsCurrentResult` false, i.e. an old question-set id) and `demo`, plus `print hides chrome in both themes`, copied from the prototype test. Add the page to `FRAMES` and `MIGRATED`, and add `report.js` to `AUDITED`. Run; expected FAIL.
- [ ] **Step 2: Port the page HTML and the builders.**
- [ ] **Step 3: Run** `npm test && SCREENS=report npm --prefix tests/browser test`. Expected: PASS.
- [ ] **Step 4: Checkpoint.**

### Task 7: Dashboard and Career Matches

**Files:** `pages/app.html` (`#dashboard` and `#results` views), `scripts/script.js` (`dbStat` ≈2543, `syncDashboard` ≈2553-2665, `syncResults` ≈2667-2721, `filterChip` ≈1057, the `PCT_*`/`ICON_BG` ramps ≈2535-2547), `scenarios/app-home.js`

**Port:** `dashboard.html` (`before-quiz`, `with-results`) and `career-matches.html` (`list`, `filtered`, `loading`, `no-quiz`, `none-above-min`).

**Rules for this task:**
- **`#db-cta-btn`** stays a `<button>` in every state, because `syncDashboard` assigns `onclick` and text. Its labels: "Start the quiz", "Open my roadmap" (`navTo('roadmap')`), "Retake the quiz". No "→".
- **Career pills:** `.career-pill[data-career]` with `class="pill career-pill"`, whose `onclick` calls `cdOpen`. Inside: `span.pill-num` (the percentage) and the name. `.career-pill-name` and `.career-pill-pct` stay as extra classes on those spans.
- **`syncResults`** emits `article.card.career-card` per the prototype, delete the static placeholder cards (app.html ≈161-271) and show four `.skeleton-card`s until the data arrives (spec §5.3 #7).
- **`filterChip` actually filters (spec §5.3 #1).**
  - The chips are rendered by `syncResults` from the categories present in the student's matches: `All` + each category, each with a `.chip-count`.
  - A click toggles `.active` and `aria-checked` and re-renders `#career-list` from the cached matches for that category.
  - Keep the signature `filterChip(el)`.
- **Delete the `PCT_COLORS` / `PCT_FILL` / `ICON_BG` ramps** and replace every use with `fitClass`.

- [ ] **Step 1: Write `scenarios/app-home.js`** with those states. `no-quiz` uses `GET /me/career-quiz/latest` → `{result:null}`; `loading` delays `/careers` by 2 s.
  Add the test `matches chips filter the list`: clicking "Engineering" leaves only cards whose field is Engineering, and the chip has `.active`. Add `app-home.js` to `AUDITED`. Run; expected FAIL.
- [ ] **Step 2: Port the views and builders** per the rules above.
- [ ] **Step 3: Run** `npm test && SCREENS=app-home npm --prefix tests/browser test`. Expected: PASS.
- [ ] **Step 4: Checkpoint.**

### Task 8: Explore, career detail, roadmap

**Files:** `pages/app.html` (`#explorer`, `#careerdetail`, `#roadmap`, the explorer drawer), `scripts/script.js` (`exCard` ≈3083, `exChip` ≈3117, `exSection` ≈3133, `exRenderBar` ≈3163, `exRenderActive` ≈3197, `exRenderDrawer` ≈3237, `exRenderGrid` ≈3278 plus the `.ex-none div:nth-child(2)` read ≈3297, `cdRender` ≈2754-2858, `rmLoad` ≈3464, `rmShow` ≈3492, `rmTimeline` ≈3512, `rmNote` ≈3527), `scenarios/app-explore.js`

**Port:** `explore.html` (4 states), `career-detail.html` (2), `roadmap.html` (4).

**Rules for this task:**
- **`#ex-search-clear`:** `exRenderBar` overwrites its className with `ex-search-clear (+ is-on)`. Change it to `classList` and the `hidden` attribute, keeping the `btn btn-icon btn-sm` classes.
- **`exChip`** emits `button.chip.filter-chip[data-k][aria-pressed]` with `.fc-label` + `.fc-n` (styled as `.chip-count`). Selected is `.active`, which is aliased in the CSS. `.is-empty` sets `disabled`.
- **`exRenderActive`** emits removable `.chip.selected` pills. Keep `.exa-key` and `.exa-val` inside as label spans.
- **`exRenderGrid`'s `nth-child(2)` read:** replace it with a direct reference to a `.empty-text` element in the `.ex-none` empty state (ledger it).
- **The drawer stays outside `#app`** as `aside.drawer.ex-drawer#ex-drawer`. `exOpenFilters` / `exCloseFilters` are unchanged: they toggle the body class and handle focus.
- **`cdRender`** follows the prototype detail page.
  - The salary grid becomes `dl.kv` with `.exa-key` / `.exa-val`.
  - The college list becomes `.list` rows.
  - The fit comes from `fitClass`.
  - The "News and jobs" button sets `spCareer` and calls `navTo('space')`, as it does today.
  - `#cd-rm-note` is an `.alert.alert-info` with `hidden` when a roadmap exists.
- **`rmTimeline`** emits `li.tl-item(.done)(.current)` > `.tl-dot` + `.tl-title` + `.tl-meta` + `.tl-body ul`, mapping the API's `tl-year` → `.tl-meta` and `tl-actions` → `.tl-body li`.
  - `#rm-timeline.children` is read by script.js ≈2232, so keep the items as direct children.
  - `#rm-note` covers the 404 and no-quiz cases as an `.empty` state (`map-pin`, `rocket` illos).
  - The API `emoji` field is never rendered.

- [ ] **Step 1: Write `scenarios/app-explore.js`.**
  - explorer `grid`, `drawer-open` (click `#ex-filter-btn`), `active-filters` (search "engineer" + a fit chip), `no-results`
  - career detail `full`, `no-roadmap` (`GET /roadmap` 404)
  - roadmap `timeline`, `picker` (`rmPick` opened), `not-written` (404), `no-quiz`

  Add the test `explore drawer is a bottom sheet on phones and closes on escape`, and add `app-explore.js` to `AUDITED`. Run; expected FAIL.
- [ ] **Step 2: Port the views and builders** per the rules above.
- [ ] **Step 3: Run** `npm test && SCREENS=app-explore npm --prefix tests/browser test`. Expected: PASS.
- [ ] **Step 4: Checkpoint.**

### Task 9: Contests view and weekly contest

**Files:** `pages/app.html` (`#contests`), `pages/quiz.html`, `scripts/contest.js` (`lbRender` ≈382, `lbDraw` ≈416, `lbStatus` ≈449, `lbBody` ≈483, `lbCard` ≈516, `lbTable` ≈528, `lbHistory` ≈545, `ctErrorBody` ≈86, `ctIntro` ≈126, `ctUpcoming` ≈146, `ctNoContest` ≈164, `ctDots` ≈193, `ctQuestion` ≈200, `ctConfirm` ≈256, `ctSubmitted` ≈304, `ctShowReview` ≈325), `scripts/script.js` (`syncProgress` ≈3441, `pgRenderEvolution` ≈3695), `scenarios/contests.js`

**Port:** `contests.html` (7 states) and `contest.html` (12 states).

**Rules for this task:**
- **`lbStatus`** emits `.lb-status.is-live|is-soon|is-done`. `.is-live` also gets `card-ink`; the other two get `card`. Use the trophy, calendar or medal illo.
- **`[data-until]`:** contest.js:50 rewrites the textContent of every `[data-until]` in the document. So every countdown element is a leaf `<span class="countdown|countdown-inline" data-until>`, and the dashboard countdown follows the same rule.
- **`lbDraw` scope tabs:** `button.tab-btn.filter-chip[role=tab][data-career]`, with `.active`.
- **`lbBody` / `lbCard` / `lbTable` / `lbHistory`** follow the prototype.
  - The table keeps `.lb-table`, `tr.is-me`, `.lb-hide-sm` and `tr.lb-gap`.
  - On small screens the school shows under the name (`.lb-school-sm`).
  - History links stay `a.ct-link`.
- **`#lb-root` stays inside `.page.active`**, because contest.js:439 relies on that.
- **`#pg-ai-note` (spec §5.3 #6):** it starts with `hidden`, and `syncProgress` fills `#pg-ai-note .ai-note-text` and removes `hidden` only when results exist. Replace the `div:last-child` selector with that class.
- **`pgRenderEvolution`** emits `.list-row`s with icon tiles and no inline colours.
- **Weekly contest:**
  - `ctQuestion` emits `button.option.quiz-option[role=radio](.selected)` > `span.option-letter.opt-letter`.
  - The progress is `<progress class="progress">` in the `.flow-bar`.
  - `ctDots` keeps `button.ct-dot(.answered)(.current)`.
  - `ctConfirm` keeps `#ct-submit`.
  - `ctShowReview` emits `.review-q` cards with `.answer-row.answer-right|answer-wrong`.
  - `.ct-emoji` is replaced by illos.
  - `quiz.html` becomes the `.flow` layout, with `#ct-label` in `.flow-title`.

- [ ] **Step 1: Write `scenarios/contests.js`.**
  - The contests view: `live`, `upcoming`, `done`, `no-career`, `no-results`, `payment-required` (402) and `signed-out` (401 on `/contest/state`). The state comes from the `GET /contest/state` fixture variants.
  - `quiz.html`: all 12 states, using `?review=N` for `review`, `POST …/attempt` for `question`, and a stubbed `submit` for `submitted`.

  Add the test `countdowns tick without destroying markup`: after 2 s, every `[data-until]` still has no element children, and its parent's `.card` structure is intact. Add `contests.js` to `AUDITED`, and `pages/quiz.html` to `FRAMES` and `MIGRATED`. Run; expected FAIL.
- [ ] **Step 2: Port the views and builders** per the rules above.
- [ ] **Step 3: Run** `npm test && SCREENS=contests npm --prefix tests/browser test`. Expected: PASS.
- [ ] **Step 4: Checkpoint.**

### Task 10: Career Space and Settings

**Files:** `pages/app.html` (`#space`, `#settings`), `scripts/script.js` (`spLoad` ≈3545, `spShow` ≈3579, `spRender` ≈3623, `spNote` ≈3671, `syncSettings` ≈779, `stEditSchool` ≈800, `stEditName` ≈827, `stEditClass` ≈867, `toggleBtn` ≈1882, `syncUser` ≈903), `scenarios/app-misc.js`

**Port:** `career-space.html` (4 states) and `settings.html` (5 states).

**Rules for this task:**
- **Career pills:** `button.pill.career-pill(.active)[role=tab][aria-selected]`. `spShow` keeps toggling `.active`, which is aliased in the CSS.
- **`#sp-tabs`:** `.tabs` with `button.tab-btn.filter-chip(.active)`. `.is-empty` sets `disabled`.
- **`spRender`:** `a.list-row.sp-item[target=_blank][rel=noopener]`. Inside:
  - `img.sp-thumb` when the API gives an image, otherwise an icon tile
  - `.list-title` (title)
  - `.list-meta` (source, time)
  - the visually hidden text "(opens in a new tab)"
- **`spNote`:** an `.alert.alert-error` with `button.sp-retry`, or an `.empty` state.
- **Settings:**
  - The edit boxes keep the "`innerHTML` empty means closed" logic, but render the prototype's `.setting-edit` form.
  - `stEditClass` keeps `#st-board-input`, which the prototype lacks. Add it as a select in the same grid.
  - Removing the School ID shows the `remove-school-warning` alert before calling the existing save.
- **Notification toggles (spec §5.3 #2):** remove them from the HTML, remove `toggleBtn` from script.js, and remove the `.toggle` rule references. There's no `.toggle` in the new CSS.

- [ ] **Step 1: Write `scenarios/app-misc.js`.**
  - Career Space: `feed`, `tab-switched`, `error` (`GET /career-news` 500), `empty` (no items in the category)
  - Settings: `view` and the three edit states (open via `stEdit*`), plus `remove-school-warning`

  Add the test `remove school asks first`: clicking Remove shows the warning, and `PUT /me/school` isn't called until you confirm. Add `app-misc.js` to `AUDITED`, and `pages/app.html` to `MIGRATED`, since every app view is ported once this task is done. Run; expected FAIL.
- [ ] **Step 2: Port the views and builders** per the rules above.
- [ ] **Step 3: Run** `npm test && SCREENS=app-misc npm --prefix tests/browser test`. Expected: PASS.
- [ ] **Step 4: Checkpoint.**

### Task 11: AI Chat

**Files:** `pages/chat.html`, `scripts/script.js` (`addMsg` ≈1858, `sendChat` ≈1249, `renderReply` ≈1171, `addSources` ≈1202, `addChatError` ≈1220, `addMentions` ≈1829, `chatPlaceSave` ≈1335, `chatShowWelcome` ≈1233, `chatRenderWelcome` ≈1635, `chatRenderMem` ≈1695, `chatMemOpen` ≈1787, `chatLight` ≈1815, `chatMemShow` ≈1846), `scenarios/chat.js`

**Port:** `chat.html`, all 5 states.

**Rules for this task:**
- **Message structure** (required by the PDF export and its range reads): `div.msg(.user)` > `.msg-avatar` + `div.msg-body` > `div.msg-bubble` + `div.msg-time`.
  - The user avatar gets `aria-hidden="true"` (deferred minor #12).
  - `renderReply`'s allowed tags are unchanged.
  - `.msg-sources > a.msg-source` (+ icon), `.msg-mentions > button.msg-mention.pill`, `.msg-actions > button.btn.btn-ghost.btn-sm.msg-save` whose first `span` is the label.
- **`#chat-scroll` stays the scrolling element**, inside the prototype's `.chat` column. `body[data-page=chat]` gets `shell-chat` from `shell.js`.
- **Memory drawer:** `aside.drawer.chat-mem#chat-mem`, with `.chat-mem-close` and `[data-fact]` rows. `.lit` and `.flash` stay.
  - `chatRenderMem` emits `.mem-list` / `.mem-fact` rows.
  - Career rows use `<progress data-dim>` or `.progress-ink`, with no inline widths.
  - Drop style.css's old `.chat-mem-body > :nth-child(2|3)` rules; there's no equivalent in the new CSS.
- **Composer:** `#chat-send.idle|.busy` toggles the send and stop icons via `innerHTML = icon('send'|'square')` plus the aria-label. `#chat-input` keeps `chatKey` / `chatAutosize`.
- **Viewport meta** on chat.html: add `interactive-widget=resizes-content` (deferred minor #13).

- [ ] **Step 1: Write `scenarios/chat.js`.**
  - `welcome`
  - `conversation`: send one message; the stubbed SSE reply streams in
  - `streaming`: an SSE with no `done` within the test window
  - `error`: an SSE `error` event, and a separate `conversation_expired` case
  - `memory-open`: `chatMemOpen()`

  At 320×568 too. Add the tests `chat pdf export`, from Review Focus 5 (spy on `window.jspdf.jsPDF.prototype.save` via `addInitScript` after the vendor loads; assert it's called once with no page error), and `composer never covers last message`, copied from the prototype. Add `chat.js` to `AUDITED` and `pages/chat.html` to `MIGRATED`. Run; expected FAIL.
- [ ] **Step 2: Port the page and builders** per the rules above.
- [ ] **Step 3: Run** `npm test && SCREENS=chat npm --prefix tests/browser test`. Expected: PASS.
- [ ] **Step 4: Checkpoint.**

### Task 12: Clean-up, full verification, live smoke

**Files:** `scripts/script.js`, `scripts/contest.js` (old class aliases), `tests/static.test.js`, `README` notes in `ui_redesign/README.md` ("Live step done" section), `docs/superpowers/specs/2026-11-08-ui-redesign-design.md` (Appendix A: mark renames that actually happened)

- [ ] **Step 1: Add the final static tests.**
  - `no emoji in student js strings`: `\p{Extended_Pictographic}` count is 0 in `script.js` and `contest.js` string literals, the PDF iframe CSS block excepted.
  - `no colour in js`: no `style\.(color|background)`, `--ramp-`, `--fill-` or `--tint-`, the PDF block excepted.
  - `no old-only classes in student markup`: `form-input`, `badge-green`, `welcome-banner`, `stat-card`, `career-card ` without `card`, `pw-emoji` and `ct-emoji` are absent from student pages and JS.

  Run; expected FAIL wherever leftovers remain.
- [ ] **Step 2: Remove the leftovers** until Step 1 passes. Old classes that `style.css`-only admin markup still uses stay in admin files only.
- [ ] **Step 3: Run the full verification.** Run `npm test && FULL=1 npm --prefix tests/browser test`, plus the prototype suite `npm --prefix ui_redesign/tools test` (it must still pass, unchanged). Expected: all PASS. Record the counts.
- [ ] **Step 4: Live smoke test with the user's account (spec §8.3).** This step needs the user, who must sign in. Run the site with `npx vercel dev` (installing the Vercel CLI first if needed), or with a static server against prod via the `LOCAL_HOST` rule in careerapi_mock.js:30-39. Then walk the 16 flows of spec §8.3 in both themes at 360px and 1280px. Ledger each flow pass or fail; any failure gets a RED test in the browser suite before it's fixed.
- [ ] **Step 5: Checkpoint and handoff.** Summarise the rulings, deferred minors and anything the live smoke test found.

---

## Rulings this plan makes

- **The spec is stale on the mock** (§8.3 says "against `careerapi_mock.js`"). That file now calls the live API, so automated runs use Playwright API stubs (Task 2), and only the final smoke test hits prod with the user's account.
- **`style.css` is kept** for the admin pages, which still link it. It's unlinked from student pages and never edited.
- **Onboarding chip labels keep today's wording**, because the chip text is the stored data. The prototype's rewording is dropped.
- **`#ex-search-clear` and `#pg-ai-note`:** their brittle reads (className overwrite, `div:last-child`, `nth-child(2)`) are replaced with `classList`, `hidden` and named classes.
