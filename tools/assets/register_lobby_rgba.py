"""Bake one transparent lobby-character cutout into the canonical canvas.

This script performs geometric registration only.  It never generates or
inpaints pixels: the source RGBA is alpha-cropped, premultiplied, resampled,
and centered into a transparent 1024x1536 canvas.  Run it with Blender so the
project's graphics pipeline remains Blender-only.

Example:
    blender -b --python tools/assets/register_lobby_rgba.py -- \
      --input rift_lobby_rgba_v4_clean.png \
      --output rift_lobby_rgba_v5_registered.png \
      --metadata rift_lobby_rgba_v5_registered.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from array import array
from datetime import datetime, timezone
from pathlib import Path

import bpy


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--metadata", type=Path, required=True)
    parser.add_argument("--width", type=int, default=1024)
    parser.add_argument("--height", type=int, default=1536)
    parser.add_argument("--padding", type=int, default=40)
    parser.add_argument("--alpha-threshold", type=float, default=0.01)
    parser.add_argument("--bbox-expand", type=int, default=2)
    return parser.parse_args(argv)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest().upper()


def alpha_bbox(
    pixels: array, width: int, height: int, threshold: float
) -> tuple[int, int, int, int]:
    min_x, min_y = width, height
    max_x = max_y = -1
    for y in range(height):
        row = y * width * 4
        for x in range(width):
            if pixels[row + x * 4 + 3] > threshold:
                min_x = min(min_x, x)
                max_x = max(max_x, x)
                min_y = min(min_y, y)
                max_y = max(max_y, y)
    if max_x < min_x or max_y < min_y:
        raise ValueError("The source contains no non-transparent pixels")
    return min_x, min_y, max_x, max_y


def main() -> int:
    args = parse_args()
    source = args.input.resolve()
    output = args.output.resolve()
    metadata_path = args.metadata.resolve()
    if not source.is_file():
        raise FileNotFoundError(source)
    if output.exists() or metadata_path.exists():
        raise FileExistsError(output if output.exists() else metadata_path)
    if args.padding < 0 or args.padding * 2 >= min(args.width, args.height):
        raise ValueError("Invalid canvas padding")
    output.parent.mkdir(parents=True, exist_ok=True)
    metadata_path.parent.mkdir(parents=True, exist_ok=True)

    source_image = bpy.data.images.load(str(source), check_existing=False)
    source_width, source_height = map(int, source_image.size)
    source_pixels = array("f", [0.0]) * (source_width * source_height * 4)
    source_image.pixels.foreach_get(source_pixels)

    min_x, min_y, max_x, max_y = alpha_bbox(
        source_pixels, source_width, source_height, args.alpha_threshold
    )
    min_x = max(0, min_x - args.bbox_expand)
    min_y = max(0, min_y - args.bbox_expand)
    max_x = min(source_width - 1, max_x + args.bbox_expand)
    max_y = min(source_height - 1, max_y + args.bbox_expand)
    crop_width = max_x - min_x + 1
    crop_height = max_y - min_y + 1

    # Premultiplication keeps hidden source-background RGB from bleeding into
    # translucent edges during Blender's resampling step.
    crop_pixels = array("f", [0.0]) * (crop_width * crop_height * 4)
    for crop_y in range(crop_height):
        source_y = min_y + crop_y
        for crop_x in range(crop_width):
            source_x = min_x + crop_x
            source_index = (source_y * source_width + source_x) * 4
            crop_index = (crop_y * crop_width + crop_x) * 4
            red, green, blue, alpha = source_pixels[source_index : source_index + 4]
            crop_pixels[crop_index : crop_index + 4] = array(
                "f", (red * alpha, green * alpha, blue * alpha, alpha)
            )

    crop_image = bpy.data.images.new(
        "TRIAD_LOBBY_REGISTER_CROP",
        width=crop_width,
        height=crop_height,
        alpha=True,
        float_buffer=False,
    )
    crop_image.colorspace_settings.name = "sRGB"
    crop_image.alpha_mode = "STRAIGHT"
    crop_image.pixels.foreach_set(crop_pixels)

    available_width = args.width - args.padding * 2
    available_height = args.height - args.padding * 2
    scale = min(available_width / crop_width, available_height / crop_height)
    registered_width = max(1, round(crop_width * scale))
    registered_height = max(1, round(crop_height * scale))
    crop_image.scale(registered_width, registered_height)
    scaled_pixels = array("f", [0.0]) * (registered_width * registered_height * 4)
    crop_image.pixels.foreach_get(scaled_pixels)

    target_pixels = array("f", [0.0]) * (args.width * args.height * 4)
    offset_x = (args.width - registered_width) // 2
    offset_y = (args.height - registered_height) // 2
    for y in range(registered_height):
        for x in range(registered_width):
            source_index = (y * registered_width + x) * 4
            target_index = ((offset_y + y) * args.width + offset_x + x) * 4
            red_p, green_p, blue_p, alpha = scaled_pixels[source_index : source_index + 4]
            if alpha > 1e-6:
                red, green, blue = red_p / alpha, green_p / alpha, blue_p / alpha
            else:
                red = green = blue = 0.0
            target_pixels[target_index : target_index + 4] = array(
                "f", (red, green, blue, alpha)
            )

    registered_image = bpy.data.images.new(
        "TRIAD_LOBBY_REGISTERED",
        width=args.width,
        height=args.height,
        alpha=True,
        float_buffer=False,
    )
    registered_image.colorspace_settings.name = "sRGB"
    registered_image.alpha_mode = "STRAIGHT"
    registered_image.pixels.foreach_set(target_pixels)
    registered_image.filepath_raw = str(output)
    registered_image.file_format = "PNG"
    registered_image.save()

    metadata = {
        "status": "REGISTERED_CANDIDATE_VISUAL_QA_REQUIRED",
        "runtimeEligible": False,
        "assetType": "NON_SD_CHARACTER_RGBA",
        "backgroundPolicy": "TRANSPARENT_ONLY",
        "source": str(source),
        "sourceSha256": sha256(source),
        "output": str(output),
        "outputSha256": sha256(output),
        "sourceCanvas": {"width": source_width, "height": source_height},
        "sourceAlphaBbox": {
            "minX": min_x,
            "minY": min_y,
            "maxX": max_x,
            "maxY": max_y,
        },
        "canonicalCanvas": {"width": args.width, "height": args.height},
        "registeredSize": {"width": registered_width, "height": registered_height},
        "registeredOffset": {"x": offset_x, "y": offset_y},
        "scale": scale,
        "padding": args.padding,
        "rgbRegenerated": False,
        "geometricRegistrationOnly": True,
        "modelFilesModified": False,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"REGISTERED_OUTPUT={output}")
    print(f"CANVAS={args.width}x{args.height}")
    print(f"SOURCE_ALPHA_BBOX={min_x},{min_y},{max_x},{max_y}")
    print(f"REGISTERED_SIZE={registered_width}x{registered_height}")
    print(f"REGISTERED_OFFSET={offset_x},{offset_y}")
    print(f"OUTPUT_SHA256={metadata['outputSha256']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
