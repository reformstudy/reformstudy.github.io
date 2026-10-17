/**
 * Shared helpers for the ingest scripts: downloading with retries,
 * normalizing whitespace, and resource JSON in a diff-friendly layout.
 */

import fs from 'fs';
import path from 'path';

/**
 * Download a file as a Buffer, retrying with backoff. With `allowMissing`,
 * a 404 resolves to null instead of failing.
 */
export async function fetchBuffer(url, { retries = 3, allowMissing = false } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (allowMissing && res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
      }
    }
  }
  throw lastError;
}

/** Collapse runs of whitespace (including poetry line breaks) to single spaces. */
export function normalizeText(text) {
  return String(text).replace(/\s+/g, ' ').trim();
}

/** Parse "--name value" pairs from argv. */
export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}

/**
 * A Bible resource as text, one verse per line, so a change to a single
 * verse shows up as a one-line diff in review.
 */
export function bibleFileText(bible) {
  const lines = [];
  lines.push('{');
  lines.push(`  "version": ${JSON.stringify(bible.version)},`);
  lines.push('  "books": [');
  bible.books.forEach((book, bi) => {
    const { verses, ...meta } = book;
    const head = JSON.stringify(meta);
    lines.push(`    ${head.slice(0, -1)}, "verses": [`);
    verses.forEach((v, vi) => {
      lines.push(`      ${JSON.stringify(v)}${vi < verses.length - 1 ? ',' : ''}`);
    });
    lines.push(`    ]}${bi < bible.books.length - 1 ? ',' : ''}`);
  });
  lines.push('  ]');
  lines.push('}');
  return lines.join('\n') + '\n';
}

/** Compact-indented JSON text, as every other resource file is written. */
export const jsonText = data => JSON.stringify(data, null, 1) + '\n';

/** Write compact-indented JSON, creating parent directories as needed. */
export function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, jsonText(data));
}
