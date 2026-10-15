/**
 * Corrections to the interim KJV and WCF sources (provenance/decisions/{resource}.json),
 * applied at ingest. They are kept only until those resources come from the
 * organizations that publish them (see res/SOURCES.md), and then removed.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DECISIONS_DIR = path.join(__dirname, '../../provenance/decisions');

export function loadDecisions(resource, emptyCorrections = []) {
  const file = path.join(DECISIONS_DIR, `${resource}.json`);
  if (!fs.existsSync(file)) return { resource, corrections: emptyCorrections };
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { ...d, corrections: d.corrections ?? emptyCorrections };
}
