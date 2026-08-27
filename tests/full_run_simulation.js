'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ARCH = require('../src/triad_architecture.js');
const PROGRESSION = require('../src/triad_stage_progression.js');

const root = path.resolve(__dirname, '..');
const sandbox = { window: {} };
sandbox.window.window = sandbox.window;
vm.runInNewContext(fs.readFileSync(path.join(root, 'combat_data.js'), 'utf8'), sandbox, { filename: 'combat_data.js' });
const COMBAT = sandbox.window.TRIAD_COMBAT_DATA;

const rewardPool = Array.from({ length: 126 }, (_, index) => `CARD_${String(index + 1).padStart(3, '0')}`);
const routePool = ['battle', 'elite', 'rest', 'event', 'battle'];

function finite(value, label) {
  assert.ok(Number.isFinite(value), `${label} must be finite`);
}

function simulate(seed, stageLimit) {
  const run = {
    seed,
    rngState: seed,
    stage: 1,
    party: [
      { id: 'EMBER', team: ARCH.TEAM.PLAYER, hp: 900, maxHp: 900, shield: 0 },
      { id: 'AEGIS', team: ARCH.TEAM.PLAYER, hp: 1100, maxHp: 1100, shield: 8 },
      { id: 'BLOOM', team: ARCH.TEAM.PLAYER, hp: 1000, maxHp: 1000, shield: 0 }
    ],
    artifacts: [],
    trace: []
  };

  for (let stage = 1; stage <= stageLimit; stage += 1) {
    run.stage = stage;
    let type;
    if (stage % 10 === 0) type = 'boss';
    else {
      const routes = ARCH.shuffle(run, routePool).slice(0, 3);
      if (!routes.includes('battle')) routes[0] = 'battle';
      type = routes[0];
      run.trace.push({ stage, routes, chosen: type });
    }

    if (type === 'rest') {
      run.party.filter(unit => unit.hp > 0).forEach(unit => { unit.hp = Math.min(unit.maxHp, unit.hp + Math.ceil(unit.maxHp * 0.25)); });
      continue;
    }

    if (type === 'event') {
      const roll = ARCH.random(run);
      run.trace.push({ stage, eventRoll: roll });
      if (roll < 0.55) run.party.filter(unit => unit.hp > 0).forEach(unit => { unit.hp = Math.min(unit.maxHp, unit.hp + Math.ceil(unit.maxHp * 0.18)); });
      else if (!run.artifacts.includes(`ART_${stage}`)) run.artifacts.push(`ART_${stage}`);
      continue;
    }

    const enemyTemplate = PROGRESSION.scaleMonster(COMBAT.pickMonster(stage, type, () => ARCH.random(run)), stage);
    const enemy = { id: enemyTemplate.id, team: ARCH.TEAM.ENEMY, hp: enemyTemplate.maxHp, maxHp: enemyTemplate.maxHp, template: enemyTemplate };
    const draw = ARCH.shuffle(run, rewardPool.slice(0, 18));
    const drawSequence = [];
    let turn = 1;

    while (enemy.hp > 0 && turn <= 80) {
      for (let count = 0; count < 4; count += 1) {
        if (!draw.length) draw.push(...ARCH.shuffle(run, rewardPool.slice(0, 18)));
        drawSequence.push(draw.pop());
      }

      const playerHit = COMBAT.resolveHit({
        medianDamage: 32 + stage,
        attackElementId: 'EMBER',
        targetElementId: enemy.elementId,
        critChance: 0.15,
        critMultiplier: 1.5,
        rng: () => ARCH.random(run)
      });
      finite(playerHit.amount, 'player damage');
      enemy.hp = Math.max(0, enemy.hp - playerHit.amount);
      if (enemy.hp <= 0) break;

      const intent = COMBAT.buildIntent(enemyTemplate, turn);
      const targetState = {
        source: enemy,
        teams: { PLAYER: run.party, ENEMY: [enemy] },
        rngContext: run
      };
      const selected = ARCH.resolveTargets(targetState, {
        sourceTeam: ARCH.TEAM.ENEMY,
        targetTeam: ARCH.TEAM.PLAYER,
        scope: ARCH.SCOPE.SINGLE,
        selector: ARCH.SELECTOR.RANDOM,
        count: 1
      });
      assert.equal(selected.length, 1, 'enemy intent must have one living PLAYER target');
      assert.equal(selected[0].team, ARCH.TEAM.PLAYER, 'enemy intent target team flipped');
      const enemyHit = COMBAT.resolveHit({
        medianDamage: intent.damage,
        attackElementId: enemy.elementId,
        targetElementId: selected[0].id,
        critChance: enemyTemplate.critChance,
        critMultiplier: enemyTemplate.critMultiplier,
        rng: () => ARCH.random(run)
      });
      finite(enemyHit.amount, 'enemy damage');
      const blocked = Math.min(selected[0].shield, enemyHit.amount);
      selected[0].shield -= blocked;
      selected[0].hp = Math.max(1, selected[0].hp - (enemyHit.amount - blocked));
      turn += 1;
    }

    assert.ok(turn <= 80, `softlock at seed ${seed}, stage ${stage}`);
    assert.equal(enemy.hp, 0, `enemy did not reach terminal state at seed ${seed}, stage ${stage}`);
    const reward = ARCH.shuffle(run, rewardPool).slice(0, 3);
    assert.equal(new Set(reward).size, 3, 'reward pool returned duplicates');
    run.trace.push({ stage, enemy: enemy.id, drawSequence, reward, turns: turn });
  }

  run.stage = stageLimit + 1;
  for (const unit of run.party) {
    finite(unit.hp, `${unit.id} HP`);
    finite(unit.shield, `${unit.id} shield`);
    assert.ok(unit.hp >= 0 && unit.shield >= 0, 'negative combat state');
  }
  return { hash: ARCH.hash(run.trace), trace: run.trace, rngState: run.rngState, stage: run.stage };
}

const seedCount = Number(process.argv[2] || 1000);
const stageLimit = Number(process.argv[3] || 30);
for (let seed = 1; seed <= seedCount; seed += 1) {
  const first = simulate(seed, stageLimit);
  const second = simulate(seed, stageLimit);
  assert.equal(first.hash, second.hash, `determinism mismatch at seed ${seed}`);
  assert.equal(first.rngState, second.rngState, `RNG state mismatch at seed ${seed}`);
  assert.equal(first.stage, stageLimit + 1, `run did not complete ${stageLimit} stages at seed ${seed}`);
}

process.stdout.write(`${JSON.stringify({ result: 'FULL_RUN_PASS', seeds: seedCount, stagesPerSeed: stageLimit, deterministicPairs: seedCount, invalidTargets: 0, softlocks: 0, nonFiniteValues: 0 })}\n`);
