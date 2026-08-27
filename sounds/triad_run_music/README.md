# TRIAD // RUN Selected Music

This folder contains only the 21 tracks reserved for TRIAD // RUN. They were moved out of `sounds/roguelike_rpg_audio_pack`; the 99 unselected tracks remain in that source pack.

Files originally named `.wav` contained MP3 frame data. They were moved without lossy re-encoding and renamed to `.mp3` so the extension matches the real codec.

## Assignment

- Title/loading: `Below the Broken Moon`
- Ending: `The Run Becomes a Story`
- Stage groups: 10 tracks under `stage/`, changing every five stages and cycling after stage 50
- Setup and history screens: 4 tracks under `ui/`
- Meta tabs: 5 tracks under `ui/` for recruitment, character breakthrough, growth items, card shop, and card upgrades

The authoritative runtime mapping, volume, looping, and crossfade behavior live in `src/triad_audio_director.js`.
