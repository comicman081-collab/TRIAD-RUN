# TRIAD Data Schema

Schema version: `TRIAD_RUNTIME_V0_8`  
Save version: `2`

This document describes the machine-readable architecture contract added around the current JavaScript runtime. Existing card IDs, values and appearance records remain unchanged.

## TargetSpec

```json
{
  "sourceTeam": "PLAYER",
  "targetTeam": "ENEMY",
  "scope": "SINGLE",
  "selector": "LOWEST_HP",
  "count": 1,
  "allowDead": false,
  "allowSelf": false,
  "explicitTargetId": null,
  "filters": []
}
```

Required enums:

- `sourceTeam`, `targetTeam`: `PLAYER | ENEMY`
- `scope`: `SINGLE | ALL`
- `selector`: `SELF | EXPLICIT | FIRST | RANDOM | LOWEST_HP`

Actor-relative `ally` and `enemy` are invalid canonical selectors. The runtime enemy intent uses `sourceTeam: ENEMY`, `targetTeam: PLAYER` explicitly.

## EffectSpec

```json
{
  "type": "DAMAGE",
  "amount": 8,
  "target": {
    "sourceTeam": "PLAYER",
    "targetTeam": "ENEMY",
    "scope": "SINGLE",
    "selector": "FIRST"
  },
  "statusId": null,
  "payload": {}
}
```

Registered types:

`DAMAGE`, `SHIELD`, `HEAL`, `DRAW`, `DISCARD`, `APPLY_STATUS`, `REMOVE_STATUS`, `MODIFY_ENERGY`, `MULTI_HIT`, `CONDITIONAL`, `CHAIN`, `RANDOM_TARGET`, `SCALE`, `REPEAT`, `SCHEDULE`.

Natural-language phrases are not effect types. The current card switch is protected by an adapter that maps all 21 current card patterns to registered machine-readable categories before executing preserved legacy behavior.

## ScheduledEffect

```json
{
  "id": "triad-generated-id",
  "executeAtTurn": 2,
  "executeAtPhase": "PLAYER_START",
  "resolvedEffect": { "type": "DRAW", "amount": 2 },
  "sourceId": "EMBER",
  "targetSpec": {
    "sourceTeam": "PLAYER",
    "targetTeam": "PLAYER",
    "scope": "SINGLE",
    "selector": "SELF"
  },
  "payload": {}
}
```

`resolvedEffect.type` may not be `SCHEDULE`. Due entries are removed from the queue before the normal effect is resolved, so execution cannot requeue the wrapper implicitly.

## BattleSnapshot

Required replay state:

- game/data/save versions
- seed, RNG algorithm and RNG state
- stage, turn and phase
- party HP/shield/status-bearing runtime records
- deck, draw pile, discard pile and hand
- artifacts
- enemy state
- scheduled effects

Snapshots use stable key ordering and an FNV-1a hash for deterministic comparison.

## CombatLog record

```json
{
  "sequence": 1,
  "seed": 99173,
  "stage": 4,
  "turn": 2,
  "phase": "COMBAT",
  "rngState": 123456789,
  "kind": "DAMAGE",
  "actor": "EMBER",
  "card": "EMBER_01",
  "effect": "DAMAGE",
  "target": "EMBER_M01",
  "damage": 12
}
```

Runtime hooks record run start, route, event, battle start/result, turn start, draw, card play, energy delta, damage, heal, shield, enemy action, artifact and reward.

## SaveSpec v2

```json
{
  "saveVersion": 2,
  "dataVersion": "TRIAD_RUNTIME_V0_8",
  "seed": 99173,
  "rngAlgorithm": "mulberry32-v1",
  "rngState": 99173,
  "combatLog": [],
  "scheduledEffects": []
}
```

Migration is additive. Existing party, CORE IDs, appearance/visual records, deck/card levels, artifacts, path, combat, stats and history fields are cloned and retained.

## Validation rules

- unique and non-empty record IDs
- valid card owner
- registered effect type
- explicit valid target enums
- valid status references
- non-negative finite card cost and effect amount
- finite non-negative character/enemy numeric values
- existing runtime scripts and local assets
- card-art presence for all 126 current cards
- no runtime network fetch/CDN requirement
- no gameplay `Math.random` in runtime entry, combat data or card data

The validation core exposes character/card/status/artifact/enemy/boss/event collections. Full authored JSON extraction remains deferred; current JS records are validated in place.
