'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const window = {};
window.window = window;
for (const source of ['combat_data.js', 'enemy_visual_data.js', 'combat_vfx_data.js', 'combat_vfx_skill_assets_v4.js', 'combat_vfx_pipeline_v2.js', 'assets/characters/roster/triad_character_roster.js']) {
  vm.runInNewContext(fs.readFileSync(path.join(root, source), 'utf8'), { window }, { filename: source });
}
const vfx = window.TRIAD_COMBAT_VFX;
const monsters = window.TRIAD_COMBAT_DATA.MONSTERS;
const roster = window.TRIAD_CHARACTER_ROSTER.records;
const html = fs.readFileSync(path.join(root, 'TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html'), 'utf8');
const cardBlock = html.match(/const CARD_PATTERNS=\[([\s\S]*?)function coreBy\(/)?.[1] || '';
const cardKeys = [...new Set([...cardBlock.matchAll(/key:'([^']+)'/g)].map(([, key]) => key))];
const eventSignature = event => [event.pipeline, (event.launchAsset || event.asset)?.path, event.travelProfile, event.impactAsset?.path, event.impactProfile, event.particleProfile, event.uniqueSequenceId].join('|');

function enemyActor(monster) {
  const archetype = window.TRIAD_COMBAT_DATA.ARCHETYPES[monster.catalogNo - 1].key;
  return { data: { ...monster, archetypeKey: archetype } };
}

test('all 90 monster actors and all 180 immutable skill records resolve usable VFX', () => {
  assert.equal(monsters.length, 90);
  const entries = monsters.flatMap(monster => monster.skills.map(skill => ({ monster, skill, event: vfx.enemy(enemyActor(monster), skill.id) })));
  assert.equal(entries.length, 180);
  for (const { monster, skill, event } of entries) {
    assert.ok(event, `${monster.id}/${skill.id} did not resolve`);
    assert.equal(event.skillId, skill.id, `${monster.id}/${skill.id} did not retain its skill ID`);
    assert.ok(event.asset?.path, `${monster.id}/${skill.id} lacks a primary authored asset`);
    assert.ok(event.impactAsset?.path, `${monster.id}/${skill.id} lacks an authored impact asset`);
    assert.ok(event.impactProfile, `${monster.id}/${skill.id} lacks a rupture profile`);
    if (event.pipeline === 'PROJECTILE') {
      assert.equal(event.asset.motion, 'TRAVEL', `${monster.id}/${skill.id} projectile is not travel motion`);
      assert.ok(event.contactMs > 0 && event.contactMs < event.duration, `${monster.id}/${skill.id} has invalid contact timing`);
    }
  }
  for (const archetype of window.TRIAD_COMBAT_DATA.ARCHETYPES) {
    const sample = monsters.find(monster => monster.catalogNo === window.TRIAD_COMBAT_DATA.ARCHETYPES.indexOf(archetype) + 1);
    const signatures = new Set(sample.skills.map(skill => eventSignature(vfx.enemy(enemyActor(sample), skill.id))));
    assert.equal(signatures.size, 2, `${archetype.key} two skills still share one VFX presentation`);
  }
  assert.equal(new Set(entries.map(({ event }) => eventSignature(event))).size, 180);
});

test('all 12 selectable character records resolve every 21 card-skill presentation', () => {
  assert.equal(roster.length, 12);
  assert.equal(cardKeys.length, 21);
  for (const character of roster) {
    for (const [index, key] of cardKeys.entries()) {
      const event = vfx.card({ id: `${character.coreId}_${String(index + 1).padStart(2, '0')}`, pattern: { key }, owner: character.coreId, characterId: character.id });
      assert.ok(event?.asset?.path, `${character.id}/${key} lacks an authored primary asset`);
      if (event.target === 'enemy') assert.ok(event.impactAsset?.path, `${character.id}/${key} lacks an authored impact asset`);
    }
  }
});
