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
| [M12](M12.md) | Formas, conectores e ícones: diagramas nativos | Maior buraco para "interfaces": só 4 formas e nenhum ícone | sequencial (sem onda) |
| [M13](M13.md) | Texto e tipografia: pesos numéricos, sobrescrito, links, continuação de texto, número de slide | Texto é 80 % do slide; cinco buracos práticos | sequencial (sem onda) |
| [M14](M14.md) | Gráficos e tabelas 2: barra horizontal/empilhada, área, doughnut, scatter, combo; merges, estilo por célula, `Table paginate` | Último buraco grande de conteúdo | sequencial |
| [M15](M15.md) | Arquivo e tema: cores e fontes do tema, seções, slide oculto, notas formatadas, propriedades, masters opt-in | Arquivo editável de verdade no PowerPoint | sequencial |
| [M16](M16.md) | Dívidas do motor, visão única do nó, servidor MCP, preview ao vivo, lint/codemod, CI; candidata a 1.0 | Prepara a 1.0 e muda o canal de uso (agentes sem shell) | sequencial |

```
M6 ‖ M7  ─▶  M8  ─▶  M9  ─▶  M10  ─▶  M11  ─▶  M12  ─▶  M13  ─▶  M14  ─▶  M15  ─▶  M16
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
- [x] **M16:** BOARD sem backlog aberto de M6–M15 (cada linha restante com decisão); agente só com o `pptsx-mcp` corrigiu o `broken.tsx` com 1 `build`; `preview --serve` atualiza em < 1 s depois de salvar (teste de ponta a ponta com o bin e `fs.watch`) e destaca o nó pelo path; `lint --fix` migra o `broken-original.tsx` com os mesmos paths e frames ±1 pt; CI escrito (sem remoto configurado, ainda não rodou no GitHub). Candidata a 1.0 depois da validação do dono no PowerPoint.
- [x] **M15:** demo com o tema dos tokens idêntica no Keynote e repintada ao trocar só `accent1`; `arquivo.tsx` com masters Capa/Conteúdo importados pelo Keynote (faixa e assinatura no master, título ligado ao placeholder), slide oculto pulado, notas em dois parágrafos; demo sem layouts com XML idêntico ao de antes; agente virgem com tema, seções, oculto e notas em 1 build, 0 diagnóstico. PowerPoint (seletor de cores, seções, Redefinir/Novo slide, notas formatadas) pelo dono.
- [x] **M14:** `graficos.tsx` (12 kinds, 10 gráficos nativos no Keynote, combo com eixo secundário) e `tabelas.tsx` (cabeçalho duplo mesclado, rowSpan, cor por valor com `cell()`, ícones e rich text, 40 linhas paginadas com cabeçalho repetido) sem error/warning e iguais ao preview no Keynote; agente virgem com dashboard empilhado + tabela por valor em 2 builds, 0 diagnóstico. PowerPoint (combo com eixo secundário, merges, formatos de eixo) pelo dono.
- [x] **M13:** `relatorio.tsx` (3 slides → 6 por continuação, notas em sobrescrito com link, Inter 300/600, "n / 6" em todos) sem error/warning e com as mesmas linhas no Keynote; calibração 34/34 e rica 43/43 (30 + 13 novas); pesos certos com a Inter instalada; agente virgem com relatório de 2 páginas no 1º build. PowerPoint (links, numeração, pesos embutidos) pelo dono.
- [x] **M12:** fluxo.tsx e arquitetura.tsx sem diagnóstico, Keynote ±1 pt nos nós (16:9 e 4:3), tudo nativo (ícone raster só com aviso); agente virgem com fluxograma de 5 nós em 1 build. PowerPoint pelo dono.
- [x] **M11:** `src/` é o motor CSS; `poc/` removido; demo antiga (aliases) ±1 pt das fixtures; calibração 34/34 e 30/30 no Keynote; agente virgem com grid + margin + wrap em 3 builds (1º já sem erro). → gate M11.
