"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.resolve(__dirname, "..", "TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html"), "utf8");
const between = (start, end) => {
  const from = html.indexOf(start);
  const to = html.indexOf(end, from);
  assert.notStrictEqual(from, -1, `missing ${start}`);
  assert.notStrictEqual(to, -1, `missing ${end}`);
  return html.slice(from, to);
};

const setupFactory = between("function newSetup()", "function rosterCharacter");
assert.match(setupFactory, /seed,rngState:seed,rngCursor:0,rngAlgorithm:TRIAD_ARCH\.RNG_ALGORITHM/);

const replay = between("function replayHistory(i)", "function deleteHistory(i)");
assert.match(replay, /const restarted=newSetup\(\);/);
assert.match(replay, /restarted\.characters=historyCharacters/);
assert.match(replay, /setup=restarted/);
assert.doesNotMatch(replay, /setup=\{characters:/);

console.log("[PASS] history replay creates a fresh seeded run context before restoring the roster");
