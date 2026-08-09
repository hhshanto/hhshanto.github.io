// The compose tool (screen 1g).
//
// Assembles a post file from the front-matter pane and the editor, previews it
// live, and commits it through the GitHub Contents API.
//
// On the token: it is held in localStorage and sent to api.github.com and
// nowhere else. That is the only option a static site has, and it is why the
// page asks for a fine-grained token scoped to this repository with a short
// expiry. It is never written to the repo, never logged, and never included in
// an error message — the catch below reports `error.message`, deliberately not
// the request.

(function () {
  'use strict';

  var root = document.querySelector('.compose');
  if (!root) return;

  // Both come from _config.yml through the layout rather than being written
  // down twice; `repository` and `edit_branch` already back the post rail's
  // "Edit on GitHub" link.
  var REPO = document.documentElement.getAttribute('data-repo');
  var BRANCH = document.documentElement.getAttribute('data-branch') || 'main';
  var TOKEN_KEY = 'noema-gh-token';

  var fields = {};
  document.querySelectorAll('[data-field]').forEach(function (el) {
    var name = el.getAttribute('data-field');
    if (el.type === 'radio') {
      fields[name] = fields[name] || [];
      fields[name].push(el);
    } else {
      fields[name] = el;
    }
  });

  var tokenInput = root.querySelector('[data-token]');
  var tokenState = root.querySelector('[data-token-state]');
  var forget = root.querySelector('[data-forget]');
  var pathOut = root.querySelector('[data-path]');
  var fileOut = root.querySelector('[data-file]');
  var rendered = root.querySelector('[data-rendered]');
  var counter = root.querySelector('[data-count]');
  var status = root.querySelector('[data-status]');
  var commit = root.querySelector('[data-commit]');
  var tabs = root.querySelectorAll('[data-tab]');
  var editor = fields.body;

  // ── Helpers ──────────────────────────────────────────────────────────────
  function value(name) {
    var el = fields[name];
    if (!el) return '';
    if (Array.isArray(el)) {
      var on = el.filter(function (r) { return r.checked; })[0];
      return on ? on.value : '';
    }
    return el.value.trim();
  }

  // Lowercase, ASCII, hyphen-separated. NFKD first so "Café Culture" becomes
  // "cafe-culture" rather than losing the word.
  function slugify(text) {
    return text
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // Double-quoted YAML: only backslash and double quote need escaping, which
  // keeps colons and apostrophes in titles safe.
  function yamlString(text) {
    return '"' + text.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }

  function yamlBlock(text) {
    return text.split(/\r?\n/).map(function (line) {
      return '  ' + line.trim();
    }).join('\n');
  }

  // btoa throws on anything outside Latin-1, and these posts are full of curly
  // quotes and em dashes, so encode UTF-8 bytes first.
  function toBase64(text) {
    var bytes = new TextEncoder().encode(text);
    var binary = '';
    bytes.forEach(function (b) { binary += String.fromCharCode(b); });
    return btoa(binary);
  }

  function today() {
    var now = new Date();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  }

  // ── The file ─────────────────────────────────────────────────────────────
  function tags() {
    return value('tags').split(',').map(function (t) { return t.trim(); })
      .filter(function (t) { return t.length > 0; });
  }

  function targetPath() {
    var domain = value('domain');
    var sub = slugify(value('subtopic'));
    var slug = slugify(value('title'));
    var date = value('date') || today();

    if (!slug) return null;

    var name = date + '-' + slug + '.md';
    // Collections moved under _content/ when the repo was reorganised before
    // Phase 1. The previous version of this script still wrote to
    // `_<domain>/…` at the repo root, where Jekyll would never have seen the
    // file — it would have committed successfully and published nothing.
    var dir = '_content/_' + domain;
    if (sub) dir += '/' + sub;
    return dir + '/' + name;
  }

  function fileText() {
    var abstract = value('abstract');
    var list = tags();
    var lines = [
      '---',
      'layout: post',
      'title: ' + yamlString(value('title')),
      'date: ' + (value('date') || today()),
    ];

    if (abstract) {
      lines.push('description: ' + yamlString(abstract.replace(/\s+/g, ' ').trim()));
      lines.push('abstract: >');
      lines.push(yamlBlock(abstract));
    }

    if (list.length) {
      lines.push('tags: [' + list.map(yamlString).join(', ') + ']');
    }

    if (value('status') === 'draft') {
      // Jekyll has no `draft` key for collection documents; `published: false`
      // is the one it actually honours, and it keeps the file in place rather
      // than moving it to a _drafts directory the collections do not have.
      lines.push('published: false');
    }

    lines.push('---');
    lines.push('');
    lines.push(editor.value);
    lines.push('');
    return lines.join('\n');
  }

  // ── Live view ────────────────────────────────────────────────────────────
  // Counts prose, not markup. Splitting on whitespace alone counts "#" and
  // "**bold**" as words and inflates a heading-heavy draft; it also charges
  // reading time for code, which nobody reads at 200 words a minute.
  function words(text) {
    var prose = text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]*`/g, ' ')
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s{0,3}>\s?/gm, '')
      .replace(/^\s{0,3}[-*+]\s+/gm, '')
      .replace(/[*_~]/g, '')
      .trim();
    return prose ? prose.split(/\s+/).length : 0;
  }

  function refresh() {
    var path = targetPath();
    pathOut.textContent = path || '_content/…';

    var text = fileText();
    fileOut.textContent = text;

    var n = words(editor.value);
    var minutes = Math.max(1, Math.round(n / 200));
    counter.textContent = n + (n === 1 ? ' word · ' : ' words · ') + minutes + ' min';

    if (window.marked) {
      // Only the body is previewed. Running the front matter through a
      // markdown parser renders it as a horizontal rule and a paragraph of
      // YAML, which is worse than showing nothing.
      rendered.innerHTML = window.marked.parse(editor.value || '');
    } else {
      rendered.textContent = editor.value;
    }
  }

  // ── Token ────────────────────────────────────────────────────────────────
  function loadToken() {
    var stored = '';
    try { stored = localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { stored = ''; }
    if (stored) {
      tokenInput.value = stored;
      tokenState.textContent = 'Stored in this browser';
    } else {
      tokenState.textContent = 'Not stored';
    }
  }

  function saveToken() {
    try {
      if (tokenInput.value.trim()) {
        localStorage.setItem(TOKEN_KEY, tokenInput.value.trim());
        tokenState.textContent = 'Stored in this browser';
      } else {
        localStorage.removeItem(TOKEN_KEY);
        tokenState.textContent = 'Not stored';
      }
    } catch (e) {
      tokenState.textContent = 'This browser will not store it';
    }
  }

  // ── Status ───────────────────────────────────────────────────────────────
  function say(html, bad) {
    status.hidden = false;
    status.innerHTML = html;
    status.classList.toggle('compose-status-bad', !!bad);
  }

  // ── Commit ───────────────────────────────────────────────────────────────
  async function send() {
    var token = tokenInput.value.trim();
    var path = targetPath();

    if (!token) { say('Add a GitHub token first.', true); return; }
    if (!value('title')) { say('The post needs a title.', true); return; }
    if (!path) { say('The title needs at least one letter or number.', true); return; }
    if (!editor.value.trim()) { say('The post has no body.', true); return; }

    commit.disabled = true;
    say('Committing…');

    try {
      var response = await fetch(
        'https://api.github.com/repos/' + REPO + '/contents/' + path,
        {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer ' + token,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: 'Add post: ' + value('title'),
            content: toBase64(fileText()),
            branch: BRANCH,
          }),
        }
      );

      if (!response.ok) {
        var detail = response.status + ' ' + response.statusText;
        try {
          var body = await response.json();
          if (body && body.message) detail = body.message;
        } catch (ignored) { /* no JSON body; the status line will do */ }
        throw new Error(detail);
      }

      var data = await response.json();
      say('Committed to ' + BRANCH + '. GitHub Pages will rebuild in a few minutes. ' +
        '<a href="' + data.content.html_url + '" target="_blank" rel="noopener">' +
        'View the file</a>');
    } catch (error) {
      // error.message only. The request carried the token; logging the whole
      // object would put it in the console.
      say('Could not commit: ' + error.message + '. Check that the token has ' +
        'contents write access to ' + REPO + ', and that a post with this title ' +
        'and date does not already exist.', true);
    } finally {
      commit.disabled = false;
    }
  }

  // ── Wiring ───────────────────────────────────────────────────────────────
  root.addEventListener('input', function (event) {
    if (event.target === tokenInput) { saveToken(); return; }
    refresh();
  });
  root.addEventListener('change', refresh);

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var wanted = tab.getAttribute('data-tab');
      tabs.forEach(function (other) {
        var on = other === tab;
        other.classList.toggle('is-on', on);
        other.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      editor.hidden = wanted !== 'markdown';
      fileOut.hidden = wanted !== 'file';
    });
  });

  if (forget) {
    forget.addEventListener('click', function () {
      tokenInput.value = '';
      saveToken();
    });
  }

  var previewToggle = root.querySelector('[data-preview-toggle]');
  if (previewToggle) {
    previewToggle.addEventListener('click', function () {
      // The preview is always live; this scrolls it back to the top, which is
      // what the button is actually useful for once the post is long.
      rendered.scrollIntoView({ block: 'start' });
      rendered.parentElement.scrollTop = 0;
    });
  }

  if (commit) commit.addEventListener('click', send);

  if (fields.date && !fields.date.value) fields.date.value = today();
  loadToken();
  refresh();
})();
