const test = require('node:test');
const assert = require('node:assert/strict');
const TXN = require('../src/triad_transactions.js');

test('transaction IDs are stable and namespaced by run', () => {
  const run = { id: 'RUN-A' };
  assert.equal(TXN.id(run, 'combat_reward', '4:2'), 'RUN-A:COMBAT_REWARD:4:2');
  assert.notEqual(TXN.id(run, 'route', 4), TXN.id({ id: 'RUN-B' }, 'route', 4));
});

test('commits are exactly-once and survive serialization', () => {
  const run = { id: 'RUN-A', transactionLedger: {} };
  const transactionId = TXN.id(run, 'EVENT_ARTIFACT', 7);
  assert.equal(TXN.commit(run, transactionId, { selectedId: 'ART-1' }), true);
  assert.equal(TXN.commit(run, transactionId, { selectedId: 'ART-2' }), false);
  const restored = JSON.parse(JSON.stringify(run));
  assert.equal(TXN.isCommitted(restored, transactionId), true);
  assert.equal(restored.transactionLedger[transactionId].payload.selectedId, 'ART-1');
});

test('pending records and legacy combat state normalize without replaying effects', () => {
  const run = { id: 'RUN-A', combat: { turn: 3 } };
  const pending = TXN.pending(run, 'COMBAT_REWARD', '3:1', { stage: 3, rewardOffer: ['A', 'B', 'C'] });
  assert.equal(TXN.isPending(pending, 'COMBAT_REWARD', 3), true);
  TXN.restore(run);
  assert.equal(run.combat.phase, 'PLAYER');
  assert.equal(run.combat.inputLocked, false);
  assert.equal(run.combat.actionToken, 0);
  assert.deepEqual(run.transactionLedger, {});
});
