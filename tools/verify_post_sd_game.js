"use strict";

/* Canonical runtime integrity gate. It verifies only the active roster/SD flow;
   legacy assembly files intentionally remain outside the production dependency graph. */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..");
const htmlPath = path.join(root, "TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html");
const requiredClips = ["enter", "idle", "attack", "skill", "ultimate", "guard", "hit", "ko", "victory"];
const manifestSpecs = [
  ["TRIAD-CHAR-001", 54, "r054_blender_nineclip_manifest"],
  ["TRIAD-CHAR-002", 27, "r027_blender_nineclip_manifest"],
  ["TRIAD-CHAR-003", 23, "r023_blender_nineclip_manifest"],
  ["TRIAD-CHAR-004", 10, "r010_blender_nineclip_manifest"],
  ["TRIAD-CHAR-005", 10, "r010_blender_nineclip_manifest"],
  ["TRIAD-CHAR-006", 10, "r010_blender_nineclip_manifest"],
];
const sha256 = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const html = fs.readFileSync(htmlPath, "utf8");
const errors = [];
const report = { html: path.basename(htmlPath), characters: 0, atlas: 0, frames: 0, legacyAssemblyDependencies: 0, errors };

for (const forbidden of ["assets/characters/character_assets.js", "assets/characters/triad_asset_manifest.js"]) {
  if (html.includes(forbidden)) errors.push(`legacy assembly script remains active: ${forbidden}`);
}
if (!/id="customize"[^>]*data-status="LEGACY_REFERENCE_ONLY"[^>]*hidden/.test(html)) errors.push("legacy customizer is not hidden and classified");
if (!/id="toCustomize"[^>]+onclick="startRosterDraft\(\)"/.test(html)) errors.push("roster selection does not go directly to starting deck");
if (/id="toCustomize"[^>]+beginAppearanceCustomization/.test(html)) errors.push("production UI still enters assembly");
if (!html.includes("function migrateProductionVisual") || !html.includes("LEGACY_CHARACTER_ASSEMBLY_REFERENCE_ONLY")) errors.push("legacy visual migration is missing");
if (/\.\.\\|\.\.\/로그라이크 덱빌딩|D:\\AI 종합 폴더/.test(html)) errors.push("canonical HTML contains an old-root reference");
if (!html.includes('src/triad_architecture.js') || !html.includes('src/triad_transactions.js') || !html.includes('TRIAD_ARCH.random(run)') || !html.includes('rngState:setup.rngState')) errors.push("seeded RNG or transaction authority is not connected to the active runtime");
if (html.includes('Math.random')) errors.push("active canonical HTML still uses ambient Math.random");
if (!html.includes('function replayHistory(i){') || !html.includes('const restarted=newSetup();') || !html.includes('setup=restarted;')) errors.push("history replay does not create a fresh deterministic run context");
for (const required of [
  'else if(run.pendingTransition){resumePendingTransition()}',
  "TRIAD_TXN.pending(run,'COMBAT_REWARD'",
  'run.rewardOffer=buildRewardOffer()',
  'run?.id===runId&&run.pendingTransition?.txnId===txnId',
  "TRIAD_TXN.pending(run,'EVENT_ARTIFACT'",
  "TRIAD_TXN.isPending(pending,'COMBAT_REWARD'",
  'completeStage(true,pending.txnId',
  "combat.phase='TERMINAL';combat.inputLocked=true",
]) {
  if (!html.includes(required)) errors.push(`persisted reward transition missing: ${required}`);
}
for (const required of [
  'function ensureRouteOffer()',
  'const choices=ensureRouteOffer(),offerToken=run.routeOffer.txnId;',
  "txnId:TRIAD_TXN.id(run,'ROUTE',run.stage)",
  "offer.status!=='PENDING'||offer.txnId!==offerToken",
  'TRIAD_TXN.isCommitted(run,offer.txnId)',
  'run.routeOffer=null',
]) {
  if (!html.includes(required)) errors.push(`persisted route transition missing: ${required}`);
}
if (html.includes(`onclick="chooseRoute('battle')">전투 시작`)) errors.push('route header can bypass boss-only route choice');
for (const required of [
  'function isPlayableOwner',
  'function retireKoOwnerCards',
  'if(wasAlive&&p.hp<=0)retireKoOwnerCards(p.id)',
  'function playCardAuthoritative',
  'if(!owner||owner.hp<=0)',
  "const ownerAlive=isPlayableOwner(card.owner),playable=inputOpen&&ownerAlive&&cost<=c.energy",
  'if(exhaust||!isPlayableOwner(card.owner))c.exhaust.push(state)',
  '전투불능 · 카드 비활성',
]) {
  if (!html.includes(required)) errors.push(`KO owner-card protection missing: ${required}`);
}
for (const required of ["class SdBattleActor", "requestAnimationFrame", "card.pattern.key==='signature'?'ultimate'", "p.hp<=0?'ko':blocked>0?'guard':'hit'", 'endTurnAuthoritative', 'actionToken']) {
  if (!html.includes(required)) errors.push(`SD runtime binding missing: ${required}`);
}

for (const [characterId, revision, revisionFolder] of manifestSpecs) {
  const rel = `assets/characters/roster/${characterId}/sd/revisions/${revisionFolder}/sd_manifest.json`;
  const manifestPath = path.join(root, rel);
  const scriptPath = rel.replace(/\.json$/, ".js");
  if (!fs.existsSync(manifestPath) || !fs.existsSync(path.join(root, scriptPath))) { errors.push(`missing SD manifest: ${characterId}`); continue; }
  if (!html.includes(`${scriptPath.replaceAll(path.sep, "/")}?v=`)) errors.push(`HTML does not load active SD manifest: ${characterId}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  report.characters += 1;
  if (manifest.characterId !== characterId || manifest.revision !== revision || manifest.status !== "PASS_ACTIVE_FINAL" || manifest.runtimeEligible !== true) errors.push(`manifest identity/status mismatch: ${characterId}`);
  if (manifest.faction !== "PLAYER" || manifest.battleLane !== "LEFT" || manifest.facing !== "RIGHT" || manifest.runtimeMirror !== false) errors.push(`battle direction mismatch: ${characterId}`);
  for (const clipName of requiredClips) {
    const clip = manifest.clips?.[clipName];
    const asset = manifest.assets?.[clipName];
    if (!clip || !asset) { errors.push(`missing clip: ${characterId}/${clipName}`); continue; }
    report.atlas += 1; report.frames += clip.frames || 0;
    if (clip.frames !== 84 || clip.fps !== 30 || clip.columns !== 12 || clip.rows !== 7 || asset.status !== "PASS_ACTIVE_FINAL") errors.push(`atlas contract mismatch: ${characterId}/${clipName}`);
    const atlasFile = path.join(root, asset.path);
    if (!fs.existsSync(atlasFile)) errors.push(`missing atlas: ${characterId}/${clipName}`);
    else if (sha256(atlasFile) !== asset.sha256) errors.push(`atlas hash mismatch: ${characterId}/${clipName}`);
  }
  if (manifest.clips?.ko?.holdLastFrame !== true || manifest.clips?.victory?.holdLastFrame !== true) errors.push(`terminal hold missing: ${characterId}`);
}
report.pass = errors.length === 0 && report.characters === 6 && report.atlas === 54 && report.frames === 4536;
console.log(JSON.stringify(report, null, 2));
if (!report.pass) process.exitCode = 1;
