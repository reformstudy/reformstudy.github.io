/**
 * Download the Berean Standard Bible from its publisher and write
 * res/bibles/bsb/bsb.json.
 *
 * Source: the USX download on the publisher's site
 * (https://berean.bible/downloads.htm -> bereanbible.com/bsb_usx.zip). USX is
 * the XML form of USFM. The publisher's USFM download has a stray "vvv" in
 * Genesis 35:18 that its USX and plain-text downloads don't. The BSB
 * has been dedicated to the public domain since April 30, 2023 (berean.bible/terms.htm).
 * The publisher replaces the file in place, so it is pinned by its SHA-256 in
 * provenance/registry.json; a new release stops ingest until it is accepted.
 * This keeps verse text and Psalm titles; section headings, cross-reference
 * lines and footnotes are dropped for now.
 *
 * Usage:
 *   node scripts/ingest/bsb.js                 # download from the publisher
 *   node scripts/ingest/bsb.js --input FILE    # use a saved bsb_usx.zip
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CANON } from '../lib/canon.js';
import { fetchBuffer, parseArgs, writeBibleFile } from '../lib/io.js';
import { parseUsxBook } from '../lib/usx.js';
import { readZip } from '../lib/zip.js';
import { checkLock, sha256 } from '../lib/lock.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(__dirname, '../../res/bibles/bsb/bsb.json');
export const SOURCE_PAGE = 'https://berean.bible/downloads.htm';
export const SOURCE_URL = 'https://bereanbible.com/bsb_usx.zip';

/** Convert the download's 66 USX files into the app's Bible format, finding each book by its <book code>. */
export function convertBsb(files) {
  const byId = new Map();
  for (const [name, data] of files) {
    if (!name.endsWith('.usx')) continue;
    const text = data.toString('utf8').replace(/^\uFEFF/, '');
    const id = text.match(/<book\b[^>]*\bcode="(\w+)"/)?.[1];
    if (id) byId.set(id, text);
  }
  const books = CANON.map(canon => {
    const usx = byId.get(canon.id);
    if (!usx) throw new Error(`Source has no book ${canon.id}`);
    const { verses, subtitles } = parseUsxBook(usx, canon.id);
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

/** Download (or read) the pinned release, check its checksum, and convert it. */
export async function loadBsbSource(args = {}) {
  let zip;
  if (args.input) {
    zip = fs.readFileSync(args.input);
  } else {
    zip = await fetchBuffer(SOURCE_URL);
  }
  checkLock('bsb', { sha256: sha256(zip), files: 1 });
  return convertBsb(readZip(zip));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const bible = await loadBsbSource(args);
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
