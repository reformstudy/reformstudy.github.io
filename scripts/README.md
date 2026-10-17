# Resource Build Scripts

This directory contains build scripts for processing and bundling resource files.

## Content pipeline

`npm run ingest` converts every committed source in `sources/` into `res/`, then validates and authenticates it. Add `--download` to an ingest script to fetch its source again from the publisher:

| Script | Writes |
|--------|--------|
| `ingest/kjv.js` | `res/bibles/kjv/kjv.json` |
| `ingest/bsb.js` | `res/bibles/bsb/bsb.json` |
| `ingest/wcf.js` | `res/confessions/wcf/wcf.json` (run after the KJV; proof texts are filled in from it) |
| `ingest/henry.js` | `res/commentaries/henry/` |
| `ingest/strongs.js` | `res/strongs/{greek,hebrew}/` |

`validate-resources.js` checks it all (also run by every build). Shared code is in `lib/`:
- `canon.js`: the canon;
- `refs.js`: reference parsing;
- `usfm.js`, `usx.js` and `xml.js`: readers for the source formats;
- `zip.js`: a ZIP reader;
- `io.js`: file helpers;
- `sources.js`: the committed sources;
- `lock.js`: checksums;
- `pipeline.js`: running a converter.

Sources and licenses are listed in [RESOURCES.md](../RESOURCES.md#sources).

`authenticate/` proves the result is verbatim. It is separate code from the converters, and `npm run authenticate`, every build and `npm test` run it. See [res/SOURCES.md](../res/SOURCES.md#authentication). `npm test` runs the tests in `tests/` and requires 99% line coverage of the converters, `lib/` and the authenticator.

## Scripts

### `build-resources.js`
Main resource builder that:
- Processes all resource files (Bibles, confessions, commentaries, Strong's concordances)
- Validates JSON structure
- Generates individual resource files for each resource
- Creates a manifest file listing all available resources

### `convert-text-to-json.js`
A converter for transforming raw text into ReformStudy JSON resource files.
- Supports Bible, Confession, Commentary, and Strong's concordance formats
- Normalizes references for Bible and commentary imports
- Writes valid JSON into the appropriate `res/{type}/` folder

## Usage

The build script is automatically run during the production build process via `npm run build`.

To run manually:
```bash
node scripts/build-resources.js
```

## Output

Resources are output to `docs/resources/` with the following structure:

```
docs/resources/
├── manifest.json                    # Index of all resources
├── bible-kjv.json                  # Bible version
├── confession-wcf.json             # Confession
├── commentary-matthew-gill.json    # Commentary
├── strongs-hebrew.json             # Strong's concordance
└── strongs-greek.json
```

## Manifest Format

The `manifest.json` file provides a centralized index:

```json
{
  "timestamp": "2024-06-25T...",
  "resources": {
    "bibles": [...],
    "confessions": [...],
    "commentaries": [...],
    "strongs": [...]
  }
}
```

The SPA uses this manifest to discover available resources without downloading all of them.
