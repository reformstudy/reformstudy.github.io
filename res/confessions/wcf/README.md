# Westminster Confession of Faith (1647)

`wcf.json` is generated. Don't edit it by hand; change the ingest script and rerun it (after the KJV):

```bash
npm run ingest:wcf
```

- **Source:** [NonlinearFruit/Creeds.json](https://github.com/NonlinearFruit/Creeds.json), pinned to a commit in `scripts/ingest/wcf.js`. Public domain text; the repository is under the Unlicense.
- **Text:** the original 1647 text: 33 chapters, 172 sections, 1,850 proof references.
- **Per section:**
  - `content`: the text.
  - `contentWithProofs`: the text with the Assembly's footnote markers (`[1]`, `[2]`…).
  - `proofs`: each footnote's references in compact form (`PSA.19.1-3`), so screens can show them in any translation.
  - `proofTexts`: the same references flattened, with the KJV text filled in.
- **Validation:** every proof reference must exist in the KJV, and every footnote marker must have a proof group.
