# hhshanto.github.io — Noema

Personal site / digital garden. Jekyll on GitHub Pages, rebuilt against a
design handoff over eight phases. The redesign is complete; there is no
migration left in the tree.

## Read this first

1. **`design/IMPLEMENTATION.md`** — the decisions log at the bottom says what
   has already been settled and why. Read it before reversing anything that
   looks odd: several things that look like mistakes are recorded fixes for
   bugs that were measured.
2. **`design/design_handoff_noema_site/README.md`** — the design spec: tokens,
   seven screens, interactions, responsive rules.

Append to the decisions log whenever something is settled that the spec does
not already say — a divergence, a constraint found at build time, a choice
between two workable options.

Never end a session on a failing build. Commit working-but-incomplete rather
than broken.

## The three rules

These are the whole architecture. Breaking one makes the site as hard to
modify as the version this replaces.

**1. Colour lives in exactly one file.** `_sass/_tokens.scss` declares every
colour, font, space and radius as a CSS custom property — once on `:root` for
light, once under `[data-theme="dark"]` for dark. **No other partial may
contain a hex value.** That is the entire dark-mode strategy; there is no
second set of rules to maintain. If a component needs a colour that doesn't
exist yet, add a token — do not inline the hex.

Check with: `grep -rn '#[0-9a-fA-F]\{3,6\}' _sass/ --include=*.scss`
— hits outside `_tokens.scss` are bugs.

**2. Every component is a triplet sharing one name.**

```
_includes/post-row.html   markup + Liquid
_sass/_post-row.scss      its styles — and only its own class prefix
assets/js/post-row.js     its behaviour, only if it needs any
```

Layouts compose includes and own page-level grid only. No component styling in
a layout, no cross-component styling in a partial.

Import order in `assets/css/style.scss` is tokens → foundation → chrome →
components, and it matters in exactly one place: `_compose.scss` restyles
`.article-body` for its preview pane, so it must come after `_article.scss`.

**3. Mobile-first, four named breakpoints.** Base styles are the phone;
`min-width` queries add complexity upward. Justified text, sticky rails and
multi-column grids are *added* at width, never switched off.

`$bp-sm: 700px` · `$bp-md: 900px` · `$bp-lg: 1160px`, defined in
`_sass/_tokens.scss`. Page padding is the token `--page-pad` (20 → 40 → 56px);
layouts use `padding-inline: var(--page-pad)` and never a literal.

## Hard constraints

- **Sass is libsass 3.7.4** (pinned by the `github-pages` gem). Use `@import`,
  **not** `@use`. No `math.div`, no modern module functions.
- **No npm in the shipped site.** No bundler, no build step beyond Jekyll's own
  Sass pipeline. JS is vanilla, in `assets/js/`, loaded directly. Vendored
  libraries get committed as files — currently `lunr.min.js` (search, loaded on
  first ⌘K) and `marked.min.js` (compose preview, that page only). (`.tools/`
  is dev-only tooling and is exempt — it never ships.)
- **Nothing loads from a third-party origin.** Fonts are self-hosted in
  `assets/fonts/`. `check-chrome.mjs` asserts it.
- **Plugins are fixed** by GitHub Pages: `jekyll-feed`, `jekyll-seo-tag`,
  `jekyll-sitemap`. Nothing else is available; do not plan around a plugin.
- **Content is five collections**, not `_posts`: `natural-sciences`,
  `social-sciences`, `arts-literature`, `reflections`, `contemporary`. Counts
  come from `site.[collection].size` in Liquid — never hardcode a number.
- `_content/_arts-literature/` and `_content/_contemporary/` hold
  **intentionally untracked** drafts. Leave them alone; do not commit them.

## Repo layout

```
_config.yml  gemfile  gemfile.lock  index.html      # pinned at root
README.md    LICENSE  CLAUDE.md     .gitignore

_content/    the five collections (via `collections_dir`)
pages/       every standalone page — about, all-posts, create-post, tags,
             404, search.json, and the five section index pages
_layouts/ _includes/ _sass/ _data/                  # Jekyll conventions
assets/      css, js, images, files
design/      redesign handoff + IMPLEMENTATION.md   # excluded from build
.tools/      dev-only screenshot harness            # excluded from build
```

**Every file in `pages/` must carry an explicit `permalink:`.** The directory
is an organisational convenience only — without a permalink a page publishes to
`/pages/whatever/`. New standalone pages go here, with a permalink, not at the
repo root.

`index.html` stays at root. It is the site entry point and moving it buys
nothing.

## Commands

```
bundle exec jekyll build          # ~2s
bundle exec jekyll serve          # localhost:4000
node .tools/shoot.mjs / /about/   # screenshot paths at 4 widths x 2 themes
node .tools/check-chrome.mjs      # behavioural checks: theme, nav, a11y
node .tools/contrast.mjs          # measured WCAG contrast, both themes
```

**Never pick a text colour by eye — measure it with `contrast.mjs`.** The
neutral ramp inverts with the theme, so the same step is comfortable on one
ground and illegible on the other: neutral-600 measures 8.2:1 in dark and
3.85:1 in light. Secondary text uses `--color-text-muted` /
`--color-text-faint`, which are tuned per theme. Add new targets to the
`TARGETS` list in that file as components land.

**Name the `ground` for anything on a painted band.** `contrast.mjs` measures
against `document.body` unless a target says otherwise, and the footer, the
palette's foot strip and the code block all paint their own background. The
footer read 4.88:1 in dark for two phases while actually sitting at 4.17:1,
because it was being measured against a colour it was not on. A translucent
ground is composited over the body before the ratio is taken.

`check-chrome.mjs` is 135 assertions covering the things a screenshot cannot
show: the theme applied before first paint, the mobile menu, the post ToC and
progress bar, the archive filter, the ⌘K palette's focus trap and restore, the
compose tool's target path and token handling — and four whole-site audits
(every focusable control shows a ring, every internal link resolves, no page
requests a third-party origin, no page scrolls sideways at any of the five
widths in either theme). Run it after touching anything. **Extend it rather
than starting a new checker.**

It serves `.tools/.site/`, which only `shoot.mjs` and the `shoot-*` scripts
build. Run one of those first or you are checking a stale site — the symptom is
a run of failures that make no sense against the code in front of you.

`shoot.mjs` builds the site, serves it on a throwaway port, and writes PNGs to
`.tools/shots/`. Read them back to check work visually — this is the only way
to see the page. Run it before claiming a visual change works. Flags:
`--tag <name>` prefixes filenames, `--no-build` reuses `_site`, `--full`
captures full-page instead of viewport.

**Run it from PowerShell, not the Bash tool.** Git Bash rewrites a leading `/`
argument into a Windows path (`/` becomes `C:/Program Files/Git/`) and the
navigation fails. From Bash, prefix with `MSYS_NO_PATHCONV=1`.

**Both tools build to `.tools/.site/`, never the shared `_site/`.** A
`jekyll serve` running in another terminal watches the repo and rebuilds
`_site` on every save; two writers in one directory race, and the symptom is a
page that screenshots half-empty with collection documents missing. That is
indistinguishable from a real bug, so the harness keeps its own destination.
Do not point it back at `_site`.

**Playwright is pinned to exactly 1.58.0** in `.tools/package.json` — not a
caret range. 1.58.0 is the version whose Chromium revision (1208) is already
cached on this machine, so no browser download is needed. Bumping it triggers
a ~130MB download and gains nothing.

## Secrets

`.env` is gitignored. The compose page (`create-post.md`) needs a GitHub token
held client-side; it lives in `localStorage`, never in the repo.

## Testing UI state

`shoot.mjs` captures pages at rest. State that only exists after interaction
needs its own capture — `.tools/shoot-menu.mjs` opens the mobile nav and
screenshots it, `.tools/shoot-palette.mjs` opens the ⌘K palette (optionally
with a query: `node .tools/shoot-palette.mjs bangla`), `.tools/widths.mjs`
prints layout box geometry at several viewport widths.

**Give scroll-and-search state its own context.** The palette's domain filter
is session state by design, so a `Tab` pressed in one assertion still narrows
the results in the next one — a failure that reads like a broken Enter key.
When a check depends on clean state, open a fresh `browser.newContext()`.

**Wait for scrolling to settle.** Anchor clicks smooth-scroll through the
handler in `_layouts/default.html`, so `scrollTo()` can be an animation. Reading
a scroll-driven value after a fixed `waitForTimeout` catches it mid-flight and
reports a failure against correct code. `check-chrome.mjs` has a `settle(page)`
helper that polls `pageYOffset` until it stops moving — use it.

**Assert geometry, not just visibility.** Playwright's `isVisible()` returns
true for an element that is painted but scrolled off screen. The mobile nav
panel shipped rendering at `top: -125px`, entirely above the viewport, and
passed a visibility check. Check positions, and check them against a
neighbour (`panel.top >= bar.bottom`) rather than a hardcoded number.

**A component that can be an anchor *or* a button needs its own background.**
`.n-tag` had none for four phases, which was invisible while every tag was an
`<a>`; the archive's filter chips are `<button>`s, and a button with no
background takes the UA's pale `buttonface` — five cream boxes on the dark
ground. Anything reusable is eventually rendered as the other element.
