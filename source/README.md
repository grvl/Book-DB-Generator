# source/

This folder belongs to the author: your manuscripts and, optionally, your planning sheet and supplementary posts. AI sessions read it (through the normalized copy in `text/`) but never edit it unless you ask for that specific edit.

| File | What it is |
|---|---|
| `book1.md` or `book1.docx` | Book 1. Not uploaded yet. The name must match `files.book1.source` in `config.json`. |
| `sheet.csv` | Optional planning sheet (see [docs/CONFIGURATION.md](../docs/CONFIGURATION.md)). |
| `posts/` | Optional supplementary documents (lore posts, bonus scenes, author's notes), `.md` or `.docx`. Each needs an entry in `config.json`. |

Keep this table up to date as you add files (or let Claude do it). Plans and outlines don't belong here: put them in [planning/](../planning/), because a plan isn't a source.

## Uploading a new version

- **Keep the filename.** When you have a new version, upload it *over* the existing file (`book1.docx`, not `My_Novel_final_v3.docx`). The update workflow tracks changes per file. If a differently named file shows up, the AI asks which book it is and renames it.
- **On GitHub:** open this folder, choose **Add file**, then **Upload files**, drop the file, and **Commit changes**. This works from a phone too.
- **Export the latest version.** If you write in one program and export from another, make sure the copy you export is up to date.
- Then start a Claude Code session and say *"reparse"*.

## Which format

| You write in | Export as | How |
|---|---|---|
| Google Docs | `.md` (best) or `.docx` | **File**, **Download**, **Markdown (.md)** or **Microsoft Word (.docx)** |
| Microsoft Word | `.docx` | Just save. Use the `.docx` itself. |
| LibreOffice Writer | `.docx` | **File**, **Save As**, *Word 2007-365 (.docx)* |
| Apple Pages | `.docx` | **File**, **Export To**, **Word** |
| Scrivener | `.docx` | **File**, **Compile**, format *Microsoft Word (.docx)*, with chapter titles included as headings (for example "Chapter <$n>") |
| Markdown editors (Obsidian, iA Writer, Ulysses…) | `.md` | Put the whole book in one file, or export it as one |

Plain text (`.txt`) and PDF are not supported: they lose the italics, which often carry meaning (inner thoughts, letters, emphasis). One file per book.

## Formatting the books

`tools/extract.mjs` normalizes each file into `text/<book>.md`, the version the AI reads and quotes. It removes export quirks (escaped punctuation, bold, tab indents, links, images, line-break spaces). It relies on a few conventions:

- **Chapter headings** on their own line. All of these work: `Chapter 3`, `Chapter 3: The Letter`, `Chapter Three - The Letter`, `Chapter III. The Letter`. A heading that only says `Chapter 3` takes its title from a heading right below it, if there is one. Use a **heading style** (Heading 1 or Heading 2 in Word and Google Docs, `#` or `##` in Markdown) if you can: plain-text chapter lines still work, but the converter warns about them. With a heading style, a bare number (`3`, `III`) or `3. The Letter` counts too.
- **Prologue, Epilogue and Interlude** headings are recognised the same way (`Prologue`, `Epilogue: Ten Years Later`, `Interlude 2`). Other languages: add your words in `config.json` (`headings`), for example `"chapter": ["Chapter", "Capítulo"]`.
- **Number chapters from 1 without gaps** in each book. The converter warns about gaps and repeats.
- **Italics** are kept.
- **Scene breaks** are a line with only `***`, `* * *`, `#`, `~~~` or similar.
- Text before the first chapter heading (title page, dedication, table of contents) isn't part of any chapter, so the DB ignores it.
- Headings that aren't chapters (for example `Part Two`) are kept as ordinary text inside the chapter before them, with a warning.

After uploading, `node tools/build.mjs --list-chapters` (or asking Claude to "check the chapter split") shows what the converter found.
