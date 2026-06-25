import fs from 'fs';
import path from 'path';

const sourcePath = path.join(new URL('.', import.meta.url).pathname, 'kjv.txt');
const outputPath = path.join(new URL('.', import.meta.url).pathname, 'kjv.json');

const content = fs.readFileSync(sourcePath, 'utf8');
const lines = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
const verses = [];

lines.forEach(line => {
  const match = line.match(/^([1-3]?\s*[A-Za-z]+)\s+(\d+):(\d+)\s+(.+)$/i);
  if (!match) return;
  const book = match[1].replace(/\s+/g, ' ').trim();
  verses.push({
    reference: `${book} ${match[2]}:${match[3]}`,
    book,
    chapter: Number(match[2]),
    verse: Number(match[3]),
    text: match[4].trim()
  });
});

fs.writeFileSync(outputPath, JSON.stringify({ source: 'kjv', verses }, null, 2) + '\n');
console.log('Generated', outputPath);
