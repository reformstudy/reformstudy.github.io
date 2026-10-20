/**
 * The app's compact Scripture references, as the content pipeline writes them
 * (scripts/lib/refs.js): "PSA.19.1-3", "ROM.1.19", "GEN.1.1-2.3", "PSA.19",
 * "HEB.8-10". Book IDs are USFM IDs.
 */

export interface CompactRef {
  book: string;
  chapter: number;
  /** null for whole chapters ("PSA.19", "HEB.8-10"). */
  verse: number | null;
  endChapter: number;
  endVerse: number | null;
}

/** Parse a compact reference, or null if it isn't one. */
export function parseCompactRef(text: string): CompactRef | null {
  const m = String(text).match(/^([1-3A-Z]{3})\.(\d+)(?:\.(\d+))?(?:-(\d+)(?:\.(\d+))?)?$/);
  if (!m) return null;
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

/** Whether a reference includes a verse. */
export function refIncludes(ref: CompactRef, book: string, chapter: number, verse: number): boolean {
  if (ref.book !== book) return false;
  const after = (ref.chapter < chapter) || (ref.chapter === chapter && (ref.verse === null || ref.verse <= verse));
  const before = (ref.endChapter > chapter) || (ref.endChapter === chapter && (ref.endVerse === null || ref.endVerse >= verse));
  return after && before;
}

/** The reader's address for a reference: its first chapter, and first verse if it names one. */
export function readerPath(ref: CompactRef): string {
  return `/reader/${ref.book}/${ref.chapter}${ref.verse === null ? '' : `/${ref.verse}`}`;
}

/** A readable form: "Romans 8:28–30", "Hebrews 8–10", "Genesis 1:1–2:3". */
export function formatRef(ref: CompactRef, bookName: (id: string) => string): string {
  let s = `${bookName(ref.book)} ${ref.chapter}`;
  if (ref.verse !== null) s += `:${ref.verse}`;
  if (ref.endChapter !== ref.chapter) s += `–${ref.endChapter}${ref.endVerse !== null ? `:${ref.endVerse}` : ''}`;
  else if (ref.endVerse !== null && ref.endVerse !== ref.verse) s += `–${ref.endVerse}`;
  return s;
}
