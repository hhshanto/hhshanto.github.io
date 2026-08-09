// Build the embedding atlas — dev-only, run when you publish.
//
//   node .tools/embed.mjs              TF-IDF + PCA, no key, no network
//   node .tools/embed.mjs --azure      real neural embeddings, needs .env
//
// Writes _data/atlas.json: one record per piece with 3D coordinates and its
// nearest neighbours by cosine similarity. THE SITE SHIPS ONLY THAT FILE. No
// key, no model and no request ever reaches a reader — the whole point of doing
// this offline is that /atlas/ is as static as every other page.
//
// _data/ rather than assets/, so Jekyll reads it at build time and Liquid can
// render the coordinates onto the nodes themselves. That means the page needs
// no fetch, and the nearest-neighbour lists are real HTML links that work with
// scripting off — the same reason pages/constellation.html carries its graph in
// data-* attributes instead of a JSON blob.
//
// TWO BACKENDS, ON PURPOSE, and the page says which one produced the file.
//
//   tfidf   Term frequency times inverse document frequency, then PCA. No
//           network, no key, deterministic, and it runs on a laptop with no
//           account. It is a real vector space and it finds real structure,
//           but it is LEXICAL: two pieces are close because they share words.
//           Write about elections in one and ballots in the other and it sees
//           nothing.
//
//   azure   text-embedding-3-small through your own deployment. SEMANTIC:
//           elections and ballots land together because the model learned they
//           belong together. This is the version worth publishing, and the
//           difference between the two maps is itself the interesting thing —
//           run both and see which pieces move.
//
// Costs money and quota, which is why it is not the default. Needs
// AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY and AZURE_OPENAI_EMBED_DEPLOYMENT in
// .env (the deployment name is whatever you called it in the Azure portal —
// the endpoint alone does not identify a model).
//
// PCA rather than UMAP or t-SNE, deliberately. UMAP needs a dependency this
// repo will not take, and both it and t-SNE are stochastic and have
// hyperparameters that change the picture a lot — a map that rearranges when
// you re-run it teaches the reader nothing, and t-SNE distances between
// clusters are famously not meaningful. PCA is a rotation. Distances survive
// it as well as any projection to three dimensions can, it is deterministic,
// and it reports how much variance it kept so the page can be honest about how
// much got thrown away.

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = 'c:/Users/hasan/hhshanto.github.io';
const CONTENT = join(ROOT, '_content');
const OUT = join(ROOT, '_data/atlas.json');

const useAzure = process.argv.includes('--azure');

// ── Corpus ────────────────────────────────────────────────────────────────
// Read the markdown directly rather than the built search.json. search.json
// has the same text and would save the front-matter parsing, but it only
// exists after a build, and a stale _site would silently embed yesterday's
// corpus — the kind of wrong that looks exactly like right.

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    // _templates holds skeletons for new posts, not posts.
    if (entry.isDirectory()) {
      if (entry.name === '_templates') continue;
      out.push(...await walk(path));
    } else if (entry.name.endsWith('.md')) {
      out.push(path);
    }
  }
  return out;
}

function frontMatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  // Enough YAML for `key: value` and `key: "value"`. Anything structured is
  // read off the path instead, so this never has to grow into a parser.
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim();
  }
  return { meta, body: m[2] };
}

const files = await walk(CONTENT);
const docs = [];

for (const file of files) {
  const raw = await readFile(file, 'utf8');
  const { meta, body } = frontMatter(raw);
  // _content/_reflections/philosophy/stoicism.md
  //   → domain "reflections", sub "philosophy", url /reflections/philosophy/stoicism/
  const parts = relative(CONTENT, file).split(/[\\/]/);
  const domain = parts[0].replace(/^_/, '');
  // The date prefix STAYS. _config.yml gives each collection the permalink
  // /<collection>/:path/, and for a collection — unlike _posts — Jekyll's :path
  // is the filename verbatim, date and all: the real URL is
  // /natural-sciences/physics/2025-03-08-higgs-boson-discovery-implications/.
  // Stripping it produced twelve plausible-looking URLs of which ten 404ed, and
  // nothing on the page looked wrong until a link was clicked.
  const slug = parts[parts.length - 1].replace(/\.md$/, '');
  const url = '/' + [domain, ...parts.slice(1, -1), slug].join('/') + '/';

  const text = body
    .replace(/```[\s\S]*?```/g, ' ')      // code blocks are not prose
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // keep link text, drop the href
    .replace(/[#>*_`~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  docs.push({
    url,
    title: meta.title || slug,
    domain,
    sub: parts.length > 2 ? parts[1] : '',
    date: meta.date || '',
    words: text.split(' ').length,
    text,
  });
}

docs.sort((a, b) => (a.url < b.url ? -1 : 1));
console.log(`corpus: ${docs.length} pieces, ${docs.reduce((n, d) => n + d.words, 0)} words`);

// ── Vectors ───────────────────────────────────────────────────────────────

// A stopword list is the difference between a map of your ideas and a map of
// how often you write "the". Kept short on purpose: TF-IDF already suppresses
// anything that appears everywhere, so this only has to catch the words that
// are frequent AND unevenly distributed.
const STOP = new Set(('a about above after again against all am an and any are as at be because been '
  + 'before being below between both but by can cannot could did do does doing down during each few '
  + 'for from further had has have having he her here hers herself him himself his how i if in into '
  + 'is it its itself me more most my myself no nor not of off on once only or other ought our ours '
  + 'ourselves out over own same she should so some such than that the their theirs them themselves '
  + 'then there these they this those through to too under until up very was we were what when where '
  + 'which while who whom why with would you your yours yourself yourselves').split(' '));

function tokens(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function tfidf(docs) {
  const tf = docs.map((d) => {
    const counts = new Map();
    const t = tokens(d.text);
    t.forEach((w) => counts.set(w, (counts.get(w) || 0) + 1));
    // Sublinear scaling. Raw counts let one long piece dominate every axis;
    // 1 + log(count) is the standard fix and it matters a lot at n = 12.
    counts.forEach((v, k) => counts.set(k, 1 + Math.log(v)));
    return counts;
  });

  const df = new Map();
  tf.forEach((counts) => counts.forEach((_, w) => df.set(w, (df.get(w) || 0) + 1)));

  // A term in only one document cannot say anything about which documents are
  // alike, and there are thousands of them. Dropping them cuts the vocabulary
  // by about two thirds for no loss.
  const vocab = [...df.keys()].filter((w) => df.get(w) > 1).sort();
  const index = new Map(vocab.map((w, i) => [w, i]));
  const N = docs.length;

  return tf.map((counts) => {
    const v = new Float64Array(vocab.length);
    counts.forEach((val, w) => {
      const i = index.get(w);
      if (i !== undefined) v[i] = val * Math.log(N / df.get(w));
    });
    // L2 normalise, so cosine similarity is a dot product and a long piece is
    // not automatically far from the origin.
    let norm = 0;
    for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < v.length; i++) v[i] /= norm;
    return v;
  });
}

async function azure(docs) {
  const env = Object.fromEntries((await readFile(join(ROOT, '.env'), 'utf8'))
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]));

  const endpoint = env.AZURE_OPENAI_ENDPOINT;
  const key = env.AZURE_OPENAI_KEY;
  const deployment = env.AZURE_OPENAI_EMBED_DEPLOYMENT;
  if (!endpoint || !key || !deployment) {
    throw new Error('--azure needs AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY and '
      + 'AZURE_OPENAI_EMBED_DEPLOYMENT in .env');
  }

  const url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}`
    + '/embeddings?api-version=2023-05-15';

  const out = [];
  for (const d of docs) {
    // The whole piece in one request. text-embedding-3-small takes 8191
    // tokens, which is more than anything here; a longer archive would need
    // chunking and mean-pooling, and that is the point at which this script
    // stops being twenty lines.
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({ input: `${d.title}\n\n${d.text}`.slice(0, 24000) }),
    });
    if (!res.ok) throw new Error(`azure ${res.status}: ${await res.text()}`);
    const json = await res.json();
    out.push(Float64Array.from(json.data[0].embedding));
    console.log(`  embedded ${d.url}`);
  }
  return out;
}

const vectors = useAzure ? await azure(docs) : tfidf(docs);
const backend = useAzure ? 'azure · text-embedding-3-small' : 'tf-idf (lexical, offline)';
console.log(`vectors: ${vectors.length} × ${vectors[0].length}  [${backend}]`);

// ── PCA, via the Gram matrix ──────────────────────────────────────────────
//
// The covariance matrix here would be vocab × vocab — tens of thousands
// square. The Gram matrix is docs × docs, twelve square, and its eigenvectors
// give the same principal scores. That equivalence is the whole trick, and it
// is why this runs instantly on a corpus with a bigger vocabulary than it has
// documents.

const n = vectors.length;
const mean = new Float64Array(vectors[0].length);
vectors.forEach((v) => { for (let i = 0; i < v.length; i++) mean[i] += v[i] / n; });
const centred = vectors.map((v) => {
  const c = new Float64Array(v.length);
  for (let i = 0; i < v.length; i++) c[i] = v[i] - mean[i];
  return c;
});

const gram = [];
for (let i = 0; i < n; i++) {
  gram.push(new Float64Array(n));
  for (let j = 0; j < n; j++) {
    let s = 0;
    for (let k = 0; k < centred[i].length; k++) s += centred[i][k] * centred[j][k];
    gram[i][j] = s;
  }
}

// Power iteration with deflation. Three components from a 12×12 matrix does
// not justify a QR algorithm, and this is ten lines with no library.
function topEigen(M, size, count) {
  const A = M.map((row) => Float64Array.from(row));
  const out = [];
  for (let c = 0; c < count; c++) {
    // Deterministic start vector. A random one converges just as well and
    // would make the whole atlas different on every run.
    let v = Float64Array.from({ length: size }, (_, i) => Math.cos(i * (c + 1) + 1));
    let lambda = 0;
    for (let iter = 0; iter < 500; iter++) {
      const w = new Float64Array(size);
      for (let i = 0; i < size; i++) {
        let s = 0;
        for (let j = 0; j < size; j++) s += A[i][j] * v[j];
        w[i] = s;
      }
      let norm = Math.hypot(...w) || 1;
      for (let i = 0; i < size; i++) w[i] /= norm;
      lambda = norm;
      v = w;
    }
    out.push({ vector: v, value: lambda });
    // Deflate: subtract this component so the next iteration finds the next
    // one instead of the same one again.
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) A[i][j] -= lambda * v[i] * v[j];
    }
  }
  return out;
}

const comps = topEigen(gram, n, 3);
let trace = 0;
for (let i = 0; i < n; i++) trace += gram[i][i];
const explained = comps.map((c) => Number((c.value / trace).toFixed(4)));
console.log(`explained variance: ${explained.map((e) => (e * 100).toFixed(1) + '%').join(' · ')}`
  + `  (total ${(explained.reduce((a, b) => a + b) * 100).toFixed(1)}%)`);

// Scores are eigenvector × sqrt(eigenvalue), then scaled to a unit-ish cube so
// the renderer does not have to know anything about the source vectors.
const coords = docs.map((_, i) => comps.map((c) => c.vector[i] * Math.sqrt(c.value)));
const extent = Math.max(...coords.flat().map(Math.abs)) || 1;

// ── Neighbours ────────────────────────────────────────────────────────────
// Computed on the FULL vectors, not the 3D projection. The projection is a
// lossy view; saying "nearest in the original space" and then measuring in the
// picture would be a quiet lie, and the gap between the two is exactly what
// the explained-variance figure is warning about.

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

const out = docs.map((d, i) => ({
  url: d.url,
  title: d.title,
  domain: d.domain,
  sub: d.sub,
  date: d.date,
  words: d.words,
  xyz: coords[i].map((v) => Number((v / extent).toFixed(4))),
  near: docs
    .map((o, j) => ({ url: o.url, title: o.title, score: Number(cosine(vectors[i], vectors[j]).toFixed(4)) }))
    .filter((_, j) => j !== i)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3),
}));

await writeFile(OUT, JSON.stringify({
  backend,
  // Deliberately not a timestamp: a date that changes on every run makes the
  // file dirty in git even when every number is identical.
  generated: new Date().toISOString().slice(0, 10),
  count: docs.length,
  dims: useAzure ? vectors[0].length : vectors[0].length,
  explained,
  docs: out,
}, null, 1) + '\n');

console.log(`wrote ${relative(ROOT, OUT)}`);
