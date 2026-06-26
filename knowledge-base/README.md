# Knowledge Base

A personal, version-controlled knowledge base for **everything you use to build
projects** — reference documents (PDFs), notes, reusable code snippets, and
curated links. Capture a resource, run one script, and get a searchable catalog.

## What it holds

| Type | Where | Example |
| --- | --- | --- |
| **Documents** | `resources/docs/<category>/` | PDFs, ebooks, specs, papers |
| **Notes** | `resources/notes/` | Markdown write-ups, cheat sheets |
| **Snippets** | `resources/snippets/` | Reusable code you copy into projects |
| **Links** | `resources/links.json` | Curated bookmarks with tags + notes |

Everything is indexed into one place:

- `index/index.json` — structured search index (one record per resource).
- `index/text/` — extracted plain text per document (for full-text search).
- `catalog.md` — human-readable catalog grouped by type and category.

```
knowledge-base/
├── README.md
├── catalog.md            # GENERATED human-readable catalog
├── requirements.txt      # Python deps (pypdf, for PDFs)
├── .gitattributes        # Git LFS rules for *.pdf / *.epub / *.docx
├── resources/
│   ├── docs/             # documents, in category subfolders
│   │   ├── frontend/  backend/  devops/  data-ml/  uncategorized/
│   ├── notes/            # markdown notes
│   ├── snippets/         # reusable code
│   ├── templates/        # note-template.md
│   └── links.json        # curated links
├── index/                # GENERATED index (index.json + text/)
└── scripts/
    ├── build_catalog.py  # build/refresh the unified index + catalog
    ├── search.py         # search across all resource types
    └── add.py            # quick-add a link or scaffold a note
```

## One-time setup

```bash
# Git LFS keeps binary docs (PDFs) out of regular git history.
#   macOS:         brew install git-lfs
#   Ubuntu/Debian: sudo apt-get install git-lfs
git lfs install

# Python dependency, only needed to index PDFs.
pip install -r requirements.txt
```

`.gitattributes` already routes `*.pdf`, `*.epub`, and `*.docx` through LFS.

## Workflow

### 1. Add a resource

```bash
# A document: just drop the file into a category folder
cp ~/Downloads/postgres-internals.pdf resources/docs/backend/

# A link (appended to links.json, de-duplicated by URL)
python scripts/add.py link "MDN" https://developer.mozilla.org -c frontend -t reference,web

# A note (scaffolds resources/notes/<slug>.md from the template)
python scripts/add.py note "Rate limiting strategies" -c backend -t api,resilience

# A snippet: add a code file under resources/snippets/ with a metadata header
#   // title: my helper
#   // tags: js, util
#   // category: frontend
```

### 2. Re-index

```bash
python scripts/build_catalog.py
```

Regenerates `catalog.md`, `index/index.json`, and the text extracts. Re-run it
any time you add, remove, or reorganize resources.

### 3. Find things later

```bash
python scripts/search.py "rate limiting"
python scripts/search.py "oauth" --type link
python scripts/search.py "kubernetes" --type doc --full-text
python scripts/search.py "retry" --type snippet
python scripts/search.py "auth" --category backend --limit 5
```

`--type` is one of `doc`, `note`, `snippet`, `link`. `--full-text` also searches
inside extracted document/note/snippet contents (slower, more thorough).

### Browse

Open `catalog.md` for a table of every resource, grouped by type and category.

## Uploading to GitHub

```bash
git lfs install                  # before adding any PDFs
git add .gitattributes
git add resources/ scripts/ *.md requirements.txt .gitignore
git commit -m "Add resources"
git push
git lfs ls-files                 # verify binaries are tracked by LFS
```

## Notes & limits

- **Scanned / image-only PDFs** have no embedded text, so keywords can't be
  extracted (they're still cataloged, marked unreadable). Run OCR
  (e.g. `ocrmypdf`) first to make them searchable.
- **Encrypted PDFs** are cataloged but not text-extracted.
- The indexer reads up to the first 30 pages of each PDF for summaries/keywords
  to stay fast. Tune `PDF_PAGE_CAP` / `SUMMARY_CHARS` in `scripts/build_catalog.py`.
- `index/text/` is git-ignored by default. Remove that line from `.gitignore` if
  you want clones to get full-text search without rebuilding.
