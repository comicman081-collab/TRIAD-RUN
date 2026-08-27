'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ARCH = require('../src/triad_architecture.js');
const TXN = require('../src/triad_transactions.js');

const root = path.resolve(__dirname, '..');
const sandbox = { window: {} };
sandbox.window.window = sandbox.window;
vm.runInNewContext(fs.readFileSync(path.join(root, 'combat_data.js'), 'utf8'), sandbox, { filename: 'combat_data.js' });
const COMBAT = sandbox.window.TRIAD_COMBAT_DATA;

const reloadPoints = Object.freeze([
  'AFTER_LAST_HIT',
  'REWARD_SHOWN',
  'AFTER_REWARD_CLAIM',
  'NEXT_ROUTE_SHOWN',
  'ROUTE_SELECTED'
]);
const rewardPool = Object.freeze(Array.from({ length: 126 }, (_, index) => `CARD_${String(index + 1).padStart(3, '0')}`));
const artifactPool = Object.freeze(Array.from({ length: 8 }, (_, index) => `ARTIFACT_${String(index + 1).padStart(2, '0')}`));
const routeTypes = Object.freeze(['battle', 'elite', 'rest', 'event', 'battle']);

function makeRun(seed) {
  return {
    id: `QA-RUN-${seed}`,
    saveVersion: ARCH.SAVE_VERSION,
    dataVersion: 'TRIAD_RUNTIME_V0_8',
    seed,
    rngState: seed,
    rngCursor: 0,
    rngAlgorithm: ARCH.RNG_ALGORITHM,
    stage: 10,
    act: 1,
    party: [
      { id: 'EMBER', team: ARCH.TEAM.PLAYER, hp: 900, maxHp: 900, shield: 0 },
      { id: 'AEGIS', team: ARCH.TEAM.PLAYER, hp: 1100, maxHp: 1100, shield: 8 },
      { id: 'BLOOM', team: ARCH.TEAM.PLAYER, hp: 1000, maxHp: 1000, shield: 0 }
    ],
    deck: rewardPool.slice(0, 18).map(id => ({ id, level: 1 })),
    artifacts: [],
    path: [],
    routeOffer: null,
    rewardOffer: null,
    pendingTransition: null,
    transactionLedger: {},
    scheduledEffects: [],
    combatLog: [],
    trace: []
  };
}

function persistedClone(run) {
  const before = {
    rngState: run.rngState,
    rngCursor: run.rngCursor,
    ledgerHash: ARCH.hash(run.transactionLedger),
    pendingHash: ARCH.hash(run.pendingTransition),
    routeHash: ARCH.hash(run.routeOffer)
  };
  const restored = ARCH.migrateSave(JSON.parse(JSON.stringify(run))).save;
  TXN.restore(restored);
  assert.equal(restored.rngState, before.rngState, 'Continue changed rngState');
  assert.equal(restored.rngCursor, before.rngCursor, 'Continue changed rngCursor');
  assert.equal(ARCH.hash(restored.transactionLedger), before.ledgerHash, 'Continue changed transaction ledger');
  assert.equal(ARCH.hash(restored.pendingTransition), before.pendingHash, 'Continue changed pending transition');
  assert.equal(ARCH.hash(restored.routeOffer), before.routeHash, 'Continue changed route offer');
  return restored;
}

function routeOptions(run) {
  if (run.stage % 10 === 0) return ['boss'];
  const choices = ARCH.shuffle(run, routeTypes).slice(0, 3);
  if (!choices.includes('battle')) choices[0] = 'battle';
  return choices;
}

function ensureRouteOffer(run) {
  if (run.routeOffer?.stage === run.stage && run.routeOffer.choices?.length) return run.routeOffer;
  run.routeOffer = {
    stage: run.stage,
    txnId: TXN.id(run, 'ROUTE', run.stage),
    status: 'PENDING',
    choices: routeOptions(run)
  };
  return run.routeOffer;
}

function drawCards(run, count) {
  const combat = run.combat;
  const drawn = [];
  for (let index = 0; index < count; index += 1) {
    if (!combat.draw.length && combat.discard.length) {
      combat.draw = ARCH.shuffle(run, combat.discard);
      combat.discard = [];
    }
    if (!combat.draw.length) break;
    const card = combat.draw.pop();
    combat.hand.push(card);
    drawn.push(card.id);
  }
  return drawn;
}

function startCombat(run, type) {
  const template = COMBAT.pickMonster(run.stage, type, () => ARCH.random(run));
  run.combat = {
    type,
    phase: 'PLAYER',
    inputLocked: false,
    actionToken: 0,
    turn: 1,
    energy: 3,
    draw: ARCH.shuffle(run, run.deck.map(card => ({ ...card }))),
    discard: [],
    hand: [],
    exhaust: [],
    enemy: {
      id: template.id,
      elementId: template.elementId,
      hp: template.maxHp,
      maxHp: template.maxHp,
      template
    }
  };
  run.trace.push({ kind: 'COMBAT_START', stage: run.stage, type, enemyId: template.id });
}

function selectRoute(run, preferredType) {
  const offer = ensureRouteOffer(run);
  const type = offer.choices.includes(preferredType) ? preferredType : offer.choices[0];
  assert.equal(offer.status, 'PENDING');
  offer.status = 'CLAIMED';
  offer.selectedType = type;
  run.path.push({ stage: run.stage, type, txnId: offer.txnId });
  assert.equal(TXN.commit(run, offer.txnId, { kind: 'ROUTE', stage: run.stage, type }), true);
  run.trace.push({ kind: 'ROUTE', stage: run.stage, choices: [...offer.choices], selected: type });
  run.routeOffer = null;
  startCombat(run, type);
}

function playCombatTurn(run, medianDamage) {
  const combat = run.combat;
  const drawn = drawCards(run, 4);
  const playerHit = COMBAT.resolveHit({
    medianDamage,
    attackElementId: 'EMBER',
    targetElementId: combat.enemy.elementId,
    critChance: 0.15,
    critMultiplier: 1.5,
    rng: () => ARCH.random(run)
  });
  combat.enemy.hp = Math.max(0, combat.enemy.hp - playerHit.amount);

  let enemyAction = null;
  if (combat.enemy.hp > 0) {
    const intent = COMBAT.buildIntent(combat.enemy.template, combat.turn);
    const targets = ARCH.resolveTargets({
      source: combat.enemy,
      teams: { PLAYER: run.party, ENEMY: [combat.enemy] },
      rngContext: run
    }, {
      sourceTeam: ARCH.TEAM.ENEMY,
      targetTeam: ARCH.TEAM.PLAYER,
      scope: ARCH.SCOPE.SINGLE,
      selector: ARCH.SELECTOR.RANDOM,
      count: 1
    });
    assert.equal(targets.length, 1);
    const target = targets[0];
    const enemyHit = COMBAT.resolveHit({
      medianDamage: intent.damage,
      attackElementId: combat.enemy.elementId,
      targetElementId: target.id,
      critChance: combat.enemy.template.critChance,
      critMultiplier: combat.enemy.template.critMultiplier,
      rng: () => ARCH.random(run)
    });
    const blocked = Math.min(target.shield, enemyHit.amount);
    target.shield -= blocked;
    target.hp = Math.max(1, target.hp - (enemyHit.amount - blocked));
    enemyAction = { targetId: target.id, amount: enemyHit.amount, critical: enemyHit.critical };
  }

  run.trace.push({
    kind: 'TURN',
    stage: run.stage,
    turn: combat.turn,
    drawn,
    playerDamage: playerHit.amount,
    playerCritical: playerHit.critical,
    enemyAction
  });
  combat.discard.push(...combat.hand.splice(0));
  combat.turn += 1;
}

function buildArtifactOffer(run) {
  const owned = new Set(run.artifacts);
  return ARCH.shuffle(run, artifactPool.filter(id => !owned.has(id))).slice(0, 3);
}

function buildRewardOffer(run) {
  const weighted = [];
  for (const id of rewardPool) {
    const owned = run.deck.some(card => card.id === id);
    weighted.push(id);
    if (owned) weighted.push(id, id);
  }
  const seen = new Set();
  const offer = [];
  for (const id of ARCH.shuffle(run, weighted)) {
    if (seen.has(id)) continue;
    seen.add(id);
    offer.push(id);
    if (offer.length === 3) break;
  }
  return offer;
}

function openCombatReward(run) {
  const combat = run.combat;
  combat.phase = 'TERMINAL';
  combat.inputLocked = true;
  const nextWin = 1;
  const artifactOffer = ARCH.random(run) < 1 ? buildArtifactOffer(run) : [];
  const rewardOffer = buildRewardOffer(run);
  run.rewardOffer = [...rewardOffer];
  run.pendingTransition = TXN.pending(run, 'COMBAT_REWARD', `${run.stage}:${nextWin}`, {
    stage: run.stage,
    type: combat.type,
    artifactOffer,
    artifactStatus: artifactOffer.length ? 'PENDING' : 'SKIPPED',
    rewardOffer: [...rewardOffer]
  });
  run.trace.push({ kind: 'VICTORY', stage: run.stage, artifactOffer: [...artifactOffer], rewardOffer: [...rewardOffer] });
  run.combat = null;
}

function resolveArtifact(run) {
  const pending = run.pendingTransition;
  const selectedId = pending.artifactOffer[0] || null;
  const transactionId = `${pending.txnId}:ARTIFACT`;
  if (selectedId) run.artifacts.push(selectedId);
  pending.artifactSelectedId = selectedId;
  pending.artifactStatus = 'CLAIMED';
  pending.artifactOffer = [];
  assert.equal(TXN.commit(run, transactionId, { kind: pending.kind, stage: run.stage, selectedId }), true);
  run.trace.push({ kind: 'ARTIFACT', stage: run.stage, selectedId });
}

function claimReward(run) {
  const pending = run.pendingTransition;
  const selectedId = run.rewardOffer[0];
  const existing = run.deck.find(card => card.id === selectedId);
  if (existing) existing.level = Math.min(5, existing.level + 1);
  else run.deck.push({ id: selectedId, level: 1 });
  pending.status = 'CLAIMED';
  pending.selectedId = selectedId;
  assert.equal(TXN.commit(run, pending.txnId, {
    kind: 'COMBAT_REWARD',
    selectedId,
    completedStage: run.stage,
    fromReward: true
  }), true);
  run.trace.push({ kind: 'REWARD', stage: run.stage, candidates: [...run.rewardOffer], selectedId });
  run.rewardOffer = null;
  run.pendingTransition = null;
  run.routeOffer = null;
  run.stage += 1;
  run.act = Math.ceil(run.stage / 10);
}

function authoritativeProjection(run) {
  return JSON.parse(JSON.stringify({
    seed: run.seed,
    rngState: run.rngState,
    rngCursor: run.rngCursor,
    stage: run.stage,
    act: run.act,
    party: run.party,
    deck: run.deck,
    artifacts: run.artifacts,
    path: run.path,
    routeOffer: run.routeOffer,
    rewardOffer: run.rewardOffer,
    pendingTransition: run.pendingTransition,
    transactionLedger: run.transactionLedger,
    combat: run.combat,
    trace: run.trace
  }));
}

function simulate(seed, reloadPoint) {
  let run = makeRun(seed);
  let reloadCount = 0;
  function checkpoint(name) {
    if (reloadPoint !== name) return;
    run = persistedClone(run);
    reloadCount += 1;
  }

  ensureRouteOffer(run);
  selectRoute(run, 'boss');
  playCombatTurn(run, 22);
  playCombatTurn(run, 22);
  run.combat.enemy.hp = 0;
  run.trace.push({ kind: 'LAST_HIT', stage: run.stage, enemyId: run.combat.enemy.id });
  openCombatReward(run);
  checkpoint('AFTER_LAST_HIT');

  resolveArtifact(run);
  checkpoint('REWARD_SHOWN');

  claimReward(run);
  checkpoint('AFTER_REWARD_CLAIM');

  const nextOffer = ensureRouteOffer(run);
  run.trace.push({ kind: 'NEXT_ROUTE_SHOWN', stage: run.stage, choices: [...nextOffer.choices] });
  checkpoint('NEXT_ROUTE_SHOWN');

  selectRoute(run, 'battle');
  checkpoint('ROUTE_SELECTED');

  playCombatTurn(run, 7);
  playCombatTurn(run, 7);
  playCombatTurn(run, 7);

  const projection = authoritativeProjection(run);
  return {
    reloadCount,
    hash: ARCH.hash(projection),
    rngState: run.rngState,
    rngCursor: run.rngCursor,
    projection
  };
}

test('50 seeds × 5 reload checkpoints preserve exact RNG and authoritative state', () => {
  const comparisons = [];
  for (let seed = 1; seed <= 50; seed += 1) {
    const baseline = simulate(seed, null);
    for (const reloadPoint of reloadPoints) {
      const resumed = simulate(seed, reloadPoint);
      assert.equal(resumed.reloadCount, 1, `${seed}/${reloadPoint} did not inject exactly one Continue`);
      assert.equal(resumed.rngState, baseline.rngState, `${seed}/${reloadPoint} rngState diverged`);
      assert.equal(resumed.rngCursor, baseline.rngCursor, `${seed}/${reloadPoint} rngCursor diverged`);
      assert.equal(resumed.hash, baseline.hash, `${seed}/${reloadPoint} authoritative hash diverged`);
      assert.deepEqual(resumed.projection, baseline.projection, `${seed}/${reloadPoint} authoritative state diverged`);
      comparisons.push({ seed, reloadPoint, rngState: resumed.rngState, rngCursor: resumed.rngCursor, hash: resumed.hash, pass: true });
    }
  }

  assert.equal(comparisons.length, 250);
  const report = {
    result: 'RELOAD_DETERMINISM_PASS',
    generatedAt: new Date().toISOString(),
    seeds: 50,
    reloadPoints: [...reloadPoints],
    comparisons: comparisons.length,
    exactMatches: comparisons.length,
    rngDivergence: 0,
    duplicateTransactions: 0,
    lostTransactions: 0,
    sideEffectsOnContinue: 0,
    comparisonsDetail: comparisons
  };
  fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
  fs.writeFileSync(path.join(root, 'reports', 'POST_SD_P0_RELOAD_DETERMINISM_20260823.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
});
