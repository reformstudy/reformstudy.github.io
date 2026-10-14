# Sources and verification

Where every text in `res/` comes from, how it was checked, and what was corrected.
Checked October 2026.

All the downloads come from GitHub, pinned to a commit or release.
`scripts/ingest/sources.lock.json` records the SHA-256 of exactly the files that were verified.
Each ingest script checks its download against that file and stops if anything differs.
A moved release tag, a rewritten commit or an altered file therefore can't reach `res/` unnoticed.
After a deliberate source change, verify it again as described below, then record the new checksums with `UPDATE_SOURCE_LOCK=1 npm run ingest`.

Corrections live in their own files, separate from the ingest code.
Each correction must match the source text exactly once, or ingest fails.

## Method

No single copy of these texts can be trusted on its own. Each source was compared with independent copies, called witnesses here, which were prepared separately and come from different upstream editions. A reading was corrected only where the witnesses agree with each other against our source. Where the witnesses disagree among themselves, our source's reading was kept.

## King James Version

| | |
|---|---|
| Source | [aruljohn/Bible-kjv](https://github.com/aruljohn/Bible-kjv/tree/a9aa4e55afbb3e095f57e4b14cd1f22c5ee8d7c9) at `a9aa4e5` (MIT; the text is public domain) |
| Witnesses | Pure Cambridge Edition and KJV from [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases/tree/e1b254cef86d0e65b1a5d1a94b8b112d0f296a2c) `e1b254c`; eBible.org `eng-kjv` from [seven1m/open-bibles](https://github.com/seven1m/open-bibles) `f257a35`; [thiagobodruk/bible](https://github.com/thiagobodruk/bible) `en_kjv.json` |
| Corrections | [`scripts/ingest/kjv-corrections.json`](../scripts/ingest/kjv-corrections.json): 169 corrections (49 words, 120 divine names) |

**Findings.** We compared all 31,102 verses with each witness, word by word. Of the copies, ours has the fewest readings of its own, and it keeps full punctuation. But it is not the clean 1769 text its description claimed:

- **49 words or spellings:** in each, our source differs from all four witnesses, and all four agree. Examples:
  - "first born" for "firstborn";
  - "thoroughly" for "throughly" (Gen 11:3);
  - "chestnut" for "chesnut" (Gen 30:37);
  - "anything" for "any thing";
  - "honor" for "honour".
- **120 divine names in about 110 verses:**
  - the KJV prints LORD for YHWH and Lord for Adonai, and GOD/God likewise;
  - our source loses that distinction in these verses, for example "Lord GOD" printed as "Lord God" (Gen 15:2);
  - each fix is where eBible and thiagobodruk agree against our source.

After the corrections, no verse remains where our KJV differs from all the witnesses. The remaining differences with the Pure Cambridge Edition are that edition's own spellings, such as "inquire" for "enquire" and "counseller" for "counsellor". The other witnesses agree with us there.

## Berean Standard Bible

| | |
|---|---|
| Source | [BSB-publishing/bsb2usfm](https://github.com/BSB-publishing/bsb2usfm/releases/tag/v5.16) release v5.16, `BSB_usfm.zip` (SHA-256 `771eb584…3479a77`) |
| Witnesses | [thiagobodruk/bible](https://github.com/thiagobodruk/bible) `en_bsb.json`; [usfm-bible/examples.bsb](https://github.com/usfm-bible/examples.bsb) (2025 revision); the BSB in [HelloAOLab/bible-api](https://github.com/HelloAOLab/bible-api) (an older revision) |
| Corrections | None |

The BSB was dedicated to the public domain in 2023.

**Findings.**

- **thiagobodruk:**
  - 31,070 verses are shared, and 98.86% of them are word-for-word identical;
  - after normalising quotation marks, dashes and Psalm titles, 23 verses differ;
  - all 23 differences are artifacts of that copy: 21 are the Hebrew letter headings of Psalm 119, which it puts in the verse text and we keep out, and 2 are the placeholder "vvv" at Luke 9:33 and Acts 4:36;
  - the 16 verses not shared are verses the BSB leaves out of the text, such as Matt 17:21. That copy numbers verses by position, so in those chapters its last verse number is one lower.
- **The other two copies:** they agree 97% (the older revision) and 93% (the 2025 revision). Their differences are the translators' own revisions between editions, for example "the Tigris" or "Hiddekel" in Gen 2:14. They are not errors.

**Not confirmed.** The text is the BSB, but we couldn't establish that the `BSB-publishing` GitHub organization belongs to the BSB's publisher. Checking that needs the publisher's own site (berean.bible / bereanbible.com), which this build environment cannot reach. The checksum lock means the zip we verified is the one used.

## Westminster Confession of Faith (1647)

| | |
|---|---|
| Source | [NonlinearFruit/Creeds.json](https://github.com/NonlinearFruit/Creeds.json/tree/2ae21a4c5387ecc91f474c9d3d67c826d2a6b9d5) at `2ae21a4` (Unlicense; the text is public domain) |
| Witnesses | The 1649 London printing (Robert Bostock), transcribed by EEBO-TCP as [A80320](https://github.com/textcreationpartnership/A80320); [andrewhwaller/westminster-json](https://github.com/andrewhwaller/westminster-json) at `1162114` |
| Corrections | [`scripts/ingest/wcf-corrections.json`](../scripts/ingest/wcf-corrections.json): 15 wording, 17 proof-reference |

**Findings.** Every section's wording and every footnote's references were compared with both witnesses. The 17th-century transcription is the authority.

**Wording: 15 changed words.** In each, both witnesses agree against Creeds.json. Examples:

| Section | Creeds.json | 1649 printing |
|---|---|---|
| 5.5 | "support unto himself" | "support **upon** himself" |
| 20.2 | "beside it, in matters" | "beside it, **if** matters" |
| 21.5 | "upon several occasions" | "upon **special** occasions" |
| 22.7 | "promise or ability" | "promise **of** ability" |

Modernised spelling ("honor", "forever") is an editorial choice, so we kept it.

**Proof texts: 17 wrong or incomplete references.** Examples:

- 8.1: 2 Tim 2:5 for **1 Tim** 2:5;
- 22.2: Ezra 10:25 for Ezra 10:**5**;
- 33.1: 2 Cor 5:12 for 2 Cor 5:**10**;
- 19.4: Exodus 22:1–29 was missing.

After the corrections there are 1,854 proof references. All of them resolve to KJV verses.

## Matthew Henry's Commentary on the Whole Bible

| | |
|---|---|
| Source | [samueldotj/bible-commentaries](https://github.com/samueldotj/bible-commentaries/tree/23f2279a8a56f212aca0de7ef3fbe47cf7334a45/en/henry) `en/henry` at `23f2279` |
| Upstream | CrossWire SWORD module [MHC](https://crosswire.org/sword/modules/ModInfo.jsp?modName=MHC), prepared from the Christian Classics Ethereal Library text (public domain) |
| Corrections | None |

**Findings.**

- **Coverage is complete:**
  - all 1,189 chapters and 66 book introductions;
  - 4,253 passage sections, which together cover every verse;
  - about 6.4 million words, as expected for the full commentary.
- **Spot checks pass.** Well-known passages are present word for word, among them Gen 2 ("not made out of his head to rule over him, nor out of his feet to be trampled upon by him, but out of his side to be equal with him…"), John 3 and Romans 8.

**Not confirmed.**

- We haven't compared the full text against the MHC module itself: crosswire.org can't be reached from this environment. That comparison should be run from a machine that can download the module.
- The repository has no LICENSE file. The text itself is public domain, but the extraction carries no stated license.

## Strong's Greek and Hebrew dictionaries

| | |
|---|---|
| Source | [openscriptures/strongs](https://github.com/openscriptures/strongs/tree/0acd2f251c2d35ff8db2dece4e0593979d3ac223) at `0acd2f2` |
| Witness | STEPBible TBESG and TBESH lexicons (Tyndale House), from [STEPBible/STEPBible-Data](https://github.com/STEPBible/STEPBible-Data) |
| Corrections | None |
| License | James Strong's 1890 text is public domain. The Open Scriptures edition is **CC-BY-SA**: credit Open Scriptures and share this data under the same license. |

**Findings.**

- **Every number exists:** each of the 5,523 Greek and 8,674 Hebrew entries is present in STEPBible.
- **Every number names the right word.** The headword matches STEPBible's for 96.45% of the Greek and 94.18% of the Hebrew entries. The rest are a different form of the same word, not misnumbering. Examples:
  - ἀμύνομαι / ἀμύνω (middle against active voice);
  - different vowel or spelling choices in Hebrew proper names.

## Re-verifying

The comparisons need the witness copies listed above, so they aren't part of `npm test`. When changing a pin:

1. Point the ingest script at the new commit or release.
2. Repeat the comparison for that source against its witnesses.
3. Update the corrections file. An entry that no longer matches makes ingest fail, which is intended.
4. Run `UPDATE_SOURCE_LOCK=1 npm run ingest`.
5. Commit the new lock together with the regenerated `res/` files.
