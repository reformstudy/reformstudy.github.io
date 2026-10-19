/**
 * Authenticating Matthew Henry's Commentary against CCEL's ThML volumes.
 *
 * The source is read with this folder's own tokenizer into a strict tree
 * (every element must close in order). In each book (a <div1> with passage
 * markers), every element of an introduction, a chapter and a commentary
 * block is classified by ELEMENTS below: kept as a unit (a paragraph, title,
 * quotation, attribution or list item) or left out by name. Text anywhere
 * else stops authentication.
 *
 * Checks, per chapter and introduction:
 * - the kept units, in document order, are the output's paragraphs and
 *   titles, each verbatim (compare.js, no exceptions);
 * - each paragraph's references are the source's <scripRef>s, re-derived;
 * - the sections' verse ranges follow from the passage markers by the rules
 *   in rangesFor(), and meta.json lists exactly the chapters and
 *   introductions the source has.
 */

import { CANON } from '../lib/canon.js';
import { compareText } from './compare.js';
import { compactOf, readOsis } from './refs.js';
import { xmlTokens } from './units.js';

/** What each element is, by context. Elements with no text (page breaks, rules, markers) need no entry. */
export const ELEMENTS = {
  introduction: { h2: 'book name', 'div.Center': 'title page', p: 'paragraph', h3: 'title', h4: 'title', h5: 'title' },
  chapter: { h2: 'chapter heading', h3: 'chapter heading', h4: 'title', p: 'paragraph' },
  commentary: {
    h4: 'title', 'p.passage': 'printed passage', 'div.Center': 'printed passage',
    p: 'paragraph', verse: 'poetry', attr: 'attribution', ol: 'list', ul: 'list',
  },
};
const KEPT = new Set(['paragraph', 'title', 'poetry', 'attribution', 'list']);

/** A strict element tree: { name, attrs, children } with text children as strings. */
export function readTree(xml) {
  const root = { name: '#root', attrs: {}, children: [] };
  const stack = [root];
  for (const t of xmlTokens(xml)) {
    const top = stack[stack.length - 1];
    if (t.type === 'text') { top.children.push(t.text); continue; }
    if (t.type === 'close') {
      if (top.name !== t.name) throw new Error(`</${t.name}> closes <${top.name}> (${top.attrs.id ?? 'no id'})`);
      stack.pop();
      continue;
    }
    const el = { name: t.name, attrs: t.attrs, children: [] };
    top.children.push(el);
    if (t.type === 'open') stack.push(el);
  }
  if (stack.length > 1) throw new Error(`<${stack[stack.length - 1].name}> is never closed`);
  return root;
}

const kids = el => el.children.filter(c => typeof c !== 'string');
function textIn(el) {
  return el.children.map(c => (typeof c === 'string' ? c : textIn(c))).join('');
}
function* descendants(el) {
  for (const c of kids(el)) { yield c; yield* descendants(c); }
}
const kindOf = (table, el) => table[`${el.name}.${el.attrs.class}`] ?? table[el.name];
const count = (map, key, text) => {
  const n = String(text).replace(/\s/g, '').length;
  if (n) map.set(key, (map.get(key) ?? 0) + n);
};

/** Text directly inside an element (not in a child) must be whitespace. */
function onlyWhitespace(el, where) {
  for (const c of el.children) {
    if (typeof c === 'string' && c.trim()) throw new Error(`${where}: loose text "${c.trim().slice(0, 40)}"`);
  }
}

/** A kept unit: its kind, text (lines of poetry on separate lines) and references. */
function unit(el, kind) {
  const lines = [...descendants(el)].filter(e => e.name === 'l');
  const text = kind === 'poetry' && lines.length ? lines.map(textIn).join('\n') : textIn(el);
  const refs = [...descendants(el)].filter(e => e.name === 'scripRef' && e.attrs.osisRef)
    .flatMap(r => r.attrs.osisRef.split(/\s+/).map(osis => ({ text: textIn(r), osis })));
  return { kind, text, refs };
}

/** The units of one element as ELEMENTS classifies it; left-out text is counted. */
function classify(el, table, where, excluded) {
  const kind = kindOf(table, el);
  if (kind === 'list') return [...descendants(el)].filter(e => e.name === 'li').map(li => unit(li, 'paragraph'));
  if (KEPT.has(kind)) return [unit(el, kind)];
  const text = textIn(el);
  if (kind) count(excluded, kind, text);
  else if (text.trim()) throw new Error(`${where}: <${el.name}${el.attrs.class ? `.${el.attrs.class}` : ''}> isn't classified: "${text.trim().slice(0, 50)}"`);
  return [];
}

const ROMAN = { I: 1, V: 5, X: 10, L: 50, C: 100 };
export function fromRoman(s) {
  return [...s].reduce((n, ch, i) => n + (ROMAN[ch] < (ROMAN[s[i + 1]] ?? 0) ? -ROMAN[ch] : ROMAN[ch]), 0);
}

/**
 * Read one volume: { chapters: Map("ROM 8" -> { units, blocks }), introductions: Map(book -> units), excluded }.
 * A block is a commentary block: { marker, units }.
 */
export function readVolume(xml) {
  const excluded = new Map();
  const chapters = new Map();
  const introductions = new Map();
  const isMarker = e => e.name === 'scripCom' && e.attrs.type === 'Commentary' && e.attrs.osisRef?.startsWith('Bible:');
  for (const div1 of [...descendants(readTree(xml))].filter(e => e.name === 'div1')) {
    const first = [...descendants(div1)].find(isMarker);
    if (!first) { count(excluded, 'front matter and indexes', textIn(div1)); continue; }
    const book = readOsis(first.attrs.osisRef)?.book;
    if (!book) throw new Error(`${div1.attrs.id}: can't read the book of ${first.attrs.osisRef}`);
    onlyWhitespace(div1, book);
    for (const div2 of kids(div1)) {
      const title = div2.attrs.title ?? '';
      if (div2.name !== 'div2') {
        if (textIn(div2).trim()) throw new Error(`${book}: <${div2.name}> outside the introduction and chapters`);
        continue;
      }
      if (/^introduction$/i.test(title)) {
        onlyWhitespace(div2, `${book} introduction`);
        introductions.set(book, kids(div2).flatMap(el => classify(el, ELEMENTS.introduction, `${book} introduction`, excluded)));
        continue;
      }
      const m = title.match(/^Chapter ([IVXLC]+)$/);
      if (!m) throw new Error(`${book}: a block titled "${title}"`);
      const where = `${book} ${fromRoman(m[1])}`;
      onlyWhitespace(div2, where);
      const units = [];
      const blocks = [];
      let marker = null;
      for (const el of kids(div2)) {
        if (isMarker(el)) { const r = readOsis(el.attrs.osisRef); if (r?.verse !== null && r) marker = r; continue; }
        if (el.name === 'div' && el.attrs.class === 'Commentary') {
          onlyWhitespace(el, `${where} (${el.attrs.id})`);
          const block = { marker: marker ?? (el.attrs.id?.startsWith('Bible:') ? readOsis(el.attrs.id) : null), units: [] };
          if (!block.marker) throw new Error(`${where}: a commentary block without a passage (${el.attrs.id})`);
          marker = null;
          for (const c of kids(el)) block.units.push(...classify(c, ELEMENTS.commentary, `${where} (${el.attrs.id})`, excluded));
          units.push(...block.units);
          blocks.push(block);
          continue;
        }
        const got = classify(el, ELEMENTS.chapter, where, excluded);
        units.push(...got);
        if (got.some(u => u.kind === 'title')) blocks.push({ marker: null, units: got, titleOnly: true });
      }
      chapters.set(where, { units, blocks });
    }
  }
  return { chapters, introductions, excluded };
}

/**
 * The sections' verse ranges, from the passage markers:
 * - a block covers its marker's verses; the chapter is the block's own
 *   ("Chapter N"), and a range running past the chapter's end stops there;
 * - a block with no text of its own (Henry printed two passages and then
 *   commented on both) joins the block after it;
 * - sections are listed in verse order.
 */
export function rangesFor(blocks, lastVerse) {
  const out = [];
  let carry = null;
  for (const b of blocks) {
    if (b.titleOnly) continue;
    const r = b.marker;
    let start = r.verse ?? 1;
    let end = r.endChapter !== r.chapter ? lastVerse : (r.endVerse ?? r.verse ?? lastVerse);
    end = Math.min(end, lastVerse);
    if (carry) { start = Math.min(start, carry.start); end = Math.max(end, carry.end); carry = null; }
    if (!b.units.some(u => u.kind !== 'title')) { carry = { start, end }; continue; }
    out.push({ start, end });
  }
  if (carry) out.push(carry);
  return out.sort((a, b) => a.start - b.start || a.end - b.end);
}

/** The output's units for a chapter file or introduction, in order, with their kind. */
export function outputUnits(file) {
  const out = [];
  const para = p => ({ kind: p.heading ? 'title' : p.poetry ? 'poetry' : p.attribution ? 'attribution' : 'paragraph', text: p.text, refs: p.refs ?? [] });
  for (const p of file.introduction ?? file.paragraphs ?? []) out.push(para(p));
  for (const s of file.sections ?? []) {
    if (s.title !== undefined) out.push({ kind: 'title', text: s.title, refs: null });
    for (const p of s.paragraphs) out.push(para(p));
  }
  return out;
}

/** Compare two unit lists. Titles' references aren't kept (a title is plain text). */
function compareUnits(where, source, output, problems, excluded) {
  if (source.length !== output.length) {
    problems.push(`${where}: ${output.length} paragraphs and titles, the source has ${source.length}`);
  }
  for (let i = 0; i < Math.min(source.length, output.length); i++) {
    const s = source[i];
    const o = output[i];
    const at = `${where}, item ${i + 1}`;
    if (s.kind !== o.kind) { problems.push(`${at}: a ${o.kind} where the source has a ${s.kind}`); continue; }
    const diff = compareText(s.text, o.text);
    if (diff) problems.push(`${at}: ${diff}`);
    if (o.refs === null) continue;
    const expected = [];
    for (const r of s.refs) {
      const ref = readOsis(r.osis);
      if (ref) expected.push({ text: r.text.replace(/\s+/g, ' ').trim(), ref: compactOf(ref) });
      else count(excluded, 'references that name no verse', r.osis);
    }
    if (JSON.stringify(o.refs) !== JSON.stringify(expected)) {
      problems.push(`${at}: references ${o.refs.map(r => r.ref).join(', ') || 'none'}, the source has ${expected.map(r => r.ref).join(', ') || 'none'}`);
    }
  }
}

/**
 * Compare the converted commentary (files: Map of res path -> parsed JSON) with
 * the volumes. Returns { problems, chapters, units, excluded }.
 */
export function authenticateCommentary(files, volumes, verseCount, dir) {
  const problems = [];
  const excluded = new Map();
  const chapters = new Map();
  const introductions = new Map();
  for (const xml of volumes) {
    const v = readVolume(xml);
    for (const [k, c] of v.chapters) chapters.set(k, c);
    for (const [k, u] of v.introductions) introductions.set(k, u);
    for (const [k, n] of v.excluded) excluded.set(k, (excluded.get(k) ?? 0) + n);
  }
  let units = 0;
  const expectedFiles = new Set([`${dir}/meta.json`]);
  for (const [book, list] of introductions) {
    if (!list.length) continue;
    const path = `${dir}/${book}/introduction.json`;
    expectedFiles.add(path);
    if (!files.has(path)) { problems.push(`${path}: missing`); continue; }
    compareUnits(`${book} introduction`, list, outputUnits(files.get(path)), problems, excluded);
    units += list.length;
  }
  for (const [key, ch] of chapters) {
    const [book, n] = key.split(' ');
    const path = `${dir}/${book}/${n}.json`;
    expectedFiles.add(path);
    const file = files.get(path);
    if (!file) { problems.push(`${path}: missing`); continue; }
    if (file.book !== book || file.chapter !== Number(n)) problems.push(`${path}: labelled ${file.book} ${file.chapter}`);
    compareUnits(key, ch.units, outputUnits(file), problems, excluded);
    units += ch.units.length;
    const expected = rangesFor(ch.blocks, verseCount(book, Number(n)));
    const actual = file.sections.map(s => ({ start: s.start, end: s.end }));
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      problems.push(`${key}: sections ${actual.map(s => `${s.start}-${s.end}`).join(', ')}, the markers give ${expected.map(s => `${s.start}-${s.end}`).join(', ')}`);
    }
  }
  for (const path of files.keys()) if (!expectedFiles.has(path)) problems.push(`${path}: not from the source`);

  const meta = files.get(`${dir}/meta.json`);
  const books = CANON.flatMap(b => {
    const present = [...chapters.keys()].filter(k => k.startsWith(`${b.id} `)).map(k => Number(k.split(' ')[1])).sort((x, y) => x - y);
    const intro = Boolean(introductions.get(b.id)?.length);
    return present.length || intro ? [{ id: b.id, name: b.name, chapters: present, hasIntroduction: intro }] : [];
  });
  if (!meta || JSON.stringify(meta.books) !== JSON.stringify(books)) problems.push(`${dir}/meta.json: the book list doesn't match the source`);
  return { problems, chapters: chapters.size, units, excluded };
}
