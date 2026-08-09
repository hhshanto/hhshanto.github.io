// A transformer forward pass, in the browser, with nothing hidden.
//
// The model is real: 2 layers, 4 heads, 128 dimensions, ~500k parameters,
// trained by .tools/train.py on the twelve posts on this site and shipped as
// 489KB of int8 weights. Every step below is the same step a frontier model
// takes — embed, pre-norm, causal self-attention, GELU MLP, residual, tied
// output head. The only thing missing is scale, which is exactly what the page
// is trying to make visible.
//
// NO LIBRARY, and none needed. At 64 tokens by 128 dimensions the whole forward
// pass is a few million multiply-accumulates: under a millisecond in plain JS,
// on any device, with no WebGPU and no fallback path to maintain. The reason
// real inference needs a framework is the size of the matrices, not the
// complexity of the arithmetic.
//
// The pass RECORDS as it goes. A normal implementation throws away every
// intermediate; this one keeps the residual stream after each stage and the
// attention probabilities per head, because those are the only things worth
// drawing. That is the whole difference between running a model and showing one.

(function () {
  'use strict';

  var root = document.querySelector('[data-model]');
  if (!root) return;

  var input = root.querySelector('[data-model-input]');
  var tokRow = root.querySelector('[data-model-tokens]');
  var attnBox = root.querySelector('[data-model-attn]');
  var attnPicker = root.querySelector('[data-model-heads]');
  var lensBox = root.querySelector('[data-model-lens]');
  var stage = root.querySelector('[data-model-stage]');
  var svg = root.querySelector('[data-model-paths]');
  var hint = root.querySelector('[data-model-hint]');
  var status = root.querySelector('[data-model-status]');
  var inert = root.querySelector('[data-model-inert]');
  var genBtn = root.querySelector('[data-model-generate]');
  var tempInput = root.querySelector('[data-model-temp]');

  var cfg = null;   // the exported config
  var W = {};       // dequantised weights, by name
  var bpe = null;
  var pass = null;  // the last recorded forward pass
  var focus = -1;   // which token the attention view is about
  var head = 0;     // which (layer, head) pair the attention view shows
  var layer = 0;

  // ── Loading ───────────────────────────────────────────────────────────────
  // Two files: shapes and scales as JSON, the numbers themselves as a flat
  // int8 blob. Putting half a million weights in JSON would quadruple the
  // transfer for no benefit — a decimal digit costs a byte and a weight costs
  // one byte total this way.

  function dequantise(meta, bytes) {
    var out = {};
    meta.tensors.forEach(function (t) {
      var n = t.shape.reduce(function (a, b) { return a * b; }, 1);
      var q = new Int8Array(bytes, t.offset, n);
      var f = new Float32Array(n);
      // Symmetric per-tensor quantisation: one scale, no zero point. The same
      // idea that fits a 70B model on a laptop, at a size where you can check
      // it by hand.
      for (var i = 0; i < n; i++) f[i] = q[i] * t.scale;
      out[t.name] = { data: f, shape: t.shape };
    });
    return out;
  }

  // ── Kernels ───────────────────────────────────────────────────────────────
  // Written out rather than pulled from a library, because at this size the
  // library IS the complexity. Row-major throughout; `at` is one contiguous
  // Float32Array per tensor.

  // y = x · Wᵀ, where W is [out, in] — the layout PyTorch's nn.Linear uses, so
  // the exported weights need no transposing on the way out.
  function matmul(x, w, T, din, dout) {
    var y = new Float32Array(T * dout);
    for (var t = 0; t < T; t++) {
      for (var o = 0; o < dout; o++) {
        var s = 0;
        var xr = t * din, wr = o * din;
        for (var i = 0; i < din; i++) s += x[xr + i] * w[wr + i];
        y[t * dout + o] = s;
      }
    }
    return y;
  }

  function layerNorm(x, g, b, T, d) {
    var y = new Float32Array(T * d);
    for (var t = 0; t < T; t++) {
      var off = t * d, mean = 0;
      for (var i = 0; i < d; i++) mean += x[off + i];
      mean /= d;
      var v = 0;
      for (i = 0; i < d; i++) { var c = x[off + i] - mean; v += c * c; }
      // The same epsilon PyTorch's LayerNorm defaults to. A different one gives
      // subtly different numbers from the training run, which is the kind of
      // mismatch that shows up as a model that is slightly, inexplicably worse.
      var inv = 1 / Math.sqrt(v / d + 1e-5);
      for (i = 0; i < d; i++) y[off + i] = (x[off + i] - mean) * inv * g[i] + b[i];
    }
    return y;
  }

  function gelu(x) {
    // The tanh approximation, which is what PyTorch's F.gelu uses by default
    // and therefore what the weights were trained against.
    for (var i = 0; i < x.length; i++) {
      var v = x[i];
      x[i] = 0.5 * v * (1 + Math.tanh(0.7978845608 * (v + 0.044715 * v * v * v)));
    }
    return x;
  }

  function softmaxRow(a, from, n) {
    var max = -Infinity, i;
    for (i = 0; i < n; i++) if (a[from + i] > max) max = a[from + i];
    var sum = 0;
    // Subtract the max before exponentiating. Skipping it works fine until a
    // logit reaches ~700 and every probability becomes NaN at once.
    for (i = 0; i < n; i++) { a[from + i] = Math.exp(a[from + i] - max); sum += a[from + i]; }
    for (i = 0; i < n; i++) a[from + i] /= sum;
  }

  // ── The pass ──────────────────────────────────────────────────────────────

  function forward(ids) {
    var d = cfg.dModel, H = cfg.nHead, dh = d / H;
    var T = Math.min(ids.length, cfg.block);
    ids = ids.slice(ids.length - T);

    // Embedding: the token's row of the vocabulary matrix plus the row for its
    // POSITION. Adding them looks like a hack and is the standard trick — the
    // residual stream is a workspace every later component reads and writes,
    // and position is just another thing written into it at step zero.
    var x = new Float32Array(T * d);
    for (var t = 0; t < T; t++) {
      for (var i = 0; i < d; i++) {
        x[t * d + i] = W.tok.data[ids[t] * d + i] + W.pos.data[t * d + i];
      }
    }

    var rec = { ids: ids, T: T, stages: [], attn: [] };
    rec.stages.push({ name: 'embed', h: x.slice() });

    for (var L = 0; L < cfg.nLayer; L++) {
      var p = 'b' + L + '.';

      // ── Attention ──────────────────────────────────────────────────────
      var xn = layerNorm(x, W[p + 'ln1.g'].data, W[p + 'ln1.b'].data, T, d);
      var qkv = matmul(xn, W[p + 'attn'].data, T, d, 3 * d);

      var heads = [];
      var attnOut = new Float32Array(T * d);

      for (var h = 0; h < H; h++) {
        var scores = new Float32Array(T * T);
        for (t = 0; t < T; t++) {
          for (var s = 0; s <= t; s++) {
            var dot = 0;
            for (i = 0; i < dh; i++) {
              dot += qkv[t * 3 * d + h * dh + i] * qkv[s * 3 * d + d + h * dh + i];
            }
            scores[t * T + s] = dot / Math.sqrt(dh);
          }
          // Causal mask. Everything at or beyond the current position is set to
          // -inf BEFORE the softmax, which is the whole of "the model cannot
          // see the future": it is one triangle of one matrix.
          for (s = t + 1; s < T; s++) scores[t * T + s] = -Infinity;
          softmaxRow(scores, t * T, T);
        }

        for (t = 0; t < T; t++) {
          for (i = 0; i < dh; i++) {
            var acc = 0;
            for (s = 0; s <= t; s++) {
              acc += scores[t * T + s] * qkv[s * 3 * d + 2 * d + h * dh + i];
            }
            attnOut[t * d + h * dh + i] = acc;
          }
        }
        heads.push(scores);
      }

      rec.attn.push(heads);
      var proj = matmul(attnOut, W[p + 'proj'].data, T, d, d);
      for (i = 0; i < x.length; i++) x[i] += proj[i];
      rec.stages.push({ name: 'L' + L + ' attn', h: x.slice() });

      // ── MLP ────────────────────────────────────────────────────────────
      var xn2 = layerNorm(x, W[p + 'ln2.g'].data, W[p + 'ln2.b'].data, T, d);
      var ff = gelu(matmul(xn2, W[p + 'fc'].data, T, d, cfg.dFF));
      var back = matmul(ff, W[p + 'out'].data, T, cfg.dFF, d);
      for (i = 0; i < x.length; i++) x[i] += back[i];
      rec.stages.push({ name: 'L' + L + ' mlp', h: x.slice() });
    }

    rec.final = layerNorm(x, W['lnf.g'].data, W['lnf.b'].data, T, d);
    return rec;
  }

  // The logit lens: decode ANY intermediate residual through the output head,
  // as though the model had stopped there. It is not an approximation bolted on
  // for the visualisation — the head is tied to the embedding matrix, so this is
  // literally asking "which token does this vector most resemble", which is the
  // same question the final layer answers.
  function lens(hidden, t, k) {
    var d = cfg.dModel, V = cfg.vocab;
    var norm = layerNorm(hidden, W['lnf.g'].data, W['lnf.b'].data,
      hidden.length / d, d);
    var best = [];
    for (var v = 0; v < V; v++) {
      var s = 0;
      for (var i = 0; i < d; i++) s += norm[t * d + i] * W.tok.data[v * d + i];
      if (best.length < k || s > best[best.length - 1].score) {
        best.push({ id: v, score: s });
        best.sort(function (a, b) { return b.score - a.score; });
        if (best.length > k) best.pop();
      }
    }
    // Softmax over the top-k only. Over the full vocabulary the numbers would
    // be more correct and every one of them would round to zero on screen;
    // what the page is showing is the SHAPE of the model's preference.
    var max = best[0].score, sum = 0;
    best.forEach(function (b) { b.p = Math.exp(b.score - max); sum += b.p; });
    best.forEach(function (b) { b.p /= sum; });
    return best;
  }

  function sample(temp) {
    var d = cfg.dModel, V = cfg.vocab, t = pass.T - 1;
    var logits = new Float32Array(V);
    for (var v = 0; v < V; v++) {
      var s = 0;
      for (var i = 0; i < d; i++) s += pass.final[t * d + i] * W.tok.data[v * d + i];
      logits[v] = s / Math.max(temp, 0.05);
    }
    softmaxRow(logits, 0, V);
    var r = Math.random(), acc = 0;
    for (v = 0; v < V; v++) { acc += logits[v]; if (r <= acc) return v; }
    return V - 1;
  }

  // ── Views ─────────────────────────────────────────────────────────────────

  function renderTokens() {
    tokRow.innerHTML = '';
    pass.ids.forEach(function (id, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tok model-token' + (i % 2 ? ' is-alt' : '') +
        (i === focus ? ' is-focus' : '');
      b.textContent = bpe.model.vocab[id];
      b.setAttribute('data-i', i);
      b.title = 'id ' + id + ' · position ' + i;
      b.addEventListener('click', function () {
        focus = i;
        renderTokens();
        renderAttention();
        renderPaths();
      });
      tokRow.appendChild(b);
    });
  }

  function renderAttention() {
    attnBox.innerHTML = '';
    var t = focus < 0 ? pass.T - 1 : focus;
    var scores = pass.attn[layer][head];

    // One row per source token, showing how much of the focused token's
    // attention went to it. A bar chart rather than the usual heatmap grid: at
    // this size the grid is mostly empty triangle, and the question a reader
    // actually has is "what is THIS token looking at".
    for (var s = 0; s <= t; s++) {
      var w = scores[t * pass.T + s];
      var row = document.createElement('div');
      row.className = 'model-attn-row';

      var label = document.createElement('span');
      label.className = 'tok model-attn-tok';
      label.textContent = bpe.model.vocab[pass.ids[s]];

      var track = document.createElement('span');
      track.className = 'model-attn-track';
      var fill = document.createElement('span');
      fill.className = 'model-attn-fill';
      fill.style.width = (w * 100).toFixed(1) + '%';
      track.appendChild(fill);

      var num = document.createElement('span');
      num.className = 'model-attn-num tnum';
      num.textContent = w.toFixed(3);

      row.appendChild(label);
      row.appendChild(track);
      row.appendChild(num);
      attnBox.appendChild(row);
    }
  }

  function renderLens() {
    lensBox.innerHTML = '';
    var t = pass.T - 1;
    pass.stages.forEach(function (stage) {
      var col = document.createElement('div');
      col.className = 'model-lens-col';

      var head = document.createElement('p');
      head.className = 'model-lens-head t-label';
      head.textContent = stage.name;
      col.appendChild(head);

      lens(stage.h, t, 4).forEach(function (r) {
        var row = document.createElement('div');
        row.className = 'model-lens-row';
        var tok = document.createElement('span');
        tok.className = 'tok';
        tok.textContent = bpe.model.vocab[r.id];
        var bar = document.createElement('span');
        bar.className = 'model-lens-bar';
        bar.style.setProperty('--fill', (r.p * 100).toFixed(1) + '%');
        row.appendChild(tok);
        row.appendChild(bar);
        col.appendChild(row);
      });

      lensBox.appendChild(col);
    });
  }

  // ── The 3D view ───────────────────────────────────────────────────────────
  //
  // The residual stream is the one thing in a transformer that genuinely wants
  // three dimensions. Each token enters as a vector and every layer ADDS to it;
  // its history is a path, not a point. Projected onto a fixed basis — computed
  // offline over the whole corpus, so the axes mean the same thing for every
  // input — that path is something you can actually follow.
  //
  // Attention deliberately is NOT drawn here. It is a relation between two
  // tokens and reads far better as the bars above; putting it in the scene
  // would add a third axis carrying nothing and cost the clarity of both.

  var yaw = 0.6, pitch = -0.25, dragging = false, lastX = 0, lastY = 0;
  var NS = 'http://www.w3.org/2000/svg';

  function project(vec, off, cx, cy, radius, focal) {
    var basis = cfg.basis, centre = cfg.centre;
    var p = [0, 0, 0];
    for (var a = 0; a < 3; a++) {
      var s = 0;
      for (var i = 0; i < cfg.dModel; i++) s += (vec[off + i] - centre[i]) * basis[a][i];
      p[a] = s;
    }
    var k = radius / (cfg.extent || 1);
    var x = p[0] * k, y = p[1] * k, z = p[2] * k;
    var cY = Math.cos(yaw), sY = Math.sin(yaw), cP = Math.cos(pitch), sP = Math.sin(pitch);
    var x1 = x * cY - z * sY, z1 = x * sY + z * cY;
    var y1 = y * cP - z1 * sP, z2 = y * sP + z1 * cP;
    var scale = focal / Math.max(focal + z2, focal * 0.25);
    return { x: cx + x1 * scale, y: cy + y1 * scale, s: scale };
  }

  function renderPaths() {
    if (!pass) return;
    var box = stage.getBoundingClientRect();
    var w = Math.round(box.width), h = Math.round(box.height);
    if (!w || !h) return;
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.innerHTML = '';

    var m = Math.min(w, h);
    var focal = m * 1.6;
    var limit = m / 2 - 14;
    var radius = (limit * focal) / (focal + limit);

    for (var t = 0; t < pass.T; t++) {
      var pts = pass.stages.map(function (st) {
        return project(st.h, t * cfg.dModel, w / 2, h / 2, radius, focal);
      });

      var path = document.createElementNS(NS, 'polyline');
      path.setAttribute('class', 'model-path' + (t === focus ? ' is-focus' : ''));
      path.setAttribute('points', pts.map(function (p) {
        return p.x.toFixed(1) + ',' + p.y.toFixed(1);
      }).join(' '));
      svg.appendChild(path);

      // A dot at every stage, growing along the path, so the direction of
      // travel is readable without an arrowhead.
      pts.forEach(function (p, i) {
        var c = document.createElementNS(NS, 'circle');
        c.setAttribute('class', 'model-node' + (t === focus ? ' is-focus' : ''));
        c.setAttribute('cx', p.x.toFixed(1));
        c.setAttribute('cy', p.y.toFixed(1));
        c.setAttribute('r', ((2 + i * 0.9) * p.s).toFixed(1));
        svg.appendChild(c);
      });

      if (t === focus) {
        var label = document.createElementNS(NS, 'text');
        label.setAttribute('class', 'model-path-label');
        label.setAttribute('x', (pts[pts.length - 1].x + 7).toFixed(1));
        label.setAttribute('y', (pts[pts.length - 1].y - 5).toFixed(1));
        label.textContent = bpe.model.vocab[pass.ids[t]];
        svg.appendChild(label);
      }
    }
  }

  stage.addEventListener('pointerdown', function (e) {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    stage.setPointerCapture(e.pointerId);
    stage.classList.add('is-dragging');
  });
  stage.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    yaw += (e.clientX - lastX) * 0.008;
    pitch = Math.max(-1.4, Math.min(1.4, pitch + (e.clientY - lastY) * 0.008));
    lastX = e.clientX; lastY = e.clientY;
    renderPaths();
  });
  ['pointerup', 'pointercancel'].forEach(function (ev) {
    stage.addEventListener(ev, function (e) {
      if (!dragging) return;
      dragging = false;
      try { stage.releasePointerCapture(e.pointerId); } catch (err) {}
      stage.classList.remove('is-dragging');
    });
  });

  // ── Drive ─────────────────────────────────────────────────────────────────

  function run() {
    var tokens = bpe.tokenise(input.value).filter(function (t) {
      return t.id !== undefined;
    });
    if (!tokens.length) {
      if (status) status.textContent = 'nothing this vocabulary can read';
      return;
    }
    var t0 = performance.now();
    pass = forward(tokens.map(function (t) { return t.id; }));
    var ms = performance.now() - t0;

    if (focus < 0 || focus >= pass.T) focus = pass.T - 1;
    renderTokens();
    renderAttention();
    renderLens();
    renderPaths();

    if (status) {
      status.textContent = pass.T + ' tokens · forward pass ' + ms.toFixed(1) + 'ms';
    }
  }

  function buildHeadPicker() {
    attnPicker.innerHTML = '';
    for (var L = 0; L < cfg.nLayer; L++) {
      for (var h = 0; h < cfg.nHead; h++) {
        (function (L, h) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'n-tag model-head' +
            (L === layer && h === head ? ' is-on n-tag-accent' : ' n-tag-outline');
          b.textContent = 'L' + L + '·H' + h;
          b.addEventListener('click', function () {
            layer = L; head = h;
            buildHeadPicker();
            renderAttention();
          });
          attnPicker.appendChild(b);
        })(L, h);
      }
    }
  }

  var debounce = 0;
  input.addEventListener('input', function () {
    clearTimeout(debounce);
    focus = -1;
    debounce = setTimeout(run, 150);
  });

  if (genBtn) {
    genBtn.addEventListener('click', function () {
      var temp = tempInput ? Number(tempInput.value) : 0.8;
      var next = sample(temp);
      // Append the sampled token's text, then re-run the whole pass on it. Not
      // a KV cache — at 64 tokens the cache would be an optimisation nobody can
      // perceive, and re-running keeps every recorded intermediate consistent
      // with what is on screen.
      input.value += bpe.model.vocab[next].replace(bpe.model.mark, ' ');
      focus = -1;
      run();
    });
  }

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderPaths, 150);
  });

  Promise.all([
    window.NoemaBPE.load(),
    fetch(window.NoemaBPE.url('model.json')).then(function (r) {
      if (!r.ok) throw new Error('model.json ' + r.status);
      return r.json();
    }),
    fetch(window.NoemaBPE.url('model.bin')).then(function (r) {
      if (!r.ok) throw new Error('model.bin ' + r.status);
      return r.arrayBuffer();
    }),
  ]).then(function (parts) {
    bpe = parts[0];
    var meta = parts[1];
    cfg = meta.config;
    cfg.basis = meta.basis;
    cfg.centre = meta.centre;
    W = dequantise(meta, parts[2]);

    // One scale for the 3D view, measured once from the corpus rather than
    // recomputed per input — the same reason the basis is fixed. Without it the
    // scene would resize itself around whatever was typed and a trajectory
    // could not be compared with the one before it.
    cfg.extent = meta.extent || 6;

    input.disabled = false;
    if (genBtn) genBtn.disabled = false;
    if (inert) inert.hidden = true;
    if (hint) hint.textContent = 'Drag to spin';
    buildHeadPicker();
    run();
  }).catch(function (err) {
    if (inert) {
      inert.hidden = false;
      inert.textContent = 'Could not load the model (' + err.message + ').';
    }
  });

  // No prefers-reduced-motion branch, and that is deliberate rather than an
  // omission: nothing on this page animates on its own. The scene moves only
  // while it is being dragged, which is motion the reader is causing. Every
  // other instrument on the site has an idle loop to suppress; this one does
  // not, so there is nothing to switch off.
})();
