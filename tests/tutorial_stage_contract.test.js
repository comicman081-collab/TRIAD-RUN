'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ARCH = require('../src/triad_architecture.js');
const META = require('../src/triad_meta_progression.js');
const TUTORIAL = require('../src/triad_tutorial.js');

const root = path.resolve(__dirname, '..');
const runtimePath = path.join(root, 'TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html');
const html = fs.readFileSync(runtimePath, 'utf8');

function section(name, nextName) {
  const start = html.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist in the runtime`);
  const end = nextName ? html.indexOf(`function ${nextName}(`, start) : html.length;
  assert.notEqual(end, -1, `${nextName} must bound ${name}`);
  return html.slice(start, end);
}

function card(key) {
  return { pattern: { key } };
}

test('tutorial module defines the four ordered lessons and legacy-save exemption', () => {
  assert.equal(TUTORIAL.VERSION, 1);
  assert.equal(TUTORIAL.BASE_AP, 3);
  assert.equal(TUTORIAL.MAX_AP_BONUS, 2);
  assert.deepEqual(TUTORIAL.LESSONS, ['ATTACK', 'SHIELD', 'END_TURN', 'HEAL']);

  const fresh = TUTORIAL.normalize(undefined);
  assert.equal(fresh.status, 'BRIEFING');
  assert.equal(fresh.completed, false);
  assert.equal(fresh.lessonIndex, 0);
  assert.equal(TUTORIAL.normalize({ status: 'COMBAT', lessonIndex: 1.8 }).lessonIndex, 1);
  assert.equal(TUTORIAL.normalize({ status: 'COMBAT', lessonIndex: Infinity }).lessonIndex, 0);

  const legacy = TUTORIAL.normalize(undefined, { legacyComplete: true });
  assert.equal(legacy.status, 'COMPLETE');
  assert.equal(legacy.completed, true);
  assert.equal(legacy.skipped, true);

  const resume = section('resumeRun', 'migrateProductionVisual');
  assert.match(resume, /Object\.prototype\.hasOwnProperty\.call\(run,'tutorial'\)/);
  assert.match(resume, /legacyComplete:!hadTutorial/);
  assert.ok(
    resume.indexOf("run.combat?.type==='tutorial'") < resume.indexOf('else if(run.combat)'),
    'terminal tutorial recovery must run before the generic combat resume branch',
  );
  assert.match(resume, /run\.combat\.phase==='TERMINAL'\|\|run\.tutorial\.status==='DEBRIEF'/);
  assert.match(resume, /restoreTutorialBaseline\(\).*status:'DEBRIEF'/s);
});

test('every newly-created run enters the pre-stage tutorial before route generation', () => {
  const startRun = section('startRun', 'saveRun');
  const showRoute = section('showRoute', 'ensureRouteOffer');

  assert.match(startRun, /setup\.draftSelected\.length!==5/);
  assert.match(startRun, /stage:1,act:1/);
  assert.match(startRun, /tutorial:TUTORIAL\.defaultState\(\)/);
  assert.match(startRun, /saveRun\(\);showTutorialStage\(\)/);
  assert.doesNotMatch(startRun, /showRoute\(\)/);
  assert.match(showRoute, /run\?\.tutorial.*!TUTORIAL\.normalize\(run\.tutorial\)\.completed.*showTutorialStage\(\)/);

  assert.match(html, /<section id="tutorial" class="screen">/);
  assert.match(html, /id="tutorialBriefing"/);
  assert.match(html, /id="tutorialCombatCoach"/);
  assert.match(html, /출전 캐릭터 3명 선택/);
  assert.match(html, /스테이지 클리어와 방치 보상으로 모집·돌파 재화/);
});

test('attack, shield, end-turn, and heal are hard-gated in that order', () => {
  let state = { ...TUTORIAL.defaultState(), status: 'COMBAT' };

  assert.equal(TUTORIAL.requirement(state), 'ATTACK');
  assert.equal(TUTORIAL.checkCard(state, card('guard')).allowed, false);
  assert.equal(TUTORIAL.checkEndTurn(state).allowed, false);
  assert.equal(TUTORIAL.checkCard(state, card('strike')).allowed, true);
  state = TUTORIAL.recordCard(state, card('strike'));
  assert.equal(state.lessonIndex, 1);
  assert.equal(state.lessons.attack, true);

  assert.equal(TUTORIAL.requirement(state), 'SHIELD');
  assert.equal(TUTORIAL.checkCard(state, card('heavy')).allowed, false);
  assert.equal(TUTORIAL.checkCard(state, card('guard')).allowed, true);
  state = TUTORIAL.recordCard(state, card('guard'));
  assert.equal(state.lessonIndex, 2);
  assert.equal(state.lessons.shield, true);

  assert.equal(TUTORIAL.requirement(state), 'END_TURN');
  assert.equal(TUTORIAL.checkCard(state, card('heal')).allowed, false);
  assert.equal(TUTORIAL.checkEndTurn(state).allowed, true);
  state = TUTORIAL.recordEndTurn(state);
  assert.equal(state.lessonIndex, 3);

  assert.equal(TUTORIAL.requirement(state), 'HEAL');
  assert.equal(TUTORIAL.checkCard(state, card('strike')).allowed, false);
  assert.equal(TUTORIAL.checkEndTurn(state).allowed, false);
  assert.equal(TUTORIAL.checkCard(state, card('heal')).allowed, true);
  state = TUTORIAL.recordCard(state, card('heal'));
  assert.equal(state.lessonIndex, 4);
  assert.equal(state.lessons.heal, true);
  assert.equal(TUTORIAL.requirement(state), null);
  assert.equal(TUTORIAL.checkCard(state, card('heavy')).allowed, true);
  assert.equal(TUTORIAL.checkEndTurn(state).allowed, true);

  const play = section('playCardAuthoritative', 'endTurnAuthoritative');
  const endTurn = section('endTurnAuthoritative', 'svgDataUri');
  const render = section('renderCombat', 'renderMap');
  assert.ok(play.indexOf('TUTORIAL.checkCard') < play.indexOf('c.inputLocked=true'), 'card gate must run before state mutation');
  assert.match(play, /TUTORIAL\.recordCard\(run\.tutorial,card\)/);
  assert.ok(endTurn.indexOf('TUTORIAL.checkEndTurn') < endTurn.indexOf('takeUiInputFence'), 'end-turn gate must run before state mutation');
  assert.ok(endTurn.indexOf('enemyTurn()') < endTurn.indexOf('TUTORIAL.recordEndTurn'), 'enemy action must be observed before the heal lesson');
  assert.match(render, /playable=inputOpen&&ownerAlive&&cost<=c\.energy&&tutorialGate\.allowed/);
  assert.match(render, /endTurnOpen=inputOpen&&\(!tutorial\|\|TUTORIAL\.checkEndTurn\(run\.tutorial\)\.allowed\)/);
});

test('tutorial loadout always supplies real attack, party-shield, and heal cards', () => {
  const ids = TUTORIAL.trainingCardIds(['EMBER', 'AEGIS', 'BLOOM']);
  assert.deepEqual(ids, ['EMBER_01', 'AEGIS_02', 'EMBER_03', 'AEGIS_04', 'BLOOM_10']);
  assert.equal(TUTORIAL.cardCategory(card('strike')), 'ATTACK');
  assert.equal(TUTORIAL.cardCategory(card('guard')), 'SHIELD');
  assert.equal(TUTORIAL.cardCategory(card('heal')), 'HEAL');

  const draw = section('tutorialDrawPile', 'startCombat');
  assert.match(draw, /TUTORIAL\.trainingCardIds\(partyCoreIds\(\)\)/);
  assert.match(draw, /initialIds\.map\(stateFor\)\.reverse\(\)/, 'pop-based draw pile must yield attack then shield');
  assert.doesNotMatch(draw, /shuffle\(|TRIAD_ARCH\.random/, 'tutorial deck construction must not consume the run RNG');

  const enemy = section('tutorialEnemyForBattle', 'tutorialDrawPile');
  assert.doesNotMatch(enemy, /shuffle\(|choice\(|TRIAD_ARCH\.random/, 'tutorial enemy selection must be deterministic');
  const primaryDamage = Number(enemy.match(/medianDamage:index\?\d+:(\d+)/)?.[1]);
  assert.ok(primaryDamage >= 20, 'the forced enemy turn must pierce even a maxed guard so the heal lesson has visible missing HP');
});

test('briefing states 3 base AP, +2 maximum, and the exact 5+3 deck composition', () => {
  assert.equal(TUTORIAL.BASE_AP + TUTORIAL.MAX_AP_BONUS, 5);
  assert.equal(META.MAX_BASE_ENERGY_BONUS, 2);

  const snapshot = section('createRunAccountSnapshot', 'ensureRunAccountSnapshot');
  const turn = section('newTurnAuthoritative', 'playCardAuthoritative');
  assert.match(snapshot, /Math\.min\(META\.MAX_BASE_ENERGY_BONUS/);
  assert.match(turn, /c\.energy=3\+runBaseEnergyBonus\(\)\+\(hasArtifact\('energyPlus'\)\?1:0\)/);
  assert.match(html, /무강화 기본값은 3/);
  assert.match(html, /행동력 확장 셀로 \+2, 최대 기본 5/);
  assert.match(html, /시작 카드 5장/);
  assert.match(html, /고유 카드 3장은 RUN 시작 시 자동으로 덱에 추가/);

  const ensureSource = section('ensureSignatureDeck', 'cardValue');
  const sandbox = { result: null };
  vm.runInNewContext(
    `const accountCardLevel=()=>1;${ensureSource};result=ensureSignatureDeck(`
      + `${JSON.stringify(['EMBER_01', 'AEGIS_02', 'BLOOM_10', 'EMBER_04', 'AEGIS_05'].map(id => ({ id, level: 1 })))},`
      + `${JSON.stringify([{ coreId: 'EMBER' }, { coreId: 'AEGIS' }, { coreId: 'BLOOM' }])});`,
    sandbox,
  );
  assert.equal(sandbox.result.length, 8);
  assert.deepEqual(
    Array.from(sandbox.result.slice(5), entry => entry.id),
    ['EMBER_15', 'AEGIS_15', 'BLOOM_15'],
  );
  assert.ok(sandbox.result.slice(5).every(entry => entry.isSignature === true));
});

test('tutorial completion restores stage-one state and the exact pre-tutorial RNG stream', () => {
  const captureSource = section('captureTutorialBaseline', 'restoreTutorialBaseline');
  const restoreSource = section('restoreTutorialBaseline', 'tutorialPartyMarkup');
  const initialRun = {
    seed: 424242,
    rngState: 424242,
    rngCursor: 0,
    lastOwner: null,
    stage: 1,
    wins: 0,
    stats: { damage: 0, healing: 0, cardsPlayed: 0, maxTurnDamage: 0 },
    party: [
      { id: 'EMBER', hp: 70, maxHp: 70, shield: 0 },
      { id: 'AEGIS', hp: 94, maxHp: 94, shield: 0 },
      { id: 'BLOOM', hp: 80, maxHp: 80, shield: 0 },
    ],
    deck: [{ id: 'EMBER_01', level: 1 }],
    path: [],
    routeOffer: null,
    rewardOffer: null,
    pendingTransition: null,
    transactionLedger: {},
    combat: null,
    battleSpriteState: {},
    tutorial: null,
  };
  const sandbox = {
    run: JSON.parse(JSON.stringify(initialRun)),
    clone: value => JSON.parse(JSON.stringify(value)),
    Object,
    Number,
  };
  vm.runInNewContext(`${captureSource}\n${restoreSource}`, sandbox);
  const baseline = sandbox.captureTutorialBaseline();
  sandbox.run.tutorial = { baseline };

  const control = JSON.parse(JSON.stringify(initialRun));
  const routePool = ['battle', 'elite', 'rest', 'event', 'battle'];
  const expectedRoute = ARCH.shuffle(control, routePool).slice(0, 3);

  ARCH.random(sandbox.run);
  ARCH.random(sandbox.run);
  sandbox.run.lastOwner = 'AEGIS';
  sandbox.run.stats = { damage: 999, healing: 88, cardsPlayed: 7, maxTurnDamage: 55 };
  sandbox.run.party[0].hp = 3;
  sandbox.run.party[0].shield = 41;
  sandbox.run.combat = { type: 'tutorial', phase: 'PLAYER' };
  sandbox.run.rewardOffer = null;

  assert.equal(sandbox.restoreTutorialBaseline(), true);
  assert.equal(sandbox.run.stage, 1);
  assert.equal(sandbox.run.wins, 0);
  assert.equal(sandbox.run.rngState, initialRun.rngState);
  assert.equal(sandbox.run.rngCursor, initialRun.rngCursor);
  assert.equal(sandbox.run.lastOwner, null);
  assert.equal(JSON.stringify(sandbox.run.stats), JSON.stringify(initialRun.stats));
  assert.equal(sandbox.run.party[0].hp, 70);
  assert.equal(sandbox.run.party[0].shield, 0);
  assert.equal(sandbox.run.combat, null);
  assert.deepEqual(ARCH.shuffle(sandbox.run, routePool).slice(0, 3), expectedRoute);
  assert.deepEqual(sandbox.run.deck, initialRun.deck);
  assert.deepEqual(sandbox.run.path, []);
  assert.equal(sandbox.run.routeOffer, null);
  assert.equal(sandbox.run.rewardOffer, null);
  assert.equal(sandbox.run.pendingTransition, null);
  assert.deepEqual(sandbox.run.transactionLedger, {});

  const complete = section('completeTutorialStage', 'tutorialRequirementCopy');
  assert.ok(complete.indexOf('restoreTutorialBaseline()') < complete.indexOf('showRoute()'));
  for (const forbidden of ['completeStage(', 'META.applyStageClear', 'buildRewardOffer(', 'run.stage++', 'run.wins++', 'TRIAD_TXN.pending']) {
    assert.ok(!complete.includes(forbidden), `tutorial completion must not contain ${forbidden}`);
  }

  const tutorialWin = section('winTutorialCombat', 'winCombat');
  for (const forbidden of ['buildRewardOffer(', 'META.applyStageClear', 'run.stage++', 'run.wins++', 'TRIAD_TXN.pending']) {
    assert.ok(!tutorialWin.includes(forbidden), `tutorial victory must not contain ${forbidden}`);
  }
  const normalWin = section('winCombat', 'buildArtifactOffer');
  assert.ok(normalWin.indexOf("if(combat.type==='tutorial')return winTutorialCombat()") < normalWin.indexOf('run.wins=nextWin'));
});
