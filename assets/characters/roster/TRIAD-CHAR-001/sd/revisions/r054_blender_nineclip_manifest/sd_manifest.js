window.TRIAD_SD_MANIFESTS = window.TRIAD_SD_MANIFESTS || {};
window.TRIAD_SD_MANIFESTS["TRIAD-CHAR-001"] = {
  schema: "triad.sd.bundle.v1", status: "PASS_ACTIVE_FINAL", characterId: "TRIAD-CHAR-001", revision: 54,
  frameWidth: 512, frameHeight: 512, anchor: { x: 256, y: 493 }, faction: "PLAYER", battleLane: "LEFT", facing: "RIGHT", enemyLane: "RIGHT", runtimeMirror: false,
  clips: {
    enter: { atlas: "assets/characters/roster/TRIAD-CHAR-001/sd/revisions/r034_imagegen_enter_84f/enter_r34_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, events: { land: 39, ready: 81 }, motion: "RIGHT_INWARD", authoredPoseCadenceFps: 10 },
    idle: { atlas: "assets/characters/roster/TRIAD-CHAR-001/sd/revisions/r036_imagegen_idle_84f/idle_r36_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: true, events: {}, authoredPoseCadenceFps: 10 },
    attack: { atlas: "assets/characters/roster/TRIAD-CHAR-001/sd/revisions/r039_imagegen_attack_84f/attack_r39_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, events: { release: 36, projectile: 36 }, motion: "RIGHT_INWARD", authoredPoseCadenceFps: 10 },
    skill: { atlas: "assets/characters/roster/TRIAD-CHAR-001/sd/revisions/r049_blender_skill_84f/skill_r49_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, events: { effect: 36 }, motion: "RIGHT_CAST", authoredPoseCadenceFps: 10 },
    ultimate: { atlas: "assets/characters/roster/TRIAD-CHAR-001/sd/revisions/r050_blender_ultimate_84f/ultimate_r50_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, events: { effect: 39, impact: 42 }, motion: "RIGHT_ULTIMATE_LUNGE", authoredPoseCadenceFps: 10 },
    guard: { atlas: "assets/characters/roster/TRIAD-CHAR-001/sd/revisions/r047_blender_guard_84f/guard_r47_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, events: { block: 36, hold: 48 }, motion: "STATIC_RIGHT_FACING", authoredPoseCadenceFps: 10 },
    hit: { atlas: "assets/characters/roster/TRIAD-CHAR-001/sd/revisions/r045_blender_hit_84f/hit_r45_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, events: { impactReceived: 12, maxRecoil: 45 }, motion: "LEFT_OUTWARD", authoredPoseCadenceFps: 10 },
    ko: { atlas: "assets/characters/roster/TRIAD-CHAR-001/sd/revisions/r052_blender_ko_84f/ko_r52_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, holdLastFrame: true, events: { down: 60, hold: 81 }, motion: "LEFT_COLLAPSE_HOLD", authoredPoseCadenceFps: 10 },
    victory: { atlas: "assets/characters/roster/TRIAD-CHAR-001/sd/revisions/r053_blender_victory_84f/victory_r53_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, holdLastFrame: true, events: { pose: 60, hold: 81 }, motion: "RIGHT_FACING_VICTORY_RAISE_SETTLE_HOLD", authoredPoseCadenceFps: 10 }
  },
  assets: {
    enter: { assetId: "TRIAD-SD-CHAR001-ENTER-R34-84F", path: "assets/characters/roster/TRIAD-CHAR-001/sd/revisions/r034_imagegen_enter_84f/enter_r34_84f.webp", sha256: "271020856ba8f23099c522cc6d77fa7b28d64451cdd1813e6cf70f394c6ec371", status: "PASS_ACTIVE_FINAL" },
    idle: { assetId: "TRIAD-SD-CHAR001-IDLE-R36-84F", path: "assets/characters/roster/TRIAD-CHAR-001/sd/revisions/r036_imagegen_idle_84f/idle_r36_84f.webp", sha256: "d2413b1c9204f28554cdf7b4de3100c6664d4a39a52722b0ce3fa18049e6fa35", status: "PASS_ACTIVE_FINAL" },
    attack: { assetId: "TRIAD-SD-CHAR001-ATTACK-R39-84F", path: "assets/characters/roster/TRIAD-CHAR-001/sd/revisions/r039_imagegen_attack_84f/attack_r39_84f.webp", sha256: "f80d10fade53ffaecca05c97680bd92b4a27c0685431715b578257f4eaa6234d", status: "PASS_ACTIVE_FINAL" },
    skill: { assetId: "TRIAD-SD-CHAR001-SKILL-R49-84F", path: "assets/characters/roster/TRIAD-CHAR-001/sd/revisions/r049_blender_skill_84f/skill_r49_84f.webp", sha256: "d13dbba7f7ecbd3d7276e6fbd883db5ddc27b8a6bf04b62df50ad8b441c97e17", status: "PASS_ACTIVE_FINAL" },
    ultimate: { assetId: "TRIAD-SD-CHAR001-ULTIMATE-R50-84F", path: "assets/characters/roster/TRIAD-CHAR-001/sd/revisions/r050_blender_ultimate_84f/ultimate_r50_84f.webp", sha256: "c4a6c0f2e5f65faabcc4bdca44ea5ae476bad73b9e8b79f0fcf845d39f9ac64e", status: "PASS_ACTIVE_FINAL" },
    guard: { assetId: "TRIAD-SD-CHAR001-GUARD-R47-84F", path: "assets/characters/roster/TRIAD-CHAR-001/sd/revisions/r047_blender_guard_84f/guard_r47_84f.webp", sha256: "94106c7070c081f0c43b1e51721de47e8a00b5076dcc0d4a6c5232786dcdc670", status: "PASS_ACTIVE_FINAL" },
    hit: { assetId: "TRIAD-SD-CHAR001-HIT-R45-84F", path: "assets/characters/roster/TRIAD-CHAR-001/sd/revisions/r045_blender_hit_84f/hit_r45_84f.webp", sha256: "1426ab9e4ea6dadd50b75cf8e0d1bff0d5805ea1115fb2368fef9bdf2436f9e1", status: "PASS_ACTIVE_FINAL" },
    ko: { assetId: "TRIAD-SD-CHAR001-KO-R52-84F", path: "assets/characters/roster/TRIAD-CHAR-001/sd/revisions/r052_blender_ko_84f/ko_r52_84f.webp", sha256: "fc0abccac30eaf0835cdd4baf680f3422afc63feee4f57ffb815577d64b7cde8", status: "PASS_ACTIVE_FINAL" },
    victory: { assetId: "TRIAD-SD-CHAR001-VICTORY-R53-84F", path: "assets/characters/roster/TRIAD-CHAR-001/sd/revisions/r053_blender_victory_84f/victory_r53_84f.webp", sha256: "6c0c684f10df9a847391e3ad0692cbd53826e057d39568a2b8396141fdf3f02f", status: "PASS_ACTIVE_FINAL" }
  },
  projectiles: { primary: { assetId: "TRIAD-SD-CHAR001-PROJECTILE-R25", path: "assets/characters/roster/TRIAD-CHAR-001/sd/source_generation/imagegen_keyposes_v25/projectile/ember_solar_projectile_imagegen_v25_rgba.png", sha256: "bb316c95cbcda7752c4f6ff21fbc09b59413c8159d11490bb0b2a82de47877c3", facing: "RIGHT", embeddedInCharacterAtlas: false } },
  qa: {
    enterContact: "assets/characters/roster/TRIAD-CHAR-001/sd/revisions/r034_imagegen_enter_84f/EMBER_ENTER_R34_28_UNIQUE_CONTACT.png",
    idleContact: "assets/characters/roster/TRIAD-CHAR-001/sd/revisions/r036_imagegen_idle_84f/EMBER_IDLE_R36_28_UNIQUE_CONTACT.png",
    attackContact: "assets/characters/roster/TRIAD-CHAR-001/sd/revisions/r039_imagegen_attack_84f/EMBER_ATTACK_R39_28_UNIQUE_CONTACT.png",
    skillContact: "assets/characters/roster/TRIAD-CHAR-001/sd/revisions/r049_blender_skill_84f/EMBER_SKILL_R49_28_UNIQUE_CONTACT.png",
    ultimateContact: "assets/characters/roster/TRIAD-CHAR-001/sd/revisions/r050_blender_ultimate_84f/EMBER_ULTIMATE_R50_28_UNIQUE_CONTACT.png",
    guardContact: "assets/characters/roster/TRIAD-CHAR-001/sd/revisions/r047_blender_guard_84f/EMBER_GUARD_R47_28_UNIQUE_CONTACT.png",
    hitContact: "assets/characters/roster/TRIAD-CHAR-001/sd/revisions/r045_blender_hit_84f/EMBER_HIT_R45_28_UNIQUE_CONTACT.png",
    koContact: "assets/characters/roster/TRIAD-CHAR-001/sd/revisions/r052_blender_ko_84f/EMBER_KO_R52_28_UNIQUE_CONTACT.png",
    victoryContact: "assets/characters/roster/TRIAD-CHAR-001/sd/revisions/r053_blender_victory_84f/EMBER_VICTORY_R53_28_UNIQUE_CONTACT.png"
  },
  runtimeEligible: true, localForgeUsed: false, localAssetGeneration: "BLENDER_ONLY", modelFilesModified: false
};
