// Build the retrieval index — dev-only.
//
//   node .tools/retrieval.mjs
//
// Writes assets/data/retrieval.json, which /retrieval/ fetches on first use.
// It holds an inverted index for BM25 and a latent-semantic space for the
// second retriever, so BOTH SIDES RUN LIVE IN THE BROWSER on whatever the
// reader types. Nothing is precomputed per query and no service is called.
//
// WHY assets/ AND NOT _data/. The atlas is a few hundred numbers and goes in
// _data/ so Liquid can render it at build time. This is a hundred kilobytes of
// term vectors, and putting it in the page would make every reader download an
// inverted index to read a paragraph. It follows lunr's pattern instead —
// fetched on demand, on the one page that needs it.
//
// WHY LSA AND NOT A NEURAL EMBEDDING. The demonstration only works if the
// second retriever runs on the reader's query, and embedding a query needs the
// model that produced the document vectors — which is a service call, a key,
// and a dependency on a third-party origin this site does not take. Latent
// semantic analysis is the classical answer to exactly the same problem: take
// the term-document matrix, truncate its SVD, and terms that co-occur collapse
// onto shared axes. It genuinely retrieves documents that contain none of the
// query's words. It is weaker than a transformer embedding and the page says
// so, but it is honest, it is real information retrieval, and it runs in
// fifteen lines of arithmetic with no network.

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, readCorpus, tokens, termStats, tfidfMatrix, gramMatrix, topEigen }
  from './lib/corpus.mjs';

const OUT = join(ROOT, 'assets/data/retrieval.json');
const K = 6; // latent dimensions kept

const docs = await readCorpus();
// minDf 1: BM25 wants the rare terms. A word appearing in a single document is
// useless for finding SIMILARITY, which is why the atlas drops it, but it is
// the most discriminative thing there is for finding THAT document.
const stats = termStats(docs, 1);
console.log(`corpus: ${docs.length} pieces, ${stats.vocab.length} terms`);

// ── BM25 ──────────────────────────────────────────────────────────────────
// Shipped as an inverted index — term → the documents containing it and how
// often — because that is the data structure the algorithm is defined over,
// and scoring it in the browser is then a loop over the query's terms rather
// than over the corpus. At twelve documents the difference is nothing; at
// twelve hundred it is the whole reason inverted indexes exist.

const postings = stats.vocab.map((term) => {
  const list = [];
  stats.tf.forEach((counts, d) => {
    const n = counts.get(term);
    if (n) list.push([d, n]);
  });
  return list;
});

// ── LSA ───────────────────────────────────────────────────────────────────
//
// Truncated SVD of the TF-IDF matrix, NOT centred — centring is what makes it
// PCA, which is right for the atlas (where the question is how documents vary
// around their mean) and wrong here (where the question is what a document is
// made of). Same machinery, different preprocessing, genuinely different
// answers.
//
// Factorised through the doc-doc Gram matrix, so U and the singular values come
// out directly. The term loadings are then V = Aᵀ·U / σ, which is the piece
// that matters: it is what lets a query made of TERMS be folded into a space
// built out of DOCUMENTS.

// ONE vocabulary for both retrievers, including terms that appear in a single
// document. The atlas drops those, correctly — a word used once cannot tell you
// which documents resemble each other. Dropping them here was a mistake with a
// very visible symptom: "ballots", "bengali" and "obedience" each occur in one
// piece, so the latent side returned nothing at all for them while BM25
// answered instantly, and the comparison read as "LSA is worse" rather than
// "LSA was not given the word". A df-1 term has a perfectly good loading
// vector; it simply points hard at one document, which is the truth about it.
//
// Sharing the vocabulary also removes the second copy of 2000 strings from the
// shipped file, which pays for most of the extra loadings.
const lsaStats = stats;
const A = tfidfMatrix(docs, lsaStats);
const comps = topEigen(gramMatrix(A), docs.length, K);
const sigma = comps.map((c) => Math.sqrt(c.value));

let trace = 0;
const g = gramMatrix(A);
for (let i = 0; i < docs.length; i++) trace += g[i][i];
const explained = comps.map((c) => Number((c.value / trace).toFixed(4)));

// Term loadings: V[t][c] = Σ_d A[d][t] · U[d][c] / σ_c
const V = lsaStats.vocab.map((_, t) => comps.map((c, ci) => {
  let s = 0;
  for (let d = 0; d < docs.length; d++) s += A[d][t] * c.vector[d];
  // Four decimals, not five. The loadings run to a couple of thousand terms
  // times six dimensions and are most of the shipped file; the fifth digit
  // changes a cosine in the fourth and costs about 20KB.
  return Number((s / (sigma[ci] || 1)).toFixed(4));
}));

// Document coordinates in the same space: U[d][c] · σ_c.
const docLsa = docs.map((_, d) => comps.map((c, ci) =>
  Number((c.vector[d] * sigma[ci]).toFixed(4))));

console.log(`lsa: ${K} dimensions over ${lsaStats.vocab.length} terms, `
  + `${(explained.reduce((a, b) => a + b) * 100).toFixed(1)}% of variance`);

// ── Write ─────────────────────────────────────────────────────────────────
// Parallel arrays rather than an array of objects: the same numbers with every
// key name removed, which is most of the file at this size.

await mkdir(join(ROOT, 'assets/data'), { recursive: true });
await writeFile(OUT, JSON.stringify({
  built: new Date().toISOString().slice(0, 10),
  k: K,
  explained,
  avgLength: Number((stats.lengths.reduce((a, b) => a + b, 0) / docs.length).toFixed(2)),
  docs: docs.map((d, i) => ({
    url: d.url,
    title: d.title,
    domain: d.domain,
    words: d.words,
    length: stats.lengths[i],
    lsa: docLsa[i],
  })),
  // One vocabulary, four parallel arrays indexed by it: document frequency and
  // postings for BM25, inverse document frequency and latent loadings for LSA.
  vocab: stats.vocab,
  df: stats.vocab.map((t) => stats.df.get(t)),
  idf: stats.vocab.map((t) => Number(Math.log(docs.length / stats.df.get(t)).toFixed(4))),
  postings,
  V,
}) + '\n');

const { size } = await import('node:fs').then((fs) => fs.promises.stat(OUT));
console.log(`wrote assets/data/retrieval.json (${(size / 1024).toFixed(0)}KB)`);
