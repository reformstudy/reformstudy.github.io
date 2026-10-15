/**
 * Facts about a build, written next to the site as build.json (and, for a
 * preview, changes.json) so the app can show which version of the app and of
 * the content it is, and where each source comes from.
 *
 * Set by the deploy workflow:
 *   RS_CHANNEL    'live' or 'preview' (default 'dev')
 *   RS_LIVE_REF   for a preview: the live release tag to list changes against
 *   RS_LIVE_URL   for a preview: where the live site is (default "/")
 */

import crypto from 'crypto';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ROOT, contentDiff, workingTree } from './content-diff.js';

function git(...args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

const readJson = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));

/** One id for the exact content: a hash of every file under res/. */
export function contentFingerprint() {
  const lines = [...workingTree()].map(([file, blob]) => `${file} ${blob}`).sort();
  return crypto.createHash('sha256').update(lines.join('\n')).digest('hex').slice(0, 12);
}

/** Per source: who publishes it, where it was downloaded, and its license. */
export function sourceStatus() {
  const registry = readJson('provenance/registry.json');
  return Object.entries(registry.sources).map(([id, s]) => ({
    id,
    title: s.title,
    organization: s.organization ?? null,
    source: s.commit ? `${s.repo}/tree/${s.commit}` : s.url ?? s.repo,
    license: s.license,
  }));
}

export function buildInfo(env = process.env) {
  const pkg = readJson('package.json');
  const channel = env.RS_CHANNEL ?? 'dev';
  const info = {
    channel,
    app: {
      version: pkg.version,
      release: git('describe', '--tags', '--exact-match', '--match', 'v*', 'HEAD'),
      describe: git('describe', '--tags', '--match', 'v*', '--always'),
      commit: git('rev-parse', '--short', 'HEAD'),
      builtAt: new Date().toISOString(),
    },
    content: { fingerprint: contentFingerprint(), sources: sourceStatus() },
  };
  if (env.RS_LIVE_REF) {
    info.live = { ref: env.RS_LIVE_REF, commit: git('rev-parse', '--short', `${env.RS_LIVE_REF}^{commit}`), url: env.RS_LIVE_URL ?? '/' };
  }
  return info;
}

/** Write build.json (and changes.json when there is a live release to compare with) into the site folder. */
export function writeBuildFiles(outDir, env = process.env) {
  const info = buildInfo(env);
  fs.writeFileSync(path.join(outDir, 'build.json'), JSON.stringify(info, null, 1) + '\n');
  if (info.live) {
    const titles = Object.fromEntries(info.content.sources.map(s => [s.id, s.title]));
    titles.docs = 'Source documentation';
    fs.writeFileSync(path.join(outDir, 'changes.json'), JSON.stringify(contentDiff(env.RS_LIVE_REF, { titles })) + '\n');
  }
  return info;
}
