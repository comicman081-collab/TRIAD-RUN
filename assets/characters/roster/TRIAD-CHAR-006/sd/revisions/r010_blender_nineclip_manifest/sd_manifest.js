window.TRIAD_SD_MANIFESTS = window.TRIAD_SD_MANIFESTS || {};
window.TRIAD_SD_MANIFESTS["TRIAD-CHAR-006"] = {
  schema: "triad.sd.bundle.v1",
  status: "PASS_ACTIVE_FINAL",
  characterId: "TRIAD-CHAR-006",
  revision: 10,
  frameWidth: 512, frameHeight: 512,
  anchor: { x: 256, y: 493 },
  faction: "PLAYER", battleLane: "LEFT", facing: "RIGHT", enemyLane: "RIGHT", runtimeMirror: false,
  clips: {
    enter: { atlas: "assets/characters/roster/TRIAD-CHAR-006/sd/revisions/r002b_blender_enter_adaptive_84f/enter_r2_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, events: { arrive: 42, ready: 66 }, motion: "RIGHT_FACING_RUN_IN_LAND_READY", authoredPoseCadenceFps: 10 },
    idle: { atlas: "assets/characters/roster/TRIAD-CHAR-006/sd/revisions/r001_blender_idle_canonical_84f/idle_r1_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: true, events: {}, motion: "RIGHT_FACING_CRYSTAL_DAGGER_IDLE_LOOP", authoredPoseCadenceFps: 10 },
    attack: { atlas: "assets/characters/roster/TRIAD-CHAR-006/sd/revisions/r003c_blender_attack_curated_84f/attack_r3_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, events: { release: 42, projectile: 42, impact: 48 }, motion: "RIGHT_FACING_DAGGER_LUNGE_SLASH", authoredPoseCadenceFps: 10 },
    skill: { atlas: "assets/characters/roster/TRIAD-CHAR-006/sd/revisions/r006d_blender_skill_clean_84f/skill_r6_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, events: { effect: 42, recover: 63 }, motion: "RIGHT_FACING_RIFT_HAND_CAST_NO_VFX", authoredPoseCadenceFps: 10 },
    ultimate: { atlas: "assets/characters/roster/TRIAD-CHAR-006/sd/revisions/r007e_blender_ultimate_clean_84f/ultimate_r7_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, events: { effect: 54, impact: 57, recover: 66 }, motion: "RIGHT_FACING_DAGGER_FLOURISH_ULTIMATE_NO_VFX", authoredPoseCadenceFps: 10 },
    guard: { atlas: "assets/characters/roster/TRIAD-CHAR-006/sd/revisions/r005_blender_guard_canonical_84f/guard_r5_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, events: { guard: 27, block: 42, release: 63 }, motion: "RIGHT_FACING_DAGGER_FOREARM_GUARD", authoredPoseCadenceFps: 10 },
    hit: { atlas: "assets/characters/roster/TRIAD-CHAR-006/sd/revisions/r004b_blender_hit_curated_84f/hit_r4_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, events: { impact: 30, recover: 63 }, motion: "RIGHT_FACING_DAMAGE_RECOIL_RECOVER", authoredPoseCadenceFps: 10 },
    ko: { atlas: "assets/characters/roster/TRIAD-CHAR-006/sd/revisions/r008c_blender_ko_curated_84f/ko_r8_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, holdLastFrame: true, events: { collapse: 60, hold: 72 }, motion: "RIGHT_FACING_COLLAPSE_FINAL_HOLD", authoredPoseCadenceFps: 10 },
    victory: { atlas: "assets/characters/roster/TRIAD-CHAR-006/sd/revisions/r009_blender_victory_canonical_84f/victory_r9_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, holdLastFrame: true, events: { pose: 60, hold: 72 }, motion: "RIGHT_FACING_ELEGANT_DAGGER_VICTORY_HOLD", authoredPoseCadenceFps: 10 }
  },
  qa: { summary: "assets/characters/roster/TRIAD-CHAR-006/sd/qa/RIFT_NINE_CLIP_SUMMARY.png" },
  runtimeEligible: true,
  localForgeUsed: false,
  localAssetGeneration: "BLENDER_ONLY",
  modelFilesModified: false
};
