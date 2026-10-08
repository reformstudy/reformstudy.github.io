/**
 * Download the Berean Standard Bible and write res/bibles/bsb/bsb.json.
 *
 * Source: the Free Use Bible API's complete download in its simplified format
 * (one string per verse). The BSB has been public domain (CC0) since
 * April 30, 2023. This keeps verse text and Psalm titles; section headings
 * and footnotes are dropped for now.
 *
 * Usage:
 *   node scripts/ingest/bsb.js                 # download from the API
 *   node scripts/ingest/bsb.js --input FILE    # use a saved complete.simple.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CANON, CANON_BY_ID } from '../lib/canon.js';
import { fetchJson, normalizeText, parseArgs, writeBibleFile } from '../lib/io.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(__dirname, '../../res/bibles/bsb/bsb.json');
export const SOURCE_URL = 'https://bible.helloao.org/api/BSB/complete.simple.json';

/** Convert the API's complete.simple.json into the app's Bible format. */
export function convertBsb(complete) {
  const byId = new Map(complete.books.map(b => [b.id, b]));
  const missing = CANON.filter(c => !byId.has(c.id)).map(c => c.id);
  if (missing.length) throw new Error(`Source is missing books: ${missing.join(', ')}`);
  const unknown = complete.books.filter(b => !CANON_BY_ID.has(b.id)).map(b => b.id);
  if (unknown.length) throw new Error(`Source has books outside the canon: ${unknown.join(', ')}`);

  const books = CANON.map(canon => {
    const src = byId.get(canon.id);
    const verses = [];
    const subtitles = {};
    for (const { chapter } of src.chapters) {
      const seen = new Map();
      for (const item of chapter.content) {
        if (item.type === 'verse') {
          const text = normalizeText(item.text);
          if (!text) continue;
          // A verse split around a heading can arrive in two pieces; join them.
          if (seen.has(item.number)) {
            const v = seen.get(item.number);
            v.text = `${v.text} ${text}`;
          } else {
            const v = { book: canon.id, chapter: chapter.number, verse: item.number, text };
            seen.set(item.number, v);
            verses.push(v);
          }
        } else if (item.type === 'hebrew_subtitle') {
          const text = normalizeText(item.text);
          if (text) subtitles[chapter.number] = subtitles[chapter.number] ? `${subtitles[chapter.number]} ${text}` : text;
        }
      }
    }
    verses.sort((a, b) => a.chapter - b.chapter || a.verse - b.verse);
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
      source: { name: 'Free Use Bible API', url: SOURCE_URL },
    },
    books,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const complete = args.input
    ? JSON.parse(fs.readFileSync(args.input, 'utf8'))
    : await fetchJson(SOURCE_URL);
  const bible = convertBsb(complete);
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
