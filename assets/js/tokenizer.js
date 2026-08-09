// The tokenizer playground.
//
// Byte-pair encoding, applied to whatever you type. The encoder itself lives in
// assets/js/bpe.js and is shared with /model/, which feeds the same tokens into
// a transformer — this file is only the screen. That split is deliberate: two
// copies of the encoder is two encoders that drift, and a drifted tokeniser
// splits a prompt differently from the way the training corpus was split, which
// looks like the model misbehaving rather than the tokeniser being wrong.

(function () {
  'use strict';

  var root = document.querySelector('[data-tokenizer]');
  if (!root) return;

  var input = root.querySelector('[data-tok-input]');
  var out = root.querySelector('[data-tok-out]');
  var stats = root.querySelector('[data-tok-stats]');
  var samples = Array.prototype.slice.call(root.querySelectorAll('[data-sample]'));
  var inert = root.querySelector('[data-tok-inert]');

  var bpe = null;

  function run() {
    if (!bpe) return;
    var text = input.value;
    var tokens = bpe.tokenise(text);

    out.innerHTML = '';
    tokens.forEach(function (tok, i) {
      var chip = document.createElement('span');
      // Alternating tint rather than a border on each: at fifty tokens a grid
      // of outlined boxes reads as a table, and the thing being shown is where
      // one token ENDS and the next begins.
      chip.className = 'tok' + (i % 2 ? ' is-alt' : '');

      if (tok.ws) {
        chip.classList.add('is-space');
        chip.textContent = tok.text === '\n' ? '\\n' : '␣';
      } else {
        // The leading-space marker is a real character in the vocabulary, so it
        // is shown rather than hidden: " the" and "the" being different tokens
        // is one of the genuinely surprising things about tokenisation.
        chip.textContent = tok.text;
      }

      if (tok.id === undefined) {
        // A character the training corpus never contained. Real tokenizers fall
        // back to raw bytes here so nothing is unencodable; this one has no byte
        // fallback, and saying so is more useful than pretending.
        chip.classList.add('is-unknown');
        chip.title = 'not in this vocabulary';
      } else {
        chip.title = 'id ' + tok.id;
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

  window.NoemaBPE.load().then(function (encoder) {
    bpe = encoder;
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
