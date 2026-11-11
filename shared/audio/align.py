"""Word-level timestamps for whichever narration.wav is present.
Transcribes with faster-whisper (word timestamps), then maps the result onto the
exact script words, so captions always show the script text. -> build/words.json"""
import sys, json, difflib
from common import *

def main(vid):
    from faster_whisper import WhisperModel
    s = load_script(vid)
    wav = video_dir(vid) / "voice" / "narration.wav"
    script = []
    for shot in s["shots"]:
        for w in shot["narration"].split():
            script.append({"shot": shot["id"], "text": w, "norm": norm_word(w)})
    model = WhisperModel("small.en", device="cpu", compute_type="int8")
    segs, info = model.transcribe(read_mono(wav, 16000), word_timestamps=True, beam_size=5,
                                  condition_on_previous_text=False)
    heard = []
    for seg in segs:
        for w in seg.words:
            n = norm_word(w.word)
            if n:
                heard.append({"norm": n, "start": float(w.start), "end": float(w.end)})
    dur = info.duration
    sm = difflib.SequenceMatcher(None, [x["norm"] for x in script], [h["norm"] for h in heard], autojunk=False)
    matched = 0
    for a, b, n in sm.get_matching_blocks():
        for k in range(n):
            script[a + k]["start"] = heard[b + k]["start"]; script[a + k]["end"] = heard[b + k]["end"]
            matched += 1
    # fill unmatched runs by spreading the gap between neighbours by word length
    i = 0
    while i < len(script):
        if "start" in script[i]:
            i += 1; continue
        j = i
        while j < len(script) and "start" not in script[j]:
            j += 1
        t0 = script[i - 1]["end"] if i > 0 else 0.0
        t1 = script[j]["start"] if j < len(script) else dur
        # use any heard words inside the gap to tighten bounds
        inside = [h for h in heard if h["start"] >= t0 - 0.01 and h["end"] <= t1 + 0.01]
        if inside:
            t0, t1 = max(t0, inside[0]["start"]), min(t1, inside[-1]["end"])
        lens = [len(script[k]["norm"]) + 1 for k in range(i, j)]
        tot = sum(lens); acc = 0
        for k in range(i, j):
            script[k]["start"] = t0 + (t1 - t0) * acc / tot
            acc += lens[k - i]
            script[k]["end"] = t0 + (t1 - t0) * acc / tot
        i = j
    prev = 0.0
    for w in script:  # monotonic, non-degenerate
        w["start"] = max(w["start"], prev); w["end"] = max(w["end"], w["start"] + 0.05); prev = w["start"]
        w["start"] = round(w["start"], 3); w["end"] = round(w["end"], 3)
    out = {"duration": round(dur, 3), "matched": matched, "total": len(script), "words": script,
           "heard": " ".join(h["norm"] for h in heard)}
    (build_dir(vid) / "words.json").write_text(json.dumps(out, indent=1))
    print(f"aligned {matched}/{len(script)} script words directly; narration {dur:.2f}s")
    if matched < 0.8 * len(script):
        print("WARNING: low match rate - is narration.wav reading this script?")

if __name__ == "__main__":
    main(sys.argv[1])
