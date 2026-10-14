# PoC CSS — relatório

Spec: `docs/work/poc/browser-layout.md`. Código: `poc/css/` (guia em `poc/css/README.md`). A engine de `src/` não foi alterada; a única mudança fora de `poc/` é o script `npm run poc:test` no `package.json` da raiz.

---

## P0 — esqueleto

**Entregue**

- `poc/css/` com `package.json`, `tsconfig.json` (estende o da raiz), `vitest.config.ts` e `README.md` próprios. `npm run poc:test` = `tsc -p poc/css/tsconfig.json` + vitest da PoC; o `npm test` da raiz não enxerga a PoC.
- **Resolve com cascata** (`resolve/`): o resolve de `src/` (path, componentes, responsivo, validação de Chart/Table, paginate) importado peça a peça, com a normalização CSS no meio:
  - shorthands normalizados por lado: `margin`, `padding`, `inset` (1–4 valores ou o objeto da engine), `border`/`borderTop…` (`'2px solid #2F6FED'`), `borderWidth/Style/Color` (1–4 valores), `gap` (`'row col'`), `flex` (`1`, `'auto'`, `'none'`, `'1 0 120px'`), `placeItems/placeSelf`, `background`;
  - longhand vence shorthand qualquer que seja a ordem no objeto; `style={{…}}` vence as props;
  - herança de `fontFamily/fontSize/fontWeight/fontStyle/color/lineHeight/textAlign/letterSpacing/textTransform` do Slide/Box para os Text (Table herda família/size/cor/lineHeight; Chart, família e cor);
  - nomes antigos como açúcar: `direction/align/justify` (Box/Slide), `grow/shrink`, `fill` → `backgroundColor`, `stroke/strokeWidth` → contorno sem espaço (como `outline`), `radius` → `borderRadius`, `font/size/weight/italic/align` (Text);
  - `display: none` poda o nó depois do path calculado (irmãos mantêm `Box[1]`); responsivo vale em qualquer prop, inclusive dentro de `style`;
  - cada nó resolvido carrega `css` (estilo normalizado) e `props` na "visão da engine" (os mesmos nomes de `src/core/types.ts`), derivada do mesmo objeto, para o fit/emit/preview reaproveitados lerem.
- **Layout** (`layout/`): Yoga com `useWebDefaults(true)`, box-sizing border-box, `margin` (inclusive `auto`), `border` e `padding` por lado (inclusive em Text/Image/Table: o texto quebra na área de conteúdo), `flexWrap`, `flexBasis`, `order` (reordena o fluxo, não o path), `alignContent`, `rowGap/columnGap`, `position: relative/absolute` + `inset`, `transform: translate` (pós-layout, sem mexer nos irmãos), `display: block` (coluna esticada, filhos sem shrink, margens verticais de irmãos colapsando). Baseline e tabela copiados da engine.
- **Texto**: medidor fontkit da engine; com `letterSpacing ≠ 0` a largura soma o espaçamento por caractere (`text/measure.ts`); `textTransform` aplicado aos runs antes de medir; `Span` aceita `fontWeight/fontStyle/textDecoration`.
- **Fit**: cópia de `src/fit` com os tipos da PoC (adaptações da P2 ainda não feitas) + `css-not-emitted` (warning, propriedade/valor/motivo e path; agrupa irmãos com a mesma mensagem).
- **Pintura** (`paint.ts`, `emit/`, `preview/`): ordem de pintura CSS (itens de flex atômicos em ordem da árvore; posicionado, `zIndex`, `opacity < 1` e transform sobem de camada: z negativo antes do fluxo, z ≥ 0 depois, estável); fundo; borda uniforme numa forma só, recuada em largura/2 para o traço ficar dentro do border-box; bordas diferentes por lado como fundo sem linha + uma linha por lado (sólida/tracejada/pontilhada); `borderRadius`; `boxShadow` → `outerShdw` (ângulo/distância a partir de x/y; `inset`, `spread` e sombras extras viram `css-not-emitted`); `opacity` multiplicada pelos ancestrais e emitida como `alpha` em cada forma/run; `rotate` acumulado com o centro levado pelas rotações dos ancestrais; `textDecoration` por run (`u="sng"`, `strike="sngStrike"`); `letterSpacing` → `spc`; `backgroundImage: url()` atrás das bordas. O preview SVG desenha as mesmas coisas (filtro `feDropShadow`, `rotate()`, `opacity`, linhas por lado, decoração por run).
- **Mini-CLI** `poc/css/cli.ts build <deck> --size … --out …` (mesmos argumentos, arquivos e resumo da CLI da engine) e `poc/css/bench.ts` (tempo engine × PoC).

**Números**

| Medida | Resultado |
|---|---|
| H3 — `demo.tsx` × `tests/examples/__fixtures__/demo-positioned.json` (16x9, 4x3, wide) | **3/3 tamanhos: mesmos nós, frames ±1 pt, mesmo size e nº de linhas em todos os Text** |
| H3 ampliada — PoC × engine nó a nó, pós-ajuste: `hello`, `layout-test`, `demo`, `long-list` (paginate), `charts` × 16x9/4x3/wide | **15/15 iguais** (frames ±1 pt, size/linhas, mesmos diagnósticos: código, severidade, slide, path) |
| Testes da PoC | 53 (18 de paridade, 24 de layout CSS calculados à mão, 11 de pintura/XML/preview/`css-not-emitted`) |
| `npm test` da raiz | 1412 passados, 5 pulados (sem regressão) |
| Tempo de build, 3 tamanhos com preview, mediana de 5 (H7) | demo: engine 694 ms × PoC 707 ms (**1,02×**); long-list: 465 × 467 ms (**1,00×**) |
| Código novo (sem cópias e sem testes) | ≈ 3,7 mil linhas; cópias: `fit/` 2,05 mil, `emit/runs.ts` 237 |

**Validação visual (Keynote, `scripts/keynote-export.sh`)**: `hello` 16x9, `layout-test` 16x9, `demo` 16x9 e 4x3, `poc/css/examples/p0-paint.tsx` 16x9 e 4x3 abriram e exportaram sem erro de AppleEvent. A demo sai igual à da engine (gráfico e tabela nativos inclusos). No `p0-paint`: borda só em cima, borda tracejada dentro da caixa, sombra, tags com fundo arredondado quebrando em linhas (wrap + padding no Text), rodapé com `marginTop="auto"`, opacity 0,4, caixa girada 12° com o texto girando junto, sobreposição por `zIndex` e o texto que só aparece em 4:3 (`display` responsivo).

**Decisões tomadas na P0 (documentadas, revisáveis)**

1. **Box sem `display` continua flex column** (como a engine, para H3); `display="flex"` explícito é **row**, como no CSS. Slide é flex column.
2. **`position: static` vira `relative` dentro do Yoga**: o bloco de contenção de um absoluto é sempre o pai (como a engine e o React Native), não o ancestral posicionado mais próximo do CSS. `top/left` em nó static são ignorados (CSS).
3. **`lineHeight` numérico mantém a semântica da engine** (múltiplo da altura natural da fonte, ≈ 1,15 × size na Arial), não a do CSS (múltiplo do font-size). Trocar mudaria a calibração (H2) e as alturas da demo (H3). **Decisão em aberto para o dono** (ver abaixo).
4. **Text/Table numa column com `flex: n`/`grow` ficam com basis auto**: emula o `min-height: auto` do browser, que o Yoga não tem (sem isso basis 0 + shrink zeraria a altura do texto). É a mesma exceção da engine (M5-F).
5. **Fundo/borda/padding de um Text** saem como uma forma atrás da caixa de texto (a caixa de texto fica na área de conteúdo), não como uma forma única com insets. Mais simples e igual para todos os kinds; custa uma forma a mais por "tag".
6. `fontWeight` numérico: ≥ 600 é bold; valores fora de 400/700 geram `css-not-emitted` ("sai como regular/bold").
7. Colapso de margens só entre irmãos em `block` (pai/filho não colapsa).

**O que ficou aberto**

- **Ordem de pintura × decks antigos.** Seguindo a spec ("`position: absolute` sem z segue a regra do browser"), decoração absoluta sem `zIndex` pinta **depois** do fluxo. No `layout-test` slide 2, a elipse decorativa (1º filho, absoluta) agora fica **por cima** da caixa da imagem; na engine ficava atrás. Os frames não mudam (H3 passa), mas é uma mudança visual em decks existentes: com `zIndex={-1}` volta ao antigo. Na demo nenhum slide muda (as elipses não cobrem conteúdo). Se a adoção for (A)/(B), é preciso escolher: regra do browser + migração (`zIndex={-1}` nas decorações), ou açúcar "absoluto sem z antes do fluxo" só para decks sem CSS novo. **Decisão do dono.**
- **`lineHeight` CSS** (item 3 acima): manter a semântica da engine ou adotar a do CSS na adoção.
- `charSpacing` do pptxgenjs grava `kern="0"` (desliga kerning) e a medição usa kerning: diferença pequena de largura em texto com `letterSpacing`; a medir na P2 junto com a calibração.
- O `fit/` ainda é a cópia literal: área de conteúdo sem borda, margens fora da detecção/causa, sem estouro por célula de grid/linha de wrap (P2).
- Grid: na P0, `display: grid` caía num flex column (resolvido na P1).

---

## P1 — grid

**Entregue**

- `poc/css/layout/grid.ts` (puro, sem Yoga nem texto): subconjunto do CSS Grid Level 1 — tracks em pt/px, `%`, `fr`, `auto`, `min-content`, `max-content`, `minmax(a, b)`, `repeat(n, …)`; `gridAutoRows/Columns`; placement explícito (`gridColumn/Row` com início/fim, `span`, linhas negativas, `1 / -1`) e auto-placement em linhas, sparse (§8.5: definidos → linha definida → cursor); track sizing da §11 (iniciar, resolver tamanhos intrínsecos com itens de span 1, depois spans maiores, depois os que atravessam `fr`; maximizar; expandir `fr` com a regra iterativa do §11.7.1; esticar tracks `auto`). `1fr` é `minmax(auto, 1fr)` (não encolhe abaixo do min-content do item); `minmax(0, 1fr)` ignora o conteúdo.
- `layout/grid-layout.ts`: o contêiner grid é uma folha do Yoga com measure function (largura → altura pela grade, com `Exactly`/`AtMost`/`Undefined`); os itens não entram na árvore principal. Depois do layout, cada item é posicionado na sua área por uma árvore Yoga própria do tamanho da área: `justifySelf/alignSelf` (padrão `stretch`; `justifyItems`/`alignItems` do contêiner como padrão), `margin` e `margin: auto`, absolutos pela caixa de padding. Contribuições: min-content por `layout/intrinsic.ts` (texto = maior trecho indivisível; row soma, column/block pega o maior; grid aninhado = grade sem espaço), max-content e altura-na-largura por Yoga isolado. Slide também pode ser `display="grid"`. Grid aninhado funciona (G26).
- Sintaxe de track fora do subconjunto (`auto-fill`, áreas nomeadas, `[linha]`) vira `css-not-emitted` em vez de sumir.
- **Oráculo (§9)**: `poc/css/oracle/` — `cases.ts` (48 casos como dados), `html.ts` (caso → HTML com border-box, Liberation Sans via `@font-face` como "Arial", 18 px, line-height normal) e `generate.ts` (`playwright-core` em devDependency **só da PoC**, Chrome do sistema via `channel: 'chrome'`, `getBoundingClientRect` relativo ao slide). Fixtures versionadas em `poc/css/tests/__fixtures__/css-cases.json` (Chrome 155.0.8059.40); `npm run poc:test` não abre browser. Sem `playwright-core` instalado a PoC compila e testa igual (import dinâmico); só não regenera as fixtures.
- `poc/css/examples/dashboard.tsx`: 6 KPIs em `gridTemplateColumns={{ base: 'repeat(3, 1fr)', tall: 'repeat(2, 1fr)' }}` + `gridAutoRows="auto"` + rodapé em grid `auto 1fr` com `marginTop="auto"`.

**Números (H4)**

| Suíte | Resultado |
|---|---|
| 48 casos × Chrome 155, métrica de texto da engine, ±1 pt | **47/48** (28 de grid, 10 de flex, 4 de block, 6 de caixa/posição/herança) |
| Mesmos 48 casos com a altura de linha arredondada como o Chromium faz | **48/48** |
| Testes da PoC | 160 (H4 ×2, 10 unitários do grid, mais os 53 da P0) |
| `npm test` da raiz | 1412 passados, 5 pulados |

**Divergências encontradas (documentadas)**

1. **G27 (texto de 5 linhas numa célula):** só altura. O Chromium arredonda ascent, descent e lineGap a px inteiro antes de somar (18 px de Liberation Sans → linha de 21 px); a engine usa a métrica exata (20,70 pt), que é a calibrada no Keynote. 5 linhas acumulam 1,5 pt. Com a altura de linha do browser o caso bate (por isso a 2ª rodada): o algoritmo de grid está certo; a diferença é métrica de fonte, e quem decide o .pptx é a métrica da engine.
2. **Bug do Yoga 3.2.1 (F02):** com `flexWrap`, item com `alignItems` start ignora a margem do início do eixo cruzado e com `center` ignora as duas (a altura da linha já conta com elas; `flex-end` e `stretch` saem certos). Reproduzido num teste direto do Yoga, fora da PoC. Contornado em `layout/read.ts` (deslocamento pós-layout); a engine atual não é afetada (não tem wrap).
3. Dois bugs do meu track sizing achados pelo oráculo e corrigidos antes do commit: o "maximizar" passava espaço além do limite dos tracks (G09) e o passo dos itens que atravessam `fr` aumentava também `minmax(0, 1fr)` (G07).
4. Fora da suíte por decisão: `min-width: auto` de item flex (o Yoga não implementa; a PoC emula só o caso Text/Table em column) e palavra maior que a linha (o CSS deixa vazar, a engine quebra por caractere).

**Custo (H7, parcial)**: `grid.ts` 476 linhas (368 de código sem comentários/brancos); integração `grid-layout.ts` 246 (199) e `intrinsic.ts` 70 (51). Motor + integração ≈ 620 linhas de código, na faixa estimada pela spec (400–600 para o motor).

**Validação visual**: `dashboard` 16x9 (3×2) e 4x3 (2×3) exportados pelo Keynote sem erro; batem com o preview. A borda só em cima de um cartão arredondado sai como linha reta sobre o canto (o fundo continua arredondado): agora isso gera `css-not-emitted` ("as linhas das bordas saem retas").

**Aberto**

- `justifyContent/alignContent` no contêiner grid (grade menor que o contêiner fica no início), `grid-auto-flow: dense`, áreas nomeadas, `auto-fill/auto-fit`, subgrid e baseline em grid: fora do subconjunto (spec §3).
- Custo de medição: cada contribuição de item é um Yoga isolado (sem cache entre chamadas da measure function); medir em P3 no tempo de build.

---

## P2 — fit e diagnósticos

**Entregue** (adaptações em `poc/css/fit/`, marcadas com `PoC:` nos arquivos copiados de `src/fit`)

- **Área de conteúdo = frame − borda − padding**, lida das métricas que o layout resolveu (`box`, inclusive `%`), em todo lugar onde a engine usava `frame − padding`: detecção de `box-overflow`, causa, mensagens. A área de um Text/Table também é a de conteúdo **do próprio nó** (um Text com padding/borda quebra e estoura dentro dela).
- **Margens dos filhos** entram na detecção (o filho ocupa a caixa de margem) e na causa (demanda = altura + margens verticais + o que pede a mais).
- **Grid:** item de grid tem `cell` (a área que o grid deu) e ela é a área disponível no fit. Text/Table na célula estoura contra a célula; um item que passa da célula (track fixo/fr que não cresceu) vira `box-overflow` **no item**, com mensagem própria ("o item ocupa … mas a célula do grid tem …"; sugere track `auto`/`minmax(auto, …)`). O grid não aponta causa entre células (tracks fixos/fr não cedem altura entre si): simplificação permitida pela spec, documentada.
- **Wrap:** cada linha é uma row e as linhas se empilham como uma column; a causa olha as linhas (soma do maior de cada linha + `rowGap`) e a mensagem fala "as linhas do wrap ocupam N pt". Grid: "os tracks do grid ocupam N pt".
- **`css-not-emitted`**: tudo que chega por prop/`style` sem de/para (propriedade desconhecida, valor fora do subconjunto, `skew/scale/matrix`, sombra `inset`/`spread`/múltipla, `overflow: hidden` em caixa, sombra sem fundo, raio por canto, raio com bordas por lado, `fontWeight` fora de 400/700, track de grid fora do subconjunto, gráfico/tabela girados). Warning com propriedade, valor, motivo e path; irmãos com a mesma mensagem agrupam (`Box[0..3]`).
- **Table com colunas `auto` pelo conteúdo** (`poc/css/layout/table.ts`, cópia de `src/layout/table.ts`): min-content (maior trecho indivisível) e max-content (linha sem quebrar) por coluna, como o `table-layout: auto` do CSS 2.1 §17.5.2.2: com espaço, cada coluna fica com o max-content e a sobra vai na proporção dele; entre min e max, interpola; abaixo do min, escala. Colunas em pt/% continuam fixas. Na demo, a coluna "Δ" fica estreita e "Área" (40 %) não muda.
- `poc/css/examples/probe-css.tsx`: sondagem dos estouros novos (célula de grid com texto que encolhe, `fit="error"` em célula, cartão alinhado no topo maior que a linha fixa, wrap sem altura para as linhas, margens que somam além da caixa, borda que reduz a área do texto).
- **Calibração** (`poc/css/calibration/`): `h2.ts` gera o .pptx (PoC ou `--engine`), exporta PDF pelo Keynote (`keynote-pdf.sh`, 3 tentativas com 30 s de espera para AppleEvent ocupado) e lê as linhas pelo PDFKit (`pdflines.swift`). Diferente do M3/M8, que usava `selectionsByLine` (junta rótulos vizinhos e embaralha parágrafo vazio), a extração pega cada caractere da página, filtra por centro horizontal no retângulo, sobreposição vertical e **tamanho de fonte da amostra**, e agrupa pela caixa de linha; a linha é comparada sem espaços (o PDF não guarda espaço como glifo).

**Números**

| Hipótese | Medida | Resultado |
|---|---|---|
| H5 | `overflow.tsx`, `probe/cause.tsx`, `probe/table.tsx` × 16x9/4x3/wide, PoC × engine | **9/9 iguais**: mesmos códigos, severidades, slides, paths, `causedBy` e **mensagens** |
| H5 (novo) | `probe-css.tsx` | 7 diagnósticos, cada um no nó e na área esperados (teste com a lista exata) |
| H2 | `calibration.tsx` pela PoC → Keynote → PDF | **34/34** (33 pelo PDFKit; C05, parágrafo com linha vazia, conferido por imagem, como no M3) |
| H2 | `calibration-rich.tsx` pela PoC → Keynote → PDF | **30/30** (R20, o `nowrap` que estoura de propósito, sai numa linha só: o bug 1 do M8 já estava corrigido na engine) |
| H2 (controle) | a mesma ferramenta na saída da engine | 33/34 (mesmo C05) e 30/30 |
| H2 (guarda) | XML de cada slide, PoC × engine, nos dois decks | **byte a byte igual** (13/13 slides); vira teste do `poc:test` |
| Testes da PoC | | 176 |
| `npm test` da raiz | | 1412 passados, 5 pulados |

**Achados**

- Como os decks de calibração não usam CSS novo, a PoC emite o mesmo XML da engine: a calibração (H2) se mantém por construção, e a medição no Keynote confirma. Para texto com CSS novo (`letterSpacing`, padding no Text) a calibração não foi medida; o `charSpacing` do pptxgenjs desliga o kerning (`kern="0"`), então texto espaçado pode ficar até ~1 % mais largo no renderizador do que na medição (a folga de 3 % do `textSafety` cobre).
- Na demo, além da Table, os slides 1 e 6 mudam só a **ordem** das formas (a elipse decorativa absoluta passa para depois do fluxo; mesmas formas). É a decisão de ordem de pintura em aberto desde a P0.

**Aberto**

- `causedBy` dentro de grid: nenhum (cada célula é dona do próprio estouro). Se o dono quiser causa entre linhas `auto` do grid, dá para tratar o grid como o wrap (linhas como rows).
- Colunas auto da Table: o algoritmo é o do CSS 2.1 sem `min-width` por coluna nem `colspan`.

---

## P3 — vitrine, comparação e decisão

**Entregue**

- `poc/css/README.md` virou o **guia de 1 página** (o único material do teste do agente).
- `poc/css/examples/showcase.tsx`, 4 slides:
  1. capa com decoração atrás por `zIndex={-1}`, caixa translúcida girada, texto herdado do Slide e `marginTop="auto"`;
  2. grid de KPIs com sombra, que em 4:3 vira 2 colunas e mostra uma nota com `display` responsivo;
  3. grid `auto 1fr 1fr` com `span 2`, `2 / -1` e dois gráficos nativos em células;
  4. tags com wrap, borda só em cima + tracejada embaixo, borda pontilhada, sublinhado/riscado por `Span`, camadas por `zIndex` com rotate e opacity.

  No Keynote, 16x9 e 4x3 batem com o preview, sem diagnóstico.
- Reescritos em CSS: `poc/css/examples/{demo,long-list,charts,m9-deck}.tsx`, com os layouts e componentes em `poc/css/examples/kit.tsx`. A aparência é equivalente à da engine (conferida lado a lado nos dois tamanhos) e a paginação é igual. As trocas:
  - título com `borderLeft` no lugar de Box row + Shape;
  - capa e rodapés com `marginTop="auto"`;
  - TwoColumn e KpiRow em grid;
  - cartões que definem fonte e cor uma vez;
  - contato com `marginTop` no lugar de Box com padding;
  - marcador do Bullets com `marginTop` no lugar de Box em volta do Shape.
- Ferramentas: `poc/css/tools/count.ts` + `h1.ts` (contagem) e `poc/css/bench.ts` (tempo). Teste do agente: `poc/css/examples/agent-test/` (slide e LOG escritos pelo agente).

### H1 — DX

Contagem no deck expandido (componentes chamados), em 16x9 (`npx tsx --tsconfig poc/css/tsconfig.json poc/css/tools/h1.ts`):

| deck | nós | props | nós + props | props responsivas | Box só para empurrar |
|---|---|---|---|---|---|
| demo | 92 → 68 (**−26 %**) | 316 → 261 (−17 %) | 408 → 329 (−19 %) | 42 → 32 | **15 → 3** |
| long-list | 61 → 46 (−25 %) | 210 → 178 (−15 %) | 271 → 224 (−17 %) | 0 → 0 | 14 → 1 |
| charts | 18 → 12 (−33 %) | 69 → 48 (−30 %) | 87 → 60 (−31 %) | 0 → 0 | 3 → 3 |
| m9-deck | 109 → 82 (−25 %) | 353 → 297 (−16 %) | 462 → 379 (−18 %) | 58 → 40 | 21 → 2 |

"Box só para empurrar" = Box sem pintura com 0 ou 1 filho. Os 3 que sobram na demo são o corpo do ContentLayout (`flex={1}` + `justifyContent`). Charts mantém 3 porque o corpo do layout existe em cada slide.

**Agente virgem:** só com o guia, escreveu o slide pedido em **1 build**, sem diagnóstico e com o layout correto (conferido no PNG): grid 3×2 de cartões com borda só em cima, tags em pílulas quebrando em 2 linhas, rodapé por `marginTop="auto"`. Os atritos que ele apontou (caminho relativo do import; se fundo e raio valem em `Text`) foram incorporados ao guia.

**Resultado:** nós −26 % e agente em 1 build cumprem a meta. Props −17 % ficam abaixo dos 25 %: o CSS troca props, mas não as elimina. `borderLeft` + `paddingLeft` substituem Shape `kind/width/height/fill/shrink` + Box `direction/align/gap`, e quem cai de fato são os nós e os Box de empurrar.

### H6 — de/para CSS → PPTX (final)

| Sai nativo | Degrada (sai, com diferença) | Vira `css-not-emitted` (warning, não sai) |
|---|---|---|
| `backgroundColor` (fill, alpha de rgba) | fundo/borda/padding de Text: forma atrás da caixa de texto (2 formas, não 1) | `overflow: hidden` em caixa |
| `border` uniforme (sólida/tracejada/pontilhada, dentro do border-box), `borderRadius` | `borderRadius` + bordas por lado: o fundo arredonda, as linhas por lado saem retas (**avisa**) | raio por canto (sai o menor; **avisa**) |
| bordas por lado (linha por lado) | `fontWeight` 100–500/800–900 → regular/bold (**avisa**) | `boxShadow` inset, spread, 2ª sombra; sombra sem fundo |
| `boxShadow` (1 sombra externa) | `letterSpacing`: o `spc` do pptxgenjs desliga kerning (até ~1 % mais largo; folga de 3 % cobre) | `transform: scale/skew/matrix`; rotate em Chart/Table |
| `opacity` (transparency em cada forma/run, multiplicada pelos ancestrais) | `lineHeight` numérico = múltiplo da altura natural (engine), não do font-size (CSS) | gradiente em `backgroundImage`; `filter`, `textShadow`, qualquer propriedade fora da lista |
| `rotate`/`transform: rotate` (acumulado, centro levado pelos ancestrais) | posicionado sem `zIndex` pinta depois do fluxo (regra do browser; decks antigos mudam de ordem) | track de grid fora do subconjunto (`auto-fill`, áreas, `[linha]`) |
| `translate` (bake no frame) | | `whiteSpace` ≠ normal/nowrap; `objectFit` ≠ contain/cover; `boxSizing` ≠ border-box |
| `zIndex` (ordem de desenho) | | |
| `display: none` (não emite) | | |
| `backgroundImage: url()` (cover, atrás das bordas) | | |
| texto: família, tamanho, peso, itálico, cor, alinhamento, `textTransform` (antes de medir), `textDecoration` por run, `letterSpacing` (`spc`) | | |
| Table (colunas auto pelo conteúdo), Chart, Image (`objectFit`), Shape | | |

Nenhuma feature some em silêncio: o que não sai nativo ou degrada com aviso, ou gera `css-not-emitted` com propriedade, valor, motivo e path. O preview também não desenha o que não sai.

### H7 — custo

| Medida | Resultado | Meta |
|---|---|---|
| Tempo de build da demo (6 slides × 3 tamanhos, com preview, mediana de 7) | engine 685 ms × PoC 691 ms (**1,01×**); demo reescrita em CSS (grid, bordas, herança) 699 ms × engine 688 ms (**1,02×**) | ≤ 2× |
| Motor de grid | `grid.ts` 368 linhas de código (476 com comentários); integração com Yoga 199 + min-content 51 | ≤ ~600 |
| Rodadas do fit | mesmo algoritmo e limite da engine (`maxFitIterations = 12`); nenhum deck da PoC chegou perto | ≤ 12 |

### Quadro final das hipóteses

| # | Resultado |
|---|---|
| H1 | **verde com ressalva**: nós −26 % e agente virgem em 1 build; props −17 % (meta era 25 %) |
| H2 | **verde**: 34/34 e 30/30 no Keynote; XML dos decks de calibração byte a byte igual ao da engine |
| H3 | **verde**: demo × fixture 3/3 tamanhos; 15/15 nó a nó com a engine. Muda só a **ordem** da decoração absoluta sem z (visual em `layout-test` slide 2) |
| H4 | **verde**: 47/48 × Chrome 155 com a métrica da engine (a exceção é altura de texto por arredondamento de métrica do browser); 48/48 com a métrica de linha do browser |
| H5 | **verde**: 9/9 iguais à engine (códigos, severidades, paths, causedBy, mensagens) + estouros novos (célula, wrap, margem, borda) nos nós certos |
| H6 | **completa**: tabela acima, sem feature silenciosa |
| H7 | **verde**: 1,02×, grid 368 linhas, fit igual |

## Decisão (§11): **(A) adotar como a engine**, com duas decisões do dono antes de migrar

Pela regra de go da spec (H1, H2, H4 e H5 verdes e H6 completa), **é go**. A ressalva do H1 (props −17 %) não muda isso: as metas de nós e do agente foram cumpridas, e o ganho de DX aparece no que importa ao agente. Ele escreveu grid + margin + wrap certo de primeira, só com um guia de 1 página.

H3 e H7 definem o tamanho da adoção:

- **H3:** nada regride em posição, tamanho, linhas ou diagnósticos. O XML da calibração é idêntico.
- **H7:** o custo é nulo (1,02×) e o grid ficou no tamanho previsto.

Por isso (A), não (B): não há peça cara para deixar de fora, e o grid é justamente o que mais reduz Box de empurrar e colunas por `grow`.

Por que não (C): H1 e H2 não falharam.

**O que o dono precisa decidir antes de virar M11** (registrado desde a P0):

1. **Ordem de pintura de decoração absoluta sem `zIndex`.**
   - Opção (a): regra do browser (como está na PoC) + migração (`zIndex={-1}` nas decorações). Em `examples/` só `layout-test` muda visualmente.
   - Opção (b): açúcar de compatibilidade (absoluto sem z pinta antes do fluxo) só para nós sem CSS novo.
2. **`lineHeight` numérico**: manter a semântica da engine (múltiplo da altura natural; a calibração foi feita assim) ou adotar a do CSS (múltiplo do font-size), que muda alturas de texto existentes.

**Custos de adoção conhecidos:**

- `poc/css/fit/` é cópia de `src/fit` (~2 mil linhas): na adoção, as adaptações `PoC:` vão para `src/fit` e a cópia some.
- `src/core/types.ts` ganha `css`/`box`/`cell` nos nós e o código `css-not-emitted`.
- O contorno do bug de wrap do Yoga 3.2.1 entra no layout.
- O `textSafety` passa a ser lido também pelo min-content do grid.

**Para validar no PowerPoint:** `dist/poc-css/showcase.16x9.pptx` e `dist/poc-css/showcase.4x3.pptx` (`npx tsx poc/css/cli.ts build poc/css/examples/showcase.tsx --size 16x9,4x3 --out dist/poc-css` regenera). O que conferir:

- sombra nos cartões do slide 2;
- traço das bordas dentro das caixas (slide 4);
- texto girando junto com a caixa (slides 1 e 4);
- transparência da caixa da capa;
- ordem das camadas no slide 4;
- tags sublinhadas/riscadas.
