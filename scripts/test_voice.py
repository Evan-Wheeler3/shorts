"""One-sentence Chatterbox test using voice/reference.wav -> voice/test_clone.wav"""
import sys, json, time
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "shared" / "audio"))
import tts_chatterbox as tc

ref = ROOT / "voice" / "reference.wav"
if not ref.exists():
    sys.exit("voice/reference.wav is missing - see voice/README.md")
cfg = json.loads((ROOT / "videos" / "alcatraz" / "script.json").read_text())["voice"]["chatterbox"]
t0 = time.time(); model = tc.load_model()
d = tc.speak(model, sys.argv[1], ref, cfg, cfg["seed_base"], ROOT / "voice" / "test_clone.wav")
print(f"wrote voice/test_clone.wav ({d:.1f}s of speech in {time.time()-t0:.0f}s incl. model load)")
