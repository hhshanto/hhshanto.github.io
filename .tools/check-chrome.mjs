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

await browser.close();
server.close();

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
