#!/usr/bin/env python3
"""Render random V5 card/enemy VFX review GIFs from the runtime manifest.

This is a deterministic-presentation QA renderer. It does not generate new
source art: every visible energy mass and fragment is cut from the authored
launch/impact WebPs used by the game runtime. Enemy actor orientation follows
the same per-source direction authority as the playable battle renderer.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache
from math import cos, pi, sin
from pathlib import Path
import json
import random
import re

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "qa_artifacts" / "combat_vfx_v5" / "random_samples"
SIZE = (480, 270)
FRAMES = 30
FRAME_MS = 45
RESAMPLE = Image.Resampling.LANCZOS
MANIFEST = json.loads((ROOT / "assets/vfx/derived_v5/manifest.json").read_text(encoding="utf-8"))
PLAN = json.loads((ROOT / "qa_artifacts/combat_vfx_v3/unique_vfx_plan.json").read_text(encoding="utf-8"))


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    path = Path("C:/Windows/Fonts/malgunbd.ttf" if bold else "C:/Windows/Fonts/malgun.ttf")
    try:
        return ImageFont.truetype(str(path), size)
    except OSError:
        return ImageFont.load_default()


@lru_cache(maxsize=None)
def rgba(relative: str) -> Image.Image:
    return Image.open(ROOT / relative).convert("RGBA")


def crop_alpha(image: Image.Image, pad: int = 2) -> Image.Image:
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        return image.copy()
    left, top, right, bottom = bbox
    return image.crop((max(0, left - pad), max(0, top - pad), min(image.width, right + pad), min(image.height, bottom + pad)))


def fit(image: Image.Image, width: int, height: int) -> Image.Image:
    result = image.copy()
    result.thumbnail((width, height), RESAMPLE)
    return result


def alpha(image: Image.Image, opacity: float) -> Image.Image:
    result = image.copy()
    result.putalpha(result.getchannel("A").point(lambda value: round(value * max(0.0, min(1.0, opacity)))))
    return result


def transformed(image: Image.Image, width: int, sx: float = 1.0, sy: float = 1.0, angle: float = 0.0, opacity: float = 1.0, mirror: bool = False) -> Image.Image:
    source = crop_alpha(image)
    target_w = max(4, round(width * sx))
    target_h = max(4, round(source.height * target_w / max(1, source.width) * sy))
    result = source.resize((target_w, target_h), RESAMPLE)
    if mirror:
        result = ImageOps.mirror(result)
    if angle:
        result = result.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    return alpha(result, opacity)


def paste_center(canvas: Image.Image, image: Image.Image, center: tuple[float, float]) -> None:
    canvas.alpha_composite(image, (round(center[0] - image.width / 2), round(center[1] - image.height / 2)))


@lru_cache(maxsize=1)
def background() -> Image.Image:
    image = ImageOps.fit(rgba("assets/battle_backgrounds/stage01_a_ruined_checkpoint.png"), SIZE, method=RESAMPLE)
    image = ImageEnhance.Brightness(image).enhance(0.38)
    image.alpha_composite(Image.new("RGBA", SIZE, (1, 4, 13, 82)))
    return image


@lru_cache(maxsize=1)
def player_actor() -> Image.Image:
    manifest_path = ROOT / "assets/characters/roster/TRIAD-CHAR-002/sd/revisions/r027_blender_nineclip_manifest/sd_manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    clip = manifest["clips"]["attack"]
    atlas = rgba(clip["atlas"])
    index = min(36, int(clip["frames"]) - 1)
    fw, fh = int(manifest["frameWidth"]), int(manifest["frameHeight"])
    left, top = (index % int(clip["columns"])) * fw, (index // int(clip["columns"])) * fh
    return crop_alpha(atlas.crop((left, top, left + fw, top + fh)))


@lru_cache(maxsize=None)
def enemy_actor(monster_id: str) -> Image.Image:
    match = re.fullmatch(r"([A-Z]+)_M(\d+)", monster_id)
    if not match:
        return player_actor()
    element, catalog = match.group(1), int(match.group(2))
    atlas = rgba(f"assets/enemies/monster_animation_p1/{element}_M{catalog:02d}.webp")
    fw, fh, row, frame = 320, 420, 1, 3
    return crop_alpha(atlas.crop((frame * fw, row * fh, (frame + 1) * fw, (row + 1) * fh)))


def enemy_runtime_mirror(monster_id: str) -> bool:
    """Mirror only right-facing catalog sources, exactly like the app."""
    match = re.fullmatch(r"[A-Z]+_M(\d+)", monster_id)
    return bool(match and int(match.group(1)) == 2)


def actor(canvas: Image.Image, image: Image.Image, x: float, ground: float, width: int, height: int, mirror: bool = False, kick: float = 0.0) -> None:
    sprite = fit(ImageOps.mirror(image) if mirror else image, width, height)
    canvas.alpha_composite(sprite, (round(x - sprite.width / 2 + kick), round(ground - sprite.height)))


def ease(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return 3 * value * value - 2 * value * value * value


def glow(canvas: Image.Image, center: tuple[float, float], radius: float, color: tuple[int, int, int], opacity: int) -> None:
    layer = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    x, y = center
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(*color, max(0, min(255, opacity))))
    canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(max(2, round(radius * 0.42)))))


def dominant_color(image: Image.Image) -> tuple[int, int, int]:
    sample = image.resize((32, 32), RESAMPLE)
    pixels = [(r, g, b) for r, g, b, a in sample.getdata() if a > 80 and max(r, g, b) > 70]
    if not pixels:
        return (105, 209, 255)
    pixels.sort(key=lambda rgb: sum(rgb), reverse=True)
    chosen = pixels[: max(1, len(pixels) // 4)]
    return tuple(round(sum(rgb[index] for rgb in chosen) / len(chosen)) for index in range(3))


@dataclass(frozen=True)
class Fragment:
    angle: float
    speed: float
    size: int
    delay: float
    spin: float
    curve: float


def fragment_plan(seed: int, count: int, vector: str, arc: float, enemy_cast: bool) -> list[Fragment]:
    rng = random.Random(seed ^ 0x7F4A7C15)
    direction = pi if enemy_cast else 0.0
    items: list[Fragment] = []
    for index in range(min(72, count)):
        if vector in {"cone", "fan", "plume", "acid"}:
            angle = direction + rng.uniform(-arc * 0.32, arc * 0.32)
        elif vector in {"ground", "seismic", "breakwave"}:
            angle = rng.choice((0.0, pi)) + rng.uniform(-0.32, 0.32)
        elif vector in {"implode", "soulwell", "singularity"}:
            angle = rng.uniform(-pi, pi) + pi
        elif vector in {"spiral", "vortex", "cyclone"}:
            angle = index * 0.63 + rng.uniform(-0.25, 0.25)
        elif vector in {"rail", "piston"}:
            angle = direction + rng.uniform(-.36, .36)
        elif vector in {"thorns", "fang", "pounce"}:
            angle = direction + rng.choice((-1, 1)) * rng.uniform(.14, .95)
        elif vector in {"drone", "sentry", "prism"}:
            angle = (index % (4 if vector != "prism" else 6)) * (pi / (2 if vector != "prism" else 3)) + rng.uniform(-.12, .12)
        elif vector in {"cathedral", "throne"}:
            angle = -pi * .5 + rng.uniform(-.46, .46)
        elif vector == "coronas":
            angle = index / max(1, count) * pi * 2 + rng.uniform(-.08, .08)
        else:
            angle = rng.uniform(-pi, pi)
        items.append(Fragment(angle, rng.uniform(38, 155), rng.randint(4, 13), rng.uniform(0, .28), rng.uniform(-190, 190), rng.uniform(-.8, .8)))
    return items


def fragments(canvas: Image.Image, impact: Image.Image, plan: list[Fragment], progress: float, origin: tuple[float, float], color: tuple[int, int, int], implode: bool) -> None:
    source = crop_alpha(impact)
    for index, item in enumerate(plan):
        life = (progress - item.delay) / max(.01, 1 - item.delay)
        if not 0 <= life <= 1:
            continue
        local = 1 - life if implode else life
        distance = item.speed * local * (1 - .28 * local)
        angle = item.angle + item.curve * local * local
        position = (origin[0] + cos(angle) * distance, origin[1] + sin(angle) * distance - 10 * local * local)
        crop_x = (index * 37) % max(1, source.width - max(2, item.size))
        crop_y = (index * 61) % max(1, source.height - max(2, item.size))
        patch = source.crop((crop_x, crop_y, min(source.width, crop_x + item.size), min(source.height, crop_y + item.size)))
        if patch.getchannel("A").getbbox() is None:
            patch = Image.new("RGBA", (item.size, item.size), (*color, 220))
        patch = patch.resize((item.size, item.size), RESAMPLE).rotate(item.spin * local, resample=Image.Resampling.BICUBIC, expand=True)
        paste_center(canvas, alpha(patch, (1 - life) ** .65), position)


def hud(canvas: Image.Image, kind: str, key: str, subtitle: str, index: int) -> None:
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((8, 8, 322, 48), 8, fill=(4, 11, 25, 218), outline=(74, 211, 255, 205), width=1)
    draw.text((18, 13), f"{index:02d} · {key}", font=font(14, True), fill=(245, 249, 255, 255))
    draw.text((18, 31), f"{kind} · {subtitle}", font=font(9), fill=(151, 210, 245, 255))


def render(entry: dict, profile: dict, frame: int, kind: str, index: int) -> Image.Image:
    t = frame / (FRAMES - 1)
    pipeline = entry["pipeline"]
    enemy_cast = kind == "MONSTER"
    source = (388, 157) if enemy_cast else (105, 157)
    target = (104, 157) if enemy_cast else (378, 157)
    launch = rgba(profile["launch"])
    impact = rgba(profile["impact"])
    color = dominant_color(launch)
    motion, rupture, sequence = profile["motion"], profile["rupture"], profile.get("sequence", {})
    travel_sequence, contact_sequence = sequence.get("travel", {}), sequence.get("contact", {})
    rupture_sequence, decay_sequence = sequence.get("rupture", {}), sequence.get("decay", {})
    canvas = background().copy()
    kick = 7 * max(0.0, 1 - abs((t - .63) / .07))
    if enemy_cast:
        actor(canvas, player_actor(), 92, 247, 88, 160, mirror=False, kick=-kick)
        actor(canvas, enemy_actor(entry["monsterId"]), 390, 247, 115, 175, mirror=enemy_runtime_mirror(entry["monsterId"]))
    else:
        actor(canvas, player_actor(), 91, 247, 92, 164, mirror=False)
        actor(canvas, enemy_actor("RIFT_M03"), 390, 247, 112, 174, mirror=enemy_runtime_mirror("RIFT_M03"), kick=kick)

    if pipeline == "SUPPORT":
        center = source
        if t < .28:
            p = ease(t / .28)
            glow(canvas, center, 20 + 38 * p, color, round(90 * p))
            paste_center(canvas, transformed(launch, round(65 + 95 * p), sy=.75 + .25 * p, angle=motion["spinOne"] * p, opacity=.35 + .65 * p, mirror=enemy_cast), center)
        else:
            p = min(1.0, (t - .28) / .72)
            size = round(145 + 82 * float(rupture_sequence.get("expandX", 1.4)) * sin(min(1, p) * pi))
            glow(canvas, center, 50 + 25 * (1 - p), color, round(92 * (1 - p)))
            paste_center(canvas, transformed(impact, size, sx=float(rupture_sequence.get("expandX", 1.2)) / 1.4, sy=float(rupture_sequence.get("expandY", 1.2)) / 1.4, angle=motion["contactSpin"] * p, opacity=(1 - p) ** .38), (center[0] + float(decay_sequence.get("driftX", 0)) * p, center[1] + float(decay_sequence.get("driftY", 0)) * p))
            fragments(canvas, impact, fragment_plan(profile["seed"], rupture["requested"] // 2, rupture["vector"], rupture["arc"], enemy_cast), p, center, color, rupture["vector"] == "implode")
    elif pipeline == "HEAVY_IMPACT":
        if t < .32:
            p = ease(t / .32)
            glow(canvas, target, 12 + 26 * p, color, round(66 * p))
            paste_center(canvas, transformed(launch, round(45 + 80 * p), sx=.72, sy=.62, angle=motion["spinOne"] * p, opacity=.2 + .55 * p, mirror=enemy_cast), target)
        else:
            p = min(1.0, (t - .32) / .68)
            glow(canvas, target, 45 * (1 - p) + 8, color, round(132 * (1 - p)))
            paste_center(canvas, transformed(impact, round(155 + rupture["spread"] * ease(p)), sx=float(rupture_sequence.get("expandX", 1.4)) / 1.4, sy=float(rupture_sequence.get("expandY", 1.4)) / 1.4, angle=motion["contactSpin"] * p + float(rupture_sequence.get("twist", 0)) * p, opacity=(1 - p) ** .42, mirror=enemy_cast), (target[0] + float(decay_sequence.get("driftX", 0)) * p, target[1] + float(decay_sequence.get("driftY", 0)) * p))
            fragments(canvas, impact, fragment_plan(profile["seed"], rupture["requested"], rupture["vector"], rupture["arc"], enemy_cast), p, target, color, rupture["vector"] == "implode")
    else:
        contact = .62 if pipeline == "PROJECTILE" else .54
        if t < .18:
            p = ease(t / .18)
            glow(canvas, source, 13 + 28 * p, color, round(104 * p))
            paste_center(canvas, transformed(launch, round(42 + 72 * p), sx=.7 + .3 * p, sy=.8, angle=motion["spinOne"] * p, opacity=.35 + .65 * p, mirror=enemy_cast), source)
        elif t < contact + .05:
            p = ease((t - .18) / (contact - .18))
            x = source[0] + (target[0] - source[0]) * p
            travel_style = str(travel_sequence.get("style", "ballistic-arc"))
            lateral = float(travel_sequence.get("lateral", 0))
            wave = sin(p * pi * 2 * max(1, int(travel_sequence.get("oscillations", 1))))
            path_bias = wave * lateral if travel_style in {"serpentine", "zigzag", "wave-drift", "spiral-bore", "serpent-weave", "sine-lunge", "drone-strafe"} else lateral * sin(p * pi)
            if travel_style in {"corkscrew-dive", "orbit-hunt"}:
                path_bias = lateral * cos(p * pi * 2)
            elif travel_style in {"ground-skim", "rail-snap"}:
                path_bias = abs(lateral) * .18
            elif travel_style in {"predator-pounce", "falling-meteor"}:
                path_bias = -abs(lateral) * sin(p * pi)
            y = source[1] + motion["curve"] * 0.45 * sin(p * pi) + path_bias
            squeeze = float(contact_sequence.get("squeezeX", .7)) if t >= contact else 1 + .09 * sin(t * 35)
            glow(canvas, (x, y), 18 if pipeline == "PROJECTILE" else 28, color, 76)
            paste_center(canvas, transformed(launch, 90 if pipeline == "PROJECTILE" else 126, sx=squeeze, sy=.84, angle=motion["spinOne"] + (motion["spinTwo"] - motion["spinOne"]) * p, mirror=enemy_cast), (x, y))
            for wake_index in range(motion["wakeCount"]):
                lag = (wake_index + 1) / (motion["wakeCount"] + 1)
                wx = x - (target[0] - source[0]) / abs(target[0] - source[0]) * lag * 52
                wy = y + sin(wake_index * 2.2 + t * 20) * 6
                patch = transformed(launch, max(5, round(18 * (1 - lag))), sx=.65, sy=.65, opacity=.42 * (1 - lag), mirror=enemy_cast)
                paste_center(canvas, patch, (wx, wy))
        if t >= contact:
            p = min(1.0, (t - contact) / (1 - contact))
            glow(canvas, target, 55 * (1 - p) + 8, color, round(160 * (1 - p)))
            paste_center(canvas, transformed(impact, round((190 if pipeline == "ULTIMATE" else 145) + rupture["spread"] * ease(p)), sx=float(rupture_sequence.get("expandX", 1.4)) / 1.4, sy=float(rupture_sequence.get("expandY", 1.4)) / 1.4, angle=motion["contactSpin"] * (1 - p) + float(rupture_sequence.get("twist", 0)) * p, opacity=(1 - p) ** .44, mirror=enemy_cast), (target[0] + float(decay_sequence.get("driftX", 0)) * p, target[1] + float(decay_sequence.get("driftY", 0)) * p))
            fragments(canvas, impact, fragment_plan(profile["seed"], rupture["requested"], rupture["vector"], rupture["arc"], enemy_cast), p, target, color, rupture["vector"] == "implode")

    title = entry["id"]
    descriptor = f"{pipeline} / {travel_sequence.get('style','formation')} / {rupture_sequence.get('style',rupture['vector'])}"
    hud(canvas, kind, title, descriptor, index)
    return canvas


def diverse_sample(entries: list[dict], count: int, group_keys: tuple[str, ...], rng: random.SystemRandom) -> list[dict]:
    shuffled = entries.copy()
    rng.shuffle(shuffled)
    selected: list[dict] = []
    seen: set[tuple[str, ...]] = set()
    for entry in shuffled:
        signature = tuple(str(entry.get(key, "")) for key in group_keys)
        if signature in seen:
            continue
        selected.append(entry)
        seen.add(signature)
        if len(selected) == count:
            return selected
    for entry in shuffled:
        if entry not in selected:
            selected.append(entry)
            if len(selected) == count:
                break
    return selected


def pipeline_sample(entries: list[dict], count: int, rng: random.SystemRandom) -> list[dict]:
    """Random selection that still exposes every implemented animation path."""
    selected: list[dict] = []
    quotas = {"PROJECTILE": 3, "HEAVY_IMPACT": 3, "SUPPORT": 2, "ULTIMATE": 2}
    for pipeline, quota in quotas.items():
        candidates = [entry for entry in entries if entry["pipeline"] == pipeline]
        rng.shuffle(candidates)
        for entry in candidates[: min(quota, len(candidates))]:
            if entry not in selected:
                selected.append(entry)
    if len(selected) < count:
        remainder = entries.copy()
        rng.shuffle(remainder)
        for entry in remainder:
            if entry not in selected:
                selected.append(entry)
            if len(selected) >= count:
                break
    rng.shuffle(selected)
    return selected[:count]


def save_clip(entry: dict, profile: dict, kind: str, index: int, directory: Path) -> tuple[Path, list[Image.Image]]:
    frames = [render(entry, profile, frame, kind, index) for frame in range(FRAMES)]
    paletted = [frame.convert("P", palette=Image.Palette.ADAPTIVE, colors=224) for frame in frames]
    path = directory / f"{index:02d}_{entry['id'].lower()}.gif"
    paletted[0].save(path, save_all=True, append_images=paletted[1:], duration=FRAME_MS, loop=0, disposal=2, optimize=True)
    return path, frames


def save_reel(name: str, clips: list[list[Image.Image]]) -> Path:
    cell = (320, 180)
    frames: list[Image.Image] = []
    for frame_index in range(FRAMES):
        sheet = Image.new("RGBA", (cell[0] * 2, cell[1] * 5), (2, 6, 15, 255))
        for index, clip in enumerate(clips):
            preview = clip[frame_index].resize(cell, RESAMPLE)
            sheet.alpha_composite(preview, ((index % 2) * cell[0], (index // 2) * cell[1]))
        frames.append(sheet.convert("P", palette=Image.Palette.ADAPTIVE, colors=224))
    path = OUT / name
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=FRAME_MS, loop=0, disposal=2, optimize=True)
    return path


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    card_dir, enemy_dir = OUT / "cards", OUT / "enemies"
    card_dir.mkdir(exist_ok=True)
    enemy_dir.mkdir(exist_ok=True)
    for directory in (card_dir, enemy_dir):
        for stale in directory.glob("*.gif"):
            stale.unlink()
    rng = random.SystemRandom()
    cards = pipeline_sample(PLAN["cards"], 10, rng)
    enemies = pipeline_sample(PLAN["enemies"], 10, rng)
    # Guarantee the monster review includes a boss while preserving randomness.
    if not any(entry.get("rank") == "boss" for entry in enemies):
        bosses = [entry for entry in PLAN["enemies"] if entry.get("rank") == "boss"]
        enemies[-1] = rng.choice(bosses)

    selections = {"generatedAt": datetime.now().astimezone().isoformat(), "cards": [], "enemies": []}
    card_frames: list[list[Image.Image]] = []
    enemy_frames: list[list[Image.Image]] = []
    for index, entry in enumerate(cards, 1):
        profile = MANIFEST["cards"][entry["id"]]
        path, frames = save_clip(entry, profile, "CARD", index, card_dir)
        card_frames.append(frames)
        selections["cards"].append({"index": index, "id": entry["id"], "core": entry["coreId"], "cardKey": entry["cardKey"], "pipeline": entry["pipeline"], "impactFamily": profile["impactFamily"], "gif": path.relative_to(ROOT).as_posix()})
    for index, entry in enumerate(enemies, 1):
        profile = MANIFEST["enemies"][entry["id"]]
        path, frames = save_clip(entry, profile, "MONSTER", index, enemy_dir)
        enemy_frames.append(frames)
        selections["enemies"].append({"index": index, "id": entry["id"], "monsterId": entry["monsterId"], "rank": entry["rank"], "pipeline": entry["pipeline"], "impactFamily": profile["impactFamily"], "gif": path.relative_to(ROOT).as_posix()})

    selections["cardReel"] = save_reel("card_random_10_reel.gif", card_frames).relative_to(ROOT).as_posix()
    selections["enemyReel"] = save_reel("monster_random_10_reel.gif", enemy_frames).relative_to(ROOT).as_posix()
    selection_path = OUT / "selection.json"
    selection_path.write_text(json.dumps(selections, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(selections, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
