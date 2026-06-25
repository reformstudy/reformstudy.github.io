#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.join(__dirname, '..');
const RES_DIR = path.join(REPO_ROOT, 'res');

const BOOKS = [
  { id: 'GEN', names: ['genesis', 'gen'], testament: 'OT', chapters: 50 },
  { id: 'EXO', names: ['exodus', 'exo', 'exod'], testament: 'OT', chapters: 40 },
  { id: 'LEV', names: ['leviticus', 'lev', 'levit'], testament: 'OT', chapters: 27 },
  { id: 'NUM', names: ['numbers', 'num', 'nu', 'nm'], testament: 'OT', chapters: 36 },
  { id: 'DEU', names: ['deuteronomy', 'deut', 'deu', 'dt'], testament: 'OT', chapters: 34 },
  { id: 'JOS', names: ['joshua', 'josh', 'jos'], testament: 'OT', chapters: 24 },
  { id: 'JDG', names: ['judges', 'judg', 'jdg', 'jg'], testament: 'OT', chapters: 21 },
  { id: 'RUT', names: ['ruth', 'rut'], testament: 'OT', chapters: 4 },
  { id: '1SA', names: ['1 samuel', '1samuel', 'i samuel', '1 sam', '1sam'], testament: 'OT', chapters: 31 },
  { id: '2SA', names: ['2 samuel', '2samuel', 'ii samuel', '2 sam', '2sam'], testament: 'OT', chapters: 24 },
  { id: '1KI', names: ['1 kings', '1kings', 'i kings', '1 kgs', '1kgs'], testament: 'OT', chapters: 22 },
  { id: '2KI', names: ['2 kings', '2kings', 'ii kings', '2 kgs', '2kgs'], testament: 'OT', chapters: 25 },
  { id: '1CH', names: ['1 chronicles', '1chronicles', 'i chronicles', '1 chr', '1chr'], testament: 'OT', chapters: 29 },
  { id: '2CH', names: ['2 chronicles', '2chronicles', 'ii chronicles', '2 chr', '2chr'], testament: 'OT', chapters: 36 },
  { id: 'EZR', names: ['ezra', 'ezr'], testament: 'OT', chapters: 10 },
  { id: 'NEH', names: ['nehemiah', 'neh'], testament: 'OT', chapters: 13 },
  { id: 'EST', names: ['esther', 'esth', 'est'], testament: 'OT', chapters: 10 },
  { id: 'JOB', names: ['job'], testament: 'OT', chapters: 42 },
  { id: 'PSA', names: ['psalms', 'psalm', 'psa', 'ps'], testament: 'OT', chapters: 150 },
  { id: 'PRO', names: ['proverbs', 'prov', 'pro'], testament: 'OT', chapters: 31 },
  { id: 'ECC', names: ['ecclesiastes', 'eccl', 'ecc'], testament: 'OT', chapters: 12 },
  { id: 'SNG', names: ['song of solomon', 'song of songs', 'song', 'songs', 'song of solomon', 'ss'], testament: 'OT', chapters: 8 },
  { id: 'ISA', names: ['isaiah', 'isa'], testament: 'OT', chapters: 66 },
  { id: 'JER', names: ['jeremiah', 'jer'], testament: 'OT', chapters: 52 },
  { id: 'LAM', names: ['lamentations', 'lam'], testament: 'OT', chapters: 5 },
  { id: 'EZK', names: ['ezekiel', 'ezek', 'ezk'], testament: 'OT', chapters: 48 },
  { id: 'DAN', names: ['daniel', 'dan'], testament: 'OT', chapters: 12 },
  { id: 'HOS', names: ['hosea', 'hos'], testament: 'OT', chapters: 14 },
  { id: 'JOL', names: ['joel', 'jol'], testament: 'OT', chapters: 3 },
  { id: 'AMO', names: ['amos', 'amo'], testament: 'OT', chapters: 9 },
  { id: 'OBA', names: ['obadiah', 'obad', 'oba'], testament: 'OT', chapters: 1 },
  { id: 'JON', names: ['jonah', 'jon'], testament: 'OT', chapters: 4 },
  { id: 'MIC', names: ['micah', 'mic'], testament: 'OT', chapters: 7 },
  { id: 'NAM', names: ['nahum', 'nah'], testament: 'OT', chapters: 3 },
  { id: 'HAB', names: ['habakkuk', 'hab'], testament: 'OT', chapters: 3 },
  { id: 'ZEP', names: ['zephaniah', 'zeph', 'zep'], testament: 'OT', chapters: 3 },
  { id: 'HAG', names: ['haggai', 'hag'], testament: 'OT', chapters: 2 },
  { id: 'ZEC', names: ['zechariah', 'zech', 'zec'], testament: 'OT', chapters: 14 },
  { id: 'MAL', names: ['malachi', 'mal'], testament: 'OT', chapters: 4 },
  { id: 'MAT', names: ['matthew', 'matt', 'mat'], testament: 'NT', chapters: 28 },
  { id: 'MRK', names: ['mark', 'mrk', 'mar'], testament: 'NT', chapters: 16 },
  { id: 'LUK', names: ['luke', 'luk'], testament: 'NT', chapters: 24 },
  { id: 'JHN', names: ['john', 'jn', 'joh'], testament: 'NT', chapters: 21 },
  { id: 'ACT', names: ['acts', 'act'], testament: 'NT', chapters: 28 },
  { id: 'ROM', names: ['romans', 'rom'], testament: 'NT', chapters: 16 },
  { id: '1CO', names: ['1 corinthians', '1corinthians', 'i corinthians', '1 cor', '1cor'], testament: 'NT', chapters: 16 },
  { id: '2CO', names: ['2 corinthians', '2corinthians', 'ii corinthians', '2 cor', '2cor'], testament: 'NT', chapters: 13 },
  { id: 'GAL', names: ['galatians', 'gal'], testament: 'NT', chapters: 6 },
  { id: 'EPH', names: ['ephesians', 'eph'], testament: 'NT', chapters: 6 },
  { id: 'PHP', names: ['philippians', 'php', 'phil'], testament: 'NT', chapters: 4 },
  { id: 'COL', names: ['colossians', 'col'], testament: 'NT', chapters: 4 },
  { id: '1TH', names: ['1 thessalonians', '1thessalonians', 'i thessalonians', '1 thes', '1thes'], testament: 'NT', chapters: 5 },
  { id: '2TH', names: ['2 thessalonians', '2thessalonians', 'ii thessalonians', '2 thes', '2thes'], testament: 'NT', chapters: 3 },
  { id: '1TI', names: ['1 timothy', '1timothy', 'i timothy', '1 tim', '1tim'], testament: 'NT', chapters: 6 },
  { id: '2TI', names: ['2 timothy', '2timothy', 'ii timothy', '2 tim', '2tim'], testament: 'NT', chapters: 4 },
  { id: 'TIT', names: ['titus', 'tit'], testament: 'NT', chapters: 3 },
  { id: 'PHM', names: ['philemon', 'phlm', 'phm'], testament: 'NT', chapters: 1 },
  { id: 'HEB', names: ['hebrews', 'heb'], testament: 'NT', chapters: 13 },
  { id: 'JAS', names: ['james', 'jas'], testament: 'NT', chapters: 5 },
  { id: '1PE', names: ['1 peter', '1peter', 'i peter', '1 pet', '1pet'], testament: 'NT', chapters: 5 },
  { id: '2PE', names: ['2 peter', '2peter', 'ii peter', '2 pet', '2pet'], testament: 'NT', chapters: 3 },
  { id: '1JN', names: ['1 john', '1john', 'i john', '1 jn', '1jn'], testament: 'NT', chapters: 5 },
  { id: '2JN', names: ['2 john', '2john', 'ii john', '2 jn', '2jn'], testament: 'NT', chapters: 1 },
  { id: '3JN', names: ['3 john', '3john', 'iii john', '3 jn', '3jn'], testament: 'NT', chapters: 1 },
  { id: 'JUD', names: ['jude'], testament: 'NT', chapters: 1 },
  { id: 'REV', names: ['revelation', 'rev', 'revel'], testament: 'NT', chapters: 22 }
];

const BOOK_NAME_TO_ID = BOOKS.reduce((map, book) => {
  book.names.forEach(name => {
    map[name.replace(/\s+/g, '').toLowerCase()] = book.id;
  });
  return map;
}, {});

function printUsage() {
  console.log('Convert raw text into ReformStudy JSON resource files.');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/convert-text-to-json.js --type <bible|confession|commentary|strongs> --input <file> --id <resource-id> [options]');
  console.log('');
  console.log('Common options:');
  console.log('  --type <type>              Resource type to create');
  console.log('  --input <file>             Raw source text file');
  console.log('  --id <id>                  Output resource ID and filename');
  console.log('  --output <file>            Output JSON file path (default: res/{type}/{id}.json)');
  console.log('  --preview                  Print parsed JSON to stdout instead of writing a file');
  console.log('  --separator <string>       Custom field separator for Strong\'s imports (tab, |, comma)');
  console.log('  --help                     Show this message');
  console.log('');
  console.log('Type-specific options:');
  console.log('  Bible: --name --abbreviation --language --releaseDate --copyright --description');
  console.log('  Confession: --name --abbreviation --year --origin --description --chapters');
  console.log('  Commentary: --name --author --book --published --description');
  console.log('  Strongs: --name --language --version --description');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/convert-text-to-json.js --type bible --input raw/kjv.txt --id kjv --name "King James Version" --abbreviation KJV --language en --releaseDate 1611 --copyright "Public Domain" --description "..."');
  console.log('  node scripts/convert-text-to-json.js --type commentary --input raw/matthew-gill.txt --id matthew-gill --name "John Gill\'s Exposition" --author "John Gill" --book MAT --published 1746 --description "..."');
  console.log('');
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    if (key === 'help' || key === 'preview') {
      options[key] = true;
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    index += 1;
  }
  return options;
}

function normalizeBookName(name) {
  if (!name) return null;
  return name.replace(/\./g, '').replace(/\s+/g, '').toLowerCase();
}

function resolveBibleBookId(bookName) {
  if (!bookName) return null;
  const normalized = normalizeBookName(bookName);
  return BOOK_NAME_TO_ID[normalized] || null;
}

function splitValue(text) {
  const separators = [' - ', ' – ', ' — ', ' | ', ' || ', '\t'];
  for (const separator of separators) {
    if (text.includes(separator)) {
      return text.split(separator).map(part => part.trim());
    }
  }
  return [text.trim()];
}

function parseBibleText(content) {
  const lines = content.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
  const verseIndex = new Map();
  let currentBookId = null;

  lines.forEach(line => {
    if (line.startsWith('#') || line.startsWith('//')) return;

    const fullRef = line.match(/^([1-3]?\s*[A-Za-z]+)\s+(\d+):(\d+)\s+(.+)$/i);
    const shortRef = line.match(/^(\d+):(\d+)\s+(.+)$/);

    let bookId = null;
    let chapter = null;
    let verse = null;
    let text = null;

    if (fullRef) {
      bookId = resolveBibleBookId(fullRef[1]);
      chapter = Number(fullRef[2]);
      verse = Number(fullRef[3]);
      text = fullRef[4].trim();
    } else if (shortRef && currentBookId) {
      bookId = currentBookId;
      chapter = Number(shortRef[1]);
      verse = Number(shortRef[2]);
      text = shortRef[3].trim();
    }

    if (!bookId || !text) {
      return;
    }

    currentBookId = bookId;

    const key = `${bookId}|${chapter}|${verse}`;
    verseIndex.set(key, {
      book: bookId,
      chapter,
      verse,
      text
    });
  });

  const books = BOOKS.reduce((acc, book) => {
    const verses = Array.from(verseIndex.values())
      .filter(v => v.book === book.id)
      .sort((a, b) => a.chapter - b.chapter || a.verse - b.verse);

    if (verses.length === 0) return acc;

    acc.push({
      id: book.id,
      name: book.names[0].replace(/\b\w/g, c => c.toUpperCase()),
      testament: book.testament,
      chapters: book.chapters,
      verses
    });
    return acc;
  }, []);

  return books;
}

function parseConfessionText(content) {
  const lines = content.split(/\r?\n/);
  const sections = [];
  let currentChapter = null;

  function commitChapter() {
    if (currentChapter) {
      sections.push(currentChapter);
      currentChapter = null;
    }
  }

  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const chapterMatch = line.match(/^(?:chapter\s+)?(\d+)(?:[\.:\-]\s*)?(.*)$/i);
    const sectionMatch = line.match(/^(\d+\.\d+)\s+(.+)$/);

    if (chapterMatch && !sectionMatch && /^chapter\s+/i.test(line)) {
      commitChapter();
      currentChapter = {
        chapter: Number(chapterMatch[1]),
        title: chapterMatch[2].trim() || '',
        sections: []
      };
      continue;
    }

    if (sectionMatch && currentChapter) {
      currentChapter.sections.push({
        number: sectionMatch[1],
        content: sectionMatch[2].trim()
      });
      continue;
    }

    if (currentChapter && currentChapter.sections.length > 0) {
      const last = currentChapter.sections[currentChapter.sections.length - 1];
      last.content = `${last.content} ${line}`;
      continue;
    }

    if (currentChapter && !currentChapter.title) {
      currentChapter.title = line;
      continue;
    }
  }

  commitChapter();
  return sections;
}

function parseCommentaryText(content) {
  const lines = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const entries = [];
  let currentBookId = null;

  lines.forEach(line => {
    if (line.startsWith('#') || line.startsWith('//')) return;

    const fullRef = line.match(/^([1-3]?\s*[A-Za-z]+)\s+(\d+):(\d+)\s+(.+)$/i);
    const shortRef = line.match(/^(\d+):(\d+)\s+(.+)$/);

    let bookId = null;
    let chapter = null;
    let verse = null;
    let remaining = null;

    if (fullRef) {
      bookId = resolveBibleBookId(fullRef[1]);
      chapter = Number(fullRef[2]);
      verse = Number(fullRef[3]);
      remaining = fullRef[4].trim();
    } else if (shortRef && currentBookId) {
      bookId = currentBookId;
      chapter = Number(shortRef[1]);
      verse = Number(shortRef[2]);
      remaining = shortRef[3].trim();
    }

    if (!bookId || !remaining) {
      return;
    }

    currentBookId = bookId;
    const parts = splitValue(remaining);
    const [verseText, commentaryText] = parts.length >= 2 ? [parts[0], parts.slice(1).join(' - ')] : ['', parts[0]];

    entries.push({
      book: bookId,
      chapter,
      verse,
      text: verseText,
      commentary: commentaryText
    });
  });

  return entries;
}

function parseStrongsText(content, separatorHint) {
  const lines = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const entries = [];
  const customSeparator = separatorHint
    ? separatorHint === 'tab'
      ? '\t'
      : separatorHint
    : null;

  lines.forEach(line => {
    if (line.startsWith('#') || line.startsWith('//')) return;

    const row = customSeparator
      ? line.split(customSeparator).map(chunk => chunk.trim())
      : line.includes('|')
      ? line.split('|').map(chunk => chunk.trim())
      : line.split(/\s{2,}/).map(chunk => chunk.trim());

    const inlineMatch = line.match(/^([GH]\d+)\s+(\S+)\s+(\S+)\s+(.+)$/i);
    if (row.length >= 2) {
      const [number, transliteration, pronunciation, partOfSpeech, definition, kjvDefinition, usageCount] = row;
      entries.push({
        number: number || '',
        transliteration: transliteration || '',
        pronunciation: pronunciation || '',
        partOfSpeech: partOfSpeech || '',
        definition: definition || '',
        kjvDefinition: kjvDefinition || '',
        usageCount: Number(usageCount) || 0,
        references: []
      });
      return;
    }

    if (inlineMatch) {
      entries.push({
        number: inlineMatch[1],
        transliteration: inlineMatch[2],
        pronunciation: inlineMatch[3],
        partOfSpeech: '',
        definition: inlineMatch[4],
        kjvDefinition: '',
        usageCount: 0,
        references: []
      });
    }
  });

  return entries;
}

function buildBibleResource(options, content) {
  const required = ['name', 'abbreviation', 'language', 'releaseDate', 'copyright', 'description'];
  required.forEach(key => {
    if (!options[key]) {
      throw new Error(`Missing required Bible metadata: ${key}`);
    }
  });
  const books = parseBibleText(content);
  if (books.length === 0) {
    throw new Error('No Bible verses were parsed from the input file. Check the input formatting.');
  }
  return {
    version: {
      id: options.id,
      name: options.name,
      abbreviation: options.abbreviation,
      language: options.language,
      releaseDate: options.releaseDate,
      copyright: options.copyright,
      description: options.description
    },
    books
  };
}

function buildConfessionResource(options, content) {
  const required = ['name', 'abbreviation', 'year', 'origin', 'description', 'chapters'];
  required.forEach(key => {
    if (!options[key]) {
      throw new Error(`Missing required Confession metadata: ${key}`);
    }
  });

  const sections = parseConfessionText(content);
  if (sections.length === 0) {
    throw new Error('No confession sections were parsed from the input file. Check the input formatting.');
  }

  return {
    confession: {
      id: options.id,
      name: options.name,
      abbreviation: options.abbreviation,
      year: Number(options.year),
      origin: options.origin,
      description: options.description,
      chapters: Number(options.chapters)
    },
    sections
  };
}

function buildCommentaryResource(options, content) {
  const required = ['name', 'author', 'book', 'published', 'description'];
  required.forEach(key => {
    if (!options[key]) {
      throw new Error(`Missing required Commentary metadata: ${key}`);
    }
  });

  const entries = parseCommentaryText(content);
  if (entries.length === 0) {
    throw new Error('No commentary entries were parsed from the input file. Check the input formatting.');
  }

  return {
    commentary: {
      id: options.id,
      name: options.name,
      author: options.author,
      book: options.book,
      published: Number(options.published),
      description: options.description
    },
    entries
  };
}

function buildStrongsResource(options, content) {
  const required = ['name', 'language', 'version'];
  required.forEach(key => {
    if (!options[key]) {
      throw new Error(`Missing required Strong's metadata: ${key}`);
    }
  });

  const entries = parseStrongsText(content, options.separator);
  if (entries.length === 0) {
    throw new Error('No Strong\'s entries were parsed from the input file. Check the input formatting.');
  }

  return {
    concordance: {
      id: options.id,
      name: options.name,
      language: options.language,
      totalEntries: entries.length,
      version: options.version
    },
    entries
  };
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !options.type) {
    printUsage();
    process.exit(options.help ? 0 : 1);
  }

  const sourcePath = options.input;
  if (!sourcePath) {
    throw new Error('Missing --input path.');
  }

  const absoluteSourcePath = path.isAbsolute(sourcePath) ? sourcePath : path.join(REPO_ROOT, sourcePath);
  if (!fs.existsSync(absoluteSourcePath)) {
    throw new Error(`Input file not found: ${absoluteSourcePath}`);
  }

  if (!options.id) {
    throw new Error('Missing --id.');
  }

  const rawText = fs.readFileSync(absoluteSourcePath, 'utf8');
  let resource = null;

  switch (options.type) {
    case 'bible':
      resource = buildBibleResource(options, rawText);
      break;
    case 'confession':
      resource = buildConfessionResource(options, rawText);
      break;
    case 'commentary':
      resource = buildCommentaryResource(options, rawText);
      break;
    case 'strongs':
      resource = buildStrongsResource(options, rawText);
      break;
    default:
      throw new Error(`Unsupported type: ${options.type}`);
  }

  const outputPath = options.output
    ? path.isAbsolute(options.output)
      ? options.output
      : path.join(REPO_ROOT, options.output)
    : path.join(RES_DIR, `${options.type}s`, `${options.id}.json`);

  if (options.preview) {
    console.log(JSON.stringify(resource, null, 2));
    return;
  }

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(resource, null, 2) + '\n', 'utf8');
  console.log(`✓ Converted ${options.type} raw text to ${outputPath}`);
}

run().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
