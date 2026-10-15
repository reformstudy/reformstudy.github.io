/**
 * Corrections: reviewed edits to a source, applied at ingest.
 *
 * A correction is only ever made by choosing a witness's reading
 * (correctionFromReading); nobody types replacement text. Each one must match
 * the source exactly once when applied, so a changed source fails loudly
 * instead of being edited in the wrong place.
 */

import { CANON_BY_ID } from './canon.js';
import { parseOsisRef } from './refs.js';

/** Bibles: [{ ref: "GEN 1:1", from, to }]. */
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

/** Strong's: [{ entry: "H10", field: "lemma", from, to }]; the field must equal `from`. */
export function applyStrongsCorrections(dict, corrections) {
  const entries = new Map(dict.entries.map(e => [e.number, e]));
  for (const c of corrections) {
    const e = entries.get(c.entry);
    if (!e) throw new Error(`Strong's correction: no entry ${c.entry}`);
    if (e[c.field] !== c.from) throw new Error(`Strong's ${c.entry}: ${c.field} is "${e[c.field]}", expected "${c.from}"`);
    e[c.field] = c.to;
  }
  return dict;
}

// ---- building a correction from a chosen reading ---------------------------------

const WORD = 'A-Za-z0-9ſ\\u00C0-\\u024F';
const SEP = `[^${WORD}]+`;
const tokenPattern = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['’]").replace(/-/g, '[-–—]');
const words = s => (s ? s.split(' ').filter(Boolean) : []);

/**
 * Find our reading in the raw text and build { from, to } that replaces it with
 * `reading`, widening the surrounding context until `from` occurs exactly once.
 * Punctuation between words is kept wherever the number of words is unchanged.
 */
export function locateEdit(raw, { context = ['', ''], ours, reading }) {
  const before = words(context[0]);
  const after = words(context[1]);
  const O = words(ours);
  const W = words(reading);
  // Insertions and deletions need a neighbouring word, so the spacing around them can be rebuilt.
  for (let k = O.length && W.length ? 0 : 1; k <= Math.max(before.length, after.length); k++) {
    const B = before.slice(Math.max(0, before.length - k));
    const A = after.slice(0, k);
    const tokens = [...B, ...O, ...A];
    if (!tokens.length) continue;
    const re = new RegExp(`(?<![${WORD}])${tokens.map(t => `(${tokenPattern(t)})`).join(`(${SEP})`)}(?![${WORD}])`, 'g');
    const matches = [...raw.matchAll(re)];
    if (matches.length !== 1) continue;
    const m = matches[0];
    const found = tokens.map((_, i) => m[1 + 2 * i]);
    const seps = tokens.slice(1).map((_, i) => m[2 + 2 * i]);
    const curly = m[0].includes('’');
    const Wt = W.map(w => (curly ? w.replace(/'/g, '’') : w));
    const b = B.length;
    const o = O.length;
    // seps[j] is the original text between token j and token j + 1.
    let to = found.slice(0, b).map((t, i) => (i ? seps[i - 1] : '') + t).join('');
    if (Wt.length) {
      const inner = i => (Wt.length === o ? seps[b + i - 1] : ' ');
      to += (b ? seps[b - 1] : '') + Wt.map((w, i) => (i ? inner(i) : '') + w).join('');
      if (A.length) to += o ? seps[b + o - 1] : ' ';
    } else if (b && A.length) {
      to += seps[b - 1];
    }
    to += found.slice(b + o).map((t, i) => (i ? seps[b + o + i - 1] : '') + t).join('');
    const from = m[0];
    if (raw.split(from).length - 1 !== 1) continue;
    return { from, to };
  }
  throw new Error('Could not find this passage exactly once in the source text, so it can\'t be corrected automatically.');
}

/** "7-10, 12" -> [7, 8, 9, 10, 12]. */
const parseVerses = s => words(s.replace(/,/g, ' ')).flatMap(part => {
  const [a, b = a] = part.split('-').map(Number);
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
});

/** Verse numbers in one chapter -> OSIS references, joining runs into ranges. */
function osisRefs(book, chapter, verses) {
  const osis = CANON_BY_ID.get(book).osis;
  const sorted = [...new Set(verses)].sort((x, y) => x - y);
  const out = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (sorted[j + 1] === sorted[j] + 1) j++;
    out.push(j > i ? `${osis}.${chapter}.${sorted[i]}-${osis}.${chapter}.${sorted[j]}` : `${osis}.${chapter}.${sorted[i]}`);
    i = j;
  }
  return out;
}

/**
 * WCF proof references for one section and Bible chapter: make the verses
 * cited there match the chosen reading, keeping each reference in its
 * footnote. Verses the reading drops are trimmed from the references that
 * cite them; verses it adds go into one footnote, which must be chosen when
 * more than one could hold them.
 */
function proofCorrection(item, reading, footnote) {
  const [section, book, chapter] = item.unit.split(' ');
  const ch = Number(chapter);
  const { footnotes: fns = [], chapterVerses } = item.raw ?? {};
  const wanted = new Set(parseVerses(reading));
  const cited = new Set();
  const edits = new Map(); // footnote id -> { replace: [], with: [] }
  const touching = new Set();
  for (const f of fns) {
    for (const ref of f.refs) {
      const r = parseOsisRef(ref);
      if (!r || r.book !== book || ch < r.chapter || ch > r.endChapter) continue;
      if (r.chapter !== r.endChapter) throw new Error(`${ref} in footnote [${f.id}] spans more than one chapter, so this can't be corrected automatically.`);
      touching.add(f.id);
      const verses = r.verse === null ? Array.from({ length: chapterVerses }, (_, i) => i + 1) : parseVerses(`${r.verse}-${r.endVerse ?? r.verse}`);
      verses.forEach(v => cited.add(v));
      const kept = verses.filter(v => wanted.has(v));
      if (kept.length === verses.length) continue;
      if (!edits.has(f.id)) edits.set(f.id, { replace: [], with: [] });
      edits.get(f.id).replace.push(ref);
      edits.get(f.id).with.push(...osisRefs(book, ch, kept));
    }
  }
  const missing = [...wanted].filter(v => !cited.has(v));
  if (missing.length) {
    let target = footnote;
    if (target === undefined) {
      if (touching.size === 1) [target] = touching;
      else if (!touching.size && fns.length === 1) target = fns[0].id;
    }
    if (target === undefined || !fns.some(f => f.id === target)) {
      const err = new Error(`Choose the footnote to add ${osisRefs(book, ch, missing).join(', ')} to.`);
      err.footnotes = fns;
      throw err;
    }
    if (!edits.has(target)) edits.set(target, { replace: [], with: [] });
    edits.get(target).with.push(...osisRefs(book, ch, missing));
  }
  const entries = [...edits].map(([id, e]) => ({ section, footnote: id, ...e }));
  return { kind: 'proofs', entries };
}

/**
 * The correction(s) that replace our reading with `reading` (a witness's).
 * Returns { kind, entries } where kind says where they go in the decisions file:
 * 'verse' (Bibles), 'text' and 'proofs' (WCF), 'entry' (Strong's).
 * WCF proof items may need `footnote` when it's ambiguous where references belong;
 * the error then carries `footnotes` to choose from.
 */
export function correctionFromReading(resource, item, reading, { footnote } = {}) {
  if (reading === undefined || reading === item.ours) throw new Error('Choose a reading that differs from the source.');
  if (resource === 'kjv' || resource === 'bsb') {
    return { kind: 'verse', entries: [{ ref: item.unit, ...locateEdit(item.raw, { context: item.context, ours: item.ours, reading }), kind: 'word' }] };
  }
  if (resource.startsWith('strongs-')) {
    return { kind: 'entry', entries: [{ entry: item.unit, field: 'lemma', from: item.raw, to: reading }] };
  }
  if (resource === 'wcf' && Array.isArray(item.context)) {
    return { kind: 'text', entries: [{ section: item.unit, ...locateEdit(item.raw, { context: item.context, ours: item.ours, reading }) }] };
  }
  if (resource === 'wcf') return proofCorrection(item, reading, footnote);
  throw new Error(`Corrections aren't supported for ${resource}.`);
}
