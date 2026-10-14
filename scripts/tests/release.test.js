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

test('build info: channel, content fingerprint and verification status', () => {
  const info = buildInfo({ RS_CHANNEL: 'preview' });
  assert.equal(info.channel, 'preview');
  assert.match(info.content.fingerprint, /^[0-9a-f]{12}$/);
  assert.equal(info.content.fingerprint, contentFingerprint(), 'the fingerprint depends only on the content');
  const kjv = sourceStatus().find(s => s.id === 'kjv');
  assert.equal(kjv.verified, true);
  assert.equal(typeof kjv.awaitingReview, 'number');
  assert.equal(sourceStatus().find(s => s.id === 'henry').verified, false);
  assert.equal(buildInfo({}).channel, 'dev');
  assert.equal(buildInfo({}).live, undefined);
});
