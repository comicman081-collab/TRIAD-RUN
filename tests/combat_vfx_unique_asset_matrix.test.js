'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const window = {};
window.window = window;
for (const source of ['combat_data.js', 'enemy_visual_data.js', 'combat_vfx_data.js', 'combat_vfx_skill_assets_v5.js', 'combat_vfx_pipeline_v2.js', 'assets/characters/roster/triad_character_roster.js']) {
  vm.runInNewContext(read(source), { window }, { filename: source });
}
const manifest = window.TRIAD_COMBAT_VFX_SKILL_ASSETS_V5;
const vfx = window.TRIAD_COMBAT_VFX;
const data = window.TRIAD_COMBAT_DATA;
const html = read('TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html');
const cardBlock = html.match(/const CARD_PATTERNS=\[([\s\S]*?)function coreBy\(/)?.[1] || '';
const cardKeys = [...new Set([...cardBlock.matchAll(/key:'([^']+)'/g)].map(([, key]) => key))];
const coreIds = [...new Set(window.TRIAD_CHARACTER_ROSTER.records.map(record => record.coreId))];
const fileSha = relative => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex').toUpperCase();

test('all 306 immutable skills retain two separate transparent derivative files with V5 enemy grammar', () => {
  assert.equal(Object.keys(manifest.cards).length, 126);
  assert.equal(Object.keys(manifest.enemies).length, 180);
  const entries = [...Object.values(manifest.cards), ...Object.values(manifest.enemies)];
  const paths = entries.flatMap(entry => [entry.launch, entry.impact]);
  const hashes = entries.flatMap(entry => [entry.launchSha256, entry.impactSha256]);
  assert.equal(paths.length, 612);
  assert.equal(new Set(paths).size, 612);
  assert.equal(new Set(hashes).size, 612);
  assert.ok(Object.values(manifest.cards).every(entry => entry.launch.includes('/derived_v4/') && entry.impact.includes('/derived_v4/')));
  assert.ok(Object.values(manifest.enemies).every(entry => entry.launch.includes('/derived_v5/') && entry.impact.includes('/derived_v5/')));
  for (const entry of entries) {
    assert.equal(fileSha(entry.launch), entry.launchSha256, entry.id);
    assert.equal(fileSha(entry.impact), entry.impactSha256, entry.id);
    assert.match(entry.launch, /^assets\/vfx\/derived_v[45]\//);
    assert.match(entry.impact, /^assets\/vfx\/derived_v[45]\//);
  }
  assert.equal(new Set(entries.map(entry => JSON.stringify([entry.motion, entry.rupture]))).size, 306);
  assert.equal(new Set(entries.map(entry => entry.sequence.id)).size, 306);
  assert.equal(new Set(entries.flatMap(entry => ['charge', 'travel', 'contact', 'rupture', 'decay'].map(phase => entry.sequence[phase].phaseKey))).size, 1530);
  assert.equal(new Set(entries.flatMap(entry => [entry.visualIdentity.launch.recipeId, entry.visualIdentity.impact.recipeId])).size, 612);
  const enemies = Object.values(manifest.enemies);
  assert.ok(enemies.every(entry => /^#([0-9a-f]{6})$/i.test(entry.visualIdentity.runtimeColor) && /^#([0-9a-f]{6})$/i.test(entry.visualIdentity.runtimeAccent)));
  assert.ok(new Set(enemies.map(entry => entry.visualIdentity.paletteName)).size >= 32, 'enemy V5 must not collapse to element-only palettes');
  assert.ok(new Set(enemies.map(entry => entry.rupture.vector)).size >= 18, 'enemy V5 must use materially different rupture vectors');
});

test('all 126 card IDs and 180 monster skill IDs resolve their one-to-one assets at runtime', () => {
  const cardEvents = coreIds.flatMap(coreId => cardKeys.map((key, index) => {
    const id = `${coreId}_${String(index + 1).padStart(2, '0')}`;
    return vfx.card({ id, owner: coreId, pattern: { key } });
  }));
  const enemyEvents = data.MONSTERS.flatMap(monster => {
    const archetypeKey = data.ARCHETYPES[monster.catalogNo - 1].key;
    const actor = { data: { ...monster, archetypeKey } };
    return monster.skills.map(skill => vfx.enemy(actor, skill.id));
  });
  const events = [...cardEvents, ...enemyEvents];
  assert.equal(events.length, 306);
  assert.equal(new Set(events.map(event => event.uniqueAssetId)).size, 306);
  assert.equal(new Set(events.flatMap(event => [event.uniqueAssetPaths.launch, event.uniqueAssetPaths.impact])).size, 612);
  for (const event of events) {
    assert.ok(event.motionVariant);
    assert.ok(event.ruptureVariant);
    assert.ok(event.sequenceVariant);
    assert.equal(event.uniqueSequenceId, event.sequenceVariant.id);
    assert.equal(event.impactProfile, event.uniqueAssetId);
    if (event.pipeline === 'PROJECTILE') {
      assert.equal(event.asset.path, event.uniqueAssetPaths.launch);
      assert.equal(event.impactAsset.path, event.uniqueAssetPaths.impact);
    } else if (event.pipeline === 'ULTIMATE' && event.launchAsset) {
      assert.equal(event.launchAsset.path, event.uniqueAssetPaths.launch);
      assert.equal(event.impactAsset.path, event.uniqueAssetPaths.impact);
    } else if (event.pipeline === 'HEAVY_IMPACT') {
      assert.equal(event.asset.path, event.uniqueAssetPaths.impact);
    }
  }
  assert.match(html, /combat_vfx_skill_assets_v5\.js\?v=5\.0\.0-enemy-spectrum-grammar/);
  assert.match(html, /data-unique-asset/);
  assert.match(html, /dataset\.sequenceId/);
  assert.match(html, /triadCombatVfxSkillTravel/);
});
