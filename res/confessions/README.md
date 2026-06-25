# Confessions

This directory contains historical Christian confessions and creeds in JSON format.

## Format

Each confession file is a JSON file with the following structure:

```json
{
  "confession": {
    "id": "confession-id",
    "name": "Full Name",
    "abbreviation": "ABV",
    "year": 1647,
    "origin": "Church or Council",
    "description": "Description",
    "chapters": 33
  },
  "sections": [
    {
      "chapter": 1,
      "title": "Chapter Title",
      "sections": [
        {
          "number": "1.1",
          "content": "Section text"
        }
      ]
    }
  ]
}
```

## Available Confessions

- `wcf.json` - Westminster Confession of Faith

## Adding New Confessions

1. Create a new JSON file with the confession ID as the filename
2. Follow the format above
3. Include all chapters and sections
4. The build script will process and optimize for distribution
