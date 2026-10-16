/**
 * USX parsing (the XML form of USFM), for the BSB. The rules match
 * parseUsfmBook in usfm.js: the same paragraph styles are skipped, Psalm titles
 * (style "d") become chapter subtitles, and footnotes are dropped.
 */

import { cleanInline, SKIP } from './usfm.js';
import { elements, findAll, parseXml, textOf } from './xml.js';

/** Parse one USX book into verses and Psalm titles: { verses, subtitles }. */
export function parseUsxBook(xml, bookId) {
  const usx = findAll(parseXml(xml), e => e.name === 'usx')[0];
  if (!usx) throw new Error(`${bookId}: not a USX file`);
  const verses = new Map();
  const subtitles = {};
  let chapter = 0;
  let verse = null;

  // Text is gathered per paragraph and cleaned when the paragraph or verse ends,
  // so inline markup (<char style="wj">) joins its neighbours without extra spaces.
  let target = null;
  let buffer = '';
  const flush = () => {
    const clean = cleanInline(buffer);
    buffer = '';
    if (!clean) return;
    if (target === 'title') {
      subtitles[chapter] = subtitles[chapter] ? `${subtitles[chapter]} ${clean}` : clean;
      return;
    }
    if (verse === null) throw new Error(`${bookId} ${chapter}: text before the first verse: "${clean.slice(0, 60)}"`);
    const v = verses.get(`${chapter}:${verse}`);
    v.text = v.text ? `${v.text} ${clean}` : clean;
  };

  const inline = el => {
    for (const c of el.children) {
      if (typeof c === 'string') { buffer += c; continue; }
      if (c.name === 'verse' && c.attrs.number) {
        flush();
        verse = parseInt(c.attrs.number, 10);
        const key = `${chapter}:${verse}`;
        if (verses.has(key)) throw new Error(`${bookId} ${key} appears twice`);
        verses.set(key, { book: bookId, chapter, verse, text: '' });
      } else if (c.name === 'note') {
        buffer += ' '; // footnotes and cross-references
      } else if (c.name !== 'verse') {
        inline(c); // <char>, <ref>: keep the words
      }
    }
  };

  for (const el of elements(usx)) {
    if (el.name === 'chapter' && el.attrs.number) {
      chapter = parseInt(el.attrs.number, 10);
      verse = null;
      continue;
    }
    if (el.name !== 'para' || SKIP.has(el.attrs.style)) continue;
    const titleLine = el.attrs.style === 'd' && bookId === 'PSA';
    // The book divisions in Psalms ("Psalms 1–41") are labels, not titles.
    if (titleLine && /^Psalms \d+–\d+$/.test(textOf(el))) continue;
    target = titleLine ? 'title' : 'verse';
    inline(el);
    flush();
  }

  const list = [...verses.values()].sort((a, b) => a.chapter - b.chapter || a.verse - b.verse);
  return { verses: list, subtitles };
}
