/**
 * Scripture references.
 *
 * Two forms are used:
 * - OSIS, as sources write them: "Ps.19.1-Ps.19.3", "Rom.1.19", "Gen.1.1-Gen.2.3", "Ps.19"
 * - the app's compact form, with USFM book IDs: "PSA.19.1-3", "ROM.1.19", "GEN.1.1-2.3", "PSA.19"
 */

import { CANON_BY_ID, CANON_BY_OSIS } from './canon.js';

/**
 * Parse an OSIS reference into { book, chapter, verse, endChapter, endVerse }.
 * verse and endVerse are null for whole-chapter references. Returns null if
 * the book or the shape isn't recognised.
 */
export function parseOsisRef(osis) {
  const [startPart, endPart] = String(osis).trim().split('-');
  const start = parseOsisPoint(startPart);
  if (!start) return null;
  let end = { book: start.book, chapter: start.chapter, verse: start.verse };
  if (endPart) {
    // The end may repeat the book ("Ps.19.3") or not ("19.3" or "3").
    const parts = endPart.split('.');
    if (CANON_BY_OSIS.has(parts[0])) {
      const e = parseOsisPoint(endPart);
      if (!e || e.book !== start.book) return null;
      end = e;
    } else if (parts.length === 2) {
      end = { book: start.book, chapter: Number(parts[0]), verse: Number(parts[1]) };
    } else if (parts.length === 1) {
      end = { book: start.book, chapter: start.chapter, verse: Number(parts[0]) };
    } else {
      return null;
    }
    if (!Number.isInteger(end.chapter) || (end.verse !== null && !Number.isInteger(end.verse))) return null;
  }
  return { book: start.book, chapter: start.chapter, verse: start.verse, endChapter: end.chapter, endVerse: end.verse };
}

function parseOsisPoint(text) {
  const [osisBook, ch, v, ...rest] = String(text).split('.');
  const book = CANON_BY_OSIS.get(osisBook);
  if (!book || rest.length) return null;
  const chapter = Number(ch);
  const verse = v === undefined ? null : Number(v);
  if (!Number.isInteger(chapter) || chapter < 1) return null;
  if (verse !== null && (!Number.isInteger(verse) || verse < 1)) return null;
  return { book: book.id, chapter, verse };
}

/** Parse the app's compact form back into a reference, or null. */
export function parseCompactRef(text) {
  const m = String(text).match(/^([1-3A-Z]{3})\.(\d+)(?:\.(\d+))?(?:-(\d+)(?:\.(\d+))?)?$/);
  if (!m || !CANON_BY_ID.has(m[1])) return null;
  const chapter = Number(m[2]);
  const verse = m[3] ? Number(m[3]) : null;
  let endChapter = chapter;
  let endVerse = verse;
  if (m[5]) {
    endChapter = Number(m[4]);
    endVerse = Number(m[5]);
  } else if (m[4]) {
    if (verse === null) endChapter = Number(m[4]);
    else endVerse = Number(m[4]);
  }
  return { book: m[1], chapter, verse, endChapter, endVerse };
}

/** The app's compact form: "PSA.19.1-3", "GEN.1.1-2.3", "PSA.19". */
export function compactRef(r) {
  let s = `${r.book}.${r.chapter}`;
  if (r.verse !== null) s += `.${r.verse}`;
  if (r.endChapter !== r.chapter) s += `-${r.endChapter}${r.endVerse !== null ? `.${r.endVerse}` : ''}`;
  else if (r.endVerse !== null && r.endVerse !== r.verse) s += `-${r.endVerse}`;
  return s;
}

/** A readable form: "Psalm 19:1–3", "Genesis 1:1–2:3", "Romans 8". */
export function displayRef(r) {
  const book = CANON_BY_ID.get(r.book);
  const name = r.book === 'PSA' ? 'Psalm' : book.name;
  let s = `${name} ${r.chapter}`;
  if (r.verse !== null) s += `:${r.verse}`;
  if (r.endChapter !== r.chapter) s += `–${r.endChapter}${r.endVerse !== null ? `:${r.endVerse}` : ''}`;
  else if (r.endVerse !== null && r.endVerse !== r.verse) s += `–${r.endVerse}`;
  return s;
}

/**
 * The verses a reference covers, as [chapter, verse] pairs, given a function
 * that returns the number of verses in a chapter of the book.
 */
export function versesInRef(r, verseCount) {
  const out = [];
  for (let c = r.chapter; c <= r.endChapter; c++) {
    const first = c === r.chapter && r.verse !== null ? r.verse : 1;
    const last = c === r.endChapter && r.endVerse !== null ? r.endVerse : verseCount(c);
    for (let v = first; v <= last; v++) out.push([c, v]);
  }
  return out;
}
