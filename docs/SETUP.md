# Setup guide

This guide takes you from nothing to a working story bible for your own books: a private copy of this template, your manuscript in it, the first parse by Claude, and the app on your phone and PC. No programming is needed. Every step can be done in a web browser, and most can be done by asking Claude.

**Time:** about 30 minutes of your own time for Parts 1 to 4, then the first parse (Claude does the work, see Part 5), then about 30 minutes for hosting.

## What you need

| | What for | Cost |
|---|---|---|
| A **GitHub** account (<https://github.com/signup>) | Stores your private copy: manuscript, data and app | Free |
| A **Claude** plan that includes **Claude Code**: Pro, Max or Team (some Enterprise seats) | Claude reads your books and writes the database | Paid plan. See <https://claude.com/pricing> |
| A **Cloudflare** account (optional) | Hosts the app privately so it opens on your phone | Free (a card is asked for but not charged, see [HOSTING.md](HOSTING.md)) |
| **Node.js** 18 or later (optional) | Only if you want to run the scripts on your own computer. Claude's cloud sessions already have it. | Free |

> **About usage.** Parsing a whole novel means Claude reads every chapter carefully, twice (extraction, then an independent verification), and writes a file per chapter plus one per character, place and event. That is a lot of work. On a Pro plan, expect the first parse of a long book to take several sessions, because Claude Code has a usage limit per five-hour window and per week. Max plans have 5 or 20 times more room. This is normal: the workflow saves progress as it goes, and you simply start a new session and say *"continue the first parse"*. Later reparses only touch the chapters you changed, so they are small.

---

## Part 1: Make your own private copy

Your copy must be **private**: it will hold your manuscript.

**Option A: "Use this template"** (if you see a green **Use this template** button at the top of this repository's GitHub page):

1. Select **Use this template**, then **Create a new repository**.
2. Choose a **Repository name** (for example `my-book-db`).
3. Select **Private**.
4. Select **Create repository**.

**Option B: import it** (if there's no template button):

1. Go to <https://github.com/new/import>.
2. Paste this repository's address as the old repository's URL.
3. Choose a name, select **Private**, and select **Begin import**.

Don't use **Fork**: a fork of a public repository can't be made private.

From here on, "your repository" means your private copy.

## Part 2: Configure it

You can do this part by hand (below) or let Claude do it in Part 5: start a session and say *"Set up this repo for my book"*. Claude asks for the details and makes the edits.

By hand, on GitHub: open the file, select the **pencil** icon (Edit), make the change, and select **Commit changes**.

1. **`config.json`**: set the app's name and your book(s):
   ```json
   {
     "project": {
       "name": "Lighthouse DB",
       "title": "The Salt Lamp",
       "description": "Private story bible for The Salt Lamp."
     },
     "files": {
       "book1": { "book": 1, "title": "The Salt Lamp", "source": "source/book1.docx", "text": "text/book1.md" }
     }
   }
   ```
   - `name` is the app's name (short), `title` the heading on its home page.
   - For each book: its number, its title, and the file you'll upload in Part 3. Use `.docx` or `.md` to match your file.
   - For a series, add `"book2": { "book": 2, … }` and so on. Books not written yet are fine: they're skipped until the file exists.
   - Writing in another language than English? Add your chapter word, for example `"headings": { "chapter": ["Chapter", "Capítulo"] }`.

   Every option is explained in [CONFIGURATION.md](CONFIGURATION.md).
2. **`wrangler.jsonc`** (only if you'll host the app): change `"name": "my-book-db"` to the name your Cloudflare project will have. Lowercase letters, digits and dashes; something hard to guess. See [HOSTING.md](HOSTING.md), privacy rule 3.
3. **`docs/PROJECT.md`** (optional now): notes for the AI about your books, such as what italics mean in your writing, who narrates, or anything unusual. Claude asks about this during the first parse if you leave it empty.

## Part 3: Add your manuscript

1. **Export your book** as a single file, `.docx` or `.md`:
   - **Google Docs:** **File**, **Download**, **Markdown (.md)** (best) or **Microsoft Word (.docx)**.
   - **Word:** use the `.docx` file itself.
   - **Scrivener:** **File**, **Compile** to *Microsoft Word (.docx)*, with chapter titles included.
   - **LibreOffice:** **File**, **Save As**, *Word (.docx)*. **Pages:** **File**, **Export To**, **Word**.

   Not `.txt` or PDF: they lose italics. More details in [source/README.md](../source/README.md).
2. **Check your chapter headings.** Each chapter should start with a line like `Chapter 1` or `Chapter 1: The Letter` (or `Chapter One`, `Chapter I`), ideally in a **Heading** style. `Prologue`, `Epilogue` and `Interlude` work too. Number chapters from 1 in each book.
3. **Rename the file** to exactly what you put in `config.json` (for example `book1.docx`).
4. **Upload it:** in your repository on GitHub, open the `source` folder, choose **Add file**, then **Upload files**, drop the file in, and select **Commit changes**.

### Optional extras

- **A planning sheet** (dates per chapter, birthdays, ages): export it as CSV to `source/sheet.csv`, add a `sheet` entry to `config.json`, and describe its columns in `docs/PROJECT.md`, including which parts are plans to ignore. See [CONFIGURATION.md](CONFIGURATION.md).
- **Posts** (lore posts, bonus scenes, author's notes published outside the books): put them in `source/posts/` and add a `post-…` entry to `config.json` for each.
- **Plans and outlines:** put them in `planning/`. They're never parsed, but Claude can read them when you discuss the story (labelled as plans).
- **Images:** see [media/README.md](../media/README.md). Easiest after the first parse, when the IDs exist.

## Part 4: Start Claude Code

Pick one.

### Option A: in the browser (Claude Code on the web), no installation

1. Go to <https://claude.ai/code> and sign in with your Claude account.
2. Connect GitHub when asked, and install the **Claude GitHub app** on your account, giving it access to your repository (<https://github.com/apps/claude/installations/new>). Without the app, private repositories don't appear.
3. Keep the **Default** environment it offers. This project needs nothing installed beyond Node.js, which is already there.
4. In the repository selector below the message box, choose your repository.
5. Type your request (Part 5) and press Enter.

Each web session works on its own branch. When it finishes, review the changes on the **Changes** card and select **Create PR** to open a pull request, then **merge** it on GitHub (open the pull request, select **Merge pull request**, then **Confirm merge**). The app and the hosted site use what is on the main branch.

### Option B: on your computer (Claude Code CLI)

1. Install Claude Code:
   - macOS, Linux: `curl -fsSL https://claude.ai/install.sh | bash`
   - Windows (PowerShell): `irm https://claude.ai/install.ps1 | iex`

   Instructions and alternatives: <https://code.claude.com/docs/en/quickstart>
2. Install [Git](https://git-scm.com/downloads) and [Node.js](https://nodejs.org/) (LTS) if you don't have them.
3. Copy your repository to your computer and start Claude in it:
   ```bash
   git clone https://github.com/<you>/<your-repo>.git
   cd <your-repo>
   claude
   ```
   The first run asks you to log in with your Claude account.

Either way, Claude reads this repository's `CLAUDE.md` at the start of every session, so it already knows the rules and workflows. You only say what you want.

## Part 5: The first parse

1. **If you skipped Part 2**, start with: *"Set up this repo for my book."* Claude asks for the app's name and your books, edits `config.json` and `wrangler.jsonc`, converts the manuscript and shows you the chapters it found.
2. Then say: **"Do the first parse."**

What happens (details in [UPDATE_WORKFLOW.md](UPDATE_WORKFLOW.md)):

1. Claude converts the manuscript and shows you the **chapter split**: how many chapters per book, and any warnings. Check it matches your book.
2. It asks a few questions about your writing (what italics mean, the sheet layout if any) and records the answers in `docs/PROJECT.md`.
3. It lists the recurring characters, places, groups and terms, then reads every chapter and records the facts, each with the exact quote.
4. A separate pass re-checks every chapter: each statement against its quote (no inventions), and the chapter again for missed details.
5. It writes the profiles, summaries, relationships and arcs (every sentence cited), finds contradictions and plot threads, and builds the app.
6. Before committing, it shows you two or three character pages with their sources, so you can confirm the level of detail and accuracy.
7. It commits the data and tells you what it found, including questions for you.

**If the session stops** (a usage limit, or you close it): the work done so far is committed. Later, start a session and say *"continue the first parse"*.

**On the web,** finish by selecting **Create PR** and merging the pull request, so the result reaches the main branch.

## Part 6: Look at the app

- **Hosted, on phone and PC:** follow [HOSTING.md](HOSTING.md) (about 30 minutes, once). After that, every merged update republishes automatically.
- **On your computer, no hosting:** download your repository (on GitHub: **Code**, then **Download ZIP**, then unzip; or `git pull` in your clone), and open `app/index.html` in a browser.

Tour: search everything from the top bar (press `/`), open a character for their profile and every detail with its source, tap a chip like `Ch3` to see the quote, and **Read in context** to jump into the chapter. **Reader mode** (top right) hides everything after a chapter you choose, which is handy for spoiler-free checks or for beta readers.

## Day to day

1. **Write** as usual. When you want the DB updated, upload the new version over the old file in `source/` (same filename).
2. **Reparse:** start a session and say *"reparse"*. Claude finds the changed chapters, re-reads and re-checks them, updates what depends on them, and reports new contradictions and threads. Merge the result (on the web: **Create PR**, then merge).
3. **Talk about the story:** type `/query` at the start of a message (or just ask a question about your story). Claude looks things up in the DB, the text and your plans, cites the book, labels ideas and plans as such, and changes nothing.
4. **Your own fields:** ask Claude to add a note to a character (*"add a note to Mara: …"*), or to mark a contradiction as *intended* or *not an issue* with your comment. The AI never overwrites these.
5. **Images:** upload them to `media/` with the record's ID as the filename, then ask Claude to "rebuild the app" (or wait for the next reparse).

## Troubleshooting

| Problem | What to do |
|---|---|
| The chapter split is wrong (too few chapters, or none) | Your headings don't look like chapter headings to the converter. See *Formatting the books* in [source/README.md](../source/README.md). Common fixes: apply a Heading style to chapter lines, or add your language's word to `headings` in `config.json`. Then ask Claude to convert again. |
| "Plain text rather than a heading style" warning | Harmless: those headings were still found. Applying a Heading style in your editor makes detection more reliable. |
| Claude asks which book a file is | The uploaded file's name doesn't match `config.json`. Answer, and it renames the file. Next time, upload over the existing file name. |
| The build fails | Claude fixes build errors as part of every parse. If you edited `config.json` by hand, check for a missing or extra comma (JSON is strict). |
| The app shows nothing new | The update isn't on the main branch yet (merge the pull request), or the hosted site is still redeploying (wait a minute and reload). |
| Usage limit reached mid-parse | Normal for a long book. Come back after the reset time shown, start a session, and say *"continue the first parse"* (or *"continue the reparse"*). |

---

## For Claude: guided setup

When the author asks to set up the repo, do this, asking only for what you can't find in the files. Explain each step in plain words; the author may not be technical.

1. Check the state: `cat config.json data/meta.json`, `ls source source/posts`. If `data/` already has chapter files, this is not a fresh setup: say so and ask what they want.
2. Ask (in one message): the app's name, the series or book title for the home page, each book's number and title, which file in `source/` is which book (or whether it is still to be uploaded), the manuscript language (for `headings`), whether there is a planning sheet or posts, and the Cloudflare project name if they plan to host.
3. If an uploaded file has a different name from the one you'll configure, `git mv` it to `source/book<N>.<ext>`. Never edit its content.
4. Edit `config.json` (project, files, headings, sheet, posts) and `wrangler.jsonc` (`name`). Add `extraProfileFields` only if the author asks for extra character fields.
5. Fill `docs/PROJECT.md` *Sources* with the files, and anything the author has told you about conventions or the sheet. Fill `source/README.md`'s table with the actual files.
6. Run `node tools/extract.mjs` and `node tools/build.mjs --list-chapters`. Show the chapter counts and every warning, and confirm with the author that the split is right. If chapters are missing, inspect the headings in `text/` and the source, and fix the configuration (never the manuscript) or tell the author what to change in their file.
7. Run `node tools/build.mjs` (it must be green; with no chapter files yet, use `--partial`), and commit the configuration with the converted `text/` and the rebuilt `app/` in one commit, for example `Set up the project for <title>`. This is not a `db:` commit, because `data/` is untouched.
8. Update the *Status* section of `CLAUDE.md`, then tell the author the next step: the first parse (and, on the web, to create and merge the pull request when the session is done).
