# Update workflow

There are two procedures: the **first parse**, done once, and the **reparse**, done every time the author asks. Both end with a **verification pass**, a green build and a data commit.

Accuracy is the top priority throughout. See "Rule zero" in [PARSING_GUIDE.md](PARSING_GUIDE.md). The build proves that every quote exists. The verification pass proves that every statement actually matches its quote.

Before either procedure, read [DATA_MODEL.md](DATA_MODEL.md), [PARSING_GUIDE.md](PARSING_GUIDE.md) and [PROJECT.md](PROJECT.md).

---

## Reparse (incremental)

Triggered when the author says something like *"reparse"*, *"update the DB"*, *"sync"* or *"I've updated chapter 12, sync it"*.

### 0. Check the source files
- New versions must replace the files named in `config.json` (`source/book1.md`, `source/book1.docx`…) under the **same name**. If a differently named file appears in `source/` (for example `My_Novel_final_v3.docx`), ask the author which book it is, then `git mv` it over the right file. If the author switched formats (`.md` to `.docx` or back), update that book's `source` in `config.json` and remove the old file only when the author confirms.
- If the `text/` diff shows recent edits being *undone* (text from the previous version replaced by what looks like older wording), point it out to the author before parsing. The export may have come from an out-of-date copy.
- If uncommitted changes exist in `source/`, ask the author whether to commit them first. A parse must correspond to a commit.
- A new book or post needs an entry in `config.json` first (see [CONFIGURATION.md](CONFIGURATION.md)). Add it, and commit that config change together with the author's upload (it is not a data commit).

### 1. Refresh the text mirror and find the scope
```bash
cat data/meta.json                                  # lastParsedCommit
git log --oneline <lastParsedCommit>..HEAD -- source/
node tools/extract.mjs                              # regenerate text/ from source/; read its warnings
git diff --stat <lastParsedCommit> -- text/ source/
node tools/build.mjs --check                        # lists stale, missing and possibly renumbered chapters
```
- Report every warning from `extract.mjs` (for example a heading in plain text rather than a heading style, or a gap in the numbering) to the author.
- The **scope** is the set of chapters with a stale hash or no chapter file yet, plus anything the author names explicitly.
- If the scope is empty and the sheet hasn't changed, say so and stop.
- Read the actual `git diff <lastParsedCommit> -- text/` for those chapters, to understand the *nature* of each change: a rename, a rewritten scene, a new chapter or a cut. Diff `text/` rather than `source/`, because the normalized mirror hides export noise (and `.docx` diffs are unreadable).
- If `lastParsedCommit` is `null`, nothing has been parsed yet: use the *First parse* procedure below instead.

### 2. Handle structural changes first
- **Renumbered chapters.** The build reports a chapter file whose hash matches a different chapter. `git mv` the chapter files to their new IDs (and fix `number` inside them), then update every ref to those chapter IDs in the registries, `threads/` and `contradictions.json`. Work from the highest number down so files don't collide.
- **Deleted chapters.** Remove the chapter file. Registries that lose all appearances are reported to the author, not deleted.
- **Renamed character or place.** Keep the ID, update `name`, and move the old name to `aliases` if it's still used anywhere.

### 3. Re-extract each chapter in scope
For each chapter, read the **full current chapter text** (not just the diff hunks) and rewrite its chapter file from scratch, following [PARSING_GUIDE.md](PARSING_GUIDE.md), with `"sourceHash": null`. The next green build stamps it. Reuse existing IDs. New names go to `unregistered`.

### 4. Verify each re-extracted chapter
This is a separate pass from extraction. Ideally a fresh subagent does it with only the chapter text, the chapter file and the parsing guide in front of it, and no stake in what was extracted. It works in two directions:
- **Audit (no hallucinations).** For every fact, appearance, participant, summary sentence and flag, re-read the quote *in its surrounding sentences* and apply the self-check in the parsing guide: is the quote exact, is it about the right entity, does it say no more than the quote, are voice, speaker and basis correct? Fix or delete every failing entry, and log the fixes.
- **Sweep (no omissions).** Re-read the chapter looking only for missed concrete details: descriptions, outfits, tastes, habits, backstory, who learns what, lies, numbers and dates, names. Add them with quotes. Also look for questions, promises and setups the chapter raises (input for threads).

### 5. Resolve new entities
Look at the `unregistered` names across all chapters in scope. Create a registry for each, merge it as an alias, or drop it as a passing mention. Then clear the `unregistered` lists.

### 6. Sheet changes
If the project has a planning sheet and it changed, update the chapter `dates`, `sheetEvents` and `sheetNotes`, character profile values that come from it, and any lore built from it, following the layout in PROJECT.md. Check every changed row against the text for new contradictions. Future-plan parts stay ignored.

### 7. Build and fix
```bash
node tools/build.mjs
```
Fix every failure. Never "fix" a quote failure by loosening the quote or the matching. Re-read the chapter and copy the real text, or drop the fact. The usual causes are a quote typed wrong, or a quote in a chapter outside the scope that went stale because the author edited that chapter too. A stale quote in a chapter outside the scope means that chapter belongs in the scope: re-extract it.

### 8. Re-synthesize and verify the affected registries
The build prints the registries whose derived facts changed. For each one, update `profile`, `summary`, `personality`, `relationships`, `arcs` and event `synopsis` as needed. Every sentence and value must carry refs. Anything no longer supported by a source goes back to `null` or is removed.

Then **verify the synthesis**. For each new or changed sentence or value, open its refs and confirm they support it fully. A sentence that is only partly supported gets trimmed to what is supported.

Then do the **contradictions** pass for those entities (PARSING_GUIDE, *Contradictions*). Add new entries. Move an `open` entry to `resolved` only when the sides now agree, and never delete or reopen anything.

Finally, do the **threads** pass. Check whether the changed chapters open, develop or resolve any thread, and whether an edit removed the passage a thread relies on. If it did, re-check that thread and mention it in the report.

### 9. Commit
- Set `data/meta.json`: `lastParsedCommit` to the **source** commit that was parsed (normally `HEAD` before this commit), plus `lastParsedAt` (today's date) and `lastParseScope`.
- Run the build once more (it must be green), and commit `text/`, `data/` and `app/` in **one commit**:
  ```
  db: reparse b1-c12, b1-c14 (source a1b2c3d)

  - b1-c12: re-extracted (scene at the docks rewritten)
  - new character: ferryman
  - mara: +3 facts, summary updated
  - contradictions: 1 new (mara-eye-colour), 1 resolved
  - threads: 1 opened, 1 resolved
  - verification: 2 facts corrected, 1 removed, 4 added by sweep
  ```
- Never mix data commits with edits to `source/` or `planning/`. The author's manuscript commits stay separate.
- Push to the branch the session works on. The hosted app only updates when the commit reaches the branch Cloudflare deploys from (usually `main`), so tell the author if a merge or pull request is needed.

### 10. Report to the author
Keep it short: the chapters re-extracted, entities added, merged or orphaned, notable synthesis changes, new or resolved contradictions, threads opened or resolved, `extract.mjs` warnings, what verification corrected, and every `unclear` flag. Raise any question that needs the author's decision, and add decisions they make to PROJECT.md.

---

## First parse

Run this once, when the first manuscript is in `source/` and `data/meta.json` has `lastParsedCommit: null`. A whole novel is a lot of reading, so this takes a long session (or several). Commit progress at natural checkpoints if the session is likely to end. Only the final commit needs a full green build.

1. **Split check.** Run `node tools/extract.mjs`, then `node tools/build.mjs --list-chapters`. Show the author the chapter count per book (and any prologue, epilogue or interludes) and every converter warning. Confirm it matches their manuscript before going on. If headings were missed, see the formats in `source/README.md` and the `headings` option in CONFIGURATION.md.
2. **Project notes.** Read PROJECT.md. If it is still the blank template, ask the author the few questions that matter for parsing (what italics mean in their books, whether there is a planning sheet and how it is laid out, anything unusual about the story's structure such as letters, multiple narrators or an invented calendar), and record the answers there.
3. **Seed from the sheet** (only if there is one). Create character registries from any character table. Record chapter dates, `sheetEvents` and `sheetNotes`. Add calendar lore and sheet events as event registries. Skip the future-plan parts.
4. **Entity census.** Skim each book quickly, only to list recurring named characters, places, groups and lore terms. Create registries with IDs, names, aliases and `importance`, and leave the synthesis empty. This fixes the IDs before detailed extraction, so parallel workers don't invent duplicates.
5. **Per-chapter extraction.** Extract every chapter, following the parsing guide, with `"sourceHash": null`. Run `node tools/build.mjs --partial` after each batch to catch quote errors early. This step can be parallelised with subagents working on batches of about 5 consecutive chapters each. Every worker gets the registry index (IDs, names, aliases), the parsing guide and PROJECT.md, and puts new names in `unregistered` rather than creating registries.
6. **Verify every chapter file** (step 4 of the reparse: audit and sweep). This uses different subagents from the ones that extracted the same chapters.
7. **Resolve `unregistered`** across all chapters (step 5 of the reparse).
8. **Build and fix** until the build is green. While chapters are still missing, use `node tools/build.mjs --partial` to check the finished ones. Only a full `node tools/build.mjs` counts as green.
9. **Synthesis, then synthesis verification**, for every registry. Start with the major characters and events.
10. **Contradictions pass** over all entities and chapter dates (and the sheet), then a **threads pass** over the books in order.
11. **Spot check with the author.** Before committing, show the author 2 or 3 pages (for example the protagonist and one minor character) with their sources, so they can confirm the level of detail and accuracy before it is trusted.
12. **Commit** with `lastParsedCommit` set, and report to the author. Expect this commit to be large. Later reparses will be small.

**If the session can't finish.** Commit what is done with the build green in `--partial` mode, say in the commit message which chapters are extracted, and tell the author to start a new session and say "continue the first parse". The next session reads `node tools/build.mjs --check` to see what is still missing.

---

## Author-owned fields (never overwrite)

- `notes` on any registry.
- `images` captions, and anything in `media/`.
- In `contradictions.json`: the `intended` and `not-an-issue` statuses, and every `authorComment`. Entries are never deleted.
- `notes`, `authorStatus` and `authorComment` on threads.
- Everything in `source/` and `planning/`.
