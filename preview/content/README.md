Local-first Content (content/)

Purpose
- Store editable site content used by the SPA: atlas events, theology topics, sample pages, markdown, or JSON.

Dev workflow
1. Start the local content server and Vite together:

```bash
npm run dev:cms
```

2. Open the SPA (Vite prints address, usually http://localhost:5173).
3. Use the "Content Editor" (Admin) in the app to open, edit, and save files under `content/`.
4. Atlas and Theology components will prefer the local server in dev and automatically reflect edits.

Content server
- Endpoint: `http://localhost:4001`
- Health: `GET /health` (returns {ok:true})
- List files: `GET /files` (returns JSON { files: [...] })
- Read file: `GET /file/<path>`
- Save file: `PUT /file/<path>` with body `{ "text": "..." }`

Typical file layout
- `content/atlas/eraEvents.json`  — JSON structure with era keys and event arrays (used by `AtlasAndTimeline`).
- `content/theology/theology.json` — JSON of topics and entries (used by `TheologyExplorer`).
- `content/<path>.md` or `.json` — other editable pages or snippets.

Minimal examples
- `content/atlas/eraEvents.json`

```json
{
  "church": { "title": "Apostolic & Church Age", "timeframe": "33 AD – Present", "events": [ { "id": "pentecost", "date": "33 AD", "title": "Pentecost", "loc": "Jerusalem", "coords": { "x": 750, "y": 460 }, "desc": "...", "scripture": "Acts 2:1-4", "theme": "New Covenant" } ] }
}
```

- `content/theology/theology.json`

```json
{
  "topics": [ { "id": "soteriology", "title": "Soteriology", "summary": "Study of salvation...", "entries": [ { "id": "justification", "title": "Justification by Faith", "content": "..." } ] } ]
}
```

Production / Build
- Running `npm run build` calls `scripts/build-resources.js` which copies `content/` into `docs/content/` so the built SPA can load the same files from `/content/...`.

Security note
- The content server is intended for local development only. It listens on `localhost` and has no authentication; do not expose it publicly.

Troubleshooting
- If the editor shows "Could not load file list", ensure `npm run dev:cms` is running and `http://localhost:4001/health` returns OK.
- After editing content, the SPA should reflect changes in dev automatically; for production builds ensure `npm run build` is run to copy `content/` into `docs/`.
