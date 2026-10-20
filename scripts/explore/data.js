/**
 * What the pipeline explorer shows (npm run explore), computed from the
 * repository without writing anything:
 *
 *   overview()           each source: its files, sizes, recorded and actual SHA-256
 *   ingest(id)           a converter run in memory: the files it would write, its
 *                        notes and timing, and whether each matches res/
 *   authenticate()       the full authentication report
 *   places(resource)     what can be inspected (books and chapters, entries…)
 *   inspect(resource, place)
 *                        unit by unit: the raw source, the text the authenticator
 *                        reads from it, the converter's output, and the verdict
 *
 * The same readers and comparison that authentication uses are used here, so
 * what you see is what is checked.
 */

import fs from 'fs';
import path from 'path';
import { CANON } from '../lib/canon.js';
import { loadRegistry, sha256 } from '../lib/lock.js';
import { ROOT, readStoredSource, sourceChecksum, storedName } from '../lib/sources.js';
import { resContext } from '../lib/pipeline.js';
import { readZip } from '../lib/zip.js';
import { authenticate, PIPELINES, RESOURCE_EXCEPTIONS } from '../authenticate/index.js';
import { compareText } from '../authenticate/compare.js';
import { readBibleZip, readPlainTextBible } from '../authenticate/bibles.js';
import { outputUnits, rangesFor, readVolume } from '../authenticate/commentaries.js';
import { definitionSource, mainEntries, partOfSpeechFor } from '../authenticate/lexicons.js';
import { compactOf, readOsis } from '../authenticate/refs.js';
import { LANGUAGES } from '../ingest/strongs.js';
import { VOLUMES, verseCounter } from '../ingest/henry.js';

const BY_ID = new Map(CANON.map(b => [b.id, b]));
const ROMAN = [[100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
export const toRoman = n => ROMAN.reduce((s, [v, r]) => { while (n >= v) { s += r; n -= v; } return s; }, '');
const PAGE = 50;

/** The resources the explorer can inspect, and how each is read. */
export const RESOURCES = [
  { id: 'kjv', title: 'King James Version', pipeline: 'kjv', kind: 'bible' },
  { id: 'bsb', title: 'Berean Standard Bible', pipeline: 'bsb', kind: 'bible' },
  { id: 'wcf', title: 'Westminster Confession', pipeline: 'wcf', kind: 'confession' },
  { id: 'henry', title: "Matthew Henry's Commentary", pipeline: 'henry', kind: 'commentary' },
  ...LANGUAGES.map(l => ({ id: l.source, title: `Strong's ${l.language}`, pipeline: 'strongs', kind: 'lexicon', lang: l })),
];

export class Explorer {
  constructor({ root = ROOT } = {}) {
    this.root = root;
    this.cache = new Map();
  }

  memo(key, fn) {
    if (!this.cache.has(key)) this.cache.set(key, fn());
    return this.cache.get(key);
  }

  registry() { return loadRegistry(path.join(this.root, 'provenance/registry.json')); }
  json(rel) { return JSON.parse(fs.readFileSync(path.join(this.root, rel), 'utf8')); }
  files(id) { return this.memo(`files:${id}`, () => readStoredSource(id, { dir: path.join(this.root, 'sources'), registry: this.registry() })); }

  /** Every source: who publishes it, its files (downloaded and stored sizes), and its checksum. */
  overview() {
    const registry = this.registry();
    const sources = Object.entries(registry.sources).map(([id, s]) => {
      const out = {
        id, title: s.title, organization: s.organization ?? null, page: s.page ?? s.repo ?? null,
        license: s.license, published: s.published ?? null, recorded: s.sha256, actual: null, ok: false, files: [], error: null,
      };
      try {
        const files = this.files(id);
        out.files = s.downloads.map(d => {
          const stored = path.join(this.root, 'sources', id, storedName(d.file));
          return { file: d.file, url: d.url, stored: path.relative(this.root, stored), storedBytes: fs.statSync(stored).size, bytes: files.get(d.file).length, sha256: sha256(files.get(d.file)) };
        });
        out.actual = sourceChecksum(files).sha256;
        out.ok = out.actual === s.sha256;
      } catch (err) {
        out.error = err.message;
      }
      return out;
    });
    const pipelines = PIPELINES.map(p => ({ id: p.id, sources: p.sources, owns: p.owns }));
    return { sources, pipelines, resources: RESOURCES.map(({ lang, ...r }) => r) };
  }

  /** Run one converter in memory and compare each file it would write with res/. */
  ingest(id) {
    const p = PIPELINES.find(x => x.id === id);
    if (!p) throw new Error(`No pipeline "${id}"`);
    const files = new Map(p.sources.map(s => [s, this.files(s)]));
    const started = Date.now();
    const { outputs, notes = [], summary = '' } = p.generate(files, resContext(this.root));
    const ms = Date.now() - started;
    const list = [...outputs].map(([rel, text]) => {
      const abs = path.join(this.root, rel);
      const status = !fs.existsSync(abs) ? 'missing from res/' : fs.readFileSync(abs, 'utf8') === text ? 'same' : 'differs from res/';
      return { path: rel, bytes: Buffer.byteLength(text), status };
    });
    return { id, sources: p.sources, ms, summary, notes, files: list, same: list.filter(f => f.status === 'same').length };
  }

  /** One generated file's text, next to what res/ has. */
  generated(id, rel) {
    const p = PIPELINES.find(x => x.id === id);
    const files = new Map(p.sources.map(s => [s, this.files(s)]));
    const text = this.memo(`gen:${id}`, () => p.generate(files, resContext(this.root)).outputs).get(rel);
    const abs = path.join(this.root, rel);
    return { path: rel, generated: text ?? null, committed: fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null };
  }

  /** The full authentication report, with Maps turned into objects. */
  authenticate() {
    const started = Date.now();
    const { ok, report } = authenticate({ root: this.root });
    return {
      ok, ms: Date.now() - started,
      report: report.map(r => ({ id: r.id, checks: r.checks, excluded: r.excluded ? Object.fromEntries(r.excluded) : null })),
    };
  }

  resource(id) {
    const r = RESOURCES.find(x => x.id === id);
    if (!r) throw new Error(`No resource "${id}"`);
    return r;
  }

  /** What can be inspected in a resource: [{ place, label }] grouped as { group, places }. */
  places(id) {
    const r = this.resource(id);
    if (r.kind === 'bible') {
      return CANON.map(b => ({ group: b.name, places: Array.from({ length: b.chapters }, (_, i) => ({ place: `${b.id} ${i + 1}`, label: String(i + 1) })) }));
    }
    if (r.kind === 'commentary') {
      return this.json('res/commentaries/henry/meta.json').books.map(b => ({
        group: b.name,
        places: [...(b.hasIntroduction ? [{ place: `${b.id} introduction`, label: 'Intro' }] : []), ...b.chapters.map(n => ({ place: `${b.id} ${n}`, label: String(n) }))],
      }));
    }
    if (r.kind === 'confession') {
      return [{ group: 'Chapters', places: this.json('res/confessions/wcf/wcf.json').sections.map(c => ({ place: String(c.chapter), label: `${c.chapter}. ${c.title}` })) }];
    }
    const groups = [];
    for (let n = 1; n <= r.lang.max; n += PAGE) {
      const last = Math.min(n + PAGE - 1, r.lang.max);
      groups.push({ place: `${r.lang.prefix}${n}`, label: `${r.lang.prefix}${n}–${last}` });
    }
    return [{ group: 'Entries', places: groups }];
  }

  /** Unit by unit: { units: [{ key, kind, raw, source, output, verdict, notes }], summary }. */
  inspect(id, place) {
    const r = this.resource(id);
    if (r.kind === 'bible') return this.inspectBible(id, place);
    if (r.kind === 'commentary') return this.inspectCommentary(place);
    if (r.kind === 'confession') return this.inspectConfession(place);
    return this.inspectLexicon(r.lang, place);
  }

  // ---- Bibles ----

  bibleSource(id) {
    return this.memo(`read:${id}`, () => (id === 'kjv'
      ? readBibleZip(this.files('kjv').get('eng-kjv_usfm.zip'), 'usfm')
      : readPlainTextBible(this.files('bsb').get('bsb.txt').toString('utf8'))));
  }

  /** The raw lines of a book's chapter in the source file. */
  rawChapter(id, book, chapter) {
    if (id === 'kjv') {
      const files = this.memo('zip:kjv', () => readZip(this.files('kjv').get('eng-kjv_usfm.zip')));
      const usfm = [...files.values()].map(d => d.toString('utf8')).find(t => new RegExp(`^\\\\id ${book}\\b`, 'm').test(t)) ?? '';
      const start = usfm.search(new RegExp(`\\\\c ${chapter}\\s`));
      if (start < 0) return '';
      const next = usfm.slice(start + 3).search(/\\c \d/);
      return usfm.slice(start, next < 0 ? undefined : start + 3 + next);
    }
    const name = book === 'PSA' ? 'Psalm' : BY_ID.get(book).name;
    const lines = this.files('bsb').get('bsb.txt').toString('utf8').split(/\r?\n/).filter(l => l.startsWith(`${name} ${chapter}:`));
    return lines.join('\n');
  }

  /** The raw markup of one verse within its chapter, or of a Psalm title. */
  static rawVerse(id, chapterRaw, verse) {
    if (id === 'bsb') return chapterRaw.split('\n').find(l => new RegExp(`:${verse}\\t`).test(l)) ?? '';
    if (verse === 'title') return chapterRaw.split('\n').filter(l => l.startsWith('\\d')).join('\n');
    const start = chapterRaw.search(new RegExp(`\\\\v ${verse}\\s`));
    if (start < 0) return '';
    const next = chapterRaw.slice(start + 3).search(/\\v \d|\\c \d/);
    return chapterRaw.slice(start, next < 0 ? undefined : start + 3 + next).trim();
  }

  inspectBible(id, place) {
    const [book, ch] = place.split(' ');
    const chapter = Number(ch);
    const { units } = this.bibleSource(id);
    const bible = this.memo(`res:${id}`, () => this.json(`res/bibles/${id}/${id}.json`));
    const out = bible.books.find(b => b.id === book);
    const exceptions = RESOURCE_EXCEPTIONS[id];
    const raw = this.rawChapter(id, book, chapter);
    const titlesInVerseOne = id === 'bsb';
    const rows = [];
    const subtitle = out?.subtitles?.[chapter];
    if (subtitle !== undefined && !titlesInVerseOne) {
      const key = `${book} ${chapter}:title`;
      rows.push(this.row(key, 'Psalm title', Explorer.rawVerse(id, raw, 'title'), units.units.get(key), subtitle, exceptions));
    }
    const keys = [...units.units.keys()].filter(k => k.startsWith(`${book} ${chapter}:`) && !k.endsWith(':title'));
    const outVerses = new Map((out?.verses ?? []).filter(v => v.chapter === chapter).map(v => [`${book} ${chapter}:${v.verse}`, v]));
    for (const k of new Set([...keys, ...outVerses.keys()])) {
      const v = outVerses.get(k);
      const verse = Number(k.split(':')[1]);
      let output = v?.text;
      const notes = [];
      if (titlesInVerseOne && verse === 1 && subtitle !== undefined && v) {
        output = `${subtitle}\n${v.text}`;
        notes.push(`The plain text opens verse 1 with the Psalm's title; the output keeps it apart: title "${subtitle}".`);
      }
      const source = units.units.get(k);
      if (v === undefined && source !== undefined && !source.trim()) notes.push('The publisher leaves this verse empty, so it is not in the output.');
      rows.push(this.row(k, 'verse', Explorer.rawVerse(id, raw, verse), source, output, exceptions, notes));
    }
    rows.sort((a, b) => (a.kind === 'Psalm title' ? -1 : b.kind === 'Psalm title' ? 1 : Number(a.key.split(':')[1]) - Number(b.key.split(':')[1])));
    return this.summarize({ units: rows, exceptions, rawFile: id === 'kjv' ? `sources/kjv/eng-kjv_usfm.zip (book ${book})` : 'sources/bsb/bsb.txt.gz' });
  }

  /** One row: the verdict is null when the output is the source verbatim. */
  row(key, kind, raw, source, output, exceptions = [], notes = []) {
    let verdict;
    if (source === undefined) verdict = 'not in the source';
    else if (output === undefined) verdict = source.trim() ? 'in the source but not in the output' : null;
    else verdict = compareText(source, output, exceptions);
    return { key, kind, raw, source: source ?? null, output: output ?? null, verdict, notes };
  }

  summarize(result) {
    const failed = result.units.filter(u => u.verdict).length;
    return { ...result, summary: { units: result.units.length, failed } };
  }

  // ---- Henry ----

  henry() {
    return this.memo('henry', () => {
      const chapters = new Map();
      const introductions = new Map();
      const raw = VOLUMES.map(v => this.files('henry').get(v).toString('utf8'));
      for (const xml of raw) {
        const vol = readVolume(xml);
        for (const [k, c] of vol.chapters) chapters.set(k, c);
        for (const [k, u] of vol.introductions) introductions.set(k, u);
      }
      return { chapters, introductions, raw };
    });
  }

  /** The raw ThML of a book's chapter (or introduction) block. */
  rawHenry(book, which) {
    const osis = BY_ID.get(book).osis;
    for (const xml of this.henry().raw) {
      // The book's own passage markers (attribute order varies between volumes), not a reference to it.
      const marker = xml.search(new RegExp(`<scripCom(?=[^>]*type="Commentary")(?=[^>]*osisRef="Bible:${osis}\\.)`));
      if (marker < 0) continue;
      const div1 = xml.lastIndexOf('<div1', marker);
      const title = which === 'introduction' ? 'Introduction' : `Chapter ${toRoman(Number(which))}`;
      const found = xml.slice(div1).search(new RegExp(`<div2(?=[^>]*title="${title}")`));
      if (found < 0) return '';
      const start = div1 + found;
      return xml.slice(start, xml.indexOf('</div2>', start) + '</div2>'.length);
    }
    return '';
  }

  inspectCommentary(place) {
    const [book, which] = place.split(' ');
    const { chapters, introductions } = this.henry();
    const isIntro = which === 'introduction';
    const file = this.json(`res/commentaries/henry/${book}/${isIntro ? 'introduction' : which}.json`);
    const source = isIntro ? introductions.get(book) ?? [] : chapters.get(`${book} ${which}`)?.units ?? [];
    const output = outputUnits(file);
    const raw = this.rawHenry(book, which);
    const rows = [];
    for (let i = 0; i < Math.max(source.length, output.length); i++) {
      const s = source[i];
      const o = output[i];
      const notes = [];
      if (s && o && s.kind !== o.kind) notes.push(`kind: the source has a ${s.kind}, the output a ${o.kind}`);
      if (s && o?.refs) {
        const expected = s.refs.map(r => readOsis(r.osis)).filter(Boolean).map(compactOf);
        const got = o.refs.map(r => r.ref);
        notes.push(JSON.stringify(expected) === JSON.stringify(got) ? `references: ${got.join(', ') || 'none'}` : `references differ: output ${got.join(', ') || 'none'}, source ${expected.join(', ') || 'none'}`);
      }
      const row = this.row(`${place} · ${i + 1}`, s?.kind ?? o?.kind, null, s?.text, o?.text, [], notes);
      if (notes.some(n => n.startsWith('kind:') || n.startsWith('references differ'))) row.verdict ??= notes.find(n => n.startsWith('kind:') || n.startsWith('references differ'));
      rows.push(row);
    }
    let sections = null;
    if (!isIntro) {
      const kjv = this.memo('res:kjv', () => this.json('res/bibles/kjv/kjv.json'));
      const expected = rangesFor(chapters.get(`${book} ${which}`)?.blocks ?? [], verseCounter(kjv)(book, Number(which)));
      sections = file.sections.map((s, i) => ({ start: s.start, end: s.end, title: s.title ?? null, paragraphs: s.paragraphs.length, expected: expected[i] ?? null, ok: expected[i]?.start === s.start && expected[i]?.end === s.end }));
    }
    return this.summarize({ units: rows, exceptions: [], raw, sections, rawFile: 'sources/henry/mhc*.xml.gz' });
  }

  // ---- the Confession ----

  inspectConfession(place) {
    const source = this.memo('wcf-src', () => JSON.parse(this.files('wcf').get('westminster_confession_of_faith.json').toString('utf8')));
    const output = this.json('res/confessions/wcf/wcf.json');
    const ch = source.Data.find(c => Number(c.Chapter) === Number(place));
    const out = output.sections.find(c => c.chapter === Number(place));
    const rows = [this.row(`${place} title`, 'chapter title', JSON.stringify({ Title: ch.Title }), ch.Title, out?.title)];
    for (const s of ch.Sections) {
      const number = `${Number(ch.Chapter)}.${Number(s.Section)}`;
      const o = out?.sections.find(x => x.number === number);
      const proofs = [...(s.Proofs ?? [])].sort((a, b) => a.Id - b.Id);
      const notes = proofs.map(p => {
        const expected = p.References.map(readOsis).map(r => (r ? compactOf(r) : '?'));
        const got = o?.proofs.find(x => x.id === p.Id)?.refs ?? [];
        return `[${p.Id}] ${p.References.join(', ')} → ${got.join(', ')}${JSON.stringify(got) === JSON.stringify(expected) ? '' : ` (expected ${expected.join(', ')})`}`;
      });
      const row = this.row(number, 'section', JSON.stringify(s, null, 1), s.ContentWithProofs ?? s.Content, o?.contentWithProofs, [], notes);
      if (!row.verdict && o && o.content !== s.Content) row.verdict = 'the plain text differs';
      if (!row.verdict && notes.some(n => n.includes('(expected'))) row.verdict = 'a proof reference differs';
      rows.push(row);
    }
    return this.summarize({ units: rows, exceptions: [], rawFile: 'sources/wcf/westminster_confession_of_faith.json.gz' });
  }

  // ---- Strong's ----

  inspectLexicon(lang, place) {
    const first = Number(place.slice(1));
    const tsv = this.memo(`tsv:${lang.source}`, () => this.files(lang.source).get(lang.file).toString('utf8'));
    const { main } = this.memo(`main:${lang.source}`, () => mainEntries(tsv, lang));
    const output = this.memo(`res:${lang.source}`, () => this.json(lang.output));
    const byNumber = new Map(output.entries.map(e => [Number(e.number.slice(1)), e]));
    const lines = tsv.split(/\r?\n/);
    const rows = [];
    for (let n = first; n < first + PAGE && n <= lang.max; n++) {
      const m = main.get(n);
      const e = byNumber.get(n);
      if (!m && !e) continue;
      const id = `${lang.prefix}${String(n).padStart(4, '0')}`;
      const raw = lines.filter(l => l.startsWith(id)).join('\n');
      const r = m?.r;
      const notes = [];
      const fields = [];
      for (const [field, value] of [['lemma', r?.lemma], ['transliteration', r?.translit], ['gloss', r?.gloss]]) {
        const expected = value?.trim() || undefined;
        notes.push(`${field}: ${e?.[field] ?? '—'}${e?.[field] === expected ? '' : ` (source: ${expected ?? '—'})`}`);
        if (e?.[field] !== expected) fields.push(field);
      }
      const pos = r ? partOfSpeechFor(r.morph) : undefined;
      notes.push(`part of speech: ${e?.partOfSpeech ?? '—'} from code ${r?.morph ?? '—'}${e?.partOfSpeech === pos ? '' : ` (expected ${pos ?? '—'})`}`);
      if (e?.partOfSpeech !== pos) fields.push('part of speech');
      const definition = r ? definitionSource(r.meaning) : undefined;
      const kind = m?.isMain === false ? 'entry (no main row marked; the first row is used)' : 'entry';
      let row;
      if (lang.definitions === false) {
        notes.unshift('definition: left out until Online Bible gives permission (see the file\'s notes)');
        row = { key: `${lang.prefix}${n}`, kind, raw, source: definition ?? null, output: e?.definition ?? null, verdict: e?.definition !== undefined ? 'the definition should be left out' : !e ? 'in the source but not in the output' : null, notes };
      } else {
        row = this.row(`${lang.prefix}${n}`, kind, raw, definition, e?.definition, ['STEPBible indentation'], notes);
      }
      if (!row.verdict && fields.length) row.verdict = `${fields.join(', ')} differ${fields.length === 1 ? 's' : ''}`;
      rows.push(row);
    }
    return this.summarize({ units: rows, exceptions: ['STEPBible indentation'], rawFile: `sources/${lang.source}/${lang.file}.gz` });
  }
}
