# Resource Build Scripts

This directory contains build scripts for processing and bundling resource files.

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
