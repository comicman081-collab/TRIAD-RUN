#!/usr/bin/env python3
"""Verify every V3 derivative is transparent, intact and one-to-one."""

from hashlib import sha256
from pathlib import Path
import json

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "assets" / "vfx" / "derived_v3" / "manifest.json"


def digest(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest().upper()


def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    entries = list(manifest["cards"].values()) + list(manifest["enemies"].values())
    failures = []
    hashes = []
    for entry in entries:
        for kind in ("launch", "impact"):
            path = ROOT / entry[kind]
            expected = entry[f"{kind}Sha256"]
            actual = digest(path)
            hashes.append(actual)
            with Image.open(path) as image:
                bands = image.getbands()
                alpha = image.convert("RGBA").getchannel("A")
                alpha_range = alpha.getextrema()
                if image.size != (640, 640) or "A" not in bands or alpha_range[0] != 0 or alpha_range[1] == 0 or actual != expected:
                    failures.append({"id": entry["id"], "kind": kind, "size": image.size, "bands": bands, "alphaRange": alpha_range, "hashMatch": actual == expected})
    result = "PASS" if len(entries) == 306 and len(hashes) == 612 and len(set(hashes)) == 612 and not failures else "FAIL"
    print(json.dumps({"result": result, "skills": len(entries), "assets": len(hashes), "uniqueHashes": len(set(hashes)), "transparentAssets": len(hashes) - len(failures), "failures": failures}, ensure_ascii=False))
    if result != "PASS":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
