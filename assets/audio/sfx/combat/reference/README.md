# TRIAD combat SFX — public CC0 field-recording edition

The 42 runtime files in this directory replace the earlier procedural reference
layers. They are edited derivatives of public-domain/CC0 source packs that allow
commercial use and redistribution. Attribution is not legally required, but the
original recordists and designers are credited below.

## Sources and licence evidence

| Runtime role | Public source | Creator(s) | Source quality | Archive SHA-256 |
| --- | --- | --- | --- | --- |
| Pistol, rifle, automatic, shotgun, heavy-rifle fire | [The Free Firearm Sound Library](https://opengameart.org/content/the-free-firearm-sound-library) | Ben Jaszczak, Brian Nelson, Kevin Heras, Matthew Nanney | Real firearm field recordings, 96 kHz / 24-bit / stereo | `cc1ab5a99a0a365105c7c5dd783f4b0b1fe90938114d3ceec53856bfe005f7d6` |
| Metal, armor, heavy and shield impacts | [Medieval sound effects — Weapon impacts](https://opengameart.org/content/medieval-sound-effects-weapon-impacts) | Ben Jaszczak, Brian Nelson | Real weapon-on-weapon recordings, 192 kHz / 24-bit / mono | `27a854442ecfc51102dc023bb3ff462fe1bc6b895b39b2f63a54cccf1e8e6ea9` |
| Projectile travel, explosions and mechanical destruction | [Action Game/SHMUP SFX Pack](https://opengameart.org/content/action-gameshmup-sfx-pack) | RUOK | Designed source WAV, 96 kHz / 16-bit / stereo | `fd0523764e0d644bea12c0839ce5052a8dfcd136f701c30dfc565de72d506aa3` |

All three OpenGameArt source pages designate the downloads as
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). The exact source
file, archive hash, source-file hash, trim window, processing recipe and output
hash for every A/B/C variant are recorded in `reference/provenance`.

## Processing

The import pipeline is `tools/audio/import_public_cc0_combat_sfx.js`. It performs
only deterministic game-ready editing:

- isolates one authored shot, burst or impact from the original recording;
- band-limited resampling to 48 kHz;
- conservative peak normalization and a short tail fade;
- 24-bit PCM WAV output without synthetic replacement of the source transient.

The runtime keeps recorded automatic bursts as one asset rather than stacking
multiple burst files. Individual hit timing remains separate, so the muzzle blast,
projectile travel and direct character/monster contact still align with combat VFX.

## Runtime mapping

- `quick`, `ambush`: real handgun recordings
- `strike`, `combo`: real rifle recordings
- `volley`, `burst`: authored real short/automatic bursts
- `heavy`, `execute`: real 12-gauge/heavy-rifle recordings
- normal contact: real blade/metal and weapon/armor strikes
- blocked contact: real weapon/hilt strikes
- heavy, boss and defeat contact: high-resolution explosion/destruction layers

`tests/combat_sfx_contract.test.js` verifies the processed hashes, format,
duration, level limits, CC0 evidence and source archive hashes so none of these
assets can silently drift or lose provenance.
