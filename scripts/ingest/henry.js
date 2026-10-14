/**
 * Download Matthew Henry's Commentary on the Whole Bible (1708–1710) and write
 * one file per chapter under res/commentaries/henry/.
 *
 *   res/commentaries/henry/meta.json                commentary details + chapters present
 *   res/commentaries/henry/{BOOK}/introduction.json Henry's introduction to the book
 *   res/commentaries/henry/{BOOK}/{chapter}.json    chapter introduction + passage sections
 *
 * Henry comments on passages, not single verses: each section covers a verse
 * range (`start`–`end`), and every verse of the Bible falls in a section.
 *
 * Source: github.com/samueldotj/bible-commentaries (en/henry), pinned to a
 * commit. It is extracted from CrossWire's SWORD module "MHC" (public domain,
 * prepared from the Christian Classics Ethereal Library text), with the KJV
 * passage text the module repeats removed. Long paragraphs there are cut at
 * sentence ends into pieces of about 700 characters.
 *
 * Usage:
 *   node scripts/ingest/henry.js                    # download every book
 *   node scripts/ingest/henry.js --books ROM,JHN    # some books
 *   node scripts/ingest/henry.js --source-dir DIR   # a local clone's en/henry
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CANON, CANON_BY_ID } from '../lib/canon.js';
import { fetchBuffer, parseArgs, writeJson } from '../lib/io.js';
import { checkLock, digestFiles } from '../lib/lock.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../../res/commentaries/henry');
export const SOURCE_REPO = 'https://github.com/samueldotj/bible-commentaries';
export const SOURCE_COMMIT = '23f2279a8a56f212aca0de7ef3fbe47cf7334a45';
const RAW_BASE = `https://raw.githubusercontent.com/samueldotj/bible-commentaries/${SOURCE_COMMIT}/en/henry`;
const CONCURRENCY = 8;

function paragraphs(unit) {
  return unit.paragraphs
    .map(p => {
      const out = { text: String(p.text).trim() };
      if (p.heading) out.heading = true;
      if (p.refs?.length) out.refs = p.refs.map(r => ({ text: r.text, ref: r.ref }));
      return out;
    })
    .filter(p => p.text);
}

/** "ROM.8.1-9" -> { start: 1, end: 9 }; "ROM.8.16" -> { start: 16, end: 16 }. */
export function passageRange(range, bookId, chapter) {
  const m = String(range).match(/^([1-3A-Z]{3})\.(\d+)\.(\d+)(?:-(\d+))?$/);
  if (!m || m[1] !== bookId || Number(m[2]) !== chapter) {
    throw new Error(`${bookId} ${chapter}: unexpected passage range "${range}"`);
  }
  const start = Number(m[3]);
  return { start, end: m[4] ? Number(m[4]) : start };
}

/** Convert one chapter file from the source into the app's format. */
export function convertHenryChapter(src, bookId, chapter) {
  if (src.book !== bookId || src.chapter !== chapter) {
    throw new Error(`Expected ${bookId} ${chapter}, got ${src.book} ${src.chapter}`);
  }
  const out = { book: bookId, chapter };
  const intro = [];
  const sections = [];
  for (const unit of src.units) {
    if (unit.kind === 'chapter') {
      intro.push(...paragraphs(unit));
    } else if (unit.kind === 'passage') {
      const section = passageRange(unit.range, bookId, chapter);
      if (unit.title) section.title = unit.title.trim();
      section.paragraphs = paragraphs(unit);
      sections.push(section);
    } else {
      throw new Error(`${bookId} ${chapter}: unexpected ${unit.kind} unit "${unit.range}"`);
    }
  }
  if (intro.length) out.introduction = intro;
  out.sections = sections.sort((a, b) => a.start - b.start || a.end - b.end);
  return out;
}

/** Convert a book's intro.json (book-level units) into the app's format. */
export function convertHenryIntroduction(src, bookId) {
  const paras = src.units.filter(u => u.kind === 'book').flatMap(paragraphs);
  return paras.length ? { book: bookId, paragraphs: paras } : null;
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

  const raw = new Map();
  const load = async rel => {
    let data;
    if (args['source-dir']) {
      const file = path.join(args['source-dir'], rel);
      data = fs.existsSync(file) ? fs.readFileSync(file) : null;
    } else {
      data = await fetchBuffer(`${RAW_BASE}/${rel}`, { allowMissing: true });
    }
    raw.set(rel, data);
    return data === null ? null : JSON.parse(data.toString('utf8'));
  };

  const metaPath = path.join(OUT_DIR, 'meta.json');
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : { books: [] };
  meta.commentary = {
    id: 'henry',
    name: "Matthew Henry's Commentary on the Whole Bible",
    author: 'Matthew Henry',
    published: 1710,
    description: 'Exposition of the whole Bible by the English Presbyterian minister Matthew Henry, published 1708–1710 and completed by his colleagues after his death. Henry comments passage by passage.',
    source: {
      name: 'samueldotj/bible-commentaries (from CrossWire SWORD "MHC")',
      url: `${SOURCE_REPO}/tree/${SOURCE_COMMIT}/en/henry`,
      license: 'Public domain',
    },
  };
  const metaBooks = new Map(meta.books.map(b => [b.id, b]));

  for (const bookId of requested) {
    const canon = CANON_BY_ID.get(bookId);
    const bookDir = path.join(OUT_DIR, bookId);
    fs.rmSync(bookDir, { recursive: true, force: true });

    const introSrc = await load(`${bookId}/intro.json`);
    const intro = introSrc ? convertHenryIntroduction(introSrc, bookId) : null;
    if (intro) writeJson(path.join(bookDir, 'introduction.json'), intro);

    const numbers = Array.from({ length: canon.chapters }, (_, i) => i + 1);
    const written = await pool(numbers, CONCURRENCY, async n => {
      const src = await load(`${bookId}/${n}.json`);
      if (!src) return null;
      writeJson(path.join(bookDir, `${n}.json`), convertHenryChapter(src, bookId, n));
      return n;
    });
    const chapters = written.filter(n => n !== null);
    metaBooks.set(bookId, { id: bookId, name: canon.name, chapters, hasIntroduction: Boolean(intro) });
    console.log(`  ${bookId}: ${chapters.length}/${canon.chapters} chapters${intro ? ', introduction' : ''}`);
  }

  // The checksum covers every file, so only a full run (all books) can be checked.
  if (requested.length === CANON.length) {
    checkLock('henry', { source: `${SOURCE_REPO}@${SOURCE_COMMIT}/en/henry`, ...digestFiles(raw) });
  } else {
    console.warn('  Partial download: source checksums are only verified when every book is downloaded.');
  }

  meta.books = CANON.filter(c => metaBooks.has(c.id)).map(c => metaBooks.get(c.id));
  writeJson(metaPath, { commentary: meta.commentary, books: meta.books });
  console.log(`Wrote ${metaPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
