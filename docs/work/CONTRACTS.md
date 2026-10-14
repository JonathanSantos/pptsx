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
9a. `wordBroken` = true quando alguma palavra (segmento sem ponto de quebra) foi quebrada por caractere.
9b. **(M6)** `widestSegment` = largura (pt, no size atual) do maior segmento indivisível do texto inteiro (`segmentsOf` de cada parágrafo, antes de qualquer quebra por caractere ou truncamento). Texto vazio → 0. O estimador segue a mesma regra com a sua largura por caractere.
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
  - **Exceção (M5-F):** Text numa `column` NÃO recebe basis 0 (a altura do texto é o próprio conteúdo; basis 0 + shrink zerava a altura). Em `row`, Text com grow recebe basis 0 normalmente.
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
- Sem duplicatas: Text estourado não conta para o `box` do pai; nó fora do slide dentro de um **Box** com `box` não gera `slide`; no nível do **Slide**, o que sai da página vira `slide` e não conta para o `box` do Slide.
- Mensagens dizem o eixo/lado e a conta (soma × área disponível; "pela direita"; "mostradas N de M linhas").

**Escopo do shrink** (mantém a hierarquia tipográfica): para cada Text estourado, o escopo é o ancestral mais próximo que é **raiz de componente** (segmento do path que não é nome de primitiva, ex.: `Bullets`), excluindo o slide; sem nenhum, o filho de primeiro nível do slide que contém o texto. Todos os Text com `fit="shrink"` dentro do escopo e acima de `minSizeOf(props)` descem `DEFAULTS.fit.shrinkStep` (1 pt) juntos. Só um Text `shrink` estourado dispara o passo; `truncate`/`error` não fazem vizinhos encolherem. `fromSize`/`minSize` vêm sempre das props originais do autor.

**Palavra partida conta como estouro (M5-F, refinado no M6):** um Text `fit="shrink"` com `text.wordBroken` dispara a busca no seu escopo, como um estouro de altura, **mas só enquanto o próprio Text ainda está acima do seu mínimo**: encolher os vizinhos não alarga a linha dele, então um Text já no mínimo com palavra partida não arrasta o escopo (o estouro de altura, ao contrário, continua disparando mesmo no mínimo, porque os vizinhos liberam altura). Se ainda houver palavra partida no fim, `text-word-broken` warning (a mensagem cita a palavra partida e sugere encurtar, alargar a área ou reduzir size).

**Loop (M6 — busca binária):** uma **rodada** = para cada escopo disparado (do mais interno ao mais externo, por profundidade do path), uma busca binária em inteiros no delta `d ∈ [dMin, maxDelta]` aplicado a todos os Text `shrink` do escopo (`size = max(min, from − d)`; `maxDelta = max(from − min)` do escopo; `from`/`min` sempre das props originais). A busca procura o **menor `d` sem gatilho** no escopo (nenhum `text` overflow e nenhum `wordBroken` nos Text shrink do escopo); se nem `maxDelta` resolve, fica em `maxDelta`. **Passo por palavra (antes da bisseção):** cada Text do escopo com `wordBroken` (e acima do mínimo) vai **sozinho**, num layout só, ao size em que a palavra cabe: `d_word = ceil(from − from × breakWidth / widestSegment)`, onde `breakWidth = frame.width × textSafety`, limitado ao próprio `min`. O piso por palavra vale só para o próprio Text; os vizinhos só descem pelo que a altura exigir na bisseção comum que vem depois. Cada tentativa é um `layoutSlide` completo. Rodadas repetem até não haver gatilho em nenhum escopo ou `DEFAULTS.maxFitIterations` rodadas. Um Text que já está em `min` não entra em nenhuma busca. A mensagem "o ajuste parou após N passos" **deixa de existir**: se não coube, foi no mínimo. Depois do loop: textos `fit="truncate"` estourados recebem `maxLines = max(1, floor(frame.height / text.lineHeight))` e há um relayout final.

**Causa (M6):** em cada contêiner em fluxo (Slide ou Box) com pelo menos um estouro `text`/`box` entre os descendentes, a **demanda** de cada filho em fluxo é: Text → `max(0, text.height − frame.height)`; Box `column` → soma das demandas positivas dos filhos em fluxo; Box `row` → a maior; Image/Shape → 0. Demanda é **0** para Text com `fontMissing` (medição estimada) e para Box/Text com `height` explícito do autor (tamanho fixo não é espremido nem toma altura dos irmãos: o estouro dentro dele é problema próprio). Um contêiner só tem causa quando está **sobrecarregado**: `Σ (frame.height + demanda) dos filhos em fluxo + gap × (n − 1) > altura de conteúdo + epsilon`; senão (tamanhos fixos que cabem, cada um com estouro interno) ninguém é causa de ninguém. O filho de maior demanda (> 0; empate → menor índice) é a **causa** do contêiner. **Contêiner `row` não aponta causa** (filhos lado a lado não tiram altura uns dos outros; sem isso N cartões iguais culpariam o primeiro). Todo diagnóstico `text-overflow`/`box-overflow` recebe `data.causedBy = <path da causa>` do **ancestral mais próximo cuja causa não contém o nó** (o nó não é a causa nem está dentro dela; se o contêiner mais próximo tem o próprio nó como causa, sobe para o seguinte), e a mensagem ganha o sufixo `" Esse estouro é consequência: <causa> pede <N> pt a mais do que a área tem; corrija <causa> primeiro."` (N = demanda da causa, 1 casa). Severidade não muda. Demanda máxima 0 (só tamanhos fixos + gap) → sem causa.

**Área zero (M6):** Text com altura disponível ≤ `epsilon` tem mensagem própria em `text-overflow`: `"A área disponível para o texto é 0 pt: o contêiner não deu altura a ele (grow={1} em coluna com altura pelo conteúdo, shrink dos irmãos ou height fixo). Remova grow do Text ou dê altura ao contêiner."`.

**Fonte ausente (M6):** Text com `text.fontMissing` gera **só** `font-missing`; `text-overflow`, `text-shrunk`, `text-word-broken` e `text-illegible` desse Text são suprimidos (a medição é estimada). Ele também não dispara shrink de escopo.

**Legibilidade (M6):** depois do ajuste, Text `shrink` com `to < from` e `to < DEFAULTS.text.minLegibleSize` gera `text-illegible` (warning): `"Texto reduzido de 11 pt para 8 pt, abaixo do piso legível de 10 pt; encurte o conteúdo, aumente a área ou aceite com minSize explícito."`, `data { fromSize, toSize }`. Size do autor já abaixo do piso → nada. Sem `minSize` explícito, `minSizeOf` já não desce abaixo do piso (ver `core/defaults.ts`).

**Agrupamento (M6, último passo, depois da causa):** dois diagnósticos se agrupam quando têm mesmo `size`, `slide`, `code`, `severity`, mesmo `data.causedBy` (ou ambos sem), **mesmos `data.fromSize` e `data.toSize`** (ou ambos sem: um `text-shrunk` 44→41 não se mistura com os 44→28 dos irmãos), e paths iguais a menos do índice `[i]` em **um único** segmento (o mesmo segmento nos dois). O grupo vira um diagnóstico com `path` em que esse segmento recebe `[a..b]` (índices contíguos) ou `[0,2,5]` (não contíguos), `data.count`, `data.paths` (individuais, em ordem crescente de índice), e `message`/`data` numéricos do **pior** (maior `overflowPt`; sem `overflowPt`, menor `toSize`; empate → menor índice), com a mensagem seguida de `" (×N: mesmo problema em <Segmento>[a..b])"`. Ordem de saída: o grupo fica na posição do primeiro membro. Diagnósticos únicos não ganham `count`/`paths`.

```ts
export const groupDiagnostics: (diagnostics: readonly Diagnostic[]) => readonly Diagnostic[];  // pura; exportada de src/fit/index.ts
```

O ajuste reescreve a árvore **resolvida** (`props.size`, `props.maxLines`), imutável, por path; nunca a posicionada.

**Diagnósticos** (`size` = `size.name`, `slide` = `slideIndex + 1`, `path` = path do nó; `message` em português, escrita para um LLM agir — diz o que aconteceu, quanto, e o que fazer):
| Situação | code | severity | data |
|---|---|---|---|
| shrink coube | `text-shrunk` | info | fromSize, toSize |
| shrink no mínimo e ainda estoura | `text-overflow` | error | overflowPt, overflowPct, fromSize, toSize (+ causedBy quando é consequência) |
| shrink reduziu abaixo de `minLegibleSize` | `text-illegible` | warning | fromSize, toSize |
| truncate aplicado (ou `maxLines` cortou) | `text-truncated` | warning | — |
| `fit="error"` estourado | `text-overflow` | error | overflowPt, overflowPct |
| Box estourado | `box-overflow` | error | overflowPt, overflowPct |
| nó em fluxo fora do slide | `out-of-slide` | error | overflowPt |
| imagem desenhada maior que px × 0.75 (abaixo de 96 dpi) | `image-upscaled` | info | — |
| `text.fontMissing` | `font-missing` | error | — |
| palavra quebrada por caractere (`text.wordBroken`) que persiste após o shrink | `text-word-broken` | warning | fromSize, toSize |

Exemplo de message: `"Texto estourou 18% da altura disponível mesmo em 14 pt (mínimo); reduza o conteúdo, aumente a área ou baixe minSize."`

## `src/core/dispatch.ts` (M7)

```ts
export type DispatchTable<N extends { kind: string }, R, Extra extends unknown[] = []>;
export const dispatch: <N, R, Extra>(table: DispatchTable<N, R, Extra>, node: N, ...extra: Extra) => R;
```
Único cast de despacho por `kind` do projeto. `layout/tree.ts`, `layout/read.ts`, `emit/emitters.ts` e `preview/slide.ts` usam `dispatch(TABELA, node, ...)` em vez de `as never`/`as Builder<...>`. M7-D pode ajustar a assinatura deste arquivo se a inferência não fechar (é o único arquivo de `core/` com dono fora do orquestrador nessa onda).

## `src/emit/`

```ts
export interface EmitOptions { debug?: boolean; baseDir: string; lang?: string; lineBreaks?: LineBreaks /* padrão DEFAULTS.lineBreaks */ }
export const emitPptx: (deck: PositionedDeck, options: EmitOptions) => Promise<Buffer>;
```
- Única etapa que importa `pptxgenjs`. Conversão pt → pol via `ptToInches`.
- Layout do pptx: `defineLayout({ name: size.name, width, height })` em polegadas, sempre.
- Despacho por `kind` em tabela (`Record<kind, NodeEmitter>`); nó Box só vira shape se tiver `fill` ou `stroke`.
- Texto (emissão neutra, **quebra forçada** — decisão do dono no gate do M3): cada parágrafo de `text.paragraphs` vira um `<a:p>` e as linhas dentro dele são unidas por quebra suave `<a:br/>`. Assim todo renderizador desenha exatamente as linhas calculadas (calibração: 34/34 no Keynote). O texto continua nativo e editável; só as quebras ficam fixas. Opções: `margin: 0`, `valign: 'top'`, `fit: 'none'`, `wrap: true`, `paraSpaceBefore: 0`, `paraSpaceAfter: 0`, espaçamento de linha via Strategy (M3): `'multiple'` → `lineSpacingMultiple = style.lineHeight × LINE_SPACING_CALIBRATION`; `'exact'` → `lineSpacing` em pt = `text.lineHeight` (o renderizador usa exatamente a altura calculada). A estratégia ativa e as constantes ficam em `src/emit/calibration.ts`; a calibração do M3 escolhe, `fontFace`, `fontSize`, `bold`, `italic`, `color` sem `#`, `align`.
- Texto usa `PositionedText.text.fontSize` (pode ter sido reduzido pelo fit); truncado já vem refletido em `paragraphs`.
- **`lineBreaks: 'auto'` (M7):** um `<a:p>` por parágrafo do autor com o texto inteiro do parágrafo num único run (`paragraphs[i].join(' ')`, pois as linhas foram separadas em espaço; um segmento que termina em `-`/`/` não recebe espaço), sem `softBreakBefore`; `wrap: true`; demais opções iguais. A caixa continua com o frame calculado. Texto truncado mantém a reticência.
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
- **M7:** `options.lineBreaks` vai ao emissor; `options.includePositioned` devolve `RenderResult.positioned` (a mesma árvore pós-fit enviada ao emissor).
- Nunca grava arquivo nem imprime. IO permitido: ler fontes e imagens.

## `src/cli.ts`

```
pptsx build <deck.tsx> [--size 16x9,4x3] [--out dist/] [--debug] [--json] [--preview native|none] [--preview-width 1280]
                       [--lang pt-BR] [--line-breaks forced|auto] [--watch]
pptsx init [dir] [--force]
```
- **M7 `init`:** cria `deck.tsx` (2 slides só com primitivas), `tsconfig.json` (`jsx: react-jsx`, `jsxImportSource: pptsx`, `module: NodeNext`, `strict`), `pptsx.config.ts` (`defineConfig({})` comentado), `assets/.gitkeep` e `.gitignore` com `dist/`. Recusa se `deck.tsx` já existe, salvo `--force`. Imprime os próximos comandos. Com `--json`: `{ files: [...] }`.
- **M7 `--watch`:** observa o diretório do deck (recursivo), a config e o diretório dos assets; debounce 150 ms; a cada mudança refaz o build e imprime o resumo com hora; erro de sintaxe/estrutura não derruba o watch (imprime e espera). O `import()` do deck e da config usa `?v=<Date.now()>` para furar o cache ESM. Com `--json`, um JSON por build, um por linha (NDJSON). Ctrl-C sai com 0. A função de observação é injetável (`runCli(argv, cwd, { watch })`, assinatura `(paths: readonly string[], onChange: () => void) => () => void`) para o tester.
- **M7 `--line-breaks`:** vence `config.lineBreaks`; padrão `DEFAULTS.lineBreaks`. Config: `defineConfig({ ..., lineBreaks? })`.
- Carrega o deck com `import()` (rodando sob `tsx`), lê `pptsx.config.ts` opcional (`{ fonts }`), chama `render`, grava a árvore de arquivos da spec, imprime resumo ou JSON, `exit 1` se houver `error`.
- **Resumo (M6):** diagnósticos com `data.causedBy` são impressos logo abaixo da sua causa (a causa é o primeiro diagnóstico não derivado com `path === causedBy` ou, se não houver, o primeiro não derivado cujo path está **dentro** de `causedBy` — a causa costuma ser um Box sem diagnóstico próprio, e o estouro real está num Text dentro dele; só um não derivado ancora, então há um nível só de `↳`; derivado cuja única âncora possível também é derivada sai no lugar normal) com prefixo `↳` e indentação extra, e não contam no cabeçalho: `Diagnósticos: 2 error (+5 derivados), 1 warning, 0 info` (`+1 derivado` no singular). Sem derivados, o cabeçalho fica como hoje. Derivado cuja causa não está na lista (ex.: causa suprimida) é impresso no lugar normal, mas ainda conta como derivado. O exit code considera **todos** os `error`. `--json` imprime a lista completa, inalterada em forma.
- Sem config: registra Liberation Sans de `fonts/` como `Arial` (regular, bold, italic, bold italic).
