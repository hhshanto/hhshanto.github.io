// Capture the compose tool with a post typed into it. shoot.mjs only ever sees
// it empty, and empty is the one state where the preview pane proves nothing.
//
//   node .tools/shoot-compose.mjs [--no-build]
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { extname, join } from 'node:path';

const REPO = 'c:/Users/hasan/hhshanto.github.io';
const SITE = `${REPO}/.tools/.site`;
const OUT = `${REPO}/.tools/shots`;
const PORT = 4990;
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
};

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

const BODY = `Stoicism survived two thousand years by being useful rather than
clever. The reason is unglamorous: it was built to be used.

## The Four Virtues

The Stoics organised the good life around four qualities. **Wisdom** is
discerning right from wrong. *Courage* is holding to it when it costs you.

> Virtue is sufficient for a good life.

Some \`inline code\` and a [link](/about/).`;

const browser = await chromium.launch();

for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/create-post/`);

  await page.fill('#c-title', 'What is Stoicism? The Basics');
  await page.selectOption('#c-domain', 'reflections');
  await page.fill('#c-subtopic', 'philosophy');
  await page.fill('#c-tags', 'stoicism, philosophy');
  await page.fill('#c-abstract', 'A practical guide to Stoicism and what you do with it.');
  await page.fill('#c-body', BODY);
  await page.waitForTimeout(300);

  const state = await page.evaluate(() => ({
    path: document.querySelector('[data-path]').textContent.trim(),
    count: document.querySelector('[data-count]').textContent.trim(),
    renderedTags: Array.from(document.querySelectorAll('[data-rendered] > *'))
      .map((el) => el.tagName.toLowerCase()).join(','),
  }));
  console.log(`${theme}`, JSON.stringify(state));

  await page.screenshot({ path: `${OUT}/compose__${theme}__markdown.png` });

  // The FILE tab shows exactly what will be committed.
  await page.click('[data-tab="file"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/compose__${theme}__file.png` });

  if (theme === 'light') {
    console.log('\n--- file that would be committed ---');
    console.log(await page.textContent('[data-file]'));
  }

  await ctx.close();
}

await browser.close();
server.close();
console.log('\nwritten to .tools/shots/');
