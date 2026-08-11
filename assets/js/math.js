/* Typeset the equations on a page that carries `math: true`.
 *
 * Loaded only by those pages (see _layouts/default.html), so the absence of
 * KaTeX here is a bug rather than a normal state worth handling quietly. The
 * guard exists so a failed fetch degrades to visible TeX source instead of a
 * console error and a blank region.
 */
document.addEventListener('DOMContentLoaded', function () {
  if (typeof window.renderMathInElement !== 'function') return;

  /* Scope the scan to the article body. The masthead, nav and footer contain
   * no math, and restricting the walk keeps it away from the ⌘K palette's
   * results, which are injected later and would not be re-scanned anyway. */
  var target = document.querySelector('[data-article-body]') || document.querySelector('main');
  if (!target) return;

  window.renderMathInElement(target, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '\\[', right: '\\]', display: true },
      { left: '$', right: '$', display: false },
      { left: '\\(', right: '\\)', display: false }
    ],

    /* `code` and `pre` are the important entries. A post about shell or about
     * money will have a stray `$` inside a code span, and without this the
     * renderer pairs it with the next one and eats everything between. */
    ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option'],

    /* Render bad TeX as visible red source rather than throwing. One malformed
     * expression should not stop the rest of the page from typesetting. */
    throwOnError: false
  });
});
