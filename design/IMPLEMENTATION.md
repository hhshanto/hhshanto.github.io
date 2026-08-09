# Noema redesign — implementation plan

Working plan for rebuilding hhshanto.github.io against
`design/design_handoff_noema_site/README.md`. Edit this file as decisions change.

---

## STATUS — update this as the last step of every session

**Next action:** Phase 6 — the ⌘K search palette (1f). Extend `pages/search.json`
with the fields Lunr needs, vendor `lunr.min.js` into `assets/js/`, and rewrite
`assets/js/search.js` as the palette. The focus trap and focus restore are the
accessibility crux of that screen, not an afterthought. `search.js` is still
loaded sitewide by `_layouts/default.html` for a hero search field that no
longer exists — Phase 6 replaces it.

| Phase | | |
| --- | --- | --- |
| 0 | Prep | ✅ 2026-08-09 |
| 1 | Foundation (tokens, type, primitives, styleguide) | ✅ 2026-08-09 |
| 2 | Chrome (nav, footer, theme toggle, default layout) | ✅ 2026-08-09 |
| 3 | Post layout 1c | ✅ 2026-08-09 |
| 4 | Home — **1a confirmed** | ✅ 2026-08-09 |
| 5 | Category index 1d + archive 1e | ✅ 2026-08-09 |
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
- **2026-08-09 — Secondary text gets its own tokens; never use a neutral ramp
  step for text.** Reported as "the header is too dim in light mode", and
  measurement confirmed it: `--color-neutral-600` is 8.2:1 on the dark ground
  but only 3.85:1 on the light one, and neutral-500 falls to 2.59:1 — both
  below AA, and only visibly wrong in light. The ramp inverts with the theme,
  so one step cannot serve both grounds. `--color-text-muted` and
  `--color-text-faint` are now tuned per theme (6.9:1 and 4.9:1 in light,
  7.6:1 and 4.9:1 in dark). `.tools/contrast.mjs` measures them; extend its
  TARGETS list as components land rather than judging by eye.
- **2026-08-09 — The masthead is sticky, and `--masthead-h` is asserted against
  its measured height.** Requested, and not in the handoff, which does not mock
  scroll behaviour. Anything that must clear the bar reads the token:
  `scroll-padding-top` in `_reset.scss` now, the ToC rail's sticky offset in
  Phase 3. A guessed token value drifts silently and lands anchors under the
  header, so `check-chrome.mjs` compares it to the real height at both widths —
  it caught the first values being 10px and 5px short.
- **2026-08-09 — The home hero's `margin-top: -70px` is zeroed in
  `_shell.scss`.** `_hero.scss` pulls the hero up by exactly `$header-height`
  to tuck it under the old *fixed* header. With the masthead in normal flow
  that dragged the dark hero card over the bar, so the nav rendered dark text
  on a dark card — invisible, and only on the home page, which is the only page
  with a hero. This was the real cause of the "not visible" report; the
  measured contrast failures fixed earlier were a genuine but separate bug.
- **2026-08-09 — Run exactly one `jekyll serve`.** Two were running against
  this repo, both watching, both writing `_site`. They clobbered each other
  badly enough that `_site/reflections/` held only `index.html` — every post
  gone from the served site while a clean build was perfect. Diagnosed twice as
  a phantom bug before being fixed at the source.
- **2026-08-09 — 1a wins: the six-domain nav is kept.** The masthead carries
  all five domains; the home page will lead with a split hero, a five-tile
  domain grid, then recent posts beside a CV column. 1b's three-door collapse
  is not being built. Better suited to a knowledge repository, where the
  structure should be visible from the front door.
- **2026-08-09 — The nav is driven by `_data/domains.yml`.** One list feeds the
  masthead, the home domain grid (Phase 4) and the category mastheads
  (Phase 5), so they cannot drift. Counts come from
  `site[domain.collection].size`, never a written-down number. Descriptions are
  the existing `description:` values lifted from each section index page, not
  new copy.
- **2026-08-09 — Theme is applied by an inline `<head>` script, before first
  paint.** The old toggle set `data-theme` inside `DOMContentLoaded`, which
  runs after the first paint, so dark-theme readers saw a white flash on every
  navigation. `theme.js` now only wires the button and is deferred. With no
  stored choice the OS preference wins.
- **2026-08-09 — The screenshot harness builds to `.tools/.site/`, not
  `_site/`.** A `jekyll serve` watching the repo from another terminal rebuilds
  `_site` on every save. Two writers in one directory race: a page screenshotted
  mid-rebuild came back with its whole post list missing, which reads exactly
  like a Liquid bug. Cost an hour. The harness now owns its destination.
- **2026-08-09 — `_sass/_shell.scss` is a deliberate, temporary migration
  bridge.** Imported last, it owns the few places where the new chrome meets
  old page bodies: the page ground, and undoing `.content`'s 70px reservation
  for a fixed header that no longer exists. Nothing new goes in it; Phase 8
  deletes it with the partials it corrects.
- **2026-08-09 — Deleted the `!important` block in `_dark-mode.scss`.** It
  forced `background: #1a1a1a` onto `main`, `.content` and every section
  wrapper, which painted a visibly lighter rectangle behind the content column
  once the ground moved to `--color-bg`. Those elements have no background of
  their own, so inheriting the body ground is correct. A clean demonstration of
  why rule 1 exists.
- **2026-08-09 — `color-mix()` is not used at all; the question is moot.** The
  handoff's mixes are all a literal colour against `transparent`, so Sass
  computes them at build time into plain `rgba()` and libsass never sees the
  function. The mixes that *couldn't* be precomputed — hover tints over
  `var(--color-accent)` — became named tokens instead (`--wash-accent`,
  `--wash-ink`, and so on). That is strictly better than the spec: no runtime
  browser support to worry about, and the dark theme can retune a wash, which
  it needs to, since a 12% ink wash that reads as a tint on paper is invisible
  on a dark ground.
- **2026-08-09 — No compat shim was needed.** The plan called for aliasing old
  token names to new ones. Unnecessary: the two systems use different names
  (`--bg-color` vs `--color-bg`) and `_variables.scss` still defines the old
  set, so un-migrated pages are untouched. The new foundation is imported
  *before* the outgoing partials so old rules still win on old pages.
- **2026-08-09 — New component classes are prefixed `n-`, and the reset is
  `_reset.scss` not `_base.scss`.** Both avoid collisions with the outgoing
  stylesheet's `.btn` / `.card` / `.tag` and its existing `_base.scss` while
  the two systems coexist. Phase 8 deletes the old ones; the `n-` prefix stays,
  since renaming a dozen partials to save one character is not worth it.
- **2026-08-09 — Display type is fluid `clamp()`, not a breakpoint step.** The
  handoff steps sizes down below 700px (82→44, 70→40, 54→34). clamp() hits the
  same endpoints continuously, so no single width makes a heading jump.
- **2026-08-09 — `.n-tag-accent` got its own tokens.** The accent ramp
  deliberately does not invert with theme, so accent-100 stayed a near-white
  fill and glared on the dark ground. Fixed with `--tag-accent-bg` /
  `--tag-accent-ink` rather than a dark-mode rule — when a component seems to
  need a `[data-theme]` rule, that is the signal it is missing a token.
- **2026-08-09 — Everything the home page says about its author lives in
  `_data/profile.yml`.** Kicker, headline, intro, socials, CV rows, focus chips
  and the "currently" line. `index.html` is now front matter only; the page is
  composed entirely by `_layouts/home.html` from that file and
  `_data/domains.yml`. Rewording the home page should not mean opening a
  template, and none of the handoff's hero copy is used — it is placeholder.
- **2026-08-09 — The hero headline is the site's tagline, not a name.** The
  masthead already says NOEMA and the portrait, CV and socials beside it say
  who wrote it; inventing a personal slogan is not the redesign's job. Every
  other word on the page is lifted from the old home page and about section.
  Two lines in `_data/profile.yml` change it to lead with a name instead.
- **2026-08-09 — The five index pages and the archive are front matter only.**
  Each names its `collection:` and inherits `_layouts/category.html`; the
  archive page names nothing at all. Titles, descriptions and nav position come
  from `_data/domains.yml`, so a domain cannot be called one thing in its own
  header and another in the masthead. The long `header-description` sentences
  that used to sit in each page body were kept — they are better copy than the
  short `description:` fields — and are now the `description:` themselves, which
  also improves what jekyll-seo-tag emits.
- **2026-08-09 — Sub-topics are derived from the directory each document sits
  in.** The site has organised writing that way since long before the redesign,
  and it means 1d's sub-topic list needs no new front matter. Collected with a
  hand-rolled loop rather than `group_by_exp`, which cannot address the second
  path segment; keys are probed wrapped in pipes so one cannot match as a
  prefix of another.
- **2026-08-09 — The lead piece's figure reads `figure:`, not `image:`.**
  `_config.yml` gives every page a fallback `image` for link previews, so
  testing that key would put the site logo on all five domain pages. No
  document sets `figure:` yet, so the plate simply does not render — which is
  the intended behaviour, not a gap.
- **2026-08-09 — Both density affordances are left out.** 1e's "Load 2023 and
  earlier" and 1d's "Older notes" have nothing to load: twelve documents across
  five collections, against layouts drawn for 57 and for 14 per domain. Add
  them when the archive outgrows one screen.
- **2026-08-09 — Liquid cannot take a filter on either side of a comparison.**
  `{% unless a | date: "%Y" == b | date: "%Y" %}` is a syntax error, not a
  false condition, and Jekyll reports it as a warning while rendering the page
  anyway. Assign both sides first.
- **2026-08-09 — The archive row places its four spans explicitly at both
  widths.** Left to auto-flow the phone layout gives each span its own line —
  four lines a row, on the one screen whose stated point is density. Date and
  read time share the top line; title and domain span beneath.
- **2026-08-09 — The home page has no domain tile grid.** 1a's five-tile band
  restated the masthead, which carries all five domains on every page, one
  screen below it. Removed at the owner's call, and `domain-tile.html` /
  `_domain-tile.scss` deleted with it rather than left as dead files.
  `_data/domains.yml` still drives the masthead and will drive Phase 5.
  `.hgrid-domains` stays in `_primitives.scss` — it is a handoff primitive, and
  1d may want it.
- **2026-08-09 — The curriculum is its own band under the hero, not a column
  at the foot.** Requested after the first build, and a departure from 1a,
  which puts the CV in a 1fr column beside recent writing. In that column it
  was the last thing on the page and every entry wrapped; as a band it gets the
  full width, and experience and education become separate lists rather than
  one merged timeline — blended, a degree and a job read as the same kind of
  row and neither stands out. Recent writing takes the width it left behind,
  two briefs across from `$bp-md`, because one column at 1160px sets a 14px
  excerpt across about 145 characters.
- **2026-08-09 — A ragged hairline grid needs filler cells.** The grid draws
  its rules by showing its own background through a 1px gap, so five tiles in
  three columns do not leave the sixth cell empty — they leave it *grey*, a
  solid block of divider colour. `_includes/hgrid-fill.html` emits the blanks,
  one set per column count the grid can take, computed from the item count in
  Liquid. `overflow: hidden` on the container would also work and would clip
  the tiles' 2px hover lift, which is why it was not used.
- **2026-08-09 — The domain numeral uses `--color-accent-ink`, not
  `--color-accent`.** The spec asks for the base accent at 22px weight 300,
  which measures 3.02:1 on the light ground — and WCAG only relaxes to 3:1 at
  24px, so it is fractionally under the line for text that size.
- **2026-08-09 — `contrast.mjs` composites translucent backgrounds.** The
  accent chip in dark is a 16% gold wash; measured against its own raw colour
  it reported 1.35:1, which is neither what is painted nor what anyone sees.
  The ground is now blended over the body colour before the ratio is taken.
- **2026-08-09 — `naturalWidth` cannot verify a 2x image source.** It is
  reported in CSS pixels with the density descriptor already divided out, so a
  correctly chosen 600px `2x` candidate reports 300 — indistinguishable from
  the 1x source failing to upgrade. `check-chrome.mjs` asserts on `currentSrc`
  at `deviceScaleFactor: 2` instead.
- **2026-08-09 — The contents list is built by Liquid at build time, not by
  JS.** The old `toc.html` assembled it in a `DOMContentLoaded` handler, so it
  did not exist for a reader with scripting off, did not exist in the HTML for
  a crawler, and appeared a frame late for everyone else. It is now split out
  of the rendered body with a Liquid string split — crude, but the input is
  kramdown's own output, where every heading is exactly `<h2 id="…">`, not
  arbitrary markup. `article.js` is reduced to adding `.is-current`.
- **2026-08-09 — The code block does not invert with the theme, and needed one
  token that does.** `--codeblock-*` and `--tok-*` are declared once on `:root`
  and never re-declared under `[data-theme="dark"]`; they are the only tokens
  in the file that behave that way, which is what the handoff asks for. The
  exception is `--codeblock-edge`: on the dark ground `#2d2b2b` against
  `#201f1d` is a 1.3:1 difference and the block dissolves into the page, so it
  takes a hairline there and none in light. The drop cap went the other way —
  the spec's accent-800 is right on paper and invisible on the dark ground, so
  it uses `--color-accent-ink`.
- **2026-08-09 — Inline code must be excluded by element, not by class.**
  kramdown puts `.highlighter-rouge` on inline `<code>` as well as on the block
  wrapper, so `_rouge.scss` selects `div.highlighter-rouge`. Without the `div`
  every inline snippet becomes a dark padded block in the middle of a sentence.
  `check-chrome.mjs` asserts the two grounds differ.
- **2026-08-09 — The rail ships `open` and JS closes it on a phone**, rather
  than shipping closed and JS opening it on desktop. Both give the same result
  with scripting on; the difference is what a reader without JS gets, and an
  expanded rail is readable at every width while a permanently collapsed one is
  not.
- **2026-08-09 — Tables are wrapped by `article.js` so they can scroll.**
  kramdown emits a bare `<table>` with nothing to scroll inside. `display:
  block; overflow-x: auto` on the table itself works but makes it size to its
  content instead of the column, so that is kept only as the no-JS fallback on
  `.article-body > table` — a selector that stops matching the moment the
  wrapper is inserted.
- **2026-08-09 — Related posts are kept, though 1c does not mock them**, and
  rebuilt on `.n-card`. The Liquid that picks them (shared tags, then same
  subfolder) already worked; deleting working navigation to match a mock that
  never considered it would be a loss. The share-button footer was **dropped**
  from the post layout — say so if you want it back.
- **2026-08-09 — `check-chrome.mjs` waits for scrolling to settle rather than
  for a fixed timeout.** The outgoing `_base.scss` sets `html { scroll-behavior:
  smooth }`, so `scrollTo()` is an animation. Two new assertions failed against
  entirely correct code because they read a scroll-driven value mid-flight — the
  progress bar measured 9% at the bottom of the page. The `settle()` helper
  polls `pageYOffset` until it stops changing. Use it for anything scroll-driven.
- **2026-08-09 — Buttons and inputs are min 44px tall; inputs are 16px.**
  Taller than the mocks draw them. A control too small to hit on a phone is a
  worse failure than one a few pixels off-spec, and iOS Safari zooms the
  viewport on focus for any input under 16px.
