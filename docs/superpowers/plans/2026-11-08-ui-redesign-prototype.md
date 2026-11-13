# Crackeer UI Redesign — Prototype Phase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the clickable, responsive, light+dark HTML/CSS prototype of every student screen in `ui_redesign/`, on the final CSS that will later go live.

**Architecture:** Static HTML screens (one file per screen, each state in a `<template data-state>`), styled only by four production CSS files driven by tokens. A tiny prototype runtime (`proto.js`) picks the state/theme from the URL; a shared `shell.js` renders the app shell (sidebar, bottom bar, More sheet). A `screens.json` manifest is the single source for the gallery and for two automated test suites (static lint + browser layout audit).

**Tech Stack:** Plain HTML/CSS/vanilla JS (no build step). Tests: Node 21 `node:test`; `playwright-core` driving the installed Chrome (`channel: 'chrome'`); `axe-core` for contrast. Fonts/icons from npm packages `@fontsource-variable/fraunces`, `@fontsource-variable/inter`, `@fontsource/space-grotesk`, `lucide-static`. All tooling deps live only in `ui_redesign/tools/package.json` — the site root stays dependency-free.

**Spec:** `docs/superpowers/specs/2026-11-08-ui-redesign-design.md` (read §3–§6 and Appendix A before any task).

**This plan covers spec §6 (the prototype) only.** The live step (§7, §8.2–8.3) gets its own plan after the prototype is approved.

## Global Constraints

- **Do not commit anything** (user instruction). Every task ends at a checkpoint, not a commit. Do not run `git add`/`git commit`/`git stash`.
- Implementation skills: invoke `/frontend-design:frontend-design` and `/ui-ux-pro-max:ui-ux-pro-max` at the start of Tasks 4 and 6 (and re-consult for any new screen family); follow the spec where they conflict.
- Visual direction: "Notebook first, playful accents" (spec §3). Playful elements only on contests, ranks, streaks, quiz moments, success states (§3.4).
- Token names in spec §3.1 are a contract; values may be tuned. Add `--on-pastel: #1d1b18` (both themes) for text on RIASEC fills.
- No raw colour (`#hex`, `rgb(`, `hsl(`) outside `ui_redesign/css/tokens.css`. No inline `style=""` in `screens/*.html`.
- No external URLs (`http://`, `https://`, `//`) in `screens/`, `css/`, `js/`, `index.html` — everything self-hosted.
- No emoji used as icons in screens; icons are `<svg><use href="../assets/icons/sprite.svg#i-NAME"/></svg>`.
- Fonts: Fraunces (600, 800), Inter (400–700), Space Grotesk 700 restricted with `unicode-range: U+0023, U+0025, U+002B-002F, U+0030-003A` (numbers only). `font-display: swap`.
- Widths audited: 320, 360, 390, 768, 1024, 1280, 1440 (height 800); themes light + dark; every state.
- Breakpoint: sidebar at `min-width: 1024px`; bottom bar below. Bottom bar max-width 440px, centred; LIVE badge becomes a dot below 360px.
- Theme: `html[data-theme="light"|"dark"]`, persisted in `localStorage['careerai_theme']` (same key as live).
- Nav `data-page` values (match live): `dashboard, results, explorer, roadmap, chat, contests, space, settings`. Labels: Home, Career Matches, Roadmap, Explore careers, Career Space, Contests, AI Chat, Settings; bottom bar labels: Home · Roadmap · Contests · AI Chat · More.
- Sample persona everywhere: **Aarav Mehta**, Class 10, CBSE, English medium, Pune; RIASEC code **I-R-A**; top match **Software Engineer 86%** (strong), then Data Scientist 81%, Robotics Engineer 77%, Architect 69% (good), Biomedical Instrumentation Engineer 64%; stream **Science (PCM)**; weekly contest "Tech Thinkers · Week 12", rank #14, 4/5, streak 3 weeks. Copy uses "about 6 minutes", "25 questions".
- Hook IDs from spec Appendix A are kept verbatim where the element exists; IDs marked retire are not used.
- Elements the live JS shows/hides with the `hidden` attribute (`air-retake`, `air-demo-badge`, `rm-note`, `rm-select`, `sp-note`, `sp-foot`, `cd-rm-note`, `chat-new`, `chat-welcome`, `ex-filter-count`) are present in **every** state of their screen, carrying `hidden` where inactive. This mirrors live markup and exercises the global `[hidden]` rule.
- Approved visual references (copied next to the spec, not committed): `docs/superpowers/specs/assets/2026-11-08-foundations-board.html`, `…-navigation-board.html`, `…-visual-direction.html` (choice "1 · Notebook first").
- Verification cadence (Git Bash syntax, run in `ui_redesign/tools`): per task `npm run lint && SCREENS=<ids of this task> npm run layout`; whole suite quickly `QUICK=1 npm run layout`; the **full** matrix `npm test` only at Tasks 5, 9 and 15.

## Review Focus

1. **Long real-world text** (long career/school names, long chat messages with URLs) must wrap or clamp, never overflow or overlap → `?stress=1` mode in `proto.js` + layout test `stress mode at 320px has no overflow/overlap` (Task 5, applied to every screen via manifest).
2. **Dark-mode contrast on pastel RIASEC tiles, fit badges and coral text** → axe `color-contrast` in the layout audit, both themes, every screen and state (Task 5 `auditPage`).
3. **Fixed bottom bar / sticky chat composer hiding content** on short phones (320×568) → layout check `obscured` (bottom-anchored fixed/sticky only) after scrolling to bottom, plus chat audited at 320×568 (Tasks 5, 14).
4. **Keyboard users:** visible focus on every control, Escape closes More sheet / drawers / memory sheet → test `focus ring visible` and `escape closes overlays` (Tasks 4, 5, 11, 14).
5. **Reduced motion and theme flash:** animations off under `prefers-reduced-motion`; theme set before first paint → test `reduced motion disables animation` (Task 4) and lint `every screen has the head theme snippet before stylesheets` (Task 1).

---

## File Structure

```
ui_redesign/
  index.html                 gallery (Task 5)
  screens.json               manifest — single source for gallery + tests (Task 1, extended per screen)
  README.md                  how to view/test; hook map pointer (Task 15)
  css/tokens.css             tokens light + dark (Task 2)
  css/base.css               reset, @font-face, type, [hidden], focus, reduced motion, print (Task 2)
  css/components.css         all components (Task 4)
  css/layouts.css            app shell, step flow, public, report layouts (Task 5)
  js/proto.js                prototype runtime — NOT shipped (Task 5)
  js/shell.js                app shell renderer — intended to go live (Task 5)
  assets/fonts/*.woff2, assets/fonts/OFL.txt          (Task 2)
  assets/icons/sprite.svg, assets/icons/LICENSE.txt   (Task 3)
  assets/illustrations/*.webp, assets/illustrations/LICENSES.md (Task 3)
  screens/foundations.html   component board (Task 4)
  screens/<18 screen files>  spec §5.1 names (Tasks 6–14)
  tools/package.json         devDeps: playwright-core, axe-core, fontsource pkgs, lucide-static
  tools/serve.js             static server (Task 1)
  tools/manifest.js          manifest loader + HTML helpers shared by tests (Task 1)
  tools/lint.test.js         static checks (Task 1)
  tools/audit.js             in-browser layout audit (Task 5)
  tools/layout.test.js       browser matrix test (Task 5)
  tools/build-sprite.js      builds sprite.svg from lucide-static (Task 3)
  ui_redesign.txt            original request (untouched)
```

### Shared interfaces (defined once, used by many tasks)

**`screens.json`** — array of:
```json
{ "id": "dashboard", "file": "screens/dashboard.html", "title": "Dashboard",
  "group": "App", "shell": "app", "pass": 1,
  "states": ["before-quiz", "with-results"],
  "hooks": ["db-title", "db-sub", "db-cta-btn", "db-main", "db-stats"],
  "viewports": [[320,800],[360,800],[390,800],[768,800],[1024,800],[1280,800],[1440,800]] }
```
`group` ∈ `Foundations | Public | Step flows | App | Chat`. `shell` ∈ `app | flow | public | report | none`. `viewports` optional (default = the 7 widths × 800). `hooks` = Appendix A IDs that must exist in **every** state of that screen unless written as `"id@state1,state2"` (only in those states). A hook rendered by JS (shell output) is written `"id!dom"`: lint skips it and the layout test asserts it in the live DOM after ready.

**Screen file contract:**
```html
<!doctype html><html lang="en" data-theme="light"><head>
  <script>/* theme snippet: read ?theme= then localStorage careerai_theme, set data-theme */</script>
  <link rel="stylesheet" href="../css/tokens.css"> … base, components, layouts
  <script src="../js/proto.js" defer></script>  <!-- + ../js/shell.js when shell=app -->
</head><body data-page="app" data-screen="dashboard">
  <div data-shell="app" data-active="dashboard"></div>     <!-- app screens only -->
  <main data-proto-root></main>
  <template data-state="before-quiz" data-label="Before the quiz">…</template>
  <template data-state="with-results" data-label="With results">…</template>
</body></html>
```

**`proto.js`** — `window.Proto = { setState(name: string): void, setTheme(t: 'light'|'dark'): void, states(): {name, label}[] }`. On load: theme from `?theme=`; state from `?state=` (default first template); clones the template into `[data-proto-root]`; if `?stress=1`, appends each `[data-stress]` element's text to itself twice; applies the template's optional `data-body-class` (space-separated classes, e.g. `nav-open`) to `<body>` and removes the previous state's; calls `window.CrackeerShell?.mount()` so the shell exists before auditing; then sets `html[data-proto-ready="1"]` and dispatches `proto:ready` on `document` (tests wait on the attribute, never the event). Single-state screens still use one `<template>`. Listens for `message` events `{type:'proto', state?, theme?}` from the gallery. Demo behaviours (delegated, survive re-render): `.theme-toggle` click toggles theme; `[data-proto-toggle="ID"]` toggles `hidden` on `#ID`; `[data-proto-body="CLASS"]` toggles that class on `<body>`; `[data-proto-select="single|multi"] .chip` toggles `.selected` (cap via `data-max`); `Escape` removes `nav-open`, `ex-filters-open`, `chat-mem-open` from `<body>`; scrim elements `[data-proto-close]` do the same.

**`shell.js`** — `window.CrackeerShell.render(el: HTMLElement, opts: { active: NavPage, live: boolean, user: { name: string, cls: string, initial: string } }): void` where `NavPage` = one of the nav `data-page` values. Also `CrackeerShell.mount(): void` renders every `[data-shell="app"]` not yet rendered (idempotent; reads `data-active`/`data-live`). shell.js calls it itself on `DOMContentLoaded` for live use; proto.js calls it earlier. Script order on app screens: `shell.js` then `proto.js`, both `defer`. Produces:
- `aside.sidebar` with groups My path / Discover / Do, `.nav-item[data-page]` (active one has `.active` + `aria-current="page"`), Contests `.nav-live` badge when `live`, `.user-profile[data-page="settings"]` containing `.user-avatar`, `.user-name`, `#user-class`, `.theme-toggle`.
- `nav.tabbar` (below 1024px) with `.tab[data-page]` for dashboard, roadmap, contests, chat + `.tab-more` button (`data-proto-body="nav-open"`, `aria-expanded`), `.tab-live` badge/dot on Contests.
- `#more-sheet` (role="dialog", aria-label "More") + `.sheet-scrim[data-proto-close]`, opened by `body.nav-open`, listing results, explorer, space, settings, theme toggle, Log out.
- When `body[data-screen="chat"]`: adds `body.shell-chat` so layouts.css hides the tabbar below 1024px. The chat top bar (back, title, memory, New chat) is **template markup in chat.html**, not shell output.

**`tools/manifest.js`** — `loadManifest(): Screen[]`; `readScreen(screen): string`; `templates(html): {state, html}[]`; `idsIn(html): Set<string>`.

**`tools/serve.js`** — `startServer(root: string, port = 0): Promise<{ url: string, close(): Promise<void> }>`; CLI `node serve.js` serves `ui_redesign/` on 4173.

**`tools/audit.js`** — `auditPage(page: import('playwright-core').Page): Promise<Issue[]>`, `Issue = { type: 'hscroll'|'overlap'|'clip'|'obscured'|'contrast', where: string, detail: string }`.

---

### Task 1: Tooling, manifest and static lint

**Files:**
- Create: `ui_redesign/tools/package.json`, `ui_redesign/tools/serve.js`, `ui_redesign/tools/manifest.js`, `ui_redesign/tools/lint.test.js`, `ui_redesign/screens.json`
- Modify: `.gitignore` — add `ui_redesign/tools/node_modules/`

**Interfaces:**
- Produces: `screens.json` schema, `manifest.js` helpers, `startServer`, and the lint rules every later task must satisfy.

- [ ] **Step 1: Create `tools/package.json`** — `"private": true`, scripts `"test": "node --test"`, `"lint": "node --test lint.test.js"`, `"layout": "node --test layout.test.js"`, `"serve": "node serve.js"`; devDependencies `playwright-core`, `axe-core`, `@fontsource-variable/fraunces`, `@fontsource-variable/inter`, `@fontsource/space-grotesk`, `lucide-static`. Run `cd ui_redesign/tools && npm install`. Expected: installs, no root `package.json` change.

- [ ] **Step 2: Write `screens.json`** with the foundations entry only: `{ "id":"foundations","file":"screens/foundations.html","title":"Foundations","group":"Foundations","shell":"none","pass":1,"states":["board"],"hooks":[] }`.

- [ ] **Step 3: Write the failing lint tests in `lint.test.js`**, iterating every manifest screen (and `css/*.css`, `js/*.js`, `index.html` where noted):
  - `screen file exists` — `fs.existsSync(file)`.
  - `states match manifest` — `templates(html).map(t=>t.state)` deep-equals `screen.states`.
  - `hook ids present per state` — for each hook (respecting `@state`, skipping `!dom`), `idsIn(template.html + static body)` has it.
  - `ids unique within a state` — no duplicate `id=` in a template + the static body.
  - `no inline styles` — `/\sstyle\s*=/i` not in screen HTML.
  - `no raw colours outside tokens.css` — regex `/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i` absent from screens, `css/` (except tokens.css), `js/`, `index.html`, after stripping `href="#…"`, `url(#…)`, `sprite.svg#…` and `id=`/`for=` values.
  - `no external urls` — no `http(s)://` or `//host` in `src=`, `url(`, `<link … href=`, `@import` in the same files. Plain `<a href="https://…">` links (Career Space feed, chat sources) are allowed.
  - `no emoji` — `/\p{Extended_Pictographic}/u` absent from screen HTML.
  - `head theme snippet first` — the first `<script>` in `<head>` appears before the first `<link rel="stylesheet">` and contains `careerai_theme`.
  - `every css var used is defined` — every `var(--x` in `css/*.css` is defined in `tokens.css` or in the same file (`--x:`); no token defined as `var(` of itself.
  - `tokens complete` — every spec §3.1 token plus `--on-pastel` defined in `:root` and again under `[data-theme="dark"]`.
  - `icons resolve` — every `sprite.svg#i-NAME` reference has `<symbol id="i-NAME">` in `assets/icons/sprite.svg`.
  - `illustrations licensed` — every `assets/illustrations/*.webp` referenced in screens is listed in `LICENSES.md`.

- [ ] **Step 4: Run `npm run lint`.** Expected: FAIL — `screen file exists` (foundations.html missing) and token/css tests failing for missing files.

- [ ] **Step 5: Implement `manifest.js` and `serve.js`** (http + fs, MIME map for html/css/js/json/svg/webp/woff2; 404 otherwise; path traversal rejected). Lint tests now fail only on missing deliverables, not on helper errors.

- [ ] **Step 6: Checkpoint** — no commit (user instruction). Lint runs and reports only missing-file failures.

### Task 2: Tokens, base CSS, fonts

**Files:**
- Create: `ui_redesign/css/tokens.css`, `ui_redesign/css/base.css`, `ui_redesign/assets/fonts/*` (copied from fontsource packages: Fraunces variable latin, Inter variable latin, Space Grotesk 700 latin), `ui_redesign/assets/fonts/OFL.txt`

**Interfaces:**
- Consumes: lint rules (Task 1).
- Produces: all tokens in spec §3.1 + `--on-pastel`, plus `--font-display`, `--font-ui`, `--font-num`, type scale `--fs-display, --fs-display-sm, --fs-h2, --fs-h3, --fs-body, --fs-small, --fs-label`, spacing `--sp-1..--sp-10` (4px steps), radii `--r-card: 8px, --r-nav: 20px, --r-tab: 14px, --r-pill: 999px`, `--outline: 1.5px solid var(--line)`, `--shadow-hard: 3px 3px 0 var(--shadow)`, `--shadow-hard-sm: 2px 2px 0 var(--shadow)`, `--ease`, `--ease-out`, `--sidebar-w: 216px`, `--tabbar-h`.

- [ ] **Step 1: Run `npm run lint`** — confirm `tokens complete` and `every css var used is defined` FAIL.
- [ ] **Step 2: Write `tokens.css`** with spec §3.1 values (light on `:root, [data-theme="light"]`, dark on `[data-theme="dark"]`).
- [ ] **Step 3: Write `base.css`**: `@font-face` for the three families (Space Grotesk with the Global-Constraints `unicode-range`), box-sizing reset, body `background: var(--paper); color: var(--ink); font: var(--fs-body)/1.55 var(--font-ui)`, headings in `--font-display`, `.num` utility in `--font-num` with `font-variant-numeric: tabular-nums`, `[hidden]{display:none !important}`, `:focus-visible { outline: var(--outline); box-shadow: 0 0 0 3px var(--accent-weak) }`, `@media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation-duration:.01ms !important; animation-iteration-count:1 !important; transition-duration:.01ms !important; scroll-behavior:auto !important } }`, root font-size steps at 1600/1920/2400px, `@media print` base (hide `.no-print`, white paper, ink black).
- [ ] **Step 4: Run `npm run lint`.** Expected: token/var tests PASS; screen-existence tests still FAIL (foundations not built).
- [ ] **Step 5: Checkpoint** — no commit.

### Task 3: Icon sprite and 3D illustrations

**Files:**
- Create: `ui_redesign/tools/build-sprite.js`, `ui_redesign/assets/icons/sprite.svg`, `ui_redesign/assets/icons/LICENSE.txt` (Lucide ISC), `ui_redesign/assets/illustrations/*.webp`, `ui_redesign/assets/illustrations/LICENSES.md`

**Interfaces:**
- Produces: symbol ids `i-<lucide-name>` for exactly this list: `house, compass, route, trophy, message-square, ellipsis, search, newspaper, settings, sun, moon, log-out, arrow-left, arrow-right, chevron-right, chevron-down, x, check, eye, eye-off, sliders-horizontal, download, printer, send, square, brain, plus, refresh-cw, lock, clock, calendar, map-pin, graduation-cap, sparkles, star, circle-alert, info, external-link, user, school, book-open, briefcase, flame, medal, list-checks, circle-help, trash-2, pencil`. Illustrations (webp, 200px and 400px): `trophy, rocket, chat, lock, magnifier, calendar, target, star, check, map-pin` — named `<name>-200.webp`/`<name>-400.webp`.

- [ ] **Step 1: Write `build-sprite.js`** — `buildSprite(names: string[]): string` reads `node_modules/lucide-static/icons/<name>.svg`, converts each to `<symbol id="i-<name>" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">…</symbol>`; throws on a missing name. CLI writes `assets/icons/sprite.svg`.
- [ ] **Step 2: Run `node build-sprite.js`.** Expected: sprite with 48 symbols; `grep -c "<symbol" ../assets/icons/sprite.svg` → `48`.
- [ ] **Step 3: Fetch illustrations** with the 3dicons MCP: `search_icons` (style `clay` first; fall back to `color` if clay looks off on paper), then `get_icon` per slug to read its licence and 200/400 webp URLs; download into `assets/illustrations/`; write `LICENSES.md` as a table `file | 3dicons slug | page URL | licence`. If an icon is `pro: true` or its licence forbids redistribution, pick another.
- [ ] **Step 4: Checkpoint** — no commit. `icons resolve` / `illustrations licensed` are exercised once screens reference them.

### Task 4: Components and the foundations board

**Files:**
- Create: `ui_redesign/css/components.css`, `ui_redesign/js/proto.js` (full interface above, so the board is viewable), `ui_redesign/screens/foundations.html`

**Interfaces:**
- Consumes: tokens (Task 2), sprite (Task 3).
- Produces these component classes (the vocabulary every screen uses; names are final):
  `.btn` + `.btn-primary | .btn-secondary | .btn-ghost | .btn-danger`, `.btn-sm`, `.btn-icon`, `.btn.busy`; `.field`, `.field-label`, `.input`, `.select`, `.textarea`, `.input.is-invalid`, `.input.is-ok`, `.form-error`, `.password-toggle`; `.chip`, `.chip.selected`, `.chip-group`; `.tabs` + `.tab-btn.active` (replaces lb-tabs/auth-tab/filter-chip-as-tab visually; live hook classes like `.auth-tab` are added alongside); `.seg` + `.seg-btn.active`; `.card`, `.card-flat`, `.card-ink` (contest), `.card-head`, `.card-title`; `.badge`, `.fit` + `.fit-strong | .fit-good | .fit-low`, `.live-badge`; `.riasec` + `.riasec-tile[data-dim="R|I|A|S|E|C"]`; `.progress` + `.progress-fill`; `.bar-row` (label + bar + value); `.alert` + `.alert-error | .alert-ok | .alert-info | .alert-warn`; `.toast`; `.drawer`, `.sheet`, `.scrim`; `.timeline` + `.tl-item(.done)`; `.table` + `tr.is-me`; `.skeleton` (+ `.skeleton-line`, `.skeleton-card`); `.empty` (illustration + title + text + action); `.stat` tiles; `.avatar`; `.icon` (`width/height:1.25em`), `.hl` (highlighter underline), `.label` (caps), `.num`.

- [ ] **Step 1: Invoke `/frontend-design:frontend-design` and `/ui-ux-pro-max:ui-ux-pro-max`** with spec §3 and the approved boards in `docs/superpowers/specs/assets/` as the brief.
- [ ] **Step 2: Add the foundations entry's test expectation** — it already exists in `screens.json`; run `npm run lint` and confirm `screen file exists` FAILS for foundations.
- [ ] **Step 2b: Implement `proto.js`** (interface above). Check by hand: `npm run serve`, open `/screens/foundations.html?theme=dark`: the board renders dark and `html` has `data-proto-ready`.
- [ ] **Step 3: Write `components.css`** implementing every class above with tokens only. Notebook signature (`--outline` + `--shadow-hard`) on `.card`, `.btn-secondary`; soft `--line-soft` on inputs/chips; `.riasec-tile` uses `--r..--c` with `color: var(--on-pastel)`; `.card-ink` uses `--ink` background, `--paper` text, `3px 3px 0 var(--accent)`; `.live-badge` coral fill with white text (verify contrast; darken via `--accent-text` background if axe fails).
- [ ] **Step 4: Write `screens/foundations.html`** — one `<template data-state="board">` showing every component in every variant/state (including disabled, focus, invalid, busy, skeleton, empty with an illustration), the colour swatches and the type scale.
- [ ] **Step 5: Run `npm run lint`.** Expected: PASS for foundations.
- [ ] **Step 6: Checkpoint** — no commit. (Layout audit of this board runs in Task 5.)

### Task 5: Layouts, shell, prototype runtime, gallery, layout audit

**Files:**
- Create: `ui_redesign/css/layouts.css`, `ui_redesign/js/shell.js`, `ui_redesign/index.html`, `ui_redesign/tools/audit.js`, `ui_redesign/tools/layout.test.js`
- Modify: `ui_redesign/screens.json` — add `{ "id":"shell-demo","file":"screens/shell-demo.html","title":"App shell","group":"App","shell":"app","pass":1,"states":["home","more-open","contests-live"],"hooks":["user-class!dom"] }`; Create `ui_redesign/screens/shell-demo.html`

**Interfaces:**
- Consumes: components (Task 4).
- Produces: `Proto`, `CrackeerShell.render`, `auditPage`, layout classes: `.app` (grid: sidebar + `.app-main` capped at 1200px), `.app-main`, `.page-head`, `.flow` (step layout) + `.flow-bar` (Back/Exit, title, `.progress`), `.public` + `.public-header`, `.report` + print rules, `.stack`, `.grid-2`, `.grid-3`, `.grid-auto` (auto-fit minmax(260px,1fr)).

- [ ] **Step 1: Write the failing `layout.test.js`.** Start the server (`startServer('..')`), launch `chromium.launch({ channel: 'chrome' })` once, one context per theme. Filters: `SCREENS=a,b` limits screens; `QUICK=1` limits widths to 320 and 1280 and runs axe only at 1280. For every manifest screen × state × theme × viewport: open `screens/<file>?state=S&theme=T`, `waitForSelector('html[data-proto-ready]')`, assert every `!dom` hook exists, `const issues = await auditPage(page)`, `assert.deepStrictEqual(issues, [], JSON.stringify(issues, null, 1))`. Extra tests:
  - `stress mode at 320px has no overflow/overlap` — every screen/state at 320×800 with `&stress=1`.
  - `escape closes overlays` — shell-demo `more-open`: press `Escape` → `body.nav-open` absent.
  - `focus ring visible` — shell-demo: `Tab` to first `.nav-item`/`.tab`; computed `outline-style` ≠ `none` or `box-shadow` ≠ `none`.
  - `reduced motion disables animation` — `emulateMedia({ reducedMotion: 'reduce' })`; every element with non-zero `animation-name` has `animationDuration` ≤ `0.01ms`.
  - `bottom bar labels fit` — shell-demo at 320/360/390: no `.tab` label `scrollWidth > clientWidth`, no two `.tab` rects intersect, `.tab-live` rect does not intersect the icon's rect.
  - `sidebar vs tabbar by width` — at 1023px `.tabbar` visible & `.sidebar` hidden; at 1024px the reverse.
- [ ] **Step 2: Run `npm run layout`.** Expected: FAIL (`audit.js`, `proto.js`, shell-demo missing).
- [ ] **Step 3: Implement `audit.js`** — runs in page via `page.evaluate`, returns issues:
  - `hscroll`: `document.documentElement.scrollWidth > innerWidth + 1`.
  - `overlap`: collect visible text-run rects (Range over each non-empty text node) and `svg`, `img`, `input`, `button` rects; report pairs whose intersection > 4px² where neither node contains the other, they share no ancestor marked `[data-allow-overlap]`, and both are in the same fixed/non-fixed layer.
  - `clip`: elements with `overflow` hidden/clip whose `scrollWidth > clientWidth + 1` or `scrollHeight > clientHeight + 1`, unless computed `text-overflow: ellipsis` or `-webkit-line-clamp` ≠ `none`.
  - `obscured`: after `scrollTo(0, scrollHeight)`, the last visible text rect inside `[data-proto-root]` must end above the top of every **bottom-anchored** `position: fixed|sticky` element (rect bottom ≥ `innerHeight - 1`). Top bars that content scrolls under are fine.
  - `contrast`: inject `node_modules/axe-core/axe.min.js` via `page.addScriptTag({ path })`, run `axe.run({ runOnly: ['color-contrast'] })`, map violations.
  `where` = a short CSS path (`tag#id.class:nth-of-type`).
- [ ] **Step 4: Implement `shell.js`** (interface above; sidebar groups and labels exactly as Global Constraints; Contests live badge `LIVE`, `.tab-live` text `LIVE` above 360px and an `aria-label="Live now"` dot below via CSS).
- [ ] **Step 5: Implement `layouts.css`** — sidebar ≥1024px (`--sidebar-w`, `--surface`, right `--outline`, sticky full height, profile card pinned bottom); `.tabbar` <1024px fixed bottom, `left/right: 12px`, `max-width: 440px; margin-inline: auto`, `--surface`, `--outline`, `--r-nav`, `--shadow-hard`, `padding-bottom: env(safe-area-inset-bottom)`; `.app-main` bottom padding = `calc(var(--tabbar-h) + 24px + env(safe-area-inset-bottom))` below 1024px; active `.tab`/`.nav-item` = `--ink` pill with `--paper` text; `#more-sheet` bottom sheet with scrim, open on `body.nav-open`; `body.shell-chat` hides `.tabbar` below 1024px; `.flow`, `.public`, `.report` layouts; tab labels `white-space: nowrap; font-size: clamp(10px, 2.9vw, 12px)`.
- [ ] **Step 6: Write `screens/shell-demo.html`** (three states: plain home, `more-open` — `<template data-state="more-open" data-body-class="nav-open">`, `contests-live`).
- [ ] **Step 7: Write `index.html`** gallery: fetches `screens.json`; left list grouped by `group` (pass badge); toolbar: width buttons (320/360/390/768/1024/1280/1440 + "Fit"), theme toggle, state `<select>` filled from the selected screen's `states` (labels from the iframe's `Proto.states()`), "Stress text" checkbox, "Open in new tab" link; preview `<iframe>` with the chosen width (height fills window) and `src` = `screens/<file>?state=&theme=&stress=`; uses `postMessage({type:'proto', ...})` for theme/state changes without reload; remembers last selection in `localStorage['proto_gallery']`. Styled with the production CSS only.
- [ ] **Step 8: Run `npm test`** (lint + layout). Expected: PASS for foundations and shell-demo across the full matrix.
- [ ] **Step 9: Checkpoint** — no commit. Manually open `http://localhost:4173/` (`npm run serve`) and click through shell-demo at 360 and 1280 in both themes.

### Task 6: Dashboard (pass 1)

**Files:**
- Create: `ui_redesign/screens/dashboard.html`
- Modify: `ui_redesign/screens.json` — add `dashboard` (states `before-quiz`, `with-results`; hooks `db-title, db-sub, db-cta-btn, db-main, db-stats`)

**Interfaces:**
- Consumes: components, layouts, `CrackeerShell` (`data-active="dashboard"`, `data-live="true"`).

- [ ] **Step 1: Re-consult `/frontend-design` + `/ui-ux-pro-max`** for the dashboard composition.
- [ ] **Step 2: Add the manifest entry; run `npm run lint && SCREENS=<ids> npm run layout`.** Expected: FAIL (file missing).
- [ ] **Step 3: Build `dashboard.html`.** `before-quiz`: greeting (display heading with `.hl`), primary card "Take the career quiz · 25 questions · about 6 minutes" with the rocket illustration and `#db-cta-btn`, four locked `.stat` tiles in `#db-stats` (lock icon). `with-results`: greeting, top-match card (Software Engineer, `.fit-strong` 86%, RIASEC I-R-A tiles, "Open roadmap" CTA), "next step" roadmap card (current stage), top-careers strip `.career-pill[data-career]` (5 persona careers, one long name with `data-stress`), contest teaser `.card-ink` (LIVE, countdown `.num` with `data-until`, rank/score/streak), `#db-stats` 4 tiles, quick actions (Explore, AI Chat, Career Space, Report PDF).
- [ ] **Step 4: Run `npm run lint && SCREENS=<ids> npm run layout`.** Expected: PASS.
- [ ] **Step 5: Checkpoint** — no commit.

### Task 7: Career results report (pass 1)

**Files:**
- Create: `ui_redesign/screens/career-results.html`
- Modify: `ui_redesign/screens.json` — add `career-results` (shell `report`; states `full`, `old-result`, `demo`; hooks: every results-report ID in Appendix A.1, ; `air-retake` and `air-demo-badge` present in all states, `hidden` except in `old-result` / `demo` respectively)

- [ ] **Step 1: Add manifest entry; run `npm run lint && SCREENS=<ids> npm run layout`.** Expected: FAIL.
- [ ] **Step 2: Build `career-results.html`** — report header (`.air-print-head` print-only with `#air-print-date`), personality block, stream box with "Careers in this stream" button, ranked 4 streams with `.bar-row`, RIASEC code tiles + `#air-code-key` meanings + `#air-riasec-bars` (6 dims coloured by dimension) + domains + "what you enjoy", `#air-match-note`, `#air-careers` cards (5 persona careers with fit badges, field, why), actions row `.no-print` (Save PDF, Retake, Home, Open Full App). Each block is a sibling section (fixes the spec §5.3 #8 nesting). Print layout: `@media print` in layouts.css removes chrome and shadows, keeps RIASEC colours (`print-color-adjust: exact`).
- [ ] **Step 3: Add test `print layout hides chrome`** to `layout.test.js`: `emulateMedia({ media: 'print' })` on career-results `full` → every `.no-print` has `display: none`, `.air-print-head` visible.
- [ ] **Step 4: Run `npm run lint && SCREENS=<ids> npm run layout`.** Expected: PASS.
- [ ] **Step 5: Checkpoint** — no commit.

### Task 8: Contests view + weekly contest question (pass 1)

**Files:**
- Create: `ui_redesign/screens/contests.html`, `ui_redesign/screens/contest.html`
- Modify: `ui_redesign/screens.json` — add `contests` (states: `live, upcoming, done, no-career, no-results, payment-required, signed-out`; hooks `lb-root, pg-evolution-rows, pg-ai-note@live,done`) and `contest` (shell `flow`; states initially `question` only; hooks `ct-root, ct-label`)

- [ ] **Step 1: Add both entries; run `npm run lint && SCREENS=<ids> npm run layout`.** Expected: FAIL.
- [ ] **Step 2: Build `contests.html`** — inside `#lb-root`: status banner (`.lb-status.is-live|is-soon|is-done` alongside `.card-ink` styling, countdown `[data-until]`), scope tabs Global + per-career (`[data-career]`), summary cards (this week / live), `.seg` (Top / Around me), leaderboard `.table` with `tr.is-me` and `.lb-hide-sm` columns hidden below 640px, history table with "Answers →" links to `contest.html?state=review` placeholder; `#pg-evolution-rows`; `#pg-ai-note` only in `live`/`done` (spec §5.3 #6). Locked/empty states use `.empty` with the trophy/lock/calendar illustrations.
- [ ] **Step 3: Build `contest.html` state `question`** — `.flow-bar` (Exit, `#ct-label` "Tech Thinkers · Week 12", progress), answer dots `.ct-dot.answered|.current`, question card, options as a `role="radiogroup"` of `.quiz-option(.selected)`, Prev/Next, countdown `.num`.
- [ ] **Step 4: Run `npm run lint && SCREENS=<ids> npm run layout`.** Expected: PASS.
- [ ] **Step 5: Checkpoint** — no commit.

### Task 9: PASS-1 REVIEW GATE (stop)

- [ ] **Step 1: Run `npm test`** — all green. Record the counts (screens × states × themes × widths).
- [ ] **Step 2: Present to the user:** gallery URL (`npm run serve` → `http://localhost:4173/`), the list of pass-1 screens/states, anything tuned from the spec's token values and why.
- [ ] **Step 3: STOP.** Do not start Task 10 until the user approves. Feed requested changes back into Tasks 2–8 (tokens/components first, so the change propagates), re-run `npm test`, re-present.

### Task 10: Public pages — landing, auth, paywall

**Files:**
- Create: `ui_redesign/screens/landing.html`, `ui_redesign/screens/auth.html`, `ui_redesign/screens/paywall.html`
- Modify: `ui_redesign/screens.json` — `landing` (shell `public`; states `default`; hooks none), `auth` (states `login, login-error, register, register-errors, forgot, reset, success`; hooks: `auth-tabs` + login IDs `@login,login-error,success`, `reg-*` `@register,register-errors`, `forgot-*` `@forgot`, `reset-*` `@reset`, `reg-full_name-error, reg-email-error, reg-password-error, reg-confirm-error @register-errors`), `paywall` (states `checking, no-school, not-on-roster, not-subscribed, all-set, error`; hooks `pw-root`, `pw-code, pw-code-btn, pw-code-error @no-school`, `pw-school-slot @not-on-roster,not-subscribed`)

- [ ] **Step 1: Add entries; run `npm run lint && SCREENS=<ids> npm run layout`.** Expected: FAIL.
- [ ] **Step 2: Build `landing.html`** — header (logo, anchors, theme toggle, Login, Get started), hero (two CTAs, display heading with `.hl`, an illustrative result card built from components), facts strip, 6 features, 4 "how it works" steps, final CTA, footer (links to auth and admin login). Copy: no "save later" promise; "about 6 minutes".
- [ ] **Step 3: Build `auth.html`** — `.public` layout, tabs (`.auth-tab` + `.tab-btn`), all forms with `.password-toggle` eyes, field errors in `register-errors`, reset with resend countdown "Resend in 0:42", alerts `#login-ok` (success) / `#login-alert` (login-error).
- [ ] **Step 4: Build `paywall.html`** — `checking` is the only spinner in the product; each reason state explains the reason, School ID form or check-again/wrong-school, two plan cards, includes list, "How to pay" steps, lock illustration; `all-set` with check illustration and Continue; header with theme toggle + Log out.
- [ ] **Step 5: Run `npm run lint && SCREENS=<ids> npm run layout`.** Expected: PASS.
- [ ] **Step 6: Checkpoint** — no commit.

### Task 11: Step flows — onboarding, evaluation, career quiz, AI loading

**Files:**
- Create: `ui_redesign/screens/onboarding.html`, `evaluation.html`, `career-quiz.html`, `ai-loading.html`
- Modify: `ui_redesign/screens.json` — `onboarding` (shell `flow`; states `step-1, step-2, step-3, step-4, error, saving`; hooks `onboarding, ob-count, ob-bar, ob-title, ob-sub, ob-dots, ob-back, ob-next, ob-error` + `ob-step-N@step-N` + per-step field IDs), `evaluation` (states `summary`; hooks `eval-title, eval-sub`), `career-quiz` (states `question, at-cap, nothing-selected, last`; hooks all `cq-*`), `ai-loading` (states `in-progress, done, error`; hooks `al-step1, al-step2, al-step3`)

- [ ] **Step 1: Add entries; run `npm run lint && SCREENS=<ids> npm run layout`.** Expected: FAIL.
- [ ] **Step 2: Build `onboarding.html`** — `.flow-bar` with step count + `.progress` + dots; step 1 selects/inputs; step 2 marks inputs `[data-subject]`; step 3 multi-select `.chip-group[data-proto-select="multi"]` for `#ob-subjects`/`#ob-hobbies` + `#ob-dream`; step 4 single-select chips `#ob-pref`/`#ob-loc`; `error` shows `#ob-error` alert + `.is-invalid` field; `saving` shows `#ob-next.busy`.
- [ ] **Step 3: Build `evaluation.html`** — "Your profile at a glance" card with Aarav's real onboarding answers and one CTA "Start the career quiz · 25 questions · about 6 minutes" (spec §5.3 #3). No `es1–es4`, `eval-spinner`, `eval-signals`.
- [ ] **Step 4: Build `career-quiz.html`** — `#cq-num` "Question 7 of 25", `#cq-area`, `#cq-bar`, options `.cq-opt[data-orig]` with `.cq-letter[data-letter]`, `#cq-hint` "Pick up to 2"; `at-cap` shows 2 selected and the hint emphasised; `nothing-selected` shows the shake class `.shake` (animation, disabled under reduced motion) + hint in `--bad`; `last` shows "See my results".
- [ ] **Step 5: Build `ai-loading.html`** — three `.al-step` rows with `.al-step-icon` (`.done/.loading/.pending`), rocket illustration; `error` with retry button.
- [ ] **Step 6: Add test `flow pages have no app shell`** — for every `shell: "flow"` screen, `.sidebar` and `.tabbar` are absent.
- [ ] **Step 7: Run `npm run lint && SCREENS=<ids> npm run layout`.** Expected: PASS.
- [ ] **Step 8: Checkpoint** — no commit.

### Task 12: App reading screens — career matches, explore, career detail, roadmap

**Files:**
- Create: `ui_redesign/screens/career-matches.html`, `explore.html`, `career-detail.html`, `roadmap.html`
- Modify: `ui_redesign/screens.json` — `career-matches` (states `list, filtered, loading, no-quiz, none-above-min`; hooks `career-list, results-stream-val, results-stream-badge`), `explore` (states `grid, drawer-open, active-filters, no-results`; hooks all `ex-*` + `explore-grid`), `career-detail` (states `full, no-roadmap`; hooks `cd-back, cd-body, cd-rm-note, cd-timeline@full`; `cd-rm-note` is `hidden` in `full`), `roadmap` (states `timeline, picker, not-written, no-quiz`; hooks `rm-career, rm-select, rm-note, rm-timeline@timeline,picker`; `rm-select` hidden except in `picker`, `rm-note` hidden except in `not-written,no-quiz`)

- [ ] **Step 1: Add entries; run `npm run lint && SCREENS=<ids> npm run layout`.** Expected: FAIL.
- [ ] **Step 2: Build `career-matches.html`** — stream banner, working category chips "All + categories present" (`.filter-chip` + `.chip`; `filtered` state shows one category selected and fewer cards), career cards (fit badge, RIASEC tiles, field, salary range, "Why it fits"), Download Report button; `loading` = 4 `.skeleton-card` (spec §5.3 #7); empties with illustrations.
- [ ] **Step 3: Build `explore.html`** — search with clear button, filter button with `#ex-filter-count`, sort select, `#ex-active` pills, `#ex-sub` counts, `.explore-card` grid (`.grid-auto`); `drawer-open` uses `data-body-class="ex-filters-open"` (right drawer ≥1024px, bottom sheet below) with `[data-k]` chip groups for category/stream/min fit and Clear/Apply; `no-results` empty (magnifier illustration).
- [ ] **Step 4: Build `career-detail.html`** — back link, hero (title with `data-stress`, fit %), "How it fits you" 3-part breakdown, RIASEC work areas, at-a-glance facts (`.exa-key/.exa-val`), subjects, embedded `.timeline`, "News & jobs" → Career Space.
- [ ] **Step 5: Build `roadmap.html`** — career heading + picker, `.timeline` with `.tl-item.done` for completed stages, Export PDF; `not-written` and `no-quiz` empties.
- [ ] **Step 6: Run `npm run lint && SCREENS=<ids> npm run layout`.** Expected: PASS.
- [ ] **Step 7: Checkpoint** — no commit.

### Task 13: Career Space, Settings, remaining contest states

**Files:**
- Create: `ui_redesign/screens/career-space.html`, `ui_redesign/screens/settings.html`
- Modify: `ui_redesign/screens/contest.html`, `ui_redesign/screens.json` — `career-space` (states `feed, tab-switched, error, empty`; hooks `sp-careers, sp-tabs, sp-feed, sp-note, sp-foot`; `sp-note` hidden except in `error,empty`, `sp-foot` hidden in `error,empty`), `settings` (states `view, edit-name, edit-school, edit-class, remove-school-warning`; hooks `st-name, st-school, st-email, st-class, st-plan, st-plan-badge`, `st-name-edit, st-name-input, st-name-btn, st-name-error @edit-name`, `st-school-edit, st-code, st-code-error @edit-school,remove-school-warning`, `st-class-edit, st-class-input, st-city-input, st-class-btn, st-class-error @edit-class`); `contest` states become `loading, none-scheduled, upcoming, intro, question, review-before-submit, submitted, review, not-published, error, payment-required, signed-out` (hook `ct-submit@review-before-submit`)

- [ ] **Step 1: Update entries; run `npm run lint && SCREENS=<ids> npm run layout`.** Expected: FAIL.
- [ ] **Step 2: Build `career-space.html`** — career pills `.career-pill`, `#sp-tabs` chips (News / Jobs / …), `a.sp-item` feed rows with optional `.sp-thumb` and external-link icon, `#sp-foot` "Showing 12 of 40", error with retry, empty.
- [ ] **Step 3: Build `settings.html`** — profile, school, account, plan sections as `.card` rows with inline edit forms; `remove-school-warning` explains it leads to the paywall; Retake quiz, Edit interests, Log out. **No notification toggles** (spec §5.3 #2).
- [ ] **Step 4: Extend `contest.html`** with the 11 other states (intro with rules + Start; review-before-submit summary with `#ct-submit`; submitted with unlock countdown + trophy; review with stats and per-question correct/wrong + explanation; locked/empty/error states with illustrations).
- [ ] **Step 5: Run `npm run lint && SCREENS=<ids> npm run layout`.** Expected: PASS.
- [ ] **Step 6: Checkpoint** — no commit.

### Task 14: AI Chat

**Files:**
- Create: `ui_redesign/screens/chat.html`
- Modify: `ui_redesign/screens.json` — `chat` (shell `app`; states `welcome, conversation, streaming, error, memory-open`; hooks `chat-new, chat-mem-btn, chat-scroll, chat-messages, chat-input, chat-send, chat-mem, chat-mem-body, chat-mem-sub`, `chat-welcome` (all states, `hidden` except `welcome`) containing `chat-hello-name, chat-insight, chat-sugs`; `chat-new` hidden in `welcome`; viewports = default 7 plus `[320,568]`)

- [ ] **Step 1: Add entry; run `npm run lint && SCREENS=<ids> npm run layout`.** Expected: FAIL.
- [ ] **Step 2: Build `chat.html`** — `body[data-screen="chat"]` (shell hides the tabbar below 1024px); template top bar with back arrow (below 1024px only), title "AI Chat", `#chat-mem-btn`, `#chat-new`; welcome with `#chat-hello-name`, insight card + "See all I know", suggestion chips `.chat-sug[data-ask]`; messages `.msg(.user) > .msg-avatar + .msg-body > .msg-bubble + .msg-time`, `.msg-sources`, `.msg-mentions`, `.msg-save` under the last reply ("Save this chat as PDF"), one long message with a long URL marked `data-stress`; `streaming` shows `.msg-typing` and `#chat-send.busy` (stop icon `i-square`); `error` shows `.msg-error` + retry and a `.msg-note`; `memory-open` uses `data-body-class="chat-mem-open"` (side drawer above 640px, bottom sheet at ≤640px) with `[data-fact]` items (`.lit`). Composer sticky at bottom, `#chat-input` textarea, Enter hint.
- [ ] **Step 3: Add test `chat composer never covers last message`** — chat `conversation` at 320×568 and 390×800: after scroll to bottom, last `.msg-bubble` rect bottom ≤ composer rect top.
- [ ] **Step 4: Add test `escape closes memory`** — `memory-open` → `Escape` → `body.chat-mem-open` absent.
- [ ] **Step 5: Run `npm run lint && SCREENS=<ids> npm run layout`.** Expected: PASS.
- [ ] **Step 6: Checkpoint** — no commit.

### Task 15: Wrap-up and final review gate

**Files:**
- Create: `ui_redesign/README.md`
- Modify: `.vercelignore` — add `ui_redesign/`

- [ ] **Step 1: Write `README.md`** — how to install/run (`cd ui_redesign/tools && npm install && npm test`, `npm run serve` → `http://localhost:4173/`), gallery controls, file-structure table from this plan, "goes live vs prototype-only" table (css/*, js/shell.js, assets/* go live; proto.js, index.html, screens/, tools/ do not), pointer to spec Appendix A as the hook map, list of token values tuned vs spec.
- [ ] **Step 2: Add `ui_redesign/` to `.vercelignore`.** Verify: `grep -n "ui_redesign" .vercelignore` prints the line.
- [ ] **Step 3: Run `npm test`** from `ui_redesign/tools`. Expected: all PASS; report the matrix size and the total run time.
- [ ] **Step 4: Spec coverage spot-check** — every row of spec §5.1 is a manifest entry with exactly those states (`node -e` one-liner printing `id: states` and compare by eye with §5.1); every §5.3 fix visible in the prototype where it applies (#1 filtered chips, #2 no toggles, #3 profile summary, #4 step rows, #5 copy, #6 AI note, #7 skeletons, #8 section nesting).
- [ ] **Step 5: FINAL REVIEW GATE — present to the user and STOP.** Gallery URL, screen list, test results, and the question: approve the prototype so the live-step plan can be written?
- [ ] **Step 6: Checkpoint** — no commit (user instruction). Leave the working tree for the user.
