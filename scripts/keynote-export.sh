#!/usr/bin/env bash
# Exporta cada slide de um .pptx como PNG usando o Keynote (renderizador real para validação visual).
# Uso: scripts/keynote-export.sh <arquivo.pptx> <pasta-saida>
set -euo pipefail

[[ $# -eq 2 ]] || { echo "uso: $0 <arquivo.pptx> <pasta-saida>" >&2; exit 2; }

input="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
mkdir -p "$2"
output="$(cd "$2" && pwd)"

osascript - "$input" "$output" <<'APPLESCRIPT'
on run argv
  set inPath to POSIX file (item 1 of argv)
  set outPath to POSIX file (item 2 of argv)
  tell application "Keynote"
    set theDoc to open inPath
    export theDoc to outPath as slide images with properties {image format:PNG, skipped slides:false}
    close theDoc saving no
  end tell
end run
APPLESCRIPT

# O Keynote exporta em Display P3; converte para sRGB para comparar cores com o preview nativo.
for png in "$output"/*.png; do
  sips -m "/System/Library/ColorSync/Profiles/sRGB Profile.icc" "$png" >/dev/null
done

ls "$output"
