/**
 * Strong's dictionaries: one unit per number, compared on the headword
 * (lemma). The only independent witness is STEPBible's lexicon from Tyndale
 * House, which keys several words to some numbers, so our headword matches if
 * it is any of them. Accents, vowel points and final letter forms are ignored.
 * With a single witness, every difference needs a person's decision.
 */

import { loadStrongsSource } from '../../ingest/strongs.js';
import { align } from '../consensus.js';
import { loadWitnessText } from '../witnesses.js';

const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

export function lemmaKey(s) {
  return String(s ?? '').normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .replace(/[֑-ׇ]/g, '')
    .toLowerCase().replace(/ς/g, 'σ')
    .replace(/[^\p{L}]/gu, '')
    .replace(/[ךםןףץ]/g, c => FINALS[c]);
}

/** STEPBible TSV: "H0001\tH0001G =\tH0001G\tאָב\t..." -> Map<"H1", Set of lemmas>. */
export function parseStep(tsv) {
  const out = new Map();
  for (const line of tsv.split('\n')) {
    const cols = line.split('\t');
    if (cols.length < 5 || !/^[GH]\d{4}/.test(cols[0])) continue;
    const n = `${cols[0][0]}${Number(cols[0].slice(1, 5))}`;
    if (!out.has(n)) out.set(n, new Set());
    for (const lemma of cols[3].split(/[,،]\s*/)) if (lemma.trim()) out.get(n).add(lemma.trim());
  }
  return out;
}

function adapter(lang, witness) {
  return {
    resource: `strongs-${lang}`,
    unitName: 'entry',
    comparison: 'The headword of each number, ignoring accents, vowel points and final letter forms; ours matches if STEPBible lists it among the words for that number.',
    async load() {
      const dict = await loadStrongsSource(lang);
      const ours = new Map(dict.entries.map(e => [e.number, { value: lemmaKey(e.lemma), show: e.lemma ?? '' }]));
      const step = parseStep(await loadWitnessText(witness));
      const w = new Map();
      for (const [n, lemmas] of step) {
        const keys = [...lemmas].map(lemmaKey);
        const mine = ours.get(n)?.value;
        w.set(n, keys.includes(mine) ? { value: mine } : { value: [...new Set(keys)].sort().join(' / '), show: [...lemmas].join(' / ') });
      }
      // Numbers STEPBible lacks are only of interest if ours has them; numbers only STEPBible has
      // (its extensions beyond Strong's) are not part of this dictionary.
      for (const n of [...w.keys()]) if (!ours.has(n)) w.delete(n);
      return { ours, witnesses: { [witness]: w } };
    },
    suggest(item) {
      const a = lemmaKey(item.ours);
      const others = String(Object.values(item.readings)[0] ?? '').split(' / ').map(lemmaKey);
      if (lang === 'greek' && others.some(b => (a.endsWith('ομαι') && b === a.slice(0, -4) + 'ω') || (b.endsWith('ομαι') && a === b.slice(0, -4) + 'ω'))) {
        return { class: 'voice', action: 'accept', note: 'Same verb, cited in the middle voice in one and the active in the other.' };
      }
      const consonants = s => s.replace(/[וי]/g, '');
      if (lang === 'hebrew' && others.some(b => consonants(b) === consonants(a))) {
        return { class: 'vowel-letters', action: 'accept', note: 'Same word, spelled with or without the vowel letters ו/י.' };
      }
      const similar = b => {
        const x = [...a]; const y = [...b];
        const same = align(x, y).filter(o => o.equal).reduce((n, o) => n + (o.i2 - o.i1), 0);
        return (2 * same) / (x.length + y.length || 1);
      };
      if (others.some(b => similar(b) >= 0.6)) {
        return { class: 'related-form', action: null, note: 'Probably another form of the same word (plural, comparative, construct, Aramaic form); check the number names this word.' };
      }
      return { class: 'different-word', action: null, note: 'The words look unrelated: check this number in Strong\'s 1890 printing; it may be misnumbered.' };
    },
  };
}

export const greek = adapter('greek', 'step-tbesg');
export const hebrew = adapter('hebrew', 'step-tbesh');
