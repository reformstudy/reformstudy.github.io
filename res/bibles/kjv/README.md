# King James Version Resource

This folder contains the raw text source and the parsing script for the KJV sample Bible resource.

Files:
- `kjv.txt` — raw Bible verse text
- `process.js` — parser that generates `kjv.json`
- `kjv.json` — generated JSON resource

To regenerate the JSON from the raw text:

```bash
node res/bibles/kjv/process.js
```
