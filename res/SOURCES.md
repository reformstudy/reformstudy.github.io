# Sources

Every text in `res/` should come from the organization that publishes it, downloaded directly, pinned, and checked against a recorded SHA-256. ReformStudy doesn't correct published texts. If a source has an error, the fix belongs with its publisher.

[`provenance/registry.json`](../provenance/registry.json) records, for each source:
- the organization;
- where it's downloaded from, and the commit, release or file it's pinned to;
- its license;
- the SHA-256 of the files that were converted.

Ingest stops if a download doesn't match the recorded checksum. After deliberately moving a pin, record the new checksum with `UPDATE_SOURCE_LOCK=1 npm run ingest`.

## Status

| Resource | Source | Organization | Status |
|---|---|---|---|
| Strong's Greek and Hebrew | STEPBible lexicons TBESG and TBESH ([STEPBible-Data](https://github.com/STEPBible/STEPBible-Data)) | STEPBible.org, Tyndale House, Cambridge | **In use** |
| King James Version | eBible.org's KJV release | eBible.org | Planned; interim source in use |
| Berean Standard Bible | The publisher's downloads | Berean Bible (bereanbible.com) | Planned; interim source in use |
| Westminster Confession of Faith | The PCA's published text, after checking license and credit terms | Presbyterian Church in America | Planned; interim source in use |
| Matthew Henry's Commentary | CCEL's edition | Christian Classics Ethereal Library, Calvin University | Planned; interim source in use |

The planned sources need their sites added to this environment's allowed network domains:
- ebible.org
- bereanbible.com, berean.bible, openbible.com
- pcaac.org
- ccel.org

## Strong's (STEPBible)

- **What it is:** Tyndale House's brief lexicons, keyed to Strong's numbers.
  - The Greek definitions come from Abbott-Smith's *Manual Greek Lexicon of the New Testament*; the Hebrew from a brief Brown-Driver-Briggs.
  - Each entry has the word, a transliteration, a part of speech, a one-line gloss and a definition.
- **Numbering:** STEPBible extends Strong's numbering to tell apart words Strong's grouped together, mostly names. Each Strong's number gets STEPBible's main entry, and only Strong's own range is included: G1–G5624 (5,523 entries) and H1–H8674 (8,674 entries).
- **License:** CC BY 4.0. Credit "STEPBible.org, Tyndale House, Cambridge" wherever the data is shown.

## Interim sources

Until the planned sources are reachable, these copies are still in use:

- **KJV:** aruljohn/Bible-kjv, with 169 corrections in [`provenance/decisions/kjv.json`](../provenance/decisions/kjv.json).
- **BSB:** BSB-publishing/bsb2usfm v5.16.
- **WCF:** NonlinearFruit/Creeds.json, with 32 corrections in [`provenance/decisions/wcf.json`](../provenance/decisions/wcf.json).
- **Henry:** samueldotj/bible-commentaries, extracted from CrossWire's MHC module.

The corrections were found by comparing these copies with independent ones. They are removed when each resource moves to its publisher's text.
