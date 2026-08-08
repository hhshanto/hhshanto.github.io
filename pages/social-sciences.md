---
layout: default
title: Social Sciences
description: Exploring human society and social relationships
permalink: /social-sciences/
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

