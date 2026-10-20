# King James Version

`kjv.json` is generated. Don't edit it by hand; change the ingest script and rerun it:

```bash
npm run ingest:kjv
```

- **Source:** eBible.org's USFM release [eng-kjv](https://ebible.org/find/details.php?id=eng-kjv) (`eng-kjv_usfm.zip`), prepared with the CrossWire Bible Society. eBible.org updates the file in place, so it's pinned by its SHA-256 in `provenance/registry.json`.
- **License:** public domain (outside the UK, where the Crown's letters patent apply).
- **Text:** the standard 1769 text, 31,102 verses, plus Psalm titles in `subtitles` (keyed by chapter). Words in italics (`\add`) and divine names (`\nd`, already in capitals: LORD) are kept as plain text. Footnotes and pilcrows (¶) are dropped. The Apocrypha in the zip is not converted.
- **Strong's numbers:** each verse whose words the source tags has `strongs`: `[[start, end, "H7225"], …]`, the tagged word being `text.slice(start, end)`, in order. A tag can cover several words ("an house"). Numbers have no leading zeros, to match the lexicons. Tags in Psalm titles aren't kept. The build leaves `strongs` out of `bible-kjv.json` (the whole text, for search); the per-book files have it.
- **Role:** the reference versification. Validation holds it to exactly 31,102 verses with no gaps, and compares other translations against it.
