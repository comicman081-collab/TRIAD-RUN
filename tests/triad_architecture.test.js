'use strict';

const assert = require('node:assert/strict');
const ARCH = require('../src/triad_architecture.js');

function test(name, body) {
  try {
    body();
    process.stdout.write(`[PASS] ${name}\n`);
  } catch (error) {
    process.stderr.write(`[FAIL] ${name}: ${error.stack || error.message}\n`);
    process.exitCode = 1;
  }
}

function makeContext(seed = 1701) {
  return { seed, rngState: seed };
}

function allRegistered() {
  const registry = new ARCH.EffectRegistry();
  ARCH.EFFECT_TYPES.forEach(type => registry.register(type, effect => effect));
  return registry;
}

function sampleBattleState(context) {
  const players = [
    { id: 'p1', team: ARCH.TEAM.PLAYER, hp: 31, maxHp: 50 },
    { id: 'p2', team: ARCH.TEAM.PLAYER, hp: 12, maxHp: 50 },
    { id: 'p3', team: ARCH.TEAM.PLAYER, hp: 0, maxHp: 50 }
  ];
  const enemies = [
    { id: 'e1', team: ARCH.TEAM.ENEMY, hp: 25, maxHp: 40 },
    { id: 'e2', team: ARCH.TEAM.ENEMY, hp: 8, maxHp: 40 }
  ];
  return { teams: { PLAYER: players, ENEMY: enemies }, rngContext: context };
}

test('seeded RNG reproduces shuffle, route, enemy, and reward rolls', () => {
  const simulate = seed => {
    const run = makeContext(seed);
    const deck = ARCH.shuffle(run, ['A', 'B', 'C', 'D', 'E', 'F']);
    const route = ARCH.pick(run, ['battle', 'elite', 'rest', 'event']);
    const enemy = ARCH.pick(run, ['scout', 'warden', 'hunter']);
    const reward = ARCH.shuffle(run, ['r1', 'r2', 'r3', 'r4']).slice(0, 3);
    return { deck, route, enemy, reward, rngState: run.rngState };
  };
  const first = simulate(99173);
  const second = simulate(99173);
  assert.deepEqual(first, second);
  assert.equal(ARCH.hash(first), ARCH.hash(second));
});

test('Player to Enemy targeting never flips teams', () => {
  const state = sampleBattleState(makeContext());
  state.source = state.teams.PLAYER[0];
  const base = { sourceTeam: ARCH.TEAM.PLAYER, targetTeam: ARCH.TEAM.ENEMY, scope: ARCH.SCOPE.SINGLE, count: 1 };
  for (const selector of [ARCH.SELECTOR.FIRST, ARCH.SELECTOR.LOWEST_HP, ARCH.SELECTOR.RANDOM]) {
    const result = ARCH.resolveTargets(state, { ...base, selector });
    assert.equal(result.length, 1);
    assert.equal(result[0].team, ARCH.TEAM.ENEMY);
  }
  const all = ARCH.resolveTargets(state, { ...base, scope: ARCH.SCOPE.ALL, selector: ARCH.SELECTOR.FIRST });
  assert.deepEqual(all.map(unit => unit.team), [ARCH.TEAM.ENEMY, ARCH.TEAM.ENEMY]);
});

test('Player to Player self, ally, all allies, and lowest HP use PLAYER team', () => {
  const state = sampleBattleState(makeContext());
  state.source = state.teams.PLAYER[0];
  const base = { sourceTeam: ARCH.TEAM.PLAYER, targetTeam: ARCH.TEAM.PLAYER, scope: ARCH.SCOPE.SINGLE, count: 1 };
  assert.equal(ARCH.resolveTargets(state, { ...base, selector: ARCH.SELECTOR.SELF })[0].id, 'p1');
  assert.equal(ARCH.resolveTargets(state, { ...base, selector: ARCH.SELECTOR.LOWEST_HP })[0].id, 'p2');
  const all = ARCH.resolveTargets(state, { ...base, scope: ARCH.SCOPE.ALL, selector: ARCH.SELECTOR.FIRST });
  assert.deepEqual(all.map(unit => unit.id), ['p1', 'p2']);
});

test('Enemy to Player targeting never flips teams', () => {
  const state = sampleBattleState(makeContext());
  state.source = state.teams.ENEMY[0];
  const base = { sourceTeam: ARCH.TEAM.ENEMY, targetTeam: ARCH.TEAM.PLAYER, scope: ARCH.SCOPE.SINGLE, count: 1 };
  for (const selector of [ARCH.SELECTOR.FIRST, ARCH.SELECTOR.LOWEST_HP, ARCH.SELECTOR.RANDOM]) {
    const result = ARCH.resolveTargets(state, { ...base, selector });
    assert.equal(result.length, 1);
    assert.equal(result[0].team, ARCH.TEAM.PLAYER);
  }
  const all = ARCH.resolveTargets(state, { ...base, scope: ARCH.SCOPE.ALL, selector: ARCH.SELECTOR.FIRST });
  assert.deepEqual(all.map(unit => unit.team), [ARCH.TEAM.PLAYER, ARCH.TEAM.PLAYER]);
});

test('Enemy to Enemy buff targeting stays on ENEMY team', () => {
  const state = sampleBattleState(makeContext());
  state.source = state.teams.ENEMY[0];
  const result = ARCH.resolveTargets(state, { sourceTeam: ARCH.TEAM.ENEMY, targetTeam: ARCH.TEAM.ENEMY, scope: ARCH.SCOPE.SINGLE, selector: ARCH.SELECTOR.LOWEST_HP, count: 1 });
  assert.equal(result[0].id, 'e2');
  assert.equal(result[0].team, ARCH.TEAM.ENEMY);
});

test('scheduled effect executes once and is removed before resolving', () => {
  const run = { seed: 7, stage: 1, rngState: 7, combat: { turn: 1 }, scheduledEffects: [], combatLog: [] };
  ARCH.scheduleEffect(run, {
    executeAtTurn: 2,
    executeAtPhase: 'PLAYER_START',
    resolvedEffect: { type: 'DRAW', amount: 2 },
    sourceId: 'EMBER',
    targetSpec: { sourceTeam: 'PLAYER', targetTeam: 'PLAYER', scope: 'SINGLE', selector: 'SELF' }
  });
  const executed = [];
  assert.equal(ARCH.executeScheduledEffects(run, 1, 'PLAYER_START', effect => executed.push(effect)).length, 0);
  assert.equal(ARCH.executeScheduledEffects(run, 2, 'PLAYER_START', effect => executed.push(effect)).length, 1);
  assert.equal(ARCH.executeScheduledEffects(run, 3, 'PLAYER_START', effect => executed.push(effect)).length, 0);
  assert.equal(executed.length, 1);
  assert.equal(run.scheduledEffects.length, 0);
  assert.throws(() => ARCH.makeScheduledEffect({ executeAtTurn: 2, executeAtPhase: 'PLAYER_START', resolvedEffect: { type: 'SCHEDULE' } }));
});

test('legacy save migrates without deleting cards, artifacts, or appearance', () => {
  const legacy = {
    seed: 2202,
    party: [{ id: 'EMBER', hp: 42, visual: { sourceType: 'parts', appearance: { hairFront: 4 } } }],
    deck: [{ id: 'EMBER_01', level: 3 }],
    artifacts: ['FIRST_ZERO']
  };
  const migrated = ARCH.migrateSave(legacy);
  assert.equal(migrated.fromVersion, 1);
  assert.equal(migrated.save.saveVersion, ARCH.SAVE_VERSION);
  assert.deepEqual(migrated.save.deck, legacy.deck);
  assert.deepEqual(migrated.save.artifacts, legacy.artifacts);
  assert.equal(migrated.save.party[0].visual.appearance.hairFront, 4);
  assert.ok(Number.isInteger(migrated.save.rngState));
});

test('effect schema validates registered machine-readable effects and rejects natural language', () => {
  const registry = allRegistered();
  assert.equal(ARCH.validateEffectSpec({ type: 'DAMAGE', amount: 8, target: { sourceTeam: 'PLAYER', targetTeam: 'ENEMY', scope: 'SINGLE', selector: 'LOWEST_HP' } }, registry).length, 0);
  assert.ok(ARCH.validateEffectSpec({ type: 'some special effect...' }, registry).some(error => error.code === 'INVALID_EFFECT'));
  assert.ok(ARCH.validateTargetSpec({ sourceTeam: 'PLAYER', targetTeam: 'ENEMY', scope: 'SINGLE', selector: 'ALLY' }).some(error => error.code === 'INVALID_SELECTOR'));
});

test('database validator catches duplicate IDs, invalid owner, invalid status, and negative cost', () => {
  const registry = allRegistered();
  const errors = ARCH.validateDatabase({
    characters: [{ id: 'EMBER' }, { id: 'EMBER' }],
    cards: [{ id: 'C1', owner: 'MISSING', cost: -1, effects: [{ type: 'APPLY_STATUS', statusId: 'UNKNOWN', target: { sourceTeam: 'PLAYER', targetTeam: 'ENEMY', scope: 'SINGLE', selector: 'FIRST' } }] }],
    statuses: [], artifacts: [], enemies: [], bosses: [], events: []
  }, registry);
  assert.ok(errors.some(error => error.code === 'DUPLICATE_ID'));
  assert.ok(errors.some(error => error.code === 'INVALID_OWNER'));
  assert.ok(errors.some(error => error.code === 'INVALID_STATUS'));
  assert.ok(errors.some(error => error.code === 'INVALID_COST'));
});

test('battle snapshots have deterministic hashes and carry replay-critical state', () => {
  const run = {
    saveVersion: 2, dataVersion: 'TRIAD_RUNTIME_V0_8', seed: 444, stage: 9, rngState: 555,
    party: [{ id: 'EMBER', hp: 24, maxHp: 70, shield: 3 }], deck: [{ id: 'EMBER_01', level: 2 }], artifacts: ['DRAW_PLUS'],
    combat: { turn: 3, draw: [{ id: 'EMBER_02' }], discard: [], hand: [{ id: 'EMBER_03' }], enemy: { id: 'VOLT_M02', hp: 12, maxHp: 49 } },
    scheduledEffects: []
  };
  const one = ARCH.battleSnapshot(run);
  const two = ARCH.battleSnapshot(JSON.parse(JSON.stringify(run)));
  assert.equal(ARCH.hash(one), ARCH.hash(two));
  assert.equal(one.enemyState.hp, 12);
  assert.equal(one.hand.length, 1);
});

if (process.exitCode) process.exit(process.exitCode);
