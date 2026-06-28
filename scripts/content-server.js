#!/usr/bin/env node
/*
  Simple local content server for development.
  - Lists files under ./content
  - Serves file contents via GET /file/<path>
  - Saves file contents via PUT /file/<path>
 */
import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

const CONTENT_ROOT = path.resolve(process.cwd(), 'content');

function safeJoin(base, target) {
  const resolved = path.resolve(base, target);
  if (!resolved.startsWith(base)) throw new Error('Invalid path');
  return resolved;
}

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/files', async (_req, res) => {
  // Recursively list files under content
  async function walk(dir, base) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    let results = [];
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      const rel = path.join(base, ent.name);
      if (ent.isDirectory()) {
        results = results.concat(await walk(full, rel));
      } else {
        results.push(rel.replace(/\\\\/g, '/'));
      }
    }
    return results;
  }

  try {
    const files = await walk(CONTENT_ROOT, '');
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/file/*', async (req, res) => {
  try {
    const rel = req.params[0];
    const filePath = safeJoin(CONTENT_ROOT, rel);
    const data = await fs.readFile(filePath, 'utf-8');
    if (filePath.endsWith('.json')) {
      res.type('application/json').send(data);
    } else {
      res.type('text/plain').send(data);
    }
  } catch (err) {
    res.status(404).json({ error: 'Not found', details: err.message });
  }
});

app.put('/file/*', async (req, res) => {
  try {
    const rel = req.params[0];
    const filePath = safeJoin(CONTENT_ROOT, rel);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const body = req.body;
    // Accept either { text: '...' } or raw JSON object
    if (typeof body === 'object' && body !== null && 'text' in body) {
      await fs.writeFile(filePath, body.text, 'utf-8');
    } else if (typeof body === 'object' && filePath.endsWith('.json')) {
      await fs.writeFile(filePath, JSON.stringify(body, null, 2), 'utf-8');
    } else if (typeof body === 'string') {
      await fs.writeFile(filePath, body, 'utf-8');
    } else {
      await fs.writeFile(filePath, JSON.stringify(body, null, 2), 'utf-8');
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 4001;
app.listen(port, () => console.log(`Content server listening on http://localhost:${port}`));
