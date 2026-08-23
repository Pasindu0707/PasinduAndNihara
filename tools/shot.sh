#!/usr/bin/env bash
# tools/shot.sh <name> <url-path> [width] [height]
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
SP="/c/Users/PASIND~1/AppData/Local/Temp/claude/C--Wedding-invite/b2de3187-3642-4054-bc02-d21f1dbd48c5/scratchpad/shots"
mkdir -p "$SP"
NAME="$1"; URL="http://localhost:5173$2"; W="${3:-390}"; H="${4:-844}"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --virtual-time-budget=8000 --window-size="$W,$H" \
  --screenshot="$(cygpath -w "$SP/$NAME.png")" "$URL" >/dev/null 2>&1
echo "$SP/$NAME.png"
