/**
 * The test every converted text must pass: it is the source text, verbatim,
 * apart from the exceptions named below.
 *
 * Two checks, on one unit of text at a time (a verse, a paragraph, a field):
 *
 * 1. Characters. With all whitespace removed, the output and the source must
 *    be the same string, character for character: no letter, digit or mark
 *    added, removed, changed or moved.
 * 2. Word breaks. Whitespace may be normalized (runs collapsed, line breaks
 *    turned into spaces, ends trimmed), but there must be a break in the
 *    output exactly where the source has one, so words can't be joined or
 *    split. The only breaks allowed to go are those the exceptions name.
 *
 * Anything a converter changes beyond that is a failure.
 */

/**
 * The named exceptions. Each says what it allows and how, and the
 * authenticator lists which ones a resource uses.
 */
export const EXCEPTIONS = {
  pilcrow: {
    description: 'The KJV prints a pilcrow (¶) at the start of some paragraphs. It is a layout mark, not a word of the text, so it is left out.',
    source: text => text.replace(/¶/g, ' '),
  },
  'punctuation spacing': {
    description: 'Where removing a footnote or marker leaves a space before closing punctuation (,.;:!?’”)) or after opening punctuation (“‘(), the space is dropped.',
    joinBefore: /[,.;:!?’”)]/,
    joinAfter: /[“‘(]/,
  },
  'STEPBible indentation': {
    description: 'STEPBible marks indentation in definitions with "__"; it becomes spaces.',
    source: text => text.replace(/__/g, '  '),
  },
};

/** Text without whitespace, and the positions in it that whitespace came before. */
export function wordStream(text) {
  let chars = '';
  const breaks = new Set();
  let pending = false;
  for (const ch of String(text)) {
    if (/\s/u.test(ch)) {
      pending = chars.length > 0;
      continue;
    }
    if (pending) breaks.add(chars.length);
    pending = false;
    chars += ch;
  }
  return { chars, breaks };
}

const context = (s, i) => `…${s.slice(Math.max(0, i - 25), i)}⟦${s.slice(i, i + 1)}⟧${s.slice(i + 1, i + 25)}…`;

/**
 * Compare one unit. Returns null when the output is the source verbatim
 * (within the exceptions given), or a description of the first difference.
 */
export function compareText(source, output, exceptions = []) {
  for (const name of exceptions) if (!EXCEPTIONS[name]) throw new Error(`Unknown exception "${name}"`);
  let src = String(source ?? '');
  for (const name of exceptions) if (EXCEPTIONS[name].source) src = EXCEPTIONS[name].source(src);
  const a = wordStream(src);
  const b = wordStream(output ?? '');

  if (a.chars !== b.chars) {
    let i = 0;
    while (i < a.chars.length && a.chars[i] === b.chars[i]) i++;
    if (i >= a.chars.length) return `extra text in the output: ${context(b.chars, i)}`;
    if (i >= b.chars.length) return `text missing from the output: ${context(a.chars, i)}`;
    return `text differs: source ${context(a.chars, i)}, output ${context(b.chars, i)}`;
  }

  const spacing = exceptions.includes('punctuation spacing') ? EXCEPTIONS['punctuation spacing'] : null;
  for (const i of b.breaks) {
    if (!a.breaks.has(i)) return `a word is split in the output: ${context(b.chars, i)}`;
  }
  for (const i of a.breaks) {
    if (b.breaks.has(i)) continue;
    const allowed = spacing && (spacing.joinBefore.test(a.chars[i]) || spacing.joinAfter.test(a.chars[i - 1]));
    if (!allowed) return `words are joined in the output: ${context(a.chars, i)}`;
  }
  return null;
}
