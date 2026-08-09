// Screenshot the constellation map with a piece under the pointer.
//
// shoot.mjs captures the page at rest, and at rest a piece is an unlabelled
// dot: its title, its dateline and its tags only exist once something is
// hovered or focused. That is the half of the screen a plain capture cannot
// see, so it gets its own script — the same reason shoot-palette.mjs exists.
//
// Serves .tools/.site/, which shoot.mjs builds. Run that first.
//
//   node .tools/shoot-constellation.mjs          the third piece
//   node .tools/shoot-constellation.mjs 7        the seventh
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const SITE = 'c:/Users/hasan/hhshanto.github.io/.tools/.site';
const OUT = 'c:/Users/hasan/hhshanto.github.io/.tools/shots';
const PORT = 4994;
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json', '.xml': 'application/xml' };

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
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/constellation/`);

  // The simulation cools on requestAnimationFrame, so the nodes are still
  // moving for the first few hundred milliseconds. Hovering mid-flight puts the
  // pointer where a dot no longer is; poll the node's own position until it
  // stops changing, the way check-chrome.mjs waits out a smooth scroll.
  const node = page.locator('.constellation-node.is-post').nth(nth - 1);
  let last = null;
  for (let i = 0; i < 40; i++) {
    const box = await node.boundingBox();
    const key = box && `${Math.round(box.x)},${Math.round(box.y)}`;
    if (key && key === last) break;
    last = key;
    await page.waitForTimeout(120);
  }

  await node.hover();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, `hover__constellation__${theme}.png`) });
  console.log(`hover ${theme} -> ${await node.getAttribute('data-label')}`);
  await ctx.close();
}

await browser.close();
server.close();
