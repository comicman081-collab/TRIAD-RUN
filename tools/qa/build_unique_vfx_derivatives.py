#!/usr/bin/env python3
"""Build one-to-one transparent skill VFX derivatives from authored source art.

This is deterministic image processing, not image generation.  The existing
high-resolution VFX files remain the visual authority.  Each output uses only
whole-source deformation and cropped source fragments permitted by the VFX
contract, and is saved as a separate transparent WebP runtime asset.
"""

from __future__ import annotations

from hashlib import sha256
from pathlib import Path
import json
import math
import random
import re

from PIL import Image, ImageChops, ImageEnhance, ImageOps


ROOT = Path(__file__).resolve().parents[2]
PLAN_PATH = ROOT / "qa_artifacts" / "combat_vfx_v3" / "unique_vfx_plan.json"
OUTPUT_ROOT = ROOT / "assets" / "vfx" / "derived_v3"
MANIFEST_JSON = OUTPUT_ROOT / "manifest.json"
MANIFEST_JS = ROOT / "combat_vfx_skill_assets_v3.js"
CANVAS = 640
RESAMPLE = Image.Resampling.LANCZOS


def safe_id(value: str) -> str:
    return re.sub(r"[^a-z0-9_-]+", "-", value.lower()).strip("-")


def crop_alpha(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    box = rgba.getchannel("A").getbbox()
    return rgba.crop(box) if box else rgba


def fit_authored(image: Image.Image, width: int, height: int, stretch_x: float, stretch_y: float) -> Image.Image:
    source = image.copy()
    source.thumbnail((width, height), RESAMPLE)
    target = source.resize((max(8, int(source.width * stretch_x)), max(8, int(source.height * stretch_y))), RESAMPLE)
    return target


def band_displace(image: Image.Image, seed: int, strength: int) -> Image.Image:
    rng = random.Random(seed)
    output = Image.new("RGBA", image.size, (0, 0, 0, 0))
    band = 18 + seed % 17
    phase = rng.random() * math.tau
    for top in range(0, image.height, band):
        bottom = min(image.height, top + band)
        shift = int(math.sin(phase + top / max(1, image.height) * math.tau * (1 + seed % 3)) * strength)
        piece = image.crop((0, top, image.width, bottom))
        output.alpha_composite(piece, (shift, top))
    return output


def opacity(image: Image.Image, amount: float) -> Image.Image:
    result = image.copy()
    result.putalpha(result.getchannel("A").point(lambda value: int(value * amount)))
    return result


def place(canvas: Image.Image, image: Image.Image, x: int, y: int) -> None:
    canvas.alpha_composite(image, (int(x - image.width / 2), int(y - image.height / 2)))


def authored_fragment(source: Image.Image, rng: random.Random, size: int) -> Image.Image:
    width = max(16, int(source.width * rng.uniform(.24, .48)))
    height = max(16, int(source.height * rng.uniform(.24, .48)))
    left = rng.randint(0, max(0, source.width - width))
    top = rng.randint(0, max(0, source.height - height))
    fragment = crop_alpha(source.crop((left, top, left + width, top + height)))
    fragment.thumbnail((size, size), RESAMPLE)
    return fragment


def render_variant(source: Image.Image, seed: int, phase: str) -> Image.Image:
    rng = random.Random(seed ^ (0x9E3779B9 if phase == "impact" else 0x85EBCA6B))
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    is_impact = phase == "impact"
    max_width = rng.randint(455, 590) if is_impact else rng.randint(350, 515)
    max_height = rng.randint(455, 590) if is_impact else rng.randint(290, 485)
    main = fit_authored(source, max_width, max_height, rng.uniform(.82, 1.18), rng.uniform(.82, 1.18))
    if rng.random() < .46:
        main = ImageOps.mirror(main)
    main = band_displace(main, seed, rng.randint(3, 13) if is_impact else rng.randint(2, 7))
    main = main.rotate(rng.uniform(-24, 24) if is_impact else rng.uniform(-14, 14), resample=Image.Resampling.BICUBIC, expand=True)
    main = ImageEnhance.Contrast(main).enhance(rng.uniform(.96, 1.12))

    if is_impact:
        fragment_count = 2 + seed % 4
        for index in range(fragment_count):
            fragment = authored_fragment(source, rng, rng.randint(90, 210))
            fragment = opacity(fragment.rotate(rng.uniform(-65, 65), resample=Image.Resampling.BICUBIC, expand=True), rng.uniform(.48, .82))
            angle = rng.uniform(0, math.tau)
            radius = rng.uniform(95, 235)
            place(canvas, fragment, CANVAS // 2 + math.cos(angle) * radius, CANVAS // 2 + math.sin(angle) * radius * .72)
    else:
        wake_count = 1 + seed % 3
        for index in range(wake_count):
            fragment = authored_fragment(source, rng, rng.randint(75, 150))
            fragment = opacity(fragment.rotate(rng.uniform(-35, 35), resample=Image.Resampling.BICUBIC, expand=True), rng.uniform(.34, .62))
            place(canvas, fragment, CANVAS // 2 - rng.randint(110, 230), CANVAS // 2 + rng.randint(-95, 95))
    place(canvas, main, CANVAS // 2 + rng.randint(-20, 20), CANVAS // 2 + rng.randint(-20, 20))
    box = canvas.getchannel("A").getbbox()
    if box:
        cropped = canvas.crop(box)
        fitted = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
        cropped.thumbnail((CANVAS - 16, CANVAS - 16), RESAMPLE)
        place(fitted, cropped, CANVAS // 2, CANVAS // 2)
        return fitted
    return canvas


def sha(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest().upper()


def profile(seed: int, identifier: str) -> dict:
    rng = random.Random(seed)
    vectors = ["fan", "cone", "radial", "implode", "ground", "spiral", "halo", "plume"]
    shape_sets = [["blob", "shard", "lump"], ["shard", "blob", "shard"], ["lump", "blob", "lump"], ["shard", "lump", "blob"]]
    return {
        "id": identifier,
        "seed": seed,
        "motion": {
            "curve": rng.randint(-42, 42),
            "controlOne": round(rng.uniform(.27, .42), 3),
            "controlTwo": round(rng.uniform(.61, .78), 3),
            "spinOne": rng.randint(-24, 24),
            "spinTwo": rng.randint(-32, 32),
            "contactSpin": rng.randint(-18, 18),
            "chargeMs": rng.randint(112, 196),
            "chargeMotes": rng.randint(5, 13),
            "wakeCount": rng.randint(5, 13)
        },
        "rupture": {
            "requested": rng.randint(30, 88),
            "duration": rng.randint(610, 1080),
            "spread": rng.randint(88, 184),
            "vector": vectors[seed % len(vectors)],
            "arc": round(rng.uniform(1.18, 6.12), 3),
            "shapes": shape_sets[(seed >> 3) % len(shape_sets)],
            "afterglowMotes": rng.randint(6, 22)
        }
    }


def build_entry(group: str, record: dict) -> dict:
    seed = int(record["seed"])
    identifier = safe_id(record["id"])
    directory = OUTPUT_ROOT / group
    directory.mkdir(parents=True, exist_ok=True)
    launch_path = directory / f"{identifier}_launch.webp"
    impact_path = directory / f"{identifier}_impact.webp"
    launch_source = crop_alpha(Image.open(ROOT / record["sourceLaunch"]))
    impact_source = crop_alpha(Image.open(ROOT / record["sourceImpact"]))
    render_variant(launch_source, seed, "launch").save(launch_path, "WEBP", quality=90, method=1, exact=True)
    render_variant(impact_source, seed, "impact").save(impact_path, "WEBP", quality=90, method=1, exact=True)
    unique = profile(seed, f"{group[:-1]}-{identifier}")
    unique.update({
        "launch": launch_path.relative_to(ROOT).as_posix(),
        "impact": impact_path.relative_to(ROOT).as_posix(),
        "launchSha256": sha(launch_path),
        "impactSha256": sha(impact_path),
        "sourceLaunch": record["sourceLaunch"],
        "sourceImpact": record["sourceImpact"],
        "impactFamily": record["impactFamily"]
    })
    return unique


def main() -> None:
    plan = json.loads(PLAN_PATH.read_text(encoding="utf-8"))
    cards = {record["id"]: build_entry("cards", record) for record in plan["cards"]}
    enemies = {record["id"]: build_entry("enemies", record) for record in plan["enemies"]}
    manifest = {"version": plan["version"], "cards": cards, "enemies": enemies}
    MANIFEST_JSON.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    compact = json.dumps(manifest, ensure_ascii=False, separators=(",", ":"))
    MANIFEST_JS.write_text(
        "(function(global){'use strict';const manifest=" + compact + ";global.TRIAD_COMBAT_VFX_SKILL_ASSETS_V3=Object.freeze(manifest)})(window);\n",
        encoding="utf-8"
    )
    all_hashes = [entry[key] for entries in (cards, enemies) for entry in entries.values() for key in ("launchSha256", "impactSha256")]
    result = "PASS" if len(all_hashes) == 612 and len(set(all_hashes)) == 612 else "FAIL"
    print(json.dumps({"result": result, "cards": len(cards), "enemies": len(enemies), "assets": len(all_hashes), "uniqueHashes": len(set(all_hashes)), "manifest": MANIFEST_JS.relative_to(ROOT).as_posix()}))
    if result != "PASS":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
