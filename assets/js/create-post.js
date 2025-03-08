document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('blogPostForm');
    const previewSection = document.getElementById('preview');
    const markdownPreview = document.getElementById('markdownPreview');
    const statusDiv = document.getElementById('status');

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Get form values
        const token = document.getElementById('githubToken').value;
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
        
        // Create date and filename
        const now = new Date();
        const dateString = now.toISOString().split('T')[0];
        const slug = title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '-');
        const filename = `${dateString}-${slug}.md`;
        
        // Create Jekyll front matter
        const frontMatter = `---
layout: post
title: "${title}"
date: ${now.toISOString()}
category: ${category}
subcategory: ${subcategory}
tags: [${tags.map(tag => `"${tag}"`).join(', ')}]
confidence: ${confidence}
importance: ${importance}
status: ${status}
toc: ${toc}
excerpt: "${excerpt}"
---

${content}`;

        // Show preview
        previewSection.style.display = 'block';
        markdownPreview.textContent = frontMatter;
        
        // Commit to GitHub
        statusDiv.textContent = 'Submitting to GitHub...';
        
        commitToGitHub(token, filename, frontMatter, category)
            .then(response => {
                statusDiv.textContent = 'Post created successfully!';
                statusDiv.classList.add('success');
            })
            .catch(error => {
                statusDiv.textContent = `Error: ${error.message}`;
                statusDiv.classList.add('error');
                console.error(error);
            });
    });
    
    async function commitToGitHub(token, filename, content, category) {
        // Get user info
        const userResponse = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${token}`
            }
        });
        
        if (!userResponse.ok) {
            throw new Error('Invalid GitHub token');
        }
        
        const userData = await userResponse.json();
        const repo = 'hhshanto.github.io';
        
        // Create file in the appropriate collection directory
        const path = `_${category}/${filename}`;
        const message = `Add new post: ${filename}`;
        
        // GitHub API requires Base64 encoding for content
        const contentEncoded = btoa(unescape(encodeURIComponent(content)));
        
        const response = await fetch(`https://api.github.com/repos/${userData.login}/${repo}/contents/${path}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                content: contentEncoded
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message);
        }
        
        return response.json();
    }
});