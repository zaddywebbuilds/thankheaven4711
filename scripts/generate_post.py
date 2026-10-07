#!/usr/bin/env python3
"""
Daily blog post generator for thankheaven4711maui.com
Reads the next unused topic from blog/topics.json, calls the DeepSeek API
to generate a full SEO-optimized HTML post, writes it to blog/, and inserts
a card at the top of blog/index.html.
"""

import json
import os
import re
import sys
from datetime import date
from pathlib import Path

from openai import OpenAI

REPO_ROOT = Path(__file__).parent.parent
BLOG_DIR = REPO_ROOT / "blog"
TOPICS_FILE = BLOG_DIR / "topics.json"
INDEX_FILE = BLOG_DIR / "index.html"
BASE_URL = "https://thankheaven4711maui.com"

SYSTEM_PROMPT = """You are an expert SEO content writer producing blog posts for a vacation rental property website.
The property is O Thank Heaven 4 711 -- a seventh-floor oceanfront condo at 4711 S Kihei Rd, Unit 711, Kihei, Maui, Hawaii 96753.
Key facts: 35-foot west-facing private lanai, views of Lanai and Molokai, reef snorkeling off the lawn, humpback whales in the AuAu Channel Nov-May, Hawaiian green sea turtles on the shoreline.
Website: thankheaven4711maui.com. Booking link: https://thankheaven4711maui.com/#book

Output ONLY the complete HTML file -- no markdown fences, no explanation, just the raw HTML starting with <!doctype html>.

The post must:
- Be 650 to 850 words of article body text (not counting HTML)
- Have a unique <title> ending in " | O Thank Heaven 4 711"
- Have a <meta name="description"> of 150-160 characters
- Include canonical, OG, Twitter card, robots, theme-color, icon, and non-blocking Google Fonts tags
- Include a BlogPosting JSON-LD script with the exact datePublished and dateModified provided
- Have exactly one H1 (.blog-h1) containing the primary keyword
- Have 4-6 H2 sections covering different aspects of the topic
- Have a .blog-lead paragraph after the H1
- Have a .blog-cta block mid-article linking to https://thankheaven4711maui.com/#book
- Have a .blog-related section at the end with exactly 3 related post cards
- Have a breadcrumb nav (.blog-crumb) above the header
- Have a .blog-meta with the date, category tag, and read time
- Use root-relative paths: /assets/css/site.css?v=45, /blog/blog.css, /assets/img/og-cover.jpg, /assets/img/favicon.svg
- Link naturally to 2-3 other blog posts using their slugs (e.g. /blog/best-snorkeling-spots-kihei-maui.html)
- Link to the main property page at / or /#book at least twice
- Include the nav header with brand + nav links (Blog, Photos, The Condo) + Check availability pill
- Include the blog-footer
- NOT use em dashes (--) -- use " -- " with spaces or rewrite the sentence
- NOT include any URL in the article text (link text only)

CSS classes to use (already defined in blog.css):
.blog-main, .blog-article, .blog-crumb, .blog-header, .blog-meta, .blog-h1, .blog-lead,
.blog-feat-img, .blog-body, .blog-cta, .blog-cta__title, .blog-cta__sub, .blog-cta__btn,
.blog-related, .blog-related__title, .blog-related__grid, .blog-rel-card,
.blog-rel-card__tag, .blog-rel-card__title, .blog-footer, .tag, .skip, .nav, .nav__brand,
.nav__mark, .nav__four, .nav__links, .pill, .pill--solid, .nav__cta"""


def load_topics():
    with open(TOPICS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def get_existing_slugs():
    return {p.stem for p in BLOG_DIR.glob("*.html") if p.name != "index.html"}


def pick_next_topic(topics, existing_slugs):
    for topic in topics:
        if topic["slug"] not in existing_slugs:
            return topic
    return None


def generate_post_html(topic, post_date, client):
    user_prompt = f"""Write a complete SEO-optimized blog post HTML file for the following topic.
Output ONLY the raw HTML starting with <!doctype html> -- no explanation, no markdown fences.

Topic: {topic['title']}
Primary keyword: {topic['keyword']}
Category: {topic['category']}
Slug: {topic['slug']}
Date: {post_date.isoformat()} (use this for datePublished, dateModified, and the <time> element)
Canonical URL: {BASE_URL}/blog/{topic['slug']}.html
Excerpt for related cards: {topic['excerpt']}

The article should be genuinely useful to someone planning a Maui vacation.
Include specific, practical details -- not generic travel writing.
Naturally mention the property (unit 711 at 4711 S Kihei Rd, Kihei) and the lanai view where relevant, without making it feel like an advertisement.
The CTA block should tie the topic to the property in a natural way.

For the 3 related post cards, choose from these existing posts:
- /blog/best-snorkeling-spots-kihei-maui.html -- Best Snorkeling Spots Near Kihei, Maui (Snorkeling)
- /blog/humpback-whale-watching-maui-season.html -- Humpback Whale Watching in Maui: Complete Guide (Wildlife)
- /blog/best-beaches-south-maui.html -- Best Beaches in South Maui (Beaches)
- /blog/maui-condo-vs-hotel.html -- Why a Maui Condo Beats a Hotel (Accommodation)
- /blog/things-to-do-kihei-maui.html -- 15 Best Things to Do in Kihei, Maui (Activities)
- /blog/maui-packing-list.html -- Complete Maui Packing List (Planning)
- /blog/best-time-to-visit-maui.html -- Best Time to Visit Maui (Planning)
- /blog/maui-sunset-spots.html -- Best Sunset Spots in Maui (Sunsets)
- /blog/road-to-hana-tips.html -- Road to Hana: Tips for the Drive (Day trips)
- /blog/haleakala-sunrise-guide.html -- Haleakala Sunrise: Complete Visitor Guide (Day trips)
- /blog/maui-vs-oahu-vacation.html -- Maui vs Oahu for Your Next Vacation (Planning)
- /blog/kihei-vs-lahaina-where-to-stay.html -- Kihei vs Lahaina: Where to Stay in Maui (Planning)
- /blog/maui-snorkeling-gear-guide.html -- Snorkeling Gear Guide for Maui (Snorkeling)
- /blog/honu-sea-turtle-viewing-maui.html -- Where to See Hawaiian Green Sea Turtles (Wildlife)
- /blog/maui-water-activities-guide.html -- Complete Guide to Maui Water Activities (Activities)
- /blog/maui-honeymoon-guide.html -- The Ultimate Maui Honeymoon Guide (Romance)
- /blog/maui-family-vacation-guide.html -- Maui Family Vacation Guide (Family)
- /blog/kihei-restaurants-guide.html -- Best Restaurants in Kihei, Maui (Food)
- /blog/maui-vacation-budget-guide.html -- How Much Does a Maui Vacation Cost? (Budget)
- /blog/maui-luau-guide.html -- Best Luaus in Maui: A Visitor's Guide (Culture)
- /blog/south-maui-oceanfront-vacation-rentals.html -- South Maui Oceanfront Vacation Rentals (Accommodation)
- /blog/maui-photography-spots.html -- Best Photography Spots in Maui (Photography)
- /blog/maui-sands-seaside-area-guide.html -- Maui Sands Seaside: A Complete Area Guide (Location)
- /blog/hawaiian-cultural-experiences-maui.html -- Hawaiian Cultural Experiences Every Visitor Should Try (Culture)
- /blog/day-trips-from-kihei-maui.html -- Best Day Trips from Kihei, Maui (Day trips)
- /blog/maui-grocery-stores-tips.html -- Grocery Shopping in Maui: Best Stores and Tips (Local tips)
- /blog/whale-watching-from-maui-lanai.html -- Whale Watching from Your Maui Lanai (Wildlife)
- /blog/oceanfront-vacation-rental-maui-guide.html -- How to Choose the Right Oceanfront Vacation Rental in Maui (Accommodation)

Pick the 3 most relevant to the topic. Output only the raw HTML."""

    response = client.chat.completions.create(
        model="deepseek-chat",
        max_tokens=8192,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    )
    return response.choices[0].message.content.strip()


def update_index(topic, post_date):
    """Insert a new blog card at the top of the blog-grid in index.html."""
    content = INDEX_FILE.read_text(encoding="utf-8")

    formatted_date = post_date.strftime("%b %-d, %Y") if sys.platform != "win32" else post_date.strftime("%b %d, %Y").replace(" 0", " ")

    new_card = f'''
    <a class="blog-card" href="/blog/{topic['slug']}.html">
      <span class="blog-card__date">{formatted_date}</span>
      <p class="blog-card__title">{topic['title']}</p>
      <p class="blog-card__excerpt">{topic['excerpt']}</p>
      <span class="blog-card__cta">Read guide &rarr;</span>
    </a>
'''

    # Insert after opening <div class="blog-grid">
    marker = '<div class="blog-grid">'
    if marker not in content:
        print("ERROR: could not find blog-grid marker in index.html", file=sys.stderr)
        sys.exit(1)

    updated = content.replace(marker, marker + new_card, 1)
    INDEX_FILE.write_text(updated, encoding="utf-8")
    print(f"Updated index.html with card for: {topic['slug']}")


def main():
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        print("ERROR: DEEPSEEK_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    topics = load_topics()
    existing_slugs = get_existing_slugs()
    topic = pick_next_topic(topics, existing_slugs)

    if topic is None:
        print("All topics exhausted -- nothing to generate today.")
        sys.exit(0)

    print(f"Generating post: {topic['slug']}")

    client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")
    post_date = date.today()

    html = generate_post_html(topic, post_date, client)

    # Strip accidental markdown fences if model adds them
    html = re.sub(r"^```html\s*", "", html)
    html = re.sub(r"\s*```$", "", html)

    out_path = BLOG_DIR / f"{topic['slug']}.html"
    out_path.write_text(html, encoding="utf-8")
    print(f"Written: {out_path}")

    update_index(topic, post_date)


if __name__ == "__main__":
    main()
