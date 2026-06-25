# Commentaries

This directory contains biblical commentaries in JSON format.

## Format

Each commentary file is a JSON file with the following structure:

```json
{
  "commentary": {
    "id": "book-author",
    "name": "Full Commentary Title",
    "author": "Author Name",
    "book": "MAT",
    "published": 1746,
    "description": "Description of the commentary"
  },
  "entries": [
    {
      "book": "MAT",
      "chapter": 1,
      "verse": 1,
      "text": "The biblical verse text",
      "commentary": "Commentary on this verse"
    }
  ]
}
```

## Available Commentaries

- `matthew-gill.json` - John Gill's Commentary on Matthew

## Adding New Commentaries

1. Create a new JSON file with a descriptive ID as the filename (e.g., `book-author.json`)
2. Follow the format above
3. Include commentary entries for relevant verses
4. The build script will process and optimize for distribution
