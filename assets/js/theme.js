// Theme toggle.
//
// The theme itself is applied by a tiny inline script in <head> (see
// _layouts/default.html), before the browser paints anything. This file only
// wires up the button, so it is safe to load with `defer`.
//
// Splitting it that way is the whole point: the previous version set
// data-theme inside DOMContentLoaded, which runs after first paint, so a dark
// theme user saw a white page flash on every navigation.

(function () {
  'use strict';

  var STORAGE_KEY = 'theme';

  function label(theme) {
    // The button says what you will get, not what you have.
    return theme === 'dark' ? 'Light' : 'Dark';
  }

  function sync(theme) {
    document.querySelectorAll('[data-theme-label]').forEach(function (el) {
      el.textContent = label(theme);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var current = document.documentElement.getAttribute('data-theme') || 'light';
    sync(current);

    document.querySelectorAll('#themeToggle').forEach(function (button) {
      button.addEventListener('click', function () {
        var next =
          document.documentElement.getAttribute('data-theme') === 'dark'
            ? 'light'
            : 'dark';

        document.documentElement.setAttribute('data-theme', next);
        sync(next);

        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch (e) {
          // Private browsing can throw on write. The theme still applies for
          // this page view; it just will not be remembered.
        }
      });
    });
  });
})();
