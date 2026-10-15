#!/usr/bin/env bash
# M18-9: gera em dist/validacao/ todos os decks da lista do dono (docs/work/VALIDACAO-DONO.md), 16x9 e 4x3,
# com os PNGs de referência ao lado. Rode da raiz do repositório: scripts/validacao-dono.sh
set -euo pipefail
OUT=dist/validacao
PPTSX="node packages/pptsx/bin/pptsx.mjs"
rm -rf "$OUT" && mkdir -p "$OUT"
build() { $PPTSX build "$1" --size 16x9,4x3 --out "$OUT/$2" ${3:-} > /dev/null || true; echo "  $OUT/$2/"; }
echo "Decks para o PowerPoint e o Google Slides:"
build packages/pptsx/examples/calibration.tsx calibracao --debug
build packages/ds-base/examples/demo.tsx demo
build packages/ds-base/examples/charts.tsx charts
build packages/ds-base/examples/showcase.tsx showcase
build packages/pptsx/examples/layout-test.tsx layout-test
build packages/ds-base/examples/dados/graficos.tsx graficos
build packages/ds-base/examples/dados/tabelas.tsx tabelas
build packages/pptsx/examples/diagrams/formas.tsx formas
build packages/pptsx/examples/diagrams/fluxo.tsx fluxo
build packages/pptsx/examples/diagrams/icones.tsx icones
build packages/ds-base/examples/texto/relatorio.tsx relatorio
build packages/ds-base/examples/texto/pesos.tsx pesos "--embed-fonts"
build packages/ds-base/examples/arquivo/arquivo.tsx arquivo
node packages/ds-kit/bin/pptsx-ds.mjs catalog packages/ds-base/src/ds.ts --out "$OUT/catalogo" --fixtures "$OUT/catalogo/fixtures" --pptx > /dev/null && echo "  $OUT/catalogo/"
echo "Pronto. Siga docs/work/VALIDACAO-DONO.md."
