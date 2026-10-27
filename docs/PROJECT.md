# Project notes

This page is **yours**. It tells the AI what is particular about your books, and it records the decisions you make along the way. The AI reads it before every parse, and its notes here take precedence over the general defaults in [PARSING_GUIDE.md](PARSING_GUIDE.md).

Fill in what you can (it's fine to leave sections empty). Claude asks about the parts that matter during the first parse, and adds your answers here.

## Sources

| Key | File | What it is |
|---|---|---|
| `book1` | `source/book1.md` | *(Book title)*, Book 1 |

Add a row per book, post and sheet as you add them to `config.json`.

## Writing conventions

How to read the manuscript. Examples of what belongs here:

- What italics mean: inner thoughts, letters, emphasis, a foreign language, telepathy…
- Who narrates: one first-person narrator, alternating viewpoints, an omniscient narrator.
- Anything unusual: chapters told as letters or diary entries, flashback chapters, a frame story, a dual timeline, an invented calendar (and how it maps to dates, if at all).
- Spellings that look like typos but aren't (invented names, dialect).

*(Nothing yet.)*

## Planning sheet

Only if `config.json` has a `sheet` entry. Describe the layout so the AI reads it correctly. For example:

- Columns A to D: chapter number, date, end date, events. Chapter numbers restart at 1 for each book.
- Columns F to H: character birthdays and ages at the start of Book 1.
- **Plans (ignore):** the beat list in column J, and the notes below row 120.

Everything the sheet says about the *future* of the story (beats, outlines, ideas) is ignored: say here which parts those are.

*(No sheet.)*

## Decisions

Answers to questions the AI raised, so they aren't asked again. For example: "Anna and the Grey Lady are separate people", "The prologue is set 20 years before chapter 1".

| # | Question | Decision |
|---|---|---|

## Open questions

Questions waiting for your answer. The AI asks before deciding any of these.

None at the moment.
