# TRIAD // RUN Combat VFX Asset Audit — V2

Date: 2026-08-28  
Scope: existing repository assets only. No image generation, image editing, external image service, or replacement art is used.

## Audit result

- `assets/vfx/gpt_web_v1/` contains 20 production VFX source images.
- Every source is a single high-resolution PNG with PNG colour type 6 (RGBA): alpha is confirmed.
- The V1 runtime reduced every source to a single `img` whose normal display range was `132–278px`; travel had no authored charge, wake, contact, rupture, or residual phase.
- The V2 runtime retains those exact source files as the dominant silhouette. CSS/DOM layers provide only supporting charge, wake, flash, shockwave, fragments, and afterglow.
- The authored source image is no longer hue-rotated at runtime. Element identity is expressed by restrained supporting motes, wakes, and residual fragments so the original art's material detail remains readable.
- The 28 `assets/characters/roster/**/sd/**/{skill,ultimate}*.webp` files are separate 84-frame character-pose atlases. They remain owned by the SD actor renderer and are not substituted for, or used as, combat projectile artwork.

## High-resolution combat VFX authority

| Source path | Resolution | Alpha | Source type | Current V2 usage and display treatment |
| --- | ---: | --- | --- | --- |
| `assets/vfx/gpt_web_v1/vfx_projectile.png` | 1774×887 | RGBA | Single authored horizontal projectile | P0 projectile cards; normal Scout/Caster/Hunter and elite Vanguard-style shots. Main silhouette is `230–520px` wide, with 150ms charge, short irregular wake blobs, 547–634ms contact, then authored impact rupture. |
| `assets/vfx/gpt_web_v1/vfx_impact.png` | 1254×1254 | RGBA | Single authored impact | P0 projectile contact and P0/P1 heavy-impact contact. `220–430px` contact silhouette; used as authored rupture layer, not a procedural replacement. |
| `assets/vfx/gpt_web_v1/vfx_burn.png` | 1184×1328 | RGBA | Single authored elemental impact | Inferno heavy-impact main silhouette, with pre-flash, contact, authored rupture, debris, and afterglow. |
| `assets/vfx/gpt_web_v1/vfx_shock.png` | 1254×1254 | RGBA | Single authored elemental impact | Overload and electrical heavy-impact main silhouette. |
| `assets/vfx/gpt_web_v1/vfx_mark.png` | 1254×1254 | RGBA | Single authored lock-on/mark | Support/debuff visual authority; ranged Mark uses projectile travel plus its authored mark profile at contact. |
| `assets/vfx/gpt_web_v1/vfx_shield.png` | 1254×1254 | RGBA | Single authored defensive effect | Guard, Bastion, Counter, and Aegis support; full-party zone treatment remains separate from offensive contact. |
| `assets/vfx/gpt_web_v1/vfx_heal.png` | 1254×1254 | RGBA | Single authored healing effect | Heal/Renewal and Bloom support; full-party zone treatment remains separate from offensive contact. |
| `assets/vfx/gpt_web_v1/vfx_ultimate.png` | 1254×1254 | RGBA | Single authored finisher fallback | Generic non-signature finisher fallback, V2 Ultimate sequence. |
| `assets/vfx/gpt_web_v1/vfx_signature_ember.png` | 1254×1254 | RGBA | Single authored signature finisher | Ember P0 finisher; large core formation, 52% hit confirm, 76-fragment capped rupture, local field feedback. |
| `assets/vfx/gpt_web_v1/vfx_signature_bloom.png` | 1254×1254 | RGBA | Single authored signature/support finisher | Bloom signature/support authority. |
| `assets/vfx/gpt_web_v1/vfx_signature_aegis.png` | 1254×1254 | RGBA | Single authored signature/support finisher | Aegis signature/support authority. |
| `assets/vfx/gpt_web_v1/vfx_signature_shade.png` | 1536×1024 | RGBA | Single authored signature finisher | Shade P0 finisher. |
| `assets/vfx/gpt_web_v1/vfx_signature_volt.png` | 1672×941 | RGBA | Single authored signature finisher | Volt P0 finisher. |
| `assets/vfx/gpt_web_v1/vfx_signature_rift.png` | 1254×1254 | RGBA | Single authored signature finisher | Rift P0 finisher. |
| `assets/vfx/gpt_web_v1/vfx_elite_vanguard.png` | 1672×941 | RGBA | Single authored elite projectile | Elite Vanguard P0 projectile main silhouette. |
| `assets/vfx/gpt_web_v1/vfx_elite_reaper.png` | 1536×1024 | RGBA | Single authored elite impact | Elite Reaper P0 heavy impact. |
| `assets/vfx/gpt_web_v1/vfx_elite_colossus.png` | 1672×941 | RGBA | Single authored elite quake | Elite Colossus P0 heavy impact/quake. |
| `assets/vfx/gpt_web_v1/vfx_boss_apostle.png` | 1122×1402 | RGBA | Single authored boss finisher | Apostle P0 Ultimate sequence. |
| `assets/vfx/gpt_web_v1/vfx_boss_overmind.png` | 1536×1024 | RGBA | Single authored boss finisher | Overmind P0 Ultimate sequence. |
| `assets/vfx/gpt_web_v1/vfx_boss_sovereign.png` | 1672×941 | RGBA | Single authored boss finisher | Sovereign P0 Ultimate sequence. |

## V2 pipeline and timing

### A. Projectile / energy shot

The authoritative `vfx_projectile.png` / `vfx_elite_vanguard.png` remains sharp and visible throughout motion. The V2 controller adds a 150ms charge core with seven inward motes, a release pulse, seven to nine short-lived irregular wake blobs, directional mirroring for enemy-to-player shots, contact at the same authored presentation time as the damage/SFX, an authored impact source, 46 capped irregular fragments, and an eight-mote afterglow.

### B. Heavy impact

Heavy cards and non-projectile melee/quake enemies do not reuse the projectile routine. They use a 210–260ms local pre-flash, then show the assigned high-resolution impact source at maximum readability, a short local contact kick, 36–40 capped blob/shard/lump fragments, and afterglow. Damage timing is aligned to the contact time; no damage value, RNG, cost, or card effect changes.

### C. Ultimate / finisher

Signatures and bosses retain their dedicated high-resolution art. V2 adds activation charge, a local darkening field limited to the battle stage, hit confirmation at 52% of the authored duration, local contact feedback, an authored impact follow-up, 76 capped mixed fragments, and a longer 620ms afterglow. HUD-wide whiteout and long global shaking are intentionally avoided.

## Enemy and boss coverage

| Combatant class | Archetypes | Pipeline | Authored main source | Distinct presentation treatment |
| --- | --- | --- | --- | --- |
| Normal ranged monster | Scout, Caster, Hunter | Projectile | `vfx_projectile.png` | Each has independent timing/profile: fast needle (Scout), slower charged orb (Caster), compressed hunter shot (Hunter). Enemy travel is mirrored so it faces the allied formation. |
| Normal melee/area monster | Hound, Warden, Brute, Weaver, Ravager, Sentinel | Heavy impact | Each assigned V1 impact/elemental source | Local anticipation, contact impact, restrained shockwave, mixed blob/shard/lump debris. They do not launch a character cutout or a generic travel image. |
| Elite projectile | Vanguard | Projectile | `vfx_elite_vanguard.png` | Dedicated wide elite source silhouette, siege timing, higher emphasis, actor-facing mirrored travel. |
| Elite heavy/quake | Reaper, Colossus | Heavy impact | `vfx_elite_reaper.png`, `vfx_elite_colossus.png` | Dedicated high-resolution heavy source, 260ms contact, P0 fragment/afterglow profile. |
| Boss finisher | Apostle, Overmind, Sovereign | Ultimate | Corresponding `vfx_boss_*.png` | 12-mote formation, stage-local darken, 52% hit confirmation, local kick, 76 capped mixed fragments and longer decay. |

This mapping is intentionally presentation-only: it selects visual timing and source art after the existing combat action has already been determined. It does not change the monster action, target, damage, status, RNG, or turn sequence.

## Performance and cleanup policy

- There is no Canvas primitive that substitutes for a combat VFX source image.
- Supporting particles are DOM nodes with CSS animations; they do not create gradients, canvas objects, or filters per animation frame.
- Projectile wake: 7–9 nodes. Charge: 7 nodes (12 for Ultimate). Afterglow: 8 nodes.
- Rupture is capped globally at 160 live fragments. Normal projectile uses 46; heavy uses 36–40; Ultimate uses 76 where capacity permits.
- Every created node has a deterministic timeout cleanup. Fragment capacity is released at cleanup.
- Existing damage/RNG/card/monster logic is unchanged. `contactMs` is presentation timing only and is consumed by the existing HP/SFX/impact scheduler.

## Acceptance boundary

Automated checks verify mapping, timing wiring, source availability, direction handling, cap/cleanup wiring, and no legacy SD-character projectile renderer. Runtime captures are retained under `qa_artifacts/combat_vfx_v2/` for actual battle playback evidence; browser console inspection found no warnings or errors during the projectile/support/monster-turn walkthrough.

They do not constitute final visual acceptance. Runtime capture and user review remain required before a public visual PASS claim.
