/**
 * Where a confession cites Scripture: an index from verses to the sections,
 * footnotes and clauses whose proofs name them, built from the confession's
 * own `proofs` (compact references, checked against the source by the
 * content pipeline).
 */

import type { Confession, ConfessionSubsection } from './resourceLoader';
import { CompactRef, parseCompactRef, refIncludes } from './scriptureRefs';

export interface Citation {
  /** Section number, e.g. "1.1". */
  section: string;
  chapter: number;
  chapterTitle: string;
  footnote: number;
  /** The reference as the proof gives it, e.g. "ROM.8.28-30". */
  ref: string;
  parsed: CompactRef;
  /** The words of the section the footnote is attached to. */
  clause: string;
}

/**
 * The clause a footnote marks: the text after the previous marker up to
 * marker [n] in contentWithProofs. Falls back to the whole section.
 */
export function clauseFor(section: ConfessionSubsection, footnote: number): string {
  const text = section.contentWithProofs;
  if (!text) return section.content;
  const marker = `[${footnote}]`;
  const end = text.indexOf(marker);
  if (end < 0) return section.content;
  const before = text.slice(0, end);
  const previous = before.lastIndexOf(']');
  return before.slice(previous + 1).replace(/^[\s;,:.]+/, '').trim();
}

/** Every citation in a confession, grouped by book ("ROM"). */
export function citationIndex(confession: Confession): Map<string, Citation[]> {
  const byBook = new Map<string, Citation[]>();
  for (const chapter of confession.sections) {
    for (const section of chapter.sections) {
      for (const proof of section.proofs ?? []) {
        for (const ref of proof.refs) {
          const parsed = parseCompactRef(ref);
          if (!parsed) continue;
          const list = byBook.get(parsed.book) ?? [];
          list.push({
            section: section.number,
            chapter: chapter.chapter,
            chapterTitle: chapter.title,
            footnote: proof.id,
            ref,
            parsed,
            clause: clauseFor(section, proof.id),
          });
          byBook.set(parsed.book, list);
        }
      }
    }
  }
  return byBook;
}

/** The citations that include a verse. */
export function citationsOf(index: Map<string, Citation[]>, book: string, chapter: number, verse: number): Citation[] {
  return (index.get(book) ?? []).filter(c => refIncludes(c.parsed, book, chapter, verse));
}
