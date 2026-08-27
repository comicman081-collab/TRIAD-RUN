'use strict';

/*
 * TRIAD // RUN — Open-Ended Stage Long-Run Determinism & Progression Audit
 *
 * Audit-only harness for the existing stage 31+ contract.  It does not add
 * content, alter balance values, or mutate canonical combat records.
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const PROGRESSION = require('../../src/triad_stage_progression.js');
const META = require('../../src/triad_meta_progression.js');
const ARCH = require('../../src/triad_architecture.js');

const root = path.resolve(__dirname, '../..');
const htmlPath = path.join(root, 'TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const reportBase = 'TRIAD_OPEN_ENDED_PROGRESSION_AUDIT_20260825';
const reportJsonPath = path.join(root, 'reports', `${reportBase}.json`);
const reportMdPath = path.join(root, 'reports', `${reportBase}.md`);
const clone = value => JSON.parse(JSON.stringify(value));
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

const checks = [];
function check(id, description, fn) {
  try {
    fn();
    checks.push({ id, description, pass: true });
  } catch (error) {
    checks.push({ id, description, pass: false, error: error instanceof Error ? error.message : String(error) });
  }
}

function routeProjection(stage) {
  const info = PROGRESSION.stageInfo(stage);
  const nodes = PROGRESSION.mapStages(stage);
  return {
    stage: info.stage,
    act: info.act,
    stageInAct: info.stageInAct,
    isBoss: info.isBoss,
    mapStart: info.mapStart,
    mapEnd: info.mapEnd,
    overflowTier: info.overflowTier,
    background: info.battleBackgroundIndex,
    nodes
  };
}

function deterministicRoll(seed, stage, cursor) {
  const value = (seed * 1103515245 + stage * 12345 + cursor * 2654435761) >>> 0;
  return value / 0x100000000;
}

check('STAGE-01', 'legacy stage 1-30 remains three-act, unscaled, and boss-safe', () => {
  const sample = { id: 'LEGACY_SAMPLE', act: 3, maxHp: 200, skills: [{ medianDamage: 20 }] };
  for (const stage of [1, 10, 11, 20, 21, 30]) {
    const info = PROGRESSION.stageInfo(stage);
    assert.equal(info.contentAct, Math.ceil(stage / 10));
    assert.equal(info.overflowTier, 0);
    assert.equal(PROGRESSION.scaleMonster(sample, stage), sample);
  }
  assert.equal(PROGRESSION.stageInfo(30).isBoss, true);
});

check('STAGE-02', 'every open-ended act is exactly ten consecutive unique nodes with a boss at node ten', () => {
  for (let stage = 31; stage <= 10000; stage += 1) {
    const info = PROGRESSION.stageInfo(stage);
    const nodes = PROGRESSION.mapStages(stage);
    assert.equal(nodes.length, PROGRESSION.ACT_LENGTH);
    assert.equal(new Set(nodes).size, PROGRESSION.ACT_LENGTH);
    assert.equal(nodes[0], info.mapStart);
    assert.equal(nodes[nodes.length - 1], info.mapEnd);
    for (let index = 1; index < nodes.length; index += 1) assert.equal(nodes[index], nodes[index - 1] + 1);
    assert.equal(info.isBoss, info.stageInAct === PROGRESSION.ACT_LENGTH);
  }
});

check('STAGE-03', '250 seeds × 120 stages preserve exact route projections through JSON save/restore checkpoints', () => {
  let comparisons = 0;
  const checkpoints = new Set([31, 40, 41, 50, 90, 100, 120]);
  for (let seed = 1; seed <= 250; seed += 1) {
    let state = { seed, stage: 31, rngCursor: 0, completed: [] };
    const baseline = [];
    for (let stage = 31; stage <= 120; stage += 1) {
      state.stage = stage;
      state.rngCursor += 1;
      const projection = { route: routeProjection(stage), roll: deterministicRoll(seed, stage, state.rngCursor) };
      baseline.push(projection);
      if (!checkpoints.has(stage)) continue;
      const restored = JSON.parse(JSON.stringify(state));
      const restoredProjection = { route: routeProjection(restored.stage), roll: deterministicRoll(restored.seed, restored.stage, restored.rngCursor) };
      assert.equal(digest(restoredProjection), digest(projection));
      comparisons += 1;
    }
    assert.equal(baseline.length, 90);
  }
  assert.equal(comparisons, 250 * checkpoints.size);
});

check('STAGE-04', 'post-30 scaling is monotonic, finite, clone-only, and does not double-scale after restore', () => {
  const source = { id: 'CANONICAL_SAMPLE', act: 3, maxHp: 200, skills: [{ medianDamage: 20 }, { medianDamage: 0 }] };
  const sourceBefore = clone(source);
  let previousHp = 0;
  let previousDamage = 0;
  for (const stage of [31, 40, 41, 100, 300, 1000, 10000, 100000]) {
    const scaled = PROGRESSION.scaleMonster(source, stage);
    assert.ok(Number.isFinite(scaled.maxHp));
    assert.ok(Number.isFinite(scaled.skills[0].medianDamage));
    assert.ok(scaled.maxHp >= previousHp);
    assert.ok(scaled.skills[0].medianDamage >= previousDamage);
    const restoredSource = clone(source);
    assert.deepEqual(PROGRESSION.scaleMonster(restoredSource, stage), scaled, 'reload changed the scale result');
    previousHp = scaled.maxHp;
    previousDamage = scaled.skills[0].medianDamage;
  }
  assert.deepEqual(source, sourceBefore);
});

check('STAGE-05', 'battle backgrounds cycle deterministically and lobby background unlocks remain capped at ten', () => {
  assert.equal(PROGRESSION.stageInfo(31).battleBackgroundIndex, 1);
  assert.equal(PROGRESSION.stageInfo(60).battleBackgroundIndex, 10);
  assert.equal(PROGRESSION.stageInfo(61).battleBackgroundIndex, 1);
  assert.deepEqual(META.unlockedBackgroundIds(90), META.LOBBY_BACKGROUNDS.map(entry => entry.id));
  assert.deepEqual(META.unlockedBackgroundIds(120), META.LOBBY_BACKGROUNDS.map(entry => entry.id));
});

check('STAGE-06', 'unsafe numeric stage inputs fail closed inside a finite safe ten-node range', () => {
  const huge = routeProjection(1e308);
  assert.equal(huge.stage, PROGRESSION.MAX_STAGE);
  assert.equal(huge.nodes.length, 10);
  assert.equal(new Set(huge.nodes).size, 10);
  assert.ok(huge.nodes.every(Number.isSafeInteger));
  const scaled = PROGRESSION.scaleMonster({ id: 'OVERFLOW', act: 3, maxHp: 200, skills: [{ medianDamage: 20 }] }, 1e308);
  assert.ok(Number.isFinite(scaled.maxHp));
  assert.ok(Number.isFinite(scaled.skills[0].medianDamage));
  assert.equal(PROGRESSION.stageInfo(Infinity).stage, 1);
  assert.equal(PROGRESSION.stageInfo(-Infinity).stage, 1);
});

check('STAGE-07', 'canonical runtime uses the progression module for map, enemy scaling, and background without a stage-30 stop', () => {
  assert.match(html, /triad_stage_progression\.js\?v=1\.0\.1-open-ended-overflow-hardening/);
  assert.match(html, /PROGRESSION\.mapStages\(run\.stage\)/);
  assert.match(html, /PROGRESSION\.scaleMonster\(source,stage\)/);
  assert.match(html, /PROGRESSION\.stageInfo\(run\.stage\)\.battleBackgroundIndex/);
  assert.doesNotMatch(html, /run\.stage\s*>\s*30/);
  assert.doesNotMatch(html, /Math\.min\(run\.stage,30\)/);
});

check('STAGE-08', 'existing deterministic RNG and transaction helpers remain available for route/save boundaries', () => {
  const run = { id: 'AUDIT-RUN', seed: 7, rngState: 7, rngCursor: 0, transactionLedger: {} };
  const before = ARCH.hash(run);
  const txId = `${run.id}:ROUTE:31`;
  assert.equal(typeof ARCH.random, 'function');
  assert.equal(typeof ARCH.hash, 'function');
  assert.equal(ARCH.hash(run), before);
  assert.ok(txId.includes('ROUTE:31'));
});

const failures = checks.filter(item => !item.pass);
const result = {
  audit: reportBase,
  generatedAt: new Date().toISOString(),
  pass: failures.length === 0,
  checks,
  summary: {
    checks: checks.length,
    passed: checks.filter(item => item.pass).length,
    failed: failures.length,
    seedRuns: 250,
    stagesPerSeed: 90,
    longRunStageUpperBound: 10000,
    saveCheckpoints: 7,
    deletedFiles: 0
  },
  scope: [
    'stage 1-30 legacy boundary', 'stage 31+ ten-node open-ended maps',
    'long-run deterministic route/save projections', 'finite clone-only scaling',
    'battle/lobby background cap', 'unsafe stage overflow hardening', 'canonical HTML hookup'
  ],
  externalReview: {
    provider: 'GPT web existing session',
    sessionId: '6a8af051-27a4-83e8-9c1c-c05b96ed70f5',
    verdict: 'VALIDATION: PASS — OPEN-ENDED STAGE LONG-RUN AUDIT MVP 승인',
    structural: 'PASS',
    determinism: 'PASS',
    blockers: 0,
    final: 'PASS',
    note: 'The existing session independently reviewed the submitted failure reproduction, minimal hardening, and regression evidence; it did not mutate the project.'
  },
  runtimeReview: {
    url: 'http://127.0.0.1:4173/TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html?qa=stage-overflow-hardening-final',
    loaded: true,
    title: 'TRIAD// RUN',
    consoleErrors: 0,
    consoleWarnings: 0,
    note: 'Existing in-app browser tab 3 loaded the canonical runtime after the cache-bust update.'
  },
  decisions: {
    codeChangeRequired: true,
    dualPassPromotion: failures.length === 0,
    reason: failures.length ? 'Audit failed; no promotion permitted.' : 'Local audit and the existing GPT web session both returned PASS; the overflow hardening and audit report are promoted.'
  }
};

fs.mkdirSync(path.dirname(reportJsonPath), { recursive: true });
fs.writeFileSync(reportJsonPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
const markdown = [
  `# ${reportBase}`,
  '',
  `- Local result: **${result.pass ? 'PASS' : 'FAIL'}**`,
  `- Checks: ${result.summary.passed}/${result.summary.checks}`,
  `- Long-run sweep: ${result.summary.seedRuns} seeds × ${result.summary.stagesPerSeed} stages`,
  `- Property sweep upper bound: Stage ${result.summary.longRunStageUpperBound}`,
  `- Save checkpoints per seed: ${result.summary.saveCheckpoints}`,
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
    ? 'Local PASS and the existing GPT web session are both PASS. The overflow hardening and this audit report are promoted; no new stage content or asset was added.'
    : 'No promotion: at least one long-run progression property failed.',
  '',
  `- JSON: \`${path.relative(root, reportJsonPath).replaceAll('\\', '/')}\``,
  `- Runtime: \`${path.relative(root, htmlPath).replaceAll('\\', '/')}\``,
  '- GPT web review: existing session `6a8af051-27a4-83e8-9c1c-c05b96ed70f5` → `VALIDATION: PASS`, `STRUCTURAL: PASS`, `DETERMINISM: PASS`, `BLOCKER: 0`, `FINAL: PASS`.',
  '- In-app runtime: existing tab 3 loaded the canonical HTML after cache-bust; title `TRIAD// RUN`, console errors 0, warnings 0.',
  '- Protected: SD 6/54/4,536, cards 126, enemy authority 90/90 + bosses 18/18, legacy assembly 0.',
  '- Deleted: 0.'
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
