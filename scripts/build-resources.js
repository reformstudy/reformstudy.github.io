/**
 * Resource Builder
 * 
 * This script processes all resource files (Bibles, commentaries, confessions, etc.)
 * and prepares them for distribution. Resources are validated, optimized, and
 * copied to the output directory where they can be served as static assets.
 * 
 * The SPA will fetch these resources on demand rather than bundling them.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateResources, printReport } from './validate-resources.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RES_DIR = path.join(__dirname, '../res');
const OUTPUT_DIR = path.join(__dirname, '../docs/resources');
const MANIFEST_FILE = path.join(OUTPUT_DIR, 'manifest.json');

/** The first of these that exists becomes the Bible the app opens in. */
const DEFAULT_BIBLE_PREFERENCE = ['bsb', 'kjv'];

/**
 * Ensure output directory exists
 */
function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

/**
 * Process a single resource file
 */
function processResourceFile(filePath, resourceType) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    // Basic validation
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid JSON structure');
    }
    
    return {
      success: true,
      data,
      filePath
    };
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return {
      success: false,
      error: error.message,
      filePath
    };
  }
}

function findJsonFiles(directory) {
  const results = [];
  if (!fs.existsSync(directory)) return results;

  const entries = fs.readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...findJsonFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Process all Bibles
 */
function processBibles() {
  console.log('Processing Bible versions...');
  const biblesDir = path.join(RES_DIR, 'bibles');
  const output = {};
  
  if (!fs.existsSync(biblesDir)) {
    console.warn('Bibles directory not found');
    return output;
  }
  
  const files = findJsonFiles(biblesDir);
  
  files.forEach(filePath => {
    const result = processResourceFile(filePath, 'bible');
    if (result.success) {
      const versionId = result.data.version?.id;
      if (versionId) {
        output[versionId] = result.data;
        console.log(`  ✓ Loaded Bible: ${result.data.version.name}`);
        
        const outputPath = path.join(OUTPUT_DIR, `bible-${versionId}.json`);
        fs.writeFileSync(outputPath, JSON.stringify(result.data));
        writeBibleBooks(versionId, result.data);
      }
    } else {
      console.error(`  ✗ Failed to load ${filePath}: ${result.error}`);
    }
  });
  
  return output;
}

/**
 * Write one file per book plus an index (book list and verse counts, no text),
 * so the reader downloads only the book it shows.
 */
function writeBibleBooks(versionId, bible) {
  const dir = path.join(OUTPUT_DIR, 'bibles', versionId);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const index = {
    version: bible.version,
    books: bible.books.map(({ verses, subtitles, ...meta }) => {
      const verseCounts = new Array(meta.chapters).fill(0);
      for (const v of verses) verseCounts[v.chapter - 1] = Math.max(verseCounts[v.chapter - 1], v.verse);
      return { ...meta, verseCounts };
    }),
  };
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index));
  for (const book of bible.books) {
    fs.writeFileSync(path.join(dir, `${book.id}.json`), JSON.stringify(book));
  }
}

/**
 * Process all Confessions
 */
function processConfessions() {
  console.log('Processing confessions...');
  const confessionsDir = path.join(RES_DIR, 'confessions');
  const output = {};
  
  if (!fs.existsSync(confessionsDir)) {
    console.warn('Confessions directory not found');
    return output;
  }
  
  const files = findJsonFiles(confessionsDir);
  
  files.forEach(filePath => {
    const result = processResourceFile(filePath, 'confession');
    if (result.success) {
      const confessionId = result.data.confession?.id;
      if (confessionId) {
        output[confessionId] = result.data;
        console.log(`  ✓ Loaded Confession: ${result.data.confession.name}`);
        
        const outputPath = path.join(OUTPUT_DIR, `confession-${confessionId}.json`);
        fs.writeFileSync(outputPath, JSON.stringify(result.data));
      }
    } else {
      console.error(`  ✗ Failed to load ${filePath}: ${result.error}`);
    }
  });
  
  return output;
}

/**
 * Process all Commentaries
 */
function processCommentaries() {
  console.log('Processing commentaries...');
  const commentariesDir = path.join(RES_DIR, 'commentaries');
  const output = {};
  
  if (!fs.existsSync(commentariesDir)) {
    console.warn('Commentaries directory not found');
    return output;
  }
  
  const chapteredDirs = fs.readdirSync(commentariesDir, { withFileTypes: true })
    .filter(ent => ent.isDirectory() && fs.existsSync(path.join(commentariesDir, ent.name, 'meta.json')))
    .map(ent => ent.name);

  // Chaptered commentaries are copied as they are: one file per chapter.
  const chapteredOut = path.join(OUTPUT_DIR, 'commentaries');
  fs.rmSync(chapteredOut, { recursive: true, force: true });
  for (const id of chapteredDirs) {
    const src = path.join(commentariesDir, id);
    const meta = JSON.parse(fs.readFileSync(path.join(src, 'meta.json'), 'utf-8'));
    copyJsonTree(src, path.join(chapteredOut, id));
    output[id] = { ...meta, format: 'chapters' };
    const chapterCount = meta.books.reduce((n, b) => n + b.chapters.length, 0);
    console.log(`  ✓ Loaded Commentary: ${meta.commentary.name} (${meta.books.length} books, ${chapterCount} chapters)`);
  }

  const files = chapteredDirs.reduce(
    (list, id) => list.filter(f => !f.startsWith(path.join(commentariesDir, id) + path.sep)),
    findJsonFiles(commentariesDir)
  );
  
  files.forEach(filePath => {
    const result = processResourceFile(filePath, 'commentary');
    if (result.success) {
      const commentaryId = result.data.commentary?.id;
      if (commentaryId) {
        output[commentaryId] = result.data;
        console.log(`  ✓ Loaded Commentary: ${result.data.commentary.name}`);
        
        const outputPath = path.join(OUTPUT_DIR, `commentary-${commentaryId}.json`);
        fs.writeFileSync(outputPath, JSON.stringify(result.data));
      }
    } else {
      console.error(`  ✗ Failed to load ${filePath}: ${result.error}`);
    }
  });
  
  return output;
}

function copyJsonTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, ent.name);
    const to = path.join(dest, ent.name);
    if (ent.isDirectory()) copyJsonTree(from, to);
    else if (ent.name.endsWith('.json')) fs.writeFileSync(to, JSON.stringify(JSON.parse(fs.readFileSync(from, 'utf-8'))));
  }
}

/**
 * Process Strong's Concordances
 */
function processStrongs() {
  console.log('Processing Strong\'s concordances...');
  const strongsDir = path.join(RES_DIR, 'strongs');
  const output = {};
  
  if (!fs.existsSync(strongsDir)) {
    console.warn('Strongs directory not found');
    return output;
  }
  
  const files = findJsonFiles(strongsDir);
  
  files.forEach(filePath => {
    const result = processResourceFile(filePath, 'strongs');
    if (result.success) {
      const concordanceId = result.data.concordance?.id;
      if (concordanceId) {
        output[concordanceId] = result.data;
        console.log(`  ✓ Loaded Concordance: ${result.data.concordance.name}`);
        
        const outputPath = path.join(OUTPUT_DIR, `strongs-${concordanceId}.json`);
        fs.writeFileSync(outputPath, JSON.stringify(result.data));
      }
    } else {
      console.error(`  ✗ Failed to load ${filePath}: ${result.error}`);
    }
  });
  
  return output;
}

/**
 * Generate a manifest file listing all available resources
 */
function generateManifest(bibles, confessions, commentaries, strongs) {
  console.log('Generating manifest...');
  
  const defaultBible = DEFAULT_BIBLE_PREFERENCE.find(id => bibles[id]) ?? Object.keys(bibles)[0] ?? null;
  const manifest = {
    timestamp: new Date().toISOString(),
    defaultBible,
    resources: {
      bibles: Object.keys(bibles).map(id => ({
        id,
        name: bibles[id].version?.name,
        abbreviation: bibles[id].version?.abbreviation,
        language: bibles[id].version?.language,
        file: `bible-${id}.json`,
        index: `bibles/${id}/index.json`,
        bookPath: `bibles/${id}/{book}.json`,
        description: bibles[id].version?.description
      })),
      confessions: Object.keys(confessions).map(id => ({
        id,
        name: confessions[id].confession?.name,
        abbreviation: confessions[id].confession?.abbreviation,
        year: confessions[id].confession?.year,
        file: `confession-${id}.json`,
        description: confessions[id].confession?.description
      })),
      commentaries: Object.keys(commentaries).map(id => commentaries[id].format === 'chapters'
        ? {
            id,
            format: 'chapters',
            name: commentaries[id].commentary?.name,
            author: commentaries[id].commentary?.author,
            path: `commentaries/${id}`,
            description: commentaries[id].commentary?.description,
            books: commentaries[id].books
          }
        : {
            id,
            format: 'entries',
            name: commentaries[id].commentary?.name,
            author: commentaries[id].commentary?.author,
            book: commentaries[id].commentary?.book,
            file: `commentary-${id}.json`,
            description: commentaries[id].commentary?.description
          }),
      strongs: Object.keys(strongs).map(id => ({
        id,
        name: strongs[id].concordance?.name,
        language: strongs[id].concordance?.language,
        totalEntries: strongs[id].concordance?.totalEntries,
        file: `strongs-${id}.json`,
        description: strongs[id].concordance?.description
      }))
    }
  };
  
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
  console.log(`  ✓ Manifest written to ${MANIFEST_FILE}`);
}

/**
 * Main build function
 */
export function buildResources() {
  console.log('='.repeat(50));
  console.log('Building Resources');
  console.log('='.repeat(50));
  
  console.log('Validating resources...');
  const report = validateResources(RES_DIR);
  printReport(report);
  if (report.errors.length) {
    throw new Error(`Resource validation failed with ${report.errors.length} error(s); see above.`);
  }

  ensureOutputDir();
  
  const bibles = processBibles();
  const confessions = processConfessions();
  const commentaries = processCommentaries();
  const strongs = processStrongs();
  
  generateManifest(bibles, confessions, commentaries, strongs);
  copyContentDir();

  console.log('='.repeat(50));
  console.log('Resources built successfully!');
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log('='.repeat(50));
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  buildResources();
}

export default buildResources;

/**
 * Copy site-level editable content into the docs output so the SPA can load it
 */
function copyContentDir() {
  const src = path.join(__dirname, '../content');
  const dest = path.join(__dirname, '../docs/content');
  if (!fs.existsSync(src)) {
    console.log('No content/ directory found to copy.');
    return;
  }

  console.log(`Copying content from ${src} to ${dest}`);

  function copyRecursive(s, d) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    const entries = fs.readdirSync(s, { withFileTypes: true });
    for (const ent of entries) {
      const srcPath = path.join(s, ent.name);
      const destPath = path.join(d, ent.name);
      if (ent.isDirectory()) {
        copyRecursive(srcPath, destPath);
      } else if (ent.isFile()) {
        const data = fs.readFileSync(srcPath);
        fs.writeFileSync(destPath, data);
      }
    }
  }

  copyRecursive(src, dest);
  console.log('Content copied.');
}

// Call copyContentDir when the script runs directly
if (import.meta.url === `file://${process.argv[1]}`) {
  copyContentDir();
}
