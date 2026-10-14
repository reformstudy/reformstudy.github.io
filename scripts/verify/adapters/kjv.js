/**
 * KJV: verse units, compared word by word with case kept (LORD, Lord and
 * GOD, God are different words in the KJV). Punctuation is not compared:
 * the witnesses punctuate inconsistently. Psalm titles, which some witnesses
 * put at the start of verse 1, are removed from the comparison.
 */

import { CANON } from '../../lib/canon.js';
import { applyKjvCorrections, loadKjvSource } from '../../ingest/kjv.js';
import { loadWitnessText } from '../witnesses.js';

const OSIS_TO_ID = new Map(CANON.map(b => [b.osis, b.id]));

/** Words with case kept; hyphens joined; apostrophes, italics brackets and pilcrows dropped. */
export function kjvTokens(text) {
  const show = String(text)
    .replace(/[¶[\]]/g, ' ')
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/æ/g, 'ae').replace(/Æ/g, 'Ae')
    .replace(/\bL ord\b/g, 'Lord')          // the PCE file splits some small-capital names
    .replace(/'S\b/g, "'s")                  // eBible capitalises the possessive in LORD'S
    .match(/[A-Za-z][A-Za-z'-]*/g) ?? [];
  const norm = show.map(w => w.replace(/['-]/g, ''));
  return { norm, show };
}

const ref = (book, chapter, verse) => `${book} ${chapter}:${verse}`;

export function parseEbible(xml) {
  const verses = new Map();
  const titles = new Map();
  for (const m of xml.matchAll(/<chapter osisRef="Ps\.(\d+)"[^>]*\/>\s*<title type="psalm"[^>]*>([\s\S]*?)<\/title>/g)) {
    titles.set(Number(m[1]), m[2].replace(/<[^>]+>/g, ''));
  }
  for (const m of xml.matchAll(/<verse osisID="([^"]+)" sID="([^"]+)"[^>]*\/>([\s\S]*?)<verse eID="\2"\s*\/>/g)) {
    const [b, c, v] = m[1].split('.');
    const id = OSIS_TO_ID.get(b);
    if (!id) continue;
    const text = m[3].replace(/<note[\s\S]*?<\/note>/g, '').replace(/<title[\s\S]*?<\/title>/g, '').replace(/<[^>]+>/g, '');
    verses.set(ref(id, Number(c), Number(v)), text);
  }
  return { verses, titles };
}

/** scrollmapper JSON: { books: [{ chapters: [{ chapter, verses: [{ verse, text }] }] }] } in canon order. */
export function parseScrollmapper(json) {
  const out = new Map();
  json.books.forEach((b, i) => {
    for (const ch of b.chapters) for (const v of ch.verses) out.set(ref(CANON[i].id, ch.chapter, v.verse), v.text);
  });
  return out;
}

/** thiagobodruk JSON: [{ chapters: [[verse text, ...], ...] }] in canon order; {...} are margin notes. */
export function parseThiago(json) {
  const out = new Map();
  json.forEach((b, i) => b.chapters.forEach((ch, c) => ch.forEach((t, v) => {
    if (t) out.set(ref(CANON[i].id, c + 1, v + 1), t.replace(/\{[^}]*\}/g, ' '));
  })));
  return out;
}

function stripTitle(units, titles) {
  for (const [c, title] of titles) {
    const key = ref('PSA', c, 1);
    const u = units.get(key);
    if (!u) continue;
    const t = kjvTokens(title).norm.map(w => w.toLowerCase());
    const head = u.norm.slice(0, t.length).map(w => w.toLowerCase());
    if (t.length && head.every((w, i) => w === t[i])) {
      units.set(key, { norm: u.norm.slice(t.length), show: u.show.slice(t.length) });
    }
  }
  return units;
}

const toUnits = texts => new Map([...texts].map(([k, t]) => [k, kjvTokens(t)]));

export default {
  resource: 'kjv',
  unitName: 'verse',
  comparison: 'Words, with case kept (LORD/Lord, GOD/God); punctuation, apostrophes, hyphens and italics are not compared.',
  async load({ corrections }) {
    const bible = applyKjvCorrections(await loadKjvSource(), corrections);
    const ours = new Map();
    for (const b of bible.books) for (const v of b.verses) ours.set(ref(b.id, v.chapter, v.verse), kjvTokens(v.text));
    const eb = parseEbible(await loadWitnessText('kjv-ebible'));
    const witnesses = {
      'kjv-pce': stripTitle(toUnits(parseScrollmapper(JSON.parse(await loadWitnessText('kjv-pce')))), eb.titles),
      'kjv-scrollmapper': stripTitle(toUnits(parseScrollmapper(JSON.parse(await loadWitnessText('kjv-scrollmapper')))), eb.titles),
      'kjv-ebible': toUnits(eb.verses),
      'kjv-thiago': stripTitle(toUnits(parseThiago(JSON.parse(await loadWitnessText('kjv-thiago')))), eb.titles),
    };
    return { ours, witnesses };
  },
  /** A hint for the reviewer: { class, action, note }. Never applied automatically. */
  suggest(item) {
    const r = item.readings;
    const others = ['kjv-pce', 'kjv-scrollmapper', 'kjv-thiago'].map(id => r[id]);
    const lower = s => (s ?? '').toLowerCase();
    if (r['kjv-ebible'] === item.ours && others.every(x => x === others[0]) && others[0] !== item.ours && lower(others[0]) !== lower(item.ours)) {
      return { class: 'oxford-cambridge', action: 'accept', note: 'Our source and eBible agree (Oxford 1769 text); the PCE and the copies that follow it read differently. Accept if we keep the Oxford text.' };
    }
    if (/\b(LORD|GOD|Lord|God)\b/.test([item.ours, ...Object.values(r)].join(' '))) {
      return { class: 'divine-name', action: null, note: 'Check the Hebrew: LORD/GOD for YHWH, Lord/God for Adonai/Elohim. The PCE and scrollmapper often lose small capitals.' };
    }
    if (/^[A-Z ]+$/.test(item.ours) && item.ours.split(' ').length > 1) {
      return { class: 'opening-capitals', action: 'correct', note: 'Our source prints the opening words in capitals, a typesetting convention, not part of the text.' };
    }
    const present = Object.values(r).filter(x => x !== undefined);
    if (item.class === 'against' && present.every(x => x === present[0])) {
      return { class: lower(present[0]) === lower(item.ours) ? 'case' : 'unanimous', action: 'correct', note: 'Every witness agrees against our source.' };
    }
    return { class: null, action: null, note: null };
  },
};
