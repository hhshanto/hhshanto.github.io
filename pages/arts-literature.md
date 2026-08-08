---
layout: default
title: Arts Literature
description: Exploring creativity through written expression
permalink: /arts-literature/
---

<div class="reflections-container">
    <header class="page-header">
        <h1>Arts Literature</h1>
        <p class="header-description">Exploring the beauty of human creativity and expression through literary arts</p>
    </header>

    <div class="posts-container">
        {% assign sorted_posts = site.arts-literature | sort: 'date' | reverse %}
        {% for post in sorted_posts %}
            <article class="post-item">
                <div class="post-content">
                    <header class="post-header">
                        <div class="post-meta">
                            <time datetime="{{ post.date | date_to_xmlschema }}">
                                {{ post.date | date: "%B %-d, %Y" }}
                            </time>
                            {% include category-badge.html post=post %}
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

