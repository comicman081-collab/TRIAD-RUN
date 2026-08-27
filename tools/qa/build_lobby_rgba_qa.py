"""Build a deterministic visual QA strip for one lobby RGBA candidate.

Run with Blender so the project's local graphics restriction is respected:

    blender -b --python tools/qa/build_lobby_rgba_qa.py -- \
      --input candidate.png --output candidate_qa.png

The output contains the unmodified candidate composited over a checkerboard,
over chroma green, and as a white-on-black alpha mask.  It is QA-only and is
never eligible for the runtime manifest.
"""

from __future__ import annotations

import argparse
import sys
from array import array
from pathlib import Path

import bpy


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args(argv)


def checker(x: int, y: int) -> tuple[float, float, float]:
    value = 0.82 if ((x // 32) + (y // 32)) % 2 else 0.28
    return value, value, value


def main() -> int:
    args = parse_args()
    source = args.input.resolve()
    output = args.output.resolve()
    if not source.is_file():
        raise FileNotFoundError(source)
    if output.exists():
        raise FileExistsError(output)
    output.parent.mkdir(parents=True, exist_ok=True)

    image = bpy.data.images.load(str(source), check_existing=False)
    width, height = map(int, image.size)
    source_pixels = array("f", [0.0]) * (width * height * 4)
    image.pixels.foreach_get(source_pixels)

    output_width = width * 3
    result = array("f", [0.0]) * (output_width * height * 4)
    for y in range(height):
        for x in range(width):
            src_index = (y * width + x) * 4
            red, green, blue, alpha = source_pixels[src_index : src_index + 4]
            backgrounds = (checker(x, y), (0.0, 0.694, 0.251), (0.0, 0.0, 0.0))
            for panel, background in enumerate(backgrounds):
                dst_index = (y * output_width + panel * width + x) * 4
                if panel == 2:
                    out_red = out_green = out_blue = alpha
                else:
                    out_red = red * alpha + background[0] * (1.0 - alpha)
                    out_green = green * alpha + background[1] * (1.0 - alpha)
                    out_blue = blue * alpha + background[2] * (1.0 - alpha)
                result[dst_index : dst_index + 4] = array(
                    "f", (out_red, out_green, out_blue, 1.0)
                )

    qa_image = bpy.data.images.new(
        "TRIAD_LOBBY_RGBA_QA",
        width=output_width,
        height=height,
        alpha=True,
        float_buffer=False,
    )
    qa_image.colorspace_settings.name = "sRGB"
    qa_image.pixels.foreach_set(result)
    qa_image.filepath_raw = str(output)
    qa_image.file_format = "PNG"
    qa_image.save()
    print(f"QA_OUTPUT={output}")
    print(f"SOURCE_SIZE={width}x{height}")
    print(f"QA_SIZE={output_width}x{height}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
