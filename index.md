---
layout: default
title: Home
---

# Welcome to My Data Science Blog

Hello! I'm Hasan, a Data Scientist specializing in Retrieval-Augmented Generation (RAG) systems and machine learning.

## Latest Posts

<ul>
  {% for post in site.posts limit:5 %}
    <li>
      <h2><a href="{{ post.url }}">{{ post.title }}</a></h2>
      <p>{{ post.excerpt }}</p>
    </li>
  {% endfor %}
</ul>

## Featured Projects

Check out some of my projects in RAG systems, machine learning, and data science.