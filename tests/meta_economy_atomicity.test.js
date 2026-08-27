const test = require('node:test');
const assert = require('node:assert/strict');
const META = require('../src/triad_meta_progression.js');

const H = META.HOUR_MS;
const roster = Array.from({ length: 6 }, (_, index) => `TRIAD-CHAR-00${index + 1}`);
const reload = value => JSON.parse(JSON.stringify(value));

function fundedProfile(now = 1_000) {
  const profile = META.defaultProfile(now, roster);
  profile.wallet.credits = 5_000;
  profile.wallet.cardMatrices = 100;
  return profile;
}

test('shop item survives pre-write retry and post-write duplicate without double debit', () => {
  const original = fundedProfile();
  const transactionId = 'SHOP:CARD_MATRIX_PACK:ATOMIC-1';

  const discardedBeforeWrite = META.purchaseShopItem(original, 'CARD_MATRIX_PACK', transactionId, 2_000, roster);
  assert.equal(discardedBeforeWrite.purchased, true);

  const retriedFromOldStorage = META.purchaseShopItem(reload(original), 'CARD_MATRIX_PACK', transactionId, 2_000, roster);
  assert.equal(retriedFromOldStorage.purchased, true);
  assert.equal(retriedFromOldStorage.profile.wallet.credits, 4_880);
  assert.equal(retriedFromOldStorage.profile.wallet.cardMatrices, 103);

  const persisted = reload(retriedFromOldStorage.profile);
  const duplicateAfterWrite = META.purchaseShopItem(persisted, 'CARD_MATRIX_PACK', transactionId, 2_001, roster);
  assert.equal(duplicateAfterWrite.purchased, false);
  assert.equal(duplicateAfterWrite.reason, 'DUPLICATE');
  assert.equal(duplicateAfterWrite.profile.wallet.credits, 4_880);
  assert.equal(duplicateAfterWrite.profile.wallet.cardMatrices, 103);
});

test('card purchase and card upgrade are idempotent across serialized reloads', () => {
  let profile = fundedProfile();
  const buyId = 'SHOP_CARD:EMBER_01:ATOMIC-1';
  let result = META.purchaseCard(profile, 'EMBER_01', 240, buyId, 2_000, roster);
  assert.equal(result.purchased, true);
  profile = reload(result.profile);

  const duplicateBuy = META.purchaseCard(profile, 'EMBER_01', 240, buyId, 2_001, roster);
  assert.equal(duplicateBuy.reason, 'DUPLICATE');
  assert.equal(duplicateBuy.profile.wallet.credits, 4_760);
  assert.equal(duplicateBuy.profile.cardCollection.EMBER_01.level, 1);

  const upgradeId = 'UPGRADE:EMBER_01:ATOMIC-1';
  result = META.upgradeCard(profile, 'EMBER_01', upgradeId, 3_000, roster);
  assert.equal(result.upgraded, true);
  profile = reload(result.profile);
  const matricesAfter = profile.wallet.cardMatrices;

  const duplicateUpgrade = META.upgradeCard(profile, 'EMBER_01', upgradeId, 3_001, roster);
  assert.equal(duplicateUpgrade.reason, 'DUPLICATE');
  assert.equal(duplicateUpgrade.profile.cardCollection.EMBER_01.level, 2);
  assert.equal(duplicateUpgrade.profile.wallet.cardMatrices, matricesAfter);
});

test('permanent base-energy purchase is exactly-once and never exceeds +2', () => {
  let profile = fundedProfile();
  let result = META.purchaseShopItem(profile, 'ACTION_CELL', 'CELL:1', 2_000, roster);
  profile = reload(result.profile);
  const duplicate = META.purchaseShopItem(profile, 'ACTION_CELL', 'CELL:1', 2_001, roster);
  assert.equal(duplicate.reason, 'DUPLICATE');
  assert.equal(duplicate.profile.baseEnergyBonus, 1);
  assert.equal(duplicate.profile.wallet.credits, 4_300);

  result = META.purchaseShopItem(profile, 'ACTION_CELL', 'CELL:2', 3_000, roster);
  assert.equal(result.purchased, true);
  const capped = META.purchaseShopItem(result.profile, 'ACTION_CELL', 'CELL:3', 4_000, roster);
  assert.equal(capped.reason, 'MAXED');
  assert.equal(capped.profile.baseEnergyBonus, 2);
  assert.equal(capped.profile.wallet.credits, 3_600);
});

test('idle reward boundary contract is exact from negative time through 72 hours', () => {
  const start = 10_000;
  const profile = META.defaultProfile(start, roster);
  const cases = [
    { delta: -1, actual: 0, effective: 0, credits: 0, phase: 'CLOCK_ROLLBACK', percent: 0 },
    { delta: 0, actual: 0, effective: 0, credits: 0, phase: 'FULL', percent: 100 },
    { delta: 24 * H - 1, actual: 24 - 1 / H, effective: 24 - 1 / H, credits: 959, phase: 'FULL', percent: 100 },
    { delta: 24 * H, actual: 24, effective: 24, credits: 960, phase: 'REDUCED', percent: 50 },
    { delta: 48 * H - 1, actual: 48 - 1 / H, effective: 36 - 0.5 / H, credits: 1_439, phase: 'REDUCED', percent: 50 },
    { delta: 48 * H, actual: 48, effective: 36, credits: 1_440, phase: 'STOPPED', percent: 0 },
    { delta: 72 * H, actual: 72, effective: 36, credits: 1_440, phase: 'STOPPED', percent: 0 }
  ];

  for (const entry of cases) {
    const preview = META.previewIdle(profile, start + entry.delta);
    assert.ok(Math.abs(preview.elapsedSinceClaimHours - entry.actual) < 1e-9);
    assert.ok(Math.abs(preview.effectiveHours - entry.effective) < 1e-9);
    assert.equal(preview.rewards.credits, entry.credits);
    assert.equal(preview.accrualPhase, entry.phase);
    assert.equal(preview.currentRatePercent, entry.percent);
  }
});

test('idle claim is exactly-once across click, reload, and retry injection', () => {
  const start = 10_000;
  const now = start + 36 * H;
  const original = META.defaultProfile(start, roster);
  const transactionId = `IDLE:${start}:${now}`;

  const discardedBeforeWrite = META.claimIdle(original, now, roster, transactionId);
  assert.equal(discardedBeforeWrite.claimed, true);

  const retryFromOldStorage = META.claimIdle(reload(original), now, roster, transactionId);
  assert.equal(retryFromOldStorage.claimed, true);
  assert.equal(retryFromOldStorage.profile.wallet.credits, 1_200);
  assert.equal(retryFromOldStorage.preview.elapsedSinceClaimHours, 36);
  assert.equal(retryFromOldStorage.preview.accrualPhase, 'REDUCED');
  assert.equal(retryFromOldStorage.preview.currentRatePercent, 50);

  const persisted = reload(retryFromOldStorage.profile);
  const duplicateAfterWrite = META.claimIdle(persisted, now, roster, transactionId);
  assert.equal(duplicateAfterWrite.claimed, false);
  assert.equal(duplicateAfterWrite.reason, 'DUPLICATE');
  assert.equal(duplicateAfterWrite.profile.wallet.credits, 1_200);
  assert.equal(duplicateAfterWrite.profile.idle.lastClaimAt, now);
  const immediatelyAfter = META.previewIdle(duplicateAfterWrite.profile, now);
  assert.equal(immediatelyAfter.elapsedSinceClaimHours, 0);
  assert.equal(immediatelyAfter.accrualPhase, 'FULL');
  assert.equal(immediatelyAfter.currentRatePercent, 100);
  assert.equal(immediatelyAfter.claimable, false);
});

test('daily offers are stable for ten reloads and rotate once at Korea midnight', () => {
  const pools = Array.from({ length: 6 }, (_, core) => Array.from({ length: 20 }, (_, card) => `CORE${core + 1}_${String(card + 1).padStart(2, '0')}`));
  const beforeMidnight = Date.UTC(2026, 7, 23, 14, 59, 59);
  const afterMidnight = beforeMidnight + 1_000;
  const before = META.dailyOfferIds(pools, beforeMidnight);
  for (let index = 0; index < 10; index++) assert.deepEqual(META.dailyOfferIds(reload(pools), beforeMidnight), before);
  const after = META.dailyOfferIds(pools, afterMidnight);
  assert.notDeepEqual(after, before);
  for (let index = 0; index < 10; index++) assert.deepEqual(META.dailyOfferIds(reload(pools), afterMidnight), after);
  assert.equal(META.dailyOfferEpochDay(afterMidnight), META.dailyOfferEpochDay(beforeMidnight) + 1);
});
