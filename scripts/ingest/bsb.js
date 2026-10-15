/**
 * Download the Berean Standard Bible and write res/bibles/bsb/bsb.json.
 *
 * Source: the publisher's own USFM release (github.com/BSB-publishing/bsb2usfm),
 * pinned to a version. The BSB has been public domain (CC0) since
 * April 30, 2023. This keeps verse text and Psalm titles; section headings,
 * cross-reference lines and footnotes are dropped for now.
 *
 * Usage:
 *   node scripts/ingest/bsb.js                 # download the release ZIP
 *   node scripts/ingest/bsb.js --input FILE    # use a saved BSB_usfm.zip
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CANON } from '../lib/canon.js';
import { normalizeText, parseArgs, writeBibleFile } from '../lib/io.js';
import { readZip } from '../lib/zip.js';
import { checkLock, sha256 } from '../lib/lock.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(__dirname, '../../res/bibles/bsb/bsb.json');
export const SOURCE_VERSION = 'v5.16';
export const SOURCE_URL = `https://github.com/BSB-publishing/bsb2usfm/releases/download/${SOURCE_VERSION}/BSB_usfm.zip`;

// Paragraph markers whose whole line is not verse text: identification,
// titles, section headings, cross-reference lines, acrostic letters, blank lines.
const SKIP = new Set(['id', 'ide', 'h', 'toc1', 'toc2', 'toc3', 'mt', 'mt1', 'mt2', 'mt3', 'ms', 'ms1', 'mr',
  's', 's1', 's2', 's3', 'r', 'sr', 'qa', 'sp', 'cl', 'rem', 'b']);

/** Strip USFM character markup, keeping the words a reader sees. */
export function cleanInline(text) {
  return normalizeText(String(text)
    .replace(/\\f\s.*?\\f\*/g, ' ')                 // footnotes
    .replace(/\\fe\s.*?\\fe\*/g, ' ')               // endnotes
    .replace(/\\x\s.*?\\x\*/g, ' ')                 // cross-references
    .replace(/\\\+?ref\s+([^|\\]*?)(\|[^\\]*)?\\\+?ref\*/g, '$1')  // \ref shown|target\ref*
    .replace(/\\\+?[a-z]+\d*\*/g, '')               // closers (\add*): nothing, so "forty-\add*two" stays one word
    .replace(/\\\+?[a-z]+\d*/g, ' ')                // openers (\add, \wj, \nd)
  ).replace(/\s+([,.;:!?’”)])/g, '$1').replace(/([“‘(])\s+/g, '$1');
}

/**
 * Parse one USFM book into verses and Psalm titles.
 * Psalm titles sit in \d lines that also open verse 1; their text becomes the
 * chapter's subtitle so verse 1 starts where the KJV's does. In other books
 * (Habakkuk 3, Zechariah 12) \d text is part of the verse, as in the KJV.
 */
export function parseUsfmBook(usfm, bookId) {
  const verses = new Map();
  const subtitles = {};
  let chapter = 0;
  let verse = null;
  let para = null;

  const append = (target, text) => {
    const clean = cleanInline(text);
    if (!clean) return;
    if (target === 'title') {
      subtitles[chapter] = subtitles[chapter] ? `${subtitles[chapter]} ${clean}` : clean;
      return;
    }
    if (verse === null) throw new Error(`${bookId} ${chapter}: text before the first verse: "${clean.slice(0, 60)}"`);
    const v = verses.get(`${chapter}:${verse}`);
    v.text = v.text ? `${v.text} ${clean}` : clean;
  };

  for (const rawLine of usfm.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    let rest = line;
    const m = line.match(/^\\([a-z]+\d*)\s?(.*)$/);
    if (m) {
      if (m[1] === 'c') {
        chapter = parseInt(m[2], 10);
        verse = null;
        para = null;
        continue;
      }
      if (m[1] !== 'v') {
        para = m[1];
        rest = m[2];
      }
    }
    if (para && SKIP.has(para)) continue;

    const titleLine = para === 'd' && bookId === 'PSA';
    // The book divisions in Psalms ("Psalms 1–41") are labels, not titles.
    if (titleLine && /^Psalms \d+–\d+$/.test(cleanInline(rest))) continue;

    const pieces = rest.split(/\\v\s+(\d+)\s*/);
    append(titleLine ? 'title' : 'verse', pieces[0]);
    for (let i = 1; i < pieces.length; i += 2) {
      verse = parseInt(pieces[i], 10);
      const key = `${chapter}:${verse}`;
      if (verses.has(key)) throw new Error(`${bookId} ${key} appears twice`);
      verses.set(key, { book: bookId, chapter, verse, text: '' });
      append(titleLine ? 'title' : 'verse', pieces[i + 1]);
    }
  }

  const list = [...verses.values()].sort((a, b) => a.chapter - b.chapter || a.verse - b.verse);
  return { verses: list, subtitles };
}

/** Convert the release's 66 USFM files ({BOOK}.usfm) into the app's Bible format. */
export function convertBsb(files) {
  const books = CANON.map(canon => {
    const usfm = files.get(`${canon.id}.usfm`);
    if (!usfm) throw new Error(`Source is missing ${canon.id}.usfm`);
    const { verses, subtitles } = parseUsfmBook(usfm.toString('utf8').replace(/^﻿/, ''), canon.id);
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
      source: { name: `BSB-publishing/bsb2usfm ${SOURCE_VERSION}`, url: SOURCE_URL },
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
    const res = await fetch(SOURCE_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${SOURCE_URL}`);
    zip = Buffer.from(await res.arrayBuffer());
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
