/**
 * Download Strong's Greek and Hebrew dictionaries and write
 * res/strongs/greek/greek.json and res/strongs/hebrew/hebrew.json.
 *
 * Source: github.com/openscriptures/strongs, pinned to a commit. James
 * Strong's 1890 dictionaries are public domain; the Open Scriptures JSON
 * edition is CC-BY-SA, so it must be credited and this data shared under the
 * same license.
 *
 * Usage:
 *   node scripts/ingest/strongs.js                   # download from GitHub
 *   node scripts/ingest/strongs.js --source-dir DIR  # a local clone
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchBuffer, parseArgs, writeJson } from '../lib/io.js';
import { checkLock, sha256 } from '../lib/lock.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RES = path.join(__dirname, '../../res/strongs');
export const SOURCE_REPO = 'https://github.com/openscriptures/strongs';
export const SOURCE_COMMIT = '0acd2f251c2d35ff8db2dece4e0593979d3ac223';
const RAW_BASE = `https://raw.githubusercontent.com/openscriptures/strongs/${SOURCE_COMMIT}`;

const LANGUAGES = [
  { id: 'greek', language: 'Greek', prefix: 'G', file: 'greek/strongs-greek-dictionary.js', name: "Strong's Greek Dictionary" },
  { id: 'hebrew', language: 'Hebrew', prefix: 'H', file: 'hebrew/strongs-hebrew-dictionary.js', name: "Strong's Hebrew Dictionary" },
];

/** The source files are JavaScript: `var x = {...}; module.exports = x;`. */
export function parseDictionaryJs(js) {
  const start = js.indexOf('= {');
  const end = js.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Unrecognised dictionary file');
  return JSON.parse(js.slice(start + 2, end + 1));
}

const clean = s => (s == null ? '' : String(s).replace(/\s+/g, ' ').trim());

/** Convert one dictionary object (keyed "G1", "H1"…) into the app's concordance format. */
export function convertDictionary(dict, lang) {
  const entries = Object.entries(dict)
    .filter(([key]) => key.startsWith(lang.prefix))
    .map(([key, e]) => {
      const entry = {
        number: key,
        lemma: clean(e.lemma),
        transliteration: clean(e.translit ?? e.xlit),
        pronunciation: clean(e.pron),
        definition: clean(e.strongs_def),
        kjvDefinition: clean(e.kjv_def),
        derivation: clean(e.derivation),
      };
      for (const k of Object.keys(entry)) if (entry[k] === '') delete entry[k];
      return entry;
    })
    .sort((a, b) => Number(a.number.slice(1)) - Number(b.number.slice(1)));
  return {
    concordance: {
      id: lang.id,
      name: lang.name,
      language: lang.language,
      totalEntries: entries.length,
      version: '1890',
      source: { name: 'Open Scriptures', url: `${SOURCE_REPO}/tree/${SOURCE_COMMIT}` },
      license: 'CC-BY-SA (Open Scriptures JSON edition); the 1890 text is public domain',
    },
    entries,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  for (const lang of LANGUAGES) {
    const raw = args['source-dir']
      ? fs.readFileSync(path.join(args['source-dir'], lang.file))
      : await fetchBuffer(`${RAW_BASE}/${lang.file}`);
    checkLock(`strongs-${lang.id}`, { source: `${SOURCE_REPO}@${SOURCE_COMMIT}/${lang.file}`, sha256: sha256(raw), files: 1 });
    const js = raw.toString('utf8');
    const out = convertDictionary(parseDictionaryJs(js), lang);
    const file = path.join(RES, lang.id, `${lang.id}.json`);
    writeJson(file, out);
    console.log(`Wrote ${file} (${out.entries.length} entries)`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
