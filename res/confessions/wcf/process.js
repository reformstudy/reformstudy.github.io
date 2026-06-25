import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourcePath = path.join(__dirname, 'wcf.txt');
const outputPath = path.join(__dirname, 'wcf.json');

const content = fs.readFileSync(sourcePath, 'utf8');
const lines = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
const sections = [];
let currentChapter = null;

for (const line of lines) {
  const chapterMatch = line.match(/^Chapter\s+(\d+)\s*(.*)$/i);
  const sectionMatch = line.match(/^(\d+\.\d+)\s+(.+)$/);

  if (chapterMatch) {
    if (currentChapter) {
      sections.push(currentChapter);
    }
    currentChapter = {
      chapter: Number(chapterMatch[1]),
      title: chapterMatch[2].trim(),
      sections: []
    };
    continue;
  }

  if (sectionMatch && currentChapter) {
    currentChapter.sections.push({
      number: sectionMatch[1],
      content: sectionMatch[2].trim()
    });
    continue;
  }

  if (currentChapter && currentChapter.sections.length > 0) {
    const lastSection = currentChapter.sections[currentChapter.sections.length - 1];
    lastSection.content += ' ' + line;
  }
}

if (currentChapter) {
  sections.push(currentChapter);
}

const output = {
  confession: {
    id: 'wcf',
    name: 'Westminster Confession of Faith',
    abbreviation: 'WCF',
    year: 1647,
    origin: 'Church of Scotland',
    description: 'The Westminster Confession of Faith is a Reformed Christian confession of faith drafted by the 1646 Westminster Assembly.',
    chapters: 33
  },
  sections
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log('Generated', outputPath);
