/**
 * Resource validation
 *
 * Checks every Bible and chaptered commentary under res/ against the canon.
 * Errors stop the build; warnings are printed for review (for example, verses
 * a modern translation leaves out that the KJV has).
 *
 * Usage: node scripts/validate-resources.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CANON, CANON_BY_ID, KJV_VERSE_TOTAL } from './lib/canon.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RES_DIR = path.join(__dirname, '../res');
const SUSPICIOUS = /[<>{}\[\]\u0000-\u001f]/;

const ref = (book, chapter, verse) => `${book} ${chapter}:${verse}`;

/** Verse numbers per chapter: Map("BOOK chapter" -> Set(verse)). */
function verseMap(bible) {
  const map = new Map();
  for (const book of bible.books) {
    for (const v of book.verses) {
      const key = `${book.id} ${v.chapter}`;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key).add(v.verse);
    }
  }
  return map;
}

export function validateBible(bible, id, { reference } = {}) {
  const errors = [];
  const warnings = [];
  const err = m => errors.push(`${id}: ${m}`);
  const warn = m => warnings.push(`${id}: ${m}`);
  const strict = id === 'kjv';

  if (!bible?.version || bible.version.id !== id) err(`version.id should be "${id}"`);
  if (!Array.isArray(bible?.books)) {
    err('books is missing');
    return { errors, warnings };
  }
  if (bible.books.length !== CANON.length) err(`has ${bible.books.length} books, expected ${CANON.length}`);

  let total = 0;
  bible.books.forEach((book, i) => {
    const canon = CANON[i];
    if (!canon || book.id !== canon.id) {
      err(`book ${i + 1} is ${book.id}, expected ${canon?.id ?? 'nothing'}`);
      return;
    }
    if (book.testament !== canon.testament) err(`${book.id} testament is ${book.testament}`);
    if (book.chapters !== canon.chapters) err(`${book.id} has ${book.chapters} chapters, expected ${canon.chapters}`);

    const seen = new Set();
    const chaptersWithVerses = new Set();
    let prev = null;
    for (const v of book.verses) {
      total++;
      const r = ref(book.id, v.chapter, v.verse);
      if (v.book !== book.id) err(`${r} is labelled ${v.book}`);
      if (!Number.isInteger(v.chapter) || v.chapter < 1 || v.chapter > canon.chapters) err(`${r} has an invalid chapter`);
      if (!Number.isInteger(v.verse) || v.verse < 1) err(`${r} has an invalid verse number`);
      if (typeof v.text !== 'string' || !v.text.trim()) err(`${r} has no text`);
      else {
        if (v.text !== v.text.trim() || /\s{2,}/.test(v.text)) err(`${r} has stray whitespace`);
        if (SUSPICIOUS.test(v.text)) warn(`${r} contains markup-like characters: ${v.text.slice(0, 80)}`);
      }
      const key = `${v.chapter}:${v.verse}`;
      if (seen.has(key)) err(`${r} appears twice`);
      seen.add(key);
      if (prev && (v.chapter < prev.chapter || (v.chapter === prev.chapter && v.verse < prev.verse))) {
        err(`${r} is out of order`);
      }
      if (prev && v.chapter === prev.chapter && v.verse > prev.verse + 1) {
        (strict ? err : warn)(`${book.id} ${v.chapter}: verse numbers jump from ${prev.verse} to ${v.verse}`);
      }
      if (v.chapter !== prev?.chapter && v.verse !== 1) {
        (strict ? err : warn)(`${book.id} ${v.chapter} starts at verse ${v.verse}`);
      }
      chaptersWithVerses.add(v.chapter);
      prev = v;
    }
    for (let c = 1; c <= canon.chapters; c++) {
      if (!chaptersWithVerses.has(c)) err(`${book.id} ${c} has no verses`);
    }
  });

  if (strict && total !== KJV_VERSE_TOTAL) err(`has ${total} verses, expected ${KJV_VERSE_TOTAL}`);

  // Compare versification with the KJV so differences are known and handled.
  if (reference && !strict) {
    const mine = verseMap(bible);
    const theirs = verseMap(reference);
    for (const [key, verses] of theirs) {
      const own = mine.get(key) ?? new Set();
      const absent = [...verses].filter(v => !own.has(v));
      if (absent.length) warn(`${key}: no verse ${absent.join(', ')} (present in the KJV)`);
    }
    for (const [key, verses] of mine) {
      const kjv = theirs.get(key) ?? new Set();
      const extra = [...verses].filter(v => !kjv.has(v));
      if (extra.length) warn(`${key}: verse ${extra.join(', ')} is not in the KJV`);
    }
  }

  return { errors, warnings, total };
}

export function validateChapteredCommentary(dir, id, { reference } = {}) {
  const errors = [];
  const warnings = [];
  const err = m => errors.push(`${id}: ${m}`);
  const warn = m => warnings.push(`${id}: ${m}`);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  if (meta.commentary?.id !== id) err(`meta.json commentary.id should be "${id}"`);
  const refVerses = reference ? verseMap(reference) : null;
  let chapters = 0;
  let entries = 0;

  for (const book of meta.books ?? []) {
    const canon = CANON_BY_ID.get(book.id);
    if (!canon) {
      err(`unknown book ${book.id}`);
      continue;
    }
    if (book.hasIntroduction && !fs.existsSync(path.join(dir, book.id, 'introduction.json'))) {
      err(`${book.id} introduction.json is missing`);
    }
    for (const n of book.chapters) {
      if (!Number.isInteger(n) || n < 1 || n > canon.chapters) {
        err(`${book.id} lists chapter ${n}, which doesn't exist`);
        continue;
      }
      const file = path.join(dir, book.id, `${n}.json`);
      if (!fs.existsSync(file)) {
        err(`${book.id} ${n}.json is missing`);
        continue;
      }
      const ch = JSON.parse(fs.readFileSync(file, 'utf8'));
      chapters++;
      if (ch.book !== book.id || ch.chapter !== n) err(`${book.id} ${n}.json is labelled ${ch.book} ${ch.chapter}`);
      const known = refVerses?.get(`${book.id} ${n}`);
      for (const e of ch.entries ?? []) {
        entries++;
        if (!Number.isInteger(e.verse) || e.verse < 1) err(`${ref(book.id, n, e.verse)} has an invalid verse number`);
        if (typeof e.text !== 'string' || !e.text.trim()) err(`${ref(book.id, n, e.verse)} has no text`);
        if (known && !known.has(e.verse)) warn(`${ref(book.id, n, e.verse)} has a note but no KJV verse`);
      }
    }
  }
  return { errors, warnings, chapters, entries };
}

export function validateResources(resDir = DEFAULT_RES_DIR) {
  const errors = [];
  const warnings = [];
  const summary = [];

  const biblesDir = path.join(resDir, 'bibles');
  const bibles = new Map();
  if (fs.existsSync(biblesDir)) {
    for (const ent of fs.readdirSync(biblesDir, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const file = path.join(biblesDir, ent.name, `${ent.name}.json`);
      if (!fs.existsSync(file)) continue;
      try {
        bibles.set(ent.name, JSON.parse(fs.readFileSync(file, 'utf8')));
      } catch (e) {
        errors.push(`${ent.name}: ${file} is not valid JSON (${e.message})`);
      }
    }
  }
  const reference = bibles.get('kjv');
  for (const [id, bible] of bibles) {
    const r = validateBible(bible, id, { reference });
    errors.push(...r.errors);
    warnings.push(...r.warnings);
    summary.push(`${id}: ${r.total ?? 0} verses`);
  }

  const commentariesDir = path.join(resDir, 'commentaries');
  if (fs.existsSync(commentariesDir)) {
    for (const ent of fs.readdirSync(commentariesDir, { withFileTypes: true })) {
      const dir = path.join(commentariesDir, ent.name);
      if (!ent.isDirectory() || !fs.existsSync(path.join(dir, 'meta.json'))) continue;
      try {
        const r = validateChapteredCommentary(dir, ent.name, { reference });
        errors.push(...r.errors);
        warnings.push(...r.warnings);
        summary.push(`${ent.name}: ${r.chapters} chapters, ${r.entries} notes`);
      } catch (e) {
        errors.push(`${ent.name}: ${e.message}`);
      }
    }
  }

  return { errors, warnings, summary };
}

export function printReport({ errors, warnings, summary }) {
  for (const line of summary) console.log(`  ✓ ${line}`);
  if (warnings.length) {
    console.log(`  ${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`    ! ${w}`);
  }
  if (errors.length) {
    console.error(`  ${errors.length} error(s):`);
    for (const e of errors.slice(0, 50)) console.error(`    ✗ ${e}`);
    if (errors.length > 50) console.error(`    … and ${errors.length - 50} more`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Validating resources...');
  const report = validateResources();
  printReport(report);
  process.exit(report.errors.length ? 1 : 0);
}
