#!/usr/bin/env bash
# Render stills at "shot:seconds" or "shot:cue+offset" points and tile them.
#   scripts/at.sh <video> <scale> 3:2.5 7:wait+0.8 ...
set -euo pipefail
cd "$(dirname "$0")/.."
VID=$1; SCALE=$2; shift 2
OUT=videos/$VID/build/at; rm -rf "$OUT"; mkdir -p "$OUT"
FR=$(.venv/bin/python - "$VID" "$@" <<'PY'
import json,sys,re
d=json.load(open(f"videos/{sys.argv[1]}/output/shotlist.retimed.json"))
fs=[]
for a in sys.argv[2:]:
    sid,t=a.split(":"); s=d["shots"][int(sid)-1]
    m=re.match(r"([a-z_]+)?([+-]?[\d.]+)?$",t)
    tt=(s["cues"][m.group(1)] if m.group(1) else 0)+float(m.group(2) or 0)
    fs.append(s["start_frame"]+min(s["frames"]-1,max(0,int(round(tt*d["fps"])))))
print(",".join(map(str,fs)))
PY
)
node shared/renderer/render.mjs "$VID" --stills "$FR" --stills-dir "$OUT" --scale "$SCALE"
n=0; for f in ${FR//,/ }; do printf "file '%s/%s/f%05d.jpg'\n" "$PWD" "$OUT" "$f"; done > "$OUT/list.txt"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$OUT/list.txt" -vf "scale=324:576,tile=5x2" "$OUT/sheet_%02d.jpg"
ls "$OUT"/sheet_*.jpg
