# M11-G — Validação visual do motor CSS: demo antiga × legada × CSS, Keynote, recalibração do `lineHeight`

**Veredito: GO com ressalvas** para a parte visual do "Pronto quando" do M11.

- **Demo, preview nativo.** A legada (props antigas como alias) e a CSS geram os mesmos PNGs da engine anterior (072deb3) em ±1 pt nos 18 slides × tamanhos. Há três exceções.
  - **Ressalva 1.** A tabela do slide 5 mudou as **larguras das colunas**: elas agora seguem o conteúdo, como `table-layout: auto` (P2), e variam até 26,8 pt. Isso fica fora da lista de exceções do gate, que só cita as linhas da tabela. O `CONTRACTS.md` §M10 ainda diz que as colunas sem `width` "dividem igualmente".
  - As outras duas exceções já estavam previstas: o separador decimal dos rótulos do gráfico e a ordem de pintura da elipse no deck legado.
- **Keynote.** As 8 exportações e os 2 PDFs de calibração passaram na 1ª tentativa e batem com o preview, inclusive:
  - bordas por lado dentro da caixa (medidas em ±0,25 pt);
  - sombra, rotação, opacidade, `zIndex`, grid, wrap e `display` responsivo;
  - Chart/Table nativos.
- **Recalibração.**
  - Linhas: `calibration.tsx` **34/34** (33 pelo PDFKit; C05 conferida por imagem, como na PoC) e `calibration-rich.tsx` **30/30**.
  - Passo das linhas com `lineHeight` numérico: igual ao `spcPts` quando o valor é inteiro. O Keynote trunca o fracionário (16,8 → 16), o que dá −0,4 a −0,8 pt por linha. É o mesmo truncamento que vale para `'normal'` desde o M3.
  - **Ressalva 2: 1ª baseline.** O Keynote põe a baseline em ≈ 0,8 × ⌊spcPts⌋ e não na meia-entrelinha do CSS. Com `lineHeight` 1.5 o texto fica **1,5 a 2,3 pt mais baixo** que no nativo; com 1.0, 0,4 pt mais alto. Nenhum exemplo fora da calibração usa `lineHeight` numérico.

## Ambiente

- macOS (Darwin 25.6), Keynote 14.4, Node + tsx. Tudo em `S=<scratchpad>/m11g`.
- **Keynote:**
  - Usei a trava `/tmp/pptx-ds-keynote.lock` (`mkdir` + pid), com até 3 tentativas de 30 s.
  - O `/tmp/pptx-ds-keynote.pause` de 13/10 23:47 continua órfão (sem trava ativa) e não foi respeitado, como no M9.
  - Nenhum erro de AppleEvent; todos os documentos foram fechados com `saving no`. Nada ficou sem validação real.

## 1. Demo: antiga (072deb3) × legada × CSS, preview nativo

Comparação feita pelo hash dos PNGs e, quando os hashes diferem, por pixel (|Δ| > 24 em algum canal) e pelos frames da árvore posicionada (`includePositioned`).

| slide | 16x9 | 4x3 | wide | antiga → legada | legada → CSS |
|---|---|---|---|---|---|
| 1 capa | = = = | = = = | = = = | idênticos | idênticos |
| 2 bullets | A=L≠C | A=L≠C | A=L≠C | idênticos | só a barra do título (33 px; ver abaixo) |
| 3 gráfico | A≠L≠C | A≠L≠C | A≠L≠C | rótulos "38.2" → "38,2" (preview com `Intl`, M11-D); 29 px | só a barra do título |
| 4 KPIs | A=L≠C | A=L≠C | A=L≠C | idênticos | só a barra do título (a nota com `borderLeft` sai idêntica à Box row + Shape) |
| 5 tabela | A≠L≠C | A≠L≠C | A≠L≠C | **tabela**: linhas e colunas (abaixo); 42 mil px | só a barra do título |
| 6 encerramento | = = = | A≠L, C=A | = = = | 4x3: 11 px; a elipse decorativa sem `zIndex` pinta por cima do descendente do "p" de "para" (decisão 1) | 4x3: a CSS (`zIndex={-1}`) volta a ser idêntica à antiga |

(A = antiga, L = legada, C = CSS; "=" quer dizer hash do PNG igual.)

- **Frames:**
  - Antiga × legada: todos os nós iguais (±1 pt, mesmas linhas e tamanhos), menos a Table do slide 5.
  - Legada × CSS: casando os textos pelo conteúdo e comparando a área de conteúdo (frame − borda − padding), **todos os textos ficam a ±1 pt**, com o mesmo size e o mesmo `lineHeight`. Gráficos e tabelas têm frames iguais.
- **Barra do título:**
  - Legada: Shape 6 × 36 em y = 40,4.
  - CSS: `borderLeft` de 6 pt com a altura do Text (36,8) em y = 40.
  - Diferença: 0,8 pt na altura e 0,4 pt no topo (dentro de ±1 pt).
  - A nota do slide 4 (`borderLeft` 4 + `paddingLeft` 14) não muda nenhum pixel.
- **Tabela (slide 5), antiga → legada (= CSS):**

| tamanho | colunas (pt) | linhas (pt) | altura total |
|---|---|---|---|
| 16x9 | 256/128/128/128 → 256/141,4/141,4/101,2 | 24,1 → 24,5 | 168,7 → 171,5 (+2,8) |
| 4x3 | 256/128/128/128 → 256/141,6/141,6/100,8 | 26,4 → 26,5 | +0,7 |
| wide | 352/176/176/176 → 352/194,7/194,7/138,6 | 26,4 → 26,5 | +0,7 |

  - As linhas sobem pelo arredondamento a 0,5 pt, que está previsto.
  - As **colunas** mudam porque as colunas sem `width` passaram a seguir o conteúdo ("Δ" estreita, Q2/Q3 mais largas). O AGENT_GUIDE §4 já documenta isso, mas o gate não lista essa exceção e `CONTRACTS.md` linha ~398 (`columnWidthsOf`) ainda descreve a divisão igual. O Keynote desenha as colunas novas igual ao preview.

## 2. Keynote × preview nativo

Exportados como PNG (`scripts/keynote-export.sh`). Também gerei PDFs (`keynote-pdf.sh`), rasterizados a 4 px/pt para medir.

| deck | slides | resultado |
|---|---|---|
| `demo` 16x9 / 4x3 | 6 / 6 | Igual ao preview, incluindo a barra do título por `borderLeft`, a nota com `borderLeft` e o negrito "novembro". A elipse do slide 6 fica atrás do texto (`zIndex={-1}`). Gráfico com "38,2…52,4" e eixo 0/15/30/45/60 sem casas (o achado 3 do M10 está resolvido). Tabela nativa com as colunas novas. |
| `showcase` 16x9 / 4x3 | 4 / 4 | Igual ao preview (ver medidas abaixo). |
| `long-list` 16x9 | 4 (paginado 3 + fim) | Mesmas quebras e posições em todos os bullets. |
| `charts` 16x9 | 3 | Bar, line e pie nativos. Diferenças só da escala automática e do redesenho do plot pelo Keynote (eixo 0–60 em passo 15, 0–700 em passo 175, pizza menor, legenda em bolinhas), como já registrado no M10. |
| `layout-test` CSS / legado 16x9 | 3 / 3 | Os dois abrem. Ver §4. |

Medidas no raster do PDF do Keynote, a 4 px/pt (resolução de 0,25 pt):

- **Bordas por lado, dentro do border-box** (`showcase` slide 4):
  - `borderTop` 4 pt: y 162,0–165,75 e x 36–252 (layout: 161,8–165,8 e 36–252).
  - Pontilhada de 2 pt: traço em x 268–270, x 486–488 e y 161,75–163,75 (layout: caixa 268–488 a partir de y 161,8). O traço fica dentro.
  - Tracejada de 1 pt embaixo: presente em y ≈ 235 (layout: 234,6–235,6).
  - Título com `borderLeft` 5 pt: x 36–41 e y 36–65,75 (layout: 36–41 e 36–65,9).
- **Sombra** (`showcase` slide 2, cartão 1, abaixo da borda): o cinza do Keynote fica a ≤ 2 níveis do preview de 1 a 9 pt, com a mesma queda (Keynote 220/224/229/234/241, preview 222/226/229/235/240; fundo 246).
- **Rotação e transparência:**
  - Slide 1: caixa de 18° com opacidade 0,35 sobre a elipse.
  - Slide 4: caixa de −8° com opacidade 0,6 e o texto "z 3 · −8°" girando junto.
  - Ângulos e cores iguais ao preview.
- **Ordem de camadas:**
  - Slide 4: âmbar (z 2) sobre verde (z 1), cinza translúcido (z 3) por cima.
  - Slide 1: a elipse com z −1 fica atrás de tudo.
- **Grid:** 3 × 2 em 16x9 e 2 × 3 em 4x3 (KPIs). A coluna `auto` com span 2 e a faixa `2 / -1` (slide 3) ficam no mesmo lugar.
- **Tags com wrap:** quebram nas mesmas 2 linhas, com o fundo arredondado.
- **`display` responsivo:** a nota "Em 4:3 a grade passa a ter 2 colunas…" aparece só em 4x3, no Keynote e no preview.
- **Divergências:** nenhuma nova. Valem só as do gráfico, citadas na tabela acima, que o contrato não promete.

## 3. Recalibração do `lineHeight` (decisão 2)

Usei `scripts/calibration/h2.ts`, que roda sem ajuste. O `import type` de `../types.ts`, resto da PoC, aponta para um arquivo que não existe, mas é apagado pelo tsx. O `pdflines.swift` imprime ~1 MB de log do `swift-frontend` (`attributedStringScaled`) no stderr, o que é cosmético.

- **Linhas:**
  - `calibration`: 33/34 pelo PDFKit. A C05, parágrafo com linha vazia, é o artefato de extração conhecido. No raster as 5 linhas estão certas e separadas: **34/34**.
  - `calibration-rich`: **30/30**. O R20 (`nowrap`) sai em 1 linha.
- **XML:** cada amostra numérica grava `<a:lnSpc><a:spcPts>` exato (1680, 1800, 2880, 2700, 2100, 1440, 1800, 2160, 2700, 2160).
- **Método da baseline:**
  - Keynote: raster do PDF a 4 px/pt. Por linha, a baseline é a linha de pixels com a maior queda de tinta numa faixa de ±0,45 × size em torno da baseline da engine (`$S/tools/baselines.swift`).
  - Nativo: o mesmo algoritmo no PNG do preview (0,75 pt/px). O nativo bate com a engine em ≤ 0,3 pt em todas.

Amostras com `lineHeight` numérico (b1 = 1ª baseline medida do topo da caixa de texto):

| id | size · lh | passo engine = nativo | passo Keynote | altura nativa → Keynote | Δ/linha | b1 nativo | b1 Keynote | Δ b1 |
|---|---|---|---|---|---|---|---|---|
| C06 | 14 · 1.2 | 16,8 | 16 | 50,4 → 48 | −0,8 | 13,03 | 12,96 | −0,06 |
| C07 | 12 · 1.5 | 18 | 18 | 36 → 36 | 0 | 12,96 | 14,46 | **+1,50** |
| C11 | 24 · 1.2 | 28,8 | 28 | 57,6 → 56 | −0,8 | 22,33 | 22,41 | +0,08 |
| C12 | 18 · 1.5 | 27 | 27 | 54 → 54 | 0 | 19,45 | 21,67 | **+2,22** |
| C24 | 14 · 1.5 | 21 | 21 | 105 → 105 | 0 | 15,13 | 16,81 | **+1,68** |
| C25 | 12 · 1.2 | 14,4 | 14 | 43,2 → 42 | −0,4 | 11,16 | 11,30 | +0,14 |
| C29 | 18 · 1 | 18 | 18 | 54 → 54 | 0 | 14,95 | 14,51 | −0,44 |
| C30 | 18 · 1.2 | 21,6 | 21 | 64,8 → 63 | −0,6 | 16,75 | 17,01 | +0,26 |
| C31 | 18 · 1.5 | 27 | 27 | 81 → 81 | 0 | 19,45 | 21,76 | **+2,31** |
| R12 | 18 · 1.2 | 21,6 | 21 | 64,8 → 63 | −0,6 | 16,75 | 16,91 | +0,16 |

("Altura Keynote" = n × passo medido.)

- **Passo:**
  - Igual ao `spcPts` quando o valor é inteiro (6/10).
  - Fracionário: o Keynote trunca, de −0,4 a −0,8 pt por linha, o que passa de ±0,5 em C06, C11, C30 e R12.
  - É a mesma regra das amostras `'normal'` (13,8 → 13, 20,7 → 20), aceita desde o M3.
  - O texto nunca fica mais alto que a caixa.
- **1ª baseline:** o Keynote segue **b1 ≈ 0,8 × ⌊spcPts⌋**, com erro de ±0,2 pt nas 10 amostras e também nas `'normal'` (C04: 13,0 contra 0,8 × 16 = 12,8).
  - A meia-entrelinha do CSS (ascent + (lh − natural)/2) só coincide com isso perto de 1.2.
  - Com 1.5, o Keynote desenha 1,5 a 2,3 pt mais baixo. Com 1.0, 0,4 pt mais alto.
  - A última linha continua dentro da caixa: em C31, a base do descendente fica em 79,4 numa caixa de 81.

## 4. Breakpoints e aliases: `layout-test` CSS × legado (Keynote 16x9)

- **Os dois abrem e exportam.** Slides 1 e 3 iguais entre si e ao preview.
- **Slide 2, caixas das imagens:**
  - CSS `border="1px solid …"`: `<a:ln w="12700">` (1 pt) com a forma recuada 0,5 pt por lado (`off` +6350 EMU, `ext` −12700 EMU), traço dentro do border-box.
  - Alias `stroke`: o mesmo `ln` de 1 pt na aresta do frame, ½ pt para fora.
  - A borda CSS também reduz a área de conteúdo em 1 pt por lado, e por isso o `contain` da imagem muda de leve (`srcRect` −21257 contra −20766).
  - No Keynote, a diferença visível é ≤ 1 pt por lado.
- **Ordem de pintura:**
  - No deck legado, a elipse decorativa (absoluta, sem `zIndex`) pinta por cima da caixa da imagem, pela decisão 1.
  - No deck CSS, `zIndex={-1}` a mantém atrás.
  - Keynote e preview concordam nos dois decks.

## Bugs e achados

1. **1ª baseline com `lineHeight` numérico ≥ 1.5 no Keynote** (`src/emit/calibration.ts` / `src/emit/options.ts`).
   - O texto sai até 2,3 pt mais baixo que no nativo (C31, 18 pt, `lineHeight` 1.5) porque o Keynote põe b1 em 0,8 × lnSpc.
   - Sugestão (M12, depois de conferir no PowerPoint, que deve usar a mesma regra de "Exatamente"): para `lineHeight` numérico, o emissor sobe a caixa de texto em `0,8 × ⌊lh⌋ − (ascent + meia-entrelinha)` e aumenta a altura na mesma medida. Outra saída é documentar no guia que o renderizador ignora a meia-entrelinha.
2. **Colunas auto da Table fora do gate e do contrato.**
   - A demo muda as colunas em até 26,8 pt (16x9: Δ 128 → 101,2).
   - É intencional (P2, guia §4), mas o "Pronto quando" só cita as linhas, e `docs/work/CONTRACTS.md` (`columnWidthsOf`, linha ~398) ainda diz "dividem igualmente".
   - Sugestão ao orquestrador: atualizar o CONTRACTS e o texto do gate.
3. **Truncamento de `spcPts` fracionário** (C06/C11 −0,8 pt por linha): não é novo e vale para todo texto. Fica registrado porque a meta de ±0,5 pt por linha só é cumprida com `lineHeight` × size inteiro.
4. **Ferramenta** (`scripts/calibration/h2.ts`):
   - `import type … from '../types.ts'` aponta para um arquivo inexistente (resto da PoC). O tsx ignora, mas o `tsc` falharia se `scripts/` entrasse no typecheck.
   - O stderr do `swift` polui o log.
   - Também é cosmético: o cabeçalho de `keynote-pdf.sh` ainda diz `poc/css/calibration/`.

## Comandos

```
S=<scratchpad>/m11g
npx tsx src/cli.ts build tests/examples/legacy/demo.tsx --size 16x9,4x3,wide --out $S/legacy
npx tsx src/cli.ts build examples/demo.tsx --size 16x9,4x3,wide --out $S/css
git archive 072deb3 | tar -x -C $S/old; ln -s $PWD/node_modules $S/old/node_modules
(cd $S/old && npx tsx src/cli.ts build examples/demo.tsx --size 16x9,4x3,wide --out $S/old-dist)
shasum + $S/tools/pdiff.py (PIL)                          # PNG a PNG
npx tsx $S/tools/dump.mts src/render.ts <deck> <json>     # árvore posicionada; cmppos.py / cmpcss.py
npx tsx src/cli.ts build examples/{showcase,long-list,charts,layout-test}.tsx --size … --out $S/…
# layout-test legado: cópia em $S/ltleg com assets → examples/assets, tsconfig e package.json (type module) próprios
(cd $S/ltleg && tsx --tsconfig tsconfig.json src/cli.ts build layout-test.tsx --size 16x9 --out $S/lt-legacy)
$S/tools/kx.sh scripts/keynote-export.sh <pptx> <pasta>   # trava + 3 tentativas
$S/tools/kx.sh scripts/calibration/keynote-pdf.sh <pptx> <pdf>
$S/tools/kx.sh npx tsx scripts/calibration/h2.ts examples/calibration.tsx $S/h2
$S/tools/kx.sh npx tsx scripts/calibration/h2.ts examples/calibration-rich.tsx $S/h2
npx tsx $S/tools/samples.mts <deck> <json>; swift $S/tools/baselines.swift <pdf> <json> 720   # baselines
swift $S/tools/pdfpng.swift <pdf> <página> 720 4 <png>    # raster para medir bordas/sombra
```

## O que o dono confere no PowerPoint

1. **`demo` 16x9:**
   - A barra do título (`borderLeft` de 6 pt) fica colada à esquerda do texto, dentro da caixa, como uma linha reta.
   - No slide 5, as colunas Q2/Q3 ficam mais largas e "Δ" mais estreita.
2. **`showcase` 16x9 e 4x3:**
   - Sombra suave nos cartões do slide 2.
   - Caixa girada de 18° e translúcida na capa.
   - No slide 4: borda azul só em cima, tracejada embaixo, pontilhada dentro da caixa, e a caixa cinza girada de −8° por cima das outras duas.
   - A nota do slide 2 só em 4:3.
3. **`calibration.tsx`, slide 7 (C29–C31) e C07/C12:** se a 1ª linha com `lineHeight` 1.5 também cai ≈ 2 pt abaixo do topo esperado (regra de 0,8 × espaçamento "Exatamente"). Se o PowerPoint também fizer isso, vale o ajuste do bug 1.
4. **`lineHeight` 1.2 em 14 pt (C06):** se o PowerPoint usa 16,8 pt exato (o Keynote trunca para 16).
5. **`layout-test` CSS × legado, slide 2:**
   - A borda de 1 px (CSS) fica por dentro da caixa.
   - O stroke (alias) fica centrado na aresta.
   - A elipse fica atrás das imagens no CSS e por cima no legado.
