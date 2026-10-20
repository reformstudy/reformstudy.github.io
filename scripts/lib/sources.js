/**
 * The committed copies of every downloaded source, under sources/{id}/.
 *
 * Ingest and authentication read these files, so both work offline and give
 * the same result on every machine. Each file is the publisher's download,
 * byte for byte: archives (.zip) are kept as they are, and text files are
 * gzip-compressed (file.gz), which changes nothing once decompressed. Before
 * use, the files are checked against the SHA-256 recorded for the source in
 * provenance/registry.json.
 *
 * `--download` fetches the files again from the URLs listed in the registry
 * ("downloads"), checks them the same way, and replaces the stored copies.
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { fetchBuffer } from './io.js';
import { checkLock, digestFiles, loadRegistry, sha256 } from './lock.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.join(__dirname, '../..');
export const SOURCES_DIR = path.join(ROOT, 'sources');

/** The stored name of a downloaded file: archives as they are, anything else gzipped. */
export const storedName = file => (file.endsWith('.zip') ? file : `${file}.gz`);

/** The files a source is made of, from the registry: [{ file, url }]. */
export function downloadsOf(id, registry = loadRegistry()) {
  const entry = registry.sources?.[id];
  if (!entry) throw new Error(`No sources.${id} in provenance/registry.json`);
  if (!entry.downloads?.length) throw new Error(`sources.${id} lists no downloads`);
  return entry.downloads;
}

/**
 * One checksum for a source: the file's own SHA-256 when there is one file,
 * otherwise the digest of the set (see digestFiles).
 */
export function sourceChecksum(files) {
  if (files.size === 1) return { sha256: sha256([...files.values()][0]), files: 1 };
  return digestFiles(files);
}

/** Read the committed copies of a source: Map of file name -> original bytes. */
export function readStoredSource(id, { dir = SOURCES_DIR, registry } = {}) {
  const files = new Map();
  for (const { file } of downloadsOf(id, registry)) {
    const stored = path.join(dir, id, storedName(file));
    if (!fs.existsSync(stored)) {
      throw new Error(`Missing ${path.relative(ROOT, stored)}. Run the ingest script with --download to fetch it.`);
    }
    const data = fs.readFileSync(stored);
    files.set(file, stored.endsWith('.gz') ? zlib.gunzipSync(data) : data);
  }
  return files;
}

/** Write the committed copies of a source, replacing whatever was there. */
export function storeSource(id, files, { dir = SOURCES_DIR } = {}) {
  const target = path.join(dir, id);
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
  for (const [file, data] of files) {
    const stored = path.join(target, storedName(file));
    fs.writeFileSync(stored, stored.endsWith('.gz') ? zlib.gzipSync(data, { level: 9 }) : data);
  }
}

export async function downloadSource(id, { registry, fetch = fetchBuffer } = {}) {
  const files = new Map();
  for (const { file, url } of downloadsOf(id, registry)) files.set(file, await fetch(url));
  return files;
}

/**
 * The files of a source, checked against the registry. Reads the committed
 * copies, or with `download` fetches them again and stores them once they pass.
 */
export async function loadSourceFiles(id, { download = false } = {}) {
  const files = download ? await downloadSource(id) : readStoredSource(id);
  checkLock(id, sourceChecksum(files));
  if (download) storeSource(id, files);
  return files;
}
