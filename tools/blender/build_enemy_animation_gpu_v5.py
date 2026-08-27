"""Build a GPU-rendered enemy animation candidate without touching active v4 assets.

This is deliberately a candidate pipeline.  It reuses the already approved v4
transparent key-pose source for one actor, registers every rendered pose into
the existing 420x420 enemy frame contract, and adds presentation-only ENTER
and SKILL rows.  The output is not runtime-active until visual and HTML gates
pass.

Blender EEVEE Next is used for the image-to-transparent-frame render pass.  It
is a GPU renderer in Blender 4.5; the final atlas assembly still uses Blender's
image API so the registration math remains identical to the existing v4
pipeline.
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
FRAME_W = 420
FRAME_H = 420
FRAMES_PER_CLIP = 6
BASELINE_Y = 20
CLIPS = ("IDLE", "ENTER", "ATTACK", "SKILL", "HIT", "DEFEAT")
POSE_ORDER = ("IDLE", "ATTACK_WINDUP", "ATTACK_CONTACT", "ATTACK_RECOVERY", "HIT", "DEFEAT")


def arg_value(name: str, default: str) -> str:
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    for index, value in enumerate(args):
        if value == name and index + 1 < len(args):
            return args[index + 1]
    return default


ACTOR = arg_value("--actor", "SHADE_M01")
REVISION = arg_value("--revision", "V5").upper()
SOURCE_ROOT = ROOT / "assets" / "enemies" / "production_pilot_v4" / ACTOR
CANDIDATE_DIR = f"production_pilot_{REVISION.lower()}_candidate"
OUTPUT_ROOT = ROOT / "assets" / "enemies" / CANDIDATE_DIR / ACTOR
KEYPOSE_MANIFEST = SOURCE_ROOT / f"{ACTOR}_KEYPOSE_MANIFEST_V4.json"
SOURCE_PRODUCTION_MANIFEST = SOURCE_ROOT / f"{ACTOR}_PRODUCTION_PILOT_V4_MANIFEST.json"
OUTPUT = OUTPUT_ROOT / f"{ACTOR}_PRODUCTION_PILOT_{REVISION}_GPU_CANDIDATE.webp"
MANIFEST_OUTPUT = OUTPUT_ROOT / f"{ACTOR}_PRODUCTION_PILOT_{REVISION}_GPU_CANDIDATE_MANIFEST.json"
QA_OUTPUT = ROOT / "reports" / "qa" / f"{ACTOR}_PRODUCTION_{REVISION}_GPU_CANDIDATE_CONTACT.png"
BLEND_OUTPUT = OUTPUT_ROOT / f"{ACTOR}_GPU_REGISTRATION_PILOT.blend"
RENDER_ROOT = OUTPUT_ROOT / "gpu_pose_renders"


FRAME_PLAN = {
    "IDLE": (
        ("IDLE", 0, 0), ("IDLE", 0, 1), ("IDLE", 0, 2),
        ("IDLE", 0, 1), ("IDLE", 0, 0), ("IDLE", 0, -1),
    ),
    # A low-to-ready rise gives the monster a readable battle entrance using
    # only the approved pose source; no new gameplay or enemy art is invented.
    "ENTER": (
        ("DEFEAT", 0, 8), ("HIT", 2, 5), ("ATTACK_RECOVERY", 4, 2),
        ("ATTACK_WINDUP", 2, 1), ("IDLE", 0, 0), ("IDLE", 0, 0),
    ),
    "ATTACK": (
        ("IDLE", 0, 0), ("ATTACK_WINDUP", 4, 0), ("ATTACK_WINDUP", 2, 1),
        ("ATTACK_CONTACT", -8, 0), ("ATTACK_RECOVERY", -2, 0), ("IDLE", 0, 0),
    ),
    # The second named skill is presentation-only at this stage.  It is a
    # stronger, longer reach presentation distinct from the ordinary attack,
    # while damage/hits/target remain authored by combat_data.js.
    "SKILL": (
        ("IDLE", 0, 0), ("ATTACK_WINDUP", 10, -2), ("ATTACK_WINDUP", 18, -2),
        ("ATTACK_CONTACT", -18, 0), ("ATTACK_CONTACT", -10, 0), ("ATTACK_RECOVERY", -2, 0),
    ),
    "HIT": (
        ("IDLE", 0, 0), ("HIT", 8, 1), ("HIT", 10, 0),
        ("HIT", 6, -1), ("ATTACK_RECOVERY", 2, 0), ("IDLE", 0, 0),
    ),
    "DEFEAT": (
        ("IDLE", 0, 0), ("HIT", 5, 0), ("DEFEAT", 0, 0),
        ("DEFEAT", 0, 0), ("DEFEAT", 0, 0), ("DEFEAT", 0, 0),
    ),
}

# V6 is a separate candidate revision created from GPT visual-QA feedback.
# It keeps the approved source keyposes and canvas contract, but gives SKILL,
# HIT, and DEFEAT a more readable silhouette/impact through controlled
# offline registration rotation and zoom. V5 remains reproducible unchanged
# when --revision V5 is used.
if REVISION == "V6":
    FRAME_PLAN = {
        "IDLE": (
            ("IDLE", 0, 0, 0, 1.00), ("IDLE", 0, 0, 2, 1.01), ("IDLE", 0, 0, 0, 1.00),
            ("IDLE", 0, 0, -2, 1.01), ("IDLE", 0, 0, 0, 1.00), ("IDLE", 0, 0, 0, 1.00),
        ),
        "ENTER": (
            ("HIT", 0, 4, 0, 1.00), ("ATTACK_WINDUP", 0, 2, -2, 1.00),
            ("ATTACK_WINDUP", 4, 0, 0, 1.02), ("ATTACK_RECOVERY", 0, 0, 2, 1.00),
            ("IDLE", 0, 0, 0, 1.00), ("IDLE", 0, 0, 0, 1.00),
        ),
        "ATTACK": (
            ("IDLE", 0, 0, 0, 1.00), ("ATTACK_WINDUP", 4, 0, 0, 1.00),
            ("ATTACK_WINDUP", 2, 1, 0, 1.00), ("ATTACK_CONTACT", -8, 0, 0, 1.00),
            ("ATTACK_RECOVERY", -2, 0, 0, 1.00), ("IDLE", 0, 0, 0, 1.00),
        ),
        "SKILL": (
            ("IDLE", 0, 0, 0, 1.00), ("ATTACK_WINDUP", 8, 0, -6, 1.04),
            ("ATTACK_WINDUP", 18, -4, -10, 1.08), ("ATTACK_CONTACT", -26, 2, -14, 1.10),
            ("ATTACK_CONTACT", -18, 6, -8, 1.08), ("ATTACK_RECOVERY", 4, 4, 4, 1.00),
        ),
        "HIT": (
            ("IDLE", 0, 0, 0, 1.00), ("HIT", 12, 4, 6, 1.03),
            ("HIT", 20, 10, 10, 1.06), ("DEFEAT", 12, 8, 14, 1.05),
            ("HIT", 8, 3, 7, 1.02), ("ATTACK_RECOVERY", 0, 0, 2, 1.00),
        ),
        "DEFEAT": (
            ("IDLE", 0, 0, 0, 1.00), ("HIT", 10, 5, 6, 1.04),
            ("DEFEAT", 8, 7, 10, 1.05), ("DEFEAT", 4, 4, 8, 1.04),
            ("DEFEAT", 0, 0, 4, 1.02), ("DEFEAT", 0, 0, 0, 1.00),
        ),
    }

# V7 is a strict visual-gate correction candidate for the RIFT pilots.
# The approved V4 keypose source remains unchanged.  SKILL is registered as
# an elevated charge/release silhouette instead of repeating the sword-contact
# line, and HIT never borrows the terminal DEFEAT pose so its F4 frame cannot
# read as a collapse.  V6 remains reproducible when explicitly requested.
if REVISION == "V7" and ACTOR in {"RIFT_M07", "RIFT_M08", "RIFT_M09", "RIFT_M10", "RIFT_M11", "RIFT_M12", "RIFT_M13", "RIFT_M14", "RIFT_M15"}:
    FRAME_PLAN = {
        "IDLE": (
            ("IDLE", 0, 0, 0, 1.00), ("IDLE", 0, 0, 2, 1.01), ("IDLE", 0, 0, 0, 1.00),
            ("IDLE", 0, 0, -2, 1.01), ("IDLE", 0, 0, 0, 1.00), ("IDLE", 0, 0, 0, 1.00),
        ),
        "ENTER": (
            ("HIT", 0, 4, 0, 1.00), ("ATTACK_WINDUP", 0, 2, -2, 1.00),
            ("ATTACK_WINDUP", 4, 0, 0, 1.02), ("ATTACK_RECOVERY", 0, 0, 2, 1.00),
            ("IDLE", 0, 0, 0, 1.00), ("IDLE", 0, 0, 0, 1.00),
        ),
        "ATTACK": (
            ("IDLE", 0, 0, 0, 1.00), ("ATTACK_WINDUP", 4, 0, 0, 1.00),
            ("ATTACK_WINDUP", 2, 1, 0, 1.00), ("ATTACK_CONTACT", -8, 0, 0, 1.00),
            ("ATTACK_RECOVERY", -2, 0, 0, 1.00), ("IDLE", 0, 0, 0, 1.00),
        ),
        # Deliberately use a lifted/rotated charge silhouette for F2-F4;
        # F5 is the only release/contact frame.  This is an offline baked
        # registration, not a runtime transform.
        "SKILL": (
            ("IDLE", 0, 0, 0, 1.00), ("ATTACK_WINDUP", 4, -4, 26, 1.04),
            ("ATTACK_WINDUP", 8, -8, 38, 1.08), ("ATTACK_RECOVERY", -4, -6, 30, 1.10),
            ("ATTACK_CONTACT", -18, 2, 16, 1.10), ("ATTACK_RECOVERY", 2, 4, 8, 1.02),
        ),
        # Keep the source HIT pose for the entire reaction.  No DEFEAT pose
        # is used in this row; F4 is a strong rear-bend rather than a kneel.
        "HIT": (
            ("IDLE", 0, 0, 0, 1.00), ("HIT", 8, 2, -4, 1.03),
            ("HIT", 14, 6, -8, 1.06), ("HIT", 12, 8, -10, 1.08),
            ("HIT", 7, 4, -6, 1.04), ("ATTACK_RECOVERY", 0, 0, 2, 1.00),
        ),
        "DEFEAT": (
            ("IDLE", 0, 0, 0, 1.00), ("HIT", 10, 5, 6, 1.04),
            ("DEFEAT", 8, 7, 10, 1.05), ("DEFEAT", 4, 4, 8, 1.04),
            ("DEFEAT", 0, 0, 4, 1.02), ("DEFEAT", 0, 0, 0, 1.00),
        ),
    }

# V8 is an actor-specific correction for RIFT_M08 after the V7 visual gate.
# It keeps the approved V4 keyposes and changes only the offline baked
# registration plan: SKILL uses the upright recovery pose as a stationary
# channel/expansion silhouette, while HIT uses grounded recovery frames so
# the feet do not read as airborne. No runtime transform is introduced.
if REVISION == "V8" and ACTOR == "RIFT_M08":
    FRAME_PLAN = {
        "IDLE": (
            ("IDLE", 0, 0, 0, 1.00), ("IDLE", 0, 0, 2, 1.01), ("IDLE", 0, 0, 0, 1.00),
            ("IDLE", 0, 0, -2, 1.01), ("IDLE", 0, 0, 0, 1.00), ("IDLE", 0, 0, 0, 1.00),
        ),
        "ENTER": (
            ("HIT", 0, 4, 0, 1.00), ("ATTACK_WINDUP", 0, 2, -2, 1.00),
            ("ATTACK_WINDUP", 4, 0, 0, 1.02), ("ATTACK_RECOVERY", 0, 0, 2, 1.00),
            ("IDLE", 0, 0, 0, 1.00), ("IDLE", 0, 0, 0, 1.00),
        ),
        "ATTACK": (
            ("IDLE", 0, 0, 0, 1.00), ("ATTACK_WINDUP", 4, 0, 0, 1.00),
            ("ATTACK_WINDUP", 2, 1, 0, 1.00), ("ATTACK_CONTACT", -8, 0, 0, 1.00),
            ("ATTACK_RECOVERY", -2, 0, 0, 1.00), ("IDLE", 0, 0, 0, 1.00),
        ),
        "SKILL": (
            ("IDLE", 0, 0, 0, 1.00),
            ("ATTACK_RECOVERY", 0, 0, -4, 1.02),
            ("ATTACK_RECOVERY", 0, 0, -8, 1.07),
            ("ATTACK_RECOVERY", 0, 2, 0, 1.10),
            ("ATTACK_RECOVERY", 0, 0, 8, 1.07),
            ("ATTACK_RECOVERY", 0, 0, 4, 1.02),
        ),
        "HIT": (
            ("IDLE", 0, 0, 0, 1.00),
            ("ATTACK_RECOVERY", 0, 2, -4, 1.00),
            ("ATTACK_RECOVERY", 0, 4, -8, 1.02),
            ("ATTACK_RECOVERY", 0, 4, -12, 1.04),
            ("ATTACK_RECOVERY", 0, 2, -8, 1.02),
            ("IDLE", 0, 0, -2, 1.00),
        ),
        "DEFEAT": (
            ("IDLE", 0, 0, 0, 1.00), ("HIT", 10, 5, 6, 1.04),
            ("DEFEAT", 8, 7, 10, 1.05), ("DEFEAT", 4, 4, 8, 1.04),
            ("DEFEAT", 0, 0, 4, 1.02), ("DEFEAT", 0, 0, 0, 1.00),
        ),
    }


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_pixels(image: bpy.types.Image, width: int, height: int) -> np.ndarray:
    if image.size[0] != width or image.size[1] != height:
        image.scale(width, height)
    pixels = np.empty(width * height * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    return pixels.reshape((height, width, 4))


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
    dst_x0 = max(0, x)
    dst_y0 = max(0, y)
    dst_x1 = min(destination.shape[1], x + width)
    dst_y1 = min(destination.shape[0], y + height)
    if dst_x0 >= dst_x1 or dst_y0 >= dst_y1:
        return
    src_x0 = dst_x0 - x
    src_y0 = dst_y0 - y
    src_x1 = src_x0 + (dst_x1 - dst_x0)
    src_y1 = src_y0 + (dst_y1 - dst_y0)
    src = source[src_y0:src_y1, src_x0:src_x1]
    dst = destination[dst_y0:dst_y1, dst_x0:dst_x1]
    src_alpha = src[:, :, 3:4]
    dst_alpha = dst[:, :, 3:4]
    out_alpha = src_alpha + dst_alpha * (1.0 - src_alpha)
    out_rgb = np.where(
        out_alpha > 1e-6,
        (src[:, :, :3] * src_alpha + dst[:, :, :3] * dst_alpha * (1.0 - src_alpha))
        / np.maximum(out_alpha, 1e-6),
        0.0,
    )
    dst[:, :, :3] = out_rgb
    dst[:, :, 3:4] = out_alpha


def configure_gpu_scene() -> tuple[bpy.types.Scene, bpy.types.Object, bpy.types.Material, str]:
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    scene = bpy.data.scenes.get("TRIAD_ENEMY_GPU_REGISTRATION") or bpy.data.scenes.new("TRIAD_ENEMY_GPU_REGISTRATION")
    bpy.context.window.scene = scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = FRAME_W
    scene.render.resolution_y = FRAME_H
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1

    camera_data = bpy.data.cameras.get("GPU_REGISTRATION_CAMERA") or bpy.data.cameras.new("GPU_REGISTRATION_CAMERA")
    camera = bpy.data.objects.get("GPU_REGISTRATION_CAMERA") or bpy.data.objects.new("GPU_REGISTRATION_CAMERA", camera_data)
    camera.location = (0, 0, 10)
    camera.rotation_euler = (0, 0, 0)
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = FRAME_W
    scene.camera = camera
    if camera.name not in scene.collection.objects:
        scene.collection.objects.link(camera)

    mesh = bpy.data.meshes.get("GPU_REGISTRATION_PLANE") or bpy.data.meshes.new("GPU_REGISTRATION_PLANE")
    if not mesh.vertices:
        mesh.from_pydata(((-1, -1, 0), (1, -1, 0), (1, 1, 0), (-1, 1, 0)), (), ((0, 1, 2, 3),))
        mesh.update()
    plane = bpy.data.objects.get("GPU_REGISTRATION_PLANE") or bpy.data.objects.new("GPU_REGISTRATION_PLANE", mesh)
    if plane.name not in scene.collection.objects:
        scene.collection.objects.link(plane)

    material = bpy.data.materials.get("GPU_RGBA_EMISSION") or bpy.data.materials.new("GPU_RGBA_EMISSION")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    coordinates = nodes.new("ShaderNodeTexCoord")
    texture = nodes.new("ShaderNodeTexImage")
    texture.name = "SOURCE_RGBA_TEXTURE"
    transparent = nodes.new("ShaderNodeBsdfTransparent")
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Strength"].default_value = 1.0
    mix = nodes.new("ShaderNodeMixShader")
    output = nodes.new("ShaderNodeOutputMaterial")
    links.new(coordinates.outputs["Generated"], texture.inputs["Vector"])
    links.new(texture.outputs["Color"], emission.inputs["Color"])
    links.new(texture.outputs["Alpha"], mix.inputs["Fac"])
    links.new(transparent.outputs[0], mix.inputs[1])
    links.new(emission.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs[0])
    plane.data.materials.clear()
    plane.data.materials.append(material)
    if scene.world is None:
        scene.world = bpy.data.worlds.new("TRIAD_ENEMY_GPU_WORLD")
    scene.world.color = (0, 0, 0)
    return scene, plane, material, "BLENDER_EEVEE_NEXT_GPU"


def render_pose(scene: bpy.types.Scene, plane: bpy.types.Object, material: bpy.types.Material, record: dict, scale: float, pose_index: int, rotation_degrees: float = 0) -> np.ndarray:
    source_path = ROOT / str(record["path"])
    source = bpy.data.images.load(str(source_path), check_existing=False)
    source_width = int(record["width"])
    source_height = int(record["height"])
    width = max(1, round(source_width * scale))
    height = max(1, round(source_height * scale))
    min_x, min_y, _max_x, _max_y = [int(value) for value in record["sourceBbox"]]
    cell_column = pose_index % 3
    cell_row = 1 if pose_index < 3 else 0
    cell_center_x = cell_column * 512 + 256
    cell_origin_y = cell_row * 512
    x = round(FRAME_W / 2 - (cell_center_x - min_x) * scale)
    y = round(BASELINE_Y + (min_y - cell_origin_y) * scale)
    plane.location = (x + width / 2 - FRAME_W / 2, FRAME_H / 2 - (y + height / 2), 0)
    plane.scale = (width / 2, height / 2, 1)
    plane.rotation_euler[2] = math.radians(rotation_degrees)
    material.node_tree.nodes["SOURCE_RGBA_TEXTURE"].image = source
    output = RENDER_ROOT / f"{record['pose']}_{pose_index:02d}.png"
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    rendered = bpy.data.images.load(str(output), check_existing=False)
    pixels = load_pixels(rendered, FRAME_W, FRAME_H).copy()
    bpy.data.images.remove(rendered)
    bpy.data.images.remove(source)
    return pixels


def main() -> int:
    if not KEYPOSE_MANIFEST.exists():
        raise FileNotFoundError(KEYPOSE_MANIFEST)
    source_manifest = json.loads(KEYPOSE_MANIFEST.read_text(encoding="utf-8"))
    source_production = json.loads(SOURCE_PRODUCTION_MANIFEST.read_text(encoding="utf-8"))
    records = {record["pose"]: record for record in source_manifest["poses"]}
    missing = [pose for pose in POSE_ORDER if pose not in records]
    if missing:
        raise RuntimeError(f"Missing approved key poses: {missing}")
    scale = float(source_production.get("registrationScale", 0.8))

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    RENDER_ROOT.mkdir(parents=True, exist_ok=True)
    QA_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    scene, plane, material, gpu_pipeline = configure_gpu_scene()
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_OUTPUT))

    rendered_poses = {}
    for pose_index, pose in enumerate(POSE_ORDER):
        rendered_poses[pose] = render_pose(scene, plane, material, records[pose], scale, pose_index)

    atlas = np.zeros((FRAME_H * len(CLIPS), FRAME_W * FRAMES_PER_CLIP, 4), dtype=np.float32)
    generated_frames: list[dict[str, object]] = []
    variant_cache = {}
    for clip_row, clip in enumerate(CLIPS):
        for column, frame_spec in enumerate(FRAME_PLAN[clip]):
            pose, dx, dy = frame_spec[:3]
            rotation = float(frame_spec[3]) if len(frame_spec) > 3 else 0.0
            zoom = float(frame_spec[4]) if len(frame_spec) > 4 else 1.0
            variant_key = (pose, rotation, zoom)
            if variant_key not in variant_cache:
                if rotation == 0.0 and zoom == 1.0:
                    variant_cache[variant_key] = rendered_poses[pose]
                else:
                    pose_index = POSE_ORDER.index(pose)
                    variant_cache[variant_key] = render_pose(
                        scene, plane, material, records[pose], scale * zoom, pose_index, rotation
                    )
            frame = variant_cache[variant_key]
            shifted = np.zeros_like(frame)
            alpha_over(shifted, frame, dx, dy)
            storage_row = len(CLIPS) - 1 - clip_row
            y0 = storage_row * FRAME_H
            x0 = column * FRAME_W
            atlas[y0 : y0 + FRAME_H, x0 : x0 + FRAME_W] = shifted
            generated_frames.append({
                "clip": clip,
                "frame": column,
                "pose": pose,
                "offset": [dx, dy],
                "registrationRotation": rotation,
                "registrationZoom": zoom,
            })

    save_pixels(OUTPUT, atlas, "WEBP")
    dark = np.zeros_like(atlas)
    dark[:, :, :3] = np.array((0.025, 0.038, 0.065), dtype=np.float32)
    dark[:, :, 3] = 1.0
    alpha = atlas[:, :, 3:4]
    dark[:, :, :3] = atlas[:, :, :3] * alpha + dark[:, :, :3] * (1.0 - alpha)
    save_pixels(QA_OUTPUT, dark, "PNG")

    clips = {
        "IDLE": {"row": 0, "frames": 6, "fps": 6, "loop": True},
        "ENTER": {"row": 1, "frames": 6, "fps": 10, "loop": False},
        "ATTACK": {"row": 2, "frames": 6, "fps": 10, "loop": False, "events": {"impact": 3}},
        "SKILL": {"row": 3, "frames": 6, "fps": 12, "loop": False, "events": {"impact": 3}},
        "HIT": {"row": 4, "frames": 6, "fps": 12, "loop": False, "events": {"impact": 1}},
        "DEFEAT": {"row": 5, "frames": 6, "fps": 8, "loop": False, "holdLastFrame": True},
    }
    manifest = {
        "schema": f"triad.enemy-production-pilot.{REVISION.lower()}",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "id": ACTOR,
        "rank": source_production.get("rank", "NORMAL"),
        "status": "PASS_ACTIVE_CANDIDATE",
        "runtimeActive": False,
        "faction": "ENEMY",
        "battleLane": "RIGHT",
        "facing": "LEFT",
        "atlas": OUTPUT.relative_to(ROOT).as_posix(),
        "atlasSha256": sha256(OUTPUT),
        "frameWidth": FRAME_W,
        "frameHeight": FRAME_H,
        "columns": FRAMES_PER_CLIP,
        "rows": len(CLIPS),
        "clips": clips,
        "sourceKeyposeManifest": KEYPOSE_MANIFEST.relative_to(ROOT).as_posix(),
        "sourceKeyposeManifestSha256": sha256(KEYPOSE_MANIFEST),
        "sourceProductionManifest": SOURCE_PRODUCTION_MANIFEST.relative_to(ROOT).as_posix(),
        "sourceProductionManifestSha256": sha256(SOURCE_PRODUCTION_MANIFEST),
        "pipeline": f"BLENDER_EEVEE_NEXT_GPU__V4_KEYPOSE_REGISTRATION__{REVISION}_CANDIDATE",
        "gpuPipeline": gpu_pipeline,
        "sourcePolicy": "APPROVED_V4_KEYPOSES_ONLY__NO_ACTIVE_OVERWRITE",
        "registrationScale": scale,
        "runtimeTransform": {"scale": 1, "translate": [0, 0]},
        "framePlan": generated_frames,
        "qaContact": QA_OUTPUT.relative_to(ROOT).as_posix(),
        "blendSource": BLEND_OUTPUT.relative_to(ROOT).as_posix(),
    }
    MANIFEST_OUTPUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "actor": ACTOR,
        "atlas": str(OUTPUT),
        "atlasSha256": manifest["atlasSha256"],
        "manifest": str(MANIFEST_OUTPUT),
        "contact": str(QA_OUTPUT),
        "blend": str(BLEND_OUTPUT),
        "gpuPipeline": gpu_pipeline,
        "clips": list(clips),
        "frames": len(generated_frames),
        "runtimeActive": False,
    }, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
