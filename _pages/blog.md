---
layout: default
permalink: /notes/
title: notes
nav: true
nav_order: 3
pagination:
  enabled: false # off so the filters below see every note at once
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
  <p class="notes-intro">Walk-throughs of selected papers and machine learning topics I find interesting.
  </p>
</div>

{% assign listed_posts = site.posts | where_exp: "post", "post.hidden != true" %}
{% assign filter_categories = "" | split: "" %}
{% assign filter_levels = "" | split: "" %}
{% for post in listed_posts %}
  {% assign filter_categories = filter_categories | concat: post.categories %}
  {% if post.level and post.level != "" %}{% assign lv = post.level | append: '' %}{% assign filter_levels = filter_levels | push: lv %}{% endif %}
{% endfor %}
{% assign filter_categories = filter_categories | uniq | sort %}
{% assign filter_levels = filter_levels | uniq %}

{% if filter_categories.size > 1 or filter_levels.size > 0 %}
<div class="notes-filters" aria-label="Filter notes">
  {% if filter_categories.size > 1 %}
  <div class="notes-filter-group" data-filter="category" role="group" aria-label="Topic">
    <span class="notes-filter-label">topic</span>
    <button type="button" class="notes-chip is-active" data-value="" aria-pressed="true">all</button>
    {% for c in filter_categories %}<button type="button" class="notes-chip" data-value="{{ c | slugify }}" aria-pressed="false">{{ c }}</button>{% endfor %}
  </div>
  {% endif %}
  {% if filter_levels.size > 1 %}
  <div class="notes-filter-group" data-filter="level" role="group" aria-label="{{ site.data.note_levels[site.note_level_scale].name }}">
    {% assign level_scale = site.data.note_levels[site.note_level_scale] %}
    <span class="notes-filter-label">{{ level_scale.name }}</span>
    <button type="button" class="notes-chip is-active" data-value="" aria-pressed="true">all</button>
    {%- comment -%} chips in the order of _data/note_levels.yml, only for levels that are in use {%- endcomment -%}
    {% for nl in level_scale.steps %}{% if filter_levels contains nl.key %}<button type="button" class="notes-chip" data-value="{{ nl.key }}" aria-pressed="false" title="{{ nl.hint }}">{% include note_level.liquid level=nl.key icons_only=true %}</button>{% endif %}{% endfor %}
  </div>
  {% endif %}
  {% if filter_levels.size > 0 %}
  {% assign level_scale = site.data.note_levels[site.note_level_scale] %}
  <details class="notes-levels-legend">
    <summary>{{ level_scale.legend_title }}</summary>
    {% if level_scale.legend_intro %}<p>{{ level_scale.legend_intro }}</p>{% endif %}
    <dl>
      {% for nl in level_scale.steps %}
      <dt>{% include note_level.liquid level=nl.key %}</dt>
      <dd>{{ nl.hint }}</dd>
      {% endfor %}
    </dl>
  </details>
  {% endif %}
</div>
{% endif %}

{% if site.display_tags and site.display_tags.size > 0 or site.display_categories and site.display_categories.size > 0 %}
<div class="tag-category-list">
  <ul class="p-0 m-0">
    {% for tag in site.display_tags %}
      <li>
        <i class="fa-solid fa-hashtag fa-sm"></i> <a href="{{ tag | slugify | prepend: '/notes/tag/' | relative_url }}">{{ tag }}</a>
      </li>
      {% unless forloop.last %}<p>&bull;</p>{% endunless %}
    {% endfor %}
    {% if site.display_categories.size > 0 and site.display_tags.size > 0 %}
      <p>&bull;</p>
    {% endif %}
    {% for category in site.display_categories %}
      <li>
        <i class="fa-solid fa-tag fa-sm"></i> <a href="{{ category | slugify | prepend: '/notes/category/' | relative_url }}">{{ category }}</a>
      </li>
      {% unless forloop.last %}<p>&bull;</p>{% endunless %}
    {% endfor %}
  </ul>
</div>
{% endif %}

{% assign featured_posts = site.posts | where: "featured", "true" | where_exp: "post", "post.hidden != true" %}
{% if featured_posts.size > 0 %}
<div class="notes-pinned-label">pinned</div>
<div class="notes-grid notes-grid--featured">
  {% for post in featured_posts %}
  {% if post.external_source == blank %}
    {% include reading_time.liquid text=post.content %}
  {% else %}
    {% include reading_time.liquid text=post.feed_content %}
  {% endif %}
  {% assign read_time = reading_time %}
  <article class="note-card note-card--featured" data-category="{% for c in post.categories %}{{ c | slugify }} {% endfor %}" data-level="{{ post.level }}">
    <div class="note-card-pin"><i class="fa-solid fa-thumbtack fa-xs"></i></div>
    {% if post.thumbnail %}
    <a href="{{ post.url | relative_url }}" class="note-card-thumb" tabindex="-1" aria-hidden="true">
      <img src="{{ post.thumbnail | relative_url }}" alt="" loading="lazy">
    </a>
    {% endif %}
    <div class="note-card-badges">
      {% include note_level.liquid level=post.level %}
      {% for category in post.categories %}<button type="button" class="note-category" data-value="{{ category | slugify }}" title="Show notes on {{ category }}">{{ category }}</button>{% endfor %}
    </div>
    <h3 class="note-card-title">
      <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
    </h3>
    {% if post.description %}<p class="note-card-description">{{ post.description }}</p>{% endif %}
    <div class="note-card-meta">
      <span>{{ read_time }} min read</span>
      <span>{{ post.date | date: '%b %Y' }}</span>
      {% for tag in post.tags %}<a href="{{ tag | slugify | prepend: '/notes/tag/' | relative_url }}" class="note-tag">#{{ tag }}</a>{% endfor %}
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
  {% if post.hidden %}{% continue %}{% endif %}
  {% if post.external_source == blank %}
    {% include reading_time.liquid text=post.content %}
  {% else %}
    {% include reading_time.liquid text=post.feed_content %}
  {% endif %}
  {% assign read_time = reading_time %}
  {% assign year = post.date | date: "%Y" %}
  {% assign tags = post.tags | join: "" %}
  {% assign categories = post.categories | join: "" %}

  <article class="note-card" data-category="{% for c in post.categories %}{{ c | slugify }} {% endfor %}" data-level="{{ post.level }}">
    {% if post.thumbnail %}
    <a href="{{ post.url | relative_url }}" class="note-card-thumb" tabindex="-1" aria-hidden="true">
      <img src="{{ post.thumbnail | relative_url }}" alt="" loading="lazy">
    </a>
    {% endif %}
    <div class="note-card-badges">
      {% include note_level.liquid level=post.level %}
      {% for category in post.categories %}<button type="button" class="note-category" data-value="{{ category | slugify }}" title="Show notes on {{ category }}">{{ category }}</button>{% endfor %}
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
        {% for tag in post.tags %}<a href="{{ tag | slugify | prepend: '/notes/tag/' | relative_url }}" class="note-tag">#{{ tag }}</a>{% endfor %}
      {% endif %}
    </div>
  </article>
  {% endfor %}
</div>

{% if page.pagination.enabled %}
{% include pagination.liquid %}
{% endif %}

<p class="notes-empty" hidden>No notes match these filters.</p>
<script defer src="{{ '/assets/js/notes-filter.js' | relative_url | bust_file_cache }}"></script>

</div>
