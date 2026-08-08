---
layout: default
title: All Posts
description: A curated collection of writings across all topics
permalink: /all-posts/
---

<div class="reflections-container">
    <header class="page-header">
        <h1>All Posts</h1>
        <p class="header-description">A comprehensive collection of writings spanning natural sciences, social sciences, arts, literature, and personal reflections</p>
    </header>

    <div class="posts-container">
        {% assign all_posts = '' | split: '' %}
        {% assign all_posts = all_posts | concat: site.reflections %}
        {% assign all_posts = all_posts | concat: site.natural-sciences %}
        {% assign all_posts = all_posts | concat: site.arts-literature %}
        {% assign all_posts = all_posts | concat: site.contemporary %}
        {% assign all_posts = all_posts | concat: site.social-sciences %}
        {% assign sorted_posts = all_posts | sort: 'date' | reverse %}
        {% for post in sorted_posts %}
            <article class="post-item">
                <div class="post-content">
                    <header class="post-header">
                        <div class="post-meta">
                            <time datetime="{{ post.date | date_to_xmlschema }}">
                                {{ post.date | date: "%B %-d, %Y" }}
                            </time>
                            {% include category-badge.html text=post.collection %}
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

