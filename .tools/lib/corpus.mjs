// Shared corpus machinery for the dev-only data scripts.
//
// embed.mjs (the atlas) and retrieval.mjs (BM25 vs LSA) both need to read the
// markdown, tokenise it and factorise a term-document matrix. Having each carry
// its own copy would mean two stopword lists and two tokenisers that drift, and
// the whole value of putting the atlas and the retrieval demo on the same site
// is that they are looking at the same corpus the same way.
//
// Nothing here ships. It runs on a laptop and writes numbers.

import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

export const ROOT = 'c:/Users/hasan/hhshanto.github.io';
const CONTENT = join(ROOT, '_content');

// ── Reading ───────────────────────────────────────────────────────────────

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      // _templates holds skeletons for new posts, not posts.
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
  // Enough YAML for `key: value`. Anything structured is read off the path
  // instead, so this never has to grow into a parser.
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim();
  }
  return { meta, body: m[2] };
}

export async function readCorpus() {
  const files = await walk(CONTENT);
  const docs = [];

  for (const file of files) {
    const raw = await readFile(file, 'utf8');
    const { meta, body } = frontMatter(raw);
    const parts = relative(CONTENT, file).split(/[\\/]/);
    const domain = parts[0].replace(/^_/, '');
    // The date prefix STAYS. _config.yml gives each collection the permalink
    // /<collection>/:path/, and for a collection — unlike _posts — :path is the
    // filename verbatim. Stripping it produces plausible URLs that 404.
    const slug = parts[parts.length - 1].replace(/\.md$/, '');
    const url = '/' + [domain, ...parts.slice(1, -1), slug].join('/') + '/';

    const text = body
      .replace(/```[\s\S]*?```/g, ' ')          // code blocks are not prose
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')  // keep link text, drop the href
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
  return docs;
}

// ── Tokenising ────────────────────────────────────────────────────────────

// A stopword list is the difference between a map of your ideas and a map of
// how often you write "the". Kept short on purpose: TF-IDF and BM25 both
// already suppress anything that appears everywhere, so this only has to catch
// words that are frequent AND unevenly distributed.
export const STOP = new Set(('a about above after again against all am an and any are as at be because '
  + 'been before being below between both but by can cannot could did do does doing down during each few '
  + 'for from further had has have having he her here hers herself him himself his how i if in into '
  + 'is it its itself me more most my myself no nor not of off on once only or other ought our ours '
  + 'ourselves out over own same she should so some such than that the their theirs them themselves '
  + 'then there these they this those through to too under until up very was we were what when where '
  + 'which while who whom why with would you your yours yourself yourselves').split(' '));

export function tokens(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

// ── Term-document statistics ──────────────────────────────────────────────
// One pass, everything downstream reads from it. `minDf` drops terms that
// appear in a single document: they cannot say anything about which documents
// are alike, and there are thousands of them.

export function termStats(docs, minDf = 2) {
  const tf = docs.map((d) => {
    const counts = new Map();
    tokens(d.text).forEach((w) => counts.set(w, (counts.get(w) || 0) + 1));
    return counts;
  });

  const df = new Map();
  tf.forEach((counts) => counts.forEach((_, w) => df.set(w, (df.get(w) || 0) + 1)));

  const vocab = [...df.keys()].filter((w) => df.get(w) >= minDf).sort();
  const index = new Map(vocab.map((w, i) => [w, i]));

  return { tf, df, vocab, index, lengths: tf.map((c) => [...c.values()].reduce((a, b) => a + b, 0)) };
}

// TF-IDF with sublinear term frequency and L2 normalisation. Raw counts let one
// long piece dominate every axis; 1 + log(count) is the standard fix and it
// matters a lot at twelve documents. Normalising means cosine is a dot product
// and a long piece is not automatically far from the origin.
export function tfidfMatrix(docs, stats) {
  const N = docs.length;
  return stats.tf.map((counts) => {
    const v = new Float64Array(stats.vocab.length);
    counts.forEach((val, w) => {
      const i = stats.index.get(w);
      if (i !== undefined) v[i] = (1 + Math.log(val)) * Math.log(N / stats.df.get(w));
    });
    let norm = 0;
    for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < v.length; i++) v[i] /= norm;
    return v;
  });
}

// ── Eigendecomposition ────────────────────────────────────────────────────
//
// Both scripts factorise a term-document matrix, and both do it through the
// DOC-DOC Gram matrix rather than the covariance of the terms. The covariance
// would be vocab × vocab, hundreds square; the Gram matrix is twelve square and
// its eigenvectors give the same scores. That equivalence is why this runs
// instantly on a corpus with a bigger vocabulary than it has documents.

export function gramMatrix(vectors) {
  const n = vectors.length;
  const g = [];
  for (let i = 0; i < n; i++) {
    g.push(new Float64Array(n));
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let k = 0; k < vectors[i].length; k++) s += vectors[i][k] * vectors[j][k];
      g[i][j] = s;
    }
  }
  return g;
}

// Power iteration with deflation. A handful of components from a 12×12 matrix
// does not justify a QR algorithm, and this is ten lines with no library.
export function topEigen(M, size, count) {
  const A = M.map((row) => Float64Array.from(row));
  const out = [];
  for (let c = 0; c < count; c++) {
    // Deterministic start vector. A random one converges just as well and would
    // make every published number different on every run.
    let v = Float64Array.from({ length: size }, (_, i) => Math.cos(i * (c + 1) + 1));
    let lambda = 0;
    for (let iter = 0; iter < 500; iter++) {
      const w = new Float64Array(size);
      for (let i = 0; i < size; i++) {
        let s = 0;
        for (let j = 0; j < size; j++) s += A[i][j] * v[j];
        w[i] = s;
      }
      const norm = Math.hypot(...w) || 1;
      for (let i = 0; i < size; i++) w[i] /= norm;
      lambda = norm;
      v = w;
    }
    out.push({ vector: v, value: lambda });
    // Deflate, so the next iteration finds the next component rather than the
    // same one again.
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) A[i][j] -= lambda * v[i] * v[j];
    }
  }
  return out;
}

export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
