/**
 * Download the Strong's-numbered Greek and Hebrew lexicons from STEPBible
 * (Tyndale House, Cambridge) and write res/strongs/greek/greek.json and
 * res/strongs/hebrew/hebrew.json.
 *
 * Source: github.com/STEPBible/STEPBible-Data, pinned to a commit: TBESG
 * (Greek; definitions from Abbott-Smith's Manual Greek Lexicon) and TBESH
 * (Hebrew; definitions from a brief BDB). CC BY 4.0: the app credits
 * "STEP Bible", linked to www.STEPBible.org (provenance/registry.json).
 *
 * STEPBible extends Strong's numbering (H0001G, H0001H…) to tell apart words
 * Strong's grouped together, mostly names. Each Strong's number here gets
 * STEPBible's main entry for it; numbers beyond Strong's own range
 * (G5624, H8674) are left out.
 *
 * Usage:
 *   node scripts/ingest/strongs.js              # convert the committed copies in sources/strongs-greek and -hebrew
 *   node scripts/ingest/strongs.js --download   # fetch them again from GitHub first
 */

import { jsonText } from '../lib/io.js';
import { runAsScript } from '../lib/pipeline.js';

export const SOURCE_REPO = 'https://github.com/STEPBible/STEPBible-Data';
export const SOURCE_COMMIT = 'bd09545c7a44b39ace20f16c0359915f2aa23a62';

export const LANGUAGES = [
  {
    id: 'greek', source: 'strongs-greek', file: 'TBESG.txt', output: 'res/strongs/greek/greek.json',
    language: 'Greek', prefix: 'G', max: 5624, name: "Strong's Greek Lexicon (STEPBible TBESG)",
  },
  {
    id: 'hebrew', source: 'strongs-hebrew', file: 'TBESH.txt', output: 'res/strongs/hebrew/hebrew.json',
    language: 'Hebrew', prefix: 'H', max: 8674, name: "Strong's Hebrew Lexicon (STEPBible TBESH)",
  },
];

const POS = {
  N: 'Noun', V: 'Verb', A: 'Adjective', ADV: 'Adverb', PREP: 'Preposition', CONJ: 'Conjunction', PRT: 'Particle',
  PART: 'Particle', INJ: 'Interjection', INTJ: 'Interjection', NEG: 'Negative particle', COND: 'Conditional',
  PERP: 'Personal pronoun', P: 'Personal pronoun', DEMP: 'Demonstrative pronoun', D: 'Demonstrative pronoun',
  RELP: 'Relative pronoun', R: 'Relative pronoun', INTG: 'Interrogative', F: 'Reflexive pronoun', S: 'Possessive pronoun',
  PREFIX: 'Prefix', SUFFIX: 'Suffix',
};
const GENDER = { M: 'masculine', F: 'feminine', N: 'neuter', 'M/F': 'masculine or feminine', 'M/N': 'masculine or neuter' };

/** One code: "H:N-M" -> "Noun, masculine"; "N:N-M-P" -> "Proper name, masculine"; "A:V" -> "Verb (Aramaic)". */
function singlePartOfSpeech(code) {
  const m = code.match(/^(?:([A-Z]):)?([A-Za-z]+)(?:-([A-Z/]+))?/);
  if (!m) return undefined;
  const [, lang, pos, gender] = m;
  let text = lang === 'N' ? 'Proper name' : POS[pos.toUpperCase()];
  if (!text) return undefined;
  if (gender && GENDER[gender]) text += `, ${GENDER[gender]}`;
  if (lang === 'A') text += ' (Aramaic)';
  return text;
}

/**
 * A morphology code as words. Compound codes give each part, keeping how
 * they are joined: "H:N-M / H:A" -> "Noun, masculine / Adjective" (either),
 * "G:COND + G:PRT-N" -> "Conditional + Particle, neuter" (combined). If any
 * part names no part of speech, there is no label.
 */
export function partOfSpeech(code) {
  const pieces = String(code ?? '').trim().split(/\s*(\+|\/(?=\s*[A-Z]:))\s*/);
  let label = '';
  for (let i = 0; i < pieces.length; i += 2) {
    const part = singlePartOfSpeech(pieces[i]);
    if (!part) return undefined;
    label += i ? ` ${pieces[i - 1]} ${part}` : part;
  }
  return label;
}

/** STEPBible's definition HTML -> plain text with line breaks. */
export function definitionText(html) {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<ref='[^']*'>([^<]*)<\/ref>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/__/g, '  ')
    .split('\n').map(l => l.replace(/[ \t]+$/g, '').replace(/^ (?! )/, '')).filter((l, i, a) => l.trim() || (i && a[i - 1].trim()))
    .join('\n').trim();
}

/** Parse the TSV: one row per (extended) entry. */
export function parseLexicon(tsv) {
  const rows = [];
  for (const line of tsv.replace(/^﻿/, '').split('\n')) {
    const cols = line.replace(/\r$/, '').split('\t');
    if (cols.length < 8 || !/^[GH]\d{4}/.test(cols[0])) continue;
    rows.push({ estrong: cols[0], dstrong: cols[1], ustrong: cols[2], lemma: cols[3], translit: cols[4], morph: cols[5], gloss: cols[6], meaning: cols[7] });
  }
  return rows;
}

/** One entry per Strong's number: STEPBible's main row (e.g. "H0001G =") over its sub-entries for names ("a Part of"). */
export function convertLexicon(rows, lang) {
  const byNumber = new Map();
  for (const r of rows) {
    const n = Number(r.estrong.slice(1, 5));
    if (r.estrong[0] !== lang.prefix || n < 1 || n > lang.max) continue;
    const main = /^\S+ =\s*$/.test(r.dstrong);
    const current = byNumber.get(n);
    if (!current || (main && !current.main)) byNumber.set(n, { main, r });
  }
  const entries = [...byNumber].sort(([a], [b]) => a - b).map(([n, { r }]) => {
    const entry = {
      number: `${lang.prefix}${n}`,
      lemma: r.lemma.trim(),
      transliteration: r.translit.trim(),
      partOfSpeech: partOfSpeech(r.morph),
      gloss: r.gloss.trim(),
      definition: definitionText(r.meaning),
    };
    for (const k of Object.keys(entry)) if (!entry[k]) delete entry[k];
    return entry;
  });
  return {
    concordance: {
      id: lang.id,
      name: lang.name,
      language: lang.language,
      totalEntries: entries.length,
      source: { name: 'STEPBible.org, Tyndale House, Cambridge', url: `${SOURCE_REPO}/tree/${SOURCE_COMMIT}` },
      license: 'CC BY 4.0: credit "STEP Bible", linked to www.STEPBible.org',
    },
    entries,
  };
}

export const pipeline = {
  id: 'strongs',
  sources: LANGUAGES.map(l => l.source),
  owns: LANGUAGES.map(l => l.output),
  generate(files) {
    const outputs = new Map();
    const counts = [];
    for (const lang of LANGUAGES) {
      const out = convertLexicon(parseLexicon(files.get(lang.source).get(lang.file).toString('utf8')), lang);
      outputs.set(lang.output, jsonText(out));
      counts.push(`${out.entries.length} ${lang.language}`);
    }
    return { outputs, summary: `${counts.join(', ')} entries` };
  },
};

runAsScript(import.meta, pipeline);
