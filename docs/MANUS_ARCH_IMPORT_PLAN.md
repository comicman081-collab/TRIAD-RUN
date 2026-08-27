# MANUS Architecture Import Plan

## Canonical identification

```text
CURRENT_CANONICAL_SOURCE: D:\AI 종합 폴더\Games\로그라이크 덱빌딩
CURRENT_RUNTIME_ENTRY: D:\AI 종합 폴더\Games\로그라이크 덱빌딩\TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html
CURRENT_GENERATED_STANDALONE: none found before migration; current contract is an offline folder runtime with relative local assets
CURRENT_ASSET_ROOT: D:\AI 종합 폴더\Games\로그라이크 덱빌딩\assets and card_art
CURRENT_SAVE_SCHEMA: unversioned localStorage `triad_active_run` (treated as v1)
```

The declared target initially contained reports and appearance work products but no HTML/JS runtime. The active runtime and its referenced local assets were discovered in the current project workspace, staged non-destructively into `D:\AI 종합 폴더\Games\TRIAD_RUN`, and then migrated there. The original discovered source was not modified.

## Incremental migration

| Step | Result | Notes |
| --- | --- | --- |
| 1. Inventory and backup | COMPLETE | Read-only Manus inventory; 79,163,178-byte snapshot. |
| 2. Seeded RNG | COMPLETE | Run/setup seed and RNG state; route/event/reward/enemy/damage use explicit RNG. |
| 3. Schema validator | COMPLETE | TargetSpec, EffectSpec, database ID/owner/cost/status validation core. |
| 4. CombatLog/Snapshot | COMPLETE | Structured runtime log hooks and deterministic BattleSnapshot API. |
| 5. TargetSpec/Resolver | COMPLETE | Enemy intent explicitly resolves ENEMY to PLAYER. |
| 6. EffectRegistry | COMPLETE (adapter) | Existing behavior switch retained; registry validates before legacy execution. |
| 7. Status lifecycle | DEFERRED | Existing burn/shock/mark behavior retained; no risky rewrite. |
| 8. ScheduledEffect | COMPLETE (architecture) | Remove-before-resolve and no nested SCHEDULE guard; regression tested. |
| 9. Enemy intent data | RETAINED | Existing `combat_data.js` intent data kept; no Astra data imported. |
| 10. Save migration | COMPLETE | Unversioned/v1 to v2 additive migration. |
| 11. Headless regression | COMPLETE | Unit suite plus 1,000 seeded 30-stage scripted simulations. |
| 12. Data extraction | DEFERRED | Current JS data retained to avoid big-bang rewrite. |
| 13. Standalone rebuild | COMPLETE | Migration-suffix entry built under existing offline folder contract. |
| 14. Full regression | PARTIAL | Static/unit/headless pass; browser runtime and visual QA unavailable. |

## Adapter boundary

The architecture module does not own appearance assembly or change card numbers. Current runtime functions remain the behavior authority. RNG, targeting, effect-contract validation, logging, snapshots, scheduling and save migration are added around those functions. Further data extraction should happen subsystem-by-subsystem only after an interactive browser regression environment is available.
