// The byte-pair encoder, shared.
//
// /tokenizer/ shows it and /model/ feeds it into a transformer, and both used to
// carry their own copy of the same forty lines. That duplication is the one
// CLAUDE.md warns about by name: if a second implementation drifts, a query or a
// prompt is silently split differently from the way the training corpus was, and
// the symptom is a model reading tokens it was never trained on — which looks
// like the model being bad rather than the tokeniser being wrong.
//
// It still cannot import from .tools/lib/corpus.mjs, which is Node and never
// ships, so THREE implementations exist in total: that one, `.tools/train.py`,
// and this. Any change to the pre-tokenisation regex has to land in all three.
//
// A plain global rather than a module, because the site loads scripts directly
// with no bundler and `type="module"` would change the loading semantics of
// every other file for no gain here.

window.NoemaBPE = (function () {
  'use strict';

  // Must match `PRE` in .tools/train.py and `preTokenise` in
  // .tools/tokenizer.mjs. The digit branch is load-bearing: digits are excluded
  // from the punctuation class as well, so dropping it makes every number match
  // nothing and vanish without an error.
  var PRE = / ?[A-Za-z]+| ?[0-9]+|[^\sA-Za-z0-9]|\s+/g;

  function make(model) {
    // Maps, not indexOf. The vocabulary is over a thousand entries and the
    // encoder probes it once per adjacent pair per merge step; linear scans turn
    // typing into something you can feel.
    var rank = new Map();
    model.merges.forEach(function (m, i) { rank.set(m[0] + ' ' + m[1], i); });
    var ids = new Map();
    model.vocab.forEach(function (t, i) { ids.set(t, i); });

    // The greedy loop, and the whole of BPE. At each step join the pair with the
    // LOWEST rank — the one training merged earliest, meaning the most frequent
    // in the corpus. Applying merges left-to-right instead would build different
    // tokens for the same word.
    function encode(word) {
      var sym = Array.from(word);
      for (;;) {
        var best = Infinity, at = -1;
        for (var i = 0; i < sym.length - 1; i++) {
          var r = rank.get(sym[i] + ' ' + sym[i + 1]);
          if (r !== undefined && r < best) { best = r; at = i; }
        }
        if (at < 0) return sym;
        sym = sym.slice(0, at).concat(sym[at] + sym[at + 1], sym.slice(at + 2));
      }
    }

    // Returns objects rather than strings: both callers need the vocabulary id
    // as well as the text, and an id of `undefined` is meaningful — this
    // tokenizer has no byte fallback, so a character the corpus never contained
    // genuinely has no id.
    function tokenise(text) {
      var out = [];
      var parts = text.match(PRE) || [];
      parts.forEach(function (raw) {
        if (/^\s+$/.test(raw)) {
          // A single leading space belongs to the word after it and is handled
          // below; any other whitespace run is its own token. Newlines
          // especially — they are not free, and anything paying by the token
          // pays for every blank line.
          if (raw !== ' ') out.push({ text: raw, id: ids.get(raw), ws: true });
          return;
        }
        var word = raw.charAt(0) === ' ' ? model.mark + raw.slice(1) : raw;
        encode(word).forEach(function (t) {
          out.push({ text: t, id: ids.get(t) });
        });
      });
      return out;
    }

    return { model: model, ids: ids, encode: encode, tokenise: tokenise };
  }

  // Resolves the data file from the script's own src, so this keeps working if
  // the site is ever served under a baseurl. search.js learned that the hard
  // way and every fetch on the site has copied it since.
  function url(name) {
    var self = document.querySelector('script[src*="assets/js/bpe.js"]');
    var base = (self && self.src) || '';
    return base.replace(/assets\/js\/bpe\.js.*$/, 'assets/data/' + name)
      || '/assets/data/' + name;
  }

  function load() {
    return fetch(url('tokenizer.json'))
      .then(function (r) {
        if (!r.ok) throw new Error('tokenizer.json ' + r.status);
        return r.json();
      })
      .then(make);
  }

  return { make: make, load: load, url: url };
})();
