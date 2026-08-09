// Lab demo 1 — a WebGL background, no library.
//
// One fullscreen quad, one fragment shader. That is the whole technique: the
// vertex shader does nothing but pass two triangles through, and every pixel is
// a function of position and time. It is how most good site backgrounds are
// actually built, and it is small enough to read in one sitting, which is the
// only reason it is worth considering next to three.js — three.js is 600KB of
// scene graph, camera and material system for an effect that uses none of it.
//
// THE PALETTE COMES FROM THE TOKENS. A canvas cannot read a CSS custom
// property, so the colours have to be handed to it as numbers, and that makes
// this the one place on the site where colour is defined outside
// _sass/_tokens.scss. The mitigation is to read them back out of the live
// stylesheet at startup and again whenever the theme changes, rather than
// writing three hex values in here — so the tokens stay the single source and
// this file only transports them. Watch this trade if the technique is adopted;
// it is the real cost, not the kilobytes.

(function () {
  'use strict';

  var stage = document.querySelector('[data-shader]');
  if (!stage) return;

  var canvas = stage.querySelector('[data-shader-canvas]');
  var fallback = stage.querySelector('[data-shader-fallback]');

  // `alpha: false` means the canvas has no transparency to composite, which is
  // one less full-screen blend per frame. `antialias: false` because there is
  // no geometry to alias — every edge in the image comes from the shader.
  var gl = canvas.getContext('webgl', { alpha: false, antialias: false }) ||
           canvas.getContext('experimental-webgl', { alpha: false, antialias: false });

  if (!gl) {
    // Old Androids, locked-down enterprise builds and some headless
    // environments return null here. A background that fails to a white
    // rectangle is worse than no background, so the panel keeps its flat ground
    // and says why.
    if (fallback) fallback.hidden = false;
    return;
  }

  var VERT = [
    'attribute vec2 p;',
    'void main() { gl_Position = vec4(p, 0.0, 1.0); }'
  ].join('\n');

  // Value noise, three octaves, advected by time. Deliberately not simplex:
  // simplex is another forty lines for a difference nobody can see through
  // three octaves of blur.
  //
  // The final colour is a two-stop mix between the page ground and the accent,
  // biased dark, plus a soft vignette. Both stops are uniforms, which is what
  // lets the same shader serve both themes.
  var FRAG = [
    'precision mediump float;',
    'uniform vec2  u_res;',
    'uniform float u_time;',
    'uniform vec3  u_bg;',
    'uniform vec3  u_ink;',
    'uniform vec3  u_accent;',

    'float hash(vec2 v) {',
    '  return fract(sin(dot(v, vec2(127.1, 311.7))) * 43758.5453123);',
    '}',

    'float noise(vec2 v) {',
    '  vec2 i = floor(v);',
    '  vec2 f = fract(v);',
    // Smoothstep the cell interpolant, or the value field shows its grid.
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),',
    '             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);',
    '}',

    'float fbm(vec2 v) {',
    '  float s = 0.0;',
    '  float a = 0.5;',
    '  for (int i = 0; i < 4; i++) {',
    '    s += a * noise(v);',
    '    v *= 2.03;',  // not exactly 2.0 — octaves on a power of two line up
    '    a *= 0.5;',   // and the repeat becomes visible as a plaid
    '  }',
    '  return s;',
    '}',

    'void main() {',
    // Aspect-corrected so the field does not stretch with the panel.
    '  vec2 uv = gl_FragCoord.xy / u_res;',
    '  vec2 p = uv * vec2(u_res.x / u_res.y, 1.0);',

    // Domain warp: sample the noise field at coordinates that are themselves
    // noise. This is what turns porridge into something that looks like it is
    // flowing.
    '  float t = u_time * 0.035;',
    '  vec2 q = vec2(fbm(p * 1.6 + t), fbm(p * 1.6 - t + 4.2));',
    '  float f = fbm(p * 2.2 + q * 1.4);',

    // Full mix between the two grounds, which is a far smaller range than it
    // sounds: bg and surface are one step apart by design. The field is meant
    // to be felt rather than seen, and anything stronger stops being a
    // background and starts being an image the text is sitting on.
    '  vec3 col = mix(u_bg, u_ink, smoothstep(0.20, 0.90, f));',
    // The accent rides the crests only, so the gold reads as a highlight rather
    // than as a wash. 0.62 upward is roughly the top fifth of the field.
    '  col = mix(col, u_accent, smoothstep(0.62, 0.95, f) * 0.22);',

    // Vignette, so the panel has a centre. Without it the eye finds no subject.
    '  float d = distance(uv, vec2(0.5));',
    '  col *= 1.0 - smoothstep(0.35, 0.95, d) * 0.35;',

    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      // Worth surfacing: a shader that fails to compile leaves a black canvas
      // and no error anywhere else. GLSL is the part of this technique that
      // does not debug like the rest of the site.
      console.error('lab-shader:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { if (fallback) fallback.hidden = false; return; }

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);

  // Two triangles covering clip space. No matrices, no camera — the quad is
  // already in the coordinates the rasteriser wants.
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  var uRes = gl.getUniformLocation(prog, 'u_res');
  var uTime = gl.getUniformLocation(prog, 'u_time');
  var uBg = gl.getUniformLocation(prog, 'u_bg');
  var uInk = gl.getUniformLocation(prog, 'u_ink');
  var uAccent = gl.getUniformLocation(prog, 'u_accent');

  // ── Palette, read back out of the stylesheet ─────────────────────────────

  // Custom properties resolve to whatever the theme currently declares, so this
  // needs no knowledge of which theme is on — only that the three token names
  // exist. A token renamed in _tokens.scss breaks this loudly rather than
  // silently painting black, because the parse returns nothing to send.
  function token(name) {
    var raw = getComputedStyle(document.documentElement)
      .getPropertyValue(name).trim();
    var m = raw.match(/^#?([0-9a-f]{6})$/i);
    if (m) {
      var n = parseInt(m[1], 16);
      return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
    }
    var rgb = raw.match(/\d+(\.\d+)?/g);
    return rgb ? rgb.slice(0, 3).map(function (v) { return Number(v) / 255; }) : null;
  }

  function palette() {
    var bg = token('--color-bg');
    // --color-surface, NOT a neutral ramp step. The first version reached for
    // --color-neutral-800 wanting "far from the ground", and got a field of
    // bright smoke in dark mode: the neutral ramp inverts with the theme, so
    // 800 is near-black on paper and near-white on ink. Surface is defined as
    // one step off the ground in whichever direction the theme is going, which
    // is what this actually wanted. Same trap the tokens file warns about for
    // text, in a place the warning does not reach.
    var ink = token('--color-surface');
    var accent = token('--color-accent');
    if (!bg || !ink || !accent) return;
    gl.uniform3fv(uBg, bg);
    gl.uniform3fv(uInk, ink);
    gl.uniform3fv(uAccent, accent);
  }

  // The theme is a data-theme attribute on <html>, set by the inline script in
  // the head and toggled by theme.js. Observing the attribute is the only way
  // to hear about it without theme.js knowing this file exists.
  new MutationObserver(function () {
    palette();
    if (!playing) draw(last);
  }).observe(document.documentElement, {
    attributes: true, attributeFilter: ['data-theme']
  });

  // ── Size, draw, and when not to ──────────────────────────────────────────

  function resize() {
    // Cap the device pixel ratio at 2. A 3x phone screen quadruples the
    // fragment count for a blurred noise field nobody can resolve, and it is
    // the single biggest thing separating a background that costs nothing from
    // one that heats the device.
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(canvas.clientWidth * dpr);
    var h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(uRes, w, h);
  }

  var start = performance.now();
  var last = 0;
  var playing = false;
  var frame = 0;

  function draw(t) {
    resize();
    gl.uniform1f(uTime, t);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function loop() {
    last = (performance.now() - start) / 1000;
    draw(last);
    frame = requestAnimationFrame(loop);
  }

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');

  function play() {
    if (playing || REDUCED.matches) return;
    playing = true;
    loop();
  }

  function pause() {
    playing = false;
    if (frame) cancelAnimationFrame(frame);
  }

  palette();
  resize();
  draw(0);

  if (REDUCED.matches) {
    // One frame, held. The field is still there; it just does not move. This is
    // the whole accommodation — a background that animates is a much larger
    // motion commitment than anything else on the site, and the site's stated
    // budget is colour, a 2px lift and a progress bar.
  } else if ('IntersectionObserver' in window) {
    // Never run a shader nobody is looking at. Without this the loop keeps the
    // GPU awake while the reader is four screens further down.
    new IntersectionObserver(function (entries) {
      entries[0].isIntersecting ? play() : pause();
    }, { threshold: 0.01 }).observe(stage);
  } else {
    play();
  }

  // Same argument for a backgrounded tab. Browsers throttle rAF there, but
  // throttled is not stopped, and on a laptop it is the difference between idle
  // and a warm fan.
  document.addEventListener('visibilitychange', function () {
    document.hidden ? pause() : play();
  });

  window.addEventListener('resize', function () {
    resize();
    if (!playing) draw(last);
  });
})();
