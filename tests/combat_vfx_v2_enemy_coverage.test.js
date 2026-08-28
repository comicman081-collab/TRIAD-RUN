'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html'), 'utf8');
const baseSource = fs.readFileSync(path.join(root, 'combat_vfx_data.js'), 'utf8');
const v2Source = fs.readFileSync(path.join(root, 'combat_vfx_pipeline_v2.js'), 'utf8');
const window = {
  TRIAD_COMBAT_VISUAL_DATA: { resolveCard: () => ['IMPACT'] },
  TRIAD_COMBAT_DATA: { ARCHETYPES: [] },
};
vm.runInNewContext(baseSource, { window }, { filename: 'combat_vfx_data.js' });
vm.runInNewContext(v2Source, { window }, { filename: 'combat_vfx_pipeline_v2.js' });
const vfx = window.TRIAD_COMBAT_VFX;

function enemy(archetype, rank = 'normal') {
  return vfx.enemy({
    data: {
      id: `TRIAD_M01_${archetype}_UNIT`,
      archetypeKey: `TRIAD_${archetype}_UNIT`,
      rank,
      elementId: 'EMBER',
    },
  });
}

test('normal monster projectile archetypes use their own directional projectile profiles', () => {
  for (const archetype of ['SCOUT', 'CASTER', 'HUNTER']) {
    const event = enemy(archetype);
    assert.equal(event.pipeline, 'PROJECTILE', archetype);
    assert.equal(event.asset, vfx.ASSETS.PROJECTILE, archetype);
    assert.equal(event.impactAsset, vfx.ASSETS.IMPACT, archetype);
    assert.equal(event.contactMs < event.duration, true, archetype);
  }
  assert.notEqual(enemy('SCOUT').particleProfile, enemy('CASTER').particleProfile);
  assert.notEqual(enemy('CASTER').duration, enemy('HUNTER').duration);
});

test('normal and elite melee monsters use high-impact source art rather than a fake projectile', () => {
  for (const archetype of ['HOUND', 'WARDEN', 'BRUTE', 'WEAVER', 'RAVAGER', 'SENTINEL']) {
    const event = enemy(archetype);
    assert.equal(event.pipeline, 'HEAVY_IMPACT', archetype);
    assert.equal(event.impactAsset, vfx.ASSETS.IMPACT, archetype);
    assert.notEqual(event.asset.motion, 'TRAVEL', archetype);
  }
  for (const archetype of ['REAPER', 'COLOSSUS']) {
    const event = enemy(archetype, 'elite');
    assert.equal(event.pipeline, 'HEAVY_IMPACT', archetype);
    assert.match(event.category, /^ELITE_(REAPER|COLOSSUS)$/);
    assert.equal(event.contactMs, 260);
  }
});

test('elite vanguard and all bosses retain dedicated source art and finishers', () => {
  const vanguard = enemy('VANGUARD', 'elite');
  assert.equal(vanguard.pipeline, 'PROJECTILE');
  assert.equal(vanguard.category, 'ELITE_VANGUARD');
  assert.equal(vanguard.asset, vfx.ASSETS.ELITE_VANGUARD);

  for (const archetype of ['APOSTLE', 'OVERMIND', 'SOVEREIGN']) {
    const event = enemy(archetype, 'boss');
    assert.equal(event.pipeline, 'ULTIMATE', archetype);
    assert.match(event.category, /^BOSS_(APOSTLE|OVERMIND|SOVEREIGN)$/);
    assert.equal(event.priority, 'P0');
    assert.equal(event.contactMs, Math.round(event.duration * 0.52));
  }
});

test('monster and boss VFX have bounded debris with deterministic cleanup and actor-facing travel', () => {
  assert.match(html, /const BATTLE_VFX_FRAGMENT_CAP=160;/);
  assert.match(html, /battleVfxFragmentsLive\+=count/);
  assert.match(html, /battleVfxFragmentsLive=Math\.max\(0,battleVfxFragmentsLive-count\)/);
  assert.match(html, /requested=boss\|\|signature\?76:event\?\.pipeline==='PROJECTILE'\?46:event\?\.kind==='ENEMY'\?36:40/);
  assert.match(html, /source\.x>target\.x\?180:0/);
  assert.match(html, /appendCombatVfxCharge\(event,source,150,7\)/);
  assert.match(html, /appendCombatVfxImpactBurst\(event,target\)/);
  assert.doesNotMatch(html, /function spawnSdProjectile\(/);
});
