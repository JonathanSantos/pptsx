# M2-E — Validação visual: preview nativo vs Keynote

**Veredito: PASSA.** Nos 3 slides de `examples/layout-test.tsx`, em 16x9 e 4x3, o preview nativo e o Keynote desenham as caixas, shapes, imagens e fundos no mesmo lugar e no mesmo tamanho. A diferença máxima é ≤ 1 pt. As únicas diferenças visíveis estão nas quebras de linha do texto, o que já era esperado com o estimador do M2. Elas ficam registradas abaixo como insumo do M3.

## Ambiente e método

- Keynote 14.4 exporta em 720×405 (16x9) e 720×540 (4x3), ou seja, 1 px = 1 pt. O preview nativo sai com 1280 px de largura (1,778 px/pt).
- Medição: o PNG nativo é reduzido para 720 px e comparado com o do Keynote. Depois, bbox por cor (numpy/PIL) com as coordenadas em pt, conferido contra os offsets do XML do `.pptx`.
- **Atenção à cor:** o Keynote exporta o PNG com perfil **Display P3**. Lido sem conversão, #2F6FED aparece como (64,110,229). Convertido para sRGB com `sips -m "sRGB Profile.icc"`, ele volta a (46,112,237), com erro ≤ 1 em todas as cores. Ou seja, as cores do `.pptx` estão certas. Para medir cor em validações futuras, converta para sRGB antes.

## Comandos

```
node bin/tsx-slides.mjs build examples/layout-test.tsx --out dist/m2 --debug
node bin/tsx-slides.mjs build examples/layout-test.tsx --out dist/m2-clean --size 16x9,4x3
scripts/keynote-export.sh dist/m2-clean/layout-test.16x9.pptx dist/keynote/m2-16x9
scripts/keynote-export.sh dist/m2-clean/layout-test.4x3.pptx  dist/keynote/m2-4x3
scripts/keynote-export.sh dist/m2/layout-test.16x9.pptx       dist/keynote/m2-debug
```

Tudo rodou sem erro. `diagnostics.json` saiu vazio (`[]`).

## Caixas por slide (16x9; valores em pt; N = nativo, K = Keynote)

| Slide | Elemento | Esperado (XML) | N | K | Status |
|---|---|---|---|---|---|
| 1 | Barra accent do Header | 40,40.8 6×32 | 39.9,41.1→45.6,72.6 | 40,41→46,72 | OK (≤0.6) |
| 1 | Card 1 / 2 / 3 (grow, gap 16) | x 40 / 258.7 / 477.3, w 202.7, y 97.6→365 | 39.9 / 258.8 / 477.6 → 242.4 / 461.2 / 680.1; y 97.9→365.1 | 40 / 259 / 478 → 242 / 461 / 680; y 98→365 | OK (≤0.5) |
| 1 | Raio 8 do card | na linha y=98, o card começa em x≈45 | 45.6 | 45.0 | OK |
| 2 | Elipse absoluta (right/top −60, 30%×50%) | 564,−60 216×202.5, cortada pelo slide | x mín. 564.2, base 141.2 | 564.0 / 141.0 | OK. Sai do slide nos dois. |
| 2 | Box cinza com stroke (topo / base) | 352,40 / 352,210.5 328×154.5 | 351.6,39.9→680.1,194.6 | 352,40→680,195 | OK |
| 2 | Imagem contain (faixas laterais) | conteúdo 231.75 de largura, centralizado: x 400.1→631.9 | 400.5→631.7, y 39.9→194.1 | 400→632, 40→194 | OK. Borda laranja inteira visível, faixas cinzas dos dois lados. |
| 2 | Imagem cover (cortada) | altura 218.7 com corte de ≈32 em cima e embaixo | borda só nas laterais; círculo 450.6→581.6 / 222.2→353.2 | 451→581 / 223→353 | OK. Corta em cima e embaixo nos dois. |
| 3 | Faixa cinza (row, h 80) | 40,138.5 640×80 | 39.9,138.4→680.1,218.2 | 40,139→680,218 | OK |
| 3 | rect / roundRect / ellipse (justify between, align end) | x 40 / 330 / 620; base y 218.5 | 39.9 / 330.2 / 620.4, base 218.2 | 40 / 330 / 620, base 218 | OK. Base alinhada; raio 10 do roundRect igual. |
| 3 | Textos Esquerda / Centro / Direita | frames x 40 / 258.7 / 477.3, y 283.3 | alinhados à esquerda, centro e direita | igual | OK |
| 3 | Linha (1 pt preta) | y 365, x 40→680 | 364.5→365.5 | 364→366 (2 px a 50%) | OK. É antialias da linha de 1 pt. |
| 1–3 | Fundos brancos, cores | — | — | ≤ 1 de diferença depois da conversão P3→sRGB | OK |

**4x3:** todas as caixas também batem com ≤ 0,6 pt. Card 1 vai de 39.9,106.3→242.4,500.1 no nativo e de 40,106→242,500 no Keynote. Shapes do slide 3: base em 263.2 no nativo e 263 no Keynote. O flex se adapta bem: os cards crescem na vertical, a faixa do slide 3 desce por causa do `justify between` e as caixas de imagem ficam com 328×≈218.

## Overview (`dist/m2/layout-test.16x9.overview.png`, 1056×256)

- Grade com 3 miniaturas de ≈320 px. Os números 1, 2 e 3 ficam abaixo de cada miniatura e são legíveis.
- Dá para revisar o layout só pelo overview: as caixas, o contain/cover, a elipse cortada e os contornos de debug aparecem com clareza.
- Os títulos (28 pt) são legíveis. O texto de 12–14 pt não é legível, porque vira ≈5 px. Isso basta para revisar a estrutura, mas não o conteúdo do texto.

## Debug (contornos)

Os contornos vermelhos tracejados aparecem no mesmo lugar no nativo e no Keynote. As posições em y das linhas horizontais do slide 1 são 39.7 / 73.4 / 97.3 / 113.3 / 135 / 142.9 / 186.2 / 364.8 no nativo e 39.5 / 73 / 97 / 113 / 135 / 143 / 186 / 364.5 no Keynote. No slide 3 também batem com ≤ 0,5 pt. O mesmo vale para os frames das imagens e da coluna esquerda do slide 2. No slide 2, o contorno do título mostra que o texto do nativo ultrapassa o frame (ver problema 1).

## Quebras de texto (insumo do M3)

As larguras dos frames são as mesmas em 16x9 e 4x3, então as quebras também são iguais nos dois tamanhos.

| Texto (tamanho) | Largura do frame | Linhas N | Linhas K | Observação |
|---|---|---|---|---|
| "Três colunas com grow e gap" (28 bold) | 622 | 1 | 1 | — |
| "Flexbox" / "Medição" / "Preview" (18 bold) | 170.7 | 1 | 1 | — |
| "Caixas crescem e se distribuem…" (12) | 170.7 | 3 | **2** | O estimador superestima a largura e o frame (43,2 pt) sobra. |
| "O texto quebra em várias linhas…" (12) | 170.7 | 3 | 3 | Os pontos de quebra mudam: no Keynote, "linhas" cabe na 1ª linha. |
| "SVG e PNG saem da mesma…" (12) | 170.7 | 3 | 3 | Os pontos de quebra mudam: no Keynote, "pelo" cabe na 2ª linha. |
| "Imagem com contain e cover" (28 bold) | 270 | 2 | 2 | O estimador **subestima**: no nativo, "Imagem com contain" vai até x≈334, além do frame (328). No Keynote, "contain" desce para a 2ª linha. |
| "À direita, a mesma imagem 3:2…" (14) | 288 | 4 | 4 | Mesmos pontos de quebra. |
| "Alinhamentos" (28 bold) | 622 | 1 | 1 | — |
| "Esquerda" / "Centro" / "Direita" (14) | 202.7 | 1 | 1 | — |

Resumo para o M3: com 0,5×size, o texto regular de 12 pt sai largo demais e o bold de 28 pt sai estreito demais. O medidor real precisa de métricas por peso.

## Problemas

| # | Severidade | Problema | Sugestão / módulo |
|---|---|---|---|
| 1 | Média (M3) | Com bold de 28 pt, a estimativa fica estreita demais e o preview desenha a linha ≈6 pt além do frame (slide 2). Não colide com nada aqui (o gap é de 24), mas em layout apertado colidiria. | Medidor com métricas reais por fonte e peso (`src/text/`, M3). Até lá, o preview poderia marcar no debug uma linha cuja largura medida passe da largura do frame (`src/preview/`, M4). |
| 2 | Baixa (M3) | Texto regular de 12 pt: a estimativa é larga demais (Flexbox: 3 linhas no nativo, 2 no Keynote), então o frame fica mais alto que o necessário. | `src/text/` (M3). |
| 3 | Baixa | O PNG do Keynote sai em Display P3, então comparar cores sem conversão sugere um erro falso de até 17 nos canais. | Documentar no script ou nos relatórios. Opcional: em `scripts/keynote-export.sh`, converter para sRGB com `sips -m` depois de exportar. |
| 4 | Baixa | Quando a Image tem o mesmo frame da Box com stroke, ela cobre metade do traço de 1 pt (slide 2). O efeito é igual nos dois renderizadores. | É um detalhe do exemplo: usar `padding={1}` na Box em `examples/` se quiser o contorno inteiro. |
| 5 | Info | Em 4x3, as caixas de imagem ficam com proporção ≈3:2, então contain e cover ficam iguais e o contraste entre os dois só é testado em 16x9. | Opcional: fixar a altura de uma das caixas no exemplo (`examples/`). |

Nenhum problema de severidade alta. Arquivos de apoio: `dist/m2*/`, `dist/keynote/m2-16x9`, `dist/keynote/m2-4x3`, `dist/keynote/m2-debug`.
