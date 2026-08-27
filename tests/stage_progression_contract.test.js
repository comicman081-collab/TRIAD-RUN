const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const PROGRESSION = require('../src/triad_stage_progression.js');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html'), 'utf8');

test('legacy stages 1-30 retain their three acts and unscaled enemy data', () => {
  const sample = { id: 'TEST', act: 3, maxHp: 100, skills: [{ id: 'A', medianDamage: 10 }] };
  for (const stage of [1, 10, 11, 20, 21, 30]) {
    const info = PROGRESSION.stageInfo(stage);
    assert.equal(info.act, Math.ceil(stage / 10));
    assert.equal(info.overflowTier, 0);
    assert.equal(PROGRESSION.scaleMonster(sample, stage), sample);
  }
  assert.equal(PROGRESSION.stageInfo(10).isBoss, true);
  assert.equal(PROGRESSION.stageInfo(30).battleBackgroundIndex, 10);
});

test('stage 31 starts an open-ended fourth act with a local ten-node map', () => {
  const info = PROGRESSION.stageInfo(31);
  assert.deepEqual(info, {
    stage: 31,
    act: 4,
    stageInAct: 1,
    isBoss: false,
    mapStart: 31,
    mapEnd: 40,
    contentAct: 3,
    overflowTier: 1,
    battleBackgroundIndex: 1
  });
  assert.deepEqual(PROGRESSION.mapStages(31), [31, 32, 33, 34, 35, 36, 37, 38, 39, 40]);
});

test('post-30 scaling is finite, monotonic, and never mutates canonical monster data', () => {
  const source = { id: 'ACT3_BOSS', act: 3, maxHp: 200, skills: [{ id: 'A', medianDamage: 20 }, { id: 'B', medianDamage: 0 }] };
  const stage31 = PROGRESSION.scaleMonster(source, 31);
  const stage1000 = PROGRESSION.scaleMonster(source, 1000);
  assert.deepEqual(source, { id: 'ACT3_BOSS', act: 3, maxHp: 200, skills: [{ id: 'A', medianDamage: 20 }, { id: 'B', medianDamage: 0 }] });
  assert.ok(stage31.maxHp > source.maxHp);
  assert.ok(stage1000.maxHp > stage31.maxHp);
  assert.ok(stage1000.skills[0].medianDamage > stage31.skills[0].medianDamage);
  assert.ok(Number.isFinite(stage1000.maxHp));
  assert.ok(Number.isFinite(stage1000.skills[0].medianDamage));
});

test('backgrounds cycle without producing missing stage11+ paths and maps stay bounded', () => {
  assert.equal(PROGRESSION.stageInfo(31).battleBackgroundIndex, 1);
  assert.equal(PROGRESSION.stageInfo(60).battleBackgroundIndex, 10);
  assert.equal(PROGRESSION.stageInfo(61).battleBackgroundIndex, 1);
  assert.equal(PROGRESSION.mapStages(1000).length, 10);
  assert.deepEqual(PROGRESSION.mapStages(1000), [991, 992, 993, 994, 995, 996, 997, 998, 999, 1000]);
  assert.equal(PROGRESSION.stageInfo(1000).isBoss, true);
});

test('canonical runtime has no stage-30 completion branch or history clamp', () => {
  assert.match(html, /src\/triad_stage_progression\.js\?v=1\.0\.1-open-ended-overflow-hardening/);
  assert.match(html, /PROGRESSION\.mapStages\(run\.stage\)/);
  assert.match(html, /PROGRESSION\.scaleMonster\(source,stage\)/);
  assert.match(html, /PROGRESSION\.stageInfo\(run\.stage\)\.battleBackgroundIndex/);
  assert.doesNotMatch(html, /run\.stage\s*>\s*30/);
  assert.doesNotMatch(html, /STAGE \$\{run\.stage\} \/ 30/);
  assert.doesNotMatch(html, /Math\.min\(run\.stage,30\)/);
});

test('overflow inputs clamp inside a safe ten-node range and never create non-finite combat values', () => {
  const huge = PROGRESSION.stageInfo(1e308);
  assert.equal(huge.stage, PROGRESSION.MAX_STAGE);
  assert.equal(PROGRESSION.mapStages(1e308).length, 10);
  assert.equal(new Set(PROGRESSION.mapStages(1e308)).size, 10);
  assert.ok(PROGRESSION.mapStages(1e308).every(Number.isSafeInteger));
  const scaled = PROGRESSION.scaleMonster({ id: 'OVERFLOW', act: 3, maxHp: 200, skills: [{ medianDamage: 20 }] }, 1e308);
  assert.ok(Number.isFinite(scaled.maxHp));
  assert.ok(Number.isFinite(scaled.skills[0].medianDamage));
  assert.equal(PROGRESSION.stageInfo(Infinity).stage, 1);
});
