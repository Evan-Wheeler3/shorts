#!/usr/bin/env bash
# Burn the ASS captions into the rendered picture, add the mix, write the final MP4.
set -euo pipefail
cd "$(dirname "$0")/.."
VID=$1; V=videos/$VID
FILTERS=$(ffmpeg -hide_banner -filters 2>/dev/null || true)
case "$FILTERS" in *" ass "*) ;; *) echo "this ffmpeg has no libass (caption burn-in). Install a full build, e.g. 'brew install ffmpeg'."; exit 1;; esac
ffmpeg -y -loglevel error -stats -i $V/build/picture.mp4 -i $V/build/mix.wav \
  -vf "ass=$V/output/captions.ass:fontsdir=shared/fonts,format=yuv420p" \
  -c:v libx264 -preset medium -crf 18 -profile:v high -r 30 -c:a aac -b:a 192k -ar 48000 \
  -movflags +faststart -shortest $V/output/$VID.mp4
cp $V/voice/narration.wav $V/output/narration.wav
ffprobe -v error -show_entries format=duration,size -show_entries stream=codec_name,width,height,r_frame_rate -of compact $V/output/$VID.mp4
