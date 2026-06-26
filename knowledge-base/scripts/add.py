#!/usr/bin/env python3
"""
add.py

Quickly add a resource to the knowledge base without hand-editing files.

  - Add a link (appended to resources/links.json):
        python scripts/add.py link "MDN" https://developer.mozilla.org \
            --category frontend --tags reference,web

  - Scaffold a new note from the template (resources/notes/<slug>.md):
        python scripts/add.py note "Rate limiting strategies" \
            --category backend --tags api,resilience

After adding, re-index with:  python scripts/build_catalog.py
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
LINKS_PATH = REPO_ROOT / "resources" / "links.json"
NOTES_DIR = REPO_ROOT / "resources" / "notes"
TEMPLATE_PATH = REPO_ROOT / "resources" / "templates" / "note-template.md"

VALID_CATEGORIES_HINT = "frontend, backend, devops, data-ml, uncategorized (or any folder you like)"


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-") or "untitled"


def parse_tags(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [t.strip() for t in re.split(r"[,\s]+", raw) if t.strip()]


def add_link(args) -> int:
    links = []
    if LINKS_PATH.exists():
        try:
            links = json.loads(LINKS_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            sys.exit(f"Could not parse {LINKS_PATH}: {exc}")

    if any((l.get("url") or "").strip() == args.url.strip() for l in links):
        print(f"Link already exists: {args.url}")
        return 0

    entry = {
        "title": args.title,
        "url": args.url,
        "category": args.category,
        "tags": parse_tags(args.tags),
        "notes": args.notes or "",
    }
    links.append(entry)
    LINKS_PATH.parent.mkdir(parents=True, exist_ok=True)
    LINKS_PATH.write_text(json.dumps(links, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Added link '{args.title}' -> {LINKS_PATH.relative_to(REPO_ROOT)}")
    print("Re-index with:  python scripts/build_catalog.py")
    return 0


def add_note(args) -> int:
    NOTES_DIR.mkdir(parents=True, exist_ok=True)
    slug = slugify(args.title)
    out_path = NOTES_DIR / f"{slug}.md"
    if out_path.exists():
        sys.exit(f"Note already exists: {out_path.relative_to(REPO_ROOT)}")

    tags = ", ".join(parse_tags(args.tags))
    if TEMPLATE_PATH.exists():
        content = TEMPLATE_PATH.read_text(encoding="utf-8")
        content = re.sub(r"^#\s+.*$", f"# {args.title}", content, count=1, flags=re.MULTILINE)
        content = re.sub(r"<!--\s*tags:.*?-->", f"<!-- tags: {tags} -->", content, count=1)
        content = re.sub(r"<!--\s*category:.*?-->", f"<!-- category: {args.category} -->", content, count=1)
    else:
        content = (
            f"# {args.title}\n\n"
            f"<!-- tags: {tags} -->\n"
            f"<!-- category: {args.category} -->\n\n"
            "## Summary\n\n\n\n## Details\n\n\n"
        )
    out_path.write_text(content, encoding="utf-8")
    print(f"Created note -> {out_path.relative_to(REPO_ROOT)}")
    print("Edit it, then re-index with:  python scripts/build_catalog.py")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Add a resource to the knowledge base.")
    sub = parser.add_subparsers(dest="kind", required=True)

    p_link = sub.add_parser("link", help="Add a bookmark/link")
    p_link.add_argument("title", help="Link title")
    p_link.add_argument("url", help="URL")
    p_link.add_argument("--category", "-c", default="uncategorized", help=VALID_CATEGORIES_HINT)
    p_link.add_argument("--tags", "-t", help="Comma/space separated tags")
    p_link.add_argument("--notes", "-n", help="Short description")
    p_link.set_defaults(func=add_link)

    p_note = sub.add_parser("note", help="Scaffold a new markdown note")
    p_note.add_argument("title", help="Note title")
    p_note.add_argument("--category", "-c", default="uncategorized", help=VALID_CATEGORIES_HINT)
    p_note.add_argument("--tags", "-t", help="Comma/space separated tags")
    p_note.set_defaults(func=add_note)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
