// Masthead disclosure menu (below the medium breakpoint only).
//
// Replaces mobile-menu.js, which targeted .mobile-menu-toggle / .main-nav ul.
// Behaviour is the same plus two fixes: Escape closes the menu and returns
// focus to the button, and the outside-click handler no longer runs on every
// document click when the menu is already shut.

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var button = document.querySelector('.masthead-disclosure');
    var nav = document.getElementById('masthead-nav');
    if (!button || !nav) return;

    function isOpen() {
      return button.getAttribute('aria-expanded') === 'true';
    }

    function setOpen(open) {
      button.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
      button.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    }

    button.addEventListener('click', function () {
      setOpen(!isOpen());
    });

    document.addEventListener('click', function (event) {
      if (!isOpen()) return;
      if (event.target.closest('.masthead-bar')) return;
      setOpen(false);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape' || !isOpen()) return;
      setOpen(false);
      button.focus();
    });

    // A resize past the breakpoint leaves the menu in whatever state it was
    // in; the desktop layout ignores .is-open, but aria-expanded would still
    // claim the menu is open to a screen reader.
    var wide = window.matchMedia('(min-width: 900px)');
    var onChange = function (event) {
      if (event.matches) setOpen(false);
    };
    if (wide.addEventListener) wide.addEventListener('change', onChange);
    else wide.addListener(onChange);
  });
})();
