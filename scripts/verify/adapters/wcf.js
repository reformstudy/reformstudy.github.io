/**
 * Westminster Confession: two kinds of unit.
 *
 *   text    each section ("5.5"), compared word by word with spelling folded so
 *           that the 1649 printing's old spelling can be compared (case,
 *           ſ/s, j/i, v/u, doubled letters and a final e are ignored).
 *   proofs  each section and Bible chapter cited there ("5.5 ROM 1"), compared
 *           as the set of verses cited. The 1649 printing's references are
 *           margin notes per paragraph, read by a parser for 17th-century
 *           citations ("Rom. 2 14. 15. Psal. 19. 1, 2. 3."), so a split here
 *           can come from that parser rather than the text.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CANON } from '../../lib/canon.js';
import { parseOsisRef, versesInRef } from '../../lib/refs.js';
import { applyWcfCorrections, loadWcfSource } from '../../ingest/wcf.js';
import { align } from '../consensus.js';
import { loadWitnessText } from '../witnesses.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KJV = path.join(__dirname, '../../../res/bibles/kjv/kjv.json');

// ---- words -----------------------------------------------------------------

/** Fold old and modern spelling together ("doe"/"do", "ſinne"/"sin", "vnto"/"unto"); "onely"/"only" stay distinct. */
export function spellingKey(word) {
  return word.toLowerCase().replace(/ſ/g, 's').replace(/j/g, 'i').replace(/v/g, 'u')
    .replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1').replace(/e$/, '');
}

export function wcfTokens(text) {
  const show = (String(text).replace(/[’‘]/g, "'").replace(/&amp;|&/g, ' and ').match(/[A-Za-zſ']+/g) ?? []).filter(w => spellingKey(w));
  return { norm: show.map(spellingKey), show };
}

// ---- verse counts and references ---------------------------------------------

function kjvCounts() {
  const counts = new Map();
  for (const b of JSON.parse(fs.readFileSync(KJV, 'utf8')).books) {
    for (const v of b.verses) counts.set(`${b.id} ${v.chapter}`, Math.max(counts.get(`${b.id} ${v.chapter}`) ?? 0, v.verse));
  }
  return (book, chapter) => counts.get(`${book} ${chapter}`) ?? 0;
}

const SINGLE_CHAPTER = new Set(['OBA', 'PHM', '2JN', '3JN', 'JUD']);

function abbreviations(minLength, overrides) {
  const map = new Map();
  for (const b of CANON) {
    const n = b.name.toLowerCase().replace(/\s+/g, '');
    for (let l = minLength; l <= n.length; l++) if (!map.has(n.slice(0, l))) map.set(n.slice(0, l), b.id);
  }
  for (const [k, v] of Object.entries(overrides)) map.set(k, v);
  return map;
}

const OLD_ABBR = abbreviations(2, {
  ps: 'PSA', psal: 'PSA', phil: 'PHP', philem: 'PHM', jude: 'JUD', jud: 'JDG', judg: 'JDG', ezek: 'EZK', joel: 'JOL', nah: 'NAM',
  mark: 'MRK', mar: 'MRK', mat: 'MAT', john: 'JHN', joh: 'JHN', jo: 'JHN', '1john': '1JN', '1joh': '1JN', '2john': '2JN', '3john': '3JN',
  eccl: 'ECC', eccles: 'ECC', cant: 'SNG', jam: 'JAS', jas: 'JAS', tit: 'TIT', pro: 'PRO', prov: 'PRO', isai: 'ISA', esa: 'ISA',
  jon: 'JON', dan: 'DAN', deut: 'DEU', num: 'NUM', job: 'JOB', jer: 'JER', jos: 'JOS', josh: 'JOS', act: 'ACT', acts: 'ACT',
  heb: 'HEB', hos: 'HOS', hag: 'HAG', zech: 'ZEC', zach: 'ZEC', mal: 'MAL', mic: 'MIC', hab: 'HAB', zeph: 'ZEP', neh: 'NEH',
  esth: 'EST', gal: 'GAL', gen: 'GEN', exo: 'EXO', exod: 'EXO', lev: 'LEV', luk: 'LUK', rom: 'ROM', rev: 'REV', col: 'COL',
  eph: 'EPH', lam: 'LAM', ezr: 'EZR', ruth: 'RUT', amos: 'AMO', obad: 'OBA', sam: '1SA',
});

/** 1649 margin notes: "Rom. 2 14. 15. Rom. 1. 19, 20. Psal. 19. 1, 2. 3. Rom. 1. 32. with chap. 2, 1." */
export function parseOldNotes(notes, count) {
  const out = new Set();
  for (const note of notes) {
    const t = note.replace(/•/g, ' ').replace(/Iohn/g, 'John').replace(/Ioh/g, 'John').replace(/Ier/g, 'Jer').replace(/Iob/g, 'Job')
      .replace(/\bI(am|ude|udg|osh|oel|on|sa|sai)\b/g, (_, x) => (x === 'sa' || x === 'sai' ? 'Isa' : `J${x}`));
    let book = null; let chap = null; let prev = null; let wantChap = false; let range = false;
    let versesSeen = false;
    // A chapter cited without verses ("Psal. 88. throughout") means the whole chapter.
    const closeChapter = () => {
      if (book !== null && chap !== null && !versesSeen) for (let v = 1; v <= count(book, chap); v++) out.add(`${book} ${chap}:${v}`);
    };
    for (const tok of t.match(/(?:[123]\s*[A-Z][a-z]+)|[A-Z][a-z]+|chap|to|\d+/g) ?? []) {
      if (/^\d+$/.test(tok)) {
        const n = Number(tok);
        if (book === null) continue;
        if (wantChap) { closeChapter(); chap = n; wantChap = false; prev = null; versesSeen = false; continue; }
        if (range && prev !== null && chap !== null) {
          for (let v = prev + 1; v <= n; v++) out.add(`${book} ${chap}:${v}`);
          range = false; prev = n; continue;
        }
        if (chap === null && SINGLE_CHAPTER.has(book)) chap = 1;
        if (chap === null) { chap = n; versesSeen = false; continue; }
        out.add(`${book} ${chap}:${n}`); prev = n; versesSeen = true;
      } else if (tok === 'chap') {
        wantChap = true;
      } else if (tok === 'to') {
        range = true;
      } else {
        const b = OLD_ABBR.get(tok.toLowerCase().replace(/[^a-z0-9]/g, ''));
        if (b) { closeChapter(); book = b; chap = null; prev = null; wantChap = false; versesSeen = false; }
      }
    }
    closeChapter();
  }
  return out;
}

const MODERN_ABBR = abbreviations(3, {
  ps: 'PSA', psa: 'PSA', psalm: 'PSA', jas: 'JAS', phil: 'PHP', philem: 'PHM', phlm: 'PHM', song: 'SNG', cant: 'SNG', judg: 'JDG',
  jude: 'JUD', ezek: 'EZK', ezk: 'EZK', joel: 'JOL', nah: 'NAM', obad: 'OBA', mark: 'MRK', jn: 'JHN', john: 'JHN', '1john': '1JN',
  '2john': '2JN', '3john': '3JN', tit: 'TIT', titus: 'TIT', eccles: 'ECC', eccl: 'ECC',
});

/** Modern inline citations: "Rom. 2:14, 15; Ps. 19:1-3; Rom. 1:32, 2:1; Exod. 21 to the end". */
export function parseModernCitation(cite, count) {
  const out = new Set();
  let book = null;
  const cleaned = cite.replace(/[–—]/g, '-')
    .replace(/\s+(throughout|compared)\b/g, '')           // "Ps. 88 throughout": the whole chapter
    .replace(/(\d)\s+to\s+(\d)/g, '$1-$2');                // "Rom. 3:10 to 19"
  for (let seg of cleaned.split(/;|\bwith\b|&|\band\b/)) {
    seg = seg.trim().replace(/\.$/, '').trim();
    if (!seg) continue;
    let chap = null;
    let rest = seg;
    const m = seg.match(/^((?:[1-3]\s*)?[A-Za-z][A-Za-z.\s]*?)\.?\s+(\d.*|ver.*|chap.*)$/);
    if (m) {
      const b = MODERN_ABBR.get(m[1].toLowerCase().replace(/[^a-z0-9]/g, ''));
      if (!b) continue;
      book = b; rest = m[2];
    }
    rest = rest.replace(/^ver\.?\s*/, '').replace(/\s*chap(?:ter)?s?\.?$/, '');
    const toEnd = /to the end/.test(rest);
    rest = rest.replace(/\s*to the end/, '');
    const colonSeen = rest.includes(':');
    for (let part of rest.split(/,\s*/)) {
      part = part.trim();
      if (!part || book === null) continue;
      let mm = part.match(/^(\d+):(\d+)(?:\s*-\s*(?:(\d+):)?(\d+))?$/);
      if (mm) {
        chap = Number(mm[1]);
        const a = Number(mm[2]);
        if (mm[3]) {
          const ec = Number(mm[3]); const ev = Number(mm[4]);
          for (let c = chap; c <= ec; c++) for (let v = c === chap ? a : 1; v <= (c === ec ? ev : count(book, c)); v++) out.add(`${book} ${c}:${v}`);
          chap = ec; continue;
        }
        const b = toEnd ? count(book, chap) : Number(mm[4] ?? a);
        for (let v = a; v <= b; v++) out.add(`${book} ${chap}:${v}`);
        continue;
      }
      mm = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if (!mm) continue;
      const a = Number(mm[1]);
      let b = Number(mm[2] ?? a);
      if (SINGLE_CHAPTER.has(book) && chap === null && !colonSeen) {
        for (let v = a; v <= b; v++) out.add(`${book} 1:${v}`);
      } else if (chap === null) {
        for (let c = a; c <= b; c++) for (let v = 1; v <= count(book, c); v++) out.add(`${book} ${c}:${v}`);
      } else {
        if (toEnd) b = count(book, chap);
        for (let v = a; v <= b; v++) out.add(`${book} ${chap}:${v}`);
      }
    }
  }
  return out;
}

/** "1-3, 5, 7-8" for a list of verse numbers. */
export function compressVerses(verses) {
  const sorted = [...new Set(verses)].sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(j > i ? `${sorted[i]}-${sorted[j]}` : String(sorted[i]));
    i = j;
  }
  return parts.join(', ');
}

/** Set of "BOOK c:v" -> Map<"BOOK c", "1-3, 5">. */
function byChapter(verses) {
  const groups = new Map();
  for (const v of verses) {
    const [bc, n] = v.split(':');
    if (!groups.has(bc)) groups.set(bc, []);
    groups.get(bc).push(Number(n));
  }
  return new Map([...groups].map(([bc, list]) => [bc, compressVerses(list)]));
}

// ---- witnesses -----------------------------------------------------------------

/** EEBO-TCP transcription: chapter -> paragraphs [{ text, notes }]. */
export function parseTcp(xml) {
  const s = xml.replace(/<g ref="char:EOLhyphen"\/>/g, '').replace(/ſ/g, 's').replace(/<g ref="char:punc">[^<]*<\/g>/g, '.');
  const chapters = new Map();
  for (const m of s.matchAll(/<div n="(\d+)" type="chapter">([\s\S]*?)<\/div>/g)) {
    const n = Number(m[1]);
    if (chapters.has(n)) continue; // the Confession comes first; the catechisms follow
    chapters.set(n, [...m[2].matchAll(/<p>([\s\S]*?)<\/p>/g)].map(([, p]) => ({
      notes: [...p.matchAll(/<note[^>]*>([\s\S]*?)<\/note>/g)].map(([, x]) => x.replace(/<[^>]+>/g, '').trim()),
      text: p.replace(/<note[^>]*>[\s\S]*?<\/note>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().replace(/^[IVXL]+\.\s*/, ''),
    })));
  }
  return chapters;
}

function similarity(a, b) {
  const x = a.slice(0, 80); const y = b.slice(0, 80);
  const same = align(x, y).filter(o => o.equal).reduce((n, o) => n + (o.i2 - o.i1), 0);
  return (2 * same) / (x.length + y.length || 1);
}

export default {
  resource: 'wcf',
  unitName: 'section or proof chapter',
  comparison: 'Text: words with old spelling folded (case, ſ/s, j/i, v/u, doubled letters and a final e ignored). Proofs: the verses each section cites, per Bible chapter.',
  emptyCorrections: { text: [], proofs: [] },
  async load({ corrections }) {
    const count = kjvCounts();
    const source = applyWcfCorrections(await loadWcfSource(), corrections);
    const waller = JSON.parse(await loadWitnessText('wcf-waller')).languages.eng.chapters;
    const tcp = parseTcp(await loadWitnessText('wcf-1649'));

    const ours = new Map();
    const W = { 'wcf-1649': new Map(), 'wcf-waller': new Map() };
    const proofSets = { ours: new Map(), 'wcf-1649': new Map(), 'wcf-waller': new Map() };

    const wallerSections = new Map();
    for (const c of waller) for (const s of c.sections ?? [{ id: 1, text: c.text }]) wallerSections.set(`${c.id}.${s.id}`, s.text);

    for (const ch of source.Data) {
      const chapter = Number(ch.Chapter);
      for (const s of ch.Sections) {
        const num = `${chapter}.${Number(s.Section)}`;
        const mine = wcfTokens(s.Content);
        ours.set(num, mine);

        const verses = new Set();
        for (const p of s.Proofs ?? []) for (const osis of p.References) {
          const r = parseOsisRef(osis);
          for (const [c, v] of versesInRef(r, c2 => count(r.book, c2))) verses.add(`${r.book} ${c}:${v}`);
        }
        proofSets.ours.set(num, verses);

        const wt = wallerSections.get(num);
        if (wt !== undefined) {
          W['wcf-waller'].set(num, wcfTokens(wt.replace(/\s*\([^()]*\d[^()]*\)/g, ' ')));
          const wv = new Set();
          for (const [, cite] of wt.matchAll(/\(([^()]*\d[^()]*)\)/g)) for (const v of parseModernCitation(cite, count)) wv.add(v);
          proofSets['wcf-waller'].set(num, wv);
        }

        let best = null;
        for (const p of tcp.get(chapter) ?? []) {
          const toks = wcfTokens(p.text);
          const r = similarity(mine.norm, toks.norm);
          if (!best || r > best.r) best = { r, toks, p };
        }
        if (best && best.r > 0.5) {
          W['wcf-1649'].set(num, best.toks);
          proofSets['wcf-1649'].set(num, parseOldNotes(best.p.notes, count));
        }
      }
    }

    // Proof units: one per section and cited Bible chapter, the union over all copies.
    // A copy that has the section but cites nothing in that chapter reads "".
    for (const [num, mine] of proofSets.ours) {
      const groups = { ours: byChapter(mine) };
      for (const id of Object.keys(W)) if (proofSets[id].has(num)) groups[id] = byChapter(proofSets[id].get(num));
      const chapters = new Set(Object.values(groups).flatMap(g => [...g.keys()]));
      for (const bc of chapters) {
        const unit = `${num} ${bc}`;
        ours.set(unit, { value: groups.ours.get(bc) ?? '' });
        for (const id of Object.keys(W)) if (groups[id]) W[id].set(unit, { value: groups[id].get(bc) ?? '' });
      }
    }
    return { ours, witnesses: W };
  },
  suggest(item) {
    if ('context' in item) {
      const r = item.readings;
      const fold = x => (x ?? '').toLowerCase().replace(/[\s'-]/g, '').replace(/our/g, 'or').replace(/ence/g, 'ense').replace(/^un/, 'in').replace(/il/g, 'l');
      if (r['wcf-waller'] !== undefined && fold(r['wcf-waller']) === fold(item.ours)) {
        return { class: 'modern-spelling', action: 'accept', note: 'Only the spelling is modernised (honour/honor, for ever/forever); kept as an editorial choice.' };
      }
      return { class: 'text', action: null, note: 'Compare with the 1649 printing (EEBO-TCP A80320).' };
    }
    return { class: 'proofs', action: null, note: 'The 1649 reading comes from parsing margin notes and can be wrong; check the printing.' };
  },
};
