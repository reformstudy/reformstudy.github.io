# Matthew Gill Commentary Resource

This folder contains the raw source and the parser for the Matthew commentary sample.

Files:
- `matthew-gill.txt` — raw commentary text
- `process.js` — parser that generates `matthew-gill.json`
- `matthew-gill.json` — generated JSON resource

To regenerate the JSON from the raw text:

```bash
node res/commentaries/matthew-gill/process.js
```
