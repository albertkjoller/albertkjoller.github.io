---
layout: default
permalink: /notes/
title: notes
nav: true
nav_order: 3
pagination:
  enabled: true
  collection: posts
  permalink: /page/:num/
  per_page: 8
  sort_field: date
  sort_reverse: true
  trail:
    before: 1
    after: 3
---

<div class="post">

<div class="notes-header">
  <h1 class="notes-title">Notes</h1>
  <p class="notes-intro">Short notes and expositions on geometric approaches to probabilistic machine learning. Written to give an accessible entry point into my research — aimed at readers with some background in probability and calculus, though the more technical pieces assume familiarity with differential geometry.</p>
</div>

{% if site.display_tags and site.display_tags.size > 0 or site.display_categories and site.display_categories.size > 0 %}
<div class="tag-category-list">
  <ul class="p-0 m-0">
    {% for tag in site.display_tags %}
      <li>
        <i class="fa-solid fa-hashtag fa-sm"></i> <a href="{{ tag | slugify | prepend: '/blog/tag/' | relative_url }}">{{ tag }}</a>
      </li>
      {% unless forloop.last %}<p>&bull;</p>{% endunless %}
    {% endfor %}
    {% if site.display_categories.size > 0 and site.display_tags.size > 0 %}
      <p>&bull;</p>
    {% endif %}
    {% for category in site.display_categories %}
      <li>
        <i class="fa-solid fa-tag fa-sm"></i> <a href="{{ category | slugify | prepend: '/blog/category/' | relative_url }}">{{ category }}</a>
      </li>
      {% unless forloop.last %}<p>&bull;</p>{% endunless %}
    {% endfor %}
  </ul>
</div>
{% endif %}

{% assign featured_posts = site.posts | where: "featured", "true" %}
{% if featured_posts.size > 0 %}
<div class="notes-pinned-label">pinned</div>
<div class="notes-grid notes-grid--featured">
  {% for post in featured_posts %}
  {% if post.external_source == blank %}
    {% assign read_time = post.content | number_of_words | divided_by: 180 | plus: 1 %}
  {% else %}
    {% assign read_time = post.feed_content | strip_html | number_of_words | divided_by: 180 | plus: 1 %}
  {% endif %}
  <article class="note-card note-card--featured">
    <div class="note-card-pin"><i class="fa-solid fa-thumbtack fa-xs"></i></div>
    <div class="note-card-badges">
      {% if post.level %}<span class="note-level note-level--{{ post.level | downcase | replace: ' ', '-' }}">{{ post.level }}</span>{% endif %}
      {% for category in post.categories %}<span class="note-category">{{ category }}</span>{% endfor %}
    </div>
    <h3 class="note-card-title">
      <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
    </h3>
    {% if post.description %}<p class="note-card-description">{{ post.description }}</p>{% endif %}
    <div class="note-card-meta">
      <span>{{ read_time }} min read</span>
      <span>{{ post.date | date: '%b %Y' }}</span>
      {% for tag in post.tags %}<a href="{{ tag | slugify | prepend: '/blog/tag/' | relative_url }}" class="note-tag">#{{ tag }}</a>{% endfor %}
    </div>
  </article>
  {% endfor %}
</div>
<div class="notes-section-label">all notes</div>
{% endif %}

<div class="notes-grid">
  {% if page.pagination.enabled %}
    {% assign postlist = paginator.posts %}
  {% else %}
    {% assign postlist = site.posts %}
  {% endif %}

  {% for post in postlist %}
  {% if post.external_source == blank %}
    {% assign read_time = post.content | number_of_words | divided_by: 180 | plus: 1 %}
  {% else %}
    {% assign read_time = post.feed_content | strip_html | number_of_words | divided_by: 180 | plus: 1 %}
  {% endif %}
  {% assign year = post.date | date: "%Y" %}
  {% assign tags = post.tags | join: "" %}
  {% assign categories = post.categories | join: "" %}

  <article class="note-card">
    <div class="note-card-badges">
      {% if post.level %}<span class="note-level note-level--{{ post.level | downcase | replace: ' ', '-' }}">{{ post.level }}</span>{% endif %}
      {% for category in post.categories %}<span class="note-category">{{ category }}</span>{% endfor %}
    </div>
    <h3 class="note-card-title">
      {% if post.redirect == blank %}
        <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
      {% elsif post.redirect contains '://' %}
        <a href="{{ post.redirect }}" target="_blank">{{ post.title }}</a>
      {% else %}
        <a href="{{ post.redirect | relative_url }}">{{ post.title }}</a>
      {% endif %}
    </h3>
    {% if post.description %}<p class="note-card-description">{{ post.description }}</p>{% endif %}
    <div class="note-card-meta">
      <span>{{ read_time }} min read</span>
      <span>{{ post.date | date: '%b %d, %Y' }}</span>
      {% if tags != "" %}
        {% for tag in post.tags %}<a href="{{ tag | slugify | prepend: '/blog/tag/' | relative_url }}" class="note-tag">#{{ tag }}</a>{% endfor %}
      {% endif %}
    </div>
  </article>
  {% endfor %}
</div>

{% if page.pagination.enabled %}
{% include pagination.liquid %}
{% endif %}

</div>
