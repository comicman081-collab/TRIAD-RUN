"""Remove only small disconnected alpha islands from a lobby RGBA candidate.

This is a deterministic mask cleanup pass.  RGB pixels are copied byte-for-byte
from the candidate; no generation, inpainting, recoloring, or geometric change
is performed.  The source and output are never overwritten.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def components(mask: np.ndarray) -> tuple[np.ndarray, list[dict[str, int]]]:
    height, width = mask.shape
    labels = np.zeros((height, width), dtype=np.int32)
    records: list[dict[str, int]] = []
    label = 0
    for y in range(height):
        for x in range(width):
            if not mask[y, x] or labels[y, x]:
                continue
            label += 1
            queue = deque([(x, y)])
            labels[y, x] = label
            area = 0
            min_x = max_x = x
            min_y = max_y = y
            while queue:
                cx, cy = queue.popleft()
                area += 1
                min_x, max_x = min(min_x, cx), max(max_x, cx)
                min_y, max_y = min(min_y, cy), max(max_y, cy)
                for ny in range(max(0, cy - 1), min(height, cy + 2)):
                    for nx in range(max(0, cx - 1), min(width, cx + 2)):
                        if mask[ny, nx] and not labels[ny, nx]:
                            labels[ny, nx] = label
                            queue.append((nx, ny))
            records.append(
                {
                    "id": label,
                    "area": area,
                    "x": min_x,
                    "y": min_y,
                    "width": max_x - min_x + 1,
                    "height": max_y - min_y + 1,
                }
            )
    return labels, records


def dilate(mask: np.ndarray, radius: int) -> np.ndarray:
    if radius <= 0:
        return mask
    height, width = mask.shape
    output = np.zeros_like(mask)
    for dy in range(-radius, radius + 1):
        src_y0, src_y1 = max(0, -dy), min(height, height - dy)
        dst_y0, dst_y1 = max(0, dy), min(height, height + dy)
        for dx in range(-radius, radius + 1):
            src_x0, src_x1 = max(0, -dx), min(width, width - dx)
            dst_x0, dst_x1 = max(0, dx), min(width, width + dx)
            output[dst_y0:dst_y1, dst_x0:dst_x1] |= mask[
                src_y0:src_y1, src_x0:src_x1
            ]
    return output


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--min-area", type=int, default=80)
    parser.add_argument("--edge-radius", type=int, default=2)
    args = parser.parse_args()
    source = args.source.resolve()
    output = args.output.resolve()
    if not source.is_file():
        raise FileNotFoundError(source)
    if output.exists():
        raise FileExistsError(output)
    if output.suffix.lower() != ".png":
        raise RuntimeError("OUTPUT_MUST_BE_PNG")

    rgba = np.asarray(Image.open(source).convert("RGBA"), dtype=np.uint8).copy()
    alpha = rgba[:, :, 3]
    labels, records = components(alpha >= 128)
    if not records:
        raise RuntimeError("NO_ALPHA_COMPONENTS")
    largest = max(records, key=lambda item: item["area"])["id"]
    kept_ids = {
        item["id"]
        for item in records
        if item["id"] == largest or item["area"] >= args.min_area
    }
    hard_support = np.isin(labels, list(kept_ids))
    soft_support = dilate(hard_support, args.edge_radius)
    rgba[:, :, 3] = np.where(soft_support, alpha, 0).astype(np.uint8)

    output.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, "RGBA").save(output, format="PNG", optimize=False)
    report = {
        "schema": "triad.lobby.alpha-component-cleanup.v1",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "status": "ALPHA_CANDIDATE_VISUAL_QA_REQUIRED",
        "source": {"path": str(source), "sha256": digest(source)},
        "output": {"path": str(output), "sha256": digest(output)},
        "minArea": args.min_area,
        "edgeRadius": args.edge_radius,
        "componentCount": len(records),
        "keptComponentCount": len(kept_ids),
        "removedComponentCount": len(records) - len(kept_ids),
        "largestComponents": sorted(
            records, key=lambda item: item["area"], reverse=True
        )[:30],
        "rgbRegenerated": False,
        "runtimeEligible": False,
    }
    output.with_suffix(".json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
