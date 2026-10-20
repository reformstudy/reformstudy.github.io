/**
 * Authenticating the Westminster Confession against the Creeds.json file.
 *
 * Every chapter title and section text must equal the source's, character for
 * character (nothing is changed in conversion). Proof references must be the
 * source's references in the app's form, and each proof text must be the
 * KJV's text of those verses, read from the (authenticated) KJV.
 */

import { compareText } from './compare.js';
import { compactOf, displayOf, readOsis } from './refs.js';

/** The verses a reference covers in the KJV, as text, or null if any is missing. */
function kjvText(r, kjv) {
  const book = kjv.books.find(b => b.id === r.book);
  if (!book) return null;
  const last = c => Math.max(0, ...book.verses.filter(v => v.chapter === c).map(v => v.verse));
  const texts = [];
  for (let c = r.chapter; c <= r.endChapter; c++) {
    const from = c === r.chapter && r.verse !== null ? r.verse : 1;
    const to = c === r.endChapter && r.endVerse !== null ? r.endVerse : last(c);
    for (let v = from; v <= to; v++) {
      const verse = book.verses.find(x => x.chapter === c && x.verse === v);
      if (!verse) return null;
      texts.push(verse.text);
    }
  }
  return texts.length ? texts.join(' ') : null;
}

export function authenticateConfession(output, source, kjv) {
  const problems = [];
  let sections = 0;
  let proofs = 0;
  const exact = (where, actual, expected) => {
    if (actual !== expected) problems.push(`${where}: ${compareText(expected, actual) ?? 'whitespace differs'}`);
  };
  if (output.sections.length !== source.Data.length) problems.push(`${output.sections.length} chapters, the source has ${source.Data.length}`);
  source.Data.forEach((ch, ci) => {
    const out = output.sections[ci];
    const chapter = Number(ch.Chapter);
    if (!out || out.chapter !== chapter) return problems.push(`chapter ${chapter}: missing or out of order`);
    exact(`chapter ${chapter} title`, out.title, ch.Title);
    if (out.sections.length !== ch.Sections.length) problems.push(`chapter ${chapter}: ${out.sections.length} sections, the source has ${ch.Sections.length}`);
    ch.Sections.forEach((s, si) => {
      const o = out.sections[si];
      const number = `${chapter}.${Number(s.Section)}`;
      if (!o || o.number !== number) return problems.push(`${number}: missing or out of order`);
      sections++;
      exact(`${number} text`, o.content, s.Content);
      exact(`${number} text with footnote marks`, o.contentWithProofs, s.ContentWithProofs ?? s.Content);
      const sourceProofs = [...(s.Proofs ?? [])].sort((a, b) => a.Id - b.Id);
      if (o.proofs.length !== sourceProofs.length) problems.push(`${number}: ${o.proofs.length} footnotes, the source has ${sourceProofs.length}`);
      const texts = [];
      sourceProofs.forEach((p, pi) => {
        const refs = p.References.map(readOsis);
        if (refs.some(r => !r)) return problems.push(`${number} [${p.Id}]: a reference can't be read: ${p.References.join(', ')}`);
        const op = o.proofs[pi];
        if (op?.id !== p.Id) return problems.push(`${number} [${p.Id}]: missing`);
        const expected = refs.map(compactOf);
        if (JSON.stringify(op.refs) !== JSON.stringify(expected)) problems.push(`${number} [${p.Id}]: references ${op.refs.join(', ')}, the source has ${expected.join(', ')}`);
        for (const r of refs) texts.push({ footnote: p.Id, ref: compactOf(r), reference: displayOf(r), text: kjvText(r, kjv) });
      });
      if (o.proofTexts.length !== texts.length) problems.push(`${number}: ${o.proofTexts.length} proof texts, expected ${texts.length}`);
      texts.forEach((t, i) => {
        const pt = o.proofTexts[i];
        proofs++;
        if (!pt || pt.ref !== t.ref || pt.footnote !== t.footnote || pt.reference !== t.reference) {
          return problems.push(`${number} proof text ${i + 1}: expected ${t.reference} for [${t.footnote}]`);
        }
        if (t.text === null) problems.push(`${number} ${t.reference}: not in the KJV`);
        else if (pt.text !== t.text) problems.push(`${number} ${t.reference}: the proof text isn't the KJV's`);
      });
    });
  });
  return { problems, sections, proofs };
}
