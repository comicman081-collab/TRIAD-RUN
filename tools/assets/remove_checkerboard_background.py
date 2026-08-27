"""Convert a baked white/grey checkerboard into a transparent RGBA image.

The script is intentionally conservative: only bright, near-neutral pixels
connected to the image border are treated as background.  This preserves
white/silver costume regions that are enclosed by the character silhouette.
It runs inside Blender so lobby asset post-processing stays in the approved
local graphics pipeline.

Example:
    blender -b --python tools/assets/remove_checkerboard_background.py -- \
      --input source.png --output subject_rgba.png --metadata subject_rgba.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from array import array
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

import bpy


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--metadata", type=Path, required=True)
    parser.add_argument("--neutral-delta", type=float, default=0.065)
    parser.add_argument("--minimum-channel", type=float, default=0.82)
    parser.add_argument("--edge-feather", type=int, default=1)
    parser.add_argument("--all-neutral", action="store_true", help="remove matching checker cells even when hair or cloth encloses them")
    return parser.parse_args(argv)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest().upper()


def main() -> int:
    args = parse_args()
    source = args.input.resolve()
    output = args.output.resolve()
    metadata_path = args.metadata.resolve()
    if not source.is_file():
        raise FileNotFoundError(source)
    if output.exists() or metadata_path.exists():
        raise FileExistsError(output if output.exists() else metadata_path)

    image = bpy.data.images.load(str(source), check_existing=False)
    width, height = map(int, image.size)
    pixels = array("f", [0.0]) * (width * height * 4)
    image.pixels.foreach_get(pixels)

    def background_like(index: int) -> bool:
        base = index * 4
        red, green, blue = pixels[base : base + 3]
        return (
            min(red, green, blue) >= args.minimum_channel
            and max(red, green, blue) - min(red, green, blue) <= args.neutral_delta
        )

    background = bytearray(width * height)
    queue: deque[int] = deque()

    def seed(x: int, y: int) -> None:
        index = y * width + x
        if not background[index] and background_like(index):
            background[index] = 1
            queue.append(index)

    for x in range(width):
        seed(x, 0)
        seed(x, height - 1)
    for y in range(height):
        seed(0, y)
        seed(width - 1, y)

    while queue:
        index = queue.popleft()
        x = index % width
        y = index // width
        if x > 0:
            seed(x - 1, y)
        if x + 1 < width:
            seed(x + 1, y)
        if y > 0:
            seed(x, y - 1)
        if y + 1 < height:
            seed(x, y + 1)

    if args.all_neutral:
        for index in range(width * height):
            if background_like(index):
                background[index] = 1

    # One conservative feather ring reduces checkerboard halos without
    # eroding costume interiors.  Only near-neutral frontier pixels qualify.
    frontier = bytearray(width * height)
    for _ in range(max(0, args.edge_feather)):
        next_frontier = bytearray(width * height)
        for index, is_background in enumerate(background):
            if not is_background:
                continue
            x = index % width
            y = index // width
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if not (0 <= nx < width and 0 <= ny < height):
                    continue
                neighbour = ny * width + nx
                if background[neighbour] or frontier[neighbour]:
                    continue
                base = neighbour * 4
                red, green, blue = pixels[base : base + 3]
                if min(red, green, blue) >= 0.68 and max(red, green, blue) - min(red, green, blue) <= 0.11:
                    next_frontier[neighbour] = 1
        for index, value in enumerate(next_frontier):
            if value:
                frontier[index] = 1
                background[index] = 1

    result = array("f", [0.0]) * (width * height * 4)
    foreground_pixels = 0
    for index in range(width * height):
        base = index * 4
        if background[index]:
            result[base : base + 4] = array("f", (0.0, 0.0, 0.0, 0.0))
        else:
            red, green, blue = pixels[base : base + 3]
            result[base : base + 4] = array("f", (red, green, blue, 1.0))
            foreground_pixels += 1

    rgba = bpy.data.images.new(
        "TRIAD_LOBBY_CHECKERBOARD_REMOVAL",
        width=width,
        height=height,
        alpha=True,
        float_buffer=False,
    )
    rgba.colorspace_settings.name = "sRGB"
    rgba.alpha_mode = "STRAIGHT"
    rgba.pixels.foreach_set(result)
    rgba.filepath_raw = str(output)
    rgba.file_format = "PNG"
    output.parent.mkdir(parents=True, exist_ok=True)
    rgba.save()

    metadata = {
        "schema": "triad.lobby.checkerboard-removal.v1",
        "status": "ALPHA_CANDIDATE_VISUAL_QA_REQUIRED",
        "runtimeEligible": False,
        "source": str(source),
        "sourceSha256": sha256(source),
        "output": str(output),
        "outputSha256": sha256(output),
        "canvas": {"width": width, "height": height},
        "foregroundPixels": foreground_pixels,
        "foregroundFraction": foreground_pixels / (width * height),
        "parameters": {
            "neutralDelta": args.neutral_delta,
            "minimumChannel": args.minimum_channel,
            "edgeFeather": args.edge_feather,
            "borderConnectedOnly": not args.all_neutral,
            "allNeutral": args.all_neutral,
        },
        "rgbRegenerated": False,
        "modelFilesModified": False,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"RGBA_OUTPUT={output}")
    print(f"FOREGROUND_FRACTION={metadata['foregroundFraction']:.6f}")
    print(f"OUTPUT_SHA256={metadata['outputSha256']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
