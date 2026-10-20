import { Link } from 'react-router-dom';
import { ScrollText } from 'lucide-react';
import type { Citation } from '../../utils/confessionCitations';
import { formatRef } from '../../utils/scriptureRefs';

interface CitationsPanelProps {
  citations: Citation[];
  /** The confession's id and abbreviation, e.g. "wcf", "WCF". */
  confessionId: string;
  abbreviation: string;
  loading: boolean;
  verseLabel: string;
  bookName: (id: string) => string;
}

/** Where the confession cites the selected verse as a proof text. */
export function CitationsPanel({ citations, confessionId, abbreviation, loading, verseLabel, bookName }: CitationsPanelProps) {
  if (loading) {
    return <div className="insight-body"><div className="insight-note">Loading the Westminster Confession…</div></div>;
  }
  return (
    <div className="insight-body">
      <div className="insight-label" style={{ color: 'var(--accent-theo)' }}>
        Westminster Confession proof texts
      </div>
      {citations.length === 0 ? (
        <div className="insight-note">The Westminster Confession doesn't cite {verseLabel} among its proof texts.</div>
      ) : (
        <>
          <p className="insight-intro">
            {abbreviation} cites {verseLabel} {citations.length === 1 ? 'once' : `${citations.length} times`}:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {citations.map(c => (
              <article key={`${c.section}-${c.footnote}-${c.ref}`} className="citation-card">
                <div className="citation-head">
                  <ScrollText size={13} />
                  <span>{abbreviation} {c.section}</span>
                  <span className="citation-chapter">{c.chapterTitle}</span>
                </div>
                <blockquote className="citation-clause">
                  {c.clause}<sup>{c.footnote}</sup>
                </blockquote>
                <div className="citation-foot">
                  <span>Proof: {formatRef(c.parsed, bookName)}</span>
                  <Link to={`/archive/${confessionId}/${c.chapter}/${c.section}`} className="scripture-link">
                    Read §{c.section}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      <div className="insight-credit">
        Westminster Confession of Faith (1647), with its Scripture proofs.
      </div>
    </div>
  );
}
