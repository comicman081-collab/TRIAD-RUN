# Rejected Manus Imports

## Content rejected

- Astra Void title, IP, lore and worldbuilding.
- Nara, Orion and Mira identities, designs, passives and art.
- Astra cards, 36-card set, balance values, status values, enemies, bosses and boss phases.
- Astra modules, events and map content.
- Astra UI skin, icons, frames, backgrounds, prompts and generated art.
- Astra fixed three-character party assumptions as a rule source.

## Technology rejected

- Godot project settings, scene tree, autoloads and GDScript implementation.
- Actor-relative target strings such as `ally` and `enemy` as the canonical target schema.
- Delayed effects that store and later resolve the delayed wrapper itself.
- File/string existence validation presented as runtime proof.
- Hardcoded `/home/ubuntu/cardgame_asset_pack` paths.
- Natural-language effect descriptions treated as executable effects.
- Direct mapping of Astra modules to TRIAD artifacts or Astra events to TRIAD events.

## Deferred, not rejected

- Full external JSON extraction: deferred until parity can be tested in the interactive runtime.
- Full card switch replacement by EffectRegistry: registry adapter is active; behavior ownership remains with the existing switch.
- Full status lifecycle rewrite and cue manifest migration: current working rules/presentation are preserved.

## DELETE_CANDIDATES

Nothing was deleted. `D:\AI 종합 폴더\Games\TRIAD_RUN\assets\assets` is an accidental duplicate staging level created before the correct asset path was restored. It is a delete candidate only; it remains untouched.
