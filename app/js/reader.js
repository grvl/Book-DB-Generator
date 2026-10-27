// Reader view: a chapter's full text, with the cited quote or search terms highlighted.
'use strict';

const READER_DEFAULTS = { size: 1.15, lh: 1.7, font: 'serif', layout: 'indent' };
const readerPrefs = () => ({ ...READER_DEFAULTS, ...store.get('reader', {}) });
function applyReaderPrefs(box) {
  const p = readerPrefs();
  box.style.setProperty('--reader-size', p.size + 'rem');
  box.style.setProperty('--reader-lh', p.lh);
  box.classList.toggle('sans', p.font === 'sans');
  box.classList.toggle('spaced', p.layout === 'spaced');
}

function openReaderSettings(box) {
  const p = readerPrefs();
  const pop = openSheet(`
    <div class="formrow"><label>Text size</label><div class="seg" data-seg="size">${[[1, 'S'], [1.15, 'M'], [1.3, 'L'], [1.5, 'XL']].map(([v, l]) => `<button type="button" data-v="${v}" class="${p.size === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="formrow"><label>Line spacing</label><div class="seg" data-seg="lh">${[[1.5, 'Tight'], [1.7, 'Normal'], [1.95, 'Loose']].map(([v, l]) => `<button type="button" data-v="${v}" class="${p.lh === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="formrow"><label>Font</label><div class="seg" data-seg="font">${[['serif', 'Serif'], ['sans', 'Sans']].map(([v, l]) => `<button type="button" data-v="${v}" class="${p.font === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="formrow"><label>Paragraphs</label><div class="seg" data-seg="layout">${[['indent', 'Book (indented)'], ['spaced', 'Spaced']].map(([v, l]) => `<button type="button" data-v="${v}" class="${p.layout === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>`, { title: 'Reading settings' });
  pop.addEventListener('click', (e) => {
    const b = e.target.closest('[data-seg] button');
    if (!b) return;
    const key = b.parentElement.dataset.seg;
    $$('button', b.parentElement).forEach((x) => x.classList.toggle('on', x === b));
    const prefs = readerPrefs();
    prefs[key] = ['size', 'lh'].includes(key) ? Number(b.dataset.v) : b.dataset.v;
    store.set('reader', prefs);
    applyReaderPrefs(box);
  });
}

let readerScrollHandler = null;
function viewRead(el, id, params) {
  const c = CH[id];
  if (!c) return notFound(el);
  setTitle(`${chLabel(id)} ${c.title ?? ''}`);
  el.innerHTML = '<div class="loading">Loading the chapter…</div>';
  loadText().then(() => {
    if (parseHash().parts[1] !== id) return;
    renderReader(el, c, params);
  }).catch((e) => { el.innerHTML = `<div class="notice warn">${esc(e.message)}. Run <code>node tools/build.mjs</code> to generate it.</div>`; });
}

function renderReader(el, c, params) {
  const id = c.id;
  const prev = CH_LIST[c.idx - 1], next = CH_LIST[c.idx + 1];
  const paras = paragraphs(id);
  let body = '', first = true;
  paras.forEach((raw, i) => {
    if (raw === '***') { body += '<hr>'; first = true; return; }
    body += `<p id="p${i}"${first ? ' class="first"' : ''}>${md(raw)}</p>`;
    first = false;
  });
  const navBtn = (x, dir) => (x ? `<a class="btn" href="#/read/${x.id}" title="${esc(chLong(x.id))}">${dir === 'prev' ? icon('prev') + ' ' + chLabel(x.id) : chLabel(x.id) + ' ' + icon('next')}</a>` : '<span></span>');
  el.innerHTML = `
    <div class="reader-top">
      <a class="btn" href="#/chapter/${id}" title="Chapter page: summary, who and where, facts">${icon('book')}<span class="wide-only">Chapter page</span></a>
      <form class="findbar" id="find"><input type="search" name="f" placeholder="Find in chapter" value="${esc(params.get('find') ?? '')}" aria-label="Find in chapter"><span id="fcount" class="small muted nowrap"></span><button type="button" class="iconbtn" id="fprev" aria-label="Previous match">${icon('prev')}</button><button type="button" class="iconbtn" id="fnext" aria-label="Next match">${icon('next')}</button></form>
      <button type="button" class="btn" id="aa" aria-label="Reading settings">Aa</button>
    </div>
    ${chOk(id) ? '' : `<div class="notice warn reader-panel">This chapter is after your reading point (${esc(asOfLabel())}).</div>`}
    <article class="reader" id="text">
      <h1>${md(c.title ?? (c.post ? '' : chName(c)))}</h1>
      <div class="booktitle">${c.post ? `Post · after ${esc(postAfter(c))}` : `${esc(bookTitle(c.book))} · ${esc(chName(c))}`}${dateValue(c.dates)?.start && anyOk(dateValue(c.dates).refs) ? ' · ' + esc(fmtRange(dateValue(c.dates))) : ''}</div>
      ${body}
    </article>
    <div class="reader-nav">${navBtn(prev, 'prev')}${navBtn(next, 'next')}</div>`;
  const box = $('#text', el);
  applyReaderPrefs(box);
  $('#aa', el).addEventListener('click', () => openReaderSettings(box));

  // The cited quote, if any.
  let target = null;
  const quote = params.get('q');
  if (quote) {
    const nq = norm(quote);
    const marks = markText(box, nq, 'strong');
    if (marks.length) target = marks[0];
    else {
      // Fall back to the paragraph holding the start of the quote.
      const head = nq.split(' ').slice(0, 5).join(' ');
      target = $$('p', box).find((p) => norm(p.textContent).includes(head)) ?? null;
      target?.classList.add('hl');
    }
  }

  // Find in chapter.
  let finds = [], cur = -1;
  const fcount = $('#fcount', el);
  const show = (i) => {
    if (!finds.length) return;
    finds[cur]?.classList.remove('cur');
    cur = (i + finds.length) % finds.length;
    finds[cur].classList.add('cur');
    finds[cur].scrollIntoView({ block: 'center' });
    fcount.textContent = `${cur + 1}/${finds.length}`;
  };
  const find = (q, jump) => {
    finds.forEach((m) => { m.replaceWith(...m.childNodes); });
    box.normalize();
    finds = []; cur = -1;
    const m = makeMatcher(q);
    if (!m) { fcount.textContent = ''; return; }
    for (const t of m.terms) finds.push(...markText(box, t, 'find', true));
    finds.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    fcount.textContent = finds.length ? `${finds.length}` : 'none';
    if (jump && finds.length) show(0);
  };
  const form = $('#find', el);
  let t;
  form.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => find(form.f.value, true), 200); });
  form.addEventListener('submit', (e) => { e.preventDefault(); show(cur + 1); });
  $('#fprev', el).addEventListener('click', () => show(cur - 1));
  $('#fnext', el).addEventListener('click', () => show(cur + 1));
  if (params.get('find')) find(params.get('find'), false);

  const p = params.get('p');
  const pEl = p != null ? $('#p' + p, box) : null;
  const scrollTo = target ?? (pEl && params.get('find') ? $('mark.find', pEl) ?? pEl : pEl);
  if (pEl && params.get('find')) pEl.classList.add('hl');
  if (scrollTo) setTimeout(() => scrollTo.scrollIntoView({ block: 'center' }), 0);
  else window.scrollTo(0, 0);

  // Remember the reading position for "Continue reading".
  if (readerScrollHandler) window.removeEventListener('scroll', readerScrollHandler);
  let pending = false;
  readerScrollHandler = () => {
    if (pending) return;
    pending = true;
    setTimeout(() => {
      pending = false;
      if (!document.body.contains(box)) { window.removeEventListener('scroll', readerScrollHandler); return; }
      const top = $$('p[id]', box).find((x) => x.getBoundingClientRect().bottom > 80);
      store.set('lastRead', { ch: id, p: top ? Number(top.id.slice(1)) : 0 });
    }, 400);
  };
  window.addEventListener('scroll', readerScrollHandler, { passive: true });
  store.set('lastRead', { ch: id, p: p != null ? Number(p) : 0 });
}
