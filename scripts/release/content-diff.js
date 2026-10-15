/**
 * What content would change if the current tree were released: compares res/
 * at a git ref (usually the live release tag) with the working tree.
 *
 *   npm run content:diff -- v0.1.0          summary
 *   npm run content:diff -- v0.1.0 --json   the full JSON (what the preview site shows)
 *
 * Bibles are compared verse by verse, confessions section by section (text and
 * proof references), Strong's entry by entry; other files (Henry's chapters,
 * READMEs) by file.
 */

import crypto from 'crypto';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.join(__dirname, '../..');
const MAX_ITEMS = 200;

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 30 });

/** Git's blob id for file content, so working-tree files compare with a tree listing without spawning git per file. */
export const blobId = data => crypto.createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');

/** Map<path, blob id> for res/ at a ref. */
export function treeAt(ref) {
  const out = new Map();
  for (const line of git('ls-tree', '-r', ref, '--', 'res').split('\n')) {
    const m = line.match(/^\d+ blob ([0-9a-f]+)\t(.+)$/);
    if (m) out.set(m[2], m[1]);
  }
  return out;
}

/** Map<path, blob id> for res/ in the working tree. */
export function workingTree(dir = path.join(ROOT, 'res')) {
  const out = new Map();
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.set(path.relative(ROOT, p).split(path.sep).join('/'), blobId(fs.readFileSync(p)));
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return out;
}

/** "res/bibles/kjv/kjv.json" -> "kjv"; "res/strongs/greek/…" -> "strongs-greek"; "res/SOURCES.md" -> "docs". */
export function resourceOf(file) {
  const parts = file.split('/');
  if (parts.length < 4) return 'docs';
  return parts[1] === 'strongs' ? `strongs-${parts[2]}` : parts[2];
}

// ---- unit maps for the formats we know ----

function bibleUnits(json) {
  const m = new Map();
  for (const b of json.books ?? []) {
    for (const [c, t] of Object.entries(b.subtitles ?? {})) m.set(`${b.id} ${c} (title)`, t);
    for (const v of b.verses) m.set(`${b.id} ${v.chapter}:${v.verse}`, v.text);
  }
  return m;
}

function confessionUnits(json) {
  const m = new Map();
  for (const ch of json.sections ?? []) {
    for (const s of ch.sections) {
      m.set(s.number, s.content);
      const refs = (s.proofs ?? []).map(p => `[${p.id}] ${p.refs.join(', ')}`).join('; ');
      if (refs) m.set(`${s.number} proofs`, refs);
    }
  }
  return m;
}

function strongsUnits(json) {
  const m = new Map();
  for (const e of json.entries ?? []) {
    m.set(e.number, [e.lemma, e.transliteration, e.definition, e.kjvDefinition].filter(Boolean).join(' · '));
  }
  return m;
}

export function unitsOf(file, text) {
  if (!/\.json$/.test(file)) return null;
  const json = JSON.parse(text);
  if (/^res\/bibles\/[^/]+\/[^/]+\.json$/.test(file)) return bibleUnits(json);
  if (/^res\/confessions\/[^/]+\/[^/]+\.json$/.test(file)) return confessionUnits(json);
  if (/^res\/strongs\/[^/]+\/[^/]+\.json$/.test(file)) return strongsUnits(json);
  return null;
}

export function compareUnits(before, after) {
  const items = [];
  const counts = { added: 0, removed: 0, changed: 0 };
  for (const [unit, a] of after) {
    if (!before.has(unit)) { counts.added++; items.push({ unit, after: a }); } else if (before.get(unit) !== a) { counts.changed++; items.push({ unit, before: before.get(unit), after: a }); }
  }
  for (const [unit, b] of before) if (!after.has(unit)) { counts.removed++; items.push({ unit, before: b }); }
  return { counts, items };
}

/**
 * Compare res/ at `ref` with the working tree.
 * @param {string} ref a tag, branch or commit
 * @param {object} [opts] { titles: Record<id, title> }
 */
export function contentDiff(ref, { titles = {} } = {}) {
  const commit = git('rev-parse', '--short', `${ref}^{commit}`).trim();
  const before = treeAt(ref);
  const after = workingTree();
  const byResource = new Map();
  const entry = id => {
    if (!byResource.has(id)) byResource.set(id, { id, title: titles[id] ?? id, files: { added: [], removed: [], changed: [] }, units: { added: 0, removed: 0, changed: 0 }, items: [] });
    return byResource.get(id);
  };

  for (const file of new Set([...before.keys(), ...after.keys()])) {
    const b = before.get(file);
    const a = after.get(file);
    if (a === b) continue;
    const r = entry(resourceOf(file));
    if (!b) r.files.added.push(file);
    else if (!a) r.files.removed.push(file);
    else r.files.changed.push(file);
    if (!a || !b) continue;
    const oldUnits = unitsOf(file, git('cat-file', 'blob', b));
    const newUnits = oldUnits && unitsOf(file, fs.readFileSync(path.join(ROOT, file), 'utf8'));
    if (!oldUnits || !newUnits) continue;
    const { counts, items } = compareUnits(oldUnits, newUnits);
    for (const k of Object.keys(counts)) r.units[k] += counts[k];
    r.items.push(...items);
  }

  const resources = [...byResource.values()].map(r => {
    const total = r.items.length;
    const items = r.items.slice(0, MAX_ITEMS);
    return { ...r, items, ...(total > items.length ? { moreItems: total - items.length } : {}) };
  }).sort((x, y) => x.id.localeCompare(y.id));
  return { against: { ref, commit }, resources };
}

function summarize(diff) {
  const lines = [`Content changes since ${diff.against.ref} (${diff.against.commit}):`];
  if (!diff.resources.length) lines.push('  none');
  for (const r of diff.resources) {
    const f = r.files;
    const u = r.units;
    const unitText = u.added + u.removed + u.changed ? `; ${u.changed} changed, ${u.added} added, ${u.removed} removed (verses, sections or entries)` : '';
    lines.push(`  ${r.title}: ${f.changed.length} file(s) changed, ${f.added.length} added, ${f.removed.length} removed${unitText}`);
  }
  return lines.join('\n');
}

async function main() {
  const argv = process.argv.slice(2);
  const ref = argv.find(a => !a.startsWith('--'));
  if (!ref) throw new Error('Usage: npm run content:diff -- <ref> [--json]   (e.g. the live release tag, v0.1.0)');
  const diff = contentDiff(ref);
  console.log(argv.includes('--json') ? JSON.stringify(diff, null, 1) : summarize(diff));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}
