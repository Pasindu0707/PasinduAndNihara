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
encode "$SRC/2024.jpeg"        party-mood  00 "800,1300"

echo "== story cards (one per year) =="
encode "$SRC/ourfirstphoto.jpg" story-2016 00 "400,640"
encode "$SRC/2018.jpg"          story-2018 00 "400,700,1200"
encode "$SRC/2019.jpg"          story-2019 00 "400,700,1200"
encode "$SRC/2022.jpeg"         story-2022 00 "400,700"
encode "$SRC/2023.jpeg"         story-2023 00 "400,700"
encode "$SRC/2024.jpeg"         story-2024 00 "400,700,1066"
encode "$SRC/2025.jpeg"         story-2025 00 "400,700,1200"
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
HERO="$SRC/video/herovid.mp4"
if [ -f "$HERO" ]; then
  ffmpeg -v error -i "$HERO" -an -ss 0 -t 24 \
    -vf "scale=576:-2" -c:v libx264 -profile:v main -pix_fmt yuv420p \
    -crf 31 -preset slow -movflags +faststart -y "$VID/hero.mp4"
  ffmpeg -v error -ss 8 -i "$HERO" -frames:v 1 \
    -vf "scale=576:-2" -q:v 75 -y "$VID/hero-poster.webp"
  echo "  hero.mp4 / hero-poster.webp"
else
  echo "  MISSING $HERO"
fi

echo
du -sh "$OUT" "$VID"
ls -la "$VID"
