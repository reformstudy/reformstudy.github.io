/**
 * Tests for the pipeline explorer (scripts/explore/): its data layer, run
 * against the committed repository, and its HTTP routes.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Explorer, RESOURCES, toRoman } from '../explore/data.js';
import { createServer } from '../explore/server.js';
import { ROOT } from '../lib/sources.js';

const explorer = new Explorer();

test('overview: every source checks out, with its files and both checksums', () => {
  const o = explorer.overview();
  assert.deepEqual(o.sources.map(s => s.id), ['kjv', 'bsb', 'bsb-tables', 'wcf', 'henry', 'strongs-greek', 'strongs-hebrew']);
  for (const s of o.sources) {
    assert.equal(s.ok, true, s.id);
    assert.equal(s.actual, s.recorded);
    assert.ok(s.files.every(f => f.bytes > 0 && f.storedBytes > 0 && /^[0-9a-f]{64}$/.test(f.sha256)));
  }
  assert.deepEqual(o.pipelines.map(p => p.id), ['kjv', 'bsb', 'wcf', 'henry', 'strongs']);
  assert.equal(o.resources.length, RESOURCES.length);
  assert.ok(!('lang' in o.resources[0]));
});

test('overview reports a missing committed source instead of failing', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-explore-'));
  fs.mkdirSync(path.join(root, 'provenance'));
  fs.copyFileSync(path.join(ROOT, 'provenance/registry.json'), path.join(root, 'provenance/registry.json'));
  const o = new Explorer({ root }).overview();
  assert.equal(o.sources[0].ok, false);
  assert.match(o.sources[0].error, /Missing .*sources\/kjv\/eng-kjv_usfm.zip/);
});

test('ingest runs a converter in memory and compares each file with res/', () => {
  const r = explorer.ingest('wcf');
  assert.deepEqual(r.files.map(f => [f.path, f.status]), [['res/confessions/wcf/wcf.json', 'same']]);
  assert.equal(r.same, 1);
  assert.match(r.summary, /172 sections/);
  assert.throws(() => explorer.ingest('nope'), /No pipeline "nope"/);
  const g = explorer.generated('wcf', 'res/confessions/wcf/wcf.json');
  assert.equal(g.generated, g.committed);
  assert.equal(explorer.generated('wcf', 'res/none.json').generated, null);
});

test('ingest marks files that differ from res/ or are missing', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-explore-'));
  for (const rel of ['provenance/registry.json', 'sources/wcf/westminster_confession_of_faith.json.gz', 'res/bibles/kjv/kjv.json']) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, rel), path.join(root, rel));
  }
  const x = new Explorer({ root });
  assert.equal(x.ingest('wcf').files[0].status, 'missing from res/');
  fs.mkdirSync(path.join(root, 'res/confessions/wcf'), { recursive: true });
  fs.writeFileSync(path.join(root, 'res/confessions/wcf/wcf.json'), '{}');
  assert.equal(x.ingest('wcf').files[0].status, 'differs from res/');
  assert.equal(x.generated('wcf', 'res/bibles/none.json').committed, null);
});

test('places: chapters for Bibles and Henry, chapters of the Confession, pages of entries', () => {
  const kjv = explorer.places('kjv');
  assert.equal(kjv.length, 66);
  assert.equal(kjv[18].places.length, 150);
  const henry = explorer.places('henry');
  assert.deepEqual(henry[44].places.slice(0, 2), [{ place: 'ROM introduction', label: 'Intro' }, { place: 'ROM 1', label: '1' }]);
  assert.equal(explorer.places('wcf')[0].places.length, 33);
  assert.equal(explorer.places('strongs-hebrew')[0].places.at(-1).label, 'H8651–8674');
  assert.throws(() => explorer.places('nope'), /No resource "nope"/);
});

test('inspect a KJV chapter: raw USFM, the text read from it, the output, all verbatim', () => {
  const r = explorer.inspect('kjv', 'PSA 3');
  assert.deepEqual(r.summary, { units: 9, failed: 0 });
  assert.equal(r.units[0].kind, 'Psalm title');
  assert.match(r.units[0].raw, /^\\d /);
  const v1 = r.units[1];
  assert.equal(v1.key, 'PSA 3:1');
  assert.match(v1.raw, /^\\v 1 /);
  assert.equal(v1.verdict, null);
  assert.deepEqual(r.exceptions, ['pilcrow', 'punctuation spacing']);
  assert.equal(explorer.rawChapter('kjv', 'GEN', 99), '');
});

test('inspect the BSB: the title is shown with verse 1, empty verses explained', () => {
  const psa = explorer.inspect('bsb', 'PSA 3');
  assert.equal(psa.summary.failed, 0);
  assert.match(psa.units[0].notes[0], /opens verse 1 with the Psalm's title/);
  assert.match(psa.units[0].raw, /^Psalm 3:1\t/);
  const mat = explorer.inspect('bsb', 'MAT 17');
  const v21 = mat.units.find(u => u.key === 'MAT 17:21');
  assert.equal(v21.output, null);
  assert.equal(v21.verdict, null);
  assert.match(v21.notes[0], /leaves this verse empty/);
});

test('inspect Henry: paragraphs, references, and the verse ranges re-derived', () => {
  const r = explorer.inspect('henry', 'ROM 8');
  assert.equal(r.summary.failed, 0);
  assert.ok(r.units.length > 20);
  assert.match(r.raw, /^<div2[^>]*title="Chapter VIII"/);
  assert.match(r.raw, /R O M A N S/);
  assert.ok(r.sections.every(s => s.ok));
  assert.ok(r.units.some(u => u.notes.some(n => n.startsWith('references: ROM.'))));
  const intro = explorer.inspect('henry', 'ROM introduction');
  assert.equal(intro.sections, null);
  assert.match(intro.raw, /title="Introduction"/);
  assert.match(explorer.rawHenry('ISA', '1'), /title="Chapter I"/, 'volume 4 writes attributes in another order');
  assert.equal(explorer.rawHenry('GEN', '99'), '');
  assert.equal(toRoman(49), 'XLIX');
});

test('inspect the Confession and the lexicons', () => {
  const w = explorer.inspect('wcf', '1');
  assert.equal(w.summary.failed, 0);
  assert.equal(w.units[0].kind, 'chapter title');
  assert.match(w.units[1].notes[0], /^\[1\] .* → /);
  const g = explorer.inspect('strongs-greek', 'G1');
  assert.equal(g.summary.units, 50);
  assert.equal(g.summary.failed, 0);
  assert.match(g.units[0].raw, /^G0001\t/);
  assert.match(g.units[0].notes.at(-1), /^part of speech: Noun from code G:N-LI$/);
  const h = explorer.inspect('strongs-hebrew', 'H1');
  assert.equal(h.summary.failed, 0);
  assert.equal(h.units[0].output, null);
  assert.ok(h.units[0].source.length > 0, 'the withheld definition is still shown as read from the source');
  assert.match(h.units[0].notes[0], /left out until Online Bible gives permission/);
});

test('verdicts: a row reports missing units and differences', () => {
  assert.equal(explorer.row('k', 'verse', '', undefined, 'x').verdict, 'not in the source');
  assert.equal(explorer.row('k', 'verse', '', 'x', undefined).verdict, 'in the source but not in the output');
  assert.equal(explorer.row('k', 'verse', '', ' ', undefined).verdict, null);
  assert.match(explorer.row('k', 'verse', '', 'a b', 'ab').verdict, /words are joined/);
});

test('authenticate returns the report with left-out totals as plain objects', () => {
  const r = explorer.authenticate();
  assert.equal(r.ok, true);
  assert.equal(r.report[0].id, 'sources');
  assert.equal(typeof r.report.find(x => x.id === 'henry').excluded['printed passage'], 'number');
});

test('the server serves the page, the script and every API route; errors are JSON', async () => {
  const server = createServer(explorer);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const page = await fetch(`${base}/`);
    assert.match(page.headers.get('content-type'), /text\/html/);
    assert.match(await page.text(), /pipeline explorer/i);
    assert.match(await (await fetch(`${base}/app.js`)).text(), /\/api\/inspect/);
    assert.equal((await (await fetch(`${base}/api/overview`)).json()).sources.length, 7);
    assert.equal((await (await fetch(`${base}/api/places?resource=wcf`)).json())[0].places.length, 33);
    assert.equal((await (await fetch(`${base}/api/inspect?resource=wcf&place=2`)).json()).summary.failed, 0);
    assert.equal((await (await fetch(`${base}/api/ingest?id=wcf`)).json()).same, 1);
    assert.equal((await (await fetch(`${base}/api/generated?id=wcf&path=res/confessions/wcf/wcf.json`)).json()).path, 'res/confessions/wcf/wcf.json');
    const missing = await fetch(`${base}/api/nope`);
    assert.equal(missing.status, 404);
    const failed = await fetch(`${base}/api/ingest?id=nope`);
    assert.equal(failed.status, 500);
    assert.match((await failed.json()).error, /No pipeline/);
  } finally {
    server.close();
  }
});

/** A copy of the repository's sources (linked) and the given res/ files (copied), for tampering. */
function tamperable(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-explore-'));
  fs.mkdirSync(path.join(root, 'provenance'));
  fs.copyFileSync(path.join(ROOT, 'provenance/registry.json'), path.join(root, 'provenance/registry.json'));
  fs.symlinkSync(path.join(ROOT, 'sources'), path.join(root, 'sources'), 'dir');
  for (const rel of files) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, rel), path.join(root, rel));
  }
  const edit = (rel, fn) => {
    const file = path.join(root, rel);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    fn(data);
    fs.writeFileSync(file, JSON.stringify(data));
  };
  return { root, edit };
}

test('inspect shows every kind of failure the authenticator would report', () => {
  const { root, edit } = tamperable([
    'res/bibles/kjv/kjv.json', 'res/bibles/bsb/bsb.json', 'res/confessions/wcf/wcf.json',
    'res/commentaries/henry/meta.json', 'res/commentaries/henry/ROM/8.json', 'res/strongs/greek/greek.json', 'res/strongs/hebrew/hebrew.json',
  ]);
  edit('res/bibles/kjv/kjv.json', b => {
    const gen = b.books[0];
    gen.verses[0].text = gen.verses[0].text.replace('created', 'made');
    gen.verses.push({ book: 'GEN', chapter: 1, verse: 99, text: 'Added.' });
    gen.verses = gen.verses.filter(v => !(v.chapter === 1 && v.verse === 2));
  });
  edit('res/commentaries/henry/ROM/8.json', c => {
    c.sections[0].start = 2;
    c.introduction[0].refs = [{ text: 'x', ref: 'GEN.1.1' }];
    c.sections[0].paragraphs[0].heading = true;
  });
  edit('res/confessions/wcf/wcf.json', w => {
    w.sections[0].sections[0].content = 'Changed.';
    w.sections[0].sections[1].proofs[0].refs = ['GEN.1.1'];
  });
  edit('res/strongs/hebrew/hebrew.json', h => {
    h.entries[0].definition = 'father';
    h.entries.splice(1, 1);
  });
  edit('res/strongs/greek/greek.json', g => {
    g.entries[0].gloss = 'Omega';
    g.entries[1].partOfSpeech = 'Verb';
    g.entries.splice(2, 1);
  });
  const x = new Explorer({ root });

  const kjv = x.inspect('kjv', 'GEN 1');
  const verdict = key => kjv.units.find(u => u.key === key).verdict;
  assert.match(verdict('GEN 1:1'), /text differs/);
  assert.equal(verdict('GEN 1:2'), 'in the source but not in the output');
  assert.equal(verdict('GEN 1:99'), 'not in the source');
  assert.equal(kjv.summary.failed, 3);

  const henry = x.inspect('henry', 'ROM 8');
  assert.equal(henry.sections[0].ok, false);
  assert.ok(henry.units.some(u => /^references differ/.test(u.verdict ?? '')));
  assert.ok(henry.units.some(u => /^kind: the source has a paragraph, the output a title/.test(u.verdict ?? '')));

  const wcf = x.inspect('wcf', '1');
  assert.equal(wcf.units.find(u => u.key === '1.1').verdict, 'the plain text differs');
  assert.equal(wcf.units.find(u => u.key === '1.2').verdict, 'a proof reference differs');
  const otherChapter = x.inspect('wcf', '33');
  assert.equal(otherChapter.summary.failed, 0);

  const g = x.inspect('strongs-greek', 'G1');
  assert.equal(g.units[0].verdict, 'gloss differs');
  assert.equal(g.units[1].verdict, 'part of speech differs');
  assert.equal(g.units[2].verdict, 'in the source but not in the output');
  assert.match(g.units[0].notes[2], /gloss: Omega \(source: Alpha\)/);

  const hb = x.inspect('strongs-hebrew', 'H1');
  assert.equal(hb.units[0].verdict, 'the definition should be left out');
  assert.equal(hb.units[1].verdict, 'in the source but not in the output');
  assert.equal(x.inspect('bsb', 'GEN 1').summary.failed, 0);
});
