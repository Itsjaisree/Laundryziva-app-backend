// Run with: node --test test_task_photos.js
const test = require('node:test');
const assert = require('node:assert');
const { parsePhotoList, mergePhotoUrls } = require('./services/taskPhotos');

test('a stored list is read back, bad or empty values give an empty list', () => {
  assert.deepStrictEqual(parsePhotoList('["/api/photos/A","/api/photos/B"]'), ['/api/photos/A', '/api/photos/B']);
  for (const bad of [null, undefined, '', 'not json', '{"a":1}', '"x"']) assert.deepStrictEqual(parsePhotoList(bad), []);
  assert.deepStrictEqual(parsePhotoList('["/a", 5, null, ""]'), ['/a']);
});
test('new photos are added after the existing ones', () => {
  assert.deepStrictEqual(mergePhotoUrls('["/p/1","/p/2"]', ['/p/3'], 10), { merged: ['/p/1', '/p/2', '/p/3'] });
});
test('a photo that is already there is not added twice', () => {
  assert.deepStrictEqual(mergePhotoUrls('["/p/1"]', ['/p/1', '/p/2'], 10), { merged: ['/p/1', '/p/2'] });
});
test('a task with no photos yet takes the new ones', () => {
  assert.deepStrictEqual(mergePhotoUrls(null, ['/p/1'], 10), { merged: ['/p/1'] });
});
test('going over the limit is refused and says how many there are', () => {
  const nine = JSON.stringify(Array.from({ length: 9 }, (_, i) => `/p/${i}`));
  const r = mergePhotoUrls(nine, ['/p/a', '/p/b'], 10);
  assert.ok(r.error && r.error.includes('at most 10') && r.error.includes('9 already'));
  assert.deepStrictEqual(mergePhotoUrls(nine, ['/p/a'], 10).merged.length, 10);   // exactly 10 is allowed
});
