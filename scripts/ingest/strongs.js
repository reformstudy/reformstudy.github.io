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
 *   node scripts/ingest/strongs.js                   # download from GitHub
 *   node scripts/ingest/strongs.js --source-dir DIR  # a local clone
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchBuffer, parseArgs, writeJson } from '../lib/io.js';
import { checkLock, sha256 } from '../lib/lock.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RES = path.join(__dirname, '../../res/strongs');
export const SOURCE_REPO = 'https://github.com/STEPBible/STEPBible-Data';
export const SOURCE_COMMIT = 'bd09545c7a44b39ace20f16c0359915f2aa23a62';
const RAW_BASE = `https://raw.githubusercontent.com/STEPBible/STEPBible-Data/${SOURCE_COMMIT}`;

const LANGUAGES = [
  {
    id: 'greek', language: 'Greek', prefix: 'G', max: 5624, name: "Strong's Greek Lexicon (STEPBible TBESG)",
    file: 'Lexicons/TBESG - Translators Brief lexicon of Extended Strongs for Greek - STEPBible.org CC BY.txt',
  },
  {
    id: 'hebrew', language: 'Hebrew', prefix: 'H', max: 8674, name: "Strong's Hebrew Lexicon (STEPBible TBESH)",
    file: 'Lexicons/TBESH - Translators Brief lexicon of Extended Strongs for Hebrew - STEPBible.org CC BY.txt',
  },
];

const POS = {
  N: 'Noun', V: 'Verb', A: 'Adjective', ADV: 'Adverb', PREP: 'Preposition', CONJ: 'Conjunction', PRT: 'Particle',
  PART: 'Particle', INJ: 'Interjection', INTJ: 'Interjection', NEG: 'Negative particle', COND: 'Conditional',
  PERP: 'Personal pronoun', P: 'Personal pronoun', DEMP: 'Demonstrative pronoun', D: 'Demonstrative pronoun',
  RELP: 'Relative pronoun', R: 'Relative pronoun', INTG: 'Interrogative', F: 'Reflexive pronoun', S: 'Possessive pronoun',
  PREFIX: 'Prefix', SUFFIX: 'Suffix',
};
const GENDER = { M: 'masculine', F: 'feminine', N: 'neuter', 'M/F': 'masculine or feminine' };

/** "H:N-M" -> "Noun, masculine"; "N:N-M-P" -> "Proper name, masculine"; "A:V" -> "Verb (Aramaic)". */
export function partOfSpeech(code) {
  const m = String(code ?? '').trim().match(/^(?:([A-Z]):)?([A-Za-z]+)(?:-([A-Z/]+))?/);
  if (!m) return undefined;
  const [, lang, pos, gender] = m;
  let text = lang === 'N' ? 'Proper name' : POS[pos.toUpperCase()];
  if (!text) return undefined;
  if (gender && GENDER[gender]) text += `, ${GENDER[gender]}`;
  if (lang === 'A') text += ' (Aramaic)';
  return text;
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

/** Download (or read) one pinned lexicon, check its checksum, and convert it. `id` is 'greek' or 'hebrew'. */
export async function loadStrongsSource(id, args = {}) {
  const lang = LANGUAGES.find(l => l.id === id);
  const raw = args['source-dir']
    ? fs.readFileSync(path.join(args['source-dir'], lang.file))
    : await fetchBuffer(`${RAW_BASE}/${lang.file.split('/').map(encodeURIComponent).join('/')}`);
  checkLock(`strongs-${lang.id}`, { sha256: sha256(raw), files: 1 });
  return convertLexicon(parseLexicon(raw.toString('utf8')), lang);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  for (const lang of LANGUAGES) {
    const out = await loadStrongsSource(lang.id, args);
    const file = path.join(RES, lang.id, `${lang.id}.json`);
    writeJson(file, out);
    console.log(`Wrote ${file} (${out.entries.length} entries)`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
