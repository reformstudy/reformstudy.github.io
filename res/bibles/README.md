# Bible Versions

This directory contains Bible versions in JSON format.

## Format

Each Bible version file is a JSON file with the following structure:

```json
{
  "version": {
    "id": "version-id",
    "name": "Full Name",
    "abbreviation": "ABV",
    "language": "en",
    "releaseDate": "YYYY",
    "copyright": "Copyright info",
    "description": "Description"
  },
  "books": [
    {
      "id": "GEN",
      "name": "Genesis",
      "testament": "OT",
      "chapters": 50,
      "verses": [
        {
          "book": "GEN",
          "chapter": 1,
          "verse": 1,
          "text": "Verse text here"
        }
      ]
    }
  ]
}
```

## Available Versions

- `kjv.json` - King James Version

## Adding New Versions

1. Create a new JSON file with the version ID as the filename
2. Follow the format above
3. Include all books and verses
4. The build script will process and optimize for distribution
