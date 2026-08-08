/*
 * Creates a new post by committing a Markdown file through the GitHub
 * Contents API.
 *
 * This is the single creator script. There was previously a second one
 * (create-post.js) bound to the same form, and both were loaded, so every
 * submit fired twice. Their target paths were wrong in different ways:
 * one wrote to `_<category>/<subcategory>/_posts/`, which has no
 * counterpart in the repo, and the other dropped the subcategory folder
 * entirely. Posts live at `_<category>/<subcategory>/<file>.md`.
 *
 * The front matter written here matches the keys the templates actually
 * read: the section index pages render `abstract`, jekyll-seo-tag reads
 * `description`, and the post layout checks `toc`.
 */

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('blogPostForm');
    if (!form) return;

    const statusDiv = document.getElementById('submitStatus');
    const preview = document.getElementById('preview');
    const markdownPreview = document.getElementById('markdownPreview');
    const submitButton = form.querySelector('button[type="submit"]');

    const REPO = 'hhshanto/hhshanto.github.io';
    const BRANCH = 'main';

    const value = (id) => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    };

    // Lowercase, ASCII, hyphen-separated. Strips diacritics so a title
    // like "Café Culture" becomes "cafe-culture" rather than losing the
    // word entirely.
    const slugify = (text) =>
        text
            .normalize('NFKD')
            .replace(/[̀-ͯ]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

    // Double-quoted YAML scalar: only backslash and double quote need
    // escaping, which keeps colons and apostrophes in titles safe.
    const yamlString = (text) => `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

    // Folded block scalar, matching the style of the existing posts.
    const yamlBlock = (text) =>
        text
            .split(/\r?\n/)
            .map((line) => `  ${line.trim()}`)
            .join('\n');

    // btoa() throws on anything outside Latin-1, and these posts contain
    // curly quotes and em dashes, so encode UTF-8 bytes first.
    const toBase64 = (text) => {
        const bytes = new TextEncoder().encode(text);
        let binary = '';
        bytes.forEach((b) => {
            binary += String.fromCharCode(b);
        });
        return btoa(binary);
    };

    const buildDocument = (fields, dateString) => {
        const lines = [
            '---',
            'layout: post',
            `title: ${yamlString(fields.title)}`,
            `date: ${dateString}`
        ];

        if (fields.summary) {
            // description stays on one line; abstract keeps the line breaks
            // via the folded block below.
            const oneLine = fields.summary.replace(/\s+/g, ' ').trim();
            lines.push(`description: ${yamlString(oneLine)}`);
            lines.push('abstract: >');
            lines.push(yamlBlock(fields.summary));
        }

        if (fields.tags.length > 0) {
            lines.push(`tags: [${fields.tags.map(yamlString).join(', ')}]`);
        }

        lines.push(`confidence: ${fields.confidence}`);
        lines.push(`importance: ${fields.importance}`);
        lines.push(`status: ${fields.status}`);
        lines.push(`toc: ${fields.toc}`);
        lines.push('---');
        lines.push('');
        lines.push(fields.content);
        lines.push('');

        return lines.join('\n');
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const token = value('githubToken');
        const fields = {
            title: value('title'),
            category: value('category'),
            subcategory: slugify(value('subcategory')),
            tags: value('tags')
                .split(',')
                .map((tag) => tag.trim())
                .filter((tag) => tag.length > 0),
            confidence: value('confidence'),
            importance: value('importance'),
            status: value('status'),
            toc: value('toc'),
            summary: value('excerpt'),
            content: value('content')
        };

        const slug = slugify(fields.title);
        if (!slug) {
            statusDiv.innerHTML =
                '<div class="error-message"><p>The title needs at least one letter or number.</p></div>';
            return;
        }
        if (!fields.subcategory) {
            statusDiv.innerHTML =
                '<div class="error-message"><p>The subcategory needs at least one letter or number.</p></div>';
            return;
        }

        const dateString = new Date().toISOString().split('T')[0];
        const filename = `${dateString}-${slug}.md`;
        const path = `_${fields.category}/${fields.subcategory}/${filename}`;
        const fileText = buildDocument(fields, dateString);

        preview.style.display = 'block';
        markdownPreview.textContent = fileText;

        // Guard against a second submit while the request is in flight,
        // which would otherwise 409 against the file just created.
        submitButton.disabled = true;
        statusDiv.innerHTML = 'Creating post…';

        try {
            const response = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/vnd.github+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Add new post: ${fields.title}`,
                    content: toBase64(fileText),
                    branch: BRANCH
                })
            });

            if (!response.ok) {
                let detail = `${response.status} ${response.statusText}`;
                try {
                    const body = await response.json();
                    if (body && body.message) detail = body.message;
                } catch (ignored) {
                    // Response had no JSON body; the status line is enough.
                }
                throw new Error(detail);
            }

            const data = await response.json();

            statusDiv.innerHTML = `
                <div class="success-message">
                    <h3>✅ Post created</h3>
                    <p>GitHub Pages will rebuild the site in a few minutes.</p>
                    <p><a href="${data.content.html_url}" target="_blank" rel="noopener">View the file on GitHub</a></p>
                    <div class="instructions">
                        <h4>Details</h4>
                        <ul>
                            <li>Title: ${fields.title}</li>
                            <li>Path: ${path}</li>
                            <li>Status: ${fields.status}</li>
                        </ul>
                    </div>
                </div>
            `;

            form.reset();
        } catch (error) {
            // Deliberately not logging the error object wholesale, since the
            // request carried the token.
            statusDiv.innerHTML = `
                <div class="error-message">
                    <h3>❌ Could not create the post</h3>
                    <p>${error.message}</p>
                    <div class="instructions">
                        <h4>Things to check</h4>
                        <ul>
                            <li>The token needs write access to contents for this repository.</li>
                            <li>A post with the same title and today's date may already exist.</li>
                        </ul>
                    </div>
                </div>
            `;
        } finally {
            submitButton.disabled = false;
        }
    });
});
