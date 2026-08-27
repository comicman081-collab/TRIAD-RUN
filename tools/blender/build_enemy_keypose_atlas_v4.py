"""Build a fixed-registration enemy atlas from approved articulated key poses.

All image loading, scaling, placement, compositing, and output use Blender's
image API.  The atlas is a candidate until actual HTML runtime QA passes.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import bpy
import numpy as np


ROOT = Path(__file__).resolve().parents[2]
ACTOR = "RIFT_M10"
ACTOR_ROOT = ROOT / "assets" / "enemies" / "production_pilot_v4" / ACTOR
KEYPOSE_MANIFEST = ACTOR_ROOT / f"{ACTOR}_KEYPOSE_MANIFEST_V4.json"
OUTPUT = ACTOR_ROOT / f"{ACTOR}_PRODUCTION_PILOT_V4.webp"
MANIFEST_OUTPUT = ACTOR_ROOT / f"{ACTOR}_PRODUCTION_PILOT_V4_MANIFEST.json"
QA_OUTPUT = ROOT / "reports" / "qa" / f"{ACTOR}_PRODUCTION_V4_ATLAS_CONTACT.png"

FRAME_W = 420
FRAME_H = 420
SCALE = 0.72
BASELINE_Y = 20
FRAMES_PER_CLIP = 6
CLIPS = ("IDLE", "ATTACK", "HIT", "DEFEAT")

FRAME_PLAN = {
    "IDLE": (
        ("IDLE", 0, 0), ("IDLE", 0, 1), ("IDLE", 0, 2),
        ("IDLE", 0, 1), ("IDLE", 0, 0), ("IDLE", 0, -1),
    ),
    "ATTACK": (
        ("IDLE", 0, 0), ("ATTACK_WINDUP", 4, 0), ("ATTACK_WINDUP", 2, 1),
        ("ATTACK_CONTACT", -8, 0), ("ATTACK_RECOVERY", -2, 0), ("IDLE", 0, 0),
    ),
    "HIT": (
        ("IDLE", 0, 0), ("HIT", 8, 1), ("HIT", 10, 0),
        ("HIT", 6, -1), ("ATTACK_RECOVERY", 2, 0), ("IDLE", 0, 0),
    ),
    "DEFEAT": (
        ("IDLE", 0, 0), ("HIT", 5, 0), ("DEFEAT", 0, 0),
        ("DEFEAT", 0, 0), ("DEFEAT", 0, 0), ("DEFEAT", 0, 0),
    ),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_scaled(path: Path, width: int, height: int) -> np.ndarray:
    image = bpy.data.images.load(str(path), check_existing=False)
    image.scale(width, height)
    pixels = np.empty(width * height * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    array = pixels.reshape((height, width, 4))
    bpy.data.images.remove(image)
    return array


def save_pixels(path: Path, array: np.ndarray, file_format: str) -> None:
    height, width, _channels = array.shape
    image = bpy.data.images.new(path.stem, width=width, height=height, alpha=True, float_buffer=False)
    image.pixels.foreach_set(np.asarray(array, dtype=np.float32).reshape(-1))
    image.filepath_raw = str(path)
    image.file_format = file_format
    image.save()
    bpy.data.images.remove(image)


def alpha_over(destination: np.ndarray, source: np.ndarray, x: int, y: int) -> None:
    height, width, _channels = source.shape
    dst_x0 = max(0, x)
    dst_y0 = max(0, y)
    dst_x1 = min(destination.shape[1], x + width)
    dst_y1 = min(destination.shape[0], y + height)
    if dst_x0 >= dst_x1 or dst_y0 >= dst_y1:
        return
    src_x0 = dst_x0 - x
    src_y0 = dst_y0 - y
    src_x1 = src_x0 + (dst_x1 - dst_x0)
    src_y1 = src_y0 + (dst_y1 - dst_y0)
    src = source[src_y0:src_y1, src_x0:src_x1]
    dst = destination[dst_y0:dst_y1, dst_x0:dst_x1]
    src_alpha = src[:, :, 3:4]
    dst_alpha = dst[:, :, 3:4]
    out_alpha = src_alpha + dst_alpha * (1.0 - src_alpha)
    out_rgb = np.where(
        out_alpha > 1e-6,
        (src[:, :, :3] * src_alpha + dst[:, :, :3] * dst_alpha * (1.0 - src_alpha)) / np.maximum(out_alpha, 1e-6),
        0.0,
    )
    dst[:, :, :3] = out_rgb
    dst[:, :, 3:4] = out_alpha


def pose_frame(record: dict[str, object], dx: int = 0, dy: int = 0) -> np.ndarray:
    path = ROOT / str(record["path"])
    source_width = int(record["width"])
    source_height = int(record["height"])
    width = max(1, round(source_width * SCALE))
    height = max(1, round(source_height * SCALE))
    image = load_scaled(path, width, height)
    min_x, min_y, _max_x, _max_y = [int(value) for value in record["sourceBbox"]]
    pose_index = list(POSE_ORDER).index(str(record["pose"]))
    cell_column = pose_index % 3
    cell_row = 1 if pose_index < 3 else 0
    cell_center_x = cell_column * 512 + 256
    cell_origin_y = cell_row * 512
    x = round(FRAME_W / 2 - (cell_center_x - min_x) * SCALE) + dx
    y = round(BASELINE_Y + (min_y - cell_origin_y) * SCALE) + dy
    frame = np.zeros((FRAME_H, FRAME_W, 4), dtype=np.float32)
    alpha_over(frame, image, x, y)
    return frame


POSE_ORDER = ("IDLE", "ATTACK_WINDUP", "ATTACK_CONTACT", "ATTACK_RECOVERY", "HIT", "DEFEAT")


def main() -> int:
    source_manifest = json.loads(KEYPOSE_MANIFEST.read_text(encoding="utf-8"))
    records = {record["pose"]: record for record in source_manifest["poses"]}
    missing = [pose for pose in POSE_ORDER if pose not in records]
    if missing:
        raise RuntimeError(f"Missing key poses: {missing}")

    atlas = np.zeros((FRAME_H * len(CLIPS), FRAME_W * FRAMES_PER_CLIP, 4), dtype=np.float32)
    generated_frames: list[dict[str, object]] = []
    for clip_row, clip in enumerate(CLIPS):
        for column, (pose, dx, dy) in enumerate(FRAME_PLAN[clip]):
            frame = pose_frame(records[pose], dx, dy)
            storage_row = len(CLIPS) - 1 - clip_row
            y0 = storage_row * FRAME_H
            x0 = column * FRAME_W
            atlas[y0:y0 + FRAME_H, x0:x0 + FRAME_W] = frame
            generated_frames.append({"clip": clip, "frame": column, "pose": pose, "offset": [dx, dy]})

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    save_pixels(OUTPUT, atlas, "WEBP")

    dark = np.zeros_like(atlas)
    dark[:, :, :3] = np.array((0.025, 0.038, 0.065), dtype=np.float32)
    dark[:, :, 3] = 1.0
    alpha = atlas[:, :, 3:4]
    dark[:, :, :3] = atlas[:, :, :3] * alpha + dark[:, :, :3] * (1.0 - alpha)
    QA_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    save_pixels(QA_OUTPUT, dark, "PNG")

    clips = {
        "IDLE": {"row": 0, "frames": 6, "fps": 6, "loop": True},
        "ATTACK": {"row": 1, "frames": 6, "fps": 10, "loop": False, "events": {"impact": 3}},
        "HIT": {"row": 2, "frames": 6, "fps": 12, "loop": False, "events": {"impact": 1}},
        "DEFEAT": {"row": 3, "frames": 6, "fps": 8, "loop": False, "holdLastFrame": True},
    }
    manifest = {
        "schema": "triad.enemy-production-pilot.v4",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "id": ACTOR,
        "rank": "ELITE",
        "status": "PASS_ACTIVE_CANDIDATE",
        "runtimeActive": False,
        "faction": "ENEMY",
        "battleLane": "RIGHT",
        "facing": "LEFT",
        "atlas": OUTPUT.relative_to(ROOT).as_posix(),
        "atlasSha256": sha256(OUTPUT),
        "frameWidth": FRAME_W,
        "frameHeight": FRAME_H,
        "columns": FRAMES_PER_CLIP,
        "rows": len(CLIPS),
        "clips": clips,
        "sourceKeyposeManifest": KEYPOSE_MANIFEST.relative_to(ROOT).as_posix(),
        "sourceKeyposeManifestSha256": sha256(KEYPOSE_MANIFEST),
        "pipeline": "IMAGEGEN_KEYPOSES__BLENDER_ALPHA_REGISTRATION_ATLAS",
        "runtimeTransform": {"scale": 1, "translate": [0, 0]},
        "framePlan": generated_frames,
        "qaContact": QA_OUTPUT.relative_to(ROOT).as_posix(),
    }
    MANIFEST_OUTPUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "atlas": str(OUTPUT),
        "atlasSha256": manifest["atlasSha256"],
        "manifest": str(MANIFEST_OUTPUT),
        "contact": str(QA_OUTPUT),
        "frames": len(generated_frames),
        "runtimeActive": False,
    }, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
