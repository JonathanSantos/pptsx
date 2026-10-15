# Guia do agente — pptsx

Este é o único documento de que você precisa para (1) escrever slides novos e (2) corrigir erros lendo `diagnostics.json` e o overview PNG. Não é preciso ler `src/`.

## 1. Modelo mental

1. Você descreve **estrutura**, não posição: não existem coordenadas x/y. O layout é **CSS escrito como props** (camelCase): box model, flexbox, grid, `position`, `zIndex`. Se você sabe CSS, já sabe 90% da API.
2. Uma diferença intencional em relação ao browser: **`Box` sem `display` é uma coluna flex que estica os filhos** (o que um slide quer quase sempre). `display="flex"` explícito é **row**, como no CSS. O `Slide` também é coluna flex.
3. A engine **mede o texto** com a fonte real, quebra as linhas e, se não couber, **reduz a fonte** (até um mínimo), corta com reticências ou reporta erro.
4. O mesmo arquivo gera vários tamanhos (16:9, 4:3…). Props que mudam por tamanho recebem um **valor responsivo** (`{ base: 20, wide: 24 }`), sem `if`/ternário sobre `ctx` (§2 "Breakpoints").
5. Todo problema vira um **diagnóstico** com `path` até o nó e uma `message` que diz o que fazer. Exit code 0 = sem `error`. O que não existe no PPTX (`overflow: hidden`, gradiente…) vira o warning `css-not-emitted`: nada some em silêncio.

## 2. Esqueleto de um deck

Arquivo em `examples/agent-test/<nome>.tsx` (dentro deste repo; projeto próprio com `npm install pptsx`: ver §7). Imports de `pptsx` (primitivas) e, se quiser, dos exemplos prontos:

```tsx
import { Box, Deck, Slide, Text, defineDeck } from 'pptsx';
import { tokens } from '../tokens.ts';
import { ContentLayout, CoverLayout } from '../layouts/index.ts';
import { Bullets } from '../components/index.ts';

const { color, font, space } = tokens;

export default defineDeck((ctx) => (
  <Deck>
    <CoverLayout ctx={ctx} title="Resultados do trimestre" subtitle="Diretoria · outubro" />
    <ContentLayout title="Destaques">
      <Bullets items={['Receita cresceu 18%', 'Churn caiu para 2,1%', 'Dois mercados novos']} />
    </ContentLayout>
    {/* fontFamily e color descem do Slide para todos os Text (herança) */}
    <Slide padding={space.page} gap={space.gap} backgroundColor={color.surface} color={color.ink}>
      <Text fontSize={font.h1} fontWeight="bold">Slide só com primitivas</Text>
      <Box flex={1} backgroundColor={color.white} borderRadius={8} padding={space.gap}>
        <Text fontSize={font.body} color={color.muted}>Gerado em {ctx.name}.</Text>
      </Box>
      <Text fontSize={font.caption} marginTop="auto">Rodapé no fim do slide</Text>
    </Slide>
  </Deck>
));
```

Regras: `export default defineDeck((ctx) => <Deck>…</Deck>)`; filhos do `Deck` são só `Slide` (direto ou via layout que devolve `Slide`). Componentes são funções puras `(props) => elemento` (sem hooks, sem estado). `.map` em listas não precisa de `key`.

**Herança:** `fontFamily`, `fontSize`, `fontWeight`, `fontStyle`, `color`, `lineHeight`, `textAlign`, `letterSpacing` e `textTransform` declarados num `Slide`/`Box` descem para todos os `Text` de dentro (o mais próximo vence). Defina a cor e a fonte uma vez no Slide ou no cartão e escreva nos `Text` só o que muda. `Table` herda família, tamanho, cor e `lineHeight`; `Chart`, família e cor.

`ctx` (um por tamanho renderizado; todos os números em pt, 1 pol = 72 pt):

| campo | 16x9 | 16x10 | 4x3 | wide |
|---|---|---|---|---|
| `ctx.name` | `'16x9'` | `'16x10'` | `'4x3'` | `'wide'` |
| `ctx.width × ctx.height` | 720 × 405 | 720 × 450 | 720 × 540 | 960 × 540 |
| `ctx.aspect` (w/h) | 1.78 | 1.6 | 1.33 | 1.78 |
| `ctx.scale` = min(w/720, h/405) | 1 | 1 | 1 | 1.33 |

Note: 16:9 e 4:3 têm a **mesma largura**; o 4:3 é **mais alto**. Por isso em 4:3 vale empilhar (breakpoint `tall`) e usar a altura extra. Tamanho custom: `--size 10x7.5in` (nome `custom-10x7.5`).

### Breakpoints (props responsivas)

Toda prop de `Slide`, `Box`, `Text`, `Image`, `Shape`, `Chart` e `Table` aceita um valor fixo **ou** um objeto por breakpoint com `base` obrigatória, inclusive dentro de `style`:

```tsx
<Text fontSize={{ base: 24, tall: 28, wide: 30 }}>…</Text>
<Box display="grid" gridTemplateColumns={{ base: 'repeat(3, 1fr)', tall: 'repeat(2, 1fr)' }} gap={{ base: 16, tall: 24 }}>…</Box>
<Text display={{ base: 'none', tall: 'flex' }}>Só aparece em 4:3</Text>
```

| chave | ativa quando | 16x9 | 16x10 | 4x3 | wide |
|---|---|---|---|---|---|
| `tall` | `ctx.aspect < 1.5` (mais "quadrado": muda a **estrutura**) | | ✓ | ✓ | |
| `wide` | `ctx.scale > 1.2` (maior nos dois eixos: muda a **tipografia**) | | | | ✓ |
| nome exato (`'16x9'`, `'4x3'`, `'custom-10x7.5'`) | `ctx.name` igual | ✓ | ✓ | ✓ | ✓ |

- **Precedência:** nome exato > `wide` > `tall` > `base`. Vale a primeira chave ativa presente no objeto; nenhuma → `base`. Um custom grande e quadrado (`13.33x10in`) é `wide` e `tall`: `wide` vence.
- **`base` é obrigatória**: `{ tall: 24 }` não compila e, vindo de JS, é erro de estrutura `Prop "fontSize" de <Text>: objeto responsivo sem a chave "base"`. Chave errada (`{ base: 20, tal: 24 }`) → `breakpoint desconhecido: "tal"`.
- Não há como "desligar" uma prop num breakpoint (`{ base: '100%', tall: undefined }` resolve para `'100%'` no `tall`): mude o valor (`maxWidth={{ base: '80%', tall: '100%' }}`), não a presença. Para **esconder um nó**, use `display={{ base: 'flex', tall: 'none' }}`.
- **Não são responsivos:** `src`, `kind`, `notes`, `children`, e o estilo de `Span`/`B`/`I`. `data` (Chart), `columns` e `rows` (Table) são objetos/arrays sem `base`: valem como valor comum, e também aceitam `{ base: …, tall: … }`. `margin: { top: 10 }` e `background: { image }` (sem `base`) continuam valores comuns.
- **`ctx.pick(valor)`** resolve com a mesma regra no seu código, para o que não é prop de primitiva: quantos itens mostrar, texto alternativo. `items.slice(0, ctx.pick({ base: 4, tall: 6 }))`, `title={ctx.pick({ base: 'Receita', wide: 'Receita recorrente mensal' })}`.
- Componentes repassam o valor responsivo **sem resolver** (`<Text fontSize={size}>`); a engine resolve ao chegar na primitiva (§5).

## 3. Primitivas e props CSS

Unidades: número = **pt**; `'12px'` e `'12pt'` = 12 pt; `'50%'` = percentual do pai (tamanhos, `inset`, `margin`, `padding`). Shorthands como no CSS: `padding="8 16"`, `margin="0 auto"`, `border="2px solid #CCD3E0"`, `flex={1}`, `inset={0}`. Cores: `'#RRGGBB'`, `'#RGB'`, `rgba(27,42,74,0.2)` ou nome (`'white'`). `box-sizing` é sempre border-box: `width` inclui padding e borda.

**A regra que mais importa:** `Box` sem `display` = coluna flex que estica os filhos na largura. `display="flex"` = row (CSS). `display="grid"` = grid. `Slide` = coluna flex.

| tema | props | notas |
|---|---|---|
| Display | `display="flex" \| "block" \| "grid" \| "none"` | `block` = coluna com colapso de margens verticais entre irmãos; `none` não emite o nó (os irmãos mantêm o índice no path) |
| Caixa | `width`, `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight`, `aspectRatio`, `margin` (`marginTop="auto"` empurra), `padding`, `border`, `borderTop/Right/Bottom/Left`, `borderWidth/Color/Style` (`solid`/`dashed`/`dotted`), `borderRadius` (número) | vale em `Box`, `Text`, `Image`, `Table`: uma "pílula" é um `<Text padding backgroundColor borderRadius>`. Borda ocupa espaço (como no CSS). `borderRadius` só sai com borda **igual** nos quatro lados (ou sem borda): com `borderTop`/`borderLeft` isolado o fundo arredonda mas a linha sai reta → `css-not-emitted`. Cartão com faixa colorida: `borderTop` **sem** `borderRadius`, ou `borderRadius` + `boxShadow` sem borda por lado |
| Flex | `flexDirection`, `flexWrap="wrap"`, `gap` / `rowGap` / `columnGap`, `justifyContent`, `alignItems`, `alignContent`, `alignSelf`, `flex={1}`, `flexGrow`, `flexShrink`, `flexBasis`, `order` | valores CSS: `'flex-start'`, `'center'`, `'flex-end'`, `'space-between'`, `'space-around'`, `'space-evenly'`, `'stretch'`, `'baseline'` (`'start'`/`'end'` também valem) |
| Grid | `gridTemplateColumns/Rows` (pt, `%`, `fr`, `auto`, `min-content`, `max-content`, `minmax(a, b)`, `repeat(n, …)`), `gridAutoRows/Columns`, `gap`; no item: `gridColumn="1 / 3"`, `"span 2"`, `"2 / -1"`, `gridRow`, `justifySelf`, `alignSelf`, `placeItems/placeSelf` | auto-placement por linhas; itens esticam na célula por padrão |
| Posição | `position="relative" \| "absolute"`, `top/right/bottom/left/inset`, `zIndex` | absoluto mede pela borda do pai e sai do fluxo (só para **decoração**: não gera diagnóstico de caixa). Ordem de pintura abaixo |
| Texto (herda) | `fontFamily`, `fontSize`, `fontWeight` (`'bold'`, `600`, 1–1000: a face registrada mais próxima), `fontStyle="italic"`, `color`, `lineHeight`, `textAlign`, `letterSpacing`, `textTransform` | §4. Em `Slide`/`Box` só descem para os filhos |
| Pintura | `backgroundColor`, `backgroundImage="url(./foto.png)"` (cover), `boxShadow="0 4px 12px rgba(0,0,0,.2)"` (uma, externa), `opacity`, `rotate={12}` ou `transform="rotate(12deg) translate(4px, 0)"`, `zIndex` | opacidade e rotação valem para o nó e os filhos |
| Escape | `style={{ … }}` | qualquer CSS em camelCase; vence as props. O que não tem de/para vira `css-not-emitted` |

### Por primitiva

| primitiva | props próprias (além das CSS acima) | filhos |
|---|---|---|
| `Deck` | `footer?` (conteúdo repetido em todo slide, inclusive nas partes paginadas; ver §4 "Número de slide e rodapé") | só `Slide` |
| `Slide` | `backgroundColor`, `backgroundImage="url(…)"` (ou `background={{ image: 'foto.png' }}`), `notes?: string` | primitivas/componentes |
| `Box` | `paginate?: boolean` (ver "Paginação"), `shape?` (geometria do fundo/borda, ver "Diagramas"), `href?` (link na caixa inteira) | primitivas/componentes |
| `Text` | `fit`, `minSize`, `maxLines`, `nowrap`/`whiteSpace="nowrap"`, `href`, `paginate` (§4) | strings/números e `Span`/`B`/`I`/`Sup`/`Sub` |
| `Span` | `fontWeight`, `fontStyle`, `color`, `textDecoration`, `fontSize`, `fontFamily`, `verticalAlign` (`'super' \| 'sub'`), `href` (**sem** `lineHeight`: é do Text) | strings/números e outros `Span`/`B`/`I`/`Sup`/`Sub`; **só dentro de `Text`** |
| `B` / `I` / `Sup` / `Sub` | atalhos de `Span fontWeight="bold"` / `fontStyle="italic"` / `verticalAlign="super"` / `verticalAlign="sub"` | como `Span` |
| `SlideNumber` | `format?: 'n' \| 'n / total'` (padrão `'n'`), mais as props de texto (`fontSize`, `color`, `fontWeight`…) | nenhum |
| `Image` | `src: string` (obrigatório; relativo ao arquivo do deck), `objectFit?: 'contain' \| 'cover'` (padrão `'contain'`), `href?` | nenhum |
| `Shape` | `kind` (obrigatório; 24 formas, ver "Diagramas"), `backgroundColor` (cor da forma), `stroke`/`strokeWidth` (linha da forma; `line` e `bracketPair` sem `stroke` saem pretas), `radius` (roundRect), `flipH`/`flipV`, `lineStyle` (`'solid' \| 'dashed' \| 'dotted'`), `lineCap` (`'flat' \| 'round'`), `startArrow`/`endArrow` (**só em `line`**: `'arrow' \| 'triangle' \| 'stealth' \| 'diamond' \| 'oval'`) | nenhum |
| `Path` | `d` (obrigatório; `M L H V C S Q T A Z` do SVG), `viewBox?: [w, h]` (padrão: a caixa do `d`), `fill`, `stroke`, `strokeWidth` (pt), `lineCap`, `lineJoin` (`'miter' \| 'round' \| 'bevel'`), `lineStyle` | nenhum |
| `Icon` | `src` (obrigatório; `.svg`), `size?` (altura em pt, padrão 24), `color?` (padrão: a cor de texto herdada), `recolor?` (padrão `true`: preto também vira `color`), `render?: 'auto' \| 'shape' \| 'image'` | nenhum |
| `Connector` | `from`, `to` (ids, obrigatórios), `fromSide`/`toSide` (`'top' \| 'right' \| 'bottom' \| 'left' \| 'auto'`), `route` (`'straight' \| 'elbow'`), `startArrow`/`endArrow` (padrão: só `triangle` no fim), `stroke`, `strokeWidth` (1,5), `lineStyle`, `label`, `labelStyle={{ fontSize, color, background, font }}` (padrões: 12 pt, `#333333`, sem fundo, a fonte herdada do pai) | nenhum (só props; **não aceita CSS**) |
| `Chart` | `kind: 'bar' \| 'line' \| 'pie'` e `data: { categories: string[], series: { name, values: number[] }[] }` (obrigatórios), `colors?` (por série; na pizza por fatia), `legend?` (padrão: só com 2+ séries; pizza sempre), `showValues?` (padrão `false`), `title?`, `size?` (12, tamanho dos rótulos) | nenhum |
| `Table` | `columns: { header, width?, align? }[]` e `rows: (string \| number)[][]` (obrigatórios), `header?: { fill?, color?, weight? } \| false` (padrão: negrito sem fundo), `stripe?` (fundo da 2ª, 4ª… linha), `border?` (**cor da grade**, 0,5 pt; sem = sem grade), `cellPadding?` (4 pt), `minSize?`, `fit?: 'shrink' \| 'error'`; texto por `fontSize` (14), `fontFamily`, `color`, `lineHeight` | nenhum |

- `Box` sem fundo nem borda é invisível (só agrupa). Com `backgroundColor`/`border` vira retângulo (arredondado com `borderRadius`).
- Para barra, divisória ou marcador, prefira **borda** a um nó: título com barra = `<Text borderLeft="6px solid #2F6FED" paddingLeft={14}>`; divisória = `borderBottom` no bloco de cima. `Shape` fica para elipses, linhas diagonais e formas soltas. `Shape` sem tamanho tem 0 no eixo principal e estica no cruzado.
- `Image` com só `width` (ou só `height`) mantém a proporção. Com `flex={1}` e sem tamanho, ocupa a área toda e `objectFit` decide (`contain` mostra tudo, `cover` preenche e recorta). Sem tamanho nem flex: tamanho natural (px × 0.75 pt).
- `Chart` é **nativo** (editável no PowerPoint/Keynote) e **não tem tamanho próprio**: dê `flex={1}`, `width`/`height`, ou ponha numa célula de grid (estica nela); senão é erro de estrutura. `values` são números (`38.2`); o PowerPoint formata com a vírgula do idioma. `pie` aceita **uma** série.
- `Table` é **nativa** e medida pela engine: a largura vem do layout (numa coluna, a largura toda), a altura é a soma das linhas (cada linha = célula mais alta + 2 × `cellPadding`, arredondada a 0,5 pt). Colunas com `width` em pt ficam fixas, em `'%'` são fração da tabela; **sem `width` seguem o conteúdo** (como `table-layout: auto`). `align` vale para a coluna inteira. Encolhe como **uma unidade** junto com os `Text` do slide; não há `truncate`: ou encolhe ou é `table-overflow`. Não pagina.

### Diagramas: formas, `Path`, `Icon` e `Connector`

Tudo sai **nativo e editável** no PowerPoint/Keynote: cada forma, traço de ícone e seta é um objeto.

**`id`** (qualquer nó): nome para um `Connector` apontar. Único no slide (repetido = erro de estrutura).

**Formas** (`<Shape kind>` solta, ou `<Box shape>` para a caixa ter essa geometria com filhos dentro):

| kind | desenho | kind | desenho | kind | desenho |
|---|---|---|---|---|---|
| `rect` | ▭ | `pentagon` | ⬠ regular | `arrowDown` | ⇩ |
| `roundRect` | ▢ (raio = `borderRadius`) | `hexagon` | ⬡ deitado | `doubleArrow` | ⇔ |
| `ellipse` | ◯ | `octagon` | ⯃ | `pill` | ⬭ (raio = metade da altura) |
| `triangle` | △ | `chevron` | 〉 seta de processo | `star` | ☆ 5 pontas |
| `rightTriangle` | ◺ (ângulo reto embaixo à esquerda) | `arrowRight` | ⇨ (haste 50 % da altura) | `cloud` | ☁ |
| `diamond` | ◇ decisão | `arrowLeft` | ⇦ | `callout` | 💬 retângulo com ponta **abaixo** do frame |
| `parallelogram` | ▱ entrada/saída | `arrowUp` | ⇧ | `bracketPair` | ( ) só traço |
| `trapezoid` | ⏢ (topo mais estreito) | `line` | ╲ quina a quina | `cylinder` | ⛁ banco de dados |

- **`<Box shape="roundRect">`** sem `borderRadius` usa o arredondamento padrão do PowerPoint (~17 % do menor lado); com `borderRadius`, o raio dado. Num `pill`, losango etc. o `borderRadius` é ignorado com `css-not-emitted`.
- **`<Box shape="diamond">`** desenha fundo, borda (uniforme) e sombra com a geometria; os filhos ficam no **retângulo** do padding, como em qualquer Box. Losango e hexágono têm cantos vazios: dê `padding` lateral (`'0 22'`) para o texto não encostar nas pontas. `borderRadius` só vale em `rect`/`roundRect`; borda por lado numa forma → `css-not-emitted`.
- **`<Shape kind="line">`** vai da quina superior esquerda à inferior direita do frame (`height={0}` = horizontal); `flipH` inverte a diagonal e as pontas acompanham. Setas: `startArrow`/`endArrow`.
- **`<Path d viewBox>`**: geometria livre. Sem `width`/`height` tem o tamanho do `viewBox` em pt; com um só, o outro pela proporção; com os dois, estica. Sem `fill` nem `stroke`, pinta de preto (como o SVG). Furo: desenhe o contorno interno no sentido **oposto** ao externo.
- **`<Icon src="./icones/user.svg">`**: SVG só com `path/rect/circle/ellipse/line/polygon/polyline` e cores sólidas vira formas (um objeto por traço); com gradiente, máscara, `transform`, opacidade, texto, `<use>`, `<defs>`… vira **imagem** (`icon-rasterized`, info). `currentColor` (e preto) assumem `color`, que herda a cor do texto do pai: `<Box color="#2F6FED"><Icon …/></Box>`. Ícone não tem caixa: fundo/borda num `Icon` → `css-not-emitted`; envolva num `Box`. Ícones prontos (MIT): `examples/assets/icons/`.
- **`<Connector from="a" to="b">`**: calculado **depois** do layout, por cima de todos os nós; não ocupa espaço nem empurra nada. Pode ficar em qualquer lugar do slide (fora dos Box costuma ser mais legível). Âncora = meio do lado; `auto` (padrão) escolhe o par de lados mais próximo. `route="elbow"`: lados opostos → 3 segmentos com a dobra no meio; lados de eixos diferentes (`right` → `top`) → um L; lados **iguais** (`bottom` → `bottom`, laço de volta) → a dobra sai 16 pt para fora dos dois nós; cotovelo alinhado vira reta. Padrão `route="straight"`; linha `#333333` de 1,5 pt (não herda a cor do texto). Não conta no `gap` nem em nenhuma soma de layout. **Rótulo**: uma linha, centrado no meio do segmento mais longo, com 3 pt de respiro; num vão menor que o rótulo + ~20 pt a linha some atrás dele: deixe ≥ 40 pt entre nós com rótulo (no grid: largura da coluna − largura do nó). **Não desvia de obstáculos**: escolha `fromSide`/`toSide` para a linha não atravessar cartões.

### Ordem de pintura (`zIndex`)

Como no browser: os nós em fluxo pintam na ordem do código; um nó **posicionado** (`position`), com `zIndex`, `opacity < 1` ou `rotate` sobe de camada. `zIndex` negativo pinta **antes** (atrás) do fluxo; sem `zIndex` (ou 0), depois; positivo, por último. Por isso **decoração absoluta precisa de `zIndex={-1}`**, senão cobre o conteúdo:

```tsx
<Shape kind="ellipse" position="absolute" right={-120} top={-120} width={360} height={360} backgroundColor="#101B33" zIndex={-1} />
```

### Baseline (`alignItems="baseline"`)

Numa row (`display="flex"`), `alignItems="baseline"` (ou `alignSelf="baseline"`) alinha os filhos pela **linha de base da 1ª linha de texto**. É o jeito certo de pôr um rótulo pequeno ao lado de um valor grande, sem calcular deslocamento (continua certo se o fit encolher o valor):

```tsx
<Box display="flex" alignItems="baseline" gap={10}>
  <Text fontSize={44} fontWeight="bold">52,4</Text>
  <Text fontSize={14} fontWeight="bold" color="#1E9E6A">▲ +14,2%</Text>
</Box>
```

Baseline de cada filho: `Text` = 1ª linha; `Box` = a do 1º filho em fluxo; `Image`/`Shape` = a **base** (borda de baixo). Um marcador `Shape` numa row com baseline fica assentado na linha (baixo para um círculo): para marcador de lista use `alignItems="flex-start"` com `marginTop`, como o `Bullets` (§5).

### Paginação (`Box paginate`)

`<Box paginate>` divide os **filhos em fluxo** do Box entre slides quando não cabem: a 1ª parte leva os primeiros itens que cabem, e o resto continua num **clone do slide** (mesmo título, fundo, decoração e `notes`). É a saída para lista longa sem encolher a fonte.

- **Um por slide** (dois → erro de estrutura `Só um <Box paginate> por slide; encontrados 2`; um Box e um `Text paginate` também contam), e **não** em `position="absolute"`. Para **texto corrido** que continua no próximo slide, use `<Text paginate>` (§4). Use numa coluna: numa row a divisão é por colunas estreitas.
- Enquanto pagina, os `Text` dentro do Box **não encolhem**; o resto do slide encolhe normalmente. Coube tudo → nada muda.
- Os paths dos itens **não mudam** nas partes: o 8º item é `Box[7]` na parte 2 também.
- Cada parte é um slide no `.pptx`, no overview e nos diagnósticos; a 1ª recebe `slide-continued` (info) com `data.parts`.
- **Partes desequilibradas:** a divisão é gulosa (12 itens podem virar 10 + 2). Aumente `fontSize`/`gap` dos itens no breakpoint em que sobrou espaço e confira a contagem na mensagem do `slide-continued` ("7 de 12 itens no 1º, 5 no 2º").
- **Só primitivas:** `<Slide …><Text>Título</Text><Box paginate flex={1} gap={12}>{itens}</Box><Text marginTop="auto">Rodapé</Text></Slide>`. Título e rodapé (irmãos do Box) se repetem em cada parte; `flex={1}` no Box dá a ele a altura que sobra.
- **Nada cabe** (nem o 1º item): o slide fica inteiro, o shrink volta e saem os diagnósticos normais. **Limite de 10 partes:** a 10ª leva o resto e recebe `box-overflow`.

### Regras de flex e grid que mais importam

- **Colunas iguais:** grid (`display="grid" gridTemplateColumns="repeat(3, minmax(0, 1fr))"`) ou, numa row, `flex={1}` em cada filho. Nunca `width="33%"` + `gap` (soma mais de 100%).
- **`1fr` × `minmax(0, 1fr)`:** como no CSS, `1fr` nunca fica menor que a palavra mais longa da coluna; um valor como "R$ 52.400.000,00" alarga a coluna e empurra o grid para fora do slide (`box-overflow`). Com `minmax(0, 1fr)` as colunas ficam iguais e o texto encolhe nelas. Use `1fr` para conteúdo curto, `minmax(0, 1fr)` para cartões com valores.
- **Proporção 2:1:** `gridTemplateColumns="2fr 1fr"` ou `flex={2}` e `flex={1}`.
- **Ocupar o resto da altura:** `flex={1}` no Box do corpo. **Empurrar para o fim:** `marginTop="auto"` no último filho (rodapé), sem Box de enchimento.
- **Text numa row:** `flex={1}` para ele ocupar a largura que sobra e quebrar linha nela. **Só em row**: numa coluna, `flex={1}` num Text pode colapsá-lo (§9).
- **Tamanho que não pode encolher** (ícone, marcador): `flexShrink={0}` (o padrão é 1, como no CSS).

## 4. Texto

| prop | tipo | padrão | nota |
|---|---|---|---|
| `fontSize` | pt | 18 | herda |
| `fontWeight` | `'normal' \| 'bold'` ou número 1–1000 | `'normal'` | usa a face registrada mais próxima (regra do CSS); sem face a até 100 do pedido → `font-weight-fallback` (ver "Pesos") |
| `fontStyle` | `'normal' \| 'italic'` | `'normal'` | |
| `color` | cor | `'#000000'` | herda |
| `fontFamily` | string | `'Arial'` | família registrada em `fonts`; de fábrica **só Arial**; não registrada = `font-missing` (ver "Fontes") |
| `textAlign` | `'left' \| 'center' \| 'right'` | `'left'` | |
| `lineHeight` | `'normal'` ou número | `'normal'` | **como no CSS**: `'normal'` = altura natural da fonte (≈ 1,15 × `fontSize` no Arial); número = múltiplo do `fontSize` (`1.2` em 20 pt = 24 pt por linha) |
| `letterSpacing` | pt | 0 | espaço extra entre letras (rótulos em caixa alta: `letterSpacing={2}`) |
| `textTransform` | `'uppercase' \| 'lowercase' \| 'capitalize'` | — | aplicado antes de medir |
| `textDecoration` | `'underline' \| 'line-through'` | — | não herda; também por trecho (`Span`) |
| `fit` | `'shrink' \| 'truncate' \| 'error'` | `'shrink'` | o que fazer se não couber |
| `minSize` | pt | `max(floor(fontSize × 0.75), 10)` | piso do `shrink`; abaixo de 10 só se você passar explícito (`text-illegible`) |
| `maxLines` | número | — | corta com `…` após N linhas |
| `nowrap` ou `whiteSpace="nowrap"` | | — | nunca quebra: cada parágrafo é uma linha (valores, rótulos curtos) |

- **Quebra de linha é automática**, pela largura da área de conteúdo do Text (frame − borda − padding). `\n` só separa **parágrafos**: `<Text>{'Primeiro.\nSegundo.'}</Text>`.
- `lineHeight={1}` deixa a linha **mais baixa** que a natural (o texto fica apertado); para mais ar use 1.3–1.5. Omitir = `'normal'`.
- Um `Text` aceita caixa e pintura: `padding`, `backgroundColor`, `border*`, `borderRadius`. Numa row ele fica com a largura do conteúdo (pílula/tag).
- Filhos são concatenados sem separador: `<Text>Gerado em {ctx.name}.</Text>` funciona.
- Políticas de `fit`:
  - `shrink` (padrão): procura o **maior** tamanho entre `fontSize` e `minSize` em que o texto cabe; também reage a **palavra partida** (palavra mais larga que a linha). Textos da mesma **instância** de componente (os itens de um `Bullets`, label/valor/delta de um `KpiCard`) encolhem **juntos**; outra instância só encolhe se ela mesma não couber. Coube → `text-shrunk` (info). Não coube no mínimo → `text-overflow` (error). Palavra ainda partida no mínimo → `text-word-broken` (warning).
  - `truncate`: corta a última linha visível com `…` → `text-truncated` (warning).
  - `error`: não ajusta; se estourar → `text-overflow` (error).

**`lineHeight` numérico no Keynote:** o passo entre linhas sai exato quando `lineHeight × fontSize` é inteiro (fracionário é truncado, até −0,8 pt por linha), e a 1ª baseline fica em ≈ 0,8 × espaçamento, não na meia-entrelinha do CSS: com `lineHeight ≥ 1.5` o texto desce até ~2 pt em relação ao preview. Prefira `'normal'` (padrão) ou 1.2; para espaço entre parágrafos use `gap`/`margin`.

### Rich text (`Span`, `B`, `I`)

```tsx
import { B, I, Span, Text } from 'pptsx';

<Text fontSize={20} color="#1B2A4A">
  Receita <B>subiu 14%</B> em <Span color="#2F6FED" fontStyle="italic">todas</Span> as regiões,{' '}
  <I>exceto</I> no Norte (<Span textDecoration="line-through">meta antiga</Span>).
</Text>
```

- `Span`/`B`/`I` só existem **dentro de `Text`**. Fora dele → erro de estrutura `<Span> só pode aparecer dentro de <Text>`.
- Por trecho mudam `fontWeight`, `fontStyle`, `color`, `textDecoration`, `fontSize`, `fontFamily`, `verticalAlign` e `href`. A **entrelinha** é do `Text` inteiro; com `fontSize` por trecho, a linha em que o trecho cai cresce para caber (maior ascendente + maior descendente da linha). Número grande colado num rótulo pequeno: `<Text fontSize={14}>Satisfação de <Span fontSize={32}>4,8</Span> de 5</Text>`; para blocos separados, dois `Text` numa row com `alignItems="baseline"` (§3).
- O trecho herda o estilo do `Text`; o `Span` mais interno vence: `<Text fontWeight="bold">Total: <Span fontWeight="normal">acima da meta</Span></Text>`.
- **Espaços em JSX:** uma quebra de linha **no código** encostada num elemento some: `Receita` numa linha e `<B>subiu</B>` na seguinte vira "Receitasubiu". Mantenha o espaço na mesma linha ou use `{' '}`.

### Sobrescrito e subscrito (`Sup`, `Sub`)

```tsx
<Text fontSize={18}>Área de 52 m<Sup>2</Sup>, emissão de CO<Sub>2</Sub> e receita recorde<Sup>1</Sup>.</Text>
```

O trecho sai a 2/3 do corpo (o PowerPoint/Keynote reduzem sozinhos) e deslocado (30 % para cima, 25 % para baixo); a linha **não** muda de altura. No Keynote o sobrescrito fica ~0,08 × corpo mais baixo que no preview (1,4 pt a 18 pt).

### Links (`href`)

`href` em `Text`, `Span`, `Image` e `Box`: uma URL com esquema (`"https://…"`, `"mailto:…"`) ou `"slide:N"`, onde **N é o número do slide no seu `<Deck>`** (antes da paginação: a engine aponta para a 1ª parte). O link sai nativo; PowerPoint e Keynote **sublinham** o texto com link (o preview também), na cor do próprio texto. `slide:N` fora do deck → `link-target-missing` (error). Um Box sem fundo com `href` ganha uma área clicável transparente.

### Texto que continua (`Text paginate`)

`<Text paginate>` divide as **linhas** do texto entre clones do slide quando não cabem (como o `Box paginate` faz com itens): mesmo título, fundo e rodapé em cada parte; o texto **não encolhe** enquanto pagina. O corte cai no fim de um parágrafo se a parte ficar ao menos meio cheia; senão, dentro do parágrafo, deixando ao menos 2 linhas dele de cada lado. Dê área ao Text com `flex={1}` numa coluna. Não combina com `maxLines` nem `position="absolute"`, e é um nó paginate por slide (Box **ou** Text). A 1ª parte recebe `slide-continued` (info) com as linhas de cada parte.
- **Parágrafos:** `{'\n'}` separa parágrafos também no meio de rich text (`texto<Sup>1</Sup>{'\n'}próximo`); para um espaço visível entre eles, `{'\n\n'}` (uma linha vazia). `gap`/`margin` só valem entre `Text` diferentes.
- **Partes desequilibradas:** como o corte prefere fim de parágrafo, uma parte pode ficar até meio vazia. Ajuste `fontSize`/`lineHeight` por breakpoint (`fontSize={{ base: 15, tall: 16 }}`) e confira as linhas por parte na mensagem do `slide-continued`.
- Estilos, links (`href` de `Span`/`Sup`) e sobrescritos continuam valendo nas partes seguintes; componentes próprios que devolvem `Span`/`B`/`Sup` podem ser filhos de `Text`.

### Número de slide e rodapé (`SlideNumber`, `Deck footer`)

```tsx
const RODAPE = (
  <Box display="flex" justifyContent="space-between" padding="0 40 12" fontSize={10} color="#64748B">
    <Text>Relatório 2026</Text>
    <SlideNumber format="n / total" />
  </Box>
);

<Deck footer={RODAPE}>…</Deck>
```

- `footer` entra em **todo** slide como uma camada do tamanho do slide com o conteúdo empurrado para a base (não ocupa espaço no fluxo; deixe `padding` inferior no Slide maior que a altura do rodapé — o do exemplo tem ~24 pt, então 40 pt basta — para o corpo não passar por baixo dele). Path: `Slide > Footer > …`.
- O rodapé **herda** o estilo de texto de cada Slide (`color`, `fontFamily`…), como um filho: num slide de fundo escuro com `color="#FFFFFF"`, o rodapé sai branco. Para cor fixa, declare `color` no Box do rodapé.
- `SlideNumber` é o número do slide **no arquivo gerado** (as partes paginadas contam), como campo nativo do PowerPoint (atualiza se alguém reordenar). `format="n / total"` acrescenta o total como texto fixo. Também funciona solto num slide, fora do `footer`.

### NBSP e `nowrap`

**NBSP** (U+00A0) cola duas palavras: a linha nunca quebra nele. Use entre número e unidade ("R$ 52,4 mi"). No texto JSX: `R$&nbsp;52,4&nbsp;mi`; em strings JS (props como `items`, `value`): `'R$ 52,4'` (`&nbsp;` dentro de string sai literal).

**`nowrap`**: o texto nunca quebra. Se a linha não couber, `fit="shrink"` reduz até `minSize`; se ainda não couber, vem `text-overflow` com `data.axis: "width"`. Numa row, o `Text` com `nowrap` não encolhe abaixo da largura da linha: os irmãos é que encolhem.

### Fontes

De fábrica só existe **Arial** (medida com a Liberation Sans incluída no pacote, mesmas métricas; o arquivo sai com `Arial`). Outras famílias são registradas em `fonts` na config (`pptsx.config.ts`) ou em `RenderOptions.fonts`, **uma entrada por face**:

```ts
export default defineConfig({
  fonts: [
    { family: 'Inter', weight: 'regular', file: './fonts/Inter-Regular.ttf' }, // com file: relativo à config
    { family: 'Inter', weight: 'bold', file: './fonts/Inter-Bold.ttf' },
    { family: 'Arial', weight: 'regular' },                  // sem file: fonte do sistema
    { family: 'Arial', weight: 'bold' },                     // fonts SUBSTITUI o padrão: registre Arial se o deck ainda a usa
  ],
});
```

- Sem `file`, a engine procura a família nas pastas de fontes do sistema. Não achou: a CLI imprime `▲ fontes não encontradas no sistema: Inter bold` (no `--json`, `fontsMissing`) e todo `Text` que usa a face recebe `font-missing` (error).
- Itálico sem face `italic: true` registrada é medido com a face reta.
- **Pesos:** registre cada peso como uma face (`{ family: 'Inter', weight: 300, file: … }`, `weight: 600`…; `'regular'` = 400 e `'bold'` = 700). `fontWeight` escolhe a face mais próxima pela regra do CSS (500 tenta 400; 600 tenta 700 antes de descer). Fora de 400/700 o `.pptx` usa o nome da própria face (`Inter SemiBold`): aparece certo onde a fonte está **instalada** ou embutida (`--embed-fonts`, só PowerPoint); sem ela, o renderizador cai para a família base. Peso sem face a até 100 → `font-weight-fallback` (warning) e o texto sai com a face mais próxima. Exemplo: `examples/texto/pesos.tsx`.
- `--embed-fonts` (§7) embute as faces no `.pptx`, mas **só o PowerPoint usa** (o Keynote ignora). Só TrueType de uma face (`.ttf`) com licença que permite embed; o resto gera `font-not-embeddable`.

## 5. Tokens, layouts e componentes prontos

`examples/tokens.ts` → `import { tokens } from '../tokens.ts'`:

| grupo | valores |
|---|---|
| `tokens.color` | `brand #1B2A4A`, `brandDark #101B33`, `accent #2F6FED`, `accentSoft #E8EEFC`, `ink #1B2A4A`, `muted #5B6680`, `surface #F4F6FA`, `white #FFFFFF`, `positive #1E9E6A`, `negative #D64545` |
| `tokens.font` | `display 44`, `h1 32`, `h2 24`, `body 20`, `small 14`, `caption 11` |
| `tokens.space` | `page 40`, `gap 20`, `tight 10` |

Layouts (`'../layouts/index.ts'`) — cada um **devolve um `<Slide>`**, então é filho direto de `<Deck>`:

| layout | props | o que faz |
|---|---|---|
| `CoverLayout` | `title; subtitle?; caption?; ctx?` | fundo `brand`, círculo decorativo (`zIndex={-1}`) no canto superior direito, bloco de título empurrado para baixo com `marginTop="auto"`: título `display` bold branco (shrink, minSize 32), subtítulo `h2` (truncate, 2 linhas); `caption` = linha pequena no topo |
| `ContentLayout` | `title; justify?: 'start' \| 'center'; notes?; children` | fundo branco, padding `page`, cor `ink` herdada por todo o conteúdo, título `h1` bold com barra (`borderLeft`), corpo `Box flex={1}` (coluna) com os children. `justify="center"` centraliza conteúdo curto na altura que sobra |
| `ClosingLayout` | `title; subtitle?; contact?; ctx?` | fundo `brand`, texto centralizado (`textAlign` herdado), subtítulo com no máximo 80% da largura, círculo no canto inferior esquerdo |

Passe `ctx={ctx}` para `CoverLayout`/`ClosingLayout`: o círculo é dimensionado pela altura do slide e continua redondo em 16:9, 4:3 e wide.

Componentes (`'../components/index.ts'`):

| componente | props | o que faz |
|---|---|---|
| `Bullets` | `items: readonly TextChildren[]` (string ou rich text); `size?` (fontSize, padrão `font.body`); `gap?` (padrão `0.7 × size`); `paginate?` | coluna de itens: marcador elipse 8×8 (centrado na 1ª linha por `marginTop`) + Text `flex={1}` (shrink, minSize 14). A cor vem de quem envolve |
| `TwoColumn` | `left; right` (qualquer elemento); `stacked?: boolean` (padrão false); `ratio?: number` (fração da esquerda, padrão 0.5) | grid que ocupa o resto do corpo. Lado a lado: colunas `ratio` / `1 − ratio`, itens esticam na célula (um `Chart` ocupa a coluna). `stacked`: `left` com a altura do conteúdo em cima, `right` com o resto. Empilhe em 4:3 com `stacked={{ base: false, tall: true }}` |
| `KpiCard` | `label; value; delta?; trend?: 'up' \| 'down'; sentiment?: 'positive' \| 'negative' \| 'neutral'; size?: 'sm' \| 'md' \| 'lg'; inlineDelta?` | cartão `surface` arredondado (`flex={1}`): label muted, valor bold grande, delta. **`trend` só define a seta**; **`sentiment` define a cor** (padrão: up → positive, down → negative). `inlineDelta`: delta ao lado do valor, alinhado pela baseline (só com delta curto) |
| `KpiRow` | `items: readonly KpiCardProps[]; size?` | grid de uma linha, uma coluna `minmax(0, 1fr)` por cartão (larguras iguais); `size` vale para todos (o de um item vence) |

Aceitam valor responsivo: `Bullets.size`/`gap`, `TwoColumn.stacked`, `KpiCard.size`/`KpiRow.size`. Os componentes não recebem `ctx`: o que depende do valor é derivado **chave a chave** com `mapResponsive` (exportado de `'../components/index.ts'`), que mantém as mesmas chaves e escolhe o mesmo breakpoint. Faça igual no seu componente: `mapResponsive(size, (s) => s * 0.7)`. Precisa decidir **estrutura** (quantos filhos)? Receba `ctx` e use `ctx.pick`.

Os tipos são exportados de `'../components/index.ts'` (`KpiCardProps`, `KpiSize`…). Para dados fora do JSX, anote o tipo: `const kpis: readonly KpiCardProps[] = [...]`.

Tamanhos do `KpiCard` (pt):

| `size` | padding | label e delta | valor (minSize) | quando usar |
|---|---|---|---|---|
| `'sm'` | 14 | 12 | 32 (22) | 4+ cartões, valores longos ("1.284.392") |
| `'md'` (padrão) | 20 | 14 | 44 (28) | 2–3 cartões em 16:9/4:3 |
| `'lg'` | 20 | 16 | 56 (36) | 3 cartões com área sobrando (wide, 4:3). Corpo do `ContentLayout`: 640 pt em 16:9 e 4:3, 880 pt em wide |

```tsx
<ContentLayout title="Indicadores">
  <KpiRow size="sm" items={[
    { label: 'Receita (R$ mi)', value: '4,2', delta: '+18%', trend: 'up' },
    { label: 'Churn', value: '2,1%', delta: '−0,4 pp', trend: 'down', sentiment: 'positive' },
    { label: 'Chamados', value: '1.240', delta: '+22%', trend: 'up', sentiment: 'negative' },
    { label: 'NPS', value: '64' },
  ]} />
</ContentLayout>
<ClosingLayout ctx={ctx} title="Obrigado" subtitle="Perguntas?" contact="time@empresa.com" />
```

## 6. Receitas

Trechos filhos de `<Deck>` dentro de `defineDeck((ctx) => …)`, com os imports da §2 (mais `Image`, `Shape`, `Chart`, `Table`, `Span`, `Sup`, `Sub`, `SlideNumber`, `Path`, `Icon`, `Connector` de `'pptsx'` quando usados). Vitrine completa de CSS: `examples/showcase.tsx`.

### 6.1 Conteúdo com bullets, só primitivas

```tsx
<Slide padding={40} gap={20} backgroundColor="#FFFFFF" color="#1B2A4A">
  <Text fontSize={28} fontWeight="bold" borderLeft="6px solid #2F6FED" paddingLeft={12}>Por que agora</Text>
  <Box gap={10} fontSize={20}>
    {['Mercado cresce 30% ao ano', 'Concorrentes ainda sem produto móvel', 'Time pronto para executar'].map((item) => (
      <Box display="flex" gap={10} alignItems="flex-start">
        <Shape kind="ellipse" width={8} height={8} flexShrink={0} marginTop={7.5} backgroundColor="#2F6FED" />
        <Text flex={1} minSize={14}>{item}</Text>
      </Box>
    ))}
  </Box>
</Slide>
```

### 6.2 Grid de KPIs (3 colunas; 2 em 4:3)

```tsx
<Slide padding={36} gap={16} backgroundColor="#F4F6FA" color="#1B2A4A">
  <Text fontSize={26} fontWeight="bold">Indicadores em grid</Text>
  <Box display="grid" gridTemplateColumns={{ base: 'repeat(3, minmax(0, 1fr))', tall: 'repeat(2, minmax(0, 1fr))' }} gap={16}>
    {kpis.map((k) => (
      <Box backgroundColor="#FFFFFF" borderRadius={10} padding={14} boxShadow="0 3px 10px rgba(27,42,74,0.18)" fontSize={12} color="#5B6680">
        <Text>{k.label}</Text>
        <Text fontSize={30} fontWeight="bold" color="#1B2A4A">{k.value}</Text>
      </Box>
    ))}
  </Box>
</Slide>
```

Linhas `auto` por padrão: cada linha tem a altura do cartão mais alto, e os cartões esticam nela. Para os cartões ocuparem a altura que sobra do slide (qualquer número de linhas): `flex={1}` no grid + `gridAutoRows="minmax(0, 1fr)"`, e `justifyContent="center"` no cartão.

### 6.3 Duas colunas que empilham em 4:3

```tsx
<ContentLayout title="Receita por região">
  <Box display="grid" flex={1} gap={24}
    gridTemplateColumns={{ base: 'minmax(0, 1fr) minmax(0, 1fr)', tall: 'minmax(0, 1fr)' }}
    gridTemplateRows={{ base: 'minmax(0, 1fr)', tall: 'auto minmax(0, 1fr)' }}>
    <Bullets size={18} items={['Sudeste lidera com 52%', 'Sul cresceu 31%', 'Nordeste estável']} />
    <Chart kind="bar" data={dados} />
  </Box>
</ContentLayout>
```

O mesmo com o componente: `<TwoColumn stacked={{ base: false, tall: true }} ratio={0.45} left={…} right={…} />`. Imagem numa coluna, encolhendo pela altura sem distorcer: `right={<Image src="../assets/chart.png" width="100%" maxHeight="100%" alignSelf="flex-start" />}`. A engine mantém a proporção da imagem mesmo com `width="100%"` + `maxHeight` (no browser isso distorceria; é uma diferença intencional). Numa célula de grid, uma Image sem tamanho fica no início da célula e não estica; `justifySelf`/`alignSelf` posicionam.

### 6.4 Tags com wrap

```tsx
<Box display="flex" flexWrap="wrap" gap={8}>
  {['grid', 'wrap', 'margin auto', 'z-index', 'herança'].map((tag) => (
    <Text fontSize={13} padding="5 12" backgroundColor="#E8EEFC" color="#2F6FED" borderRadius={12}>{tag}</Text>
  ))}
</Box>
```

Cada `Text` com padding e fundo vira uma pílula da largura do conteúdo; o que não cabe na linha desce.

### 6.5 Rodapé no fim do slide

```tsx
<Slide padding={36} color="#1B2A4A">
  <Text fontSize={26} fontWeight="bold">Título</Text>
  <Text fontSize={16} marginTop={12}>Conteúdo…</Text>
  <Text fontSize={11} color="#5B6680" marginTop="auto" paddingTop={8} borderTop="1px solid #CCD3E0">
    Fonte: plataforma de dados, setembro de 2026.
  </Text>
</Slide>
```

`marginTop="auto"` absorve a sobra: o rodapé vai para o fim em qualquer tamanho, sem Box para empurrar.

### 6.6 Decoração atrás do conteúdo

```tsx
<Slide padding={48} justifyContent="center" backgroundColor="#1B2A4A" color="#FFFFFF">
  <Shape kind="ellipse" position="absolute" right={-120} top={-120} width={360} height={360} backgroundColor="#101B33" zIndex={-1} />
  <Box position="absolute" left={0} bottom={0} width="100%" height={8} backgroundColor="#2F6FED" />
  <Box position="absolute" right={70} top={60} width={120} height={120} backgroundColor="#2F6FED" opacity={0.35} rotate={18} borderRadius={14} />
  <Text fontSize={44} fontWeight="bold">Nova fase</Text>
</Slide>
```

`zIndex={-1}` pinta atrás do texto; sem ele a decoração absoluta pinta **por cima**. Absoluto pode sair do slide sem gerar erro. Foto de fundo inteira: `<Slide backgroundImage="url(../assets/foto.png)">`.

### 6.7 Lista longa → `paginate`

```tsx
<ContentLayout title="Doze pontos de atenção para o Q4">
  <Bullets paginate size={font.body} items={dozeItens} />
</ContentLayout>
<ClosingLayout ctx={ctx} title="Obrigado" />
```

Com os 12 itens de `examples/long-list.tsx`, 16:9 vira 3 slides com o mesmo título (4 itens cada) e 4:3 vira 2 (6 cada). O encerramento passa a ser o slide 4 (ou 3) da saída. Leia `data.parts` e a mensagem do `slide-continued`; prefira isso a baixar `minSize` até a lista caber.

### 6.8 Gráfico nativo

```tsx
<ContentLayout title="Receita contra a meta">
  <Chart kind="bar" flex={1} title="Receita recorrente (R$ mi)" legend showValues colors={[color.accent, color.muted]}
    data={{ categories: ['Q4 2025', 'Q1 2026', 'Q2 2026', 'Q3 2026'],
            series: [{ name: 'Realizado', values: [38.2, 41.5, 45.9, 52.4] }, { name: 'Meta', values: [40, 42, 45, 50] }] }} />
</ContentLayout>
```

Prefira `Chart` a um PNG de gráfico: quem recebe o `.pptx` edita os dados. `kind="line"` para tendência, `kind="pie"` com uma série para composição. Mais em `examples/charts.tsx`.

### 6.9 Tabela de resultados

```tsx
<ContentLayout title="Receita por área">
  <Table
    columns={[{ header: 'Área', width: '40%' }, { header: 'Q2 (R$ mi)', align: 'right' }, { header: 'Q3 (R$ mi)', align: 'right' }, { header: 'Δ', align: 'right' }]}
    rows={[['Varejo', '18,6', '22,6', '+21,5%'], ['Crédito', '9,8', '10,4', '+6,1%'], ['Seguros', '6,1', '6,8', '+11,5%']]}
    fontSize={{ base: font.small, tall: font.small + 2 }}
    header={{ fill: color.brand, color: color.white }}
    stripe={color.surface}
    border={color.muted}
  />
</ContentLayout>
```

A 1ª coluna fica com 40%; as outras dividem o resto pelo conteúdo. Números como string para manter a vírgula e o sinal; a cor do texto vem do Slide. Mais de ~10 linhas num 16:9: divida em dois slides.

### 6.10 Esconder ou trocar por breakpoint

```tsx
<Text fontSize={12} color="#5B6680" display={{ base: 'none', tall: 'flex' }}>Nota que só cabe em 4:3.</Text>
<Box display={{ base: 'flex', tall: 'none' }} gap={12}>…versão lado a lado…</Box>
```

`display="none"` tira o nó do layout e do PPTX naquele tamanho; os irmãos mantêm o índice no path. Para mudar quantos itens aparecem, `items.slice(0, ctx.pick({ base: 3, tall: 5 }))`.

### 6.11 Fluxograma

Nós num **grid** (não absolutos: o grid se adapta a 4:3), cada um com `id`; conectores depois.

```tsx
const Step = ({ id, shape, color, children }: { id: string; shape: 'pill' | 'roundRect' | 'diamond' | 'parallelogram'; color: string; children: string }) => (
  <Box id={id} shape={shape} width={shape === 'diamond' ? 120 : 130} height={shape === 'diamond' ? 80 : 46} backgroundColor={color}
    justifyContent="center" alignItems="center" padding={shape === 'parallelogram' ? '0 20' : '0 8'}>
    <Text fontSize={12} color="#FFFFFF" textAlign="center">{children}</Text>
  </Box>
);

<Slide padding="24 32" gap={16}>
  <Text fontSize={24} fontWeight="bold">Como um pedido é atendido</Text>
  <Box display="grid" gridTemplateColumns="repeat(4, 1fr)" gridTemplateRows="1fr 1fr" placeItems="center" flex={1}>
    <Step id="inicio" shape="pill" color="#1B2A4A">Pedido chega</Step>
    <Step id="validar" shape="roundRect" color="#2F6FED">Validar</Step>
    <Step id="ok" shape="diamond" color="#F59E0B">Estoque?</Step>
    <Step id="enviar" shape="roundRect" color="#10B981">Enviar</Step>
    <Box gridColumn={3} gridRow={2}><Step id="comprar" shape="parallelogram" color="#EF4444">Comprar</Step></Box>
  </Box>
  <Connector from="inicio" to="validar" />
  <Connector from="validar" to="ok" />
  <Connector from="ok" to="enviar" label="sim" labelStyle={{ background: '#FFFFFF' }} />
  <Connector from="ok" to="comprar" label="não" labelStyle={{ background: '#FFFFFF' }} />
  <Connector from="comprar" to="enviar" fromSide="right" toSide="bottom" route="elbow" />
</Slide>
```

Rótulo com `background` igual ao fundo do slide "corta" a linha atrás do texto. Exemplo maior: `examples/diagrams/fluxo.tsx`.

### 6.12 Arquitetura com ícones

```tsx
const Card = ({ id, icon, title }: { id: string; icon: string; title: string }) => (
  <Box id={id} display="flex" alignItems="center" gap={8} padding="8 12" backgroundColor="#FFFFFF" border="1px solid #CBD5E1" borderRadius={6}>
    <Icon src={`../assets/icons/${icon}.svg`} size={20} color="#2F6FED" flexShrink={0} />
    <Text fontSize={12} fontWeight="bold">{title}</Text>
  </Box>
);

<Slide padding="24 32" gap={16} backgroundColor="#F8FAFC">
  <Text fontSize={24} fontWeight="bold">Arquitetura</Text>
  <Box display="grid" gridTemplateColumns="1fr 1fr" columnGap={60} alignItems="center" flex={1}>
    <Box border="1.5px dashed #2F6FED" borderRadius={10} padding={12} gap={10}>
      <Text fontSize={11} fontWeight="bold" color="#2F6FED">CLIENTES</Text>
      <Card id="web" icon="globe" title="Site" />
      <Card id="app" icon="user" title="App" />
    </Box>
    <Box border="1.5px dashed #10B981" borderRadius={10} padding={12} gap={10}>
      <Text fontSize={11} fontWeight="bold" color="#10B981">BACKEND</Text>
      <Card id="api" icon="server" title="API" />
      <Card id="db" icon="database" title="Banco" />
    </Box>
  </Box>
  <Connector from="web" to="api" route="elbow" />
  <Connector from="app" to="api" route="elbow" />
  <Connector from="api" to="db" />
</Slide>
```

Agrupamento = Box com `border="… dashed …"`. `columnGap` largo deixa espaço para a dobra do cotovelo. Exemplo maior: `examples/diagrams/arquitetura.tsx`.

### 6.13 Linha do tempo com setas

```tsx
const STEPS = [
  { id: 'q1', label: 'Q1', text: 'Piloto em 2 lojas' },
  { id: 'q2', label: 'Q2', text: 'Rede sul' },
  { id: 'q3', label: 'Q3', text: 'Rede nacional' },
  { id: 'q4', label: 'Q4', text: 'App próprio' },
];

<Box display="flex" justifyContent="space-between" alignItems="flex-start">
  {STEPS.map((step) => (
    <Box alignItems="center" gap={8} width={130}>
      <Box id={step.id} shape="ellipse" width={48} height={48} backgroundColor="#2F6FED" justifyContent="center" alignItems="center">
        <Text fontSize={14} fontWeight="bold" color="#FFFFFF">{step.label}</Text>
      </Box>
      <Text fontSize={13} textAlign="center">{step.text}</Text>
    </Box>
  ))}
</Box>
{STEPS.slice(1).map((step, index) => <Connector from={STEPS[index]!.id} to={step.id} strokeWidth={2} stroke="#94A3B8" />)}
```

Seta solta sem nós: `<Shape kind="line" width={80} height={0} strokeWidth={2} endArrow="triangle" />`, `<Shape kind="arrowRight" width={40} height={20} />` (seta cheia) ou um `Path` (`d="M0 12 L16 12 M10 6 L16 12 L10 18"` com `lineCap="round"`). As três receitas estão em `examples/diagrams/receitas.tsx`.

### 6.14 Relatório corrido com rodapé numerado

```tsx
<Deck footer={RODAPE /* §4 "Número de slide e rodapé" */}>
  <Slide padding="32 40 40" gap={12}>
    <Text fontSize={24} fontWeight="bold">O ano em resumo</Text>
    <Text paginate flex={1} fontSize={16} lineHeight={1.4}>{textoLongo}</Text>
  </Slide>
</Deck>
```

O texto que não cabe continua nos slides seguintes, com o mesmo título e o rodapé numerado (`1 / 4`, `2 / 4`…). Parágrafos separados por `'\n'`. Exemplo completo: `examples/texto/relatorio.tsx`.

### 6.15 Nota de rodapé

```tsx
<Text fontSize={18}>Receita recorde<Sup href="slide:3">1</Sup> no trimestre.</Text>
…
<Text fontSize={11} color="#64748B"><Sup>1</Sup> Fonte: balanço auditado de 2026.</Text>
```

`href="slide:3"` no número leva ao slide de notas (3 = o 3º `<Slide>` do seu Deck).

### 6.16 Índice com links

```tsx
const SECOES = [{ titulo: 'O ano em resumo', slide: 2 }, { titulo: 'Notas', slide: 3 }];

<Box gap={10}>
  {SECOES.map((s) => <Text fontSize={20} href={`slide:${s.slide}`} color="#2F6FED">{s.titulo}</Text>)}
</Box>
```

As três receitas estão em `examples/texto/receitas.tsx`.

## 7. CLI e fluxo de trabalho

**(a) Dentro deste repo** (como na §2): rode na raiz; o deck fica em `examples/agent-test/`, importa `pptsx` sem build e pode usar tokens, layouts e componentes de `examples/`.

```
node bin/pptsx.mjs build examples/agent-test/meu-deck.tsx --size 16x9,4x3,wide --out dist/agent-test --json
```

`npx tsx src/cli.ts build …` é equivalente.

**(b) Projeto próprio:** `npm install pptsx` e `npx pptsx init` numa pasta (cria `deck.tsx`, `tsconfig.json`, `pptsx.config.ts`, `assets/`, `.gitignore` e põe `"type": "module"` no `package.json`). Imports `from 'pptsx'`; imagens relativas ao deck (`'./assets/foto.png'`). Tokens, layouts e componentes da §5 **não** vêm no pacote: use primitivas ou copie-os de `examples/`.

```
npx pptsx build deck.tsx --size 16x9,4x3 --json
```

Flags: `--size` (`16x9`, `16x10`, `4x3`, `wide`, ou `10x7.5in`; padrão `16x9`), `--out` (padrão `dist/`), `--debug` (contornos vermelhos tracejados em toda caixa e estouro em vermelho no PNG), `--json`, `--preview native|none`, `--preview-width 1280`, `--lang pt-BR`, `--line-breaks forced|auto` (padrão `forced`: cada linha medida vira quebra manual, igual ao PNG), `--watch` (rebuild a cada mudança; com `--json`, um JSON por linha), `--embed-fonts`. `pptsx init [dir] [--force] [--json]`.

Arquivos gerados (`<deck>` = nome do arquivo sem extensão):

```
dist/agent-test/
├── meu-deck.16x9.pptx
├── meu-deck.16x9.overview.png     ← grade com todos os slides + selos
├── meu-deck.16x9/slide-01.png …   ← um PNG por slide
├── meu-deck.4x3.pptx / .overview.png / meu-deck.4x3/…
└── meu-deck.diagnostics.json      ← todos os diagnósticos, todos os tamanhos
```

- Com `--json`, stdout tem **só** `{ "files": [...], "diagnostics": [...] }` (mais `"fontsMissing"` se for o caso). Se o deck nem rodar (erro de sintaxe, texto fora de `<Text>`…), `{ "error": "mensagem" }`.
- **Exit code**: `1` se houver qualquer diagnóstico `error` ou falha; `0` caso contrário. `warning`/`info` não falham.
- Sempre gere **os dois tamanhos** (`16x9,4x3`); inclua `wide` se o deck usa esse breakpoint.
- Config opcional `pptsx.config.ts` (`defineConfig({ fonts?, sizes?, lang?, textSafety?, lineBreaks?, embedFonts? })`); flags vencem a config.

## 8. Diagnósticos

Formato (cada item de `diagnostics.json` / `diagnostics` do `--json`):

```json
{
  "size": "16x9",
  "slide": 2,
  "severity": "error",
  "code": "text-overflow",
  "path": "Slide > Box > Text",
  "message": "Texto estourou 0.5% (1.2 pt) da altura disponível mesmo em 19 pt (mínimo); reduza o conteúdo, aumente a área ou baixe minSize.",
  "data": { "overflowPt": 1.2, "overflowPct": 0.5, "fromSize": 20, "toSize": 19 }
}
```

`slide` começa em 1 e é o índice no **arquivo gerado**; com paginação, os slides seguintes andam e o diagnóstico traz `data.sourceSlide` = índice no `<Deck>` do autor. `severity`: `error` (corrigir), `warning` (aceitável se intencional), `info` (só aviso).

Campos de `data` (opcionais): `overflowPt`/`overflowPct`, `fromSize`/`toSize`, `axis` (`"width"` num `nowrap`), `shownRows`/`totalRows` (`table-overflow`) e:

- `causedBy`: path do nó que **provocou** este estouro (um irmão que pede mais espaço do que há). Corrija a causa primeiro; os derivados somem sozinhos. Dentro de grid não há `causedBy` entre células: cada célula é dona do próprio estouro.
- `count` e `paths`: diagnóstico **agrupado**. Irmãos homônimos com o mesmo problema viram um item só (`Box[0..7]`, `Box[0,2,5]`). Corrija uma vez, no `.map` ou componente.

### Como ler o `path`

- Segmentos separados por ` > `, do slide até o nó. Segmento = primitiva (`Slide`, `Box`, `Text`…) **ou o nome do componente** que devolveu o nó (`ContentLayout`, `Bullets`, o seu `MeuCard`).
- `[i]` aparece quando o pai tem mais de um filho com o mesmo segmento (índice entre esses irmãos, a partir de 0). Um nó com `display="none"` some, mas conta no índice.
- Exemplo: `ContentLayout > Box > Bullets > Box[2] > Text` = corpo do ContentLayout, terceiro item do `Bullets`.

### Códigos

| code | severity | causa | correção típica |
|---|---|---|---|
| `text-shrunk` | info | o texto (ou a tabela inteira) foi reduzido e coube | nada; se ficou pequeno, encurte ou dê área |
| `text-overflow` | error | `shrink` chegou em `minSize` e não cabe, `fit="error"` estourou, ou a área é 0 pt. `data.axis: "width"`: `nowrap` mais largo que a área | com `causedBy`: corrija a causa. Senão: encurte; dê área (`flex={1}` no contêiner, menos padding/gap/borda); baixe `minSize`; divida o slide; `fit="truncate"`. Numa célula de grid de altura fixa: track `auto` |
| `text-word-broken` | warning | palavra mais larga que a linha, partida por caractere | abrevie ("R$ 52,4 mi"); dê largura; `size="sm"` no `KpiCard`. Tabela: `width` maior na coluna citada |
| `table-overflow` | error | a `Table` não cabe nem no `minSize`; `data.shownRows` de `data.totalRows` cabem | menos linhas, texto mais curto, mais área |
| `text-illegible` | warning | o shrink desceu abaixo de 10 pt (só com `minSize` < 10) | encurte ou dê área |
| `text-truncated` | warning | `truncate`/`maxLines` cortou com `…` | se não era a intenção: encurte ou aumente a área |
| `box-overflow` | error | filhos em fluxo (tamanhos fixos, margens, gap, padding, borda) somam mais que a área de conteúdo; linhas do wrap que não cabem; item maior que a sua **célula de grid** | reduza fixos/gap/margens; `flexShrink` volta a 1; troque fixos por `flex`/`%`; no grid, track `auto` ou `minmax(auto, …)`; no wrap, dê altura ou menos itens |
| `out-of-slide` | error | nó **em fluxo** fora do slide | reduza; use `%`/`flex`; decoração → `position="absolute"` |
| `css-not-emitted` | warning | propriedade CSS sem de/para no PPTX (`overflow: hidden`, gradiente, `filter`, `scale`/`skew`, sombra `inset`/`spread`/múltipla, sombra sem fundo, raio por canto, raio com bordas diferentes por lado, track fora do subconjunto, rotate em Chart/Table, propriedade desconhecida). O preview também não desenha | remova ou troque por uma suportada (§3); se o efeito é dispensável, ignore |
| `slide-continued` | info | um `Box paginate` (itens) ou `Text paginate` (`data.kind: "text"`, linhas) virou `data.parts` slides | nada; partes desequilibradas → `fontSize`/`gap` responsivos |
| `font-weight-fallback` | warning | `fontWeight` sem face registrada a até 100; `data.requestedWeight` / `data.usedWeight` | registre a face desse peso em `fonts` ou use um peso que existe |
| `link-target-missing` | error | `href="slide:N"` com N maior que os slides do `<Deck>`; o link não sai | corrija o N (número do `<Slide>` no seu Deck, a partir de 1) |
| `image-upscaled` | info | imagem ampliada acima de 96 dpi | arquivo com mais resolução ou área menor |
| `font-missing` | error | família não registrada ou não achada; único diagnóstico desse Text | tire `fontFamily` (Arial), registre a face ou instale |
| `connector-target-missing` | error | `from`/`to` de um `Connector` sem nó com esse `id` no slide (a mensagem lista os ids do slide); o conector não sai | ponha `id` no nó certo ou corrija o nome |
| `connector-omitted` | info | com `paginate`, as duas pontas caíram em slides diferentes; o conector não sai | tire um dos nós do Box paginate ou encurte a lista |
| `icon-rasterized` | info | o SVG do `Icon` saiu como imagem (motivo na mensagem: gradiente, `transform`, `<defs>`, opacidade, texto…) ou `render="image"` | aceite, ou simplifique o SVG para só formas e cores sólidas |
| `path-invalid` | error | o `d` de um `Path` tem comando fora de `M L H V C S Q T A Z` ou número malformado; nada é desenhado | corrija o `d` (a mensagem diz o trecho) |
| `font-not-embeddable` | warning | com `--embed-fonts`: face não embutível (`.ttc`, `.otf` CFF, licença) | `.ttf` de uma face com licença de embed |

Mensagens reais:

```
✖ text-overflow em Slide > Text[0]
  Texto estourou 73.9% (10.7 pt) da altura disponível mesmo em 22 pt (mínimo); reduza o conteúdo, aumente a área ou baixe minSize. Esse estouro é consequência: Slide > Text[1] pede 131.9 pt a mais do que a área tem; corrija Slide > Text[1] primeiro.
✖ text-overflow em Slide > Box > Text[1]
  Texto estourou 34.2% (20.5 pt) da altura disponível em 14 pt (fit="error" não ajusta); reduza o conteúdo, aumente a área ou troque para fit="shrink" ou fit="truncate".
✖ box-overflow em Slide > Box > Box
  O item ocupa 212 × 98.6 pt (com margens), mas a célula do grid tem 212 × 60 pt: estouro de 38.6 pt (64.4%). Use um track auto/minmax(auto, …) nessa linha/coluna, reduza o conteúdo ou o tamanho fixo do item.
✖ box-overflow em Slide > Box
  As linhas do wrap ocupam 64.2 pt na vertical, mas a área de conteúdo tem 60 pt: estouro de 4.2 pt (7%). Reduza width/height fixos ou gap/padding, permita flexShrink nos filhos (flexShrink={0} impede), ou aumente o contêiner.
✖ box-overflow em Slide > Box[0]
  Os filhos em fluxo somam 120 pt na vertical (column), mas a área de conteúdo tem 100 pt: estouro de 20 pt (20%). Reduza width/height fixos ou gap/padding, permita flexShrink nos filhos (flexShrink={0} impede), ou aumente o contêiner.
▲ css-not-emitted em Slide > Box
  A propriedade CSS overflow: hidden não sai no PPTX: o PPTX não recorta formas; os filhos saem inteiros. O preview também não a desenha; remova-a ou troque por uma suportada (ver docs/AGENT_GUIDE.md).
• slide-continued em ContentLayout > Box > Bullets
  Slide 1 do autor virou 3 slides (4 de 12 itens no 1º, 4 no 2º, 4 no 3º). Para caber em menos slides, reduza o fontSize dos itens ou o conteúdo.
• text-shrunk em Slide > Bullets > Box[0..3] > Text
  Texto reduzido de 20 pt para 19 pt para caber na área. Se a redução incomodar, encurte o conteúdo ou aumente a área. (×4: mesmo problema em Box[0..3])
▲ text-word-broken em ContentLayout > Box > KpiRow > KpiCard[0,1,2,4] > Text[1]
  Palavra partida no meio por falta de largura: "52.400.000,00" não cabe inteira numa linha de 72 pt mesmo reduzido de 44 pt para 28 pt. Encurte a palavra/valor (abrevie, ex.: "R$ 52,4 mi"), alargue a área (menos colunas, flexGrow, width maior) ou reduza o fontSize.
✖ table-overflow em ContentLayout > Box > Box > Table
  Tabela estourou 41.5 pt (25.9%) da altura disponível mesmo em 10 pt (mínimo): 9 de 12 linhas cabem inteiras. Reduza linhas/colunas, encurte o texto das células, aumente a área ou baixe minSize.
✖ font-missing em Slide > Text
  Fonte "Inter regular" não foi encontrada: não está em options.fonts, ou foi registrada sem "file" e não existe no sistema. …
```

As mensagens usam os nomes CSS (`flexShrink`, `flexGrow`, `fontSize`); `minSize`, `nowrap` e `fit` são props da engine (§4).

O exit code não vem dentro do `--json`: leia `$?` logo depois do comando (num pipe, ele é o do último programa).

Sem `--json`, a CLI imprime um resumo em que os derivados (com `causedBy`) aparecem **sob a causa**, com `↳`, e não contam no cabeçalho (`+N derivados`); o exit code conta todos.

Erros de estrutura (o deck não chega a ser medido; exit 1):

```
Texto "Olá" fora de <Text>; envolva o conteúdo em <Text> (em Slide > Box)
<Text> só aceita strings, números e <Span>/<B>/<I> como filhos (em Slide > Text)
<Span> só pode aparecer dentro de <Text> (em Slide > Box)
<Chart> precisa de width, height ou grow: um gráfico não tem tamanho próprio (em Slide > Chart)
<Chart>: a série "Receita" tem 3 valores para 4 categorias
<Table>: a linha 3 tem 3 células para 4 colunas
id "a" repetido no slide (já usado em Slide > Box); ids têm que ser únicos por slide (em Slide > Text)
<Shape kind="rect">: startArrow/endArrow só valem em kind="line"; para seta cheia use kind="arrowRight" ou <Connector>
<Connector> não aceita "backgroundColor": ele não é uma caixa (use from, to, fromSide, …)
<Icon>: não consegui ler "./icones/x.svg" (…)
Prop "href" de <Text>: … use "slide:N" com N ≥ 1 (o número do slide no seu <Deck>)
Só um nó paginate (<Box paginate> ou <Text paginate>) por slide; encontrados 2
<Text paginate> não combina com maxLines: o texto continua no próximo slide em vez de ser cortado
```

### O overview PNG

`<deck>.<size>.overview.png`: miniaturas numeradas (o número = `slide`). **Selo vermelho** = o slide tem `error`; **amarelo** = `warning`; sem selo = ok (ou só `info`). Use o overview para conferir visualmente (texto pequeno, área vazia, decoração por cima do texto) e `diagnostics.json` para saber o quê e onde. Com `--debug`, cada caixa tem contorno vermelho tracejado.

### Checklist de correção

1. Rode o build com `--size 16x9,4x3 --json` (mais `wide` se usar esse breakpoint) e leia o exit code.
2. `{ "error": … }`: erro de estrutura/sintaxe; a mensagem traz o path. Corrija e rode de novo.
3. Filtre `severity: "error"` e, entre eles, primeiro os **sem `causedBy`**: são as causas.
4. Para cada causa: ache o slide (`data.sourceSlide` se houver), siga o `path` no código. Agrupado (`count`, `[a..b]`): corrija uma vez, no `.map`/componente.
5. Aplique a correção que a `message` sugere. Prefira mudar estrutura (`flex`, grid, menos texto, empilhar em `tall`, `paginate`) a números mágicos.
6. Veja o overview do tamanho afetado.
7. Repita até **exit 0**. Depois revise `warning` (`css-not-emitted`, palavra partida, truncamento) e `info`.

## 9. Armadilhas comuns

```jsx
// ERRADO: texto solto fora de <Text>  → erro "fora de <Text>"
<Box>Olá</Box>
// ERRADO: Text dentro de <Text>      → erro "só aceita strings, números e <Span>/<B>/<I>"
<Text>Receita <Text fontWeight="bold">subiu</Text></Text>
// CERTO:
<Text>Receita <B>subiu</B></Text>
```

- **Texto sempre dentro de `<Text>`**; o TypeScript não acusa outro elemento dentro de `<Text>`, o erro só aparece no build.
- **`display="flex"` é row**: um `Box` sem `display` empilha; com `display="flex"` os filhos ficam lado a lado. Para coluna explícita: `flexDirection="column"`.
- **Decoração absoluta sem `zIndex={-1}` pinta por cima** do conteúdo (regra do browser). Toda elipse/forma de fundo leva `zIndex={-1}`.
- **`overflow: hidden` não recorta**: o PPTX não tem recorte; vira `css-not-emitted` e os filhos saem inteiros. Dimensione o conteúdo para caber.
- **`borderRadius` + borda só de um lado** não sai no PPTX (a linha sai reta): use `borderTop` sem raio, ou raio + `boxShadow` (§3).
- **Dois `marginTop="auto"` irmãos** dividem o espaço livre igualmente (como no CSS).
- **`1fr` cresce com a palavra mais longa**: cartões com valores longos num grid `repeat(n, 1fr)` empurram o grid para fora do slide. Use `repeat(n, minmax(0, 1fr))` (§3).
- **`Chart` sem tamanho** é erro de estrutura: `flex={1}`, `width`/`height` ou célula de grid. Numa coluna de altura pelo conteúdo, `flex` não tem o que ocupar.
- **`flex={1}` em Text dentro de coluna** de altura pelo conteúdo colapsa o texto (área 0 pt → `text-overflow` "A área disponível para o texto é 0 pt"). Use `flex` em Text só em row.
- **`flex={1}` num filho anula o `justifyContent`** do pai: o filho ocupa a sobra e não há o que centralizar.
- **`width="50%"` + `gap`** numa row soma mais que 100%: use `flex={1}` ou grid.
- **Tamanho fixo encolhe** (`flexShrink` padrão é 1): um marcador `width={8}` numa row apertada vira elipse achatada. `flexShrink={0}` no que tem tamanho rígido.
- **`lineHeight` é múltiplo do `fontSize`** (CSS): `lineHeight={1}` aperta as linhas (menor que a altura natural). Para "normal", omita.
- **Borda ocupa espaço**: `border="6px solid …"` num Box de altura fixa tira 12 pt da área de conteúdo; um texto que cabia pode estourar.
- **Margens contam**: filhos com `marginTop`/`marginBottom` somam na altura do pai; o `box-overflow` diz quanto.
- **`{ tall: 24 }` sem `base`** é erro. Sempre `{ base: 20, tall: 24 }`.
- **`wide` vence `tall`**: num tamanho que é os dois, `{ base: 20, tall: 24, wide: 26 }` dá 26. O preset `wide` (960×540) **não** é `tall`; 16x10 **é**.
- **Não dá para desligar uma prop por breakpoint** (`{ base: '80%', tall: undefined }` continua `'80%'`): dê outro valor, ou esconda o nó inteiro com `display`.
- **Props antigas** (`direction`, `align`, `justify`, `grow`, `shrink`, `fill`, `stroke`, `radius` em Box; `size`, `weight`, `italic`, `font`, `align` em Text) ainda funcionam como alias, mas vão sair: escreva CSS (apêndice). Não misture as duas formas no mesmo nó.
- **`paginate` em row ou absoluto**: absoluto é erro; numa row a divisão é por colunas estreitas. Pagine uma coluna.
- **`\n` para quebrar linha**: não precisa; `\n` cria parágrafo novo.
- **Fonte diferente de Arial sem registrar** → `font-missing`. Omita `fontFamily` ou registre a família.
- **`position="absolute"` para posicionar conteúdo**: não faça; absoluto é só decoração. Conteúdo vai em fluxo (use grid, `margin`, `justifyContent`).
- **Caminhos de imagem** são relativos ao arquivo do deck: de `examples/agent-test/`, `'../assets/chart.png'`.
- **O gráfico real não é o do PNG**: PowerPoint e Keynote redesenham o gráfico dentro do frame. Não ajuste números pelo PNG.
- **Vírgula decimal**: no `Chart`, `values` são números (`52.4`); na `Table`, células são texto (`'52,4'`).
- **Conector não desvia de obstáculos**: com `auto`, uma linha pode atravessar um cartão no meio do caminho. Escolha `fromSide`/`toSide` (e `route="elbow"`) olhando o PNG; dois conectores do mesmo lado saem do mesmo ponto.
- **`Connector` não é caixa**: nada de `margin`, `position`, `backgroundColor` nele (erro de estrutura). Ele também não tem `id`.
- **`id` repetido** no mesmo slide é erro (cuidado com `.map` que gera ids iguais: use `id={item.key}`). Em slides diferentes, pode repetir.
- **Texto dentro de `Box shape`** fica no retângulo do padding, não na forma: losango, hexágono e paralelogramo precisam de `padding` lateral; `callout` tem a ponta **fora** do frame (deixe espaço embaixo).
- **Ícone com gradiente vira imagem** (`icon-rasterized`): não muda de cor nem é editável. Para recolorir, o SVG precisa usar `currentColor` ou preto.
- **`Path` com arco (`A`)** é aproximado por cúbicas (erro < 0,1 % do raio): invisível, mas o PowerPoint mostra pontos de Bézier ao editar.
- **Peso sem face vira aviso, não negrito sintético**: `fontWeight={600}` com só regular e bold registrados usa a bold (a 100) sem aviso; `fontWeight={900}` usa a bold **com** `font-weight-fallback`. Registre as faces que o deck usa.
- **`Inter SemiBold` só aparece onde está instalada** (ou embutida, no PowerPoint): no Keynote de quem não tem a fonte, o texto cai para a família base.
- **`slide:N` é o slide do seu `<Deck>`**, não o do arquivo gerado (a paginação desloca os números; a engine traduz).
- **`Text paginate` não encolhe**: se a fonte ficar grande demais, diminua `fontSize`; e ele precisa de altura (`flex={1}` numa coluna).
- **Rodapé por cima do corpo**: o `footer` não ocupa espaço; sem `padding` inferior no Slide, o texto do corpo passa por baixo dele.
- **Diagrama com `position="absolute"`** funciona, mas não se adapta a 4:3; prefira grid com `placeItems="center"` e tamanhos fixos nos nós.

## Apêndice — Migração das props antigas → CSS

As props antigas continuam aceitas como alias (resolvidas para CSS), mas saem numa versão futura. **Não são aliases (continuam válidas):** `size` de `Bullets`/`KpiCard`/`KpiRow`/`Chart`, `justify` de `ContentLayout`, `radius`/`stroke`/`strokeWidth` de `Shape`, `fill` em `Table.header`, `fit`/`minSize`/`maxLines`/`nowrap` de `Text`. Ao mexer num deck antigo, troque assim:

| antiga | CSS | nota |
|---|---|---|
| `direction="row"` (Box, Slide) | `display="flex"` (Box) / `flexDirection="row"` (Slide) | Box sem `display` continua coluna |
| `direction="column"` | (padrão) ou `flexDirection="column"` | |
| `align="start\|center\|end\|stretch\|baseline"` (Box) | `alignItems="flex-start\|center\|flex-end\|stretch\|baseline"` | |
| `justify="start\|center\|end\|between\|around\|evenly"` | `justifyContent="flex-start\|center\|flex-end\|space-between\|space-around\|space-evenly"` | |
| `grow={1}` | `flex={1}` | `grow` mantém a base antiga (0 só sem tamanho no eixo); `flex={1}` = `1 1 0%` |
| `shrink={0}` | `flexShrink={0}` | |
| `fill="#…"` (Box, Slide) | `backgroundColor="#…"` | no `Shape`, `fill` = `backgroundColor` (cor da forma) |
| `stroke="#…"` / `strokeWidth={2}` (Box) | `border="2px solid #…"` | o `stroke` antigo não ocupava espaço; a borda CSS ocupa (fica dentro da caixa). No `Shape`, `stroke`/`strokeWidth` continuam sendo a linha da forma |
| `radius={8}` (Box) | `borderRadius={8}` | no `Shape roundRect`, `radius` continua |
| `background="#…"` (Slide) | `backgroundColor="#…"` | `background={{ image }}` = `backgroundImage="url(…)"` |
| `padding={{ top: 10 }}` | `paddingTop={10}` ou `padding="10 0 0"` | o objeto continua valendo |
| `size={20}` (Text, Table) | `fontSize={20}` | herda de Slide/Box. No `Chart`, `size` = tamanho dos rótulos |
| `weight="bold"` | `fontWeight="bold"` | em `Span` também |
| `italic` | `fontStyle="italic"` | em `Span` também |
| `font="Inter"` | `fontFamily="Inter"` | |
| `align="center"` (Text) | `textAlign="center"` | herda |
| `fit="cover"` (Image) | `objectFit="cover"` | `fit` do Text continua (shrink/truncate/error) |
| `lineHeight={1.2}` (multiplicava a altura natural) | `lineHeight={1.38}` (≈ 1,2 × 1,15) ou `'normal'` | agora número = múltiplo do `fontSize`; `lineHeight={1}` antigo = `'normal'` |
| Box row + `Shape` barra ao lado do título | `borderLeft="6px solid #…"` + `paddingLeft` no `Text` | |
| Box só para empurrar (padding/grow vazio) | `marginTop="auto"` / `margin` | |
| decoração absoluta antes do conteúdo | a mesma, com `zIndex={-1}` | antes a ordem do código bastava |
