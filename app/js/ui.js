// Rendering primitives: citations, sourced values, prose, facts, badges, paging.
'use strict';

const ICON = {
  search: '<path d="M10.5 3a7.5 7.5 0 0 1 5.9 12.1l4.2 4.2-1.4 1.4-4.2-4.2A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"/>',
  home: '<path d="M12 3 2 11h3v9h6v-6h2v6h6v-9h3L12 3Z"/>',
  person: '<path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5Z"/>',
  place: '<path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/>',
  event: '<path d="M7 2v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7Zm-2 8h14v10H5V10Z"/>',
  group: '<path d="M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8 13c-3.3 0-6 1.6-6 3.8V19h12v-2.2C14 14.6 11.3 13 8 13Zm8 0c-.6 0-1.2.1-1.7.2 1 .9 1.7 2.1 1.7 3.6V19h6v-2.2c0-2.1-2.7-3.8-6-3.8Z"/>',
  lore: '<path d="M6 2h11a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Zm0 15a1 1 0 0 0 0 2h11v-2H6Zm2-11v2h7V6H8Z"/>',
  book: '<path d="M4 4.5C4 3.7 4.7 3 5.5 3H11v16H5.5c-.8 0-1.5.7-1.5 1.5V4.5ZM13 3h5.5c.8 0 1.5.7 1.5 1.5v16c0-.8-.7-1.5-1.5-1.5H13V3Z"/>',
  timeline: '<path d="M4 4h2v16H4V4Zm4 1h12v4H8V5Zm0 6h8v4H8v-4Zm0 6h10v2H8v-2Z"/>',
  thread: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-2h2v2Zm2.1-7.8-.9.9c-.7.7-1.2 1.4-1.2 2.9h-2v-.5c0-1.1.5-2.1 1.2-2.8l1.2-1.3a2 2 0 1 0-3.4-1.4H8a4 4 0 1 1 7.1 2.2Z"/>',
  contra: '<path d="M12 2 1 21h22L12 2Zm1 16h-2v-2h2v2Zm0-4h-2V9h2v5Z"/>',
  facts: '<path d="M4 5h2v2H4V5Zm4 0h12v2H8V5Zm-4 6h2v2H4v-2Zm4 0h12v2H8v-2Zm-4 6h2v2H4v-2Zm4 0h12v2H8v-2Z"/>',
  more: '<path d="M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z"/>',
  eye: '<path d="M12 5C6.5 5 2.7 9.4 1.5 12c1.2 2.6 5 7 10.5 7s9.3-4.4 10.5-7C21.3 9.4 17.5 5 12 5Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/>',
  close: '<path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z"/>',
  read: '<path d="M21 5c-1.1-.4-2.3-.5-3.5-.5-1.9 0-4 .4-5.5 1.5C10.5 4.9 8.4 4.5 6.5 4.5S2.5 4.9 1 6v14.6c0 .3.3.5.5.5h.3c1.4-.7 3.3-1.1 4.7-1.1 1.9 0 4 .4 5.5 1.5 1.4-.9 3.8-1.5 5.5-1.5 1.6 0 3.3.3 4.7 1l.3.1c.3 0 .5-.3.5-.5V6c-.6-.4-1.2-.7-2-1Zm0 13.5c-1.1-.3-2.3-.5-3.5-.5-1.7 0-4.1.7-5.5 1.5V8c1.4-.9 3.8-1.5 5.5-1.5 1.2 0 2.4.2 3.5.5v11.5Z"/>',
  prev: '<path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12l4.6-4.6Z"/>',
  next: '<path d="M8.6 16.6 10 18l6-6-6-6-1.4 1.4 4.6 4.6-4.6 4.6Z"/>',
};
const icon = (name, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICON[name] ?? ''}</svg>`;

// ---------- citations ----------

// Each chip holds one or more refs from the same chapter (or sheet row); tapping it shows them all.
let REFS = [];
const resetRefs = () => { REFS = []; };
function citeChip(refOrRefs) {
  const refs = [].concat(refOrRefs);
  const ref = refs[0];
  const i = REFS.push(refs) - 1;
  const n = refs.length > 1 ? `<span class="faint"> ×${refs.length}</span>` : '';
  if (ref.file === 'sheet') return `<button type="button" class="cite sheet" data-ref="${i}" title="Planning sheet, row ${ref.row}">Sheet r${ref.row}${n}</button>`;
  return `<button type="button" class="cite" data-ref="${i}" title="${esc(chLong(ref.ch))}">${chLabel(ref.ch)}${n}</button>`;
}
function cites(refs) {
  const groups = new Map();
  for (const r of refs ?? []) {
    const k = r.file === 'sheet' ? 'sheet:' + r.row : r.ch;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  return `<span class="cites">${[...groups.values()].map(citeChip).join('')}</span>`;
}

function refSourceHTML(ref) {
  if (ref.file === 'sheet') return `<div class="src"><b>Sheet</b> (sheet.csv) · row ${ref.row}</div>`;
  const c = CH[ref.ch];
  const f = DB.files[ref.file];
  if (c?.post) return `<div class="src"><b>Post</b> (${esc(f?.source?.split('/').pop() ?? ref.file)}) · <a href="#/chapter/${ref.ch}">${md(c.title ?? '')}</a><div class="faint small">Read after ${esc(postAfter(c))}</div></div>`;
  const name = c ? (isChapter(c) ? `Ch ${c.number}` : chName(c)) : '?';
  return `<div class="src"><b>${MULTI_BOOK ? `Book ${c?.book ?? '?'}` : 'Book'}</b> (${esc(f?.source?.split('/').pop() ?? ref.file)}) · <a href="#/chapter/${ref.ch}">${esc(name)}${c?.title ? ' “' + md(c.title) + '”' : ''}</a>${f?.title ? `<div class="faint small">${esc(f.title)}</div>` : ''}</div>`;
}
function readHref(ref) {
  return `#/read/${ref.ch}?q=${encodeURIComponent(ref.quote)}`;
}
function openRef(refs) {
  refs = [].concat(refs);
  const ref = refs[0];
  let body = refSourceHTML(ref);
  if (ref.file === 'sheet') {
    for (const r of refs) body += `<div class="quote">${(r.cells ?? []).map((c) => `<div>${esc(c)}</div>`).join('')}</div>`;
    body += '<p class="faint small">The planning sheet is author knowledge, not text a reader sees.</p>';
  } else if (refs.length === 1) {
    body += `<blockquote class="quote">${md(ref.quote)}</blockquote>`;
    body += `<div class="actions"><a class="btn primary" href="${readHref(ref)}">${icon('read')} Read in context</a><a class="btn" href="#/chapter/${ref.ch}">Chapter page</a></div>`;
  } else {
    body += refs.map((r) => `<blockquote class="quote">${md(r.quote)}<div><a class="small" href="${readHref(r)}">Read in context →</a></div></blockquote>`).join('');
    body += `<div class="actions"><a class="btn" href="#/chapter/${ref.ch}">Chapter page</a></div>`;
  }
  openSheet(body);
}

// ---------- modal sheet ----------

function openSheet(html, { title } = {}) {
  closeSheet();
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  const pop = document.createElement('div');
  pop.className = 'pop';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-modal', 'true');
  pop.innerHTML = `<button type="button" class="iconbtn close" aria-label="Close">${icon('close')}</button>${title ? `<h2>${esc(title)}</h2>` : ''}${html}`;
  scrim.addEventListener('click', closeSheet);
  pop.querySelector('.close').addEventListener('click', closeSheet);
  pop.addEventListener('click', (e) => { if (e.target.closest('a[href^="#"]')) closeSheet(); });
  document.body.append(scrim, pop);
  pop.querySelector('a, button:not(.close), select, input')?.focus({ preventScroll: true });
  return pop;
}
function closeSheet() {
  $$('.scrim, .pop').forEach((n) => n.remove());
}

// ---------- labels ----------

function basisBadge(basis) {
  if (!basis || basis === 'stated') return '';
  const title = { implied: 'Shown by the passage but not said outright', claim: 'Asserted by a character, not confirmed by narration', inferred: 'Worked out from quoted cues (date or number arithmetic)', rumor: 'Reported as rumor' }[basis] ?? '';
  return ` <span class="badge ${esc(basis)}" title="${title}">${esc(basis)}</span>`;
}
const disputedBadge = (cid) => ` <a class="badge disputed" href="#/contradiction/${encodeURIComponent(cid ?? '')}" title="Sources disagree; see the contradiction">disputed</a>`;
const presenceBadge = (p) => (p === 'on-page' ? '<span class="badge onpage">on page</span>' : '<span class="badge">mentioned</span>');
const NM = '<span class="nm">Not mentioned</span>';
const HIDDEN = '<span class="nm" title="Some of its sources are after your reading point">Hidden in reader mode</span>';

// ---------- sourced values ----------

function valText(v) {
  if (v == null) return '';
  if (typeof v === 'object') return esc(JSON.stringify(v));
  return md(String(v));
}
function oneValue(v, { format } = {}) {
  const refs = okRefs(v.refs);
  const shown = format ? format(v.value) : valText(v.value);
  const since = v.since ? ` <span class="faint small">since ${chLabel(v.since)}</span>` : '';
  return `${shown}${basisBadge(v.basis)}${v.approx ? ' <span class="badge approx">approx.</span>' : ''}${since} ${cites(refs)}`;
}
// Renders a sourced value, a disputed value, or Not mentioned, honoring reader-knowledge mode.
// strict: the value is written text that may combine its sources, so every source must be known.
function valueHTML(v, opts = {}) {
  if (v == null) return NM;
  const ok = opts.strict ? allOk : anyOk;
  if (v.disputed) {
    const versions = v.disputed.filter((x) => ok(x.refs));
    if (!versions.length) return HIDDEN;
    if (versions.length === 1) return oneValue(versions[0], opts);
    return `<div>${versions.map((x) => `<div>${oneValue(x, opts)}</div>`).join('')}${disputedBadge(v.contradiction)}</div>`;
  }
  if (!ok(v.refs)) return HIDDEN;
  return oneValue(v, opts);
}
function datesHTML(d) {
  if (!d) return NM;
  if (d.disputed) {
    const versions = d.disputed.filter((x) => anyOk(x.refs));
    if (!versions.length) return NM;
    if (versions.length === 1) return datesHTML(versions[0]);
    return `<div>${versions.map((x) => `<div>${datesHTML(x)}</div>`).join('')}${disputedBadge(d.contradiction)}</div>`;
  }
  if (!anyOk(d.refs)) return HIDDEN;
  return `${esc(fmtRange(d))}${basisBadge(d.basis)}${d.approx ? ' <span class="badge approx">approx.</span>' : ''}${cites(okRefs(d.refs))}`;
}

// ---------- prose ----------

// Registry prose: [{ text, refs }]. Chapter prose: [{ text, quote }] with chId given.
function proseHTML(sentences, chId) {
  const list = (sentences ?? []).map((s) => (s.refs ? s : { text: s.text, refs: [chRef(chId, s.quote)] })).filter((s) => allOk(s.refs));
  if (!list.length) return '';
  return `<p class="prose">${list.map((s) => `<span class="s">${md(s.text)}${cites(s.refs)}</span>`).join(' ')}</p>`;
}

// ---------- facts ----------

const CATEGORY_LABEL = {
  appearance: 'Appearance', outfit: 'Wardrobe', taste: 'Tastes', habit: 'Habits & mannerisms', personality: 'Personality',
  backstory: 'Backstory', relationship: 'Relationships', ability: 'Abilities', status: 'Status', possession: 'Possessions',
  goal: 'Goals', secret: 'Secrets', knowledge: 'Who knows what', deception: 'Lies & disguises', description: 'Description', geography: 'Geography', history: 'History', lore: 'Lore', other: 'Other',
};
const CATEGORY_ORDER = Object.keys(CATEGORY_LABEL);

function voiceLabel(f) {
  if (f.voice === 'dialogue') return `said by ${f.speaker ? entLink(f.speaker) : 'someone'}`;
  if (f.voice === 'thought') return `thought${f.speaker ? ' by ' + entLink(f.speaker) : ''}`;
  if (f.voice === 'document') return `in writing${f.speaker ? ' by ' + entLink(f.speaker) : ''}`;
  return '';
}
function factHTML(f, { about = true, except = null, quote = false } = {}) {
  const v = voiceLabel(f);
  const others = about ? (f.about ?? []).filter((id) => id !== except) : [];
  return `<div class="fact"><div>${md(f.text)}${basisBadge(f.basis)} ${citeChip(f.ref)}</div>`
    + (quote ? `<div class="q">“${md(f.ref.quote)}”</div>` : '')
    + (v || others.length ? `<div class="about">${[f.aspect ? esc(f.aspect) : '', v, others.length ? 'about ' + others.map((id) => entLink(id)).join(', ') : ''].filter(Boolean).join(' · ')}</div>` : '')
    + '</div>';
}
// Facts grouped by chapter, in chapter order.
function factsByChapterHTML(facts, opts) {
  let html = '', last = null;
  for (const f of [...facts].sort(byKey((x) => ord(x.ref.ch)))) {
    if (f.ref.ch !== last) { html += `<div class="chhead"><a href="#/chapter/${f.ref.ch}">${esc(chLong(f.ref.ch))}</a></div>`; last = f.ref.ch; }
    html += factHTML(f, opts);
  }
  return html;
}

// ---------- chapter strip ----------

function stripHTML(appearances) {
  const by = {};
  for (const a of appearances ?? []) if (by[a.ch] !== 'on-page') by[a.ch] = a.presence;
  let html = '<div class="strip">', lastBook = null;
  for (const c of CH_LIST) {
    if (lastBook !== null && c.book !== lastBook) html += '<span class="gap"></span>';
    lastBook = c.book;
    const p = by[c.id];
    const later = !chOk(c.id);
    const cls = [p === 'on-page' && !later ? 'on' : p && !later ? 'men' : '', later ? 'later' : ''].join(' ');
    html += `<a class="${cls}" href="#/chapter/${c.id}" title="${esc(chLong(c.id))}${p && !later ? ' — ' + p : ''}"></a>`;
  }
  return html + '</div><div class="legend"><span><i style="background:var(--onpage)"></i>on page</span><span><i style="background:var(--mentioned)"></i>mentioned</span><span><i style="background:var(--surface-2)"></i>absent</span></div>';
}

// ---------- paging ----------

// Renders items into el in pages; returns nothing. renderItems(slice) must return HTML.
function paged(el, items, renderItems, size = 60) {
  let shown = 0;
  const more = () => {
    el.querySelector(':scope > .more')?.remove();
    const next = items.slice(shown, shown + size);
    el.insertAdjacentHTML('beforeend', renderItems(next, shown));
    shown += next.length;
    if (shown < items.length) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn more';
      b.textContent = `Show more (${(items.length - shown).toLocaleString()} left)`;
      b.addEventListener('click', more);
      el.appendChild(b);
    }
  };
  el.innerHTML = '';
  more();
}

// ---------- filter controls ----------

function segHTML(name, options, value) {
  return `<div class="seg" data-seg="${name}">${options.map(([v, l]) => `<button type="button" data-v="${esc(v)}" class="${String(v) === String(value) ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`;
}
function selectHTML(name, options, value, allLabel) {
  return `<select name="${name}" aria-label="${esc(allLabel)}"><option value="">${esc(allLabel)}</option>${options.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(value) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
}
// Book filters, shown only when there is more than one book to choose from.
function bookSeg(value) {
  if (BOOKS.length < 2) return '';
  return segHTML('book', [['', BOOKS.length === 2 ? 'Both books' : 'All books'], ...BOOKS.map((b) => [b, `Book ${b}`])], value);
}
function bookSelect(value, label = (b) => `Book ${b}`) {
  return BOOKS.length < 2 ? '' : selectHTML('book', BOOKS.map((b) => [b, label(b)]), value, 'Any book');
}
// Wires a .filters form: inputs, selects, checkboxes and segmented buttons all call onChange(values).
function bindFilters(form, onChange) {
  const read = () => {
    const v = {};
    $$('input[name], select[name]', form).forEach((i) => { v[i.name] = i.type === 'checkbox' ? i.checked : i.value; });
    $$('[data-seg]', form).forEach((s) => { v[s.dataset.seg] = $('button.on', s)?.dataset.v ?? ''; });
    return v;
  };
  let t;
  form.addEventListener('input', (e) => {
    clearTimeout(t);
    if (e.target.type === 'search' || e.target.type === 'text') t = setTimeout(() => onChange(read()), 160);
    else onChange(read());
  });
  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('click', (e) => {
    const b = e.target.closest('[data-seg] button');
    if (!b) return;
    $$('button', b.parentElement).forEach((x) => x.classList.toggle('on', x === b));
    onChange(read());
  });
  return read;
}
// Text filter over sNorm() text: every word (or "quoted phrase") must start a word in the text; -word excludes.
function makeMatcher(q) {
  const terms = [];
  String(q ?? '').replace(/(-?)"([^"]+)"|(-?)(\S+)/g, (_, n1, phrase, n2, word) => {
    const t = sNorm(phrase ?? word).trim();
    if (t) terms.push({ t, not: (n1 || n2) === '-' });
    return '';
  });
  if (!terms.length) return null;
  const fn = (hay) => terms.every(({ t, not }) => hay.includes(' ' + t) !== not);
  fn.terms = terms.filter((x) => !x.not).map((x) => x.t);
  return fn;
}
