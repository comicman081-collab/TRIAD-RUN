"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..", "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const sha256 = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const errors = [];

const conceptReport = JSON.parse(read("audit/monster_animation_mvp/monster_concept_generation.json"));
const alphaReport = JSON.parse(read("audit/monster_animation_mvp/monster_alpha_report.json"));
const animationReport = JSON.parse(read("audit/monster_animation_mvp/monster_animation_report.json"));
const promotion = JSON.parse(read("audit/monster_animation_mvp/monster_animation_promotion.json"));
const manifest = JSON.parse(read("assets/enemies/monster_animation_p1/monster_animation_manifest.json"));

const sandbox = { window: {} };
vm.runInNewContext(read("combat_data.js"), sandbox, { filename: "combat_data.js" });
vm.runInNewContext(read("enemy_animation_data.js"), sandbox, { filename: "enemy_animation_data.js" });
vm.runInNewContext(read("enemy_visual_data.js"), sandbox, { filename: "enemy_visual_data.js" });
const combatData = sandbox.window.TRIAD_COMBAT_DATA;
const animationData = sandbox.window.TRIAD_ENEMY_ANIMATION_DATA;
const visualData = sandbox.window.TRIAD_COMBAT_VISUAL_DATA;

const expectedIds = combatData.MONSTERS.map(monster => monster.id).sort();
const conceptIds = conceptReport.rows.map(row => row.id).sort();
const alphaIds = alphaReport.rows.map(row => row.id).sort();
const reportIds = animationReport.rows.map(row => row.id).sort();
const manifestIds = manifest.records.map(row => row.id).sort();
const runtimeIds = animationData.records.map(row => row.id).sort();
for (const [label, ids] of Object.entries({ conceptIds, alphaIds, reportIds, manifestIds, runtimeIds })) {
  if (JSON.stringify(ids) !== JSON.stringify(expectedIds)) errors.push(`${label} does not cover canonical 90 monsters`);
}

if (promotion.status !== "PASS_ACTIVE_FRAME_MVP" || promotion.monsterCount !== 90 || promotion.totalFrames !== 2160) errors.push("promotion summary mismatch");
if (promotion.uniqueMonsterImages !== 90 || promotion.uniqueMonsterAtlases !== 90 || promotion.visualContactReviewed !== true) errors.push("unique visual promotion gate mismatch");
if (manifest.version !== "1.0.0-active-frame-mvp" || animationData.version !== manifest.version) errors.push("active manifest version mismatch");
if (new Set(manifest.records.map(row => row.preview)).size !== 90) errors.push("preview paths are not 90 unique files");
if (new Set(manifest.records.map(row => row.atlas)).size !== 90) errors.push("atlas paths are not 90 unique files");

const reportById = Object.fromEntries(animationReport.rows.map(row => [row.id, row]));
const promotedById = Object.fromEntries(promotion.runtimeFiles.map(row => [row.id, row]));
for (const record of manifest.records) {
  const report = reportById[record.id];
  const promoted = promotedById[record.id];
  const preview = path.join(root, record.preview);
  const atlas = path.join(root, record.atlas);
  if (record.status !== "PASS_ACTIVE_FRAME_MVP") errors.push(`runtime status is not promoted: ${record.id}`);
  if (!fs.existsSync(preview) || !fs.existsSync(atlas)) { errors.push(`runtime file missing: ${record.id}`); continue; }
  const previewBytes = fs.readFileSync(preview);
  const atlasBytes = fs.readFileSync(atlas);
  if (previewBytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") errors.push(`preview is not PNG: ${record.id}`);
  if (previewBytes.readUInt32BE(16) !== 768 || previewBytes.readUInt32BE(20) !== 1024 || previewBytes[25] !== 6) errors.push(`preview is not canonical RGBA: ${record.id}`);
  if (atlasBytes.subarray(0, 4).toString("ascii") !== "RIFF" || atlasBytes.subarray(8, 12).toString("ascii") !== "WEBP") errors.push(`atlas is not WebP: ${record.id}`);
  if (!report || report.frameCount !== 24 || report.framesPerState !== 6 || report.uniqueFrameHashes < 20) errors.push(`frame report mismatch: ${record.id}`);
  if (!report || report.previewSha256 !== sha256(preview) || report.atlasSha256 !== sha256(atlas)) errors.push(`animation provenance hash mismatch: ${record.id}`);
  if (!promoted || promoted.sha256 !== sha256(atlas) || promoted.atlas !== record.atlas) errors.push(`promotion hash mismatch: ${record.id}`);
  if (record.frameWidth !== 320 || record.frameHeight !== 420 || record.columns !== 6 || record.rows !== 4) errors.push(`atlas geometry mismatch: ${record.id}`);
  if (JSON.stringify(Object.keys(record.clips)) !== JSON.stringify(["IDLE", "ATTACK", "HIT", "DEFEAT"])) errors.push(`clip state mismatch: ${record.id}`);
}

for (const monster of combatData.MONSTERS) {
  const resolved = visualData.resolveEnemy(monster);
  if (resolved.animation?.id !== monster.id || animationData.byId[monster.id] !== resolved.animation) errors.push(`runtime monster animation mismatch: ${monster.id}`);
}

const html = read("TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html");
for (const token of [
  '<script src="enemy_animation_data.js?v=',
  "class EnemyBattleActor{",
  "data-enemy-animation=",
  "mountEnemyBattleActor(enemyVisual.animation)",
  "enemyBattleActor?.play(state)",
]) if (!html.includes(token)) errors.push(`runtime frame player binding missing: ${token}`);
if (html.includes('<img src="${esc(enemyVisual.archetype.path)}"')) errors.push("shared archetype image is still the runtime renderer");
if (/\.enemy-animation-canvas[^}]*animation\s*:/.test(html)) errors.push("enemy canvas fell back to CSS-only animation");

const result = {
  monsters: expectedIds.length,
  uniquePreviewAssets: new Set(manifest.records.map(row => row.preview)).size,
  uniqueAnimationAtlases: new Set(manifest.records.map(row => row.atlas)).size,
  statesPerMonster: 4,
  framesPerMonster: 24,
  totalFrames: expectedIds.length * 24,
  runtimeResolutions: combatData.MONSTERS.length,
  errors,
  pass: errors.length === 0,
};
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
