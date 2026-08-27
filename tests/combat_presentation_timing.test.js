'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const SFX = require('../src/triad_combat_sfx.js');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html'), 'utf8');
const start = html.indexOf('let combatPresentationGeneration=0;');
const end = html.indexOf('function settleResolvedCard(', start);
assert.ok(start >= 0 && end > start, 'combat presentation helpers are required');
const helperSource = html.slice(start, end);

function runtime() {
  const tasks = [];
  const setTimeout = (callback, delay) => { tasks.push({ callback, delay }); return tasks.length; };
  const enemyText = { textContent: '' }, enemyBar = { style: {} }, enemyMini = { style: {} };
  const spriteBars = [{ style: {} }, { style: {} }], statusBars = [{ style: {} }, { style: {} }];
  const statusLabels = [{ textContent: '' }, { textContent: '' }], statusTag = { textContent: '' };
  const sprite = { classList: { toggle(_name, value) { sprite.dead = value; } }, querySelectorAll() { return spriteBars; } };
  const status = {
    classList: { toggle(_name, value) { status.dead = value; } },
    querySelectorAll(selector) { return selector === '.small.muted' ? statusLabels : statusBars; },
    querySelector() { return statusTag; },
  };
  const document = { querySelector(selector) {
    if (selector === '#enemySpriteWrap .sd-mini-bar i') return enemyMini;
    if (selector.startsWith('#partySprites')) return sprite;
    if (selector.startsWith('#partyCombat')) return status;
    return null;
  } };
  const $ = selector => selector === '#enemyHpText' ? enemyText : selector === '#enemyHpBar' ? enemyBar : null;
  const run = { party: [{ id: 'VOLT', characterId: 'CHAR-002', hp: 31, maxHp: 68, shield: 0 }], battleSpriteState: {}, combat: { enemy: { maxHp: 100 } } };
  const actorStates = [];
  const sdBattleActors = new Map([['CHAR-002', { play(state) { actorStates.push(state); } }]]);
  const factory = new Function('setTimeout', 'SFX', 'document', '$', 'run', 'sdBattleActors', 'combatVfxTravelImpactMs', 'presentCombatVfx', `${helperSource};return{beginCombatPresentation,cancelCombatPresentation,registerCombatPresentationFinalizer,runCombatPresentationFinalizer,scheduleCombatPresentation,combatHitOffsets,renderEnemyHpPresentation,renderPartyMemberPresentation,presentPartyImpact}`);
  return {
    api: factory(setTimeout, SFX, document, $, run, sdBattleActors, () => undefined, () => true),
    tasks, run, enemyText, enemyBar, enemyMini, spriteBars, statusBars, statusLabels, statusTag, sprite, status, actorStates,
  };
}

test('generation cancellation prevents stale collision callbacks', () => {
  const state = runtime(), first = state.api.beginCombatPresentation(), calls = [];
  state.api.scheduleCombatPresentation(() => calls.push('stale'), 520, first);
  state.api.cancelCombatPresentation();
  state.tasks.splice(0).forEach(task => task.callback());
  assert.deepEqual(calls, []);

  const second = state.api.beginCombatPresentation();
  state.api.scheduleCombatPresentation(() => calls.push('live'), 616, second);
  assert.equal(state.tasks[0].delay, 616);
  state.tasks[0].callback();
  assert.deepEqual(calls, ['live']);
});

test('leaving combat flushes the durable finalizer exactly once before timers are invalidated', () => {
  const state = runtime(), generation = state.api.beginCombatPresentation(), lifecycle = { locked: true, saves: 0 };
  state.api.registerCombatPresentationFinalizer(generation, () => { lifecycle.locked = false; lifecycle.saves += 1; });
  state.api.scheduleCombatPresentation(() => state.api.runCombatPresentationFinalizer(generation), 740, generation);
  assert.equal(state.api.cancelCombatPresentation(), true);
  assert.deepEqual(lifecycle, { locked: false, saves: 1 });
  state.tasks.splice(0).forEach(task => task.callback());
  assert.deepEqual(lifecycle, { locked: false, saves: 1 }, 'stale timer cannot finalize twice');
  assert.equal(state.api.cancelCombatPresentation(), false);
  assert.match(html, /function showScreen\(id\)\{if\(id!=='combat'\)\{if\(typeof cancelCombatPresentation==='function'\)cancelCombatPresentation\(\);if\(typeof cancelAutoBattleStep==='function'\)cancelAutoBattleStep\(\)/);
  assert.match(html, /registerCombatPresentationFinalizer\(presentationGeneration,finalizeCardPresentation\)/);
  assert.match(html, /registerCombatPresentationFinalizer\(presentationGeneration,finalizeEnemyPresentation\)/);
});

test('multi-hit offsets and HP presentation advance at authored impact frames', () => {
  const state = runtime();
  assert.deepEqual(state.api.combatHitOffsets('volley', 3), [0, 96, 214]);
  state.api.renderEnemyHpPresentation(64, 100);
  assert.equal(state.enemyText.textContent, 'HP 64 / 100');
  assert.equal(state.enemyBar.style.width, '64%');
  assert.equal(state.enemyMini.style.width, '64%');

  state.api.renderPartyMemberPresentation({ targetId: 'VOLT', hpAfter: 23, shieldAfter: 4 });
  assert.equal(state.statusLabels[0].textContent, 'HP 23/68');
  assert.equal(state.statusLabels[1].textContent, '보호막 4');
  assert.equal(state.statusTag.textContent, '생존');
  assert.equal(state.spriteBars[1].style.width, '12%');

  state.api.presentPartyImpact({ targetId: 'VOLT', hpAfter: 0, shieldAfter: 0, blocked: 0 });
  assert.equal(state.run.battleSpriteState.VOLT, 'ko');
  assert.deepEqual(state.actorStates, ['ko']);
  assert.equal(state.statusTag.textContent, '전투불능');
  assert.equal(state.sprite.dead, true);
});
