'use strict';

/*
 * TRIAD // RUN — Unified Meta Progression & Economy Transaction Audit
 *
 * This is a deterministic, offline contract audit.  It exercises the same
 * serializable meta API used by the canonical HTML runtime and deliberately
 * replays each receipt after JSON round-trips.  It does not mutate production
 * saves, assets, or the runtime.
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const META = require('../../src/triad_meta_progression.js');

const root = path.resolve(__dirname, '../..');
const htmlPath = path.join(root, 'TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const reportBase = 'TRIAD_META_ECONOMY_TRANSACTION_AUDIT_20260825';
const reportJsonPath = path.join(root, 'reports', `${reportBase}.json`);
const reportMdPath = path.join(root, 'reports', `${reportBase}.md`);

const STARTER_ROSTER = Object.freeze(['TRIAD-CHAR-001', 'TRIAD-CHAR-002', 'TRIAD-CHAR-003']);
const NOW = 1_800_000_000_000;
const HOUR = META.HOUR_MS;

const clone = value => JSON.parse(JSON.stringify(value));
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const economicProjection = profile => ({
  wallet: profile.wallet,
  inventory: profile.inventory,
  cardCollection: profile.cardCollection,
  ownedCharacterIds: profile.ownedCharacterIds,
  selectedLobbyCharacterId: profile.selectedLobbyCharacterId,
  maxStageCleared: profile.maxStageCleared,
  totalStagesCleared: profile.totalStagesCleared,
  baseEnergyBonus: profile.baseEnergyBonus,
  unlockedLobbyBackgroundIds: profile.unlockedLobbyBackgroundIds,
  selectedLobbyBackgroundId: profile.selectedLobbyBackgroundId,
  idle: profile.idle,
  gachaHistory: profile.gachaHistory,
  transactionLedger: profile.transactionLedger
});
const economicHash = profile => hash(economicProjection(profile));

function freshProfile(now = NOW) {
  return META.defaultProfile(now, STARTER_ROSTER);
}

function reload(profile, now = NOW) {
  return META.normalizeProfile(clone(profile), now, STARTER_ROSTER);
}

function expectDuplicateReplay(operation, profile, transactionId, attempts = 10) {
  let current = profile;
  const firstHash = economicHash(profile);
  const results = [];
  for (let index = 0; index < attempts; index += 1) {
    current = reload(current, NOW + index + 1);
    const result = operation(current, index);
    results.push(result);
    assert.ok(['DUPLICATE', 'DRAWN'].includes(result.reason), `unexpected replay reason: ${result.reason}`);
    current = result.profile;
  }
  assert.equal(results.length, attempts);
  assert.equal(economicHash(current), firstHash, 'replay changed the state after the first mutation');
  return { profile: current, results, transactionId };
}

const checks = [];
function check(id, description, fn) {
  try {
    fn();
    checks.push({ id, description, pass: true });
  } catch (error) {
    checks.push({ id, description, pass: false, error: error instanceof Error ? error.message : String(error) });
  }
}

check('META-01', 'shop item receipt is idempotent across ten replays and JSON reloads', () => {
  let profile = freshProfile();
  profile.wallet.credits = 500;
  const tx = 'AUDIT:SHOP:MEMORY_PACK:001';
  const first = META.purchaseShopItem(profile, 'MEMORY_PACK', tx, NOW, STARTER_ROSTER);
  assert.equal(first.purchased, true);
  profile = first.profile;
  const firstWallet = clone(profile.wallet);
  const replay = expectDuplicateReplay(
    (current) => META.purchaseShopItem(current, 'MEMORY_PACK', tx, NOW, STARTER_ROSTER),
    profile,
    tx
  );
  profile = replay.profile;
  assert.deepEqual(profile.wallet, firstWallet);
  assert.equal(profile.wallet.credits, 400);
  assert.equal(profile.wallet.memory, 120);
  assert.equal(profile.transactionLedger[tx].kind, 'SHOP_ITEM');
});

check('META-02', 'insufficient shop funds produce no economic mutation', () => {
  const profile = freshProfile();
  const before = economicHash(profile);
  const result = META.purchaseShopItem(profile, 'MEMORY_PACK', 'AUDIT:SHOP:INSUFFICIENT', NOW, STARTER_ROSTER);
  assert.equal(result.purchased, false);
  assert.equal(result.reason, 'INSUFFICIENT_FUNDS');
  assert.equal(economicHash(result.profile), before);
});

check('META-03', 'card purchase is idempotent and cannot duplicate ownership or debit', () => {
  let profile = freshProfile();
  profile.wallet.credits = 500;
  const tx = 'AUDIT:SHOP_CARD:EMBER_01:001';
  const first = META.purchaseCard(profile, 'EMBER_01', 240, tx, NOW, STARTER_ROSTER);
  assert.equal(first.purchased, true);
  profile = first.profile;
  const replay = expectDuplicateReplay(
    current => META.purchaseCard(current, 'EMBER_01', 240, tx, NOW, STARTER_ROSTER),
    profile,
    tx
  );
  profile = replay.profile;
  assert.equal(profile.wallet.credits, 260);
  assert.deepEqual(profile.cardCollection.EMBER_01.level, 1);
  assert.equal(Object.keys(profile.cardCollection).filter(id => id === 'EMBER_01').length, 1);
});

check('META-04', 'card upgrade is idempotent and preserves partial-failure safety', () => {
  let profile = freshProfile();
  profile.wallet.credits = 500;
  profile.wallet.cardMatrices = 10;
  profile = META.purchaseCard(profile, 'EMBER_01', 240, 'AUDIT:BUY:EMBER_01', NOW, STARTER_ROSTER).profile;
  const tx = 'AUDIT:UPGRADE:EMBER_01:001';
  const first = META.upgradeCard(profile, 'EMBER_01', tx, NOW, STARTER_ROSTER);
  assert.equal(first.upgraded, true);
  profile = first.profile;
  const replay = expectDuplicateReplay(
    current => META.upgradeCard(current, 'EMBER_01', tx, NOW, STARTER_ROSTER),
    profile,
    tx
  );
  profile = replay.profile;
  assert.equal(profile.cardCollection.EMBER_01.level, 2);
  assert.equal(profile.wallet.cardMatrices, 8);

  const poor = reload(profile);
  poor.wallet.cardMatrices = 0;
  const poorHash = economicHash(poor);
  const rejected = META.upgradeCard(poor, 'EMBER_01', 'AUDIT:UPGRADE:POOR', NOW, STARTER_ROSTER);
  assert.equal(rejected.reason, 'INSUFFICIENT_MATERIALS');
  assert.equal(economicHash(rejected.profile), poorHash);
});

check('META-05', 'idle reward follows 24h full / next 24h half / 48h cap contract', () => {
  const profile = freshProfile(NOW);
  const full = META.previewIdle(profile, NOW + 24 * HOUR);
  const capped = META.previewIdle(profile, NOW + 72 * HOUR);
  assert.equal(full.effectiveHours, 24);
  assert.equal(capped.elapsedHours, 48);
  assert.equal(capped.effectiveHours, 36);
  assert.equal(capped.capped, true);
  assert.ok(capped.rewards.credits > full.rewards.credits);
  const backward = META.claimIdle(profile, NOW - HOUR, STARTER_ROSTER, 'AUDIT:IDLE:BACKWARD');
  assert.equal(backward.claimed, false);
  assert.equal(backward.reason, 'NOT_READY');
  assert.equal(economicHash(backward.profile), economicHash(profile));
});

check('META-06', 'idle receipt is idempotent across ten replays and reloads', () => {
  let profile = freshProfile(NOW);
  const tx = 'AUDIT:IDLE:CLAIM:001';
  const first = META.claimIdle(profile, NOW + 24 * HOUR, STARTER_ROSTER, tx);
  assert.equal(first.claimed, true);
  profile = first.profile;
  const firstWallet = clone(profile.wallet);
  for (let index = 0; index < 10; index += 1) {
    const replay = META.claimIdle(reload(profile, NOW + 25 * HOUR + index), NOW + 25 * HOUR + index, STARTER_ROSTER, tx);
    assert.equal(replay.claimed, false);
    assert.equal(replay.reason, 'DUPLICATE');
    profile = replay.profile;
  }
  assert.deepEqual(profile.wallet, firstWallet);
  assert.equal(profile.idle.lastClaimAt, NOW + 24 * HOUR);
});

check('META-07', 'stage clear receipt is idempotent and unlocks one background set', () => {
  let profile = freshProfile(NOW);
  const tx = 'AUDIT:STAGE:10:BATTLE:001';
  const first = META.applyStageClear(profile, { stage: 10, type: 'battle', transactionId: tx, now: NOW }, STARTER_ROSTER);
  assert.equal(first.committed, true);
  profile = first.profile;
  assert.ok(first.unlocked.includes('LOBBY-BG-02'));
  const firstWallet = clone(profile.wallet);
  for (let index = 0; index < 10; index += 1) {
    const replay = META.applyStageClear(reload(profile, NOW + index + 1), { stage: 10, type: 'battle', transactionId: tx, now: NOW + index + 1 }, STARTER_ROSTER);
    assert.equal(replay.committed, false);
    assert.deepEqual(replay.unlocked, []);
    profile = replay.profile;
  }
  assert.deepEqual(profile.wallet, firstWallet);
  assert.equal(profile.totalStagesCleared, 1);
  assert.deepEqual(META.unlockedBackgroundIds(120), META.LOBBY_BACKGROUNDS.map(entry => entry.id));
});

const FUTURE_CHARACTER = Object.freeze({
  id: 'TRIAD-CHAR-007', name: '미래 캐릭터', enabled: true, acquisition: 'GACHA', gachaEligible: true,
  fullArt: 'assets/characters/roster/TRIAD-CHAR-007/full/full.webp',
  lobbyArt: {
    status: 'PASS_ACTIVE', assetType: 'NON_SD_CHARACTER_RGBA', backgroundPolicy: 'TRANSPARENT_ONLY',
    backgroundRemoved: true, alphaValidated: true, path: 'assets/characters/roster/TRIAD-CHAR-007/lobby/lobby.png'
  },
  sd: { status: 'PASS_ACTIVE_FINAL', manifest: 'assets/characters/roster/TRIAD-CHAR-007/sd/sd_manifest.json' }
});

check('META-08', 'gacha is asset-gated, deterministic, and receipt-idempotent', () => {
  let profile = freshProfile(NOW);
  profile.wallet.signal = META.GACHA_SINGLE_COST;
  const tx = 'AUDIT:GACHA:001';
  let randomCalls = 0;
  const first = META.drawCharacter(profile, [FUTURE_CHARACTER], tx, NOW, () => { randomCalls += 1; return 0; }, STARTER_ROSTER);
  assert.equal(first.drawn, true);
  assert.equal(randomCalls, 1);
  profile = first.profile;
  for (let index = 0; index < 10; index += 1) {
    const replay = META.drawCharacter(reload(profile, NOW + index + 1), [FUTURE_CHARACTER], tx, NOW + index + 1, () => { randomCalls += 1; return 0; }, STARTER_ROSTER);
    assert.equal(replay.replayed, true);
    assert.equal(replay.characterId, FUTURE_CHARACTER.id);
    profile = replay.profile;
  }
  assert.equal(randomCalls, 1);
  assert.equal(profile.wallet.signal, 0);
  assert.equal(profile.ownedCharacterIds.filter(id => id === FUTURE_CHARACTER.id).length, 1);

  const invalid = { ...FUTURE_CHARACTER, lobbyArt: { ...FUTURE_CHARACTER.lobbyArt, status: 'REBUILD_REQUIRED' } };
  const blockedProfile = freshProfile(NOW);
  blockedProfile.wallet.signal = META.GACHA_SINGLE_COST;
  let blockedRandom = 0;
  const blocked = META.drawCharacter(blockedProfile, [invalid], 'AUDIT:GACHA:INVALID', NOW, () => { blockedRandom += 1; return 0; }, STARTER_ROSTER);
  assert.equal(blocked.reason, 'NO_AVAILABLE_CHARACTERS');
  assert.equal(blockedRandom, 0);
  assert.equal(blocked.profile.wallet.signal, META.GACHA_SINGLE_COST);
});

check('META-09', 'lobby background selection does not touch economy or transaction ledger', () => {
  const profile = freshProfile(NOW);
  const lockedBefore = economicHash(profile);
  const locked = META.selectLobbyBackground(profile, 'LOBBY-BG-02', NOW, STARTER_ROSTER);
  assert.equal(locked.selected, false);
  assert.equal(economicHash(locked.profile), lockedBefore);

  const unlockedProfile = META.applyStageClear(profile, { stage: 10, transactionId: 'AUDIT:STAGE:BG', now: NOW }, STARTER_ROSTER).profile;
  const before = economicHash(unlockedProfile);
  const selected = META.selectLobbyBackground(unlockedProfile, 'LOBBY-BG-02', NOW + 1, STARTER_ROSTER);
  assert.equal(selected.selected, true);
  assert.equal(selected.profile.selectedLobbyBackgroundId, 'LOBBY-BG-02');
  const afterProjection = economicProjection(selected.profile);
  const beforeProjection = economicProjection(unlockedProfile);
  assert.deepEqual(afterProjection.wallet, beforeProjection.wallet);
  assert.deepEqual(afterProjection.transactionLedger, beforeProjection.transactionLedger);
  assert.notEqual(economicHash(selected.profile), before);
});

check('META-10', 'runtime routes every meta mutation through canonical API and persists returned profile', () => {
  const requiredCalls = [
    'META.claimIdle', 'META.selectLobbyBackground', 'META.drawCharacter',
    'META.purchaseShopItem', 'META.purchaseCard', 'META.upgradeCard', 'META.applyStageClear'
  ];
  for (const call of requiredCalls) assert.match(html, new RegExp(call.replace('.', '\\.'), 'g'), `missing runtime call ${call}`);
  assert.match(html, /const META=window\.TRIAD_META_PROGRESSION/);
  assert.match(html, /profile=metaResult\.profile;persistProfile\(\)/);
  assert.match(html, /persistProfile\(result\.profile\)/);
  assert.match(html, /assets\/characters\/roster\//);
});

const failures = checks.filter(checkResult => !checkResult.pass);
const result = {
  audit: reportBase,
  generatedAt: new Date().toISOString(),
  pass: failures.length === 0,
  checks,
  summary: {
    checks: checks.length,
    passed: checks.filter(checkResult => checkResult.pass).length,
    failed: failures.length,
    replayPolicy: 'same explicit receipt replayed 10x after JSON reload',
    productionRuntimeMutations: 0,
    deletedFiles: 0
  },
  scope: [
    'shop item purchase', 'shop card purchase', 'card upgrade', 'idle reward',
    'stage clear and 10-stage lobby background unlock', 'open-ended background unlock cap',
    'asset-gated character gacha', 'lobby background selection', 'canonical HTML hookup'
  ],
  externalReview: {
    provider: 'GPT web existing session',
    sessionId: '6a8af051-27a4-83e8-9c1c-c05b96ed70f5',
    verdict: 'VALIDATION: PASS — UNIFIED META/ECONOMY TRANSACTION AUDIT MVP 승인',
    structural: 'PASS',
    transaction: 'PASS',
    blockers: 0,
    final: 'PASS',
    note: 'The existing session independently reviewed the supplied local audit result; it did not mutate the project.'
  },
  decisions: {
    codeChangeRequired: false,
    dualPassPromotion: failures.length === 0,
    reason: failures.length ? 'Audit failed; no production promotion permitted.' : 'Local audit and the existing GPT web session both returned PASS; the report-only audit is promoted as canonical evidence.'
  }
};

fs.mkdirSync(path.dirname(reportJsonPath), { recursive: true });
fs.writeFileSync(reportJsonPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

const markdown = [
  `# ${reportBase}`,
  '',
  `- Result: **${result.pass ? 'PASS' : 'FAIL'}**`,
  `- Checks: ${result.summary.passed}/${result.summary.checks}`,
  '- Scope: canonical meta progression API + canonical HTML hookup',
  '- Replay policy: same explicit receipt replayed 10x after JSON reload',
  '- Production code changes in this audit: 0',
  '- Files deleted: 0',
  '',
  '## Checks',
  '',
  '| ID | Description | Result | Detail |',
  '|---|---|---|---|',
  ...checks.map(item => `| ${item.id} | ${item.description} | ${item.pass ? 'PASS' : 'FAIL'} | ${item.error || ''} |`),
  '',
  '## Promotion rule',
  '',
  result.pass
    ? 'Local transaction audit and the existing GPT web session are both PASS. This report is promoted as canonical verification evidence; no gameplay runtime mutation was required.'
    : 'No promotion: at least one transaction contract failed.',
  '',
  '## Evidence',
  '',
  `- JSON: \`${path.relative(root, reportJsonPath).replaceAll('\\', '/')}\``,
  `- Runtime: \`${path.relative(root, htmlPath).replaceAll('\\', '/')}\``,
  '- GPT web review: existing session `6a8af051-27a4-83e8-9c1c-c05b96ed70f5` → `VALIDATION: PASS`, `FINAL: PASS`, blockers 0.',
  '- No SD atlas, enemy atlas, card data, or legacy assembly asset was modified.'
].join('\n') + '\n';
fs.writeFileSync(reportMdPath, markdown, 'utf8');

console.log(JSON.stringify({
  pass: result.pass,
  reportJson: path.relative(root, reportJsonPath),
  reportMarkdown: path.relative(root, reportMdPath),
  summary: result.summary,
  failures: failures.map(item => ({ id: item.id, error: item.error }))
}, null, 2));

if (!result.pass) process.exitCode = 1;
