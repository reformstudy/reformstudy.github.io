# Westminster Confession Resource

This folder contains the raw source and the parser for the WCF sample resource.

Files:
- `wcf.txt` — raw confession text
- `process.js` — parser that generates `wcf.json`
- `wcf.json` — generated JSON resource

To regenerate the JSON from the raw text:

```bash
node res/confessions/wcf/process.js
```
