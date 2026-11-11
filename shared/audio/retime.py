"""Retime every shot to the narration. -> output/shotlist.retimed.json
Shot boundaries sit just before each shot's first word; cues resolve to seconds."""
import sys, json
from common import *

def main(vid):
    s = load_script(vid); fps = s["fps"]
    W = json.loads((build_dir(vid) / "words.json").read_text())
    words = W["words"]
    shots = s["shots"]
    by = {sh["id"]: [w for w in words if w["shot"] == sh["id"]] for sh in shots}
    total = W["duration"] + s.get("tail_seconds", 1.0)
    total_frames = int(round(total * fps))
    starts = []
    for i, sh in enumerate(shots):
        if i == 0:
            starts.append(0); continue
        prev_end = by[shots[i - 1]["id"]][-1]["end"]; first = by[sh["id"]][0]["start"]
        t = max(first - 0.18, (prev_end + first) / 2 if first - prev_end < 0.5 else first - 0.18)
        starts.append(int(round(t * fps)))
    out = []
    for i, sh in enumerate(shots):
        f0 = starts[i]; f1 = starts[i + 1] if i + 1 < len(shots) else total_frames
        t0, t1 = f0 / fps, f1 / fps
        ws = by[sh["id"]]
        cues = {"start": 0.0, "end": round(t1 - t0, 3)}
        for name, c in sh.get("cues", {}).items():
            if "word" in c:
                hits = [w for w in ws if w["norm"] == norm_word(c["word"])]
                if not hits:
                    sys.exit(f"shot {sh['id']} cue '{name}': word '{c['word']}' not in narration")
                nth = c.get("nth", 1)
                w = hits[nth - 1] if nth > 0 else hits[nth]
                t = w["start"] - t0
            else:
                t = c["frac"] * (t1 - t0)
            cues[name] = round(min(max(t + c.get("offset", 0.0), 0.0), t1 - t0), 3)
        sfx = []
        for e in sh.get("sfx", []):
            a = t0 + cues[e["at"]] + e.get("offset", 0.0)
            d = e.get("dur")
            if "until" in e:
                d = t0 + cues[e["until"]] - a
            sfx.append({"name": e["name"], "t": round(a, 3), "dur": None if d is None else round(d, 3),
                        "gain": e.get("gain", -12)})
        out.append({"id": sh["id"], "name": sh["name"], "step": sh.get("step"),
                    "start": round(t0, 3), "end": round(t1, 3), "duration": round(t1 - t0, 3),
                    "start_frame": f0, "frames": f1 - f0, "target": sh.get("target"),
                    "narration": sh["narration"], "visual": sh.get("visual"), "cues": cues, "sfx": sfx,
                    "words": [{"text": w["text"], "start": round(w["start"] - t0, 3), "end": round(w["end"] - t0, 3)} for w in ws]})
        print(f"shot {sh['id']:2d} {sh['name']:<10} {t0:7.2f} -> {t1:7.2f}  ({t1-t0:5.2f}s, target {sh.get('target')})")
    th = s.get("thumbnail", {"shot": 1, "cue": "start", "offset": 0})
    ts = next(o for o in out if o["id"] == th["shot"])
    thumb = ts["start_frame"] + int(round((ts["cues"][th.get("cue", "start")] + th.get("offset", 0)) * fps))
    res = {"id": s["id"], "thumbnail_frame": min(thumb, total_frames - 1), "title": s["title"], "fps": fps, "width": s["width"], "height": s["height"],
           "duration": round(total_frames / fps, 3), "frames": total_frames,
           "narration_duration": W["duration"], "shots": out}
    od = video_dir(vid) / "output"; od.mkdir(exist_ok=True)
    (od / "shotlist.retimed.json").write_text(json.dumps(res, indent=1))
    print(f"total {res['duration']:.2f}s ({total_frames} frames)")
    if res["duration"] > 180:
        sys.exit("ERROR: video would exceed the 3:00 ceiling")

if __name__ == "__main__":
    main(sys.argv[1])
