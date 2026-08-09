// Behaviour for the post layout (screen 1c).
//
// Four small jobs, each independent — a failure in one must not take the
// others down, so each is its own function and each checks for its own
// elements. Loaded only by _layouts/post.html, deferred.
//
//   1. reading progress bar
//   2. contents scroll-spy
//   3. the rail's <details> open on desktop, closed on a phone
//   4. language labels on code blocks, and "Cite this"
//
// Everything the ToC needs is already in the HTML: the list is built by Liquid
// at build time, so this file only ever adds a class to an existing entry.

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Reading progress ─────────────────────────────────────────────────────
  function readingProgress() {
    var fill = document.querySelector('[data-reading-progress]');
    // Under reduced motion the bar is display:none in CSS, so there is nothing
    // to drive and no reason to hold a scroll listener.
    if (!fill || reduced) return;

    var ticking = false;

    function update() {
      ticking = false;
      var doc = document.documentElement;
      var scrollable = doc.scrollHeight - window.innerHeight;
      // A post shorter than the viewport has nothing to track; showing a bar
      // stuck at 0% would be worse than showing a full one.
      var ratio = scrollable > 0 ? window.pageYOffset / scrollable : 1;
      fill.style.width = Math.max(0, Math.min(1, ratio)) * 100 + '%';
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  // ── Contents scroll-spy ──────────────────────────────────────────────────
  function scrollSpy() {
    var links = Array.prototype.slice.call(
      document.querySelectorAll('.post-toc-link'));
    if (!links.length) return;

    var headings = links
      .map(function (link) {
        return document.getElementById(decodeURIComponent(link.hash.slice(1)));
      })
      .filter(Boolean);
    if (!headings.length) return;

    var current = null;

    function offset() {
      var bar = document.querySelector('.masthead');
      return (bar ? bar.getBoundingClientRect().height : 0) + 20;
    }

    // IntersectionObserver is used as the trigger, not as the answer: it fires
    // when a heading crosses the line, and the active entry is then worked out
    // from geometry. Reading it straight off `entry.isIntersecting` gets this
    // wrong whenever two headings are on screen at once, or none are.
    function activate() {
      var line = offset();
      var found = headings[0];

      for (var i = 0; i < headings.length; i++) {
        if (headings[i].getBoundingClientRect().top <= line + 1) {
          found = headings[i];
        } else {
          break;
        }
      }

      // Once the page is scrolled to the bottom the last heading may still be
      // below the line and never activate, so the end of the document counts
      // as being in the last section.
      var atEnd = window.innerHeight + window.pageYOffset >=
        document.documentElement.scrollHeight - 2;
      if (atEnd) found = headings[headings.length - 1];

      if (found === current) return;
      current = found;

      links.forEach(function (link) {
        var item = link.closest('.post-toc-item');
        if (!item) return;
        item.classList.toggle(
          'is-current',
          decodeURIComponent(link.hash.slice(1)) === found.id);
      });
    }

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(activate, {
        rootMargin: '0px 0px -55% 0px',
        threshold: 0
      });
      headings.forEach(function (h) { observer.observe(h); });
    }

    // The observer does not fire while scrolling *within* one long section, and
    // it does not fire at all on a browser without it, so a throttled scroll
    // listener backs it up.
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        ticking = false;
        activate();
      });
    }, { passive: true });

    activate();
  }

  // ── Rail disclosure ──────────────────────────────────────────────────────
  // The markup ships with `open` so that without JS the contents are visible at
  // every width. That is the right default to fail to, but on a phone it means
  // the reader scrolls past the whole list to reach the article, so it is
  // closed here — and re-opened if the window grows past the breakpoint.
  function railDisclosure() {
    var rail = document.querySelector('[data-post-rail]');
    if (!rail) return;

    var wide = window.matchMedia('(min-width: 900px)');

    function sync(event) {
      rail.open = event.matches;
    }

    sync(wide);
    // Safari before 14 has only the deprecated listener.
    if (wide.addEventListener) {
      wide.addEventListener('change', sync);
    } else if (wide.addListener) {
      wide.addListener(sync);
    }
  }

  // ── Code block labels ────────────────────────────────────────────────────
  // The language is only knowable from the wrapper's class name, which CSS
  // cannot read into `content`, so the label is inserted here.
  function codeLabels() {
    var blocks = document.querySelectorAll(
      '.article-body div[class*="language-"]');

    Array.prototype.forEach.call(blocks, function (block) {
      var match = /language-([\w+#-]+)/.exec(block.className);
      if (!match || match[1] === 'plaintext') return;

      var label = document.createElement('span');
      label.className = 'code-label';
      label.setAttribute('aria-hidden', 'true');
      label.textContent = match[1];
      block.insertBefore(label, block.firstChild);
    });
  }

  // ── Table wrappers ───────────────────────────────────────────────────────
  // kramdown emits a bare <table> with nothing to scroll inside. Wrapping it
  // lets the table fill the measure and still scroll when it is wider; see the
  // `> table` fallback in _article.scss for what happens without this.
  function wrapTables() {
    var tables = document.querySelectorAll('.article-body > table');

    Array.prototype.forEach.call(tables, function (table) {
      var wrap = document.createElement('div');
      wrap.className = 'article-table';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });
  }

  // ── Cite this ────────────────────────────────────────────────────────────
  function cite() {
    var button = document.querySelector('[data-cite]');
    if (!button) return;

    var label = button.querySelector('[data-cite-label]');
    var original = label ? label.textContent : '';
    var timer = null;

    function say(text) {
      if (!label) return;
      label.textContent = text;
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        label.textContent = original;
      }, 2000);
    }

    button.addEventListener('click', function () {
      var citation = button.getAttribute('data-citation') || '';

      // The clipboard API needs a secure context; on plain http it rejects,
      // and the reader deserves to know rather than watching nothing happen.
      if (!navigator.clipboard) {
        say('Copy failed');
        return;
      }

      navigator.clipboard.writeText(citation).then(
        function () { say('Copied'); },
        function () { say('Copy failed'); });
    });
  }

  readingProgress();
  scrollSpy();
  railDisclosure();
  codeLabels();
  wrapTables();
  cite();
})();
