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
