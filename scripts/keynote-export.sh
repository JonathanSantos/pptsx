#!/usr/bin/env bash
# Exporta cada slide de um .pptx como PNG usando o Keynote (renderizador real para validação visual).
# Uso: scripts/keynote-export.sh <arquivo.pptx | pasta-com-pptx> <pasta-saida>
# Com uma pasta (M18), exporta cada .pptx dela para <pasta-saida>/<nome-do-arquivo>/.
#
# M16 (M8-H): uma exportação por vez na máquina (trava atômica com mkdir em $PPTSX_KEYNOTE_LOCK, com o
# pid de quem a tem; trava de processo morto é retomada) e até 3 tentativas quando o Keynote está
# ocupado ou lento (-1712 timeout de AppleEvent, -1700 documento ainda não aberto, -609 conexão perdida).
set -euo pipefail

[[ $# -eq 2 ]] || { echo "uso: $0 <arquivo.pptx | pasta> <pasta-saida>" >&2; exit 2; }

mkdir -p "$2"
target_root="$(cd "$2" && pwd)"
if [[ -d "$1" ]]; then
  source_dir="$(cd "$1" && pwd)"
  inputs=("$source_dir"/*.pptx)
  [[ -e "${inputs[0]}" ]] || { echo "keynote-export: nenhum .pptx em $1" >&2; exit 2; }
else
  inputs=("$(cd "$(dirname "$1")" && pwd)/$(basename "$1")")
fi

lock="${PPTSX_KEYNOTE_LOCK:-/tmp/pptsx-keynote.lock}"
attempts="${PPTSX_KEYNOTE_ATTEMPTS:-3}"
retry_wait="${PPTSX_KEYNOTE_RETRY_WAIT:-30}"
lock_timeout="${PPTSX_KEYNOTE_LOCK_TIMEOUT:-600}"

acquire_lock() {
  local waited=0
  until mkdir "$lock" 2>/dev/null; do
    local holder
    holder="$(cat "$lock/pid" 2>/dev/null || true)"
    # Dono morto (ou trava sem pid depois de 5 s): a trava é velha e pode ser retomada.
    if [[ -n "$holder" ]] && ! kill -0 "$holder" 2>/dev/null; then
      rm -rf "$lock"; continue
    fi
    if [[ -z "$holder" && $waited -ge 5 ]]; then
      rm -rf "$lock"; continue
    fi
    if [[ $waited -ge $lock_timeout ]]; then
      echo "keynote-export: outra exportação (pid ${holder:-?}) segura $lock há ${lock_timeout}s; desistindo" >&2
      exit 75
    fi
    sleep 1; waited=$((waited + 1))
  done
  echo $$ > "$lock/pid"
  trap 'rm -rf "$lock"' EXIT
}

export_once() {
  local input="$1" output="$2"
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
}

acquire_lock

# Um arquivo: com tentativas nos erros de Keynote ocupado; depois converte para sRGB.
export_file() {
  local input="$1" output="$2" attempt=1 errors
  mkdir -p "$output"
  while true; do
    if errors="$(export_once "$input" "$output" 2>&1 >/dev/null)"; then break; fi
    if [[ $attempt -lt $attempts ]] && grep -qE -- '-1712|-1700|-609' <<<"$errors"; then
      echo "keynote-export: tentativa $attempt falhou ($(tr '\n' ' ' <<<"$errors")); nova tentativa em ${retry_wait}s" >&2
      sleep "$retry_wait"; attempt=$((attempt + 1)); continue
    fi
    echo "$errors" >&2
    return 1
  done
  # O Keynote exporta em Display P3; converte para sRGB para comparar cores com o preview nativo.
  for png in "$output"/*.png; do
    [[ -e "$png" ]] && sips -m "/System/Library/ColorSync/Profiles/sRGB Profile.icc" "$png" >/dev/null
  done
  ls "$output"
}

if [[ ${#inputs[@]} -eq 1 && ! -d "$1" ]]; then
  export_file "${inputs[0]}" "$target_root"
else
  for input in "${inputs[@]}"; do
    name="$(basename "$input" .pptx)"
    echo "== $name"
    export_file "$input" "$target_root/$name"
  done
fi
