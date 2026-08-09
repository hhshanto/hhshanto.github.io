// The ⌘K search palette (screen 1f).
//
// Lunr and the index are both loaded on first open, never on page load. The
// index carries the full text of every post, so fetching it eagerly would make
// every reader pay for a feature most of them never use.
//
// Keys: ⌘K / Ctrl+K opens, Esc closes, ↑↓ move the selection and wrap, Enter
// opens the selected row, Tab cycles the domain filter. Tab is deliberately
// not a focus move — the panel is a modal dialog with exactly one focusable
// control, so trapping Tab and giving it a job is both the trap and a feature.

(function () {
  'use strict';

  var root = document.querySelector('[data-palette]');
  if (!root) return;

  var input = root.querySelector('[data-palette-input]');
  var list = root.querySelector('[data-palette-results]');
  var scrim = root.querySelector('[data-palette-scrim]');
  var filterLabel = root.querySelector('[data-palette-filter]');
  var triggers = document.querySelectorAll('[data-search-open]');

  // Both URLs are derived from this file's own location rather than written as
  // absolute paths, so they stay correct if the site is ever served under a
  // baseurl. document.currentScript is set for a deferred classic script.
  var here = document.currentScript ? document.currentScript.src : '/assets/js/search.js';
  var base = here.replace(/assets\/js\/search\.js.*$/, '');
  var LUNR_URL = base + 'assets/js/lunr.min.js';
  var INDEX_URL = base + 'search.json';

  var loading = null;
  var index = null;
  var records = [];
  var domains = [];

  var open = false;
  var selected = 0;
  var results = [];
  var domainFilter = '';
  var lastFocus = null;

  // ── Loading ──────────────────────────────────────────────────────────────
  function script(src) {
    return new Promise(function (resolve, reject) {
      var el = document.createElement('script');
      el.src = src;
      el.onload = resolve;
      el.onerror = reject;
      document.head.appendChild(el);
    });
  }

  function load() {
    if (loading) return loading;

    loading = Promise.all([
      window.lunr ? Promise.resolve() : script(LUNR_URL),
      fetch(INDEX_URL).then(function (r) { return r.json(); }),
    ]).then(function (parts) {
      records = parts[1];

      // Distinct domains, in the order the index happens to list them, so the
      // Tab cycle follows the same order as the masthead.
      var seen = {};
      records.forEach(function (r) {
        if (r.kind === 'post' && r.domain && !seen[r.domain]) {
          seen[r.domain] = true;
          domains.push({ key: r.domain, name: r.domainName });
        }
      });

      index = window.lunr(function () {
        this.ref('id');
        // Weighted so a title match beats a passing mention in the body. Lunr's
        // defaults would rank a 2000-word post that says the word once above a
        // post named after it.
        this.field('title', { boost: 10 });
        this.field('tags', { boost: 5 });
        this.field('abstract', { boost: 3 });
        this.field('content');

        records.forEach(function (record) { this.add(record); }, this);
      });
    }).catch(function () {
      // Leaving `loading` resolved but index null means the palette degrades to
      // its empty state rather than throwing on every keystroke.
      index = null;
    });

    return loading;
  }

  // ── Searching ────────────────────────────────────────────────────────────
  function lookup(query) {
    if (!index || !query) return [];

    var hits;
    try {
      // Trailing wildcard so the list narrows while the word is still being
      // typed; without it "stoic" finds nothing until the "ism" lands.
      hits = index.search(query + '*');
      if (!hits.length) hits = index.search(query);
    } catch (e) {
      // Lunr throws on its own query syntax (a bare "~" or ":"), which is
      // ordinary typing, not an error worth surfacing.
      return [];
    }

    var byId = {};
    records.forEach(function (r) { byId[r.id] = r; });

    return hits
      .map(function (hit) { return byId[hit.ref]; })
      .filter(function (r) {
        if (!r) return false;
        if (!domainFilter) return true;
        return r.domain === domainFilter;
      })
      .slice(0, 12);
  }

  // ── Rendering ────────────────────────────────────────────────────────────
  function groupOf(record) {
    return record.kind === 'post' ? 'posts' : 'other';
  }

  function render() {
    list.innerHTML = '';

    if (!input.value.trim()) {
      input.setAttribute('aria-expanded', 'false');
      return;
    }

    if (!results.length) {
      var empty = document.createElement('p');
      empty.className = 'palette-empty';
      empty.textContent = index
        ? 'Nothing matches that.'
        : 'Search is unavailable — the index did not load.';
      list.appendChild(empty);
      input.setAttribute('aria-expanded', 'false');
      return;
    }

    input.setAttribute('aria-expanded', 'true');

    var posts = results.filter(function (r) { return groupOf(r) === 'posts'; });
    var other = results.filter(function (r) { return groupOf(r) !== 'posts'; });

    // Rebuilt in group order, so the selection index and the DOM order agree —
    // otherwise ↓ appears to skip rows.
    results = posts.concat(other);

    if (posts.length) {
      list.appendChild(label('Posts · ' + posts.length));
      posts.forEach(function (r) { list.appendChild(row(r)); });
    }
    if (other.length) {
      list.appendChild(label('Tags & pages'));
      other.forEach(function (r) { list.appendChild(row(r)); });
    }

    mark();
  }

  function label(text) {
    var el = document.createElement('p');
    el.className = 'palette-group-label';
    el.textContent = text;
    return el;
  }

  function row(record) {
    var el = document.createElement('a');
    el.className = 'palette-result';
    el.setAttribute('role', 'option');
    el.setAttribute('aria-selected', 'false');
    el.href = record.url;
    // Not focusable: focus stays in the input and the selection is expressed
    // through aria-activedescendant, which is what a combobox listbox wants.
    el.tabIndex = -1;
    el.id = 'palette-row-' + results.indexOf(record);

    var title = document.createElement('span');
    title.className = 'palette-result-title';
    title.textContent = record.title;

    var meta = document.createElement('span');
    meta.className = 'palette-result-meta';
    meta.textContent = record.date || record.domainName || '';

    el.appendChild(title);
    el.appendChild(meta);

    el.addEventListener('mousemove', function () {
      var i = results.indexOf(record);
      if (i !== selected) {
        selected = i;
        mark();
      }
    });

    return el;
  }

  function mark() {
    var rows = list.querySelectorAll('.palette-result');
    Array.prototype.forEach.call(rows, function (el, i) {
      var on = i === selected;
      el.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) {
        input.setAttribute('aria-activedescendant', el.id);
        el.scrollIntoView({ block: 'nearest' });
      }
    });
    if (!rows.length) input.removeAttribute('aria-activedescendant');
  }

  function search() {
    results = lookup(input.value.trim().toLowerCase());
    selected = 0;
    render();
  }

  // ── Domain filter ────────────────────────────────────────────────────────
  function cycleFilter(back) {
    var keys = [''].concat(domains.map(function (d) { return d.key; }));
    var at = keys.indexOf(domainFilter);
    at = (at + (back ? -1 : 1) + keys.length) % keys.length;
    domainFilter = keys[at];

    if (filterLabel) {
      var found = domains.filter(function (d) { return d.key === domainFilter; })[0];
      filterLabel.textContent = found ? found.name : 'filter by domain';
    }
    search();
  }

  // ── Open and close ───────────────────────────────────────────────────────
  function show() {
    if (open) return;
    open = true;
    lastFocus = document.activeElement;
    root.hidden = false;
    // The page behind must not scroll under the panel.
    document.documentElement.style.overflow = 'hidden';
    input.focus();
    load().then(function () { if (open) search(); });
  }

  function hide() {
    if (!open) return;
    open = false;
    root.hidden = true;
    document.documentElement.style.overflow = '';
    input.value = '';
    results = [];
    list.innerHTML = '';
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    // Focus restore is the half of a modal everyone forgets. Without it, Esc
    // drops a keyboard reader back at the top of the document.
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function move(step) {
    if (!results.length) return;
    selected = (selected + step + results.length) % results.length;
    mark();
  }

  // ── Wiring ───────────────────────────────────────────────────────────────
  Array.prototype.forEach.call(triggers, function (trigger) {
    trigger.addEventListener('click', function (event) {
      event.preventDefault();
      show();
    });
    // Warm the index on hover: by the time the click lands it is usually there.
    trigger.addEventListener('mouseenter', load);
  });

  document.addEventListener('keydown', function (event) {
    var combo = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
    if (combo) {
      event.preventDefault();
      open ? hide() : show();
      return;
    }
    if (!open) return;

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        hide();
        break;
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        break;
      case 'Tab':
        // The trap: focus never leaves the panel, and Tab does the job the
        // handoff gives it instead.
        event.preventDefault();
        cycleFilter(event.shiftKey);
        break;
      case 'Enter':
        if (!results.length) break;
        event.preventDefault();
        window.location.href = results[selected].url;
        break;
      default:
        break;
    }
  });

  // Focus cannot escape by any other route either — a click on the page behind
  // the scrim, or a programmatic focus, both land back in the input.
  document.addEventListener('focusin', function (event) {
    if (!open) return;
    if (root.contains(event.target)) return;
    input.focus();
  });

  if (scrim) scrim.addEventListener('click', hide);
  input.addEventListener('input', search);

  list.addEventListener('click', function (event) {
    var row = event.target.closest('.palette-result');
    if (row) hide();
  });
})();
