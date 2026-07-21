import test from 'node:test';
import assert from 'node:assert/strict';
import { allianceRecipients, coordinateBbcode } from '../../modules/communications/index.js';

test('communications formats selected coordinates for native chat and mail', () => {
  assert.equal(coordinateBbcode(123.4, 456.6), '[coords]123:457[/coords]');
});

test('communications expands alliance recipient groups without duplicates', () => {
  const members = [
    { Name: 'Alpha', RoleName: 'Leader' },
    { Name: 'Bravo', RoleName: 'Second Commander' },
    { Name: 'Charlie', RoleName: 'Officer' },
    { Name: 'charlie', RoleName: 'Officer' },
    { Name: 'Delta', RoleName: 'Member' }
  ];
  assert.deepEqual(allianceRecipients(members, 'all'), ['Alpha', 'Bravo', 'Charlie', 'Delta']);
  assert.deepEqual(allianceRecipients(members, 'cic'), ['Alpha']);
  assert.deepEqual(allianceRecipients(members, 'sic'), ['Bravo']);
  assert.deepEqual(allianceRecipients(members, 'officers'), ['Charlie']);
});

test('communications ignores empty alliance member names safely', () => {
  assert.deepEqual(allianceRecipients([{ Name: null, RoleName: null }, null], 'all'), []);
});
