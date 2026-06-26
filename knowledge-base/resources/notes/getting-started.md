# Getting started with this knowledge base

<!-- tags: meta, workflow, onboarding -->
<!-- category: uncategorized -->

## Summary

How to capture and find the resources you use to build projects: documents (PDFs),
notes, reusable code snippets, and curated links.

## Details

This knowledge base holds four kinds of resources, all indexed into one searchable
catalog:

- **Documents** (`resources/docs/<category>/`) — PDFs, ebooks, specs, papers.
- **Notes** (`resources/notes/`) — markdown write-ups like this one.
- **Snippets** (`resources/snippets/`) — reusable code you copy into projects.
- **Links** (`resources/links.json`) — curated bookmarks with tags and notes.

### Daily workflow

```bash
# 1. Add a resource
#    - drop a PDF into resources/docs/<category>/
#    - write a note:    python scripts/add.py note "Title" --category backend
#    - bookmark a link: python scripts/add.py link "Title" https://... -c devops -t auth,oauth

# 2. Re-index everything
python scripts/build_catalog.py

# 3. Find things later
python scripts/search.py "rate limiting"
python scripts/search.py "oauth" --type link
python scripts/search.py "kubernetes" --type doc --full-text
```

## References

- [README](../../README.md)
