/* Locks support-area coverage and direct actor-to-actor VFX targeting. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html'), 'utf8');
const source = fs.readFileSync(path.join(root, 'combat_vfx_data.js'), 'utf8');
const window = {
  TRIAD_COMBAT_VISUAL_DATA: {
    resolveCard(key, owner) {
      if (key === 'signature') return ['ULTIMATE', owner === 'BLOOM' ? 'HEAL' : 'IMPACT'];
      if (['quick', 'dot', 'burst', 'volley'].includes(key)) return ['PROJECTILE', 'IMPACT'];
      if (key === 'heal') return ['HEAL'];
      if (['guard', 'bastion', 'counter'].includes(key)) return ['SHIELD'];
      return ['IMPACT'];
    },
  },
  TRIAD_COMBAT_DATA: { ARCHETYPES: [{ key: 'SCOUT' }] },
};
vm.runInNewContext(source, { window }, { filename: 'combat_vfx_data.js' });
const vfx = window.TRIAD_COMBAT_VFX;

test('heal and shield presentation covers the full allied formation', () => {
  for (const card of [
    { pattern: { key: 'heal' }, owner: 'BLOOM' },
    { pattern: { key: 'guard' }, owner: 'AEGIS' },
    { pattern: { key: 'renewal' }, owner: 'BLOOM' },
    { pattern: { key: 'signature' }, owner: 'AEGIS' },
    { pattern: { key: 'signature' }, owner: 'BLOOM' },
  ]) {
    const event = vfx.card(card);
    assert.equal(event.target, 'party');
    assert.equal(event.scope, 'ALL_ALLIES');
  }
  assert.match(html, /\.battle-vfx\[data-target-scope="ALL_ALLIES"\]\{[^}]*width:var\(--vfx-zone-width[^}]*height:var\(--vfx-zone-height[^}]*filter:opacity\(\.64\)/s);
  assert.match(html, /function combatVfxPartyZone\(stageRect\)[\s\S]*?\.ally-side \.sd-card:not\(\.dead\)/);
});

test('thrown player and enemy skills travel actor-to-actor and finish on the body target', () => {
  const card = vfx.card({ pattern: { key: 'quick' }, owner: 'VOLT' });
  const enemy = vfx.enemy({ data: { catalogNo: 1, rank: 'normal', elementId: 'RIFT' } });
  assert.equal(card.asset.motion, 'TRAVEL');
  assert.equal(card.impactAsset, vfx.ASSETS.IMPACT);
  assert.equal(enemy.asset.motion, 'TRAVEL');
  assert.equal(enemy.impactAsset, vfx.ASSETS.IMPACT);
  assert.match(html, /data-core-id="\$\{esc\(p\.id\|\|core\?\.id\|\|'\'\)\}"/);
  assert.match(html, /node\.dataset\.coreId===owner\|\|node\.dataset\.characterId===owner/);
  assert.match(html, /asset\.motion==='TRAVEL'&&event\.impactAsset/);
  assert.match(html, /appendCombatVfxParticle\(\{\.\.\.event,scope:'SINGLE'/);
});

test('travel impact VFX, cinematic SFX, and battle shake share one collision delay', () => {
  assert.match(html, /function combatVfxTravelImpactMs\(event\)\{[^}]*asset\?\.motion!==['"]TRAVEL['"][^}]*\.72/s);
  assert.match(html, /SFX\.playCard\(card,\{damage:damageDealt,hits,damageType,impactDelay:cardImpactDelay\}\)/);
  assert.match(html, /SFX\.playEnemy\(\{hits:enemyResults\.length,results:enemyResults,enemy:c\.enemy\.data,skillId:enemyActionSkillId,impactDelay:enemyImpactDelay\}\)/);
  assert.match(html, /pulseBattleImpact\('enemy',cardImpactDelay\?\?/);
  assert.match(html, /pulseBattleImpact\('player',enemyImpactDelay\?\?420\)/);
});
