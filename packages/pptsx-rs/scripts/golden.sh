#!/usr/bin/env bash
# Fixtures douradas: a saída do pptsx em TS (a referência) para os decks de exemplo, que o
# `cargo test` (tests/golden.rs) compara com a do binário Rust. Rode de novo quando o TS mudar.
#
#   scripts/golden.sh            # todos os decks da lista
#   scripts/golden.sh demo       # só um
#
# Grava em fixtures/<deck>/: deck.txt (caminho no repo), diagnostics.json (do TS) e, por tamanho,
# ppt/slides/slide*.xml e ppt/charts/chart*.xml crus do .pptx. A comparação semântica (frames com
# tolerância, texto, cores) fica toda em Rust, num só lugar.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
REPO=$(cd "$ROOT/../.." && pwd)
OUT="$ROOT/fixtures"
SIZES="16x9,4x3"

DECKS=(
  packages/pptsx/examples/hello.tsx
  packages/pptsx/examples/layout-test.tsx
  packages/pptsx/examples/overflow.tsx
  packages/ds-base/examples/demo.tsx
  packages/ds-base/examples/charts.tsx
  packages/ds-base/examples/showcase.tsx
  packages/ds-base/examples/long-list.tsx
)

only="${1:-}"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

for deck in "${DECKS[@]}"; do
  name=$(basename "$deck" .tsx)
  if [[ -n "$only" && "$only" != "$name" ]]; then
    continue
  fi
  echo "→ $name"
  # Sai 1 quando há diagnóstico error (overflow.tsx): a saída existe do mesmo jeito.
  node "$REPO/packages/pptsx/bin/pptsx.mjs" build "$REPO/$deck" --size "$SIZES" --out "$tmp/$name" --preview none >/dev/null || true
  rm -rf "${OUT:?}/$name"
  mkdir -p "$OUT/$name"
  printf '%s\n' "$deck" > "$OUT/$name/deck.txt"
  cp "$tmp/$name/$name.diagnostics.json" "$OUT/$name/diagnostics.json"
  for size in ${SIZES//,/ }; do
    x="$tmp/x-$name-$size"
    unzip -qo "$tmp/$name/$name.$size.pptx" 'ppt/slides/slide*.xml' 'ppt/charts/chart*.xml' -d "$x" || true
    mkdir -p "$OUT/$name/$size"
    cp "$x"/ppt/slides/slide*.xml "$OUT/$name/$size/"
    if compgen -G "$x/ppt/charts/chart*.xml" > /dev/null; then
      cp "$x"/ppt/charts/chart*.xml "$OUT/$name/$size/"
    fi
  done
done

echo "fixtures em $OUT"
