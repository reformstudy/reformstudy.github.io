import React, { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import {
  BibleVersion,
  Confession,
  Commentary,
  StrongsConcordance,
  ResourceManifest,
  loadResourceManifest,
  loadBible,
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
  
  // Status
  isLoading: boolean;
  error: Error | null;
  loadedResources: Set<string>;
  
  // Methods
  ensureResourceLoaded: (resourceId: string) => Promise<void>;
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
  const [content, setContent] = useState<Record<string, any>>({});
  const [localContentAvailable, setLocalContentAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [loadedResources, setLoadedResources] = useState<Set<string>>(new Set());

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

  const ensureResourceLoaded = async (resourceId: string) => {
    if (loadedResources.has(resourceId)) {
      return; // Already loaded
    }

    try {
      // Support editable local-first content resources
      if (resourceId === 'atlas') {
        await loadContent('atlas', 'atlas/eraEvents.json');
        setLoadedResources(prev => new Set(prev).add(resourceId));
        return;
      }
      if (resourceId === 'theology') {
        await loadContent('theology', 'theology/theology.json');
        setLoadedResources(prev => new Set(prev).add(resourceId));
        return;
      }
      if (resourceId === 'kjv') {
        const data = await loadBible('bible-kjv.json');
        setBibles(prev => ({ ...prev, [resourceId]: data }));
      } else if (resourceId === 'matthew-gill') {
        const data = await loadCommentary('commentary-matthew-gill.json');
        setCommentaries(prev => ({ ...prev, [resourceId]: data }));
      } else if (resourceId === 'strongs-greek') {
        const data = await loadStrongsGreek();
        setStrongsGreek(data);
      } else if (resourceId === 'strongs-hebrew') {
        const data = await loadStrongsHebrew();
        setStrongsHebrew(data);
      } else {
        // Dynamically resolve any confession from the manifest
        const currentManifest = await loadResourceManifest();
        const confessionEntry = currentManifest.resources.confessions.find(c => c.id === resourceId);
        if (confessionEntry) {
          const data = await loadConfession(confessionEntry.file);
          setConfessions(prev => ({ ...prev, [resourceId]: data }));
        }
      }

      setLoadedResources(prev => new Set(prev).add(resourceId));
    } catch (err) {
      setError(err instanceof Error ? err : new Error(`Failed to load resource: ${resourceId}`));
    }
  };

  return (
    <ResourceContext.Provider
      value={{
        manifest,
        bibles,
        confessions,
        commentaries,
        strongsGreek,
        strongsHebrew,
        isLoading,
        error,
        loadedResources,
        content,
        loadContent,
        ensureResourceLoaded
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
