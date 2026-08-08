import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const SITE = 'c:/Users/hasan/hhshanto.github.io/.tools/.site';
const PORT = 4995;
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

const browser = await chromium.launch();

for (const width of [1440, 1920, 2560]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/reflections/`);
  console.log(`\n=== viewport ${width}px ===`);

  const rows = await page.evaluate(() => {
    const sels = ['.masthead-bar', 'main.content', '.reflections-container', '.page-header', '.post-card', '.site-foot-inner'];
    return sels.map((s) => {
      const el = document.querySelector(s);
      if (!el) return { s, missing: true };
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        s,
        width: Math.round(r.width),
        left: Math.round(r.left),
        maxWidth: cs.maxWidth,
        padInline: `${cs.paddingLeft}/${cs.paddingRight}`,
      };
    });
  });
  for (const r of rows) {
    if (r.missing) { console.log(`  ${r.s.padEnd(24)} (not on page)`); continue; }
    console.log(`  ${r.s.padEnd(24)} w=${String(r.width).padStart(5)}  left=${String(r.left).padStart(4)}  max-width=${r.maxWidth.padEnd(9)} pad=${r.padInline}`);
  }
  await ctx.close();
}

await browser.close();
server.close();
