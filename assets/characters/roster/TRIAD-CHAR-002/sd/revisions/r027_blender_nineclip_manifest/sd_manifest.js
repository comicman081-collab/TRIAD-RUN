window.TRIAD_SD_MANIFESTS = window.TRIAD_SD_MANIFESTS || {};
window.TRIAD_SD_MANIFESTS["TRIAD-CHAR-002"] = {
  schema: "triad.sd.bundle.v1",
  status: "PASS_ACTIVE_FINAL",
  characterId: "TRIAD-CHAR-002",
  revision: 27,
  frameWidth: 512,
  frameHeight: 512,
  anchor: { x: 256, y: 493 },
  faction: "PLAYER",
  battleLane: "LEFT",
  facing: "RIGHT",
  enemyLane: "RIGHT",
  runtimeMirror: false,
  clips: {
    enter: { atlas: "assets/characters/roster/TRIAD-CHAR-002/sd/revisions/r022_blender_enter_canonical_84f/enter_r22_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, events: { ready: 72 }, motion: "RIGHT_FACING_RUN_LAND_SETTLE", authoredPoseCadenceFps: 10 },
    idle: { atlas: "assets/characters/roster/TRIAD-CHAR-002/sd/revisions/r020_blender_idle_canonical_84f/idle_r20_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: true, events: {}, motion: "RIGHT_FACING_IDLE_LOOP", authoredPoseCadenceFps: 10 },
    attack: { atlas: "assets/characters/roster/TRIAD-CHAR-002/sd/revisions/r021_blender_attack_canonical_84f/attack_r21_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, events: { release: 36, projectile: 36, impact: 42 }, motion: "RIGHT_FACING_SPEAR_THRUST", authoredPoseCadenceFps: 10 },
    skill: { atlas: "assets/characters/roster/TRIAD-CHAR-002/sd/revisions/r025_blender_skill_canonical_84f/skill_r25_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, events: { effect: 45 }, motion: "RIGHT_FACING_TACTICAL_SPEAR_SKILL", authoredPoseCadenceFps: 10 },
    ultimate: { atlas: "assets/characters/roster/TRIAD-CHAR-002/sd/revisions/r026_blender_ultimate_canonical_84f/ultimate_r26_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, events: { effect: 42, impact: 48 }, motion: "RIGHT_FACING_SIGNATURE_SPEAR_THRUST", authoredPoseCadenceFps: 10 },
    guard: { atlas: "assets/characters/roster/TRIAD-CHAR-002/sd/revisions/r023_blender_guard_canonical_84f/guard_r23_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, events: { brace: 30, block: 45 }, motion: "RIGHT_FACING_SPEAR_GUARD", authoredPoseCadenceFps: 10 },
    hit: { atlas: "assets/characters/roster/TRIAD-CHAR-002/sd/revisions/r024_blender_hit_canonical_84f/hit_r24_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, events: { impact: 33, recover: 63 }, motion: "RIGHT_FACING_HIT_RECOIL", authoredPoseCadenceFps: 10 },
    ko: { atlas: "assets/characters/roster/TRIAD-CHAR-002/sd/revisions/r018_blender_ko_canonical_84f/ko_r18_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, holdLastFrame: true, events: { down: 57, hold: 81 }, motion: "RIGHT_FACING_DEFEAT_COLLAPSE", authoredPoseCadenceFps: 10 },
    victory: { atlas: "assets/characters/roster/TRIAD-CHAR-002/sd/revisions/r019_blender_victory_canonical_84f/victory_r19_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, holdLastFrame: true, events: { pose: 45, hold: 81 }, motion: "RIGHT_FACING_VICTORY_SALUTE", authoredPoseCadenceFps: 10 }
  },
  qa: { summary: "assets/characters/roster/TRIAD-CHAR-002/sd/qa/VOLT_NINE_CLIP_CANONICAL_SUMMARY.png" },
  runtimeEligible: true,
  localForgeUsed: false,
  localAssetGeneration: "BLENDER_ONLY",
  modelFilesModified: false
};
