import { useState, useEffect } from 'react';
import { BookOpen, Library, Clock, ChevronRight } from 'lucide-react';
import { useResources } from '../context/ResourceContext';

export default function GlobalSearch() {
  const { bibles, confessions, ensureResourceLoaded } = useResources();
  const [searchTerm, setSearchTerm] = useState('Abraham');
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    ensureResourceLoaded('kjv');
    ensureResourceLoaded('wcf');
  }, [ensureResourceLoaded]);

  // Perform search when resources load and search term changes
  useEffect(() => {
    const performSearch = () => {
      const newResults: any[] = [];
      const term = searchTerm.toLowerCase();

      // Search in Bible
      const kjv = bibles['kjv'];
      if (kjv) {
        kjv.books.forEach(book => {
          book.verses.forEach(verse => {
            if (verse.text.toLowerCase().includes(term)) {
              newResults.push({
                type: 'scripture',
                title: `${book.name} ${verse.chapter}:${verse.verse}`,
                text: verse.text.substring(0, 150) + (verse.text.length > 150 ? '...' : ''),
                label: 'Scripture Reference',
                theme: '--accent-exe',
                bg: '--bg-exe-light',
                icon: <BookOpen size={14} />
              });
            }
          });
        });
      }

      // Search in confessions
      const wcf = confessions['wcf'];
      if (wcf) {
        wcf.sections.forEach(section => {
          section.sections.forEach(subsection => {
            if (subsection.content.toLowerCase().includes(term)) {
              newResults.push({
                type: 'confession',
                title: `${wcf.confession.name}, ${section.title} (${subsection.number})`,
                text: subsection.content.substring(0, 150) + (subsection.content.length > 150 ? '...' : ''),
                label: 'Confessional Doctrine',
                theme: '--accent-theo',
                bg: '--bg-theo-light',
                icon: <Library size={14} />
              });
            }
          });
        });
      }

      setResults(newResults.slice(0, 6)); // Limit to 6 results
    };

    performSearch();
  }, [searchTerm, bibles, confessions]);

  return (
    <div className="workspace">
      <aside className="left-sidebar" style={{ padding: 32, width: 280 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 20 }}>
          Filter by Domain
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {['All Results', 'Scripture & Exegesis', 'Theology & Confessions', 'Geography'].map((filter, index) => (
            <button
              key={filter}
              type="button"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                backgroundColor: index === 0 ? 'white' : 'transparent',
                boxShadow: index === 0 ? 'var(--shadow-card)' : 'none',
                fontWeight: index === 0 ? 700 : 600,
                color: index === 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: 'none'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: index === 0 ? 'var(--text-primary)' : 'var(--border-soft)' }} />
                {filter}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{results.length}</span>
            </button>
          ))}
        </div>
      </aside>

      <div className="center-content" style={{ display: 'block', padding: 40 }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.2rem', marginBottom: 10 }}>
            Exploring <span style={{ color: 'var(--accent-exe)', fontStyle: 'italic' }}>"{searchTerm}"</span>
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search scriptures, keywords, or references..."
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--border-soft)',
                fontSize: '0.95rem',
                fontFamily: 'inherit'
              }}
            />
          </div>
          <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Found {results.length} {results.length === 1 ? 'result' : 'results'}
          </div>
        </div>

        {results.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
            {results.map((card, idx) => (
              <div key={idx} style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-card)', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: 4, width: '100%', backgroundColor: `var(${card.theme})` }} />
                <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid var(--border-soft)', color: `var(${card.theme})`, backgroundColor: `var(${card.bg})` }}>
                  {card.icon} {card.label}
                </div>
                <div style={{ padding: 20, flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', marginBottom: 12, color: 'var(--text-primary)' }}>{card.title}</div>
                  <div style={{ fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>{card.text}</div>
                </div>
                <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-soft)', backgroundColor: '#FAFAFA', fontSize: '0.85rem', fontWeight: 700, display: 'flex', justifyContent: 'space-between', color: `var(${card.theme})` }}>
                  Open Result <ChevronRight size={16} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '1rem', marginBottom: 8 }}>No results found</div>
            <div style={{ fontSize: '0.9rem' }}>Try searching for different keywords</div>
          </div>
        )}
      </div>
    </div>
  );
}
