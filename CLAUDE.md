# Instructions for AI sessions

This repo is a private story bible for the author's books. The author's manuscripts (Markdown or `.docx`), and optionally a planning sheet and supplementary posts, live in `source/`. `tools/extract.mjs` normalizes them into `text/`. AI sessions turn that text into structured data in `data/`. A plain build script turns the data into a web app in `app/`. The author's plans live in `planning/`, and they are **not** a source. See [README.md](README.md) for the overview and [docs/PROJECT.md](docs/PROJECT.md) for what is particular about these books.

## When the author wants to set up the repo
"Set up this repo", "configure it for my book", "I've uploaded my manuscript": follow the checklist in [docs/SETUP.md](docs/SETUP.md) under *For Claude: guided setup*. Ask for anything you can't find out from the files.

## When the author wants to discuss the story
For questions, brainstorming or planning (no change requested), use the `query` skill ([.claude/skills/query/SKILL.md](.claude/skills/query/SKILL.md)). It is read-only.

## Before you touch `data/`
Read [docs/DATA_MODEL.md](docs/DATA_MODEL.md), [docs/PARSING_GUIDE.md](docs/PARSING_GUIDE.md) and [docs/PROJECT.md](docs/PROJECT.md).

## When the author says "first parse" / "reparse" / "update the DB" / "sync"
Follow [docs/UPDATE_WORKFLOW.md](docs/UPDATE_WORKFLOW.md) step by step (the *First parse* when `data/meta.json` has no `lastParsedCommit`), and finish with the short report it describes.

## Accuracy comes first
Accuracy beats completeness, speed and nice prose. Everything in the DB must be real and traceable.
- **If it isn't written in `source/`, it isn't in the DB.** Unknown fields stay `null` or empty. Never guess, never fill gaps with genre, period or general knowledge (nor from mythology, history or other books the story draws on), and never say more than the quote says.
- **No plans.** Never fill gaps from `planning/` or from the future-plan parts of the sheet. Plans say what *might* be written; the DB says what *is*.
- **Every statement has a source**: the file (a book key such as `book1`, `sheet`, or a post such as `post-world-guide`), the chapter or sheet row, and a verbatim quote. This applies to facts, appearances, profile values, dates, and every sentence of a summary, synopsis or arc.
- **Mark interpretation.** Use `basis: "implied"` for things shown but not said, and `basis: "claim"` for things a character asserts (every lie is a claim). `basis: "inferred"` is only for date or number arithmetic from quoted cues.
- **Verify every extraction** with a separate audit-and-sweep pass (UPDATE_WORKFLOW step 4). Verify synthesis against its refs. Never make a quote check pass by loosening it.
- **Be exhaustive about concrete details**, within those limits: appearance, every described outfit, tastes, habits, mannerisms, backstory, relationships, who knows what, every lie, dates and numbers.
- When unsure whether the text says something, leave it out and flag it as `unclear` for the author.
- **Contradictions are always surfaced and never resolved.** No source has precedence over another. When sources disagree, store every version (a disputed value) and add an entry to `data/contradictions.json`. Never pick a side, explain it away, or assume it's intentional.
- **Plot threads** are opened, developed and resolved only with quoted passages.

## Other hard rules
- **Never edit `source/` or `planning/`** unless the author explicitly asks for that specific edit. Writing or revising the books is a separate request from the author, not something a parse or a query does.
- **Read and quote from `text/`, never from `source/` directly.** Regenerate it with `node tools/extract.mjs`, and never hand-edit `text/`.
- **Never hand-edit `app/db.js`, `app/text.js` or `app/manifest.webmanifest`.** Run `node tools/build.mjs`. A commit that touches `data/` must leave the build green.
- **Never overwrite author-owned fields**: `notes`, `images` and `media/`, plus contradiction statuses `intended` and `not-an-issue`, every contradiction `authorComment`, and a thread's `authorStatus` and `authorComment`. Never delete contradictions.
- **Regenerate chapter files whole.** Never patch a chapter file from a diff hunk. Re-read the full chapter.
- **Keep IDs stable.** Renames change `name`/`aliases`, never `id`. Never rename a `config.json` file key once its book has been parsed.
- **Data commits are separate from source and plan commits**, and their message starts with `db:`.
- Ask the author before deleting any registry, merging entities in a non-obvious case, or deciding something listed under *Open questions* in [docs/PROJECT.md](docs/PROJECT.md). Record the author's decisions there.

## App and code conventions
- `app/` is a vanilla HTML, CSS and JS installable web app (PWA), mobile-first and also good on desktop. It must also work from `file://`, which means classic `<script>` tags (no ES modules, no `fetch` for data), with data loaded through `app/db.js` (`window.DB`) and chapter text through `app/text.js` (`window.DB_TEXT`, injected only when the reader or the manuscript search needs it). Only `app/` is ever deployed, never `source/`, `text/` or `planning/`, but `app/text.js` carries the chapter text, so the site must stay behind Cloudflare Access ([docs/HOSTING.md](docs/HOSTING.md)). Code lives in `app/js/` (core helpers, UI primitives, views, search, reader, router). Reader-knowledge mode must hide anything with a later source, including filter options and free-text navigation labels.
- The app's name and texts come from `config.json` `project`, never hard-coded.
- `tools/` scripts are Node (18 or later) with **no npm dependencies**. `tools/lib.mjs` holds the shared config and chapter-structure helpers. `tools/query.mjs` is a read-only search over `app/db.js` and `text/`.
- Images are resolved by filename from `media/<type>/<id>.<ext>`. See [media/README.md](media/README.md).

## Status
Template state: nothing uploaded or parsed yet (`data/meta.json` has no `lastParsedCommit`). **Next:** the author follows [docs/SETUP.md](docs/SETUP.md): configure `config.json`, upload the manuscript, then ask for the first parse. Update this section as the project moves on (for example "Book 1 parsed; hosting set up").
