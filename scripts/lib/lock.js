/**
 * Source checksums, kept in the provenance registry.
 *
 * provenance/registry.json records, for every source and witness, where it
 * comes from and the SHA-256 of exactly the files that were verified. Ingest
 * and verify check what they download against it and stop if anything
 * differs, so a moved release, a rewritten commit or a tampered file can't
 * slip into res/ unnoticed.
 *
 * After deliberately changing a pin (and re-verifying with `npm run verify`),
 * record the new checksums with UPDATE_SOURCE_LOCK=1, e.g.
 * `UPDATE_SOURCE_LOCK=1 npm run ingest`.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REGISTRY_FILE = path.join(__dirname, '../../provenance/registry.json');

export const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');

export function loadRegistry(file = REGISTRY_FILE) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function saveRegistry(registry, file = REGISTRY_FILE) {
  fs.writeFileSync(file, JSON.stringify(registry, null, 2) + '\n');
}

/**
 * One checksum for a set of files: the SHA-256 of their sorted
 * "name sha256" lines. A missing file is recorded as "-".
 */
export function digestFiles(files) {
  const lines = [...files]
    .map(([name, data]) => `${name} ${data === null ? '-' : sha256(data)}`)
    .sort();
  return { sha256: sha256(lines.join('\n')), files: lines.length };
}

/**
 * Compare a download's checksum with the registry, or record it when updating.
 * `kind` is 'sources' (what ingest converts) or 'witnesses' (what verify compares with).
 */
export function checkLock(id, entry, {
  kind = 'sources',
  update = process.env.UPDATE_SOURCE_LOCK === '1',
  file = REGISTRY_FILE,
} = {}) {
  const registry = loadRegistry(file);
  const recorded = registry[kind]?.[id];
  const where = `${kind}.${id} in ${path.relative(process.cwd(), file)}`;
  if (!recorded) throw new Error(`No ${where}. Add its provenance there first.`);
  if (update) {
    if (recorded.sha256 !== entry.sha256) {
      recorded.sha256 = entry.sha256;
      recorded.fileCount = entry.files;
      saveRegistry(registry, file);
      console.log(`  Recorded new checksum for ${kind}.${id}`);
    }
    return;
  }
  if (!recorded.sha256) {
    throw new Error(`No checksum recorded for ${where}. Verify it, then rerun with UPDATE_SOURCE_LOCK=1.`);
  }
  if (recorded.sha256 !== entry.sha256) {
    throw new Error(`${kind === 'sources' ? 'Source' : 'Witness'} "${id}" has changed since it was verified (sha256 ${entry.sha256}, expected ${recorded.sha256}). Re-verify it (npm run verify), then rerun with UPDATE_SOURCE_LOCK=1.`);
  }
}
