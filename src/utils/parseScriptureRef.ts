const BOOK_NAME_TO_ID: Record<string, string> = {
  'genesis': 'GEN', 'gen': 'GEN',
  'exodus': 'EXO', 'exo': 'EXO',
  'leviticus': 'LEV', 'lev': 'LEV',
  'numbers': 'NUM', 'num': 'NUM',
  'deuteronomy': 'DEU', 'deut': 'DEU',
  'joshua': 'JOS', 'josh': 'JOS',
  'judges': 'JDG', 'judg': 'JDG',
  'ruth': 'RUT',
  '1 samuel': '1SA', '1samuel': '1SA', '1sa': '1SA',
  '2 samuel': '2SA', '2samuel': '2SA', '2sa': '2SA',
  '1 kings': '1KI', '1kings': '1KI', '1ki': '1KI',
  '2 kings': '2KI', '2kings': '2KI', '2ki': '2KI',
  '1 chronicles': '1CH', '1chronicles': '1CH', '1ch': '1CH',
  '2 chronicles': '2CH', '2chronicles': '2CH', '2ch': '2CH',
  'ezra': 'EZR',
  'nehemiah': 'NEH', 'neh': 'NEH',
  'esther': 'EST', 'est': 'EST',
  'job': 'JOB',
  'psalms': 'PSA', 'psalm': 'PSA', 'psa': 'PSA', 'ps': 'PSA',
  'proverbs': 'PRO', 'prov': 'PRO', 'pro': 'PRO',
  'ecclesiastes': 'ECC', 'eccl': 'ECC', 'ecc': 'ECC',
  'song of solomon': 'SNG', 'song of songs': 'SNG', 'song': 'SNG', 'sng': 'SNG',
  'isaiah': 'ISA', 'isa': 'ISA',
  'jeremiah': 'JER', 'jer': 'JER',
  'lamentations': 'LAM', 'lam': 'LAM',
  'ezekiel': 'EZK', 'ezek': 'EZK', 'ezk': 'EZK',
  'daniel': 'DAN', 'dan': 'DAN',
  'hosea': 'HOS', 'hos': 'HOS',
  'joel': 'JOL', 'jol': 'JOL',
  'amos': 'AMO', 'amo': 'AMO',
  'obadiah': 'OBA', 'oba': 'OBA',
  'jonah': 'JON', 'jon': 'JON',
  'micah': 'MIC', 'mic': 'MIC',
  'nahum': 'NAH', 'nah': 'NAH',
  'habakkuk': 'HAB', 'hab': 'HAB',
  'zephaniah': 'ZEP', 'zep': 'ZEP',
  'haggai': 'HAG', 'hag': 'HAG',
  'zechariah': 'ZEC', 'zech': 'ZEC', 'zec': 'ZEC',
  'malachi': 'MAL', 'mal': 'MAL',
  'matthew': 'MAT', 'matt': 'MAT', 'mat': 'MAT',
  'mark': 'MRK', 'mrk': 'MRK',
  'luke': 'LUK', 'luk': 'LUK',
  'john': 'JHN', 'jhn': 'JHN',
  'acts': 'ACT', 'act': 'ACT',
  'romans': 'ROM', 'rom': 'ROM',
  '1 corinthians': '1CO', '1corinthians': '1CO', '1cor': '1CO', '1co': '1CO',
  '2 corinthians': '2CO', '2corinthians': '2CO', '2cor': '2CO', '2co': '2CO',
  'galatians': 'GAL', 'gal': 'GAL',
  'ephesians': 'EPH', 'eph': 'EPH',
  'philippians': 'PHP', 'phil': 'PHP', 'php': 'PHP',
  'colossians': 'COL', 'col': 'COL',
  '1 thessalonians': '1TH', '1thessalonians': '1TH', '1thess': '1TH', '1th': '1TH',
  '2 thessalonians': '2TH', '2thessalonians': '2TH', '2thess': '2TH', '2th': '2TH',
  '1 timothy': '1TI', '1timothy': '1TI', '1tim': '1TI', '1ti': '1TI',
  '2 timothy': '2TI', '2timothy': '2TI', '2tim': '2TI', '2ti': '2TI',
  'titus': 'TIT', 'tit': 'TIT',
  'philemon': 'PHM', 'phlm': 'PHM', 'phm': 'PHM',
  'hebrews': 'HEB', 'heb': 'HEB',
  'james': 'JAS', 'jas': 'JAS',
  '1 peter': '1PE', '1peter': '1PE', '1pet': '1PE', '1pe': '1PE',
  '2 peter': '2PE', '2peter': '2PE', '2pet': '2PE', '2pe': '2PE',
  '1 john': '1JN', '1john': '1JN', '1jn': '1JN',
  '2 john': '2JN', '2john': '2JN', '2jn': '2JN',
  '3 john': '3JN', '3john': '3JN', '3jn': '3JN',
  'jude': 'JUD', 'jud': 'JUD',
  'revelation': 'REV', 'rev': 'REV',
};

export interface ParsedScriptureRef {
  bookId: string;
  chapter: number;
}

export function parseScriptureRef(ref: string): ParsedScriptureRef | null {
  if (!ref) return null;

  // Normalize: trim, collapse whitespace
  const normalized = ref.trim().replace(/\s+/g, ' ');

  // Try multi-word book names first (e.g. "1 Corinthians 1:1", "Song of Solomon 1")
  // Pattern: optional leading digit + space + word(s) + space + chapter number
  const match = normalized.match(/^(\d\s\w[\w\s]*?|[A-Za-z][\w\s]*?)\s+(\d+)/);
  if (!match) return null;

  const bookName = match[1].toLowerCase().trim();
  const chapter = parseInt(match[2], 10);

  // Try exact match first, then prefix match
  if (BOOK_NAME_TO_ID[bookName]) {
    return { bookId: BOOK_NAME_TO_ID[bookName], chapter };
  }

  // Try prefix matching for multi-word books
  for (const [name, id] of Object.entries(BOOK_NAME_TO_ID)) {
    if (bookName.startsWith(name) || name.startsWith(bookName)) {
      return { bookId: id, chapter };
    }
  }

  return null;
}

const ROMAN_VALUES: [string, number][] = [
  ['M', 1000], ['CM', 900], ['D', 500], ['CD', 400],
  ['C', 100], ['XC', 90], ['L', 50], ['XL', 40],
  ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1],
];

export function romanToInt(roman: string): number {
  let result = 0;
  let str = roman.toUpperCase();
  for (const [numeral, value] of ROMAN_VALUES) {
    while (str.startsWith(numeral)) {
      result += value;
      str = str.slice(numeral.length);
    }
  }
  return result;
}

export function parseWcfChapter(section: string): number | null {
  // Matches "Chapter II", "Chapter XXXIII", "Chapter XI, §1", etc.
  const match = section.match(/Chapter\s+([IVXLCDM]+)/i);
  if (!match) return null;
  const n = romanToInt(match[1]);
  return n > 0 ? n : null;
}
