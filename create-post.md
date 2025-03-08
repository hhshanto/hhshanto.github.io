---
layout: default
title: Create New Post
---

<div class="create-post-container">
    <h1>Create New Blog Post</h1>
    <form id="blogPostForm" class="post-form">
        <div class="form-group">
            <label for="githubToken">GitHub Token:</label>
            <input type="password" id="githubToken" name="githubToken" required>
            <small>Create a token at <a href="https://github.com/settings/tokens" target="_blank">GitHub Settings</a> with 'repo' scope</small>
        </div>

        <div class="form-group">
            <label for="title">Post Title:</label>
            <input type="text" id="title" name="title" required>
        </div>

        <div class="form-group">
            <label for="category">Category:</label>
            <select id="category" name="category" required>
                <option value="natural-sciences">Natural Sciences</option>
                <option value="social-sciences">Social Sciences</option>
                <option value="arts-literature">Arts & Literature</option>
                <option value="reflections">Reflections</option>
                <option value="contemporary">Contemporary</option>
            </select>
        </div>

        <div class="form-group">
            <label for="subcategory">Subcategory:</label>
            <input type="text" id="subcategory" name="subcategory" required>
        </div>

        <div class="form-group">
            <label for="tags">Tags (comma-separated):</label>
            <input type="text" id="tags" name="tags" required>
        </div>

        <div class="form-group">
            <label for="confidence">Confidence:</label>
            <select id="confidence" name="confidence" required>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
            </select>
        </div>

        <div class="form-group">
            <label for="importance">Importance:</label>
            <select id="importance" name="importance" required>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
            </select>
        </div>

        <div class="form-group">
            <label for="status">Status:</label>
            <select id="status" name="status" required>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
            </select>
        </div>

        <div class="form-group">
            <label for="toc">Table of Contents:</label>
            <select id="toc" name="toc" required>
                <option value="true">Yes</option>
                <option value="false">No</option>
            </select>
        </div>

        <div class="form-group">
            <label for="excerpt">Excerpt:</label>
            <textarea id="excerpt" name="excerpt" rows="3" required></textarea>
            <small>A brief summary of the post that will appear in the post list</small>
        </div>

        <div class="form-group">
            <label for="content">Content:</label>
            <textarea id="content" name="content" rows="15" required></textarea>
            <small>Use Markdown formatting. Include sections like Context, Technical Details, etc.</small>
        </div>

        <button type="submit" class="submit-btn">Create Post</button>
    </form>
    
    <div id="preview" class="preview-section" style="display: none;">
        <h2>Preview</h2>
        <pre id="markdownPreview"></pre>
        <div id="status"></div>
    </div>
    <!-- Add at the end of your file -->
<script src="{{ '/assets/js/create-post.js' | relative_url }}"></script>
</div>