import type { CommentaryBookIntroduction, CommentaryChapter, CommentaryParagraph } from '../../utils/resourceLoader';
import { LinkedText } from './LinkedText';

interface HenryPanelProps {
  /** The chapter's commentary; undefined while loading, null if Henry has none for it. */
  chapter: CommentaryChapter | null | undefined;
  /** Henry's introduction to the book, if he wrote one and it has loaded. */
  bookIntroduction?: CommentaryBookIntroduction;
  bookName: string;
  verse: { chapter: number; verse: number };
}

function Paragraph({ p }: { p: CommentaryParagraph }) {
  const className = p.heading ? 'henry-heading' : p.poetry ? 'henry-poetry' : p.attribution ? 'henry-attribution' : 'henry-paragraph';
  return (
    <p className={className}>
      <LinkedText text={p.text} refs={p.refs} />
    </p>
  );
}

/** Matthew Henry's comment on the passage that holds the selected verse. */
export function HenryPanel({ chapter, bookIntroduction, bookName, verse }: HenryPanelProps) {
  if (chapter === undefined) {
    return <div className="insight-body"><div className="insight-note">Loading Matthew Henry…</div></div>;
  }
  if (chapter === null) {
    return (
      <div className="insight-body">
        <div className="insight-note">Matthew Henry has no comment on {bookName} {verse.chapter}.</div>
      </div>
    );
  }

  const sections = chapter.sections.filter(s => s.start <= verse.verse && verse.verse <= s.end);
  return (
    <div className="insight-body">
      <div className="insight-label" style={{ color: 'var(--accent-theo)' }}>
        Matthew Henry — {bookName} {verse.chapter}:{verse.verse}
      </div>

      {sections.length === 0 && (
        <div className="insight-note">Henry passes over {bookName} {verse.chapter}:{verse.verse} without comment.</div>
      )}

      {sections.map(s => (
        <section key={`${s.start}-${s.end}`} className="henry-section">
          <div className="henry-range">
            {s.start === s.end ? `Verse ${s.start}` : `Verses ${s.start}–${s.end}`}
          </div>
          {s.title && <h3 className="henry-title">{s.title}</h3>}
          {s.paragraphs.map((p, i) => <Paragraph key={i} p={p} />)}
        </section>
      ))}

      {!!chapter.introduction?.length && (
        <details className="henry-intro">
          <summary>Henry's introduction to {bookName} {verse.chapter}</summary>
          {chapter.introduction.map((p, i) => <Paragraph key={i} p={p} />)}
        </details>
      )}

      {!!bookIntroduction?.paragraphs.length && (
        <details className="henry-intro">
          <summary>Henry's introduction to {bookName}</summary>
          {bookIntroduction.paragraphs.map((p, i) => <Paragraph key={i} p={p} />)}
        </details>
      )}

      <div className="insight-credit">
        Matthew Henry, <em>Commentary on the Whole Bible</em> (1708–1710), from the Christian Classics Ethereal Library.
      </div>
    </div>
  );
}
