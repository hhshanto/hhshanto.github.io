// Lab demo 3 — the constellation with a third axis.
//
// The same force model as assets/js/constellation.js with a z added to every
// vector, then projected back to the screen by hand. That is the whole of "3D
// without a library": a perspective divide is one line, and once you have it,
// depth is just another number to sort by.
//
//   screen = centre + (world.xy * focal) / (focal + world.z)
//
// Nothing else here is new. Repulsion, springs and the cooling schedule are
// unchanged from the 2D map — going up a dimension does not change the physics,
// only the length of the vectors — so the interesting question this demo
// answers is not whether it runs, it is whether depth reads at all on a flat
// screen. Two cues carry it, and they have to do all the work: near nodes are
// larger and opaque, far ones are smaller and faded. There is no lighting, no
// shadow and no occlusion, because none of those survive being made of DOM
// elements.
//
// Deliberately NOT wired to the real map. It reads data-node3d, not data-node,
// so constellation.js ignores this container and the two cannot fight over the
// same elements while both are on the page.

(function () {
  'use strict';

  var stage = document.querySelector('[data-orbit]');
  if (!stage) return;

  var svg = stage.querySelector('[data-orbit-edges]');
  var readout = stage.querySelector('[data-orbit-readout]');
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');

  var nodes = Array.prototype.slice.call(
    stage.querySelectorAll('[data-node3d]')).map(function (el) {
      return {
        el: el,
        id: el.getAttribute('data-node3d'),
        kind: el.getAttribute('data-kind'),
        parent: el.getAttribute('data-parent'),
        label: el.getAttribute('data-label'),
        r: el.getAttribute('data-kind') === 'root' ? 11
          : el.getAttribute('data-kind') === 'domain' ? 8 : 5.5,
        x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0
      };
    });

  if (nodes.length < 2) return;

  var byId = {};
  nodes.forEach(function (n) { byId[n.id] = n; });

  var edges = [];
  nodes.forEach(function (n) {
    var p = n.parent && byId[n.parent];
    if (p) edges.push({ a: p, b: n });
  });

  var NS = 'http://www.w3.org/2000/svg';
  edges.forEach(function (e) {
    var line = document.createElementNS(NS, 'line');
    line.setAttribute('class', 'lab-orbit-edge');
    svg.appendChild(line);
    e.line = line;
  });

  // ── Layout ────────────────────────────────────────────────────────────────

  var W = 0, H = 0, temp = 0;

  // Seeded on a sphere rather than a circle, using the golden-angle spiral —
  // the standard way to scatter n points evenly over a sphere without random
  // numbers, which keeps this as deterministic as the 2D map. Seeding on a
  // circle instead leaves every node coplanar at z = 0, and the force model has
  // no reason to ever push one off that plane: the demo would run correctly and
  // look exactly like the flat version, which is the failure mode worth
  // naming here.
  function seed() {
    // Sized off the SHORT side so the cloud stays inside a wide panel, but
    // generously: the first pass used 0.34 and gravity then pulled it into a
    // knot in the middle of a mostly empty box. A point cloud has to fill its
    // container or the depth cue has no room to be visible.
    var span = Math.min(W, H) * 0.62;
    var golden = Math.PI * (3 - Math.sqrt(5));

    nodes.forEach(function (n, i) {
      if (n.kind === 'root') { n.x = n.y = n.z = 0; return; }
      var t = (i + 0.5) / nodes.length;
      var phi = Math.acos(1 - 2 * t);
      var theta = golden * i;
      var ring = n.kind === 'domain' ? 0.55 : 1;
      n.x = Math.sin(phi) * Math.cos(theta) * span * ring;
      n.y = Math.sin(phi) * Math.sin(theta) * span * ring;
      n.z = Math.cos(phi) * span * ring;
    });
  }

  function tick() {
    var k = Math.min(W, H) / 5 * 0.78;

    nodes.forEach(function (n) { n.dx = n.dy = n.dz = 0; });

    for (var i = 0; i < nodes.length; i++) {
      for (var j = i + 1; j < nodes.length; j++) {
        var a = nodes[i], b = nodes[j];
        var dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
        var d = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 1);
        if (d > k * 2.5) continue;
        var f = (k * k) / d;
        var ux = dx / d * f, uy = dy / d * f, uz = dz / d * f;
        a.dx += ux; a.dy += uy; a.dz += uz;
        b.dx -= ux; b.dy -= uy; b.dz -= uz;
      }
    }

    edges.forEach(function (e) {
      var dx = e.a.x - e.b.x, dy = e.a.y - e.b.y, dz = e.a.z - e.b.z;
      var d = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 1);
      var f = (d * d) / k;
      var ux = dx / d * f, uy = dy / d * f, uz = dz / d * f;
      e.a.dx -= ux; e.a.dy -= uy; e.a.dz -= uz;
      e.b.dx += ux; e.b.dy += uy; e.b.dz += uz;
    });

    // Gravity to the origin, not to the centre of the panel: in 3D the origin
    // is where the pinned root sits and where the camera looks, so pulling
    // toward it keeps the cloud centred on the axis it spins about.
    nodes.forEach(function (n) {
      var d = Math.max(Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z), 1);
      var f = (d * d) / k * 0.07;
      n.dx -= n.x / d * f;
      n.dy -= n.y / d * f;
      n.dz -= n.z / d * f;
    });

    nodes.forEach(function (n) {
      if (n.kind === 'root') return;
      var d = Math.max(Math.sqrt(n.dx * n.dx + n.dy * n.dy + n.dz * n.dz), 0.01);
      var step = Math.min(d, temp);
      n.x += n.dx / d * step;
      n.y += n.dy / d * step;
      n.z += n.dz / d * step;
    });

    temp *= 0.94;
  }

  // ── Camera ────────────────────────────────────────────────────────────────

  var yaw = 0.6, pitch = -0.25, spin = 0.0035;

  function paint() {
    var cx = W / 2, cy = H / 2;
    // Focal length in the same units as the model. Larger is a longer lens and
    // a flatter picture; at roughly 2.2x the cloud's radius the perspective is
    // obvious without the near nodes ballooning.
    var focal = Math.min(W, H) * 0.9;

    var cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    var cosP = Math.cos(pitch), sinP = Math.sin(pitch);

    nodes.forEach(function (n) {
      // Yaw about the vertical axis, then pitch about the horizontal one.
      var x1 = n.x * cosY - n.z * sinY;
      var z1 = n.x * sinY + n.z * cosY;
      var y1 = n.y * cosP - z1 * sinP;
      var z2 = n.y * sinP + z1 * cosP;

      // The perspective divide. Clamped so a node that swings behind the camera
      // does not divide by zero and fling itself across the panel.
      var scale = focal / Math.max(focal + z2, focal * 0.2);
      n.sx = cx + x1 * scale;
      n.sy = cy + y1 * scale;
      n.scale = scale;

      var size = n.r * 2 * scale;
      n.el.style.width = size.toFixed(1) + 'px';
      n.el.style.height = size.toFixed(1) + 'px';
      n.el.style.left = n.sx.toFixed(1) + 'px';
      n.el.style.top = n.sy.toFixed(1) + 'px';
      // Depth cue two. Size alone is ambiguous — a small dot could be a near
      // small thing — and fading the far ones is what resolves it.
      n.el.style.opacity = Math.max(0.18, Math.min(1, (scale - 0.45) * 1.9)).toFixed(2);
      // Painter's algorithm. DOM has no depth buffer, so the only way a near
      // node covers a far one is to sort them into the stacking order.
      n.el.style.zIndex = String(Math.round(scale * 100));
    });

    edges.forEach(function (e) {
      e.line.setAttribute('x1', e.a.sx.toFixed(1));
      e.line.setAttribute('y1', e.a.sy.toFixed(1));
      e.line.setAttribute('x2', e.b.sx.toFixed(1));
      e.line.setAttribute('y2', e.b.sy.toFixed(1));
      // An edge takes the depth of its nearer end, so a thread coming toward
      // the viewer does not fade to the value of the node it is going to.
      var s = Math.max(e.a.scale, e.b.scale);
      e.line.setAttribute('opacity', Math.max(0.08, (s - 0.5) * 0.8).toFixed(2));
    });
  }

  // ── Drag ──────────────────────────────────────────────────────────────────

  var dragging = false, lastX = 0, lastY = 0;

  stage.addEventListener('pointerdown', function (event) {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    stage.setPointerCapture(event.pointerId);
    stage.classList.add('is-dragging');
    if (readout) readout.textContent = 'Release to resume';
  });

  stage.addEventListener('pointermove', function (event) {
    if (!dragging) return;
    yaw += (event.clientX - lastX) * 0.008;
    // Pitch is clamped to just under a right angle. Past vertical the cloud
    // turns inside out and the spin reverses, which reads as a bug.
    pitch = Math.max(-1.4, Math.min(1.4, pitch + (event.clientY - lastY) * 0.008));
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
    if (readout) readout.textContent = 'Drag to spin';
  }

  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  // ── Run ───────────────────────────────────────────────────────────────────

  function measure() {
    var box = stage.getBoundingClientRect();
    W = Math.round(box.width);
    H = Math.round(box.height);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  }

  function settle() {
    measure();
    if (!W || !H) return;
    seed();
    temp = Math.min(W, H) / 6;
    // The layout is solved up front and only then displayed. In the 2D map the
    // settling is part of the charm; here it competes with the rotation for the
    // reader's attention and reads as instability.
    while (temp > 0.4) tick();
    paint();
  }

  settle();

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
  } else if (readout) {
    // Still draggable — the accommodation is that nothing moves on its own,
    // not that the reader is locked out of the third dimension.
    readout.textContent = 'Drag to spin';
  }

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(settle, 180);
  });
})();
