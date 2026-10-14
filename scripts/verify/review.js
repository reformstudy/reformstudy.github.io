/**
 * Record decisions about verification items (npm run review).
 *
 *   npm run review -- kjv                                  list what awaits review
 *   npm run review -- kjv show <id>                        one item in full
 *   npm run review -- kjv accept <id> [<id>…] --reason "…" our reading stands
 *   npm run review -- kjv accept --class <class> --reason "…"
 *                                                          every pending item the report puts in that class
 *   npm run review -- kjv correct <id> --to "…" [--from "…"] --reason "…"
 *                                                          fix the source (KJV verses, WCF section text)
 *   npm run review -- kjv confirm [--reviewer Claude]      sign off decisions someone else recorded
 *
 * Items come from provenance/reports/{resource}.json (run npm run verify first).
 * Decisions go to provenance/decisions/{resource}.json with your name (git
 * config user.name, or --by) and the date. After a correction, run
 * `npm run verify -- <resource>` to check it, and `npm run ingest` to apply it.
 * Corrections to WCF proof references are added to the decisions file by hand
 * ({ section, footnote, replace: [OSIS…], with: [OSIS…] }).
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { loadDecisions, saveDecisions } from '../lib/decisions.js';
import { parseArgs } from '../lib/io.js';
import { REPORTS_DIR, writeReport } from './verify.js';

const today = () => new Date().toISOString().slice(0, 10);

/** Add accepted entries for items, skipping any already accepted. Returns the number added. */
export function acceptItems(decisions, items, { reason, reviewer, date = today() }) {
  if (!reason) throw new Error('Give a --reason: it is the record of why this difference is benign.');
  const known = new Set(decisions.accepted.map(a => a.key));
  let added = 0;
  for (const item of items) {
    if (known.has(item.key)) continue;
    decisions.accepted.push({
      key: item.key,
      unit: item.unit,
      ours: item.ours,
      readings: item.readings,
      ...(item.suggestion?.class ? { class: item.suggestion.class } : {}),
      reason,
      reviewer,
      date,
    });
    known.add(item.key);
    added++;
  }
  return added;
}

/** Add a text correction for an item. KJV units are verses; WCF text units are sections. */
export function addCorrection(resource, decisions, item, { from = item.ours, to, reason, reviewer, date = today() }) {
  if (to === undefined) throw new Error('Give the corrected text with --to.');
  if (!reason) throw new Error('Give a --reason for the correction.');
  if (resource === 'kjv') {
    decisions.corrections.push({ ref: item.unit, from, to, kind: 'word', reviewer, date, reason });
  } else if (resource === 'wcf' && item.context) {
    decisions.corrections.text.push({ section: item.unit, from, to, reviewer, date, reason });
  } else {
    throw new Error(`Corrections for ${resource} ${item.unit} are made by editing provenance/decisions/${resource}.json.`);
  }
}

/** Mark decisions recorded by `reviewer` as confirmed by `by`. Returns the number confirmed. */
export function confirmDecisions(decisions, { reviewer, by, date = today() }) {
  const all = [...(Array.isArray(decisions.corrections) ? decisions.corrections : Object.values(decisions.corrections).flat()), ...decisions.accepted];
  let n = 0;
  for (const d of all) {
    if (d.reviewer === reviewer && !d.confirmedBy) { d.confirmedBy = by; d.confirmedOn = date; n++; }
  }
  return n;
}

function whoAmI(args) {
  if (args.by) return String(args.by);
  try {
    const name = execSync('git config user.name', { encoding: 'utf8' }).trim();
    if (name) return name;
  } catch { /* fall through */ }
  if (process.env.USER) return process.env.USER;
  throw new Error('Say who is reviewing with --by "Name".');
}

function loadReport(resource) {
  const file = path.join(REPORTS_DIR, `${resource}.json`);
  if (!fs.existsSync(file)) throw new Error(`No report for ${resource}: run npm run verify -- ${resource} first.`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function findItems(report, ids) {
  return ids.map(id => {
    const item = report.pending.find(i => i.id === id || i.key === id);
    if (!item) throw new Error(`No pending item ${id} in the ${report.resource} report.`);
    return item;
  });
}

function describe(item) {
  const ctx = item.context ? `…${item.context[0]} [${item.ours}] ${item.context[1]}…` : item.ours;
  const lines = [`${item.id}  ${item.unit}  (${item.class}${item.suggestion?.class ? `, ${item.suggestion.class}` : ''})`, `  ours: ${ctx}`];
  for (const [w, r] of Object.entries(item.readings)) lines.push(`  ${w}: ${r === undefined ? '—' : r}`);
  if (item.suggestion?.note) lines.push(`  hint: ${item.suggestion.note}${item.suggestion.action ? ` (suggested: ${item.suggestion.action})` : ''}`);
  return lines.join('\n');
}

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) positional.push(argv[i]);
    else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) i++; // the option's value
  }
  const [resource, command = 'list', ...rest] = positional;
  if (!resource) throw new Error('Usage: npm run review -- <resource> [list|show|accept|correct|confirm] …');
  const report = loadReport(resource);
  const decisions = loadDecisions(resource, resource === 'wcf' ? { text: [], proofs: [] } : []);

  if (command === 'list') {
    const byClass = new Map();
    for (const i of report.pending) {
      const k = i.suggestion?.class ?? 'unclassified';
      byClass.set(k, (byClass.get(k) ?? 0) + 1);
    }
    console.log(`${resource}: ${report.pending.length} awaiting review (report of ${report.checked}; full table in provenance/reports/${resource}.md)`);
    for (const [k, n] of byClass) console.log(`  ${k}: ${n}`);
    for (const i of report.pending.slice(0, Number(args.limit ?? 20))) console.log(describe(i));
    return;
  }
  if (command === 'show') {
    for (const i of findItems(report, rest)) console.log(describe(i));
    return;
  }
  if (command === 'accept') {
    const items = args.class ? report.pending.filter(i => i.suggestion?.class === args.class) : findItems(report, rest);
    if (!items.length) throw new Error('Nothing to accept: give item ids or --class.');
    const n = acceptItems(decisions, items, { reason: args.reason, reviewer: whoAmI(args) });
    saveDecisions(resource, decisions);
    const keys = new Set(items.map(i => i.key));
    report.pending = report.pending.filter(i => !keys.has(i.key));
    report.accepted += n;
    writeReport(report);
    console.log(`Accepted ${n} item(s) in provenance/decisions/${resource}.json; ${report.pending.length} awaiting review.`);
    return;
  }
  if (command === 'correct') {
    const [item] = findItems(report, rest.slice(0, 1));
    addCorrection(resource, decisions, item, { from: args.from, to: args.to, reason: args.reason, reviewer: whoAmI(args) });
    saveDecisions(resource, decisions);
    console.log(`Recorded the correction. Run npm run verify -- ${resource} to check it, then npm run ingest.`);
    return;
  }
  if (command === 'confirm') {
    const n = confirmDecisions(decisions, { reviewer: String(args.reviewer ?? 'Claude'), by: whoAmI(args) });
    saveDecisions(resource, decisions);
    console.log(`Confirmed ${n} decision(s) recorded by ${args.reviewer ?? 'Claude'}.`);
    return;
  }
  throw new Error(`Unknown command "${command}".`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}
