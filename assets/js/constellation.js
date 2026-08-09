// The constellation map.
//
// Lays the site's structure out as a force-directed graph: a pinned root, the
// five domains around it, each domain's sub-topic directories around that, and
// the pieces themselves on the outside — plus a weaker thread between any two
// pieces that share a tag.
//
// It reads the graph off the DOM. pages/constellation.html renders every node
// as a real link (or a span, for a sub-topic, which has no page of its own)
// carrying data-parent, data-domain and data-tags, so there is no JSON blob to
// keep in step with the markup. Without this file the same list is a plain
// indented outline of the site, which is why nothing here creates a node.
//
// FRUCHTERMAN–REINGOLD, not a spring/charge integrator. Two reasons: it is
// about twenty lines, and its cooling schedule terminates — the layout settles
// and stops rather than jittering forever behind a tab nobody is looking at.
//
// The layout is DETERMINISTIC. Nodes start on a radial fan seeded by their
// index, never Math.random(), so the map is the same map on every reload. A
// graph that rearranges itself each visit cannot be learned, and the whole
// value of this screen is that you come to recognise the shape of your own
// writing.

(function () {
  'use strict';

  var root = document.querySelector('.constellation');
  var stage = document.querySelector('[data-constellation]');
  if (!stage || !root) return;

  var svg = stage.querySelector('[data-edges]');
  var readout = document.querySelector('[data-readout]');

  // The map is added at width, not switched off below it. A force graph at
  // 375px is a cluster of unlabelled dots that navigate somewhere unannounced
  // when tapped; the outline the markup already is beats that on a phone.
  //
  // This value is $bp-sm from _sass/_tokens.scss. It is the one breakpoint the
  // site keeps in two places — the map's positioning is gated by the `is-live`
  // class rather than a media query, because CSS cannot know whether the
  // simulation has run, and a node absolutely positioned at coordinates nothing
  // has written yet lands in the corner.
  var WIDE = window.matchMedia('(min-width: 700px)');
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ── Read the graph ────────────────────────────────────────────────────────

  var nodes = Array.prototype.slice.call(
    stage.querySelectorAll('[data-node]')).map(function (el, i) {
      var tags = (el.getAttribute('data-tags') || '')
        .split('|').filter(function (t) { return t !== ''; });

      return {
        el: el,
        id: el.getAttribute('data-node'),
        kind: el.getAttribute('data-kind'),
        parent: el.getAttribute('data-parent'),
        tags: tags,
        index: i,
        // Hit-box radii, matched to the sizes in _constellation.scss. Used for
        // repulsion so a big hub pushes harder than a piece, and for keeping
        // nodes inside the stage.
        r: el.getAttribute('data-kind') === 'root' ? 22
          : el.getAttribute('data-kind') === 'domain' ? 17 : 11,
        x: 0, y: 0, dx: 0, dy: 0
      };
    });

  if (nodes.length < 2) return;

  var byId = {};
  nodes.forEach(function (n) { byId[n.id] = n; });

  // Hierarchy edges. One per node that names a parent, which is every node
  // except the root.
  var edges = [];
  nodes.forEach(function (n) {
    var p = n.parent && byId[n.parent];
    if (p) edges.push({ a: p, b: n, kind: 'branch', strength: 1 });
  });

  // Tag edges. The one thing Liquid knew and is not being told: which pairs of
  // pieces share a tag. Emitting the pairs from the template means an O(n²)
  // nested loop rendering a blob of ids; grouping by tag here is four lines and
  // stays correct as the archive grows.
  var byTag = {};
  nodes.forEach(function (n) {
    n.tags.forEach(function (tag) {
      (byTag[tag] || (byTag[tag] = [])).push(n);
    });
  });

  var pairSeen = {};
  Object.keys(byTag).forEach(function (tag) {
    var group = byTag[tag];
    for (var i = 0; i < group.length; i++) {
      for (var j = i + 1; j < group.length; j++) {
        // Two pieces sharing three tags get one thread, not three. The id pair
        // is the key; ids are URLs, so '\n' cannot occur inside one.
        var key = group[i].id + '\n' + group[j].id;
        if (pairSeen[key]) continue;
        pairSeen[key] = true;
        // Deliberately weaker than a branch. A tag should bend the layout —
        // pull two pieces in different domains a little closer — not tear a
        // piece off the sub-topic it is filed under.
        edges.push({ a: group[i], b: group[j], kind: 'tag', strength: 0.3 });
      }
    }
  });

  // Adjacency, for the highlight. Built once from the finished edge list rather
  // than searched on every hover.
  var neighbours = {};
  nodes.forEach(function (n) { neighbours[n.id] = {}; });
  edges.forEach(function (e) {
    neighbours[e.a.id][e.b.id] = true;
    neighbours[e.b.id][e.a.id] = true;
  });

  // ── Edge elements ─────────────────────────────────────────────────────────

  var NS = 'http://www.w3.org/2000/svg';
  edges.forEach(function (e) {
    var line = document.createElementNS(NS, 'line');
    line.setAttribute('class', 'constellation-edge is-' + e.kind);
    svg.appendChild(line);
    e.line = line;
  });

  // ── Layout ────────────────────────────────────────────────────────────────

  var W = 0, H = 0, frame = 0, temp = 0;

  // Deterministic seeding. Domains fan evenly around the root starting from
  // twelve o'clock; everything else starts just outside its parent, offset by
  // its own position among that parent's children so siblings do not begin life
  // stacked on one point — two nodes at identical coordinates have no direction
  // to repel along and stay stuck there.
  function seed() {
    var cx = W / 2, cy = H / 2;
    var span = Math.min(W, H) / 2;
    var kids = {};

    nodes.forEach(function (n) {
      if (n.kind === 'root') { n.x = cx; n.y = cy; return; }
      var p = byId[n.parent];
      var rank = (kids[n.parent] = (kids[n.parent] || 0) + 1) - 1;
      var siblings = 0;
      nodes.forEach(function (o) { if (o.parent === n.parent) siblings++; });

      var base = p && p.kind !== 'root' ? Math.atan2(p.y - cy, p.x - cx) : -Math.PI / 2;
      var spread = p && p.kind === 'root'
        ? (2 * Math.PI * rank) / Math.max(siblings, 1)
        : base + ((rank - (siblings - 1) / 2) * 0.7);
      var angle = p && p.kind === 'root' ? -Math.PI / 2 + spread : spread;
      var ring = n.kind === 'domain' ? 0.42 : n.kind === 'sub' ? 0.7 : 0.92;

      n.x = cx + Math.cos(angle) * span * ring;
      n.y = cy + Math.sin(angle) * span * ring;
    });
  }

  function tick() {
    // k is Fruchterman–Reingold's ideal edge length. Textbook FR takes it as
    // the side of the square each node would get if the stage were divided
    // evenly between them, but the stage here is a wide letterbox and the graph
    // is a shallow tree: that figure gives an edge longer than the box is tall,
    // and every node ends up flattened against the boundary clamp. Capping it
    // against the SHORT side keeps a three-deep branch inside the height.
    var k = Math.min(Math.sqrt((W * H) / nodes.length), Math.min(W, H) / 5) * 0.62;
    var cx = W / 2, cy = H / 2;

    nodes.forEach(function (n) { n.dx = 0; n.dy = 0; });

    for (var i = 0; i < nodes.length; i++) {
      for (var j = i + 1; j < nodes.length; j++) {
        var a = nodes[i], b = nodes[j];
        var dx = a.x - b.x, dy = a.y - b.y;
        // Floored, not guarded: at d = 0 the force is infinite and the pair
        // shoots off the stage together.
        var d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        // Repulsion is local. Unbounded FR repulsion is what pinned the first
        // version to the walls — a node on the rim feels a push from all
        // twenty-seven others and only two or three springs pulling back, so
        // the whole graph inflates until the clamp stops it. Past two and a
        // half ideal lengths two nodes have nothing to say to each other.
        if (d > k * 2.5) continue;
        // Hubs carry a bigger hit box and a permanent label, so they claim more
        // room. Without this the five domain names overlap in the middle.
        var force = ((k * k) / d) * (1 + (a.r + b.r) / 60);
        var ux = (dx / d) * force, uy = (dy / d) * force;
        a.dx += ux; a.dy += uy;
        b.dx -= ux; b.dy -= uy;
      }
    }

    edges.forEach(function (e) {
      var dx = e.a.x - e.b.x, dy = e.a.y - e.b.y;
      var d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      var force = ((d * d) / k) * e.strength;
      var ux = (dx / d) * force, uy = (dy / d) * force;
      e.a.dx -= ux; e.a.dy -= uy;
      e.b.dx += ux; e.b.dy += uy;
    });

    // Gravity: the same law as an edge, as though every node were sprung
    // weakly to the middle of the stage. Written that way rather than as a
    // constant nudge so it scales with k — a stage twice the size wants a
    // graph twice the size, not the same graph pulled twice as hard.
    nodes.forEach(function (n) {
      var dx = cx - n.x, dy = cy - n.y;
      var d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      var force = ((d * d) / k) * 0.09;
      n.dx += (dx / d) * force;
      n.dy += (dy / d) * force;
    });

    nodes.forEach(function (n) {
      // The root is pinned. It is the only fixed point, and it is what makes
      // the result a readable radial tree rather than a drifting blob.
      if (n.kind === 'root') return;

      var d = Math.max(Math.sqrt(n.dx * n.dx + n.dy * n.dy), 0.01);
      var step = Math.min(d, temp);
      n.x += (n.dx / d) * step;
      n.y += (n.dy / d) * step;

      // Inside the stage. A hub reserves more than its own radius sideways
      // because its label is centred underneath and permanently on — a domain
      // name against the left edge reads as "...ciences". A piece only reserves
      // its dot: its title appears to one side and only on demand, and flips to
      // the other side past the two-thirds line (see paint()).
      var pad = n.kind === 'post' ? n.r + 2 : Math.max(n.r + 2, 74);
      n.x = Math.max(pad, Math.min(W - pad, n.x));
      n.y = Math.max(n.r + 2, Math.min(H - n.r - 16, n.y));
    });

    temp *= 0.94;
  }

  function paint() {
    nodes.forEach(function (n) {
      n.el.style.left = n.x.toFixed(1) + 'px';
      n.el.style.top = n.y.toFixed(1) + 'px';
      n.el.classList.toggle('is-flipped', n.x > W * 0.62);
    });

    edges.forEach(function (e) {
      e.line.setAttribute('x1', e.a.x.toFixed(1));
      e.line.setAttribute('y1', e.a.y.toFixed(1));
      e.line.setAttribute('x2', e.b.x.toFixed(1));
      e.line.setAttribute('y2', e.b.y.toFixed(1));
    });
  }

  function run() {
    (function step() {
      // Ten iterations a frame. One per frame would take six seconds to settle;
      // the arithmetic is thirty nodes and costs nothing.
      for (var i = 0; i < 10 && temp > 0.4; i++) tick();
      paint();
      if (temp > 0.4) frame = requestAnimationFrame(step);
    })();
  }

  function layout() {
    var box = stage.getBoundingClientRect();
    if (!box.width || !box.height) return;

    W = Math.round(box.width);
    H = Math.round(box.height);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

    if (frame) cancelAnimationFrame(frame);
    seed();
    temp = Math.min(W, H) / 6;

    if (REDUCED.matches) {
      // No settling animation: run the schedule to completion and paint the
      // answer once. _sass/_reset.scss zeroes the site's other transitions the
      // same way, and a graph crawling into place is exactly the kind of motion
      // that preference is asking not to see.
      while (temp > 0.4) tick();
      paint();
    } else {
      run();
    }
  }

  // ── Readout and highlight ─────────────────────────────────────────────────

  var kicker = readout && readout.querySelector('[data-readout-kicker]');
  var title = readout && readout.querySelector('[data-readout-title]');
  var body = readout && readout.querySelector('[data-readout-body]');
  var tagLine = readout && readout.querySelector('[data-readout-tags]');

  // The resting copy is Liquid's, captured before anything overwrites it, so
  // moving the pointer off the map restores what the page was built with
  // instead of a second copy of the same sentence written out in here.
  var rest = readout && {
    kicker: kicker.textContent,
    title: title.textContent,
    body: body.innerHTML
  };

  function show(n) {
    if (!readout) return;

    if (!n) {
      kicker.textContent = rest.kicker;
      title.textContent = rest.title;
      body.innerHTML = rest.body;
      tagLine.hidden = true;
      nodes.forEach(function (o) { o.el.classList.remove('is-dim', 'is-lit'); });
      edges.forEach(function (e) { e.line.classList.remove('is-dim', 'is-lit'); });
      return;
    }

    kicker.textContent = n.kind === 'post'
      ? n.el.getAttribute('data-domain-name') + ' · ' + n.el.getAttribute('data-date')
      : n.kind === 'root' ? 'The garden' : n.el.getAttribute('data-domain-name');
    title.textContent = n.el.getAttribute('data-label');
    body.textContent = n.el.getAttribute('data-detail') || '';

    if (n.tags.length) {
      tagLine.textContent = n.tags.join(' · ');
      tagLine.hidden = false;
    } else if (n.kind === 'post') {
      tagLine.textContent = 'No tags — nothing links this piece across the map.';
      tagLine.hidden = false;
    } else {
      tagLine.hidden = true;
    }

    var near = neighbours[n.id];
    nodes.forEach(function (o) {
      var related = o === n || near[o.id];
      o.el.classList.toggle('is-lit', !!related);
      o.el.classList.toggle('is-dim', !related);
    });
    edges.forEach(function (e) {
      var on = e.a === n || e.b === n;
      e.line.classList.toggle('is-lit', on);
      e.line.classList.toggle('is-dim', !on);
    });
  }

  nodes.forEach(function (n) {
    n.el.addEventListener('pointerenter', function () { show(n); });
    n.el.addEventListener('pointerleave', function () { show(null); });
    // focus/blur rather than focusin/focusout: these are leaf controls, so
    // there is nothing inside them to bubble from, and the pair keeps the
    // keyboard path identical to the pointer one.
    n.el.addEventListener('focus', function () { show(n); });
    n.el.addEventListener('blur', function () { show(null); });
  });

  // ── Start, and follow the viewport ────────────────────────────────────────

  function activate() {
    if (WIDE.matches) {
      stage.classList.add('is-live');
      root.classList.add('is-live');
      layout();
    } else {
      // Back to the outline. The inline left/top would otherwise survive as
      // absolute coordinates on statically-positioned list items — harmless
      // until the CSS is next touched, and confusing forever.
      if (frame) cancelAnimationFrame(frame);
      stage.classList.remove('is-live');
      root.classList.remove('is-live');
      nodes.forEach(function (n) {
        n.el.style.left = '';
        n.el.style.top = '';
        n.el.classList.remove('is-flipped', 'is-dim', 'is-lit');
      });
    }
  }

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    // Re-running the whole schedule on every resize event would animate the
    // graph continuously while a window is being dragged.
    resizeTimer = setTimeout(activate, 180);
  });

  activate();
})();
