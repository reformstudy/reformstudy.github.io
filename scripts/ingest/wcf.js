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
 * The text is used as published. This source is interim: no openly licensed
 * publisher edition with proofs has been found yet (res/SOURCES.md).
 *
 * Usage:
 *   node scripts/ingest/wcf.js              # convert the committed copy in sources/wcf/
 *   node scripts/ingest/wcf.js --download   # fetch it again from GitHub first
 */

import { compactRef, displayRef, parseOsisRef, versesInRef } from '../lib/refs.js';
import { jsonText } from '../lib/io.js';
import { runAsScript } from '../lib/pipeline.js';

export const OUTPUT = 'res/confessions/wcf/wcf.json';
export const KJV = 'res/bibles/kjv/kjv.json';
export const SOURCE_FILE = 'westminster_confession_of_faith.json';
export const SOURCE_COMMIT = '2ae21a4c5387ecc91f474c9d3d67c826d2a6b9d5';

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

export const pipeline = {
  id: 'wcf',
  sources: ['wcf'],
  owns: [OUTPUT],
  /** ctx.readJson reads the KJV this pipeline fills proof texts from. */
  generate(files, ctx) {
    const source = JSON.parse(files.get('wcf').get(SOURCE_FILE).toString('utf8'));
    const wcf = convertWcf(source, ctx.readJson(KJV));
    const sections = wcf.sections.reduce((n, c) => n + c.sections.length, 0);
    const refs = wcf.sections.reduce((n, c) => n + c.sections.reduce((m, s) => m + s.proofTexts.length, 0), 0);
    return { outputs: new Map([[OUTPUT, jsonText(wcf)]]), summary: `${wcf.sections.length} chapters, ${sections} sections, ${refs} proof references` };
  },
};

runAsScript(import.meta, pipeline);
