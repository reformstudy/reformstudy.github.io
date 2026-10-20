/**
 * Tests for authentication (scripts/authenticate/): the comparison rule,
 * each source reader, and, for every resource, tampering tests that show a
 * changed letter, a lost or added word, a moved word, a joined or split word,
 * a dropped unit, a stray unit and a wrong derived field are each caught.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { compareText, EXCEPTIONS, wordStream } from '../authenticate/compare.js';
import { readUsfmBook, readUsxBook } from '../authenticate/bible-sources.js';
import { authenticateBible, authenticatePsalmTitles, authenticateWordTags, readPlainTextBible, strongsNumber } from '../authenticate/bibles.js';
import { CANON } from '../lib/canon.js';
import { convertBsb, readTables } from '../ingest/bsb.js';
import { authenticateCommentary, fromRoman, rangesFor, readTree, readVolume } from '../authenticate/commentaries.js';
import { authenticateConfession } from '../authenticate/confessions.js';
import { authenticateLexicon, definitionSource, partOfSpeechFor, readLexicon } from '../authenticate/lexicons.js';
import { compactOf, displayOf, readOsis } from '../authenticate/refs.js';
import { authenticateSite } from '../authenticate/site.js';
import { authenticateTableTags, expectedTags, readTables as readTablesForCheck, tablePhrase } from '../authenticate/tables.js';
import { decodeXml, Units, xmlTokens } from '../authenticate/units.js';
import { authenticate, printReport } from '../authenticate/index.js';
import { compareOutputs, filesUnder, writeOutputs } from '../lib/pipeline.js';
import { downloadSource, readStoredSource, sourceChecksum, storedName, storeSource } from '../lib/sources.js';
import { sha256 } from '../lib/lock.js';
import { compactRef, displayRef, parseOsisRef } from '../lib/refs.js';
import { parseUsfmBook } from '../lib/usfm.js';
import { parseUsxBook } from '../lib/usx.js';
import { henryOutputs } from '../ingest/henry.js';
import { convertLexicon, parseLexicon, partOfSpeech } from '../ingest/strongs.js';
import { convertWcf } from '../ingest/wcf.js';
import { BSB_TABLES, bsbPlainText, CREEDS, GEN_USFM, GREEK, HENRY_THML, LEXICON_TSV, MINI_KJV, PSA_USFM, PSA_USX, USX_PSALM_TITLES } from './fixtures.js';

const clone = x => JSON.parse(JSON.stringify(x));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rs-auth-'));

// ---- the comparison rule ----

test('compareText accepts the source text with only whitespace normalized', () => {
  assert.equal(compareText('In  the\nbeginning ', 'In the beginning'), null);
  assert.equal(compareText('', ''), null);
  assert.deepEqual(wordStream(' a  b\nc '), { chars: 'abc', breaks: new Set([1, 2]) });
});

test('compareText catches every kind of change to the words', () => {
  const src = 'And God said, Let there be light: and there was light.';
  assert.match(compareText(src, 'And God said, Let there be lihgt: and there was light.'), /text differs/);
  assert.match(compareText(src, 'And God said, Let there be light: and there was light. Amen'), /extra text/);
  assert.match(compareText(src, 'And God said, Let there be light: and there was'), /text missing/);
  assert.match(compareText(src, 'And God said, Let there be light and there was light.'), /text differs/, 'punctuation counts');
  assert.match(compareText(src, 'And GOD said, Let there be light: and there was light.'), /text differs/, 'case counts');
  assert.match(compareText(src, 'And God said, Letthere be light: and there was light.'), /words are joined/);
  assert.match(compareText(src, 'And God sa id, Let there be light: and there was light.'), /a word is split/);
  assert.match(compareText(src, 'And God said, Let there be light : and there was light.'), /a word is split/);
});

test('exceptions apply only when named, and only to what they describe', () => {
  assert.match(compareText('light ; and', 'light; and'), /words are joined/);
  assert.equal(compareText('light ; and', 'light; and', ['punctuation spacing']), null);
  assert.equal(compareText('“ Behold', '“Behold', ['punctuation spacing']), null);
  assert.match(compareText('light and', 'lightand', ['punctuation spacing']), /words are joined/);
  assert.match(compareText('¶ And it came', 'And it came'), /text missing|text differs/);
  assert.equal(compareText('¶ And it came', 'And it came', ['pilcrow']), null);
  assert.equal(compareText('a__b', 'a b', ['STEPBible indentation']), null);
  assert.throws(() => compareText('a', 'a', ['spelling']), /Unknown exception "spelling"/);
  for (const e of Object.values(EXCEPTIONS)) assert.ok(e.description.length > 20);
});

// ---- reading sources ----

test('xmlTokens and decodeXml read markup, text and character references', () => {
  const tokens = [...xmlTokens('<?xml version="1.0"?><!-- c --><a x="1 &amp; 2"><b/>A &#8212; &lt;B&gt;<![CDATA[<raw>]]></a>')];
  assert.deepEqual(tokens.map(t => t.type), ['open', 'empty', 'text', 'text', 'close']);
  assert.equal(tokens[0].attrs.x, '1 & 2');
  assert.equal(tokens[2].text, 'A — <B>');
  assert.equal(tokens[3].text, '<raw>');
  assert.throws(() => [...xmlTokens('a < b')], /Unreadable markup/);
  assert.equal(decodeXml('&quot;&apos;&nbsp;&#x41;&unknown;'), '"\'\u00a0A&unknown;');
});

test('readUsfmBook: verse text by verse; headings, notes and Strong\'s tags left out by name', () => {
  const u = readUsfmBook(GEN_USFM, 'GEN');
  assert.deepEqual([...u.units.keys()], ['GEN 1:1', 'GEN 1:2', 'GEN 2:1']);
  assert.equal(compareText(u.units.get('GEN 1:1'), 'In the beginning God created the heaven.'), null);
  assert.equal(compareText(u.units.get('GEN 1:2'), 'And the LORD said, Let there be light;', ['pilcrow', 'punctuation spacing']), null);
  assert.deepEqual(Object.fromEntries(u.excluded), {
    'book identification': 7, 'running head': 7, 'table of contents': 19, 'book title': 7,
    'section heading': 11, 'word attributes (markup)': 27, footnotes: 10,
  });
  const psa = readUsfmBook(PSA_USFM, 'PSA');
  assert.equal(psa.units.get('PSA 3:title').trim(), 'A Psalm of David.');
  assert.equal(compareText(psa.units.get('PSA 3:1'), 'LORD, how are they increased that trouble me!'), null);
  assert.equal(psa.excluded.get('Psalms book division label'), 10);
});

test('readUsfmBook stops on anything it cannot place', () => {
  assert.throws(() => readUsfmBook('\\id GEN\n\\c 1\n\\zz odd', 'GEN'), /unknown USFM marker \\zz/);
  assert.throws(() => readUsfmBook('\\id GEN\n\\c 1\n\\p Stray words', 'GEN'), /verse text before the first verse/);
  assert.throws(() => readUsfmBook('\\id GEN\n\\c 1\n\\qq1 Odd', 'GEN'), /unknown USFM marker/);
  assert.throws(() => readUsfmBook('\\id GEN\n\\c x', 'GEN'), /\\c without a number/);
  assert.throws(() => readUsfmBook('\\id GEN\n\\c 1\n\\p \\v 1 A\n\\v 1 B', 'GEN'), /GEN 1:1 appears twice/);
  assert.throws(() => readUsfmBook('Loose text', 'GEN'), /text outside any paragraph/);
});

test('readUsxBook: verses, the Psalm title, and what is left out', () => {
  const u = readUsxBook(PSA_USX, 'PSA');
  assert.equal(compareText(u.units.get('PSA 3:title'), 'A Psalm of David, when he fled from his son Absalom.'), null);
  assert.equal(compareText(u.units.get('PSA 3:1'), 'O LORD, how my foes have increased! How many rise up against me!'), null);
  assert.equal(compareText(u.units.get('PSA 3:2'), 'Many say of me, “God will not deliver him.” Selah'), null);
  assert.ok(u.excluded.get('footnotes') && u.excluded.get('section heading') && u.excluded.get('cross-reference line'));
  assert.throws(() => readUsxBook('<usx><foo/></usx>', 'PSA'), /unknown USX element <foo>/);
  assert.throws(() => readUsxBook('<usx><para style="zz">x</para></usx>', 'PSA'), /unknown paragraph style "zz"/);
  assert.throws(() => readUsxBook('<usx><para style="p"><char style="zz">x</char></para></usx>', 'PSA'), /unknown character style "zz"/);
  assert.throws(() => readUsxBook('<usx><para style="p"></char></usx>', 'PSA'), /closes <para>/);
  assert.throws(() => readUsxBook('<usx>loose</usx>', 'PSA'), /text outside any paragraph/);
});

// ---- Bibles: tampering ----

function bibleFrom(text, id, parse) {
  const { verses, subtitles } = parse(text, id);
  const book = { id, verses };
  if (Object.keys(subtitles).length) book.subtitles = subtitles;
  return { books: [book] };
}

test('a converted Bible passes; every kind of tampering is caught', () => {
  const source = { units: readUsfmBook(GEN_USFM, 'GEN'), books: new Set(['GEN']) };
  const good = bibleFrom(GEN_USFM, 'GEN', parseUsfmBook);
  const ex = ['pilcrow', 'punctuation spacing'];
  assert.deepEqual(authenticateBible(good, source, ex), { problems: [], verses: 3, titles: 0, empty: 0 });
  assert.match(authenticateBible(good, source, ['punctuation spacing']).problems[0], /GEN 1:2: text differs/, 'without the pilcrow exception');

  const tamper = (fn) => { const b = clone(good); fn(b.books[0].verses); return authenticateBible(b, source, ex).problems; };
  assert.match(tamper(v => { v[0].text = v[0].text.replace('created', 'made'); })[0], /GEN 1:1: text differs/);
  assert.match(tamper(v => { v[0].text = v[0].text.replace('LORD', 'Lord'); v[1].text = v[1].text.replace('LORD', 'Lord'); })[0], /GEN 1:2: text differs/);
  assert.match(tamper(v => { v[0].text += ' A note.'; })[0], /extra text/, 'footnote text leaking in');
  assert.match(tamper(v => { v[0].text = v[0].text.replace('In ', 'In|strong="H7225" '); })[0], /text differs/, "Strong's tags leaking in");
  const moved = tamper(v => { v[0].text = v[0].text.replace(' heaven.', ''); v[1].text = `heaven. ${v[1].text}`; });
  assert.equal(moved.length, 2, 'a word moved to the next verse fails both');
  assert.match(tamper(v => { v[0].text = v[0].text.replace('the beginning', 'thebeginning'); })[0], /words are joined/);
  assert.match(tamper(v => { v[0].text = v[0].text.replace('created', 'cre ated'); })[0], /a word is split/);
  assert.match(tamper(v => { v.pop(); })[0], /GEN 2:1: in the source but not in the output/);
  assert.match(tamper(v => { v.push({ book: 'GEN', chapter: 2, verse: 2, text: 'Added.' }); })[0], /GEN 2:2: not in the source/);
  assert.match(tamper(v => { v[2].book = 'EXO'; })[0], /filed under EXO/);

  const extraBook = clone(good);
  extraBook.books.push({ id: 'EXO', verses: [] });
  assert.match(authenticateBible(extraBook, source, ex).problems[0], /EXO: not in the source/);
  assert.match(authenticateBible({ books: [] }, source, ex).problems[0], /GEN: in the source but not in the output/);
});

test("Strong's word tags: each verse's tagged words and numbers are the source's; tampering is caught", () => {
  const usfm = [
    '\\id GEN Test', '\\c 1', '\\p',
    '\\v 1 \\w In|strong="H7225"\\w* \\w the beginning|strong="H0430"\\w* God created.',
    '\\v 2 And \\w who|strong="G3739"\\w*\\w soever|strong="G0302"\\w* \\nd \\+w LORD|strong="H3068"\\+w*\\nd* said.',
    '\\v 3 No tags here.',
  ].join('\n');
  const units = readUsfmBook(usfm, 'GEN');
  assert.equal(compareText(units.units.get('GEN 1:2'), 'And whosoever LORD said.'), null, 'the space after a marker is markup');
  const good = bibleFrom(usfm, 'GEN', (t, id) => parseUsfmBook(t, id, { strongs: true }));
  assert.deepEqual(authenticateWordTags(good, units, []), { problems: [], words: 5, untagged: 0 });

  const tamper = fn => { const b = clone(good); fn(b.books[0].verses); return authenticateWordTags(b, units, []).problems; };
  assert.match(tamper(v => { v[0].strongs[1][2] = 'H431'; })[0], /GEN 1:1, word 2: H431, the source has H430/);
  assert.match(tamper(v => { v[0].strongs[1][0] += 1; })[0], /not the tagged word "the beginning"/);
  assert.ok(tamper(v => { v[1].strongs.reverse(); }).some(p => /word 2: offsets .* out of order/.test(p)));
  assert.match(tamper(v => { v[0].strongs[0] = [0, 99, 'H7225']; })[0], /outside the verse/);
  assert.match(tamper(v => { v[0].strongs[0] = [1, 1, 'H7225']; })[0], /out of order/);
  assert.match(tamper(v => { v[0].strongs.pop(); })[0], /GEN 1:1: 1 tagged words, the source has 2/);
  assert.match(tamper(v => { v[2].strongs = [[0, 2, 'G1']]; })[0], /GEN 1:3: 1 tagged words, the source has 0/);
  assert.match(tamper(v => { v.pop(); v.pop(); })[0], /GEN 1:2: tagged words in the source but no verse in the output/);

  const noNumber = readUsfmBook('\\id GEN\n\\c 1\n\\p\n\\v 1 \\w In|lemma="x"\\w* it.', 'GEN');
  assert.match(authenticateWordTags({ books: [{ id: 'GEN', verses: [{ chapter: 1, verse: 1, text: 'In it.', strongs: [[0, 2, 'H1']] }] }] }, noNumber, []).problems[0], /H1, the source has no Strong's number/);
  const titles = readUsfmBook(PSA_USFM.replace('A Psalm', '\\w A Psalm|strong="H4210"\\w*'), 'PSA');
  assert.equal(authenticateWordTags({ books: [] }, titles, []).untagged, 1, 'a tagged word in a Psalm title is counted');
  assert.equal(strongsNumber('strong="G0026" x-morph="V"'), 'G26');
  assert.equal(strongsNumber('lemma="x"'), null);
});

test('Psalm titles are checked like verses', () => {
  const source = { units: readUsxBook(PSA_USX, 'PSA'), books: new Set(['PSA']) };
  const good = bibleFrom(PSA_USX, 'PSA', parseUsxBook);
  assert.deepEqual(authenticateBible(good, source, ['punctuation spacing']).problems, []);
  const bad = clone(good);
  bad.books[0].subtitles['3'] = 'A Psalm of David.';
  assert.match(authenticateBible(bad, source, []).problems[0], /PSA 3:title: text differs/);
  const none = clone(good);
  delete none.books[0].subtitles;
  assert.match(authenticateBible(none, source, []).problems[0], /PSA 3:title: in the source but not in the output/);
});

test('BSB plain text: verses verbatim, titles with their verse 1, empty verses allowed; tampering caught', () => {
  const txt = bsbPlainText(CANON);
  const source = readPlainTextBible(txt);
  assert.equal(source.books.size, 66);
  assert.ok(source.units.excluded.get('attribution and column headings') > 0);
  const good = convertBsb(txt, USX_PSALM_TITLES);
  const check = b => authenticateBible(b, source, [], { titlesInVerseOne: true });
  const r = check(good);
  assert.deepEqual(r.problems, []);
  assert.deepEqual([r.verses, r.titles, r.empty], [67, 1, 1], 'Psalm 3 has two verses');
  const psa = b => b.books.find(x => x.id === 'PSA');
  const tamper = fn => { const b = clone(good); fn(b); return check(b).problems; };
  assert.match(tamper(b => { psa(b).subtitles['3'] = 'A Psalm of David.'; })[0], /PSA 3:1: text missing|PSA 3:1: text differs/);
  assert.match(tamper(b => { psa(b).verses[0].text = `when he fled from his son Absalom. ${psa(b).verses[0].text}`; psa(b).subtitles['3'] = 'A Psalm of David—'; })[0], /PSA 3:1: words are joined|a word is split/);
  assert.match(tamper(b => { psa(b).verses = psa(b).verses.filter(v => v.verse !== 1); })[0], /PSA 3: a title without verse 1/);
  assert.match(tamper(b => { b.books[0].verses[0].text = 'GEN one'; })[0], /GEN 1:1: text missing/);
  assert.throws(() => readPlainTextBible('Hezekiah 1:1\tx'), /Unknown book "Hezekiah"/);
});

test("BSB Strong's numbers: re-derived from the translation tables; tampering is caught", () => {
  const tables = readTablesForCheck(BSB_TABLES);
  const good = convertBsb(bsbPlainText(CANON), USX_PSALM_TITLES, readTables(BSB_TABLES));
  assert.deepEqual(authenticateTableTags(good, tables), { problems: [], tags: 8, inTitles: 2, untranslated: 1, missed: 2 });

  const tamper = fn => {
    const b = clone(good);
    fn(b.books.find(x => x.id === 'PSA').verses);
    return authenticateTableTags(b, tables).problems;
  };
  assert.deepEqual(tamper(v => { v[0].strongs[1][2] = 'H4101'; }), ['PSA 3:1, tag 2: "how" H4101 [8, 11], the tables give "how" H4100 [8, 11]']);
  assert.match(tamper(v => { v[0].strongs[0][1] = 3; })[0], /PSA 3:1, tag 1: "O L" H3068/);
  assert.match(tamper(v => { v[0].strongs.pop(); })[0], /PSA 3:1, tag 4: nothing, the tables give "have increased" H7231/);
  assert.match(tamper(v => { v[1].strongs.push([0, 4, 'H1']); })[0], /PSA 3:2, tag 4: "Many" H1 \[0, 4\], the tables give nothing/);
  assert.match(tamper(v => { delete v[1].strongs; })[0], /PSA 3:2, tag 1: nothing/);

  assert.equal(tablePhrase(' {Am} I my brother’s keeper ? '), 'Am I my brother’s keeper');
  assert.equal(tablePhrase(' . . . ) '), '');
  assert.deepEqual(expectedTags('so then the', [{ english: ' the ', strongs: 'G3588' }]).tags, [[8, 11, 'G3588']], 'not the "the" inside "then"');

  const header = BSB_TABLES.split('\r\n')[0];
  assert.throws(() => readTablesForCheck(header.replace('BSB Sort', 'Order')), /no "BSB Sort" column/);
  assert.throws(() => readTablesForCheck(`${header}\n1\t0\t1\t1\tHebrew\t\t\t\t\t\tH12\t\tGenesis 1:1`), /GEN 1:1: unreadable Strong's number "H12"/);
  assert.throws(() => readTablesForCheck(`${header}\n1\t0\t1\t1\tHebrew\t\t\t\t\t\t1\t\tNowhere 1:1`), /unknown verse "Nowhere 1:1"/);
  assert.throws(() => readTablesForCheck(`${header}\n1\t0\t1\t1\tHebrew\t\t\t\t\t\t1\t\t`), /a row before the first verse/);
});

test('BSB Psalm titles must be the ones the USX marks', () => {
  const usx = readUsxBook(PSA_USX, 'PSA');
  const bible = { books: [{ id: 'PSA', subtitles: { 3: 'A Psalm of David, when he fled from his son Absalom.' } }] };
  assert.deepEqual(authenticatePsalmTitles(bible, usx), []);
  assert.deepEqual(authenticatePsalmTitles({ books: [{ id: 'PSA', subtitles: { 3: 'A Psalm of David.', 4: 'Another.' } }] }, usx), [
    "PSA 3: the title isn't the one the USX marks",
    "PSA 4: a title the USX doesn't mark",
  ]);
  assert.deepEqual(authenticatePsalmTitles({ books: [] }, usx), ['PSA 3: the USX marks a title the output lacks']);
});

// ---- Henry: tampering ----

function henryFiles(xml = HENRY_THML) {
  const { outputs } = henryOutputs([xml], () => 39);
  return new Map([...outputs].map(([k, v]) => [k, JSON.parse(v)]));
}
const DIR = 'res/commentaries/henry';
const henryCheck = files => authenticateCommentary(files, [HENRY_THML], () => 39, DIR);

test('Henry: the converted commentary passes, with what was left out counted', () => {
  const r = henryCheck(henryFiles());
  assert.deepEqual(r.problems, []);
  assert.equal(r.chapters, 1);
  assert.equal(r.units, 13, '4 in the introduction, 9 in the chapter');
  for (const k of ['front matter and indexes', 'book name', 'title page', 'chapter heading', 'printed passage', 'references that name no verse']) {
    assert.ok(r.excluded.get(k) > 0, k);
  }
});

test('Henry: every kind of tampering is caught', () => {
  const ch = `${DIR}/ROM/8.json`;
  const tamper = fn => { const f = henryFiles(); fn(f.get(ch), f); return henryCheck(f).problems; };
  assert.match(tamper(c => { c.sections[0].paragraphs[0].text = c.sections[0].paragraphs[0].text.replace('No', 'Know'); })[0], /ROM 8, item 3: text differs/);
  assert.match(tamper(c => { c.sections[0].paragraphs.splice(1, 1); })[0], /8 paragraphs and titles, the source has 9/);
  assert.match(tamper(c => { c.sections[0].paragraphs[1].poetry = false; })[0], /a paragraph where the source has a poetry/);
  assert.match(tamper(c => { c.sections[0].title = 'Freedom.'; })[0], /text differs/);
  assert.match(tamper(c => { c.sections[0].paragraphs[0].refs[1].ref = 'ROM.8.5'; })[0], /references ROM.8.1, ROM.8.5, the source has ROM.8.1, ROM.8.4/);
  assert.match(tamper(c => { c.sections[1].start = 11; })[0], /sections 1-9, 11-39, the markers give 1-9, 10-39/);
  assert.match(tamper(c => { c.introduction[0].text = 'The chapter.'; })[0], /ROM 8, item 1: text/);
  assert.match(tamper(c => { c.chapter = 9; })[0], /labelled ROM 9/);
  assert.match(tamper((c, f) => { f.get(`${DIR}/ROM/introduction.json`).paragraphs.pop(); })[0], /ROM introduction: 3 paragraphs/);
  assert.match(tamper((c, f) => { f.delete(`${DIR}/ROM/introduction.json`); })[0], /introduction.json: missing/);
  assert.match(tamper((c, f) => { f.delete(ch); })[0], /8.json: missing/);
  assert.match(tamper((c, f) => { f.set(`${DIR}/ROM/9.json`, c); })[0], /9.json: not from the source/);
  assert.match(tamper((c, f) => { f.get(`${DIR}/meta.json`).books[0].chapters = [8, 9]; })[0], /meta.json: the book list/);
});

test('Henry: the reader stops on unclassified text and broken nesting', () => {
  assert.throws(() => readVolume(HENRY_THML.replace('<attr>Herbert.</attr>', '<table><tr><td>Kings</td></tr></table>')), /<table> isn't classified/);
  assert.throws(() => readVolume(HENRY_THML.replace('<h3>CHAP. VIII.</h3>', '<h3>CHAP. VIII.</h3>Loose words')), /loose text "Loose words"/);
  assert.throws(() => readVolume(HENRY_THML.replace('title="Chapter VIII"', 'title="Appendix"')), /a block titled "Appendix"/);
  assert.throws(() => readTree('<a><b></a>'), /<\/a> closes <b>/);
  assert.throws(() => readTree('<a>'), /<a> is never closed/);
  assert.throws(() => readVolume(HENRY_THML.replace('<scripCom type="Commentary" osisRef="Bible:Rom.8.1-Rom.8.9" />', '').replace('id="Bible:Rom.8.1-Rom.8.9"', 'id="x"')), /without a passage/);
  assert.equal(fromRoman('XLIX'), 49);
});

test('Henry: verse ranges follow from the markers', () => {
  const block = (verse, endVerse, text = true, chapter = 8, endChapter = 8) => ({ marker: { book: 'ROM', chapter, verse, endChapter, endVerse }, units: text ? [{ kind: 'paragraph' }] : [] });
  assert.deepEqual(rangesFor([block(1, 9), block(10, 10, false), block(11, 40)], 39), [{ start: 1, end: 9 }, { start: 10, end: 39 }]);
  assert.deepEqual(rangesFor([block(5, null, true, 8, 9)], 39), [{ start: 5, end: 39 }]);
  assert.deepEqual(rangesFor([block(20, 25), block(1, 4)], 39), [{ start: 1, end: 4 }, { start: 20, end: 25 }]);
  assert.deepEqual(rangesFor([block(1, 2, false)], 39), [{ start: 1, end: 2 }]);
});

// ---- Strong's: tampering ----

test("Strong's: the converted lexicon passes; tampering is caught", () => {
  const good = convertLexicon(parseLexicon(LEXICON_TSV), GREEK);
  const r = authenticateLexicon(good, LEXICON_TSV, GREEK);
  assert.deepEqual(r.problems, []);
  assert.equal(r.entries, 3);
  assert.deepEqual([...r.excluded.keys()], ['header and notes', "extended entries (STEPBible's sub-entries)", "numbers outside Strong's range"]);
  const tamper = fn => { const t = clone(good); fn(t.entries); return authenticateLexicon(t, LEXICON_TSV, GREEK).problems; };
  assert.match(tamper(e => { e[1].gloss = 'Aron'; })[0], /G2 gloss/);
  assert.match(tamper(e => { e[0].lemma = 'α'; })[0], /G1 lemma/);
  assert.match(tamper(e => { e[1].definition = 'the priestly line'; })[0], /G2 definition: text differs/, 'the sub-entry instead of the main entry');
  assert.match(tamper(e => { e[0].definition = e[0].definition.replace(' & title', ''); })[0], /G1 definition: text missing/);
  assert.match(tamper(e => { e[2].partOfSpeech = 'Adjective'; })[0], /G4 part of speech/);
  assert.match(tamper(e => { e.pop(); })[0], /G4: in the source but not in the output/);
  assert.match(tamper(e => { e.push({ ...e[0], number: 'G5' }); })[0], /G5: not in the source/);
  assert.match(tamper(e => { e.push({ ...e[0] }); })[0], /G1: appears twice/);
  assert.match(tamper(e => { e[0].definition = undefined; })[0], /G1 definition: text missing/);
});

test("Strong's: withheld definitions must be absent, and are counted as left out", () => {
  const lang = { ...GREEK, definitions: false };
  const out = convertLexicon(parseLexicon(LEXICON_TSV), lang);
  assert.ok(out.entries.every(e => e.definition === undefined));
  assert.match(out.concordance.definitions, /Online Bible/);
  const r = authenticateLexicon(out, LEXICON_TSV, lang);
  assert.deepEqual(r.problems, []);
  assert.ok(r.excluded.get('definitions left out (Online Bible permission needed)') > 0);
  const leaked = JSON.parse(JSON.stringify(out));
  leaked.entries[0].definition = 'alpha';
  assert.match(authenticateLexicon(leaked, LEXICON_TSV, lang).problems[0], /G1 definition: should be left out/);
});

test("Strong's: definitions and parts of speech are re-derived", () => {
  assert.equal(definitionSource('<b>a</b><br/>b &amp; c'), 'a\nb & c');
  assert.equal(partOfSpeechFor('H:N-M / H:A'), 'Noun, masculine / Adjective');
  assert.equal(partOfSpeechFor('A:V'), 'Verb (Aramaic)');
  assert.equal(partOfSpeechFor('N:N--T'), 'Proper name');
  assert.equal(partOfSpeechFor('G:X'), undefined);
  assert.equal(partOfSpeechFor('123'), undefined);
  const { rows, other } = readLexicon(LEXICON_TSV);
  assert.equal(rows.length, 5);
  assert.ok(other > 0);
});

// ---- the Westminster Confession: tampering ----

test('the Confession passes; changed text, references and proof texts are caught', () => {
  const good = convertWcf(CREEDS, MINI_KJV);
  assert.deepEqual(authenticateConfession(good, CREEDS, MINI_KJV), { problems: [], sections: 2, proofs: 2 });
  const tamper = fn => { const w = clone(good); fn(w.sections[0]); return authenticateConfession(w, CREEDS, MINI_KJV).problems; };
  assert.match(tamper(c => { c.sections[0].content = 'Although the light of Nature.'; })[0], /1.1 text: text differs/);
  assert.match(tamper(c => { c.sections[0].contentWithProofs = 'Although the light of nature.'; })[0], /1.1 text with footnote marks: text missing/);
  assert.match(tamper(c => { c.title = 'Of Scripture'; })[0], /chapter 1 title/);
  assert.match(tamper(c => { c.sections[0].proofs[0].refs[0] = 'ROM.1.19'; })[0], /references ROM.1.19, PSA.19.1, the source has ROM.1.19-20, PSA.19.1/);
  assert.match(tamper(c => { c.sections[0].proofTexts[1].text = 'The heavens declare.'; })[0], /Psalm 19:1: the proof text isn't the KJV's/);
  assert.match(tamper(c => { c.sections[0].proofTexts.pop(); })[0], /1 proof texts, expected 2/);
  assert.match(tamper(c => { c.sections[0].proofs = []; })[0], /0 footnotes, the source has 1/);
  assert.match(tamper(c => { c.sections.pop(); })[0], /1 sections, the source has 2/);
  assert.match(tamper(c => { c.chapter = 2; })[0], /chapter 1: missing or out of order/);
  const noVerse = { books: [{ id: 'PSA', verses: [] }, MINI_KJV.books[1]] };
  assert.match(authenticateConfession(good, CREEDS, noVerse).problems[0], /Psalm 19:1: not in the KJV/);
  const unreadable = clone(CREEDS);
  unreadable.Data[0].Sections[0].Proofs[0].References.push('Xyz.1.1');
  assert.match(authenticateConfession(good, unreadable, MINI_KJV).problems[0], /can't be read/);
});

// ---- references: the two implementations agree ----

test('references: re-derived forms', () => {
  assert.deepEqual(readOsis('Bible:Ps.19.1-Ps.19.3'), { book: 'PSA', chapter: 19, verse: 1, endChapter: 19, endVerse: 3 });
  assert.equal(compactOf(readOsis('Gen.1.1-Gen.2.3')), 'GEN.1.1-2.3');
  assert.equal(compactOf(readOsis('Rom.8.1-4')), 'ROM.8.1-4');
  assert.equal(compactOf(readOsis('Gen.2-3')), 'GEN.2-3');
  assert.equal(compactOf(readOsis('Ps.19')), 'PSA.19');
  assert.equal(displayOf(readOsis('Ps.19.1-Ps.19.3')), 'Psalm 19:1–3');
  assert.equal(displayOf(readOsis('Gen.1.1-Gen.2.3')), 'Genesis 1:1–2:3');
  assert.equal(displayOf(readOsis('Gen.2-Gen.3')), 'Genesis 2–3');
  assert.equal(readOsis('Rom'), null);
  assert.equal(readOsis('Gen.1-Exod.2'), null);
  assert.equal(readOsis('Xyz.1.1'), null);
  assert.equal(readOsis('Gen.0'), null);
});

function sourceRefs() {
  const refs = new Set();
  for (const f of ['mhc1.xml', 'mhc4.xml']) {
    const xml = readStoredSource('henry').get(f).toString('utf8');
    for (const m of xml.matchAll(/osisRef="([^"]+)"/g)) for (const r of m[1].split(/\s+/)) refs.add(r.replace(/^Bible:/, ''));
  }
  for (const ch of JSON.parse(readStoredSource('wcf').get('westminster_confession_of_faith.json')).Data) {
    for (const s of ch.Sections) for (const p of s.Proofs ?? []) for (const r of p.References) refs.add(r);
  }
  return refs;
}

test('references: the converters\' parser and the re-derivation agree on every reference in the sources', () => {
  let compared = 0;
  for (const osis of sourceRefs()) {
    const a = parseOsisRef(osis);
    const b = readOsis(osis);
    assert.equal(a === null, b === null, `${osis}: one reads it, the other doesn't`);
    if (!a) continue;
    assert.equal(compactRef(a), compactOf(b), osis);
    assert.equal(displayRef(a), displayOf(b), osis);
    compared++;
  }
  assert.ok(compared > 10000, `${compared} references compared`);
});

test("parts of speech: the converter and the re-derivation agree on every code in STEPBible's files", () => {
  const codes = new Set();
  for (const [id, file] of [['strongs-greek', 'TBESG.txt'], ['strongs-hebrew', 'TBESH.txt']]) {
    for (const r of readLexicon(readStoredSource(id).get(file).toString('utf8')).rows) codes.add(r.morph);
  }
  for (const code of codes) assert.equal(partOfSpeech(code), partOfSpeechFor(code), code);
  assert.ok(codes.size > 100);
});

// ---- the site ----

function siteFixture() {
  const root = tmp();
  const site = path.join(root, 'site');
  const write = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data)); };
  const bible = id => ({ version: { id }, books: [{ id: 'GEN', chapters: 1, verses: [{ book: 'GEN', chapter: 1, verse: 1, text: 'In the beginning.', strongs: [[0, 2, 'H7225']] }], subtitles: {} }] });
  for (const id of ['kjv', 'bsb']) {
    const b = bible(id);
    write(path.join(root, `res/bibles/${id}/${id}.json`), b);
    // The search file leaves out the word tags.
    write(path.join(site, `bible-${id}.json`), { ...b, books: b.books.map(k => ({ ...k, verses: k.verses.map(({ strongs, ...v }) => v) })) });
    write(path.join(site, `bibles/${id}/GEN.json`), b.books[0]);
    write(path.join(site, `bibles/${id}/index.json`), { version: b.version, books: [{ id: 'GEN', chapters: 1, verseCounts: [1] }] });
  }
  for (const [res, out, data] of [
    ['res/confessions/wcf/wcf.json', 'confession-wcf.json', { sections: [] }],
    ['res/strongs/greek/greek.json', 'strongs-greek.json', { entries: [{ number: 'G1' }] }],
    ['res/strongs/hebrew/hebrew.json', 'strongs-hebrew.json', { entries: [{ number: 'H1' }] }],
    ['res/commentaries/henry/meta.json', 'commentaries/henry/meta.json', { books: [] }],
    ['res/commentaries/henry/ROM/8.json', 'commentaries/henry/ROM/8.json', { sections: [{ start: 1 }] }],
  ]) {
    write(path.join(root, res), data);
    write(path.join(site, out), data);
  }
  return { root, site };
}

test('the site must carry res/ unchanged', () => {
  const { root, site } = siteFixture();
  assert.deepEqual(authenticateSite(root, site), { problems: [], files: 11 });
  const edit = (rel, fn) => { const f = path.join(site, rel); const d = JSON.parse(fs.readFileSync(f)); fn(d); fs.writeFileSync(f, JSON.stringify(d)); };
  edit('bibles/kjv/GEN.json', b => { b.verses[0].text = 'In the beginning,'; });
  edit('bible-bsb.json', b => { b.books[0].verses[0].strongs = [[0, 2, 'H7225']]; });
  edit('commentaries/henry/ROM/8.json', c => { c.sections[0].start = 2; });
  fs.rmSync(path.join(site, 'strongs-hebrew.json'));
  fs.writeFileSync(path.join(site, 'commentaries/henry/extra.json'), '{}');
  const { problems } = authenticateSite(root, site);
  assert.deepEqual(problems, [
    'bibles/kjv/GEN.json: differs from res/',
    'bible-bsb.json: differs from res/',
    'strongs-hebrew.json: missing from the site',
    'commentaries/henry/ROM/8.json: differs from res/',
    'commentaries/henry: 3 files on the site, 2 in res/',
  ]);
});

// ---- reproduction and the committed sources ----

test('reproduction: res/ must be exactly what the converter writes, with nothing extra', () => {
  const root = tmp();
  const pipeline = { owns: ['res/x'] };
  const outputs = new Map([['res/x/a.json', '{"a":1}\n'], ['res/x/b/c.json', '{}\n']]);
  writeOutputs(pipeline, outputs, root);
  fs.writeFileSync(path.join(root, 'res/x/README.md'), 'notes');
  assert.deepEqual(compareOutputs(pipeline, outputs, root), []);
  fs.writeFileSync(path.join(root, 'res/x/a.json'), '{"a":2}\n');
  fs.writeFileSync(path.join(root, 'res/x/stray.json'), '{}');
  fs.rmSync(path.join(root, 'res/x/b/c.json'));
  assert.deepEqual(compareOutputs(pipeline, outputs, root), [
    'res/x/a.json: differs from what the sources produce',
    'res/x/b/c.json: missing',
    'res/x/stray.json: not produced from the sources',
  ]);
  writeOutputs(pipeline, outputs, root);
  assert.deepEqual(filesUnder('res/x', root).sort(), ['res/x/README.md', 'res/x/a.json', 'res/x/b/c.json']);
  assert.deepEqual(filesUnder('res/none', root), []);
});

test('committed sources: stored byte for byte (text gzipped), read back and checksummed', async () => {
  const dir = tmp();
  const registry = { sources: { demo: { downloads: [{ file: 'a.xml', url: 'https://example.org/a.xml' }, { file: 'b.zip', url: 'https://example.org/b.zip' }] } } };
  const files = new Map([['a.xml', Buffer.from('<a>text</a>')], ['b.zip', Buffer.from([0x50, 0x4b, 1, 2])]]);
  storeSource('demo', files, { dir });
  assert.deepEqual(fs.readdirSync(path.join(dir, 'demo')).sort(), ['a.xml.gz', 'b.zip']);
  assert.equal(storedName('x.txt'), 'x.txt.gz');
  const back = readStoredSource('demo', { dir, registry });
  assert.deepEqual([...back.keys()], ['a.xml', 'b.zip']);
  for (const [k, v] of files) assert.ok(back.get(k).equals(v), k);
  const one = new Map([['a.xml', files.get('a.xml')]]);
  assert.deepEqual(sourceChecksum(one), { sha256: sha256(files.get('a.xml')), files: 1 });
  assert.equal(sourceChecksum(files).files, 2);
  fs.rmSync(path.join(dir, 'demo/b.zip'));
  assert.throws(() => readStoredSource('demo', { dir, registry }), /Missing .*b\.zip\. Run the ingest script with --download/);
  assert.throws(() => readStoredSource('none', { dir, registry }), /No sources.none/);
  assert.throws(() => readStoredSource('demo', { dir, registry: { sources: { demo: {} } } }), /lists no downloads/);
  const fetched = await downloadSource('demo', { registry, fetch: async url => Buffer.from(url) });
  assert.equal(fetched.get('b.zip').toString(), 'https://example.org/b.zip');
});

// ---- the whole repository ----

test('authentication fails when the committed sources are missing', () => {
  const result = authenticate({ sourcesDir: tmp() });
  assert.equal(result.ok, false);
  assert.match(result.report[0].checks[0].problems[0], /kjv: Missing/);
  const lines = [];
  printReport(result, { limit: 1, log: l => lines.push(l) });
  assert.ok(lines.some(l => l.includes('…and')));
  assert.equal(lines.at(-1), 'Authentication FAILED.');
});

test('the committed res/ authenticates against the committed sources', () => {
  const result = authenticate();
  const failures = result.report.flatMap(r => r.checks.filter(c => c.problems.length).map(c => `${r.id}: ${c.name}: ${c.problems.slice(0, 3).join('; ')}`));
  assert.deepEqual(failures, []);
  assert.equal(result.ok, true);
  const lines = [];
  printReport(result, { log: l => lines.push(l) });
  assert.equal(lines.at(-1), 'Authentication passed.');
});

test('Units: kept and left-out characters are counted, whitespace aside', () => {
  const u = new Units();
  u.open('A');
  u.add('A', 'two words');
  u.break('A');
  u.exclude('notes', ' a b ');
  assert.equal(u.units.get('A'), 'two words\n');
  assert.equal(u.kept, 8);
  assert.equal(u.excluded.get('notes'), 2);
  assert.throws(() => u.open('A'), /A appears twice/);
  const v = new Units();
  v.add('A', 'x');
  assert.throws(() => new Units().merge(u).merge(v), /A appears twice/);
});
