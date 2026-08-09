// Behavioural checks for the Phase 2 chrome. Screenshots show layout; these
// cover the things only interaction reveals.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const SITE = 'c:/Users/hasan/hhshanto.github.io/.tools/.site';
const PORT = 4997;
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.json': 'application/json', '.xml': 'application/xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.pdf': 'application/pdf' };

const server = createServer(async (req, res) => {
  try {
    let f = join(SITE, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!extname(f)) f = join(f, 'index.html');
    res.writeHead(200, { 'content-type': MIME[extname(f)] ?? 'application/octet-stream' });
    res.end(await readFile(f));
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch();

// The outgoing _base.scss still sets `html { scroll-behavior: smooth }`, so a
// scrollTo() is an animation, not a jump. Reading a scroll-driven value on a
// fixed timeout catches it mid-flight — that is how the reading-progress and
// scroll-spy checks first "failed" against correct code. Wait for the offset to
// stop changing instead.
const settle = (page) => page.evaluate(() => new Promise((resolve) => {
  let last = -1;
  let still = 0;
  (function tick() {
    if (window.pageYOffset === last) {
      if (++still > 4) return resolve(window.pageYOffset);
    } else {
      still = 0;
      last = window.pageYOffset;
    }
    requestAnimationFrame(tick);
  })();
}));

const results = [];
const check = (name, pass, detail = '') =>
  results.push({ name, pass, detail });

// ── No theme flash ─────────────────────────────────────────────────────────
// The inline head script must have set data-theme before anything renders.
{
  const ctx = await browser.newContext({ colorScheme: 'dark' });
  const page = await ctx.newPage();
  let earlyTheme = null;
  await page.addInitScript(() => {
    // Runs before page scripts; observe the attribute as soon as <body> exists.
    document.addEventListener('readystatechange', () => {
      if (!window.__seen) {
        window.__seen = document.documentElement.getAttribute('data-theme');
      }
    });
  });
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  earlyTheme = await page.evaluate(() => window.__seen);
  check('theme applied before DOMContentLoaded', earlyTheme === 'dark', `saw "${earlyTheme}"`);

  const osDark = await page.evaluate(() =>
    document.documentElement.getAttribute('data-theme'));
  check('honours prefers-color-scheme with no stored choice', osDark === 'dark', `got "${osDark}"`);
  await ctx.close();
}

// ── Theme toggle round-trip ────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/`);
  const before = await page.getAttribute('html', 'data-theme');
  const labelBefore = (await page.textContent('[data-theme-label]')).trim();
  await page.click('#themeToggle');
  const after = await page.getAttribute('html', 'data-theme');
  const stored = await page.evaluate(() => localStorage.getItem('theme'));
  check('toggle flips the theme', before === 'light' && after === 'dark', `${before} -> ${after}`);
  check('toggle persists to localStorage', stored === 'dark', `stored "${stored}"`);
  check('button labels the destination, not the state', labelBefore === 'Dark', `said "${labelBefore}"`);
  await ctx.close();
}

// ── Mobile disclosure menu ─────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/`);

  const navHiddenAtRest = !(await page.isVisible('.masthead-links'));
  check('nav hidden at rest on mobile', navHiddenAtRest);

  await page.click('.masthead-disclosure');
  check('opens on tap', await page.isVisible('.masthead-links'));
  check('aria-expanded true when open',
    (await page.getAttribute('.masthead-disclosure', 'aria-expanded')) === 'true');

  // isVisible() is not enough: it returns true for an element that is painted
  // but scrolled off the screen. The first version of this panel rendered at
  // top: -125px — fully off the top of the viewport — and still passed.
  const geo = await page.evaluate(() => {
    const nav = document.getElementById('masthead-nav');
    const bar = document.querySelector('.masthead-bar');
    const n = nav.getBoundingClientRect();
    const b = bar.getBoundingClientRect();
    return {
      top: n.top, left: n.left, right: n.right, bottom: n.bottom,
      barBottom: b.bottom, vw: window.innerWidth, vh: window.innerHeight,
    };
  });
  check('open panel sits below the bar, not over or above it',
    geo.top >= geo.barBottom - 1, `panel top ${geo.top.toFixed(0)}px vs bar bottom ${geo.barBottom.toFixed(0)}px`);
  check('open panel is inside the viewport',
    geo.top >= 0 && geo.left >= 0 && geo.right <= geo.vw + 1,
    `top ${geo.top.toFixed(0)} left ${geo.left.toFixed(0)} right ${geo.right.toFixed(0)} vw ${geo.vw}`);
  check('open panel spans the full width',
    Math.abs(geo.right - geo.left - geo.vw) <= 1,
    `${(geo.right - geo.left).toFixed(0)}px of ${geo.vw}px`);

  // Every link must be reachable by tapping, not just present in the DOM.
  const links = await page.locator('.masthead-link').all();
  let offscreen = 0;
  for (const l of links) {
    const r = await l.boundingBox();
    if (!r || r.y < 0 || r.y + r.height > geo.vh) offscreen++;
  }
  check('all five domain links are on screen when open', offscreen === 0,
    `${offscreen} of ${links.length} off screen`);

  await page.keyboard.press('Escape');
  check('Escape closes', !(await page.isVisible('.masthead-links')));
  check('focus returns to the button after Escape',
    await page.evaluate(() => document.activeElement.classList.contains('masthead-disclosure')));

  // Tap target size.
  const box = await page.locator('.masthead-disclosure').boundingBox();
  check('disclosure tap target >= 44px', box.width >= 44 && box.height >= 44,
    `${Math.round(box.width)}x${Math.round(box.height)}`);
  await ctx.close();
}

// ── Desktop nav ────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/reflections/`);

  check('all five domains in the nav',
    (await page.locator('.masthead-link').count()) === 5);
  check('current domain marked with aria-current',
    (await page.getAttribute('.masthead-link[aria-current="page"]', 'href')).includes('reflections'));
  check('disclosure button hidden on desktop',
    !(await page.isVisible('.masthead-disclosure')));

  // The nav should mark the domain while reading one of its posts too.
  await page.goto(`http://localhost:${PORT}/reflections/philosophy/stoicism/`);
  const cur = await page.locator('.masthead-link[aria-current="page"]').count();
  check('domain stays marked while reading a post in it', cur === 1, `${cur} marked`);

  // Skip link.
  await page.goto(`http://localhost:${PORT}/`);
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement.className);
  check('first Tab reaches the skip link', focused.includes('skip-link'), `focused "${focused}"`);
  await ctx.close();
}

// ── Sticky masthead ────────────────────────────────────────────────────────
for (const [label, width] of [['mobile', 375], ['desktop', 1440]]) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/reflections/`);

  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(120);

  const top = await page.evaluate(
    () => document.querySelector('.masthead').getBoundingClientRect().top);
  check(`masthead stays pinned when scrolled (${label})`, Math.abs(top) < 1,
    `top ${top.toFixed(1)}px`);

  // The token drives scroll-padding-top and the Phase 3 ToC offset; if it
  // drifts from the real height, anchors land under the header.
  const real = await page.evaluate(
    () => document.querySelector('.masthead').getBoundingClientRect().height);
  const token = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue('--masthead-h')));
  check(`--masthead-h matches measured height (${label})`, Math.abs(real - token) <= 2,
    `token ${token}px vs real ${real.toFixed(1)}px`);

  // Content must not show through the bar.
  const opaque = await page.evaluate(() => {
    const bg = getComputedStyle(document.querySelector('.masthead')).backgroundColor;
    const m = bg.match(/[\d.]+/g);
    return !(bg === 'transparent' || (m && m.length === 4 && Number(m[3]) < 1));
  });
  check(`masthead is opaque (${label})`, opaque);
  await ctx.close();
}

// ── Home (screen 1a) ───────────────────────────────────────────────────────
for (const width of [375, 700, 1160, 1440]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/`);

  // The hairline grid draws its rules by showing its own background through a
  // 1px gap, so a last row that does not fill shows a solid grey block where a
  // tile would be. hgrid-fill.html emits blanks to cover it — but only for the
  // column counts it was told about, so the arithmetic is checked at every
  // width rather than assumed.
  const grids = await page.evaluate(() =>
    ['.home-briefs', '.cv-grid'].map((sel) => {
      const el = document.querySelector(sel);
      return {
        sel,
        cols: getComputedStyle(el).gridTemplateColumns.split(' ').length,
        cells: Array.from(el.children)
          .filter((c) => getComputedStyle(c).display !== 'none').length,
      };
    }));

  for (const g of grids) {
    check(`${g.sel} has no uncovered cells (${width}px)`,
      g.cells % g.cols === 0, `${g.cells} cells in ${g.cols} columns`);
  }

  if (width === 1440) {
    // The curriculum was moved out of the foot column and up under the hero.
    // Its position is the point of the change, so it is asserted rather than
    // left to a screenshot nobody re-reads.
    const order = await page.evaluate(() => {
      const y = (s) => document.querySelector(s).getBoundingClientRect().top;
      return { hero: y('.home-hero'), cv: y('.cv-band'), latest: y('.home-latest') };
    });
    check('the curriculum sits between the hero and recent writing',
      order.cv > order.hero && order.cv < order.latest);
    // The page went a whole phase without naming its author anywhere.
    const named = await page.evaluate(() => {
      const name = document.querySelector('.home-hero-name');
      return {
        text: name?.textContent.trim() ?? '',
        alt: document.querySelector('.home-hero-portrait')?.alt ?? '',
        // innerText is the *rendered* text in Chrome, so the kicker's
        // text-transform: uppercase comes back applied. Compare case-insensitively.
        byline: document.body.innerText.toLowerCase().includes('mohammad hasan'),
      };
    });
    check('the author is named on the home page', named.byline, `"${named.text}"`);
    check('the portrait alt is the name', named.alt === named.text, `"${named.alt}"`);

    check('experience and education are separate lists',
      (await page.locator('.cv-cell .cv-list').count()) === 2);

    // The masthead already carries all five domains on every page; the tile
    // grid restated them a screen below it and was removed.
    check('the domain tile grid is gone',
      (await page.locator('.domain-tile, .hgrid-domains').count()) === 0);

    const portrait = await page.evaluate(() => {
      const img = document.querySelector('.home-hero-portrait');
      const r = img.getBoundingClientRect();
      return { w: r.width, h: r.height };
    });
    check('portrait is 4:5', Math.abs(portrait.w / portrait.h - 0.8) < 0.02,
      `${portrait.w.toFixed(0)}x${portrait.h.toFixed(0)}`);

    // Proves index.html is on the new layout rather than the old inline body.
    check('the old hero markup is gone',
      (await page.locator('.hero-section, .about-section, .latest-posts-section').count()) === 0);
  }

  const doc = await page.evaluate(() => ({
    w: document.documentElement.scrollWidth, vw: window.innerWidth }));
  check(`home does not scroll sideways (${width}px)`, doc.w <= doc.vw + 1,
    `${doc.w} vs ${doc.vw}`);
  await ctx.close();
}

// The portrait is drawn at 300px, so a retina screen needs a 600px candidate.
// This has to run at deviceScaleFactor 2 — at 1 the browser correctly picks the
// 300px source and the check would be asserting the wrong thing.
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/`);
  // naturalWidth is the wrong thing to read here: it is reported in CSS pixels
  // and already divided by the density descriptor, so a correctly chosen 600px
  // 2x source reports 300 — identical to the 1x source failing to upgrade.
  // currentSrc is what actually says which file the browser fetched.
  const chosen = await page.evaluate(() =>
    document.querySelector('.home-hero-portrait').currentSrc);
  check('portrait serves a 2x source on a retina screen',
    chosen.includes('portrait-600'), chosen.split('/').pop());
  await ctx.close();
}


// ── Post layout (screen 1c) ────────────────────────────────────────────────
const POST = `http://localhost:${PORT}/reflections/philosophy/stoicism/`;

// Contents are built by Liquid, not by JS, so they must be in the HTML for a
// reader with scripting off and for a crawler. The old include built them in a
// DOMContentLoaded handler, which satisfied neither.
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    javaScriptEnabled: false,
  });
  const page = await ctx.newPage();
  await page.goto(POST);

  const counts = await page.evaluate(() => ({
    links: document.querySelectorAll('.post-toc-link').length,
    headings: document.querySelectorAll('.article-body h2').length,
    broken: Array.from(document.querySelectorAll('.post-toc-link'))
      .filter((a) => !document.getElementById(decodeURIComponent(a.hash.slice(1))))
      .length,
    railOpen: !!document.querySelector('[data-post-rail]')?.open,
  }));

  check('contents are in the HTML without JS', counts.links > 0, `${counts.links} entries`);
  check('one contents entry per h2',
    counts.links === counts.headings, `${counts.links} entries vs ${counts.headings} headings`);
  check('every contents link resolves to a heading', counts.broken === 0, `${counts.broken} broken`);
  check('rail is expanded without JS', counts.railOpen);
  await ctx.close();
}

{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(POST);

  // The progress track is pinned to --masthead-h; if that token and the bar
  // ever disagree the strip floats in the middle of the page or hides behind
  // the header.
  const seam = await page.evaluate(() => {
    const bar = document.querySelector('.masthead').getBoundingClientRect();
    const track = document.querySelector('.reading-progress').getBoundingClientRect();
    return track.top - bar.bottom;
  });
  check('progress track sits on the masthead seam', Math.abs(seam) <= 1,
    `${seam.toFixed(1)}px off`);

  const atTop = await page.evaluate(() =>
    document.querySelector('[data-reading-progress]').getBoundingClientRect().width);
  check('progress is empty at the top of the page', atTop <= 1, `${atTop.toFixed(0)}px`);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await settle(page);
  const atEnd = await page.evaluate(() => {
    const fill = document.querySelector('[data-reading-progress]');
    return fill.getBoundingClientRect().width / window.innerWidth;
  });
  check('progress is full at the bottom', atEnd > 0.98, `${(atEnd * 100).toFixed(0)}%`);

  // Scroll-spy. Land on the third heading and expect that entry, and only that
  // entry, to be marked.
  await page.evaluate(() => {
    const heading = document.querySelectorAll('.article-body h2')[2];
    const bar = document.querySelector('.masthead').getBoundingClientRect().height;
    window.scrollTo(0, heading.getBoundingClientRect().top + window.pageYOffset - bar - 4);
  });
  await settle(page);
  const spy = await page.evaluate(() => {
    const heading = document.querySelectorAll('.article-body h2')[2];
    const marked = document.querySelectorAll('.post-toc-item.is-current');
    return {
      count: marked.length,
      href: marked[0]?.querySelector('a')?.hash,
      want: '#' + heading.id,
    };
  });
  check('scroll-spy marks exactly one entry', spy.count === 1, `${spy.count} marked`);
  check('scroll-spy marks the heading being read', spy.href === spy.want,
    `${spy.href} vs ${spy.want}`);

  // An in-page anchor must not land its heading underneath the sticky bar.
  await page.evaluate(() => document.querySelector('.post-toc-link').click());
  await settle(page);
  const anchored = await page.evaluate(() => {
    const id = decodeURIComponent(
      document.querySelector('.post-toc-link').hash.slice(1));
    const bar = document.querySelector('.masthead').getBoundingClientRect();
    return document.getElementById(id).getBoundingClientRect().top - bar.bottom;
  });
  check('a contents link lands its heading below the masthead', anchored >= -1,
    `${anchored.toFixed(0)}px below the bar`);

  // The rail is sticky, so it must still be on screen deep into a long post.
  await page.evaluate(() => window.scrollTo(0, 1600));
  await settle(page);
  const railTop = await page.evaluate(() => {
    const bar = document.querySelector('.masthead').getBoundingClientRect();
    const rail = document.querySelector('.post-rail').getBoundingClientRect();
    return { gap: rail.top - bar.bottom, height: rail.height };
  });
  check('rail stays visible when scrolled', railTop.gap >= 0 && railTop.gap < 60,
    `${railTop.gap.toFixed(0)}px below the bar`);

  check('rail disclosure is hidden on desktop',
    !(await page.isVisible('.post-rail-summary')));

  // The article column must not spill out of the grid, whatever is in it.
  const fits = await page.evaluate(() => {
    const layout = document.querySelector('.article-layout').getBoundingClientRect();
    const article = document.querySelector('.article').getBoundingClientRect();
    return { overflow: article.right - layout.right, doc: document.documentElement.scrollWidth, vw: window.innerWidth };
  });
  check('article stays inside the grid', fits.overflow <= 1, `${fits.overflow.toFixed(0)}px over`);
  check('post does not scroll sideways (desktop)', fits.doc <= fits.vw + 1,
    `${fits.doc} vs ${fits.vw}`);
  await ctx.close();
}

// Phone: the rail collapses out of the way, and nothing overflows.
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(POST);

  check('rail is collapsed on a phone',
    !(await page.evaluate(() => document.querySelector('[data-post-rail]').open)));
  check('rail disclosure is a 44px tap target',
    await page.locator('.post-rail-summary').boundingBox()
      .then((b) => b.height >= 44), '');

  await page.click('.post-rail-summary');
  const opened = await page.evaluate(() => {
    const rail = document.querySelector('[data-post-rail]');
    const links = document.querySelectorAll('.post-toc-link');
    return { open: rail.open, visible: links[0].getBoundingClientRect().height > 0 };
  });
  check('rail opens on tap', opened.open && opened.visible);

  const doc = await page.evaluate(() => ({
    w: document.documentElement.scrollWidth, vw: window.innerWidth }));
  check('post does not scroll sideways (phone)', doc.w <= doc.vw + 1, `${doc.w} vs ${doc.vw}`);
  await ctx.close();
}

// The code theme has no real content to sit on yet, so it is checked where the
// specimen lives.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/styleguide/`);

  const code = await page.evaluate(() => {
    const block = document.querySelector('.article-body div.highlighter-rouge');
    const inline = document.querySelector('.article-body p code');
    const label = block?.querySelector('.code-label');
    return {
      label: label?.textContent ?? null,
      blockBg: block && getComputedStyle(block).backgroundColor,
      inlineBg: inline && getComputedStyle(inline).backgroundColor,
      wrapped: !!document.querySelector('.article-table > table'),
    };
  });
  check('code block carries a language label', code.label === 'python', `"${code.label}"`);
  // kramdown puts .highlighter-rouge on inline code too; without the `div`
  // qualifier in _rouge.scss every inline snippet became a dark block.
  check('inline code did not take the block treatment',
    code.inlineBg !== code.blockBg, `${code.inlineBg} vs ${code.blockBg}`);
  check('tables are wrapped so they can scroll', code.wrapped);
  await ctx.close();
}

// ── Archive (screen 1e) ────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/all-posts/`);

  const built = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('[data-row]'));
    const years = Array.from(document.querySelectorAll('[data-year-group]'))
      .map((g) => Number(g.querySelector('.archive-year-label').textContent.trim()));
    return {
      rows: rows.length,
      years,
      stated: Number(document.querySelector('.archive-stats').textContent.trim().split(' ')[0]),
      domains: new Set(rows.map((r) => r.getAttribute('data-domain'))).size,
    };
  });

  check('every piece is rendered as a row', built.rows > 0, `${built.rows} rows`);
  check('the stats line agrees with the rows', built.stated === built.rows,
    `says ${built.stated}, rendered ${built.rows}`);
  check('years run newest first',
    built.years.every((y, i) => i === 0 || built.years[i - 1] > y), built.years.join(' > '));

  // Filtering is the whole screen. It has to narrow, empty and recover.
  const filtered = await page.evaluate(async () => {
    const input = document.querySelector('[data-archive-input]');
    const fire = (v) => {
      input.value = v;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const visible = () =>
      document.querySelectorAll('[data-row]:not([hidden])').length;

    fire('stoicism');
    const narrowed = visible();
    const groupsShown = document.querySelectorAll('[data-year-group]:not([hidden])').length;

    fire('zzzzz');
    const none = visible();
    const emptyShown = !document.querySelector('[data-archive-empty]').hidden;

    fire('');
    return { narrowed, groupsShown, none, emptyShown, restored: visible() };
  });

  check('typing narrows the list', filtered.narrowed === 1, `${filtered.narrowed} rows`);
  check('a year with nothing left is hidden', filtered.groupsShown === 1,
    `${filtered.groupsShown} groups still shown`);
  check('a query matching nothing shows the empty state',
    filtered.none === 0 && filtered.emptyShown);
  check('clearing the filter restores every row', filtered.restored === built.rows,
    `${filtered.restored} of ${built.rows}`);

  const chipped = await page.evaluate(async () => {
    const chip = document.querySelector('[data-chip="reflections"]');
    chip.click();
    const rows = Array.from(document.querySelectorAll('[data-row]:not([hidden])'));
    return {
      count: rows.length,
      allReflections: rows.every((r) => r.getAttribute('data-domain') === 'reflections'),
      pressed: chip.getAttribute('aria-pressed'),
      allChipOff: document.querySelector('[data-chip=""]').getAttribute('aria-pressed'),
    };
  });
  // The chips are <button>s, and a button without an explicit background takes
  // the UA's pale `buttonface`. It vanishes into the light page and reads as
  // five cream boxes on the dark one, so it is checked in dark specifically.
  {
    const dark = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await dark.addInitScript(() => { try { localStorage.setItem('theme', 'dark'); } catch {} });
    const dp = await dark.newPage();
    await dp.goto(`http://localhost:${PORT}/all-posts/`);
    const grounds = await dp.evaluate(() => {
      const body = getComputedStyle(document.body).backgroundColor;
      const off = Array.from(document.querySelectorAll('.archive-chip:not(.is-on)'));
      return {
        body,
        mismatched: off.filter((c) => {
          const bg = getComputedStyle(c).backgroundColor;
          return bg !== 'rgba(0, 0, 0, 0)' && bg !== body;
        }).length,
        total: off.length,
      };
    });
    check('unselected chips do not paint their own background',
      grounds.mismatched === 0, `${grounds.mismatched} of ${grounds.total}`);
    await dark.close();
  }

  check('a domain chip filters to that domain',
    chipped.count > 0 && chipped.allReflections, `${chipped.count} rows`);
  check('the chosen chip is the only one pressed',
    chipped.pressed === 'true' && chipped.allChipOff === 'false');

  await ctx.close();
}

// The archive without JS is still the complete archive — that is the reason for
// rendering every row at build time instead of paginating.
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    javaScriptEnabled: false,
  });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/all-posts/`);
  const rows = await page.locator('[data-row]:not([hidden])').count();
  check('the archive is complete without JS', rows > 0, `${rows} rows`);
  await ctx.close();
}

// ── Category index (screen 1d) ─────────────────────────────────────────────
for (const width of [375, 1440]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/reflections/`);

  const cat = await page.evaluate(() => {
    const notes = Array.from(document.querySelectorAll('.category-note'));
    const kicker = document.querySelector('.category-head-main .t-kicker').textContent;
    const subs = Array.from(document.querySelectorAll('.category-sub-count'))
      .map((s) => Number(s.textContent.trim()));
    return {
      notes: notes.length,
      stated: Number(kicker.replace(/[^0-9]/g, '').slice(2)),
      lead: document.querySelector('.category-lead-title a')?.textContent.trim(),
      first: notes[0]?.querySelector('.category-note-title')?.textContent.trim(),
      subTotal: subs.reduce((a, b) => a + b, 0),
      doc: document.documentElement.scrollWidth,
      vw: window.innerWidth,
    };
  });

  if (width === 1440) {
    check('the note count agrees with the notes listed',
      cat.stated === cat.notes, `says ${cat.stated}, listed ${cat.notes}`);
    check('the lead piece is the newest note', cat.lead === cat.first,
      `"${cat.lead}" vs "${cat.first}"`);
    // Documents filed at the root of a collection belong to no sub-topic, so
    // the counts can be short of the total but never over it.
    check('sub-topic counts never exceed the domain', cat.subTotal <= cat.notes,
      `${cat.subTotal} of ${cat.notes}`);
  }

  check(`category index does not scroll sideways (${width}px)`,
    cat.doc <= cat.vw + 1, `${cat.doc} vs ${cat.vw}`);
  await ctx.close();
}

// Every domain page must build, including the ones with a single document and
// no sub-topics at all — that branch is easy to leave broken.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  let broken = 0;
  const domains = ['natural-sciences', 'social-sciences', 'arts-literature',
    'reflections', 'contemporary'];

  for (const d of domains) {
    const response = await page.goto(`http://localhost:${PORT}/${d}/`);
    const ok = response.status() === 200 &&
      (await page.locator('.category-head').count()) === 1 &&
      (await page.locator('.category-note').count()) > 0;
    if (!ok) broken++;
  }
  check('all five domain pages render their notes', broken === 0, `${broken} broken`);
  await ctx.close();
}

// ── Search palette (screen 1f) ─────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Neither Lunr nor the index may be requested until someone actually
  // searches. The index carries the full text of every post; fetching it on
  // load would make every reader pay for a feature most never use.
  const eager = [];
  page.on('request', (r) => {
    const u = r.url();
    if (u.includes('lunr.min.js') || u.includes('search.json')) eager.push(u);
  });

  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForTimeout(400);
  check('the index is not fetched on page load', eager.length === 0,
    eager.map((u) => u.split('/').pop()).join(', '));

  check('the palette is hidden at rest', !(await page.isVisible('.palette-panel')));

  await page.keyboard.press('Control+k');
  await page.waitForTimeout(600);

  const opened = await page.evaluate(() => {
    const panel = document.querySelector('.palette-panel');
    return {
      visible: !document.querySelector('[data-palette]').hidden,
      focused: document.activeElement.className,
      modal: panel.getAttribute('aria-modal'),
      role: panel.getAttribute('role'),
      width: Math.round(panel.getBoundingClientRect().width),
      bodyScrolls: getComputedStyle(document.documentElement).overflow,
    };
  });
  check('⌘K opens the palette', opened.visible);
  check('focus moves into the query field', opened.focused.includes('palette-input'),
    `focused "${opened.focused}"`);
  check('the panel is a modal dialog',
    opened.role === 'dialog' && opened.modal === 'true');
  check('the panel is 620px on desktop', opened.width === 620, `${opened.width}px`);
  check('the page behind cannot scroll', opened.bodyScrolls === 'hidden');
  check('opening fetched the index', eager.length === 2,
    eager.map((u) => u.split('/').pop()).join(', '));

  // Typing, selection and wrapping.
  await page.keyboard.type('bangla');
  await page.waitForTimeout(300);

  const listed = await page.evaluate(() => ({
    rows: document.querySelectorAll('.palette-result').length,
    groups: Array.from(document.querySelectorAll('.palette-group-label'))
      .map((g) => g.textContent.trim()),
    selected: document.querySelector('.palette-result[aria-selected="true"]')
      ? Array.from(document.querySelectorAll('.palette-result'))
        .indexOf(document.querySelector('.palette-result[aria-selected="true"]'))
      : -1,
  }));
  check('typing produces results', listed.rows > 1, `${listed.rows} rows`);
  check('results are grouped', listed.groups.length >= 1, listed.groups.join(' / '));
  check('the first row is selected by default', listed.selected === 0);

  // ↑ from the first row must land on the last, not stop dead.
  await page.keyboard.press('ArrowUp');
  const wrapped = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.palette-result'));
    return {
      at: rows.indexOf(document.querySelector('.palette-result[aria-selected="true"]')),
      last: rows.length - 1,
      active: document.querySelector('.palette-input').getAttribute('aria-activedescendant'),
    };
  });
  check('arrow keys wrap around the list', wrapped.at === wrapped.last,
    `at ${wrapped.at} of ${wrapped.last}`);
  check('the selection is announced with aria-activedescendant',
    !!wrapped.active, wrapped.active ?? 'none');

  // Tab is the domain filter, and it must not move focus out of the panel.
  const tabbed = await page.evaluate(async () => {
    const before = document.querySelector('[data-palette-filter]').textContent.trim();
    return { before };
  });
  await page.keyboard.press('Tab');
  await page.waitForTimeout(200);
  const afterTab = await page.evaluate(() => ({
    label: document.querySelector('[data-palette-filter]').textContent.trim(),
    focused: document.activeElement.className,
  }));
  check('Tab cycles the domain filter', afterTab.label !== tabbed.before,
    `"${tabbed.before}" -> "${afterTab.label}"`);
  check('Tab does not move focus out of the panel',
    afterTab.focused.includes('palette-input'), `focused "${afterTab.focused}"`);

  // Focus cannot be stolen by anything behind the scrim either.
  await page.evaluate(() => document.querySelector('.masthead-brand').focus());
  await page.waitForTimeout(100);
  const trapped = await page.evaluate(() => document.activeElement.className);
  check('focus is pulled back into the panel',
    trapped.includes('palette-input'), `focused "${trapped}"`);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const closed = await page.evaluate(() => ({
    hidden: document.querySelector('[data-palette]').hidden,
    overflow: document.documentElement.style.overflow,
    query: document.querySelector('.palette-input').value,
  }));
  check('Escape closes the palette', closed.hidden);
  check('the page can scroll again', closed.overflow === '');
  check('the query is cleared on close', closed.query === '');
  await ctx.close();
}

// Focus restore, on its own page: the element focused *before* opening is the
// one to come back to, and the trap correctly refuses to let the test move
// focus after the fact.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/`);

  await page.evaluate(() => document.querySelector('[data-search-open]').focus());
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(400);
  const inside = await page.evaluate(() => document.activeElement.className);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const back = await page.evaluate(() => document.activeElement.className);

  check('focus enters the panel from the trigger', inside.includes('palette-input'));
  check('focus is restored to the trigger on close',
    back.includes('masthead-search'), `focused "${back}"`);
  await ctx.close();
}

// Enter navigates. Its own context because the domain filter is session state
// by design — a Tab pressed in an earlier assertion would still be narrowing
// the results here, and the failure would look like a broken Enter key.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/`);
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(500);
  await page.keyboard.type('stoicism');
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await page.waitForURL('**/stoicism/**', { timeout: 3000 }).catch(() => {});
  check('Enter opens the selected result',
    page.url().includes('/stoicism/'), page.url().replace(`http://localhost:${PORT}`, ''));
  await ctx.close();
}

// The trigger must still go somewhere without JS rather than being a dead
// control: the palette cannot exist, but the archive filters without JS too.
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    javaScriptEnabled: false,
  });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/`);
  const href = await page.getAttribute('[data-search-open]', 'href');
  check('the search trigger has a no-JS destination',
    !!href && href !== '#', href ?? 'none');
  await ctx.close();
}

// On a phone the panel fills the page gutter and the key hints go away, since
// there are no keys to press.
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/`);
  await page.evaluate(() => document.querySelector('[data-search-open]').click());
  await page.waitForTimeout(500);

  const phone = await page.evaluate(() => {
    const panel = document.querySelector('.palette-panel').getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue('--page-pad'));
    return {
      width: Math.round(panel.width),
      expected: Math.round(window.innerWidth - pad * 2),
      inside: panel.left >= 0 && panel.right <= window.innerWidth + 1,
      hintsShown: getComputedStyle(document.querySelector('.palette-foot')).display,
      fits: panel.bottom <= window.innerHeight + 1,
    };
  });
  check('the panel fills the gutter on a phone', phone.width === phone.expected,
    `${phone.width}px of ${phone.expected}px`);
  check('the panel is inside the viewport on a phone', phone.inside && phone.fits);
  check('key hints are hidden on a phone', phone.hintsShown === 'none',
    phone.hintsShown);
  await ctx.close();
}

// ── Compose (screen 1g) ────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/create-post/`);

  await page.fill('#c-title', 'A Test Post: Draft & Others');
  await page.selectOption('#c-domain', 'reflections');
  await page.fill('#c-subtopic', 'Philosophy');
  await page.fill('#c-tags', 'one, two');
  await page.fill('#c-abstract', 'A summary.');
  await page.fill('#c-body', '# Body\n\nSome **markdown**.');
  await page.waitForTimeout(300);

  const composed = await page.evaluate(() => ({
    path: document.querySelector('[data-path]').textContent.trim(),
    file: document.querySelector('[data-file]').textContent,
    rendered: document.querySelector('[data-rendered]').innerHTML,
    count: document.querySelector('[data-count]').textContent.trim(),
  }));

  // The reorg before Phase 1 moved the collections under _content/. The old
  // script still wrote to `_<domain>/…` at the repo root, which would have
  // committed successfully and published nothing.
  check('the target path is under _content/',
    composed.path.startsWith('_content/_reflections/philosophy/'), composed.path);
  check('the filename is dated and slugged',
    /\/\d{4}-\d{2}-\d{2}-a-test-post-draft-others\.md$/.test(composed.path), composed.path);
  check('a colon in the title is escaped, not left to break the YAML',
    composed.file.includes('title: "A Test Post: Draft & Others"'));
  check('tags become a YAML list', composed.file.includes('tags: ["one", "two"]'));
  check('the preview renders markdown, not raw text',
    composed.rendered.includes('<strong>') && composed.rendered.includes('<h1'),
    composed.rendered.slice(0, 60));
  // "# Body\n\nSome **markdown**." is three words of prose. Counting raw
  // tokens gives four — the "#" — which is why the counter strips syntax.
  check('the word count counts prose, not markup',
    /^3 words/.test(composed.count), composed.count);

  // Draft must produce a key Jekyll actually honours.
  // The radio input itself is visually hidden — .n-radio draws its own dot —
  // so the label is what a reader clicks and what the test must click too.
  await page.click('.n-radio:has(input[value="draft"])');
  await page.waitForTimeout(200);
  const draft = await page.textContent('[data-file]');
  check('draft writes published: false', draft.includes('published: false'));

  // The token lives in localStorage and nowhere else.
  await page.fill('#c-token', 'ghp_fake_token_for_testing');
  await page.waitForTimeout(200);
  const stored = await page.evaluate(() => ({
    ls: localStorage.getItem('noema-gh-token'),
    state: document.querySelector('[data-token-state]').textContent.trim(),
    inFile: document.querySelector('[data-file]').textContent.includes('ghp_fake'),
    type: document.querySelector('#c-token').type,
  }));
  check('the token is stored in localStorage', stored.ls === 'ghp_fake_token_for_testing');
  check('the token field is a password field', stored.type === 'password');
  check('the token never reaches the file', !stored.inFile);
  check('the token state is reported', stored.state.includes('Stored'), stored.state);

  await page.click('[data-forget]');
  await page.waitForTimeout(200);
  const forgotten = await page.evaluate(() => ({
    ls: localStorage.getItem('noema-gh-token'),
    state: document.querySelector('[data-token-state]').textContent.trim(),
  }));
  check('the token can be forgotten',
    !forgotten.ls && forgotten.state.includes('Not stored'), forgotten.state);

  // Committing without a token must not fire a request.
  const calls = [];
  page.on('request', (r) => {
    if (r.url().includes('api.github.com')) calls.push(r.url());
  });
  await page.click('[data-commit]');
  await page.waitForTimeout(400);
  const guarded = await page.textContent('[data-status]');
  check('commit without a token is refused before any request',
    calls.length === 0 && /token/i.test(guarded), guarded.trim().slice(0, 40));

  await ctx.close();
}

// The page is a private tool on a public site.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/create-post/`);
  const robots = await page.getAttribute('meta[name="robots"]', 'content');
  check('compose is noindex', /noindex/.test(robots ?? ''), robots ?? 'none');

  const sitemap = await page.goto(`http://localhost:${PORT}/sitemap.xml`);
  const xml = await sitemap.text();
  check('compose is out of the sitemap', !xml.includes('/create-post/'));
  check('the styleguide is out of the sitemap', !xml.includes('/styleguide/'));

  const feed = await page.goto(`http://localhost:${PORT}/feed.xml`);
  const rss = await feed.text();
  check('compose is out of the feed', !rss.includes('/create-post/'));
  await ctx.close();
}

// Below $bp-md the tool is replaced by a notice rather than reflowed into
// something unusable.
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/create-post/`);
  const narrow = await page.evaluate(() => ({
    notice: getComputedStyle(document.querySelector('.compose-narrow')).display,
    panes: getComputedStyle(document.querySelector('.compose-panes')).display,
    bar: getComputedStyle(document.querySelector('.compose-bar')).display,
    doc: document.documentElement.scrollWidth,
    vw: window.innerWidth,
  }));
  check('the narrow notice replaces the tool', narrow.notice !== 'none');
  check('the panes are not rendered on a phone',
    narrow.panes === 'none' && narrow.bar === 'none');
  check('compose does not scroll sideways on a phone',
    narrow.doc <= narrow.vw + 1, `${narrow.doc} vs ${narrow.vw}`);
  await ctx.close();
}

await browser.close();
server.close();

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
