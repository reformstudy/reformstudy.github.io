# King James Version

`kjv.json` is generated. Don't edit it by hand; change the ingest script and rerun it:

```bash
node scripts/ingest/kjv.js
```

- **Source:** [aruljohn/Bible-kjv](https://github.com/aruljohn/Bible-kjv), pinned to a commit in `scripts/ingest/kjv.js`. The KJV text is public domain; the source repo is MIT licensed.
- **Text:** the standard 1769 Oxford text, 31,102 verses. Psalm titles are not included.
- **Role:** the reference versification. Validation holds it to exactly 31,102 verses with no gaps, and compares other translations against it.
