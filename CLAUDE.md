# pptsx — engine TSX → PPTX

Spec do produto: `docs/spec.md`. Organização do trabalho: `docs/work/README.md`. Próximos marcos: `docs/work/milestones/ROADMAP.md`.
Contratos entre módulos: `packages/pptsx/src/core/types.ts` (tipos) + `docs/work/CONTRACTS.md` (funções e regras).

Monorepo (npm workspaces, M17): `packages/pptsx` (núcleo), `packages/ds-kit` (`@pptsx/ds-kit`), `packages/ds-base` (`@pptsx/ds-base`); e `packages/pptsx-rs`, o port em Rust do núcleo (workspace Cargo na raiz), que reproduz a saída do TS e tem a mesma versão. Caminhos de código abaixo (`src/…`, `tests/…`, `examples/…`) são relativos ao pacote. **Se uma funcionalidade só faz sentido com uma marca, não entra no núcleo**; se o núcleo precisa do nome de um componente, falta um gancho. Os DS usam só a API pública de `pptsx` (nada de `pptsx/src/...`).

## Regras invioláveis

- **Não altere `packages/pptsx/src/core/*`** (types, defaults, assets). Se o contrato não serve, pare e reporte ao orquestrador com a proposta de mudança.
- **Só edite os arquivos/pastas que a sua tarefa possui** (coluna "Dono" no marco). Outros agentes trabalham em paralelo.
- Testes ficam em `tests/` espelhando `src/` e são escritos pelo agente de testes. Agente de código não escreve testes (pode rodar os existentes).
- Antes de concluir: `npm run typecheck` e `npm test` sem erro nos seus arquivos.
- **`packages/pptsx-rs` segue o TS, nunca o contrário.** Mudou algo no núcleo que altera a saída (XML, diagnósticos, lint), o Rust acompanha no mesmo PR ou a mudança fica registrada em `packages/pptsx-rs/README.md` ("Ainda não"). As fixtures de `packages/pptsx-rs/fixtures/` vêm do TS (`packages/pptsx-rs/scripts/golden.sh`) e são comparadas por `cargo test`; o CI acusa fixture velha.

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

- `npm test` — vitest (na raiz: os três pacotes; dentro de um pacote: só ele)
- `npm run typecheck` — tsc
- `cargo test` / `cargo clippy --release -- -D warnings` — o port em Rust (na raiz); `packages/pptsx-rs/scripts/golden.sh` regenera as fixtures com o TS
- `node packages/pptsx/bin/pptsx.mjs build <deck.tsx> --size 16x9,4x3 --out dist/`
- `node packages/ds-kit/bin/pptsx-ds.mjs catalog packages/ds-base/src/ds.ts --out dist/catalog` — catálogo de um DS (`--check` compara com as fixtures)
- `scripts/keynote-export.sh <arquivo.pptx> <pasta-saida>` — exporta slides via Keynote (validação visual real)
