"""Synthesised score: low pulse + slow strings in D minor. Sparse and tense, builds toward the
escape night (shots flagged in the shot list by name), then thins to near silence at the end.
Entirely generated here - no samples, no existing music."""
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
SR = 48000
N = lambda n: 440.0 * 2 ** ((n - 69) / 12)
def lp(x, f, o=2): return sosfilt(butter(o, f, btype="low", fs=SR, output="sos"), x)

def pad(freqs, dur, r, cutoff=900):
    t = np.arange(int(dur * SR)) / SR; out = np.zeros((2, len(t)))
    for f in freqs:
        for k in range(4):
            det = f * (1 + (k - 1.5) * 0.0035); ph = r.uniform(0, 6.28)
            saw = 2 * ((det * t + ph) % 1) - 1
            pan = 0.2 + 0.6 * (k / 3)
            out[0] += saw * (1 - pan); out[1] += saw * pan
    out = lp(out, cutoff, 3)
    a = np.clip(t / (dur * 0.35), 0, 1) ** 1.5 * np.clip((dur - t) / (dur * 0.35), 0, 1) ** 1.5
    return out * a * (1 + 0.15 * np.sin(2 * np.pi * 0.23 * t + r.uniform(0, 6)))

def make(total, shots, cfg=None):
    """shots: [{id,start,end}] - the escape night is shots 7-8, the ending is the last shot."""
    r = np.random.default_rng(1962); n = int(total * SR); t = np.arange(n) / SR
    S = {s["id"]: s for s in shots}
    cfg = cfg or {}
    b, p, rel = cfg.get("build_shot", 7), cfg.get("peak_shot", 8), cfg.get("release_shot", 9)
    night0 = S[b]["start"] if b in S else total * 0.6
    peak = S[p]["start"] + 0.6 * (S[p]["end"] - S[p]["start"]) if p in S else total * 0.8
    dawn = S[rel]["start"] if rel in S else total * 0.85
    peak = min(peak, dawn - 0.5); night0 = min(night0, peak - 1.0)
    end0 = shots[-1]["start"]
    # intensity curve
    I = np.interp(t, [0, 2, night0, peak, dawn, dawn + 3, end0, total - 3, total], [0.25, 0.55, 0.62, 1.0, 0.8, 0.42, 0.3, 0.05, 0.0])
    out = np.zeros((2, n))
    chords = cfg.get("chords") or [[50, 57, 62, 65], [46, 53, 58, 62], [43, 50, 55, 58], [45, 52, 57, 61]]   # default Dm, Bb, Gm, A
    pulse_hz, base_step = cfg.get("pulse_hz", 73.4), cfg.get("pulse_step", 1.0)
    bar = 8.0; k = 0
    while k * bar < total:
        seg = pad([N(x) for x in chords[k % 4]], bar * 1.5, r)
        i = int(k * bar * SR); m = min(seg.shape[1], n - i); out[:, i:i + m] += 0.5 * seg[:, :m]; k += 1
    # high string line that only enters for the escape night
    hi_env = np.interp(t, [0, night0 - 2, night0 + 4, peak, dawn + 1, end0 + 2, total - 2, total], [0, 0, 0.5, 1, 0.3, 0.22, 0.12, 0])
    for nn, pan in [(74, 0.35), (81, 0.65)]:
        f = N(nn); vib = 1 + 0.003 * np.sin(2 * np.pi * 4.6 * t)
        s = lp(sum(2 * ((f * (1 + d) * t * vib) % 1) - 1 for d in (-0.003, 0, 0.004)), 2200)
        out[0] += 0.09 * s * hi_env * (1 - pan); out[1] += 0.09 * s * hi_env * pan
    out *= (0.35 + 0.65 * I)
    # low pulse: a heartbeat on D that doubles up during the escape
    pulse = np.zeros(n); tt = 0.5
    while tt < total - 4:
        inten = np.interp(tt, t[::SR], I[::SR]); step = base_step * (0.5 if (night0 + 1 < tt < dawn) else 1.0)
        d = np.arange(int(0.5 * SR)) / SR
        hit = np.sin(2 * np.pi * (pulse_hz * d + 9 * (1 - np.exp(-d * 30)) / 30)) * np.exp(-d * 9)
        accent = 1.0 if abs((tt * 2) % 2 - 1) < 0.01 or step >= 1.0 else 0.55
        i = int(tt * SR); pulse[i:i + len(hit)] += hit[: n - i] * accent * (0.25 + 0.75 * inten); tt += step
    out += 1.1 * lp(pulse, 220)[None, :]
    # shared hall
    L = int(2.6 * SR); ir = r.standard_normal((2, L)) * np.exp(-np.arange(L) / (0.5 * SR)); ir = lp(ir, 2600)
    wet = np.stack([fftconvolve(out[c], ir[c])[:n] for c in range(2)]); wet /= np.abs(wet).max() + 1e-9
    out = 0.7 * out / (np.abs(out).max() + 1e-9) + 0.45 * wet
    fade = np.clip(t / 1.5, 0, 1) * np.clip((total - t) / 2.5, 0, 1)
    return (out * fade).T.astype("float32")
