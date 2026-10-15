/**
 * Record decisions about verification items (npm run review; npm run review:ui
 * is the same in a web page).
 *
 * For each item there are three choices, and no others:
 *   accept   keep the source's reading
 *   correct  take a witness's reading: the edit is built from that reading,
 *            never typed (see scripts/lib/corrections.js)
 *   ignore   take the item off the list without deciding; the text is unchanged
 *
 *   npm run review -- kjv                                  list what awaits review
 *   npm run review -- kjv show <id>                        one item in full
 *   npm run review -- kjv accept <id> [<id>…] [--reason "…"]
 *   npm run review -- kjv accept --class <class> --reason "…"   every pending item in that class
 *   npm run review -- kjv correct <id> --witness <witness-id> [--footnote N] [--reason "…"]
 *   npm run review -- kjv ignore <id> [<id>…] [--reason "…"]
 *   npm run review -- kjv confirm [--reviewer Claude]      sign off decisions someone else recorded
 *
 * Items come from provenance/reports/{resource}.json (run npm run verify first).
 * Decisions go to provenance/decisions/{resource}.json with your name (git
 * config user.name, or --by) and the date. After a correction, run
 * `npm run verify -- <resource>` to check it, and `npm run ingest` to apply it.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { loadDecisions, saveDecisions } from '../lib/decisions.js';
import { parseArgs } from '../lib/io.js';
import { correctionFromReading } from '../lib/corrections.js';
import { REPORTS_DIR, writeReport } from './verify.js';

const today = () => new Date().toISOString().slice(0, 10);

const DEFAULT_REASON = { accepted: 'Kept the source reading.', ignored: 'Ignored.' };

/**
 * Record items as accepted (the source's reading stands) or ignored, skipping
 * any already decided. Returns the number added.
 */
export function decideItems(decisions, items, { kind = 'accepted', reason, reviewer, date = today() }) {
  decisions[kind] ??= [];
  const known = new Set([...decisions.accepted, ...(decisions.ignored ?? [])].map(a => a.key));
  let added = 0;
  for (const item of items) {
    if (known.has(item.key)) continue;
    decisions[kind].push({
      key: item.key,
      unit: item.unit,
      ours: item.ours,
      readings: item.readings,
      ...(item.suggestion?.class ? { class: item.suggestion.class } : {}),
      reason: reason || DEFAULT_REASON[kind],
      reviewer,
      date,
    });
    known.add(item.key);
    added++;
  }
  return added;
}

export const acceptItems = (decisions, items, options) => decideItems(decisions, items, { ...options, kind: 'accepted' });
export const ignoreItems = (decisions, items, options) => decideItems(decisions, items, { ...options, kind: 'ignored' });

/** The readings a reviewer may choose for an item: each witness's reading (Strong's: each of its words). */
export function readingChoices(item) {
  const choices = new Map();
  for (const [witness, reading] of Object.entries(item.readings)) {
    if (reading === undefined || reading === item.ours) continue;
    for (const r of item.options?.[witness] ?? [reading]) {
      if (r === item.ours) continue;
      if (!choices.has(r)) choices.set(r, []);
      choices.get(r).push(witness);
    }
  }
  return [...choices].map(([reading, witnesses]) => ({ reading, witnesses }));
}

/**
 * Correct the source to a witness's reading. `reading` must be one of
 * readingChoices(item); the edit itself is built by correctionFromReading.
 * Returns the correction entries added.
 */
export function addCorrection(resource, decisions, item, { reading, footnote, reason, reviewer, date = today() }) {
  const choice = readingChoices(item).find(c => c.reading === reading);
  if (!choice) throw new Error('Choose one of the witnesses\' readings.');
  const { kind, entries } = correctionFromReading(resource, item, reading, { footnote });
  const stamp = { witnesses: choice.witnesses, reviewer, date, reason: reason || `Took the reading of ${choice.witnesses.join(', ')}.` };
  const list = kind === 'text' || kind === 'proofs' ? decisions.corrections[kind] : decisions.corrections;
  const added = entries.map(e => ({ ...e, ...stamp }));
  list.push(...added);
  return added;
}

/**
 * Remove an accepted or ignored decision (by key), or a correction for a unit:
 * the one matching `from`/`to` (or `footnote`) when given, else the last one
 * recorded. Returns true if one was removed.
 */
export function undoDecision(resource, decisions, { kind, key, unit, from, to, footnote }) {
  if (kind === 'accepted' || kind === 'ignored') {
    const list = decisions[kind] ?? [];
    const i = list.findIndex(a => a.key === key);
    if (i < 0) return false;
    list.splice(i, 1);
    return true;
  }
  const lists = Array.isArray(decisions.corrections) ? [decisions.corrections] : Object.values(decisions.corrections);
  for (const list of lists) {
    for (let i = list.length - 1; i >= 0; i--) {
      const c = list[i];
      if ((c.ref ?? c.section ?? c.entry) !== unit) continue;
      if (from !== undefined && (c.from !== from || c.to !== to)) continue;
      if (footnote !== undefined && c.footnote !== footnote) continue;
      list.splice(i, 1);
      return true;
    }
  }
  return false;
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

export function whoAmI(args = {}) {
  if (args.by) return String(args.by);
  try {
    const name = execSync('git config user.name', { encoding: 'utf8' }).trim();
    if (name) return name;
  } catch { /* fall through */ }
  if (process.env.USER) return process.env.USER;
  throw new Error('Say who is reviewing with --by "Name".');
}

export function loadReport(resource) {
  const file = path.join(REPORTS_DIR, `${resource}.json`);
  if (!fs.existsSync(file)) throw new Error(`No report for ${resource}: run npm run verify -- ${resource} first.`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function findItems(report, ids) {
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
  const choices = readingChoices(item);
  if (choices.length) lines.push(`  correct with --witness: ${choices.map(c => c.witnesses[0]).join(', ')}`);
  if (item.suggestion?.note) lines.push(`  hint: ${item.suggestion.note}${item.suggestion.action ? ` (suggested: ${item.suggestion.action})` : ''}`);
  return lines.join('\n');
}

/** Accept or ignore items, save the decisions, and take the items off the report's pending list. Returns the number added. */
export function recordDecided(resource, report, decisions, items, options) {
  const n = decideItems(decisions, items, options);
  saveDecisions(resource, decisions);
  const keys = new Set(items.map(i => i.key));
  report.pending = report.pending.filter(i => !keys.has(i.key));
  report[options.kind] = (report[options.kind] ?? 0) + n;
  writeReport(report);
  return n;
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
  if (!resource) throw new Error('Usage: npm run review -- <resource> [list|show|accept|correct|ignore|confirm] …');
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
  if (command === 'accept' || command === 'ignore') {
    const items = args.class ? report.pending.filter(i => i.suggestion?.class === args.class) : findItems(report, rest);
    if (!items.length) throw new Error(`Nothing to ${command}: give item ids or --class.`);
    if (args.class && !args.reason) throw new Error('Give a --reason when deciding a whole class.');
    const kind = command === 'accept' ? 'accepted' : 'ignored';
    const n = recordDecided(resource, report, decisions, items, { kind, reason: args.reason, reviewer: whoAmI(args) });
    console.log(`${command === 'accept' ? 'Accepted' : 'Ignored'} ${n} item(s) in provenance/decisions/${resource}.json; ${report.pending.length} awaiting review.`);
    return;
  }
  if (command === 'correct') {
    const [item] = findItems(report, rest.slice(0, 1));
    if (!args.witness) throw new Error('Choose the witness whose reading to take: --witness <id> (see show).');
    const reading = item.options?.[args.witness]?.[Number(args.option ?? 0)] ?? item.readings[args.witness];
    const added = addCorrection(resource, decisions, item, { reading, footnote: args.footnote === undefined ? undefined : Number(args.footnote), reason: args.reason, reviewer: whoAmI(args) });
    saveDecisions(resource, decisions);
    item.recorded = 'correction';
    writeReport(report);
    for (const c of added) console.log(c.from !== undefined ? `  "${c.from}" → "${c.to}"` : `  [${c.footnote}] ${c.replace.join(', ') || '(add)'} → ${c.with.join(', ') || '(remove)'}`);
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
