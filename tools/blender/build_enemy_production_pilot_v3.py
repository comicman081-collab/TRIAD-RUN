"""Build articulated 2.5D enemy animation candidates with Blender only.

V2 bent the entire source image with broad Gaussian fields, which visibly
stretched weapons and wings.  V3 keeps the source RGBA intact and applies
mostly-rigid transforms to logical regions (legs, weapon arm, blade, wings,
claws).  Only narrow joint bands blend into the stationary torso.

The active FRAME MVP is intentionally untouched.  Outputs are candidates
until offline and actual-runtime visual gates pass.

Run:
    blender -b --python tools/blender/build_enemy_production_pilot_v3.py
"""

from __future__ import annotations

import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import bpy
import numpy as np


ROOT = Path(__file__).resolve().parents[2]
SOURCE_ROOT = ROOT / "assets" / "enemies" / "monsters_rgba_p1"
OUTPUT_ROOT = ROOT / "assets" / "enemies" / "production_pilot_v3"
QA_ROOT = ROOT / "reports" / "qa"

FRAME_W = 320
FRAME_H = 420
FRAMES_PER_CLIP = 12
CLIPS = ("IDLE", "ATTACK", "HIT", "DEFEAT")
GRID_X = 72
GRID_Y = 96

PILOTS = (
    {"id": "SHADE_M01", "rank": "NORMAL", "kind": "SPIDER"},
    {"id": "RIFT_M10", "rank": "ELITE", "kind": "KNIGHT"},
    {"id": "EMBER_M13", "rank": "BOSS", "kind": "WINGED_BOSS"},
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
    for datablocks in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def smoothstep(edge0: float, edge1: float, value: float) -> float:
    t = clamp01((value - edge0) / max(1e-7, edge1 - edge0))
    return t * t * (3.0 - 2.0 * t)


def ellipse_weight(u: float, v: float, cx: float, cy: float, sx: float, sy: float) -> float:
    distance = math.sqrt(((u - cx) / sx) ** 2 + ((v - cy) / sy) ** 2)
    return 1.0 - smoothstep(0.78, 1.04, distance)


def segment_weight(
    u: float,
    v: float,
    ax: float,
    ay: float,
    bx: float,
    by: float,
    radius: float,
) -> float:
    abx = bx - ax
    aby = by - ay
    denominator = abx * abx + aby * aby
    t = clamp01(((u - ax) * abx + (v - ay) * aby) / max(1e-7, denominator))
    px = ax + t * abx
    py = ay + t * aby
    distance = math.hypot(u - px, v - py)
    return 1.0 - smoothstep(radius * 0.72, radius, distance)


def uv_to_xy(u: float, v: float, aspect: float) -> tuple[float, float]:
    return (u - 0.5) * 2.0 * aspect, (v - 0.5) * 2.0


def rigid_transform(
    x: float,
    y: float,
    pivot_x: float,
    pivot_y: float,
    angle: float,
    move_x: float,
    move_y: float,
) -> tuple[float, float]:
    cosine = math.cos(angle)
    sine = math.sin(angle)
    dx = x - pivot_x
    dy = y - pivot_y
    return (
        pivot_x + dx * cosine - dy * sine + move_x,
        pivot_y + dx * sine + dy * cosine + move_y,
    )


def blend_transform(
    x: float,
    y: float,
    pivot: tuple[float, float],
    angle: float,
    move: tuple[float, float],
    weight: float,
) -> tuple[float, float]:
    tx, ty = rigid_transform(x, y, pivot[0], pivot[1], angle, move[0], move[1])
    return x + (tx - x) * weight, y + (ty - y) * weight


def global_pose(kind: str, pose: str) -> tuple[float, float, float]:
    """Rigid body motion only; no squash/stretch."""
    if pose == "IDLE_INHALE":
        return 0.0, 0.0, 0.010
    if pose == "IDLE_EXHALE":
        return 0.0, 0.0, -0.006
    if pose == "ATTACK_WINDUP":
        return 0.030, 0.0, 0.020
    if pose == "ATTACK_CONTACT":
        return -0.105 if kind != "SPIDER" else -0.135, 0.0, 0.010
    if pose == "HIT_RECOIL":
        return 0.115, 0.012, -0.055
    if pose == "DEFEAT_COLLAPSE":
        if kind == "SPIDER":
            return 0.030, -0.18, -0.10
        return 0.075, -0.22, -0.18
    return 0.0, 0.0, 0.0


def deform_vertex(kind: str, pose: str, x: float, y: float, u: float, v: float, aspect: float) -> tuple[float, float, float]:
    move_x, move_y, angle = global_pose(kind, pose)
    foot_pivot = uv_to_xy(0.50, 0.10, aspect)
    nx, ny = rigid_transform(x, y, foot_pivot[0], foot_pivot[1], angle, move_x, move_y)

    if kind == "SPIDER":
        body = ellipse_weight(u, v, 0.50, 0.61, 0.37, 0.29)
        left_front = segment_weight(u, v, 0.34, 0.53, 0.11, 0.16, 0.11)
        right_front = segment_weight(u, v, 0.66, 0.53, 0.89, 0.16, 0.11)
        left_rear = segment_weight(u, v, 0.37, 0.50, 0.02, 0.40, 0.11)
        right_rear = segment_weight(u, v, 0.63, 0.50, 0.98, 0.40, 0.11)
        if pose == "ATTACK_WINDUP":
            nx, ny = blend_transform(nx, ny, uv_to_xy(0.36, 0.50, aspect), 0.16, (0.03, 0.03), left_front)
            nx, ny = blend_transform(nx, ny, uv_to_xy(0.64, 0.50, aspect), -0.16, (-0.02, 0.03), right_front)
        elif pose == "ATTACK_CONTACT":
            nx, ny = blend_transform(nx, ny, uv_to_xy(0.36, 0.50, aspect), -0.30, (-0.16, 0.01), left_front)
            nx, ny = blend_transform(nx, ny, uv_to_xy(0.64, 0.50, aspect), 0.18, (-0.06, -0.02), right_front)
            nx -= 0.035 * body
        elif pose == "HIT_RECOIL":
            nx, ny = blend_transform(nx, ny, uv_to_xy(0.38, 0.48, aspect), 0.12, (0.03, 0.02), left_rear)
            nx, ny = blend_transform(nx, ny, uv_to_xy(0.62, 0.48, aspect), -0.12, (-0.02, 0.02), right_rear)
        elif pose == "DEFEAT_COLLAPSE":
            nx, ny = blend_transform(nx, ny, uv_to_xy(0.36, 0.50, aspect), -0.25, (-0.05, -0.10), max(left_front, left_rear))
            nx, ny = blend_transform(nx, ny, uv_to_xy(0.64, 0.50, aspect), 0.25, (0.05, -0.10), max(right_front, right_rear))

    elif kind == "KNIGHT":
        arm = max(
            ellipse_weight(u, v, 0.56, 0.54, 0.105, 0.205),
            segment_weight(u, v, 0.50, 0.68, 0.58, 0.43, 0.105),
        )
        blade = segment_weight(u, v, 0.56, 0.48, 0.86, 0.17, 0.072)
        weapon = max(arm, blade)
        pivot = uv_to_xy(0.50, 0.68, aspect)
        if pose == "ATTACK_WINDUP":
            nx, ny = blend_transform(nx, ny, pivot, 0.22, (0.025, 0.025), weapon)
        elif pose == "ATTACK_CONTACT":
            nx, ny = blend_transform(nx, ny, pivot, -0.50, (-0.12, 0.02), weapon)
        elif pose == "HIT_RECOIL":
            nx, ny = blend_transform(nx, ny, pivot, 0.12, (0.035, 0.02), arm)
        elif pose == "DEFEAT_COLLAPSE":
            nx, ny = blend_transform(nx, ny, pivot, -0.28, (-0.015, -0.12), weapon)

    elif kind == "WINGED_BOSS":
        wing_left = max(
            ellipse_weight(u, v, 0.24, 0.72, 0.27, 0.29),
            segment_weight(u, v, 0.43, 0.66, 0.05, 0.90, 0.15),
        )
        wing_right = max(
            ellipse_weight(u, v, 0.76, 0.72, 0.27, 0.29),
            segment_weight(u, v, 0.57, 0.66, 0.95, 0.90, 0.15),
        )
        claw_left = max(
            ellipse_weight(u, v, 0.27, 0.42, 0.18, 0.24),
            segment_weight(u, v, 0.42, 0.58, 0.14, 0.22, 0.105),
        )
        claw_right = max(
            ellipse_weight(u, v, 0.73, 0.42, 0.18, 0.24),
            segment_weight(u, v, 0.58, 0.58, 0.86, 0.22, 0.105),
        )
        wing_left_pivot = uv_to_xy(0.43, 0.64, aspect)
        wing_right_pivot = uv_to_xy(0.57, 0.64, aspect)
        claw_left_pivot = uv_to_xy(0.42, 0.58, aspect)
        claw_right_pivot = uv_to_xy(0.58, 0.58, aspect)
        if pose == "ATTACK_WINDUP":
            nx, ny = blend_transform(nx, ny, wing_left_pivot, -0.12, (-0.01, 0.05), wing_left)
            nx, ny = blend_transform(nx, ny, wing_right_pivot, 0.12, (0.01, 0.05), wing_right)
            nx, ny = blend_transform(nx, ny, claw_left_pivot, 0.18, (0.03, 0.03), claw_left)
            nx, ny = blend_transform(nx, ny, claw_right_pivot, -0.18, (-0.03, 0.03), claw_right)
        elif pose == "ATTACK_CONTACT":
            nx, ny = blend_transform(nx, ny, wing_left_pivot, 0.16, (-0.05, -0.02), wing_left)
            nx, ny = blend_transform(nx, ny, wing_right_pivot, -0.16, (-0.03, -0.02), wing_right)
            nx, ny = blend_transform(nx, ny, claw_left_pivot, -0.34, (-0.14, 0.01), claw_left)
            nx, ny = blend_transform(nx, ny, claw_right_pivot, 0.22, (-0.08, 0.01), claw_right)
        elif pose == "HIT_RECOIL":
            nx, ny = blend_transform(nx, ny, wing_left_pivot, -0.08, (0.02, 0.025), wing_left)
            nx, ny = blend_transform(nx, ny, wing_right_pivot, 0.08, (0.02, 0.025), wing_right)
        elif pose == "DEFEAT_COLLAPSE":
            nx, ny = blend_transform(nx, ny, wing_left_pivot, 0.22, (0.02, -0.10), wing_left)
            nx, ny = blend_transform(nx, ny, wing_right_pivot, -0.22, (-0.02, -0.10), wing_right)
            nx, ny = blend_transform(nx, ny, claw_left_pivot, 0.16, (0.00, -0.12), claw_left)
            nx, ny = blend_transform(nx, ny, claw_right_pivot, -0.16, (0.00, -0.12), claw_right)

    return nx, ny, 0.0


def create_actor(source: Path, pilot: dict[str, str]) -> tuple[bpy.types.Object, bpy.types.Node]:
    image = bpy.data.images.load(str(source), check_existing=False)
    aspect = image.size[0] / image.size[1]
    width = 2.0 * aspect
    vertices: list[tuple[float, float, float]] = []
    uvs: list[tuple[float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    for row in range(GRID_Y):
        v = row / (GRID_Y - 1)
        for col in range(GRID_X):
            u = col / (GRID_X - 1)
            vertices.append(((u - 0.5) * width, (v - 0.5) * 2.0, 0.0))
            uvs.append((u, v))
    for row in range(GRID_Y - 1):
        for col in range(GRID_X - 1):
            a = row * GRID_X + col
            faces.append((a, a + 1, a + GRID_X + 1, a + GRID_X))

    mesh = bpy.data.meshes.new(f"{pilot['id']}_ARTICULATED_MESH")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            uv_layer.data[loop_index].uv = uvs[mesh.loops[loop_index].vertex_index]

    actor = bpy.data.objects.new(str(pilot["id"]), mesh)
    bpy.context.collection.objects.link(actor)
    actor["pipeline"] = "TRIAD_ENEMY_ARTICULATED_CUTOUT_V3"
    actor["faction"] = "ENEMY"
    actor["battleLane"] = "RIGHT"
    actor["facing"] = "LEFT"
    actor["runtimeScale"] = 1.0
    actor["runtimeTranslateX"] = 0.0
    actor["runtimeTranslateY"] = 0.0

    material = bpy.data.materials.new(f"{pilot['id']}_SOURCE_RGBA")
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
            key.data[index].co = deform_vertex(str(pilot["kind"]), pose, x, y, u, v, aspect)
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
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 2.30
    scene.camera = camera
    return scene


def clip_weights(clip: str, index: int) -> tuple[dict[str, float], float]:
    p = index / (FRAMES_PER_CLIP - 1)
    weights = {name: 0.0 for name in (
        "IDLE_INHALE", "IDLE_EXHALE", "ATTACK_WINDUP", "ATTACK_CONTACT", "HIT_RECOIL", "DEFEAT_COLLAPSE"
    )}
    opacity = 1.0
    if clip == "IDLE":
        wave = math.sin(p * math.tau)
        weights["IDLE_INHALE" if wave >= 0 else "IDLE_EXHALE"] = abs(wave)
    elif clip == "ATTACK":
        if index <= 3:
            weights["ATTACK_WINDUP"] = index / 3
        elif index <= 6:
            weights["ATTACK_WINDUP"] = 1.0 - (index - 3) / 3
            weights["ATTACK_CONTACT"] = (index - 3) / 3
        else:
            weights["ATTACK_CONTACT"] = max(0.0, 1.0 - (index - 6) / 5)
    elif clip == "HIT":
        weights["HIT_RECOIL"] = index / 2 if index <= 2 else max(0.0, 1.0 - (index - 2) / 9)
    elif clip == "DEFEAT":
        eased = 1.0 - (1.0 - p) ** 2
        weights["DEFEAT_COLLAPSE"] = eased
        opacity = 1.0 - 0.30 * eased
    return weights, opacity


def author_timeline(actor: bpy.types.Object, opacity: bpy.types.Node) -> dict[str, dict[str, object]]:
    blocks = actor.data.shape_keys.key_blocks
    clips: dict[str, dict[str, object]] = {}
    cursor = 1
    for row, clip in enumerate(CLIPS):
        for local_frame in range(FRAMES_PER_CLIP):
            weights, alpha = clip_weights(clip, local_frame)
            for name, value in weights.items():
                blocks[name].value = value
                blocks[name].keyframe_insert("value", frame=cursor)
            opacity.outputs[0].default_value = alpha
            opacity.outputs[0].keyframe_insert("default_value", frame=cursor)
            cursor += 1
        clips[clip] = {
            "row": row,
            "frames": FRAMES_PER_CLIP,
            "fps": 10 if clip == "IDLE" else 12,
            "loop": clip == "IDLE",
            **({"holdLastFrame": True} if clip == "DEFEAT" else {}),
        }
    if actor.data.shape_keys.animation_data and actor.data.shape_keys.animation_data.action:
        for curve in actor.data.shape_keys.animation_data.action.fcurves:
            for point in curve.keyframe_points:
                point.interpolation = "BEZIER"
                point.easing = "AUTO"
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
    occupancy: list[float] = []
    for index, path in enumerate(frame_paths):
        clip_row = index // FRAMES_PER_CLIP
        column = index % FRAMES_PER_CLIP
        frame = load_pixels(path)
        occupancy.append(float(np.mean(frame[:, :, 3] > 0.01)))
        storage_row = len(CLIPS) - 1 - clip_row
        atlas[storage_row * FRAME_H:(storage_row + 1) * FRAME_H, column * FRAME_W:(column + 1) * FRAME_W] = frame
    save_pixels(output, atlas, "WEBP")
    return atlas, occupancy


def selected_frame(atlas: np.ndarray, clip_row: int, column: int) -> np.ndarray:
    storage_row = len(CLIPS) - 1 - clip_row
    y0 = storage_row * FRAME_H
    x0 = column * FRAME_W
    return atlas[y0:y0 + FRAME_H, x0:x0 + FRAME_W]


def render_actor(pilot: dict[str, str]) -> tuple[dict[str, object], list[np.ndarray]]:
    clear_scene()
    scene = configure_scene()
    source = SOURCE_ROOT / f"{pilot['id']}.png"
    output_dir = OUTPUT_ROOT / pilot["id"]
    frames_dir = output_dir / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)
    actor, opacity = create_actor(source, pilot)
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
    source_blend = output_dir / f"{pilot['id']}_PRODUCTION_PILOT_V3.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(source_blend))
    atlas_path = output_dir / f"{pilot['id']}_PRODUCTION_PILOT_V3.webp"
    atlas, occupancy = build_atlas(frame_paths, atlas_path)
    selected = [
        selected_frame(atlas, 0, 0),
        selected_frame(atlas, 1, 3),
        selected_frame(atlas, 1, 6),
        selected_frame(atlas, 2, 2),
        selected_frame(atlas, 3, 11),
    ]
    return {
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
        "minAlphaOccupancy": min(occupancy),
        "maxAlphaOccupancy": max(occupancy),
        "pipeline": "BLENDER_ARTICULATED_CUTOUT_V3",
        "status": "PILOT_VISUAL_QA_PENDING",
    }, selected


def composite_over(frame: np.ndarray) -> np.ndarray:
    alpha = frame[:, :, 3:4]
    background = np.array((0.025, 0.038, 0.065), dtype=np.float32).reshape((1, 1, 3))
    rgb = frame[:, :, :3] * alpha + background * (1.0 - alpha)
    return np.concatenate((rgb, np.ones_like(alpha)), axis=2)


def build_contact(rows: list[list[np.ndarray]]) -> Path:
    contact = np.zeros((FRAME_H * len(rows), FRAME_W * len(rows[0]), 4), dtype=np.float32)
    for row_index, frames in enumerate(rows):
        storage_row = len(rows) - 1 - row_index
        for column, frame in enumerate(frames):
            y0 = storage_row * FRAME_H
            x0 = column * FRAME_W
            contact[y0:y0 + FRAME_H, x0:x0 + FRAME_W] = composite_over(frame)
    QA_ROOT.mkdir(parents=True, exist_ok=True)
    path = QA_ROOT / "ENEMY_PRODUCTION_PILOT_V3_CONTACT.png"
    save_pixels(path, contact, "PNG")
    return path


def main() -> int:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    records: list[dict[str, object]] = []
    contact_rows: list[list[np.ndarray]] = []
    for pilot in PILOTS:
        print(f"BUILD {pilot['id']} ({pilot['rank']})", flush=True)
        record, selected = render_actor(pilot)
        records.append(record)
        contact_rows.append(selected)
        print(f"WROTE {record['atlas']} frames={record['frames']}", flush=True)
    contact_path = build_contact(contact_rows)
    manifest = {
        "schema": "triad.enemy-production-pilot.v3",
        "version": "3.0.0-visual-qa-pending",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "runtimeActive": False,
        "supersedesCandidate": "assets/enemies/production_pilot_v2/enemy_production_pilot_v2_manifest.json",
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
    manifest_path = OUTPUT_ROOT / "enemy_production_pilot_v3_manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"manifest": str(manifest_path), "contact": str(contact_path), "records": len(records)}, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
