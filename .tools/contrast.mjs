// Measure computed colour and WCAG contrast for the masthead in both themes.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const SITE = 'c:/Users/hasan/hhshanto.github.io/.tools/.site';
const PORT = 4996;
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };

const server = createServer(async (req, res) => {
  try {
    let f = join(SITE, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!extname(f)) f = join(f, 'index.html');
    res.writeHead(200, { 'content-type': MIME[extname(f)] ?? 'application/octet-stream' });
    res.end(await readFile(f));
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(PORT, r));

const parse = (s) => s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
const lum = ([r, g, b]) => {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

const TARGETS = [
  ['.masthead-brand', 'brand'],
  ['.masthead-link', 'nav link'],
  ['.masthead-link[aria-current="page"]', 'nav link (current)'],
  ['.masthead-search', 'search trigger'],
  ['.masthead-theme', 'theme toggle'],
  ['.site-foot-copy', 'footer copyright'],
  ['.site-foot-links a', 'footer link'],
];

const browser = await chromium.launch();

for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/reflections/`);

  const bg = parse(await page.evaluate(() =>
    getComputedStyle(document.body).backgroundColor));

  console.log(`\n=== ${theme.toUpperCase()}  (ground rgb(${bg.join(',')})) ===`);
  for (const [sel, name] of TARGETS) {
    const el = page.locator(sel).first();
    if (!(await el.count())) { console.log(`  ${name.padEnd(20)} not found`); continue; }
    const info = await el.evaluate((n) => {
      const cs = getComputedStyle(n);
      return { color: cs.color, size: parseFloat(cs.fontSize), weight: cs.fontWeight };
    });
    const fg = parse(info.color);
    const r = ratio(fg, bg);
    // WCAG: 4.5:1 for normal text, 3:1 for >=24px or >=18.66px bold.
    const large = info.size >= 24 || (info.size >= 18.66 && Number(info.weight) >= 700);
    const need = large ? 3 : 4.5;
    const verdict = r >= need ? 'ok  ' : 'FAIL';
    console.log(
      `  ${verdict} ${name.padEnd(20)} ${r.toFixed(2)}:1  (needs ${need})  ${info.size}px  rgb(${fg.join(',')})`,
    );
  }
  await ctx.close();
}

await browser.close();
server.close();
