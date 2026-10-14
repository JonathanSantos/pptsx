# Board

Legenda: ⬜ a fazer · 🔄 em andamento · ✅ feito · ⛔ bloqueado

| Marco | ID | Tarefa | Status |
|---|---|---|---|
| M1 | M1-0 | Scaffold, contratos, docs | ✅ |
| M1 | M1-A | JSX + primitivas + resolve | ✅ |
| M1 | M1-B | sizes + layout absoluto | ✅ |
| M1 | M1-C | emit pptx | ✅ |
| M1 | M1-D | testes M1 | ✅ |
| M1 | M1-E | integração + hello.tsx | ✅ |
| M1 | M1-F | validação visual (Keynote: passa, erro ≤ 1 px) | ✅ |
| M2 | M2-A | layout Yoga + medidor estimado | ✅ |
| M2 | M2-B | preview SVG/PNG/overview | ✅ |
| M2 | M2-C | testes M2 (358 testes) | ✅ |
| M2 | M2-D | integração + layout-test.tsx | ✅ |
| M2 | M2-E | validação visual (nativo × Keynote ≤ 1 pt) | ✅ |
| M3 | M3-A | registro de fontes + medidor fontkit | ✅ |
| M3 | M3-B | emissão neutra com estratégia de espaçamento | ✅ |
| M3 | M3-C | calibration.tsx (34 amostras) | ✅ |
| M3 | M3-D | testes M3 (421 testes) | ✅ |
| M3 | M3-E | integração do medidor real | ✅ |
| M3 | M3-F | calibração nativo × Keynote: 'exact' + safety 0.97 | ✅ |
| M3 | M3-G | quebra forçada (<a:br/>) + quebra após - e / | ✅ |
| M3 | M3-H | testes quebra forçada (455 testes) | ✅ |
| M3 | gate | GO no Keynote (quebras idênticas); PowerPoint pendente com o dono | ✅ |
| M4 | M4-A | fit: detecção, loop, políticas, diagnósticos | ✅ |
| M4 | M4-B | preview: estouro de texto no debug + selos | ✅ |
| M4 | M4-C | testes M4 (531 testes) | ✅ |
| M4 | M4-D | integração + overflow.tsx + resumo/exit code na CLI | ✅ |
| M4 | M4-E | validação visual (Keynote: nenhum corte silencioso) | ✅ |
| M5 | M5-0 | lang (pt-BR) + contrato de CLI e componentes | ✅ |
| M5 | M5-A | CLI completa + config | ✅ |
| M5 | M5-B | tokens, layouts, componentes, demo.tsx | ✅ |
| M5 | M5-C | AGENT_GUIDE.md | ✅ |
| M5 | M5-D | testes M5 | ✅ |
| M5 | M5-E | validação visual 16x9 + 4x3 + wide | ✅ |
| M5 | M5-F | teste do agente virgem (2 tarefas, exit 0) | ✅ |
| M5 | M5-G | fixes de engine: palavra partida, grow em column | ✅ |
| M5 | M5-H | polimento do demo; KpiCard size/sentiment | ✅ |
| M5 | M5-I | testes finais (685) | ✅ |
| — | FINAL | relatório: docs/work/reports/FINAL.md | ✅ |
| M6 | M6-0 | Contrato: causa, agrupamento, `widestSegment`, `minLegibleSize`, `text-illegible` | ✅ |
| M6 | M6-A | fit: atribuição de causa + agrupamento de diagnósticos | ✅ |
| M6 | M6-B | fit: shrink por busca binária, passo por largura, piso de legibilidade, supressão com fonte ausente | ✅ |
| M6 | M6-C | CLI: resumo agrupa derivados sob a causa | ✅ |
| M6 | M6-D | testes M6 | ✅ |
| M6 | M6-E | `broken-original.tsx` (do LOG) + `probe/cause.tsx` | ✅ |
| M6 | M6-F | AGENT_GUIDE §4/§8/§9 | ✅ |
| M6 | M6-G | validação visual (overflow, cause, broken-original) | ✅ |
| M6 | M6-H | agente virgem: broken-original em ≤ 3 builds (exit 0 sem warning no 2º) | ✅ |
| M7 | M7-0 | Nome do pacote (dono); `lineBreaks`, `includePositioned`, `core/dispatch.ts` | ✅ |
| M7 | M7-A | build `dist/` + `exports` + bin compilado + fontes no pacote | ✅ |
| M7 | M7-B | CLI `init`, `--watch`, `--line-breaks`; config `lineBreaks` | ✅ |
| M7 | M7-C | emit `lineBreaks: 'auto'`; `render` devolve `positioned` | ✅ |
| M7 | M7-D | limpezas: `dispatch()`, vitest sem esbuild, sanitize com teste de propriedade | ✅ |
| M7 | M7-E | testes M7 + `test:package` (npm pack fora do repo) | ✅ |
| M7 | M7-F | README do pacote + AGENT_GUIDE §7 | ✅ |
| M7 | M7-G | validação: pacote fora do repo no Keynote; auto × forced (10/34 divergem, 0 vazam) | ✅ |
| M8 | M8-S | spike: embed de fontes — Keynote ignora; PowerPoint web usa EOT (F ≠ A, glifos da Liberation); TTF cru/ofuscado recusados | ✅ |
| M8 | M8-0 | Contrato: `Span/B/I`, `TextRun`, `lineRuns`, `nowrap`, `align="baseline"`, `FontFace` sem `file`, `embedFonts` | ✅ |
| M8 | M8-A | resolve: runs | ✅ |
| M8 | M8-B | text: quebra com runs, NBSP como glue, `nowrap` | ✅ |
| M8 | M8-C | layout: baseline, `nowrap` min width | ✅ |
| M8 | M8-D | fontes do sistema + embed | ✅ |
| M8 | M8-E | emit/preview: run por linha, tspan, embed no zip | ✅ |
| M8 | M8-F | testes M8 | ✅ |
| M8 | M8-G | exemplos: Bullets por baseline, `calibration-rich.tsx`, demo com negrito inline; AGENT_GUIDE | ✅ |
| M8 | M8-H | calibração rich text nativo × Keynote: 29/30 quebras iguais, estilos no mesmo caractere, largura ±0,07 pt; baseline ±0,25 pt; Helvetica `.ttc` ok; embed EOT no zip (Keynote ignora) | ✅ |
| M9 | M9-0 | Contrato: `Responsive<T>`, breakpoints, `resolveDeck(root, ctx)`, `paginate`, `slide-continued` | ✅ |
| M9 | M9-A | resolve: valores responsivos; `ctx.pick` | ✅ |
| M9 | M9-B | fit: paginação no nível do deck (`fitDeck`, bisseção em k, clones, `slide-continued`) | ✅ |
| M9 | M9-C | testes M9 (+142; referência posicionada da demo em `tests/examples/__fixtures__`) | ✅ |
| M9 | M9-D | exemplos sem ternário (demo pixel a pixel igual); `TwoColumn direction` responsivo; `Bullets paginate`; `long-list.tsx` (16x9: 4/4/4, 4x3: 6/6); AGENT_GUIDE | ✅ |
| M9 | M9-E | validação visual (demo antes × depois ≤ 1 pt; long-list) | ⬜ |
| M9 | M9-F | agente virgem: deck com breakpoints e paginate | ⬜ |
| M10 | M10-S | spike: `addChart`/`addTable` no Keynote/PowerPoint | ⬜ |
| M10 | M10-0 | Contrato: `Chart`, `Table`, `PositionedTable`, `table-overflow` | ⬜ |
| M10 | M10-A | resolve + primitivas | ⬜ |
| M10 | M10-B | layout: Chart folha, Table com measure func | ⬜ |
| M10 | M10-C | fit: Table no shrink; `table-overflow` | ⬜ |
| M10 | M10-D | emit: addChart, addTable | ⬜ |
| M10 | M10-E | preview: SVG de gráfico e tabela | ⬜ |
| M10 | M10-F | testes M10 | ⬜ |
| M10 | M10-G | demo com Chart e Table; `charts.tsx`; AGENT_GUIDE | ⬜ |
| M10 | M10-H | validação visual + PowerPoint pelo dono | ⬜ |

Roadmap pós-MVP: `docs/work/milestones/ROADMAP.md` (origem: `docs/work/reports/REVIEW-2026-10-13.md`).

## Backlog / observações

| Origem | Item | Destino |
|---|---|---|
| M1-F | Texto sai com `lang="en-US"`; expor idioma (padrão pt-BR) | ✅ `RenderOptions.lang` |
| M1-F | `chart.png` tem fundo igual ao da caixa; criar asset de teste com fundo contrastante | M2-D |
| M1-B | Layout provisório ignora altura medida de Text em fluxo | M2-A (Yoga substitui) |
| M1-C | `Shape kind="line"` sem `stroke` fica invisível; definir cor padrão? | decidir no M2 |
| M1-F | Alt text da imagem vazava o caminho absoluto | ✅ corrigido (basename) |
| M2-A | Decidido: shrink padrão 1; grow={n} = flex: n (basis 0) | ✅ core/defaults + contrato |
| M2-D | Image com grow não trava proporção (contain ≠ cover) | ✅ corrigido; falta teste do eixo cruzado → M3-D |
| M1-C | Line sem stroke usa preto (`DEFAULTS.lineStroke`) | ✅ |
| M2-E | Keynote exporta em Display P3; converter para sRGB no script de export | M3 (antes da calibração) |
| M2-E | Debug: marcar linha de texto que passa do frame | M4-B |
| M3 | Decisão do dono: quebra forçada (linhas calculadas emitidas com <a:br/>) | ✅ |
| M3-G | pptxgenjs repete <a:pPr> após <a:br/> (inválido no schema) → `src/emit/sanitize.ts` pós-processa | ✅; falta teste unitário → M4-C |
| M3-F | Validar no PowerPoint e Google Slides (dono): dist/calib/final2/calibration.16x9.pptx | dono |
| M4-A | Aprovado: altura disponível do Text = frame recortado pela área de conteúdo do pai | ✅ contrato |
| M4-A | box-overflow + out-of-slide podem sair juntos para a mesma causa (fatos distintos) | aceito |
| M4-D | Shapes com width fixo encolhem (shrink 1, como CSS); para tamanho rígido use shrink={0} | documentar no AGENT_GUIDE (M5-C) |
| M4-E | Mensagens: eixo/conta no box-overflow, lado no out-of-slide, linhas ocultas no truncate; sem duplicatas | ✅ |
| M6-H | Valor de KPI em várias linhas ("R$ / 52,4 / mi") sai com exit 0 e sem aviso | M8 (`nowrap` + NBSP); sugerir "unidade no rótulo" na mensagem de `text-word-broken` |
| M6-G | `--debug` pinta estouro em vermelho num Text com fonte ausente, embora o JSON o suprima | M7-D ou M8-E (preview lê `fontMissing`) |
| M6-G | Mesmo Text pode receber `text-shrunk` e `text-illegible` | aceito (info + warning dizem coisas diferentes) |
| M6-H | Agrupamento esconde que um `KpiCard` ficou maior → resolvido no gate (identidade inclui from/to) | ✅ |
| M7-G | `npm publish` bloqueado por `private: true` / `version 0.0.0`; decisão do dono | dono |
| M7-G | `npm audit`: 3 high em `image-size` via pptxgenjs, sem fix upstream | acompanhar |
| M7-G | `init` regrava tsconfig existente sem preservar comentários (JSONC) | aceito |
| M7-B | `WATCH_DEBOUNCE_MS` vive em `src/cli/watch.ts`, não em `DEFAULTS` | mover no próximo Mx-0 |
| M7-B | Cada rebuild do watch cria um grafo novo (memória cresce durante sessões longas) | aceito |
| M8-S | pptxgenjs grava `<p:sldIdLst>` antes de `<p:notesMasterIdLst>` (fora da ordem do schema CT_Presentation); PowerPoint pode pedir "reparar" | M8-E: reordenar em `sanitize.ts` |
| M8-S | Keynote descarta `ppt/fonts/` e `embeddedFontLst`; PowerPoint web usa EOT → embed implementado como opção (`embedFonts`) | ✅ M8-D/E |
| M8-H | `nowrap` saía com `wrap="square"`: Keynote requebrava a linha que estourou (R20) → `wrap="none"` no gate | ✅ gate M8 |
| M8-H | `font-missing` dizia "não está registrada" mesmo para face registrada sem `file` e ausente no sistema → mensagem reescrita no gate | ✅ gate M8 |
| M8-H | `text-truncated` agrupado (R24/R25) mostra só os números do pior caso | aceito (regra do contrato: mensagem do pior + ×N) |
| M8-H | Baseline entre Text 40 pt e Text 12 pt desvia ~1,25 pt no Keynote (deslocamento da 1ª linha varia com o size, M3) | aceito; anotar no guia se virar queixa |
| M8-H | Scripts de Keynote: outra sessão (skill-ppt) travou o app; `scripts/keynote-export.sh` não tem retry nem trava de máquina | backlog: retry em -1712/-609 |
| M9-D | Não dá para "desligar" uma prop num breakpoint (`{ base: '100%', tall: undefined }` cai para base; `base: undefined` não compila) | aceito; guia documenta; candidato a M9+ (`null` = ausente) |
| M9-D | `paginate` numa row divide os itens em colunas (não é erro) | documentado como armadilha no guia |
| M9-D | Combinar dois valores responsivos numa prop (ex.: `ratio` + `direction`) não tem forma exata; `TwoColumn.ratio` ficou `number` | aceito |
