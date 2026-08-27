/* Verify the promoted RIFT_M07 V7 GPU final asset. */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..", "..");
const manifestPath = path.join(
  root,
  "assets",
  "enemies",
  "production_pilot_v7",
  "RIFT_M07",
  "RIFT_M07_PRODUCTION_PILOT_V7_GPU_FINAL_MANIFEST.json",
);

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const resolve = (relative) => path.join(root, relative.replaceAll("/", path.sep));
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

assert.equal(manifest.schema, "triad.enemy-production-pilot.v7");
assert.equal(manifest.id, "RIFT_M07");
assert.equal(manifest.status, "PASS_ACTIVE_FINAL");
assert.equal(manifest.runtimeActive, true);
assert.deepEqual(manifest.runtimeTransform, { scale: 1, translate: [0, 0] });
assert.equal(manifest.battleLane, "RIGHT");
assert.equal(manifest.facing, "LEFT");
assert.equal(manifest.frameWidth, 420);
assert.equal(manifest.frameHeight, 420);
assert.equal(manifest.columns, 6);
assert.equal(manifest.rows, 6);

const clipNames = ["IDLE", "ENTER", "ATTACK", "SKILL", "HIT", "DEFEAT"];
assert.deepEqual(Object.keys(manifest.clips), clipNames);
for (const [name, clip] of Object.entries(manifest.clips)) {
  assert.equal(clip.frames, 6, `${name} frame count drifted`);
  assert.equal(clip.row, clipNames.indexOf(name), `${name} row drifted`);
}

const atlasPath = resolve(manifest.atlas);
assert.ok(fs.existsSync(atlasPath), "final atlas missing");
assert.equal(sha256(atlasPath), manifest.atlasSha256, "final atlas hash mismatch");
assert.ok(fs.existsSync(resolve(manifest.qaContact)), "final QA contact missing");
assert.ok(fs.existsSync(resolve(manifest.blendSource)), "final Blender source missing");
assert.equal(manifest.promotionEvidence?.externalVisualGate, "GPT_WEB_VISUAL_PASS");
assert.equal(manifest.promotionEvidence?.inAppGate, "QA_QUERY_RUNTIME_PASS");

const override = fs.readFileSync(path.join(root, "enemy_animation_production_overrides.js"), "utf8");
assert.ok(override.includes("productionRevision:'RIFT_M07_V7_GPU_FINAL'"));
assert.ok(
  override.includes(
    "assets/enemies/production_pilot_v7/RIFT_M07/RIFT_M07_PRODUCTION_PILOT_V7_GPU_FINAL.webp",
  ),
);

console.log(
  JSON.stringify(
    {
      result: "PASS_ACTIVE_FINAL",
      actor: "RIFT_M07",
      revision: "V7_GPU_FINAL",
      clips: clipNames,
      frames: manifest.framePlan.length,
      atlas: manifest.atlas,
      atlasSha256: manifest.atlasSha256,
      direction: `${manifest.battleLane}/${manifest.facing}`,
      runtimeActive: manifest.runtimeActive,
      externalVisualGate: manifest.promotionEvidence.externalVisualGate,
      inAppGate: manifest.promotionEvidence.inAppGate,
    },
    null,
    2,
  ),
);
