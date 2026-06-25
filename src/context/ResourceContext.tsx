import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
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
}

const ResourceContext = createContext<ResourceContextType | undefined>(undefined);

export function ResourceProvider({ children }: { children: ReactNode }) {
  const [manifest, setManifest] = useState<ResourceManifest | null>(null);
  const [bibles, setBibles] = useState<Record<string, BibleVersion>>({});
  const [confessions, setConfessions] = useState<Record<string, Confession>>({});
  const [commentaries, setCommentaries] = useState<Record<string, Commentary>>({});
  const [strongsGreek, setStrongsGreek] = useState<StrongsConcordance | null>(null);
  const [strongsHebrew, setStrongsHebrew] = useState<StrongsConcordance | null>(null);
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

  const ensureResourceLoaded = async (resourceId: string) => {
    if (loadedResources.has(resourceId)) {
      return; // Already loaded
    }

    try {
      if (resourceId === 'kjv') {
        const data = await loadBible('bible-kjv.json');
        setBibles(prev => ({ ...prev, [resourceId]: data }));
      } else if (resourceId === 'wcf') {
        const data = await loadConfession('confession-wcf.json');
        setConfessions(prev => ({ ...prev, [resourceId]: data }));
      } else if (resourceId === 'matthew-gill') {
        const data = await loadCommentary('commentary-matthew-gill.json');
        setCommentaries(prev => ({ ...prev, [resourceId]: data }));
      } else if (resourceId === 'strongs-greek') {
        const data = await loadStrongsGreek();
        setStrongsGreek(data);
      } else if (resourceId === 'strongs-hebrew') {
        const data = await loadStrongsHebrew();
        setStrongsHebrew(data);
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
