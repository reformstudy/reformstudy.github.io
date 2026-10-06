/**
 * Download John Gill's Exposition of the Entire Bible from the Free Use Bible
 * API and write one file per chapter under res/commentaries/gill/.
 *
 *   res/commentaries/gill/meta.json              commentary details + chapters present
 *   res/commentaries/gill/{BOOK}/introduction.json
 *   res/commentaries/gill/{BOOK}/{chapter}.json
 *
 * Fetching some books adds them to what is already there, so the commentary
 * can be downloaded in parts.
 *
 * Usage:
 *   node scripts/ingest/gill.js --books GEN,PSA,MAT,ROM
 *   node scripts/ingest/gill.js --books all
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CANON, CANON_BY_ID } from '../lib/canon.js';
import { fetchJson, normalizeParagraphs, parseArgs, writeJson } from '../lib/io.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../../res/commentaries/gill');
const API = 'https://bible.helloao.org/api';
const CONCURRENCY = 6;

/** Convert one chapter from the API's simplified commentary format. */
export function convertGillChapter(apiChapter, bookId) {
  const { chapter } = apiChapter;
  const entries = [];
  for (const item of chapter.content) {
    if (item.type !== 'verse') continue;
    const raw = typeof item.text === 'string'
      ? item.text
      : (item.content ?? []).filter(c => typeof c === 'string').join('\n');
    const text = normalizeParagraphs(raw);
    if (text) entries.push({ verse: item.number, text });
  }
  entries.sort((a, b) => a.verse - b.verse);
  const out = { book: bookId, chapter: chapter.number };
  const intro = chapter.introduction ? normalizeParagraphs(chapter.introduction) : '';
  if (intro) out.introduction = intro;
  out.entries = entries;
  return out;
}

async function findCommentaryId(override) {
  if (override) return override;
  const { commentaries } = await fetchJson(`${API}/available_commentaries.json`);
  const match = commentaries.find(c => /gill/i.test(c.id) || /gill/i.test(c.name));
  if (!match) throw new Error(`No Gill commentary in ${API}/available_commentaries.json`);
  return match.id;
}

async function pool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const requested = !args.books || args.books === 'all'
    ? CANON.map(b => b.id)
    : String(args.books).split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  const bad = requested.filter(id => !CANON_BY_ID.has(id));
  if (bad.length) throw new Error(`Unknown book IDs: ${bad.join(', ')}`);

  const id = await findCommentaryId(args['source-id']);
  console.log(`Using commentary "${id}"`);
  const { commentary, books } = await fetchJson(`${API}/c/${id}/books.json`);
  const sourceBooks = new Map(books.map(b => [b.id, b]));

  const metaPath = path.join(OUT_DIR, 'meta.json');
  const meta = fs.existsSync(metaPath)
    ? JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    : { commentary: {}, books: [] };
  meta.commentary = {
    id: 'gill',
    name: "John Gill's Exposition of the Entire Bible",
    author: 'John Gill',
    published: 1746,
    description: 'Verse-by-verse exposition of the whole Bible by the Baptist theologian John Gill, published 1746–1763.',
    source: { name: 'Free Use Bible API', url: `${API}/c/${id}/books.json`, license: commentary.licenseUrl ?? null },
  };
  const metaBooks = new Map(meta.books.map(b => [b.id, b]));

  for (const bookId of requested) {
    const src = sourceBooks.get(bookId);
    if (!src || src.firstChapterNumber == null) {
      console.warn(`  ${bookId}: not in the source, skipped`);
      continue;
    }
    const bookDir = path.join(OUT_DIR, bookId);
    if (src.introduction) {
      writeJson(path.join(bookDir, 'introduction.json'), { book: bookId, text: normalizeParagraphs(src.introduction) });
    }
    const numbers = [];
    for (let n = src.firstChapterNumber; n <= src.lastChapterNumber; n++) numbers.push(n);
    const written = await pool(numbers, CONCURRENCY, async n => {
      const data = await fetchJson(`${API}/c/${id}/${bookId}/${n}.simple.json`);
      const chapter = convertGillChapter(data, bookId);
      if (chapter.entries.length === 0 && !chapter.introduction) return null;
      writeJson(path.join(bookDir, `${n}.json`), chapter);
      return n;
    });
    const chapters = written.filter(n => n !== null);
    metaBooks.set(bookId, { id: bookId, name: CANON_BY_ID.get(bookId).name, chapters, hasIntroduction: Boolean(src.introduction) });
    console.log(`  ${bookId}: ${chapters.length} chapters`);
  }

  meta.books = CANON.filter(c => metaBooks.has(c.id)).map(c => metaBooks.get(c.id));
  writeJson(metaPath, meta);
  console.log(`Wrote ${metaPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
