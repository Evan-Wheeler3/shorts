#!/usr/bin/env bash
# One-time setup of everything except the cloned voice (see scripts/setup_voice.sh).
# Everything is installed inside this repo (.venv, node_modules, .cache) - nothing global.
set -euo pipefail
cd "$(dirname "$0")/.."
echo "free disk space:"; df -h . | tail -1
command -v ffmpeg >/dev/null || { echo "ffmpeg is required (macOS: brew install ffmpeg)"; exit 1; }
command -v node >/dev/null || { echo "node 18+ is required (macOS: brew install node)"; exit 1; }
if command -v uv >/dev/null; then uv venv .venv -q --allow-existing; uv pip install -q -p .venv/bin/python -r requirements.txt
else python3 -m venv .venv; .venv/bin/pip install -q -U pip; .venv/bin/pip install -q -r requirements.txt; fi
if node -e "require('playwright')" 2>/dev/null; then
  npm install --omit=optional --no-audit --no-fund          # a Playwright + Chromium is already provided
else
  npm install --no-audit --no-fund && PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium
fi
echo "setup done. Build a video with:  ./build.sh alcatraz"
