# Strong's Concordance

This directory contains Strong's Hebrew and Greek Concordances in JSON format.

## Format

Each concordance file is a JSON file with the following structure:

```json
{
  "concordance": {
    "id": "hebrew|greek",
    "name": "Full Concordance Name",
    "language": "Hebrew|Greek",
    "totalEntries": 8674,
    "version": "1890"
  },
  "entries": [
    {
      "number": "H1|G1",
      "transliteration": "transliteration",
      "pronunciation": "pronunciation",
      "partOfSpeech": "noun|verb|adjective",
      "definition": "Definition",
      "kjvDefinition": "KJV Definition",
      "usageCount": 1210,
      "references": [
        {
          "book": "GEN",
          "chapter": 2,
          "verse": 24,
          "text": "Verse text"
        }
      ]
    }
  ]
}
```

## Available Concordances

- `hebrew.json` - Strong's Hebrew Concordance
- `greek.json` - Strong's Greek Concordance

## Adding Entries

1. Add entries to the appropriate concordance file
2. Use the standard Strong's numbering system (H for Hebrew, G for Greek)
3. Include transliteration, pronunciation, and references
4. The build script will process and optimize for distribution
