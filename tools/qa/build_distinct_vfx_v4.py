#!/usr/bin/env python3
"""Build visually distinct V4 VFX composites for every immutable skill ID.

No image model is used. Existing authored transparent VFX remain the only
visual authority. V4 separates card, normal-monster, elite and boss silhouette
grammars, then composes multiple authored sources into a unique identity for
each skill instead of making one-source crop/rotation variants.
"""

from __future__ import annotations

from hashlib import sha256
from functools import lru_cache
from pathlib import Path
import json
import math
import random
import re

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[2]
PLAN_PATH = ROOT / "qa_artifacts/combat_vfx_v3/unique_vfx_plan.json"
OUTPUT_ROOT = ROOT / "assets/vfx/derived_v4"
MANIFEST_JSON = OUTPUT_ROOT / "manifest.json"
MANIFEST_JS = ROOT / "combat_vfx_skill_assets_v4.js"
CANVAS = 640
RESAMPLE = Image.Resampling.LANCZOS

AUTHORED = [
    "vfx_boss_apostle.png", "vfx_boss_overmind.png", "vfx_boss_sovereign.png",
    "vfx_burn.png", "vfx_elite_colossus.png", "vfx_elite_reaper.png",
    "vfx_elite_vanguard.png", "vfx_heal.png", "vfx_impact.png", "vfx_mark.png",
    "vfx_projectile.png", "vfx_shield.png", "vfx_shock.png",
    "vfx_signature_aegis.png", "vfx_signature_bloom.png", "vfx_signature_ember.png",
    "vfx_signature_rift.png", "vfx_signature_shade.png", "vfx_signature_volt.png",
    "vfx_ultimate.png",
]
SOURCE_ROOT = ROOT / "assets/vfx/gpt_web_v1"
PALETTES = {
    "EMBER": ((43, 3, 1), (255, 72, 19), (255, 233, 139)),
    "VOLT": ((1, 9, 42), (35, 137, 255), (213, 250, 255)),
    "AEGIS": ((4, 16, 43), (94, 190, 255), (245, 252, 255)),
    "SHADE": ((18, 0, 40), (151, 48, 255), (250, 205, 255)),
    "BLOOM": ((0, 35, 22), (48, 220, 145), (231, 255, 182)),
    "RIFT": ((30, 0, 43), (228, 34, 244), (195, 235, 255)),
}
LAYOUTS = {
    "CARD": ("crescent", "comet", "triskelion", "wing", "orbit", "fan", "sigil"),
    "MONSTER_NORMAL": ("fang", "spine", "jaw", "stinger", "maw", "talon"),
    "MONSTER_ELITE": ("halberd", "crossclaw", "siege", "mantis", "crown", "breaker"),
    "MONSTER_BOSS": ("cathedral", "singularity", "dominion", "idol", "eclipse", "throne"),
}


def safe_id(value: str) -> str:
    return re.sub(r"[^a-z0-9_-]+", "-", value.lower()).strip("-")


def sha(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest().upper()


def crop_alpha(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    box = rgba.getchannel("A").getbbox()
    return rgba.crop(box) if box else rgba


def opacity(image: Image.Image, amount: float) -> Image.Image:
    result = image.copy()
    result.putalpha(result.getchannel("A").point(lambda value: round(value * max(0.0, min(1.0, amount)))))
    return result


def place(canvas: Image.Image, image: Image.Image, x: float, y: float) -> None:
    canvas.alpha_composite(image, (round(x - image.width / 2), round(y - image.height / 2)))


def tint(image: Image.Image, palette: tuple[tuple[int, int, int], ...], strength: float) -> Image.Image:
    source = image.convert("RGBA")
    gray = ImageOps.grayscale(source)
    colored = ImageOps.colorize(gray, palette[0], palette[2], mid=palette[1], midpoint=132).convert("RGBA")
    colored.putalpha(source.getchannel("A"))
    return Image.blend(source, colored, max(0.0, min(1.0, strength)))


def band_displace(image: Image.Image, seed: int, strength: int, vertical: bool = False) -> Image.Image:
    source = ImageOps.mirror(image) if vertical else image
    if vertical:
        source = source.rotate(90, expand=True)
    output = Image.new("RGBA", source.size, (0, 0, 0, 0))
    band = 11 + seed % 23
    phase = (seed % 997) / 997 * math.tau
    for top in range(0, source.height, band):
        bottom = min(source.height, top + band)
        shift = round(math.sin(phase + top / max(1, source.height) * math.tau * (1 + seed % 4)) * strength)
        output.alpha_composite(source.crop((0, top, source.width, bottom)), (shift, top))
    if vertical:
        output = output.rotate(-90, expand=True)
        output = ImageOps.mirror(output)
    return output


@lru_cache(maxsize=None)
def load_authored(name: str) -> Image.Image:
    return crop_alpha(Image.open(SOURCE_ROOT / name))


def dissolve_crop_edges(image: Image.Image, seed: int) -> Image.Image:
    """Remove rectangular crop seams with a soft, irregular alpha breakup."""
    result = image.convert("RGBA")
    width, height = result.size
    rng = random.Random(seed ^ 0x94D049BB)
    inset = max(5, round(min(width, height) * rng.uniform(.10, .17)))
    edge = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(edge)
    mode = seed % 3
    if mode == 0:
        draw.ellipse((inset, inset, width - inset, height - inset), fill=255)
    elif mode == 1:
        draw.rounded_rectangle((inset, inset, width - inset, height - inset), radius=max(8, round(min(width, height) * .24)), fill=255)
    else:
        cx, cy = width / 2, height / 2
        points = []
        for index in range(10):
            angle = index / 10 * math.tau
            radius_x = max(4, width / 2 - inset) * rng.uniform(.72, 1.0)
            radius_y = max(4, height / 2 - inset) * rng.uniform(.72, 1.0)
            points.append((cx + math.cos(angle) * radius_x, cy + math.sin(angle) * radius_y))
        draw.polygon(points, fill=255)
    # Keep noise subtle so authored interior detail remains intact while cut
    # borders dissolve organically.
    edge_rgba = Image.new("RGBA", (width, height), (255, 255, 255, 0))
    edge_rgba.putalpha(edge)
    edge = band_displace(edge_rgba, seed ^ 0x369DEA0F, max(3, inset // 2), vertical=bool(seed & 4)).getchannel("A")
    edge = edge.filter(ImageFilter.GaussianBlur(max(5, round(inset * 1.05))))
    noise = Image.effect_noise((width, height), 22 + seed % 19).point(lambda value: 178 + round(value * 77 / 255))
    mask = ImageChops.multiply(result.getchannel("A"), ImageChops.multiply(edge, noise))
    result.putalpha(mask)
    return crop_alpha(result)


def source_piece(name: str, rng: random.Random, palette, width: int, angle: float, mirror: bool, opacity_value: float, crop_bias: int) -> Image.Image:
    source = load_authored(name)
    # Preserve the authored transparent outline. Selected components receive
    # an irregular alpha lobe mask, never a rectangular crop boundary.
    piece = source.copy() if crop_bias % 4 == 0 else dissolve_crop_edges(source, crop_bias)
    target_h = max(24, round(piece.height * width / max(1, piece.width) * rng.uniform(.68, 1.28)))
    piece = piece.resize((max(24, width), target_h), RESAMPLE)
    piece = tint(piece, palette, rng.uniform(.36, .82))
    piece = band_displace(piece, crop_bias * 7919 + width, rng.randint(2, 10), vertical=bool(crop_bias & 1))
    if mirror:
        piece = ImageOps.mirror(piece)
    piece = piece.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    piece = ImageEnhance.Contrast(piece).enhance(rng.uniform(1.0, 1.18))
    return opacity(piece, opacity_value)


def tier_for(group: str, record: dict) -> str:
    if group == "cards":
        return "CARD"
    rank = record.get("rank", "normal").upper()
    return f"MONSTER_{rank}" if rank in {"NORMAL", "ELITE", "BOSS"} else "MONSTER_NORMAL"


def element_for(group: str, record: dict) -> str:
    return str(record.get("coreId") if group == "cards" else record.get("elementId", "RIFT"))


def recipe_sources(record: dict, tier: str, seed: int, phase: str) -> list[str]:
    primary = Path(record["sourceImpact" if phase == "impact" else "sourceLaunch"]).name
    domain_offset = {"CARD": 3, "MONSTER_NORMAL": 7, "MONSTER_ELITE": 11, "MONSTER_BOSS": 15}[tier]
    phase_offset = 9 if phase == "impact" else 0
    start = (seed ^ (domain_offset * 0x45D9F3B) ^ (phase_offset * 0x27D4EB2D)) % len(AUTHORED)
    count = {"CARD": 4, "MONSTER_NORMAL": 3, "MONSTER_ELITE": 5, "MONSTER_BOSS": 6}[tier]
    result = [primary]
    step = 3 + ((seed >> 5) % 8)
    cursor = start
    while len(result) < count:
        candidate = AUTHORED[cursor % len(AUTHORED)]
        cursor += step
        if candidate not in result:
            result.append(candidate)
        else:
            cursor += 1
    return result


def layout_positions(layout: str, count: int, spread: float, phase: str, seed: int) -> list[tuple[float, float, float, float]]:
    """Return x, y, angle, scale for authored pieces; no primitive is rendered."""
    rng = random.Random(seed ^ 0xA511E9B3)
    cx, cy = CANVAS / 2, CANVAS / 2
    impact = phase == "impact"
    positions: list[tuple[float, float, float, float]] = []
    for index in range(count):
        u = index / max(1, count - 1)
        if layout in {"crescent", "fang", "talon"}:
            angle = (-1.1 + 2.2 * u) + rng.uniform(-.16, .16)
            x, y = cx + math.cos(angle) * spread, cy + math.sin(angle) * spread * .72
            rotation = math.degrees(angle) + (90 if layout == "crescent" else 0)
        elif layout in {"comet", "spine", "halberd", "stinger"}:
            x = cx + (u - .5) * spread * 2
            y = cy + math.sin(u * math.pi * 2 + (seed % 11)) * spread * .28
            rotation = rng.uniform(-18, 18) + (0 if index == 0 else 180)
        elif layout in {"triskelion", "orbit", "sigil", "cathedral", "singularity", "eclipse"}:
            angle = u * math.tau + (seed % 360) * math.pi / 180
            radius = spread * (.45 + .55 * (index % 2))
            x, y = cx + math.cos(angle) * radius, cy + math.sin(angle) * radius
            rotation = math.degrees(angle) + 90
        elif layout in {"wing", "fan", "jaw", "maw", "crossclaw", "mantis"}:
            side = -1 if index % 2 == 0 else 1
            depth = index // 2 + 1
            x, y = cx + side * spread * (.35 + depth * .18), cy + (depth - 1) * spread * .19
            rotation = side * (24 + depth * 13)
        elif layout in {"siege", "breaker", "dominion", "idol", "throne", "crown"}:
            x = cx + math.sin(index * 2.1) * spread * .56
            y = cy + (u - .5) * spread * 1.55
            rotation = rng.uniform(-22, 22) + (90 if index & 1 else 0)
        else:
            angle = u * math.tau
            x, y = cx + math.cos(angle) * spread, cy + math.sin(angle) * spread
            rotation = math.degrees(angle)
        scale = (1.2 if index == 0 else rng.uniform(.48, .88)) * (1.12 if impact else .9)
        positions.append((x, y, rotation, scale))
    return positions


def compose(record: dict, group: str, ordinal: int, phase: str) -> tuple[Image.Image, dict]:
    seed = int(record["seed"]) ^ (ordinal * 0x9E3779B1) ^ (0xD1B54A35 if phase == "impact" else 0)
    rng = random.Random(seed)
    tier = tier_for(group, record)
    element = element_for(group, record)
    palette = PALETTES.get(element, PALETTES["RIFT"])
    layouts = LAYOUTS[tier]
    pipeline_bias = {"PROJECTILE": 0, "HEAVY_IMPACT": 2, "SUPPORT": 4, "ULTIMATE": 5}.get(record["pipeline"], 0)
    layout = layouts[(ordinal + pipeline_bias + (2 if phase == "impact" else 0)) % len(layouts)]
    sources = recipe_sources(record, tier, seed, phase)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    impact = phase == "impact"
    spread = rng.uniform(78, 155) * (1.22 if impact else .82)
    positions = layout_positions(layout, len(sources), spread, phase, seed)
    piece_codes = []
    for index, (name, position) in enumerate(zip(sources, positions)):
        x, y, angle, scale = position
        base_width = ({"CARD": 310, "MONSTER_NORMAL": 285, "MONSTER_ELITE": 330, "MONSTER_BOSS": 370}[tier])
        width = round(base_width * scale * rng.uniform(.82, 1.17))
        crop_bias = ordinal * 17 + index * 31 + (101 if impact else 0)
        piece = source_piece(name, rng, palette, width, angle + rng.uniform(-12, 12), bool((ordinal + index) & 1), rng.uniform(.48, .9) if index else .96, crop_bias)
        place(canvas, piece, x, y)
        piece_codes.append({"source": name, "x": round(x), "y": round(y), "angle": round(angle, 2), "width": width, "crop": crop_bias})

    # A full authored focal mass is placed last so the composite never becomes
    # an abstract collection of procedural shapes.
    focal_name = sources[(ordinal + (1 if impact else 0)) % len(sources)]
    focal_width = rng.randint(285, 420) * (1.18 if impact else .92)
    focal = source_piece(focal_name, rng, palette, round(focal_width), rng.uniform(-28, 28), bool(seed & 1), .92, ordinal * 59 + (211 if impact else 7))
    focal = band_displace(focal, seed ^ 0xC2B2AE35, rng.randint(4, 14) if impact else rng.randint(2, 8), vertical=bool(seed & 2))
    place(canvas, focal, CANVAS / 2 + rng.randint(-32, 32), CANVAS / 2 + rng.randint(-34, 34))

    box = canvas.getchannel("A").getbbox()
    if box:
        content = canvas.crop(box)
        content.thumbnail((CANVAS - 12, CANVAS - 12), RESAMPLE)
        result = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
        place(result, content, CANVAS / 2, CANVAS / 2)
    else:
        result = canvas
    recipe = {
        "domain": tier,
        "layout": layout,
        "phase": phase,
        "element": element,
        "sources": sources,
        "pieces": piece_codes,
        "recipeId": f"{tier.lower()}-{record['id'].lower()}-{phase}-{seed:08x}",
    }
    return result, recipe


def profile(seed: int, identifier: str, tier: str, ordinal: int) -> dict:
    rng = random.Random(seed ^ ordinal * 0x85EBCA6B)
    vectors_by_tier = {
        "CARD": ["fan", "cone", "radial", "implode", "halo", "plume"],
        "MONSTER_NORMAL": ["fang", "ground", "cone", "scatter", "plume", "pounce"],
        "MONSTER_ELITE": ["siege", "cross", "shardstorm", "ground", "spiral", "breaker"],
        "MONSTER_BOSS": ["cathedral", "singularity", "dominion", "eclipse", "collapse", "ritual"],
    }
    vectors = vectors_by_tier[tier]
    shape_sets = {
        "CARD": [["plasma", "crest", "mote"], ["petal", "arc", "lump"]],
        "MONSTER_NORMAL": [["fang", "glob", "scrap"], ["claw", "spore", "chunk"]],
        "MONSTER_ELITE": [["plate", "shard", "core"], ["blade", "debris", "ember"]],
        "MONSTER_BOSS": [["relic", "void", "sigil"], ["mass", "crown", "fragment"]],
    }[tier]
    return {
        "id": identifier,
        "seed": seed,
        "motion": {
            "curve": rng.randint(-56, 56), "controlOne": round(rng.uniform(.24, .44), 3),
            "controlTwo": round(rng.uniform(.58, .81), 3), "spinOne": rng.randint(-35, 35),
            "spinTwo": rng.randint(-46, 46), "contactSpin": rng.randint(-25, 25),
            "chargeMs": rng.randint(105, 224), "chargeMotes": rng.randint(5, 16),
            "wakeCount": rng.randint(5, 16),
        },
        "rupture": {
            "requested": rng.randint(34, 96), "duration": rng.randint(620, 1160),
            "spread": rng.randint(94, 208), "vector": vectors[ordinal % len(vectors)],
            "arc": round(rng.uniform(1.1, 6.2), 3), "shapes": shape_sets[ordinal % len(shape_sets)],
            "afterglowMotes": rng.randint(7, 25),
        },
    }


def sequence_profile(seed: int, identifier: str, tier: str, ordinal: int) -> dict:
    """A five-phase choreography identity, not merely a palette variation."""
    rng = random.Random(seed ^ ordinal * 0x27D4EB2D ^ 0x165667B1)
    charge_styles = ["inward-orbit", "folding-crest", "spiral-condense", "split-converge", "vertical-forge", "pulse-bloom", "fracture-assemble"]
    travel_styles = ["ballistic-arc", "serpentine", "zigzag", "rising-hook", "falling-hook", "orbit-break", "stutter-lunge", "wave-drift", "spiral-bore"]
    contact_styles = ["flat-compress", "vertical-crush", "core-pinch", "forward-fold", "double-pulse", "shell-collapse", "mass-transfer"]
    rupture_by_tier = {
        "CARD": ["petal-burst", "crest-split", "plasma-fan", "ring-shatter", "comet-rip", "cross-nova", "reverse-bloom"],
        "MONSTER_NORMAL": ["maw-burst", "fang-scatter", "organic-pop", "spore-rend", "claw-tear", "pounce-crater", "acid-splash"],
        "MONSTER_ELITE": ["armor-break", "siege-cone", "blade-storm", "plate-collapse", "cross-rend", "core-detonate", "shard-wall"],
        "MONSTER_BOSS": ["ritual-collapse", "dominion-wave", "cathedral-break", "void-inversion", "eclipse-rupture", "throne-fall", "singularity-tear"],
    }
    decay_styles = ["ash-fall", "vapor-rise", "orbital-fade", "reverse-suction", "ground-embers", "shard-drift", "pulse-extinguish", "mist-unwind"]
    charge_index = ordinal % len(charge_styles)
    travel_index = (ordinal // len(charge_styles)) % len(travel_styles)
    contact_index = (ordinal // (len(charge_styles) * len(travel_styles))) % len(contact_styles)
    rupture_index = (ordinal * 5 + (seed >> 7)) % len(rupture_by_tier[tier])
    decay_index = (ordinal * 3 + (seed >> 13)) % len(decay_styles)
    squeeze_x = round(rng.uniform(.48, 1.42), 3)
    squeeze_y = round(rng.uniform(.42, 1.38), 3)
    return {
        "id": f"sequence-{identifier}",
        "charge": {"style": charge_styles[charge_index], "folds": 2 + ordinal % 6, "orbit": round(rng.uniform(-1.8, 1.8), 3), "pulse": round(rng.uniform(.72, 1.48), 3), "phaseKey": f"{identifier}-form-{ordinal:03d}"},
        "travel": {"style": travel_styles[travel_index], "oscillations": 1 + ordinal % 5, "lateral": rng.randint(-68, 68), "stretchX": round(rng.uniform(.62, 1.46), 3), "stretchY": round(rng.uniform(.58, 1.38), 3), "wakeDrift": round(rng.uniform(-1.25, 1.25), 3), "phaseKey": f"{identifier}-travel-{ordinal:03d}"},
        "contact": {"style": contact_styles[contact_index], "squeezeX": squeeze_x, "squeezeY": squeeze_y, "holdMs": rng.randint(36, 78), "rebound": round(rng.uniform(.08, .38), 3), "phaseKey": f"{identifier}-contact-{ordinal:03d}"},
        "rupture": {"style": rupture_by_tier[tier][rupture_index], "expandX": round(rng.uniform(1.18, 2.15), 3), "expandY": round(rng.uniform(1.12, 2.28), 3), "twist": rng.randint(-210, 210), "lobes": 3 + ordinal % 8, "secondaryDelay": rng.randint(28, 118), "phaseKey": f"{identifier}-rupture-{ordinal:03d}"},
        "decay": {"style": decay_styles[decay_index], "driftX": rng.randint(-72, 72), "driftY": rng.randint(-82, 48), "fadeExponent": round(rng.uniform(.62, 1.72), 3), "residualPulses": ordinal % 4, "phaseKey": f"{identifier}-decay-{ordinal:03d}"},
    }


def build_entry(group: str, record: dict, ordinal: int) -> dict:
    identifier = safe_id(record["id"])
    directory = OUTPUT_ROOT / group
    directory.mkdir(parents=True, exist_ok=True)
    launch_path = directory / f"{identifier}_launch.webp"
    impact_path = directory / f"{identifier}_impact.webp"
    launch, launch_recipe = compose(record, group, ordinal, "launch")
    impact, impact_recipe = compose(record, group, ordinal, "impact")
    launch.save(launch_path, "WEBP", quality=91, method=1, exact=True)
    impact.save(impact_path, "WEBP", quality=91, method=1, exact=True)
    tier = tier_for(group, record)
    unique = profile(int(record["seed"]), f"{group[:-1]}-{identifier}", tier, ordinal)
    unique["sequence"] = sequence_profile(int(record["seed"]), identifier, tier, ordinal)
    unique.update({
        "launch": launch_path.relative_to(ROOT).as_posix(), "impact": impact_path.relative_to(ROOT).as_posix(),
        "launchSha256": sha(launch_path), "impactSha256": sha(impact_path),
        "impactFamily": f"{tier.lower()}-{record['impactFamily']}-{identifier}",
        "visualIdentity": {"domain": tier, "launch": launch_recipe, "impact": impact_recipe},
        "legacySources": [record["sourceLaunch"], record["sourceImpact"]],
    })
    return unique


def main() -> None:
    plan = json.loads(PLAN_PATH.read_text(encoding="utf-8"))
    cards = {record["id"]: build_entry("cards", record, index) for index, record in enumerate(plan["cards"])}
    enemies = {record["id"]: build_entry("enemies", record, index + len(cards)) for index, record in enumerate(plan["enemies"])}
    manifest = {"version": "4.0.0-distinct-visual-grammar", "cards": cards, "enemies": enemies}
    MANIFEST_JSON.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    compact = json.dumps(manifest, ensure_ascii=False, separators=(",", ":"))
    MANIFEST_JS.write_text("(function(global){'use strict';const manifest=" + compact + ";global.TRIAD_COMBAT_VFX_SKILL_ASSETS_V4=Object.freeze(manifest)})(window);\n", encoding="utf-8")
    entries = list(cards.values()) + list(enemies.values())
    hashes = [entry[key] for entry in entries for key in ("launchSha256", "impactSha256")]
    recipes = [entry["visualIdentity"][phase]["recipeId"] for entry in entries for phase in ("launch", "impact")]
    result = "PASS" if len(hashes) == 612 and len(set(hashes)) == 612 and len(set(recipes)) == 612 else "FAIL"
    print(json.dumps({"result": result, "skills": len(entries), "assets": len(hashes), "uniqueHashes": len(set(hashes)), "uniqueRecipes": len(set(recipes)), "manifest": MANIFEST_JS.relative_to(ROOT).as_posix()}))
    if result != "PASS":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
