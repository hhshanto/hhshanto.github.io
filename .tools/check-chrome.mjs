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

// ── Home hero clears the masthead ──────────────────────────────────────────
// _hero.scss pulls the hero up by -70px for the old fixed header. Left in, it
// drags the dark hero card over the bar and the nav text vanishes into it.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/`);
  const gap = await page.evaluate(() => {
    const bar = document.querySelector('.masthead').getBoundingClientRect();
    const hero = document.querySelector('.hero-section');
    if (!hero) return null;
    return hero.getBoundingClientRect().top - bar.bottom;
  });
  check('home hero starts below the masthead, not under it',
    gap === null || gap >= 0, gap === null ? 'no hero' : `gap ${gap.toFixed(1)}px`);
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

await browser.close();
server.close();

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
