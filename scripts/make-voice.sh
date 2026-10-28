#!/usr/bin/env bash
# Pre-records ась's replies: Piper (MIT, offline neural TTS) reads voice-src/lines.tsv,
# ffmpeg evens the loudness and writes public/voice/<id>.mp3.
# Voices: ru_RU-dmitri-medium / ru_RU-denis-medium — trained on CC0 datasets.
#   PIPER=/path/to/piper.exe MODEL=/path/to/ru_RU-dmitri-medium.onnx bash scripts/make-voice.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${PIPER:?path to piper(.exe)}" "${MODEL:?path to the .onnx voice}"
tmp=$(mktemp -d)
while IFS=$'\t' read -r id text; do
  [ -z "$id" ] && continue
  printf '%s' "$text" | "$PIPER" -m "$MODEL" -f "$tmp/$id.wav" --sentence_silence 0.18 --length_scale 0.98
  ffmpeg -v error -y -i "$tmp/$id.wav" -af "loudnorm=I=-16:TP=-1.5:LRA=11" -ar 44100 -ac 1 -c:a libmp3lame -b:a 80k "public/voice/$id.mp3"
  echo "voice/$id.mp3"
done < voice-src/lines.tsv
rm -rf "$tmp"
