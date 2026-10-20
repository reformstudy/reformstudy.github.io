/**
 * Tests for the shared ingest helpers (scripts/lib/) and the remaining paths
 * of authentication: downloads, checksums, the ingest runner, ZIP reading,
 * reference parsing, and a broken repository.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { bibleFileText, fetchBuffer, jsonText, normalizeText, parseArgs, writeJson } from '../lib/io.js';
import { checkLock, loadRegistry, REGISTRY_FILE, saveRegistry } from '../lib/lock.js';
import { pipelineSources, runAsScript, runPipeline } from '../lib/pipeline.js';
import { loadSourceFiles, ROOT } from '../lib/sources.js';
import { parseCompactRef, parseOsisRef } from '../lib/refs.js';
import { readZip } from '../lib/zip.js';
import { authenticate } from '../authenticate/index.js';
import { readVolume } from '../authenticate/commentaries.js';
import { readUsxBook } from '../authenticate/bible-sources.js';
import { authenticateLexicon } from '../authenticate/lexicons.js';
import { convertLexicon, parseLexicon } from '../ingest/strongs.js';
import { convertVolume } from '../ingest/henry.js';
import { GREEK, HENRY_THML, LEXICON_TSV } from './fixtures.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rs-lib-'));

test('fetchBuffer returns the body, allows a missing file when asked, and gives up after retries', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    calls.push(url);
    if (url.endsWith('ok')) return new Response('body');
    if (url.endsWith('missing')) return new Response('', { status: 404 });
    return new Response('', { status: 500 });
  });
  assert.equal((await fetchBuffer('https://x/ok')).toString(), 'body');
  assert.equal(await fetchBuffer('https://x/missing', { allowMissing: true }), null);
  await assert.rejects(fetchBuffer('https://x/missing', { retries: 0 }), /HTTP 404/);
  await assert.rejects(fetchBuffer('https://x/broken', { retries: 1 }), /HTTP 500 for https:\/\/x\/broken/);
  assert.equal(calls.filter(u => u.endsWith('broken')).length, 2);
});

test('parseArgs, normalizeText and the JSON writers', () => {
  assert.deepEqual(parseArgs(['--download', '--site', 'docs/resources', 'x', '--flag']), { download: true, site: 'docs/resources', flag: true });
  assert.equal(normalizeText(' a \n b '), 'a b');
  const dir = tmp();
  const file = path.join(dir, 'a/b.json');
  writeJson(file, { a: [1] });
  assert.equal(fs.readFileSync(file, 'utf8'), jsonText({ a: [1] }));
  const bible = { version: { id: 'x' }, books: [{ id: 'GEN', verses: [{ chapter: 1, verse: 1, text: 'a' }, { chapter: 1, verse: 2, text: 'b' }] }, { id: 'EXO', verses: [] }] };
  const text = bibleFileText(bible);
  assert.deepEqual(JSON.parse(text), bible);
  assert.equal(text.split('\n').filter(l => l.includes('"verse"')).length, 2, 'one verse per line');
});

test('checkLock records a new checksum only when updating, and needs one otherwise', () => {
  const file = path.join(tmp(), 'registry.json');
  saveRegistry({ sources: { a: { sha256: null } } }, file);
  assert.throws(() => checkLock('a', { sha256: 'abc', files: 1 }, { update: false, file }), /No checksum recorded/);
  checkLock('a', { sha256: 'abc', files: 1 }, { update: true, file });
  assert.deepEqual(loadRegistry(file).sources.a, { sha256: 'abc', fileCount: 1 });
  checkLock('a', { sha256: 'abc', files: 1 }, { update: false, file });
  checkLock('a', { sha256: 'abc', files: 1 }, { update: true, file });
  assert.equal(REGISTRY_FILE, path.join(ROOT, 'provenance/registry.json'));
});

test('loadSourceFiles and pipelineSources read the committed copies and check them', async () => {
  const files = await loadSourceFiles('wcf');
  assert.ok(files.get('westminster_confession_of_faith.json').length > 1000);
  const both = await pipelineSources({ sources: ['wcf', 'strongs-greek'] });
  assert.deepEqual([...both.keys()], ['wcf', 'strongs-greek']);
});

test('runPipeline writes what generate returns, with its notes', async () => {
  const root = tmp();
  const lines = [];
  const pipeline = {
    id: 'demo', sources: ['wcf'], owns: ['res/demo'],
    generate: files => ({ outputs: new Map([['res/demo/size.json', jsonText({ files: files.get('wcf').size })]]), notes: ['a note'], summary: 'one file' }),
  };
  fs.mkdirSync(path.join(root, 'res/demo'), { recursive: true });
  fs.writeFileSync(path.join(root, 'res/demo/old.json'), '{}');
  await runPipeline(pipeline, [], { root, log: l => lines.push(l) });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'res/demo/size.json'))), { files: 1 });
  assert.equal(fs.existsSync(path.join(root, 'res/demo/old.json')), false);
  assert.deepEqual(lines, ['  note: a note', 'demo: wrote 1 file (one file)']);
  runAsScript({ url: 'file:///not/the/script.js' }, pipeline); // imported, not run: does nothing
});

/** A ZIP built by hand: entries [name, data, method]. */
function zip(entries, { badSize = false } = {}) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, data, method] of entries) {
    const body = method === 8 ? zlib.deflateRawSync(data) : data;
    const n = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length + (badSize ? 1 : 0), 24);
    central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, n, body);
    centrals.push(central, n);
    offset += local.length + n.length + body.length;
  }
  const dir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

test('readZip reads stored and deflated entries and refuses anything odd', () => {
  const files = readZip(zip([['a.txt', Buffer.from('stored'), 0], ['d/b.txt', Buffer.from('deflated '.repeat(20)), 8]]));
  assert.equal(files.get('a.txt').toString(), 'stored');
  assert.equal(files.get('d/b.txt').toString(), 'deflated '.repeat(20));
  assert.throws(() => readZip(zip([['a', Buffer.from('x'), 12]])), /Unsupported compression method 12/);
  assert.throws(() => readZip(zip([['../a', Buffer.from('x'), 0]])), /Unsafe path/);
  assert.throws(() => readZip(zip([['a', Buffer.from('x'), 0]], { badSize: true })), /Size mismatch/);
  assert.throws(() => readZip(Buffer.from('not a zip at all, just some bytes')), /ZIP/);
});

test('OSIS references: end points with or without the book, and shapes that are refused', () => {
  assert.deepEqual(parseOsisRef('Gen.1.1-2.3'), { book: 'GEN', chapter: 1, verse: 1, endChapter: 2, endVerse: 3 });
  assert.equal(parseOsisRef('Gen.1.1-2.3.4'), null);
  assert.equal(parseOsisRef('Gen.1.1-x'), null);
  assert.equal(parseOsisRef('Gen.1.1-Exod.1.1'), null);
  assert.equal(parseOsisRef('Gen.1.1.1'), null);
  assert.equal(parseOsisRef('Gen.1.0'), null);
  assert.deepEqual(parseCompactRef('GEN.1.1-2.3'), { book: 'GEN', chapter: 1, verse: 1, endChapter: 2, endVerse: 3 });
  assert.deepEqual(parseCompactRef('PSA.19-20'), { book: 'PSA', chapter: 19, verse: null, endChapter: 20, endVerse: null });
  assert.equal(parseCompactRef('XYZ.1'), null);
  assert.equal(parseCompactRef('nonsense'), null);
});

test('rare shapes: optional breaks, text outside chapters, a definition the source lacks, two trailing titles', () => {
  const usx = '<usx><book code="PSA" style="id">x</book><chapter number="1"/><para style="p"><verse number="1"/>A<optbreak/>B</para></usx>';
  assert.equal(readUsxBook(usx, 'PSA').units.get('PSA 1:1'), 'AB');
  assert.throws(() => readVolume(HENRY_THML.replace('<div2 title="Introduction"', '<h1>Romans</h1><div2 title="Introduction"')), /<h1> outside the introduction and chapters/);
  const lexicon = convertLexicon(parseLexicon(LEXICON_TSV), GREEK);
  const tsv = LEXICON_TSV.replace('Aaron, brother of Moses', '');
  assert.match(authenticateLexicon(lexicon, tsv, GREEK).problems[0], /G2 definition: the source has none/);
  const twoTrailing = HENRY_THML.replace('<h4>Sonship.</h4></div>', '<h4>Sonship.</h4><h4>Again.</h4></div>');
  assert.throws(() => convertVolume(twoTrailing, () => 39), /two titles after the block's text/);
});

test('authentication reports a converter that cannot run and resources that are missing', () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, 'provenance'));
  fs.copyFileSync(path.join(ROOT, 'provenance/registry.json'), path.join(root, 'provenance/registry.json'));
  const result = authenticate({ root, sourcesDir: path.join(ROOT, 'sources') });
  assert.equal(result.ok, false);
  const checks = Object.fromEntries(result.report.map(r => [r.id, r.checks]));
  assert.deepEqual(checks.sources[0].problems, []);
  assert.match(checks.kjv[0].problems[0], /res\/bibles\/kjv\/kjv.json: missing/);
  assert.equal(checks.wcf[0].name, 'the converter runs');
  assert.match(checks.wcf[0].problems[0], /ENOENT/);
  assert.equal(checks.henry.at(-1).name, 'the source can be read');
});
