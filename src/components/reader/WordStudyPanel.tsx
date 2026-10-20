import type { StrongsEntry } from '../../utils/resourceLoader';

/** A word of the KJV with the Strong's number the source gives it. */
export interface TaggedWord {
  word: string;
  number: string;
}

interface WordStudyPanelProps {
  /** The verse's tagged words (from the KJV); undefined while the KJV's book loads. */
  words: TaggedWord[] | undefined;
  /** Index into `words` of the word being studied, if any. */
  focus: number | null;
  /** The word that was clicked, if any. */
  clickedWord: string | null;
  /** Whether the text being read is the KJV, whose tagging this is. */
  readingKjv: boolean;
  /** The translation being read, e.g. "BSB". */
  abbreviation: string;
  lexicon: Map<string, StrongsEntry>;
  lexiconLoading: boolean;
  /** How often each number occurs in the KJV's text of this book. */
  usesInBook: (number: string) => number;
  bookName: string;
  onFocus: (index: number) => void;
}

function EntryCard({ entry, number, kjvWord, uses, bookName }: {
  entry: StrongsEntry | undefined; number: string; kjvWord: string; uses: number; bookName: string;
}) {
  const hebrew = number.startsWith('H');
  return (
    <div className="strongs-card">
      <div className="strongs-head">
        <span className="strongs-number">{number}</span>
        {entry?.lemma && <span className="strongs-lemma" lang={hebrew ? 'hbo' : 'grc'} dir={hebrew ? 'rtl' : undefined}>{entry.lemma}</span>}
        {entry?.transliteration && <span className="strongs-translit">{entry.transliteration}</span>}
      </div>
      {!entry ? (
        <div className="insight-note">{number} isn't in the STEPBible lexicon.</div>
      ) : (
        <>
          {entry.partOfSpeech && <span className="strongs-pos">{entry.partOfSpeech}</span>}
          {entry.gloss && <div className="strongs-gloss">{entry.gloss}</div>}
          {entry.definition ? (
            <div className="strongs-definition">{entry.definition}</div>
          ) : hebrew && (
            <div className="insight-small">Full Hebrew definitions aren't available yet.</div>
          )}
        </>
      )}
      <div className="insight-small">
        The KJV renders it here as <em>“{kjvWord}”</em>
        {uses > 1 && <> · {uses} times in {bookName}</>}
      </div>
    </div>
  );
}

/** The Hebrew or Greek words behind a verse, from the KJV's Strong's numbers. */
export function WordStudyPanel({
  words, focus, clickedWord, readingKjv, abbreviation, lexicon, lexiconLoading, usesInBook, bookName, onFocus,
}: WordStudyPanelProps) {
  if (!words || lexiconLoading) {
    return <div className="insight-body"><div className="insight-note">Loading the lexicon…</div></div>;
  }
  const focused = focus === null ? undefined : words[focus];

  return (
    <div className="insight-body">
      <div className="insight-label" style={{ color: 'var(--accent-exe)' }}>
        Strong's{clickedWord ? ` — “${clickedWord}”` : ''}
      </div>

      {!readingKjv && (
        <p className="insight-intro">
          The {abbreviation} isn't tagged with Strong's numbers. These are the original-language words of this verse as the KJV tags them
          {focused ? <>; “{clickedWord}” looks like the KJV's “{focused.word}”.</> : '.'}
        </p>
      )}

      {focused ? (
        <EntryCard entry={lexicon.get(focused.number)} number={focused.number} kjvWord={focused.word} uses={usesInBook(focused.number)} bookName={bookName} />
      ) : readingKjv && clickedWord && (
        <div className="insight-note">
          “{clickedWord}” has no Strong's number in the KJV. Words the translators supplied (printed in italics in the KJV)
          and some small words don't stand for a Hebrew or Greek word of their own.
        </div>
      )}

      {words.length === 0 ? (
        <div className="insight-note">No words in this verse carry a Strong's number.</div>
      ) : (
        <>
          <div className="insight-sublabel">Words in this verse</div>
          <ul className="word-list">
            {words.map((w, i) => {
              const entry = lexicon.get(w.number);
              return (
                <li key={i}>
                  <button
                    type="button"
                    className={`word-row${i === focus ? ' active' : ''}`}
                    onClick={() => onFocus(i)}
                    aria-pressed={i === focus}
                  >
                    <span className="word-row-kjv">{w.word}</span>
                    <span className="word-row-number">{w.number}</span>
                    <span className="word-row-lemma" lang={w.number.startsWith('H') ? 'hbo' : 'grc'}>{entry?.lemma ?? ''}</span>
                    <span className="word-row-gloss">{entry?.gloss ?? ''}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className="insight-credit">
        Strong's numbers: the KJV's word tagging (eBible.org). Lexicon: STEP Bible (<a href="https://www.STEPBible.org" target="_blank" rel="noreferrer">www.STEPBible.org</a>), CC BY 4.0.
      </div>
    </div>
  );
}
