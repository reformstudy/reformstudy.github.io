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

/** Compare a converted Bible with the source's units. Returns { problems, verses, titles }. */
export function authenticateBible(bible, { units, books }, exceptions) {
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
    for (const v of book.verses) {
      if (v.book !== book.id) problems.push(`${book.id} ${v.chapter}:${v.verse}: filed under ${v.book}`);
      check(`${book.id} ${v.chapter}:${v.verse}`, v.text);
      verses++;
    }
    for (const [chapter, title] of Object.entries(book.subtitles ?? {})) {
      check(`${book.id} ${chapter}:title`, title);
      titles++;
    }
  }
  for (const key of units.units.keys()) if (!seen.has(key)) problems.push(`${key}: in the source but not in the output`);
  return { problems, verses, titles };
}
