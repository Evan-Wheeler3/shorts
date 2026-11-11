"""Cloned voice: Chatterbox (Resemble AI, MIT), zero-shot from voice/reference.wav.
Run with the .venv-chatterbox interpreter (see scripts/setup_voice.sh).
  tts_chatterbox.py <video-id> [shot ids to regenerate ...] [--seed-bump N]
One wav per shot, fixed seed per shot (seed_base + shot id [+ bump]), constant settings."""
import sys, json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def device():
    import torch
    if torch.backends.mps.is_available():
        return "mps"
    return "cuda" if torch.cuda.is_available() else "cpu"

def load_model():
    import torch
    from chatterbox.tts import ChatterboxTTS
    dev = device()
    print("chatterbox device:", dev)
    if dev != "cuda":  # checkpoints are saved from CUDA; remap on Mac/CPU
        _load = torch.load
        torch.load = lambda *a, **k: _load(*a, **{**k, "map_location": torch.device(dev)})
    return ChatterboxTTS.from_pretrained(device=dev)

def speak(model, text, ref, cfg, seed, out):
    import torch, torchaudio
    torch.manual_seed(seed)
    wav = model.generate(text, audio_prompt_path=str(ref),
                         exaggeration=cfg["exaggeration"], cfg_weight=cfg["cfg_weight"],
                         temperature=cfg.get("temperature", 0.7))
    torchaudio.save(str(out), wav.cpu(), model.sr)
    return wav.shape[-1] / model.sr

def main():
    args = [a for a in sys.argv[1:]]
    bump = 0
    if "--seed-bump" in args:
        i = args.index("--seed-bump"); bump = int(args[i + 1]); del args[i:i + 2]
    vid, only = args[0], {int(a) for a in args[1:]}
    ref = ROOT / "voice" / "reference.wav"
    if not ref.exists():
        sys.exit("voice/reference.wav is missing - see voice/README.md")
    s = json.loads((ROOT / "videos" / vid / "script.json").read_text())
    cfg = s["voice"]["chatterbox"]
    out = ROOT / "videos" / vid / "build" / "voice"
    out.mkdir(parents=True, exist_ok=True)
    model = load_model()
    for shot in s["shots"]:
        if only and shot["id"] not in only:
            continue
        seed = cfg["seed_base"] + shot["id"] + bump
        d = speak(model, shot.get("tts_text", shot["narration"]), ref, cfg, seed,
                  out / f"shot_{shot['id']:02d}.wav")
        print(f"chatterbox shot {shot['id']:2d}: {d:5.2f}s (seed {seed})")
    (out / "ENGINE").write_text("chatterbox (cloned from voice/reference.wav)\n")

if __name__ == "__main__":
    main()
