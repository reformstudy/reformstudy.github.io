/**
 * Local reviewer UI for verification items (npm run review:ui).
 *
 * Serves scripts/verify/review-ui.html at http://127.0.0.1:4777 and a small
 * JSON API over the same files `npm run review` uses: it reads
 * provenance/reports/{resource}.json and writes provenance/decisions/{resource}.json.
 * Nothing leaves your machine; commit the changed files as usual.
 *
 *   npm run review:ui                  http://127.0.0.1:4777
 *   npm run review:ui -- --port 5000
 *
 * Only listens on 127.0.0.1, and only accepts writes from its own page.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadDecisions, saveDecisions } from '../lib/decisions.js';
import { parseArgs } from '../lib/io.js';
import { loadRegistry } from '../lib/lock.js';
import { REPORTS_DIR, writeReport } from './verify.js';
import {
  addCorrection, addProofCorrection, confirmDecisions, findItems, loadReport, recordAccept, undoDecision, whoAmI,
} from './review.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const PAGE = path.join(__dirname, 'review-ui.html');

/** npm scripts that apply a resource's corrections to res/ (the WCF's proof texts come from the KJV). */
const INGEST = {
  kjv: ['ingest:kjv', 'ingest:wcf'],
  bsb: ['ingest:bsb'],
  wcf: ['ingest:wcf'],
  'strongs-greek': ['ingest:strongs'],
  'strongs-hebrew': ['ingest:strongs'],
};

const emptyCorrections = resource => (resource === 'wcf' ? { text: [], proofs: [] } : []);
const flat = c => (Array.isArray(c) ? c : Object.values(c).flat());

function state() {
  const registry = loadRegistry();
  const resources = Object.entries(registry.sources).map(([id, s]) => {
    const file = path.join(REPORTS_DIR, `${id}.json`);
    if (!fs.existsSync(file)) return { id, title: s.title, verified: false, witnesses: s.witnesses.length };
    const r = JSON.parse(fs.readFileSync(file, 'utf8'));
    return {
      id,
      title: s.title,
      verified: true,
      checked: r.checked,
      pending: r.pending.filter(i => !i.recorded).length,
      recorded: r.pending.filter(i => i.recorded).length,
      corrections: r.corrections,
      accepted: r.accepted,
      awaitingSignOff: r.awaitingSignOff ?? 0,
      stale: r.stale.length,
    };
  });
  let reviewer = null;
  try { reviewer = whoAmI(); } catch { /* the page asks */ }
  return { reviewer, resources, attestations: registry.attestations };
}

function reportWithDecisions(resource) {
  const report = loadReport(resource);
  const decisions = loadDecisions(resource, emptyCorrections(resource));
  const corrections = flat(decisions.corrections).map(c => ({
    unit: c.ref ?? c.section,
    ...(c.from !== undefined ? { from: c.from, to: c.to } : { footnote: c.footnote, replace: c.replace, with: c.with }),
    reason: c.reason, reviewer: c.reviewer, date: c.date, confirmedBy: c.confirmedBy ?? null,
  }));
  return { report, corrections };
}

/** Run npm scripts in sequence; resolves with { ok, output }. */
function run(scripts) {
  return new Promise(resolve => {
    let output = '';
    const next = i => {
      if (i >= scripts.length) return resolve({ ok: true, output });
      const child = spawn('npm', ['run', '--silent', ...scripts[i]], { cwd: ROOT, env: process.env });
      child.stdout.on('data', d => { output += d; });
      child.stderr.on('data', d => { output += d; });
      child.on('close', code => (code === 0 ? next(i + 1) : resolve({ ok: false, output })));
    };
    next(0);
  });
}

const handlers = {
  'GET /api/state': () => state(),
  'GET /api/report': ({ resource }) => reportWithDecisions(resource),

  'POST /api/accept': ({ resource, body }) => {
    const report = loadReport(resource);
    const decisions = loadDecisions(resource, emptyCorrections(resource));
    const items = body.class
      ? report.pending.filter(i => !i.recorded && (i.suggestion?.class ?? 'unclassified') === body.class)
      : findItems(report, body.ids ?? []);
    if (!items.length) throw new Error('Nothing to accept.');
    const n = recordAccept(resource, report, decisions, items, { reason: body.reason, reviewer: body.by });
    return { accepted: n, keys: items.map(i => i.key) };
  },

  'POST /api/correct': ({ resource, body }) => {
    const report = loadReport(resource);
    const decisions = loadDecisions(resource, emptyCorrections(resource));
    const [item] = findItems(report, [body.id]);
    if (body.proof) addProofCorrection(decisions, { ...body.proof, reason: body.reason, reviewer: body.by });
    else addCorrection(resource, decisions, item, { from: body.from, to: body.to, reason: body.reason, reviewer: body.by });
    saveDecisions(resource, decisions);
    item.recorded = 'correction';
    writeReport(report);
    return { recorded: item.id };
  },

  'POST /api/undo': ({ resource, body }) => {
    const decisions = loadDecisions(resource, emptyCorrections(resource));
    if (!undoDecision(resource, decisions, body)) throw new Error('That decision is no longer in the file.');
    saveDecisions(resource, decisions);
    const report = loadReport(resource);
    if (body.kind === 'accepted' && body.item) {
      // Put the item back on the list until the next verify run.
      report.pending.unshift(body.item);
      report.accepted -= 1;
    } else if (body.kind === 'correction') {
      for (const i of report.pending) if (i.unit === body.unit && i.recorded) delete i.recorded;
    }
    writeReport(report);
    return { undone: true };
  },

  'POST /api/confirm': ({ resource, body }) => {
    const decisions = loadDecisions(resource, emptyCorrections(resource));
    const n = confirmDecisions(decisions, { reviewer: body.reviewer ?? 'Claude', by: body.by });
    saveDecisions(resource, decisions);
    const report = loadReport(resource);
    report.awaitingSignOff = Math.max(0, (report.awaitingSignOff ?? 0) - n);
    writeReport(report);
    return { confirmed: n };
  },

  'POST /api/verify': ({ resource }) => run([['verify', '--', resource]]),
  'POST /api/ingest': async ({ resource }) => {
    const scripts = INGEST[resource];
    if (!scripts) throw new Error(`No ingest step for ${resource}.`);
    return run([...scripts.map(s => [s]), ['validate:resources']]);
  },
};

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

export function createServer({ port }) {
  const origin = `http://127.0.0.1:${port}`;
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, origin);
    try {
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        return send(res, 200, fs.readFileSync(PAGE, 'utf8'), 'text/html; charset=utf-8');
      }
      const handler = handlers[`${req.method} ${url.pathname}`];
      if (!handler) return send(res, 404, { error: 'Not found' });
      let body = {};
      if (req.method === 'POST') {
        // Writes only from this page: a custom header can't be sent cross-site without a CORS preflight, which we never answer.
        const from = req.headers.origin;
        if (req.headers['x-review'] !== '1' || (from && from !== origin && from !== `http://localhost:${port}`)) {
          return send(res, 403, { error: 'Forbidden' });
        }
        let raw = '';
        for await (const chunk of req) raw += chunk;
        body = raw ? JSON.parse(raw) : {};
        if (!['verify', 'ingest'].some(p => url.pathname.endsWith(p)) && !body.by && !url.pathname.endsWith('undo')) {
          throw new Error('Enter your name (top right) so decisions record who made them.');
        }
      }
      const resource = url.searchParams.get('resource') ?? body.resource;
      if (url.pathname !== '/api/state' && !/^[a-z-]+$/.test(resource ?? '')) throw new Error('Unknown resource.');
      send(res, 200, await handler({ resource, body }));
    } catch (err) {
      send(res, 400, { error: err.message });
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(parseArgs(process.argv.slice(2)).port ?? 4777);
  createServer({ port }).listen(port, '127.0.0.1', () => {
    console.log(`Source review: http://127.0.0.1:${port}  (Ctrl+C to stop)`);
  });
}
