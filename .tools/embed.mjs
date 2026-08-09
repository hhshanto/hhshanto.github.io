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

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, readCorpus, termStats, tfidfMatrix, gramMatrix, topEigen, cosine }
  from './lib/corpus.mjs';

const OUT = join(ROOT, '_data/atlas.json');
const useAzure = process.argv.includes('--azure');

// The markdown reader, the stopword list, the tokeniser, the TF-IDF weighting
// and the eigensolver all live in ./lib/corpus.mjs, shared with retrieval.mjs
// and tokenizer.mjs. Two copies of a stopword list is two stopword lists that
// drift, and the point of putting these instruments on one site is that they
// are looking at one corpus one way.
const docs = await readCorpus();
console.log(`corpus: ${docs.length} pieces, ${docs.reduce((n, d) => n + d.words, 0)} words`);

// minDf 2: a term appearing in exactly one document cannot say anything about
// which documents are ALIKE, and there are thousands of them. That is the
// opposite of the call retrieval.mjs makes, where a df-1 term is the most
// discriminative thing there is for finding that one document.
const stats = termStats(docs, 2);

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

const vectors = useAzure ? await azure(docs) : tfidfMatrix(docs, stats);
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

const gram = gramMatrix(centred);

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

console.log('wrote _data/atlas.json');
