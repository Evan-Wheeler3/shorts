# Voice

`voice/reference.wav` is **missing**, so videos are currently narrated with a clearly
labelled **placeholder voice (Kokoro, `am_michael`)**. Add your sample to switch to your cloned voice.

## Record the reference sample (2 minutes)

1. Quiet room, soft furnishings if possible. No music, TV, fan, or echo.
2. Hold your phone 6-8 inches from your mouth, slightly off to the side.
3. Speak for **10-30 seconds in one continuous take**, in the voice you want for the channel:
   low, steady, slightly wry storyteller. Any text works, for example read two or three
   lines from `videos/alcatraz/script.json`.
4. Export as WAV (or M4A) and save it as `voice/reference.wav`.
   From M4A: `ffmpeg -i recording.m4a -ac 1 -ar 44100 voice/reference.wav`

The sample is git-ignored by default so your raw voice stays on your machine.

## Use it

```bash
scripts/setup_voice.sh            # one-time: Chatterbox in .venv-chatterbox (MPS on Apple Silicon, else CPU)
scripts/test_voice.sh             # speaks one sentence -> voice/test_clone.wav, so you can judge the clone
./build.sh alcatraz --revoice     # regenerate narration with your voice and rebuild the video
```

A single line that sounds off can be regenerated with a different seed and the video rebuilt:

```bash
.venv-chatterbox/bin/python shared/audio/tts_chatterbox.py alcatraz 4 --seed-bump 1   # shot 4 only
.venv/bin/python shared/audio/assemble.py alcatraz && ./build.sh alcatraz
```

## Or bring your own narration

Each video reads exactly one narration file: `videos/<id>/voice/narration.wav`.
Record or generate it anywhere, drop it in (any sample rate, mono or stereo), and run
`./build.sh <id>`. Word timestamps, shot timing, captions, and the mix are all re-derived from that file.
