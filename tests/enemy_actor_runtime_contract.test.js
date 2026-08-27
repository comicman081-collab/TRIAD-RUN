/* Locks the canonical 90-enemy frame-actor runtime contract. */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const sandbox = { window: {} };

vm.runInNewContext(read("combat_data.js"), sandbox, { filename: "combat_data.js" });
vm.runInNewContext(read("enemy_animation_data.js"), sandbox, { filename: "enemy_animation_data.js" });
vm.runInNewContext(read("enemy_visual_data.js"), sandbox, { filename: "enemy_visual_data.js" });

const combat = sandbox.window.TRIAD_COMBAT_DATA;
const animations = sandbox.window.TRIAD_ENEMY_ANIMATION_DATA;
const visuals = sandbox.window.TRIAD_COMBAT_VISUAL_DATA;
const html = read("TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html");

assert.equal(combat.MONSTERS.length, 90, "canonical monster count drifted");
assert.equal(combat.MONSTERS.filter(row => row.rank === "normal").length, 54);
assert.equal(combat.MONSTERS.filter(row => row.rank === "elite").length, 18);
assert.equal(combat.MONSTERS.filter(row => row.rank === "boss").length, 18);
assert.equal(animations.records.length, 90, "animation registry must cover all monsters");
assert.equal(new Set(animations.records.map(row => row.id)).size, 90, "duplicate animation ID");
assert.equal(new Set(animations.records.map(row => row.preview)).size, 90, "preview fallback/duplication detected");
assert.equal(new Set(animations.records.map(row => row.atlas)).size, 90, "atlas fallback/duplication detected");

const authoringPreviewRootAvailable = fs.existsSync(path.join(root, "assets/enemies/monsters_rgba_p1"));
for (const monster of combat.MONSTERS) {
  const animation = animations.byId[monster.id];
  const resolved = visuals.resolveEnemy(monster);
  assert.ok(animation, `missing animation record: ${monster.id}`);
  assert.equal(animation.status, "PASS_ACTIVE_FRAME_MVP", `unpromoted runtime asset: ${monster.id}`);
  assert.deepEqual(Object.keys(animation.clips), ["IDLE", "ATTACK", "HIT", "DEFEAT"]);
  assert.equal(animation.clips.DEFEAT.holdLastFrame, true);
  assert.equal(resolved.animation.id, monster.id, `visual resolver fallback: ${monster.id}`);
  // Authoring previews are intentionally gitignored; active production uses
  // the committed atlas. Validate previews as an additional local QA gate
  // whenever the authoring archive is present.
  if (authoringPreviewRootAvailable) assert.ok(fs.existsSync(path.join(root, animation.preview)), `missing preview: ${monster.id}`);
  assert.ok(fs.existsSync(path.join(root, animation.atlas)), `missing atlas: ${monster.id}`);
}

for (const required of [
  '<script src="enemy_animation_data.js?v=',
  '<script src="enemy_visual_data.js?v=',
  "class EnemyBattleActor{",
  "requestAnimationFrame(time=>this.tick(time))",
  "data-enemy-animation=",
  'data-faction="ENEMY"',
  'data-battle-lane="RIGHT"',
  'data-facing="LEFT"',
  "mountEnemyBattleActor(enemyVisual.animation)",
  "enemyActionPresentationState(",
  "setEnemyVisualState(defeated&&index===hitResults.length-1?'DEFEAT':'HIT')",
  "setEnemyVisualState('DEFEAT')",
]) assert.ok(html.includes(required), `runtime binding missing: ${required}`);

assert.ok(html.includes("const enemyQaStates=enemyVisual.animation.clips?.SKILL?"), "candidate QA state controls missing");
assert.ok(html.includes("let enemyVisualQueueToken=0;"), "enemy visual queue fence missing");
assert.ok(html.includes("stateGeneration"), "enemy visual generation fence missing");

assert.ok(!html.includes('card_art/regular/shade/ambush.webp'), "background-baked static enemy returned");
assert.ok(!/enemy-visual\[data-rank=[^\]]+\][^}]*[;{]\s*transform\s*:/s.test(html), "rank-specific runtime transform returned");
assert.match(html, /\.enemy-animation-canvas\{[^}]*transform:none(?:;|})/s);
assert.match(html, /\.enemy-animation-canvas\[data-direction-contract="PASS"\]\[data-facing="LEFT"\]\[data-runtime-mirror="true"\]\{transform:scaleX\(-1\)!important\}/);
assert.match(html, /\.enemy-animation-canvas\[data-direction-contract="PASS"\]\[data-direction-mode="FRONTAL_LEFT_BIAS"\]\{[^}]*transform:perspective\(720px\) translateX\(-16px\) rotateY\(-16deg\) rotate\(-1\.5deg\)!important\}/);
assert.ok(html.includes('validateDirection();this.load()'), 'enemy direction validation must run before atlas load');
assert.ok(html.includes("TRIAD_ENEMY_DIRECTION_CONTRACT_FAIL"), 'enemy direction contract must fail visibly');

// The current authoritative encounter contract has damage actions only. The
// second skill changes damage/hits/target, not the gameplay state family, so
// ATTACK remains the normal active-action mapping for this FRAME MVP. The
// query-gated SHADE_M01 GPU candidate may present that second skill as SKILL,
// but it is not active production content until the visual gate is accepted.
for (const monster of combat.MONSTERS) {
  for (let turn = 1; turn <= 6; turn += 1) {
    const intent = combat.buildIntent(monster, turn);
    assert.ok(intent.damage > 0);
    assert.ok(intent.hits >= 1);
    assert.ok(["single", "all"].includes(intent.target));
  }
}

console.log("[PASS] 90 enemy actors resolve uniquely; normal/elite/boss runtime hooks and FRAME MVP state boundary are locked");
