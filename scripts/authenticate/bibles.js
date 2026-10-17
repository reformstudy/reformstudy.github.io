/**
 * Authenticating a Bible: res/bibles/{id}/{id}.json against the units read
 * from the source by bible-sources.js. Every verse and Psalm title must be
 * the source's text (compare.js), every source verse must be in the output
 * and no other, and the books must be the 66 the source identifies.
 */

import { CANON } from '../lib/canon.js';
import { readZip } from '../lib/zip.js';
import { compareText } from './compare.js';
import { readUsfmBook, readUsxBook } from './bible-sources.js';
import { Units } from './units.js';

const CANON_IDS = new Set(CANON.map(b => b.id));

/**
 * Read every book of a zipped USFM or USX release. Files whose book isn't one
 * of the 66 (front matter, the Apocrypha) and files that aren't books are
 * left out by name.
 */
export function readBibleZip(zip, format) {
  const all = new Units();
  const books = new Set();
  for (const [name, data] of readZip(zip)) {
    const text = data.toString('utf8').replace(/^﻿/, '');
    const id = format === 'usfm'
      ? (name.endsWith('.usfm') ? text.match(/^\\id\s+(\w+)/m)?.[1] : undefined)
      : (name.endsWith('.usx') ? text.match(/<book\b[^>]*\bcode="(\w+)"/)?.[1] : undefined);
    if (!id || !CANON_IDS.has(id)) {
      all.exclude(id ? 'books outside the 66 (front matter, Apocrypha)' : 'files that are not books', text);
      continue;
    }
    if (books.has(id)) throw new Error(`${id} appears in two files`);
    books.add(id);
    all.merge(format === 'usfm' ? readUsfmBook(text, id) : readUsxBook(text, id));
  }
  return { units: all, books };
}

/**
 * Read the publisher's plain text ("Genesis 1:1<tab>In the beginning…"):
 * units keyed "GEN 1:1", empty for verses the publisher leaves out. Lines that
 * aren't verses (the attribution, the column headings) are left out by name.
 */
export function readPlainTextBible(txt) {
  const names = new Map([...CANON.map(b => [b.name, b.id]), ['Psalm', 'PSA']]);
  const units = new Units();
  const books = new Set();
  for (const line of txt.replace(/^\uFEFF/, '').split('\n')) {
    const tab = line.indexOf('\t');
    const ref = tab < 0 ? null : line.slice(0, tab).match(/^(.*\S) (\d+):(\d+)$/);
    const book = ref && names.get(ref[1]);
    if (!book) {
      if (ref) throw new Error(`Unknown book "${ref[1]}"`);
      units.exclude('attribution and column headings', line);
      continue;
    }
    books.add(book);
    const key = `${book} ${Number(ref[2])}:${Number(ref[3])}`;
    units.open(key);
    units.add(key, line.slice(tab + 1));
  }
  return { units, books };
}

/**
 * Compare a converted Bible with the source's units. Returns { problems, verses, titles, empty }.
 * With `titlesInVerseOne`, the source gives a Psalm's title as the start of its
 * verse 1 (the plain text), so the output's title and verse 1 together must be
 * that verse. A verse the source leaves empty may be absent from the output.
 */
export function authenticateBible(bible, { units, books }, exceptions, { titlesInVerseOne = false } = {}) {
  const problems = [];
  const seen = new Set();
  let verses = 0;
  let titles = 0;
  const check = (key, text) => {
    seen.add(key);
    if (!units.units.has(key)) return problems.push(`${key}: not in the source`);
    const diff = compareText(units.units.get(key), text, exceptions);
    if (diff) problems.push(`${key}: ${diff}`);
  };
  const outputBooks = new Set(bible.books.map(b => b.id));
  for (const id of books) if (!outputBooks.has(id)) problems.push(`${id}: in the source but not in the output`);
  for (const book of bible.books) {
    if (!books.has(book.id)) problems.push(`${book.id}: not in the source`);
    const subtitles = book.subtitles ?? {};
    for (const v of book.verses) {
      if (v.book !== book.id) problems.push(`${book.id} ${v.chapter}:${v.verse}: filed under ${v.book}`);
      const title = titlesInVerseOne && v.verse === 1 ? subtitles[v.chapter] : undefined;
      check(`${book.id} ${v.chapter}:${v.verse}`, title === undefined ? v.text : `${title}\n${v.text}`);
      verses++;
    }
    for (const [chapter, title] of Object.entries(subtitles)) {
      if (!titlesInVerseOne) check(`${book.id} ${chapter}:title`, title);
      else if (!book.verses.some(v => v.chapter === Number(chapter) && v.verse === 1)) problems.push(`${book.id} ${chapter}: a title without verse 1`);
      titles++;
    }
  }
  let empty = 0;
  for (const [key, text] of units.units) {
    if (seen.has(key)) continue;
    if (text.trim()) problems.push(`${key}: in the source but not in the output`);
    else empty++;
  }
  return { problems, verses, titles, empty };
}

/**
 * Each Psalm title must be the one the USX marks (the same characters, not
 * counting spaces), and every title the USX marks must be there.
 */
export function authenticatePsalmTitles(bible, usxUnits) {
  const problems = [];
  const psa = bible.books.find(b => b.id === 'PSA');
  const marked = new Map([...usxUnits.units].filter(([k]) => /^PSA \d+:title$/.test(k)).map(([k, t]) => [Number(k.split(' ')[1].split(':')[0]), t]));
  const ns = t => t.replace(/\s/g, '');
  for (const [chapter, title] of Object.entries(psa?.subtitles ?? {})) {
    if (!marked.has(Number(chapter))) problems.push(`PSA ${chapter}: a title the USX doesn't mark`);
    else if (ns(marked.get(Number(chapter))) !== ns(title)) problems.push(`PSA ${chapter}: the title isn't the one the USX marks`);
  }
  for (const chapter of marked.keys()) if (!psa?.subtitles?.[chapter]) problems.push(`PSA ${chapter}: the USX marks a title the output lacks`);
  return problems;
}
