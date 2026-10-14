# Berean Standard Bible

`bsb.json` is generated. Don't edit it by hand; change the ingest script and rerun it:

```bash
npm run ingest:bsb
```

- **Source:** the publisher's USFM release, [BSB-publishing/bsb2usfm](https://github.com/BSB-publishing/bsb2usfm) `BSB_usfm.zip`, pinned to a release version in `scripts/ingest/bsb.js`.
- **License:** public domain (CC0), dedicated April 30, 2023. See https://berean.bible/licensing.htm.
- **Text:** verse text, plus Psalm titles in `subtitles` (keyed by chapter). Section headings, cross-reference lines and footnotes are not kept yet. Words of Jesus and supplied words (`\wj`, `\add`) are kept as plain text.
- **Versification:**
  - 31,086 verses. The BSB leaves out 16 verses the KJV has, following different Greek manuscripts (Matthew 17:21, Acts 8:37, Romans 16:24…). `npm run validate:resources` lists each one as a warning.
  - Psalm titles, which share verse 1 in the USFM, are moved to `subtitles`, so verse numbers match the KJV.
