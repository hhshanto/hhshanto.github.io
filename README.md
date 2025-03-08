# [hhshanto.github.io](https://hhshanto.github.io)

# Noema - A Digital Knowledge Garden

[![GitHub Pages](https://img.shields.io/badge/Hosted%20on-GitHub%20Pages-blue)](https://hhshanto.github.io)

## Overview

Noema is a digital garden where ideas across various domains, from data science to philosophy, technology to arts, are cultivated and interconnected. Built as a Jekyll-based static site and hosted on GitHub Pages, this project serves as both a personal blog and a knowledge repository organized by topics rather than chronology.

## Features

- **Modular CSS architecture** - Organized SCSS files for maintainable styling
- **Dark/Light theme toggle** - Adjustable viewing experience
- **Mobile-responsive design** - Optimized for all device sizes
- **Topic-based organization** - Content categorized by knowledge domains
- **Search functionality** - Find content across the entire knowledge base
- **Confidence ratings** - Transparency about certainty levels for different posts
- **Content creation form** - Built-in post creation capability

## Technical Stack

- **Static Site Generator**: Jekyll
- **Hosting**: GitHub Pages
- **Frontend**: HTML5, SCSS, JavaScript
- **Version Control**: Git

## Content Categories

- **Natural Sciences** - Physics, biology, mathematics, etc.
- **Social Sciences** - Psychology, sociology, economics, etc.
- **Arts & Literature** - Creative works, literary analysis, etc.
- **Reflections** - Personal thoughts and philosophical musings
- **Contemporary** - Current events and modern issues

## Setup and Development

### Prerequisites

- Ruby (version 2.5.0 or higher)
- Bundler gem

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/hhshanto/hhshanto.github.io.git
   cd hhshanto.github.io
   ```

2. Install dependencies:
   ```bash
   bundle install
   ```

3. Start the development server:
   ```bash
   bundle exec jekyll serve
   ```

4. Visit `http://localhost:4000` in your browser

## Customization

The site's styling is organized into modular SCSS files:

- `_variables.scss` - Color schemes and layout variables
- `_base.scss` - Base styling elements
- `_header.scss` - Navigation and header styling
- `_hero.scss` - Hero section styling
- `_about.scss` - About section styles
- `_latest-posts.scss` - Blog post preview styling
- `_post.scss` - Individual post styling
- `_forms.scss` - Form styling for content creation
- `_dark-mode.scss` - Dark theme styling

## Personal Content

This is my personal digital garden and knowledge repository. All content is created and maintained by me. The site is not open for public content contributions.

Content management is handled through:

1. Direct commits to the repository (personal use only)
2. The built-in post creation form (authenticated access)

## Directory Structure

```
.
├── _layouts/           # HTML templates
├── _includes/          # Reusable HTML components
├── _sass/              # SCSS modules
├── _natural-sciences/  # Natural sciences posts
├── _social-sciences/   # Social sciences posts
├── _arts-literature/   # Arts and literature posts
├── _reflections/       # Personal reflections
├── _contemporary/      # Contemporary issues
├── assets/             # Static assets (CSS, JS, images)
└── _config.yml         # Jekyll configuration
```

## License

This project's code is licensed under the MIT License, which allows for reuse of the technical implementation. However, all content (articles, posts, images, and personal information) is copyrighted and not available for reproduction without permission. See the LICENSE file for details on code reuse.

## Contact

Hasan - [LinkedIn](https://linkedin.com/in/mhasan-shanto/) - [GitHub](https://github.com/hhshanto)

---