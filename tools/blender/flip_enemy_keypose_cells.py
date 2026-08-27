"""Flip selected 3x2 enemy key-pose cells without touching the source sheet.

Run inside Blender:
  blender -b --python tools/blender/flip_enemy_keypose_cells.py -- ACTOR 1,2 OUTPUT.png

Cell order matches the production contract:
IDLE, ATTACK_WINDUP, ATTACK_CONTACT, ATTACK_RECOVERY, HIT, DEFEAT.
"""

from __future__ import annotations

import sys
from pathlib import Path

import bpy
import numpy as np


ROOT = Path(__file__).resolve().parents[2]


def load_rgba(path: Path) -> np.ndarray:
    image = bpy.data.images.load(str(path), check_existing=False)
    pixels = np.empty(image.size[0] * image.size[1] * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    rgba = pixels.reshape((image.size[1], image.size[0], 4))
    bpy.data.images.remove(image)
    return rgba


def save_rgba(path: Path, rgba: np.ndarray) -> None:
    height, width, _channels = rgba.shape
    image = bpy.data.images.new(path.stem, width=width, height=height, alpha=True, float_buffer=False)
    image.pixels.foreach_set(np.asarray(rgba, dtype=np.float32).reshape(-1))
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()
    bpy.data.images.remove(image)


def main() -> int:
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(args) < 3:
        raise ValueError("Expected ACTOR CELL_INDICES OUTPUT_NAME")
    actor, indices_text, output_name = args[:3]
    indices = {int(value) for value in indices_text.split(",")}
    if not indices or any(index < 0 or index > 5 for index in indices):
        raise ValueError("CELL_INDICES must be within 0..5")

    actor_root = ROOT / "assets" / "enemies" / "production_pilot_v4" / actor
    source = actor_root / f"{actor}_KEYPOSE_SHEET_RAW.png"
    output = actor_root / output_name
    rgba = load_rgba(source)
    height, width, _channels = rgba.shape
    cell_w, cell_h = width // 3, height // 2

    for index in indices:
        column = index % 3
        storage_row = 1 if index < 3 else 0
        x0, x1 = column * cell_w, width if column == 2 else (column + 1) * cell_w
        y0, y1 = storage_row * cell_h, height if storage_row == 1 else cell_h
        # Blender stores pixels as H x W x RGBA. Reverse the X dimension only;
        # reversing the final dimension would corrupt RGBA channel order.
        cell = rgba[y0:y1, x0:x1].copy()
        rgba[y0:y1, x0:x1] = cell[:, ::-1, :]

    save_rgba(output, rgba)
    print({"actor": actor, "source": str(source), "output": str(output), "flippedCells": sorted(indices)}, flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
