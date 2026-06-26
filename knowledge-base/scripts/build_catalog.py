#!/usr/bin/env python3
"""
build_catalog.py

Scan resources/ and build a single, searchable index across every kind of
resource you use to build projects:

  - documents  resources/docs/<category>/*.pdf|*.md|*.txt|*.epub
  - notes      resources/notes/**/*.md
  - snippets   resources/snippets/**/*  (any code file)
  - links      resources/links.json

Outputs:
  - index/index.json       structured search index (one record per resource)
  - index/text/<...>.txt    extracted plain text for documents (full-text search)
  - catalog.md              human-readable catalog grouped by type + category

Usage:
    python scripts/build_catalog.py
    python scripts/build_catalog.py --resources resources --out-dir index

Requires: pypdf (only needed if you index PDFs).  pip install -r requirements.txt
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# Characters of extracted text used to build the short summary.
SUMMARY_CHARS = 400
# How many extracted words to keep as lightweight keywords.
TAG_COUNT = 12
# Pages read per PDF for summary/keywords (keeps large docs fast).
PDF_PAGE_CAP = 30

DOC_EXTS = {".pdf", ".md", ".txt", ".epub", ".rst", ".docx"}
# Common source-code extensions treated as snippets.
SNIPPET_EXTS = {
    ".js", ".ts", ".jsx", ".tsx", ".py", ".rb", ".go", ".rs", ".java",
    ".c", ".h", ".cpp", ".cs", ".php", ".sh", ".bash", ".zsh", ".sql",
    ".html", ".css", ".scss", ".vue", ".svelte", ".yaml", ".yml", ".json",
    ".toml", ".tf", ".dockerfile", ".kt", ".swift", ".lua", ".pl", ".r",
}

STOPWORDS = {
    "the", "and", "for", "are", "but", "not", "you", "all", "any", "can",
    "her", "was", "one", "our", "out", "day", "get", "has", "him", "his",
    "how", "man", "new", "now", "old", "see", "two", "way", "who", "boy",
    "did", "its", "let", "put", "say", "she", "too", "use", "this", "that",
    "with", "from", "they", "have", "will", "your", "what", "when", "which",
    "their", "would", "there", "about", "into", "than", "then", "them",
    "these", "such", "also", "been", "were", "more", "some", "only", "other",
}


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def human_size(num_bytes: int) -> str:
    size = float(num_bytes)
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024 or unit == "GB":
            return f"{int(size)} {unit}" if unit == "B" else f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} GB"


def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def extract_keywords(text: str, limit: int = TAG_COUNT) -> list[str]:
    words = re.findall(r"[A-Za-z][A-Za-z0-9+#.\-]{2,}", (text or "").lower())
    freq: dict[str, int] = {}
    for w in words:
        if w in STOPWORDS or len(w) < 4:
            continue
        freq[w] = freq.get(w, 0) + 1
    ranked = sorted(freq.items(), key=lambda kv: (-kv[1], kv[0]))
    return [w for w, _ in ranked[:limit]]


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")


def new_record(rtype: str) -> dict:
    return {
        "id": "",
        "type": rtype,
        "title": "",
        "category": "uncategorized",
        "tags": [],
        "keywords": [],
        "summary": "",
        "location": "",   # file path (relative to repo) or URL
        "is_url": False,
        "size_human": "",
        "pages": 0,
        "error": "",
    }


# --------------------------------------------------------------------------- #
# Documents (PDF / md / txt / ...)
# --------------------------------------------------------------------------- #
def extract_pdf_text(path: Path) -> tuple[str, int, str, str]:
    """Return (full_text, pages, title, error). Never raises."""
    try:
        from pypdf import PdfReader
    except ImportError:
        return "", 0, "", "pypdf not installed (pip install -r requirements.txt)"
    try:
        reader = PdfReader(str(path))
        pages = len(reader.pages)
        meta = reader.metadata or {}
        title = clean_text(str(meta.title)) if getattr(meta, "title", None) else ""
        chunks = []
        for page in reader.pages[:PDF_PAGE_CAP]:
            try:
                chunks.append(page.extract_text() or "")
            except Exception:
                continue
        return clean_text(" ".join(chunks)), pages, title, ""
    except Exception as exc:
        return "", 0, "", f"{type(exc).__name__}: {exc}"


def index_document(path: Path) -> dict:
    rec = new_record("doc")
    rel = path.relative_to(REPO_ROOT)
    rec["location"] = str(rel)
    rec["category"] = path.parent.name
    rec["size_human"] = human_size(path.stat().st_size)
    rec["id"] = "doc:" + slugify(str(rel))

    full_text = ""
    ext = path.suffix.lower()
    if ext == ".pdf":
        full_text, pages, title, error = extract_pdf_text(path)
        rec["pages"] = pages
        rec["title"] = title
        rec["error"] = error
    elif ext in {".md", ".txt", ".rst"}:
        try:
            raw = path.read_text(encoding="utf-8", errors="ignore")
            full_text = clean_text(raw)
            m = re.search(r"^#\s+(.+)$", raw, re.MULTILINE)
            if m:
                rec["title"] = m.group(1).strip()
        except Exception as exc:
            rec["error"] = f"{type(exc).__name__}: {exc}"

    if not rec["title"]:
        rec["title"] = path.stem.replace("_", " ").replace("-", " ").strip()
    rec["summary"] = full_text[:SUMMARY_CHARS]
    rec["keywords"] = extract_keywords(full_text)
    rec["_full_text"] = full_text
    return rec


# --------------------------------------------------------------------------- #
# Notes (markdown)
# --------------------------------------------------------------------------- #
def parse_meta_comment(raw: str, key: str) -> str:
    m = re.search(rf"<!--\s*{key}\s*:\s*(.+?)\s*-->", raw, re.IGNORECASE)
    return m.group(1).strip() if m else ""


def index_note(path: Path) -> dict:
    rec = new_record("note")
    rel = path.relative_to(REPO_ROOT)
    rec["location"] = str(rel)
    rec["size_human"] = human_size(path.stat().st_size)
    rec["id"] = "note:" + slugify(str(rel))
    try:
        raw = path.read_text(encoding="utf-8", errors="ignore")
    except Exception as exc:
        rec["error"] = f"{type(exc).__name__}: {exc}"
        rec["title"] = path.stem
        return rec

    m = re.search(r"^#\s+(.+)$", raw, re.MULTILINE)
    rec["title"] = m.group(1).strip() if m else path.stem.replace("-", " ")

    tags = parse_meta_comment(raw, "tags")
    rec["tags"] = [t.strip() for t in re.split(r"[,\s]+", tags) if t.strip()] if tags else []
    rec["category"] = parse_meta_comment(raw, "category") or "uncategorized"

    # Summary: prefer the paragraph under a "## Summary" heading, else first
    # non-heading, non-comment paragraph.
    body = re.sub(r"<!--.*?-->", " ", raw, flags=re.DOTALL)
    sm = re.search(r"##\s+Summary\s*\n+(.+?)(\n#|\Z)", body, re.DOTALL | re.IGNORECASE)
    if sm:
        summary_src = sm.group(1)
    else:
        summary_src = re.sub(r"^#.*$", "", body, flags=re.MULTILINE)
    rec["summary"] = clean_text(summary_src)[:SUMMARY_CHARS]
    rec["keywords"] = extract_keywords(clean_text(body))
    rec["_full_text"] = clean_text(body)
    return rec


# --------------------------------------------------------------------------- #
# Snippets (code)
# --------------------------------------------------------------------------- #
def index_snippet(path: Path) -> dict:
    rec = new_record("snippet")
    rel = path.relative_to(REPO_ROOT)
    rec["location"] = str(rel)
    rec["size_human"] = human_size(path.stat().st_size)
    rec["id"] = "snippet:" + slugify(str(rel))
    rec["language"] = path.suffix.lstrip(".").lower() or "text"
    try:
        raw = path.read_text(encoding="utf-8", errors="ignore")
    except Exception as exc:
        rec["error"] = f"{type(exc).__name__}: {exc}"
        rec["title"] = path.stem
        return rec

    # Read leading comment lines for metadata (// key: val  or  # key: val).
    head = "\n".join(raw.splitlines()[:15])
    def grab(key: str) -> str:
        m = re.search(rf"(?://|#)\s*{key}\s*:\s*(.+)", head, re.IGNORECASE)
        return m.group(1).strip() if m else ""

    rec["title"] = grab("title") or path.stem.replace("-", " ").replace("_", " ")
    tags = grab("tags")
    rec["tags"] = [t.strip() for t in re.split(r"[,\s]+", tags) if t.strip()] if tags else []
    rec["category"] = grab("category") or (path.parent.name if path.parent.name != "snippets" else "uncategorized")
    rec["summary"] = clean_text(re.sub(r"(?://|#).*", "", raw))[:SUMMARY_CHARS]
    rec["keywords"] = extract_keywords(clean_text(raw))
    rec["_full_text"] = clean_text(raw)
    return rec


# --------------------------------------------------------------------------- #
# Links (links.json)
# --------------------------------------------------------------------------- #
def index_links(links_path: Path) -> list[dict]:
    if not links_path.exists():
        return []
    try:
        data = json.loads(links_path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"  WARN: could not parse {links_path.name}: {exc}")
        return []
    out = []
    for entry in data:
        rec = new_record("link")
        rec["title"] = (entry.get("title") or entry.get("url") or "").strip()
        rec["location"] = (entry.get("url") or "").strip()
        rec["is_url"] = True
        rec["category"] = (entry.get("category") or "uncategorized").strip()
        rec["tags"] = entry.get("tags") or []
        rec["summary"] = clean_text(entry.get("notes") or "")[:SUMMARY_CHARS]
        rec["keywords"] = rec["tags"][:TAG_COUNT]
        rec["id"] = "link:" + slugify(rec["location"] or rec["title"])
        out.append(rec)
    return out


# --------------------------------------------------------------------------- #
# Text extracts + catalog
# --------------------------------------------------------------------------- #
def write_text_extract(record: dict, text_dir: Path) -> None:
    full_text = record.pop("_full_text", "")
    if not full_text or record.get("is_url"):
        return
    rel = Path(record["location"]).with_suffix(".txt")
    parts = rel.parts[1:] if rel.parts and rel.parts[0] == "resources" else rel.parts
    out_path = text_dir.joinpath(*parts)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(full_text, encoding="utf-8")


TYPE_LABELS = {
    "doc": "Documents",
    "note": "Notes",
    "snippet": "Snippets",
    "link": "Links",
}
TYPE_ORDER = ["doc", "note", "snippet", "link"]


def build_catalog_md(records: list[dict], catalog_path: Path) -> None:
    total = len(records)
    errored = sum(1 for r in records if r["error"])
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    counts = {t: sum(1 for r in records if r["type"] == t) for t in TYPE_ORDER}

    lines: list[str] = []
    lines.append("# Knowledge Base Catalog")
    lines.append("")
    lines.append(f"_Generated: {generated}_")
    lines.append("")
    summary_bits = [f"{counts[t]} {TYPE_LABELS[t].lower()}" for t in TYPE_ORDER if counts[t]]
    lines.append(f"**{total} resources** — " + (", ".join(summary_bits) if summary_bits else "none yet") + ".")
    if errored:
        lines.append("")
        lines.append(f"> {errored} document(s) could not be fully read (encrypted or scanned image PDFs).")
    lines.append("")

    for rtype in TYPE_ORDER:
        group = [r for r in records if r["type"] == rtype]
        if not group:
            continue
        lines.append(f"## {TYPE_LABELS[rtype]} ({len(group)})")
        lines.append("")
        by_cat: dict[str, list[dict]] = {}
        for r in group:
            by_cat.setdefault(r["category"] or "uncategorized", []).append(r)

        for cat in sorted(by_cat):
            lines.append(f"### {cat}")
            lines.append("")
            if rtype == "link":
                lines.append("| Title | Tags | URL |")
                lines.append("| --- | --- | --- |")
                for r in sorted(by_cat[cat], key=lambda x: x["title"].lower()):
                    tags = ", ".join(r["tags"][:6])
                    lines.append(f"| {r['title']} | {tags} | [{r['location']}]({r['location']}) |")
            elif rtype == "doc":
                lines.append("| Title | Pages | Size | Keywords | File |")
                lines.append("| --- | --- | --- | --- | --- |")
                for r in sorted(by_cat[cat], key=lambda x: x["title"].lower()):
                    note = " (unreadable)" if r["error"] else ""
                    kw = ", ".join(r["keywords"][:6])
                    link = r["location"].replace(" ", "%20")
                    name = Path(r["location"]).name
                    lines.append(f"| {r['title']}{note} | {r['pages'] or '-'} | {r['size_human']} | {kw} | [{name}]({link}) |")
            else:  # note / snippet
                extra = "Language" if rtype == "snippet" else "Tags"
                lines.append(f"| Title | {extra} | Summary | File |")
                lines.append("| --- | --- | --- | --- |")
                for r in sorted(by_cat[cat], key=lambda x: x["title"].lower()):
                    col = r.get("language", "") if rtype == "snippet" else ", ".join(r["tags"][:5])
                    summ = (r["summary"][:80] + "...") if len(r["summary"]) > 80 else r["summary"]
                    link = r["location"].replace(" ", "%20")
                    name = Path(r["location"]).name
                    lines.append(f"| {r['title']} | {col} | {summ} | [{name}]({link}) |")
            lines.append("")

    catalog_path.write_text("\n".join(lines), encoding="utf-8")


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #
def main() -> int:
    parser = argparse.ArgumentParser(description="Build the unified knowledge base catalog + index.")
    parser.add_argument("--resources", default="resources", help="Resources directory (default: resources)")
    parser.add_argument("--out-dir", default="index", help="Index output directory (default: index)")
    parser.add_argument("--catalog", default="catalog.md", help="Catalog markdown output (default: catalog.md)")
    args = parser.parse_args()

    res_dir = (REPO_ROOT / args.resources).resolve()
    out_dir = (REPO_ROOT / args.out_dir).resolve()
    text_dir = out_dir / "text"
    catalog_path = (REPO_ROOT / args.catalog).resolve()

    if not res_dir.exists():
        sys.exit(f"Resources directory not found: {res_dir}")

    out_dir.mkdir(parents=True, exist_ok=True)
    text_dir.mkdir(parents=True, exist_ok=True)

    records: list[dict] = []

    # Documents
    docs_dir = res_dir / "docs"
    if docs_dir.exists():
        doc_paths = sorted(p for p in docs_dir.rglob("*") if p.is_file() and p.suffix.lower() in DOC_EXTS)
        if doc_paths:
            print(f"Indexing {len(doc_paths)} document(s) ...")
        for i, path in enumerate(doc_paths, 1):
            rec = index_document(path)
            write_text_extract(rec, text_dir)
            records.append(rec)
            status = "ERR" if rec["error"] else "ok "
            print(f"  [doc {i:>3}] {status} {rec['location']}")

    # Notes
    notes_dir = res_dir / "notes"
    if notes_dir.exists():
        note_paths = sorted(p for p in notes_dir.rglob("*.md") if p.is_file())
        if note_paths:
            print(f"Indexing {len(note_paths)} note(s) ...")
        for path in note_paths:
            rec = index_note(path)
            write_text_extract(rec, text_dir)
            records.append(rec)
            print(f"  [note]    ok  {rec['location']}")

    # Snippets
    snippets_dir = res_dir / "snippets"
    if snippets_dir.exists():
        snip_paths = sorted(
            p for p in snippets_dir.rglob("*")
            if p.is_file() and (p.suffix.lower() in SNIPPET_EXTS or p.name.lower() == "dockerfile")
        )
        if snip_paths:
            print(f"Indexing {len(snip_paths)} snippet(s) ...")
        for path in snip_paths:
            rec = index_snippet(path)
            write_text_extract(rec, text_dir)
            records.append(rec)
            print(f"  [snippet] ok  {rec['location']}")

    # Links
    links_path = res_dir / "links.json"
    link_records = index_links(links_path)
    if link_records:
        print(f"Indexing {len(link_records)} link(s) ...")
    records.extend(link_records)

    index_path = out_dir / "index.json"
    index_path.write_text(json.dumps(records, indent=2, ensure_ascii=False), encoding="utf-8")
    build_catalog_md(records, catalog_path)

    errored = sum(1 for r in records if r["error"])
    counts = {t: sum(1 for r in records if r["type"] == t) for t in TYPE_ORDER}
    print()
    print(f"Done. {len(records)} resource(s) indexed "
          f"(docs={counts['doc']}, notes={counts['note']}, snippets={counts['snippet']}, links={counts['link']}; "
          f"{errored} unreadable).")
    print(f"  - Index:   {index_path.relative_to(REPO_ROOT)}")
    print(f"  - Catalog: {catalog_path.relative_to(REPO_ROOT)}")
    print(f"  - Text:    {text_dir.relative_to(REPO_ROOT)}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
