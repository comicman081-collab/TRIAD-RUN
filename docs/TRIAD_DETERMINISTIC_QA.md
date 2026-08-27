# TRIAD Deterministic QA

## Commands

```powershell
node tools\validate_triad_arch.js
node tests\triad_architecture.test.js
node tests\full_run_simulation.js 1000
node tools\build_standalone.js
```

## Validation levels

| Level | Result | Evidence |
| --- | --- | --- |
| STATIC | PASS | Runtime syntax, local script/assets, counts, finite data, offline contract and RNG guard. |
| UNIT | PASS | RNG, targeting in four directions, schedule once, save migration, effect schema, database errors and snapshot hash. |
| HEADLESS MODEL | PASS | 1,000 deterministic pairs × 30 stages; invalid target 0, softlock 0, non-finite 0. |
| RUNTIME | UNVERIFIED | In-app browser policy rejected local `file://` navigation. No bypass attempted. |
| VISUAL | UNVERIFIED | No browser/mobile screen was rendered. |

## Determinism contract

Gameplay randomness is sourced from the persisted run/setup context:

- starting draft shuffle
- deck shuffle and draw order
- route choices
- event roll
- artifact/reward rolls
- enemy selection
- random player target
- player/enemy damage variance and critical roll

`combat_data.js` requires an injected RNG and has no ambient fallback. UI-only entropy is used only to create a new seed or non-gameplay identifier before the run RNG exists.

## Regression results

Targeting:

- Player → Enemy: single, all, lowest HP and random passed.
- Player → Player: self, all allies and lowest HP passed.
- Enemy → Player: single, all, lowest HP and random passed.
- Enemy → Enemy: lowest HP buff/heal-style selection passed.

Delayed effect:

```text
scheduled = 1
executed = 1
remaining = 0
turn 3 re-execution = 0
```

Save migration:

- unversioned save treated as v1
- v1 → v2 adds RNG/log/schedule/data-version fields
- deck, card level, artifacts and appearance records preserved exactly in unit fixture

Content parity baseline:

| Item | Before | After | Loss |
| --- | ---: | ---: | ---: |
| CORE | 6 | 6 | 0 |
| Cards | 126 | 126 | 0 |
| Artifacts | 8 | 8 | 0 |
| Status counters | 3 | 3 | 0 |
| Enemy records | 90 | 90 | 0 |
| Appearance files | 951 | 951 verified at target paths | 0 |
| Appearance manifest | 127 records / 87 active | missing 0 / duplicates 0 | 0 |
| Runtime assets | 1,500 | 1,500 verified at target paths | 0 |

## Interpretation limits

The 1,000-seed test is a deterministic scripted structural policy using current TRIAD combat/enemy data, not a claim that the browser UI automatically played every existing card. Therefore it proves deterministic state progression and target safety at the headless model layer, while actual browser input, localStorage continue flow, mobile layout and visual rendering remain unverified.
