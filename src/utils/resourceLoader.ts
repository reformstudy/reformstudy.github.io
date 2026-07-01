/**
 * Resource Loader
 * 
 * Handles fetching and managing biblical and theological resources.
 * Resources are fetched on-demand and cached in memory.
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface BibleVersion {
  version: {
    id: string;
    name: string;
    abbreviation: string;
    language: string;
    releaseDate: string;
    copyright: string;
    description: string;
  };
  books: BibleBook[];
}

export interface BibleBook {
  id: string;
  name: string;
  testament: 'OT' | 'NT';
  chapters: number;
  verses: BibleVerse[];
}

export interface BibleVerse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface Confession {
  confession: {
    id: string;
    name: string;
    abbreviation: string;
    year: number;
    origin: string;
    description: string;
    chapters: number;
  };
  sections: ConfessionSection[];
}

export interface ConfessionSection {
  chapter: number;
  title: string;
  sections: ConfessionSubsection[];
}

export interface ConfessionSubsection {
  number: string;
  content: string;
  proofTexts?: Array<{ reference: string; text: string }>;
}

export interface Commentary {
  commentary: {
    id: string;
    name: string;
    author: string;
    book: string;
    published: number;
    description: string;
  };
  entries: CommentaryEntry[];
}

export interface CommentaryEntry {
  book: string;
  chapter: number;
  verse: number;
  text: string;
  commentary: string;
}

export interface StrongsEntry {
  number: string;
  transliteration: string;
  pronunciation: string;
  partOfSpeech: string;
  definition: string;
  kjvDefinition: string;
  usageCount: number;
  references: StrongsReference[];
}

export interface StrongsReference {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface StrongsConcordance {
  concordance: {
    id: string;
    name: string;
    language: string;
    totalEntries: number;
    version: string;
  };
  entries: StrongsEntry[];
}

export interface ResourceManifest {
  timestamp: string;
  resources: {
    bibles: BibleManifestEntry[];
    confessions: ConfessionManifestEntry[];
    commentaries: CommentaryManifestEntry[];
    strongs: StrongsManifestEntry[];
  };
}

export interface BibleManifestEntry {
  id: string;
  name: string;
  abbreviation: string;
  language: string;
  file: string;
  description: string;
}

export interface ConfessionManifestEntry {
  id: string;
  name: string;
  abbreviation: string;
  year: number;
  file: string;
  description: string;
}

export interface CommentaryManifestEntry {
  id: string;
  name: string;
  author: string;
  book: string;
  file: string;
  description: string;
}

export interface StrongsManifestEntry {
  id: string;
  name: string;
  language: string;
  totalEntries: number;
  file: string;
  description: string;
}

// ============================================================================
// Resource Manager Class
// ============================================================================

export class ResourceManager {
  private manifestUrl: string;
  private resourceBaseUrl: string;
  private manifest: ResourceManifest | null = null;
  private cache: Map<string, any> = new Map();
  private loadingPromises: Map<string, Promise<any>> = new Map();

  constructor(baseUrl: string = '') {
    // In development, resources are served from /docs/resources/
    // In production, they're served from /resources/
    const isDev = import.meta.env.DEV;
    // Prefer built resources by default, but allow a local content server
    // to serve editable content under /content when running in dev.
    this.resourceBaseUrl = isDev ? '/docs/resources' : '/resources';
    this.manifestUrl = `${this.resourceBaseUrl}/manifest.json`;
  }

  /**
   * Fetch and cache the manifest
   */
  async getManifest(): Promise<ResourceManifest> {
    if (this.manifest) {
      return this.manifest;
    }

    try {
      const response = await fetch(this.manifestUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch manifest: ${response.statusText}`);
      }
      const manifest = (await response.json()) as ResourceManifest;
      this.manifest = manifest;
      return manifest;
    } catch (error) {
      console.error('Error loading manifest:', error);
      throw error;
    }
  }

  /**
   * Fetch a specific resource
   */
  private async fetchResource<T>(filePath: string): Promise<T> {
    // Check cache first
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath) as T;
    }

    // Check if already loading
    if (this.loadingPromises.has(filePath)) {
      return this.loadingPromises.get(filePath) as Promise<T>;
    }

    // Create new loading promise
    const loadPromise = (async () => {
      try {
        const url = `${this.resourceBaseUrl}/${filePath}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch resource: ${response.statusText}`);
        }
        const data = await response.json();
        this.cache.set(filePath, data);
        this.loadingPromises.delete(filePath);
        return data as T;
      } catch (error) {
        console.error(`Error loading resource ${filePath}:`, error);
        this.loadingPromises.delete(filePath);
        throw error;
      }
    })();

    this.loadingPromises.set(filePath, loadPromise);
    return loadPromise;
  }

  /**
   * Load a Bible version
   */
  async loadBible(bibleId: string): Promise<BibleVersion> {
    const manifest = await this.getManifest();
    const bibleEntry = manifest.resources.bibles.find(b => b.id === bibleId);
    if (!bibleEntry) {
      throw new Error(`Bible version not found: ${bibleId}`);
    }
    return this.fetchResource<BibleVersion>(bibleEntry.file);
  }

  /**
   * Load a confession
   */
  async loadConfession(confessionId: string): Promise<Confession> {
    const manifest = await this.getManifest();
    const confessionEntry = manifest.resources.confessions.find(c => c.id === confessionId);
    if (!confessionEntry) {
      throw new Error(`Confession not found: ${confessionId}`);
    }
    return this.fetchResource<Confession>(confessionEntry.file);
  }

  /**
   * Load a commentary
   */
  async loadCommentary(commentaryId: string): Promise<Commentary> {
    const manifest = await this.getManifest();
    const commentaryEntry = manifest.resources.commentaries.find(c => c.id === commentaryId);
    if (!commentaryEntry) {
      throw new Error(`Commentary not found: ${commentaryId}`);
    }
    return this.fetchResource<Commentary>(commentaryEntry.file);
  }

  /**
   * Load a Strong's concordance
   */
  async loadStrongs(strongsId: string): Promise<StrongsConcordance> {
    const manifest = await this.getManifest();
    const strongsEntry = manifest.resources.strongs.find(s => s.id === strongsId);
    if (!strongsEntry) {
      throw new Error(`Strong's concordance not found: ${strongsId}`);
    }
    return this.fetchResource<StrongsConcordance>(strongsEntry.file);
  }

  /**
   * Get a specific verse from a loaded Bible
   */
  getVerse(bible: BibleVersion, bookId: string, chapter: number, verse: number): BibleVerse | null {
    const book = bible.books.find(b => b.id === bookId);
    if (!book) return null;

    const verseData = book.verses.find(v => v.chapter === chapter && v.verse === verse);
    return verseData || null;
  }

  /**
   * Get all verses for a chapter
   */
  getChapter(bible: BibleVersion, bookId: string, chapter: number): BibleVerse[] {
    const book = bible.books.find(b => b.id === bookId);
    if (!book) return [];

    return book.verses.filter(v => v.chapter === chapter);
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
    this.loadingPromises.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { itemCount: number; resourceIds: string[] } {
    return {
      itemCount: this.cache.size,
      resourceIds: Array.from(this.cache.keys())
    };
  }
}

// ============================================================================
// Global Resource Manager Instance
// ============================================================================

export const resourceManager = new ResourceManager();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all available Bible versions from the manifest
 */
export async function getAvailableBibles(): Promise<BibleManifestEntry[]> {
  const manifest = await resourceManager.getManifest();
  return manifest.resources.bibles;
}

/**
 * Get all available confessions from the manifest
 */
export async function getAvailableConfessions(): Promise<ConfessionManifestEntry[]> {
  const manifest = await resourceManager.getManifest();
  return manifest.resources.confessions;
}

/**
 * Get all available commentaries from the manifest
 */
export async function getAvailableCommentaries(): Promise<CommentaryManifestEntry[]> {
  const manifest = await resourceManager.getManifest();
  return manifest.resources.commentaries;
}

/**
 * Get all available Strong's concordances from the manifest
 */
export async function getAvailableStrongs(): Promise<StrongsManifestEntry[]> {
  const manifest = await resourceManager.getManifest();
  return manifest.resources.strongs;
}

// ============================================================================
// Convenience Export Functions for ResourceContext
// ============================================================================

const getResourceBaseUrl = () => {
  const isDev = import.meta.env.DEV;
  // If a local content server is available, app components (Atlas/Theology)
  // may fetch files directly from it (http://localhost:4001/file/...).
  return isDev ? '/docs/resources' : '/resources';
};

/**
 * Load the resource manifest
 */
export async function loadResourceManifest(): Promise<ResourceManifest> {
  return resourceManager.getManifest();
}

/**
 * Load a Bible by filename
 */
export async function loadBible(filename: string): Promise<BibleVersion> {
  const url = `${getResourceBaseUrl()}/${filename}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load Bible: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Load a confession by filename
 */
export async function loadConfession(filename: string): Promise<Confession> {
  const url = `${getResourceBaseUrl()}/${filename}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load confession: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Load a commentary by filename
 */
export async function loadCommentary(filename: string): Promise<Commentary> {
  const url = `${getResourceBaseUrl()}/${filename}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load commentary: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Load Strong's Greek concordance
 */
export async function loadStrongsGreek(): Promise<StrongsConcordance> {
  return resourceManager.loadStrongs('greek');
}

/**
 * Load Strong's Hebrew concordance
 */
export async function loadStrongsHebrew(): Promise<StrongsConcordance> {
  return resourceManager.loadStrongs('hebrew');
}
