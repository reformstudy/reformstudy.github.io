/**
 * Download the King James Version and write res/bibles/kjv/kjv.json.
 *
 * Source: github.com/aruljohn/Bible-kjv (MIT; the KJV text itself is public
 * domain), pinned to a commit so the output is reproducible. That source keeps
 * the standard 1769 punctuation and prints LORD in capitals, and has no
 * markup to strip.
 *
 * Usage:
 *   node scripts/ingest/kjv.js                    # download from GitHub
 *   node scripts/ingest/kjv.js --source-dir DIR   # use a local clone
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CANON } from '../lib/canon.js';
import { fetchJson, normalizeText, parseArgs, writeBibleFile } from '../lib/io.js';

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
      description: 'The Authorized Version of 1611, in the standard 1769 Oxford text. The translation John Gill quotes throughout his commentary.',
      source: { name: 'aruljohn/Bible-kjv', url: `${SOURCE_REPO}/tree/${SOURCE_COMMIT}` },
    },
    books,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fileName = name => `${name.replace(/\s+/g, '')}.json`;
  const load = args['source-dir']
    ? async name => JSON.parse(fs.readFileSync(path.join(args['source-dir'], name), 'utf8'))
    : async name => fetchJson(`${RAW_BASE}/${encodeURIComponent(name)}`);

  const bookNames = await load('Books.json');
  const bible = await convertKjv(bookNames, name => load(fileName(name)));
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
