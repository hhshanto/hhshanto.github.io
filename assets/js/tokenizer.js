// The tokenizer playground.
//
// Byte-pair encoding, applied to whatever you type, in the browser. The whole
// encoder is the `encode` function below and it is about twenty lines, because
// BPE genuinely is that small: repeatedly join the adjacent pair that the
// training run merged earliest, until no pair in the word was ever merged.
//
// The merge table was learned from this site's own writing by
// .tools/tokenizer.mjs, which is the point — the vocabulary has a single token
// for "Bangladesh" and none at all for "photosynthesis", so the reader can
// predict the behaviour instead of watching a black box.

(function () {
  'use strict';

  var root = document.querySelector('[data-tokenizer]');
  if (!root) return;

  var input = root.querySelector('[data-tok-input]');
  var out = root.querySelector('[data-tok-out]');
  var stats = root.querySelector('[data-tok-stats]');
  var samples = Array.prototype.slice.call(root.querySelectorAll('[data-sample]'));
  var inert = root.querySelector('[data-tok-inert]');

  var model = null;
  var rank = null;   // "a b" -> the step at which training merged that pair
  var ids = null;    // token string -> its index in the vocabulary

  function load() {
    var base = (document.currentScript && document.currentScript.src) || '';
    var url = base.replace(/assets\/js\/tokenizer\.js.*$/, 'assets/data/tokenizer.json');
    return fetch(url || '/assets/data/tokenizer.json')
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(function (json) {
        model = json;
        rank = new Map(json.merges.map(function (m, i) { return [m[0] + ' ' + m[1], i]; }));
        ids = new Map(json.vocab.map(function (t, i) { return [t, i]; }));
        return json;
      });
  }

  // ── Pre-tokenisation ──────────────────────────────────────────────────────
  // Must match .tools/tokenizer.mjs exactly. A different split here would apply
  // merges across boundaries the training never saw, and the symptom is
  // plausible-looking tokens that no model was ever trained on.
  function preTokenise(text) {
    return text.match(/ ?[A-Za-z]+| ?[0-9]+|[^\sA-Za-z0-9]|\s+/g) || [];
  }

  // ── Encode ────────────────────────────────────────────────────────────────
  // The greedy loop. At each step find the pair with the LOWEST rank — the one
  // training merged earliest, meaning the most frequent in the corpus — and
  // join it. Order matters: applying merges left-to-right instead would build
  // different tokens for the same word.
  function encode(word) {
    var sym = Array.from(word);
    for (;;) {
      var bestRank = Infinity, at = -1;
      for (var i = 0; i < sym.length - 1; i++) {
        var r = rank.get(sym[i] + ' ' + sym[i + 1]);
        if (r !== undefined && r < bestRank) { bestRank = r; at = i; }
      }
      if (at < 0) return sym;
      sym = sym.slice(0, at).concat(sym[at] + sym[at + 1], sym.slice(at + 2));
    }
  }

  function tokenise(text) {
    var tokens = [];
    preTokenise(text).forEach(function (raw) {
      if (/^\s+$/.test(raw)) {
        // Runs of whitespace other than a single leading space are their own
        // tokens. Newlines especially: they are not free, and a model paying by
        // the token pays for every blank line in your prompt.
        if (raw !== ' ') tokens.push({ text: raw, ws: true });
        return;
      }
      var word = raw.charAt(0) === ' ' ? model.mark + raw.slice(1) : raw;
      encode(word).forEach(function (t) { tokens.push({ text: t }); });
    });
    return tokens;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function run() {
    if (!model) return;
    var text = input.value;
    var tokens = tokenise(text);

    out.innerHTML = '';
    tokens.forEach(function (tok, i) {
      var chip = document.createElement('span');
      // Alternating tint rather than a border on each: at fifty tokens a grid
      // of outlined boxes reads as a table, and the thing being shown is where
      // one token ENDS and the next begins.
      chip.className = 'tok' + (i % 2 ? ' is-alt' : '');

      var id = ids.get(tok.text);
      if (tok.ws) {
        chip.classList.add('is-space');
        chip.textContent = tok.text === '\n' ? '\\n' : '␣';
      } else {
        // The marker is a real character in the vocabulary, so it is shown
        // rather than hidden: " the" and "the" being different tokens is one of
        // the genuinely surprising things about tokenisation.
        chip.textContent = tok.text;
      }

      if (id === undefined) {
        // A character the training corpus never contained. Real tokenizers fall
        // back to raw bytes here so nothing is unencodable; this one has no byte
        // fallback, and saying so is more useful than pretending.
        chip.classList.add('is-unknown');
        chip.title = 'not in this vocabulary';
      } else {
        chip.title = 'id ' + id;
      }

      out.appendChild(chip);
    });

    if (stats) {
      var chars = text.length;
      var n = tokens.length;
      stats.innerHTML = '';
      [
        [n, n === 1 ? 'token' : 'tokens'],
        [chars, 'characters'],
        [n ? (chars / n).toFixed(2) : '0', 'chars / token'],
      ].forEach(function (pair) {
        var s = document.createElement('span');
        s.className = 'tok-stat';
        s.innerHTML = '<b class="tnum">' + pair[0] + '</b> ' + pair[1];
        stats.appendChild(s);
      });
    }
  }

  var debounce = 0;
  input.addEventListener('input', function () {
    clearTimeout(debounce);
    debounce = setTimeout(run, 80);
  });

  samples.forEach(function (button) {
    button.addEventListener('click', function () {
      input.value = button.getAttribute('data-sample');
      run();
      input.focus();
    });
  });

  load().then(function () {
    input.disabled = false;
    input.placeholder = 'Type anything…';
    if (inert) inert.hidden = true;
    run();
  }).catch(function (err) {
    if (inert) {
      inert.hidden = false;
      inert.textContent = 'Could not load the merge table (' + err.message + ').';
    }
  });
})();
