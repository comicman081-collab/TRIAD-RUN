const test = require('node:test');
const assert = require('node:assert/strict');
const META = require('../src/triad_meta_progression.js');

const H = META.HOUR_MS;
const roster = Array.from({ length: 6 }, (_, index) => `TRIAD-CHAR-00${index + 1}`);

test('default profile keeps the six frozen roster characters and the first lobby background', () => {
  const profile = META.defaultProfile(1000, roster);
  assert.deepEqual(profile.ownedCharacterIds, roster);
  assert.equal(profile.selectedLobbyCharacterId, roster[0]);
  assert.deepEqual(profile.unlockedLobbyBackgroundIds, ['LOBBY-BG-01']);
});

test('idle rewards pay 24h full rate, 24h half rate, then stop at 48h', () => {
  const profile = META.defaultProfile(1000, roster);
  const at24 = META.previewIdle(profile, 1000 + 24 * H);
  const at48 = META.previewIdle(profile, 1000 + 48 * H);
  const at72 = META.previewIdle(profile, 1000 + 72 * H);
  assert.equal(at24.effectiveHours, 24);
  assert.equal(at48.effectiveHours, 36);
  assert.deepEqual(at48.rewards, at72.rewards);
  assert.equal(at48.capped, true);
  assert.equal(at24.accrualPhase, 'REDUCED');
  assert.equal(at24.currentRatePercent, 50);
  assert.equal(at48.accrualPhase, 'STOPPED');
  assert.equal(at48.currentRatePercent, 0);
  assert.equal(at72.elapsedSinceClaimHours, 72);
  assert.equal(at48.rewards.credits, META.IDLE_RATES.credits * 36);
});

test('negative clock movement never creates idle rewards', () => {
  const profile = META.defaultProfile(10 * H, roster);
  const preview = META.previewIdle(profile, 9 * H);
  assert.equal(preview.effectiveHours, 0);
  assert.equal(preview.elapsedSinceClaimHours, 0);
  assert.equal(preview.accrualPhase, 'CLOCK_ROLLBACK');
  assert.equal(preview.currentRatePercent, 0);
  assert.equal(preview.claimable, false);
});

test('stage rewards are idempotent and unlock one lobby background every ten stages', () => {
  let profile = META.defaultProfile(1000, roster);
  let result = META.applyStageClear(profile, { stage: 10, type: 'boss', transactionId: 'RUN:A:STAGE:10', now: 2000 }, roster);
  assert.equal(result.committed, true);
  assert.ok(result.profile.unlockedLobbyBackgroundIds.includes('LOBBY-BG-02'));
  const credits = result.profile.wallet.credits;
  result = META.applyStageClear(result.profile, { stage: 10, type: 'boss', transactionId: 'RUN:A:STAGE:10', now: 3000 }, roster);
  assert.equal(result.committed, false);
  assert.equal(result.profile.wallet.credits, credits);
});

test('open-ended stages never request an eleventh lobby background', () => {
  let profile = META.defaultProfile(1000, roster);
  for (const stage of [90, 100, 110, 120]) {
    const result = META.applyStageClear(profile, {
      stage,
      type: stage % 10 === 0 ? 'boss' : 'battle',
      transactionId: `RUN:OPEN:STAGE:${stage}`,
      now: 2000 + stage
    }, roster);
    assert.equal(result.committed, true);
    profile = result.profile;
    assert.equal(profile.unlockedLobbyBackgroundIds.length, META.LOBBY_BACKGROUNDS.length);
    assert.deepEqual(profile.unlockedLobbyBackgroundIds, META.LOBBY_BACKGROUNDS.map(background => background.id));
    assert.ok(profile.unlockedLobbyBackgroundIds.every(id => META.LOBBY_BACKGROUNDS.some(background => background.id === id && background.path)));
    if (stage > 90) assert.deepEqual(result.unlocked, []);
  }
  assert.equal(profile.maxStageCleared, 120);
});

test('shop action cell respects funds and the permanent +2 cap', () => {
  let profile = META.defaultProfile(1000, roster);
  profile.wallet.credits = 5000;
  for (let index = 0; index < 2; index++) {
    const result = META.purchaseShopItem(profile, 'ACTION_CELL', `CELL:${index}`, 2000 + index, roster);
    assert.equal(result.purchased, true);
    profile = result.profile;
  }
  const blocked = META.purchaseShopItem(profile, 'ACTION_CELL', 'CELL:2', 3000, roster);
  assert.equal(blocked.purchased, false);
  assert.equal(blocked.reason, 'MAXED');
  assert.equal(blocked.profile.baseEnergyBonus, 2);
});

test('purchased cards use matrices to upgrade from level 1 through level 5', () => {
  let profile = META.defaultProfile(1000, roster);
  profile.wallet.credits = 1000;
  profile.wallet.cardMatrices = 100;
  let result = META.purchaseCard(profile, 'EMBER_01', 240, 'BUY:EMBER_01', 2000, roster);
  assert.equal(result.purchased, true);
  profile = result.profile;
  for (let level = 2; level <= 5; level++) {
    result = META.upgradeCard(profile, 'EMBER_01', `UP:${level}`, 2000 + level, roster);
    assert.equal(result.upgraded, true);
    profile = result.profile;
  }
  assert.equal(profile.cardCollection.EMBER_01.level, 5);
  assert.equal(META.upgradeCard(profile, 'EMBER_01', 'UP:6', 3000, roster).reason, 'MAXED');
});

test('character breakthrough spends growth data once, persists, and stops at the level-five cap', () => {
  let profile = META.defaultProfile(1000, roster);
  profile.wallet.memory = META.BREAKTHROUGH_COSTS.reduce((sum, cost) => sum + cost, 0);
  const totalCost = profile.wallet.memory;
  for (let level = 1; level <= META.BREAKTHROUGH_MAX; level++) {
    const result = META.upgradeCharacter(profile, roster[0], `BREAK:${level}`, 2000 + level, roster);
    assert.equal(result.upgraded, true);
    assert.equal(result.level, level);
    profile = result.profile;
  }
  assert.equal(META.characterBreakthrough(profile, roster[0]), META.BREAKTHROUGH_MAX);
  assert.equal(profile.wallet.memory, 0);
  assert.equal(totalCost, META.BREAKTHROUGH_COSTS.reduce((sum, cost) => sum + cost, 0));
  assert.equal(META.upgradeCharacter(profile, roster[0], 'BREAK:MAX', 3000, roster).reason, 'MAXED');
  assert.equal(META.upgradeCharacter(profile, roster[1], 'BREAK:LOW', 3000, roster).reason, 'INSUFFICIENT_MEMORY');
  const replay = META.upgradeCharacter(profile, roster[0], 'BREAK:5', 3001, roster);
  assert.equal(replay.reason, 'DUPLICATE');
});

test('character gacha stays asset-gated and draws exactly once when a future record is ready', () => {
  const future = {
    id: 'TRIAD-CHAR-007',
    name: '미래 캐릭터',
    enabled: true,
    acquisition: 'GACHA',
    gachaEligible: true,
    fullArt: 'card_art/signature/future.webp',
    lobbyArt: {
      status: 'PASS_ACTIVE', assetType: 'NON_SD_CHARACTER_RGBA', backgroundPolicy: 'TRANSPARENT_ONLY',
      backgroundRemoved: true, alphaValidated: true, path: 'assets/characters/roster/TRIAD-CHAR-007/lobby/future.png'
    },
    sd: { status: 'PASS_ACTIVE_FINAL', manifest: 'assets/characters/roster/TRIAD-CHAR-007/sd/sd_manifest.json' }
  };
  let profile = META.defaultProfile(1000, roster);
  profile.wallet.signal = META.GACHA_SINGLE_COST;
  let result = META.drawCharacter(profile, [future], 'GACHA:001', 2000, 0, roster);
  assert.equal(result.drawn, true);
  assert.equal(result.characterId, future.id);
  assert.deepEqual(result.profile.ownedCharacterIds.includes(future.id), true);
  assert.equal(result.profile.wallet.signal, 0);
  assert.equal(result.receipt.result, 'DRAWN');
  let randomCalls = 0;
  for (let attempt = 0; attempt < 10; attempt++) {
    const duplicate = META.drawCharacter(result.profile, [future], 'GACHA:001', 3000 + attempt, () => { randomCalls++; throw new Error('replay must not roll'); }, roster);
    assert.equal(duplicate.reason, 'DRAWN');
    assert.equal(duplicate.replayed, true);
    assert.equal(duplicate.drawn, true);
    assert.equal(duplicate.characterId, future.id);
    assert.equal(duplicate.profile.wallet.signal, 0);
  }
  assert.equal(randomCalls, 0);
  const noCandidate = META.drawCharacter(META.defaultProfile(1000, roster), [], 'GACHA:002', 2000, 0, roster);
  assert.equal(noCandidate.reason, 'NO_AVAILABLE_CHARACTERS');
});

test('gacha candidates fail closed and remain deterministic by immutable character id', () => {
  const base = {
    id: 'TRIAD-CHAR-007', name: '미래 캐릭터', enabled: true, acquisition: 'GACHA', gachaEligible: true,
    fullArt: 'card_art/signature/future.webp',
    lobbyArt: {
      status: 'PASS_ACTIVE', assetType: 'NON_SD_CHARACTER_RGBA', backgroundPolicy: 'TRANSPARENT_ONLY',
      backgroundRemoved: true, alphaValidated: true, path: 'assets/characters/roster/TRIAD-CHAR-007/lobby/future.png'
    },
    sd: { status: 'PASS_ACTIVE_FINAL', manifest: 'assets/characters/roster/TRIAD-CHAR-007/sd/sd_manifest.json' }
  };
  const profile = META.defaultProfile(1000, roster);
  const invalids = [
    ['enabled', { enabled: false }],
    ['acquisition', { acquisition: 'STARTER' }],
    ['gachaEligible', { gachaEligible: false }],
    ['sd status', { sd: { ...base.sd, status: 'REBUILD_REQUIRED' } }],
    ['sd manifest', { sd: { ...base.sd, manifest: ' ' } }],
    ['lobby status', { lobbyArt: { ...base.lobbyArt, status: 'REBUILD_REQUIRED' } }],
    ['lobby asset type', { lobbyArt: { ...base.lobbyArt, assetType: 'FULL_ART' } }],
    ['lobby background policy', { lobbyArt: { ...base.lobbyArt, backgroundPolicy: 'UNKNOWN' } }],
    ['lobby alpha', { lobbyArt: { ...base.lobbyArt, alphaValidated: false } }],
    ['lobby path', { lobbyArt: { ...base.lobbyArt, path: '' } }],
    ['full art', { fullArt: ' ' }]
  ];
  for (const [label, patch] of invalids) assert.equal(META.gachaCandidates([{ ...base, ...patch }], profile).length, 0, label);
  const reversed = [{ ...base, id: 'TRIAD-CHAR-008' }, base];
  assert.deepEqual(META.gachaCandidates(reversed, profile).map(record => record.id), ['TRIAD-CHAR-007', 'TRIAD-CHAR-008']);
});

test('gacha failures consume no signal and do not invoke RNG', () => {
  const future = {
    id: 'TRIAD-CHAR-007', enabled: true, acquisition: 'GACHA', gachaEligible: true, fullArt: 'future.webp',
    lobbyArt: { status: 'PASS_ACTIVE', assetType: 'NON_SD_CHARACTER_RGBA', backgroundPolicy: 'TRANSPARENT_ONLY', backgroundRemoved: true, alphaValidated: true, path: 'future.png' },
    sd: { status: 'PASS_ACTIVE_FINAL', manifest: 'future.json' }
  };
  const low = META.defaultProfile(1000, roster);
  low.wallet.signal = META.GACHA_SINGLE_COST - 1;
  let randomCalls = 0;
  const blocked = META.drawCharacter(low, [future], 'GACHA:LOW', 2000, () => { randomCalls++; return 0; }, roster);
  assert.equal(blocked.reason, 'INSUFFICIENT_SIGNAL');
  assert.equal(blocked.profile.wallet.signal, META.GACHA_SINGLE_COST - 1);
  assert.equal(randomCalls, 0);
  const noCandidates = META.drawCharacter(META.defaultProfile(1000, roster), [], 'GACHA:NONE', 2000, () => { randomCalls++; return 0; }, roster);
  assert.equal(noCandidates.reason, 'NO_AVAILABLE_CHARACTERS');
  assert.equal(randomCalls, 0);
});

test('draw rechecks a stale UI candidate and blocks a newly invalid asset', () => {
  const future = {
    id: 'TRIAD-CHAR-007', enabled: true, acquisition: 'GACHA', gachaEligible: true, fullArt: 'future.webp',
    lobbyArt: { status: 'PASS_ACTIVE', assetType: 'NON_SD_CHARACTER_RGBA', backgroundPolicy: 'TRANSPARENT_ONLY', backgroundRemoved: true, alphaValidated: true, path: 'future.png' },
    sd: { status: 'PASS_ACTIVE_FINAL', manifest: 'future.json' }
  };
  const profile = META.defaultProfile(1000, roster);
  profile.wallet.signal = META.GACHA_SINGLE_COST;
  assert.equal(META.gachaCandidates([future], profile).length, 1);
  const invalidAtDraw = { ...future, lobbyArt: { ...future.lobbyArt, status: 'REBUILD_REQUIRED' } };
  let randomCalls = 0;
  const result = META.drawCharacter(profile, [invalidAtDraw], 'GACHA:STALE', 2000, () => { randomCalls++; return 0; }, roster);
  assert.equal(result.reason, 'NO_AVAILABLE_CHARACTERS');
  assert.equal(result.profile.wallet.signal, META.GACHA_SINGLE_COST);
  assert.deepEqual(result.profile.gachaHistory, []);
  assert.equal(randomCalls, 0);
});

test('gacha rejects a transaction id already owned by another meta operation', () => {
  const future = {
    id: 'TRIAD-CHAR-007', enabled: true, acquisition: 'GACHA', gachaEligible: true, fullArt: 'future.webp',
    lobbyArt: { status: 'PASS_ACTIVE', assetType: 'NON_SD_CHARACTER_RGBA', backgroundPolicy: 'TRANSPARENT_ONLY', backgroundRemoved: true, alphaValidated: true, path: 'future.png' },
    sd: { status: 'PASS_ACTIVE_FINAL', manifest: 'future.json' }
  };
  const profile = META.defaultProfile(1000, roster);
  profile.wallet.signal = META.GACHA_SINGLE_COST;
  profile.transactionLedger['COLLIDE'] = { kind: 'SHOP_ITEM', itemId: 'MEMORY_PACK', committedAt: 1000 };
  const result = META.drawCharacter(profile, [future], 'COLLIDE', 2000, 0, roster);
  assert.equal(result.reason, 'DUPLICATE');
  assert.equal(result.profile.wallet.signal, META.GACHA_SINGLE_COST);
  assert.equal(result.profile.ownedCharacterIds.includes(future.id), false);
  assert.equal(result.profile.gachaHistory.length, 0);
});

test('legacy profiles without gachaHistory migrate safely', () => {
  const legacy = META.normalizeProfile({ wallet: { signal: 12 }, ownedCharacterIds: roster }, 2000, roster);
  assert.deepEqual(legacy.gachaHistory, []);
  assert.equal(legacy.wallet.signal, 12);
});
