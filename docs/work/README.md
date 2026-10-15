# Como o trabalho é organizado

```
docs/
├── spec.md                 # o quê (produto)
└── work/
    ├── README.md           # este arquivo: como (processo)
    ├── CONTRACTS.md        # API de cada módulo + regras de comportamento
    ├── BOARD.md            # status de todas as tarefas (única fonte de status)
    ├── milestones/M1..M5.md# tarefas refinadas, dependências e ondas paralelas
    └── reports/            # relatórios dos agentes de validação (Mx-visual.md)
```

Contratos em código: `src/core/types.ts` (tipos) e `src/core/defaults.ts` (padrões). Convenções: `CLAUDE.md`.

## Papéis

| Papel | Quem | Faz | Não faz |
|---|---|---|---|
| Orquestrador | sessão principal | contratos, divisão de tarefas, integração, revisão, commits, conversa com o dono | — |
| Coder | subagente Opus | implementa a pasta que possui, seguindo CONTRACTS.md | testes, `src/core/*`, pastas de outros |
| Tester | subagente Opus | escreve testes em `tests/` a partir dos **contratos** (não da implementação) | código de `src/` |
| Visual | subagente Opus | gera o build, inspeciona PNGs (nativo e Keynote), escreve `reports/Mx-visual.md` | código |

## Fluxo de um marco

1. **Refinar** — orquestrador revisa `milestones/Mx.md`, ajusta contratos se preciso.
2. **Onda A (paralela)** — coders (um por pasta) + tester, ao mesmo tempo. Ninguém compartilha arquivo.
3. **Integração** — orquestrador (ou coder dedicado) liga as peças em `render.ts`/`cli.ts`, roda `typecheck` + `test`, despacha correções para o dono do módulo.
4. **Validação visual** — agente visual roda o build e reporta.
5. **Gate** — orquestrador atualiza BOARD, faz commit `feat(mx): ...` e **para para mostrar ao dono**.

## Regras de paralelismo

- Uma pasta tem um único dono por onda. A coluna **Dono** de cada tarefa lista exatamente os caminhos que ela pode editar.
- Dependência entre tarefas da mesma onda só via contrato (tipos de `core/`), nunca via código ainda não escrito.
- Teste que falha por divergência de interpretação do contrato: o orquestrador decide quem está certo e corrige o contrato **ou** o código/teste.

## Validação visual

- Preview nativo: `dist/<deck>.<size>.overview.png` e `dist/<deck>.<size>/slide-NN.png`.
- Renderizador real: `scripts/keynote-export.sh dist/x.pptx dist/keynote/x` (abre o Keynote via AppleScript e exporta PNGs).
- PowerPoint: só o dono valida (go/no-go do M3).

## O que entra no núcleo (M17)

O repositório é um monorepo: `packages/pptsx` (núcleo), `packages/ds-kit` (`@pptsx/ds-kit`) e `packages/ds-base` (`@pptsx/ds-base`).

- **Critério:** se uma funcionalidade só faz sentido com uma marca, **não entra no núcleo**. Tokens, tema pronto, layouts de slide e componentes são de um DS. O núcleo tem primitivas, CSS, layout, ajuste, diagnósticos, arquivo PPTX (inclusive o *contrato* `Theme` e `defineLayout`, que são recursos do arquivo), CLI, lint da engine, preview, MCP e os ganchos.
- **Gancho, não exceção:** se o núcleo precisa saber o nome de um componente para funcionar, falta um gancho genérico (`defineComponent`, `LintRule`, `renderFragment`, `defineDs`…). Um DS nunca importa `pptsx/src/...`; o que ele precisar e for genérico vira API pública do núcleo (como `mapResponsive`, `toHexColor`, `buildOverview` no M17).
- **Ferramenta de DS** (útil para qualquer marca, mas não para o render) vai para o `ds-kit`.

## Como um DS evolui

- **Props de componente seguem semver** do pacote do DS: prop nova opcional = minor; prop removida, renomeada ou com padrão diferente = major. O `schema` gerado (`npm run schema` no `ds-base`) mostra a mudança no diff.
- **As fixtures do catálogo são o contrato visual:** `pptsx-ds catalog ds.ts --check --fixtures fixtures` roda na CI; diferença acima de 1 pt falha. Mudança visual intencional = regravar as fixtures no mesmo commit, com a explicação no relatório (e, se for de comportamento, major).
- **Regras de lint do DS** têm id com o prefixo do DS (`ds-base/…`); severidade mais alta ou regra nova que acusa decks existentes = minor com nota no CHANGELOG do DS.
- O núcleo tem versão própria; um DS declara `pptsx` como peer (`>=` a versão cujos ganchos usa).
