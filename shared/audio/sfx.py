"""Procedural sound effects (numpy only, deterministic). Each returns mono float32 at 48 kHz,
peak-normalised; the mixer applies the per-cue gain from the shot list."""
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
SR = 48000
SCRAPE = 0.5          # must match SCRAPE in the scene code (spoon stroke rhythm)

def rng(seed): return np.random.default_rng(seed)
def T(d): return np.arange(int(d * SR)) / SR
def bp(x, lo, hi, order=2): return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)
def lp(x, f, order=2): return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x)
def hp(x, f, order=2): return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), x)
def env(n, a=0.01, r=0.05):
    e = np.ones(n); na, nr = min(n, int(a * SR)), min(n, int(r * SR))
    if na: e[:na] = np.linspace(0, 1, na)
    if nr: e[-nr:] *= np.linspace(1, 0, nr)
    return e
def norm(x): return (x / (np.abs(x).max() + 1e-9)).astype("float32")
def reverb(x, decay=1.2, mix=0.3, seed=7, dark=3000):
    n = int(decay * SR); ir = rng(seed).standard_normal(n) * np.exp(-np.arange(n) / (decay * SR / 5)); ir = lp(ir, dark)
    wet = fftconvolve(np.concatenate([x, np.zeros(n)]), ir)[: len(x) + n]; wet /= np.abs(wet).max() + 1e-9
    dry = np.concatenate([x, np.zeros(n)])
    return dry * (1 - mix) + wet * mix * np.abs(x).max()
def place(out, x, t):
    i = int(t * SR); x = x[: max(0, len(out) - i)]; out[i:i + len(x)] += x

def pop(d=None, seed=0):
    t = T(0.14); f = 320 + 520 * (t / 0.14) ** 0.5
    return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 28) + 0.15 * hp(rng(1).standard_normal(len(t)), 4000) * np.exp(-t * 90))
def snap(d=None, seed=0):
    t = T(0.22); return norm(hp(rng(2).standard_normal(len(t)), 1500) * np.exp(-t * 120) + 0.9 * np.sin(2 * np.pi * 150 * t) * np.exp(-t * 35))
def crack(d=None, seed=0):
    t = T(0.6); x = np.zeros(len(t)); r = rng(3)
    for k in range(7):
        s = T(0.08); place(x, bp(r.standard_normal(len(s)), 900, 5000) * np.exp(-s * 70) * r.uniform(0.4, 1), 0.02 + k * 0.06 * r.uniform(0.6, 1.3))
    return norm(x + 0.5 * np.sin(2 * np.pi * 85 * t) * np.exp(-t * 18))
def _scrape(d, lo, hi, seed, res=0.0):
    x = np.zeros(int(d * SR)); r = rng(seed); k = 0
    while k * SCRAPE < d:
        s = T(0.27); n = bp(r.standard_normal(len(s)), lo * r.uniform(0.9, 1.1), hi) * np.sin(np.pi * s / 0.27) ** 0.7
        n *= 1 + 0.5 * np.sin(2 * np.pi * 38 * s)
        if res: n += res * np.sin(2 * np.pi * 2350 * s + 3 * np.sin(2 * np.pi * 31 * s)) * np.sin(np.pi * s / 0.27) * 0.25
        place(x, n * r.uniform(0.75, 1), k * SCRAPE); k += 1
    return norm(x * env(len(x), 0.005, 0.05))
def scrape(d=3, seed=0): return _scrape(d, 1800, 5200, 11)
def scrape_loud(d=3, seed=0): return norm(reverb(_scrape(d, 1200, 7000, 12, res=1.0), 0.6, 0.25))
def _drill(d, seed):
    t = T(d); f = 96 * (1 - 0.35 * np.exp(-t * 6)) * (1 + 0.01 * np.sin(2 * np.pi * 7 * t)); ph = 2 * np.pi * np.cumsum(f) / SR
    x = sum(np.sin(ph * k) / k for k in range(1, 14)) + 0.7 * bp(rng(seed).standard_normal(len(t)), 600, 3500) * (1 + 0.6 * np.sin(ph))
    return x * env(len(x), 0.12, 0.15)
def drill(d=2, seed=0): return norm(bp(_drill(d, 21), 150, 4200))
def drill_muffled(d=2, seed=0): return norm(lp(_drill(d, 22), 330, 4))
NOTE = lambda n: 440.0 * 2 ** ((n - 69) / 12)
def accordion(d=5, seed=0):
    # an original little minor-key waltz (not a known tune)
    mel = [(62, 2), (65, 1), (69, 2), (67, 1), (65, 1), (64, 1), (62, 1), (57, 3), (58, 2), (62, 1), (65, 2), (64, 1), (61, 2), (64, 1), (62, 3)]
    beat = 0.3; x = np.zeros(int(d * SR) + SR); tt = 0.0; i = 0
    def reed(f, dur):
        t = T(dur); v = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t)
        s = sum(np.sin(2 * np.pi * f * k * t * v) / k ** 1.1 for k in range(1, 9, 1)) + 0.5 * sum(np.sin(2 * np.pi * f * 1.006 * k * t) / k for k in (1, 2, 3))
        return s * env(len(t), 0.04, 0.07) * (1 + 0.12 * np.sin(2 * np.pi * 5.2 * t))
    while tt < d:
        n, b = mel[i % len(mel)]; place(x, reed(NOTE(n), b * beat * 0.97), tt)
        if i % 3 == 0: place(x, 0.35 * (reed(NOTE(50), b * beat * 2) + reed(NOTE(57), b * beat * 2)), tt)
        tt += b * beat; i += 1
    x = lp(x[: int(d * SR)], 3200); return norm(reverb(x * env(len(x), 0.05, 0.4), 0.7, 0.2))
def rustle(d=1.5, seed=0):
    x = np.zeros(int(d * SR)); r = rng(31 + int(d * 10)); t0 = 0
    while t0 < d - 0.05:
        L = r.uniform(0.04, 0.16); s = T(L); place(x, bp(r.standard_normal(len(s)), 700, 4500) * np.sin(np.pi * s / L) ** 2 * r.uniform(0.3, 1), t0); t0 += r.uniform(0.05, 0.2)
    return norm(x)
def brush(d=0.8, seed=0):
    t = T(d); return norm(bp(rng(33).standard_normal(len(t)), 900, 2800) * (0.4 + 0.6 * np.abs(np.sin(np.pi * 3 * t / d))) * env(len(t), 0.05, 0.1))
def footsteps(d=3, seed=0):
    x = np.zeros(int(d * SR)); r = rng(35); k = 0
    while 0.1 + k * 0.52 < d - 0.2:
        s = T(0.2); place(x, (np.sin(2 * np.pi * 95 * s) * np.exp(-s * 40) + 0.4 * bp(r.standard_normal(len(s)), 800, 2500) * np.exp(-s * 90)) * r.uniform(0.8, 1), 0.1 + k * 0.52); k += 1
    return norm(reverb(x, 0.8, 0.25))
def tension(d=3, seed=0):
    t = T(d); e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.5
    return norm((np.sin(2 * np.pi * 55 * t) + np.sin(2 * np.pi * 58.2 * t) + 0.25 * np.sin(2 * np.pi * 932 * t) * (0.5 + 0.5 * np.sin(2 * np.pi * 6 * t))) * e)
def water(d=4, seed=0):
    t = T(d); r = rng(41 + int(d * 7)); n = lp(r.standard_normal(len(t)), 700) * (0.55 + 0.45 * np.sin(2 * np.pi * 0.31 * t + 1) * np.sin(2 * np.pi * 0.17 * t))
    k = 0.6
    while k < d - 0.6:
        s = T(0.5); place(n, 0.5 * bp(r.standard_normal(len(s)), 500, 2600) * np.sin(np.pi * s / 0.5) ** 3 * r.uniform(0.4, 1), k); k += r.uniform(0.9, 1.8)
    return norm(n * env(len(n), 0.5, 0.6))
def squeak(d=None, seed=0):
    t = T(0.34); f = 950 + 650 * np.sin(np.pi * t / 0.34) + 60 * np.sin(2 * np.pi * 45 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR; return norm((np.sin(ph) + 0.4 * np.sin(2 * ph) + 0.2 * np.sin(3 * ph)) * np.sin(np.pi * t / 0.34) ** 0.6)
def steam(d=3, seed=0):
    t = T(d); return norm(hp(rng(43).standard_normal(len(t)), 3500) * (0.8 + 0.2 * np.sin(2 * np.pi * 3 * t)) * env(len(t), 0.25, 0.5))
def strain(d=2.5, seed=0):
    x = np.zeros(int(d * SR)); r = rng(45)
    for k in range(int(d / 0.55)):
        s = T(0.4); f = 180 + 60 * r.uniform() + 30 * np.sin(2 * np.pi * 9 * s)
        place(x, np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.sin(np.pi * s / 0.4) ** 2 * r.uniform(0.5, 1), k * 0.55 + r.uniform(0, 0.1))
    return norm(lp(bp(x, 150, 900), 700))
def pipe_clang(d=None, seed=0):
    t = T(1.3); x = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * dc) for f, a, dc in [(412, 1, 4), (1130, 0.6, 6), (1873, 0.45, 8), (2750, 0.3, 11), (3620, 0.2, 14)])
    return norm(reverb(x + 0.3 * rng(47).standard_normal(len(t)) * np.exp(-t * 200), 1.4, 0.35))
def fan_creak(d=None, seed=0):
    t = T(1.5); f = 640 - 190 * t / 1.5 + 25 * np.sin(2 * np.pi * 11 * t); ph = 2 * np.pi * np.cumsum(f) / SR
    return norm(reverb((np.sin(ph) + 0.5 * np.sin(2.01 * ph) + 0.3 * np.sin(3.02 * ph)) * np.sin(np.pi * t / 1.5) ** 0.8 * (0.6 + 0.4 * np.sin(2 * np.pi * 4 * t)) + 0.2 * lp(rng(48).standard_normal(len(t)), 200), 0.9, 0.25))
def fence_rattle(d=1.6, seed=0):
    x = np.zeros(int(d * SR)); r = rng(49)
    for k in range(int(d * 16)):
        s = T(0.09); f = r.uniform(2400, 5600); place(x, (np.sin(2 * np.pi * f * s) + 0.6 * np.sin(2 * np.pi * f * 1.52 * s)) * np.exp(-s * r.uniform(40, 90)) * r.uniform(0.2, 1), r.uniform(0, d - 0.1))
    return norm(reverb(x, 0.6, 0.2))
def inflate(d=1.4, seed=0):
    t = T(d); n = rng(51).standard_normal(len(t)); out = np.zeros(len(t))
    for k, (lo, hi) in enumerate([(300, 700), (600, 1300), (1100, 2400)]):
        out += bp(n, lo, hi) * np.clip(1 - np.abs(t / d * 3 - k - 0.5) / 1.2, 0, 1)
    return norm(out * env(len(t), 0.1, 0.25))
def paddle(d=5, seed=0):
    x = np.zeros(int(d * SR)); r = rng(53); k = 0.0
    while k < d - 0.7:
        s = T(0.6); place(x, bp(r.standard_normal(len(s)), 350, 2800) * (s / 0.6) ** 0.3 * np.exp(-s * 7) * r.uniform(0.7, 1), k); k += 1.5
    return norm(x)
def foghorn(d=None, seed=0):
    x = np.zeros(int(4.6 * SR))
    for f, st, L in [(116.5, 0, 1.7), (98, 1.9, 2.3)]:
        t = T(L); place(x, lp(sum(np.sin(2 * np.pi * f * k * t) / k for k in range(1, 9)), 420, 4) * env(len(t), 0.25, 0.5), st)
    return norm(reverb(x, 2.5, 0.5, dark=900))
def thud_roll(d=None, seed=0):
    x = np.zeros(int(2.6 * SR)); r = rng(57); tt = 0.0; a = 1.0
    for gap in [0.42, 0.3, 0.2, 0.13, 0.09]:
        s = T(0.25); place(x, a * (np.sin(2 * np.pi * (78 + 20 * a) * s) * np.exp(-s * 22) + 0.35 * bp(r.standard_normal(len(s)), 300, 1800) * np.exp(-s * 60)), tt); tt += gap; a *= 0.62
    s = T(1.4); place(x, 0.3 * lp(r.standard_normal(len(s)), 240) * (0.6 + 0.4 * np.sin(2 * np.pi * 11 * s * (1 - 0.3 * s))) * np.exp(-s * 2.2), 0.75)
    return norm(reverb(x, 0.7, 0.2))
def boat(d=3, seed=0):
    t = T(d); x = lp(np.sign(np.sin(2 * np.pi * 37 * t)) * (0.6 + 0.4 * np.sin(2 * np.pi * 74 * t)) + 0.4 * rng(59).standard_normal(len(t)), 260, 3)
    return norm(x * env(len(t), 0.4, 0.5))
def sweep(d=2.4, seed=0):
    t = T(d); f = 500 + 900 * (t / d); return norm((np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.4 + bp(rng(61).standard_normal(len(t)), 800, 2200) * 0.3) * np.sin(np.pi * t / d) ** 2)
def gull(d=None, seed=0):
    x = np.zeros(int(1.6 * SR))
    for k, st in enumerate([0, 0.42, 0.8]):
        s = T(0.3); f = 2300 - 700 * (s / 0.3) + 120 * np.sin(2 * np.pi * 14 * s); ph = 2 * np.pi * np.cumsum(f) / SR
        place(x, (np.sin(ph) + 0.5 * np.sin(2 * ph)) * np.sin(np.pi * s / 0.3) * (1 - 0.2 * k), st)
    return norm(reverb(x, 1.5, 0.45))

def render(name, dur=None):
    fn = globals()[name]
    return fn(dur) if dur else fn()
