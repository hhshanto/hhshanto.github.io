// Client-side filtering for the archive (screen 1e).
//
// Every row is already in the HTML — Jekyll renders the whole archive at build
// time — so this only ever toggles `hidden`. Nothing is fetched, nothing is
// rendered, and with scripting off the page is still the complete archive,
// which is the reason for doing it this way rather than paginating.
//
// Rows carry their own searchable text in data-search, lowercased at build
// time. Reading it back off the DOM would mean re-deriving on every keystroke
// what Liquid already knew.

(function () {
  'use strict';

  var input = document.querySelector('[data-archive-input]');
  var rows = Array.prototype.slice.call(document.querySelectorAll('[data-row]'));
  if (!rows.length) return;

  var groups = Array.prototype.slice.call(
    document.querySelectorAll('[data-year-group]'));
  var chips = Array.prototype.slice.call(document.querySelectorAll('[data-chip]'));
  var empty = document.querySelector('[data-archive-empty]');
  var status = document.querySelector('[data-archive-status]');

  var query = '';
  var domain = '';

  // Matches what Liquid renders at rest, so a count does not change shape the
  // first time someone types.
  function plural(n) {
    return n + (n === 1 ? ' piece' : ' pieces');
  }

  function apply() {
    var shown = 0;

    rows.forEach(function (row) {
      var matchesDomain = !domain || row.getAttribute('data-domain') === domain;
      var matchesQuery = !query ||
        row.getAttribute('data-search').indexOf(query) !== -1;
      var show = matchesDomain && matchesQuery;

      row.hidden = !show;
      if (show) shown++;
    });

    // A year with nothing left in it hides its heading and rule as well, or the
    // page becomes a column of empty years.
    groups.forEach(function (group) {
      var visible = group.querySelectorAll('[data-row]:not([hidden])').length;
      group.hidden = visible === 0;

      var count = group.querySelector('[data-year-count]');
      if (count) count.textContent = plural(visible);
    });

    if (empty) empty.hidden = shown !== 0;
    if (status) status.textContent = plural(shown);
  }

  if (input) {
    input.addEventListener('input', function () {
      query = input.value.trim().toLowerCase();
      apply();
    });

    // Esc clears the field rather than only clearing the browser's own search
    // affordance, which leaves the list filtered behind an empty-looking box.
    input.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      input.value = '';
      query = '';
      apply();
    });
  }

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      domain = chip.getAttribute('data-chip');

      chips.forEach(function (other) {
        var on = other === chip;
        other.classList.toggle('is-on', on);
        other.classList.toggle('n-tag-outline', !on);
        other.setAttribute('aria-pressed', on ? 'true' : 'false');
      });

      apply();
    });
  });

  // The year counts are rendered by Liquid and are correct at rest, so there is
  // nothing to do until something is actually filtered.
})();
