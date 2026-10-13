# tsx-slides — engine TSX → PPTX (MVP)

Spec do produto: `docs/spec.md`. Organização do trabalho: `docs/work/README.md`.
Contratos entre módulos: `src/core/types.ts` (tipos) + `docs/work/CONTRACTS.md` (funções e regras).

## Regras invioláveis

- **Não altere `src/core/*`** (types, defaults, assets). Se o contrato não serve, pare e reporte ao orquestrador com a proposta de mudança.
- **Só edite os arquivos/pastas que a sua tarefa possui** (coluna "Dono" no marco). Outros agentes trabalham em paralelo.
- Testes ficam em `tests/` espelhando `src/` e são escritos pelo agente de testes. Agente de código não escreve testes (pode rodar os existentes).
- Antes de concluir: `npm run typecheck` e `npm test` sem erro nos seus arquivos.

## Convenções de código

- TypeScript ESM, Node 20+. Imports relativos com extensão `.ts` (`import { x } from './y.ts'`).
- Programação funcional: funções puras, dados `readonly`/imutáveis, sem classes salvo necessidade real (ex.: erro customizado).
- Early return e guard clauses; nada de `if` aninhado profundo. Funções pequenas com um propósito.
- Toda etapa do pipeline é pura: árvore entra, árvore sai. IO (ler arquivo, fonte, imagem) só nas bordas (`render.ts`, `cli.ts`, fábricas como `createFontRegistry`).
- Dependências externas injetadas (ex.: `LayoutEnv`), nunca importadas no meio de uma função pura.
- Design patterns só onde encaixam: Strategy (medidores de texto, políticas de overflow), tabela de despacho por `kind` (emissores), Factory (`definePrimitive`, `create*`).
- Padrões numéricos e de props vêm de `src/core/defaults.ts`; nunca repita números mágicos.
- Unidade interna: pt (1 pol = 72 pt). Conversão para polegadas só no emissor PPTX; para px só no preview.
- Identificadores em inglês; comentários em português e só para explicar o **porquê**.
- Cada pasta de `src/` expõe sua API pública por `index.ts`; o resto é interno.
- Sem `any` exceto onde o contrato já declara (`Component<P = any>`).

## Comandos

- `npm test` — vitest
- `npm run typecheck` — tsc
- `npx tsx src/cli.ts build examples/demo.tsx --size 16x9,4x3 --out dist/`
- `scripts/keynote-export.sh <arquivo.pptx> <pasta-saida>` — exporta slides via Keynote (validação visual real)
