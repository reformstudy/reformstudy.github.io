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

/** Convert the plain text (and the USX's Psalm titles) into the app's Bible format. */
export function convertBsb(txt, titles) {
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
      verses.push({ book: canon.id, chapter, verse, text: t });
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
  sources: ['bsb'],
  owns: [OUTPUT],
  generate(files) {
    const bsb = files.get('bsb');
    const bible = convertBsb(bsb.get(TEXT_FILE).toString('utf8'), usxPsalmTitles(readZip(bsb.get(USX_FILE))));
    const total = bible.books.reduce((n, b) => n + b.verses.length, 0);
    return { outputs: new Map([[OUTPUT, bibleFileText(bible)]]), summary: `${bible.books.length} books, ${total} verses` };
  },
};

runAsScript(import.meta, pipeline);
