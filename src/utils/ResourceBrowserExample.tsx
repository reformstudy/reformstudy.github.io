/**
 * Example Component: Resource Browser
 * 
 * This example demonstrates how to use the resource loading system
 * to browse and display different resources in the app.
 */

import React, { useState, useEffect } from 'react';
import { 
  resourceManager,
  getAvailableBibles,
  getAvailableConfessions,
  getAvailableCommentaries,
  getAvailableStrongs,
  BibleManifestEntry,
  ConfessionManifestEntry,
  CommentaryManifestEntry,
  StrongsManifestEntry,
  BibleVersion,
  Confession
  ,
  ConfessionSubsection
} from '@/utils/resourceLoader';

export function ResourceBrowserExample() {
  const [bibles, setBibles] = useState<BibleManifestEntry[]>([]);
  const [confessions, setConfessions] = useState<ConfessionManifestEntry[]>([]);
  const [commentaries, setCommentaries] = useState<CommentaryManifestEntry[]>([]);
  const [strongs, setStrongs] = useState<StrongsManifestEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadResources();
  }, []);

  const loadResources = async () => {
    try {
      setLoading(true);
      const [biblesData, confessionsData, commentariesData, strongsData] = await Promise.all([
        getAvailableBibles(),
        getAvailableConfessions(),
        getAvailableCommentaries(),
        getAvailableStrongs()
      ]);
      
      setBibles(biblesData);
      setConfessions(confessionsData);
      setCommentaries(commentariesData);
      setStrongs(strongsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load resources');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadBible = async (bibleId: string) => {
    try {
      const bible = await resourceManager.loadBible(bibleId);
      console.log('Loaded Bible:', bible);
      // Use the loaded Bible in your component
    } catch (err) {
      console.error('Error loading Bible:', err);
    }
  };

  if (loading) {
    return <div>Loading resources...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="resource-browser">
      <h1>Resource Browser</h1>
      
      {/* Bibles Section */}
      <section>
        <h2>Bible Versions ({bibles.length})</h2>
        <ul>
          {bibles.map(bible => (
            <li key={bible.id}>
              <button onClick={() => handleLoadBible(bible.id)}>
                {bible.name} ({bible.abbreviation})
              </button>
              <p>{bible.description}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Confessions Section */}
      <section>
        <h2>Confessions ({confessions.length})</h2>
        <ul>
          {confessions.map(conf => (
            <li key={conf.id}>
              <strong>{conf.name}</strong> ({conf.year})
              <p>{conf.description}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Commentaries Section */}
      <section>
        <h2>Commentaries ({commentaries.length})</h2>
        <ul>
          {commentaries.map(comm => (
            <li key={comm.id}>
              <strong>{comm.name}</strong> by {comm.author}
              <p>Book: {comm.book}</p>
              <p>{comm.description}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Strong's Section */}
      <section>
        <h2>Strong's Concordances ({strongs.length})</h2>
        <ul>
          {strongs.map(s => (
            <li key={s.id}>
              <strong>{s.name}</strong>
              <p>Language: {s.language}</p>
              <p>Entries: {s.totalEntries}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Cache Statistics */}
      <section>
        <h3>Cache Statistics</h3>
        <CacheStats />
      </section>
    </div>
  );
}

/**
 * Component displaying cache statistics
 */
function CacheStats() {
  const [stats, setStats] = useState({ itemCount: 0, resourceIds: [] as string[] });

  useEffect(() => {
    const updateStats = () => {
      setStats(resourceManager.getCacheStats());
    };

    // Update on mount and when needed
    updateStats();
    
    // You could set up an interval to update periodically if desired
    const interval = setInterval(updateStats, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <p>Cached Items: {stats.itemCount}</p>
      <p>Resources: {stats.resourceIds.join(', ') || 'None'}</p>
      <button onClick={() => resourceManager.clearCache()}>
        Clear Cache
      </button>
    </div>
  );
}

/**
 * Example: Load and display a Bible verse
 */
export function BibleVerseExample({ bibleId = 'kjv' }) {
  const [bible, setBible] = useState<BibleVersion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    resourceManager.loadBible(bibleId)
      .then(setBible)
      .finally(() => setLoading(false));
  }, [bibleId]);

  if (loading) return <div>Loading Bible...</div>;
  if (!bible) return <div>Bible not found</div>;

  const verse = resourceManager.getVerse(bible, 'GEN', 1, 1);

  return (
    <div className="verse-display">
      <h3>{bible.version.name}</h3>
      {verse && (
        <div>
          <p className="reference">Genesis 1:1</p>
          <p className="text">{verse.text}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Example: Load and display a confession section
 */
export function ConfessionExample({ confessionId = 'wcf' }) {
  const [confession, setConfession] = useState<Confession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    resourceManager.loadConfession(confessionId)
      .then(setConfession)
      .finally(() => setLoading(false));
  }, [confessionId]);

  if (loading) return <div>Loading confession...</div>;
  if (!confession) return <div>Confession not found</div>;

  const firstSection = confession.sections[0];

  return (
    <div className="confession-display">
      <h3>{confession.confession.name}</h3>
      {firstSection && (
        <div>
          <h4>{firstSection.title}</h4>
          {firstSection.sections.map((section: ConfessionSubsection, idx: number) => (
            <div key={idx}>
              <p><strong>{section.number}</strong> {section.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
