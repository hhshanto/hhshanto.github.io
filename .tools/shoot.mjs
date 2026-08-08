// Screenshot harness. Dev-only — this directory never ships, and the site
// keeps its no-node property.
//
//   node .tools/shoot.mjs / /about/ /reflections/some-post/
//   node .tools/shoot.mjs --tag before /          # prefixes the filenames
//   node .tools/shoot.mjs --no-build /            # skip jekyll, reuse _site
//
// Captures each path at four widths in both themes and writes PNGs to
// .tools/shots/. Read those back to check work; it is the only way to see
// the page.

import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SITE = join(ROOT, '_site');
const OUT = join(import.meta.dirname, 'shots');
const PORT = 4998;

// Named for the breakpoints in _sass/_tokens.scss, plus one below $bp-sm and
// one above $bp-lg, so every band the CSS distinguishes gets exercised.
const WIDTHS = [
  { name: 'mobile', width: 375, height: 900 },
  { name: 'sm', width: 700, height: 1000 },
  { name: 'md', width: 900, height: 1000 },
  { name: 'desktop', width: 1440, height: 1000 },
];
const THEMES = ['light', 'dark'];

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.xml': 'application/xml', '.pdf': 'application/pdf', '.ico': 'image/x-icon',
};

const args = process.argv.slice(2);

// Two parsers, because a boolean flag must not swallow the argument after it —
// `--full /styleguide/` would otherwise consume the path and silently shoot the
// home page instead.
const boolFlag = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return false;
  args.splice(i, 1);
  return true;
};
const valueFlag = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return null;
  const [, value] = args.splice(i, 2);
  return value ?? null;
};

const noBuild = boolFlag('--no-build');
const fullPage = boolFlag('--full');
const tag = valueFlag('--tag');
const paths = args.length ? args : ['/'];

if (!noBuild) {
  console.log('building…');
  // shell: true because on Windows `bundle` is a .bat shim, which CreateProcess
  // will not execute directly.
  //
  // `clean` first: a stray `jekyll serve` from another terminal leaves _site
  // holding pages built against a localhost url and files that a later
  // `exclude` was supposed to drop. Screenshotting that is how you conclude a
  // fix worked when it didn't.
  spawnSync('bundle', ['exec', 'jekyll', 'clean'], {
    cwd: ROOT, stdio: 'ignore', shell: true,
  });
  const build = spawnSync('bundle', ['exec', 'jekyll', 'build'], {
    cwd: ROOT, stdio: 'inherit', shell: true,
  });
  if (build.status !== 0) {
    console.error('\njekyll build failed — not screenshotting a stale _site.');
    process.exit(1);
  }
}

if (!existsSync(SITE)) {
  console.error('_site does not exist. Run without --no-build.');
  process.exit(1);
}

// Static server over _site. Simpler and quieter than driving `jekyll serve`,
// and it exits cleanly when we're done.
const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = join(SITE, urlPath);
    if (!file.startsWith(SITE)) return res.writeHead(403).end();
    if (!extname(file)) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(PORT, r));

await mkdir(OUT, { recursive: true });
// Clear previous shots for these paths so a stale PNG is never mistaken for a
// fresh one — the failure mode is believing a fix worked when it didn't.
const prefix = tag ? `${tag}__` : '';
for (const f of await readdir(OUT).catch(() => [])) {
  if (f.startsWith(prefix) && f.endsWith('.png')) await unlink(join(OUT, f));
}

const browser = await chromium.launch();
let count = 0;

for (const path of paths) {
  const slug = path.replace(/^\/|\/$/g, '').replace(/\//g, '-') || 'home';

  for (const theme of THEMES) {
    const context = await browser.newContext({
      colorScheme: theme,
      deviceScaleFactor: 2,
      reducedMotion: 'reduce',
    });
    // Set the stored theme before any page script runs, so we capture the
    // committed choice rather than a first-paint flash.
    await context.addInitScript((t) => {
      try { localStorage.setItem('theme', t); } catch {}
    }, theme);

    const page = await context.newPage();

    for (const vp of WIDTHS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const res = await page.goto(`http://localhost:${PORT}${path}`, {
        waitUntil: 'networkidle',
      });
      if (!res || res.status() >= 400) {
        console.error(`  ${path} -> ${res ? res.status() : 'no response'}`);
        continue;
      }
      await page.evaluate(() => document.fonts.ready);

      const name = `${prefix}${slug}__${theme}__${vp.name}-${vp.width}.png`;
      await page.screenshot({ path: join(OUT, name), fullPage });
      count++;
    }
    await context.close();
  }
  console.log(`shot ${path}`);
}

await browser.close();
server.close();
console.log(`\n${count} screenshots -> .tools/shots/`);
