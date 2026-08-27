"""Extract six isolated RGBA enemy key poses from a 3x2 ImageGen sheet.

Run inside Blender. The source sheet must be named
`<ACTOR>_KEYPOSE_SHEET_RAW.png` under `assets/enemies/production_pilot_v4/<ACTOR>`.
The script removes a flat green or magenta chroma background, keeps the largest
connected silhouette in each cell, and writes deterministic pose provenance.
It never activates runtime data.
"""

from __future__ import annotations

import hashlib
import json
import sys
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

import bpy
import numpy as np


ROOT = Path(__file__).resolve().parents[2]
POSE_NAMES = ("IDLE", "ATTACK_WINDUP", "ATTACK_CONTACT", "ATTACK_RECOVERY", "HIT", "DEFEAT")


def arguments() -> tuple[str, str, str | None]:
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    actor = args[0] if args else "SHADE_M01"
    chroma = args[1].lower() if len(args) > 1 else "green"
    if chroma not in {"green", "magenta", "yellow"}:
        raise ValueError("chroma must be green, magenta, or yellow")
    source_name = args[2] if len(args) > 2 else None
    return actor, chroma, source_name


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


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


def chroma_alpha(rgb: np.ndarray, chroma: str) -> np.ndarray:
    red, green, blue = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    if chroma == "green":
        dominance = green - np.maximum(red, blue)
        chroma_level = green
    elif chroma == "magenta":
        dominance = np.minimum(red, blue) - green
        chroma_level = np.minimum(red, blue)
    else:
        dominance = np.minimum(red, green) - blue
        chroma_level = np.minimum(red, green)
    # Generated chroma sheets frequently contain a dark antialiased baseline.
    # Start rejecting chroma at a deliberately low dominance so that this line
    # cannot become connected to the actor silhouette during component cleanup.
    background_strength = np.clip((dominance - 0.005) / 0.075, 0.0, 1.0) * np.clip((chroma_level - 0.025) / 0.18, 0.0, 1.0)
    return np.clip(1.0 - background_strength, 0.0, 1.0)


def despill(rgba: np.ndarray, chroma: str) -> np.ndarray:
    """Remove chroma hue from partially transparent antialiased edge pixels."""
    result = rgba.copy()
    red, green, blue = result[:, :, 0], result[:, :, 1], result[:, :, 2]
    edge = result[:, :, 3] < 0.98
    if chroma == "green":
        neutral_limit = np.maximum(red, blue) * 1.04
        result[:, :, 1] = np.where(edge, np.minimum(green, neutral_limit), green)
    elif chroma == "magenta":
        neutral_limit = green * 1.04
        result[:, :, 0] = np.where(edge, np.minimum(red, neutral_limit), red)
        result[:, :, 2] = np.where(edge, np.minimum(blue, neutral_limit), blue)
    else:
        neutral_limit = blue * 1.04
        result[:, :, 0] = np.where(edge, np.minimum(red, neutral_limit), red)
        result[:, :, 1] = np.where(edge, np.minimum(green, neutral_limit), green)
    return result


def largest_component(mask: np.ndarray) -> np.ndarray:
    height, width = mask.shape
    labels = np.zeros((height, width), dtype=np.int32)
    best_label = 0
    best_area = 0
    label = 0
    for y0 in range(height):
        for x0 in range(width):
            if not mask[y0, x0] or labels[y0, x0] != 0:
                continue
            label += 1
            labels[y0, x0] = label
            queue: deque[tuple[int, int]] = deque([(y0, x0)])
            area = 0
            while queue:
                y, x = queue.popleft()
                area += 1
                for ny, nx in ((y, x - 1), (y, x + 1), (y - 1, x), (y + 1, x)):
                    if 0 <= ny < height and 0 <= nx < width and mask[ny, nx] and labels[ny, nx] == 0:
                        labels[ny, nx] = label
                        queue.append((ny, nx))
            if area > best_area:
                best_label = label
                best_area = area
    if best_label == 0:
        raise RuntimeError("No foreground component found")
    return labels == best_label


def main() -> int:
    actor, chroma, source_name = arguments()
    actor_root = ROOT / "assets" / "enemies" / "production_pilot_v4" / actor
    source = actor_root / (source_name or f"{actor}_KEYPOSE_SHEET_RAW.png")
    rgba = load_rgba(source)
    alpha = chroma_alpha(rgba[:, :, :3], chroma)
    clean = rgba.copy()
    clean[:, :, 3] = alpha
    clean = despill(clean, chroma)
    clean[alpha <= 0.01, :3] = 0.0
    clean_path = actor_root / f"{actor}_KEYPOSE_SHEET_CLEAN_RGBA.png"
    save_rgba(clean_path, clean)

    height, width, _channels = clean.shape
    cell_w, cell_h = width // 3, height // 2
    pose_root = actor_root / "keyposes_rgba"
    pose_root.mkdir(parents=True, exist_ok=True)
    records: list[dict[str, object]] = []
    isolated_sheet = np.zeros_like(clean)
    for index, pose in enumerate(POSE_NAMES):
        column = index % 3
        storage_row = 1 if index < 3 else 0
        x0, x1 = column * cell_w, width if column == 2 else (column + 1) * cell_w
        y0, y1 = storage_row * cell_h, height if storage_row == 1 else cell_h
        cell = clean[y0:y1, x0:x1].copy()
        component = largest_component(cell[:, :, 3] > 0.35)
        ys, xs = np.nonzero(component)
        pad = 8
        min_x, max_x = max(0, int(xs.min()) - pad), min(cell.shape[1] - 1, int(xs.max()) + pad)
        min_y, max_y = max(0, int(ys.min()) - pad), min(cell.shape[0] - 1, int(ys.max()) + pad)
        crop = cell[min_y : max_y + 1, min_x : max_x + 1].copy()
        local_component = component[min_y : max_y + 1, min_x : max_x + 1]
        crop[:, :, 3] *= local_component.astype(np.float32)
        crop[crop[:, :, 3] <= 0.01, :3] = 0.0
        isolated_cell = cell.copy()
        isolated_cell[:, :, 3] *= component.astype(np.float32)
        isolated_cell[isolated_cell[:, :, 3] <= 0.01, :3] = 0.0
        isolated_sheet[y0:y1, x0:x1] = isolated_cell
        output = pose_root / f"{actor}_{pose}_RGBA.png"
        save_rgba(output, crop)
        records.append({
            "pose": pose,
            "path": output.relative_to(ROOT).as_posix(),
            "sha256": sha256(output),
            "width": int(crop.shape[1]),
            "height": int(crop.shape[0]),
            "sourceCell": [x0, y0, x1, y1],
            "sourceBbox": [x0 + min_x, y0 + min_y, x0 + max_x, y0 + max_y],
            "componentArea": int(component.sum()),
        })

    dark = np.zeros_like(isolated_sheet)
    dark[:, :, :3] = np.array((0.025, 0.038, 0.065), dtype=np.float32)
    dark[:, :, 3] = 1.0
    clean_alpha = isolated_sheet[:, :, 3:4]
    dark[:, :, :3] = isolated_sheet[:, :, :3] * clean_alpha + dark[:, :, :3] * (1.0 - clean_alpha)
    contact_path = ROOT / "reports" / "qa" / f"{actor}_PRODUCTION_V4_KEYPOSE_CONTACT.png"
    contact_path.parent.mkdir(parents=True, exist_ok=True)
    save_rgba(contact_path, dark)

    manifest = {
        "schema": "triad.enemy-keypose-source.v4",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "actorId": actor,
        "runtimeActive": False,
        "status": "PILOT_VISUAL_QA_PENDING",
        "source": source.relative_to(ROOT).as_posix(),
        "sourceSha256": sha256(source),
        "cleanSheet": clean_path.relative_to(ROOT).as_posix(),
        "cleanSheetSha256": sha256(clean_path),
        "contact": contact_path.relative_to(ROOT).as_posix(),
        "poses": records,
        "backgroundRemoval": f"BLENDER_CHROMA_{chroma.upper()}__LARGEST_COMPONENT_PER_CELL",
    }
    manifest_path = actor_root / f"{actor}_KEYPOSE_MANIFEST_V4.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"actor": actor, "poses": len(records), "manifest": str(manifest_path), "contact": str(contact_path)}, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
