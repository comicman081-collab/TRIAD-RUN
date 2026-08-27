# MANUS Architecture Import Result

```text
MANUS_ARCH_IMPORT: PARTIAL
```

## BEFORE

- Canonical source discovered: `D:\AI 종합 폴더\Games\로그라이크 덱빌딩`
- Runtime entry: `TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html`
- Declared target initially had no runtime HTML/JS.
- CORE count: 6
- Card count: 126
- Artifact count: 8
- Status counter count: 3 (`burn`, `shock`, `mark`)
- Enemy record count: 90, including 18 boss records
- Save version: unversioned, treated as v1
- Build size: 117,071 bytes
- Runtime contract: offline folder with relative local scripts/assets

## IMPORTED

1. Persisted seeded RNG (`mulberry32-v1`) for gameplay-affecting rolls.
2. Explicit TargetSpec/TargetResolver with separate source and target teams.
3. EffectRegistry and machine-readable EffectSpec validation adapter.
4. Structured CombatLog records.
5. Replay-critical BattleSnapshot and stable result hashing.
6. ScheduledEffect remove-before-resolve queue.
7. Additive save v1 → v2 migration.
8. Static, unit and 1,000-seed/30-stage headless QA.
9. Offline migration-suffix build script and output.

## NOT IMPORTED

- All Astra Void content, art, UI, data, balance and names.
- Godot runtime, scenes, project settings and GDScript.
- Astra modules/events/passives/status values/boss phase rules.
- Full current-card JSON extraction or status rewrite; deferred to preserve existing behavior.
- Cue manifest content; only the separation concept was retained for a future phase.

## FIXED DURING PORT

- Target ambiguity is blocked by `sourceTeam` + `targetTeam`; enemy runtime targets PLAYER explicitly.
- Delayed wrappers cannot be scheduled as their own resolved effect; entries leave the queue before resolve.
- Source static PASS was not promoted to runtime PASS.
- No hardcoded Linux or Windows runtime path was added; tools discover root from `__dirname`.
- Natural-language effect text is rejected as an effect type.
- All direct gameplay `Math.random` calls were removed from the runtime entry/data modules.
- A staging path error was detected by validation and corrected; all required target assets now resolve. The extra duplicate was retained as a delete candidate per no-delete policy.

## TEST RESULTS

### STATIC

`STATIC_PASS`: 6 CORE, 126 cards, 8 artifacts, 3 statuses, 90 enemies, 18 bosses, 127 appearance-manifest records (87 active, missing 0, duplicate 0), 5 local scripts, offline contract true.

### UNIT

`UNIT_PASS`: 9 suites covering deterministic RNG/hash, four-direction targeting, delayed effects, save migration, effect/schema errors and snapshots.

### RUNTIME

`RUNTIME_UNVERIFIED`: Local browser navigation was blocked by the browser security policy. The HTML inline script and all JavaScript files passed syntax/static validation, but this is not an interactive runtime pass.

### SAVE

`SAVE_MIGRATION_UNIT_PASS`: Existing fields preserved in the legacy fixture; actual browser localStorage save/continue remains runtime-unverified.

### DETERMINISM

`DETERMINISM_PASS`: Same seed produces identical shuffle, route, enemy, rewards, RNG state and trace hash in unit/headless tests.

### FULL RUN

`FULL_RUN_HEADLESS_PASS`: 1,000 paired seeds × 30 stages; invalid target 0, softlock 0, non-finite value 0.

### VISUAL

`VISUAL_UNVERIFIED`

## Content and asset parity

- Card loss: 0
- CORE loss: 0
- Artifact loss: 0
- Appearance file loss: 0 (951 checked)
- Runtime asset loss: 0 (1,218 assets + 282 card-art files checked)
- Existing discovered source modified: no
- Manus source modified: no

## Build

- Source runtime after migration: 122,155 bytes
- Generated runtime entry: 122,155 bytes
- Size delta from baseline: +5,084 bytes (+4.34%)
- Output: `D:\AI 종합 폴더\Games\TRIAD_RUN\TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY_ARCH_MIGRATION.html`

## Acceptance gate conclusion

Static, unit, save-migration-unit, determinism, headless full-run, content parity, offline static and build gates passed. P0-01 through P0-08, actual save/continue, actual battle actions, mobile visual and generated-entry browser execution were not interactively observed. Therefore this result is `PARTIAL`, not `PASS`.
