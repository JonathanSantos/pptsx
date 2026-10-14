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
- Texto (emissão neutra, **quebra forçada** — decisão do dono no gate do M3): cada parágrafo de `text.paragraphs` vira um `<a:p>` e as linhas dentro dele são unidas por quebra suave `<a:br/>`. Assim todo renderizador desenha exatamente as linhas calculadas (calibração: 34/34 no Keynote). O texto continua nativo e editável; só as quebras ficam fixas. Opções: `margin: 0`, `valign: 'top'`, `fit: 'none'`, `wrap: !nowrap` (Text com `nowrap` sai com `wrap="none"` no `<a:bodyPr>`, senão o renderizador requebra a linha que estourou — M8-H), `paraSpaceBefore: 0`, `paraSpaceAfter: 0`, espaçamento de linha via Strategy (M3): `'multiple'` → `lineSpacingMultiple = style.lineHeight × LINE_SPACING_CALIBRATION`; `'exact'` → `lineSpacing` em pt = `text.lineHeight` (o renderizador usa exatamente a altura calculada). A estratégia ativa e as constantes ficam em `src/emit/calibration.ts`; a calibração do M3 escolhe, `fontFace`, `fontSize`, `bold`, `italic`, `color` sem `#`, `align`.
- Texto usa `PositionedText.text.fontSize` (pode ter sido reduzido pelo fit); truncado já vem refletido em `paragraphs`.
- **`lineBreaks: 'auto'` (M7):** um `<a:p>` por parágrafo do autor com o texto do parágrafo num único run, sem `softBreakBefore`; `wrap: true`; demais opções iguais. O texto do run é o **parágrafo original** (`content.split('\n')[i]`, com espaços normalizados como o medidor faz: `split(/\s+/).join(' ')`), não a junção das linhas — assim palavra quebrada por caractere e `"a - b"` saem íntegros. Só quando `text.truncated` é true o run usa as linhas calculadas unidas por espaço (sem espaço após linha terminada em `-`/`/`), mantendo a reticência. A caixa continua com o frame calculado.
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
pptsx build <deck.tsx> [--size 16x9,4x3,10x7.5in] [--out dist/] [--debug] [--json] [--preview native|none] [--preview-width 1280]
                       [--lang pt-BR] [--line-breaks forced|auto] [--watch]
pptsx init [dir] [--force] [--json]
```
- **M7 `init`:** cria `deck.tsx` (2 slides só com primitivas), `tsconfig.json` (`jsx: react-jsx`, `jsxImportSource: pptsx`, `module: NodeNext`, `strict`, `skipLibCheck: true` — o `.d.ts` público usa `Buffer`), `pptsx.config.ts` (`defineConfig({})` comentado), `assets/.gitkeep` e `.gitignore` com `dist/`. **`package.json`:** se não existe, cria um mínimo com `"type": "module"`; se existe sem `type`, adiciona `"type": "module"` (preservando o resto); se tem `"type": "commonjs"`, **troca para `"module"` e avisa** (`npm init -y` no npm 11 grava `commonjs`; é o onboarding mais comum. Quem tem código CommonJS no mesmo pacote deve pôr o deck numa pasta própria). Motivo: o grafo do pacote tem top-level await (yoga-layout) e o deck precisa ser carregado como ESM. Recusa se `deck.tsx` já existe, salvo `--force`. Imprime os próximos comandos. Com `--json`: `{ files: [...] }`.
- **M7 erro de CJS:** se o `import()` do deck falhar com `ERR_REQUIRE_ASYNC_MODULE`, com a mensagem do Node sobre `require()`/top-level await, ou com `ERR_PACKAGE_PATH_NOT_EXPORTED` vindo de `node_modules/pptsx` (o `exports` tem `default` para o `require` chegar ao erro de TLA, mas versões de Node podem parar antes), a CLI troca por: `"O deck foi carregado como CommonJS; adicione "type": "module" ao package.json do projeto (ou renomeie o deck para .mtsx não é suportado: use type module)."` — texto final a critério do coder, desde que cite `"type": "module"`.
- **M7 tsconfig do deck (M7-G):** o tsx só aplica um tsconfig aos arquivos do `include` dele, então o fallback `tsconfig.deck.json` do pacote **não** vale para um deck fora de `node_modules/pptsx`. Antes de importar o deck, a CLI procura o `tsconfig.json` mais próximo subindo a partir do diretório do deck (como o `get-tsconfig` faz) e exige `compilerOptions.jsx` definido e `jsxImportSource === 'pptsx'`; sem tsconfig ou sem essas chaves → erro legível (exit 1; `{ error }` com `--json`): `"Não há tsconfig.json com jsx/jsxImportSource=pptsx para <deck>; rode `pptsx init` no diretório do deck ou adicione compilerOptions.jsx = "react-jsx" e jsxImportSource = "pptsx"."`. Dentro deste repo, o `tsconfig.json` da raiz atende. A validação é uma função pura `tsconfigProblemOf(tsconfigJson | undefined): string | undefined` + uma casca que lê o arquivo (com `extends` resolvido só um nível: se o tsconfig tem `extends`, a CLI confia e não bloqueia).
- **M7 `init` com tsconfig existente (M7-G):** se já existe `tsconfig.json`, o `init` mescla `compilerOptions.jsx = "react-jsx"` e `jsxImportSource = "pptsx"` quando ausentes (preservando o resto e a formatação em 2 espaços) e avisa; se existem com outros valores, avisa e não altera.
- **M7 `--watch` (M7-G):** começa a observar **antes** do build inicial; mudança durante um build entra na fila e dispara um rebuild ao final.
- **M7 `--help`/`-h`/`--version`:** `pptsx --help`, `pptsx -h`, `pptsx build --help` imprimem o `USAGE` e saem com 0; `pptsx --version` imprime a versão do `package.json` e sai com 0.
- **M7 bin:** `bin/pptsx.mjs` usa `../src/cli.ts` (+ tsconfig do repo) quando `src/cli.ts` existe (desenvolvimento), senão `../dist/cli.js` (+ `tsconfig.deck.json`) no pacote instalado. `files` do pacote filtra `dist/**/*.js` e `dist/**/*.d.ts` (a pasta `dist/` do repo também recebe saídas da CLI).
- **M7 `--watch`:** faz um build inicial e então observa o diretório do deck (recursivo) e o arquivo de config (ignorando `--out`, `node_modules` e `.git`); debounce 150 ms; a cada mudança refaz o build e imprime o resumo com hora; erro de sintaxe/estrutura não derruba o watch. Cada build do watch carrega deck e config num **namespace novo do tsx** (`register({ namespace })`), para que componentes/tokens importados sejam recarregados; o build normal usa `import()` simples. O tsconfig do namespace é o do `cwd` de `runCli` se existir, senão o do pacote. Com `--json`, um JSON por build, um por linha (NDJSON). Ctrl-C sai com 0. Injetáveis em `runCli(argv, cwd, deps)`: `deps.watch` (`(paths, onChange) => dispose`), `deps.signal` (AbortSignal) e `deps.importModule` (`(file, { fresh }) => Promise<module>`).
- **M7 `--line-breaks`:** vence `config.lineBreaks`; padrão `DEFAULTS.lineBreaks`. Config: `defineConfig({ ..., lineBreaks? })`.
- Carrega o deck com `import()` (rodando sob `tsx`), lê `pptsx.config.ts` opcional (`{ fonts }`), chama `render`, grava a árvore de arquivos da spec, imprime resumo ou JSON, `exit 1` se houver `error`.
- **Resumo (M6):** diagnósticos com `data.causedBy` são impressos logo abaixo da sua causa (a causa é o primeiro diagnóstico não derivado com `path === causedBy` ou, se não houver, o primeiro não derivado cujo path está **dentro** de `causedBy` — a causa costuma ser um Box sem diagnóstico próprio, e o estouro real está num Text dentro dele; só um não derivado ancora, então há um nível só de `↳`; derivado cuja única âncora possível também é derivada sai no lugar normal) com prefixo `↳` e indentação extra, e não contam no cabeçalho: `Diagnósticos: 2 error (+5 derivados), 1 warning, 0 info` (`+1 derivado` no singular). Sem derivados, o cabeçalho fica como hoje. Derivado cuja causa não está na lista (ex.: causa suprimida) é impresso no lugar normal, mas ainda conta como derivado. O exit code considera **todos** os `error`. `--json` imprime a lista completa, inalterada em forma.
- Sem config: registra Liberation Sans de `fonts/` como `Arial` (regular, bold, italic, bold italic).

---

## M8 — rich text, NBSP/nowrap, baseline, fontes do sistema e embed (regras por módulo)

Tipos novos em `core/types.ts`: `SpanProps`, kind `'span'`, `TextRun`, `ResolvedText.runs`, `TextMeasureInput.runs/nowrap`, `LineRun`, `TextLayout.lineRuns`, `Align 'baseline'`, `TextProps.nowrap`, `FontFace.file?`, `RenderOptions.embedFonts`, `RenderResult.fontsMissing`, `Diagnostic.data.axis`. Padrões: `DEFAULTS.embedFonts = false`, `DEFAULTS.watchDebounceMs = 150` (M7-B move `WATCH_DEBOUNCE_MS` para cá).

### `src/primitives/` + `src/index.ts` (M8-A)
- `Span = definePrimitive('span')`; `B` e `I` são **componentes** (não primitivas) definidos em `primitives/`: `B = (props) => <Span weight="bold" {...props} />`, `I = (props) => <Span italic {...props} />` (nome de função `B`/`I` para o path, embora nunca apareçam no path: Span não vira nó). Exportados de `src/index.ts`: `Span`, `B`, `I`, tipo `SpanProps`, `TextRun`, `LineRun`.

### `src/resolve/` (M8-A)
- Dentro de `Text`, filhos podem ser string/number/boolean/null/undefined/arrays **e elementos cujo tipo expandido é a primitiva `span`** (via componente `B`/`I` ou Span direto, inclusive aninhados). Qualquer outro elemento → `ResolveError('<Text> só aceita strings, números e <Span>/<B>/<I> como filhos (em <path>)')`.
- `Span` fora de `Text` (em Box/Slide/raiz/Deck) → `ResolveError('<Span> só pode aparecer dentro de <Text>')` com o path do pai. Componentes do usuário e Fragments dentro de `Text` são expandidos; o que vale é o tipo depois de expandir. O índice do sistema varre subpastas recursivamente e `resolveFontFaces` mantém `family` como o autor escreveu.
- `ResolvedText.runs`: percorre os filhos em ordem; cada trecho de texto vira um `TextRun` com o estilo efetivo = Text (`weight`, `italic`, `color` com padrões de `DEFAULTS.text`) sobrescrito pelos Span do caminho até ele (mais interno vence). Runs adjacentes com o **mesmo estilo** são fundidos. `content` = concatenação de `runs[].text`. Text sem Span → um run (quando `content` não é vazio; `content` vazio → `runs: []`).
- Span não entra no `path` nem gera nó.

### `src/text/` (M8-B)
- `TextMeasureInput.runs` ausente ⇒ um run com `weight`/`italic` do `style`.
- **Medição por run:** a largura de um segmento é a soma das larguras de suas partes, cada parte medida com a face do run (`registry.get(family, run.weight, run.italic)`); kerning não cruza fronteira de run. `widestSegment` idem.
- **NBSP (U+00A0) é glue:** não é ponto de quebra; fica dentro do segmento e é medido como espaço com a face do run. Pontos de quebra continuam sendo `\s` **exceto U+00A0**, e depois de `-`/`/`. `brokenWordsOf` usa a mesma regra (o `normalize` não pode converter NBSP em espaço).
- **`nowrap`:** cada parágrafo é uma linha só (sem quebra, sem quebra por caractere); `wordBroken = false`; `width` = linha mais larga mesmo que passe de `maxWidth`; `maxLines`/truncamento continuam valendo por parágrafo.
- `lineHeight`/`ascent` vêm da face do `style` (regular ou bold conforme `style.weight`); runs em outra face não mudam a altura. `fontMissing = true` se **qualquer** face usada por algum run faltar (aí toda a medição é estimada).
- `lineRuns`: para cada linha, a lista de `{ text, run }` na ordem, com `join('') === lines[i]`; a reticência do truncamento pertence ao último run da linha; linha vazia → `[]`.
- Estimador (`createEstimateMeasurer`) segue as mesmas regras com largura por caractere (bold = regular).

### `src/layout/` + `src/fit/` (M8-C)
- `align="baseline"` / `alignSelf="baseline"` em `row` → `Align.Baseline` do Yoga; em `column` → tratado como `start`. Baseline de cada nó: Text → `text.ascent` da 1ª linha (`setBaselineFunc` com a medição na largura dada); Box → baseline do 1º filho em fluxo (padrão do Yoga; se não houver filho com baseline, o Yoga usa a altura); Image/Shape → `frame.height`.
- `nowrap` num Text em `row`: `minWidth` = `width` medido sem limite (a linha mais larga), para o Yoga não espremer abaixo disso. Em `column`, nada muda (a largura vem do pai).
- `fit`: Text com `nowrap` cuja `text.width` passa da **largura disponível** (frame recortado pela área de conteúdo do pai, como na altura; numa row o `minWidth` alarga o frame até a linha, então só o recorte revela o estouro) + epsilon é um estouro de **largura**: entra em `detectOverflow` como `kind: 'text'` com `axis: 'width'` (campo novo em `Overflow`), dispara a busca no escopo como o estouro de altura (o `dMin` por `widestSegment` vale aqui também, já que `widestSegment` = linha inteira), e no fim gera `text-overflow` com `data.axis: 'width'` e mensagem própria: `"Texto com nowrap tem 212 pt de largura numa área de 180 pt mesmo em 14 pt (mínimo); encurte o texto, alargue a área ou remova nowrap."`. Estouro de altura continua sem `axis` (ou `'height'`).

- **Causa por largura (M8-C):** numa `row`, um Text `nowrap` com estouro de largura é a **causa** dos estouros dos irmãos em fluxo dessa row (e dos descendentes deles): `text-overflow`, `text-word-broken`, `box-overflow` e `out-of-slide` dentro da row recebem `data.causedBy = <path do nowrap>` com o sufixo de consequência (`"... <causa> tem <N> pt a mais de largura do que a área tem; corrija <causa> primeiro."`). O `box-overflow` da própria row também recebe `causedBy`. Se houver mais de um nowrap estourado na row, vence o de maior `overflowPt`. A demanda de altura (regra do M6) continua separada.
- **Baseline no Yoga (M8-C):** o binding JS do `yoga-layout` 3.2.1 não tem `setBaselineFunc`; a implementação usa um invólucro `column` com um marcador de altura = ascent (margem inferior −ascent) marcado `setIsReferenceBaseline(true)` e a folha medida abaixo, só quando a baseline do Text é lida por um ancestral `row` com `align`/`alignSelf = baseline`. Fora desse contexto o Text continua folha simples. **Contorno de bug do Yoga 3.2.1:** numa row de baseline, um filho com tamanho no eixo principal (`width` ou `grow`) e altura pelo conteúdo não entra na altura da row. `settleBaselineRows` (`src/layout/baseline.ts`), depois do `calculateLayout`, corrige a altura das rows de baseline sem `height` do autor: pelo `flexBasis` quando o pai é `column` (o shrink continua valendo), pelo `minHeight` quando o pai é `row` ou a row é absoluta; rows com `grow` em `column` não são tocadas; relayout até estabilizar (no máximo uma rodada por row).

### `src/fonts/` (M8-D; substitui `src/fonts.ts`)
- `src/fonts/index.ts` exporta `DEFAULT_FONTS`, `fontFamilyMapOf`, `resolveFontFaces`, `createSystemFontIndex`, `eotOf`.
- **Resolver do sistema:** `resolveFontFaces(faces, index?)` → `{ faces: FontFace[] (todas com file), missing: string[] }`. Face sem `file`: procura no índice por `family` (minúsculas, espaços colapsados), `weight` (`OS/2.usWeightClass ≥ 600` = bold) e `italic` (`OS/2.fsSelection` bit 0 ou `head.macStyle` bit 1). Não achou → vai para `missing` como `"Inter bold italic"` e NÃO entra em `faces` (o `font-missing` por nó continua saindo do fit). `createSystemFontIndex(dirs?)` varre uma vez (cache por processo) os diretórios: macOS `/System/Library/Fonts`, `/System/Library/Fonts/Supplemental`, `/Library/Fonts`, `~/Library/Fonts`; Linux `/usr/share/fonts`, `/usr/local/share/fonts`, `~/.fonts`, `~/.local/share/fonts`; Windows `%WINDIR%\Fonts`, `%LOCALAPPDATA%\Microsoft\Windows\Fonts`; `.ttf`/`.otf`/`.ttc` (cada face da coleção). Diretórios injetáveis para teste.
- **EOT:** `eotOf(ttf: Buffer, familyName: string): Buffer` gera EOT v2.1 sem compressão e sem XOR (o formato que o PowerPoint aceitou no spike M8-S; ver `docs/work/reports/m8-spike-fonts/build.mts`). `fsTypeOf(ttf): number` lê `OS/2.fsType`; `isEmbeddable(fsType)` = bit 1 (0x0002, restricted) desligado.
- `render.ts`: resolve as faces antes de criar o registro; `RenderResult.fontsMissing` lista as faltantes (ausente quando vazio); `embedFonts` vai ao `emitPptx` como lista de `EmbeddedFont = { family, weight, italic, eot: Buffer }` (o `render.ts` lê o arquivo e chama `eotOf`) com as faces **usadas no deck** (faces de `DEFAULT_FONTS` sob o nome Arial nunca entram; faces com `fsType` restrito, coleções `.ttc` e `.otf` CFF — o `eotOf` só empacota TrueType de uma face — entram em um diagnóstico `font-not-embeddable` warning por face e por tamanho, slide 0, path ''; a mensagem diz o motivo).
- **Coleções (M8):** `resolveFontFaces` preenche `FontFace.postscriptName` nas faces resolvidas; `createFontRegistry` abre com `fontkit.openSync(file, postscriptName)` quando presente, senão a 1ª face (cache por `file#postscriptName`). `fontFamilyMapOf` usa o `familyName` da face aberta.

### `src/emit/` (M8-E)
- Texto: para cada linha, um `<a:r>` por `LineRun`, com `bold`/`italic`/`color` do run; `softBreakBefore` só no 1º run da linha; `breakLine` só no último run da última linha do parágrafo. `lineBreaks: 'auto'`: um run por `TextRun` por parágrafo (texto original do autor dividido pelos runs; runs que cruzam `\n` são divididos).
- **Embed** (`src/emit/embed.ts`, pós-processamento do zip depois do `sanitizePptx`): para cada face da lista, `ppt/fonts/fontN.fntdata` (EOT), `[Content_Types].xml` com `<Default Extension="fntdata" ContentType="application/x-fontdata"/>`, relacionamento `…/relationships/font` em `ppt/_rels/presentation.xml.rels`, e `<p:embeddedFontLst>` em `ppt/presentation.xml` na posição do schema (depois de `notesSz`, antes de `defaultTextStyle`), um `<p:embeddedFont>` por família com `regular`/`bold`/`italic`/`boldItalic`; `embedTrueTypeFonts="1"` no `<p:presentation>`. Método exato no spike.
- **Sanitize:** além do `<a:pPr>`, reordena `<p:notesMasterIdLst>` para antes de `<p:sldIdLst>` em `presentation.xml` (pptxgenjs grava fora da ordem do schema).
- **Preview:** `<text>` por linha com um `<tspan>` por run (`font-weight`, `font-style`, `fill`, `xml:space="preserve"`); família via `fontFamilyMap`. Text com `fontMissing` não recebe o realce de estouro no `--debug` (o JSON suprime).

### `src/cli.ts` (sem dono nesta onda; orquestrador na integração)
- `--embed-fonts` (boolean) e `config.embedFonts`; `fontsMissing` do resultado aparece no resumo como linha `▲ fontes não encontradas no sistema: Inter bold` e no `--json` como campo `fontsMissing`.

## M9 — props responsivas por breakpoint, `ctx.pick` e slide de continuação (regras por módulo)

Tipos em `src/core/types.ts`: `Breakpoint`, `ResponsiveValue<T>`, `Responsive<T>`, `NonResponsiveKey`, `ResponsiveProps<P>`, `AuthorPropsMap`, `DeckContext.pick`, `BoxProps.paginate`, `ResolvedSlide.sourceSlide`, `DiagnosticCode 'slide-continued'`, `Diagnostic.data.sourceSlide/parts`. Padrões: `DEFAULTS.breakpoints = { tallAspect: 1.5, wideScale: 1.2 }`, `DEFAULTS.paginate = { maxParts: 10 }`.

### `src/core/responsive.ts` (M9-0, orquestrador — regra única)

```ts
export type ResponsiveContext = Pick<DeckContext, 'name' | 'aspect' | 'scale'>;
export const isBreakpointName: (key: string) => key is Breakpoint;          // 'tall' | 'wide' | preset | 'custom-*'
export const isResponsive: <T>(value: Responsive<T>) => value is ResponsiveValue<T>;  // objeto com chave própria `base`
export const responsiveProblemOf: (value: unknown) => string | undefined;  // malformado (ver abaixo) → mensagem
export const activeBreakpointsOf: (ctx: ResponsiveContext) => readonly Breakpoint[];  // [ctx.name, 'wide'?, 'tall'?]
export const pickResponsive: <T>(value: Responsive<T>, ctx: ResponsiveContext) => T;
```

- **Breakpoints ativos:** `ctx.name` sempre; `wide` quando `ctx.scale > wideScale`; `tall` quando `ctx.aspect < tallAspect`. O preset `wide` (960×540, scale 1,33) ativa `wide` pelos dois caminhos; `4x3` e `16x10` são `tall`; um custom `13.33x7.5in` é `wide` sem ser preset; um custom `10x7.5in` é `tall` e responde por `custom-10x7.5`.
- **Precedência:** o primeiro breakpoint ativo, na ordem nome exato > `wide` > `tall`, cuja chave existe no objeto com valor ≠ `undefined`; senão `base`. (`wide` vence `tall` porque mexe em tipografia; `tall` em estrutura.)
- **Responsivo sse** objeto (não array, não null) com chave própria `base`. `padding: { top: 10 }` e `background: { image }` não têm `base` e passam intactos.
- **Malformado** (`responsiveProblemOf`): objeto **sem `base`** cujas chaves são todas nomes de breakpoint (`{ tall: 24 }`) → `'objeto responsivo sem a chave "base"'`; objeto **com `base`** e alguma chave que não é breakpoint (`{ base: 1, tal: 2 }`) → `'breakpoint desconhecido: "tal"'`. Objeto vazio ou com chaves não-breakpoint e sem `base` → `undefined` (não é responsivo).

### `src/sizes.ts` (M9-0 já ligou)

`createContext(size)` devolve `pick: (value) => pickResponsive(value, ctx)`. Testável direto: `createContext(PRESETS['4x3']).pick({ base: 3, tall: 4 }) === 4`.

### `src/resolve/` (M9-A)

```ts
export const resolveDeck: (root: SlideElement, ctx: ResponsiveContext) => ResolvedDeck;
```

1. **Assinatura:** `resolveDeck(root, ctx)`. `render.ts` passa o mesmo `ctx` que deu ao deck. Chamadas sem `ctx` deixam de compilar (API pública: `resolveDeck` continua exportado de `src/index.ts`; quem usava passa `createContext(size)`).
2. **Onde resolve:** em `propsOf` (as props do nó, sem `children`), para `slide`, `box`, `text`, `image`, `shape`: cada valor de prop cuja chave não está em `NonResponsiveKey` passa por `pickResponsive`. Chaves de `NonResponsiveKey` (`src`, `kind`, `notes`, `children`) nunca são tocadas. `Span` (weight/italic/color) **não** é responsivo nesta onda (o estilo inline segue o Text).
3. **Validação:** para cada prop (fora de `NonResponsiveKey`), `responsiveProblemOf(valor)` ≠ `undefined` → `ResolveError` com a mensagem `Prop "<nome>" de <Primitiva>: <problema>` e o `path` do nó. Vale também para objetos vindos de JS sem tipos.
4. **Árvore resolvida só tem valores concretos:** `ResolvedNode.props` mantém os tipos de `PrimitivePropsMap` (não responsivos); layout, fit, emit e preview não mudam. Props que resolvem para `undefined` (`{ base: undefined }`) são **omitidas** do objeto, como se o autor não tivesse escrito.
5. **Componentes do usuário** repassam valores responsivos sem resolver: `<Bullets size={{ base: 20, wide: 24 }} />` → `<Text size={size}>`; a resolução acontece quando a primitiva é alcançada.
6. **`sourceSlide`:** `ResolvedSlide.sourceSlide = índice no <Deck> do autor + 1` (M9-0 já ligou).
7. **`paginate`:** mais de um `Box` com `paginate` (após resolver o valor, i.e. `true`) no mesmo slide → `ResolveError` `"Só um <Box paginate> por slide; encontrados N"` com o path do segundo. `paginate` num Box `position="absolute"` → `ResolveError` (decoração não pagina). O valor resolvido fica em `props.paginate` do `ResolvedBox` (o fit lê daí).
8. **Path** não muda.

### `src/fit/` + `src/render.ts` (M9-B)

```ts
export interface FitDeckInput { readonly deck: ResolvedDeck; readonly size: SlideSize; readonly env: LayoutEnv }
export interface FitDeckResult { readonly positioned: PositionedDeck; readonly diagnostics: readonly Diagnostic[] }
export const fitDeck: (input: FitDeckInput) => FitDeckResult;   // exportado de src/fit/index.ts; render.ts usa este
```

`fitSlide` continua existindo e inalterado para slides sem `Box paginate`. Novo `src/fit/paginate.ts` (puro).

**Slide de continuação** — para cada `ResolvedSlide` com um `Box paginate` (`props.paginate === true`), chamado aqui de **P**, com `n` filhos **em fluxo** (`position !== 'absolute'`):
1. **Sem shrink dentro de P:** enquanto o slide está sendo paginado, nenhum Text dentro de P entra em escopo de shrink nem dispara busca (eles ficam com o size do autor); os demais textos do slide encolhem normalmente. (Paginar existe para não encolher a lista.)
2. **Primeiro passe:** `fitSlide` do slide inteiro com a regra 1. Se não há `text-overflow`/`text-word-broken` dentro de P nem `box-overflow` em P, nem `out-of-slide` de P ou de um descendente em fluxo de P, o resultado desse passe **é o final** (um só slide, sem `slide-continued`).
3. **Bisseção em k:** senão, procura o **maior `k ∈ [1, n]`** tal que o slide com P contendo só os `k` primeiros filhos em fluxo (mais todos os filhos `absolute` de P) **não** tem nenhum dos estouros da regra 2. Cada tentativa é um `fitSlide` completo com a regra 1. `k = n` já foi testado no passe 2.
4. **Partes:** a parte atual sai com os `k` filhos. Um clone do slide (mesmas `props`, mesmo `path`, mesmo `sourceSlide`, mesmos outros nós, mesmas `notes`) recebe em P os filhos `k+1..n` (e os `absolute`), e volta ao passo 2 com esse clone. Os paths dos filhos de P **não mudam** (o filho `Box[7]` continua `Box[7]` na parte 2: o autor acha o item pelo índice original).
5. **Nada cabe (k seria 0):** se nem o 1º filho cabe sozinho, a parte fica **inteira** (todos os filhos restantes), a regra 1 deixa de valer para ela (shrink volta a funcionar em P) e saem os diagnósticos normais do `fitSlide`. Se isso acontece na 1ª parte, não há paginação nem `slide-continued`.
6. **Limite:** ao chegar a `DEFAULTS.paginate.maxParts` partes com filhos ainda sobrando, a última parte fica com todos os restantes (regra 5) e recebe um `box-overflow` em P cuja mensagem termina com `" A paginação parou em 10 partes; divida o conteúdo em mais de um slide no deck."`.
7. **Diagnóstico `slide-continued`** (info, `path` = path de P): **só na 1ª parte**, `data.parts` = total de partes, `data.sourceSlide`, mensagem `"Slide 2 do autor virou 3 slides (3 de 12 itens no 1º, 5 no 2º, 4 no 3º). Para caber em menos slides, reduza o size dos itens ou o conteúdo."`. Conta itens = filhos em fluxo de P.
8. **Índices:** `Diagnostic.slide` é o índice (base 1) no **deck de saída**. `data.sourceSlide` é preenchido em **todo** diagnóstico de slide cujo índice de saída difere do `sourceSlide`, e em todo diagnóstico de qualquer parte de uma paginação; nos demais slides fica ausente (como hoje). `PositionedSlide.sourceSlide` sai em todas as partes (herdado de `ResolvedSlide`).
9. **Agrupamento/causa** continuam por slide de saída, depois da paginação (cada parte é um `fitSlide`).
10. **`render.ts`:** troca o `fitDeck` local pelo de `src/fit/`; `resolveDeck(deck(ctx), ctx)` com o mesmo `ctx`. Preview, overview e emissor numeram pelo deck de saída; `notes` saem em todas as partes.

### `src/index.ts` (M9-0 já ligou)

Exporta os tipos `Breakpoint`, `Responsive`, `ResponsiveValue`, `ResponsiveProps`, `AuthorPropsMap`. `resolveDeck` passa a exigir `ctx`.

## M10 — `Chart` e `Table` nativos (regras por módulo)

Tipos em `src/core/types.ts`: `ChartKind`, `ChartSeries`, `ChartData`, `ChartProps`, `TableCellValue`, `TableColumn`, `TableHeaderStyle`, `TableFitPolicy`, `TableProps`, kinds `'chart' | 'table'` em `PrimitiveKind`/`PrimitivePropsMap`/`AuthorPropsMap`, `ResolvedChart`, `ResolvedTable` (rows já em string), `PositionedChart`, `PositionedTable` (`fontSize`, `columnWidths`, `rowHeights`, `cells`, `height`), código `'table-overflow'` e `data.shownRows/totalRows`. Padrões e helpers em `src/core/defaults.ts`: `DEFAULTS.chart` (palette, labelSize 12, labelColor, barGapWidthPct 80, lineSize 2, borderWidth 0), `DEFAULTS.table` (size 14, cellPadding 4, header bold, fit shrink, borderWidth 0.5), `tableStyleOf`, `tableFitOf`, `tableMinSizeOf`, `tableHeaderOf`, `chartLabelStyleOf`, `chartColorOf`, `chartLegendOf`. Primitivas `Chart` e `Table` já existem em `src/primitives/index.ts` e são exportadas de `src/index.ts` (M10-0).

Todo módulo que despacha por `kind` (`DispatchTable`) passa a cobrir `chart` e `table`; todo helper que lista kinds de primitiva (`fit/scope.ts PRIMITIVE_KINDS`) inclui os dois.

### `src/resolve/` + `src/primitives/` (M10-A)

- `chart`/`table` são folhas: filhos → `ResolveError` `"<Chart> não aceita filhos"` (idem Table). Props responsivas valem como nas outras primitivas (`data`, `columns`, `rows` podem ser responsivos; são objetos/arrays sem `base`, passam intactos quando concretos).
- **Chart** valida após resolver as props: `kind` ∈ bar/line/pie; `categories.length ≥ 1`; `series.length ≥ 1`; cada `series[i].values.length === categories.length` (erro: `"<Chart>: a série \"Receita\" tem 3 valores para 4 categorias"`); `pie` com `series.length !== 1` → `"<Chart kind=\"pie\"> aceita uma única série; recebeu 2"`; valor não finito → erro citando série e índice. Tamanho: sem `width`, `height`, `grow` (> 0) e sem `position="absolute"` → `"<Chart> precisa de width, height ou grow: um gráfico não tem tamanho próprio"`.
- **Table** valida: `columns.length ≥ 1`; cada `rows[i].length === columns.length` (erro: `"<Table>: a linha 3 tem 3 células para 4 colunas"`); `rows` pode ser vazio (só cabeçalho). Células `number` viram `String(n)`; strings ficam como estão (NBSP e `\n` valem como no Text). `ResolvedTable.rows` sai normalizado; `props.rows` continua como o autor escreveu.
- Path: segmentos `Chart`/`Table` (ou o nome do componente), como as outras primitivas.

### `src/layout/` (M10-B)

```ts
// src/layout/table.ts (puro; exportado de src/layout/index.ts para o tester)
export interface TableLayout { columnWidths: Pt[]; rowHeights: Pt[]; cells: TextLayout[][]; height: Pt; width: Pt }
export const columnWidthsOf: (columns: readonly TableColumn[], tableWidth: Pt) => readonly Pt[];
export const measureTable: (table: ResolvedTable, width: Pt /* Infinity = sem limite */, env: LayoutEnv) => TableLayout;
```

- **Chart:** folha sem measure function, `toItemStyle(props, parent.direction)` (como Shape). Fica com o que o flex der; `grow` segue a regra geral (basis 0).
- **Larguras de coluna** (`columnWidthsOf`): coluna com `width` em pt fica fixa; em `%` é a fração da largura da tabela; as sem `width` dividem **igualmente** o que sobra (`max(0, restante) / n`). Sem coluna livre e soma ≠ largura → escala todas proporcionalmente para fechar a largura. Resultado sempre soma `tableWidth` (quando finita).
- **Células** (`measureTable`): para cada linha (cabeçalho primeiro, quando `tableHeaderOf(props)` ≠ undefined) e coluna, `env.measureText({ content, style, maxWidth: max(0, colW − 2 × cellPadding) })`, com `style = tableStyleOf(props)`; no cabeçalho `weight = header.weight ?? 'bold'`. `rowHeights[r] = max(cells[r][c].height) + 2 × cellPadding`; `height = Σ rowHeights`. Linhas de dados vazias (`rows = []`) → só o cabeçalho.
- **Largura indefinida** (Yoga `Undefined`/`AtMost`, ex.: Table numa row sem `grow`/`width`): células medidas com `maxWidth = Infinity`; **todas as colunas livres (e `%`) recebem a mesma largura** = célula livre mais larga da tabela + 2 × padding (assim a remedição com a largura final, que divide o resto igualmente, dá as mesmas colunas e nada requebra); coluna fixa em pt = o valor; `width = Σ`. Em `AtMost` o resultado é `min(width, limite)`; nos dois modos a altura é remedida com a largura escolhida. Casos de borda de `columnWidthsOf`: fixas que já passam da largura → livres com 0 e tudo escalado para fechar a largura; sem livres e soma 0 → divisão igual.
- **Nó Yoga da Table:** folha com measure function (como Text): `Exactly` → `{ width, height: measureTable(...).height }`; `AtMost`/`Undefined` → largura natural acima. Numa `column` segue a exceção do Text (sem basis 0; a altura é o conteúdo); numa `row` com `grow`, basis 0. `read` remede com `frame.width` e devolve `PositionedTable` com `fontSize = tableStyleOf(props).size`, `columnWidths`, `rowHeights`, `cells`, `height`.
- O `frame` da tabela é o do Yoga (pode ser menor que `height` quando o pai espremeu: é o estouro que o fit detecta).

### `src/fit/` (M10-C)

- `Overflow.kind` ganha `'table'`. Detecção: como o Text (`availableHeightOf` = frame recortado pela área de conteúdo do pai; em fluxo), `excess = table.height − available` > epsilon → `{ kind: 'table', path, overflowPt, overflowPct }`. Uma Table estourada **não conta** para o `box` do pai (mesma regra do Text). Sem estouro de largura (a tabela ocupa a largura dada).
- **Plano:** a Table entra em `plansOf` com `{ from: tableStyleOf(props).size, min: min(from, tableMinSizeOf(props)), policy }`, onde a policy de `'shrink'` é a mesma do Text (`resize` por delta × shrinkStep) e a de `'error'` não encolhe. `rewrite.ts` aplica `size` também em nós `table` (ignora `maxLines`).
- **Gatilho:** Table `shrink` com estouro de altura, ou com alguma célula `wordBroken` enquanto `fontSize > min` (como a palavra partida do Text; `widestSegment` da célula mais larga em relação à sua coluna dá o `d_word`, com `breakWidth = colW − 2 × padding` e **sem** `textSafety`... use a mesma conta do Text com o `textSafety` da engine se o medidor aplicar: siga o que `search.ts` faz para Text e trate cada célula como uma linha de largura `colW − 2 × padding`). Escopo: `scopeOf(path)` como no Text. A tabela desce **junto** com os Text do escopo.
- **Fonte ausente:** alguma célula com `fontMissing` → só `font-missing` (uma vez, no path da tabela); nada de `table-overflow`, e não dispara shrink.
- **Diagnósticos finais** (no path da Table): coube após encolher → `text-shrunk` (info, `fromSize/toSize`; mensagem diz "Tabela reduzida de 14 pt para 11 pt"); não coube no mínimo, ou `fit="error"` → `table-overflow` (error): `"Tabela estourou 38 pt (24%) da altura disponível mesmo em 10 pt (mínimo): 4 de 6 linhas cabem inteiras. Reduza linhas/colunas, encurte o texto das células, aumente a área ou baixe minSize."`, `data { overflowPt, overflowPct, fromSize, toSize, shownRows, totalRows }` (`shownRows` = linhas de **dados** cujo fundo fica dentro da altura disponível; o cabeçalho não conta; `totalRows = rows.length`). Reduzida abaixo de `minLegibleSize` → `text-illegible` (warning) como no Text. Célula com palavra partida que persiste → `text-word-broken` (warning, path da tabela, cita a palavra e a coluna: `"na coluna \"Área\""`).
- **Causa (M6):** demanda da Table = `max(0, height − frame.height)` (como Text); com `height` explícito do autor, 0. Chart: 0.
- **Agrupamento:** sem mudança (tabelas irmãs homônimas agrupam como qualquer nó).
- `pass.ts`: `resolvedTexts`/`positionedTexts` continuam só Text; crie `resolvedTables`/`positionedTables` (ou um par genérico "shrinkable") sem mudar as assinaturas usadas pelos testes existentes.

### `src/emit/` (M10-D) — fechado após o spike `docs/work/reports/M10-spike.md`

- **Correção obrigatória do xlsx embutido** (`sanitize.ts` ou `embed`-like, na borda): o pptxgenjs 4.0.1 grava `ref="A1:B4'"` (apóstrofo sobrando) em `ppt/embeddings/*.xlsx` → `xl/tables/table1.xml`; com isso o Keynote mostra o slide vazio. Depois do `write()`, abrir cada `ppt/embeddings/*.xlsx` (zip dentro do zip, JSZip) e remover o apóstrofo final do atributo `ref`. Teste: o `ref` dos xlsx não termina em `'`.
- **Unidades:** tudo em polegadas (`ptToInches`): `x, y`, `w = Σ columnWidths`, `h = Σ rowHeights`, `colW[]`, `rowH[]`. `margin` em polegadas como array `[T, R, B, L]` = `cellPadding / 72` nos quatro lados (o pptxgenjs lê o array em pt quando o 1º elemento é ≥ 1, por isso o valor em polegadas tem que ficar < 1: `cellPadding` ≥ 72 pt → lançar erro de emissão claro). `rowH[i]` = `rowHeights[i]` arredondado **para cima** ao múltiplo de 0,5 pt (o Keynote só cresce a linha quando falta espaço; o layout continua usando o valor exato).
- **Chart:** `slide.addChart(pptx.ChartType[kind], data, options)`; `data = series.map(s => ({ name, labels: categories, values }))`; opções: `x, y, w, h` (o frame inteiro; o renderizador decide a área de plotagem), `chartColors` = `chartColorOf(props, i)` sem `#` para **cada** série (bar/line) ou **cada** categoria (pie) — sempre uma cor por item, senão a pizza sorteia cores; `chartArea: { roundedCorners: false }`; `showLegend = chartLegendOf(props)`, `legendPos: 'b'`, `legendFontFace/Size/Color`; `showValue = showValues === true`, `dataLabelFontFace/Size/Color`, `dataLabelPosition: 'outEnd'` (bar) / `'t'` (line) / `'bestFit'` (pie), `dataLabelFormatCode` derivado do maior número de casas decimais dos dados (`'0'`, `'0.0'`, `'0.00'`…; o padrão `#,##0` arredonda 38,2 para "38"); `catAxisLabelFontFace/Size/Color`, `valAxisLabelFontFace/Size/Color`, `valAxisLabelFormatCode` idem; `showTitle = title !== undefined`, `title`, `titleFontFace/Size (= labelSize + 2)/Color`; bar: `barDir: 'col'`, `barGapWidthPct = DEFAULTS.chart.barGapWidthPct`; line: `lineSize = DEFAULTS.chart.lineSize`, `lineDataSymbol: 'none'`; pie: `showPercent: false`, `showLabel: false`, `dataNoEffects: true`; bar/line: `valGridLine: { color: 'DDDDDD', size: 0.5 }`, `catGridLine: { style: 'none' }`; sem borda (`DEFAULTS.chart.borderWidth` = 0 → nada). Fontes = `chartLabelStyleOf(props).family`.
- **Table:** `slide.addTable(rows, options)`. `rows`: uma `TableRow` por linha de `cells` (cabeçalho incluído), célula `{ text: runs, options: { align: coluna.align ?? 'left', valign: 'top', bold?, fill?, color? } }`, onde `runs` são as **linhas já quebradas** da célula, uma run por linha com `breakLine: true` entre elas (vira um `<a:p>` por linha calculada; o Keynote respeita e a altura bate em ±0,25 pt); com `lineBreaks: 'auto'` um run com o texto original da célula (`\n` do autor vira `breakLine`). Opções: `x, y, w, h, colW, rowH, margin` conforme acima, `fontFace = tableStyleOf(props).family`, `fontSize = node.fontSize`, `color = props.color ?? DEFAULTS.text.color`, `border` = `{ type: 'solid', pt: DEFAULTS.table.borderWidth, color }` quando `props.border`, senão `{ type: 'none' }`, `autoPage: false`, `lang`. Sem `lineSpacing` na célula. Cabeçalho: `bold = (header.weight ?? bold) === 'bold'`, `fill = header.fill`, `color = header.color`; zebra: `fill = stripe` nas linhas de dados de índice ímpar.
- **Renumeração dos gráficos** (`src/emit/renumber.ts`, chamada primeiro em `sanitizePptx`): o pptxgenjs numera `chartN.xml`/`Microsoft_Excel_WorksheetN.xlsx` com um contador de módulo que nunca zera entre apresentações (a 2ª saída de um processo começaria em `chart7`). Os números são remapeados para `1..n` na ordem de criação (ordem dos slides) em nomes de parte, `.rels` e `[Content_Types].xml`; decks sem gráfico saem byte a byte iguais.
- As chamadas `addChart`/`addTable` recebem cópia profunda (`structuredClone`) porque o pptxgenjs muta dados e opções. `lang` vai em cada célula (o pptxgenjs não propaga o da tabela); células de dados levam `bold: false` explícito. `cellPadding ≥ 72` → `EmitError` com o path da tabela.
- **Debug:** contorno em Chart e Table como nos outros frames.
- **O que o Keynote altera (não é bug da engine):** tamanho exato do gráfico/área de plotagem (margens internas ~32/13/13/26 pt), recuo horizontal mínimo ~2,2 pt na célula, passo de linha truncado a 16,0 pt (engine 16,1), bordas de 0,5 pt a ~50%.

### `src/preview/` (M10-E)

```ts
export const chartSvg: (node: PositionedChart, options: TextSvgOptions) => string;
export const tableSvg: (node: PositionedTable, options: TextSvgOptions) => string;
```
- **Table:** um `<rect>` **só nas células com fundo** (header.fill no cabeçalho, `stripe` nas linhas de dados de índice ímpar: 2ª, 4ª…); com `border`, a grade é desenhada como `<line>` por fronteira ((linhas + 1) horizontais + (colunas + 1) verticais, `borderWidth`), não um stroke por célula; por linha de `cells[r][c].lines` um `<text>` com a mesma regra do `textSvg` (`y = topo + i × lineHeight + ascent`, `x` por `align` com `text-anchor`, padding `cellPadding`); cabeçalho com `font-weight` do header e `fill` = `header.color`. Nada além de `frame.y + frame.height` é desenhado (clip pelo frame); em `--debug`, a parte da tabela que passa do frame recebe a faixa sólida de estouro (como `textOverflowSvg`), além do contorno.
- **Chart:** SVG próprio, sem biblioteca, dentro do frame com margem interna de `labelSize` pt: `bar` → eixo Y de 0 ao máximo "bonito" (1/2/5 × 10^n) com 4–5 ticks e rótulos, barras agrupadas por categoria (largura do grupo = 1/(1+gap)), cores por série, rótulos de categoria embaixo; `line` → mesma grade, uma `<polyline>` por série com `stroke-width = lineSize`; `pie` → fatias por `<path>` com arcos a partir de 12 h, cores por categoria; `showValues` → valor acima da barra/ponto ou no meio da fatia; `legend` → uma linha abaixo (quadrado colorido + nome); `title` → centrado no topo. Fonte `chartLabelStyleOf` com `fontFamilyMap`. Objetivo: reconhecer dados e proporções no overview; nada de diagnóstico de divergência. Valores negativos em bar/line: eixo de mínimo "bonito" negativo e barras para baixo; pie com negativo → ignora o sinal.

### `src/index.ts` / docs (M10-0 já ligou)

`Chart`, `Table` e os tipos acima exportados. `CLAUDE.md`/guia são do M10-G.

## M11 — motor CSS (adoção da PoC; regras por módulo)

Origem: `docs/work/poc/browser-layout.md`, `docs/work/reports/POC-css.md` e o código de `poc/css/` (apagado no gate). Decisões em `docs/work/milestones/M11.md` §Decisões. Tipos em `src/core/types.ts` (bloco "Valores CSS (M11)", `ResolvedBase.css`, `Positioned.box/cell`, `TextRun.underline/lineThrough`, `'css-not-emitted'`, `TextMeasureInput.letterSpacing`, `LayoutEnv.textSafety`, `lineHeight: number | 'normal'`, `AuthorPropsMap` CSS) e `src/core/css-props.ts`; padrões em `DEFAULTS.css` e `DEFAULTS.text.lineHeight = 'normal'`.

**Regra geral da adoção:** cada módulo substitui ou funde o seu com o equivalente de `poc/css/<módulo>/`, trocando os imports de `poc/css/types.ts` pelos de `src/core/types.ts` (mesmos nomes). Onde a PoC tinha um comentário `PoC:` numa cópia de `src/`, a adaptação entra no original. O comportamento validado na PoC (H2–H5) é o contrato; divergir é bug.

### `src/resolve/` + `src/primitives/` (M11-A)
- `resolveDeck(root, ctx)` produz nós com `css` (normalizado, herdado) **e** `props` (visão da engine derivada; `poc/css/resolve/legacy.ts`). Shorthands (`margin`, `padding`, `inset`, `border*`, `gap`, `flex`, `place*`, `background`), `style` (vence props; o que não tem de/para vai para `css.notEmitted`), herança de `fontFamily/fontSize/fontWeight/fontStyle/color/lineHeight/textAlign/letterSpacing/textTransform` (Table herda família/size/cor/lineHeight; Chart, família e cor), aliases antigos (`direction/align/justify/grow/shrink/fill/stroke/strokeWidth/radius`, `font/size/weight/italic/align` em Text), `display: none` poda depois do path (irmãos mantêm índice), responsivo em qualquer prop inclusive dentro de `style`. `lineHeight` chega a `props` como `number | 'normal'` sem conversão.
- `src/primitives/index.ts`: as primitivas ficam tipadas por `AuthorPropsMap` (já é o caso via `Primitive<K>`); `Span` aceita `fontWeight/fontStyle/textDecoration`.

### `src/layout/` + `src/text/` (M11-B)
- `src/layout/` = `poc/css/layout/` (config com `useWebDefaults(true)`, `tree.ts`, `read.ts` com `box`/`cell`, `style.ts`, `grid.ts`, `grid-layout.ts`, `intrinsic.ts`, `baseline.ts`, `table.ts`, `measure.ts`). Exporta `layoutSlide`, `layoutDeck`, `measureInputOf`, `contentRectOf`, `columnWidthsOf`, `measureTable`, e do grid o que os testes da PoC importam.
- `src/text/`: o medidor fontkit ganha `letterSpacing` (pt por caractere, como `poc/css/text/measure.ts`) e a **semântica CSS do `lineHeight`**: `'normal'` → `(ascent − descent + lineGap)/unitsPerEm × size` (igual a hoje); número `n` → `lineHeight = n × size`, com meia-entrelinha `(lineHeight − natural)/2` acima e abaixo; `TextLayout.ascent` passa a ser `meia-entrelinha + ascent natural` (distância do topo da linha à baseline). `createEstimateMeasurer` idem.

### `src/fit/` (M11-C)
- Aplica as adaptações `PoC:` de `poc/css/fit/` em `src/fit/`: área de conteúdo = frame − border − padding (`contentRectOf`); margens dos filhos entram na soma do `box-overflow` e na demanda da causa; item de grid usa `cell` como área disponível (célula estourada = `box-overflow` do item com a célula como contêiner; sem `causedBy` entre células); linha de wrap = "row" para a causa; `css.ts` com `cssNotEmittedOf(positioned)` (warning por propriedade/valor/motivo/path, uma vez por nó); `scope.ts` inalterado. `fitSlide`/`fitDeck` mantêm assinatura.

### `src/emit/` + `src/preview/` (M11-D)
- `src/emit/paint.ts` (de `poc/css/paint.ts`): ordem de pintura e transformações herdadas (contexto de empilhamento: z negativo antes do fluxo, auto/0 depois, positivo por último; opacidade = produto dos ancestrais; rotação acumulada com centro levado pelos ancestrais). Emissor e preview iteram pelos `PaintItem`s, nunca pela árvore.
- Pintura (de `poc/css/emit/decoration.ts` e `runs.ts`): fundo com alpha de rgba, borda uniforme dentro do border-box (frame deslocado em `width/2`), bordas por lado como shapes `line`, `borderRadius`, sombra única externa, `opacity` por forma/run, `rotate`/`translate`, `backgroundImage` cover atrás das bordas, `outline` (alias `stroke`) sem ocupar espaço, Text com fundo/borda/padding = forma atrás da caixa de texto, `textDecoration` por run, `letterSpacing` → `charSpacing`, `textTransform` já aplicado. `lineHeight` numérico → `lineSpacing` exato em pt (`text.lineHeight`); `'normal'` → como hoje (Strategy ativa). Chart/Table não giram (`css-not-emitted`).
- Preview: mesmas regras; o que não sai no PPTX não é desenhado.

### `src/render.ts`, `src/cli.ts`, `src/index.ts` (orquestrador, integração)
- `render` usa o medidor com `letterSpacing`, `fitDeck` + `cssNotEmittedOf`; `LayoutEnv.textSafety` preenchido. `index.ts` exporta os tipos de `css-props.ts`. `poc/` e `poc:test` somem; `tools/oracle/` (dev-only) e `scripts/` recebem o oráculo e a calibração.

### Aliases antigos (M11, até remoção futura)
`direction→flexDirection`, `align→alignItems`, `justify→justifyContent`, `grow→flexGrow` (basis pela regra antiga), `shrink→flexShrink`, `fill→backgroundColor`, `stroke/strokeWidth→outline`, `radius→borderRadius`, `font→fontFamily`, `size→fontSize`, `weight→fontWeight`, `italic→fontStyle`, `align` (Text)→`textAlign`. Documentados só no apêndice de migração do guia.
