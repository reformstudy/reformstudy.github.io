/**
 * Authentication: proof that everything in res/ (and, after a build, in
 * docs/resources/) is the sources' text, verbatim.
 *
 *   1. Sources. Every committed file in sources/ matches the SHA-256 the
 *      registry records for it.
 *   2. Reproduction. Running every converter on those files gives res/
 *      exactly, byte for byte, with no file missing or extra.
 *   3. Verbatim. Reading each source again, by separate code (this folder),
 *      every verse, title, paragraph, section and entry in res/ is the
 *      source's text, apart from the named exceptions in compare.js; every
 *      character the source has is either kept or left out under a named,
 *      counted category; and derived fields (references, verse ranges, parts
 *      of speech, proof texts) agree with what the source says.
 *   4. Site. docs/resources/, when built, carries exactly the content of res/.
 *
 * Usage: node scripts/authenticate/index.js [--site docs/resources]
 * Exits with an error if anything fails.
 */

import fs from 'fs';
import path from 'path';
import { compareOutputs, filesUnder, resContext } from '../lib/pipeline.js';
import { ROOT, readStoredSource, sourceChecksum } from '../lib/sources.js';
import { parseArgs } from '../lib/io.js';
import { pipeline as kjv } from '../ingest/kjv.js';
import { pipeline as bsb } from '../ingest/bsb.js';
import { pipeline as wcf } from '../ingest/wcf.js';
import { pipeline as henry, VOLUMES, verseCounter } from '../ingest/henry.js';
import { LANGUAGES, pipeline as strongs } from '../ingest/strongs.js';
import { authenticateBible, authenticatePsalmTitles, authenticateWordTags, readBibleZip, readPlainTextBible } from './bibles.js';
import { readUsxBook } from './bible-sources.js';
import { readZip } from '../lib/zip.js';
import { authenticateConfession } from './confessions.js';
import { authenticateCommentary } from './commentaries.js';
import { authenticateLexicon } from './lexicons.js';
import { authenticateSite } from './site.js';

export const PIPELINES = [kjv, bsb, wcf, henry, strongs];

/** The exceptions each resource's text is allowed (compare.js). */
export const RESOURCE_EXCEPTIONS = {
  kjv: ['pilcrow', 'punctuation spacing'],
  bsb: [],
  wcf: [],
  henry: [],
  strongs: ['STEPBible indentation'],
};

const plural = (n, word) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

/**
 * Run every check. Returns { ok, report: [{ id, checks: [{ name, problems, detail }] , excluded }] }.
 * `root` is the repository; `site` an optional built docs/resources/ folder.
 */
export function authenticate({ root = ROOT, site = null, sourcesDir } = {}) {
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'provenance/registry.json'), 'utf8'));
  const report = [];
  const files = new Map();

  // 1. Sources
  const sourceProblems = [];
  for (const id of Object.keys(registry.sources)) {
    try {
      const f = readStoredSource(id, { registry, dir: sourcesDir ?? path.join(root, 'sources') });
      const { sha256 } = sourceChecksum(f);
      if (sha256 !== registry.sources[id].sha256) sourceProblems.push(`${id}: sha256 ${sha256}, the registry has ${registry.sources[id].sha256}`);
      files.set(id, f);
    } catch (err) {
      sourceProblems.push(`${id}: ${err.message}`);
    }
  }
  report.push({ id: 'sources', checks: [{ name: `${plural(files.size, 'source')} match their recorded SHA-256`, problems: sourceProblems }] });
  if (sourceProblems.length) return { ok: false, report };

  // 2. Reproduction
  const ctx = resContext(root);
  for (const p of PIPELINES) {
    const entry = { id: p.id, checks: [] };
    report.push(entry);
    let problems;
    try {
      const { outputs } = p.generate(new Map(p.sources.map(s => [s, files.get(s)])), ctx);
      problems = compareOutputs(p, outputs, root);
      entry.checks.push({ name: `res/ is exactly what the converter produces (${plural(outputs.size, 'file')})`, problems });
    } catch (err) {
      entry.checks.push({ name: 'the converter runs', problems: [err.message] });
    }
  }

  // 3. Verbatim and derived fields
  const json = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
  const entry = id => report.find(r => r.id === id);
  const guard = (id, name, fn) => {
    try { fn(); } catch (err) { entry(id).checks.push({ name, problems: [err.message] }); }
  };

  guard('kjv', 'the source can be read', () => {
    const src = readBibleZip(files.get('kjv').get('eng-kjv_usfm.zip'), 'usfm');
    const bible = json('res/bibles/kjv/kjv.json');
    const r = authenticateBible(bible, src, RESOURCE_EXCEPTIONS.kjv);
    entry('kjv').checks.push({ name: `${plural(r.verses, 'verse')} and ${plural(r.titles, 'Psalm title')} are the source's text`, problems: r.problems });
    const w = authenticateWordTags(bible, src.units, RESOURCE_EXCEPTIONS.kjv);
    entry('kjv').checks.push({ name: `${plural(w.words, 'word')} carry the source's Strong's numbers (${plural(w.untagged, 'tagged word')} in Psalm titles not linked)`, problems: w.problems });
    entry('kjv').excluded = src.units.excluded;
  });
  guard('bsb', 'the source can be read', () => {
    const bible = json('res/bibles/bsb/bsb.json');
    const src = readPlainTextBible(files.get('bsb').get('bsb.txt').toString('utf8'));
    const r = authenticateBible(bible, src, RESOURCE_EXCEPTIONS.bsb, { titlesInVerseOne: true });
    entry('bsb').checks.push({ name: `${plural(r.verses, 'verse')} and ${plural(r.titles, 'Psalm title')} are the plain text's, verbatim (${plural(r.empty, 'verse')} the publisher leaves empty)`, problems: r.problems });
    const usx = [...readZip(files.get('bsb').get('bsb_usx.zip')).values()].map(d => d.toString('utf8')).find(t => /<book\b[^>]*\bcode="PSA"/.test(t));
    entry('bsb').checks.push({ name: 'each Psalm title ends where the USX marks it', problems: authenticatePsalmTitles(bible, readUsxBook(usx, 'PSA')) });
    entry('bsb').excluded = src.units.excluded;
  });
  guard('wcf', 'the source can be read', () => {
    const source = JSON.parse(files.get('wcf').get('westminster_confession_of_faith.json').toString('utf8'));
    const r = authenticateConfession(json('res/confessions/wcf/wcf.json'), source, json('res/bibles/kjv/kjv.json'));
    entry('wcf').checks.push({ name: `${plural(r.sections, 'section')} and ${plural(r.proofs, 'proof text')} are the source's text and references`, problems: r.problems });
  });
  guard('henry', 'the source can be read', () => {
    const dir = 'res/commentaries/henry';
    const outputs = new Map(filesUnder(dir, root).filter(f => f.endsWith('.json')).map(f => [f, json(f)]));
    const volumes = VOLUMES.map(v => files.get('henry').get(v).toString('utf8'));
    const r = authenticateCommentary(outputs, volumes, verseCounter(json('res/bibles/kjv/kjv.json')), dir);
    entry('henry').checks.push({ name: `${plural(r.units, 'paragraph')} and titles in ${plural(r.chapters, 'chapter')} are the source's text, with its references and verse ranges`, problems: r.problems });
    entry('henry').excluded = r.excluded;
  });
  guard('strongs', 'the source can be read', () => {
    const excluded = new Map();
    for (const lang of LANGUAGES) {
      const tsv = files.get(lang.source).get(lang.file).toString('utf8');
      const r = authenticateLexicon(json(lang.output), tsv, lang);
      entry('strongs').checks.push({ name: `${plural(r.entries, `${lang.language} entry`).replace(/entrys$/, 'entries')} are STEPBible's text, with parts of speech from its codes`, problems: r.problems });
      for (const [k, n] of r.excluded) excluded.set(`${lang.language}: ${k}`, n);
    }
    entry('strongs').excluded = excluded;
  });

  // 4. Site
  if (site) {
    const r = authenticateSite(root, site);
    report.push({ id: 'site', checks: [{ name: `${path.relative(root, site)} carries res/ unchanged (${plural(r.files, 'file')})`, problems: r.problems }] });
  }

  const ok = report.every(r => r.checks.every(c => !c.problems.length));
  return { ok, report };
}

/** Print a report: each check with ✓ or ✗, problems (up to `limit` each), and what was left out. */
export function printReport({ ok, report }, { limit = 20, log = console.log } = {}) {
  for (const r of report) {
    log(`${r.id}`);
    for (const c of r.checks) {
      log(`  ${c.problems.length ? '✗' : '✓'} ${c.name}`);
      for (const p of c.problems.slice(0, limit)) log(`      ${p}`);
      if (c.problems.length > limit) log(`      …and ${c.problems.length - limit} more`);
    }
    if (r.excluded?.size) {
      const parts = [...r.excluded].map(([k, n]) => `${k} ${n.toLocaleString()}`);
      log(`    left out by name (characters): ${parts.join('; ')}`);
    }
  }
  log(ok ? 'Authentication passed.' : 'Authentication FAILED.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const site = args.site ? path.resolve(args.site) : null;
  const result = authenticate({ site });
  printReport(result);
  if (!result.ok) process.exit(1);
}
