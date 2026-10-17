/**
 * Authenticating the Strong's lexicons against STEPBible's TSV files.
 *
 * For each Strong's number in range the source has, the output must carry
 * STEPBible's main entry for it (the row whose "dStrong" column ends in " =",
 * otherwise its first row), with the word, transliteration and gloss exactly
 * as written there, and the definition as its text once the HTML tags are
 * read (compare.js). The part of speech is re-derived from the row's
 * morphology code. Numbers, rows and columns that aren't used are counted.
 */

import { compareText } from './compare.js';
import { decodeXml } from './units.js';

/** STEPBible's morphology codes ("H:N-M", "G:V", "N:N-M-P") and what they name. */
const POS = {
  N: 'Noun', V: 'Verb', A: 'Adjective', ADV: 'Adverb', PREP: 'Preposition', CONJ: 'Conjunction',
  PRT: 'Particle', PART: 'Particle', INJ: 'Interjection', INTJ: 'Interjection', NEG: 'Negative particle',
  COND: 'Conditional', PERP: 'Personal pronoun', P: 'Personal pronoun', DEMP: 'Demonstrative pronoun',
  D: 'Demonstrative pronoun', RELP: 'Relative pronoun', R: 'Relative pronoun', INTG: 'Interrogative',
  F: 'Reflexive pronoun', S: 'Possessive pronoun', PREFIX: 'Prefix', SUFFIX: 'Suffix',
};
const GENDER = { M: 'masculine', F: 'feminine', N: 'neuter', 'M/F': 'masculine or feminine', 'M/N': 'masculine or neuter' };

/** One code's label: language prefix ("N:" a name, "A:" Aramaic), part of speech, then gender. */
function labelFor(code) {
  const colon = code.indexOf(':');
  const language = colon > 0 ? code.slice(0, colon) : '';
  const rest = colon > 0 ? code.slice(colon + 1) : code;
  const dash = rest.indexOf('-');
  const word = (dash < 0 ? rest : rest.slice(0, dash)).match(/^[A-Za-z]+/)?.[0];
  if (!word) return undefined;
  let label = language === 'N' ? 'Proper name' : POS[word.toUpperCase()];
  if (!label) return undefined;
  const gender = dash < 0 ? '' : rest.slice(dash + 1).split('-')[0];
  if (GENDER[gender]) label += `, ${GENDER[gender]}`;
  if (language === 'A') label += ' (Aramaic)';
  return label;
}

/**
 * The part of speech a morphology code names, or undefined when it (or any
 * part of a compound code) names none. Compound codes join parts with "+" or
 * with "/" before another prefixed code ("H:N-M / H:A"); a "/" inside a gender
 * ("M/F") is not a join.
 */
export function partOfSpeechFor(code) {
  const text = String(code ?? '').trim();
  const labels = [];
  let from = 0;
  for (const m of text.matchAll(/\s*\+\s*|\s*\/\s*(?=[A-Z]:)/g)) {
    labels.push(labelFor(text.slice(from, m.index)), m[0].trim());
    from = m.index + m[0].length;
  }
  labels.push(labelFor(text.slice(from)));
  if (labels.some(l => l === undefined)) return undefined;
  return labels.join(' ');
}

/** A definition's text: tags read as markup (<br> is a line break), character references decoded. */
export function definitionSource(html) {
  return decodeXml(String(html ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ''));
}

/** Rows of a lexicon TSV: { number, prefix, dStrong, lemma, translit, morph, gloss, meaning, size }, and the size of everything else. */
export function readLexicon(tsv) {
  const rows = [];
  let other = 0;
  for (const line of tsv.replace(/^﻿/, '').split(/\r?\n/)) {
    const cols = line.split('\t');
    const m = cols[0]?.match(/^([GH])(\d{4})/);
    if (!m || cols.length < 8) { other += line.replace(/\s/g, '').length; continue; }
    rows.push({
      prefix: m[1], number: Number(m[2]), dStrong: cols[1], lemma: cols[3], translit: cols[4], morph: cols[5], gloss: cols[6], meaning: cols[7],
      size: line.replace(/\s/g, '').length,
    });
  }
  return { rows, other };
}

/** Compare one converted lexicon with its source rows. Returns { problems, entries, excluded }. */
export function authenticateLexicon(output, tsv, { prefix, max }) {
  const problems = [];
  const excluded = new Map();
  const { rows, other } = readLexicon(tsv);
  excluded.set('header and notes', other);
  const main = new Map();
  const add = (key, n) => excluded.set(key, (excluded.get(key) ?? 0) + n);
  for (const r of rows) {
    if (r.prefix !== prefix || r.number < 1 || r.number > max) {
      add('numbers outside Strong\'s range', r.size);
      continue;
    }
    const isMain = /^\S+ =\s*$/.test(r.dStrong);
    const current = main.get(r.number);
    if (!current) main.set(r.number, { r, isMain });
    else {
      if (isMain && !current.isMain) main.set(r.number, { r, isMain });
      add('extended entries (STEPBible\'s sub-entries)', (isMain && !current.isMain ? current.r : r).size);
    }
  }
  const seen = new Set();
  for (const e of output.entries) {
    const n = Number(String(e.number).slice(1));
    const where = e.number;
    if (!String(e.number).startsWith(prefix) || !main.has(n)) { problems.push(`${where}: not in the source`); continue; }
    if (seen.has(n)) problems.push(`${where}: appears twice`);
    seen.add(n);
    const { r } = main.get(n);
    for (const [field, value] of [['lemma', r.lemma], ['transliteration', r.translit], ['gloss', r.gloss]]) {
      const expected = value.trim() || undefined;
      if (e[field] !== expected) problems.push(`${where} ${field}: "${e[field]}", source "${expected}"`);
    }
    const definition = definitionSource(r.meaning);
    if (!definition.trim()) {
      if (e.definition !== undefined) problems.push(`${where} definition: the source has none`);
    } else {
      const diff = compareText(definition, e.definition, ['STEPBible indentation']);
      if (diff) problems.push(`${where} definition: ${diff}`);
    }
    const pos = partOfSpeechFor(r.morph);
    if (e.partOfSpeech !== pos) problems.push(`${where} part of speech: "${e.partOfSpeech}", the code "${r.morph}" gives "${pos}"`);
  }
  for (const n of main.keys()) if (!seen.has(n)) problems.push(`${prefix}${n}: in the source but not in the output`);
  return { problems, entries: seen.size, excluded };
}
