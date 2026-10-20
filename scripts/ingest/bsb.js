/**
 * Convert the Berean Standard Bible from its publisher's downloads into
 * res/bibles/bsb/bsb.json.
 *
 * Source: the plain-text download on the publisher's site
 * (https://berean.bible/downloads.htm -> bereanbible.com/bsb.txt), one verse
 * per line ("Genesis 1:1<tab>In the beginning…"), the text berean.bible shows.
 * The BSB has been dedicated to the public domain since April 30, 2023
 * (berean.bible/terms.htm).
 *
 * Psalm titles: the plain text begins verse 1 of a Psalm with its title. The
 * publisher's USX download (bsb_usx.zip) marks each title separately, so it
 * shows where the title ends; the title and verse 1 both keep the plain
 * text's own wording. The 16 verses the BSB leaves out are empty lines in the
 * plain text and are left out here too.
 *
 * Strong's numbers: the publisher's translation tables (bsb_tables.tsv) give,
 * for each Hebrew or Greek word, the BSB phrase that translates it and its
 * Strong's number, in English order. Each phrase is found in the verse text,
 * in order, and kept as `strongs: [[start, end, "H7225"], …]` (see
 * alignPhrases). The verse text itself is always the plain text's.
 *
 * Usage:
 *   node scripts/ingest/bsb.js              # convert the committed copies in sources/bsb/
 *   node scripts/ingest/bsb.js --download   # fetch them again from the publisher first
 */

import { CANON } from '../lib/canon.js';
import { bibleFileText, normalizeText } from '../lib/io.js';
import { runAsScript } from '../lib/pipeline.js';
import { parseUsxBook } from '../lib/usx.js';
import { readZip } from '../lib/zip.js';

export const OUTPUT = 'res/bibles/bsb/bsb.json';
export const SOURCE_PAGE = 'https://berean.bible/downloads.htm';
export const TEXT_FILE = 'bsb.txt';
export const USX_FILE = 'bsb_usx.zip';
export const TABLES_FILE = 'bsb_tables.tsv';

/** The plain text's book names: the canon's, with "Psalm" for Psalms. */
const BOOK_BY_NAME = new Map([...CANON.map(b => [b.name, b.id]), ['Psalm', 'PSA']]);

/** Read the plain text: Map of "GEN 1:1" -> text (empty for verses the BSB leaves out). */
export function readPlainText(txt) {
  const verses = new Map();
  for (const line of txt.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const m = line.match(/^(.+) (\d+):(\d+)\t(.*)$/);
    if (!m) continue; // the attribution and column headings
    const book = BOOK_BY_NAME.get(m[1]);
    if (!book) throw new Error(`Unknown book "${m[1]}" in ${line.slice(0, 40)}`);
    const key = `${book} ${m[2]}:${m[3]}`;
    if (verses.has(key)) throw new Error(`${key} appears twice`);
    verses.set(key, m[4]);
  }
  return verses;
}

/**
 * Split a Psalm's title off its verse 1: `title` (from the USX) says how many
 * characters, not counting spaces, the title has; the words are the plain text's.
 */
export function splitTitle(verse, title, where) {
  const want = title.replace(/\s/g, '');
  let i = 0;
  let seen = '';
  while (i < verse.length && seen.length < want.length) {
    if (!/\s/.test(verse[i])) seen += verse[i];
    i++;
  }
  if (seen !== want) throw new Error(`${where}: verse 1 doesn't begin with the title "${title}"`);
  return { title: normalizeText(verse.slice(0, i)), text: normalizeText(verse.slice(i)) };
}

/** The Psalm titles marked in the USX download: { chapter: title }. */
export function usxPsalmTitles(usxFiles) {
  for (const [name, data] of usxFiles) {
    const usx = data.toString('utf8');
    if (name.endsWith('.usx') && /<book\b[^>]*\bcode="PSA"/.test(usx)) return parseUsxBook(usx, 'PSA').subtitles;
  }
  throw new Error('The USX download has no Psalms');
}

/** The verse in the tables' "Genesis 1:1" form as "GEN 1:1". */
function verseKey(name) {
  const m = name.match(/^(.+) (\d+):(\d+)$/);
  const book = m && BOOK_BY_NAME.get(m[1]);
  if (!book) throw new Error(`Unknown verse "${name}" in the translation tables`);
  return `${book} ${Number(m[2])}:${Number(m[3])}`;
}

/**
 * Read the translation tables: Map of "GEN 1:1" -> rows in English order,
 * each { english, number } with number "H7225" / "G26" or null. A verse's
 * name stands on its first row only; the rows after it belong to it too.
 */
export function readTables(tsv) {
  const lines = tsv.replace(/^\uFEFF/, '').split(/\r?\n/);
  const head = lines.shift().split('\t').map(h => h.trim());
  const col = name => {
    const i = head.indexOf(name);
    if (i < 0) throw new Error(`The translation tables have no "${name}" column`);
    return i;
  };
  const [order, verseId, english, hebrew, greek] = ['BSB Sort', 'VerseId', 'BSB version', 'Str Heb', 'Str Grk'].map(col);
  const verses = new Map();
  let key = null;
  for (const line of lines) {
    if (!line) continue;
    const f = line.split('\t');
    if (f[verseId]) key = verseKey(f[verseId]);
    if (!key) throw new Error('The translation tables have a row before the first verse');
    const number = f[hebrew] ? `H${Number(f[hebrew])}` : f[greek] ? `G${Number(f[greek])}` : null;
    if (!verses.has(key)) verses.set(key, []);
    verses.get(key).push({ order: Number(f[order]), english: f[english] ?? '', number });
  }
  for (const rows of verses.values()) rows.sort((a, b) => a.order - b.order);
  return verses;
}

const WORD = /[\p{L}\p{N}]/u;

/**
 * The words of a table's English phrase as the plain text prints them. The
 * tables mark untranslated words "-", the rest of a split phrase ". . .",
 * a placeholder "vvv", supplied words [like this] and implied ones {like
 * this}, and space punctuation apart ("Likewise , every"). Punctuation at
 * either end is not part of the phrase.
 */
export function phraseOf(english) {
  return english
    .replace(/<[^>]*>/g, ' ')
    .replace(/vvv|\. \. \./g, ' ')
    .replace(/[[\]{}]/g, '')
    .replace(/(^|\s)-(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?’”)])/g, '$1')
    .replace(/([“‘(])\s+/g, '$1')
    .replace(/\s*—\s*/g, '—')
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

/**
 * Find each row's phrase in the text, in order: at or after the end of the
 * last phrase found, as whole words. Rows with a Strong's number become
 * [start, end, number]; a phrase not found is skipped and counted.
 */
export function alignPhrases(text, rows) {
  const tags = [];
  let cursor = 0;
  let missed = 0;
  for (const row of rows) {
    const phrase = phraseOf(row.english);
    if (!phrase) continue;
    let at = text.indexOf(phrase, cursor);
    while (at >= 0 && (WORD.test(text[at - 1] ?? '') || WORD.test(text[at + phrase.length] ?? ''))) at = text.indexOf(phrase, at + 1);
    if (at < 0) {
      if (row.number) missed++;
      continue;
    }
    if (row.number) tags.push([at, at + phrase.length, row.number]);
    cursor = at + phrase.length;
  }
  return { tags, missed };
}

/**
 * Convert the plain text (and the USX's Psalm titles) into the app's Bible
 * format, with each verse's Strong's numbers from the translation tables.
 * A Psalm's title and verse 1 are one verse in the tables; phrases in the
 * title are found but not kept, as the title has no tags.
 */
export function convertBsb(txt, titles, tables = new Map()) {
  const text = readPlainText(txt);
  const books = CANON.map(canon => {
    const verses = [];
    const subtitles = {};
    for (const [key, raw] of text) {
      const m = key.match(/^(\w+) (\d+):(\d+)$/);
      if (m[1] !== canon.id || !raw.trim()) continue;
      const chapter = Number(m[2]);
      const verse = Number(m[3]);
      let t = normalizeText(raw);
      if (canon.id === 'PSA' && verse === 1 && titles[chapter]) {
        const split = splitTitle(raw, titles[chapter], key);
        subtitles[chapter] = split.title;
        t = split.text;
      }
      const title = subtitles[chapter] && verse === 1 ? subtitles[chapter] : null;
      const { tags } = alignPhrases(title ? `${title}\n${t}` : t, tables.get(key) ?? []);
      const shift = title ? title.length + 1 : 0;
      const strongs = tags.filter(([start]) => start >= shift).map(([start, end, n]) => [start - shift, end - shift, n]);
      verses.push({ book: canon.id, chapter, verse, text: t, ...(strongs.length ? { strongs } : {}) });
    }
    if (!verses.length) throw new Error(`Source has no book ${canon.id}`);
    const book = { id: canon.id, name: canon.name, testament: canon.testament, chapters: canon.chapters };
    if (Object.keys(subtitles).length) book.subtitles = subtitles;
    book.verses = verses;
    return book;
  });
  return {
    version: {
      id: 'bsb',
      name: 'Berean Standard Bible',
      abbreviation: 'BSB',
      language: 'en',
      releaseDate: '2016',
      copyright: 'Public Domain (CC0, dedicated April 30, 2023)',
      description: 'A modern English translation from the Hebrew and Greek, published by the Berean Bible team.',
      source: { name: 'Berean Bible (bereanbible.com)', url: SOURCE_PAGE },
    },
    books,
  };
}

export const pipeline = {
  id: 'bsb',
  sources: ['bsb', 'bsb-tables'],
  owns: [OUTPUT],
  generate(files) {
    const bsb = files.get('bsb');
    const tables = readTables(files.get('bsb-tables').get(TABLES_FILE).toString('utf8'));
    const bible = convertBsb(bsb.get(TEXT_FILE).toString('utf8'), usxPsalmTitles(readZip(bsb.get(USX_FILE))), tables);
    const verses = bible.books.flatMap(b => b.verses);
    const tagged = verses.reduce((n, v) => n + (v.strongs?.length ?? 0), 0);
    return {
      outputs: new Map([[OUTPUT, bibleFileText(bible)]]),
      summary: `${bible.books.length} books, ${verses.length} verses, ${tagged} phrases with Strong's numbers`,
    };
  },
};

runAsScript(import.meta, pipeline);
