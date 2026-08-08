# Handoff: Noema — personal site redesign (hhshanto.github.io)

## Overview

A visual redesign of Hasan Ibne Saleh's personal site / digital garden, "Noema".
Six screens are mocked, including **two competing information architectures for the
home page** — the client has not yet chosen between them, so implement whichever
they pick (see "Open decision" at the bottom).

The site is a **Jekyll 3.10.0 site on GitHub Pages** (github-pages gem v232, Liquid
4.0.4, kramdown 2.4, Rouge 3.30, Sass 3.7.4 libsass-era `@import`, style: compressed,
vanilla JS ~15 KB across 3 files, no node, no bundler, no CI). Everything below is
written to be implementable inside those constraints — no build step beyond Jekyll's
own Sass pipeline, no npm packages.

## About the design files

The files in `mockups/` are **design references created in HTML** — prototypes that
show the intended look and behaviour. They are **not production code to copy**.
`Noema Mockups.dc.html` is authored in a component runtime (`support.js`) that has
nothing to do with Jekyll; do not port that runtime.

The task is to **recreate these designs in the existing Jekyll site**: Liquid layouts
and includes under `_layouts/` and `_includes/`, styles in `_sass/` partials imported
by `assets/css/style.scss`, behaviour in the existing vanilla JS files. Read the
mockup markup for structure and exact values, then rewrite it idiomatically.

`mockups/_ds/…/styles.css` is the **design-system token sheet and component layer**.
Its `:root` block is the source of truth for every colour, font, spacing and radius
value in this document. Port those tokens into a `_sass/_tokens.scss` partial as CSS
custom properties (keep them as custom properties, not Sass variables — dark mode
depends on re-declaring them under a `[data-theme="dark"]` selector).

## Fidelity

**High-fidelity.** Colours, type, spacing and interaction states are final. Recreate
pixel-accurately at the desktop width the mocks were drawn at (1160 px content frame;
the frame's inner page padding is 56 px left/right). Responsive behaviour below that
is *not* mocked — see "Responsive" for the rules to apply.

Every mock is drawn inside a fake browser chrome bar (three dots + URL pill). **That
chrome is presentation only — do not build it.**

---

## Design tokens

Copy verbatim from `mockups/_ds/classical-fc70aae8-b8a0-4853-a326-8a7b52bbb637/styles.css`.
The essentials:

### Colour

| Token | Value | Use |
| --- | --- | --- |
| `--color-bg` | `#f3f2f2` | page ground |
| `--color-surface` | `#eae9e9` | footer, toolbar strips, image mats |
| `--color-text` | `#201f1d` | body text |
| `--color-accent` | `#b68235` | gold — **stroke, rules and underlines only** |
| `--color-divider` | `color-mix(in srgb, #201f1d 16%, transparent)` | every hairline |

Neutral ramp: `100 #f8f4f4`, `200 #eae7e7`, `300 #d7d3d3`, `400 #bab6b6`,
`500 #9b9797`, `600 #7d7979`, `700 #605d5d`, `800 #444141`, `900 #2d2b2b`.

Accent ramp: `100 #fff3e4`, `200 #ffe3bf`, `300 #facb8d`, `400 #e1ad66`,
`500 #c28d41`, `600 #a06f24`, `700 #7d5411`, `800 #5a3b0a`, `900 #3a270d`.

**Contrast rule:** `--color-accent` on the light ground clears 3:1 — fine for large
text, icons and chrome, **not** for body-size text. Small accent text in the mocks
uses `--color-accent-700` (`#7d5411`). Keep that distinction.

**Colour discipline:** the accent is never a fill. No solid gold buttons, no gold
cards, no gradients. It appears as 1px borders, 2px left rules, underlines, small
kicker text and 10–12 % `color-mix` hover tints.

### Type

- Headings: `"Cormorant Garamond", system-ui, sans-serif` — weights used: **300**
  (display, 40 px and up), **400** (section heads, card titles), **500/600**
  (small interface headings). Bold is never used.
- Body: `"Lora", system-ui, sans-serif`, 400.
- Metadata / kickers / code: `ui-monospace, "SF Mono", Menlo, monospace`. This is the
  one deliberate departure from the design system's two-family rule and it is what
  gives the site its technical register — keep it, but only for dates, counts,
  labels, keyboard hints, URLs and code. Never for prose.
- Any figure that stands as a number (dates, counts, table cells, word counts,
  domain numerals) sets `font-feature-settings: 'tnum'`. Running prose does not.

Sizes actually used (px): display `82 / 70 / 60 / 54 / 48`; section `36 / 34 / 32 / 30`;
card & list titles `25 / 24 / 21 / 20 / 19`; body `16.5 / 15.5 / 14.5 / 13.5`;
meta `12.5 / 11.5 / 11 / 10.5 / 10`.
Display line-height `1.0–1.05`, letter-spacing `-.02em`. Body line-height `1.7–1.85`,
justified (`text-align: justify; hyphens: auto`) in article columns, ragged elsewhere.
Mono kickers: `10–10.5px`, `letter-spacing .12–.2em`, uppercase.

### Spacing, radius, elevation

`--space-1 4.6 / -2 9.2 / -3 13.8 / -4 18.4 / -6 27.6 / -8 36.8` px.
`--radius-sm 2 / -md 4 / -lg 7` px.
`--shadow-sm 0 1px 2px rgba(45,43,43,.14)`, `--shadow-md 0 3px 10px rgba(45,43,43,.16)`,
`--shadow-lg 0 12px 32px rgba(45,43,43,.22)`. Elevation is a whisper — cards are
bordered, not shadowed, at rest.

### Fonts

Both families are Google Fonts. Self-host under `assets/fonts/` and `@font-face` them
from a Sass partial rather than hotlinking — the mocks link Google only for convenience:

```
Cormorant+Garamond:ital,wght@0,300..700;1,300..700
Lora:ital,wght@0,400..700;1,400..700
```

---

## Structural primitives (build these first)

These recur on every screen; make them Liquid includes.

**`_includes/head-nav.html`** — site header. Flex row, `padding: 16px 56px`,
`border-bottom: 1px solid var(--color-divider)`. Brand at left:
Cormorant, `19px` (`27px` on the 1a masthead variant), `letter-spacing: .14em`,
`text-transform: uppercase`, weight 400. Nav at right: `display:flex; gap:26px`,
`font-size: 12.5px`, `letter-spacing: .04–.05em`. Current page gets
`border-bottom: 1px solid var(--color-accent); padding-bottom: 2px`.
Search trigger is a mono `⌘K` at `11px`, `--color-neutral-600`; in 1b it is a boxed
`⌘K  Search` (`1px solid var(--color-divider)`, `radius 3px`, `padding 4px 9px`).

**Link hover (`.nvl` in the mock)** — `color: inherit; text-decoration: none;
transition: color .18s`, hover → `var(--color-accent)`.

**Card hover (`.pcard`)** — `transition: box-shadow .22s ease, transform .22s ease,
border-color .22s ease`; hover → `box-shadow: var(--shadow-md);
transform: translateY(-2px); border-color: color-mix(in srgb, var(--color-accent) 45%, transparent)`.

**Title hover (`.ttl`)** — `text-decoration: underline;
text-decoration-color: var(--color-accent); text-decoration-thickness: 1px`.

**Focus** — `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px }`
globally. Never the browser default.

**Hairline grid** — the repeating pattern for tiled sections is
`display:grid; gap:1px; background: var(--color-divider); border: 1px solid var(--color-divider)`
with each child on `background: var(--color-bg)`. That is how the 1px rules between
tiles are drawn. Use it, don't hand-place borders.

**`_includes/footer.html`** — flex space-between, `padding: 20px 56px`,
`border-top: 1px solid var(--color-divider)`, `background: var(--color-surface)`,
`font-size: 11px`, `--color-neutral-600`. Left `© 2026 Noema`, right a mono
letter-spaced credit line.

**Plate (`.plate`)** — every photograph:
`filter: sepia(.22) saturate(.82) contrast(1.05); border: 6px solid var(--color-surface);
outline: 1px solid var(--color-divider); box-sizing: border-box`.

---

## Screens

### 1a — Home, "six domains kept" (IA option A)

**Purpose:** a masthead home that preserves the site's current six-domain nav and
gives writing and CV equal billing.

Sections top to bottom:

1. **Masthead header** — brand `27px` at left, five domain links + `⌘K` at right,
   `padding: 24px 56px 16px`, then a hairline inset `margin: 0 56px` (rule stops
   short of the edges — deliberate).
2. **Hero** — `grid-template-columns: 1fr 300px; gap: 56px; padding: 46px 56px 40px;
   align-items: start`.
   Left: mono kicker `DATA SCIENTIST · POTSDAM, DE` (`10.5px/.16em`, accent-700);
   `h1` two lines, `70px`, weight 300, line-height 1.02, second line italic in
   `--color-neutral-700`; intro paragraph `16.5px/1.7`, `max-width: 52ch`, justified,
   `--color-neutral-800`; two buttons (`.btn-primary` outlined gold = "Read the
   writing", `.btn-secondary` = "Download CV" → `assets/files/Resume.pdf`).
   Right: portrait in a plate, `aspect-ratio: 4/5`; below it three social links at
   `11.5px` each with `border-bottom: 1px solid var(--color-divider)`.
3. **The Domains** — section head is a small-caps `h6` plus a flexed hairline that
   fills the remaining width. Then a five-column hairline grid, one tile per domain:
   mono numeral `01`–`05` at `22px` weight 300 in `--color-accent`, Cormorant title
   `19px`, one-line description `11.5px` `--color-neutral-600`, mono `14 NOTES` count
   at `10px/.1em` `--color-neutral-500`. Tiles use the card hover.
4. **Recent + CV** — `grid-template-columns: 1.55fr 1px 1fr; gap: 44px` (the `1px`
   column is a full-height divider element).
   Left: three post rows, each `grid-template-columns: 88px 1fr; gap: 22px`, the
   88 px rail holding mono `19 MAR / 2025 / 7 MIN` (the read time in accent-700);
   title `25px` weight 500; excerpt `14px/1.65` justified `--color-neutral-700`;
   `.tag.tag-outline` chips. Rows separated by hairlines.
   Right: CV as a `62px 1fr` definition grid (`NOW`, `23–24`, `21–`, `16–20`),
   then `.hr`, then a "Working with" chip cloud (`.tag-accent` for RAG/LLMs,
   `.tag-neutral` for the rest), then `.hr`, then a one-line "Currently:" note.
5. **Footer.**

### 1b — Home, "collapsed IA" (IA option B)

**Purpose:** same content, reorganised into three doors. Six domains are demoted to
tags; nav becomes Writing / Work / About.

1. **Header** — brand `22px`, three links, boxed `⌘K Search`.
2. **Centred hero** — `padding: 66px 56px 54px`, `text-align: center`.
   Mono kicker `.2em`; `h1` at **82px**, weight 300, line-height 1.0, three lines with
   lines 2–3 italic; sub-paragraph `16px/1.75`, `max-width: 56ch`, centred, neutral-700.
   Bottom hairline.
3. **Three doors** — three-column hairline grid, tiles `padding: 34px 32px`.
   Mono kicker `01 / WRITING` in accent-700; `h3` **30px** weight 400; body `13.5px/1.65`.
   Card hover applies.
4. **"Lately"** — section head + hairline, then three `.card`s (`padding: 24px`)
   in a `repeat(3,1fr)` grid with `gap: 28px`. Use the design system's
   `.card-kicker / .card-title / .card-body / .card-meta` slots; kicker and meta are
   mono, meta is accent-700 and ends in `→`.
5. **Tag cloud** — `.hr`, then mono `BY TAG` label + eight `.tag.tag-outline` links.
6. **Footer** with `RSS · SITEMAP · GITHUB`.

### 1c — Post (long read)

**Purpose:** the reading experience. This is the most important screen.

- **Reading-progress bar** — a `2px` strip directly under the browser chrome:
  track `var(--color-divider)`, fill `var(--color-accent)`, width = scroll fraction.
  Drive it from a scroll listener in the existing vanilla JS (rAF-throttled).
- **Header** as usual.
- **Body** — `grid-template-columns: 200px 1fr; gap: 52px; padding: 48px 56px 56px;
  align-items: start`.
- **Left rail (`position: sticky; top: 16px`)** — `h6` "Contents"; a link column with
  `border-left: 1px solid var(--color-divider); padding-left: 14px; gap: 9px;
  font-size: 12px`. The active entry pulls itself out with `margin-left: -15px;
  padding-left: 14px; border-left: 1px solid var(--color-accent)` and sets
  accent-700; inactive entries are neutral-600. Below: `.hr`, a mono stats block
  (`12 MIN READ / 2 411 WORDS / UPD. 09 FEB 2025`, `10px/.1em`, line-height 1.9),
  then a `.btn-secondary` "Cite this" and a `.btn-ghost` "Edit on GitHub", both
  left-aligned, `12px`, `padding: 6px 10px`. Generate the ToC from `h2`s at build
  time in Liquid, or client-side on load; scroll-spy the active state.
- **Article** — `max-width: 70ch`.
  Breadcrumb kicker (mono, accent-700, `CONTEMPORARY → MACHINE LEARNING`);
  `h1` **54px** weight 300, line-height 1.05, `-.02em`;
  standfirst `19px` italic neutral-700;
  byline strip ruled top and bottom (`padding: 12px 0`) with a 30 px neutral-300
  avatar circle, name at `12.5px`, mono date pushed right;
  first paragraph carries a **drop cap**: `float:left; font-family: Cormorant;
  font-size: 66px; line-height: .82; padding: 4px 10px 0 0; color: --color-accent-800`.
  Body `16.5px/1.85`, justified, hyphens auto.
  **Pull quote:** `margin: 28px 0; padding-left: 24px;
  border-left: 2px solid var(--color-accent)`; Cormorant `26px` italic, neutral-800.
  `h2` `32px` weight 400.
  **Code block:** `background: var(--color-neutral-900)`, `radius: var(--radius-md)`,
  `padding: 18px 20px`; a mono language label `10px/.12em` in neutral-500 above the
  code; code `12.5px/1.75`, base text `#e6e2dc`. Rouge token colours used in the mock:
  keywords `#c98a5a`, function names `#e1ad66`, numbers `#9ab87c`, builtins `#7fa8c9`.
  Map these onto Rouge's class names (`.k`, `.nf`, `.mi`, `.nb`, …) in a
  `_sass/_rouge.scss` partial. A mono caption line may follow at `11px` neutral-600.
  **Table:** design-system `.table`, full width, numeric columns right-aligned with
  `tnum`.
  Then `.hr`, tag row, and a **prev/next** two-column hairline grid — left tile
  left-aligned with mono `← PREVIOUS`, right tile right-aligned with `NEXT →`,
  each with a Cormorant `19px` title.

### 1d — Category index

**Purpose:** a domain's front page.

- **Masthead band** — `grid-template-columns: 1fr 340px`, split by a vertical hairline,
  bottom hairline under the whole band.
  Left (`padding: 48px 44px 44px 56px`): mono `DOMAIN 01 · 14 NOTES`; `h1` **60px**
  weight 300, two lines, second italic; description `15.5px/1.75`, `max-width: 48ch`,
  justified, neutral-700.
  Right (`padding: 48px 56px 44px 40px`): `h6` "Sub-topics" then a list of rows,
  each `display:flex; justify-content:space-between; padding: 9px 0`, hairline
  between, label `13.5px`, mono count `11px` neutral-500 (tnum). Last row no rule.
- **Body** — `grid-template-columns: 1.1fr 1fr; gap: 44px; padding: 44px 56px 50px`.
  Left is the **lead piece**: mono `LEAD PIECE` kicker, a 16:10 plate, `h2` **36px**
  weight 400 with the title hover, excerpt `14.5px/1.7` justified, mono meta line.
  Right is **all notes in this domain**: rows of
  `grid-template-columns: 1fr auto; padding: 14px 0`, hairline between, title in
  Cormorant `20px`, mono `04 JAN` right-aligned; then a `.btn-secondary.btn-block`
  "Older notes".

### 1e — All Posts (archive)

**Purpose:** scan 57 pieces fast. Density is the point.

- **Head block** (`padding: 40px 56px 20px`): `h1` "The Archive" **48px** weight 300;
  under it a mono stats line `57 PIECES · 2021 – 2025 · 96 400 WORDS` (`11px/.1em`,
  neutral-600, tnum). A `.input` filter field, `width: 300px`, right-aligned on the
  same baseline, placeholder "Filter by title, tag or year…".
- **Filter chips** — `All` as `.tag-accent`, the five domains as `.tag-outline`,
  `gap: 8px`, with a hairline under the row.
- **Year groups** — each year is a mono heading (`10.5px/.16em`, accent-700, tnum)
  with the count in neutral-500 beside it, and a **solid `1px var(--color-text)` rule
  under it** (heavier than the row hairlines — that contrast is what separates years).
- **Rows** — `grid-template-columns: 82px 1fr 150px 62px; gap: 20px;
  align-items: baseline; padding: 13px 0`, hairline between. Columns: mono day-month
  (`11px`, neutral-500, tnum) / Cormorant title `21px` / domain `11.5px` neutral-600 /
  mono read time `10.5px` right-aligned.
- **Footer action** — centred `.btn-secondary` "Load 2023 and earlier".

Filtering is **client-side over the full list** — Jekyll can render every post row at
build time and the JS just toggles `hidden`. No pagination plugin needed
(`jekyll-paginate` is not in the plugin list anyway).

### 1f — Search (⌘K palette)

**Purpose:** keyboard-first search over the whole site.

Rendered as an overlay above whatever page you were on (the mock shows it over 1e,
blurred `1.6px` at 50 % opacity behind — the blur is mock presentation; in production
use only the scrim).

- **Scrim** — `color-mix(in srgb, var(--color-neutral-900) 26%, transparent)`,
  covering the viewport.
- **Panel** — `width: 620px`, centred horizontally, `top: 74px`,
  `background: var(--color-bg)`, `1px solid var(--color-divider)`,
  `border-radius: var(--radius-lg)`, `box-shadow: var(--shadow-lg)`, `overflow: hidden`.
- **Query row** — `padding: 16px 20px`, bottom hairline. A mono `›` prompt in accent,
  the query in **Cormorant 22px** (not mono — the query is content), a blinking
  `1.5px` accent caret, and a mono `ESC` key-cap chip
  (`1px solid var(--color-divider)`, radius 3, `padding: 2px 6px`) at the right.
- **Results** — grouped. Group labels are mono `10px/.16em` neutral-500,
  `padding: 8px 20px 6px` (`POSTS · 4`, `TAGS & PAGES`). Result rows are
  `padding: 9px 22px`, Cormorant `17px` title flexed left, mono `02.2025` right.
  The **selected row** gets `background: color-mix(in srgb, var(--color-accent) 10%,
  transparent)`, `border-left: 2px solid var(--color-accent)` and `padding-left: 20px`
  to compensate.
- **Footer strip** — `background: var(--color-surface)`, top hairline,
  `padding: 10px 20px`, mono `10px` hints: `↑↓ navigate`, `↵ open`,
  `⇥ filter by domain`, and right-aligned `Lunr.js · client-side index`.

**Implementation:** build a `search.json` at build time with a Liquid `for` over
`site.posts` (title, url, date, categories, tags, excerpt). Load Lunr.js as a vendored
file in `assets/js/` (no npm) and index it lazily on first `⌘K` / `Ctrl+K`.
Bindings: `⌘K`/`Ctrl+K` opens, `Esc` closes, `↑`/`↓` move selection (wrapping),
`Enter` navigates, `Tab` cycles the domain filter. Trap focus in the panel; restore
focus to the trigger on close.

### 1g — Create Post (compose)

**Purpose:** author a post in the browser and commit it to the repo. A private
authoring tool, not a public page.

- **Toolbar** (`padding: 14px 40px`, bottom hairline): brand + mono `/ COMPOSE` at
  left; at right the mono target path
  (`_posts/contemporary/2026-08-08-untitled.md`), a `.btn-secondary` "Preview" and a
  `.btn-primary` "Commit to main", both `12.5px`, `padding: 6px 12px`.
- **Three panes** — `grid-template-columns: 290px 1fr 1fr; min-height: 560px`, split
  by vertical hairlines.
  1. **Front matter** (`padding: 26px 24px`, `gap: 18px` column): `h6` heading, then
     `.field` + `.input` for Title, Domain, Date (mono), a tag box (chips inside a
     bordered `radius-md` container with a mono "add…" affordance), and a 3-row
     textarea for Excerpt. Then `.hr` and two `.radio` options — "Publish
     immediately" / "Keep as draft (_drafts/)". Pinned to the bottom
     (`margin-top: auto`), a mono build-info block: `BUILD: JEKYLL 3.10.0 /
     MARKDOWN: KRAMDOWN 2.4 / HIGHLIGHTER: ROUGE 3.30`.
  2. **Markdown pane** — a tab strip on `--color-surface` with mono `MARKDOWN`
     (active: accent-700 + `1px solid var(--color-accent)` underline) and `DIFF`
     (neutral-500). Below, a monospace editor at `12.5px/1.85`. Syntax tinting in the
     mock: front-matter block in neutral-500, markdown syntax (`>`, `##`, `**`,
     fenced code) in accent-700, prose in neutral-800.
  3. **Live preview** — a strip with mono `LIVE PREVIEW` and a right-aligned
     `312 words · 2 min` counter, then the post rendered in the article styles from
     1c at reduced scale (`h2 34px`, body `14.5px`, quote `20px`).

**Implementation note:** committing requires an authenticated GitHub call. GitHub
Pages is static, so this needs the user's own token held client-side (or a small
external function). Recommend gating the page behind a personal token stored in
`localStorage` and hitting the Contents API directly — and excluding the page from
`sitemap.xml` and the feed.

---

## Interactions & behaviour

| Behaviour | Spec |
| --- | --- |
| Link hover | colour → accent, `.18s` |
| Card / tile hover | `translateY(-2px)`, `--shadow-md`, accent-tinted border, `.22s ease` |
| Post-title hover | 1px accent underline |
| Button hover | `.btn-primary` → `color-mix(accent 12%)` fill; active → 22 % |
| Focus | 2px accent `:focus-visible` ring, 2px offset, everywhere |
| Reading progress | 2px accent fill on 1c, tracks scroll |
| ToC scroll-spy | active entry gets accent left-rule + accent-700 |
| Search open/close | `⌘K` / `Ctrl+K` open, `Esc` close, focus trapped, focus restored |
| Search nav | `↑↓` wrap, `Enter` opens, `Tab` cycles domain filter |
| Archive filter | client-side, instant, over pre-rendered rows |
| Theme toggle | see below |
| `prefers-reduced-motion` | disable all transforms and transitions; keep colour changes |

Motion budget is deliberately small: colour, a 2px lift, and a progress bar. Nothing
else animates.

## Dark mode

The current site has a Light/Dark toggle; it is **not mocked**. Preserve it by
re-declaring the tokens under `[data-theme="dark"]` rather than writing parallel
rules. Suggested inversion, staying inside the system: `--color-bg: #201f1d`,
`--color-surface: #2d2b2b`, `--color-text: #f3f2f2`, divider at 16 % white, and shift
accent usage one step lighter (`--color-accent-400 #e1ad66`) because the guide's
pressed/hover step on a dark ground is 400, not 600. Plates keep their warm grade.
Persist the choice in `localStorage` and honour
`prefers-color-scheme` on first visit.

## Responsive

Not mocked; apply these rules.

- **≥ 1160 px** — as drawn, content capped at 1160 px, page padding 56 px.
- **900–1160 px** — fluid; page padding → 40 px. 1a's domain grid → 3 columns then 2.
  1b's three doors → 3 → 1. 1e's rows drop the domain column.
- **< 900 px** — everything single column. 1c's ToC rail collapses into a
  `<details>` "Contents" block above the article and loses `sticky`. 1a's hero
  portrait moves above the text at `aspect-ratio: 3/2`. 1g is desktop-only; show a
  short "compose on a larger screen" notice.
- **< 700 px** — display sizes step down (`82 → 44`, `70 → 40`, `54 → 34`);
  body stays ≥ 16 px; **turn justification off** (`text-align: left`) — justified
  text at narrow measure opens rivers. Nav collapses to brand + `⌘K` + a
  disclosure menu. Tap targets ≥ 44 px.

## State

Small and all client-side: `theme` (light/dark, localStorage) · `searchOpen`,
`query`, `selectedIndex`, `domainFilter` (session) · `activeHeading` (1c scroll-spy) ·
`archiveFilter` + active chip (1e) · 1g's form fields, dirty flag and preview HTML.

## Assets

- **Portrait** — the mocks use a grey placeholder marked `PORTRAIT`. Use the real
  `assets/images/profile-200.jpg`; supply a larger source (≥ 600 px wide) since 1a
  renders it at 300 px at 4:5, and serve `@2x`.
- **Figure plate** on 1d — placeholder marked `FIGURE PLATE`; needs a real image or
  the block should be omitted per-post when none exists.
- **Icons** — the design system specifies **Lucide**. The mocks use text glyphs
  (`⌘K`, `→`, `↑↓`, `↵`, `›`) rather than icons; if you introduce icons, use Lucide
  SVGs inlined via a Liquid include, not an icon font.
- **Fonts** — Cormorant Garamond and Lora, self-hosted (see Type).
- **No image was licensed or supplied for this handoff.**

## Content note

Only four items are real, taken from the live site: the two March 2025 posts, the CV
entries, and the "Technical Focus" tags. **Every other title, excerpt, date, count and
statistic in the mocks is invented placeholder copy** written to show the layouts at
realistic density. Replace all of it with real content — do not ship the placeholders.

## Files in this bundle

```
mockups/Noema Mockups.dc.html   all six screens, one canvas — the design reference
mockups/support.js              component runtime for the mock; DO NOT PORT
mockups/_ds/classical-…/styles.css   design-system tokens + component layer — DO PORT
mockups/_ds/classical-…/_ds_bundle.js  design-system runtime; not needed in production
```

Open `mockups/Noema Mockups.dc.html` in a browser to see all six screens laid out
side by side, each labelled `1a`–`1g`.

## Suggested Jekyll structure

```
_layouts/     default.html · home.html · post.html · category.html · archive.html
_includes/    head-nav.html · footer.html · post-row.html · post-card.html ·
              domain-tile.html · search-palette.html · toc.html
_sass/        _tokens.scss · _base.scss · _type.scss · _nav.scss · _cards.scss ·
              _article.scss · _rouge.scss · _search.scss · _archive.scss · _compose.scss
assets/css/   style.scss  (front-matter fenced, @imports the partials)
assets/js/    theme.js · search.js (+ vendored lunr.min.js) · article.js
search.json   Liquid-generated Lunr index source
```

Sass here is **libsass-era 3.7.4** — use `@import`, not `@use`; no `math.div`,
no modern module functions.

## Open decision

**1a vs 1b is unresolved.** 1a keeps the six-domain nav (better for a knowledge
repository, worse for a first-time visitor); 1b collapses to Writing / Work / About
with domains as tags (better for recruiters, flatter browse). Confirm which before
building the home page — everything else (1c–1g) is shared and can start immediately.
Note that 1c–1g's headers show the **1b** nav except on 1d, which shows 1a's; unify
to whichever wins.
