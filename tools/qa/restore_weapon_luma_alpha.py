"""Add bright weapon pixels to an existing RGBA alpha mask without changing RGB."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


def polygon(value: str) -> list[tuple[int, int]]:
    return [tuple(map(int, point.split(","))) for point in value.split(";")]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-rgb", type=Path, required=True)
    parser.add_argument("--base-rgba", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--polygon", type=polygon, action="append", required=True)
    parser.add_argument("--luma", type=int, default=32)
    args = parser.parse_args()
    source = Image.open(args.source_rgb).convert("RGB")
    base = Image.open(args.base_rgba).convert("RGBA")
    if source.size != base.size:
        raise RuntimeError("INPUT_SIZE_MISMATCH")
    support = Image.new("L", source.size, 0)
    draw = ImageDraw.Draw(support)
    for region in args.polygon:
        draw.polygon(region, fill=255)
    rgb = np.asarray(source, dtype=np.uint8)
    alpha = np.asarray(base.getchannel("A"), dtype=np.uint8)
    luminance = (rgb[:, :, 0].astype(np.uint16) * 54 + rgb[:, :, 1].astype(np.uint16) * 183 + rgb[:, :, 2].astype(np.uint16) * 19) // 256
    restore = (np.asarray(support, dtype=np.uint8) > 0) & (luminance >= args.luma)
    output = source.convert("RGBA")
    output.putalpha(Image.fromarray(np.maximum(alpha, restore.astype(np.uint8) * 255), "L"))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    output.save(args.output, format="PNG", optimize=False)


if __name__ == "__main__":
    main()
