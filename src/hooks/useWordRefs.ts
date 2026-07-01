import { useState, useEffect, useCallback } from 'react';

export interface WordRef {
  book: string;
  chapter: number;
  verse: number;
  word: string;           // normalized lowercase
  strongs: string | null; // e.g. "G2424" or "H3068"
  geoEventId: string | null;
  confessionRef: string | null; // WCF section number, e.g. "2.1"
}

const CMS_BASE = 'http://localhost:4001';

function refKey(book: string, chapter: number, verse: number, word: string) {
  return `${book}:${chapter}:${verse}:${word}`;
}

export function useWordRefs() {
  const [refs, setRefs] = useState<WordRef[]>([]);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    async function load() {
      if (import.meta.env.DEV) {
        try {
          const res = await fetch(`${CMS_BASE}/file/word-refs.json`);
          if (res.ok) {
            const data = await res.json();
            setRefs(data.refs ?? []);
            setCanEdit(true);
            return;
          } else if (res.status === 404) {
            // Server is running but file doesn't exist yet — allow saves
            setCanEdit(true);
            return;
          }
        } catch {
          // CMS server not running — fall through to static file
        }
      }
      // Static fallback: in dev, served from /content/; in prod, from /content/ (copied by build)
      try {
        const res = await fetch('/content/word-refs.json');
        if (res.ok) {
          const data = await res.json();
          setRefs(data.refs ?? []);
        }
      } catch {
        // No file yet — fine, start with empty refs
      }
    }
    load();
  }, []);

  const getRef = useCallback(
    (book: string, chapter: number, verse: number, word: string): WordRef | null =>
      refs.find(r => refKey(r.book, r.chapter, r.verse, r.word) === refKey(book, chapter, verse, word)) ?? null,
    [refs]
  );

  const saveRef = useCallback(async (ref: WordRef): Promise<boolean> => {
    const k = refKey(ref.book, ref.chapter, ref.verse, ref.word);
    const hasLinks = !!(ref.strongs || ref.geoEventId || ref.confessionRef);
    const nextRefs = [
      ...refs.filter(r => refKey(r.book, r.chapter, r.verse, r.word) !== k),
      ...(hasLinks ? [ref] : []),
    ];
    try {
      const res = await fetch(`${CMS_BASE}/file/word-refs.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: JSON.stringify({ refs: nextRefs }, null, 2) }),
      });
      if (res.ok) {
        setRefs(nextRefs);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [refs]);

  return { getRef, saveRef, canEdit };
}
