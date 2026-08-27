"""Build a fixed-registration four-state enemy atlas from six RGBA key poses."""

from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import bpy
import numpy as np


ROOT = Path(__file__).resolve().parents[2]
FRAME_W = 420
FRAME_H = 420
BASELINE_Y = 18
FRAMES_PER_CLIP = 6
CLIPS = ("IDLE", "ATTACK", "HIT", "DEFEAT")
POSE_ORDER = ("IDLE", "ATTACK_WINDUP", "ATTACK_CONTACT", "ATTACK_RECOVERY", "HIT", "DEFEAT")
FRAME_PLAN = {
    "IDLE": (("IDLE", 0, 0), ("IDLE", 0, 1), ("IDLE", 0, 2), ("IDLE", 0, 1), ("IDLE", 0, 0), ("IDLE", 0, -1)),
    "ATTACK": (("IDLE", 0, 0), ("ATTACK_WINDUP", 4, 0), ("ATTACK_WINDUP", 2, 1), ("ATTACK_CONTACT", -8, 0), ("ATTACK_RECOVERY", -2, 0), ("IDLE", 0, 0)),
    "HIT": (("IDLE", 0, 0), ("HIT", 8, 1), ("HIT", 10, 0), ("HIT", 6, -1), ("ATTACK_RECOVERY", 2, 0), ("IDLE", 0, 0)),
    "DEFEAT": (("IDLE", 0, 0), ("HIT", 5, 0), ("DEFEAT", 0, 0), ("DEFEAT", 0, 0), ("DEFEAT", 0, 0), ("DEFEAT", 0, 0)),
}


def arguments() -> tuple[str, str]:
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return (args[0] if args else "SHADE_M01", args[1].upper() if len(args) > 1 else "NORMAL")


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
    dst_x0, dst_y0 = max(0, x), max(0, y)
    dst_x1, dst_y1 = min(destination.shape[1], x + width), min(destination.shape[0], y + height)
    if dst_x0 >= dst_x1 or dst_y0 >= dst_y1:
        return
    src_x0, src_y0 = dst_x0 - x, dst_y0 - y
    src = source[src_y0 : src_y0 + (dst_y1 - dst_y0), src_x0 : src_x0 + (dst_x1 - dst_x0)]
    dst = destination[dst_y0:dst_y1, dst_x0:dst_x1]
    src_alpha, dst_alpha = src[:, :, 3:4], dst[:, :, 3:4]
    out_alpha = src_alpha + dst_alpha * (1.0 - src_alpha)
    dst[:, :, :3] = np.where(out_alpha > 1e-6, (src[:, :, :3] * src_alpha + dst[:, :, :3] * dst_alpha * (1.0 - src_alpha)) / np.maximum(out_alpha, 1e-6), 0.0)
    dst[:, :, 3:4] = out_alpha


def main() -> int:
    actor, rank = arguments()
    actor_root = ROOT / "assets" / "enemies" / "production_pilot_v4" / actor
    keypose_manifest = actor_root / f"{actor}_KEYPOSE_MANIFEST_V4.json"
    source_manifest = json.loads(keypose_manifest.read_text(encoding="utf-8"))
    records = {record["pose"]: record for record in source_manifest["poses"]}
    missing = [pose for pose in POSE_ORDER if pose not in records]
    if missing:
        raise RuntimeError(f"Missing key poses: {missing}")

    max_width = max(int(record["width"]) for record in records.values())
    max_height = max(int(record["height"]) for record in records.values())
    scale = min((FRAME_W - 24) / max_width, (FRAME_H - BASELINE_Y - 14) / max_height)

    def pose_frame(record: dict[str, object], dx: int = 0, dy: int = 0) -> np.ndarray:
        width = max(1, round(int(record["width"]) * scale))
        height = max(1, round(int(record["height"]) * scale))
        image = load_scaled(ROOT / str(record["path"]), width, height)
        x = round((FRAME_W - width) / 2) + dx
        y = BASELINE_Y + dy
        frame = np.zeros((FRAME_H, FRAME_W, 4), dtype=np.float32)
        alpha_over(frame, image, x, y)
        return frame

    atlas = np.zeros((FRAME_H * len(CLIPS), FRAME_W * FRAMES_PER_CLIP, 4), dtype=np.float32)
    generated_frames: list[dict[str, object]] = []
    for clip_row, clip in enumerate(CLIPS):
        for column, (pose, dx, dy) in enumerate(FRAME_PLAN[clip]):
            frame = pose_frame(records[pose], dx, dy)
            storage_row = len(CLIPS) - 1 - clip_row
            atlas[storage_row * FRAME_H : (storage_row + 1) * FRAME_H, column * FRAME_W : (column + 1) * FRAME_W] = frame
            generated_frames.append({"clip": clip, "frame": column, "pose": pose, "offset": [dx, dy]})

    output = actor_root / f"{actor}_PRODUCTION_PILOT_V4.webp"
    manifest_output = actor_root / f"{actor}_PRODUCTION_PILOT_V4_MANIFEST.json"
    qa_output = ROOT / "reports" / "qa" / f"{actor}_PRODUCTION_V4_ATLAS_CONTACT.png"
    save_pixels(output, atlas, "WEBP")
    dark = np.zeros_like(atlas)
    dark[:, :, :3] = np.array((0.025, 0.038, 0.065), dtype=np.float32)
    dark[:, :, 3] = 1.0
    alpha = atlas[:, :, 3:4]
    dark[:, :, :3] = atlas[:, :, :3] * alpha + dark[:, :, :3] * (1.0 - alpha)
    save_pixels(qa_output, dark, "PNG")

    clips = {
        "IDLE": {"row": 0, "frames": 6, "fps": 6, "loop": True},
        "ATTACK": {"row": 1, "frames": 6, "fps": 10, "loop": False, "events": {"impact": 3}},
        "HIT": {"row": 2, "frames": 6, "fps": 12, "loop": False, "events": {"impact": 1}},
        "DEFEAT": {"row": 3, "frames": 6, "fps": 8, "loop": False, "holdLastFrame": True},
    }
    manifest = {
        "schema": "triad.enemy-production-pilot.v4",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "id": actor,
        "rank": rank,
        "status": "PILOT_VISUAL_QA_PENDING",
        "runtimeActive": False,
        "faction": "ENEMY",
        "battleLane": "RIGHT",
        "facing": "LEFT",
        "atlas": output.relative_to(ROOT).as_posix(),
        "atlasSha256": sha256(output),
        "frameWidth": FRAME_W,
        "frameHeight": FRAME_H,
        "columns": FRAMES_PER_CLIP,
        "rows": len(CLIPS),
        "clips": clips,
        "sourceKeyposeManifest": keypose_manifest.relative_to(ROOT).as_posix(),
        "sourceKeyposeManifestSha256": sha256(keypose_manifest),
        "pipeline": "IMAGEGEN_KEYPOSES__BLENDER_CHROMA_ALPHA_REGISTRATION_ATLAS",
        "registrationScale": scale,
        "runtimeTransform": {"scale": 1, "translate": [0, 0]},
        "framePlan": generated_frames,
        "qaContact": qa_output.relative_to(ROOT).as_posix(),
    }
    manifest_output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"actor": actor, "atlas": str(output), "atlasSha256": manifest["atlasSha256"], "scale": scale, "manifest": str(manifest_output), "contact": str(qa_output)}, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
