# shorts

Script-to-MP4 pipeline for animated, narrated YouTube Shorts (1080x1920, 30 fps).
Every video is a low-poly 3D explainer built entirely from code: no stock footage, no
generated imagery. Narration comes first; every shot, caption, and sound cue is retimed
to it.

```bash
scripts/setup.sh        # once: .venv, node_modules, model cache - all inside this repo
./build.sh alcatraz     # script -> narration -> timings -> captions -> mix -> render -> MP4 (3D low-poly)
./build.sh empire-state # same pipeline, 2D paper-cutaway style
```

Output lands in `videos/alcatraz/output/`:

| file | what |
| --- | --- |
| `alcatraz.mp4` | final video: H.264 + AAC, burned-in captions, music, SFX |
| `narration.wav` | the narration used (about -14 LUFS) |
| `captions.srt`, `captions.ass` | phrase captions / word-by-word captions (the ASS file is what gets burned in) |
| `shotlist.retimed.json` | every shot retimed to the narration: start/end, frames, cue times, SFX times, word timestamps |
| `thumbnail.png` | 1080x1920 still from the strongest shot |

## Stack and why

| job | tool | why |
| --- | --- | --- |
| 3D render | three.js in headless Chromium (Playwright), frames streamed to ffmpeg | No Blender needed, identical on macOS (Metal) and GPU-less Linux (software GL), deterministic frame-by-frame, nothing but an MP4 touches the disk |
| 2D render | Canvas2D "paper cutaway" stage in the same headless browser (`"renderer": "2d"` in `script.json`) | Same pipeline and timing, far faster to author and render |
| Voice (real) | Chatterbox, zero-shot clone of `voice/reference.wav` | Free, MIT, runs on Apple Silicon (MPS) |
| Voice (placeholder) | Kokoro via `kokoro-onnx` | Apache 2.0, CPU-only, no PyTorch |
| Word timestamps | faster-whisper, mapped back onto the exact script words | Works for any narration file, including one made elsewhere |
| Music + SFX | synthesised in numpy (`shared/audio/music.py`, `sfx.py`) | Original, royalty-free, reproducible |
| Captions, mux | libass + ffmpeg | Standard, fast |

Requirements: `node` 18+, `python3` 3.10+, `ffmpeg` with libass (`brew install ffmpeg node`).
Disk: about 1.5 GB for the base setup; the cloned voice adds roughly 6 GB (see `voice/README.md`).

## Layout

```
build.sh                    one-command rebuild
scripts/                    setup.sh, setup_voice.sh, test_voice.sh, QA still helpers
shared/
  web/                      core.js (palette, easing, low-poly helpers), figure.js (blank-faced rig), stage.js (3D renderer, sky, fog, overlay labels), stage2d.js (2D paper stage)
  renderer/                 render.mjs (headless frame streamer), player.html
  audio/                    tts_kokoro.py, tts_chatterbox.py, assemble.py, align.py, retime.py, sfx.py, music.py, mix.py
  captions/captions.py      SRT + ASS from word timestamps
  export.sh                 caption burn-in + mux
  fonts/                    Montserrat Black (OFL)
voice/                      reference.wav (yours, git-ignored) + instructions
videos/<id>/
  script.json               narration per shot, visual direction, cues, SFX list, voice settings
  set.js, props.js, scene.js  the 3D set, props/cast, and per-shot animation
  voice/narration.wav       THE narration for this video (swappable)
  build/                    intermediates (git-ignored)
  output/                   deliverables
```

## How timing works

1. `script.json` holds the exact narration for each shot plus named **cues** tied to words
   (`"spoon": {"word": "spoon", "offset": -0.15}`) and SFX entries that hang off those cues.
2. Narration is generated one shot at a time (fixed seed per shot, same settings and reference
   clip), trimmed, joined with 200 ms pauses (700 ms after "They leave without him."), and
   normalised to -14 LUFS.
3. `align.py` gets word timestamps from the audio; `retime.py` sets each shot's start/end from its
   first word and resolves every cue to seconds. Target durations in the script are only targets.
4. The scene code animates against those cue times, the mixer places SFX on them, and captions
   use the same word timestamps, so picture, sound, and text cannot drift apart.

## Swapping the narration

Replace `videos/<id>/voice/narration.wav` with any recording of the same script and run
`./build.sh <id>`. Everything downstream is re-derived from that file. To regenerate it instead:
`./build.sh <id> --revoice` (uses your clone if `voice/reference.wav` and the Chatterbox venv
exist, otherwise the Kokoro placeholder). `voice/NARRATION_SOURCE.txt` records which engine made
the current file.

## Useful commands

```bash
./build.sh alcatraz --preview            # half-resolution picture for a fast look
./build.sh alcatraz --skip-render        # re-do audio, captions, export only
./build.sh alcatraz --ao                 # add screen-space ambient occlusion (use on a real GPU)
scripts/stills.sh alcatraz               # contact sheets: 5 frames from every shot
scripts/at.sh alcatraz 0.5 7:wait+0.9    # still at shot 7, 0.9 s after its "wait" cue
```

Rendering speed: about 1 frame/s on a 4-core machine with software GL (a 2-minute video takes
about an hour). On Apple Silicon the same code runs on the GPU and should be several times faster.

## Style (shared across videos)

Faceted low-poly models, flat shading, soft shadows. Palette: amber lamplight `#F2A65A`, navy
night `#1B2A49`, teal-gray fog, off-white highlights, red reserved for danger beats. Characters
have blank faces and are told apart by collar and cuff accents. One smooth camera move per shot,
pop-in scale-ups for objects, a `STEP N` label per step, word-by-word captions with the current
word in amber, all inside the Shorts safe area (clear of the bottom 20% and right 12%).

## Videos

| id | title | style |
| --- | --- | --- |
| `alcatraz` | How to Escape from Alcatraz | 3D low-poly diorama |
| `empire-state` | How to Build the Empire State Building in a Year | 2D paper cutaway on a blueprint |

## Adding a video

Copy `videos/alcatraz` (3D) or `videos/empire-state` (2D) to `videos/<new-id>`, rewrite `script.json`, and
build the shots in `scene.js` using the helpers in `shared/web`. Optional `music` settings in `script.json`
(chords, pulse, which shots build and release) shape the synthesised score. `./build.sh <new-id>` does the rest.
