#!/usr/bin/env python3
"""Verify versioned asset, visual-grammar and five-phase choreography uniqueness."""

from __future__ import annotations

from hashlib import sha256
from pathlib import Path
import argparse
import json

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]


def digest(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest().upper()


def perceptual_signature(path: Path) -> int:
    image = Image.open(path).convert("RGBA")
    box = image.getchannel("A").getbbox()
    image = image.crop(box) if box else image
    planes = (image.convert("L"), image.getchannel("A"))
    signature = 0
    for plane in planes:
        resized = plane.resize((17, 16), Image.Resampling.LANCZOS)
        pixels = list(resized.get_flattened_data())
        for y in range(16):
            for x in range(16):
                signature = (signature << 1) | (pixels[y * 17 + x] > pixels[y * 17 + x + 1])
    return signature


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify an immutable TRIAD VFX manifest revision.")
    parser.add_argument("--version", type=int, choices=(4, 5), default=4)
    args = parser.parse_args()
    manifest_path = ROOT / f"assets/vfx/derived_v{args.version}/manifest.json"
    report_path = ROOT / f"qa_artifacts/combat_vfx_v{args.version}/distinct_vfx_audit.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    failures: list[str] = []
    rows = []
    hashes: list[str] = []
    visual_signatures: list[int] = []
    recipe_ids: list[str] = []
    sequence_ids: list[str] = []
    phase_keys: list[str] = []
    choreography_signatures: list[str] = []
    perceptual: dict[str, dict[str, tuple[int, int]]] = {"cards": {}, "enemies": {}}
    expected_domains = {"cards": {"CARD"}, "enemies": {"MONSTER_NORMAL", "MONSTER_ELITE", "MONSTER_BOSS"}}

    for group in ("cards", "enemies"):
        for skill_id, entry in manifest[group].items():
            sequence = entry.get("sequence") or {}
            sequence_ids.append(sequence.get("id", ""))
            choreography_signatures.append(json.dumps(sequence, sort_keys=True, separators=(",", ":")))
            for phase in ("charge", "travel", "contact", "rupture", "decay"):
                phase_keys.append(sequence.get(phase, {}).get("phaseKey", ""))
            identity = entry.get("visualIdentity") or {}
            domain = identity.get("domain")
            if domain not in expected_domains[group]:
                failures.append(f"{group}:{skill_id}:invalid-domain:{domain}")
            pair = []
            for phase in ("launch", "impact"):
                path = ROOT / entry[phase]
                if not path.exists():
                    failures.append(f"{group}:{skill_id}:{phase}:missing")
                    continue
                image = Image.open(path).convert("RGBA")
                alpha_min, alpha_max = image.getchannel("A").getextrema()
                actual_hash = digest(path)
                expected_hash = entry[f"{phase}Sha256"]
                signature = perceptual_signature(path)
                if image.size != (640, 640):
                    failures.append(f"{group}:{skill_id}:{phase}:size:{image.size}")
                if alpha_min != 0 or alpha_max < 200:
                    failures.append(f"{group}:{skill_id}:{phase}:alpha:{alpha_min}-{alpha_max}")
                if actual_hash != expected_hash:
                    failures.append(f"{group}:{skill_id}:{phase}:sha")
                recipe_id = identity.get(phase, {}).get("recipeId", "")
                recipe_ids.append(recipe_id)
                hashes.append(actual_hash)
                visual_signatures.append(signature)
                pair.append(signature)
                rows.append({"group": group, "skillId": skill_id, "phase": phase, "path": entry[phase], "sha256": actual_hash, "recipeId": recipe_id, "domain": domain})
            if len(pair) == 2:
                perceptual[group][skill_id] = (pair[0], pair[1])

    within_min: dict[str, dict[str, int]] = {"cards": {}, "enemies": {}}
    within_pairs: dict[str, dict[str, dict[str, str]]] = {"cards": {}, "enemies": {}}
    for group in ("cards", "enemies"):
        for phase_index, phase in enumerate(("launch", "impact")):
            items = list(perceptual[group].items())
            distances = []
            for index, (left_id, left_signatures) in enumerate(items):
                for right_id, right_signatures in items[index + 1 :]:
                    distances.append(((left_signatures[phase_index] ^ right_signatures[phase_index]).bit_count(), left_id, right_id))
            distances.sort()
            within_min[group][phase] = distances[0][0]
            within_pairs[group][phase] = {"left": distances[0][1], "right": distances[0][2]}
            if distances[0][0] < 96:
                failures.append(f"within-{group}-{phase}-too-similar:{distances[0]}")

    cross_min = {}
    cross_pairs = {}
    for phase_index, phase in enumerate(("launch", "impact")):
        distances = []
        for card_id, card_signatures in perceptual["cards"].items():
            for enemy_id, enemy_signatures in perceptual["enemies"].items():
                distances.append(((card_signatures[phase_index] ^ enemy_signatures[phase_index]).bit_count(), card_id, enemy_id))
        distances.sort()
        cross_min[phase] = distances[0][0]
        cross_pairs[phase] = {"card": distances[0][1], "enemy": distances[0][2]}
        if distances[0][0] < 64:
            failures.append(f"cross-domain-{phase}-too-similar:{distances[0]}")

    checks = {
        "skillCount": len(manifest["cards"]) + len(manifest["enemies"]),
        "assetCount": len(hashes),
        "uniqueHashes": len(set(hashes)),
        "uniquePerceptualSignatures": len(set(visual_signatures)),
        "uniqueRecipeIds": len(set(recipe_ids)),
        "uniqueSequenceIds": len(set(sequence_ids)),
        "uniquePhaseKeys": len(set(phase_keys)),
        "uniqueChoreographies": len(set(choreography_signatures)),
        "minimumWithinDomainPerceptualDistance": within_min,
        "closestWithinDomainPairs": within_pairs,
        "minimumCrossDomainPerceptualDistance": cross_min,
        "closestCrossDomainPairs": cross_pairs,
    }
    expected = {"skillCount": 306, "assetCount": 612, "uniqueHashes": 612, "uniquePerceptualSignatures": 612, "uniqueRecipeIds": 612, "uniqueSequenceIds": 306, "uniquePhaseKeys": 1530, "uniqueChoreographies": 306}
    for key, value in expected.items():
        if checks[key] != value:
            failures.append(f"{key}:{checks[key]}!={value}")
    report = {"result": "PASS" if not failures else "FAIL", "version": manifest.get("version"), "checks": checks, "failures": failures, "records": rows}
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"result": report["result"], **checks, "failureCount": len(failures)}, ensure_ascii=False))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
