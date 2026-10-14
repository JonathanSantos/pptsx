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
- Grid: na P0, `display: grid` cai num flex column (P1 implementa).
