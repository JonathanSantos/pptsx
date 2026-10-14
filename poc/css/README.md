# PoC CSS — motor de layout "como um browser", em memória

Spec: `docs/work/poc/browser-layout.md`. Relatório e números: `docs/work/reports/POC-css.md`.
A engine de `src/` não muda; a PoC importa de lá o que reaproveita.

## Rodar

```bash
npx tsx poc/css/cli.ts build examples/demo.tsx --size 16x9,4x3 --out out/
npm run poc:test
npx tsx poc/css/bench.ts 5 demo
```

A CLI aceita os mesmos argumentos de `pptsx build` (menos `--watch`/`init`/`--embed-fonts`).
Decks da PoC importam de `poc/css/index.ts`; decks de `examples/` (que importam `pptsx`) rodam sem mudança.

## Estrutura

| Pasta | O que é | Relação com `src/` |
|---|---|---|
| `resolve/` | cascata: shorthands, nomes antigos como açúcar, herança de texto, `display: none` | path, componentes, responsivo e validação importados de `src/resolve` |
| `layout/` | Yoga com `useWebDefaults(true)`, box model completo, block com colapso de margens, `order` | cópia adaptada de `src/layout` (baseline, tabela) |
| `text/` | medidor com `letterSpacing` | delega ao fontkit de `src/text` quando não há espaçamento |
| `fit/` | ajuste e diagnósticos + `css-not-emitted` | cópia de `src/fit` com os tipos da PoC |
| `paint.ts` | ordem de pintura (z-index) e transformações herdadas | novo |
| `emit/`, `preview/` | pintura CSS (fundo, bordas por lado, sombra, opacity, rotate) | construtores de opções/SVG importados de `src/emit` e `src/preview` |

## O que o autor escreve

Ver o guia de 1 página (P3). Até lá: as primitivas aceitam CSS em camelCase (números = pt, `'px'` = pt),
`style={{ … }}` como escape, e os nomes antigos (`direction`, `align`, `justify`, `grow`, `shrink`, `fill`,
`stroke`, `radius`, `size`, `weight`…) continuam valendo.
