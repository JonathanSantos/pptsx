# Roadmap pós-MVP — M6 a M10

Origem: `docs/work/reports/REVIEW-2026-10-13.md`. Cada marco segue o fluxo de `docs/work/README.md` (refinar → onda paralela → integração → validação → gate). As regras do `CLAUDE.md` continuam valendo: `src/core/*` só pelo orquestrador (tarefa `Mx-0`), um dono por pasta por onda, testes só pelo tester.

| Marco | Tema | Por que primeiro | Paraleliza com |
|---|---|---|---|
| [M6](M6.md) | Diagnósticos que apontam a causa; shrink por busca binária; piso de legibilidade | Maior impacto por esforço: só mexe em `fit/` e corta pela metade as iterações de um agente | M7 |
| [M7](M7.md) | Pacote publicável, `init`, `--watch`, `lineBreaks`, limpezas | Hoje ninguém consegue instalar e usar fora do repo | M6 |
| [M8](M8.md) | Rich text, NBSP/`nowrap`, `align="baseline"`, fontes do sistema e embed | Limitação mais sentida ao escrever slides reais | — (depende de M6 e M7) |
| [M9](M9.md) | Props responsivas por breakpoint; slide de continuação | Tira os ternários do deck e resolve listas longas | — (depende de M8) |
| [M10](M10.md) | `Chart` e `Table` nativos | Fecha a promessa de "tudo editável" | — (depende de M9) |
| [M11](M11.md) | Motor CSS (adoção da PoC): box model, grid, z-index, herança | DX: agentes e devs escrevem CSS; nós −26 % na demo | — (depende de M10) |

```
M6 ‖ M7  ─▶  M8  ─▶  M9  ─▶  M10  ─▶  M11
```

## Exploração proposta

| Item | Onde | Estado |
|---|---|---|
| PoC: motor de layout "como um browser" em memória (box model, display, flex completo, grid, z-index, herança) com de/para para PPTX | [`../poc/browser-layout.md`](../poc/browser-layout.md) | aprovada (14/10) → [M11](M11.md) |

## Pendências do dono (não bloqueiam os marcos, mas valem antes de publicar)

| Item | Onde | Marco que depende |
|---|---|---|
| Validar calibração no PowerPoint e Google Slides (`dist/calib/final2/calibration.16x9.pptx`) | relatório `docs/work/reports/M3-calibration.md` | M8-F repete a calibração com rich text |
| Decidir o nome do pacote (`pptsx` confunde com o runner `tsx`) | `package.json`, `jsxImportSource`, docs | M7-0 |
| ~~Fontes embutidas~~ → PowerPoint usa EOT (spike M8-S, teste do dono); opção `embedFonts` desligada por padrão | — | ✅ |

## Critérios de sucesso do roadmap

- [x] Um deck fora do repo, num projeto com `npm install pptsx`, gera .pptx com `npx pptsx build`. → M7-G: tarball instalado do zero, `init` + `build` exit 0, PNGs idênticos aos do repo.
- [x] O `broken.tsx` original do LOG (restaurado em M6-E) é corrigido por um agente virgem em **≤ 3 builds** (hoje: 7). → M6-H: exit 0 sem warning no 2º build.
- [x] `demo.tsx` reescrito com props responsivas não tem nenhum ternário sobre `ctx` fora de `defineDeck`. → M9-D/E: nenhum `ctx.` na demo; 15 PNGs byte a byte iguais aos de antes.
- [x] Um slide com 12 bullets longos vira dois slides automaticamente, sem diagnóstico `error`. → M9-E: `long-list.tsx` vira 2 slides em 4x3 (6/6) e 3 em 16x9 (4/4/4), só `slide-continued` (info).
- [x] O gráfico da demo é um gráfico nativo editável no PowerPoint. → M10-H: nativo e editável no Keynote (`count of charts` = 1); PowerPoint pelo dono.
- [ ] `npm test` continua verde em cada gate; nenhum marco reduz a cobertura dos contratos.
- [x] **M11:** `src/` é o motor CSS; `poc/` removido; demo antiga (aliases) ±1 pt das fixtures; calibração 34/34 e 30/30 no Keynote; agente virgem com grid + margin + wrap em 3 builds (1º já sem erro). → gate M11.
