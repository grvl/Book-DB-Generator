#!/usr/bin/env node
// Read-only search over the built story bible (app/db.js) and the text mirror (text/).
// Used by the query skill (.claude/skills/query/SKILL.md). No npm dependencies. Never writes anything.
//
//   node tools/query.mjs find <words>                 entities whose id, name or alias matches
//   node tools/query.mjs show <id>                    one entity with its sourced fields and links
//   node tools/query.mjs facts <id> [category]        every fact about an entity, with quotes
//   node tools/query.mjs chapter <b1-c03>             a chapter's date, POV, summary, cast, events
//   node tools/query.mjs chapters                     every chapter, with its id and title
//   node tools/query.mjs grep <regex> [--book N]      search the manuscript text (and posts), chapter by chapter
//   node tools/query.mjs threads [open|resolved] [id] plot threads, optionally about one entity
//   node tools/query.mjs contradictions [id]          contradictions, optionally about one entity
//   node tools/query.mjs together <id> <id>           chapters and events where both appear
//
// Add --until <b1-c20> to any command to see only what a reader knows as of that chapter.
// The DB is the last build: run `node tools/build.mjs` if data/ changed since.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { ROOT, loadConfig, splitMirror } from './lib.mjs';

const REGISTRIES = ['characters', 'places', 'events', 'groups', 'lore', 'threads'];

// ---------- arguments ----------
const argv = process.argv.slice(2);
const opts = {};
const args = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) opts[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') ? true : (argv[++i] ?? true);
  else args.push(argv[i]);
}
const [cmd, ...rest] = args;

// ---------- data ----------
function loadDB() {
  const file = join(ROOT, 'app', 'db.js');
  if (!existsSync(file)) fail('app/db.js is missing. Build it with `node tools/build.mjs`.');
  const sandbox = { window: {} };
  vm.runInNewContext(readFileSync(file, 'utf8'), sandbox, { filename: 'app/db.js' });
  return sandbox.window.DB;
}
function fail(msg) { console.error(msg); process.exit(1); }
const sectionName = (c) => (!c.kind || c.kind === 'chapter' ? `Chapter ${c.number}` : `${c.kind[0].toUpperCase()}${c.kind.slice(1)}${c.kind === 'interlude' && c.number != null ? ' ' + c.number : ''}`);

const DB = loadDB();
const factById = new Map(DB.facts.map(f => [f.id, f]));
const order = ch => DB.chapters[ch]?.order ?? Infinity;
let UNTIL = Infinity;
if (opts.until) {
  if (!DB.chapters[opts.until]) fail(`Unknown chapter "${opts.until}". Chapter ids look like b1-c03 (list them with: node tools/query.mjs chapters).`);
  UNTIL = order(opts.until);
}
// Reader-knowledge rules mirror the app (app/js/core.js). Sheet refs are author knowledge and stay visible.
const LIMITED = UNTIL !== Infinity;
const known = ch => !LIMITED || (!!ch && order(ch) <= UNTIL);
const refKnown = r => r.file === 'sheet' || known(r.ch);
// A sentence may combine several refs, so it needs all of them; a value or alias is proved by any one.
const allKnown = refs => !LIMITED || (refs?.length > 0 && refs.every(refKnown));
// Free-text labels and notes aren't sourced and may describe later chapters, so --until hides them.
const UNSOURCED_LABELS = new Set(['role', 'type', 'note']);

const FIRST_SEEN = {};
if (LIMITED) {
  const seen = (id, ch) => { if (order(ch) < (FIRST_SEEN[id] ?? Infinity)) FIRST_SEEN[id] = order(ch); };
  for (const [id, list] of Object.entries(DB.index.appearancesById || {})) for (const a of list) seen(id, a.ch);
  for (const f of DB.facts) for (const id of f.about || []) seen(id, f.ref.ch);
  for (const [id, parts] of Object.entries(DB.index.eventChapters || {})) {
    for (const p of parts) { seen(id, p.ch); for (const x of p.participants || []) seen(x.id, p.ch); }
  }
}
const entKnown = (id, type) => !LIMITED || (type === 'threads' ? known(DB.threads[id]?.opened) : (FIRST_SEEN[id] ?? Infinity) <= UNTIL);

function lookup(id) {
  for (const type of REGISTRIES) if (DB[type]?.[id]) return { type, rec: DB[type][id] };
  return null;
}
function need(id) {
  if (!id) fail('Give an entity id. Find one with: node tools/query.mjs find <name>');
  const hit = lookup(id);
  if (hit && !entKnown(id, hit.type)) fail(`"${id}" is not known to a reader as of ${opts.until}.`);
  if (!hit) {
    const guesses = search(id).slice(0, 5).map(h => `${h.id} (${h.type})`);
    fail(`No entity "${id}".${guesses.length ? ' Did you mean: ' + guesses.join(', ') : ''}`);
  }
  return hit;
}
const label = id => { const h = lookup(id); return h ? (h.rec.name || h.rec.title || id) : id; };

// ---------- formatting ----------
const cite = r => r.file === 'sheet' ? `[sheet row ${r.row}: ${(r.cells || []).join(' | ')}]` : `[${r.ch}] "${r.quote}"`;
const isSourced = v => v && typeof v === 'object' && !Array.isArray(v) && Array.isArray(v.refs);

// Renders a registry value: sourced sentences, sourced values, disputed values and plain data.
function render(v, indent = '  ') {
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return null;
  if (Array.isArray(v)) {
    const lines = v.map(x => render(x, indent)).filter(Boolean);
    return lines.length ? lines.join('\n') : null;
  }
  if (typeof v !== 'object') return `${indent}${fmtValue(v)}`;
  if (v.disputed) {
    const sides = v.disputed.map(d => ({ ...d, refs: d.refs.filter(refKnown) })).filter(d => d.refs.length);
    if (!sides.length) return null;
    return `${indent}DISPUTED${v.contradiction ? ` (contradiction ${v.contradiction})` : ''}:\n` +
      sides.map(d => `${indent}  - ${fmtValue(d.value)} ${d.refs.map(cite).join(' ')}`).join('\n');
  }
  if (isSourced(v)) {
    if ('text' in v && !allKnown(v.refs)) return null;
    const refs = v.refs.filter(refKnown);
    if (!refs.length) return null;
    const body = v.text ?? ('value' in v ? fmtValue(v.value) : Object.entries(v)
      .filter(([k]) => !['refs', 'basis', 'note'].includes(k)).map(([, x]) => fmtValue(x)).join(', '));
    const extra = v.basis && v.basis !== 'stated' ? ` (${v.basis})` : '';
    const note = typeof v.note === 'string' && v.note && !LIMITED ? ` (note: ${v.note})` : '';
    return `${indent}- ${body}${extra}${note} ${refs.map(cite).join(' ')}`;
  }
  if (v.ch && Array.isArray(v.text)) { // thread development
    if (!known(v.ch)) return null;
    const inner = render(v.text, indent + '  ');
    return inner ? `${indent}${v.ch}:\n${inner}` : null;
  }
  if (v.since && !known(v.since)) return null;
  const lines = [];
  let sourcedParts = 0, sourcedShown = 0;
  for (const [k, x] of Object.entries(v)) {
    if (LIMITED && typeof x === 'string' && UNSOURCED_LABELS.has(k)) continue;
    const r = render(x, indent + '  ');
    if (x && typeof x === 'object') { sourcedParts++; if (r) sourcedShown++; }
    if (r) lines.push(`${indent}${k}:\n${r}`);
  }
  // Hide records whose sourced content is all later than --until (an arc, a relationship).
  if (sourcedParts && !sourcedShown) return null;
  return lines.length ? lines.join('\n') : null;
}
function fmtValue(x) {
  if (x == null) return '';
  if (typeof x !== 'object') return String(lookup(x) ? `${label(x)} (${x})` : x);
  return JSON.stringify(x);
}

// A thread resolved after --until still reads as open to the reader.
function threadStatus(t) {
  const resolvedCh = t.resolution?.ch;
  return t.status === 'resolved' && resolvedCh && !known(resolvedCh) ? 'open' : t.status;
}

// ---------- commands ----------
function search(q) {
  const needle = q.toLowerCase();
  const hits = [];
  for (const type of REGISTRIES) {
    for (const rec of Object.values(DB[type] || {})) {
      if (!entKnown(rec.id, type)) continue;
      const name = rec.name || rec.title || '';
      const aliases = (rec.aliases || []).filter(a => a.refs?.some(refKnown)).map(a => a.value);
      const all = [rec.id, name, ...aliases];
      const match = all.find(s => s && s.toLowerCase().includes(needle));
      if (match) hits.push({ type, id: rec.id, name, match, exact: all.some(s => s?.toLowerCase() === needle) });
    }
  }
  return hits.sort((a, b) => b.exact - a.exact || a.type.localeCompare(b.type) || a.id.localeCompare(b.id));
}

const commands = {
  find(...words) {
    const q = words.join(' ');
    if (!q) fail('Usage: find <words>');
    const hits = search(q);
    if (!hits.length) return console.log(`Nothing named "${q}". Try: node tools/query.mjs grep "${q}"`);
    for (const h of hits) console.log(`${h.type.padEnd(10)} ${h.id.padEnd(36)} ${h.name}${h.match !== h.name && h.match !== h.id ? `  (alias: ${h.match})` : ''}`);
  },

  show(id) {
    const { type, rec } = need(id);
    console.log(`${rec.name || rec.title} (${type}: ${rec.id})`);
    for (let [k, v] of Object.entries(rec)) {
      if (['id', 'name', 'title', 'images'].includes(k)) continue;
      if (LIMITED && typeof v === 'string' && UNSOURCED_LABELS.has(k)) continue;
      if (type === 'threads' && k === 'status') v = threadStatus(rec);
      const r = render(v);
      if (r) console.log(`${k}:\n${r}`);
    }
    const ix = DB.index;
    const fl = ix.firstLast?.[id];
    if (fl && !LIMITED) console.log(`first/last chapter: ${fl.first} .. ${fl.last}`);
    const apps = (ix.appearancesById?.[id] || []).filter(a => known(a.ch));
    if (apps.length) console.log(`appears in ${apps.length} chapters: ${apps.map(a => a.ch + (a.presence === 'on-page' ? '' : '*')).join(' ')}  (* = mentioned only)`);
    const evs = (ix.eventsByEntity?.[id] || []).filter(e => known(e.ch));
    if (evs.length) console.log(`events: ${[...new Set(evs.map(e => e.event))].filter(e => entKnown(e, 'events')).join(', ')}`);
    const relSince = from => (lookup(from)?.rec.relationships || []).find(r => r.with === id)?.since;
    const relTo = (ix.relationshipsTo?.[id] || []).filter(r => entKnown(r.from) && known(relSince(r.from)));
    if (relTo.length) console.log(`others' relationships to ${id}: ${relTo.map(r => LIMITED ? r.from : `${r.from} (${r.type})`).join('; ')}`);
    const facts = (ix.factsByEntity?.[id] || []).filter(f => known(factById.get(f)?.ref?.ch));
    if (facts.length) console.log(`${facts.length} facts: node tools/query.mjs facts ${id}`);
    if (rec.notes) console.log(`author notes: ${rec.notes}`);
  },

  facts(id, category) {
    need(id);
    const list = (DB.index.factsByEntity?.[id] || []).map(f => factById.get(f)).filter(Boolean)
      .filter(f => known(f.ref?.ch) && (!category || f.category === category));
    if (!list.length) return console.log('No facts.');
    for (const f of list) {
      const tags = [f.category, f.voice !== 'narration' ? f.voice : null, f.basis && f.basis !== 'stated' ? f.basis : null].filter(Boolean).join(', ');
      console.log(`${f.ref.ch} (${tags}) ${f.text} -- "${f.ref.quote}"`);
    }
    if (!category) {
      const cats = [...new Set(list.map(f => f.category))].sort();
      console.log(`\n${list.length} facts. Categories: ${cats.join(' ')}`);
    }
  },

  chapter(ch) {
    const c = DB.chapters[ch];
    if (!c) fail(`Unknown chapter "${ch}". Chapter ids look like b1-c03 (list them with: node tools/query.mjs chapters).`);
    if (!known(ch)) fail(`${ch} is after --until ${opts.until}.`);
    console.log(c.post ? `${c.id}: ${c.title} (post, read after ${DB.files[c.id]?.after})` : `${c.id}: Book ${c.book}, ${sectionName(c)}${c.title ? `: ${c.title}` : ''}`);
    if (c.dates?.start) console.log(`date: ${c.dates.start}${c.dates.end ? ' to ' + c.dates.end : ''} ${(c.dates.refs || []).map(cite).join(' ')}`);
    if (c.pov?.length) console.log(`POV: ${c.pov.map(p => `${p.id} "${p.quote}"`).join('; ')}`);
    console.log('summary:');
    for (const s of c.summary || []) console.log(`  - ${s.text} "${s.quote}"`);
    const on = (c.appearances || []).filter(a => a.presence === 'on-page').map(a => a.id);
    const off = (c.appearances || []).filter(a => a.presence !== 'on-page').map(a => a.id);
    if (on.length) console.log(`on page: ${on.join(', ')}`);
    if (off.length) console.log(`mentioned: ${off.join(', ')}`);
    if (c.events?.length) console.log(`events: ${c.events.map(e => e.id || e.event || e).join(', ')}`);
    console.log(`facts: ${(c.facts || []).length} (node tools/query.mjs grep or facts <id>)`);
  },

  chapters() {
    for (const c of Object.values(DB.chapters).sort((a, b) => a.order - b.order)) {
      if (!known(c.id)) continue;
      console.log(`${c.id.padEnd(18)} ${c.post ? `post: ${c.title}` : `Book ${c.book}, ${sectionName(c)}${c.title ? `: ${c.title}` : ''}`}`);
    }
  },

  grep(pattern) {
    if (!pattern) fail('Usage: grep <regex> [--book N]');
    let re;
    try { re = new RegExp(pattern, opts.case ? 'g' : 'gi'); } catch (e) { fail(`Bad regex: ${e.message}`); }
    // Reads the text mirror itself (not the DB), so chapters extracted but not yet parsed are searchable too.
    const files = Object.entries(loadConfig().files ?? {}).filter(([, f]) => f.text && (!opts.book || f.book === Number(opts.book)));
    let count = 0;
    const max = Number(opts.max) || 200;
    for (const [key, f] of files) {
      const path = join(ROOT, f.text);
      if (!existsSync(path)) continue;
      const text = readFileSync(path, 'utf8');
      // A post is one section; its id is its file key.
      const sections = f.kind === 'post' ? [{ id: key, lines: text.split('\n') }] : splitMirror(text, f.book);
      for (const sec of sections) {
        if (!known(sec.id)) continue;
        for (const line of sec.lines) {
          re.lastIndex = 0;
          const m = re.exec(line);
          if (!m) continue;
          const from = Math.max(0, m.index - 120), to = Math.min(line.length, m.index + m[0].length + 120);
          console.log(`${sec.id}: ${from ? '…' : ''}${line.slice(from, to)}${to < line.length ? '…' : ''}`);
          if (++count >= max) return console.log(`(stopped at ${max} matches; use --max N or a narrower pattern)`);
        }
      }
    }
    if (!count) console.log('No matches.');
  },

  threads(...filters) {
    const status = filters.find(f => f === 'open' || f === 'resolved');
    const about = filters.find(f => f !== status);
    if (about) need(about);
    for (const t of Object.values(DB.threads)) {
      if (!known(t.opened)) continue;
      const st = threadStatus(t);
      if (status && st !== status) continue;
      if (about && !(t.about || []).includes(about)) continue;
      const q = (t.question || []).filter(s => allKnown(s.refs)).map(s => s.text).join(' ');
      console.log(`${t.id} [${t.kind}, ${st}${t.authorStatus ? `, author: ${t.authorStatus}` : ''}, opened ${t.opened}] ${q}`);
    }
  },

  contradictions(about) {
    if (about) need(about);
    for (const c of DB.contradictions) {
      if (about && !(c.about || []).includes(about)) continue;
      const sides = (c.sides || []).map(s => ({ ...s, refs: (s.refs || []).filter(refKnown) })).filter(s => s.refs.length);
      if (UNTIL !== Infinity && sides.length < 2) continue;
      console.log(`${c.id} [${c.severity}, ${c.status}] ${c.text}`);
      for (const s of sides) console.log(`  - ${s.claim} ${s.refs.map(cite).join(' ')}`);
      if (c.authorComment) console.log(`  author: ${c.authorComment}`);
    }
  },

  together(a, b) {
    need(a); need(b);
    const chs = id => new Map((DB.index.appearancesById?.[id] || []).filter(x => known(x.ch)).map(x => [x.ch, x.presence]));
    const A = chs(a), B = chs(b);
    const both = [...A.keys()].filter(ch => B.has(ch)).sort((x, y) => order(x) - order(y));
    const onPage = both.filter(ch => A.get(ch) === 'on-page' && B.get(ch) === 'on-page');
    console.log(`both on page (${onPage.length}): ${onPage.join(' ') || 'none'}`);
    console.log(`both present or mentioned (${both.length}): ${both.join(' ') || 'none'}`);
    const evs = id => new Set((DB.index.eventsByEntity?.[id] || []).filter(e => known(e.ch)).map(e => e.event));
    const EB = evs(b);
    const shared = [...evs(a)].filter(e => EB.has(e));
    console.log(`shared events: ${shared.join(', ') || 'none'}`);
  },
};

if (!cmd || !commands[cmd]) {
  const lines = readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1);
  console.log(lines.slice(0, lines.findIndex(l => !l.startsWith('//'))).map(l => l.slice(3)).join('\n'));
  process.exit(cmd ? 1 : 0);
}
commands[cmd](...rest);
