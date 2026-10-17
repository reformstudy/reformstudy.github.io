import { useEffect, useRef, useState } from 'react';
import { Eye, Info, X } from 'lucide-react';
import { siteUrl } from '../utils/paths';

// ---- build.json / changes.json (written by scripts/release/build-info.js) ----

interface SourceCredit {
  text: string;
  links: { label: string; url: string }[];
}

interface SourceStatus {
  id: string;
  title: string;
  organization: string | null;
  source: string;
  license: string;
  credit?: SourceCredit | null;
}

export interface BuildInfo {
  channel: string;
  app: { version: string; release: string | null; describe: string | null; commit: string | null; builtAt: string };
  content: { fingerprint: string; sources: SourceStatus[] };
  live?: { ref: string; commit: string | null; url: string };
}

interface ChangeItem { unit: string; before?: string; after?: string }

interface ResourceChanges {
  id: string;
  title: string;
  files: { added: string[]; removed: string[]; changed: string[] };
  units: { added: number; removed: number; changed: number };
  items: ChangeItem[];
  moreItems?: number;
}

interface ContentChanges { against: { ref: string; commit: string }; resources: ResourceChanges[] }

const REPO = 'https://github.com/reformstudy/reformstudy.github.io';

/** In dev the built files are served from /docs/, like the resources. */
const builtFile = (name: string) => (import.meta.env.DEV ? `/docs/${name}` : siteUrl(name));

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** "v0.1.0-12-gabc1234" -> "v0.1.0 + 12 commits". */
export function versionLabel(info: BuildInfo): string {
  if (info.app.release) return info.app.release;
  const m = info.app.describe?.match(/^(v[^-]+(?:-[a-z]+[.\d]*)?)-(\d+)-g[0-9a-f]+$/);
  if (m) return `${m[1]} + ${m[2]} commit${m[2] === '1' ? '' : 's'}`;
  return `v${info.app.version}${info.app.commit ? ` (${info.app.commit})` : ''}`;
}

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

function changeSummary(r: ResourceChanges): string {
  const parts = [];
  const u = r.units;
  if (u.changed) parts.push(`${u.changed.toLocaleString()} changed`);
  if (u.added) parts.push(`${u.added.toLocaleString()} added`);
  if (u.removed) parts.push(`${u.removed.toLocaleString()} removed`);
  if (parts.length) return parts.join(', ');
  const f = r.files;
  return [
    f.changed.length && `${plural(f.changed.length, 'file')} changed`,
    f.added.length && `${plural(f.added.length, 'file')} added`,
    f.removed.length && `${plural(f.removed.length, 'file')} removed`,
  ].filter(Boolean).join(', ');
}

function ChangesList({ changes }: { changes: ContentChanges }) {
  if (!changes.resources.length) return <p className="version-muted">No content changes.</p>;
  return (
    <div className="version-changes">
      {changes.resources.map(r => (
        <details key={r.id}>
          <summary>
            <strong>{r.title}</strong> <span className="version-muted">{changeSummary(r)}</span>
          </summary>
          {r.items.length > 0 ? (
            <ul className="version-change-items">
              {r.items.map(item => (
                <li key={item.unit}>
                  <div className="version-unit">{item.unit}</div>
                  {item.before !== undefined && <del>{item.before}</del>}
                  {item.after !== undefined && <ins>{item.after}</ins>}
                </li>
              ))}
              {r.moreItems ? <li className="version-muted">…and {r.moreItems.toLocaleString()} more (npm run content:diff -- {changes.against.ref})</li> : null}
            </ul>
          ) : (
            <ul className="version-change-items">
              {[...r.files.changed, ...r.files.added, ...r.files.removed].slice(0, 20).map(f => <li key={f}><code>{f}</code></li>)}
            </ul>
          )}
        </details>
      ))}
    </div>
  );
}

/** One entry per credit; sources that share a credit (the Greek and Hebrew lexicons) are listed together. */
function creditEntries(sources: SourceStatus[]): { titles: string[]; credit: SourceCredit }[] {
  const entries: { titles: string[]; credit: SourceCredit }[] = [];
  for (const s of sources) {
    if (!s.credit) continue;
    const same = entries.find(e => e.credit.text === s.credit!.text);
    if (same) same.titles.push(s.title);
    else entries.push({ titles: [s.title], credit: s.credit });
  }
  return entries;
}

function Credits({ sources }: { sources: SourceStatus[] }) {
  const entries = creditEntries(sources);
  if (!entries.length) return null;
  return (
    <section>
      <h3>Credits</h3>
      <ul className="version-credits">
        {entries.map(e => (
          <li key={e.titles.join('|')}>
            <div className="version-credit-title">{e.titles.join(' · ')}</div>
            <p>
              {e.credit.text}{' '}
              {e.credit.links.map((l, i) => (
                <span key={l.url}>
                  {i > 0 && ' · '}
                  <a href={l.url} target="_blank" rel="noreferrer">{l.label}</a>
                </span>
              ))}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "About this version": app and content versions, where each source comes from, credits, and (on a preview) the changes from the live site. */
export function VersionPanel({ info, onClose }: { info: BuildInfo; onClose: () => void }) {
  const [changes, setChanges] = useState<ContentChanges | null | undefined>(undefined);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    if (info.live) fetchJson<ContentChanges>(builtFile('changes.json')).then(setChanges);
  }, [info.live]);

  const commitUrl = info.app.commit ? `${REPO}/commit/${info.app.commit}` : null;

  return (
    <div className="version-overlay" onClick={onClose}>
      <div className="version-panel" role="dialog" aria-modal="true" aria-labelledby="version-title" onClick={e => e.stopPropagation()}>
        <div className="version-panel-head">
          <h2 id="version-title">About this version</h2>
          <button ref={closeRef} type="button" className="version-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <section>
          <h3>App</h3>
          <dl className="version-facts">
            <dt>Site</dt>
            <dd>{info.channel === 'preview' ? 'Preview of unreleased changes' : info.channel === 'live' ? 'Live' : 'Development build'}</dd>
            <dt>Version</dt>
            <dd>{versionLabel(info)}</dd>
            {commitUrl && (<><dt>Commit</dt><dd><a href={commitUrl} target="_blank" rel="noreferrer">{info.app.commit}</a></dd></>)}
            <dt>Built</dt>
            <dd>{new Date(info.app.builtAt).toLocaleString()}</dd>
          </dl>
        </section>

        <section>
          <h3>Content <span className="version-muted">({info.content.fingerprint})</span></h3>
          <table className="version-sources">
            <thead>
              <tr><th scope="col">Resource</th><th scope="col">From</th><th scope="col">License</th></tr>
            </thead>
            <tbody>
              {info.content.sources.map(s => (
                <tr key={s.id}>
                  <th scope="row">{s.title}</th>
                  <td><a href={s.source} target="_blank" rel="noreferrer">{s.organization ?? 'Source'}</a></td>
                  <td>{s.license}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="version-muted">
            Pins and checksums for every source: <a href={`${REPO}/blob/${info.app.commit ?? 'main'}/provenance/registry.json`} target="_blank" rel="noreferrer">provenance/registry.json</a>
          </p>
        </section>

        <Credits sources={info.content.sources} />

        {info.live && (
          <section>
            <h3>Changes from the live site ({info.live.ref})</h3>
            {changes === undefined && <p className="version-muted">Loading…</p>}
            {changes === null && <p className="version-muted">The list of changes isn't available for this build.</p>}
            {changes && <ChangesList changes={changes} />}
            <p><a href={info.live.url}>Open the live site</a></p>
          </section>
        )}
      </div>
    </div>
  );
}

/** build.json for this site, or null while loading or if the build has none. */
export function useBuildInfo(): BuildInfo | null {
  const [info, setInfo] = useState<BuildInfo | null>(null);
  useEffect(() => {
    fetchJson<BuildInfo>(builtFile('build.json')).then(setInfo);
  }, []);
  return info;
}

/** The version, in the header; opens the panel. Marked on preview builds. */
export function VersionBadge({ info, onOpen }: { info: BuildInfo; onOpen: () => void }) {
  const preview = info.channel === 'preview';
  return (
    <button type="button" className={`version-badge${preview ? ' preview' : ''}`} onClick={onOpen} aria-haspopup="dialog" title="About this version">
      {preview ? <Eye size={14} /> : <Info size={14} />}
      {preview && <span>Preview</span>}
      <span className={preview ? 'version-badge-detail' : undefined}>{preview ? ` · ${versionLabel(info)}` : versionLabel(info)}</span>
    </button>
  );
}

/** A strip under the header on preview builds, so a preview is never mistaken for the live site. */
export function PreviewBanner({ info, onOpen }: { info: BuildInfo; onOpen: () => void }) {
  return (
    <div className="preview-banner" role="note">
      You're viewing a preview of unreleased changes.{' '}
      {info.live && <>The live site is <a href={info.live.url}>{info.live.ref}</a>. </>}
      <button type="button" className="preview-banner-link" onClick={onOpen}>See what's changed</button>
    </div>
  );
}
