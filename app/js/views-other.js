// Other views: home, chapters, timeline, plot threads, contradictions and the fact explorer.
'use strict';

// ---------- home ----------

function viewHome(el) {
  setTitle('');
  const last = store.get('lastRead', null);
  const openThreads = Object.values(DB.threads).filter((t) => entOk(t.id, 'threads') && threadStatus(t) === 'open').length;
  const openContras = DB.contradictions.filter((c) => c.status === 'open' && contraOk(c)).length;
  const count = (t) => Object.keys(DB[t]).filter((id) => entOk(id, t)).length;
  const tile = (href, n, l) => `<a class="tile" href="${href}"><div class="n">${typeof n === 'number' ? n.toLocaleString() : n}</div><div class="l">${l}</div></a>`;
  el.innerHTML = `<div class="hero"><h1>${esc(PROJECT.title)} <span class="muted" style="font-weight:500">story bible</span></h1>
    <form class="bigsearch" id="homesearch">${icon('search')}<input type="search" name="q" placeholder="Search characters, facts, chapters, the manuscript…" autocomplete="off" aria-label="Search"></form></div>
    ${last && CH[last.ch] ? `<a class="card" style="display:block;color:inherit" href="#/read/${last.ch}?p=${last.p ?? 0}"><div class="muted small">Continue reading</div><div style="font-weight:650">${esc(chLong(last.ch))}</div></a>` : ''}
    <div class="tiles">
      ${tile('#/characters', count('characters'), 'Characters')}
      ${tile('#/chapters', CH_LIST.filter((c) => chOk(c.id)).length, 'Chapters')}
      ${tile('#/events', count('events'), 'Events')}
      ${tile('#/places', count('places'), 'Places')}
      ${tile('#/threads', openThreads, 'Open plot threads')}
      ${tile('#/contradictions?status=open', openContras, 'Open contradictions')}
      ${tile('#/facts', FACTS.filter((f) => refOk(f.ref)).length, 'Facts')}
      ${tile('#/timeline', '⟶', 'Timeline')}
    </div>
    <div class="two">
      ${BOOKS.map((b) => card(esc(bookTitle(b)), `<div class="muted small" style="margin-bottom:6px">${MULTI_BOOK ? `Book ${b} · ` : ''}${plural(CH_LIST.filter((c) => c.book === b).length, 'chapter')}</div><div class="chips">${CH_LIST.filter((c) => c.book === b).map((c) => `<a class="chip${chOk(c.id) ? '' : ' faint'}" href="#/chapter/${c.id}" title="${chOk(c.id) ? esc(c.title ?? '') : ''}">${esc(chShort(c))}</a>`).join('')}</div>`)).join('')}
    </div>
    ${CH_LIST.length ? `<p class="faint small">Data parsed ${esc(DB.meta.lastParsedAt ?? '')} (commit ${esc(DB.meta.lastParsedCommit ?? '')}), built ${esc((DB.meta.builtAt ?? '').slice(0, 10))}. Every statement links to its source: tap a chip like <span class="cite">${MULTI_BOOK ? 'B1·' : ''}Ch3</span> to see the quote.</p>`
    : '<div class="notice">Nothing has been parsed yet. Upload the manuscript and ask Claude for the first parse: see <code>docs/SETUP.md</code> in the repository.</div>'}`;
  $('#homesearch', el).addEventListener('submit', (e) => { e.preventDefault(); location.hash = '#/search?q=' + encodeURIComponent($('input', e.target).value); });
}

// ---------- chapters ----------

function povNames(c) { return (c.pov ?? []).map((p) => entName(p.id)).join(', '); }

function viewChapters(el, params) {
  setTitle('Chapters');
  const povs = knownIds(uniq(CH_LIST.flatMap((c) => (c.pov ?? []).map((p) => p.id)))).map((id) => [id, entName(id)]).sort((a, b) => collator.compare(a[1], b[1]));
  const chars = Object.values(DB.characters).filter((c) => entOk(c.id, 'characters')).sort((a, b) => collator.compare(a.name, b.name)).map((c) => [c.id, c.name]);
  el.innerHTML = `<div class="page-head"><h1>Chapters</h1></div>
    <form class="filters">
      <input type="search" name="q" placeholder="Filter by title or summary" value="${esc(params.get('q') ?? '')}">
      ${bookSeg(params.get('book') ?? '')}
      ${selectHTML('pov', povs, params.get('pov') ?? '', 'Any POV')}
      ${selectHTML('who', chars, params.get('who') ?? '', 'Anyone on page')}
    </form><div class="resultbar"><span id="n"></span></div><div id="res"></div>`;
  const all = CH_LIST.map((c) => ({ c, hay: sNorm([c.title, ...(c.summary ?? []).map((s) => s.text)].join(' ')) }));
  const update = (v) => {
    setParams(v);
    const m = makeMatcher(v.q);
    const list = all.filter(({ c, hay }) => chOk(c.id) && (!m || m(hay)) && (!v.book || c.book === Number(v.book))
      && (!v.pov || (c.pov ?? []).some((p) => p.id === v.pov))
      && (!v.who || (c.appearances ?? []).some((a) => a.id === v.who && a.presence === 'on-page'))).map((x) => x.c);
    $('#n', el).textContent = plural(list.length, 'chapter');
    let html = '';
    for (const b of BOOKS) {
      const bl = list.filter((c) => c.book === b);
      if (!bl.length) continue;
      html += `<section class="card"><h2>${esc(bookTitle(b))}${MULTI_BOOK ? `<span class="count">Book ${b}</span>` : ''}</h2><div class="list">${bl.map((c) => {
        const d = dateValue(c.dates);
        const onPage = (c.appearances ?? []).filter((a) => a.type === 'character' && a.presence === 'on-page').length;
        const first = (c.summary ?? [])[0];
        return `<a class="row" href="#/chapter/${c.id}"><div class="title">${isChapter(c) ? `${c.number}. ${md(c.title ?? '')}` : `${esc(chName(c))}${c.title ? ': ' + md(c.title) : ''}`}</div><div class="line2">${[d && anyOk(d.refs) ? esc(fmtRange(d)) : '', c.pov?.length ? 'POV ' + esc(povNames(c)) : '', plural(onPage, 'character') + ' on page'].filter(Boolean).join(' · ')}</div>${first && m ? `<div class="line2">${md(first.text)}</div>` : ''}</a>`;
      }).join('')}</div></section>`;
    }
    const posts = POSTS.filter((c) => chOk(c.id) && (!m || m(sNorm([c.title, ...(c.summary ?? []).map((s) => s.text)].join(' ')))) && !v.book && !v.pov && !v.who);
    if (posts.length) html += `<section class="card"><h2>Posts and author notes<span class="count">${posts.length}</span></h2><div class="list">${posts.map((c) => `<a class="row" href="#/chapter/${c.id}"><div class="title">${md(c.title ?? '')}</div><div class="line2">Read after ${esc(postAfter(c))}</div></a>`).join('')}</div></section>`;
    $('#res', el).innerHTML = html || '<div class="empty">No chapters match.</div>';
  };
  update(bindFilters($('form', el), update)());
}

function viewChapter(el, id) {
  const c = CH[id];
  if (!c) return notFound(el);
  setTitle(`${chLabel(id)} ${c.title ?? ''}`);
  const prev = CH_LIST[c.idx - 1], next = CH_LIST[c.idx + 1];
  const nav = `<div class="reader-top"><a class="btn primary" href="#/read/${id}">${icon('read')} Read chapter</a><span class="spacer"></span><span class="navpair">${prev ? `<a class="btn" href="#/chapter/${prev.id}" title="${esc(chLong(prev.id))}">${icon('prev')} ${chLabel(prev.id)}</a>` : ''}${next ? `<a class="btn" href="#/chapter/${next.id}" title="${esc(chLong(next.id))}">${chLabel(next.id)} ${icon('next')}</a>` : ''}</span></div>`;
  const head = headHTML({ title: c.title ?? chName(c), avatar: false, crumbs: `<a href="#/chapters">Chapters</a> › ${c.post ? `Post, read after ${esc(postAfter(c))}` : `${MULTI_BOOK ? `Book ${c.book}, ` : ''}${esc(chName(c))}`}` });
  if (!chOk(id)) {
    el.innerHTML = head + nav + `<div class="notice warn">This chapter is after your reading point (${esc(asOfLabel())}), so its details are hidden. <button type="button" class="linkbtn" data-action="asof">Change</button></div>`;
    return;
  }
  const sheetRef = (x) => ({ file: 'sheet', row: x.row, cells: [x.label] });
  const sheet = [...(c.sheetEvents ?? []).map((x) => ({ ...x, kind: 'event' })), ...(c.sheetNotes ?? []).map((x) => ({ ...x, kind: 'note' }))];
  const details = `<dl class="kv"><dt>Date</dt><dd>${datesHTML(c.dates)}</dd>
    <dt>Point of view</dt><dd>${c.pov?.length ? c.pov.map((p) => `${entLink(p.id)} ${citeChip(chRef(id, p.quote))}`).join(', ') : NM}</dd>
    ${sheet.length && (!limited() || state.sheet) ? `<dt>Sheet</dt><dd>${sheet.map((x) => `<div>${esc(x.label)} <span class="faint small">${x.kind === 'note' ? 'note' : 'event'}</span> ${citeChip(sheetRef(x))}</div>`).join('')}</dd>` : ''}</dl>`;
  const groups = { characters: [], places: [], groups: [], lore: [] };
  for (const a of c.appearances ?? []) (groups[APPEAR_TYPE[a.type]] ??= []).push(a);
  const pills = (list) => list.sort((a, b) => (a.presence === b.presence ? collator.compare(entName(a.id), entName(b.id)) : a.presence === 'on-page' ? -1 : 1))
    .map((a) => `<span class="pill${a.presence === 'on-page' ? '' : ' mentioned'}">${entLink(a.id, APPEAR_TYPE[a.type])}${citeChip(chRef(id, a.quote))}</span>`).join('');
  const who = Object.entries(groups).filter(([, l]) => l.length).map(([t, l]) => `<div class="grouphead">${TYPES[t].label} <span class="faint">${l.filter((a) => a.presence === 'on-page').length} on page · ${l.filter((a) => a.presence !== 'on-page').length} mentioned</span></div><div>${pills(l)}</div>`).join('');
  const PART = { full: '', start: 'begins', continues: 'continues', end: 'ends' };
  const events = (c.events ?? []).map((e) => `<div class="chhead">${entLink(e.id, 'events')} ${PART[e.part] ? `<span class="badge">${PART[e.part]}</span>` : ''}</div>${proseHTML(e.summary, id)}`).join('');
  const facts = FACTS.filter((f) => f.ref.ch === id);
  const byCat = {};
  for (const f of facts) (byCat[f.category] ??= []).push(f);
  const factHtml = CATEGORY_ORDER.filter((k) => byCat[k]).map((k) => fold(esc(CATEGORY_LABEL[k]), byCat[k].length, '', byCat[k].map((f) => factHTML(f)).join(''))).join('');
  const flags = (c.flags ?? []).map((f) => `<div class="fact">${md(f.text)} ${citeChip(chRef(id, f.quote))}</div>`).join('');
  const unreg = (c.unregistered ?? []).map((u) => `<span class="pill">${md(u.name)}${citeChip(chRef(id, u.quote))}</span>`).join('');
  el.innerHTML = head + nav
    + `<div class="two"><div>${card('Details', details)}</div><div>${card('Summary', proseHTML(c.summary, id))}</div></div>`
    + card('Who and where', who)
    + card('Events', events, { count: (c.events ?? []).length || null })
    + (facts.length ? `<div class="section"><div class="resultbar"><span>${plural(facts.length, 'fact')} in this chapter</span><a href="#/facts?from=${id}&to=${id}">Open in fact explorer</a></div>${factHtml}</div>` : '')
    + card('Unclear (left out of the data)', flags)
    + card('Names without a record yet', unreg);
}

// ---------- timeline ----------

function viewTimeline(el, params) {
  setTitle('Timeline');
  const tags = uniq(Object.values(DB.events).flatMap((e) => e.tags ?? [])).sort(collator.compare);
  const chars = Object.values(DB.characters).filter((c) => (IX.eventsByEntity[c.id] || IX.appearancesById[c.id]) && entOk(c.id, 'characters')).sort((a, b) => collator.compare(a.name, b.name)).map((c) => [c.id, c.name]);
  const places = Object.values(DB.places).filter((p) => (IX.eventsByPlace[p.id] || IX.appearancesById[p.id]) && entOk(p.id, 'places')).sort((a, b) => collator.compare(a.name, b.name)).map((p) => [p.id, p.name]);
  el.innerHTML = `<div class="page-head"><h1>Timeline</h1><div class="sub">In-world dates of chapters and events. Dates come from the text${HAS_SHEET ? ' or the planning sheet' : ''}; tap a chip to see which.</div></div>
    <form class="filters">
      ${segHTML('show', [['', 'Everything'], ['events', 'Events'], ['chapters', 'Chapters']], params.get('show') ?? '')}
      ${bookSeg(params.get('book') ?? '')}
      ${selectHTML('imp', IMPORTANCE, params.get('imp') ?? '', 'Any importance')}
      ${selectHTML('tag', tags.map((t) => [t, t]), params.get('tag') ?? '', 'Any tag')}
      ${selectHTML('who', chars, params.get('who') ?? '', 'Anyone')}
      ${selectHTML('where', places, params.get('where') ?? '', 'Anywhere')}
    </form><div id="res"></div>`;
  const PART = { start: 'begins', continues: 'continues', end: 'ends' };
  const update = (v) => {
    setParams(v);
    const evOk = (e) => entOk(e.id, 'events') && (!v.tag || (e.tags ?? []).includes(v.tag)) && (!v.imp || e.importance === v.imp)
      && (!v.who || (IX.eventsByEntity[v.who] ?? []).some((x) => x.event === e.id && chOk(x.ch)))
      && (!v.where || (IX.eventsByPlace[v.where] ?? []).includes(e.id));
    const eventFilter = !!(v.tag || v.imp);
    const items = [];
    // Chapters sit on their own dates; events with no date of their own are listed under the chapters they appear in.
    for (const c of CH_LIST) {
      if (!chOk(c.id) || (v.book && c.book !== Number(v.book))) continue;
      const inside = v.show === 'chapters' ? [] : (c.events ?? []).filter((x) => DB.events[x.id] && !eventDates(x.id) && evOk(DB.events[x.id]));
      const onPage = (id) => (c.appearances ?? []).some((a) => a.id === id && a.presence === 'on-page');
      const chMatch = (!v.who || onPage(v.who)) && (!v.where || onPage(v.where));
      if (v.show === 'events' || eventFilter ? !inside.length : !chMatch && !inside.length) continue;
      const d = dateValue(c.dates);
      items.push({ kind: 'chapter', id: c.id, d: d && anyOk(d.refs) ? d : null, raw: c.dates, sortCh: c.order, inside });
    }
    if (v.show !== 'chapters') {
      for (const e of Object.values(DB.events)) {
        const raw = eventDates(e.id);
        if (!raw || !evOk(e)) continue;
        const chs = eventChs(e.id);
        if (v.book && !chs.some((ch) => bookOf(ch) === Number(v.book))) continue;
        const d = dateValue(raw);
        if (!d || !anyOk(d.refs)) continue;
        items.push({ kind: 'event', id: e.id, d, raw, sortCh: Math.min(...chs.map(ord), Infinity) });
      }
    }
    const dated = items.filter((x) => x.d?.start).sort((a, b) => (a.d.start < b.d.start ? -1 : a.d.start > b.d.start ? 1 : (a.kind === b.kind ? a.sortCh - b.sortCh : a.kind === 'event' ? -1 : 1)));
    const undated = items.filter((x) => !x.d?.start).sort(byKey((x) => x.sortCh));
    const evTitle = (e) => (e.importance === 'major' ? `<b>${md(e.title)}</b>` : md(e.title));
    const insideHTML = (x) => (x.inside?.length ? `<div class="small" style="margin:2px 0 6px 14px">${x.inside.map((p) => `<div><span class="faint">↳</span> <a href="#/event/${encodeURIComponent(p.id)}">${evTitle(DB.events[p.id])}</a>${PART[p.part] ? ` <span class="faint">${PART[p.part]}</span>` : ''}</div>`).join('')}</div>` : '');
    const flagsHTML = (x, dd) => `${dd.approx ? ' <span class="badge approx">approx.</span>' : ''}${dd.basis === 'inferred' ? ' <span class="badge inferred">inferred</span>' : ''}${x.raw?.disputed ? disputedBadge(x.raw.contradiction) : ''}`;
    const itemHTML = (x) => {
      const dd = x.d;
      const range = dd.end && dd.end !== dd.start ? ` <span class="faint small">→ ${esc(fmtDate(dd.end))}</span>` : '';
      if (x.kind === 'chapter') return `<div class="tl-item"><span class="kind">Chapter</span><a href="#/chapter/${x.id}">${chLabel(x.id)} ${md(CH[x.id].title ?? '')}</a>${range}${flagsHTML(x, dd)} ${cites(okRefs(dd.refs).slice(0, 1))}${insideHTML(x)}</div>`;
      return `<div class="tl-item"><span class="kind">Event</span><a href="#/event/${encodeURIComponent(x.id)}">${evTitle(DB.events[x.id])}</a>${range}${flagsHTML(x, dd)} ${cites(okRefs(dd.refs).slice(0, 2))}</div>`;
    };
    let html = '', lastKey = null, lastMonth = null, lastYear = null;
    for (const x of dated) {
      const key = x.d.start;
      const y = Number(key.slice(0, 4));
      const month = key.slice(0, 7);
      if (key !== lastKey) {
        if (lastKey !== null) html += '</div></div>';
        if (lastYear !== null && y - lastYear > 1) html += `<div class="tl-gap">${plural(y - lastYear, 'year')} later</div>`;
        if (month !== lastMonth) { html += `<div class="tl-month">${esc(fmtDate(month))}</div>`; lastMonth = month; }
        const [yy, mm, dd] = key.split('-');
        html += `<div class="tl-day"><div class="tl-date">${dd ? `${Number(dd)} ${MONTHS[Number(mm) - 1].slice(0, 3)}` : mm ? MONTHS[Number(mm) - 1] : ''} <span class="y">${yy}</span></div><div>`;
        lastKey = key; lastYear = y;
      }
      html += itemHTML(x);
    }
    if (lastKey !== null) html += '</div></div>';
    const undatedHtml = undated.length ? fold('Chapters with no date in the sources', undated.length, '', undated.map((x) => `<div class="tl-item"><span class="kind">Chapter</span><a href="#/chapter/${x.id}">${chLabel(x.id)} ${md(CH[x.id].title ?? '')}</a>${insideHTML(x)}</div>`).join('')) : '';
    const note = v.show !== 'chapters' ? '<p class="faint small">Events with a date of their own are placed on it. Other events are listed (↳) under the chapters they appear in. A chapter\'s date is when it is set, which is not necessarily when a recalled event happened.</p>' : '';
    $('#res', el).innerHTML = note + ((html ? `<div class="card">${html}</div>` : '') + undatedHtml || '<div class="empty">Nothing matches.</div>');
  };
  update(bindFilters($('form', el), update)());
}

// ---------- plot threads ----------

// The text's own resolution (cited, reader-mode aware). The author's override is separate: see threadStatus.
function threadTextResolved(t) {
  return t.status === 'resolved' && t.resolution && chOk(t.resolution.ch) && allOk((t.resolution.text ?? []).flatMap((s) => s.refs));
}
function threadStatus(t) {
  return t.authorStatus === 'resolved' || threadTextResolved(t) ? 'resolved' : 'open';
}
function threadRowHTML(t) {
  const q = (t.question ?? []).find((s) => allOk(s.refs)) ?? t.question?.[0];
  const st = threadStatus(t);
  const devs = (t.developments ?? []).filter((d) => chOk(d.ch)).length;
  return `<a class="row" href="#/thread/${encodeURIComponent(t.id)}"><div class="title">${md(q?.text ?? t.id)}</div><div class="line2"><span class="badge ${st}">${st}</span> <span class="badge">${esc(t.kind)}</span> opened ${chLabel(t.opened)}${devs ? ` · ${plural(devs, 'development')}` : ''}${threadTextResolved(t) ? ` · resolved ${chLabel(t.resolution.ch)}` : st === 'resolved' ? ' · resolved by author' : ''}</div><div class="faint small"><code>${esc(t.id)}</code></div></a>`;
}

function viewThreads(el, params) {
  setTitle('Plot threads');
  const kinds = uniq(Object.values(DB.threads).map((t) => t.kind)).sort();
  const about = knownIds(uniq(Object.values(DB.threads).flatMap((t) => t.about ?? [])).filter((id) => TYPE_OF[id])).map((id) => [id, entName(id)]).sort((a, b) => collator.compare(a[1], b[1]));
  el.innerHTML = `<div class="page-head"><h1>Plot threads</h1><div class="sub">Mysteries, promises, setups, secrets and conflicts, each traced through the chapters.</div></div>
    <form class="filters">
      <input type="search" name="q" placeholder="Filter threads" value="${esc(params.get('q') ?? '')}">
      ${segHTML('status', [['open', 'Open'], ['resolved', 'Resolved'], ['all', 'All']], params.get('status') ?? 'open')}
      ${selectHTML('kind', kinds.map((k) => [k, cap(k)]), params.get('kind') ?? '', 'Any kind')}
      ${selectHTML('about', about, params.get('about') ?? '', 'About anyone')}
      ${bookSelect(params.get('book') ?? '', (b) => `Opened in Book ${b}`)}
      ${selectHTML('sort', [['recent', 'Most recently developed'], ['dev', 'Most developments']], params.get('sort') ?? '', 'Sort: opened')}
    </form><div class="resultbar"><span id="n"></span></div><div id="res" class="card list"></div>`;
  const hay = (t) => sNorm([...(t.question ?? []), ...(t.developments ?? []).flatMap((d) => d.text ?? []), ...(t.resolution?.text ?? [])].filter((s) => allOk(s.refs)).map((s) => s.text).join(' '));
  const all = Object.values(DB.threads).map((t) => ({ t, hay: hay(t) }));
  const update = (v) => {
    setParams(v);
    const m = makeMatcher(v.q);
    const status = v.status || 'open';
    const lastDev = (t) => Math.max(ord(t.opened), ...(t.developments ?? []).filter((d) => chOk(d.ch)).map((d) => ord(d.ch)));
    const list = all.filter(({ t, hay: h }) => entOk(t.id, 'threads') && (!m || m(h)) && (status === 'all' || threadStatus(t) === status)
      && (!v.kind || t.kind === v.kind) && (!v.about || (t.about ?? []).includes(v.about)) && (!v.book || bookOf(t.opened) === Number(v.book))).map((x) => x.t);
    if (v.sort === 'recent') list.sort((a, b) => lastDev(b) - lastDev(a));
    else if (v.sort === 'dev') list.sort((a, b) => (b.developments?.length ?? 0) - (a.developments?.length ?? 0));
    else list.sort((a, b) => ord(a.opened) - ord(b.opened));
    $('#n', el).textContent = plural(list.length, 'thread');
    $('#res', el).innerHTML = list.map(threadRowHTML).join('') || '<div class="empty">No threads match.</div>';
  };
  update(bindFilters($('form', el), update)());
}

function viewThread(el, id) {
  const t = DB.threads[id];
  if (!t) return notFound(el);
  setTitle('Thread');
  const st = threadStatus(t);
  if (!entOk(id, 'threads')) {
    el.innerHTML = headHTML({ title: 'Plot thread', avatar: false, crumbs: '<a href="#/threads">Plot threads</a>' }) + notYetHTML(id, 'threads');
    return;
  }
  const devs = (t.developments ?? []).filter((d) => chOk(d.ch)).sort(byKey((d) => ord(d.ch)));
  el.innerHTML = `<div class="crumbs"><a href="#/threads">Plot threads</a></div>
    <div class="page-head"><h1 style="font-size:1.3rem">${proseHTML(t.question) || md(t.id)}</h1>
    <div class="labels" style="margin-top:6px"><span class="badge ${st}">${st}</span> <span class="badge">${esc(t.kind)}</span></div></div>
    ${card('About', (t.about ?? []).filter((x) => entOk(x)).map((x) => `<a class="pill" href="${entHref(x)}">${md(entName(x))}</a>`).join(''))}
    <section class="card"><h2>How it develops</h2>
      <div class="chhead"><a href="#/chapter/${t.opened}">${esc(chLong(t.opened))}</a> <span class="badge">opened</span></div>${proseHTML(t.question)}
      ${devs.map((d) => `<div class="chhead"><a href="#/chapter/${d.ch}">${esc(chLong(d.ch))}</a></div>${proseHTML(d.text) || '<div class="empty">Hidden in reader mode.</div>'}`).join('')}
      ${threadTextResolved(t) ? `<div class="chhead"><a href="#/chapter/${t.resolution.ch}">${esc(chLong(t.resolution.ch))}</a> <span class="badge resolved">resolved</span></div>${proseHTML(t.resolution.text)}` : '<p class="faint small" style="margin-top:10px">Not resolved' + (limited() && t.status === 'resolved' ? ' as of your reading point.' : ' in the text so far.') + '</p>'}
    </section>${t.authorStatus === 'resolved' ? `<div class="notice"><b>Resolved by author.</b>${t.authorComment ? ' ' + esc(t.authorComment) : ''}</div>` : t.authorComment ? `<div class="notice"><b>Author:</b> ${esc(t.authorComment)}</div>` : ''}${notesHTML(t)}
    <div class="faint small" style="margin-top:6px">ID <code style="user-select:all">${esc(t.id)}</code></div>`;
}

// ---------- contradictions ----------

function contraCardHTML(c) {
  const sides = c.sides.filter((s) => anyOk(s.refs));
  return `<section class="card" id="c-${esc(c.id)}"><div class="labels" style="margin-bottom:6px"><span class="badge ${c.status}">${esc(c.status)}</span> <span class="badge ${c.severity}">${esc(c.severity)}</span> <span class="badge">${esc(c.kind)}</span></div>
    <h3 style="margin-bottom:8px"><a href="#/contradiction/${encodeURIComponent(c.id)}" style="color:inherit">${md(c.text)}</a></h3>
    ${sides.map((s, i) => `<div class="fact"><div class="grouphead" style="margin-top:0">Side ${i + 1}</div><div>${md(s.claim)}</div>${okRefs(s.refs).map((r) => `<div class="q">${r.file === 'sheet' ? `Sheet row ${r.row}: ${esc((r.cells ?? []).join(' · '))}` : `“${md(r.quote)}”`} ${citeChip(r)}</div>`).join('')}</div>`).join('')}
    ${(c.about ?? []).length ? `<div class="small muted" style="margin-top:6px">About ${c.about.map((x) => entLink(x)).join(', ')}</div>` : ''}
    ${c.authorComment ? `<div class="notice" style="margin-top:10px"><b>Author:</b> ${esc(c.authorComment)}</div>` : ''}
    <div class="faint small" style="margin-top:6px">Found ${esc(c.found ?? '')} · ID <code style="user-select:all">${esc(c.id)}</code></div></section>`;
}
function viewContradictions(el, params) {
  setTitle('Contradictions');
  const about = knownIds(uniq(DB.contradictions.flatMap((c) => c.about ?? [])).filter((id) => TYPE_OF[id])).map((id) => [id, entName(id)]).sort((a, b) => collator.compare(a[1], b[1]));
  el.innerHTML = `<div class="page-head"><h1>Contradictions</h1><div class="sub">Places where the sources disagree. Every side is shown; none is treated as correct.</div></div>
    <form class="filters">
      <input type="search" name="q" placeholder="Filter contradictions" value="${esc(params.get('q') ?? '')}">
      ${segHTML('status', [['open', 'Open'], ['intended', 'Intended'], ['not-an-issue', 'Not an issue'], ['resolved', 'Resolved'], ['all', 'All']], params.get('status') ?? 'open')}
      ${selectHTML('kind', [['text-vs-text', 'Text vs text'], ...(HAS_SHEET ? [['text-vs-sheet', 'Text vs sheet'], ['sheet-vs-sheet', 'Sheet vs sheet']] : []), ['timeline', 'Timeline']], params.get('kind') ?? '', 'Any kind')}
      ${selectHTML('sev', [['high', 'High'], ['medium', 'Medium'], ['low', 'Low']], params.get('sev') ?? '', 'Any severity')}
      ${selectHTML('about', about, params.get('about') ?? '', 'About anyone')}
      ${bookSelect(params.get('book') ?? '')}
    </form><div class="resultbar"><span id="n"></span></div><div id="res"></div>`;
  const SEV = { high: 0, medium: 1, low: 2 };
  const all = DB.contradictions.map((c) => ({ c, hay: sNorm([c.text, c.id, ...c.sides.flatMap((s) => [s.claim, ...(s.refs ?? []).map((r) => r.quote ?? '')])].join(' ')) }));
  const update = (v) => {
    setParams(v);
    const m = makeMatcher(v.q);
    const status = v.status || 'open';
    const list = all.filter(({ c, hay }) => contraOk(c) && (!m || m(hay)) && (status === 'all' || c.status === status) && (!v.kind || c.kind === v.kind) && (!v.sev || c.severity === v.sev)
      && (!v.about || (c.about ?? []).includes(v.about)) && (!v.book || c.sides.some((s) => (s.refs ?? []).some((r) => r.ch && bookOf(r.ch) === Number(v.book))))).map((x) => x.c)
      .sort((a, b) => (SEV[a.severity] - SEV[b.severity]) || collator.compare(a.id, b.id));
    $('#n', el).textContent = plural(list.length, 'contradiction');
    paged($('#res', el), list, (items) => items.map(contraCardHTML).join(''), 30);
    if (!list.length) $('#res', el).innerHTML = '<div class="empty">No contradictions match.</div>';
  };
  update(bindFilters($('form', el), update)());
}
function viewContradiction(el, id) {
  const c = CONTRA[id];
  if (!c) return notFound(el);
  setTitle('Contradiction');
  el.innerHTML = '<div class="crumbs"><a href="#/contradictions">Contradictions</a></div>' + (contraOk(c) ? contraCardHTML(c) : '<div class="notice warn">Hidden in reader mode: a reader has not yet seen both sides. <button type="button" class="linkbtn" data-action="asof">Change</button></div>');
}

// ---------- fact explorer ----------

function viewFacts(el, params) {
  setTitle('Facts');
  const aboutIds = knownIds(Object.keys(IX.factsByEntity).filter((id) => TYPE_OF[id]));
  const visibleCount = (id) => IX.factsByEntity[id].filter((fid) => refOk(FACT_BY_ID[fid].ref)).length;
  const aboutOpts = ENTITY_ORDER.map((t) => {
    const ids = aboutIds.filter((id) => TYPE_OF[id] === t).sort((a, b) => collator.compare(entName(a), entName(b)));
    return ids.length ? `<optgroup label="${TYPES[t].label}">${ids.map((id) => `<option value="${esc(id)}"${params.get('about') === id ? ' selected' : ''}>${esc(plain(entName(id)))} (${visibleCount(id)})</option>`).join('')}</optgroup>` : '';
  }).join('');
  const chOpts = (sel) => CH_LIST.filter((c) => chOk(c.id)).map((c) => `<option value="${c.id}"${sel === c.id ? ' selected' : ''}>${chLabel(c.id)} ${esc(c.title ?? '')}</option>`).join('');
  const speakers = knownIds(uniq(FACTS.map((f) => f.speaker).filter(Boolean)).filter((id) => TYPE_OF[id])).map((id) => [id, entName(id)]).sort((a, b) => collator.compare(a[1], b[1]));
  el.innerHTML = `<div class="page-head"><h1>Facts</h1><div class="sub">Every atomic fact taken from the chapters, each with its quote.</div></div>
    <form class="filters">
      <input type="search" name="q" placeholder="Words in the fact or its quote — use &quot;phrases&quot; and -exclusions" value="${esc(params.get('q') ?? '')}">
      <select name="about" aria-label="About"><option value="">About anyone or anything</option>${aboutOpts}</select>
      ${selectHTML('cat', CATEGORY_ORDER.map((c) => [c, CATEGORY_LABEL[c]]), params.get('cat') ?? '', 'Any category')}
      <select name="aspect" aria-label="Aspect"></select>
      ${selectHTML('voice', [['narration', 'Narration'], ['dialogue', 'Dialogue'], ['thought', 'Thought'], ['document', 'Writing']], params.get('voice') ?? '', 'Any voice')}
      ${selectHTML('speaker', speakers, params.get('speaker') ?? '', 'Any speaker')}
      ${selectHTML('basis', [['stated', 'Stated'], ['implied', 'Implied'], ['claim', 'Claim'], ['rumor', 'Rumor']], params.get('basis') ?? '', 'Any basis')}
      <select name="from" aria-label="From chapter"><option value="">From the start</option>${chOpts(params.get('from'))}</select>
      <select name="to" aria-label="To chapter"><option value="">To the end</option>${chOpts(params.get('to'))}</select>
      <label class="chk"><input type="checkbox" name="quotes"${params.get('quotes') || store.get('quotes', false) ? ' checked' : ''}> Show quotes</label>
      <button type="button" class="linkbtn small" id="reset">Clear filters</button>
    </form><div class="resultbar"><span id="n"></span><span id="facets" class="chips"></span></div><div id="res" class="card"></div>`;
  const hay = FACTS.map((f) => sNorm(f.text + ' ' + f.ref.quote + ' ' + (f.aspect ?? '')));
  const aspectSel = $('select[name="aspect"]', el);
  const fillAspects = (cat, sel) => {
    const counts = {};
    for (const f of FACTS) if (f.aspect && (!cat || f.category === cat)) counts[f.aspect] = (counts[f.aspect] ?? 0) + 1;
    const keys = Object.keys(counts).sort(collator.compare);
    aspectSel.innerHTML = `<option value="">Any aspect</option>${keys.map((k) => `<option value="${esc(k)}"${k === sel ? ' selected' : ''}>${esc(k)} (${counts[k]})</option>`).join('')}`;
  };
  fillAspects(params.get('cat'), params.get('aspect'));
  let lastCat = params.get('cat') ?? '';
  const form = $('form', el);
  const update = (v) => {
    if (v.cat !== lastCat) { fillAspects(v.cat, ''); v.aspect = ''; lastCat = v.cat; }
    store.set('quotes', !!v.quotes);
    setParams({ ...v, quotes: '' });
    const m = makeMatcher(v.q);
    const lo = v.from ? ord(v.from) : -Infinity, hi = v.to ? ord(v.to) : Infinity;
    const base = [];
    FACTS.forEach((f, i) => {
      const o = ord(f.ref.ch);
      if (o < lo || o > hi || !refOk(f.ref)) return;
      if (v.about && !(f.about ?? []).includes(v.about)) return;
      if (v.aspect && f.aspect !== v.aspect) return;
      if (v.voice && f.voice !== v.voice) return;
      if (v.speaker && f.speaker !== v.speaker) return;
      if (v.basis && (f.basis ?? 'stated') !== v.basis) return;
      if (m && !m(hay[i])) return;
      base.push(f);
    });
    // Category counts are shown as facets over everything else that matches.
    const counts = {};
    for (const f of base) counts[f.category] = (counts[f.category] ?? 0) + 1;
    const list = v.cat ? base.filter((f) => f.category === v.cat) : base;
    $('#n', el).textContent = plural(list.length, 'fact');
    $('#facets', el).innerHTML = CATEGORY_ORDER.filter((c) => counts[c]).map((c) => `<button type="button" class="chip${v.cat === c ? ' on' : ''}" data-cat="${c}">${esc(CATEGORY_LABEL[c])}<span class="n">${counts[c]}</span></button>`).join('');
    const res = $('#res', el);
    if (!list.length) { res.innerHTML = '<div class="empty">No facts match.</div>'; return; }
    let lastCh = null;
    paged(res, list, (items) => items.map((f) => {
      const head = f.ref.ch !== lastCh ? `<div class="chhead"><a href="#/chapter/${f.ref.ch}">${esc(chLong(f.ref.ch))}</a></div>` : '';
      lastCh = f.ref.ch;
      return head + factHTML(f, { quote: !!v.quotes, except: v.about || null });
    }).join(''), 100);
  };
  const read = bindFilters(form, update);
  $('#facets', el).addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    const sel = $('select[name="cat"]', form);
    sel.value = sel.value === b.dataset.cat ? '' : b.dataset.cat;
    update(read());
  });
  $('#reset', el).addEventListener('click', () => {
    $$('input[type="search"]', form).forEach((i) => { i.value = ''; });
    $$('select', form).forEach((s) => { s.value = ''; });
    update(read());
  });
  update(read());
}
