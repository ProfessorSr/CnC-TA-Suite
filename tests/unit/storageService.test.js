import test from 'node:test';
import assert from 'node:assert/strict';
import { StorageService } from '../../core/storage/storage.js';

test('StorageService selects local storage once after the extension bridge fails', async () => {
  let primaryReads = 0;
  let primaryWrites = 0;
  let warnings = 0;
  const primary = {
    async get() { primaryReads += 1; throw new Error('bridge unavailable'); },
    async set() { primaryWrites += 1; throw new Error('should not retry'); },
    async remove() { throw new Error('should not retry'); }
  };
  const values = new Map([['existing', 7]]);
  const fallback = {
    async get(key) { return values.get(key); },
    async set(key, value) { values.set(key, value); return true; },
    async remove(key) { values.delete(key); return true; }
  };
  const storage = new StorageService({ warn: () => { warnings += 1; } }, { primary, fallback });

  assert.equal(await storage.get('existing', 0), 7);
  assert.equal(await storage.get('missing', 9), 9);
  await storage.set('saved', 12);
  await storage.remove('existing');

  assert.equal(primaryReads, 1);
  assert.equal(primaryWrites, 0);
  assert.equal(warnings, 1);
  assert.equal(values.get('saved'), 12);
  assert.equal(values.has('existing'), false);
});
