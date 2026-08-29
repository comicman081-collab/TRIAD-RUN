/* Locks all 90 runtime enemies to the right lane with per-source player-facing correction. */
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const window = { location: { search: '' } };
const sandbox = vm.createContext({ window, URLSearchParams, console });

for (const file of [
  'combat_data.js',
  'enemy_animation_data.js',
  'enemy_animation_production_overrides.js',
  'enemy_animation_authority.js',
  'enemy_visual_data.js',
]) vm.runInContext(read(file), sandbox, { filename: file });

const combat = window.TRIAD_COMBAT_DATA;
const authority = window.TRIAD_ENEMY_ANIMATION_AUTHORITY;
const visuals = window.TRIAD_COMBAT_VISUAL_DATA;
const expectedBase = {
  faction: 'ENEMY',
  battleLane: 'RIGHT',
  facing: 'LEFT',
  targetPolicy: 'PLAYER_LANE',
};

assert.equal(combat.MONSTERS.length, 90);
assert.deepEqual({ ...authority.DIRECTION_CONTRACT }, expectedBase);
const counts = { mirrored: 0, sourceLeft: 0, frontalBias: 0 };
for (const monster of combat.MONSTERS) {
  const animation = authority.resolve(monster.id);
  const visual = visuals.resolveEnemy(monster);
  const expected = authority.directionFor(monster.id);
  assert.ok(animation, `authority resolution missing: ${monster.id}`);
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(animation[key], value, `${monster.id} direction mismatch: ${key}`);
    assert.equal(visual.animation[key], value, `${monster.id} visual direction mismatch: ${key}`);
  }
  if (expected.directionMode === 'MIRROR_TO_PLAYER') counts.mirrored += 1;
  if (expected.directionMode === 'SOURCE_LEFT') counts.sourceLeft += 1;
  if (expected.directionMode === 'FRONTAL_LEFT_BIAS') counts.frontalBias += 1;
}
assert.deepEqual(counts, { mirrored: 6, sourceLeft: 6, frontalBias: 78 });
assert.equal(authority.resolve('RIFT_M01').runtimeMirror, false, 'frontal scout must retain its left-biased source composition');
assert.equal(authority.resolve('RIFT_M02').runtimeMirror, true, 'right-facing hound must be mirrored toward the party');
assert.equal(authority.resolve('RIFT_M05').runtimeMirror, false, 'left-facing hunter must not be flipped away from the party');

const html = read('TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html');
assert.ok(html.includes('enemy_animation_authority.js?v=1.2.0-per-actor-player-facing'));
assert.match(html, /data-direction-contract="PASS"\]\[data-facing="LEFT"\]\[data-runtime-mirror="true"\][^{]*\{transform:scaleX\(-1\)!important\}/);
assert.match(html, /data-direction-mode="FRONTAL_LEFT_BIAS"\][^{]*\{[^}]*transform:perspective\(720px\) translateX\(-16px\) rotateY\(-16deg\) rotate\(-1\.5deg\)!important\}/);

const reviewRenderer = read('tools/qa/render_random_unique_vfx_samples.py');
assert.match(reviewRenderer, /def enemy_runtime_mirror\(monster_id: str\) -> bool:/);
assert.match(reviewRenderer, /mirror=enemy_runtime_mirror\(entry\["monsterId"\]\)/);
assert.ok(!reviewRenderer.includes('entry["monsterId"]), 390, 247, 115, 175, mirror=True'), 'review GIF must not blindly flip every enemy source');

console.log('[PASS] all 90 enemy actors preserve source-aware left targeting toward the player lane');
