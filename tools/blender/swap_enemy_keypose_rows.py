"""Swap the two physical rows in a 3x2 enemy key-pose source sheet.

This is a deterministic registration repair for sheets authored as:
  top:    ATTACK_RECOVERY, HIT, DEFEAT
  bottom: IDLE, ATTACK_WINDUP, ATTACK_CONTACT

The production extractor expects the opposite physical row order. The source is
left untouched and a separate corrected PNG is written.

Run inside Blender:
  blender -b --python tools/blender/swap_enemy_keypose_rows.py -- ACTOR OUTPUT.png
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
    if len(args) < 2:
        raise ValueError("Expected ACTOR OUTPUT_NAME")
    actor, output_name = args[:2]
    actor_root = ROOT / "assets" / "enemies" / "production_pilot_v4" / actor
    source = actor_root / f"{actor}_KEYPOSE_SHEET_RAW.png"
    output = actor_root / output_name
    rgba = load_rgba(source)
    height = rgba.shape[0]
    if height % 2:
        raise ValueError(f"Sheet height must be even: {height}")
    half = height // 2
    corrected = np.concatenate((rgba[half:].copy(), rgba[:half].copy()), axis=0)
    save_rgba(output, corrected)
    print({"actor": actor, "source": str(source), "output": str(output), "rowsSwapped": True}, flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
