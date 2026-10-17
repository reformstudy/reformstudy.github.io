# Berean Standard Bible

`bsb.json` is generated. Don't edit it by hand; change the ingest script and rerun it:

```bash
npm run ingest:bsb
```

- **Source:** the publisher's plain-text download, [bereanbible.com/bsb.txt](https://bereanbible.com/bsb.txt), linked from [berean.bible/downloads.htm](https://berean.bible/downloads.htm): the text berean.bible shows. Psalm titles open verse 1 there; the publisher's USX download (`bsb_usx.zip`) shows where each ends. Both files are committed in `sources/bsb/` and pinned by SHA-256. See [SOURCES.md](../../SOURCES.md#berean-standard-bible-the-publisher).
- **License:** public domain, dedicated April 30, 2023. See https://berean.bible/terms.htm. Attribution is appreciated but not required.
- **Text:** verse text, plus Psalm titles in `subtitles` (keyed by chapter). Section headings, cross-reference lines and footnotes aren't in the plain text.
- **Versification:**
  - 31,086 verses. The BSB leaves out 16 verses the KJV has, following different Greek manuscripts (Matthew 17:21, Acts 8:37, Romans 16:24…). `npm run validate:resources` lists each one as a warning.
  - Psalm titles, which open verse 1 in the plain text, are moved to `subtitles`, so verse 1 starts where the KJV's does.
