/* Locks enemy action playback so a living monster never casts from HIT/DEFEAT. */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const html = read("TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html");
const classStart = html.indexOf("class EnemyBattleActor{");
const classEnd = html.indexOf("function setEnemyVisualState", classStart);
assert.ok(classStart >= 0 && classEnd >= 0, "EnemyBattleActor source boundary missing");
const classSource = html.slice(classStart, classEnd).replace("let enemyBattleActor=null;", "");

const draws = [];
class FakeImage {
  set src(value) { this._src = value; setImmediate(() => this.onload?.()); }
  get src() { return this._src; }
}

const canvas = {
  width: 420,
  height: 420,
  dataset: {},
  getContext() { return { clearRect() {}, drawImage(...args) { draws.push(args); } }; },
  closest() { return { dataset: {}, setAttribute() {} }; },
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
for (const source of [
  "combat_data.js",
  "enemy_animation_data.js",
  "enemy_animation_production_overrides.js",
  "enemy_animation_authority.js",
  "enemy_visual_data.js",
]) vm.runInContext(read(source), sandbox, { filename: source });
vm.runInContext(`${classSource};globalThis.EnemyBattleActor=EnemyBattleActor;`, sandbox, { filename: "EnemyBattleActor.js" });

async function loadActor(manifest) {
  canvas.dataset = {};
  const actor = new sandbox.EnemyBattleActor(canvas, manifest, "IDLE");
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(canvas.dataset.loadStatus, "PASS", `${manifest.id}: atlas load contract`);
  return actor;
}

async function main() {
  const combat = sandbox.window.TRIAD_COMBAT_DATA;
  const authority = sandbox.window.TRIAD_ENEMY_ANIMATION_AUTHORITY;
  const resolved = combat.MONSTERS.map(monster => ({ monster, manifest: authority.resolve(monster.id) }));
  assert.equal(resolved.length, 90, "canonical monster count drifted");
  assert.ok(resolved.every(row => row.manifest), "an active monster lacks an animation authority record");

  let skillVariants = 0;
  for (const { monster, manifest } of resolved) {
    const attack = manifest.clips.ATTACK;
    const hit = manifest.clips.HIT;
    const defeat = manifest.clips.DEFEAT;
    const actionName = manifest.clips.SKILL ? "SKILL" : "ATTACK";
    const action = manifest.clips[actionName];
    if (actionName === "SKILL") skillVariants += 1;

    assert.ok(action && action.frames > 0 && action.fps > 0, `${monster.id}: action clip missing`);
    assert.equal(Boolean(action.loop), false, `${monster.id}: action clip must be a one-shot`);
    assert.notEqual(action.row, hit.row, `${monster.id}: action cannot sample HIT row`);
    assert.notEqual(action.row, defeat.row, `${monster.id}: action cannot sample DEFEAT row`);
    assert.equal(Boolean(defeat.holdLastFrame), true, `${monster.id}: defeat must remain terminal`);
    assert.ok(attack && attack.row !== defeat.row, `${monster.id}: attack/defeat row collision`);

    const actor = await loadActor(manifest);
    actor.play("HIT", { force: true });
    assert.equal(actor.play(actionName), true, `${monster.id}: living action must interrupt HIT`);
    actor.tick(actor.started + ((2.01 * 1000) / action.fps));
    const draw = draws.at(-1);
    assert.equal(actor.state, actionName, `${monster.id}: action state was replaced after HIT`);
    assert.equal(draw?.[2], action.row * manifest.frameHeight, `${monster.id}: action sampled a non-action atlas row`);

    actor.play("DEFEAT", { force: true });
    assert.equal(actor.play(actionName), false, `${monster.id}: defeated enemy must not cast`);
    assert.equal(actor.state, "DEFEAT", `${monster.id}: terminal defeat state changed`);
    actor.destroy();
  }

  assert.ok(html.includes("HIT is a short visual response, never a gameplay lock."), "HIT-to-action transition guard missing");
  assert.ok(!html.includes("const priority={IDLE:0,ENTER:1,ATTACK:2,SKILL:3,HIT:4,DEFEAT:5};"), "obsolete HIT-over-ATTACK priority remains");
  console.log(JSON.stringify({
    pass: true,
    monstersAudited: resolved.length,
    actionSkillVariants: skillVariants,
    baseAttackVariants: resolved.length - skillVariants,
    asserted: ["HIT→ACTION", "ACTION row ≠ HIT/DEFEAT", "DEFEAT blocks ACTION"],
  }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
