# Strong's Greek Resource

This folder contains the raw source and the parser for the Strong's Greek sample.

Files:
- `greek.txt` — raw Strong's Greek import text
- `process.js` — parser that generates `greek.json`
- `greek.json` — generated JSON resource

To regenerate the JSON from the raw text:

```bash
node res/strongs/greek/process.js
```
