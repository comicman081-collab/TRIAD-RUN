'use strict';

// Static integrity validator for the offline folder runtime. It intentionally
// does not fetch data or start a network service.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ARCH = require('../src/triad_architecture.js');

const root = path.resolve(__dirname, '..');
const runtimePath = path.join(root, 'TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html');
const html = fs.readFileSync(runtimePath, 'utf8');
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const exists = relative => fs.existsSync(path.join(root, relative));

const inline = html.match(/<script>\s*([\s\S]*?)<\/script>/);
check(Boolean(inline), 'inline runtime script is missing');
if (inline) {
  try { new Function(inline[1]); } catch (error) { errors.push(`inline runtime syntax: ${error.message}`); }
}

const scriptSources = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(match => match[1]);
const scriptPath = source => source.replace(/[?#].*$/, '');
for (const source of scriptSources) check(exists(scriptPath(source)), `missing runtime script: ${source}`);
check(scriptSources.includes('src/triad_architecture.js'), 'architecture adapter is not loaded');
check(scriptSources.some(source => scriptPath(source) === 'assets/characters/roster/triad_character_roster.js'), 'canonical roster registry is not loaded');
check(!scriptSources.some(source => /assets\/characters\/(?:character_assets|triad_asset_manifest)\.js/.test(scriptPath(source))), 'legacy assembly assets remain active runtime dependencies');
check(!/\bfetch\s*\(/.test(html), 'runtime must not fetch remote data');
check(!/<(?:script|link|img)[^>]+https?:\/\//i.test(html), 'runtime must not require a remote URL');

for (const source of ['TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html', 'combat_data.js', 'card_character_data.js']) {
  const text = fs.readFileSync(path.join(root, source), 'utf8');
  check(!/Math\.random/.test(text), `gameplay source must not call Math.random: ${source}`);
}

const sandbox = { window: {} };
sandbox.window.window = sandbox.window;
for (const source of ['combat_data.js', 'card_character_data.js']) {
  vm.runInNewContext(fs.readFileSync(path.join(root, source), 'utf8'), sandbox, { filename: source });
}
const combat = sandbox.window.TRIAD_COMBAT_DATA;
const cards = sandbox.window.TRIAD_CARD_CHARACTER_DATA;
check(Boolean(combat && cards), 'canonical data modules did not load');

const rosterSandbox = { window: {} };
rosterSandbox.window.window = rosterSandbox.window;
const rosterSource = 'assets/characters/roster/triad_character_roster.js';
vm.runInNewContext(fs.readFileSync(path.join(root, rosterSource), 'utf8'), rosterSandbox, { filename: rosterSource });
const roster = rosterSandbox.window.TRIAD_CHARACTER_ROSTER;
check(Boolean(roster), 'canonical character roster did not load');
const rosterIds = new Set();
let rosterMissingCount = 0;
let rosterManifestCount = 0;
let rosterAtlasCount = 0;
let rosterFrameCount = 0;
for (const record of roster && roster.records || []) {
  if (rosterIds.has(record.id)) errors.push(`duplicate roster character ID: ${record.id}`);
  rosterIds.add(record.id);
  check(record.enabled === true, `roster character is disabled: ${record.id}`);
  check(exists(record.fullArt), `missing full art: ${record.id}`);
  check(exists(record.sd?.manifest), `missing SD manifest: ${record.id}`);
  const manifestScript = String(record.sd?.manifest || '').replace(/\.json$/, '.js');
  check(scriptSources.some(source => scriptPath(source) === manifestScript), `SD manifest script is not active: ${record.id}`);
  if (!exists(record.sd?.manifest)) { rosterMissingCount += 1; continue; }
  const manifest = JSON.parse(fs.readFileSync(path.join(root, record.sd.manifest), 'utf8'));
  rosterManifestCount += 1;
  check(manifest.characterId === record.id && manifest.status === 'PASS_ACTIVE_FINAL' && manifest.runtimeEligible === true, `SD manifest status mismatch: ${record.id}`);
  for (const [clipName, clip] of Object.entries(manifest.clips || {})) {
    const asset = manifest.assets?.[clipName];
    if (!asset || !exists(asset.path)) { rosterMissingCount += 1; continue; }
    rosterAtlasCount += 1; rosterFrameCount += Number(clip.frames) || 0;
    check(asset.status === 'PASS_ACTIVE_FINAL' && clip.frames === 84, `SD atlas contract mismatch: ${record.id}/${clipName}`);
  }
}
check(rosterIds.size === 12, `expected 12 roster characters, found ${rosterIds.size}`);
check(rosterManifestCount === 12 && rosterAtlasCount === 108 && rosterFrameCount === 9072, `SD roster contract mismatch: ${rosterManifestCount} manifests / ${rosterAtlasCount} atlases / ${rosterFrameCount} frames`);
check(rosterMissingCount === 0, `missing canonical roster asset records: ${rosterMissingCount}`);

const coreIds = Object.keys(cards && cards.CHARACTERS || {});
const patternSection = html.match(/const CARD_PATTERNS=\[([\s\S]*?)\];[\s\S]*?CARD_PATTERNS\.push\(([\s\S]*?)\);\s*function coreBy/);
const patternKeys = patternSection ? [...new Set([...`${patternSection[1]}${patternSection[2]}`.matchAll(/\{key:'([^']+)'/g)].map(match => match[1]))] : [];
const artifactBlock = html.match(/const ARTIFACTS=\[([\s\S]*?)\];/);
const artifactIds = artifactBlock ? [...artifactBlock[1].matchAll(/id:'([^']+)'/g)].map(match => match[1]) : [];
check(coreIds.length === 6, `expected 6 cores, found ${coreIds.length}`);
check(patternKeys.length === 21, `expected 21 card patterns, found ${patternKeys.length}`);
check(artifactIds.length === 8, `expected 8 artifacts, found ${artifactIds.length}`);
check(combat && combat.MONSTERS.length === 90, `expected 90 enemy records, found ${combat && combat.MONSTERS.length}`);
check(combat && combat.MONSTERS.filter(enemy => enemy.rank === 'boss').length === 18, 'expected 18 boss records');

for (const coreId of coreIds) {
  check(exists(`card_art/signature/${coreId.toLowerCase()}.webp`), `missing signature art for ${coreId}`);
  for (const key of patternKeys.filter(key => key !== 'signature')) check(exists(`card_art/regular/${coreId.toLowerCase()}/${key}.webp`), `missing card art for ${coreId}/${key}`);
}
for (const relative of ['assets/characters/roster/triad_character_roster.js', 'assets/battle_backgrounds']) check(exists(relative), `missing runtime asset root: ${relative}`);

for (const character of Object.values(cards && cards.CHARACTERS || {})) {
  for (const key of ['baseHp', 'basePhysicalAttack', 'baseMagicAttack', 'baseDefense', 'baseRecovery']) check(Number.isFinite(character[key]) && character[key] >= 0, `invalid character numeric value: ${character.id}/${key}`);
}
for (const enemy of combat && combat.MONSTERS || []) {
  check(Number.isFinite(enemy.maxHp) && enemy.maxHp > 0, `invalid enemy HP: ${enemy.id}`);
  for (const skill of enemy.skills) check(Number.isFinite(skill.medianDamage) && skill.medianDamage >= 0, `invalid enemy damage: ${enemy.id}/${skill.id}`);
}

const registry = new ARCH.EffectRegistry();
ARCH.EFFECT_TYPES.forEach(type => registry.register(type, effect => effect));
const legacyEffectType = { strike:'DAMAGE',guard:'SHIELD',quick:'CHAIN',heavy:'DAMAGE',focus:'DRAW',battery:'MODIFY_ENERGY',mark:'CHAIN',dot:'CHAIN',burst:'MULTI_HIT',heal:'HEAL',combo:'CHAIN',scale:'SCALE',counter:'CHAIN',execute:'CONDITIONAL',signature:'CHAIN',inferno:'CHAIN',volley:'MULTI_HIT',bastion:'CHAIN',ambush:'CONDITIONAL',renewal:'CHAIN',overload:'CHAIN' };
for (const type of new Set(Object.values(legacyEffectType))) {
  check(registry.has(type), `unregistered legacy effect type: ${type}`);
}

const growthKeys = Object.keys(cards && cards.CARD_GROWTH || {});
const damageTypeKeys = Object.keys(cards && cards.CARD_DAMAGE_TYPES || {});
const signatureProfiles = Object.keys(cards && cards.SIGNATURE_PROFILES || {});
check(growthKeys.length === patternKeys.length, `card growth parity failed: ${growthKeys.length}/${patternKeys.length}`);
check(damageTypeKeys.length === patternKeys.length, `card damage-type parity failed: ${damageTypeKeys.length}/${patternKeys.length}`);
check(signatureProfiles.length === coreIds.length, `signature profile parity failed: ${signatureProfiles.length}/${coreIds.length}`);
check(coreIds.length * patternKeys.length === 126, 'runtime card total parity failed');

if (errors.length) {
  process.stderr.write(`[STATIC_FAIL] ${errors.length} error(s)\n${errors.map(error => `- ${error}`).join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(`${JSON.stringify({
  result: 'STATIC_PASS',
  runtime: runtimePath,
  cores: coreIds.length,
  cards: coreIds.length * patternKeys.length,
  artifacts: artifactIds.length,
  statuses: 3,
  enemies: combat.MONSTERS.length,
  bosses: combat.MONSTERS.filter(enemy => enemy.rank === 'boss').length,
  rosterCharacters: rosterIds.size,
  rosterManifests: rosterManifestCount,
  rosterAtlases: rosterAtlasCount,
  rosterFrames: rosterFrameCount,
  rosterMissing: rosterMissingCount,
  externalScripts: scriptSources.length,
  offline: true
})}\n`);
