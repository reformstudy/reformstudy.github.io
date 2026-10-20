/**
 * The pipeline explorer: a small local web app for seeing, step by step,
 * what the content pipeline does. Read-only: it runs converters and checks
 * in memory and never writes to sources/, res/ or the registry.
 *
 *   npm run explore                 # http://127.0.0.1:4310
 *   npm run explore -- --port 5000
 */

import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from '../lib/io.js';
import { Explorer } from './data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'] };

/** The API: each route takes the query parameters and returns JSON. */
export function routes(explorer) {
  return {
    '/api/overview': () => explorer.overview(),
    '/api/ingest': q => explorer.ingest(q.get('id')),
    '/api/generated': q => explorer.generated(q.get('id'), q.get('path')),
    '/api/authenticate': () => explorer.authenticate(),
    '/api/places': q => explorer.places(q.get('resource')),
    '/api/inspect': q => explorer.inspect(q.get('resource'), q.get('place')),
  };
}

export function createServer(explorer = new Explorer()) {
  const api = routes(explorer);
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (STATIC[url.pathname]) {
      const [file, type] = STATIC[url.pathname];
      res.writeHead(200, { 'content-type': `${type}; charset=utf-8` });
      res.end(fs.readFileSync(path.join(__dirname, file)));
      return;
    }
    const handler = api[url.pathname];
    if (!handler) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: `No route ${url.pathname}` }));
      return;
    }
    try {
      const body = JSON.stringify(handler(url.searchParams));
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(body);
    } catch (err) {
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}

/* node:coverage ignore next 6 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(parseArgs(process.argv.slice(2)).port ?? 4310);
  createServer().listen(port, '127.0.0.1', () => {
    console.log(`Pipeline explorer: http://127.0.0.1:${port}  (read-only; Ctrl+C to stop)`);
  });
}
