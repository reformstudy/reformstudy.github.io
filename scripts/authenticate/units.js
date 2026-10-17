/**
 * Collecting a source's text into units (verses, titles, paragraphs) while
 * accounting for every character: each piece of text either belongs to a
 * unit or is left out under a named category, and the totals are reported.
 */

export class Units {
  constructor() {
    this.units = new Map();     // key -> text
    this.excluded = new Map();  // category -> characters left out (whitespace not counted)
    this.kept = 0;              // characters kept (whitespace not counted)
  }

  /** Append text to a unit, creating it if needed. */
  add(key, text) {
    this.units.set(key, (this.units.get(key) ?? '') + text);
    this.kept += String(text).replace(/\s/g, '').length;
  }

  /** Start a unit that may stay empty (a verse whose text comes later). */
  open(key) {
    if (this.units.has(key)) throw new Error(`${key} appears twice in the source`);
    this.units.set(key, '');
  }

  /** A word break inside a unit: paragraph and line boundaries. */
  break(key) {
    if (this.units.has(key)) this.units.set(key, `${this.units.get(key)}\n`);
  }

  exclude(category, text) {
    const n = String(text).replace(/\s/g, '').length;
    if (n) this.excluded.set(category, (this.excluded.get(category) ?? 0) + n);
  }

  merge(other) {
    for (const [k, v] of other.units) {
      if (this.units.has(k)) throw new Error(`${k} appears twice in the source`);
      this.units.set(k, v);
    }
    for (const [k, v] of other.excluded) this.excluded.set(k, (this.excluded.get(k) ?? 0) + v);
    this.kept += other.kept;
    return this;
  }
}

/** XML character references, decoded while reading (they are how XML writes &, <, >, quotes and other characters). */
export function decodeXml(text) {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos|nbsp);/g, (_, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[e];
  });
}

/**
 * A small XML tokenizer, separate from the converters' reader: yields
 * { type: 'open' | 'close' | 'empty', name, attrs } and { type: 'text', text }.
 * Comments, processing instructions and the DOCTYPE are skipped.
 */
export function* xmlTokens(xml) {
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>[]*(?:\[[\s\S]*?\])?\s*>|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([A-Za-z_][\w.:-]*)((?:\s+[\w.:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)|(<)/g;
  let m;
  while ((m = re.exec(xml))) {
    if (m[1] !== undefined) { yield { type: 'text', text: m[1] }; continue; }
    if (m[6] !== undefined) { yield { type: 'text', text: decodeXml(m[6]) }; continue; }
    if (m[7] !== undefined) throw new Error(`Unreadable markup at offset ${m.index}: ${xml.slice(m.index, m.index + 40)}`);
    if (!m[3]) continue;
    const attrs = {};
    for (const a of m[4].matchAll(/([\w.:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1]] = decodeXml(a[2] ?? a[3]);
    yield { type: m[2] ? 'close' : m[5] ? 'empty' : 'open', name: m[3], attrs };
  }
}
