/**
 * Running an ingest pipeline: each scripts/ingest/*.js module exports
 *
 *   pipeline = {
 *     id,            // the resource, e.g. 'kjv'
 *     sources,       // the registry sources it reads, e.g. ['kjv']
 *     owns,          // res/ paths it writes (files, or folders it fills entirely)
 *     generate,      // (files, ctx) => { outputs: Map<res path, file text>, notes: [] }
 *   }
 *
 * `generate` is pure: given the source files (Map of source id -> Map of
 * file name -> bytes) it returns the exact text of every file it writes.
 * Ingest writes those files; authentication regenerates them and compares,
 * so res/ can only hold what the converters produce from the sources.
 */

import fs from 'fs';
import path from 'path';
import { ROOT, loadSourceFiles } from './sources.js';
import { parseArgs } from './io.js';

/** Every file under a res/ path (a file, or a folder walked recursively), as repo-relative paths. */
export function filesUnder(rel, root = ROOT) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isFile()) return [rel];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap(d => filesUnder(path.posix.join(rel, d.name), root));
}

/** Files a pipeline owns that it would not write. README files beside the data are not owned. */
function strayFiles(pipeline, outputs, root) {
  return pipeline.owns
    .flatMap(rel => filesUnder(rel, root))
    .filter(f => !outputs.has(f) && path.basename(f) !== 'README.md');
}

/** Read the source files a pipeline needs: Map of source id -> files. */
export async function pipelineSources(pipeline, options = {}) {
  const files = new Map();
  for (const id of pipeline.sources) files.set(id, await loadSourceFiles(id, options));
  return files;
}

/** Context for generate(): reading resources other pipelines produced (the KJV, for proof texts). */
export function resContext(root = ROOT) {
  return { readJson: rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')) };
}

/** Write a pipeline's outputs and remove files it owns but no longer produces. */
export function writeOutputs(pipeline, outputs, root = ROOT) {
  for (const f of strayFiles(pipeline, outputs, root)) fs.rmSync(path.join(root, f));
  for (const [rel, text] of outputs) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
}

/**
 * Compare a pipeline's outputs with what is in res/: files that differ,
 * are missing, or are there without being produced.
 */
export function compareOutputs(pipeline, outputs, root = ROOT) {
  const problems = [];
  for (const [rel, text] of outputs) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) problems.push(`${rel}: missing`);
    else if (fs.readFileSync(abs, 'utf8') !== text) problems.push(`${rel}: differs from what the sources produce`);
  }
  for (const f of strayFiles(pipeline, outputs, root)) problems.push(`${f}: not produced from the sources`);
  return problems;
}

/** The CLI for an ingest script: read (or with --download, fetch) the sources, generate, write. */
export async function runPipeline(pipeline, argv = process.argv.slice(2), { root = ROOT, log = console.log } = {}) {
  const args = parseArgs(argv);
  const files = await pipelineSources(pipeline, { download: Boolean(args.download) });
  const { outputs, notes = [], summary } = pipeline.generate(files, resContext(root));
  writeOutputs(pipeline, outputs, root);
  for (const n of notes) log(`  note: ${n}`);
  log(`${pipeline.id}: wrote ${outputs.size} file${outputs.size === 1 ? '' : 's'}${summary ? ` (${summary})` : ''}`);
}

export function runAsScript(meta, pipeline) {
  if (meta.url === `file://${process.argv[1]}`) {
    runPipeline(pipeline).catch(err => {
      console.error(err);
      process.exit(1);
    });
  }
}
