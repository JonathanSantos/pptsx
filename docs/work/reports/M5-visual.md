# M5-E — Validação visual: demo 16x9 / 4x3 / wide, nativo × Keynote

**Veredito: PASSA.** O `demo.tsx` gera os três tamanhos sem mudar o código e sem nenhum diagnóstico. O preview nativo e o Keynote coincidem slide a slide nos 15 casos: mesmas quebras, mesmas posições, mesmas cores e o mesmo gráfico. Não há texto cortado nem vazando. Tudo é editável: textos e shapes são `<p:sp>` e a única `<p:pic>` é o gráfico.

Sobram problemas de **design** nos exemplos (não na engine). O principal é o espaço morto que aparece em 4x3 e em wide.

## Comandos

```
node bin/tsx-slides.mjs build examples/demo.tsx --size 16x9,4x3,wide --out dist/demo                 # exit 0, "Nenhum diagnóstico."
node bin/tsx-slides.mjs build examples/demo.tsx --size 16x9,4x3,wide --out dist/demo-debug --debug   # exit 0, "Nenhum diagnóstico."
scripts/keynote-export.sh dist/demo/demo.16x9.pptx dist/demo/keynote-16x9
scripts/keynote-export.sh dist/demo/demo.4x3.pptx  dist/demo/keynote-4x3
scripts/keynote-export.sh dist/demo/demo.wide.pptx dist/demo/keynote-wide
```

Como comparei:
- Montei pares nativo/Keynote empilhados, com resvg no scratchpad (`cmp.mjs`), e conferi cada um visualmente.
- Medi a diferença por pixel (`diff.mjs`): o nativo é reamostrado para o tamanho do Keynote (1 pt = 1 px) e as duas imagens são comparadas pixel a pixel.

## Critérios

| Critério (spec) | Status | Evidência |
|---|---|---|
| demo gera 16:9 e 4:3 sem alterar o deck, sem error | **Passa** | Exit 0 nos dois builds. `demo.diagnostics.json` = `[]` (também em wide). A única adaptação é `stacked={ctx.aspect < 1.5}`, que já está no deck. |
| PNG por slide + overview por tamanho; revisável só pelo overview | **Passa** | 5 PNGs e 1 `overview.png` por tamanho (3 × 6 arquivos), também no `--debug`. As miniaturas (~320 px) mostram a estrutura, a hierarquia e os vazios. O texto corrido fica pequeno, mas dá para perceber cada problema de design listado abaixo só pelo overview. |
| Preview nativo = Keynote | **Passa** | Diferença média de 1,1 a 2,8 (escala 0–255). Só 0,5–1,4 % dos pixels diferem em mais de 64, e todos ficam na borda das letras (antialias e hinting). Nenhum deslocamento de bloco. |
| Nenhum texto cortado/vazando/quebra diferente | **Passa** | As quebras são idênticas nos 15 pares. Exemplos: "Quarto trimestre seguido / de crescimento." (16x9) e "…um time de suporte / dedicado…" (16x9/4x3). Isso é garantido pela quebra forçada `<a:br/>` (decisão do M3). Nenhum `text-shrunk` ou `truncated`. |
| Texto e shape editáveis (nada vira imagem) | **Passa** | Os 15 slides não têm `custGeom`. Todo texto está em `<p:sp>` com `<p:txBody>`/`<a:t>`. Os shapes são `prstGeom` (`rect`, `ellipse`, `roundRect` nos cartões). Existe 1 `<p:pic>` por deck: o `revenue-chart.png` no slide 3 (`noChangeAspect`, contain via `srcRect` negativo). O Keynote renderiza esse contain corretamente. |

## Por slide × tamanho (nativo × Keynote)

| Slide | 16x9 | 4x3 | wide |
|---|---|---|---|
| 1 Capa | Igual (diff 1,9) | Igual (1,5) | Igual (1,2) |
| 2 Bullets | Igual: 5 linhas, 1 linha por item (2,8) | Igual (2,1) | Igual (1,6) |
| 3 Duas colunas + gráfico | Igual: lado a lado, cada bullet com 2 linhas, gráfico idêntico (2,2) | Igual: empilhado, bullets em 1 linha cada, gráfico centralizado (1,3) | Igual: lado a lado, 2 bullets com 2 linhas (1,1) |
| 4 KPIs + nota | Igual: nota em 2 linhas (2,0) | Igual (1,5) | Igual: nota em 2 linhas, com "novembro." sozinho (1,1) |
| 5 Encerramento | Igual: subtítulo em 2 linhas centralizadas (2,4) | Igual (1,9) | Igual (1,4) |

Valor entre parênteses = diferença média por pixel. Nos três tamanhos, as cores (marca, accent, verde/vermelho das tendências) e as decorações (barras e elipses) coincidem.

## Crítica de design (insumo para M5-B, não reprova)

1. **Espaço morto no slide 2.** O corpo é `grow` mas a lista fica presa ao topo. A metade de baixo sobra vazia: ≈ 30 % do slide em 16x9 e ≈ 45 % em 4x3. É a coisa mais "estranha" do deck.
   - Sugestão: em `examples/components/Bullets.tsx`, aceitar `justify`/`grow`, ou centralizar o corpo no `ContentLayout` (`examples/layouts/ContentLayout.tsx`, `justify="center"` opcional).
   - Outra opção é distribuir o gap (`justify="space-evenly"` com teto) ou usar `font.h2` cheio.
2. **Slide 3 em 4x3: alinhamentos competindo.** As bullets ficam alinhadas à esquerda e o gráfico (contain) fica centralizado, com ≈ 120 pt de margem de cada lado. Visualmente parecem dois blocos sem relação.
   - Sugestão: no modo `stacked` de `examples/components/TwoColumn.tsx`, alinhar a imagem à esquerda (`alignSelf="start"`) ou dar ao `Image` uma posição de alinhamento.
3. **Slide 3 em 16x9/wide: a coluna esquerda flutua.** A coluna de texto é centralizada na vertical (`justify="center"`) e deixa ≈ 100 pt vazios acima da primeira bullet. Com isso, o topo do texto não se alinha com o topo do gráfico.
   - Sugestão: em `TwoColumn.tsx`, alinhar a coluna ao topo do gráfico (`justify="start"`) ou alinhar a primeira linha com o topo do cartão do gráfico.
   - Em 16x9, `ratio 0.4` com bullets de 18 pt quebra todos os itens em 2 linhas. Com `ratio 0.45` cabem melhor.
4. **Slide 4: o bloco fica afundado em 4x3 e wide.** `justify="center"` deixa ≈ 60–90 pt vazios entre o título e os cartões, e a mesma folga embaixo. O título fica isolado.
   - Os cartões wide (≈ 260 pt) têm conteúdo pequeno alinhado à esquerda, o que deixa metade de cada cartão vazia.
   - Sugestão: `justify="start"` com um gap fixo no `demo.tsx`/`KpiRow`, e o valor em `font.display` maior quando sobra largura, via `ctx`. Outra opção é centralizar o conteúdo no `examples/components/KpiCard.tsx`.
5. **Viúva na nota do slide 4 (wide):** "novembro." fica sozinho na 2ª linha. Limitar a largura do texto da nota (`maxWidth` ≈ 70 %) resolve e também melhora a medida de leitura (hoje ≈ 130 caracteres por linha em wide).
6. **Elipses deformam conforme a proporção.** `width`/`height` em % nos dois eixos geram um círculo quase perfeito em 16x9, mas um "ovo" alto em 4x3 (capa: 396×540 pt; encerramento: 360×486 pt).
   - Sugestão: em `examples/layouts/CoverLayout.tsx` e `ClosingLayout.tsx`, dimensionar pela altura com largura igual em pt (`ctx`), ou usar `aspectRatio` se existir.
7. **Encerramento: a elipse passa por trás do início do subtítulo** ("áreas…"). Tem pouco contraste e não atrapalha a leitura, mas parece acidental. Sugestão em `ClosingLayout.tsx`: descer a elipse (`bottom` mais negativo) ou deslocá-la para a esquerda.
8. **Capa: o bloco de título fica um pouco acima do centro óptico** e deixa a metade de baixo vazia em 4x3. É aceitável. Um rodapé com data ou área (`caption`) equilibraria (`CoverLayout.tsx`).
9. **Tipografia do gráfico:** os rótulos de eixo do PNG ficam com ≈ 7–8 pt efetivos em 16x9, pequenos para projeção. O ajuste é no asset (`examples/assets/revenue-chart.png`), não na engine.

Pontos positivos: o header (barra + título) é consistente em todos os slides, a paleta é contida, os KPIs têm hierarquia clara (label → valor → delta) e as margens de 40 pt são coerentes.

## Observação técnica

A quebra forçada (`<a:br/>`) mantém as linhas idênticas por construção. O custo é conhecido desde o M3: quem editar o texto no PowerPoint/Keynote herda as quebras manuais.
