"""Extract transparent enemy key poses from an ImageGen pose sheet in Blender.

The generated sheet contains a baked neutral checkerboard.  This tool removes
only the border-connected neutral background, finds the six largest connected
character silhouettes, and exports pose-local RGBA sources plus provenance.
It does not activate any runtime asset.
"""

from __future__ import annotations

import hashlib
import json
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

import bpy
import numpy as np


ROOT = Path(__file__).resolve().parents[2]
ACTOR = "RIFT_M10"
ACTOR_ROOT = ROOT / "assets" / "enemies" / "production_pilot_v4" / ACTOR
SOURCE = ACTOR_ROOT / f"{ACTOR}_KEYPOSE_SHEET_RAW.png"
POSE_NAMES = ("IDLE", "ATTACK_WINDUP", "ATTACK_CONTACT", "ATTACK_RECOVERY", "HIT", "DEFEAT")
MIN_COMPONENT_AREA = 1000


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


def border_connected_background(rgb: np.ndarray) -> np.ndarray:
    height, width, _channels = rgb.shape
    maximum = rgb.max(axis=2)
    minimum = rgb.min(axis=2)
    luma = rgb.mean(axis=2)
    neutral = (maximum - minimum) < 0.13
    candidate = neutral & (luma > 0.70)
    visited = np.zeros((height, width), dtype=np.bool_)
    queue: deque[tuple[int, int]] = deque()

    def push(y: int, x: int) -> None:
        if candidate[y, x] and not visited[y, x]:
            visited[y, x] = True
            queue.append((y, x))

    for x in range(width):
        push(0, x)
        push(height - 1, x)
    for y in range(height):
        push(y, 0)
        push(y, width - 1)

    while queue:
        y, x = queue.popleft()
        if x > 0:
            push(y, x - 1)
        if x + 1 < width:
            push(y, x + 1)
        if y > 0:
            push(y - 1, x)
        if y + 1 < height:
            push(y + 1, x)
    return visited


def label_components(foreground: np.ndarray) -> tuple[np.ndarray, list[dict[str, int | float]]]:
    height, width = foreground.shape
    labels = np.zeros((height, width), dtype=np.int32)
    components: list[dict[str, int | float]] = []
    label = 0
    for y0 in range(height):
        for x0 in range(width):
            if not foreground[y0, x0] or labels[y0, x0] != 0:
                continue
            label += 1
            labels[y0, x0] = label
            queue: deque[tuple[int, int]] = deque([(y0, x0)])
            area = 0
            min_x = max_x = x0
            min_y = max_y = y0
            sum_x = 0
            sum_y = 0
            while queue:
                y, x = queue.popleft()
                area += 1
                sum_x += x
                sum_y += y
                min_x = min(min_x, x)
                max_x = max(max_x, x)
                min_y = min(min_y, y)
                max_y = max(max_y, y)
                for ny, nx in ((y, x - 1), (y, x + 1), (y - 1, x), (y + 1, x)):
                    if 0 <= ny < height and 0 <= nx < width and foreground[ny, nx] and labels[ny, nx] == 0:
                        labels[ny, nx] = label
                        queue.append((ny, nx))
            components.append({
                "label": label,
                "area": area,
                "minX": min_x,
                "maxX": max_x,
                "minY": min_y,
                "maxY": max_y,
                "centerX": sum_x / area,
                "centerY": sum_y / area,
            })
    return labels, components


def export_poses(rgba: np.ndarray, labels: np.ndarray, components: list[dict[str, int | float]]) -> list[dict[str, object]]:
    major = sorted((component for component in components if int(component["area"]) >= MIN_COMPONENT_AREA), key=lambda item: int(item["area"]), reverse=True)[:6]
    if len(major) != 6:
        raise RuntimeError(f"Expected six major pose components, found {len(major)}")
    image_mid_y = rgba.shape[0] / 2.0
    major.sort(
        key=lambda item: (
            0 if float(item["centerY"]) >= image_mid_y else 1,
            float(item["centerX"]),
        )
    )

    assigned: dict[int, set[int]] = {int(component["label"]): {int(component["label"])} for component in major}
    major_by_label = {int(component["label"]): component for component in major}
    for component in components:
        label = int(component["label"])
        if label in major_by_label or int(component["area"]) < 4:
            continue
        cy = float(component["centerY"])
        cx = float(component["centerX"])
        closest = min(
            major,
            key=lambda item: (float(item["centerX"]) - cx) ** 2 + (float(item["centerY"]) - cy) ** 2,
        )
        distance_sq = (float(closest["centerX"]) - cx) ** 2 + (float(closest["centerY"]) - cy) ** 2
        if distance_sq <= 240.0 ** 2 and abs(float(closest["centerY"]) - cy) < 220:
            assigned[int(closest["label"])].add(label)

    pose_root = ACTOR_ROOT / "keyposes_rgba"
    pose_root.mkdir(parents=True, exist_ok=True)
    records: list[dict[str, object]] = []
    for pose_name, component in zip(POSE_NAMES, major):
        selected_labels = assigned[int(component["label"])]
        mask = np.isin(labels, list(selected_labels))
        ys, xs = np.nonzero(mask)
        min_x = max(0, int(xs.min()) - 8)
        max_x = min(rgba.shape[1] - 1, int(xs.max()) + 8)
        min_y = max(0, int(ys.min()) - 8)
        max_y = min(rgba.shape[0] - 1, int(ys.max()) + 8)
        crop = np.zeros((max_y - min_y + 1, max_x - min_x + 1, 4), dtype=np.float32)
        crop[:, :, :3] = rgba[min_y:max_y + 1, min_x:max_x + 1, :3]
        crop[:, :, 3] = mask[min_y:max_y + 1, min_x:max_x + 1].astype(np.float32)
        output = pose_root / f"{ACTOR}_{pose_name}_RGBA.png"
        save_rgba(output, crop)
        records.append({
            "pose": pose_name,
            "path": output.relative_to(ROOT).as_posix(),
            "sha256": sha256(output),
            "width": crop.shape[1],
            "height": crop.shape[0],
            "sourceBbox": [min_x, min_y, max_x, max_y],
            "componentArea": int(mask.sum()),
            "sourceCenter": [float(component["centerX"]), float(component["centerY"])],
            "sourceBaseline": min_y,
        })
    return records


def main() -> int:
    rgba = load_rgba(SOURCE)
    background = border_connected_background(rgba[:, :, :3])
    clean = rgba.copy()
    clean[:, :, 3] = (~background).astype(np.float32)
    clean[background, :3] = 0.0
    clean_path = ACTOR_ROOT / f"{ACTOR}_KEYPOSE_SHEET_CLEAN_RGBA.png"
    save_rgba(clean_path, clean)

    foreground = clean[:, :, 3] > 0.5
    labels, components = label_components(foreground)
    records = export_poses(clean, labels, components)

    dark = np.zeros_like(clean)
    dark[:, :, :3] = np.array((0.025, 0.038, 0.065), dtype=np.float32)
    dark[:, :, 3] = 1.0
    alpha = clean[:, :, 3:4]
    dark[:, :, :3] = clean[:, :, :3] * alpha + dark[:, :, :3] * (1.0 - alpha)
    contact_path = ROOT / "reports" / "qa" / f"{ACTOR}_PRODUCTION_V4_KEYPOSE_CONTACT.png"
    contact_path.parent.mkdir(parents=True, exist_ok=True)
    save_rgba(contact_path, dark)

    manifest = {
        "schema": "triad.enemy-keypose-source.v4",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "actorId": ACTOR,
        "runtimeActive": False,
        "status": "PILOT_VISUAL_QA_PENDING",
        "source": SOURCE.relative_to(ROOT).as_posix(),
        "sourceSha256": sha256(SOURCE),
        "cleanSheet": clean_path.relative_to(ROOT).as_posix(),
        "cleanSheetSha256": sha256(clean_path),
        "contact": contact_path.relative_to(ROOT).as_posix(),
        "poses": records,
        "backgroundRemoval": "BLENDER_BORDER_CONNECTED_NEUTRAL_FLOOD",
    }
    manifest_path = ACTOR_ROOT / f"{ACTOR}_KEYPOSE_MANIFEST_V4.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "manifest": str(manifest_path),
        "clean": str(clean_path),
        "contact": str(contact_path),
        "poses": len(records),
        "backgroundPixels": int(background.sum()),
        "foregroundPixels": int(foreground.sum()),
        "components": len(components),
    }, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
