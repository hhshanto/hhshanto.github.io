---
layout: default
title: Styleguide
permalink: /styleguide/
sitemap: false
description: Every design token and component in the Noema system, on one page.
---

<div class="sg frame">

<header class="sg-head">
  <p class="t-kicker">NOEMA DESIGN SYSTEM</p>
  <h1 class="t-display-sm">Styleguide</h1>
  <p class="t-body t-muted" style="max-width: 60ch; margin-top: var(--space-3);">
    Every token and component in the system. Check this page in both themes and
    at both widths before touching a real page &mdash; it is the cheapest place
    to find out that a value is wrong.
  </p>
  <p class="sg-note" style="margin-top: var(--space-4);">
    Tokens are the expensive thing to change later. By phase 5 a dozen partials
    reference them. Argue with them now.
  </p>
</header>

<section class="sg-section">
  <div class="rule-head"><h2 class="t-label">Colour &mdash; roles</h2></div>
  <div class="sg-swatches">
    {% assign roles = "bg|surface|text|accent|divider" | split: "|" %}
    {% for r in roles %}
    <figure class="sg-swatch">
      <div class="sg-chip" style="background: var(--color-{{ r }})"></div>
      <figcaption>--color-{{ r }}</figcaption>
    </figure>
    {% endfor %}
  </div>
</section>

<section class="sg-section">
  <div class="rule-head"><h2 class="t-label">Colour &mdash; neutral ramp</h2></div>
  <div class="sg-swatches">
    {% for s in (1..9) %}
    <figure class="sg-swatch">
      <div class="sg-chip" style="background: var(--color-neutral-{{ s }}00)"></div>
      <figcaption>neutral-{{ s }}00</figcaption>
    </figure>
    {% endfor %}
  </div>
</section>

<section class="sg-section">
  <div class="rule-head"><h2 class="t-label">Colour &mdash; accent ramp</h2></div>
  <div class="sg-swatches">
    {% for s in (1..9) %}
    <figure class="sg-swatch">
      <div class="sg-chip" style="background: var(--color-accent-{{ s }}00)"></div>
      <figcaption>accent-{{ s }}00</figcaption>
    </figure>
    {% endfor %}
  </div>
  <p class="t-body-sm t-muted" style="margin-top: var(--space-4); max-width: 66ch;">
    <strong>Contrast rule.</strong> <code>--color-accent</code> clears 3:1 on the
    light ground, which is legal for large text, icons and rules but
    <em>not</em> for body-size text. Small accent text uses
    <code>--color-accent-ink</code>, which resolves to accent-700 on light and
    accent-400 on dark.
  </p>
</section>

<section class="sg-section">
  <div class="rule-head"><h2 class="t-label">Washes</h2></div>
  <div class="sg-swatches">
    {% assign washes = "accent|accent-strong|ink|ink-strong|selection" | split: "|" %}
    {% for w in washes %}
    <figure class="sg-swatch">
      <div class="sg-chip" style="background: var(--wash-{{ w }})"></div>
      <figcaption>--wash-{{ w }}</figcaption>
    </figure>
    {% endfor %}
  </div>
</section>

<section class="sg-section">
  <div class="rule-head"><h2 class="t-label">Display type</h2></div>
  {% assign sizes = "xl,82|lg,70|md,60|sm,54|xs,48" | split: "|" %}
  {% for s in sizes %}
    {% assign p = s | split: "," %}
  <div class="sg-specimen">
    <span class="sg-name">.t-display-{{ p[0] }} &mdash; clamps to {{ p[1] }}px</span>
    <div class="t-display-{{ p[0] }}">Noema</div>
  </div>
  {% endfor %}
  <p class="t-body-sm t-muted" style="margin-top: var(--space-4);">
    Display sizes are fluid. Narrow the window and they scale continuously
    rather than jumping at one breakpoint.
  </p>
</section>

<section class="sg-section">
  <div class="rule-head"><h2 class="t-label">Headings and body</h2></div>

  <div class="sg-specimen">
    <span class="sg-name">.t-h2 &mdash; 32px / 400</span>
    <div class="t-h2">A section heading</div>
  </div>
  <div class="sg-specimen">
    <span class="sg-name">.t-h3 &mdash; 25px / 400</span>
    <div class="t-h3">A card or list title</div>
  </div>
  <div class="sg-specimen">
    <span class="sg-name">.t-title &mdash; 21px / 400</span>
    <div class="t-title">An archive row title</div>
  </div>
  <div class="sg-specimen">
    <span class="sg-name">.t-title-sm &mdash; 19px / 500</span>
    <div class="t-title-sm">A domain tile title</div>
  </div>
  <div class="sg-specimen">
    <span class="sg-name">.t-label &mdash; 13px / 600 uppercase</span>
    <div class="t-label">Contents</div>
  </div>
  <div class="sg-specimen">
    <span class="sg-name">.t-standfirst &mdash; 19px italic</span>
    <div class="t-standfirst">The italic line that sits under a post title and sets up what follows.</div>
  </div>

  <div class="sg-specimen">
    <span class="sg-name">.t-body.t-prose &mdash; 16.5px / 1.7, justified above 700px</span>
    <p class="t-body t-prose">
      The site is a personal knowledge repository, and the reading experience is
      the point of it. Body text is set in Lora at a measure of seventy
      characters, justified with hyphenation on anything wider than a phone and
      ragged-right below that, because justified text at a narrow measure opens
      rivers of white space down the column. Resize this window past 700px and
      watch the right edge of this paragraph snap flush.
    </p>
  </div>

  <div class="sg-specimen">
    <span class="sg-name">.t-body-sm / .t-body-xs</span>
    <p class="t-body-sm">Excerpt size, 14.5px, used in post rows and lead pieces.</p>
    <p class="t-body-xs">Tile description size, 13.5px, one line under a card title.</p>
  </div>
</section>

<section class="sg-section">
  <div class="rule-head"><h2 class="t-label">Metadata</h2></div>
  <div class="sg-specimen">
    <span class="sg-name">.t-kicker &mdash; accent-ink, .16em</span>
    <div class="t-kicker">DATA SCIENTIST &middot; POTSDAM, DE</div>
  </div>
  <div class="sg-specimen">
    <span class="sg-name">.t-meta</span>
    <div class="t-meta">19 MAR 2025 &middot; 7 MIN READ</div>
  </div>
  <div class="sg-specimen">
    <span class="sg-name">.t-meta-sm</span>
    <div class="t-meta-sm">57 PIECES &middot; 2021&ndash;2025 &middot; 96 400 WORDS</div>
  </div>
  <div class="sg-specimen">
    <span class="sg-name">.tnum &mdash; lining figures line up in a column</span>
    <div class="t-body tnum" style="line-height: 1.4;">01 12 2025<br>11 03 1998<br>47 09 2041</div>
  </div>
</section>

<section class="sg-section">
  <div class="rule-head"><h2 class="t-label">Buttons</h2></div>
  <span class="sg-name">.n-btn + .n-btn-primary / -secondary / -ghost</span>
  <div class="sg-row">
    <a href="#" class="n-btn n-btn-primary">Read the writing</a>
    <a href="#" class="n-btn n-btn-secondary">Download CV</a>
    <a href="#" class="n-btn n-btn-ghost">Edit on GitHub</a>
    <button class="n-btn n-btn-secondary" disabled>Disabled</button>
  </div>
  <p class="t-body-sm t-muted" style="margin-top: var(--space-3);">
    The accent is never a fill. Primary is an outline with a 12% wash on hover.
  </p>
</section>

<section class="sg-section">
  <div class="rule-head"><h2 class="t-label">Tags</h2></div>
  <span class="sg-name">.n-tag + .n-tag-accent / -neutral / -outline</span>
  <div class="sg-row">
    <span class="n-tag n-tag-accent">RAG</span>
    <span class="n-tag n-tag-accent">LLMs</span>
    <span class="n-tag n-tag-neutral">Python</span>
    <span class="n-tag n-tag-neutral">Jekyll</span>
    <a href="#" class="n-tag n-tag-outline">philosophy</a>
    <a href="#" class="n-tag n-tag-outline">machine-learning</a>
  </div>
</section>

<section class="sg-section">
  <div class="rule-head"><h2 class="t-label">Cards</h2></div>
  <span class="sg-name">.n-card + .pcard (hover for the lift)</span>
  <div class="sg-row" style="align-items: stretch;">
    {% assign cards = "01 / WRITING|02 / WORK|03 / ABOUT" | split: "|" %}
    {% for c in cards %}
    <article class="n-card pcard" style="flex: 1; min-width: 220px;">
      <span class="n-card-kicker">{{ c }}</span>
      <h3 class="n-card-title">A card title in Cormorant</h3>
      <p class="n-card-body">One or two lines of description at 13.5px, sitting
      in neutral-700 so it recedes behind the title.</p>
      <span class="n-card-meta">READ &rarr;</span>
    </article>
    {% endfor %}
  </div>
</section>

<section class="sg-section">
  <div class="rule-head"><h2 class="t-label">Hairline grid</h2></div>
  <span class="sg-name">.hgrid.hgrid-domains &mdash; 1 col, 3 above 700px, 5 above 1160px</span>
  <div class="hgrid hgrid-domains">
    {% assign tiles = "Natural Sciences|Social Sciences|Arts &amp; Literature|Reflections|Contemporary" | split: "|" %}
    {% for t in tiles %}
    <a href="#" class="sg-tile pcard nvl" style="text-decoration: none;">
      <div class="sg-tile-num">0{{ forloop.index }}</div>
      <div class="t-title-sm" style="margin-top: var(--space-2);">{{ t }}</div>
      <div class="t-body-xs t-faint" style="margin-top: 4px;">A one-line description of the domain.</div>
      <div class="t-meta-sm" style="margin-top: var(--space-3);">14 NOTES</div>
    </a>
    {% endfor %}
  </div>
  <p class="t-body-sm t-muted" style="margin-top: var(--space-3);">
    The 1px rules between tiles are the container's background showing through a
    1px gap &mdash; not hand-placed borders, which double at the seams.
  </p>
</section>

<section class="sg-section">
  <div class="rule-head"><h2 class="t-label">Forms</h2></div>
  <div style="max-width: 420px;">
    <div class="n-field" style="margin-bottom: var(--space-4);">
      <label for="sg-title">Title</label>
      <input class="n-input" id="sg-title" type="text" placeholder="Filter by title, tag or year&hellip;">
    </div>
    <div class="n-field" style="margin-bottom: var(--space-4);">
      <label for="sg-excerpt">Excerpt</label>
      <textarea class="n-input" id="sg-excerpt" rows="3" placeholder="Two or three sentences&hellip;"></textarea>
    </div>
    <label class="n-radio">
      <input type="radio" name="sg-pub" checked><span class="dot"></span> Publish immediately
    </label>
    <label class="n-radio">
      <input type="radio" name="sg-pub"><span class="dot"></span> Keep as draft
    </label>
  </div>
</section>

<section class="sg-section">
  <div class="rule-head"><h2 class="t-label">Table</h2></div>
  <div class="n-table-wrap">
    <table class="n-table">
      <thead>
        <tr><th>Domain</th><th>Lead piece</th><th class="num">Notes</th><th class="num">Words</th></tr>
      </thead>
      <tbody>
        <tr><td>Natural Sciences</td><td>Higgs boson discovery</td><td class="num">14</td><td class="num">21 400</td></tr>
        <tr><td>Social Sciences</td><td>Cognitive dissonance</td><td class="num">9</td><td class="num">18 250</td></tr>
        <tr><td>Reflections</td><td>Noema, a digital garden</td><td class="num">6</td><td class="num">9 800</td></tr>
      </tbody>
    </table>
  </div>
</section>

<section class="sg-section">
  <div class="rule-head"><h2 class="t-label">Rules, plates and spacing</h2></div>

  <span class="sg-name">.hr</span>
  <hr class="hr">

  <span class="sg-name">.rule-head &mdash; label plus a hairline filling the width</span>
  <div class="rule-head" style="margin-bottom: var(--space-6);"><h3 class="t-label">The Domains</h3></div>

  <span class="sg-name">--space-1 &hellip; --space-8</span>
  <div style="margin-bottom: var(--space-6);">
    {% assign spaces = "1,4.6|2,9.2|3,13.8|4,18.4|6,27.6|8,36.8" | split: "|" %}
    {% for s in spaces %}
      {% assign p = s | split: "," %}
    <div class="sg-space">
      <span class="sg-space-bar" style="width: var(--space-{{ p[0] }})"></span>
      <span class="t-meta-sm">--space-{{ p[0] }} &middot; {{ p[1] }}px</span>
    </div>
    {% endfor %}
  </div>

  <span class="sg-name">.plate &mdash; the mat and warm grade every photograph gets</span>
  <img class="plate" src="{{ '/assets/images/profile-400.jpg' | relative_url }}"
       alt="Portrait specimen showing the plate treatment"
       style="width: 220px; aspect-ratio: 4/5; object-fit: cover;">
</section>

<section class="sg-section">
  <div class="rule-head"><h2 class="t-label">Article body</h2></div>
  <p class="t-body-sm t-muted" style="max-width: 60ch; margin-bottom: var(--space-6);">
    What kramdown emits from a markdown file, styled by <code>_article.scss</code>
    and <code>_rouge.scss</code>. No post on the site currently contains a code
    block, a table or a pull quote, so this is the only place the code theme can
    be checked &mdash; the block keeps a dark ground in <em>both</em> themes,
    deliberately.
  </p>

  <div class="article-body t-prose" markdown="1">

A paragraph of body prose at 16.5px on a 1.85 line, justified from 700px up
and ragged-right below it. Inline `code` follows the page rather than the
code block, and [a link](#) takes a hairline underline that goes accent on
hover.

> A pull quote is a markdown blockquote. It is the only thing an author can
> actually type, so it is what the treatment is mapped onto.

## A heading at h2

Headings are the one place the prose stops being justified: a short justified
line stretches into gaps.

```python
def entropy(counts):
    total = sum(counts)          # 2411
    return -sum((n / total) * log2(n / total) for n in counts if n)
```

| Domain | Notes | Words |
| --- | --- | --- |
| Reflections | 3 | 4 210 |
| Natural Sciences | 2 | 3 980 |

  </div>

  <!--
    article.js is normally loaded only by the post layout. It is pulled in here
    so the mono language label above the code block — which JS inserts, because
    CSS cannot read a class name into `content` — can be checked on this page
    too. Its other three jobs find no elements here and do nothing.
  -->
  <script src="{{ '/assets/js/article.js' | relative_url }}" defer></script>
</section>

<section class="sg-section">
  <div class="rule-head"><h2 class="t-label">Focus</h2></div>
  <p class="t-body-sm t-muted" style="max-width: 60ch;">
    Tab through this page. Every focusable element takes a 2px accent ring at a
    2px offset, and it is never the browser default. A mouse click leaves no
    ring; a keyboard tab always does.
  </p>
</section>

</div>
