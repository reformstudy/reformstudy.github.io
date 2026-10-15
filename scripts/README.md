# Resource Build Scripts

This directory contains build scripts for processing and bundling resource files.

## Content pipeline

`npm run ingest` downloads and converts every source into `res/`, then validates it:

| Script | Writes |
|--------|--------|
| `ingest/kjv.js` | `res/bibles/kjv/kjv.json` |
| `ingest/bsb.js` | `res/bibles/bsb/bsb.json` |
| `ingest/wcf.js` | `res/confessions/wcf/wcf.json` (run after the KJV; proof texts are filled in from it) |
| `ingest/henry.js` | `res/commentaries/henry/` |
| `ingest/strongs.js` | `res/strongs/{greek,hebrew}/` |

`validate-resources.js` checks it all (also run by every build), and `npm test` runs the converter tests in `tests/`. Shared code is in `lib/`: the canon (`canon.js`), reference parsing (`refs.js`), a ZIP reader (`zip.js`) and file helpers (`io.js`). Sources and licenses are listed in [RESOURCES.md](../RESOURCES.md#sources).

Each script checks its download against the SHA-256 in `provenance/registry.json` (helpers in `lib/lock.js`) and stops on a mismatch. Corrections to a source are reviewed decisions in `provenance/decisions/{resource}.json` (loaded by `lib/decisions.js`); each must match exactly once or ingest fails.

## Verification

`npm run verify` (`verify/verify.js`) compares each source with its witnesses and writes `provenance/reports/`; `npm run review` (`verify/review.js`) records decisions. The parts:

| File | Does |
|------|------|
| `verify/witnesses.js` | Downloads witnesses at their pins into `.cache/witnesses/` and checks their SHA-256 |
| `verify/consensus.js` | Aligns each witness with the source, finds the places that differ, classifies them by independent lineage, and keys them by content |
| `verify/adapters/*.js` | Per resource: how to split it into units, normalize the text, read each witness, and suggest a class for each item |
| `verify/report.js` | The Markdown reports |
| `verify/review.js` | `npm run review`: list items and record decisions from the command line |
| `verify/review-server.js`, `verify/review-ui.html` | `npm run review:ui`: the same in a local web page (127.0.0.1 only; writes only from its own page) |

To add a witness, add it to the registry (with its lineage), record its checksum with `UPDATE_SOURCE_LOCK=1 npm run verify`, and read it in the resource's adapter. See [res/SOURCES.md](../res/SOURCES.md).

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
