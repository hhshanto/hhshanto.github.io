// Two retrievers, side by side, both running on whatever you type.
//
// LEFT is BM25 — the ranking function behind Lucene, Elasticsearch and most
// search boxes you have ever used. It counts words. A document scores if it
// contains the query's terms, weighted by how rare each term is across the
// corpus and damped by how long the document is.
//
// RIGHT is latent semantic analysis. The offline script factorised the
// term-document matrix and kept six dimensions; terms that tend to co-occur
// collapsed onto shared axes. A query is folded into those six numbers and
// compared by cosine. It can rank a document that contains none of the query's
// words, which is the entire point of the demonstration and the thing BM25
// cannot do at any parameter setting.
//
// Neither is precomputed per query. The index in assets/data/retrieval.json is
// the corpus, not the answers, and both scores are worked out here — which is
// also the honest reason the second column is LSA and not a transformer
// embedding: embedding a QUERY needs the model that embedded the documents, and
// that is a service call this site does not make.

(function () {
  'use strict';

  var root = document.querySelector('[data-retrieval]');
  if (!root) return;

  var input = root.querySelector('[data-query]');
  var chips = Array.prototype.slice.call(root.querySelectorAll('[data-example]'));
  var bmList = root.querySelector('[data-results-bm25]');
  var lsaList = root.querySelector('[data-results-lsa]');
  var terms = root.querySelector('[data-terms]');
  var status = root.querySelector('[data-status]');
  var inert = document.querySelector('[data-retrieval-inert]');

  var ix = null;
  var lookup = null;

  if (inert) inert.hidden = true;

  // ── Index ─────────────────────────────────────────────────────────────────
  // Fetched, not inlined. It is well over a hundred kilobytes of term vectors,
  // and Liquid rendering that into the page would make every reader download an
  // inverted index to read the paragraph underneath it. Same reasoning as
  // lunr.min.js and search.json, which the ⌘K palette pulls on first open.

  function load() {
    // The script's own src, so this keeps working if the site is ever served
    // under a baseurl. Copied from search.js, which learned it the hard way.
    var base = (document.currentScript && document.currentScript.src) || '';
    var url = base.replace(/assets\/js\/retrieval\.js.*$/, 'assets/data/retrieval.json');

    return fetch(url || '/assets/data/retrieval.json')
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(function (json) {
        ix = json;
        // Array.indexOf over two thousand terms, once per query word, on every
        // keystroke. A Map is the difference between typing feeling instant and
        // typing feeling laggy, and it costs one pass at startup.
        lookup = new Map(ix.vocab.map(function (t, i) { return [t, i]; }));
        return ix;
      });
  }

  // ── Query ─────────────────────────────────────────────────────────────────
  // Tokenised exactly as the corpus was, in .tools/lib/corpus.mjs. If the two
  // ever diverge the query is looking up words the index does not have, and the
  // symptom is a search that quietly returns nothing for a word plainly on the
  // page.
  var STOP = new Set(('a about above after again against all am an and any are as at be because '
    + 'been before being below between both but by can cannot could did do does doing down during each few '
    + 'for from further had has have having he her here hers herself him himself his how i if in into '
    + 'is it its itself me more most my myself no nor not of off on once only or other ought our ours '
    + 'ourselves out over own same she should so some such than that the their theirs them themselves '
    + 'then there these they this those through to too under until up very was we were what when where '
    + 'which while who whom why with would you your yours yourself yourselves').split(' '));

  function tokenise(text) {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, ' ')
      .split(/\s+/)
      .filter(function (w) { return w.length > 2 && !STOP.has(w); });
  }

  // ── BM25 ──────────────────────────────────────────────────────────────────
  // k1 controls how fast repeated occurrences stop helping; b how hard a long
  // document is penalised. 1.4 and 0.75 are the usual defaults and there is no
  // reason to tune them on twelve documents.
  var K1 = 1.4, B = 0.75;

  function bm25(words) {
    var N = ix.docs.length;
    var scores = new Array(N).fill(0);

    words.forEach(function (term) {
      var t = lookup.get(term);
      if (t === undefined) return;
      var df = ix.df[t];
      var idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      ix.postings[t].forEach(function (p) {
        var d = p[0], tf = p[1];
        var norm = 1 - B + B * (ix.docs[d].length / ix.avgLength);
        scores[d] += idf * (tf * (K1 + 1)) / (tf + K1 * norm);
      });
    });

    return scores;
  }

  // ── LSA ───────────────────────────────────────────────────────────────────
  // The fold-in: a query is the idf-weighted sum of its terms' loading vectors,
  // which lands it in the same six-dimensional space the documents live in.
  // Then cosine, because only the direction means anything — the length of the
  // vector is an artefact of how many words were typed.

  function cosine(a, b) {
    var dot = 0, na = 0, nb = 0;
    for (var i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
  }

  function lsa(words) {
    var q = new Array(ix.k).fill(0);
    words.forEach(function (term) {
      var t = lookup.get(term);
      if (t === undefined) return;
      for (var c = 0; c < ix.k; c++) q[c] += ix.V[t][c] * ix.idf[t];
    });
    var any = q.some(function (v) { return v !== 0; });
    return ix.docs.map(function (d) { return any ? cosine(q, d.lsa) : 0; });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function render(list, scores, max) {
    var ranked = scores
      .map(function (s, i) { return { score: s, doc: ix.docs[i] }; })
      // Cosine can be negative — a query pointing away from a document in the
      // latent space. That is not "slightly relevant", it is the opposite, so
      // it is cut rather than shown at the bottom.
      .filter(function (r) { return r.score > 0.001; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, 5);

    list.innerHTML = '';

    if (!ranked.length) {
      var none = document.createElement('li');
      none.className = 'retrieval-none t-body-sm t-muted';
      none.textContent = 'Nothing.';
      list.appendChild(none);
      return;
    }

    ranked.forEach(function (r, i) {
      var li = document.createElement('li');
      li.className = 'retrieval-hit is-' + r.doc.domain;

      var bar = document.createElement('span');
      bar.className = 'retrieval-fill';
      // Relative to the top hit, not to an absolute scale: BM25 is unbounded
      // and cosine tops out at 1, so a shared scale would make one column look
      // permanently weaker for reasons that have nothing to do with ranking.
      bar.style.setProperty('--fill', ((r.score / max) * 100).toFixed(1) + '%');

      var rank = document.createElement('span');
      rank.className = 'retrieval-rank tnum';
      rank.textContent = i + 1;

      var link = document.createElement('a');
      link.className = 'retrieval-title ttl';
      link.href = r.doc.url;
      link.textContent = r.doc.title;

      var score = document.createElement('span');
      score.className = 'retrieval-score tnum';
      score.textContent = r.score.toFixed(3);

      li.appendChild(bar);
      li.appendChild(rank);
      li.appendChild(link);
      li.appendChild(score);
      list.appendChild(li);
    });
  }

  function run() {
    if (!ix) return;
    var words = tokenise(input.value);

    // Which words actually made it into the vocabulary. This is the most useful
    // thing on the page when a query returns nothing: a term the corpus has
    // never seen cannot be matched by either method, and saying so is better
    // than two empty columns.
    if (terms) {
      terms.innerHTML = '';
      if (!words.length) {
        terms.textContent = 'No query terms yet.';
      } else {
        words.forEach(function (w) {
          var known = lookup.has(w);
          var chip = document.createElement('span');
          chip.className = 'retrieval-term' + (known ? '' : ' is-unknown');
          chip.textContent = w;
          if (known) {
            chip.title = 'in ' + ix.df[lookup.get(w)] + ' of ' + ix.docs.length + ' pieces';
          } else {
            chip.title = 'not in the corpus';
          }
          terms.appendChild(chip);
        });
      }
    }

    var b = bm25(words);
    var l = lsa(words);
    render(bmList, b, Math.max.apply(null, b) || 1);
    render(lsaList, l, Math.max.apply(null, l) || 1);

    if (status) {
      var bn = b.filter(function (s) { return s > 0.001; }).length;
      var ln = l.filter(function (s) { return s > 0.001; }).length;
      status.textContent = bn + ' by words, ' + ln + ' by meaning';
    }
  }

  // ── Wire up ───────────────────────────────────────────────────────────────

  var debounce = 0;
  input.addEventListener('input', function () {
    clearTimeout(debounce);
    // Scoring is fast enough to run per keystroke, but re-rendering ten rows
    // while someone is still typing a word makes the page flicker at them.
    debounce = setTimeout(run, 120);
  });

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      input.value = chip.getAttribute('data-example');
      run();
      input.focus();
    });
  });

  load().then(function () {
    input.disabled = false;
    // A default query, so the page opens showing the comparison rather than two
    // empty columns and an invitation to imagine one.
    if (!input.value) input.value = input.getAttribute('data-default') || '';
    run();
  }).catch(function (err) {
    if (status) status.textContent = 'Could not load the index (' + err.message + ').';
    if (inert) inert.hidden = false;
  });
})();
