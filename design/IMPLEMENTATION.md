# Noema redesign — implementation plan

Working plan for rebuilding hhshanto.github.io against
`design/design_handoff_noema_site/README.md`. Edit this file as decisions change.

---

## STATUS — update this as the last step of every session

**Next action:** Phase 1, step 1 — download and self-host the two font families.

| Phase | | |
| --- | --- | --- |
| 0 | Prep | ✅ 2026-08-09 |
| 1 | Foundation (tokens, type, primitives, styleguide) | ☐ |
| 2 | Chrome (nav, footer, theme toggle, default layout) | ☐ |
| 3 | Post layout 1c | ☐ |
| 4 | Home 1a/1b — **blocked on the IA decision** | ☐ |
| 5 | Category index 1d + archive 1e | ☐ |
| 6 | Search palette 1f | ☐ |
| 7 | Compose 1g | ☐ |
| 8 | Cleanup | ☐ |

Never end a session on a failing build. A half-finished phase gets committed
working-but-incomplete, never broken.

Three constraints drive every choice below:

- **Modular** — one concern per file, so a later change touches one file.
- **Responsive** — mobile and desktop from the same markup, no separate templates.
- **Themed** — light and dark from the same CSS, no parallel rule sets.

---

## The three architectural rules

Everything else in this plan follows from these. Break them and the redesign
becomes as hard to modify as what it replaces.

### 1. Colour lives in exactly one file

`_sass/_tokens.scss` declares every colour, font, space and radius as a CSS
custom property, twice: once on `:root` (light) and once under
`[data-theme="dark"]`. **No other partial may contain a hex value.**

This is the whole dark-mode strategy. The current site half-does this already —
`_sass/_variables.scss` re-declares tokens under `[data-theme="dark"]`, which is
right, but `_about.scss`, `_hero.scss`, `_latest-posts.scss`, `_forms.scss` and
`_search.scss` still hardcode colours, which is why `_dark-mode.scss` ends in a
wall of `!important`. That file should not exist when this is done.

The naming collision is deliberate and temporary: the new tokens are
`--color-bg` / `--color-text` / `--color-accent`, the old ones are `--bg-color` /
`--text-color`. During migration `_tokens.scss` ends with a **compat shim**
aliasing old names to new (`--bg-color: var(--color-bg)`), so un-migrated pages
keep rendering. The shim is deleted in Phase 8 — its removal is how we prove
nothing still depends on the old system.

### 2. Every component is a triplet, named once

A component is at most three files sharing one name:

```
_includes/post-row.html     markup + Liquid
_sass/_post-row.scss        its styles, imported by assets/css/style.scss
assets/js/post-row.js       its behaviour, only if it needs any
```

Styles for a component live in that component's partial and nowhere else. A
partial styles only its own class prefix. To change how post rows look you open
`_post-row.scss`; to change what they contain you open `post-row.html`. No
hunting.

Layouts compose includes and own **only** page-level grid. They contain no
component styling.

### 3. Mobile-first, four named breakpoints

The handoff specifies responsive behaviour desktop-down (`< 900px`, `< 700px`).
Author it the other way round — base styles are the phone, `min-width` queries
add complexity upward. Justified text, sticky rails and multi-column grids are
then *additions* at width rather than things to remember to switch off.

Breakpoints as Sass variables in `_tokens.scss` (libsass 3.7 — `@import`, not
`@use`; no `math.div`):

```scss
$bp-sm: 700px;   // display type steps up, justification on
$bp-md: 900px;   // multi-column layouts appear, ToC rail becomes sticky
$bp-lg: 1160px;  // content frame caps, page padding reaches 56px
```

Page padding is a token, not a literal: `--page-pad` = 20px → 40px at `$bp-md`
→ 56px at `$bp-lg`. Every layout uses `padding-inline: var(--page-pad)`. One
edit re-gutters the entire site.

---

## Phase 0 — Prep

This project spans many sessions, each starting with no memory of the last.
Phase 0 exists to make a cold start cheap.

1. **Commit the untracked files** — `_arts-literature/`, `_contemporary/` and
   `design/`. **Commit, do not stash.** The handoff README is the spec for all
   eight phases; in a stash it is one `git stash drop` from gone, and the
   project loses its source of truth mid-flight. Nothing else starts until
   `git status` is clean.
2. **Branch:** `git checkout -b redesign-noema`.
3. **Write `CLAUDE.md`** at the repo root, loaded automatically every session.
   It carries, briefly: the three architectural rules above; the build and
   screenshot commands; the hard constraints (libsass 3.7 — `@import` not
   `@use`, no `math.div`; no npm in the shipped site; GitHub Pages' fixed
   plugin list); and a pointer to this file for status. Without it, a fresh
   session hardcodes a hex value into a component partial and the dark theme
   rots silently.
4. **Screenshot harness** in `.tools/` — a dot-directory, so Jekyll excludes it
   from the build automatically and no `_config.yml` change is needed.
   `npm i -D playwright` there (Chromium is already cached on this machine, so
   no browser download), plus `shoot.mjs`: boots the built site, captures each
   given path at 375 / 700 / 900 / 1440px in both themes, writes PNGs to
   `.tools/shots/`. Commit the script; gitignore `.tools/node_modules/` and
   `.tools/shots/`. This is dev-only tooling and never ships — the site keeps
   its no-node property.
5. **Verify the toolchain** — `bundle exec jekyll build` succeeds, so a later
   breakage is attributable to the redesign. *(Checked 2026-08-08: builds in
   1.7s; `webrick` is in the lockfile, so `jekyll serve` works on Ruby 3.3.7.)*

**Done when:** clean tree, branch exists, `CLAUDE.md` committed, and
`shoot.mjs` produces a readable before-shot of the current site.

**Take the before-shots.** Capture the existing home, a post and the archive
before anything changes. Eight phases from now they are the only record of what
the site used to look like.

---

## Phase 1 — Foundation

No page changes. This phase only adds capability.

1. **Fonts.** Download Cormorant Garamond (300–700, roman + italic) and Lora
   (400–700, roman + italic) as woff2 into `assets/fonts/`. `@font-face` them in
   `_sass/_fonts.scss` with `font-display: swap`. Self-hosted, not hotlinked —
   the mockup's Google `@import` is convenience only, and an `@import` at the top
   of a stylesheet serialises requests.
2. **`_sass/_tokens.scss`.** Port the `:root` block from
   `mockups/_ds/classical-…/styles.css` verbatim. Then add the dark block using
   the handoff's inversion: `--color-bg: #201f1d`, `--color-surface: #2d2b2b`,
   `--color-text: #f3f2f2`, divider at 16% white, accent stepping to
   `--color-accent-400 #e1ad66`. Add `--page-pad` and the breakpoint variables.
   End the file with the compat shim from rule 1.
3. **`_sass/_base.scss`** — reset, `body`, the global
   `:focus-visible { outline: 2px solid var(--color-accent) }`, `::selection`,
   and the `prefers-reduced-motion` block that kills every transform and
   transition site-wide while keeping colour changes.
4. **`_sass/_type.scss`** — the heading and body scale, `tnum` on the numeric
   classes, and the mono metadata face. Justification (`text-align: justify;
   hyphens: auto`) applies only from `$bp-sm` up.
5. **`_sass/_primitives.scss`** — the four things every screen reuses: `.hr`,
   `.plate`, the hairline grid (`display:grid; gap:1px; background: divider`
   with children on `--color-bg`), and the hover behaviours `.nvl` / `.pcard` /
   `.ttl`.
6. **`_sass/_ui.scss`** — buttons, tags, cards, inputs, table, ported from the
   design system's component layer.
7. **`styleguide.md`** — a page rendering every token swatch, type size, button,
   tag, card and input on one screen. Front matter `sitemap: false`.

**Why the styleguide matters:** it is the only place you can verify light,
dark, mobile and desktop in four looks at one page, and it stays useful forever
as the place to try a change before touching a real page.

**Risk to clear here:** the tokens use `color-mix(in srgb, …)`. libsass 3.7 is
from before that function existed. It should pass unknown functions through
untouched, but confirm on the first build that `_site/assets/css/style.css`
contains a literal `color-mix(` — if libsass mangles the `in srgb` argument,
fall back to `rgba()` literals for the divider and hover tints and note it here.

**Done when:** styleguide renders correctly in both themes at 375px and 1440px,
and no existing page has visibly changed.

---

## Phase 2 — Chrome

The frame every page sits in.

1. `_includes/head-nav.html` + `_sass/_nav.scss` — brand, nav links,
   `aria-current="page"` for the accent underline, `⌘K` trigger.
2. Responsive nav: below `$bp-md` collapses to brand + `⌘K` + a disclosure
   button. Reuse [assets/js/mobile-menu.js](../assets/js/mobile-menu.js), it
   already does this. Tap targets ≥ 44px.
3. `_includes/footer.html` + `_sass/_footer.scss`.
4. `_layouts/default.html` rewritten to compose the two, with the content frame
   (`max-width: 1160px`, `--page-pad`).
5. `assets/js/theme.js` — extract the existing toggle, honour
   `prefers-color-scheme` on first visit, persist to `localStorage`. Set
   `data-theme` in a tiny inline `<head>` script **before** first paint, or the
   page flashes light before going dark.

**Done when:** every existing page still works, wearing the new chrome, in both
themes at both widths.

---

## Phase 3 — Post layout (1c)

The most important screen, and the one your real content actually fills.

1. `_layouts/post.html` — the `200px 1fr` grid above `$bp-md`; single column
   below, with the ToC rail collapsing into a `<details>` block above the
   article and dropping `sticky`.
2. `_sass/_article.scss` — measure (`70ch`), drop cap, pull quote, standfirst,
   byline strip. Justification only from `$bp-sm`; left-aligned below, because
   justified text at phone measure opens rivers.
3. `_sass/_rouge.scss` — map the mockup's four token colours onto Rouge's class
   names (`.k`, `.nf`, `.mi`, `.nb`). Dark ground both themes; the code block
   is one of the few places that doesn't invert.
4. `_includes/toc.html` — rework the existing include to the new markup.
5. `assets/js/article.js` — reading-progress bar and ToC scroll-spy, both
   rAF-throttled, both using `IntersectionObserver` for the spy. Skip entirely
   under `prefers-reduced-motion` for the progress bar.
6. `_includes/post-navigation.html` — prev/next hairline grid.

**Done when:** a real post reads correctly, ToC tracks, progress bar tracks,
and the whole thing degrades to one column on a phone.

---

## Phase 4 — Home

**Blocked on your 1a-vs-1b decision.** 1a keeps the six-domain nav; 1b collapses
to Writing / Work / About with domains as tags. The nav shape differs, so
Phase 2's `head-nav.html` gets a small edit once this is settled.

`_layouts/home.html` + `_includes/domain-tile.html` (1a) or the three-door and
`.card` grid (1b) + `_sass/_home.scss`. Domain post counts come from
`site.[collection].size` in Liquid — no hardcoded numbers.

---

## Phase 5 — Index and archive (1d, 1e)

`_layouts/category.html`, `_layouts/archive.html`, `_includes/post-row.html`,
`_sass/_archive.scss`, `assets/js/archive-filter.js` (toggles `hidden` on
pre-rendered rows — no pagination plugin, and `jekyll-paginate` isn't installed).

**Read the density note before building these.** Screen 1e is designed for 57
posts and says "density is the point"; 1d assumes 14 notes per domain. You
currently have 11 documents across five collections — one each in
natural-sciences, arts-literature and contemporary. The layouts will work but
look sparse, and the "Older notes" / "Load 2023 and earlier" affordances have
nothing to load. Reasonable to build these last, or to build 1e and defer 1d
until the domains fill out.

---

## Phase 6 — Search palette (1f)

1. Extend [search.json](../search.json) with the fields Lunr needs: title, url,
   date, categories, tags, excerpt.
2. Vendor `lunr.min.js` into `assets/js/` (no npm).
3. Rewrite [assets/js/search.js](../assets/js/search.js) as the palette: build
   the index lazily on first open, `⌘K`/`Ctrl+K` to open, `Esc` to close, `↑↓`
   wrapping, `Enter` to navigate, `Tab` to cycle domain filter.
4. **Focus trap and focus restore.** This is the accessibility crux of the
   screen — trap focus inside the panel while open, return it to the trigger on
   close.
5. On mobile the 620px panel becomes full-width with `--page-pad` margins; the
   keyboard-hint footer strip hides below `$bp-sm` since there are no keys.

---

## Phase 7 — Compose (1g)

Redesign of the existing [create-post.md](../create-post.md) +
[post-creator.js](../assets/js/post-creator.js). Three panes above `$bp-md`;
desktop-only, so below `$bp-md` show the "compose on a larger screen" notice
rather than trying to reflow it.

**Security note:** committing to the repo needs a GitHub token held
client-side on a public static site. Keep the page out of `sitemap.xml` and the
feed (`sitemap: false` in front matter), scope the token as narrowly as GitHub
allows, and never commit one to the repo.

---

## Phase 8 — Cleanup

The phase that makes the modularity real rather than aspirational.

1. Delete the compat shim from `_tokens.scss`. Rebuild. Anything that breaks was
   still on the old token system — fix it properly, don't restore the alias.
2. Delete `_sass/_dark-mode.scss`, `_variables.scss`, and the superseded
   `_about / _hero / _latest-posts / _section-index` partials.
3. `grep -rn '#[0-9a-fA-F]\{3,6\}' _sass/ --include=*.scss` should return hits
   only in `_tokens.scss`.
4. Contrast audit: the accent clears 3:1 on light ground, so it is legal for
   large text, icons and rules but **not** body-size text — small accent text
   must use `--color-accent-700`. Check every instance.
5. Keyboard pass: tab through every page, confirm the focus ring is always
   visible and never the browser default.
6. Check at 375 / 700 / 900 / 1160 / 1440px in both themes.

---

## Content, before you ship

The handoff is explicit: only four items in the mockups are real — the two March
2025 posts, the CV entries, and the Technical Focus tags. Every other title,
excerpt, date and statistic is invented placeholder copy. None of it ships.

Two assets are also missing: a portrait ≥ 600px wide (1a renders at 300px at
4:5, so it needs `@2x`), and a figure image for 1d's lead-piece plate, or that
block gets omitted per-post when a post has no image.

---

## Final file layout

```
_layouts/     default · home · post · category · archive
_includes/    head-nav · footer · post-row · post-card · domain-tile ·
              search-palette · toc · post-navigation
_sass/        _tokens · _fonts · _base · _type · _primitives · _ui ·
              _nav · _footer · _article · _rouge · _home · _archive ·
              _search · _compose
assets/css/   style.scss   (front-matter fenced, @imports in that order)
assets/js/    theme · article · search (+ lunr.min) · archive-filter ·
              mobile-menu · post-creator
pages/        styleguide.md (new) · search.json · the existing pages
_content/     the five collections
```

New pages go in `pages/` **with an explicit `permalink:`** — without one they
publish to `/pages/…`. So `styleguide.md` needs `permalink: /styleguide/` and
`sitemap: false`.

Import order in `style.scss` matters: tokens → fonts → base → type →
primitives → ui → components. Everything downstream depends on tokens; nothing
depends on a component.

---

## Decisions log

Append here whenever something is settled that the handoff does not already
say — a divergence from the spec, a constraint discovered at build time, a
choice between two workable options. Without this, a later session re-opens a
question an earlier one already answered, or silently reverses it.

Format: `date — decision — why`.

- **2026-08-08 — Visual verification runs through a local headless browser
  (Playwright in `.tools/`), not through pasted screenshots.** A pixel-accurate
  spec needs a feedback loop tighter than one review per phase; Chromium was
  already cached locally, so the cost was an npm package in a dot-directory
  that never ships.
- **2026-08-08 — Mobile-first authoring, against the handoff's desktop-down
  phrasing.** Same breakpoints and same result; makes justification, sticky
  rails and multi-column grids additive at width rather than things to
  remember to switch off.
- **2026-08-09 — Playwright pinned to exactly 1.58.0, not a caret range.** Its
  Chromium revision (1208) is the one already cached on this machine; `^1.49`
  resolved to 1.62.1, which wants 1234 and triggers a ~130MB download for no
  benefit. Do not bump it casually.
- **2026-08-09 — The untracked drafts in `_arts-literature/` and
  `_contemporary/` stay untracked, at the owner's instruction.** Only `design/`
  and the new tooling were committed in Phase 0, so `git status` is
  deliberately not clean. Leave those two directories alone.
- **2026-08-09 — Repo reorganised before Phase 1: `collections_dir: _content`,
  and every standalone page moved to `pages/` with an explicit `permalink:`.**
  Root held ten directories, five of which existed only to hold a single
  `index.md`. Done before Phase 1 so eight phases of new files land in the
  right place rather than being moved later. Verified by diffing `_site`
  before and after: 38 of 40 files byte-identical, sitemap holding the same 23
  URLs in a different order, feed differing only by build timestamp.
  `_layouts/`, `_includes/`, `_sass/` and `_data/` were deliberately **left at
  root** — Jekyll can relocate them, but every doc and every future session
  assumes the conventional location.
- *(pending)* — 1a vs 1b home-page IA. Blocks Phase 4 and a small edit to
  `head-nav.html`.
- *(pending)* — does libsass 3.7 pass `color-mix(in srgb, …)` through intact?
  Answered on the first Phase 1 build. If not, the divider and hover tints fall
  back to `rgba()` literals.
