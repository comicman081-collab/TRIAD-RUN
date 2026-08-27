/* Verify the isolated GPU v5 enemy candidate before runtime promotion. */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..", "..");
const actor = "SHADE_M01";
const base = path.join(root, "assets", "enemies", "production_pilot_v5_candidate", actor);
const manifestPath = path.join(base, `${actor}_PRODUCTION_PILOT_V5_GPU_CANDIDATE_MANIFEST.json`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const resolve = relative => path.join(root, relative.replaceAll("/", path.sep));
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

assert.equal(manifest.schema, "triad.enemy-production-pilot.v5");
assert.equal(manifest.id, actor);
assert.equal(manifest.status, "PASS_ACTIVE_CANDIDATE");
assert.equal(manifest.runtimeActive, false);
assert.deepEqual(manifest.runtimeTransform, { scale: 1, translate: [0, 0] });
assert.equal(manifest.frameWidth, 420);
assert.equal(manifest.frameHeight, 420);
assert.equal(manifest.columns, 6);
assert.equal(manifest.rows, 6);
assert.deepEqual(Object.keys(manifest.clips), ["IDLE", "ENTER", "ATTACK", "SKILL", "HIT", "DEFEAT"]);
for (const [name, clip] of Object.entries(manifest.clips)) {
  assert.equal(clip.frames, 6, `${name} frame count drifted`);
  assert.equal(clip.row, Object.keys(manifest.clips).indexOf(name), `${name} row drifted`);
}
assert.equal(manifest.framePlan.length, 36);
assert.ok(fs.existsSync(resolve(manifest.atlas)), "candidate atlas missing");
assert.equal(hash(resolve(manifest.atlas)), manifest.atlasSha256, "candidate atlas hash mismatch");
assert.ok(fs.existsSync(resolve(manifest.sourceKeyposeManifest)), "source keypose manifest missing");
assert.ok(fs.existsSync(resolve(manifest.sourceProductionManifest)), "source production manifest missing");
assert.equal(manifest.gpuPipeline, "BLENDER_EEVEE_NEXT_GPU");
assert.ok(fs.existsSync(resolve(manifest.blendSource)), "Blender GPU registration scene missing");
assert.ok(fs.existsSync(resolve(manifest.qaContact)), "candidate visual contact sheet missing");

const override = fs.readFileSync(path.join(root, "enemy_animation_production_overrides.js"), "utf8");
assert.ok(override.includes("candidateQuery==='v5-shade-m01'"), "candidate must remain query-gated");
assert.ok(override.includes("runtimeActive:false"), "candidate must not be active by default");

console.log(JSON.stringify({
  result: "PASS_CANDIDATE_INTEGRITY",
  actor,
  clips: Object.keys(manifest.clips),
  frames: manifest.framePlan.length,
  atlas: manifest.atlas,
  atlasSha256: manifest.atlasSha256,
  gpuPipeline: manifest.gpuPipeline,
  runtimeActive: manifest.runtimeActive,
  visualGate: "CONTACT_SHEET_REVIEW_REQUIRED",
}, null, 2));
