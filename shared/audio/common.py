"""Shared helpers for the audio pipeline."""
import json, re, os, sys
from pathlib import Path
import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[2]
SR = 48000
os.environ.setdefault("HF_HOME", str(ROOT / ".cache" / "hf"))


def video_dir(vid):
    d = ROOT / "videos" / vid
    if not d.exists():
        sys.exit(f"no such video folder: {d}")
    return d


def load_script(vid):
    return json.loads((video_dir(vid) / "script.json").read_text())


def build_dir(vid):
    d = video_dir(vid) / "build"
    d.mkdir(exist_ok=True)
    return d


def norm_word(w):
    return re.sub(r"[^a-z0-9]", "", w.lower().replace("°", ""))


def read_mono(path, sr=SR):
    x, r = sf.read(str(path), dtype="float32", always_2d=True)
    x = x.mean(axis=1)
    if r != sr:
        from scipy.signal import resample_poly
        from math import gcd
        g = gcd(sr, r)
        x = resample_poly(x, sr // g, r // g).astype("float32")
    return x


def db(x):
    return 10 ** (x / 20.0)


def lufs(x, sr=SR):
    import pyloudnorm as pyln
    return pyln.Meter(sr).integrated_loudness(x.astype("float64"))
