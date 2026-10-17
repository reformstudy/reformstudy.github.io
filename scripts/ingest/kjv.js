/**
 * Download the King James Version from eBible.org and write res/bibles/kjv/kjv.json.
 *
 * Source: eBible.org's "eng-kjv" USFM release (https://ebible.org/find/details.php?id=eng-kjv),
 * the 1769 standard text, prepared by eBible.org with the CrossWire Bible
 * Society. Public domain outside the UK. eBible.org updates the file in place,
 * so the download is pinned by its SHA-256 in provenance/registry.json; a new
 * release stops ingest until it is deliberately accepted.
 *
 * The zip also has the Apocrypha; only the 66 books are converted. Psalm
 * titles become chapter subtitles; footnotes, Strong's tags and pilcrows (¶)
 * are dropped; italics (\add) and divine names (\nd LORD) keep their words.
 *
 * Usage:
 *   node scripts/ingest/kjv.js              # convert the committed copy in sources/kjv/
 *   node scripts/ingest/kjv.js --download   # fetch it again from eBible.org first
 */

import { CANON } from '../lib/canon.js';
import { bibleFileText } from '../lib/io.js';
import { runAsScript } from '../lib/pipeline.js';
import { parseUsfmBook } from '../lib/usfm.js';
import { readZip } from '../lib/zip.js';

export const OUTPUT = 'res/bibles/kjv/kjv.json';
export const SOURCE_PAGE = 'https://ebible.org/find/details.php?id=eng-kjv';

/** Convert eBible.org's USFM files (named like "02-GENeng-kjv.usfm") into the app's Bible format. */
export function convertKjv(files) {
  const byId = new Map();
  for (const [name, data] of files) {
    if (!name.endsWith('.usfm')) continue;
    const text = data.toString('utf8').replace(/^﻿/, '');
    const id = text.match(/^\\id\s+(\w+)/m)?.[1];
    if (id) byId.set(id, text);
  }
  const books = CANON.map(canon => {
    const usfm = byId.get(canon.id);
    if (!usfm) throw new Error(`Source has no \\id ${canon.id}`);
    const { verses, subtitles } = parseUsfmBook(usfm, canon.id);
    const book = { id: canon.id, name: canon.name, testament: canon.testament, chapters: canon.chapters };
    if (Object.keys(subtitles).length) book.subtitles = subtitles;
    book.verses = verses;
    return book;
  });
  return {
    version: {
      id: 'kjv',
      name: 'King James Version',
      abbreviation: 'KJV',
      language: 'en',
      releaseDate: '1611',
      copyright: 'Public Domain',
      description: 'The Authorized Version of 1611 in its 1769 standard text, as published by eBible.org with the CrossWire Bible Society.',
      source: { name: 'eBible.org (eng-kjv)', url: SOURCE_PAGE },
    },
    books,
  };
}

export const pipeline = {
  id: 'kjv',
  sources: ['kjv'],
  owns: [OUTPUT],
  generate(files) {
    const bible = convertKjv(readZip(files.get('kjv').get('eng-kjv_usfm.zip')));
    const total = bible.books.reduce((n, b) => n + b.verses.length, 0);
    return { outputs: new Map([[OUTPUT, bibleFileText(bible)]]), summary: `${bible.books.length} books, ${total} verses` };
  },
};

runAsScript(import.meta, pipeline);
