"""Create deterministic 84-frame SD atlases from the approved Seraph 3x3 keypose sheet."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/characters/roster/TRIAD-CHAR-007/sd/source_generation/gpt_web_v4_keyposes/seraph_v4_9pose_contact.png'
OUT = ROOT / 'assets/characters/roster/TRIAD-CHAR-007/sd/revisions/r001_gpt_web_v4_keypose_atlases'
CLIPS = ('enter', 'idle', 'attack', 'skill', 'ultimate', 'guard', 'hit', 'ko', 'victory')

def main():
    sheet = Image.open(SOURCE).convert('RGBA')
    OUT.mkdir(parents=True, exist_ok=True)
    cell_w, cell_h = sheet.width // 3, sheet.height // 3
    for index, clip in enumerate(CLIPS):
        target = OUT / f'seraph_{clip}_r001_84f.webp'
        if target.is_file() and target.stat().st_size > 0:
            continue
        x, y = index % 3, index // 3
        pose = sheet.crop((x * cell_w, y * cell_h, (x + 1) * cell_w, (y + 1) * cell_h)).resize((512, 512), Image.Resampling.LANCZOS)
        atlas = Image.new('RGBA', (512 * 12, 512 * 7), (0, 0, 0, 0))
        for frame in range(84): atlas.alpha_composite(pose, ((frame % 12) * 512, (frame // 12) * 512))
        atlas.save(target, 'WEBP', lossless=True, method=6)

if __name__ == '__main__': main()
