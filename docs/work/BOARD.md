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
| M9 | M9-E | visual: demo antes × depois byte a byte igual (15 PNGs, 3 tamanhos; Keynote idêntico ao M8); long-list 3 partes (4/4/4) em 16x9 e 2 (6/6) em 4x3 no Keynote; breakpoints corretos | ✅ |
| M9 | M9-F | agente virgem: deck de 4 slides com breakpoints, `ctx.pick` e `paginate` em 3 builds (1º já sem error/warning); 6 lacunas do guia aplicadas no gate | ✅ |
| M10 | M10-S | spike: Keynote respeita colW/rowH (±0,25 pt), margem em pol. como array, quebras por linha; **bug do `ref` no xlsx embutido deixa o slide vazio** → corrigido no sanitize | ✅ |
| M10 | M10-0 | Contrato: `ChartProps`, `TableProps`, `PositionedTable`, `table-overflow` | ✅ |
| M10 | M10-A | resolve + primitivas `Chart`/`Table` | ✅ |
| M10 | M10-B | layout: Chart folha flex; Table com measure (colunas → altura por célula) | ✅ |
| M10 | M10-C | fit: Table encolhe como unidade (Shrinkable); `table-overflow` | ✅ |
| M10 | M10-D | emit: addChart/addTable, correção do ref no xlsx, renumeração dos gráficos | ✅ |
| M10 | M10-E | preview: SVG de bar/line/pie e tabela | ✅ |
| M10 | M10-F | testes M10 (+158) | ✅ |
| M10 | M10-G | demo: Chart nativo no slide 3 e Table no slide 5; `charts.tsx`; `probe/table.tsx`; AGENT_GUIDE §3/§6/§8/§9 | ✅ |
| M10 | M10-H | Keynote: gráficos e tabelas nativos e editáveis (count of charts = 1, images = 0); linhas ±0,4 pt; paginação com tabelas 2/2/2 | ✅ |
| M11 | M11-0 | Contrato: tipos CSS no core, css-props, DEFAULTS.css, lineHeight CSS; CONTRACTS §M11; plano | ✅ |
| M11 | M11-A | resolve + primitivas: cascata, shorthands, herança, aliases | ✅ |
| M11 | M11-B | layout (Yoga web-defaults, grid) + text (letterSpacing, lineHeight CSS) | ✅ |
| M11 | M11-C | fit sobre o box model (borda/padding/margens, célula, wrap, css-not-emitted) | ✅ |
| M11 | M11-D | emit/preview: paint (zIndex, opacity, rotate), bordas por lado, sombra, decoração | ✅ |
| M11 | M11-E | testes da PoC em tests/; semânticas novas | ✅ |
| M11 | M11-F | exemplos em CSS, showcase, AGENT_GUIDE e README em CSS | ✅ |
| M11 | M11-G | Keynote: demo antiga = legada (exceto gráfico/tabela/ordem) e legada ≈ CSS (±1 pt); vitrine confere (bordas por lado, sombra, rotação, opacidade, camadas, grid, wrap, display responsivo); calibração 34/34 e 30/30 | ✅ |
| M11 | M11-H | agente virgem: deck de 4 slides com grid, herança, margin auto, wrap, zIndex e paginate em 3 builds (1º já exit 0); 3 lacunas do guia aplicadas | ✅ |
| M12 | M12-1 | contrato: ShapeKind curado, Path/Icon/Connector, id, Box shape, DEFAULTS.shape/path/icon/connector, 4 códigos | ✅ |
| M12 | M12-2 | 24 formas nativas, Box shape, flip, tracejado, setas, cap/join (pós-processamento); preview com fórmulas OOXML | ✅ |
| M12 | M12-3 | Path: subconjunto do d (arcos → cúbicas), custGeom, path-invalid | ✅ |
| M12 | M12-4 | Icon: SVG → formas (classificação conservadora, recolor) ou PNG + icon-rasterized; 12 ícones MIT | ✅ |
| M12 | M12-5 | Connector: roteamento pós-ajuste (auto, reta, cotovelo), pontas, rótulo, omitido entre partes | ✅ |
| M12 | M12-6 | guia (§3 diagramas, receitas 6.11–6.13, códigos, armadilhas), README, Keynote dos decks (±1 pt), agente virgem em 1 build; versão 0.2.0 | ✅ |
| M13 | M13-1…8 | pesos numéricos, sobrescrito/subscrito, `href`, `Text paginate`, `SlideNumber`/`footer`, fonte por Span (go/no-go), guia e validação (sequencial, plano em M13.md) | ⬜ |

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
| M9-E | `long-list.tsx` sem `notes` → `ContentLayout.notes` repassada ao Slide (gate) | ✅ gate M9 |
| M9-E | Linha da CLI não mostrava o slide do autor após paginação → `slide 5 (3 no deck)` (gate) | ✅ gate M9 |
| M9-E | Deck fora do cwd com tsconfig próprio falha com "React is not defined": `assertDeckTsconfig` valida o tsconfig da pasta do deck, mas `src/cli/loader.ts` compila com o do cwd | backlog: usar o tsconfig da pasta do deck (M10-0 ou correção isolada) |
| M10-G | Preview do gráfico mostra 4.0 como "4" e usa ponto decimal; o .pptx grava formatCode 0.0 e segue o idioma | backlog: preview formata com as casas dos dados e vírgula em pt-BR |
| M10-H | Soma dos rowH arredondados (0,5 pt) deixa a tabela até 0,4 pt × linhas mais alta no Keynote; pode estourar sem diagnóstico | M11-C: fit usa Σ rowH arredondados |
| M10-H | Preview do gráfico com ponto decimal e sem as casas do formatCode (Keynote: "38,2", "40,0") | M11-D: Intl.NumberFormat(lang) com as casas dos dados |
| M10-H | Eixo de valores herda `0.0` dos rótulos ("60,0") | M11-D: eixo com `General`; CONTRACTS §M10-D ajustado |
| M10-H | Pizza do Keynote menor que a do preview (175 × ~214 pt) | aceito; linha no guia |
| M10-H | Validação no PowerPoint pendente (dono): gráficos editáveis e ordem, sem reparo do xlsx, decimais pt-BR, alturas de linha | dono |
| M11-E | Tabela da demo cresce +2,8 pt (16x9) pelo arredondamento das linhas a 0,5 pt: intencional (altura emitida = altura do layout), fora do "±1 pt" do gate | aceito; gate reescrito: ±1 pt exceto linhas de tabela |
| M11-A | Cores hex saem em maiúsculas (`#RRGGBB`) em props e css; alpha de rgba() se perde em props que guardam só o hex (fill do Shape, Table, Chart) | aceito |
| M11-E | `calibration*.tsx` usam lineHeight numérico, cujo significado mudou: paridade XML byte a byte com a engine antiga deixou de valer; M11-G recalibra | M11-G |
| M11-D | Chart/Table dentro de caixa girada perdem a rotação herdada em silêncio (só o próprio `rotate` avisa) | backlog: avisar também pela rotação herdada |
| M11-F | `TwoColumn` ficou com `stacked?: Responsive<boolean>` (não `direction`, que é alias antigo); `KpiRow` em `repeat(n, minmax(0, 1fr))` porque `1fr` cresce até a palavra mais longa | documentado no guia §3/§9 |
| M11-B | Image com `width="100%"` + `maxHeight` mantém a proporção (diferença intencional em relação ao browser); em grid, Image sem tamanho não estica | CONTRACTS §M11 layout; guia §6.3 |
| M11-E | Paridade dos aliases roda sobre cópias congeladas dos decks antigos em `tests/examples/legacy/`; decks em CSS têm `css-positioned.json` | — |
| M11-G | 1ª baseline no Keynote com `lineHeight` numérico fica em ≈ 0,8 × ⌊spcPts⌋, não na meia-entrelinha: com 1.5 o texto desce até 2,3 pt (C07, C12, C24, C31); 1.2 fica em ±0,3 pt | M12: conferir no PowerPoint e, se igual, subir a caixa em 0,8·⌊lh⌋ − (ascent + meia-entrelinha); guia §4 avisa |
| M11-G | `spcPts` fracionário é truncado pelo Keynote (−0,4 a −0,8 pt/linha), como já valia para 'normal' desde o M3 | aceito; guia §4 |
| M11-G | Colunas livres da Table seguem o conteúdo (`table-layout: auto`): demo 16x9 256/141,4/141,4/101,2 (antes 128×3) | aceito; CONTRACTS §M10-B atualizado |
| M11-G | Validação no PowerPoint pendente (dono): regra 0,8 × espaçamento na calibração (C07, C12, C29–C31), bordas por lado, sombra, rotação, opacidade, camadas, display responsivo | dono |
