/**
 * Shared helpers for the ingest scripts: downloading with retries,
 * normalizing text, and writing resource JSON in a diff-friendly layout.
 */

import fs from 'fs';
import path from 'path';

export async function fetchJson(url, { retries = 3 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
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

/** Trim each paragraph and drop empty ones, keeping paragraph breaks. */
export function normalizeParagraphs(text) {
  return String(text)
    .split(/\n+/)
    .map(p => p.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
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
 * Write a Bible resource with one verse per line, so a change to a single
 * verse shows up as a one-line diff in review.
 */
export function writeBibleFile(filePath, bible) {
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
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, lines.join('\n') + '\n');
}

/** Write compact-indented JSON, creating parent directories as needed. */
export function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 1) + '\n');
}
