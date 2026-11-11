"""Mix narration + synthesised music + cued SFX -> build/mix.wav (48 kHz stereo).
Narration stays at about -14 LUFS; music is side-chain ducked to sit ~14 dB under the voice."""
import sys, json
import numpy as np, soundfile as sf
from scipy.ndimage import maximum_filter1d, uniform_filter1d
from common import *
import sfx, music

VOICE_LUFS, MUSIC_UNDER_VOICE, MUSIC_OPEN, SFX_TRIM = -14.0, 14.0, 7.0, -4.0   # dB below voice while speaking / in gaps

def limit(x, ceil):
    w = int(SR * 0.005) | 1
    env = maximum_filter1d(np.abs(x).max(axis=1), size=w)
    g = uniform_filter1d(np.minimum(1.0, ceil / np.maximum(env, 1e-9)), size=w)
    return x * g[:, None]

def main(vid):
    L = json.loads((video_dir(vid) / "output" / "shotlist.retimed.json").read_text())
    n = int(L["duration"] * SR)
    voice = read_mono(video_dir(vid) / "voice" / "narration.wav")[:n]
    voice = np.pad(voice, (0, n - len(voice)))
    voice *= db(VOICE_LUFS - lufs(np.stack([voice, voice], 1)))   # loudness as heard in the stereo programme
    # voice activity envelope -> duck curve (fast attack, slow release)
    act = uniform_filter1d((maximum_filter1d(np.abs(voice), int(0.35 * SR)) > db(-42)).astype("float64"), int(0.25 * SR))
    mus = music.make(L["duration"], L["shots"], L.get("music") or {})
    mus *= db((VOICE_LUFS - MUSIC_OPEN) - lufs(mus))
    duck = db(-(MUSIC_UNDER_VOICE - MUSIC_OPEN) * act)
    mus = mus * duck[:, None]
    fx = np.zeros(n + SR * 6, "float32")
    for s in L["shots"]:
        for e in s["sfx"]:
            x = sfx.render(e["name"], e["dur"]) * db(e["gain"])
            i = max(0, int(e["t"] * SR)); x = x[: len(fx) - i]; fx[i:i + len(x)] += x
    fx = fx[:n]
    tail = np.clip((L["duration"] - np.arange(n) / SR) / 0.6, 0, 1)      # everything is silent by the last frame
    fx = fx * db(SFX_TRIM)
    mix = (np.stack([voice, voice], 1) + mus + np.stack([fx, fx], 1)) * tail[:, None]
    mix = limit(mix, db(-1.5))
    b = build_dir(vid)
    sf.write(str(b / "mix.wav"), mix, SR, subtype="PCM_16")
    sf.write(str(b / "music.wav"), mus, SR, subtype="PCM_16"); sf.write(str(b / "sfx.wav"), fx, SR, subtype="PCM_16")
    speaking = act > 0.9
    st = np.stack([voice, voice], 1)
    under = lufs(st[speaking]) - lufs(mus[speaking])
    rep = {"voice_lufs": round(float(lufs(st)), 2), "music_db_under_voice_while_speaking": round(float(under), 1), "sfx_lufs": round(float(lufs(np.stack([fx, fx], 1))), 1),
           "mix_lufs": round(float(lufs(mix)), 2), "mix_peak_dbfs": round(float(20 * np.log10(np.abs(mix).max())), 2), "sfx_events": sum(len(s["sfx"]) for s in L["shots"])}
    (b / "audio_report.json").write_text(json.dumps(rep, indent=1)); print("audio:", rep)

if __name__ == "__main__":
    main(sys.argv[1])
