import type { StrongsEntry } from '../../utils/resourceLoader';

/** A word or phrase of a translation with the Strong's number its source gives it. */
export interface TaggedWord {
  word: string;
  number: string;
}

interface WordStudyPanelProps {
  /** The verse's tagged words; undefined while the book that has them loads. */
  words: TaggedWord[] | undefined;
  /** Index into `words` of the word being studied, if any. */
  focus: number | null;
  /** The word that was clicked, if any. */
  clickedWord: string | null;
  /** Whether the tags are the translation's own; otherwise they are borrowed from `tagsFrom`. */
  ownTags: boolean;
  /** The translation being read, e.g. "BSB". */
  abbreviation: string;
  /** The translation whose tags are shown, e.g. "KJV". */
  tagsFrom: string;
  /** Where the tags come from, for the credit line, e.g. "the KJV's word tagging (eBible.org)". */
  tagSource: string;
  lexicon: Map<string, StrongsEntry>;
  lexiconLoading: boolean;
  /** How often each number occurs in the KJV's text of this book. */
  usesInBook: (number: string) => number;
  bookName: string;
  onFocus: (index: number) => void;
}

function EntryCard({ entry, number, word, translation, uses, bookName }: {
  entry: StrongsEntry | undefined; number: string; word: string; translation: string; uses: number; bookName: string;
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
        The {translation} renders it here as <em>“{word}”</em>
        {uses > 1 && <> · {uses} times in {bookName}</>}
      </div>
    </div>
  );
}

/** The Hebrew or Greek words behind a verse, from the KJV's Strong's numbers. */
export function WordStudyPanel({
  words, focus, clickedWord, ownTags, abbreviation, tagsFrom, tagSource, lexicon, lexiconLoading, usesInBook, bookName, onFocus,
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

      {!ownTags && (
        <p className="insight-intro">
          The {abbreviation} isn't tagged with Strong's numbers. These are the original-language words of this verse as the {tagsFrom} tags them
          {focused ? <>; “{clickedWord}” looks like the {tagsFrom}'s “{focused.word}”.</> : '.'}
        </p>
      )}

      {focused ? (
        <EntryCard entry={lexicon.get(focused.number)} number={focused.number} word={focused.word} translation={tagsFrom} uses={usesInBook(focused.number)} bookName={bookName} />
      ) : ownTags && clickedWord && (
        <div className="insight-note">
          “{clickedWord}” has no Strong's number in the {abbreviation}. Words the translators supplied
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
                    <span className="word-row-english">{w.word}</span>
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
        Strong's numbers: {tagSource}. Lexicon: STEP Bible (<a href="https://www.STEPBible.org" target="_blank" rel="noreferrer">www.STEPBible.org</a>), CC BY 4.0.
      </div>
    </div>
  );
}
