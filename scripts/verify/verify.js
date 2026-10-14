/**
 * Verify sources against their witnesses (npm run verify).
 *
 *   npm run verify                  every resource that has witnesses
 *   npm run verify -- kjv wcf       some resources
 *   npm run verify -- --check       also exit 1 if anything awaits review
 *
 * For each resource: download the pinned source and witnesses (checking
 * their SHA-256 in provenance/registry.json), apply the reviewed corrections,
 * compare (scripts/verify/consensus.js), and write
 * provenance/reports/{resource}.json (machine-readable, read by npm run review)
 * and provenance/reports/{resource}.md (for people). Items that no reviewed
 * decision covers are listed as pending.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadRegistry } from '../lib/lock.js';
import { loadDecisions } from '../lib/decisions.js';
import { compare } from './consensus.js';
import { ADAPTERS } from './adapters/index.js';
import { renderIndex, renderReport } from './report.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPORTS_DIR = path.join(__dirname, '../../provenance/reports');

export async function verifyResource(resource, { registry = loadRegistry() } = {}) {
  const adapter = ADAPTERS[resource];
  if (!adapter) throw new Error(`No verification adapter for "${resource}"`);
  const source = registry.sources[resource];
  const decisions = loadDecisions(resource, adapter.emptyCorrections);
  const { ours, witnesses } = await adapter.load({ corrections: decisions.corrections });
  const lineageOf = id => registry.witnesses[id].lineage;
  const result = compare({ resource, ours, witnesses, lineageOf });

  const accepted = new Map(decisions.accepted.map(a => [a.key, a]));
  const seen = new Set(result.items.map(i => i.key));
  const pending = result.items
    .filter(i => !accepted.has(i.key))
    .map(i => ({ ...i, suggestion: adapter.suggest?.(i) ?? null }));
  const stale = decisions.accepted.filter(a => !seen.has(a.key)).map(a => ({ key: a.key, unit: a.unit, ours: a.ours }));

  const pin = e => e.commit ? `${e.repo}@${e.commit}` : e.url;
  return {
    resource,
    title: source.title,
    checked: new Date().toISOString().slice(0, 10),
    source: { pin: pin(source), sha256: source.sha256, lineage: source.lineage },
    witnesses: Object.fromEntries(Object.keys(witnesses).map(id => {
      const w = registry.witnesses[id];
      return [id, { title: w.title, pin: pin(w), sha256: w.sha256, lineage: w.lineage, unitsCovered: result.coverage[id], placesDiffering: result.witnessDiffers[id] }];
    })),
    unitName: adapter.unitName,
    comparison: adapter.comparison,
    stats: result.stats,
    corrections: countCorrections(decisions.corrections),
    // Decisions recorded by Claude that no person has signed off yet (npm run review -- <resource> confirm).
    awaitingSignOff: [...flatCorrections(decisions.corrections), ...decisions.accepted].filter(d => d.reviewer === 'Claude' && !d.confirmedBy).length,
    accepted: decisions.accepted.length - stale.length,
    stale,
    pending,
  };
}

const flatCorrections = c => (Array.isArray(c) ? c : Object.values(c).flat());
const countCorrections = c => flatCorrections(c).length;

export function writeReport(report, registry = loadRegistry()) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORTS_DIR, `${report.resource}.json`), JSON.stringify(report, null, 1) + '\n');
  fs.writeFileSync(path.join(REPORTS_DIR, `${report.resource}.md`), renderReport(report));
  const reports = {};
  for (const f of fs.readdirSync(REPORTS_DIR)) {
    if (f.endsWith('.json')) reports[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, f), 'utf8'));
  }
  fs.writeFileSync(path.join(REPORTS_DIR, 'README.md'), renderIndex(reports, registry));
}

async function main() {
  const argv = process.argv.slice(2);
  const check = argv.includes('--check');
  const requested = argv.filter(a => !a.startsWith('--'));
  const resources = requested.length ? requested : Object.keys(ADAPTERS);
  const registry = loadRegistry();
  let open = 0;
  for (const resource of resources) {
    const report = await verifyResource(resource, { registry });
    writeReport(report, registry);
    const s = report.stats;
    open += report.pending.length + report.stale.length;
    console.log(`${resource}: ${s.units} ${report.unitName === 'entry' ? 'entries' : `${report.unitName}s`}; ${s.majority} places where a witness differs and we have the majority; ${report.corrections} corrections, ${report.accepted} accepted; ${report.pending.length} awaiting review${report.stale.length ? `; ${report.stale.length} accepted decisions no longer match` : ''}`);
  }
  console.log(`Reports: ${path.relative(process.cwd(), REPORTS_DIR)}/`);
  if (check && open) {
    console.error(`${open} items await review (npm run review).`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
