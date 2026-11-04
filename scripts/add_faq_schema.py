#!/usr/bin/env python3
"""
Batch FAQ schema retrofitter for thankheaven4711maui.com
Adds a 5-Q&A FAQ section + FAQPage JSON-LD to every existing blog post
that does not already have one.

Usage:
  python scripts/add_faq_schema.py               # process all remaining posts
  python scripts/add_faq_schema.py --limit 10    # process at most 10 this run
  python scripts/add_faq_schema.py --dry-run     # show what would be done, no writes

Checkpoint: blog/.faq_progress.json tracks completed slugs so the script
is safe to interrupt and resume.
"""

import argparse
import json
import os
import re
import sys
import time
from datetime import date
from pathlib import Path

from openai import OpenAI

REPO_ROOT = Path(__file__).parent.parent
BLOG_DIR = REPO_ROOT / "blog"
CHECKPOINT_FILE = BLOG_DIR / ".faq_progress.json"

FAQ_CSS = (
    "<style>"
    ".blog-faq{margin:2.5rem 0;}"
    ".blog-faq h2{font-size:1.3rem;margin-bottom:1rem;color:#0C3D5C;}"
    ".blog-faq__item{border-bottom:1px solid #e0e8f0;padding:.75rem 0;}"
    ".blog-faq__q{font-size:1rem;font-weight:600;color:#0C3D5C;cursor:pointer;list-style:none;}"
    ".blog-faq__q::-webkit-details-marker{display:none;}"
    ".blog-faq__a{margin-top:.5rem;color:#4a6070;line-height:1.65;}"
    "</style>"
)

FAQ_SYSTEM_PROMPT = """You are an SEO expert generating FAQ content for a Maui vacation rental blog.
Given the blog post title and body, produce exactly 5 question-and-answer pairs that:
- A real traveler would search for about this topic
- Are concise (answers 2-4 sentences)
- Naturally relate to the specific post content
- Could win a Google featured snippet for question-based searches
- Naturally reference West Maui / Lahaina area where relevant

Output ONLY a valid JSON array of exactly 5 objects, each with:
  "q": "The question?"
  "a": "The answer."

No markdown, no explanation, just the raw JSON array."""


def load_checkpoint() -> set:
    if CHECKPOINT_FILE.exists():
        with open(CHECKPOINT_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return set(data.get("done", []))
    return set()


def save_checkpoint(done: set) -> None:
    with open(CHECKPOINT_FILE, "w", encoding="utf-8") as f:
        json.dump({"done": sorted(done)}, f, indent=2)


def get_all_posts() -> list[Path]:
    return sorted(
        p for p in BLOG_DIR.glob("*.html")
        if p.name != "index.html"
    )


def already_has_faq(content: str) -> bool:
    return "FAQPage" in content or "blog-faq" in content


def extract_text(content: str) -> str:
    """Pull readable text from .blog-body for the AI prompt."""
    body_m = re.search(
        r'class="blog-body"[^>]*>(.*?)</(?:div|article|section)\s*>',
        content, re.DOTALL
    )
    raw = body_m.group(1) if body_m else content
    # Strip all HTML tags
    text = re.sub(r"<[^>]+>", " ", raw)
    # Collapse whitespace
    text = re.sub(r"\s{2,}", " ", text).strip()
    # Limit to ~3000 chars to keep the API call cheap
    return text[:3000]


def extract_title(content: str) -> str:
    m = re.search(r"<title>([^<]+)</title>", content)
    if m:
        # Strip the " | O Thank Heaven 4 711" suffix
        return m.group(1).split(" | ")[0].strip()
    return ""


def generate_faq(client: OpenAI, title: str, body_text: str) -> list[dict]:
    user_prompt = f"""Blog post title: {title}

Body excerpt:
{body_text}

Generate 5 FAQ pairs for this post."""

    response = client.chat.completions.create(
        model="deepseek-chat",
        max_tokens=1024,
        temperature=0.7,
        messages=[
            {"role": "system", "content": FAQ_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    )
    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    if raw.endswith("```"):
        raw = raw[:-3].strip()
    return json.loads(raw)


def build_faq_html(pairs: list[dict]) -> str:
    items = "\n".join(
        f'    <div class="blog-faq__item">'
        f'<details>'
        f'<summary class="blog-faq__q">{p["q"]}</summary>'
        f'<p class="blog-faq__a">{p["a"]}</p>'
        f'</details>'
        f'</div>'
        for p in pairs
    )
    return (
        '\n<section class="blog-faq">\n'
        '  <h2>Frequently Asked Questions</h2>\n'
        f'{items}\n'
        '</section>\n'
    )


def build_faq_jsonld(pairs: list[dict]) -> str:
    entities = [
        {
            "@type": "Question",
            "name": p["q"],
            "acceptedAnswer": {"@type": "Answer", "text": p["a"]},
        }
        for p in pairs
    ]
    schema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": entities,
    }
    return (
        '\n<script type="application/ld+json">\n'
        + json.dumps(schema, indent=2, ensure_ascii=False)
        + '\n</script>'
    )


def inject_into_post(content: str, pairs: list[dict], today: str) -> str:
    # 1. Add inline CSS before </head> if not already there
    if ".blog-faq" not in content:
        content = content.replace("</head>", FAQ_CSS + "\n</head>", 1)

    # 2. Inject FAQPage JSON-LD after the BlogPosting closing </script> in <head>
    # Find the closing tag of the BlogPosting block (first ld+json block)
    jsonld_close = content.find("</script>", content.find('application/ld+json'))
    if jsonld_close != -1:
        insert_pos = jsonld_close + len("</script>")
        faq_jsonld = build_faq_jsonld(pairs)
        content = content[:insert_pos] + faq_jsonld + content[insert_pos:]

    # 3. Update dateModified to today
    content = re.sub(
        r'"dateModified":\s*"\d{4}-\d{2}-\d{2}"',
        f'"dateModified": "{today}"',
        content,
        count=1,
    )

    # 4. Inject FAQ HTML section before .blog-related
    faq_html = build_faq_html(pairs)
    # Try both div and section variants
    for marker in ('<div class="blog-related">', '<section class="blog-related">'):
        if marker in content:
            content = content.replace(marker, faq_html + marker, 1)
            break

    return content


def process_post(
    post_path: Path,
    client: OpenAI,
    dry_run: bool,
    today: str,
) -> bool:
    """Return True on success, False on skippable error."""
    slug = post_path.stem
    content = post_path.read_text(encoding="utf-8")

    if already_has_faq(content):
        print(f"  [skip] {slug} -- already has FAQ")
        return True

    title = extract_title(content)
    body_text = extract_text(content)

    if not title or len(body_text) < 100:
        print(f"  [skip] {slug} -- could not extract title/body", file=sys.stderr)
        return False

    print(f"  [gen]  {slug} -- \"{title}\"")

    if dry_run:
        print(f"         (dry-run -- would call DeepSeek)")
        return True

    for attempt in range(2):
        try:
            pairs = generate_faq(client, title, body_text)
            if len(pairs) < 3:
                raise ValueError(f"Only {len(pairs)} pairs returned")
            break
        except Exception as exc:
            if attempt == 0:
                print(f"         Retry after error: {exc}", file=sys.stderr)
                time.sleep(3)
            else:
                print(f"         Failed -- skipping: {exc}", file=sys.stderr)
                return False

    updated = inject_into_post(content, pairs[:5], today)
    post_path.write_text(updated, encoding="utf-8")
    print(f"         Done -- {len(pairs)} Q&As injected")
    return True


def main():
    parser = argparse.ArgumentParser(description="Retrofit FAQ schema to existing blog posts")
    parser.add_argument("--limit", type=int, default=0, help="Max posts to process (0 = all)")
    parser.add_argument("--dry-run", action="store_true", help="No file writes")
    parser.add_argument("--slug", help="Process only this specific slug")
    args = parser.parse_args()

    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        print("ERROR: DEEPSEEK_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")
    today = date.today().isoformat()
    done = load_checkpoint()

    posts = get_all_posts()
    if args.slug:
        posts = [p for p in posts if p.stem == args.slug]

    remaining = [p for p in posts if p.stem not in done]
    to_process = remaining[: args.limit] if args.limit else remaining

    total = len(posts)
    already_done = len(done)
    print(
        f"Blog posts: {total} total, {already_done} already done, "
        f"{len(remaining)} remaining, processing {len(to_process)} this run"
    )

    if not to_process:
        print("Nothing to do.")
        return

    processed = 0
    failed = 0
    for post_path in to_process:
        slug = post_path.stem
        ok = process_post(post_path, client, args.dry_run, today)
        if ok:
            if not args.dry_run:
                done.add(slug)
                save_checkpoint(done)
            processed += 1
        else:
            failed += 1

    print(f"\nDone: {processed} updated, {failed} failed/skipped")
    if remaining[len(to_process):]:
        print(f"Run again to process {len(remaining) - len(to_process)} more posts.")


if __name__ == "__main__":
    main()
