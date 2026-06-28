import { useState, useEffect, useMemo, useCallback } from 'react';
import { BookOpen, MapPin, MessageSquare, Hash } from 'lucide-react';
import { useResources } from '../context/ResourceContext';
import type { BibleBook, BibleVerse } from '../utils/resourceLoader';

const BIBLICAL_PLACES = new Set([
  'jerusalem', 'israel', 'egypt', 'babylon', 'rome', 'bethlehem', 'nazareth',
  'galilee', 'judea', 'samaria', 'jordan', 'sinai', 'canaan', 'assyria',
  'persia', 'greece', 'corinth', 'ephesus', 'antioch', 'damascus', 'jericho',
  'capernaum', 'bethany', 'calvary', 'gethsemane', 'eden', 'goshen',
  'zion', 'hebron', 'moab', 'edom', 'nineveh', 'tyre', 'sidon',
  'philippi', 'thessalonica', 'berea', 'athens', 'cyprus', 'crete', 'patmos',
  'decapolis', 'caesarea', 'emmaus', 'bethsaida', 'chorazin', 'magdala',
  'kidron', 'tabor', 'hermon', 'lebanon', 'carmel', 'joppa', 'lydda',
  'mizpah', 'shiloh', 'bethel', 'gilgal', 'beersheba', 'mamre', 'peniel',
  'ramah', 'gibeah', 'gezer', 'megiddo', 'jezreel', 'shechem', 'dothan',
  'midian', 'ur', 'haran', 'gennesaret', 'tiberias', 'arnon', 'jabbok'
]);

type InsightTab = 'word' | 'commentary' | 'geo';

interface WordSelection {
  word: string;
  cleanWord: string;
  verse: BibleVerse;
  testament: 'OT' | 'NT';
}

interface BookListProps {
  books: BibleBook[];
  selectedBook: string;
  onSelect: (id: string) => void;
}

function BookList({ books, selectedBook, onSelect }: BookListProps) {
  return (
    <>
      {books.map((book) => (
        <button
          key={book.id}
          type="button"
          onClick={() => onSelect(book.id)}
          style={{
            padding: '10px 17px',
            fontWeight: 600,
            color: selectedBook === book.id ? 'var(--accent-geo)' : 'var(--text-secondary)',
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
            textAlign: 'left',
            borderLeft: selectedBook === book.id ? '3px solid var(--accent-geo)' : '3px solid transparent',
            width: '100%'
          }}
        >
          {book.name}
        </button>
      ))}
    </>
  );
}

interface VerseRowProps {
  verse: BibleVerse;
  testament: 'OT' | 'NT';
  selection: WordSelection | null;
  onWordClick: (word: string, cleanWord: string, verse: BibleVerse, testament: 'OT' | 'NT') => void;
}

function VerseRow({ verse, testament, selection, onWordClick }: VerseRowProps) {
  const tokens = useMemo(() => {
    return verse.text.match(/[\w']+|[^\w'\s]+|\s+/g) ?? [verse.text];
  }, [verse.text]);

  const isActiveVerse =
    selection?.verse.book === verse.book &&
    selection?.verse.chapter === verse.chapter &&
    selection?.verse.verse === verse.verse;

  return (
    <div className={`verse${isActiveVerse ? ' active-context' : ''}`}>
      <span className="v-num">{verse.verse}</span>
      {tokens.map((token, i) => {
        const isWord = /^[\w']+$/.test(token);
        if (!isWord) return <span key={i}>{token}</span>;

        const cleanWord = token.toLowerCase().replace(/[^a-z]/g, '');
        const isGeo = BIBLICAL_PLACES.has(cleanWord);
        const isSelected =
          isActiveVerse && selection?.cleanWord === cleanWord;

        return (
          <span
            key={i}
            className={`token ${isGeo ? 'geo' : 'exe'}`}
            style={isSelected ? {
              fontWeight: 700,
              borderBottomStyle: 'solid' as const,
              backgroundColor: isGeo
                ? 'rgba(74, 105, 96, 0.15)'
                : 'rgba(212, 163, 115, 0.2)',
            } : undefined}
            onClick={() => onWordClick(token, cleanWord, verse, testament)}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onWordClick(token, cleanWord, verse, testament);
              }
            }}
          >
            {token}
          </span>
        );
      })}
    </div>
  );
}

interface InsightHeaderProps {
  selection: WordSelection;
  bookName: string;
}

function InsightHeader({ selection, bookName }: InsightHeaderProps) {
  const { word, verse, testament } = selection;
  const lang = testament === 'NT' ? 'Greek' : 'Hebrew';
  const isGeo = BIBLICAL_PLACES.has(selection.cleanWord);

  return (
    <div style={{
      padding: '16px 20px',
      borderBottom: '1px solid var(--border-soft)',
      background: 'var(--bg-subtle)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '1.4rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
        }}>
          {word}
        </span>
        {isGeo && (
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            backgroundColor: 'var(--bg-geo-light)',
            color: 'var(--accent-geo)',
            padding: '2px 8px',
            borderRadius: 12,
          }}>
            PLACE
          </span>
        )}
        <span style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          backgroundColor: 'var(--bg-exe-light)',
          color: 'var(--accent-exe)',
          padding: '2px 8px',
          borderRadius: 12,
        }}>
          {lang}
        </span>
      </div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
        {bookName} {verse.chapter}:{verse.verse}
      </div>
    </div>
  );
}

interface TabBarProps {
  active: InsightTab;
  onChange: (tab: InsightTab) => void;
  hasGeo: boolean;
}

function TabBar({ active, onChange, hasGeo }: TabBarProps) {
  const tabs: { id: InsightTab; label: string; icon: JSX.Element }[] = [
    { id: 'word', label: 'Word Study', icon: <Hash size={13} /> },
    { id: 'commentary', label: 'Commentary', icon: <MessageSquare size={13} /> },
    { id: 'geo', label: 'Geography', icon: <MapPin size={13} /> },
  ];

  return (
    <div style={{
      display: 'flex',
      borderBottom: '1px solid var(--border-soft)',
      background: 'var(--bg-surface)',
    }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          style={{
            flex: 1,
            padding: '10px 4px',
            fontSize: '0.75rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            background: 'transparent',
            border: 'none',
            borderBottom: active === tab.id ? '2px solid var(--accent-exe)' : '2px solid transparent',
            color: active === tab.id ? 'var(--accent-exe)' : 'var(--text-tertiary)',
            cursor: 'pointer',
            marginBottom: -1,
            transition: 'color 0.15s',
            opacity: tab.id === 'geo' && !hasGeo ? 0.5 : 1,
          }}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default function ScriptureReader() {
  const { bibles, commentaries, strongsGreek, strongsHebrew, loadedResources, ensureResourceLoaded } = useResources();
  const [selectedBook, setSelectedBook] = useState('MAT');
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [wordSelection, setWordSelection] = useState<WordSelection | null>(null);
  const [activeTab, setActiveTab] = useState<InsightTab>('word');

  useEffect(() => {
    ensureResourceLoaded('kjv');
    ensureResourceLoaded('matthew-gill');
  }, [ensureResourceLoaded]);

  const kjv = bibles['kjv'];
  const currentBook = kjv?.books.find(b => b.id === selectedBook);

  // Preload the appropriate Strong's when the user changes books
  useEffect(() => {
    if (!currentBook) return;
    const id = currentBook.testament === 'NT' ? 'strongs-greek' : 'strongs-hebrew';
    ensureResourceLoaded(id);
  }, [currentBook, ensureResourceLoaded]);

  const handleWordClick = useCallback((
    word: string,
    cleanWord: string,
    verse: BibleVerse,
    testament: 'OT' | 'NT',
  ) => {
    setWordSelection({ word, cleanWord, verse, testament });
    setActiveTab(BIBLICAL_PLACES.has(cleanWord) ? 'geo' : 'word');
  }, []);

  const strongsLoading =
    wordSelection?.testament === 'NT'
      ? !loadedResources.has('strongs-greek')
      : !loadedResources.has('strongs-hebrew');

  const strongsMatches = useMemo(() => {
    if (!wordSelection) return [];
    const concordance = wordSelection.testament === 'NT' ? strongsGreek : strongsHebrew;
    if (!concordance) return [];

    const { verse, cleanWord } = wordSelection;
    const verseEntries = concordance.entries.filter(e =>
      e.references.some(r =>
        r.book === verse.book && r.chapter === verse.chapter && r.verse === verse.verse
      )
    );

    const wordMatches = verseEntries.filter(e =>
      e.kjvDefinition.toLowerCase().split(/[\s,;:()\-]+/).includes(cleanWord)
    );

    return (wordMatches.length > 0 ? wordMatches : verseEntries).slice(0, 5);
  }, [wordSelection, strongsGreek, strongsHebrew]);

  const commentaryEntry = useMemo(() => {
    if (!wordSelection) return null;
    const gill = commentaries['matthew-gill'];
    if (!gill) return null;
    const { verse } = wordSelection;
    return gill.entries.find(e =>
      e.book === verse.book && e.chapter === verse.chapter && e.verse === verse.verse
    ) ?? null;
  }, [wordSelection, commentaries]);

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

  const currentVerses = currentBook
    ? currentBook.verses.filter(v => v.chapter === selectedChapter)
    : [];
  const otBooks = kjv.books.filter(b => b.testament === 'OT');
  const ntBooks = kjv.books.filter(b => b.testament === 'NT');
  const testament = currentBook?.testament ?? 'NT';

  const handleBookSelect = (id: string) => {
    setSelectedBook(id);
    setSelectedChapter(1);
    setWordSelection(null);
  };

  const isGeoWord = wordSelection ? BIBLICAL_PLACES.has(wordSelection.cleanWord) : false;
  const lang = testament === 'NT' ? 'Greek' : 'Hebrew';

  return (
    <div className="workspace">
      {/* Left sidebar: book + chapter navigation */}
      <aside className="left-sidebar">
        <div className="sidebar-label">Old Testament</div>
        <BookList books={otBooks} selectedBook={selectedBook} onSelect={handleBookSelect} />

        <div className="sidebar-label" style={{ marginTop: 20 }}>New Testament</div>
        <BookList books={ntBooks} selectedBook={selectedBook} onSelect={handleBookSelect} />

        {currentBook && (
          <div style={{
            padding: '12px 20px 20px',
            backgroundColor: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-soft)',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
              {Array.from({ length: currentBook.chapters }, (_, i) => i + 1).map((chapter) => (
                <button
                  key={chapter}
                  type="button"
                  onClick={() => {
                    setSelectedChapter(chapter);
                    setWordSelection(null);
                  }}
                  style={{
                    aspectRatio: '1',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: chapter === selectedChapter ? 'var(--accent-geo)' : 'transparent',
                    color: chapter === selectedChapter ? 'var(--bg-surface)' : 'var(--text-secondary)',
                    border: 'none',
                  }}
                >
                  {chapter}
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* Center: scripture text with clickable words */}
      <div className="center-content">
        <div style={{ maxWidth: 680, width: '100%', paddingBottom: 80 }}>
          {currentBook && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 40 }}>
                <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', marginBottom: 8 }}>
                  {currentBook.name} {selectedChapter}
                </h1>
                <span style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  backgroundColor: 'var(--bg-geo-light)',
                  color: 'var(--accent-geo)',
                  padding: '4px 12px',
                  borderRadius: 16,
                  marginRight: 8,
                }}>
                  {kjv.version.abbreviation} — {kjv.version.name}
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-tertiary)',
                  fontStyle: 'italic',
                }}>
                  Click any word for insights
                </span>
              </div>

              <div style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.2rem',
                lineHeight: 2,
                color: 'var(--text-primary)',
              }}>
                {currentVerses.length > 0 ? (
                  currentVerses.map((verse) => (
                    <VerseRow
                      key={`${verse.book}-${verse.chapter}-${verse.verse}`}
                      verse={verse}
                      testament={testament}
                      selection={wordSelection}
                      onWordClick={handleWordClick}
                    />
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

      {/* Right sidebar: word insights */}
      <aside className="right-sidebar">
        {/* Static header */}
        <div style={{
          padding: '20px 24px 16px',
          backgroundColor: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-soft)',
          flexShrink: 0,
        }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <BookOpen size={16} style={{ color: 'var(--accent-exe)' }} />
            Passage Insights
          </h2>
        </div>

        {!wordSelection ? (
          /* Empty state */
          <div style={{ padding: '48px 24px', textAlign: 'center', flex: 1 }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              backgroundColor: 'var(--bg-exe-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <Hash size={24} style={{ color: 'var(--accent-exe)' }} />
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Select a Word
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
              Click any word in the scripture to explore word studies, commentary, and geographic context.
            </div>
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: <Hash size={14} />, label: 'Word Study', desc: `${lang} lexicon & Strong's`, color: 'var(--accent-exe)', bg: 'var(--bg-exe-light)' },
                { icon: <MessageSquare size={14} />, label: 'Commentary', desc: "John Gill's exposition", color: 'var(--accent-theo)', bg: 'var(--bg-theo-light)' },
                { icon: <MapPin size={14} />, label: 'Geography', desc: 'Place names & atlas links', color: 'var(--accent-geo)', bg: 'var(--bg-geo-light)' },
              ].map(item => (
                <div key={item.label} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  background: item.bg,
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'left',
                }}>
                  <span style={{ color: item.color }}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: item.color }}>{item.label}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Active insight panel */
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <InsightHeader selection={wordSelection} bookName={currentBook?.name ?? ''} />
            <TabBar active={activeTab} onChange={setActiveTab} hasGeo={isGeoWord} />

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {activeTab === 'word' && (
                <WordStudyPanel
                  selection={wordSelection}
                  matches={strongsMatches}
                  loading={strongsLoading}
                  lang={lang}
                />
              )}
              {activeTab === 'commentary' && (
                <CommentaryPanel
                  selection={wordSelection}
                  entry={commentaryEntry}
                  bookName={currentBook?.name ?? ''}
                />
              )}
              {activeTab === 'geo' && (
                <GeoPanel selection={wordSelection} bookName={currentBook?.name ?? ''} />
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

// ---- Sub-panels ----

interface StrongsMatch {
  number: string;
  transliteration: string;
  pronunciation: string;
  partOfSpeech: string;
  definition: string;
  kjvDefinition: string;
  usageCount: number;
}

interface WordStudyPanelProps {
  selection: WordSelection;
  matches: StrongsMatch[];
  loading: boolean;
  lang: string;
}

function WordStudyPanel({ selection, matches, loading, lang }: WordStudyPanelProps) {
  const prefix = lang === 'Greek' ? 'G' : 'H';

  if (loading) {
    return (
      <div style={{ padding: '32px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
          Loading {lang} lexicon…
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{
        fontSize: '0.7rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        color: 'var(--accent-exe)',
        letterSpacing: '0.08em',
        marginBottom: 14,
      }}>
        Strong's {lang} — "{selection.word}"
      </div>

      {matches.length === 0 ? (
        <div style={{
          padding: '20px 16px',
          background: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
          fontStyle: 'italic',
          lineHeight: 1.6,
        }}>
          No {lang} lexicon entries found for this verse. Strong's data is currently limited to a small sample set.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {matches.map(entry => (
            <div key={entry.number} style={{
              borderLeft: '3px solid var(--accent-exe)',
              paddingLeft: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                <span style={{
                  fontWeight: 800,
                  color: 'var(--accent-exe)',
                  fontSize: '0.8rem',
                  fontFamily: 'var(--font-sans)',
                }}>
                  {prefix}{entry.number}
                </span>
                <span style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}>
                  {entry.transliteration}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                  {entry.pronunciation}
                </span>
              </div>
              <div style={{
                display: 'inline-block',
                fontSize: '0.7rem',
                fontWeight: 700,
                color: 'var(--text-tertiary)',
                backgroundColor: 'var(--bg-sidebar)',
                padding: '1px 7px',
                borderRadius: 10,
                marginBottom: 6,
              }}>
                {entry.partOfSpeech}
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.5 }}>
                {entry.definition}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                KJV renders as: <em style={{ color: 'var(--text-secondary)' }}>{entry.kjvDefinition}</em>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
                Used {entry.usageCount}× in the NT
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface CommentaryEntry {
  book: string;
  chapter: number;
  verse: number;
  text: string;
  commentary: string;
}

interface CommentaryPanelProps {
  selection: WordSelection;
  entry: CommentaryEntry | null;
  bookName: string;
}

function CommentaryPanel({ selection, entry, bookName }: CommentaryPanelProps) {
  const { verse } = selection;

  if (!entry) {
    const isMatthew = verse.book === 'MAT';
    return (
      <div style={{ padding: 20 }}>
        <div style={{
          padding: '20px 16px',
          background: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
          fontStyle: 'italic',
          lineHeight: 1.6,
        }}>
          {isMatthew
            ? `No commentary entry available for ${bookName} ${verse.chapter}:${verse.verse}.`
            : `John Gill's commentary is currently available for the Gospel of Matthew only. Navigate to Matthew to see verse-by-verse exposition.`}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{
        fontSize: '0.7rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        color: 'var(--accent-theo)',
        letterSpacing: '0.08em',
        marginBottom: 12,
      }}>
        John Gill — {bookName} {verse.chapter}:{verse.verse}
      </div>

      <div style={{
        padding: '12px 16px',
        background: 'var(--bg-exe-light)',
        borderLeft: '3px solid var(--accent-exe)',
        borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
        marginBottom: 16,
        fontFamily: 'var(--font-serif)',
        fontSize: '0.95rem',
        fontStyle: 'italic',
        color: 'var(--text-secondary)',
        lineHeight: 1.6,
      }}>
        "{entry.text}"
      </div>

      <div style={{
        fontSize: '0.9rem',
        lineHeight: 1.75,
        color: 'var(--text-primary)',
      }}>
        {entry.commentary}
      </div>

      <div style={{
        marginTop: 16,
        fontSize: '0.75rem',
        color: 'var(--text-tertiary)',
        fontStyle: 'italic',
      }}>
        — John Gill, Exposition of the Entire Bible (1746)
      </div>
    </div>
  );
}

interface GeoPanelProps {
  selection: WordSelection;
  bookName: string;
}

function GeoPanel({ selection, bookName }: GeoPanelProps) {
  const { word, cleanWord, verse } = selection;
  const isPlace = BIBLICAL_PLACES.has(cleanWord);

  if (!isPlace) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{
          padding: '20px 16px',
          background: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
          fontStyle: 'italic',
          lineHeight: 1.6,
        }}>
          "{word}" is not a recognized biblical place name. Geographic insights appear for place names highlighted in green.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{
        fontSize: '0.7rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        color: 'var(--accent-geo)',
        letterSpacing: '0.08em',
        marginBottom: 12,
      }}>
        Geographic Reference
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        background: 'var(--bg-geo-light)',
        borderRadius: 'var(--radius-md)',
        marginBottom: 16,
      }}>
        <MapPin size={20} style={{ color: 'var(--accent-geo)', flexShrink: 0 }} />
        <div>
          <div style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1.1rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            textTransform: 'capitalize',
          }}>
            {word}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
            Mentioned in {bookName} {verse.chapter}:{verse.verse}
          </div>
        </div>
      </div>

      <div style={{
        fontSize: '0.85rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.7,
        marginBottom: 16,
      }}>
        This is a recognized biblical place name. Detailed geographic data — including coordinates, historical context, and related passages — will be available as the atlas database grows.
      </div>

      <div style={{
        padding: '12px 16px',
        background: 'var(--bg-subtle)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-soft)',
        fontSize: '0.82rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.6,
      }}>
        <strong style={{ color: 'var(--accent-geo)' }}>Tip:</strong> Open the <strong>Atlas &amp; Timeline</strong> module from the top navigation to explore biblical geography on the interactive map.
      </div>
    </div>
  );
}
