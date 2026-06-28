import React, { useEffect, useState } from 'react';

interface TheologyEntry {
  id: string;
  title: string;
  content?: string;
}

interface TheologyTopic {
  id: string;
  title: string;
  summary?: string;
  entries: TheologyEntry[];
}

interface TheologyData {
  topics: TheologyTopic[];
}

export default function TheologyExplorer() {
  const [data, setData] = useState<TheologyData>({ topics: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      // In dev, prefer local content server
      if (import.meta.env.DEV) {
        try {
          const res = await fetch('http://localhost:4001/file/theology/theology.json');
          if (!res.ok) throw new Error('Not available');
          const json = await res.json();
          if (mounted) setData(json as TheologyData);
          setLoading(false);
          return;
        } catch (err) {
          // fall through to attempt loading from built docs
        }
      }

      try {
        const res = await fetch('/content/theology/theology.json');
        if (!res.ok) throw new Error('Failed to load theology content');
        const json = await res.json();
        if (mounted) setData(json as TheologyData);
      } catch (err: any) {
        setError(err?.message ?? String(err));
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, []);

  if (loading) return <div className="workspace">Loading theology topics...</div>;
  if (error) return <div className="workspace">Error loading theology content: {error}</div>;

  return (
    <div className="workspace" style={{ display: 'flex', gap: 12 }}>
      <aside style={{ width: 320, padding: 16, borderRight: '1px solid var(--border-soft)' }}>
        <h3 style={{ marginTop: 0 }}>Theology Topics</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.topics.map(t => (
            <div key={t.id} style={{ padding: '8px 12px', borderRadius: 8, background: 'transparent' }}>
              <div style={{ fontWeight: 700 }}>{t.title}</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{t.summary}</div>
            </div>
          ))}
          {data.topics.length === 0 && <div style={{ color: 'var(--text-tertiary)' }}>No topics yet.</div>}
        </div>
      </aside>

      <div style={{ flex: 1, padding: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-serif)' }}>Theology Explorer</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Browse theological topics and entries stored in the local content folder.</p>

        <div style={{ marginTop: 12 }}>
          {data.topics.flatMap(t => t.entries.map(e => ({ topic: t.title, entry: e }))).map(item => (
            <div key={item.entry.id} style={{ padding: 12, border: '1px solid var(--border-soft)', borderRadius: 8, marginBottom: 12 }}>
              <div style={{ fontWeight: 700 }}>{item.entry.title} <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: 8 }}>— {item.topic}</span></div>
              <div style={{ marginTop: 8, color: 'var(--text-secondary)', fontFamily: 'var(--font-serif)' }}>{item.entry.content}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
