import React, { useEffect, useMemo, useState } from 'react';

function apiBase() {
  return import.meta.env.DEV ? 'http://localhost:4001' : '';
}

const PAGE_SIZE = 4;

function getFileType(filename: string | null) {
  if (!filename) return 'unknown';
  if (filename.endsWith('.json')) return 'JSON';
  if (filename.endsWith('.md')) return 'Markdown';
  if (filename.endsWith('.txt')) return 'Text';
  return 'File';
}

function formatTextCount(text: string) {
  const lines = text.split('\n').length;
  return `${lines} lines · ${text.length} chars`;
}

function updateJsonValue(data: any, path: Array<string | number>, value: any): any {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  if (Array.isArray(data)) {
    const next = [...data];
    next[head as number] = updateJsonValue(next[head as number], rest, value);
    return next;
  }
  return {
    ...data,
    [head]: updateJsonValue(data?.[head], rest, value)
  };
}

function JsonFieldEditor({ value, path, onChange }: { value: any; path: Array<string | number>; onChange: (path: Array<string | number>, value: any) => void; }) {
  const updateValue = (next: any) => onChange(path, next);

  if (Array.isArray(value)) {
    return (
      <div style={{ borderLeft: '2px solid var(--border-soft)', paddingLeft: 12, marginBottom: 16 }}>
        <div style={{ marginBottom: 8, color: 'var(--text-secondary)', fontWeight: 700 }}>Array [{value.length}]</div>
        {value.map((item, index) => (
          <div key={index} style={{ marginBottom: 14, padding: 12, borderRadius: 14, background: 'var(--bg-surface)' }}>
            <div style={{ marginBottom: 8, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Item {index + 1}</div>
            <JsonFieldEditor value={item} path={[...path, index]} onChange={onChange} />
          </div>
        ))}
      </div>
    );
  }

  if (value && typeof value === 'object') {
    return (
      <div style={{ borderLeft: '2px solid var(--border-soft)', paddingLeft: 12, marginBottom: 16 }}>
        {Object.entries(value).map(([key, child]) => (
          <div key={key} style={{ marginBottom: 14, padding: 12, borderRadius: 14, background: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, gap: 12 }}>
              <div style={{ fontWeight: 700 }}>{key}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{child === null ? 'null' : typeof child}</div>
            </div>
            <JsonFieldEditor value={child} path={[...path, key]} onChange={onChange} />
          </div>
        ))}
      </div>
    );
  }

  const inputType = typeof value === 'number' ? 'number' : 'text';
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{path[path.length - 1]}</span>
      <input
        type={inputType}
        value={value ?? ''}
        onChange={e => {
          let nextValue: any = e.target.value;
          if (typeof value === 'number') nextValue = Number(nextValue);
          updateValue(nextValue);
        }}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border-soft)', background: 'var(--bg-surface)' }}
      />
    </label>
  );
}

export default function ContentEditor() {
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [jsonData, setJsonData] = useState<any>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [filesLoaded, setFilesLoaded] = useState(false);
  const [fileSearch, setFileSearch] = useState('');
  const [contentSearch, setContentSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const filteredFiles = useMemo(() => {
    if (!fileSearch.trim()) return files;
    return files.filter(file => file.toLowerCase().includes(fileSearch.toLowerCase()));
  }, [files, fileSearch]);

  const isJsonFile = selected?.endsWith('.json');

  const sections = useMemo(() => {
    if (!jsonData) return [];
    if (Array.isArray(jsonData)) {
      return [{ key: 'root', value: jsonData }];
    }
    if (typeof jsonData === 'object' && jsonData !== null) {
      const arraySections = Object.entries(jsonData).filter(([, value]) => Array.isArray(value));
      if (arraySections.length > 0) {
        return arraySections.map(([key, value]) => ({ key, value }));
      }
      return [{ key: 'object', value: jsonData }];
    }
    return [];
  }, [jsonData]);

  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    setActiveSection(sections[0]?.key ?? null);
    setPage(1);
  }, [sections]);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      setFilesLoaded(true);
      return;
    }
    async function loadFiles() {
      try {
        const res = await fetch(`${apiBase()}/files`);
        const json = await res.json();
        setFiles(json.files || []);
        setServerError(null);
      } catch {
        setServerError('Could not reach content server at localhost:4001.');
      } finally {
        setFilesLoaded(true);
      }
    }
    loadFiles();
  }, []);

  const parseJson = (text: string) => {
    try {
      const parsed = JSON.parse(text);
      setJsonData(parsed);
      setJsonError(null);
    } catch (err) {
      setJsonData(null);
      setJsonError((err as Error).message);
    }
  };

  const openFile = async (f: string) => {
    setSelected(f);
    setMessage('');
    setSavedAt(null);
    setPage(1);
    try {
      const res = await fetch(`${apiBase()}/file/${f}`);
      if (!res.ok) throw new Error('Failed to load file');
      const text = await res.text();
      setContent(text);
      setOriginalContent(text);
      if (f.endsWith('.json')) {
        parseJson(text);
      } else {
        setJsonData(null);
        setJsonError(null);
      }
    } catch (err) {
      setMessage(String(err));
      setContent('');
      setOriginalContent('');
      setJsonData(null);
      setJsonError(null);
    }
  };

  const updateJson = (path: Array<string | number>, value: any) => {
    if (!jsonData) return;
    const nextData = updateJsonValue(jsonData, path, value);
    setJsonData(nextData);
    setContent(JSON.stringify(nextData, null, 2));
  };

  const saveFile = async () => {
    if (!selected) return setMessage('No file selected');
    setIsSaving(true);
    setMessage('');
    const payload = selected.endsWith('.json') && jsonData ? JSON.stringify(jsonData, null, 2) : content;

    try {
      const res = await fetch(`${apiBase()}/file/${selected}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: payload })
      });
      if (!res.ok) throw new Error('Save failed');
      setOriginalContent(payload);
      setContent(payload);
      setSavedAt(new Date().toLocaleTimeString());
      setMessage('Saved successfully');
    } catch (err) {
      setMessage(String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const formatJson = () => {
    if (!jsonData) return;
    setContent(JSON.stringify(jsonData, null, 2));
    setMessage('Formatted JSON.');
  };

  const revertChanges = () => {
    setContent(originalContent);
    if (selected?.endsWith('.json')) parseJson(originalContent);
    setMessage('Reverted to last loaded version.');
  };

  const isDirty = selected !== null && content !== originalContent;
  const activeSectionData = sections.find(section => section.key === activeSection) ?? sections[0];

  const sectionItems = useMemo(() => {
    if (!activeSectionData) return [];
    return Array.isArray(activeSectionData.value) ? activeSectionData.value : [activeSectionData.value];
  }, [activeSectionData]);

  const filteredItems = useMemo(() => {
    const query = contentSearch.trim().toLowerCase();
    if (!query) return sectionItems;
    return sectionItems.filter(item => JSON.stringify(item).toLowerCase().includes(query));
  }, [contentSearch, sectionItems]);

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const visibleItems = filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="workspace" style={{ display: 'flex', gap: 16, minHeight: 'calc(100vh - 120px)' }}>
      <aside style={{ width: 320, padding: 20, borderRight: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h3 style={{ margin: 0, marginBottom: 8 }}>Local Content Files</h3>
          <small style={{ color: 'var(--text-secondary)' }}>Search and open files from the editable content folder.</small>
        </div>

        <input
          type="search"
          placeholder="Filter files…"
          value={fileSearch}
          onChange={e => setFileSearch(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border-soft)', background: 'var(--bg-surface)' }}
        />

        <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gap: 8 }}>
          {filteredFiles.length === 0 && filesLoaded && (
            <div style={{ padding: '12px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {!import.meta.env.DEV ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5 }}>
                  Content Editor is only available in development mode. Run <code style={{ background: 'var(--bg-sidebar)', padding: '1px 5px', borderRadius: 4 }}>npm run dev:cms</code> locally to use this tool.
                </div>
              ) : serverError ? (
                <div style={{ color: 'var(--accent-exe)', fontSize: '0.88rem', lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Content server not running</div>
                  <div>{serverError}</div>
                  <div style={{ marginTop: 8, color: 'var(--text-secondary)' }}>
                    Start it with: <code style={{ background: 'var(--bg-sidebar)', padding: '1px 5px', borderRadius: 4 }}>npm run dev:cms</code>
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                  {fileSearch ? 'No matching files.' : 'No files found in content/.'}
                </div>
              )}
            </div>
          )}
          {filteredFiles.map(f => {
            const isActive = f === selected;
            return (
              <button
                key={f}
                type="button"
                onClick={() => openFile(f)}
                className={`nav-pill ${isActive ? 'active' : ''}`}
                style={{
                  textAlign: 'left',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: isActive ? '1px solid var(--accent-exe)' : '1px solid transparent',
                  background: isActive ? 'rgba(94, 131, 255, 0.08)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)'
                }}
              >
                <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: 2 }}>{getFileType(f)}</div>
              </button>
            );
          })}
        </div>
      </aside>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <section style={{ padding: 20, borderRadius: 20, background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Selected file</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{selected ?? 'No file selected'}</div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ padding: '6px 10px', borderRadius: 999, background: 'var(--bg-sidebar)', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{getFileType(selected)}</span>
              {selected && (
                <span style={{ padding: '6px 10px', borderRadius: 999, background: isDirty ? 'var(--accent-exe-light)' : 'var(--bg-sidebar)', color: isDirty ? 'var(--accent-exe)' : 'var(--text-secondary)', fontSize: '0.82rem' }}>
                  {isDirty ? 'Unsaved changes' : 'Clean'}
                </span>
              )}
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="action-button" type="button" onClick={saveFile} disabled={!selected || isSaving}>
                {isSaving ? 'Saving…' : 'Save'}
              </button>
              <button className="action-button secondary" type="button" onClick={revertChanges} disabled={!selected || !isDirty}>
                Revert
              </button>
              {isJsonFile && (
                <button className="action-button secondary" type="button" onClick={formatJson} disabled={!jsonData}>
                  Format JSON
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ color: 'var(--text-secondary)' }}>{selected ? formatTextCount(content) : 'Open a file to edit its content.'}</div>
            {savedAt && <div style={{ color: 'var(--text-secondary)' }}>Last saved at {savedAt}</div>}
          </div>

          {message && (
            <div style={{ color: message.startsWith('Saved') ? 'var(--accent-success)' : 'var(--accent-exe)', fontWeight: 600 }}>
              {message}
            </div>
          )}
        </section>

        {selected && isJsonFile ? (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <input
                type="search"
                placeholder="Search JSON content…"
                value={contentSearch}
                onChange={e => setContentSearch(e.target.value)}
                style={{ width: '100%', maxWidth: 360, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border-soft)', background: 'var(--bg-surface)' }}
              />
              {sections.length > 1 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {sections.map(section => (
                    <button
                      key={section.key}
                      type="button"
                      onClick={() => { setActiveSection(section.key); setPage(1); }}
                      className={`nav-pill ${section.key === activeSection ? 'active' : ''}`}
                      style={{ padding: '10px 14px', borderRadius: 999, border: section.key === activeSection ? '1px solid var(--accent-exe)' : '1px solid var(--border-soft)' }}
                    >
                      {section.key}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {jsonError ? (
              <div style={{ padding: 18, borderRadius: 16, background: 'var(--bg-sidebar)', color: 'var(--accent-exe)' }}>
                JSON parse error: {jsonError}
              </div>
            ) : (
              <>
                {visibleItems.length === 0 ? (
                  <div style={{ padding: 18, borderRadius: 16, background: 'var(--bg-sidebar)', color: 'var(--text-secondary)' }}>
                    No matching JSON items found.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 16 }}>
                    {visibleItems.map((item, index) => (
                      <div key={index} style={{ padding: 20, borderRadius: 20, background: 'white', border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-card)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
                          <div>
                            <div style={{ fontWeight: 700 }}>Item {(page - 1) * PAGE_SIZE + index + 1}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Editable JSON object</div>
                          </div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{typeof item}</div>
                        </div>
                        <JsonFieldEditor
                          value={item}
                          path={[...(activeSection ? (activeSection === 'root' ? [] : [activeSection]) : []), index]}
                          onChange={(path, nextValue) => updateJson(path, nextValue)}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {pageCount > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ color: 'var(--text-secondary)' }}>Page {page} of {pageCount}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="action-button secondary"
                        onClick={() => setPage(prev => Math.max(1, prev - 1))}
                        disabled={page <= 1}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        className="action-button secondary"
                        onClick={() => setPage(prev => Math.min(pageCount, prev + 1))}
                        disabled={page >= pageCount}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        ) : (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label htmlFor="content-editor" style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>File content</label>
            <textarea
              id="content-editor"
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={selected ? 'Edit file content here…' : 'Select a file to begin editing.'}
              style={{
                flex: 1,
                width: '100%',
                minHeight: 0,
                padding: 18,
                borderRadius: 20,
                border: '1px solid var(--border-soft)',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace',
                fontSize: 14,
                lineHeight: 1.6,
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)'
              }}
            />
          </section>
        )}
      </main>
    </div>
  );
}
