#!/usr/bin/env python3
"""Render review GIFs from TRIAD // RUN's existing authored VFX assets.

This is a QA-only renderer, not an image generator.  It reuses the same
authoritative PNGs selected by ``combat_vfx_pipeline_v2.js`` and creates five
deterministic clips so a visual review can happen without having to navigate a
full run to each attack pattern.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import cos, pi, sin
from pathlib import Path
import json
import random
from functools import lru_cache

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "qa_artifacts" / "combat_vfx_v2" / "gif_previews"
SIZE = (720, 405)
FRAME_COUNT = 32
FRAME_DURATION_MS = 42  # 24 fps review GIF; the browser runtime itself is 60 fps.
RESAMPLE = Image.Resampling.LANCZOS


def load_rgba(relative: str) -> Image.Image:
    return Image.open(ROOT / relative).convert("RGBA")


def crop_alpha(image: Image.Image, padding: int = 2) -> Image.Image:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return image.copy()
    left = max(0, bbox[0] - padding)
    top = max(0, bbox[1] - padding)
    right = min(image.width, bbox[2] + padding)
    bottom = min(image.height, bbox[3] + padding)
    return image.crop((left, top, right, bottom))


def fit(image: Image.Image, max_width: int, max_height: int) -> Image.Image:
    copy = image.copy()
    copy.thumbnail((max_width, max_height), RESAMPLE)
    return copy


def with_alpha(image: Image.Image, opacity: float) -> Image.Image:
    if opacity >= 0.999:
        return image
    result = image.copy()
    alpha = result.getchannel("A").point(lambda value: int(value * max(0.0, min(1.0, opacity))))
    result.putalpha(alpha)
    return result


def transform_asset(
    image: Image.Image,
    width: int,
    opacity: float = 1.0,
    scale_x: float = 1.0,
    scale_y: float = 1.0,
    mirrored: bool = False,
    angle: float = 0.0,
) -> Image.Image:
    target_width = max(4, int(width * scale_x))
    target_height = max(4, int(image.height * target_width / image.width * scale_y))
    result = image.resize((target_width, target_height), RESAMPLE)
    if mirrored:
        result = ImageOps.mirror(result)
    if angle:
        # Pillow only supports bilinear/bicubic for affine rotation.
        result = result.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    return with_alpha(result, opacity)


def paste_center(canvas: Image.Image, image: Image.Image, center: tuple[float, float]) -> None:
    x = int(center[0] - image.width / 2)
    y = int(center[1] - image.height / 2)
    canvas.alpha_composite(image, (x, y))


def paste_actor(
    canvas: Image.Image,
    actor: Image.Image,
    center_x: float,
    ground_y: float,
    max_width: int,
    max_height: int,
    lean_x: float = 0.0,
    scale: float = 1.0,
) -> None:
    image = fit(actor, int(max_width * scale), int(max_height * scale))
    canvas.alpha_composite(image, (int(center_x - image.width / 2 + lean_x), int(ground_y - image.height)))


def ease_out(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return 1 - (1 - value) ** 3


def ease_in_out(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return 3 * value * value - 2 * value * value * value


def glow(canvas: Image.Image, center: tuple[float, float], radius: float, color: tuple[int, int, int], alpha: int) -> None:
    layer = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    x, y = center
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(*color, alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(max(1, int(radius * 0.45))))
    canvas.alpha_composite(layer)


def white_hot_contact(canvas: Image.Image, center: tuple[float, float], strength: float) -> None:
    glow(canvas, center, 26 + 42 * strength, (255, 192, 128), int(88 * strength))
    core = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(core)
    x, y = center
    r = 6 + 10 * strength
    draw.ellipse((x - r, y - r, x + r, y + r), fill=(255, 250, 233, int(215 * strength)))
    canvas.alpha_composite(core)


@dataclass(frozen=True)
class Particle:
    angle: float
    speed: float
    size: float
    delay: float
    drag: float
    swirl: float
    inertia: float


def particles(seed: int, count: int, directional: float = 0.0) -> list[Particle]:
    rng = random.Random(seed)
    return [
        Particle(
            angle=directional + rng.uniform(-pi, pi),
            speed=rng.uniform(42, 180),
            size=rng.uniform(2.0, 8.0),
            delay=rng.uniform(0.0, 0.34),
            drag=rng.uniform(0.18, 0.72),
            swirl=rng.uniform(-0.85, 0.85),
            inertia=rng.uniform(-0.22, 0.52),
        )
        for _ in range(count)
    ]


def draw_particles(
    canvas: Image.Image,
    sequence: list[Particle],
    progress: float,
    origin: tuple[float, float],
    color: tuple[int, int, int],
    direction: int = 1,
) -> None:
    layer = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    blur = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    blur_draw = ImageDraw.Draw(blur)
    for particle in sequence:
        life = (progress - particle.delay) / max(0.001, 1.0 - particle.delay)
        if not 0.0 <= life <= 1.0:
            continue
        angle = particle.angle + particle.swirl * life * life
        distance = particle.speed * life * (1.0 - particle.drag * life * 0.55)
        x = origin[0] + cos(angle) * distance + direction * particle.inertia * distance
        y = origin[1] + sin(angle) * distance - 22 * life * life
        size = particle.size * (1.12 - life * 0.45)
        alpha = int(210 * (1.0 - life) ** 1.35)
        # Chunky blob/shard fragments intentionally replace cheap line sparks.
        if particle.size > 5.2:
            points = [(x, y - size), (x + size * 0.86, y), (x, y + size * 0.74), (x - size * 0.64, y)]
            draw.polygon(points, fill=(*color, alpha))
            blur_draw.ellipse((x - size, y - size, x + size, y + size), fill=(*color, alpha // 2))
        else:
            draw.ellipse((x - size, y - size, x + size, y + size), fill=(*color, alpha))
            blur_draw.ellipse((x - size * 1.6, y - size * 1.6, x + size * 1.6, y + size * 1.6), fill=(*color, alpha // 2))
    canvas.alpha_composite(blur.filter(ImageFilter.GaussianBlur(3)))
    canvas.alpha_composite(layer)


def draw_hud(canvas: Image.Image, title: str, subtitle: str, actor_label: str, target_label: str) -> None:
    draw = ImageDraw.Draw(canvas)
    try:
        title_font = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 18)
        label_font = ImageFont.truetype("C:/Windows/Fonts/malgun.ttf", 12)
    except OSError:
        title_font = ImageFont.load_default()
        label_font = ImageFont.load_default()
    draw.rounded_rectangle((12, 12, 348, 62), radius=10, fill=(6, 13, 28, 205), outline=(75, 210, 255, 175), width=1)
    draw.text((24, 20), title, font=title_font, fill=(242, 248, 255, 255))
    draw.text((24, 43), subtitle, font=label_font, fill=(145, 203, 245, 255))
    draw.rounded_rectangle((44, 356, 238, 382), radius=8, fill=(5, 12, 28, 208), outline=(82, 212, 255, 155), width=1)
    draw.rounded_rectangle((484, 356, 676, 382), radius=8, fill=(22, 7, 27, 210), outline=(253, 120, 164, 155), width=1)
    draw.text((54, 362), actor_label, font=label_font, fill=(238, 248, 255, 255))
    draw.text((494, 362), target_label, font=label_font, fill=(255, 238, 246, 255))


def arena() -> Image.Image:
    background = ImageOps.fit(load_rgba("assets/battle_backgrounds/stage01_a_ruined_checkpoint.png"), SIZE, method=RESAMPLE)
    background = background.convert("RGBA")
    shade = Image.new("RGBA", SIZE, (1, 5, 13, 72))
    background.alpha_composite(shade)
    return background


CHARACTER_SD_MANIFESTS = {
    "volt": "assets/characters/roster/TRIAD-CHAR-002/sd/revisions/r027_blender_nineclip_manifest/sd_manifest.json",
    "ember": "assets/characters/roster/TRIAD-CHAR-001/sd/revisions/r054_blender_nineclip_manifest/sd_manifest.json",
    "bloom": "assets/characters/roster/TRIAD-CHAR-011/sd/revisions/r002_gpt_web_true_alpha_atlases/sd_manifest.json",
}


@lru_cache(maxsize=None)
def load_sd_player_frame(core_id: str, clip: str, frame: int) -> Image.Image:
    """Read the active battle atlas frame, never lobby/full illustration art."""
    manifest = json.loads((ROOT / CHARACTER_SD_MANIFESTS[core_id]).read_text(encoding="utf-8"))
    entry = manifest["clips"][clip]
    atlas = load_rgba(entry["atlas"])
    columns = int(entry["columns"])
    width, height = int(manifest["frameWidth"]), int(manifest["frameHeight"])
    index = max(0, min(int(frame), int(entry["frames"]) - 1))
    left = (index % columns) * width
    top = (index // columns) * height
    return crop_alpha(atlas.crop((left, top, left + width, top + height)))


@lru_cache(maxsize=None)
def load_sd_enemy_frame(element: str, catalog_no: int, state: str, frame: int) -> Image.Image:
    """Read the same frozen enemy battle atlas format used by the runtime."""
    atlas = load_rgba(f"assets/enemies/monster_animation_p1/{element}_M{catalog_no:02d}.webp")
    row = {"idle": 0, "attack": 1, "hit": 2, "defeat": 3}[state]
    index = max(0, min(int(frame), 5))
    width, height = 320, 420
    left = index * width
    top = row * height
    return crop_alpha(atlas.crop((left, top, left + width, top + height)))


ASSETS = {
    "volt": load_sd_player_frame("volt", "attack", 36),
    "ember": load_sd_player_frame("ember", "skill", 36),
    "bloom": load_sd_player_frame("bloom", "idle", 12),
    "caster": load_sd_enemy_frame("RIFT", 3, "attack", 3),
    "sovereign": load_sd_enemy_frame("RIFT", 15, "attack", 4),
    "projectile": crop_alpha(load_rgba("assets/vfx/gpt_web_v1/vfx_projectile.png")),
    "impact": crop_alpha(load_rgba("assets/vfx/gpt_web_v1/vfx_impact.png")),
    "burn": crop_alpha(load_rgba("assets/vfx/gpt_web_v1/vfx_burn.png")),
    "shock": crop_alpha(load_rgba("assets/vfx/gpt_web_v1/vfx_shock.png")),
    "mark": crop_alpha(load_rgba("assets/vfx/gpt_web_v1/vfx_mark.png")),
    "ultimate": crop_alpha(load_rgba("assets/vfx/gpt_web_v1/vfx_ultimate.png")),
    "sig_ember": crop_alpha(load_rgba("assets/vfx/gpt_web_v1/vfx_signature_ember.png")),
    "boss_sovereign": crop_alpha(load_rgba("assets/vfx/gpt_web_v1/vfx_boss_sovereign.png")),
}


def player_vs_enemy(frame: int, player: str, enemy: str, player_shift: float = 0.0, enemy_shift: float = 0.0) -> Image.Image:
    canvas = arena()
    paste_actor(canvas, ASSETS[player], 170 + player_shift, 350, 155, 246, lean_x=player_shift)
    paste_actor(canvas, ASSETS[enemy], 568 + enemy_shift, 350, 165, 245, lean_x=enemy_shift)
    return canvas


def render_projectile(frame: int, enemy_to_player: bool = False) -> Image.Image:
    t = frame / (FRAME_COUNT - 1)
    contact_t = 0.63
    direction = -1 if enemy_to_player else 1
    player_shift = -5 if enemy_to_player and contact_t <= t <= contact_t + 0.10 else 8 * max(0.0, 0.22 - t) / 0.22
    enemy_shift = 8 if not enemy_to_player and contact_t <= t <= contact_t + 0.10 else -5 * max(0.0, 0.22 - t) / 0.22
    canvas = player_vs_enemy(frame, "volt", "caster", player_shift, enemy_shift)
    source = (580, 226) if enemy_to_player else (214, 226)
    target = (218, 226) if enemy_to_player else (550, 226)
    if t < 0.18:
        charge = ease_out(t / 0.18)
        glow(canvas, source, 20 + 24 * charge, (81, 221, 255), 100)
        asset = transform_asset(ASSETS["projectile"], 85 + 55 * charge, opacity=0.55 + charge * 0.45, scale_y=0.70)
        paste_center(canvas, asset, source)
        for index in range(10):
            angle = index * 2 * pi / 10 + frame * 0.19
            radius = 42 * (1 - charge) + 8
            x = source[0] + cos(angle) * radius
            y = source[1] + sin(angle) * radius
            draw_particles(canvas, [Particle(angle, 0, 2.4, 0, 0, 0, 0)], 0.1, (x, y), (86, 222, 255), direction)
    elif t < contact_t + 0.06:
        travel = ease_in_out((t - 0.18) / (contact_t - 0.18))
        x = source[0] + (target[0] - source[0]) * travel
        y = source[1] - sin(travel * pi) * 7
        squeeze = 0.74 if t >= contact_t else 1.0 + 0.08 * sin(t * 26)
        asset = transform_asset(ASSETS["projectile"], 205, opacity=1.0, scale_x=squeeze, scale_y=1.12 if t >= contact_t else 0.92, mirrored=enemy_to_player)
        glow(canvas, (x, y), 30, (58, 198, 255), 78)
        paste_center(canvas, asset, (x, y))
        wake = particles(222 if enemy_to_player else 102, 13, 0 if enemy_to_player else pi)
        draw_particles(canvas, wake, travel, (x - direction * 52, y + 3), (100, 187, 255), direction)
    if t >= contact_t - 0.015:
        rupture = min(1.0, (t - contact_t + 0.015) / 0.34)
        white_hot_contact(canvas, target, min(1.0, rupture * 4))
        if rupture < 0.72:
            impact_source = ASSETS["mark"] if enemy_to_player else ASSETS["shock"]
            impact = transform_asset(impact_source, int(175 + 188 * ease_out(rupture)), opacity=(1 - rupture) ** 0.72, angle=-10 * direction)
            paste_center(canvas, impact, target)
        draw_particles(canvas, particles(73 if enemy_to_player else 37, 44, 0 if enemy_to_player else pi), rupture, target, (107, 201, 255), direction)
        if rupture > 0.48:
            glow(canvas, target, 38 * (1 - rupture) + 10, (84, 195, 255), int(72 * (1 - rupture)))
    draw_hud(
        canvas,
        "MONSTER CASTER • ORB SHOT" if enemy_to_player else "CARD QUICK • PROJECTILE",
        "charge → release → travel → rupture",
        "VOLT" if enemy_to_player else "VOLT / QUICK",
        "CASTER",
    )
    return canvas


def render_heavy(frame: int) -> Image.Image:
    t = frame / (FRAME_COUNT - 1)
    contact_t = 0.30
    enemy_shift = 10 * max(0.0, 1 - abs((t - contact_t) / 0.07))
    canvas = player_vs_enemy(frame, "ember", "caster", player_shift=15 * max(0.0, 0.22 - t) / 0.22, enemy_shift=enemy_shift)
    target = (548, 232)
    if t < contact_t:
        charge = ease_out(t / contact_t)
        glow(canvas, target, 19 + 25 * charge, (255, 112, 63), 72)
        preflash = transform_asset(ASSETS["burn"], 105 + int(42 * charge), opacity=0.25 + .45 * charge, scale_y=0.62)
        paste_center(canvas, preflash, target)
    else:
        rupture = min(1.0, (t - contact_t) / (1 - contact_t))
        white_hot_contact(canvas, target, min(1.0, rupture * 5))
        burn = transform_asset(ASSETS["burn"], int(210 + 126 * ease_out(rupture)), opacity=max(0.0, 1 - rupture * 0.64), angle=-8 + rupture * 15)
        paste_center(canvas, burn, target)
        draw_particles(canvas, particles(811, 56, 0.15), rupture, target, (255, 122, 61), 1)
        if .08 < rupture < .65:
            ring = Image.new("RGBA", SIZE, (0, 0, 0, 0))
            ring_draw = ImageDraw.Draw(ring)
            radius = 18 + rupture * 115
            ring_draw.ellipse((target[0] - radius, target[1] - radius * .33, target[0] + radius, target[1] + radius * .33), outline=(255, 173, 83, int(115 * (1 - rupture))), width=2)
            canvas.alpha_composite(ring)
    draw_hud(canvas, "CARD INFERNO • HEAVY IMPACT", "anticipation → contact → debris → afterglow", "EMBER / INFERNO", "CASTER")
    return canvas


def render_card_ultimate(frame: int) -> Image.Image:
    t = frame / (FRAME_COUNT - 1)
    canvas = player_vs_enemy(frame, "ember", "sovereign", player_shift=9 * max(0.0, .20 - t) / .20)
    target = (553, 215)
    if t < .20:
        charge = ease_out(t / .20)
        glow(canvas, (213, 214), 26 + charge * 52, (255, 111, 62), 106)
        signature = transform_asset(ASSETS["sig_ember"], int(82 + 142 * charge), opacity=.35 + .65 * charge)
        paste_center(canvas, signature, (213, 214))
    elif t < .57:
        # The travel phase is a compact authored projectile, not a drifting
        # copy of the large signature key art.  The signature art returns only
        # when that stored energy actually ruptures at the target.
        travel = ease_in_out((t - .20) / .37)
        x = 228 + (target[0] - 228) * travel
        squash = .76 if t >= .545 else 1.0 + .06 * sin(t * 28)
        asset = transform_asset(ASSETS["projectile"], int(118 + 34 * travel), opacity=1.0, scale_x=squash, scale_y=.82)
        glow(canvas, (x, 216), 24, (255, 93, 68), 92)
        paste_center(canvas, asset, (x, 216))
        draw_particles(canvas, particles(508, 18, pi), travel, (x - 23, 216), (255, 144, 82), 1)
    else:
        rupture = min(1.0, (t - .57) / .43)
        darken = Image.new("RGBA", SIZE, (11, 0, 18, int(92 * (1 - rupture))))
        canvas.alpha_composite(darken)
        white_hot_contact(canvas, target, min(1.0, rupture * 5))
        main = transform_asset(ASSETS["sig_ember"], int(275 + 130 * ease_out(rupture)), opacity=(1 - rupture) ** .46, angle=7 * rupture)
        paste_center(canvas, main, target)
        draw_particles(canvas, particles(1508, 70, 0.0), rupture, target, (255, 129, 89), 1)
    draw_hud(canvas, "CARD SIGNATURE • ULTIMATE", "charge → compact shot → rupture → authored debris", "EMBER / SIGNATURE", "SOVEREIGN")
    return canvas


def render_boss_ultimate(frame: int) -> Image.Image:
    t = frame / (FRAME_COUNT - 1)
    canvas = arena()
    # Three allied positions make the boss-area attack target legible.
    impact_shake = -7 * max(0.0, 1 - abs((t - .56) / .08))
    paste_actor(canvas, ASSETS["volt"], 120 + impact_shake, 350, 105, 195, lean_x=impact_shake)
    paste_actor(canvas, ASSETS["ember"], 200 + impact_shake, 350, 105, 195, lean_x=impact_shake)
    paste_actor(canvas, ASSETS["bloom"], 284 + impact_shake, 350, 105, 195, lean_x=impact_shake)
    paste_actor(canvas, ASSETS["sovereign"], 579, 350, 175, 250, lean_x=-8 * max(0.0, .20 - t) / .20)
    origin = (558, 208)
    target = (202, 226)
    if t < .26:
        charge = ease_out(t / .26)
        veil = Image.new("RGBA", SIZE, (12, 0, 24, int(115 * charge)))
        canvas.alpha_composite(veil)
        glow(canvas, origin, 42 + 60 * charge, (194, 93, 255), 120)
        asset = transform_asset(ASSETS["boss_sovereign"], int(150 + 200 * charge), opacity=.36 + .62 * charge, scale_y=.74)
        paste_center(canvas, asset, origin)
    elif t < .56:
        # The boss key art stays at its casting point.  A compact existing
        # projectile crosses the battlefield and carries its rupture energy.
        attack = ease_in_out((t - .26) / .30)
        x = origin[0] + (target[0] - origin[0]) * attack
        y = origin[1] + sin(attack * pi) * 16
        squash = .70 if t >= .535 else 1.0 + .06 * sin(t * 30)
        asset = transform_asset(ASSETS["projectile"], int(128 + 36 * attack), opacity=1.0, scale_x=squash, scale_y=.86, mirrored=True)
        glow(canvas, (x, y), 29, (211, 101, 255), 94)
        paste_center(canvas, asset, (x, y))
        draw_particles(canvas, particles(904, 26, 0), attack, (x + 26, y), (219, 115, 255), -1)
    else:
        rupture = min(1.0, (t - .56) / .44)
        veil = Image.new("RGBA", SIZE, (13, 0, 24, int(72 * (1 - rupture))))
        canvas.alpha_composite(veil)
        white_hot_contact(canvas, target, min(1.0, rupture * 5))
        # The boss-exclusive authored silhouette is the rupture itself, followed
        # by varied ground-biased plasma lumps, shards and residual motes.
        main = transform_asset(ASSETS["boss_sovereign"], int(440 + 148 * ease_out(rupture)), opacity=(1 - rupture) ** .44, scale_y=.78)
        paste_center(canvas, main, target)
        draw_particles(canvas, particles(2590, 92, pi), rupture, target, (226, 102, 255), -1)
        if rupture > .42:
            glow(canvas, target, 48 * (1 - rupture) + 12, (209, 99, 255), int(82 * (1 - rupture)))
    draw_hud(canvas, "BOSS SOVEREIGN • FINISHER", "ritual charge → compact shot → rupture → residual fragments", "TRIAD PARTY", "SOVEREIGN")
    return canvas


def save_gif(name: str, renderer) -> Path:
    frames = [renderer(index).convert("P", palette=Image.Palette.ADAPTIVE, colors=256) for index in range(FRAME_COUNT)]
    destination = OUT / name
    frames[0].save(destination, save_all=True, append_images=frames[1:], duration=FRAME_DURATION_MS, loop=0, disposal=2, optimize=True)
    return destination


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    clips = (
        ("01_card_quick_projectile.gif", lambda frame: render_projectile(frame, enemy_to_player=False)),
        ("02_card_inferno_heavy_impact.gif", render_heavy),
        ("03_card_signature_ultimate.gif", render_card_ultimate),
        ("04_monster_caster_projectile.gif", lambda frame: render_projectile(frame, enemy_to_player=True)),
        ("05_boss_sovereign_finisher.gif", render_boss_ultimate),
    )
    for name, renderer in clips:
        output = save_gif(name, renderer)
        print(output.relative_to(ROOT))


if __name__ == "__main__":
    main()
