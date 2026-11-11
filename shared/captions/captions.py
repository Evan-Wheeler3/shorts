"""Captions from word timestamps: SRT (phrases) + ASS (word-by-word, current word amber).
The ASS file is what gets burned in; it sits in the Shorts safe area
(clear of the bottom 20% and right 12% of a 1080x1920 frame)."""
import sys, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "audio"))
from common import *

AMBER = "&H5AA6F2&"   # #F2A65A in ASS BGR
WHITE = "&HF4F6F8&"
CX, CY, SIZE = 520, 1330, 112          # centre of the caption block, px
HEADER = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Montserrat Black,{SIZE},&H00F4F6F8,&H00F4F6F8,&H00140E0A,&HA0000000,0,0,0,0,100,100,1,0,1,9,4,5,110,150,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

def chunks(words, max_words, max_chars):
    out, cur = [], []
    for i, w in enumerate(words):
        cur.append(w)
        nxt = words[i + 1] if i + 1 < len(words) else None
        chars = sum(len(x["text"]) for x in cur) + len(cur) - 1
        brk = (nxt is None or w["text"][-1] in ".,:;?!" or nxt["shot"] != w["shot"]
               or nxt["start"] - w["end"] > 0.35 or len(cur) >= max_words
               or chars + 1 + len(nxt["text"]) > max_chars)
        if brk:
            out.append(cur); cur = []
    return out

def ts_ass(t):
    cs = int(round(t * 100)); return f"{cs//360000}:{cs//6000%60:02d}:{cs//100%60:02d}.{cs%100:02d}"

def ts_srt(t):
    ms = int(round(t * 1000)); return f"{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d},{ms%1000:03d}"

def main(vid):
    words = json.loads((build_dir(vid) / "words.json").read_text())["words"]
    od = video_dir(vid) / "output"; od.mkdir(exist_ok=True)
    # --- ASS: word-by-word
    cs = chunks(words, 3, 14)
    lines = []
    for ci, c in enumerate(cs):
        nxt_start = cs[ci + 1][0]["start"] if ci + 1 < len(cs) else 1e9
        hold = min(c[-1]["end"] + 0.3, nxt_start)
        for wi, w in enumerate(c):
            a = w["start"]; b = c[wi + 1]["start"] if wi + 1 < len(c) else hold
            if b - a < 0.02:
                continue
            parts = []
            for k, x in enumerate(c):
                t = x["text"].upper().replace("{", "(").replace("}", ")")
                if k == wi:
                    parts.append(f"{{\\c{AMBER}\\fscx112\\fscy112\\t(0,90,\\fscx104\\fscy104)}}{t}{{\\c{WHITE}\\fscx100\\fscy100}}")
                else:
                    parts.append(t)
            lines.append(f"Dialogue: 0,{ts_ass(a)},{ts_ass(b)},Cap,,0,0,0,,{{\\an5\\pos({CX},{CY})}}" + " ".join(parts))
    (od / "captions.ass").write_text(HEADER + "\n".join(lines) + "\n")
    # --- SRT: readable phrases
    ps = chunks(words, 8, 40)
    srt = []
    for i, c in enumerate(ps):
        end = min(c[-1]["end"] + 0.25, ps[i + 1][0]["start"] if i + 1 < len(ps) else 1e9)
        srt.append(f"{i+1}\n{ts_srt(c[0]['start'])} --> {ts_srt(end)}\n{' '.join(x['text'] for x in c)}\n")
    (od / "captions.srt").write_text("\n".join(srt))
    print(f"captions: {len(lines)} ASS events, {len(ps)} SRT cues")

if __name__ == "__main__":
    main(sys.argv[1])
