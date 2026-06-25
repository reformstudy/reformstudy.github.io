import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourcePath = path.join(__dirname, 'hebrew.txt');
const outputPath = path.join(__dirname, 'hebrew.json');

const content = fs.readFileSync(sourcePath, 'utf8');
const entries = [];

content.split(/\r?\n/).forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;

  const parts = trimmed.split(/\t|\|/).map(part => part.trim()).filter(Boolean);
  if (parts.length < 6) return;

  const [number, transliteration, pronunciation, partOfSpeech, definition, kjvDefinition, usageCount = '0'] = parts;
  entries.push({
    number,
    transliteration,
    pronunciation,
    partOfSpeech,
    definition,
    kjvDefinition,
    usageCount: Number(usageCount),
    references: []
  });
});

const output = {
  concordance: {
    id: 'hebrew',
    name: "Strong's Hebrew Concordance",
    language: 'Hebrew',
    totalEntries: entries.length,
    version: '1890'
  },
  entries
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log('Generated', outputPath);
