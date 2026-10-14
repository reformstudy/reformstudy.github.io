/**
 * BSB: verse units, compared word by word with case kept. Punctuation, quote
 * marks and dashes are not compared. The witness puts Psalm titles in verse 1
 * and Psalm 119's stanza letters at the end of each stanza; both are headings,
 * not verse text, and are removed before comparing, as are three "vvv"
 * placeholders in the witness file.
 */

import { CANON } from '../../lib/canon.js';
import { loadBsbSource } from '../../ingest/bsb.js';
import { loadWitnessText } from '../witnesses.js';

export function bsbTokens(text) {
  const show = String(text)
    .replace(/[’‘]/g, "'")
    .replace(/[—–]/g, ' ')
    .match(/[A-Za-z0-9][A-Za-z0-9'-]*/g) ?? [];
  return { norm: show.map(w => w.replace(/['-]/g, '')), show };
}

const ref = (book, chapter, verse) => `${book} ${chapter}:${verse}`;

/**
 * thiagobodruk numbers verses by position and leaves out the verses the BSB
 * omits, so where a chapter has the same number of verses as ours, its verses
 * are matched to our verse numbers in order.
 */
export function parseThiagoBsb(json, ourVerseNumbers) {
  const out = new Map();
  json.forEach((b, i) => b.chapters.forEach((ch, c) => {
    const texts = ch.filter(Boolean);
    const nums = ourVerseNumbers.get(`${CANON[i].id} ${c + 1}`) ?? [];
    const numbers = texts.length === nums.length ? nums : texts.map((_, v) => v + 1);
    texts.forEach((t, v) => out.set(ref(CANON[i].id, c + 1, numbers[v]), t
      .replace(/\s*[א-ת] [A-Z]+(?: and [A-Z]+)?\s*$/, '')
      .replace(/\bvvv\b/g, ' ')));
  }));
  return out;
}

export default {
  resource: 'bsb',
  unitName: 'verse',
  comparison: 'Words, with case kept; punctuation, quotation marks and dashes are not compared.',
  async load() {
    const bible = await loadBsbSource();
    const ours = new Map();
    const numbers = new Map();
    const subtitles = new Map();
    for (const b of bible.books) {
      for (const [c, t] of Object.entries(b.subtitles ?? {})) subtitles.set(ref(b.id, Number(c), 1), bsbTokens(t).norm);
      for (const v of b.verses) {
        ours.set(ref(b.id, v.chapter, v.verse), bsbTokens(v.text));
        const k = `${b.id} ${v.chapter}`;
        if (!numbers.has(k)) numbers.set(k, []);
        numbers.get(k).push(v.verse);
      }
    }
    const thiago = new Map();
    for (const [k, t] of parseThiagoBsb(JSON.parse(await loadWitnessText('bsb-thiago')), numbers)) {
      const u = bsbTokens(t);
      const title = subtitles.get(k);
      if (title && u.norm.slice(0, title.length).join(' ') === title.join(' ')) {
        u.norm = u.norm.slice(title.length);
        u.show = u.show.slice(title.length);
      }
      thiago.set(k, u);
    }
    return { ours, witnesses: { 'bsb-thiago': thiago } };
  },
  suggest() {
    return { class: null, action: null, note: 'Only one witness: check the publisher\'s text (berean.bible) to decide.' };
  },
};
