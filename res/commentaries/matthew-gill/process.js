import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourcePath = path.join(__dirname, 'matthew-gill.txt');
const outputPath = path.join(__dirname, 'matthew-gill.json');

const content = fs.readFileSync(sourcePath, 'utf8');
const entries = [];

content.split(/\r?\n/).forEach(line => {
  const trimmed = line.trim();
  if (!trimmed) return;
  const match = trimmed.match(/^([1-3]?\s*[A-Za-z]+)\s+(\d+):(\d+)\s+(.+)$/);
  if (!match) return;

  const book = match[1].replace(/\s+/g, ' ').trim();
  const chapter = Number(match[2]);
  const verse = Number(match[3]);
  const textWithCommentary = match[4].trim();
  const parts = textWithCommentary.split(/\s+-\s+/);
  const text = parts[0].trim();
  const commentary = parts.slice(1).join(' - ').trim();

  entries.push({
    book: book.toUpperCase().startsWith('MAT') ? 'MAT' : book,
    chapter,
    verse,
    text,
    commentary
  });
});

const output = {
  commentary: {
    id: 'matthew-gill',
    name: 'John Gill\'s Exposition of the Entire Bible - Matthew',
    author: 'John Gill',
    book: 'MAT',
    published: 1746,
    description: 'A thorough verse-by-verse commentary on the Gospel of Matthew by John Gill.'
  },
  entries
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log('Generated', outputPath);
