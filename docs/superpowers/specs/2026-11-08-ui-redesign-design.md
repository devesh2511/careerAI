# Crackeer student site: UI/UX redesign design

- **Date:** 2026-11-08
- **Status:** design approved in brainstorming; this written spec is awaiting review
- **Source request:** `ui_redesign/ui_redesign.txt`

## 1. Goal

Redesign the UI and UX of the student-facing Crackeer site so it looks intentional and crafted, not "vibe-coded". Everything a student can do today must still work afterwards.

### Agreed with the user

- **Deliverable:** first a clickable HTML/CSS prototype in `ui_redesign/`. After the user approves it, apply the design to the live site as a separate step.
- **Audience:** school students, 13–18.
- **Devices:** phone and desktop get equal weight. Every screen must be responsive, and no text or icon may overlap another.
- **Scope:** the student site only. The admin panel (`admin_login.html`, `admin.html`, `admin.css`, `admin.js`) is out of scope and may get its own pass later.
- **Fake or broken features:** fix or remove them, as listed in §5.3. Nothing a student can really do today is removed.
- **Visual direction:** "Notebook first, playful accents". See §3.
- **Navigation:** a sidebar on desktop and a bottom tab bar on phone and tablet, variant A. See §4.
- **Icons:** line icons for the UI, plus 3D illustrations for big moments only.
- **Dark mode:** kept. Every prototype screen is designed and checked in both light and dark.
- **Build approach:** Approach 1, a static prototype built on the final CSS.
- **Skills:** the prototype is built with `/frontend-design` and `/ui-ux-pro-max`, as the request asks.

### Assumptions

- The backend (`D:\careerAPI`, `D:\chatBot`) and the API contracts don't change.
- The brand name stays "Crackeer".

### Success criteria

1. Every flow in the §8.3 checklist works in the redesigned live site, in both themes, at phone and laptop sizes.
2. Every screen renders without overlap or clipping at 320, 360, 390, 768, 1024, 1280 and 1440px.
3. No raw colour values appear outside `tokens.css`. Both themes come from the same token names.
4. The automated hook check (§8.2) passes, and the existing `npm test` still passes.
5. The user approves the prototype at the pass-1 gate and again at the end of pass 2.

## 2. Current state (summary)

- **What the site is:** a static site with no build step, deployed on Vercel. `/api/*` and `/chat/*` are rewritten to the backend (`vercel.json`).
- **Pages:** 12 HTML pages. Each sets `<body data-page>`, and `scripts/script.js` (about 3,700 lines) routes on it.
- **App views:** `app.html` hosts 8 hash-routed views: dashboard, results (Career Matches), explorer, careerdetail, roadmap, contests, settings and space. `chat.html` copies the app shell.
- **Generated markup:** much of the markup is built as HTML strings in JS: dashboard, cards, paywall, contest and leaderboard (`contest.js`), chat messages, explorer and settings edit forms.
- **Styles:** `style.css` is about 8,900 lines, with large copy-pasted blocks, two self-referencing dark tokens (`--well-inset`, `--tile-lift`), hardcoded dark-palette hex values in the light theme, about 111 inline `style=""` attributes and emoji used as icons.
- **No `[hidden]` rule:** there is no global `[hidden]` rule, yet the JS hides at least 6 elements with the `hidden` attribute.

## 3. Visual foundations

The reference board is the brainstorm screen `foundations.html`. The tokens below are the starting values; the prototype may tune them, but the token names are the contract.

### 3.1 Colour tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | #f6f1e7 | #1b1916 | page background |
| `--surface` | #fffdf8 | #25221e | cards, bars, inputs |
| `--sunk` | #efe8da | #141210 | wells, bar tracks |
| `--ink` | #1d1b18 | #f3ecdf | text, outlines, primary button |
| `--muted` | #6f675b | #a99f90 | secondary text |
| `--line` | #1d1b18 | #cfc4b2 | strong outlines |
| `--line-soft` | #e2d9c8 | #3a352f | input and chip outlines, dividers |
| `--accent` | #e0482b | #ff6f4f | coral fills: live badge, progress, active dot |
| `--accent-text` | #b8361c | #ff8e74 | coral **text** (AA on paper) |
| `--accent-weak` | #ffe3d8 | #3d231c | selected chip, focus ring |
| `--hl` | #ffb59e | #7a3424 | highlighter underline, display headlines only |
| `--ok` / `--ok-weak` | #2f7d4f / #dcefe2 | #6fcf97 / #1e3427 | success, strong fit |
| `--warn` / `--warn-weak` | #a5670f / #fbecd0 | #f2b55a / #3a2c16 | warning, good fit |
| `--bad` / `--bad-weak` | #b42318 / #fbe0dc | #ff8577 / #3d1f1b | errors |
| `--shadow` | #1d1b18 | #000 | hard offset shadow colour |
| `--r --i --a --s --e --c` | #ffc48a #9ad1f5 #d6c4ff #a8e6b8 #ffe08a #f5b8cf | same | RIASEC fills, always with ink text |

**Colour rules**
- The six RIASEC colours are fixed per dimension (R Doer, I Thinker, A Creator, S Helper, E Leader, C Organiser). Each one always appears with its letter or name, so colour is never the only signal.
- Fit levels use status colours (strong = ok, good = warn, low = muted) and replace today's 6-step ramp.
- Text must meet WCAG AA in both themes. Coral text always uses `--accent-text`.

### 3.2 Type

**Fonts.** All are OFL-licensed, self-hosted as woff2 in `assets/fonts/` and loaded with `font-display: swap`. There's no CDN.

| Family | Use | Weights |
|---|---|---|
| Fraunces | display and section headings | 600, 800 |
| Inter | all UI and body text | 400, 500, 600, 700 |
| Space Grotesk | numbers only: countdowns, ranks, scores, fit % | 700, subset to digits and `:#%/+-.` |

**Scale:** display 34/28 (desktop/phone), h2 21, h3 18, body 15–16 with 1.55 line height, small 13, label 11 in uppercase with 0.12em tracking. The root font-size steps used on large screens today (1600/1920/2400px) are kept.

### 3.3 Shape and depth

- **Notebook signature:** a 1.5px `--line` outline plus a `3px 3px 0 var(--shadow)` hard shadow.
  - Used on cards, the nav bar, the profile card and secondary buttons.
  - Inputs and chips use soft `--line-soft` outlines and no shadow, so forms stay calm.
- **Radii:** 8 (cards), 12–20 (nav and pills), 999 (buttons and chips).
- **Spacing:** a 4px base.
- **Focus:** visible on every interactive element, a `--accent-weak` ring plus the `--line` outline.
- **Motion:** short, 150–250ms, using the existing `--ease` / `--ease-out` curves. It's turned off under `prefers-reduced-motion`.

### 3.4 Where the playful accents go

The louder B elements are used only for contests, ranks, streaks, quiz moments and success states:
- the ink contest card with a coral shadow
- the LIVE badge
- Space Grotesk numbers
- 3D illustrations.

Reading screens (results, roadmap, career detail, explore) stay calm.

### 3.5 Icons and illustrations

- **UI icons:** a single SVG sprite in `assets/icons/sprite.svg`. Icons are line style with a 2px stroke and round caps, using `currentColor`. They replace every emoji used as an icon.
- **Illustrations:** 3D images from 3dicons.co as self-hosted webp in `assets/illustrations/`. They're used only for:
  - empty states
  - contest results
  - the quiz start
  - the paywall
  - the success and "all set" states.
- **Licensing:** before an icon is used, its licence is checked with `get_icon` and recorded in `assets/illustrations/LICENSES.md`.

## 4. Navigation and page structure

### 4.1 Page families

| Family | Pages | Navigation |
|---|---|---|
| App | `app.html` (8 views), `chat.html` | the app shell (§4.2) |
| Step flows | onboarding, evaluation, career_quiz, ai_loading, quiz (weekly contest) | no shell; a slim top bar with Back/Exit, the title and progress |
| Public | index (landing), auth, paywall | a simple header: logo, theme toggle, Login or Log out |
| Report | career_results | a simple header plus the report; a print layout without chrome |

The step flows keep today's history guard (`stepInit`/`stepSync`/`stepLeave`), so the browser's Back button steps back one question.

### 4.2 The app shell

**At 1024px and up: the sidebar**
- 216px wide, with the `--surface` background and a `--line` right border.
- Items are grouped:
  - **My path:** Home, Career Matches, Roadmap
  - **Discover:** Explore careers, Career Space
  - **Do:** Contests (with a LIVE badge while a contest is running), AI Chat
- The selected item is a solid `--ink` pill.
- A profile card pinned at the bottom (avatar, name, class) opens Settings and holds the theme toggle. Log out lives in Settings and in the More sheet.
- Content is capped at about 1200px and centred.

**Under 1024px: the bottom tab bar (variant A)**
- Tabs: **Home · Roadmap · Contests · AI Chat · More**.
- It floats: `--surface` background, a 1.5px ink outline, a 20px radius and the hard shadow. The selected tab is a solid ink pill.
- It fills the width on phones and is capped at 440px and centred on tablets. It respects `env(safe-area-inset-bottom)`, and the page gets matching bottom padding so content is never hidden behind it.
- **LIVE indicator:** a small badge beside the Contests icon. Below 360px it shrinks to a dot. It must never cover the icon or the label.
- **Labels** stay on one line at 320px; they shrink or tighten their spacing rather than wrap, truncate or overlap.
- **More** opens a bottom sheet with Career Matches, Explore careers, Career Space, Settings, the theme toggle and Log out. It closes on the scrim, on Escape, and with a swipe down (the swipe-to-close already exists).

**AI Chat on phone and tablet** is full-screen: the bottom bar is hidden, and a top bar with a back arrow appears. The composer sticks above the on-screen keyboard. On desktop, chat sits inside the sidebar layout.

The current `.mobile-topbar` / ☰ / launcher sheet is replaced by the bottom bar and the More sheet.

### 4.3 Flow, unchanged

landing → auth → paywall (if no access) → onboarding (4 steps) → evaluation → career quiz (25 questions) → AI loading → career results → app. The guards, redirects and storage keys stay as they are today.

## 5. Screens

### 5.1 Screen and state inventory

Every screen is one prototype file. Each state is a section chosen with the gallery's state switcher.

| # | Screen file | Live source | States to design |
|---|---|---|---|
| 1 | `landing.html` | index.html | default (hero, how it works, features, final CTA, footer) |
| 2 | `auth.html` | auth.html | login · register (with field errors and password match) · forgot · reset (resend countdown) · success and error alerts |
| 3 | `paywall.html` | paywall.html | checking · no_school · not_on_roster · school_not_subscribed · plans + how to pay · all set · error |
| 4 | `onboarding.html` | onboarding.html | steps 1–4 · validation error · saving |
| 5 | `evaluation.html` | evaluation.html | profile at a glance (§5.3 #3) |
| 6 | `career-quiz.html` | career_quiz.html | question · multi-select at its cap · nothing selected (shake) · last question |
| 7 | `ai-loading.html` | ai_loading.html | in progress · done · save error with retry |
| 8 | `career-results.html` | career_results.html | full report · old question-set result (retake notice) · demo badge · print layout |
| 9 | `dashboard.html` | app #/dashboard | before the quiz (CTA + locked stats) · with results |
| 10 | `career-matches.html` | app #/results | list with working chips · loading skeletons · no quiz yet · no match above the minimum fit |
| 11 | `explore.html` | app #/explorer | grid · filter drawer open (bottom sheet on phone) · active filters · no results |
| 12 | `career-detail.html` | app #/careerdetail | full detail · roadmap not written yet |
| 13 | `roadmap.html` | app #/roadmap | timeline · career picker · roadmap 404 ("still writing") · no quiz yet |
| 14 | `contests.html` | app #/contests | live · upcoming · done · global and per-career scope tabs · leaderboard (with the "me" row) · history · no career · no results · payment required · signed out |
| 15 | `career-space.html` | app #/space | feed · tab switch · error with retry · empty |
| 16 | `settings.html` | app #/settings | view · inline edit (name, school, class) · warning when removing the school |
| 17 | `chat.html` | chat.html | welcome (insight + suggestions) · conversation (sources, mentions, typing, streaming, stop) · error and notes · memory drawer (sheet on phone) · save as PDF |
| 18 | `contest.html` | quiz.html | loading · none scheduled · upcoming (countdown) · intro · question (answer dots) · review before submit · submitted · results review · not published · error · payment required · signed out |

The More sheet and both forms of the app shell are shown on every app screen.

### 5.2 Content rules

- **Sample data:** realistic Indian school-student data: careers, streams, boards, fit percentages, names and contest titles. No lorem ipsum.
- **Long text:** content that can get long (career names, school names, chat text) wraps or line-clamps cleanly and never overflows its card.
- **Loading states:** use skeletons shaped like the content they stand in for, not spinners, except for the paywall's first access check.

### 5.3 Fixes to fake or broken features

1. **Career Matches chips:** they currently only toggle `.active` (`filterChip`, script.js:1057). They become "All" plus each category present in the student's matches, and filter the list on the device.
2. **Settings notification toggles** (cosmetic, script.js:1882): removed.
3. **Evaluation page:** the fake step timers and hardcoded `#eval-signals` are replaced by a "Your profile at a glance" card.
   - It shows the real onboarding answers from `GET /me/profile`: class, board, subjects, hobbies and dream career.
   - It ends with one button, "Start the career quiz · 25 questions · about 6 minutes" (`cqStart()`).
   - The `es1`–`es4` and `eval-spinner` hooks are retired.
4. **AI loading:** the steps `al-step1..3` tick off as the real work finishes (scoring on the device, then `POST /me/career-quiz`), with a minimum display time of about 1.2s, instead of the fixed 3.3s.
5. **Landing copy:** remove "create an account later to save your results" (index.html:191). Use "about 6 minutes" everywhere.
6. **`#pg-ai-note`:** rendered only when it's built from real results. There's no static placeholder.
7. **The 7 hardcoded career cards** (app.html:161–271): removed and replaced by loading skeletons.
8. **career_results.html:92–96:** fix the unclosed `.air-riasec-box` / `.air-riasec-head` nesting (live step).
9. **Two broken dark tokens:** `--well-inset` and `--tile-lift` (style.css:163, 171) go away with the new token file.

## 6. The prototype (`ui_redesign/`)

```
ui_redesign/
  index.html             gallery: screen list, device widths (320–1440), theme switch, state switch
  css/tokens.css         §3 tokens, light + [data-theme="dark"]      → goes live
  css/base.css           reset, fonts, type, [hidden]{display:none!important}, focus, reduced motion, print → goes live
  css/components.css     buttons, chips, inputs, password toggle, cards, fit badges, RIASEC tiles,
                         progress, tabs/segmented, alerts, toasts, drawer/sheet, timeline, table, skeleton → goes live
  css/layouts.css        app shell (sidebar, bottom bar, More sheet), step-flow layout, public, report → goes live
  assets/fonts/          woff2 + OFL licence
  assets/icons/sprite.svg
  assets/illustrations/  webp + LICENSES.md
  screens/*.html         the 18 files in §5.1
  js/proto.js            prototype only: state and theme switching, opening drawers and sheets, demo chip/tab clicks
  README.md              how to view it; the hook map used (Appendix A)
  ui_redesign.txt        the original request (kept)
```

**Rules**
- **Final markup:** screens use the final component class names and include the IDs and `data-*` hooks from Appendix A where the live element exists. That way the markup can be ported directly.
- **No inline styles:** there are no inline `style=""` attributes and no raw colours outside `tokens.css`.
- **Light and dark:** both themes come from the same file through `html[data-theme]`. The gallery switches between them, so there are no duplicate files.
- **Viewing:** it works opened through a local static server (`npx serve ui_redesign` or `vercel dev`).
- **Not deployed:** `ui_redesign/` is added to `.vercelignore`.

**Two passes with a review gate**
- **Pass 1:** foundations page, app shell (sidebar, bottom bar, More sheet), and screens 9 (dashboard), 8 (career results) and 14 (contests), plus the question state of 18. **The user reviews and approves these before pass 2.**
- **Pass 2:** the remaining screens. Then a full review at all widths in both themes.

**Verification before each review:** every screen and state is checked at 320, 360, 390, 768, 1024, 1280 and 1440px in light and dark, for overlap, clipping, horizontal scroll and contrast.

## 7. Live step

This starts only after the full prototype is approved, and gets its own implementation plan.

- **CSS:** move the four CSS files to `/css/` and link them from every student page. Remove `style.css` once nothing references it. `admin.css` and the admin pages are not touched.
  - Check first whether `admin.html` / `admin_login.html` depend on `style.css`. If they do, the old file stays, linked only from the admin pages, until the admin pass.
- **Markup:** rewrite the markup of index.html and every non-admin file in `pages/`, plus the HTML-string templates in `script.js` and `contest.js`, using the prototype's markup.
- **Shared parts:** the theme script that runs before first paint and the shell nav markup each get one source, instead of being copied into every page. Since there's no build step, this is a small JS include, or a single inline snippet kept identical and covered by the hook check.
- **Logic stays:** the API calls, routing, guards, storage keys and JS function names don't change. Inline `onclick="fn()"` handlers keep their function names.
- **Fixes:** apply the §5.3 fixes.
- **Chat PDF:** the export keeps the `.msg / .msg-body / .msg-bubble / .msg-time` structure and is re-tested.

## 8. Testing

### 8.1 Prototype

The viewport and theme matrix in §6, plus the user review gates.

### 8.2 Automated hook check (new)

A new test file is added to `npm test` alongside `tests/riasec.test.js`. It:
- parses `scripts/script.js` and `scripts/contest.js` for `getElementById('…')`, `querySelector(All)('…')` and the known dynamic ID patterns (`ob-step-N`, `reg-<field>`, `reg-<field>-error`, `auth-<k>`, `al-stepN`)
- checks that each referenced static ID exists in the relevant page's HTML or in a JS template string
- fails, listing what's missing, when an ID is missing and isn't marked `retired` in Appendix A.

### 8.3 Manual flow checklist

Run against `careerapi_mock.js`, in both themes, at 360px and 1280px:
1. Register (including field errors and password match), login, forgot password, reset password (resend countdown), the password eye toggle.
2. Paywall: every no-access reason, entering a School ID, Check again, Wrong school, Log out, the all-set redirect.
3. Onboarding steps 1–4, including validation, Back, browser Back and saving each step.
4. Evaluation summary → career quiz (multi-select cap, nothing-selected shake, Back) → AI loading → results.
5. Results: Save PDF (print), Retake, Home, Open Full App, "Careers in this stream", `?print=1`.
6. Dashboard in both states, then every nav item in the sidebar, the bottom bar and the More sheet.
7. Career Matches chips filter, Download Report, empty states.
8. Explore: search, clear, filter drawer (Escape, apply, clear), sort, active-filter pills, URL query, empty state.
9. Career detail: back to wherever it was opened from, embedded roadmap, News & jobs → Career Space.
10. Roadmap: switch career, Export PDF, the 404 and no-quiz states.
11. Contests: scope tabs, leaderboard segments, history → `quiz.html?review=N`, all locked and empty states, countdowns.
12. Weekly contest: every state in §5.1 #18, including answering, review before submit, submitting and reviewing results.
13. Career Space: career pills, tabs, retry.
14. Settings: edit name, school and class; remove the school → paywall; Retake quiz; Edit interests.
15. Chat: suggestions, sending (Enter / Shift+Enter), streaming, stop, sources and mentions, the error, 401 and 402 paths, an expired conversation, the memory drawer and sheet, New chat, Save as PDF.
16. The theme toggle keeps its setting across pages, with no flash of the wrong theme on load.

### 8.4 Responsive

The same width matrix as the prototype, checking for overlap, clipping, horizontal scroll, the safe-area inset and the keyboard in chat.

## 9. Out of scope

- The admin panel.
- Backend or API changes.
- New product features beyond the §5.3 fixes.
- A framework or build-step migration.
- Changes to copy beyond the §5.3 fixes and microcopy needed by the new layout.

---

## Appendix A: Hook contract

These are the hooks the JS depends on. **Keep** is the default. Anything marked **retire** must also be removed from the JS in the live step. A rename must update the HTML and the JS in the same change.

### A.1 Element IDs referenced in `script.js` / `contest.js`

| Area | IDs | Status |
|---|---|---|
| Auth | `auth-tabs`, `auth-forgot`, `auth-reset`, `login-email`, `login-password`, `login-btn`, `login-ok`, `login-alert`, `reg-full_name`, `reg-school_code`, `reg-email`, `reg-password`, `reg-confirm`, `reg-confirm-error`, `reg-<field>-error`, `reg-btn`, `reg-alert`, `forgot-email`, `forgot-btn`, `reset-code`, `reset-new_password`, `reset-confirm`, `reset-btn`, `reset-resend-btn`, `reset-alert`, `reset-to` | keep |
| Paywall | `pw-root`, `pw-code`, `pw-code-btn`, `pw-code-error`, `pw-school-slot` | keep |
| Onboarding | `onboarding`, `ob-step-1..4`, `ob-count`, `ob-bar`, `ob-title`, `ob-sub`, `ob-dots`, `ob-back`, `ob-next`, `ob-error`, `ob-class`, `ob-board`, `ob-medium`, `ob-city`, `ob-subjects`, `ob-hobbies`, `ob-dream`, `ob-pref`, `ob-loc` | keep |
| Evaluation | `eval-title`, `eval-sub` | keep |
| Evaluation | `es1..es4`, `eval-spinner`, `eval-signals` | **retire** (§5.3 #3) |
| Career quiz | `cq-num`, `cq-area`, `cq-bar`, `cq-back-btn`, `cq-q`, `cq-opts`, `cq-hint`, `cq-next-btn`, `cq-question-wrap` | keep |
| AI loading | `al-step1..3` | keep (timing changes) |
| Results report | `air-personality-type`, `air-personality-desc`, `air-stream-val`, `air-stream-reason`, `air-streams-wrap`, `air-streams`, `air-riasec-note`, `air-riasec-code`, `air-code-key`, `air-riasec-bars`, `air-domains-wrap`, `air-domains`, `air-enjoy`, `air-match-note`, `air-careers`, `air-retake`, `air-demo-badge`, `air-print-date` | keep |
| App shell | `user-class` (plus the classes in A.3) | keep |
| Dashboard | `db-title`, `db-sub`, `db-cta-btn`, `db-main`, `db-stats` | keep |
| Career Matches | `career-list`, `results-stream-val`, `results-stream-badge` | keep |
| Explore | `ex-search`, `ex-search-clear`, `ex-filter-btn`, `ex-filter-count`, `ex-sort`, `ex-active`, `ex-sub`, `explore-grid`, `ex-drawer`, `ex-drawer-overlay`, `ex-drawer-title`, `ex-drawer-sub`, `ex-drawer-close`, `ex-drawer-body`, `ex-drawer-clear`, `ex-drawer-apply` | keep |
| Career detail | `cd-back`, `cd-body`, `cd-rm-note`, `cd-timeline` | keep |
| Roadmap | `rm-career`, `rm-select`, `rm-note`, `rm-timeline` | keep |
| Contests view | `lb-root`, `pg-evolution-rows`, `pg-ai-note` | keep |
| Career Space | `sp-careers`, `sp-tabs`, `sp-note`, `sp-feed`, `sp-foot` | keep |
| Settings | `st-name`, `st-name-edit`, `st-name-input`, `st-name-btn`, `st-name-error`, `st-school`, `st-school-edit`, `st-code`, `st-code-error`, `st-class`, `st-class-edit`, `st-class-input`, `st-class-btn`, `st-class-error`, `st-city-input`, `st-email`, `st-plan`, `st-plan-badge` | keep |
| Chat | `chat-new`, `chat-mem-btn`, `chat-welcome`, `chat-hello-name`, `chat-insight`, `chat-sugs`, `chat-scroll`, `chat-messages`, `chat-input`, `chat-send`, `chat-mem`, `chat-mem-body`, `chat-mem-sub` | keep |
| Weekly contest | `ct-root`, `ct-label`, `ct-submit` | keep |

Elements hidden with the `hidden` attribute (they rely on the global `[hidden]` rule): `rm-note`, `rm-select`, `sp-note`, `sp-foot`, `ex-filter-count`, `cd-rm-note`, `chat-new`, `chat-welcome`.

### A.2 Data attributes

`body[data-page]`, `.nav-item[data-page]`, `data-until`, `data-career`, `data-subject`, `data-fact`, `data-k`, `data-orig`, `data-letter`, `data-ask`: all keep.

### A.3 Classes the JS selects or toggles

- **Selected by JS:** `.page`, `.nav-item`, `.user-profile`, `.user-avatar`, `.user-name`, `.sidebar`, `.theme-toggle`, `.auth-tab`, `.password-toggle`, `.field`, `.form-error`, `.chip`, `.dot`, `.cq-opt`, `.cq-letter`, `.al-step`, `.al-step-icon`, `.filter-chip`, `.badge`, `.career-pill`, `.ex-group-chips`, `.ex-group-title`, `.ex-salary`, `.exa-key`, `.exa-val`, `.fc-label`, `.fc-n`, the `.air-*` name/reason/key classes, `.msg`, `.msg-body`, `.msg-bubble`, `.msg-time`, `.msg-actions`, `.msg-save`, `.chat-sug-text`, `.chat-hl`, `.chat-mem-close`, plus `.turn`, `.who` and `.text` in the PDF render.
- **Toggled state classes:** `active`, `selected`, `on` / `off`, `is-on`, `is-invalid`, `is-ok`, `busy` / `idle`, `lit`, `flash`, `dragging`, `done` / `loading` / `pending`, `no-print`.
- **Toggled body classes:** `nav-open` (becomes the More-sheet open state), `ex-filters-open`, `chat-mem-open`.
- **Retired with §5.3 #2:** `.toggle` and the notification toggles' `on` / `off` handling.

All of the above are **keep**, unless the live plan renames one under the rename rule above. The live-step plan finalises this list using the §8.2 check.
