# pptsx CSS — guia de 1 página

Slides em TSX com **CSS como props** (camelCase). O layout segue o browser (box model, flex, grid); a saída é `.pptx` nativo + PNGs de preview.

```tsx
import { Box, Deck, Slide, Text, Image, Shape, Chart, Table, Span, B, I, defineDeck } from '../index.ts'; // caminho relativo até poc/css/index.ts

export default defineDeck((ctx) => (
  <Deck>
    <Slide padding={40} fontFamily="Arial" color="#1B2A4A">          {/* fonte/cor descem para os Text */}
      <Text fontSize={32} fontWeight="bold" marginBottom={12}>Título</Text>
      <Box display="grid" gridTemplateColumns="repeat(3, 1fr)" gap={16}>
        <Box padding={12} backgroundColor="#F4F6FA" borderTop="3px solid #2F6FED">…</Box>
      </Box>
      <Text marginTop="auto" fontSize={11}>Rodapé no fim do slide</Text>
    </Slide>
  </Deck>
));
```

Build: `npx tsx poc/css/cli.ts build <deck.tsx> --size 16x9,4x3 --out out/` → `<deck>.<size>.pptx`, `<deck>.<size>/slide-NN.png` e o resumo de diagnósticos (exit 1 se houver `error`). Leia os PNGs para conferir.

**Regras básicas.** Números são pt (`'12px'` vale 12 pt; `'50%'` do pai). Slide 16:9 = 720 × 405 pt. Todo texto fica dentro de `<Text>` (negrito/itálico/cor no meio: `<B>`, `<I>`, `<Span color fontWeight textDecoration>`). `box-sizing` é sempre border-box.

| Tema | Props |
|---|---|
| Display | `Box` sem `display` = coluna flex que estica os filhos; `display="flex"` (row, como CSS), `"block"` (coluna; margens verticais de irmãos colapsam), `"grid"`, `"none"`. Slide = coluna flex. |
| Caixa | `width/height/min*/max*`, `margin` (`'8 16'`, `'0 auto'`, `marginTop="auto"`), `padding`, `border` (`'2px solid #ccc'`, `borderLeft…`, `borderWidth/Color/Style`), `borderRadius` (número). Caixa e pintura valem em Box, Text, Image, Table: uma "pílula" é um `<Text padding backgroundColor borderRadius>`, que numa row fica com a largura do conteúdo. |
| Flex | `flexDirection`, `flexWrap="wrap"`, `gap`/`rowGap`/`columnGap`, `justifyContent`, `alignItems`, `alignContent`, `alignSelf`, `flex={1}`, `flexGrow/Shrink/Basis`, `order`. |
| Grid | `gridTemplateColumns/Rows` (pt, `%`, `fr`, `auto`, `min-content`, `max-content`, `minmax(a,b)`, `repeat(n, …)`), `gridAutoRows`, `gap`; no item: `gridColumn="1 / 3"`, `"span 2"`, `"1 / -1"`, `gridRow`, `justifySelf/alignSelf` (padrão stretch). Auto-placement por linhas. |
| Posição | `position="relative|absolute"` + `top/right/bottom/left/inset` (absoluto mede pelo pai). `zIndex` ordena a pintura (negativo = atrás do conteúdo; absoluto sem z pinta por cima do fluxo). |
| Texto (herda) | `fontFamily`, `fontSize`, `fontWeight` (`'bold'`/700), `fontStyle`, `color`, `lineHeight` (múltiplo da altura natural da fonte, ≈ 1,15 × size em 1), `textAlign`, `letterSpacing`, `textTransform`; não herda: `textDecoration`, `whiteSpace="nowrap"`. Ajuste: `fit="shrink|truncate|error"`, `minSize`, `maxLines`. |
| Pintura | `backgroundColor`, `backgroundImage="url(./img.png)"`, `boxShadow="0 4px 12px rgba(0,0,0,.2)"`, `opacity`, `rotate={12}` ou `transform="rotate(12deg) translate(4px, 0)"`. |
| Outros | `<Image src fit="contain|cover">`, `<Shape kind="rect|roundRect|ellipse|line" fill stroke>`, `<Chart kind data>` (precisa de tamanho: width/height/flex ou célula de grid), `<Table columns rows>` (colunas sem width seguem o conteúdo). |
| Responsivo | qualquer prop aceita `{ base: …, tall: …, wide: … }` (`tall` = 4:3/16:10). Ex.: `gridTemplateColumns={{ base: 'repeat(3, 1fr)', tall: 'repeat(2, 1fr)' }}`, `display={{ base: 'none', tall: 'flex' }}`. `ctx.pick({ … })` no código. |

**Não sai no PPTX** (vira warning `css-not-emitted` com a propriedade e o path, e o preview também não desenha): `overflow: hidden` em caixa, `scale/skew`, sombra `inset`/`spread`, raio por canto, gradiente, `filter`, qualquer CSS fora desta lista. Fora do escopo: `float`, `position: fixed/sticky`, `em/rem/vw`, áreas nomeadas e `auto-fill` no grid.

**Diagnósticos que pedem ação:** `text-overflow` / `box-overflow` (o estouro diz quanto e onde; dentro de grid, "a célula tem X pt": use track `auto` ou reduza), `text-shrunk` (info: o texto encolheu para caber), `out-of-slide`. Mensagens trazem a correção sugerida.

---
Código da PoC: `resolve/` (cascata), `layout/` (Yoga + `grid.ts`), `fit/`, `emit/`, `preview/`, `oracle/` (fixtures do Chromium), `calibration/` (Keynote). Relatório: `docs/work/reports/POC-css.md`.
