import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { BookOpen, MapPin, MessageSquare, Hash, X, List, Pencil, Bookmark, ChevronLeft, ChevronRight, ScrollText } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useResources } from '../context/ResourceContext';
import type { BibleVerse, StrongsEntry } from '../utils/resourceLoader';
import { useWordRefs } from '../hooks/useWordRefs';
import type { WordRef } from '../hooks/useWordRefs';
import { citationIndex, citationsOf } from '../utils/confessionCitations';
import { WordStudyPanel, TaggedWord } from './reader/WordStudyPanel';
import { HenryPanel } from './reader/HenryPanel';
import { CitationsPanel } from './reader/CitationsPanel';

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

/** The commentary and confession the reader links to. */
const COMMENTARY_ID = 'henry';
const CONFESSION_ID = 'wcf';
/** The translation whose words carry Strong's numbers. */
const TAGGED_BIBLE_ID = 'kjv';

type InsightTab = 'word' | 'commentary' | 'geo' | 'confession';

interface WordSelection {
  word: string;
  cleanWord: string;
  verse: BibleVerse;
  testament: 'OT' | 'NT';
}

/** What the reader has selected: a verse, and perhaps one word of it. */
interface Selection {
  chapter: number;
  verse: number;
  /** The word's position among the verse's words, its text, and (KJV) its tag's index. */
  word: { index: number; text: string; tag: number | null } | null;
}

const cleanOf = (word: string) => word.toLowerCase().replace(/[^a-z]/g, '');

/** A verse cut into words and the text between them; KJV words keep their tag's index. */
interface Token { text: string; word: boolean; tag: number | null }

function verseTokens(verse: BibleVerse): Token[] {
  const tokens: Token[] = [];
  const plain = (text: string) => {
    for (const t of text.match(/[\w'’]+|[^\w'’\s]+|\s+/g) ?? []) {
      tokens.push({ text: t, word: /^[\w'’]+$/.test(t), tag: null });
    }
  };
  let cursor = 0;
  (verse.strongs ?? []).forEach(([start, end], i) => {
    plain(verse.text.slice(cursor, start));
    tokens.push({ text: verse.text.slice(start, end), word: true, tag: i });
    cursor = end;
  });
  plain(verse.text.slice(cursor));
  return tokens;
}

/** The verse's tagged words, from a KJV verse. */
function taggedWords(verse: BibleVerse | undefined): TaggedWord[] {
  return (verse?.strongs ?? []).map(([start, end, number]) => ({ word: verse!.text.slice(start, end), number }));
}

interface BookListProps {
  books: { id: string; name: string }[];
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
  selection: Selection | null;
  isTarget: boolean;
  citedCount: number;
  onWordClick: (verse: BibleVerse, token: Token, index: number) => void;
  onVerseClick: (verse: BibleVerse, tab: InsightTab) => void;
}

function VerseRow({ verse, selection, isTarget, citedCount, onWordClick, onVerseClick }: VerseRowProps) {
  const tokens = useMemo(() => verseTokens(verse), [verse]);
  const isActive = selection?.chapter === verse.chapter && selection?.verse === verse.verse;
  let wordIndex = -1;

  return (
    <div
      id={`v${verse.chapter}-${verse.verse}`}
      className={`verse${isActive ? ' active-context' : ''}${isTarget ? ' target' : ''}`}
    >
      <button
        type="button"
        className="v-num"
        onClick={() => onVerseClick(verse, 'commentary')}
        title={`Commentary on verse ${verse.verse}`}
        aria-label={`Verse ${verse.verse}: show commentary`}
      >
        {verse.verse}
      </button>
      {tokens.map((token, i) => {
        if (!token.word) return <span key={i}>{token.text}</span>;
        const index = ++wordIndex;
        const isGeo = BIBLICAL_PLACES.has(cleanOf(token.text));
        const isSelected = isActive && selection?.word?.index === index;
        const kind = isGeo ? 'geo' : token.tag !== null ? 'exe' : 'plain';
        return (
          <span
            key={i}
            className={`token ${kind}${isSelected ? ' selected' : ''}`}
            onClick={() => onWordClick(verse, token, index)}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onWordClick(verse, token, index);
              }
            }}
          >
            {token.text}
          </span>
        );
      })}
      {citedCount > 0 && (
        <button
          type="button"
          className="v-cite"
          onClick={() => onVerseClick(verse, 'confession')}
          title={`Cited ${citedCount === 1 ? 'once' : `${citedCount} times`} in the Westminster Confession`}
          aria-label={`Verse ${verse.verse} is cited in the Westminster Confession`}
        >
          <ScrollText size={11} />
        </button>
      )}
    </div>
  );
}

// ── Insight panel header ────────────────────────────────────────────────────

interface InsightHeaderProps {
  title: string;
  reference: string;
  language: 'Greek' | 'Hebrew';
  isPlace: boolean;
  strongs: string | null;
  activeRef: WordRef | null;
  canEdit: boolean;
  isEditing: boolean;
  onEditToggle: () => void;
}

function InsightHeader({ title, reference, language, isPlace, strongs, activeRef, canEdit, isEditing, onEditToggle }: InsightHeaderProps) {
  const pill = (bg: string, color: string): React.CSSProperties => ({
    fontSize: '0.7rem', fontWeight: 700, backgroundColor: bg, color, padding: '2px 8px', borderRadius: 12,
    display: 'inline-flex', alignItems: 'center', gap: 3,
  });

  return (
    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {title}
            </span>
            {isPlace && <span style={pill('var(--bg-geo-light)', 'var(--accent-geo)')}>PLACE</span>}
            {strongs && <span style={pill('var(--bg-exe-light)', 'var(--accent-exe)')}>{strongs}</span>}
            <span style={pill('var(--bg-sidebar)', 'var(--text-tertiary)')}>{language}</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{reference}</div>

          {activeRef && (activeRef.geoEventId || activeRef.confessionRef) && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
              {activeRef.geoEventId && (
                <span style={pill('var(--bg-geo-light)', 'var(--accent-geo)')}><MapPin size={9} />{activeRef.geoEventId}</span>
              )}
              {activeRef.confessionRef && (
                <span style={pill('var(--bg-theo-light)', 'var(--accent-theo)')}>WCF {activeRef.confessionRef}</span>
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
  citations: number;
}

function TabBar({ active, onChange, hasGeo, citations }: TabBarProps) {
  const tabs: { id: InsightTab; label: string; icon: JSX.Element; faded?: boolean }[] = [
    { id: 'word',       label: "Strong's",   icon: <Hash size={12} /> },
    { id: 'commentary', label: 'Henry',      icon: <MessageSquare size={12} /> },
    { id: 'geo',        label: 'Place',      icon: <MapPin size={12} />, faded: !hasGeo },
    { id: 'confession', label: citations ? `WCF (${citations})` : 'WCF', icon: <Bookmark size={12} />, faded: !citations },
  ];

  return (
    <div role="tablist" style={{ display: 'flex', borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-surface)' }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
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
            opacity: tab.faded ? 0.45 : 1,
          }}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ── Main ScriptureReader component ────────────────────────────────────────

export default function ScriptureReader() {
  const {
    manifest, strongsGreek, strongsHebrew, confessions,
    loadedResources, ensureResourceLoaded, content,
    bibleIndexes, bibleBooks, bibleId, setBibleId, ensureBibleIndex, ensureBibleBook,
    commentaryChapters, commentaryIntroductions, ensureCommentaryChapter, ensureCommentaryIntroduction,
  } = useResources();
  const { getRef, saveRef, canEdit } = useWordRefs();
  const { book: paramBook, chapter: paramChapter, verse: paramVerse } = useParams<{ book?: string; chapter?: string; verse?: string }>();
  const navigate = useNavigate();

  const [selectedBook, setSelectedBook] = useState(paramBook ?? 'MAT');
  const [selectedChapter, setSelectedChapter] = useState(paramChapter ? parseInt(paramChapter, 10) : 1);
  const targetVerse = paramVerse ? parseInt(paramVerse, 10) : null;
  const [selection, setSelection] = useState<Selection | null>(null);
  const [focusOverride, setFocusOverride] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<InsightTab>('word');
  const [mobileSidebar, setMobileSidebar] = useState<'left' | 'right' | null>(null);

  // CMS edit state
  const [isEditingLinks, setIsEditingLinks] = useState(false);
  const [editDraft, setEditDraft] = useState<EditDraft>({ strongs: '', geoEventId: '', confessionRef: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  const closeMobile = () => setMobileSidebar(null);

  // Sync URL params → state (links from Henry, the Confession and search land here)
  useEffect(() => {
    if (paramBook && paramBook !== selectedBook) {
      setSelectedBook(paramBook);
      setSelection(null);
    }
    if (paramChapter) {
      const ch = parseInt(paramChapter, 10);
      if (ch !== selectedChapter) {
        setSelectedChapter(ch);
        setSelection(null);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramBook, paramChapter]);

  // The translation's book list, then only the book being read.
  useEffect(() => {
    if (bibleId) ensureBibleIndex(bibleId);
  }, [bibleId, ensureBibleIndex]);

  const bibleIndex = bibleId ? bibleIndexes[bibleId] : undefined;
  const bookInfo = bibleIndex?.books.find(b => b.id === selectedBook);
  const currentBook = bibleId ? bibleBooks[`${bibleId}/${selectedBook}`] : undefined;
  const hasTaggedBible = !!manifest?.resources.bibles.some(b => b.id === TAGGED_BIBLE_ID);
  const readingKjv = bibleId === TAGGED_BIBLE_ID;

  useEffect(() => {
    if (bibleId && bookInfo) ensureBibleBook(bibleId, bookInfo.id);
  }, [bibleId, bookInfo, ensureBibleBook]);

  // Another translation borrows the KJV's word tags, once a verse is selected.
  useEffect(() => {
    if (selection && !readingKjv && hasTaggedBible && bookInfo) ensureBibleBook(TAGGED_BIBLE_ID, bookInfo.id);
  }, [selection, readingKjv, hasTaggedBible, bookInfo, ensureBibleBook]);
  const taggedBook = hasTaggedBible ? bibleBooks[`${TAGGED_BIBLE_ID}/${selectedBook}`] : undefined;

  const bookTestament = bookInfo?.testament;
  useEffect(() => {
    if (!bookTestament) return;
    ensureResourceLoaded(bookTestament === 'NT' ? 'strongs-greek' : 'strongs-hebrew');
  }, [bookTestament, ensureResourceLoaded]);

  // Henry, one chapter at a time.
  const henryEntry = manifest?.resources.commentaries.find(c => c.id === COMMENTARY_ID);
  const henryHasChapter = !!henryEntry?.books?.find(b => b.id === selectedBook)?.chapters.includes(selectedChapter);
  useEffect(() => {
    if (henryHasChapter) ensureCommentaryChapter(COMMENTARY_ID, selectedBook, selectedChapter);
  }, [henryHasChapter, selectedBook, selectedChapter, ensureCommentaryChapter]);
  const henryChapter = henryHasChapter ? commentaryChapters[`${COMMENTARY_ID}/${selectedBook}/${selectedChapter}`] : null;
  const henryTabOpen = !!selection && activeTab === 'commentary';
  useEffect(() => {
    if (henryTabOpen && henryEntry) ensureCommentaryIntroduction(COMMENTARY_ID, selectedBook);
  }, [henryTabOpen, henryEntry, selectedBook, ensureCommentaryIntroduction]);

  // The Confession's proof texts, indexed by verse.
  const confession = confessions[CONFESSION_ID];
  const citations = useMemo(() => confession ? citationIndex(confession) : new Map(), [confession]);
  const chapterCitations = useMemo(() => {
    const counts = new Map<number, number>();
    for (const v of currentBook?.verses ?? []) {
      if (v.chapter !== selectedChapter) continue;
      const n = citationsOf(citations, selectedBook, v.chapter, v.verse).length;
      if (n) counts.set(v.verse, n);
    }
    return counts;
  }, [citations, currentBook, selectedBook, selectedChapter]);

  // Load atlas events when edit is available
  useEffect(() => {
    if (canEdit) ensureResourceLoaded('atlas');
  }, [canEdit, ensureResourceLoaded]);

  // Bring a linked verse into view.
  const scrolled = useRef<string | null>(null);
  useEffect(() => {
    if (!targetVerse || !currentBook) return;
    const key = `${selectedBook}/${selectedChapter}/${targetVerse}`;
    if (scrolled.current === key) return;
    scrolled.current = key;
    document.getElementById(`v${selectedChapter}-${targetVerse}`)?.scrollIntoView({ block: 'center' });
  }, [targetVerse, currentBook, selectedBook, selectedChapter]);

  const selectedVerse = selection
    ? currentBook?.verses.find(v => v.chapter === selection.chapter && v.verse === selection.verse)
    : undefined;
  const wordSelection: WordSelection | null = selection?.word && selectedVerse ? {
    word: selection.word.text,
    cleanWord: cleanOf(selection.word.text),
    verse: selectedVerse,
    testament: bookInfo?.testament ?? 'NT',
  } : null;

  // Sync edit draft with active word's existing ref
  const getRefFor = useCallback((s: WordSelection | null) => s
    ? getRef(s.verse.book, s.verse.chapter, s.verse.verse, s.cleanWord)
    : null, [getRef]);
  const activeRef = getRefFor(wordSelection);
  const refKey = wordSelection ? `${wordSelection.verse.book}:${wordSelection.verse.chapter}:${wordSelection.verse.verse}:${wordSelection.cleanWord}` : '';
  useEffect(() => {
    setEditDraft({
      strongs: activeRef?.strongs ?? '',
      geoEventId: activeRef?.geoEventId ?? '',
      confessionRef: activeRef?.confessionRef ?? '',
    });
    setIsEditingLinks(false);
    setSaveStatus('idle');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refKey]);

  const handleWordClick = useCallback((verse: BibleVerse, token: Token, index: number) => {
    setSelection({ chapter: verse.chapter, verse: verse.verse, word: { index, text: token.text, tag: token.tag } });
    setFocusOverride(null);
    setActiveTab(BIBLICAL_PLACES.has(cleanOf(token.text)) ? 'geo' : 'word');
    setMobileSidebar('right');
  }, []);

  const handleVerseClick = useCallback((verse: BibleVerse, tab: InsightTab) => {
    setSelection({ chapter: verse.chapter, verse: verse.verse, word: null });
    setFocusOverride(null);
    setActiveTab(tab);
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
    if (!confession) return [];
    const sections: { number: string; label: string }[] = [];
    for (const chapter of confession.sections) {
      for (const s of chapter.sections) {
        sections.push({ number: s.number, label: `${s.number} — ${chapter.title}` });
      }
    }
    return sections;
  }, [confession]);

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
    if (!activeRef?.confessionRef || !confession) return null;
    for (const chapter of confession.sections) {
      for (const s of chapter.sections) {
        if (s.number === activeRef.confessionRef) return { chapter, section: s };
      }
    }
    return null;
  }, [activeRef, confession]);

  // Strong's: the lexicons by number, and the selected verse's tagged words.
  const lexicon = useMemo(() => {
    const map = new Map<string, StrongsEntry>();
    for (const e of strongsGreek?.entries ?? []) map.set(e.number, e);
    for (const e of strongsHebrew?.entries ?? []) map.set(e.number, e);
    return map;
  }, [strongsGreek, strongsHebrew]);
  const lexiconLoading = bookInfo?.testament === 'NT' ? !loadedResources.has('strongs-greek') : !loadedResources.has('strongs-hebrew');

  const verseWords = useMemo(() => {
    if (!selection || !hasTaggedBible) return undefined;
    if (!taggedBook) return undefined;
    return taggedWords(taggedBook.verses.find(v => v.chapter === selection.chapter && v.verse === selection.verse));
  }, [selection, hasTaggedBible, taggedBook]);

  // The word studied: the clicked KJV word's own tag, or in another
  // translation the KJV word that matches the clicked one.
  const matchedFocus = useMemo(() => {
    if (!selection?.word || !verseWords) return null;
    if (readingKjv) return selection.word.tag;
    const clean = cleanOf(selection.word.text);
    const i = verseWords.findIndex(w => w.word.split(/\s+/).some(part => cleanOf(part) === clean));
    return i < 0 ? null : i;
  }, [selection, verseWords, readingKjv]);
  const focus = focusOverride ?? matchedFocus;

  const usesInBook = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of taggedBook?.verses ?? []) for (const [, , n] of v.strongs ?? []) counts.set(n, (counts.get(n) ?? 0) + 1);
    return (n: string) => counts.get(n) ?? 0;
  }, [taggedBook]);

  if (!bibleIndex) {
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
  const subtitle = currentBook?.subtitles?.[selectedChapter];
  const otBooks = bibleIndex.books.filter(b => b.testament === 'OT');
  const ntBooks = bibleIndex.books.filter(b => b.testament === 'NT');
  const testament = bookInfo?.testament ?? 'NT';
  const lang = testament === 'NT' ? 'Greek' : 'Hebrew';
  const bookName = (id: string) => bibleIndex.books.find(b => b.id === id)?.name ?? id;

  const goTo = (book: string, chapter: number) => {
    setSelectedBook(book);
    setSelectedChapter(chapter);
    setSelection(null);
    navigate(`/reader/${book}/${chapter}`);
  };

  const handleBookSelect = (id: string) => {
    goTo(id, 1);
    closeMobile();
  };

  // Previous and next chapter, across books.
  const bookPos = bibleIndex.books.findIndex(b => b.id === selectedBook);
  const prevBook = bibleIndex.books[bookPos - 1];
  const nextBook = bibleIndex.books[bookPos + 1];
  const prev = selectedChapter > 1
    ? { book: selectedBook, chapter: selectedChapter - 1 }
    : prevBook && { book: prevBook.id, chapter: prevBook.chapters };
  const next = bookInfo && selectedChapter < bookInfo.chapters
    ? { book: selectedBook, chapter: selectedChapter + 1 }
    : nextBook && { book: nextBook.id, chapter: 1 };

  const isGeoWord = wordSelection ? BIBLICAL_PLACES.has(wordSelection.cleanWord) : false;
  const selectionLabel = selection ? `${bookInfo?.name ?? ''} ${selection.chapter}:${selection.verse}` : '';
  const verseCitations = selection ? citationsOf(citations, selectedBook, selection.chapter, selection.verse) : [];
  const focusedNumber = focus !== null && verseWords ? verseWords[focus]?.number ?? null : null;

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

      <div className="workspace sticky-panels">
        {/* Left sidebar: book + chapter navigation */}
        <aside className={`left-sidebar${mobileSidebar === 'left' ? ' mobile-open' : ''}`}>
          <div className="sidebar-close-row mobile-only">
            <button className="sidebar-close-btn" onClick={closeMobile}><X size={16} /> Close</button>
          </div>
          <div className="sidebar-label">Old Testament</div>
          <BookList books={otBooks} selectedBook={selectedBook} onSelect={handleBookSelect} />

          <div className="sidebar-label" style={{ marginTop: 20 }}>New Testament</div>
          <BookList books={ntBooks} selectedBook={selectedBook} onSelect={handleBookSelect} />

          {bookInfo && (
            <div style={{
              padding: '12px 20px 20px',
              backgroundColor: 'var(--bg-surface)',
              borderBottom: '1px solid var(--border-soft)',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                {Array.from({ length: bookInfo.chapters }, (_, i) => i + 1).map((chapter) => (
                  <button
                    key={chapter}
                    type="button"
                    onClick={() => goTo(selectedBook, chapter)}
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
          <div style={{ maxWidth: 680, width: '100%', paddingBottom: 80, margin: '0 auto' }}>
            {bookInfo ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                  <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', marginBottom: 12 }}>
                    {bookInfo.name} {selectedChapter}
                  </h1>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <label className="translation-picker">
                      <span className="visually-hidden">Translation</span>
                      <select
                        value={bibleId ?? ''}
                        onChange={e => setBibleId(e.target.value)}
                        aria-label="Translation"
                      >
                        {manifest?.resources.bibles.map(b => (
                          <option key={b.id} value={b.id}>{b.abbreviation} — {b.name}</option>
                        ))}
                      </select>
                    </label>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                      {readingKjv ? 'Underlined words have Strong’s numbers · ' : ''}Click a word, or a verse number for commentary
                    </span>
                  </div>
                </div>

                <div style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.2rem',
                  lineHeight: 2,
                  color: 'var(--text-primary)',
                }}>
                  {subtitle && (
                    <p style={{ fontStyle: 'italic', fontSize: '1rem', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
                      {subtitle}
                    </p>
                  )}
                  {!currentBook ? (
                    <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      Loading {bookInfo.name}…
                    </div>
                  ) : currentVerses.length > 0 ? (
                    currentVerses.map((verse) => (
                      <VerseRow
                        key={`${verse.book}-${verse.chapter}-${verse.verse}`}
                        verse={verse}
                        selection={selection}
                        isTarget={verse.verse === targetVerse}
                        citedCount={chapterCitations.get(verse.verse) ?? 0}
                        onWordClick={handleWordClick}
                        onVerseClick={handleVerseClick}
                      />
                    ))
                  ) : (
                    <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      No verses available for this chapter.
                    </div>
                  )}
                </div>

                <nav className="chapter-nav" aria-label="Chapters">
                  {prev ? (
                    <button type="button" onClick={() => goTo(prev.book, prev.chapter)}>
                      <ChevronLeft size={16} /> {bookName(prev.book)} {prev.chapter}
                    </button>
                  ) : <span />}
                  {next && (
                    <button type="button" onClick={() => goTo(next.book, next.chapter)}>
                      {bookName(next.book)} {next.chapter} <ChevronRight size={16} />
                    </button>
                  )}
                </nav>
              </>
            ) : (
              <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center' }}>
                This translation has no book “{selectedBook}”.
              </div>
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

          {!selection ? (
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
                Click any word to study it, or a verse number to read the commentary.
              </div>
              <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { icon: <Hash size={14} />, label: 'Word Study', desc: `${lang} words and Strong's numbers, from the KJV's tagging`, color: 'var(--accent-exe)', bg: 'var(--bg-exe-light)' },
                  { icon: <MessageSquare size={14} />, label: 'Commentary', desc: "Matthew Henry's exposition of the passage", color: 'var(--accent-theo)', bg: 'var(--bg-theo-light)' },
                  { icon: <MapPin size={14} />, label: 'Geography', desc: 'Place names & atlas links', color: 'var(--accent-geo)', bg: 'var(--bg-geo-light)' },
                  { icon: <Bookmark size={14} />, label: 'Confession', desc: 'Where the Westminster Confession cites the verse', color: 'var(--accent-theo)', bg: 'var(--bg-theo-light)' },
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
                title={selection.word?.text ?? selectionLabel}
                reference={selection.word ? `${selectionLabel} · ${bibleIndex.version.abbreviation}` : bibleIndex.version.name}
                language={lang}
                isPlace={isGeoWord}
                strongs={selection.word ? focusedNumber : null}
                activeRef={activeRef}
                canEdit={canEdit && !!wordSelection}
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
                    citations={verseCitations.length}
                  />
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {activeTab === 'word' && (
                      hasTaggedBible ? (
                        <WordStudyPanel
                          words={verseWords}
                          focus={focus}
                          clickedWord={selection.word?.text ?? null}
                          readingKjv={readingKjv}
                          abbreviation={bibleIndex.version.abbreviation}
                          lexicon={lexicon}
                          lexiconLoading={lexiconLoading}
                          usesInBook={usesInBook}
                          bookName={bookInfo?.name ?? ''}
                          onFocus={setFocusOverride}
                        />
                      ) : (
                        <div className="insight-body"><div className="insight-note">Strong's numbers come from the KJV, which this site doesn't have.</div></div>
                      )
                    )}
                    {activeTab === 'commentary' && (
                      <HenryPanel
                        chapter={henryChapter}
                        bookIntroduction={commentaryIntroductions[`${COMMENTARY_ID}/${selectedBook}`]}
                        bookName={bookInfo?.name ?? ''}
                        verse={selection}
                      />
                    )}
                    {activeTab === 'geo' && (
                      wordSelection ? (
                        <GeoPanel
                          selection={wordSelection}
                          bookName={bookInfo?.name ?? ''}
                          linkedEvent={linkedAtlasEvent}
                        />
                      ) : (
                        <div className="insight-body"><div className="insight-note">Click a place name (highlighted in green) for its geography.</div></div>
                      )
                    )}
                    {activeTab === 'confession' && (
                      <>
                        {(activeRef?.confessionRef || (canEdit && wordSelection)) && (
                          <ConfessionPanel
                            confessionRef={activeRef?.confessionRef ?? null}
                            wcfSection={linkedWcfSection}
                            canEdit={canEdit}
                            onEditLinks={() => setIsEditingLinks(true)}
                          />
                        )}
                        <CitationsPanel
                          citations={verseCitations}
                          confessionId={CONFESSION_ID}
                          abbreviation={confession?.confession.abbreviation ?? 'WCF'}
                          loading={!confession}
                          verseLabel={selectionLabel}
                          bookName={bookName}
                        />
                      </>
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


// ── Sub-panels ────────────────────────────────────────────────────────────

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
