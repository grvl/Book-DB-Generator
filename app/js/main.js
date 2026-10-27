// App shell: navigation, routing, reader-mode selector, global handlers.
'use strict';

function setTitle(t) { document.title = t ? `${plain(t)} · ${PROJECT.name}` : PROJECT.name; }
function notFound(el) { setTitle('Not found'); el.innerHTML = '<div class="page-head"><h1>Not found</h1></div><p>No record with that ID. <a href="#/">Go home</a>.</p>'; }

const NAV = [
  ['', 'home', 'Home'],
  ['search', 'search', 'Search'],
  ['characters', 'person', 'Characters', () => knownIds(Object.keys(DB.characters), 'characters').length],
  ['places', 'place', 'Places', () => knownIds(Object.keys(DB.places), 'places').length],
  ['events', 'event', 'Events', () => knownIds(Object.keys(DB.events), 'events').length],
  ['groups', 'group', 'Groups', () => knownIds(Object.keys(DB.groups), 'groups').length],
  ['lore', 'lore', 'Lore', () => knownIds(Object.keys(DB.lore), 'lore').length],
  null,
  ['chapters', 'book', 'Chapters', () => CH_LIST.filter((c) => chOk(c.id)).length],
  ['timeline', 'timeline', 'Timeline'],
  ['threads', 'thread', 'Plot threads', () => Object.values(DB.threads).filter((t) => entOk(t.id, 'threads') && threadStatus(t) === 'open').length],
  ['contradictions', 'contra', 'Contradictions', () => DB.contradictions.filter((c) => c.status === 'open' && contraOk(c)).length],
  ['facts', 'facts', 'Facts', () => FACTS.filter((f) => refOk(f.ref)).length],
];
const TABS = [['', 'home', 'Home'], ['characters', 'person', 'Characters'], ['chapters', 'book', 'Chapters'], ['timeline', 'timeline', 'Timeline']];
// Which nav entry a route belongs to.
const NAV_OF = { character: 'characters', place: 'places', event: 'events', group: 'groups', chapter: 'chapters', read: 'chapters', thread: 'threads', contradiction: 'contradictions' };

function navLinks() {
  return NAV.map((n) => (n ? `<a href="#/${n[0]}" data-nav="${n[0]}">${icon(n[1])}<span>${n[2]}</span>${n[3] ? `<span class="count">${n[3]().toLocaleString()}</span>` : ''}</a>` : '<div class="sep"></div>')).join('');
}
function renderShell() {
  $('#sidenav').innerHTML = navLinks();
  $('#tabbar').innerHTML = TABS.map((t) => `<a href="#/${t[0]}" data-nav="${t[0]}">${icon(t[1])}<span>${t[2]}</span></a>`).join('')
    + `<button type="button" data-action="menu">${icon('more')}<span>More</span></button>`;
  updateAsOfButton();
}
function updateNav(section) {
  $$('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === section));
}
function updateAsOfButton() {
  const b = $('#asof');
  b.classList.toggle('on', limited());
  b.innerHTML = `${icon('eye')}<span class="lbl">${esc(limited() ? asOfLabel() : 'Reader mode')}</span>`;
  b.title = limited() ? `Reader mode: showing only what a reader knows ${asOfLabel().toLowerCase()}` : 'Reader mode: hide everything after a chapter';
}

function openAsOf() {
  const opts = BOOKS.map((b) => `<optgroup label="${esc(MULTI_BOOK ? `Book ${b}: ${bookTitle(b)}` : bookTitle(b))}">${CH_LIST.filter((c) => c.book === b).map((c) => `<option value="${c.order}"${state.asOf === c.order ? ' selected' : ''}>${chLabel(c.id)} ${esc(c.title ?? '')}</option>`).join('')}</optgroup>`).join('');
  const pop = openSheet(`<p class="muted">Show only what a reader knows after finishing a chapter. Facts, summaries, events, threads and contradictions sourced from later chapters are hidden, and threads resolved later show as open.</p>
    <div class="formrow"><label for="asof-ch">I have read up to</label><select id="asof-ch"><option value="">Everything (reader mode off)</option>${opts}</select></div>
    ${HAS_SHEET ? `<div class="formrow"><label class="chk" style="font-weight:400;display:flex;gap:8px;align-items:center"><input type="checkbox" id="asof-sheet"${state.sheet ? ' checked' : ''}> Include planning-sheet info (dates, birthdays, ages)</label><div class="faint small">The sheet is author knowledge rather than text a reader sees.</div></div>` : ''}
    <div class="actions"><button type="button" class="btn primary" id="asof-apply">Apply</button><button type="button" class="btn" id="asof-off">Show everything</button></div>`, { title: 'Reader mode' });
  const apply = (v) => {
    state.asOf = v === '' || v == null ? null : Number(v);
    state.sheet = !HAS_SHEET || $('#asof-sheet', pop).checked;
    store.set('asOf', state.asOf);
    store.set('sheet', state.sheet);
    SEARCH_DOCS = null;
    closeSheet();
    renderShell();
    route();
  };
  $('#asof-apply', pop).addEventListener('click', () => apply($('#asof-ch', pop).value));
  $('#asof-off', pop).addEventListener('click', () => apply(''));
}

function openMenu() {
  openSheet(`<nav class="menu-sheet">${navLinks()}</nav>`, { title: PROJECT.name });
}
// ---------- routing ----------

const scrollPos = {};
function route() {
  resetRefs();
  closeSheet();
  const { parts, params } = parseHash();
  const el = $('#view');
  const [a = '', b] = parts;
  const t = ROUTE_TYPE[a];
  try {
    if (a === '') viewHome(el);
    else if (a === 'search') viewSearch(el, params);
    else if (a === 'characters') viewCharacters(el, params);
    else if (a === 'places') viewPlaces(el, params);
    else if (a === 'events') viewEvents(el, params);
    else if ((a === 'groups' || a === 'lore') && !b) viewKinds(el, params, a);
    else if (a === 'chapters') viewChapters(el, params);
    else if (a === 'chapter') viewChapter(el, b);
    else if (a === 'read') viewRead(el, b, params);
    else if (a === 'timeline') viewTimeline(el, params);
    else if (a === 'threads') viewThreads(el, params);
    else if (a === 'contradictions') viewContradictions(el, params);
    else if (a === 'contradiction') viewContradiction(el, b);
    else if (a === 'facts') viewFacts(el, params);
    else if (t === 'characters') viewCharacter(el, b);
    else if (t === 'places') viewPlace(el, b);
    else if (t === 'events') viewEvent(el, b);
    else if (t === 'groups' || t === 'lore') viewKind(el, b, t);
    else if (t === 'threads') viewThread(el, b);
    else notFound(el);
  } catch (err) {
    console.error(err);
    el.innerHTML = `<div class="notice warn">Something went wrong rendering this page: ${esc(err.message)}</div>`;
  }
  if (a !== 'search') { const q = $('#topq'); if (q && document.activeElement !== q) q.value = ''; searchRerun = null; }
  updateNav(NAV_OF[a] ?? (a === 'group' ? 'groups' : a));
  if (a !== 'read') {
    const y = scrollPos[location.hash];
    window.scrollTo(0, y ?? 0);
  }
}

window.addEventListener('hashchange', (e) => {
  try { scrollPos[new URL(e.oldURL).hash] = window.scrollY; } catch { /* ignore */ }
  route();
});

// ---------- global handlers ----------

document.addEventListener('click', (e) => {
  const c = e.target.closest('.cite[data-ref]');
  if (c) { e.preventDefault(); const r = REFS[Number(c.dataset.ref)]; if (r) openRef(r); return; }
  const act = e.target.closest('[data-action]');
  if (act?.dataset.action === 'asof') { openAsOf(); return; }
  if (act?.dataset.action === 'menu') { openMenu(); return; }
  const a = e.target.closest('a[href^="#"]');
  if (a) delete scrollPos[a.getAttribute('href')];
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeSheet(); return; }
  const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName ?? '');
  if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) { e.preventDefault(); $('#topq').focus(); $('#topq').select(); }
});

function initSearchBox() {
  const form = $('#topsearch');
  const q = $('#topq');
  let t;
  q.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      if (searchRerun) searchRerun();
      else if (q.value.trim()) location.hash = '#/search?q=' + encodeURIComponent(q.value);
    }, 180);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(t);
    if (searchRerun) searchRerun();
    else location.hash = '#/search?q=' + encodeURIComponent(q.value);
  });
}

// ---------- start ----------

// The name in the top bar and on the home screen comes from config.json. A name ending in "DB" gets the accent.
(function brand() {
  const n = PROJECT.name;
  const m = n.match(/^(.*\S)(\s?DB)$/);
  $('.brand').innerHTML = m ? `${esc(m[1])}<span>${esc(m[2])}</span>` : esc(n);
  $('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', n);
  $('meta[name="description"]')?.setAttribute('content', PROJECT.description ?? '');
})();
renderShell();
initSearchBox();
$('#asof').addEventListener('click', openAsOf);
route();
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service worker not registered:', err));
}
