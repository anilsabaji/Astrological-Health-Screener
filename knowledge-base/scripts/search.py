#!/usr/bin/env python3
"""
search.py

Search the knowledge base built by build_catalog.py across every resource type:
documents, notes, snippets, and links.

Searches title, tags, keywords, category, type, summary and (optionally) the full
extracted text in index/text/.

Usage:
    python scripts/search.py "rate limiting"
    python scripts/search.py "oauth" --type link
    python scripts/search.py "kubernetes" --category devops
    python scripts/search.py "retry" --type snippet
    python scripts/search.py "graphql" --full-text
    python scripts/search.py "auth" --limit 5

Build the index first:  python scripts/build_catalog.py
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
INDEX_PATH = REPO_ROOT / "index" / "index.json"
TEXT_DIR = REPO_ROOT / "index" / "text"

VALID_TYPES = {"doc", "note", "snippet", "link"}


def load_index() -> list[dict]:
    if not INDEX_PATH.exists():
        sys.exit(
            f"Index not found at {INDEX_PATH}.\n"
            "Build it first with:  python scripts/build_catalog.py"
        )
    try:
        return json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        sys.exit(f"Could not parse index.json: {exc}")


def text_path_for(record: dict) -> Path | None:
    if record.get("is_url"):
        return None
    rel = Path(record["location"]).with_suffix(".txt")
    parts = rel.parts[1:] if rel.parts and rel.parts[0] == "resources" else rel.parts
    return TEXT_DIR.joinpath(*parts)


def score(record: dict, terms: list[str], use_full_text: bool) -> int:
    title = (record.get("title") or "").lower()
    location = (record.get("location") or "").lower()
    category = (record.get("category") or "").lower()
    rtype = (record.get("type") or "").lower()
    tags = " ".join(record.get("tags", [])).lower()
    keywords = " ".join(record.get("keywords", [])).lower()
    summary = (record.get("summary") or "").lower()

    body = ""
    if use_full_text:
        tp = text_path_for(record)
        if tp and tp.exists():
            body = tp.read_text(encoding="utf-8", errors="ignore").lower()

    total = 0
    for term in terms:
        if term in title:
            total += 10
        if term in tags:
            total += 7
        if term in location:
            total += 6
        if term in keywords:
            total += 5
        if term in category:
            total += 4
        if term == rtype:
            total += 4
        if term in summary:
            total += 2
        if use_full_text and term in body:
            total += 1
    return total


def main() -> int:
    parser = argparse.ArgumentParser(description="Search the knowledge base.")
    parser.add_argument("query", nargs="+", help="Search term(s)")
    parser.add_argument("--type", "-t", choices=sorted(VALID_TYPES),
                        help="Limit to a resource type (doc, note, snippet, link)")
    parser.add_argument("--category", "-c", help="Limit to a category (folder name)")
    parser.add_argument("--full-text", "-f", action="store_true",
                        help="Also search inside extracted full text (slower)")
    parser.add_argument("--limit", "-n", type=int, default=10, help="Max results (default: 10)")
    args = parser.parse_args()

    terms = [t.lower() for t in args.query]
    records = load_index()

    if args.type:
        records = [r for r in records if r.get("type") == args.type]
    if args.category:
        records = [r for r in records if (r.get("category") or "").lower() == args.category.lower()]

    scored = []
    for r in records:
        s = score(r, terms, args.full_text)
        if s > 0:
            scored.append((s, r))

    scored.sort(key=lambda sr: (-sr[0], sr[1].get("title", "").lower()))

    if not scored:
        print(f"No matches for {' '.join(args.query)!r}"
              + (f" [type={args.type}]" if args.type else "")
              + (f" [category={args.category}]" if args.category else ""))
        if not args.full_text:
            print("Tip: add --full-text to search inside document/note/snippet contents.")
        return 0

    icon = {"doc": "DOC", "note": "NOTE", "snippet": "CODE", "link": "LINK"}
    print(f"\nTop {min(args.limit, len(scored))} result(s) for {' '.join(args.query)!r}:\n")
    for s, r in scored[:args.limit]:
        title = r.get("title") or r.get("location")
        tag = icon.get(r.get("type"), "?")
        print(f"  [{s:>3}] ({tag}) {title}")
        meta = f"        category: {r.get('category')}"
        if r.get("type") == "doc":
            meta += f"  |  pages: {r.get('pages') or '-'}  |  {r.get('size_human')}"
        elif r.get("type") == "snippet":
            meta += f"  |  language: {r.get('language', '-')}"
        print(meta)
        if r.get("tags"):
            print(f"        tags: {', '.join(r['tags'][:8])}")
        elif r.get("keywords"):
            print(f"        keywords: {', '.join(r['keywords'][:6])}")
        print(f"        location: {r.get('location')}")
        print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
