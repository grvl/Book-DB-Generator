# Configuration

Everything about *your* project lives in a few files. You can edit them yourself (on GitHub, open the file and select the pencil icon) or ask Claude: *"set this repo up for my book"* (see [SETUP.md](SETUP.md)).

| File | What you set there |
|---|---|
| `config.json` | The app's name, your books and their files, posts, the planning sheet, heading words, extra profile fields |
| `wrangler.jsonc` | The name of the Cloudflare project that hosts the app (see [HOSTING.md](HOSTING.md)) |
| `docs/PROJECT.md` | Notes for the AI about your books: writing conventions, the sheet layout, decisions |
| `app/style.css`, `app/icon*` | Colours and the app icon (optional) |

After changing `config.json`, run `node tools/extract.mjs` and `node tools/build.mjs` (or ask Claude to), so the app picks up the change.

---

## `config.json`

A complete example with every option:

```json
{
  "project": {
    "name": "Salt Lamp DB",
    "title": "The Salt Lamp",
    "description": "Private story bible for The Salt Lamp series."
  },
  "files": {
    "book1": { "book": 1, "title": "The Salt Lamp", "source": "source/book1.docx", "text": "text/book1.md" },
    "book2": { "book": 2, "title": "The Tide Clock", "source": "source/book2.md", "text": "text/book2.md" },
    "post-world-guide": {
      "kind": "post",
      "title": "World guide",
      "source": "source/posts/world-guide.md",
      "text": "text/posts/world-guide.md",
      "after": "b1-c12"
    },
    "sheet": {
      "source": "source/sheet.csv",
      "chapterColumn": "A",
      "dateColumns": ["B", "C"]
    }
  },
  "headings": {
    "chapter": ["Chapter", "Capítulo"],
    "prologue": ["Prologue", "Prólogo"],
    "epilogue": ["Epilogue", "Epílogo"],
    "interlude": ["Interlude", "Interlúdio"]
  },
  "extraProfileFields": {
    "pronouns": "Pronouns",
    "species": "Species"
  }
}
```

JSON is strict: keep the double quotes, separate entries with commas, and don't leave a comma after the last entry. If the build says `invalid JSON`, check for a missing or extra comma.

### `project`

| Key | Meaning |
|---|---|
| `name` | The app's name: top bar, browser tab, and the label under the icon when installed on a phone. Keep it short. A name ending in "DB" gets the last two letters coloured. |
| `title` | The heading on the home page ("*title* story bible"). Usually the book or series title. |
| `description` | One line, shown in the install prompt. |

### `files`: books

One entry per book. The key (`book1`, `book2`…) is how refs name the file, so **never rename a key** once the book has been parsed.

| Key | Meaning |
|---|---|
| `book` | The book's number in the series: 1, 2, 3… Chapter IDs use it (`b2-c07`). |
| `title` | The book's title, shown in the app. |
| `source` | Your file in `source/`. `.md` (Markdown, or a Google Docs Markdown export) or `.docx` (Word, and what Google Docs, LibreOffice, Pages and Scrivener can export). One file per book. |
| `text` | Where the converter writes the normalized copy. Use `text/` plus the key: `text/book2.md`. |

A book whose `source` file doesn't exist yet is fine: the tools skip it with a note. So you can list the whole planned series from day one.

### `files`: posts (optional)

A **post** is a supplementary document outside the books: a lore post, a bonus scene, a map legend, author's notes, a short story set in the same world. Its facts are cited like the books', and it has no precedence over them.

| Key | Meaning |
|---|---|
| (entry key) | Must start with `post-`, for example `post-world-guide`. |
| `kind` | Always `"post"`. |
| `title` | Shown in the app. |
| `source`, `text` | As for books. Put posts in `source/posts/` and `text/posts/`. |
| `after` | The chapter a reader should have reached before reading the post, as a chapter ID (`b1-c12`, `b1-prologue`). Reader-knowledge mode shows the post from that point on. |

### `files.sheet`: planning sheet (optional)

If you keep a spreadsheet with chapter dates, events, birthdays or ages, export it as CSV (Google Sheets: **File**, **Download**, **Comma-separated values**) and save it as `source/sheet.csv`. The AI cites its cells by row, and shows disagreements between the sheet and the text as contradictions. **Describe the sheet's layout in `docs/PROJECT.md`**, including which parts are future plans that must be ignored.

| Key | Meaning |
|---|---|
| `source` | Always needed: the CSV file. The entry's key must be `sheet`. |
| `chapterColumn` | Optional. The column letter that holds chapter numbers. Lets `node tools/build.mjs --list-chapters` show each chapter's sheet date next to it, which makes it easy to check the sheet against the text. |
| `dateColumns` | Optional, with `chapterColumn`: the column letters holding the chapter's date(s). |
| `bookColumn` | Optional, with `chapterColumn`: a column holding the book number. Without it, chapter numbers going back down (to 1) mark the start of the next book. |

No sheet? Leave the `sheet` entry out. The app then hides everything sheet-related.

### `headings` (optional)

The words that mark a chapter, prologue, epilogue or interlude in your manuscript. The defaults are the English words. Add your language's words (or replace them). Accents and capitals don't matter. Each kind takes a list:

```json
"headings": { "chapter": ["Chapter", "Kapitel"], "prologue": ["Prologue", "Prolog"] }
```

Chapter numbers can be digits (`Chapter 12`), Roman numerals (`Chapter XII`) or English words (`Chapter Twelve`). In other languages, use digits or Roman numerals. Inside the app and the data, sections are always called Chapter, Prologue, Epilogue and Interlude.

### `extraProfileFields` (optional)

Every character page has an "At a glance" box with standard fields: full name, title, birthday, age at start, origin, occupation, hair, eyes, height, build, marks, status. Add your own here as `"key": "Label"`. The key is lowercase letters (camelCase for several words, like `"homeWorld"`), and the label is what the app shows. Add new fields before the first parse if you can: every character file must carry every field (the AI fills each one from the text or leaves it empty).

---

## `wrangler.jsonc`

Only matters for hosting. `name` must be exactly the name you give the project in Cloudflare (lowercase letters, digits and dashes), or the deploy fails. See [HOSTING.md](HOSTING.md). Leave the rest as it is: it publishes only the `app/` folder.

## Colours and icon (optional)

- **Colours.** The app is dark-themed. The colours are variables at the top of `app/style.css` (`:root { --accent: …; }`). Change `--accent`, `--accent-soft`, `--link`, `--onpage` and `--mentioned` together to re-theme it.
- **Icon.** Replace `app/icon.svg`, `app/icon-180.png`, `app/icon-192.png` and `app/icon-512.png` with your own square images of those sizes (180, 192 and 512 pixels). Keep important content away from the edges, because phones crop icons into circles or rounded squares.

After changing the icon, a phone that already has the app installed may keep the old icon until you remove it and add it to the home screen again.

## Other settings worth knowing

- **Reader-knowledge mode** needs no configuration: it follows your chapter order.
- **Images** of characters, places and events are added by filename: see [media/README.md](../media/README.md).
- **Your notes** on any character, place or event go in its `notes` field in `data/` (ask Claude, or edit the JSON). The AI never overwrites them.
