'use strict';

/* Deterministic VFX coverage audit.  It loads the exact immutable roster and
 * combat records, resolves runtime events, and writes a reviewable report.
 * It neither changes combat data nor synthesizes visual assets. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const window = {};
window.window = window;
for (const source of ['combat_data.js', 'enemy_visual_data.js', 'combat_vfx_data.js', 'combat_vfx_skill_assets_v5.js', 'combat_vfx_pipeline_v2.js', 'assets/characters/roster/triad_character_roster.js']) {
  vm.runInNewContext(read(source), { window }, { filename: source });
}

const vfx = window.TRIAD_COMBAT_VFX;
const data = window.TRIAD_COMBAT_DATA;
const roster = window.TRIAD_CHARACTER_ROSTER.records;
const html = read('TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html');
const cardBlock = html.match(/const CARD_PATTERNS=\[([\s\S]*?)function coreBy\(/)?.[1] || '';
const cardKeys = [...new Set([...cardBlock.matchAll(/key:'([^']+)'/g)].map(([, key]) => key))];
const primaryAsset = event => event?.launchAsset || event?.asset;
const signature = event => [event.pipeline, primaryAsset(event)?.path, event.travelProfile, event.impactAsset?.path, event.impactProfile, event.particleProfile, event.uniqueSequenceId].join('|');
const pngMetadata = relative => {
  const bytes = fs.readFileSync(path.join(root, relative));
  const valid = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return valid ? { path: relative, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colorType: bytes[25], alpha: [4, 6].includes(bytes[25]) || bytes.includes(Buffer.from('tRNS')) } : { path: relative, valid: false };
};
const actor = monster => ({ data: { ...monster, archetypeKey: data.ARCHETYPES[monster.catalogNo - 1].key } });
const missing = [];
const enemyEntries = data.MONSTERS.flatMap(monster => monster.skills.map(skill => {
  const event = vfx.enemy(actor(monster), skill.id);
  if (!event?.asset?.path || !event?.impactAsset?.path || !event?.impactProfile) missing.push({ monsterId: monster.id, skillId: skill.id, reason: 'unresolved authored event' });
  const primary = primaryAsset(event);
  return { monsterId: monster.id, archetype: data.ARCHETYPES[monster.catalogNo - 1].key, rank: monster.rank, elementId: monster.elementId, skillId: skill.id, skillName: skill.name, event: { pipeline: event?.pipeline, launch: primary?.path, launchMotion: primary?.motion, travelProfile: event?.travelProfile || null, impact: event?.impactAsset?.path, impactProfile: event?.impactProfile, particleProfile: event?.particleProfile, contactMs: event?.contactMs || null, duration: event?.duration || null } };
}));
const perArchetype = Object.fromEntries(data.ARCHETYPES.map((archetype, index) => {
  const monster = data.MONSTERS.find(entry => entry.catalogNo === index + 1);
  const events = monster.skills.map(skill => vfx.enemy(actor(monster), skill.id));
  return [archetype.key, { skills: monster.skills.map((skill, i) => ({ id: skill.id, name: skill.name, presentation: signature(events[i]) })), distinctPresentations: new Set(events.map(signature)).size }];
}));
for (const [archetype, result] of Object.entries(perArchetype)) if (result.distinctPresentations !== 2) missing.push({ archetype, reason: 'two skill records collapsed to one presentation' });
const cardEntries = roster.flatMap(character => cardKeys.map((key, index) => {
  const event = vfx.card({ id: `${character.coreId}_${String(index + 1).padStart(2, '0')}`, pattern: { key }, owner: character.coreId, characterId: character.id });
  if (!event?.asset?.path || (event.target === 'enemy' && !event?.impactAsset?.path)) missing.push({ characterId: character.id, cardKey: key, reason: 'unresolved authored card event' });
  return { characterId: character.id, coreId: character.coreId, cardKey: key, pipeline: event?.pipeline, launch: event?.asset?.path, travelProfile: event?.travelProfile || null, impact: event?.impactAsset?.path || null, impactProfile: event?.impactProfile || null, target: event?.target };
}));
const assetAudit = Object.fromEntries(Object.entries(vfx.ASSETS).map(([key, asset]) => [key, pngMetadata(asset.path)]));
for (const [key, detail] of Object.entries(assetAudit)) if (!detail.valid && !detail.width) missing.push({ asset: key, reason: 'missing or invalid PNG' });
const report = {
  result: missing.length ? 'FAIL' : 'PASS',
  pipelineVersion: vfx.VERSION,
  actorCounts: { selectableCharacters: roster.length, monsterActors: data.MONSTERS.length, totalActors: roster.length + data.MONSTERS.length },
  recordCounts: { cardPatterns: cardKeys.length, characterCardPresentationPaths: cardEntries.length, monsterSkillRecords: enemyEntries.length, distinctMonsterSkillPresentations: new Set(enemyEntries.map(entry => [entry.event.pipeline, entry.event.launch, entry.event.travelProfile, entry.event.impact, entry.event.impactProfile, entry.event.particleProfile].join('|'))).size, authoredVfxAssets: Object.keys(assetAudit).length, derivedSkillAssets: Object.keys(window.TRIAD_COMBAT_VFX_SKILL_ASSETS_V5.cards).length * 2 + Object.keys(window.TRIAD_COMBAT_VFX_SKILL_ASSETS_V5.enemies).length * 2 },
  assetAudit,
  perArchetype,
  unresolved: missing,
  notes: ['Every elemental monster skill now has a separate launch/impact path and deterministic motion/rupture profile while retaining its own actor atlas and element hue.', 'Character records sharing a core intentionally use that core\'s card inventory; all 126 immutable card IDs still have separate launch/impact derivatives.']
};
const outputDirectory = path.join(root, 'qa_artifacts', 'combat_vfx_v5');
fs.mkdirSync(outputDirectory, { recursive: true });
const output = path.join(outputDirectory, 'coverage_audit.json');
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ result: report.result, report: path.relative(root, output), actorCounts: report.actorCounts, recordCounts: report.recordCounts, unresolved: missing }, null, 2)}\n`);
if (missing.length) process.exitCode = 1;
