#!/usr/bin/env bash
# Exporta um .pptx como PDF vetorial pelo Keynote (o texto continua texto: o PDFKit lê as linhas).
# Uso: scripts/calibration/keynote-pdf.sh <arquivo.pptx> <saida.pdf>
set -euo pipefail
[[ $# -eq 2 ]] || { echo "uso: $0 <arquivo.pptx> <saida.pdf>" >&2; exit 2; }
input="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
mkdir -p "$(dirname "$2")"
output="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
osascript - "$input" "$output" <<'APPLESCRIPT'
on run argv
  set inPath to POSIX file (item 1 of argv)
  set outPath to POSIX file (item 2 of argv)
  tell application "Keynote"
    set theDoc to open inPath
    export theDoc to outPath as PDF with properties {PDF image quality:Best}
    close theDoc saving no
  end tell
end run
APPLESCRIPT
echo "$output"
