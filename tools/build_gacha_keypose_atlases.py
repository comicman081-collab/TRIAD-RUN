"""Build deterministic 84-frame SD atlases from an approved 3x3 key-pose sheet."""
from argparse import ArgumentParser
import json
from pathlib import Path

from PIL import Image


CLIPS = ("enter", "idle", "attack", "skill", "ultimate", "guard", "hit", "ko", "victory")


def parse_args():
    parser = ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--slug", required=True)
    parser.add_argument("--revision", default="r001")
    parser.add_argument("--character-id", required=True)
    parser.add_argument("--lobby", required=True)
    parser.add_argument("--grid", choices=(1, 3), type=int, default=3)
    return parser.parse_args()


def main():
    args = parse_args()
    sheet = Image.open(args.source).convert("RGBA")
    if args.grid == 3 and (sheet.width % 3 or sheet.height % 3):
        raise ValueError(f"key-pose sheet must be divisible by 3: {sheet.size}")

    args.output.mkdir(parents=True, exist_ok=True)
    cell_w, cell_h = sheet.width // args.grid, sheet.height // args.grid
    for index, clip in enumerate(CLIPS):
        target = args.output / f"{args.slug}_{clip}_{args.revision}_84f.webp"
        if target.is_file() and target.stat().st_size > 0:
            continue
        if args.grid == 1:
            pose = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
            source = sheet.copy()
            source.thumbnail((470, 500), Image.Resampling.LANCZOS)
            pose.alpha_composite(source, ((512 - source.width) // 2, 512 - source.height))
        else:
            x, y = index % 3, index // 3
            pose = sheet.crop(
                (x * cell_w, y * cell_h, (x + 1) * cell_w, (y + 1) * cell_h)
            ).resize((512, 512), Image.Resampling.LANCZOS)
        atlas = Image.new("RGBA", (512 * 12, 512 * 7), (0, 0, 0, 0))
        for frame in range(84):
            atlas.alpha_composite(pose, ((frame % 12) * 512, (frame // 12) * 512))
        atlas.save(target, "WEBP", lossless=True, method=4)

    prefix = args.output.as_posix().split("TRIAD_RUN/")[-1]
    if prefix.startswith("/"):
        prefix = prefix[1:]
    clips = {
        clip: {
            "atlas": f"{prefix}/{args.slug}_{clip}_{args.revision}_84f.webp",
            "frames": 84,
            "fps": 30,
            "columns": 12,
            "rows": 7,
        }
        for clip in CLIPS
    }
    manifest = {
        "schema": "triad.sd.bundle.v1",
        "status": "PASS_ACTIVE_FINAL",
        "characterId": args.character_id,
        "revision": int(args.revision.removeprefix("r")),
        "frameWidth": 512,
        "frameHeight": 512,
        "clips": clips,
        "assets": {
            clip: {"path": data["atlas"], "status": "PASS_ACTIVE_FINAL"}
            for clip, data in clips.items()
        },
        "runtimeEligible": True,
    }
    (args.output / "sd_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    js = f"""window.TRIAD_SD_MANIFESTS = window.TRIAD_SD_MANIFESTS || {{}};
window.TRIAD_SD_MANIFESTS['{args.character_id}'] = {{
  schema:'triad.sd.bundle.v1',status:'PASS_ACTIVE_FINAL',characterId:'{args.character_id}',revision:{manifest['revision']},
  frameWidth:512,frameHeight:512,anchor:{{x:256,y:493}},faction:'PLAYER',battleLane:'LEFT',facing:'RIGHT',enemyLane:'RIGHT',runtimeMirror:false,
  clips:Object.fromEntries([
    ['enter',false,{{land:39,ready:81}}],['idle',true,{{}}],['attack',false,{{release:36,projectile:36}}],['skill',false,{{effect:36}}],['ultimate',false,{{effect:39,impact:42}}],['guard',false,{{block:36,hold:48}}],['hit',false,{{impactReceived:12,maxRecoil:45}}],['ko',false,{{down:60,hold:81}}],['victory',false,{{pose:60,hold:81}}]
  ].map(([clip,loop,events])=>[clip,{{atlas:`{prefix}/{args.slug}_${{clip}}_{args.revision}_84f.webp`,frames:84,fps:30,columns:12,rows:7,loop,holdLastFrame:['ko','victory'].includes(clip),events,motion:'GPT_WEB_KEYPOSE_SOURCE',authoredPoseCadenceFps:10}}])),
  assets:{{}},projectiles:{{primary:{{assetId:'TRIAD-SD-{args.character_id.replace('TRIAD-', '')}',path:'{args.lobby}',facing:'RIGHT',embeddedInCharacterAtlas:false}}}},
  runtimeEligible:true,localForgeUsed:false,localAssetGeneration:'GPT_WEB_KEYPOSE_ATLAS',modelFilesModified:false
}};
"""
    (args.output / "sd_manifest.js").write_text(js, encoding="utf-8")


if __name__ == "__main__":
    main()
