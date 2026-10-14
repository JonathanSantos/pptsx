# M10-S — spike `addTable` / `addChart` (pptxgenjs 4.0.1 × Keynote 14.4)

Scratchpad (`$S`): `/private/tmp/claude-503/-Users-jovivo-Developer-projects-pptsx/595f004f-084b-4a21-899b-ab3693778f22/scratchpad/m10s/`.
Layout 10 × 5,625 in, tudo calculado em pt e convertido com `pt / 72` (igual a `positionOf`). Fonte Arial, `margin` explícita.

| Arquivo | O que tem |
|---|---|
| `tables.mts` → `tables.pptx` | 7 slides: Q1 (S1), Q2 (S2, S3), Q3 (S4), Q4 (S5), Q5 (S6), Q6 (S7) |
| `tables-autopage-true.pptx` | controle da Q6 |
| `charts.mts` → `charts.pptx` / `charts-fixed.pptx` | S1 bar/line/pie com 1 e 2 séries + fundos coloridos; S2 opções do contrato; S3 pizza padrão + barra horizontal |
| `chartmin.pptx`, `keynote-made.pptx`, `t*.pptx` | bisseção do bug do gráfico (Q9) |
| `frame.pptx` | `<p:xfrm>` da tabela com e sem `w`/`h` |
| `lineh.pptx`, `chartlayout-fixed.pptx` | testes de precisão que **não rodaram** no Keynote (ver "Pendências") |
| `png-*/`, `hi-*` (4×), `hi8-*` (8×) | PNG do `keynote-export.sh` (1 px = 1 pt) e PDF do Keynote rasterizado (1 px = 0,25 / 0,125 pt) |
| `scan.py`, `ink.py`, `measure_charts.py`, `kpdf.sh`, `kcount.sh`, `fixcharts.py` | medição, export PDF, contagem de objetos nativos no Keynote, correção do xlsx |

Obs.: o `keynote-export.sh` exporta a 720 × 405 px (1 px = 1 pt), não 1280. Para medir abaixo de 1 pt exportei PDF pelo Keynote (`kpdf.sh`) e rasterizei a 4× / 8× (`raster.swift`).

---

## Achado bloqueante: o Keynote descarta os gráficos do pptxgenjs 4.0.1

Sem correção, **nenhum gráfico aparece no Keynote**: o slide fica vazio e `count of charts of slide` dá 0 (`png-charts/`, `chartmin.pptx`). A causa é o xlsx embutido. O pptxgenjs grava em `xl/tables/table1.xml`:

```xml
<table ... ref="A1:B4'" totalsRowShown="0">   <!-- apóstrofo sobrando -->
```

(`pptxgen.es.js:3077`, ramo bar/line/pie; os ramos scatter e bubble não têm o bug.) Bisseção (`kcount.sh`):

| Variante | charts no Keynote |
|---|---|
| `chartmin.pptx` (pptxgenjs puro) | 0 |
| rels com Target relativo em vez de `/ppt/charts/...` | 0 |
| pacote pptxgenjs + chart XML do Keynote | 0 |
| pacote do Keynote + chart XML do pptxgenjs | 1 |
| pptxgenjs + xlsx do Keynote | 1 |
| xlsx sem entradas de diretório | 0 |
| xlsx sem `table1.xml` | 1 |
| `ref` corrigido (`fixcharts.py`) → `t7-fixed.pptx` | 1 |
| `charts-fixed.pptx` (11 gráficos) | 5 / 4 / 2 nos 3 slides |

O XML do gráfico do pptxgenjs está correto; o problema é só o `ref`. O PowerPoint não foi testado aqui.

---

## Tabela

### 1. `colW` / `rowH` explícitos: o Keynote respeita exatamente

- XML: `colW` [144, 216, 108] pt → `<a:gridCol w="1828800"/><a:gridCol w="2743200"/><a:gridCol w="1371600"/>`. `rowH` 36 pt → `<a:tr h="457200">`. É `round(in × 914400)`, então 1 pt = 12700 EMU exatos.
- Keynote (4×, `hi-tables/p001.png`): as bordas caem em x = 36 / 180 / 396 / 504 e y = 36 / 72 / 108 / 144 (±0,25 pt). Com `rowH` em array [24, 48, 72], as bordas caem em 180 / 204 / 252 / 324. O frame bate.
- Armadilha: sem `w`/`h`, o `<p:xfrm><a:ext>` sai com `cx="6858000" cy="914400"` (7,5 × 1 in), um valor sem relação com a tabela. O Keynote ignora esse ext para desenhar, mas o frame do objeto fica errado. Com `w = Σ colW` e `h = Σ rowH`, o ext bate (`frame.pptx`). Com `rowH` em array, passar `h` não redistribui as linhas.

### 2. Texto maior que `rowH`

- XML: o `rowH` sai como pedido (`<a:tr h="204470">` = 16,1 pt), sem nenhum ajuste.
- Keynote (`png-tables.002.png`): **a linha cresce**. O texto não vaza e não é cortado, e as linhas de baixo são empurradas, então a tabela fica mais alta que o frame. Medidas:
  - margem 0, 4 linhas quebradas: linha com 64,1 pt (pedido 16,1);
  - margem padrão, 4 linhas: 71,25 pt (= 4 × 16 + 3,6 + 3,6).
- Quebras forçadas: cada run com `breakLine: true` vira um `<a:p>` próprio (não `<a:br/>`), e `'\n'` no texto faz o mesmo. Nenhum `spcBef`/`spcAft` é gravado. Alturas medidas (`hi-tables/p003.png`):
  - margem 0, `rowH` = 3 × 16,1 = 48,3 → 48,1–48,25 medido;
  - margem 4, `rowH` = 48,3 + 8 = 56,3 → 56,4;
  - linhas de 1 linha: 16,1 → 16,0 e 24,1 → 24,0.

  Bate em ±0,25 pt. Quando o conteúdo cabe, o Keynote usa o `rowH` pedido e não encolhe a linha.

### 3. Margem interna da célula: a unidade depende do valor

Regra do pptxgenjs (`pptxgen.es.js:5320`): se `margin[0] >= 1`, o array **inteiro** é lido em pt; senão, o array inteiro é lido em **polegadas**. A ordem é [T, R, B, L].

| `margin` | `<a:tcPr>` (EMU) | Leitura |
|---|---|---|
| (omitido) | `marL="91440" marR="91440" marT="45720" marB="45720"` | padrão [0,05; 0,1] in = T/B 3,6 pt, L/R 7,2 pt |
| `0` | `0 0 0 0` | — |
| `4` | `50800` ×4 | 4 pt |
| `[4,8,4,8]` | T/B `50800`, L/R `101600` | pt |
| `0.1` | `91440` ×4 | **polegadas** (7,2 pt) |
| `[0,4,0,4]` | `marL="3657600"` | **4 polegadas** (bug: margin[0] = 0 < 1) |

Renderização no Keynote (`hi8-tables/p004.png`, `p006.png`):
- **Vertical**: `marT`/`marB` são respeitados.
- **Horizontal**: o Keynote não usa `marL`/`marR` quando eles diferem de `marT`/`marB`. O recuo horizontal medido acompanhou o top/bottom, com piso de cerca de 2,2 pt:

  | Margens pedidas | Recuo horizontal medido |
  |---|---|
  | 0 | ≈2,2 |
  | 4 | ≈4,2 |
  | 7,2 (todas) | ≈7,3 |
  | [4,8,4,8] | ≈4,2 |
  | padrão (T 3,6 / L 7,2) | ≈3,7 |

- Com margem 0, o texto da célula começa 2,5 pt à direita do mesmo texto numa caixa de texto com margem 0.
- O caso de 4 in não foi aplicado pelo Keynote, que caiu no piso de 2,2 pt.

### 4. Estilos

Tudo sai no XML e aparece no Keynote (`png-tables.005.png`):
- `valign` → `anchor="t|ctr|b"`;
- `align` por célula → `algn="l|r|ctr"`;
- `fill` → `<a:solidFill>` no `tcPr`. Não existe fill por linha no pptxgenjs: é fill por célula (o `fill` da tabela vai para todas as células);
- `bold` por célula → `b="1"`;
- `fontSize` → `sz="1400"`. Medido: 20 pt rende 20 pt;
- fonte → `<a:latin typeface="Arial"/>` (e `ea`/`cs`) em cada run;
- `border` solid → `<a:lnL/lnR/lnT/lnB w="6350">` (0,5 pt). `{type:'none'}` → `w="0"` + `<a:noFill/>`. Array [T,R,B,L] funciona: borda só embaixo com 2 pt aparece cheia.

Detalhes:
- Bordas de 0,5 pt saem com cerca de 50% de intensidade no Keynote (preto → `#808080`, `CCCCCC` → `#E0E0E0`). As de 2 pt saem cheias.
- `<a:tblPr/>` vem vazio, sem `tableStyleId`, então não entra listra nem estilo de tema.
- O Keynote importa como **tabela nativa** (`count of tables of slide` = 2/2/3), editável.

### 5. Altura de linha na célula × caixa de texto

- XML: a célula não recebe `<a:lnSpc>`, `spcBef` nem `spcAft` (`<a:bodyPr/>` vazio). Com `lineSpacing` por run, sai `<a:lnSpc><a:spcPts val="1610"/>`.
- Keynote, 14 pt Arial, margem 0 (`hi8-tables/p006.png`):
  - **o passo entre linhas é 16,0 pt**, igual na célula, na caixa sem lnSpc e na caixa com `spcPts 1610` (o Keynote trunca 16,1 → 16, como no M3);
  - a 1ª linha da célula fica 0,25 pt mais baixa que na caixa (irrelevante);
  - não há folga extra de parágrafo.
- Altura automática da linha (rowH = 1 pt, então o Keynote cresce até o conteúdo):
  - texto com "Á" na 1ª linha: 1 linha → 16,5 pt; 5 linhas → 80,5 pt;
  - 4 linhas sem maiúscula acentuada: 64,1 pt;
  - ou seja, n × 16, mais cerca de 0,5 pt quando a 1ª linha tem glifo alto.
- Com o lineHeight da engine (16,1 pt):
  - n ≥ 5: n × 16,1 ≥ o necessário, e o Keynote mantém o `rowH`;
  - 1 linha com "Á": a linha cresce 0,4 pt.
- `lineh.pptx` (10/14/28 pt, com e sem acento) foi feito para fechar essa regra, mas não rodou (ver Pendências).

### 6. `autoPage: false`

- É respeitado e também é o padrão na 4.0.1 (`opt.autoPage = ... : false`).
- 30 linhas × 24 pt a partir de y = 36 ficam num slide só e vazam pela base (`png-tables.007.png`).
- Controle com `autoPage: true`: 2 slides (19 + 11 `<a:tr>`).

---

## Gráfico (todas as medidas em `charts-fixed.pptx`, que tem o xlsx corrigido)

### 7. Frame e margem interna

- XML: o `<p:xfrm>` é exato (20 pt → `254000`; 220 × 160 pt → `2794000 × 2032000`). A área de plotagem sai como `<c:layout/>` (automática).
- O Keynote converte para um gráfico nativo e **recalcula o layout**. O objeto que o Keynote reporta (`position`/`width` via AppleScript) é a área de plotagem.
- Frame pedido (20, 20, 220 × 160), bar ou line, 1 série, sem legenda:
  - plot em (52, 33), 175 × 121;
  - pegada visível (fundo do chartArea) de (23, 19) a (228, 176): +3 à esquerda, **−1 no topo**, −12 à direita, −4 na base;
  - margem do frame até o plot: esq. 32 (rótulos do eixo de valores), topo 13, dir. 13, base 26 (rótulos de categoria). Com legenda embaixo, a base vai a 54.
- Pizza 220 × 160: plot quadrado de 134 × 134, centrado.
- Resumo: o Keynote fica dentro do frame com erro de ~1–12 pt, mas o frame não é exato.
- O efeito do `layout` manual (`<c:manualLayout>`, que o pptxgenjs gera e o próprio Keynote usa ao exportar) ficou pendente.

### 8. Opções (XML × Keynote, `hi-charts/p002.png`, `p003.png`)

| Opção | XML | Keynote |
|---|---|---|
| `chartColors` (sem `#`) | `srgbClr` por série; pizza: um `<c:dPt>` por fatia | ok |
| `showLegend` / `legendPos` r, t, b | `<c:legendPos val="r"/>` | ok |
| `showValue` | `<c:showVal val="1"/>` | ok |
| `dataLabelFontSize` / `catAxisLabelFontSize` / `valAxisLabelFontSize` 9 | `sz="900"` | ok (dígito do eixo com 6,5 pt de altura) |
| `showTitle` / `title` / `titleFontSize` 12 / `titleColor` | `<c:title>` | ok (cap height 8,75 pt) |
| `lineDataSymbol: 'none'` | `<c:symbol val="none"/>` | ok |
| `barGapWidthPct` 50 | `<c:gapWidth val="50"/>` | ok, visível contra o padrão 150 |
| `showPercent: false` (pizza) | `showPercent val="0"` em cada `<c:dLbl>` | ok: só valores (55/30/15) |
| `dataLabelColor` | `srgbClr` no `defRPr` | ok |

Pegadinhas do pptxgenjs:
- **Formato do rótulo**: o padrão para bar/line é `formatCode="#,##0"`, e 38,2 aparece como "38". Use `dataLabelFormatCode`.
- **Cores da pizza**: com menos cores que fatias, a fatia sem cor recebe uma cor **aleatória** (`Math.random` em `pptxgen.es.js:4304`).
- **Cantos arredondados**: `<c:roundedCorners val="1"/>` é o padrão. Desligue com `chartArea: { roundedCorners: false }`.
- **Rótulos da pizza**: há um `<c:dLbls>` de série fixo com `showCatName=1`, `showPercent=1`, `sz=1800`. Ele é sobrescrito pelos `<c:dLbl>` por ponto, e o Keynote respeita os por ponto.
- **Defaults que não se aplicam**: as ternárias de padrão (`showPercent`, `showLegend`...) nunca valem, então tudo que não for passado fica `false`. A pizza sem opções sai sem rótulos.

O que o Keynote ignora: o tamanho exato do frame e da área de plotagem (Q7). Nada das opções acima foi ignorado.

### 9. Editável?

Sim, depois da correção do xlsx. Verificação:
- XML: `<c:chart r:id>` → `chartN.xml`, com `<c:numCache>`/`<c:strCache>` completos e `<c:externalData>` apontando para o xlsx embutido;
- Keynote: `count of charts of slide` = 5/4/2 em `charts-fixed.pptx`, ou seja, objetos de gráfico nativos e não imagens. É a mesma contagem que um gráfico criado no próprio Keynote (`keynote-made.pptx`) dá ao ser reimportado.

Sem a correção, o gráfico some (ver o achado bloqueante).

### 10. Fontes

`catAxisLabelFontFace`, `valAxisLabelFontFace`, `dataLabelFontFace`, `legendFontFace` e `titleFontFace` 'Arial' saem como `<a:latin typeface="Arial"/>` nos `txPr` de catAx, valAx, dLbls, legend e title (8 ocorrências no `chart6.xml`; a legenda também leva `<a:cs>`). Sem essas opções, o pptxgenjs já usa Arial nos rótulos de dados.

---

## Pendências (Keynote travou)

Depois da 1ª rodada, o Keynote passou a não responder a `open` de .pptx: erros -1700, depois -1712 com 120–400 s de timeout. Não havia lock (`/tmp/pptx-ds-keynote.lock`), nenhum processo foi morto e houve várias tentativas espaçadas. Uma janela de ~10 min funcionou (dados de Q7–Q9) e depois travou de novo.

Ficaram sem Keynote:
- `lineh.pptx`: regra exata da altura automática (+0,5 pt por glifo alto?) em 10/14/28 pt;
- `chartlayout-fixed.pptx`: se `layout` manual fixa a área de plotagem.

Para fechar: `$S/rerun.sh` (exporta e mede) ou `kpdf.sh` + `scan.py`.

---

## Recomendações para o contrato M10-0

1. **Gráfico — obrigatório**: o emissor precisa corrigir o xlsx embutido depois do `pptx.write()`. Como fazer: em cada `ppt/embeddings/*.xlsx`, trocar `ref="A1:X9'"` por `ref="A1:X9"` em `xl/tables/table1.xml`, como faz o `fixcharts.py`.
   - O lugar é a borda de IO (`render`/emit), com JSZip, que já é dependência do pptxgenjs.
   - Alternativa: `patch-package` na linha 3077.
   - Sem isso, `<Chart>` não aparece no Keynote. Vale um teste que abra o .pptx e verifique o `ref`.
2. **Unidades da tabela**:
   - `x`, `y`, `w`, `h`, `colW` e `rowH` em polegadas (`pt / 72`);
   - sempre passar `w = Σ colW` e `h = Σ rowH`, para o `<p:xfrm>` bater;
   - `margin` **sempre em polegadas** (`pt / 72`), como array [T,R,B,L]. Funciona para qualquer padding < 72 pt; validar `cellPadding < 72`. Em pt quebra quando o topo é < 1 (`[0,4,0,4]` vira 4 in).
3. **Padding da célula**: uniforme (`cellPadding` único nos 4 lados), padrão **4 pt**.
   - O Keynote não aplica L/R diferentes de T/B.
   - Abaixo de ~2,2 pt, o Keynote recua mesmo assim, o que muda a largura útil e a quebra.
   - Com 4 uniforme, o recuo medido foi ≈4,2 à esquerda e ≈4,4 à direita (glifo com alinhamento à direita).
   - Largura de quebra no medidor: `colW − 2·cellPadding`.
4. **`rowH`**: a engine deve calcular e **mandar explícito**, com `rowH[i] = linhas × lineHeight + 2·cellPadding`, e não deixar automático.
   - O Keynote respeita o `rowH` quando o conteúdo cabe e só cresce quando falta espaço.
   - A diferença esperada é de no máximo ~0,5 pt por linha de tabela (passo de 16,0 no Keynote contra 16,1 da engine; +0,5 com maiúscula acentuada na 1ª linha).
   - Para ter folga, sugiro arredondar cada `rowH` para cima ao 0,5 pt.
5. **Quebras**: mandar o texto já quebrado pela engine, uma run por linha com `breakLine: true` (vira um `<a:p>` por linha, sem spcBef/spcAft), mesma estratégia do `Text`.
   - Não precisa de `lineSpacing` na célula: o passo natural do Keynote já é igual ao da caixa de texto.
   - Se o M3 exigir `spcPts`, ele funciona por run.
6. **Tabela — demais opções**:
   - `autoPage: false` sempre explícito;
   - `valign: 'top'`;
   - `fontFace`/`fontSize`/`color` na tabela;
   - `bold`/`fill`/`color`/`align` por célula (cabeçalho, listra e alinhamento de coluna são resolvidos pela engine);
   - `border` como array [T,R,B,L] com `{type:'none'}` onde não houver borda;
   - borda de 0,5 pt sai clara no Keynote; considerar 0,75–1 pt como padrão.
7. **Gráfico — opções que valem**:
   - `chartColors` sempre com **uma cor por série (bar/line) ou por fatia (pie)**, ciclando a paleta na engine para evitar a cor aleatória;
   - `chartArea: { roundedCorners: false }`;
   - `showLegend`/`legendPos`;
   - `showValue` + `dataLabelFormatCode` (derivar das casas decimais dos dados, por ex. `'#,##0.0'`; o padrão `#,##0` arredonda);
   - `dataLabelFontSize`/`catAxisLabelFontSize`/`valAxisLabelFontSize`/`legendFontSize`, com os `*FontFace` explícitos e `*Color`;
   - `showTitle`/`title`/`titleFontSize`;
   - `line`: `lineDataSymbol: 'none'`; `bar`: `barGapWidthPct` (padrão 150; ~50–80 fica mais denso);
   - `pie`: `showPercent: false` + `showValue`.
8. **Frame do gráfico**: tratar como "caixa onde o gráfico cabe", não como pixel exato.
   - O Keynote recalcula o plot e fica ~1 pt acima do topo e até ~12 pt dentro à direita.
   - O preview SVG não deve gerar diagnóstico de divergência (já previsto). Reservar o frame inteiro no layout.
   - Testar `layout` manual antes de prometer área de plotagem fixa.
9. **O que o Keynote ignora ou altera**: tamanho exato do frame e do plot do gráfico; `marL`/`marR` diferentes de `marT`/`marB` e o recuo horizontal abaixo de ~2,2 pt; frações de pt no passo de linha (trunca para pt inteiro); intensidade de bordas finas. Não ignorou nenhuma das opções de gráfico listadas, depois de corrigido o xlsx.
