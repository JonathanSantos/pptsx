/**
 * CONTRATOS DO PIPELINE — fonte da verdade compartilhada entre os módulos.
 *
 * Regra: nenhum módulo redefine estes tipos. Mudança aqui só pelo orquestrador
 * (ver docs/work/CONTRACTS.md). Unidade interna é sempre pt (1 pol = 72 pt).
 *
 * Fluxo por tamanho de slide:
 *   DeckDefinition(ctx) -> SlideElement            (jsx)
 *   SlideElement        -> ResolvedDeck            (resolve)
 *   ResolvedSlide       -> PositionedSlide         (layout, com LayoutEnv)
 *   loop layout <-> ajuste                         (fit) -> FitResult
 *   PositionedDeck      -> Buffer .pptx            (emit)
 *   PositionedSlide     -> SVG -> PNG / overview   (preview)
 */

// ───────────────────────── Unidades e valores básicos ─────────────────────────

/** Pontos tipográficos. 1 pol = 72 pt. */
export type Pt = number;

/** Número = pt; string = percentual do pai (ex.: "50%"). */
export type Length = Pt | `${number}%`;

/** Cor hex '#RRGGBB'. */
export type Color = string;

export interface Rect {
  readonly x: Pt;
  readonly y: Pt;
  readonly width: Pt;
  readonly height: Pt;
}

export interface Dimensions {
  readonly width: number;
  readonly height: number;
}

// ───────────────────────── Tamanhos de slide ─────────────────────────

export type SizePresetName = '16x9' | '16x10' | '4x3' | 'wide';

/** Preset ou tamanho custom em POLEGADAS. */
export type SizeSpec = SizePresetName | { readonly width: number; readonly height: number };

export interface SlideSize {
  /** Nome do preset ou 'custom-<w>x<h>' (ex.: 'custom-10x7.5'). */
  readonly name: string;
  readonly width: Pt;
  readonly height: Pt;
}

/** Contexto que o deck recebe; um por tamanho renderizado. */
export interface DeckContext {
  readonly name: string;
  readonly width: Pt;
  readonly height: Pt;
  /** largura / altura */
  readonly aspect: number;
  /** min(width/720, height/405) — relativo ao 16:9 de referência. */
  readonly scale: number;
}

// ───────────────────────── Props das primitivas ─────────────────────────

export type Spacing =
  | Pt
  | { readonly top?: Pt; readonly right?: Pt; readonly bottom?: Pt; readonly left?: Pt };

export type FlexDirection = 'row' | 'column';
export type Align = 'start' | 'center' | 'end' | 'stretch';
export type Justify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';

/** Props de item flex aceitas por Box, Text, Image e Shape. */
export interface FlexItemProps {
  readonly width?: Length;
  readonly height?: Length;
  readonly minWidth?: Length;
  readonly maxWidth?: Length;
  readonly minHeight?: Length;
  readonly maxHeight?: Length;
  readonly grow?: number;
  readonly shrink?: number;
  readonly alignSelf?: Align;
  /** 'absolute' sai do fluxo flex; usado para decoração de fundo. */
  readonly position?: 'relative' | 'absolute';
  readonly top?: Length;
  readonly right?: Length;
  readonly bottom?: Length;
  readonly left?: Length;
}

/** Props de contêiner flex aceitas por Box e Slide. */
export interface ContainerProps {
  /** padrão 'column' */
  readonly direction?: FlexDirection;
  readonly gap?: Pt;
  readonly padding?: Spacing;
  /** align-items; padrão 'stretch' */
  readonly align?: Align;
  /** justify-content; padrão 'start' */
  readonly justify?: Justify;
}

export interface StrokeProps {
  readonly fill?: Color;
  readonly stroke?: Color;
  /** padrão 1 pt quando stroke definido */
  readonly strokeWidth?: Pt;
}

export interface DeckProps {
  readonly children?: Children;
}

export interface SlideProps extends ContainerProps {
  /** Cor hex ou caminho de imagem. */
  readonly background?: Color | { readonly image: string };
  readonly notes?: string;
  readonly children?: Children;
}

export interface BoxProps extends FlexItemProps, ContainerProps, StrokeProps {
  /** Raio dos cantos em pt; > 0 emite roundRect. */
  readonly radius?: Pt;
  readonly children?: Children;
}

export type FontWeight = 'regular' | 'bold';
export type TextAlign = 'left' | 'center' | 'right';
export type FitPolicy = 'shrink' | 'truncate' | 'error';

export interface TextStyleProps {
  /** Família registrada; padrão 'Arial'. */
  readonly font?: string;
  /** pt; padrão 18 */
  readonly size?: Pt;
  readonly weight?: FontWeight;
  readonly italic?: boolean;
  /** padrão '#000000' */
  readonly color?: Color;
  /** Multiplicador sobre a altura natural da fonte; padrão 1. */
  readonly lineHeight?: number;
  readonly align?: TextAlign;
}

export interface TextProps extends FlexItemProps, TextStyleProps {
  /** padrão 'shrink' */
  readonly fit?: FitPolicy;
  /** padrão: 75% de size (arredondado para baixo) */
  readonly minSize?: Pt;
  readonly maxLines?: number;
  /** Conteúdo: strings/números; concatenados na resolução. */
  readonly children?: TextChildren;
}

export type ImageFit = 'contain' | 'cover';

export interface ImageProps extends FlexItemProps {
  readonly src: string;
  /** padrão 'contain' */
  readonly fit?: ImageFit;
}

export type ShapeKind = 'rect' | 'roundRect' | 'ellipse' | 'line';

export interface ShapeProps extends FlexItemProps, StrokeProps {
  readonly kind: ShapeKind;
  /** Raio para roundRect, em pt. */
  readonly radius?: Pt;
}

// ───────────────────────── JSX / árvore não resolvida ─────────────────────────

export type PrimitiveKind = 'deck' | 'slide' | 'box' | 'text' | 'image' | 'shape';

export interface PrimitivePropsMap {
  readonly deck: DeckProps;
  readonly slide: SlideProps;
  readonly box: BoxProps;
  readonly text: TextProps;
  readonly image: ImageProps;
  readonly shape: ShapeProps;
}

/** Marca que identifica uma primitiva (vs componente do usuário). */
export const PRIMITIVE_KIND: unique symbol = Symbol.for('tsx-slides.primitive');

/**
 * Primitiva: função "marcada" com seu kind. Nunca é chamada pela engine;
 * existe para dar tipagem ao JSX (<Box ...>) e ser reconhecida no resolve.
 */
export interface Primitive<K extends PrimitiveKind> {
  (props: PrimitivePropsMap[K]): SlideElement;
  readonly [PRIMITIVE_KIND]: K;
}

/** Componente do usuário: função pura (props) => elemento. Sem hooks, sem estado. */
export type Component<P = any> = (props: P) => Child;

export const FRAGMENT: unique symbol = Symbol.for('tsx-slides.fragment');
export type FragmentType = typeof FRAGMENT;

export type ElementType = Primitive<PrimitiveKind> | Component | FragmentType;

/** Saída de jsx(): imutável, sem nenhuma resolução feita. */
export interface SlideElement {
  readonly type: ElementType;
  readonly props: Readonly<Record<string, unknown>> & { readonly children?: Children };
  readonly key?: string | number;
}

export type Child = SlideElement | string | number | boolean | null | undefined | readonly Child[];
export type Children = Child;
export type TextChildren = string | number | null | undefined | boolean | readonly TextChildren[];

/** O arquivo do deck exporta default defineDeck(fn). */
export type DeckDefinition = (ctx: DeckContext) => SlideElement;

// ───────────────────────── Árvore resolvida (só primitivas) ─────────────────────────

/**
 * Regras do path (ver CONTRACTS.md §resolve):
 *  - segmento = nome da primitiva capitalizada ('Box', 'Text'...) ou, quando
 *    um componente devolve a primitiva, o nome do componente ('CoverLayout').
 *  - sufixo [i] quando o pai tem mais de um filho com o mesmo segmento;
 *    i = índice entre esses irmãos homônimos, começando em 0.
 *  - o path começa no slide (o Deck não entra): 'CoverLayout > Box > Text[0]'.
 */
interface ResolvedBase<K extends PrimitiveKind, P> {
  readonly kind: K;
  readonly path: string;
  /** Props como o autor escreveu, sem children. Padrões: core/defaults.ts. */
  readonly props: P;
}

export interface ResolvedBox extends ResolvedBase<'box', Omit<BoxProps, 'children'>> {
  readonly children: readonly ResolvedNode[];
}

export interface ResolvedText extends ResolvedBase<'text', Omit<TextProps, 'children'>> {
  /** Conteúdo já concatenado; '\n' separa parágrafos. */
  readonly content: string;
}

export type ResolvedImage = ResolvedBase<'image', ImageProps>;
export type ResolvedShape = ResolvedBase<'shape', ShapeProps>;

export type ResolvedNode = ResolvedBox | ResolvedText | ResolvedImage | ResolvedShape;

export interface ResolvedSlide extends ResolvedBase<'slide', Omit<SlideProps, 'children'>> {
  readonly children: readonly ResolvedNode[];
}

export interface ResolvedDeck {
  readonly slides: readonly ResolvedSlide[];
}

// ───────────────────────── Texto ─────────────────────────

export interface FontFace {
  readonly family: string;
  readonly weight: FontWeight;
  readonly italic?: boolean;
  /** Caminho para .ttf/.otf */
  readonly file: string;
}

export interface TextStyle {
  readonly family: string;
  readonly size: Pt;
  readonly weight: FontWeight;
  readonly italic: boolean;
  readonly lineHeight: number;
}

export interface TextMeasureInput {
  readonly content: string;
  readonly style: TextStyle;
  /** Largura disponível em pt; Infinity = sem limite. */
  readonly maxWidth: Pt;
  readonly maxLines?: number;
}

/** Resultado da medição: as linhas JÁ quebradas são usadas por todos os emissores. */
export interface TextLayout {
  readonly lines: readonly string[];
  readonly fontSize: Pt;
  /** Altura de uma linha em pt. */
  readonly lineHeight: Pt;
  /** Distância do topo da linha até a baseline, em pt. */
  readonly ascent: Pt;
  /** Largura da linha mais longa. */
  readonly width: Pt;
  /** lines.length * lineHeight */
  readonly height: Pt;
  /** true se maxLines cortou o texto (reticências aplicadas). */
  readonly truncated: boolean;
  /** true se a família/peso não estava registrada (medição foi estimada). */
  readonly fontMissing: boolean;
}

/** Strategy: estimativa (M2) ou fontkit (M3). Função pura. */
export type TextMeasurer = (input: TextMeasureInput) => TextLayout;

// ───────────────────────── Layout ─────────────────────────

/** Dependências injetadas no layout (mantém a etapa pura e testável). */
export interface LayoutEnv {
  readonly measureText: TextMeasurer;
  /** Dimensões intrínsecas da imagem em px. */
  readonly imageSize: (src: string) => Dimensions;
}

interface Positioned {
  /** Retângulo ABSOLUTO no slide, em pt. */
  readonly frame: Rect;
}

export interface PositionedBox extends Omit<ResolvedBox, 'children'>, Positioned {
  readonly children: readonly PositionedNode[];
}
export interface PositionedText extends ResolvedText, Positioned {
  readonly text: TextLayout;
}
export interface PositionedImage extends ResolvedImage, Positioned {
  readonly intrinsic: Dimensions;
}
export interface PositionedShape extends ResolvedShape, Positioned {}

export type PositionedNode = PositionedBox | PositionedText | PositionedImage | PositionedShape;

export interface PositionedSlide extends Omit<ResolvedSlide, 'children'>, Positioned {
  readonly children: readonly PositionedNode[];
}

export interface PositionedDeck {
  readonly size: SlideSize;
  readonly slides: readonly PositionedSlide[];
}

// ───────────────────────── Diagnósticos ─────────────────────────

export type Severity = 'error' | 'warning' | 'info';

export type DiagnosticCode =
  | 'text-overflow'
  | 'text-shrunk'
  | 'text-truncated'
  | 'box-overflow'
  | 'out-of-slide'
  | 'image-upscaled'
  | 'font-missing';

export interface Diagnostic {
  readonly severity: Severity;
  readonly code: DiagnosticCode;
  readonly size: string;
  /** Índice do slide, começando em 1. */
  readonly slide: number;
  readonly path: string;
  /** Escrita para um LLM ler e agir. */
  readonly message: string;
  readonly data?: {
    readonly overflowPt?: number;
    readonly overflowPct?: number;
    readonly fromSize?: number;
    readonly toSize?: number;
  };
}

// ───────────────────────── API pública ─────────────────────────

export interface PreviewOptions {
  readonly mode: 'native';
  /** Largura em px de cada slide; padrão 1280. */
  readonly width?: number;
}

export interface RenderOptions {
  /** padrão ['16x9'] */
  readonly sizes?: readonly SizeSpec[];
  readonly fonts?: readonly FontFace[];
  /** padrão { mode: 'native', width: 1280 }; false desliga. */
  readonly preview?: PreviewOptions | false;
  readonly debug?: boolean;
  /** Base para resolver src relativos de imagens; padrão process.cwd(). */
  readonly baseDir?: string;
  /** Fator de segurança da quebra de linha; padrão 0.97. */
  readonly textSafety?: number;
}

export interface RenderResult {
  readonly size: string;
  readonly buffer: Buffer;
  readonly diagnostics: readonly Diagnostic[];
  readonly preview?: { readonly slides: readonly Buffer[]; readonly overview: Buffer };
}
