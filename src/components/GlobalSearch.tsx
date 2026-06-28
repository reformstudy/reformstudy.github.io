import { useState, useEffect, useRef, type ReactNode } from 'react';
import { BookOpen, Library, ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import { useResources } from '../context/ResourceContext';

type SearchResultType = 'scripture' | 'confession';

interface SearchResult {
  type: SearchResultType;
  title: string;
  text: string;
  label: string;
  theme: string;
  bg: string;
  icon: ReactNode;
}

type FilterId = 'all' | 'scripture' | 'theology';

const FILTERS: { id: FilterId; label: string; type?: SearchResultType }[] = [
  { id: 'all', label: 'All Results' },
  { id: 'scripture', label: 'Scripture & Exegesis', type: 'scripture' },
  { id: 'theology', label: 'Theology & Confessions', type: 'confession' },
];

const RESULT_LIMIT = 20;

export default function GlobalSearch() {
  const { bibles, confessions, ensureResourceLoaded } = useResources();
  const [searchTerm, setSearchTerm] = useState('Abraham');
  const [debouncedTerm, setDebouncedTerm] = useState(searchTerm);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    ensureResourceLoaded('kjv');
    ensureResourceLoaded('wcf');
  }, [ensureResourceLoaded]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedTerm(searchTerm), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchTerm]);

  useEffect(() => {
    const newResults: SearchResult[] = [];
    const term = debouncedTerm.toLowerCase().trim();
    if (!term) { setResults([]); return; }

    const kjv = bibles['kjv'];
    if (kjv) {
      for (const book of kjv.books) {
        for (const verse of book.verses) {
          if (verse.text.toLowerCase().includes(term)) {
            newResults.push({
              type: 'scripture',
              title: `${book.name} ${verse.chapter}:${verse.verse}`,
              text: verse.text.length > 150 ? verse.text.substring(0, 150) + '…' : verse.text,
              label: 'Scripture Reference',
              theme: '--accent-exe',
              bg: '--bg-exe-light',
              icon: <BookOpen size={14} />
            });
          }
        }
      }
    }

    const wcf = confessions['wcf'];
    if (wcf) {
      for (const section of wcf.sections) {
        for (const subsection of section.sections) {
          if (subsection.content.toLowerCase().includes(term)) {
            newResults.push({
              type: 'confession',
              title: `${wcf.confession.name}, ${section.title} (${subsection.number})`,
              text: subsection.content.length > 150 ? subsection.content.substring(0, 150) + '…' : subsection.content,
              label: 'Confessional Doctrine',
              theme: '--accent-theo',
              bg: '--bg-theo-light',
              icon: <Library size={14} />
            });
          }
        }
      }
    }

    setResults(newResults);
  }, [debouncedTerm, bibles, confessions]);

  const [mobileFilters, setMobileFilters] = useState(false);

  const countForFilter = (filterId: FilterId) => {
    const filter = FILTERS.find(f => f.id === filterId);
    if (!filter?.type) return results.length;
    return results.filter(r => r.type === filter.type).length;
  };

  const visibleResults = results
    .filter(r => {
      const filter = FILTERS.find(f => f.id === activeFilter);
      return !filter?.type || r.type === filter.type;
    })
    .slice(0, RESULT_LIMIT);

  return (
    <>
    <div className="mobile-overlay" style={{ opacity: mobileFilters ? 1 : 0, pointerEvents: mobileFilters ? 'auto' : 'none' }} onClick={() => setMobileFilters(false)} />

    <div className="mobile-panel-bar mobile-only">
      <button className="mobile-panel-btn" onClick={() => setMobileFilters(true)}>
        <SlidersHorizontal size={15} /> Filters
      </button>
    </div>

    <div className="workspace">
      <aside className={`left-sidebar${mobileFilters ? ' mobile-open' : ''}`} style={{ padding: 32, width: 280 }}>
        <div className="sidebar-close-row mobile-only">
          <button className="sidebar-close-btn" onClick={() => setMobileFilters(false)}><X size={16} /> Close</button>
        </div>
        <div className="sidebar-label" style={{ padding: 0, marginBottom: 20 }}>Filter by Domain</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {FILTERS.map((filter) => {
            const isActive = filter.id === activeFilter;
            const count = countForFilter(filter.id);
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter.id)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  backgroundColor: isActive ? 'var(--bg-surface)' : 'transparent',
                  boxShadow: isActive ? 'var(--shadow-card)' : 'none',
                  fontWeight: isActive ? 700 : 600,
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: 'none'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: isActive ? 'var(--text-primary)' : 'var(--border-soft)' }} />
                  {filter.label}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{count}</span>
              </button>
            );
          })}
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
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-soft)',
                fontSize: '0.95rem',
                fontFamily: 'inherit'
              }}
            />
          </div>
          <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            {visibleResults.length < results.length
              ? `Showing ${visibleResults.length} of ${results.length} results`
              : `Found ${results.length} ${results.length === 1 ? 'result' : 'results'}`}
          </div>
        </div>

        {visibleResults.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
            {visibleResults.map((card, idx) => (
              <div key={idx} className="card" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: 4, width: '100%', backgroundColor: `var(${card.theme})` }} />
                <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid var(--border-soft)', color: `var(${card.theme})`, backgroundColor: `var(${card.bg})` }}>
                  {card.icon} {card.label}
                </div>
                <div style={{ padding: 20, flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', marginBottom: 12, color: 'var(--text-primary)' }}>{card.title}</div>
                  <div style={{ fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>{card.text}</div>
                </div>
                <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-soft)', backgroundColor: 'var(--bg-subtle)', fontSize: '0.85rem', fontWeight: 700, display: 'flex', justifyContent: 'space-between', color: `var(${card.theme})` }}>
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
    </>
  );
}
