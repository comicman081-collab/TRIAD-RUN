# TRIAD // RUN — Post-SD Canonical Game Audit

Date: 2026-08-18  
Canonical root: `D:\AI 종합 폴더\Games\TRIAD_RUN`

## Canonical

- Runtime: `TRIAD_RUN_V0_8_MANEQUIN_ASSEMBLY.html`
- SHA-256: `8233297FA1AE1F31ED0E6017732E053440C998D21E026D9BFC8920143C5FFAB6`
- Size: 145,820 bytes
- Pre-consolidation backup: `_migration_backup\_BACKUP_BEFORE_POST_SD_CANONICAL_CONSOLIDATION_20260818_163000`
- Pre-transaction-P0 backup: `backups\_BACKUP_BEFORE_POST_SD_TXN_P0_20260823_221313`

## Current game inventory

| Area | Current runtime state |
|---|---|
| Playable roster | 6 canonical characters (`TRIAD-CHAR-001` through `TRIAD-CHAR-006`) |
| Cards | 126 canonical card records, including 6 signature cards |
| SD bundles | 54 active atlases, 9 clips per character, 84 frames per clip, 4,536 frames total |
| Enemy data | 90 element/rank/act monster records; 18 boss records are included in that catalog |
| Run path | 30 stages, 3 acts, boss stages 10/20/30 |
| Route choices | battle, elite, rest, event, boss |
| Run economy | 8 artifacts; card reward / duplicate level-up / rest / event / elite-boss artifact reward |
| Combat statuses | burn, shock, mark |
| Active runtime screens | home, character select, starting deck, route, combat, reward, history/result |
| Save | active run, history, schema migration, seed and RNG state |

## Legacy excluded from production

The following are retained on disk only for reference and save migration. They are not active dependencies of the canonical runtime:

- character part assembly
- face / clothing / mannequin asset manifests
- `character_assets.js`
- face/hair/top/bottom/outerwear/shoes selection UI

The hidden `#customize` section is explicitly marked `LEGACY_REFERENCE_ONLY`. New runs use only:

`character roster selection → starting deck draft → run map → SD battle`

Legacy visual saves are preserved under `legacyVisual` and migrated to the selected character's canonical full-art/SD identity. No legacy asset was deleted.

## P0 found and fixed

### P0-01 — Canonical root was a split, pre-SD runtime

- Symptom: the required `TRIAD_RUN` root had a 122,155-byte migration HTML and zero roster/SD manifests, while the running six-character SD runtime lived in the older deckbuilder working root.
- Root cause: the SD FINAL source and its active runtime assets were never consolidated into `TRIAD_RUN`.
- Fix: backed up the original root, then copied only the active roster registry, six active manifests/scripts, 54 active atlases, and 1 projectile asset (68 files / 119,874,888 bytes). Historical revision folders and assembly assets were not copied or deleted.
- Verification: `tools/verify_post_sd_game.js` reports 6 characters, 54 atlases, 4,536 frames, zero errors.

### P0-02 — Gameplay used ambient random after save

- Symptom: displayed run seed did not own draft, route, enemy, hit, event, or elite/boss reward randomness because the active HTML directly used `Math.random()`.
- Root cause: the SD runtime fork did not load the existing deterministic `TRIAD_ARCH` adapter.
- Fix: reconnected `src/triad_architecture.js`; draft, route, combat draw, monster pick, damage variance/crit, event, and artifact chance now consume the saved `rngState`. New runs persist `seed`, `rngState`, `rngAlgorithm`, `saveVersion`, and combat-log fields; old saves migrate through `TRIAD_ARCH.migrateSave`.
- Verification: no `Math.random()` remains in canonical HTML. The existing 1,000-seed full-run regression passed.

### P0-03 — KO character cards could remain playable

- Symptom: a character reaching 0 HP could leave that character's cards in the current hand, draw pile, or discard pile, allowing a dead owner to act later in the encounter.
- Root cause: the canonical battle resolver had no owner-liveness gate and did not retire a card owner's combat piles on the alive → KO transition.
- Fix: added `isPlayableOwner`, `retireKoOwnerCards`, a draw-time owner gate, a play-time owner gate, and an alive → KO retirement hook. KO-owner cards move only to that encounter's exhaust pile; run deck data is not removed. Hand cards include `data-card-owner` for runtime QA and cannot retain a click handler if their owner is unavailable.
- Verification: in a normal Stage 3 battle, Ember reached KO after enemy actions. The active hand retained only Volt/Aegis owners (four cards), reported zero KO-owner cards, survived page reload/Continue, and accepted a living owner's card without softlock.

### P0-04 — History replay could create a run without an explicit seed

- Symptom: `같은 조합` restored its roster into a hand-built setup object, but omitted `seed`, `rngState`, and `rngAlgorithm`. The following new run could display an empty seed and lose its replay identity.
- Root cause: replay bypassed the canonical `newSetup()` factory.
- Fix: history replay now creates a fresh canonical setup first, then restores only the validated three-character roster. The new run therefore has a new explicit seed while intentionally requiring a fresh starting-deck draft.
- Verification: `tests/history_replay_seed_contract.test.js` passes, and the Post-SD verifier confirms the replay factory contract together with all 54 active SD atlases.

### P0-05 — Saved route/reward/artifact transitions were not atomic across reload

- Symptom: reload or repeated input around route selection, victory delay, card reward, and event artifact selection could regenerate candidates or replay a stage-side effect.
- Root cause: these transitions had no persisted transaction identity or exactly-once ledger.
- Fix: added `src/triad_transactions.js`, persisted stage-scoped route and reward offers, restored pending transitions before route rendering, and committed route/reward/artifact/stage effects through a serialized exactly-once ledger.
- Verification: route candidates were identical across 10 reloads; reward candidates were identical across 3 reloads; victory-delay reload restored the exact reward; reward and artifact claims remained single after reload.

### P0-06 — Rapid input crossed synchronous rerenders

- Symptom: an actual `턴 종료` double click advanced TURN 1 → 3. A reward double click committed the reward and then clicked a newly rendered Stage 2 route at the same coordinate, starting battle without an intentional route choice.
- Root cause: action tokens protected one rendered control but did not block the second pointer event from landing on a replacement control after synchronous rerender.
- Fix: added one shared 350 ms UI input fence to card play, end turn, route, card reward, and artifact handlers while retaining transaction and action-token validation.
- Verification: end-turn double click now advances one turn only; card double click resolves one card only; reward double click stops at the next route; artifact double click grants one artifact and advances one stage only.

## P1 remaining

1. Exact 390×844 and 844×390 device-emulation captures remain P1. Actual in-app 542×822 portrait-like combat and managed 1280×720 desktop combat were captured and playable without blocked core input.
2. The legacy assembly implementation remains as non-routable source inside the single HTML for compatibility. It is hidden and has no active asset loader, but can be physically extracted to a separate archive only after explicit save-migration retirement.

## P1 fixed

- Battle UI terminology now accurately identifies the player lane as `내 파티 SD` and describes card actions as being performed by the selected characters' SD actors. No SD assets, manifests, or animation mappings changed.
- The offline canonical validator now understands cache-busted script paths and the roster/SD registry, rather than expecting inactive assembly manifests and an obsolete runtime database object. It verifies 126 cards, six roster records, 54 active atlases, 4,536 frames, 90 enemies, and zero missing active roster assets.

## P2 remaining

- Earlier prototype helper definitions remain shadowed by the canonical combat resolver later in the same HTML. They do not change the active flow; remove only during a separately approved, regression-protected code cleanup.

## Deletion

`0` — no failed, legacy, or duplicate asset was deleted during this audit.
