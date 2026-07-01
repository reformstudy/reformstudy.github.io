import { useState, useEffect } from 'react';
import { BookMarked, Calendar, MapPin, FileText, ChevronRight, X, List } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useResources } from '../context/ResourceContext';

export default function ConfessionalArchive() {
  const { confessionId: paramConfessionId, chapter: paramChapter } = useParams<{ confessionId?: string; chapter?: string }>();
  const routerNavigate = useNavigate();
  const { manifest, confessions, ensureResourceLoaded } = useResources();
  const [selectedId, setSelectedId] = useState<string | null>(paramConfessionId ?? null);
  const [selectedChapter, setSelectedChapter] = useState(paramChapter ? parseInt(paramChapter, 10) : 1);

  useEffect(() => {
    if (manifest && manifest.resources.confessions.length > 0 && !selectedId) {
      const firstId = manifest.resources.confessions[0].id;
      setSelectedId(firstId);
      ensureResourceLoaded(firstId);
    }
  }, [manifest, selectedId, ensureResourceLoaded]);

  // Sync URL params → state (handles back/forward and incoming links)
  useEffect(() => {
    if (paramConfessionId && paramConfessionId !== selectedId) {
      setSelectedId(paramConfessionId);
      ensureResourceLoaded(paramConfessionId);
    }
    if (paramChapter) {
      const ch = parseInt(paramChapter, 10);
      if (ch !== selectedChapter) setSelectedChapter(ch);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramConfessionId, paramChapter]);

  const availableConfessions = manifest?.resources.confessions ?? [];
  const confession = selectedId ? confessions[selectedId] : undefined;
  const confessionMeta = availableConfessions.find(c => c.id === selectedId);

  const handleConfessionSelect = (id: string) => {
    setSelectedId(id);
    setSelectedChapter(1);
    ensureResourceLoaded(id);
    routerNavigate(`/archive/${id}/1`);
  };

  const handleChapterSelect = (ch: number) => {
    setSelectedChapter(ch);
    if (selectedId) routerNavigate(`/archive/${selectedId}/${ch}`);
  };

  const chapterData = confession?.sections.find(s => s.chapter === selectedChapter);
  const totalChapters = confession?.confession.chapters ?? 0;
  const [mobileSidebar, setMobileSidebar] = useState<'left' | 'right' | null>(null);
  const closeMobile = () => setMobileSidebar(null);

  return (
    <>
    <div className="mobile-overlay" style={{ opacity: mobileSidebar ? 1 : 0, pointerEvents: mobileSidebar ? 'auto' : 'none' }} onClick={closeMobile} />

    <div className="mobile-panel-bar mobile-only">
      <button className="mobile-panel-btn" onClick={() => setMobileSidebar('left')}>
        <List size={15} /> Contents
      </button>
      <button className="mobile-panel-btn" onClick={() => setMobileSidebar('right')}>
        <BookMarked size={15} /> Info
      </button>
    </div>

    <div className="workspace">
      {/* Left sidebar: confession list + chapter nav */}
      <aside className={`left-sidebar${mobileSidebar === 'left' ? ' mobile-open' : ''}`}>
        <div className="sidebar-close-row mobile-only">
          <button className="sidebar-close-btn" onClick={closeMobile}><X size={16} /> Close</button>
        </div>
        <div className="sidebar-label">Confessions</div>

        {availableConfessions.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => handleConfessionSelect(c.id)}
            style={{
              padding: '10px 17px',
              fontWeight: 600,
              fontSize: '0.9rem',
              color: selectedId === c.id ? 'var(--accent-theo)' : 'var(--text-secondary)',
              cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              textAlign: 'left',
              borderLeft: selectedId === c.id
                ? '3px solid var(--accent-theo)'
                : '3px solid transparent',
              width: '100%',
              lineHeight: 1.3
            }}
          >
            <div>{c.name}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {c.abbreviation} · {c.year}
            </div>
          </button>
        ))}

        {confession && (
          <>
            <div className="sidebar-label" style={{ marginTop: 16 }}>Chapters</div>
            <div style={{ padding: '4px 12px 16px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
              {Array.from({ length: totalChapters }, (_, i) => i + 1).map(ch => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => handleChapterSelect(ch)}
                  title={confession.sections.find(s => s.chapter === ch)?.title ?? `Chapter ${ch}`}
                  style={{
                    aspectRatio: '1',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: ch === selectedChapter ? 'var(--accent-theo)' : 'transparent',
                    color: ch === selectedChapter ? 'white' : 'var(--text-secondary)',
                    border: 'none'
                  }}
                >
                  {ch}
                </button>
              ))}
            </div>
          </>
        )}
      </aside>

      {/* Center: chapter content */}
      <div className="center-content">
        {!confession ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
            <div style={{ textAlign: 'center' }}>
              <BookMarked size={32} color="var(--text-tertiary)" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Loading confession…
              </div>
            </div>
          </div>
        ) : !chapterData ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
            <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              Chapter {selectedChapter} not found.
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 720, width: '100%', paddingBottom: 80 }}>
            {/* Chapter header */}
            <div style={{ marginBottom: 36 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-theo)', letterSpacing: '0.05em', marginBottom: 8 }}>
                {confession.confession.abbreviation} · Chapter {selectedChapter}
              </div>
              <h1 style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '2rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: '0 0 16px',
                lineHeight: 1.3
              }}>
                {chapterData.title}
              </h1>
              <div style={{ height: 2, width: 48, backgroundColor: 'var(--accent-theo)', borderRadius: 1 }} />
            </div>

            {/* Sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              {chapterData.sections.map(section => (
                <div
                  key={section.number}
                  style={{
                    display: 'flex',
                    gap: 20,
                    padding: '20px 24px',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-soft)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-card)'
                  }}
                >
                  <div style={{
                    flexShrink: 0,
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    backgroundColor: 'var(--bg-theo-light)',
                    color: 'var(--accent-theo)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    fontFamily: 'var(--font-sans)'
                  }}>
                    §{section.number}
                  </div>
                  <p style={{
                    margin: 0,
                    fontFamily: 'var(--font-serif)',
                    fontSize: '1.1rem',
                    lineHeight: 1.85,
                    color: 'var(--text-primary)',
                    flex: 1
                  }}>
                    {section.content}
                  </p>
                </div>
              ))}
            </div>

            {/* Chapter navigation */}
            <div style={{ display: 'flex', gap: 12, marginTop: 48, justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => handleChapterSelect(Math.max(1, selectedChapter - 1))}
                disabled={selectedChapter <= 1}
                style={{
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-soft)',
                  backgroundColor: 'var(--bg-surface)',
                  color: selectedChapter <= 1 ? 'var(--text-tertiary)' : 'var(--text-primary)',
                  fontWeight: 600,
                  cursor: selectedChapter <= 1 ? 'default' : 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                ← Previous Chapter
              </button>
              <button
                type="button"
                onClick={() => handleChapterSelect(Math.min(totalChapters, selectedChapter + 1))}
                disabled={selectedChapter >= totalChapters}
                style={{
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-soft)',
                  backgroundColor: 'var(--bg-surface)',
                  color: selectedChapter >= totalChapters ? 'var(--text-tertiary)' : 'var(--text-primary)',
                  fontWeight: 600,
                  cursor: selectedChapter >= totalChapters ? 'default' : 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Next Chapter →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right sidebar: document info */}
      <aside className={`right-sidebar${mobileSidebar === 'right' ? ' mobile-open' : ''}`}>
        <div className="sidebar-close-row mobile-only">
          <button className="sidebar-close-btn" onClick={closeMobile}><X size={16} /> Close</button>
        </div>
        <div style={{ padding: '24px', backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-soft)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <BookMarked size={18} color="var(--accent-theo)" />
            Document Info
          </h2>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          {confessionMeta && confession ? (
            <>
              <div className="card">
                <div style={{
                  padding: '12px 16px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderBottom: '1px solid var(--border-soft)',
                  backgroundColor: 'var(--bg-theo-light)',
                  color: 'var(--accent-theo)'
                }}>
                  <FileText size={14} />
                  {confession.confession.abbreviation}
                </div>
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-serif)', color: 'var(--text-primary)', lineHeight: 1.3 }}>
                      {confession.confession.name}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Calendar size={14} color="var(--text-tertiary)" />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {confession.confession.year}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <MapPin size={14} color="var(--text-tertiary)" style={{ marginTop: 2, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {confession.confession.origin}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ChevronRight size={14} color="var(--text-tertiary)" />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {confession.confession.chapters} chapters
                      </span>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {confession.confession.description}
                  </p>
                </div>
              </div>

              {chapterData && (
                <div className="card">
                  <div style={{
                    padding: '12px 16px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid var(--border-soft)',
                    backgroundColor: 'var(--bg-sidebar)',
                    color: 'var(--text-tertiary)'
                  }}>
                    Current Chapter
                  </div>
                  <div style={{ padding: 16 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-theo)', marginBottom: 4 }}>
                      Chapter {selectedChapter}
                    </div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                      {chapterData.title}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {chapterData.sections.length} section{chapterData.sections.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)', fontSize: '0.9rem', fontStyle: 'italic' }}>
              Select a confession to view details.
            </div>
          )}
        </div>
      </aside>
    </div>
    </>
  );
}
