# Crackeer UI redesign prototype

This folder holds a clickable HTML/CSS prototype of every student screen, in light and dark themes. It's built on the CSS that will go live.

- **Spec:** `docs/superpowers/specs/2026-11-08-ui-redesign-design.md`
- **Plan:** `docs/superpowers/plans/2026-11-08-ui-redesign-prototype.md`
- **Original request:** `ui_redesign.txt`

`ui_redesign/` is listed in `.vercelignore`, so the prototype never deploys.

## View it

```bash
cd ui_redesign/tools
npm install          # once: test tools, fonts and icons (devDependencies only)
npm run serve        # http://localhost:4173/
```

The gallery (`index.html`) lists every screen. The toolbar controls:

- **Width:** 320, 360, 390, 768, 1024, 1280, 1440 or Fit.
- **Theme:** light or dark.
- **State:** each screen's states, such as loading, empty, error or locked.
- **Long text:** stretches long names and messages to stress-test the layout.
- **Open in new tab:** opens the current screen on its own.

You can also open any screen directly, for example `screens/dashboard.html?state=with-results&theme=dark&stress=1`.

The gallery fetches `screens.json`, so it needs the local server. Opening the file directly won't work.

## Test it

```bash
cd ui_redesign/tools
npm test                                  # everything: static checks + full browser matrix
npm run lint                              # static checks only
SCREENS=dashboard,chat npm run layout     # browser checks for some screens
QUICK=1 npm run layout                    # 320px and 1280px only (contrast at 1280px)
```

- **`lint.test.js`** (static checks):
  - every screen in `screens.json` exists and has exactly its listed states
  - every hook ID the live JS needs is present in each state
  - IDs are unique within a state
  - no inline styles
  - no colour values outside `css/tokens.css`
  - no CDN links
  - no emoji
  - the theme snippet comes before the stylesheets
  - every CSS variable used is defined
  - every icon and illustration exists and has a licence
- **`layout.test.js`** (in your installed Chrome): every screen, state, theme and width is checked by `audit.js` for:
  - horizontal scroll
  - overlapping text or icons
  - text spilling out of chips, buttons or cards
  - clipped content
  - content hidden under a bottom bar
  - colour contrast (axe-core)

  It also runs these behaviour checks:
  - Escape closes sheets and drawers
  - focus is visible
  - reduced motion stops animation
  - bottom-bar labels and the LIVE badge fit
  - the sidebar and tab bar switch at 1024px
  - print hides the page chrome
  - step-by-step flows have no app navigation
  - the chat message box never covers the last message

  A planted-defect fixture (`tools/fixtures/audit-bad.html`) proves the audit can fail.

## Files

| Path | What it is | Goes live? |
|---|---|---|
| `css/tokens.css` | Colour, type, spacing, radius and shadow tokens, light + `[data-theme="dark"]` | Yes |
| `css/base.css` | Fonts, reset, typography, global `[hidden]` rule, focus, reduced motion, print | Yes |
| `css/components.css` | Buttons, forms, chips, tabs, cards, badges, RIASEC tiles, progress, alerts, sheets, timeline, tables, skeletons, empty states, quiz options… | Yes |
| `css/layouts.css` | App shell (sidebar, bottom bar, More sheet), step flows, public pages, report, page compositions, chat | Yes |
| `js/shell.js` | Renders the sidebar, bottom bar and More sheet into `[data-shell="app"]` | Yes, as the single source of the nav |
| `assets/fonts/` | Fraunces, Inter, Space Grotesk (woff2, OFL) | Yes |
| `assets/icons/sprite.svg` | 48 Lucide line icons (ISC), built by `tools/build-sprite.js` | Yes |
| `assets/illustrations/` | 11 CC0 3D illustrations from 3dicons, 200px and 400px (licences in `LICENSES.md`) | Yes |
| `js/proto.js` | Prototype runtime: state and theme switching, fake chip, tab and sheet interactions | No |
| `screens/*.html` | One file per screen. Each state is a `<template data-state>` | Markup gets ported, the files don't |
| `screens.json` | Manifest of screens, states and hook IDs | No |
| `index.html` | Gallery | No |
| `tools/` | Server, tests, audit, sprite builder, screenshot helper (`shot.js`) | No |

## Hooks the live JavaScript depends on

Screens keep the element IDs, `data-*` attributes and state classes that `scripts/script.js` and `scripts/contest.js` use. Spec Appendix A is the contract, and `screens.json` lists the IDs checked for each state.

Elements the live JS hides with the `hidden` attribute are present in every state, carrying `hidden` where inactive. That exercises the global `[hidden] { display: none !important }` rule.

## Changes from the spec

Each of these was ruled on during the build. They're also recorded in the implementation ledger.

- **Contests LIVE indicator:** a dot below 480px, and the word LIVE from 480px up. A badge at 360px couldn't sit beside the icon without overlapping it.
- **Illustrations:** the colour style in white sticker tiles, because the webp files are opaque. "Success" uses a thumbs-up, since 3dicons has no check mark.
- **Tuned colours:** `--muted`, `--ok`, `--warn`, `--bad` and `--accent-text` are slightly darker than the spec's starting values, for AA contrast. The token names are unchanged.
- **Extra tokens:**
  - `--on-pastel`: text on RIASEC tiles
  - `--live-bg` and `--live-ink`: the LIVE badge
  - `--contest-*`: the contest card
  - `--illo-bg`: the illustration tiles
  - `--scrim`: the backdrop behind sheets and drawers
  - `--skeleton*`: loading placeholders
  - `--print-*`: print colours
- **Uppercase labels** are used only for table headers and tiny tags.
- **Progress and score bars** are native `<progress>` elements, because the prototype allows no inline `style` widths.

## Notes for the live step

- `#db-cta-btn` is a `<button>` before the quiz and an `<a>` with results. Check what `script.js` does with it.
- Quiz areas in `riasec_engine.js` contain emoji (for example "📱 Build an App"). `#cq-area` must show them without the emoji.
- Countdowns are static text in the prototype. Live ones keep using `[data-until]`.

## Live step (done)

The design is now live on every student page. The prototype here stays frozen as the reference.

- **Live CSS:** `/css/*.css` is a fork of `ui_redesign/css/*.css`. The live copy has extra rules for markup that `script.js` builds: buttons used as nav and cards, alerts filled with text, the chat memory panel's `chat-mem-*` classes and the access-failed screen.
- **Shell:** `/scripts/shell.js` renders the sidebar, bottom bar and More sheet on `app.html` and `chat.html`. It loads before `script.js`.
- **Admin pages:** `admin.html` and `admin_login.html` still use `style.css`. They're unchanged and guarded by a hash test.
- **Tests:**
  - `npm test` (repo root) runs the hook contract, the page rules and the quiz engine tests.
  - `npm --prefix tests/browser test` (`FULL=1` for all 7 widths) loads every student page in Chrome against stubbed API responses and runs this folder's layout audit on every state.
