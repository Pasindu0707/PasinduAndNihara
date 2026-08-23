#!/usr/bin/env bash
# Rebuild every web asset from the originals in img/.
# Usage: bash tools/build-assets.sh
set -u

SRC="img"
OUT="site/assets/img"
VID="site/assets/video"
mkdir -p "$OUT" "$VID"

# encode <src> <slug> <extra-rotate:0|1> <crop-bottom-%> <widths>  -- ffmpeg already applies EXIF rotation, so keep this 0
encode() {
  local src="$1" slug="$2" rot="$3" cropb="$4" widths="$5"
  [ -f "$src" ] || { echo "MISSING $src"; return; }
  local vf_pre=""
  [ "$rot" = "1" ] && vf_pre="transpose=1,"
  if [ "$cropb" != "0" ]; then
    vf_pre="${vf_pre}crop=iw:ih*(1-0.${cropb}):0:0,"
  fi
  IFS=',' read -ra WS <<< "$widths"
  for w in "${WS[@]}"; do
    ffmpeg -v error -i "$src" \
      -vf "${vf_pre}scale=${w}:-2:flags=lanczos" \
      -q:v 78 -y "$OUT/${slug}-${w}.webp"
  done
  echo "  $slug  ->  ${widths}"
}

echo "== heroes =="
encode "$SRC/engagement4.jpg"  hero-portrait  0 08 "640,1000,1400"
encode "$SRC/engagement3.jpg"  hero-landscape 0 10 "1000,1600,2200"

echo "== act photos =="
encode "$SRC/engagement1.jpg"  church-mood    0 08 "640,1000,1400"
encode "$SRC/2024.jpeg"        party-mood     0 00 "800,1300,1900"

echo "== story =="
encode "$SRC/ourfirstphoto1.jpg" story-2016    0 00 "500,640"
encode "$SRC/ourfirstphoto3.jpg" story-2017    0 00 "500,853"
encode "$SRC/2018-7.jpg"         story-2018    0 00 "500,800,1200"
encode "$SRC/2019-1.jpeg"        story-2019    0 00 "500,800,960"
encode "$SRC/2022dec.JPG"        story-2022    0 00 "500,800,1200"
encode "$SRC/2026.jpeg"          story-2023    0 00 "500,800,1200"
encode "$SRC/engament.jpg"       story-2025    0 08 "500,800,1200"

echo "== gallery =="
encode "$SRC/engagement2.jpg"                    gal-01 0 08 "500,800,1200"
encode "$SRC/engagement5.jpg"                    gal-02 0 08 "500,800,1200"
encode "$SRC/engamentphotothat we  like.jpeg"    gal-03 0 00 "500,535"
encode "$SRC/2019.jpg"                           gal-04 0 00 "500,800,1200"
encode "$SRC/2018-4.jpg"                         gal-05 0 00 "500,800,1200"
encode "$SRC/2018-1.jpg"                         gal-06 0 00 "500,800,1200"
encode "$SRC/2019-4.jpg"                         gal-07 0 00 "500,800,1200"
encode "$SRC/2018pic1.jpg"                       gal-08 0 00 "500,800,1080"
encode "$SRC/2022 dec.jpg"                       gal-09 0 00 "500,800,1200"
encode "$SRC/ourfirstphoto2.jpg"                 gal-10 0 00 "500,640"

echo "== share card (1200x630) =="
ffmpeg -v error -i "$SRC/engagement3.jpg" \
  -vf "crop=iw:ih*0.90:0:0,scale=1200:630:force_original_aspect_ratio=increase,crop=1200:630" \
  -q:v 82 -y "$OUT/share-card.jpg"

echo "== hero video (sunset silhouette) =="
HERO="$SRC/video/WhatsApp Video 2026-08-24 at 00.48.19 (1).mp4"
if [ -f "$HERO" ]; then
  ffmpeg -v error -i "$HERO" -an -t 14.5 \
    -vf "scale=720:-2" -c:v libx264 -profile:v main -pix_fmt yuv420p \
    -crf 30 -preset slow -movflags +faststart -y "$VID/hero.mp4"
  ffmpeg -v error -i "$HERO" -an -t 14.5 \
    -vf "scale=720:-2" -c:v libvpx-vp9 -crf 38 -b:v 0 -row-mt 1 \
    -deadline good -cpu-used 2 -y "$VID/hero.webm"
  ffmpeg -v error -ss 7 -i "$HERO" -frames:v 1 \
    -vf "scale=720:-2" -q:v 75 -y "$VID/hero-poster.webp"
  echo "  hero.mp4 / hero.webm / hero-poster.webp"
else
  echo "  MISSING hero video"
fi

echo
echo "Done. Sizes:"
du -sh "$OUT" "$VID"
