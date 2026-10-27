// Core helpers and derived lookups over window.DB. Classic script (works from file://).
/* global DB */
'use strict';

// ---------- small utilities ----------

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Inline Markdown used by the manuscript: *italics* only. Stray asterisks (a quote cut mid-italics) are dropped.
function md(s) {
  return esc(s).replace(/\*([^*\n]+?)\*/g, '<em>$1</em>').replace(/\*/g, '');
}
const plain = (s) => String(s ?? '').replace(/\*/g, '');

// The app's name and texts come from config.json "project" (see docs/CONFIGURATION.md).
const PROJECT = DB.project ?? { name: 'Book DB', id: 'book-db', title: 'Story bible' };
// Settings are stored per project, so two projects opened from the same computer don't share them.
const STORE_PREFIX = (PROJECT.id || 'book-db') + '.';
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(STORE_PREFIX + key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(STORE_PREFIX + key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  },
};

const plural = (n, one, many = one + 's') => `${n.toLocaleString()} ${n === 1 ? one : many}`;
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const uniq = (a) => [...new Set(a)];
const byKey = (f) => (a, b) => { const x = f(a), y = f(b); return x < y ? -1 : x > y ? 1 : 0; };
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

// ---------- normalization (mirrors tools/build.mjs, plus accent folding for search) ----------
// normMap returns the normalized text and, for each normalized character, the index of the source character.

const NORM_CHAR = { '‘': "'", '’': "'", '‚': "'", '‛': "'", '′': "'", '`': "'", '“': '"', '”': '"', '„': '"', '‟': '"', '″': '"', '‒': '-', '–': '-', '—': '-', '―': '-', '−': '-' };
function normMap(src) {
  let out = '';
  const map = [];
  let space = true;
  for (let i = 0; i < src.length; i++) {
    let c = src[i];
    if (c === '*') continue;
    if (/\s/.test(c)) {
      if (!space) { out += ' '; map.push(i); space = true; }
      continue;
    }
    space = false;
    if (c === '…') { out += '...'; map.push(i, i, i); continue; }
    c = NORM_CHAR[c] ?? c;
    c = c.toLowerCase();
    if (c.length !== 1) c = c[0];
    if (c > '\u007f') { const d = c.normalize('NFD').replace(/[̀-ͯ]/g, ''); c = d.length === 1 ? d : c; }
    out += c;
    map.push(i);
  }
  if (out.endsWith(' ')) { out = out.slice(0, -1); map.pop(); }
  return { text: out, map };
}
const norm = (s) => normMap(String(s ?? '')).text;
// Search form: punctuation becomes spaces and the text is padded, so a term matches at the start of a word (" hair" finds "haired", not "chair").
const sNorm = (s) => ' ' + norm(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim() + ' ';
const isWordChar = (c) => !!c && /[\p{L}\p{N}]/u.test(c);

// ---------- chapters ----------

const CH = DB.chapters;
// Posts (lore posts and other supplementary documents) are stored like chapters, ordered right after the
// chapter they follow, but they are not part of a book's chapter sequence.
const CH_LIST = Object.values(CH).filter((c) => !c.post).sort(byKey((c) => c.order));
CH_LIST.forEach((c, i) => { c.idx = i; });
const POSTS = Object.values(CH).filter((c) => c.post).sort(byKey((c) => c.order));
const TEXT_LIST = Object.values(CH).sort(byKey((c) => c.order)); // chapters and posts, in reading order
const ord = (chId) => CH[chId]?.order ?? Infinity;
// Book numbers are shown only when the project has more than one book.
const MULTI_BOOK = Object.values(DB.files).filter((f) => f.book).length > 1;
const HAS_SHEET = !!DB.files.sheet;
// Sections are chapters, or a prologue, epilogue or interlude (kind), each with its own labels.
const KIND_NAME = { prologue: 'Prologue', epilogue: 'Epilogue', interlude: 'Interlude' };
const KIND_SHORT = { prologue: 'Prol.', epilogue: 'Epil.', interlude: 'Int' };
const isChapter = (c) => !c.kind || c.kind === 'chapter';
// "Chapter 3", "Prologue", "Interlude 2"
const chName = (c) => (isChapter(c) ? `Chapter ${c.number}` : `${KIND_NAME[c.kind]}${c.kind === 'interlude' && c.number != null ? ' ' + c.number : ''}`);
// "3", "Prol.", "Int2": for chips and lists
const chShort = (c) => (isChapter(c) ? String(c.number) : `${KIND_SHORT[c.kind]}${c.kind === 'interlude' && c.number != null ? c.number : ''}`);
const chLabel = (chId) => {
  const c = CH[chId];
  if (!c) return chId;
  if (c.post) return 'Post';
  return `${MULTI_BOOK ? `B${c.book}·` : ''}${isChapter(c) ? 'Ch' : ''}${chShort(c)}`;
};
const chLong = (chId) => {
  const c = CH[chId];
  if (!c) return chId;
  if (c.post) return c.title;
  const name = isChapter(c) ? `Ch ${c.number}` : chName(c);
  return `${MULTI_BOOK ? `Book ${c.book}, ` : ''}${name}${c.title ? ': ' + c.title : ''}`;
};
// Where a post sits in reading order, for labels: "after B1·Ch28".
const postAfter = (c) => { const prev = [...CH_LIST].reverse().find((x) => x.order < c.order); return prev ? chLabel(prev.id) : ''; };
const bookOf = (chId) => CH[chId]?.book;
const BOOKS = uniq(CH_LIST.map((c) => c.book));
const bookTitle = (n) => Object.values(DB.files).find((f) => f.book === n)?.title ?? `Book ${n}`;

// ---------- entities ----------

const TYPES = {
  characters: { one: 'character', label: 'Characters', route: 'character' },
  places: { one: 'place', label: 'Places', route: 'place' },
  events: { one: 'event', label: 'Events', route: 'event' },
  groups: { one: 'group', label: 'Groups', route: 'group' },
  lore: { one: 'lore', label: 'Lore', route: 'lore' },
  threads: { one: 'thread', label: 'Plot threads', route: 'thread' },
};
const ROUTE_TYPE = Object.fromEntries(Object.entries(TYPES).map(([t, v]) => [v.route, t]));
// Facts and appearances name entities by bare ID. IDs are unique per type; this precedence resolves the rare clash.
const ENTITY_ORDER = ['characters', 'places', 'events', 'groups', 'lore'];
const TYPE_OF = {};
for (const t of [...ENTITY_ORDER].reverse()) for (const id in DB[t]) TYPE_OF[id] = t;
const APPEAR_TYPE = { character: 'characters', place: 'places', group: 'groups', lore: 'lore', event: 'events' };

function ent(id, type) {
  type = type ?? TYPE_OF[id];
  return type ? DB[type][id] : undefined;
}
function entName(id, type) {
  type = type ?? TYPE_OF[id];
  const e = ent(id, type);
  if (!e) return id;
  if (type === 'events') return e.title;
  if (type === 'threads') return plain(e.question?.[0]?.text ?? id);
  return e.name;
}
const entHref = (id, type) => `#/${TYPES[type ?? TYPE_OF[id]]?.route ?? 'character'}/${encodeURIComponent(id)}`;
function entLink(id, type, label) {
  type = type ?? TYPE_OF[id];
  if (!type || !ent(id, type)) return `<span class="muted">${esc(label ?? id)}</span>`;
  return `<a href="${entHref(id, type)}">${md(label ?? entName(id, type))}</a>`;
}
const initials = (name) => plain(name).split(/[\s-]+/).filter((w) => /^[\p{L}]/u.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
const entImage = (id) => DB.images?.[id]?.[0] ?? null;

// ---------- derived indexes ----------

const IX = DB.index;
const FACTS = DB.facts;
const FACT_BY_ID = Object.fromEntries(FACTS.map((f) => [f.id, f]));
const factsAbout = (id) => (IX.factsByEntity[id] ?? []).map((fid) => FACT_BY_ID[fid]);

// An event's own sourced dates. Chapter dates are when a chapter is set, not when an event in it happened
// (a past event can be recalled in a later chapter), so they are never used as an event's date.
function eventDates(eid) {
  return DB.events[eid]?.dates ?? null;
}
// Date range of the chapters an event appears in, shown only as "its chapters are dated …".
function eventChapterDates(eid) {
  let start = null, end = null;
  const refs = [];
  for (const p of IX.eventChapters[eid] ?? []) {
    if (!chOk(p.ch)) continue;
    const d = dateValue(CH[p.ch]?.dates);
    if (!d?.start || !anyOk(d.refs)) continue;
    const e2 = d.end ?? d.start;
    if (!start || d.start < start) start = d.start;
    if (!end || e2 > end) end = e2;
    refs.push(...okRefs(d.refs));
  }
  return start ? { start, end: end === start ? null : end, refs } : null;
}
// A dates field may be a plain sourced range or a disputed one; the first version is used for sorting.
function dateValue(d) {
  if (!d) return null;
  if (d.disputed) return { ...d.disputed[0], disputedAll: d.disputed, contradiction: d.contradiction };
  return d;
}

// Characters that belong to each group.
const MEMBERS = {};
for (const c of Object.values(DB.characters)) for (const g of c.groups ?? []) (MEMBERS[g.id] ??= []).push({ id: c.id, role: g.role, refs: g.refs });

const THREADS_ABOUT = {};
for (const t of Object.values(DB.threads)) for (const id of t.about ?? []) (THREADS_ABOUT[id] ??= []).push(t.id);
const CONTRA_ABOUT = {};
for (const c of DB.contradictions) for (const id of c.about ?? []) (CONTRA_ABOUT[id] ??= []).push(c.id);
const CONTRA = Object.fromEntries(DB.contradictions.map((c) => [c.id, c]));

// ---------- reader-knowledge mode ----------
// state.asOf is a chapter order (or null for everything). Sheet refs are author knowledge, shown when state.sheet is on.

const state = {
  asOf: store.get('asOf', null),
  sheet: !HAS_SHEET || store.get('sheet', true),
};
if (state.asOf != null && !CH_LIST.some((c) => c.order === state.asOf)) state.asOf = null;

const limited = () => state.asOf != null;
function refOk(r) {
  if (!limited()) return true;
  if (!r) return false;
  if (r.file === 'sheet') return state.sheet;
  return ord(r.ch) <= state.asOf;
}
const chOk = (chId) => !limited() || ord(chId) <= state.asOf;
// A sentence may combine several refs, so it is shown only when all of them are known.
const allOk = (refs) => !limited() || (refs?.length > 0 && refs.every(refOk));
// A value or alias is proved by each ref on its own, so one known ref is enough.
const anyOk = (refs) => !limited() || (refs ?? []).some(refOk);
const okRefs = (refs) => (refs ?? []).filter(refOk);
// Chapter-file prose carries a bare quote; expand it to a full ref.
const chRef = (chId, quote) => ({ file: CH[chId]?.file, ch: chId, quote });

// The values of a sourced (or disputed) value that a reader may see. strict: every ref must be known.
function valueTexts(v, strict = true) {
  if (!v) return [];
  return (v.disputed ?? [v]).filter((x) => (strict ? allOk : anyOk)(x.refs)).map((x) => String(x.value));
}

// Order of the first chapter in which an entity is known (appearance, fact, or event portion).
const FIRST_SEEN = {};
const seen = (id, o) => { if (o < (FIRST_SEEN[id] ?? Infinity)) FIRST_SEEN[id] = o; };
for (const [id, list] of Object.entries(IX.appearancesById)) for (const a of list) seen(id, ord(a.ch));
for (const f of FACTS) for (const id of f.about ?? []) seen(id, ord(f.ref.ch));
for (const [id, parts] of Object.entries(IX.eventChapters)) for (const p of parts) { seen(id, ord(p.ch)); for (const x of p.participants) seen(x.id, ord(p.ch)); }

function entOk(id, type) {
  if (!limited()) return true;
  type = type ?? TYPE_OF[id];
  if (type === 'threads') return chOk(DB.threads[id]?.opened);
  if (type === 'events' && !IX.eventChapters[id]) return state.sheet && !!DB.events[id]?.dates; // sheet-only event
  return (FIRST_SEEN[id] ?? Infinity) <= state.asOf;
}
function contraOk(c) {
  if (!limited()) return true;
  return (c.sides ?? []).filter((s) => anyOk(s.refs)).length >= 2;
}
// Free-text navigation labels (a character's role, a relationship type) aren't sourced, so they may describe
// later chapters. Reader mode hides them.
const navLabel = (s) => (limited() ? '' : s ?? '');
// Option lists for filters: only what a reader already knows.
const knownIds = (ids, type) => ids.filter((id) => entOk(id, type));
function asOfLabel() {
  if (!limited()) return 'Everything';
  const c = CH_LIST.find((x) => x.order === state.asOf);
  return c ? `As of ${chLabel(c.id)}` : 'Everything';
}

// ---------- dates ----------

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  if (d) return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
  if (m) return `${MONTHS[Number(m) - 1]} ${y}`;
  return y;
}
function fmtRange(d) {
  if (!d?.start) return '';
  if (!d.end || d.end === d.start) return fmtDate(d.start);
  const [y1, m1] = d.start.split('-'), [y2, m2] = d.end.split('-');
  if (y1 === y2 && m1 === m2 && d.start.split('-')[2] && d.end.split('-')[2]) return `${Number(d.start.split('-')[2])}–${fmtDate(d.end)}`;
  return `${fmtDate(d.start)} – ${fmtDate(d.end)}`;
}

// ---------- routing helpers ----------

function parseHash() {
  let h = location.hash.slice(1) || '/';
  try { h = decodeURI(h); } catch { /* keep raw */ }
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
  return { path, parts, params: new URLSearchParams(qs ?? '') };
}
// Store filter state in the URL without re-rendering, so back/forward and reloads keep it.
function setParams(params) {
  const { path } = parseHash();
  const clean = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== '' && v != null && v !== false) clean.set(k, v === true ? '1' : v);
  const qs = clean.toString();
  history.replaceState(null, '', '#' + path + (qs ? '?' + qs : ''));
}

// ---------- lazy chapter text ----------

let textPromise = null;
function loadText() {
  if (window.DB_TEXT) return Promise.resolve(window.DB_TEXT);
  if (!textPromise) {
    textPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'text.js';
      s.onload = () => (window.DB_TEXT ? resolve(window.DB_TEXT) : reject(new Error('text.js did not define DB_TEXT')));
      s.onerror = () => { textPromise = null; reject(new Error('Could not load text.js')); };
      document.head.appendChild(s);
    });
  }
  return textPromise;
}
// Split a chapter into paragraphs; "***" lines are scene breaks.
function paragraphs(chId) {
  const t = window.DB_TEXT?.[chId];
  if (!t) return [];
  return t.split(/\n+/).map((s) => s.trim()).filter(Boolean);
}
