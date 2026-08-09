// The embedding atlas — a point cloud you can turn.
//
// Much smaller than it looks, because it has almost nothing to work out. The
// positions were decided offline by .tools/embed.mjs and Liquid has already put
// them on the nodes as data-x / data-y / data-z; there is no simulation here,
// no layout and no fetch. All this does is rotate a set of fixed points and
// divide by depth.
//
//   screen = centre + (world.xy * focal) / (focal + world.z)
//
// That one line is the entire third dimension. Everything else — size, opacity,
// stacking order — is derived from the same `scale` it produces, because a flat
// screen made of DOM elements has no other way to say "further away".
//
// WHY THE POINTS ARE ANCHORS. Each is a link to the piece it represents, so the
// cloud is navigable by keyboard and readable by a screen reader without any of
// this running. The visually-hidden title inside each one is its accessible
// name; the projection only ever writes position and paint.

(function () {
  'use strict';

  var stage = document.querySelector('[data-atlas]');
  if (!stage) return;

  var svg = stage.querySelector('[data-atlas-axes]');
  var hint = stage.querySelector('[data-atlas-hint]');
  var readout = document.querySelector('[data-atlas-readout]');
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');

  var points = Array.prototype.slice.call(
    stage.querySelectorAll('[data-point]')).map(function (el) {
      return {
        el: el,
        url: el.getAttribute('data-point'),
        title: el.getAttribute('data-title'),
        domain: el.getAttribute('data-domain'),
        words: el.getAttribute('data-words'),
        // Coordinates are normalised to roughly -1…1 by the offline script, so
        // nothing here needs to know anything about the source vectors.
        x: parseFloat(el.getAttribute('data-x')) || 0,
        y: parseFloat(el.getAttribute('data-y')) || 0,
        z: parseFloat(el.getAttribute('data-z')) || 0
      };
    });

  if (!points.length) return;

  // ── Axes ──────────────────────────────────────────────────────────────────
  // Three faint lines through the origin, one per principal component. They
  // are not decoration: without them a rotating cloud gives the eye no frame,
  // and there is no way to tell a spin from the points drifting. They also make
  // the projection legible — PC1 is the direction the corpus varies most in.

  var NS = 'http://www.w3.org/2000/svg';
  var AXES = [
    { v: [1, 0, 0], name: 'PC1' },
    { v: [0, 1, 0], name: 'PC2' },
    { v: [0, 0, 1], name: 'PC3' }
  ];

  AXES.forEach(function (axis) {
    axis.line = document.createElementNS(NS, 'line');
    axis.line.setAttribute('class', 'atlas-axis');
    svg.appendChild(axis.line);
    axis.text = document.createElementNS(NS, 'text');
    axis.text.setAttribute('class', 'atlas-axis-label');
    axis.text.textContent = axis.name;
    svg.appendChild(axis.text);
  });

  // ── Camera ────────────────────────────────────────────────────────────────

  var W = 0, H = 0;
  var yaw = 0.6, pitch = -0.3;
  var spin = 0.0025;

  function project(p, cx, cy, focal, cosY, sinY, cosP, sinP, radius) {
    var x = p.x * radius, y = p.y * radius, z = p.z * radius;
    var x1 = x * cosY - z * sinY;
    var z1 = x * sinY + z * cosY;
    var y1 = y * cosP - z1 * sinP;
    var z2 = y * sinP + z1 * cosP;
    // Clamped so a point swinging behind the camera cannot divide by something
    // near zero and fling itself off the panel.
    var scale = focal / Math.max(focal + z2, focal * 0.25);
    return { sx: cx + x1 * scale, sy: cy + y1 * scale, scale: scale };
  }

  function paint() {
    var cx = W / 2, cy = H / 2;

    // The cloud's radius is SOLVED, not chosen, and the difference is not
    // pedantry — a fraction picked by eye put two points outside the stage at
    // 375px, and only at some angles, because the worst case depends on where
    // the rotation happens to be. Off the short side for the same reason: a
    // radius sized to a wide panel swings out of frame every quarter turn.
    //
    // A point at radius r, nearest to the camera, projects to an offset of
    // r · f/(f − r) from centre. That must stay inside the half-box, so with
    // M the half-box minus a margin:
    //
    //   r · f/(f − r) = M   ⟹   r = M·f / (f + M)
    //
    // Focal length is the free parameter left: shorter is more dramatic
    // perspective but forces a smaller cloud, and 1.6× the short side is about
    // where the depth still reads without the near points ballooning.
    var m = Math.min(W, H);
    var focal = m * 1.6;
    var limit = m / 2 - 12;
    var radius = (limit * focal) / (focal + limit);
    var cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    var cosP = Math.cos(pitch), sinP = Math.sin(pitch);

    points.forEach(function (p) {
      var q = project(p, cx, cy, focal, cosY, sinY, cosP, sinP, radius);
      // Base size then depth. 13px near, about 6px far — enough separation to
      // read as depth, not so much that a far point disappears.
      var size = 13 * q.scale;
      p.el.style.width = size.toFixed(1) + 'px';
      p.el.style.height = size.toFixed(1) + 'px';
      p.el.style.left = q.sx.toFixed(1) + 'px';
      p.el.style.top = q.sy.toFixed(1) + 'px';
      p.el.style.opacity = Math.max(0.3, Math.min(1, (q.scale - 0.5) * 1.7)).toFixed(2);
      // DOM has no depth buffer. Stacking order is the only occlusion there is.
      p.el.style.zIndex = String(Math.round(q.scale * 100));
    });

    AXES.forEach(function (axis) {
      var a = project({ x: -axis.v[0], y: -axis.v[1], z: -axis.v[2] },
        cx, cy, focal, cosY, sinY, cosP, sinP, radius * 1.25);
      var b = project({ x: axis.v[0], y: axis.v[1], z: axis.v[2] },
        cx, cy, focal, cosY, sinY, cosP, sinP, radius * 1.25);
      axis.line.setAttribute('x1', a.sx.toFixed(1));
      axis.line.setAttribute('y1', a.sy.toFixed(1));
      axis.line.setAttribute('x2', b.sx.toFixed(1));
      axis.line.setAttribute('y2', b.sy.toFixed(1));
      axis.text.setAttribute('x', (b.sx + 6).toFixed(1));
      axis.text.setAttribute('y', (b.sy - 4).toFixed(1));
      axis.text.setAttribute('opacity', Math.max(0.15, (b.scale - 0.5)).toFixed(2));
    });
  }

  function measure() {
    var box = stage.getBoundingClientRect();
    W = Math.round(box.width);
    H = Math.round(box.height);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    paint();
  }

  // ── Readout ───────────────────────────────────────────────────────────────

  var kicker = readout && readout.querySelector('[data-atlas-kicker]');
  var title = readout && readout.querySelector('[data-atlas-title]');
  var body = readout && readout.querySelector('[data-atlas-body]');
  var nearBox = readout && readout.querySelector('[data-atlas-near]');

  var rest = readout && {
    kicker: kicker.textContent,
    title: title.textContent,
    body: body.textContent
  };

  function show(p) {
    if (!readout) return;

    if (!p) {
      kicker.textContent = rest.kicker;
      title.textContent = rest.title;
      body.textContent = rest.body;
      nearBox.hidden = true;
      nearBox.innerHTML = '';
      points.forEach(function (o) { o.el.classList.remove('is-dim', 'is-lit'); });
      return;
    }

    kicker.textContent = p.domain.replace(/-/g, ' ') + ' · ' + p.words + ' words';
    title.textContent = p.title;
    body.textContent = 'Closest in the full vector space:';

    // The neighbour list already exists in the table below, rendered by Liquid
    // with the real scores and real links. Cloning it is cheaper than
    // re-rendering it and, more to the point, means there is only one place the
    // numbers come from.
    var row = document.querySelector('[data-row="' + p.url + '"] .atlas-row-near');
    nearBox.innerHTML = row ? row.innerHTML : '';
    nearBox.hidden = !row;

    // Light the three neighbours in the cloud as well as listing them. Reading
    // "these three are closest" and seeing where they actually are is the
    // moment the projection either convinces or does not.
    var near = {};
    if (row) {
      Array.prototype.forEach.call(row.querySelectorAll('a[href]'), function (a) {
        near[a.getAttribute('href').replace(/^.*?(\/[^/].*)$/, '$1')] = true;
      });
    }
    points.forEach(function (o) {
      // The `!!` is load-bearing. `near[o.url]` is `undefined` for a point that
      // is not a neighbour, and classList.toggle treats an undefined second
      // argument as "no force given" — so it FLIPS the class instead of
      // removing it, and every unrelated point ends up lit and dimmed at once.
      // It looks almost right on screen, which is how it survived a
      // screenshot; the count is what gave it away.
      var on = !!(o === p || near[o.url]);
      o.el.classList.toggle('is-lit', on);
      o.el.classList.toggle('is-dim', !on);
    });
  }

  points.forEach(function (p) {
    p.el.addEventListener('pointerenter', function () { show(p); });
    p.el.addEventListener('pointerleave', function () { show(null); });
    p.el.addEventListener('focus', function () { show(p); });
    p.el.addEventListener('blur', function () { show(null); });
  });

  // ── Drag ──────────────────────────────────────────────────────────────────

  var dragging = false, lastX = 0, lastY = 0, moved = 0;

  stage.addEventListener('pointerdown', function (event) {
    dragging = true;
    moved = 0;
    lastX = event.clientX;
    lastY = event.clientY;
    stage.setPointerCapture(event.pointerId);
    stage.classList.add('is-dragging');
    if (hint) hint.textContent = 'Release to resume';
  });

  stage.addEventListener('pointermove', function (event) {
    if (!dragging) return;
    var dx = event.clientX - lastX;
    var dy = event.clientY - lastY;
    moved += Math.abs(dx) + Math.abs(dy);
    yaw += dx * 0.008;
    // Past vertical the cloud turns inside out and horizontal drags reverse,
    // which reads as a bug rather than as a rotation.
    pitch = Math.max(-1.4, Math.min(1.4, pitch + dy * 0.008));
    lastX = event.clientX;
    lastY = event.clientY;
    paint();
  });

  function endDrag(event) {
    if (!dragging) return;
    dragging = false;
    if (event && event.pointerId !== undefined) {
      try { stage.releasePointerCapture(event.pointerId); } catch (e) {}
    }
    stage.classList.remove('is-dragging');
    if (hint) hint.textContent = 'Drag to spin';
  }

  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  // A point is a link, and a drag that ends on one would otherwise navigate.
  // Ten pixels of travel is the difference between a click and a spin.
  stage.addEventListener('click', function (event) {
    if (moved > 10) {
      event.preventDefault();
      moved = 0;
    }
  }, true);

  // ── Run ───────────────────────────────────────────────────────────────────

  measure();

  if (!REDUCED.matches) {
    var frame = 0;
    var play = function () {
      if (!dragging) { yaw += spin; paint(); }
      frame = requestAnimationFrame(play);
    };
    var stop = function () { if (frame) cancelAnimationFrame(frame); frame = 0; };

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries[0].isIntersecting ? (frame || play()) : stop();
      }, { threshold: 0.01 }).observe(stage);
    } else {
      play();
    }

    document.addEventListener('visibilitychange', function () {
      document.hidden ? stop() : (frame || play());
    });
  }

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(measure, 150);
  });
})();
