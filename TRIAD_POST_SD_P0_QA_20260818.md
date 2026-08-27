# TRIAD // RUN — Post-SD P0 QA

Date: 2026-08-18  
Test surface: canonical HTML served from `D:\AI 종합 폴더\Games\TRIAD_RUN` at `127.0.0.1:4174` in the existing in-app browser tab.

## Automated regression

| Gate | Result |
|---|---|
| `node tools/verify_post_sd_game.js` | PASS — 6 characters / 54 atlases / 4,536 frames / 0 errors |
| `node tools/validate_triad_arch.js` | PASS — 126 cards / 6 roster records / 54 atlases / 4,536 frames / 90 enemies |
| `node tests/triad_architecture.test.js` | PASS — deterministic RNG, target contracts, scheduled effects, save migration, data validation, snapshots |
| `node tests/full_run_simulation.js` | PASS — 1,000 deterministic seed pairs, 30 stages each, 0 invalid targets, 0 softlocks, 0 non-finite values |
| Canonical HTML parse | PASS |
| Active assembly loader | PASS — 0 active loaders |
| Ambient RNG in canonical HTML | PASS — 0 occurrences |
| KO owner-card protection | PASS — owner liveness gate, pile retirement, and disabled-card contract verified |
| History replay seed contract | PASS — replay restores roster only after creating a fresh seeded setup |
| Victory/event reward transition contract | PASS — card offer, artifact offer, and transition state persist before the victory delay or event modal opens |
| Route offer persistence contract | PASS — visible choices are saved by stage and only a presented route can be selected |
| Rapid input fence contract | PASS — card/end-turn/route/reward/artifact handlers share one cross-rerender fence |
| Failure-injection evidence | PASS — `reports/POST_SD_P0_FAILURE_INJECTION_20260823.json` |

## Normal-user E2E

1. New Game opened the roster screen.
2. Selected `TRIAD-CHAR-001` Ember, `TRIAD-CHAR-002` Volt, and `TRIAD-CHAR-003` Aegis in order.
3. The direct button read `3명 확정 → 시작 카드`; no assembly or appearance screen opened.
4. Selected exactly 5 of 8 starting cards and entered the run map.
5. Stage 1 battle rendered all three left-lane, right-facing SD actors.
6. A normal card changed Ember from `enter` to `attack`, reduced enemy HP, and spent energy.
7. End Turn produced an enemy action and Volt's actual `hit` SD state.
8. Ember's signature card triggered the final attack, then `STAGE CLEAR` card reward.
9. Accepted a reward; the run advanced to Stage 2 with deck count increased from 8 to 9.
10. Reloaded the page and used Continue; Stage 1 combat restored exact visible state from the pre-reload save: turn, energy, draw/discard, enemy HP, hand, and actor SD states.
11. In a normal Stage 3 battle with no defensive card play, enemy actions reduced Ember to 0 HP while Volt and Aegis remained alive.
12. Ember's hand/draw/discard cards were removed from the encounter and moved to exhaust. The active hand contained only `VOLT` / `AEGIS` ownership (four cards); KO-owner DOM cards: `0`.
13. Reload → Continue preserved Ember KO, the living-owner-only hand, and the ongoing combat state.
14. A living Volt card was playable after the KO: energy spent, Volt entered `skill`, and the encounter remained responsive.
15. The history replay path is protected by `history_replay_seed_contract.test.js`: it must call `newSetup()` before restoring the roster, preventing a new run with an empty seed/RNG state.

## Follow-up P0 closure — saved transition integrity

16. `winCombat()` now stores its deterministic card-reward offer and any artifact offer before clearing combat or starting the 2.85-second victory presentation. A reload in that interval restores the pending reward instead of returning to the same stage.
17. Event artifact offers use the same serializable pending-transition contract. Reloading during the modal restores the exact offer; selecting or skipping it completes the stage once.
18. Route choices are now stored in `run.routeOffer` for the current stage. Continue reuses those exact choices without consuming new RNG, and a route action is rejected unless it was visible to the player. The old header shortcut that could turn a boss-only node into a normal battle was removed.

The transition contracts are exercised by `tests/reward_transition_contract.test.js`, `tests/route_offer_persistence_contract.test.js`, `tests/combat_input_fence_contract.test.js`, and actual in-app replay/failure injection on 2026-08-23.

## 2026-08-23 actual in-app failure injection

1. Route offer reload: 10/10 identical.
2. Turn-end double click: before fix TURN 1→3; after fix TURN 3→4.
3. Card double click: one card resolved, hand −1, discard +1.
4. Final hit followed by late End Turn: no extra turn; all living actors entered `victory`.
5. Reload during the victory delay: exact pending card reward restored.
6. Reward candidates: identical across 3 reloads.
7. Reward double click: before fix clicked through into Stage 2 battle; after fix stopped on Stage 2 route with deck 9.
8. Event artifact double click: exactly one artifact, Stage 3, preserved after reload.
9. Volt KO on Turn 10: Volt-owned cards observed in Turns 11–13 = 0.
10. Continue double click: Turn 13 and the same combat state restored with no duplicated action.

## Runtime diagnostics

- New console errors: 0
- New console warnings: 0
- Broken images observed: 0 across 11 active/retained DOM images
- Current active SD state labels observed: `enter`, `idle`, `attack`, `skill`, `ultimate`, `guard`, `hit`, `ko`, `victory`
- Actual SD canvases: `loadStatus=PASS`, `battleLane=LEFT`, `facing=RIGHT`
- SD terminal hold contracts: verified statically for `ko` and `victory` on all six manifests

## Visual captures

- `reports/POST_SD_P0_RUNTIME_1280x720_20260823.png`
- `reports/POST_SD_P0_RUNTIME_PORTRAIT_20260823.png` (actual in-app viewport 542×822)

## Result

`POST_SD_GAME_P0: PASS`

No asset generation, SD re-generation, character part work, or file deletion occurred.
