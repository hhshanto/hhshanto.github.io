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
const alphaOf = (s) => {
  const n = s.match(/\d+(\.\d+)?/g);
  return n && n.length === 4 ? Number(n[3]) : 1;
};
// A translucent background is not the colour a reader sees. The accent chip in
// dark is a 16% gold wash: measured raw it reports 1.35:1 against its own gold,
// which is neither what is painted nor what anyone looks at.
const over = (fg, bg, a) => fg.map((c, i) => c * a + bg[i] * (1 - a));
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

// `url` defaults to the domain index; `ground` names an element whose own
// background the text sits on, for anything not painted straight onto the body.
// The code block is the whole reason that option exists: it keeps a dark ground
// in both themes, so measuring its tokens against the page would pass in dark
// and fail in light while the real thing is identical in both.
const POST = '/reflections/philosophy/stoicism/';
const GUIDE = '/styleguide/';

const TARGETS = [
  { sel: '.masthead-brand', name: 'brand' },
  { sel: '.masthead-link', name: 'nav link' },
  { sel: '.masthead-link[aria-current="page"]', name: 'nav link (current)' },
  { sel: '.masthead-search', name: 'search trigger' },
  { sel: '.masthead-theme', name: 'theme toggle' },
  { sel: '.site-foot-copy', name: 'footer copyright' },
  { sel: '.site-foot-links a', name: 'footer link' },

  // Home (screen 1a).
  { sel: '.home-hero-title em', name: 'hero second line', url: '/' },
  { sel: '.home-hero-intro', name: 'hero intro', url: '/' },
  { sel: '.home-social', name: 'social link', url: '/' },
  { sel: '.post-brief-rail span', name: 'post date rail', url: '/' },
  { sel: '.post-brief-read', name: 'post read time', url: '/' },
  { sel: '.post-brief-excerpt', name: 'post excerpt', url: '/' },
  { sel: '.cv-cell-head', name: 'cv cell heading', url: '/' },
  { sel: '.cv-period', name: 'cv period', url: '/' },
  { sel: '.cv-role', name: 'cv role', url: '/' },
  { sel: '.cv-place', name: 'cv place', url: '/' },
  { sel: '.cv-currently', name: 'currently note', url: '/' },
  { sel: '.n-tag-accent', name: 'accent chip', url: '/', ground: '.n-tag-accent' },
  { sel: '.n-tag-neutral', name: 'neutral chip', url: '/', ground: '.n-tag-neutral' },

  // Post (screen 1c).
  { sel: '.article-breadcrumb a', name: 'breadcrumb', url: POST },
  { sel: '.article-standfirst', name: 'standfirst', url: POST },
  { sel: '.article-author', name: 'byline name', url: POST },
  { sel: '.article-date', name: 'byline date', url: POST },
  { sel: '.article-body p', name: 'body prose', url: POST },
  { sel: '.post-toc-link', name: 'contents link', url: POST },
  { sel: '.is-current .post-toc-link', name: 'contents link (current)', url: POST },
  { sel: '.post-rail-stat dd', name: 'rail stats', url: POST },
  { sel: '.post-nav-dir', name: 'prev/next direction', url: POST },
  { sel: '.related-meta', name: 'related meta', url: POST },

  // Code block — its own dark ground, identical in both themes.
  { sel: '.code-label', name: 'code language label', url: GUIDE, ground: 'div.highlighter-rouge' },
  { sel: '.highlight .k', name: 'code keyword', url: GUIDE, ground: 'div.highlighter-rouge' },
  { sel: '.highlight .nf', name: 'code function', url: GUIDE, ground: 'div.highlighter-rouge' },
  { sel: '.highlight .nb', name: 'code builtin', url: GUIDE, ground: 'div.highlighter-rouge' },
  { sel: '.highlight .c1', name: 'code comment', url: GUIDE, ground: 'div.highlighter-rouge' },
  { sel: '.highlight .n', name: 'code plain', url: GUIDE, ground: 'div.highlighter-rouge' },
];

const browser = await chromium.launch();

for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
  const page = await ctx.newPage();

  let loaded = null;
  let body = null;

  console.log(`\n=== ${theme.toUpperCase()} ===`);
  for (const { sel, name, url = '/reflections/', ground } of TARGETS) {
    if (url !== loaded) {
      await page.goto(`http://localhost:${PORT}${url}`);
      loaded = url;
      body = parse(await page.evaluate(() =>
        getComputedStyle(document.body).backgroundColor));
    }

    const el = page.locator(sel).first();
    if (!(await el.count())) { console.log(`  ---- ${name.padEnd(22)} not found`); continue; }

    let bg = body;
    if (ground) {
      const g = page.locator(ground).first();
      if (await g.count()) {
        const raw = await g.evaluate((n) => getComputedStyle(n).backgroundColor);
        bg = over(parse(raw), body, alphaOf(raw));
      }
    }

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
      `  ${verdict} ${name.padEnd(22)} ${r.toFixed(2)}:1  (needs ${need})  ${info.size}px  on rgb(${bg.map((c) => Math.round(c)).join(',')})`,
    );
  }
  await ctx.close();
}

await browser.close();
server.close();
