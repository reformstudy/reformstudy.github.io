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
 *   node scripts/ingest/bsb.js              # convert the committed copy in sources/bsb/
 *   node scripts/ingest/bsb.js --download   # fetch it again from the publisher first
 */

import { CANON } from '../lib/canon.js';
import { bibleFileText } from '../lib/io.js';
import { runAsScript } from '../lib/pipeline.js';
import { parseUsxBook } from '../lib/usx.js';
import { readZip } from '../lib/zip.js';

export const OUTPUT = 'res/bibles/bsb/bsb.json';
export const SOURCE_PAGE = 'https://berean.bible/downloads.htm';

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

export const pipeline = {
  id: 'bsb',
  sources: ['bsb'],
  owns: [OUTPUT],
  generate(files) {
    const bible = convertBsb(readZip(files.get('bsb').get('bsb_usx.zip')));
    const total = bible.books.reduce((n, b) => n + b.verses.length, 0);
    return { outputs: new Map([[OUTPUT, bibleFileText(bible)]]), summary: `${bible.books.length} books, ${total} verses` };
  },
};

runAsScript(import.meta, pipeline);
