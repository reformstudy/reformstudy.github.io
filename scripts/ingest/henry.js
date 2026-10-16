/**
 * Download Matthew Henry's Commentary on the Whole Bible from the Christian
 * Classics Ethereal Library (CCEL, Calvin University) and write one file per
 * chapter under res/commentaries/henry/.
 *
 *   res/commentaries/henry/meta.json                commentary details + chapters present
 *   res/commentaries/henry/{BOOK}/introduction.json Henry's introduction to the book
 *   res/commentaries/henry/{BOOK}/{chapter}.json    chapter introduction + passage sections
 *
 * Source: CCEL's six ThML volumes (https://ccel.org/ccel/henry, files
 * ccel.org/ccel/h/henry/mhc1.xml … mhc6.xml), marked "Public domain. May be
 * copied and distributed freely." CCEL replaces files in place, so the set is
 * pinned by its SHA-256 in provenance/registry.json.
 *
 * Henry comments on passages: in each chapter a <scripCom type="Commentary"
 * osisRef="Bible:Gen.2.1-Gen.2.3"/> marker is followed by a
 * <div class="Commentary"> with a heading, the KJV passage (class "passage",
 * left out here: the reader shows the Bible text itself) and Henry's
 * paragraphs. Scripture references in the paragraphs are kept for linking.
 *
 * Usage:
 *   node scripts/ingest/henry.js                    # download from CCEL
 *   node scripts/ingest/henry.js --source-dir DIR   # a folder with mhc1.xml … mhc6.xml
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CANON } from '../lib/canon.js';
import { compactRef, parseOsisRef } from '../lib/refs.js';
import { fetchBuffer, parseArgs, writeJson } from '../lib/io.js';
import { checkLock, digestFiles } from '../lib/lock.js';
import { elements, findAll, parseXml, textOf } from '../lib/xml.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../../res/commentaries/henry');
const KJV = path.join(__dirname, '../../res/bibles/kjv/kjv.json');
export const SOURCE_PAGE = 'https://ccel.org/ccel/henry';
export const VOLUMES = [1, 2, 3, 4, 5, 6].map(n => ({ file: `mhc${n}.xml`, url: `https://ccel.org/ccel/h/henry/mhc${n}.xml` }));

const isCommentaryMarker = el => el.name === 'scripCom' && el.attrs.type === 'Commentary' && el.attrs.osisRef?.startsWith('Bible:');
const isCommentaryDiv = el => el.name === 'div' && el.attrs.class === 'Commentary';

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

function paragraph(el, heading = false) {
  const text = textOf(el);
  if (!text) return null;
  const p = { text };
  if (heading) p.heading = true;
  const refs = refsOf(el);
  if (refs.length) p.refs = refs;
  return p;
}

/**
 * Paragraphs of a book introduction, headings marked. The book's name (h2) and
 * the reproduced title page (a centred block) are left out.
 */
function paragraphsOf(el) {
  const out = [];
  const walk = e => {
    for (const c of elements(e)) {
      if (c.name === 'p') out.push(paragraph(c));
      else if (c.name === 'h2' || (c.name === 'div' && c.attrs.class === 'Center')) continue;
      else if (/^h[1-6]$/.test(c.name)) out.push(paragraph(c, true));
      else if (c.name !== 'scripCom' && c.name !== 'pb') walk(c);
    }
  };
  walk(el);
  return out.filter(Boolean);
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
  const introduction = [];
  const sections = [];
  const notes = [];
  let pending = null;

  const range = (r, where) => {
    if (r.book !== book || r.chapter !== chapter) notes.push(`${book} ${chapter}: ${where} is marked ${r.book} ${r.chapter}`);
    const start = r.verse ?? 1;
    let end = r.endChapter !== r.chapter ? lastVerse : (r.endVerse ?? r.verse ?? lastVerse);
    if (end > lastVerse) {
      notes.push(`${book} ${chapter}: ${where} ${start}-${end} cut at verse ${lastVerse}`);
      end = lastVerse;
    }
    return { start, end };
  };

  const visit = el => {
    for (const c of elements(el)) {
      if (isCommentaryMarker(c)) {
        const r = parseOsisRef(c.attrs.osisRef.replace(/^Bible:/, ''));
        if (r && r.verse !== null) pending = r;
        continue;
      }
      if (isCommentaryDiv(c)) {
        const r = pending ?? (c.attrs.id?.startsWith('Bible:') ? parseOsisRef(c.attrs.id.slice(6)) : null);
        pending = null;
        if (!r) throw new Error(`${book} ${chapter}: commentary block without a passage reference (${c.attrs.id})`);
        const section = range(r, `passage ${c.attrs.id}`);
        const title = findAll(c, e => e.name === 'h4')[0];
        if (title && textOf(title)) section.title = textOf(title);
        section.paragraphs = findAll(c, e => e.name === 'p' && e.attrs.class !== 'passage').map(p => paragraph(p)).filter(Boolean);
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
        continue;
      }
      if (c.name === 'p' && !sections.length && c.attrs.class !== 'passage') {
        const p = paragraph(c);
        if (p) introduction.push(p);
        continue;
      }
      if (c.name === 'div') visit(c);
    }
  };
  visit(div);
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
        introductions.set(book, paragraphsOf(d));
      }
    }
  }
  return { chapters, introductions, notes };
}

function kjvVerseCount() {
  const counts = new Map();
  for (const b of JSON.parse(fs.readFileSync(KJV, 'utf8')).books) {
    for (const v of b.verses) counts.set(`${b.id} ${v.chapter}`, Math.max(counts.get(`${b.id} ${v.chapter}`) ?? 0, v.verse));
  }
  return (book, chapter) => counts.get(`${book} ${chapter}`) ?? 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const raw = new Map();
  for (const v of VOLUMES) {
    raw.set(v.file, args['source-dir'] ? fs.readFileSync(path.join(args['source-dir'], v.file)) : await fetchBuffer(v.url));
  }
  checkLock('henry', digestFiles(raw));

  const verseCount = kjvVerseCount();
  const files = new Map();
  const introductions = new Map();
  for (const [file, data] of raw) {
    const vol = convertVolume(data.toString('utf8'), verseCount);
    for (const ch of vol.chapters) files.set(`${ch.book} ${ch.chapter}`, ch);
    for (const [b, p] of vol.introductions) introductions.set(b, p);
    console.log(`  ${file}: ${vol.chapters.length} chapters`);
    for (const n of vol.notes) console.log(`    note: ${n}`);
  }

  for (const b of CANON) fs.rmSync(path.join(OUT_DIR, b.id), { recursive: true, force: true });
  const books = [];
  for (const canon of CANON) {
    const intro = introductions.get(canon.id);
    if (intro?.length) writeJson(path.join(OUT_DIR, canon.id, 'introduction.json'), { book: canon.id, paragraphs: intro });
    const present = [];
    for (let n = 1; n <= canon.chapters; n++) {
      const f = files.get(`${canon.id} ${n}`);
      if (!f) continue;
      writeJson(path.join(OUT_DIR, canon.id, `${n}.json`), f);
      present.push(n);
    }
    if (present.length || intro?.length) books.push({ id: canon.id, name: canon.name, chapters: present, hasIntroduction: Boolean(intro?.length) });
  }
  writeJson(path.join(OUT_DIR, 'meta.json'), {
    commentary: {
      id: 'henry',
      name: "Matthew Henry's Commentary on the Whole Bible",
      author: 'Matthew Henry',
      published: 1710,
      description: 'Exposition of the whole Bible by the English Presbyterian minister Matthew Henry, published 1708–1710 and completed by his colleagues after his death. Henry comments passage by passage.',
      source: { name: 'Christian Classics Ethereal Library (CCEL), Calvin University', url: SOURCE_PAGE, license: 'Public domain' },
    },
    books,
  });
  const missing = CANON.filter(c => !books.some(b => b.id === c.id)).map(c => c.id);
  console.log(`Wrote ${OUT_DIR}: ${books.length} books, ${files.size} chapters${missing.length ? `; no commentary for ${missing.join(', ')}` : ''}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
