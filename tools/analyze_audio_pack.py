from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from scipy.io import wavfile


ROOT = Path(__file__).resolve().parents[1] / "sounds" / "roguelike_rpg_audio_pack"


def analyze(path: Path) -> dict[str, object]:
    rate, data = wavfile.read(path, mmap=True)
    channels = 1 if data.ndim == 1 else data.shape[1]
    sample_count = data.shape[0]
    step = max(1, rate // 4000)
    mono = np.asarray(data[::step], dtype=np.float64)
    if mono.ndim > 1:
        mono = mono.mean(axis=1)
    if np.issubdtype(data.dtype, np.integer):
        mono /= max(abs(np.iinfo(data.dtype).min), np.iinfo(data.dtype).max)
    peak = float(np.max(np.abs(mono))) if mono.size else 0.0
    rms = float(np.sqrt(np.mean(mono * mono))) if mono.size else 0.0
    zcr = float(np.mean(np.signbit(mono[1:]) != np.signbit(mono[:-1]))) if mono.size > 1 else 0.0
    window = mono[: min(mono.size, 4000 * 60)]
    spectrum = np.abs(np.fft.rfft(window * np.hanning(window.size))) if window.size else np.array([])
    freqs = np.fft.rfftfreq(window.size, d=step / rate) if window.size else np.array([])
    centroid = float(np.sum(freqs * spectrum) / np.sum(spectrum)) if spectrum.size and np.sum(spectrum) else 0.0
    return {
        "file": path.relative_to(ROOT).as_posix(),
        "durationSeconds": round(sample_count / rate, 2),
        "sampleRate": int(rate),
        "channels": int(channels),
        "peakDbfs": round(20 * math.log10(max(peak, 1e-12)), 2),
        "rmsDbfs": round(20 * math.log10(max(rms, 1e-12)), 2),
        "zeroCrossingRate": round(zcr, 5),
        "spectralCentroidHz": round(centroid, 1),
        "sizeMiB": round(path.stat().st_size / 1024 / 1024, 2),
    }


print(json.dumps([analyze(path) for path in sorted(ROOT.rglob("*.wav"))], ensure_ascii=False, indent=2))
