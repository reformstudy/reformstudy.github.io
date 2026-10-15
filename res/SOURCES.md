# Sources and verification

Where every text in `res/` comes from, how it is checked, and what was corrected.
First checked October 2026.

Three places in [`provenance/`](../provenance/) keep the record:

- [`registry.json`](../provenance/registry.json): provenance for every source and every witness (an independent copy we compare against). It records:
  - the repository and the commit or release each is pinned to;
  - the SHA-256 of the files that were verified;
  - the license;
  - the lineage, meaning where the copy itself came from.

  It also lists **attestations**: facts a person has to confirm because comparing texts can't establish them.
- [`decisions/`](../provenance/decisions/): what a person decided about each difference.
  - `corrections` are edits applied to the source at ingest. Each must match the source exactly once, or ingest fails.
  - `accepted` are differences checked and found benign; our reading stands.

  Every decision records who made it, when and why.
- [`reports/`](../provenance/reports/README.md): the latest comparison for each resource, including everything still awaiting review.

## Method

No single copy of these texts can be trusted on its own. `npm run verify` checks each source against its witnesses in five steps.

1. **Download and check.** Download the source and every witness at its pin, and stop if any SHA-256 differs from the registry. This catches a moved release, a rewritten commit or an altered file.
2. **Apply corrections.** Apply the reviewed corrections to the source.
3. **Compare.** Split the text into units (verses, confession sections and the chapters their proofs cite, dictionary entries) and align each witness with our source word by word. Every place where any witness differs becomes an item.
4. **Classify.** Count *independent lineages*, not copies: two copies descended from the same text count as one vote. Each item falls into one of three classes:
   - **majority:** our reading has at least as much support as any other. These items are counted but not reviewed.
   - **against:** no witness supports us, and two or more lineages agree on another reading.
   - **split:** anything else, including any difference from a resource that has only one witness.
5. **Match decisions.** Look up each item that isn't a majority in the decisions file, matching by content. An item's key is a hash of three things:
   - the unit;
   - our reading, with two words of context on each side;
   - the set of witness readings.

   A decision therefore stops matching as soon as the source or a witness changes there, and the item comes back for review instead of being waved through. Anything unmatched is listed as awaiting review.

The easiest way to review is the local reviewer UI. `npm run review:ui` opens http://127.0.0.1:4777, where you can work through each resource's items, with these tools:
- every witness's reading side by side;
- buttons to accept our reading, to correct the source (pre-filled when the witnesses agree), or to accept a whole suggested class;
- a page to sign off, or undo, earlier decisions;
- buttons to re-verify and to apply corrections to `res/`.

It runs only on your machine and writes the same decisions files as the command line. Commit them as usual.

The same is available from the command line with `npm run review`:

```bash
npm run review -- kjv                                   # what awaits review, grouped by suggested class
npm run review -- kjv accept <id> --reason "…"          # our reading stands
npm run review -- kjv accept --class oxford-cambridge --reason "…"   # a whole class, after checking a sample
npm run review -- kjv correct <id> --to "…" --reason "…"           # fix the source
npm run review -- kjv confirm                           # sign off decisions Claude recorded
```

**Suggestions are hints only.** Each item carries a suggestion (for example "modernised spelling" or "Oxford/Cambridge spelling"), but nothing is accepted or corrected without a person running `review`.

**Corrections recorded by Claude.** The corrections below were made in the first review, by Claude. The reports count them as awaiting a person's sign-off until someone runs `confirm`.

## King James Version

| | |
|---|---|
| Source | [aruljohn/Bible-kjv](https://github.com/aruljohn/Bible-kjv/tree/a9aa4e55afbb3e095f57e4b14cd1f22c5ee8d7c9) at `a9aa4e5` (MIT; the text is public domain) |
| Witnesses | Pure Cambridge Edition and KJV from [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases/tree/e1b254cef86d0e65b1a5d1a94b8b112d0f296a2c) `e1b254c`; eBible.org `eng-kjv` from [seven1m/open-bibles](https://github.com/seven1m/open-bibles) `f257a35`; [thiagobodruk/bible](https://github.com/thiagobodruk/bible) `en_kjv.json` |
| Corrections | [`provenance/decisions/kjv.json`](../provenance/decisions/kjv.json): 169 corrections (49 words, 120 divine names) |
| Latest report | [`provenance/reports/kjv.md`](../provenance/reports/kjv.md) |

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

**What the automated comparison added.** The first review compared words without case, and it only flagged verses where all four witnesses agreed. `npm run verify` compares with case and counts lineages, and it found readings that review missed. They await a person's decision in the [report](../provenance/reports/kjv.md):
- **Likely errors in our source:**
  - Deut 32:8 "Most High", where every witness reads "most High";
  - Josh 19:2 "and Sheba", where three witnesses read "or Sheba";
  - Exod 32:29 "today", where all four read "to day";
  - "son of David" in eleven Gospel verses, where all four read "Son";
  - Job 33:4 "spirit", where all four read "Spirit".
- **Divine names:** about 20 more where the witnesses split.
- **Edition differences (33):** proper-name spellings where our source and eBible follow the Oxford 1769 text and the copies descended from the Pure Cambridge Edition differ, for example "Sabtechah" against "Sabtecha".

The Pure Cambridge Edition's own spellings, such as "inquire" for "enquire" and "counseller" for "counsellor", don't need review: the other witnesses agree with us there.

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

**What the automated comparison added:**
- **A converter bug, fixed in the script:** markers were removed with a space, which split "forty-two" in 1 Sam 13:1 and similar words.
- **A stray placeholder in the publisher's own file:** "she named vvv him Ben-oni" (Gen 35:18). It awaits review.

**Not confirmed.** The text is the BSB, but we couldn't establish that the `BSB-publishing` GitHub organization belongs to the BSB's publisher. Checking that needs the publisher's own site (berean.bible / bereanbible.com), which this build environment cannot reach. The checksum lock means the zip we verified is the one used.

## Westminster Confession of Faith (1647)

| | |
|---|---|
| Source | [NonlinearFruit/Creeds.json](https://github.com/NonlinearFruit/Creeds.json/tree/2ae21a4c5387ecc91f474c9d3d67c826d2a6b9d5) at `2ae21a4` (Unlicense; the text is public domain) |
| Witnesses | The 1649 London printing (Robert Bostock), transcribed by EEBO-TCP as [A80320](https://github.com/textcreationpartnership/A80320); [andrewhwaller/westminster-json](https://github.com/andrewhwaller/westminster-json) at `1162114` |
| Corrections | [`provenance/decisions/wcf.json`](../provenance/decisions/wcf.json): 15 wording, 17 proof-reference |
| Latest report | [`provenance/reports/wcf.md`](../provenance/reports/wcf.md) |

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

**What the automated comparison added.** Further readings where both witnesses agree against Creeds.json await review in the [report](../provenance/reports/wcf.md):
- "it is" where both read "is" (22.3, 24.3);
- an extra "the" (27.2);
- 2 Thess 1:7–9 cited where both cite 7–10 (33.2).

The report also lists 24 modernised spellings (honor, pretense, forever). Those are to be accepted as an editorial choice, or not.

## Matthew Henry's Commentary on the Whole Bible

| | |
|---|---|
| Source | [samueldotj/bible-commentaries](https://github.com/samueldotj/bible-commentaries/tree/23f2279a8a56f212aca0de7ef3fbe47cf7334a45/en/henry) `en/henry` at `23f2279` |
| Upstream | CrossWire SWORD module [MHC](https://crosswire.org/sword/modules/ModInfo.jsp?modName=MHC), prepared from the Christian Classics Ethereal Library text (public domain) |
| Corrections | None |

**Findings.**

- **Coverage is complete:**
  - all 1,189 chapters, and introductions to 61 books (the source has none for the other 5);
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
- **Almost every number names the same word.** The headword matches STEPBible's for 96.45% of the Greek and 94.18% of the Hebrew entries. With only one witness, each of the other 701 entries awaits a person's decision, grouped by class in the reports ([Greek](../provenance/reports/strongs-greek.md), [Hebrew](../provenance/reports/strongs-hebrew.md)):
  - **Another form of the same word (680):**
    - a verb cited in the middle or the active voice (ἀμύνομαι / ἀμύνω);
    - a spelling with or without the vowel letters ו/י;
    - a plural or comparative.
  - **Unrelated-looking words (21):** 5 Greek and 16 Hebrew entries where the two words look unrelated. These are the ones to check for misnumbering in Strong's 1890 printing. Some have an obvious explanation, such as H4192 "Muth-labben", which STEPBible splits into two words.

## Changing a source or a witness

1. Change the pin in `provenance/registry.json`, and in the ingest script for a source. For a new witness, add its entry, including its lineage.
2. Record the new checksums with `UPDATE_SOURCE_LOCK=1 npm run verify` (and `UPDATE_SOURCE_LOCK=1 npm run ingest` for a source).
3. Run `npm run verify`.
   - A correction that no longer matches makes the run fail. Fix it or remove it in the decisions file.
   - Accepted decisions that no longer match are listed as stale.
4. Review what is pending with `npm run review`.
5. Run `npm run ingest`, then commit the registry, decisions, reports and regenerated `res/` files together.

`npm run verify -- --check` exits with an error while anything awaits review. Use it before a release.
