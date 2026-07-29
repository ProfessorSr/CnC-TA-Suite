import test from 'node:test';
import assert from 'node:assert/strict';
import { Logger } from '../../core/utils/logger.js';

test('child loggers share bounded structured diagnostic history', () => {
  const logger = new Logger('Suite', 'error');
  logger.child('Hub').info('Snapshot ready', { version: 1 });
  logger.child('Module').error('Failed', new Error('boom'));
  const snapshot = logger.snapshot();
  assert.equal(snapshot.count, 2);
  assert.equal(snapshot.errors, 1);
  assert.equal(snapshot.entries[0].namespace, 'Suite:Hub');
  assert.equal(snapshot.entries[1].data.message, 'boom');
});
