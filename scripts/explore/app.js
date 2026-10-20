// The pipeline explorer's page: four tabs over the /api routes in server.js.

const view = document.getElementById('view');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = n => Number(n).toLocaleString();
const kb = n => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : n >= 1e3 ? `${(n / 1e3).toFixed(0)} KB` : `${n} B`);
const badge = (ok, yes = '✓ ok', no = '✗ fails') => `<span class="badge ${ok ? 'ok' : 'bad'}">${ok ? yes : no}</span>`;
const short = h => (h ? `${h.slice(0, 12)}…` : '—');

async function api(route, params = {}) {
  const res = await fetch(`${route}?${new URLSearchParams(params)}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error);
  return body;
}

const state = { overview: null, resource: 'kjv', place: 'GEN 1', failuresOnly: false };

// ---- 1. Sources ----

async function showSources() {
  const o = state.overview ??= await api('/api/overview');
  view.innerHTML = `
    <p class="lead">Each publisher's download is committed in <code>sources/</code>, byte for byte (text files gzipped).
    Before anything is converted, its SHA-256 must equal the one recorded in <code>provenance/registry.json</code>.
    Fetching a new release (<code>--download</code>) is the only step that touches the network.</p>
    ${o.sources.map(s => `
      <div class="card">
        <h3>${esc(s.title)} ${badge(s.ok, '✓ checksum matches', '✗ checksum differs')}</h3>
        <div class="muted">${esc(s.organization ?? '')}${s.page ? ` · <a href="${esc(s.page)}" target="_blank" rel="noreferrer">${esc(s.page)}</a>` : ''}${s.published ? ` · published ${esc(s.published)}` : ''}</div>
        <div class="muted">${esc(s.license)}</div>
        ${s.error ? `<p class="error">${esc(s.error)}</p>` : ''}
        <table style="margin-top:8px">
          <thead><tr><th>File</th><th>Downloaded from</th><th>Size</th><th>Stored as</th><th>SHA-256</th></tr></thead>
          <tbody>${s.files.map(f => `<tr><td class="mono">${esc(f.file)}</td><td class="mono"><a href="${esc(f.url)}" target="_blank" rel="noreferrer">${esc(f.url)}</a></td><td>${kb(f.bytes)}</td><td class="mono">${esc(f.stored)} (${kb(f.storedBytes)})</td><td class="mono" title="${esc(f.sha256)}">${short(f.sha256)}</td></tr>`).join('')}</tbody>
        </table>
        <p class="mono muted" style="margin:8px 0 0">recorded ${esc(s.recorded)}<br>actual &nbsp;&nbsp;${esc(s.actual ?? '—')}${s.files.length > 1 ? ' (digest of the files)' : ''}</p>
      </div>`).join('')}`;
}

// ---- 2. Ingest ----

async function showIngest() {
  const o = state.overview ??= await api('/api/overview');
  view.innerHTML = `
    <p class="lead">Each converter reads its committed sources and returns the exact text of every file it writes to <code>res/</code>.
    Here it runs in memory only: you see the files, its notes and timing, and whether each file is identical to what is committed
    (the same check authentication's "reproduction" step makes).</p>
    <div class="steps">${o.pipelines.map(p => `
      <div class="step"><b>${esc(p.id)}</b>
        <div class="muted">reads ${p.sources.map(s => `<code>sources/${esc(s)}/</code>`).join(', ')}<br>writes ${p.owns.map(w => `<code>${esc(w)}</code>`).join(', ')}</div>
        <p style="margin:8px 0 0"><button class="primary" data-run="${esc(p.id)}">Run in memory</button></p>
      </div>`).join('')}</div>
    <div id="ingest-result"></div>`;
  view.querySelectorAll('[data-run]').forEach(b => b.addEventListener('click', () => runIngest(b.dataset.run, b)));
}

async function runIngest(id, button) {
  const out = document.getElementById('ingest-result');
  button.disabled = true;
  out.innerHTML = `<p><span class="spinner"></span> Running ${esc(id)}…</p>`;
  try {
    const r = await api('/api/ingest', { id });
    const all = r.files.length === r.same;
    out.innerHTML = `
      <div class="card">
        <h3>${esc(id)}: ${fmt(r.files.length)} file${r.files.length === 1 ? '' : 's'} in ${fmt(r.ms)} ms ${badge(all, '✓ identical to res/', '✗ differs from res/')}</h3>
        <div class="muted">${esc(r.summary)}</div>
        ${r.notes.length ? `<details style="margin-top:8px"><summary>${r.notes.length} converter note${r.notes.length === 1 ? '' : 's'}</summary><ul>${r.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></details>` : ''}
        <div class="row" style="margin-top:10px"><input type="search" id="file-filter" placeholder="Filter files, e.g. ROM/" aria-label="Filter files"></div>
        <table><thead><tr><th>File</th><th>Size</th><th>Compared with res/</th><th></th></tr></thead><tbody id="file-rows"></tbody></table>
        <div id="file-view"></div>
      </div>`;
    const rows = document.getElementById('file-rows');
    const render = q => {
      const list = r.files.filter(f => f.path.includes(q)).slice(0, 200);
      rows.innerHTML = list.map(f => `<tr><td class="mono">${esc(f.path)}</td><td>${kb(f.bytes)}</td><td>${f.status === 'same' ? badge(true, '✓ same') : badge(false, '', `✗ ${esc(f.status)}`)}</td><td><button class="link" data-file="${esc(f.path)}">View</button></td></tr>`).join('')
        + (r.files.filter(f => f.path.includes(q)).length > 200 ? '<tr><td colspan="4" class="muted">Showing the first 200; filter to narrow.</td></tr>' : '');
      rows.querySelectorAll('[data-file]').forEach(b => b.addEventListener('click', () => viewFile(id, b.dataset.file)));
    };
    render('');
    document.getElementById('file-filter').addEventListener('input', e => render(e.target.value));
  } catch (err) {
    out.innerHTML = `<p class="error">${esc(err.message)}</p>`;
  } finally {
    button.disabled = false;
  }
}

async function viewFile(id, path) {
  const box = document.getElementById('file-view');
  box.innerHTML = '<p><span class="spinner"></span> Loading…</p>';
  const f = await api('/api/generated', { id, path });
  const same = f.generated === f.committed;
  const cut = t => (t && t.length > 60000 ? `${t.slice(0, 60000)}\n… (${fmt(t.length)} characters; first 60,000 shown)` : t);
  box.innerHTML = `<h3 style="margin-top:14px">${esc(path)} ${badge(same, '✓ identical to res/', '✗ differs from res/')}</h3>
    ${same ? `<div class="raw-block"><pre>${esc(cut(f.generated))}</pre></div>`
    : `<div class="cols"><div><h4>Generated now</h4><div class="raw-block"><pre>${esc(cut(f.generated) ?? '—')}</pre></div></div><div><h4>Committed in res/</h4><div class="raw-block"><pre>${esc(cut(f.committed) ?? '—')}</pre></div></div></div>`}`;
  box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---- 3. Authenticate ----

function showAuthenticate() {
  view.innerHTML = `
    <p class="lead">Authentication proves <code>res/</code> is the sources' text. It reads every source again with its own code (not the converters'),
    compares every verse, title, paragraph and entry, accounts for every character that is left out, and re-derives references, verse ranges,
    parts of speech and proof texts. It runs in every build and in <code>npm test</code>; here you can run it and read the report.</p>
    <p><button class="primary" id="run-auth">Run authentication</button> <span class="muted">(about 15 seconds)</span></p>
    <div id="auth-result"></div>`;
  document.getElementById('run-auth').addEventListener('click', runAuth);
}

async function runAuth(e) {
  const out = document.getElementById('auth-result');
  e.target.disabled = true;
  out.innerHTML = '<p><span class="spinner"></span> Authenticating…</p>';
  try {
    const r = await api('/api/authenticate');
    out.innerHTML = `<div class="card"><h3>${badge(r.ok, '✓ Authentication passed', '✗ Authentication failed')} <span class="muted">${fmt(r.ms)} ms</span></h3></div>`
      + r.report.map(sec => {
        const excluded = sec.excluded ? Object.entries(sec.excluded) : [];
        const max = Math.max(1, ...excluded.map(([, n]) => n));
        return `<div class="card"><h3>${esc(sec.id)}</h3>
          <ul style="list-style:none;padding:0;margin:0">${sec.checks.map(c => `<li style="margin:4px 0">${badge(!c.problems.length, '✓', '✗')} ${esc(c.name)}
            ${c.problems.length ? `<ul>${c.problems.slice(0, 50).map(p => `<li class="mono">${esc(p)}</li>`).join('')}${c.problems.length > 50 ? `<li>…and ${fmt(c.problems.length - 50)} more</li>` : ''}</ul>` : ''}</li>`).join('')}</ul>
          ${excluded.length ? `<details style="margin-top:8px"><summary>Left out by name: ${excluded.length} categor${excluded.length === 1 ? 'y' : 'ies'} (characters, spaces not counted)</summary>
            <table style="margin-top:6px">${excluded.map(([k, n]) => `<tr><td style="width:40%">${esc(k)}</td><td style="width:15%">${fmt(n)}</td><td><div class="bar"><span style="width:${(100 * n / max).toFixed(1)}%"></span></div></td></tr>`).join('')}</table></details>` : ''}
        </div>`;
      }).join('');
  } catch (err) {
    out.innerHTML = `<p class="error">${esc(err.message)}</p>`;
  } finally {
    e.target.disabled = false;
  }
}

// ---- 4. Inspect units ----

const COLUMN_HELP = {
  raw: 'Raw source: the publisher\'s file, as committed',
  source: 'Read from the source: the text authentication reads from it, with its own reader',
  output: 'Output: what the converter wrote to res/',
};

async function showInspect() {
  const o = state.overview ??= await api('/api/overview');
  view.innerHTML = `
    <p class="lead">Pick a resource and a place. Each unit shows the raw source, the text authentication reads from it, and what the converter wrote,
    with the verdict of the verbatim check (same characters and word breaks, apart from the named exceptions).</p>
    <div class="row">
      <label>Resource <select id="resource">${o.resources.map(r => `<option value="${esc(r.id)}" ${r.id === state.resource ? 'selected' : ''}>${esc(r.title)}</option>`).join('')}</select></label>
      <label>Place <select id="place"></select></label>
      <label><input type="checkbox" id="failures" ${state.failuresOnly ? 'checked' : ''}> Failures only</label>
    </div>
    <div id="units"></div>`;
  document.getElementById('resource').addEventListener('change', async e => { state.resource = e.target.value; state.place = null; await loadPlaces(); });
  document.getElementById('place').addEventListener('change', e => { state.place = e.target.value; loadUnits(); });
  document.getElementById('failures').addEventListener('change', e => { state.failuresOnly = e.target.checked; loadUnits(); });
  await loadPlaces();
}

async function loadPlaces() {
  const groups = await api('/api/places', { resource: state.resource });
  const select = document.getElementById('place');
  select.innerHTML = groups.map(g => `<optgroup label="${esc(g.group)}">${g.places.map(p => `<option value="${esc(p.place)}">${esc(g.places.length > 1 && g.group !== 'Chapters' && g.group !== 'Entries' ? `${g.group} ${p.label}` : p.label)}</option>`).join('')}</optgroup>`).join('');
  const all = groups.flatMap(g => g.places.map(p => p.place));
  if (!all.includes(state.place)) state.place = all[0];
  select.value = state.place;
  await loadUnits();
}

let request = 0;
async function loadUnits() {
  const box = document.getElementById('units');
  const mine = ++request;
  const place = state.place;
  box.innerHTML = '<p><span class="spinner"></span> Reading the source and the output…</p>';
  try {
    const r = await api('/api/inspect', { resource: state.resource, place });
    if (mine !== request) return; // a newer choice was made while this one loaded
    const units = state.failuresOnly ? r.units.filter(u => u.verdict) : r.units;
    box.innerHTML = `
      <div class="card"><h3>${esc(place)}: ${fmt(r.summary.units)} units ${badge(!r.summary.failed, '✓ all verbatim', `✗ ${fmt(r.summary.failed)} fail`)}</h3>
        <div class="muted">Raw file: <code>${esc(r.rawFile)}</code> · exceptions applied: ${r.exceptions.length ? r.exceptions.map(e => `<code>${esc(e)}</code>`).join(', ') : 'none'}</div>
        <div class="muted">"Read from the source" is shown with whitespace collapsed to single spaces: the check compares where word breaks fall, not how much space there is.</div>
        ${r.raw ? `<details style="margin-top:8px"><summary>Raw source of this chapter (${fmt(r.raw.length)} characters)</summary><div class="raw-block"><pre>${esc(r.raw)}</pre></div></details>` : ''}
        ${r.sections ? `<details style="margin-top:8px"><summary>Sections: verse ranges re-derived from the passage markers</summary><table style="margin-top:6px"><thead><tr><th>Output range</th><th>From the markers</th><th>Title</th><th>Paragraphs</th><th></th></tr></thead><tbody>${r.sections.map(s => `<tr><td>${s.start}–${s.end}</td><td>${s.expected ? `${s.expected.start}–${s.expected.end}` : '—'}</td><td>${esc(s.title ?? '')}</td><td>${s.paragraphs}</td><td>${badge(s.ok, '✓', '✗')}</td></tr>`).join('')}</tbody></table></details>` : ''}
      </div>
      ${units.length ? units.map(unitCard).join('') : '<p class="muted">Nothing to show.</p>'}`;
  } catch (err) {
    if (mine === request) box.innerHTML = `<p class="error">${esc(err.message)}</p>`;
  }
}

const collapse = t => (t === null || t === undefined ? t : t.replace(/\s+/g, ' ').trim());

function unitCard(u) {
  const empty = name => (name === 'raw' && state.resource === 'henry' ? 'See "Raw source of this chapter" above.' : '—');
  const col = (name, text) => `<div><h4 title="${esc(COLUMN_HELP[name])}">${esc(COLUMN_HELP[name].split(':')[0])}</h4><pre>${text === null || text === undefined ? `<span class="muted">${empty(name)}</span>` : esc(text)}</pre></div>`;
  return `<div class="unit ${u.verdict ? 'failed' : ''}">
    <div class="unit-head"><span class="key">${esc(u.key)}</span><span class="muted">${esc(u.kind)}</span>${badge(!u.verdict, '✓ verbatim', '✗ fails')}</div>
    <div class="cols">${col('raw', u.raw)}${col('source', collapse(u.source))}${col('output', u.output)}</div>
    ${u.verdict ? `<div class="verdict">${esc(u.verdict)}</div>` : ''}
    ${u.notes?.length ? `<div class="notes">${u.notes.map(esc).join('<br>')}</div>` : ''}
  </div>`;
}

// ---- tabs ----

const TABS = { sources: showSources, ingest: showIngest, authenticate: showAuthenticate, inspect: showInspect };
async function select(tab) {
  document.querySelectorAll('nav [role=tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  history.replaceState(null, '', `#${tab}`);
  view.innerHTML = '<p><span class="spinner"></span> Loading…</p>';
  try { await TABS[tab](); } catch (err) { view.innerHTML = `<p class="error">${esc(err.message)}</p>`; }
}
document.querySelectorAll('nav [role=tab]').forEach(b => b.addEventListener('click', () => select(b.dataset.tab)));
select(TABS[location.hash.slice(1)] ? location.hash.slice(1) : 'sources');
