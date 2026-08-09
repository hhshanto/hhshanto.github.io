// Screenshot the atlas with a point under the pointer.
//
// At rest every point is an unlabelled dot; the title, the domain and the three
// nearest neighbours only exist once something is hovered. Same reason
// shoot-constellation.mjs exists, and the same waiting problem in a harder
// form: the cloud never stops spinning, so Playwright's hover gives up with
// "element is not stable" rather than eventually catching it.
//
// The fix is to emulate prefers-reduced-motion. atlas.js honours it by never
// starting the rAF loop, so the cloud is simply still — no polling, no hook
// into the module, and the capture doubles as a check that the accommodation
// works. Pressing the pointer down would also stop it, but the stage takes
// pointer capture during a drag, so the point's own pointerenter never fires
// and the readout stays empty.
//
//   node .tools/shoot-atlas.mjs        the third point
//   node .tools/shoot-atlas.mjs 8      the eighth
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const SITE = 'c:/Users/hasan/hhshanto.github.io/.tools/.site';
const OUT = 'c:/Users/hasan/hhshanto.github.io/.tools/shots';
const PORT = 4990;
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon' };

const nth = Number(process.argv[2] || 3);

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

for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/atlas/`);

  const point = page.locator('.atlas-point').nth(nth - 1);
  await point.hover();
  await page.waitForTimeout(250);

  await page.screenshot({ path: join(OUT, `hover__atlas__${theme}.png`) });
  console.log(`hover ${theme} -> ${await point.getAttribute('data-title')}`);
  await ctx.close();
}

await browser.close();
server.close();
