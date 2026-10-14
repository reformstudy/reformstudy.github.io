/**
 * Source checksums.
 *
 * scripts/ingest/sources.lock.json records the SHA-256 of exactly the source
 * files that were verified (see res/SOURCES.md). Ingest scripts check what
 * they download against it and stop if anything differs, so a moved release,
 * a rewritten commit or a tampered file can't slip into res/ unnoticed.
 *
 * After deliberately changing a source (and re-verifying it), record the new
 * checksums with UPDATE_SOURCE_LOCK=1, e.g. `UPDATE_SOURCE_LOCK=1 npm run ingest`.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const LOCK_FILE = path.join(__dirname, '../ingest/sources.lock.json');

export const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');

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

/** Compare a source's checksum with the lock file, or record it when updating. */
export function checkLock(id, entry, { update = process.env.UPDATE_SOURCE_LOCK === '1' } = {}) {
  const lock = fs.existsSync(LOCK_FILE) ? JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8')) : {};
  const recorded = lock[id];
  if (update) {
    lock[id] = entry;
    fs.writeFileSync(LOCK_FILE, JSON.stringify(lock, null, 2) + '\n');
    return;
  }
  if (!recorded) {
    throw new Error(`No checksum recorded for "${id}" in ${path.relative(process.cwd(), LOCK_FILE)}. Verify the source, then rerun with UPDATE_SOURCE_LOCK=1.`);
  }
  if (recorded.sha256 !== entry.sha256) {
    throw new Error(`Source "${id}" has changed since it was verified (sha256 ${entry.sha256}, expected ${recorded.sha256}). Re-verify it (res/SOURCES.md), then rerun with UPDATE_SOURCE_LOCK=1.`);
  }
}
