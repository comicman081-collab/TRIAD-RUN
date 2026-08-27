"""Assemble six real-browser screenshots into one Blender-built QA sheet."""

from __future__ import annotations

import argparse
import sys
from array import array
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_lobby_roster_contact_sheet import draw_label


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--item", action="append", required=True, help="LABEL=path")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cell-width", type=int, required=True)
    parser.add_argument("--cell-height", type=int, required=True)
    return parser.parse_args(argv)


def main() -> int:
    args = parse_args()
    if len(args.item) != 6:
        raise ValueError("Exactly six --item entries are required")
    output = args.output.resolve()
    if output.exists():
        raise FileExistsError(output)

    columns, rows = 3, 2
    width = args.cell_width * columns
    height = args.cell_height * rows
    result = array("f", [0.0]) * (width * height * 4)
    for index in range(width * height):
        base = index * 4
        result[base : base + 4] = array("f", (0.012, 0.018, 0.032, 1.0))

    for item_index, raw in enumerate(args.item):
        label, raw_path = raw.split("=", 1)
        path = Path(raw_path).resolve()
        if not path.is_file():
            raise FileNotFoundError(path)
        column = item_index % columns
        display_row = item_index // columns
        row = rows - 1 - display_row
        origin_x = column * args.cell_width
        origin_y = row * args.cell_height

        image = bpy.data.images.load(str(path), check_existing=False)
        source_width, source_height = map(int, image.size)
        label_height = 34
        scale = min(
            args.cell_width / source_width,
            (args.cell_height - label_height) / source_height,
        )
        render_width = max(1, round(source_width * scale))
        render_height = max(1, round(source_height * scale))
        image.scale(render_width, render_height)
        source = array("f", [0.0]) * (render_width * render_height * 4)
        image.pixels.foreach_get(source)
        offset_x = origin_x + (args.cell_width - render_width) // 2
        offset_y = origin_y

        for y in range(render_height):
            for x in range(render_width):
                src_index = (y * render_width + x) * 4
                dst_index = ((offset_y + y) * width + offset_x + x) * 4
                result[dst_index : dst_index + 4] = source[src_index : src_index + 4]

        band_start = origin_y + args.cell_height - label_height
        for y in range(band_start, origin_y + args.cell_height):
            for x in range(origin_x, origin_x + args.cell_width):
                dst_index = (y * width + x) * 4
                result[dst_index : dst_index + 4] = array("f", (0.015, 0.028, 0.05, 1.0))
        draw_label(result, width, origin_x + 12, band_start + 6, label, scale=3)

    contact = bpy.data.images.new(
        "TRIAD_RUNTIME_SCREENSHOT_CONTACT",
        width=width,
        height=height,
        alpha=True,
        float_buffer=False,
    )
    contact.colorspace_settings.name = "sRGB"
    contact.pixels.foreach_set(result)
    contact.filepath_raw = str(output)
    contact.file_format = "PNG"
    output.parent.mkdir(parents=True, exist_ok=True)
    contact.save()
    print(f"CONTACT_SHEET={output}")
    print(f"SIZE={width}x{height}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
