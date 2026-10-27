# Design

Why the system works the way it does. Project-specific decisions (about *your* books) go in [PROJECT.md](PROJECT.md), not here.

## Goals

- **Accuracy above all.** Everything shown is real and comes from the manuscript (or the planning sheet, or a post). Nothing is guessed or filled in. Anything the sources don't mention shows as *Not mentioned*. Every statement shows where it came from: book and file, chapter, and the quote.
- **Contradictions are always surfaced, never resolved.** When two passages (or the text and the sheet) disagree, the app shows both with their sources and lists the disagreement on a dedicated page. Nothing is decided on the author's behalf.
- Browse everything written about a character, place or event, with a **citation for every fact**.
- A **timeline** of in-world events, plus the chapter each one happens in.
- **Character pages**: profile, appearance, outfits worn (chapter by chapter), tastes, habits and mannerisms, backstory, personality, relationships, who knows what, lies told, status, the chapters they appear in (on-page or only mentioned), the events they take part in, and their arc per book.
- **Event pages**: date(s), chapters, places, who was there, synopsis, sub-events, causes and consequences.
- **Place pages**: description facts, parent and child places, the events that happen there, and who has been there.
- **Plot threads**: open mysteries, promises and setups that are still unresolved.
- **Reader-knowledge mode**: see only what a reader knows as of a chosen chapter.
- The app opens on **phone and PC** by visiting a private link, with no download.
- The database is updated only when the author asks, and incrementally from the git diff.

## Non-goals

- Live sync with the manuscript, and a backend or database server.
- Editing story data in the browser. The only manual inputs are images (by filename) and the author-owned fields (`notes`, contradiction status and comments, a thread's author status and comment).
- A deterministic NLP parser. Reading the text is the AI's job. Scripts only convert, validate and bundle.
- Plans. Outlines, beat sheets and the future-plan parts of a planning sheet are never parsed. They can be discussed with the `query` skill, labelled as plans.

## Key decisions

### 1. Manuscripts in, normalized mirror for everything else

The author uploads each book as Markdown (including the Google Docs Markdown export) or `.docx` (Word, and the Word export of most other writing programs). Plain text and PDF are not accepted, because they lose italics, which in fiction often mark inner thoughts.

- `node tools/extract.mjs` normalizes each file into `text/<book>.md`: one paragraph per line, `## Chapter N: Title` (or `## Prologue`, `## Epilogue`, `## Interlude N`) headings, `*italics*` kept, bold dropped, export escapes removed, and `***` scene breaks. It has no dependencies.
- `text/` is **generated and committed**. It's what the AI reads, what every quote is checked against, and what `git diff` shows when the manuscript changes. Nobody edits it by hand. Diffing the mirror rather than the source hides export noise, and makes `.docx` changes readable at all.
- Chapters are detected by heading style *or* by a short paragraph that reads like a chapter heading, in English or in the words configured in `config.json`. The converter warns about hand-formatted headings, gaps in numbering and headings it couldn't place.

### 2. Two data layers: per-chapter evidence plus per-entity synthesis

- **Chapter files** (`data/chapters/b1-c03.json`) record what a single chapter says: summary, date, who appears, which events happen, and atomic facts with verbatim quotes. They are rebuilt from scratch whenever that chapter changes.
- **Registry files** (`data/characters/<id>.json`, `places/`, `events/`, `groups/`, `lore/`, `threads/`) hold identity, sourced profile values, AI-written synthesis and author-owned fields.
- **Anything derivable from chapter files is never stored in registries.** The build computes it: "chapters this character appears in", "all facts about them by category", "who was at this event".

When chapter 12 changes, only its chapter file is regenerated. The build recomputes every cross-reference, and only the registries whose facts changed need a fresh synthesis.

### 3. Every statement is sourced, unknowns stay blank, and a second pass verifies

- Facts, profile fields, dates, appearances, thread entries and **every sentence** of AI-written summaries carry refs. A ref is a manuscript ref (book file, chapter, verbatim quote), a post ref, or a sheet ref (row, cell values). The build rejects anything without a ref, and any quote it can't find in that chapter of `text/`.
- Fields the sources don't fill stay `null`, and the app shows them as *Not mentioned*.
- A quote existing doesn't prove the statement is right. So every extraction gets a separate **verification pass** (audit each entry against its quote in context, then sweep for missed details). A spot check with the author comes before the first parse is committed.
- Interpretation is labeled: *implied* (shown, not said), *claim* (a character says it) and *inferred* (date or number arithmetic only).

### 4. Contradictions: record both sides and never pick

- There is no precedence between sources. When two passages, or the text and the sheet, disagree, the field stores **every version with its sources**, and a contradiction entry is created.
- The bar is low. If something *might* be a contradiction, it's listed, and the author marks it `intended` or `not an issue`. Entries are never deleted, so the page stays a reference even for disagreements the author rejects.
- Only discrepancies the text itself explains (dyed hair, a lie that's later exposed) are not contradictions, and they are recorded as changes.

### 5. Scope comes from hashes and the narrative comes from git diff

Each chapter file stores a hash of the chapter text it was extracted from. The build reports every chapter whose current text no longer matches, which is the reparse scope. `git diff` on `text/` shows *what* changed.

### 6. JSON files, one per record, plus a zero-dependency build

- JSON because the browser and Node read it natively, and the AI writes it reliably. One file per record keeps git diffs small and reviewable.
- `tools/build.mjs` is plain Node with no npm dependencies. It validates the data and emits `app/db.js`, `app/text.js` and the install manifest. There is nothing to install beyond Node.

### 7. A private web app that works on phone and PC

- The app is one responsive web app, served from a private URL. On PC you open it in the browser (search is the main entry point, with a `/` keyboard shortcut). On the phone you open the same URL and use **Add to Home Screen**. It's an installable web app (PWA), so it gets its own icon, opens full screen like an app, and works offline once loaded.
- A native phone app isn't worth it: it needs app-store distribution or sideloading, and you'd still need the web version for PC.
- The stack is vanilla HTML, CSS and JS with a hash router, and data ships as `app/db.js`. The chapter text for the reader view ships separately as `app/text.js`, loaded only when needed. It also opens from a local copy (`app/index.html`) with no server, which is why it uses classic scripts and no `fetch`.

### 8. Images by naming convention

`media/<type>/<id>.<ext>` is the main image, and `media/<type>/<id>--<n>.<ext>` adds more images. The build copies them into `app/media/`. You can add them from a phone through GitHub's "Add file, Upload files".

### 9. Planning is separate from canon

`planning/` holds the author's plans. It is never parsed or cited. The `query` skill may read it while discussing the story, and always labels what it takes from it as *plan*. Likewise, the parts of a planning sheet that describe the future are excluded from parsing (PROJECT.md says which they are).

## App features

- **Search**: one box across names, aliases, facts, summaries, threads, contradictions and chapters, plus full-text search of the manuscript. Every word must start a word in the text; `"phrases"` and `-exclusions` work; accents and curly quotes are ignored. Results are ranked (names first) and filterable by type and book.
- **Fact explorer**: every fact, filterable by entity, category, aspect, voice, speaker, basis and chapter range, with category counts.
- **Characters**: a grid with image, name and role, and filters. The detail page shows an "at a glance" profile (blanks shown as *Not mentioned*), the summary (every sentence cited), and sections for appearance, **wardrobe** (outfits in chapter order), **tastes**, **habits and mannerisms**, **backstory**, personality, abilities, possessions, goals, secrets, who knows what and lies, plus relationships, events, a chapter-appearance strip (on-page versus mentioned), arcs per book and the author's notes.
- **Events**: date range, chapters, places, participants (present versus mentioned), synopsis, sub-events, causes and consequences.
- **Places**: hierarchy, description facts, events held there and characters seen there.
- **Chapters**: dates, POV, summary, and who, where and what for each chapter (and prologue, epilogue, interlude or post).
- **Timeline**: a day-grouped chronology of events and chapter spans, with filters for book, character, place and tag. Large gaps are collapsed.
- **Contradictions**: every contradiction found, with all sides quoted, filterable by status (`open`, `intended`, `not an issue`, `resolved`), entity and book. Disputed values elsewhere in the app carry a badge linking here.
- **Plot threads**: open mysteries, promises, setups, secrets and conflicts. Each shows where it was raised, how it has developed, and where it was resolved (if it has been), all quoted. The default view shows unresolved threads.
- **Reader-knowledge mode**: a global "as of chapter N" selector. Every fact, event, relationship, summary sentence and thread whose sources come later than chapter N is hidden, and threads resolved later show as still open. Because every statement is sourced, this filter is exact. Sheet-only information is author knowledge, and can be shown or hidden in this mode.
- **Citation chips** on every statement (`Ch3`, or `B1·Ch3` with several books). Tapping one shows the file, the chapter title and the quote. *Implied*, *claim*, *inferred* and *disputed* carry visible badges.
- **Reader view**: clicking a citation opens the chapter text, scrolled to the quote with the quote highlighted. It has find-in-chapter, adjustable text size, spacing and font, and remembers where you stopped reading.

### Possible extensions

- A gallery for multiple images per entity.
- A relationship graph and a character co-occurrence matrix (who shares scenes).
- POV statistics per chapter and per book.
- A map page.

## Hosting

GitHub Pages is **not** an option: a Pages site is publicly reachable even from a private repository, and this app contains the manuscript.

The recommended option is **Cloudflare Workers (static assets) plus Cloudflare Access**, both free at this scale. Workers redeploys the app on every push to the main branch, and `wrangler.jsonc` makes it serve only the `app/` folder. Access puts an emailed-code login in front of it, limited to the addresses the author lists. See [HOSTING.md](HOSTING.md). The fallback is to open `app/index.html` from a local copy, which needs no hosting.
