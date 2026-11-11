#!/usr/bin/env bash
# Sets up Chatterbox (Resemble AI, MIT) for zero-shot voice cloning in its own venv
# inside the repo (.venv-chatterbox). Uses Apple Metal (MPS) when available, else CPU.
# Needs ~6 GB free: PyTorch (~2 GB) + model weights (~3 GB, cached in .cache/hf).
set -euo pipefail
cd "$(dirname "$0")/.."
FREE_GB=$(df -Pk . | awk 'NR==2 {printf "%d", $4/1048576}')
echo "free disk space: ${FREE_GB} GB"
[ "$FREE_GB" -ge 8 ] || { echo "Need at least ~8 GB free for PyTorch + Chatterbox weights. Free up space and re-run."; exit 1; }
# Chatterbox pins older numpy/torch builds that want Python 3.11
if command -v uv >/dev/null; then
  uv venv .venv-chatterbox --python 3.11 -q --allow-existing
  uv pip install -q -p .venv-chatterbox/bin/python chatterbox-tts
else
  PY=$(command -v python3.11 || true)
  [ -n "$PY" ] || { echo "Python 3.11 not found. Install uv (brew install uv) or python@3.11 (brew install python@3.11) and re-run."; exit 1; }
  "$PY" -m venv .venv-chatterbox
  .venv-chatterbox/bin/pip install -q -U pip
  .venv-chatterbox/bin/pip install -q chatterbox-tts
fi
export HF_HOME=$PWD/.cache/hf
.venv-chatterbox/bin/python - <<'PY'
import torch
dev = "mps" if torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu")
print("torch", torch.__version__, "- device:", dev)
PY
if [ -f voice/reference.wav ]; then
  echo "voice/reference.wav found. Hear the clone with:  scripts/test_voice.sh"
else
  echo "voice/reference.wav is missing - see voice/README.md, then run scripts/test_voice.sh"
fi
