# Roadmap pós-MVP — M6 a M10

Origem: `docs/work/reports/REVIEW-2026-10-13.md`. Cada marco segue o fluxo de `docs/work/README.md` (refinar → onda paralela → integração → validação → gate). As regras do `CLAUDE.md` continuam valendo: `src/core/*` só pelo orquestrador (tarefa `Mx-0`), um dono por pasta por onda, testes só pelo tester.

| Marco | Tema | Por que primeiro | Paraleliza com |
|---|---|---|---|
| [M6](M6.md) | Diagnósticos que apontam a causa; shrink por busca binária; piso de legibilidade | Maior impacto por esforço: só mexe em `fit/` e corta pela metade as iterações de um agente | M7 |
| [M7](M7.md) | Pacote publicável, `init`, `--watch`, `lineBreaks`, limpezas | Hoje ninguém consegue instalar e usar fora do repo | M6 |
| [M8](M8.md) | Rich text, NBSP/`nowrap`, `align="baseline"`, fontes do sistema e embed | Limitação mais sentida ao escrever slides reais | — (depende de M6 e M7) |
| [M9](M9.md) | Props responsivas por breakpoint; slide de continuação | Tira os ternários do deck e resolve listas longas | — (depende de M8) |
| [M10](M10.md) | `Chart` e `Table` nativos | Fecha a promessa de "tudo editável" | — (depende de M9) |

```
M6 ‖ M7  ─▶  M8  ─▶  M9  ─▶  M10
```

## Pendências do dono (não bloqueiam os marcos, mas valem antes de publicar)

| Item | Onde | Marco que depende |
|---|---|---|
| Validar calibração no PowerPoint e Google Slides (`dist/calib/final2/calibration.16x9.pptx`) | relatório `docs/work/reports/M3-calibration.md` | M8-F repete a calibração com rich text |
| Decidir o nome do pacote (`tsx-slides` confunde com o runner `tsx`) | `package.json`, `jsxImportSource`, docs | M7-0 |
| Decidir se fontes embutidas no .pptx são desejadas (tamanho do arquivo × portabilidade) | spike M8-S | M8-D |

## Critérios de sucesso do roadmap

- [ ] Um deck fora do repo, num projeto com `npm install <pacote>`, gera .pptx com `npx <pacote> build`.
- [x] O `broken.tsx` original do LOG (restaurado em M6-E) é corrigido por um agente virgem em **≤ 3 builds** (hoje: 7). → M6-H: exit 0 sem warning no 2º build.
- [ ] `demo.tsx` reescrito com props responsivas não tem nenhum ternário sobre `ctx` fora de `defineDeck`.
- [ ] Um slide com 12 bullets longos vira dois slides automaticamente, sem diagnóstico `error`.
- [ ] O gráfico da demo é um gráfico nativo editável no PowerPoint.
- [ ] `npm test` continua verde em cada gate; nenhum marco reduz a cobertura dos contratos.
