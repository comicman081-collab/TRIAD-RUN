"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..", "..");
const html = fs.readFileSync(path.join(root, "TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html"), "utf8");
const manifestSource = fs.readFileSync(path.join(root, "enemy_animation_data.js"), "utf8");
const classStart = html.indexOf("class EnemyBattleActor{");
const classEnd = html.indexOf("function setEnemyVisualState", classStart);
if (classStart < 0 || classEnd < 0) throw new Error("EnemyBattleActor source boundary missing");
const classSource = html.slice(classStart, classEnd).replace("let enemyBattleActor=null;", "");
const errors = [];
const draws = [];

class FakeImage {
  set src(value) { this._src = value; setImmediate(() => this.onload?.()); }
  get src() { return this._src; }
}

const wrapper = { dataset: {}, setAttribute(name, value) { this.dataset[name] = value; } };
const canvas = {
  width: 320,
  height: 420,
  dataset: {},
  getContext() { return { clearRect() {}, drawImage(...args) { draws.push(args); } }; },
  closest() { return wrapper; },
};
const sandbox = {
  window: {},
  Image: FakeImage,
  performance: { now: () => 1000 },
  requestAnimationFrame: () => 1,
  cancelAnimationFrame: () => {},
  console,
};
vm.createContext(sandbox);
vm.runInContext(manifestSource, sandbox, { filename: "enemy_animation_data.js" });
vm.runInContext(`${classSource};globalThis.EnemyBattleActor=EnemyBattleActor;`, sandbox, { filename: "EnemyBattleActor.js" });

async function main() {
  const manifest = sandbox.window.TRIAD_ENEMY_ANIMATION_DATA.records[0];
  const actor = new sandbox.EnemyBattleActor(canvas, manifest, "IDLE");
  await new Promise(resolve => setImmediate(resolve));
  if (canvas.dataset.loadStatus !== "PASS" || canvas.dataset.atlas !== manifest.atlas) errors.push("atlas load contract failed");

  const results = {};
  for (const state of ["IDLE", "ATTACK", "HIT", "DEFEAT"]) {
    const clip = manifest.clips[state];
    actor.play(state);
    actor.tick(actor.started + ((3.01 * 1000) / clip.fps));
    const draw = draws.at(-1);
    if (actor.frame !== 3 || draw?.[1] !== 3 * manifest.frameWidth || draw?.[2] !== clip.row * manifest.frameHeight) {
      errors.push(`${state}: frame source rectangle mismatch`);
    }
    actor.play(state);
    actor.tick(actor.started + (((clip.frames + 1) * 1000) / clip.fps));
    if (state === "IDLE" && actor.state !== "IDLE") errors.push("IDLE loop failed");
    if (["ATTACK", "HIT"].includes(state) && actor.state !== "IDLE") errors.push(`${state}: one-shot did not return to IDLE`);
    if (state === "DEFEAT" && (actor.state !== "DEFEAT" || actor.frame !== clip.frames - 1)) errors.push("DEFEAT hold-last-frame failed");
    results[state] = { row: clip.row, frames: clip.frames, fps: clip.fps };
  }
  actor.destroy();
  const report = {
    monsterId: manifest.id,
    atlasLoaded: canvas.dataset.loadStatus,
    states: results,
    stateHistory: canvas.dataset.stateHistory,
    drawCalls: draws.length,
    errors,
    pass: errors.length === 0,
  };
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) process.exitCode = 1;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
