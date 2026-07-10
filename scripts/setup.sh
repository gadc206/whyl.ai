#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXT="$ROOT/packages/extension/dist"

node "$ROOT/scripts/build-extension.js"

if ! curl -sf http://localhost:3001/api/health >/dev/null 2>&1; then
  echo "→ Starting dev servers..."
  cd "$ROOT" && npm run dev &
  sleep 4
fi

open "$EXT"
open -a "Google Chrome" "chrome://extensions/"

echo ""
echo "WHYL v1.1.0 ready"
echo "1. Remove old extension in Chrome"
echo "2. Load unpacked → select packages/extension/dist (dev) or unzipped whyl-extension (investor zip)"
echo "3. Refresh ChatGPT"
