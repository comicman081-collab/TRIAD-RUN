"""Build a review-only contact sheet from canonical lobby and background assets.

This does not generate or alter production art. It makes a single visual
inventory artifact for human/GPT review before any future asset promotion.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "reports" / "QA_MVP_VISUAL_INVENTORY_20260825.png"

LOBBY = [
    ("EMBER", "assets/characters/roster/TRIAD-CHAR-001/lobby/ember_lobby_rgba_v8_registered.png"),
    ("VOLT", "assets/characters/roster/TRIAD-CHAR-002/lobby/volt_lobby_rgba_v10_registered.png"),
    ("AEGIS", "assets/characters/roster/TRIAD-CHAR-003/lobby/aegis_lobby_rgba_v13_registered.png"),
    ("SHADE", "assets/characters/roster/TRIAD-CHAR-004/lobby/shade_lobby_rgba_v3_registered.png"),
    ("BLOOM", "assets/characters/roster/TRIAD-CHAR-005/lobby/bloom_lobby_rgba_v6_registered.png"),
    ("RIFT", "assets/characters/roster/TRIAD-CHAR-006/lobby/rift_lobby_rgba_v5_registered.png"),
]

BACKGROUNDS = [
    ("01 BLACK RAIN", "assets/battle_backgrounds/stage01_b_black_rain_avenue.png"),
    ("02 UNDERPASS", "assets/battle_backgrounds/stage02_b_drowned_underpass.png"),
    ("03 TURBINE", "assets/battle_backgrounds/stage03_b_ruined_turbine_hall.png"),
    ("04 ORCHARD", "assets/battle_backgrounds/stage04_b_eclipse_orchard.png"),
    ("05 NAVE", "assets/battle_backgrounds/stage05_b_shattered_nave.png"),
    ("06 DAM", "assets/battle_backgrounds/stage06_b_frozen_dam.png"),
    ("07 MEGABRIDGE", "assets/battle_backgrounds/stage07_b_collapsed_megabridge.png"),
    ("08 GREENHOUSE", "assets/battle_backgrounds/stage08_b_quarantine_greenhouse.png"),
    ("09 PLATFORM", "assets/battle_backgrounds/stage09_b_offshore_platform.png"),
    ("10 SANCTUM", "assets/battle_backgrounds/stage10_b_orbital_sanctum.png"),
]

W, H = 1600, 1350
BG = (7, 13, 25, 255)
PANEL = (16, 30, 52, 255)
ACCENT = (108, 224, 255, 255)
TEXT = (235, 243, 255, 255)
FONT = ImageFont.load_default()


def fit(image, size):
    image = image.convert("RGBA")
    image.thumbnail(size, Image.Resampling.LANCZOS)
    return image


def label(draw, xy, value, fill=TEXT):
    draw.text(xy, value, font=FONT, fill=fill)


def load(relative):
    path = ROOT / relative
    if not path.is_file():
        raise FileNotFoundError(path)
    return Image.open(path).convert("RGBA")


def main():
    canvas = Image.new("RGBA", (W, H), BG)
    draw = ImageDraw.Draw(canvas)
    label(draw, (28, 24), "TRIAD // RUN — MVP VISUAL INVENTORY (REVIEW ONLY)", ACCENT)
    label(draw, (28, 42), "Canonical lobby RGBA foregrounds + unlockable lobby backgrounds. No new art generated.")

    label(draw, (28, 82), "LOBBY CHARACTER RGBA (transparent foregrounds)", ACCENT)
    for index, (name, relative) in enumerate(LOBBY):
        x = 28 + (index % 3) * 515
        y = 110 + (index // 3) * 350
        draw.rounded_rectangle((x, y, x + 480, y + 320), radius=14, fill=PANEL, outline=(55, 87, 120, 255))
        image = fit(load(relative), (250, 270))
        px = x + (480 - image.width) // 2
        py = y + 32
        canvas.alpha_composite(image, (px, py))
        label(draw, (x + 16, y + 12), name)
        label(draw, (x + 16, y + 294), relative.rsplit("/", 1)[-1], (168, 190, 220, 255))

    label(draw, (28, 820), "LOBBY BACKGROUNDS (stage unlock sequence)", ACCENT)
    for index, (name, relative) in enumerate(BACKGROUNDS):
        x = 28 + (index % 5) * 315
        y = 850 + (index // 5) * 225
        draw.rounded_rectangle((x, y, x + 290, y + 200), radius=10, fill=PANEL, outline=(55, 87, 120, 255))
        image = fit(load(relative), (274, 158))
        px = x + (290 - image.width) // 2
        py = y + 26 + (158 - image.height) // 2
        canvas.alpha_composite(image, (px, py))
        label(draw, (x + 10, y + 8), name)

    label(draw, (28, 1308), "Review gate: background-free character foregrounds; distinguishable, usable lobby background progression.", (168, 190, 220, 255))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(OUT, quality=95)
    print(OUT)


if __name__ == "__main__":
    main()
