#!/usr/bin/env node
// Validates data/ against the text mirror and the sheet, derives the
// cross-references, and bundles everything into app/db.js.
// See docs/DATA_MODEL.md (schemas, build checks) and docs/UPDATE_WORKFLOW.md.
// No npm dependencies.
//
// Usage:
//   node tools/build.mjs                  validate; if clean, stamp new chapter hashes and write app/db.js
//   node tools/build.mjs --check          report the reparse scope only (stale / missing / moved chapters); writes nothing
//   node tools/build.mjs --list-chapters  list the chapters found in text/ (with sheet dates, if configured); writes nothing
//   node tools/build.mjs --partial        like the default, but chapters with no chapter file yet are not errors
//                                         (for checking work in progress; commits need a full build)
// Options (mainly for testing): --data <dir>  --out <file>  --media <dir>

import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { ROOT as root, bookEntries, loadConfig, postEntries, splitMirror } from './lib.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const partial = args.includes('--partial');
const mode = args.includes('--check') ? 'check' : args.includes('--list-chapters') ? 'list' : 'build';
const dataDir = resolve(root, opt('--data', 'data'));
const outFile = resolve(root, opt('--out', 'app/db.js'));
const mediaDir = resolve(root, opt('--media', 'media'));
const config = loadConfig();
config.files ??= {};

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

// ---------- text normalization (the only fuzziness allowed when matching quotes) ----------

const norm = (s) => s
  .replace(/[‘’‚‛′`]/g, "'")
  .replace(/[“”„‟″]/g, '"')
  .replace(/[‒–—―−]/g, '-')
  .replace(/…/g, '...')
  .replace(/\*/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const words = (s) => s.split(/\s+/).filter(Boolean).length;

// ---------- sources: chapters from text/, rows from the sheet ----------

const books = bookEntries(config);
// Posts (lore posts and other supplementary documents) are single-section sources. Each becomes one
// pseudo-chapter whose id is its file key, ordered right after the chapter named in `after` so that
// reader-knowledge mode shows it from that point on.
const posts = postEntries(config);
const chapters = new Map(); // id -> { id, book, file, kind, number, order, title, text, norm, hash }

// A source that hasn't been uploaded yet is normal (a new project, a book not written yet): it is skipped.
// A source without its text mirror means tools/extract.mjs hasn't been run.
const mirrorPath = (f, where) => {
  const path = join(root, f.text);
  if (existsSync(path)) return path;
  if (f.source && !existsSync(join(root, f.source))) warn('config.json', `${where}: ${f.source} does not exist yet, skipped`);
  else err(f.text, 'text mirror missing; run node tools/extract.mjs');
  return null;
};

for (const b of books) {
  if (!Number.isInteger(b.book) || b.book < 1) { err('config.json', `files.${b.key}: "book" must be a whole number (1, 2, 3…)`); continue; }
  if (books.some((x) => x !== b && x.book === b.book)) { err('config.json', `files.${b.key}: two books share number ${b.book}`); continue; }
  const path = mirrorPath(b, `files.${b.key}`);
  if (!path) continue;
  for (const sec of splitMirror(readFileSync(path, 'utf8'), b.book)) {
    if (chapters.has(sec.id)) { err(b.text, `${sec.id} appears twice (two headings with the same number?)`); continue; }
    const text = sec.lines.join('\n').trim();
    chapters.set(sec.id, { ...sec, lines: undefined, book: b.book, file: b.key, text, norm: norm(text), hash: sha256(text.replace(/\s+/g, ' ')) });
  }
}
for (const p of posts) {
  if (!/^post-/.test(p.key)) err('config.json', `files.${p.key}: a post's key must start with "post-"`);
  const path = mirrorPath(p, `files.${p.key}`);
  if (!path) continue;
  const after = chapters.get(p.after);
  if (!after) { err('config.json', `post ${p.key}: "after" must name a chapter (got "${p.after}")`); continue; }
  const text = readFileSync(path, 'utf8').replace(/^<!--[\s\S]*?-->\s*/, '').trim();
  chapters.set(p.key, { id: p.key, book: null, file: p.key, kind: 'post', number: null, order: after.order + 0.5, title: p.title, post: true, text, norm: norm(text), hash: sha256(text.replace(/\s+/g, ' ')) });
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}
const sheetPath = config.files.sheet?.source;
const sheet = sheetPath && existsSync(join(root, sheetPath)) ? parseCsv(readFileSync(join(root, sheetPath), 'utf8').replace(/^﻿/, '')) : [];
const sheetRow = (n) => sheet[n - 1]?.map((c) => c.trim());
if (sheetPath && !existsSync(join(root, sheetPath))) warn('config.json', `files.sheet: ${sheetPath} does not exist yet`);

// Sheet chapter dates, for --list-chapters. Only when config.json says where they are:
// files.sheet.chapterColumn (chapter numbers), dateColumns, and optionally bookColumn. Without bookColumn,
// the chapter numbers restarting (going down) marks the next book.
const col = (letter) => (letter ? [...String(letter).toUpperCase()].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1 : -1);
function sheetChapterRows() {
  const out = new Map();
  const cfg = config.files.sheet ?? {};
  if (!cfg.chapterColumn) return out;
  const [chCol, bookCol] = [col(cfg.chapterColumn), col(cfg.bookColumn)];
  const dateCols = (cfg.dateColumns ?? []).map(col);
  let book = 0, last = Infinity;
  sheet.forEach((r, i) => {
    const cell = (r[chCol] ?? '').trim();
    if (!/^\d+$/.test(cell)) return;
    const n = Number(cell);
    if (bookCol >= 0) book = Number((r[bookCol] ?? '').replace(/\D/g, '')) || book;
    else if (n <= last) book++;
    last = n;
    out.set(`b${book}-c${String(n).padStart(2, '0')}`, { row: i + 1, dates: dateCols.map((c) => (r[c] ?? '').trim()).filter(Boolean) });
  });
  return out;
}

if (mode === 'list') {
  const sheetRows = sheetChapterRows();
  const KIND = { chapter: 'chapter', prologue: 'prologue', epilogue: 'epilogue', interlude: 'interlude' };
  for (const c of [...chapters.values()].sort((a, b) => a.order - b.order)) {
    const n = String(words(c.text)).padStart(6);
    if (c.post) { console.log(`${c.id.padEnd(16)} ${n} words  ${`(post, after ${config.files[c.id].after})`.padEnd(28)}  ${c.title}`); continue; }
    const s = sheetRows.get(c.id);
    const where = sheetRows.size ? (s ? s.dates.join(' – ') || `sheet row ${s.row}` : '(not in sheet)') : KIND[c.kind];
    console.log(`${c.id.padEnd(16)} ${n} words  ${where.padEnd(28)}  ${c.title ?? '(untitled)'}`);
  }
  for (const b of books) {
    const list = [...chapters.values()].filter((c) => c.book === b.book);
    const extra = ['prologue', 'interlude', 'epilogue'].map((k) => [k, list.filter((c) => c.kind === k).length]).filter(([, x]) => x).map(([k, x]) => `${x} ${k}${x > 1 ? 's' : ''}`);
    console.log(`book ${b.book} (${b.key}): ${[`${list.filter((c) => c.kind === 'chapter').length} chapters`, ...extra].join(', ')}`);
  }
  if (!chapters.size) console.log('No chapters found in text/. Upload the manuscript to source/ and run node tools/extract.mjs (see docs/SETUP.md).');
  for (const id of sheetRows.keys()) if (!chapters.has(id)) console.log(`sheet has ${id} but the text does not`);
  for (const w of warnings) console.log(`warning: ${w}`);
  for (const e of errors) console.log(`ERROR: ${e}`);
  process.exit(errors.length ? 1 : 0);
}

// ---------- data ----------

const TYPES = ['characters', 'places', 'events', 'groups', 'lore', 'threads'];
const readJson = (path) => {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch (e) { err(relative(root, path), `invalid JSON: ${e.message}`); return null; }
};
const listJson = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : []);

const reg = Object.fromEntries(TYPES.map((t) => [t, new Map()]));
for (const t of TYPES) {
  for (const f of listJson(join(dataDir, t))) {
    const path = join(dataDir, t, f);
    const rec = readJson(path);
    if (!rec) continue;
    if (rec.id !== basename(f, '.json')) err(relative(root, path), `id "${rec.id}" does not match the filename`);
    rec._path = relative(root, path);
    reg[t].set(rec.id, rec);
  }
}
const chapterFiles = new Map();
for (const f of listJson(join(dataDir, 'chapters'))) {
  const path = join(dataDir, 'chapters', f);
  const rec = readJson(path);
  if (!rec) continue;
  if (rec.id !== basename(f, '.json')) err(relative(root, path), `id "${rec.id}" does not match the filename`);
  rec._path = relative(root, path);
  rec._file = path;
  chapterFiles.set(rec.id, rec);
}
const contradictionsPath = join(dataDir, 'contradictions.json');
const contradictions = existsSync(contradictionsPath) ? readJson(contradictionsPath) ?? [] : [];
const metaPath = join(dataDir, 'meta.json');
const meta = existsSync(metaPath) ? readJson(metaPath) ?? {} : {};
const contradictionIds = new Set(contradictions.map((c) => c.id));

// ---------- scope: stale / missing / moved chapters ----------

const hashOwner = new Map([...chapters.values()].map((c) => [c.hash, c.id]));
const scope = { missing: [], stale: [], unstamped: [], orphan: [], moved: [] };
for (const c of chapters.values()) {
  const f = chapterFiles.get(c.id);
  if (!f) scope.missing.push(c.id);
  else if (!f.sourceHash) scope.unstamped.push(c.id);
  else if (f.sourceHash !== c.hash) {
    scope.stale.push(c.id);
    const other = hashOwner.get(f.sourceHash);
    if (other && other !== c.id) scope.moved.push(`${c.id} (its chapter file matches the current text of ${other})`);
  }
}
for (const id of chapterFiles.keys()) if (!chapters.has(id)) scope.orphan.push(id);

function printScope() {
  const show = (label, list) => list.length && console.log(`${label} (${list.length}): ${list.join(', ')}`);
  show('Not yet extracted', scope.missing);
  show('Stale: text changed since extraction', scope.stale);
  show('Possibly renumbered', scope.moved);
  show('Extracted, hash not yet stamped', scope.unstamped);
  show('Chapter files with no matching chapter in text/', scope.orphan);
  if (!scope.missing.length && !scope.stale.length && !scope.orphan.length) console.log('All chapter files match the current text.');
  if (meta.lastParsedCommit) console.log(`Last parsed source commit: ${meta.lastParsedCommit}`);
}

if (mode === 'check') { printScope(); process.exit(0); }

// ---------- validation helpers ----------

const ENTITY_TYPES = ['characters', 'places', 'events', 'groups', 'lore'];
const findEntity = (id) => ENTITY_TYPES.some((t) => reg[t].has(id));
const appearanceType = { character: 'characters', place: 'places', group: 'groups', lore: 'lore', event: 'events' };

function checkQuote(where, chId, quote, { mustExist = true } = {}) {
  if (typeof quote !== 'string' || !quote.trim()) return err(where, 'missing quote');
  const ch = chapters.get(chId);
  if (!ch) return err(where, `unknown chapter "${chId}"`);
  if (!mustExist) return;
  const q = norm(quote);
  const at = ch.norm.indexOf(q);
  if (at < 0) {
    const ws = q.split(' ');
    let best = '';
    for (let n = ws.length - 1; n >= 3 && !best; n--) {
      const i = ch.norm.indexOf(ws.slice(0, n).join(' '));
      if (i >= 0) best = ch.norm.slice(i, i + q.length + 40);
    }
    return err(where, `quote not found in ${chId}: "${quote}"${best ? ` | closest: "${best}"` : ''}`);
  }
  if (ch.norm.indexOf(q, at + 1) >= 0) warn(where, `quote occurs more than once in ${chId}: "${quote}"`);
  const n = words(quote);
  if (n < 4 || n > 30) warn(where, `quote is ${n} words (aim for 4–30): "${quote}"`);
}

function checkRef(where, ref, opts) {
  if (!ref || typeof ref !== 'object') return err(where, 'ref must be an object');
  if (ref.file === 'sheet') {
    if (opts?.mustExist === false) return;   // closed contradiction: kept as a record of an older sheet
    const row = sheetRow(ref.row);
    if (!row) return err(where, `sheet row ${ref.row} does not exist`);
    if (!Array.isArray(ref.cells) || !ref.cells.length) return err(where, 'sheet ref needs cells');
    for (const cell of ref.cells) if (!row.includes(String(cell).trim())) err(where, `sheet row ${ref.row} has no cell "${cell}"`);
    return;
  }
  const book = books.find((b) => b.key === ref.file) ?? posts.find((p) => p.key === ref.file);
  if (!book) return err(where, `unknown file "${ref.file}"`);
  const ch = chapters.get(ref.ch);
  if (ch && ch.file !== ref.file) err(where, `chapter ${ref.ch} is not in ${ref.file}`);
  checkQuote(where, ref.ch, ref.quote, opts);
}

function checkRefs(where, refs, opts) {
  if (!Array.isArray(refs) || !refs.length) return err(where, 'needs at least one ref');
  refs.forEach((r, i) => checkRef(`${where}.refs[${i}]`, r, opts));
}

const BASIS = ['stated', 'implied', 'claim', 'rumor', 'inferred'];
function checkBasis(where, basis, { inferredOk = false } = {}) {
  if (basis === undefined) return;
  if (!BASIS.includes(basis)) return err(where, `unknown basis "${basis}"`);
  if (basis === 'inferred' && !inferredOk) err(where, 'basis "inferred" is only allowed for dates and numbers');
}

// null | { value, refs } | { disputed: [{ value, refs }...], contradiction }
function checkSourced(where, v, { isDate = false, valueCheck } = {}) {
  if (v === null || v === undefined) return;
  if (v.disputed !== undefined) {
    if (!Array.isArray(v.disputed) || v.disputed.length < 2) err(where, 'disputed needs at least two versions');
    else v.disputed.forEach((d, i) => checkSourced(`${where}.disputed[${i}]`, d, { isDate, valueCheck }));
    if (!contradictionIds.has(v.contradiction)) err(where, `disputed value points to missing contradiction "${v.contradiction}"`);
    return;
  }
  if (isDate) { if (!v.start) err(where, 'date needs start'); }
  else if (v.value === undefined || v.value === null || v.value === '') err(where, 'sourced value needs a value (use null for unknown)');
  if (valueCheck && v.value !== undefined) valueCheck(v.value);
  checkBasis(where, v.basis, { inferredOk: isDate || typeof v.value === 'number' });
  checkRefs(where, v.refs);
}

function checkProse(where, list) {
  if (list === null || list === undefined) return;
  if (!Array.isArray(list)) return err(where, 'prose must be a list of { text, refs }');
  list.forEach((s, i) => {
    if (!s?.text) err(`${where}[${i}]`, 'missing text');
    checkRefs(`${where}[${i}]`, s?.refs);
  });
}

const needEntity = (where, id, types = ENTITY_TYPES) => {
  if (!types.some((t) => reg[t].has(id))) err(where, `unknown ${types.length === 1 ? types[0].replace(/s$/, '') : 'entity'} "${id}"`);
};

// ---------- validate chapter files ----------

const FACT_CATEGORIES = ['appearance', 'outfit', 'taste', 'habit', 'personality', 'backstory', 'relationship', 'ability', 'status',
  'possession', 'goal', 'secret', 'knowledge', 'deception', 'description', 'geography', 'history', 'lore', 'other'];
const VOICES = ['narration', 'dialogue', 'thought', 'document'];
const PRESENCE = ['on-page', 'mentioned'];
const PARTS = ['full', 'start', 'continues', 'end'];

if (!partial) for (const id of scope.missing) err(config.files[chapters.get(id).file].text, `chapter ${id} has no chapter file`);
for (const id of scope.orphan) err(`data/chapters/${id}.json`, 'no matching chapter in text/');

for (const f of chapterFiles.values()) {
  const w = f._path;
  const ch = chapters.get(f.id);
  if (!ch) continue;
  if (f.book !== ch.book || f.number !== ch.number || f.file !== ch.file) err(w, `book/number/file must be ${ch.book}/${ch.number}/${ch.file}`);
  if (!ch.post && (f.kind ?? 'chapter') !== ch.kind) err(w, `kind must be "${ch.kind}"`);
  const q = (where, quote) => checkQuote(`${w}: ${where}`, f.id, quote);
  if (f.dates !== null) checkSourced(`${w}: dates`, f.dates, { isDate: true });
  (f.pov ?? []).forEach((p, i) => { needEntity(`${w}: pov[${i}]`, p.id, ['characters']); q(`pov[${i}]`, p.quote); });
  // A chapter with a heading and no text yet (work in progress) has nothing to summarize.
  if (!Array.isArray(f.summary) || (!f.summary.length && ch.text.trim())) err(w, 'summary needs at least one sentence');
  (f.summary ?? []).forEach((s, i) => { if (!s.text) err(`${w}: summary[${i}]`, 'missing text'); q(`summary[${i}]`, s.quote); });
  for (const key of ['sheetEvents', 'sheetNotes']) {
    (f[key] ?? []).forEach((s, i) => {
      const row = sheetRow(s.row);
      if (!row) err(`${w}: ${key}[${i}]`, `sheet row ${s.row} does not exist`);
      else if (!row.some((c) => c && s.label.includes(c))) err(`${w}: ${key}[${i}]`, `label "${s.label}" not found in sheet row ${s.row}`);
    });
  }
  (f.appearances ?? []).forEach((a, i) => {
    const where = `appearances[${i}]`;
    const t = appearanceType[a.type];
    if (!t) err(`${w}: ${where}`, `unknown type "${a.type}"`); else needEntity(`${w}: ${where}`, a.id, [t]);
    if (!PRESENCE.includes(a.presence)) err(`${w}: ${where}`, `presence must be on-page or mentioned`);
    q(where, a.quote);
  });
  (f.events ?? []).forEach((e, i) => {
    const where = `events[${i}]`;
    needEntity(`${w}: ${where}`, e.id, ['events']);
    if (!PARTS.includes(e.part)) err(`${w}: ${where}`, `part must be one of ${PARTS.join(', ')}`);
    (e.summary ?? []).forEach((s, j) => { if (!s.text) err(`${w}: ${where}.summary[${j}]`, 'missing text'); q(`${where}.summary[${j}]`, s.quote); });
    (e.participants ?? []).forEach((p, j) => {
      needEntity(`${w}: ${where}.participants[${j}]`, p.id, ['characters', 'groups']);
      if (!PRESENCE.includes(p.presence)) err(`${w}: ${where}.participants[${j}]`, 'presence must be on-page or mentioned');
      q(`${where}.participants[${j}]`, p.quote);
    });
    (e.places ?? []).forEach((p, j) => { needEntity(`${w}: ${where}.places[${j}]`, p.id, ['places']); q(`${where}.places[${j}]`, p.quote); });
  });
  (f.facts ?? []).forEach((x, i) => {
    const where = `facts[${i}]`;
    if (!Array.isArray(x.about) || !x.about.length) err(`${w}: ${where}`, 'about needs at least one id');
    (x.about ?? []).forEach((id) => needEntity(`${w}: ${where}.about`, id));
    if (!FACT_CATEGORIES.includes(x.category)) err(`${w}: ${where}`, `unknown category "${x.category}"`);
    if (!x.text) err(`${w}: ${where}`, 'missing text');
    if (!VOICES.includes(x.voice)) err(`${w}: ${where}`, `voice must be one of ${VOICES.join(', ')}`);
    if (x.voice !== 'narration' && x.voice !== undefined && !x.speaker) err(`${w}: ${where}`, `speaker is required for voice "${x.voice}"`);
    if (x.speaker) needEntity(`${w}: ${where}.speaker`, x.speaker, ['characters', 'groups']);
    checkBasis(`${w}: ${where}`, x.basis);
    q(where, x.quote);
  });
  (f.flags ?? []).forEach((x, i) => {
    if (x.kind !== 'unclear') err(`${w}: flags[${i}]`, 'only kind "unclear" is allowed; contradictions go to contradictions.json');
    q(`flags[${i}]`, x.quote);
  });
  if ((f.unregistered ?? []).length) warn(w, `unregistered names: ${f.unregistered.map((u) => u.name).join(', ')}`);
}

// ---------- validate registries ----------

// The standard profile keys, plus any the author adds in config.json ("extraProfileFields": { "species": "Species" }).
const EXTRA_PROFILE = config.extraProfileFields ?? {};
const PROFILE_KEYS = ['fullName', 'title', 'birthday', 'ageAtStart', 'origin', 'occupation', 'hair', 'eyes', 'height', 'build', 'marks', 'status', ...Object.keys(EXTRA_PROFILE)];

for (const c of reg.characters.values()) {
  const w = c._path;
  if (!c.name) err(w, 'missing name');
  (c.aliases ?? []).forEach((a, i) => checkSourced(`${w}: aliases[${i}]`, a));
  if (!c.profile) err(w, 'missing profile');
  else for (const k of PROFILE_KEYS) {
    if (!(k in c.profile)) err(w, `profile.${k} missing (use null when not mentioned)`);
    else checkSourced(`${w}: profile.${k}`, c.profile[k]);
  }
  for (const k of Object.keys(c.profile ?? {})) if (!PROFILE_KEYS.includes(k)) err(w, `unknown profile key "${k}"`);
  if (c.profile?.status?.since && !chapters.has(c.profile.status.since)) err(w, `profile.status.since: unknown chapter "${c.profile.status.since}"`);
  (c.groups ?? []).forEach((g, i) => { needEntity(`${w}: groups[${i}]`, g.id, ['groups']); checkRefs(`${w}: groups[${i}]`, g.refs); });
  checkProse(`${w}: summary`, c.summary);
  (c.personality ?? []).forEach((p, i) => {
    if (!p.trait) err(`${w}: personality[${i}]`, 'missing trait');
    checkBasis(`${w}: personality[${i}]`, p.basis);
    checkRefs(`${w}: personality[${i}]`, p.refs);
  });
  (c.relationships ?? []).forEach((r, i) => {
    needEntity(`${w}: relationships[${i}]`, r.with, ['characters']);
    if (r.since && !chapters.has(r.since)) err(`${w}: relationships[${i}]`, `unknown chapter "${r.since}"`);
    checkProse(`${w}: relationships[${i}].note`, r.note);
  });
  (c.arcs ?? []).forEach((a, i) => checkProse(`${w}: arcs[${i}].text`, a.text));
}

for (const p of reg.places.values()) {
  const w = p._path;
  if (!p.name) err(w, 'missing name');
  (p.aliases ?? []).forEach((a, i) => checkSourced(`${w}: aliases[${i}]`, a));
  checkSourced(`${w}: parent`, p.parent, { valueCheck: (v) => needEntity(`${w}: parent`, v, ['places']) });
  checkProse(`${w}: summary`, p.summary);
}

for (const e of reg.events.values()) {
  const w = e._path;
  if (!e.title) err(w, 'missing title');
  if (e.parent) needEntity(`${w}: parent`, e.parent, ['events']);
  if (e.dates !== null && e.dates !== undefined) checkSourced(`${w}: dates`, e.dates, { isDate: true });
  checkProse(`${w}: synopsis`, e.synopsis);
  for (const k of ['causes', 'consequences']) (e[k] ?? []).forEach((x, i) => { needEntity(`${w}: ${k}[${i}]`, x.id, ['events']); checkRefs(`${w}: ${k}[${i}]`, x.refs); });
}

for (const t of ['groups', 'lore']) {
  for (const g of reg[t].values()) {
    const w = g._path;
    if (!g.name) err(w, 'missing name');
    (g.aliases ?? []).forEach((a, i) => checkSourced(`${w}: aliases[${i}]`, a));
    checkProse(`${w}: summary`, g.summary);
    (g.details ?? []).forEach((d, i) => { if (!d.label || !d.value) err(`${w}: details[${i}]`, 'needs label and value'); checkRefs(`${w}: details[${i}]`, d.refs); });
  }
}

const THREAD_KINDS = ['mystery', 'promise', 'setup', 'secret', 'conflict'];
for (const th of reg.threads.values()) {
  const w = th._path;
  if (!THREAD_KINDS.includes(th.kind)) err(w, `kind must be one of ${THREAD_KINDS.join(', ')}`);
  if (!Array.isArray(th.question) || !th.question.length) err(w, 'question needs at least one cited sentence');
  checkProse(`${w}: question`, th.question);
  (th.about ?? []).forEach((id) => needEntity(`${w}: about`, id));
  if (!chapters.has(th.opened)) err(w, `opened: unknown chapter "${th.opened}"`);
  (th.developments ?? []).forEach((d, i) => {
    if (!chapters.has(d.ch)) err(`${w}: developments[${i}]`, `unknown chapter "${d.ch}"`);
    checkProse(`${w}: developments[${i}].text`, d.text);
  });
  if (!['open', 'resolved'].includes(th.status)) err(w, 'status must be open or resolved');
  if (th.authorStatus != null && th.authorStatus !== 'resolved') err(w, 'authorStatus must be null or resolved');
  if (th.authorComment != null && typeof th.authorComment !== 'string') err(w, 'authorComment must be a string');
  if (th.status === 'resolved') {
    if (!th.resolution || !chapters.has(th.resolution.ch)) err(w, 'resolved thread needs resolution.ch');
    if (!th.resolution?.text?.length) err(w, 'resolved thread needs a cited resolution');
    else checkProse(`${w}: resolution.text`, th.resolution.text);
  } else if (th.resolution) err(w, 'open thread must have resolution null');
}

const CONTRA_KINDS = ['text-vs-text', 'text-vs-sheet', 'sheet-vs-sheet', 'timeline'];
const CONTRA_STATUS = ['open', 'intended', 'not-an-issue', 'resolved'];
const seenContra = new Set();
contradictions.forEach((c, i) => {
  const w = `data/contradictions.json: [${i}] ${c.id ?? ''}`;
  if (!c.id) err(w, 'missing id');
  if (seenContra.has(c.id)) err(w, 'duplicate id');
  seenContra.add(c.id);
  if (!CONTRA_KINDS.includes(c.kind)) err(w, `kind must be one of ${CONTRA_KINDS.join(', ')}`);
  if (!['low', 'medium', 'high'].includes(c.severity)) err(w, 'severity must be low, medium or high');
  if (!CONTRA_STATUS.includes(c.status)) err(w, `status must be one of ${CONTRA_STATUS.join(', ')}`);
  (c.about ?? []).forEach((id) => needEntity(`${w}: about`, id));
  if (!Array.isArray(c.sides) || c.sides.length < 2) err(w, 'needs at least two sides');
  (c.sides ?? []).forEach((s, j) => {
    if (!s.claim) err(`${w}: sides[${j}]`, 'missing claim');
    // Closed entries (resolved, intended, not-an-issue) are kept as a record: their quotes may be gone after an edit.
    checkRefs(`${w}: sides[${j}]`, s.refs, { mustExist: c.status === 'open' });
  });
});

// ---------- derive ----------

const chapterOrder = (id) => chapters.get(id)?.order ?? Infinity;
const expand = (chId, quote) => ({ file: chapters.get(chId)?.file, ch: chId, quote });
const byOrder = (a, b) => chapterOrder(a.ch) - chapterOrder(b.ch);

const facts = [];
const appearancesById = {};
const eventChapters = {};
const freshEntities = new Set();
const fresh = new Set(scope.unstamped);

for (const f of [...chapterFiles.values()].sort((a, b) => chapterOrder(a.id) - chapterOrder(b.id))) {
  const touch = (id) => { if (fresh.has(f.id)) freshEntities.add(id); };
  (f.facts ?? []).forEach((x, i) => {
    const { quote, ...rest } = x;
    facts.push({ id: `${f.id}#${i}`, ...rest, ref: expand(f.id, quote) });
    x.about?.forEach(touch);
  });
  (f.appearances ?? []).forEach((a) => {
    (appearancesById[a.id] ??= []).push({ ch: f.id, presence: a.presence, quote: a.quote });
    touch(a.id);
  });
  (f.events ?? []).forEach((e) => {
    (eventChapters[e.id] ??= []).push({ ch: f.id, part: e.part, summary: e.summary, participants: e.participants ?? [], places: e.places ?? [] });
    touch(e.id);
  });
}

const index = { appearancesById, eventChapters, factsByEntity: {}, eventsByEntity: {}, eventsByPlace: {}, childPlaces: {}, subEvents: {}, relationshipsTo: {}, firstLast: {} };
facts.forEach((x) => x.about?.forEach((id) => (index.factsByEntity[id] ??= []).push(x.id)));
for (const [eid, parts] of Object.entries(eventChapters)) {
  for (const p of parts) {
    for (const who of p.participants) {
      const list = (index.eventsByEntity[who.id] ??= []);
      if (!list.some((x) => x.event === eid && x.ch === p.ch)) list.push({ event: eid, ch: p.ch, presence: who.presence });
    }
    for (const pl of p.places) {
      const list = (index.eventsByPlace[pl.id] ??= []);
      if (!list.includes(eid)) list.push(eid);
    }
  }
}
for (const p of reg.places.values()) if (p.parent?.value) (index.childPlaces[p.parent.value] ??= []).push(p.id);
for (const e of reg.events.values()) if (e.parent) (index.subEvents[e.parent] ??= []).push(e.id);
for (const c of reg.characters.values()) for (const r of c.relationships ?? []) (index.relationshipsTo[r.with] ??= []).push({ from: c.id, type: r.type });
for (const [id, list] of Object.entries(appearancesById)) {
  const sorted = [...list].sort(byOrder);
  index.firstLast[id] = { first: sorted[0].ch, last: sorted[sorted.length - 1].ch };
}

for (const t of ENTITY_TYPES) {
  for (const id of reg[t].keys()) {
    if (!appearancesById[id] && !index.factsByEntity[id] && !eventChapters[id] && t !== 'events') warn(`data/${t}/${id}.json`, 'no appearances or facts in any chapter');
  }
}

// ---------- images ----------

const images = {};
const IMG = /\.(jpe?g|png|webp|gif)$/i;
if (existsSync(mediaDir)) {
  for (const t of ENTITY_TYPES) {
    const dir = join(mediaDir, t);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir).filter((x) => IMG.test(x)).sort()) {
      const id = basename(f, extname(f)).replace(/--\d+$/, '');
      if (!reg[t].has(id)) { warn(`media/${t}/${f}`, `no ${t} record with id "${id}"`); continue; }
      (images[id] ??= []).push(`media/${t}/${f}`);
    }
  }
}

// ---------- report and write ----------

printScope();
for (const w of warnings) console.log(`warning: ${w}`);
if (errors.length) {
  for (const e of errors) console.log(`ERROR: ${e}`);
  console.log(`\nBuild failed: ${errors.length} error(s), ${warnings.length} warning(s). Nothing written.`);
  process.exit(1);
}

for (const id of scope.unstamped) {
  const f = chapterFiles.get(id);
  const { _path, _file, ...data } = f;
  data.sourceHash = chapters.get(id).hash;
  writeFileSync(_file, JSON.stringify(data, null, 2) + '\n');
}
if (freshEntities.size) console.log(`Entities touched by newly extracted chapters (re-synthesize): ${[...freshEntities].sort().join(', ')}`);

const strip = (m) => Object.fromEntries([...m.values()].map(({ _path, ...r }) => [r.id, r]));
const name = String(config.project?.name ?? '').trim() || 'Book DB';
const project = {
  name,
  id: name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'book-db',
  title: config.project?.title ?? name,
  description: config.project?.description ?? 'A private story bible.',
  extraProfileFields: EXTRA_PROFILE,
};
const db = {
  meta: { ...meta, builtAt: new Date().toISOString() },
  project,
  files: Object.fromEntries([...books.map((b) => [b.key, { book: b.book, title: b.title, source: b.source }]),
    ...posts.map((p) => [p.key, { kind: 'post', title: p.title, source: p.source, text: p.text, after: p.after }]),
    ...(sheetPath ? [['sheet', { source: sheetPath }]] : [])]),
  chapters: Object.fromEntries([...chapterFiles.values()].sort((a, b) => chapterOrder(a.id) - chapterOrder(b.id))
    .map(({ _path, _file, ...c }) => {
      const ch = chapters.get(c.id);
      return [c.id, { ...c, kind: ch.kind, sourceHash: ch.hash, title: ch.title, order: ch.order, ...(ch.post ? { post: true } : {}) }];
    })),
  characters: strip(reg.characters),
  places: strip(reg.places),
  events: strip(reg.events),
  groups: strip(reg.groups),
  lore: strip(reg.lore),
  threads: strip(reg.threads),
  contradictions,
  facts,
  index,
  images,
};

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `// Generated by tools/build.mjs. Do not edit by hand.\nwindow.DB = ${JSON.stringify(db, null, 1)};\n`);
// Chapter text for the reader view, in its own file so the app can load it only when needed.
const textFile = join(dirname(outFile), 'text.js');
const textEntries = [...chapters.values()].sort((a, b) => a.order - b.order).map((c) => `${JSON.stringify(c.id)}: ${JSON.stringify(c.text)}`);
writeFileSync(textFile, `// Generated by tools/build.mjs. Do not edit by hand.\nwindow.DB_TEXT = {\n${textEntries.join(',\n')}\n};\n`);
// The install manifest carries the app's name, so it is generated from config.json too.
const manifest = {
  name: project.name, short_name: project.name, description: project.description,
  start_url: './', scope: './', display: 'standalone', background_color: '#161517', theme_color: '#1f1e21',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
  ],
};
writeFileSync(join(dirname(outFile), 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
const appMedia = join(dirname(outFile), 'media');
rmSync(appMedia, { recursive: true, force: true });
for (const rel of Object.values(images).flat()) {
  mkdirSync(dirname(join(appMedia, rel.slice('media/'.length))), { recursive: true });
  cpSync(join(mediaDir, rel.slice('media/'.length)), join(appMedia, rel.slice('media/'.length)));
}
// Cloudflare's free plan serves files of at most 25 MiB (see docs/HOSTING.md).
for (const f of [outFile, textFile]) {
  const mib = statSync(f).size / 1048576;
  if (mib > 20) console.log(`warning: ${relative(root, f)} is ${mib.toFixed(1)} MiB; Cloudflare hosting accepts at most 25 MiB per file`);
}
console.log(`\nBuild OK${partial ? ' (PARTIAL: not valid for a commit)' : ''}: ${chapterFiles.size} chapters, ${facts.length} facts, ${ENTITY_TYPES.map((t) => `${reg[t].size} ${t}`).join(', ')}, ${reg.threads.size} threads, ${contradictions.length} contradictions. Wrote ${relative(root, outFile)} and ${relative(root, textFile)}.`);
