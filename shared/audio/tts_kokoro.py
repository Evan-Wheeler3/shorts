"""PLACEHOLDER voice: Kokoro (Apache 2.0) via kokoro-onnx, CPU. One wav per shot."""
import sys
import soundfile as sf
from common import load_script, build_dir

def main(vid):
    from huggingface_hub import hf_hub_download
    from kokoro_onnx import Kokoro
    s = load_script(vid)
    cfg = s["voice"]["kokoro"]
    k = Kokoro(hf_hub_download("fastrtc/kokoro-onnx", "kokoro-v1.0.onnx"),
               hf_hub_download("fastrtc/kokoro-onnx", "voices-v1.0.bin"))
    out = build_dir(vid) / "voice"
    out.mkdir(exist_ok=True)
    for shot in s["shots"]:
        text = shot.get("tts_text", shot["narration"])
        audio, sr = k.create(text, voice=cfg["voice"], speed=cfg["speed"], lang="en-us")
        p = out / f"shot_{shot['id']:02d}.wav"
        sf.write(str(p), audio, sr)
        print(f"kokoro shot {shot['id']:2d}: {len(audio)/sr:5.2f}s")
    (out / "ENGINE").write_text("kokoro (placeholder voice)\n")

if __name__ == "__main__":
    main(sys.argv[1])
