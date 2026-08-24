#!/usr/bin/env bash
# Rebuild every web asset from the originals in img/.
# Usage: bash tools/build-assets.sh
set -u

SRC="img"
OUT="site/assets/img"
VID="site/assets/video"
mkdir -p "$OUT" "$VID"

# encode <src> <slug> <crop-bottom-%> <widths>
# ffmpeg already applies EXIF rotation on input, so no transpose is needed.
encode() {
  local src="$1" slug="$2" cropb="$3" widths="$4"
  [ -f "$src" ] || { echo "  MISSING $src"; return; }
  local vf_pre=""
  [ "$cropb" != "0" ] && vf_pre="crop=iw:ih*(1-0.${cropb}):0:0,"
  IFS=',' read -ra WS <<< "$widths"
  local sc
  for w in "${WS[@]}"; do
    # "full" means native width capped at 1400 — the size the lightbox opens
    if [ "$w" = "full" ]; then
      sc="scale='min(1400,iw)':-2:flags=lanczos"
    else
      sc="scale=${w}:-2:flags=lanczos"
    fi
    ffmpeg -v error -i "$src" -vf "${vf_pre}${sc}" -q:v 78 -y "$OUT/${slug}-${w}.webp"
  done
  echo "  $slug  ->  ${widths}"
}

echo "== act photos =="
encode "$SRC/engagement1.jpg"  church-mood 08 "640,1000,1400"
# the venue's own MOON LIGHT banner sits across the top of this frame and the
# photographer's mark across the bottom, so this one is cropped at both ends
for w in 800 1300; do
  ffmpeg -v error -i "$SRC/2024.jpeg"     -vf "crop=iw:ih*0.72:0:ih*0.16,scale=${w}:-2:flags=lanczos"     -q:v 78 -y "$OUT/party-mood-${w}.webp"
done
echo "  party-mood  ->  800,1300 (cropped top and bottom)"

echo "== story cards (one per year) =="
encode "$SRC/ourfirstphoto.jpg" story-2018  00 "400,640"
encode "$SRC/2018.jpg"          story-2018b 00 "400,700,1200"
encode "$SRC/2019.jpg"          story-2019 00 "400,700,1200"
encode "$SRC/2022.jpeg"         story-2022 00 "400,700"
encode "$SRC/2023.jpeg"         story-2023 00 "400,700"
for w in 400 700 1066; do
  ffmpeg -v error -i "$SRC/2024.jpeg"     -vf "crop=iw:ih*0.72:0:ih*0.16,scale=${w}:-2:flags=lanczos"     -q:v 78 -y "$OUT/story-2024-${w}.webp"
done
echo "  story-2024  ->  400,700,1066 (same crop as party-mood)"
encode "$SRC/2025.jpeg"         story-2025 00 "400,700,1200"
encode "$SRC/engament.jpg"      story-2025b 08 "400,700,1200"
encode "$SRC/2026.jpeg"         story-2026 00 "400,700,1200"

echo "== gallery — the engagement shoot =="
encode "$SRC/engagement4.jpg"                 gal-01 08 "400,700,full"
encode "$SRC/engagement1.jpg"                 gal-02 08 "400,700,full"
encode "$SRC/engament.jpg"                    gal-03 08 "400,700,full"
encode "$SRC/engagement3.jpg"                 gal-04 10 "400,700,full"
encode "$SRC/engagement5.jpg"                 gal-05 08 "400,700,full"
encode "$SRC/engagement2.jpg"                 gal-06 08 "400,700,full"
encode "$SRC/engamentphotothat we  like.jpeg" gal-07 00 "400,full"

echo "== share card (1200x630) =="
ffmpeg -v error -i "$SRC/engagement3.jpg" \
  -vf "crop=iw:ih*0.90:0:0,scale=1200:630:force_original_aspect_ratio=increase,crop=1200:630" \
  -q:v 82 -y "$OUT/share-card.jpg"
echo "  share-card.jpg"

echo "== music =="
# Background music sits under everything at low volume, so it is encoded mono
# at a modest bitrate — the file is a third of the size and nobody can tell.
SRC_AUDIO=$(ls *.mp3 2>/dev/null | head -1)
mkdir -p site/assets/audio
if [ -n "$SRC_AUDIO" ]; then
  ffmpeg -v error -i "$SRC_AUDIO" -vn -ac 1 -b:a 64k -ar 44100     -af "afade=t=in:st=0:d=2" -y "site/assets/audio/theme.mp3"
  echo "  $SRC_AUDIO  ->  theme.mp3  ($(du -h site/assets/audio/theme.mp3 | cut -f1))"
else
  echo "  no .mp3 in the project root — skipping"
fi

echo "== icons =="
# Generated here on purpose: this script wipes site/assets/img, so anything
# hand-placed in it disappears on the next rebuild. That is how the favicon
# was lost once already.
#
# At 16px a line drawing turns to mush, so the icon is the wax seal instead:
# a solid wine field with the lily in cream, drawn with heavy strokes.
cat > "$OUT/favicon.svg" <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="10" fill="#590B19"/>
  <g fill="none" stroke="#F5EBD0" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M32 36C22 33 18.5 22.5 24.5 14 29 7.5 39.5 6 44 11c4.4 4.8 3 14.2-5.2 19.4-2.1 1.5-4.5 3.7-6.8 5.6Z"/>
    <path d="M32.9 31c-1.5-4.8-.9-10.7 1.2-14.5"/>
    <path d="M32 36v20"/>
  </g>
</svg>
SVG

CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
if [ -f "$CHROME" ]; then
  TMP="$(mktemp -d)"
  # Chrome clamps very small window widths, so a 180px window does not give a
  # 180px viewport — the icon ends up centred outside the capture. Render it
  # big at a fixed size in the top-left corner instead, then crop and scale.
  # wine behind it, so the PNGs are full-bleed — iOS rounds the home-screen
  # icon itself and a white corner would show through
  { echo '<style>html,body{margin:0;padding:0;overflow:hidden;background:#590B19}svg{width:512px;height:512px;display:block}</style>'
    cat "$OUT/favicon.svg"
  } > "$TMP/icon.html"

  "$CHROME" --headless=new --disable-gpu --hide-scrollbars     --force-device-scale-factor=1 --window-size=700,700     --screenshot="$(cygpath -w "$TMP/icon.png")"     "file:///$(cygpath -m "$TMP/icon.html")" >/dev/null 2>&1

  if [ -f "$TMP/icon.png" ]; then
    ffmpeg -v error -i "$TMP/icon.png" -vf "crop=512:512:0:0,scale=180:180:flags=lanczos"       -y "$OUT/apple-touch-icon.png"
    ffmpeg -v error -i "$TMP/icon.png" -vf "crop=512:512:0:0,scale=32:32:flags=lanczos"       -y "$OUT/favicon-32.png"
    echo "  favicon.svg / favicon-32.png / apple-touch-icon.png"
  else
    echo "  favicon.svg (Chrome did not render — PNG fallbacks missing)"
  fi
  rm -rf "$TMP"
else
  echo "  favicon.svg (no Chrome — PNG fallbacks not rasterised)"
fi

echo "== hero video =="
# The source is a 576x1024 WhatsApp export, so there is no real detail to
# recover. What helps: strip the compression noise, upscale 2x with lanczos
# and a light sharpen, and spend far more bits than before. A laptop then
# upscales ~1.1x instead of ~2.2x, which is where the mush was coming from.
HERO="$SRC/video/herovid.mp4"
CLEAN="hqdn3d=2:1.5:3:3"
SHARP="unsharp=5:5:0.45:5:5:0.0"
if [ -f "$HERO" ]; then
  # phones and small windows — native resolution, generous quality
  ffmpeg -v error -i "$HERO" -an -t 24     -vf "hqdn3d=1.5:1:2:2"     -c:v libx264 -profile:v high -pix_fmt yuv420p     -crf 22 -preset slow -movflags +faststart -y "$VID/hero-sm.mp4"

  # laptops and desktops — 2x
  ffmpeg -v error -i "$HERO" -an -t 24     -vf "${CLEAN},scale=1152:2048:flags=lanczos,${SHARP}"     -c:v libx264 -profile:v high -pix_fmt yuv420p     -crf 24 -preset slow -movflags +faststart -y "$VID/hero-lg.mp4"

  ffmpeg -v error -ss 8 -i "$HERO" -frames:v 1     -vf "${CLEAN},scale=1152:2048:flags=lanczos,${SHARP}"     -q:v 80 -y "$VID/hero-poster.webp"

  rm -f "$VID/hero.mp4"
  echo "  hero-sm.mp4 / hero-lg.mp4 / hero-poster.webp"
else
  echo "  MISSING $HERO"
fi

echo
du -sh "$OUT" "$VID"
ls -la "$VID"

echo
echo "== checking every asset the page asks for =="
# This script deletes and recreates site/assets/img. The favicon was once
# hand-placed there and vanished on a rebuild without anything noticing,
# so the build now refuses to pass quietly.
missing=0
for f in $(grep -oE '(assets|data)/[A-Za-z0-9_./-]+\.(webp|jpg|png|svg|mp4|ics|json|css|js)' site/index.html | sort -u); do
  if [ ! -f "site/$f" ]; then echo "  MISSING  site/$f"; missing=$((missing+1)); fi
done
for i in 1 2 3 4 5 6 7; do
  n=$(printf "%02d" "$i")
  for v in 400 full; do
    [ -f "site/assets/img/gal-$n-$v.webp" ] || { echo "  MISSING  gal-$n-$v.webp"; missing=$((missing+1)); }
  done
done
for f in video/hero-sm.mp4 video/hero-lg.mp4 video/hero-poster.webp cal/ceremony.ics cal/celebration.ics; do
  [ -f "site/assets/$f" ] || { echo "  MISSING  assets/$f"; missing=$((missing+1)); }
done
if [ "$missing" -gt 0 ]; then
  echo "  $missing asset(s) missing — the site will 404"
  exit 1
fi
echo "  all present"
