/**
 * USFM parsing shared by the Bible ingest scripts (eBible.org's KJV, the BSB).
 */

import { normalizeText } from './io.js';

// Paragraph markers whose whole line is not verse text: identification,
// titles, section headings, cross-reference lines, acrostic letters, blank lines.
export const SKIP = new Set(['id', 'ide', 'usfm', 'h', 'toc1', 'toc2', 'toc3', 'mt', 'mt1', 'mt2', 'mt3', 'ms', 'ms1', 'mr',
  's', 's1', 's2', 's3', 'r', 'sr', 'qa', 'sp', 'cl', 'rem', 'b']);

/** Strip USFM character markup, keeping the words a reader sees. */
export function cleanInline(text) {
  return normalizeText(String(text)
    .replace(/\|[^\\|]*(?=\\\+?[a-z]+\d*\*)/g, '')     // word attributes: \w word|strong="H7225"\w*
    .replace(/¶/g, ' ')                             // pilcrows (paragraph marks printed in the KJV)
    .replace(/\\f\s.*?\\f\*/g, '')                  // footnotes
    .replace(/\\fe\s.*?\\fe\*/g, '')                // endnotes
    .replace(/\\x\s.*?\\x\*/g, '')                  // cross-references
    .replace(/\\\+?ref\s+([^|\\]*?)(\|[^\\]*)?\\\+?ref\*/g, '$1')  // \ref shown|target\ref*
    .replace(/\\\+?[a-z]+\d*\*/g, '')               // closers (\add*): nothing, so "forty-\add*two" stays one word
    .replace(/\\\+?[a-z]+\d*/g, ' ')                // openers (\add, \wj, \nd)
  ).replace(/\s+([,.;:!?’”)])/g, '$1').replace(/([“‘(])\s+/g, '$1');
}

// Private-use characters that carry a tagged word through cleanInline:
// OPEN word NUMBER number CLOSE. They never occur in the sources.
const OPEN = '\uE000';
const NUMBER = '\uE001';
const CLOSE = '\uE002';

/**
 * Wrap each Strong's-tagged word (\w word|strong="H0430"\w*, or \+w inside
 * other markup) in marker characters, so its place in the verse can be found
 * after cleanInline. Leading zeros are dropped ("H0430" is H430, as the
 * lexicons number it).
 */
export function markStrongs(text) {
  return String(text).replace(/\\(\+?)w\s+([^|\\]*?)\s*\|[^\\]*?\bstrong="([GH])0*(\d+)"[^\\]*\\\1w\*/g,
    (_, plus, word, lang, n) => `${OPEN}${word}${NUMBER}${lang}${n}${CLOSE}`);
}

/**
 * Take the markers out of a verse: { text, strongs }, where each entry of
 * strongs is [start, end, number], the tagged word being text.slice(start, end).
 */
export function extractStrongs(marked) {
  let text = '';
  const strongs = [];
  for (let i = 0; i < marked.length; i++) {
    if (marked[i] !== OPEN) { text += marked[i]; continue; }
    const number = marked.indexOf(NUMBER, i);
    const close = marked.indexOf(CLOSE, number);
    const start = text.length;
    text += marked.slice(i + 1, number);
    strongs.push([start, text.length, marked.slice(number + 1, close)]);
    i = close;
  }
  return { text, strongs };
}

/**
 * Parse one USFM book into verses and Psalm titles.
 * Psalm titles sit in \d lines that also open verse 1; their text becomes the
 * chapter's subtitle so verse 1 starts where the KJV's does. In other books
 * (Habakkuk 3, Zechariah 12) \d text is part of the verse, as in the KJV.
 * With `strongs`, each verse also gets the Strong's numbers of its tagged
 * words (see extractStrongs); titles stay plain text.
 */
export function parseUsfmBook(usfm, bookId, { strongs = false } = {}) {
  if (strongs && /[\uE000-\uE002]/.test(usfm)) throw new Error(`${bookId}: the source uses the characters that mark Strong's words`);
  const verses = new Map();
  const subtitles = {};
  let chapter = 0;
  let verse = null;
  let para = null;

  const append = (target, text) => {
    const clean = cleanInline(strongs && target === 'verse' ? markStrongs(text) : text);
    if (!clean) return;
    if (target === 'title') {
      subtitles[chapter] = subtitles[chapter] ? `${subtitles[chapter]} ${clean}` : clean;
      return;
    }
    if (verse === null) throw new Error(`${bookId} ${chapter}: text before the first verse: "${clean.slice(0, 60)}"`);
    const v = verses.get(`${chapter}:${verse}`);
    v.text = v.text ? `${v.text} ${clean}` : clean;
  };

  for (const rawLine of usfm.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    let rest = line;
    const m = line.match(/^\\([a-z]+\d*)\s?(.*)$/);
    if (m) {
      if (m[1] === 'c') {
        chapter = parseInt(m[2], 10);
        verse = null;
        para = null;
        continue;
      }
      if (m[1] !== 'v') {
        para = m[1];
        rest = m[2];
      }
    }
    if (para && SKIP.has(para)) continue;

    const titleLine = para === 'd' && bookId === 'PSA';
    // The book divisions in Psalms ("Psalms 1–41") are labels, not titles.
    if (titleLine && /^Psalms \d+–\d+$/.test(cleanInline(rest))) continue;

    const pieces = rest.split(/\\v\s+(\d+)\s*/);
    append(titleLine ? 'title' : 'verse', pieces[0]);
    for (let i = 1; i < pieces.length; i += 2) {
      verse = parseInt(pieces[i], 10);
      const key = `${chapter}:${verse}`;
      if (verses.has(key)) throw new Error(`${bookId} ${key} appears twice`);
      verses.set(key, { book: bookId, chapter, verse, text: '' });
      append(titleLine ? 'title' : 'verse', pieces[i + 1]);
    }
  }

  const list = [...verses.values()].sort((a, b) => a.chapter - b.chapter || a.verse - b.verse);
  if (strongs) {
    for (const v of list) {
      const { text, strongs: tags } = extractStrongs(v.text);
      v.text = text;
      if (tags.length) v.strongs = tags;
    }
  }
  return { verses: list, subtitles };
}

