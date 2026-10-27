#!/usr/bin/env node
// Converts each book's source file into a normalized Markdown mirror (text/).
// The mirror is what the AI reads, what every citation quote is checked
// against, and what `git diff` shows when the manuscript changes.
//
// Accepted sources (chosen by file extension):
//   .md    Markdown, including the Google Docs "Download > Markdown" export (escaped punctuation,
//          bold, tab indents, links, images and hard line breaks are normalized)
//   .docx  Word file, also what Google Docs, LibreOffice, Pages and Scrivener export (read with node:zlib)
// No npm dependencies.
//
// Output conventions:
//   # Book title          from a Title-styled (or level-1) paragraph before the first chapter
//   ## Chapter N: Title   from any heading, or any short paragraph, that reads "Chapter N", "Chapter N: Title",
//                         "Chapter Twelve - Title", "Chapter XII. Title" and so on. Heading-styled "12", "XII"
//                         and "12. Title" count too. A title-less chapter heading takes its title from a heading
//                         right after it ("Chapter 1" then "The Storm").
//   ## Prologue: Title    likewise for prologues, epilogues and interludes (## Epilogue, ## Interlude 2: Title)
//   *italic*              italic runs (inner thoughts, emphasis, foreign words)
//   ***                   scene breaks ("***", "* * *", "#", "~~~", "---" and similar on their own line)
//   one paragraph per line, separated by blank lines
// The words that mark a chapter, prologue, epilogue or interlude can be changed in config.json ("headings"),
// for example to add "Capítulo" or "Kapitel". See docs/CONFIGURATION.md.
//
// Posts (config.json entries with "kind": "post") are written as one section with no
// chapter headings; their images are dropped.
// A config entry whose source file doesn't exist yet (a book not uploaded yet) is skipped.
//
// Usage: node tools/extract.mjs [fileKey...]   (default: every book and post in config.json)

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { ROOT as root, loadConfig } from './lib.mjs';

const config = loadConfig();

const DEFAULT_HEADINGS = { chapter: ['Chapter'], prologue: ['Prologue'], epilogue: ['Epilogue'], interlude: ['Interlude'] };
const HEADINGS = { ...DEFAULT_HEADINGS, ...(config.headings ?? {}) };

// ---------- .docx ----------

function readZipEntry(buf, wanted) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (name === wanted) {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + size);
      if (method === 0) return data;
      if (method === 8) return inflateRawSync(data);
      throw new Error(`unsupported zip compression method ${method}`);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

const decode = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&amp;/g, '&');

function runText(xml) {
  let out = '';
  for (const m of xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:(tab|br|cr|noBreakHyphen)\b([^>]*)\/>/g)) {
    if (m[1] !== undefined) out += decode(m[1]);
    else if (m[2] === 'noBreakHyphen') out += '-';
    else if (m[2] === 'br' && !/w:type="(page|column)"/.test(m[3])) out += '\n';   // manual line break: new paragraph
    else out += ' ';
  }
  return out;
}

function isItalic(runXml) {
  const rPr = runXml.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);
  if (!rPr) return false;
  const i = rPr[1].match(/<w:i(?:\s+w:val="([^"]*)")?\s*\/>/);
  return !!i && !['0', 'false', 'off'].includes(i[1]);
}

// Style ids are localized in some versions of Word ("Ttulo2", "berschrift2"), but the style's w:name keeps the
// built-in English name ("heading 2", "Title"). Map each id to its name.
function styleNames(buf) {
  const xml = readZipEntry(buf, 'word/styles.xml')?.toString('utf8') ?? '';
  const names = {};
  for (const [, id, inner] of xml.matchAll(/<w:style\b[^>]*w:styleId="([^"]*)"[^>]*>([\s\S]*?)<\/w:style>/g)) {
    const name = inner.match(/<w:name w:val="([^"]*)"/)?.[1];
    if (name) names[id] = name;
  }
  return names;
}

function docxParagraphs(documentXml, names) {
  const body = documentXml.replace(/<w:p\b[^>]*\/>/g, '');
  const result = [];
  for (const [, inner] of body.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)) {
    const styleId = inner.match(/<w:pStyle w:val="([^"]*)"/)?.[1] ?? '';
    const style = (names[styleId] ?? styleId).toLowerCase().replace(/\s+/g, '');
    const segments = [];
    for (const [run] of inner.matchAll(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g)) {
      const text = runText(run);
      if (!text) continue;
      const italic = isItalic(run) && text.trim() !== '';
      const last = segments[segments.length - 1];
      // Whitespace-only runs join the previous segment, so "*a* *b*" reads "*a b*".
      if (last && (last.italic === italic || !text.trim())) last.text += text;
      else segments.push({ italic, text });
    }
    // A manual line break (Shift+Enter) splits the paragraph, as it does in the Markdown export.
    const lines = [[]];
    for (const seg of segments) seg.text.split('\n').forEach((text, i) => {
      if (i) lines.push([]);
      if (text) lines[lines.length - 1].push({ italic: seg.italic, text });
    });
    for (const segs of lines) result.push({ style, segments: segs, plain: segs.map((s) => s.text).join('') });
  }
  return result;
}

function toMarkdown(segments) {
  return segments.map(({ italic, text }) => {
    if (!italic) return text;
    const [, lead, core, trail] = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
    return `${lead}*${core}*${trail}`;
  }).join('').replace(/\s+/g, ' ').trim();
}

const SCENE_BREAK = /^(\\?[*#~•◇◆_\-–—]\s*){3,}$|^\\?[#~•◇◆]$/;

// Each reader returns blocks: { title, level, md, plain }
//   title    the source styles the paragraph as the book title (Title or Subtitle style)
//   level    heading level (1 to 6) when the source styles the paragraph as a heading, else 0
//   md       the paragraph as mirror Markdown (italics as *…*, no bold)
//   plain    the paragraph text without any markers

function docxBlocks(path) {
  const buf = readFileSync(path);
  const xml = readZipEntry(buf, 'word/document.xml')?.toString('utf8');
  if (!xml) throw new Error(`${path} has no word/document.xml; is it really a .docx file?`);
  return docxParagraphs(xml, styleNames(buf))
    .filter((p) => !/^toc\d/.test(p.style))                                   // table of contents
    .map((p) => ({
      title: p.style === 'title' || p.style === 'subtitle',
      level: p.style === 'title' ? 1 : Number(p.style.match(/^heading(\d)$/)?.[1] ?? 0),
      md: SCENE_BREAK.test(p.plain.trim()) ? '***' : toMarkdown(p.segments),
      plain: p.plain.trim(),
    }));
}

function mdBlocks(path) {
  const blocks = [];
  for (const raw of readFileSync(path, 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
    let line = raw.trim();
    if (SCENE_BREAK.test(line)) { blocks.push({ title: false, level: 0, md: '***', plain: '***' }); continue; }
    if (/^\[[^\]]+\]:\s*\S/.test(line)) continue;                          // link or image reference definition
    if (/^\[[^\]]*\]\(#[^)]*\)$/.test(line)) continue;                     // table-of-contents entry (a link to a heading)
    const h = line.match(/^(#{1,6})\s+(.*)$/) ?? line.match(/^(#{1,6})()$/);
    const level = h ? h[1].length : 0;
    if (h) line = h[2];
    line = line
      .replace(/!\[[^\]]*\](\([^)]*\)|\[[^\]]*\])/g, '')                   // images
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')                              // links keep their text
      .replace(/\\([!"#$%&'()+,\-./:;<=>?@[\]^_`{|}~])/g, '$1')            // unescape punctuation (not \* or \\)
      .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '$1')                          // drop bold, keep italics
      .replace(/__(?=\S)([\s\S]*?\S)__/g, '$1')
      .replace(/(^|[^\w\\])_(?=\S)([^_]*?\S)_(?!\w)/g, '$1*$2*')            // _italics_ become *italics*
      .replace(/\s+/g, ' ')
      .trim();
    if (!line) continue;
    const plain = line.replace(/\\\*/g, '\u0000').replace(/\*/g, '').replace(/\u0000/g, '*');
    blocks.push({ title: false, level, md: line, plain });
  }
  return blocks;
}

// ---------- section headings ----------

const fold = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

function wordsToNumber(s) {
  let n = 0;
  const tokens = s.toLowerCase().split(/[\s-]+/).filter((t) => t && t !== 'and');
  if (!tokens.length) return null;
  for (const t of tokens) {
    if (UNITS.includes(t)) n += UNITS.indexOf(t);
    else if (TENS[t]) n += TENS[t];
    else if (t === 'hundred') n = (n || 1) * 100;
    else return null;
  }
  return n;
}
function romanToNumber(s) {
  if (!/^(?=[mdclxvi])m*(c[md]|d?c{0,3})(x[cl]|l?x{0,3})(i[xv]|v?i{0,3})$/i.test(s)) return null;
  const v = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
  let n = 0;
  const t = s.toLowerCase();
  for (let i = 0; i < t.length; i++) n += v[t[i]] < (v[t[i + 1]] ?? 0) ? -v[t[i]] : v[t[i]];
  return n;
}
// The number at the start of s ("12", "XII", "Twenty-One"), with how many characters it takes.
function leadingNumber(s, { words = true } = {}) {
  const d = s.match(/^\d+/);
  if (d) return { value: Number(d[0]), length: d[0].length };
  const r = s.match(/^[ivxlcdm]+(?=$|[\s:.\-–—|])/i);
  if (r && romanToNumber(r[0])) return { value: romanToNumber(r[0]), length: r[0].length };
  if (!words) return null;
  const w = s.match(/^[a-z]+(?:[\s-]+[a-z]+){0,5}/i);
  if (!w) return null;
  const parts = w[0].split(/(?=[\s-])/);
  for (let n = parts.length; n > 0; n--) {
    const text = parts.slice(0, n).join('');
    const value = wordsToNumber(text);
    if (value) return { value, length: text.length };
  }
  return null;
}

// Does this block start a chapter (or prologue, epilogue, interlude)? Heading-styled blocks may omit the separator
// before a title ("Chapter 3 The Storm") or be a bare number ("12"); plain paragraphs must read exactly
// "Chapter N" or "Chapter N<separator> Title", so prose that happens to begin with the word never matches.
function matchSection(text, styled) {
  const s = text.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!s || s.length > 120) return null;
  const f = fold(s);
  const titleFrom = (rest) => {
    if (!rest) return { title: null };
    const sep = rest.match(/^[:.\-–—|]\s*(.*)$/);
    if (sep) return { title: sep[1].trim() || null };
    return styled ? { title: rest } : null;
  };
  for (const [kind, labels] of Object.entries(HEADINGS)) {
    for (const label of labels) {
      const l = fold(label);
      if (!f.startsWith(l) || (f.length > l.length && !/[\s:.\-–—|]/.test(f[l.length]))) continue;
      let rest = s.slice(l.length).trim();
      let number = null;
      if (kind === 'chapter' || kind === 'interlude') {
        const num = leadingNumber(rest);
        if (num) { number = num.value; rest = rest.slice(num.length).trim(); }
      }
      if (kind === 'chapter' && number == null) continue;
      const t = titleFrom(rest);
      if (t) return { kind, number, title: t.title };
    }
  }
  if (styled) {
    const num = leadingNumber(s, { words: false });
    const t = num && titleFrom(s.slice(num.length).trim());
    if (t) return { kind: 'chapter', number: num.value, title: t.title };
  }
  return null;
}

const KIND_LABEL = { chapter: 'Chapter', prologue: 'Prologue', epilogue: 'Epilogue', interlude: 'Interlude' };
const mirrorHeading = ({ kind, number, title }) => `## ${KIND_LABEL[kind]}${number != null ? ` ${number}` : ''}${title ? `: ${title}` : ''}`;

// ---------- convert ----------

function convert(key) {
  const entry = config.files[key];
  if (!entry) { console.log(`${key}: no such file key in config.json`); process.exitCode = 1; return; }
  const path = join(root, entry.source);
  // A book that hasn't been uploaded yet has no source file. That is normal, not an error.
  if (!existsSync(path)) { console.log(`${key}: ${entry.source} does not exist yet (nothing uploaded), skipped`); return; }
  if (!/\.(md|docx)$/i.test(path)) { console.log(`${key}: ${entry.source} must be a .md or .docx file`); process.exitCode = 1; return; }
  const blocks = /\.md$/i.test(path) ? mdBlocks(path) : docxBlocks(path);
  const lines = [`<!-- Generated from ${entry.source} by tools/extract.mjs. Do not edit by hand. -->`];
  const titleParts = [];
  const sections = [];
  const warnings = [];
  const plainHeadings = [];

  if (entry.kind === 'post') {
    // A post is one section: no chapter headings, images dropped, one paragraph per line.
    for (const b of blocks) if (b.md) lines.push('', b.md);
  } else for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const sec = matchSection(b.plain, b.level > 0);
    if (sec) {
      const next = blocks[i + 1];
      if (!sec.title && next?.level > 0 && !next.title && next.plain.length < 120 && !matchSection(next.plain, true)) {
        sec.title = next.plain;
        i++;
      }
      if (!b.level) plainHeadings.push(mirrorHeading({ ...sec, title: null }).slice(3));
      sections.push(sec);
      lines.push('', mirrorHeading(sec));
      continue;
    }
    if (!sections.length && (b.title || b.level === 1)) { if (b.plain) titleParts.push(b.plain); continue; }
    if (b.level && b.plain) warnings.push(`Heading not recognised as a chapter, kept as a paragraph: "${b.plain}"`);
    if (b.md) lines.push('', b.md);
  }
  // The title goes first, before any dedication or other front matter (none of which is part of a chapter).
  if (titleParts.length) lines.splice(1, 0, '', `# ${titleParts.join(' ')}`);

  if (entry.kind !== 'post') {
    const numbers = sections.filter((s) => s.kind === 'chapter').map((s) => s.number);
    numbers.forEach((n, i) => { if (n !== i + 1) warnings.push(`Chapter numbering: expected ${i + 1}, found ${n}`); });
    for (const kind of ['prologue', 'epilogue']) if (sections.filter((s) => s.kind === kind).length > 1) warnings.push(`More than one ${kind}`);
    if (plainHeadings.length) warnings.push(`${plainHeadings.length} heading(s) are plain text rather than a heading style (${plainHeadings.slice(0, 6).join(', ')}${plainHeadings.length > 6 ? ', …' : ''}). They still count, but a heading style is more reliable.`);
    if (!sections.length) warnings.push('No chapter headings found. See source/README.md for the formats that are recognised.');
  }

  const out = join(root, entry.text);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, lines.join('\n') + '\n');
  const words = lines.join(' ').split(/\s+/).filter(Boolean).length;
  const extra = ['prologue', 'interlude', 'epilogue'].map((k) => [k, sections.filter((s) => s.kind === k).length]).filter(([, n]) => n).map(([k, n]) => (n > 1 ? `${n} ${k}s` : k));
  const chapters = sections.filter((s) => s.kind === 'chapter').length;
  console.log(`${key}: ${entry.source} -> ${entry.text}  (${entry.kind === 'post' ? 'post' : [`${chapters} chapters`, ...extra].join(', ')}, ~${words} words)`);
  for (const w of warnings) console.log(`  warning: ${w}`);
}

const keys = process.argv.slice(2);
for (const key of keys.length ? keys : Object.keys(config.files).filter((k) => config.files[k].text)) convert(key);
