# M3-F — Calibração visual da medição de texto (GO / NO-GO)

**Veredito: GO condicional.** A medição bate com o Keynote. As larguras do fontkit (Liberation Sans) coincidem com as do Keynote (Arial) com erro < 0,1 %. Com `TEXT_SAFETY = 1`, 33 das 34 amostras quebram exatamente nas mesmas palavras. A única exceção é C21: a URL quebra em lugares diferentes, mas com o mesmo número de linhas.

O problema está no padrão atual, `TEXT_SAFETY = 0.97`. Com ele, **11 de 34 amostras** quebram em palavra diferente no Keynote: C02, C05, C06, C07, C21, C23, C24, C26, C27, C28 e C33. Em todos esses casos o Keynote coloca **mais** palavras na linha que a engine. O erro vai sempre na direção segura (o texto nunca passa do frame), mas falha o critério literal do marco e desperdiça até 1 linha (C23 e C33: −16 % a −28 % da altura).

Testei a correção recomendada abaixo: emitir as linhas calculadas com quebra forçada e manter a margem de 3 %. Com ela, o Keynote bateu **34/34**, C21 incluído.

Na altura, a estratégia escolhida é `'exact'` (spcPts). Nela o Keynote nunca fica mais alto que o frame: o erro é de 0 a −1 pt por linha, porque o Keynote trunca o spcPts para pt inteiro. Na estratégia `'multiple'` o erro chega a +1,5 % por linha no Keynote, e a hipótese é que no PowerPoint chegue a ≈ +4 %.

## Ambiente

- macOS (Darwin 25.6), Keynote 14.4, Node 24 + tsx. Medidor: fontkit com Liberation Sans Regular/Bold/Italic/BoldItalic, emitida como "Arial".
- Métricas verticais (Liberation Sans, iguais às do Arial): unitsPerEm 2048. hhea ascender 1854, descender −434, lineGap 67, ou seja, linha natural = 1,1499 × size. OS/2 winAscent 1854 e winDescent 434 (1,1172 × size, sem gap). typo 1491/−431/307. USE_TYPO_METRICS desligado.
- Deck: `examples/calibration.tsx` (C01–C34), 16x9, `--debug`.

## Método

1. Script no scratchpad (`calib.ts`) que monta o pipeline: `resolveDeck → layoutDeck(createFontkitMeasurer(..., {safety})) → emitPptx({debug, lineSpacing})`. Ele grava o .pptx, os PNGs nativos (1440 px) e o `samples.json` com frame, `text.lines`, `lineHeight` e `ascent` de cada amostra. Variantes geradas em `dist/calib/`: `multiple` e `exact` (safety 0,97), `exact-s100` (1,0), `exact-s099` (0,99) e `exact-forced-s097` (0,97 com cada linha calculada emitida como parágrafo próprio, simulando quebra forçada).
2. **Keynote → PDF** por AppleScript (`export … as PDF with properties {PDF image quality:Best}`), em vez de PNG de 1 px/pt. O PDF guarda o texto vetorial. Com PDFKit (Swift, sem instalar nada):
   - `page.selection(for: rect do frame + 1,6 linha abaixo).selectionsByLine()` devolve **o texto de cada linha como o Keynote quebrou** e o retângulo da linha. O retângulo tem altura de exatamente (ascent+descent) × size e o topo em baseline − ascent, então baseline = topo + 0,9053 × size.
   - Para conferir visualmente, rasterizei o PDF a 4 px/pt com CoreGraphics e recortei com `sips`. Lido com a ferramenta Read: C05, C18, C21 e C24, que o PDFKit agrupa mal (parágrafos com linha vazia e o 60 pt colado no rótulo vizinho).
3. Por amostra: comparei a lista de linhas da engine com a do Keynote (texto normalizado) e o passo de linha (pitch) do Keynote com o `lineHeight` da engine. Também medi o erro da 1ª baseline (`frame.y + ascent`) e o "estouro" = última baseline + descent − base do frame (positivo = passa do frame).
4. Medi o efeito do kerning, porque o PowerPoint só faz kerning com `kern` no rPr: larguras com e sem `kern` no fontkit para todas as linhas.

## Resultados por amostra

Colunas: "quebras iguais" com safety 0,97 (padrão atual), 1,0 e 0,97 + quebra forçada. "Erro de passo" = passo do Keynote − passo da engine, por linha. "Estouro" = quanto o texto renderizado passa (+) ou sobra (−) em relação à base do frame (pt e % da altura do frame), com safety 0,97.

| id | size | width | estilo | linhas engine (0,97) | linhas Keynote | quebras iguais 0,97 | 1,0 | 0,97 + forçada | erro de passo exact | erro de passo multiple | estouro exact | estouro multiple |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C01 | 8 | 100 |  | 7 | 7 | sim | sim | sim | -0.20 (-2.2%) | -0.20 (-2.2%) | -1.5 (-2.3%) | -1.7 (-2.6%) |
| C02 | 10 | 180 |  | 5 | 5 | não | sim | sim | -0.50 (-4.3%) | -0.50 (-4.3%) | -2.6 (-4.5%) | -2.8 (-4.9%) |
| C03 | 12 | 220 | B | 3 | 3 | sim | sim | sim | -0.80 (-5.8%) | +0.20 (+1.5%) | -2.5 (-5.9%) | +0.2 (+0.5%) |
| C04 | 14 | 120 | I | 3 | 3 | sim | sim | sim | -0.10 (-0.6%) | -0.10 (-0.6%) | -0.5 (-1.1%) | -0.8 (-1.6%) |
| C05 | 10 | 600 |  | 5 (c/ vazia) | 5 | não¹ | sim | sim | -0.50 (-4.3%) | -0.50 (-4.3%) | dentro (visual) | dentro (visual) |
| C06 | 14 | 320 | lh1.2 | 3 | 3 | não | sim | sim | -0.32 (-1.6%) | -0.21 (-1.1%) | -1.8 (-3.1%) | -4.2 (-7.2%) |
| C07 | 12 | 330 | lh1.5 right | 2 | 2 | não | sim | sim | -0.70 (-3.4%) | +0.11 (+0.5%) | -2.9 (-6.9%) | -7.0 (-16.9%) |
| C08 | 18 | 240 | B | 2 | 2 | sim | sim | sim | -0.70 (-3.4%) | +0.30 (+1.5%) | -1.6 (-3.8%) | +0.0 (+0.0%) |
| C09 | 18 | 400 | center | 2 | 2 | sim | sim | sim | -0.70 (-3.4%) | +0.30 (+1.5%) | -1.6 (-3.8%) | +0.0 (+0.0%) |
| C10 | 24 | 300 |  | 3 | 3 | sim | sim | sim | -0.60 (-2.2%) | +0.40 (+1.5%) | -2.1 (-2.5%) | +0.4 (+0.5%) |
| C11 | 24 | 340 | B lh1.2 | 2 | 2 | sim | sim | sim | -0.12 (-0.4%) | +0.33 (+1.0%) | -1.7 (-2.6%) | -5.6 (-8.4%) |
| C12 | 18 | 600 | lh1.5 right | 2 | 2 | sim | sim | sim | -0.05 (-0.2%) | +0.16 (+0.5%) | -2.5 (-4.0%) | -10.5 (-16.9%) |
| C13 | 32 | 360 | B | 2 | 2 | sim | sim | sim | -0.80 (-2.2%) | +0.20 (+0.6%) | -2.0 (-2.7%) | -0.6 (-0.9%) |
| C14 | 32 | 280 | I | 2 | 2 | sim | sim | sim | -0.80 (-2.2%) | +0.20 (+0.6%) | -2.0 (-2.7%) | -0.6 (-0.9%) |
| C15 | 44 | 420 |  | 2 | 2 | sim | sim | sim | -0.60 (-1.2%) | -0.60 (-1.2%) | -1.9 (-1.8%) | -2.6 (-2.6%) |
| C16 | 44 | 220 | center | 2 | 2 | sim | sim | sim | -0.60 (-1.2%) | -0.60 (-1.2%) | -1.9 (-1.8%) | -2.6 (-2.6%) |
| C17 | 60 | 600 | B | 1 | 1 | sim | sim | sim | — | — | -1.9 (-2.7%) | -1.9 (-2.8%) |
| C18 | 60 | 300 | | 1 | 1 | sim | sim | sim | — | — | dentro (visual) | dentro (visual) |
| C19 | 24 | 341 | B | 1 | 1 | sim | sim | sim | — | — | -0.9 (-3.3%) | -0.4 (-1.4%) |
| C20 | 18 | 412 |  | 1 | 1 | sim | sim | sim | — | — | -0.9 (-4.2%) | -0.3 (-1.4%) |
| C21 | 12 | 200 |  | 5 | 5 | não | não | sim | -0.80 (-5.8%) | +0.20 (+1.5%) | -4.0 (-5.9%) | +0.6 (+0.9%) |
| C22 | 14 | 260 |  | 4 | 4 | sim | sim | sim | -0.10 (-0.6%) | -0.10 (-0.6%) | -0.6 (-1.0%) | -0.8 (-1.3%) |
| C23 | 10 | 180 |  | 4 | 3 | não | sim | sim | -0.50 (-4.3%) | -0.50 (-4.3%) | -13.1 (-28.4%) | -13.3 (-29.0%) |
| C24 | 14 | 300 | I lh1.5 | 5 | 5 | não | sim | sim | — | — | -2.6 (-2.1%) | -8.4 (-7.0%) |
| C25 | 12 | 340 | lh1.2 center | 3 | 3 | sim | sim | sim | -0.56 (-3.4%) | +0.16 (+1.0%) | -2.3 (-4.7%) | -2.6 (-5.3%) |
| C26 | 14 | 200 |  | 3 | 3 | não | sim | sim | -0.10 (-0.6%) | -0.10 (-0.6%) | -0.5 (-1.1%) | -0.8 (-1.6%) |
| C27 | 14 | 200 | center | 3 | 3 | não | sim | sim | -0.10 (-0.6%) | -0.10 (-0.6%) | -0.5 (-1.1%) | -0.8 (-1.6%) |
| C28 | 14 | 200 | right | 3 | 3 | não | sim | sim | -0.10 (-0.6%) | -0.10 (-0.6%) | -0.5 (-1.1%) | -0.8 (-1.6%) |
| C29 | 18 | 200 |  | 3 | 3 | sim | sim | sim | -0.70 (-3.4%) | +0.30 (+1.5%) | -2.3 (-3.7%) | +0.3 (+0.5%) |
| C30 | 18 | 200 | lh1.2 | 3 | 3 | sim | sim | sim | -0.84 (-3.4%) | +0.24 (+1.0%) | -3.5 (-4.7%) | -3.9 (-5.3%) |
| C31 | 18 | 200 | lh1.5 | 3 | 3 | sim | sim | sim | -0.05 (-0.2%) | +0.16 (+0.5%) | -2.5 (-2.7%) | -10.3 (-11.1%) |
| C32 | 10 | 140 | B | 8 | 8 | sim | sim | sim | -0.50 (-4.3%) | -0.50 (-4.3%) | -4.1 (-4.4%) | -4.3 (-4.7%) |
| C33 | 8 | 160 | I | 7 | 6 | não | sim | sim | -0.20 (-2.2%) | -0.20 (-2.2%) | -10.5 (-16.3%) | -10.7 (-16.5%) |
| C34 | 12 | 340 |  | 3 | 3 | sim | sim | sim | -0.80 (-5.8%) | +0.20 (+1.5%) | -2.5 (-5.9%) | +0.2 (+0.5%) |

¹ C05 com 0,97: a engine leva "da" para a 2ª linha. O Keynote mantém "…anual da" na 1ª (595,3 pt de 600). Com 1,0 e com a quebra forçada fica igual (conferido no recorte).

Divergências com 0,97, todas porque o Keynote cabe mais (a linha do Keynote ocupa entre 97 % e 99,3 % da largura): C02 ("de"), C05 ("da"), C06 ("consumidor"), C07 ("em"), C23 ("—" e "(ii)." sobem: 4 → 3 linhas), C24 ("em"), C26/C27/C28 ("e"), C33 (7 → 6 linhas). **C21** é diferente: o Keynote quebra a URL **depois de "-" e "/"** (regra UAX #14). A engine só quebra em espaço e, quando a palavra não cabe, por caractere ("…exemplo-corporativo.co | m.br/…"). O número de linhas é o mesmo (5), mas os pontos de quebra mudam.

### Achados de métrica

- **Largura**: igual. O Keynote faz kerning, como o fontkit. C19 tem 328,1 pt nos dois e "Transformação" 14 pt itálico tem 93,1 pt nos dois. A linha mais justa que o Keynote aceitou ocupa 99,25 % (C33). Nenhum caso de "a engine diz que cabe e o Keynote quebra".
- **Kerning desligado (provável no PowerPoint)**: as linhas ficam no máximo **1,1 %** mais largas ("Transformação"). Na maioria das linhas a diferença fica entre 0 e 0,3 %. Com 0,97 sobra margem. Com 1,0, C21 (99,7 %, que vira 100,03 % sem kern) estouraria.
- **Passo com `spcPct` (multiple) no Keynote**: a linha simples é ⌊round(ascent)+round(descent)+round(lineGap)⌉ com cada métrica arredondada para pt inteiro: 8→9, 10→11, 12→14, 14→16, 18→21, 24→28, 32→37, 44→50. A engine usa 1,1499 × size sem arredondar, então o erro fica entre −0,6 e +0,4 pt por linha (−4,3 % a +1,5 %).
- Com múltiplo m ≠ 1, o Keynote calcula `H1 + (m−1)·(H1 − lineGap)` e **não desce a 1ª linha**: a 1ª baseline fica em ≈ ascent, contra ascent × m na engine. Resultado: o texto sobe 2,6–7,8 pt e sobra espaço embaixo (C12: −17 %).
- **Passo com `spcPts` (exact) no Keynote**: o Keynote **trunca para pt inteiro** (1380 → 13, 920 → 9, 2484 → 24, 5060 → 50). O passo renderizado fica sempre ≤ ao calculado, com erro entre 0 e −0,84 pt por linha. A 1ª baseline fica a ±0,46 pt da prevista (`ascent × m`) para m = 1, 1,2 e 1,5, então o Keynote também desce a 1ª linha proporcionalmente no modo exato.

## Parâmetros finais

| Parâmetro | Valor | Onde |
|---|---|---|
| Estratégia | **`'exact'`** (`<a:spcPts>` = `text.lineHeight`) | `src/emit/calibration.ts` (`ACTIVE_LINE_SPACING`) — **alterado** |
| `LINE_SPACING_CALIBRATION` | 1 (sem efeito em 'exact') | inalterado |
| `baselineOffset` | inalterado (`ascent/upm × size × m`). Erro da 1ª baseline ≤ 0,5 pt em 'exact'. | `src/text/fontkit.ts` |
| `TEXT_SAFETY` | **recomendação abaixo** (não alterei `src/core/defaults.ts`) | — |

`npm run typecheck` e `npm test` (421 testes) passam com a mudança. Rebuild final: `node bin/tsx-slides.mjs build examples/calibration.tsx --out dist/calib/final --debug`, com `diagnostics.json` vazio.

## Comparativo multiple vs exact (Keynote, safety 0,97)

| | multiple (spcPct) | exact (spcPts) |
|---|---|---|
| Erro de passo por linha | −0,6 … +0,4 pt (−4,3 % … +1,5 %), depende do arredondamento por tamanho | 0 … −0,84 pt (truncamento), **nunca positivo** |
| Pior estouro do frame | +0,6 pt / +0,9 % (C21) | **nenhum** (máx. −0,5 pt) |
| Sobra máxima (sem contar diferença de quebra) | −10,5 pt / −17 % (lh 1,5: a 1ª linha não desce) | −4,1 pt / −5,9 % (< ½ linha em todas) |
| 1ª baseline | erra −2,6 a −7,8 pt com lh ≠ 1 | ±0,5 pt |
| Dependência do renderizador | alta: cada um define "100 %" de um jeito | baixa: valor absoluto |

**Escolha: exact.** É o único modo em que o Keynote nunca passa do frame e em que a sobra fica abaixo de meia linha.

## TEXT_SAFETY — recomendação (para o orquestrador; `src/core/defaults.ts` não foi editado)

| safety | quebras iguais no Keynote | risco de linha a mais em outro renderizador |
|---|---|---|
| 0,97 (atual) | 23/34 | baixo (margem de 3 % > 1,1 % do kerning) |
| 0,99 | 33/34 (C33 diverge) + C21 | médio |
| 1,0 | 33/34 (só C21) | **alto**: sem margem. Kerning ausente no PowerPoint já estouraria C21. |
| **0,97 + quebra forçada** | **34/34** | **nenhum** de quebra: a linha já vem decidida |

Recomendação, em ordem:

1. **Manter `textSafety = 0.97`** e fazer o emissor gravar **as linhas calculadas com quebra forçada**. Hoje `paragraphRunsOf` em `src/emit/options.ts` passa só os parágrafos. A proposta é emitir `text.lines` com `<a:br/>` (quebra suave, `softBreakBefore`/`breakLine` dentro do mesmo parágrafo) ou um parágrafo por linha. Cada linha mede ≤ 0,97 × largura e a caixa tem a largura cheia, então nenhum renderizador re-quebra e as quebras ficam idênticas por construção. Isso também resolve C21 e qualquer diferença de regra de quebra (UAX #14) e de kerning.
   - Custo: ao editar o texto no PowerPoint, as quebras manuais ficam. Preferir `<a:br/>` a parágrafos para não quebrar listas e alinhamento.
   - Validado no Keynote: `dist/calib/exact-forced-s097`, 34/34. Fica fora do meu escopo (`src/emit/options.ts`).
2. Se a quebra forçada for rejeitada, **não subir para 1,0**. Mantenha 0,97 e aceite que o renderizador às vezes coloca mais uma palavra na linha. Isso nunca causa estouro, só sobra de até 1 linha. O critério do marco teria de mudar para "nunca mais linhas que o calculado".
3. Independente da escolha (`src/text/lines.ts`): permitir quebra depois de "-" e "/" dentro de palavras longas, como no UAX #14, para C21 bater sem quebra forçada.

## O que o PowerPoint e o Google Slides podem fazer diferente (hipóteses para o dono validar)

- **"Single" (spcPct 100 %) no PowerPoint**: a hipótese mais citada é que o PowerPoint usa ≈ 1,2 × size por linha em 100 %, qualquer que seja a fonte. Isso não vem do hhea (1,15 no Arial) nem do win (1,117: winAscent+winDescent sem gap). No Windows, o GDI/DirectWrite usa win + "external leading" calculado de hhea/typo. Se a hipótese estiver certa, em `'multiple'` o PowerPoint ficaria **≈ +4,4 % mais alto por linha** que a engine e estouraria o critério de 2 % em textos de várias linhas. É mais um motivo para `'exact'`. Se o dono quiser `'multiple'` no futuro, `LINE_SPACING_CALIBRATION ≈ 1,15/1,2 = 0,958` corrigiria só o PowerPoint, e o Keynote ficaria −4 % menor.
- **spcPts no PowerPoint**: deve respeitar centésimos de pt, sem truncar como o Keynote. Altura esperada = calculada. A posição da 1ª baseline no modo "Exatamente" pode ser diferente (o PowerPoint distribui o espaço extra acima da linha). Conferir C11, C12 e C31 (lh 1,2/1,5) no contorno.
- **Kerning**: o pptxgenjs não grava `kern` em `a:rPr`, e o PowerPoint, por padrão, não faz kerning sem esse atributo. As linhas ficam até 1,1 % mais largas. Com 0,97 isso cabe. Com 1,0 não cabe.
- **Google Slides**: só aceita entrelinha como múltiplo. Na importação, spcPts costuma virar um múltiplo aproximado, e o "100 %" dele é ≈ 1,15 × size. Espere diferença de ±1 pt por linha. As quebras devem bater com a quebra forçada.

### Arquivos para o dono abrir no PowerPoint

- `dist/calib/final/calibration.16x9.pptx`: **configuração final** (exact, safety 0,97, debug). Abrir com o PNG nativo `dist/calib/final/calibration.16x9/slide-NN.png` ao lado e o Keynote em `dist/calib/final/keynote/`.
- `dist/calib/exact-forced-s097/calibration.pptx`: proposta com quebra forçada (deve bater 34/34 também no PowerPoint).
- `dist/calib/multiple/calibration.pptx`: para testar a hipótese do "single = 1,2 × size" (comparar a altura do C32 de 8 linhas com o contorno).

O que conferir em cada slide: (a) as palavras no fim de cada linha, comparando com a coluna "linhas Keynote"; (b) se a última linha fica dentro do contorno vermelho; (c) em C11, C12 e C31, se a 1ª linha começa no topo do contorno.

## Riscos

- O PowerPoint ainda não foi verificado. O GO vale para o Keynote; a decisão final depende da conferência do dono.
- Com 0,97 sem quebra forçada, cerca de 30 % dos textos de várias linhas quebram diferente no renderizador real (sempre para menos). Não há estouro, mas o critério literal do marco falha.
- O Keynote trunca spcPts: em corpos pequenos sobra até 0,8 pt por linha (≈ 6 % em 12 pt). Isso é estético e fica abaixo de meia linha.
- C21: quebra em hífen e barra (UAX #14) não implementada.

## Reprodução

Scripts em `/private/tmp/claude-503/-Users-jovivo-Developer-projects-pptsx/62d3f11c-4474-421f-b299-1654a0c93678/scratchpad/`:
- `calib.ts` gera a variante (`npx tsx --tsconfig tsconfig.json calib.ts <multiple|exact> <safety> <nome> [forced]`).
- `kpdf.sh` faz Keynote → PDF.
- `raster.swift` rasteriza o PDF (N px/pt).
- `pdflines.swift` extrai as linhas por PDFKit.
- `an2.py` faz a comparação.
- `kern.ts` mede o efeito do kerning.
