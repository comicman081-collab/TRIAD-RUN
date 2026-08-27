/* Verify a GPU candidate after the GPT visual-QA correction pass. */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..", "..");
const actor = (process.argv[2] || "SHADE_M01").toUpperCase();
const revision = (process.argv[3] || "V6").toUpperCase();
const revisionDir = revision.toLowerCase();
const base = path.join(root, "assets", "enemies", `production_pilot_${revisionDir}_candidate`, actor);
const manifestPath = path.join(base, `${actor}_PRODUCTION_PILOT_${revision}_GPU_CANDIDATE_MANIFEST.json`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const resolve = relative => path.join(root, relative.replaceAll("/", path.sep));
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

assert.equal(manifest.schema, `triad.enemy-production-pilot.${revisionDir}`);
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
assert.ok(manifest.framePlan.some(frame => frame.clip === "SKILL" && frame.registrationRotation !== 0), "SKILL correction missing");
assert.ok(manifest.framePlan.some(frame => frame.clip === "HIT" && frame.registrationZoom > 1), "HIT impact correction missing");
assert.ok(manifest.framePlan.some(frame => frame.clip === "DEFEAT" && frame.registrationRotation !== 0), "DEFEAT transition correction missing");
assert.ok(fs.existsSync(resolve(manifest.atlas)), "candidate atlas missing");
assert.equal(hash(resolve(manifest.atlas)), manifest.atlasSha256, "candidate atlas hash mismatch");
assert.ok(fs.existsSync(resolve(manifest.sourceKeyposeManifest)), "source keypose manifest missing");
assert.ok(fs.existsSync(resolve(manifest.sourceProductionManifest)), "source production manifest missing");
assert.equal(manifest.gpuPipeline, "BLENDER_EEVEE_NEXT_GPU");
assert.ok(fs.existsSync(resolve(manifest.blendSource)), "Blender GPU registration scene missing");
assert.ok(fs.existsSync(resolve(manifest.qaContact)), "candidate visual contact sheet missing");

const override = fs.readFileSync(path.join(root, "enemy_animation_production_overrides.js"), "utf8");
if (actor === "SHADE_M01") {
  assert.ok(override.includes("candidateQuery==='v5-shade-m01'"), "V5 QA override changed unexpectedly");
  assert.ok(override.includes("candidateQuery==='v6-shade-m01'"), "V6 QA override missing");
  assert.ok(override.includes("SHADE_M01_V6_GPU_CANDIDATE"), "SHADE V6 production revision missing from QA override");
}
if (actor === "RIFT_M10") {
  assert.ok(override.includes("candidateQuery==='v6-rift-m10'"), "RIFT M10 V6 QA override missing");
  assert.ok(override.includes("RIFT_M10_V6_GPU_CANDIDATE"), "RIFT M10 V6 production revision missing from QA override");
  if (revision === "V7") {
    assert.ok(override.includes("candidateQuery==='v7-rift-m10'"), "RIFT M10 V7 QA override missing");
    assert.ok(override.includes("RIFT_M10_V7_GPU_CANDIDATE"), "RIFT M10 V7 production revision missing from QA override");
  }
}
if (actor === "RIFT_M11") {
  assert.ok(override.includes("candidateQuery==='v6-rift-m11'"), "RIFT M11 V6 QA override missing");
  assert.ok(override.includes("RIFT_M11_V6_GPU_CANDIDATE"), "RIFT M11 V6 production revision missing from QA override");
  if (revision === "V7") {
    assert.ok(override.includes("candidateQuery==='v7-rift-m11'"), "RIFT M11 V7 QA override missing");
    assert.ok(override.includes("RIFT_M11_V7_GPU_CANDIDATE"), "RIFT M11 V7 production revision missing from QA override");
  }
}
if (actor === "RIFT_M12") {
  if (revision === "V7") {
    assert.ok(override.includes("candidateQuery==='v7-rift-m12'"), "RIFT M12 V7 QA override missing");
    assert.ok(override.includes("RIFT_M12_V7_GPU_CANDIDATE"), "RIFT M12 V7 production revision missing from QA override");
  }
}
if (actor === "RIFT_M13") {
  if (revision === "V7") {
    assert.ok(override.includes("candidateQuery==='v7-rift-m13'"), "RIFT M13 V7 QA override missing");
    assert.ok(override.includes("RIFT_M13_V7_GPU_CANDIDATE"), "RIFT M13 V7 production revision missing from QA override");
  }
}
if (actor === "RIFT_M14") {
  if (revision === "V7") {
    assert.ok(override.includes("candidateQuery==='v7-rift-m14'"), "RIFT M14 V7 QA override missing");
    assert.ok(override.includes("RIFT_M14_V7_GPU_CANDIDATE"), "RIFT M14 V7 production revision missing from QA override");
  }
}
if (actor === "RIFT_M07") {
  if (revision === "V6") {
    assert.ok(override.includes("candidateQuery==='v6-rift-m07'"), "RIFT M07 V6 QA override missing");
    assert.ok(override.includes("RIFT_M07_V6_GPU_CANDIDATE"), "RIFT M07 V6 production revision missing from QA override");
  }
  if (revision === "V7") {
    assert.ok(override.includes("candidateQuery==='v7-rift-m07'"), "RIFT M07 V7 QA override missing");
    assert.ok(override.includes("RIFT_M07_V7_GPU_CANDIDATE"), "RIFT M07 V7 production revision missing from QA override");
  }
}
if (actor === "RIFT_M08") {
  if (revision === "V6") {
    assert.ok(override.includes("candidateQuery==='v6-rift-m08'"), "RIFT M08 V6 QA override missing");
    assert.ok(override.includes("RIFT_M08_V6_GPU_CANDIDATE"), "RIFT M08 V6 production revision missing from QA override");
  }
  if (revision === "V7") {
    assert.ok(override.includes("candidateQuery==='v7-rift-m08'"), "RIFT M08 V7 QA override missing");
    assert.ok(override.includes("RIFT_M08_V7_GPU_CANDIDATE"), "RIFT M08 V7 production revision missing from QA override");
  }
  if (revision === "V8") {
    assert.ok(override.includes("candidateQuery==='v8-rift-m08'"), "RIFT M08 V8 QA override missing");
    assert.ok(override.includes("RIFT_M08_V8_GPU_CANDIDATE"), "RIFT M08 V8 production revision missing from QA override");
  }
}
if (actor === "RIFT_M09" && revision === "V6") {
  assert.ok(override.includes("candidateQuery==='v6-rift-m09'"), "RIFT M09 V6 QA override missing");
  assert.ok(override.includes("RIFT_M09_V6_GPU_CANDIDATE"), "RIFT M09 V6 production revision missing from QA override");
}
if (actor === "RIFT_M09" && revision === "V7") {
  assert.ok(override.includes("candidateQuery==='v7-rift-m09'"), "RIFT M09 V7 QA override missing");
  assert.ok(override.includes("RIFT_M09_V7_GPU_CANDIDATE"), "RIFT M09 V7 production revision missing from QA override");
}
if (actor === "RIFT_M15") {
  if (revision === "V7") {
    assert.ok(override.includes("candidateQuery==='v7-rift-m15'"), "RIFT M15 V7 QA override missing");
    assert.ok(override.includes("RIFT_M15_V7_GPU_CANDIDATE"), "RIFT M15 V7 production revision missing from QA override");
  }
}
assert.ok(override.includes("runtimeActive:false"), "candidate must not be active by default");

console.log(JSON.stringify({
  result: "PASS_CANDIDATE_INTEGRITY",
  actor,
  revision,
  clips: Object.keys(manifest.clips),
  frames: manifest.framePlan.length,
  atlas: manifest.atlas,
  atlasSha256: manifest.atlasSha256,
  gpuPipeline: manifest.gpuPipeline,
  runtimeActive: manifest.runtimeActive,
  visualGate: "PENDING_EXTERNAL_GPT_AND_IN_APP_VISUAL_GATES",
}, null, 2));
