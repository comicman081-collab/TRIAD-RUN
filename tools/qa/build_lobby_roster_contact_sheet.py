"""Build a deterministic six-character lobby RGBA contact sheet in Blender.

All inputs are composited from their complete 1024x1536 canonical canvases at
one common scale, so relative registration and silhouette size stay visible.
The contact sheet is QA-only and never becomes a runtime asset.
"""

from __future__ import annotations

import argparse
import json
import sys
from array import array
from datetime import datetime, timezone
from pathlib import Path

import bpy


GLYPHS = {
    "A": ("01110", "10001", "10001", "11111", "10001", "10001", "10001"),
    "B": ("11110", "10001", "10001", "11110", "10001", "10001", "11110"),
    "D": ("11110", "10001", "10001", "10001", "10001", "10001", "11110"),
    "E": ("11111", "10000", "10000", "11110", "10000", "10000", "11111"),
    "F": ("11111", "10000", "10000", "11110", "10000", "10000", "10000"),
    "G": ("01110", "10001", "10000", "10111", "10001", "10001", "01110"),
    "H": ("10001", "10001", "10001", "11111", "10001", "10001", "10001"),
    "I": ("11111", "00100", "00100", "00100", "00100", "00100", "11111"),
    "L": ("10000", "10000", "10000", "10000", "10000", "10000", "11111"),
    "M": ("10001", "11011", "10101", "10101", "10001", "10001", "10001"),
    "O": ("01110", "10001", "10001", "10001", "10001", "10001", "01110"),
    "R": ("11110", "10001", "10001", "11110", "10100", "10010", "10001"),
    "S": ("01111", "10000", "10000", "01110", "00001", "00001", "11110"),
    "T": ("11111", "00100", "00100", "00100", "00100", "00100", "00100"),
    "V": ("10001", "10001", "10001", "10001", "10001", "01010", "00100"),
}


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--item", action="append", required=True, help="LABEL=absolute_path")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--metadata", type=Path, required=True)
    return parser.parse_args(argv)


def draw_label(
    pixels: array,
    width: int,
    x: int,
    y: int,
    label: str,
    scale: int = 3,
) -> None:
    cursor = x
    for character in label.upper():
        glyph = GLYPHS.get(character)
        if glyph is None:
            cursor += 6 * scale
            continue
        for row, pattern in enumerate(glyph):
            for column, bit in enumerate(pattern):
                if bit != "1":
                    continue
                for oy in range(scale):
                    for ox in range(scale):
                        px = cursor + column * scale + ox
                        py = y + (6 - row) * scale + oy
                        index = (py * width + px) * 4
                        pixels[index : index + 4] = array("f", (0.74, 0.91, 1.0, 1.0))
        cursor += 6 * scale


def main() -> int:
    args = parse_args()
    if len(args.item) != 6:
        raise ValueError("Exactly six --item entries are required")
    output = args.output.resolve()
    metadata_path = args.metadata.resolve()
    if output.exists() or metadata_path.exists():
        raise FileExistsError(output if output.exists() else metadata_path)

    items: list[tuple[str, Path]] = []
    for raw in args.item:
        if "=" not in raw:
            raise ValueError(f"Invalid --item: {raw}")
        label, raw_path = raw.split("=", 1)
        path = Path(raw_path).resolve()
        if not path.is_file():
            raise FileNotFoundError(path)
        items.append((label, path))

    columns, rows = 3, 2
    cell_width, cell_height = 640, 768
    width, height = columns * cell_width, rows * cell_height
    result = array("f", [0.0]) * (width * height * 4)

    for index in range(width * height):
        base = index * 4
        result[base : base + 4] = array("f", (0.025, 0.047, 0.086, 1.0))

    metadata_items = []
    for item_index, (label, path) in enumerate(items):
        column = item_index % columns
        display_row = item_index // columns
        row = rows - 1 - display_row
        origin_x = column * cell_width
        origin_y = row * cell_height

        source = bpy.data.images.load(str(path), check_existing=False)
        source_width, source_height = map(int, source.size)
        if (source_width, source_height) != (1024, 1536):
            raise ValueError(f"{label} is not canonical 1024x1536: {source_width}x{source_height}")
        fit_scale = min((cell_width - 24) / source_width, (cell_height - 62) / source_height)
        render_width = round(source_width * fit_scale)
        render_height = round(source_height * fit_scale)
        source.scale(render_width, render_height)
        src = array("f", [0.0]) * (render_width * render_height * 4)
        source.pixels.foreach_get(src)
        offset_x = origin_x + (cell_width - render_width) // 2
        offset_y = origin_y + 10

        for y in range(render_height):
            for x in range(render_width):
                src_index = (y * render_width + x) * 4
                red, green, blue, alpha = src[src_index : src_index + 4]
                if alpha <= 0.0:
                    continue
                dst_index = ((offset_y + y) * width + offset_x + x) * 4
                dst_red, dst_green, dst_blue, _ = result[dst_index : dst_index + 4]
                inv = 1.0 - alpha
                result[dst_index : dst_index + 4] = array(
                    "f",
                    (
                        red * alpha + dst_red * inv,
                        green * alpha + dst_green * inv,
                        blue * alpha + dst_blue * inv,
                        1.0,
                    ),
                )

        draw_label(result, width, origin_x + 18, origin_y + cell_height - 34, label)
        metadata_items.append(
            {
                "label": label,
                "path": str(path),
                "cell": {"column": column, "row": display_row},
                "canonicalScale": fit_scale,
            }
        )

    sheet = bpy.data.images.new(
        "TRIAD_LOBBY_ROSTER_CONTACT",
        width=width,
        height=height,
        alpha=True,
        float_buffer=False,
    )
    sheet.colorspace_settings.name = "sRGB"
    sheet.pixels.foreach_set(result)
    sheet.filepath_raw = str(output)
    sheet.file_format = "PNG"
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save()

    metadata = {
        "schema": "triad.lobby.roster-contact.v1",
        "status": "VISUAL_QA_ONLY",
        "runtimeEligible": False,
        "layout": {"columns": columns, "rows": rows, "cellWidth": cell_width, "cellHeight": cell_height},
        "items": metadata_items,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"CONTACT_SHEET={output}")
    print(f"SIZE={width}x{height}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
