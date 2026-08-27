/* Verify the promoted SHADE_M01 V6 production bundle. */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..", "..");
const rel = value => path.join(root, value.replaceAll("/", path.sep));
const sha256 = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const manifestRel = "assets/enemies/production_pilot_v6/SHADE_M01/SHADE_M01_PRODUCTION_PILOT_V6_GPU_FINAL_MANIFEST.json";
const manifest = JSON.parse(fs.readFileSync(rel(manifestRel), "utf8"));
const atlasPath = rel(manifest.atlas);
const override = fs.readFileSync(path.join(root, "enemy_animation_production_overrides.js"), "utf8");
const html = fs.readFileSync(path.join(root, "TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html"), "utf8");

assert.equal(manifest.id, "SHADE_M01");
assert.equal(manifest.status, "PASS_ACTIVE_FINAL");
assert.equal(manifest.runtimeActive, true);
assert.deepEqual(manifest.runtimeTransform, { scale: 1, translate: [0, 0] });
assert.equal(manifest.rows, 6);
assert.equal(manifest.columns, 6);
assert.deepEqual(Object.keys(manifest.clips), ["IDLE", "ENTER", "ATTACK", "SKILL", "HIT", "DEFEAT"]);
assert.ok(fs.existsSync(atlasPath));
assert.equal(sha256(atlasPath), manifest.atlasSha256);
assert.ok(override.includes("productionRevision:'SHADE_M01_V6_GPU_FINAL'"));
assert.ok(override.includes("assets/enemies/production_pilot_v6/SHADE_M01/SHADE_M01_PRODUCTION_PILOT_V6_GPU_FINAL.webp"));
assert.ok(html.includes("enemy_animation_production_overrides.js?v=fifty-five-pilots-v4-final-v6qa"));

console.log(JSON.stringify({
  result: "PASS_ACTIVE_FINAL",
  actor: manifest.id,
  revision: "SHADE_M01_V6_GPU_FINAL",
  atlas: manifest.atlas,
  atlasSha256: manifest.atlasSha256,
  clips: Object.keys(manifest.clips),
  runtimeActive: manifest.runtimeActive,
}, null, 2));
