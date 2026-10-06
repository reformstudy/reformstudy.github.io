# ReformStudy Resource System

The ReformStudy platform uses a modular resource system for managing biblical and theological content. Resources (Bible versions, commentaries, confessions, Strong's concordances) are not bundled into the SPA, but rather served as static JSON files that the app fetches on-demand.

## Content Pipeline

Bible and commentary text is downloaded and converted by scripts, never typed in:

1. **Ingest** (`scripts/ingest/`): `kjv.js`, `bsb.js` and `gill.js` download a source, convert it to the formats below, and write it under `res/`. Each has a pure convert function with a fixture test in `scripts/tests/`.
2. **Commit**: the converted files are committed, so builds never depend on another site being up. Bible files are written one verse per line, so a corrected verse is a one-line diff.
3. **Validate** (`scripts/validate-resources.js`, also run by every build): all 66 books in canon order, chapter counts, verse order and text. The KJV must have exactly 31,102 verses with no gaps. Other translations are compared with it, and differences are printed as warnings.
4. **Build** (`scripts/build-resources.js`): writes each Bible as one whole file (for search), plus an index and one file per book (for the reader). Chaptered commentaries are copied one file per chapter. `manifest.json` lists everything and names `defaultBible`.

The BSB and Gill come from bible.helloao.org, which some sandboxes can't reach. The **Fetch sources** GitHub Action downloads them. It runs on pull requests that change `scripts/ingest/**` and commits the data to that branch, and can be run by hand from the Actions tab.

## Architecture

### Advantages of This Approach

1. **Smaller Initial Bundle**: The SPA is lean and fast to load
2. **On-Demand Loading**: Users only download the resources they need
3. **Easy Updates**: Resources can be updated independently of the app code
4. **Scalability**: Multiple large resources can be added without impacting app performance
5. **Caching**: Resources are cached in memory once loaded for fast access
6. **Content Separation**: Content is decoupled from code, enabling easier collaboration and content updates

### Directory Structure

```
reformstudy.github.io/
├── res/                               # Source resources
│   ├── bibles/                        # Bible version resources
│   │   ├── kjv/
│   │   │   ├── kjv.txt
│   │   │   ├── process.js
│   │   │   ├── README.md
│   │   │   └── kjv.json
│   │   └── README.md
│   ├── confessions/                   # Confessional documents
│   │   ├── wcf/
│   │   │   ├── wcf.txt
│   │   │   ├── process.js
│   │   │   ├── README.md
│   │   │   └── wcf.json
│   │   └── README.md
│   ├── commentaries/                  # Biblical commentaries
│   │   ├── matthew-gill/
│   │   │   ├── matthew-gill.txt
│   │   │   ├── process.js
│   │   │   ├── README.md
│   │   │   └── matthew-gill.json
│   │   └── README.md
│   ├── strongs/                       # Strong's concordances
│   │   ├── greek/
│   │   │   ├── greek.txt
│   │   │   ├── process.js
│   │   │   ├── README.md
│   │   │   └── greek.json
│   │   ├── hebrew/
│   │   │   ├── hebrew.txt
│   │   │   ├── process.js
│   │   │   ├── README.md
│   │   │   └── hebrew.json
│   │   └── README.md
│   └── scripts/                       # Build and processing scripts
│       └── build-resources.js
├── docs/resources/                    # Built/published resources (generated)
│   ├── manifest.json                  # Index of all resources
│   ├── bible-*.json                   # Individual Bible versions
│   ├── confession-*.json              # Individual confessions
│   ├── commentary-*.json              # Individual commentaries
│   └── strongs-*.json                 # Individual concordances
├── scripts/
│   ├── build-resources.js             # Resource builder
│   └── README.md
└── src/utils/
    └── resourceLoader.ts              # Resource loading utilities
```

## Resource Types

### Bibles

Bible versions in a per-resource folder with metadata, raw source material, and a processing script.

**Folder Format**: `res/bibles/{id}/`

The generated JSON file lives at:

`res/bibles/{id}/{id}.json`

**Example**:
```json
{
  "version": {
    "id": "kjv",
    "name": "King James Version",
    "abbreviation": "KJV",
    "language": "en",
    "releaseDate": "1611",
    "copyright": "Public Domain",
    "description": "..."
  },
  "books": [...]
}
```

### Confessions

Historical confessional documents structured by chapters and sections.

**Folder Format**: `res/confessions/{id}/`

The generated JSON file lives at:

`res/confessions/{id}/{id}.json`

**Example**:
```json
{
  "confession": {
    "id": "wcf",
    "name": "Westminster Confession of Faith",
    ...
  },
  "sections": [...]
}
```

### Commentaries

Verse-by-verse biblical commentaries with explanatory text.

**Folder Format**: `res/commentaries/{id}/`

The generated JSON file lives at:

`res/commentaries/{id}/{id}.json`

**Example**:
```json
{
  "commentary": {
    "id": "matthew-gill",
    "name": "John Gill's Exposition - Matthew",
    ...
  },
  "entries": [...]
}
```

### Strong's Concordances

Strong's Hebrew and Greek concordances with definitions and references.

**Folder Format**: `res/strongs/{id}/`

The generated JSON file lives at:

`res/strongs/{id}/{id}.json`

**Example**:
```json
{
  "concordance": {
    "id": "hebrew",
    "name": "Strong's Hebrew Concordance",
    ...
  },
  "entries": [...]
}
```

## Build Process

### Automatic Build

The resource builder runs automatically during the production build:

```bash
npm run build
```

This command:
1. Runs TypeScript type checking (`tsc`)
2. Builds the React app with Vite
3. Automatically triggers the resource builder
4. Outputs processed resources to `docs/resources/`

### Manual Resource Build

To build only resources:

```bash
npm run build:resources
```

### Converting Raw Text Files

When you have unstructured source text, use the text converter to produce a JSON resource file for the corresponding type.

```bash
node scripts/convert-text-to-json.js --type <bible|confession|commentary|strongs> --input <raw-file> --id <resource-id> --name "Display Name" --description "Description"
```

Add metadata fields appropriate to the resource type, then build resources normally.

## Using Resources in the App

The `resourceLoader.ts` module provides utilities for fetching and managing resources:

```typescript
import { 
  resourceManager, 
  getAvailableBibles, 
  BibleVersion 
} from '@/utils/resourceLoader';

// Get list of available Bibles
const bibles = await getAvailableBibles();

// Load a specific Bible
const kjv: BibleVersion = await resourceManager.loadBible('kjv');

// Access verses
const verse = resourceManager.getVerse(kjv, 'GEN', 1, 1);
const chapter = resourceManager.getChapter(kjv, 'GEN', 1);

// Load other resources
const wcf = await resourceManager.loadConfession('wcf');
const commentary = await resourceManager.loadCommentary('matthew-gill');
const strongs = await resourceManager.loadStrongs('hebrew');
```

### Resource Manager Features

- **Automatic Caching**: Resources are cached in memory after first load
- **Concurrent Loading**: Multiple resources can load simultaneously
- **Error Handling**: Comprehensive error handling for network and parsing issues
- **Cache Management**: Utilities for viewing and clearing cache

```typescript
// View cache statistics
const stats = resourceManager.getCacheStats();
console.log(`Loaded resources: ${stats.itemCount}`);

// Clear cache if needed
resourceManager.clearCache();
```

## Adding New Resources

### Adding a Bible Version

1. Write `scripts/ingest/{id}.js` that produces `res/bibles/{id}/{id}.json` in the format in [res/bibles/README.md](res/bibles/README.md), using the book IDs in `scripts/lib/canon.js`
2. Add a fixture test for its convert function in `scripts/tests/`
3. Run it, then `npm run validate:resources` and `npm run build`

### Adding a Confession

1. Create `res/confessions/{id}.json` with the confession data
2. Follow the format in [res/confessions/README.md](res/confessions/README.md)
3. Run `npm run build` to process

### Adding a Commentary

1. For a whole-Bible commentary, use the chaptered layout in [res/commentaries/README.md](res/commentaries/README.md) (see `scripts/ingest/gill.js`)
2. Run `npm run build` to validate and publish it

### Adding Strong's Data

1. Create `res/strongs/{id}.json` with the concordance data
2. Follow the format in [res/strongs/README.md](res/strongs/README.md)
3. Run `npm run build` to process

## Manifest File

The manifest file (`docs/resources/manifest.json`) is generated automatically and provides a centralized index of all available resources. The app uses this to discover resources without downloading everything.

### Manifest Format

```json
{
  "timestamp": "2024-06-25T...",
  "resources": {
    "bibles": [
      {
        "id": "kjv",
        "name": "King James Version",
        "abbreviation": "KJV",
        "language": "en",
        "file": "bible-kjv.json",
        "description": "..."
      }
    ],
    "confessions": [...],
    "commentaries": [...],
    "strongs": [...]
  }
}
```

## Data Formats

### Bible Version Format

```typescript
interface BibleVersion {
  version: {
    id: string;
    name: string;
    abbreviation: string;
    language: string;
    releaseDate: string;
    copyright: string;
    description: string;
  };
  books: {
    id: string;                    // e.g., "GEN", "MAT"
    name: string;
    testament: 'OT' | 'NT';
    chapters: number;
    verses: {
      book: string;
      chapter: number;
      verse: number;
      text: string;
    }[];
  }[];
}
```

### Confession Format

```typescript
interface Confession {
  confession: {
    id: string;
    name: string;
    abbreviation: string;
    year: number;
    origin: string;
    description: string;
    chapters: number;
  };
  sections: {
    chapter: number;
    title: string;
    sections: {
      number: string;              // e.g., "1.1"
      content: string;
    }[];
  }[];
}
```

### Commentary Format

```typescript
interface Commentary {
  commentary: {
    id: string;
    name: string;
    author: string;
    book: string;
    published: number;
    description: string;
  };
  entries: {
    book: string;
    chapter: number;
    verse: number;
    text: string;
    commentary: string;
  }[];
}
```

### Strong's Format

```typescript
interface StrongsConcordance {
  concordance: {
    id: string;
    name: string;
    language: string;
    totalEntries: number;
    version: string;
  };
  entries: {
    number: string;               // e.g., "H1", "G1"
    transliteration: string;
    pronunciation: string;
    partOfSpeech: string;
    definition: string;
    kjvDefinition: string;
    usageCount: number;
    references: {
      book: string;
      chapter: number;
      verse: number;
      text: string;
    }[];
  }[];
}
```

## Deployment

When deployed to GitHub Pages, the `docs/resources/` directory is served statically, allowing the SPA to fetch resources via HTTP requests to URLs like:

- `/resources/manifest.json`
- `/resources/bible-kjv.json`
- `/resources/confession-wcf.json`
- `/resources/commentary-matthew-gill.json`
- `/resources/strongs-hebrew.json`

The GitHub Pages configuration automatically serves these files with proper MIME types.

## Performance Considerations

1. **Resource Size**: Keep individual resource files under 5MB for optimal performance
2. **Versioning**: Consider adding version info to manifest for cache busting
3. **Lazy Loading**: Load resources only when needed
4. **Compression**: The build script can be enhanced to support gzip compression
5. **Incremental Builds**: Only rebuild resources that have changed

## Future Enhancements

- [ ] Gzip compression for resources
- [ ] Incremental builds (only rebuild changed resources)
- [ ] Resource validation schema
- [ ] CDN support for large resources
- [ ] Search indexing for resources
- [ ] Version management and changelog
- [ ] Resource attribution and licensing
