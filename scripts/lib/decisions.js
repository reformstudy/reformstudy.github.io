/**
 * Reviewed decisions about mismatches between a source and its witnesses
 * (provenance/decisions/{resource}.json):
 *
 *   corrections  edits applied to the source at ingest, where a person agreed
 *                the source is wrong. Each must match the source exactly once,
 *                so a changed source fails instead of being edited wrongly.
 *   accepted     differences a person checked and found benign; our reading
 *                stands. Matched by content key (see scripts/verify/consensus.js),
 *                so they stop matching when the source or a witness changes.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DECISIONS_DIR = path.join(__dirname, '../../provenance/decisions');

export const decisionsFile = resource => path.join(DECISIONS_DIR, `${resource}.json`);

export function loadDecisions(resource, emptyCorrections = []) {
  const file = decisionsFile(resource);
  if (!fs.existsSync(file)) return { resource, corrections: emptyCorrections, accepted: [] };
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { ...d, corrections: d.corrections ?? emptyCorrections, accepted: d.accepted ?? [] };
}

export function saveDecisions(resource, decisions) {
  fs.mkdirSync(DECISIONS_DIR, { recursive: true });
  const { resource: _r, about, corrections, accepted, ...rest } = decisions;
  const ordered = { resource, about, ...rest, corrections, accepted };
  fs.writeFileSync(decisionsFile(resource), JSON.stringify(ordered, null, 1) + '\n');
}
