/**
 * Authenticating the built site: docs/resources/ must carry exactly the
 * content of res/. The build reformats files (one file per Bible book, JSON
 * without indentation) but must not change a single value.
 */

import fs from 'fs';
import path from 'path';
import { isDeepStrictEqual } from 'util';
import { filesUnder } from '../lib/pipeline.js';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));

/**
 * Compare docs/resources/ (siteDir) with res/ (under root). Returns { problems, files }.
 * Only resources produced from sources are checked; see PRODUCED.
 */
export function authenticateSite(root, siteDir) {
  const problems = [];
  let files = 0;
  const same = (label, built, expected) => {
    files++;
    if (built === undefined) problems.push(`${label}: missing from the site`);
    else if (!isDeepStrictEqual(built, expected)) problems.push(`${label}: differs from res/`);
  };
  const site = rel => {
    const f = path.join(siteDir, rel);
    return fs.existsSync(f) ? read(f) : undefined;
  };

  for (const id of ['kjv', 'bsb']) {
    const bible = read(path.join(root, `res/bibles/${id}/${id}.json`));
    same(`bible-${id}.json`, site(`bible-${id}.json`), bible);
    for (const book of bible.books) same(`bibles/${id}/${book.id}.json`, site(`bibles/${id}/${book.id}.json`), book);
    const index = site(`bibles/${id}/index.json`);
    same(`bibles/${id}/index.json`, index, {
      version: bible.version,
      books: bible.books.map(({ verses, subtitles, ...meta }) => {
        const verseCounts = new Array(meta.chapters).fill(0);
        for (const v of verses) verseCounts[v.chapter - 1] = Math.max(verseCounts[v.chapter - 1], v.verse);
        return { ...meta, verseCounts };
      }),
    });
  }
  same('confession-wcf.json', site('confession-wcf.json'), read(path.join(root, 'res/confessions/wcf/wcf.json')));
  for (const lang of ['greek', 'hebrew']) {
    same(`strongs-${lang}.json`, site(`strongs-${lang}.json`), read(path.join(root, `res/strongs/${lang}/${lang}.json`)));
  }
  const henry = filesUnder('res/commentaries/henry', root).filter(f => f.endsWith('.json'));
  for (const f of henry) {
    const rel = f.replace(/^res\//, '');
    same(rel, site(rel), read(path.join(root, f)));
  }
  const built = filesUnder('commentaries/henry', siteDir).length;
  if (built !== henry.length) problems.push(`commentaries/henry: ${built} files on the site, ${henry.length} in res/`);
  return { problems, files };
}
