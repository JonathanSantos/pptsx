# M10-H — Validação visual: `<Chart>` e `<Table>` nativos × Keynote

**Veredito: GO** para a parte Keynote do critério do M10. A parte PowerPoint fica com o dono (lista no fim).

- **Gráficos:** o Keynote reconhece todos os 7 gráficos como objetos de gráfico nativos, e nenhum vira imagem. São 1 na demo e 3 em `charts.tsx`, nos dois tamanhos. Verifiquei por AppleScript: `count of charts` = 1 e `count of images` = 0 em cada slide.
- **Cores, legenda, título e rótulos** aparecem como pedido.
- **Rótulos da demo:** saem "38,2 · 41,5 · 45,9 · 52,4", com vírgula decimal (idioma do Keynote) e uma casa (`formatCode="0.0"`).
- **Tabelas:**
  - O Keynote importa todas como tabela nativa (`count of tables`), com as mesmas linhas e colunas.
  - As larguras de coluna são exatas.
  - A altura das linhas fica entre **+0,0 e +0,40 pt** acima do `rowHeights` do nativo, dentro da meta de ±0,5 pt por linha.
  - As quebras das células são iguais às do preview, e nenhuma célula vaza.
  - `text-shrunk`, `table-overflow` e a paginação se comportam como o diagnóstico diz.
- **Bugs do M10:** nenhum bloqueante. Há 4 achados menores (abaixo).

## Ambiente

- macOS (Darwin 25.6), Keynote 14.4, Node 24 + tsx.
- Scratchpad: `S=/private/tmp/claude-503/-Users-jovivo-Developer-projects-pptsx/595f004f-084b-4a21-899b-ab3693778f22/scratchpad/m10h`.
- **Código validado:** um snapshot de `072deb3` (`git archive 072deb3` em `$S/repo`, com `node_modules` linkado). O `src/` do snapshot é igual ao de `05c1e5e`.
  - Por que não o checkout: durante a validação entrou `18c3420` (M11-0, mudanças em `src/core`), e o working tree está com o M11 em andamento (`src/emit`, `src/fit` modificados).
  - O 1º build de `charts.tsx` feito no checkout já com o M11-0 deu `text-overflow` com "NaN pt" no título dos 3 slides. Isso **não é do M10**: no snapshot, o mesmo deck sai sem diagnóstico. Fica o aviso ao orquestrador de que o checkout atual não reproduz o M10.
- **Keynote:** nenhuma falha de AppleEvent; tudo rodou na 1ª tentativa. Todos os documentos abertos foram fechados com `close … saving no`.
- **Medição:**
  - PNG do `keynote-export.sh` (720 px de largura, 1 px = 1 pt).
  - PDF exportado pelo Keynote e rasterizado a 4× (1 px = 0,25 pt).
  - Propriedades do Keynote por AppleScript: `height of row`, `width of column`, `position/width/height of chart`, `font size of cell`.
  - Nativo: `render(..., { includePositioned: true })`.
  - XML: `<a:tr h>`, `<a:gridCol w>`, em EMU/12700.

## 1. Demo (`examples/demo.tsx`, 16x9 e 4x3) — "Nenhum diagnóstico"

### Slide 3 — gráfico de barras

| | 16x9 | 4x3 |
|---|---|---|
| Keynote: charts / images no slide | 1 / 0 | 1 / 0 |
| Barras | 4, cor accent | 4 |
| Rótulos de valor | 38,2 · 41,5 · 45,9 · 52,4 | idem |
| Eixo de valores (Keynote) | 0,0 · 15,0 · 30,0 · 45,0 · 60,0 | idem |
| Grade horizontal | sim, clara | sim |
| Legenda | não há (sem `<c:legend>`) | não há |
| Frame nativo (x, y, w × h) | 344,5, 106,8, 335,5 × 258,2 | 40, 214,1, 640 × 285,9 |
| Área de plotagem no Keynote | 386, 120, 281 × 219 | 82, 227, 585 × 247 |
| Margem frame → plot (esq./topo/dir./base) | 41,5 / 13,2 / 13,0 / 26,0 | 42,0 / 12,9 / 13,0 / 26,0 |

- **Decimal:** o Keynote mostra o decimal com **vírgula** ("38,2"). O preview mostra **ponto** ("38.2"). Veja o achado 2.
- **Eixo:** o `valAxisLabelFormatCode` também é `0.0`, então o eixo sai "60,0", enquanto o preview mostra "60".
- **Escala:** o Keynote escolhe o passo do eixo (15) e o preview usa números "bonitos" (20). Isso já era esperado.
- **Margens:** o Keynote redesenha o plot dentro do frame com as mesmas margens do spike (≈ 42/13/13/26 pt, e a base vai a 56 com legenda). Não há nada fora do frame.
- **XML:** `<c:barChart>`, `gapWidth 80`, `roundedCorners 0`, e o `ref` do xlsx embutido é `A1:B5` (sem apóstrofo).

### Slide 5 — tabela (cabeçalho + 6 linhas × 4 colunas)

| | 16x9 (14 pt, padding 4) | 4x3 (16 pt, padding 4) |
|---|---|---|
| Keynote: tables / linhas × colunas | 1 / 7 × 4 | 1 / 7 × 4 |
| `columnWidths` nativo = Keynote | 256 / 128 / 128 / 128 | 256 / 128 / 128 / 128 |
| `rowHeights` nativo | 24,10 × 7 | 26,40 × 7 |
| `<a:tr h>` (arredondado para cima a 0,5) | 24,5 | 26,5 |
| Keynote `height of row` | 24,5 × 7 | 26,5 × 7 |
| Passo medido no PDF 4× (bordas) | 24,50 (107,0 → 278,5) | 26,50 (107,0 → 292,5) |
| **Δ por linha (Keynote − nativo)** | **+0,40** | **+0,10** |
| Altura total nativo → Keynote | 168,7 → 171,5 | 184,8 → 185,5 |
| Fonte da célula no Keynote | ArialMT 14 | ArialMT 16 |

- **Estilo:** cabeçalho em `brand` (#1B2A4A) com texto branco em negrito, zebra em `surface` nas linhas pares de dados e grade completa.
- **Bordas:** a borda de 0,5 pt #5B6680 sai como #A8B0C0 no Keynote, o clareamento de ~50% já conhecido do spike.
- **Texto dentro da célula:**
  - 2ª linha, "Varejo": a tinta começa em y = 138,25 no Keynote e 137,56 no preview, ou seja, Δ +0,7 pt, dos quais +0,6 vêm do topo da linha.
  - 7ª linha: Δ +2,6 pt, que é o acúmulo de 6 × 0,40.
  - O recuo à esquerda difere ≤ 0,5 pt.
- **Quebras:** todas as células têm 1 linha nos dois lados. Nada vaza nem é cortado.

## 2. `examples/charts.tsx` (16x9 e 4x3) — "Nenhum diagnóstico"

| Slide | Keynote charts / images | Cores | Legenda | Título | Rótulos | Plot no Keynote (16x9 · 4x3) |
|---|---|---|---|---|---|---|
| 1 bar, 2 séries | 1 / 0 (nos 2 tamanhos) | accent e muted | embaixo: Realizado, Meta | "Receita recorrente (R$ mi)" no topo | 38,2 40,0 41,5 42,0 45,9 45,0 52,4 50,0 | 82, 148, 585 × 161 · 82, 148, 585 × 296 |
| 2 line, 2 séries | 1 / 0 | accent e negative | embaixo (padrão de 2 séries) | — | sem rótulos (não pedidos); eixo 0–700 passo 175; sem marcadores (`symbol none`) | 78, 120, 589 × 189 · 78, 120, 589 × 324 |
| 3 pie | 1 / 0 | paleta padrão, 1 cor por fatia (azul, âmbar, verde, vermelho; igual ao preview) | embaixo, 4 categorias | — | 4,0 · 0,6 · 0,7 · 1,2, sem % | 273, 120, 175 × 175 · 214, 120, 292 × 292 (centrada) |

- **Margens do frame** (40, 106,8, 640 × 258,2 em 16x9):
  - bar com título e legenda: esq. 42, topo 41, dir. 13, base 56;
  - line com legenda: 38 / 13 / 13 / 56.
- **Pizza:** no Keynote ela é menor que no preview (diâmetro 175 contra ≈214 pt em 16x9).
- **Renumeração:** os dois `.pptx` saem do mesmo processo, e o 4x3 também tem `chart1..3.xml` e `Microsoft_Excel_Worksheet1..3.xlsx`. Os `.rels` dos slides apontam para `chart1`, `chart2` e `chart3` na ordem dos slides (bar, line, pie), e o `[Content_Types]` tem `chart1..3`.
- **`ref` dos 3 xlsx:** `A1:C5`, `A1:C7` e `A1:B5`, todos sem apóstrofo.
- **Editável:** o critério foi o Keynote classificar o objeto como `chart` (AppleScript `count of charts of slide`). É a mesma verificação do spike, que separa um gráfico nativo do slide vazio e de uma imagem.

## 3. `examples/probe/table.tsx` (16x9, `--debug`) — exit 1 de propósito (2 error, 1 info)

| Slide | Diagnóstico | Nativo | XML / Keynote | Resultado no Keynote |
|---|---|---|---|---|
| 1 | `text-shrunk` 14 → **12 pt** | 13 × 17,80 = 231,4 (Box 240) | `tr h` 18,0; o Keynote **cresce para 18,107** (+0,31 por linha); 12 pt na célula | tabela de 235,4 pt **cabe** no Box de 240 (sobram 4,6 pt) |
| 2 | `table-overflow`: 41,5 pt (25,9%) em 10 pt, "9 de 12 linhas" | 13 × 15,50 = 201,5; frame 160 | `tr h` 15,5 = Keynote (Δ 0) | sai **inteira** (13 linhas, 201,5 pt) e passa da borda do Box em 41,5 pt; a borda cai depois de Jun/2026, a 9ª linha de dados, como o diagnóstico diz |
| 3 | `table-overflow`: 73,3 pt (30,5%) em 14 pt (`fit="error"`), "8 de 12" | 13 × 24,10 = 313,3; frame 240 | `tr h` 24,5 = Keynote (+0,40) | sai inteira, 318,5 pt, e passa da **base do slide** (106,8 + 318,5 = 425 > 405) |

- **Preview `--debug`:** a tabela é cortada no frame e a faixa vermelha de estouro aparece abaixo.
  - Slide 2: de 266,8 a 308,3 pt, ou seja, 41,5 pt.
  - Slide 3: idem até a base.
- **Overview:** os slides 2 e 3 têm o selo de erro e o slide 1 não tem (é info).
- **Contorno de debug no `.pptx`:** a linha tracejada do frame da tabela fica na altura do nativo. No slide 1 do Keynote, a última linha passa ~4 pt dessa linha, pelo arredondamento visto no achado 1, mas continua dentro do Box.

## 4. Paginação com tabela (deck mínimo `$S/repo/examples/m10h/paged-tables.tsx`, 16x9)

- **Deck:** 6 blocos (`Text` 14 pt + `Table` com 3 colunas, cabeçalho e 3 linhas) num `<Box paginate gap={12}>`.
- **Diagnóstico:** só `slide-continued` (info): "virou 3 slides (2/2/2)". Não há `error` nem `text-shrunk`.
- **Nativo:** as 6 tabelas ficam em **14 pt**, com `rowHeights` de 24,10 × 4.
- **Keynote:** 3 slides com `tables = 2` cada, todas com `font size` 14 e `row height` 24,5. As tabelas terminam em y ≈ 353 pt, com o corpo indo até 365, então nada vaza.

### Extra — quebras dentro da célula (`$S/repo/examples/m10h/wrap-table.tsx`, 16x9)

| Linha | Linhas por célula | Nativo | Keynote | Δ |
|---|---|---|---|---|
| Cabeçalho | 1 | 24,10 | 24,5 | +0,40 |
| Catálogo | 1 / **2** / 1 | 40,20 | 40,5 | +0,30 |
| Alertas | 1 / **3** / 1 | 56,30 | 56,5 | +0,20 |
| SLA | 1 / 1 / **3** ("Carla / Mendes / Rodrigues") | 56,30 | 56,5 | +0,20 |

As quebras do Keynote são palavra por palavra iguais às do preview, e o Keynote não requebrou nenhuma linha.

## Achados

1. **Desvio acumulado da altura da tabela (menor, conhecido).**
   - O `rowH` emitido é arredondado para cima a 0,5 pt, e o Keynote o mantém. Com isso, a tabela no Keynote fica até 0,40 pt × linhas mais alta que a do layout: +2,8 pt na demo (7 linhas) e +5,2 pt no probe 3 (13 linhas).
   - Em 12 pt o arredondamento não basta: o Keynote ainda cresce 18,0 → 18,107, porque o passo dele é ~14,1 contra 13,8 da engine. O total fica em +0,31 por linha, ainda dentro da meta.
   - Risco: uma tabela que "cabe" com menos de ~0,4 pt × linhas de folga pode passar do Box no Keynote, sem diagnóstico.
   - Sugestão (`src/fit/`): comparar a altura disponível com `Σ ceil₀,₅(rowHeights)` em vez de `Σ rowHeights`, ou usar a altura arredondada também no layout.
2. **O preview formata números de outro jeito (cosmético).**
   - No nativo, o Keynote mostra "38,2", "40,0" e "4,0" (vírgula do idioma + `formatCode`). O preview mostra "38.2", "40" e "4".
   - Onde: `src/preview/` (chartSvg).
   - Sugestão: formatar com as mesmas casas do `dataLabelFormatCode` e o separador decimal do `lang` (`Intl.NumberFormat(lang, { minimumFractionDigits: d, maximumFractionDigits: d })`).
3. **O eixo de valores herda o formato dos rótulos (cosmético).**
   - `valAxisLabelFormatCode = 0.0` faz o eixo mostrar "0,0 · 15,0 · … · 60,0" (demo e charts slide 1).
   - Onde: `src/emit/` (opções do `addChart`).
   - Sugestão: no eixo, usar `'0'` ou `General` quando o passo for inteiro, ou só `General`. É uma decisão de contrato (CONTRACTS diz "idem").
4. **A pizza do Keynote é menor que a do preview** (175 contra ≈214 pt de diâmetro em 16x9). O Keynote reserva espaço para a legenda e as margens. Não precisa de ação, porque o contrato não promete fidelidade, mas vale citar no guia: "o renderizador redesenha a área de plotagem".

## Comandos

```bash
S=…/scratchpad/m10h; R=$S/repo
git archive 072deb3 | tar -x -C $R && ln -s "$PWD/node_modules" $R/node_modules
cd $R
npx tsx src/cli.ts build examples/demo.tsx --size 16x9,4x3 --out $S/demo
npx tsx src/cli.ts build examples/charts.tsx --size 16x9,4x3 --out $S/charts
npx tsx src/cli.ts build examples/probe/table.tsx --size 16x9 --debug --out $S/probe   # exit 1 esperado
npx tsx src/cli.ts build examples/m10h/paged-tables.tsx --size 16x9 --out $S/paged
npx tsx src/cli.ts build examples/m10h/wrap-table.tsx --size 16x9 --out $S/wrap
npx tsx $S/tools/dump.mts <deck.tsx> 16x9,4x3                  # rowHeights/columnWidths/frames do nativo (includePositioned)
scripts/keynote-export.sh $S/demo/demo.16x9.pptx $S/k-demo-16x9   # PNG 720 px (idem 4x3)
$S/tools/kinfo.sh <pptx> <pdf>   # Keynote: charts/tables/images por slide, plot do chart, row heights, col widths, font size; exporta PDF
$S/tools/raster <pdf> <dir> 4    # PDF → PNG 4×
python3 $S/tools/scan.py <png> v <x_pt> 4    # transições de cor ao longo de uma coluna (bordas das linhas)
python3 $S/tools/ink.py <png> <escala> x0 y0 x1 y1    # bbox da tinta (texto) numa região
```

## Para o PowerPoint (dono)

1. **Gráficos editáveis:** abrir `demo.16x9.pptx`, `demo.4x3.pptx`, `charts.16x9.pptx` e `charts.4x3.pptx`. Os gráficos devem abrir como gráfico ("Editar dados" abre a planilha), e não como imagem.
2. **Ordem dos gráficos após a renumeração:** em `charts.4x3.pptx`, que é o 2º arquivo do mesmo processo, os slides 1/2/3 devem mostrar bar/line/pie, nessa ordem, com os dados certos. "Editar dados" de cada gráfico deve abrir a planilha **daquele** gráfico (Worksheet1/2/3).
3. **`ref` do xlsx:** "Editar dados" não pode dar erro de reparo ("PowerPoint encontrou um problema no conteúdo…"). A tabela da planilha deve cobrir A1:B5 (demo) e A1:C5 / A1:C7 / A1:B5 (charts).
4. **Decimais dos rótulos:** com Windows/Office em pt-BR, conferir "38,2 … 52,4" e "40,0". No eixo, "60,0" (achado 3). Com o idioma em inglês, deve sair com ponto.
5. **Altura das linhas da tabela:** demo slide 5 em 24,5 pt (16x9) e 26,5 pt (4x3), conferindo em Layout da Tabela → Altura. Ver se o PowerPoint **cresce** alguma linha, principalmente:
   - probe slide 1 (12 pt, `rowH` 18,0; o Keynote cresceu para 18,11);
   - as linhas de 3 linhas do `wrap-table` (56,5).
6. **Tabela sem estilo de tema:** o `<a:tblPr/>` vem vazio, então não deve entrar listra nem estilo do tema. A zebra vem do `fill` por célula.
7. **Margem horizontal da célula:** o PowerPoint, ao contrário do Keynote, respeita L/R = 4 pt. Conferir se nenhuma célula requebra (a coluna "Dono" do `wrap-table`, de 90 pt, é a mais apertada).
8. **Probe slides 2 e 3:** a tabela deve sair inteira e vazar, como no Keynote (`autoPage: false`, sem slide extra).
