#!/usr/bin/env bash
# One-command rebuild of a video from its script:   ./build.sh <video-id> [options]
#   --revoice     regenerate narration (Chatterbox clone if voice/reference.wav + its venv exist, else Kokoro placeholder)
#   --preview     half-resolution picture (fast check)
#   --ao          add screen-space ambient occlusion (needs a real GPU; very slow in software GL)
#   --workers N   parallel render pages (default 3)
#   --shots 3,7   re-render only these shots (the rest are reused from build/shots)
#   --skip-render reuse build/picture.mp4 (e.g. after changing only audio or captions)
set -euo pipefail
cd "$(dirname "$0")"
VID=${1:?usage: ./build.sh <video-id> [--revoice] [--preview] [--ao] [--workers N] [--skip-render]}; shift
REVOICE=0; SCALE=1; AO=--no-ao; WORKERS=3; SKIP=0; SHOTS=all
while [ $# -gt 0 ]; do case $1 in
  --revoice) REVOICE=1;; --preview) SCALE=0.5;; --ao) AO=;; --workers) WORKERS=$2; shift;; --shots) SHOTS=$2; shift;; --skip-render) SKIP=1;;
  *) echo "unknown option $1"; exit 1;; esac; shift; done
V=videos/$VID; PY=.venv/bin/python; A=shared/audio
[ -x $PY ] || { echo "run scripts/setup.sh first"; exit 1; }
export HF_HOME=$PWD/.cache/hf HF_HUB_DISABLE_XET=1
mkdir -p $V/build $V/output $V/voice

echo "== 1/6 narration"
if [ $REVOICE = 1 ] || [ ! -f $V/voice/narration.wav ]; then
  if [ -f voice/reference.wav ] && [ -x .venv-chatterbox/bin/python ]; then
    .venv-chatterbox/bin/python $A/tts_chatterbox.py $VID
  else
    echo "   (no voice/reference.wav or Chatterbox venv -> Kokoro PLACEHOLDER voice)"
    $PY $A/tts_kokoro.py $VID
  fi
  $PY $A/assemble.py $VID
else
  echo "   using existing $V/voice/narration.wav ($(cat $V/voice/NARRATION_SOURCE.txt 2>/dev/null || echo 'user supplied'))"
fi
echo "== 2/6 word timestamps, shot retiming, captions"
$PY $A/align.py $VID
$PY $A/retime.py $VID
$PY shared/captions/captions.py $VID
echo "== 3/6 music, sound effects, mix"
$PY $A/mix.py $VID
echo "== 4/6 picture"
if [ $SKIP = 0 ]; then node shared/renderer/render.mjs $VID --shots $SHOTS --scale $SCALE --workers $WORKERS $AO; fi
echo "== 5/6 export"
shared/export.sh $VID
echo "== 6/6 thumbnail"
THUMB=$($PY -c "import json;print(json.load(open('$V/output/shotlist.retimed.json'))['thumbnail_frame'])")
node shared/renderer/render.mjs $VID --stills $THUMB --stills-dir $V/build/thumb --png $AO
cp $V/build/thumb/f$(printf %05d $THUMB).png $V/output/thumbnail.png
echo "done -> $V/output/$VID.mp4"
