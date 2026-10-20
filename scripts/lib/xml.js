/**
 * A small, forgiving XML reader for the ThML files CCEL publishes: elements,
 * attributes and text, with the common named and numeric entities decoded.
 * Comments, processing instructions, the DOCTYPE and CDATA are skipped.
 */

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', aelig: 'æ', AElig: 'Æ', oelig: 'œ', OElig: 'Œ',
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë', aacute: 'á', agrave: 'à', acirc: 'â', auml: 'ä',
  iacute: 'í', icirc: 'î', iuml: 'ï', oacute: 'ó', ocirc: 'ô', ouml: 'ö', uacute: 'ú', ucirc: 'û', uuml: 'ü',
  ccedil: 'ç', ntilde: 'ñ', dagger: '†', sect: '§', para: '¶', middot: '·', times: '×', deg: '°',
};

export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ENTITIES[e] ?? m;
  });
}

/** Parse XML into { name, attrs, children } elements; text children are strings. Returns the root. */
export function parseXml(xml) {
  const root = { name: '#root', attrs: {}, children: [] };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<!DOCTYPE[^>[]*(?:\[[\s\S]*?\])?\s*>|<(\/?)([A-Za-z_][\w.:-]*)((?:\s+[\w.:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  let last = 0;
  let m;
  while ((m = re.exec(xml))) {
    if (m.index > last) stack[stack.length - 1].children.push(decodeEntities(xml.slice(last, m.index)));
    last = re.lastIndex;
    if (!m[2]) continue; // comment, PI, DOCTYPE, CDATA
    const [, closing, name, attrText, selfClosing] = m;
    if (closing) {
      // Close up to the matching element; tolerate stray closers.
      const i = stack.map(e => e.name).lastIndexOf(name);
      if (i > 0) stack.length = i;
      continue;
    }
    const attrs = {};
    for (const a of attrText.matchAll(/([\w.:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1]] = decodeEntities(a[2] ?? a[3]);
    const el = { name, attrs, children: [] };
    stack[stack.length - 1].children.push(el);
    if (!selfClosing) stack.push(el);
  }
  if (last < xml.length) stack[stack.length - 1].children.push(decodeEntities(xml.slice(last)));
  return root;
}

export const elements = el => el.children.filter(c => typeof c !== 'string');

/** All descendants (depth first) matching a predicate. */
export function findAll(el, pred, out = []) {
  for (const c of el.children) {
    if (typeof c === 'string') continue;
    if (pred(c)) out.push(c);
    findAll(c, pred, out);
  }
  return out;
}

/** The text of an element, whitespace collapsed. */
export function textOf(el) {
  const parts = [];
  const walk = e => { for (const c of e.children) typeof c === 'string' ? parts.push(c) : walk(c); };
  walk(el);
  return parts.join('').replace(/\s+/g, ' ').trim();
}
