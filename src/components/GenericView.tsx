import React, { useEffect, useState } from 'react';

interface GenericViewProps {
  title: string;
}

export default function GenericView({ title }: GenericViewProps) {
  const [topics, setTopics] = useState<any[] | null>(null);

  useEffect(() => {
    if (title === 'Theology Explorer' && import.meta.env.DEV) {
      (async () => {
        try {
          const res = await fetch('http://localhost:4001/file/theology/theology.json');
          if (!res.ok) return;
          const json = await res.json();
          setTopics(json.topics || null);
        } catch (err) {
          // ignore
        }
      })();
    }
  }, [title]);

  return (
    <div className="workspace">
      <div className="center-content">
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <h2>{title}</h2>
          {title === 'Theology Explorer' && topics ? (
            <div style={{ textAlign: 'left', maxWidth: 720, margin: '24px auto' }}>
              {topics.map(topic => (
                <div key={topic.id} style={{ padding: 12, borderBottom: '1px solid var(--border-soft)' }}>
                  <h3 style={{ margin: 0 }}>{topic.title}</h3>
                  <div style={{ color: 'var(--text-secondary)' }}>{topic.summary}</div>
                </div>
              ))}
            </div>
          ) : (
            <p>This module is under construction. Please use the Atlas & Timeline module.</p>
          )}
        </div>
      </div>
    </div>
  );
}
