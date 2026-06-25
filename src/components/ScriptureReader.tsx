import { useState, useEffect } from 'react';
import { BookOpen } from 'lucide-react';
import { useResources } from '../context/ResourceContext';

export default function ScriptureReader() {
  const { bibles, ensureResourceLoaded } = useResources();
  const [selectedBook, setSelectedBook] = useState('MAT');
  const [selectedChapter, setSelectedChapter] = useState(1);

  // Ensure KJV is loaded when component mounts
  useEffect(() => {
    ensureResourceLoaded('kjv');
  }, [ensureResourceLoaded]);

  const kjv = bibles['kjv'];

  if (!kjv) {
    return (
      <div className="workspace">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '600px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Loading Bible...
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentBook = kjv.books.find(b => b.id === selectedBook);
  const currentVerses = currentBook
    ? currentBook.verses.filter(v => v.chapter === selectedChapter)
    : [];

  const getBooks = () => {
    // Group books by testament
    const ot = kjv.books.filter(b => b.testament === 'OT');
    const nt = kjv.books.filter(b => b.testament === 'NT');
    return { ot, nt };
  };

  const books = getBooks();

  return (
    <div className="workspace">
      <aside className="left-sidebar">
        <div style={{ padding: '20px 20px 10px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
          Old Testament
        </div>
        {books.ot.map((book) => (
          <button
            key={book.id}
            type="button"
            onClick={() => {
              setSelectedBook(book.id);
              setSelectedChapter(1);
            }}
            style={{
              padding: '10px 20px',
              fontWeight: 600,
              color: selectedBook === book.id ? 'var(--accent-geo)' : 'var(--text-secondary)',
              cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              textAlign: 'left',
              borderLeft: selectedBook === book.id ? '3px solid var(--accent-geo)' : '3px solid transparent',
              paddingLeft: '17px'
            }}
          >
            {book.name}
          </button>
        ))}

        <div style={{ padding: '20px 20px 10px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginTop: 20 }}>
          New Testament
        </div>
        {books.nt.map((book) => (
          <button
            key={book.id}
            type="button"
            onClick={() => {
              setSelectedBook(book.id);
              setSelectedChapter(1);
            }}
            style={{
              padding: '10px 20px',
              fontWeight: 600,
              color: selectedBook === book.id ? 'var(--accent-geo)' : 'var(--text-secondary)',
              cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              textAlign: 'left',
              borderLeft: selectedBook === book.id ? '3px solid var(--accent-geo)' : '3px solid transparent',
              paddingLeft: '17px'
            }}
          >
            {book.name}
          </button>
        ))}

        {currentBook && (
          <div style={{ padding: '12px 20px 20px', backgroundColor: 'white', borderBottom: '1px solid var(--border-soft)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
              {Array.from({ length: currentBook.chapters }, (_, i) => i + 1).map((chapter) => (
                <button
                  key={chapter}
                  type="button"
                  onClick={() => setSelectedChapter(chapter)}
                  style={{
                    aspectRatio: '1',
                    borderRadius: 8,
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: chapter === selectedChapter ? 'var(--accent-geo)' : 'transparent',
                    color: chapter === selectedChapter ? 'white' : 'var(--text-secondary)',
                    border: 'none'
                  }}
                >
                  {chapter}
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      <div className="center-content">
        <div style={{ maxWidth: 680, width: '100%', paddingBottom: 80 }}>
          {currentBook && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 40 }}>
                <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', marginBottom: 8 }}>
                  {currentBook.name} {selectedChapter}
                </h1>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, backgroundColor: 'var(--bg-geo-light)', color: 'var(--accent-geo)', padding: '4px 12px', borderRadius: 16 }}>
                  {kjv.version.abbreviation} - {kjv.version.name}
                </span>
              </div>

              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', lineHeight: 2, color: '#38332E' }}>
                {currentVerses.length > 0 ? (
                  currentVerses.map((verse) => (
                    <div key={`${verse.book}-${verse.chapter}-${verse.verse}`} className="verse">
                      <span className="v-num">{verse.verse}</span>
                      {verse.text}
                    </div>
                  ))
                ) : (
                  <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    No verses available for this chapter.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <aside className="right-sidebar">
        <div style={{ padding: '24px', backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-soft)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={18} /> Passage Insights
          </h2>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Select a verse for detailed analysis
          </div>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto' }}>
          <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border-soft)', backgroundColor: 'var(--bg-exe-light)', color: '#B07B46' }}>
              Word Study
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'inline-block', fontSize: '0.75rem', fontWeight: 700, backgroundColor: 'var(--bg-sidebar)', padding: '2px 8px', borderRadius: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
                Coming Soon
              </div>
              <div style={{ fontStyle: 'italic', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                Hover over or tap any word in the scripture to view detailed word study, etymology, and usage information.
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
