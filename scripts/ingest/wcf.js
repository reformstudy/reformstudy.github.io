/**
 * Download the Westminster Confession of Faith (1647) with its proof texts and
 * write res/confessions/wcf/wcf.json.
 *
 * Source: github.com/NonlinearFruit/Creeds.json, pinned to a commit. The text
 * is public domain; the repository is under the Unlicense.
 *
 * Each section keeps the Assembly's footnote markers ([1], [2]…) in
 * `contentWithProofs`, and each footnote's references in `proofs`, in the
 * app's compact form ("PSA.19.1-3"), so the reader can show them in any
 * translation. `proofTexts` is the same list flattened with KJV text filled
 * in, for screens that show the text directly. Run after scripts/ingest/kjv.js.
 *
 * Before converting, the corrections in wcf-corrections.json are applied:
 * places where the 1649 printing and an independent transcription agree with
 * each other against Creeds.json (see that file and res/SOURCES.md).
 *
 * Usage:
 *   node scripts/ingest/wcf.js                 # download from GitHub
 *   node scripts/ingest/wcf.js --input FILE    # use a saved westminster_confession_of_faith.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compactRef, displayRef, parseOsisRef, versesInRef } from '../lib/refs.js';
import { fetchBuffer, parseArgs, writeJson } from '../lib/io.js';
import { checkLock, sha256 } from '../lib/lock.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(__dirname, '../../res/confessions/wcf/wcf.json');
const KJV = path.join(__dirname, '../../res/bibles/kjv/kjv.json');
const CORRECTIONS = path.join(__dirname, 'wcf-corrections.json');
export const SOURCE_COMMIT = '2ae21a4c5387ecc91f474c9d3d67c826d2a6b9d5';
export const SOURCE_URL = `https://raw.githubusercontent.com/NonlinearFruit/Creeds.json/${SOURCE_COMMIT}/creeds/westminster_confession_of_faith.json`;

/**
 * Apply text and proof-reference corrections to the Creeds.json source.
 * Every correction must match exactly once, so a changed source fails loudly
 * instead of being corrected in the wrong place.
 */
export function applyWcfCorrections(source, corrections) {
  const out = JSON.parse(JSON.stringify(source));
  const sections = new Map();
  for (const ch of out.Data) for (const s of ch.Sections) sections.set(`${Number(ch.Chapter)}.${Number(s.Section)}`, s);
  const find = num => {
    const s = sections.get(num);
    if (!s) throw new Error(`WCF correction: no section ${num}`);
    return s;
  };

  for (const c of corrections.text ?? []) {
    const s = find(c.section);
    for (const field of ['Content', 'ContentWithProofs']) {
      if (s[field] === undefined) continue;
      const count = s[field].split(c.from).length - 1;
      if (count !== 1) throw new Error(`WCF ${c.section}: "${c.from}" appears ${count} times in ${field}, expected once`);
      s[field] = s[field].replace(c.from, c.to);
    }
  }

  for (const c of corrections.proofs ?? []) {
    const proof = (find(c.section).Proofs ?? []).find(p => p.Id === c.footnote);
    if (!proof) throw new Error(`WCF ${c.section}: no footnote [${c.footnote}]`);
    const at = proof.References.indexOf(c.replace[0]);
    if (at < 0 || c.replace.some(r => !proof.References.includes(r))) {
      throw new Error(`WCF ${c.section} [${c.footnote}]: expected ${c.replace.join(', ')} in ${proof.References.join(', ')}`);
    }
    const kept = proof.References.filter(r => !c.replace.includes(r));
    kept.splice(Math.min(at, kept.length), 0, ...c.with);
    proof.References = kept;
  }
  return out;
}

/** Look up verse text in an app-format Bible. */
export function verseLookup(bible) {
  const map = new Map();
  const counts = new Map();
  for (const book of bible.books) {
    for (const v of book.verses) {
      map.set(`${book.id}.${v.chapter}.${v.verse}`, v.text);
      const key = `${book.id}.${v.chapter}`;
      counts.set(key, Math.max(counts.get(key) ?? 0, v.verse));
    }
  }
  return {
    text: (book, chapter, verse) => map.get(`${book}.${chapter}.${verse}`),
    count: (book, chapter) => counts.get(`${book}.${chapter}`) ?? 0,
  };
}

/** Convert Creeds.json's WCF into the app's Confession format. */
export function convertWcf(source, kjv) {
  const lookup = verseLookup(kjv);
  const problems = [];

  const resolve = (osis, where) => {
    const r = parseOsisRef(osis);
    if (!r) {
      problems.push(`${where}: can't read reference "${osis}"`);
      return null;
    }
    const verses = versesInRef(r, c => lookup.count(r.book, c));
    const texts = verses.map(([c, v]) => lookup.text(r.book, c, v));
    if (!verses.length || texts.some(t => t === undefined)) {
      problems.push(`${where}: "${osis}" points past the end of a chapter or book`);
      return null;
    }
    return { reference: displayRef(r), ref: compactRef(r), text: texts.join(' ') };
  };

  const chapters = source.Data.map(ch => {
    const chapter = Number(ch.Chapter);
    return {
      chapter,
      title: ch.Title,
      sections: ch.Sections.map(s => {
        const number = `${chapter}.${Number(s.Section)}`;
        const proofs = [];
        const proofTexts = [];
        for (const p of [...(s.Proofs ?? [])].sort((a, b) => a.Id - b.Id)) {
          const refs = [];
          for (const osis of p.References) {
            const pt = resolve(osis, `WCF ${number} [${p.Id}]`);
            if (!pt) continue;
            refs.push(pt.ref);
            proofTexts.push({ ...pt, footnote: p.Id });
          }
          proofs.push({ id: p.Id, refs });
        }
        return {
          number,
          content: s.Content,
          contentWithProofs: s.ContentWithProofs ?? s.Content,
          proofs,
          proofTexts,
        };
      }),
    };
  });

  if (problems.length) throw new Error(`WCF proof texts:\n  ${problems.join('\n  ')}`);

  return {
    confession: {
      id: 'wcf',
      name: 'Westminster Confession of Faith',
      abbreviation: 'WCF',
      year: 1647,
      origin: 'Westminster Assembly, London',
      description: 'The confession of faith drafted by the Westminster Assembly and presented to Parliament in 1646, with the Scripture proofs added in 1647. This is the original 1647 text.',
      chapters: chapters.length,
      source: { name: 'NonlinearFruit/Creeds.json', url: `https://github.com/NonlinearFruit/Creeds.json/tree/${SOURCE_COMMIT}` },
    },
    sections: chapters,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const raw = args.input ? fs.readFileSync(args.input) : await fetchBuffer(SOURCE_URL);
  checkLock('wcf', { source: SOURCE_URL, sha256: sha256(raw), files: 1 });
  const source = JSON.parse(raw.toString('utf8'));
  if (!fs.existsSync(KJV)) throw new Error('Run scripts/ingest/kjv.js first: the proof texts are filled in from the KJV.');
  const kjv = JSON.parse(fs.readFileSync(KJV, 'utf8'));
  const corrections = JSON.parse(fs.readFileSync(CORRECTIONS, 'utf8'));
  const wcf = convertWcf(applyWcfCorrections(source, corrections), kjv);
  wcf.confession.corrections = { text: corrections.text.length, proofs: corrections.proofs.length, file: 'scripts/ingest/wcf-corrections.json' };
  writeJson(OUTPUT, wcf);
  const sections = wcf.sections.reduce((n, c) => n + c.sections.length, 0);
  const refs = wcf.sections.reduce((n, c) => n + c.sections.reduce((m, s) => m + s.proofTexts.length, 0), 0);
  console.log(`Wrote ${OUTPUT} (${wcf.sections.length} chapters, ${sections} sections, ${refs} proof references)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
