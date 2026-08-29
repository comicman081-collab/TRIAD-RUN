'use strict';

// Exports the immutable card and monster-skill records through the current VFX
// resolver.  The resulting plan is consumed by the deterministic derivative
// builder; no image model or external service is involved.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const window = {};
window.window = window;
for (const source of ['combat_data.js', 'enemy_visual_data.js', 'combat_vfx_data.js', 'combat_vfx_pipeline_v2.js', 'assets/characters/roster/triad_character_roster.js']) {
  vm.runInNewContext(read(source), { window }, { filename: source });
}

const vfx = window.TRIAD_COMBAT_VFX;
const data = window.TRIAD_COMBAT_DATA;
const roster = window.TRIAD_CHARACTER_ROSTER.records;
const html = read('TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html');
const cardBlock = html.match(/const CARD_PATTERNS=\[([\s\S]*?)function coreBy\(/)?.[1] || '';
const cardKeys = [...new Set([...cardBlock.matchAll(/key:'([^']+)'/g)].map(([, key]) => key))];
const coreIds = [...new Set(roster.map(record => record.coreId))];
const hashSeed = text => {
  let value = 2166136261;
  for (const character of String(text)) value = Math.imul(value ^ character.charCodeAt(0), 16777619) >>> 0;
  return value;
};
const describe = (id, event) => ({
  id,
  seed: hashSeed(id),
  pipeline: event.pipeline,
  target: event.target,
  sourceLaunch: (event.launchAsset || event.asset).path,
  sourceImpact: (event.impactAsset || event.asset).path,
  impactFamily: event.impactProfile || 'arc-cleave',
  travelProfile: event.travelProfile || null,
  primaryMotion: (event.launchAsset || event.asset).motion || 'STRIKE'
});

const cards = coreIds.flatMap(coreId => cardKeys.map((key, index) => {
  const id = `${coreId}_${String(index + 1).padStart(2, '0')}`;
  return { ...describe(id, vfx.card({ id, owner: coreId, pattern: { key } })), coreId, cardKey: key };
}));
const enemies = data.MONSTERS.flatMap(monster => {
  const archetype = data.ARCHETYPES[monster.catalogNo - 1].key;
  const actor = { data: { ...monster, archetypeKey: archetype } };
  return monster.skills.map(skill => ({ ...describe(skill.id, vfx.enemy(actor, skill.id)), monsterId: monster.id, archetype, rank: monster.rank, elementId: monster.elementId, skillName: skill.name }));
});
const plan = { version: '3.0.0-unique-skill-assets', cards, enemies };
const outputDirectory = path.join(root, 'qa_artifacts', 'combat_vfx_v3');
fs.mkdirSync(outputDirectory, { recursive: true });
const output = path.join(outputDirectory, 'unique_vfx_plan.json');
fs.writeFileSync(output, `${JSON.stringify(plan, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ result: cards.length === 126 && enemies.length === 180 ? 'PASS' : 'FAIL', cards: cards.length, enemies: enemies.length, output: path.relative(root, output) })}\n`);
if (cards.length !== 126 || enemies.length !== 180) process.exitCode = 1;
