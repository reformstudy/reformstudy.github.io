/**
 * Authenticating the BSB's Strong's numbers against the publisher's
 * translation tables (bsb_tables.tsv), with code separate from the converter.
 *
 * The tables give, for each Hebrew or Greek word, the BSB phrase that
 * translates it, in English order. The rule the output must follow: walk a
 * verse's rows in English order; find each row's phrase (its words as the
 * plain text prints them) in the verse at or after the last phrase found, as
 * whole words; a row with a Strong's number that is found is one tag. The
 * verse text is the plain text's (checked separately), so here only the tags
 * are checked: the expected tags are worked out again from the tables and
 * must equal the output's exactly.
 */

import { CANON } from '../lib/canon.js';

const BOOKS = new Map([...CANON.map(b => [b.name, b.id]), ['Psalm', 'PSA']]);

/** Table markup in the English column: what it means, and what it becomes. */
const MARKUP = [
  [/<[^>]*>/g, ' ', 'HTML layout tags'],
  [/vvv/g, ' ', 'placeholder "vvv"'],
  [/\. \. \./g, ' ', 'continuation ". . ."'],
  [/[[\]]/g, '', 'supplied-word brackets'],
  [/[{}]/g, '', 'implied-word braces'],
];

/** A phrase as the plain text prints it, from the table's English column. */
export function tablePhrase(english) {
  let s = english;
  for (const [re, by] of MARKUP) s = s.replace(re, by);
  const words = s.split(/\s+/).filter(w => w && w !== '-');
  s = words.join(' ')
    .replace(/ ([,.;:!?’”)])/g, '$1')
    .replace(/([“‘(]) /g, '$1')
    .replace(/ ?— ?/g, '—');
  const first = s.search(/[\p{L}\p{N}]/u);
  if (first < 0) return '';
  let last = s.length;
  while (!/[\p{L}\p{N}]/u.test(s[last - 1])) last--;
  return s.slice(first, last);
}

/** Read the tables: Map "GEN 1:1" -> [{ sort, english, strongs }], in English order. */
export function readTables(tsv) {
  const [header, ...lines] = tsv.replace(/^﻿/, '').split(/\r?\n/);
  const names = header.split('\t').map(h => h.trim());
  const at = name => {
    const i = names.indexOf(name);
    if (i < 0) throw new Error(`no "${name}" column in the translation tables`);
    return i;
  };
  const c = { sort: at('BSB Sort'), id: at('VerseId'), english: at('BSB version'), heb: at('Str Heb'), grk: at('Str Grk') };
  const byVerse = new Map();
  let current;
  for (const line of lines) {
    if (line === '') continue;
    const f = line.split('\t');
    if (f[c.id]) {
      const m = /^(.*\S) (\d+):(\d+)$/.exec(f[c.id]);
      const book = m ? BOOKS.get(m[1]) : undefined;
      if (!book) throw new Error(`unknown verse "${f[c.id]}" in the translation tables`);
      current = `${book} ${+m[2]}:${+m[3]}`;
    }
    if (current === undefined) throw new Error('a row before the first verse in the translation tables');
    let strongs = null;
    if (/^\d+$/.test(f[c.heb] ?? '')) strongs = `H${parseInt(f[c.heb], 10)}`;
    else if (/^\d+$/.test(f[c.grk] ?? '')) strongs = `G${parseInt(f[c.grk], 10)}`;
    else if (f[c.heb] || f[c.grk]) throw new Error(`${current}: unreadable Strong's number "${f[c.heb] || f[c.grk]}"`);
    if (!byVerse.has(current)) byVerse.set(current, []);
    byVerse.get(current).push({ sort: +f[c.sort], english: f[c.english] ?? '', strongs });
  }
  for (const rows of byVerse.values()) rows.sort((a, b) => a.sort - b.sort);
  return byVerse;
}

const isWordChar = ch => ch !== undefined && /[\p{L}\p{N}]/u.test(ch);

/** The tags the rule gives for a text, and counts of the rows that give none. */
export function expectedTags(text, rows) {
  const tags = [];
  const counts = { untranslated: 0, missed: 0 };
  let from = 0;
  for (const row of rows) {
    const phrase = tablePhrase(row.english);
    if (!phrase) {
      if (row.strongs) counts.untranslated++;
      continue;
    }
    let found = -1;
    for (let i = text.indexOf(phrase, from); i >= 0; i = text.indexOf(phrase, i + 1)) {
      if (!isWordChar(text[i - 1]) && !isWordChar(text[i + phrase.length])) { found = i; break; }
    }
    if (found < 0) {
      if (row.strongs) counts.missed++;
      continue;
    }
    if (row.strongs) tags.push([found, found + phrase.length, row.strongs]);
    from = found + phrase.length;
  }
  return { tags, counts };
}

/**
 * Check every BSB verse's `strongs` against the tables. A Psalm's title and
 * verse 1 are one verse in the tables, searched as "title\nverse"; tags in
 * the title are counted, not kept. Returns { problems, tags, counts }.
 */
export function authenticateTableTags(bible, tables) {
  const problems = [];
  const counts = { tags: 0, inTitles: 0, untranslated: 0, missed: 0 };
  const seen = new Set();
  for (const book of bible.books) {
    for (const v of book.verses) {
      const key = `${book.id} ${v.chapter}:${v.verse}`;
      seen.add(key);
      const title = v.verse === 1 ? book.subtitles?.[v.chapter] : undefined;
      const offset = title === undefined ? 0 : title.length + 1;
      const r = expectedTags(title === undefined ? v.text : `${title}\n${v.text}`, tables.get(key) ?? []);
      counts.untranslated += r.counts.untranslated;
      counts.missed += r.counts.missed;
      const expected = [];
      for (const [s, e, n] of r.tags) {
        if (s < offset) counts.inTitles++;
        else expected.push([s - offset, e - offset, n]);
      }
      const actual = v.strongs ?? [];
      counts.tags += actual.length;
      if (JSON.stringify(actual) === JSON.stringify(expected)) continue;
      const i = expected.findIndex((t, j) => JSON.stringify(t) !== JSON.stringify(actual[j]));
      const at = i < 0 ? expected.length : i;
      const show = t => (t ? `"${v.text.slice(t[0], t[1])}" ${t[2]} [${t[0]}, ${t[1]}]` : 'nothing');
      problems.push(`${key}, tag ${at + 1}: ${show(actual[at])}, the tables give ${show(expected[at])}`);
    }
  }
  for (const [key, rows] of tables) {
    if (!seen.has(key) && rows.some(r => r.strongs && tablePhrase(r.english))) {
      counts.missed += rows.filter(r => r.strongs && tablePhrase(r.english)).length;
    }
  }
  return { problems, ...counts };
}
