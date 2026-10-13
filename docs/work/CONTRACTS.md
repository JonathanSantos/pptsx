# Contratos entre módulos

Tipos: **`src/core/types.ts`** (fonte da verdade). Padrões: **`src/core/defaults.ts`**. Este arquivo define a **API pública de cada pasta** (o que o `index.ts` exporta) e as regras de comportamento. Quem implementa um módulo pode criar arquivos internos à vontade, mas só estas assinaturas são consumidas por outros módulos.

Mudança de contrato: só o orquestrador. Agente que precisar de mudança para e reporta.

```
DeckDefinition(ctx) ─jsx─▶ SlideElement ─resolve─▶ ResolvedDeck
   ─layout(env)─▶ PositionedSlide ◀─▶ fit (loop) ─▶ PositionedDeck + Diagnostic[]
   ─emit─▶ Buffer .pptx
   ─preview─▶ SVG ─▶ PNG ─▶ overview PNG
```

---

## `src/sizes.ts`

```ts
export const PRESETS: Readonly<Record<SizePresetName, SlideSize>>;
export const inchesToPt: (inches: number) => Pt;
export const ptToInches: (pt: Pt) => number;
export const resolveSize: (spec: SizeSpec) => SlideSize;      // custom → name 'custom-10x7.5'
export const createContext: (size: SlideSize) => DeckContext;  // aspect, scale (DEFAULTS.referenceSize)
export const parseSizeList: (csv: string) => SizeSpec[];       // '16x9,4x3' | '10x7.5in' → custom
```
- Preset desconhecido lança `Error` com a lista de presets válidos.

## `src/jsx/` — runtime JSX

- `jsx-runtime.ts`: `jsx`, `jsxs`, `Fragment` e o `namespace JSX` (`Element = SlideElement`, `ElementChildrenAttribute = { children: {} }`, `IntrinsicElements = {}` — não há tags minúsculas).
- `jsx-dev-runtime.ts`: `jsxDEV` + `Fragment` (reexporta).
- `jsx(type, props, key?)` só cria `{ type, props, key }` congelado (`Object.freeze`). **Nunca chama componente.**
- `Fragment` é o símbolo `FRAGMENT` de `core/types.ts`.

## `src/primitives/`

```ts
export const definePrimitive: <K extends PrimitiveKind>(kind: K) => Primitive<K>;  // Factory
export const isPrimitive: (type: unknown) => type is Primitive<PrimitiveKind>;
export const Deck, Slide, Box, Text, Image, Shape;  // Primitive<'deck'> ... Primitive<'shape'>
```
- Chamar a primitiva como função (`Box(props)`) devolve `jsx(Box, props)` — útil fora de TSX.

## `src/index.ts` — API pública do pacote

Reexporta: primitivas, `Fragment`, `defineDeck`, `render` e os tipos públicos de `core/types.ts`. O `registerFont` da spec vira a opção `RenderOptions.fonts` (sem registro global mutável).
```ts
export const defineDeck: (fn: DeckDefinition) => DeckDefinition;  // identidade tipada
```

## `src/resolve/`

```ts
export const resolveDeck: (root: SlideElement) => ResolvedDeck;
export class ResolveError extends Error { path: string }
```
Regras:
1. Raiz tem que ser `Deck` (direto ou via componente). Filhos do Deck, após expandir, têm que ser `Slide`; senão `ResolveError`.
2. Componentes são chamados com `props` (incluindo `children`). Resultado é resolvido recursivamente.
3. Fragments, arrays, `null`, `undefined`, `true`, `false` são achatados/descartados.
4. Strings/números soltos fora de `Text` → `ResolveError` (texto sempre dentro de `Text`).
5. `Text`: filhos têm que ser strings/números (ou arrays deles); concatenados sem separador → `content`. Elemento dentro de Text → `ResolveError`.
6. `Image` e `Shape` não aceitam filhos.
7. `props` do nó resolvido = props do elemento **sem `children`**, como o autor escreveu.
8. **Path** (identifica o nó para diagnósticos):
   - segmento da primitiva = nome capitalizado (`Box`, `Text`, `Image`, `Shape`, `Slide`);
   - se um componente devolve (direta ou indiretamente, via outros componentes) uma primitiva, o segmento é o nome do **componente mais externo** (`fn.name`; anônimo → `Anonymous`);
   - sufixo `[i]` quando o pai tem mais de um filho resolvido com o mesmo segmento; `i` = índice entre esses irmãos (base 0);
   - o slide é o primeiro segmento; o Deck não entra. Slides não levam índice (o índice vai em `Diagnostic.slide`).
   - Ex.: `CoverLayout > Box > Text[0]`, `Slide > Bullets > Box[1] > Text`.

## `src/text/`

```ts
export const createFontRegistry: (faces: readonly FontFace[]) => FontRegistry;  // IO: carrega com fontkit
export interface FontRegistry {
  readonly faces: readonly FontFace[];
  readonly get: (family: string, weight: FontWeight, italic: boolean) => fontkit.Font | undefined;
}
export const createEstimateMeasurer: () => TextMeasurer;                          // M2
export const createFontkitMeasurer: (registry: FontRegistry, options?: { safety?: number }) => TextMeasurer;  // M3
```
Medidor estimado (M2): largura de caractere = `0.5 × size`, linha = `1.2 × size × lineHeight`, ascent = `0.9 × size × lineHeight`; quebra gulosa por palavra com a mesma regra.

Medidor fontkit (M3), algoritmo da spec:
1. Parágrafos por `\n`; linha vazia conta como linha.
2. Palavras medidas com `font.layout(word)` (kerning), `advance * size / unitsPerEm`; espaço medido também.
3. Quebra gulosa com largura `maxWidth × safety` (padrão `DEFAULTS.textSafety`).
4. Palavra maior que a linha: quebra por caractere.
5. `lineHeight = (ascent − descent + lineGap) / unitsPerEm × size × style.lineHeight`; `height = lines × lineHeight`.
6. `maxLines`: corta e termina a última linha com `…` (remove caracteres até `linha + '…'` caber); `truncated = true`.
7. Família/peso/itálico não registrado: usa a estimativa e marca `fontMissing = true` (o fit emite diagnóstico). Itálico sem face registrada cai para a face não itálica (sem `fontMissing`).
8. `width` = linha mais longa (sem espaço final).
9. `paragraphs` = linhas agrupadas por parágrafo; `paragraphs.flat()` é igual a `lines` (também após truncar: parágrafos inteiros cortados somem, o último fica com as linhas restantes).
10. Pontos de quebra: espaço (consumido) e também **depois** de `-` e `/` (mantidos na linha), como os renderizadores fazem com URLs e palavras compostas.

## `src/layout/`

```ts
export const layoutSlide: (slide: ResolvedSlide, size: SlideSize, env: LayoutEnv) => PositionedSlide;
export const layoutDeck: (deck: ResolvedDeck, size: SlideSize, env: LayoutEnv) => PositionedDeck;
```
- Slide ocupa `0,0,size.width,size.height` e é um contêiner flex (`ContainerProps`).
- `frame` de todo nó é **absoluto no slide** (não relativo ao pai).
- Mapeamento Yoga (M2): `direction`→flexDirection, `gap`→gap, `padding`→padding, `align`→alignItems, `justify`→justifyContent (`between`→SpaceBetween…), `grow/shrink`, `width/height/min/max` (número = pt, `"%"` = percent), `alignSelf`, `position`+`top/right/bottom/left`.
- Texto: nó Yoga com measure function chamando `env.measureText({ content, style: textStyleOf(props), maxWidth, maxLines })`. Largura `Undefined`/`AtMost` → `Infinity`/valor. O `TextLayout` final é recalculado com a **largura final do frame** e guardado em `PositionedText.text`.
- Imagem: `intrinsic = env.imageSize(src)`. Se só uma dimensão foi dada, usa `aspectRatio`. Com `grow` (e sem dimensões), o flex define a caixa inteira e o `fit` (contain/cover) cuida da proporção. Sem dimensão nem grow, tamanho natural em pt (`px × 0.75`).
- Shape `line`: desenhada da quina superior esquerda à inferior direita do frame.
- Yoga é liberado (`freeRecursive`) antes de retornar; nada de estado vazando.
- **M1** (provisório, substituído no M2): só `position="absolute"`.
- **M2 — detalhes Yoga** (`yoga-layout` v3, `import Yoga, { Edge, FlexDirection, ... } from 'yoga-layout'`):
  - Um `Config` próprio por chamada com `setPointScaleFactor(0)` (sem arredondar para pixel: a unidade é pt e queremos frações exatas) e `setUseWebDefaults(false)`.
  - Text e Image são folhas; Text com measure function. Text em fluxo usa a altura medida (não estica no eixo cruzado além do que o `align` mandar).
  - Absoluto segue a semântica do Yoga/CSS (sem tamanho → encolhe ao conteúdo; `left`+`right` → largura derivada).
  - `shrink` padrão = `DEFAULTS.item.shrink` (1, como no CSS).
  - `grow > 0` sem `width`/`height` no eixo principal ⇒ `flexBasis = DEFAULTS.item.growBasis` (0): `grow={n}` equivale a `flex: n` do CSS, e irmãos com o mesmo grow ficam iguais. Com tamanho explícito no eixo principal, o tamanho vira a base.
  - `Shape` sem tamanho segue o Yoga: 0 no eixo principal, estica no cruzado se `align=stretch`.
  - `padding` só em pt (sem %).
  - Box com `fill`/`stroke` não muda nada no layout.
  - O frame do Text é o resultado do Yoga; `PositionedText.text` é medido de novo com `frame.width` para as linhas finais.

## `src/fit/` (M4)

```ts
export interface FitInput { slide: ResolvedSlide; slideIndex: number; size: SlideSize; env: LayoutEnv }
export interface FitResult { slide: PositionedSlide; diagnostics: readonly Diagnostic[] }
export const fitSlide: (input: FitInput) => FitResult;
export interface Overflow { kind: 'text' | 'box' | 'slide'; path: string; overflowPt: number; overflowPct: number }
export const detectOverflow: (slide: PositionedSlide) => readonly Overflow[];   // pura
```

**Detecção** (tolerância `DEFAULTS.fit.epsilon` = 0.5 pt):
- `text`: `text.height > altura disponível`, onde altura disponível = frame do Text recortado pela área de conteúdo do pai (Text em fluxo). Ex.: numa row espremida pela coluna de fora, o Text fica com a própria altura medida, mas a row não — o recorte revela o estouro (com `shrink` 1 padrão, o Yoga espreme a caixa do texto quando o pai não cabe — o estouro aparece no próprio Text). `overflowPt` = diferença; `overflowPct` = diferença / frame.height × 100 (frame.height 0 → 100).
- `box`: Box/Slide cujos filhos **em fluxo** passam da área de conteúdo (frame − padding), no eixo vertical ou horizontal. Só reportado quando a causa não é um Text já reportado (ex.: tamanhos fixos que somam mais que o pai).
- `slide`: nó **em fluxo** com frame fora de `0..size`.
- Nós `position="absolute"` e seus descendentes são decoração: nunca geram `box`/`slide`.

**Escopo do shrink** (mantém a hierarquia tipográfica): para cada Text estourado, o escopo é o ancestral mais próximo que é **raiz de componente** (segmento do path que não é nome de primitiva, ex.: `Bullets`), excluindo o slide; sem nenhum, o filho de primeiro nível do slide que contém o texto. Todos os Text com `fit="shrink"` dentro do escopo e acima de `minSizeOf(props)` descem `DEFAULTS.fit.shrinkStep` (1 pt) juntos. Só um Text `shrink` estourado dispara o passo; `truncate`/`error` não fazem vizinhos encolherem. `fromSize`/`minSize` vêm sempre das props originais do autor.

**Loop:** layout → detectar → um passo de shrink por escopo estourado → repetir até não haver estouro, nenhum texto poder encolher, ou `DEFAULTS.maxFitIterations` (12). Depois: textos `fit="truncate"` estourados recebem `maxLines = max(1, floor(frame.height / text.lineHeight))` e há um relayout final.

O ajuste reescreve a árvore **resolvida** (`props.size`, `props.maxLines`), imutável, por path; nunca a posicionada.

**Diagnósticos** (`size` = `size.name`, `slide` = `slideIndex + 1`, `path` = path do nó; `message` em português, escrita para um LLM agir — diz o que aconteceu, quanto, e o que fazer):
| Situação | code | severity | data |
|---|---|---|---|
| shrink coube | `text-shrunk` | info | fromSize, toSize |
| shrink no mínimo e ainda estoura | `text-overflow` | error | overflowPt, overflowPct, fromSize, toSize |
| truncate aplicado (ou `maxLines` cortou) | `text-truncated` | warning | — |
| `fit="error"` estourado | `text-overflow` | error | overflowPt, overflowPct |
| Box estourado | `box-overflow` | error | overflowPt, overflowPct |
| nó em fluxo fora do slide | `out-of-slide` | error | overflowPt |
| imagem desenhada maior que px × 0.75 (abaixo de 96 dpi) | `image-upscaled` | info | — |
| `text.fontMissing` | `font-missing` | error | — |

Exemplo de message: `"Texto estourou 18% da altura disponível mesmo em 14 pt (mínimo); reduza o conteúdo, aumente a área ou baixe minSize."`

## `src/emit/`

```ts
export interface EmitOptions { debug?: boolean; baseDir: string }
export const emitPptx: (deck: PositionedDeck, options: EmitOptions) => Promise<Buffer>;
```
- Única etapa que importa `pptxgenjs`. Conversão pt → pol via `ptToInches`.
- Layout do pptx: `defineLayout({ name: size.name, width, height })` em polegadas, sempre.
- Despacho por `kind` em tabela (`Record<kind, NodeEmitter>`); nó Box só vira shape se tiver `fill` ou `stroke`.
- Texto (emissão neutra, **quebra forçada** — decisão do dono no gate do M3): cada parágrafo de `text.paragraphs` vira um `<a:p>` e as linhas dentro dele são unidas por quebra suave `<a:br/>`. Assim todo renderizador desenha exatamente as linhas calculadas (calibração: 34/34 no Keynote). O texto continua nativo e editável; só as quebras ficam fixas. Opções: `margin: 0`, `valign: 'top'`, `fit: 'none'`, `wrap: true`, `paraSpaceBefore: 0`, `paraSpaceAfter: 0`, espaçamento de linha via Strategy (M3): `'multiple'` → `lineSpacingMultiple = style.lineHeight × LINE_SPACING_CALIBRATION`; `'exact'` → `lineSpacing` em pt = `text.lineHeight` (o renderizador usa exatamente a altura calculada). A estratégia ativa e as constantes ficam em `src/emit/calibration.ts`; a calibração do M3 escolhe, `fontFace`, `fontSize`, `bold`, `italic`, `color` sem `#`, `align`.
- Texto usa `PositionedText.text.fontSize` (pode ter sido reduzido pelo fit); truncado já vem refletido em `paragraphs`.
- Imagem: `sizing: { type: fit, w, h }`; caminho via `resolveAssetPath(baseDir, src)`.
- Slide: `background` cor → `{ color }`; imagem → `{ path }`. `notes` → `addNotes`.
- Debug: contorno vermelho fino (0.5 pt, sem preenchimento, tracejado) em cada frame de Box/Text/Image.
- Retorna `Buffer` via `write({ outputType: 'nodebuffer' })`.

## `src/preview/` (M2)

```ts
export interface SvgOptions {
  widthPx: number;
  debug?: boolean;
  baseDir: string;
  /** família lógica → nome interno da fonte que o resvg conhece (ex.: Arial → Liberation Sans) */
  fontFamilyMap?: Readonly<Record<string, string>>;
  /** leitura de arquivo injetável (padrão fs.readFileSync) para manter o SVG testável */
  readFile?: (path: string) => Buffer;
}
export const slideToSvg: (slide: PositionedSlide, size: SlideSize, options: SvgOptions) => string;  // pura exceto leitura de imagem (injetável)
export const svgToPng: (svg: string, options: { widthPx: number; fontFiles: readonly string[] }) => Buffer;
export const buildOverview: (slides: readonly OverviewItem[], options?: { columns?: number; thumbWidth?: number; fontFiles?: readonly string[] }) => Buffer;
export interface OverviewItem { png: Buffer; number: number; badge?: 'error' | 'warning' }
```
- SVG em coordenadas pt com `viewBox="0 0 W H"` e `width=widthPx`.
- Texto: um `<text>` por linha de `PositionedText.text.lines`, `y = frame.y + i × lineHeight + ascent`, `x` conforme `align` (`text-anchor`). O SVG nunca quebra linha sozinho.
- Fonte no SVG: `font-family` = família do nó; resvg recebe os arquivos registrados (Liberation Sans responde como "Liberation Sans", então mapear `Arial` → `Liberation Sans` via `fontFamilyMap`, derivado dos `FontFace` registrados).
- Imagem: `<image href="data:...base64">` com `preserveAspectRatio` `xMidYMid meet` (contain) / `slice` (cover) + clipPath.
- Shapes: `rect`/`roundRect` (`rx`)/`ellipse`/`line` (do canto sup. esq. ao inf. dir.), com `strokeColorOf` de core/defaults. Box com fill/stroke vira `<rect>`. Fundo do slide: `<rect>` cor ou `<image>`.
- Ordem de desenho = ordem da árvore (igual ao emit).
- Debug: contorno de cada frame de Box/Text/Image (vermelho tracejado, igual ao emit); área fora do pai em vermelho translúcido (M4 aprofunda).
- Overview: SVG com os PNGs embutidos (base64) em grade, número abaixo de cada miniatura, fundo cinza claro, rasterizado pelo resvg (sem sharp). `badge` desenha um círculo vermelho/amarelo no canto da miniatura.
- Texto escapado para XML (`&`, `<`, `>`, aspas).

## `src/render.ts`

```ts
export const render: (deck: DeckDefinition, options?: RenderOptions) => Promise<RenderResult[]>;
```
- Por tamanho: `resolveSize` → `createContext` → `deck(ctx)` → `resolveDeck` → (M1–M3: `layoutDeck`; M4+: `fitSlide` por slide) → `emitPptx` → preview.
- Nunca grava arquivo nem imprime. IO permitido: ler fontes e imagens.

## `src/cli.ts`

`tsx-slides build <deck.tsx> [--size 16x9,4x3] [--out dist/] [--debug] [--json] [--preview native|none] [--preview-width 1280]`
- Carrega o deck com `import()` (rodando sob `tsx`), lê `tsx-slides.config.ts` opcional (`{ fonts }`), chama `render`, grava a árvore de arquivos da spec, imprime resumo ou JSON, `exit 1` se houver `error`.
- Sem config: registra Liberation Sans de `fonts/` como `Arial` (regular, bold, italic, bold italic).
