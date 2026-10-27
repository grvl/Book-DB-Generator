// Entity views: characters, places, events, groups and lore (lists and detail pages).
'use strict';

// ---------- shared pieces ----------

function headHTML({ title, sub, crumbs, image, avatar = true, labels = '' }) {
  const av = avatar ? `<div class="avatar lg">${image ? `<img src="${esc(image)}" alt="">` : esc(initials(title))}</div>` : '';
  return `${crumbs ? `<div class="crumbs">${crumbs}</div>` : ''}<div class="ehead">${av}<div class="meta"><h1>${md(title)}</h1>${sub ? `<div class="sub muted">${sub}</div>` : ''}${labels ? `<div class="labels">${labels}</div>` : ''}</div></div>`;
}
function notYetHTML(id, type) {
  if (entOk(id, type)) return '';
  return `<div class="notice warn">Reader mode is on (${esc(asOfLabel())}). A reader doesn't know about this yet, so everything after that point is hidden. <button type="button" class="linkbtn" data-action="asof">Change</button></div>`;
}
function aliasesHTML(aliases) {
  const list = (aliases ?? []).filter((a) => anyOk(a.refs));
  if (!list.length) return '';
  return `<div class="aliases">Also called ${list.map((a) => `<span class="nowrap">${md(a.value)}${cites(okRefs(a.refs))}</span>`).join(', ')}</div>`;
}
function card(title, body, { count, id } = {}) {
  if (!body) return '';
  return `<section class="card"${id ? ` id="${id}"` : ''}><h2>${title}${count != null ? `<span class="count">${count}</span>` : ''}</h2>${body}</section>`;
}
function fold(title, count, attrs, body = '') {
  return `<details class="fold" ${attrs}><summary>${title}<span class="count">${count}</span></summary><div class="body">${body}</div></details>`;
}
function imagesHTML(id, e) {
  const files = DB.images?.[id] ?? [];
  if (files.length < 2) return '';
  const cap = (f) => (e.images ?? []).find((x) => f.endsWith('/' + x.file))?.caption ?? '';
  return card('Gallery', `<div class="grid">${files.map((f) => `<figure style="margin:0"><img src="${esc(f)}" alt="" style="width:100%;border-radius:8px"><figcaption class="small muted">${esc(cap(f))}</figcaption></figure>`).join('')}</div>`);
}
function notesHTML(e) {
  return (e.notes ? card('Author notes', `<p>${esc(e.notes).replace(/\n/g, '<br>')}</p>`) : '')
    + `<div class="faint small" style="margin-top:6px">ID <code style="user-select:all">${esc(e.id)}</code> (the filename for its images in <code>media/</code>)</div>`;
}
function threadsHTML(id) {
  const list = (THREADS_ABOUT[id] ?? []).map((t) => DB.threads[t]).filter((t) => entOk(t.id, 'threads'));
  if (!list.length) return '';
  return card('Plot threads', `<div class="list">${list.map(threadRowHTML).join('')}</div>`, { count: list.length });
}
function contrasHTML(id) {
  const list = (CONTRA_ABOUT[id] ?? []).map((c) => CONTRA[c]).filter(contraOk);
  if (!list.length) return '';
  return card('Contradictions', `<div class="list">${list.map((c) => `<a class="row" href="#/contradiction/${encodeURIComponent(c.id)}"><div class="title">${md(c.text)}</div><div class="line2"><span class="badge ${c.status}">${esc(c.status)}</span> <span class="badge ${c.severity}">${esc(c.severity)}</span> ${esc(c.kind)}</div></a>`).join('')}</div>`, { count: list.length });
}
function appearancesFold(id) {
  const list = (IX.appearancesById[id] ?? []).filter((a) => chOk(a.ch)).sort(byKey((a) => ord(a.ch)));
  if (!list.length) return '';
  const on = list.filter((a) => a.presence === 'on-page').length;
  const body = list.map((a) => `<div class="fact"><a href="#/chapter/${a.ch}">${esc(chLong(a.ch))}</a> ${presenceBadge(a.presence)} ${citeChip(chRef(a.ch, a.quote))}</div>`).join('');
  return fold('Chapter appearances', `${on} on page · ${list.length - on} mentioned`, '', body);
}

// Facts about an entity, one fold per category, rendered when opened.
function factFolds(id, { open = [], order = CATEGORY_ORDER } = {}) {
  const facts = factsAbout(id).filter((f) => refOk(f.ref));
  if (!facts.length) return '';
  const byCat = {};
  for (const f of facts) (byCat[f.category] ??= []).push(f);
  const cats = order.filter((c) => byCat[c]).concat(Object.keys(byCat).filter((c) => !order.includes(c)));
  const quotes = store.get('quotes', false);
  const head = `<div class="resultbar"><span>${plural(facts.length, 'fact')} from the chapters</span><span><label class="chk small"><input type="checkbox" data-action="quotes"${quotes ? ' checked' : ''}> Show quotes</label> · <a href="#/facts?about=${encodeURIComponent(id)}">Open in fact explorer</a></span></div>`;
  return `<div class="section" data-factfolds="${esc(id)}">${head}${cats.map((c) => fold(esc(CATEGORY_LABEL[c] ?? cap(c)), byCat[c].length, `data-cat="${c}"${open.includes(c) ? ' open' : ''}`)).join('')}</div>`;
}
function renderFactFold(details) {
  const id = details.closest('[data-factfolds]').dataset.factfolds;
  const cat = details.dataset.cat;
  const quote = store.get('quotes', false);
  const facts = factsAbout(id).filter((f) => refOk(f.ref) && f.category === cat).sort(byKey((x) => ord(x.ref.ch)));
  const body = details.querySelector('.body');
  const aspects = uniq(facts.map((f) => f.aspect).filter(Boolean));
  if (cat === 'outfit' || aspects.length < 2) {
    body.innerHTML = factsByChapterHTML(facts, { except: id, quote });
  } else {
    const groups = {};
    for (const f of facts) (groups[f.aspect ?? ''] ??= []).push(f);
    const keys = Object.keys(groups).sort((a, b) => (a === '' ? 1 : b === '' ? -1 : collator.compare(a, b)));
    body.innerHTML = keys.map((k) => `<div class="grouphead">${esc(k || 'general')} <span class="faint">${groups[k].length}</span></div>${groups[k].map((f) => factHTML(f, { except: id, quote })).join('')}`).join('');
  }
  details.dataset.rendered = '1';
}
// Opening a fold renders it; toggling "Show quotes" re-renders the open ones.
document.addEventListener('toggle', (e) => {
  const d = e.target;
  if (d.matches?.('details[data-cat]') && d.open && !d.dataset.rendered) renderFactFold(d);
}, true);
document.addEventListener('change', (e) => {
  if (e.target.matches('[data-action="quotes"]')) {
    store.set('quotes', e.target.checked);
    $$('details[data-cat]').forEach((d) => { delete d.dataset.rendered; if (d.open) renderFactFold(d); });
  }
});
function openFactFolds(el) { $$('details[data-cat][open]', el).forEach(renderFactFold); }

// ---------- characters ----------

// The standard profile keys, then any extra ones from config.json ("extraProfileFields").
const PROFILE_LABEL = { fullName: 'Full name', title: 'Title', birthday: 'Birthday', ageAtStart: 'Age at start', origin: 'Origin', occupation: 'Occupation', hair: 'Hair', eyes: 'Eyes', height: 'Height', build: 'Build', marks: 'Marks', status: 'Status', ...(PROJECT.extraProfileFields ?? {}) };
const IMPORTANCE = [['major', 'Major'], ['supporting', 'Supporting'], ['minor', 'Minor']];
const IMP_RANK = { major: 0, supporting: 1, minor: 2 };

function appearStats(id) {
  const s = { on: 0, men: 0, books: new Set(), onBooks: new Set() };
  const chs = {};
  for (const a of IX.appearancesById[id] ?? []) {
    if (!chOk(a.ch)) continue;
    if (chs[a.ch] !== 'on-page') chs[a.ch] = a.presence;
  }
  for (const [ch, p] of Object.entries(chs)) {
    if (p === 'on-page') { s.on++; s.onBooks.add(bookOf(ch)); } else s.men++;
    s.books.add(bookOf(ch));
  }
  return s;
}

function viewCharacters(el, params) {
  setTitle('Characters');
  const groupsWithMembers = knownIds(Object.keys(MEMBERS), 'groups').filter((g) => DB.groups[g]).map((g) => [g, DB.groups[g].name]).sort((a, b) => collator.compare(a[1], b[1]));
  el.innerHTML = `<div class="page-head"><h1>Characters</h1><div class="sub">Navigation labels (role, importance) are not story facts.</div></div>
    <form class="filters">
      <input type="search" name="q" placeholder="Filter by name, alias or role" value="${esc(params.get('q') ?? '')}">
      ${segHTML('imp', [['', 'All'], ...IMPORTANCE], params.get('imp') ?? '')}
      ${bookSelect(params.get('book') ?? '', (b) => `Appears in Book ${b}`)}
      ${selectHTML('pres', [['on', 'On page'], ['men', 'Only mentioned']], params.get('pres') ?? '', 'On page or mentioned')}
      ${selectHTML('grp', groupsWithMembers, params.get('grp') ?? '', 'Any group')}
      ${selectHTML('sort', [['first', 'First appearance'], ['name', 'Name A–Z'], ['most', 'Most chapters']], params.get('sort') ?? '', 'Sort: importance')}
    </form><div class="resultbar"><span id="n"></span></div><div id="res" class="grid"></div>`;
  const all = Object.values(DB.characters).map((c) => ({
    c, stats: appearStats(c.id),
    hay: sNorm([c.name, navLabel(c.role), ...(c.aliases ?? []).filter((a) => anyOk(a.refs)).map((a) => a.value), ...valueTexts(c.profile?.fullName)].filter(Boolean).join(' ')),
  }));
  const update = (v) => {
    setParams(v);
    const m = makeMatcher(v.q);
    let list = all.filter(({ c, stats, hay }) => entOk(c.id, 'characters')
      && (!m || m(hay))
      && (!v.imp || c.importance === v.imp)
      && (!v.book || (v.pres === 'on' ? stats.onBooks : stats.books).has(Number(v.book)))
      && (!v.pres || (v.pres === 'on' ? stats.on > 0 : stats.on === 0 && stats.men > 0))
      && (!v.grp || (MEMBERS[v.grp] ?? []).some((x) => x.id === c.id)));
    const first = (x) => FIRST_SEEN[x.c.id] ?? Infinity;
    if (v.sort === 'name') list.sort((a, b) => collator.compare(a.c.name, b.c.name));
    else if (v.sort === 'first') list.sort((a, b) => first(a) - first(b) || collator.compare(a.c.name, b.c.name));
    else if (v.sort === 'most') list.sort((a, b) => b.stats.on + b.stats.men - (a.stats.on + a.stats.men) || collator.compare(a.c.name, b.c.name));
    else list.sort((a, b) => (IMP_RANK[a.c.importance] ?? 3) - (IMP_RANK[b.c.importance] ?? 3) || (b.stats.on - a.stats.on) || collator.compare(a.c.name, b.c.name));
    $('#n', el).textContent = plural(list.length, 'character');
    paged($('#res', el), list, (items) => items.map(({ c, stats }) => `<a class="ecard" href="#/character/${encodeURIComponent(c.id)}">
      <div class="avatar">${entImage(c.id) ? `<img src="${esc(entImage(c.id))}" alt="" loading="lazy">` : esc(initials(c.name))}</div>
      <div class="meta"><div class="name">${md(c.name)}</div><div class="role">${esc(navLabel(c.role))}</div><div class="stat">${stats.on ? `on page in ${plural(stats.on, 'chapter')}` : stats.men ? `mentioned in ${plural(stats.men, 'chapter')}` : 'no chapter appearances'}</div></div></a>`).join(''), 90);
  };
  update(bindFilters($('form', el), update)());
}

function viewCharacter(el, id) {
  const c = DB.characters[id];
  if (!c) return notFound(el);
  setTitle(c.name);
  const p = c.profile ?? {};
  const profile = Object.keys(PROFILE_LABEL).filter((k) => k in p).map((k) => {
    const fmt = k === 'birthday' ? (v) => esc(fmtDate(v)) : undefined;
    return `<dt>${PROFILE_LABEL[k]}</dt><dd>${valueHTML(p[k], { format: fmt, strict: true })}</dd>`;
  }).join('');
  const groups = (c.groups ?? []).filter((g) => allOk(g.refs)).map((g) => `<div class="fact">${entLink(g.id, 'groups')}${g.role ? ` <span class="muted">· ${md(g.role)}</span>` : ''} ${cites(g.refs)}</div>`).join('');
  const personality = (c.personality ?? []).filter((t) => allOk(t.refs)).map((t) => `<div class="fact"><b>${md(t.trait)}</b>${basisBadge(t.basis)} ${t.note ? `<span>${md(t.note)}</span>` : ''} ${cites(t.refs)}</div>`).join('');
  const rels = (c.relationships ?? []).filter((r) => entOk(r.with) && (!r.since || chOk(r.since))).map((r) => `<div class="fact" id="rel-${esc(r.with)}"><div><b>${entLink(r.with)}</b>${navLabel(r.type) ? ` <span class="muted">· ${md(r.type)}</span>` : ''}${r.since ? ` <span class="faint small">since <a href="#/chapter/${r.since}">${chLabel(r.since)}</a></span>` : ''}</div>${proseHTML(r.note)}</div>`).join('');
  const incoming = (IX.relationshipsTo[id] ?? []).filter((r) => entOk(r.from) && !(c.relationships ?? []).some((x) => x.with === r.from) && (() => { const rr = DB.characters[r.from]?.relationships?.find((x) => x.with === id); return !rr?.since || chOk(rr.since); })())
    .map((r) => `<a class="pill" href="#/character/${encodeURIComponent(r.from)}">${md(entName(r.from))} <span class="faint">${md(navLabel(r.type))}</span></a>`).join('');
  const arcs = (c.arcs ?? []).map((a) => { const t = proseHTML(a.text); return t ? `<div class="grouphead">${MULTI_BOOK ? `Book ${a.book}` : esc(bookTitle(a.book))}</div>${t}` : ''; }).join('');

  // Events and the places they happened at, from the chapter files.
  const evs = {};
  for (const x of IX.eventsByEntity[id] ?? []) {
    if (!chOk(x.ch) || !DB.events[x.event]) continue;
    const e = (evs[x.event] ??= { id: x.event, chs: [], on: false });
    e.chs.push(x.ch);
    if (x.presence === 'on-page') e.on = true;
  }
  const evList = Object.values(evs).sort(byKey((e) => Math.min(...e.chs.map(ord))));
  const places = {};
  for (const e of evList) for (const part of IX.eventChapters[e.id] ?? []) {
    if (!e.chs.includes(part.ch)) continue;
    if (!part.participants.some((x) => x.id === id && x.presence === 'on-page')) continue;
    for (const pl of part.places) if (DB.places[pl.id]) (places[pl.id] ??= new Set()).add(part.ch);
  }
  const fl = IX.firstLast[id];
  const stats = appearStats(id);
  const firstLast = fl && stats.on + stats.men ? `First seen <a href="#/chapter/${fl.first}">${chLabel(fl.first)}</a>${chOk(fl.last) ? ` · last seen <a href="#/chapter/${fl.last}">${chLabel(fl.last)}</a>` : ''}` : '';

  el.innerHTML = notYetHTML(id, 'characters') + headHTML({
    title: c.name, image: entImage(id), crumbs: '<a href="#/characters">Characters</a>',
    sub: [esc(navLabel(c.role)), firstLast].filter(Boolean).join(' · '),
    labels: `<span class="badge">${esc(c.importance ?? '')}</span>`,
  }) + aliasesHTML(c.aliases)
    + `<section class="card" style="margin-top:12px"><h2>Chapters</h2>${stripHTML(IX.appearancesById[id])}</section>`
    + `<div class="two"><div>`
    + card('At a glance', `<dl class="kv">${profile}</dl>`)
    + card('Groups', groups)
    + `</div><div>`
    + card('Summary', proseHTML(c.summary))
    + card('Personality', personality)
    + `</div></div>`
    + card('Relationships', rels + (incoming ? `<div class="grouphead">Also linked from</div><div>${incoming}</div>` : ''))
    + card('Arcs', arcs)
    + factFolds(id, { open: ['appearance', 'outfit'] })
    + (evList.length ? fold('Events', evList.length, '', `<div class="list">${evList.map((e) => `<a class="row" href="#/event/${encodeURIComponent(e.id)}"><div class="title">${md(DB.events[e.id].title)} ${e.on ? '' : '<span class="badge">mentioned</span>'}</div><div class="line2">${uniq(e.chs).sort(byKey(ord)).map(chLabel).join(', ')}</div></a>`).join('')}</div>`) : '')
    + (Object.keys(places).length ? fold('Places (from events on page)', Object.keys(places).length, '', Object.entries(places).map(([pid, chs]) => `<a class="pill" href="#/place/${encodeURIComponent(pid)}">${md(entName(pid, 'places'))} <span class="faint">${[...chs].sort(byKey(ord)).map(chLabel).join(', ')}</span></a>`).join('')) : '')
    + appearancesFold(id)
    + threadsHTML(id) + contrasHTML(id) + imagesHTML(id, c) + notesHTML(c);
  openFactFolds(el);
}

// ---------- places ----------

function placeChain(id) {
  const chain = [];
  let p = DB.places[id], guard = 0;
  while (p?.parent && guard++ < 20) {
    const pv = p.parent.disputed ? p.parent.disputed[0] : p.parent;
    if (!pv?.value || !anyOk(pv.refs)) break;
    chain.unshift(pv.value);
    p = DB.places[pv.value];
  }
  return chain;
}
function parentOf(id) { const ch = placeChain(id); return ch[ch.length - 1] ?? null; }

function viewPlaces(el, params) {
  setTitle('Places');
  const types = uniq(Object.values(DB.places).map((p) => p.type).filter(Boolean)).sort(collator.compare);
  el.innerHTML = `<div class="page-head"><h1>Places</h1></div>
    <form class="filters">
      <input type="search" name="q" placeholder="Filter by name or alias" value="${esc(params.get('q') ?? '')}">
      ${selectHTML('type', types.map((t) => [t, cap(t)]), params.get('type') ?? '', 'Any type')}
      ${bookSelect(params.get('book') ?? '', (b) => `Appears in Book ${b}`)}
      ${segHTML('view', [['', 'Tree'], ['list', 'List']], params.get('view') ?? '')}
    </form><div class="resultbar"><span id="n"></span></div><div id="res" class="card"></div>`;
  const update = (v) => {
    setParams(v);
    const m = makeMatcher(v.q);
    const list = Object.values(DB.places).filter((p) => entOk(p.id, 'places')
      && (!m || m(sNorm([p.name, ...(p.aliases ?? []).map((a) => a.value)].join(' '))))
      && (!v.type || p.type === v.type)
      && (!v.book || appearStats(p.id).books.has(Number(v.book))));
    $('#n', el).textContent = plural(list.length, 'place');
    const row = (p, depth = 0) => { const s = appearStats(p.id); return `<a class="row" href="#/place/${encodeURIComponent(p.id)}" style="padding-left:${depth * 18 + 2}px"><div class="title">${md(p.name)} <span class="faint small">${esc(p.type ?? '')}</span></div><div class="line2">${s.on ? `on page in ${plural(s.on, 'chapter')}` : s.men ? `mentioned in ${plural(s.men, 'chapter')}` : ''}${depth === 0 && placeChain(p.id).length ? ' · in ' + placeChain(p.id).map((x) => md(entName(x, 'places'))).join(' › ') : ''}</div></a>`; };
    const res = $('#res', el);
    if (v.view === 'list' || m || v.type || v.book) {
      list.sort((a, b) => collator.compare(a.name, b.name));
      res.innerHTML = list.map((p) => row(p)).join('') || '<div class="empty">No places match.</div>';
      return;
    }
    const kids = {};
    const ids = new Set(list.map((p) => p.id));
    const roots = [];
    for (const p of list) { const par = parentOf(p.id); if (par && ids.has(par)) (kids[par] ??= []).push(p); else roots.push(p); }
    const walk = (p, d) => row(p, d) + (kids[p.id] ?? []).sort((a, b) => collator.compare(a.name, b.name)).map((k) => walk(k, d + 1)).join('');
    res.innerHTML = roots.sort((a, b) => (kids[b.id]?.length ?? 0) - (kids[a.id]?.length ?? 0) || collator.compare(a.name, b.name)).map((p) => walk(p, 0)).join('');
  };
  update(bindFilters($('form', el), update)());
}

function viewPlace(el, id) {
  const p = DB.places[id];
  if (!p) return notFound(el);
  setTitle(p.name);
  const chain = placeChain(id);
  const children = (IX.childPlaces[id] ?? []).filter((k) => entOk(k, 'places') && parentOf(k) === id);
  const events = (IX.eventsByPlace[id] ?? []).filter((e) => DB.events[e] && (IX.eventChapters[e] ?? []).some((x) => chOk(x.ch) && x.places.some((pl) => pl.id === id)));
  const seenHere = {};
  for (const e of events) for (const part of IX.eventChapters[e]) {
    if (!chOk(part.ch) || !part.places.some((pl) => pl.id === id)) continue;
    for (const x of part.participants) if (x.presence === 'on-page' && DB.characters[x.id]) (seenHere[x.id] ??= new Set()).add(part.ch);
  }
  const chs = (IX.appearancesById[id] ?? []).filter((a) => a.presence === 'on-page' && chOk(a.ch));
  const parentV = p.parent ? valueHTML(p.parent, { format: (v) => entLink(v, 'places') }) : '';
  el.innerHTML = notYetHTML(id, 'places') + headHTML({
    title: p.name, image: entImage(id), avatar: !!entImage(id),
    crumbs: `<a href="#/places">Places</a>${chain.map((x) => ' › ' + entLink(x, 'places')).join('')}`,
    sub: esc(p.type ?? ''),
  }) + aliasesHTML(p.aliases)
    + (p.parent ? `<p class="small muted" style="margin-top:8px">Inside: ${parentV}</p>` : '')
    + card('Summary', proseHTML(p.summary))
    + card('Places inside', children.map((k) => `<a class="pill" href="#/place/${encodeURIComponent(k)}">${md(entName(k, 'places'))}</a>`).join(''), { count: children.length || null })
    + factFolds(id, { open: ['description', 'geography'] })
    + card('Events here', events.length ? `<div class="list">${events.map((e) => eventRowHTML(DB.events[e])).join('')}</div>` : '', { count: events.length })
    + card('Characters seen here (in events)', Object.entries(seenHere).sort((a, b) => collator.compare(entName(a[0]), entName(b[0]))).map(([cid, s]) => `<a class="pill" href="#/character/${encodeURIComponent(cid)}">${md(entName(cid))} <span class="faint">${[...s].sort(byKey(ord)).map(chLabel).join(', ')}</span></a>`).join(''))
    + (chs.length ? card('Chapters set here', `<div>${uniq(chs.map((a) => a.ch)).sort(byKey(ord)).map((ch) => `<a class="pill" href="#/chapter/${ch}">${chLabel(ch)}</a>`).join('')}</div>`) : '')
    + appearancesFold(id) + threadsHTML(id) + contrasHTML(id) + imagesHTML(id, p) + notesHTML(p);
  openFactFolds(el);
}

// ---------- events ----------

function eventChs(eid) { return (IX.eventChapters[eid] ?? []).filter((x) => chOk(x.ch)).map((x) => x.ch); }
function eventRowHTML(e) {
  const d = eventDates(e.id);
  const chs = eventChs(e.id);
  const dv = d && anyOk(dateValue(d)?.refs) ? fmtRange(dateValue(d)) : '';
  const parent = e.parent && DB.events[e.parent] && entOk(e.parent, 'events') ? ` · part of ${md(DB.events[e.parent].title)}` : '';
  return `<a class="row" href="#/event/${encodeURIComponent(e.id)}"><div class="title">${md(e.title)} ${e.importance === 'major' ? '<span class="badge onpage">major</span>' : ''}${!IX.eventChapters[e.id] ? ' <span class="badge sheet">sheet only</span>' : ''}</div><div class="line2">${[dv, chs.length ? (chs.length > 3 ? `${chLabel(chs[0])} – ${chLabel(chs[chs.length - 1])} (${chs.length} ch)` : chs.map(chLabel).join(', ')) : '', (e.tags ?? []).join(', ')].filter(Boolean).join(' · ')}${parent}</div></a>`;
}
function eventParticipants(eid) {
  const people = {};
  for (const part of IX.eventChapters[eid] ?? []) {
    if (!chOk(part.ch)) continue;
    for (const x of part.participants) {
      const p = (people[x.id] ??= { id: x.id, on: false, roles: new Set(), refs: [] });
      if (x.presence === 'on-page') p.on = true;
      if (x.role) p.roles.add(x.role);
      p.refs.push(chRef(part.ch, x.quote));
    }
  }
  return Object.values(people);
}

function viewEvents(el, params) {
  setTitle('Events');
  const tags = uniq(Object.values(DB.events).flatMap((e) => e.tags ?? [])).sort(collator.compare);
  const chars = Object.values(DB.characters).filter((c) => IX.eventsByEntity[c.id] && entOk(c.id, 'characters')).sort((a, b) => collator.compare(a.name, b.name)).map((c) => [c.id, c.name]);
  const places = Object.values(DB.places).filter((p) => IX.eventsByPlace[p.id] && entOk(p.id, 'places')).sort((a, b) => collator.compare(a.name, b.name)).map((p) => [p.id, p.name]);
  el.innerHTML = `<div class="page-head"><h1>Events</h1></div>
    <form class="filters">
      <input type="search" name="q" placeholder="Filter by title or synopsis" value="${esc(params.get('q') ?? '')}">
      ${segHTML('imp', [['', 'All'], ...IMPORTANCE], params.get('imp') ?? '')}
      ${selectHTML('tag', tags.map((t) => [t, t]), params.get('tag') ?? '', 'Any tag')}
      ${bookSelect(params.get('book') ?? '')}
      ${selectHTML('who', chars, params.get('who') ?? '', 'Anyone')}
      ${selectHTML('where', places, params.get('where') ?? '', 'Anywhere')}
      ${selectHTML('sort', [['date', 'Own date (undated last)'], ['title', 'Title A–Z']], params.get('sort') ?? '', 'Sort: first chapter')}
      <label class="chk"><input type="checkbox" name="top"${params.get('top') ? ' checked' : ''}> Top-level only</label>
    </form><div class="resultbar"><span id="n"></span></div><div id="res" class="card list"></div>`;
  const all = Object.values(DB.events).map((e) => ({ e, hay: sNorm([e.title, ...(e.tags ?? []), ...(e.synopsis ?? []).filter((s) => allOk(s.refs)).map((s) => s.text)].join(' ')) }));
  const update = (v) => {
    setParams(v);
    const m = makeMatcher(v.q);
    const list = all.filter(({ e, hay }) => entOk(e.id, 'events')
      && (!m || m(hay))
      && (!v.imp || e.importance === v.imp)
      && (!v.tag || (e.tags ?? []).includes(v.tag))
      && (!v.book || eventChs(e.id).some((ch) => bookOf(ch) === Number(v.book)))
      && (!v.who || (IX.eventsByEntity[v.who] ?? []).some((x) => x.event === e.id && chOk(x.ch)))
      && (!v.where || (IX.eventsByPlace[v.where] ?? []).includes(e.id))
      && (!v.top || !e.parent)).map((x) => x.e);
    const firstCh = (e) => Math.min(...eventChs(e.id).map(ord), Infinity);
    const dkey = (e) => { const d = dateValue(eventDates(e.id)); return d?.start && anyOk(d.refs) ? d.start : '9999'; };
    if (v.sort === 'title') list.sort((a, b) => collator.compare(a.title, b.title));
    else if (v.sort === 'date') list.sort((a, b) => (dkey(a) < dkey(b) ? -1 : dkey(a) > dkey(b) ? 1 : firstCh(a) - firstCh(b)));
    else list.sort((a, b) => firstCh(a) - firstCh(b) || (dkey(a) < dkey(b) ? -1 : 1));
    $('#n', el).textContent = plural(list.length, 'event');
    paged($('#res', el), list, (items) => items.map(eventRowHTML).join(''), 80);
    if (!list.length) $('#res', el).innerHTML = '<div class="empty">No events match.</div>';
  };
  update(bindFilters($('form', el), update)());
}

function viewEvent(el, id) {
  const e = DB.events[id];
  if (!e) return notFound(el);
  setTitle(e.title);
  const chain = [];
  for (let p = e.parent, g = 0; p && DB.events[p] && g < 10; p = DB.events[p].parent, g++) if (entOk(p, 'events')) chain.unshift(p);
  const subs = (IX.subEvents[id] ?? []).filter((s) => entOk(s, 'events')).map((s) => DB.events[s]).sort(byKey((x) => Math.min(...eventChs(x.id).map(ord), Infinity)));
  const parts = (IX.eventChapters[id] ?? []).filter((x) => chOk(x.ch)).sort(byKey((x) => ord(x.ch)));
  const people = eventParticipants(id).sort((a, b) => (b.on - a.on) || collator.compare(entName(a.id), entName(b.id)));
  const personRow = (p) => `<div class="fact">${entLink(p.id)} ${p.on ? '' : '<span class="badge">mentioned</span>'} ${p.roles.size ? `<span class="muted small">${[...p.roles].map(md).join('; ')}</span>` : ''} ${cites(p.refs)}</div>`;
  const placeRefs = {};
  for (const part of parts) for (const pl of part.places) (placeRefs[pl.id] ??= []).push(chRef(part.ch, pl.quote));
  const links = (list) => (list ?? []).filter((x) => anyOk(x.refs)).map((x) => `<div class="fact">${entLink(x.id, 'events')} ${cites(okRefs(x.refs))}</div>`).join('');
  const PART = { full: '', start: 'begins', continues: 'continues', end: 'ends' };
  el.innerHTML = notYetHTML(id, 'events') + headHTML({
    title: e.title, avatar: false,
    crumbs: `<a href="#/events">Events</a>${chain.map((x) => ' › ' + entLink(x, 'events')).join('')}`,
    labels: `${(e.tags ?? []).map((t) => `<a class="badge" href="#/events?tag=${encodeURIComponent(t)}">${esc(t)}</a>`).join(' ')} <span class="badge">${esc(e.importance ?? '')}</span>${!IX.eventChapters[id] ? ' <span class="badge sheet">sheet only</span>' : ''}`,
  })
    + card('When', `<dl class="kv"><dt>Date</dt><dd>${datesHTML(eventDates(id))}${!eventDates(id) && eventChapterDates(id) ? `<div class="small muted">The chapters it appears in are dated ${esc(fmtRange(eventChapterDates(id)))} ${cites(eventChapterDates(id).refs.slice(0, 1))}. That is when they are set, not necessarily when this happened.</div>` : ''}</dd><dt>Chapters</dt><dd>${parts.length ? uniq(parts.map((x) => x.ch)).map((ch) => `<a href="#/chapter/${ch}">${chLabel(ch)}</a>`).join(', ') : NM}</dd></dl>`)
    + card('Synopsis', proseHTML(e.synopsis))
    + card('Sub-events', subs.length ? `<div class="list">${subs.map(eventRowHTML).join('')}</div>` : '', { count: subs.length || null })
    + card('Causes', links(e.causes)) + card('Consequences', links(e.consequences))
    + `<div class="two"><div>${card('Participants', people.map(personRow).join(''), { count: people.length })}</div><div>${card('Places', Object.entries(placeRefs).map(([pid, refs]) => `<div class="fact">${entLink(pid, 'places')} ${cites(refs)}</div>`).join(''))}</div></div>`
    + card('Chapter by chapter', parts.map((part) => `<div class="chhead"><a href="#/chapter/${part.ch}">${esc(chLong(part.ch))}</a> ${PART[part.part] ? `<span class="badge">${PART[part.part]}</span>` : ''}</div>${proseHTML(part.summary, part.ch) || '<div class="empty">No summary for this part.</div>'}`).join(''))
    + factFolds(id) + threadsHTML(id) + contrasHTML(id) + imagesHTML(id, e) + notesHTML(e);
  openFactFolds(el);
}

// ---------- groups and lore ----------

function viewKinds(el, params, type) {
  const label = TYPES[type].label;
  setTitle(label);
  const kinds = uniq(Object.values(DB[type]).map((x) => x.kind).filter(Boolean)).sort(collator.compare);
  el.innerHTML = `<div class="page-head"><h1>${label}</h1></div>
    <form class="filters">
      <input type="search" name="q" placeholder="Filter by name, alias or summary" value="${esc(params.get('q') ?? '')}">
      ${selectHTML('kind', kinds.map((k) => [k, cap(k)]), params.get('kind') ?? '', 'Any kind')}
      ${bookSelect(params.get('book') ?? '', (b) => `Appears in Book ${b}`)}
    </form><div class="resultbar"><span id="n"></span></div><div id="res" class="card list"></div>`;
  const all = Object.values(DB[type]).map((x) => ({ x, hay: sNorm([x.name, ...(x.aliases ?? []).map((a) => a.value), ...(x.summary ?? []).filter((s) => allOk(s.refs)).map((s) => s.text)].join(' ')) }));
  const update = (v) => {
    setParams(v);
    const m = makeMatcher(v.q);
    const list = all.filter(({ x, hay }) => entOk(x.id, type) && (!m || m(hay)) && (!v.kind || x.kind === v.kind) && (!v.book || appearStats(x.id).books.has(Number(v.book)))).map((y) => y.x).sort((a, b) => collator.compare(a.name, b.name));
    $('#n', el).textContent = `${list.length} ${list.length === 1 ? TYPES[type].one : label.toLowerCase()}`;
    $('#res', el).innerHTML = list.map((x) => {
      const s = appearStats(x.id);
      const first = (x.summary ?? []).find((t) => allOk(t.refs));
      return `<a class="row" href="${entHref(x.id, type)}"><div class="title">${md(x.name)} <span class="faint small">${esc(x.kind ?? '')}</span></div><div class="line2">${first ? md(first.text) : ''}${s.on + s.men ? ` <span class="faint">· in ${plural(s.on + s.men, 'chapter')}</span>` : ''}</div></a>`;
    }).join('') || '<div class="empty">Nothing matches.</div>';
  };
  update(bindFilters($('form', el), update)());
}

function viewKind(el, id, type) {
  const x = DB[type][id];
  if (!x) return notFound(el);
  setTitle(x.name);
  const details = (x.details ?? []).filter((d) => allOk(d.refs)).map((d) => `<dt>${md(d.label)}</dt><dd>${md(d.value)}${basisBadge(d.basis)} ${cites(d.refs)}</dd>`).join('');
  const members = (MEMBERS[id] ?? []).filter((m) => entOk(m.id, 'characters') && allOk(m.refs)).sort((a, b) => collator.compare(entName(a.id), entName(b.id)));
  el.innerHTML = notYetHTML(id, type) + headHTML({
    title: x.name, image: entImage(id), avatar: !!entImage(id),
    crumbs: `<a href="#/${type}">${TYPES[type].label}</a>`, sub: esc(x.kind ?? ''),
  }) + aliasesHTML(x.aliases)
    + `<div style="height:10px"></div>`
    + card('Summary', proseHTML(x.summary))
    + card('Details', details ? `<dl class="kv">${details}</dl>` : '')
    + card('Members', members.map((m) => `<div class="fact">${entLink(m.id, 'characters')}${m.role ? ` <span class="muted">· ${md(m.role)}</span>` : ''} ${cites(m.refs)}</div>`).join(''), { count: members.length || null })
    + factFolds(id, { open: ['lore', 'history', 'backstory'] })
    + appearancesFold(id) + threadsHTML(id) + contrasHTML(id) + imagesHTML(id, x) + notesHTML(x);
  openFactFolds(el);
}
