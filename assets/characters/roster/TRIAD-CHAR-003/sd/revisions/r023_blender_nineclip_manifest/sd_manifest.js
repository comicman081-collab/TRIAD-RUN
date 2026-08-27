window.TRIAD_SD_MANIFESTS = window.TRIAD_SD_MANIFESTS || {};
window.TRIAD_SD_MANIFESTS["TRIAD-CHAR-003"] = {
  schema: "triad.sd.bundle.v1",
  status: "PASS_ACTIVE_FINAL",
  characterId: "TRIAD-CHAR-003",
  revision: 23,
  frameWidth: 512,
  frameHeight: 512,
  anchor: { x: 256, y: 493 },
  faction: "PLAYER",
  battleLane: "LEFT",
  facing: "RIGHT",
  enemyLane: "RIGHT",
  runtimeMirror: false,
  clips: {
    enter: { atlas: "assets/characters/roster/TRIAD-CHAR-003/sd/revisions/r018_blender_enter_phase_normalized_84f/enter_r18_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, events: { arrive: 36, ready: 63 }, motion: "RIGHT_FACING_RUN_IN_LAND_READY", authoredPoseCadenceFps: 10 },
    idle: { atlas: "assets/characters/roster/TRIAD-CHAR-003/sd/revisions/r007_blender_idle_equipment_safe_84f/idle_r7_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: true, events: {}, motion: "RIGHT_FACING_SHIELD_IDLE_LOOP", authoredPoseCadenceFps: 10 },
    attack: { atlas: "assets/characters/roster/TRIAD-CHAR-003/sd/revisions/r009_blender_attack_equipment_safe_84f/attack_r9_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, events: { impact: 42 }, motion: "RIGHT_FACING_SHIELD_BASH", authoredPoseCadenceFps: 10 },
    skill: { atlas: "assets/characters/roster/TRIAD-CHAR-003/sd/revisions/r019_blender_skill_phase_normalized_84f/skill_r19_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, events: { effect: 42, recover: 63 }, motion: "RIGHT_FACING_SHIELD_SUPPORT_SKILL", authoredPoseCadenceFps: 10 },
    ultimate: { atlas: "assets/characters/roster/TRIAD-CHAR-003/sd/revisions/r020_blender_ultimate_phase_normalized_84f/ultimate_r20_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, events: { effect: 45, impact: 48, recover: 66 }, motion: "RIGHT_FACING_TOWER_SHIELD_ULTIMATE", authoredPoseCadenceFps: 10 },
    guard: { atlas: "assets/characters/roster/TRIAD-CHAR-003/sd/revisions/r017_blender_guard_phase_normalized_84f/guard_r17_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, events: { guard: 21, release: 63 }, motion: "RIGHT_FACING_TOWER_SHIELD_GUARD", authoredPoseCadenceFps: 10 },
    hit: { atlas: "assets/characters/roster/TRIAD-CHAR-003/sd/revisions/r016_blender_hit_phase_normalized_84f/hit_r16_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, events: { impact: 33, recover: 63 }, motion: "RIGHT_FACING_SHIELD_HIT_RECOIL", authoredPoseCadenceFps: 10 },
    ko: { atlas: "assets/characters/roster/TRIAD-CHAR-003/sd/revisions/r021e_blender_ko_canonical_84f/ko_r21_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, holdLastFrame: true, events: { down: 45, hold: 72 }, motion: "RIGHT_FACING_CONTROLLED_SHIELD_KO_CONTINUOUS", authoredPoseCadenceFps: 10 },
    victory: { atlas: "assets/characters/roster/TRIAD-CHAR-003/sd/revisions/r022b_blender_victory_clean_84f/victory_r22_84f.webp", frames: 84, fps: 30, columns: 12, rows: 7, loop: false, holdLastFrame: true, events: { pose: 51, hold: 72 }, motion: "RIGHT_FACING_DIGNIFIED_SHIELD_VICTORY_CLEAN", authoredPoseCadenceFps: 10 }
  },
  qa: { summary: "assets/characters/roster/TRIAD-CHAR-003/sd/qa/AEGIS_NINE_CLIP_CANONICAL_SUMMARY.png" },
  runtimeEligible: true,
  localForgeUsed: false,
  localAssetGeneration: "BLENDER_ONLY",
  modelFilesModified: false
};
