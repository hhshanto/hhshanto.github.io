// Lab demo 2 — CSS 3D transforms.
//
// This file is almost nothing on purpose. The entire effect is in
// _sass/_lab.scss: four planes at different Z inside a `perspective` container,
// with `transform-style: preserve-3d` so the browser composites them as real
// geometry rather than flattening them first. That is the argument for the
// technique — the background is made of ordinary elements, so it reads the
// theme tokens directly and there is no palette to transport, no context to
// lose, and nothing to fall back from.
//
// All this adds is the pointer. Rotation could be a CSS animation with no JS at
// all, and the fallback below is exactly that; what JS buys is the parallax
// responding to where the reader's pointer is, which is the thing that actually
// sells depth.

(function () {
  'use strict';

  var stage = document.querySelector('[data-planes]');
  if (!stage) return;

  var scene = stage.querySelector('[data-planes-scene]');
  if (!scene) return;

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');

  // The idle drift is a CSS keyframe animation, and it is the only thing
  // running until a pointer arrives. Under prefers-reduced-motion the
  // stylesheet does not start it, and this file then leaves the scene alone
  // entirely — a still, tilted stack of planes, which is a perfectly good
  // static image.
  if (REDUCED.matches) return;

  // A pointer that leaves the panel should hand control back to the drift
  // rather than freezing the scene wherever it happened to be.
  var frame = 0;
  var targetX = 0, targetY = 0;
  var currentX = 0, currentY = 0;
  var tracking = false;

  function apply() {
    // Eased, not assigned. Writing the pointer position straight onto the
    // transform makes the planes snap; following it at 8% a frame is what makes
    // the stack feel like it has mass.
    currentX += (targetX - currentX) * 0.08;
    currentY += (targetY - currentY) * 0.08;
    scene.style.transform =
      'rotateX(' + currentY.toFixed(2) + 'deg) rotateY(' + currentX.toFixed(2) + 'deg)';

    // Stop when there is nothing left to move. A rAF loop that never exits is
    // the same battery problem as the shader, for an effect that is at rest.
    if (Math.abs(targetX - currentX) > 0.01 || Math.abs(targetY - currentY) > 0.01) {
      frame = requestAnimationFrame(apply);
    } else {
      frame = 0;
      if (!tracking) scene.classList.remove('is-tracking');
    }
  }

  function nudge() {
    if (!frame) frame = requestAnimationFrame(apply);
  }

  stage.addEventListener('pointermove', function (event) {
    var box = stage.getBoundingClientRect();
    // -1 … 1 from the centre of the panel, so the maximum tilt is the same
    // whatever size the box is.
    var nx = (event.clientX - box.left) / box.width * 2 - 1;
    var ny = (event.clientY - box.top) / box.height * 2 - 1;
    // 9 degrees is about the limit before the planes' own edges come into view
    // and the illusion becomes four rectangles.
    targetX = nx * 9;
    targetY = -ny * 9;
    tracking = true;
    scene.classList.add('is-tracking');
    nudge();
  });

  stage.addEventListener('pointerleave', function () {
    targetX = 0;
    targetY = 0;
    tracking = false;
    nudge();
  });
})();
