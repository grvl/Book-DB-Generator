// Shared helpers for the tools: config loading and the chapter structure of the text mirror.
// No npm dependencies.
//
// The mirror (text/<book>.md, written by tools/extract.mjs) marks every section with one of these headings:
//   ## Chapter 3            ## Chapter 3: Title
//   ## Prologue             ## Prologue: Title
//   ## Epilogue             ## Epilogue: Title
//   ## Interlude            ## Interlude 2            ## Interlude 2: Title
// Section ids: b1-c03, b1-prologue, b1-epilogue, b1-interlude-1 (interludes without a number are counted in order).

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function loadConfig() {
  const path = join(ROOT, 'config.json');
  if (!existsSync(path)) throw new Error('config.json is missing (see docs/CONFIGURATION.md)');
  return JSON.parse(readFileSync(path, 'utf8'));
}

// Config entries by role. A book has a numeric "book"; a post has "kind": "post"; "sheet" is the planning sheet.
export const bookEntries = (config) => Object.entries(config.files ?? {})
  .filter(([key, f]) => key !== 'sheet' && f.kind !== 'post' && f.text).map(([key, f]) => ({ key, ...f }));
export const postEntries = (config) => Object.entries(config.files ?? {})
  .filter(([, f]) => f.kind === 'post' && f.text).map(([key, f]) => ({ key, ...f }));

const MIRROR_HEADING = /^## (Chapter|Prologue|Epilogue|Interlude)(?: (\d+))?(?:: (.*))?$/;

// "## Chapter 3: Title" -> { kind: 'chapter', number: 3, title: 'Title' }; anything else -> null.
export function parseMirrorHeading(line) {
  const m = line.match(MIRROR_HEADING);
  if (!m) return null;
  const kind = m[1].toLowerCase();
  if (kind === 'chapter' && !m[2]) return null;
  if ((kind === 'prologue' || kind === 'epilogue') && m[2]) return null;
  return { kind, number: m[2] ? Number(m[2]) : null, title: m[3]?.trim() || null };
}

// Splits a mirror into sections, in reading order. Text before the first heading (a title page) is not a section.
// Each section: { id, kind, number, title, order, lines }. Order: prologue first, chapters by number, interludes
// right after the section before them, epilogue last.
export function splitMirror(text, book) {
  const sections = [];
  let current = null;
  let interludes = 0;
  const base = book * 1000;
  for (const line of text.split('\n')) {
    const h = parseMirrorHeading(line);
    if (!h) { if (current) current.lines.push(line); continue; }
    let id, order, number = null;
    if (h.kind === 'chapter') { number = h.number; id = `b${book}-c${String(number).padStart(2, '0')}`; order = base + number; }
    else if (h.kind === 'prologue') { id = `b${book}-prologue`; order = base; }
    else if (h.kind === 'epilogue') { id = `b${book}-epilogue`; order = base + 999; }
    else {
      number = h.number ?? ++interludes;
      id = `b${book}-interlude-${number}`;
      order = (sections.length ? sections[sections.length - 1].order : base) + 0.01;
    }
    current = { id, kind: h.kind, number, title: h.title, order, lines: [] };
    sections.push(current);
  }
  return sections;
}
