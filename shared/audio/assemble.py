"""Concatenate per-shot wavs into videos/<id>/voice/narration.wav (-14 LUFS, 48 kHz mono)."""
import sys
import numpy as np, soundfile as sf
from common import *

def trim(x, sr, thresh_db=-45, pad=0.03):
    win = int(sr * 0.01)
    n = len(x) // win
    rms = np.sqrt((x[:n * win].reshape(n, win) ** 2).mean(axis=1) + 1e-12)
    idx = np.where(rms > db(thresh_db))[0]
    if not len(idx):
        return x
    a = max(0, idx[0] * win - int(pad * sr)); b = min(len(x), (idx[-1] + 1) * win + int(pad * sr))
    y = x[a:b].copy()
    f = int(0.008 * sr)
    y[:f] *= np.linspace(0, 1, f); y[-f:] *= np.linspace(1, 0, f)
    return y

def limit(x, ceil, sr=SR):
    """Look-ahead peak limiter (5 ms attack window, smoothed gain)."""
    from scipy.ndimage import maximum_filter1d, uniform_filter1d
    w = int(sr * 0.005) | 1
    env = maximum_filter1d(np.abs(x), size=w)
    g = uniform_filter1d(np.minimum(1.0, ceil / np.maximum(env, 1e-9)), size=w)
    return (x * g).astype("float32")

def main(vid):
    s = load_script(vid); v = s["voice"]
    src = build_dir(vid) / "voice"
    parts = [np.zeros(int(0.25 * SR), "float32")]
    for shot in s["shots"]:
        x = trim(read_mono(src / f"shot_{shot['id']:02d}.wav"), SR)
        parts.append(x)
        ms = v.get("pause_after_shot_ms", {}).get(str(shot["id"]), v["pause_ms"])
        parts.append(np.zeros(int(ms / 1000 * SR), "float32"))
    y = np.concatenate(parts[:-1])
    for _ in range(4):  # loudness-normalise, limit peaks to -1.5 dBFS, repeat until both hold
        y = limit(y * db(-14.0 - lufs(y)), db(-1.5))
    out = video_dir(vid) / "voice"; out.mkdir(exist_ok=True)
    sf.write(str(out / "narration.wav"), y, SR, subtype="PCM_16")
    engine = (src / "ENGINE").read_text().strip()
    (out / "NARRATION_SOURCE.txt").write_text(engine + "\n")
    print(f"narration.wav: {len(y)/SR:.2f}s, {lufs(y):.1f} LUFS, peak {20*np.log10(np.abs(y).max()):.1f} dBFS [{engine}]")

if __name__ == "__main__":
    main(sys.argv[1])
