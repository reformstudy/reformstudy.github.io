/**
 * Download the witnesses listed in provenance/registry.json, pinned to their
 * commits, and check them against the recorded SHA-256. Files are cached in
 * .cache/witnesses/ (not committed), so repeat runs don't download again; the
 * checksum is checked either way.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchBuffer } from '../lib/io.js';
import { checkLock, digestFiles, loadRegistry } from '../lib/lock.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(__dirname, '../../.cache/witnesses');

/** "https://github.com/owner/repo" + commit + path -> raw file URL. */
export function rawUrl(repo, commit, file) {
  const m = repo.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)\/?$/);
  if (!m) throw new Error(`Not a GitHub repository URL: ${repo}`);
  const encoded = file.split('/').map(encodeURIComponent).join('/');
  return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${commit}/${encoded}`;
}

/** Returns Map<path, Buffer> for one witness, checked against the registry. */
export async function loadWitness(id, { registry = loadRegistry() } = {}) {
  const w = registry.witnesses[id];
  if (!w) throw new Error(`Unknown witness "${id}"`);
  const files = new Map();
  for (const file of w.paths) {
    const cached = path.join(CACHE, id, w.commit, file);
    let data;
    if (fs.existsSync(cached)) {
      data = fs.readFileSync(cached);
    } else {
      data = await fetchBuffer(rawUrl(w.repo, w.commit, file));
      fs.mkdirSync(path.dirname(cached), { recursive: true });
      fs.writeFileSync(cached, data);
    }
    files.set(file, data);
  }
  checkLock(id, digestFiles(files), { kind: 'witnesses' });
  return files;
}

/** The text of a single-file witness. */
export async function loadWitnessText(id, options) {
  const files = await loadWitness(id, options);
  return [...files.values()][0].toString('utf8').replace(/^﻿/, '');
}
