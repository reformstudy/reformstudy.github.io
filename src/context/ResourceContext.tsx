import React, { createContext, useContext, ReactNode, useState, useEffect, useCallback, useRef } from 'react';
import {
  BibleBook,
  BibleIndex,
  BibleVersion,
  Confession,
  Commentary,
  StrongsConcordance,
  ResourceManifest,
  loadResourceManifest,
  loadBible,
  loadBibleBook,
  loadBibleIndex,
  loadConfession,
  loadCommentary,
  loadStrongsGreek,
  loadStrongsHebrew
} from '../utils/resourceLoader';

interface ResourceContextType {
  // Data
  manifest: ResourceManifest | null;
  bibles: Record<string, BibleVersion>;
  confessions: Record<string, Confession>;
  commentaries: Record<string, Commentary>;
  strongsGreek: StrongsConcordance | null;
  strongsHebrew: StrongsConcordance | null;
  /** Book lists (no text), keyed by translation ID. */
  bibleIndexes: Record<string, BibleIndex>;
  /** Single books, keyed `${translationId}/${bookId}`. */
  bibleBooks: Record<string, BibleBook>;
  /** The translation the app opens in, from the manifest. */
  defaultBibleId: string | null;

  // Status
  isLoading: boolean;
  error: Error | null;
  loadedResources: Set<string>;

  // Methods
  /** Load a whole resource (a full Bible, confession, commentary or concordance). Safe to call repeatedly. */
  ensureResourceLoaded: (resourceId: string) => Promise<void>;
  /** Load a translation's book list. Safe to call repeatedly. */
  ensureBibleIndex: (bibleId: string) => Promise<void>;
  /** Load one book of a translation. Safe to call repeatedly. */
  ensureBibleBook: (bibleId: string, bookId: string) => Promise<void>;
  // Local editable content (e.g. atlas, theology)
  content: Record<string, any>;
  loadContent?: (resourceId: string, path: string) => Promise<void>;
}

const ResourceContext = createContext<ResourceContextType | undefined>(undefined);

export function ResourceProvider({ children }: { children: ReactNode }) {
  const [manifest, setManifest] = useState<ResourceManifest | null>(null);
  const [bibles, setBibles] = useState<Record<string, BibleVersion>>({});
  const [confessions, setConfessions] = useState<Record<string, Confession>>({});
  const [commentaries, setCommentaries] = useState<Record<string, Commentary>>({});
  const [strongsGreek, setStrongsGreek] = useState<StrongsConcordance | null>(null);
  const [strongsHebrew, setStrongsHebrew] = useState<StrongsConcordance | null>(null);
  const [bibleIndexes, setBibleIndexes] = useState<Record<string, BibleIndex>>({});
  const [bibleBooks, setBibleBooks] = useState<Record<string, BibleBook>>({});
  const [content, setContent] = useState<Record<string, any>>({});
  const [localContentAvailable, setLocalContentAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [loadedResources, setLoadedResources] = useState<Set<string>>(new Set());

  // Loads started or finished, by key. A finished load stays in the map so
  // repeat calls return immediately; a failed one is removed so it can be retried.
  const loads = useRef(new Map<string, Promise<void>>());
  const once = useCallback((key: string, load: () => Promise<void>): Promise<void> => {
    const existing = loads.current.get(key);
    if (existing) return existing;
    const promise = load().catch(err => {
      loads.current.delete(key);
      setError(err instanceof Error ? err : new Error(`Failed to load ${key}`));
    });
    loads.current.set(key, promise);
    return promise;
  }, []);

  // Initialize by loading manifest
  useEffect(() => {
    const initialize = async () => {
      try {
        const manifestData = await loadResourceManifest();
        setManifest(manifestData);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load manifest'));
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  // Detect whether the local content server is running (dev only)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('http://localhost:4001/health');
        if (mounted && res.ok) setLocalContentAvailable(true);
      } catch (err) {
        // ignore - server likely not running
      }
    })();
    return () => { mounted = false; };
  }, []);

  const loadContent = useCallback(async (resourceId: string, path: string) => {
    // Try local content server first when available in dev
    if (import.meta.env.DEV && localContentAvailable) {
      try {
        const res = await fetch(`http://localhost:4001/file/${path}`);
        if (res.ok) {
          const json = await res.json();
          setContent(prev => ({ ...prev, [resourceId]: json }));
          return;
        }
      } catch (err) {
        // fall through to fallback
      }
    }

    // Fallback to built content under /content
    try {
      const res = await fetch(`/content/${path}`);
      if (!res.ok) throw new Error('Failed to load content');
      const json = await res.json();
      setContent(prev => ({ ...prev, [resourceId]: json }));
    } catch (err) {
      console.warn('Could not load content', path, err);
    }
  }, [localContentAvailable]);

  // Read through a ref so ensureResourceLoaded keeps a stable identity even
  // when the local content server is detected after startup.
  const loadContentRef = useRef(loadContent);
  loadContentRef.current = loadContent;

  const ensureResourceLoaded = useCallback((resourceId: string) => once(`resource:${resourceId}`, async () => {
    if (resourceId === 'atlas') {
      await loadContentRef.current('atlas', 'atlas/eraEvents.json');
    } else if (resourceId === 'theology') {
      await loadContentRef.current('theology', 'theology/theology.json');
    } else if (resourceId === 'strongs-greek') {
      setStrongsGreek(await loadStrongsGreek());
    } else if (resourceId === 'strongs-hebrew') {
      setStrongsHebrew(await loadStrongsHebrew());
    } else {
      const { resources } = await loadResourceManifest();
      const bible = resources.bibles.find(b => b.id === resourceId);
      const commentary = resources.commentaries.find(c => c.id === resourceId && c.file);
      const confession = resources.confessions.find(c => c.id === resourceId);
      if (bible) {
        const data = await loadBible(bible.file);
        setBibles(prev => ({ ...prev, [resourceId]: data }));
      } else if (commentary?.file) {
        const data = await loadCommentary(commentary.file);
        setCommentaries(prev => ({ ...prev, [resourceId]: data }));
      } else if (confession) {
        const data = await loadConfession(confession.file);
        setConfessions(prev => ({ ...prev, [resourceId]: data }));
      } else {
        console.warn(`Unknown resource: ${resourceId}`);
        return;
      }
    }
    setLoadedResources(prev => new Set(prev).add(resourceId));
  }), [once]);

  const ensureBibleIndex = useCallback((bibleId: string) => once(`bible-index:${bibleId}`, async () => {
    const { resources } = await loadResourceManifest();
    const entry = resources.bibles.find(b => b.id === bibleId);
    if (!entry?.index) throw new Error(`No book list for translation: ${bibleId}`);
    const data = await loadBibleIndex(entry.index);
    setBibleIndexes(prev => ({ ...prev, [bibleId]: data }));
  }), [once]);

  const ensureBibleBook = useCallback((bibleId: string, bookId: string) => once(`bible-book:${bibleId}/${bookId}`, async () => {
    const { resources } = await loadResourceManifest();
    const entry = resources.bibles.find(b => b.id === bibleId);
    if (!entry?.bookPath) throw new Error(`No per-book files for translation: ${bibleId}`);
    const data = await loadBibleBook(entry.bookPath.replace('{book}', bookId));
    setBibleBooks(prev => ({ ...prev, [`${bibleId}/${bookId}`]: data }));
  }), [once]);

  const defaultBibleId = manifest?.defaultBible ?? manifest?.resources.bibles[0]?.id ?? null;

  return (
    <ResourceContext.Provider
      value={{
        manifest,
        bibles,
        confessions,
        commentaries,
        strongsGreek,
        strongsHebrew,
        bibleIndexes,
        bibleBooks,
        defaultBibleId,
        isLoading,
        error,
        loadedResources,
        content,
        loadContent,
        ensureResourceLoaded,
        ensureBibleIndex,
        ensureBibleBook
      }}
    >
      {children}
    </ResourceContext.Provider>
  );
}

export function useResources() {
  const context = useContext(ResourceContext);
  if (context === undefined) {
    throw new Error('useResources must be used within a ResourceProvider');
  }
  return context;
}
