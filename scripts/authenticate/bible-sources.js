/**
 * Reading the Bible sources for authentication, independently of the
 * converters: eBible.org's USFM (KJV) and the publisher's USX (BSB).
 *
 * Both give units keyed "GEN 1:1" (verse text) and "PSA 3:title" (a Psalm's
 * title), plus the characters left out by category. Every paragraph style
 * and marker in the source must be named in PARAGRAPHS or CHARACTER below;
 * an unknown one stops authentication.
 */

import { Units, xmlTokens } from './units.js';

/** What each paragraph style holds. "text" is verse text; anything else is left out under that name. */
export const PARAGRAPHS = {
  id: 'book identification', ide: 'book identification', usfm: 'book identification',
  h: 'running head', toc1: 'table of contents', toc2: 'table of contents', toc3: 'table of contents',
  mt: 'book title', mt1: 'book title', mt2: 'book title', mt3: 'book title',
  imt1: 'book introduction', ip: 'book introduction', is1: 'book introduction',
  ms: 'section heading', ms1: 'section heading', mr: 'section heading',
  s: 'section heading', s1: 'section heading', s2: 'section heading', s3: 'section heading', sr: 'section heading',
  r: 'cross-reference line', qa: 'acrostic letter', sp: 'speaker', cl: 'chapter label', rem: 'comment',
  p: 'text', m: 'text', nb: 'text', pi: 'text', pmo: 'text', pc: 'text', b: 'text',
  q: 'text', q1: 'text', q2: 'text', q3: 'text', qr: 'text', li: 'text', li1: 'text', li2: 'text',
  d: 'title', // a Psalm's title; elsewhere (Habakkuk 3) part of the verse text
};

/** Character styles: their words stay in the text. */
export const CHARACTER = new Set(['w', 'add', 'nd', 'wj', 'tl', 'qs', 'sc', 'bd', 'it', 'em', 'k', 'pn', 'ord', 'sup', 'ref']);
/** Notes: left out. Markers inside notes (\fr, \ft, \xo…) are part of the note. */
export const NOTES = { f: 'footnotes', fe: 'footnotes', x: 'cross-references' };

/** The kind of a paragraph, given its style and book. */
function paragraphKind(style, book, where) {
  const kind = PARAGRAPHS[style];
  if (!kind) throw new Error(`${where}: unknown paragraph style "${style}"`);
  if (kind === 'title' && book !== 'PSA') return 'text';
  return kind;
}

/** Psalms' book divisions ("Psalms 1–41") are labels, not titles. */
const BOOK_DIVISION = /^\s*Psalms \d+–\d+\s*$/;

/**
 * A paragraph being read: its text goes to the current verse, to the
 * chapter's title, or to a left-out category.
 */
class Reader {
  constructor(book) {
    this.book = book;
    this.units = new Units();
    this.chapter = 0;
    this.verse = null;
    this.kind = null;
    this.title = '';
  }

  get where() { return `${this.book} ${this.chapter}${this.verse === null ? '' : `:${this.verse}`}`; }

  paragraph(style) {
    this.endParagraph();
    this.kind = paragraphKind(style, this.book, this.where);
    if (this.kind === 'text' && this.verse !== null) this.units.break(`${this.book} ${this.chapter}:${this.verse}`);
  }

  endParagraph() {
    if (this.kind === 'title') {
      if (BOOK_DIVISION.test(this.title)) this.units.exclude('Psalms book division label', this.title);
      else if (this.title.trim()) {
        const key = `${this.book} ${this.chapter}:title`;
        if (this.units.units.has(key)) this.units.break(key);
        this.units.add(key, this.title);
      }
    }
    this.title = '';
    this.kind = null;
  }

  chapterStart(n) {
    this.endParagraph();
    this.chapter = n;
    this.verse = null;
  }

  verseStart(n) {
    this.verse = n;
    this.units.open(`${this.book} ${this.chapter}:${n}`);
  }

  text(text, category = null) {
    if (category) return this.units.exclude(category, text);
    if (this.kind === 'title') { this.title += text; return; }
    if (this.kind === null || this.kind !== 'text') {
      if (this.kind === null && !text.trim()) return;
      if (this.kind === null) throw new Error(`${this.where}: text outside any paragraph: "${text.trim().slice(0, 40)}"`);
      return this.units.exclude(this.kind, text);
    }
    if (this.verse === null) {
      if (text.trim()) throw new Error(`${this.where}: verse text before the first verse: "${text.trim().slice(0, 40)}"`);
      return;
    }
    this.units.add(`${this.book} ${this.chapter}:${this.verse}`, text);
  }

  finish() {
    this.endParagraph();
    return this.units;
  }
}

/**
 * Read one USFM book. Markers are read one at a time: paragraph markers
 * (at the start of a line), \c and \v with their numbers, notes, and
 * character markers, whose words stay in the text. In \w word|attributes\w*
 * the part after "|" is markup (Strong's numbers), not text.
 */
export function readUsfmBook(usfm, book) {
  const r = new Reader(book);
  let note = null;
  let depth = 0;
  let inWord = false;
  let inAttributes = false;
  let expect = null; // 'c' or 'v': the next text starts with a number
  const re = /\\(\+?)([a-z]+\d*)(\*?)|([^\\]+)/g;
  let m;
  let lineStart = true;
  while ((m = re.exec(usfm))) {
    if (m[4] !== undefined) {
      let text = m[4];
      lineStart = /\n\s*$/.test(text);
      if (expect) {
        const n = text.match(/^\s*(\d+)[a-z]?(?:-\d+)?\s?/);
        if (!n) throw new Error(`${r.where}: \\${expect} without a number`);
        if (expect === 'c') r.chapterStart(Number(n[1]));
        else r.verseStart(Number(n[1]));
        text = text.slice(n[0].length);
        expect = null;
      }
      if (note) { r.text(text, note); continue; }
      if (inAttributes) { r.text(text, 'word attributes (markup)'); continue; }
      if (inWord && text.includes('|')) {
        const bar = text.indexOf('|');
        r.text(text.slice(0, bar));
        r.text(text.slice(bar + 1), 'word attributes (markup)');
        inAttributes = true;
        continue;
      }
      r.text(text);
      continue;
    }
    const [, , name, closing] = m;
    const atLineStart = lineStart;
    lineStart = false;
    if (NOTES[name]) {
      if (closing) { depth--; if (!depth) note = null; } else { depth++; note = NOTES[name]; }
      continue;
    }
    if (note) continue; // \fr, \ft, \fqa… inside a note
    if (name === 'c' && !closing) { expect = 'c'; continue; }
    if (name === 'v' && !closing) { expect = 'v'; continue; }
    if (CHARACTER.has(name)) {
      if (name === 'w') { inWord = !closing; inAttributes = false; }
      continue;
    }
    if (!closing && atLineStart && PARAGRAPHS[name]) {
      r.paragraph(name);
      continue;
    }
    throw new Error(`${r.where}: unknown USFM marker \\${m[1]}${name}${closing}`);
  }
  return r.finish();
}

/**
 * Read one USX book. Paragraph styles come from <para style>, verses and
 * chapters from their milestones; <note> is left out; <char> and <ref> keep
 * their words. Unknown elements or styles stop authentication.
 */
export function readUsxBook(xml, book) {
  const r = new Reader(book);
  const stack = [];
  for (const t of xmlTokens(xml)) {
    if (t.type === 'text') {
      const inNote = stack.find(e => e.name === 'note');
      if (inNote) r.text(t.text, NOTES[inNote.attrs.style] ?? 'footnotes');
      else if (stack.some(e => e.name === 'book')) r.text(t.text, 'book identification');
      else if (stack.some(e => e.name === 'para')) r.text(t.text);
      else if (t.text.trim()) throw new Error(`${r.where}: text outside any paragraph: "${t.text.trim().slice(0, 40)}"`);
      continue;
    }
    if (t.type === 'close') {
      const top = stack.pop();
      if (top?.name !== t.name) throw new Error(`${r.where}: </${t.name}> closes <${top?.name}>`);
      if (t.name === 'para') r.endParagraph();
      continue;
    }
    switch (t.name) {
      case 'usx': case 'book': case 'note': case 'char': case 'ref':
        if (t.name === 'char' && !stack.some(e => e.name === 'note') && !CHARACTER.has(t.attrs.style)) {
          throw new Error(`${r.where}: unknown character style "${t.attrs.style}"`);
        }
        if (t.type === 'open') stack.push(t);
        break;
      case 'para':
        r.paragraph(t.attrs.style);
        if (t.type === 'open') stack.push(t);
        else r.endParagraph();
        break;
      case 'chapter':
        if (t.attrs.number) r.chapterStart(Number(t.attrs.number));
        break;
      case 'verse':
        if (t.attrs.number) r.verseStart(Number(t.attrs.number));
        break;
      case 'optbreak':
        break;
      default:
        throw new Error(`${r.where}: unknown USX element <${t.name}>`);
    }
  }
  return r.finish();
}
