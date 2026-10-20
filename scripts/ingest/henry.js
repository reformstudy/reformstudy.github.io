/**
 * Convert Matthew Henry's Commentary on the Whole Bible, from the Christian
 * Classics Ethereal Library (CCEL, Calvin University), into one file per
 * chapter under res/commentaries/henry/.
 *
 *   res/commentaries/henry/meta.json                commentary details + chapters present
 *   res/commentaries/henry/{BOOK}/introduction.json Henry's introduction to the book
 *   res/commentaries/henry/{BOOK}/{chapter}.json    chapter introduction + passage sections
 *
 * Source: CCEL's six ThML volumes (https://ccel.org/ccel/henry, files
 * ccel.org/ccel/h/henry/mhc1.xml … mhc6.xml), marked "Public domain. May be
 * copied and distributed freely." The committed copies are in sources/henry/.
 *
 * Henry comments on passages: in each chapter a <scripCom type="Commentary"
 * osisRef="Bible:Gen.2.1-Gen.2.3"/> marker is followed by a
 * <div class="Commentary">. Every element in a chapter or introduction is
 * either kept or left out by name (CONTENT below); anything else stops the
 * conversion, so nothing is dropped unnoticed.
 *
 * Usage:
 *   node scripts/ingest/henry.js              # convert the committed copies in sources/henry/
 *   node scripts/ingest/henry.js --download   # fetch them again from CCEL first
 */

import { CANON } from '../lib/canon.js';
import { compactRef, parseOsisRef } from '../lib/refs.js';
import { jsonText } from '../lib/io.js';
import { runAsScript } from '../lib/pipeline.js';
import { elements, findAll, parseXml, textOf } from '../lib/xml.js';

export const OUT_DIR = 'res/commentaries/henry';
export const KJV = 'res/bibles/kjv/kjv.json';
export const SOURCE_PAGE = 'https://ccel.org/ccel/henry';
export const VOLUMES = [1, 2, 3, 4, 5, 6].map(n => `mhc${n}.xml`);

/**
 * What each element of a chapter, a commentary block or a book introduction
 * becomes. Elements without text (page breaks, rules, markers) need no entry.
 *   chapter heading   the running head ("G E N E S I S", "CHAP. I."): the app shows its own
 *   printed passage   the KJV text CCEL prints before each comment, with Psalm titles
 *                     (class "passage", and centred blocks): the reader shows the Bible itself
 *   title page        the reproduced title page of a book introduction
 */
export const CONTENT = {
  chapter: {
    h2: 'chapter heading', h3: 'chapter heading',
    h4: 'title', // before a passage block: that block's title
    p: 'paragraph',
  },
  commentary: {
    h4: 'title',
    'p.passage': 'printed passage', 'div.Center': 'printed passage',
    p: 'paragraph', verse: 'poetry', attr: 'attribution', ol: 'list', ul: 'list',
  },
  introduction: {
    h2: 'book name', 'div.Center': 'title page',
    p: 'paragraph', h3: 'heading', h4: 'heading', h5: 'heading',
  },
};

const isCommentaryMarker = el => el.name === 'scripCom' && el.attrs.type === 'Commentary' && el.attrs.osisRef?.startsWith('Bible:');
const isCommentaryDiv = el => el.name === 'div' && el.attrs.class === 'Commentary';

/** The CONTENT entry for an element: "p.passage" before "p". */
export function contentKind(table, el) {
  return table[`${el.name}.${el.attrs.class}`] ?? table[el.name];
}

/** Scripture references in a paragraph: [{ text, ref }] in the app's compact form. */
function refsOf(el) {
  const out = [];
  for (const r of findAll(el, e => e.name === 'scripRef' && e.attrs.osisRef)) {
    const text = textOf(r);
    for (const osis of r.attrs.osisRef.split(/\s+/)) {
      const parsed = parseOsisRef(osis.replace(/^Bible:/, ''));
      if (parsed) out.push({ text, ref: compactRef(parsed) });
    }
  }
  return out;
}

/** One paragraph: its text (lines of poetry kept on separate lines), its kind, and its references. */
export function paragraph(el, kind = 'paragraph') {
  const lines = kind === 'poetry' && findAll(el, e => e.name === 'l').length
    ? findAll(el, e => e.name === 'l').map(textOf).filter(Boolean)
    : [textOf(el)];
  const text = lines.join('\n');
  if (!text) return null;
  const p = { text };
  if (kind !== 'paragraph') p[kind] = true;
  const refs = refsOf(el);
  if (refs.length) p.refs = refs;
  return p;
}

/** Paragraphs from an element that CONTENT says to keep (a list gives one paragraph per item). */
function keep(el, kind) {
  if (kind === 'list') return findAll(el, e => e.name === 'li').map(li => paragraph(li)).filter(Boolean);
  const p = paragraph(el, kind);
  return p ? [p] : [];
}

const KEPT = new Set(['paragraph', 'poetry', 'attribution', 'list', 'heading']);

/** Stop on an element with text that CONTENT doesn't name. */
function unexpected(el, where) {
  if (!textOf(el)) return;
  throw new Error(`${where}: unexpected <${el.name}${el.attrs.class ? ` class="${el.attrs.class}"` : ''}> with text "${textOf(el).slice(0, 60)}"`);
}

/** A book introduction: its paragraphs and headings. */
export function convertIntroduction(div, where) {
  const out = [];
  for (const el of elements(div)) {
    const kind = contentKind(CONTENT.introduction, el);
    if (KEPT.has(kind)) out.push(...keep(el, kind));
    else if (!kind) unexpected(el, where);
  }
  return out;
}

const ROMAN = { I: 1, V: 5, X: 10, L: 50, C: 100 };
export function romanToNumber(roman) {
  let n = 0;
  for (let i = 0; i < roman.length; i++) {
    const v = ROMAN[roman[i]], next = ROMAN[roman[i + 1]] ?? 0;
    n += v < next ? -v : v;
  }
  return n;
}

/**
 * Convert one chapter block (a <div2 title="Chapter N">) into
 * { introduction, sections, notes }. The chapter comes from the block's title;
 * the passage markers give the verses. A few markers in CCEL's files name the
 * wrong chapter or run past its end: the block's chapter is kept, the range is
 * cut at the chapter's last verse, and each case is listed in `notes`.
 */
export function convertChapterDiv(div, book, chapter, lastVerse) {
  const where = `${book} ${chapter}`;
  const introduction = [];
  const sections = [];
  const notes = [];
  let pending = null;
  let pendingTitle = null;

  const range = (r, block) => {
    if (r.book !== book || r.chapter !== chapter) notes.push(`${where}: passage ${block} is marked ${r.book} ${r.chapter}`);
    const start = r.verse ?? 1;
    let end = r.endChapter !== r.chapter ? lastVerse : (r.endVerse ?? r.verse ?? lastVerse);
    if (end > lastVerse) {
      notes.push(`${where}: passage ${block} ${start}-${end} cut at verse ${lastVerse}`);
      end = lastVerse;
    }
    return { start, end };
  };

  const commentary = (c, r) => {
    const section = range(r, c.attrs.id);
    const paragraphs = [];
    const children = pendingTitle ? [pendingTitle, ...elements(c)] : elements(c);
    pendingTitle = null;
    // A title after the last of the block's own text introduces the next block.
    const lastText = children.findLastIndex(el => KEPT.has(contentKind(CONTENT.commentary, el)));
    const trailing = children.findIndex((el, i) => i > lastText && lastText >= 0 && contentKind(CONTENT.commentary, el) === 'title');
    if (trailing >= 0) {
      if (children.slice(trailing + 1).some(el => contentKind(CONTENT.commentary, el) === 'title')) {
        throw new Error(`${where} (${c.attrs.id}): two titles after the block's text`);
      }
      pendingTitle = children[trailing];
    }
    for (const [i, el] of children.entries()) {
      if (i === trailing) continue;
      const kind = contentKind(CONTENT.commentary, el);
      if (kind === 'title' && section.title === undefined && !paragraphs.length) section.title = textOf(el) || undefined;
      else if (kind === 'title') paragraphs.push(...keep(el, 'heading'));
      else if (KEPT.has(kind)) paragraphs.push(...keep(el, kind));
      else if (!kind) unexpected(el, `${where} (${c.attrs.id})`);
    }
    if (section.title === undefined) delete section.title;
    section.paragraphs = paragraphs;
    // Henry sometimes prints two passages and then comments on both; CCEL
    // files the comment under the second, so a passage-only block joins the next.
    const prev = sections.at(-1);
    if (prev && !prev.paragraphs.length) {
      section.start = Math.min(prev.start, section.start);
      section.end = Math.max(prev.end, section.end);
      if (prev.title && !section.title) section.title = prev.title;
      sections.pop();
    }
    sections.push(section);
  };

  for (const el of elements(div)) {
    if (isCommentaryMarker(el)) {
      const r = parseOsisRef(el.attrs.osisRef.replace(/^Bible:/, ''));
      if (r && r.verse !== null) pending = r;
      continue;
    }
    if (isCommentaryDiv(el)) {
      const r = pending ?? (el.attrs.id?.startsWith('Bible:') ? parseOsisRef(el.attrs.id.slice(6)) : null);
      pending = null;
      if (!r) throw new Error(`${where}: commentary block without a passage reference (${el.attrs.id})`);
      commentary(el, r);
      continue;
    }
    const kind = contentKind(CONTENT.chapter, el);
    if (kind === 'title') {
      if (pendingTitle) throw new Error(`${where}: two titles before a passage block`);
      pendingTitle = el;
    } else if (kind === 'paragraph') {
      if (sections.length) throw new Error(`${where}: a paragraph after the commentary began, outside any passage block`);
      introduction.push(...keep(el, kind));
    } else if (!kind) unexpected(el, where);
  }
  if (pendingTitle) throw new Error(`${where}: a title with no passage block after it`);
  sections.sort((a, b) => a.start - b.start || a.end - b.end);
  return { introduction, sections, notes };
}

/**
 * Convert one ThML volume. Each book is a <div1> holding an "Introduction"
 * <div2> and one "Chapter N" <div2> per chapter; the book comes from the
 * first passage marker in it. Returns { chapters, introductions, notes }.
 */
export function convertVolume(xml, verseCount) {
  const root = parseXml(xml);
  const chapters = [];
  const introductions = new Map();
  const notes = [];
  for (const div1 of findAll(root, e => e.name === 'div1')) {
    const marker = findAll(div1, isCommentaryMarker)[0];
    const book = marker && parseOsisRef(marker.attrs.osisRef.replace(/^Bible:/, ''))?.book;
    if (!book) continue; // title page, preface, indexes
    for (const d of elements(div1).filter(e => e.name === 'div2')) {
      const title = d.attrs.title ?? '';
      const m = title.match(/^Chapter ([IVXLC]+)$/);
      if (m) {
        const chapter = romanToNumber(m[1]);
        const ch = convertChapterDiv(d, book, chapter, verseCount(book, chapter));
        notes.push(...ch.notes);
        const file = { book, chapter };
        if (ch.introduction.length) file.introduction = ch.introduction;
        file.sections = ch.sections;
        chapters.push(file);
      } else if (/^introduction$/i.test(title)) {
        introductions.set(book, convertIntroduction(d, `${book} introduction`));
      }
    }
  }
  return { chapters, introductions, notes };
}

/** Chapter lengths from an app-format Bible. */
export function verseCounter(bible) {
  const counts = new Map();
  for (const b of bible.books) {
    for (const v of b.verses) counts.set(`${b.id} ${v.chapter}`, Math.max(counts.get(`${b.id} ${v.chapter}`) ?? 0, v.verse));
  }
  return (book, chapter) => counts.get(`${book} ${chapter}`) ?? 0;
}

/** Every output file: meta.json, then each book's introduction and chapters. */
export function henryOutputs(volumes, verseCount) {
  const files = new Map();
  const introductions = new Map();
  const notes = [];
  for (const xml of volumes) {
    const vol = convertVolume(xml, verseCount);
    for (const ch of vol.chapters) files.set(`${ch.book} ${ch.chapter}`, ch);
    for (const [b, p] of vol.introductions) introductions.set(b, p);
    notes.push(...vol.notes);
  }
  const outputs = new Map();
  const books = [];
  for (const canon of CANON) {
    const intro = introductions.get(canon.id);
    if (intro?.length) outputs.set(`${OUT_DIR}/${canon.id}/introduction.json`, jsonText({ book: canon.id, paragraphs: intro }));
    const present = [];
    for (let n = 1; n <= canon.chapters; n++) {
      const f = files.get(`${canon.id} ${n}`);
      if (!f) continue;
      outputs.set(`${OUT_DIR}/${canon.id}/${n}.json`, jsonText(f));
      present.push(n);
    }
    if (present.length || intro?.length) books.push({ id: canon.id, name: canon.name, chapters: present, hasIntroduction: Boolean(intro?.length) });
  }
  outputs.set(`${OUT_DIR}/meta.json`, jsonText({
    commentary: {
      id: 'henry',
      name: "Matthew Henry's Commentary on the Whole Bible",
      author: 'Matthew Henry',
      published: 1710,
      description: 'Exposition of the whole Bible by the English Presbyterian minister Matthew Henry, published 1708–1710 and completed by his colleagues after his death. Henry comments passage by passage.',
      source: { name: 'Christian Classics Ethereal Library (CCEL), Calvin University', url: SOURCE_PAGE, license: 'Public domain' },
    },
    books,
  }));
  return { outputs, notes, summary: `${books.length} books, ${files.size} chapters` };
}

export const pipeline = {
  id: 'henry',
  sources: ['henry'],
  owns: [OUT_DIR],
  /** ctx.readJson reads the KJV, for chapter lengths. */
  generate(files, ctx) {
    const volumes = VOLUMES.map(f => files.get('henry').get(f).toString('utf8'));
    return henryOutputs(volumes, verseCounter(ctx.readJson(KJV)));
  },
};

runAsScript(import.meta, pipeline);
