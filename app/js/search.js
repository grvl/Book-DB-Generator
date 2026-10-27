// Global search across records, facts and (on demand) the full manuscript text.
'use strict';

// ---------- highlighting ----------

// Plain-text snippet of raw (asterisks dropped) around the first match, with every term marked.
function snippetHTML(raw, terms, width = 220) {
  raw = String(raw ?? '');
  const { text, map } = normMap(raw);
  const ranges = [];
  for (const t of terms ?? []) {
    if (!t) continue;
    for (let i = text.indexOf(t); i >= 0; i = text.indexOf(t, i + 1)) if (!isWordChar(text[i - 1])) ranges.push([map[i], map[i + t.length - 1] + 1]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  let from = 0, to = raw.length;
  if (raw.length > width) {
    const first = ranges[0]?.[0] ?? 0;
    from = Math.max(0, first - Math.floor(width / 3));
    to = Math.min(raw.length, from + width);
    if (from > 0) { const sp = raw.indexOf(' ', from); if (sp > 0 && sp < first) from = sp + 1; }
    if (to < raw.length) { const sp = raw.lastIndexOf(' ', to); if (sp > from) to = sp; }
  }
  let out = from > 0 ? '…' : '', pos = from;
  for (const [s, e] of ranges) {
    if (e <= pos || s >= to) continue;
    const a = Math.max(s, pos), b = Math.min(e, to);
    out += esc(plain(raw.slice(pos, a))) + '<mark>' + esc(plain(raw.slice(a, b))) + '</mark>';
    pos = b;
  }
  out += esc(plain(raw.slice(pos, to))) + (to < raw.length ? '…' : '');
  return out;
}

// Wraps every match of the normalized needle inside root's text in <mark class="cls">. Returns the marks.
function markText(root, needle, cls = '', wordStart = false) {
  if (!needle) return [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let full = '';
  let block = null;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    // A paragraph break counts as a space (as in the build's quote check), so a quote may span paragraphs.
    const b = n.parentElement?.closest('p, h1, h2, h3, div, li, blockquote');
    if (block && b !== block) full += ' ';
    block = b;
    nodes.push({ n, start: full.length });
    full += n.nodeValue;
  }
  const { text, map } = normMap(full);
  const ranges = [];
  for (let i = text.indexOf(needle); i >= 0; i = text.indexOf(needle, i + needle.length)) {
    if (wordStart && isWordChar(text[i - 1])) { i -= needle.length - 1; continue; }
    ranges.push([map[i], map[i + needle.length - 1] + 1]);
  }
  const marks = [];
  for (let r = ranges.length - 1; r >= 0; r--) {
    const [s, e] = ranges[r];
    const group = [];
    for (let k = nodes.length - 1; k >= 0; k--) {
      const { n, start } = nodes[k];
      const len = n.nodeValue.length;
      if (start >= e || start + len <= s) continue;
      const a = Math.max(s, start) - start, b = Math.min(e, start + len) - start;
      if (b < len) n.splitText(b);
      const mid = a > 0 ? n.splitText(a) : n;
      const m = document.createElement('mark');
      if (cls) m.className = cls;
      mid.parentNode.insertBefore(m, mid);
      m.appendChild(mid);
      group.unshift(m);
    }
    marks.unshift(...group);
  }
  return marks;
}
function unmark(root) {
  $$('mark', root).forEach((m) => { m.replaceWith(...m.childNodes); });
  root.normalize();
}

// ---------- index ----------

const SEARCH_KINDS = [
  ['', 'All'], ['characters', 'Characters'], ['places', 'Places'], ['events', 'Events'], ['groups', 'Groups'], ['lore', 'Lore'],
  ['chapters', 'Chapters'], ['threads', 'Threads'], ['contradictions', 'Contradictions'], ['facts', 'Facts'], ['text', 'Manuscript'],
];
const KIND_BOOST = { characters: 40, places: 30, groups: 30, lore: 30, events: 28, chapters: 22, threads: 15, contradictions: 10, facts: 0 };
let SEARCH_DOCS = null;

function profileText(c) {
  const vals = [];
  for (const [k, v] of Object.entries(c.profile ?? {})) for (const x of valueTexts(v)) vals.push(`${PROFILE_LABEL[k] ?? k} ${x}`);
  return vals.join(' ');
}
const okText = (sentences) => (sentences ?? []).filter((s) => allOk(s.refs ?? [])).map((s) => s.text).join(' ');

// Rebuilt when reader mode changes, so hidden text never matches.
function buildSearchDocs() {
  const docs = [];
  for (const t of ENTITY_ORDER) {
    for (const e of Object.values(DB[t])) {
      if (!entOk(e.id, t)) continue;
      const name = t === 'events' ? e.title : e.name;
      const aliases = (e.aliases ?? []).filter((a) => anyOk(a.refs)).map((a) => a.value);
      const body = [navLabel(e.role), e.type, e.kind, ...(e.tags ?? []), okText(e.summary ?? e.synopsis), t === 'characters' ? profileText(e) : '', ...(e.details ?? []).filter((d) => allOk(d.refs)).map((d) => `${d.label} ${d.value}`)].filter(Boolean).join(' ');
      const books = t === 'events' ? new Set(eventChs(e.id).map(bookOf)) : appearStats(e.id).books;
      docs.push({ kind: t, id: e.id, name, title: sNorm(name), alias: sNorm(aliases.join(' | ')), imp: e.importance, hay: sNorm(`${name} ${aliases.join(' ')} ${body}`), books, snip: [aliases.length ? 'Also: ' + aliases.join(', ') : '', okText(e.summary ?? e.synopsis)].filter(Boolean).join(' — ') });
    }
  }
  for (const c of TEXT_LIST) {
    if (!chOk(c.id)) continue;
    const summary = (c.summary ?? []).map((s) => s.text).join(' ');
    docs.push({ kind: 'chapters', id: c.id, name: `${chLabel(c.id)} ${c.title ?? ''}`, title: sNorm(`${c.title ?? ''} ${c.post ? 'post' : chName(c)}`), alias: '', hay: sNorm(`${c.title ?? ''} ${summary} ${povNames(c)}`), books: new Set([c.book]), snip: summary, ord: c.order });
  }
  for (const th of Object.values(DB.threads)) {
    if (!entOk(th.id, 'threads')) continue;
    const q = okText(th.question);
    const rest = okText([...(th.developments ?? []).filter((d) => chOk(d.ch)).flatMap((d) => d.text ?? []), ...(threadTextResolved(th) ? th.resolution.text : [])]);
    docs.push({ kind: 'threads', id: th.id, name: q, title: sNorm(q), alias: '', hay: sNorm(`${q} ${rest} ${th.kind}`), books: new Set([bookOf(th.opened)]), snip: rest, ord: ord(th.opened) });
  }
  for (const c of DB.contradictions) {
    if (!contraOk(c)) continue;
    const claims = c.sides.map((s) => s.claim).join(' / ');
    docs.push({ kind: 'contradictions', id: c.id, name: c.text, title: sNorm(c.text), alias: '', hay: sNorm(`${c.text} ${claims} ${(c.about ?? []).map((x) => entName(x)).join(' ')}`), books: new Set(c.sides.flatMap((s) => (s.refs ?? []).map((r) => r.ch && bookOf(r.ch)).filter(Boolean))), snip: claims });
  }
  FACTS.forEach((f) => {
    if (!refOk(f.ref)) return;
    const about = (f.about ?? []).map((x) => plain(entName(x))).join(' ');
    docs.push({ kind: 'facts', id: f.id, fact: f, name: f.text, title: '', alias: '', about: sNorm(about), aspect: sNorm(`${f.aspect ?? ''} ${CATEGORY_LABEL[f.category] ?? ''} ${f.category}`), hay: sNorm(`${f.text} ${f.ref.quote} ${f.aspect ?? ''} ${CATEGORY_LABEL[f.category] ?? f.category} ${about} ${f.speaker ? entName(f.speaker) : ''}`), books: new Set([bookOf(f.ref.ch)]), ord: ord(f.ref.ch) });
  });
  return docs;
}

// Records whose name matches rank first; records that only mention the words rank below facts
// that are about a named entity and in a named category (so "anna hair" finds Anna's hair facts).
function scoreDoc(d, terms, q) {
  if (d.kind === 'facts') {
    let s = 0;
    for (const t of terms) { if (d.about.includes(' ' + t)) s += 7; if (d.aspect.includes(' ' + t)) s += 9; }
    return s;
  }
  let hits = 0;
  for (const t of terms) if (d.title.includes(' ' + t) || d.alias.includes(' ' + t)) hits++;
  if (!hits) return 2;
  let s = (KIND_BOOST[d.kind] ?? 0) + hits * 12 + ({ major: 4, supporting: 2 }[d.imp] ?? 0);
  if (d.title === q) s += 200;
  else if (d.title.startsWith(q.trimEnd())) s += 90;
  else if (d.title.includes(q.trimEnd())) s += 60;
  if (d.alias.includes(q)) s += 120;
  else if (d.alias.includes(q.trimEnd())) s += 40;
  return s;
}

function searchDocs(q, kind, book) {
  SEARCH_DOCS ??= buildSearchDocs();
  const m = makeMatcher(q);
  if (!m) return [];
  const nq = sNorm(q.replace(/"/g, ''));
  const out = [];
  for (const d of SEARCH_DOCS) {
    if (kind && d.kind !== kind) continue;
    if (book && !d.books.has(Number(book))) continue;
    if (!m(d.hay)) continue;
    out.push({ d, s: scoreDoc(d, m.terms, nq) });
  }
  out.sort((a, b) => b.s - a.s || (a.d.ord ?? 0) - (b.d.ord ?? 0));
  return out.map((x) => x.d);
}

// ---------- manuscript search ----------

let PARAS = null;
function manuscriptIndex() {
  if (PARAS) return PARAS;
  PARAS = [];
  for (const c of TEXT_LIST) paragraphs(c.id).forEach((raw, i) => { if (raw !== '***') PARAS.push({ ch: c.id, i, raw, n: sNorm(raw) }); });
  return PARAS;
}
function searchText(q, book) {
  const m = makeMatcher(q);
  if (!m) return [];
  return manuscriptIndex().filter((p) => chOk(p.ch) && (!book || bookOf(p.ch) === Number(book)) && m(p.n));
}

// ---------- view ----------

const KIND_LABEL = { characters: 'Character', places: 'Place', events: 'Event', groups: 'Group', lore: 'Lore', chapters: 'Chapter', threads: 'Thread', contradictions: 'Contradiction', facts: 'Fact' };
function hitHTML(d, terms) {
  if (d.kind === 'facts') {
    const f = d.fact;
    return `<div class="hit"><div class="kind">Fact · ${esc(CATEGORY_LABEL[f.category] ?? f.category)}${f.aspect ? ' · ' + esc(f.aspect) : ''}</div><div>${snippetHTML(f.text, terms, 400)}${basisBadge(f.basis)} ${citeChip(f.ref)}</div><div class="snip serif">“${snippetHTML(f.ref.quote, terms, 400)}”</div><div class="about small faint">${(f.about ?? []).map((x) => entLink(x)).join(', ')}</div></div>`;
  }
  const href = d.kind === 'chapters' ? `#/chapter/${d.id}` : d.kind === 'contradictions' ? `#/contradiction/${encodeURIComponent(d.id)}` : entHref(d.id, d.kind);
  return `<div class="hit"><div class="kind">${KIND_LABEL[d.kind]}</div><a class="t" href="${href}">${snippetHTML(d.name, terms, 300)}</a>${d.snip ? `<div class="snip">${snippetHTML(d.snip, terms)}</div>` : ''}</div>`;
}

function viewSearch(el, params) {
  const q = params.get('q') ?? '';
  setTitle(q ? `“${q}”` : 'Search');
  const input = $('#topq');
  if (input && input.value !== q) input.value = q;
  el.innerHTML = `<div class="page-head"><h1>Search</h1></div>
    <form class="filters" id="sf">
      ${bookSeg(params.get('book') ?? '')}
    </form>
    <div class="chips" id="kinds" style="margin-bottom:10px"></div>
    <div class="resultbar"><span id="n"></span></div><div id="res"></div>
    <p class="help" style="margin-top:16px">Every word must match (accents and curly quotes don't matter). Use <code>"exact phrase"</code> and <code>-exclude</code>. Facts also match the names of who they're about, so a name plus a word, like <code>anna hair</code>, works. <b>Manuscript</b> searches the full text of every chapter.</p>`;
  let kind = params.get('k') ?? '';
  const form = $('#sf', el);
  const run = (v) => {
    v.q = $('#topq')?.value ?? '';
    setParams({ q: v.q, k: kind, book: v.book });
    setTitle(v.q ? `“${v.q}”` : 'Search');
    const m = makeMatcher(v.q);
    const res = $('#res', el);
    if (!m) { $('#kinds', el).innerHTML = ''; $('#n', el).textContent = ''; res.innerHTML = '<div class="empty">Type to search names, aliases, summaries, facts, threads, contradictions and chapters.</div>'; return; }
    const all = searchDocs(v.q, '', v.book);
    const counts = {};
    for (const d of all) counts[d.kind] = (counts[d.kind] ?? 0) + 1;
    const textCount = window.DB_TEXT ? searchText(v.q, v.book).length : null;
    $('#kinds', el).innerHTML = SEARCH_KINDS.filter(([k]) => !k || counts[k] || k === 'text').map(([k, l]) => `<button type="button" class="chip${kind === k ? ' on' : ''}" data-k="${k}">${l}<span class="n">${k === 'text' ? (textCount ?? '…') : k ? counts[k] : all.length}</span></button>`).join('');
    if (kind === 'text') {
      res.innerHTML = '<div class="loading">Loading the manuscript…</div>';
      loadText().then(() => {
        if ($('#res', el) !== res) return;
        const hits = searchText(v.q, v.book);
        $('[data-k="text"] .n', el)?.replaceChildren(String(hits.length));
        const perCh = {};
        for (const h of hits) perCh[h.ch] = (perCh[h.ch] ?? 0) + 1;
        $('#n', el).textContent = `${plural(hits.length, 'paragraph')} in ${plural(Object.keys(perCh).length, 'chapter')}`;
        let last = null;
        res.className = 'card';
        paged(res, hits, (items) => items.map((h) => {
          const head = h.ch !== last ? `<div class="chhead"><a href="#/chapter/${h.ch}">${esc(chLong(h.ch))}</a> <span class="faint">${perCh[h.ch]}</span></div>` : '';
          last = h.ch;
          return `${head}<a class="hit" style="display:block;color:inherit" href="#/read/${h.ch}?p=${h.i}&find=${encodeURIComponent(v.q)}"><div class="snip serif">${snippetHTML(h.raw, m.terms, 320)}</div></a>`;
        }).join(''), 50);
        if (!hits.length) res.innerHTML = '<div class="empty">No paragraph contains all of those words.</div>';
      }).catch((e) => { res.innerHTML = `<div class="notice warn">${esc(e.message)}</div>`; });
      return;
    }
    res.className = 'card';
    const list = kind ? all.filter((d) => d.kind === kind) : all;
    $('#n', el).textContent = plural(list.length, 'result');
    if (!list.length) { res.className = ''; res.innerHTML = `<div class="empty">No results. Try fewer words, or <button type="button" class="linkbtn" data-k="text">search the manuscript</button>.</div>`; return; }
    paged(res, list, (items) => items.map((d) => hitHTML(d, m.terms)).join(''), 50);
  };
  const read = bindFilters(form, run);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (!b) return;
    kind = b.dataset.k;
    run(read());
  });
  searchRerun = () => run(read());
  run(read());
  if (!q) input?.focus();
}
// Set by the search view; the header search box calls it while the search page is open.
let searchRerun = null;
