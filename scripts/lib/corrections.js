/**
 * Verse corrections applied at ingest: [{ ref: "GEN 1:1", from, to }].
 *
 * Only the interim KJV source (aruljohn/Bible-kjv) has any; they go away when
 * the KJV comes from eBible.org. Each `from` must occur exactly once in its
 * verse, so a changed source fails instead of being edited in the wrong place.
 */

export function applyVerseCorrections(bible, corrections, label = 'Bible') {
  const verses = new Map();
  for (const book of bible.books) for (const v of book.verses) verses.set(`${book.id} ${v.chapter}:${v.verse}`, v);
  for (const c of corrections) {
    const v = verses.get(c.ref);
    if (!v) throw new Error(`${label} correction: no verse ${c.ref}`);
    const count = v.text.split(c.from).length - 1;
    if (count !== 1) throw new Error(`${label} ${c.ref}: "${c.from}" appears ${count} times, expected once`);
    v.text = v.text.replace(c.from, c.to);
  }
  return bible;
}
