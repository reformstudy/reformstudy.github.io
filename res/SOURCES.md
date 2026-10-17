# Sources

Every text in `res/` should come from the organization that publishes it, downloaded directly, pinned, and checked against a recorded SHA-256. ReformStudy doesn't correct published texts. If a source has an error, the fix belongs with its publisher.

[`provenance/registry.json`](../provenance/registry.json) records, for each source:
- the organization;
- where it's downloaded from, and the commit, release or file it's pinned to;
- its license;
- the SHA-256 of the files that were converted.

The downloads themselves are committed under [`sources/`](../sources), so every conversion and check runs offline. Text files are stored gzipped and archives as they are, which changes no byte of the original. Ingest stops if a file doesn't match its recorded checksum. To take a publisher's new release, run the ingest script with `--download`, check what changed, and record the new checksum with `UPDATE_SOURCE_LOCK=1`.

## Authentication

`npm run authenticate`, every build and `npm test` prove that what the app shows is the sources' text. The code is in [`scripts/authenticate/`](../scripts/authenticate), separate from the converters, and it fails on any of the following:

1. **Sources.** A committed file doesn't match the SHA-256 in the registry.
2. **Reproduction.** Running the converters on `sources/` doesn't give `res/` exactly, byte for byte, with no file missing or extra. A hand edit to `res/` fails here.
3. **Verbatim text.** The authenticator reads each source again with its own reader, and compares one unit at a time (a verse, a Psalm title, a paragraph, a section, a lexicon field):
   - every letter, digit and mark must match the source, in order;
   - there must be a word break wherever the source has one, and none where it hasn't;
   - only the named exceptions below may differ.
4. **Accounting.** Every character of the source is either in the output or left out under a named category, and the report prints each total. Examples of categories: footnotes, section headings, the KJV passage CCEL prints, STEPBible's sub-entries. Text that fits no category stops authentication, so nothing can be dropped unnoticed.
5. **Derived fields.** Fields that aren't copied text are re-derived independently and must match:
   - Henry's references and section verse ranges;
   - the Confession's proof references, and its proof texts (which must equal the KJV's verses);
   - Strong's parts of speech, from STEPBible's codes.
6. **Site.** After a build, `docs/resources/` must carry exactly the content of `res/`.

The exceptions, each listed for the resources it applies to:

| Exception | Applies to | What it allows |
|---|---|---|
| pilcrow | KJV | The ¶ marks eBible.org prints at some paragraph starts are left out. |
| punctuation spacing | KJV, BSB | Where removing a marker leaves a space before closing punctuation, or after opening punctuation, the space is dropped. |
| STEPBible indentation | Strong's | STEPBible's `__` indentation marks in definitions become spaces. |

Adding an exception means adding it to `scripts/authenticate/compare.js` with a test, and listing it here.

`npm test` covers every transform: the converters, the authenticator, and tests that tamper with converted text to show each kind of change is caught. It also requires at least 99% of lines, 94% of branches and 99% of functions in `scripts/ingest`, `scripts/lib` and `scripts/authenticate` to be exercised.

## Status

| Resource | Source | Organization | Status |
|---|---|---|---|
| King James Version | eBible.org's [eng-kjv](https://ebible.org/find/details.php?id=eng-kjv) USFM release | eBible.org, with the CrossWire Bible Society | **In use** |
| Berean Standard Bible | The publisher's [USX download](https://berean.bible/downloads.htm) | Berean Bible (bereanbible.com) | **In use** |
| Matthew Henry's Commentary | CCEL's [six ThML volumes](https://ccel.org/ccel/henry) | Christian Classics Ethereal Library, Calvin University | **In use** |
| Strong's Greek and Hebrew | STEPBible lexicons TBESG and TBESH ([STEPBible-Data](https://github.com/STEPBible/STEPBible-Data)) | STEPBible.org, Tyndale House, Cambridge | **In use** |
| Westminster Confession of Faith | No openly licensed edition with proofs found; permission requested from the copyright holder | Orthodox Presbyterian Church (copyright holder of the PCA's and OPC's edition) | Interim source in use |

## King James Version (eBible.org)

- **What it is:** the 1769 standard text, from eBible.org's USFM release, prepared with the CrossWire Bible Society. Psalm titles are kept as chapter subtitles.
- **Pin:** eBible.org replaces the zip in place when it updates the release, so the zip is pinned by its SHA-256. The registry records the release date that was checked.
- **License:** public domain, outside the UK (there the Crown's letters patent apply).

## Berean Standard Bible (the publisher)

- **What it is:** the publisher's USX download (bsb_usx.zip, the XML form of USFM), linked from berean.bible/downloads.htm. Each book says it was generated by the publisher's own bsb2usfm tool.
- **Pin:** the file is replaced in place, so it's pinned by its SHA-256 and its Last-Modified date.
- **License:** public domain, dedicated April 30, 2023 (berean.bible/terms.htm). Attribution is appreciated, not required.
- **Why USX, not USFM:** the publisher's USFM download (bsb_usfm.zip, `GEN.usfm`) has a stray "vvv" in Genesis 35:18 ("she named vvv him Ben-oni"). The USX and plain-text downloads don't. Converted, the USX and USFM agree on every other verse and every Psalm title.
- **The USX is not the publisher's plain text.** The authenticator holds the BSB to the USX exactly. Their plain-text download (`bsb.txt`), which matches berean.bible, differs from the USX in about 1,440 verses:
  - em dashes: the USX puts a space after them ("Testimony— before");
  - quote marks: some paragraph ends carry a continuation mark, "[’’]";
  - brackets: some supplied words are bracketed ("[of silver]");
  - missing spaces: a few verses lack a space after a footnote ("Samuel,saying").

## Matthew Henry (CCEL)

- **What it is:** Henry's *Commentary on the Whole Bible* in CCEL's six ThML volumes, which are marked up by passage. The KJV passage CCEL prints before each comment is left out.
- **Pin:** the six files are pinned together by one SHA-256 (CCEL's copies are dated June 6, 2024).
- **License:** each volume says "Public domain. May be copied and distributed freely." CCEL's site-wide copyright page also says its books "may be used for personal, educational, or non-profit purposes" and asks people to contact CCEL before republishing or using them commercially. ReformStudy is free and non-profit. Crediting CCEL in the app is a courtesy to them.
- **Markup:** a few of CCEL's passage markers name the wrong chapter or run past a chapter's end. The ingest keeps the chapter from the block's title, cuts the range, and prints a note for each case. The text itself isn't changed.

## Strong's (STEPBible)

- **What it is:** Tyndale House's brief lexicons, keyed to Strong's numbers.
  - The Greek definitions come from Abbott-Smith's *Manual Greek Lexicon of the New Testament*; the Hebrew from a brief Brown-Driver-Briggs.
  - Each entry has the word, a transliteration, a part of speech, a one-line gloss and a definition.
- **Numbering:** STEPBible extends Strong's numbering to tell apart words Strong's grouped together, mostly names. Each Strong's number gets STEPBible's main entry, and only Strong's own range is included: G1–G5624 (5,523 entries) and H1–H8674 (8,674 entries).
- **License:** CC BY 4.0. STEPBible asks for credit to "STEP Bible", linked to www.STEPBible.org, and for changes to the data to be recorded. The "About this version" panel carries the credit, and the changes are the selection described under Numbering.

## Westminster Confession (interim)

The WCF comes from NonlinearFruit/Creeds.json, used as published, until a better source is found. Its wording mostly follows Schaff's 1877 edition. In about 15 places that differs from the Assembly's 1649 printing (for example, 9.2 "that which is good" where the 1649 printing has "was good"), and a few proof references differ (8.1 cites 2 Timothy 2:5 for 1 Timothy 2:5). Publisher editions that were checked (October 2026):

- **PCA** ([pcaac.org/bco/westminster-confession](https://www.pcaac.org/bco/westminster-confession/)): a PDF with proof texts, "© copyright 2005, 2007 by The Orthodox Presbyterian Church", republished by the PCA's Christian Education & Publications. "All rights reserved… without the prior permission of the publisher." Not usable without permission.
- **OPC** ([opc.org/confessions.html](https://opc.org/confessions.html)):
  - `CFLayout.pdf` is the same file as the PCA's PDF.
  - `wcf.html` has the Confession's text but no proofs.
  - The site states no reuse terms, and its Terms & Conditions link is broken.
- **CCEL:**
  - Schaff's *Creeds of Christendom* vol. 3 (public domain) has the 1647 text with proofs. CCEL's digital copy has scanning errors, though: 2.2 "foundation" for *fountain*, 19.6 "covenant of words" for *works*, 22.7 "superstitions" for *superstitious*, and others. Its reference tags also misread Roman numerals (Ps. cxlv. 3 is tagged Psalm 45:3).
  - `westminster3` is the PCUSA's modern text, with renumbered chapters and no proofs.

The WCF moves to a publisher's text once one is found that we have permission to use.
