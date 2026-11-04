#!/usr/bin/env python3
"""
Weekly keyword research for thankheaven4711maui.com
Runs every Saturday via GitHub Actions (.github/workflows/weekly-keywords.yml).
Generates 7 fresh trend-aware topics and prepends them to blog/topics.json.
"""

import json
import os
import sys
from datetime import date, datetime
from pathlib import Path

from openai import OpenAI

REPO_ROOT = Path(__file__).parent.parent
BLOG_DIR = REPO_ROOT / "blog"
TOPICS_FILE = BLOG_DIR / "topics.json"

BOOKING_URL = "https://www.myperfectstays.com/mauiseaside711/"
BASE_URL = "https://thankheaven4711maui.com"

VALID_CATEGORIES = [
    "Wildlife", "Snorkeling", "Beaches", "Sunsets", "Food", "Activities",
    "Day trips", "Planning", "Accommodation", "Family", "Culture", "Location",
    "Local tips", "Wellness", "Events", "Budget", "Romance", "Seasonal",
]

SYSTEM_PROMPT = """You are an SEO strategist for a Maui vacation rental website (thankheaven4711maui.com).
The property is O Thank Heaven 4 711 -- an oceanfront condo at Maui Sands Seaside, Lahaina, West Maui.

Your task: generate exactly 7 blog topic ideas for the upcoming week.
Each topic must:
- Target a keyword that is trending or seasonally relevant RIGHT NOW (use the current date provided)
- Be answerable from the perspective of a West Maui / Lahaina area oceanfront property
- Not duplicate any existing slugs in the queue or already published
- Have strong informational search intent (someone planning or on a Maui vacation)

Output ONLY a valid JSON array of exactly 7 objects, each with these fields:
  slug       -- URL-safe kebab-case, unique, 4-8 words
  title      -- headline for the post (title case, include year if seasonal)
  keyword    -- primary keyword phrase (2-5 words)
  category   -- MUST be one of: Wildlife, Snorkeling, Beaches, Sunsets, Food, Activities, Day trips, Planning, Accommodation, Family, Culture, Location, Local tips, Wellness, Events, Budget, Romance, Seasonal
  excerpt    -- 1-2 sentence summary for the blog card (under 160 chars)

No markdown fences, no explanation, just the raw JSON array."""


def load_existing(topics_file: Path) -> tuple[list, set]:
    """Return (all_topics_list, set_of_existing_slugs)."""
    if not topics_file.exists():
        return [], set()
    with open(topics_file, "r", encoding="utf-8") as f:
        topics = json.load(f)
    slugs = {t["slug"] for t in topics}
    return topics, slugs


def get_published_slugs() -> set:
    return {p.stem for p in BLOG_DIR.glob("*.html") if p.name != "index.html"}


def build_user_prompt(existing_slugs: set, published_slugs: set, today: date) -> str:
    all_slugs = existing_slugs | published_slugs
    month_name = today.strftime("%B")
    year = today.year
    # Rough season context for Hawaii
    if today.month in (11, 12, 1, 2, 3, 4, 5):
        season_note = "Whale season (Nov-May). Humpbacks active in AuAu Channel. Holiday travel peak Dec-Jan."
    elif today.month in (6, 7, 8):
        season_note = "Summer peak season. Families, calm ocean on south/west shores, snorkeling ideal."
    else:
        season_note = "Shoulder season (Sep-Oct). Fewer crowds, great deals, still warm and sunny."

    slug_list = "\n".join(sorted(all_slugs)) if all_slugs else "(none yet)"

    return f"""Today is {today.strftime('%B %d, %Y')} ({month_name} {year}).
Current season context: {season_note}

Already-used slugs (DO NOT duplicate any of these):
{slug_list}

Generate 7 fresh, trend-aware blog topics for this week's content calendar.
Prioritize topics that:
1. Align with what travelers search for in {month_name}
2. Can naturally reference the Lahaina / West Maui / Napili-Honokowai area
3. Have featured-snippet potential (how-to, best-of, what-to-expect formats)
4. Fill gaps not covered by existing slugs above

Output only the JSON array."""


def generate_topics(client: OpenAI, user_prompt: str) -> list:
    response = client.chat.completions.create(
        model="deepseek-chat",
        max_tokens=2048,
        temperature=0.9,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    )
    raw = response.choices[0].message.content.strip()
    # Strip markdown fences if the model added them despite instructions
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    if raw.endswith("```"):
        raw = raw[:-3].strip()
    return json.loads(raw)


def validate_topics(topics: list, existing_slugs: set, published_slugs: set) -> list:
    """Filter out invalid or duplicate topics; fix category if needed."""
    seen = set()
    valid = []
    all_existing = existing_slugs | published_slugs
    for t in topics:
        slug = t.get("slug", "").strip().lower().replace(" ", "-")
        if not slug or slug in all_existing or slug in seen:
            print(f"  Skipping duplicate/missing slug: {slug}", file=sys.stderr)
            continue
        if t.get("category") not in VALID_CATEGORIES:
            t["category"] = "Planning"
        seen.add(slug)
        t["slug"] = slug
        valid.append(t)
    return valid


def main():
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        print("ERROR: DEEPSEEK_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")
    today = date.today()

    existing_topics, existing_slugs = load_existing(TOPICS_FILE)
    published_slugs = get_published_slugs()

    print(f"Existing queue: {len(existing_topics)} topics, {len(published_slugs)} published posts")

    user_prompt = build_user_prompt(existing_slugs, published_slugs, today)

    print("Calling DeepSeek for 7 new topics...")
    raw_topics = generate_topics(client, user_prompt)
    print(f"Received {len(raw_topics)} raw topics")

    new_topics = validate_topics(raw_topics, existing_slugs, published_slugs)
    print(f"Validated {len(new_topics)} unique new topics")

    if not new_topics:
        print("No valid new topics generated -- keeping existing queue unchanged", file=sys.stderr)
        sys.exit(0)

    # Prepend new topics so they're picked up first by the daily poster
    updated = new_topics + existing_topics
    with open(TOPICS_FILE, "w", encoding="utf-8") as f:
        json.dump(updated, f, indent=2, ensure_ascii=False)

    print(f"topics.json updated: {len(new_topics)} new topics added to front of queue")
    for t in new_topics:
        print(f"  + {t['slug']} ({t['category']})")


if __name__ == "__main__":
    main()
