# MANUS Architecture Import Inventory

Inventory date: 2026-08-16

Source root: `D:\AI 종합 폴더\Games\덱빌딩 2\비주얼 턴제 카드 게임 제작 데이터 정리 방법_`

The source was inspected read-only. No Astra Void content or Godot dependency was copied into TRIAD. Archive entries were read in place; the archives were not extracted into the source directory.

## Classification profiles

| Profile | Purpose | Dependencies | Portable? | Runtime verified? | TRIAD usefulness |
| --- | --- | --- | --- | --- | --- |
| A | Seeded state/log/data architecture | Godot concepts only | Concept only | Static only | High; rewrite in TRIAD JavaScript |
| B | Schema/test/manifest concept | JSON/Python/Godot test data | Concept only | Static only | High; rewrite for current IDs and rules |
| C | Astra authored game data | Astra IDs, lore and balance | No | No | None as content |
| D | Astra art/UI/presentation | Astra IP and generated assets | No | Visual file only | None |
| E | Godot project/runtime | Godot 4 scene/autoload APIs | No | Not run | None; engine switch prohibited |
| F | Documentation/reference | Markdown/text | Yes as reference | Claims are static only | Background reference only |
| G | Broken/risky implementation | Ambiguous targeting, requeue, hardcoded path or static-only proof | No | Failing risk review | Negative regression reference |

## Files at source root

| Relative path | Type | Profile | Classification | Notes |
| --- | --- | --- | --- | --- |
| `아스트라 보이드 — 턴제 덱빌딩 카드 게임 제작 데이터 패키지.md` | MD | F | REFERENCE_ONLY | Astra package overview; no content import. |
| `아스트라 보이드 — Godot 4 전투 시스템 스타터.md` | MD | F | REFERENCE_ONLY | Explicitly says Godot runtime was not executed. |
| `아스트라 보이드 제작 데이터 패키지 — 검증 보고서.md` | MD | F | REFERENCE_ONLY | Static validation report, not runtime evidence. |
| `아스트라 보이드 제작 데이터 패키지 — 인도 목록.md` | MD | F | REFERENCE_ONLY | Delivery index only. |
| `astra_void_cardgame_asset_pack.zip` | ZIP | C/D/B | REFERENCE_ONLY | Entries inventoried below; not extracted/imported. |
| `astra_void_godot_battle_starter.zip` | ZIP | A/B/E/G | PORT_CONCEPT | Architectural source; no GDScript copied. |
| `battle_controller.gd` | GDScript | A/E | PORT_CONCEPT | Turn-controller separation only; Astra rules rejected. |
| `battle_smoke_test.gd` | GDScript | B/E | REFERENCE_ONLY | Very small smoke test; insufficient for TRIAD runtime. |
| `effect_resolver.gd` | GDScript | G | BROKEN | Delayed effect stores the delayed wrapper and can requeue forever. |
| `build_asset_pack.py` | Python | C/D/G | REJECT | Astra asset generator; source review found environment-specific generation logic. |
| `finalize_visual_assets.py` | Python | D | REJECT | Astra art processing, unrelated to combat/data migration. |
| `fix_transparency.py` | Python | D | REJECT | Astra art post-processing. |
| `install_godot_battle_starter.py` | Python | E | REJECT | Installs Godot project; engine migration prohibited. |
| `validate_asset_pack.py` | Python | B/C | REFERENCE_ONLY | Validation concept only; authored for Astra package. |
| `validate_godot_starter.py` | Python | G | BROKEN | Hardcoded `/home/ubuntu/cardgame_asset_pack`; string/file existence checks only. |
| `VALIDATION_RESULT.txt` | TXT | G | REFERENCE_ONLY | STATIC_PASS evidence only. |
| `reference_notes.md` | MD | F | REFERENCE_ONLY | Research notes, no runtime authority. |
| `SKILL.md` | MD | F/D | REJECT | Unrelated visual-generation workflow bundled with source. |
| `hero_orion_sable.png` | PNG | D | CONTENT_ONLY | Prohibited Astra character art. |
| `hero_nara_veyl.png` | PNG | D | CONTENT_ONLY | Prohibited Astra character art. |
| `hero_mira_oss.png` | PNG | D | CONTENT_ONLY | Prohibited Astra character art. |
| `cardart_nara_solar_lance.png` | PNG | D | CONTENT_ONLY | Prohibited Astra card art. |
| `boss_clockwork_seraph.png` | PNG | D | CONTENT_ONLY | Prohibited Astra boss art. |
| `bg_noctilucent_rift.png` | PNG | D | CONTENT_ONLY | Prohibited Astra background. |
| `ui_card_frame_solar_alpha.png` | PNG | D | CONTENT_ONLY | Prohibited Astra UI skin. |
| `ui_icon_energy_alpha.png` | PNG | D | CONTENT_ONLY | Prohibited Astra UI asset. |

## `astra_void_godot_battle_starter.zip` file entries

| Archive-relative path | Type | Profile | Classification | Notes |
| --- | --- | --- | --- | --- |
| `godot_battle_starter/Data/game_config.json` | JSON | C | CONTENT_ONLY | Astra combat defaults. |
| `godot_battle_starter/Data/characters.json` | JSON | C | CONTENT_ONLY | Nara/Orion/Mira; prohibited. |
| `godot_battle_starter/Data/statuses.json` | JSON | C | CONTENT_ONLY | Astra status IDs/values. |
| `godot_battle_starter/Data/cards.json` | JSON | C | CONTENT_ONLY | Astra 36-card content. |
| `godot_battle_starter/Data/enemies.json` | JSON | C | CONTENT_ONLY | Astra enemies/bosses. |
| `godot_battle_starter/Data/modules.json` | JSON | C | CONTENT_ONLY | Not mapped to TRIAD relics. |
| `godot_battle_starter/Data/events.json` | JSON | C | CONTENT_ONLY | Not mapped to TRIAD events. |
| `godot_battle_starter/Data/map_nodes.json` | JSON | C | CONTENT_ONLY | Astra map rules. |
| `godot_battle_starter/Data/ui_tokens.json` | JSON | C/D | CONTENT_ONLY | Astra UI skin tokens. |
| `godot_battle_starter/Data/balance_targets.json` | JSON | C | CONTENT_ONLY | Astra balance values. |
| `godot_battle_starter/TestData/battle_scenarios.json` | JSON | B/C | PORT_CONCEPT | Scenario-test form only; data rejected. |
| `godot_battle_starter/TestData/acceptance_checklist.md` | MD | B | PORT_CONCEPT | Test-layer separation concept. |
| `godot_battle_starter/project.godot` | Godot config | E | REJECT | Godot dependency prohibited. |
| `godot_battle_starter/Scenes/BattleDemo.tscn` | Godot scene | E | REJECT | Godot UI/scene tree prohibited. |
| `godot_battle_starter/Scripts/Data/game_database.gd` | GDScript | A/E | PORT_CONCEPT | ID indexing and clone-on-read concept only. |
| `godot_battle_starter/Scripts/Combat/battle_unit.gd` | GDScript | A/E | PORT_CONCEPT | Runtime/template separation concept only. |
| `godot_battle_starter/Scripts/Combat/battle_state.gd` | GDScript | A/E | PORT_CONCEPT | Seeded state/log/snapshot concept; rewritten. |
| `godot_battle_starter/Scripts/Combat/targeting.gd` | GDScript | G | BROKEN | Actor-relative `ally/enemy` names are ambiguous for enemy intents. |
| `godot_battle_starter/Scripts/Combat/effect_resolver.gd` | GDScript | G | BROKEN | Delayed wrapper requeues itself; runtime completeness gaps. |
| `godot_battle_starter/Scripts/Combat/battle_controller.gd` | GDScript | A/E | PORT_CONCEPT | Controller/log separation only. |
| `godot_battle_starter/Scripts/Presentation/battle_demo.gd` | GDScript | E | REJECT | Godot presentation implementation. |
| `godot_battle_starter/Tests/battle_smoke_test.gd` | GDScript | B/E | REFERENCE_ONLY | One authored smoke flow; not runtime-verified in source. |
| `godot_battle_starter/README.md` | MD | F | REFERENCE_ONLY | Architecture description and static-only limitation. |
| `godot_battle_starter/VALIDATION_RESULT.txt` | TXT | G | REFERENCE_ONLY | File/string validation only. |
| `godot_battle_starter/FILE_INDEX.txt` | TXT | F | REFERENCE_ONLY | Archive index. |

## `astra_void_cardgame_asset_pack.zip` file entries

| Archive-relative path | Type | Profile | Classification | Notes |
| --- | --- | --- | --- | --- |
| `research/reference_notes.md` | MD | F | REFERENCE_ONLY | Research only. |
| `data/game_config.json` | JSON | C | CONTENT_ONLY | Astra configuration. |
| `data/characters.json` | JSON | C | CONTENT_ONLY | Astra characters. |
| `data/statuses.json` | JSON | C | CONTENT_ONLY | Astra statuses. |
| `data/cards.json` | JSON | C | CONTENT_ONLY | Astra cards. |
| `data/enemies.json` | JSON | C | CONTENT_ONLY | Astra enemies. |
| `data/modules.json` | JSON | C | CONTENT_ONLY | Astra modules. |
| `data/events.json` | JSON | C | CONTENT_ONLY | Astra events. |
| `data/map_nodes.json` | JSON | C | CONTENT_ONLY | Astra route content. |
| `data/ui_tokens.json` | JSON | C/D | CONTENT_ONLY | Astra UI skin. |
| `data/balance_targets.json` | JSON | C | CONTENT_ONLY | Astra balance values. |
| `schemas/card.schema.json` | JSON Schema | B | PORT_CONCEPT | Validation pattern only; rewritten for TRIAD. |
| `schemas/status.schema.json` | JSON Schema | B | PORT_CONCEPT | Validation pattern only; rewritten for TRIAD. |
| `docs/01_game_design.md` | MD | C/F | REFERENCE_ONLY | Astra design. |
| `docs/02_combat_resolution.md` | MD | C/F | REFERENCE_ONLY | Astra rule resolution. |
| `docs/03_card_catalog.md` | MD | C | CONTENT_ONLY | Astra card catalog. |
| `docs/04_art_direction.md` | MD | D | CONTENT_ONLY | Astra art direction. |
| `docs/05_animation_spec.md` | MD | B/D | PORT_CONCEPT | Cue separation concept only. |
| `docs/06_integration_guide.md` | MD | F | REFERENCE_ONLY | Astra integration guide. |
| `docs/07_validation_report.md` | MD | G | REFERENCE_ONLY | Static report, not runtime evidence. |
| `art/prompts/visual_brief.md` | MD | D | CONTENT_ONLY | Astra visual brief. |
| `art/generated/hero_orion_sable.png` | PNG | D | CONTENT_ONLY | Prohibited. |
| `art/generated/hero_nara_veyl.png` | PNG | D | CONTENT_ONLY | Prohibited. |
| `art/generated/ui_icon_energy_alpha.png` | PNG | D | CONTENT_ONLY | Prohibited. |
| `art/generated/bg_noctilucent_rift.png` | PNG | D | CONTENT_ONLY | Prohibited. |
| `art/generated/hero_mira_oss.png` | PNG | D | CONTENT_ONLY | Prohibited. |
| `art/generated/boss_clockwork_seraph.png` | PNG | D | CONTENT_ONLY | Prohibited. |
| `art/generated/ui_card_frame_solar_alpha.png` | PNG | D | CONTENT_ONLY | Prohibited. |
| `art/generated/cardart_nara_solar_lance.png` | PNG | D | CONTENT_ONLY | Prohibited. |
| `art/asset_manifest.csv` | CSV | B/D | PORT_CONCEPT | Manifest concept only; Astra rows rejected. |
| `art/generated_asset_manifest.json` | JSON | D | CONTENT_ONLY | Astra generated asset records. |
| `art/generated_asset_manifest.csv` | CSV | D | CONTENT_ONLY | Astra generated asset records. |
| `art/README.md` | MD | F/D | REFERENCE_ONLY | Astra art package notes. |
| `animations/animation_manifest.json` | JSON | B | PORT_CONCEPT | Presentation-cue separation concept only. |
| `animations/vfx_sfx_cue_sheet.csv` | CSV | B | PORT_CONCEPT | VFX/SFX cue-sheet concept only. |
| `tests/battle_scenarios.json` | JSON | B/C | PORT_CONCEPT | Scenario structure only; content rejected. |
| `tests/acceptance_checklist.md` | MD | B | PORT_CONCEPT | Acceptance-level separation concept. |
| `build_asset_pack.py` | Python | C/D/G | REJECT | Astra generator, not used by TRIAD. |
| `README.md` | MD | F | REFERENCE_ONLY | Package overview. |
| `package_manifest.json` | JSON | F | REFERENCE_ONLY | Package metadata only. |
| `file_inventory.txt` | TXT | F | REFERENCE_ONLY | Package index. |
| `finalize_visual_assets.py` | Python | D | REJECT | Astra art processor. |
| `fix_transparency.py` | Python | D | REJECT | Astra art processor. |
| `validate_asset_pack.py` | Python | B/C | REFERENCE_ONLY | Validation concept only. |
| `checksums.sha256` | TXT | F | REFERENCE_ONLY | Astra archive integrity. |
| `DELIVERY_INDEX.md` | MD | F | REFERENCE_ONLY | Delivery index. |

## Selected technical imports

- Explicit TargetSpec with source team and target team separated.
- Seeded RNG state persisted in saves.
- Machine-readable effect registry and validation API.
- Combat log and battle snapshot API.
- ScheduledEffect that removes due entries before resolution.
- Layered static/unit/headless/runtime/visual QA reporting.

No Astra names, rules, values, art, cards, characters, enemies, modules, events, UI skin or Godot files were imported.
