# Parsing guide

These are the rules an AI session follows when it turns manuscript text into `data/`. Read [DATA_MODEL.md](DATA_MODEL.md) first, especially **the accuracy contract**, **refs** and **disputed values**. Then read [PROJECT.md](PROJECT.md): the author's own notes about these books (writing conventions, the sheet layout, past decisions) override the general defaults below wherever they are more specific.

## What to read

- **Read the mirrors in `text/`** (the `text` paths in `config.json`), never the files in `source/` directly. Run `node tools/extract.mjs` first if a source is newer than its mirror. Quotes are checked against these files.
- Sections start at `## Chapter N: Title`, `## Prologue`, `## Epilogue` or `## Interlude N` lines. `***` marks a scene break. Text before the first heading (title page, dedication) belongs to no chapter and is not parsed.
- **Posts** (`text/posts/*.md`, see DATA_MODEL *Post ref*) are read the same way, as one section. A post's images are not in the mirror; flag them as `unclear` so the author can add any to `media/`.
- `*Italics*` in the mirror are italics in the manuscript. Authors use them for **inner thoughts**, emphasis, titles of works, foreign words, letters or messages. `docs/PROJECT.md` may say which. Otherwise decide from context. A thought is `voice: "thought"` with the thinker as `speaker`, and if the thinker isn't clear, flag it as `unclear`.
- Stories within the story, such as a novel a character reads or a legend someone tells, are sources *inside* the world. Facts from them are `voice: "document"` (or `dialogue` when told aloud), with `basis: "claim"` and the reader or teller as `speaker`. They are not established facts about the world.
- **`planning/` is not a source.** Never read it while parsing, never cite it, and never use it to fill a gap.

## Rule zero: only what is written

Accuracy is more important than completeness, speed or nice prose. Everything in the DB must be traceable to a specific passage that a reader can find.

- **If it isn't in the text (or the sheet), it isn't in the DB.** Leave the field `null` or the list empty. Don't use genre or period knowledge, mythology, history, typical traits, or what "makes sense". Don't guess from a character's name, title or origin.
- **Every statement carries a source:** the file, the chapter (or sheet row) and a verbatim quote. That covers facts, appearances, summary sentences, profile values, dates and links between events.
- **Never say more than the quote.** If the text says "dark hair", write "dark hair", not "black hair" or "brown hair". If it says "a blue dress", don't add fabric, cut or occasion.
- **Attribute carefully.** Before recording a fact, re-read the sentences around the quote to confirm *who* it's about. Pronouns, dialogue tags and scenes with two people of the same gender are the most common source of misattribution.
- **Don't fill gaps between chapters.** If a character is in one city in chapter 5 and another in chapter 9, don't invent a journey. Leave the gap.
- **When unsure whether something is stated, leave it out** and add a chapter `flag` (`kind: "unclear"`) with the quote, so the author can decide.

## Other principles

1. **Who says it matters.** Dialogue, thoughts and letters can be wrong, lies or opinions. Set `voice` and `speaker`. Use `basis: "claim"` when a character asserts something the narration doesn't confirm.
2. **Stated versus implied.** "She hated crowds" is stated. "She pressed herself against the wall as the crowd surged past" may *show* a dislike of crowds, so record it as `basis: "implied"` with the text phrased honestly ("Mara presses against the wall to avoid the crowd"), or as the behavior itself. Never upgrade an implication into a stated trait.
3. **Extract the chapter, not the book.** A chapter file describes only its own chapter. Cross-chapter reasoning belongs in registry synthesis, `threads/` and `contradictions.json`.
4. **Regenerate, don't patch.** When a chapter changes, rewrite its chapter file from a full read of the current chapter text.
5. **Reuse IDs.** Check the registries before creating an entity. A new name that might be an alias goes to `unregistered`, and is resolved later rather than guessed.

## Facts: what to extract

Within rule zero, be **exhaustive**. Small, concrete details are exactly what the author wants to find later. One fact per atomic claim. The categories are listed in DATA_MODEL.

**Characters, always extract:**
- **Appearance:** hair (colour, length, style), eyes, skin, height, build, face, scars, marks, voice, smell. Use `aspect` for grouping.
- **Outfits:** *every* described garment, outfit, jewelry piece, accessory, uniform, disguise or hairstyle choice, even when worn once. Record what the text says (colour, fabric, cut, condition) and nothing more. The app builds a chronological wardrobe from these.
- **Tastes:** likes and dislikes, favorites, food and drink (including what they order or refuse), music, reading, colors, smells, pastimes, aversions and fears.
- **Habits and mannerisms:** routines, gestures, verbal tics, recurring phrases, vices, sleep and waking habits, how they take their tea. A single occurrence counts if the text frames it as habitual ("as she always did"). Otherwise record it as a one-off, so that repetition across chapters can show a pattern.
- **Backstory:** childhood, family, where they come from, past events, former occupations, education, past relationships. This includes backstory given in dialogue (with `speaker` and `basis` set).
- **Personality:** traits stated by the narration or by characters, and behavior that clearly shows a trait (implied).
- **Relationships:** how characters are related or connected, first meetings, changes (allies, enemies, engaged, estranged), and how they address each other.
- **Abilities:** skills, magic, languages, education, physical limits.
- **Status:** titles, rank, occupation, injuries, illness, death, imprisonment, arrivals and departures.
- **Possessions, goals and secrets:** notable objects and pets, what they want, what they hide and from whom.
- **Knowledge:** who learns, is told, overhears, discovers, remembers or forgets what, and when. These let the author check who knows what at any point.
- **Deception:** every lie, cover story, disguise and false name, with who tells it and who is deceived.
- **Numbers and time:** ages, dates, durations, distances, times of day, money. These feed the timeline and contradiction checks.

**Places:** look, layout, rooms, furnishings, atmosphere, sounds and smells, weather tied to the place, location relative to other places, travel times, history, and who owns or runs it.

**Groups and lore:** membership, hierarchy, rules, customs, how the magic or technology works, terminology and calendars.

**Skip:**
- Purely momentary actions with no descriptive, habitual or plot value ("she picked up the cup"). This doesn't include anything about clothes, food, preferences or mannerisms, which are always kept.
- Paraphrased duplicates within the same chapter. Keep the clearest quote. The *same* detail repeated in a *different* chapter is recorded again, because repetition is evidence and feeds the contradiction checks.

## Quotes

- Copy the text exactly, including the punctuation inside the span. The build normalizes quote styles, dashes, whitespace and emphasis markers, and nothing else.
- Use 4 to 30 words. Choose the shortest span that proves the fact on its own and is unique in the chapter.
- The quote must contain the evidence itself. "her brown hair" proves the hair colour. "she turned her head" does not.
- Never splice two separate passages into one quote. If a fact needs both, record two facts, or use two refs in a registry sentence.
- Don't include markdown headings in a quote.

## Appearances

- `on-page`: the character is physically present in a scene of this chapter, including in a flashback scene that's actually depicted.
- `mentioned`: the character is named or clearly referred to but isn't present (dialogue, thought, letter, narration aside).
- Each appearance carries a quote that shows the presence or mention.
- List every named character, and every place where a scene is set (`on-page`) or that is referred to (`mentioned`).
- **POV:** record the viewpoint character only when the text makes it evident, for example by whose thoughts are shown or by first-person narration that names the narrator. If the POV shifts within the chapter, list each viewpoint in its own entry with its own quote.
- Recurring unnamed characters ("the ferryman", "the man in grey") get registries too. Use a descriptive ID like `ferryman`.

## Events

An **event** is something that happens and that you'd want to find on a timeline: plot beats, arrivals and departures, trials, deaths, battles, meetings with consequences, revelations, ceremonies, parties.

- **Granularity.** One event per meaningful beat, not per scene. Multi-day or multi-chapter happenings, such as a trial or a festival week, get a parent event plus sub-events for the distinct days or beats.
- **Sheet events.** If the project has a planning sheet with an events column (see PROJECT.md), every dated label there maps to an event, with a sheet ref. If the text never depicts it, the event keeps only its sheet ref and the app shows it as sheet-only.
- **Backstory events** (described but not depicted) are events too. Date them only as precisely as the text states.
- **Participants.** Use `on-page` for people physically there, and `mentioned` for people tied to it but absent. Each participant has a quote. `role` is a short label taken from what the text shows (`accused`, `judge`, `victim`, `host`, `witness`).
- **Causes and consequences** are recorded only when the text makes the link, either explicitly or by a direct quoted connection. A link that only seems plausible is not enough.

## Dates

There is **no precedence** between sources. Collect every date source for the chapter or event:
- a date stated in the text (manuscript ref),
- the sheet's date for that chapter, if there is a sheet (sheet ref),
- arithmetic from quoted cues such as "three days later" (`basis: "inferred"`). This is allowed only when *every* cue is quoted in the refs and an anchor date exists.

If they agree, store one value with all the refs. If they disagree, store a **disputed** value listing every version, and create a contradiction (`kind: "text-vs-sheet"` or `"timeline"`). Never choose. If no source gives a date, it's `null`.

## Reading the planning sheet

Only for projects that have one (`files.sheet` in `config.json`). **The layout is described by the author in [PROJECT.md](PROJECT.md), under *Planning sheet*.** Follow it exactly: which columns hold chapter numbers, dates, events, birthdays, ages or anything else, and which parts are plans.

- Cite a sheet value with a sheet ref (row and exact cells).
- An empty cell means `null`. A range like "27-28" is stored verbatim as a string, not resolved to a single number.
- Cells that are notes rather than happenings ("Book 1 ends") go to the chapter's `sheetNotes`, not to events. A note that conflicts with the text or another row is still checked, and becomes a contradiction if it disagrees.
- **Ignore future plans entirely**: beats, outlines, ideas and undated notes that describe what *will* be written. They are not cited, not checked for contradictions, and not shown. If PROJECT.md doesn't say whether a part of the sheet is a plan, or the layout has changed, ask the author.
- The sheet is author knowledge, not text a reader sees. Reader-knowledge mode lets the author show or hide it.

## Registry synthesis

After the chapter files are built, (re)write the synthesized fields of each affected registry. **Synthesis is summarizing, not inventing.**

- **`profile`:** fill a key only from facts that state it, using the latest value, and copy the refs. Otherwise `null`.
- **`summary`:** who or what this is and why they matter, as of the latest chapter, in 2 to 8 sentences. **Each sentence carries refs.** Write no sentence you can't cite.
- **`personality`:** traits supported by facts, each with a one-line note, refs and `basis`. Prefer traits supported in several chapters. If the text gives little, list few traits. Never pad.
- **`relationships`:** one entry per relationship the text establishes. `since` is the chapter where it starts, and the note sentences carry refs.
- **`arcs`:** per book, how the character changes, with cited sentences. Leave a book out if the character barely appears in it.
- **Events `synopsis`:** the whole event across its chapters, in order, with cited sentences.
- **Disputed values:** if the facts give different values for a profile key, make it disputed (every version, with refs) and link the contradiction. Don't pick the "latest" or the "most common" value.
- **Never touch** `notes`, `images`, the author-owned fields of contradictions (`intended` and `not-an-issue` statuses, `authorComment`), or a thread's `authorStatus` and `authorComment`.

## Contradictions

**Always point them out. Never resolve them, never explain them away, and never assume they're intentional.** The author decides. When in doubt, list it with `severity: "low"`.

When synthesizing, compare the facts for each affected entity across all chapters, and compare chapter and event dates against each other (and the sheet). Add an entry to `contradictions.json` for anything like:
- conflicting physical details, ages, birthdays, names, titles or relationships,
- dates that disagree between the text and the sheet, between two passages, or between two sheet rows,
- impossible sequences: someone on-page after their death, in two places at once, travel too fast for the dates, an age that doesn't fit a stated birthday,
- the same thing described differently (a room's layout, an object's colour) without the text explaining the change,
- inconsistent spellings of a name,
- a character knowing something before the text shows them learning it,
- a character's claim that the narration contradicts, *unless* the text itself presents it as a lie or a mistake.

Each entry quotes every side. Before adding one, check that it isn't already listed, including entries marked `intended` or `not-an-issue`. Those are never re-added or reopened.

It's **not** a contradiction when the text itself explains the difference: dyed hair, a new title, a lie exposed as a lie, a character corrected in-scene. Record those as facts that change over time.

## Plot threads

A thread is something the text leaves open for the reader. Record a thread only when a quoted passage raises it:
- **mystery:** a question the text poses and doesn't answer yet (asked aloud, wondered about in thought, or stated as unknown),
- **promise:** a plan, vow, deal, deadline, appointment or threat that is stated,
- **setup:** something the narration explicitly draws attention to as significant or unexplained,
- **secret:** something a character hides from others, recording who knows,
- **conflict:** a stated rivalry or threat that is still active.

Rules:
- `opened` and every development need quotes. Phrase the `question` as neutrally as the text allows, with no speculation about answers.
- Mark a thread `resolved` only with a quoted passage that clearly answers or fulfills it. A partial answer is a development, not a resolution. If you're unsure whether something resolves the thread, keep it open and say so in the reparse report.
- Don't invent threads from genre expectations ("this will surely matter later"). If the text doesn't flag it, it isn't a thread.
- Threads are checked on every reparse. A changed chapter can open, develop or resolve threads anywhere later in the story.

## Entity hygiene

- Don't create an entity for a passing mention with no recurrence and no story weight. A fact can still name it in `text`.
- If two IDs turn out to be the same entity, merge them only when the text makes it clear. Keep the older ID, add the other name to `aliases` with a ref, update every reference, and mention the merge in the reparse report. If it isn't clear, ask the author.
- Spell names as the text spells them, including invented or unusual spellings. Variant spellings go in `aliases` (and are worth a low-severity contradiction if the text never explains them).

## Self-check before handing off a chapter file

For every entry, ask:
1. Is the quote copied exactly from *this* chapter?
2. Does the quote, read in its surrounding sentences, really refer to the entity in `about`?
3. Does `text` say only what the quote says, with no added adjectives, causes or interpretation?
4. Is `voice`, `speaker` or `basis` correct?

If any answer is no, fix it or remove the entry.
