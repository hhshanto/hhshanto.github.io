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

await browser.close();
server.close();

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
