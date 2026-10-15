/**
 * Download the King James Version and write res/bibles/kjv/kjv.json.
 *
 * Source: github.com/aruljohn/Bible-kjv (MIT; the KJV text itself is public
 * domain), pinned to a commit so the output is reproducible. Of the KJV copies
 * compared (see res/SOURCES.md) it has the fewest readings of its own and keeps
 * full punctuation, but it has 49 wrong words and spellings and loses the
 * LORD/Lord distinction in about 110 verses. The corrections in
 * provenance/decisions/kjv.json fix those. This source is interim: the KJV is
 * moving to eBible.org (res/SOURCES.md).
 *
 * Usage:
 *   node scripts/ingest/kjv.js                    # download from GitHub
 *   node scripts/ingest/kjv.js --source-dir DIR   # use a local clone
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CANON } from '../lib/canon.js';
import { fetchBuffer, normalizeText, parseArgs, writeBibleFile } from '../lib/io.js';
import { checkLock, digestFiles } from '../lib/lock.js';
import { loadDecisions } from '../lib/decisions.js';
import { applyVerseCorrections } from '../lib/corrections.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(__dirname, '../../res/bibles/kjv/kjv.json');

export const SOURCE_REPO = 'https://github.com/aruljohn/Bible-kjv';
export const SOURCE_COMMIT = 'a9aa4e55afbb3e095f57e4b14cd1f22c5ee8d7c9';
const RAW_BASE = `https://raw.githubusercontent.com/aruljohn/Bible-kjv/${SOURCE_COMMIT}`;

/**
 * Convert the source's per-book files into the app's Bible format.
 * @param {string[]} bookNames names from the source's Books.json, in canon order
 * @param {(name: string) => Promise<any>} loadBook returns the source JSON for one book
 */
export async function convertKjv(bookNames, loadBook) {
  if (bookNames.length !== CANON.length) {
    throw new Error(`Expected ${CANON.length} books in the source, found ${bookNames.length}`);
  }
  const books = [];
  for (let i = 0; i < CANON.length; i++) {
    const canon = CANON[i];
    const src = await loadBook(bookNames[i]);
    const verses = [];
    for (const ch of src.chapters) {
      const chapter = Number(ch.chapter);
      for (const v of ch.verses) {
        verses.push({ book: canon.id, chapter, verse: Number(v.verse), text: normalizeText(v.text) });
      }
    }
    books.push({ id: canon.id, name: canon.name, testament: canon.testament, chapters: canon.chapters, verses });
  }
  return {
    version: {
      id: 'kjv',
      name: 'King James Version',
      abbreviation: 'KJV',
      language: 'en',
      releaseDate: '1611',
      copyright: 'Public Domain',
      description: 'The Authorized Version of 1611 in its standard 1769 text, checked against the Pure Cambridge Edition and other independent copies.',
      source: { name: 'aruljohn/Bible-kjv', url: `${SOURCE_REPO}/tree/${SOURCE_COMMIT}` },
    },
    books,
  };
}

/** Apply verse corrections in order; each `from` must occur exactly once in its verse. */
export const applyKjvCorrections = (bible, corrections) => applyVerseCorrections(bible, corrections, 'KJV');

/** Download (or read) the pinned source, check its checksum, and convert it without corrections. */
export async function loadKjvSource(args = {}) {
  const fileName = name => `${name.replace(/\s+/g, '')}.json`;
  const raw = new Map();
  const load = async name => {
    const data = args['source-dir']
      ? fs.readFileSync(path.join(args['source-dir'], name))
      : await fetchBuffer(`${RAW_BASE}/${encodeURIComponent(name)}`);
    raw.set(name, data);
    return JSON.parse(data.toString('utf8'));
  };

  const bookNames = await load('Books.json');
  const bible = await convertKjv(bookNames, name => load(fileName(name)));
  checkLock('kjv', digestFiles(raw));
  return bible;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const bible = await loadKjvSource(args);
  const { corrections } = loadDecisions('kjv');
  applyKjvCorrections(bible, corrections);
  bible.version.corrections = { count: corrections.length, file: 'provenance/decisions/kjv.json' };
  writeBibleFile(OUTPUT, bible);
  const total = bible.books.reduce((n, b) => n + b.verses.length, 0);
  console.log(`Wrote ${OUTPUT} (${bible.books.length} books, ${total} verses)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
