import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import { blobId, compareUnits, resourceOf, unitsOf } from '../release/content-diff.js';
import { buildInfo, contentFingerprint, sourceStatus } from '../release/build-info.js';

test('blobId matches git hash-object', () => {
  const data = Buffer.from('In the beginning\n');
  assert.equal(blobId(data), execFileSync('git', ['hash-object', '--stdin'], { input: data, encoding: 'utf8' }).trim());
});

test('resourceOf groups res/ files by resource', () => {
  assert.equal(resourceOf('res/bibles/kjv/kjv.json'), 'kjv');
  assert.equal(resourceOf('res/commentaries/henry/ROM/8.json'), 'henry');
  assert.equal(resourceOf('res/strongs/greek/greek.json'), 'strongs-greek');
  assert.equal(resourceOf('res/SOURCES.md'), 'docs');
});

test('Bible files compare verse by verse, confessions by section and proofs', () => {
  const bible = verses => JSON.stringify({ books: [{ id: 'GEN', subtitles: {}, verses }] });
  const before = unitsOf('res/bibles/kjv/kjv.json', bible([{ chapter: 6, verse: 5, text: 'And God saw' }, { chapter: 6, verse: 6, text: 'x' }]));
  const after = unitsOf('res/bibles/kjv/kjv.json', bible([{ chapter: 6, verse: 5, text: 'And GOD saw' }, { chapter: 6, verse: 7, text: 'y' }]));
  const { counts, items } = compareUnits(before, after);
  assert.deepEqual(counts, { added: 1, removed: 1, changed: 1 });
  assert.deepEqual(items[0], { unit: 'GEN 6:5', before: 'And God saw', after: 'And GOD saw' });

  const wcf = unitsOf('res/confessions/wcf/wcf.json', JSON.stringify({ sections: [{ sections: [{ number: '8.1', content: 'text', proofs: [{ id: 1, refs: ['1TI.2.5'] }] }] }] }));
  assert.deepEqual([...wcf], [['8.1', 'text'], ['8.1 proofs', '[1] 1TI.2.5']]);
  assert.equal(unitsOf('res/commentaries/henry/ROM/8.json', '{}'), null);
});

test('build info: channel, content fingerprint and where each source comes from', () => {
  const info = buildInfo({ RS_CHANNEL: 'preview' });
  assert.equal(info.channel, 'preview');
  assert.match(info.content.fingerprint, /^[0-9a-f]{12}$/);
  assert.equal(info.content.fingerprint, contentFingerprint(), 'the fingerprint depends only on the content');
  const strongs = sourceStatus().find(s => s.id === 'strongs-greek');
  assert.equal(strongs.organization, 'STEPBible.org, Tyndale House, Cambridge');
  assert.match(strongs.source, /github\.com\/STEPBible\/STEPBible-Data\/tree\/[0-9a-f]{40}/);
  assert.equal(buildInfo({}).channel, 'dev');
  assert.equal(buildInfo({}).live, undefined);
});

test('every source has a credit to show, and STEPBible is credited as its license asks', () => {
  for (const s of sourceStatus()) {
    assert.ok(s.credit?.text, `${s.id} has no credit text`);
    assert.ok(s.credit.links.length && s.credit.links.every(l => l.label && /^https:\/\//.test(l.url)), `${s.id} credit links`);
  }
  const strongs = sourceStatus().find(s => s.id === 'strongs-hebrew');
  assert.match(strongs.credit.text, /STEP Bible/);
  assert.ok(strongs.credit.links.some(l => /stepbible\.org/i.test(l.url)));
  assert.ok(strongs.credit.links.some(l => l.url === 'https://creativecommons.org/licenses/by/4.0/'));
});
