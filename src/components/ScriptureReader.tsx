import { useState, useEffect, useMemo, useCallback } from 'react';
import { BookOpen, MapPin, MessageSquare, Hash, X, List, Pencil, Bookmark } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useResources } from '../context/ResourceContext';
import type { BibleBook, BibleVerse } from '../utils/resourceLoader';
import { useWordRefs } from '../hooks/useWordRefs';
import type { WordRef } from '../hooks/useWordRefs';

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

type InsightTab = 'word' | 'commentary' | 'geo' | 'confession';

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
        const isSelected = isActiveVerse && selection?.cleanWord === cleanWord;

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

// ── Insight panel header ────────────────────────────────────────────────────

interface InsightHeaderProps {
  selection: WordSelection;
  bookName: string;
  activeRef: WordRef | null;
  canEdit: boolean;
  isEditing: boolean;
  onEditToggle: () => void;
}

function InsightHeader({ selection, bookName, activeRef, canEdit, isEditing, onEditToggle }: InsightHeaderProps) {
  const { word, verse, testament } = selection;
  const lang = testament === 'NT' ? 'Greek' : 'Hebrew';
  const isGeo = BIBLICAL_PLACES.has(selection.cleanWord);
  const hasLinks = activeRef && (activeRef.strongs || activeRef.geoEventId || activeRef.confessionRef);

  return (
    <div style={{
      padding: '14px 20px',
      borderBottom: '1px solid var(--border-soft)',
      background: 'var(--bg-subtle)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
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
                fontSize: '0.7rem', fontWeight: 700,
                backgroundColor: 'var(--bg-geo-light)', color: 'var(--accent-geo)',
                padding: '2px 8px', borderRadius: 12,
              }}>PLACE</span>
            )}
            <span style={{
              fontSize: '0.7rem', fontWeight: 700,
              backgroundColor: 'var(--bg-exe-light)', color: 'var(--accent-exe)',
              padding: '2px 8px', borderRadius: 12,
            }}>{lang}</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
            {bookName} {verse.chapter}:{verse.verse}
          </div>

          {/* Active link badges */}
          {hasLinks && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
              {activeRef!.strongs && (
                <span style={{
                  fontSize: '0.68rem', fontWeight: 700,
                  padding: '2px 7px', borderRadius: 10,
                  background: 'var(--bg-exe-light)', color: 'var(--accent-exe)',
                }}>
                  {activeRef!.strongs}
                </span>
              )}
              {activeRef!.geoEventId && (
                <span style={{
                  fontSize: '0.68rem', fontWeight: 700,
                  padding: '2px 7px', borderRadius: 10,
                  background: 'var(--bg-geo-light)', color: 'var(--accent-geo)',
                  display: 'flex', alignItems: 'center', gap: 3,
                }}>
                  <MapPin size={9} />
                  {activeRef!.geoEventId}
                </span>
              )}
              {activeRef!.confessionRef && (
                <span style={{
                  fontSize: '0.68rem', fontWeight: 700,
                  padding: '2px 7px', borderRadius: 10,
                  background: 'var(--bg-theo-light)', color: 'var(--accent-theo)',
                }}>
                  WCF {activeRef!.confessionRef}
                </span>
              )}
            </div>
          )}
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={onEditToggle}
            title={isEditing ? 'Close link editor' : 'Edit word links'}
            style={{
              padding: '6px 8px', borderRadius: 8,
              border: `1px solid ${isEditing ? 'var(--accent-exe)' : 'var(--border-soft)'}`,
              background: isEditing ? 'var(--accent-exe)' : 'var(--bg-sidebar)',
              color: isEditing ? 'white' : 'var(--text-tertiary)',
              cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
            }}
          >
            <Pencil size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Tab bar ────────────────────────────────────────────────────────────────

interface TabBarProps {
  active: InsightTab;
  onChange: (tab: InsightTab) => void;
  hasGeo: boolean;
  hasConfession: boolean;
}

function TabBar({ active, onChange, hasGeo, hasConfession }: TabBarProps) {
  const tabs: { id: InsightTab; label: string; icon: JSX.Element }[] = [
    { id: 'word',       label: 'Word',       icon: <Hash size={12} /> },
    { id: 'commentary', label: 'Notes',      icon: <MessageSquare size={12} /> },
    { id: 'geo',        label: 'Place',      icon: <MapPin size={12} /> },
    { id: 'confession', label: 'WCF',        icon: <Bookmark size={12} /> },
  ];

  return (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-surface)' }}>
      {tabs.map(tab => {
        const faded =
          (tab.id === 'geo' && !hasGeo) ||
          (tab.id === 'confession' && !hasConfession);
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              flex: 1,
              padding: '10px 2px',
              fontSize: '0.7rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              background: 'transparent',
              border: 'none',
              borderBottom: active === tab.id ? '2px solid var(--accent-exe)' : '2px solid transparent',
              color: active === tab.id ? 'var(--accent-exe)' : 'var(--text-tertiary)',
              cursor: 'pointer',
              marginBottom: -1,
              transition: 'color 0.15s',
              opacity: faded ? 0.4 : 1,
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Word ref editor panel ──────────────────────────────────────────────────

interface EditDraft {
  strongs: string;
  geoEventId: string;
  confessionRef: string;
}

interface WordRefEditorPanelProps {
  draft: EditDraft;
  setDraft: (d: EditDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  saveStatus: 'idle' | 'ok' | 'error';
  atlasEvents: Array<{ id: string; title: string; loc: string }>;
  wcfSections: Array<{ number: string; label: string }>;
}

function WordRefEditorPanel({
  draft, setDraft, onSave, onCancel, isSaving, saveStatus, atlasEvents, wcfSections,
}: WordRefEditorPanelProps) {
  const fieldLabel: React.CSSProperties = {
    fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-tertiary)',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block',
  };
  const fieldInput: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 8,
    border: '1px solid var(--border-soft)', background: 'var(--bg-surface)',
    fontSize: '0.88rem', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>
        Edit Word Links
      </div>

      <label style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={fieldLabel}>Strong's Number</span>
        <input
          type="text"
          placeholder="e.g. G2424 or H3068"
          value={draft.strongs}
          onChange={e => setDraft({ ...draft, strongs: e.target.value })}
          style={fieldInput}
        />
        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
          G prefix = Greek · H prefix = Hebrew
        </span>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={fieldLabel}>Atlas Event</span>
        <select
          value={draft.geoEventId}
          onChange={e => setDraft({ ...draft, geoEventId: e.target.value })}
          style={fieldInput}
        >
          <option value="">— none —</option>
          {atlasEvents.map(ev => (
            <option key={ev.id} value={ev.id}>{ev.title} · {ev.loc}</option>
          ))}
        </select>
        {atlasEvents.length === 0 && (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
            Start the CMS server to load atlas events.
          </span>
        )}
      </label>

      <label style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={fieldLabel}>Westminster Confession</span>
        <select
          value={draft.confessionRef}
          onChange={e => setDraft({ ...draft, confessionRef: e.target.value })}
          style={fieldInput}
        >
          <option value="">— none —</option>
          {wcfSections.map(s => (
            <option key={s.number} value={s.number}>{s.label}</option>
          ))}
        </select>
      </label>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          style={{
            flex: 1, padding: '9px 0', borderRadius: 10,
            background: 'var(--accent-exe)', color: 'white',
            border: 'none', fontWeight: 700, fontSize: '0.88rem',
            cursor: isSaving ? 'default' : 'pointer',
            opacity: isSaving ? 0.7 : 1,
          }}
        >
          {isSaving ? 'Saving…' : 'Save Links'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '9px 14px', borderRadius: 10,
            background: 'var(--bg-sidebar)', color: 'var(--text-secondary)',
            border: '1px solid var(--border-soft)', fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>

      {saveStatus === 'ok' && (
        <div style={{ color: '#4caf50', fontSize: '0.82rem', fontWeight: 600 }}>Links saved.</div>
      )}
      {saveStatus === 'error' && (
        <div style={{ color: 'var(--accent-exe)', fontSize: '0.82rem', lineHeight: 1.6 }}>
          Save failed — CMS server not reachable.<br />
          Run <code style={{ background: 'var(--bg-sidebar)', padding: '1px 5px', borderRadius: 4 }}>npm run dev:cms</code>
        </div>
      )}
    </div>
  );
}

// ── Main ScriptureReader component ────────────────────────────────────────

export default function ScriptureReader() {
  const {
    bibles, commentaries, strongsGreek, strongsHebrew, confessions,
    loadedResources, ensureResourceLoaded, content,
  } = useResources();
  const { getRef, saveRef, canEdit } = useWordRefs();
  const { book: paramBook, chapter: paramChapter } = useParams<{ book?: string; chapter?: string }>();
  const navigate = useNavigate();

  const [selectedBook, setSelectedBook] = useState(paramBook ?? 'MAT');
  const [selectedChapter, setSelectedChapter] = useState(paramChapter ? parseInt(paramChapter, 10) : 1);
  const [wordSelection, setWordSelection] = useState<WordSelection | null>(null);
  const [activeTab, setActiveTab] = useState<InsightTab>('word');
  const [mobileSidebar, setMobileSidebar] = useState<'left' | 'right' | null>(null);

  // CMS edit state
  const [isEditingLinks, setIsEditingLinks] = useState(false);
  const [editDraft, setEditDraft] = useState<EditDraft>({ strongs: '', geoEventId: '', confessionRef: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  const closeMobile = () => setMobileSidebar(null);

  // Sync URL params → state when navigating via a ReferenceCard link
  useEffect(() => {
    if (paramBook && paramBook !== selectedBook) {
      setSelectedBook(paramBook);
      setWordSelection(null);
    }
    if (paramChapter) {
      const ch = parseInt(paramChapter, 10);
      if (ch !== selectedChapter) {
        setSelectedChapter(ch);
        setWordSelection(null);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramBook, paramChapter]);

  useEffect(() => {
    ensureResourceLoaded('kjv');
    ensureResourceLoaded('matthew-gill');
  }, [ensureResourceLoaded]);

  const kjv = bibles['kjv'];
  const currentBook = kjv?.books.find(b => b.id === selectedBook);

  useEffect(() => {
    if (!currentBook) return;
    const id = currentBook.testament === 'NT' ? 'strongs-greek' : 'strongs-hebrew';
    ensureResourceLoaded(id);
  }, [currentBook, ensureResourceLoaded]);

  // Load atlas events and WCF when edit is available
  useEffect(() => {
    if (!canEdit) return;
    ensureResourceLoaded('atlas');
    ensureResourceLoaded('wcf');
  }, [canEdit, ensureResourceLoaded]);

  // Sync edit draft with active word's existing ref
  useEffect(() => {
    if (!wordSelection) {
      setEditDraft({ strongs: '', geoEventId: '', confessionRef: '' });
      setIsEditingLinks(false);
      setSaveStatus('idle');
      return;
    }
    const existing = getRef(
      wordSelection.verse.book,
      wordSelection.verse.chapter,
      wordSelection.verse.verse,
      wordSelection.cleanWord,
    );
    setEditDraft({
      strongs: existing?.strongs ?? '',
      geoEventId: existing?.geoEventId ?? '',
      confessionRef: existing?.confessionRef ?? '',
    });
    setIsEditingLinks(false);
    setSaveStatus('idle');
  }, [wordSelection, getRef]);

  const handleWordClick = useCallback((
    word: string,
    cleanWord: string,
    verse: BibleVerse,
    testament: 'OT' | 'NT',
  ) => {
    setWordSelection({ word, cleanWord, verse, testament });
    setActiveTab(BIBLICAL_PLACES.has(cleanWord) ? 'geo' : 'word');
    setMobileSidebar('right');
  }, []);

  const handleSaveLinks = useCallback(async () => {
    if (!wordSelection) return;
    setIsSaving(true);
    setSaveStatus('idle');
    const ref: WordRef = {
      book: wordSelection.verse.book,
      chapter: wordSelection.verse.chapter,
      verse: wordSelection.verse.verse,
      word: wordSelection.cleanWord,
      strongs: editDraft.strongs.trim() || null,
      geoEventId: editDraft.geoEventId || null,
      confessionRef: editDraft.confessionRef || null,
    };
    const ok = await saveRef(ref);
    setIsSaving(false);
    setSaveStatus(ok ? 'ok' : 'error');
    if (ok) setTimeout(() => { setIsEditingLinks(false); setSaveStatus('idle'); }, 900);
  }, [wordSelection, editDraft, saveRef]);

  // ── Derived data for display ──────────────────────────────────────────────

  const activeRef = useMemo(() => {
    if (!wordSelection) return null;
    return getRef(
      wordSelection.verse.book,
      wordSelection.verse.chapter,
      wordSelection.verse.verse,
      wordSelection.cleanWord,
    );
  }, [wordSelection, getRef]);

  // Atlas events flat list for the dropdown
  const atlasEventOptions = useMemo(() => {
    const atlasData = content['atlas'];
    if (!atlasData?.eraEvents) return [];
    const options: { id: string; title: string; loc: string }[] = [];
    for (const eraData of Object.values(atlasData.eraEvents as Record<string, { events?: { id: string; title: string; loc: string }[] }>)) {
      for (const ev of eraData.events ?? []) {
        options.push({ id: ev.id, title: ev.title, loc: ev.loc });
      }
    }
    return options;
  }, [content]);

  // WCF sections flat list for the dropdown
  const wcfSections = useMemo(() => {
    const wcf = confessions['wcf'];
    if (!wcf) return [];
    const sections: { number: string; label: string }[] = [];
    for (const chapter of wcf.sections) {
      for (const s of chapter.sections) {
        sections.push({ number: s.number, label: `${s.number} — ${chapter.title}` });
      }
    }
    return sections;
  }, [confessions]);

  // Pinned Strong's entry for display in WordStudyPanel
  const pinnedStrongsEntry = useMemo((): StrongsMatch | null => {
    if (!activeRef?.strongs) return null;
    const raw = activeRef.strongs.trim();
    if (raw.length < 2) return null;
    const prefix = raw[0].toUpperCase();
    const number = raw.slice(1);
    const concordance = prefix === 'G' ? strongsGreek : strongsHebrew;
    if (!concordance) return null;
    // entry.number may already include the prefix (e.g. "G1") or just the digits ("1")
    const entry = concordance.entries.find(e =>
      e.number.toUpperCase() === raw.toUpperCase() ||
      e.number.toUpperCase() === number.toUpperCase()
    );
    if (!entry) return null;
    return {
      number: entry.number,
      transliteration: entry.transliteration,
      pronunciation: entry.pronunciation,
      partOfSpeech: entry.partOfSpeech,
      definition: entry.definition,
      kjvDefinition: entry.kjvDefinition,
      usageCount: entry.usageCount,
    };
  }, [activeRef, strongsGreek, strongsHebrew]);

  // Linked atlas event for GeoPanel
  const linkedAtlasEvent = useMemo(() => {
    if (!activeRef?.geoEventId) return null;
    const atlasData = content['atlas'];
    if (!atlasData?.eraEvents) return null;
    for (const eraData of Object.values(atlasData.eraEvents as Record<string, { events?: { id: string; title: string; loc: string; date: string; desc: string; scripture: string; theme: string }[] }>)) {
      const ev = eraData.events?.find(e => e.id === activeRef.geoEventId);
      if (ev) return ev;
    }
    return null;
  }, [activeRef, content]);

  // Linked WCF section for ConfessionPanel
  const linkedWcfSection = useMemo(() => {
    if (!activeRef?.confessionRef) return null;
    const wcf = confessions['wcf'];
    if (!wcf) return null;
    for (const chapter of wcf.sections) {
      for (const s of chapter.sections) {
        if (s.number === activeRef.confessionRef) return { chapter, section: s };
      }
    }
    return null;
  }, [activeRef, confessions]);

  // Auto-matched Strong's entries (existing logic)
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
    closeMobile();
    navigate(`/reader/${id}/1`);
  };

  const isGeoWord = wordSelection ? BIBLICAL_PLACES.has(wordSelection.cleanWord) : false;
  const lang = testament === 'NT' ? 'Greek' : 'Hebrew';

  return (
    <>
      <div
        className="mobile-overlay"
        style={{ opacity: mobileSidebar ? 1 : 0, pointerEvents: mobileSidebar ? 'auto' : 'none' }}
        onClick={closeMobile}
      />

      <div className="mobile-panel-bar mobile-only">
        <button className="mobile-panel-btn" onClick={() => setMobileSidebar('left')}>
          <List size={15} /> Books
        </button>
        <button className="mobile-panel-btn" onClick={() => setMobileSidebar('right')}>
          <BookOpen size={15} /> Insights
        </button>
      </div>

      <div className="workspace">
        {/* Left sidebar: book + chapter navigation */}
        <aside className={`left-sidebar${mobileSidebar === 'left' ? ' mobile-open' : ''}`}>
          <div className="sidebar-close-row mobile-only">
            <button className="sidebar-close-btn" onClick={closeMobile}><X size={16} /> Close</button>
          </div>
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
                      navigate(`/reader/${selectedBook}/${chapter}`);
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
                    fontSize: '0.8rem', fontWeight: 700,
                    backgroundColor: 'var(--bg-geo-light)', color: 'var(--accent-geo)',
                    padding: '4px 12px', borderRadius: 16, marginRight: 8,
                  }}>
                    {kjv.version.abbreviation} — {kjv.version.name}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
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
        <aside className={`right-sidebar${mobileSidebar === 'right' ? ' mobile-open' : ''}`}>
          <div className="sidebar-close-row mobile-only">
            <button className="sidebar-close-btn" onClick={closeMobile}><X size={16} /> Close</button>
          </div>

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
                width: 56, height: 56, borderRadius: '50%',
                backgroundColor: 'var(--bg-exe-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
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
                  { icon: <Bookmark size={14} />, label: 'Confession', desc: 'Westminster Confession refs', color: 'var(--accent-theo)', bg: 'var(--bg-theo-light)' },
                ].map(item => (
                  <div key={item.label} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', background: item.bg,
                    borderRadius: 'var(--radius-md)', textAlign: 'left',
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
              <InsightHeader
                selection={wordSelection}
                bookName={currentBook?.name ?? ''}
                activeRef={activeRef}
                canEdit={canEdit}
                isEditing={isEditingLinks}
                onEditToggle={() => { setIsEditingLinks(prev => !prev); setSaveStatus('idle'); }}
              />

              {isEditingLinks ? (
                <WordRefEditorPanel
                  draft={editDraft}
                  setDraft={setEditDraft}
                  onSave={handleSaveLinks}
                  onCancel={() => { setIsEditingLinks(false); setSaveStatus('idle'); }}
                  isSaving={isSaving}
                  saveStatus={saveStatus}
                  atlasEvents={atlasEventOptions}
                  wcfSections={wcfSections}
                />
              ) : (
                <>
                  <TabBar
                    active={activeTab}
                    onChange={setActiveTab}
                    hasGeo={isGeoWord}
                    hasConfession={!!activeRef?.confessionRef}
                  />
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {activeTab === 'word' && (
                      <WordStudyPanel
                        selection={wordSelection}
                        matches={strongsMatches}
                        loading={strongsLoading}
                        lang={lang}
                        pinnedEntry={pinnedStrongsEntry}
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
                      <GeoPanel
                        selection={wordSelection}
                        bookName={currentBook?.name ?? ''}
                        linkedEvent={linkedAtlasEvent}
                      />
                    )}
                    {activeTab === 'confession' && (
                      <ConfessionPanel
                        confessionRef={activeRef?.confessionRef ?? null}
                        wcfSection={linkedWcfSection}
                        canEdit={canEdit}
                        onEditLinks={() => setIsEditingLinks(true)}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

// ── Sub-panels ────────────────────────────────────────────────────────────

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
  pinnedEntry: StrongsMatch | null;
}

function WordStudyPanel({ selection, matches, loading, lang, pinnedEntry }: WordStudyPanelProps) {
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

  const pinnedPrefix = pinnedEntry
    ? (selection.testament === 'NT' ? 'G' : 'H')
    : null;

  return (
    <div style={{ padding: 20 }}>
      <div style={{
        fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
        color: 'var(--accent-exe)', letterSpacing: '0.08em', marginBottom: 14,
      }}>
        Strong's {lang} — "{selection.word}"
      </div>

      {/* Pinned entry */}
      {pinnedEntry && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{
              fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase',
              background: 'var(--accent-exe)', color: 'white',
              padding: '2px 7px', borderRadius: 8, letterSpacing: '0.06em',
            }}>Pinned</span>
          </div>
          <div style={{
            borderLeft: '3px solid var(--accent-exe)',
            paddingLeft: 14,
            background: 'var(--bg-exe-light)',
            borderRadius: '0 var(--radius-md) var(--radius-md) 0',
            padding: '10px 10px 10px 14px',
          }}>
            <StrongsEntryDisplay entry={pinnedEntry} prefix={pinnedPrefix ?? prefix} />
          </div>
        </div>
      )}

      {matches.length === 0 ? (
        <div style={{
          padding: '20px 16px', background: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-md)', fontSize: '0.85rem',
          color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.6,
        }}>
          No {lang} lexicon entries found for this verse. Strong's data is currently limited to a small sample set.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {matches.map(entry => (
            <div key={entry.number} style={{ borderLeft: '3px solid var(--accent-exe)', paddingLeft: 14 }}>
              <StrongsEntryDisplay entry={entry} prefix={prefix} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StrongsEntryDisplay({ entry, prefix }: { entry: StrongsMatch; prefix: string }) {
  // entry.number may already include the prefix (e.g. "G1"); avoid doubling it
  const displayNum = /^[GH]/i.test(entry.number) ? entry.number : `${prefix}${entry.number}`;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <span style={{ fontWeight: 800, color: 'var(--accent-exe)', fontSize: '0.8rem', fontFamily: 'var(--font-sans)' }}>
          {displayNum}
        </span>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {entry.transliteration}
        </span>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
          {entry.pronunciation}
        </span>
      </div>
      <div style={{
        display: 'inline-block', fontSize: '0.7rem', fontWeight: 700,
        color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-sidebar)',
        padding: '1px 7px', borderRadius: 10, marginBottom: 6,
      }}>
        {entry.partOfSpeech}
      </div>
      <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.5 }}>
        {entry.definition}
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
        KJV renders as: <em style={{ color: 'var(--text-secondary)' }}>{entry.kjvDefinition}</em>
      </div>
    </>
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
          padding: '20px 16px', background: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-md)', fontSize: '0.85rem',
          color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.6,
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
        fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
        color: 'var(--accent-theo)', letterSpacing: '0.08em', marginBottom: 12,
      }}>
        John Gill — {bookName} {verse.chapter}:{verse.verse}
      </div>

      <div style={{
        padding: '12px 16px', background: 'var(--bg-exe-light)',
        borderLeft: '3px solid var(--accent-exe)',
        borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
        marginBottom: 16, fontFamily: 'var(--font-serif)',
        fontSize: '0.95rem', fontStyle: 'italic',
        color: 'var(--text-secondary)', lineHeight: 1.6,
      }}>
        "{entry.text}"
      </div>

      <div style={{ fontSize: '0.9rem', lineHeight: 1.75, color: 'var(--text-primary)' }}>
        {entry.commentary}
      </div>

      <div style={{ marginTop: 16, fontSize: '0.75rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
        — John Gill, Exposition of the Entire Bible (1746)
      </div>
    </div>
  );
}

interface LinkedAtlasEvent {
  id: string;
  title: string;
  loc: string;
  date: string;
  desc: string;
  scripture: string;
  theme: string;
}

interface GeoPanelProps {
  selection: WordSelection;
  bookName: string;
  linkedEvent: LinkedAtlasEvent | null;
}

function GeoPanel({ selection, bookName, linkedEvent }: GeoPanelProps) {
  const { word, cleanWord, verse } = selection;
  const isPlace = BIBLICAL_PLACES.has(cleanWord);

  if (!isPlace) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{
          padding: '20px 16px', background: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-md)', fontSize: '0.85rem',
          color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.6,
        }}>
          "{word}" is not a recognized biblical place name. Geographic insights appear for place names highlighted in green.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{
        fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
        color: 'var(--accent-geo)', letterSpacing: '0.08em', marginBottom: 12,
      }}>
        Geographic Reference
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px', background: 'var(--bg-geo-light)',
        borderRadius: 'var(--radius-md)', marginBottom: 16,
      }}>
        <MapPin size={20} style={{ color: 'var(--accent-geo)', flexShrink: 0 }} />
        <div>
          <div style={{
            fontFamily: 'var(--font-serif)', fontSize: '1.1rem',
            fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize',
          }}>
            {word}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
            Mentioned in {bookName} {verse.chapter}:{verse.verse}
          </div>
        </div>
      </div>

      {linkedEvent ? (
        /* Linked atlas event details */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{
            padding: '14px 16px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-soft)', background: 'white',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                {linkedEvent.title}
              </div>
              <span style={{
                fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                background: 'var(--bg-geo-light)', color: 'var(--accent-geo)',
                padding: '2px 7px', borderRadius: 8, flexShrink: 0,
              }}>Atlas</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 6 }}>
              {linkedEvent.date} · {linkedEvent.loc}
            </div>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {linkedEvent.desc}
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '0.72rem', fontWeight: 700,
                background: 'var(--bg-exe-light)', color: 'var(--accent-exe)',
                padding: '2px 8px', borderRadius: 10,
              }}>
                {linkedEvent.scripture}
              </span>
              <span style={{
                fontSize: '0.72rem', fontWeight: 600,
                background: 'var(--bg-sidebar)', color: 'var(--text-tertiary)',
                padding: '2px 8px', borderRadius: 10,
              }}>
                {linkedEvent.theme}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            fontSize: '0.85rem', color: 'var(--text-secondary)',
            lineHeight: 1.7, marginBottom: 4,
          }}>
            This is a recognized biblical place name. Detailed geographic data — including coordinates, historical context, and related passages — will be available as the atlas database grows.
          </div>

          <div style={{
            padding: '12px 16px', background: 'var(--bg-subtle)',
            borderRadius: 'var(--radius-md)', border: '1px solid var(--border-soft)',
            fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6,
          }}>
            <strong style={{ color: 'var(--accent-geo)' }}>Tip:</strong> Open the <strong>Atlas &amp; Timeline</strong> module from the top navigation to explore biblical geography on the interactive map.
          </div>
        </div>
      )}
    </div>
  );
}

interface ConfessionPanelProps {
  confessionRef: string | null;
  wcfSection: {
    chapter: { chapter: number; title: string };
    section: { number: string; content: string };
  } | null;
  canEdit: boolean;
  onEditLinks: () => void;
}

function ConfessionPanel({ confessionRef, wcfSection, canEdit, onEditLinks }: ConfessionPanelProps) {
  if (!confessionRef || !wcfSection) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{
          padding: '20px 16px', background: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-md)', fontSize: '0.85rem',
          color: 'var(--text-secondary)', lineHeight: 1.6,
        }}>
          {canEdit ? (
            <>
              No confession reference linked.{' '}
              <button
                type="button"
                onClick={onEditLinks}
                style={{ background: 'none', border: 'none', color: 'var(--accent-exe)', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: '0.85rem' }}
              >
                Click here to add a WCF cross-reference.
              </button>
            </>
          ) : (
            <span style={{ fontStyle: 'italic' }}>No Westminster Confession reference has been linked for this word.</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{
        fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
        color: 'var(--accent-theo)', letterSpacing: '0.08em', marginBottom: 12,
      }}>
        Westminster Confession of Faith
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
          WCF {wcfSection.section.number}
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 3 }}>
          Chapter {wcfSection.chapter.chapter}: {wcfSection.chapter.title}
        </div>
      </div>

      <div style={{
        padding: '14px 16px',
        background: 'var(--bg-theo-light)',
        borderLeft: '3px solid var(--accent-theo)',
        borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
        fontSize: '0.9rem',
        lineHeight: 1.8,
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-serif)',
      }}>
        {wcfSection.section.content}
      </div>

      <div style={{ marginTop: 14, fontSize: '0.75rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
        — Westminster Confession of Faith, 1647
      </div>
    </div>
  );
}
