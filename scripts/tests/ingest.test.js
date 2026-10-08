import test from 'node:test';
import assert from 'node:assert/strict';
import { CANON } from '../lib/canon.js';
import { convertBsb } from '../ingest/bsb.js';
import { convertGillChapter } from '../ingest/gill.js';
import { convertKjv } from '../ingest/kjv.js';
import { validateBible } from '../validate-resources.js';

/** A complete.simple.json-shaped fixture: one verse per chapter, plus overrides. */
function completeFixture(overrides = {}) {
  return {
    translation: { id: 'BSB' },
    books: CANON.map(b => ({
      id: b.id,
      chapters: Array.from({ length: b.chapters }, (_, i) => ({
        chapter: overrides[`${b.id} ${i + 1}`] ?? {
          number: i + 1,
          content: [{ type: 'verse', number: 1, text: `${b.id} ${i + 1}:1`, footnotes: [] }],
          footnotes: [],
        },
      })),
    })),
  };
}

test('convertBsb keeps verses and Psalm titles, drops headings, flattens poetry', () => {
  const bible = convertBsb(completeFixture({
    'GEN 1': {
      number: 1,
      content: [
        { type: 'heading', text: 'The Creation' },
        { type: 'line_break' },
        { type: 'verse', number: 1, text: 'In the beginning God created the heavens and the earth.', footnotes: [] },
        { type: 'verse', number: 2, text: 'Line one\nline two', footnotes: [] },
        { type: 'verse', number: 3, text: 'And God said,', footnotes: [] },
        { type: 'heading', text: 'Mid-verse heading' },
        { type: 'verse', number: 3, text: '“Let there be light.”', footnotes: [] },
      ],
      footnotes: [],
    },
    'PSA 3': {
      number: 3,
      content: [
        { type: 'hebrew_subtitle', text: 'A Psalm of David, when he fled from his son Absalom.', footnotes: [] },
        { type: 'verse', number: 1, text: 'O LORD, how my foes have increased!', footnotes: [] },
      ],
      footnotes: [],
    },
  }));

  assert.equal(bible.version.id, 'bsb');
  assert.equal(bible.books.length, 66);
  const gen = bible.books[0];
  assert.deepEqual(gen.verses.slice(0, 3).map(v => v.text), [
    'In the beginning God created the heavens and the earth.',
    'Line one line two',
    'And God said, “Let there be light.”',
  ]);
  const psa = bible.books.find(b => b.id === 'PSA');
  assert.equal(psa.subtitles['3'], 'A Psalm of David, when he fled from his son Absalom.');
  assert.equal(gen.subtitles, undefined);
});

test('convertBsb rejects a source missing a book', () => {
  const fixture = completeFixture();
  fixture.books = fixture.books.filter(b => b.id !== 'OBA');
  assert.throws(() => convertBsb(fixture), /missing books: OBA/);
});

test('convertGillChapter reads simplified and structured verse content', () => {
  const chapter = convertGillChapter({
    chapter: {
      number: 1,
      introduction: '  INTRODUCTION TO MATTHEW 1  ',
      content: [
        { type: 'verse', number: 2, text: 'Abraham begat Isaac,.... \n\n  Second paragraph. ' },
        { type: 'verse', number: 1, content: ['The book of the generation,....', 'More.'] },
        { type: 'verse', number: 3, text: '   ' },
      ],
    },
  }, 'MAT');
  assert.deepEqual(chapter, {
    book: 'MAT',
    chapter: 1,
    introduction: 'INTRODUCTION TO MATTHEW 1',
    entries: [
      { verse: 1, text: 'The book of the generation,....\nMore.' },
      { verse: 2, text: 'Abraham begat Isaac,....\nSecond paragraph.' },
    ],
  });
});

test('convertKjv maps source books onto canon IDs in order', async () => {
  const names = CANON.map(b => `Source ${b.name}`);
  const bible = await convertKjv(names, async name => ({
    chapters: [{ chapter: '1', verses: [{ verse: '1', text: ` ${name}  text ` }] }],
  }));
  assert.equal(bible.books[21].id, 'SNG');
  assert.deepEqual(bible.books[0].verses[0], { book: 'GEN', chapter: 1, verse: 1, text: 'Source Genesis text' });
});

/** A small valid Bible: every chapter has verses 1–3. */
function syntheticBible(id) {
  return {
    version: { id },
    books: CANON.map(b => ({
      id: b.id, name: b.name, testament: b.testament, chapters: b.chapters,
      verses: Array.from({ length: b.chapters }, (_, c) => [1, 2, 3].map(v => ({
        book: b.id, chapter: c + 1, verse: v, text: `Verse ${v}.`,
      }))).flat(),
    })),
  };
}

test('validateBible passes a well-formed translation', () => {
  const r = validateBible(syntheticBible('web'), 'web');
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test('validateBible reports missing chapters, duplicates and stray whitespace as errors', () => {
  const bible = syntheticBible('web');
  const oba = bible.books.find(b => b.id === 'OBA');
  oba.verses = [];
  const gen = bible.books[0];
  gen.verses.splice(1, 0, { ...gen.verses[0] });
  gen.verses[5].text = ' padded ';
  const r = validateBible(bible, 'web');
  assert.ok(r.errors.some(e => e.includes('OBA 1 has no verses')));
  assert.ok(r.errors.some(e => e.includes('GEN 1:1 appears twice')));
  assert.ok(r.errors.some(e => e.includes('stray whitespace')));
});

test('validateBible warns about verses the KJV has and a translation omits', () => {
  const kjv = syntheticBible('kjv');
  const bsb = syntheticBible('bsb');
  const act = bsb.books.find(b => b.id === 'ACT');
  act.verses = act.verses.filter(v => !(v.chapter === 8 && v.verse === 2));
  const r = validateBible(bsb, 'bsb', { reference: kjv });
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some(w => w.includes('ACT 8: verse numbers jump from 1 to 3')));
  assert.ok(r.warnings.some(w => w.includes('ACT 8: no verse 2 (present in the KJV)')));
});

test('validateBible holds the KJV to a gap-free 31,102 verses', () => {
  const r = validateBible(syntheticBible('kjv'), 'kjv');
  assert.ok(r.errors.some(e => e.includes('expected 31102')));
});
