/**
 * Consensus comparison of a source against independent witnesses.
 *
 * Each resource is split into units (a verse, a confession section, a
 * dictionary entry). A unit is either a token sequence (text) or a single
 * value. For text, every witness is aligned with our source and the places
 * where any witness differs become variation items: our reading, plus what
 * each witness reads at the same place. Values become one item when any
 * witness differs.
 *
 * Each item is classified by counting independent lineages (witnesses with
 * the same lineage count once):
 *   majority    our reading has at least as much support as any other: passes
 *   against     no witness supports us and two or more lineages agree on another reading
 *   split       anything else, including a single witness that differs
 *   unattested  no witness has the unit at all
 * Every item except 'majority' needs a person's decision.
 *
 * An item's key is a hash of the unit, our reading with two words of context
 * either side, and the set of witness readings. A saved decision only matches
 * while all of those are unchanged, so a changed source or witness brings the
 * item back for review.
 */

import { sha256 } from '../lib/lock.js';

export const MISSING = '∅';

/** LCS alignment of two token arrays as opcodes {equal, i1, i2, j1, j2}. */
export function align(a, b) {
  if (a.length === b.length && a.every((t, i) => t === b[i])) {
    return [{ equal: true, i1: 0, i2: a.length, j1: 0, j2: b.length }];
  }
  // Trim the common prefix and suffix, then run the DP on the middle.
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  const A = a.slice(pre, a.length - suf);
  const B = b.slice(pre, b.length - suf);
  const n = A.length;
  const m = B.length;
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    }
  }
  const pairs = [];
  for (let i = 0, j = 0; i < n && j < m;) {
    if (A[i] === B[j]) { pairs.push([i, j]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
  }
  const ops = [];
  const push = (equal, i1, i2, j1, j2) => {
    if (i1 === i2 && j1 === j2) return;
    const last = ops[ops.length - 1];
    if (last && last.equal === equal) { last.i2 = i2; last.j2 = j2; } else ops.push({ equal, i1, i2, j1, j2 });
  };
  push(true, 0, pre, 0, pre);
  let i = 0;
  let j = 0;
  for (const [pi, pj] of pairs) {
    push(false, pre + i, pre + pi, pre + j, pre + pj);
    push(true, pre + pi, pre + pi + 1, pre + pj, pre + pj + 1);
    i = pi + 1;
    j = pj + 1;
  }
  push(false, pre + i, pre + n, pre + j, pre + m);
  push(true, pre + n, a.length, pre + m, b.length);
  return ops;
}

/** Map a boundary position in `a` to `b`. Only valid outside the inside of a difference. */
function mapPos(ops, p) {
  for (const op of ops) {
    if (op.equal && op.i1 <= p && p <= op.i2) return op.j1 + (p - op.i1);
  }
  for (const op of ops) {
    if (p === op.i1) return op.j1;
    if (p === op.i2) return op.j2;
  }
  throw new Error(`position ${p} is inside a difference`);
}

/**
 * Spans of `ours` where any aligned witness differs. Spans that touch, or are
 * separated by a single word, are merged, so "today to" / "to day to" is one
 * place rather than a deletion and an insertion.
 */
export function variationSpans(alignments) {
  const spans = alignments
    .flatMap(ops => ops.filter(op => !op.equal).map(op => ({ s: op.i1, e: op.i2 })))
    .sort((x, y) => x.s - y.s || x.e - y.e);
  const merged = [];
  for (const sp of spans) {
    const last = merged[merged.length - 1];
    if (last && sp.s <= last.e + 1) last.e = Math.max(last.e, sp.e);
    else merged.push({ ...sp });
  }
  return merged;
}

/** Classify one place from our reading and each witness's reading (undefined = the witness lacks the unit). */
export function classify(ours, readings, lineageOf) {
  const support = new Map();
  for (const [w, r] of Object.entries(readings)) {
    if (r === undefined) continue;
    if (!support.has(r)) support.set(r, new Set());
    support.get(r).add(lineageOf(w));
  }
  if (!support.size) return 'unattested';
  const oursSupport = support.get(ours)?.size ?? 0;
  let best = 0;
  for (const [r, s] of support) if (r !== ours) best = Math.max(best, s.size);
  if (best === 0) return 'agree';
  if (oursSupport > 0 && oursSupport >= best) return 'majority';
  if (oursSupport === 0 && best >= 2) return 'against';
  return 'split';
}

export function itemKey(resource, unit, before, ours, after, readings) {
  const distinct = [...new Set(Object.values(readings).map(r => r ?? MISSING))].sort();
  return sha256(JSON.stringify([resource, unit, before, ours, after, distinct]));
}

const join = tokens => tokens.join(' ');

/**
 * Compare a resource.
 * @param {object} p
 * @param {string} p.resource
 * @param {Map<string, {norm: string[], show: string[]} | {value: string, show?: string}>} p.ours
 * @param {Record<string, Map<string, same shape>>} p.witnesses  by witness id
 * @param {(witnessId: string) => string} p.lineageOf
 */
export function compare({ resource, ours, witnesses, lineageOf }) {
  const ids = Object.keys(witnesses);
  const stats = { units: ours.size, agree: 0, majority: 0, against: 0, split: 0, unattested: 0 };
  const witnessDiffers = Object.fromEntries(ids.map(id => [id, 0]));
  const coverage = Object.fromEntries(ids.map(id => [id, 0]));
  const items = [];

  const add = (unit, cls, before, ourReading, after, readings, show) => {
    stats[cls]++;
    for (const [w, r] of Object.entries(readings)) if (r !== undefined && r !== ourReading) witnessDiffers[w]++;
    if (cls === 'agree' || cls === 'majority') return;
    const key = itemKey(resource, unit, before, ourReading, after, readings);
    items.push({ id: key.slice(0, 10), key, unit, class: cls, ...show });
  };

  for (const [unit, u] of ours) {
    const present = ids.filter(id => witnesses[id].has(unit));
    for (const id of present) coverage[id]++;
    if (!present.length) {
      add(unit, 'unattested', '', u.value ?? join(u.norm), '', {}, { ours: u.show ?? u.value ?? join(u.show), readings: {} });
      continue;
    }

    if ('value' in u) {
      const readings = Object.fromEntries(ids.map(id => [id, witnesses[id].get(unit)?.value]));
      const cls = classify(u.value, readings, lineageOf);
      const show = Object.fromEntries(ids.map(id => [id, witnesses[id].get(unit)?.show ?? witnesses[id].get(unit)?.value]));
      add(unit, cls, '', u.value, '', readings, { ours: u.show ?? u.value, readings: show });
      continue;
    }

    const al = Object.fromEntries(present.map(id => [id, align(u.norm, witnesses[id].get(unit).norm)]));
    const spans = variationSpans(Object.values(al));
    if (!spans.length) { stats.agree++; continue; }
    for (const { s, e } of spans) {
      const readings = {};
      const show = {};
      for (const id of ids) {
        if (!al[id]) { readings[id] = undefined; continue; }
        const w = witnesses[id].get(unit);
        const ws = mapPos(al[id], s);
        const we = mapPos(al[id], e);
        readings[id] = join(w.norm.slice(ws, we));
        show[id] = join(w.show.slice(ws, we));
      }
      const before = join(u.norm.slice(Math.max(0, s - 2), s));
      const after = join(u.norm.slice(e, e + 2));
      const cls = classify(join(u.norm.slice(s, e)), readings, lineageOf);
      add(unit, cls, before, join(u.norm.slice(s, e)), after, readings, {
        ours: join(u.show.slice(s, e)),
        context: [join(u.show.slice(Math.max(0, s - 4), s)), join(u.show.slice(e, e + 4))],
        readings: show,
      });
    }
  }

  // Units a witness has that our source lacks.
  const extra = new Map();
  for (const id of ids) for (const unit of witnesses[id].keys()) if (!ours.has(unit)) {
    if (!extra.has(unit)) extra.set(unit, {});
    const w = witnesses[id].get(unit);
    extra.get(unit)[id] = w.value ?? join(w.norm);
  }
  for (const [unit, found] of extra) {
    const readings = Object.fromEntries(ids.map(id => [id, found[id]]));
    const show = Object.fromEntries(ids.map(id => [id, found[id] === undefined ? undefined : found[id].slice(0, 200)]));
    // Our source lacks the whole unit: compare presence, so one witness alone can't outvote us.
    const presence = Object.fromEntries(ids.map(id => [id, found[id] === undefined ? MISSING : 'present']));
    const cls = classify(MISSING, presence, lineageOf);
    stats.units++;
    add(unit, cls, '', MISSING, '', readings, { ours: MISSING, readings: show });
  }

  return { stats, coverage, witnessDiffers, items };
}
