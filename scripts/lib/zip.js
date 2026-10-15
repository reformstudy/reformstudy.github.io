/**
 * Minimal ZIP reader for the ingest scripts: stored and deflated entries,
 * no encryption, no ZIP64. Enough for published Bible archives, without
 * adding a dependency.
 */

import zlib from 'zlib';

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

/** Read every file in a ZIP into a Map of name -> Buffer. */
export function readZip(buffer) {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a ZIP file (no end-of-directory record)');

  const count = buffer.readUInt16LE(eocd + 10);
  let p = buffer.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let n = 0; n < count; n++) {
    if (buffer.readUInt32LE(p) !== CENTRAL) throw new Error('Corrupt ZIP central directory');
    const method = buffer.readUInt16LE(p + 10);
    const compressedSize = buffer.readUInt32LE(p + 20);
    const size = buffer.readUInt32LE(p + 24);
    const nameLength = buffer.readUInt16LE(p + 28);
    const extraLength = buffer.readUInt16LE(p + 30);
    const commentLength = buffer.readUInt16LE(p + 32);
    const localOffset = buffer.readUInt32LE(p + 42);
    const name = buffer.toString('utf8', p + 46, p + 46 + nameLength);
    p += 46 + nameLength + extraLength + commentLength;

    if (name.endsWith('/')) continue;
    if (name.startsWith('/') || name.split('/').includes('..')) throw new Error(`Unsafe path in ZIP: ${name}`);
    if (buffer.readUInt32LE(localOffset) !== LOCAL) throw new Error(`Corrupt ZIP entry: ${name}`);
    const start = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
    const raw = buffer.subarray(start, start + compressedSize);
    let data;
    if (method === 0) data = Buffer.from(raw);
    else if (method === 8) data = zlib.inflateRawSync(raw);
    else throw new Error(`Unsupported compression method ${method} for ${name}`);
    if (data.length !== size) throw new Error(`Size mismatch for ${name}`);
    files.set(name, data);
  }
  return files;
}
