// Capture the ⌘K palette, which shoot.mjs cannot reach — it screenshots pages
// at rest, and the palette only exists after a keystroke.
//
//   node .tools/shoot-palette.mjs            open, empty
//   node .tools/shoot-palette.mjs stoicism   open, with a query typed
//
// Builds to .tools/.site like the rest of the harness; never to _site.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { extname, join } from 'node:path';

const REPO = 'c:/Users/hasan/hhshanto.github.io';
const SITE = `${REPO}/.tools/.site`;
const OUT = `${REPO}/.tools/shots`;
const PORT = 4994;
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
};

const query = process.argv[2] ?? '';

if (!process.argv.includes('--no-build')) {
  console.log('building…');
  execFileSync('bundle', ['exec', 'jekyll', 'build', '-d', SITE], {
    cwd: REPO, stdio: 'inherit', shell: true,
  });
}

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

for (const [name, width] of [['mobile-375', 375], ['desktop-1440', 1440]]) {
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
    const page = await ctx.newPage();
    await page.goto(`http://localhost:${PORT}/all-posts/`);

    await page.keyboard.press('Control+k');
    if (query) await page.keyboard.type(query);
    // The index is fetched on open; give it a moment to land and render.
    await page.waitForTimeout(600);

    const geo = await page.evaluate(() => {
      const panel = document.querySelector('.palette-panel').getBoundingClientRect();
      return {
        top: Math.round(panel.top),
        width: Math.round(panel.width),
        height: Math.round(panel.height),
        rows: document.querySelectorAll('.palette-result').length,
        focused: document.activeElement.className,
      };
    });
    console.log(`${theme}/${name}`, JSON.stringify(geo));

    const tag = query ? `palette-${query}` : 'palette';
    await page.screenshot({ path: `${OUT}/${tag}__${theme}__${name}.png` });
    await ctx.close();
  }
}

await browser.close();
server.close();
console.log(`\nwritten to .tools/shots/`);
