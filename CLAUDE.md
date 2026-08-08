# hhshanto.github.io — Noema

Personal site / digital garden. Jekyll on GitHub Pages. Currently mid-way
through a full visual redesign.

## Redesign in progress — read this first

The site is being rebuilt against a design handoff. Before doing any work:

1. **`design/IMPLEMENTATION.md`** — the plan. Its STATUS block at the top says
   which phase is done and what the next action is. Its decisions log at the
   bottom says what has already been settled and why.
2. **`design/design_handoff_noema_site/README.md`** — the design spec itself:
   tokens, seven screens, interactions, responsive rules.

Update the STATUS block and append to the decisions log as the **last step of
every session**. A session that does work without updating them has cost the
next session an hour.

Never end a session on a failing build. Commit a half-finished phase
working-but-incomplete rather than broken.

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
  libraries get committed as files. (`.tools/` is dev-only tooling and is
  exempt — it never ships.)
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

`check-chrome.mjs` asserts the things a screenshot cannot show — that the theme
is applied before first paint, that the mobile menu opens and Escape closes it
with focus restored, that the current domain is marked while reading one of its
posts, that Tab reaches the skip link. Run it after touching the layout, the
masthead or either script. Extend it rather than starting a new checker.

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
