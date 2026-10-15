import test from 'node:test';
import assert from 'node:assert/strict';
import { align, classify, compare, itemKey, variationSpans } from '../verify/consensus.js';
import { kjvTokens, parseThiago } from '../verify/adapters/kjv.js';
import { bsbTokens, parseThiagoBsb } from '../verify/adapters/bsb.js';
import { compressVerses, parseModernCitation, parseOldNotes, spellingKey, wcfTokens } from '../verify/adapters/wcf.js';
import { lemmaKey, parseStep } from '../verify/adapters/strongs.js';
import { acceptItems, addCorrection, confirmDecisions, ignoreItems, readingChoices, undoDecision } from '../verify/review.js';
import { applyStrongsCorrections, applyVerseCorrections, correctionFromReading, locateEdit } from '../lib/corrections.js';
import { createServer } from '../verify/review-server.js';
import { renderReport } from '../verify/report.js';

const words = s => s.split(' ');
const seq = s => ({ norm: words(s), show: words(s) });
const lineage = { a: 'A', b: 'B', c: 'C', a2: 'A' };
const lineageOf = id => lineage[id];

test('align finds the common words and the differences between them', () => {
  const ops = align(words('the LORD is my shepherd'), words('the Lord is my good shepherd'));
  assert.deepEqual(ops.filter(o => !o.equal).map(o => [o.i1, o.i2, o.j1, o.j2]), [[1, 2, 1, 2], [4, 4, 4, 5]]);
  assert.deepEqual(align(['x'], ['x']), [{ equal: true, i1: 0, i2: 1, j1: 0, j2: 1 }]);
});

test('variationSpans merges places separated by at most one word, across witnesses', () => {
  const a = words('a b c d e f g');
  assert.deepEqual(variationSpans([align(a, words('a X c Y e f g'))]), [{ s: 1, e: 4 }]);
  assert.deepEqual(variationSpans([align(a, words('a X c d e f g')), align(a, words('a b c d e Z g'))]), [{ s: 1, e: 2 }, { s: 5, e: 6 }]);
  const today = words('consecrate yourselves today to the LORD');
  const [span] = variationSpans([align(today, words('consecrate yourselves to day to the LORD'))]);
  assert.deepEqual(today.slice(span.s, span.e), ['today']);
});

test('classify counts independent lineages, not copies', () => {
  assert.equal(classify('x', { a: 'x', b: 'x' }, lineageOf), 'agree');
  assert.equal(classify('x', { a: 'x', b: 'y' }, lineageOf), 'majority');
  assert.equal(classify('x', { a: 'y', b: 'y' }, lineageOf), 'against');
  assert.equal(classify('x', { a: 'y', a2: 'y' }, lineageOf), 'split', 'two copies of one lineage are one vote');
  assert.equal(classify('x', { a: 'y' }, lineageOf), 'split', 'a single witness cannot outvote the source');
  assert.equal(classify('x', { a: 'x', b: 'y', c: 'y' }, lineageOf), 'split');
  assert.equal(classify('x', { a: undefined }, lineageOf), 'unattested');
});

test('compare reports only places that need a decision, keyed by content', () => {
  const ours = new Map([['v1', seq('in the beginning God created')], ['v2', seq('and the earth was')], ['v3', { value: '5' }]]);
  const witnesses = {
    a: new Map([['v1', seq('in the beginning GOD created')], ['v2', seq('and the earth was')], ['v3', { value: '5' }]]),
    b: new Map([['v1', seq('in the beginning GOD created')], ['v2', seq('and the earth is')], ['v3', { value: '6' }], ['v4', seq('extra verse')]]),
  };
  const r = compare({ resource: 't', ours, witnesses, lineageOf });
  // v2 and v3: one witness differs, the other agrees with us. v4: only one witness has it.
  assert.deepEqual(r.items.map(i => [i.unit, i.class, i.ours]), [['v1', 'against', 'God']]);
  assert.equal(r.stats.majority, 3);
  const alone = compare({ resource: 't', ours: new Map(), witnesses: { a: new Map([['v9', seq('x')]]) }, lineageOf });
  assert.deepEqual(alone.items.map(i => [i.unit, i.class, i.ours]), [['v9', 'split', '∅']]);
  assert.deepEqual(r.items[0].readings, { a: 'GOD', b: 'GOD' });
  assert.deepEqual(r.items[0].context, ['in the beginning', 'created']);

  // The key changes when our reading, its context, or the set of witness readings changes.
  const k = itemKey('t', 'v1', 'the beginning', 'God', 'created', { a: 'GOD', b: 'GOD' });
  assert.equal(r.items[0].key, k);
  assert.equal(itemKey('t', 'v1', 'the beginning', 'God', 'created', { a: 'GOD', b: 'GOD', c: 'GOD' }), k, 'another witness with the same reading');
  assert.notEqual(itemKey('t', 'v1', 'the beginning', 'God', 'created', { a: 'GOD', b: 'Gods' }), k);
  assert.notEqual(itemKey('t', 'v1', 'the beginning', 'Lord', 'created', { a: 'GOD', b: 'GOD' }), k);
});

test('KJV tokens keep case and drop witness formatting', () => {
  assert.deepEqual(kjvTokens("the LORD'S house, the L ord").norm, ['the', 'LORDs', 'house', 'the', 'Lord']);
  assert.deepEqual(kjvTokens('¶ the first-born [was] there').norm, ['the', 'firstborn', 'was', 'there']);
  const t = parseThiago([{ chapters: [['In the {Heb. note} beginning']] }]);
  assert.equal(t.get('GEN 1:1').replace(/\s+/g, ' '), 'In the beginning');
});

test('BSB witness: verses matched to our numbering, stanza letters and placeholders removed', () => {
  const json = Array.from({ length: 66 }, () => ({ chapters: [] }));
  json[18] = { chapters: Array.from({ length: 119 }, () => []) };
  json[18].chapters[118] = ['Blessed are they. ב BETH', 'How can a ( vvv young man'];
  const t = parseThiagoBsb(json, new Map([['PSA 119', [1, 2]]]));
  assert.equal(t.get('PSA 119:1'), 'Blessed are they.');
  assert.deepEqual(bsbTokens(t.get('PSA 119:2')).norm, ['How', 'can', 'a', 'young', 'man']);
  assert.deepEqual(bsbTokens('breath—for she was forty-two').norm, ['breath', 'for', 'she', 'was', 'fortytwo']);
});

test('WCF spelling key folds 17th-century spelling', () => {
  for (const [a, b] of [['sinne', 'sin'], ['doe', 'do'], ['ſinne', 'sin'], ['Iudge', 'judge'], ['vnto', 'unto']]) assert.equal(spellingKey(a), spellingKey(b));
  assert.notEqual(spellingKey('honour'), spellingKey('honor'));
  assert.deepEqual(wcfTokens('God’s &amp; man’s').norm, ['gods', 'and', 'mans']);
});

const counts = (book, chapter) => ({ 'PSA 88': 18, 'HEB 8': 13, 'HEB 9': 28, 'ROM 3': 31 }[`${book} ${chapter}`] ?? 30);

test('modern citations: ranges, whole chapters and phrases', () => {
  const v = c => [...parseModernCitation(c, counts)].sort();
  assert.deepEqual(v('Rom. 3:10 to 12'), ['ROM 3:10', 'ROM 3:11', 'ROM 3:12']);
  assert.equal(parseModernCitation('Ps. 88 throughout', counts).size, 18);
  assert.equal(parseModernCitation('Heb. 8, 9 chapters', counts).size, 13 + 28);
  assert.deepEqual(v('Rom. 2:14, 15; 1 John 5:13'), ['1JN 5:13', 'ROM 2:14', 'ROM 2:15']);
});

test('1649 margin notes: verses, ranges, and a chapter without verses as the whole chapter', () => {
  const v = n => [...parseOldNotes([n], counts)].sort();
  assert.deepEqual(v('Rom. 2. 14, 15. Psal. 19. 1 to 3.'), ['PSA 19:1', 'PSA 19:2', 'PSA 19:3', 'ROM 2:14', 'ROM 2:15']);
  assert.equal(parseOldNotes(['Psal. 88. throughout.'], counts).size, 18);
  assert.deepEqual(v('Iohn 3. 5.'), ['JHN 3:5']);
});

test('compressVerses writes ranges', () => {
  assert.equal(compressVerses([5, 1, 2, 3, 9, 8]), '1-3, 5, 8-9');
});

test('Strong\'s lemmas compare without accents or final forms; STEPBible rows are grouped', () => {
  assert.equal(lemmaKey('ἀγάπη'), lemmaKey('αγαπη'));
  assert.equal(lemmaKey('אָב'), lemmaKey('אב'));
  assert.equal(lemmaKey('מֶלֶךְ'), lemmaKey('מלכ'));
  const step = parseStep('header\nH0001\tH0001G =\tH0001G\tאָב\tav\nH0001\tH0001H =\tH2438H\tאָב, אֲבִי\tav\n');
  assert.deepEqual([...step.get('H1')], ['אָב', 'אֲבִי']);
});

test('review: accept and ignore record who and why once; corrections only take a witness reading; sign-off', () => {
  const decisions = { corrections: [], accepted: [], ignored: [] };
  const item = { key: 'k1', unit: 'GEN 10:7', ours: 'Sabtechah', readings: { a: 'Sabtecha' }, suggestion: { class: 'oxford-cambridge' } };
  assert.equal(acceptItems(decisions, [item, item], { reason: 'Oxford text', reviewer: 'R', date: 'd' }), 1);
  assert.deepEqual(decisions.accepted[0], { key: 'k1', unit: 'GEN 10:7', ours: 'Sabtechah', readings: { a: 'Sabtecha' }, class: 'oxford-cambridge', reason: 'Oxford text', reviewer: 'R', date: 'd' });
  assert.equal(ignoreItems(decisions, [item], { reviewer: 'R' }), 0, 'already decided');
  assert.equal(ignoreItems(decisions, [{ ...item, key: 'k2' }], { reviewer: 'R', date: 'd' }), 1);
  assert.equal(decisions.ignored[0].reason, 'Ignored.');

  const verse = { key: 'k3', unit: 'DEU 32:8', ours: 'Most', context: ['When the', 'High divided to the'], raw: 'When the Most High divided to the nations', readings: { pce: 'most', ebible: 'most' } };
  assert.deepEqual(readingChoices(verse), [{ reading: 'most', witnesses: ['pce', 'ebible'] }]);
  assert.throws(() => addCorrection('kjv', decisions, verse, { reading: 'Highest', reviewer: 'R' }), /witnesses' readings/);
  const [c] = addCorrection('kjv', decisions, verse, { reading: 'most', reviewer: 'R', date: 'd' });
  assert.deepEqual(c, { ref: 'DEU 32:8', from: 'Most', to: 'most', kind: 'word', witnesses: ['pce', 'ebible'], reviewer: 'R', date: 'd', reason: 'Took the reading of pce, ebible.' });

  decisions.corrections.push({ ref: 'GEN 1:1', from: 'a', to: 'b', reviewer: 'Claude' });
  assert.equal(confirmDecisions(decisions, { reviewer: 'Claude', by: 'Pat', date: 'd' }), 1);
  assert.equal(decisions.corrections[1].confirmedBy, 'Pat');
});

test('locateEdit builds an exact, unique edit and keeps punctuation', () => {
  const raw = 'For Moses had said, Consecrate yourselves today to the LORD, even every man upon his son';
  assert.deepEqual(locateEdit(raw, { context: ['had said Consecrate yourselves', 'even every man upon'], ours: 'today to the LORD', reading: 'to day to the LORD' }),
    { from: 'today to the LORD', to: 'to day to the LORD' });
  // A word that occurs twice is anchored by its context.
  assert.deepEqual(locateEdit('And the LORD said unto the LORD, Sit', { context: ['said unto the', 'Sit'], ours: 'LORD', reading: 'Lord' }), { from: 'the LORD, Sit', to: 'the Lord, Sit' });
  // Deletion and insertion.
  assert.deepEqual(locateEdit('under the new covenant', { context: ['grace under', 'new covenant'], ours: 'the', reading: '' }), { from: 'under the new', to: 'under new' });
  assert.deepEqual(locateEdit('unto the LORD thy God', { context: ['unto the LORD', 'thy God'], ours: '', reading: 'even' }), { from: 'LORD thy', to: 'LORD even thy' });
  // Curly apostrophes in the source stay curly.
  assert.deepEqual(locateEdit('the LORD’s house', { context: ['', 'house'], ours: "the LORD's", reading: "the Lord's" }), { from: 'the LORD’s', to: 'the Lord’s' });
  assert.throws(() => locateEdit('nothing here', { context: ['', ''], ours: 'absent', reading: 'x' }), /exactly once/);
  // The edit applies at ingest.
  const bible = { books: [{ id: 'EXO', verses: [{ chapter: 32, verse: 29, text: raw }] }] };
  applyVerseCorrections(bible, [{ ref: 'EXO 32:29', from: 'today to the LORD', to: 'to day to the LORD' }]);
  assert.match(bible.books[0].verses[0].text, /yourselves to day to the LORD, even/);
});

test('proof corrections keep references in their footnotes, trim extras and add missing verses', () => {
  const item = { unit: '33.2 2TH 1', ours: '7-9', raw: { chapterVerses: 12, footnotes: [{ id: 2, refs: ['Rom.2.5', '2Thess.1.7-2Thess.1.8'] }, { id: 3, refs: ['2Thess.1.9'] }] } };
  assert.throws(() => correctionFromReading('wcf', item, '7-10'), err => err.footnotes?.length === 2);
  assert.deepEqual(correctionFromReading('wcf', item, '7-10', { footnote: 3 }).entries, [{ section: '33.2', footnote: 3, replace: [], with: ['2Thess.1.10'] }]);
  assert.deepEqual(correctionFromReading('wcf', item, '7').entries, [
    { section: '33.2', footnote: 2, replace: ['2Thess.1.7-2Thess.1.8'], with: ['2Thess.1.7'] },
    { section: '33.2', footnote: 3, replace: ['2Thess.1.9'], with: [] },
  ]);
  const whole = { unit: '8.4 MAT 27', ours: '1-66', raw: { chapterVerses: 66, footnotes: [{ id: 4, refs: ['Matt.27'] }] } };
  assert.deepEqual(correctionFromReading('wcf', whole, '46').entries, [{ section: '8.4', footnote: 4, replace: ['Matt.27'], with: ['Matt.27.46'] }]);
  const span = { unit: '8.4 MAT 27', ours: '1-66', raw: { chapterVerses: 66, footnotes: [{ id: 4, refs: ['Matt.26-Matt.27'] }] } };
  assert.throws(() => correctionFromReading('wcf', span, '46'), /more than one chapter/);
});

test('Strong\'s and BSB corrections apply exactly', () => {
  const item = { unit: 'H10', ours: 'אֲבַדֹּה', raw: 'אֲבַדֹּה', readings: { step: 'אֲבַדּוֹן' }, options: { step: ['אֲבַדּוֹן'] } };
  const { entries } = correctionFromReading('strongs-hebrew', item, 'אֲבַדּוֹן');
  const dict = { entries: [{ number: 'H10', lemma: 'אֲבַדֹּה' }] };
  applyStrongsCorrections(dict, entries);
  assert.equal(dict.entries[0].lemma, 'אֲבַדּוֹן');
  assert.throws(() => applyStrongsCorrections(dict, entries), /expected/);
  const bsb = { unit: 'GEN 35:18', ours: 'vvv', context: ['dying she named', 'him Ben-oni But'], raw: 'for she was dying— she named vvv him Ben-oni.', readings: { thiago: '' } };
  assert.deepEqual(correctionFromReading('bsb', bsb, '').entries, [{ ref: 'GEN 35:18', from: 'named vvv him', to: 'named him', kind: 'word' }]);
});

test('reports list pending items with the classes needing judgement first', () => {
  const md = renderReport({
    resource: 't', title: 'T', checked: 'today', source: { pin: 'p', lineage: 'l' },
    witnesses: { 'x-a': { title: 'A', pin: 'pa', lineage: 'A', unitsCovered: 1, placesDiffering: 1 } },
    unitName: 'verse', comparison: 'words', stats: { units: 1, agree: 0, majority: 0, against: 1, split: 1, unattested: 0 },
    corrections: 0, accepted: 0, awaitingSignOff: 0, stale: [],
    pending: [
      { id: '1', unit: 'u1', class: 'split', ours: 'a', readings: { 'x-a': 'b' }, suggestion: { class: 'easy', action: 'accept', note: 'n' } },
      { id: '2', unit: 'u2', class: 'against', ours: 'c', readings: { 'x-a': 'd' }, suggestion: { class: 'hard', action: null, note: 'm' } },
    ],
  });
  assert.ok(md.indexOf('### hard') < md.indexOf('### easy'));
  assert.match(md, /\| `2` \| u2 \| \*\*c\*\* \| a: “d” \| against \|/);
});

test('review: undo matches the exact decision', () => {
  const kjv = { corrections: [
    { ref: 'ISA 3:15', from: 'Lord God', to: 'Lord GOD' },
    { ref: 'ISA 3:15', from: 'saith the Lord', to: 'saith the LORD' },
  ], accepted: [{ key: 'k1' }], ignored: [{ key: 'k2' }] };
  assert.equal(undoDecision('kjv', kjv, { kind: 'correction', unit: 'ISA 3:15', from: 'Lord God', to: 'Lord GOD' }), true);
  assert.deepEqual(kjv.corrections.map(c => c.from), ['saith the Lord']);
  assert.equal(undoDecision('kjv', kjv, { kind: 'accepted', key: 'k1' }), true);
  assert.equal(undoDecision('kjv', kjv, { kind: 'accepted', key: 'k1' }), false);
  assert.equal(undoDecision('kjv', kjv, { kind: 'ignored', key: 'k2' }), true);
  const wcf = { corrections: { text: [], proofs: [{ section: '8.4', footnote: 4, replace: [], with: ['Matt.27.46'] }] }, accepted: [] };
  assert.equal(undoDecision('wcf', wcf, { kind: 'correction', unit: '8.4', footnote: 4 }), true);
  const strongs = { corrections: [{ entry: 'H10', field: 'lemma', from: 'a', to: 'b' }], accepted: [] };
  assert.equal(undoDecision('strongs-hebrew', strongs, { kind: 'correction', unit: 'H10' }), true);
});

test('reviewer UI server: serves the page and state, refuses cross-site writes', async () => {
  const server = createServer({ port: 0 });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.match(await (await fetch(base)).text(), /Source review/);
    const state = await (await fetch(`${base}/api/state`)).json();
    assert.ok(state.resources.some(r => r.id === 'kjv' && r.verified));
    const post = headers => fetch(`${base}/api/decide`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: '{"resource":"kjv"}' });
    assert.equal((await post({})).status, 403, 'no X-Review header');
    assert.equal((await post({ 'X-Review': '1', Origin: 'https://example.com' })).status, 403, 'another origin');
    assert.equal((await fetch(`${base}/api/report?resource=../x`)).status, 400);
  } finally {
    server.close();
  }
});
