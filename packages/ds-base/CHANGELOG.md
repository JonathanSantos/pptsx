# Changelog — @pptsx/ds-base

## 0.2.0 — M18

- Variantes do `KpiCard` com `for: 'text'` e sem nenhum `as` de tipo; catálogo também em `.pptx` (conferido no Keynote).
- Guia com a seção "Tokens e regras" (as chaves dos tokens, geradas deles, e o critério de cada regra).
- Exemplos migrados para a 1.0 com `pptsx lint --from 0.x` (`showValues` → `labels`, props antigas → CSS).
- `THIRD_PARTY.md` (Inter, OFL), `sideEffects: false`, provenance.
- Peers: `pptsx >=1.0.0`, `@pptsx/ds-kit >=0.2.0`.

## 0.1.0 — M17

Extraído do núcleo do pptsx: `tokens`, `theme`, `CoverLayout`/`ContentLayout`/`ClosingLayout`, `Bullets`/`KpiCard`/`KpiRow`/`TwoColumn` (com `defineComponent`, variantes, slots e casos de catálogo), regras `ds-base/colors-from-tokens`, `fonts-from-theme`, `kpi-row-max-4`, `cover-only-first`, guia (`guide/*.md`), schema gerado, fixtures do catálogo e os exemplos (demo, vitrine, galeria, texto, dados, arquitetura, arquivo). Peers: `pptsx >=0.7.0`, `@pptsx/ds-kit >=0.1.0`.
