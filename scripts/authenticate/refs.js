/**
 * Scripture references, re-derived for authentication without the
 * converters' parser (scripts/lib/refs.js): OSIS as sources write it
 * ("Ps.19.1-Ps.19.3", "Rom.8.1-4", "Gen.1.1-2.3", "Ps.19") to the app's
 * compact form ("PSA.19.1-3") and to the readable form ("Psalm 19:1–3").
 */

import { CANON } from '../lib/canon.js';

const BY_OSIS = new Map(CANON.map(b => [b.osis, b]));
const OSIS = /^([1-3]?[A-Za-z]+)\.(\d+)(?:\.(\d+))?(?:-(?:([1-3]?[A-Za-z]+)\.)?(\d+)(?:\.(\d+))?)?$/;

/** { book, chapter, verse, endChapter, endVerse } or null; verse is null for whole chapters. */
export function readOsis(osis) {
  const m = String(osis).trim().replace(/^Bible:/, '').match(OSIS);
  if (!m) return null;
  const [, bookCode, ch, v, endBook, e1, e2] = m;
  const book = BY_OSIS.get(bookCode);
  if (!book || (endBook && endBook !== bookCode)) return null;
  const chapter = Number(ch);
  const verse = v === undefined ? null : Number(v);
  let endChapter = chapter;
  let endVerse = verse;
  if (e1 !== undefined) {
    if (endBook || e2 !== undefined) { endChapter = Number(e1); endVerse = e2 === undefined ? null : Number(e2); }
    else if (verse !== null) endVerse = Number(e1);
    else endChapter = Number(e1);
  }
  if (chapter < 1 || (verse !== null && verse < 1)) return null;
  return { book: book.id, chapter, verse, endChapter, endVerse };
}

export function compactOf(r) {
  const start = `${r.book}.${r.chapter}${r.verse === null ? '' : `.${r.verse}`}`;
  if (r.endChapter !== r.chapter) return `${start}-${r.endChapter}${r.endVerse === null ? '' : `.${r.endVerse}`}`;
  if (r.endVerse !== null && r.endVerse !== r.verse) return `${start}-${r.endVerse}`;
  return start;
}

export function displayOf(r) {
  const name = r.book === 'PSA' ? 'Psalm' : CANON.find(b => b.id === r.book).name;
  const start = `${name} ${r.chapter}${r.verse === null ? '' : `:${r.verse}`}`;
  if (r.endChapter !== r.chapter) return `${start}–${r.endChapter}${r.endVerse === null ? '' : `:${r.endVerse}`}`;
  if (r.endVerse !== null && r.endVerse !== r.verse) return `${start}–${r.endVerse}`;
  return start;
}
