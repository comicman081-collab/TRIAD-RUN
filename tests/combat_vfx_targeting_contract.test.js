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
const v2Source = fs.readFileSync(path.join(root, 'combat_vfx_pipeline_v2.js'), 'utf8');
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
vm.runInNewContext(v2Source, { window }, { filename: 'combat_vfx_pipeline_v2.js' });
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
  assert.equal(card.impactAsset, vfx.ASSETS.SHOCK);
  assert.equal(card.impactProfile, 'ion-burst');
  assert.equal(enemy.asset.motion, 'TRAVEL');
  assert.equal(enemy.impactAsset, vfx.ASSETS.SHOCK);
  assert.match(html, /data-core-id="\$\{esc\(p\.id\|\|core\?\.id\|\|'\'\)\}"/);
  assert.match(html, /node\.dataset\.coreId===owner\|\|node\.dataset\.characterId===owner/);
  assert.match(html, /triggerCombatVfxImpact\(event,event\.impactAsset\|\|asset,target,stage\)/);
  assert.match(html, /appendCombatVfxParticle\(impactEvent,asset,target,target,null,'IMPACT'\)/);
});

test('travel impact VFX, cinematic SFX, and battle shake share one collision delay', () => {
  assert.match(html, /function combatVfxTravelImpactMs\(event\)\{[^}]*asset\?\.motion!==['"]TRAVEL['"][^}]*\.72/s);
  assert.match(html, /function presentCombatVfxSequence\(event,offsets,generation\)[\s\S]*?scheduleCombatPresentation\(\(\)=>presentCombatVfx\(event\),offset,generation\)/);
  assert.match(html, /SFX\.playCard\(card,\{damage:damageDealt,hits,damageType,impactDelay:cardImpactDelay,enemy:c\.enemy\.data,defeated\}\)/);
  assert.match(html, /SFX\.playEnemy\(\{hits:enemyResults\.length,results:enemyResults,enemy:c\.enemy\.data,skillId:enemyActionSkillId,impactDelay:enemyImpactDelay\}\)/);
  assert.match(html, /renderEnemyHpPresentation\(result\.hpAfter,c\.enemy\.maxHp\);pulseBattleImpact\('enemy'\).*?cardImpactDelay\+\(hitOffsets\[index\]\|\|0\)/s);
  assert.match(html, /combatEnemyVfxEvent\(c\.enemy,result\.targetId\).*?presentPartyImpact\(result\);pulseBattleImpact\('player'\).*?enemyImpactDelay\+offset/s);
  assert.match(html, /const presentationEnd=Math\.max\(360,hitResults\.length\?cardImpactDelay\+\(hitOffsets\[hitResults\.length-1\]\|\|0\)\+90:220\)/);
});

test('every offensive skill gets a directional projectile, a non-generic collision source, and fragments', () => {
  const expectedImpactAsset = { quick: 'SHOCK', dot: 'BURN', volley: 'SHOCK' };
  for (const card of [
    { pattern: { key: 'quick' }, owner: 'EMBER' },
    { pattern: { key: 'dot' }, owner: 'AEGIS' },
    { pattern: { key: 'volley' }, owner: 'BLOOM' },
  ]) {
    const event = vfx.card(card);
    assert.equal(event.asset.motion, 'TRAVEL');
    assert.equal(event.impactAsset, vfx.ASSETS[expectedImpactAsset[card.pattern.key]]);
    assert.notEqual(event.impactProfile, 'arc-cleave');
  }
  const heavy = vfx.card({ pattern: { key: 'heavy' }, owner: 'AEGIS' });
  assert.equal(heavy.pipeline, 'HEAVY_IMPACT');
  assert.equal(heavy.asset, vfx.ASSETS.IMPACT);
  const enemy = vfx.enemy({ data: { catalogNo: 1, rank: 'normal', elementId: 'EMBER' } });
  assert.equal(enemy.asset.motion, 'TRAVEL');
  assert.equal(enemy.impactAsset, vfx.ASSETS.SHOCK);
  assert.match(html, /function appendCombatVfxImpactBurst\(event,target\)/);
  assert.match(html, /battle-vfx-fragment/);
  assert.match(html, /--vfx-rotation/);
  assert.match(html, /source\.x>target\.x\?180:0/);
  assert.match(html, /\.battle-vfx\[data-motion="TRAVEL"\]\{width:clamp\(230px,31vw,520px\)/);
  assert.match(html, /appendCombatVfxCharge\(event,source,150,7\);appendCombatVfxWake\(event,source,target,primary\.duration\)/);
  assert.doesNotMatch(html, /function spawnSdProjectile\(/);
  assert.equal(vfx.VERSION, '2.2.0-ultimate-launch-ruptures');
});

test('offensive signature cards launch compact authored energy before their unique rupture', () => {
  for (const owner of ['EMBER', 'VOLT', 'SHADE', 'RIFT']) {
    const event = vfx.card({ pattern: { key: 'signature' }, owner });
    assert.equal(event.pipeline, 'ULTIMATE', owner);
    assert.equal(event.launchAsset, vfx.ASSETS.PROJECTILE, owner);
    assert.equal(event.launchAsset.motion, 'TRAVEL', owner);
    assert.notEqual(event.impactAsset, event.launchAsset, owner);
    assert.equal(event.launchDuration > event.contactMs, true, owner);
  }
  assert.match(html, /pipeline==='ULTIMATE'&&event\.launchAsset\?\.path/);
  assert.match(html, /appendCombatVfxWake\(launchEvent,source,target,launch\.duration\)/);
});
