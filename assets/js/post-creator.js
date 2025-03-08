document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('blogPostForm');
    const statusDiv = document.getElementById('status');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Get form values
        const githubToken = document.getElementById('githubToken').value;
        const title = document.getElementById('title').value;
        const category = document.getElementById('category').value;
        const subcategory = document.getElementById('subcategory').value;
        const tags = document.getElementById('tags').value.split(',').map(tag => tag.trim());
        const confidence = document.getElementById('confidence').value;
        const importance = document.getElementById('importance').value;
        const status = document.getElementById('status').value;
        const toc = document.getElementById('toc').value;
        const excerpt = document.getElementById('excerpt').value;
        const content = document.getElementById('content').value;
        
        // Generate date string
        const date = new Date();
        const dateString = date.toISOString().split('T')[0];
        
        // Generate filename
        const filename = `${dateString}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
        
        // Generate front matter with proper category structure
        const frontMatter = `---
layout: post
title: "${title}"
date: ${dateString}
categories: [${category}, ${subcategory}]
tags: [${tags.join(', ')}]
confidence: ${confidence}
importance: ${importance}
status: ${status}
toc: ${toc}
excerpt: "${excerpt}"
---

${content}`;

        // Show preview
        const preview = document.getElementById('preview');
        const markdownPreview = document.getElementById('markdownPreview');
        preview.style.display = 'block';
        markdownPreview.textContent = frontMatter;

        try {
            statusDiv.innerHTML = 'Creating post...';
            
            // GitHub API request with correct path structure
            const response = await fetch(`https://api.github.com/repos/hhshanto/hhshanto.github.io/contents/_${category}/${subcategory}/_posts/${filename}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: `Add new post: ${title}`,
                    content: btoa(unescape(encodeURIComponent(frontMatter))), // Convert content to base64
                    branch: 'main'
                })
            });

            if (!response.ok) {
                throw new Error(`GitHub API responded with ${response.status}: ${await response.text()}`);
            }

            const data = await response.json();
            
            statusDiv.innerHTML = `
                <div class="success-message">
                    <h3>✅ Post Created Successfully!</h3>
                    <p>Your post has been created and will be live in a few minutes.</p>
                    <p>View your post at: <a href="${data.content.html_url}" target="_blank">GitHub</a></p>
                    <div class="instructions">
                        <h4>Post Details:</h4>
                        <ul>
                            <li>Title: ${title}</li>
                            <li>Category: ${category}</li>
                            <li>Subcategory: ${subcategory}</li>
                            <li>Status: ${status}</li>
                            <li>File: ${filename}</li>
                        </ul>
                        <p>The post will be automatically deployed to your site in a few minutes.</p>
                    </div>
                </div>
            `;

            // Clear form after successful submission
            form.reset();

        } catch (error) {
            console.error('Error:', error);
            statusDiv.innerHTML = `
                <div class="error-message">
                    <h3>❌ Error Creating Post</h3>
                    <p>${error.message}</p>
                    <p>Please check your GitHub token and try again.</p>
                    <div class="instructions">
                        <h4>Troubleshooting:</h4>
                        <ul>
                            <li>Make sure your GitHub token has the 'repo' scope</li>
                            <li>Verify that the category folder exists in your repository</li>
                            <li>Check if a file with the same name already exists</li>
                        </ul>
                    </div>
                </div>
            `;
        }
    });

    // Optional: Add preview functionality while typing
    document.getElementById('content').addEventListener('input', function() {
        const preview = document.getElementById('preview');
        const markdownPreview = document.getElementById('markdownPreview');
        preview.style.display = 'block';
        
        // Create a preview of the current content
        const title = document.getElementById('title').value || '[Title]';
        const category = document.getElementById('category').value;
        const subcategory = document.getElementById('subcategory').value || '[Subcategory]';
        const tags = document.getElementById('tags').value || '[Tags]';
        const confidence = document.getElementById('confidence').value;
        const importance = document.getElementById('importance').value;
        const status = document.getElementById('status').value;
        const toc = document.getElementById('toc').value;
        const excerpt = document.getElementById('excerpt').value || '[Excerpt]';
        
        const previewContent = `---
layout: post
title: "${title}"
date: ${new Date().toISOString().split('T')[0]}
categories: [${category}, ${subcategory}]
tags: [${tags}]
confidence: ${confidence}
importance: ${importance}
status: ${status}
toc: ${toc}
excerpt: "${excerpt}"
---

${this.value}`;

        markdownPreview.textContent = previewContent;
    });
});