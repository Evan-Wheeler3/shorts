#!/usr/bin/env bash
# Speak one sentence with the cloned voice so you can judge it before a full render.
#   scripts/test_voice.sh ["Custom sentence."]   -> voice/test_clone.wav
set -euo pipefail
cd "$(dirname "$0")/.."
export HF_HOME=$PWD/.cache/hf
[ -x .venv-chatterbox/bin/python ] || { echo "run scripts/setup_voice.sh first"; exit 1; }
.venv-chatterbox/bin/python scripts/test_voice.py "${1:-You wake up in 1962, locked inside a maximum security prison. Here's how you get out.}"
command -v afplay >/dev/null && afplay voice/test_clone.wav || echo "listen to voice/test_clone.wav"
