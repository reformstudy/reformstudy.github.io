import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { parseCompactRef, readerPath } from '../../utils/scriptureRefs';

interface LinkedTextProps {
  text: string;
  /** References cited in the text: each `text` is found in order and linked to the reader. */
  refs?: Array<{ text: string; ref: string }>;
}

/** Text with its Scripture references turned into links to the reader. */
export function LinkedText({ text, refs }: LinkedTextProps) {
  if (!refs?.length) return <>{text}</>;
  const parts: JSX.Element[] = [];
  let cursor = 0;
  refs.forEach((r, i) => {
    const at = text.indexOf(r.text, cursor);
    const parsed = parseCompactRef(r.ref);
    if (at < 0 || !parsed) return;
    if (at > cursor) parts.push(<Fragment key={`t${i}`}>{text.slice(cursor, at)}</Fragment>);
    parts.push(<Link key={`r${i}`} to={readerPath(parsed)} className="scripture-link">{r.text}</Link>);
    cursor = at + r.text.length;
  });
  if (cursor < text.length) parts.push(<Fragment key="end">{text.slice(cursor)}</Fragment>);
  return <>{parts}</>;
}
