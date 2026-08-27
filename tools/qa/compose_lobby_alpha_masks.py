"""Compose audited lobby alpha candidates without altering source RGB."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_point(value: str) -> tuple[int, int]:
    try:
        x_text, y_text = value.split(",", 1)
        return int(x_text), int(y_text)
    except Exception as error:
        raise argparse.ArgumentTypeError("POINT_MUST_BE_X_COMMA_Y") from error


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-rgb", type=Path, required=True)
    parser.add_argument("--base-rgba", type=Path, required=True)
    parser.add_argument("--extra-rgba", type=Path, required=True)
    parser.add_argument("--extra-polygon", type=parse_point, action="append", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    paths = [args.source_rgb, args.base_rgba, args.extra_rgba]
    for path in paths:
        if not path.is_file():
            raise FileNotFoundError(path)
    if args.output.exists():
        raise FileExistsError(args.output)

    source = Image.open(args.source_rgb).convert("RGB")
    base = Image.open(args.base_rgba).convert("RGBA")
    extra = Image.open(args.extra_rgba).convert("RGBA")
    if base.size != source.size or extra.size != source.size:
        raise RuntimeError("INPUT_SIZE_MISMATCH")
    polygon = Image.new("L", source.size, 0)
    ImageDraw.Draw(polygon).polygon(args.extra_polygon, fill=255)
    base_alpha = np.asarray(base.getchannel("A"), dtype=np.uint8)
    extra_alpha = np.asarray(extra.getchannel("A"), dtype=np.uint8)
    polygon_alpha = np.asarray(polygon, dtype=np.uint8)
    composed = np.maximum(base_alpha, np.minimum(extra_alpha, polygon_alpha))
    result = source.convert("RGBA")
    result.putalpha(Image.fromarray(composed, "L"))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    result.save(args.output, format="PNG", optimize=False)
    report = {
        "schema": "triad.lobby.alpha-compose.v1",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "status": "ALPHA_CANDIDATE_VISUAL_QA_REQUIRED",
        "source": {"path": str(args.source_rgb), "sha256": sha256(args.source_rgb)},
        "base": {"path": str(args.base_rgba), "sha256": sha256(args.base_rgba)},
        "extra": {"path": str(args.extra_rgba), "sha256": sha256(args.extra_rgba)},
        "extraPolygon": [list(point) for point in args.extra_polygon],
        "output": {"path": str(args.output), "sha256": sha256(args.output)},
        "sourceRgbModified": False,
        "runtimeEligible": False,
    }
    args.output.with_suffix(".json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
