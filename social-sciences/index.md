---
layout: default
title: Social Sciences
description: Exploring human society and social relationships
---

<div class="reflections-container">
    <header class="page-header">
        <h1>Social Sciences</h1>
        <p class="header-description">Understanding human behavior, societies, cultures, and the complex relationships that shape our world</p>
    </header>

    <div class="posts-container">
        {% assign sorted_posts = site.social-sciences | sort: 'date' | reverse %}
        {% for post in sorted_posts %}
            <article class="post-item">
                <div class="post-content">
                    <header class="post-header">
                        <div class="post-meta">
                            <time datetime="{{ post.date | date_to_xmlschema }}">
                                {{ post.date | date: "%B %-d, %Y" }}
                            </time>
                            {% if post.category %}
                                <span class="category-badge">{{ post.category | first }}</span>
                            {% endif %}
                        </div>
                        <h2 class="post-title">
                            <a href="{{ post.url }}">{{ post.title }}</a>
                        </h2>
                    </header>
                    
                    {% if post.abstract %}
                        <div class="post-abstract">
                            {{ post.abstract }}
                        </div>
                    {% endif %}
                    
                    <footer class="post-footer">
                        {% if post.tags %}
                            <div class="post-tags">
                                {% for tag in post.tags %}
                                    <span class="tag">{{ tag }}</span>
                                {% endfor %}
                            </div>
                        {% endif %}
                        {% if post.confidence %}
                            <div class="confidence-indicator" data-level="{{ post.confidence }}">
                                {{ post.confidence }}
                            </div>
                        {% endif %}
                    </footer>
                </div>
            </article>
        {% endfor %}
    </div>
</div>

<style>
.reflections-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem 1rem;
}

.page-header {
    text-align: center;
    margin-bottom: 4rem;
}

.page-header h1 {
    font-size: 2.5rem;
    font-weight: 700;
    color: #2d3748;
    margin-bottom: 1rem;
}

.header-description {
    font-size: 1.1rem;
    color: #4a5568;
    line-height: 1.6;
    max-width: 600px;
    margin: 0 auto;
}

.posts-container {
    display: flex;
    flex-direction: column;
    gap: 2.5rem;
}

.post-item {
    background: white;
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.post-item:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 15px rgba(0, 0, 0, 0.1);
}

.post-meta {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.5rem;
}

.post-meta time {
    font-size: 0.9rem;
    color: #718096;
}

.category-badge {
    background: #ebf4ff;
    color: #4299e1;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.8rem;
    font-weight: 500;
}

.post-title {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0.5rem 0;
}

.post-title a {
    color: #1a202c;
    text-decoration: none;
    transition: color 0.2s ease;
}

.post-title a:hover {
    color: #4299e1;
}

.post-abstract {
    color: #4a5568;
    line-height: 1.6;
    margin: 1rem 0;
}

.post-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1.5rem;
}

.post-tags {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.tag {
    background: #f7fafc;
    color: #4a5568;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.8rem;
}

.confidence-indicator {
    padding: 0.25rem 0.75rem;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 500;
}

.confidence-indicator[data-level="high"] {
    background: #c6f6d5;
    color: #2f855a;
}

.confidence-indicator[data-level="medium"] {
    background: #fefcbf;
    color: #975a16;
}

.confidence-indicator[data-level="low"] {
    background: #fed7d7;
    color: #c53030;
}

@media (max-width: 640px) {
    .reflections-container {
        padding: 1rem;
    }

    .post-item {
        padding: 1.5rem;
    }

    .page-header h1 {
        font-size: 2rem;
    }

    .post-title {
        font-size: 1.25rem;
    }

    .post-footer {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
    }
    .post-abstract {
        color: #4a5568;
        line-height: 1.6;
        margin: 1rem 0;
        text-align: justify;
    }
}

</style>
