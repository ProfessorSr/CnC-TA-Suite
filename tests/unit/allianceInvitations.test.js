import test from 'node:test';
import assert from 'node:assert/strict';
import { AllianceHub } from '../../modules/alliance/alliance-hub.js';

function hubWith(response) {
  const hub = new AllianceHub({});
  hub.root = () => ({ Data: { Ranking: { EViewType: { Player: 0 }, ERankingType: { Score: 0 } } } });
  hub.command = async () => response;
  return hub;
}

test('Alliance invitation search normalizes ranked player data', async () => {
  const hub = hubWith({ p: [
    { p: 42, pn: 'Alpha', r: 3, s: 9000, bc: 4, ol: 31, dl: 29, a: 7, an: 'Seven' },
    { p: 84, pn: 'Solo', r: 8, s: 5000, bc: 2, ol: 24, dl: 20, a: 0, an: '' }
  ] });
  const players = await hub.searchPlayers({ mode: 'top', limit: 100 });
  assert.deepEqual(players[0], {
    id: '42', name: 'Alpha', rank: 3, score: 9000, bases: 4,
    offense: 31, defense: 29, allianceId: '7', alliance: 'Seven', faction: ''
  });
});

test('Alliance invitation search filters unaffiliated and specified-alliance players', async () => {
  const response = { p: [
    { p: 1, pn: 'Member', a: 7, an: 'Seven' },
    { p: 2, pn: 'Solo', a: 0, an: '' }
  ] };
  assert.deepEqual((await hubWith(response).searchPlayers({ mode: 'no-alliance' })).map((p) => p.name), ['Solo']);
  assert.deepEqual((await hubWith(response).searchPlayers({ mode: 'alliance', allianceId: '7' })).map((p) => p.name), ['Member']);
});
