"""Build the three-enemy production animation pilot with Blender only.

The active FRAME MVP is intentionally left untouched.  This script creates
candidate 2.5D mesh-warp sources, 12-frame clips, transparent WebP atlases,
and a visual contact sheet for one normal, elite, and boss actor.

Run:
    blender -b --python tools/blender/build_enemy_production_pilot_v2.py
"""

from __future__ import annotations

import hashlib
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

import bpy
import numpy as np


ROOT = Path(__file__).resolve().parents[2]
SOURCE_ROOT = ROOT / "assets" / "enemies" / "monsters_rgba_p1"
OUTPUT_ROOT = ROOT / "assets" / "enemies" / "production_pilot_v2"
QA_ROOT = ROOT / "reports" / "qa"

FRAME_W = 320
FRAME_H = 420
FRAMES_PER_CLIP = 12
CLIPS = ("IDLE", "ATTACK", "HIT", "DEFEAT")
GRID_X = 34
GRID_Y = 46

PILOTS = (
    {
        "id": "SHADE_M01",
        "rank": "NORMAL",
        "kind": "SPIDER",
        "accent": (0.69, 0.22, 1.0, 1.0),
    },
    {
        "id": "RIFT_M10",
        "rank": "ELITE",
        "kind": "KNIGHT",
        "accent": (0.88, 0.25, 1.0, 1.0),
    },
    {
        "id": "EMBER_M13",
        "rank": "BOSS",
        "kind": "WINGED_BOSS",
        "accent": (1.0, 0.20, 0.06, 1.0),
    },
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def gaussian(u: float, v: float, cx: float, cy: float, sx: float, sy: float) -> float:
    return math.exp(-(((u - cx) / sx) ** 2 + ((v - cy) / sy) ** 2) * 0.5)


def rotate_point(x: float, y: float, px: float, py: float, angle: float) -> tuple[float, float]:
    c = math.cos(angle)
    s = math.sin(angle)
    dx = x - px
    dy = y - py
    return px + dx * c - dy * s, py + dx * s + dy * c


def deform_vertex(kind: str, pose: str, x: float, y: float, u: float, v: float) -> tuple[float, float, float]:
    nx, ny = x, y
    z = 0.0
    upper = max(0.0, min(1.0, (v - 0.28) / 0.58))
    lower = max(0.0, min(1.0, (0.58 - v) / 0.50))
    center = gaussian(u, v, 0.50, 0.57, 0.27, 0.30)

    if pose == "IDLE_INHALE":
        nx *= 1.0 + 0.018 * center
        ny += 0.020 * upper + 0.006 * math.sin((u - 0.5) * math.pi)
    elif pose == "IDLE_EXHALE":
        nx *= 1.0 - 0.010 * center
        ny -= 0.012 * upper

    if kind == "SPIDER":
        leg_left = gaussian(u, v, 0.18, 0.30, 0.19, 0.26)
        leg_right = gaussian(u, v, 0.82, 0.30, 0.19, 0.26)
        shell = gaussian(u, v, 0.50, 0.62, 0.35, 0.28)
        if pose == "ATTACK_WINDUP":
            nx += 0.10 * shell
            ny -= 0.055 * shell
            nx += 0.08 * leg_left - 0.05 * leg_right
            ny += 0.05 * lower
        elif pose == "ATTACK_CONTACT":
            nx -= 0.30 * (0.35 + 0.65 * shell)
            ny += 0.035 * shell
            nx -= 0.12 * leg_left + 0.05 * leg_right
            ny -= 0.035 * lower
        elif pose == "HIT_RECOIL":
            nx += 0.24 * (0.30 + 0.70 * shell)
            ny += 0.035 * shell
            nx, ny = rotate_point(nx, ny, 0.0, -0.15, -0.10 * upper)
        elif pose == "DEFEAT_COLLAPSE":
            nx, ny = rotate_point(nx, ny, 0.0, -0.55, -0.20 * (0.25 + upper))
            ny -= 0.34 * (0.25 + upper)
            nx *= 1.05
            ny = -0.83 + (ny + 0.83) * (0.72 + 0.28 * lower)

    elif kind == "KNIGHT":
        torso = gaussian(u, v, 0.48, 0.59, 0.24, 0.30)
        weapon = gaussian(u, v, 0.70, 0.35, 0.23, 0.34)
        head = gaussian(u, v, 0.47, 0.83, 0.17, 0.16)
        if pose == "ATTACK_WINDUP":
            nx += 0.11 * torso + 0.16 * weapon
            ny += 0.035 * weapon
            rx, ry = rotate_point(nx, ny, 0.05, 0.08, -0.26)
            nx += (rx - nx) * weapon
            ny += (ry - ny) * weapon
        elif pose == "ATTACK_CONTACT":
            nx -= 0.23 * (0.35 + 0.65 * torso)
            rx, ry = rotate_point(nx, ny, -0.02, 0.04, 0.58)
            nx += (rx - nx) * weapon
            ny += (ry - ny) * weapon
            nx -= 0.28 * weapon
            ny += 0.06 * weapon
        elif pose == "HIT_RECOIL":
            nx += 0.22 * (0.25 + 0.75 * torso)
            nx, ny = rotate_point(nx, ny, 0.0, -0.52, -0.15 * (upper + head))
        elif pose == "DEFEAT_COLLAPSE":
            nx, ny = rotate_point(nx, ny, 0.0, -0.78, -0.44 * (0.28 + upper))
            nx += 0.16 * upper
            ny -= 0.39 * upper
            ny = -0.86 + (ny + 0.86) * 0.80

    elif kind == "WINGED_BOSS":
        torso = gaussian(u, v, 0.50, 0.55, 0.24, 0.29)
        wing_left = gaussian(u, v, 0.22, 0.72, 0.27, 0.28)
        wing_right = gaussian(u, v, 0.78, 0.72, 0.27, 0.28)
        claw_left = gaussian(u, v, 0.22, 0.42, 0.19, 0.24)
        if pose == "ATTACK_WINDUP":
            nx += 0.09 * torso
            nx += 0.10 * wing_left - 0.10 * wing_right
            ny += 0.10 * (wing_left + wing_right)
            nx += 0.12 * claw_left
        elif pose == "ATTACK_CONTACT":
            nx -= 0.24 * (0.35 + 0.65 * torso)
            nx -= 0.12 * wing_left - 0.08 * wing_right
            ny -= 0.08 * (wing_left + wing_right)
            nx -= 0.25 * claw_left
        elif pose == "HIT_RECOIL":
            nx += 0.20 * (0.30 + 0.70 * torso)
            nx, ny = rotate_point(nx, ny, 0.0, -0.50, -0.12 * upper)
            ny += 0.06 * (wing_left + wing_right)
        elif pose == "DEFEAT_COLLAPSE":
            nx, ny = rotate_point(nx, ny, 0.0, -0.78, 0.22 * (0.25 + upper))
            ny -= 0.42 * upper
            nx *= 0.92
            ny = -0.88 + (ny + 0.88) * 0.76

    return nx, ny, z


def create_grid_actor(source: Path, pilot: dict[str, object]) -> tuple[bpy.types.Object, bpy.types.Node]:
    image = bpy.data.images.load(str(source), check_existing=False)
    aspect = image.size[0] / image.size[1]
    width = 2.0 * aspect
    height = 2.0

    vertices: list[tuple[float, float, float]] = []
    uvs: list[tuple[float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    for row in range(GRID_Y):
        v = row / (GRID_Y - 1)
        y = (v - 0.5) * height
        for col in range(GRID_X):
            u = col / (GRID_X - 1)
            x = (u - 0.5) * width
            vertices.append((x, y, 0.0))
            uvs.append((u, v))
    for row in range(GRID_Y - 1):
        for col in range(GRID_X - 1):
            a = row * GRID_X + col
            b = a + 1
            c = a + GRID_X + 1
            d = a + GRID_X
            faces.append((a, b, c, d))

    mesh = bpy.data.meshes.new(f"{pilot['id']}_MESH")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            uv_layer.data[loop_index].uv = uvs[mesh.loops[loop_index].vertex_index]

    actor = bpy.data.objects.new(str(pilot["id"]), mesh)
    bpy.context.collection.objects.link(actor)
    actor["pipeline"] = "TRIAD_ENEMY_2P5D_MESH_WARP_V2"
    actor["faction"] = "ENEMY"
    actor["battleLane"] = "RIGHT"
    actor["facing"] = "LEFT"
    actor["runtimeScale"] = 1.0
    actor["runtimeTranslateX"] = 0.0
    actor["runtimeTranslateY"] = 0.0

    material = bpy.data.materials.new(f"{pilot['id']}_RGBA")
    material.use_nodes = True
    material.surface_render_method = "DITHERED"
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    transparent = nodes.new("ShaderNodeBsdfTransparent")
    emission = nodes.new("ShaderNodeEmission")
    texture = nodes.new("ShaderNodeTexImage")
    alpha_mul = nodes.new("ShaderNodeMath")
    opacity = nodes.new("ShaderNodeValue")
    mix = nodes.new("ShaderNodeMixShader")
    texture.image = image
    texture.interpolation = "Linear"
    alpha_mul.operation = "MULTIPLY"
    opacity.name = "CLIP_OPACITY"
    opacity.label = "CLIP_OPACITY"
    opacity.outputs[0].default_value = 1.0
    links.new(texture.outputs["Color"], emission.inputs["Color"])
    links.new(texture.outputs["Alpha"], alpha_mul.inputs[0])
    links.new(opacity.outputs[0], alpha_mul.inputs[1])
    links.new(alpha_mul.outputs[0], mix.inputs[0])
    links.new(transparent.outputs[0], mix.inputs[1])
    links.new(emission.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs["Surface"])
    actor.data.materials.append(material)

    actor.shape_key_add(name="Basis")
    basis = [(co[0], co[1], co[2]) for co in vertices]
    for pose in (
        "IDLE_INHALE",
        "IDLE_EXHALE",
        "ATTACK_WINDUP",
        "ATTACK_CONTACT",
        "HIT_RECOIL",
        "DEFEAT_COLLAPSE",
    ):
        key = actor.shape_key_add(name=pose)
        for index, (x, y, _z) in enumerate(basis):
            col = index % GRID_X
            row = index // GRID_X
            u = col / (GRID_X - 1)
            v = row / (GRID_Y - 1)
            key.data[index].co = deform_vertex(str(pilot["kind"]), pose, x, y, u, v)
    return actor, opacity


def configure_scene() -> bpy.types.Scene:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.film_transparent = True
    scene.render.resolution_x = FRAME_W
    scene.render.resolution_y = FRAME_H
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.filter_size = 1.0

    camera_data = bpy.data.cameras.new("ENEMY_PILOT_CAMERA")
    camera = bpy.data.objects.new("ENEMY_PILOT_CAMERA", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (0.0, 0.02, 10.0)
    camera.rotation_euler = (0.0, 0.0, 0.0)
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 2.30
    scene.camera = camera
    return scene


def clip_weights(clip: str, index: int) -> tuple[dict[str, float], float]:
    p = index / (FRAMES_PER_CLIP - 1)
    weights = {
        "IDLE_INHALE": 0.0,
        "IDLE_EXHALE": 0.0,
        "ATTACK_WINDUP": 0.0,
        "ATTACK_CONTACT": 0.0,
        "HIT_RECOIL": 0.0,
        "DEFEAT_COLLAPSE": 0.0,
    }
    opacity = 1.0
    if clip == "IDLE":
        wave = math.sin(p * math.tau)
        if wave >= 0:
            weights["IDLE_INHALE"] = wave
        else:
            weights["IDLE_EXHALE"] = -wave
    elif clip == "ATTACK":
        if index <= 3:
            weights["ATTACK_WINDUP"] = index / 3
        elif index <= 6:
            weights["ATTACK_WINDUP"] = max(0.0, 1.0 - (index - 3) / 3)
            weights["ATTACK_CONTACT"] = (index - 3) / 3
        else:
            weights["ATTACK_CONTACT"] = max(0.0, 1.0 - (index - 6) / 5)
    elif clip == "HIT":
        if index <= 2:
            weights["HIT_RECOIL"] = index / 2
        else:
            weights["HIT_RECOIL"] = max(0.0, 1.0 - (index - 2) / 9)
    elif clip == "DEFEAT":
        eased = 1.0 - (1.0 - p) ** 2
        weights["DEFEAT_COLLAPSE"] = eased
        opacity = 1.0 - 0.50 * eased
    return weights, opacity


def author_timeline(actor: bpy.types.Object, opacity: bpy.types.Node) -> dict[str, dict[str, object]]:
    blocks = actor.data.shape_keys.key_blocks
    clips: dict[str, dict[str, object]] = {}
    frame_cursor = 1
    for row, clip in enumerate(CLIPS):
        start = frame_cursor
        for local_frame in range(FRAMES_PER_CLIP):
            weights, alpha = clip_weights(clip, local_frame)
            for name, value in weights.items():
                blocks[name].value = value
                blocks[name].keyframe_insert("value", frame=frame_cursor)
            opacity.outputs[0].default_value = alpha
            opacity.outputs[0].keyframe_insert("default_value", frame=frame_cursor)
            frame_cursor += 1
        clips[clip] = {
            "row": row,
            "frames": FRAMES_PER_CLIP,
            "fps": 12 if clip != "IDLE" else 10,
            "loop": clip == "IDLE",
            **({"holdLastFrame": True} if clip == "DEFEAT" else {}),
        }
    if actor.data.shape_keys.animation_data and actor.data.shape_keys.animation_data.action:
        for curve in actor.data.shape_keys.animation_data.action.fcurves:
            for point in curve.keyframe_points:
                point.interpolation = "LINEAR"
    return clips


def load_pixels(path: Path) -> np.ndarray:
    image = bpy.data.images.load(str(path), check_existing=False)
    pixels = np.empty(image.size[0] * image.size[1] * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    array = pixels.reshape((image.size[1], image.size[0], 4))
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


def build_atlas(frame_paths: list[Path], output: Path) -> tuple[np.ndarray, list[float]]:
    atlas = np.zeros((FRAME_H * len(CLIPS), FRAME_W * FRAMES_PER_CLIP, 4), dtype=np.float32)
    occupancies: list[float] = []
    for index, path in enumerate(frame_paths):
        clip_row = index // FRAMES_PER_CLIP
        column = index % FRAMES_PER_CLIP
        frame = load_pixels(path)
        occupancies.append(float(np.mean(frame[:, :, 3] > 0.01)))
        storage_row = len(CLIPS) - 1 - clip_row
        y0 = storage_row * FRAME_H
        x0 = column * FRAME_W
        atlas[y0 : y0 + FRAME_H, x0 : x0 + FRAME_W] = frame
    save_pixels(output, atlas, "WEBP")
    return atlas, occupancies


def selected_frame(atlas: np.ndarray, clip_row: int, column: int) -> np.ndarray:
    storage_row = len(CLIPS) - 1 - clip_row
    y0 = storage_row * FRAME_H
    x0 = column * FRAME_W
    return atlas[y0 : y0 + FRAME_H, x0 : x0 + FRAME_W]


def render_actor(pilot: dict[str, object]) -> tuple[dict[str, object], list[np.ndarray]]:
    clear_scene()
    scene = configure_scene()
    source = SOURCE_ROOT / f"{pilot['id']}.png"
    output_dir = OUTPUT_ROOT / str(pilot["id"])
    frames_dir = output_dir / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)
    actor, opacity = create_grid_actor(source, pilot)
    clips = author_timeline(actor, opacity)
    scene.frame_start = 1
    scene.frame_end = len(CLIPS) * FRAMES_PER_CLIP

    frame_paths: list[Path] = []
    for frame in range(scene.frame_start, scene.frame_end + 1):
        scene.frame_set(frame)
        path = frames_dir / f"frame_{frame:03d}.png"
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        frame_paths.append(path)

    source_blend = output_dir / f"{pilot['id']}_PRODUCTION_PILOT_V2.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(source_blend))
    atlas_path = output_dir / f"{pilot['id']}_PRODUCTION_PILOT_V2.webp"
    atlas, occupancies = build_atlas(frame_paths, atlas_path)
    selected = [
        selected_frame(atlas, 0, 0),
        selected_frame(atlas, 1, 3),
        selected_frame(atlas, 1, 6),
        selected_frame(atlas, 2, 2),
        selected_frame(atlas, 3, 11),
    ]

    record = {
        "id": pilot["id"],
        "rank": pilot["rank"],
        "source": source.relative_to(ROOT).as_posix(),
        "sourceSha256": sha256(source),
        "sourceBlend": source_blend.relative_to(ROOT).as_posix(),
        "sourceBlendSha256": sha256(source_blend),
        "atlas": atlas_path.relative_to(ROOT).as_posix(),
        "atlasSha256": sha256(atlas_path),
        "frameWidth": FRAME_W,
        "frameHeight": FRAME_H,
        "columns": FRAMES_PER_CLIP,
        "rows": len(CLIPS),
        "clips": clips,
        "frames": len(frame_paths),
        "minAlphaOccupancy": min(occupancies),
        "maxAlphaOccupancy": max(occupancies),
        "pipeline": "BLENDER_2P5D_MESH_WARP_V2",
        "status": "PILOT_VISUAL_QA_PENDING",
    }
    return record, selected


def composite_over(frame: np.ndarray, background: tuple[float, float, float]) -> np.ndarray:
    alpha = frame[:, :, 3:4]
    rgb = frame[:, :, :3] * alpha + np.array(background, dtype=np.float32).reshape((1, 1, 3)) * (1.0 - alpha)
    return np.concatenate((rgb, np.ones_like(alpha)), axis=2)


def build_contact(rows: list[list[np.ndarray]]) -> Path:
    columns = len(rows[0])
    contact = np.zeros((FRAME_H * len(rows), FRAME_W * columns, 4), dtype=np.float32)
    background = (0.025, 0.038, 0.065)
    for row_index, frames in enumerate(rows):
        storage_row = len(rows) - 1 - row_index
        y0 = storage_row * FRAME_H
        for column, frame in enumerate(frames):
            x0 = column * FRAME_W
            contact[y0 : y0 + FRAME_H, x0 : x0 + FRAME_W] = composite_over(frame, background)
    QA_ROOT.mkdir(parents=True, exist_ok=True)
    path = QA_ROOT / "ENEMY_PRODUCTION_PILOT_V2_CONTACT.png"
    save_pixels(path, contact, "PNG")
    return path


def main() -> int:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    records: list[dict[str, object]] = []
    contacts: list[list[np.ndarray]] = []
    for pilot in PILOTS:
        print(f"BUILD {pilot['id']} ({pilot['rank']})", flush=True)
        record, selected = render_actor(pilot)
        records.append(record)
        contacts.append(selected)
        print(f"WROTE {record['atlas']} frames={record['frames']}", flush=True)
    contact_path = build_contact(contacts)
    manifest = {
        "schema": "triad.enemy-production-pilot.v2",
        "version": "2.0.0-visual-qa-pending",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "runtimeActive": False,
        "frameContract": {
            "width": FRAME_W,
            "height": FRAME_H,
            "framesPerClip": FRAMES_PER_CLIP,
            "states": list(CLIPS),
            "faction": "ENEMY",
            "battleLane": "RIGHT",
            "facing": "LEFT",
            "runtimeScale": 1,
            "runtimeTranslate": [0, 0],
        },
        "records": records,
        "contactSheet": contact_path.relative_to(ROOT).as_posix(),
    }
    manifest_path = OUTPUT_ROOT / "enemy_production_pilot_v2_manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"manifest": str(manifest_path), "contact": str(contact_path), "records": len(records)}, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
