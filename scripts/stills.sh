#!/usr/bin/env bash
# QA contact sheets: frames near the start, middle and end of every shot (plus extra times).
#   scripts/stills.sh <video> [scale] [extra shot-relative fractions...]
set -euo pipefail
cd "$(dirname "$0")/.."
VID=$1; SCALE=${2:-0.5}
OUT=videos/$VID/build/stills; rm -rf "$OUT"; mkdir -p "$OUT"
FR=$(.venv/bin/python - "$VID" <<'PY'
import json,sys
d=json.load(open(f"videos/{sys.argv[1]}/output/shotlist.retimed.json"))
fs=[]
for s in d["shots"]:
    for u in (0.06,0.28,0.5,0.72,0.95):
        fs.append(s["start_frame"]+int(u*(s["frames"]-1)))
print(",".join(map(str,fs)))
PY
)
node shared/renderer/render.mjs "$VID" --stills "$FR" --stills-dir "$OUT" --scale "$SCALE" ${STILL_ARGS:-}
i=0
for f in $(ls "$OUT"/f*.jpg); do echo "file '$PWD/$f'"; done > "$OUT/list.txt"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$OUT/list.txt" -vf "scale=324:576,tile=5x2" "$OUT/sheet_%02d.jpg"
echo "sheets -> $OUT/sheet_*.jpg"
