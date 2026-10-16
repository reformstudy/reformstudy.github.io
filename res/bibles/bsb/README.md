# Berean Standard Bible

`bsb.json` is generated. Don't edit it by hand; change the ingest script and rerun it:

```bash
npm run ingest:bsb
```

- **Source:** the publisher's USX download (USX is the XML form of USFM), [bereanbible.com/bsb_usx.zip](https://bereanbible.com/bsb_usx.zip), linked from [berean.bible/downloads.htm](https://berean.bible/downloads.htm). The file is updated in place, so it's pinned by its SHA-256 in `provenance/registry.json`. The publisher's USFM download has a stray "vvv" in Genesis 35:18; the USX and plain-text downloads don't, which is why the USX is used.
- **License:** public domain, dedicated April 30, 2023. See https://berean.bible/terms.htm. Attribution is appreciated but not required.
- **Text:** verse text, plus Psalm titles in `subtitles` (keyed by chapter). Section headings, cross-reference lines and footnotes are not kept yet. Words of Jesus (`wj`) are kept as plain text.
- **Versification:**
  - 31,086 verses. The BSB leaves out 16 verses the KJV has, following different Greek manuscripts (Matthew 17:21, Acts 8:37, Romans 16:24…). `npm run validate:resources` lists each one as a warning.
  - Psalm titles, which share verse 1 in the USFM, are moved to `subtitles`, so verse numbers match the KJV.
